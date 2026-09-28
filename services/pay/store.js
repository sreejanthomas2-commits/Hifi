/* ╔══════════════════════════════════════════════════════════════════╗
   ║  PAY STORE — where Trending Pay's book is kept                    ║
   ║                                                                   ║
   ║  One interface, two places:                                       ║
   ║                                                                   ║
   ║    MongoStore  when MONGO_URI is set. Every change is a MongoDB   ║
   ║                transaction (Atlas is a replica set, so it can).   ║
   ║    FileStore   otherwise, outside production: the whole book in   ║
   ║                one file on this server, rewritten atomically      ║
   ║                (write a temporary file, flush it, rename it over  ║
   ║                the old one) after every change. One server        ║
   ║                process only.                                      ║
   ║                                                                   ║
   ║  In production with no MONGO_URI, open() returns null and Pay     ║
   ║  answers 503: a production book never lives in a file. And with   ║
   ║  MONGO_URI set, Pay never falls back to the file - two books      ║
   ║  would each be half the truth.                                    ║
   ║                                                                   ║
   ║  A change is a function run inside tx(). Everything it does lands ║
   ║  together or not at all: FileStore works on a copy and swaps it   ║
   ║  in only if the function finishes; MongoStore uses a session.     ║
   ║  Changes run one at a time in the file store, so the "check the   ║
   ║  balance, then take it" in move() can't interleave with another.  ║
   ║                                                                   ║
   ║  Money is whole units (1e-8 of an asset) as BigInt, stored as a   ║
   ║  decimal string in the file and Decimal128 in MongoDB. Every      ║
   ║  movement is two entries - a debit and a credit - named by one    ║
   ║  reference, and a reference moves money once.                     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const fs = require('fs');
const path = require('path');

const DUP = 11000;
class PayError extends Error {
  constructor(code, message, extra) { super(message || code); this.code = code; Object.assign(this, extra || {}); }
}
const fail = (code, message, extra) => { throw new PayError(code, message, extra); };

/* Unique keys, the same in both stores. A key only counts when all its
   fields are present, so a profile without a handle clashes with none. */
const UNIQUE = {
  profiles: [['payId'], ['handle']],
  idem: [['userId', 'scope', 'key']],
  entries: [['groupId', 'leg']]
};
const COLLECTIONS = ['profiles', 'quotes', 'transfers', 'requests', 'recipients', 'idem', 'operations', 'events', 'meta', 'sandbox_payouts'];

/* Accounts money can sit in. A person has "available" and "locked"
   (held for a payment in flight). Trending's own accounts are named
   system:…; only the mint may go below zero - it is where practice
   money comes from, so the book still sums to zero. */
const MINT = { userId: 'system:mint', bucket: 'mint' };
const SYSTEM = new Set(['system:mint', 'system:fees', 'system:payouts']);
const BUCKETS = new Set(['available', 'locked']);
const isMint = a => a.userId === MINT.userId && a.bucket === MINT.bucket;
function checkSide(a) {
  if (!a || typeof a.userId !== 'string' || !a.userId) fail('bad_request', 'account');
  if (isMint(a)) return;
  if (a.userId.startsWith('system:') && !SYSTEM.has(a.userId)) fail('bad_request', 'account');
  if (!BUCKETS.has(a.bucket)) fail('bad_request', 'bucket');
}
const REF = /^[A-Za-z0-9:_.-]{1,160}$/;
const ASSET = /^[A-Z0-9]{2,10}$/;
const acctKey = (userId, asset, bucket) => `${userId}|${asset}|${bucket}`;

const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
const get = (doc, k) => k.split('.').reduce((o, p) => (o == null ? undefined : o[p]), doc);

/* The filter language both stores understand: equality, $in, $ne, $gt,
   $gte, $lt, $lte, and a top-level $or. MongoDB reads it natively. */
