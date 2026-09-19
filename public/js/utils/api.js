// ── REAL-TIME API INTEGRATIONS ─────────────────────────────────────

// Global state for live prices (fallback to static mock data if API fails).
// The placeholders are marked stale so nothing can be traded at them.
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

window.liveCryptoPrices = {
  'BTC': { usd: 68450, usd_24h_change: 3.7, stale: true, src: 'seed' },
  'ETH': { usd: 3870, usd_24h_change: -1.2, stale: true, src: 'seed' },
  'SOL': { usd: 178, usd_24h_change: 6.1, stale: true, src: 'seed' },
  'DOGE': { usd: 0.16, usd_24h_change: -0.5, stale: true, src: 'seed' },
  'XRP': { usd: 0.52, usd_24h_change: 1.1, stale: true, src: 'seed' }
};

/* ── The last good coin list ─────────────────────────────────────────
   The 150-coin universe (names, logos, market caps) used to exist only
   after CoinGecko answered. CoinGecko's keyless API rate-limits per IP, and
   when it did, the trading desk shrank to the dozen coins the Binance
   stream subscribes to by default. The last good list is kept here and
   shown straight away; its prices are marked stale until the Binance
   stream or CoinGecko replaces them, and stale prices can't be traded. */
const CG_CACHE_KEY = 'ts_cg_markets_v1';
const CG_CACHE_MAX_AGE = 7 * 864e5;

function saveMarketCache(data) {
  try {
    const coins = data.map(c => ({
      s: String(c.symbol || '').toUpperCase(), n: c.name, i: c.image, m: c.market_cap,
      p: c.current_price, c: c.price_change_percentage_24h,
      k: c.sparkline_in_7d && Array.isArray(c.sparkline_in_7d.price)
        ? c.sparkline_in_7d.price.filter((_, i) => i % 6 === 0).map(v => +Number(v).toPrecision(6))
        : null
    })).filter(c => c.s && c.p > 0);
    localStorage.setItem(CG_CACHE_KEY, JSON.stringify({ at: Date.now(), coins }));
  } catch (e) { /* storage full or unavailable — the live list still works */ }
}

function hydrateMarketCache() {
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem(CG_CACHE_KEY) || 'null'); } catch (e) {}
  if (!cache || !Array.isArray(cache.coins) || !cache.coins.length) return false;
  if (Date.now() - (cache.at || 0) > CG_CACHE_MAX_AGE) return false;
  const cur = window.liveCryptoPrices || {};
  const next = {};
  cache.coins.forEach(c => {
    if (!c || typeof c.s !== 'string' || !(c.p > 0)) return;
    const prev = cur[c.s] || {};
    const liveNow = prev.src === 'binance' && !prev.stale;
    next[c.s] = {
      ...prev,
      usd: liveNow ? prev.usd : c.p,
      usd_24h_change: liveNow ? prev.usd_24h_change : c.c,
      change24h: liveNow ? prev.change24h : c.c,
      name: c.n, image: c.i, mcap: c.m, spark: c.k,
      stale: !liveNow, src: liveNow ? 'binance' : 'cache', at: liveNow ? prev.at : cache.at
    };
  });
  Object.keys(cur).forEach(s => { if (!next[s] && cur[s].live) next[s] = cur[s]; });
  window.liveCryptoPrices = next;
  return true;
}

hydrateMarketCache();
window.liveBtcPrice = window.liveCryptoPrices['BTC'] ? window.liveCryptoPrices['BTC'].usd : 0;

// Consecutive failed price fetches, used to back the poll off (see below).
let cryptoFailures = 0;

/**
 * Fetches real-time cryptocurrency prices from CoinGecko API.
 * This provides 100% accurate, real-time market data including the actual 24h change.
 */
/* ── ONE REPAINT PATH FOR NEW PRICES ───────────────────────────────
   Called by the CoinGecko poll and by the live Binance stream, so a
   price arriving either way updates exactly the same surfaces. */
