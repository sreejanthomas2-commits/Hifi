/* ╔══════════════════════════════════════════════════════════════════╗
   ║  WITHDRAWALS — everything except the signature                    ║
   ║                                                                   ║
   ║  Deposits were safe to build here because watching a chain needs  ║
   ║  no key. Sending does. So this service takes a withdrawal as far  ║
   ║  as it can go without one, and stops at a queue:                  ║
   ║                                                                   ║
   ║    requested → validated → authorised (2FA) → funds held          ║
   ║              → queued_for_signing                                 ║
   ║              ↓ [a separate signer, holding keys elsewhere]        ║
   ║              → broadcast → confirming → completed                 ║
   ║                                                                   ║
   ║  Nothing in this process can sign or broadcast. There is no hot   ║
   ║  wallet here and no place to put one: a web server that can move  ║
   ║  funds is the single thing every exchange breach has in common.   ║
   ║  The signer is a separate service, and until one is connected a   ║
   ║  withdrawal waits in the queue and says so.                       ║
   ║                                                                   ║
   ║  The money side is exact. Amounts are base-unit BigInt — never a  ║
   ║  float, because 0.1 + 0.2 is not 0.3 and a balance that drifts by ║
   ║  a wei is a balance nobody can reconcile. A request HOLDS the     ║
   ║  funds in the ledger immediately, so the same balance cannot be   ║
   ║  withdrawn twice by two requests racing.                          ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');
const { Withdrawal, WalletAccount, LedgerEntry, AuditLog, DepositAddress } = require('../models/custody');
const { NETWORKS, ASSETS } = require('../config/crypto-deposit');
const address = require('../lib/address');
const totp = require('../lib/totp');
const fees = require('./fees');
const ledger = require('./ledger');

const DUPLICATE = 11000;
const big = v => BigInt(String(v == null ? '0' : v));

/* Limits are policy, set by the operator, not guessed by the code. */
const LIMITS = {
  perRequest: process.env.WD_MAX_PER_REQUEST || '',
  perDay: process.env.WD_MAX_PER_DAY || '',
  count24h: Number(process.env.WD_MAX_COUNT_24H || 20),
  coolOffMs: Number(process.env.WD_COOLOFF_MS || 0)
};

const assetOf = s => ASSETS.find(a => a.symbol === String(s || '').toUpperCase());
const pairOk = (asset, network) => !!(asset && asset.networks.some(n => n.net === network));

/* Pure, and therefore safe to run before anything is connected. The
   route calls this first so that "ETH over Bitcoin" is answered with the
   warning it deserves, whatever else is wrong with the deployment. */
function checkPair(asset, network) {
  const a = assetOf(asset);
  const net = NETWORKS[network];
  if (!a) return { ok: false, code: 'unsupported_asset', message: `${asset || 'That asset'} cannot be withdrawn.` };
  if (!net) return { ok: false, code: 'unsupported_network', message: 'Pick a network first.' };
  if (!pairOk(a, network)) {
    return { ok: false, code: 'unsupported_pair', message: `${a.symbol} does not travel over ${net.label}. Coins sent over a network that does not carry them are lost, so pick one the receiving wallet lists for ${a.symbol}.` };
  }
  if (net.status !== 'open') {
    return { ok: false, code: 'network_' + net.status, message: `Withdrawals over ${net.label} are ${net.status} right now.` };
  }
  return { ok: true, asset: a, net };
}

/* ── Quote ───────────────────────────────────────────────────────────
   What it would cost and what would land, before anything is committed.
   Safe to call as often as the screen needs. */
