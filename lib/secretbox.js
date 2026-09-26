/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SECRETBOX — encrypting a small secret at rest                    ║
   ║                                                                   ║
   ║  AES-256-GCM from Node's own crypto: a standard authenticated     ║
   ║  cipher, not something invented here. Used for TOTP secrets,      ║
   ║  which must be readable by the server (it has to compute codes)   ║
   ║  but never by someone holding a copy of the database.             ║
   ║                                                                   ║
   ║  The key lives in the environment, never in the database or the   ║
   ║  repository:                                                      ║
   ║                                                                   ║
   ║    TOTP_ENCRYPTION_KEY = 32 random bytes, base64                  ║
   ║    (node -e "console.log(require('crypto').randomBytes(32)        ║
   ║              .toString('base64'))")                               ║
   ║                                                                   ║
   ║  Every value is bound to a context - the owner's user id - as     ║
   ║  associated data. A ciphertext copied onto another person's row   ║
   ║  fails to decrypt instead of becoming their secret.               ║
   ║                                                                   ║
   ║  Format: v1.<iv>.<tag>.<ciphertext>, each part base64url.         ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');

const b64u = b => b.toString('base64url');

/* The key, or null when it is missing or the wrong size. Never a
   default: a secret "encrypted" under a made-up key is not encrypted. */
function key() {
  const raw = process.env.TOTP_ENCRYPTION_KEY || '';
  if (!raw) return null;
  let buf;
  try { buf = Buffer.from(raw, 'base64'); } catch (e) { return null; }
  return buf.length === 32 ? buf : null;
}

const ready = () => !!key();

function seal(plaintext, context) {
  const k = key();
  if (!k) throw new Error('TOTP_ENCRYPTION_KEY is missing or is not 32 bytes');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  c.setAAD(Buffer.from(String(context), 'utf8'));
  const ct = Buffer.concat([c.update(String(plaintext), 'utf8'), c.final()]);
  return ['v1', b64u(iv), b64u(c.getAuthTag()), b64u(ct)].join('.');
}

function open(sealed, context) {
  const k = key();
  if (!k) throw new Error('TOTP_ENCRYPTION_KEY is missing or is not 32 bytes');
  const parts = String(sealed || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('not a sealed value');
  const [, iv, tag, ct] = parts.map((p, i) => (i ? Buffer.from(p, 'base64url') : p));
  const d = crypto.createDecipheriv('aes-256-gcm', k, iv);
  d.setAAD(Buffer.from(String(context), 'utf8'));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

module.exports = { seal, open, ready };
