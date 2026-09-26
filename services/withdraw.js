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
const { NETWORKS, ASSETS, NATIVE_ASSET } = require('../config/crypto-deposit');
const address = require('../lib/address');
const twofactor = require('./twofactor');
const fees = require('./fees');
const ledger = require('./ledger');

const DUPLICATE = 11000;
const big = v => BigInt(String(v == null ? '0' : v));

/* Limits are policy, set by the operator, not guessed by the code. The
   cool-off after setting up two-factor (WD_COOLOFF_MS) is enforced in
   services/twofactor.js; it used to be read here and never used. */
const LIMITS = {
  perRequest: process.env.WD_MAX_PER_REQUEST || '',
  perDay: process.env.WD_MAX_PER_DAY || '',
  count24h: Number(process.env.WD_MAX_COUNT_24H || 20)
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
  /* Only the network's own coin, for now. A token withdrawal has to be
     sent to the token's contract with the amount in calldata, and the
     signer queue has never carried a contract - so a DAI withdrawal of
     100×10¹⁸ base units reached the signer as a plain transfer of 100
     ETH, labelled DAI. Until contracts come from the allow-list and the
     queue carries them, tokens are refused here and again by the signer. */
  const native = NATIVE_ASSET[network];
  if (a.symbol !== native) {
    return {
      ok: false, code: 'token_withdrawals_unsupported',
      message: `Withdrawing ${a.symbol} is not supported yet. Over ${net.label}, only ${native || 'the network’s own coin'} can be withdrawn for now.`
    };
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
async function guard({ userId, asset, network, to, amount, twoFactor }) {
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

  /* Second factor, looked up by the session's own user id - never from
     anything the client sends. Last, so a code is not spent on a request
     that was going to fail anyway. In production it cannot be switched
     off: WD_REQUIRE_2FA=false is honoured only outside production, and
     the chance to "make withdrawals work" by turning the factor off is
     exactly the mistake worth making impossible. */
  const need2fa = process.env.NODE_ENV === 'production' || String(process.env.WD_REQUIRE_2FA || 'true') === 'true';
  if (need2fa) {
    const tf = await twofactor.check(userId, twoFactor);
    if (!tf.ok) return tf;
    q.totpCounter = tf.counter;
  }

  q.normalizedAddress = v.normalized || to;
  q.addressChecksum = !!v.checksum;
  return q;
}

/* ── Request ─────────────────────────────────────────────────────────
   Holds the funds and queues the withdrawal. Idempotent on the key the
   client supplies: a retry after a dropped response returns the SAME
   withdrawal rather than making a second one. */
async function request({ userId, asset, network, to, amount, twoFactor, idempotencyKey, ip }) {
  const key = String(idempotencyKey || '').trim();
  if (!key || key.length < 8 || key.length > 128) {
    return { ok: false, code: 'no_idempotency_key', message: 'A withdrawal needs an idempotency key.' };
  }
  const existing = await Withdrawal.findOne({ userId, idempotencyKey: key });
  if (existing) return { ok: true, idempotent: true, withdrawal: existing };

  const g = await guard({ userId, asset, network, to, amount, twoFactor });
  if (!g.ok) return g;

  const amt = big(amount);
  const fee = big(g.fee);

  /* Hold the funds first, under a reference made here. It used to be the
     client's idempotency key - but that key is the client's to choose,
     and the ledger's unique index spans every user, so reusing a key some
     other account had already held under made this hold "already done":
     a withdrawal queued with nothing held behind it. */
  const ref = 'wh_' + crypto.randomUUID();
  const held = await hold(userId, g.asset, amt, ref);
  if (!held.ok) return held;

  let doc;
  try {
    doc = await Withdrawal.create({
      userId, idempotencyKey: key,
      asset: g.asset, network, toAddress: g.normalizedAddress,
      amount: amt.toString(), fee: fee.toString(), receives: g.receives,
      feeBasis: g.feeBasis, status: 'queued_for_signing',
      holdRef: ref, requestIp: ip || '', createdAt: new Date()
    });
  } catch (e) {
    /* This request's own hold goes back, whatever went wrong. When the
       cause is a twin request with the same key that got there first,
       the twin holds its own funds under its own reference, so nothing
       of the twin's is touched here. */
    await release(userId, g.asset, amt, ref).catch(() => {});
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
/* Money on its way out moves from the user's spendable account to their
   'hold' account - a debit and a credit under one group, like every
   other movement in the ledger - and from there either back (release)
   or out to the omnibus (settle). Each step is one balanced pair, so a
   completed withdrawal leaves the user's balance lower by its amount
   exactly once. The old version debited once to hold and again to
   settle, and the ledger balance fell by twice what was sent. */
const legs = (from, to, { userId, asset, amount, type, ref, memo, fromOwner, toOwner }) => [
  { accountId: String(from._id), userId: fromOwner || userId, asset, direction: 'debit', amount: amount.toString(),
    balanceAfter: '0', referenceType: type, referenceId: ref, groupId: `${type}:${ref}`, memo },
  { accountId: String(to._id), userId: toOwner || userId, asset, direction: 'credit', amount: amount.toString(),
    balanceAfter: '0', referenceType: type, referenceId: ref, groupId: `${type}:${ref}`, memo }
];
/* balanceAfter is written as 0 and left there: under concurrent writes a
   running balance stamped on an entry is only what one request saw, and
   a figure that is sometimes wrong is worse than none. Balances come from
   summing entries (ledger.balanceOf). */

async function hold(userId, asset, amount, ref) {
  if (amount <= 0n) return { ok: false, code: 'amount_zero', message: 'Enter an amount.' };
  const user = await ledger.account(userId, asset, 'user');
  const held = await ledger.account(userId, asset, 'hold');
  await LedgerEntry.create(legs(user, held, { userId, asset, amount, type: 'withdrawal_hold', ref, memo: 'held for withdrawal' }), { ordered: true });

  /* Checked AFTER writing, against the ledger - not before, against the
     cache. Two holds racing on one balance both used to read it, both
     see enough, and both go through. Now each checks once its own debit
     is in: whichever checks second sees both debits, so at most one of
     them can pass. (Both may be turned away if they check at the same
     instant; that is the safe way to be wrong.) */
  const after = big(await ledger.balanceOf(userId, asset, 'user'));
  if (after < 0n) {
    await LedgerEntry.create(legs(held, user, { userId, asset, amount, type: 'withdrawal_hold_void', ref, memo: 'hold undone: not enough balance' }), { ordered: true });
    await ledger.refresh(userId, asset);
    return { ok: false, code: 'insufficient', message: 'That is more than your available balance.' };
  }
  await ledger.refresh(userId, asset);
  return { ok: true, ref };
}

/* Held funds back to spendable. Idempotent on the reference: the unique
   index refuses a second release of the same hold. */
async function release(userId, asset, amount, ref) {
  const user = await ledger.account(userId, asset, 'user');
  const held = await ledger.account(userId, asset, 'hold');
  try {
    await LedgerEntry.create(legs(held, user, { userId, asset, amount, type: 'withdrawal_release', ref, memo: 'withdrawal cancelled or failed' }), { ordered: true });
  } catch (e) {
    if (e && e.code === DUPLICATE) return { ok: true, already: true };
    throw e;
  }
  await ledger.refresh(userId, asset);
  return { ok: true };
}

/* Settle: the held funds leave for good once the chain has the
   transaction. Hold account to omnibus - the spendable balance was
   already reduced when the funds were held, and is not touched again. */
async function settle(doc) {
  const held = await ledger.account(doc.userId, doc.asset, 'hold');
  const omni = await ledger.account('omnibus', doc.asset, 'omnibus');
  try {
    await LedgerEntry.create(legs(held, omni, {
      userId: doc.userId, toOwner: 'omnibus', asset: doc.asset, amount: big(doc.amount),
      type: 'withdrawal', ref: String(doc._id), memo: 'sent on chain'
    }), { ordered: true });
  } catch (e) {
    if (!e || e.code !== DUPLICATE) throw e;
    return { ok: true, already: true };
  }
  await ledger.refresh(doc.userId, doc.asset);
  await WalletAccount.updateOne({ _id: omni._id },
    { available: await ledger.balanceOf('omnibus', doc.asset, 'omnibus'), updatedAt: new Date() });
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

/* Fields a transition may carry, and nothing else - status, amounts,
   owner and destination are never writable through here. */
const PATCHABLE = { txHash: 1, failureReason: 1, confirmations: 1 };

async function advance(id, to, patch, actor) {
  const doc = await Withdrawal.findById(id);
  if (!doc) return { ok: false, code: 'not_found' };
  const allowed = MOVES[doc.status] || [];
  if (allowed.indexOf(to) === -1) {
    return { ok: false, code: 'bad_transition', message: `A withdrawal cannot go from ${doc.status} to ${to}.` };
  }
  const set = { status: to };
  Object.keys(patch || {}).forEach(k => { if (PATCHABLE[k]) set[k] = patch[k]; });
  if (to === 'broadcast') set.broadcastAt = new Date();
  if (to === 'completed') set.completedAt = new Date();

  /* Conditional on the status just read. This used to read, check, and
     save - so a user cancelling while the signer claimed the same row
     could both win: the cancel released the funds and the signer sent
     them anyway. Now only one move lands; the other finds the status
     changed, changes nothing, and moves no money. */
  const moved = await Withdrawal.findOneAndUpdate({ _id: doc._id, status: doc.status }, { $set: set }, { new: true });
  if (!moved) {
    return { ok: false, code: 'conflict', message: 'This withdrawal changed while that was happening. Look at it again.' };
  }
  // Money follows the state, only after the state change has landed.
  if (to === 'completed') await settle(moved);
  if (to === 'cancelled' || to === 'rejected' || to === 'failed') {
    await release(moved.userId, moved.asset, big(moved.amount), moved.holdRef || moved.idempotencyKey);
  }
  await AuditLog.create([{ actor: actor || 'system', action: 'withdrawal.' + to, subject: String(moved._id),
    detail: { asset: moved.asset, network: moved.network, txHash: moved.txHash || '' } }]);
  return { ok: true, withdrawal: moved };
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
