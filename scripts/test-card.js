/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CARD TESTS —  node scripts/test-card.js                          ║
   ║                                                                   ║
   ║  The Trending Card's rules (features/cardcore.js) with a clock    ║
   ║  and a wallet we control, then the card page (pages/card.js) as   ║
   ║  the browser runs it. What must hold:                             ║
   ║                                                                   ║
   ║  · a decline never moves money, and always says why;              ║
   ║  · a network message seen twice moves money once;                 ║
   ║  · crypto is converted only at a live price, fees are their own   ║
   ║    lines, and rounding never under-collects or over-credits;      ║
   ║  · reversals give back exactly what was taken, refunds return     ║
   ║    their share of fees, and money owed is paid first;             ║
   ║  · no card number or security code is ever stored or logged;      ║
   ║  · anything that makes the card easier to use asks who you are.   ║
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
const CORE_SRC = readModule('features/cardcore.js');
function loadCore() {
  const ctx = { window: {}, console, Math, Date, BigInt, Number, String, Object, Array, Set, JSON };
  vm.createContext(ctx);
  vm.runInContext(CORE_SRC, ctx);
  return ctx.window.CDX;
}
const C = loadCore();

const DAY = 86400000, MIN = 60000;
const T0 = new Date(2026, 8, 26, 12, 0, 0).getTime();       // local noon, 26 Sep 2026
const FX = { ok: true, base: 'USD', date: '2026-09-25', rates: { EUR: 0.87696, GBP: 0.75458, JPY: 157.59, INR: 95.82 }, source: 'ECB reference rate', fetchedAt: T0 - 60 * MIN };

/* A wallet that counts every movement. */
function makeWallet(bal, prices) {
  const w = {
    bal: { USDT: 0, USDC: 0, BTC: 0, ETH: 0, SOL: 0, BNB: 0, ...(bal || {}) },
    px: { USDT: 1, USDC: 1, BTC: 109700.12, ETH: 4012.5, SOL: 142.3371, BNB: 612.4, ...(prices || {}) },
    down: new Set(), debits: [], credits: [], failDebit: false,
    quote(a) { return this.down.has(a) ? { usd: 0, live: false } : { usd: this.px[a], live: true, at: T0, source: 'test' }; },
    balance(a) { return this.bal[a] || 0; },
    debit(a, q) { if (this.failDebit || (this.bal[a] || 0) + 1e-12 < q) return false; this.bal[a] = +(this.bal[a] - q).toFixed(10); this.debits.push([a, q]); return true; },
    credit(a, q) { this.bal[a] = +((this.bal[a] || 0) + q).toFixed(10); this.credits.push([a, q]); return true; }
  };
  return w;
}
let seq = 0;
const rand = () => ((seq = (seq * 9301 + 49297) % 233280) / 233280);

function world(opts) {
  const o = opts || {};
  const s = C.blank();
  const w = makeWallet(o.bal || { USDT: 1000 }, o.prices);
  const env = { now: o.now || T0, rand, wallet: w, fx: o.fx === undefined ? FX : o.fx, outage: false, paused: false };
  const card = C.issue(s, { kind: 'virtual', name: 'Test Person', now: env.now, rand }).card;
  return { s, w, env, card };
}
const SHOP = { name: 'Café Lumen', mcc: 5814, city: 'Portland', country: 'US' };
const HOTEL = { name: 'Hotel Aurora', mcc: 7011, city: 'Lisbon', country: 'PT' };
let nid = 0;
const pay = (W, over) => C.authorize(W.s, { networkId: 'N' + (++nid), cardId: W.card.id, merchant: SHOP, minor: 1240, currency: 'USD', channel: 'online', ...(over || {}) }, W.env);
const code = r => r.tx && r.tx.status === 'declined' ? r.tx.decline.code : r.tx ? r.tx.status : r.msg;

/* ══ Numbers and cards ═══════════════════════════════════════════════ */
console.log('\nPractice card numbers');
{
  ok('the Luhn check itself is right (a known test number passes)', C.luhnOk('4111111111111111'));
  let allFail = true;
  for (let i = 0; i < 300; i++) if (C.luhnOk('000000000000' + C.practiceLast4(Math.random))) allFail = false;
  ok('300 practice numbers all fail the Luhn check', allFail);
  const W = world();
  const d = C.practiceDetails(W.card);
  ok('the shown number starts with zeros no network routes', /^0000 0000 0000 \d{4}$/.test(d.number));
  ok('the same card shows the same code each time', C.practiceDetails(W.card).cvc === d.cvc);
  const json = JSON.stringify(W.s);
  ok('the stored state holds no card number', !json.includes('0000 0000') && !json.includes('000000000000'));
  ok('…and no security code field', !/"(cvc|cvv|pan|pin|number)"/.test(json));
  const bad = C.normalize({ cards: [{ id: 'x', last4: '1234', number: '4111111111111111', cvc: '123', pin: '0000', status: 'active', controls: {}, blocked: [] }] });
  ok('a stored number, code or PIN from anywhere is dropped on load', !JSON.stringify(bad).includes('4111') && !JSON.stringify(bad).includes('"pin"'));
}

console.log('\nAmounts');
{
  check('12.40 dollars → 1240 cents', C.parseMinor('12.40', 'USD'), 1240);
  check('a comma is refused', C.parseMinor('1,5', 'USD'), null);
  check('yen have no decimals: 1850 → 1850', C.parseMinor('1850', 'JPY'), 1850);
  check('…and 18.5 yen is refused', C.parseMinor('18.5', 'JPY'), null);
  check('three decimals of a dollar are refused', C.parseMinor('1.005', 'USD'), null);
  check('zero is refused', C.parseMinor('0', 'USD'), null);
  check('debits round up to the smallest unit', C.unitsFor(1, 109700.12, 8, true), 10);
  check('credits round down', C.unitsFor(1, 109700.12, 8, false), 9);
}

