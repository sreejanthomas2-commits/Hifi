/* ╔══════════════════════════════════════════════════════════════════╗
   ║  FRONT-END AUDIT —  node scripts/audit-frontend.js                ║
   ║                                                                   ║
   ║  Finds the bugs the compiler cannot, because this app calls most  ║
   ║  of its own code through strings:                                 ║
   ║                                                                   ║
   ║    onclick="renderFashionVerse()"   an inline handler             ║
   ║    _safe('renderProfile')           the router's indirection      ║
   ║                                                                   ║
   ║  Neither is a reference anything checks. Rename the target, or    ║
   ║  defer the module holding it, and the call goes quiet — the page  ║
   ║  simply does nothing, or draws the wrong thing, with no error.    ║
   ║                                                                   ║
   ║  That is exactly how this bit us: fashionverse.js's               ║
   ║  renderFashionVerse was renamed to renderFashionVerseShop while   ║
   ║  router.js still asked for the old name, so the pane quietly      ║
   ║  fell through to explore.js's grid instead.                       ║
   ║                                                                   ║
   ║  Three checks:                                                    ║
   ║                                                                   ║
   ║   1. DUPLICATES  a name declared in two modules. Harmless with    ║
   ║      fixed script order - one always won. With modules loaded on  ║
   ║      demand the winner becomes whichever page you opened last,    ║
   ║      so the app behaves differently depending on where you        ║
   ║      clicked first. Any duplicate involving a deferred module is  ║
   ║      an error; the rest are warnings worth clearing.              ║
   ║                                                                   ║
   ║   2. DANGLING  a bare name called from a handler or _safe that    ║
   ║      nothing declares.                                            ║
   ║                                                                   ║
   ║   3. REACH  something loaded at boot calling into a module that   ║
   ║      is not, which only works once that page has been opened.     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const boot = fs.readFileSync(path.join(ROOT, 'js', 'boot.js'), 'utf8');
const lazySrc = fs.readFileSync(path.join(ROOT, 'js', 'lazy.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const eager = [...boot.matchAll(/import '([^'?]+)/g)].map(m => m[1]);
const lazy = [...new Set([...lazySrc.matchAll(/'(\.\/pages\/[^'?]+)/g)].map(m => m[1]))];
const all = [...eager, ...lazy];
const lazySet = new Set(lazy.map(s => s.replace(/^\.\.?\//, '')));

const MARK = 'Global bridge';
const rel = s => s.replace(/^\.\.?\//, '');
const abs = s => path.resolve(ROOT, 'js', s);

function body(s) {
  const src = fs.readFileSync(abs(s), 'utf8');
  const at = src.indexOf(MARK);
  return at === -1 ? src : src.slice(0, src.lastIndexOf('/*', at));
}
function declares(s) {
  const src = fs.readFileSync(abs(s), 'utf8');
  const at = src.indexOf(MARK);
  const out = new Set();
  if (at !== -1) {
    const m = src.slice(at).match(/publish\('[^']*',\s*\{([\s\S]*?)\}\);/);
    if (m) for (const x of m[1].matchAll(/([A-Za-z_$][\w$]*):\s*\(\)/g)) out.add(x[1]);
  }
  for (const m of body(s).matchAll(/(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g)) out.add(m[1]);
  return out;
}

const owners = new Map();
for (const s of all) for (const n of declares(s)) {
  if (!owners.has(n)) owners.set(n, new Set());
  owners.get(n).add(rel(s));
}

/* Provided by the browser, by CSS inside a style-setting handler, or by
   the inline blocks in index.html. */
const KNOWN = new Set(['alert','confirm','prompt','fetch','setTimeout','clearTimeout','setInterval',
  'clearInterval','requestAnimationFrame','open','close','print','scrollTo','focus','blur',
  'Number','String','Boolean','Array','Object','JSON','Math','Date','RegExp','Promise','Map','Set',
  'parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent',
  'handleAuth','signOutUser','db','firebaseAuth',
  'translateY','translateX','translate','scale','rotate','rgba','rgb','var','calc','url','blur',
  'if','for','while','return','typeof','new','function','switch','catch','do','else','void','in','of','await','case']);

/* Strip ${...} with nesting, then method calls. What is left has to be a
   global when the handler fires. */
function bareCalls(handler) {
  let s = handler, depth = 0, out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '$' && s[i + 1] === '{') { depth++; i++; continue; }
    if (depth) { if (s[i] === '{') depth++; else if (s[i] === '}') depth--; continue; }
    out += s[i];
  }
  return [...out.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[2]);
}

const called = new Map();
function scan(src, where) {
  for (const m of src.matchAll(/\bon[a-z]+\s*=\s*(\\?["'])([\s\S]*?)\1/g)) {
    for (const n of bareCalls(m[2])) {
      if (!called.has(n)) called.set(n, new Set());
      called.get(n).add(where);
    }
  }
  for (const m of src.matchAll(/_safe\(\s*'([^']+)'/g)) {
    if (!called.has(m[1])) called.set(m[1], new Set());
    called.get(m[1]).add(where + ' (_safe)');
  }
}
scan(html, 'index.html');
for (const s of all) scan(body(s), rel(s));

let errors = 0, warnings = 0;
console.log(`\n${eager.length} eager + ${lazy.length} deferred modules, ${owners.size} globals\n`);

console.log('1. duplicate globals');
for (const [name, set] of [...owners].sort()) {
  if (set.size < 2) continue;
  const files = [...set];
  const touchesLazy = files.some(f => lazySet.has(f));
  if (touchesLazy) { console.log(`   FAIL ${name}: ${files.join(' + ')}`);
                     console.log(`        one is deferred, so the winner depends on which page was opened first`); errors++; }
  else { console.log(`   warn ${name}: ${files.join(' + ')}`); warnings++; }
}
if (!errors && !warnings) console.log('   ok   every name is declared once');

console.log('\n2. dangling references');
let dangling = 0;
for (const [n, where] of [...called].sort()) {
  if (owners.has(n) || KNOWN.has(n)) continue;
  console.log(`   FAIL ${n}() called in ${[...where].join(', ')} — nothing declares it`);
  dangling++; errors++;
}
if (!dangling) console.log('   ok   every name called from a handler or _safe exists');

console.log('\n3. eager code reaching into a deferred module');
let reach = 0;
for (const [n, where] of [...called].sort()) {
  const own = owners.get(n);
  if (!own) continue;
  const inLazy = [...own].filter(o => lazySet.has(o));
  if (!inLazy.length) continue;
  const from = [...where].filter(w => {
    const f = w.replace(/\s.*$/, '');
    return f !== 'index.html' && !lazySet.has(f) && !inLazy.includes(f);
  });
  if (!from.length) continue;
  const viaRouter = from.every(f => f.startsWith('router.js'));
  if (viaRouter) continue;                    // the router awaits the page first
  console.log(`   warn ${n}() is in ${inLazy.join('/')} but called from ${from.join(', ')}`);
  warnings++; reach++;
}
if (!reach) console.log('   ok   nothing loaded at boot calls into a deferred module unguarded');

console.log(`\n${errors} error(s), ${warnings} warning(s)\n`);
process.exitCode = errors ? 1 : 0;
