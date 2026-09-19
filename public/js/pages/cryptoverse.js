/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CRYPTOVERSE                                                     ║
   ║                                                                  ║
   ║  Discovery surface, replacing the old 50-category Explore grid.   ║
   ║  Everything here is live CoinGecko data on keyless public         ║
   ║  endpoints, plus live crypto news:                                ║
   ║                                                                  ║
   ║   • Global market   — /global      (cap, volume, BTC dominance)   ║
   ║   • Trending now    — /search/trending  (what people search)      ║
   ║   • Movers          — derived from the 150 coins already polled   ║
   ║   • Sectors         — /coins/categories (DeFi, AI, RWA, gaming…)  ║
   ║   • News            — fetchLiveNews()                             ║
   ║                                                                  ║
   ║  Trending Creators is owned by the Explore template and is not    ║
   ║  touched from here.                                               ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CV = (() => {

  const GLOBAL_URL   = 'https://api.coingecko.com/api/v3/global';
  const TRENDING_URL = 'https://api.coingecko.com/api/v3/search/trending';
  const SECTORS_URL  = 'https://api.coingecko.com/api/v3/coins/categories';
  const REFRESH_MS   = 5 * 60 * 1000;   // these move slowly; don't hammer

  const cache = { global: null, trending: null, sectors: null, news: null };
  let lastFetch = 0;

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const ic = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');

  function big(v) {
    if (!v && v !== 0) return '—';
    if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
    if (v >= 1e9)  return '$' + (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6)  return '$' + (v / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(v).toLocaleString('en-US');
  }

  function price(v) {
    if (!v && v !== 0) return '—';
    if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (v >= 1) return '$' + v.toFixed(2);
    if (v >= 0.01) return '$' + v.toFixed(4);
    return '$' + v.toFixed(8).replace(/0+$/, '');
  }

  const pct = v => (v >= 0 ? '+' : '') + (v || 0).toFixed(2) + '%';
  const cls = v => (v >= 0 ? 'up' : 'down');

  /* ── Data ───────────────────────────────────────────────────────── */
  async function loadAll(force) {
    if (!force && cache.global && Date.now() - lastFetch < REFRESH_MS) { paint(); return; }
    lastFetch = Date.now();

    // Each section fails independently — one dead endpoint shouldn't blank
    // the whole page.
    const jobs = [
      fetch(GLOBAL_URL).then(r => r.json()).then(j => { cache.global = j.data; }).catch(() => {}),
      fetch(TRENDING_URL).then(r => r.json()).then(j => { cache.trending = j.coins || []; }).catch(() => {}),
      fetch(SECTORS_URL).then(r => r.json()).then(j => { cache.sectors = Array.isArray(j) ? j : []; }).catch(() => {})
    ];
    if (typeof window.fetchCryptoNews === 'function') {
      jobs.push(window.fetchCryptoNews(6)
        .then(a => { cache.news = a || []; })
        .catch(() => { cache.news = []; }));
    } else if (typeof window.fetchLiveNews === 'function') {
      jobs.push(window.fetchLiveNews('cryptocurrency DeFi blockchain')
        .then(a => { cache.news = (a || []).filter(x => !x.isSample).slice(0, 6); })
        .catch(() => { cache.news = []; }));
    }
    await Promise.all(jobs);
    paint();
  }

  /* Gainers and losers come from the prices we already poll every 30s,
     so this costs no extra request. */
  function movers() {
    const live = window.liveCryptoPrices || {};
    const rows = Object.keys(live)
      .filter(s => live[s] && typeof live[s].usd_24h_change === 'number' && live[s].usd > 0)
      .map(s => ({ sym: s, chg: live[s].usd_24h_change, usd: live[s].usd }));
    const sorted = rows.slice().sort((a, b) => b.chg - a.chg);
    return { gainers: sorted.slice(0, 5), losers: sorted.slice(-5).reverse() };
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  function paint() {
    const root = document.getElementById('cv-root');
    if (!root) return;
    root.innerHTML = globalHTML() + (window.TokenMarkets?.html() || '') + trendingHTML() + moversHTML() + sectorsHTML() + newsHTML();
  }

  function globalHTML() {
    const g = cache.global;
    if (!g) return skeleton('Global market', 4);
    const chg = g.market_cap_change_percentage_24h_usd || 0;
    const tiles = [
      ['Total market cap', big(g.total_market_cap && g.total_market_cap.usd), pct(chg), cls(chg)],
      ['24h volume', big(g.total_volume && g.total_volume.usd), '', ''],
      ['BTC dominance', (g.market_cap_percentage && g.market_cap_percentage.btc || 0).toFixed(1) + '%', '', ''],
      ['Active coins', (g.active_cryptocurrencies || 0).toLocaleString('en-US'), '', '']
    ];
    return `
      <div class="cv-sec">
        <div class="section-hdr">
          <span class="section-title flex-center gap8">
            <span class="material-symbols-rounded" style="color:var(--green)">public</span> Global Market
          </span>
          <span class="badge badge-green">Live</span>
        </div>
        <div class="cv-stats">
          ${tiles.map(([l, v, d, c]) => `
            <div class="cv-stat">
              <div class="cv-stat-l">${esc(l)}</div>
              <div class="cv-stat-v">${esc(v)}</div>
              ${d ? `<div class="cv-stat-d ${c}">${esc(d)} 24h</div>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  }

  function trendingHTML() {
    const t = cache.trending;
    if (!t) return skeleton('Trending now', 3);
    if (!t.length) return '';
    return `
      <div class="cv-sec">
        <div class="section-hdr">
          <span class="section-title flex-center gap8">
            <span class="material-symbols-rounded" style="color:var(--orange)">local_fire_department</span> Trending Now
          </span>
          <span class="badge badge-orange">Most searched</span>
        </div>
        <p class="tc-3 fs12 mb12">What people are actually looking up on CoinGecko right now.</p>
        <div class="cv-trend">
          ${t.slice(0, 8).map((c, i) => {
            const it = c.item || {};
            const d = it.data || {};
            const ch = d.price_change_percentage_24h && d.price_change_percentage_24h.usd;
            return `
            <div class="cv-trend-card" onclick="CV.openCoin('${esc(it.symbol || '')}')">
              <span class="cv-rank">#${i + 1}</span>
              <img class="cv-thumb" src="${esc(it.thumb || '')}" alt="" loading="lazy" onerror="this.remove()">
              <div class="cv-trend-main">
                <div class="cv-trend-sym">${esc((it.symbol || '').toUpperCase())}</div>
                <div class="cv-trend-name">${esc(it.name || '')}</div>
              </div>
              ${typeof ch === 'number' ? `<span class="cv-trend-chg ${cls(ch)}">${pct(ch)}</span>` : ''}
              ${it.market_cap_rank ? `<span class="cv-mcr">Rank ${it.market_cap_rank}</span>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function moversHTML() {
    const { gainers, losers } = movers();
    if (!gainers.length) return '';
    const col = (title, rows, icon, color) => `
      <div class="cv-mover-col">
        <div class="cv-mover-hd"><span class="material-symbols-rounded ms-16" style="color:${color}">${icon}</span> ${title}</div>
        ${rows.map(r => `
          <div class="cv-mover" onclick="CV.openCoin('${esc(r.sym)}')">
            ${ic(r.sym, 24)}
            <span class="cv-mover-sym">${esc(typeof tickerOf === 'function' ? tickerOf(r.sym) : r.sym)}</span>
            <span class="cv-mover-px">${price(r.usd)}</span>
            <span class="cv-mover-chg ${cls(r.chg)}">${pct(r.chg)}</span>
          </div>`).join('')}
      </div>`;
    return `
      <div class="cv-sec">
        <div class="section-hdr">
          <span class="section-title flex-center gap8">
            <span class="material-symbols-rounded" style="color:var(--blue)">swap_vert</span> Top Movers
          </span>
          <span class="badge badge-blue">24h</span>
        </div>
        <div class="cv-movers">
          ${col('Gainers', gainers, 'trending_up', 'var(--green)')}
          ${col('Losers', losers, 'trending_down', 'var(--red)')}
        </div>
      </div>`;
  }

  function sectorsHTML() {
    const s = cache.sectors;
    if (!s) return skeleton('Sectors', 3);
    const top = s.filter(c => typeof c.market_cap_change_24h === 'number' && c.market_cap > 0)
      .sort((a, b) => b.market_cap_change_24h - a.market_cap_change_24h);
    if (!top.length) return '';
    const pick = top.slice(0, 6).concat(top.slice(-3).reverse());
    return `
      <div class="cv-sec">
        <div class="section-hdr">
          <span class="section-title flex-center gap8">
            <span class="material-symbols-rounded" style="color:var(--purple)">category</span> Sectors
          </span>
          <span class="badge badge-purple">${s.length} tracked</span>
        </div>
        <p class="tc-3 fs12 mb12">Where capital is rotating — narratives ranked by 24h change.</p>
        <div class="cv-sectors">
          ${pick.map(c => `
            <div class="cv-sector">
              <div class="cv-sector-n">${esc(c.name)}</div>
              <div class="cv-sector-m">${big(c.market_cap)}</div>
              <div class="cv-sector-c ${cls(c.market_cap_change_24h)}">${pct(c.market_cap_change_24h)}</div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* "3h ago" rather than a date — headlines are judged by freshness. */
  function timeAgo(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    if (!isFinite(ms) || ms < 0) return 'just now';
    const m = Math.round(ms / 60000);
    if (m < 60) return m <= 1 ? 'just now' : m + 'm ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.round(h / 24) + 'd ago';
  }

  function newsHTML() {
    const n = cache.news;
    if (!n) return skeleton('Crypto news', 3);
    if (!n.length) {
      return `<div class="cv-sec"><div class="section-hdr">
        <span class="section-title flex-center gap8"><span class="material-symbols-rounded" style="color:var(--blue)">newspaper</span> Crypto News</span></div>
        <div class="cc-empty">Couldn't reach the news feeds just now.
        <button class="btn btn-ghost btn-sm" onclick="CV.refresh()">Retry</button></div></div>`;
    }
    return `
      <div class="cv-sec">
        <div class="section-hdr">
          <span class="section-title flex-center gap8">
            <span class="material-symbols-rounded" style="color:var(--blue)">newspaper</span> Crypto News
          </span>
          <span class="badge badge-blue">Live</span>
        </div>
        <div class="cc-news">
          ${n.map(a => `
            <a class="cc-article" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">
              <div class="cc-art-main">
                <div class="cc-art-title">${esc(a.title)}</div>
                ${a.excerpt ? `<div class="cc-art-ex">${esc(String(a.excerpt).slice(0, 150))}</div>` : ''}
                <div class="cc-art-meta"><span class="cc-src">${esc(a.source || 'News')}</span>${
                  a.publishedAt ? `<span class="cc-art-time">${esc(timeAgo(a.publishedAt))}</span>` : ''}</div>
              </div>
              <span class="material-symbols-rounded cc-art-go">open_in_new</span>
            </a>`).join('')}
        </div>
      </div>`;
  }

  function skeleton(label, n) {
    return `<div class="cv-sec">
      <div class="section-hdr"><span class="section-title">${esc(label)}</span></div>
      <div class="cv-stats">${Array.from({ length: n }).map(() =>
        `<div class="cv-stat"><div class="cc-skel-line w60"></div><div class="cc-skel-line w90"></div></div>`).join('')}</div>
    </div>`;
  }

  /* Trending Now surfaces long-tail coins that aren't in the 150-coin feed,
     so they have no price and can't be charted or traded. Say so instead of
     pushing an untradable pair into the desk. */
  function openCoin(sym) {
    const s = String(sym || '').toUpperCase();
    const tradable = !!(window.liveCryptoPrices || {})[s];

    if (tradable && typeof W3 !== 'undefined') { W3.openToken(s); return; }

    if (typeof showToast === 'function') {
      showToast(`${s} is trending but isn't in the top-150 market feed — no live price yet.`);
    }
  }

  function refresh() { loadAll(true); }

  function render() {
    paint();
    loadAll(false);
  }

  return { render, refresh, paint, openCoin, loadAll, get cache() { return cache; } };
})();

window.CV = CV;

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
publish('pages/cryptoverse.js', {
  CV: () => CV
});