console.log('\nIssuing and activating');
{
  const W = world();
  check('a virtual card works at once', W.card.status, 'active');
  check('a second virtual card is refused', C.issue(W.s, { kind: 'virtual', now: T0, rand }).ok, false);
  const p = C.issue(W.s, { kind: 'physical', name: 'x', now: T0, rand }).card;
  check('a physical card starts inactive', p.status, 'inactive');
  check('…and ordered', p.ship.state, 'ordered');
  check('it can’t be activated before it ships', C.activate(W.s, p.id, p.last4, T0).ok, false);
  C.advanceShip(W.s, p.id, T0); C.advanceShip(W.s, p.id, T0);
  const wrong = p.last4 === '1111' ? '2222' : '1111';
  const r1 = C.activate(W.s, p.id, wrong, T0);
  ok('wrong digits are refused and the tries left are said', !r1.ok && /4 tries left/.test(r1.msg));
  for (let i = 0; i < 4; i++) C.activate(W.s, p.id, wrong, T0);
  const r5 = C.activate(W.s, p.id, p.last4, T0);
  ok('after 5 wrong tries even the right digits are refused', !r5.ok && r5.locked);
  const W2 = world();
  const p2 = C.issue(W2.s, { kind: 'physical', now: T0, rand }).card;
  C.advanceShip(W2.s, p2.id, T0); C.advanceShip(W2.s, p2.id, T0);
  check('the right digits activate it', C.activate(W2.s, p2.id, p2.last4, T0).ok, true);
  check('…and it is active', p2.status, 'active');
}

/* ══ Authorising ═════════════════════════════════════════════════════ */
console.log('\nA dollar payment with USDT');
{
  const W = world();
  const r = pay(W);
  check('approved and pending', r.tx.status, 'pending');
  check('12.40 USDT was taken', JSON.stringify(W.w.debits), '[["USDT",12.4]]');
  check('no conversion fee on a stablecoin', r.tx.fees.conversion, 0);
  check('card charge $12.40', r.tx.billing, 1240);
  ok('a notification says how much, which coin and the status', /\$12\.40 card charge · paid with 12\.4(0)? USDT · no conversion fee · Pending/.test(W.s.notes[0].body));
}

console.log('\nA euro payment with bitcoin');
{
  const W = world({ bal: { BTC: 0.5 } });
  C.setPreferred(W.s, 'BTC');
  const r = pay(W, { merchant: HOTEL, minor: 18000, currency: 'EUR' });
  const t = r.tx;
  check('approved', t.status, 'pending');
  check('priced at the ECB rate: €180 → $205.26', t.usdCents, Math.round(180 / 0.87696 * 100));
  check('foreign-currency fee 1%', t.fees.fx, Math.round(t.usdCents / 100));
  check('card charge = dollars + fee', t.billing, t.usdCents + t.fees.fx);
  check('conversion fee 1% of the card charge', t.fees.conversion, Math.round(t.billing / 100));
  const need = (t.billing + t.fees.conversion) / 100;
  const got = t.funding.qty * 109700.12;
  ok('the coin taken covers the total…', got + 1e-9 >= need);
  ok('…and one unit less would not (rounded up by at most one unit)', (t.funding.qty - 1e-8) * 109700.12 < need);
  const rows = C.breakdown(t).map(x => x.label + ': ' + x.value + ' ' + x.sub).join('\n');
  ok('the breakdown shows the rate, its source and "no markup"', /Exchange rate: 1 USD = 0\.87696 EUR ECB reference rate, 2026-09-25\. No markup/.test(rows));
  ok('the breakdown shows the conversion fee as its own line', /Conversion fee \(1%\): \$\d/.test(rows));
  ok('the breakdown shows the BTC price used', /Sold at \$109,700\.12 per BTC/.test(rows));
}

console.log('\nConversion and exchange-rate failures');
{
  let W = world({ fx: null });
  const r = pay(W, { merchant: HOTEL, minor: 18000, currency: 'EUR' });
  check('no exchange rate: declined', code(r), 'fx_unavailable');
  check('…and nothing was taken', W.w.debits.length, 0);
  W = world({ fx: { ...FX, fetchedAt: T0 - 30 * 60 * MIN } });
  check('a rate fetched 30 hours ago is not used', code(pay(W, { merchant: HOTEL, minor: 18000, currency: 'EUR' })), 'fx_unavailable');
  W = world({ fx: { ...FX, date: '2026-09-10' } });
  check('an ECB date 16 days old is not used', code(pay(W, { merchant: HOTEL, minor: 18000, currency: 'EUR' })), 'fx_unavailable');
  W = world();
  check('a currency with no rate: declined', code(pay(W, { merchant: HOTEL, minor: 1000, currency: 'XYZ' })), 'currency_not_supported');
  W = world({ bal: { BTC: 1 } });
  C.setPreferred(W.s, 'BTC'); C.setEnabled(W.s, 'USDT', false); C.setEnabled(W.s, 'USDC', false);
  W.w.down.add('BTC');
  const r2 = pay(W);
  check('bitcoin with no live price: declined, not converted', code(r2), 'conversion_unavailable');
  ok('…and the reason names the coin', /BTC had no live price/.test(C.explainDecline(r2.tx).why));
  W = world({ bal: { BTC: 1, USDT: 50 } });
  C.setPreferred(W.s, 'BTC'); W.w.down.add('BTC');
  check('with back-up on, USDT pays instead', pay(W).tx.funding.asset, 'USDT');
  W = world();
  W.w.failDebit = true;
  const r3 = pay(W);
  check('a sale that fails: declined', code(r3), 'conversion_failed');
  check('…and the balance is untouched', W.w.bal.USDT, 1000);
}

