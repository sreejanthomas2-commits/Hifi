/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CRYPTO TOOLS                                                    ║
   ║                                                                  ║
   ║   1. Convert       — instant swap between any two listed coins   ║
   ║   2. Price Alerts  — fire when a coin crosses your target        ║
   ║   3. Watchlist     — star coins, filter the desk down to them    ║
   ║   4. Recurring Buy — scheduled DCA executed at market            ║
   ║                                                                  ║
   ║  All four hang off the existing 60s CoinGecko poll and settle    ║
   ║  through the TR ledger, so nothing here keeps its own idea of    ║
   ║  your balance.                                                   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CT = (() => {

  const KEY = 'ts_cryptotools';
  const CONVERT_FEE = 0.001;                 // 0.1%, charged on the value converted

  const INTERVALS = {
    hourly:  { label: 'Every hour',  ms: 60 * 60 * 1000 },
    daily:   { label: 'Every day',   ms: 24 * 60 * 60 * 1000 },
    weekly:  { label: 'Every week',  ms: 7 * 24 * 60 * 60 * 1000 },
    monthly: { label: 'Every month', ms: 30 * 24 * 60 * 60 * 1000 }
  };

  const DEFAULT = { watchlist: ['BTC', 'ETH', 'SOL'], alerts: [], plans: [], convertFrom: 'USDT', convertTo: 'BTC' };

  let C = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(C)); } catch (e) {} }

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const ic = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');

  /* USDT is the quote leg and never appears in the price feed. */
  function priceOf(sym) {
    if (sym === 'USDT') return 1;
    const c = (window.liveCryptoPrices || {})[sym];
    return c ? c.usd : 0;
  }

  function coinList() {
    const live = Object.keys(window.liveCryptoPrices || {});
    return ['USDT', ...live.filter(s => s !== 'USDT')];
  }

  function usd(v) {
    if (!v && v !== 0) return '$0.00';
    const a = Math.abs(v);
    if (a > 0 && a < 0.01) return '$' + a.toFixed(6);
    return '$' + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function qty(v) {
    if (!v) return '0';
    if (v < 0.0001) return v.toExponential(2);
    return v.toLocaleString('en-US', { maximumFractionDigits: 8 });
  }

  /* ── 1. Convert ─────────────────────────────────────────────────── */
  /* Straight swap at mid: no order book, no slippage — the point is
     speed, so the only cost is the flat fee. */
  function convertRate(from, to) {
    const pf = priceOf(from), pt = priceOf(to);
    if (!pf || !pt) return 0;
    return pf / pt;
  }

  function convert(from, to, amount) {
    const amt = parseFloat(amount);
    if (!from || !to) return { ok: false, msg: 'Pick both coins.' };
    if (from === to) return { ok: false, msg: 'Pick two different coins.' };
    if (!amt || amt <= 0) return { ok: false, msg: 'Enter an amount.' };
    if (typeof TR === 'undefined') return { ok: false, msg: 'Trading account unavailable.' };

    const rate = convertRate(from, to);
    if (!rate) return { ok: false, msg: 'No live price for that pair.' };

    const have = TR.availableOf(from);
    if (amt > have + 1e-12) return { ok: false, msg: `Insufficient ${from} — you hold ${qty(have)}.` };

    const received = amt * rate * (1 - CONVERT_FEE);
    if (!TR.debitAsset(from, amt)) return { ok: false, msg: 'Debit failed.' };
    TR.creditAsset(to, received, priceOf(to));

    return { ok: true, received, msg: `Converted ${qty(amt)} ${from} → ${qty(received)} ${to}` };
  }

  /* ── 2. Price alerts ────────────────────────────────────────────── */
  function addAlert(coin, direction, target) {
    const t = parseFloat(target);
    if (!coin || !priceOf(coin)) return toast('Pick a coin with a live price.');
    if (!t || t <= 0) return toast('Enter a target price.');
    C.alerts.unshift({
      id: 'al' + Date.now(), coin, direction, target: t,
      created: Date.now(), triggered: false, base: priceOf(coin)
    });
    save(); repaint();
    toast(`Alert set — ${coin} ${direction} ${usd(t)}`);
  }

  function removeAlert(id) {
    const i = C.alerts.findIndex(a => a.id === id);
    if (i < 0) return;
    C.alerts.splice(i, 1);
    save(); repaint();
  }

  function clearTriggered() {
    C.alerts = C.alerts.filter(a => !a.triggered);
    save(); repaint();
    toast('Cleared triggered alerts');
  }

  const activeAlertCount = () => C.alerts.filter(a => !a.triggered).length;

  function checkAlerts() {
    let fired = 0;
    C.alerts.forEach(a => {
      if (a.triggered) return;
      const p = priceOf(a.coin);
      if (!p) return;
      const hit = a.direction === 'above' ? p >= a.target : p <= a.target;
      if (!hit) return;
      a.triggered = true;
      a.firedAt = Date.now();
      a.firedPrice = p;
      fired++;
      toast(`🔔 ${a.coin} is ${a.direction} ${usd(a.target)} — now ${usd(p)}`);
    });
    if (fired) { save(); repaint(); }
  }

  /* ── 3. Watchlist ───────────────────────────────────────────────── */
  const isWatched = sym => C.watchlist.includes(sym);

  function toggleWatch(sym) {
    const i = C.watchlist.indexOf(sym);
    if (i > -1) { C.watchlist.splice(i, 1); toast(`${sym} removed from watchlist`); }
    else { C.watchlist.push(sym); toast(`${sym} added to watchlist ★`); }
    save();
    repaint();
    if (typeof TR !== 'undefined') TR.repaint();
  }

  function starBtn(sym) {
    const on = isWatched(sym);
    return `<button class="ct-star${on ? ' on' : ''}" title="${on ? 'Remove from' : 'Add to'} watchlist"
      onclick="event.stopPropagation(); CT.toggleWatch('${esc(sym)}')">${on ? '★' : '☆'}</button>`;
  }

  /* ── 4. Recurring buys (DCA) ────────────────────────────────────── */
  function addPlan(coin, amount, interval) {
    const amt = parseFloat(amount);
    if (!coin || !priceOf(coin)) return toast('Pick a coin with a live price.');
    if (!amt || amt <= 0) return toast('Enter an amount in USDT.');
    if (!INTERVALS[interval]) return toast('Pick an interval.');
    C.plans.unshift({
      id: 'pl' + Date.now(), coin, amount: amt, interval,
      active: true, created: Date.now(),
      nextRun: Date.now() + INTERVALS[interval].ms,
      runs: 0, spent: 0, acquired: 0
    });
    save(); repaint();
    toast(`Recurring buy created — ${usd(amt)} of ${coin} ${INTERVALS[interval].label.toLowerCase()}`);
  }

  function togglePlan(id) {
    const p = C.plans.find(x => x.id === id);
    if (!p) return;
    p.active = !p.active;
    if (p.active) p.nextRun = Date.now() + INTERVALS[p.interval].ms;
    save(); repaint();
    toast(p.active ? 'Plan resumed' : 'Plan paused');
  }

  function removePlan(id) {
    const i = C.plans.findIndex(x => x.id === id);
    if (i < 0) return;
    C.plans.splice(i, 1);
    save(); repaint();
  }

  /* Shared by the scheduler and the manual "Run now" button. */
  function executePlan(id, manual) {
    const p = C.plans.find(x => x.id === id);
    if (!p || typeof TR === 'undefined') return false;

    const price = priceOf(p.coin);
    if (!price) return false;

    if (TR.availableOf('USDT') < p.amount) {
      p.active = false;
      save(); repaint();
      toast(`Recurring buy paused — not enough USDT for ${p.coin}`);
      return false;
    }

    const got = p.amount / price;
    TR.debitAsset('USDT', p.amount);
    TR.creditAsset(p.coin, got, price);

    p.runs++;
    p.spent += p.amount;
    p.acquired += got;
    p.lastRun = Date.now();
    p.nextRun = Date.now() + INTERVALS[p.interval].ms;
    save(); repaint();
    if (typeof TR !== 'undefined') TR.repaint();
    toast(`${manual ? 'Ran now' : 'Recurring buy'} — ${qty(got)} ${p.coin} for ${usd(p.amount)}`);
    return true;
  }

  function runDuePlans() {
    const now = Date.now();
    C.plans.filter(p => p.active && p.nextRun <= now).forEach(p => executePlan(p.id, false));
  }

  /* Average price paid across a plan's fills — the number DCA is for. */
  const planAvg = p => (p.acquired > 0 ? p.spent / p.acquired : 0);

  /* ── Price tick ─────────────────────────────────────────────────── */
  function onPriceTick() {
    checkAlerts();
    runDuePlans();
    const badge = document.getElementById('ct-alert-count');
    if (badge) badge.textContent = activeAlertCount();
  }

  /* ── Panel UI ───────────────────────────────────────────────────── */
  let tab = 'convert';

  const isOpen = () => !!document.getElementById('ct-panel');
  function repaint() { if (isOpen()) paint(); }

  function open(which) {
    if (which) tab = which;
    if (isOpen()) { paint(); return; }
    const p = document.createElement('div');
    p.id = 'ct-panel';
    p.className = 'sf-panel';
    document.body.appendChild(p);
    const s = document.createElement('div');
    s.id = 'ct-scrim';
    s.className = 'sf-scrim';
    s.onclick = close;
    document.body.appendChild(s);
    paint();
    setTimeout(() => { p.classList.add('open'); s.classList.add('open'); }, 20);
  }

  function close() {
    const p = document.getElementById('ct-panel'), s = document.getElementById('ct-scrim');
    if (p) { p.classList.remove('open'); setTimeout(() => p.remove(), 260); }
    if (s) { s.classList.remove('open'); setTimeout(() => s.remove(), 260); }
  }

  function setTab(t) { tab = t; paint(); }

  function paint() {
    const p = document.getElementById('ct-panel');
    if (!p) return;
    const tabs = [['convert', 'Convert'], ['alerts', `Alerts${activeAlertCount() ? ' ' + activeAlertCount() : ''}`], ['watch', 'Watchlist'], ['dca', 'Recurring']];
    p.innerHTML = `
      <div class="sf-head">
        <div><div class="sf-kicker">CRYPTO TOOLS</div><h3 class="sf-title">${tabs.find(t => t[0] === tab)[1]}</h3></div>
        <button class="icon-btn" onclick="CT.close()" aria-label="Close"><span class="material-symbols-rounded ms-18">close</span></button>
      </div>
      <div class="ct-tabs">
        ${tabs.map(([k, l]) => `<button class="ct-tab${tab === k ? ' active' : ''}" onclick="CT.setTab('${k}')">${l}</button>`).join('')}
      </div>
      <div id="ct-body">${tab === 'convert' ? convertHTML() : tab === 'alerts' ? alertsHTML() : tab === 'watch' ? watchHTML() : dcaHTML()}</div>`;
    if (tab === 'convert') previewConvert();
  }

  function coinOptions(sel) {
    return coinList().map(c => `<option value="${c}"${c === sel ? ' selected' : ''}>${c}</option>`).join('');
  }

  function convertHTML() {
    const bal = typeof TR !== 'undefined' ? TR.availableOf(C.convertFrom) : 0;
    return `
      <div class="sf-sec-sub">Swap straight between any two listed coins at the mid price. No order book, ${(CONVERT_FEE * 100).toFixed(1)}% fee.</div>
      <label class="form-label">From</label>
      <div class="ct-row">
        <select class="input" id="ct-from" onchange="CT.setConvert('from', this.value)">${coinOptions(C.convertFrom)}</select>
        <input class="input" id="ct-amt" type="number" step="any" placeholder="0.00" oninput="CT.previewConvert()">
      </div>
      <div class="ct-bal">Available <b>${qty(bal)} ${esc(C.convertFrom)}</b>
        <button class="ct-max" onclick="document.getElementById('ct-amt').value=${bal}; CT.previewConvert()">MAX</button></div>

      <button class="ct-swap" onclick="CT.flipConvert()" title="Flip"><span class="material-symbols-rounded ms-18">swap_vert</span></button>

      <label class="form-label">To</label>
      <select class="input" id="ct-to" onchange="CT.setConvert('to', this.value)">${coinOptions(C.convertTo)}</select>

      <div class="ct-preview" id="ct-preview"></div>
      <button class="btn btn-primary w100" onclick="CT.doConvert()">Convert</button>`;
  }

  function setConvert(side, val) {
    if (side === 'from') C.convertFrom = val; else C.convertTo = val;
    save(); paint();
  }

  function flipConvert() {
    const a = C.convertFrom;
    C.convertFrom = C.convertTo;
    C.convertTo = a;
    save(); paint();
  }

  function previewConvert() {
    const box = document.getElementById('ct-preview');
    const el = document.getElementById('ct-amt');
    if (!box) return;
    const amt = el ? parseFloat(el.value) || 0 : 0;
    const rate = convertRate(C.convertFrom, C.convertTo);
    const out = amt * rate * (1 - CONVERT_FEE);
    box.innerHTML = `
      <div class="tr-kv"><span>Rate</span><b>1 ${esc(C.convertFrom)} = ${qty(rate)} ${esc(C.convertTo)}</b></div>
      <div class="tr-kv"><span>Fee</span><b>${usd(amt * priceOf(C.convertFrom) * CONVERT_FEE)}</b></div>
      <div class="tr-kv"><span>You receive</span><b>${qty(out)} ${esc(C.convertTo)}</b></div>`;
  }

  function doConvert() {
    const el = document.getElementById('ct-amt');
    const r = convert(C.convertFrom, C.convertTo, el ? el.value : 0);
    toast(r.msg);
    if (r.ok) { if (el) el.value = ''; paint(); if (typeof TR !== 'undefined') TR.repaint(); }
  }

  function alertsHTML() {
    const rows = C.alerts.length ? C.alerts.map(a => `
      <div class="ct-item${a.triggered ? ' fired' : ''}">
        <div class="ct-item-main">
          ${ic(a.coin, 24)}
          <div>
            <div class="ct-item-t">${esc(a.coin)} ${a.direction} ${usd(a.target)}</div>
            <div class="ct-item-s">${a.triggered
              ? `Fired at ${usd(a.firedPrice)} · ${new Date(a.firedAt).toLocaleTimeString()}`
              : `Now ${usd(priceOf(a.coin))}`}</div>
          </div>
        </div>
        <button class="sf-x" onclick="CT.removeAlert('${a.id}')">✕</button>
      </div>`).join('') : '<div class="sf-empty">No alerts yet.</div>';

    return `
      <div class="sf-sec-sub">Checked against the live feed every refresh. Fires once, then stays in the list as a record.</div>
      <label class="form-label">Coin</label>
      <select class="input mb8" id="ct-al-coin">${coinOptions('BTC')}</select>
      <div class="ct-row mb8">
        <select class="input" id="ct-al-dir">
          <option value="above">Rises above</option>
          <option value="below">Falls below</option>
        </select>
        <input class="input" id="ct-al-target" type="number" step="any" placeholder="Target price">
      </div>
      <button class="btn btn-primary w100 mb16" onclick="CT.addAlert(
        document.getElementById('ct-al-coin').value,
        document.getElementById('ct-al-dir').value,
        document.getElementById('ct-al-target').value)">Create alert</button>
      ${C.alerts.some(a => a.triggered) ? `<button class="btn btn-ghost btn-sm w100 mb8" onclick="CT.clearTriggered()">Clear triggered</button>` : ''}
      ${rows}`;
  }

  function watchHTML() {
    if (!C.watchlist.length) return '<div class="sf-empty">Nothing starred yet. Tap ☆ on any coin.</div>';
    return `
      <div class="sf-sec-sub">Starred coins. The trading desk can filter down to just these.</div>
      ${C.watchlist.map(s => {
        const c = (window.liveCryptoPrices || {})[s];
        const chg = c ? (c.usd_24h_change || 0) : 0;
        return `<div class="ct-item" onclick="CT.close(); TR.setPair('${esc(s)}'); navigateTo('trade')">
          <div class="ct-item-main">
            ${ic(s, 24)}
            <div><div class="ct-item-t">${esc(s)}</div><div class="ct-item-s">${usd(priceOf(s))}</div></div>
          </div>
          <span class="${chg >= 0 ? 'up' : 'down'} fw8 fs12">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span>
          <button class="sf-x" onclick="event.stopPropagation(); CT.toggleWatch('${esc(s)}')">✕</button>
        </div>`;
      }).join('')}`;
  }

  function dcaHTML() {
    const rows = C.plans.length ? C.plans.map(p => `
      <div class="ct-item ct-plan">
        <div class="ct-item-main">
          ${ic(p.coin, 24)}
          <div>
            <div class="ct-item-t">${usd(p.amount)} of ${esc(p.coin)}</div>
            <div class="ct-item-s">${INTERVALS[p.interval].label} · ${p.runs} run${p.runs === 1 ? '' : 's'}${
              p.runs ? ` · avg ${usd(planAvg(p))}` : ''}</div>
            ${p.active ? `<div class="ct-item-s">Next ${new Date(p.nextRun).toLocaleString()}</div>` : '<div class="ct-item-s">Paused</div>'}
          </div>
        </div>
        <div class="ct-plan-acts">
          <button class="btn btn-ghost btn-sm" onclick="CT.executePlan('${p.id}', true)">Run now</button>
          <button class="btn btn-ghost btn-sm" onclick="CT.togglePlan('${p.id}')">${p.active ? 'Pause' : 'Resume'}</button>
          <button class="sf-x" onclick="CT.removePlan('${p.id}')">✕</button>
        </div>
      </div>`).join('') : '<div class="sf-empty">No recurring buys yet.</div>';

    return `
      <div class="sf-sec-sub">Buys a fixed amount on a schedule, at whatever the market price is that day — the point is to stop timing it.</div>
      <label class="form-label">Coin</label>
      <select class="input mb8" id="ct-dca-coin">${coinOptions('BTC')}</select>
      <div class="ct-row mb8">
        <input class="input" id="ct-dca-amt" type="number" step="any" placeholder="Amount in USDT">
        <select class="input" id="ct-dca-int">
          ${Object.entries(INTERVALS).map(([k, v]) => `<option value="${k}"${k === 'weekly' ? ' selected' : ''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary w100 mb16" onclick="CT.addPlan(
        document.getElementById('ct-dca-coin').value,
        document.getElementById('ct-dca-amt').value,
        document.getElementById('ct-dca-int').value)">Create plan</button>
      ${rows}`;
  }

  return {
    open, close, setTab, repaint,
    convert, convertRate, doConvert, previewConvert, setConvert, flipConvert,
    addAlert, removeAlert, clearTriggered, checkAlerts, activeAlertCount,
    isWatched, toggleWatch, starBtn,
    addPlan, togglePlan, removePlan, executePlan, runDuePlans, planAvg,
    onPriceTick, INTERVALS,
    get state() { return C; }
  };
})();

window.CT = CT;
