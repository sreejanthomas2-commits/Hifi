/* The headers Vercel must add to the app's own pages and files.

   On Vercel, vercel.json sends every path outside /api straight to the
   static files. Express never sees those requests, so the headers in
   middleware/security.js never reached the page itself - the one place
   a frame or an injected script matters most. vercel.json carries the
   same headers instead, and this says what they must be: read from the
   middleware itself, as it answers in production, so the two cannot
   drift. scripts/sync-vercel-headers.js writes them into vercel.json and
   scripts/test-security.js fails if they differ. */

'use strict';

const path = require('path');

// Everything except the API, which Express answers with its own headers.
const SOURCE = '/((?!api/).*)';

function expected({ enforce } = {}) {
  const saved = { NODE_ENV: process.env.NODE_ENV, CSP_ENFORCE: process.env.CSP_ENFORCE };
  process.env.NODE_ENV = 'production';
  if (enforce) process.env.CSP_ENFORCE = 'true'; else delete process.env.CSP_ENFORCE;
  try {
    const { securityHeaders } = require(path.join(__dirname, '..', '..', 'middleware', 'security'));
    const out = [];
    securityHeaders({ method: 'GET', path: '/', originalUrl: '/' },
      { setHeader: (key, value) => out.push({ key, value: String(value) }) }, () => {});
    return out;
  } finally {
    Object.entries(saved).forEach(([k, v]) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; });
  }
}

module.exports = { SOURCE, expected };
