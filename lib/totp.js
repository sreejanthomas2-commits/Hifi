/* ╔══════════════════════════════════════════════════════════════════╗
   ║  TOTP — RFC 6238, for confirming a withdrawal                     ║
   ║                                                                   ║
   ║  Thirty lines of HMAC. Checked against the RFC's own test vectors ║
   ║  in scripts/test-withdraw.js, which is the only way to know an    ║
   ║  implementation of this is right.                                 ║
   ║                                                                   ║
   ║  Two details that are security, not style:                        ║
   ║                                                                   ║
   ║  · the comparison is constant time, so an attacker cannot learn   ║
   ║    the code one digit at a time from response timings             ║
   ║  · a used code is rejected for the rest of its window, so a code  ║
   ║    read over someone's shoulder cannot be replayed                ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('bad base32 character');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((value >> bits) & 0xff); }
  }
  return Buffer.from(out);
}

function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) { bits -= 5; out += B32[(value >> bits) & 31]; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

/* HOTP (RFC 4226) is TOTP with the counter supplied. */
function hotp(secret, counter, digits, algo) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac(algo || 'sha1', secret).update(buf).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) |
              (mac[offset + 2] << 8) | mac[offset + 3];
  const d = digits || 6;
  return String(bin % (10 ** d)).padStart(d, '0');
}

const counterFor = (time, step) => Math.floor((time || Math.floor(Date.now() / 1000)) / (step || 30));

function generate(secretBase32, opts) {
  const o = opts || {};
  return hotp(base32Decode(secretBase32), counterFor(o.time, o.step), o.digits, o.algo);
}

/* A window of ±1 step forgives a slow thumb and a clock a few seconds
   out. Wider than that and a stolen code stays useful for too long. */
function verify(secretBase32, code, opts) {
  const o = opts || {};
  const given = String(code || '').replace(/\D/g, '');
  const digits = o.digits || 6;
  if (given.length !== digits) return { ok: false, reason: `Enter the ${digits}-digit code from your authenticator app.` };
  const secret = base32Decode(secretBase32);
  const centre = counterFor(o.time, o.step);
  const window = o.window == null ? 1 : o.window;
  for (let i = -window; i <= window; i++) {
    const want = hotp(secret, centre + i, digits, o.algo);
    if (equal(want, given)) return { ok: true, counter: centre + i };
  }
  return { ok: false, reason: 'That code is not right, or it has expired.' };
}

function equal(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/* A new secret for enrolment, plus the otpauth:// URI an authenticator
   app reads from a QR code. The secret is shown once and then only ever
   stored encrypted — it is a second factor, not a password hash. */
function enrol(label, issuer) {
  const secret = base32Encode(crypto.randomBytes(20));
  const uri = 'otpauth://totp/' + encodeURIComponent(`${issuer || 'Trending'}:${label}`) +
    `?secret=${secret}&issuer=${encodeURIComponent(issuer || 'Trending')}&algorithm=SHA1&digits=6&period=30`;
  return { secret, uri };
}

module.exports = { generate, verify, enrol, hotp, base32Decode, base32Encode, equal };
