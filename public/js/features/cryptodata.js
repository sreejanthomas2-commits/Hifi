/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CRYPTO MARKET DATA (CMKT) — the services the market UI reads      ║
   ║                                                                   ║
   ║  One place that knows where market data comes from, so the        ║
   ║  Crypto Market screens never talk to a provider directly and a    ║
   ║  provider can be swapped without touching the interface.          ║
   ║                                                                   ║
   ║    markets()     live prices already polled app-wide              ║
   ║    global()      total cap, 24h volume, BTC dominance             ║
   ║    categories()  sectors and narratives                           ║
   ║    chart()       historical series for a coin                     ║
   ║    news()        real headlines from publishers' own feeds        ║
   ║    pulse()       market condition, derived here and explained     ║
   ║    sentiment()   breadth, pressure and momentum, derived here     ║
   ║    trending()    what is getting unusual attention, with reasons  ║
   ║    tracker()     highs, lows and breakouts worth knowing about    ║
   ║    search()      coins, pairs, sectors and narratives             ║
   ║    watchlist/alerts  delegate to the tools that already own them  ║
   ║                                                                   ║
   ║  Nothing here invents a price. A row carries where it came from   ║
   ║  and how old it is; status() says whether the feed is live,       ║
   ║  showing remembered prices, or unavailable, and the UI says so.   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CMKT = (() => {

  /* ── Providers ───────────────────────────────────────────────────── */
  /* Each entry is an adapter. Replacing CoinGecko means writing one of
     these and calling CMKT.use('name') — no screen changes. */
  const PROVIDERS = {
    coingecko: {
      label: 'CoinGecko',
      global: () => get('https://api.coingecko.com/api/v3/global').then(j => normGlobal(j && j.data)),
      categories: () => get('https://api.coingecko.com/api/v3/coins/categories').then(normCategories),
      search: () => get('https://api.coingecko.com/api/v3/search/trending').then(j => (j && j.coins) || []),
      chart: (id, days) => get(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${encodeURIComponent(days)}`)
        .then(j => (j && Array.isArray(j.prices)) ? j.prices.map(p => ({ t: p[0], v: p[1] })) : [])
    }
  };
  let provider = 'coingecko';
  const use = name => { if (PROVIDERS[name]) provider = name; };
  const P = () => PROVIDERS[provider];

  async function get(url) {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  /* ── A small cache so a rate-limited minute still shows something ── */
  const mem = {};
  function cached(key, ttl, fn) {
    const hit = mem[key];
    if (hit && Date.now() - hit.at < ttl && hit.value != null) return Promise.resolve(hit.value);
    if (hit && hit.inflight) return hit.inflight;
    const p = fn()
      .then(v => { mem[key] = { at: Date.now(), value: v }; save(key, v); return v; })
      .catch(err => {
        const stored = restore(key);
        if (stored != null) { mem[key] = { at: Date.now() - ttl / 2, value: stored, stale: true }; return stored; }
        if (hit && hit.value != null) return hit.value;
        throw err;
      });
    mem[key] = { ...(hit || {}), inflight: p };
    return p;
  }
  const SKEY = k => 'ts_cmd_' + k;
  function save(k, v) { try { localStorage.setItem(SKEY(k), JSON.stringify({ at: Date.now(), v })); } catch (e) {} }
  function restore(k) {
    try {
      const c = JSON.parse(localStorage.getItem(SKEY(k)) || 'null');
      return c && Date.now() - c.at < 864e5 ? c.v : null;
    } catch (e) { return null; }
  }

  /* ── Prices ──────────────────────────────────────────────────────── */
  const STABLE = new Set(['USDT', 'USDC', 'USD1', 'DAI', 'FDUSD', 'USDE', 'USDS', 'PYUSD', 'TUSD', 'BUSD', 'USDD', 'FRAX', 'GHO', 'RLUSD', 'USDP', 'USD0', 'BSC-USD', 'SUSDE', 'SUSDS', 'USDTB', 'USDX', 'EURC']);
  const isStable = s => STABLE.has(String(s || '').toUpperCase());
  const isStock = s => !!(window.TokenMarkets && TokenMarkets.isStock(s));

  /* Every coin the app has a price for, in one shape. */
  function markets(opts) {
    const o = opts || {};
    const feed = window.liveCryptoPrices || {};
    const rows = [];
    Object.keys(feed).forEach(sym => {
      const c = feed[sym];
      if (!c || !(c.usd > 0)) return;
      if (o.stocks !== true && isStock(sym)) return;
      if (o.stable === false && isStable(sym)) return;
      rows.push({
        sym,
        id: c.id || '',
        name: c.name || sym,
        image: c.image || '',
        price: c.usd,
        ch1h: num(c.ch1h),
        ch24h: num(c.change24h != null ? c.change24h : c.usd_24h_change),
        ch7d: num(c.ch7d),
        ch30d: num(c.ch30d),
        // CoinGecko fills these; when only the Binance stream is up, its
        // own 24h figures stand in rather than leaving the row blank.
        vol: num(c.vol != null ? c.vol : c.vol24h),
        mcap: num(c.mcap),
        rank: c.rank || null,
        high24: num(c.high24 != null ? c.high24 : c.high24h),
        low24: num(c.low24 != null ? c.low24 : c.low24h),
        ath: num(c.ath), athPct: num(c.athPct),
        atl: num(c.atl), atlPct: num(c.atlPct),
        supply: num(c.supply), totalSupply: num(c.totalSupply), maxSupply: num(c.maxSupply),
        spark: Array.isArray(c.spark) ? c.spark : null,
        stale: !!c.stale,
        src: c.src || 'seed',
        at: c.at || 0,
        stable: isStable(sym)
      });
    });
    return rows.sort((a, b) => (b.mcap || 0) - (a.mcap || 0));
  }
  const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
  const coin = sym => markets({ stocks: true }).find(r => r.sym === String(sym || '').toUpperCase()) || null;

  /* Is what we're showing live, remembered, or missing? */
  function status() {
    const rows = markets();
    if (!rows.length) return { state: 'unavailable', label: 'Market data temporarily unavailable' };
    const stale = rows.filter(r => r.stale).length;
    if (stale === rows.length) return { state: 'stale', label: 'Last known prices · reconnecting', count: rows.length };
    const live = rows.filter(r => r.src === 'binance' && !r.stale).length;
    return { state: 'live', label: live ? `Live · ${live} streaming` : 'Live prices', count: rows.length, streaming: live };
  }

  /* ── Slow-moving market data ─────────────────────────────────────── */
  const global = () => cached('global', 3e5, () => P().global());
  const categories = () => cached('cats', 6e5, () => P().categories());
  const trendingSearch = () => cached('trendsearch', 6e5, () => P().search());
  const chart = (id, days) => cached('chart_' + id + '_' + days, 3e5, () => P().chart(id, days));
  const news = limit => (typeof window.fetchCryptoNews === 'function'
    ? window.fetchCryptoNews(limit || 10).catch(() => [])
    : Promise.resolve([]));

  function normGlobal(d) {
    if (!d) return null;
    return {
      mcap: (d.total_market_cap && d.total_market_cap.usd) || null,
      vol: (d.total_volume && d.total_volume.usd) || null,
      mcapChange: num(d.market_cap_change_percentage_24h_usd),
      btcDom: (d.market_cap_percentage && d.market_cap_percentage.btc) || null,
      ethDom: (d.market_cap_percentage && d.market_cap_percentage.eth) || null,
      usdtDom: (d.market_cap_percentage && d.market_cap_percentage.usdt) || null,
      coins: d.active_cryptocurrencies || null,
      at: Date.now()
    };
  }
  function normCategories(list) {
    if (!Array.isArray(list)) return [];
    return list.map(c => ({
      id: c.id,
      name: c.name,
      mcap: num(c.market_cap),
      ch24h: num(c.market_cap_change_24h),
      vol: num(c.volume_24h),
      top: (c.top_3_coins || []).slice(0, 3)
    })).filter(c => c.name && c.mcap);
  }

  /* ── Market pulse ────────────────────────────────────────────────── */
  /* A plain, stated recipe — not advice. Four equally weighted parts,
     each scored 0–100: how many coins are up, how strong the average
     move is, whether the total cap rose, and where Fear & Greed sits. */
  const BANDS = [
    { max: 20, key: 'cold', label: 'COLD', color: '#3B82F6' },
    { max: 40, key: 'cool', label: 'COOL', color: '#0EA5E9' },
    { max: 60, key: 'neutral', label: 'NEUTRAL', color: '#94A3B8' },
    { max: 80, key: 'warm', label: 'WARM', color: '#2EBD85' },
    { max: 101, key: 'hot', label: 'HOT', color: '#F0A23B' }
  ];
  function pulse() {
    const rows = markets({ stable: false }).filter(r => r.ch24h != null);
    const g = mem.global && mem.global.value;
    if (!rows.length) return null;
    const up = rows.filter(r => r.ch24h > 0).length;
    const breadth = (up / rows.length) * 100;
    const avg = rows.reduce((t, r) => t + r.ch24h, 0) / rows.length;
    const strength = clamp(50 + avg * 6, 0, 100);
    const capMove = g && g.mcapChange != null ? clamp(50 + g.mcapChange * 8, 0, 100) : 50;
    const fg = (typeof FGI !== 'undefined' && FGI.current) ? +FGI.current.value : null;
    const parts = [
      { k: 'Coins up', v: breadth, note: `${up} of ${rows.length} up over 24h` },
      { k: 'Move size', v: strength, note: `average ${avg >= 0 ? '+' : ''}${avg.toFixed(2)}% over 24h` },
      { k: 'Total cap', v: capMove, note: g && g.mcapChange != null ? `${g.mcapChange >= 0 ? '+' : ''}${g.mcapChange.toFixed(2)}% over 24h` : 'total cap unavailable' }
    ];
    if (fg != null) parts.push({ k: 'Fear & Greed', v: fg, note: `${FGI.current.label} (${fg})` });
    const score = parts.reduce((t, p) => t + p.v, 0) / parts.length;
    const band = BANDS.find(b => score < b.max) || BANDS[2];
    // Volume that traded in rising coins versus falling ones — the closest
    // honest reading of pressure from this data. Not exchange flows.
    const volUp = rows.filter(r => r.ch24h > 0).reduce((t, r) => t + (r.vol || 0), 0);
    const volDown = rows.filter(r => r.ch24h <= 0).reduce((t, r) => t + (r.vol || 0), 0);
    return { score, band, parts, breadth, avg, volUp, volDown, rows: rows.length, up, down: rows.length - up };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ── Sentiment ───────────────────────────────────────────────────── */
  /* Counted from the same 150 coins: how many rose, how volume split
     between rising and falling coins, and whether the average move is
     improving over the week. */
  function sentiment() {
    const rows = markets({ stable: false }).filter(r => r.ch24h != null);
    if (!rows.length) return null;
    const bull = rows.filter(r => r.ch24h > 1).length;
    const bear = rows.filter(r => r.ch24h < -1).length;
    const flat = rows.length - bull - bear;
    const volUp = rows.filter(r => r.ch24h > 0).reduce((t, r) => t + (r.vol || 0), 0);
    const volDown = rows.filter(r => r.ch24h <= 0).reduce((t, r) => t + (r.vol || 0), 0);
    const volAll = volUp + volDown;
    const with7d = rows.filter(r => r.ch7d != null);
    const avg24 = rows.reduce((t, r) => t + r.ch24h, 0) / rows.length;
    const avg7 = with7d.length ? with7d.reduce((t, r) => t + r.ch7d, 0) / with7d.length : null;
    return {
      total: rows.length,
      bull: (bull / rows.length) * 100,
      bear: (bear / rows.length) * 100,
      flat: (flat / rows.length) * 100,
      buying: volAll ? (volUp / volAll) * 100 : 50,
      selling: volAll ? (volDown / volAll) * 100 : 50,
      momentum: clamp(50 + avg24 * 6, 0, 100),
      volMomentum: avg7 != null ? clamp(50 + (avg24 - avg7 / 7) * 6, 0, 100) : 50,
      avg24, avg7
    };
  }

  /* ── Trending, with the reason attached ──────────────────────────── */
  function trending(limit) {
    const rows = markets({ stable: false });
    const searched = (mem.trendsearch && mem.trendsearch.value) || [];
    const searchRank = {};
    searched.forEach((c, i) => { const s = (c.item && c.item.symbol || '').toUpperCase(); if (s) searchRank[s] = i + 1; });
    const watched = (typeof CT !== 'undefined' && CT.state) ? (CT.state.watchlist || []) : [];
    const scored = rows.map(r => {
      const reasons = [];
      let score = 0;
      if (searchRank[r.sym]) { score += 40 - searchRank[r.sym] * 2; reasons.push('Searches rising'); }
      if (r.ch24h != null && Math.abs(r.ch24h) >= 8) { score += Math.min(30, Math.abs(r.ch24h)); reasons.push(`${r.ch24h >= 0 ? 'Up' : 'Down'} ${Math.abs(r.ch24h).toFixed(1)}% in 24h`); }
      if (r.vol && r.mcap && r.vol / r.mcap > 0.25) { score += 20; reasons.push('Volume high vs market cap'); }
      const near = nearHigh(r);
      if (near) { score += 15; reasons.push(near); }
      if (watched.includes(r.sym)) { score += 5; reasons.push('On your watchlist'); }
      return { ...r, score, reasons };
    }).filter(r => r.score > 10);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit || 8);
  }
  /* 7-day series gives real highs and lows; ATH/ATL come from the feed. */
  function nearHigh(r) {
    if (!r.spark || r.spark.length < 10) return '';
    const hi = Math.max(...r.spark), lo = Math.min(...r.spark);
    if (r.price >= hi) return 'New 7D high';
    if (r.price <= lo) return 'New 7D low';
    if (r.athPct != null && r.athPct > -3) return 'Near all-time high';
    return '';
  }

  /* ── Smart tracker events ────────────────────────────────────────── */
  function tracker(limit) {
    const out = [];
    markets({ stable: false }).forEach(r => {
      if (!r.spark || r.spark.length < 20) return;
      const hi = Math.max(...r.spark), lo = Math.min(...r.spark);
      const half = r.spark.slice(Math.floor(r.spark.length / 2));
      const hi3 = Math.max(...half), lo3 = Math.min(...half);
      if (r.price >= hi) out.push({ ...r, event: '7D HIGH', kind: 'up', why: 'Highest price in the last 7 days' });
      else if (r.price <= lo) out.push({ ...r, event: '7D LOW', kind: 'down', why: 'Lowest price in the last 7 days' });
      else if (r.price >= hi3) out.push({ ...r, event: '3D HIGH', kind: 'up', why: 'Highest price in about three days' });
      else if (r.price <= lo3) out.push({ ...r, event: '3D LOW', kind: 'down', why: 'Lowest price in about three days' });
      else if (r.athPct != null && r.athPct > -2) out.push({ ...r, event: 'NEAR ATH', kind: 'up', why: `Within ${Math.abs(r.athPct).toFixed(1)}% of its all-time high` });
      else if (r.vol && r.mcap && r.vol / r.mcap > 0.5) out.push({ ...r, event: 'UNUSUAL VOLUME', kind: 'up', why: '24h volume above half the market cap' });
      else if (r.ch24h != null && Math.abs(r.ch24h) > 15) out.push({ ...r, event: 'BIG MOVE', kind: r.ch24h > 0 ? 'up' : 'down', why: `${r.ch24h >= 0 ? 'Up' : 'Down'} ${Math.abs(r.ch24h).toFixed(1)}% in 24h` });
    });
    const order = { '7D HIGH': 0, '7D LOW': 0, 'NEAR ATH': 1, 'UNUSUAL VOLUME': 2, 'BIG MOVE': 3, '3D HIGH': 4, '3D LOW': 4 };
    out.sort((a, b) => (order[a.event] - order[b.event]) || (b.mcap || 0) - (a.mcap || 0));
    return out.slice(0, limit || 12);
  }

  /* ── Movers ──────────────────────────────────────────────────────── */
  const FIELD = { '1h': 'ch1h', '24h': 'ch24h', '7d': 'ch7d', '30d': 'ch30d' };
  function movers(kind, period, limit) {
    const f = FIELD[period] || 'ch24h';
    let rows = markets({ stable: false }).filter(r => r[f] != null);
    const n = limit || 6;
    if (kind === 'gainers') return rows.sort((a, b) => b[f] - a[f]).slice(0, n);
    if (kind === 'losers') return rows.sort((a, b) => a[f] - b[f]).slice(0, n);
    if (kind === 'volume') return rows.filter(r => r.vol).sort((a, b) => (b.vol / (b.mcap || b.vol)) - (a.vol / (a.mcap || a.vol))).slice(0, n);
    if (kind === 'mcap') return rows.filter(r => r.mcap).sort((a, b) => Math.abs(b.ch24h || 0) * (b.mcap || 0) - Math.abs(a.ch24h || 0) * (a.mcap || 0)).slice(0, n);
    if (kind === 'volatile') return rows.filter(r => r.spark && r.spark.length > 8)
      .map(r => ({ ...r, vola: volatility(r.spark) })).sort((a, b) => b.vola - a.vola).slice(0, n);
    return rows.slice(0, n);
  }
  function volatility(spark) {
    const rets = [];
    for (let i = 1; i < spark.length; i++) if (spark[i - 1] > 0) rets.push((spark[i] - spark[i - 1]) / spark[i - 1]);
    if (!rets.length) return 0;
    const m = rets.reduce((a, b) => a + b, 0) / rets.length;
    return Math.sqrt(rets.reduce((t, r) => t + (r - m) ** 2, 0) / rets.length) * 100;
  }

  /* ── Search ──────────────────────────────────────────────────────── */
  function search(q) {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return { coins: [], sectors: [], pairs: [] };
    const bare = s.replace(/[\/\s-]?(usdt|usdc|usd1|usd)$/i, '').trim();
    const rows = markets({ stocks: true });
    const coins = rows.filter(r =>
      r.sym.toLowerCase().includes(bare) || r.name.toLowerCase().includes(bare) ||
      (typeof tickerOf === 'function' && String(tickerOf(r.sym)).toLowerCase().includes(bare))
    ).sort((a, b) => {
      const ax = a.sym.toLowerCase() === bare ? 0 : 1, bx = b.sym.toLowerCase() === bare ? 0 : 1;
      return ax - bx || (b.mcap || 0) - (a.mcap || 0);
    }).slice(0, 12);
    const cats = (mem.cats && mem.cats.value) || [];
    const sectors = cats.filter(c => c.name.toLowerCase().includes(s)).slice(0, 6);
    const pairs = /usdt|usdc|usd1|\//.test(s) && coins.length ? coins.slice(0, 4).map(c => ({ sym: c.sym, quote: 'USDT' })) : [];
    return { coins, sectors, pairs };
  }

  /* ── Watchlist and alerts live in the crypto tools already ───────── */
  const watchlist = () => (typeof CT !== 'undefined' && CT.state ? (CT.state.watchlist || []).slice() : []);
  const isWatched = sym => (typeof CT !== 'undefined' && CT.isWatched ? CT.isWatched(sym) : false);
  const toggleWatch = sym => { if (typeof CT !== 'undefined' && CT.toggleWatch) CT.toggleWatch(sym); };
  const alerts = () => (typeof CT !== 'undefined' && CT.state ? (CT.state.alerts || []).slice() : []);
  const openAlerts = () => { if (typeof CT !== 'undefined' && CT.open) CT.open('alerts'); };

  /* Warm the slow endpoints; each failure is independent. */
  function prime() {
    global().catch(() => {});
    categories().catch(() => {});
    trendingSearch().catch(() => {});
  }

  return {
    use, PROVIDERS, get provider() { return provider; },
    markets, coin, status, isStable, isStock,
    global, categories, trendingSearch, chart, news,
    pulse, sentiment, trending, tracker, movers, volatility, search,
    watchlist, isWatched, toggleWatch, alerts, openAlerts,
    prime, BANDS,
    get cache() { return mem; }
  };
})();

window.CMKT = CMKT;

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
publish('features/cryptodata.js', {
  CMKT: () => CMKT
});
