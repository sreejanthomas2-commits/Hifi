/* Tokenized-stock discovery and explicit USD quote rates. No synthetic prices.

   Each token is shown with the real exchange ticker it tracks. That ticker
   comes only from LISTED below — a table of listings checked by hand — so a
   token this file can't match shows no underlying rather than a guess. */
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

window.TokenMarkets = (() => {
  const catalog = {AAPLX:'Apple xStock',NVDAX:'NVIDIA xStock',TSLAX:'Tesla xStock',GOOGLX:'Alphabet xStock',AMZNX:'Amazon xStock',COINX:'Coinbase xStock'};

  /* Real listings: ticker → [company, exchange]. Checked 16 Sep 2026.
     The four 2026 listings were confirmed against the issuers' own
     announcements: SpaceX (Nasdaq, 12 Jun), Securitize (NYSE, 2 Jul),
     Bending Spoons (Nasdaq, 1 Jul), SK Hynix ADRs (Nasdaq, 10 Jul). */
  const LISTED = {
    AAPL: ['Apple Inc.', 'Nasdaq'],               MSFT: ['Microsoft Corp.', 'Nasdaq'],
    NVDA: ['NVIDIA Corp.', 'Nasdaq'],             TSLA: ['Tesla, Inc.', 'Nasdaq'],
    AMZN: ['Amazon.com, Inc.', 'Nasdaq'],         GOOGL: ['Alphabet Inc. Class A', 'Nasdaq'],
    META: ['Meta Platforms, Inc.', 'Nasdaq'],     AMD: ['Advanced Micro Devices', 'Nasdaq'],
    AVGO: ['Broadcom Inc.', 'Nasdaq'],            INTC: ['Intel Corp.', 'Nasdaq'],
    MU: ['Micron Technology', 'Nasdaq'],          MRVL: ['Marvell Technology', 'Nasdaq'],
    QCOM: ['Qualcomm Inc.', 'Nasdaq'],            SNDK: ['Sandisk Corp.', 'Nasdaq'],
    COIN: ['Coinbase Global', 'Nasdaq'],          HOOD: ['Robinhood Markets', 'Nasdaq'],
    MSTR: ['Strategy Inc', 'Nasdaq'],             STRC: ['Strategy Inc Stretch Preferred', 'Nasdaq'],
    SOFI: ['SoFi Technologies', 'Nasdaq'],        PDD: ['PDD Holdings (ADS)', 'Nasdaq'],
    NBIS: ['Nebius Group', 'Nasdaq'],             AAOI: ['Applied Optoelectronics', 'Nasdaq'],
    MRNA: ['Moderna, Inc.', 'Nasdaq'],            BNC: ['CEA Industries', 'Nasdaq'],
    CURR: ['CURRENC Group', 'Nasdaq'],            SPCX: ['SpaceX', 'Nasdaq'],
    BSP: ['Bending Spoons', 'Nasdaq'],            SKHY: ['SK Hynix (ADR)', 'Nasdaq'],
    NFLX: ['Netflix, Inc.', 'Nasdaq'],            PLTR: ['Palantir Technologies', 'Nasdaq'],
    QQQ: ['Invesco QQQ Trust', 'Nasdaq'],         COST: ['Costco Wholesale', 'Nasdaq'],
    ADBE: ['Adobe Inc.', 'Nasdaq'],               CSCO: ['Cisco Systems', 'Nasdaq'],
    PEP: ['PepsiCo, Inc.', 'Nasdaq'],             ARM: ['Arm Holdings (ADS)', 'Nasdaq'],
    CRCL: ['Circle Internet Group', 'NYSE'],      SECZ: ['Securitize Corp.', 'NYSE'],
    HIMS: ['Hims & Hers Health', 'NYSE'],         TSM: ['Taiwan Semiconductor (ADR)', 'NYSE'],
    ORCL: ['Oracle Corp.', 'NYSE'],               LLY: ['Eli Lilly and Co.', 'NYSE'],
    KO: ['Coca-Cola Co.', 'NYSE'],                LMT: ['Lockheed Martin', 'NYSE'],
    BABA: ['Alibaba Group (ADR)', 'NYSE'],        GME: ['GameStop Corp.', 'NYSE'],
    AMC: ['AMC Entertainment', 'NYSE'],           JPM: ['JPMorgan Chase', 'NYSE'],
    V: ['Visa Inc.', 'NYSE'],                     MA: ['Mastercard Inc.', 'NYSE'],
    DIS: ['Walt Disney Co.', 'NYSE'],             MCD: ['McDonald’s Corp.', 'NYSE'],
    RDDT: ['Reddit, Inc.', 'NYSE'],               BMNR: ['BitMine Immersion Technologies', 'NYSE American'],
    SPY: ['SPDR S&P 500 ETF Trust', 'NYSE Arca'], GLD: ['SPDR Gold Shares', 'NYSE Arca']
  };

  /* CoinGecko ids are stable and name the company first, so they are the
     primary match. Order matters where one company has several securities. */
  const BY_ID = [
    [/^strategy-(pp-variable|stretch-preferred|inc-var-rt)/, 'STRC'],
    [/^(microstrategy|strategy-inc|strategy-tokenized)/, 'MSTR'],
    [/^apple-/, 'AAPL'], [/^microsoft-/, 'MSFT'], [/^nvidia-/, 'NVDA'], [/^tesla-/, 'TSLA'],
    [/^amazon-/, 'AMZN'], [/^alphabet-/, 'GOOGL'], [/^meta-/, 'META'], [/^amd-/, 'AMD'],
    [/^broadcom-/, 'AVGO'], [/^intel-/, 'INTC'], [/^micron-technology-/, 'MU'], [/^marvell-/, 'MRVL'],
    [/^qualcomm-/, 'QCOM'], [/^sandisk-/, 'SNDK'], [/^(backed-)?coinbase-/, 'COIN'], [/^robinhood-/, 'HOOD'],
    [/^circle-/, 'CRCL'], [/^sofi-/, 'SOFI'], [/^pdd-/, 'PDD'], [/^nebius-/, 'NBIS'],
    [/^applied-optoelectronics-/, 'AAOI'], [/^moderna-/, 'MRNA'], [/^bitmine-/, 'BMNR'],
    [/^cea-industries/, 'BNC'], [/^currenc-/, 'CURR'], [/^hims-/, 'HIMS'],
    [/^(taiwan-semiconductor|tsmc)-/, 'TSM'], [/^oracle-/, 'ORCL'], [/^eli-lilly-/, 'LLY'],
    [/^coca-cola-/, 'KO'], [/^lockheed-/, 'LMT'], [/^alibaba-/, 'BABA'], [/^gamestop-/, 'GME'],
    [/^amc-entertainment-/, 'AMC'], [/^spacex-/, 'SPCX'], [/^bending-spoons-/, 'BSP'],
    [/^sk-hynix-/, 'SKHY'], [/^securitize/, 'SECZ'], [/^netflix-/, 'NFLX'], [/^palantir-/, 'PLTR']
  ];

  /* Tokens of companies that have no exchange listing at all. */
  const UNLISTED = [
    [/^draggable-aktionariat/, 'Aktionariat AG — private Swiss company, not exchange-listed']
  ];

  /* The issuer's product name, as CoinGecko itself labels the token. */
  function issuerOf(id, name) {
    const s = (id + ' ' + name).toLowerCase();
    if (/xstock/.test(s)) return 'xStocks';
    if (/ondo/.test(s)) return 'Ondo';
    if (/bstock/.test(s)) return 'bStocks';
    if (/rstock/.test(s)) return 'rStocks';
    if (/robinhood token|robinhood-token|robinhood-tokenized-stock/.test(s)) return 'Robinhood';
    if (/coinbase tokenized|coinbase-tokenized/.test(s)) return 'Coinbase';
    if (/backpack securities/.test(s)) return 'Backpack';
    if (/reality protocol/.test(s)) return 'Reality Protocol';
    if (/^backed-/.test(id)) return 'Backed';
    return '';
  }

  /* Fallback for tokens not in BY_ID yet: strip the issuer's affix from the
     symbol, and accept the result only when it is a real listing whose
     company name also appears in the token's name. */
  function derive(sym, name) {
    const s = String(sym).toUpperCase();
    const tries = [s, s.replace(/X$/, ''), s.replace(/ON$/, ''), s.replace(/B$/, ''), s.replace(/C$/, ''), s.replace(/^R/, ''), s.replace(/^B/, '')];
    const n = String(name || '').toLowerCase();
    for (const t of tries) {
      const hit = LISTED[t];
      if (hit && n.includes(hit[0].split(/[\s,.(]/)[0].toLowerCase())) return t;
    }
    return '';
  }

  let stocks = {}, quotes = {}, loading = false, error = '', stockUpdated = 0, quoteUpdated = 0;

  /* Names, ids and logos outlive the 10-minute price window — a logo is
     never "stale" — and are kept between visits so they paint at once. */
  const META_KEY = 'ts_token_meta_v1';
  let meta = {};
  try { meta = JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; } catch (e) { meta = {}; }
  const saveMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {} };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeImg = u => (/^https:\/\/[^\s"'<>]+$/.test(String(u || '')) ? String(u) : '');
  const fresh = t => Date.now() - t < 10 * 60 * 1000;
  const prices = () => ({... (fresh(quoteUpdated) ? quotes : {}), ...(fresh(stockUpdated) ? stocks : {})});
  async function read(url) {
    const r = await fetch(url, {signal: AbortSignal.timeout(15000)});
    if (!r.ok) throw Error('Market provider unavailable (' + r.status + ')');
    const data = await r.json();
    if (!Array.isArray(data)) throw Error('Invalid market response');
    return data;
  }
  async function refresh() {
    if (loading) return;
    loading = true; error = '';
    const base = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd';
    // USDC and USD1 are in the main coin list; only ask for them when that
    // list has no fresh price — one request fewer against the rate limit.
    const main = window.liveCryptoPrices || {};
    const haveRates = ['USDC', 'USD1'].every(q => main[q] && !main[q].stale && main[q].usd > 0);
    const results = await Promise.allSettled([
      read(base + '&category=tokenized-stock&order=market_cap_desc&per_page=100&page=1'),
      haveRates ? Promise.resolve(['USDC', 'USD1'].map(q => ({ id: q, symbol: q.toLowerCase(), name: main[q].name || q, current_price: main[q].usd, price_change_percentage_24h: main[q].usd_24h_change || 0, image: main[q].image })))
                : read(base + '&ids=usd-coin,usd1-wlfi')
    ]);
    const normalize = rows => Object.fromEntries(rows.filter(r => /^[a-zA-Z0-9-]{1,24}$/.test(r.symbol) && Number.isFinite(r.current_price) && r.current_price > 0).map(r => [r.symbol.toUpperCase(), {id:r.id,name:r.name,usd:r.current_price,usd_24h_change:r.price_change_percentage_24h || 0,image:safeImg(r.image)}]));
    if (results[0].status === 'fulfilled') {
      stocks = normalize(results[0].value); stockUpdated = Date.now();
      Object.entries(stocks).forEach(([sym, c]) => { meta[sym] = { id: c.id, name: c.name, image: c.image }; });
      saveMeta();
    }
    else error = 'Tokenized-stock prices are unavailable. Please retry.';
    if (results[1].status === 'fulfilled') { quotes = normalize(results[1].value); quoteUpdated = Date.now(); }
    // Preserve each response's timestamp; failed refreshes must not renew old data.
    loading = false;
    if (window.CV) window.CV.paint();
    if (window.TR) window.TR.repaint();
  }

  /* Everything the UI shows about a token, independent of price freshness.
     `underlying` is null unless the ticker is in LISTED. */
  const infoCache = {};
  function info(sym) {
    const s = String(sym || '').toUpperCase();
    const m = stocks[s] || meta[s] || (catalog[s] ? { id: '', name: catalog[s], image: '' } : null);
    if (!m) return null;
    const key = s + '|' + m.id + '|' + m.name + '|' + m.image;
    if (infoCache[s] && infoCache[s].key === key) return infoCache[s].value;

    const id = String(m.id || '');
    let ticker = (BY_ID.find(([re]) => re.test(id)) || [])[1] || derive(s, m.name);
    // An id match still has to name a real listing.
    if (ticker && !LISTED[ticker]) ticker = '';
    const unlisted = (UNLISTED.find(([re]) => re.test(id)) || [])[1] || '';
    const value = {
      sym: s, id, name: m.name, image: safeImg(m.image),
      issuer: issuerOf(id, m.name),
      underlying: ticker ? { ticker, company: LISTED[ticker][0], exchange: LISTED[ticker][1] } : null,
      unlisted
    };
    infoCache[s] = { key, value };
    return value;
  }

  /* One short line for lists: "AAPL · Nasdaq · xStocks". */
  function tagline(sym) {
    const i = info(sym);
    if (!i) return '';
    if (i.underlying) return [i.underlying.ticker, i.underlying.exchange, i.issuer].filter(Boolean).join(' · ');
    if (i.unlisted) return 'Private company · no ticker';
    return i.issuer ? i.issuer + ' · underlying not verified' : 'Underlying not verified';
  }

  /* Search should find a token by the stock it tracks, not only its symbol. */
  function matches(sym, q) {
    const i = info(sym);
    if (!i || !q) return false;
    const hay = [i.name, i.issuer, i.underlying && i.underlying.ticker, i.underlying && i.underlying.company].filter(Boolean).join(' ').toUpperCase();
    return hay.includes(String(q).toUpperCase());
  }

  function open(sym) {
    if (window.TR?.setPair(sym)) navigateTo('trade');
  }
  function html() {
    const rows = fresh(stockUpdated) && Object.keys(stocks).length ? Object.entries(stocks) : Object.entries(catalog).map(([s,name]) => [s,{name,usd:null}]);
    const icon = s => (typeof coinIcon === 'function' ? coinIcon(s, 32) : '');
    return `<div class="cv-sec"><div class="section-hdr"><span class="section-title">Tokenized Stocks</span><button class="btn btn-sm" onclick="TokenMarkets.refresh()">Refresh</button></div>
      <p class="tc-3 fs12 mb12">Discover tokenized equities · USD reference prices · Paper spot trading</p>
      ${!fresh(stockUpdated) ? `<p role="status" class="tc-3 fs12">${loading ? 'Loading prices…' : esc(error || 'Prices unavailable. Refresh to retry.')} Trading requires a current price.</p>` : ''}
      <div class="cv-trend">${rows.slice(0,24).map(([sym,c]) => {
        const i = info(sym);
        const und = i && i.underlying;
        return `<button type="button" class="cv-trend-card tm-card" style="text-align:left;color:inherit" ${c.usd ? `onclick="TokenMarkets.open('${esc(sym)}')"` : 'disabled'}>
          ${icon(sym)}
          <div class="cv-trend-main">
            <div class="cv-trend-sym">${esc(sym)}${und ? `<span class="tm-und" title="${esc(und.company)} · ${esc(und.exchange)}">${esc(und.ticker)}</span>` : ''}</div>
            <div class="cv-trend-name">${esc(und ? und.company : c.name)}</div>
            <div class="tm-meta">${esc([und ? und.exchange : (i && i.unlisted ? 'Not exchange-listed' : ''), i && i.issuer].filter(Boolean).join(' · '))}</div>
          </div>
          <span class="tm-px">${c.usd ? '$'+c.usd.toLocaleString('en-US',{maximumFractionDigits:4}) : 'Price unavailable'}</span></button>`;
      }).join('')}</div>
      <p class="tc-3 fs11">Source: <a href="https://www.coingecko.com/en/categories/tokenized-stock" target="_blank" rel="noopener noreferrer">CoinGecko</a>. The badge shows the real exchange ticker each token tracks. Tokens are distinct from directly held company shares.</p></div>`;
  }
  // After the main coin list's first request, so the two don't land together.
  setTimeout(refresh, 3500);
  setInterval(refresh, 5 * 60 * 1000);
  return {prices, refresh, html, open, catalog, info, tagline, matches, LISTED, stamp: () => stockUpdated + ':' + quoteUpdated + ':' + fresh(stockUpdated) + fresh(quoteUpdated), isStock:sym => Object.hasOwn(stocks,sym) || Object.hasOwn(catalog,sym)};
})();

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
publish('features/token-markets.js', {});
