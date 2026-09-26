/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CUSTODY FLOW TESTS —  node scripts/test-custody-flows.js         ║
   ║                                                                   ║
   ║  The other custody tests check the maths. These check the money   ║
   ║  paths end to end - deposit crediting, holds, settlement, cancel, ║
   ║  two-factor - and specifically the ways they used to go wrong:    ║
   ║                                                                   ║
   ║  · a worthless token credited as USDT or ETH                      ║
   ║  · one NFT transfer halting a chain's watcher for good            ║
   ║  · native ETH on Arbitrum credited as ARB                         ║
   ║  · another account's idempotency key skipping the funds hold      ║
   ║  · twenty requests racing one balance                             ║
   ║  · a completed withdrawal debited twice                           ║
   ║  · a cancel and a signer claim both winning                       ║
   ║  · a token withdrawal signed as the native coin                   ║
   ║  · a second factor that was never looked up, and codes that       ║
   ║    could be replayed                                              ║
   ║                                                                   ║
   ║  No MongoDB is needed: models/custody is replaced with an in-     ║
   ║  memory stand-in that keeps the unique indexes and yields between ║
   ║  operations, so concurrent requests really interleave. It is not  ║
   ║  a real database - server.js keeps custody off until these run    ║
   ║  against one - but every rule the code relies on is here.         ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');
const http = require('http');
const path = require('path');

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}
const ok = (name, cond) => check(name, !!cond, true);

/* ══ An in-memory stand-in for the custody models ═══════════════════ */
const tick = () => new Promise(r => setImmediate(r));
let nextId = 1;
const newId = () => (nextId++).toString(16).padStart(24, '0');

function eq(a, b) {
  if (b === null) return a == null;
  if (b instanceof Date) return a instanceof Date && a.getTime() === b.getTime();
  return a === b || (a != null && String(a) === String(b));
}
function matches(doc, filter) {
  return Object.entries(filter || {}).every(([k, v]) => {
    if (k === '$or') return v.some(f => matches(doc, f));
    const have = doc[k];
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      return Object.entries(v).every(([op, arg]) => {
        const t = x => (x instanceof Date ? x.getTime() : x);
        if (op === '$lt') return have != null && t(have) < t(arg);
        if (op === '$gte') return have != null && t(have) >= t(arg);
        if (op === '$in') return arg.some(x => eq(have, x));
        if (op === '$nin') return !arg.some(x => eq(have, x));
        if (op === '$ne') return !eq(have, arg);
        throw new Error('stand-in does not support ' + op);
      });
    }
    return eq(have, v);
  });
}
function applyUpdate(doc, update) {
  const ops = Object.keys(update).some(k => k[0] === '$') ? update : { $set: update };
  Object.entries(ops.$set || {}).forEach(([k, v]) => { doc[k] = v; });
  Object.entries(ops.$inc || {}).forEach(([k, v]) => { doc[k] = (doc[k] || 0) + v; });
}