function matches(doc, filter) {
  for (const [k, v] of Object.entries(filter || {})) {
    if (k === '$or') { if (!v.some(f => matches(doc, f))) return false; continue; }
    const dv = get(doc, k);
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [op, x] of Object.entries(v)) {
        if (op === '$in' && !x.includes(dv)) return false;
        if (op === '$ne' && dv === x) return false;
        if (op === '$gt' && !(dv > x)) return false;
        if (op === '$gte' && !(dv >= x)) return false;
        if (op === '$lt' && !(dv < x)) return false;
        if (op === '$lte' && !(dv <= x)) return false;
      }
      continue;
    }
    if (dv !== v) return false;
  }
  return true;
}
function sortRows(rows, sort) {
  if (!sort) return rows;
  const [[k, dir]] = Object.entries(sort);
  return rows.sort((a, b) => { const x = get(a, k), y = get(b, k); return x === y ? 0 : (x > y ? dir : -dir); });
}

/* ══ FileStore ═══════════════════════════════════════════════════════ */
class FileStore {
  constructor(opts) {
    this.kind = 'file';
    this.file = opts.file;
    this.chain = Promise.resolve();
    this.state = this.load();
  }

  blank() {
    const s = { v: 1, colls: {}, accounts: {}, entries: [], groups: {} };
    COLLECTIONS.forEach(c => { s.colls[c] = {}; });
    return s;
  }

  load() {
    if (!this.file || !fs.existsSync(this.file)) return this.blank();
    const raw = fs.readFileSync(this.file, 'utf8');
    const s = JSON.parse(raw);                    // a damaged book stops the server, loudly
    if (!s || s.v !== 1 || !s.colls) throw new Error('pay store: unrecognised file ' + this.file);
    COLLECTIONS.forEach(c => { s.colls[c] = s.colls[c] || {}; });
    return s;
  }

