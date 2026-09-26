/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SANDBOX LEDGER — practice money, kept by the server              ║
   ║                                                                   ║
   ║  Practice balances used to live in the browser, where anyone      ║
   ║  could edit them. Here they are kept the way real money should    ║
   ║  be, so the practice product behaves exactly like the real one    ║
   ║  will:                                                            ║
   ║                                                                   ║
   ║  · Double entry. Every movement is a debit and a credit in one    ║
   ║    group; the book sums to zero, so "was money created?" is a     ║
   ║    query (reconcile), not a hope.                                 ║
   ║  · No double spend. The debit is a conditional update - "take     ║
   ║    this much only if at least this much is there" - so however    ║
   ║    many requests arrive at once, the balance cannot go below      ║
   ║    zero. Both legs and both entries are one transaction: all of   ║
   ║    it lands or none of it does.                                   ║
   ║  · Once only. (refType, refId) names a movement. Asking for the   ║
   ║    same one twice returns the first, never a second.              ║
   ║  · Exact. Whole units (1e-8 of an asset) as BigInt and Decimal128;║
   ║    no floating point anywhere in this file.                       ║
   ║                                                                   ║
   ║  It needs a replica set for transactions (Atlas is one). Without  ║
   ║  one it refuses to move anything rather than move it unsafely.    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const mongoose = require('mongoose');
const { SandboxAccount, SandboxEntry } = require('../models/sandbox');

const D128 = mongoose.Types.Decimal128;
const SCALE = 8;
const ONE = 10n ** BigInt(SCALE);
const MAX = 10n ** 12n * ONE;               // a trillion of anything is a bug
const DUPLICATE = 11000;
const MINT = { userId: 'system:mint', bucket: 'mint' };
const GRANT = { USDT: '10000' };            // what a new practice account starts with

class LedgerError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}
const fail = (code, msg) => { throw new LedgerError(code, msg); };

/* "12.5" -> 1250000000n. Refuses anything that is not a plain positive
   decimal with at most 8 places - no exponents, no signs, no spaces. */
function toUnits(v) {
  const s = typeof v === 'bigint' ? v.toString() : String(v == null ? '' : v).trim();
  if (!/^\d{1,13}(\.\d{1,8})?$/.test(s)) fail('bad_amount');
  const [whole, frac = ''] = s.split('.');
  const u = BigInt(whole) * ONE + BigInt((frac + '00000000').slice(0, SCALE));
  if (u <= 0n || u > MAX) fail('bad_amount');
  return u;
}
function fromUnits(u) {
  const n = BigInt(u);
  const neg = n < 0n, a = neg ? -n : n;
  const frac = (a % ONE).toString().padStart(SCALE, '0').replace(/0+$/, '');
  return (neg ? '-' : '') + (a / ONE).toString() + (frac ? '.' + frac : '');
}
const d = u => D128.fromString(BigInt(u).toString());
const big = v => BigInt(String(v == null ? '0' : v).split('.')[0]);

const ASSET = /^[A-Z0-9]{2,10}$/;
const BUCKETS = new Set(['available', 'locked']);
const REF = /^[A-Za-z0-9:_-]{1,120}$/;

/* Checked before any read as well as any write: with no connection,
   Mongoose would otherwise queue the query and fail ten seconds later
   with an error that says nothing useful. */
const ready = () => { if (!mongoose.connection || mongoose.connection.readyState !== 1) fail('database_unavailable'); };

/* Run fn(session) in a transaction, retried by the driver on transient
   conflicts. No replica set, no transaction: refuse. */
async function tx(fn) {
  ready();
  const session = await mongoose.startSession();
  try {
    let out;
    await session.withTransaction(async () => { out = await fn(session); });
    return out;
  } catch (e) {
    if (e && (e.code === 20 || /replica set|Transaction numbers/i.test(e.message || ''))) fail('transactions_unavailable');
    throw e;
  } finally {
    await session.endSession();
  }
}

/* The one primitive. Moves `amount` of `asset` from one (user, bucket)
   to another, as one group named by (refType, refId). */
async function move({ asset, amount, from, to, refType, refId, memo }) {
  if (!ASSET.test(String(asset || ''))) fail('bad_request', 'asset');
  if (!REF.test(String(refType || '')) || !REF.test(String(refId || ''))) fail('bad_request', 'reference');
  const units = toUnits(amount);
  const sys = a => a && a.userId === MINT.userId && a.bucket === MINT.bucket;
  const okSide = a => a && (sys(a) || (typeof a.userId === 'string' && a.userId && !a.userId.startsWith('system:') && BUCKETS.has(a.bucket)));
  if (!okSide(from) || !okSide(to)) fail('bad_request', 'account');
  if (from.userId === to.userId && from.bucket === to.bucket) fail('bad_request', 'same account');
  const groupId = `${refType}:${refId}`;
  ready();

  // Already done? Say so without touching anything.
  const prior = await SandboxEntry.findOne({ groupId, leg: 1 }).lean();
  if (prior) return { ok: true, duplicate: true, groupId };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await tx(async session => {
        const now = new Date();
        const debitQ = { userId: from.userId, asset, bucket: from.bucket };
        if (!sys(from)) debitQ.balance = { $gte: d(units) };
        const debited = await SandboxAccount.findOneAndUpdate(debitQ,
          { $inc: { balance: d(-units) }, $set: { updatedAt: now } },
          { session, new: true, upsert: sys(from) });
        if (!debited) fail('insufficient_funds');
        const credited = await SandboxAccount.findOneAndUpdate(
          { userId: to.userId, asset, bucket: to.bucket },
          { $inc: { balance: d(units) }, $set: { updatedAt: now } },
          { session, new: true, upsert: true });
        const entry = (leg, side, direction, after) => ({
          groupId, leg, userId: side.userId, bucket: side.bucket, asset, direction,
          amount: d(units), balanceAfter: after, refType, refId, memo: String(memo || '').slice(0, 200), at: now
        });
        await SandboxEntry.create([
          entry(0, from, 'debit', debited.balance),
          entry(1, to, 'credit', credited.balance)
        ], { session, ordered: true });
        return {
          ok: true, groupId, amount: fromUnits(units),
          fromBalance: fromUnits(big(debited.balance.toString())),
          toBalance: fromUnits(big(credited.balance.toString()))
        };
      });
    } catch (e) {
      if (e instanceof LedgerError) throw e;
      if (e && e.code === DUPLICATE) {
        // The movement itself already exists: that is the retry case.
        if (e.keyPattern && e.keyPattern.groupId) return { ok: true, duplicate: true, groupId };
        // Two first-ever credits to one new account raced; go again.
        continue;
      }
      throw e;
    }
  }
  fail('server_error', 'could not settle after retries');
}

