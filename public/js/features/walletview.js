/* ╔══════════════════════════════════════════════════════════════════╗
   ║  WALLET VIEW — the Wallet tab, merged with Assets                 ║
   ║                                                                   ║
   ║  There used to be two balance screens that disagreed:             ║
   ║                                                                   ║
   ║    Assets  — every account, live prices, the real total           ║
   ║    Wallet  — three hard-coded coin cards, a total that summed     ║
   ║              five of the seven coins held, prices from a static   ║
   ║              mock table, a "+2.4% (24h)" that was typed in, and   ║
   ║              a "Ledger History" of three invented rows that       ║
   ║              never changed whatever you did                       ║
   ║                                                                   ║
   ║  Now there is one set of numbers. Both read MNY, so the figure    ║
   ║  here is the figure there, and the history is the ledger every    ║
   ║  payment actually writes to.                                      ║
   ║                                                                   ║
   ║  Nothing was dropped in the merge: connect, send, request, scan,  ║
   ║  convert, staking and NFTs are all still here. What changed is    ║
   ║  that they report the truth.                                      ║
   ║                                                                   ║
   ║  The badge claiming end-to-end encryption is gone. Balances are   ║
   ║  simulated and live in this browser's storage; saying otherwise   ║
   ║  was the one claim on the screen a user might have relied on.     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const WV = (() => {

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const attr = s => esc(JSON.stringify(String(s)));
  const ico = n => `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
  const coin = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const has = () => typeof MNY !== 'undefined';

  const money = v => (has() ? MNY.usd(v) : '$0.00');
  const qty = v => (has() ? MNY.qty(v) : '0');

  /* ── Header ──────────────────────────────────────────────────────── */
  /* Your address inside Trending. It comes from UID, so it is the same
     code on every device this account opens - and it is deliberately
     nothing like an on-chain address. features/uid.js says why. */
  function tagHTML() {
    if (typeof UID === 'undefined') return '';
    const m = UID.me();
    return `<div class="wv-tag">
      <span class="wv-tag-l">Your Trending address</span>
      <button type="button" class="wv-tag-v" onclick="WV.copyTag()" title="Copy">
        ${ico('qr_code_2')}<b>${esc(m.tag)}</b>${ico('content_copy')}</button>
      ${m.guest ? '<span class="wv-tag-note">Sign in and this address follows your account onto any device. As a guest it lives in this browser only.</span>' : ''}
    </div>`;
  }

  function copyTag() {
    if (typeof UID === 'undefined') return;
    const t = UID.tag();
    try { navigator.clipboard.writeText(t); showToast('Address copied — ' + t); }
    catch (e) { showToast('Your address is ' + t); }
  }

  function heroHTML() {
    const n = MNY.netWorth();
    const mv = MNY.dayMove(n.rows);
    const pct = mv.pct;
    return `<section class="wv-hero">
      <div class="wv-hero-l">Total value · Funding + Spot + Earn</div>
      <div class="wv-hero-v">${esc(money(n.total))}</div>
      <div class="wv-hero-m ${mv.abs >= 0 ? 'up' : 'dn'}">
        ${ico(mv.abs >= 0 ? 'trending_up' : 'trending_down')}
        ${esc((mv.abs >= 0 ? '+' : '-') + money(Math.abs(mv.abs)))}
        (${esc((pct >= 0 ? '+' : '') + pct.toFixed(2))}%) today
      </div>
      <div class="wv-hero-note">Simulated balances — no real money moves. Real deposits and withdrawals are separate.</div>
      ${tagHTML()}
    </section>`;
  }

  /* Only what the profile's crypto card above doesn't already offer.
     Send, Receive, Scan, Swap/Convert and Assets are buttons on that card
     whichever tab is open, so this row used to repeat them; it keeps the
     two that exist nowhere else on the profile. */
  const ACTIONS = [
    ['request', 'Request', 'request_quote'],
    ['add', 'Add funds', 'south_west']
  ];
  const actionsHTML = () => `<div class="wv-acts">${ACTIONS.map(([k, l, i]) =>
    `<button type="button" class="wv-act" onclick="WV.act(${attr(k)})">
       <span class="wv-act-i">${ico(i)}</span><span>${l}</span></button>`).join('')}</div>`;

  /* ── Balances ────────────────────────────────────────────────────── */
  /* Every coin held, in either account, with where it sits — rather than
     three cards and a total that quietly left the rest out. */
  function balancesHTML() {
    const rows = MNY.holdings();
    if (!rows.length) {
      return card('Balances', '<div class="wv-empty">This wallet is empty. Add funds to get started.</div>');
    }
    const body = rows.map(r => {
      const where = Object.keys(r.parts || {})
        .filter(k => r.parts[k] > 0)
        .map(k => `${MNY.ACCOUNTS[k].label} ${qty(r.parts[k])}`).join(' · ');
      return `<div class="wv-row">
        <span class="wv-row-id">${coin(r.sym, 32)}
          <span><b>${esc(typeof tickerOf === 'function' ? tickerOf(r.sym) : r.sym)}</b><em>${esc(r.name)}</em></span></span>
        <span class="wv-row-v">
          <b>${esc(qty(r.qty))}</b>
          <em>${r.priced ? esc(money(r.val)) : 'no market price'}</em>
        </span>
        <span class="wv-row-w">${esc(where)}${r.reference ? ' · reference price' : ''}</span>
      </div>`;
    }).join('');
    const un = rows.filter(r => !r.priced).length;
    return card('Balances',
      body + (un ? `<div class="wv-note">${un} holding${un === 1 ? '' : 's'} with no market price ${un === 1 ? 'is' : 'are'} shown but left out of the total.</div>` : ''),
      `<span class="wv-card-n">${rows.length} asset${rows.length === 1 ? '' : 's'}</span>`);
  }

  /* ── Transfer, any asset ─────────────────────────────────────────── */
  /* Funding ⇄ Spot for whatever you hold. It used to be USDT only, so a
     coin tipped into Funding could never reach the trading desk. */
  function transferHTML() {
    const held = MNY.holdings().filter(r => r.priced);
    const opts = (held.length ? held.map(r => r.sym) : ['USDT']);
    return card('Transfer between accounts', `
      <div class="wv-tx">
        <select class="input" id="wv-tx-coin">
          ${opts.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
        </select>
        <input class="input" id="wv-tx-amt" type="number" step="any" inputmode="decimal" placeholder="0.00" aria-label="Amount to transfer">
      </div>
      <div class="wv-tx-a">
        <button type="button" class="btn btn-ghost btn-sm" onclick="WV.move('spot','funding')">Spot → Funding</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="WV.move('funding','spot')">Funding → Spot</button>
      </div>
      <div class="wv-note">Funding is what payments, tips and chat spend from. Spot is the trading account.</div>`);
  }

  function move(from, to) {
    const c = document.getElementById('wv-tx-coin');
    const a = document.getElementById('wv-tx-amt');
    if (!c || !a) return;
    const r = MNY.transfer(c.value, a.value, from, to);
    toast(r.msg);
    if (r.ok) { a.value = ''; repaint(); }
  }

  /* ── Convert ─────────────────────────────────────────────────────── */
  /* There is no convert panel here. The Swap button on the profile's
     crypto card opens Convert (features/convert.js) itself, with its
     review step and 15-second quote - a second, inline panel that
     skipped both was one more way to do the same thing. */

  /* ── History ─────────────────────────────────────────────────────── */
  /* The real ledger. Every send, tip, request, swap and transfer writes
     one line here; nothing is prefilled. */
  function historyHTML() {
    const rows = MNY.ledger(25);
    if (!rows.length) {
      return card('History', '<div class="wv-empty">Nothing yet. Payments, tips, swaps and transfers show up here.</div>');
    }
    const ICONS = { spend: 'arrow_upward', receive: 'arrow_downward', transfer: 'swap_horiz', tip: 'toll', swap: 'currency_exchange' };
    const body = rows.map(e => {
      const inbound = e.dir === 'in';
      const move = e.dir === 'move';
      const who = e.kind === 'transfer' ? '' : (e.to || e.from || '');
      return `<div class="wv-h">
        <span class="wv-h-i ${move ? '' : inbound ? 'up' : 'dn'}">${ico(ICONS[e.kind] || 'receipt_long')}</span>
        <span class="wv-h-t">
          <b>${esc(label(e))}</b>
          <em>${esc([e.via, who, when(e.t)].filter(Boolean).join(' · '))}</em>
        </span>
        <span class="wv-h-v ${move ? '' : inbound ? 'up' : 'dn'}">
          <b>${move ? '' : inbound ? '+' : '−'}${esc(qty(e.qty))} ${esc(e.sym)}</b>
          ${e.value != null ? `<em>${esc(money(e.value))}</em>` : ''}
        </span>
      </div>`;
    }).join('');
    return card('History', body, `<button type="button" class="wv-card-a" onclick="WV.clearHistory()">Clear</button>`);
  }

  function label(e) {
    if (e.kind === 'transfer') return `${e.from} → ${e.to}`;
    if (e.kind === 'tip') return 'Tip sent';
    if (e.kind === 'swap') return e.dir === 'in' ? 'Swap received' : 'Swap paid';
    return e.dir === 'in' ? 'Received' : 'Sent';
  }

  function when(t) {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function clearHistory() {
    if (!window.confirm('Clear the payment history kept on this device? Balances are not affected.')) return;
    MNY.clearLedger();
    repaint();
    toast('History cleared');
  }

  /* ── Shell ───────────────────────────────────────────────────────── */
  const card = (title, body, right) => `<section class="wv-card">
    <div class="wv-card-h"><b>${esc(title)}</b>${right || ''}</div>${body}</section>`;

  function act(k) {
    if (k === 'request' && typeof PAY !== 'undefined') return PAY.openRequestFor('');
    if (k === 'add') {
      if (typeof HX !== 'undefined' && HX.addFunds) return HX.addFunds();
      return navigateTo('portfolio');
    }
    toast('That is still loading…');
  }

  /* ── Paint ───────────────────────────────────────────────────────── */
  function html() {
    if (!has()) return '<div class="wv-empty">The wallet is still loading…</div>';
    return `<div id="wv-root" class="wv">
      ${heroHTML()}
      ${actionsHTML()}
      <div class="wv-connect card wl-panel" data-wl-status>${typeof WL !== 'undefined' ? WL.statusHTML() : ''}</div>
      ${balancesHTML()}
      ${transferHTML()}
      ${historyHTML()}
    </div>`;
  }

  function repaint() {
    const root = document.getElementById('wv-root');
    if (!root) return;
    const scroll = root.scrollTop;
    root.outerHTML = html();
    const back = document.getElementById('wv-root');
    if (back) back.scrollTop = scroll;
  }

  return { html, repaint, act, move, clearHistory, copyTag };
})();

window.WV = WV;
/* MNY repaints every balance on screen after a move; this is the hook it
   calls for this tab. */
window.repaintWalletTab = () => WV.repaint();

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
publish('features/walletview.js', {
  WV: () => WV
});
