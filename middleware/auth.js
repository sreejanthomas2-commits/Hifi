/* ╔══════════════════════════════════════════════════════════════════╗
   ║  AUTH — a signed session, or nothing                              ║
   ║                                                                   ║
   ║  Wallet routes mount this in front of the whole router rather     ║
   ║  than per handler, because the handler someone forgets is the     ║
   ║  one that leaks.                                                  ║
   ║                                                                   ║
   ║  With no JWT_SECRET configured every protected route answers 503. ║
   ║  It never falls back to "allow": a missing secret is a deployment ║
   ║  mistake, and the safe reading of a deployment mistake in front   ║
   ║  of a wallet is "stop".                                           ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const jwt = require('jsonwebtoken');

const secret = () => process.env.JWT_SECRET || '';

function bearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  if (req.cookies && req.cookies.session) return req.cookies.session;
  return '';
}

function requireAuth(req, res, next) {
  if (!secret()) {
    return res.status(503).json({ error: 'auth_unconfigured', message: 'This server has no session secret configured, so wallet routes are closed.' });
  }
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'unauthenticated', message: 'Sign in first.' });
  try {
    const claims = jwt.verify(token, secret(), { algorithms: ['HS256'], clockTolerance: 5 });
    if (!claims || !claims.sub) throw new Error('no subject');
    req.user = { id: String(claims.sub), admin: !!claims.admin, scope: claims.scope || [] };
    next();
  } catch (e) {
    res.status(401).json({ error: 'bad_session', message: 'That session is not valid. Sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.admin) return res.status(403).json({ error: 'forbidden' });
  next();
}

/* Issued by whatever signs users in; kept here so there is one place
   that decides what a session contains. */
function sign(userId, opts) {
  if (!secret()) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(
    { sub: String(userId), admin: !!(opts && opts.admin), scope: (opts && opts.scope) || ['wallet:read'] },
    secret(),
    { algorithm: 'HS256', expiresIn: (opts && opts.expiresIn) || '2h' }
  );
}

module.exports = { requireAuth, requireAdmin, sign };
