/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SANDBOX PAYOUT PARTNER — a stand-in for a licensed payout firm   ║
   ║                                                                   ║
   ║  Cross-border money reaches a bank or mobile wallet through a     ║
   ║  licensed payout partner, never through Trending directly. There  ║
   ║  is no partner yet, so this plays one, with a partner's shape:    ║
   ║                                                                   ║
   ║  · Trending asks it to pay out (createPayout), keyed by the       ║
   ║    transfer id, so asking twice pays once.                        ║
   ║  · It answers later, on its own clock, with signed webhook events ║
   ║    - accepted, processing, completed, failed, action required,    ║
   ║    under review - exactly as a real partner would. Trending moves ║
   ║    a transfer ONLY on a verified event; nothing the browser says  ║
   ║    can complete, fail or refund a payout.                         ║
   ║  · Its own records live in the pay store (sandbox_payouts), so a  ║
   ║    restart doesn't lose an event that was due.                    ║
   ║                                                                   ║
   ║  It never moves real money. The recipient's name decides what     ║
   ║  happens, so every path can be tried on purpose:                  ║
   ║                                                                   ║
   ║    contains "fail"    the receiving bank rejects it → refunded    ║
   ║    contains "review"  the partner checks it first, then pays      ║
   ║    contains "check"   the account name differs → action required  ║
   ║    anything else      paid out                                    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');

function sign(secret, rawBody, tsSec) {
  const v1 = crypto.createHmac('sha256', secret).update(`${tsSec}.${rawBody}`).digest('hex');
  return `t=${tsSec},v1=${v1}`;
}

function scenarioOf(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('fail')) return 'fail';
  if (n.includes('review')) return 'review';
  if (n.includes('check')) return 'check';
  return 'ok';
}

function makeSandboxPartner(opts) {
  const { store, deliver } = opts;
  const clock = opts.now || Date.now;
  const secret = opts.secret;                         // () => string
  const sec = Object.assign({ accept: 3, processing: 10, complete: 25 }, opts.seconds || {});
  const rid = n => crypto.randomBytes(n).toString('hex').toUpperCase();
  const at = s => clock() + s * 1000;

  async function createPayout({ transferId, amount, currency, recipient }) {
    return store.tx(async u => {
      const had = await u.get('sandbox_payouts', transferId);
      if (had) return { ref: had.ref, duplicate: true };
      const p = {
        _id: transferId, ref: 'SBX-' + rid(5), amount, currency,
        recipient: { name: recipient.name, country: recipient.country, method: recipient.method },
        scenario: scenarioOf(recipient.name), createdAt: clock(),
        queue: [{ type: 'payout.accepted', due: at(sec.accept) }]
      };
      await u.insert('sandbox_payouts', p);
      return { ref: p.ref };
    });
  }

  /* What follows an event, for each scenario. */
  function next(p, type) {
    const s = p.scenario;
    if (type === 'payout.accepted') {
      if (s === 'review') return [{ type: 'payout.review', due: at(sec.processing / 2), data: { reason: 'The payout partner is checking this transfer before paying it, as the law requires for some payments.' } }];
      if (s === 'check') {
        const alt = String(p.recipient.name).replace(/check/ig, '').trim() || 'another name';
        return [{ type: 'payout.action_required', due: at(sec.processing / 2), data: {
          question: `The receiving account is registered to "${alt.split(' ')[0]} ${String.fromCharCode(65 + (alt.length % 26))}." — not exactly "${p.recipient.name}". Is this the person you meant to pay?`,
          options: ['confirm', 'cancel'] } }];
      }
      return [{ type: 'payout.processing', due: at(sec.processing) }];
    }
    if (type === 'payout.review') return [{ type: 'payout.released', due: at(sec.processing) }];
    if (type === 'payout.released' || type === 'payout.processing') {
      return s === 'fail'
        ? [{ type: 'payout.failed', due: at(sec.complete - sec.processing), data: { reason: 'The receiving bank rejected the account details.' } }]
        : [{ type: 'payout.completed', due: at(sec.complete - sec.processing) }];
    }
    return [];
  }

  /* An answer to "action required", sent on by Trending when the person
     replies. Confirm: the payout continues. Cancel: it fails and the
     money comes back. */
  async function resolve(transferId, answer) {
    return store.tx(async u => {
      const p = await u.get('sandbox_payouts', transferId);
      if (!p || p.waiting !== 'answer') return { ok: false };
      const q = answer === 'confirm'
        ? [{ type: 'payout.released', due: at(0) }]
        : [{ type: 'payout.failed', due: at(0), data: { reason: 'You cancelled it when the partner asked about the account name.' } }];
      await u.update('sandbox_payouts', transferId, { waiting: null, queue: q });
      return { ok: true };
    });
  }

  /* Send every event that is due. Delivery that fails is retried on a
     later tick, the way a partner retries a webhook. */
  async function tick() {
    const now = clock();
    const due = await store.read(u => u.find('sandbox_payouts', {}, {}));
    let sent = 0;
    for (const p of due) {
      const ev = p.queue && p.queue[0];
      if (!ev || ev.due > now) continue;
      const event = { id: 'evt_' + rid(8), type: ev.type, ref: p.ref, transferId: p._id,
        amount: p.amount, currency: p.currency, at: now, data: ev.data || {} };
      const raw = JSON.stringify(event);
      try {
        await deliver(raw, { 'trending-signature': sign(secret(), raw, Math.floor(now / 1000)) });
      } catch (e) {
        await store.tx(u => u.update('sandbox_payouts', p._id, { queue: [{ ...ev, due: now + 5000 }].concat(p.queue.slice(1)) }));
        continue;
      }
      const follow = next(p, ev.type);
      await store.tx(u => u.update('sandbox_payouts', p._id, {
        queue: follow.concat(p.queue.slice(1)), stage: ev.type,
        waiting: ev.type === 'payout.action_required' ? 'answer' : null
      }));
      sent++;
    }
    return sent;
  }

  const lookup = transferId => store.read(u => u.get('sandbox_payouts', transferId));
  return { name: 'sandbox', label: 'Practice payout partner', createPayout, lookup, resolve, tick, scenarioOf };
}

module.exports = { makeSandboxPartner, sign, scenarioOf };
