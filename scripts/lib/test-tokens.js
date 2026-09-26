/* Firebase-shaped ID tokens for tests, signed with a key made here and
   thrown away with the process. middleware/auth.js is pointed at that
   key instead of Google's, and at an in-memory "sign out everywhere"
   record instead of Firestore; every other check is the real one. */

'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const PROJECT = 'trending-test-project';
const KID = 'test-key-1';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' });

const revoked = new Map();          // uid -> ms

function install(auth) {
  process.env.FIREBASE_PROJECT_ID = PROJECT;
  auth._setSources({ keys: async () => ({ [KID]: PUBLIC_PEM }), revokedAt: async uid => revoked.get(uid) || null });
}

/* A token for uid. `claims` overrides the payload; `opts` the signing
   options (a different audience, an expiry in the past, ...). */
function mint(uid, claims, opts) {
  const now = Math.floor(Date.now() / 1000);
  const options = Object.assign({
    algorithm: 'RS256', keyid: KID, subject: uid, audience: PROJECT,
    issuer: 'https://securetoken.google.com/' + PROJECT, expiresIn: '1h'
  }, opts || {});
  // An option given as undefined means "leave it out" (no expiry, say).
  Object.keys(options).forEach(k => { if (options[k] === undefined) delete options[k]; });
  return jwt.sign(Object.assign({
    auth_time: now - 60, email_verified: true, firebase: { sign_in_provider: 'google.com' }
  }, claims || {}), privateKey, options);
}

module.exports = { install, mint, revoked, PROJECT, KID, PUBLIC_PEM, privateKey };
