/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CRYPTO PRIMITIVES for watch-only address derivation              ║
   ║                                                                   ║
   ║  Everything here works on PUBLIC keys only. There is no private   ║
   ║  key path, no signing, no seed handling — by construction, not    ║
   ║  by policy. The worst an attacker who owns this process can do    ║
   ║  is learn which addresses belong to which user; they cannot move  ║
   ║  a single satoshi, because the material that would let them do    ║
   ║  that never reaches this machine.                                 ║
   ║                                                                   ║
   ║  Written against Node's own crypto rather than pulled from npm:   ║
   ║  four hundred lines that can be read in an afternoon, checked     ║
   ║  against published test vectors (scripts/test-custody.js), and    ║
   ║  that cannot be swapped underneath you by a compromised package.  ║
   ║                                                                   ║
   ║    secp256k1   point maths, enough for BIP-32 CKDpub              ║
   ║    keccak256   Ethereum's hash (NOT Node's sha3-256 — different   ║
   ║                padding, different answer)                         ║
   ║    base58check xpub parsing, legacy addresses                     ║
   ║    bech32      native segwit addresses (BIP-173)                  ║
   ║    bip32       xpub → child public key → address                  ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');

/* ══ secp256k1 ══════════════════════════════════════════════════════ */
const P = 2n ** 256n - 2n ** 32n - 977n;
const N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n;
const Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n;
const G = { x: Gx, y: Gy };
const INF = null;                                   // the point at infinity

const mod = (a, m = P) => ((a % m) + m) % m;

/* Modular inverse by the extended Euclidean algorithm. */
function inv(a, m = P) {
  let [old_r, r] = [mod(a, m), m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1n) throw new Error('not invertible');
  return mod(old_s, m);
}

function add(p, q) {
  if (p === INF) return q;
  if (q === INF) return p;
  if (p.x === q.x) {
    if (mod(p.y + q.y) === 0n) return INF;          // p == -q
    return double(p);
  }
  const l = mod((q.y - p.y) * inv(q.x - p.x));
  const x = mod(l * l - p.x - q.x);
  return { x, y: mod(l * (p.x - x) - p.y) };
}

function double(p) {
  if (p === INF || p.y === 0n) return INF;
  const l = mod(3n * p.x * p.x * inv(2n * p.y));
  const x = mod(l * l - 2n * p.x);
  return { x, y: mod(l * (p.x - x) - p.y) };
}

function mul(k, p = G) {
  let n = mod(k, N);
  if (n === 0n) return INF;
  let r = INF, q = p;
  while (n > 0n) {
    if (n & 1n) r = add(r, q);
    q = double(q);
    n >>= 1n;
  }
  return r;
}

const onCurve = p => p !== INF && mod(p.y * p.y - p.x * p.x * p.x - 7n) === 0n;

const be32 = n => Buffer.from(n.toString(16).padStart(64, '0'), 'hex');

function compress(p) {
  if (p === INF) throw new Error('point at infinity');
  return Buffer.concat([Buffer.from([p.y & 1n ? 0x03 : 0x02]), be32(p.x)]);
}

const uncompressed = p => Buffer.concat([be32(p.x), be32(p.y)]);   // 64 bytes, no 0x04 prefix

/* Recover y from x: y² = x³ + 7, and p ≡ 3 (mod 4) makes the square
   root a single exponentiation. */
function decompress(buf) {
  if (buf.length !== 33 || (buf[0] !== 2 && buf[0] !== 3)) throw new Error('bad compressed point');
  const x = BigInt('0x' + buf.slice(1).toString('hex'));
  if (x >= P) throw new Error('x out of range');
  const y2 = mod(x * x * x + 7n);
  let y = powmod(y2, (P + 1n) / 4n, P);
  if (mod(y * y) !== y2) throw new Error('not on curve');
  if ((y & 1n) !== BigInt(buf[0] & 1)) y = mod(-y);
  return { x, y };
}

function powmod(b, e, m) {
  let r = 1n; b = mod(b, m);
  while (e > 0n) {
    if (e & 1n) r = mod(r * b, m);
    b = mod(b * b, m);
    e >>= 1n;
  }
  return r;
}

/* ══ Keccak-256 ═════════════════════════════════════════════════════
   Ethereum uses original Keccak (pad 0x01), not the NIST SHA-3 that
   Node ships (pad 0x06). They differ for every input, so this is not
   somewhere to save a hundred lines by calling sha3-256.            */
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
];
const ROT = [
  [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]
];
const M64 = (1n << 64n) - 1n;
const rotl = (x, n) => n === 0n ? x : ((x << n) | (x >> (64n - n))) & M64;

function keccakF(A) {
  for (let round = 0; round < 24; round++) {
    const C = [];
    for (let x = 0; x < 5; x++) C[x] = A[x][0] ^ A[x][1] ^ A[x][2] ^ A[x][3] ^ A[x][4];
    const D = [];
    for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1n);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x][y] ^= D[x];

    const B = [[], [], [], [], []];
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      B[y][(2 * x + 3 * y) % 5] = rotl(A[x][y], BigInt(ROT[x][y]));
    }
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      A[x][y] = B[x][y] ^ ((~B[(x + 1) % 5][y] & M64) & B[(x + 2) % 5][y]);
    }
    A[0][0] ^= RC[round];
  }
  return A;
}

