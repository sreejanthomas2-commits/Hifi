/* ╔══════════════════════════════════════════════════════════════════╗
   ║  HOME HUB — the exchange-style top of the home feed              ║
   ║                                                                  ║
   ║  Home reads like two apps at once: an exchange dashboard on top  ║
   ║  (search, balance, P2P, send, markets) and a social feed under   ║
   ║  it (stories, then posts behind Discover / Following / Crypto /  ║
   ║  Stocks tabs, with a pull-up bar on phones).                     ║
   ║                                                                  ║
   ║  Every number here comes from a service that already exists:     ║
   ║   balance     TR (paper trading account) or WL (connected        ║
   ║               wallets, demo balances labelled)                   ║
   ║   P2P card    P2P's own latest order and ad book                 ║
   ║   ref. rate   P2P's indicative FX × the live USDT price          ║
   ║   markets     the live price feed and tokenized stocks           ║
   ║                                                                  ║
   ║  Nothing here moves value. Add Funds only opens the screens that ║
   ║  already do that, and asks for no card, bank or wallet details.  ║
   ║  Stories, the composer and post cards are rendered by feeds.js   ║
   ║  exactly as before; this module only picks which posts a tab     ║
   ║  shows.                                                          ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const HX = (() => {

  const KEY = 'ts_homehub_v1';
  const DEF = { acct: 'exchange', hide: false, unit: 'USD', mkt: 'fav', feed: 'discover', dismissed: [] };
  let U = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      const u = { ...DEF, ...(raw && typeof raw === 'object' ? raw : {}) };
      if (!Array.isArray(u.dismissed)) u.dismissed = [];
      return u;
    } catch (e) { return { ...DEF, dismissed: [] }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(U)); } catch (e) {} }

  const $ = id => document.getElementById(id);
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
  const attr = s => esc(JSON.stringify(String(s)));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const ic = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');
  const tick = s => (typeof tickerOf === 'function' ? tickerOf(s) : s);
  const hasTR = () => typeof TR !== 'undefined';
  const isStock = s => !!(window.TokenMarkets && TokenMarkets.isStock(s));
  const chOf = c => (c ? (c.change24h ?? c.usd_24h_change ?? 0) || 0 : 0);
  const onHome = () => typeof S !== 'undefined' && S.pane === 'feeds' && !!$('pane-feeds');

  /* Crypto feed plus tokenized stocks, the same merge the Spot desk uses. */
  function live() {
    return { ...(window.liveCryptoPrices || {}), ...((window.TokenMarkets && TokenMarkets.prices()) || {}) };
  }

  const STABLE = new Set(['USDT', 'USDC', 'USD1', 'DAI', 'FDUSD', 'USDE', 'USDS', 'PYUSD', 'TUSD', 'BUSD', 'USDD', 'FRAX', 'GHO', 'RLUSD', 'USDP', 'USD0', 'BSC-USD', 'SUSDE', 'SUSDS', 'USDTB', 'USDX', 'EURC', 'XAUT', 'PAXG']);

  /* ── Formatting ──────────────────────────────────────────────────── */
  function money(v, dp) {
    const a = Math.abs(v || 0);
    const d = dp != null ? dp : 2;
    return (v < 0 ? '-$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function signed(v) { return (v >= 0 ? '+' : '-') + money(Math.abs(v)).replace('-', ''); }
  const pct = v => (v >= 0 ? '+' : '') + (v || 0).toFixed(2) + '%';
  function px(v) {
    if (!v && v !== 0) return '—';
    const a = Math.abs(v);
    const d = a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
    return v.toLocaleString('en-US', { minimumFractionDigits: Math.min(d, 2), maximumFractionDigits: d });
  }
  function big(v) {
    if (!v) return '';
    if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
    return '$' + Math.round(v).toLocaleString('en-US');
  }

  /* ── Local currency ──────────────────────────────────────────────── */
  /* P2P already prices ads in local fiat with indicative FX. Home uses the
     currency picked there; before a pick, a best guess from the device. */
  function fiatCode() {
    const F = (typeof P2P !== 'undefined' && P2P.FIAT) || null;
    if (!F) return 'USD';
    const picked = P2P.state && P2P.state.fiat;
    if (picked && picked !== 'USD' && F[picked]) return picked;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (/Calcutta|Kolkata/.test(tz)) return 'INR';
      if (/Lagos/.test(tz)) return 'NGN';
      if (/Dubai/.test(tz)) return 'AED';
      if (/Sao_Paulo/.test(tz)) return 'BRL';
      if (/London/.test(tz)) return 'GBP';
      const region = ((navigator.language || '').split('-')[1] || '').toUpperCase();
      const map = { IN: 'INR', NG: 'NGN', AE: 'AED', BR: 'BRL', GB: 'GBP', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', AT: 'EUR', BE: 'EUR', FI: 'EUR' };
      if (map[region] && F[map[region]]) return map[region];
    } catch (e) {}
    return 'USD';
  }
  function fiatFmt(v, code) {
    const F = (typeof P2P !== 'undefined' && P2P.FIAT) || {};
    const f = F[code] || { symbol: '$', rate: 1 };
    const dp = f.rate > 100 ? 0 : 2;
    return f.symbol + (v || 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  /* A price in local money for a list: whole units once it's large,
     full precision for fractions of a unit. */
  function localFmt(v, symbol) {
    if (!(v > 0)) return symbol + '0';
    return symbol + (v >= 100 ? Math.round(v).toLocaleString('en-US') : px(v));
  }

  /* ── 1. Search ───────────────────────────────────────────────────── */
  let hintTimer = null, hintAt = 0;
  function hints() {
    const t = (typeof DATA !== 'undefined' && Array.isArray(DATA.trending)) ? DATA.trending.map(x => x.name).filter(Boolean) : [];
    const coins = ['BTC', 'ETH', 'SOL'].filter(s => live()[s]).map(s => `${tick(s)} price`);
    return t.concat(coins).slice(0, 10);
  }
  function searchHTML() {
    const h = hints();
    return `<div class="hx-search" role="search">
      <button type="button" class="hx-search-f" onclick="HX.search()" aria-label="Search Trending">
        <span class="material-symbols-rounded" aria-hidden="true">search</span>
        <span class="hx-hint" id="hx-hint">${esc(h[hintAt % Math.max(h.length, 1)] || 'Search people, posts and coins')}</span>
      </button>
      <button type="button" class="hx-scan" onclick="HX.scan()" title="Scan a QR code" aria-label="Scan a QR code">
        <span class="material-symbols-rounded">qr_code_scanner</span>
      </button>
    </div>`;
  }
  function rotateHint() {
    const el = $('hx-hint');
    if (!el || !onHome() || document.hidden) return;
    const h = hints();
    if (h.length < 2) return;
    hintAt = (hintAt + 1) % h.length;
    el.classList.add('out');
    setTimeout(() => { el.textContent = h[hintAt]; el.classList.remove('out'); }, 180);
  }
  function search() {
    if (typeof MOB !== 'undefined' && MOB.openSearch) { MOB.openSearch(); return; }
    const g = $('global-search');
    if (g) g.focus();
  }
  function scan() {
    if (typeof PAY !== 'undefined' && PAY.openScan) PAY.openScan();
    else toast('The scanner is still loading…');
  }

  /* ── 2. Balance ──────────────────────────────────────────────────── */
  /* Everything you hold in the app: Funding, Spot and Earn. This used to
     be the Spot account alone, so the headline figure here disagreed with
     the Assets page and left the wallet the app actually pays from out of
     its own total. */
  function exchangeView() {
    if (typeof MNY !== 'undefined') {
      const n = MNY.netWorth();
      const mv = MNY.dayMove(n.rows);
      return { usd: n.total, abs: mv.abs, pct: mv.pct };
    }
    if (!hasTR()) return null;
    const eq = TR.equity();
    const h = TR.state.holdings || {};
    const L = live();
    let now = 0, then = 0;
    Object.keys(h).forEach(sym => {
      const c = L[sym];
      if (!c || !h[sym].qty) return;
      const value = h[sym].qty * c.usd;
      now += value;
      then += value / (1 + chOf(c) / 100);
    });
    const abs = now - then;
    return { usd: eq, abs, pct: eq > 0 ? (abs / (eq - abs)) * 100 : 0 };
  }

  function walletView() {
    if (typeof WL === 'undefined') return { none: true };
    const list = WL.accounts() || [];
    if (!list.length) return { none: true };
    const L = live();
    let usd = 0, then = 0, priced = 0, demo = false;
    list.forEach(a => {
      if (!a.native || !a.native.amount) return;
      const c = L[a.native.symbol];
      if (!c) return;
      const v = a.native.amount * c.usd;
      usd += v; then += v / (1 + chOf(c) / 100); priced++;
      if (a.native.simulated) demo = true;
    });
    const main = WL.account();
    return { usd, abs: usd - then, pct: then > 0 ? ((usd - then) / then) * 100 : 0, priced, demo, count: list.length,
      addr: main ? WL.shortAddr(main.address) : '' };
  }

  function amountText(usd) {
    if (U.hide) return '******';
    if (U.unit === 'BTC') {
      const b = live().BTC;
      if (b && b.usd) return (usd / b.usd).toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 }) + ' <small>BTC</small>';
    }
    return money(usd);
  }

  function acctHTML() {
    const ex = U.acct !== 'wallet';
    const v = ex ? exchangeView() : walletView();
    const seg = `<div class="hx-seg" role="tablist" aria-label="Account">
      <button type="button" role="tab" aria-selected="${ex}" class="${ex ? 'on' : ''}" onclick="HX.acct('exchange')">Exchange</button>
      <button type="button" role="tab" aria-selected="${!ex}" class="${!ex ? 'on' : ''}" onclick="HX.acct('wallet')">Wallet</button>
    </div>`;
    const unitBtn = `<button type="button" class="hx-unit" onclick="HX.unit()" title="Show value in ${U.unit === 'BTC' ? 'USD' : 'BTC'}">
        Est. Total Value (${U.unit === 'BTC' ? 'BTC' : 'USD'})<span class="material-symbols-rounded" aria-hidden="true">unfold_more</span></button>
      <button type="button" class="hx-eye" onclick="HX.hide()" aria-label="${U.hide ? 'Show balance' : 'Hide balance'}" aria-pressed="${U.hide}">
        <span class="material-symbols-rounded">${U.hide ? 'visibility_off' : 'visibility'}</span></button>`;

    if (!v) {
      return `<section class="hx-card hx-acct">${seg}<div class="hx-empty">Your trading account is still loading…</div></section>`;
    }

    if (!ex && v.none) {
      return `<section class="hx-card hx-acct">
        <div class="hx-acct-top">${seg}</div>
        <div class="hx-acct-l">Connected wallets</div>
        <div class="hx-acct-row">
          <div class="hx-bal hx-bal-none">No wallet yet</div>
          <button type="button" class="hx-cta" onclick="HX.connect()">Connect</button>
        </div>
        <div class="hx-pnl-l">Wallets connect read-only — Trending never asks for a seed phrase.</div>
      </section>`;
    }

    const up = v.abs >= 0;
    const tag = ex
      ? '<span class="hx-tag" title="Trades use live prices on a simulated balance">Paper</span>'
      : (v.demo ? '<span class="hx-tag" title="A demo wallet shows a made-up balance">Demo</span>' : '');
    const sub = ex
      ? `<button type="button" class="hx-pnl" onclick="navigateTo('portfolio')">
           <span class="hx-pnl-l">24h PnL</span>
           <b class="${up ? 'up' : 'dn'}">${U.hide ? '****' : `${signed(v.abs)} (${pct(v.pct)})`}</b>
           <span class="material-symbols-rounded" aria-hidden="true">chevron_right</span>
         </button>`
      : `<button type="button" class="hx-pnl" onclick="HX.openWallet()">
           <span class="hx-pnl-l">${v.count} wallet${v.count === 1 ? '' : 's'}${v.addr ? ' · ' + esc(v.addr) : ''}</span>
           ${v.priced ? `<b class="${up ? 'up' : 'dn'}">${U.hide ? '****' : pct(v.pct)}</b>` : ''}
           <span class="material-symbols-rounded" aria-hidden="true">chevron_right</span>
         </button>`;

    return `<section class="hx-card hx-acct">
      <div class="hx-acct-top">${seg}${tag}</div>
      <div class="hx-acct-l">${unitBtn}</div>
      <div class="hx-acct-row">
        <div class="hx-bal" id="hx-bal">${!ex && !v.priced ? '<span class="hx-bal-none">Balance unavailable</span>' : amountText(v.usd)}</div>
        ${ex
          ? '<button type="button" class="hx-cta" onclick="HX.addFunds()">Add Funds</button>'
          : '<button type="button" class="hx-cta" onclick="HX.receive()">Receive</button>'}
      </div>
      ${sub}
    </section>`;
  }

  /* Add Funds lists the screens that already bring money in — nothing
     here takes payment details. */
  const FUNDS = [
    { icon: 'token', color: '#F0A23B', t: 'Deposit crypto', d: 'Receive coins from another exchange or wallet', go: () => { if (typeof DEP !== 'undefined') DEP.open('asset'); else receive(); } },
    { icon: 'account_balance_wallet', color: '#7C5CFF', t: 'Deposit to Spot', d: 'Move paper USDT from your wallet into trading', go: () => navigateTo('portfolio') },
    { icon: 'swap_horiz', color: '#26A69A', t: 'Buy with P2P', d: 'Pay a seller in local currency, off-platform', go: () => { if (typeof P2P !== 'undefined') P2P.setSide('buy'); navigateTo('p2p'); } },
    { icon: 'qr_code_2', color: '#EC6CB9', t: 'Receive crypto', d: 'Show your wallet address and QR code', go: () => receive() },
    { icon: 'request_quote', color: '#F0A23B', t: 'Request a payment', d: 'Your Trending pay code for friends', go: () => { if (typeof PAY !== 'undefined') PAY.openMyQR(); } },
    { icon: 'sync_alt', color: '#42A5F5', t: 'Convert', d: 'Swap one coin for another', go: () => { if (typeof CT !== 'undefined') CT.open('convert'); else navigateTo('trade'); } }
  ];
  let lastFocus = null;
  function addFunds() {
    closeFunds();
    lastFocus = document.activeElement;
    const el = document.createElement('div');
    el.id = 'hx-funds';
    el.className = 'mob-scrim';
    el.innerHTML = `<div class="mob-sheet hx-funds" role="dialog" aria-modal="true" aria-labelledby="hx-funds-t">
      <span class="mob-grab" aria-hidden="true"></span>
      <div class="hx-funds-h">
        <b id="hx-funds-t">Add Funds</b>
        <button type="button" class="icon-btn" onclick="HX.closeFunds()" aria-label="Close"><span class="material-symbols-rounded">close</span></button>
      </div>
      <p class="hx-funds-note">Balances in Trending are simulated. No card, bank or UPI details are ever asked for here.</p>
      ${FUNDS.map((f, i) => `<button type="button" class="hx-fund" data-i="${i}">
        <span class="hx-fund-ic" style="color:${f.color}"><span class="material-symbols-rounded">${f.icon}</span></span>
        <span class="hx-fund-t"><b>${esc(f.t)}</b><em>${esc(f.d)}</em></span>
        <span class="material-symbols-rounded hx-fund-go" aria-hidden="true">chevron_right</span>
      </button>`).join('')}
    </div>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('.hx-fund');
      if (b) { const f = FUNDS[+b.dataset.i]; closeFunds(true); if (f) f.go(); return; }
      if (e.target === el) closeFunds();
    });
    document.body.appendChild(el);
    document.addEventListener('keydown', fundsKey, true);
    requestAnimationFrame(() => { el.classList.add('open'); const f = el.querySelector('.hx-fund'); if (f) f.focus({ preventScroll: true }); });
  }
  function closeFunds(leaving) {
    const el = $('hx-funds');
    if (!el) return;
    el.remove();
    document.removeEventListener('keydown', fundsKey, true);
    if (!leaving && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function fundsKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFunds(); } }

  function receive() {
    if (typeof WAD !== 'undefined' && WAD.openMine) WAD.openMine();
    else if (typeof PAY !== 'undefined') PAY.openMyQR();
  }
  function connect() {
    if (typeof WL !== 'undefined') WL.openChooser();
  }
  function openWallet() {
    navigateTo('profile');
    if (typeof switchProfileTab === 'function') switchProfileTab('wallet');
  }

  /* ── 3. Promo ────────────────────────────────────────────────────── */
  function stockCount() {
    return hasTR() ? TR.pairs().filter(isStock).length : 0;
  }
  function promos() {
    const n = stockCount();
    const best = typeof EN !== 'undefined' && Array.isArray(EN.PRODUCTS) && EN.PRODUCTS.length
      ? Math.max(...EN.PRODUCTS.map(p => +p.apy || 0)) : 0;
    return [
      n ? { id: 'stocks', icon: 'monitoring', color: '#2EBD85', title: 'Tokenized stocks are live on Spot',
            body: `${n} US stocks · USDT, USDC & USD1 pairs`, cta: 'Trade', go: 'stocks' } : null,
      { id: 'chatpay', icon: 'forum', color: '#EC6CB9', title: 'Send crypto in chat',
        body: 'Pay, request and share addresses in Messages', cta: 'Open', go: 'messages' },
      best ? { id: 'earn', icon: 'savings', color: '#F0B90B', title: 'Put idle coins to work',
               body: `Up to ${best}% APY, flexible or locked`, cta: 'Earn', go: 'earn' } : null
    ].filter(Boolean);
  }
  function promoHTML() {
    const p = promos().find(x => !U.dismissed.includes(x.id));
    if (!p) return '';
    return `<section class="hx-card hx-promo">
      <div class="hx-promo-h">
        <span class="hx-promo-t">${esc(p.title)}</span>
        <button type="button" class="hx-x" onclick="HX.dismiss(${attr(p.id)})" aria-label="Dismiss"><span class="material-symbols-rounded">close</span></button>
      </div>
      <div class="hx-promo-b">
        <span class="hx-promo-ic" style="color:${p.color}"><span class="material-symbols-rounded">${p.icon}</span></span>
        <span class="hx-promo-body">${esc(p.body)}</span>
        <button type="button" class="hx-promo-cta" onclick="HX.promo(${attr(p.go)})">${esc(p.cta)}</button>
      </div>
    </section>`;
  }
  function promo(go) {
    if (go === 'stocks') { openStocks(); return; }
    if (go === 'messages' || go === 'earn') navigateTo(go);
  }
  function dismiss(id) {
    if (!U.dismissed.includes(id)) U.dismissed.push(id);
    save();
    paintDash();
  }
  function openStocks() {
    if (hasTR()) TR.setAssetFilter('stocks');
    navigateTo('trade');
  }

  /* ── 4. P2P and Send cards ───────────────────────────────────────── */
  const P2P_STEP = { pending_payment: 1, awaiting_payment: 1, paid: 2, completed: 3, cancelled: 0 };
  const P2P_LABEL = { pending_payment: 'Pay the seller', awaiting_payment: 'Awaiting buyer', paid: 'Releasing…', completed: 'Completed', cancelled: 'Cancelled' };

  function p2pHTML() {
    if (typeof P2P === 'undefined') return '';
    const o = (P2P.state.orders || [])[0];
    if (o) {
      const step = P2P_STEP[o.status] ?? 1;
      return `<button type="button" class="hx-card hx-duo" onclick="HX.openP2P(true)">
        <span class="hx-duo-h">P2P ${o.side === 'buy' ? 'Buy' : 'Sell'} Order <span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></span>
        <span class="hx-duo-coin">${ic(o.coin, 30)}<span>
          <b>${U.hide ? '****' : esc((+o.fiatAmount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + o.fiat)}</b>
          <em>${U.hide ? '****' : esc(hasTR() && TR.qtyFmt ? TR.qtyFmt(o.qty) : (+o.qty).toFixed(4))} ${esc(tick(o.coin))}</em></span></span>
        <span class="hx-duo-status${o.status === 'cancelled' ? ' dn' : ''}">${esc(P2P_LABEL[o.status] || o.status)}</span>
        <span class="hx-steps${o.status === 'cancelled' ? ' off' : ''}" aria-hidden="true">${stepsHTML(step)}</span>
      </button>`;
    }
    const code = fiatCode();
    const book = P2P.offers('buy', 'USDT', code);
    const best = book && book[0];
    return `<button type="button" class="hx-card hx-duo" onclick="HX.openP2P()">
      <span class="hx-duo-h">P2P Trading <span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></span>
      <span class="hx-duo-coin">${ic('USDT', 30)}<span><b>Buy USDT</b><em>with ${esc(code)}</em></span></span>
      <span class="hx-duo-l">Best offer</span>
      <span class="hx-duo-v">${best ? esc(fiatFmt(best.price, code)) : '—'}</span>
      <span class="hx-duo-s">USDT/${esc(code)}</span>
    </button>`;
  }
  function stepsHTML(step) {
    return [1, 2, 3].map(i => (i > 1 ? `<b class="${i <= step ? 'on' : ''}"></b>` : '') + `<i class="${i <= step ? 'on' : ''}"></i>`).join('');
  }
  function openP2P(orders) {
    if (typeof P2P !== 'undefined' && orders) P2P.setTab('orders');
    navigateTo('p2p');
  }

  function spark(series, w, h) {
    const s = (series || []).filter(Number.isFinite);
    if (s.length < 2) return '';
    const lo = Math.min(...s), hi = Math.max(...s), span = hi - lo || 1;
    const pts = s.map((v, i) => `${(i / (s.length - 1) * w).toFixed(1)},${(h - 2 - (v - lo) / span * (h - 4)).toFixed(1)}`).join(' ');
    const up = s[s.length - 1] >= s[0];
    return `<svg class="hx-spark ${up ? 'up' : 'dn'}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" preserveAspectRatio="none">
      <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  function sendHTML() {
    const code = fiatCode();
    const F = (typeof P2P !== 'undefined' && P2P.FIAT) || { USD: { rate: 1 } };
    const rate = (F[code] || F.USD).rate;
    const usdt = (window.liveCryptoPrices || {}).USDT;
    const ref = rate * (usdt && usdt.usd ? usdt.usd : 1);
    const series = usdt && Array.isArray(usdt.spark) ? usdt.spark.map(v => v * rate) : null;
    return `<button type="button" class="hx-card hx-duo" onclick="HX.send()">
      <span class="hx-duo-h">Send Money</span>
      <span class="hx-duo-big">Send crypto &amp; request payments</span>
      <span class="hx-duo-l" title="P2P's indicative exchange rate × the live USDT price">Ref. Rate</span>
      <span class="hx-duo-rate"><span class="hx-duo-v">${esc(fiatFmt(ref, code))}</span>${spark(series, 64, 22)}</span>
      <span class="hx-duo-s">USDT/${esc(code)}</span>
    </button>`;
  }
  /* Money going out, all three ways it can: to another Trending user, to
     an outside wallet, or sold on P2P. Add Funds is the other direction
     and keeps to it. */
  function send() {
    if (typeof WD !== 'undefined' && WD.open) { WD.open('ETH'); return; }
    if (typeof PAY !== 'undefined' && PAY.openHub) PAY.openHub();
    else navigateTo('messages');
  }

  /* ── 5. Markets ──────────────────────────────────────────────────── */
  const TABS = [['fav', 'Favorites'], ['hot', 'Hot'], ['gain', 'Gainers'], ['lose', 'Losers'], ['stocks', 'Stocks']];
  const ROWS = 6;

  function marketList(tab) {
    const L = live();
    const tradable = hasTR() ? TR.pairs() : Object.keys(L);
    const crypto = tradable.filter(s => !isStock(s) && !STABLE.has(s) && L[s] && L[s].usd > 0);
    const byCap = (a, b) => (L[b].mcap || 0) - (L[a].mcap || 0);
    if (tab === 'fav') {
      const w = typeof CT !== 'undefined' && CT.state ? CT.state.watchlist || [] : [];
      const mine = w.filter(s => L[s] && tradable.includes(s));
      const base = mine.length ? mine : ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE'].filter(s => L[s]);
      return { list: base.slice(0, ROWS), hint: mine.length ? '' : 'Star coins on the Spot desk to pin them here.' };
    }
    if (tab === 'hot') return { list: crypto.slice().sort(byCap).slice(0, ROWS) };
    if (tab === 'gain') return { list: crypto.slice().sort((a, b) => chOf(L[b]) - chOf(L[a])).slice(0, ROWS) };
    if (tab === 'lose') return { list: crypto.slice().sort((a, b) => chOf(L[a]) - chOf(L[b])).slice(0, ROWS) };
    return { list: stockList(tradable, L).slice(0, ROWS), empty: 'Tokenized-stock prices are still loading.' };
  }

  /* One token per company (several issuers wrap the same share), the
     best-known companies first, then the rest by the day's move. */
  const POPULAR = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'COIN', 'MSTR', 'SPY', 'QQQ', 'HOOD', 'AMD', 'NFLX', 'PLTR', 'CRCL'];
  const ISSUER_RANK = s => (/X$/.test(s) ? 0 : /ON$/.test(s) ? 1 : 2);
  function stockList(tradable, L) {
    const best = new Map();
    tradable.filter(s => isStock(s) && L[s] && L[s].usd > 0 && !L[s].stale).forEach(s => {
      const i = window.TokenMarkets ? TokenMarkets.info(s) : null;
      const key = i && i.underlying ? i.underlying.ticker : s;
      const cur = best.get(key);
      if (!cur || ISSUER_RANK(s) < ISSUER_RANK(cur) || (ISSUER_RANK(s) === ISSUER_RANK(cur) && s < cur)) best.set(key, s);
    });
    const rank = k => { const i = POPULAR.indexOf(k); return i < 0 ? 99 : i; };
    return [...best.entries()]
      .sort((a, b) => (rank(a[0]) - rank(b[0])) || (Math.abs(chOf(L[b[1]])) - Math.abs(chOf(L[a[1]]))))
      .map(e => e[1]);
  }

  function rowSub(sym, c) {
    if (isStock(sym) && window.TokenMarkets) {
      const i = TokenMarkets.info(sym);
      if (i && i.underlying) return `${i.underlying.ticker} · ${i.underlying.exchange}`;
      return i && i.issuer ? i.issuer : 'Tokenized stock';
    }
    return big(c.mcap);
  }

  function rowHTML(sym) {
    const c = live()[sym];
    if (!c) return '';
    const ch = chOf(c);
    const code = fiatCode();
    const F = (typeof P2P !== 'undefined' && P2P.FIAT) || {};
    const local = code !== 'USD' && F[code] ? `≈${localFmt(c.usd * F[code].rate, F[code].symbol)}` : '';
    const stale = !!c.stale;
    return `<button type="button" class="hx-mrow" data-sym="${esc(sym)}" onclick="HX.coin(${attr(sym)})">
      <span class="hx-mname">${ic(sym, 28)}<span><b>${esc(tick(sym))}<i>/USDT</i></b><em>${esc(rowSub(sym, c))}</em></span></span>
      <span class="hx-mpx${stale ? ' stale' : ''}"${stale ? ' title="Last known price — waiting for a live quote"' : ''}><b>${px(c.usd)}</b><em>${esc(local || '$' + px(c.usd))}</em></span>
      <span class="hx-mch ${ch >= 0 ? 'up' : 'dn'}">${pct(ch)}</span>
    </button>`;
  }

  function marketsHTML() {
    const m = marketList(U.mkt);
    const rows = m.list.map(rowHTML).join('');
    const loading = !Object.keys(window.liveCryptoPrices || {}).length;
    return `<section class="hx-card hx-mkts">
      <div class="hx-mtabs-w">
        <div class="hx-mtabs" role="tablist" aria-label="Markets">
          ${TABS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${U.mkt === k}" class="${U.mkt === k ? 'on' : ''}" onclick="HX.mkt(${attr(k)})">${n}</button>`).join('')}
        </div>
        <button type="button" class="hx-mmore" onclick="HX.allMarkets()" title="All markets" aria-label="All markets"><span class="material-symbols-rounded">format_list_bulleted</span></button>
      </div>
      <div class="hx-msub"><span class="on">Spot</span></div>
      <div class="hx-mheads" aria-hidden="true">
        <div class="hx-mhead"><span>Name</span><span>Last Price</span><span>24h chg%</span></div>
        <div class="hx-mhead hx-wide"><span>Name</span><span>Last Price</span><span>24h chg%</span></div>
      </div>
      <div class="hx-mrows" id="hx-mrows">
        ${rows || (loading
          ? Array.from({ length: 4 }, () => '<div class="hx-mrow hx-skel"><span></span><span></span><span></span></div>').join('')
          : `<div class="hx-empty">${esc(m.empty || 'Nothing to show yet.')}</div>`)}
      </div>
      ${m.hint ? `<div class="hx-mhint">☆ ${esc(m.hint)}</div>` : ''}
      <button type="button" class="hx-mall" onclick="HX.allMarkets()">View more <span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></button>
    </section>`;
  }

  function coin(sym) {
    const s = String(sym || '').toUpperCase();
    if (hasTR() && TR.isTradable(s)) {
      TR.setAssetFilter(isStock(s) ? 'stocks' : 'all');
      TR.setPair(s);
      navigateTo('trade');
      return;
    }
    toast(`${tick(s)} has no live price right now.`);
  }
  function allMarkets() {
    if (hasTR()) TR.setAssetFilter(U.mkt === 'stocks' ? 'stocks' : 'all');
    navigateTo('trade');
  }
  function mkt(k) {
    if (!TABS.some(t => t[0] === k)) return;
    U.mkt = k; save();
    const host = $('hx-mkts');
    if (host) host.innerHTML = marketsHTML();
    const on = host && host.querySelector('.hx-mtabs .on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* Streamed prices change between polls; patch the visible numbers in
     place so a tap on a row is never lost to a rebuild. */
  function tickRows() {
    const host = $('hx-mrows');
    if (!host) return;
    const L = live();
    host.querySelectorAll('.hx-mrow[data-sym]').forEach(r => {
      const c = L[r.dataset.sym];
      if (!c) return;
      const b = r.querySelector('.hx-mpx b');
      const nextPx = px(c.usd);
      if (b && b.textContent !== nextPx) {
        const upTick = parseFloat(b.textContent.replace(/,/g, '')) < c.usd;
        b.textContent = nextPx;
        b.classList.remove('flash-up', 'flash-dn');
        void b.offsetWidth;
        b.classList.add(upTick ? 'flash-up' : 'flash-dn');
      }
      const ch = r.querySelector('.hx-mch');
      const v = chOf(c);
      if (ch) { ch.textContent = pct(v); ch.className = 'hx-mch ' + (v >= 0 ? 'up' : 'dn'); }
    });
  }

  /* ── 6. Feed tabs ────────────────────────────────────────────────── */
  const FEEDS = [['discover', 'Discover'], ['following', 'Following'], ['crypto', 'Crypto'], ['stocks', 'Stocks']];
  const CRYPTO_RE = /crypto|bitcoin|\bbtc\b|ethereum|\beth\b|solana|defi|web3|nft|altcoin|blockchain|token|airdrop|bullmarket|bearmarket|onchain|stablecoin/i;
  const STOCK_RE = /stock|nasdaq|nyse|s&p|equit|earnings|dividend|tokenized|xstocks|\$(AAPL|TSLA|NVDA|MSFT|AMZN|GOOGL?|META|NFLX|COIN|HOOD|MSTR|SPY|QQQ)\b/i;

  function feedTabsHTML(cls) {
    return FEEDS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${U.feed === k}" class="${U.feed === k ? 'on' : ''}" onclick="HX.feed(${attr(k)}${cls ? ', true' : ''})">${n}</button>`).join('');
  }
  function sheetHTML() {
    return `<div class="hx-sheet-in">
      <span class="hx-grab" aria-hidden="true"></span>
      <div class="hx-ftabs" role="tablist" aria-label="Feed">${feedTabsHTML()}</div>
    </div>`;
  }
  function peekHTML() {
    return `<button type="button" class="hx-peek-grab" onclick="HX.toFeed()" aria-label="Open the feed"><span class="hx-grab" aria-hidden="true"></span></button>
      <div class="hx-peek-row">
        <div class="hx-ftabs" role="tablist" aria-label="Feed">${feedTabsHTML(true)}</div>
        <button type="button" class="hx-peek-up" onclick="HX.toFeed()" aria-label="Open the feed"><span class="material-symbols-rounded">expand_less</span></button>
      </div>`;
  }

  function friendNames() {
    const f = (typeof DATA !== 'undefined' && DATA.suggestedFriends) || [];
    return new Set(f.filter(x => x.state === 'friends').map(x => x.name));
  }
  function me() {
    const u = (typeof S !== 'undefined' && S.user) || {};
    return { uid: u.uid || '', name: [u.fname, u.lname].filter(Boolean).join(' ').trim() || u.name || '' };
  }
  function textOf(p) {
    return [p.body, p.category, (p.tags || []).join(' ')].filter(Boolean).join(' ');
  }

  /* feeds.js asks which posts the current tab shows; Discover shows all. */
  function filterPosts(posts) {
    const k = U.feed;
    if (!Array.isArray(posts) || k === 'discover') return posts;
    if (k === 'following') {
      const names = friendNames();
      const m = me();
      return posts.filter(p => names.has(p.author) || (m.uid && p.uid === m.uid) || (m.name && p.author === m.name) || p.mine);
    }
    if (k === 'crypto') return posts.filter(p => p.category === 'crypto' || CRYPTO_RE.test(textOf(p)));
    if (k === 'stocks') return posts.filter(p => p.category === 'stocks' || STOCK_RE.test(textOf(p)));
    return posts;
  }

  function emptyFeed(q) {
    if (q) return `<div class="hx-feed-empty"><span class="material-symbols-rounded">search_off</span><b>No posts match “${esc(q)}”</b></div>`;
    if (U.feed === 'following') {
      const f = ((typeof DATA !== 'undefined' && DATA.suggestedFriends) || []).filter(x => x.state !== 'friends').slice(0, 3);
      return `<div class="hx-feed-empty">
        <span class="material-symbols-rounded">group_add</span>
        <b>Posts from your friends show up here</b>
        <p>Add a few people and their posts will land in this tab.</p>
        ${f.map(x => `<div class="hx-follow">
          <span class="avatar av-xs">${esc(typeof postInitials === 'function' ? postInitials(x.name) : x.name[0])}</span>
          <span class="hx-follow-n"><b>${esc(x.name)}</b><em>${esc(x.handle || '')}</em></span>
          ${x.state === 'pending'
            ? '<span class="hx-follow-p">Pending</span>'
            : `<button type="button" class="btn btn-primary btn-sm" onclick="HX.follow(${+x.id}, event)">Add</button>`}
        </div>`).join('')}
        <button type="button" class="btn btn-ghost btn-sm" onclick="HX.search()">Find people</button>
      </div>`;
    }
    if (U.feed === 'stocks') {
      return `<div class="hx-feed-empty">
        <span class="material-symbols-rounded">monitoring</span>
        <b>No stock talk yet</b>
        <p>Posts about stocks and tokenized equities will collect here.</p>
        <button type="button" class="btn btn-primary btn-sm" onclick="HX.openStocks()">See tokenized stocks</button>
      </div>`;
    }
    return `<div class="hx-feed-empty">
      <span class="material-symbols-rounded">currency_bitcoin</span>
      <b>No crypto posts yet</b>
      <p>Share a take on the market and it will show up here.</p>
      <button type="button" class="btn btn-primary btn-sm" onclick="HX.compose()">Write a post</button>
    </div>`;
  }

  function follow(id, e) {
    if (typeof sendFriendRequest !== 'function') return;
    sendFriendRequest(id, e);
    if (typeof renderFeed === 'function') {
      renderFeed();
      // feeds.js accepts the request after 3s; show their posts then.
      setTimeout(() => { if (U.feed === 'following' && onHome()) renderFeed(); }, 3200);
    }
  }
  function compose() {
    if (typeof CR !== 'undefined' && CR.open) { CR.open('post', 'compose'); return; }
    const i = $('post-input');
    if (!i) return;
    i.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => i.focus({ preventScroll: true }), 250);
  }

  function feed(k, jump) {
    if (!FEEDS.some(f => f[0] === k)) return;
    const changed = U.feed !== k;
    U.feed = k; save();
    paintTabs();
    if (changed && typeof renderFeed === 'function') renderFeed();
    if (jump || changed) toFeed(!jump);
  }
  /* Bring the tab bar to the top of the pane, unless it's already there. */
  function toFeed(onlyIfBelow) {
    const sheet = $('hx-sheet');
    const pane = $('pane-feeds');
    if (!sheet || !pane) return;
    const top = sheet.getBoundingClientRect().top - pane.getBoundingClientRect().top;
    if (onlyIfBelow && top <= 1) {
      // Already pinned: start the new tab from its first post.
      const layout = pane.querySelector('.home-layout');
      if (layout) pane.scrollTo({ top: layout.offsetTop - sheet.offsetHeight - 4, behavior: 'smooth' });
      return;
    }
    if (onlyIfBelow) return;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    pane.scrollTo({ top: pane.scrollTop + top, behavior: reduce ? 'auto' : 'smooth' });
  }

  function paintTabs() {
    const sheet = $('hx-sheet');
    if (sheet) sheet.innerHTML = sheetHTML();
    const peek = $('hx-peek');
    if (peek) peek.innerHTML = peekHTML();
  }

  /* The pull-up bar shows while the feed is still below the screen. */
  let io = null;
  function watchSheet() {
    const sheet = $('hx-sheet'), peek = $('hx-peek');
    if (!sheet || !peek || !('IntersectionObserver' in window)) return;
    if (io) io.disconnect();
    io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        const below = !en.isIntersecting && en.boundingClientRect.top > 0;
        peek.classList.toggle('show', below);
        peek.setAttribute('aria-hidden', below ? 'false' : 'true');
        peek.inert = !below;
      });
    }, { root: null, rootMargin: '0px 0px -72px 0px', threshold: 0 });
    io.observe(sheet);
  }

  /* ── Paint ───────────────────────────────────────────────────────── */
  function paintDash() {
    const d = $('hx-dash');
    if (!d) return;
    d.innerHTML = acctHTML() + promoHTML() + `<div class="hx-duos">${p2pHTML()}${sendHTML()}</div>`;
    fitBal();
  }
  /* A big balance next to Add Funds: shrink the figure rather than cut it. */
  function fitBal() {
    const el = $('hx-bal');
    if (!el || !el.clientWidth) return;
    el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize) || 30;
    while (el.scrollWidth > el.clientWidth + 1 && size > 18) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
  }
  let fitTimer = null;
  window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitBal, 120); });

  function paint() {
    const pane = $('pane-feeds');
    if (!pane) return;
    pane.classList.add('hx');
    // The tab bar pins over the pane's top padding, whatever it is here.
    pane.style.setProperty('--hx-pad-top', getComputedStyle(pane).paddingTop);
    const s = $('hx-search');
    if (s) s.innerHTML = searchHTML();
    paintDash();
    const m = $('hx-mkts');
    if (m) m.innerHTML = marketsHTML();
    paintTabs();
    watchSheet();
    if (!hintTimer) hintTimer = setInterval(rotateHint, 4000);
    if (!liveTimer) liveTimer = setInterval(() => { if (onHome() && !document.hidden) tickRows(); }, 3000);
  }
  let liveTimer = null;

  /* A poll landed: rebuild the numbers, but leave anything being typed
     or an open sheet alone. */
  function onPriceTick() {
    if (!onHome()) return;
    paintDash();
    const m = $('hx-mkts');
    if (m) m.innerHTML = marketsHTML();
  }

  function acct(k) { U.acct = k === 'wallet' ? 'wallet' : 'exchange'; save(); paintDash(); }
  function unit() { U.unit = U.unit === 'BTC' ? 'USD' : 'BTC'; save(); paintDash(); }
  function hide() { U.hide = !U.hide; save(); paintDash(); }

  return {
    paint, onPriceTick, filterPosts, emptyFeed,
    repaint: () => { if (document.getElementById('hx-dash')) paintDash(); },
    search, scan, acct, unit, hide, addFunds, closeFunds, receive, connect, openWallet,
    dismiss, promo, openStocks, openP2P, send, coin, allMarkets, mkt, feed, toFeed, follow, compose,
    get state() { return U; }
  };
})();

window.HX = HX;

/* Router hook, next to renderHomeCrypto. */
function renderHomeHub() { HX.paint(); }

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module now, so its top-level names are private
   to it. Inline onclick= handlers and every other module still look
   them up on the global object, so they are republished here.

   Each one is a thunk because the list is produced by scanning, and
   scanning over-collects — a line inside a template literal can look
   like a declaration. publish() calls each thunk and skips the ones
   that do not resolve, so a phantom costs one caught error and not a
   dead module graph. */
import { publish } from '../globals.js?v=2';
publish('pages/homehub.js', {
  HX: () => HX, renderHomeHub: () => renderHomeHub
});
