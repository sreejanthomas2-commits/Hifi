/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CONVERT TESTS —  node scripts/test-convert.js                    ║
   ║                                                                   ║
   ║  A conversion is two ledger movements that have to agree with a   ║
   ║  rate the person was shown. The cases that matter:                ║
   ║                                                                   ║
   ║  · the output matches the rate on the button, fee included        ║
   ║  · value is conserved — what leaves, minus the fee, is what       ║
   ║    arrives, priced at the same moment                             ║
   ║  · a token priced by declared reference is refused BY NAME, not   ║
   ║    converted at a number the app invented                         ║
   ║  · if the rate moves between preview and confirm, nothing is      ║
   ║    converted and the new figure comes back instead                ║
   ║  · a failed second leg puts the first one back                    ║
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
const near = (name, got, want, eps) =>
  check(name, Math.abs(got - want) < (eps || 1e-9) ? 'yes' : `${got} (wanted ${want})`, 'yes');

/* Just enough DOM for the sheet to mount into: the module creates one
   scrim, looks it up by id and removes it on close. Nothing is rendered
   — the tests here are about the money, and the markup is checked in the
   browser. */
function makeDoc() {
  const nodes = {};
  const mk = () => {
    const el = { id: '', className: '', innerHTML: '', style: {},
      addEventListener() {}, focus() {},
      remove() { delete nodes[el.id]; } };
    return el;
  };
  return {
    getElementById: id => nodes[id] || null,
    querySelector: () => null,
    createElement: mk,
    body: { appendChild(el) { nodes[el.id] = el; } }
  };
}

/* These files are ES modules in the browser now. Each ends with a bridge
   that imports publish() and republishes its names on window - machinery
   the browser needs and this harness does not, and an `import` statement
   cannot run in vm.runInContext's script mode. So the bridge is trimmed
   and the module body runs as it always did. */
function readModule(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', rel), 'utf8');
  const at = src.indexOf('Global bridge');
  return at === -1 ? src : src.slice(0, src.lastIndexOf('/*', at));
}

function makeWorld(opts) {
  const o = opts || {};
  const store = {};
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };

  const raw = Object.assign({ USDT: 1000, BTC: 2, TREND: 5000 }, o.funding || {});
  const DATA = { wallet: { balances: raw } };

  const T = { cash: o.spotCash != null ? o.spotCash : 0, holdings: Object.assign({}, o.holdings) };
  const TR = {
    get state() { return T; },
    availableOf: s => (s === 'USDT' ? T.cash : (T.holdings[s] ? T.holdings[s].qty : 0)),
    debitAsset(s, q) {
      if (!(q > 0)) return false;
      if (s === 'USDT') { if (T.cash < q) return false; T.cash -= q; return true; }
      const h = T.holdings[s];
      if (!h || h.qty < q - 1e-12) return false;
      h.qty -= q;
      if (h.qty <= 1e-12) delete T.holdings[s];
      return true;
    },
    creditAsset(s, q) {
      if (!(q > 0)) return false;
      if (s === 'USDT') { T.cash += q; return true; }
      T.holdings[s] = T.holdings[s] || { qty: 0, avgCost: 0 };
      T.holdings[s].qty += q;
      return true;
    },
    repaint() {}
  };

  const prices = Object.assign({
    BTC: { usd: 100, name: 'Bitcoin', change24h: 0 },
    SOL: { usd: 4, name: 'Solana', change24h: 0 },
    ETH: { usd: 50, name: 'Ethereum', change24h: 0 }
  }, o.prices || {});

  const ctx = {
    window: { liveCryptoPrices: prices },
    localStorage, DATA, TR,
    document: makeDoc(),
    console
  };
  ctx.window.localStorage = localStorage;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  const load = rel => vm.runInContext(readModule(rel), ctx);
  load('features/money.js');
  load('features/convert.js');
  return { MNY: ctx.window.MNY, CVT: ctx.window.CVT, prices, DATA, TR, T, ctx };
}

