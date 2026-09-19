/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SPOT TRADING DESK                                               ║
   ║                                                                  ║
   ║  Trade every coin in the live CoinGecko feed (150 pairs vs USDT).║
   ║  Market and limit orders, an order book, open orders, fills,     ║
   ║  holdings with average cost and P&L, and deposit / withdraw      ║
   ║  between the social wallet and the trading account.              ║
   ║                                                                  ║
   ║  IMPORTANT: this is a PAPER account. Orders never leave the      ║
   ║  browser — there is no exchange connection and no custody. It    ║
   ║  prices against real market data, but settles against a local    ║
   ║  balance held in localStorage.                                   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const TR = (() => {

  const KEY = 'ts_trade';
  const FEE = 0.001;              // 0.1% taker fee, charged on the quote leg
  let QUOTE = 'USDT';
  const QUOTES = ['USDT', 'USDC', 'USD1'];
  let assetFilter = 'all';

  const DEFAULT = {
    cash: 100000,                 // paper USDT
    holdings: {},                 // SYM -> { qty, avgCost }
    orders: [],                   // open limit orders
    fills: [],                    // executed trades, newest first
    realized: 0,                  // realised P&L in USDT
    feesPaid: 0,
    pair: 'BTC'
  };

  let T = load();
  QUOTE = QUOTES.includes(T.quote) ? T.quote : 'USDT';
  // Existing cash and holdings keep their original meaning; cost basis is USD.
  const quoteRate = q => q === 'USDT' ? 1 : Number(live()[q]?.usd) || 0;
  const quoteBalance = q => q === 'USDT' ? T.cash : holding(q).qty;
  const pairPrice = (sym, q = QUOTE) => quoteRate(q) > 0 ? priceOf(sym) / quoteRate(q) : 0;
  /* Prices and costs in the quote currency. Dividing by a USDC/USD1 rate
     turns 332.3 into 332.41634572, so decimals follow the size of the number. */
  const pxFmt = v => {
    if (!v) return '0';
    const a = Math.abs(v);
    const d = a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
    return v.toLocaleString('en-US', { minimumFractionDigits: a >= 100 ? 2 : 0, maximumFractionDigits: d });
  };
  const quoteFmt = v => pxFmt(v) + ' ' + QUOTE;
  const pairLabel = sym => pairPrice(sym) > 0 ? quoteFmt(pairPrice(sym)) : 'Price unavailable';
  function moveQuote(q, amount) {
    if (q === 'USDT') T.cash += amount;
    else {
      const old = holding(q);
      const qty = old.qty + amount;
      if (amount < 0) T.realized += (quoteRate(q) - old.avgCost) * -amount;
      T.holdings[q] = { qty: Math.max(0, qty), avgCost: amount > 0 && qty > 0 ? (old.qty * old.avgCost + amount * quoteRate(q)) / qty : old.avgCost };
    }
  }
  function setQuote(q) {
    if (!QUOTES.includes(q)) return false;
    QUOTE = q; T.quote = q;
    if (T.pair === q) T.pair = pairs()[0] || 'BTC';
    save(); repaint(); return true;
  }
  function setAssetFilter(value) { assetFilter = value; paintPairList(); }
  function quoteSelector() {
    return '<label class="form-label">Spot quote currency</label><select aria-label="Spot quote currency" class="input mb8" onchange="TR.setQuote(this.value)">' + QUOTES.map(q => '<option ' + (q === QUOTE ? 'selected ' : '') + 'value="' + q + '">' + q + '</option>').join('') + '</select>';
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      const parsed = JSON.parse(raw);
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...parsed };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) {}
  }

  /* ── Helpers ────────────────────────────────────────────────────── */
  /* Crypto feed plus tokenized stocks and USDC/USD1 rates. A paint looks
     this up hundreds of times, so the merge is built once per task. */
  let liveMerged = null, liveKey = '';
  const live = () => {
    // Rebuilt whenever either feed has been replaced, even mid-task.
    const src = window.liveCryptoPrices;
    const key = String(window.TokenMarkets?.stamp?.() || 0);
    if (!liveMerged || liveMerged.__src !== src || liveKey !== key) {
      liveMerged = { ...(src || {}), ...(window.TokenMarkets?.prices() || {}) };
      Object.defineProperty(liveMerged, '__src', { value: src });
      liveKey = key;
      setTimeout(() => { liveMerged = null; }, 0);
    }
    return liveMerged;
  };
  // The exchange ticker to print; the feed key stays as CoinGecko sends it.
  const tick = sym => (typeof tickerOf === 'function' ? tickerOf(sym) : sym);
  /* A remembered or placeholder price can be shown, never traded. */
  const isStale = sym => { const c = live()[sym]; return !!(c && c.stale); };
  const staleQuote = q => q !== 'USDT' && isStale(q);
  const stockLine = sym => (window.TokenMarkets?.isStock(sym) && TokenMarkets.tagline ? TokenMarkets.tagline(sym) : '');
  const priceOf = sym => { const c = live()[sym]; return c ? c.usd : 0; };
  const nameOf = sym => { const c = live()[sym]; return (c && c.name) || sym; };
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const ic = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');

  function usd(v) {
    if (v === null || v === undefined || isNaN(v)) return '$0.00';
    const a = Math.abs(v);
    if (a > 0 && a < 0.01) return (v < 0 ? '-$' : '$') + a.toFixed(6);
    return (v < 0 ? '-$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function qtyFmt(v) {
    if (!v) return '0';
    if (v < 0.0001) return v.toExponential(2);
    return v.toLocaleString('en-US', { maximumFractionDigits: 8 });
  }

  const pct = v => (v >= 0 ? '+' : '') + (v || 0).toFixed(2) + '%';

  /* Tradable universe = whatever the live feed returned, minus the quote. */
  function pairs() {
    return Object.keys(live()).filter(s => s !== QUOTE && s !== 'USDT' && Number.isFinite(live()[s]?.usd) && live()[s].usd > 0).sort();
  }

  const holding = sym => T.holdings[sym] || { qty: 0, avgCost: 0 };

  function positionValue() {
    return Object.keys(T.holdings).reduce((s, k) => s + holding(k).qty * priceOf(k), 0);
  }

  const equity = () => T.cash + positionValue();

  function unrealized() {
    return Object.keys(T.holdings).reduce((s, k) => {
      const h = holding(k);
      return s + (priceOf(k) - h.avgCost) * h.qty;
    }, 0);
  }

  /* ── Execution ──────────────────────────────────────────────────── */
  /* Applies a fill to the book: moves cash, updates average cost, and
     books realised P&L on the way out. */
  function settle(side, sym, qty, price, quote = QUOTE) {
    const rate = quoteRate(quote);
    const dollarPrice = price * rate;
    const gross = qty * price;
    const fee = gross * FEE;

    if (side === 'buy') {
      const h = holding(sym);
      const newQty = h.qty + qty;
      // Weighted average cost so P&L is measured against what you paid.
      T.holdings[sym] = {
        qty: newQty,
        avgCost: newQty > 0 ? ((h.avgCost * h.qty) + gross * rate) / newQty : 0
      };
      moveQuote(quote, -(gross + fee));
    } else {
      const h = holding(sym);
      T.realized += (dollarPrice - h.avgCost) * qty;
      const left = h.qty - qty;
      if (left <= 1e-12) delete T.holdings[sym];
      else T.holdings[sym] = { qty: left, avgCost: h.avgCost };
      moveQuote(quote, gross - fee);
    }

    T.feesPaid += fee * rate;
    T.fills.unshift({ id: Date.now() + Math.random(), side, sym, qty, price, fee, quote, t: Date.now() });
    if (T.fills.length > 200) T.fills.length = 200;
  }

  /* Validates then either fills now (market) or rests on the book (limit). */
  function placeOrder(side, sym, type, qty, limitPrice) {
    qty = parseFloat(qty);
    if (!['buy', 'sell'].includes(side) || !['market', 'limit'].includes(type)) return {ok:false,msg:'Invalid spot order.'};
    if (sym === QUOTE || !pairs().includes(sym)) return {ok:false,msg:'Select a valid spot pair.'};
    if (isStale(sym) || staleQuote(QUOTE)) {
      return { ok: false, msg: `${tick(isStale(sym) ? sym : QUOTE)} is showing its last known price — trading resumes when a live quote arrives.` };
    }
    const mkt = pairPrice(sym);

    if (!sym || !mkt) return { ok: false, msg: 'No live price for that pair.' };
    if (!qty || qty <= 0 || !isFinite(qty)) return { ok: false, msg: 'Enter a valid amount.' };

    const price = type === 'limit' ? parseFloat(limitPrice) : mkt;
    if (type === 'limit' && (!price || price <= 0 || !isFinite(price))) {
      return { ok: false, msg: 'Enter a valid limit price.' };
    }

    /* A market order takes the book, not the mid: walk the real ladder and
       pay the average of the levels it eats, slippage included. */
    let swept = null;
    if (QUOTE === 'USDT' && !window.TokenMarkets?.isStock(sym) && type === 'market' && typeof MD !== 'undefined' &&
        String(MD.status().pair).toUpperCase() === String(sym).toUpperCase()) {
      swept = MD.sweep(side, qty);
    }
    const execPrice = type === 'market' ? (swept && swept.avg ? swept.avg : mkt) : price;

    if (side === 'buy') {
      const cost = qty * execPrice * (1 + FEE);
      if (cost > quoteBalance(QUOTE)) return { ok: false, msg: `Insufficient ${QUOTE} — need ${quoteFmt(cost)}, have ${quoteFmt(quoteBalance(QUOTE))}.` };
    } else {
      if (qty > holding(sym).qty + 1e-12) {
        return { ok: false, msg: `Insufficient ${sym} — you hold ${qtyFmt(holding(sym).qty)}.` };
      }
    }

    /* A limit order that is already through the market fills at once —
       otherwise it would sit on the book at a better price than the market. */
    const marketable = type === 'market' ||
      (side === 'buy' && price >= mkt) ||
      (side === 'sell' && price <= mkt);

    if (marketable) {
      const fillAt = type === 'market' ? execPrice : price;
      settle(side, sym, qty, fillAt);
      save();
      const slip = swept && Math.abs(swept.slippage) >= 0.02
        ? ` · ${swept.slippage >= 0 ? '+' : ''}${swept.slippage.toFixed(2)}% slippage`
        : '';
      return { ok: true, filled: true,
        msg: `${side === 'buy' ? 'Bought' : 'Sold'} ${qtyFmt(qty)} ${sym} @ ${quoteFmt(fillAt)}${slip}` };
    }

    T.orders.unshift({ id: Date.now() + Math.random(), side, sym, qty, price, quote: QUOTE, t: Date.now() });
    save();
    return { ok: true, filled: false, msg: `Limit ${side} ${qtyFmt(qty)} ${sym} @ ${quoteFmt(price)} resting on the book` };
  }

  function cancelOrder(id) {
    const i = T.orders.findIndex(o => String(o.id) === String(id));
    if (i < 0) return;
    T.orders.splice(i, 1);
    save();
    toast('Order cancelled');
    repaint();
  }

  /* Called on every price refresh: fills any resting order the market
     has moved through. */
  function matchOpenOrders() {
    if (!T.orders.length) return;
    const stillOpen = [];
    let filledCount = 0;

    T.orders.forEach(o => {
      const quote = o.quote || 'USDT';
      const mkt = pairPrice(o.sym, quote);
      if (!mkt || isStale(o.sym) || staleQuote(quote)) { stillOpen.push(o); return; }
      const hit = (o.side === 'buy' && mkt <= o.price) || (o.side === 'sell' && mkt >= o.price);
      if (!hit) { stillOpen.push(o); return; }

      // Re-check funds — the balance may have moved since the order rested.
      if (o.side === 'buy' && o.qty * o.price * (1 + FEE) > quoteBalance(quote)) { stillOpen.push(o); return; }
      if (o.side === 'sell' && o.qty > holding(o.sym).qty + 1e-12) { stillOpen.push(o); return; }

      settle(o.side, o.sym, o.qty, o.price, quote);
      filledCount++;
    });

    if (filledCount) {
      T.orders = stillOpen;
      save();
      toast(`${filledCount} limit order${filledCount > 1 ? 's' : ''} filled ✅`);
      repaint();
    }
  }

  /* ── Asset ledger API ───────────────────────────────────────────── */
  /* Used by settlement paths outside the order book — P2P escrow, for
     one — so they move balances through save() rather than poking at
     the state object directly. */
  function availableOf(sym) {
    return sym === 'USDT' ? T.cash : holding(sym).qty;
  }

  function creditAsset(sym, qty, atPrice) {
    if (!Number.isFinite(qty) || qty <= 0) return false;
    if (sym === 'USDT') {
      T.cash += qty;
    } else {
      const h = holding(sym);
      const newQty = h.qty + qty;
      const price = atPrice || priceOf(sym);
      T.holdings[sym] = {
        qty: newQty,
        avgCost: newQty > 0 ? ((h.avgCost * h.qty) + (qty * price)) / newQty : 0
      };
    }
    save();
    return true;
  }

  function debitAsset(sym, qty) {
    if (!Number.isFinite(qty) || qty <= 0) return false;
    if (sym === 'USDT') {
      if (T.cash < qty) return false;
      T.cash -= qty;
    } else {
      const h = holding(sym);
      if (h.qty < qty - 1e-12) return false;
      const left = h.qty - qty;
      if (left <= 1e-12) delete T.holdings[sym];
      else T.holdings[sym] = { qty: left, avgCost: h.avgCost };
    }
    save();
    return true;
  }

  /* ── Deposit / withdraw against the social wallet ───────────────── */
  function walletBalances() {
    return (typeof DATA !== 'undefined' && DATA.wallet) ? DATA.wallet.balances : null;
  }

  /* Funding to Spot and back. Both sides go through MNY so the move is
     one ledger line and every other balance on screen repaints — the old
     pair wrote to the two stores directly and nothing else heard about
     it. The quote currency is what this box moves; the Assets page moves
     any asset. */
  function deposit(amount) {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast('Enter an amount to deposit.');
    if (typeof MNY === 'undefined') return toast('Accounts are still loading…');
    const r = MNY.transfer(QUOTE, amt, 'funding', 'spot');
    toast(r.ok ? `Deposited ${usd(amt)} into the trading account` : r.msg);
    if (r.ok) { save(); repaint(); }
  }

  function withdraw(amount) {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast('Enter an amount to withdraw.');
    if (typeof MNY === 'undefined') return toast('Accounts are still loading…');
    const r = MNY.transfer(QUOTE, amt, 'spot', 'funding');
    toast(r.ok ? `Withdrew ${usd(amt)} to your wallet` : r.msg);
    if (r.ok) { save(); repaint(); }
  }

  /* ── Depth ──────────────────────────────────────────────────────── */
  /* The real Binance ladder when the stream is on this pair — twenty
     levels, ten updates a second. The synthetic ladder below is only the
     fallback for coins Binance doesn't list, and says so in the UI. */
  function depth(sym) {
    if (QUOTE === 'USDT' && !window.TokenMarkets?.isStock(sym) && typeof MD !== 'undefined' && MD.book && MD.book.at &&
        String(MD.status().pair).toUpperCase() === String(sym).toUpperCase()) {
      const b = MD.book;
      if (b.bids.length && b.asks.length) {
        return {
          real: true,
          bids: b.bids.slice(0, 9).map(r => ({ price: r[0], size: r[1] })),
          asks: b.asks.slice(0, 9).map(r => ({ price: r[0], size: r[1] }))
        };
      }
    }
    const mid = pairPrice(sym);
    if (!mid) return { bids: [], asks: [] };
    const rows = 7;
    const step = mid * 0.0006;
    const bids = [], asks = [];
    for (let i = 1; i <= rows; i++) {
      const seed = (i * 9301 + sym.length * 49297) % 233280 / 233280;
      const size = (0.4 + seed * 2.2) * (mid > 1000 ? 0.6 : mid > 1 ? 40 : 20000);
      bids.push({ price: mid - step * i, size });
      asks.push({ price: mid + step * i, size: size * (0.7 + seed * 0.7) });
    }
    return { bids, asks };
  }

  /* ── Live surfaces ──────────────────────────────────────────────── */
  /* These three repaint on their own from the market feed. A full desk
     repaint would blow away whatever is typed in the amount box, so each
     one writes into its own node and nothing else moves. */
  let chartIv = '1m';
  const IVS = [['1m', '1m'], ['5m', '5m'], ['15m', '15m'], ['1h', '1h'], ['4h', '4h'], ['1d', '1D']];

  function bookHTML(sym) {
    const d = depth(sym);
    if (!d.bids.length) return '<div class="tr-empty">Waiting for the book…</div>';
    const maxSize = Math.max(...d.bids.concat(d.asks).map(r => r.size), 1e-9);
    const ladder = (rows, kind) => rows.map(r => `
      <div class="tr-depth-row ${kind}">
        <span class="tr-depth-bar" style="width:${Math.min(100, (r.size / maxSize) * 100)}%"></span>
        <span class="tr-depth-px">${quoteFmt(r.price)}</span>
        <span class="tr-depth-sz">${qtyFmt(r.size)}</span>
      </div>`).join('');

    const bid = d.bids[0] ? d.bids[0].price : 0;
    const ask = d.asks[0] ? d.asks[0].price : 0;
    const spread = bid && ask ? ask - bid : 0;
    const spreadPct = bid ? (spread / bid) * 100 : 0;

    return ladder(d.asks.slice().reverse(), 'ask') +
      `<div class="tr-mid">${pairLabel(sym)}
         ${d.real ? `<span class="tr-spread">spread ${quoteFmt(spread)} · ${spreadPct.toFixed(3)}%</span>` : ''}
       </div>` +
      ladder(d.bids, 'bid');
  }

  function tapeHTML() {
    if (QUOTE !== 'USDT' || window.TokenMarkets?.isStock(T.pair)) return '<div class="tr-empty">No exchange trade tape for this paper pair.</div>';
    const t = (typeof MD !== 'undefined') ? MD.tape : [];
    if (!t || !t.length) return '<div class="tr-empty">Waiting for trades…</div>';
    return t.slice(0, 14).map(x => `
      <div class="tr-tape-row ${x.buy ? 'up' : 'down'}">
        <span>${usd(x.p)}</span>
        <span>${qtyFmt(x.q)}</span>
        <span class="tc-3 fs10">${new Date(x.t).toLocaleTimeString([], { hour12: false })}</span>
      </div>`).join('');
  }

  /* Real candles, drawn as candles: wick from high to low, body from open
     to close, green when the close is above the open. */
  function candleHTML() {
    if (QUOTE !== 'USDT' || window.TokenMarkets?.isStock(T.pair)) return '<div class="tr-empty">Spot reference: ' + pairLabel(T.pair) + '<br>Historical candles unavailable for this pair.</div>';
    const rows = (typeof MD !== 'undefined') ? MD.candles : [];
    const c = live()[T.pair];
    if (!rows || rows.length < 3) {
      if (c && Array.isArray(c.spark) && c.spark.length > 2) return chart(c.spark, (c.usd_24h_change || 0) >= 0);
      return '<div class="tr-empty">Loading chart…</div>';
    }

    const w = 660, h = 210, padT = 10, padB = 20, padR = 54;
    const hi = Math.max(...rows.map(r => r.h));
    const lo = Math.min(...rows.map(r => r.l));
    const span = (hi - lo) || 1;
    const cw = (w - padR) / rows.length;
    const y = v => padT + (h - padT - padB) * (1 - (v - lo) / span);

    const bars = rows.map((r, i) => {
      const x = i * cw + cw / 2;
      const up = r.c >= r.o;
      const col = up ? 'var(--green)' : 'var(--red)';
      const bw = Math.max(1.4, cw * 0.62);
      const top = y(Math.max(r.o, r.c));
      const bot = y(Math.min(r.o, r.c));
      return `<line x1="${x.toFixed(1)}" y1="${y(r.h).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y(r.l).toFixed(1)}"
                stroke="${col}" stroke-width="1"/>
              <rect x="${(x - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}"
                height="${Math.max(1, bot - top).toFixed(1)}" fill="${col}"/>`;
    }).join('');

    const lastRow = rows[rows.length - 1];
    const lastY = y(lastRow.c);
    const up = lastRow.c >= lastRow.o;
    const grid = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const v = lo + span * f;
      const gy = y(v);
      return `<line x1="0" y1="${gy.toFixed(1)}" x2="${w - padR}" y2="${gy.toFixed(1)}" class="tr-grid"/>
              <text x="${w - padR + 6}" y="${(gy + 3.5).toFixed(1)}" class="tr-axis">${usd(v)}</text>`;
    }).join('');

    return `
      <div class="tr-chart-head">
        <div class="tr-ivs">${IVS.map(([v, l]) =>
          `<button class="tr-iv${chartIv === v ? ' active' : ''}" onclick="TR.setChartInterval('${v}')">${l}</button>`).join('')}</div>
        <div class="tr-chart-ohlc">
          <span>O <b>${usd(lastRow.o)}</b></span><span>H <b>${usd(lastRow.h)}</b></span>
          <span>L <b>${usd(lastRow.l)}</b></span><span>C <b class="${up ? 'up' : 'down'}">${usd(lastRow.c)}</b></span>
        </div>
      </div>
      <svg class="tr-candles" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img"
           aria-label="${esc(T.pair)} ${chartIv} candlestick chart">
        ${grid}
        ${bars}
        <line x1="0" y1="${lastY.toFixed(1)}" x2="${w - padR}" y2="${lastY.toFixed(1)}"
              class="tr-last ${up ? 'up' : 'down'}"/>
      </svg>`;
  }

  function paintBook() {
    const el = document.getElementById('tr-book-body');
    if (el) el.innerHTML = bookHTML(T.pair);
    const src = document.getElementById('tr-book-src');
    if (src) {
      const real = depth(T.pair).real;
      src.className = real ? 'tr-live' : 'tr-sim';
      src.textContent = real ? 'live · Binance' : 'simulated depth';
    }
  }
  function paintTape() {
    const el = document.getElementById('tr-tape');
    if (el) el.innerHTML = tapeHTML();
  }
  function paintChart() {
    const el = document.getElementById('tr-chart');
    if (el) el.innerHTML = candleHTML();
  }

  /* The header price ticks on its own too, so the number in front of you
     is the number the socket last sent. */
  function paintHeadPrice() {
    const c = live()[T.pair];
    if (!c) return;
    const px = document.getElementById('tr-head-px');
    if (px) px.textContent = pairLabel(T.pair);
    const ch = document.getElementById('tr-head-ch');
    if (ch) {
      const v = c.usd_24h_change || 0;
      ch.className = (v >= 0 ? 'up' : 'down') + ' fw8';
      ch.innerHTML = `${pct(v)} <span class="tc-3 fw6 fs11">24h</span>`;
    }
    const pill = document.getElementById('tr-feed');
    if (pill && typeof MD !== 'undefined') {
      const st = MD.status();
      pill.className = 'tr-feed' + (st.live ? ' on' : '');
      pill.innerHTML = isStale(T.pair) || staleQuote(QUOTE)
        ? '<i></i> Last known price · updating…'
        : (st.live && QUOTE === 'USDT' && !window.TokenMarkets?.isStock(T.pair))
          ? '<i></i> Live · Binance'
          : '<i></i> Paper spot · reference price';
    }
  }

  let wired = false;
  function wireFeed() {
    if (wired || typeof MD === 'undefined') return;
    wired = true;
    MD.on('book', () => paintBook());
    MD.on('trade', () => paintTape());
    MD.on('kline', () => paintChart());
    MD.on('tick', () => paintHeadPrice());
    MD.on('status', () => paintHeadPrice());
  }

  /* ── Rendering ──────────────────────────────────────────────────── */
  let side = 'buy';
  let orderType = 'market';
  let search = '';
  let watchOnly = false;

  /* Only symbols in the live feed are tradable. Refusing here stops a bad
     pair from being persisted and breaking the desk on the next load. */
  function setPair(sym) {
    const s = String(sym || '').toUpperCase();
    if (!pairs().includes(s)) {
      toast(`${s} isn't in the live market feed — not tradable here.`);
      return false;
    }
    T.pair = s;
    save();
    if (typeof MD !== 'undefined') MD.watchPair(s);
    repaint();
    return true;
  }

  /* Chart interval — re-seeds history and re-subscribes the kline stream. */
  function setInterval_(iv) {
    chartIv = iv;
    if (typeof MD !== 'undefined') MD.watchPair(T.pair, iv);
    paintChart();
  }

  const isTradable = sym => pairs().includes(String(sym || '').toUpperCase());
  function setSide(s) { side = s; repaint(); }
  function setType(t) { orderType = t; repaint(); }
  function setSearch(v) { search = (v || '').toUpperCase(); paintPairList(); }

  function paintPairList() {
    const host = document.getElementById('tr-pairs');
    if (!host) return;
    let list = pairs().filter(s => assetFilter === 'all' || (assetFilter === 'stocks' ? window.TokenMarkets?.isStock(s) : !window.TokenMarkets?.isStock(s))).filter(s => !search || s.includes(search) || tick(s).includes(search) || nameOf(s).toUpperCase().includes(search) || !!window.TokenMarkets?.matches?.(s, search));
    if (watchOnly && typeof CT !== 'undefined') list = list.filter(s => CT.isWatched(s));

    const star = s => (typeof CT !== 'undefined' ? CT.starBtn(s) : '');
    const watchBar = watchOnly
      ? `<div class="tr-watchbar"><span>★ Watchlist only · ${list.length} of ${pairs().length} pairs</span><button type="button" onclick="TR.toggleWatchOnly()">Show all</button></div>`
      : '';
    host.innerHTML = watchBar + (list.map(s => {
      const c = live()[s];
      const ch = c.usd_24h_change || 0;
      const sub = stockLine(s);
      const old = isStale(s);
      return `<div class="tr-pair${s === T.pair ? ' active' : ''}${sub ? ' has-sub' : ''}" onclick="TR.setPair('${esc(s)}')">
        ${ic(s, 22)}
        <span class="tr-pair-sym">${esc(tick(s))}<small>/${QUOTE}</small></span>
        <span class="tr-pair-px${old ? ' tr-stale' : ''}"${old ? ' title="Last known price — waiting for a live quote"' : ''}>${pairLabel(s)}</span>
        ${sub ? `<span class="tr-pair-sub" title="${esc(nameOf(s))}">${esc(sub)}</span>` : ''}
        <span class="tr-pair-ch ${ch >= 0 ? 'up' : 'down'}">${pct(ch)}</span>
        ${star(s)}
      </div>`;
    }).join('') || (assetFilter === 'stocks' ? '<div class="tr-empty">Tokenized-stock prices unavailable. Retry in Cryptoverse.</div>' : '') || `<div class="tr-empty">${watchOnly ? 'Nothing starred yet.' : 'No pair matches that search.'}</div>`);
  }

  function toggleWatchOnly() { watchOnly = !watchOnly; paintDesk(); }

  /* "Tracks AAPL · Apple Inc. · Nasdaq" under a tokenized stock's pair. */
  function headStock(sym) {
    const i = window.TokenMarkets?.isStock(sym) && TokenMarkets.info ? TokenMarkets.info(sym) : null;
    if (!i) return '';
    const u = i.underlying;
    const bits = u
      ? `<span class="tr-und">Tracks <b>${esc(u.ticker)}</b></span><span>${esc(u.company)} · ${esc(u.exchange)}</span>`
      : `<span>${esc(i.unlisted || 'Underlying listing not verified')}</span>`;
    return `<div class="tr-stock-line">${bits}${i.issuer ? `<span class="tr-issuer">${esc(i.issuer)}</span>` : ''}</div>`;
  }

  function repaint() {
    const root = document.getElementById('tr-root');
    if (root) paintDesk();
    const pf = document.getElementById('pf-root');
    if (pf) paintPortfolio();
  }

  /* What a price tick actually needs to touch. Rebuilding the desk on every
     tick threw away the live book and tape a moment after they painted, and
     stole focus from the amount box mid-typing. */
  function onPriceTick() {
    if (document.getElementById('tr-root')) {
      paintHeadPrice();
      paintPairList();
      paintBook();
      paintTape();
      previewCost();
    }
    const pf = document.getElementById('pf-root');
    if (pf) paintPortfolio();
  }

  function paintDesk() {
    const root = document.getElementById('tr-root');
    if (!root) return;
    /* A pair with no live price used to dead-end here forever, because the
       bad symbol is persisted. That happens whenever something hands the
       desk a coin outside the 150-coin feed (a long-tail trending coin,
       say). Fall back to a tradable pair instead of stranding the user. */
    if (!live()[T.pair]) {
      const fallback = pairs()[0];
      if (!fallback) {
        root.innerHTML = '<div class="tr-empty">Waiting for live market data…</div>';
        return;
      }
      const stranded = T.pair;
      T.pair = live()['BTC'] ? 'BTC' : fallback;
      save();
      if (stranded) toast(`${stranded} isn't in the live market feed — showing ${T.pair}.`);
    }

    const sym = T.pair;
    const c = live()[sym];
    if (!c) { root.innerHTML = '<div class="tr-empty">Waiting for live market data…</div>'; return; }

    const h = holding(sym);
    const d = depth(sym);
    const feed = (typeof MD !== 'undefined') ? MD.status() : { live: false };
    wireFeed();
    if (typeof MD !== 'undefined' && String(MD.status().pair).toUpperCase() !== String(sym).toUpperCase()) {
      MD.watchPair(sym, chartIv);
    }

    const openRows = T.orders.length ? T.orders.map(o => `
      <div class="tr-row">
        <span class="${o.side === 'buy' ? 'up' : 'down'}">${o.side.toUpperCase()}</span>
        <span>${esc(tick(o.sym))}/${esc(o.quote || 'USDT')}</span>
        <span>${qtyFmt(o.qty)}</span>
        <span>${pxFmt(o.price)} ${esc(o.quote || 'USDT')}</span>
        <button class="tr-x" onclick="TR.cancelOrder('${o.id}')">✕</button>
      </div>`).join('') : '<div class="tr-empty">No open orders.</div>';

    const fillRows = T.fills.length ? T.fills.slice(0, 12).map(f => `
      <div class="tr-row">
        <span class="${f.side === 'buy' ? 'up' : 'down'}">${f.side.toUpperCase()}</span>
        <span>${esc(tick(f.sym))}/${esc(f.quote || 'USDT')}</span>
        <span>${qtyFmt(f.qty)}</span>
        <span>${pxFmt(f.price)} ${esc(f.quote || 'USDT')}</span>
        <span class="tc-3 fs10">${new Date(f.t).toLocaleTimeString()}</span>
      </div>`).join('') : '<div class="tr-empty">No trades yet.</div>';

    root.innerHTML = `
      <div class="tr-layout">

        <aside class="tr-side card">
          ${quoteSelector()}
          <label class="form-label">Asset type</label>
          <select aria-label="Asset type" class="input mb8" onchange="TR.setAssetFilter(this.value)">
            ${[['all','All assets'],['crypto','Crypto'],['stocks','Tokenized stocks']].map(([v,n]) => '<option value="'+v+'" '+(assetFilter===v?'selected':'')+'>'+n+'</option>').join('')}
          </select>
          <p class="fs11 tc-3">Spot · No leverage. USDC/USD1 use converted reference prices. To fund these pairs, buy USDC or USD1 with your paper USDT first.</p>
          <input class="input tr-search" placeholder="Search ${pairs().length} pairs…" oninput="TR.setSearch(this.value)" value="${esc(search)}">
          <button class="tr-watch-filter${watchOnly ? ' active' : ''}" onclick="TR.toggleWatchOnly()">
            ${watchOnly ? '★ Watchlist only' : '☆ Show watchlist only'}
          </button>
          <div id="tr-pairs" class="tr-pairs"></div>
        </aside>

        <main class="tr-main">
          <div class="card tr-head">
            <div class="tr-head-id">
              ${ic(sym, 40)}
              <div>
                <div class="tr-head-pair">${esc(tick(sym))}/${QUOTE}</div>
                <div class="fs11 tc-3">${esc(nameOf(sym))}${window.TokenMarkets?.isStock(sym) ? " · Tokenized stock" : " · Crypto"}</div>
                ${headStock(sym)}
              </div>
            </div>
            <div class="tr-head-px">
              <div class="tr-px" id="tr-head-px">${pairLabel(sym)}</div>
              <div class="${(c.usd_24h_change || 0) >= 0 ? 'up' : 'down'} fw8" id="tr-head-ch">${pct(c.usd_24h_change)} <span class="tc-3 fw6 fs11">24h</span></div>
              <div class="tr-feed${feed.live ? ' on' : ''}" id="tr-feed"><i></i> ${isStale(sym) || staleQuote(QUOTE) ? 'Last known price · updating…' : feed.live && QUOTE === 'USDT' && !window.TokenMarkets?.isStock(sym) ? 'Live · Binance' : 'Paper spot · reference price'}</div>
            </div>
          </div>

          <div class="tr-tools">
            ${typeof CT !== 'undefined' ? CT.starBtn(sym) : ''}
            <button class="tr-tool" onclick="CT.open('convert')"><span class="material-symbols-rounded ms-16">swap_horiz</span> Convert</button>
            <button class="tr-tool" onclick="CT.open('alerts')"><span class="material-symbols-rounded ms-16">notifications_active</span> Alerts <span class="tr-tool-badge" id="ct-alert-count">${typeof CT !== 'undefined' ? CT.activeAlertCount() : 0}</span></button>
            <button class="tr-tool" onclick="CT.open('watch')"><span class="material-symbols-rounded ms-16">star</span> Watchlist</button>
            <button class="tr-tool" onclick="CT.open('dca')"><span class="material-symbols-rounded ms-16">event_repeat</span> Recurring</button>
          </div>

          <div class="card tr-chart" id="tr-chart">${candleHTML()}</div>

          <div class="tr-cols">
            <div class="card tr-form">
              <div class="tr-tabs">
                <button class="tr-tab${side === 'buy' ? ' buy' : ''}" onclick="TR.setSide('buy')">Buy</button>
                <button class="tr-tab${side === 'sell' ? ' sell' : ''}" onclick="TR.setSide('sell')">Sell</button>
              </div>
              <div class="tr-types">
                <button class="tr-type${orderType === 'market' ? ' active' : ''}" onclick="TR.setType('market')">Market</button>
                <button class="tr-type${orderType === 'limit' ? ' active' : ''}" onclick="TR.setType('limit')">Limit</button>
              </div>

              ${orderType === 'limit' ? `
                <label class="form-label">Limit price (${QUOTE})</label>
                <input class="input mb8" id="tr-price" type="number" step="any" value="${pairPrice(sym)}">` : ''}

              <label class="form-label">Amount (${esc(sym)})</label>
              <input class="input" id="tr-qty" type="number" step="any" placeholder="0.00" oninput="TR.previewCost()">

              <div class="tr-quick">
                ${[25, 50, 75, 100].map(p => `<button class="tr-q" onclick="TR.quick(${p})">${p}%</button>`).join('')}
              </div>

              <div class="tr-preview" id="tr-preview">
                <div class="tr-kv"><span>Order value</span><b>$0.00</b></div>
                <div class="tr-kv"><span>Fee (0.1%)</span><b>$0.00</b></div>
              </div>

              <button class="btn w100 ${side === 'buy' ? 'tr-submit-buy' : 'tr-submit-sell'}" onclick="TR.submit()" ${pairPrice(sym) > 0 ? '' : 'disabled'}>
                ${side === 'buy' ? 'Buy' : 'Sell'} ${esc(sym)}
              </button>

              <div class="tr-bal">
                <span>Available</span>
                <b>${side === 'buy' ? quoteFmt(quoteBalance(QUOTE)) : qtyFmt(h.qty) + ' ' + esc(sym)}</b>
              </div>
            </div>

            <div class="card tr-book">
              <div class="tr-sec-t">Order book <span id="tr-book-src" class="${d.real ? 'tr-live' : 'tr-sim'}">${d.real ? 'live · Binance' : 'simulated depth'}</span></div>
              <div id="tr-book-body">${bookHTML(sym)}</div>
              <div class="tr-sec-t mt12">Market trades</div>
              <div id="tr-tape" class="tr-tape">${tapeHTML()}</div>
            </div>
          </div>

          <div class="tr-cols">
            <div class="card">
              <div class="tr-sec-t">Open orders · ${T.orders.length}</div>
              ${openRows}
            </div>
            <div class="card">
              <div class="tr-sec-t">Trade history</div>
              ${fillRows}
            </div>
          </div>
        </main>
      </div>`;

    paintPairList();
    previewCost();
  }

  function chart(points, up) {
    const w = 640, hh = 130, pad = 6;
    const min = Math.min(...points), max = Math.max(...points);
    const span = (max - min) || 1;
    const step = (w - pad * 2) / (points.length - 1);
    const pts = points.map((p, i) =>
      `${(pad + i * step).toFixed(1)},${(pad + (hh - pad * 2) * (1 - (p - min) / span)).toFixed(1)}`);
    const stroke = up ? 'var(--green)' : 'var(--red)';
    return `
      <div class="tr-sec-t">7-day chart</div>
      <svg class="tr-svg" viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" role="img" aria-label="7 day price chart">
        <polyline fill="${up ? 'rgba(76,175,80,.12)' : 'rgba(229,57,53,.12)'}" stroke="none"
          points="${pad},${hh - pad} ${pts.join(' ')} ${w - pad},${hh - pad}"/>
        <polyline fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" points="${pts.join(' ')}"/>
      </svg>
      <div class="tr-spark-lbl"><span>${usd(min)}</span><span>${usd(max)}</span></div>`;
  }

  function readQty() { const el = document.getElementById('tr-qty'); return el ? parseFloat(el.value) || 0 : 0; }
  function readPrice() {
    const el = document.getElementById('tr-price');
    return orderType === 'limit' && el ? parseFloat(el.value) || 0 : pairPrice(T.pair);
  }

  function previewCost() {
    const box = document.getElementById('tr-preview');
    if (!box) return;
    const gross = readQty() * readPrice();
    box.innerHTML = `
      <div class="tr-kv"><span>Order value</span><b>${quoteFmt(gross)}</b></div>
      <div class="tr-kv"><span>Fee (0.1%)</span><b>${quoteFmt(gross * FEE)}</b></div>`;
  }

  /* Percentage buttons: of cash when buying, of the position when selling. */
  function quick(p) {
    const el = document.getElementById('tr-qty');
    if (!el) return;
    const price = readPrice() || pairPrice(T.pair);
    if (!price) return;
    const v = side === 'buy'
      ? (quoteBalance(QUOTE) * (p / 100)) / (price * (1 + FEE))
      : holding(T.pair).qty * (p / 100);
    el.value = v > 0 ? v.toFixed(8).replace(/0+$/, '').replace(/\.$/, '') : '';
    previewCost();
  }

  function submit() {
    const r = placeOrder(side, T.pair, orderType, readQty(), readPrice());
    toast(r.msg);
    if (r.ok) repaint();
  }

  /* ── Portfolio ──────────────────────────────────────────────────── */
  function paintPortfolio() {
    const root = document.getElementById('pf-root');
    if (!root) return;
    // The Assets page owns this pane: Overview, Earn, Spot, Futures, Funding.
    if (typeof AS !== 'undefined' && AS.paint) { AS.paint(); return; }

    const keys = Object.keys(T.holdings).filter(k => holding(k).qty > 0);
    const posVal = positionValue();
    const eq = equity();
    const un = unrealized();

    /* Cash is part of equity, so it belongs in the list and the allocation
       like any other asset — it just has no cost basis to show P&L against.
       Shares are measured against equity, not positions, or a portfolio
       that is mostly cash would render as 100% invested. */
    const cashRow = T.cash > 0
      ? [{ sym: 'USDT', qty: T.cash, val: T.cash, isCash: true }]
      : [];
    const posRows = keys.map(k => {
      const h = holding(k);
      const px = priceOf(k);
      return { sym: k, qty: h.qty, val: h.qty * px, avgCost: h.avgCost, px, isCash: false };
    });
    const allRows = cashRow.concat(posRows.sort((a, b) => b.val - a.val));

    const rows = allRows.length ? allRows.map(r => {
      const share = eq > 0 ? (r.val / eq) * 100 : 0;
      if (r.isCash) {
        return `
        <div class="pf-row pf-row-cash">
          <div class="pf-id">${ic('USDT', 30)}<div><div class="pf-sym">${esc('USDT')}</div><div class="fs11 tc-3">${qtyFmt(r.qty)}</div></div></div>
          <div class="pf-num"><div>${usd(r.val)}</div><div class="fs11 tc-3">${share.toFixed(1)}%</div></div>
          <div class="pf-num"><div class="fs11 tc-3">available cash</div><div class="tc-3 fw8">—</div></div>
        </div>`;
      }
      const pnl = (r.px - r.avgCost) * r.qty;
      const pnlPct = r.avgCost > 0 ? ((r.px - r.avgCost) / r.avgCost) * 100 : 0;
      return `
        <div class="pf-row" onclick="TR.setPair('${r.sym}'); navigateTo('trade')">
          <div class="pf-id">${ic(r.sym, 30)}<div><div class="pf-sym">${esc(r.sym)}</div><div class="fs11 tc-3">${qtyFmt(r.qty)}</div></div></div>
          <div class="pf-num"><div>${usd(r.val)}</div><div class="fs11 tc-3">${share.toFixed(1)}%</div></div>
          <div class="pf-num"><div class="fs11 tc-3">avg ${usd(r.avgCost)}</div><div class="${pnl >= 0 ? 'up' : 'down'} fw8">${usd(pnl)} · ${pct(pnlPct)}</div></div>
        </div>`;
    }).join('') : '<div class="tr-empty">Nothing here yet. Deposit USDT or head to the Trade desk.</div>';

    const alloc = allRows
      .map(r => ({ k: r.sym, share: eq > 0 ? (r.val / eq) * 100 : 0 }))
      .sort((a, b) => b.share - a.share).slice(0, 8);

    root.innerHTML = `
      <div class="card pf-hero">
        <div class="fs12 tc-3">Total equity</div>
        <div class="pf-eq">${usd(eq)}</div>
        <div class="pf-hero-grid">
          <div><div class="fs11 tc-3 pf-cash-lbl">${ic('USDT', 15)} Cash (${'USDT'})</div><div class="fw8 tc-1">${usd(T.cash)}</div></div>
          <div><div class="fs11 tc-3">Positions</div><div class="fw8 tc-1">${usd(posVal)}</div></div>
          <div><div class="fs11 tc-3">Unrealised</div><div class="fw8 ${un >= 0 ? 'up' : 'down'}">${usd(un)}</div></div>
          <div><div class="fs11 tc-3">Realised</div><div class="fw8 ${T.realized >= 0 ? 'up' : 'down'}">${usd(T.realized)}</div></div>
        </div>
        <div class="pf-note">Paper account · fees paid ${usd(T.feesPaid)}</div>
      </div>

      ${alloc.length ? `<div class="card">
        <div class="tr-sec-t">Allocation</div>
        <div class="pf-alloc">${alloc.map(a => `<span class="pf-alloc-seg" style="width:${a.share}%; background:hsl(${(a.k.charCodeAt(0) * 37) % 360} 60% 50%)" title="${esc(a.k)} ${a.share.toFixed(1)}%"></span>`).join('')}</div>
        <div class="pf-legend">${alloc.map(a => `<span><i style="background:hsl(${(a.k.charCodeAt(0) * 37) % 360} 60% 50%)"></i>${esc(a.k)} ${a.share.toFixed(1)}%</span>`).join('')}</div>
      </div>` : ''}

      <div class="card">
        <div class="tr-sec-t">Holdings · ${allRows.length}</div>
        ${rows}
      </div>

      ${multiChainHTML()}

      <div class="card">
        <div class="tr-sec-t">Transfer</div>
        ${quoteSelector()}<div class="fs12 tc-3 mb8">Move ${QUOTE} between your Web3 wallet and this trading account.</div>
        <input class="input mb8" id="pf-amt" type="number" step="any" placeholder="Amount in ${QUOTE}">
        <div style="display:flex; gap:8px">
          <button class="btn btn-primary" style="flex:1" onclick="TR.deposit(document.getElementById('pf-amt').value)">Deposit</button>
          <button class="btn btn-ghost" style="flex:1" onclick="TR.withdraw(document.getElementById('pf-amt').value)">Withdraw</button>
        </div>
      </div>`;
  }

  /* ── Across networks ────────────────────────────────────────────── */
  /* One profile, many wallets: this rolls every connected chain into a
     single view alongside the trading account and any issued assets. */
  function multiChainHTML() {
    if (typeof WL === 'undefined') return '';

    if (!WL.isConnected()) {
      return `<div class="card">
        <div class="tr-sec-t">Across networks</div>
        <div class="mc-empty">
          <p>Connect wallets on Ethereum, Solana, Base, BNB Chain and more to see everything you hold in one place.</p>
          <button class="btn btn-primary btn-sm" onclick="WL.openChooser('connect')">Connect a wallet</button>
        </div>
      </div>`;
    }

    const nets = WL.byNetwork();

    // Assets issued in the Asset Lab are grouped by the chain they target.
    const issued = {};
    if (typeof AL !== 'undefined') {
      AL.list().forEach(a => {
        if (a.balance <= 0) return;
        (issued[a.chain] = issued[a.chain] || []).push(a);
      });
    }

    const cards = nets.map(n => {
      const mine = issued[n.net] || [];
      return `
      <div class="mc-net" style="--c:${n.color}">
        <div class="mc-net-hd">
          <span class="mc-dot"></span>
          <span class="mc-net-name">${esc(n.label)}</span>
          <span class="mc-net-count">${n.accounts.length} wallet${n.accounts.length > 1 ? 's' : ''}</span>
        </div>
        ${n.accounts.map(a => `
          <div class="mc-acct">
            <span class="mc-addr">${esc(WL.shortAddr(a.address))}</span>
            <span class="mc-bal">${a.native
              ? `${a.native.amount} ${esc(a.native.symbol)}${a.native.simulated ? '<i class="mc-sim">sim</i>' : ''}`
              : '<span class="tc-3">—</span>'}</span>
          </div>`).join('')}
        ${mine.length ? `<div class="mc-issued">${mine.map(a =>
          `<span class="mc-token" title="${esc(a.name)}">${esc(a.emoji)} ${esc(a.symbol)} · ${a.balance.toLocaleString('en-US',{maximumFractionDigits:2})}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('');

    return `<div class="card">
      <div class="tr-sec-t">Across networks
        <span class="mc-count">${nets.length} chain${nets.length > 1 ? 's' : ''}</span>
        <button class="mc-refresh" onclick="WL.refreshAll()" title="Refresh balances">
          <span class="material-symbols-rounded ms-16">refresh</span>
        </button>
      </div>
      <div class="mc-grid">${cards}</div>
      <div class="mc-note">Native balances on EVM chains are read live from your wallet's own RPC. The trading account above is separate paper balance.</div>
    </div>`;
  }

  return {
    placeOrder, cancelOrder, matchOpenOrders, deposit, withdraw, multiChainHTML,
    setChartInterval: setInterval_, paintBook, paintTape, paintChart, onPriceTick,
    setQuote, setAssetFilter, quoteBalance, pairPrice, setPair, setSide, setType, setSearch, quick, submit, previewCost, toggleWatchOnly,
    paintDesk, paintPortfolio, repaint, pairs, equity, unrealized, holding,
    availableOf, creditAsset, debitAsset, priceOf, usd, qtyFmt, isTradable,
    get QUOTE() { return QUOTE; },
    get state() { return T; },
    get FEE() { return FEE; }
  };
})();

window.TR = TR;

/* ── Pane templates & router hooks ─────────────────────────────────── */
function getTradeTemplate() {
  return `<section id="pane-trade" class="pane">
    <h1 class="pane-title" style="display:flex; align-items:center; gap:10px">
      <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:#7C4DFF">candlestick_chart</span>
      <span>Spot</span> Trading
    </h1>
    <div class="tr-banner">
      <span class="material-symbols-rounded ms-16">info</span>
      Paper trading account — orders price against live market data but never leave this browser. No exchange connection, no custody.
    </div>
    <div id="tr-root"></div>
  </section>`;
}

function renderTrade() { TR.paintDesk(); }

function getPortfolioTemplate() {
  return `<section id="pane-portfolio" class="pane">
    <h1 class="pane-title" style="display:flex; align-items:center; gap:10px">
      <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:#00BFA5">account_balance_wallet</span>
      <span>Assets</span>
    </h1>
    <div id="pf-root"></div>
  </section>`;
}

function renderPortfolio() { TR.paintPortfolio(); }
