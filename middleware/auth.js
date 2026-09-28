/* ╔══════════════════════════════════════════════════════════════════╗
   ║  AUTH — a Firebase sign-in, checked here, or nothing              ║
   ║                                                                   ║
   ║  People sign in with Firebase. The browser sends the Firebase ID  ║
   ║  token it already holds, and this checks it the way Firebase      ║
   ║  documents for any server:                                        ║
   ║                                                                   ║
   ║    · RS256 only, signed by one of Google's published keys (kid)   ║
   ║    · aud is this project, iss is securetoken.google.com/<project> ║
   ║    · not expired, not issued in the future, has a subject         ║
   ║                                                                   ║
   ║  Then two things the token alone cannot say:                      ║
   ║                                                                   ║
   ║    · was this session ended by "sign out of every device"? The    ║
   ║      time is in Firestore at sessions/{uid}, readable by the      ║
   ║      owner - so it is read WITH the person's own token, and the   ║
   ║      server needs no credentials of its own                       ║
   ║    · is the account confirmed? An email account that has not      ║
   ║      opened its link cannot touch a wallet                        ║
   ║                                                                   ║
   ║  Nothing here holds a secret. Google's keys are public, and admin ║
   ║  is a list of user ids in ADMIN_UIDS, decided by the operator,    ║
   ║  never by anything in the request.                                ║
   ║                                                                   ║
   ║  This replaces an HS256 session this server was meant to issue -  ║
   ║  nothing ever did, so no signed-in person could reach the wallet  ║
   ║  routes at all, and those tokens carried no issuer or audience.   ║
   ║                                                                   ║
   ║  With FIREBASE_PROJECT_ID unset every protected route answers     ║
   ║  503. It never falls back to "allow".                             ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const jwt = require('jsonwebtoken');
const { seclog } = require('../lib/seclog');

const projectId = () => process.env.FIREBASE_PROJECT_ID || '';
/* This project's Firestore database is the one named "default" - not the
   unnamed "(default)" - which is what the web app connects to as well. */
const databaseId = () => process.env.FIRESTORE_DATABASE_ID || 'default';
const admins = () => new Set(String(process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean));

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const SESSION_CACHE_MS = 60 * 1000;

/* ── Where keys and session records come from ────────────────────── */
/* Real sources by default. Tests swap them for a local key and an
   in-memory record through _setSources; nothing outside this process
   can reach that. */
let certCache = { keys: null, until: 0 };
async function googleKeys() {
  if (certCache.keys && Date.now() < certCache.until) return certCache.keys;
  const r = await fetch(CERTS_URL, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('could not fetch Google signing keys: ' + r.status);
  const m = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
  certCache = { keys: await r.json(), until: Date.now() + (m ? Number(m[1]) * 1000 : 3600 * 1000) };
  return certCache.keys;
}

/* When the account last signed out everywhere, in ms, or null. */
async function firestoreRevokedAt(uid, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}` +
    `/databases/${encodeURIComponent(databaseId())}/documents/sessions/${encodeURIComponent(uid)}`;
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(5000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('session record unreadable: ' + r.status);
  const doc = await r.json();
  const ts = doc && doc.fields && doc.fields.revokedAt && doc.fields.revokedAt.timestampValue;
  return ts ? Date.parse(ts) : null;
}

let sources = { keys: googleKeys, revokedAt: firestoreRevokedAt };
const revokedCache = new Map();

/* ── Checking a token ────────────────────────────────────────────── */
async function verifyIdToken(token) {
  const pid = projectId();
  const decoded = jwt.decode(token, { complete: true });
  // The algorithm is fixed before any key is chosen: a token cannot pick
  // its own (HS256 with the public key as the secret, or "none").
  if (!decoded || !decoded.header || decoded.header.alg !== 'RS256' || !decoded.header.kid) throw new Error('malformed');
  const pem = (await sources.keys())[decoded.header.kid];
  if (!pem) throw new Error('unknown signing key');
  const claims = jwt.verify(token, pem, {
    algorithms: ['RS256'], audience: pid, issuer: 'https://securetoken.google.com/' + pid, clockTolerance: 5
  });
  const now = Date.now() / 1000;
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128) throw new Error('no subject');
  if (!claims.exp) throw new Error('no expiry');
  if (!claims.iat || claims.iat > now + 5) throw new Error('issued in the future');
  if (!claims.auth_time || claims.auth_time > now + 5) throw new Error('bad auth_time');
  return claims;
}

/* Ended by "sign out of every device"? Cached for a minute per person,
   so the database is asked once a minute, not once a request. */
async function sessionEnded(claims, token) {
  const hit = revokedCache.get(claims.sub);
  let at;
  if (hit && Date.now() < hit.until) at = hit.at;
  else {
    at = await sources.revokedAt(claims.sub, token);
    revokedCache.set(claims.sub, { at, until: Date.now() + SESSION_CACHE_MS });
    if (revokedCache.size > 10000) revokedCache.clear();
  }
  return at != null && at >= claims.auth_time * 1000;
}

const confirmed = claims => claims.email_verified === true ||
  !!(claims.firebase && claims.firebase.sign_in_provider === 'phone');

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

async function requireAuth(req, res, next) {
  if (!projectId()) {
    return res.status(503).json({ error: 'auth_unconfigured', message: 'This server has no Firebase project configured, so wallet routes are closed.' });
  }
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'unauthenticated', message: 'Sign in first.' });

  let claims;
  try { claims = await verifyIdToken(token); }
  catch (e) {
    // A forged, expired or foreign token. Logged by address - the token
    // names nobody we can trust.
    seclog('auth.rejected', req, { reason: 'bad_session' });
    return res.status(401).json({ error: 'bad_session', message: 'That session is not valid. Sign in again.' });
  }

  try {
    if (await sessionEnded(claims, token)) {
      seclog('auth.rejected', { ip: req.ip, method: req.method, baseUrl: req.baseUrl, path: req.path, user: { id: claims.sub } },
        { reason: 'session_ended' });
      return res.status(401).json({ error: 'session_ended', message: 'This session was signed out on every device. Sign in again.' });
    }
  } catch (e) {
    // Cannot tell whether the session was ended: closed, not open.
    return res.status(503).json({ error: 'session_check_unavailable', message: 'Your session could not be checked just now. Try again in a moment.' });
  }

  if (!confirmed(claims)) {
    return res.status(403).json({ error: 'email_unconfirmed', message: 'Confirm your email address before using the wallet.' });
  }

  /* authTime: when this person last proved who they are (a sign-in or a
     re-entered password). Payments need it to be recent. */
  req.user = { id: claims.sub, admin: admins().has(claims.sub), authTime: claims.auth_time * 1000,
    name: typeof claims.name === 'string' ? claims.name.slice(0, 60) : null };
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.admin) {
    seclog('admin.denied', req);
    return res.status(403).json({ error: 'forbidden' });
  }
  // Every staff request is on the record, allowed or not.
  seclog('admin.access', req, { action: req.method });
  next();
}

/* For tests only: swap where keys and session records come from. */
function _setSources(s) {
  sources = { ...sources, ...s };
  certCache = { keys: null, until: 0 };
  revokedCache.clear();
}

module.exports = { requireAuth, requireAdmin, verifyIdToken, _setSources };