function keccak256(data) {
  const rate = 136;                                  // 1088 bits
  const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const padLen = rate - (input.length % rate);
  const padded = Buffer.concat([input, Buffer.alloc(padLen)]);
  padded[input.length] |= 0x01;                      // Keccak padding
  padded[padded.length - 1] |= 0x80;

  const A = [[], [], [], [], []];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x][y] = 0n;

  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      const lane = padded.readBigUInt64LE(off + i * 8);
      A[i % 5][Math.floor(i / 5)] ^= lane;
    }
    keccakF(A);
  }

  const out = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) out.writeBigUInt64LE(A[i % 5][Math.floor(i / 5)], i * 8);
  return out;
}

/* ══ Hashes used by address formats ════════════════════════════════ */
const sha256 = b => crypto.createHash('sha256').update(b).digest();
const ripemd160 = b => crypto.createHash('ripemd160').update(b).digest();
const hash160 = b => ripemd160(sha256(b));

/* ══ base58check ════════════════════════════════════════════════════ */
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58encode(buf) {
  let n = BigInt('0x' + (buf.toString('hex') || '0'));
  let out = '';
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const b of buf) { if (b === 0) out = '1' + out; else break; }
  return out;
}

function b58decode(str) {
  let n = 0n;
  for (const ch of str) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error('bad base58 character');
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  let body = Buffer.from(hex === '0' ? '' : hex, 'hex');
  let zeros = 0;
  for (const ch of str) { if (ch === '1') zeros++; else break; }
  return Buffer.concat([Buffer.alloc(zeros), body]);
}

function b58checkEncode(payload) {
  const sum = sha256(sha256(payload)).slice(0, 4);
  return b58encode(Buffer.concat([payload, sum]));
}

function b58checkDecode(str) {
  const all = b58decode(str);
  if (all.length < 5) throw new Error('too short');
  const payload = all.slice(0, -4);
  const sum = all.slice(-4);
  const want = sha256(sha256(payload)).slice(0, 4);
  if (!sum.equals(want)) throw new Error('checksum failed');
  return payload;
}

/* ══ bech32 / bech32m (BIP-173, BIP-350) ═══════════════════════════ */
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values) {
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}
const hrpExpand = hrp => [...hrp].map(c => c.charCodeAt(0) >> 5)
  .concat([0], [...hrp].map(c => c.charCodeAt(0) & 31));

function convertBits(data, from, to, pad) {
  let acc = 0, bits = 0;
  const out = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    if (value < 0 || value >> from) throw new Error('bad value');
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) { bits -= to; out.push((acc >> bits) & maxv); }
  }
  if (pad) { if (bits) out.push((acc << (to - bits)) & maxv); }
  else if (bits >= from || ((acc << (to - bits)) & maxv)) throw new Error('bad padding');
  return out;
}

function bech32Encode(hrp, data, spec) {
  const const_ = spec === 'bech32m' ? 0x2bc830a3 : 1;
  const values = hrpExpand(hrp).concat(data);
  const pm = polymod(values.concat([0, 0, 0, 0, 0, 0])) ^ const_;
  const checksum = [];
  for (let i = 0; i < 6; i++) checksum.push((pm >> (5 * (5 - i))) & 31);
  return hrp + '1' + data.concat(checksum).map(d => CHARSET[d]).join('');
}

/* witness v0 is bech32, v1+ is bech32m */
function segwitAddress(hrp, version, program) {
  const data = [version].concat(convertBits([...program], 8, 5, true));
  return bech32Encode(hrp, data, version === 0 ? 'bech32' : 'bech32m');
}

/* ══ Address formats ════════════════════════════════════════════════ */
const ADDRESS = {
  /* Native segwit, the default for new Bitcoin wallets (BIP-84). */
  p2wpkh(pubkey, hrp = 'bc') { return segwitAddress(hrp, 0, hash160(pubkey)); },
  /* Legacy, still used by some senders. */
  p2pkh(pubkey, version = 0x00) {
    return b58checkEncode(Buffer.concat([Buffer.from([version]), hash160(pubkey)]));
  },
  /* Ethereum and every EVM chain: last 20 bytes of keccak(pubkey), with
     the EIP-55 mixed-case checksum so a typo is caught by the sender. */
  evm(pubkeyCompressed) {
    const point = decompress(pubkeyCompressed);
    const hash = keccak256(uncompressed(point));
    const raw = hash.slice(12).toString('hex');
    const sum = keccak256(Buffer.from(raw, 'ascii')).toString('hex');
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      out += parseInt(sum[i], 16) >= 8 ? raw[i].toUpperCase() : raw[i];
    }
    return '0x' + out;
  }
};

/* ══ BIP-32 watch-only derivation ══════════════════════════════════ */
/* Version bytes decide how a wallet displays an address, not how the
   key works: an xpub, ypub and zpub over the same account derive the
   same public keys. The script type is taken from the prefix so an
   operator who pastes a zpub gets the bech32 addresses their wallet
   shows them, rather than legacy ones that look wrong. */
