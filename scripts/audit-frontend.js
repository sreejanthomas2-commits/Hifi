/* ╔══════════════════════════════════════════════════════════════════╗
   ║  FRONT-END AUDIT —  node scripts/audit-frontend.js                ║
   ║                                                                   ║
   ║  Finds the bugs the compiler cannot, because this app calls most  ║
   ║  of its own code through strings:                                 ║
   ║                                                                   ║
   ║    onclick="renderExplore()"        an inline handler             ║
   ║    _safe('renderProfile')           the router's indirection      ║
   ║                                                                   ║
   ║  Neither is a reference anything checks. Rename the target, or    ║
   ║  defer the module holding it, and the call goes quiet — the page  ║
   ║  simply does nothing, or draws the wrong thing, with no error.    ║
   ║                                                                   ║
   ║  That is exactly how this bit us once: a page module's render     ║
   ║  function was renamed while router.js still asked for the old     ║
   ║  name, so the pane quietly drew a different file's grid           ║
   ║  instead, with nothing reported anywhere.                         ║
   ║                                                                   ║
   ║  Three checks:                                                    ║
   ║                                                                   ║
   ║   1. DUPLICATES  two modules both PROVIDING one name. Harmless    ║
   ║      with fixed script order - one always won. With modules       ║
   ║      loaded on demand the winner becomes whichever page you       ║
   ║      opened last, so the app behaves differently depending on     ║
   ║      where you clicked first. Any duplicate involving a deferred  ║
   ║      module is an error; the rest are warnings worth clearing.    ║
   ║                                                                   ║
   ║      Providing is not the same as touching. Three things look     ║
   ║      alike in the source and are not alike at all:                ║
   ║                                                                   ║
   ║        window.navigateTo = wrapped, after reading window.navi-    ║
   ║            gateTo — a DECORATOR. components/mobile.js and         ║
   ║            features/discover.js both do this deliberately, and    ║
   ║            the chain is the feature.                              ║
   ║        window.liveBtcPrice = price — a VALUE written into shared  ║
   ║            state another module seeded. utils/api.js and          ║
   ║            features/marketdata.js co-own the price table.         ║
   ║        window.renderCommunity = function () {…} — a second        ║
   ║            IMPLEMENTATION. Only this is a problem, and only this  ║
   ║            is reported.                                           ║
   ║                                                                   ║
   ║   2. DANGLING  a bare name called from a handler or _safe that    ║
   ║      nothing declares.                                            ║
   ║                                                                   ║
   ║   3. REACH  something loaded at boot calling into a module that   ║
   ║      is not, which only works once that page has been opened.     ║
   ║      A call the router makes after awaiting the page, or one      ║
   ║      chained on navigateTo('pane').then(…), is waiting for the    ║
   ║      module rather than reaching into it.                         ║
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
/* pane name -> the module that draws it, so check 3 can tell whether a
   navigateTo('pane').then(...) is awaiting the module it then calls. */
