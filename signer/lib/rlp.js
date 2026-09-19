/* ╔══════════════════════════════════════════════════════════════════╗
   ║  RLP — Ethereum's encoding, for building transactions             ║
   ║                                                                   ║
   ║  Forty lines, checked against the yellow paper's own examples in  ║
   ║  test/rlp.test.js. A transaction is only ever as correct as this  ║
   ║  is: get a length prefix wrong and the network reads a different  ║
   ║  transaction from the one you meant to sign.                      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

/* An integer becomes its shortest big-endian form, and zero becomes
   empty — not a zero byte. That distinction is real: RLP has no number
   type, so 0 and "" encode identically, and a leading zero would make a
   different value. */
function toBuf(v) {
  if (Buffer.isBuffer(v)) return v;
  if (v == null || v === '' || v === 0 || v === 0n) return Buffer.alloc(0);
  if (typeof v === 'number') return toBuf(BigInt(v));
  if (typeof v === 'bigint') {
    if (v < 0n) throw new Error('RLP has no negative numbers');
    let hex = v.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    return Buffer.from(hex, 'hex');
  }
  if (typeof v === 'string') {
    if (/^0x[0-9a-fA-F]*$/.test(v)) {
      const body = v.slice(2);
      return Buffer.from(body.length % 2 ? '0' + body : body, 'hex');
    }
    return Buffer.from(v, 'utf8');
  }
  throw new Error('cannot encode ' + typeof v);
}

function length(len, offset) {
  if (len < 56) return Buffer.from([len + offset]);
  const hex = len.toString(16);
  const b = Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex');
  return Buffer.concat([Buffer.from([b.length + offset + 55]), b]);
}

function encode(input) {
  if (Array.isArray(input)) {
    const body = Buffer.concat(input.map(encode));
    return Buffer.concat([length(body.length, 0xc0), body]);
  }
  const buf = toBuf(input);
  if (buf.length === 1 && buf[0] < 0x80) return buf;
  return Buffer.concat([length(buf.length, 0x80), buf]);
}

module.exports = { encode, toBuf };
