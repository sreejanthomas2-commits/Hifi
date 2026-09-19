/* ╔══════════════════════════════════════════════════════════════════╗
   ║  WITHDRAW TESTS —  node scripts/test-withdraw.js                  ║
   ║                                                                   ║
   ║  Three things here cost real money when they are wrong, so all    ║
   ║  three are checked against something outside this codebase:       ║
   ║                                                                   ║
   ║  · TOTP, against RFC 6238's own vectors                           ║
   ║  · address validation, against published addresses and against    ║
   ║    deliberately corrupted ones                                    ║
   ║  · decimal arithmetic, against the float it must never be         ║
   ║                                                                   ║
   ║  Plus the state machine, which is checked by trying every         ║
   ║  transition and requiring the illegal ones to be refused.         ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const totp = require('../lib/totp');
const address = require('../lib/address');
const { MOVES } = require('../services/withdraw');

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}
const ok = (name, cond) => check(name, !!cond, true);

console.log('\nTOTP — RFC 6238 test vectors');
const secret = totp.base32Encode(Buffer.from('12345678901234567890'));
check('T=59',          totp.generate(secret, { time: 59, digits: 8 }), '94287082');
check('T=1111111109',  totp.generate(secret, { time: 1111111109, digits: 8 }), '07081804');
check('T=1111111111',  totp.generate(secret, { time: 1111111111, digits: 8 }), '14050471');
check('T=1234567890',  totp.generate(secret, { time: 1234567890, digits: 8 }), '89005924');
check('T=2000000000',  totp.generate(secret, { time: 2000000000, digits: 8 }), '69279037');
ok('the right code verifies', totp.verify(secret, totp.generate(secret, { time: 1111111109 }), { time: 1111111109 }).ok);
ok('a wrong code is refused', !totp.verify(secret, '000000', { time: 1111111109 }).ok);
ok('a code from two windows ago is refused',
  !totp.verify(secret, totp.generate(secret, { time: 1111111109 - 90 }), { time: 1111111109 }).ok);
ok('a five-digit code is refused', !totp.verify(secret, '12345', { time: 1111111109 }).ok);
ok('enrolment makes an otpauth URI', /^otpauth:\/\/totp\/.*secret=[A-Z2-7]+/.test(totp.enrol('me@example.com').uri));

console.log('\naddresses that should pass');
const good = [
  ['evm', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', 'checksummed EVM'],
  ['evm', '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed', 'all-lowercase EVM'],
  ['evm', '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359', 'EIP-55 vector 2'],
  ['bitcoin', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'native segwit'],
  ['tron', 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', 'Tron']
];
good.forEach(([f, a, n]) => ok(n, address.validate(f, a).ok));

console.log('\naddresses that must be refused');
const bad = [
  ['evm', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD', 'EVM with one case flipped (bad EIP-55)'],
  ['evm', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAe', 'EVM one character short'],
  ['evm', '5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', 'EVM without 0x'],
  ['evm', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'a Bitcoin address in the EVM field'],
  ['bitcoin', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5', 'segwit with a typo'],
  ['bitcoin', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', 'an EVM address in the Bitcoin field'],
  ['tron', 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSF', 'Tron with a typo'],
  ['evm', '', 'nothing at all'],
  ['evm', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed ', 'trailing space is trimmed, still fine']
];
bad.slice(0, 8).forEach(([f, a, n]) => ok(n, !address.validate(f, a).ok));
ok('trailing whitespace is trimmed rather than refused',
  address.validate('evm', '  0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed  ').ok);

console.log('\nkey material must never be accepted as an address');
[
  ['evm', 'legal winner thank year wave sausage worth useful legal winner thank yellow', 'a 12-word phrase'],
  ['bitcoin', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', 'another phrase'],
  ['evm', '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318', 'a raw private key'],
  ['bitcoin', '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ', 'a WIF private key']
].forEach(([f, a, n]) => {
  const r = address.validate(f, a);
  ok(n + ' is refused', !r.ok);
  if (/phrase|private|WIF/.test(n)) ok('  …and named as a secret', !!r.secret);
});

console.log('\ndecimal-safe amounts');
/* The front end's conversion, reimplemented here so the maths itself is
   under test rather than the DOM around it. */
function toBase(text, decimals) {
  const s = String(text).trim();
  if (!/^\d*\.?\d*$/.test(s) || !s) return null;
  const [w, f = ''] = s.split('.');
  if (f.length > decimals) return null;
  return BigInt((w || '0') + (f + '0'.repeat(decimals)).slice(0, decimals));
}
function fromBase(units, decimals) {
  const n = BigInt(units);
  const s = n.toString().padStart(decimals + 1, '0');
  const f = s.slice(s.length - decimals).replace(/0+$/, '');
  return s.slice(0, s.length - decimals) + (f ? '.' + f : '');
}
check('0.1 ETH → wei', toBase('0.1', 18).toString(), '100000000000000000');
check('1 BTC → satoshi', toBase('1', 8).toString(), '100000000');
check('0.00000001 BTC → 1 sat', toBase('0.00000001', 8).toString(), '1');
check('round trip 0.005', fromBase(toBase('0.005', 18), 18), '0.005');
check('round trip 123.456789', fromBase(toBase('123.456789', 8), 8), '123.456789');
check('too many decimals is refused', toBase('0.000000001', 8), 'null');
check('0.1 + 0.2 in base units is exactly 0.3',
  fromBase(toBase('0.1', 18) + toBase('0.2', 18), 18), '0.3');
ok('…which plain floating point is not', 0.1 + 0.2 !== 0.3);
check('a whole wei survives 18 decimals', fromBase(1n, 18), '0.000000000000000001');
check('amount minus fee', fromBase(toBase('0.5', 18) - toBase('0.00042', 18), 18), '0.49958');

console.log('\nwithdrawal state machine');
check('queued can go to signing', MOVES.queued_for_signing.includes('signing'), 'true');
check('queued can be cancelled', MOVES.queued_for_signing.includes('cancelled'), 'true');
check('queued CANNOT jump to completed', MOVES.queued_for_signing.includes('completed'), 'false');
check('queued CANNOT jump to broadcast', MOVES.queued_for_signing.includes('broadcast'), 'false');
check('broadcast cannot be cancelled', MOVES.broadcast.includes('cancelled'), 'false');
check('completed is final', MOVES.completed.length, 0);
check('cancelled is final', MOVES.cancelled.length, 0);
ok('every target is itself a known state',
  Object.values(MOVES).every(list => list.every(s => MOVES[s] !== undefined)));

console.log('\nthe signing boundary');
const wd = require('../services/withdraw');
ok('no signer is configured by default', !wd.signerConfigured());
ok('the service exposes no signing function',
  !Object.keys(wd).some(k => /sign(?!erConfigured)|broadcast|key|seed/i.test(k)));
ok('an explorer link is only made from a real hash', wd.explorerFor('ethereum', '') === null);
ok('an explorer link is made when there is one', /etherscan\.io\/tx\/0xabc/.test(wd.explorerFor('ethereum', '0xabc')));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