/* A person's starting practice balance, once. */
async function grant(userId) {
  const out = [];
  for (const [asset, amount] of Object.entries(GRANT)) {
    out.push(await move({ asset, amount, from: MINT, to: { userId, bucket: 'available' },
      refType: 'grant', refId: `${userId}:${asset}`, memo: 'Starting practice balance' }));
  }
  return out;
}

const transfer = ({ fromUser, toUser, asset, amount, ref, memo }) =>
  move({ asset, amount, from: { userId: fromUser, bucket: 'available' }, to: { userId: toUser, bucket: 'available' },
    refType: 'transfer', refId: ref, memo });

// Set money aside for an order or escrow; give it back; or pay it out.
const hold = ({ userId, asset, amount, ref }) =>
  move({ asset, amount, from: { userId, bucket: 'available' }, to: { userId, bucket: 'locked' }, refType: 'hold', refId: ref });
const release = ({ userId, asset, amount, ref }) =>
  move({ asset, amount, from: { userId, bucket: 'locked' }, to: { userId, bucket: 'available' }, refType: 'release', refId: ref });
const settle = ({ fromUser, toUser, asset, amount, ref }) =>
  move({ asset, amount, from: { userId: fromUser, bucket: 'locked' }, to: { userId: toUser, bucket: 'available' }, refType: 'settle', refId: ref });

async function balances(userId) {
  ready();
  const rows = await SandboxAccount.find({ userId }).lean();
  const out = {};
  rows.forEach(r => {
    const a = out[r.asset] || (out[r.asset] = { available: '0', locked: '0' });
    a[r.bucket] = fromUnits(big(r.balance.toString()));
  });
  return out;
}

async function history(userId, limit) {
  ready();
  const rows = await SandboxEntry.find({ userId }).sort({ at: -1 }).limit(Math.min(Number(limit) || 50, 200)).lean();
  return rows.map(r => ({ groupId: r.groupId, asset: r.asset, bucket: r.bucket, direction: r.direction,
    amount: fromUnits(big(r.amount.toString())), balanceAfter: fromUnits(big(r.balanceAfter.toString())),
    refType: r.refType, refId: r.refId, memo: r.memo, at: r.at }));
}

/* Does the book add up? Every account's balance must equal its entries,
   every group must net to zero, and each asset's accounts must sum to
   zero across the whole book. Any line in `problems` is an incident. */
async function reconcile() {
  ready();
  const problems = [];
  const accounts = await SandboxAccount.find({}).lean();
  const sums = await SandboxEntry.aggregate([
    { $group: { _id: { userId: '$userId', asset: '$asset', bucket: '$bucket' },
      credit: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0] } },
      debit: { $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$amount', 0] } } } }
  ]);
  const byKey = new Map(sums.map(s => [`${s._id.userId}|${s._id.asset}|${s._id.bucket}`, big(s.credit.toString()) - big(s.debit.toString())]));
  const perAsset = new Map();
  accounts.forEach(a => {
    const bal = big(a.balance.toString());
    const fromEntries = byKey.get(`${a.userId}|${a.asset}|${a.bucket}`) || 0n;
    if (bal !== fromEntries) problems.push(`${a.userId} ${a.asset} ${a.bucket}: balance ${fromUnits(bal)} but entries say ${fromUnits(fromEntries)}`);
    if (a.bucket !== 'mint' && bal < 0n) problems.push(`${a.userId} ${a.asset} ${a.bucket}: below zero`);
    perAsset.set(a.asset, (perAsset.get(a.asset) || 0n) + bal);
  });
  perAsset.forEach((sum, asset) => { if (sum !== 0n) problems.push(`${asset}: book sums to ${fromUnits(sum)}, not zero`); });
  const groups = await SandboxEntry.aggregate([{ $group: { _id: '$groupId', n: { $sum: 1 } } }, { $match: { n: { $ne: 2 } } }]);
  groups.forEach(g => problems.push(`${g._id}: ${g.n} entries, not 2`));
  return { ok: problems.length === 0, problems, accounts: accounts.length };
}

module.exports = { move, grant, transfer, hold, release, settle, balances, history, reconcile,
  toUnits, fromUnits, LedgerError, MINT, GRANT, SCALE };
