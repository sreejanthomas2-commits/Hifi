/* ╔══════════════════════════════════════════════════════════════════╗
   ║  MARKET DATA — a live feed instead of a 30-second poll           ║
   ║                                                                  ║
   ║  Prices used to arrive from CoinGecko every 30 seconds, which is ║
   ║  fine for a market-cap table and useless for a trading screen.   ║
   ║  This opens Binance's public WebSocket instead:                  ║
   ║                                                                  ║
   ║   · miniTicker  — every tracked coin, about once a second        ║
   ║   · depth20     — the real order book, ten times a second        ║
   ║   · aggTrade    — the actual trades printing on the tape         ║
   ║   · kline       — real candles, live on the current one          ║
   ║                                                                  ║
   ║  It is public market data: no key, no account, nothing signed.   ║
   ║  CoinGecko still supplies names, logos, market caps and the      ║
   ║  coins Binance doesn't list, and it takes over completely if     ║
   ║  the socket can't connect — the app degrades to delayed prices   ║
   ║  rather than breaking, and says which one it's on.               ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const MD = (() => {

  const WS = 'wss://stream.binance.com:9443/stream?streams=';
  const REST = 'https://api.binance.com/api/v3';
  const QUOTE = 'USDT';
  const MAX_TAPE = 40;
  const TICK_MS = 900;            // how often the UI is told prices moved
  const MAX_STREAMS = 180;

  let sock = null;                // the ticker socket
  let pairSock = null;            // the desk socket (book + tape + candles)
  let tries = 0;
  let connected = false;
  let lastMsgAt = 0;
  let tradable = {};              // SYM -> 'BTCUSDT'
  let watching = '';              // symbol the desk is showing
  let tickTimer = null;
  let dirty = false;

  const book = { bids: [], asks: [], at: 0 };
  let tape = [];
  let candles = [];               // [{ t, o, h, l, c, v }] oldest → newest
  let interval = '1m';

  const listeners = { tick: [], book: [], trade: [], kline: [], status: [] };
  const emit = (k, v) => listeners[k].forEach(fn => { try { fn(v); } catch (e) {} });
  const on = (k, fn) => { if (listeners[k]) listeners[k].push(fn); };

  const live = () => window.liveCryptoPrices || (window.liveCryptoPrices = {});
  const pairOf = sym => tradable[String(sym || '').toUpperCase()] || '';

  /* ── Which symbols Binance actually lists ────────────────────────── */
  async function discover() {
    const res = await fetch(REST + '/ticker/price');
    if (!res.ok) throw new Error('ticker/price ' + res.status);
    const rows = await res.json();
    const map = {};
    rows.forEach(r => {
      const s = r.symbol;
      if (!s.endsWith(QUOTE)) return;
      const base = s.slice(0, -QUOTE.length);
      // Leveraged tokens and the odd stable-on-stable pair aren't spot coins.
      if (/(UP|DOWN|BULL|BEAR)$/.test(base) || base === 'USDC' || base === 'BUSD' || base === 'FDUSD') return;
      map[base] = s;
    });
    tradable = map;
    return map;
  }

  /* The app cares about the coins it lists: whatever CoinGecko gave us,
     plus a floor of majors so the desk works before that lands. */
  function wanted() {
    const base = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK', 'TRX', 'DOT', 'MATIC', 'LTC', 'SHIB', 'TON'];
    const fromCG = Object.keys(live());
    const seen = {}, out = [];
    base.concat(fromCG).forEach(s => {
      const sym = String(s).toUpperCase();
      if (seen[sym] || !tradable[sym]) return;
      seen[sym] = 1;
      out.push(sym);
    });
    return out.slice(0, MAX_STREAMS);
  }

  /* ── Ticker socket ───────────────────────────────────────────────── */
  let subscribed = [];

  function connect() {
    const syms = wanted();
    if (!syms.length) return;
    subscribed = syms;
    const streams = syms.map(s => tradable[s].toLowerCase() + '@miniTicker').join('/');

    try { sock = new WebSocket(WS + streams); }
    catch (e) { retry(); return; }

    sock.onopen = () => {
      connected = true;
      tries = 0;
      emit('status', status());
      console.log('📡 Live market data: Binance stream open,', syms.length, 'symbols.');
    };

    sock.onmessage = ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      const d = msg && msg.data;
      if (!d || !d.s) return;

      const sym = d.s.slice(0, -QUOTE.length);
      const price = parseFloat(d.c);
      const open = parseFloat(d.o);
      if (!isFinite(price) || price <= 0) return;

      const row = live()[sym] || (live()[sym] = {});
      row.usd = price;
      if (isFinite(open) && open > 0) {
        const chg = ((price - open) / open) * 100;
        row.usd_24h_change = chg;
        row.change24h = chg;
      }
      row.high24h = parseFloat(d.h) || row.high24h;
      row.low24h = parseFloat(d.l) || row.low24h;
      row.vol24h = parseFloat(d.q) || row.vol24h;
      row.live = true;
      row.stale = false;
      row.src = 'binance';
      row.at = Date.now();
      if (sym === 'BTC') window.liveBtcPrice = price;

      lastMsgAt = Date.now();
      dirty = true;
    };

    sock.onclose = () => { connected = false; emit('status', status()); retry(); };
    sock.onerror = () => { try { sock.close(); } catch (e) {} };
  }

  /* The socket subscribes to whatever the list holds when it opens. If the
     list grows later (CoinGecko answered late, or the Binance backup filled
     it), reopen once with the full set. */
  function resubscribe() {
    if (!Object.keys(tradable).length) return;      // start() hasn't discovered pairs yet
    const want = wanted();
    const have = new Set(subscribed);
    if (want.length === subscribed.length && want.every(s => have.has(s))) return;
    if (sock) {
      sock.onclose = null; sock.onerror = null; sock.onmessage = null;
      try { sock.close(); } catch (e) {}
    }
    connected = false;
    tries = 0;
    connect();
    startTicker();
  }

  function retry() {
    tries++;
    if (tries > 8) {
      console.warn('📡 Live stream unavailable — staying on CoinGecko polling.');
      emit('status', status());
      return;
    }
    setTimeout(() => { if (!connected) connect(); }, Math.min(30000, 1000 * Math.pow(2, tries)));
  }

  /* One repaint per second at most, however fast the ticks arrive. */
  function startTicker() {
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      if (!dirty) return;
      dirty = false;
      emit('tick', null);
      if (typeof window.onMarketTick === 'function') window.onMarketTick();
    }, TICK_MS);
  }

  /* ── The desk's pair: book, tape, candles ────────────────────────── */
  async function watchPair(sym, iv) {
    const s = String(sym || '').toUpperCase();
    const pair = pairOf(s);
    if (iv) interval = iv;
    if (!pair) { unwatchPair(); watching = ''; emit('book', null); return false; }
    if (watching === s && pairSock && pairSock.readyState <= 1 && !iv) return true;

    unwatchPair();
    watching = s;
    book.bids = []; book.asks = []; book.at = 0;
    tape = [];
    candles = [];

    // Seed the chart with history, then let the socket keep it current.
    try {
      const res = await fetch(`${REST}/klines?symbol=${pair}&interval=${interval}&limit=150`);
      if (res.ok) {
        const rows = await res.json();
        candles = rows.map(r => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));
        emit('kline', candles);
      }
    } catch (e) { /* chart falls back to the sparkline */ }

    const p = pair.toLowerCase();
    const streams = [`${p}@depth20@100ms`, `${p}@aggTrade`, `${p}@kline_${interval}`].join('/');
    try { pairSock = new WebSocket(WS + streams); }
    catch (e) { return false; }

    pairSock.onmessage = ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      const st = msg.stream || '', d = msg.data;
      if (!d) return;

      if (st.includes('@depth')) {
        book.bids = (d.bids || []).map(r => [+r[0], +r[1]]);
        book.asks = (d.asks || []).map(r => [+r[0], +r[1]]);
        book.at = Date.now();
        emit('book', book);
        return;
      }
      if (st.includes('@aggTrade')) {
        tape.unshift({ p: +d.p, q: +d.q, t: d.T, buy: !d.m });
        if (tape.length > MAX_TAPE) tape.length = MAX_TAPE;
        emit('trade', tape);
        return;
      }
      if (st.includes('@kline')) {
        const k = d.k;
        const bar = { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v };
        const last = candles[candles.length - 1];
        if (last && last.t === bar.t) candles[candles.length - 1] = bar;
        else candles.push(bar);
        if (candles.length > 300) candles.shift();
        emit('kline', candles);
      }
    };
    return true;
  }

  function unwatchPair() {
    if (pairSock) { try { pairSock.onmessage = null; pairSock.close(); } catch (e) {} pairSock = null; }
  }

  /* ── What a market order would actually pay ──────────────────────── */
  /* Walks the real ladder level by level, so a size bigger than the top
     of book costs what it would really cost. Returns null when there is
     no live book to walk. */
  function sweep(side, qty) {
    const levels = side === 'buy' ? book.asks : book.bids;
    if (!levels.length || !(qty > 0)) return null;
    let left = qty, cost = 0, filled = 0;
    for (const [px, size] of levels) {
      const take = Math.min(left, size);
      cost += take * px;
      filled += take;
      left -= take;
      if (left <= 1e-12) break;
    }
    if (filled <= 0) return null;
    const avg = cost / filled;
    const top = levels[0][0];
    return {
      avg, top, filled, short: left > 1e-12,
      slippage: top ? ((avg - top) / top) * 100 * (side === 'buy' ? 1 : -1) : 0
    };
  }

  const bestBid = () => (book.bids[0] ? book.bids[0][0] : 0);
  const bestAsk = () => (book.asks[0] ? book.asks[0][0] : 0);
  const spread = () => (bestBid() && bestAsk() ? bestAsk() - bestBid() : 0);

  function status() {
    return {
      live: connected,
      stale: connected && lastMsgAt ? Date.now() - lastMsgAt > 15000 : false,
      source: connected ? 'Binance' : 'CoinGecko',
      symbols: Object.keys(tradable).length,
      pair: watching,
      book: book.at > 0
    };
  }

  async function start() {
    try { await discover(); }
    catch (e) {
      console.warn('📡 Binance market data unreachable — CoinGecko polling continues.', e.message);
      emit('status', status());
      return;
    }
    connect();
    startTicker();
  }

  // CoinGecko lands first with names and logos; give it a moment so the
  // stream covers the coins the app is actually listing.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 1200));
  else setTimeout(start, 1200);

  return {
    start, on, status, watchPair, unwatchPair, sweep, resubscribe,
    bestBid, bestAsk, spread,
    isLive: () => connected,
    has: sym => !!pairOf(sym),
    pairOf,
    get book() { return book; },
    get tape() { return tape; },
    get candles() { return candles; },
    get interval() { return interval; },
    get tradable() { return tradable; }
  };
})();

window.MD = MD;