const XPUB_VERSIONS = {
  0x0488b21e: { net: 'mainnet', script: 'p2pkh' },   // xpub
  0x049d7cb2: { net: 'mainnet', script: 'p2wpkh' },  // ypub (p2sh-wrapped; addresses derived as native below)
  0x04b24746: { net: 'mainnet', script: 'p2wpkh' },  // zpub
  0x043587cf: { net: 'testnet', script: 'p2pkh' },   // tpub
  0x045f1cf6: { net: 'testnet', script: 'p2wpkh' },  // upub
  0x044a5262: { net: 'testnet', script: 'p2wpkh' }   // vpub
};

/* Private-key versions are listed so that pasting one gets the loud,
   specific refusal rather than a puzzled "unknown version". An operator
   who reaches for the wrong string must be told exactly what they did. */
const XPRV_VERSIONS = {
  0x0488ade4: 'xprv', 0x049d7878: 'yprv', 0x04b2430c: 'zprv',
  0x04358394: 'tprv', 0x044a4e28: 'vprv', 0x045f18bc: 'uprv'
};

function parseXpub(str) {
  const raw = b58checkDecode(String(str).trim());
  if (raw.length !== 78) throw new Error('an extended key is 78 bytes');
  const version = raw.readUInt32BE(0);
  if (XPRV_VERSIONS[version]) {
    throw new Error(`that is an ${XPRV_VERSIONS[version]} — a PRIVATE key. Never give a server a private key. Export the public one (xpub/zpub) from the same wallet instead.`);
  }
  const meta = XPUB_VERSIONS[version];
  if (!meta) throw new Error('unknown extended key version — is this a public key (xpub/ypub/zpub)?');
  const key = raw.slice(45, 78);
  if (key[0] !== 0x02 && key[0] !== 0x03) {
    throw new Error('that is a PRIVATE key. Never give a server a private key — paste the xpub/zpub instead.');
  }
  const point = decompress(key);                     // throws if it is not on the curve
  if (!onCurve(point)) throw new Error('key is not on the curve');
  return {
    version, net: meta.net, script: meta.script,
    depth: raw[4], fingerprint: raw.slice(5, 9), index: raw.readUInt32BE(9),
    chainCode: raw.slice(13, 45), pubkey: key, point
  };
}

/* CKDpub — child public key from a parent public key. Hardened indices
   are impossible here by design: they need the private key, which is
   exactly what this machine must not have. */
function ckdPub(node, index) {
  if (index >= 0x80000000) throw new Error('hardened derivation needs a private key');
  const data = Buffer.concat([node.pubkey, Buffer.alloc(4)]);
  data.writeUInt32BE(index, 33);
  const I = crypto.createHmac('sha512', node.chainCode).update(data).digest();
  const IL = BigInt('0x' + I.slice(0, 32).toString('hex'));
  if (IL >= N) throw new Error('derivation index unusable — try the next one');
  const child = add(mul(IL), node.point);
  if (child === INF) throw new Error('derivation index unusable — try the next one');
  return {
    version: node.version, net: node.net, script: node.script,
    depth: node.depth + 1, fingerprint: hash160(node.pubkey).slice(0, 4),
    index, chainCode: I.slice(32), pubkey: compress(child), point: child
  };
}

function derivePath(node, path) {
  return String(path).split('/').filter(s => s && s !== 'm')
    .reduce((acc, seg) => {
      if (/'|h$/i.test(seg)) throw new Error('hardened steps are not possible from an xpub');
      return ckdPub(acc, parseInt(seg, 10));
    }, node);
}

/* The one call the rest of the system makes: give me address number `i`
   for this account xpub, on this chain. */
function addressAt(xpub, index, family, opts) {
  const o = opts || {};
  const node = typeof xpub === 'string' ? parseXpub(xpub) : xpub;
  const child = derivePath(node, `${o.change == null ? 0 : o.change}/${index}`);
  if (family === 'evm') return { address: ADDRESS.evm(child.pubkey), pubkey: child.pubkey.toString('hex') };
  if (family === 'bitcoin') {
    const hrp = node.net === 'testnet' ? 'tb' : 'bc';
    const address = node.script === 'p2wpkh' || o.script === 'p2wpkh'
      ? ADDRESS.p2wpkh(child.pubkey, hrp)
      : ADDRESS.p2pkh(child.pubkey, node.net === 'testnet' ? 0x6f : 0x00);
    return { address, pubkey: child.pubkey.toString('hex') };
  }
  throw new Error(`no derivation implemented for ${family}`);
}

module.exports = {
  secp256k1: { P, N, G, add, double, mul, inv, compress, decompress, uncompressed, onCurve, INF },
  keccak256, sha256, ripemd160, hash160,
  b58encode, b58decode, b58checkEncode, b58checkDecode,
  bech32Encode, segwitAddress, convertBits,
  ADDRESS, parseXpub, ckdPub, derivePath, addressAt
};