window.onMarketTick = function() {
    // Update UI components
    if (typeof window.renderCryptoHub === 'function' && document.getElementById('cat-dynamic-content')) {
      const activeTab = document.querySelector('.crypto-tab-btn.active');
      if (activeTab && activeTab.dataset.tab === 'markets') {
        window.renderCryptoHub('markets');
      }
    }
    
    // Update our new dynamic portal UI if active
    if (typeof updateCryptoPortalUI === 'function') {
      updateCryptoPortalUI();
    }
    
    if (typeof updateWalletUI === 'function') updateWalletUI();

    // Fill any resting limit orders the market has moved through, then
    // refresh the desk / portfolio if either is on screen.
    if (typeof TR !== 'undefined') {
      TR.matchOpenOrders();
      // Repaint only what a price move changes; a full desk rebuild would
      // wipe the live book and tape and steal focus from the order form.
      if (TR.onPriceTick) TR.onPriceTick(); else TR.repaint();
    }

    // Price alerts and any due recurring buys ride the same refresh.
    if (typeof CT !== 'undefined') CT.onPriceTick();

    // Live price cards sitting in chat threads get patched in place.
    if (typeof CFI !== 'undefined') CFI.onPriceTick();

    // Staking interest, pool rewards and copy P&L accrue on the same tick.
    if (typeof EN !== 'undefined') EN.onPriceTick();

    // Home's portfolio snapshot, market pulse and Earn shelf.
    if (typeof HC !== 'undefined') HC.onPriceTick();
    if (typeof HX !== 'undefined') HX.onPriceTick();

    // Crypto Market: patch the visible prices, never rebuild the page.
    if (typeof CMP !== 'undefined') CMP.onPriceTick();

    // Refresh the home-feed Global Markets ticker with the fresh prices
    if (typeof renderUniversalTicker === 'function') renderUniversalTicker();
    
    if (typeof calculatePayouts === 'function' && document.getElementById('calc-views-lbl')) {
       const slider = document.querySelector('input[oninput*="calculatePayouts"]');
       if (slider) calculatePayouts(slider.value);
    }
};