console.log('\nwhat can be converted');
{
  const w = makeWorld();
  const { CVT } = w;
  check('a live coin can', CVT.canConvert('BTC'), true);
  check('a stablecoin can', CVT.canConvert('USDT'), true);
  check('a reference-priced token cannot', CVT.canConvert('TREND'), false);
  ok('  and it is refused by name, not by silence', /TREND/.test(CVT.whyNot('TREND')));
  ok('  saying why — a reference is not a market', /reference/i.test(CVT.whyNot('TREND')));
  check('an unknown coin cannot', CVT.canConvert('NOSUCH'), false);
  ok('  with its own reason', /no price/i.test(CVT.whyNot('NOSUCH')));
  ok('the picker offers only convertible coins', CVT.options().every(s => CVT.canConvert(s)));
  ok('  which excludes the reference token', !CVT.options().includes('TREND'));
}

console.log('\nthe quote');
{
  const w = makeWorld();
  const { CVT } = w;
  const q = CVT.quote('BTC', 'SOL', 1);
  check('it works', q.ok, true);
  /* BTC $100, SOL $4, 1% fee: 100 * 0.99 / 4 = 24.75 */
  near('  the output is the rate after the fee', q.out, 24.75);
  near('  the rate is what one unit becomes', q.rate, 24.75);
  near('  the fee is taken in the coin you paid', q.feeQty, 0.01);
  near('  and reported in dollars too', q.feeUsd, 1);
  near('  the value in is the market value', q.usdIn, 100);
  near('  ten units scale linearly', CVT.quote('BTC', 'SOL', 10).out, 247.5);

  check('the same coin twice is refused', CVT.quote('BTC', 'BTC', 1).ok, false);
  check('a missing coin is refused', CVT.quote('', 'SOL', 1).ok, false);
  check('zero is refused', CVT.quote('BTC', 'SOL', 0).ok, false);
  check('  but the rate is still offered', CVT.quote('BTC', 'SOL', 0).rate > 0, true);
  check('a negative amount is refused', CVT.quote('BTC', 'SOL', -1).ok, false);
  check('nonsense is refused', CVT.quote('BTC', 'SOL', 'abc').ok, false);
  check('a reference token on either side is refused', CVT.quote('TREND', 'SOL', 1).ok, false);
  check('  in both directions', CVT.quote('SOL', 'TREND', 1).ok, false);
  check('more than you hold is flagged', CVT.quote('BTC', 'SOL', 99).short, true);
  check('  but still quotes, so the screen can show the shortfall', CVT.quote('BTC', 'SOL', 99).ok, true);
  check('case does not matter', CVT.quote('btc', 'sol', 1).ok, true);
}

console.log('\nvalue is conserved, less the fee');
{
  const w = makeWorld();
  const { CVT, MNY } = w;
  const before = MNY.balanceOf('BTC', 'funding') * MNY.price('BTC') + MNY.balanceOf('SOL', 'funding') * MNY.price('SOL');
  const r = CVT.execute('BTC', 'SOL', 1);
  check('it converts', r.ok, true);
  const after = MNY.balanceOf('BTC', 'funding') * MNY.price('BTC') + MNY.balanceOf('SOL', 'funding') * MNY.price('SOL');
  near('  the only value lost is the fee', before - after, 1, 1e-9);
  near('  one BTC left', MNY.balanceOf('BTC', 'funding'), 1);
  near('  and the SOL arrived', MNY.balanceOf('SOL', 'funding'), 24.75);
  ok('  the message names both sides', /BTC/.test(r.msg) && /SOL/.test(r.msg));
}

console.log('\nboth legs reach the ledger');
{
  const w = makeWorld();
  const { CVT, MNY } = w;
  CVT.execute('BTC', 'SOL', 1);
  const rows = MNY.ledger();
  check('two entries', rows.length, 2);
  check('  the coin received is on top', rows[0].sym, 'SOL');
  check('    marked incoming', rows[0].dir, 'in');
  check('    via Convert', rows[0].via, 'Convert');
  check('  the coin paid is beneath', rows[1].sym, 'BTC');
  check('    marked outgoing', rows[1].dir, 'out');
  check('  and each one is valued', rows[0].value > 0 && rows[1].value > 0, true);
}

