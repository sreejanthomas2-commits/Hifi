/* ╔══════════════════════════════════════════════════════════════════╗
   ║  ADDRCHECK — does this address's own checksum hold?               ║
   ║                                                                   ║
   ║  Most address formats carry a checksum so that one mistyped or    ║
   ║  misread character is caught before money is sent to an address  ║
   ║  nobody owns. The screens used to check only the SHAPE (right     ║
   ║  prefix, right length, right alphabet), which passes almost every ║
   ║  one-character typo. This file checks the checksum itself:        ║
   ║                                                                   ║
   ║    EVM chains    EIP-55 mixed-case (Keccak-256)                   ║
   ║    Bitcoin       bech32 / bech32m (BIP-173/350), base58check      ║
   ║    Litecoin      bech32 (ltc1), base58check (L, M, 3)             ║
   ║    Dogecoin      base58check (D, A, 9)                            ║
   ║    Bitcoin Cash  CashAddr, and legacy base58check                 ║
   ║    Tron          base58check over 0x41                            ║
   ║    XRP Ledger    base58check, ripple alphabet                     ║
   ║    Stellar       base32 + CRC16                                   ║
   ║    TON           base64 + CRC16 (user-friendly form)              ║
   ║    Cosmos, Cardano  bech32                                        ║
   ║    Tezos         base58check                                      ║
   ║    Solana        base58 that decodes to exactly 32 bytes (no      ║
   ║                  checksum exists, and the result says so)         ║
   ║                                                                   ║
   ║  The rest (Polkadot, Algorand, NEAR, Hedera, Kaspa) are shape-    ║
   ║  checked only, and say so, rather than implying more certainty.   ║
   ║                                                                   ║
   ║  It mirrors lib/address.js on the server, which stays the check   ║
   ║  that decides anything: this one is for telling a person about a  ║
   ║  typo while they can still fix it. scripts/test-send.js holds the ║
   ║  two to the same answers. No dependencies, no network, no keys.   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const ADDR = (() => {

  /* ── Hashes ──────────────────────────────────────────────────────── */
  const K256 = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

  function sha256(bytes) {
    const len = bytes.length;
    const total = ((len + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(total);
    m.set(bytes);
    m[len] = 0x80;
    const bits = len * 8;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 4, bits >>> 0);
    dv.setUint32(total - 8, Math.floor(bits / 0x100000000));
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const W = new Uint32Array(64);
    const r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = r(W[i - 15], 7) ^ r(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = r(W[i - 2], 17) ^ r(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + W[i]) >>> 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    H.forEach((v, i) => ov.setUint32(i * 4, v));
    return out;
  }
  const sha256d = b => sha256(sha256(b));

  /* Keccak-256 as Ethereum uses it (pad 0x01), not SHA3-256 (pad 0x06). */
  const RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n];
  const ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]];
  const M64 = (1n << 64n) - 1n;
  const rotl = (x, n) => (n === 0n ? x : ((x << n) | (x >> (64n - n))) & M64);
  function keccak256(bytes) {
    const rate = 136;
    const padLen = rate - (bytes.length % rate);
    const p = new Uint8Array(bytes.length + padLen);
    p.set(bytes);
    p[bytes.length] |= 0x01;
    p[p.length - 1] |= 0x80;
    const A = [[0n, 0n, 0n, 0n, 0n], [0n, 0n, 0n, 0n, 0n], [0n, 0n, 0n, 0n, 0n], [0n, 0n, 0n, 0n, 0n], [0n, 0n, 0n, 0n, 0n]];
    const lane = (off) => { let v = 0n; for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(p[off + i]); return v; };
    for (let off = 0; off < p.length; off += rate) {
      for (let i = 0; i < rate / 8; i++) A[i % 5][Math.floor(i / 5)] ^= lane(off + i * 8);
      for (let round = 0; round < 24; round++) {
        const C = [0, 1, 2, 3, 4].map(x => A[x][0] ^ A[x][1] ^ A[x][2] ^ A[x][3] ^ A[x][4]);
        const D = [0, 1, 2, 3, 4].map(x => C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1n));
        for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x][y] ^= D[x];
        const B = [[], [], [], [], []];
        for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y][(2 * x + 3 * y) % 5] = rotl(A[x][y], BigInt(ROT[x][y]));
        for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x][y] = B[x][y] ^ ((~B[(x + 1) % 5][y] & M64) & B[(x + 2) % 5][y]);
        A[0][0] ^= RC[round];
      }
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 4; i++) {
      let v = A[i % 5][Math.floor(i / 5)];
      for (let j = 0; j < 8; j++) { out[i * 8 + j] = Number(v & 0xffn); v >>= 8n; }
    }
    return out;
  }

  const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const ascii = s => Uint8Array.from(s, c => c.charCodeAt(0));
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  /* ── base58 (any alphabet), keeping leading zero bytes ──────────── */
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const XRP58 = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
  function b58decode(str, alphabet) {
    const al = alphabet || B58;
    let n = 0n;
    for (const ch of str) {
      const i = al.indexOf(ch);
      if (i < 0) return null;
      n = n * 58n + BigInt(i);
    }
    const bytes = [];
    while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
    let zeros = 0;
    for (const ch of str) { if (ch === al[0]) zeros++; else break; }
    return Uint8Array.from(new Array(zeros).fill(0).concat(bytes));
  }
  // The payload of a base58check string, or null if its 4-byte checksum fails.
  function b58check(str, alphabet) {
    const all = b58decode(str, alphabet);
    if (!all || all.length < 5) return null;
    const payload = all.slice(0, -4);
    return same(sha256d(payload).slice(0, 4), all.slice(-4)) ? payload : null;
  }

  /* ── bech32 / bech32m ────────────────────────────────────────────── */
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  function polymod(values) {
    let chk = 1;
    for (const v of values) {
      const b = chk >>> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ v;
      for (let i = 0; i < 5; i++) if ((b >>> i) & 1) chk ^= GEN[i];
    }
    return chk >>> 0;
  }
  const hrpExpand = h => [...h].map(c => c.charCodeAt(0) >> 5).concat([0], [...h].map(c => c.charCodeAt(0) & 31));
  // maxLen 90 is BIP-173's; Cardano addresses are longer and pass Infinity.
  function bech32Decode(str, maxLen) {
    const s = String(str);
    if (s.length < 8 || s.length > (maxLen || 90)) return null;
    if (s !== s.toLowerCase() && s !== s.toUpperCase()) return null;         // mixed case is invalid
    const low = s.toLowerCase();
    const pos = low.lastIndexOf('1');
    if (pos < 1 || pos + 7 > low.length) return null;
    const hrp = low.slice(0, pos);
    const data = [];
    for (const ch of low.slice(pos + 1)) {
      const i = CHARSET.indexOf(ch);
      if (i < 0) return null;
      data.push(i);
    }
    const c = polymod(hrpExpand(hrp).concat(data));
    const spec = c === 1 ? 'bech32' : c === 0x2bc830a3 ? 'bech32m' : null;
    return spec ? { hrp, data: data.slice(0, -6), spec } : null;
  }
  function convertBits(data, from, to, pad) {
    let acc = 0, bits = 0;
    const out = [], max = (1 << to) - 1;
    for (const v of data) {
      acc = (acc << from) | v; bits += from;
      while (bits >= to) { bits -= to; out.push((acc >> bits) & max); }
    }
    if (pad) { if (bits) out.push((acc << (to - bits)) & max); }
    else if (bits >= from || ((acc << (to - bits)) & max)) return null;
    return out;
  }
  // BIP-173/350 segwit rules: version 0 is bech32 with a 20 or 32 byte program; 1+ is bech32m.
  function segwit(hrp, str) {
    const d = bech32Decode(str);
    if (!d || d.hrp !== hrp || !d.data.length) return null;
    const version = d.data[0];
    if (version > 16) return null;
    if ((version === 0) !== (d.spec === 'bech32')) return null;
    const prog = convertBits(d.data.slice(1), 5, 8, false);
    if (!prog || prog.length < 2 || prog.length > 40) return null;
    if (version === 0 && prog.length !== 20 && prog.length !== 32) return null;
    return { version, length: prog.length };
  }

  /* ── CashAddr (Bitcoin Cash) ─────────────────────────────────────── */
  function cashPolymod(v) {
    let c = 1n;
    for (const d of v) {
      const c0 = c >> 35n;
      c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(d);
      if (c0 & 1n) c ^= 0x98f2bc8e61n;
      if (c0 & 2n) c ^= 0x79b76d99e2n;
      if (c0 & 4n) c ^= 0xf33e5fb3c4n;
      if (c0 & 8n) c ^= 0xae2eabe2a8n;
      if (c0 & 16n) c ^= 0x1e4f43e470n;
    }
    return c ^ 1n;
  }
  function cashaddr(str, prefix) {
    const s = String(str);
    if (s !== s.toLowerCase() && s !== s.toUpperCase()) return false;
    let low = s.toLowerCase();
    if (low.startsWith(prefix + ':')) low = low.slice(prefix.length + 1);
    const data = [];
    for (const ch of low) { const i = CHARSET.indexOf(ch); if (i < 0) return false; data.push(i); }
    const pre = [...prefix].map(c => c.charCodeAt(0) & 31).concat([0]);
    return cashPolymod(pre.concat(data)) === 0n;
  }

  /* ── base32 (RFC 4648) and CRC16-XModem ──────────────────────────── */
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function b32decode(s) {
    let bits = 0, val = 0;
    const out = [];
    for (const ch of s) {
      const i = B32.indexOf(ch);
      if (i < 0) return null;
      val = (val << 5) | i; bits += 5;
      if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    return Uint8Array.from(out);
  }
  function crc16(bytes) {
    let crc = 0;
    for (const b of bytes) {
      crc ^= b << 8;
      for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc;
  }
  function b64decode(s) {
    const t = s.replace(/-/g, '+').replace(/_/g, '/');
    const al = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bits = 0, val = 0;
    const out = [];
    for (const ch of t) {
      if (ch === '=') break;
      const i = al.indexOf(ch);
      if (i < 0) return null;
      val = (val << 6) | i; bits += 6;
      if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    return Uint8Array.from(out);
  }

  /* ── Per-family checks ───────────────────────────────────────────── */
  const ok = (checksum, extra) => ({ ok: true, checksum, ...(extra || {}) });
  const no = reason => ({ ok: false, reason });
  const TYPO = 'fails its checksum, so at least one character is wrong. Copy it again from the receiving wallet or exchange.';

  function toChecksum(address) {
    const raw = address.slice(2).toLowerCase();
    const h = hex(keccak256(ascii(raw)));
    let out = '0x';
    for (let i = 0; i < 40; i++) out += parseInt(h[i], 16) >= 8 ? raw[i].toUpperCase() : raw[i];
    return out;
  }
  const BURN = ['0x0000000000000000000000000000000000000000', '0x000000000000000000000000000000000000dead'];
  function evm(a) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return no('An address on this network is 0x followed by 40 characters (0–9, a–f).');
    if (BURN.indexOf(a.toLowerCase()) > -1) return no('That is a burn address — anything sent there is destroyed and can never be recovered.');
    const body = a.slice(2);
    if (body === body.toLowerCase() || body === body.toUpperCase()) {
      return ok(false, { note: 'This address is all one case, so it carries no checksum — check every character against the receiver.' });
    }
    return toChecksum(a) === a ? ok(true) : no('That address ' + TYPO);
  }

  const DUST = { p2pkh: 546, p2sh: 540, p2wpkh: 294, p2wsh: 330, p2tr: 330 };   // sats, Bitcoin Core's relay defaults
  function utxo(a, o) {
    const low = a.toLowerCase();
    if (o.hrp && low.startsWith(o.hrp + '1')) {
      const s = segwit(o.hrp, a);
      if (!s) return no('That address ' + TYPO);
      const kind = s.version === 0 ? (s.length === 20 ? 'p2wpkh' : 'p2wsh') : s.version === 1 && s.length === 32 ? 'p2tr' : 'segwit';
      return ok(true, { kind, dustSats: DUST[kind] || 330 });
    }
    if (o.testHrp && low.startsWith(o.testHrp + '1')) return no('That is a testnet address. Real coins sent to it are lost.');
    const p = b58check(a);
    if (!p || p.length !== 21) return no('That address ' + TYPO);
    const kind = o.p2pkh.indexOf(p[0]) > -1 ? 'p2pkh' : o.p2sh.indexOf(p[0]) > -1 ? 'p2sh' : '';
    if (!kind) return no(o.testnet && o.testnet.indexOf(p[0]) > -1 ? 'That is a testnet address. Real coins sent to it are lost.' : `That isn't a ${o.name} address.`);
    return ok(true, { kind, dustSats: DUST[kind] });
  }

  function xrpl(a) {
    if (/^X[1-9A-HJ-NP-Za-km-z]{46}$/.test(a)) {
      return no('That is an XRP "X-address", which has the destination tag built in. Ask the receiver for their classic address (starting with r) and destination tag instead.');
    }
    const p = b58check(a, XRP58);
    if (!p || p.length !== 21 || p[0] !== 0) return no('That XRP address ' + TYPO);
    return ok(true);
  }

  function stellar(a) {
    if (/^M[A-Z2-7]{68}$/.test(a)) return no('That is a Stellar muxed (M…) address. Use the G… address and memo the receiver gave you.');
    const b = /^G[A-Z2-7]{55}$/.test(a) ? b32decode(a) : null;
    if (!b || b.length !== 35 || b[0] !== 6 << 3) return no('A Stellar address starts with G and is 56 characters.');
    const want = crc16(b.slice(0, 33));
    return (b[33] | (b[34] << 8)) === want ? ok(true) : no('That Stellar address ' + TYPO);
  }

  function ton(a) {
    if (/^-?[01]:[0-9a-fA-F]{64}$/.test(a)) return ok(false, { note: 'A raw TON address has no checksum — check every character.' });
    const b = /^[A-Za-z0-9_+/-]{48}$/.test(a) ? b64decode(a) : null;
    if (!b || b.length !== 36) return no('A TON address is 48 characters (it usually starts with EQ or UQ).');
    if (b[0] & 0x80) return no('That is a TON testnet address. Real coins sent to it are lost.');
    return ((b[34] << 8) | b[35]) === crc16(b.slice(0, 34)) ? ok(true) : no('That TON address ' + TYPO);
  }

  const TEZOS = { tz1: [6, 161, 159], tz2: [6, 161, 161], tz3: [6, 161, 164], tz4: [6, 161, 166], KT1: [2, 90, 121] };
  function tezos(a) {
    const want = TEZOS[a.slice(0, 3)];
    const p = want ? b58check(a) : null;
    if (!p || p.length !== 23 || !same(p.slice(0, 3), Uint8Array.from(want))) return no('That Tezos address ' + TYPO);
    return ok(true);
  }

  const FAMILY = {
    evm,
    bitcoin: a => utxo(a, { name: 'Bitcoin', hrp: 'bc', testHrp: 'tb', p2pkh: [0x00], p2sh: [0x05], testnet: [0x6f, 0xc4] }),
    litecoin: a => utxo(a, { name: 'Litecoin', hrp: 'ltc', testHrp: 'tltc', p2pkh: [0x30], p2sh: [0x32, 0x05], testnet: [0x6f, 0x3a] }),
    dogecoin: a => utxo(a, { name: 'Dogecoin', p2pkh: [0x1e], p2sh: [0x16], testnet: [0x71, 0xc4] }),
    bitcoincash: a => {
      if (/^(bitcoincash:)?[qp]/i.test(a) && !/^[13]/.test(a)) return cashaddr(a, 'bitcoincash') ? ok(true) : no('That Bitcoin Cash address ' + TYPO);
      return utxo(a, { name: 'Bitcoin Cash', p2pkh: [0x00], p2sh: [0x05] });
    },
    tron: a => {
      const p = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a) ? b58check(a) : null;
      return p && p.length === 21 && p[0] === 0x41 ? ok(true) : no('That Tron address ' + TYPO);
    },
    xrpl,
    solana: a => {
      const b = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) ? b58decode(a) : null;
      return b && b.length === 32 ? ok(false, { note: 'Solana addresses have no checksum — check every character against the receiver.' })
        : no('A Solana address decodes to exactly 32 bytes; this one does not. Copy it again.');
    },
    stellar, ton, tezos,
    cosmos: a => {
      const d = bech32Decode(a);
      const prog = d && d.hrp === 'cosmos' && d.spec === 'bech32' ? convertBits(d.data, 5, 8, false) : null;
      return prog && (prog.length === 20 || prog.length === 32) ? ok(true) : no('That Cosmos address ' + TYPO);
    },
    cardano: a => {
      if (!/^addr1/.test(a)) return ok(false, { note: 'An older Cardano (Byron) address — only its format was checked.' });
      const d = bech32Decode(a, Infinity);
      return d && d.hrp === 'addr' ? ok(true) : no('That Cardano address ' + TYPO);
    }
  };

  /* Characters that are never part of any address but ride along when an
     address is copied from a web page, a PDF or a chat: zero-width
     spaces and joiners, byte-order marks, and the bidirectional controls
     that can make text display in a different order than it is. */
  const INVISIBLE = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;
  function clean(raw) {
    const s = String(raw == null ? '' : raw);
    const value = s.replace(INVISIBLE, '').trim();
    return { value, hidden: value !== s.trim() };
  }

  /* family -> { ok, checksum, reason, note, kind, dustSats } or null when
     this file has no checksum rule for the family (shape only). */
  function check(family, address) {
    const fn = FAMILY[family];
    if (!fn) return null;
    try { return fn(String(address)); }
    catch (e) { return no('That address could not be read.'); }
  }

  return { check, clean, toChecksum, sha256, keccak256, b58decode, b58check, bech32Decode, segwit, cashaddr, crc16, hex, FAMILIES: Object.keys(FAMILY) };
})();

window.ADDR = ADDR;

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module, so its top-level names are private to it.
   Other modules look ADDR up on the global object. */
import { publish } from '../globals.js?v=3';
publish('utils/addrcheck.js', {
  ADDR: () => ADDR
});