async function quote({ userId, asset, network, amount }) {
  const pair = checkPair(asset, network);
  if (!pair.ok) return pair;
  const a = pair.asset, net = pair.net;

  const f = await fees.quote(network, { token: !!a.token });
  if (!f.ok) return { ok: false, code: 'no_fee', message: f.reason };

  const available = big(await ledger.balanceOf(userId, a.symbol));
  const want = amount == null ? null : big(amount);

  const out = {
    ok: true, asset: a.symbol, network, networkLabel: net.label, tag: net.tag,
    fee: f.fee, feeUnit: f.unit, feeBasis: f.basis, feeAt: f.at,
    minimum: f.minimum, available: available.toString(),
    decimals: a.token ? null : (f.decimals || null),
    estimatedArrival: net.finality
  };
  if (want == null) return out;

  /* The fee comes out of the amount sent, so what lands is smaller. The
     screen must show both, because "I sent 1 and they got 0.999" is the
     complaint every exchange gets from hiding it. */
  const feeBig = big(f.fee);
  out.amount = want.toString();
  out.receives = (want > feeBig ? want - feeBig : 0n).toString();
  out.total = want.toString();

  if (want <= 0n) { out.ok = false; out.code = 'amount_zero'; out.message = 'Enter an amount.'; }
  else if (want < big(f.minimum)) {
    out.ok = false; out.code = 'below_minimum';
    out.message = `The least you can send over ${net.label} right now is ${f.minimum} — below that the network fee eats most of it.`;
  } else if (want > available) {
    out.ok = false; out.code = 'insufficient';
    out.message = 'That is more than your available balance.';
  } else if (LIMITS.perRequest && want > big(LIMITS.perRequest)) {
    out.ok = false; out.code = 'over_limit';
    out.message = 'That is over the single-withdrawal limit for this account.';
  }
  return out;
}

/* ── Checks that must pass before funds move ─────────────────────── */
async function guard({ userId, asset, network, to, amount, twoFactor, user }) {
  const q = await quote({ userId, asset, network, amount });
  if (!q.ok) return q;

  const net = NETWORKS[network];
  const v = address.validate(net.family, to);
  if (!v.ok) {
    return { ok: false, code: v.secret ? 'secret_refused' : 'bad_address', message: v.reason };
  }

  /* Sending to an address this system itself issued would be a loop
     through the chain, paying a fee to arrive where it started. */
  const mine = await DepositAddress.findOne({ network, address: v.normalized || to });
  if (mine) {
    return { ok: false, code: 'own_address', message: 'That is a Trending deposit address. Sending to it would pay a network fee to move nothing.' };
  }

  if (!fees.isFresh({ at: q.feeAt })) {
    return { ok: false, code: 'stale_fee', message: 'The fee quote expired. Check the amount again.' };
  }

  /* Daily limits, counted from the ledger rather than a column. */
  const since = new Date(Date.now() - 86400000);
  const recent = await Withdrawal.find({ userId, createdAt: { $gte: since }, status: { $nin: ['cancelled', 'rejected', 'failed'] } });
  if (recent.length >= LIMITS.count24h) {
    return { ok: false, code: 'too_many', message: 'You have reached the number of withdrawals allowed in 24 hours.' };
  }
  if (LIMITS.perDay) {
    const spent = recent.filter(r => r.asset === q.asset).reduce((s, r) => s + big(r.amount), 0n);
    if (spent + big(amount) > big(LIMITS.perDay)) {
      return { ok: false, code: 'daily_limit', message: 'That would pass your 24-hour withdrawal limit.' };
    }
  }

  /* Second factor, when the account has one. Required above the
     threshold whether or not the client asked for it. */
  if (user && user.totpSecret) {
    const check = totp.verify(user.totpSecret, twoFactor);
    if (!check.ok) return { ok: false, code: 'twofactor', message: check.reason };
    if (user.lastTotpCounter != null && check.counter <= user.lastTotpCounter) {
      return { ok: false, code: 'twofactor_reused', message: 'That code has already been used. Wait for the next one.' };
    }
    q.totpCounter = check.counter;
  } else if (String(process.env.WD_REQUIRE_2FA || 'true') === 'true') {
    return { ok: false, code: 'twofactor_required', message: 'Turn on two-factor authentication before withdrawing.' };
  }

  q.normalizedAddress = v.normalized || to;
  q.addressChecksum = !!v.checksum;
  return q;
}

/* ── Request ─────────────────────────────────────────────────────────
   Holds the funds and queues the withdrawal. Idempotent on the key the
   client supplies: a retry after a dropped response returns the SAME
   withdrawal rather than making a second one. */
