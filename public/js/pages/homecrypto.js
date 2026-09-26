/* ╔══════════════════════════════════════════════════════════════════╗
   ║  HOME CRYPTO — the Earn shelf beside the home feed                ║
   ║                                                                  ║
   ║  The best practice rates, one tap into Earn - the one crypto     ║
   ║  thing Home doesn't already show at the top.                     ║
   ║                                                                  ║
   ║  This file used to add three more surfaces, and each repeated    ║
   ║  something already on screen:                                    ║
   ║   · a shortcut row (Trade, Earn, Pay, P2P, Convert, Wallet,      ║
   ║     Assets) under the dashboard that already has Add Funds,      ║
   ║     P2P, Send and markets, with the menu beside it for the rest  ║
   ║   · an Assets card whose figure was the trading account alone,   ║
   ║     next to the dashboard's total of every account               ║
   ║   · a Market Pulse list of gainers, the same list as the         ║
   ║     dashboard's Gainers tab                                      ║
   ║  so they are gone. The row's slot (#hc-rail, in feeds.js) is     ║
   ║  left empty rather than editing the feed.                        ║
   ║                                                                  ║
   ║  openCoin() stays: Notes uses it to open a coin on the desk.     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const HC = (() => {

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const ic = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');
  const hasTR = () => typeof TR !== 'undefined';

  function usd(v) {
    if (!v && v !== 0) return '$0.00';
    const a = Math.abs(v);
    if (a > 0 && a < 0.01) return (v < 0 ? '-$' : '$') + a.toFixed(6);
    return (v < 0 ? '-$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ── Opening a coin ───────────────────────────────────────────── */
  /* Only route symbols the desk can actually price — the same guard the
     Cryptoverse learned the hard way. */
  function openCoin(sym) {
    const s = String(sym || '').toUpperCase();
    if (hasTR() && TR.isTradable(s)) { TR.setPair(s); navigateTo('trade'); return; }
    if (typeof showToast === 'function') showToast(`${s} has no live price right now.`);
  }

  /* ── Earn shelf ───────────────────────────────────────────────── */
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
    if (rail && rail.innerHTML) rail.innerHTML = '';

    const side = document.getElementById('hc-side');
    if (side) side.innerHTML = earnHTML();
  }

  /* Home is often the visible pane when the poll lands, so keep it fresh. */
  function onPriceTick() {
    if (document.getElementById('hc-side')) paint();
  }

  return { paint, onPriceTick, openCoin };
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