console.log('\nThe card’s state');
{
  let W = world();
  C.freeze(W.s, W.card.id, T0);
  check('frozen: declined', code(pay(W)), 'card_frozen');
  check('…nothing taken', W.w.debits.length, 0);
  C.unfreeze(W.s, W.card.id, T0);
  check('unfrozen: approved', code(pay(W)), 'pending');
  W = world();
  W.env.now = new Date(W.card.expYear, W.card.expMonth, 1).getTime() + 1000;
  check('past the expiry month: declined', code(pay(W)), 'card_expired');
  check('…and the card reads as expired', C.statusOf(W.card, W.env.now), 'expired');
  W = world();
  C.report(W.s, W.card.id, 'lost', T0);
  check('reported lost: declined', code(pay(W)), 'card_lost');
  W = world();
  C.close(W.s, W.card.id, T0);
  check('closed: declined', code(pay(W)), 'card_closed');
  W = world();
  W.env.paused = true;
  check('the programme paused by Trending: declined', code(pay(W)), 'program_paused');
}

console.log('\nControls');
{
  let W = world();
  check('a virtual card can’t be tapped', code(pay(W, { channel: 'contactless' })), 'channel_virtual');
  check('…or used at a cash machine', code(pay(W, { channel: 'atm', merchant: { name: 'ATM', mcc: 6011, country: 'US' } })), 'channel_virtual');
  C.setControl(W.s, W.card.id, 'online', false);
  check('online off: declined', code(pay(W)), 'online_blocked');
  W = world();
  C.setControl(W.s, W.card.id, 'international', false);
  const r = pay(W, { merchant: HOTEL, minor: 1000, currency: 'EUR' });
  check('international off: a shop in Portugal is declined', code(r), 'international_blocked');
  ok('…and the reason names the country', /Portugal/.test(C.explainDecline(r.tx).why));
  check('…a shop at home still works', code(pay(W)), 'pending');
  W = world();
  check('gambling is never allowed', code(pay(W, { merchant: { name: 'Casino', mcc: 7995, country: 'US' } })), 'category_not_supported');
  check('nor buying crypto with the card', code(pay(W, { merchant: { name: 'Exchange', mcc: 6051, country: 'US' } })), 'category_not_supported');
  check('nor money transfer', code(pay(W, { merchant: { name: 'Remit', mcc: 4829, country: 'US' } })), 'category_not_supported');
  C.setBlocked(W.s, W.card.id, 'dining', true);
  check('a category you blocked: declined', code(pay(W)), 'category_blocked');
  ok('turning a control on counts as loosening', C.loosensControl({ controls: { international: false } }, 'international', true));
  ok('turning one off does not', !C.loosensControl({ controls: { international: true } }, 'international', false));
  ok('unblocking a category counts as loosening', C.loosensBlock({ blocked: ['dining'] }, 'dining', false));
}

console.log('\nLimits');
{
  let W = world({ bal: { USDT: 100000 } });
  C.setLimit(W.s, 'perTx', 5000);
  check('over the single-payment limit: declined', code(pay(W, { minor: 5001 })), 'over_tx_limit');
  check('at the limit: approved', code(pay(W, { minor: 5000 })), 'pending');
  W = world({ bal: { USDT: 100000 } });
  C.setLimit(W.s, 'perTx', 100000); C.setLimit(W.s, 'daily', 150000);
  pay(W, { minor: 100000 });
  const r = pay(W, { minor: 60000, merchant: { ...SHOP, name: 'Other' } });
  check('a second payment passing the daily limit: declined', code(r), 'over_daily_limit');
  ok('…saying what is left today', /\$500\.00 is left today/.test(C.explainDecline(r.tx).why));
  W.env.now = T0 + DAY;
  check('the next day it goes through', code(pay(W, { minor: 60000, merchant: { ...SHOP, name: 'Other' } })), 'pending');
  check('a limit above the card’s maximum is refused', C.checkLimit(W.s, 'daily', 999999999).ok, false);
  check('a single payment above the daily limit is refused', C.checkLimit(W.s, 'perTx', W.s.limits.daily + 1).ok, false);
  check('raising a limit is flagged as a raise', C.checkLimit(W.s, 'monthly', W.s.limits.monthly + 100).raises, true);
  check('lowering is not', C.checkLimit(W.s, 'monthly', W.s.limits.daily).raises, false);
  const reversed = world({ bal: { USDT: 100000 } });
  C.setLimit(reversed.s, 'perTx', 100000); C.setLimit(reversed.s, 'daily', 150000);
  const big = pay(reversed, { minor: 100000 });
  C.reverse(reversed.s, big.tx.id, reversed.env);
  check('a cancelled payment no longer counts toward the limit', code(pay(reversed, { minor: 100000, merchant: { ...SHOP, name: 'Other' } })), 'pending');
}