function makeModel(name, unique) {
  const rows = [];
  const dupe = (doc, self) => unique && rows.some(r => r !== self && unique.every(f => eq(r[f], doc[f])));
  const wrap = row => {
    if (!row) return null;
    const copy = { ...row };
    Object.defineProperty(copy, 'save', { enumerable: false, value: async () => {
      await tick();
      const i = rows.findIndex(r => r._id === copy._id);
      const next = { ...copy };
      if (dupe(next, rows[i])) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      rows[i] = next;
      return copy;
    } });
    return copy;
  };
  const insert = doc => {
    const row = { _id: newId(), ...doc };
    if (dupe(row)) throw Object.assign(new Error(`E11000 duplicate key in ${name}`), { code: 11000 });
    rows.push(row);
    return wrap(row);
  };
  return {
    rows,
    async create(docs) {
      await tick();
      if (Array.isArray(docs)) { const out = []; for (const d of docs) out.push(insert(d)); return out; }
      return insert(docs);
    },
    async findOne(q) { await tick(); return wrap(rows.find(r => matches(r, q))); },
    async findById(id) { await tick(); return wrap(rows.find(r => eq(r._id, id))); },
    async find(q) { await tick(); return rows.filter(r => matches(r, q)).map(wrap); },
    async updateOne(q, update, opts) {
      await tick();
      const row = rows.find(r => matches(r, q));
      if (!row) {
        if (opts && opts.upsert) {
          const base = {};
          Object.entries(q).forEach(([k, v]) => { if (k[0] !== '$' && (v === null || typeof v !== 'object')) base[k] = v; });
          applyUpdate(base, update);
          insert(base);
          return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        return { matchedCount: 0, modifiedCount: 0 };
      }
      const next = { ...row };
      applyUpdate(next, update);
      if (dupe(next, row)) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      Object.assign(row, next);
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async findOneAndUpdate(q, update, opts) {
      await tick();
      const row = rows.find(r => matches(r, q));
      if (!row) return null;
      const before = { ...row };
      applyUpdate(row, update);
      return wrap(opts && opts.new ? row : before);
    },
    async countDocuments(q) { await tick(); return rows.filter(r => matches(r, q)).length; },
    /* Only the one pipeline the ledger runs: $match, then sum amounts by
       direction. Summed as BigInt, which is what $toDecimal is for. */
    async aggregate(pipeline) {
      await tick();
      const match = (pipeline.find(s => s.$match) || {}).$match || {};
      const sums = {};
      rows.filter(r => matches(r, match)).forEach(r => { sums[r.direction] = (sums[r.direction] || 0n) + BigInt(r.amount); });
      return Object.entries(sums).map(([dir, total]) => ({ _id: dir, total: total.toString() }));
    }
  };
}

const M = {
  DepositAddress: makeModel('deposit_addresses', ['network', 'address']),
  Withdrawal: makeModel('withdrawals', ['userId', 'idempotencyKey']),
  DepositTx: makeModel('deposit_txs', ['network', 'txHash', 'vout']),
  LedgerEntry: makeModel('ledger_entries', ['referenceType', 'referenceId', 'direction']),
  WalletAccount: makeModel('wallet_accounts', ['userId', 'asset', 'kind']),
  AuditLog: makeModel('audit_log', null),
  WithdrawalSecurity: makeModel('withdrawal_security', ['userId']),
  NetworkState: makeModel('network_state', ['network'])
};

/* Swap the stand-in in before anything requires the real models. Fees
   are stubbed too: a fixed, fresh quote, so these tests need no chain
   for the withdrawal side. */
const stub = (rel, exports) => {
  const file = require.resolve(rel);
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
stub('../models/custody', M);
stub('../services/fees', {
  quote: async () => ({ ok: true, fee: '1000', unit: 'wei', basis: 'test', at: Date.now(), minimum: '3000', decimals: 18 }),
  isFresh: () => true
});

process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
process.env.WD_REQUIRE_2FA = 'false';     // the money-path tests; 2FA has its own section
delete process.env.NODE_ENV;

const ledger = require('../services/ledger');
const withdraw = require('../services/withdraw');
const twofactor = require('../services/twofactor');
const watcher = require('../services/watcher');
const tokens = require('../config/custody-tokens');
const policy = require('../signer/policy');
const totp = require('../lib/totp');
const box = require('../lib/secretbox');

const ETH = n => (BigInt(Math.round(n * 1e6)) * 10n ** 12n);   // n ETH in wei, to 6 places
const TO = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
let depN = 0;
const fund = (userId, asset, amount) => ledger.credit({ userId, asset, amount: amount.toString(), referenceType: 'deposit', referenceId: 'dep_' + (++depN) });
const bal = async (userId, asset, kind) => BigInt(await ledger.balanceOf(userId, asset, kind));
const ask = (userId, amount, key, extra) => withdraw.request(Object.assign({
  userId, asset: 'ETH', network: 'ethereum', to: TO, amount: amount.toString(), idempotencyKey: key
}, extra || {}));

/* A tiny JSON-RPC chain for the watcher: fixed tip, fixed logs, one block
   with native transfers. Keyed by URL path, one path per network. */
function mockChains(chains) {
  return new Promise(res => {
    const s = http.createServer((req, r) => {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        const call = JSON.parse(body || '{}');
        const c = chains[req.url.slice(1)];
        const reply = v => { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, result: v })); };
        if (call.method === 'eth_blockNumber') return reply('0x' + c.tip.toString(16));
        if (call.method === 'eth_getLogs') return reply(c.logs);
        if (call.method === 'eth_getBlockByNumber') {
          const h = parseInt(call.params[0], 16);
          return reply({ number: call.params[0], transactions: h === c.txBlock ? c.txs : [] });
        }
        reply(null);
      });
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}
const topicFor = addr => '0x' + '0'.repeat(24) + addr.slice(2).toLowerCase();
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const word = n => '0x' + BigInt(n).toString(16).padStart(64, '0');

(async () => {
  /* ── Holds ───────────────────────────────────────────────────────── */
  console.log('\nholding funds for a withdrawal');
  await fund('alice', 'ETH', ETH(1));
  let r = await ask('alice', ETH(0.4), 'alice-key-0001');
  ok('a withdrawal within the balance is accepted', r.ok);
  check('  spendable drops by the amount', await bal('alice', 'ETH'), ETH(0.6));
  check('  and the amount sits in the hold account', await bal('alice', 'ETH', 'hold'), ETH(0.4));
  const aliceWd = r.withdrawal;
  r = await ask('alice', ETH(0.4), 'alice-key-0001');
  ok('the same key again returns the same withdrawal', r.ok && r.idempotent && String(r.withdrawal._id) === String(aliceWd._id));
  check('  and holds nothing more', await bal('alice', 'ETH'), ETH(0.6));

  console.log('\nanother account’s key cannot skip the hold');
  await fund('bob', 'ETH', ETH(0.1));
  r = await ask('bob', ETH(0.1), 'alice-key-0001');       // alice's key, bob's account
  ok('bob’s withdrawal is his own, not alice’s', r.ok && !r.idempotent);
  check('  and bob’s funds really are held', await bal('bob', 'ETH'), 0n);
  r = await ask('bob', ETH(0.1), 'bob-key-000002');
  check('so a second withdrawal of the same money is refused', r.code, 'insufficient');

  console.log('\ntwenty requests racing one balance');
  await fund('carol', 'ETH', ETH(1));
  const burst = await Promise.all(Array.from({ length: 20 }, (_, i) => ask('carol', ETH(0.6), 'carol-race-' + String(i).padStart(3, '0'))));
  const won = burst.filter(x => x.ok).length;
  ok(`at most one wins (${won} did)`, won <= 1);
  ok('  the balance never goes below zero', (await bal('carol', 'ETH')) >= 0n);
  check('  spendable + held is still exactly what was deposited',
    (await bal('carol', 'ETH')) + (await bal('carol', 'ETH', 'hold')), ETH(1));
  if (!won) {
    r = await ask('carol', ETH(0.6), 'carol-after-race');
    ok('  (all refused at once; a single retry then goes through)', r.ok);
  }

  /* ── Settlement ──────────────────────────────────────────────────── */
  console.log('\na completed withdrawal is debited once');
  await fund('dave', 'ETH', ETH(1));
  r = await ask('dave', ETH(0.4), 'dave-key-00001');
  const dId = r.withdrawal._id;
  for (const [to, patch] of [['signing'], ['broadcast', { txHash: '0x' + 'ab'.repeat(32) }], ['confirming'], ['completed']]) {
    const s = await withdraw.advance(dId, to, patch || {}, 'test');
    ok(`  ${to}`, s.ok);
  }
  check('spendable is 0.6 ETH, not 0.2', await bal('dave', 'ETH'), ETH(0.6));
  check('nothing left in the hold account', await bal('dave', 'ETH', 'hold'), 0n);
  ok('the cached balance agrees with the ledger', (await ledger.reconcile('dave', 'ETH')).ok);
  const again = await withdraw.settle(await M.Withdrawal.findById(dId));
  ok('settling twice changes nothing', again.already);
  check('  still 0.6 ETH', await bal('dave', 'ETH'), ETH(0.6));

  console.log('\ncancelling');
  await fund('erin', 'ETH', ETH(1));
  r = await ask('erin', ETH(0.5), 'erin-key-00001');
  let c = await withdraw.cancel('erin', r.withdrawal._id);
  ok('a queued withdrawal can be cancelled', c.ok);
  check('  and the funds come back', await bal('erin', 'ETH'), ETH(1));
  c = await withdraw.cancel('erin', r.withdrawal._id);
  ok('cancelling again is refused', !c.ok);
  check('  and does not pay out twice', await bal('erin', 'ETH'), ETH(1));
  c = await withdraw.cancel('mallory', r.withdrawal._id);
  check('someone else cannot cancel it', c.code, 'not_found');

  console.log('\na cancel racing the signer’s claim');
  /* The claim is sent a few steps later each round, so it lands before,
     inside and after the cancel's read-check-write - the old code let
     both win whenever it landed inside. */
  let consistent = 0, rounds = 0, cancelWins = 0, claimWins = 0;
  for (let delay = 0; delay < 8; delay++) {
    const user = 'frank' + delay;
    await fund(user, 'ETH', ETH(1));
    const w = (await ask(user, ETH(0.5), 'frank-key-' + delay + '0000')).withdrawal;
    const claim = async () => {
      for (let k = 0; k < delay; k++) await tick();
      return M.Withdrawal.findOneAndUpdate({ _id: w._id, status: 'queued_for_signing' },
        { status: 'signing', claimedAt: new Date() }, { new: true });
    };
    const [claimRes, cancelRes] = await Promise.all([claim(), withdraw.cancel(user, w._id)]);
    const claimed = !!claimRes, cancelled = !!(cancelRes && cancelRes.ok);
    const now = await M.Withdrawal.findById(w._id);
    const held = await bal(user, 'ETH', 'hold');
    rounds++;
    if (cancelled) cancelWins++;
    if (claimed) claimWins++;
    if (claimed !== cancelled && (now.status === 'cancelled') === cancelled && (cancelled ? held === 0n : held === ETH(0.5))) consistent++;
  }
  check('exactly one wins every time, and the money follows the winner', consistent, rounds);
  ok(`  both outcomes were exercised (cancel won ${cancelWins}, claim won ${claimWins})`, cancelWins > 0 && claimWins > 0);

  /* ── What may be withdrawn and signed ────────────────────────────── */
  console.log('\nonly the network’s own coin');
  check('USDT on Ethereum is refused for now', withdraw.checkPair('USDT', 'ethereum').code, 'token_withdrawals_unsupported');
  check('ARB on Arbitrum is refused (a token there)', withdraw.checkPair('ARB', 'arbitrum').code, 'token_withdrawals_unsupported');
  ok('ETH on Arbitrum is allowed (the native coin)', withdraw.checkPair('ETH', 'arbitrum').ok);
  const sw = { asset: 'DAI', network: 'ethereum', contract: '', to: TO, amount: '100000000000000000000', fee: '1', createdAt: Date.now() };
  check('the signer refuses a token that came without its contract', policy.decide(sw, { policy: { ...policy.DEFAULTS }, spentToday: {} }).action, 'refuse');
  ok('  and says it would have been sent as ETH', /sent as ETH/.test(policy.decide(sw, { policy: { ...policy.DEFAULTS }, spentToday: {} }).why));
  ok('the signer still handles native ETH', policy.decide({ ...sw, asset: 'ETH' }, { policy: { ...policy.DEFAULTS }, spentToday: {} }).action !== 'refuse');

  /* ── Deposits ────────────────────────────────────────────────────── */
  console.log('\nthe token allow-list');
  const REAL_USDT = '0x' + '11'.repeat(20), FAKE = '0x' + '22'.repeat(20);
  check('a well-formed list parses', tokens.parse(JSON.stringify({ ethereum: { [REAL_USDT]: { asset: 'USDT', decimals: 6 } } })).problems.length, 0);
  ok('contracts that disagree on decimals are refused',
    tokens.parse(JSON.stringify({ ethereum: { [REAL_USDT]: { asset: 'USDT', decimals: 6 } }, bnb: { [FAKE]: { asset: 'USDT', decimals: 18 } } })).problems.length > 0);
  ok('  and then no token is credited at all',
    tokens.parse(JSON.stringify({ ethereum: { [REAL_USDT]: { asset: 'USDT', decimals: 6 } }, bnb: { [FAKE]: { asset: 'USDT', decimals: 18 } } })).tokens.size === 0);
  ok('a native coin cannot be listed as a token', tokens.parse(JSON.stringify({ ethereum: { [FAKE]: { asset: 'ETH', decimals: 18 } } })).problems.length > 0);
  ok('bad JSON is refused', tokens.parse('{nope').problems.length > 0);

  console.log('\nwhat the watcher credits');
  process.env.CUSTODY_TOKENS = JSON.stringify({ ethereum: { [REAL_USDT]: { asset: 'USDT', decimals: 6 } } });
  const A = n => '0x' + String(n).repeat(40);
  const addr = {};
  for (const [k, asset, network, a] of [['usdt', 'USDT', 'ethereum', A(3)], ['eth', 'ETH', 'ethereum', A(4)],
                                       ['arbEth', 'ETH', 'arbitrum', A(5)], ['arbArb', 'ARB', 'arbitrum', A(6)]]) {
    addr[k] = await M.DepositAddress.create({ userId: 'gina', asset, network, address: a, xpubId: 'x', change: 0, index: Object.keys(addr).length, derivation: 'x', status: 'active' });
  }
  const log = (contract, to, amount, i, extraTopic) => ({
    address: contract, topics: [TRANSFER, topicFor(A(9)), topicFor(to)].concat(extraTopic ? [word(1)] : []),
    data: extraTopic ? '0x' : word(amount), blockNumber: '0x32', transactionHash: '0x' + String(i).padStart(64, '0'), logIndex: '0x' + i.toString(16)
  });
  const chain = await mockChains({
    ethereum: { tip: 100, txBlock: 50, logs: [
      log(FAKE, A(3), 10n ** 12n, 1, true),          // NFT-shaped first: must not stop the sweep
      log(REAL_USDT, A(3), 100n * 10n ** 6n, 2),      // real USDT to the USDT address
      log(FAKE, A(3), 10n ** 12n, 3),                 // worthless token to the USDT address
      log(FAKE, A(4), 10n ** 20n, 4),                 // worthless token to the ETH address
      log(REAL_USDT, A(4), 5n * 10n ** 6n, 5)         // real USDT, but to the ETH address
    ], txs: [{ hash: '0x' + 'e1'.repeat(32), to: A(4), value: '0x' + ETH(0.5).toString(16) }] },
    arbitrum: { tip: 100, txBlock: 50, logs: [], txs: [
      { hash: '0x' + 'a1'.repeat(32), to: A(5), value: '0x' + ETH(0.1).toString(16) },   // native ETH on Arbitrum
      { hash: '0x' + 'a2'.repeat(32), to: A(6), value: '0x' + ETH(0.2).toString(16) }    // native ETH to the ARB address
    ] }
  });
  const base = `http://127.0.0.1:${chain.address().port}`;
  process.env.WATCHER_RPC_ETHEREUM = base + '/ethereum';
  process.env.WATCHER_RPC_ARBITRUM = base + '/arbitrum';
  let scanned = true;
  for (const network of ['ethereum', 'arbitrum']) {
    const list = Object.values(addr).filter(a => a.network === network);
    try {
      const out = await watcher.drivers.evm.scan(list, network, { lastScanned: 49 });
      for (const hit of out.found) await watcher.record(hit);
    } catch (e) { scanned = false; console.log('        scan threw: ' + e.message); }
  }
  ok('an NFT-shaped log does not stop the sweep', scanned);
  check('real USDT is credited as USDT', await bal('gina', 'USDT'), 100n * 10n ** 6n);
  check('native ETH on both chains is credited as ETH', await bal('gina', 'ETH'), ETH(0.6));
  check('nothing is credited as ARB', await bal('gina', 'ARB'), 0n);
  const rejected = (await M.DepositTx.find({ status: 'rejected' })).map(t => t.rejectedReason);
  check('four arrivals are recorded and refused', rejected.length, 4);
  check('  two because the contract is not on the list', rejected.filter(x => /not on the allow-list/.test(x)).length, 2);
  check('  two because they came to the wrong kind of address', rejected.filter(x => /issued for/.test(x)).length, 2);
  await new Promise(d => chain.close(d));
  delete process.env.CUSTODY_TOKENS;

  /* ── Two-factor ──────────────────────────────────────────────────── */
  console.log('\ntwo-factor for withdrawals');
  process.env.WD_REQUIRE_2FA = 'true';
  const now = () => Math.floor(Date.now() / 1000);
  const b1 = await twofactor.begin('hank', 'hank@example.com');
  ok('enrolment starts and shows the secret once', b1.ok && /^otpauth:\/\//.test(b1.uri));
  const row = await M.WithdrawalSecurity.findOne({ userId: 'hank' });
  ok('  the stored copy is sealed, not the secret', row.totpPendingEnc.startsWith('v1.') && row.totpPendingEnc.indexOf(b1.secret) === -1);
  ok('  and is bound to its owner', (() => { try { box.open(row.totpPendingEnc, 'someone-else'); return false; } catch (e) { return true; } })());
  check('a wrong confirmation code is refused', (await twofactor.confirm('hank', '000000')).code, 'twofactor');
  ok('the right one turns it on', (await twofactor.confirm('hank', totp.generate(b1.secret))).ok);
  ok('  status says so', (await twofactor.status('hank')).enrolled);
  check('a second enrolment is refused while one is on', (await twofactor.begin('hank')).code, 'already_enrolled');

  process.env.WD_COOLOFF_MS = String(24 * 3600 * 1000);
  check('withdrawals wait out the cool-off after setup', (await twofactor.check('hank', totp.generate(b1.secret, { time: now() + 30 }))).code, 'cooling_off');
  process.env.WD_COOLOFF_MS = '0';
  const next = totp.generate(b1.secret, { time: now() + 30 });
  ok('a fresh code passes', (await twofactor.check('hank', next)).ok);
  check('the same code a second time is refused', (await twofactor.check('hank', next)).code, 'twofactor_reused');

  for (let i = 0; i < twofactor.MAX_FAILS; i++) await twofactor.check('hank', '000000');
  check(`${twofactor.MAX_FAILS} wrong codes lock it`, (await twofactor.check('hank', totp.generate(b1.secret, { time: now() + 30 }))).code, 'twofactor_locked');

  console.log('\na withdrawal needs the factor');
  await fund('ivy', 'ETH', ETH(1));
  check('with none set up, it is refused', (await ask('ivy', ETH(0.1), 'ivy-key-000001')).code, 'twofactor_required');
  const b2 = await twofactor.begin('ivy');
  await twofactor.confirm('ivy', totp.generate(b2.secret));
  check('with a wrong code, it is refused', (await ask('ivy', ETH(0.1), 'ivy-key-000002', { twoFactor: '123456' })).code, 'twofactor');
  r = await ask('ivy', ETH(0.1), 'ivy-key-000003', { twoFactor: totp.generate(b2.secret, { time: now() + 30 }) });
  ok('with a right one, it goes through', r.ok);

  process.env.NODE_ENV = 'production';
  process.env.WD_REQUIRE_2FA = 'false';
  await fund('jack', 'ETH', ETH(1));
  check('in production the factor cannot be switched off', (await ask('jack', ETH(0.1), 'jack-key-000001')).code, 'twofactor_required');
  delete process.env.NODE_ENV;

  const savedKey = process.env.TOTP_ENCRYPTION_KEY;
  delete process.env.TOTP_ENCRYPTION_KEY;
  check('with no encryption key, nothing can be enrolled', (await twofactor.begin('kim')).code, 'twofactor_unconfigured');
  process.env.TOTP_ENCRYPTION_KEY = savedKey;

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
