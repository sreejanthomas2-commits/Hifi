/* ╔══════════════════════════════════════════════════════════════════╗
   ║  P2P TESTS —  node scripts/test-p2p.js                            ║
   ║                                                                   ║
   ║  The one rule that matters on a P2P desk: escrow is released by   ║
   ║  the seller confirming the money arrived, or by a dispute         ║
   ║  decision - never because the buyer pressed "Paid". The page      ║
   ║  used to release 2.6 seconds after that button, and again on      ║
   ║  start-up for any order left waiting.                             ║
   ║                                                                   ║
   ║  Also: unpaid orders expire and hand a seller's escrow back, a    ║
   ║  dispute freezes everything, nothing is ever credited twice, and  ║
   ║  every order explains itself.                                     ║
   ║                                                                   ║
   ║  p2p.js is evaluated as the browser runs it, with a clock we      ║
   ║  control and the money module stubbed to count every movement.   ║
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

function readModule(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', rel), 'utf8');
  const at = src.indexOf('Global bridge');
  return at === -1 ? src : src.slice(0, src.lastIndexOf('/*', at));
}
const SRC = readModule('pages/p2p.js');

const MIN = 60 * 1000;

function makeWorld(opts) {
  const o = opts || {};
  const clock = { t: Date.UTC(2026, 8, 26, 12, 0, 0) };
  class FakeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [clock.t])); }
    static now() { return clock.t; }
  }
  const store = {};
  if (o.saved) store.ts_p2p = JSON.stringify(o.saved);
  const moves = { spend: [], receive: [] };
  const timers = [];
  const root = { innerHTML: '' };
  const ctx = {
    window: { liveCryptoPrices: { BTC: { usd: 60000 } } },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    document: {
      getElementById: id => (id === 'p2p-root' && o.withRoot ? root : null),
      createElement: () => ({ classList: { add() {}, remove() {} }, remove() {} }),
      body: { appendChild() {} }
    },
    showToast: m => toasts.push(m),
    MNY: {
      spend: (sym, qty, meta) => { moves.spend.push({ sym, qty, meta }); return { ok: true }; },
      receive: (sym, qty, meta) => { moves.receive.push({ sym, qty, meta }); return { ok: true }; },
      spendable: () => 1e9
    },
    appConfirm: () => Promise.resolve(answer.yes),
    setTimeout: (fn, ms) => { timers.push({ fn, at: clock.t + (ms || 0) }); return timers.length; },
    setInterval: () => 1,
    clearInterval: () => {},
    Date: FakeDate,
    console
  };
  const toasts = [];
  const answer = { yes: true };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'p2p.js' });
  const P2P = ctx.window.P2P;
  // Run every timer that is due, the way the browser would.
  const runTimers = () => {
    for (let i = 0; i < timers.length; i++) {
      const t = timers[i];
      if (!t.done && t.at <= clock.t) { t.done = true; t.fn(); }
    }
  };
  const advance = ms => { clock.t += ms; runTimers(); };
  runTimers();
  return { P2P, moves, toasts, answer, clock, advance, root, store };
}

// Open an order against the first ad on the given side.
function open(w, side) {
  w.P2P.setSide(side);
  w.P2P.setCoin('USDT');
  w.P2P.setFiat('USD');
  const ad = w.P2P.offers(side, 'USDT', 'USD')[0];
  w.P2P.createOrder(ad.id, String(ad.minF));
  return w.P2P.state.orders[0];
}

(async () => {
  console.log('\nBuying: pressing Paid does not release anything');
  {
    const w = makeWorld();
    const o = open(w, 'buy');
    check('a new buy order waits for your payment', o.status, 'pending_payment');
    check('opening a buy order moves nothing', w.moves.spend.length + w.moves.receive.length, 0);
    ok('it has a 15 minute deadline', o.payBy === w.clock.t + 15 * MIN);

    await w.P2P.markPaid(o.id);
    check('marked paid', o.status, 'paid');
    w.advance(3000);
    check('3 seconds later: still waiting for the seller (it used to release at 2.6 s)', o.status, 'paid');
    w.advance(60 * MIN);
    check('an hour later: still waiting for the seller', o.status, 'paid');
    check('and nothing was credited', w.moves.receive.length, 0);

    w.P2P.demoSellerReleases(o.id);
    check('the seller confirming is what releases it', o.status, 'completed');
    check('credited once', w.moves.receive.length, 1);
    ok('credited the order quantity', Math.abs(w.moves.receive[0].qty - o.qty) < 1e-12);
    w.P2P.demoSellerReleases(o.id);
    check('a second release does nothing', w.moves.receive.length, 1);
  }

  console.log('\nBuying: the dialog, a double tap, and running out of time');
  {
    const w = makeWorld();
    const o = open(w, 'buy');
    w.answer.yes = false;
    await w.P2P.markPaid(o.id);
    check('saying no in the dialog leaves it unpaid', o.status, 'pending_payment');
    w.answer.yes = true;
    await Promise.all([w.P2P.markPaid(o.id), w.P2P.markPaid(o.id)]);
    check('two quick taps: paid once', o.status, 'paid');

    const late = open(w, 'buy');
    w.advance(16 * MIN);
    await w.P2P.markPaid(late.id);
    check('too late to mark paid: the order expires instead', late.status, 'expired');
    check('an expired buy order moved nothing', w.moves.receive.length, 0);
  }

  console.log('\nBuying: disputes');
  {
    const w = makeWorld();
    const o = open(w, 'buy');
    await w.P2P.markPaid(o.id);
    check('no dispute before the seller has had their 10 minutes', w.P2P.canDispute(o), false);
    await w.P2P.openDispute(o.id);
    check('an early dispute is refused', o.status, 'paid');
    w.advance(10 * MIN);
    check('after 10 minutes a dispute is allowed', w.P2P.canDispute(o), true);
    await w.P2P.openDispute(o.id);
    check('dispute opened', o.status, 'disputed');
    w.P2P.demoSellerReleases(o.id);
    await w.P2P.cancelOrder(o.id);
    check('a disputed order can be neither released nor cancelled', o.status, 'disputed');
    w.P2P.withdrawDispute(o.id);
    check('withdrawing the dispute puts it back', o.status, 'paid');
    await w.P2P.openDispute(o.id);
    w.P2P.demoDecide(o.id, 'release');
    check('decided for the buyer', o.status, 'resolved_release');
    check('credited once', w.moves.receive.length, 1);
    w.P2P.demoDecide(o.id, 'return');
    check('a second decision changes nothing', o.status + ' ' + w.moves.receive.length, 'resolved_release 1');
  }

  console.log('\nSelling: escrow, the buyer paying, and you releasing');
  {
    const w = makeWorld();
    const o = open(w, 'sell');
    check('your coin is escrowed when the order opens', w.moves.spend.length, 1);
    check('waiting for the buyer', o.status, 'awaiting_payment');
    await w.P2P.confirmReceived(o.id);
    check('you cannot release before the buyer says they paid', o.status, 'awaiting_payment');
    w.P2P.demoBuyerPays(o.id);
    check('the buyer says they paid', o.status, 'buyer_paid');
    await w.P2P.cancelOrder(o.id);
    check('a seller cannot cancel once the buyer says they paid', o.status, 'buyer_paid');
    w.answer.yes = false;
    await w.P2P.confirmReceived(o.id);
    check('saying no in the release dialog keeps the escrow', o.status, 'buyer_paid');
    w.answer.yes = true;
    await w.P2P.confirmReceived(o.id);
    check('released after you confirm', o.status, 'completed');
    check('nothing came back to you (it went to the buyer)', w.moves.receive.length, 0);
  }

  console.log('\nSelling: expiry and a dispute decided for you');
  {
    const w = makeWorld();
    const o = open(w, 'sell');
    w.advance(16 * MIN);
    w.P2P.expireDue();
    check('an unpaid sell order expires', o.status, 'expired');
    check('its escrow comes back once', w.moves.receive.length, 1);
    w.P2P.expireDue();
    check('and only once', w.moves.receive.length, 1);

    const d = open(w, 'sell');
    w.P2P.demoBuyerPays(d.id);
    await w.P2P.openDispute(d.id);
    check('a seller can dispute as soon as the buyer says they paid', d.status, 'disputed');
    w.advance(60 * MIN);
    w.P2P.expireDue();
    check('a disputed order never expires on its own', d.status, 'disputed');
    w.P2P.demoDecide(d.id, 'return');
    check('decided for the seller', d.status, 'resolved_return');
    check('escrow returned', w.moves.receive.length, 2);
    w.P2P.demoDecide(d.id, 'nonsense');
    check('an unknown outcome is ignored', d.status, 'resolved_return');
  }

  console.log('\nStart-up: an order left waiting is not released');
  {
    const t = Date.UTC(2026, 8, 26, 12, 0, 0);
    const saved = {
      orders: [
        { id: 'P1', ref: 'TR-OLD1', side: 'buy', coin: 'USDT', fiat: 'USD', qty: 50, fiatAmount: 50, price: 1,
          merchant: 'CryptoKing_99', pay: 'Bank Transfer', status: 'paid', created: t - 60 * MIN, paidAt: t - 59 * MIN },
        { id: 'P2', ref: 'TR-OLD2', side: 'sell', coin: 'USDT', fiat: 'USD', qty: 20, fiatAmount: 20, price: 1,
          merchant: 'ZaraAssets', pay: 'UPI', status: 'awaiting_payment', created: t - 60 * MIN }
      ],
      ads: [], coin: 'USDT', fiat: 'USD', side: 'buy', tab: 'orders', pay: 'all'
    };
    const w = makeWorld({ saved });
    w.advance(5000);
    const [paid, unpaid] = w.P2P.state.orders;
    check('an old "paid" order is still waiting for the seller', paid.status, 'paid');
    check('an old unpaid sell order expired', unpaid.status, 'expired');
    check('only the expired escrow came back', w.moves.receive.map(m => m.qty).join(','), '20');
  }

  console.log('\nWhat the orders tab says');
  {
    const w = makeWorld({ withRoot: true });
    const o = open(w, 'buy');
    let html = w.root.innerHTML;
    ok('the pay clock shows', html.includes('Time left to pay 15:00'));
    ok('the scam warnings show while you pay', html.includes('Never release crypto until the money is in your account'));
    ok('the made-up merchant is marked Demo', html.includes('p2p-demo-chip'));
    await w.P2P.markPaid(o.id);
    html = w.root.innerHTML;
    ok('while waiting, it says pressing Paid does not release', html.includes("doesn't release it"));
    ok('the seller\'s step is a Demo button', html.includes('Seller confirms your payment') && html.includes('p2p-demo-tag'));
    ok('the dispute clock shows', html.includes('You can open a dispute in 10:00'));
    ok('no spinner claiming the seller is releasing', !html.includes('Seller is releasing'));
    w.P2P.setTab('market');
    html = w.root.innerHTML;
    ok('the ad book says the merchants are made up', html.includes('These merchants are made up for practice'));
    ok('and their figures are labelled', html.includes('(made-up figures)'));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