async function fetchCryptoPrices() {
  try {
    // Using CoinGecko's public free API which doesn't require a key and provides real 24h change!
    // sparkline=true gives real 7-day price series, used by the token pages.
    // price_change_percentage adds 1h/7d/30d to the same response, so the
    // Crypto Market's time filters cost no extra request.
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=150&page=1&sparkline=true&price_change_percentage=1h,24h,7d,30d';
    const response = await fetch(url, { method: 'GET' });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    
    if (data && data.length > 0) {
      // Merge rather than replace. The Binance stream is seconds fresh and
      // CoinGecko is up to a minute behind, so a streamed price wins; this
      // pass is here for names, logos, market caps, the 7-day series and
      // every coin the stream doesn't carry.
      const prevAll = window.liveCryptoPrices || {};
      const next = {};

      data.forEach(coin => {
        // CoinGecko returns symbol in lowercase (e.g. 'btc'), we capitalize it
        const symbol = coin.symbol.toUpperCase();
        const series = coin.sparkline_in_7d && Array.isArray(coin.sparkline_in_7d.price)
          ? coin.sparkline_in_7d.price
          : null;
        const prev = prevAll[symbol] || {};
        const streamed = prev.live && prev.src === 'binance' && !prev.stale && (Date.now() - (prev.at || 0) < 60000);

        next[symbol] = {
          ...prev,
          usd: streamed ? prev.usd : coin.current_price,
          usd_24h_change: streamed ? prev.usd_24h_change : coin.price_change_percentage_24h,
          change24h: streamed ? prev.change24h : coin.price_change_percentage_24h,
          name: coin.name,
          image: coin.image,
          mcap: coin.market_cap,
          // Kept for the Crypto Market: charts need the id, the rest feed
          // the screener, heatmap, movers and coin pages.
          id: coin.id,
          rank: coin.market_cap_rank,
          vol: coin.total_volume,
          high24: coin.high_24h,
          low24: coin.low_24h,
          ch1h: coin.price_change_percentage_1h_in_currency,
          ch7d: coin.price_change_percentage_7d_in_currency,
          ch30d: coin.price_change_percentage_30d_in_currency,
          ath: coin.ath,
          athPct: coin.ath_change_percentage,
          atl: coin.atl,
          atlPct: coin.atl_change_percentage,
          supply: coin.circulating_supply,
          totalSupply: coin.total_supply,
          maxSupply: coin.max_supply,
          stale: false,
          fb: false,
          src: streamed ? 'binance' : 'coingecko',
          at: streamed ? prev.at : Date.now(),
          // Thin 168 hourly points down to ~56 — plenty for a sparkline.
          spark: series ? series.filter((_, i) => i % 3 === 0) : null
        };
      });

      // Anything the stream carries that CoinGecko's top-150 doesn't list.
      // Coins the Binance backup added (`fb`) give way to CoinGecko's list.
      Object.keys(prevAll).forEach(sym => { if (!next[sym] && prevAll[sym].live && !prevAll[sym].fb) next[sym] = prevAll[sym]; });
      window.liveCryptoPrices = next;
      
      // Update global BTC price reference for wallet
      if (window.liveCryptoPrices['BTC']) {
        window.liveBtcPrice = window.liveCryptoPrices['BTC'].usd;
      }
      
      console.log('✅ Real-time CoinGecko crypto prices updated:', Object.keys(window.liveCryptoPrices).length, 'coins.');
      saveMarketCache(data);
      // Coins that arrived after the stream opened get live prices too.
      if (typeof MD !== 'undefined' && MD.resubscribe) MD.resubscribe();
      
      window.onMarketTick();
    }
    cryptoFailures = 0;
  } catch (error) {
    cryptoFailures++;
    // Prices are left at their last good values rather than blanked.
    console.warn(`⚠️ Failed to fetch CoinGecko live prices (attempt ${cryptoFailures}).`, error);
    binanceFallback();
  }
}

/* ── Binance as the backup price source ──────────────────────────────
   One public request returns 24h prices for every Binance USDT pair. It
   refreshes whatever the list already holds, and if there is no list at
   all (first visit while CoinGecko is refusing) it builds one from the
   most-traded pairs, so the desk is never down to a handful of coins. */
let binanceFallbackAt = 0;
async function binanceFallback() {
  if (Date.now() - binanceFallbackAt < 55000) return;
  binanceFallbackAt = Date.now();
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    const cur = window.liveCryptoPrices || (window.liveCryptoPrices = {});
    const now = Date.now();
    const extra = [];
    rows.forEach(r => {
      const sym = String(r.symbol || '');
      if (!sym.endsWith('USDT')) return;
      const base = sym.slice(0, -4);
      if (!base || /(UP|DOWN|BULL|BEAR)$/.test(base)) return;
      const px = parseFloat(r.lastPrice), ch = parseFloat(r.priceChangePercent), vol = parseFloat(r.quoteVolume);
      // Delisted pairs linger in this list with no trades.
      if (!(px > 0) || !(Number(r.count) > 0) || now - Number(r.closeTime || 0) > 36e5) return;
      const row = cur[base];
      if (row) {
        const streaming = row.src === 'binance' && !row.stale && now - (row.at || 0) < 60000;
        if (streaming) return;
        Object.assign(row, { usd: px, usd_24h_change: ch, change24h: ch, vol24h: vol, stale: false, src: 'binance', at: now });
      } else if (!/^(USDC|FDUSD|TUSD|BUSD|USDP|DAI|EUR|AEUR|EURI|XUSD|BFUSD)$/.test(base)
                 // Only symbols that read as a ticker, and not stock tokens TokenMarkets already lists.
                 && (/^[A-Z0-9]{1,15}$/.test(base) || base === '币安人生')
                 && !(window.TokenMarkets && TokenMarkets.isStock && TokenMarkets.isStock(base))) {
        extra.push({ base, px, ch, vol });
      }
    });
    const named = Object.keys(cur).filter(s => cur[s].name).length;
    if (named < 30) {
      extra.sort((a, b) => b.vol - a.vol).slice(0, Math.max(0, 150 - Object.keys(cur).length)).forEach(x => {
        cur[x.base] = { usd: x.px, usd_24h_change: x.ch, change24h: x.ch, vol24h: x.vol, stale: false, src: 'binance', at: now, fb: true };
      });
    }
    if (cur.BTC) window.liveBtcPrice = cur.BTC.usd;
    console.log('🟡 CoinGecko unavailable — prices from Binance for', Object.keys(cur).length, 'coins.');
    if (typeof MD !== 'undefined' && MD.resubscribe) MD.resubscribe();
    if (typeof window.onMarketTick === 'function') window.onMarketTick();
  } catch (e) { /* both sources down: last known prices stay, marked stale */ }
}

