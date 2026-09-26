/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CRYPTO HUB TESTS —  node scripts/test-cryptohub.js               ║
   ║                                                                   ║
   ║  · the hub draws what the server's switchboard says               ║
   ║  · server down: the app's own catalogue at its starting states,   ║
   ║    and a note saying so; both down: a problem card that answers   ║
   ║    the six questions, and a way to try again                      ║
   ║  · a tile that can't be used explains itself instead of opening,  ║
   ║    and offers the alternative where there is one                  ║
   ║  · available + locked = total; pending is not in the total        ║
   ║  · whatever the server sends is text, never markup                ║
   ║                                                                   ║
   ║  finui.js and cryptohub.js run as the browser runs them, with     ║
   ║  fetch and the other modules stubbed.                             ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SB = require('../services/products');

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}
const ok = (name, cond) => check(name, !!cond, true);

function readModule(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', rel), 'utf8');
  const at = src.indexOf('Global bridge');
  return at === -1 ? src : src.slice(0, src.lastIndexOf('/*', at));
}
const CATALOGUE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'data', 'crypto-products.json'), 'utf8'));
const serverBoard = () => JSON.parse(JSON.stringify(SB.list(SB.load({}), { country: null, kyc: 0 })));

function makeWorld(opts) {
  const o = opts || {};
  const root = { innerHTML: '' };
  const calls = [];
  const answer = { yes: true };
  const respond = (body, status) => Promise.resolve({ ok: (status || 200) < 400, status: status || 200, json: () => Promise.resolve(body) });
  const ctx = {
    window: {},
    document: {
      getElementById: id => (id === 'ch-root' ? root : null),
      querySelector: () => null,
      querySelectorAll: () => []
    },
    navigator: { onLine: true },
    fetch: url => {
      calls.push('fetch ' + url);
      if (url === '/api/products') return o.server === undefined ? respond(serverBoard()) : o.server();
      if (url.endsWith('crypto-products.json')) return o.local === undefined ? respond(CATALOGUE) : o.local();
      return Promise.reject(new Error('unexpected ' + url));
    },
    setTimeout, clearTimeout,
    appAlert: (msg, op) => { calls.push('alert ' + op.title); return Promise.resolve(true); },
    appConfirm: (msg, op) => { calls.push('confirm ' + op.title + ' / ' + op.ok); return Promise.resolve(answer.yes); },
    showToast: m => calls.push('toast ' + m),
    navigateTo: p => { calls.push('go ' + p); return Promise.resolve(); },
    SC: { open: () => calls.push('open send') },
    CVT: { open: () => calls.push('open convert') },
    DEP: { open: () => calls.push('open deposit') },
    MNY: o.MNY || {
      netWorth: () => ({ total: 1200, wallet: 1000, earn: 200, unpriced: 0 }),
      price: s => ({ USDT: 1, BTC: 100 })[s] || 0,
      usd: v => '$' + Number(v).toFixed(2)
    },
    TR: o.TR || { state: { orders: [{ sym: 'BTC', quote: 'USDT' }] }, lockedOf: s => (s === 'USDT' ? 100 : 0), setType: t => calls.push('type ' + t) },
    P2P: o.P2P || { state: { orders: [
      { side: 'sell', status: 'awaiting_payment', coin: 'USDT', qty: 50 },
      { side: 'buy', status: 'paid', coin: 'USDT', qty: 20 },
      { side: 'sell', status: 'completed', coin: 'USDT', qty: 999 }
    ] } },
    console
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readModule('components/finui.js'), ctx, { filename: 'finui.js' });
  vm.runInContext(readModule('pages/cryptohub.js'), ctx, { filename: 'cryptohub.js' });
  return { CXH: ctx.CXH, root, calls, answer, ctx };
}
const settle = () => new Promise(r => setTimeout(r, 20));