console.log('\nit reaches Spot when Funding is short');
{
  const w = makeWorld({ funding: { BTC: 1 }, holdings: { BTC: { qty: 3, avgCost: 90 } } });
  const { CVT, MNY } = w;
  const r = CVT.execute('BTC', 'SOL', 2);
  check('the conversion goes through', r.ok, true);
  check('  the shortfall came from Spot', r.moved, 1);
  near('  spot is down by it', MNY.balanceOf('BTC', 'spot'), 2);
  near('  and the SOL arrived in funding', MNY.balanceOf('SOL', 'funding'), 49.5);
}

console.log('\na refusal converts nothing');
{
  const w = makeWorld();
  const { CVT, MNY } = w;
  const snap = { btc: MNY.balanceOf('BTC', 'funding'), sol: MNY.balanceOf('SOL', 'funding') };

  check('more than you hold is refused', CVT.execute('BTC', 'SOL', 99).ok, false);
  ok('  and says what you hold', /You hold/.test(CVT.execute('BTC', 'SOL', 99).msg));
  check('a reference token is refused', CVT.execute('TREND', 'SOL', 10).ok, false);
  check('the same coin twice is refused', CVT.execute('BTC', 'BTC', 1).ok, false);
  check('zero is refused', CVT.execute('BTC', 'SOL', 0).ok, false);

  near('  BTC untouched', MNY.balanceOf('BTC', 'funding'), snap.btc);
  near('  SOL untouched', MNY.balanceOf('SOL', 'funding'), snap.sol);
  check('  and nothing was written to the ledger', MNY.ledger().length, 0);
}

console.log('\nthe rate moving between preview and confirm');
{
  const w = makeWorld();
  const { CVT, MNY, prices } = w;
  const preview = CVT.quote('BTC', 'SOL', 1);
  near('the preview says 24.75 SOL', preview.out, 24.75);

  /* SOL doubles while the review screen is on the glass. */
  prices.SOL.usd = 8;
  const r = CVT.execute('BTC', 'SOL', 1, { expect: preview.out });
  check('the conversion is refused', r.ok, false);
  check('  and flagged as a move, not an error', r.moved, true);
  near('  the new figure comes back', r.quote.out, 12.375);
  ok('  the message carries it', /12.375/.test(r.msg));
  near('  nothing was converted', MNY.balanceOf('BTC', 'funding'), 2);
  check('  and nothing was written', MNY.ledger().length, 0);

  const agreed = CVT.execute('BTC', 'SOL', 1, { expect: r.quote.out });
  check('agreeing to the new figure works', agreed.ok, true);
  near('  at the new rate', MNY.balanceOf('SOL', 'funding'), 12.375);
}

console.log('\na twitch in the price is not a rate move');
{
  const w = makeWorld();
  const { CVT, prices } = w;
  const preview = CVT.quote('BTC', 'SOL', 1);
  prices.SOL.usd = 4.008;                 // 0.2%, inside the threshold
  const r = CVT.execute('BTC', 'SOL', 1, { expect: preview.out });
  check('it goes through', r.ok, true);
  ok('  at the price of the moment, not the stale one', Math.abs(r.out - 24.7) < 0.06);
}

console.log('\nthe sheet opens on something sensible');
{
  const w = makeWorld();
  const { CVT } = w;
  CVT.open('BTC');
  check('it opens on the coin you tapped', CVT.state.from, 'BTC');
  check('  and offers a different one to receive', CVT.state.to !== 'BTC', true);
  check('  starting on the form', CVT.state.step, 'form');

  CVT.field('to', 'BTC');
  check('picking the same coin on the other side moves the first', CVT.state.from !== 'BTC', true);

  CVT.close();
  check('closing clears it', CVT.state, 'null');

  CVT.open('USDT');
  check('USDT opens against something else', CVT.state.to !== 'USDT', true);
  CVT.flip();
  check('flip swaps the sides', CVT.state.to, 'USDT');
  CVT.max();
  /* max reads whichever coin is on the paying side now, which flip just
     changed — so it is checked against that, not against USDT. */
  check('max fills in the whole balance of the paying coin',
    CVT.state.amount, String(w.MNY.spendable(CVT.state.from)));
  ok('  and it is a real balance', Number(CVT.state.amount) > 0);
  CVT.close();
}

console.log('\na reference token cannot be opened for conversion');
{
  const w = makeWorld();
  const { CVT } = w;
  CVT.open('TREND');
  check('the sheet does not open', CVT.state, 'null');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exitCode = fail ? 1 : 0;
