/* ╔══════════════════════════════════════════════════════════════════╗
   ║  TRADE TESTS —  node scripts/test-trade.js                        ║
   ║                                                                   ║
   ║  The spot desk is a paper account, but its arithmetic is what     ║
   ║  every balance on Spot is built from. The cases that matter:      ║
   ║                                                                   ║
   ║  · a limit already through the market fills AT the market, not    ║
   ║    at the limit (it used to pay the limit: 2x the price for a     ║
   ║    buy typed at 2x)                                               ║
   ║  · an open order sets its funds aside, and nothing else — a       ║
   ║    second order, a transfer, a swap — can spend them              ║
   ║  · a stop-limit waits for its trigger, refuses a trigger already  ║
   ║    crossed, then behaves as a limit                               ║
   ║  · a remembered (stale) price is never traded                     ║
   ║                                                                   ║
   ║  trade.js is evaluated as the browser runs it, with the few       ║
   ║  globals it reaches for stubbed — no second copy of the logic.    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}
const ok = (name, cond) => check(name, !!cond, true);
const near = (name, got, want, eps) => check(name, Math.abs(got - want) < (eps || 1e-6) ? 'yes' : `${got}`, 'yes');

/* The module's own import/publish bridge can't run in script mode and
   isn't needed here, so it is trimmed; the body runs unchanged. */
function readModule(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', rel), 'utf8');
  const at = src.indexOf('Global bridge');
  return at === -1 ? src : src.slice(0, src.lastIndexOf('/*', at));
}

