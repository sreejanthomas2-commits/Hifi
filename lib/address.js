/* ╔══════════════════════════════════════════════════════════════════╗
   ║  ADDRESS VALIDATION — server side, and authoritative              ║
   ║                                                                   ║
   ║  The browser checks an address so the user gets a red line as     ║
   ║  they type. That check means nothing: it runs on the attacker's   ║
   ║  machine. Every withdrawal is validated again here, and this is   ║
   ║  the answer that decides whether anything moves.                  ║
   ║                                                                   ║
   ║  What "valid" means, precisely: the string is well formed for     ║
   ║  that network and its checksum holds. No checksum can tell you    ║
   ║  the address belongs to who you think, or that the receiving      ║
   ║  exchange supports that chain — those stay the user's to confirm, ║
   ║  which is why the UI says so rather than implying safety it       ║
   ║  cannot verify.                                                   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const { keccak256, sha256, b58decode, convertBits } = require('./crypto');

/* ── bech32 / bech32m decode (BIP-173, BIP-350) ─────────────────────
   Encoding lives in lib/crypto for making addresses; decoding lives
   here because only validation needs it. */
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

function bech32Decode(str) {
  const s = String(str);
  if (s.length < 8 || s.length > 90) return null;
  const lower = s.toLowerCase(), upper = s.toUpperCase();
  if (s !== lower && s !== upper) return null;        // mixed case is invalid
  const pos = lower.lastIndexOf('1');
  if (pos < 1 || pos + 7 > lower.length) return null;
  const hrp = lower.slice(0, pos);
  const data = [];
  for (const ch of lower.slice(pos + 1)) {
    const i = CHARSET.indexOf(ch);
    if (i < 0) return null;
    data.push(i);
  }
  const chk = polymod(hrpExpand(hrp).concat(data));
  const spec = chk === 1 ? 'bech32' : chk === 0x2bc830a3 ? 'bech32m' : null;
  if (!spec) return null;
  return { hrp, data: data.slice(0, -6), spec };
}

function segwitDecode(hrp, address) {
  const dec = bech32Decode(address);
  if (!dec || dec.hrp !== hrp || !dec.data.length) return null;
  const version = dec.data[0];
  if (version > 16) return null;
  if (version === 0 && dec.spec !== 'bech32') return null;    // v0 must be bech32
  if (version > 0 && dec.spec !== 'bech32m') return null;      // v1+ must be bech32m
  let program;
  try { program = convertBits(dec.data.slice(1), 5, 8, false); }
  catch (e) { return null; }
  if (program.length < 2 || program.length > 40) return null;
  if (version === 0 && program.length !== 20 && program.length !== 32) return null;
  return { version, program: Buffer.from(program) };
}

/* ── base58check ─────────────────────────────────────────────────── */
function b58check(address) {
  let all;
  try { all = b58decode(address); } catch (e) { return null; }
  if (all.length !== 25) return null;
  const payload = all.slice(0, 21);
  const want = sha256(sha256(payload)).slice(0, 4);
  return want.equals(all.slice(21)) ? payload : null;
}

/* ── Per-family checks ───────────────────────────────────────────── */
const EVM_RE = /^0x[0-9a-fA-F]{40}$/;

/* EIP-55: a mixed-case address carries a checksum, and a wrong one is a
   typo rather than a different wallet. All-lower or all-upper is legal
   and carries no checksum, so it is accepted with a note. */
function checkEvm(address) {
  if (!EVM_RE.test(address)) return { ok: false, reason: 'An address on this network is 0x followed by 40 hex characters.' };
  const body = address.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) {
    return { ok: true, checksum: false, normalized: toChecksum(address) };
  }
  const want = toChecksum(address);
  if (want !== address) {
    return { ok: false, reason: 'That address fails its checksum — one character is wrong. Copy it again from the receiving wallet.' };
  }
  return { ok: true, checksum: true, normalized: address };
}
function toChecksum(address) {
  const raw = address.slice(2).toLowerCase();
  const sum = keccak256(Buffer.from(raw, 'ascii')).toString('hex');
  let out = '';
  for (let i = 0; i < raw.length; i++) out += parseInt(sum[i], 16) >= 8 ? raw[i].toUpperCase() : raw[i];
  return '0x' + out;
}

