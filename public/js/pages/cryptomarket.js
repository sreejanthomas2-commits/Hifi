/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CRYPTO MARKET — discovery, intelligence and tracking            ║
   ║                                                                   ║
   ║  One section for everything the market is doing. It replaces the  ║
   ║  old Cryptoverse page and the Crypto Markets portal: both now     ║
   ║  open here.                                                       ║
   ║                                                                   ║
   ║  The page is a list of widgets the reader can reorder, hide or    ║
   ║  add back ("Edit Crypto Market"), under a category bar that       ║
   ║  chooses which set shows. Every number comes from CMKT, the data   ║
   ║  service — this file never calls a market provider itself.        ║
   ║                                                                   ║
   ║  Live prices patch themselves into the rows in place, so a price  ║
   ║  move never rebuilds the page under the reader's thumb.           ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CMP = (() => {

  const KEY = 'ts_cryptomarket_v1';
  const SEEN = 'ts_cm_seen_v1';        // coins this device has seen, for "New"
  const DEF = {
    cat: 'foryou',
    order: ['brief', 'pulse', 'sentiment', 'overview', 'trending', 'gainers', 'tracker', 'movers', 'heatmap', 'sectors', 'narratives', 'spot', 'screener', 'leaderboard', 'watchlist', 'news'],
    hidden: [],
    spotTab: 'popular',
    glPeriod: '24h',
    heatPeriod: '24h',
    moverTab: 'price',
    leadTab: 'mcap',
    newsTab: 'all',
    screeners: [],
    filters: { minCap: '', maxCap: '', minVol: '', chMin: '', chMax: '', sector: '', period: '24h' }
  };
  let U = load();
  let editing = false;

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      const u = { ...DEF, ...(raw && typeof raw === 'object' ? raw : {}) };
      u.order = Array.isArray(u.order) ? DEF.order.filter(id => u.order.includes(id)).concat(DEF.order.filter(id => !u.order.includes(id))) : DEF.order.slice();
      // keep the reader's order, then append anything new this version added
      if (Array.isArray(raw && raw.order)) {
        const known = raw.order.filter(id => DEF.order.includes(id));
        u.order = known.concat(DEF.order.filter(id => !known.includes(id)));
      }
      u.hidden = Array.isArray(u.hidden) ? u.hidden.filter(id => DEF.order.includes(id)) : [];
      u.filters = { ...DEF.filters, ...(u.filters || {}) };
      u.screeners = Array.isArray(u.screeners) ? u.screeners.slice(0, 20) : [];
      return u;
    } catch (e) { return JSON.parse(JSON.stringify(DEF)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(U)); } catch (e) {} }

  /* ── Small helpers ───────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
  const attr = s => esc(JSON.stringify(String(s)));
  const ico = (n, c) => `<span class="material-symbols-rounded${c ? ' ' + c : ''}" aria-hidden="true">${n}</span>`;
  const cico = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');
  const tick = s => (typeof tickerOf === 'function' ? tickerOf(s) : s);
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const onPage = () => !!$('cmp-root');

  function px(v) {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (a >= 1) return '$' + v.toFixed(2);
    if (a >= 0.01) return '$' + v.toFixed(4);
    if (a > 0) return '$' + v.toFixed(8).replace(/0+$/, '');
    return '$0';
  }
  function big(v) {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(v);
  }
  const pct = v => (v == null || !isFinite(v)) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  const dir = v => (v == null ? 'flat' : v > 0 ? 'up' : v < 0 ? 'dn' : 'flat');
  const ago = t => {
    const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };

  /* A line chart from a price series, drawn as a path. */
  function spark(series, w, h, up) {
    const v = (series || []).filter(x => isFinite(x));
    if (v.length < 3) return '';
    const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
    const pts = v.map((x, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(h - 2 - (x - lo) / span * (h - 4)).toFixed(1)}`);
    const rise = up != null ? up : v[v.length - 1] >= v[0];
    return `<svg class="cmp-spark ${rise ? 'up' : 'dn'}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  const star = sym => `<button type="button" class="cmp-star${CMKT.isWatched(sym) ? ' on' : ''}" data-cm="star" data-sym="${esc(sym)}"
    aria-pressed="${CMKT.isWatched(sym)}" aria-label="${CMKT.isWatched(sym) ? 'Remove from' : 'Add to'} favourites" title="Favourite">${ico(CMKT.isWatched(sym) ? 'star' : 'star_border')}</button>`;

  /* Price cells carry their symbol so a tick can patch them in place. */
  const pxCell = r => `<b class="cmp-px" data-px="${esc(r.sym)}">${px(r.price)}</b>`;
  const chCell = (r, field) => `<span class="cmp-ch ${dir(r[field || 'ch24h'])}" data-ch="${esc(r.sym)}" data-f="${esc(field || 'ch24h')}">${pct(r[field || 'ch24h'])}</span>`;

  /* ── Data status strip ───────────────────────────────────────────── */
  function statusHTML() {
    const s = CMKT.status();
    if (s.state === 'live') return `<span class="cmp-status live">${ico('bolt')}${esc(s.label)}</span>`;
    if (s.state === 'stale') return `<span class="cmp-status stale">${ico('history')}${esc(s.label)}</span>`;
    return `<span class="cmp-status off">${ico('cloud_off')}Market data temporarily unavailable</span>`;
  }

  /* ══ Widgets ═════════════════════════════════════════════════════ */
  /* Each returns the body of a card; the frame, title and edit controls
     are added by shell(). */

  function wBrief() {
    const news = cache.news;
    if (!news) return skeleton(2);
    if (!news.length) return `<div class="cmp-empty">Market news is unavailable right now. Headlines come from publishers' own feeds and will return on their own.</div>`;
    const [lead, ...rest] = news.slice(0, 5);
    return `<a class="cmp-brief-lead" href="${esc(lead.url)}" target="_blank" rel="noopener noreferrer">
        ${lead.thumbnail ? `<span class="cmp-brief-img"><img src="${esc(lead.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>` : ''}
        <span class="cmp-brief-t">
          <span class="cmp-tag">Market Brief</span>
          <b>${esc(lead.title)}</b>
          <em>${esc(lead.source)} · ${esc(ago(lead.publishedAt))}</em>
        </span>
      </a>
      ${rest.map(a => `<a class="cmp-brief-row" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">
        <span>${esc(a.title)}</span><em>${esc(a.source)} · ${esc(ago(a.publishedAt))}</em></a>`).join('')}`;
  }

  function wPulse() {
    const p = CMKT.pulse();
    const g = cache.global;
    if (!p) return `<div class="cmp-empty">Market data temporarily unavailable.</div>`;
    const btc = CMKT.coin('BTC'), eth = CMKT.coin('ETH');
    const stables = CMKT.markets({ stable: true }).filter(r => CMKT.isStable(r.sym));
    const stableCap = stables.reduce((t, r) => t + (r.mcap || 0), 0);
    const stableDom = g && g.mcap ? (stableCap / g.mcap) * 100 : null;
    const flowTotal = p.volUp + p.volDown;
    return `<div class="cmp-pulse-top">
        <div class="cmp-band" style="--band:${p.band.color}">
          <span class="cmp-band-l">${esc(p.band.label)}</span>
          <span class="cmp-band-s">${Math.round(p.score)}/100</span>
        </div>
        <div class="cmp-pulse-chart">${btc && btc.spark ? spark(btc.spark, 150, 46, (btc.ch7d || 0) >= 0) : ''}
          <em>BTC · 7 days</em></div>
      </div>
      <div class="cmp-pulse-bar" aria-hidden="true">
        <span class="up" style="width:${flowTotal ? (p.volUp / flowTotal) * 100 : 50}%"></span>
        <span class="dn" style="width:${flowTotal ? (p.volDown / flowTotal) * 100 : 50}%"></span>
      </div>
      <div class="cmp-flow"><span class="up">Volume in rising coins ${big(p.volUp)}</span><span class="dn">In falling coins ${big(p.volDown)}</span></div>
      <div class="cmp-stats">
        ${statTile('BTC', btc ? px(btc.price) : '—', btc ? pct(btc.ch24h) : '', btc ? dir(btc.ch24h) : 'flat', 'BTC')}
        ${statTile('ETH', eth ? px(eth.price) : '—', eth ? pct(eth.ch24h) : '', eth ? dir(eth.ch24h) : 'flat', 'ETH')}
        ${statTile('Total market cap', g ? big(g.mcap) : '—', g && g.mcapChange != null ? pct(g.mcapChange) : '', g ? dir(g.mcapChange) : 'flat')}
        ${statTile('24h volume', g ? big(g.vol) : '—', '', 'flat')}
        ${statTile('BTC dominance', g && g.btcDom != null ? g.btcDom.toFixed(1) + '%' : '—', '', 'flat')}
        ${statTile('Stablecoin share', stableDom != null ? stableDom.toFixed(1) + '%' : '—', '', 'flat')}
      </div>
      <details class="cmp-how"><summary>How this is worked out</summary>
        <ul>${p.parts.map(x => `<li><b>${esc(x.k)}</b> ${esc(x.note)} → ${Math.round(x.v)}/100</li>`).join('')}</ul>
        <p>The four parts are averaged. It describes conditions only — it is not advice, and not a forecast.</p>
      </details>`;
  }
  const statTile = (l, v, sub, d, sym) => `<${sym ? `button type="button" class="cmp-stat" data-cm="coin" data-sym="${esc(sym)}"` : 'div class="cmp-stat"'}>
      <span class="cmp-stat-l">${esc(l)}</span><b${sym ? ` class="cmp-px" data-px="${esc(sym)}"` : ''}>${v}</b>
      ${sub ? `<em class="${d}"${sym ? ` data-ch="${esc(sym)}" data-f="ch24h"` : ''}>${sub}</em>` : ''}
    </${sym ? 'button' : 'div'}>`;

  function wSentiment() {
    const s = CMKT.sentiment();
    if (!s) return `<div class="cmp-empty">Market data temporarily unavailable.</div>`;
    return `<div class="cmp-sent-split" role="img" aria-label="Bullish ${s.bull.toFixed(0)}%, neutral ${s.flat.toFixed(0)}%, bearish ${s.bear.toFixed(0)}%">
        <span class="up" style="width:${s.bull}%"></span><span class="flat" style="width:${s.flat}%"></span><span class="dn" style="width:${s.bear}%"></span>
      </div>
      <div class="cmp-sent-keys">
        <span class="up"><i></i>Bullish ${s.bull.toFixed(0)}%</span>
        <span class="flat"><i></i>Neutral ${s.flat.toFixed(0)}%</span>
        <span class="dn"><i></i>Bearish ${s.bear.toFixed(0)}%</span>
      </div>
      ${meter('Buying pressure', s.buying, 'up')}
      ${meter('Selling pressure', s.selling, 'dn')}
      ${meter('Market momentum', s.momentum, s.momentum >= 50 ? 'up' : 'dn')}
      ${meter('Volume momentum', s.volMomentum, s.volMomentum >= 50 ? 'up' : 'dn')}
      <details class="cmp-how"><summary>How this is worked out</summary>
        <p>From the ${s.total} coins in the feed: bullish counts coins up more than 1% over 24h, bearish counts those down more than 1%. Pressure splits 24h volume between rising and falling coins. Momentum compares the average 24h move (${pct(s.avg24)}) with the average weekly move${s.avg7 != null ? ` (${pct(s.avg7)})` : ''}. Sentiment describes the market, it does not predict it.</p>
      </details>`;
  }
  const meter = (l, v, d) => `<div class="cmp-meter"><span>${esc(l)}</span><span class="cmp-meter-bar"><i class="${d}" style="width:${Math.max(2, Math.min(100, v))}%"></i></span><b>${v.toFixed(0)}%</b></div>`;

  function wOverview() {
    const want = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE'];
    const rows = want.map(s => CMKT.coin(s)).filter(Boolean);
    if (!rows.length) return `<div class="cmp-empty">Market data temporarily unavailable.</div>`;
    return `<div class="cmp-swipe">${rows.map(r => `
      <div class="cmp-ov">
        <button type="button" class="cmp-ov-b" data-cm="coin" data-sym="${esc(r.sym)}">
          <span class="cmp-ov-h">${cico(r.sym, 30)}<span><b>${esc(tick(r.sym))}</b><em>${esc(r.name)}</em></span></span>
          <span class="cmp-ov-px">${pxCell(r)}${chCell(r)}</span>
          <span class="cmp-ov-chart">${spark(r.spark, 200, 44, (r.ch7d != null ? r.ch7d : r.ch24h) >= 0)}</span>
          <span class="cmp-ov-f"><em>Vol ${big(r.vol)}</em><em>Cap ${big(r.mcap)}</em></span>
        </button>
        <span class="cmp-ov-star">${star(r.sym)}</span>
      </div>`).join('')}</div>`;
  }

  const SPOT_TABS = [['popular', 'Popular'], ['trending', 'Trending'], ['gainers', 'Top gainers'], ['losers', 'Top losers'],
    ['traded', 'Most traded'], ['volume', 'High volume'], ['new', 'New to feed'], ['watch', 'Favourites']];
  function wSpot() {
    const t = U.spotTab;
    let rows;
    if (t === 'popular') rows = CMKT.markets({ stable: false }).slice(0, 10);
    else if (t === 'trending') rows = CMKT.trending(10);
    else if (t === 'gainers') rows = CMKT.movers('gainers', '24h', 10);
    else if (t === 'losers') rows = CMKT.movers('losers', '24h', 10);
    else if (t === 'traded' || t === 'volume') rows = CMKT.markets({ stable: false }).filter(r => r.vol).sort((a, b) => b.vol - a.vol).slice(0, 10);
    else if (t === 'new') rows = newToFeed(10);
    else rows = CMKT.watchlist().map(s => CMKT.coin(s)).filter(Boolean);
    return `<div class="cmp-chips" role="tablist">${SPOT_TABS.map(([k, l]) =>
        `<button type="button" role="tab" aria-selected="${t === k}" class="cmp-chip${t === k ? ' on' : ''}" data-cm="spottab" data-v="${k}">${l}</button>`).join('')}</div>
      ${t === 'new' ? `<p class="cmp-note">Coins this app saw for the first time recently. It tracks what reaches Trending's feed, not exchange listing dates.</p>` : ''}
      <div class="cmp-rows">${rows.length ? rows.map(r => rowHTML(r)).join('') : `<div class="cmp-empty">${t === 'watch' ? 'No favourites yet. Tap a star on any coin.' : 'Nothing to show here yet.'}</div>`}</div>`;
  }

  function rowHTML(r, opts) {
    const o = opts || {};
    return `<div class="cmp-row">
      <button type="button" class="cmp-row-b" data-cm="coin" data-sym="${esc(r.sym)}">
        <span class="cmp-row-id">${cico(r.sym, 30)}<span><b>${esc(tick(r.sym))}<i>/USDT</i></b><em>${esc(r.name)}</em></span></span>
        <span class="cmp-row-mid">${spark(r.spark, 56, 26, (r.ch24h || 0) >= 0)}</span>
        <span class="cmp-row-px">${pxCell(r)}<em>Vol ${big(r.vol)}</em></span>
        ${chCell(r, o.field)}
      </button>
      ${star(r.sym)}
    </div>${o.why && r.reasons ? `<div class="cmp-why">${r.reasons.slice(0, 2).map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}`;
  }

  function wTrending() {
    const rows = CMKT.trending(8);
    if (!rows.length) return `<div class="cmp-empty">Nothing is standing out right now.</div>`;
    return `<p class="cmp-note">Ranked by search interest, volume against market cap, price moves and new highs. Attention is not a recommendation.</p>
      <div class="cmp-rows">${rows.map(r => rowHTML(r, { why: true })).join('')}</div>`;
  }

  const PERIODS = [['1h', '1H'], ['24h', '24H'], ['7d', '7D'], ['30d', '30D']];
  function wGainers() {
    const p = U.glPeriod;
    const f = { '1h': 'ch1h', '24h': 'ch24h', '7d': 'ch7d', '30d': 'ch30d' }[p];
    const gain = CMKT.movers('gainers', p, 5), lose = CMKT.movers('losers', p, 5);
    return `<div class="cmp-chips">${PERIODS.map(([k, l]) =>
        `<button type="button" class="cmp-chip${p === k ? ' on' : ''}" data-cm="glperiod" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="cmp-two">
        <div><div class="cmp-sub up">Top gainers</div>${gain.length ? gain.map(r => miniRow(r, f)).join('') : `<div class="cmp-empty">No ${p} data yet.</div>`}</div>
        <div><div class="cmp-sub dn">Top losers</div>${lose.length ? lose.map(r => miniRow(r, f)).join('') : `<div class="cmp-empty">No ${p} data yet.</div>`}</div>
      </div>`;
  }
  const miniRow = (r, f) => `<button type="button" class="cmp-mini" data-cm="coin" data-sym="${esc(r.sym)}">
      ${cico(r.sym, 22)}<span class="cmp-mini-t"><b>${esc(tick(r.sym))}</b><em>${big(r.vol)}</em></span>
      <span class="cmp-mini-px">${pxCell(r)}${chCell(r, f)}</span></button>`;

  function wTracker() {
    const rows = CMKT.tracker(10);
    if (!rows.length) return `<div class="cmp-empty">No notable market events right now.</div>`;
    return `<div class="cmp-rows">${rows.map(r => `<div class="cmp-row cmp-track">
        <button type="button" class="cmp-row-b" data-cm="coin" data-sym="${esc(r.sym)}">
          <span class="cmp-row-id">${cico(r.sym, 30)}<span><b>${esc(tick(r.sym))}</b><em>${esc(r.name)}</em></span></span>
          <span class="cmp-event ${r.kind}" title="${esc(r.why)}">${esc(r.event)}</span>
        </button>
        ${star(r.sym)}
      </div>`).join('')}</div>`;
  }

  const MOVER_TABS = [['price', 'Price'], ['volume', 'Volume'], ['mcap', 'Market cap'], ['volatile', 'Most volatile']];
  function wMovers() {
    const t = U.moverTab;
    const rows = t === 'price' ? CMKT.movers('gainers', '24h', 6).concat(CMKT.movers('losers', '24h', 3)) : CMKT.movers(t, '24h', 8);
    return `<div class="cmp-chips">${MOVER_TABS.map(([k, l]) =>
        `<button type="button" class="cmp-chip${t === k ? ' on' : ''}" data-cm="movertab" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="cmp-rows">${rows.map(r => {
        const why = t === 'volume' ? `Volume ${big(r.vol)} · ${r.mcap ? (r.vol / r.mcap * 100).toFixed(0) + '% of market cap' : ''}`
          : t === 'mcap' ? `Market cap ${big(r.mcap)} moved ${pct(r.ch24h)}`
          : t === 'volatile' ? `Price swing ${r.vola ? r.vola.toFixed(1) : '—'}% average per reading this week`
          : `${pct(r.ch24h)} over 24h on ${big(r.vol)} volume`;
        return `<div class="cmp-row"><button type="button" class="cmp-row-b" data-cm="coin" data-sym="${esc(r.sym)}">
          <span class="cmp-row-id">${cico(r.sym, 28)}<span><b>${esc(tick(r.sym))}</b><em>${esc(why)}</em></span></span>
          <span class="cmp-row-px">${pxCell(r)}</span>${chCell(r)}</button>${star(r.sym)}</div>`;
      }).join('')}</div>`;
  }

  const HEAT_PERIODS = [['1h', '1H'], ['24h', '24H'], ['7d', '7D'], ['30d', '30D']];
  function wHeatmap() {
    const f = { '1h': 'ch1h', '24h': 'ch24h', '7d': 'ch7d', '30d': 'ch30d' }[U.heatPeriod];
    const rows = CMKT.markets({ stable: false }).filter(r => r.mcap && r[f] != null).slice(0, 28);
    if (!rows.length) return `<div class="cmp-empty">Market data temporarily unavailable.</div>`;
    const max = Math.max(...rows.map(r => r.mcap));
    return `<div class="cmp-chips">${HEAT_PERIODS.map(([k, l]) =>
        `<button type="button" class="cmp-chip${U.heatPeriod === k ? ' on' : ''}" data-cm="heatperiod" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="cmp-heat">${rows.map(r => {
        const v = r[f];
        const size = Math.max(1, Math.round((r.mcap / max) * 6));
        const tone = Math.min(1, Math.abs(v) / 8);
        const bg = v > 0.15 ? `color-mix(in srgb, var(--green) ${18 + tone * 62}%, var(--card))`
          : v < -0.15 ? `color-mix(in srgb, var(--red) ${18 + tone * 62}%, var(--card))`
          : 'var(--card2)';
        return `<button type="button" class="cmp-tile s${size}" style="background:${bg}" data-cm="coin" data-sym="${esc(r.sym)}" title="${esc(r.name)} ${pct(v)} · cap ${big(r.mcap)}">
          <b>${esc(tick(r.sym))}</b><em>${pct(v)}</em></button>`;
      }).join('')}</div>
      <p class="cmp-note">Tile size follows market cap; colour follows the ${U.heatPeriod.toUpperCase()} price move.</p>`;
  }

  function wSectors() {
    const cats = cache.cats;
    if (!cats) return skeleton(3);
    if (!cats.length) return `<div class="cmp-empty">Sector data temporarily unavailable.</div>`;
    const rows = cats.slice().sort((a, b) => (b.mcap || 0) - (a.mcap || 0)).slice(0, 10);
    return `<div class="cmp-rows">${rows.map(c => `<button type="button" class="cmp-sector" data-cm="sector" data-id="${esc(c.id)}">
        <span class="cmp-sector-t"><b>${esc(c.name)}</b><em>${big(c.mcap)} · vol ${big(c.vol)}</em></span>
        <span class="cmp-sector-c">${(c.top || []).map(u => `<img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join('')}</span>
        <span class="cmp-ch ${dir(c.ch24h)}">${pct(c.ch24h)}</span>
      </button>`).join('')}</div>`;
  }

  /* Narratives are the themes people talk about, picked out of the same
     sector data and ranked by how the money moved today. */
  const NARRATIVES = [
    ['AI tokens', /artificial|ai(\s|-)|\bai\b/i], ['RWA', /real.world|rwa|tokenized asset/i],
    ['Layer 2', /layer 2|l2|rollup/i], ['Layer 1', /layer 1|smart contract platform/i],
    ['DePIN', /depin|infrastructure network/i], ['Gaming', /gaming|game|metaverse|play.to.earn/i],
    ['Memecoins', /meme/i], ['DeFi', /defi|decentralized finance|dex|lending/i],
    ['SocialFi', /social/i], ['Privacy', /privacy/i], ['NFT', /nft/i], ['Staking', /liquid staking|staking/i]
  ];
  function wNarratives() {
    const cats = cache.cats;
    if (!cats) return skeleton(2);
    if (!cats.length) return `<div class="cmp-empty">Narrative data temporarily unavailable.</div>`;
    const rows = NARRATIVES.map(([name, re]) => {
      const hits = cats.filter(c => re.test(c.name));
      if (!hits.length) return null;
      const mcap = hits.reduce((t, c) => t + (c.mcap || 0), 0);
      const vol = hits.reduce((t, c) => t + (c.vol || 0), 0);
      const ch = hits.reduce((t, c) => t + (c.ch24h || 0) * (c.mcap || 0), 0) / (mcap || 1);
      const top = hits.sort((a, b) => (b.mcap || 0) - (a.mcap || 0))[0];
      return { name, mcap, vol, ch, top };
    }).filter(Boolean).sort((a, b) => b.ch - a.ch).slice(0, 8);
    return `<div class="cmp-narr">${rows.map(n => `<button type="button" class="cmp-narr-c" data-cm="sector" data-id="${esc(n.top.id)}">
        <b>${esc(n.name)}</b>
        <span class="cmp-ch ${dir(n.ch)}">${pct(n.ch)}</span>
        <em>Cap ${big(n.mcap)} · vol ${big(n.vol)}</em>
        <span class="cmp-narr-top">${(n.top.top || []).map(u => `<img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join('')}</span>
      </button>`).join('')}</div>
      <p class="cmp-note">Grouped from sector data by theme, weighted by market cap. 24h change shown; themes move fast.</p>`;
  }

  /* ── Screener ────────────────────────────────────────────────────── */
  function screenerRows() {
    const f = U.filters;
    const field = { '1h': 'ch1h', '24h': 'ch24h', '7d': 'ch7d', '30d': 'ch30d' }[f.period] || 'ch24h';
    const num = v => (v === '' || v == null || isNaN(+v) ? null : +v);
    const minCap = num(f.minCap), maxCap = num(f.maxCap), minVol = num(f.minVol), chMin = num(f.chMin), chMax = num(f.chMax);
    return CMKT.markets({ stable: false }).filter(r => {
      if (minCap != null && (r.mcap || 0) < minCap * 1e6) return false;
      if (maxCap != null && (r.mcap || 0) > maxCap * 1e6) return false;
      if (minVol != null && (r.vol || 0) < minVol * 1e6) return false;
      if (chMin != null && (r[field] == null || r[field] < chMin)) return false;
      if (chMax != null && (r[field] == null || r[field] > chMax)) return false;
      return true;
    }).sort((a, b) => (b[field] || 0) - (a[field] || 0));
  }
  function wScreener() {
    const f = U.filters;
    const rows = screenerRows();
    return `<div class="cmp-screen">
        <label>Market cap over<span><input type="number" inputmode="decimal" data-cmf="minCap" value="${esc(f.minCap)}" placeholder="0"> $m</span></label>
        <label>Market cap under<span><input type="number" inputmode="decimal" data-cmf="maxCap" value="${esc(f.maxCap)}" placeholder="any"> $m</span></label>
        <label>24h volume over<span><input type="number" inputmode="decimal" data-cmf="minVol" value="${esc(f.minVol)}" placeholder="0"> $m</span></label>
        <label>Change over<span><input type="number" inputmode="decimal" data-cmf="chMin" value="${esc(f.chMin)}" placeholder="any"> %</span></label>
        <label>Change under<span><input type="number" inputmode="decimal" data-cmf="chMax" value="${esc(f.chMax)}" placeholder="any"> %</span></label>
        <label>Over<span><select data-cmf="period">${PERIODS.map(([k, l]) => `<option value="${k}"${f.period === k ? ' selected' : ''}>${l}</option>`).join('')}</select></span></label>
      </div>
      <div class="cmp-screen-a">
        <button type="button" class="btn btn-primary btn-sm" data-cm="savescreen">Save this screener</button>
        <button type="button" class="btn btn-ghost btn-sm" data-cm="clearscreen">Clear</button>
        <span class="cmp-note">${rows.length} match${rows.length === 1 ? '' : 'es'}</span>
      </div>
      ${U.screeners.length ? `<div class="cmp-chips">${U.screeners.map((s, i) =>
        `<button type="button" class="cmp-chip" data-cm="loadscreen" data-v="${i}">${esc(s.name)}<i data-cm="delscreen" data-v="${i}" role="button" aria-label="Delete ${esc(s.name)}">✕</i></button>`).join('')}</div>` : ''}
      <div class="cmp-rows">${rows.slice(0, 12).map(r => rowHTML(r, { field: { '1h': 'ch1h', '24h': 'ch24h', '7d': 'ch7d', '30d': 'ch30d' }[f.period] })).join('') || `<div class="cmp-empty">Nothing matches these filters.</div>`}</div>`;
  }

  const LEAD_TABS = [['mcap', 'Market cap'], ['vol', 'Volume'], ['gain', 'Gainers'], ['lose', 'Losers'], ['volatile', 'Volatile'], ['watched', 'Most watched']];
  function wLeaderboard() {
    const t = U.leadTab;
    let rows;
    if (t === 'mcap') rows = CMKT.markets({ stable: false }).slice(0, 10);
    else if (t === 'vol') rows = CMKT.markets({ stable: false }).filter(r => r.vol).sort((a, b) => b.vol - a.vol).slice(0, 10);
    else if (t === 'gain') rows = CMKT.movers('gainers', U.glPeriod, 10);
    else if (t === 'lose') rows = CMKT.movers('losers', U.glPeriod, 10);
    else if (t === 'volatile') rows = CMKT.movers('volatile', '24h', 10);
    else rows = CMKT.watchlist().map(s => CMKT.coin(s)).filter(Boolean).slice(0, 10);
    return `<div class="cmp-chips">${LEAD_TABS.map(([k, l]) =>
        `<button type="button" class="cmp-chip${t === k ? ' on' : ''}" data-cm="leadtab" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="cmp-rows">${rows.length ? rows.map((r, i) => `<div class="cmp-row cmp-lead">
        <span class="cmp-rank">${i + 1}</span>
        <button type="button" class="cmp-row-b" data-cm="coin" data-sym="${esc(r.sym)}">
          <span class="cmp-row-id">${cico(r.sym, 26)}<span><b>${esc(tick(r.sym))}</b><em>${t === 'vol' ? 'Vol ' + big(r.vol) : 'Cap ' + big(r.mcap)}</em></span></span>
          <span class="cmp-row-px">${pxCell(r)}</span>${chCell(r)}
        </button>${star(r.sym)}</div>`).join('') : `<div class="cmp-empty">Nothing here yet.</div>`}</div>`;
  }

  function wWatchlist() {
    const syms = CMKT.watchlist();
    const rows = syms.map(s => CMKT.coin(s)).filter(Boolean);
    const alerts = CMKT.alerts();
    if (!rows.length) return `<div class="cmp-empty">No favourites yet. Tap the star on any coin to follow it here.<br><span class="cmp-note">Favourites are kept on this device until Trending has accounts syncing.</span></div>`;
    return `<div class="cmp-rows">${rows.map(r => `<div class="cmp-row">
        <button type="button" class="cmp-row-b" data-cm="coin" data-sym="${esc(r.sym)}">
          <span class="cmp-row-id">${cico(r.sym, 30)}<span><b>${esc(tick(r.sym))}</b><em>7D ${pct(r.ch7d)} · cap ${big(r.mcap)}</em></span></span>
          <span class="cmp-row-mid">${spark(r.spark, 56, 26, (r.ch7d || 0) >= 0)}</span>
          <span class="cmp-row-px">${pxCell(r)}<em>Vol ${big(r.vol)}</em></span>${chCell(r)}
        </button>${star(r.sym)}</div>`).join('')}</div>
      <div class="cmp-screen-a">
        <button type="button" class="btn btn-ghost btn-sm" data-cm="alerts">${ico('notifications')}Price alerts${alerts.length ? ` · ${alerts.length}` : ''}</button>
      </div>`;
  }

  const NEWS_TABS = [['all', 'All'], ['bitcoin', 'Bitcoin'], ['ethereum', 'Ethereum'], ['altcoins', 'Altcoins'], ['defi', 'DeFi'], ['regulation', 'Regulation'], ['institutional', 'Institutional']];
  const NEWS_RE = {
    bitcoin: /bitcoin|btc/i, ethereum: /ethereum|eth\b|vitalik/i,
    altcoins: /solana|xrp|cardano|doge|altcoin|bnb|avax|sui|ton\b/i,
    defi: /defi|dex|liquidity|yield|uniswap|aave|lending/i,
    regulation: /sec\b|regulat|lawsuit|court|ban\b|law|policy|congress/i,
    institutional: /etf|institution|blackrock|fidelity|treasury|fund|grayscale|corporate/i
  };
  function wNews() {
    const news = cache.news;
    if (!news) return skeleton(3);
    if (!news.length) return `<div class="cmp-empty">News is unavailable right now. Headlines come from publishers' own feeds.</div>`;
    const re = NEWS_RE[U.newsTab];
    const rows = re ? news.filter(a => re.test(a.title + ' ' + (a.excerpt || ''))) : news;
    return `<div class="cmp-chips">${NEWS_TABS.map(([k, l]) =>
        `<button type="button" class="cmp-chip${U.newsTab === k ? ' on' : ''}" data-cm="newstab" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="cmp-news">${rows.length ? rows.slice(0, 12).map(a => `<a class="cmp-news-i" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">
        ${a.thumbnail ? `<img src="${esc(a.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
        <span><b>${esc(a.title)}</b><em>${esc(a.source)} · ${esc(ago(a.publishedAt))}</em></span></a>`).join('')
        : `<div class="cmp-empty">No ${esc(U.newsTab)} headlines in the latest batch.</div>`}</div>`;
  }

  /* Coins this device is seeing for the first time. */
  function newToFeed(limit) {
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(SEEN) || '{}') || {}; } catch (e) { seen = {}; }
    const rows = CMKT.markets({ stable: false });
    const now = Date.now();
    let changed = false;
    rows.forEach(r => { if (!seen[r.sym]) { seen[r.sym] = now; changed = true; } });
    if (changed) { try { localStorage.setItem(SEEN, JSON.stringify(seen)); } catch (e) {} }
    return rows.filter(r => seen[r.sym]).sort((a, b) => seen[b.sym] - seen[a.sym]).slice(0, limit || 10);
  }

  const WIDGETS = {
    brief: { t: 'Market Brief', i: 'campaign', f: wBrief },
    pulse: { t: 'Market Pulse', i: 'speed', f: wPulse },
    sentiment: { t: 'Market Sentiment', i: 'psychology', f: wSentiment },
    overview: { t: 'Market Overview', i: 'dashboard', f: wOverview },
    trending: { t: 'Trending Now', i: 'local_fire_department', f: wTrending },
    gainers: { t: 'Gainers & Losers', i: 'swap_vert', f: wGainers },
    tracker: { t: 'Smart Tracker', i: 'radar', f: wTracker },
    movers: { t: 'Market Movers', i: 'moving', f: wMovers },
    heatmap: { t: 'Heatmap', i: 'grid_view', f: wHeatmap },
    sectors: { t: 'Market Sectors', i: 'category', f: wSectors },
    narratives: { t: 'Trending Narratives', i: 'auto_awesome', f: wNarratives },
    spot: { t: 'Spot Market', i: 'candlestick_chart', f: wSpot },
    screener: { t: 'Market Screener', i: 'filter_alt', f: wScreener },
    leaderboard: { t: 'Leaderboard', i: 'leaderboard', f: wLeaderboard },
    watchlist: { t: 'Favourites', i: 'star', f: wWatchlist },
    news: { t: 'Market News', i: 'newspaper', f: wNews }
  };

  /* Which widgets a category shows, in the reader's own order. */
  const CATS = [
    ['foryou', 'For You', null],
    ['favorites', 'Favorites', ['watchlist', 'trending', 'tracker', 'news']],
    ['crypto', 'Crypto', ['pulse', 'sentiment', 'overview', 'heatmap', 'sectors', 'narratives', 'news']],
    ['spot', 'Spot', ['spot', 'gainers', 'movers', 'screener', 'leaderboard']],
    ['futures', 'Futures', []],
    ['new', 'New Listings', ['spot']],
    ['alpha', 'Alpha', ['trending', 'movers', 'narratives']]
  ];

  const skeleton = n => `<div class="cmp-skel">${Array.from({ length: n }, () => '<span></span>').join('')}</div>`;

  /* ── Frame ───────────────────────────────────────────────────────── */
  function shell(id) {
    const w = WIDGETS[id];
    if (!w) return '';
    const idx = U.order.indexOf(id);
    return `<section class="cmp-card" data-w="${id}">
      <div class="cmp-card-h">
        <b>${ico(w.i, 'cmp-card-i')}${esc(w.t)}</b>
        ${editing ? `<span class="cmp-edit-a">
          <button type="button" class="cmp-ib" data-cm="up" data-v="${id}" aria-label="Move ${esc(w.t)} up"${idx <= 0 ? ' disabled' : ''}>${ico('arrow_upward')}</button>
          <button type="button" class="cmp-ib" data-cm="down" data-v="${id}" aria-label="Move ${esc(w.t)} down"${idx >= U.order.length - 1 ? ' disabled' : ''}>${ico('arrow_downward')}</button>
          <button type="button" class="cmp-ib" data-cm="hide" data-v="${id}" aria-label="Hide ${esc(w.t)}">${ico('visibility_off')}</button>
        </span>` : ''}
      </div>
      <div class="cmp-card-b">${w.f()}</div>
    </section>`;
  }

  function visibleWidgets() {
    const cat = CATS.find(c => c[0] === U.cat) || CATS[0];
    const allow = cat[2];
    if (U.cat === 'futures') return [];
    let ids = U.order.filter(id => !U.hidden.includes(id));
    if (allow) ids = ids.filter(id => allow.includes(id));
    if (U.cat === 'foryou' || U.cat === 'favorites') {
      // Personal first: favourites when there are any, then the market-wide
      // widgets, which stay visible whatever the reader follows.
      const watch = (U.cat === 'favorites' || CMKT.watchlist().length) ? ['watchlist'] : [];
      ids = watch.concat(ids.filter(id => id !== 'watchlist'));
    }
    return ids;
  }

  function catsHTML() {
    return `<div class="cmp-cats" role="tablist" aria-label="Market categories">${CATS.map(([k, l]) =>
      `<button type="button" role="tab" aria-selected="${U.cat === k}" class="cmp-cat${U.cat === k ? ' on' : ''}" data-cm="cat" data-v="${k}">${esc(l)}</button>`).join('')}</div>`;
  }

  function headHTML() {
    return `<div class="cmp-head">
      <button type="button" class="cmp-search" data-cm="search">
        ${ico('search')}<span>Search coins, pairs &amp; market trends</span>
      </button>
      <button type="button" class="cmp-ib cmp-menu" data-cm="menu" aria-label="Crypto Market options" title="Options">${ico('more_horiz')}</button>
    </div>`;
  }

  function futuresHTML() {
    return `<section class="cmp-card"><div class="cmp-card-h"><b>${ico('candlestick_chart', 'cmp-card-i')}Futures</b></div>
      <div class="cmp-card-b"><div class="cmp-empty cmp-empty-big">
        <b>Trending has no futures market</b>
        <p>There is no leverage, margin or perpetual trading in the app, so there are no futures prices to show. Spot prices, sentiment and everything else on this page cover the spot market.</p>
        <button type="button" class="btn btn-primary btn-sm" data-cm="cat" data-v="spot">Go to Spot</button>
      </div></div></section>`;
  }

  /* ── Paint ───────────────────────────────────────────────────────── */
  const cache = { news: null, cats: null, global: null };

  function paint() {
    const root = $('cmp-root');
    if (!root) return;
    const head = $('cmp-top');
    if (head) head.innerHTML = headHTML() + catsHTML() + `<div class="cmp-statusbar">${statusHTML()}</div>`;
    root.className = editing ? 'cmp-editing' : '';
    root.innerHTML = U.cat === 'futures'
      ? futuresHTML()
      : visibleWidgets().map(shell).join('') || `<div class="cmp-empty">Every widget is hidden. Use Edit Crypto Market to bring some back.</div>`;
    const bar = $('cmp-editbar');
    if (bar) bar.innerHTML = editBarHTML();
  }

  function editBarHTML() {
    if (!editing) return `<button type="button" class="cmp-editbtn" data-cm="edit">${ico('tune')}Edit Crypto Market</button>`;
    const hidden = U.hidden.filter(id => WIDGETS[id]);
    return `<div class="cmp-editpanel">
      <div class="cmp-editpanel-h"><b>Edit Crypto Market</b>
        <button type="button" class="btn btn-primary btn-sm" data-cm="editdone">Done</button></div>
      <p class="cmp-note">Use the arrows on a card to move it, or the eye to hide it. Your layout is kept on this device.</p>
      ${hidden.length ? `<div class="cmp-hidden"><span>Hidden</span>${hidden.map(id =>
        `<button type="button" class="cmp-chip" data-cm="show" data-v="${id}">${ico('add')}${esc(WIDGETS[id].t)}</button>`).join('')}</div>` : '<p class="cmp-note">Nothing is hidden.</p>'}
      <button type="button" class="btn btn-ghost btn-sm" data-cm="reset">Reset layout</button>
    </div>`;
  }

  /* Prices move constantly; patch the cells rather than rebuild cards. */
  function onPriceTick() {
    if (!onPage()) return;
    document.querySelectorAll('#pane-cryptomarket [data-px]').forEach(el => {
      const r = CMKT.coin(el.dataset.px);
      if (!r) return;
      const next = px(r.price);
      if (el.textContent === next) return;
      const up = parseFloat(el.textContent.replace(/[^0-9.-]/g, '')) < r.price;
      el.textContent = next;
      el.classList.remove('flash-up', 'flash-dn');
      void el.offsetWidth;
      el.classList.add(up ? 'flash-up' : 'flash-dn');
    });
    document.querySelectorAll('#pane-cryptomarket [data-ch]').forEach(el => {
      const r = CMKT.coin(el.dataset.ch);
      if (!r) return;
      const v = r[el.dataset.f || 'ch24h'];
      el.textContent = pct(v);
      el.className = el.className.replace(/\b(up|dn|flat)\b/g, '').trim() + ' ' + dir(v);
    });
    const sb = document.querySelector('#cmp-top .cmp-statusbar');
    if (sb) sb.innerHTML = statusHTML();
  }

  /* ── Slow data ───────────────────────────────────────────────────── */
  /* The market-wide endpoints are rate-limited from time to time. Each
     one retries on its own, backing off, so a section fills in late
     rather than sitting empty until the next visit. */
  const tries = {};
  function loadPart(name, fn, after) {
    fn().then(v => { tries[name] = 0; after(v, true); }).catch(() => {
      tries[name] = (tries[name] || 0) + 1;
      after(null, false);
      if (tries[name] <= 4) setTimeout(() => { if (onPage()) loadPart(name, fn, after); }, tries[name] * 15000);
    });
  }
  function loadSlow() {
    loadPart('global', () => CMKT.global(), (g, ok) => { if (ok) cache.global = g; if (onPage()) repaintWidget('pulse'); });
    loadPart('cats', () => CMKT.categories(), (c, ok) => {
      cache.cats = ok ? c : (cache.cats || null);
      if (!ok && tries.cats > 4) cache.cats = [];
      if (onPage()) { repaintWidget('sectors'); repaintWidget('narratives'); }
    });
    loadPart('trend', () => CMKT.trendingSearch(), () => { if (onPage()) repaintWidget('trending'); });
    loadPart('news', () => CMKT.news(12), (n, ok) => {
      cache.news = ok ? (n || []) : (tries.news > 4 ? [] : cache.news);
      if (onPage()) { repaintWidget('brief'); repaintWidget('news'); }
    });
  }
  function repaintWidget(id) {
    const el = document.querySelector(`#cmp-root [data-w="${id}"] .cmp-card-b`);
    if (el && WIDGETS[id]) el.innerHTML = WIDGETS[id].f();
  }

  /* ── Actions ─────────────────────────────────────────────────────── */
  function act(what, el) {
    const v = el.dataset.v;
    switch (what) {
      case 'cat': U.cat = v; save(); paint(); scrollTop(); return;
      case 'spottab': U.spotTab = v; save(); repaintWidget('spot'); return;
      case 'glperiod': U.glPeriod = v; save(); repaintWidget('gainers'); repaintWidget('leaderboard'); return;
      case 'heatperiod': U.heatPeriod = v; save(); repaintWidget('heatmap'); return;
      case 'movertab': U.moverTab = v; save(); repaintWidget('movers'); return;
      case 'leadtab': U.leadTab = v; save(); repaintWidget('leaderboard'); return;
      case 'newstab': U.newsTab = v; save(); repaintWidget('news'); return;
      case 'star': {
        const sym = el.dataset.sym;
        CMKT.toggleWatch(sym);
        document.querySelectorAll(`#pane-cryptomarket .cmp-star[data-sym="${CSS.escape(sym)}"]`).forEach(b => {
          const on = CMKT.isWatched(sym);
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', String(on));
          b.innerHTML = ico(on ? 'star' : 'star_border');
        });
        if (U.cat === 'favorites' || U.cat === 'foryou') { repaintWidget('watchlist'); if (!document.querySelector('[data-w="watchlist"]')) paint(); }
        return;
      }
      case 'coin': openCoin(el.dataset.sym); return;
      case 'sector': openSector(el.dataset.id); return;
      case 'search': openSearch(); return;
      case 'menu': openMenu(); return;
      case 'alerts': CMKT.openAlerts(); return;
      case 'edit': editing = true; paint(); return;
      case 'editdone': editing = false; paint(); return;
      case 'hide': if (!U.hidden.includes(v)) U.hidden.push(v); save(); paint(); return;
      case 'show': U.hidden = U.hidden.filter(x => x !== v); save(); paint(); return;
      case 'up': case 'down': {
        const i = U.order.indexOf(v);
        const j = what === 'up' ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= U.order.length) return;
        U.order.splice(j, 0, U.order.splice(i, 1)[0]);
        save(); paint();
        const card = document.querySelector(`#cmp-root [data-w="${v}"]`);
        if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      case 'reset': U.order = DEF.order.slice(); U.hidden = []; save(); paint(); return;
      case 'savescreen': {
        const name = 'Screener ' + (U.screeners.length + 1);
        U.screeners.push({ name, filters: { ...U.filters } });
        save(); repaintWidget('screener'); toast('Screener saved');
        return;
      }
      case 'loadscreen': { const s = U.screeners[+v]; if (s) { U.filters = { ...s.filters }; save(); repaintWidget('screener'); } return; }
      case 'delscreen': { U.screeners.splice(+v, 1); save(); repaintWidget('screener'); return; }
      case 'clearscreen': U.filters = { ...DEF.filters }; save(); repaintWidget('screener'); return;
    }
  }
  const scrollTop = () => { const p = $('pane-cryptomarket'); if (p) p.scrollTo({ top: 0, behavior: 'smooth' }); };

  /* ── Coin detail ─────────────────────────────────────────────────── */
  const DETAIL_PERIODS = [['1h', '1H', 1], ['4h', '4H', 1], ['1d', '1D', 1], ['1w', '1W', 7], ['1m', '1M', 30], ['3m', '3M', 90], ['1y', '1Y', 365], ['all', 'ALL', 'max']];
  const D = { sym: '', period: '1d', tab: 'overview', series: null, loading: false };

  function openCoin(sym) {
    const r = CMKT.coin(sym);
    if (!r) { toast(`${sym} has no live price right now.`); return; }
    D.sym = r.sym; D.series = null; D.tab = 'overview';
    let el = $('cmp-detail');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cmp-detail';
      el.className = 'cmp-detail';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      document.body.appendChild(el);
      el.addEventListener('click', onDetailClick);
      document.addEventListener('keydown', detailKey, true);
    }
    el.setAttribute('aria-label', r.name + ' market detail');
    paintDetail();
    loadSeries();
    requestAnimationFrame(() => el.classList.add('open'));
  }
  function closeCoin() {
    const el = $('cmp-detail');
    if (!el) return;
    el.remove();
    document.removeEventListener('keydown', detailKey, true);
    D.sym = '';
  }
  function detailKey(e) { if (e.key === 'Escape' && $('cmp-detail')) { e.preventDefault(); e.stopPropagation(); closeCoin(); } }
  function onDetailClick(e) {
    const b = e.target.closest('[data-cd]');
    if (!b) { if (e.target.id === 'cmp-detail') closeCoin(); return; }
    const w = b.dataset.cd, v = b.dataset.v;
    if (w === 'close') return closeCoin();
    if (w === 'period') { D.period = v; D.series = null; paintDetail(); loadSeries(); return; }
    if (w === 'tab') { D.tab = v; paintDetail(); return; }
    if (w === 'star') { CMKT.toggleWatch(D.sym); paintDetail(); paint(); return; }
    if (w === 'trade') { if (typeof TR !== 'undefined' && TR.isTradable(D.sym)) { TR.setPair(D.sym); closeCoin(); navigateTo('trade'); } else toast('That coin has no trading pair here.'); return; }
    if (w === 'alert') { closeCoin(); CMKT.openAlerts(); return; }
  }
  function loadSeries() {
    const r = CMKT.coin(D.sym);
    const p = DETAIL_PERIODS.find(x => x[0] === D.period);
    // No id means the markets endpoint hasn't answered yet; the 7-day
    // series the app already holds stands in, and the note says so.
    if (!r || !r.id || !p) { D.series = r && r.spark ? r.spark.slice() : []; D.fallback = !!(r && r.spark); paintDetail(); return; }
    D.fallback = false;
    D.loading = true;
    CMKT.chart(r.id, p[2]).then(list => {
      let s = list;
      if (D.period === '1h') s = list.slice(-Math.max(4, Math.round(list.length / 24)));
      else if (D.period === '4h') s = list.slice(-Math.max(6, Math.round(list.length / 6)));
      D.series = s.map(x => x.v);
      D.loading = false;
      paintDetail();
    }).catch(() => {
      D.series = r.spark ? r.spark.slice() : [];
      D.fallback = !!r.spark;
      D.loading = false;
      paintDetail();
    });
  }
  function paintDetail() {
    const el = $('cmp-detail');
    const r = CMKT.coin(D.sym);
    if (!el || !r) return;
    const watched = CMKT.isWatched(r.sym);
    const series = D.series;
    const first = series && series.length ? series[0] : null;
    const move = first ? ((r.price - first) / first) * 100 : r.ch24h;
    el.innerHTML = `<div class="cmp-detail-in">
      <div class="cmp-detail-h">
        <button type="button" class="cmp-ib" data-cd="close" aria-label="Close">${ico('arrow_back')}</button>
        <span class="cmp-detail-t">${cico(r.sym, 26)}<b>${esc(tick(r.sym))}</b><em>${esc(r.name)}</em>${r.rank ? `<i class="cmp-rank-b">#${r.rank}</i>` : ''}</span>
        <button type="button" class="cmp-ib${watched ? ' on' : ''}" data-cd="star" aria-pressed="${watched}" aria-label="Favourite">${ico(watched ? 'star' : 'star_border')}</button>
      </div>
      <div class="cmp-detail-px">
        <b class="cmp-px" data-px="${esc(r.sym)}">${px(r.price)}</b>
        <span class="cmp-ch ${dir(r.ch24h)}" data-ch="${esc(r.sym)}" data-f="ch24h">${pct(r.ch24h)}</span>
        <em>24h</em>
      </div>
      <div class="cmp-chips">${DETAIL_PERIODS.map(([k, l]) => `<button type="button" class="cmp-chip${D.period === k ? ' on' : ''}" data-cd="period" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="cmp-detail-chart">${series == null ? skeleton(1)
        : series.length ? spark(series, 320, 120, move >= 0)
          + `<span class="cmp-detail-move ${dir(move)}">${pct(move)} over ${esc(D.fallback ? '7D' : (DETAIL_PERIODS.find(x => x[0] === D.period) || [])[1] || '')}</span>`
          + (D.fallback ? `<p class="cmp-note">Showing the 7-day series from the price feed — detailed history is unavailable right now.</p>` : '')
        : `<div class="cmp-empty">Chart data temporarily unavailable.</div>`}</div>
      <div class="cmp-chips cmp-detail-tabs">${[['overview', 'Overview'], ['markets', 'Markets'], ['news', 'News'], ['info', 'Token info']].map(([k, l]) =>
        `<button type="button" class="cmp-chip${D.tab === k ? ' on' : ''}" data-cd="tab" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="cmp-detail-b">${detailBody(r)}</div>
      <div class="cmp-detail-a">
        <button type="button" class="btn btn-primary" data-cd="trade">Trade ${esc(tick(r.sym))}</button>
        <button type="button" class="btn btn-ghost" data-cd="alert">${ico('notifications')}Set an alert</button>
      </div>
    </div>`;
  }
  function detailBody(r) {
    if (D.tab === 'markets') {
      const tradable = typeof TR !== 'undefined' && TR.isTradable(r.sym);
      return `<div class="cmp-kv">
        ${kv('In Trending', tradable ? 'Spot pair available' : 'No spot pair here')}
        ${kv('Pairs', tradable ? `${esc(tick(r.sym))}/USDT · /USDC · /USD1` : '—')}
        ${kv('24h volume', big(r.vol))}
        ${kv('Volume vs cap', r.vol && r.mcap ? (r.vol / r.mcap * 100).toFixed(1) + '%' : '—')}
      </div><p class="cmp-note">Trading in Trending is a paper account using live prices.</p>`;
    }
    if (D.tab === 'news') {
      const news = (cache.news || []).filter(a => new RegExp(`\\b${r.sym}\\b|${r.name}`, 'i').test(a.title + ' ' + (a.excerpt || '')));
      if (!news.length) return `<div class="cmp-empty">No recent headlines mention ${esc(r.name)}.</div>`;
      return `<div class="cmp-news">${news.slice(0, 6).map(a => `<a class="cmp-news-i" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">
        <span><b>${esc(a.title)}</b><em>${esc(a.source)} · ${esc(ago(a.publishedAt))}</em></span></a>`).join('')}</div>`;
    }
    if (D.tab === 'info') {
      return `<div class="cmp-kv">
        ${kv('Circulating supply', r.supply ? r.supply.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ' + tick(r.sym) : '—')}
        ${kv('Total supply', r.totalSupply ? r.totalSupply.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—')}
        ${kv('Max supply', r.maxSupply ? r.maxSupply.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'No cap')}
        ${kv('All-time high', px(r.ath) + (r.athPct != null ? ` (${pct(r.athPct)} from here)` : ''))}
        ${kv('All-time low', px(r.atl) + (r.atlPct != null ? ` (${pct(r.atlPct)})` : ''))}
        ${kv('Data source', 'CoinGecko · ' + (r.src === 'binance' ? 'price streaming from Binance' : 'polled'))}
      </div>`;
    }
    const related = CMKT.markets({ stable: false }).filter(x => x.sym !== r.sym && x.mcap)
      .sort((a, b) => Math.abs((a.mcap || 0) - (r.mcap || 0)) - Math.abs((b.mcap || 0) - (r.mcap || 0))).slice(0, 4);
    return `<div class="cmp-kv">
        ${kv('Market cap', big(r.mcap))}
        ${kv('24h volume', big(r.vol))}
        ${kv('24h high', px(r.high24))}
        ${kv('24h low', px(r.low24))}
        ${kv('1h', pct(r.ch1h))}
        ${kv('7d', pct(r.ch7d))}
        ${kv('30d', pct(r.ch30d))}
        ${kv('Rank', r.rank ? '#' + r.rank : '—')}
      </div>
      <div class="cmp-sub">Similar by size</div>
      <div class="cmp-rows">${related.map(x => miniRow(x, 'ch24h')).join('')}</div>`;
  }
  const kv = (k, v) => `<div class="cmp-kv-i"><span>${esc(k)}</span><b>${v}</b></div>`;

  /* ── Sector sheet ────────────────────────────────────────────────── */
  function openSector(id) {
    const c = (cache.cats || []).find(x => x.id === id);
    if (!c) return;
    const rows = CMKT.markets({ stable: false }).filter(r => (c.top || []).some(u => r.image && u && r.image.split('/').pop() === u.split('/').pop()));
    const el = document.createElement('div');
    el.className = 'mob-scrim';
    el.id = 'cmp-sector';
    el.innerHTML = `<div class="mob-sheet cmp-sheet" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
      <span class="mob-grab" aria-hidden="true"></span>
      <div class="cmp-card-h"><b>${esc(c.name)}</b><span class="cmp-ch ${dir(c.ch24h)}">${pct(c.ch24h)}</span></div>
      <div class="cmp-kv">${kv('Market cap', big(c.mcap))}${kv('24h volume', big(c.vol))}</div>
      ${rows.length ? `<div class="cmp-sub">Leading coins</div><div class="cmp-rows">${rows.map(r => miniRow(r, 'ch24h')).join('')}</div>` : ''}
      <p class="cmp-note">Sector totals come from the market-data provider and refresh every few minutes.</p>
    </div>`;
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));
  }

  /* ── Search ──────────────────────────────────────────────────────── */
  function openSearch() {
    let el = $('cmp-search');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cmp-search';
      el.className = 'cmp-searchwrap';
      document.body.appendChild(el);
      el.addEventListener('click', e => {
        if (e.target === el || e.target.closest('[data-cs="close"]')) { el.remove(); return; }
        const b = e.target.closest('[data-cs="coin"]');
        if (b) { el.remove(); openCoin(b.dataset.sym); }
        const s = e.target.closest('[data-cs="sector"]');
        if (s) { el.remove(); openSector(s.dataset.id); }
      });
      el.addEventListener('input', e => { if (e.target.id === 'cmp-q') renderSearch(e.target.value); });
      el.addEventListener('keydown', e => { if (e.key === 'Escape') el.remove(); });
    }
    el.innerHTML = `<div class="cmp-searchbox">
      <div class="cmp-searchhead">
        ${ico('search')}
        <input id="cmp-q" type="search" placeholder="Search coins, pairs &amp; market trends" autocomplete="off" aria-label="Search the crypto market">
        <button type="button" class="cmp-ib" data-cs="close" aria-label="Close">${ico('close')}</button>
      </div>
      <div id="cmp-results" class="cmp-results"></div>
    </div>`;
    renderSearch('');
    const q = $('cmp-q');
    if (q) q.focus();
  }
  function renderSearch(q) {
    const box = $('cmp-results');
    if (!box) return;
    if (!q || !q.trim()) {
      const t = CMKT.trending(6);
      box.innerHTML = `<div class="cmp-sub">Trending now</div>` + t.map(r => searchRow(r)).join('');
      return;
    }
    const res = CMKT.search(q);
    box.innerHTML = (res.coins.length ? `<div class="cmp-sub">Coins</div>` + res.coins.map(r => searchRow(r)).join('') : '')
      + (res.sectors.length ? `<div class="cmp-sub">Sectors</div>` + res.sectors.map(c =>
        `<button type="button" class="cmp-sres" data-cs="sector" data-id="${esc(c.id)}"><span class="cmp-sres-t"><b>${esc(c.name)}</b><em>${big(c.mcap)}</em></span><span class="cmp-ch ${dir(c.ch24h)}">${pct(c.ch24h)}</span></button>`).join('') : '')
      + (!res.coins.length && !res.sectors.length ? `<div class="cmp-empty">Nothing matches “${esc(q)}”.</div>` : '');
  }
  const searchRow = r => `<button type="button" class="cmp-sres" data-cs="coin" data-sym="${esc(r.sym)}">
      ${cico(r.sym, 26)}<span class="cmp-sres-t"><b>${esc(tick(r.sym))}</b><em>${esc(r.name)}</em></span>
      <span class="cmp-sres-px">${px(r.price)}<i class="cmp-ch ${dir(r.ch24h)}">${pct(r.ch24h)}</i></span></button>`;

  /* ── Options menu ────────────────────────────────────────────────── */
  function openMenu() {
    const s = CMKT.status();
    const el = document.createElement('div');
    el.className = 'mob-scrim';
    el.id = 'cmp-menu';
    el.innerHTML = `<div class="mob-sheet" role="dialog" aria-modal="true" aria-label="Crypto Market options">
      <span class="mob-grab" aria-hidden="true"></span>
      <button type="button" class="pg-row" data-m="refresh">${ico('refresh')}<span>Refresh market data</span></button>
      <button type="button" class="pg-row" data-m="edit">${ico('tune')}<span>Edit Crypto Market</span></button>
      <button type="button" class="pg-row" data-m="alerts">${ico('notifications')}<span>Price alerts</span></button>
      <button type="button" class="pg-row" data-m="watch">${ico('star')}<span>Favourites</span></button>
      <div class="cmp-note cmp-menu-note">Data: ${esc(CMKT.PROVIDERS[CMKT.provider].label)} · ${esc(s.label)}</div>
    </div>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-m]');
      if (!b) { if (e.target === el) el.remove(); return; }
      el.remove();
      const m = b.dataset.m;
      if (m === 'refresh') { loadSlow(true); if (typeof fetchCryptoPrices === 'function') fetchCryptoPrices(); toast('Refreshing market data…'); }
      if (m === 'edit') { editing = true; paint(); }
      if (m === 'alerts') CMKT.openAlerts();
      if (m === 'watch') { U.cat = 'favorites'; save(); paint(); scrollTop(); }
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));
  }

  /* ── Wiring ──────────────────────────────────────────────────────── */
  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener('click', e => {
      const el = e.target.closest('#pane-cryptomarket [data-cm]');
      if (!el) return;
      e.preventDefault();
      act(el.dataset.cm, el);
    });
    document.addEventListener('input', e => {
      const f = e.target.closest('#pane-cryptomarket [data-cmf]');
      if (!f) return;
      U.filters[f.dataset.cmf] = f.value;
      save();
      const rows = screenerRows();
      const note = document.querySelector('#cmp-root [data-w="screener"] .cmp-screen-a .cmp-note');
      if (note) note.textContent = `${rows.length} match${rows.length === 1 ? '' : 'es'}`;
      clearTimeout(filterTimer);
      filterTimer = setTimeout(() => {
        const list = document.querySelector('#cmp-root [data-w="screener"] .cmp-rows');
        if (list) list.innerHTML = rows.slice(0, 12).map(r => rowHTML(r)).join('') || `<div class="cmp-empty">Nothing matches these filters.</div>`;
      }, 250);
    });
  }
  let filterTimer = null;

  function render() {
    wire();
    paint();
    loadSlow();
  }

  return { render, paint, onPriceTick, openCoin, openSearch, act, loadSlow, get state() { return U; }, WIDGETS };
})();

window.CMP = CMP;

function getCryptomarketTemplate() {
  return `<section id="pane-cryptomarket" class="pane">
    <div id="cmp-top" class="cmp-top"></div>
    <div id="cmp-root"></div>
    <div id="cmp-editbar" class="cmp-editbar"></div>
  </section>`;
}

function renderCryptomarket() { CMP.render(); }

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
publish('pages/cryptomarket.js', {
  CMP: () => CMP, getCryptomarketTemplate: () => getCryptomarketTemplate,
  renderCryptomarket: () => renderCryptomarket
});