console.log('\nWhich coin pays');
{
  let W = world({ bal: { USDT: 5, USDC: 0 } });
  const r = pay(W);
  check('not enough in any card coin: declined', code(r), 'insufficient_funds');
  ok('…saying what each coin had', /USDT: you have \$5\.00 of the \$12\.40 needed/.test(C.explainDecline(r.tx).why));
  W = world({ bal: { USDT: 5, USDC: 50 } });
  check('back-up on: USDC pays when USDT is short', pay(W).tx.funding.asset, 'USDC');
  check('…and only USDC moved', JSON.stringify(W.w.debits), '[["USDC",12.4]]');
  W = world({ bal: { USDT: 5, USDC: 50 } });
  W.s.assets.fallback = false;
  check('back-up off: declined instead', code(pay(W)), 'insufficient_funds');
  W = world({ bal: { USDT: 0, BTC: 1 } });
  check('BTC starts turned off, so it isn’t sold without asking', code(pay(W)), 'insufficient_funds');
  check('the preferred coin can’t be turned off', C.setEnabled(W.s, 'USDT', false).ok, false);
}

console.log('\nDuplicates and repeats');
{
  const W = world();
  const a = pay(W, { networkId: 'SAME-1' });
  const b = pay(W, { networkId: 'SAME-1' });
  ok('the same network message twice: the same answer', b.duplicate && b.tx.id === a.tx.id);
  check('…and money moved once', W.w.debits.length, 1);
  check('…and the retry is recorded', a.tx.retries, 1);
  const c = pay(W, { networkId: 'SAME-2' });
  check('a second charge, same shop and amount, a minute later is approved…', c.tx.status, 'pending');
  check('…but flagged as a possible double charge', c.tx.flags.repeatOf, a.tx.id);
  ok('…with a warning that says what to do', W.s.notes.some(n => n.title === 'Possible double charge' && /Charged twice/.test(n.body)));
  const d1 = C.authorize(W.s, { networkId: 'DEC-1', cardId: 'nope', merchant: SHOP, minor: 100, currency: 'USD', channel: 'online' }, W.env);
  const d2 = C.authorize(W.s, { networkId: 'DEC-1', cardId: 'nope', merchant: SHOP, minor: 100, currency: 'USD', channel: 'online' }, W.env);
  ok('a declined message sent twice is declined once', d2.duplicate && d2.tx.id === d1.tx.id);
}

console.log('\nUnusual activity');
{
  const W = world({ bal: { USDT: 100000 } });
  for (let i = 0; i < 8; i++) pay(W, { merchant: { ...SHOP, name: 'Shop ' + i }, minor: 100 + i });
  check('the ninth payment in ten minutes is declined', code(pay(W, { minor: 999 })), 'unusual_activity');
  W.env.now = T0 + 11 * MIN;
  check('ten minutes later it works again', code(pay(W, { minor: 999, merchant: { ...SHOP, name: 'Later' } })), 'pending');
}

/* ══ After approval ══════════════════════════════════════════════════ */
console.log('\nCancelled payments and expired holds');
{
  let W = world({ bal: { BTC: 0.5 } });
  C.setPreferred(W.s, 'BTC');
  const r = pay(W, { minor: 5000 });
  const taken = r.tx.funding.qty;
  W.w.px.BTC = 50000;                     // the price halves before the shop cancels
  C.reverse(W.s, r.tx.id, W.env);
  check('a cancelled payment is reversed', r.tx.status, 'reversed');
  check('exactly the coin taken comes back, whatever the price now', JSON.stringify(W.w.credits), JSON.stringify([['BTC', taken]]));
  check('…so the balance is whole again', W.w.bal.BTC, 0.5);
  W = world();
  const h = pay(W);
  W.env.now = T0 + 7 * DAY + 1;
  check('a hold not collected in 7 days is released', C.expireHolds(W.s, W.env).length, 1);
  check('…and marked as expired', h.tx.reversal, 'expired');
  check('…with the USDT back', W.w.bal.USDT, 1000);
}

console.log('\nCollecting: lower amounts and tips');
{
  let W = world({ bal: { USDT: 1000 } });
  const r = pay(W, { merchant: HOTEL, minor: 18000, currency: 'EUR' });
  const before = W.w.bal.USDT;
  C.settle(W.s, r.tx.id, 15000, W.env);
  check('the hotel collects less: completed', r.tx.status, 'completed');
  ok('…and the unused part comes back', W.w.bal.USDT > before);
  const fin = r.tx.final;
  check('…the final charge is €150 in dollars plus its fee', fin.billing, Math.round(150 / 0.87696 * 100) + Math.round(Math.round(150 / 0.87696 * 100) / 100));
  const spentUsdt = +(1000 - W.w.bal.USDT).toFixed(6);
  ok('…and the USDT spent matches the final charge to the cent', Math.abs(spentUsdt * 100 - fin.billing) <= 1);

  W = world();
  const d = pay(W, { minor: 1000 });
  check('a café may add a 20% tip', C.settle(W.s, d.tx.id, 1200, W.env).ok, true);
  check('…the extra is converted and taken', W.w.debits.length, 2);
  check('…and the tip is on the payment', d.tx.extra.cents, 200);
  W = world();
  const d2 = pay(W, { minor: 1000 });
  check('more than 20% is refused', C.settle(W.s, d2.tx.id, 1201, W.env).ok, false);
  W = world();
  const h = pay(W, { merchant: HOTEL, minor: 1000, currency: 'EUR' });
  check('a hotel can’t collect more than approved', C.settle(W.s, h.tx.id, 1100, W.env).ok, false);
}