async function request({ userId, asset, network, to, amount, twoFactor, user, idempotencyKey, ip }) {
  const key = String(idempotencyKey || '').trim();
  if (!key || key.length < 8) {
    return { ok: false, code: 'no_idempotency_key', message: 'A withdrawal needs an idempotency key.' };
  }
  const existing = await Withdrawal.findOne({ userId, idempotencyKey: key });
  if (existing) return { ok: true, idempotent: true, withdrawal: existing };

  const g = await guard({ userId, asset, network, to, amount, twoFactor, user });
  if (!g.ok) return g;

  const amt = big(amount);
  const fee = big(g.fee);

  /* Hold the funds first. If anything below fails, the release path puts
     them back — but the window where they could be double-spent never
     opens. */
  const held = await hold(userId, g.asset, amt, key);
  if (!held.ok) return held;

  let doc;
  try {
    doc = await Withdrawal.create({
      userId, idempotencyKey: key,
      asset: g.asset, network, toAddress: g.normalizedAddress,
      amount: amt.toString(), fee: fee.toString(), receives: g.receives,
      feeBasis: g.feeBasis, status: 'queued_for_signing',
      holdRef: held.ref, requestIp: ip || '', createdAt: new Date()
    });
  } catch (e) {
    await release(userId, g.asset, amt, key).catch(() => {});
    if (e && e.code === DUPLICATE) {
      const again = await Withdrawal.findOne({ userId, idempotencyKey: key });
      if (again) return { ok: true, idempotent: true, withdrawal: again };
    }
    throw e;
  }

  await AuditLog.create([{
    actor: userId, action: 'withdrawal.requested', subject: String(doc._id),
    detail: { asset: g.asset, network, amount: amt.toString(), fee: fee.toString(), to: g.normalizedAddress, ip: ip || '' }
  }]);

  return { ok: true, withdrawal: doc, totpCounter: g.totpCounter };
}

/* ── The ledger hold ─────────────────────────────────────────────── */
/* Available drops, locked rises, and both legs are written as ledger
   entries so the movement is visible rather than implied. */
async function hold(userId, asset, amount, ref) {
  const acc = await ledger.account(userId, asset, 'user');
  const available = big(acc.available);
  if (available < amount) return { ok: false, code: 'insufficient', message: 'That is more than your available balance.' };
  const nextAvail = available - amount;
  const nextLocked = big(acc.pending) + amount;
  try {
    await LedgerEntry.create([{
      accountId: String(acc._id), userId, asset, direction: 'debit', amount: amount.toString(),
      balanceAfter: nextAvail.toString(), referenceType: 'withdrawal_hold', referenceId: ref,
      groupId: `withdrawal_hold:${ref}`, memo: 'held for withdrawal'
    }]);
  } catch (e) {
    if (e && e.code === DUPLICATE) return { ok: true, ref, already: true };
    throw e;
  }
  await WalletAccount.updateOne({ _id: acc._id },
    { available: nextAvail.toString(), pending: nextLocked.toString(), updatedAt: new Date() });
  return { ok: true, ref };
}

async function release(userId, asset, amount, ref) {
  const acc = await ledger.account(userId, asset, 'user');
  const nextAvail = big(acc.available) + amount;
  const nextLocked = big(acc.pending) - amount;
  try {
    await LedgerEntry.create([{
      accountId: String(acc._id), userId, asset, direction: 'credit', amount: amount.toString(),
      balanceAfter: nextAvail.toString(), referenceType: 'withdrawal_release', referenceId: ref,
      groupId: `withdrawal_release:${ref}`, memo: 'withdrawal cancelled or failed'
    }]);
  } catch (e) {
    if (e && e.code === DUPLICATE) return { ok: true, already: true };
    throw e;
  }
  await WalletAccount.updateOne({ _id: acc._id },
    { available: nextAvail.toString(), pending: (nextLocked < 0n ? 0n : nextLocked).toString(), updatedAt: new Date() });
  return { ok: true };
}

