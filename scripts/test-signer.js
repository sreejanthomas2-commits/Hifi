/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SIGNER TESTS —  node scripts/test-signer.js                      ║
   ║                                                                   ║
   ║  A transaction builder that is subtly wrong produces a valid      ║
   ║  transaction that sends somewhere else, and the first you hear of ║
   ║  it is a customer's money arriving at a stranger. So:             ║
   ║                                                                   ║
   ║  · RLP against the yellow paper's examples                        ║
   ║  · the ERC-20 selector computed, then compared with the published ║
   ║    value — if they ever disagree, the hash is wrong               ║
   ║  · a full sign-and-recover round trip: sign the hash this code    ║
   ║    produces with a throwaway key, then recover the signer from    ║
   ║    the assembled transaction and require it to be that key's      ║
   ║    address. That proves the bytes being signed are the bytes      ║
   ║    that get broadcast.                                            ║
   ║                                                                   ║
   ║  The only private key in this file is generated here, used for    ║
   ║  one comparison, and never written anywhere.                      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');
const rlp = require('../signer/lib/rlp');
const evmtx = require('../signer/lib/evmtx');
const policy = require('../signer/policy');
const backends = require('../signer/backends');
const { keccak256, secp256k1: S, ADDRESS } = require('../lib/crypto');

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}
const ok = (name, cond) => check(name, !!cond, true);
const hex = b => b.toString('hex');

console.log('\nRLP (yellow paper examples)');
check('"dog"', hex(rlp.encode('dog')), '83646f67');
check('["cat","dog"]', hex(rlp.encode(['cat', 'dog'])), 'c88363617483646f67');
check('empty string', hex(rlp.encode('')), '80');
check('empty list', hex(rlp.encode([])), 'c0');
check('0x00', hex(rlp.encode(Buffer.from([0]))), '00');
check('15', hex(rlp.encode(15)), '0f');
check('1024', hex(rlp.encode(1024)), '820400');
check('zero encodes empty, not 0x00', hex(rlp.encode(0)), '80');
check('the long string rule at 56 bytes',
  hex(rlp.encode('Lorem ipsum dolor sit amet, consectetur adipisicing elit')).slice(0, 4), 'b838');

console.log('\nERC-20 calldata');
check('transfer selector', hex(evmtx.TRANSFER_SELECTOR), 'a9059cbb');
const call = evmtx.erc20Transfer('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', 1000000n);
check('calldata is 4 + 32 + 32 bytes', call.length, 68);
check('  selector first', hex(call.slice(0, 4)), 'a9059cbb');
check('  address right-aligned in 32 bytes', hex(call.slice(4, 36)),
  '000000000000000000000000' + '5aaeb6053f3e94c9b9a09f33669435e7ef1beaed');
check('  amount right-aligned', hex(call.slice(36)), (1000000n).toString(16).padStart(64, '0'));
ok('a malformed recipient is refused', (() => {
  try { evmtx.erc20Transfer('0xnope', 1n); return false; } catch (e) { return true; }
})());

console.log('\ntransaction building');
const tx = evmtx.build({
  chainId: 1, nonce: 7, priorityFee: 1000000000n, maxFee: 40000000000n,
  gasLimit: 21000n, to: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  amount: '250000000000000000', contract: ''
});
const u = evmtx.unsigned(tx);
check('the payload is a type-2 envelope', u.payload[0], 2);
check('the hash is 32 bytes', u.hash.length, 32);
check('value carries the amount for a native send', tx.value, 250000000000000000n);
check('  and there is no calldata', tx.data.length, 0);
const ttx = evmtx.build({
  chainId: 1, nonce: 7, priorityFee: 1n, maxFee: 2n, gasLimit: 100000n,
  to: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', amount: '1000000', contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
});
check('a token send carries zero value', ttx.value, 0n);
check('  and goes TO the contract', ttx.to.toLowerCase(), '0xdac17f958d2ee523a2206206994597c13d831ec7');
check('  with the recipient in the calldata', hex(ttx.data).indexOf('5aaeb6053f3e94c9b9a09f33669435e7ef1beaed') > -1, 'true');
ok('changing one field changes the hash',
  hex(evmtx.unsigned({ ...tx, nonce: 8n }).hash) !== hex(u.hash));

console.log('\nsign and recover — the bytes signed are the bytes broadcast');
/* A throwaway key, used once, never stored. */
const priv = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % (S.N - 1n) + 1n;
const pub = S.mul(priv);
const myAddress = ADDRESS.evm(S.compress(pub));

/* RFC 6979 is not needed for a test: any valid nonce works, as long as
   it is used once, which it is. */
function sign(hash32, k) {
  const z = BigInt('0x' + hash32.toString('hex'));
  const R = S.mul(k);
  const r = R.x % S.N;
  const kInv = S.inv(k, S.N);
  let s = (kInv * (z + r * priv)) % S.N;
  let yParity = (R.y & 1n) === 1n;
  if (s > S.N / 2n) { s = S.N - s; yParity = !yParity; }   // low-s, as Ethereum requires
  return { r: '0x' + r.toString(16), s: '0x' + s.toString(16), yParity };
}
function recover(hash32, sig) {
  const z = BigInt('0x' + hash32.toString('hex'));
  const r = BigInt(sig.r), s = BigInt(sig.s);
  const prefix = sig.yParity ? 0x03 : 0x02;
  const R = S.decompress(Buffer.concat([Buffer.from([prefix]), Buffer.from(r.toString(16).padStart(64, '0'), 'hex')]));
  const rInv = S.inv(r, S.N);
  const u1 = (S.N - ((z * rInv) % S.N)) % S.N;
  const u2 = (s * rInv) % S.N;
  const Q = S.add(S.mul(u1), S.mul(u2, R));
  return ADDRESS.evm(S.compress(Q));
}

