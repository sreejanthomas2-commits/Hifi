/* ╔══════════════════════════════════════════════════════════════════╗
   ║  MONEY TESTS —  node scripts/test-money.js                        ║
   ║                                                                   ║
   ║  MNY is the only thing in the app that moves a balance, so a bug  ║
   ║  here is money appearing or disappearing. The cases that matter:  ║
   ║                                                                   ║
   ║  · nothing is created or destroyed by a move — the sum across     ║
   ║    accounts before equals the sum after                           ║
   ║  · a failed spend leaves both accounts exactly as they were,      ║
   ║    including the half-done case where Spot was already swept      ║
   ║  · an unpriced coin is never valued at zero and counted           ║
   ║  · the daily inbound cap cannot be walked around                  ║
   ║                                                                   ║
   ║  The module is a browser file, so the few globals it reaches for  ║
   ║  are stubbed below and it is evaluated as-is — no build step and  ║
   ║  no second copy of the logic to drift out of sync.                ║
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
const near = (name, got, want, eps) => check(name, Math.abs(got - want) < (eps || 1e-9) ? 'yes' : `${got}`, 'yes');

/* ── A browser, near enough ──────────────────────────────────────── */
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

  /* The funding wallet, wrapped the way mockDb wraps it. */
  const raw = Object.assign({ USDT: 1000, BTC: 2, NOPRICE: 500 }, o.funding || {});
  const DATA = { wallet: { balances: raw } };

  /* A stand-in for the trading desk with the same three entry points
     MNY uses: availableOf, debitAsset, creditAsset. */
  const T = { cash: o.spotCash != null ? o.spotCash : 2000, holdings: Object.assign({}, o.holdings) };
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

  const ctx = {
    window: { liveCryptoPrices: { BTC: { usd: 100, name: 'Bitcoin', change24h: 10 }, ETH: { usd: 50, name: 'Ethereum', change24h: -20 } } },
    localStorage, DATA, TR,
    document: { getElementById: () => null },
    console
  };
  ctx.window.localStorage = localStorage;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readModule('features/money.js'), ctx);
  /* `const MNY` is a lexical binding, not a property of the context, so
     the handle comes from the same `window.MNY` the browser uses. */
  return { MNY: ctx.window.MNY, DATA, TR, T, raw, ctx };
}

/* Everything in every account, so a move can be checked for leaks. */
function totalUnits(w, sym) {
  return w.MNY.balanceOf(sym, 'funding') + w.MNY.balanceOf(sym, 'spot');
}

console.log('\nprices — one answer, and an honest one');
{
  const w = makeWorld();
  const M = w.MNY;
  check('a live coin is live', M.quote('BTC').live, true);
  check('  and not a reference', M.quote('BTC').reference, false);
  check('a stablecoin is a dollar', M.price('USDT'), 1);
  check('  USDC too', M.price('USDC'), 1);
  check("the app's own token has a declared reference", M.quote('TREND').reference, true);
  check('  which is not passed off as live', M.quote('TREND').live, false);
  check('  and keeps the figure the app already used', M.price('TREND'), 0.1);
  check('an unknown coin is not priced', M.isPriced('NOPRICE'), false);
  check('  and is worth nothing we can claim', M.price('NOPRICE'), 0);
  check('  so its value reads as a dash, not $0.00', M.valueLabel('NOPRICE', 500), '—');
  check('  while a known one reads as money', M.valueLabel('BTC', 2), '$200.00');
  check('case does not matter', M.price('btc'), 100);
}

console.log('\nbalances across the two accounts');
{
  const w = makeWorld({ holdings: { BTC: { qty: 3, avgCost: 90 } } });
  const M = w.MNY;
  check('funding is read', M.balanceOf('BTC', 'funding'), 2);
  check('spot is read', M.balanceOf('BTC', 'spot'), 3);
  check('spendable is both', M.spendable('BTC'), 5);
  check('the default account is funding', M.balanceOf('BTC'), 2);
  const h = M.holdings().find(r => r.sym === 'BTC');
  check('holdings merge the accounts', h.qty, 5);
  check('  and remember where it sits', JSON.stringify(h.parts), JSON.stringify({ funding: 2, spot: 3 }));
}

console.log('\ntotals leave out what cannot be priced');
{
  const w = makeWorld();
  const M = w.MNY;
  const t = M.total('funding');
  check('the unpriced holding is counted as a holding', t.unpriced, 1);
  check('  and is listed', !!t.rows.find(r => r.sym === 'NOPRICE'), true);
  check('  but adds nothing to the value', t.value, 1000 + 200);
  ok('it is never silently dropped', t.rows.length === 3);
}