function updateCryptoPortalUI() {
  const portal = document.getElementById('cat-dynamic-content');
  if (!portal || !document.querySelector('.material-symbols-rounded.emoji-3d[style*="color:#00ffcc"]')) {
    return; // Not on the crypto portal
  }

  const formatPrice = (val) => {
    if (val < 0.01) return '$' + val.toFixed(6);
    return '$' + val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  };
  
  const formatChange = (val) => {
    if (!val) return '0.0%';
    const sign = val >= 0 ? '+' : '';
    const arrow = val >= 0 ? '↑' : '↓';
    const color = val >= 0 ? '#00ffcc' : '#ff6b6b';
    return `<span style="color:${color}">${sign}${val.toFixed(1)}% ${arrow}</span>`;
  };

  // Get all coins directly from the live state
  const allCoins = Object.keys(window.liveCryptoPrices);

  // api.js loads before engine.js, so resolve the icon helper defensively.
  const ci = window.coinIcon || (() => '');

  let rowsHtml = '';
  allCoins.forEach(coin => {
    const data = window.liveCryptoPrices[coin];
    rowsHtml += `
      <div class="flex-between mb12 pb12" style="border-bottom:1px solid #ffffff15">
        <div class="flex gap12 align-center">
          ${ci(coin, 36)}
          <div><div class="fs12 tc-3">${coin}/USD</div><div class="fw8 fs16" style="color:#00ffcc">${formatPrice(data.usd)}</div></div>
        </div>
        <div class="tc-right"><div class="fs12 tc-3">24h</div><div class="fw8 fs14">${formatChange(data.usd_24h_change)}</div></div>
      </div>
    `;
  });

  portal.innerHTML = `
      <div class="grid-2 mb16">
        <div class="card p20" style="background:linear-gradient(135deg,#0a0a1a,#1a0b2e); border:1px solid #00ffcc33; max-height: 600px; overflow-y: auto;">
          <div class="flex-between mb16" style="position: sticky; top: -20px; background: #1a0b2e; z-index: 10; padding: 10px 0; border-bottom: 1px solid #00ffcc44;">
            <h3 class="fw8 tc-1 m0"><span class="material-symbols-rounded emoji-3d" style="color:#00ffcc">currency_bitcoin</span> Live Markets (150+ Coins)</h3>
            <span class="fs11" style="background:#00ffcc22; color:#00ffcc; padding:4px 8px; border-radius:4px">Live Sync</span>
          </div>
          
          <div class="crypto-list">
            ${rowsHtml}
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">notifications_active</span> Crypto Alerts</h3>
          <div class="flex-col gap12">
            <div style="padding:12px; border-left:3px solid var(--green); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs13 tc-1">Whale Alert: 5,000 BTC moved to cold storage</div>
              <div class="fs11 tc-3">2 min ago • Blockchain scanner</div>
            </div>
            <div style="padding:12px; border-left:3px solid var(--orange); background:var(--card2); border-radius:4px 8px 8px 4px">
              <div class="fw7 fs13 tc-1">DeFi Protocol TVL surpasses $90B</div>
              <div class="fs11 tc-3">18 min ago • DeFi Pulse</div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm w100 mt12" onclick="showToast('Setting up price alerts...')">⚡ Set Alerts</button>
        </div>
      </div>
  `;
}