console.log('\nMoney owed');
{
  const W = world({ bal: { USDT: 10 } });
  const r = pay(W, { minor: 1000 });
  C.settle(W.s, r.tx.id, 1200, W.env);                 // tip of $2, and nothing left to pay it
  check('a tip the balance can’t cover becomes owed', W.s.owed, 200);
  ok('…with a message saying so', W.s.notes.some(n => n.kind === 'owed' && /\$2\.00/.test(n.title)));
  check('new payments are paused while money is owed', code(pay(W, { minor: 100, merchant: { ...SHOP, name: 'Next' } })), 'balance_owed');
  W.w.bal.USDT = 50;
  check('paying it off works', C.payOwed(W.s, W.env).ok, true);
  check('…nothing is owed', W.s.owed, 0);
  check('…and payments work again', code(pay(W, { minor: 100, merchant: { ...SHOP, name: 'Next' } })), 'pending');
  const repay = W.s.txs.find(t => t.kind === 'repayment');
  ok('the repayment is in the history', repay && repay.billing === 200);
  check('…but doesn’t count toward spending limits', C.spent(W.s, W.env.now).day, 1200 + 100);
}

console.log('\nRefunds');
{
  let W = world({ bal: { BTC: 0.5 } });
  C.setPreferred(W.s, 'BTC');
  const r = pay(W, { merchant: HOTEL, minor: 20000, currency: 'EUR' });
  C.settle(W.s, r.tx.id, null, W.env);
  const fees = r.tx.fees.fx + r.tx.fees.conversion;
  check('refunding more than was paid is refused', C.refundStart(W.s, r.tx.id, 20001, W.env).ok, false);
  const st = C.refundStart(W.s, r.tx.id, 5000, W.env);
  check('a partial refund starts as pending', st.refund.state, 'pending');
  check('…and the payment says so', C.statusLabel(r.tx).label, 'Refund on its way');
  W.w.px.BTC = 120000;                    // the price rises before it arrives
  C.refundArrive(W.s, r.tx.id, st.refund.id, W.env);
  const rf = r.tx.refunds[0];
  check('a quarter refunded returns a quarter of the fees', rf.feesBack, Math.round(fees / 4));
  check('…converted at the price when it arrived', rf.price, 120000);
  ok('…rounded down, never over-credited', rf.qty * 120000 <= rf.cents / 100 + 1e-9);
  check('partly refunded', r.tx.status, 'partially_refunded');
  check('the rest can be refunded', C.refundStart(W.s, r.tx.id, 15000, W.env).ok, true);
  C.refundArrive(W.s, r.tx.id, r.tx.refunds[1].id, W.env);
  check('fully refunded', r.tx.status, 'refunded');

  W = world({ bal: { BTC: 0.5, USDT: 0 } });
  C.setPreferred(W.s, 'BTC');
  const r2 = pay(W, { minor: 1000 });
  C.settle(W.s, r2.tx.id, null, W.env);
  W.w.down.add('BTC');
  const s2 = C.refundStart(W.s, r2.tx.id, 1000, W.env);
  C.refundArrive(W.s, r2.tx.id, s2.refund.id, W.env);
  check('no live BTC price at refund time: it comes back as USDT', r2.tx.refunds[0].asset, 'USDT');
  ok('…and the history says why', /as USDT, because BTC had no live price/.test(r2.tx.timeline.map(x => x.text).join(' ')));

  W = world({ bal: { USDT: 10 } });
  const r3 = pay(W, { minor: 1000 });
  C.settle(W.s, r3.tx.id, 1200, W.env);                // owes $2
  const s3 = C.refundStart(W.s, r3.tx.id, 500, W.env);
  C.refundArrive(W.s, r3.tx.id, s3.refund.id, W.env);
  check('a refund pays what the card owes first', W.s.owed, 0);
  check('…and the rest is credited', r3.tx.refunds[0].owedPaid, 200);
}

console.log('\nReporting a payment');
{
  const W = world();
  const r = pay(W);
  check('a pending payment can’t be reported yet', C.canDispute(r.tx, W.env.now).ok, false);
  C.settle(W.s, r.tx.id, null, W.env);
  check('a collected one can', C.openDispute(W.s, r.tx.id, 'duplicate', 'Charged twice at the till', W.env).ok, true);
  check('…not twice at once', C.openDispute(W.s, r.tx.id, 'duplicate', '', W.env).ok, false);
  C.decideDispute(W.s, r.tx.id, 'review', W.env);
  check('it moves to review', C.statusLabel(r.tx).label, 'Under review');
  C.decideDispute(W.s, r.tx.id, 'won', W.env);
  check('decided for you: the money comes back', r.tx.status, 'refunded');
  check('…all of it', W.w.bal.USDT, 1000);
  check('a decided report can’t be reopened here', C.canDispute(r.tx, W.env.now).ok, false);
  const r2 = pay(W, { merchant: { ...SHOP, name: 'Other' } });
  C.settle(W.s, r2.tx.id, null, W.env);
  C.openDispute(W.s, r2.tx.id, 'not_received', '', W.env);
  C.decideDispute(W.s, r2.tx.id, 'lost', W.env);
  check('decided for the shop: nothing changes', r2.tx.status, 'completed');
  const r3 = pay(W, { merchant: { ...SHOP, name: 'Old' } });
  C.settle(W.s, r3.tx.id, null, W.env);
  check('after 120 days a payment can’t be reported', C.canDispute(r3.tx, W.env.now + 121 * DAY).ok, false);
  C.openDispute(W.s, r3.tx.id, 'amount', '', W.env);
  check('a report can be withdrawn', C.withdrawDispute(W.s, r3.tx.id, W.env).ok, true);
}