(async () => {
  console.log('\nfrom the server');
  {
    const w = makeWorld();
    w.CXH.paint();
    ok('shows a loading skeleton first', w.root.innerHTML.includes('fui-skel'));
    await settle();
    const html = w.root.innerHTML;
    check('then the board, from the server', w.CXH.source, 'server');
    check('a tile for every product', (html.match(/class="ch-tile( ch-tile-off)?"/g) || []).length, CATALOGUE.products.length);
    ok('practice products are chipped Practice', html.includes('ch-chip ch-sandbox">Practice'));
    ok('nothing is chipped Real money', !html.includes('Real money</span>'));
    ok('the card tile says why, not a promise', /Trending Card.*?Unavailable.*?card-issuing partner/s.test(html));
    ok('the five quick actions are there', ['Deposit', 'Withdraw', 'Send', 'Receive', 'Convert'].every(n => html.includes(`<span>${n}</span>`)));
    ok('the legend explains the chips', html.includes('uses paper money kept on this device'));
  }

  console.log('\nthe balance');
  {
    const w = makeWorld();
    const b = w.CXH.balances();
    check('available is the wallet less open orders', b.available, 900);
    check('locked is open orders + P2P escrow + Earn', b.locked, 350);
    check('total is available + locked', b.total, 1250);
    check('pending is what is on its way', b.pending, 20);
    w.CXH.paint(); await settle();
    ok('the card says it is practice money', w.root.innerHTML.includes('Nothing here is real money'));
    ok('  and what is locked', w.root.innerHTML.includes('open orders, P2P escrow, Earn'));
  }

  console.log('\nwhat a tap does');
  {
    const w = makeWorld();
    w.CXH.paint(); await settle();
    await w.CXH.tap('convert');
    ok('a usable tile opens its screen', w.calls.includes('open convert'));
    await w.CXH.tap('buysell');
    ok('Buy / Sell opens the desk on a market order', w.calls.includes('go trade') && w.calls.includes('type market'));
    await w.CXH.tap('card');
    ok('an unavailable tile explains itself', w.calls.includes("alert Trending Card isn't available"));
    await w.CXH.tap('remit');
    ok('a coming one says it is coming', w.calls.includes('alert Send money abroad is coming'));
    w.answer.yes = true;
    await w.CXH.tap('withdraw');
    ok('withdraw offers sending from your own wallet', w.calls.includes("confirm Withdraw crypto isn't available / Send from your wallet"));
    ok('  and opens Send when you take it', w.calls.includes('open send'));
    await w.CXH.tap('nope');
    check('an unknown product does nothing', w.calls.filter(c => /nope/.test(c)).length, 0);
  }

  console.log('\nserver unreachable');
  {
    const w = makeWorld({ server: () => Promise.reject(new Error('offline')) });
    w.CXH.paint(); await settle();
    check('falls back to the app\'s own catalogue', w.CXH.source, 'local');
    ok('says it is doing that', w.root.innerHTML.includes("server couldn't be reached"));
    const states = w.CXH.board.products.map(p => p.id + ':' + p.state).join(',');
    check('at the starting states', states, CATALOGUE.products.map(p => p.id + ':' + p.base).join(','));
    const bad = makeWorld({ server: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ products: 'nope' }) }) });
    bad.CXH.paint(); await settle();
    check('a malformed answer is treated as no answer', bad.CXH.source, 'local');
  }

  console.log('\neverything unreachable');
  {
    const down = () => Promise.reject(new Error('offline'));
    const w = makeWorld({ server: down, local: down });
    w.CXH.paint(); await settle();
    const html = w.root.innerHTML;
    ok('a problem card, not a blank page', html.includes('fui-problem'));
    ['What happened', 'Your money', 'Status now', 'Do you need to act?', 'Help'].forEach(k =>
      ok(`  it answers "${k}"`, html.includes(`<dt>${k}</dt>`)));
    ok('  says the money is safe', html.includes('Nothing was sent or changed'));
    ok('  and offers Try again', html.includes('onclick="CXH.retry()"'));
  }

  console.log('\nwhat the server sends is text');
  {
    const board = serverBoard();
    board.products[0].name = '<img src=x onerror=alert(1)>';
    board.products[0].note = '"><script>alert(2)</script>';
    const w = makeWorld({ server: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(board) }) });
    w.CXH.paint(); await settle();
    ok('a name cannot become markup', !w.root.innerHTML.includes('<img src=x'));
    ok('  nor a note', !w.root.innerHTML.includes('<script>'));
    ok('  they show as text', w.root.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
    board.products[0].id = "x');alert(1);('";
    const w2 = makeWorld({ server: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(board) }) });
    w2.CXH.paint(); await settle();
    ok('an id cannot break out of its onclick', !w2.root.innerHTML.includes("tap(\"x');alert"));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