  persist(s) {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    const fd = fs.openSync(tmp, 'w');
    try { fs.writeSync(fd, JSON.stringify(s)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, this.file);
  }

  async init() { return this; }

  /* One change at a time, on a copy that replaces the book only if the
     change finishes and the file is written. */
  tx(fn) {
    const run = async () => {
      const work = clone(this.state);
      const out = await fn(this.unit(work));
      this.persist(work);
      this.state = work;
      return out;
    };
    const p = this.chain.then(run, run);
    this.chain = p.then(() => {}, () => {});
    return p;
  }

  /* Reads see the last committed book, never half a change. */
  read(fn) { return Promise.resolve(fn(this.unit(this.state, true))); }

  unit(s, readOnly) {
    const coll = name => { if (!s.colls[name]) fail('bad_request', 'collection ' + name); return s.colls[name]; };
    const ro = () => { if (readOnly) fail('server_error', 'write outside a transaction'); };
    const clash = (name, doc) => {
      (UNIQUE[name] || []).forEach(fields => {
        if (fields.some(f => get(doc, f) == null)) return;
        const hit = Object.values(coll(name)).find(d => d._id !== doc._id && fields.every(f => get(d, f) === get(doc, f)));
        if (hit) { const e = new Error(`duplicate key in ${name}: ${fields.join(',')}`); e.code = DUP; e.keyPattern = Object.fromEntries(fields.map(f => [f, 1])); throw e; }
      });
    };
    const api = {
      async get(name, id) { return clone(coll(name)[id] || null); },
      async findOne(name, filter) { return clone(Object.values(coll(name)).find(d => matches(d, filter)) || null); },
      async find(name, filter, o) {
        const rows = sortRows(Object.values(coll(name)).filter(d => matches(d, filter)), o && o.sort);
        return clone(o && o.limit ? rows.slice(0, o.limit) : rows);
      },
      async insert(name, doc) {
        ro();
        if (!doc || typeof doc._id !== 'string') fail('bad_request', 'id');
        if (coll(name)[doc._id]) { const e = new Error(`duplicate key in ${name}: _id`); e.code = DUP; e.keyPattern = { _id: 1 }; throw e; }
        clash(name, doc);
        coll(name)[doc._id] = clone(doc);
        return clone(doc);
      },
      /* Change fields only if `expect` still holds - "mark this quote used,
         if it is still open" - and say whether it did. */
      async update(name, id, set, expect) {
        ro();
        const cur = coll(name)[id];
        if (!cur || !matches(cur, expect || {})) return null;
        const next = { ...cur, ...clone(set) };
        clash(name, next);
        coll(name)[id] = next;
        return clone(next);
      },
      async remove(name, id) { ro(); delete coll(name)[id]; },
      async balance(userId, asset, bucket) { return BigInt(s.accounts[acctKey(userId, asset, bucket)] || '0'); },
      async balances(userId) {
        const out = {};
        Object.entries(s.accounts).forEach(([k, v]) => {
          const [u, asset, bucket] = k.split('|');
          if (u !== userId) return;
          (out[asset] = out[asset] || { available: 0n, locked: 0n })[bucket] = BigInt(v);
        });
        return out;
      },
      async move(o) {
        ro();
        const { asset, units, from, to, refType, refId, memo, at } = o;
        if (!ASSET.test(String(asset))) fail('bad_request', 'asset');
        if (typeof units !== 'bigint' || units <= 0n) fail('bad_amount');
        if (!REF.test(String(refType)) || !REF.test(String(refId))) fail('bad_request', 'reference');
        checkSide(from); checkSide(to);
        if (from.userId === to.userId && from.bucket === to.bucket) fail('bad_request', 'same account');
        const groupId = `${refType}:${refId}`;
        if (s.groups[groupId]) return { ok: true, duplicate: true, groupId };
        const fk = acctKey(from.userId, asset, from.bucket), tk = acctKey(to.userId, asset, to.bucket);
        const have = BigInt(s.accounts[fk] || '0');
        if (!isMint(from) && have < units) fail('insufficient_funds');
        const fromAfter = have - units, toAfter = BigInt(s.accounts[tk] || '0') + units;
        s.accounts[fk] = fromAfter.toString();
        s.accounts[tk] = toAfter.toString();
        const when = at || Date.now();
        s.entries.push(
          { groupId, leg: 0, userId: from.userId, bucket: from.bucket, asset, direction: 'debit', amount: units.toString(), balanceAfter: fromAfter.toString(), refType, refId, memo: String(memo || '').slice(0, 200), at: when },
          { groupId, leg: 1, userId: to.userId, bucket: to.bucket, asset, direction: 'credit', amount: units.toString(), balanceAfter: toAfter.toString(), refType, refId, memo: String(memo || '').slice(0, 200), at: when });
        s.groups[groupId] = true;
        return { ok: true, groupId };
      },
      /* Does the book add up? Each account equals its entries, each group
         is exactly one debit and one credit, and each asset sums to zero. */
      async reconcile() {
        const problems = [];
        const byAcct = new Map(), perGroup = new Map();
        s.entries.forEach(e => {
          const k = acctKey(e.userId, e.asset, e.bucket);
          const v = BigInt(e.amount) * (e.direction === 'credit' ? 1n : -1n);
          byAcct.set(k, (byAcct.get(k) || 0n) + v);
          perGroup.set(e.groupId, (perGroup.get(e.groupId) || []).concat(e));
        });
        const perAsset = new Map();
        Object.entries(s.accounts).forEach(([k, v]) => {
          const bal = BigInt(v), [u, asset, bucket] = k.split('|');
          if (bal !== (byAcct.get(k) || 0n)) problems.push(`${k}: balance ${bal} but entries say ${byAcct.get(k) || 0n}`);
          if (bucket !== 'mint' && bal < 0n) problems.push(`${k}: below zero`);
          if (u) perAsset.set(asset, (perAsset.get(asset) || 0n) + bal);
        });
        perAsset.forEach((sum, asset) => { if (sum !== 0n) problems.push(`${asset}: book sums to ${sum}, not zero`); });
        perGroup.forEach((es, g) => {
          if (es.length !== 2 || es[0].amount !== es[1].amount || es[0].direction === es[1].direction) problems.push(`${g}: not one debit and one credit`);
        });
        return { ok: problems.length === 0, problems, accounts: Object.keys(s.accounts).length, entries: s.entries.length };
      },
      async entries(userId, limit) {
        return clone(s.entries.filter(e => e.userId === userId).sort((a, b) => b.at - a.at).slice(0, limit || 50));
      }
    };
    return api;
  }
}

/* ══ MongoStore ══════════════════════════════════════════════════════ */
/* The same interface over MongoDB, for Atlas. Collections are named
   pay_<name>; accounts are pay_accounts keyed "user|asset|bucket" with
   the balance as Decimal128, and a conditional debit - "take it only if
   at least this much is there" - inside the change's transaction. */
class MongoStore {
  constructor(conn) {
    this.kind = 'mongo';
    this.conn = conn;
    this.inited = null;
  }
  db() {
    if (!this.conn || this.conn.readyState !== 1) fail('database_unavailable');
    return this.conn.db;
  }
  init() {
    if (this.inited) return this.inited;
    this.inited = (async () => {
      const db = this.db();
      for (const [name, keys] of Object.entries(UNIQUE)) {
        for (const fields of keys) {
          const spec = Object.fromEntries(fields.map(f => [f, 1]));
          const partial = Object.fromEntries(fields.map(f => [f, { $exists: true, $type: ['string', 'number'] }]));
          await db.collection('pay_' + name).createIndex(spec, { unique: true, partialFilterExpression: partial });
        }
      }
      await db.collection('pay_entries').createIndex({ userId: 1, at: -1 });
      await db.collection('pay_transfers').createIndex({ payer: 1, createdAt: -1 });
      await db.collection('pay_transfers').createIndex({ 'recipient.uid': 1, createdAt: -1 });
    })().catch(e => { this.inited = null; throw e; });
    return this.inited;
  }
  async tx(fn) {
    await this.init();
    const session = this.conn.getClient().startSession();
    try {
      let out;
      await session.withTransaction(async () => { out = await fn(this.unit(session)); });
      return out;
    } catch (e) {
      if (e && (e.code === 20 || /replica set|Transaction numbers/i.test(e.message || ''))) fail('transactions_unavailable');
      throw e;
    } finally {
      await session.endSession();
    }
  }
  async read(fn) { await this.init(); return fn(this.unit(null, true)); }