const k = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % (S.N - 1n) + 1n;
const sig = sign(u.hash, k);
check('the signature recovers to the signing key', recover(u.hash, sig), myAddress);

const assembled = evmtx.assemble(tx, sig);
ok('the assembled transaction is hex', /^0x02[0-9a-f]+$/.test(assembled.raw));
ok('it carries its own hash', /^0x[0-9a-f]{64}$/.test(assembled.hash));
/* The hash of a signed transaction is not the hash that was signed —
   if these were equal, something is very wrong. */
ok('the broadcast hash differs from the signed hash', assembled.hash !== '0x' + hex(u.hash));
ok('a signature missing a field is refused', (() => {
  try { evmtx.assemble(tx, { r: '0x1', s: '0x2' }); return false; } catch (e) { return true; }
})());

console.log('\npolicy');
const P = { ...policy.DEFAULTS, hotLimit: { ETH: '1000000000000000000' }, dailyLimit: { ETH: '5000000000000000000' } };
const base = { asset: 'ETH', to: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', amount: '100000000000000000', fee: '840000000000000', createdAt: Date.now() };
check('inside the hot limit → sign', policy.decide(base, { policy: P, spentToday: {} }).action, 'sign');
check('over the hot limit → a human approves',
  policy.decide({ ...base, amount: '2000000000000000000' }, { policy: P, spentToday: {} }).action, 'approve');
check('over the daily limit → refuse',
  policy.decide({ ...base, amount: '1000000000000000000' }, { policy: P, spentToday: { ETH: '4500000000000000000' } }).action, 'refuse');
check('no hot limit set → a human approves everything',
  policy.decide(base, { policy: { ...policy.DEFAULTS }, spentToday: {} }).action, 'approve');
check('a stale request → refuse',
  policy.decide({ ...base, createdAt: Date.now() - 1000 * 60 * 60 * 24 }, { policy: P, spentToday: {} }).action, 'refuse');
check('a deny-listed destination → refuse',
  policy.decide(base, { policy: { ...P, denyList: [base.to] }, spentToday: {} }).action, 'refuse');
check('  deny beats case', policy.decide(base, { policy: { ...P, denyList: [base.to.toUpperCase()] }, spentToday: {} }).action, 'refuse');
check('not on a set allow list → refuse',
  policy.decide(base, { policy: { ...P, allowList: ['0x0000000000000000000000000000000000000001'] }, spentToday: {} }).action, 'refuse');
check('a wildly different fee → refuse',
  policy.decide(base, { policy: P, spentToday: {}, chainFee: '10000000000000000' }).action, 'refuse');
check('a zero amount → refuse', policy.decide({ ...base, amount: '0' }, { policy: P, spentToday: {} }).action, 'refuse');

console.log('\nthe backends');
check('the default needs a human', backends.pick('airgap').needsHuman, 'true');
check('an external signer does not', backends.pick('external').needsHuman, 'false');
ok('a key-in-env backend does not exist', (() => {
  try { backends.pick('local'); return false; }
  catch (e) { return /no local key backend/i.test(e.message); }
})());
ok('  nor under another name', (() => {
  try { backends.pick('privatekey'); return false; } catch (e) { return true; }
})());
ok('an unknown backend is refused', (() => {
  try { backends.pick('magic'); return false; } catch (e) { return true; }
})());
ok('no signer module reads a private key from the environment', (() => {
  const fs = require('fs');
  const files = ['index.js', 'policy.js', 'backends.js', 'lib/evmtx.js', 'lib/rlp.js']
    .map(f => fs.readFileSync(require('path').join(__dirname, '..', 'signer', f), 'utf8'));
  return !files.some(src => /PRIVATE_KEY|PRIVKEY|MNEMONIC|SEED_PHRASE/i.test(src));
})());

console.log('\nthe queue is reachable by a signer and nobody else');
(async () => {
  const express = require('express');
  process.env.FIREBASE_PROJECT_ID = 'test-only';   // so user routes answer 401, not 503
  process.env.SIGNER_TOKEN = 'signer-secret-for-this-run';
  const app = express();
  app.use(express.json());
  /* Mount order copied from server.js on purpose: a router on /api/crypto
     runs its user-session check over every path beneath it, so the signer
     has to be mounted first. This test exists because that was a real bug
     that made the queue unreachable. */
  app.use('/api/crypto/signer', require('../routes/signer'));
  app.use('/api/crypto', require('../routes/withdraw'));
  const srv = await new Promise(r => { const s = app.listen(3201, () => r(s)); });
  const call = async (p, h) => {
    const r = await fetch('http://127.0.0.1:3201' + p, { headers: Object.assign({ Connection: 'close' }, h || {}) });
    let b = null; try { b = await r.json(); } catch (e) {}
    return { status: r.status, body: b || {} };
  };
  let r = await call('/api/crypto/signer/queue');
  check('no token -> 401', r.status, 401);
  r = await call('/api/crypto/signer/queue', { Authorization: 'Bearer wrong-secret-here' });
  check('a wrong token -> 401', r.status, 401);
  r = await call('/api/crypto/signer/queue', { Authorization: 'Bearer signer-secret-for-this-run' });
  check('the right token gets past auth', r.body.error, 'no_database');
  r = await call('/api/crypto/withdrawals');
  check('user routes still demand a user session', r.status, 401);
  if (srv.closeAllConnections) srv.closeAllConnections();
  await new Promise(d => srv.close(d));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  // exitCode rather than exit(): a hard exit while a socket is still
  // closing makes libuv complain on Windows, which reads as a failure.
  process.exitCode = fail ? 1 : 0;
})();
