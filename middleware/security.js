/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SECURITY HEADERS, CSP REPORTS, ERRORS                            ║
   ║                                                                   ║
   ║  Written out rather than pulled in: each header is a line a      ║
   ║  person can read and argue with.                                  ║
   ║                                                                   ║
   ║  Enforced now, because nothing in the app depends on the opposite:║
   ║    X-Content-Type-Options  nosniff                                ║
   ║    X-Frame-Options         DENY  - nobody may frame Trending, so  ║
   ║                            a page cannot be laid under a fake one ║
   ║    Referrer-Policy         strict-origin-when-cross-origin        ║
   ║    Permissions-Policy      camera, mic, location for this site    ║
   ║                            only; payment/USB/serial/HID never     ║
   ║    Cross-Origin-Opener-    same-origin-allow-popups - isolates    ║
   ║      Policy                the window but keeps Google/Apple      ║
   ║                            sign-in pop-ups working                ║
   ║    Strict-Transport-       in production only (it would pin a     ║
   ║      Security              dev box to HTTPS)                      ║
   ║                                                                   ║
   ║  Content-Security-Policy starts REPORT-ONLY. The app still has    ║
   ║  inline handlers and scripts, so a strict policy would break it;  ║
   ║  a report-only one breaks nothing and logs what it would have     ║
   ║  blocked, to /api/csp-report. When the log is quiet, switch       ║
   ║  CSP_ENFORCE=true. Removing the inline handlers is what finally   ║
   ║  lets 'unsafe-inline' go.                                         ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

/* Every outside origin the app loads code, data or media from. Links the
   user taps (explorers, project sites) are navigation and need nothing. */
const CSP = [
  "default-src 'self'",
  // gstatic: Firebase SDK. jsdelivr: the on-device captions model runtime.
  // apis.google.com and google.com/recaptcha: Firebase sign-in helpers.
  // wasm-unsafe-eval: that runtime compiles WebAssembly; plain eval stays off.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.gstatic.com https://cdn.jsdelivr.net https://apis.google.com https://www.google.com/recaptcha/",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Coin logos, avatars and link previews come from many places.
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https://*.googleapis.com https://api.coingecko.com https://api.binance.com wss://stream.binance.com " +
    "https://api.rss2json.com https://api.alternative.me https://cdn.jsdelivr.net " +
    "https://huggingface.co https://*.huggingface.co https://*.hf.co",
  // Firebase's sign-in iframe and reCAPTCHA. Mini apps are srcdoc frames.
  "frame-src 'self' https://trending-app-db.firebaseapp.com https://www.google.com https://recaptcha.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'report-uri /api/csp-report'
].join('; ');

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), hid=(), bluetooth=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader(process.env.CSP_ENFORCE === 'true' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only', CSP);
  next();
}

/* Where the browser sends what the policy would have blocked. Logged
   once per (directive, blocked source) so a busy page cannot flood the
   log, and never echoed back. */
const seen = new Set();
function cspReport(req, res) {
  const r = (req.body && (req.body['csp-report'] || (Array.isArray(req.body) && req.body[0] && req.body[0].body))) || {};
  const directive = String(r['violated-directive'] || r.effectiveDirective || '').slice(0, 60);
  const blocked = String(r['blocked-uri'] || r.blockedURL || '').slice(0, 200);
  const key = directive + ' ' + blocked;
  if (directive && !seen.has(key) && seen.size < 500) {
    seen.add(key);
    console.warn('[csp] would block', key);
  }
  res.status(204).end();
}

/* Anything unexpected becomes a plain JSON error. The details go to the
   server log, never to the caller - a stack trace names files, paths and
   versions, which is a map for whoever is probing. */
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err && (err.status || err.statusCode);
  if (status && status >= 400 && status < 500) {
    // Client mistakes Express already classified: a body too large, bad JSON, a malformed URL.
    const error = status === 413 ? 'too_large' : status === 400 ? 'bad_request' : 'request_error';
    return res.status(status).json({ error });
  }
  console.error('[error]', req.method, req.path, err && err.stack ? err.stack : err);
  res.status(500).json({ error: 'server_error', message: 'Something went wrong on our side.' });
}

module.exports = { securityHeaders, cspReport, errorHandler, CSP };