const paneOf = new Map([...lazySrc.matchAll(/(\w+):\s*'(\.\/pages\/[^'?]+)/g)]
  .map(m => [m[1], m[2].replace(/^\.\.?\//, '')]));

const MARK = 'Global bridge';
const rel = s => s.replace(/^\.\.?\//, '');
const abs = s => path.resolve(ROOT, 'js', s);

function body(s) {
  const src = fs.readFileSync(abs(s), 'utf8');
  const at = src.indexOf(MARK);
  return at === -1 ? src : src.slice(0, src.lastIndexOf('/*', at));
}

/* An assignment is a single =. Without the lookarounds this also matches
   the = inside ===, so every `typeof window.foo === 'function'` guard
   reads as a declaration and half the app appears to declare everything. */
const ASSIGN = /(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*(?<![=!<>+\-*/%&|^])=(?!=)/g;
/* What sits on the right of it. A function, arrow or class is an
   implementation; anything else is a value. */
const FN_RHS = /^\s*(?:async\s+)?(?:function\b|class\b|\(|[A-Za-z_$][\w$]*\s*=>)/;

/* The names a module PROVIDES: whatever its bridge publishes, plus any
   global it assigns a function to. A global it assigns after reading —
   `const nav = window.navigateTo; … window.navigateTo = wrapped` — is a
   decorator, and decorating is not providing. */
function provides(s) {
  const src = fs.readFileSync(abs(s), 'utf8');
  const at = src.indexOf(MARK);
  const out = new Set();
  if (at !== -1) {
    const m = src.slice(at).match(/publish\('[^']*',\s*\{([\s\S]*?)\}\);/);
    if (m) for (const x of m[1].matchAll(/([A-Za-z_$][\w$]*):\s*\(\)/g)) out.add(x[1]);
  }
  const src2 = body(s);
  const rhs = new Map();                                  // name -> [text after =]
  for (const m of src2.matchAll(ASSIGN)) {
    const at2 = m.index + m[0].length;
    if (!rhs.has(m[1])) rhs.set(m[1], []);
    rhs.get(m[1]).push(src2.slice(at2, at2 + 60));
  }
  for (const [name, sides] of rhs) {
    const mentions = (src2.match(new RegExp('(?:window|globalThis)\\.' + name + '\\b', 'g')) || []).length;
    if (mentions > sides.length) continue;                // reads it too: decorator or lazy init
    if (sides.some(r => FN_RHS.test(r))) out.add(name);
  }
  return out;
}

/* Every name a module puts on the global object, however it got there.
   Checks 2 and 3 only care that the name exists and where it came from. */
function touches(s) {
  const out = new Set(provides(s));
  for (const m of body(s).matchAll(ASSIGN)) out.add(m[1]);
  return out;
}

const owners = new Map();       // name -> files that touch it
const givers = new Map();       // name -> files that provide an implementation
for (const s of all) {
  for (const n of touches(s)) {
    if (!owners.has(n)) owners.set(n, new Set());
    owners.get(n).add(rel(s));
  }
  for (const n of provides(s)) {
    if (!givers.has(n)) givers.set(n, new Set());
    givers.get(n).add(rel(s));
  }
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

/* navigateTo('reels').then(() => openShortyPopup(2)) runs its call after
   reels.js has loaded. Returns the panes awaited around a call to
   `name`, so check 3 can tell waiting apart from reaching. */
function awaitedPanes(handler, name) {
  const out = [];
  for (const m of handler.matchAll(/navigateTo\(\s*'([^']+)'\s*\)\s*\.then\(([\s\S]*)/g)) {
    if (new RegExp('\\b' + name + '\\s*\\(').test(m[2])) out.push(m[1]);
  }
  return out;
}

const called = new Map();       // name -> Set('file' or 'file (_safe)')
const guarded = new Map();      // name -> Set(pane awaited before the call)
function scan(src, where) {
  for (const m of src.matchAll(/\bon[a-z]+\s*=\s*(\\?["'])([\s\S]*?)\1/g)) {
    for (const n of bareCalls(m[2])) {
      if (!called.has(n)) called.set(n, new Set());
      called.get(n).add(where);
      for (const p of awaitedPanes(m[2], n)) {
        if (!guarded.has(n)) guarded.set(n, new Set());
        guarded.get(n).add(p);
      }
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
for (const [name, set] of [...givers].sort()) {
  if (set.size < 2) continue;
  const files = [...set];
  const touchesLazy = files.some(f => lazySet.has(f));
  if (touchesLazy) { console.log(`   FAIL ${name}: ${files.join(' + ')}`);
                     console.log(`        one is deferred, so the winner depends on which page was opened first`); errors++; }
  else { console.log(`   warn ${name}: ${files.join(' + ')}`); warnings++; }
}
if (!errors && !warnings) console.log('   ok   every name is implemented once');

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
  /* Awaited by name: navigateTo('reels').then(() => …) loads the very
     module the call needs. */
  if ([...(guarded.get(n) || [])].some(p => inLazy.includes(paneOf.get(p)))) continue;
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