/* ══ Outages and offline sales ═══════════════════════════════════════ */
console.log('\nThe card partner is down');
{
  const W = world({ bal: { USDT: 100 } });
  W.env.outage = true;
  const small = pay(W, { minor: 3000 });
  check('a small payment is approved by the network', small.tx.status, 'pending');
  ok('…flagged as waiting to post', small.tx.flags.awaitingPost);
  check('…and nothing is taken yet', W.w.debits.length, 0);
  check('a payment over $50 is declined', code(pay(W, { minor: 5001, merchant: { ...SHOP, name: 'Big' } })), 'issuer_unavailable');
  check('the partner can’t collect it while down', C.settle(W.s, small.tx.id, null, W.env).ok, false);
  C.freeze(W.s, W.card.id, T0);
  check('a frozen card is still declined by the network', code(pay(W, { minor: 100, merchant: { ...SHOP, name: 'F' } })), 'card_frozen');
  C.unfreeze(W.s, W.card.id, T0);
  W.env.outage = false;
  C.postStandIn(W.s, W.env);
  check('when it’s back, the payment is taken', JSON.stringify(W.w.debits), '[["USDT",30]]');
  ok('…and no longer waiting', !small.tx.flags.awaitingPost);
  const W2 = world({ bal: { USDT: 10 } });
  W2.env.outage = true;
  pay(W2, { minor: 3000 });
  W2.env.outage = false;
  C.postStandIn(W2.s, W2.env);
  check('if the balance can’t cover it then, it is owed', W2.s.owed, 3000);
}

console.log('\nOffline chip sales');
{
  const W = world({ bal: { USDT: 100 } });
  const p = C.issue(W.s, { kind: 'physical', now: T0, rand }).card;
  C.advanceShip(W.s, p.id, T0); C.advanceShip(W.s, p.id, T0); C.activate(W.s, p.id, p.last4, T0);
  const req = { cardId: p.id, merchant: { name: 'Transit gate', mcc: 4111, country: 'US' }, minor: 290, currency: 'USD', channel: 'contactless' };
  const r = C.offlineSale(W.s, req, W.env);
  check('the terminal approves it offline', r.tx.status, 'offline');
  check('…nothing taken yet', W.w.debits.length, 0);
  check('…but it counts toward today’s limit', C.spent(W.s, W.env.now).day, 290);
  C.postOffline(W.s, r.tx.id, W.env);
  check('when the shop sends it, it is taken', JSON.stringify(W.w.debits), '[["USDT",2.9]]');
  check('…and completed', r.tx.status, 'completed');
  check('over $100 can’t be approved offline', code(C.offlineSale(W.s, { ...req, minor: 10001 }, W.env)), 'offline_over_limit');
  check('a virtual card can’t make an offline sale', code(C.offlineSale(W.s, { ...req, cardId: W.card.id }, W.env)), 'channel_virtual');
}

/* ══ Replacing ═══════════════════════════════════════════════════════ */
console.log('\nReplacing a card');
{
  let W = world();
  C.setControl(W.s, W.card.id, 'international', false);
  const r = C.replace(W.s, W.card.id, 'compromised', T0, rand);
  ok('someone has the details: a new number', r.ok && r.card.last4 !== W.card.last4);
  check('…the old card stops at once', W.card.status, 'closed');
  check('…the new one works straight away', r.card.status, 'active');
  check('…with the same controls', r.card.controls.international, false);
  check('…and it can’t be replaced twice', C.replace(W.s, W.card.id, 'compromised', T0, rand).ok, false);
  check('the old card is declined', code(pay(W)), 'card_closed');
  W.card = r.card;
  check('the new one pays', code(pay(W)), 'pending');

  W = world();
  const p = C.issue(W.s, { kind: 'physical', now: T0, rand }).card;
  C.advanceShip(W.s, p.id, T0); C.advanceShip(W.s, p.id, T0); C.activate(W.s, p.id, p.last4, T0);
  const d = C.replace(W.s, p.id, 'damaged', T0, rand);
  check('a damaged card keeps its number', d.card.last4, p.last4);
  check('…and keeps working until the new one is activated', p.status, 'active');
  C.advanceShip(W.s, d.card.id, T0); C.advanceShip(W.s, d.card.id, T0);
  C.activate(W.s, d.card.id, d.card.last4, T0);
  check('…then it is retired', p.status, 'replaced');
  check('renewing a card with years left is refused', C.replace(W.s, d.card.id, 'expiring', T0, rand).ok, false);
  const W3 = world();
  C.report(W3.s, W3.card.id, 'stolen', T0);
  check('a stolen card can’t keep its number', C.replace(W3.s, W3.card.id, 'damaged', T0, rand).ok, false);
  const rs = C.replace(W3.s, W3.card.id, 'stolen', T0, rand);
  ok('…it gets a new one', rs.ok && rs.card.last4 !== W3.card.last4);
}

/* ══ Explaining ══════════════════════════════════════════════════════ */
console.log('\nEvery decline explains itself');
{
  const codes = ['card_unknown', 'program_paused', 'card_frozen', 'card_expired', 'card_not_active', 'card_lost', 'card_stolen', 'card_closed',
    'balance_owed', 'channel_virtual', 'online_blocked', 'contactless_blocked', 'atm_blocked', 'international_blocked', 'category_not_supported',
    'category_blocked', 'currency_not_supported', 'fx_unavailable', 'over_tx_limit', 'over_daily_limit', 'over_monthly_limit', 'over_atm_limit',
    'insufficient_funds', 'conversion_unavailable', 'conversion_failed', 'issuer_unavailable', 'offline_over_limit', 'unusual_activity'];
  const bad = codes.filter(c => { const e = C.explainDecline({ decline: { code: c } }); return !e.title || e.title === 'Declined' || !e.why || e.fundsSafe !== true; });
  check('all 28 decline codes have a title, a reason and "funds safe"', bad.join(', '), '');
  const W = world();
  C.freeze(W.s, W.card.id, T0);
  const r = pay(W);
  ok('a declined payment’s summary says nothing was taken', /Nothing was taken/.test(C.summary(r.tx)));
  const rows = C.breakdown(r.tx).map(x => x.label);
  ok('a declined payment shows no card charge', !rows.includes('Card charge'));
}