function makeWorld(opts) {
  const o = opts || {};
  const store = {};
  if (o.saved) store.ts_trade = JSON.stringify(o.saved);
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const toasts = [];
  const ctx = {
    window: {},
    localStorage,
    document: { getElementById: id => (o.nodes && o.nodes[id]) || null },
    showToast: m => toasts.push(m),
    setTimeout, console
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  /* Prices are swapped as a whole object, the way the feed replaces
     window.liveCryptoPrices, so the desk's per-task cache sees the change. */
  const setPrices = p => { ctx.window.liveCryptoPrices = p; };
  setPrices(o.prices || { BTC: { usd: 100, name: 'Bitcoin' }, ETH: { usd: 10, name: 'Ethereum' } });
  vm.runInContext(readModule('pages/trade.js'), ctx);
  return { TR: ctx.window.TR, setPrices, toasts, store };
}

const FEE = 0.001;

console.log('\na limit through the market fills at the market');
{
  const w = makeWorld();
  const TR = w.TR;
  const r = TR.placeOrder('buy', 'BTC', 'limit', 1, 200);
  ok('a buy limited at twice the price fills now', r.ok && r.filled);
  near('  at the market, not the limit', TR.state.fills[0].price, 100);
  near('  so it costs the market price plus the fee', 100000 - TR.state.cash, 100 * (1 + FEE));
  const s = TR.placeOrder('sell', 'BTC', 'limit', 1, 50);
  ok('a sell limited at half the price fills now', s.ok && s.filled);
  near('  also at the market', TR.state.fills[0].price, 100);
  near('  and a round trip costs only the two fees', 100000 - TR.state.cash, 100 * FEE * 2);
}

console.log('\nan open buy sets its cash aside');
{
  const w = makeWorld();
  const TR = w.TR;
  const r = TR.placeOrder('buy', 'BTC', 'limit', 600, 50);          // 30,000 + fee, resting
  ok('a buy below the market rests', r.ok && !r.filled);
  near('  its cash is held', TR.lockedOf('USDT'), 600 * 50 * (1 + FEE));
  near('  and no longer available', TR.availableOf('USDT'), 100000 - 600 * 50 * (1 + FEE));
  check('  though it is still yours', TR.state.cash, 100000);
  const big = TR.placeOrder('buy', 'BTC', 'limit', 1500, 50);        // 75,075 > the 69,970 left
  ok('a second buy bigger than what is left is refused', !big.ok);
  ok('  and says the rest is in open orders', /open orders/.test(big.msg));
  check('  one order on the book', TR.state.orders.length, 1);
  ok('the held cash cannot be debited by another feature', !TR.debitAsset('USDT', 99000));
  ok('  while free cash can', TR.debitAsset('USDT', 100));
  TR.cancelOrder(TR.state.orders[0].id);
  check('cancelling releases it', TR.lockedOf('USDT'), 0);
  near('  every dollar back', TR.availableOf('USDT'), 100000 - 100);
}

console.log('\nan open sell sets its coins aside');
{
  const w = makeWorld({ saved: { cash: 0, holdings: { BTC: { qty: 2, avgCost: 80 } }, orders: [], fills: [] } });
  const TR = w.TR;
  ok('a sell above the market rests', TR.placeOrder('sell', 'BTC', 'limit', 1.5, 150).ok);
  near('  1.5 BTC are held', TR.lockedOf('BTC'), 1.5);
  near('  0.5 are free', TR.availableOf('BTC'), 0.5);
  ok('the held coins cannot leave another way', !TR.debitAsset('BTC', 1));
  ok('  the free ones can', TR.debitAsset('BTC', 0.5));
  ok('a market sell of held coins is refused', !TR.placeOrder('sell', 'BTC', 'market', 0.1).ok);
}

console.log('\na resting order fills at its own price when the market moves through');
{
  const w = makeWorld();
  const TR = w.TR;
  TR.placeOrder('buy', 'BTC', 'limit', 2, 90);
  TR.matchOpenOrders();
  check('nothing happens while the market is above', TR.state.orders.length, 1);
  w.setPrices({ BTC: { usd: 85, name: 'Bitcoin' }, ETH: { usd: 10 } });
  TR.matchOpenOrders();
  check('the market falls through: it fills', TR.state.orders.length, 0);
  near('  at the limit, a maker price', TR.state.fills[0].price, 90);
  near('  holding two BTC', TR.holding('BTC').qty, 2);
  check('  and the lock is gone', TR.lockedOf('USDT'), 0);
  check('the order history says filled', TR.state.history[0].status, 'filled');
}

console.log('\nstop-limit');
{
  const w = makeWorld();
  const TR = w.TR;
  ok('a buy stop at or below the market is refused', !TR.placeOrder('buy', 'BTC', 'stop', 1, 110, 100).ok);
  ok('a sell stop above the market is refused', !TR.placeOrder('sell', 'BTC', 'stop', 1, 90, 105).ok);
  ok('no stop price is refused', !TR.placeOrder('buy', 'BTC', 'stop', 1, 110, 0).ok);
  const r = TR.placeOrder('buy', 'BTC', 'stop', 1, 112, 110);
  ok('a buy stop above the market is placed', r.ok && !r.filled);
  near('  holding cash at its limit', TR.lockedOf('USDT'), 112 * (1 + FEE));
  w.setPrices({ BTC: { usd: 105, name: 'Bitcoin' }, ETH: { usd: 10 } });
  TR.matchOpenOrders();
  check('below the stop it waits', TR.state.orders[0].type, 'stop');
  w.setPrices({ BTC: { usd: 111, name: 'Bitcoin' }, ETH: { usd: 10 } });
  TR.matchOpenOrders();
  check('through the stop it triggers and fills', TR.state.orders.length, 0);
  near('  at the market, inside the limit', TR.state.fills[0].price, 111);
  check('  history marks it a stop', TR.state.history[0].type, 'stop');

  // Gapped past the limit: the stop triggers, the limit rests.
  TR.placeOrder('buy', 'BTC', 'stop', 1, 113, 112);
  w.setPrices({ BTC: { usd: 120, name: 'Bitcoin' }, ETH: { usd: 10 } });
  TR.matchOpenOrders();
  check('a gap past the limit triggers the stop', TR.state.orders[0].type, 'limit');
  check('  and leaves the limit resting, unfilled', TR.state.orders.length, 1);
}

console.log('\na sell stop limits a loss');
{
  const w = makeWorld({ saved: { cash: 0, holdings: { BTC: { qty: 1, avgCost: 100 } }, orders: [], fills: [] } });
  const TR = w.TR;
  ok('a sell stop below the market is placed', TR.placeOrder('sell', 'BTC', 'stop', 1, 89, 90).ok);
  check('  the coin is held', TR.availableOf('BTC'), 0);
  w.setPrices({ BTC: { usd: 89.5, name: 'Bitcoin' }, ETH: { usd: 10 } });
  TR.matchOpenOrders();
  check('the price falls to the stop: sold', TR.holding('BTC').qty, 0);
  near('  at the better of market and limit', TR.state.fills[0].price, 89.5);
}

console.log('\ncancel all, and starting over');
{
  const w = makeWorld();
  const TR = w.TR;
  TR.placeOrder('buy', 'BTC', 'limit', 1, 50);
  TR.placeOrder('buy', 'ETH', 'limit', 10, 5);
  TR.cancelAll().then(() => {
    check('cancel all empties the book', TR.state.orders.length, 0);
    check('  releases every lock', TR.lockedOf('USDT'), 0);
    check('  and logs both as cancelled', TR.state.history.filter(h => h.status === 'cancelled').length, 2);
    TR.placeOrder('buy', 'BTC', 'market', 3);
    return TR.resetAccount();
  }).then(() => {
    check('a reset puts the cash back', TR.state.cash, 100000);
    check('  clears the holdings', Object.keys(TR.state.holdings).length, 0);
    check('  and the history', TR.state.history.length, 0);
    done();
  });
}

function stale() {
  console.log('\na remembered price is never traded');
  const w = makeWorld({ prices: { BTC: { usd: 100, name: 'Bitcoin', stale: true }, ETH: { usd: 10 } } });
  const r = w.TR.placeOrder('buy', 'BTC', 'market', 1);
  ok('a market buy at a stale price is refused', !r.ok);
  ok('  and says why', /last known price/.test(r.msg));
  check('  with nothing spent', w.TR.state.cash, 100000);
}

/* A pair with no real book shows no book. The panel used to draw seven
   levels of seeded numbers labelled "simulated depth" - liquidity that
   does not exist. */
function noFakeBook() {
  console.log('\nno invented order book');
  const nodes = { 'tr-book-body': { innerHTML: '' }, 'tr-book-src': { className: '', textContent: '' } };
  const w = makeWorld({ nodes });
  w.TR.paintBook();
  const html = nodes['tr-book-body'].innerHTML;
  ok('a pair with no live book says there is none', /No order book for this pair/.test(html));
  ok('  and draws no price levels', !/tr-depth-row/.test(html));
  check('  the source label says so', nodes['tr-book-src'].textContent, 'no order book');
  ok('  and never "simulated depth"', !/simulated depth/.test(html + nodes['tr-book-src'].textContent));
}

function done() {
  stale();
  noFakeBook();
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}