console.log('\ntransfer — any asset, and nothing created');
{
  const w = makeWorld();
  const M = w.MNY;
  const before = totalUnits(w, 'BTC');
  const r = M.transfer('BTC', 1, 'funding', 'spot');
  check('a non-quote asset moves', r.ok, true);
  check('  it left funding', M.balanceOf('BTC', 'funding'), 1);
  check('  it arrived in spot', M.balanceOf('BTC', 'spot'), 1);
  near('  and none was created', totalUnits(w, 'BTC'), before);
  check('back again', M.transfer('BTC', 1, 'spot', 'funding').ok, true);
  near('  still none created', totalUnits(w, 'BTC'), before);

  check('more than you have is refused', M.transfer('BTC', 99, 'funding', 'spot').ok, false);
  near('  and nothing moved', M.balanceOf('BTC', 'funding'), 2);
  check('zero is refused', M.transfer('BTC', 0, 'funding', 'spot').ok, false);
  check('a negative amount is refused', M.transfer('BTC', -5, 'funding', 'spot').ok, false);
  check('nonsense is refused', M.transfer('BTC', 'abc', 'funding', 'spot').ok, false);
  check('the same account twice is refused', M.transfer('BTC', 1, 'spot', 'spot').ok, false);
  near('  after all of that the balance is untouched', totalUnits(w, 'BTC'), before);
}

console.log('\nspend — funding first, then swept from spot');
{
  const w = makeWorld({ holdings: { BTC: { qty: 3, avgCost: 90 } } });
  const M = w.MNY;
  const before = totalUnits(w, 'BTC');

  const small = M.spend('BTC', 1);
  check('inside funding, nothing is swept', small.moved, 0);
  check('  funding paid it', M.balanceOf('BTC', 'funding'), 1);
  check('  spot was not touched', M.balanceOf('BTC', 'spot'), 3);

  const big = M.spend('BTC', 3);
  check('over funding, the rest comes from spot', big.ok, true);
  check('  exactly the shortfall moved', big.moved, 2);
  check('  funding is empty', M.balanceOf('BTC', 'funding'), 0);
  check('  and spot is down by the shortfall', M.balanceOf('BTC', 'spot'), 1);
  check('  the message says it moved', /moved from Spot/.test(big.msg), true);
  near('  four spent, four gone', totalUnits(w, 'BTC'), before - 4);
}

console.log('\nspend — a refusal changes nothing');
{
  const w = makeWorld({ holdings: { BTC: { qty: 1, avgCost: 90 } } });
  const M = w.MNY;
  const snap = { f: M.balanceOf('BTC', 'funding'), s: M.balanceOf('BTC', 'spot') };

  const over = M.spend('BTC', 10);
  check('more than both accounts hold is refused', over.ok, false);
  check('  funding untouched', M.balanceOf('BTC', 'funding'), snap.f);
  check('  spot untouched — no partial sweep left behind', M.balanceOf('BTC', 'spot'), snap.s);
  check('  and the refusal says what you actually have', /You hold 3 BTC/.test(over.msg), true);

  check('zero is refused', M.spend('BTC', 0).ok, false);
  check('a negative amount is refused', M.spend('BTC', -1).ok, false);
  check('nonsense is refused', M.spend('BTC', 'lots').ok, false);
  check('no coin is refused', M.spend('', 1).ok, false);
  check('an unpriced coin is refused by default', M.spend('NOPRICE', 1).ok, false);
  check('  and allowed only when the caller says so', M.spend('NOPRICE', 1, { allowUnpriced: true }).ok, true);
  check('sweep:false refuses rather than moving', M.spend('BTC', 3, { sweep: false }).ok, false);
  check('  and says where the rest is', /is in Spot/.test(M.spend('BTC', 3, { sweep: false }).msg), true);
  check('  with spot still intact', M.balanceOf('BTC', 'spot'), snap.s);
}

