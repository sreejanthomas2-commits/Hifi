/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CRYPTO HUB — every crypto service, one page                      ║
   ║                                                                   ║
   ║  Top to bottom: the balance (available, locked, pending), the     ║
   ║  five things people do most, then every service in groups, each   ║
   ║  with a chip that says what it is right now:                      ║
   ║                                                                   ║
   ║    Ready        works now, and Trending holds no money for it     ║
   ║    Practice     works, on paper money that lives on this device   ║
   ║    Coming       being built; tap to hear what it will do          ║
   ║    Unavailable  tap to hear why, and what would have to exist     ║
   ║    Paused       switched off for maintenance                      ║
   ║                                                                   ║
   ║  The server's switchboard (GET /api/products) decides the chip.   ║
   ║  This page only draws it, and it owns what each tile OPENS: the   ║
   ║  server names a product and nothing more, so nothing it sends can ║
   ║  become code here. If the server can't be reached the page uses   ║
   ║  the same catalogue file at its starting states - none of which   ║
   ║  is real money - and says it is doing that.                       ║
   ║                                                                   ║
   ║  Nothing is removed by this page: Trade, P2P, Earn, Assets and    ║
   ║  Crypto Market are still where they were, and are also here.     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CXH = (() => {
  const API = '/api/products';
  const LOCAL = 'js/data/crypto-products.json';
  const TIMEOUT_MS = 5000;

  let board = null;        // { groups, products } as last received
  let source = '';         // 'server' | 'local'
  let failed = false;      // neither the server nor the local copy loaded
  let inflight = null;

  const $ = id => document.getElementById(id);
  const esc = s => (typeof FUI !== 'undefined' ? FUI.esc(s) : String(s == null ? '' : s));
  const A = v => esc(JSON.stringify(v === undefined ? null : v));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const usd = v => (typeof MNY !== 'undefined' ? MNY.usd(v) : '$' + (Number(v) || 0).toFixed(2));
  const go = pane => Promise.resolve(typeof navigateTo === 'function' ? navigateTo(pane) : null);
  const has = name => typeof window[name] !== 'undefined';

  /* ── Loading the board ───────────────────────────────────────────── */
  async function fetchJSON(url) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null;
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
      if (!res.ok) throw new Error(url + ' ' + res.status);
      return await res.json();
    } finally { if (timer) clearTimeout(timer); }
  }
  // Starting states only, so the fallback can never show more than the server would.
  const localBoard = cat => ({
    groups: cat.groups,
    products: cat.products.map(p => ({ id: p.id, name: p.name, group: p.group, icon: p.icon, state: p.base,
      note: p.note || '', why: p.why || '', alt: p.alt || null, altLabel: p.altLabel || null }))
  });
  const valid = b => b && Array.isArray(b.groups) && Array.isArray(b.products) && b.products.every(p => p && p.id && p.state);

  function load(force) {
    if (inflight && !force) return inflight;
    inflight = (async () => {
      failed = false;
      try {
        const b = await fetchJSON(API);
        if (!valid(b)) throw new Error('unexpected answer');
        board = b; source = 'server';
      } catch (e) {
        try { board = localBoard(await fetchJSON(LOCAL)); source = 'local'; }
        catch (e2) { board = null; failed = true; }
      }
      inflight = null;
      paint();
    })();
    return inflight;
  }
  function retry() { board = null; paint(); load(true); }

  const product = id => (board ? board.products.find(p => p.id === id) : null);
  const usable = p => p && (p.state === 'real' || p.state === 'sandbox' || p.state === 'live');

  /* ── What each tile opens ────────────────────────────────────────── */
  const settings = screen => go('settings').then(() => { if (has('SET')) SET.open(screen); });
  const OPEN = {
    spot:      () => go('trade'),
    buysell:   () => go('trade').then(() => { if (has('TR')) TR.setType('market'); }),
    convert:   () => CVT.open(),
    p2p:       () => go('p2p'),
    markets:   () => go('cryptomarket'),
    asset:     () => go('cryptomarket'),
    deposit:   () => DEP.open(),
    withdraw:  () => WD.open(),
    send:      () => SC.open(),
    receive:   () => WAD.openMine(),
    pay:       () => PAY.openHub(),
    qr:        () => PAY.openScan(),
    earn:      () => go('earn'),
    wallet:    () => go('portfolio').then(() => { if (has('AS')) AS.go('overview'); }),
    portfolio: () => go('portfolio').then(() => { if (has('AS')) AS.go('overview'); }),
    history:   () => go('portfolio').then(() => { if (has('AS')) AS.go('history'); }),
    security:  () => settings('security'),
    support:   () => settings('help')
  };

  async function tap(id) {
    const p = product(id);
    if (!p) return;
    if (!usable(p)) return explain(p);
    const fn = OPEN[id];
    if (!fn) return toast(`${p.name} can't be opened from here yet.`);
    try { await fn(); }
    catch (e) { toast(`${p.name} couldn't open. Nothing has changed; try again.`); }
  }

  async function explain(p) {
    const title = p.state === 'coming' ? `${p.name} is coming`
      : p.state === 'paused' ? `${p.name} is paused` : `${p.name} isn't available`;
    const alt = p.alt ? product(p.alt) : null;
    if (alt && usable(alt) && typeof appConfirm === 'function') {
      if (await appConfirm(p.why, { title, ok: p.altLabel || `Open ${alt.name}`, cancel: 'Close' })) tap(alt.id);
      return;
    }
    if (typeof appAlert === 'function') appAlert(p.why, { title });
    else toast(p.why);
  }

  /* ── The balance ─────────────────────────────────────────────────── */
  /* All practice money, all on this device. Available is what a payment
     or an order can use now. Locked is yours but committed: open orders,
     P2P escrow, and Earn. Pending is on its way to you and not yet yours
     (a P2P buy waiting for the seller), so it is not in the total. */
  const px = s => (typeof MNY !== 'undefined' ? MNY.price(s) || 0 : 0);
  function balances() {
    if (typeof MNY === 'undefined') return null;
    const nw = MNY.netWorth();
    let orders = 0;
    if (has('TR')) {
      const syms = new Set();
      (TR.state.orders || []).forEach(o => { syms.add(o.sym); syms.add(o.quote || 'USDT'); });
      syms.forEach(s => { orders += TR.lockedOf(s) * px(s); });
    }
    let escrow = 0, pending = 0;
    if (has('P2P')) {
      (P2P.state.orders || []).forEach(o => {
        const v = (Number(o.qty) || 0) * px(o.coin);
        if (o.side === 'sell' && ['awaiting_payment', 'buyer_paid', 'disputed'].includes(o.status)) escrow += v;
        if (o.side === 'buy' && ['paid', 'disputed'].includes(o.status)) pending += v;
      });
    }
    const available = Math.max(0, nw.wallet - orders);
    const locked = orders + escrow + nw.earn;
    return { total: available + locked, available, locked, pending, unpriced: nw.unpriced, parts: { orders, escrow, earn: nw.earn } };
  }

  function balanceHTML() {
    const b = balances();
    if (!b) return FUI.skeleton(1, 'row');
    const cell = (label, v, sub) => `<div class="ch-bal-cell"><span>${esc(label)}</span><b>${esc(usd(v))}</b>${sub ? `<em>${esc(sub)}</em>` : ''}</div>`;
    const lockedSub = [b.parts.orders > 0 && 'open orders', b.parts.escrow > 0 && 'P2P escrow', b.parts.earn > 0 && 'Earn'].filter(Boolean).join(', ');
    return `<div class="card ch-bal">
      <div class="ch-bal-top">
        <div>
          <div class="ch-bal-l">Total value <span class="ch-chip ch-sandbox">Practice</span></div>
          <div class="ch-bal-v">${esc(usd(b.total))}</div>
        </div>
      </div>
      <div class="ch-bal-grid">
        ${cell('Available', b.available, 'Can be used now')}
        ${cell('Locked', b.locked, lockedSub || 'Nothing locked')}
        ${cell('Pending', b.pending, b.pending > 0 ? 'On its way, not in the total' : 'Nothing incoming')}
      </div>
      <div class="ch-bal-note">Paper balances on this device. ${b.unpriced ? `${b.unpriced} coin${b.unpriced === 1 ? '' : 's'} with no price ${b.unpriced === 1 ? 'is' : 'are'} left out of the total. ` : ''}Nothing here is real money.</div>
    </div>`;
  }

  /* ── The page ────────────────────────────────────────────────────── */
  const CHIP = {
    real: ['Ready', 'ch-real'], sandbox: ['Practice', 'ch-sandbox'], coming: ['Coming', 'ch-coming'],
    unavailable: ['Unavailable', 'ch-off'], paused: ['Paused', 'ch-off'], live: ['Real money', 'ch-live']
  };
  const chip = p => { const c = CHIP[p.state] || CHIP.unavailable; return `<span class="ch-chip ${c[1]}">${c[0]}</span>`; };
  const firstSentence = s => { const m = String(s || '').match(/^.*?[.!?](\s|$)/); return m ? m[0].trim() : String(s || ''); };

  const QUICK = ['deposit', 'withdraw', 'send', 'receive', 'convert'];
  function quickHTML() {
    return `<div class="ch-quick" role="group" aria-label="Most used">
      ${QUICK.map(id => product(id)).filter(Boolean).map(p => `
        <button type="button" class="ch-q${usable(p) ? '' : ' ch-q-off'}" onclick="CXH.tap(${A(p.id)})"
                aria-label="${esc(p.name)}: ${esc((CHIP[p.state] || CHIP.unavailable)[0])}">
          <span class="material-symbols-rounded" aria-hidden="true">${esc(p.icon)}</span>
          <span>${esc(p.name.replace(' crypto', ''))}</span>
        </button>`).join('')}
    </div>`;
  }

  function tileHTML(p) {
    const line = usable(p) ? p.note : firstSentence(p.why) || p.note;
    return `<button type="button" class="ch-tile${usable(p) ? '' : ' ch-tile-off'}" onclick="CXH.tap(${A(p.id)})">
      <span class="ch-tile-i material-symbols-rounded" aria-hidden="true">${esc(p.icon)}</span>
      <span class="ch-tile-b">
        <span class="ch-tile-t">${esc(p.name)} ${chip(p)}</span>
        <span class="ch-tile-s">${esc(line)}</span>
      </span>
    </button>`;
  }

  function groupsHTML() {
    return board.groups.map(g => {
      const items = board.products.filter(p => p.group === g.id);
      if (!items.length) return '';
      return `<section class="ch-group" aria-labelledby="ch-g-${esc(g.id)}">
        <h2 class="ch-group-t" id="ch-g-${esc(g.id)}">${esc(g.name)}</h2>
        <div class="ch-tiles">${items.map(tileHTML).join('')}</div>
      </section>`;
    }).join('');
  }

  function paint() {
    const root = $('ch-root');
    if (!root) return;
    if (failed) {
      root.innerHTML = FUI.offline() + FUI.problem({
        title: "The crypto services couldn't be loaded",
        what: "Trending's server didn't answer, and the app's own list of services couldn't be read either. This usually means the connection dropped.",
        safe: 'Yes. Nothing was sent or changed. Your practice balances are stored on this device.',
        status: 'Nothing is in progress.',
        todo: 'No. You can try again now, or use Trade, P2P and Earn from the menu as usual.',
        act: { label: 'Try again', onclick: 'CXH.retry()' }
      });
      return;
    }
    if (!board) {
      root.innerHTML = FUI.skeleton(1, 'row') + FUI.skeleton(6, 'tile');
      load();
      return;
    }
    root.innerHTML = `
      ${FUI.offline()}
      ${source === 'local' ? `<div class="ch-src" role="status">Trending's server couldn't be reached, so this shows each service at its starting state. None of them is real money either way. <button type="button" class="ch-link" onclick="CXH.retry()">Check again</button></div>` : ''}
      ${balanceHTML()}
      ${quickHTML()}
      ${groupsHTML()}
      <div class="ch-legend">
        <p><b>Practice</b> uses paper money kept on this device. Nothing real moves.</p>
        <p><b>Ready</b> works now without Trending holding your money: live prices, your own wallet, your account's security.</p>
        <p><b>Unavailable</b> needs a licence or a partner Trending doesn't have yet. Tap one to see what.</p>
      </div>`;
  }

  // Balances move with prices and trades; repaint the card, not the page.
  function repaintBalance() {
    const el = document.querySelector('#ch-root .ch-bal');
    if (el && board) el.outerHTML = balanceHTML();
  }

  return { paint, load, retry, tap, explain, balances, repaintBalance, get board() { return board; }, get source() { return source; } };
})();

window.CXH = CXH;

function getCryptohubTemplate() {
  return `<section id="pane-cryptohub" class="pane">
    <h1 class="pane-title" style="display:flex; align-items:center; gap:10px">
      <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--brand)">hub</span>
      <span>Crypto</span>
    </h1>
    <div id="ch-root"></div>
  </section>`;
}

function renderCryptohub() { CXH.paint(); }

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module, so its top-level names are private to it.
   The router and inline onclick= handlers look them up on the global
   object, so they are republished here. */
import { publish } from '../globals.js?v=3';
publish('pages/cryptohub.js', {
  CXH: () => CXH, getCryptohubTemplate: () => getCryptohubTemplate,
  renderCryptohub: () => renderCryptohub
});
