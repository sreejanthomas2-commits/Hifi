/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SECURITY TESTS —  node scripts/test-security.js                  ║
   ║                                                                   ║
   ║  One check or more for each fix in SECURITY-REPORT.md, against    ║
   ║  the real code. Nothing leaves this machine:                      ║
   ║    · vercel.json gives the page the same headers as the API       ║
   ║    · behind Vercel each visitor has their own rate-limit count,   ║
   ║      and a flood from one address stops at the API-wide ceiling   ║
   ║    · API answers are never cached and can't be embedded elsewhere ║
   ║    · user A cannot read, receipt or refund user B's payment       ║
   ║    · forged, foreign, expired and unsigned sign-ins are refused   ║
   ║    · a forged payout-partner event and a wrong signer token are   ║
   ║      refused                                                      ║
   ║    · Pay will not start in production without its signing keys   ║
   ║    · a news link can only open a web page                         ║
   ║    · the security log names no one: no ids, full addresses,       ║
   ║      tokens or query strings                                      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

// As on Vercel, before anything reads the environment.
process.env.PORT = '3293';
process.env.VERCEL = '1';
delete process.env.TRUST_PROXY;
process.env.API_RATE_MAX = '40';
process.env.PAY_WORKER_ROLE = 'off';
process.env.CATALOG_LIVE = '0';
process.env.CATALOG_FILE = path.join(os.tmpdir(), 'trending-test-catalog-none.json');
process.env.PAY_STORE_FILE = path.join(os.tmpdir(), 'trending-test-security-pay-' + process.pid + '.json');
delete process.env.CORS_ORIGINS;
delete process.env.NODE_ENV;
delete process.env.CSP_ENFORCE;
delete process.env.SIGNER_TOKEN;

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}
const ok = (name, cond) => check(name, !!cond, true);

// Every security event the code writes lands here instead of the console.
const seclog = require('../lib/seclog');
const lines = [];
seclog._setSink(l => lines.push(JSON.parse(l)));
const events = name => lines.filter(l => l.sec === name);

const auth = require('../middleware/auth');
const tokens = require('./lib/test-tokens');
tokens.install(auth);

const { SOURCE, expected } = require('./lib/vercel-headers');
const payStore = require('../services/pay/store');
const { makePay } = require('../services/pay/engine');
const { makeRouters } = require('../routes/pay');
const { perIp } = require('../middleware/ratelimit');

const quietLog = console.log;
require('../server');
const SERVER = 'http://127.0.0.1:3293';
const PAY = 'http://127.0.0.1:3294';

// Made-up people and a fixed rate, so no test reaches Firestore or the ECB.
const people = {
  alice: { uid: 'alice', handle: 'alice', displayName: 'Alice Test' },
  bob: { uid: 'bob', handle: 'bob', displayName: 'Bob Test' },
  mallory: { uid: 'mallory', handle: 'mallory', displayName: 'Mallory Test' }
};
const directory = { profileOf: async u => people[u] || null, byHandle: async h => people[String(h).replace(/^@/, '')] || null };
const fx = { rates: async () => ({ ok: true, stale: false, fetchedAt: Date.now(), date: new Date().toISOString().slice(0, 10), source: 'test', rates: { INR: 85 } }) };
const tmp = name => path.join(os.tmpdir(), `trending-test-security-${name}-${process.pid}.json`);

function readModule(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', rel), 'utf8');
  const at = src.indexOf('Global bridge');
  return at === -1 ? src : src.slice(0, src.lastIndexOf('/*', at));
}