console.log('\nthe ledger records both halves of a sweep');
{
  const w = makeWorld({ holdings: { BTC: { qty: 3, avgCost: 90 } } });
  const M = w.MNY;
  M.spend('BTC', 3, { via: 'Chat', to: 'Sarah' });
  const rows = M.ledger();
  check('two lines, not one', rows.length, 2);
  check('  the payment is on top', rows[0].kind, 'spend');
  check('  it names where it went', rows[0].to, 'Sarah');
  check('  the top-up is underneath', rows[1].kind, 'transfer');
  check('  and says it came from Spot', rows[1].from, 'Spot');
  check('a value is attached when we can price it', rows[0].value, 300);
  M.record({ kind: 'spend', sym: 'NOPRICE', qty: 5 });
  check('and left null when we cannot', M.ledger()[0].value, 'null');
  check('the ledger survives being re-read', M.ledger().length, 3);
  M.clearLedger();
  check('clearing empties it', M.ledger().length, 0);
}

console.log('\nreceiving, and the daily cap');
{
  const w = makeWorld();
  const M = w.MNY;
  /* CFI owns the cap; MNY must ask it rather than keeping a second one. */
  let asked = 0, allow = true;
  w.ctx.CFI = { takeInbound(v) { asked += v; return allow; } };

  const r = M.receive('BTC', 1);
  check('a simulated payment asks the cap', asked, 100);
  check('  and is credited', M.balanceOf('BTC', 'funding'), 3);
  check('  with a ledger line', M.ledger()[0].kind, 'receive');

  allow = false;
  const blocked = M.receive('BTC', 1);
  check('over the cap it is refused', blocked.ok, false);
  check('  flagged as capped', blocked.capped, true);
  check('  and nothing was credited', M.balanceOf('BTC', 'funding'), 3);

  const own = M.receive('BTC', 1, { simulated: false });
  check('money that is already yours skips the cap', own.ok, true);
  check('  and lands', M.balanceOf('BTC', 'funding'), 4);
  check('zero is refused', M.receive('BTC', 0).ok, false);
  check('a negative amount is refused', M.receive('BTC', -5).ok, false);
}

console.log('\nthe day move only counts what a market is quoting');
{
  const w = makeWorld({ funding: { ETH: 10 } });
  const M = w.MNY;
  const mv = M.dayMove();
  /* BTC 2 @100 = 200, up 10%; ETH 10 @50 = 500, down 20%.
     Before: 200/1.1 + 500/0.8 = 181.818… + 625 = 806.818…
     So the move is 700 - 806.818… = -106.818… */
  near('  the move is computed from the 24h change', mv.abs, 700 - (200 / 1.1 + 500 / 0.8), 1e-6);
  ok('  a stablecoin does not drag it', M.dayMove([{ sym: 'USDT', priced: true, live: true, val: 1e6, change24h: 0 }]).abs === 0);
  ok('  and neither does a reference price', M.dayMove([{ sym: 'TREND', priced: true, live: false, val: 1e6, change24h: 99 }]).abs === 0);
}

console.log('\none asset list for every payment screen');
{
  const w = makeWorld({ holdings: { ETH: { qty: 1, avgCost: 40 } } });
  const M = w.MNY;
  const list = M.assets();
  check('what you hold comes first', list[0], 'USDT');
  ok('  everything held and priced is offered', ['BTC', 'ETH'].every(s => list.includes(s)));
  ok("  including the app's own token", list.includes('TREND'));
  check('  and nothing is listed twice', new Set(list).size, list.length);
  ok('an unpriced holding is left out of the picker', !list.includes('NOPRICE'));
  ok('  unless it is asked for', M.assets({ includeUnpriced: true }).includes('NOPRICE'));
  check('the list can be capped', M.assets({ limit: 3 }).length, 3);
}

console.log('\nnet worth is the figure every screen shows');
{
  const w = makeWorld({ holdings: { BTC: { qty: 1, avgCost: 90 } } });
  const M = w.MNY;
  const n = M.netWorth();
  /* funding 1000 USDT + 2 BTC (200) + spot 2000 USDT + 1 BTC (100) */
  check('it adds the accounts up', n.wallet, 3300);
  check('  with nothing staked here', n.earn, 0);
  check('  so the total is the wallet', n.total, 3300);
  check('  and it reports what it could not price', n.unpriced, 1);
}

console.log('\nrounding does not leak a dust balance');
{
  const w = makeWorld({ funding: { BTC: 0.1 } });
  const M = w.MNY;
  M.spend('BTC', 0.1, { sweep: false });
  check('spending all of it leaves exactly zero', M.balanceOf('BTC', 'funding'), 0);
  ok('  not a negative dust remainder', M.balanceOf('BTC', 'funding') >= 0);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exitCode = fail ? 1 : 0;
