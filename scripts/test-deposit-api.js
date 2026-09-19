/* ╔══════════════════════════════════════════════════════════════════╗
   ║  DEPOSIT API TESTS —  node scripts/test-deposit-api.js            ║
   ║                                                                   ║
   ║  Boots the wallet routes in-process and checks the answers that   ║
   ║  matter when something is missing: no session secret, no token, a ║
   ║  forged token, custody switched off, an unsupported pair, no      ║
   ║  database. Every one of them must refuse — the failure this       ║
   ║  guards against is a server that invents an address when it is    ║
   ║  half-configured.                                                 ║
   ║                                                                   ║
   ║  The account key used here is generated on the spot and thrown    ║
   ║  away. No key, real or otherwise, belongs in a repository.        ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');
const C = require('../lib/crypto');
const S = C.secp256k1;

/* A throwaway account xpub, derived the way a hardware wallet would. */
const XPUB = (() => {
  const ser32 = i => { const b = Buffer.alloc(4); b.writeUInt32BE(i); return b; };
  const be32 = n => Buffer.from(n.toString(16).padStart(64, '0'), 'hex');
  const I = crypto.createHmac('sha512', 'Bitcoin seed').update(crypto.randomBytes(64)).digest();
  const root = { k: BigInt('0x' + I.slice(0, 32).toString('hex')), cc: I.slice(32), depth: 0 };
  const ck = (n, i) => {
    const d = i >= 0x80000000
      ? Buffer.concat([Buffer.from([0]), be32(n.k), ser32(i)])
      : Buffer.concat([S.compress(S.mul(n.k)), ser32(i)]);
    const J = crypto.createHmac('sha512', n.cc).update(d).digest();
    return { k: (BigInt('0x' + J.slice(0, 32).toString('hex')) + n.k) % S.N, cc: J.slice(32), depth: n.depth + 1 };
  };
  const p = ck(root, 44 + 0x80000000), c = ck(p, 60 + 0x80000000), a = ck(c, 0x80000000);
  return C.b58checkEncode(Buffer.concat([
    Buffer.from([0x04, 0x88, 0xb2, 0x1e]), Buffer.from([a.depth]),
    C.hash160(S.compress(S.mul(c.k))).slice(0, 4), ser32(0x80000000), a.cc, S.compress(S.mul(a.k))
  ]));
})();

const express = require('express');
let PORT = 3177;

async function boot(env) {
  Object.keys(require.cache).forEach(k => { if (!k.includes('node_modules')) delete require.cache[k]; });
  Object.assign(process.env, env);
  PORT++;                                   // a fresh port each phase: closing one
  const app = express();                    // and reopening it races on Windows
  app.use(express.json());
  app.use('/api/crypto', require('../routes/crypto'));
  app.use('/api/crypto', require('../routes/deposit'));
  return new Promise(res => { const s = app.listen(PORT, () => res(s)); });
}

const call = async (path, opts) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { ...opts, headers: { Connection: 'close', ...((opts || {}).headers) } });
  let body; try { body = await r.json(); } catch (e) { body = null; }
  return { status: r.status, body };
};

(async () => {
  let pass = 0, fail = 0;
  const check = (name, got, want) => {
    const ok = String(got) === String(want);
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${ok ? '' : `  (got ${got}, want ${want})`}`);
    ok ? pass++ : fail++;
  };

  console.log('\n1 · no JWT_SECRET — wallet routes must close, public config must still work');
  let s = await boot({ JWT_SECRET: '', CUSTODY_ENABLED: 'false' });
  check('GET /assets is public', (await call('/api/crypto/assets')).status, 200);
  let r = await call('/api/crypto/deposit/address', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"asset":"ETH","network":"ethereum"}' });
  check('POST /deposit/address → 503 auth_unconfigured', r.status, 503);
  check('  and says why', r.body.error, 'auth_unconfigured');
  await new Promise(d => s.close(d));

  console.log('\n2 · secret set, no token');
  s = await boot({ JWT_SECRET: 'test-secret-only-for-this-run', CUSTODY_ENABLED: 'false' });
  const { sign } = require('../middleware/auth');
  r = await call('/api/crypto/deposits');
  check('GET /deposits without a token → 401', r.status, 401);
  r = await call('/api/crypto/deposits', { headers: { Authorization: 'Bearer not.a.jwt' } });
  check('a forged token → 401', r.status, 401);

  console.log('\n3 · signed in, custody switched off');
  const token = sign('user_test_1');
  r = await call('/api/crypto/deposit/address', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ asset: 'ETH', network: 'ethereum' })
  });
  check('address request → 503', r.status, 503);
  check('  code is custody_disabled', r.body.error, 'custody_disabled');

  console.log('\n4 · unsupported pairs are refused before any key is touched');
  r = await call('/api/crypto/deposit/address', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ asset: 'BTC', network: 'ethereum' })
  });
  check('BTC over Ethereum → 400 unsupported_pair', r.body.error, 'unsupported_pair');
  r = await call('/api/crypto/deposit/address', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ asset: 'DOGE', network: 'bitcoin' })
  });
  check('an unlisted asset → 400 unsupported_asset', r.body.error, 'unsupported_asset');
  await new Promise(d => s.close(d));

  console.log('\n5 · custody on, key configured — but no database');
  s = await boot({ JWT_SECRET: 'test-secret-only-for-this-run', CUSTODY_ENABLED: 'true', CUSTODY_XPUB_EVM: XPUB });
  const token2 = require('../middleware/auth').sign('user_test_1');
  r = await call('/api/crypto/deposit/address', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token2 },
    body: JSON.stringify({ asset: 'ETH', network: 'ethereum' })
  });
  check('no mongo → 503 no_database (never a made-up address)', r.body.error, 'no_database');

  console.log('\n6 · operator preview');
  const adminToken = require('../middleware/auth').sign('ops_1', { admin: true });
  r = await call('/api/crypto/custody/preview?network=ethereum&count=2', { headers: { Authorization: 'Bearer ' + adminToken } });
  check('admin preview → 200', r.status, 200);
  check('  returns 2 addresses', r.body.addresses.length, 2);
  check('  address is EIP-55 shaped', /^0x[0-9a-fA-F]{40}$/.test(r.body.addresses[0].address), 'true');
  r = await call('/api/crypto/custody/preview?network=ethereum', { headers: { Authorization: 'Bearer ' + token2 } });
  check('a normal user cannot preview → 403', r.status, 403);
  await new Promise(d => s.close(d));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