(async () => {
  await new Promise(r => setTimeout(r, 400));
  const get = (p, init, ip) => fetch(SERVER + p, Object.assign({}, init || {},
    { headers: Object.assign({ Connection: 'close', 'X-Forwarded-For': ip || '192.0.2.50' }, (init && init.headers) || {}) }));

  /* ── 1. The page Vercel serves ─────────────────────────────────── */
  console.log('\nvercel.json gives the page the API\'s headers');
  const vcfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const block = (vcfg.headers || []).find(h => h.source === SOURCE);
  ok('a headers block covers every path outside /api', block);
  const enforce = !!(block && block.headers.some(h => h.key === 'Content-Security-Policy'));
  check('  exactly the headers middleware/security.js sends in production',
    JSON.stringify(block && block.headers), JSON.stringify(expected({ enforce })));
  const pageRe = new RegExp('^' + SOURCE.replace(/\//g, '\\/') + '$');
  ok('  the page, its scripts and deep links are covered', ['/', '/index.html', '/js/boot.js', '/css/index.css', '/profile'].every(p => pageRe.test(p)));
  ok('  /api is left to Express', !pageRe.test('/api/pay/me') && !pageRe.test('/api/health'));
  const hv = k => ((block && block.headers.find(h => h.key === k)) || {}).value || '';
  check('  no site may frame the page', hv('X-Frame-Options'), 'DENY');
  check('  no content sniffing', hv('X-Content-Type-Options'), 'nosniff');
  check('  HSTS: two years, subdomains, preload-ready', hv('Strict-Transport-Security'), 'max-age=63072000; includeSubDomains; preload');
  ok('  a content policy with frame-ancestors none', /frame-ancestors 'none'/.test(hv('Content-Security-Policy') || hv('Content-Security-Policy-Report-Only')));
  ok('  the build and routing entries are untouched', Array.isArray(vcfg.builds) && vcfg.builds.length === 2 && Array.isArray(vcfg.rewrites) && vcfg.rewrites.length === 2);

  /* ── 2. Addresses and the API-wide ceiling ─────────────────────── */
  console.log('\nbehind Vercel, each visitor is counted separately');
  let r, last;
  for (let i = 0; i < 40; i++) { last = await get('/api/crypto/networks', null, '203.0.113.10'); if (last.status !== 200) break; }
  check('40 requests a minute from one address are served', last.status, 200);
  r = await get('/api/crypto/networks?q=private-search-text', null, '203.0.113.10');
  check('  the 41st is refused', r.status, 429);
  ok('  and says when to come back', Number(r.headers.get('retry-after')) >= 1);
  const limited = await r.json();
  ok('  in the usual shape: nothing ran, funds safe', limited.error === 'rate_limited' && limited.fundsSafe === true);
  r = await get('/api/crypto/networks', null, '198.51.100.7');
  check('another visitor at the same moment is still served', r.status, 200);
  const rl = events('rate_limited').find(l => l.scope === 'api');
  ok('the refusal is logged', rl);
  check('  by network, not address', rl && rl.net, '203.0.113.0/24');
  check('  with the path and not the query', rl && rl.path, '/api/crypto/networks');

  let t = 1000000;
  const lim = perIp({ scope: 'unit', windowMs: 1000, max: 3, now: () => t });
  const hit = ip => {
    const res = { code: 200, headers: {}, set(k, v) { this.headers[k] = v; return this; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    let passed = false;
    lim({ ip }, res, () => { passed = true; });
    return passed ? 200 : res.code;
  };
  check('the ceiling counts per address', [hit('a'), hit('a'), hit('a'), hit('a'), hit('b')].join(','), '200,200,200,429,200');
  t += 1000;
  check('  and starts again next minute', hit('a'), 200);

  console.log('\nAPI answers are not kept or embedded');
  r = await get('/api/health');
  check('an API answer is never cached', r.headers.get('cache-control'), 'no-store');
  check('  nor read into another site\'s page', r.headers.get('cross-origin-resource-policy'), 'same-origin');
  r = await get('/api/crypto/networks', null, '192.0.2.51');
  check('a public list keeps the caching it asks for', r.headers.get('cache-control'), 'public, max-age=300');
  r = await get('/');
  check('the page itself is not given the API rule', r.headers.get('cross-origin-resource-policy'), 'null');

  /* ── 3. User A and user B ──────────────────────────────────────── */
  console.log('\nuser A cannot see or touch user B\'s payment');
  const pr = makeRouters({ store: new payStore.FileStore({ file: tmp('pay') }), directory, fx, worker: false });
  const express = require('express');
  const app = express();
  app.use('/api/pay/webhooks', pr.webhooks);
  app.use(express.json());
  app.use('/api/pay', pr.router);
  const paySrv = await new Promise(res => { const s = app.listen(3294, () => res(s)); });
  const A = tokens.mint('alice'), B = tokens.mint('bob'), M = tokens.mint('mallory');
  const call = (method, p, token, body, headers) => fetch(PAY + p, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: Object.assign({ Connection: 'close', 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, headers || {})
  });
  const key = () => 'sec-test-' + crypto.randomBytes(8).toString('hex');

  check('Alice opens Pay', (await call('GET', '/api/pay/me', A)).status, 200);
  check('Bob opens Pay', (await call('GET', '/api/pay/me', B)).status, 200);
  const q = await (await call('POST', '/api/pay/quotes', A, { to: 'bob', asset: 'USDT', amount: '5' })).json();
  ok('Alice gets a quote to pay Bob', q && q.id);
  const tr = await (await call('POST', '/api/pay/transfers', A, { quoteId: q.id }, { 'Idempotency-Key': key() })).json();
  const tid = tr && (tr.id || (tr.transfer && tr.transfer.id));
  ok('  and pays him', tid);
  check('Alice can read her payment', (await call('GET', `/api/pay/transfers/${tid}`, A)).status, 200);
  check('Mallory cannot read it', (await call('GET', `/api/pay/transfers/${tid}`, M)).status, 404);
  check('  nor its receipt', (await call('GET', `/api/pay/transfers/${tid}/receipt`, M)).status, 404);
  check('  nor refund it', (await call('POST', `/api/pay/transfers/${tid}/refund`, M, {}, { 'Idempotency-Key': key() })).status, 404);
  const mine = await (await call('GET', '/api/pay/transfers', M)).json();
  check('  and her own history shows none of it', mine.transfers && mine.transfers.length, 0);

  console.log('\nonly a real, current sign-in gets in');
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const forged = require('jsonwebtoken').sign({ auth_time: now - 60, email_verified: true }, other,
    { algorithm: 'RS256', keyid: tokens.KID, subject: 'alice', audience: tokens.PROJECT, issuer: 'https://securetoken.google.com/' + tokens.PROJECT, expiresIn: '1h' });
  const refused = {
    'no token': null,
    'a token signed by someone else\'s key': forged,
    'a token for another project': tokens.mint('alice', {}, { audience: 'someone-elses-project' }),
    'an expired token': tokens.mint('alice', { exp: now - 30 }, { expiresIn: undefined }),
    'an unsigned token (alg none)': b64({ alg: 'none', typ: 'JWT', kid: tokens.KID }) + '.' +
      b64({ sub: 'alice', aud: tokens.PROJECT, iss: 'https://securetoken.google.com/' + tokens.PROJECT, iat: now, exp: now + 3600, auth_time: now }) + '.'
  };
  for (const [what, tok] of Object.entries(refused)) check(`${what} → 401`, (await call('GET', '/api/pay/me', tok)).status, 401);
  ok('refused sign-ins are logged', events('auth.rejected').some(l => l.reason === 'bad_session'));
  check('a signed-in person is not staff', (await call('GET', '/api/pay/admin/reviews', A)).status, 403);
  const denied = events('admin.denied')[0];
  ok('  the attempt is logged against a tag, not the account id', denied && denied.user && denied.user !== 'alice');

  console.log('\nforged partners and signers are refused');
  r = await call('POST', '/api/pay/webhooks/sandbox', null, { id: 'evt_forged01', transferId: tid, type: 'payout.paid' },
    { 'Trending-Signature': `t=${now},v1=${'0'.repeat(64)}` });
  check('a payout event with a made-up signature → 401', r.status, 401);
  ok('  and it is logged', events('webhook.rejected').length === 1);
  paySrv.close();

  const signerToken = crypto.randomBytes(20).toString('hex');
  process.env.SIGNER_TOKEN = signerToken;
  const asSigner = tok => get('/api/crypto/signer/queue', { headers: { Authorization: 'Bearer ' + tok } }, '192.0.2.60');
  check('a wrong signer token of the right length → 401', (await asSigner('0'.repeat(signerToken.length))).status, 401);
  check('  and of another length → 401', (await asSigner('short')).status, 401);
  r = await asSigner(signerToken);
  check('the right one gets past the lock (then finds no database)', r.status, 503);
  ok('  refused signer calls are logged', events('signer.denied').length >= 1);
  delete process.env.SIGNER_TOKEN;

  /* ── 4. Pay's signing keys ─────────────────────────────────────── */
  console.log('\nPay will not run in production without its own keys');
  const quietErr = console.error, errs = [];
  console.error = m => errs.push(String(m));
  const prod = { NODE_ENV: 'production', PAY_MODE: 'practice', MONGO_URI: 'mongodb://127.0.0.1:1/none' };
  const strong = () => crypto.randomBytes(24).toString('hex');
  check('no keys in the environment → Pay stays off', payStore.open(prod, { connection: {} }), 'null');
  ok('  and the log names the settings, never a value', /PAY_QR_SECRET/.test(errs.join(' ')) && /PAY_SANDBOX_WEBHOOK_SECRET/.test(errs.join(' ')));
  check('keys too short to trust → off', payStore.open({ ...prod, PAY_QR_SECRET: 'short', PAY_SANDBOX_WEBHOOK_SECRET: 'short' }, { connection: {} }), 'null');
  const on = payStore.open({ ...prod, PAY_QR_SECRET: strong(), PAY_SANDBOX_WEBHOOK_SECRET: strong() }, { connection: {} });
  check('both keys set → on', on && on.kind, 'mongo');
  console.error = quietErr;
  const engine = makePay({ store: new payStore.FileStore({ file: tmp('prod') }), directory, fx, env: { NODE_ENV: 'production' } });
  let code = null;
  try { await engine.init(); } catch (e) { code = e.code; }
  check('the engine will not make its own key in production either: it will not start', code, 'pay_unavailable');

  /* ── 5. News links ─────────────────────────────────────────────── */
  console.log('\na news link can only open a web page');
  const newsWindow = (items, cached) => {
    const store = {};
    if (cached) store.ts_news_cache = JSON.stringify(cached);
    const ctx = {
      window: {}, console: { log() {}, warn() {}, error() {} }, URL,
      localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
      document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
      setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
      fetch: async () => ({ ok: true, json: async () => ({ status: 'ok', items }) })
    };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(readModule('utils/api.js'), ctx);
    return ctx.window;
  };
  const feed = [
    { title: 'Script link', link: 'javascript:alert(document.cookie)', pubDate: '2026-09-28 10:00:00', thumbnail: 'javascript:x' },
    { title: 'Data link', link: 'data:text/html,<script>alert(1)</script>', pubDate: '2026-09-28 09:00:00' },
    { title: 'Real story', link: 'https://www.coindesk.com/markets/story', pubDate: '2026-09-28 08:00:00', thumbnail: 'https://img.example/a.png' }
  ];
  let news = await newsWindow(feed).fetchCryptoNews(10);
  check('crypto headlines keep only the http(s) story', news.map(a => a.title).join('|'), 'Real story');
  check('  with its link and picture intact', news[0] && news[0].url + ' ' + news[0].thumbnail, 'https://www.coindesk.com/markets/story https://img.example/a.png');
  news = await newsWindow([], { t: Date.now(), items: [
    { title: 'Old script', url: 'javascript:alert(1)', publishedAt: new Date().toISOString() },
    { title: 'Old story', url: 'https://decrypt.co/old', publishedAt: new Date().toISOString() }
  ] }).fetchCryptoNews(10);
  check('a copy saved in the browser earlier is checked too', news.map(a => a.title).join('|'), 'Old story');
  news = await newsWindow(feed).fetchLiveNews('bitcoin');
  check('search headlines keep only the http(s) story', news.map(a => a.title).join('|'), 'Real story');

  /* ── 6. The log itself ─────────────────────────────────────────── */
  console.log('\nthe security log names no one');
  ok('a user id becomes a 12-character tag', seclog._tag('alice') !== 'alice' && seclog._tag('alice').length === 12);
  check('  the same person keeps the same tag', seclog._tag('alice'), seclog._tag('alice'));
  check('an IPv4 address is cut to its /24', seclog._network('203.0.113.77'), '203.0.113.0/24');
  check('  mapped IPv4 as well', seclog._network('::ffff:203.0.113.77'), '203.0.113.0/24');
  check('an IPv6 address is cut to its /48', seclog._network('2001:db8:1234:5678::1'), '2001:db8:1234::/48');
  const before = lines.length;
  seclog.seclog('test.repeat', { ip: '192.0.2.99' });
  seclog.seclog('test.repeat', { ip: '192.0.2.99' });
  check('the same event from one place is written once a minute', lines.length - before, 1);
  const all = JSON.stringify(lines);
  ok(`across all ${lines.length} lines: no account id, full address, token or query`,
    !/alice|bob|mallory|203\.0\.113\.10|198\.51\.100\.7|Bearer|eyJ|private-search-text/.test(all));

  console.log = quietLog;
  console.log(`\n${pass} passed, ${fail} failed\n`);
  [tmp('pay'), tmp('prod'), process.env.PAY_STORE_FILE].forEach(f => { try { fs.unlinkSync(f); } catch (e) {} });
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