// Initial fetch, then poll on an interval.
// 30s is about as tight as CoinGecko's free tier is worth polling: its own
// aggregation only refreshes every minute or two, and the public endpoint
// rate-limits per IP, so going lower buys staler-but-more-frequent data.
const CRYPTO_POLL_MS = 60000;
const CRYPTO_MAX_BACKOFF_MS = 300000;   // 5 min ceiling

/* Self-scheduling rather than setInterval: a slow response can't stack up
   overlapping requests, and repeated failures (a 429, or offline) back off
   exponentially instead of hammering the endpoint every 30s. Resets to the
   normal cadence on the first success. */
function scheduleCryptoPoll() {
  const delay = cryptoFailures
    ? Math.min(CRYPTO_POLL_MS * Math.pow(2, cryptoFailures), CRYPTO_MAX_BACKOFF_MS)
    : CRYPTO_POLL_MS;
  setTimeout(async () => {
    await fetchCryptoPrices();
    scheduleCryptoPoll();
  }, delay);
}

document.addEventListener('DOMContentLoaded', () => {
  fetchCryptoPrices();
  scheduleCryptoPoll();
});

// Fetch live news using Google News RSS converted via RSS2JSON
/* ── CRYPTO HEADLINES ──────────────────────────────────────────────
   The Cryptoverse news strip used to run through Google News search,
   which answers 422 or 500 for perfectly good queries once you've asked
   a few times — so the section kept coming up empty. Publishers' own
   RSS feeds don't have that problem. All four are read at once, whatever
   answers is merged newest-first, and the last good set is kept for 20
   minutes so a rate-limited minute still shows real headlines.        */
window.fetchCryptoNews = async function(limit) {
  const FEEDS = [
    ['CoinDesk',         'https://www.coindesk.com/arc/outboundfeeds/rss/'],
    ['Cointelegraph',    'https://cointelegraph.com/rss'],
    ['Decrypt',          'https://decrypt.co/feed'],
    ['Bitcoin Magazine', 'https://bitcoinmagazine.com/.rss/full/']
  ];
  const KEY = 'ts_news_cache';
  const MAX_AGE = 20 * 60 * 1000;
  const want = limit || 8;

  const cached = () => {
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || 'null');
      return (c && Array.isArray(c.items) && c.items.length) ? c : null;
    } catch (e) { return null; }
  };

  const fresh = cached();
  if (fresh && Date.now() - fresh.t < MAX_AGE) return fresh.items.slice(0, want);

  const read = async ([source, url]) => {
    const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url));
    const json = await res.json();
    if (!json || json.status !== 'ok' || !Array.isArray(json.items)) throw new Error(source + ' unavailable');
    return json.items.map(it => {
      const when = it.pubDate ? new Date(String(it.pubDate).replace(' ', 'T') + 'Z') : new Date();
      return {
        id: source + ':' + (it.guid || it.link),
        title: String(it.title || '').trim(),
        excerpt: String(it.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 170),
        url: it.link,
        source,
        author: it.author || source,
        publishedAt: (isNaN(when) ? new Date() : when).toISOString(),
        thumbnail: it.thumbnail || (it.enclosure && it.enclosure.link) || ''
      };
    }).filter(a => a.title && a.url);
  };

  const settled = await Promise.all(FEEDS.map(f => read(f).catch(() => [])));
  const seen = {}, items = [];
  settled.forEach(list => list.forEach(a => {
    const k = a.title.toLowerCase();
    if (!seen[k]) { seen[k] = 1; items.push(a); }
  }));
  items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  if (items.length) {
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), items: items.slice(0, 24) })); } catch (e) {}
    return items.slice(0, want);
  }
  // Every feed refused: stale real headlines beat an empty section.
  const stale = cached();
  return stale ? stale.items.slice(0, want) : [];
};