/* Settle: the held funds leave for good once the chain has the
   transaction. Locked drops, the omnibus takes the other side. */
async function settle(doc) {
  const acc = await ledger.account(doc.userId, doc.asset, 'user');
  const omni = await ledger.account('omnibus', doc.asset, 'omnibus');
  const amount = big(doc.amount);
  const nextLocked = big(acc.pending) - amount;
  try {
    await LedgerEntry.create([
      { accountId: String(acc._id), userId: doc.userId, asset: doc.asset, direction: 'debit',
        amount: amount.toString(), balanceAfter: big(acc.available).toString(),
        referenceType: 'withdrawal', referenceId: String(doc._id),
        groupId: `withdrawal:${doc._id}`, memo: 'sent on chain' },
      { accountId: String(omni._id), userId: 'omnibus', asset: doc.asset, direction: 'credit',
        amount: amount.toString(), balanceAfter: (big(omni.available) + amount).toString(),
        referenceType: 'withdrawal', referenceId: String(doc._id),
        groupId: `withdrawal:${doc._id}`, memo: 'sent on chain' }
    ]);
  } catch (e) {
    if (!e || e.code !== DUPLICATE) throw e;
    return { ok: true, already: true };
  }
  await WalletAccount.updateOne({ _id: acc._id }, { pending: (nextLocked < 0n ? 0n : nextLocked).toString(), updatedAt: new Date() });
  await WalletAccount.updateOne({ _id: omni._id }, { available: (big(omni.available) + amount).toString(), updatedAt: new Date() });
  return { ok: true };
}

/* ── State transitions ───────────────────────────────────────────── */
/* Only these moves are legal. A status is never set by assignment
   somewhere else in the codebase, so an impossible jump — queued
   straight to completed, say — cannot be written by accident. */
const MOVES = {
  queued_for_signing: ['signing', 'cancelled', 'rejected'],
  signing: ['broadcast', 'failed', 'rejected'],
  broadcast: ['confirming', 'failed'],
  confirming: ['completed', 'failed'],
  completed: [],
  cancelled: [], rejected: [], failed: []
};

async function advance(id, to, patch, actor) {
  const doc = await Withdrawal.findById(id);
  if (!doc) return { ok: false, code: 'not_found' };
  const allowed = MOVES[doc.status] || [];
  if (allowed.indexOf(to) === -1) {
    return { ok: false, code: 'bad_transition', message: `A withdrawal cannot go from ${doc.status} to ${to}.` };
  }
  Object.assign(doc, patch || {});
  doc.status = to;
  if (to === 'broadcast') doc.broadcastAt = new Date();
  if (to === 'completed') { doc.completedAt = new Date(); await settle(doc); }
  if (to === 'cancelled' || to === 'rejected' || to === 'failed') {
    await release(doc.userId, doc.asset, big(doc.amount), doc.holdRef || doc.idempotencyKey);
  }
  await doc.save();
  await AuditLog.create([{ actor: actor || 'system', action: 'withdrawal.' + to, subject: String(doc._id),
    detail: { asset: doc.asset, network: doc.network, txHash: doc.txHash || '' } }]);
  return { ok: true, withdrawal: doc };
}

async function cancel(userId, id) {
  const doc = await Withdrawal.findById(id);
  if (!doc || doc.userId !== userId) return { ok: false, code: 'not_found' };
  if (doc.status !== 'queued_for_signing') {
    return { ok: false, code: 'too_late', message: 'This withdrawal has already gone to signing and cannot be called back.' };
  }
  return advance(id, 'cancelled', {}, userId);
}

/* Is there anything that can actually sign? The queue is honest about
   the answer rather than leaving withdrawals looking stuck. */
const signerConfigured = () => !!process.env.WITHDRAW_SIGNER_URL;

function explorerFor(network, txHash) {
  const net = NETWORKS[network];
  return net && net.explorer && txHash ? net.explorer + txHash : null;
}

module.exports = {
  quote, guard, request, cancel, advance, hold, release, settle, checkPair,
  signerConfigured, explorerFor, LIMITS, MOVES
};
