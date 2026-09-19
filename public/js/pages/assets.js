/* ╔══════════════════════════════════════════════════════════════════╗
   ║  ASSETS — every balance in the app, in one place                 ║
   ║                                                                  ║
   ║  Five tabs, each one an account that already exists:             ║
   ║    Overview — everything added up, with the day's move           ║
   ║    Earn     — staking, copy trading and pools (EN)               ║
   ║    Spot     — the paper trading account (TR): cash and holdings  ║
   ║    Futures  — not part of Trending; the tab says so plainly      ║
   ║    Funding  — the social wallet tips, P2P and Pay settle through ║
   ║                                                                  ║
   ║  Nothing here moves real money. Values come from the live price  ║
   ║  feed; local-currency amounts use P2P's indicative rate and are  ║
   ║  labelled as approximate.                                        ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const AS = (() => {

  const KEY = 'ts_assets_v1';
  const HIST = 'ts_assets_hist_v1';
  const DEF = { tab: 'overview', hide: false, fiat: 'USD' };
  let U = load();

  const TABS = [['overview', 'Overview'], ['earn', 'Earn'], ['spot', 'Spot'], ['futures', 'Futures'],
                ['funding', 'Funding'], ['transfer', 'Transfer'], ['history', 'History']];

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      return { ...DEF, ...(raw && typeof raw === 'object' ? raw : {}) };
    } catch (e) { return { ...DEF }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(U)); } catch (e) {} }

  const $ = id => document.getElementById(id);
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
  const attr = s => esc(JSON.stringify(String(s)));
  const ico = n => `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
  const icon = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');
  const tick = s => (typeof tickerOf === 'function' ? tickerOf(s) : s);
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const hasTR = () => typeof TR !== 'undefined';
  const hasEN = () => typeof EN !== 'undefined';
  const hasMNY = () => typeof MNY !== 'undefined';
  const live = () => ({ ...(window.liveCryptoPrices || {}), ...((window.TokenMarkets && TokenMarkets.prices()) || {}) });
  const chOf = c => (c ? (c.change24h ?? c.usd_24h_change ?? 0) || 0 : 0);
  /* Prices, names and rows all come from MNY now. This page and the
     Wallet tab used to value the same coins differently. */
  const priceOf = s => (hasMNY() ? MNY.price(s) : (s === 'USDT' ? 1 : ((live()[s] || {}).usd || 0)));
  const nameOf = s => (hasMNY() ? MNY.nameOf(s) : ((live()[s] || {}).name || (s === 'USDT' ? 'TetherUS' : s)));
  const onPage = () => !!$('pf-root');

  /* ── Money ───────────────────────────────────────────────────────── */
  function usd(v, dp) {
    const a = Math.abs(v || 0), d = dp != null ? dp : 2;
    return (v < 0 ? '-$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  const signed = v => (v >= 0 ? '+' : '-') + usd(Math.abs(v)).replace('-', '');
  const pct = v => (v >= 0 ? '+' : '') + (v || 0).toFixed(2) + '%';
  function qty(v) {
    if (!v) return '0';
    const a = Math.abs(v);
    return v.toLocaleString('en-US', { maximumFractionDigits: a >= 1000 ? 2 : a >= 1 ? 6 : 8 });
  }
  const FIATS = () => (typeof P2P !== 'undefined' && P2P.FIAT) || { USD: { symbol: '$', rate: 1, name: 'US Dollar' } };
  function localCode() {
    const F = FIATS();
    if (U.fiat && F[U.fiat]) return U.fiat;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (/Calcutta|Kolkata/.test(tz) && F.INR) return 'INR';
      if (/Lagos/.test(tz) && F.NGN) return 'NGN';
      if (/Dubai/.test(tz) && F.AED) return 'AED';
      if (/Sao_Paulo/.test(tz) && F.BRL) return 'BRL';
      if (/London/.test(tz) && F.GBP) return 'GBP';
    } catch (e) {}
    return 'USD';
  }
  /* The figure people read at the top, in whichever currency is picked. */
  function money(v) {
    if (U.hide) return '******';
    const code = localCode();
    if (code === 'USD') return usd(v);
    const f = FIATS()[code];
    const dp = f.rate > 100 ? 0 : 2;
    return (v < 0 ? '-' : '') + f.symbol + Math.abs(v * f.rate).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  const sub = v => (U.hide ? '****' : money(v));

  /* ── The accounts ────────────────────────────────────────────────── */
  /* Spot: the paper trading account. Cash is a balance like any other. */
  function spotRows() {
    if (!hasMNY()) return [];
    return MNY.rows('spot').map(r => ({ ...r, where: 'Spot' }));
  }
  /* Funding: the wallet tips, chat crypto, P2P and Pay settle through. */
  function fundingRows() {
    if (!hasMNY()) return [];
    return MNY.rows('funding').map(r => ({ ...r, where: 'Funding' }));
  }
  function earnTotals() {
    if (!hasEN()) return { total: 0, staked: 0, copy: 0, pool: 0, accrued: 0, apy: 0 };
    return {
      total: EN.totalEarning() || 0,
      staked: EN.stakedValue ? EN.stakedValue() : 0,
      copy: EN.copyValue ? EN.copyValue() : 0,
      pool: EN.poolValue ? EN.poolValue() : 0,
      accrued: EN.accruedValue ? EN.accruedValue() : 0,
      apy: EN.blendedApy ? EN.blendedApy() : 0
    };
  }
  /* Only what the app can price. A coin with no market shows its
     quantity and stays out of the total rather than counting as zero. */
  const sum = rows => rows.reduce((t, r) => t + (r.priced === false ? 0 : r.val), 0);
  const unpricedCount = rows => rows.filter(r => r.priced === false).length;

  function totals() {
    const spot = spotRows(), funding = fundingRows(), earn = earnTotals();
    return { spot, funding, earn, futures: 0, spotVal: sum(spot), fundingVal: sum(funding), total: sum(spot) + sum(funding) + earn.total };
  }

  /* The day's move: what the coins you hold did over 24h. Cash doesn't
     move, so a mostly-cash balance correctly shows a small percentage. */
  function dayMove(rows) {
    if (hasMNY()) return MNY.dayMove(rows);
    const L = live();
    let now = 0, then = 0;
    rows.forEach(r => {
      if (r.cash || r.sym === 'USDT') return;
      const c = L[r.sym];
      if (!c) return;
      now += r.val;
      then += r.val / (1 + chOf(c) / 100);
    });
    const abs = now - then;
    return { abs, pct: then > 0 ? (abs / then) * 100 : 0 };
  }

  /* ── A line of the balance over time ─────────────────────────────── */
  /* Nothing recorded the balance before, so the chart starts the first
     time this page opens and fills in as the value changes. */
  function history(push) {
    let h = [];
    try { h = JSON.parse(localStorage.getItem(HIST) || '[]'); } catch (e) { h = []; }
    if (!Array.isArray(h)) h = [];
    if (push != null && isFinite(push)) {
      const last = h[h.length - 1];
      if (!last || Date.now() - last.t > 18e5 || Math.abs(push - last.v) > Math.max(1, last.v * 0.002)) {
        h.push({ t: Date.now(), v: +push.toFixed(2) });
        h = h.slice(-80);
        try { localStorage.setItem(HIST, JSON.stringify(h)); } catch (e) {}
      }
    }
    return h;
  }
  function sparkHTML(h) {
    if (h.length < 4) return '';
    const v = h.map(p => p.v);
    const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
    const w = 96, ht = 34;
    const pts = v.map((x, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(ht - 2 - (x - lo) / span * (ht - 4)).toFixed(1)}`).join(' ');
    const up = v[v.length - 1] >= v[0];
    return `<svg class="as-spark ${up ? 'up' : 'dn'}" viewBox="0 0 ${w} ${ht}" width="${w}" height="${ht}" aria-hidden="true" preserveAspectRatio="none">
      <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  /* ── Hero ────────────────────────────────────────────────────────── */
  function heroHTML(t) {
    const rows = t.spot.concat(t.funding);
    const mv = dayMove(rows);
    const code = localCode();
    const h = history(t.total);
    return `<section class="as-hero">
      <div class="as-hero-top">
        <button type="button" class="as-eye" onclick="AS.hide()" aria-pressed="${U.hide}" aria-label="${U.hide ? 'Show balances' : 'Hide balances'}">
          <span>Est. Total Value</span>${ico(U.hide ? 'visibility_off' : 'visibility')}</button>
      </div>
      <div class="as-hero-row">
        <div class="as-total" id="as-total">${money(t.total)}<button type="button" class="as-cur" onclick="AS.currency()" aria-label="Change currency">${esc(code)}${ico('expand_more')}</button></div>
        ${sparkHTML(h)}
      </div>
      <button type="button" class="as-pnl" onclick="AS.go('spot')">
        <span class="as-pnl-l">Today's PNL</span>
        <b class="${mv.abs >= 0 ? 'up' : 'dn'}">${U.hide ? '****' : `${signed(mv.abs)} (${pct(mv.pct)})`}</b>${ico('chevron_right')}
      </button>
      ${code !== 'USD' ? `<div class="as-approx">≈ ${esc(FIATS()[code].name || code)} at P2P's indicative rate · balances are simulated</div>`
        : '<div class="as-approx">Simulated balances · no real money moves</div>'}
    </section>`;
  }

  const ACTIONS = [
    ['add', 'Add Funds', 'south'],
    ['send', 'Send', 'north'],
    ['transfer', 'Transfer', 'swap_horiz'],
    ['earn', 'Earn', 'savings']
  ];
  const actionsHTML = () => `<div class="as-acts">${ACTIONS.map(([k, l, i]) =>
    `<button type="button" class="as-act" onclick="AS.act(${attr(k)})"><span class="as-act-ic">${ico(i)}</span><span>${esc(l)}</span></button>`).join('')}</div>`;

  function act(k) {
    if (k === 'add') {
      if (typeof HX !== 'undefined' && HX.addFunds) HX.addFunds();
      else go('spot');
      return;
    }
    if (k === 'send') {
      // Send opens the three ways money leaves: a Trending user, an
      // outside wallet, or a P2P sale. Add Funds covers the way in.
      if (typeof WD !== 'undefined' && WD.open) WD.open('ETH');
      else if (typeof PAY !== 'undefined' && PAY.openHub) PAY.openHub();
      else toast('Payments are still loading…');
      return;
    }
    if (k === 'transfer') { go('transfer'); return; }
    if (k === 'earn') navigateTo('earn');
  }

  /* ── Allocation ──────────────────────────────────────────────────── */
  const SLICES = [['spot', 'Spot', '#7C5CFF'], ['earn', 'Earn', '#F0B90B'], ['funding', 'Funding', '#2EBD85']];
  function allocHTML(t) {
    const vals = { spot: t.spotVal, earn: t.earn.total, funding: t.fundingVal };
    if (t.total <= 0) return '';
    const parts = SLICES.map(([k, l, c]) => ({ k, l, c, share: (vals[k] / t.total) * 100 })).filter(p => p.share > 0.05);
    return `<section class="as-card as-alloc">
      <div class="as-card-h"><b>Allocation</b><span class="as-card-note">by account</span></div>
      <div class="as-bar">${parts.map(p => `<span style="width:${p.share}%; background:${p.c}" title="${esc(p.l)} ${p.share.toFixed(1)}%"></span>`).join('')}</div>
      <div class="as-legend">${parts.map(p => `<span><i style="background:${p.c}"></i>${esc(p.l)} ${p.share.toFixed(1)}%</span>`).join('')}</div>
    </section>`;
  }

  /* ── Balance rows ────────────────────────────────────────────────── */
  /* Overview shows a coin once, with its accounts added together. The
     P&L still measures only the part bought on the Spot desk. */
  function mergeRows(rows) {
    const by = new Map();
    rows.forEach(r => {
      const cur = by.get(r.sym);
      if (!cur) {
        by.set(r.sym, { ...r, pnlQty: r.avgCost > 0 ? r.qty : 0, avail: r.cash ? r.qty : 0 });
        return;
      }
      cur.qty += r.qty;
      cur.val += r.val;
      if (r.avgCost > 0) { cur.avgCost = r.avgCost; cur.px = r.px; cur.pnlQty = (cur.pnlQty || 0) + r.qty; }
      if (r.cash) { cur.cash = true; cur.avail = (cur.avail || 0) + r.qty; }
    });
    return [...by.values()].sort((a, b) => b.val - a.val);
  }

  function rowHTML(r, opts) {
    const o = opts || {};
    const pnlQty = r.pnlQty != null ? r.pnlQty : r.qty;
    const pnl = r.avgCost > 0 && pnlQty > 0 ? (r.px - r.avgCost) * pnlQty : null;
    const pnlPct = r.avgCost > 0 ? ((r.px - r.avgCost) / r.avgCost) * 100 : 0;
    /* Converting needs a live market on both sides, which is a different
       question from whether the desk lists a pair for it. */
    const canCv = typeof CVT !== 'undefined' && CVT.canConvert(r.sym);
    return `<div class="as-row">
      <div class="as-row-main">
        <span class="as-row-id">${icon(r.sym, 34)}<span><b>${esc(tick(r.sym))}</b><em>${esc(nameOf(r.sym))}</em></span></span>
        <span class="as-row-num"><b>${U.hide ? '****' : qty(r.qty)}</b><em>${r.priced === false ? 'no market price' : sub(r.val)}</em></span>
      </div>
      ${pnl !== null ? `<div class="as-row-pnl"><span>Unrealized PNL</span><b class="${pnl >= 0 ? 'up' : 'dn'}">${U.hide ? '****' : `${signed(pnl)} (${pct(pnlPct)})`}</b></div>` : ''}
      ${r.cash ? `<div class="as-row-pnl"><span>Available to trade</span><b class="tc-2">${sub(r.avail != null ? r.avail : r.val)}</b></div>` : ''}
      ${o.noActions ? '' : `<div class="as-row-a">
        <button type="button" class="as-mini" onclick="navigateTo('earn')">Earn</button>
        <button type="button" class="as-mini as-mini-go"${canCv
          ? ` onclick="AS.convert(${attr(r.sym)})"`
          : ` disabled title="${esc(typeof CVT !== 'undefined' ? CVT.whyNot(r.sym) : 'No live price for this coin')}"`}>Convert</button>
      </div>`}
    </div>`;
  }
  /* One tap from a balance row to turning it into another coin. The row
     used to offer "Trade", which meant the order book: pick a pair, a
     side and a price to do something that is not a trading decision. */
  function convert(sym) {
    if (typeof CVT === 'undefined') { toast('Convert is still loading…'); return; }
    if (!CVT.canConvert(sym)) { toast(CVT.whyNot(sym)); return; }
    CVT.open(sym);
  }

  function trade(sym) {
    if (!hasTR() || !TR.isTradable(sym)) { toast(`${tick(sym)} has no live price right now.`); return; }
    TR.setPair(sym);
    navigateTo('trade');
  }

  function listHTML(title, rows, opts) {
    const o = opts || {};
    return `<section class="as-card">
      <div class="as-card-h"><b>${esc(title)}</b>${o.right || `<span class="as-card-note">${rows.length} asset${rows.length === 1 ? '' : 's'}</span>`}</div>
      ${rows.length ? rows.map(r => rowHTML(r, o)).join('') : `<div class="as-empty">${esc(o.empty || 'Nothing here yet.')}</div>`}
    </section>`;
  }

  /* ── Tabs ────────────────────────────────────────────────────────── */
  function overview(t) {
    const rows = mergeRows(t.spot.concat(t.funding));
    const un = unpricedCount(rows);
    return heroHTML(t) + actionsHTML() + allocHTML(t) +
      (un ? `<div class="as-approx">${un} holding${un === 1 ? '' : 's'} ${un === 1 ? 'has' : 'have'} no market price. ${un === 1 ? 'It is' : 'They are'} listed below but left out of the total.</div>` : '') +
      (t.earn.total > 0 ? `<button type="button" class="as-card as-jump" onclick="AS.go('earn')">
         <span class="as-jump-ic" style="color:#F0B90B">${ico('savings')}</span>
         <span class="as-jump-t"><b>Earning</b><em>${esc(t.earn.apy ? t.earn.apy.toFixed(1) + '% blended APY' : 'Staking, copy trading and pools')}</em></span>
         <span class="as-jump-v">${sub(t.earn.total)}</span>${ico('chevron_right')}</button>` : '') +
      listHTML('Balance', rows, { empty: 'No balances yet. Add funds to get started.' });
  }

  function earnTab(t) {
    const e = t.earn;
    const E = hasEN() ? EN.state : null;
    const counts = E ? [
      ['Staking', (E.stakes || []).filter(s => s.active !== false).length, e.staked],
      ['Copy trading', (E.copies || []).filter(c => c.active !== false).length, e.copy],
      ['Pools', (E.pools || []).length, e.pool]
    ] : [];
    return `<section class="as-hero as-hero-sm">
        <div class="as-hero-top"><span>At work in Earn</span></div>
        <div class="as-total">${sub(e.total)}</div>
        <div class="as-chips">
          <span class="as-chip">Accrued <b class="up">${sub(e.accrued)}</b></span>
          <span class="as-chip">Blended APY <b>${e.apy ? e.apy.toFixed(1) + '%' : '—'}</b></span>
        </div>
      </section>
      <section class="as-card">
        <div class="as-card-h"><b>Positions</b></div>
        ${counts.length && e.total > 0
          ? counts.map(([l, n, v]) => `<div class="as-line"><span>${esc(l)}<em>${n} open</em></span><b>${sub(v)}</b></div>`).join('')
          : '<div class="as-empty">Nothing staked yet. Earn pays interest on idle coins — nothing here is a real investment.</div>'}
        <button type="button" class="btn btn-primary w100 mt12" onclick="navigateTo('earn')">Open Earn</button>
      </section>`;
  }

  function spotTab(t) {
    const T = hasTR() ? TR.state : null;
    if (!T) return '<div class="as-empty">The trading account is still loading…</div>';
    const un = TR.unrealized();
    return `<section class="as-hero as-hero-sm">
        <div class="as-hero-top"><span>Spot account</span></div>
        <div class="as-total">${sub(t.spotVal)}</div>
        <div class="as-chips">
          <span class="as-chip">Cash <b>${sub(T.cash)}</b></span>
          <span class="as-chip">Unrealised <b class="${un >= 0 ? 'up' : 'dn'}">${sub(un)}</b></span>
          <span class="as-chip">Realised <b class="${T.realized >= 0 ? 'up' : 'dn'}">${sub(T.realized)}</b></span>
          <span class="as-chip">Fees <b>${sub(T.feesPaid)}</b></span>
        </div>
      </section>
      ${listHTML('Balance', t.spot, { empty: 'No spot balance yet. Transfer something in below.' })}
      ${transferBoxHTML()}`;
  }

  function futuresTab() {
    return `<section class="as-hero as-hero-sm">
        <div class="as-hero-top"><span>Futures account</span></div>
        <div class="as-total">${sub(0)}</div>
      </section>
      <section class="as-card">
        <div class="as-empty as-empty-big">
          ${ico('candlestick_chart')}
          <b>Trending has no futures desk</b>
          <p>There is no leverage, margin or perpetual trading in the app, so this account stays empty. Spot trading and Earn are where your balances live.</p>
          <div class="as-empty-a">
            <button type="button" class="btn btn-primary btn-sm" onclick="navigateTo('trade')">Go to Spot</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="AS.go('spot')">See spot balance</button>
          </div>
        </div>
      </section>`;
  }

  function fundingTab(t) {
    return `<section class="as-hero as-hero-sm">
        <div class="as-hero-top"><span>Funding account</span></div>
        <div class="as-total">${sub(t.fundingVal)}</div>
        <div class="as-approx">Tips, P2P orders and Pay settle through this wallet.</div>
      </section>
      ${listHTML('Balance', t.funding, { empty: 'This wallet is empty.' })}
      <section class="as-card">
        <div class="as-card-h"><b>Move money</b></div>
        <div class="as-line-a">
          <button type="button" class="btn btn-ghost btn-sm" onclick="AS.go('transfer')">Transfer to Spot</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="navigateTo('p2p')">Buy or sell on P2P</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="AS.act('send')">Send or request</button>
        </div>
      </section>`;
  }

  /* ── Transfer between Funding and Spot ───────────────────────────── */
  /* Any asset. It used to move the quote currency only, so a coin that
     arrived in Funding — a tip, a payment, a gift packet — could never
     reach the trading desk. */
  function move(dir) {
    const el = $('pf-amt');
    const sel = $('pf-coin');
    const v = el ? el.value : '';
    const sym = sel ? sel.value : 'USDT';
    if (!hasMNY()) return;
    const r = dir === 'in'
      ? MNY.transfer(sym, v, 'funding', 'spot')
      : MNY.transfer(sym, v, 'spot', 'funding');
    toast(r.msg);
    if (r.ok && el) el.value = '';
    paint();
  }

  /* Which coins the transfer box offers: whatever is in either account. */
  function transferCoins() {
    if (!hasMNY()) return ['USDT'];
    const out = [];
    MNY.holdings().forEach(r => { if (r.priced) out.push(r.sym); });
    if (!out.length) out.push('USDT');
    return out;
  }

  function transferBoxHTML(note) {
    const coins = transferCoins();
    const cur = U.txCoin && coins.indexOf(U.txCoin) > -1 ? U.txCoin : coins[0];
    return `<section class="as-card">
      <div class="as-card-h"><b>Transfer</b><span class="as-card-note">Funding &#8644; Spot</span></div>
      <div class="as-transfer">
        <label class="form-label" for="pf-amt">Amount</label>
        <div class="as-transfer-row">
          <select class="input" id="pf-coin" onchange="AS.txCoin(this.value)">
            ${coins.map(c => `<option value="${esc(c)}"${c === cur ? ' selected' : ''}>${esc(tick(c))}</option>`).join('')}
          </select>
          <input class="input" id="pf-amt" type="number" step="any" inputmode="decimal" placeholder="0.00">
        </div>
        <div class="as-transfer-bal">Funding ${esc(qty(MNY.balanceOf(cur, 'funding')))} &middot; Spot ${esc(qty(MNY.balanceOf(cur, 'spot')))}</div>
        <div class="as-transfer-a">
          <button type="button" class="btn btn-primary" onclick="AS.move('in')">To Spot</button>
          <button type="button" class="btn btn-ghost" onclick="AS.move('out')">To Funding</button>
        </div>
      </div>
      ${note ? `<div class="as-approx">${esc(note)}</div>` : ''}
    </section>`;
  }

  function txCoin(v) { U.txCoin = v; save(); paint(); }

  function transferTab() {
    return `<section class="as-hero as-hero-sm">
        <div class="as-hero-top"><span>Move money between accounts</span></div>
        <div class="as-chips">
          <span class="as-chip">Funding <b>${sub(sum(fundingRows()))}</b></span>
          <span class="as-chip">Spot <b>${sub(sum(spotRows()))}</b></span>
        </div>
      </section>
      ${transferBoxHTML('Funding is what payments, tips, chat crypto and P2P spend from. Spot is the trading account.')}
      ${historyTab()}`;
  }

  /* ── History ─────────────────────────────────────────────────────── */
  /* The ledger MNY writes on every move — one place to see where money
     went, which the app had nowhere to show before. */
  function historyTab() {
    const rows = hasMNY() ? MNY.ledger(60) : [];
    if (!rows.length) {
      return `<section class="as-card"><div class="as-card-h"><b>History</b></div>
        <div class="as-empty">Nothing yet. Payments, tips, swaps and transfers between accounts all show up here.</div></section>`;
    }
    const when = t => {
      const d = Math.max(0, (Date.now() - t) / 1000);
      if (d < 60) return 'just now';
      if (d < 3600) return Math.floor(d / 60) + 'm ago';
      if (d < 86400) return Math.floor(d / 3600) + 'h ago';
      return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    const label = e => e.kind === 'transfer' ? `${e.from} to ${e.to}`
      : e.kind === 'tip' ? 'Tip sent'
      : e.kind === 'swap' ? (e.dir === 'in' ? 'Swap received' : 'Swap paid')
      : e.dir === 'in' ? 'Received' : 'Sent';
    return `<section class="as-card">
      <div class="as-card-h"><b>History</b><span class="as-card-note">${rows.length} movement${rows.length === 1 ? '' : 's'}</span></div>
      ${rows.map(e => `<div class="as-line as-hline">
        <span>${esc(label(e))}<em>${esc([e.via, e.kind === 'transfer' ? '' : (e.to || e.from), when(e.t)].filter(Boolean).join(' \u00b7 '))}</em></span>
        <b class="${e.dir === 'move' ? '' : e.dir === 'in' ? 'up' : 'dn'}">${e.dir === 'move' ? '' : e.dir === 'in' ? '+' : '-'}${esc(qty(e.qty))} ${esc(tick(e.sym))}</b>
      </div>`).join('')}
    </section>`;
  }

  /* ── Paint ───────────────────────────────────────────────────────── */
  function tabsHTML() {
    return `<div class="as-tabs" role="tablist" aria-label="Accounts">${TABS.map(([k, l]) =>
      `<button type="button" role="tab" aria-selected="${U.tab === k}" class="${U.tab === k ? 'on' : ''}" onclick="AS.go(${attr(k)})">${l}</button>`).join('')}</div>`;
  }

  function paint() {
    const root = $('pf-root');
    if (!root) return;
    // Keep what is being typed in the transfer box across repaints.
    const amt = $('pf-amt');
    const keep = amt ? { v: amt.value, focus: document.activeElement === amt, s: amt.selectionStart } : null;

    const t = totals();
    const body = U.tab === 'earn' ? earnTab(t)
      : U.tab === 'spot' ? spotTab(t)
      : U.tab === 'futures' ? futuresTab()
      : U.tab === 'funding' ? fundingTab(t)
      : U.tab === 'transfer' ? transferTab()
      : U.tab === 'history' ? historyTab()
      : overview(t);
    root.innerHTML = tabsHTML() + `<div class="as-body">${body}</div>`;

    const again = $('pf-amt');
    if (keep && again) {
      again.value = keep.v;
      if (keep.focus) { again.focus({ preventScroll: true }); try { again.setSelectionRange(keep.s, keep.s); } catch (e) {} }
    }
  }

  function go(tab) {
    if (!TABS.some(t => t[0] === tab)) return;
    U.tab = tab; save();
    paint();
    const root = $('pf-root');
    const on = root && root.querySelector('.as-tabs .on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function hide() { U.hide = !U.hide; save(); paint(); }
  /* USD or the local currency P2P prices its ads in. */
  function currency() {
    const F = FIATS();
    const codes = Object.keys(F);
    const here = localCode();
    const guess = codes.find(c => c !== 'USD' && c === here) || (typeof P2P !== 'undefined' && P2P.state && P2P.state.fiat !== 'USD' ? P2P.state.fiat : 'INR');
    U.fiat = here === 'USD' ? (F[guess] ? guess : codes[1] || 'USD') : 'USD';
    save();
    paint();
  }

  function onPriceTick() { if (onPage()) paint(); }

  const repaint = () => { if (onPage()) paint(); };

  return { paint, repaint, onPriceTick, go, hide, currency, act, trade, convert, move, txCoin, get state() { return U; } };
})();

window.AS = AS;
