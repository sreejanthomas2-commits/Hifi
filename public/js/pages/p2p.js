/* ╔══════════════════════════════════════════════════════════════════╗
   ║  P2P MARKETPLACE                                                 ║
   ║                                                                  ║
   ║  Buy and sell USDT and every other listed coin directly with     ║
   ║  other users, priced in local fiat. Merchant ad book, escrow      ║
   ║  order flow, order history, and your own ads.                    ║
   ║                                                                  ║
   ║  Settlement moves real balances through MNY, into the Funding    ║
   ║  account — where Pay, tips and chat crypto spend from, and where  ║
   ║  this page has always said P2P settles. It used to credit the     ║
   ║  Spot account instead. Fiat legs are OFF-PLATFORM by              ║
   ║  design — exactly as real P2P works, the bank transfer happens   ║
   ║  between the two people and the platform only escrows the crypto.║
   ║  No real payment is initiated by this screen.                    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const P2P = (() => {

  const KEY = 'ts_p2p';

  /* Indicative FX against USD — the coin feed is USD-denominated, so
     local prices are derived rather than quoted directly. */
  const FIAT = {
    USD: { symbol: '$',  rate: 1,    name: 'US Dollar' },
    INR: { symbol: '₹',  rate: 88.4, name: 'Indian Rupee' },
    EUR: { symbol: '€',  rate: 0.92, name: 'Euro' },
    GBP: { symbol: '£',  rate: 0.79, name: 'British Pound' },
    AED: { symbol: 'AED',rate: 3.67, name: 'UAE Dirham' },
    NGN: { symbol: '₦',  rate: 1580, name: 'Nigerian Naira' },
    BRL: { symbol: 'R$', rate: 5.42, name: 'Brazilian Real' }
  };

  const PAY_METHODS = ['Bank Transfer', 'UPI', 'IMPS', 'PayPal', 'Wise', 'Revolut', 'Zelle', 'Cash Deposit'];

  /* Counterparties. Stable roster so reputation means something. */
  const MERCHANTS = [
    { name: 'CryptoKing_99',   orders: 12840, rate: 99.4, release: 2,  verified: true },
    { name: 'SafeTrade_Hub',   orders: 8420,  rate: 98.9, release: 4,  verified: true },
    { name: 'LunaExchange',    orders: 6310,  rate: 99.8, release: 1,  verified: true },
    { name: 'DevKumar_P2P',    orders: 4180,  rate: 97.6, release: 6,  verified: false },
    { name: 'ZaraAssets',      orders: 3925,  rate: 99.1, release: 3,  verified: true },
    { name: 'NairaBridge',     orders: 2870,  rate: 96.8, release: 9,  verified: false },
    { name: 'MarcusOTC',       orders: 2140,  rate: 98.2, release: 5,  verified: true },
    { name: 'SwiftSettle',     orders: 1560,  rate: 95.4, release: 12, verified: false },
    { name: 'TrendingDesk',    orders: 980,   rate: 99.6, release: 2,  verified: true },
    { name: 'AnonWhale',       orders: 640,   rate: 94.1, release: 15, verified: false }
  ];

  const DEFAULT = { orders: [], ads: [], coin: 'USDT', fiat: 'USD', side: 'buy', tab: 'market', pay: 'all' };

  let P = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} }

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const ic = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');

  /* USDT is the quote asset and has no live feed entry, so it is pinned
     to $1 — every other coin comes from the CoinGecko prices. */
  function usdPrice(coin) {
    if (coin === 'USDT') return 1;
    const c = (window.liveCryptoPrices || {})[coin];
    return c ? c.usd : 0;
  }

  function coinList() {
    const live = Object.keys(window.liveCryptoPrices || {});
    return ['USDT', ...live.filter(s => s !== 'USDT')];
  }

  function fiatFmt(v, code) {
    const f = FIAT[code] || FIAT.USD;
    const dp = f.rate > 100 ? 0 : 2;
    return f.symbol + v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  function qtyFmt(v) {
    if (!v) return '0';
    if (v < 0.0001) return v.toExponential(2);
    return v.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }

  /* Stable pseudo-random per merchant+coin so an ad's price, stock and
     limits do not jump around on every repaint. */
  function seeded(str, n) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
    return ((h % 1000) / 1000) * n;
  }

  /* Ad book. Sellers ask above spot, buyers bid below — the spread is
     the merchant's margin, same as any real P2P board. */
  function offers(side, coin, fiatCode) {
    const spot = usdPrice(coin);
    if (!spot) return [];
    const f = FIAT[fiatCode] || FIAT.USD;

    const mine = P.ads.filter(a => a.side !== side && a.coin === coin && a.fiat === fiatCode && a.active);

    const book = MERCHANTS.map((m, i) => {
      const key = m.name + coin + fiatCode + side;
      const edge = 0.004 + seeded(key, 0.022);                 // 0.4% – 2.6%
      const unit = spot * f.rate * (side === 'buy' ? 1 + edge : 1 - edge);
      const stock = (200 + seeded(key + 'v', 9000)) / (coin === 'USDT' ? 1 : Math.max(spot, 1));
      const minF = Math.round((20 + seeded(key + 'm', 180)) * f.rate);
      const maxF = Math.round(minF + (500 + seeded(key + 'x', 9000)) * f.rate);
      const pays = PAY_METHODS.filter((_, pi) => (i + pi) % 3 !== 0).slice(0, 3);
      return {
        id: 'm' + i + coin + side,
        merchant: m, price: unit, stock, minF, maxF, pays,
        coin, fiat: fiatCode, side
      };
    });

    // A user's own ad competes in the book alongside the merchants.
    const userAds = mine.map(a => ({
      id: a.id, mineAd: true,
      merchant: { name: 'You', orders: 0, rate: 100, release: 1, verified: false },
      price: a.price, stock: a.stock, minF: a.minF, maxF: a.maxF, pays: a.pays,
      coin, fiat: fiatCode, side
    }));

    const all = book.concat(userAds);
    // Buyers want the cheapest ask first; sellers want the highest bid.
    all.sort((a, b) => side === 'buy' ? a.price - b.price : b.price - a.price);
    return P.pay === 'all' ? all : all.filter(o => o.pays.includes(P.pay));
  }

  /* ── Order lifecycle ─────────────────────────────────────────────── */
  /* Escrow is released by the SELLER confirming the money arrived, or by
     a dispute decision - never by the buyer saying they paid. It used to
     release by itself 2.6 seconds after "I have paid", which is the one
     thing a P2P desk must never do: a scammer would only have to tap a
     button.

       buy  : pending_payment -> paid (you say you paid)
              -> the seller releases -> completed
       sell : your coin is escrowed at open -> awaiting_payment
              -> buyer_paid (they say they paid) -> you check your own
              account, then release -> completed
       both : disputed -> resolved_release | resolved_return

     An unpaid order expires, and a seller's escrow comes back on its own.

     The counterparties here are made up, so their half of the flow - the
     seller releasing, the buyer paying, a reviewer deciding - is a button
     marked Demo. Each step stays visible as the other side's action
     instead of hiding inside a timer. */
  const PAY_MS = 15 * 60 * 1000;       // the buyer's time to pay and mark paid
  const RELEASE_MS = 10 * 60 * 1000;   // the seller's time to release before a dispute can open
  const FINAL = ['completed', 'resolved_release', 'resolved_return', 'expired', 'cancelled'];
  const isFinal = o => FINAL.includes(o.status);
  const payBy = o => o.payBy || ((o.created || 0) + PAY_MS);
  const disputeFrom = o => (o.paidAt || o.created || 0) + RELEASE_MS;
  const ask = (msg, opts) => (typeof appConfirm === 'function'
    ? appConfirm(msg, opts)
    : Promise.resolve(typeof window.confirm === 'function' ? window.confirm(msg) : true));
  const late = o => Date.now() > payBy(o);
  const find = id => P.orders.find(x => x.id === id);

  // A buyer's coin lands in Funding; a seller's escrow goes back there.
  function creditBuyer(o) {
    if (o.side === 'buy' && typeof MNY !== 'undefined') {
      MNY.receive(o.coin, o.qty, { kind: 'receive', via: 'P2P', from: o.merchant, simulated: false });
    }
  }
  function returnEscrow(o) {
    if (o.side === 'sell' && typeof MNY !== 'undefined') {
      MNY.receive(o.coin, o.qty, { kind: 'receive', via: 'P2P escrow returned', simulated: false });
    }
  }
  function close(o, status) {
    o.status = status;
    o.closedAt = Date.now();
    if (status === 'completed') o.completed = o.closedAt;
  }

  function createOrder(offerId, fiatAmount) {
    const list = offers(P.side, P.coin, P.fiat);
    const o = list.find(x => x.id === offerId);
    if (!o) return toast('That ad is no longer available.');
    // Your own ad sits in the book for others; you can't take the other side of it.
    if (o.mineAd) return toast("That's your own ad — manage it under My ads.");

    const amt = parseFloat(fiatAmount);
    if (!amt || amt <= 0) return toast('Enter an amount.');
    if (amt < o.minF || amt > o.maxF) {
      return toast(`Order must be between ${fiatFmt(o.minF, o.fiat)} and ${fiatFmt(o.maxF, o.fiat)}.`);
    }

    const qty = amt / o.price;
    if (qty > o.stock) return toast('That ad does not have enough stock for this amount.');

    if (P.side === 'sell') {
      // Your crypto goes into escrow the moment the order opens. It comes
      // out of Funding, topped up from Spot if Funding is short.
      if (typeof MNY === 'undefined') return toast('Accounts are still loading…');
      const esc_ = MNY.spend(P.coin, qty, { kind: 'spend', via: 'P2P escrow', to: o.merchant.name });
      if (!esc_.ok) return toast(esc_.msg);
    }

    const now = Date.now();
    const order = {
      id: 'P' + now,
      ref: 'TR-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      side: P.side, coin: P.coin, fiat: P.fiat,
      qty, fiatAmount: amt, price: o.price,
      merchant: o.merchant.name, pay: o.pays[0],
      status: P.side === 'buy' ? 'pending_payment' : 'awaiting_payment',
      created: now, payBy: now + PAY_MS
    };

    P.orders.unshift(order);
    save();
    closeModal();
    P.tab = 'orders';
    paint();
    toast(`Order ${order.ref} opened — ${P.side === 'buy' ? 'pay the seller within 15 minutes' : 'your crypto is locked in escrow'}`);
    if (typeof SF !== 'undefined') SF.rep('gave_tip');
  }

  /* Buyer: you have sent the money. That only tells the seller to go and
     look - the escrow does not move. */
  async function markPaid(id) {
    const o = find(id);
    if (!o || o.side !== 'buy' || o.status !== 'pending_payment') return;
    if (late(o)) return void expireDue();
    const yes = await ask(`Only confirm once ${fiatFmt(o.fiatAmount, o.fiat)} has left your account, sent to ${o.merchant} by ${o.pay}. Marking an order paid without paying gets accounts closed.`,
      { title: 'Have you paid?', ok: "I've paid" });
    // The order may have expired, or been cancelled, while the dialog was open.
    if (!yes || o.status !== 'pending_payment') return;
    if (late(o)) return void expireDue();
    o.status = 'paid';
    o.paidAt = Date.now();
    save(); paint();
    toast('Marked as paid. The crypto stays in escrow until the seller confirms your money arrived.');
  }

  /* Seller: the money is in your account, so release the escrow. Only
     once the buyer has said they paid - before that there is nothing to
     release against. */
  async function confirmReceived(id) {
    const o = find(id);
    if (!o || o.side !== 'sell' || o.status !== 'buyer_paid') return;
    const yes = await ask(`Check your ${o.pay} account first: ${fiatFmt(o.fiatAmount, o.fiat)} must be there in full, from the name on this order. A screenshot or a message is not proof. Once released, ${qtyFmt(o.qty)} ${o.coin} can't be taken back.`,
      { title: `Release ${o.coin} to ${o.merchant}?`, ok: 'Release', danger: true });
    if (!yes || o.status !== 'buyer_paid') return;
    close(o, 'completed');
    save(); paint();
    toast(`Released — ${qtyFmt(o.qty)} ${o.coin} went to ${o.merchant}`);
  }

  /* A dispute freezes the order: the escrow stays exactly where it is
     until someone decides. The buyer can open one once the seller has
     had RELEASE_MS to release; the seller can as soon as the buyer says
     they paid (the usual reason: the money never arrived). */
  function canDispute(o) {
    if (!o) return false;
    if (o.side === 'buy') return o.status === 'paid' && Date.now() >= disputeFrom(o);
    return o.status === 'buyer_paid';
  }
  async function openDispute(id) {
    const o = find(id);
    if (!canDispute(o)) return;
    const yes = await ask('The order freezes and the crypto stays locked in escrow until a decision. Keep your payment receipt - you will be asked for it.',
      { title: 'Open a dispute?', ok: 'Open dispute' });
    if (!yes || !canDispute(o)) return;
    o.disputedFrom = o.status;
    o.status = 'disputed';
    o.disputedAt = Date.now();
    save(); paint();
    toast('Dispute opened — the crypto stays in escrow until it is decided');
  }
  function withdrawDispute(id) {
    const o = find(id);
    if (!o || o.status !== 'disputed') return;
    o.status = o.disputedFrom === 'buyer_paid' || o.disputedFrom === 'paid' ? o.disputedFrom : (o.side === 'buy' ? 'paid' : 'buyer_paid');
    delete o.disputedAt;
    save(); paint();
    toast('Dispute withdrawn — the order is back where it was');
  }

  async function cancelOrder(id) {
    const o = find(id);
    // A seller can't walk away once the buyer says the money is on its way,
    // and nobody can while a dispute is open.
    const open = () => !isFinal(o) && o.status !== 'disputed' && (o.side === 'buy' || o.status === 'awaiting_payment');
    if (!o || !open()) return;
    if (o.side === 'buy' && o.status === 'paid') {
      const yes = await ask('Cancel only if you did NOT send the money. If you did, wait for the seller, or open a dispute - cancelling gives up your claim on this order.',
        { title: 'Cancel this order?', ok: 'Cancel order', cancel: 'Keep order', danger: true });
      if (!yes || !open()) return;
    }
    close(o, 'cancelled');
    returnEscrow(o);
    save(); paint();
    toast(`Order ${o.ref} cancelled${o.side === 'sell' ? ' — your crypto is back in Funding' : ''}`);
  }

  /* Unpaid orders close when their time runs out. A seller's escrow comes
     back; a buyer never moved anything in the first place. */
  function expireDue() {
    const now = Date.now();
    let changed = false;
    P.orders.forEach(o => {
      if ((o.status === 'pending_payment' || o.status === 'awaiting_payment') && now > payBy(o)) {
        close(o, 'expired');
        returnEscrow(o);
        changed = true;
      }
    });
    if (changed) { save(); paint(); }
    return changed;
  }

  /* ── The other side, in this demo ────────────────────────────────── */
  function demoSellerReleases(id) {
    const o = find(id);
    if (!o || o.side !== 'buy' || o.status !== 'paid') return;
    close(o, 'completed');
    creditBuyer(o);
    save(); paint();
    toast(`The seller confirmed your payment — ${qtyFmt(o.qty)} ${o.coin} released to your Funding account`);
  }
  function demoBuyerPays(id) {
    const o = find(id);
    if (!o || o.side !== 'sell' || o.status !== 'awaiting_payment') return;
    if (late(o)) return void expireDue();
    o.status = 'buyer_paid';
    o.paidAt = Date.now();
    save(); paint();
    toast('The buyer says they have paid. Check your account before you release anything.');
  }
  /* In live P2P a Trending reviewer makes this call on the evidence.
     'release' sends the coin to the buyer; 'return' gives it back to the
     seller. */
  function demoDecide(id, outcome) {
    const o = find(id);
    if (!o || o.status !== 'disputed' || (outcome !== 'release' && outcome !== 'return')) return;
    if (outcome === 'release') { close(o, 'resolved_release'); creditBuyer(o); }
    else { close(o, 'resolved_return'); returnEscrow(o); }
    save(); paint();
    toast(outcome === 'release'
      ? `Decided for the buyer — ${qtyFmt(o.qty)} ${o.coin} released`
      : `Decided for the seller — ${qtyFmt(o.qty)} ${o.coin} returned`);
  }

  /* ── Your own ads ────────────────────────────────────────────────── */
  function postAd(form) {
    const price = parseFloat(form.price), stock = parseFloat(form.stock);
    const minF = parseFloat(form.minF), maxF = parseFloat(form.maxF);
    if (!price || price <= 0) return toast('Enter a price.');
    if (!stock || stock <= 0) return toast('Enter how much you want to trade.');
    if (!minF || !maxF || minF > maxF) return toast('Check your order limits.');

    if (form.side === 'sell' && typeof MNY !== 'undefined' && MNY.spendable(P.coin) < stock) {
      return toast(`You only hold ${qtyFmt(MNY.spendable(P.coin))} ${P.coin}.`);
    }

    P.ads.unshift({
      id: 'a' + Date.now(), side: form.side, coin: P.coin, fiat: P.fiat,
      price, stock, minF, maxF, pays: [form.pay], active: true, created: Date.now()
    });
    save(); closeModal(); P.tab = 'ads'; paint();
    toast(`Ad posted — ${form.side} ${qtyFmt(stock)} ${P.coin} at ${fiatFmt(price, P.fiat)}`);
  }

  function toggleAd(id) {
    const a = P.ads.find(x => x.id === id);
    if (!a) return;
    a.active = !a.active;
    save(); paint();
    toast(a.active ? 'Ad is live' : 'Ad paused');
  }

  function removeAd(id) {
    const i = P.ads.findIndex(x => x.id === id);
    if (i < 0) return;
    P.ads.splice(i, 1);
    save(); paint();
    toast('Ad removed');
  }

  /* ── UI ──────────────────────────────────────────────────────────── */
  function setSide(s) { P.side = s; save(); paint(); }
  function setTab(t) { P.tab = t; save(); paint(); }
  function setCoin(c) { P.coin = c; save(); paint(); }
  function setFiat(f) { P.fiat = f; save(); paint(); }
  function setPay(p) { P.pay = p; save(); paint(); }

  const STATUS = {
    pending_payment:  { label: 'Pay the seller',          cls: 'warn' },
    awaiting_payment: { label: 'Waiting for the buyer',   cls: 'warn' },
    paid:             { label: 'Waiting for the seller',  cls: 'info' },
    buyer_paid:       { label: 'Check your payment',      cls: 'warn' },
    disputed:         { label: 'Under review',            cls: 'info' },
    completed:        { label: 'Completed',               cls: 'ok' },
    resolved_release: { label: 'Decided · released',      cls: 'ok' },
    resolved_return:  { label: 'Decided · returned',      cls: 'off' },
    expired:          { label: 'Expired',                 cls: 'off' },
    cancelled:        { label: 'Cancelled',               cls: 'off' }
  };

  // Arguments for inline handlers: JSON, then escaped for the attribute.
  const A = v => esc(JSON.stringify(v === undefined ? null : v));

  /* The warnings that stop the common P2P scams, shown where each one
     happens: when an order opens, while the buyer pays, and while the
     seller decides whether to release. */
  const FRAUD = `<ul class="p2p-fraud">
      <li>Pay, and get paid, only with the details in this order, from an account in your own name.</li>
      <li>Never release crypto until the money is in your account: not on a screenshot, a text message or a promise.</li>
      <li>Trending staff never ask you to release early, pay extra, or move the chat to another app.</li>
    </ul>`;

  /* ── Clocks ──────────────────────────────────────────────────────── */
  const mmss = ms => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  function clockHTML(o) {
    let until = 0, label = '';
    if (o.status === 'pending_payment') { until = payBy(o); label = 'Time left to pay'; }
    else if (o.status === 'awaiting_payment') { until = payBy(o); label = 'The buyer has to pay within'; }
    else if (o.side === 'buy' && o.status === 'paid' && !canDispute(o)) { until = disputeFrom(o); label = 'You can open a dispute in'; }
    if (!until) return '';
    return `<span class="p2p-clock" data-p2p-until="${until}" data-p2p-label="${esc(label)}">${esc(label)} ${mmss(until - Date.now())}</span>`;
  }
  /* One timer while the orders tab is on screen. It rewrites the clock
     text in place, expires orders whose time is up, and repaints when a
     clock reaches zero (a dispute button appears, an order closes). */
  let clock = null;
  function tick() {
    const els = typeof document.querySelectorAll === 'function' ? document.querySelectorAll('[data-p2p-until]') : [];
    if (!document.getElementById('p2p-root') || !els.length) { clearInterval(clock); clock = null; return; }
    if (expireDue()) return;
    let due = false;
    els.forEach(el => {
      const left = Number(el.dataset.p2pUntil) - Date.now();
      if (left <= 0) due = true;
      else el.textContent = el.dataset.p2pLabel + ' ' + mmss(left);
    });
    if (due) paint();
  }
  function startClock() {
    if (!clock && P.tab === 'orders' && P.orders.some(o => clockHTML(o))) clock = setInterval(tick, 1000);
  }

  function paint() {
    const root = document.getElementById('p2p-root');
    if (!root) return;

    const coins = coinList();
    const tabs = [['market', 'Ad book'], ['orders', `My orders${P.orders.some(o => !isFinal(o)) ? ' •' : ''}`], ['ads', 'My ads']];

    root.innerHTML = `
      <div class="p2p-bar card">
        <div class="p2p-sides">
          <button class="p2p-side${P.side === 'buy' ? ' buy' : ''}" onclick="P2P.setSide('buy')">Buy</button>
          <button class="p2p-side${P.side === 'sell' ? ' sell' : ''}" onclick="P2P.setSide('sell')">Sell</button>
        </div>
        <div class="p2p-filters">
          <label class="p2p-f"><span>Coin</span>
            <select class="input" onchange="P2P.setCoin(this.value)">
              ${coins.map(c => `<option value="${c}"${c === P.coin ? ' selected' : ''}>${c}</option>`).join('')}
            </select></label>
          <label class="p2p-f"><span>Fiat</span>
            <select class="input" onchange="P2P.setFiat(this.value)">
              ${Object.keys(FIAT).map(f => `<option value="${f}"${f === P.fiat ? ' selected' : ''}>${f}</option>`).join('')}
            </select></label>
          <label class="p2p-f"><span>Payment</span>
            <select class="input" onchange="P2P.setPay(this.value)">
              <option value="all"${P.pay === 'all' ? ' selected' : ''}>All methods</option>
              ${PAY_METHODS.map(p => `<option value="${p}"${p === P.pay ? ' selected' : ''}>${p}</option>`).join('')}
            </select></label>
        </div>
      </div>

      <div class="p2p-tabs">
        ${tabs.map(([k, l]) => `<button class="p2p-tab${P.tab === k ? ' active' : ''}" onclick="P2P.setTab('${k}')">${l}</button>`).join('')}
        <button class="btn btn-ghost btn-sm p2p-post" onclick="P2P.openAdForm()">
          <span class="material-symbols-rounded ms-16">add</span> Post ad
        </button>
      </div>

      <div id="p2p-body">${P.tab === 'market' ? marketHTML() : P.tab === 'orders' ? ordersHTML() : adsHTML()}</div>`;
    startClock();
  }

  function marketHTML() {
    const list = offers(P.side, P.coin, P.fiat);
    if (!list.length) {
      return `<div class="p2p-empty">No ads for ${esc(P.coin)}/${esc(P.fiat)} with that payment method.</div>`;
    }
    const spot = usdPrice(P.coin) * (FIAT[P.fiat] || FIAT.USD).rate;

    return `
      <div class="p2p-spot">Reference price · <b>${fiatFmt(spot, P.fiat)}</b> per ${esc(P.coin)}${P.fiat === 'USD' ? '' : ' · at a fixed indicative exchange rate, not a live one'}</div>
      <div class="p2p-demo-note">These merchants are made up for practice: their names, order counts, completion rates and badges are not real. Live P2P would list only real, checked accounts.</div>
      <div class="p2p-list">
        ${list.map(o => {
          const m = o.merchant;
          return `
          <div class="card p2p-ad">
            <div class="p2p-ad-m">
              <div class="p2p-av">${esc(m.name[0])}</div>
              <div class="p2p-m-info">
                <div class="p2p-m-name">${esc(m.name)} ${m.verified ? '<span class="p2p-verified" title="What a verified merchant looks like. This one is made up, so nobody verified it.">✓</span>' : ''}${o.mineAd ? '<span class="p2p-mine">your ad</span>' : '<span class="p2p-demo-chip">Demo</span>'}</div>
                <div class="p2p-m-stats">${o.mineAd ? 'Your ad' : `${m.orders.toLocaleString()} orders · ${m.rate}% · ~${m.release} min <span class="tc-3">(made-up figures)</span>`}</div>
              </div>
            </div>
            <div class="p2p-ad-px">
              <div class="p2p-price">${fiatFmt(o.price, o.fiat)}</div>
              <div class="p2p-unit">per ${esc(o.coin)}</div>
            </div>
            <div class="p2p-ad-lim">
              <div><span>Available</span><b>${qtyFmt(o.stock)} ${esc(o.coin)}</b></div>
              <div><span>Limits</span><b>${fiatFmt(o.minF, o.fiat)} – ${fiatFmt(o.maxF, o.fiat)}</b></div>
              <div class="p2p-pays">${o.pays.map(p => `<span class="p2p-pay">${esc(p)}</span>`).join('')}</div>
            </div>
            ${o.mineAd
              ? `<button class="btn btn-ghost btn-sm" onclick="P2P.setTab('ads')">Manage ad</button>`
              : `<button class="btn btn-sm ${P.side === 'buy' ? 'p2p-btn-buy' : 'p2p-btn-sell'}" onclick="P2P.openOrderForm(${A(o.id)})">
              ${P.side === 'buy' ? 'Buy' : 'Sell'} ${esc(o.coin)}
            </button>`}
          </div>`;
        }).join('')}
      </div>`;
  }

  /* What is happening, whether the crypto is safe, and what to do next -
     one line per status, so no order is ever just a spinner. */
  function explain(o) {
    const coin = `${qtyFmt(o.qty)} ${esc(o.coin)}`;
    const money = fiatFmt(Number(o.fiatAmount) || 0, o.fiat);
    const who = esc(o.merchant), via = esc(o.pay), ref = esc(o.ref);
    const buy = o.side === 'buy';
    switch (o.status) {
      case 'pending_payment':
        return `Send ${money} to ${who} by ${via}, then tap <b>I've paid</b>. The seller's ${coin} is locked in escrow for you. Nothing has moved yet.`;
      case 'paid':
        return `The ${coin} stays locked in escrow until ${who} confirms your ${money} arrived. Tapping "I've paid" doesn't release it. If they haven't released it in time, you can open a dispute.`;
      case 'awaiting_payment':
        return `Your ${coin} is locked in escrow: safe, and not released to anyone. ${who} has to pay ${money} by ${via}. If they don't pay in time, the order expires and your ${coin} comes back to you.`;
      case 'buyer_paid':
        return `${who} says they've paid ${money}. <b>Check your ${via} account yourself before you release</b>: the full amount, from the name on this order. Once released, it can't be taken back. If the money isn't there, open a dispute.`;
      case 'disputed':
        return `The order is frozen and the ${coin} is locked in escrow; nobody can move it until a decision. In live P2P a Trending reviewer decides from both sides' proof. This practice desk has no reviewers, so the Demo buttons show each outcome.`;
      case 'completed':
        return buy ? `${coin} released to your Funding account.` : `${coin} released to ${who}.`;
      case 'resolved_release':
        return buy ? `Decided for you: ${coin} released to your Funding account.` : `Decided for the buyer: ${coin} released to ${who}.`;
      case 'resolved_return':
        return buy ? `Decided for the seller: the ${coin} went back to them. If you sent money, the seller has to return it. Contact support and quote ${ref}.`
                   : `Decided for you: ${coin} returned to your Funding account.`;
      case 'expired':
        return buy ? `Closed: it wasn't marked paid in time. Nothing moved. If you did send money, contact support and quote ${ref}.`
                   : `Closed: the buyer didn't pay in time. Your ${coin} is back in Funding.`;
      case 'cancelled':
        return buy ? 'Cancelled. Nothing moved.' : `Cancelled. Your ${coin} is back in Funding.`;
    }
    return '';
  }

  const demoBtn = (fn, args, label) =>
    `<button class="btn btn-ghost btn-sm p2p-demo" onclick="P2P.${fn}(${args})" title="Practice only: this is the other side's step, done for you"><span class="p2p-demo-tag">Demo</span> ${label}</button>`;
  const btn = (cls, fn, id, label) => `<button class="btn ${cls} btn-sm" onclick="P2P.${fn}(${id})">${label}</button>`;

  function actionsHTML(o) {
    const id = A(o.id);
    switch (o.status) {
      case 'pending_payment':
        return btn('btn-primary', 'markPaid', id, "I've paid") + btn('btn-ghost', 'cancelOrder', id, 'Cancel');
      case 'paid':
        return demoBtn('demoSellerReleases', id, 'Seller confirms your payment')
          + (canDispute(o) ? btn('btn-ghost', 'openDispute', id, 'Open dispute') : '')
          + btn('btn-ghost', 'cancelOrder', id, 'Cancel');
      case 'awaiting_payment':
        return demoBtn('demoBuyerPays', id, 'Buyer marks paid') + btn('btn-ghost', 'cancelOrder', id, 'Cancel');
      case 'buyer_paid':
        return btn('btn-primary', 'confirmReceived', id, 'Payment received — release')
          + btn('btn-ghost', 'openDispute', id, 'Not received — dispute');
      case 'disputed':
        return demoBtn('demoDecide', id + ', ' + A('release'), 'Decide for the buyer')
          + demoBtn('demoDecide', id + ', ' + A('return'), 'Decide for the seller')
          + btn('btn-ghost', 'withdrawDispute', id, 'Withdraw dispute');
    }
    return '';
  }

  function ordersHTML() {
    if (!P.orders.length) return `<div class="p2p-empty">No orders yet. Open one from the ad book.</div>`;
    return `<div class="p2p-list">${P.orders.map(o => {
      const st = STATUS[o.status] || STATUS.cancelled;
      const side = o.side === 'sell' ? 'sell' : 'buy';
      const acts = actionsHTML(o);
      const clk = clockHTML(o);
      return `
        <div class="card p2p-order">
          <div class="p2p-o-top">
            <div>
              <span class="p2p-o-side ${side}">${side.toUpperCase()}</span>
              <b>${qtyFmt(o.qty)} ${esc(o.coin)}</b>
              <span class="tc-3">· ${esc(o.ref)}</span>
            </div>
            <span class="p2p-status ${st.cls}">${st.label}</span>
          </div>
          <div class="p2p-o-grid">
            <div><span>Amount</span><b>${fiatFmt(Number(o.fiatAmount) || 0, o.fiat)}</b></div>
            <div><span>Price</span><b>${fiatFmt(Number(o.price) || 0, o.fiat)}</b></div>
            <div><span>Counterparty</span><b>${esc(o.merchant)}${o.merchant === 'You' ? '' : ' <span class="p2p-demo-chip">Demo</span>'}</b></div>
            <div><span>Method</span><b>${esc(o.pay)}</b></div>
          </div>
          <div class="p2p-explain" role="status">${explain(o)}${clk ? '<br>' + clk : ''}</div>
          ${o.status === 'pending_payment' || o.status === 'buyer_paid' ? FRAUD : ''}
          ${acts ? `<div class="p2p-o-acts">${acts}</div>` : ''}
        </div>`;
    }).join('')}</div>`;
  }

  function adsHTML() {
    if (!P.ads.length) return `<div class="p2p-empty">You have no ads. Post one to let others trade with you.</div>`;
    return `<div class="p2p-list">${P.ads.map(a => `
      <div class="card p2p-order">
        <div class="p2p-o-top">
          <div><span class="p2p-o-side ${a.side}">${a.side.toUpperCase()}</span> <b>${qtyFmt(a.stock)} ${esc(a.coin)}</b></div>
          <span class="p2p-status ${a.active ? 'ok' : 'off'}">${a.active ? 'Live' : 'Paused'}</span>
        </div>
        <div class="p2p-o-grid">
          <div><span>Price</span><b>${fiatFmt(a.price, a.fiat)}</b></div>
          <div><span>Limits</span><b>${fiatFmt(a.minF, a.fiat)} – ${fiatFmt(a.maxF, a.fiat)}</b></div>
          <div><span>Method</span><b>${esc(a.pays[0])}</b></div>
        </div>
        <div class="p2p-o-acts">
          <button class="btn btn-ghost btn-sm" onclick="P2P.toggleAd('${a.id}')">${a.active ? 'Pause' : 'Resume'}</button>
          <button class="btn btn-ghost btn-sm" onclick="P2P.removeAd('${a.id}')">Remove</button>
        </div>
      </div>`).join('')}</div>`;
  }

  /* ── Modals ──────────────────────────────────────────────────────── */
  function shell(inner) {
    closeModal();
    const el = document.createElement('div');
    el.id = 'p2p-modal';
    el.className = 'sf-overlay';
    el.onclick = e => { if (e.target === el) closeModal(); };
    el.innerHTML = `<div class="card p2p-modal">
      <button class="icon-btn sf-close" onclick="P2P.closeModal()" aria-label="Close"><span class="material-symbols-rounded">close</span></button>
      ${inner}</div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('open'), 20);
  }

  function closeModal() {
    const el = document.getElementById('p2p-modal');
    if (el) { el.classList.remove('open'); setTimeout(() => el.remove(), 200); }
  }

  function openOrderForm(offerId) {
    const o = offers(P.side, P.coin, P.fiat).find(x => x.id === offerId);
    if (!o) return;
    const buying = P.side === 'buy';
    shell(`
      <h3 class="fw9 tc-1 m0">${buying ? 'Buy' : 'Sell'} ${esc(o.coin)}</h3>
      <div class="fs12 tc-3 mb16">with ${esc(o.merchant.name)} · ${esc(o.pays[0])}</div>

      <div class="p2p-o-grid mb12">
        <div><span>Price</span><b>${fiatFmt(o.price, o.fiat)}</b></div>
        <div><span>Available</span><b>${qtyFmt(o.stock)} ${esc(o.coin)}</b></div>
        <div><span>Limits</span><b>${fiatFmt(o.minF, o.fiat)} – ${fiatFmt(o.maxF, o.fiat)}</b></div>
      </div>

      <label class="form-label">${buying ? 'You pay' : 'You receive'} (${esc(o.fiat)})</label>
      <input class="input" id="p2p-amt" type="number" step="any" placeholder="${o.minF}" oninput="P2P.previewOrder('${o.id}')">
      <div class="p2p-preview" id="p2p-preview">
        <div class="tr-kv"><span>${buying ? 'You receive' : 'You send'}</span><b>0 ${esc(o.coin)}</b></div>
      </div>

      <div class="p2p-note">
        <span class="material-symbols-rounded ms-16">lock</span>
        <span>${buying
          ? 'The seller\'s crypto is locked in escrow while you pay. Pay them within 15 minutes, then tap I\'ve paid. It is released when the seller confirms your money arrived, not when you tap the button.'
          : 'Your crypto is locked in escrow when the order opens. It is released only when you confirm the buyer\'s money is in your account. If they don\'t pay within 15 minutes, it comes back to you.'}
        The money itself moves between you and the other person; this screen never moves it.</span>
      </div>
      ${FRAUD}

      <button class="btn w100 ${buying ? 'p2p-btn-buy' : 'p2p-btn-sell'}" onclick="P2P.createOrder(${A(o.id)}, document.getElementById('p2p-amt').value)">
        Open order
      </button>`);
  }

  function previewOrder(offerId) {
    const o = offers(P.side, P.coin, P.fiat).find(x => x.id === offerId);
    const box = document.getElementById('p2p-preview');
    const el = document.getElementById('p2p-amt');
    if (!o || !box || !el) return;
    const amt = parseFloat(el.value) || 0;
    const qty = o.price > 0 ? amt / o.price : 0;
    box.innerHTML = `<div class="tr-kv"><span>${P.side === 'buy' ? 'You receive' : 'You send'}</span><b>${qtyFmt(qty)} ${esc(o.coin)}</b></div>`;
  }

  function openAdForm() {
    const spot = usdPrice(P.coin) * (FIAT[P.fiat] || FIAT.USD).rate;
    shell(`
      <h3 class="fw9 tc-1 m0">Post an ad</h3>
      <div class="fs12 tc-3 mb16">${esc(P.coin)} / ${esc(P.fiat)} · reference ${fiatFmt(spot, P.fiat)}</div>

      <label class="form-label">Side</label>
      <select class="input mb8" id="ad-side">
        <option value="sell">Sell ${esc(P.coin)}</option>
        <option value="buy">Buy ${esc(P.coin)}</option>
      </select>

      <label class="form-label">Price per ${esc(P.coin)} (${esc(P.fiat)})</label>
      <input class="input mb8" id="ad-price" type="number" step="any" value="${spot.toFixed(2)}">

      <label class="form-label">Total amount (${esc(P.coin)})</label>
      <input class="input mb8" id="ad-stock" type="number" step="any" placeholder="0.00">

      <div style="display:flex; gap:8px">
        <div style="flex:1"><label class="form-label">Min (${esc(P.fiat)})</label>
          <input class="input" id="ad-min" type="number" step="any" value="20"></div>
        <div style="flex:1"><label class="form-label">Max (${esc(P.fiat)})</label>
          <input class="input" id="ad-max" type="number" step="any" value="1000"></div>
      </div>

      <label class="form-label mt8">Payment method</label>
      <select class="input mb12" id="ad-pay">
        ${PAY_METHODS.map(p => `<option value="${p}">${p}</option>`).join('')}
      </select>

      <button class="btn btn-primary w100" onclick="P2P.postAd({
        side: document.getElementById('ad-side').value,
        price: document.getElementById('ad-price').value,
        stock: document.getElementById('ad-stock').value,
        minF: document.getElementById('ad-min').value,
        maxF: document.getElementById('ad-max').value,
        pay: document.getElementById('ad-pay').value })">Post ad</button>`);
  }

  /* Orders whose time ran out while the app was closed close now. An
     order that was waiting for the seller stays waiting: it used to be
     released here, on start-up, without anyone confirming anything. */
  setTimeout(expireDue, 0);

  return {
    paint, setSide, setTab, setCoin, setFiat, setPay,
    openOrderForm, previewOrder, createOrder, openAdForm, postAd,
    markPaid, confirmReceived, cancelOrder, toggleAd, removeAd, closeModal,
    openDispute, withdrawDispute, canDispute, expireDue,
    demoSellerReleases, demoBuyerPays, demoDecide,
    offers, FIAT, PAY_MS, RELEASE_MS, get state() { return P; }
  };
})();

window.P2P = P2P;

function getP2pTemplate() {
  return `<section id="pane-p2p" class="pane">
    <h1 class="pane-title" style="display:flex; align-items:center; gap:10px">
      <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:#26A69A">swap_horiz</span>
      <span>P2P</span> Marketplace
    </h1>
    <div class="tr-banner">
      <span class="material-symbols-rounded ms-16">info</span>
      Practice marketplace. The merchants are made up, exchange rates are fixed indicative figures, and escrow moves your paper balance only. The money side happens between the two people, off Trending, and no real payment is ever made here.
    </div>
    <div id="p2p-root"></div>
  </section>`;
}

function renderP2p() { P2P.paint(); }

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module now, so its top-level names are private
   to it. Inline onclick= handlers and every other module still look
   them up on the global object, so they are republished here.

   Each one is a thunk because the list is produced by scanning, and
   scanning over-collects — a line inside a template literal can look
   like a declaration. publish() calls each thunk and skips the ones
   that do not resolve, so a phantom costs one caught error and not a
   dead module graph. */
import { publish } from '../globals.js?v=3';
publish('pages/p2p.js', {
  P2P: () => P2P, getP2pTemplate: () => getP2pTemplate,
  renderP2p: () => renderP2p
});
