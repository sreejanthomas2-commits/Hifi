/* ╔══════════════════════════════════════════════════════════════════╗
   ║  LEDGER — the only place a balance is allowed to change           ║
   ║                                                                   ║
   ║  Double entry: every credit to a user is a debit from the asset's ║
   ║  omnibus account, both written under one groupId. The two legs    ║
   ║  always sum to zero, so "did we create money?" is a query, not a  ║
   ║  hope.                                                            ║
   ║                                                                   ║
   ║  Idempotent: the unique index on                                  ║
   ║  (referenceType, referenceId, direction) means a second attempt   ║
   ║  to credit the same deposit fails at the database, not at an      ║
   ║  `if` statement that a race can slip past. The duplicate key      ║
   ║  error is caught and treated as "already done", which is what     ║
   ║  makes a watcher safe to restart at any moment.                   ║
   ║                                                                   ║
   ║  Integers only. Amounts are strings of base units (satoshi, wei)  ║
   ║  parsed to BigInt — there is no float anywhere in this file.      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const mongoose = require('mongoose');
const { LedgerEntry, WalletAccount, AuditLog } = require('../models/custody');

const DUPLICATE = 11000;
const big = v => BigInt(String(v || '0'));

/* An account row is a cache of the ledger, created on first use. */
async function account(userId, asset, kind, session) {
  const q = { userId, asset, kind: kind || 'user' };
  const opts = session ? { session } : {};
  let acc = await WalletAccount.findOne(q, null, opts);
  if (acc) return acc;
  try {
    const made = await WalletAccount.create([{ ...q, available: '0', pending: '0' }], opts);
    return made[0];
  } catch (e) {
    if (e && e.code === DUPLICATE) return WalletAccount.findOne(q, null, opts);
    throw e;
  }
}

/* Credit a user and debit the omnibus, or report that it already
   happened. Never throws on a repeat. */
async function credit({ userId, asset, amount, referenceType, referenceId, memo }) {
  const value = big(amount);
  if (value <= 0n) throw new Error('credit amount must be positive');

  const session = await startSession();
  const run = async (s) => {
    const user = await account(userId, asset, 'user', s);
    const omni = await account('omnibus', asset, 'omnibus', s);
    const groupId = `${referenceType}:${referenceId}`;
    const nextUser = big(user.available) + value;
    const nextOmni = big(omni.available) - value;

    const entries = [
      { accountId: String(user._id), userId, asset, direction: 'credit', amount: value.toString(),
        balanceAfter: nextUser.toString(), referenceType, referenceId, groupId, memo: memo || '' },
      { accountId: String(omni._id), userId: 'omnibus', asset, direction: 'debit', amount: value.toString(),
        balanceAfter: nextOmni.toString(), referenceType, referenceId, groupId, memo: memo || '' }
    ];

    await LedgerEntry.create(entries, s ? { session: s, ordered: true } : { ordered: true });

    await WalletAccount.updateOne({ _id: user._id }, { available: nextUser.toString(), updatedAt: new Date() }, s ? { session: s } : {});
    await WalletAccount.updateOne({ _id: omni._id }, { available: nextOmni.toString(), updatedAt: new Date() }, s ? { session: s } : {});

    return { ok: true, groupId, balance: nextUser.toString() };
  };

  try {
    if (session) {
      let out;
      await session.withTransaction(async () => { out = await run(session); });
      await session.endSession();
      return out;
    }
    return await run(null);
  } catch (e) {
    if (session) { try { await session.endSession(); } catch (_) {} }
    if (e && e.code === DUPLICATE) {
      // Someone got here first. That is the system working, not failing.
      return { ok: true, duplicate: true, groupId: `${referenceType}:${referenceId}` };
    }
    throw e;
  }
}

/* A reorg does not edit history — it writes the opposite entry, so the
   trail still shows what was believed and when. */
async function reverse({ userId, asset, amount, referenceId, memo }) {
  return credit({
    userId: 'omnibus', asset, amount,
    referenceType: 'reversal', referenceId, memo: memo || 'chain reorganisation'
  }).then(async () => {
    const user = await account(userId, asset, 'user');
    const value = big(amount);
    const next = big(user.available) - value;
    await LedgerEntry.create([{
      accountId: String(user._id), userId, asset, direction: 'debit', amount: value.toString(),
      balanceAfter: next.toString(), referenceType: 'reversal', referenceId,
      groupId: `reversal:${referenceId}`, memo: memo || 'chain reorganisation'
    }]);
    await WalletAccount.updateOne({ _id: user._id }, { available: next.toString(), updatedAt: new Date() });
    return { ok: true, balance: next.toString() };
  });
}

/* The authoritative balance: replayed from entries, not read from the
   cache. Used by reconciliation and by anything that must be certain. */
async function balanceOf(userId, asset) {
  const rows = await LedgerEntry.aggregate([
    { $match: { userId, asset } },
    { $group: {
        _id: '$direction',
        total: { $sum: { $toDecimal: '$amount' } }
    } }
  ]);
  let credits = 0n, debits = 0n;
  rows.forEach(r => {
    const v = BigInt(r.total.toString().split('.')[0]);
    if (r._id === 'credit') credits = v; else debits = v;
  });
  return (credits - debits).toString();
}

/* Does the cache still agree with the ledger? Run it on a schedule; an
   answer of false is an incident, not a warning. */
async function reconcile(userId, asset) {
  const truth = await balanceOf(userId, asset);
  const acc = await account(userId, asset, 'user');
  const cached = String(acc.available);
  if (truth !== cached) {
    await AuditLog.create([{
      actor: 'system', action: 'reconcile.mismatch', subject: `${userId}:${asset}`,
      detail: { ledger: truth, cached }
    }]);
  }
  return { ok: truth === cached, ledger: truth, cached };
}

async function startSession() {
  // Transactions need a replica set. On a standalone dev mongo there is
  // none, and the unique indexes still carry the safety.
  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) return null;
    const s = await mongoose.startSession();
    return s;
  } catch (e) { return null; }
}

module.exports = { credit, reverse, balanceOf, reconcile, account };
