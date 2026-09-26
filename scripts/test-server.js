/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SERVER HARDENING TESTS —  node scripts/test-server.js            ║
   ║                                                                   ║
   ║  Boots the real server.js and checks what every response carries  ║
   ║  and what an error looks like from outside: security headers on,  ║
   ║  no framework name, no CORS for strangers, and errors as plain    ║
   ║  JSON - never a stack trace with file paths in it.                ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const path = require('path');

process.env.PORT = '3291';
process.env.CATALOG_LIVE = '0';            // no CoinGecko calls from a test
process.env.CATALOG_FILE = path.join(require('os').tmpdir(), 'trending-test-catalog-none.json');
delete process.env.CORS_ORIGINS;
delete process.env.NODE_ENV;

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}
const ok = (name, cond) => check(name, !!cond, true);

const quiet = console.error;
console.error = () => {};                  // the error handler logs on purpose
require('../server');
const base = 'http://127.0.0.1:3291';

(async () => {
  await new Promise(r => setTimeout(r, 400));
  const get = (p, init) => fetch(base + p, Object.assign({ headers: { Connection: 'close' } }, init || {}));

  console.log('\nevery response carries the headers');
  let r = await get('/');
  const h = k => r.headers.get(k);
  check('nosniff', h('x-content-type-options'), 'nosniff');
  check('cannot be framed', h('x-frame-options'), 'DENY');
  check('referrer trimmed', h('referrer-policy'), 'strict-origin-when-cross-origin');
  ok('device permissions limited', /usb=\(\)/.test(h('permissions-policy') || '') && /camera=\(self\)/.test(h('permissions-policy') || ''));
  check('sign-in pop-ups still allowed', h('cross-origin-opener-policy'), 'same-origin-allow-popups');
  ok('a content policy is reported', /frame-ancestors 'none'/.test(h('content-security-policy-report-only') || ''));
  ok('  and object embeds are off in it', /object-src 'none'/.test(h('content-security-policy-report-only') || ''));
  check('no framework name', h('x-powered-by'), 'null');
  check('no HSTS outside production', h('strict-transport-security'), 'null');

  console.log('\nother sites get no CORS');
  r = await get('/api/crypto/networks', { headers: { Connection: 'close', Origin: 'https://evil.example' } });
  check('the API still answers', r.status, 200);
  check('  but not to another site', r.headers.get('access-control-allow-origin'), 'null');

  console.log('\nerrors are JSON, with nothing inside');
  r = await get('/api/crypto/assets/%E0%A4%A/networks');
  let body = await r.text();
  check('a malformed URL → 400', r.status, 400);
  ok('  as JSON, no stack trace or file path', /^\{"error":"bad_request"\}$/.test(body) && !/node_modules|\\|\/Users\//.test(body));
  r = await get('/api/crypto/withdraw/quote', {
    method: 'POST', headers: { Connection: 'close', 'Content-Type': 'application/json' }, body: '{"x":"' + 'a'.repeat(200000) + '"}'
  });
  body = await r.text();
  check('a 200 KB body → 413', r.status, 413);
  ok('  as JSON, no stack trace', /"too_large"/.test(body) && !/PayloadTooLarge|node_modules/.test(body));
  r = await get('/api/crypto/withdraw/quote', { method: 'POST', headers: { Connection: 'close', 'Content-Type': 'application/json' }, body: '{broken' });
  check('broken JSON → 400', r.status, 400);
  r = await get('/api/no-such-thing');
  check('an unknown API path → 404', r.status, 404);
  check('  as JSON, not the app page', (r.headers.get('content-type') || '').split(';')[0], 'application/json');

  console.log('\nCSP reports');
  r = await get('/api/csp-report', {
    method: 'POST', headers: { Connection: 'close', 'Content-Type': 'application/csp-report' },
    body: JSON.stringify({ 'csp-report': { 'violated-directive': 'script-src', 'blocked-uri': 'https://x.example/a.js' } })
  });
  check('are accepted quietly', r.status, 204);

  console.error = quiet;
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error = quiet; console.error(e); process.exit(1); });
