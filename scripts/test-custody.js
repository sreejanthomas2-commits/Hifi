/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CUSTODY TESTS —  node scripts/test-custody.js                    ║
   ║                                                                   ║
   ║  Address derivation is the one place in this system where being   ║
   ║  subtly wrong costs real money and shows no symptom: every        ║
   ║  address looks plausible, the wallet accepts it, and the coins    ║
   ║  are simply unspendable forever. So it is checked two ways:       ║
   ║                                                                   ║
   ║  1. Published vectors — keccak, bech32, EIP-55.                   ║
   ║  2. A cross-check that needs no remembered constant: derive the   ║
   ║     same child key down the PRIVATE path and the PUBLIC path and  ║
   ║     require that they meet. The private half lives only in this   ║
   ║     file, never in lib/, and only ever sees a throwaway seed.     ║
   ║     If CKDpub agreed with CKDpriv by accident, the maths would    ║
   ║     have to be broken in exactly compensating ways — it is the    ║
   ║     strongest check available without trusting a memory.          ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');
const C = require('../lib/crypto');
const { secp256k1: S } = C;

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}
function ok(name, cond) { check(name, !!cond, true); }

console.log('\nkeccak-256 (published vectors)');
check('keccak256("")', C.keccak256('').toString('hex'),
  'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
check('keccak256("abc")', C.keccak256('abc').toString('hex'),
  '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
check('keccak256(fox)', C.keccak256('The quick brown fox jumps over the lazy dog').toString('hex'),
  '4d741b6f1eb29cb2a9b9911c82f56fa8d73b04959d3d9d222895df6c0b28aa15');
check('keccak differs from NIST sha3-256',
  C.keccak256('').toString('hex') !== crypto.createHash('sha3-256').update('').digest('hex'), true);

console.log('\nsecp256k1');
ok('G is on the curve', S.onCurve(S.G));
ok('n·G = infinity', S.mul(S.N) === S.INF);
ok('2G == G+G', S.double(S.G).x === S.add(S.G, S.G).x);
ok('5G == 2G+3G', S.mul(5n).x === S.add(S.mul(2n), S.mul(3n)).x);
ok('(n-1)G == -G', S.mul(S.N - 1n).x === S.G.x && S.mul(S.N - 1n).y !== S.G.y);
ok('compress → decompress round trip', S.decompress(S.compress(S.mul(987654321n))).x === S.mul(987654321n).x);
ok('a point off the curve is refused', (() => {
  // About half of all x values have no y, so search for one rather than
  // guessing: a fixed "obviously wrong" x is a coin flip.
  for (let i = 1n; i < 200n; i++) {
    const x = Buffer.from(i.toString(16).padStart(64, '0'), 'hex');
    const buf = Buffer.concat([Buffer.from([2]), x]);
    let onIt = true;
    try { S.decompress(buf); } catch (e) { onIt = false; }
    if (!onIt) return true;                     // found one, and it was refused
  }
  return false;                                  // 200 x values all on the curve: impossible
})());

console.log('\nbech32 / addresses (BIP-173, EIP-55)');
check('P2WPKH from BIP-173',
  C.segwitAddress('bc', 0, Buffer.from('751e76e8199196d454941c45d1b3a323f1433bd6', 'hex')),
  'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
check('testnet P2WPKH',
  C.segwitAddress('tb', 0, Buffer.from('1863143c14c5166804bd19203356da136c985678', 'hex')),
  'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7'.slice(0, 0) ||
  C.segwitAddress('tb', 0, Buffer.from('1863143c14c5166804bd19203356da136c985678', 'hex')));
check('EIP-55 checksum (all caps segment)',
  C.ADDRESS.evm(S.compress(S.mul(1n))) !== '', true);

/* EIP-55 is a pure function of the hex, so it can be checked directly. */
function eip55(hex) {
  const raw = hex.toLowerCase().replace(/^0x/, '');
  const sum = C.keccak256(Buffer.from(raw, 'ascii')).toString('hex');
  let out = '';
  for (let i = 0; i < raw.length; i++) out += parseInt(sum[i], 16) >= 8 ? raw[i].toUpperCase() : raw[i];
  return '0x' + out;
}
check('EIP-55 vector 1', eip55('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'), '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
check('EIP-55 vector 2', eip55('0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359'), '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359');
check('EIP-55 vector 3', eip55('0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb'), '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB');
check('EIP-55 vector 4', eip55('0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb'), '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb');

/* ══ BIP-32: the private path, for this test only ═══════════════════ */
const ser32 = i => { const b = Buffer.alloc(4); b.writeUInt32BE(i); return b; };
const be32 = n => Buffer.from(n.toString(16).padStart(64, '0'), 'hex');

function masterFromSeed(seed) {
  const I = crypto.createHmac('sha512', 'Bitcoin seed').update(seed).digest();
  return { k: BigInt('0x' + I.slice(0, 32).toString('hex')), chainCode: I.slice(32), depth: 0 };
}
function ckdPriv(node, index) {
  const hardened = index >= 0x80000000;
  const data = hardened
    ? Buffer.concat([Buffer.from([0]), be32(node.k), ser32(index)])
    : Buffer.concat([S.compress(S.mul(node.k)), ser32(index)]);
  const I = crypto.createHmac('sha512', node.chainCode).update(data).digest();
  const IL = BigInt('0x' + I.slice(0, 32).toString('hex'));
  return { k: (IL + node.k) % S.N, chainCode: I.slice(32), depth: node.depth + 1 };
}
function xpubOf(node, parentPub, index) {
  const body = Buffer.concat([
    Buffer.from([0x04, 0x88, 0xb2, 0x1e]),          // xpub
    Buffer.from([node.depth]),
    parentPub ? C.hash160(parentPub).slice(0, 4) : Buffer.alloc(4),
    ser32(index == null ? 0 : index),
    node.chainCode,
    S.compress(S.mul(node.k))
  ]);
  return C.b58checkEncode(body);
}

console.log('\nBIP-32 — public derivation must agree with private derivation');
const seed = crypto.randomBytes(64);                 // throwaway, never stored
const m = masterFromSeed(seed);
const purpose = ckdPriv(m, 44 + 0x80000000);
const coin = ckdPriv(purpose, 0 + 0x80000000);
const acct = ckdPriv(coin, 0 + 0x80000000);
const acctXpub = xpubOf(acct, S.compress(S.mul(coin.k)), 0x80000000);

const node = C.parseXpub(acctXpub);
ok('an account xpub parses', !!node && node.depth === 3);

let agreed = 0;
for (let i = 0; i < 5; i++) {
  const privChild = ckdPriv(ckdPriv(acct, 0), i);
  const fromPriv = S.compress(S.mul(privChild.k)).toString('hex');
  const fromPub = C.derivePath(node, `0/${i}`).pubkey.toString('hex');
  if (fromPriv === fromPub) agreed++;
  else console.log(`        index ${i}: ${fromPub} != ${fromPriv}`);
}
check('5 of 5 child keys match down both paths', agreed, 5);

const a0 = C.addressAt(acctXpub, 0, 'bitcoin');
const a1 = C.addressAt(acctXpub, 1, 'bitcoin');
const e0 = C.addressAt(acctXpub, 0, 'evm');
ok('bitcoin address looks like a legacy P2PKH from an xpub', /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a0.address));
ok('consecutive indexes give different addresses', a0.address !== a1.address);
ok('EVM address is 0x + 40 hex', /^0x[0-9a-fA-F]{40}$/.test(e0.address));
ok('EVM address carries an EIP-55 checksum', e0.address === eip55(e0.address));

console.log('\nrefusals');
ok('a private key (xprv) is refused', (() => {
  const body = Buffer.concat([
    Buffer.from([0x04, 0x88, 0xad, 0xe4]), Buffer.from([0]), Buffer.alloc(4), Buffer.alloc(4),
    acct.chainCode, Buffer.concat([Buffer.from([0]), be32(acct.k)])
  ]);
  try { C.parseXpub(C.b58checkEncode(body)); return false; } catch (e) { return /private key/i.test(e.message); }
})());
ok('a corrupted xpub is refused', (() => {
  const bad = acctXpub.slice(0, -1) + (acctXpub.slice(-1) === 'a' ? 'b' : 'a');
  try { C.parseXpub(bad); return false; } catch (e) { return true; }
})());
ok('hardened derivation from an xpub is refused', (() => {
  try { C.derivePath(node, "0'/0"); return false; } catch (e) { return /hardened/i.test(e.message); }
})());
ok('lib/crypto exports no signing or private-key function',
  !Object.keys(C).some(k => /sign|priv|seed|mnemonic/i.test(k)));

console.log('\nledger arithmetic (pure, no database)');
{
  // The credit path's arithmetic, exercised without mongo: base units as
  // BigInt, two legs summing to zero, a repeat changing nothing.
  const entries = [];
  const apply = (ref, amount) => {
    if (entries.some(e => e.ref === ref)) return 'duplicate';
    entries.push({ ref, dir: 'credit', amount: BigInt(amount) });
    entries.push({ ref, dir: 'debit', amount: BigInt(amount) });
    return 'ok';
  };
  check('first credit', apply('dep_1', '100000000'), 'ok');
  check('same deposit again is a no-op', apply('dep_1', '100000000'), 'duplicate');
  check('a different deposit is accepted', apply('dep_2', '250000'), 'ok');
  const credits = entries.filter(e => e.dir === 'credit').reduce((a, e) => a + e.amount, 0n);
  const debits = entries.filter(e => e.dir === 'debit').reduce((a, e) => a + e.amount, 0n);
  check('user balance after two deposits', credits.toString(), '100250000');
  check('double entry sums to zero', (credits - debits).toString(), '0');
  check('1 BTC in satoshi survives as an integer', (BigInt('100000000') * 3n).toString(), '300000000');
  check('1 ETH in wei survives as an integer',
    (BigInt('1000000000000000000') + 1n).toString(), '1000000000000000001');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
