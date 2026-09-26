/* ╔══════════════════════════════════════════════════════════════════╗
   ║  FOUNDATION TESTS —  node scripts/test-foundation.js              ║
   ║                                                                   ║
   ║  The pieces every money route stands on, tested without a         ║
   ║  database (scripts/test-db.js runs the ones that need one):       ║
   ║                                                                   ║
   ║   · every error answers the six questions                         ║
   ║   · a request runs once per retry key - replayed, not repeated -  ║
   ║     even when two copies arrive at the same moment                ║
   ║   · rate limits refuse before anything runs, per person           ║
   ║   · compliance refuses every real-money action; risk scoring      ║
   ║     holds and blocks for the reasons it gives                     ║
   ║   · amounts are exact, and anything odd is refused                ║
   ║   · with no database, money routes say so instead of failing      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const express = require('express');
const { problem, CODES } = require('../lib/problem');
const { idempotent } = require('../middleware/idempotency');
const { limit } = require('../middleware/ratelimit');
const compliance = require('../services/compliance');
const { makeRisk } = require('../services/risk');
const ledger = require('../services/sandbox-ledger');

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}
const ok = (name, cond) => check(name, !!cond, true);
const wait = ms => new Promise(r => setTimeout(r, ms));

// A retry-key store with the one property that matters: create() on a
// key that exists fails with 11000, and it yields first so requests interleave.
function memStore() {
  const rows = new Map();
  const k = q => `${q.userId}|${q.scope}|${q.key}`;
  return {
    rows,
    create: async doc => { await wait(1); if (rows.has(k(doc))) { const e = new Error('dup'); e.code = 11000; throw e; } rows.set(k(doc), { ...doc }); },
    find: async q => rows.get(k(q)) || null,
    finish: async (q, set) => { await wait(1); Object.assign(rows.get(k(q)), set); },
    drop: async q => { rows.delete(k(q)); }
  };
}

async function serve(app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { user, key, body, method } = {}) => {
    const headers = { 'content-type': 'application/json' };
    if (user) headers['x-user'] = user;
    if (key) headers['idempotency-key'] = key;
    const r = await fetch(base + path, { method: method || 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { status: r.status, json, headers: r.headers };
  };
  return { call, close: () => server.close() };
}
const asUser = (req, res, next) => { const u = req.get('x-user'); req.user = u ? { id: u } : null; next(); };

(async () => {
  console.log('\nevery error answers the six questions');
  {
    Object.keys(CODES).forEach(code => {
      const [status, body] = problem(code);
      const complete = ['error', 'message', 'fundsSafe', 'status', 'action', 'support'].every(k => k in body);
      if (!complete || !(status >= 200)) check(`  ${code} is complete`, false, true);
    });
    ok('all codes carry error, message, fundsSafe, status, action, support', true);
    const [, b] = problem('insufficient_funds', { ref: 'TX-123' });
    ok('a reference is quoted in the support line', b.support.includes('quoting TX-123'));
    check('an unknown failure never claims the money is safe', problem('what').pop().fundsSafe, 'null');
  }

  console.log('\nretry keys');
  {
    const store = memStore();
    let runs = 0;
    const app = express();
    app.use(express.json());
    app.use(asUser);
    app.post('/pay', idempotent('pay', { store }), async (req, res) => { runs++; await wait(30); res.status(201).json({ run: runs, amount: req.body.amount }); });
    app.post('/boom', idempotent('boom', { store }), (req, res) => { runs++; res.status(500).json({ error: 'server_error' }); });
    const s = await serve(app);

    let r = await s.call('/pay', { user: 'a', body: { amount: '5' } });
    check('no key: refused before anything runs', r.status + ' ' + r.json.error, '400 idempotency_key_required');
    check('  and it says the money is safe', r.json.fundsSafe, true);
    check('  nothing ran', runs, 0);

    r = await s.call('/pay', { user: 'a', key: 'key-000001', body: { amount: '5', to: 'b' } });
    check('first request runs', r.status, 201);
    const again = await s.call('/pay', { user: 'a', key: 'key-000001', body: { to: 'b', amount: '5' } });
    check('same key and body (fields in any order): the first answer again', JSON.stringify(again.json), JSON.stringify(r.json));
    check('  marked as a replay', again.headers.get('idempotent-replay'), 'true');
    check('  and it did not run twice', runs, 1);
    r = await s.call('/pay', { user: 'a', key: 'key-000001', body: { amount: '50', to: 'b' } });
    check('same key, different body: refused', r.status + ' ' + r.json.error, '422 idempotency_key_reused');

    const [x, y] = await Promise.all([
      s.call('/pay', { user: 'a', key: 'key-race-01', body: { amount: '1' } }),
      s.call('/pay', { user: 'a', key: 'key-race-01', body: { amount: '1' } })
    ]);
    check('two copies at once: one runs, one is told it is in progress', [x.status, y.status].sort().join(','), '201,409');
    check('  it ran once', runs, 2);

    r = await s.call('/pay', { user: 'b', key: 'key-000001', body: { amount: '5', to: 'b' } });
    check('keys are per person: someone else\'s same key runs', r.status, 201);
    r = await s.call('/pay', { user: 'a', key: 'short', body: {} });
    check('a key that is too short is refused', r.json.error, 'idempotency_key_required');

    const before = runs;
    await s.call('/boom', { user: 'a', key: 'key-boom-01', body: {} });
    await s.call('/boom', { user: 'a', key: 'key-boom-01', body: {} });
    check('a server error releases the key, so a retry runs', runs - before, 2);
    s.close();
  }

  console.log('\nrate limits');
  {
    const clock = { t: 1000 };
    const app = express();
    app.use(asUser);
    let runs = 0;
    app.post('/x', limit({ scope: 'x', windowMs: 60000, max: 3, now: () => clock.t }), (req, res) => { runs++; res.json({ ok: true }); });
    const s = await serve(app);
    for (let i = 0; i < 3; i++) await s.call('/x', { user: 'a' });
    let r = await s.call('/x', { user: 'a' });
    check('the fourth in a minute is refused', r.status + ' ' + r.json.error, '429 rate_limited');
    check('  before it runs', runs, 3);
    ok('  saying when to try again', Number(r.headers.get('retry-after')) > 0 && r.json.retryAfter > 0);
    r = await s.call('/x', { user: 'b' });
    check('another person is not affected', r.status, 200);
    clock.t += 60001;
    r = await s.call('/x', { user: 'a' });
    check('a minute later it is allowed again', r.status, 200);
    s.close();
  }

  console.log('\ncompliance');
  {
    check('practice money is allowed', compliance.check({ book: 'sandbox', action: 'transfer' }).allowed, true);
    const live = compliance.check({ book: 'live', action: 'withdrawal' });
    check('a real-money withdrawal is refused', live.allowed, false);
    check('  naming every missing check', live.missing.join(','), 'kyc,sanctions,monitoring,travelRule');
    check('an unknown action is refused', compliance.check({ book: 'live', action: 'lottery' }).allowed, false);
    check('an unknown book is refused', compliance.check({ book: 'real', action: 'transfer' }).allowed, false);
    const filled = { kyc: {}, sanctions: {}, monitoring: {}, travelRule: {} };
    check('even with every slot filled, nothing unbuilt says yes', compliance.check({ book: 'live', action: 'transfer' }, filled).allowed, false);
  }

  console.log('\nrisk');
  {
    const clock = { t: 10 * 3600 * 1000 };
    const R = makeRisk({ now: () => clock.t });
    check('an ordinary action is allowed', R.assess({ userId: 'u1', amountUsd: 20 }).decision, 'allow');
    const r = R.assess({ userId: 'u2', deviceAgeMs: 5 * 60000, newAddress: true, amountUsd: 50 });
    check('new device + new address: held for review', r.decision, 'review');
    check('  with both reasons', r.reasons.length, 2);
    check('new device + new address + large amount: blocked',
      R.assess({ userId: 'u3', deviceAgeMs: 1000, newAddress: true, amountUsd: 20000, typicalUsd: 100 }).decision, 'block');
    for (let i = 0; i < 10; i++) R.assess({ userId: 'u4' });
    ok('a burst is noticed', R.assess({ userId: 'u4' }).signals.includes('burst'));
    ok('2FA changed an hour ago counts', R.assess({ userId: 'u5', twoFactorChangedAt: clock.t - 3600 * 1000 }).signals.includes('recent2fa'));
  }

  console.log('\nexact amounts');
  {
    check('12.5 is 1,250,000,000 units', ledger.toUnits('12.5'), '1250000000');
    check('the smallest unit is allowed', ledger.toUnits('0.00000001'), '1');
    check('and it round-trips', ledger.fromUnits(ledger.toUnits('1234.56780000')), '1234.5678');
    const refused = ['0', '-1', '1e5', '0.000000001', '1.', '.5', 'abc', '', '12,5', '99999999999999'];
    const let_ = refused.filter(v => { try { ledger.toUnits(v); return true; } catch (e) { return e.code !== 'bad_amount'; } });
    check('zero, negatives, exponents, 9 decimals, commas and absurd sizes are refused', let_.join(' | '), '');
    let code = '';
    try { await ledger.move({ asset: 'USDT', amount: '1', from: { userId: 'a', bucket: 'available' }, to: { userId: 'b', bucket: 'available' }, refType: 't', refId: '1' }); }
    catch (e) { code = e.code; }
    check('with no database, nothing moves and it says why', code, 'database_unavailable');
    code = '';
    try { await ledger.move({ asset: 'USDT', amount: '1', from: { userId: 'system:mint', bucket: 'available' }, to: { userId: 'b', bucket: 'available' }, refType: 't', refId: '2' }); }
    catch (e) { code = e.code; }
    check('only the mint itself may act as the mint', code, 'bad_request');
  }

  console.log('\nsupport, with no database');
  {
    const app = express();
    app.use(express.json());
    app.use('/api/support', require('../routes/support'));
    const s = await serve(app);
    const r = await s.call('/api/support/tickets', { method: 'GET' });
    check('answers 503 database_unavailable', r.status + ' ' + r.json.error, '503 database_unavailable');
    check('  and says nothing was changed', r.json.fundsSafe, true);
    s.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
