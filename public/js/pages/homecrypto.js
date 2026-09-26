/* ╔══════════════════════════════════════════════════════════════════╗
   ║  HOME CRYPTO — the fast lane on the home feed                    ║
   ║                                                                  ║
   ║  Four surfaces, all read-only shortcuts into services that       ║
   ║  already exist. Nothing here holds state or moves value:         ║
   ║                                                                  ║
   ║   1. Quick rail    — one tap into Trade, Earn, P2P, Convert,     ║
   ║                      Wallet and Portfolio                        ║
   ║   2. Portfolio     — real equity off the TR ledger, with the     ║
   ║                      day's move and your top holdings            ║
   ║   3. Market pulse  — live Fear & Greed plus the day's movers     ║
   ║   4. Earn shelf    — the best rates on offer, one tap to stake   ║
   ║                                                                  ║
   ║  Stories, the composer and the post feed are deliberately        ║
   ║  untouched — this module only owns the rail and the sidebar      ║
   ║  cards it injects.                                               ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const HC = (() => {

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const ic = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');
  const hasTR = () => typeof TR !== 'undefined';
  const live = () => window.liveCryptoPrices || {};

  function usd(v) {
    if (!v && v !== 0) return '$0.00';
    const a = Math.abs(v);
    if (a > 0 && a < 0.01) return (v < 0 ? '-$' : '$') + a.toFixed(6);
    return (v < 0 ? '-$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const pct = v => (v >= 0 ? '+' : '') + (v || 0).toFixed(2) + '%';
  const chOf = c => (c ? (c.change24h || c.usd_24h_change || 0) : 0);

  /* ── 1. Quick rail ───────────────────────────────────────────────── */
  const ACTIONS = [
    { label: 'Trade',     icon: 'candlestick_chart', color: '#8A6400', go: () => navigateTo('trade') },
    { label: 'Earn',      icon: 'savings',           color: '#F0B90B', go: () => navigateTo('earn') },
    { label: 'Pay',       icon: 'qr_code_scanner',   color: '#EC6CB9', go: () => openPay() },
    { label: 'P2P',       icon: 'swap_horiz',        color: '#26A69A', go: () => navigateTo('p2p') },
    { label: 'Convert',   icon: 'sync_alt',          color: '#42A5F5', go: () => openConvert() },
    { label: 'Wallet',    icon: 'account_balance_wallet', color: '#FF7043', go: () => openWallet() },
    { label: 'Assets',    icon: 'account_balance_wallet', color: '#00BFA5', go: () => navigateTo('portfolio') }
  ];

  function openConvert() {
    if (typeof CT !== 'undefined') CT.open('convert');
    else navigateTo('trade');
  }

  /* QR payments and requests — scan, show your code, or ask to be paid. */
  function openPay() {
    if (typeof PAY !== 'undefined') PAY.openHub();
    else if (typeof showToast === 'function') showToast('Payments are still loading…');
  }

  /* Nothing connected yet means the useful action is the chooser; once a
     wallet is attached the useful action is seeing it. */
  function openWallet() {
    if (typeof WL !== 'undefined' && !WL.isConnected()) { WL.openChooser(); return; }
    /* Profile loads on demand, so the tab switch waits for it. */
    navigateTo('profile').then(() => {
      if (typeof switchProfileTab === 'function') switchProfileTab('wallet');
    });
  }

  function act(i) {
    const a = ACTIONS[i];
    if (a) a.go();
  }

  function railHTML() {
    return `<div class="hc-rail">
      ${ACTIONS.map((a, i) => `
        <button class="hc-act" onclick="HC.act(${i})" title="${esc(a.label)}">
          <span class="hc-act-ic material-symbols-rounded" style="color:${a.color}">${a.icon}</span>
          <span>${esc(a.label)}</span>
        </button>`).join('')}
    </div>`;
  }

  /* ── 2. Portfolio snapshot ───────────────────────────────────────── */
  /* The day's move is the holdings' own 24h change — cash doesn't move,
     so a mostly-cash book correctly shows a small percentage. */
  function dayMove() {
    if (!hasTR()) return { abs: 0, pct: 0 };
    const h = TR.state.holdings || {};
    let now = 0, then = 0;
    Object.keys(h).forEach(sym => {
      const c = live()[sym];
      if (!c) return;
      const value = h[sym].qty * c.usd;
      const ch = chOf(c);
      now += value;
      then += value / (1 + ch / 100);
    });
    const abs = now - then;
    return { abs, pct: then > 0 ? (abs / then) * 100 : 0 };
  }

  function portfolioHTML() {
    if (!hasTR()) return '';
    const eq = TR.equity();
    const mv = dayMove();
    const h = TR.state.holdings || {};

    const rows = Object.keys(h)
      .map(sym => ({ sym, qty: h[sym].qty, val: h[sym].qty * TR.priceOf(sym) }))
      .filter(r => r.val > 0)
      .sort((a, b) => b.val - a.val)
      .slice(0, 3);

    const body = rows.length
      ? rows.map(r => {
          const ch = chOf(live()[r.sym]);
          return `<div class="hc-hold">
            <span class="hc-hold-n">${ic(r.sym, 16)} ${esc(typeof tickerOf === 'function' ? tickerOf(r.sym) : r.sym)}</span>
            <span class="hc-hold-v">${usd(r.val)}</span>
            <span class="${ch >= 0 ? 'tc-green' : 'tc-red'} hc-hold-c">${pct(ch)}</span>
          </div>`;
        }).join('')
      : `<div class="hc-empty">No positions yet — your balance is all cash.</div>`;

    return `<div class="trend-card mb12">
      <div class="section-hdr">
        <span class="section-title" style="display:flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:#00BFA5">account_balance_wallet</span> Assets</span>
        <span class="section-link" onclick="navigateTo('portfolio')">Open</span>
      </div>
      <div class="hc-eq">${usd(eq)}</div>
      <div class="hc-eq-sub">
        <span class="${mv.abs >= 0 ? 'tc-green' : 'tc-red'}">${usd(mv.abs)} (${pct(mv.pct)})</span>
        <span class="tc-3">today</span>
      </div>
      <div class="hc-holds">${body}</div>
      <div class="flex gap8 mt12">
        <button class="btn btn-primary btn-sm" style="flex:1" onclick="navigateTo('trade')">Trade</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="navigateTo('earn')">Earn</button>
      </div>
    </div>`;
  }

  /* ── 3. Market pulse ─────────────────────────────────────────────── */
  function pulseHTML() {
    const syms = Object.keys(live());
    const movers = syms
      .map(s => ({ s, ch: chOf(live()[s]), px: live()[s].usd }))
      .sort((a, b) => b.ch - a.ch);

    const top = movers.slice(0, 3);
    const bottom = movers.slice(-2).reverse();

    // Fear & Greed comes from FGI's own live fetch; absent until it lands.
    const fg = (typeof FGI !== 'undefined' && FGI.current) ? FGI.current : null;
    const bandC = fg && typeof FGI !== 'undefined' ? FGI.band(fg.value) : null;

    // Same dial as the Cryptoverse gauge, shrunk to sidebar size.
    const gauge = fg ? `
      <div class="hc-fg" onclick="navigateTo('explore')" title="Open the full gauge">
        <div class="hc-fg-dial">
          ${typeof FGI.miniHTML === 'function' ? FGI.miniHTML(fg.value) : ''}
        </div>
        <div>
          <div class="hc-fg-l ink" style="color:${bandC.color}">${esc(fg.label)}</div>
          <div class="fs11 tc-3">Fear &amp; Greed Index</div>
        </div>
      </div>` : `<div class="hc-empty">Fear &amp; Greed syncing…</div>`;

    const row = m => {
      const c = m.ch >= 0 ? 'tc-green' : 'tc-red';
      return `<div class="hc-mv" onclick="HC.openCoin('${esc(m.s)}')">
        <span class="hc-hold-n">${ic(m.s, 16)} ${esc(typeof tickerOf === 'function' ? tickerOf(m.s) : m.s)}</span>
        <span class="hc-hold-v">${usd(m.px)}</span>
        <span class="${c} hc-hold-c">${pct(m.ch)}</span>
      </div>`;
    };

    return `<div class="trend-card mb12">
      <div class="section-hdr">
        <span class="section-title" style="display:flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:#42A5F5">monitoring</span> Market Pulse</span>
        <span class="section-link" onclick="navigateTo('explore')">Cryptoverse</span>
      </div>
      ${gauge}
      ${syms.length ? `
        <div class="hc-mv-l">Top gainers</div>
        ${top.map(row).join('')}
        <div class="hc-mv-l">Lagging</div>
        ${bottom.map(row).join('')}`
      : '<div class="hc-empty">Waiting for live market data…</div>'}
    </div>`;
  }

  /* Only route symbols the desk can actually price — the same guard the
     Cryptoverse learned the hard way. */
  function openCoin(sym) {
    const s = String(sym || '').toUpperCase();
    if (hasTR() && TR.isTradable(s)) { TR.setPair(s); navigateTo('trade'); return; }
    if (typeof showToast === 'function') showToast(`${s} has no live price right now.`);
  }

  /* ── 4. Earn shelf ───────────────────────────────────────────────── */
  function earnHTML() {
    if (typeof EN === 'undefined') return '';
    const best = EN.PRODUCTS
      .filter(p => p.coin === 'USDT' || TR.isTradable(p.coin))
      .slice().sort((a, b) => b.apy - a.apy).slice(0, 3);

    const atWork = EN.totalEarning();

    return `<div class="trend-card mb12">
      <div class="section-hdr">
        <span class="section-title" style="display:flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:#F0B90B">savings</span> Earn</span>
        <span class="section-link" onclick="navigateTo('earn')">All rates</span>
      </div>
      <div class="fs11 tc-3" style="margin-bottom:6px">Practice products at sandbox rates: indicative, not offers, never guaranteed.</div>
      ${atWork > 0
        ? `<div class="hc-eq-sub" style="margin-bottom:8px">
             <span class="tc-1 fw7">${usd(atWork)}</span><span class="tc-3">at work</span></div>`
        : ''}
      ${best.map(p => `
        <div class="hc-earn" onclick="navigateTo('earn')">
          <span class="hc-hold-n">${ic(p.coin, 16)} ${esc(p.coin)}</span>
          <span class="fs11 tc-3">${p.type === 'locked' ? p.term + 'd lock' : 'Flexible'}</span>
          <span class="hc-apy">${p.apy}%</span>
        </div>`).join('')}
    </div>`;
  }

  /* ── Paint ───────────────────────────────────────────────────────── */
  function paint() {
    const rail = document.getElementById('hc-rail');
    if (rail) rail.innerHTML = railHTML();

    const side = document.getElementById('hc-side');
    if (side) side.innerHTML = portfolioHTML() + pulseHTML() + earnHTML();
  }

  /* Home is often the visible pane when the poll lands, so keep it fresh. */
  function onPriceTick() {
    if (document.getElementById('hc-side')) paint();
  }

  return { paint, onPriceTick, act, openCoin, ACTIONS };
})();

window.HC = HC;

/* Router hook — mirrors renderFeed/renderStories so the rail and sidebar
   paint on every visit to Home, not just the first. */
function renderHomeCrypto() { HC.paint(); }

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
publish('pages/homecrypto.js', {
  HC: () => HC, renderHomeCrypto: () => renderHomeCrypto
});