window.fetchLiveNews = async function(query) {
  // Offline placeholders shown when the live news feed is unreachable.
  // Attributed to the app itself — never to a real publication — and flagged
  // as samples so they can't be mistaken for real reporting.
  const topic = (query || 'technology').trim().split(/\s+/).slice(0, 3).join(' ');
  const getFallbackNews = () => [
    {
      id: `news-fallback-1`,
      title: `Sample: what's developing in ${topic}`,
      excerpt: `Live headlines are unavailable right now. This is placeholder copy shown in place of the ${topic} feed — reconnect to load real coverage.`,
      url: '#',
      author: 'Trending (offline sample)',
      source: 'Trending (offline sample)',
      isSample: true,
      publishedAt: new Date().toISOString(),
      thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: `news-fallback-2`,
      title: `Sample: market context for ${topic}`,
      excerpt: `Placeholder entry displayed while the news service is offline. No live ${topic} data was retrieved for this card.`,
      url: '#',
      author: 'Trending (offline sample)',
      source: 'Trending (offline sample)',
      isSample: true,
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=400&q=80'
    }
  ];

  // The bridge is fussy: the same query answers 200 one minute and 422 the
  // next, and it dislikes the locale parameters. Try the plain form and a
  // shorter query before giving up on live headlines.
  const words = String(query || '').trim().split(/\s+/);
  const attempts = [
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}`,
    `https://news.google.com/rss/search?q=${encodeURIComponent(words.slice(0, 2).join(' '))}`
  ];

  try {
    let data = null;
    for (const rssUrl of attempts) {
      try {
        const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
        const json = await response.json();
        if (json && json.status === 'ok' && json.items && json.items.length) { data = json; break; }
      } catch (e) { /* try the next shape */ }
    }

    if (data && data.status !== 'error' && data.items && data.items.length > 0) {
      return data.items.map((item, index) => ({
        id: `news-${Date.now()}-${index}`,
        title: item.title,
        excerpt: item.description ? item.description.replace(/<[^>]+>/g, '').substring(0, 120) + '...' : 'Click to read more.',
        url: item.link,
        author: item.source || 'Global News',
        source: item.source || 'Global News',
        publishedAt: item.pubDate,
        thumbnail: item.thumbnail || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=400&q=80'
      }));
    }
    console.warn('News API rate limit hit or no items returned. Using fallback data.');
    return getFallbackNews();
  } catch (err) {
    console.error('Error fetching live news:', err);
    return getFallbackNews();
  }
};

