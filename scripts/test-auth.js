/* ╔══════════════════════════════════════════════════════════════════╗
   ║  AUTH TESTS —  node scripts/test-auth.js                          ║
   ║                                                                   ║
   ║  middleware/auth.js is the only thing between the internet and    ║
   ║  the wallet routes. Every way a token can be wrong is tried here  ║
   ║  and must be refused; the right token must still get through.     ║
   ║  Tokens are signed with a key made for this run (see              ║
   ║  scripts/lib/test-tokens.js) - the checks themselves are real.    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const T = require('./lib/test-tokens');

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}

/* Run the middleware the way Express would, and report what it did. */
function run(token) {
  return new Promise(resolve => {
    const req = { headers: token ? { authorization: 'Bearer ' + token } : {} };
    const res = {
      status(c) { this.c = c; return this; },
      json(b) { resolve({ status: this.c, error: b.error }); }
    };
    auth.requireAuth(req, res, () => resolve({ status: 200, user: req.user }));
  });
}
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);

(async () => {
  console.log('\nnot configured');
  delete process.env.FIREBASE_PROJECT_ID;
  check('no project → 503, never "allow"', (await run(T.mint('u1'))).status, 503);

  T.install(auth);

  console.log('\nthe right token');
  const good = await run(T.mint('u1'));
  check('a valid token gets through', good.status, 200);
  check('  as the token’s own subject', good.user && good.user.id, 'u1');
  check('  and not as an admin', good.user && good.user.admin, false);

  console.log('\ntokens that must be refused');
  const [h, p, s] = T.mint('u1').split('.');
  const payload = JSON.parse(Buffer.from(p, 'base64url'));
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const cases = {
    'no token': '',
    'not a JWT': 'not.a.jwt',
    'alg none': b64({ alg: 'none', kid: T.KID, typ: 'JWT' }) + '.' + p + '.',
    'payload changed (another uid)': h + '.' + b64({ ...payload, sub: 'victim' }) + '.' + s,
    // The classic confusion: HMAC with the PUBLIC key as the shared secret.
    'HS256 using the public key as the secret': (() => {
      const hs = b64({ alg: 'HS256', kid: T.KID, typ: 'JWT' }) + '.' + p;
      return hs + '.' + crypto.createHmac('sha256', T.PUBLIC_PEM).update(hs).digest('base64url');
    })(),
    'signed by a different key, same kid': jwt.sign({ auth_time: now() - 60, email_verified: true }, other,
      { algorithm: 'RS256', keyid: T.KID, subject: 'u1', audience: T.PROJECT, issuer: 'https://securetoken.google.com/' + T.PROJECT, expiresIn: '1h' }),
    'unknown kid': T.mint('u1', {}, { keyid: 'someone-elses-key' }),
    'another project (aud)': T.mint('u1', {}, { audience: 'some-other-project' }),
    'another issuer': T.mint('u1', {}, { issuer: 'https://securetoken.google.com/some-other-project' }),
    'expired': T.mint('u1', { exp: now() - 60 }, { expiresIn: undefined }),
    'no expiry': T.mint('u1', {}, { expiresIn: undefined }),
    'issued in the future': T.mint('u1', { iat: now() + 3600 }),
    'no subject': jwt.sign({ auth_time: now() - 60, email_verified: true }, T.privateKey,
      { algorithm: 'RS256', keyid: T.KID, audience: T.PROJECT, issuer: 'https://securetoken.google.com/' + T.PROJECT, expiresIn: '1h' }),
    'signed in "in the future"': T.mint('u1', { auth_time: now() + 3600 })
  };
  for (const [name, token] of Object.entries(cases)) {
    const r = await run(token);
    check(`${name} → 401`, r.status, 401);
  }

  console.log('\nwhat the request cannot claim');
  const claimsAdmin = await run(T.mint('u2', { admin: true }));
  check('an "admin" claim in the token is ignored', claimsAdmin.user && claimsAdmin.user.admin, false);
  process.env.ADMIN_UIDS = 'ops_1, ops_2';
  check('admin comes from ADMIN_UIDS on the server', (await run(T.mint('ops_1'))).user.admin, true);
  delete process.env.ADMIN_UIDS;

  console.log('\nunconfirmed accounts');
  check('an email account that has not confirmed → 403', (await run(T.mint('u3', { email_verified: false, firebase: { sign_in_provider: 'password' } }))).status, 403);
  check('a phone account needs no email → 200', (await run(T.mint('u4', { email_verified: undefined, firebase: { sign_in_provider: 'phone' } }))).status, 200);

  console.log('\nsign out of every device');
  T.revoked.set('u5', Date.now());
  const before = await run(T.mint('u5', { auth_time: now() - 600 }));
  check('a session from before → 401', before.status, 401);
  check('  and says the session ended', before.error, 'session_ended');
  T.revoked.set('u6', Date.now() - 120000);
  check('a session from after → 200', (await run(T.mint('u6', { auth_time: now() - 30 }))).status, 200);
  auth._setSources({ revokedAt: async () => { throw new Error('down'); } });
  check('if the record cannot be read → 503, not "allow"', (await run(T.mint('u7'))).status, 503);
  T.install(auth);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