  unit(session, readOnly) {
    const { Decimal128 } = require('mongoose').Types;
    const c = name => this.db().collection('pay_' + name);
    const opt = session ? { session } : {};
    const ro = () => { if (readOnly) fail('server_error', 'write outside a transaction'); };
    const d = u => Decimal128.fromString(BigInt(u).toString());
    const big = v => BigInt(String(v == null ? '0' : v).split('.')[0]);
    return {
      get: (name, id) => c(name).findOne({ _id: id }, opt),
      findOne: (name, filter) => c(name).findOne(filter, opt),
      find: (name, filter, o) => {
        let cur = c(name).find(filter, opt);
        if (o && o.sort) cur = cur.sort(o.sort);
        if (o && o.limit) cur = cur.limit(o.limit);
        return cur.toArray();
      },
      async insert(name, doc) { ro(); await c(name).insertOne(clone(doc), opt); return clone(doc); },
      async update(name, id, set, expect) {
        ro();
        return c(name).findOneAndUpdate({ _id: id, ...(expect || {}) }, { $set: clone(set) }, { ...opt, returnDocument: 'after' });
      },
      async remove(name, id) { ro(); await c(name).deleteOne({ _id: id }, opt); },
      async balance(userId, asset, bucket) {
        const r = await c('accounts').findOne({ _id: acctKey(userId, asset, bucket) }, opt);
        return r ? big(r.balance.toString()) : 0n;
      },
      async balances(userId) {
        const rows = await c('accounts').find({ userId }, opt).toArray();
        const out = {};
        rows.forEach(r => { (out[r.asset] = out[r.asset] || { available: 0n, locked: 0n })[r.bucket] = big(r.balance.toString()); });
        return out;
      },
      async move(o) {
        ro();
        const { asset, units, from, to, refType, refId, memo, at } = o;
        if (!ASSET.test(String(asset))) fail('bad_request', 'asset');
        if (typeof units !== 'bigint' || units <= 0n) fail('bad_amount');
        if (!REF.test(String(refType)) || !REF.test(String(refId))) fail('bad_request', 'reference');
        checkSide(from); checkSide(to);
        const groupId = `${refType}:${refId}`;
        if (await c('entries').findOne({ groupId, leg: 1 }, opt)) return { ok: true, duplicate: true, groupId };
        const fk = acctKey(from.userId, asset, from.bucket), tk = acctKey(to.userId, asset, to.bucket);
        const q = { _id: fk };
        if (!isMint(from)) q.balance = { $gte: d(units) };
        const debited = await c('accounts').findOneAndUpdate(q,
          { $inc: { balance: d(-units) }, $setOnInsert: { userId: from.userId, asset, bucket: from.bucket } },
          { ...opt, returnDocument: 'after', upsert: isMint(from) });
        if (!debited) fail('insufficient_funds');
        const credited = await c('accounts').findOneAndUpdate({ _id: tk },
          { $inc: { balance: d(units) }, $setOnInsert: { userId: to.userId, asset, bucket: to.bucket } },
          { ...opt, returnDocument: 'after', upsert: true });
        const when = at || Date.now();
        const entry = (leg, side, direction, after) => ({ groupId, leg, userId: side.userId, bucket: side.bucket, asset, direction,
          amount: units.toString(), balanceAfter: big(after.toString()).toString(), refType, refId, memo: String(memo || '').slice(0, 200), at: when });
        await c('entries').insertMany([entry(0, from, 'debit', debited.balance), entry(1, to, 'credit', credited.balance)], opt);
        return { ok: true, groupId };
      },
      async reconcile() {
        const problems = [];
        const accounts = await c('accounts').find({}, opt).toArray();
        const entries = await c('entries').find({}, opt).toArray();
        const byAcct = new Map(), perGroup = new Map();
        entries.forEach(e => {
          const k = acctKey(e.userId, e.asset, e.bucket);
          byAcct.set(k, (byAcct.get(k) || 0n) + BigInt(e.amount) * (e.direction === 'credit' ? 1n : -1n));
          perGroup.set(e.groupId, (perGroup.get(e.groupId) || 0) + 1);
        });
        const perAsset = new Map();
        accounts.forEach(a => {
          const bal = big(a.balance.toString());
          if (bal !== (byAcct.get(a._id) || 0n)) problems.push(`${a._id}: balance ${bal} but entries say ${byAcct.get(a._id) || 0n}`);
          if (a.bucket !== 'mint' && bal < 0n) problems.push(`${a._id}: below zero`);
          perAsset.set(a.asset, (perAsset.get(a.asset) || 0n) + bal);
        });
        perAsset.forEach((sum, asset) => { if (sum !== 0n) problems.push(`${asset}: book sums to ${sum}, not zero`); });
        perGroup.forEach((n, g) => { if (n !== 2) problems.push(`${g}: ${n} entries, not 2`); });
        return { ok: problems.length === 0, problems, accounts: accounts.length, entries: entries.length };
      },
      async entries(userId, limit) {
        return c('entries').find({ userId }, opt).sort({ at: -1 }).limit(limit || 50).toArray();
      }
    };
  }
}

/* ══ Choosing ════════════════════════════════════════════════════════ */
const DEFAULT_FILE = path.join(__dirname, '..', '..', '.paydata', 'pay-book.json');

function open(env, deps) {
  const e = env || process.env;
  // No live-money adapter exists yet. An environment switch cannot turn
  // minted practice balances or the sandbox partner into real funds.
  if (e.PAY_MODE && e.PAY_MODE !== 'practice') return null;
  if (e.NODE_ENV === 'production' && e.PAY_MODE !== 'practice') return null;
  if (e.MONGO_URI) return new MongoStore((deps && deps.connection) || require('mongoose').connection);
  if (e.NODE_ENV === 'production') return null;
  return new FileStore({ file: e.PAY_STORE_FILE || DEFAULT_FILE });
}

module.exports = { open, FileStore, MongoStore, PayError, fail, MINT, SYSTEM, UNIQUE, COLLECTIONS, matches, DUP };