function checkBitcoin(address, testnet) {
  const hrp = testnet ? 'tb' : 'bc';
  if (address.toLowerCase().startsWith(hrp + '1')) {
    const seg = segwitDecode(hrp, address);
    return seg
      ? { ok: true, checksum: true, normalized: address.toLowerCase(), kind: seg.version === 0 ? (seg.program.length === 20 ? 'p2wpkh' : 'p2wsh') : 'p2tr' }
      : { ok: false, reason: 'That native segwit address fails its checksum.' };
  }
  const payload = b58check(address);
  if (!payload) return { ok: false, reason: 'That does not look like a Bitcoin address, or its checksum is wrong.' };
  const version = payload[0];
  const okVersion = testnet ? [0x6f, 0xc4] : [0x00, 0x05];
  if (okVersion.indexOf(version) === -1) {
    return { ok: false, reason: testnet ? 'That is a mainnet address.' : 'That is not a Bitcoin mainnet address.' };
  }
  return { ok: true, checksum: true, normalized: address, kind: version === 0 || version === 0x6f ? 'p2pkh' : 'p2sh' };
}

/* Tron addresses are base58check over a 0x41-prefixed payload. */
function checkTron(address) {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    return { ok: false, reason: 'A Tron address starts with T and is 34 characters.' };
  }
  const payload = b58check(address);
  if (!payload || payload[0] !== 0x41) {
    return { ok: false, reason: 'That Tron address fails its checksum.' };
  }
  return { ok: true, checksum: true, normalized: address };
}

/* XRP Ledger: base58 over the ripple alphabet, with its own checksum. */
const XRP_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
function checkXrp(address) {
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)) {
    return { ok: false, reason: 'An XRP Ledger address starts with r and is 25–35 characters.' };
  }
  let n = 0n;
  for (const ch of address) {
    const i = XRP_ALPHABET.indexOf(ch);
    if (i < 0) return { ok: false, reason: 'That address contains a character XRP addresses never use.' };
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  /* Each leading 'r' is a zero byte (it is this alphabet's zero digit),
     and the number above cannot carry leading zeros. Every classic
     address starts with one - the 0x00 account type - so dropping it
     made the checksum fail on every valid XRP address there is. */
  let zeros = 0;
  for (const ch of address) { if (ch === 'r') zeros++; else break; }
  const all = Buffer.concat([Buffer.alloc(zeros), Buffer.from(hex === '0' ? '' : hex, 'hex')]);
  if (all.length !== 25) return { ok: false, reason: 'That XRP address fails its checksum.' };
  const payload = all.slice(0, -4);
  const want = sha256(sha256(payload)).slice(0, 4);
  if (!want.equals(all.slice(-4)) || payload[0] !== 0x00) return { ok: false, reason: 'That XRP address fails its checksum.' };
  return { ok: true, checksum: true, normalized: address };
}

/* Solana: 32 raw bytes in base58, no checksum to lean on — so the only
   real check is the length and the alphabet, and the UI must not imply
   more confidence than that. */
function checkSolana(address) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return { ok: false, reason: 'A Solana address is 32–44 base58 characters.' };
  }
  let raw;
  try { raw = b58decode(address); } catch (e) { return { ok: false, reason: 'That is not valid base58.' }; }
  if (raw.length !== 32) return { ok: false, reason: 'A Solana address decodes to 32 bytes; that one does not.' };
  return { ok: true, checksum: false, normalized: address };
}

const FAMILIES = {
  evm: checkEvm,
  bitcoin: a => checkBitcoin(a, false),
  tron: checkTron,
  xrpl: checkXrp,
  solana: checkSolana
};

/* The one call everything else makes. */
function validate(family, address) {
  const a = String(address || '').trim();
  if (!a) return { ok: false, reason: 'Enter the address you are sending to.' };
  /* The secret check comes FIRST. A recovery phrase has spaces in it, and
     answering "that contains a space" would teach someone to strip the
     spaces and try again — the worst possible lesson. */
  if (looksSecret(a)) {
    return { ok: false, secret: true, reason: 'That looks like a recovery phrase or a private key. Never paste one into any app, including this one — it hands over the whole wallet. Nothing was saved.' };
  }
  if (/\s/.test(a)) return { ok: false, reason: 'That address contains a space — it was probably copied with extra text.' };
  const fn = FAMILIES[family];
  if (!fn) return { ok: false, reason: `Addresses on ${family} cannot be checked here yet.` };
  try { return fn(a); }
  catch (e) { return { ok: false, reason: 'That address could not be read.' }; }
}

/* The same refusal the wallet address book keeps: anything shaped like
   key material is rejected before it can be stored, echoed or logged. */
function looksSecret(s) {
  const words = s.trim().split(/\s+/);
  if (words.length >= 12 && words.every(w => /^[a-z]{3,8}$/i.test(w))) return true;
  if (/^(0x)?[0-9a-f]{64}$/i.test(s.trim())) return true;       // raw 32-byte key
  if (/^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(s.trim())) return true;  // WIF
  return false;
}

module.exports = { validate, toChecksum, bech32Decode, segwitDecode, b58check, looksSecret };
