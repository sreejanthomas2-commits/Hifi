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

  let swap = { from: '', to: '', amount: '' };

  const money = v => (has() ? MNY.usd(v) : '$0.00');
  const qty = v => (has() ? MNY.qty(v) : '0');

  /* ── Header ──────────────────────────────────────────────────────── */
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
      <div class="wv-hero-split">
        ${[['Funding', MNY.total('funding').value, 'funding'],
           ['Spot', MNY.total('spot').value, 'spot'],
           ['Earn', MNY.earnTotal(), 'earn']]
          .map(([l, v, k]) => `<button type="button" class="wv-pill" onclick="WV.go(${attr(k)})">
             <span>${esc(l)}</span><b>${esc(money(v))}</b></button>`).join('')}
      </div>
      <div class="wv-hero-note">Simulated balances — no real money moves. Real deposits and withdrawals are separate.</div>
    </section>`;
  }

  const ACTIONS = [
    ['send', 'Send', 'north_east'],
    ['request', 'Request', 'request_quote'],
    ['scan', 'Scan &amp; pay', 'qr_code_scanner'],
    ['myqr', 'My code', 'qr_code_2'],
    ['convert', 'Convert', 'currency_exchange'],
    ['add', 'Add funds', 'south_west'],
    ['assets', 'All assets', 'account_balance']
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
  /* The rate, the fee and both ledger legs belong to CVT, which the
     Convert button on every Assets row also goes through — one engine,
     so the two surfaces cannot quote different numbers. This panel is
     just a second door to it.

     The old version here read a static mock price table, so a swap
     executed at a price no market was quoting. */
  function swapHTML() {
    if (typeof CVT === 'undefined') return card('Convert', '<div class="wv-empty">Convert is still loading…</div>');
    const all = CVT.options();
    if (!all.length) return card('Convert', '<div class="wv-empty">No coin has a live price right now.</div>');

    const held = MNY.holdings().filter(r => r.priced && r.live).map(r => r.sym);
    const from = swap.from && all.includes(swap.from) ? swap.from : (held[0] || all[0]);
    const to = swap.to && all.includes(swap.to) && swap.to !== from
      ? swap.to : (all.find(s => s !== from) || from);
    swap.from = from; swap.to = to;          // so the amount handler can read them

    const q = CVT.quote(from, to, swap.amount);
    const have = MNY.spendable(from);
    const sel = (id, cur) => `<select class="input" id="${id}" onchange="WV.setSwap(${attr(id)}, this.value)">
      ${all.map(s => `<option value="${esc(s)}"${s === cur ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>`;

    return card('Convert', `
      <div class="wv-swap">
        <label class="form-label" for="wv-swap-amt">You pay</label>
        <div class="wv-tx">
          <input class="input" id="wv-swap-amt" type="number" step="any" inputmode="decimal" placeholder="0.00"
                 value="${esc(swap.amount)}" oninput="WV.setSwap('amount', this.value)">
          ${sel('from', from)}
        </div>
        <div class="wv-swap-bal">Available ${esc(qty(have))} ${esc(from)}</div>
        <div class="wv-swap-ar">${ico('arrow_downward')}</div>
        <label class="form-label" for="wv-swap-out">You receive (estimate)</label>
        <div class="wv-tx">
          <input class="input" id="wv-swap-out" type="text" readonly value="${q.ok ? esc(qty(q.out)) : ''}" placeholder="0.00">
          ${sel('to', to)}
        </div>
        <div class="wv-note" id="wv-swap-rate">${swapRate(q, from, to)}</div>
        <button type="button" class="btn btn-primary w100 mt8" onclick="WV.doSwap()"
          ${q.ok && !q.short ? '' : 'disabled'}>${q.short ? `Not enough ${esc(from)}` : 'Convert'}</button>
      </div>`);
  }

  function swapRate(q, from, to) {
    if (!q.rate) return esc(q.why || 'Waiting for a live price on both sides.');
    return `1 ${esc(from)} \u2248 ${esc(qty(q.rate))} ${esc(to)} \u00b7 ${(CVT.FEE * 100).toFixed(1)}% fee
            \u2014 rates are live and move; the estimate is what you would get right now.`;
  }

  /* Typing the amount only updates the estimate. Repainting the whole
     tab on every keystroke would take the caret with it. */
  function setSwap(field, v) {
    if (field === 'amount') {
      swap.amount = v;
      const out = document.getElementById('wv-swap-out');
      const rate = document.getElementById('wv-swap-rate');
      const q = CVT.quote(swap.from, swap.to, v);
      if (out) out.value = q.ok ? qty(q.out) : '';
      if (rate) rate.innerHTML = swapRate(q, swap.from, swap.to);
      /* The button's state is decided at render, so typing an amount has
         to update it here too — otherwise it stays disabled while the
         estimate above it says the conversion is perfectly possible. */
      const go = document.querySelector('.wv-swap .btn-primary');
      if (go) {
        go.disabled = !(q.ok && !q.short);
        go.textContent = q.short ? `Not enough ${swap.from}` : 'Convert';
      }
      return;
    }
    if (field === 'from') swap.from = String(v).toUpperCase();
    else swap.to = String(v).toUpperCase();
    repaint();
  }

  /* Both legs, the fee and the two ledger entries are CVT's — this only
     reports what came back. */
  function doSwap() {
    if (typeof CVT === 'undefined') { toast('Convert is still loading…'); return; }
    const q = CVT.quote(swap.from, swap.to, swap.amount);
    if (!q.ok) { toast(q.why); return; }
    const r = CVT.execute(q.from, q.to, q.amount, { expect: q.out });
    if (!r.ok) { toast(r.msg); repaint(); return; }
    swap.amount = '';
    toast(r.msg);
    repaint();
  }

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
    if (k === 'send') {
      if (typeof PAY !== 'undefined' && PAY.openPayTo) PAY.openPayTo({});
      else toast('Payments are still loading…');
      return;
    }
    if (k === 'request' && typeof PAY !== 'undefined') return PAY.openRequestFor('');
    if (k === 'scan' && typeof PAY !== 'undefined') return PAY.openScan();
    if (k === 'myqr' && typeof PAY !== 'undefined') return PAY.openMyQR();
    if (k === 'convert') {
      if (typeof CVT !== 'undefined') CVT.open('');
      else toast('Convert is still loading…');
      return;
    }
    if (k === 'add') {
      if (typeof HX !== 'undefined' && HX.addFunds) return HX.addFunds();
      return navigateTo('portfolio');
    }
    if (k === 'assets') return navigateTo('portfolio');
    toast('That is still loading…');
  }

  function go(account) {
    if (account === 'earn') return navigateTo('earn');
    if (typeof AS !== 'undefined' && AS.go) { navigateTo('portfolio'); setTimeout(() => AS.go(account), 60); return; }
    navigateTo('portfolio');
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
      ${swapHTML()}
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

  return { html, repaint, act, go, move, setSwap, doSwap, clearHistory };
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
import { publish } from '../globals.js?v=2';
publish('features/walletview.js', {
  WV: () => WV
});