/* ══ The page ════════════════════════════════════════════════════════ */
const PAGE_SRC = fs.existsSync(path.join(__dirname, '..', 'public', 'js', 'pages', 'card.js')) ? readModule('pages/card.js') : null;

function pageWorld(opts) {
  const o = opts || {};
  const store = {};
  const logged = [];
  const verifies = [];
  let drops = 0;
  const els = {};
  const el = id => (els[id] = els[id] || { id, innerHTML: '', textContent: '', value: '', checked: false, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    appendChild() {}, remove() { delete els[id]; }, focus() {}, closest: () => null, contains: () => false });
  const bal = { USDT: 500, USDC: 0, BTC: 0.01 };
  const listeners = {};
  const doc = {
    getElementById: id => els[id] || (['card-root'].includes(id) ? el(id) : null),
    createElement: () => { const e = el('tmp' + Object.keys(els).length); return e; },
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (k, f) => { (listeners[k] = listeners[k] || []).push(f); }, removeEventListener() {},
    body: { appendChild(e) { els[e.id || 'sheet'] = e; }, classList: { add() {}, remove() {} } },
    activeElement: null, hidden: false, contains: () => true
  };
  const ctx = {
    window: {}, document: doc,
    console: { log: (...a) => logged.push(a.join(' ')), warn: (...a) => logged.push(a.join(' ')), error: (...a) => logged.push(a.join(' ')), info: (...a) => logged.push(a.join(' ')) },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: (k, v) => { store['session:' + k] = String(v); }, removeItem() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: f => 0,
    fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    showToast: m => logged.push('toast: ' + m),
    appConfirm: async () => true,
    appPrompt: async (m, v) => o.prompt || '',
    TP: { verify: async what => { verifies.push(what); return o.verify !== false; }, dropVerify: () => { drops++; } },
    MNY: {
      quote: a => ({ usd: { USDT: 1, USDC: 1, BTC: 100000, ETH: 4000, SOL: 150, BNB: 600 }[a] || 0, live: true, reference: false }),
      spendable: a => bal[a] || 0,
      spend: (a, q) => { if ((bal[a] || 0) + 1e-12 < q) return { ok: false }; bal[a] = +(bal[a] - q).toFixed(10); return { ok: true }; },
      receive: (a, q) => { bal[a] = +((bal[a] || 0) + q).toFixed(10); return { ok: true }; },
      usd: v => '$' + Number(v).toFixed(2)
    },
    S: { user: { name: 'Test Person', fname: 'Test' } },
    navigateTo: () => {},
    Date, Math, JSON, Number, String, Object, Array, Set, Map, BigInt, Promise, Error, RegExp, encodeURIComponent, Intl,
    CDX: C
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(PAGE_SRC, ctx);
  return { ctx, TCD: ctx.TCD, store, logged, verifies, drops: () => drops, els, bal, listeners };
}

(async () => {
  if (!PAGE_SRC) { console.log(`\n(no card page yet)\n\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
  console.log('\nThe card page');
  {
    const P = pageWorld();
    ok('the page module loads', P.TCD && typeof P.TCD.paint === 'function');
    P.TCD.paint();
    ok('with no card it explains how paying with crypto works before offering one', /converted|convert/i.test(P.els['card-root'].innerHTML) && /practice/i.test(P.els['card-root'].innerHTML));
    await P.TCD.act('issue', {});
    check('without ticking the practice box, no card is made', P.TCD.state.cards.length, 0);
    await P.TCD.act('agree', {});
    await P.TCD.act('issue', {});
    check('getting a card asks who you are', P.verifies.length, 1);
    const st = P.TCD.state;
    check('…and makes one virtual card', st.cards.length, 1);
    const id = st.cards[0].id;
    await P.TCD.act('freeze', { id });
    check('freezing asks nothing', P.verifies.length, 1);
    check('…and freezes', st.cards[0].status, 'frozen');
    await P.TCD.act('unfreeze', { id });
    check('unfreezing asks who you are', P.verifies.length, 2);
    check('…and unfreezes', st.cards[0].status, 'active');
    await P.TCD.act('reveal', { id });
    check('showing the details asks again, every time', P.drops(), 1);
    check('…with a fresh check', P.verifies.length, 3);
    const saved = Object.values(P.store).join('\n');
    ok('the number shown is never written to storage', !saved.includes('0000 0000 0000'));
    ok('…nor logged', !P.logged.join('\n').includes('0000 0000 0000'));
    await P.TCD.act('control', { id, k: 'international', on: '0' });
    check('turning international off asks nothing', P.verifies.length, 3);
    await P.TCD.act('control', { id, k: 'international', on: '1' });
    check('turning it back on asks who you are', P.verifies.length, 4);
    await P.TCD.setLimitFrom('perTx', '50');
    check('lowering a limit asks nothing', P.verifies.length, 4);
    await P.TCD.setLimitFrom('perTx', '60');
    check('raising it asks who you are', P.verifies.length, 5);
    check('…and sets it', st.limits.perTx, 6000);
    await P.TCD.act('report', { id, k: 'lost' });
    check('reporting a card lost asks nothing (it only protects you)', P.verifies.length, 5);
    check('…and blocks it', st.cards[0].status, 'lost');
  }
  {
    const P = pageWorld({ verify: false });
    await P.TCD.act('agree', {});
    await P.TCD.act('issue', {});
    check('a failed check makes no card', P.TCD.state.cards.length, 0);
  }
  {
    const P = pageWorld();
    await P.TCD.act('agree', {});
    await P.TCD.act('issue', {});
    const id = P.TCD.state.cards[0].id;
    const tap = P.TCD.practicePay({ shop: 'cafe', cardId: id, amount: '12.40' });
    check('a virtual card can’t tap at a café', tap.tx.decline && tap.tx.decline.code, 'channel_virtual');
    const r = P.TCD.practicePay({ shop: 'books', cardId: id, amount: '29.99' });
    check('a practice payment runs through the rules', r.tx.status, 'pending');
    check('…and spends the practice balance', P.bal.USDT, 470.01);
    check('a malformed amount is refused before any rule runs', P.TCD.practicePay({ shop: 'books', cardId: id, amount: '1,5' }).ok, false);
    ok('…and the state saved to this device holds no card number', !Object.values(P.store).join('').includes('0000 0000'));
    ok('the page never calls console.log', !/console\.log\(/.test(PAGE_SRC) && !/console\.log\(/.test(CORE_SRC));
  }

  /* ══ The server ════════════════════════════════════════════════════ */
  console.log('\nExchange rates (services/fx.js)');
  {
    const fx = require('../services/fx');
    const GOOD = { amount: 1, base: 'USD', date: '2026-09-25', rates: { EUR: 0.87696, GBP: 0.75458, JPY: 157.59, INR: 95.82, AUD: 1.42, CAD: 1.41 } };
    let t = 1000000, calls = 0, mode = 'good';
    const fake = async () => {
      calls++;
      if (mode === 'down') throw new Error('offline');
      if (mode === 'junk') return { ok: true, json: async () => ({ base: 'USD', date: 'yesterday', rates: { EUR: -1 } }) };
      if (mode === '500') return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, json: async () => GOOD };
    };
    const R = fx.make({ fetch: fake, now: () => t, url: 'http://example.invalid/rates' });
    let a = await R.rates();
    ok('a good answer comes back with its date and source', a.ok && a.date === '2026-09-25' && /European Central Bank/.test(a.source));
    await R.rates();
    check('within the hour it is not fetched again', calls, 1);
    t += 61 * 60000; mode = 'down';
    a = await R.rates();
    ok('source down: the last good answer, marked stale', a.ok && a.stale === true && a.date === '2026-09-25');
    await R.rates();
    check('…and it doesn’t hammer the source (one retry a minute)', calls, 2);
    const R2 = fx.make({ fetch: async () => { mode = 'junk'; return fake(); }, now: () => t, url: 'x' });
    const b = await R2.rates();
    check('a malformed answer is never used', b.ok, false);
    mode = '500';
    const R3 = fx.make({ fetch: fake, now: () => t, url: 'x' });
    check('an error status is never used', (await R3.rates()).ok, false);
    check('a table with too few rates is refused', fx.validate({ base: 'USD', date: '2026-09-25', rates: { EUR: 0.9 } }), null);
    check('a negative rate is dropped', fx.validate({ base: 'USD', date: '2026-09-25', rates: { ...GOOD.rates, XXX: -2 } }).rates.XXX, undefined);
    check('a table in another base is refused', fx.validate({ ...GOOD, base: 'EUR' }), null);
  }

  console.log('\n/api/card');
  {
    const express = require('express');
    const http = require('http');
    const stub = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ amount: 1, base: 'USD', date: '2026-09-25', rates: { EUR: 0.87696, GBP: 0.75458, JPY: 157.59, INR: 95.82, AUD: 1.42 } }));
    });
    await new Promise(r => stub.listen(0, '127.0.0.1', r));
    process.env.FX_URL = `http://127.0.0.1:${stub.address().port}/rates`;
    delete process.env.PRODUCTS_PAUSED;
    delete require.cache[require.resolve('../routes/card')];
    const app = express();
    app.use('/api/card', require('../routes/card'));
    app.use((req, res) => res.status(404).json({ error: 'not_found' }));
    const srv = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const base = `http://127.0.0.1:${srv.address().port}`;
    const get = (p, init) => fetch(base + p, Object.assign({ headers: { Connection: 'close' } }, init || {}));
    let r = await get('/api/card/status');
    let j = await r.json();
    check('the card is a practice card', j.state, 'sandbox');
    check('…with no partner', j.partner, null);
    ok('…and says what a real card needs', Array.isArray(j.needs) && j.needs.some(n => /card-issuing partner/.test(n)));
    r = await get('/api/card/fx');
    j = await r.json();
    ok('rates come through the server', r.status === 200 && j.ok && j.rates.EUR === 0.87696);
    r = await get('/api/card/issue', { method: 'POST' });
    check('there is no endpoint that issues a card', r.status, 404);
    r = await get('/api/card/reveal');
    check('…or shows a card number', r.status, 404);
    process.env.PRODUCTS_PAUSED = 'card';
    delete require.cache[require.resolve('../routes/card')];
    const app2 = express();
    app2.use('/api/card', require('../routes/card'));
    const srv2 = await new Promise(res2 => { const s = app2.listen(0, '127.0.0.1', () => res2(s)); });
    j = await (await fetch(`http://127.0.0.1:${srv2.address().port}/api/card/status`, { headers: { Connection: 'close' } })).json();
    check('PRODUCTS_PAUSED=card pauses it', j.state, 'paused');
    delete process.env.PRODUCTS_PAUSED;
    const shut = x => new Promise(r => { if (x.closeAllConnections) x.closeAllConnections(); x.close(() => r()); });
    await Promise.all([shut(srv), shut(srv2), shut(stub)]);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  // Let sockets finish closing: process.exit() mid-close trips a libuv
  // assertion on Windows. The timer only fires if something lingers.
  process.exitCode = fail ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode), 3000).unref();
})();