function updateWalletUI() {
  const walletHeader = document.querySelector('.section-title .material-symbols-rounded[style*="color:var(--orange)"]');
  if (!walletHeader || walletHeader.textContent !== 'account_balance_wallet') return;
  
  // We are in the wallet tab
  const btc = window.liveCryptoPrices.bitcoin;
  const eth = window.liveCryptoPrices.ethereum;
  const sol = window.liveCryptoPrices.solana;
  
  const btcBalance = 0.142;
  const ethBalance = 4.2;
  const solBalance = 145.5;
  
  const formatPrice = (val) => '$' + val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' USD';
  
  const cards = document.querySelectorAll('.grid-3 .card.text-center');
  if (cards.length >= 3) {
    if (btc && btc.usd) cards[0].innerHTML = `<div class="fs11 tc-3">BTC Balance</div><div class="fw8 tc-1 fs18 mt4">${btcBalance} BTC</div><div class="fs10 tc-green mt2">${formatPrice(btc.usd * btcBalance)} <span style="color:var(--t3);font-size:9px">(Live: $${btc.usd.toLocaleString()})</span></div>`;
    if (eth && eth.usd) cards[1].innerHTML = `<div class="fs11 tc-3">ETH Balance</div><div class="fw8 tc-1 fs18 mt4">${ethBalance} ETH</div><div class="fs10 tc-green mt2">${formatPrice(eth.usd * ethBalance)} <span style="color:var(--t3);font-size:9px">(Live: $${eth.usd.toLocaleString()})</span></div>`;
    if (sol && sol.usd) cards[2].innerHTML = `<div class="fs11 tc-3">SOL Balance</div><div class="fw8 tc-1 fs18 mt4">${solBalance} SOL</div><div class="fs10 tc-green mt2">${formatPrice(sol.usd * solBalance)} <span style="color:var(--t3);font-size:9px">(Live: $${sol.usd.toLocaleString()})</span></div>`;
  }
}

// ── ALISON AI ENGINE (GEMINI) ─────────────────────────────────────
/* The key is read at runtime and is deliberately NOT in the source.
   A key shipped in client-side JavaScript is readable by anyone who
   opens the page, so it is compromised the moment it is deployed —
   putting it in git as well only adds a copy nobody can delete.

   To use one locally:  localStorage.setItem('ts_gemini_key', '...')
   With none set, askAlison below falls back to Simulation Mode, which
   is a path this file already handled. */
window.GEMINI_API_KEY = window.GEMINI_API_KEY || (() => {
  try { return localStorage.getItem('ts_gemini_key') || ''; } catch (e) { return ''; }
})();

window.askAlison = async function(promptText, context = "general") {
  if (!window.GEMINI_API_KEY || window.GEMINI_API_KEY.trim() === "") {
    return "Hi! I am Alison, your new AI Copilot! 🌟 I'm currently in 'Simulation Mode' because I don't have my Google API Key yet. Once you paste my key into the system, I'll be fully awake and ready to help you analyze crypto, write posts, and multitask!";
  }

  // This is where we "train" Alison using a System Prompt
  const systemInstruction = `You are Alison, the highly advanced AI Copilot for the 'Trending' platform. 
Your goal is to assist users with multitasking, reasoning, content creation, and data analysis.
Your personality: Brilliant, enthusiastic, helpful, and slightly witty. Use emojis naturally.
Current Context: The user is asking you something related to '${context}'.
Always provide concise, highly actionable, and accurate responses.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${window.GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          { parts: [{ text: promptText }] }
        ]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    
    return data.candidates[0].content.parts[0].text;
  } catch (err) {
    console.error("Alison AI Error:", err);
    return "Oops! I ran into a bit of a glitch while thinking. Could you try asking me that again? 😅";
  }
};

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
publish('utils/api.js', {
  CG_CACHE_KEY: () => CG_CACHE_KEY,
  CG_CACHE_MAX_AGE: () => CG_CACHE_MAX_AGE,
  saveMarketCache: () => saveMarketCache,
  hydrateMarketCache: () => hydrateMarketCache,
  cryptoFailures: () => cryptoFailures,
  fetchCryptoPrices: () => fetchCryptoPrices,
  binanceFallbackAt: () => binanceFallbackAt,
  binanceFallback: () => binanceFallback,
  updateCryptoPortalUI: () => updateCryptoPortalUI,
  CRYPTO_POLL_MS: () => CRYPTO_POLL_MS,
  CRYPTO_MAX_BACKOFF_MS: () => CRYPTO_MAX_BACKOFF_MS,
  scheduleCryptoPoll: () => scheduleCryptoPoll,
  updateWalletUI: () => updateWalletUI
});
