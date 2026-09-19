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
  /* buy  : pay fiat off-platform  → merchant releases → crypto credited
     sell : crypto escrowed now    → merchant pays you → order completes */
  function createOrder(offerId, fiatAmount) {
    const list = offers(P.side, P.coin, P.fiat);
    const o = list.find(x => x.id === offerId);
    if (!o) return toast('That ad is no longer available.');

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

    const order = {
      id: 'P' + Date.now(),
      ref: 'TR-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      side: P.side, coin: P.coin, fiat: P.fiat,
      qty, fiatAmount: amt, price: o.price,
      merchant: o.merchant.name, pay: o.pays[0],
      status: P.side === 'buy' ? 'pending_payment' : 'awaiting_payment',
      created: Date.now()
    };

    P.orders.unshift(order);
    save();
    closeModal();
    P.tab = 'orders';
    paint();
    toast(`Order ${order.ref} opened — ${P.side === 'buy' ? 'pay the seller to continue' : 'crypto held in escrow'}`);
    if (typeof SF !== 'undefined') SF.rep('gave_tip');
  }

  /* Buyer confirms the fiat transfer; the seller then releases escrow. */
  function markPaid(id) {
    const o = P.orders.find(x => x.id === id);
    if (!o || o.status !== 'pending_payment') return;
    o.status = 'paid';
    save(); paint();
    toast('Marked as paid — waiting for the seller to release');

    setTimeout(() => {
      const cur = P.orders.find(x => x.id === id);
      if (!cur || cur.status !== 'paid') return;
      cur.status = 'completed';
      cur.completed = Date.now();
      if (typeof MNY !== 'undefined') {
        MNY.receive(cur.coin, cur.qty, { kind: 'receive', via: 'P2P', from: cur.merchant, simulated: false });
      }
      save(); paint();
      toast(`Released — ${qtyFmt(cur.qty)} ${cur.coin} credited to your account ✅`);
    }, 2600);
  }

  /* Seller confirms fiat landed; escrowed crypto goes to the buyer. */
  function confirmReceived(id) {
    const o = P.orders.find(x => x.id === id);
    if (!o || o.status !== 'awaiting_payment') return;
    o.status = 'completed';
    o.completed = Date.now();
    save(); paint();
    toast(`Payment confirmed — ${qtyFmt(o.qty)} ${o.coin} released from escrow`);
  }

  function cancelOrder(id) {
    const o = P.orders.find(x => x.id === id);
    if (!o || o.status === 'completed' || o.status === 'cancelled') return;
    // Selling refunds escrow; buying never moved funds, so nothing to undo.
    if (o.side === 'sell' && typeof MNY !== 'undefined') {
      MNY.receive(o.coin, o.qty, { kind: 'receive', via: 'P2P escrow returned', simulated: false });
    }
    o.status = 'cancelled';
    save(); paint();
    toast(`Order ${o.ref} cancelled${o.side === 'sell' ? ' — escrow returned' : ''}`);
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
    pending_payment:  { label: 'Pending payment',  cls: 'warn' },
    awaiting_payment: { label: 'Awaiting payment', cls: 'warn' },
    paid:             { label: 'Paid · releasing', cls: 'info' },
    completed:        { label: 'Completed',        cls: 'ok' },
    cancelled:        { label: 'Cancelled',        cls: 'off' }
  };

  function paint() {
    const root = document.getElementById('p2p-root');
    if (!root) return;

    const coins = coinList();
    const tabs = [['market', 'Ad book'], ['orders', `My orders${P.orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length ? ' •' : ''}`], ['ads', 'My ads']];

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
  }

  function marketHTML() {
    const list = offers(P.side, P.coin, P.fiat);
    if (!list.length) {
      return `<div class="p2p-empty">No ads for ${esc(P.coin)}/${esc(P.fiat)} with that payment method.</div>`;
    }
    const spot = usdPrice(P.coin) * (FIAT[P.fiat] || FIAT.USD).rate;

    return `
      <div class="p2p-spot">Reference price · <b>${fiatFmt(spot, P.fiat)}</b> per ${esc(P.coin)}</div>
      <div class="p2p-list">
        ${list.map(o => {
          const m = o.merchant;
          return `
          <div class="card p2p-ad">
            <div class="p2p-ad-m">
              <div class="p2p-av">${esc(m.name[0])}</div>
              <div class="p2p-m-info">
                <div class="p2p-m-name">${esc(m.name)} ${m.verified ? '<span class="p2p-verified" title="Verified merchant">✓</span>' : ''}${o.mineAd ? '<span class="p2p-mine">your ad</span>' : ''}</div>
                <div class="p2p-m-stats">${m.orders.toLocaleString()} orders · ${m.rate}% · ~${m.release} min</div>
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
            <button class="btn btn-sm ${P.side === 'buy' ? 'p2p-btn-buy' : 'p2p-btn-sell'}" onclick="P2P.openOrderForm('${o.id}')">
              ${P.side === 'buy' ? 'Buy' : 'Sell'} ${esc(o.coin)}
            </button>
          </div>`;
        }).join('')}
      </div>`;
  }

  function ordersHTML() {
    if (!P.orders.length) return `<div class="p2p-empty">No orders yet. Open one from the ad book.</div>`;
    return `<div class="p2p-list">${P.orders.map(o => {
      const st = STATUS[o.status] || STATUS.cancelled;
      const acts = o.status === 'pending_payment'
        ? `<button class="btn btn-primary btn-sm" onclick="P2P.markPaid('${o.id}')">I have paid</button>
           <button class="btn btn-ghost btn-sm" onclick="P2P.cancelOrder('${o.id}')">Cancel</button>`
        : o.status === 'awaiting_payment'
        ? `<button class="btn btn-primary btn-sm" onclick="P2P.confirmReceived('${o.id}')">Payment received</button>
           <button class="btn btn-ghost btn-sm" onclick="P2P.cancelOrder('${o.id}')">Cancel</button>`
        : o.status === 'paid'
        ? `<span class="p2p-wait"><span class="material-symbols-rounded ms-16 spinner">sync</span> Seller is releasing escrow…</span>`
        : '';
      return `
        <div class="card p2p-order">
          <div class="p2p-o-top">
            <div>
              <span class="p2p-o-side ${o.side}">${o.side.toUpperCase()}</span>
              <b>${qtyFmt(o.qty)} ${esc(o.coin)}</b>
              <span class="tc-3">· ${esc(o.ref)}</span>
            </div>
            <span class="p2p-status ${st.cls}">${st.label}</span>
          </div>
          <div class="p2p-o-grid">
            <div><span>Amount</span><b>${fiatFmt(o.fiatAmount, o.fiat)}</b></div>
            <div><span>Price</span><b>${fiatFmt(o.price, o.fiat)}</b></div>
            <div><span>Counterparty</span><b>${esc(o.merchant)}</b></div>
            <div><span>Method</span><b>${esc(o.pay)}</b></div>
          </div>
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
        ${buying
          ? 'The seller\'s crypto is held in escrow. Pay them directly, then mark the order as paid.'
          : 'Your crypto is escrowed when the order opens and released once you confirm payment.'}
        The fiat transfer happens between you and the counterparty — this screen never moves money.
      </div>

      <button class="btn w100 ${buying ? 'p2p-btn-buy' : 'p2p-btn-sell'}" onclick="P2P.createOrder('${o.id}', document.getElementById('p2p-amt').value)">
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

  return {
    paint, setSide, setTab, setCoin, setFiat, setPay,
    openOrderForm, previewOrder, createOrder, openAdForm, postAd,
    markPaid, confirmReceived, cancelOrder, toggleAd, removeAd, closeModal,
    offers, FIAT, get state() { return P; }
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
      Simulated marketplace. Crypto escrow moves your paper balances; the fiat leg is off-platform by design and no real payment is ever initiated here.
    </div>
    <div id="p2p-root"></div>
  </section>`;
}

function renderP2p() { P2P.paint(); }
