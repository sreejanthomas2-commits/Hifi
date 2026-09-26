/* ╔══════════════════════════════════════════════════════════════════╗
   ║  WITHDRAW CRYPTO — method → address → network → amount → review   ║
   ║                                                                   ║
   ║  One state object lives for the whole flow, so stepping back      ║
   ║  never loses what was typed. It is cleared only when the user     ║
   ║  cancels or the withdrawal is sent.                               ║
   ║                                                                   ║
   ║  Nothing on this screen decides anything. The address check here  ║
   ║  is for the red line under the field; the fee is what the server  ║
   ║  quoted; the balance is the ledger's. Every one of them is        ║
   ║  checked again server-side before a single unit moves, because    ║
   ║  this code runs on the attacker's machine.                        ║
   ║                                                                   ║
   ║  Amounts are handled as base-unit strings and BigInt. There is no ║
   ║  parseFloat in this file: 0.1 + 0.2 is not 0.3, and a balance     ║
   ║  that drifts is a balance nobody can reconcile.                   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const WD = (() => {

  const BKEY = 'ts_withdraw_book_v1';     // saved destinations, this device
  const $ = id => document.getElementById(id);
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
  const ico = (n, c) => `<span class="material-symbols-rounded${c ? ' ' + c : ''}" aria-hidden="true">${n}</span>`;
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  /* ── Decimal-safe amounts ────────────────────────────────────────
     A human types "0.005". The chain counts in base units. These two
     turn one into the other with string surgery — never a float, which
     would quietly turn 0.1 into 0.100000000000000005. */
  function toBase(text, decimals) {
    const s = String(text == null ? '' : text).trim().replace(/,/g, '');
    if (!s || !/^\d*\.?\d*$/.test(s)) return null;
    const [whole, frac = ''] = s.split('.');
    if (frac.length > decimals) return null;                   // more precision than the asset has
    const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
    const joined = (whole || '0') + padded;
    return BigInt(joined.replace(/^0+(?=\d)/, '') || '0');
  }
  function fromBase(units, decimals, maxFrac) {
    const n = BigInt(String(units == null ? '0' : units));
    const neg = n < 0n;
    const s = (neg ? -n : n).toString().padStart(decimals + 1, '0');
    const whole = s.slice(0, s.length - decimals);
    let frac = s.slice(s.length - decimals).replace(/0+$/, '');
    if (maxFrac != null && frac.length > maxFrac) frac = frac.slice(0, maxFrac);
    return (neg ? '-' : '') + whole + (frac ? '.' + frac : '');
  }

  /* ── The single flow state ───────────────────────────────────────── */
  const blank = () => ({
    screen: 'method', stack: [],
    asset: '', decimals: 18, network: '', networkLabel: '',
    to: '', addressSource: '', addressOk: null, addressMsg: '',
    available: '0', amount: '', fee: null, minimum: null, receives: null,
    quote: null, twoFactor: '', busy: false, err: '',
    idempotencyKey: '', result: null, networks: null
  });
  let V = null;
  let lastFocus = null;

  /* ── Server calls ────────────────────────────────────────────────── */
  async function api(path, body) {
    // The wallet server knows who you are only from your sign-in token.
    const who = typeof authHeaders === 'function' ? await authHeaders() : {};
    const r = await fetch(path, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
      headers: Object.assign({ Accept: 'application/json' }, who,
        body ? { 'Content-Type': 'application/json' } : {},
        V && V.idempotencyKey && path === '/api/crypto/withdraw' ? { 'Idempotency-Key': V.idempotencyKey } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await r.json(); } catch (e) {}
    return { status: r.status, ok: r.ok, data: data || {} };
  }

  const DEC = { BTC: 8, ETH: 18, USDT: 6, USDC: 6, USD1: 18, BNB: 18, SOL: 9, XRP: 6, TRX: 6, POL: 18, DAI: 18 };
  const decimalsOf = sym => DEC[sym] == null ? 18 : DEC[sym];

  /* ══ Open and close ══════════════════════════════════════════════ */
  function open(asset) {
    if ($('wd-sheet')) return;
    lastFocus = document.activeElement;
    V = blank();
    V.asset = String(asset || 'ETH').toUpperCase();
    V.decimals = decimalsOf(V.asset);
    const el = document.createElement('div');
    el.id = 'wd-sheet';
    el.className = 'wd-sheet';
    el.innerHTML = '<div class="wd-in" role="dialog" aria-modal="true" aria-label="Withdraw"><div id="wd-head"></div><div class="wd-body" id="wd-body"></div><div id="wd-foot"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-wd]');
      if (b) { e.preventDefault(); act(b.dataset.wd, b.dataset.v, b); return; }
      if (e.target === el && V.screen === 'method') close();
    });
    el.addEventListener('input', e => {
      const f = e.target.closest('[data-wdf]');
      if (!f) return;
      const k = f.dataset.wdf;
      if (k === 'to') { V.to = f.value; V.addressSource = V.addressSource || 'typed'; checkAddress(); return; }
      if (k === 'amount') { V.amount = f.value; onAmount(); return; }
      V[k] = f.value;
      if (k === 'twoFactor') syncFoot();
    });
    document.addEventListener('keydown', key, true);
    paint();
    requestAnimationFrame(() => el.classList.add('open'));
  }

  function close(force) {
    const el = $('wd-sheet');
    if (el) el.remove();
    document.removeEventListener('keydown', key, true);
    V = null;
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    lastFocus = null;
  }
  async function cancelFlow() {
    if (V && (V.to || V.amount) && typeof appConfirm === 'function') {
      const ok = await appConfirm('Discard this withdrawal? Nothing has been sent.', { ok: 'Discard', cancel: 'Keep editing', danger: true });
      if (!ok) return;
    }
    close(true);
  }
  function key(e) {
    if (e.key !== 'Escape' || !$('wd-sheet')) return;
    if (document.querySelector('.mob-dialog-scrim')) return;
    e.preventDefault(); e.stopPropagation();
    if (V.stack.length) back(); else cancelFlow();
  }

  function go(screen, patch) {
    V.stack.push({ screen: V.screen });
    Object.assign(V, patch || {}, { screen, err: '' });
    paint();
  }
  function back() {
    const prev = V.stack.pop();
    if (!prev) { cancelFlow(); return; }
    V.screen = prev.screen;
    V.err = '';
    paint();
  }

  /* ══ Paint ═══════════════════════════════════════════════════════ */
  const TITLES = {
    method: 'Select withdraw method', address: 'Enter address', network: 'Choose network',
    amount: 'Withdraw', review: 'Review withdrawal', auth: 'Confirm it is you',
    status: 'Withdrawal', history: 'Withdrawals', nocustody: 'Withdraw crypto'
  };

  function paint() {
    if (!V || !$('wd-body')) return;
    const sheetish = V.screen === 'method';
    const el = $('wd-sheet');
    el.classList.toggle('as-sheet', sheetish);

    $('wd-head').innerHTML = sheetish ? '' : `<div class="wd-head">
      <button type="button" class="wd-ib" data-wd="${V.stack.length ? 'back' : 'cancel'}" aria-label="${V.stack.length ? 'Back' : 'Close'}">${ico(V.stack.length ? 'arrow_back' : 'close')}</button>
      <b>${esc(TITLES[V.screen])}</b>
      <span class="wd-head-a">
        ${V.screen === 'address' ? `<button type="button" class="wd-ib" data-wd="help" aria-label="Help">${ico('help')}</button>
        <button type="button" class="wd-ib" data-wd="history" aria-label="Withdrawal history">${ico('history')}</button>` : ''}
        ${V.screen === 'network' ? `<button type="button" class="wd-ib" data-wd="netinfo" aria-label="About networks">${ico('info')}</button>` : ''}
      </span>
    </div>`;

    $('wd-body').innerHTML =
      V.screen === 'method' ? methodHTML()
      : V.screen === 'address' ? addressHTML()
      : V.screen === 'network' ? networkHTML()
      : V.screen === 'amount' ? amountHTML()
      : V.screen === 'review' ? reviewHTML()
      : V.screen === 'auth' ? authHTML()
      : V.screen === 'history' ? historyHTML()
      : V.screen === 'nocustody' ? noCustodyHTML()
      : statusHTML();

    $('wd-foot').innerHTML = footHTML();
    const focusable = $('wd-body').querySelector('[data-wdf="to"], [data-wdf="amount"], [data-wdf="twoFactor"]');
    if (focusable && (V.screen === 'amount' || V.screen === 'auth')) setTimeout(() => { try { focusable.focus({ preventScroll: true }); } catch (e) {} }, 80);
  }

  /* ── 1 · method ──────────────────────────────────────────────────── */
  function methodHTML() {
    const rows = [
      ['internal', 'send_to_mobile', 'Send to a Trending user',
        'Free and instant — by name, @handle, Trending Tag or Pay ID', typeof PAY !== 'undefined'],
      ['chain', 'north_east', 'Send via crypto network',
        'To an exchange or wallet address, on its network — network fee applies', true],
      ['p2p', 'swap_horiz', 'P2P trading',
        'Sell directly to other people using local payment methods', typeof P2P !== 'undefined']
    ].filter(r => r[4]);
    return `<span class="wd-grab" aria-hidden="true"></span>
      <h2 class="wd-sheet-t">How do you want to send?</h2>
      ${rows.map(([k, i, t, d]) => `<button type="button" class="wd-row" data-wd="method" data-v="${k}">
        <span class="wd-row-i">${ico(i)}</span>
        <span class="wd-row-t"><b>${esc(t)}</b><em>${esc(d)}</em></span>
      </button>`).join('')}`;
  }

  /* ── 1b · nothing to withdraw ────────────────────────────────────
     Said once, in plain words, rather than four network cards each
     carrying a server error the user cannot act on. */
  function noCustodyHTML() {
    return `
      <div class="wd-empty tall">
        ${ico('account_balance_wallet', 'wd-empty-i')}
        <b>Your crypto is already in your own wallet</b>
        <p>Trending is not holding coins for you on this build, so there is no balance here to send out. Anything you deposited went straight to an address you control — send it from the wallet that holds it.</p>
      </div>
      <div class="wd-note">${ico('info')}<span>When Trending does hold balances, this screen becomes the full withdrawal flow: pick a network, paste an address, confirm with your authenticator, and follow it to the chain.</span></div>
      ${typeof WAD !== 'undefined' && WAD.open ? `<button type="button" class="wd-btn" data-wd="ownsend">${ico('north_east')}Send from my own wallet</button>` : ''}
      ${typeof P2P !== 'undefined' ? `<button type="button" class="wd-btn" data-wd="method" data-v="p2p">${ico('swap_horiz')}Sell on P2P instead</button>` : ''}`;
  }

  /* ── 2 · address ─────────────────────────────────────────────────── */
  function addressHTML() {
    const chip = V.network
      ? `<button type="button" class="wd-chip on" data-wd="net">${ico('lan')}<b>${esc(V.asset)}</b><em>${esc(V.networkLabel)}</em>${ico('expand_more')}</button>`
      : `<button type="button" class="wd-chip" data-wd="net">${ico('lan')}Select network${ico('expand_more')}</button>`;
    const bad = V.addressOk === false && V.to.trim();
    return `
      ${chip}
      <div class="wd-addr${bad ? ' bad' : ''}">
        <textarea data-wdf="to" rows="2" placeholder="Address" spellcheck="false" autocomplete="off"
          aria-label="Destination address">${esc(V.to)}</textarea>
      </div>
      ${bad ? `<p class="wd-err">${ico('error')}${esc(V.addressMsg || 'Invalid address for the selected network.')}</p>` : ''}
      ${V.addressOk && !V.addressChecksum ? `<p class="wd-hint">${ico('info')}This address format carries no checksum, so it cannot be verified beyond its shape. Check it character by character.</p>` : ''}
      <div class="wd-tools">
        <button type="button" class="wd-tool" data-wd="book">${ico('contacts')}Address book</button>
        <button type="button" class="wd-tool" data-wd="paste">${ico('content_paste')}Paste</button>
        <button type="button" class="wd-tool" data-wd="scan">${ico('qr_code_scanner')}Scan</button>
      </div>
      ${V.network ? `<div class="wd-warn">${ico('warning')}<span>Make sure the receiving platform supports ${esc(V.asset)} on ${esc(V.networkLabel)}. Sending over a network it does not support usually means the coins are gone, and nobody can reverse it.</span></div>` : ''}`;
  }

  /* ── 3 · network ─────────────────────────────────────────────────── */
  function networkHTML() {
    if (V.err) return `<div class="wd-empty">${ico('cloud_off', 'wd-empty-i')}<b>Could not load networks</b><p>${esc(V.err)}</p>
      <button type="button" class="wd-btn" data-wd="renets">Try again</button></div>`;
    if (!V.networks) return `<div class="wd-skel">${'<span></span>'.repeat(4)}</div>`;
    if (!V.networks.length) return `<div class="wd-empty">${ico('block', 'wd-empty-i')}<b>No networks available</b>
      <p>${esc(V.asset)} cannot be withdrawn right now.</p></div>`;
    return V.networks.map(n => {
      const off = n.status !== 'open';
      const fee = n.fee ? fromBase(n.fee, n.feeDecimals == null ? 18 : n.feeDecimals, 8) : null;
      const min = n.minimum ? fromBase(n.minimum, n.feeDecimals == null ? 18 : n.feeDecimals, 8) : null;
      return `<button type="button" class="wd-net${off ? ' off' : ''}" data-wd="${off ? 'netoff' : 'pick'}" data-v="${esc(n.key)}">
        <span class="wd-net-i" style="--c:${esc(n.color)}">${esc(n.code)}</span>
        <span class="wd-net-t">
          <b>${esc(n.label)}${n.tag && n.tag !== n.label ? `<i>${esc(n.tag)}</i>` : ''}</b>
          ${n.feeError
            ? `<em class="warn">${esc(n.feeError)}</em>`
            : `<em>Network fee ${esc(fee)} ${esc(n.feeUnit || '')}${n.feeBasis ? ` · ${esc(n.feeBasis)}` : ''}</em>
               <em>Minimum ${esc(min)} ${esc(n.feeUnit || '')}</em>`}
          <em class="soft">${esc(n.finality)}</em>
        </span>
        ${off ? `<span class="wd-pill off">${esc(n.status)}</span>` : ico('chevron_right', 'wd-go')}
      </button>`;
    }).join('') + `<div class="wd-note">${ico('info')}<span>Fees are quoted from each network as you look, so they move. The quote is refreshed before you confirm, and a stale one is refused rather than used.</span></div>`;
  }

  /* ── 4 · amount ──────────────────────────────────────────────────── */
  function amountHTML() {
    const d = V.decimals;
    const avail = fromBase(V.available, d, 8);
    const fee = V.fee ? fromBase(V.fee, d, 8) : null;
    const recv = V.receives ? fromBase(V.receives, d, 8) : null;
    const min = V.minimum ? fromBase(V.minimum, d, 8) : null;
    return `
      <div class="wd-dest">
        <div><span>To</span><code>${esc(shorten(V.to))}</code></div>
        <div><span>Network</span><b>${esc(V.networkLabel)}</b></div>
      </div>
      <label class="wd-amount">
        <span class="wd-amount-l">Amount</span>
        <span class="wd-amount-in">
          <input type="text" inputmode="decimal" data-wdf="amount" value="${esc(V.amount)}" placeholder="0" aria-label="Amount to withdraw">
          <b>${esc(V.asset)}</b>
          <button type="button" class="wd-max" data-wd="max">MAX</button>
        </span>
      </label>
      ${V.err ? `<p class="wd-err">${ico('error')}${esc(V.err)}</p>` : ''}
      <div class="wd-lines">
        <div><span>Available</span><b>${esc(avail)} ${esc(V.asset)}</b></div>
        ${min ? `<div><span>Minimum</span><b>${esc(min)} ${esc(V.asset)}</b></div>` : ''}
        ${fee ? `<div><span>Network fee</span><b>${esc(fee)} ${esc(V.asset)}</b></div>` : ''}
        ${V.feeBasis ? `<div class="soft"><span></span><em>${esc(V.feeBasis)}</em></div>` : ''}
        <div class="tot"><span>They receive</span><b>${recv ? esc(recv) + ' ' + esc(V.asset) : '—'}</b></div>
      </div>
      <p class="wd-hint">${ico('info')}The network fee comes out of what you send, so the amount that lands is smaller than the amount you type.</p>`;
  }

  /* ── 5 · review ──────────────────────────────────────────────────── */
  function reviewHTML() {
    const d = V.decimals;
    return `
      <div class="wd-review">
        <div class="wd-review-h"><b>${esc(fromBase(V.amount0, d, 8))} ${esc(V.asset)}</b><span>leaving your Trending balance</span></div>
        <dl class="wd-kv">
          <div><dt>Asset</dt><dd>${esc(V.asset)}</dd></div>
          <div><dt>Network</dt><dd>${esc(V.networkLabel)}</dd></div>
          <div><dt>To</dt><dd class="mono">${esc(V.to)}</dd></div>
          <div><dt>Network fee</dt><dd>${esc(fromBase(V.fee, d, 8))} ${esc(V.asset)}</dd></div>
          <div><dt>They receive</dt><dd><b>${esc(fromBase(V.receives, d, 8))} ${esc(V.asset)}</b></dd></div>
          <div><dt>Estimated arrival</dt><dd>${esc(V.finality || '—')}</dd></div>
        </dl>
      </div>
      <div class="wd-warn">${ico('warning')}<span>Check the address once more, in full. A blockchain transfer cannot be recalled by you, by the receiving platform, or by Trending.</span></div>`;
  }

  /* ── 6 · second factor ───────────────────────────────────────────── */
  function authHTML() {
    return `
      <div class="wd-auth">
        ${ico('encrypted', 'wd-auth-i')}
        <b>Enter your authenticator code</b>
        <p>Six digits from the app you set up for Trending. The code is checked on the server and each one works only once.</p>
        <input type="text" inputmode="numeric" maxlength="6" data-wdf="twoFactor" value="${esc(V.twoFactor)}"
          class="wd-code" placeholder="000000" autocomplete="one-time-code" aria-label="Authenticator code">
        ${V.err ? `<p class="wd-err">${ico('error')}${esc(V.err)}</p>` : ''}
      </div>`;
  }

  /* ── 7 · status ──────────────────────────────────────────────────── */
  const STEPS = [
    ['queued_for_signing', 'Queued'], ['signing', 'Signing'],
    ['broadcast', 'Broadcast'], ['confirming', 'Confirming'], ['completed', 'Completed']
  ];
  function statusHTML() {
    const w = V.result || {};
    const at = STEPS.findIndex(s => s[0] === w.status);
    const dead = ['cancelled', 'rejected', 'failed'].indexOf(w.status) > -1;
    const d = V.decimals;
    return `
      <div class="wd-status">
        ${dead
          ? `<span class="wd-status-i bad">${ico('cancel')}</span><b>${esc(w.status === 'cancelled' ? 'Cancelled' : 'Not sent')}</b>
             <p>${esc(w.reason || 'Your balance was released back to you.')}</p>`
          : `<span class="wd-status-i">${ico(w.status === 'completed' ? 'check_circle' : 'schedule')}</span>
             <b>${esc((STEPS[at] || ['', 'Submitted'])[1])}</b>
             <div class="wd-steps">${STEPS.map(([k, l], i) =>
               `<span class="${i < at ? 'done' : i === at ? 'now' : ''}">${esc(l)}</span>`).join('')}</div>`}
      </div>
      ${w.signerWaiting ? `<div class="wd-warn">${ico('info')}<span><b>Waiting for the signing service</b>
        Trending's server can authorise a withdrawal and hold the funds, but it cannot sign one — no key that could move your coins is kept on it. Signing happens on a separate service, and this deployment has none connected yet, so the request will sit here.</span></div>` : ''}
      <dl class="wd-kv">
        <div><dt>Amount</dt><dd>${esc(fromBase(w.amount || '0', d, 8))} ${esc(w.asset || V.asset)}</dd></div>
        <div><dt>Network</dt><dd>${esc(w.networkLabel || V.networkLabel)}</dd></div>
        <div><dt>To</dt><dd class="mono">${esc(w.to || V.to)}</dd></div>
        <div><dt>Fee</dt><dd>${esc(fromBase(w.fee || '0', d, 8))} ${esc(w.asset || V.asset)}</dd></div>
        <div><dt>They receive</dt><dd>${esc(fromBase(w.receives || '0', d, 8))} ${esc(w.asset || V.asset)}</dd></div>
        ${w.txHash ? `<div><dt>Transaction</dt><dd class="mono">${esc(shorten(w.txHash))}</dd></div>` : ''}
        <div><dt>Created</dt><dd>${esc(w.createdAt ? new Date(w.createdAt).toLocaleString() : new Date().toLocaleString())}</dd></div>
        ${w.completedAt ? `<div><dt>Completed</dt><dd>${esc(new Date(w.completedAt).toLocaleString())}</dd></div>` : ''}
      </dl>
      ${w.explorer ? `<button type="button" class="wd-btn" data-wd="explorer">${ico('open_in_new')}View transaction</button>` : ''}
      ${w.status === 'queued_for_signing' ? `<button type="button" class="wd-btn danger" data-wd="cancelwd">${ico('undo')}Cancel this withdrawal</button>` : ''}`;
  }

  function historyHTML() {
    if (!V.history) return `<div class="wd-skel">${'<span></span>'.repeat(3)}</div>`;
    if (!V.history.length) return `<div class="wd-empty">${ico('inbox', 'wd-empty-i')}<b>No withdrawals yet</b>
      <p>Withdrawals you make will be listed here with their status and transaction.</p></div>`;
    return V.history.map(w => `<button type="button" class="wd-hrow" data-wd="openwd" data-v="${esc(w.id)}">
      <span class="wd-hrow-t"><b>${esc(fromBase(w.amount, decimalsOf(w.asset), 8))} ${esc(w.asset)}</b>
        <em>${esc(w.networkLabel)} · ${esc(shorten(w.to))}</em></span>
      <span class="wd-pill ${w.status === 'completed' ? 'ok' : w.status === 'failed' || w.status === 'cancelled' ? 'off' : 'wait'}">${esc(w.status.replace(/_/g, ' '))}</span>
    </button>`).join('');
  }

  /* ── Footer button ───────────────────────────────────────────────── */
  function footHTML() {
    if (V.screen === 'method' || V.screen === 'network' || V.screen === 'history' || V.screen === 'nocustody') return '';
    const cfg = {
      address: ['Next', !!(V.network && V.addressOk), 'toamount'],
      amount: ['Next', !!(V.receives && BigInt(V.receives) > 0n && !V.err), 'toreview'],
      review: ['Confirm withdrawal', true, 'confirm'],
      auth: ['Confirm', V.twoFactor.replace(/\D/g, '').length === 6, 'submit'],
      status: ['Done', true, 'done']
    }[V.screen];
    if (!cfg) return '';
    const [label, on, action] = cfg;
    return `<div class="wd-foot">
      <button type="button" class="wd-cta${on ? '' : ' off'}" data-wd="${on ? action : 'nope'}"${on ? '' : ' aria-disabled="true"'}>
        ${V.busy ? '<span class="wd-spin" aria-hidden="true"></span>' : ''}${esc(label)}
      </button>
    </div>`;
  }
  function syncFoot() { const f = $('wd-foot'); if (f) f.innerHTML = footHTML(); }

  const shorten = a => { const s = String(a || ''); return s.length > 22 ? s.slice(0, 10) + '…' + s.slice(-8) : s; };

  /* ══ Behaviour ═══════════════════════════════════════════════════ */
  async function act(what, v) {
    if (!V) return;
    switch (what) {
      case 'cancel': cancelFlow(); return;
      case 'back': back(); return;
      case 'nope': return;
      case 'method':
        if (v === 'internal') { close(); if (typeof PAY !== 'undefined' && PAY.openPayTo) PAY.openPayTo(); return; }
        if (v === 'p2p') { close(); if (typeof P2P !== 'undefined' && P2P.setSide) P2P.setSide('sell'); navigateTo('p2p'); return; }
        preflight(); return;
      case 'ownsend':
        close();
        if (typeof SC !== 'undefined' && SC.open) SC.open({});
        else if (typeof WAD !== 'undefined' && WAD.open) WAD.open();
        return;
      case 'net': go('network'); loadNetworks(); return;
      case 'renets': V.err = ''; paint(); loadNetworks(true); return;
      case 'pick': pickNetwork(v); return;
      case 'netoff': toast('Withdrawals on that network are paused right now.'); return;
      case 'paste': paste(); return;
      case 'scan': scan(); return;
      case 'book': book(); return;
      case 'usebook': V.to = v; V.addressSource = 'book'; closeBook(); checkAddress(); paint(); return;
      case 'help': help(); return;
      case 'netinfo': netInfo(); return;
      case 'history': go('history'); loadHistory(); return;
      case 'openwd': openOne(v); return;
      case 'max': setMax(); return;
      case 'toamount': toAmount(); return;
      case 'toreview': toReview(); return;
      case 'confirm': go('auth'); return;
      case 'submit': submit(); return;
      case 'explorer':
        if (V.result && V.result.explorer) window.open(V.result.explorer, '_blank', 'noopener,noreferrer');
        return;
      case 'cancelwd': cancelWithdrawal(); return;
      case 'done': close(true); return;
    }
  }

  /* Does this deployment hold crypto at all? Asked once, before the
     user is walked through three screens that cannot end in a send. */
  async function preflight() {
    V.busy = true;
    go('address');                                   // optimistic, corrected below
    const r = await api('/api/crypto/config');
    if (!V) return;
    V.busy = false;
    const holds = r.ok && r.data && r.data.custody && r.data.custody !== 'none';
    if (!holds) {
      /* Nothing is held for anyone on this build, so a send is made from
         the person's own wallet — which is what the crypto-network send
         screen is built for. It used to stop here with "your crypto is
         already in your own wallet" and two buttons. */
      if (typeof SC !== 'undefined' && SC.open) { close(true); SC.open({}); return; }
      V.screen = 'nocustody'; paint(); return;
    }
    paint();
  }

  /* ── Networks, with live fees ────────────────────────────────────── */
  async function loadNetworks(force) {
    if (V.networks && !force) return;
    try {
      const r = await api(`/api/crypto/assets/${encodeURIComponent(V.asset)}/networks`);
      if (!r.ok) throw new Error(r.data.message || 'The server did not answer.');
      const list = r.data.networks || [];
      /* Each network is priced on its own; one that cannot be quoted says
         so on its card rather than showing a number from somewhere else. */
      await Promise.all(list.map(async n => {
        const q = await api('/api/crypto/withdraw/quote', { asset: V.asset, network: n.key });
        if (q.ok && q.data.ok) {
          n.fee = q.data.fee; n.minimum = q.data.minimum;
          n.feeUnit = q.data.feeUnit; n.feeBasis = q.data.feeBasis;
          n.feeDecimals = V.decimals;
        } else {
          /* Server-side reasons a user cannot act on are not worth
             repeating on every card. */
          const raw = (q.data && q.data.message) || '';
          n.feeError = /session secret|Firebase project|database|custody/i.test(raw)
            ? 'Unavailable on this build.'
            : (raw || 'Fee unavailable right now.');
        }
      }));
      V.networks = list;
    } catch (e) { V.err = e.message; }
    if (V && V.screen === 'network') paint();
  }

  function pickNetwork(key) {
    const n = (V.networks || []).find(x => x.key === key);
    if (!n) return;
    V.network = key;
    V.networkLabel = n.label;
    V.finality = n.finality;
    V.fee = n.fee || null;
    V.minimum = n.minimum || null;
    V.feeBasis = n.feeBasis || '';
    back();                                    // straight back to the address screen
    checkAddress();
    paint();
  }

  /* ── Address ─────────────────────────────────────────────────────── */
  let checkTimer = null;
  function checkAddress() {
    clearTimeout(checkTimer);
    if (!V.network || !V.to.trim()) { V.addressOk = null; syncFoot(); return; }
    checkTimer = setTimeout(async () => {
      const r = await api('/api/crypto/withdraw/validate', { network: V.network, address: V.to.trim() });
      if (!V) return;
      V.addressOk = !!r.data.valid;
      V.addressChecksum = !!r.data.checksum;
      V.addressMsg = r.data.message || '';
      if (V.addressOk && r.data.normalized) V.to = r.data.normalized;
      paint();
    }, 250);
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { toast('There is nothing on the clipboard.'); return; }
      V.to = text.trim().split(/\s+/)[0];
      V.addressSource = 'paste';
      checkAddress();
      paint();
    } catch (e) { toast('This browser would not share the clipboard. Paste into the field instead.'); }
  }

  /* Reuses the scanner the wallet already has, and accepts a payment URI
     as well as a bare address. */
  function scan() {
    if (typeof WAD !== 'undefined' && WAD.parseScan && typeof PAY !== 'undefined' && PAY.openScan) {
      close(true);
      PAY.openScan();
      toast('Scan the code, then paste the address into the withdrawal.');
      return;
    }
    toast('The scanner is unavailable here — paste the address instead.');
  }

  /* ── Address book ────────────────────────────────────────────────── */
  const bookList = () => { const v = read(BKEY); return Array.isArray(v) ? v : []; };
  function book() {
    const rows = bookList().filter(b => !V.network || b.network === V.network);
    const el = document.createElement('div');
    el.className = 'mob-scrim';
    el.id = 'wd-book';
    el.innerHTML = `<div class="mob-sheet" role="dialog" aria-modal="true" aria-label="Address book">
      <span class="mob-grab" aria-hidden="true"></span>
      <b class="wd-book-t">Address book</b>
      ${rows.length ? rows.map(b => `<button type="button" class="wd-row sm" data-wd="usebook" data-v="${esc(b.address)}">
          <span class="wd-row-t"><b>${esc(b.label)}</b><em>${esc(shorten(b.address))} · ${esc(b.networkLabel || b.network)}</em></span>
        </button>`).join('')
        : `<p class="wd-hint">${ico('info')}No saved addresses${V.network ? ' for ' + esc(V.networkLabel) : ''} yet. An address you send to is offered for saving afterwards.</p>`}
    </div>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-wd]');
      if (b) { act(b.dataset.wd, b.dataset.v); return; }
      if (e.target === el) el.remove();
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));
  }
  const closeBook = () => { const el = $('wd-book'); if (el) el.remove(); };

  async function offerSave() {
    if (!V || V.addressSource === 'book' || typeof appPrompt !== 'function') return;
    const name = await appPrompt('Save this address for next time?', '', { title: 'Name it', ok: 'Save', cancel: 'Not now' });
    if (!name) return;
    const list = bookList().filter(b => !(b.address === V.to && b.network === V.network));
    list.unshift({ label: String(name).slice(0, 30), address: V.to, network: V.network, networkLabel: V.networkLabel, at: Date.now() });
    write(BKEY, list.slice(0, 40));
  }

  /* ── Amount ──────────────────────────────────────────────────────── */
  async function toAmount() {
    V.busy = true; syncFoot();
    const r = await api('/api/crypto/withdraw/quote', { asset: V.asset, network: V.network });
    V.busy = false;
    if (!r.data || !r.data.ok) {
      V.err = (r.data && r.data.message) || 'Could not price that network.';
      paint();
      toast(V.err);
      return;
    }
    V.available = r.data.available;
    V.fee = r.data.fee;
    V.minimum = r.data.minimum;
    V.feeBasis = r.data.feeBasis || '';
    V.finality = r.data.estimatedArrival || V.finality;
    go('amount');
  }

  function onAmount() {
    const units = toBase(V.amount, V.decimals);
    if (units == null) { V.err = `More decimal places than ${V.asset} has.`; V.receives = null; syncFoot(); return; }
    const fee = BigInt(V.fee || '0');
    const avail = BigInt(V.available || '0');
    const min = BigInt(V.minimum || '0');
    V.err = '';
    if (units === 0n) V.receives = null;
    else if (units > avail) { V.err = 'More than your available balance.'; V.receives = null; }
    else if (units < min) { V.err = `Below the ${fromBase(min, V.decimals, 8)} ${V.asset} minimum for this network.`; V.receives = null; }
    else V.receives = (units - fee).toString();
    const lines = $('wd-body').querySelector('.wd-lines');
    if (lines) paintAmountLines();
    syncFoot();
  }
  function paintAmountLines() {
    const body = $('wd-body');
    if (!body) return;
    const tot = body.querySelector('.wd-lines .tot b');
    if (tot) tot.textContent = V.receives ? fromBase(V.receives, V.decimals, 8) + ' ' + V.asset : '—';
    const err = body.querySelector('.wd-err');
    if (V.err && !err) paint();
    else if (!V.err && err) err.remove();
    else if (V.err && err) err.innerHTML = ico('error') + esc(V.err);
  }

  function setMax() {
    /* Everything, right down to the fee — anything less and the user is
       left with dust they cannot move. */
    V.amount = fromBase(V.available, V.decimals, V.decimals);
    const inp = $('wd-body').querySelector('[data-wdf="amount"]');
    if (inp) inp.value = V.amount;
    onAmount();
    paint();
  }

  function toReview() {
    V.amount0 = toBase(V.amount, V.decimals).toString();
    go('review');
  }

  /* ── Submit ──────────────────────────────────────────────────────── */
  async function submit() {
    if (V.busy) return;
    V.busy = true; V.err = ''; syncFoot();
    /* One key per attempt at THIS withdrawal. A retry after a dropped
       response returns the first one rather than sending twice. */
    if (!V.idempotencyKey) {
      V.idempotencyKey = 'wd_' + Date.now().toString(36) + '_' +
        (crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14));
    }
    const r = await api('/api/crypto/withdraw', {
      asset: V.asset, network: V.network, to: V.to,
      amount: V.amount0, twoFactor: V.twoFactor
    });
    V.busy = false;
    if (!r.data || !r.data.ok) {
      V.err = (r.data && r.data.message) || 'That could not be submitted.';
      /* A rejected code must not burn the idempotency key: the next
         attempt is the same withdrawal, not a new one. */
      paint();
      return;
    }
    V.result = r.data.withdrawal;
    go('status');
    offerSave();
  }

  async function cancelWithdrawal() {
    if (!V.result || typeof appConfirm !== 'function') return;
    const ok = await appConfirm('Cancel this withdrawal and release the funds back to your balance?', { ok: 'Cancel it', danger: true });
    if (!ok) return;
    const r = await api(`/api/crypto/withdrawals/${encodeURIComponent(V.result.id)}/cancel`, {});
    if (r.data && r.data.ok) { V.result = r.data.withdrawal; paint(); toast('Cancelled — your balance is back'); }
    else toast((r.data && r.data.message) || 'It could not be cancelled.');
  }

  async function loadHistory() {
    const r = await api('/api/crypto/withdrawals');
    V.history = (r.data && r.data.withdrawals) || [];
    if (V.screen === 'history') paint();
  }
  async function openOne(id) {
    const r = await api(`/api/crypto/withdrawals/${encodeURIComponent(id)}`);
    if (r.data && r.data.withdrawal) { V.result = r.data.withdrawal; V.decimals = decimalsOf(V.result.asset); go('status'); }
  }

  function help() {
    if (typeof appConfirm !== 'function') return;
    appConfirm(
      'The address and the network both have to match what the receiving wallet expects. If either is wrong the coins usually cannot be recovered — not by Trending, and not by the receiving platform. Copy the address from the app you are sending to, and pick the same network it lists.',
      { title: 'Getting this right', ok: 'Got it', cancel: '' });
  }
  function netInfo() {
    if (typeof appConfirm !== 'function') return;
    appConfirm(
      'A coin can exist on several chains, and the same coin on two chains is not interchangeable. Pick the chain the receiving wallet names for this asset. Fees and speed differ between them, and the cheapest is not always supported where you are sending.',
      { title: 'About networks', ok: 'Got it', cancel: '' });
  }

  return {
    open, close, act, paint, toBase, fromBase, decimalsOf,
    get state() { return V; }
  };
})();

window.WD = WD;

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
publish('features/withdraw.js', {
  WD: () => WD
});
