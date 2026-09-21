/* ╔══════════════════════════════════════════════════════════════════╗
   ║  PAYFLOW — one way of paying, whichever screen you start from     ║
   ║                                                                   ║
   ║  Money leaves you by one of two routes, and every send and        ║
   ║  request screen now names them the same way:                      ║
   ║                                                                   ║
   ║   · Trending balance — your in-app money moves to their Trending  ║
   ║     account. Instant, free, and all you need is who they are.     ║
   ║   · Crypto wallet    — a real on-chain transfer to a wallet       ║
   ║     address. It costs a network fee and you send it from your own ║
   ║     wallet app; Trending never signs or broadcasts anything.      ║
   ║                                                                   ║
   ║  Chat, Pay, the Wallet tab and the wallet-address sheet used to   ║
   ║  describe these in their own words ("In Trending", "Wallet        ║
   ║  address", "internal transfer"), and each drew its own summary.   ║
   ║  This file holds the words, the summary and the network fee, so   ║
   ║  a payment reads the same wherever it is made.                    ║
   ║                                                                   ║
   ║  The network fee comes from /api/fees (services/fees.js): what    ║
   ║  the chain is charging now, at up to three speeds. When the chain ║
   ║  doesn't answer, no fee is shown — never a guessed one.           ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const PF = (() => {

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
  const ico = (n, cls) => `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}" aria-hidden="true">${n}</span>`;
  const hasMNY = () => typeof MNY !== 'undefined';

  /* ── Numbers ─────────────────────────────────────────────────────── */
  /* Fees are tiny fractions of a coin; eight decimals of them is noise.
     Two significant figures says what matters without scientific notation. */
  function coinAmt(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return '0';
    const a = Math.abs(n);
    if (a >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
    return Number(n.toPrecision(2)).toLocaleString('en-US', { maximumFractionDigits: 12 });
  }
  const qty = v => (hasMNY() ? MNY.qty(v) : coinAmt(v));

  /* A dollar figure only where a live market prices the coin. */
  function usdOf(amount, coin) {
    if (!hasMNY()) return '';
    const q = MNY.quote(coin);
    if (!q.known || !q.live) return '';
    const v = Number(amount) * q.usd;
    if (!(v > 0)) return '';
    return v < 0.01 ? '< $0.01' : MNY.usd(v);
  }

  /* ── The two routes ──────────────────────────────────────────────── */
  /* kind: 'send' | 'request'.  onApp / onChain: the handler for each card,
     or '' for the card that is already chosen. */
  function lanes(o) {
    const k = o.kind === 'request' ? 'request' : 'send';
    const who = o.who ? esc(o.who) : '';
    const app = k === 'send'
      ? { t: 'Trending balance', s: who ? `Straight to ${who}’s Trending account` : 'Straight to their Trending account', f: ['Instant', 'Free', 'No address'] }
      : { t: 'Trending balance', s: 'Paid into your Trending balance', f: ['Instant', 'Free', 'No address'] };
    const chain = k === 'send'
      ? { t: 'Crypto wallet', s: 'On-chain, from your own wallet app', f: ['Network fee', 'Minutes', 'Their address'] }
      : { t: 'Crypto wallet', s: 'They pay on-chain to your wallet address', f: ['They pay the fee', 'Minutes', 'Your address'] };
    const card = (id, c, icon, on, handler) => `
      <button type="button" class="pf-lane${on ? ' on' : ''}" ${on ? 'aria-pressed="true"' : `aria-pressed="false" onclick="${handler}"`}>
        <span class="pf-lane-i">${ico(icon)}</span>
        <span class="pf-lane-t"><b>${c.t}</b><em>${c.s}</em></span>
        <span class="pf-lane-f">${c.f.map((x, i) => `<i class="${id === 'app' && i < 2 ? 'good' : ''}">${esc(x)}</i>`).join('')}</span>
        ${on ? ico('check_circle', 'pf-lane-on') : ico('chevron_right', 'pf-lane-go')}
      </button>`;
    return `<div class="pf-lanes" role="group" aria-label="How to ${k === 'send' ? 'pay' : 'get paid'}">
      <div class="pf-lanes-q">${k === 'send' ? 'How do you want to pay?' : 'How should they pay you?'}</div>
      ${card('app', app, 'bolt', o.active !== 'chain', o.onApp || '')}
      ${card('chain', chain, 'link', o.active === 'chain', o.onChain || '')}
    </div>`;
  }

  /* ── The summary every payment ends with ─────────────────────────── */
  function summary(rows) {
    return `<div class="pf-sum">${rows.filter(Boolean).map(([l, v, cls]) =>
      `<div class="pf-line${cls ? ' ' + cls : ''}"><span>${esc(l)}</span><b>${v}</b></div>`).join('')}</div>`;
  }

  /* A Trending-balance payment: nothing is lost on the way, so what they
     receive is what you send, and the fee line says why it is zero. */
  function appRows(o) {
    const amt = Number(o.amount) || 0;
    const coin = String(o.coin || '');
    const usd = usdOf(amt, coin);
    const rows = [
      ['You send', `${esc(qty(amt))} ${esc(coin)}${usd ? ` <small>${esc(usd)}</small>` : ''}`],
      ['Network fee', 'Free <small>stays inside Trending</small>', 'free'],
      [`${o.who ? o.who.split(/\s+/)[0] : 'They'} receive${o.who ? 's' : ''}`, `${esc(qty(amt))} ${esc(coin)}`],
      ['Arrives', 'Instantly']
    ];
    if (o.after != null) rows.push(['Your balance after', `${esc(qty(Math.max(0, o.after)))} ${esc(coin)}`, o.after < -1e-12 ? 'short' : '']);
    return rows;
  }

  /* ── Network fee ─────────────────────────────────────────────────── */
  const cache = new Map();       // `${net}:${token}` -> { at, est } | { at, promise }
  const TTL = 30000;
  const SPEED_NAME = { slow: 'Slow', standard: 'Standard', fast: 'Fast' };

  function fetchFee(net, token) {
    const key = `${net}:${token ? 1 : 0}`;
    const hit = cache.get(key);
    if (hit && hit.est && Date.now() - hit.at < TTL) return Promise.resolve(hit.est);
    if (hit && hit.promise) return hit.promise;
    const promise = fetch(`/api/fees/${encodeURIComponent(net)}?token=${token ? 1 : 0}`, { headers: { Accept: 'application/json' } })
      .then(r => r.json().catch(() => ({ ok: false, reason: 'The fee service answered with nothing usable.' })))
      .catch(() => ({ ok: false, reason: 'The fee service could not be reached.' }))
      .then(est => {
        // A failure is not cached for long: the next look should try again.
        cache.set(key, est.ok ? { at: Date.now(), est } : { at: Date.now() - TTL + 5000, est });
        return est;
      });
    cache.set(key, { at: Date.now(), promise });
    return promise;
  }

  /* What is already known, without waiting. */
  function cached(net, token) {
    const hit = cache.get(`${net}:${token ? 1 : 0}`);
    return hit && hit.est && Date.now() - hit.at < TTL ? hit.est : null;
  }

  function tierOf(est, speed) {
    if (!est || !est.ok || !est.tiers || !est.tiers.length) return null;
    return est.tiers.find(t => t.speed === speed) || est.tiers.find(t => t.speed === 'standard') || est.tiers[0];
  }

  const feeText = (t, coin) => `${coinAmt(t.amount)}${t.amountMax ? '–' + coinAmt(t.amountMax) : ''} ${coin}`;
  const feeUsd = (t, coin) => {
    const a = usdOf(t.amount, coin);
    if (!a) return '';
    return t.amountMax ? `${a}–${usdOf(t.amountMax, coin)}` : a;
  };

  /* The picker. `o`: { net, label, token, coin (what is being sent), speed,
     onPick (a global function name taking the speed) } */
  function feeBody(est, o) {
    if (!est) return `<div class="pf-fee-wait">${ico('progress_activity', 'pf-spin')} Checking ${esc(o.label || 'the network')} for its current fee…</div>`;
    if (!est.ok) {
      return `<div class="pf-fee-err">${ico('cloud_off')}<span>${esc(est.reason || 'No fee estimate right now.')}
        Your wallet app shows the exact fee before you send.</span>
        <button type="button" class="pf-link" onclick="PF.retry('${esc(o.net)}', ${o.token ? 1 : 0})">Try again</button></div>`;
    }
    const chosen = tierOf(est, o.speed);
    const speeds = est.tiers.length > 1
      ? `<div class="pf-speeds" role="radiogroup" aria-label="Network fee speed">${est.tiers.map(t => {
          const on = chosen && t.speed === chosen.speed;
          const u = feeUsd(t, est.coin);
          return `<button type="button" role="radio" aria-checked="${on}" class="pf-speed${on ? ' on' : ''}"
              onclick="${esc(o.onPick)}('${t.speed}')">
            <b>${SPEED_NAME[t.speed] || t.speed}</b>
            <span>${esc(feeText(t, est.coin))}</span>
            <em>${u ? esc(u) + ' · ' : ''}${esc(t.eta)}</em>
          </button>`;
        }).join('')}</div>`
      : (() => {
          const t = est.tiers[0], u = feeUsd(t, est.coin);
          return `<div class="pf-speed one on"><b>${esc(feeText(t, est.coin))}</b><em>${u ? esc(u) + ' · ' : ''}${esc(t.eta)}</em></div>`;
        })();
    const extra = est.extra ? `<div class="pf-fee-x">+ ${esc(coinAmt(est.extra.amount))} ${esc(est.coin)} ${esc(est.extra.why)}</div>` : '';
    const inGas = o.coin && o.coin !== est.coin
      ? `Paid in <b>${esc(est.coin)}</b>, not ${esc(o.coin)} — the wallet you send from needs a little ${esc(est.coin)} too.`
      : `Paid in <b>${esc(est.coin)}</b> on top of the amount.`;
    return `${speeds}${extra}
      <div class="pf-fee-n">${inGas} Set the speed in your wallet app; it shows the exact fee before you confirm.${est.note ? ' ' + esc(est.note) : ''}</div>`;
  }

  function feeHTML(o) {
    const est = cached(o.net, o.token);
    return `<div class="pf-fee" id="pf-fee" data-net="${esc(o.net)}">
      <div class="pf-fee-h"><span>Network fee</span><em>estimate, live from ${esc(o.label || 'the network')}</em></div>
      <div id="pf-fee-b">${feeBody(est, o)}</div>
    </div>`;
  }

  /* Fill the picker once the network answers. Only repaints if the same
     network is still on screen, so a quick change of chain can't be
     overwritten by the answer for the previous one. */
  function loadFee(o) {
    if (cached(o.net, o.token)) return;
    fetchFee(o.net, o.token).then(est => {
      const box = document.getElementById('pf-fee');
      const body = document.getElementById('pf-fee-b');
      if (!box || !body || box.dataset.net !== o.net) return;
      body.innerHTML = feeBody(est, o);
      if (typeof o.onLoad === 'function') o.onLoad(est);
    });
  }

  let lastLoad = null;
  function retry(net, token) {
    cache.delete(`${net}:${token ? 1 : 0}`);
    const body = document.getElementById('pf-fee-b');
    if (body) body.innerHTML = feeBody(null, { label: '' });
    if (lastLoad && lastLoad.net === net) loadFee(lastLoad);
  }
  function feeWidget(o) { lastLoad = o; setTimeout(() => loadFee(o), 0); return feeHTML(o); }

  /* The chosen fee as one line, for a review screen. */
  function feeLine(net, token, speed) {
    const est = cached(net, token);
    const t = tierOf(est, speed);
    if (!t) return { text: 'Shown in your wallet app', usd: '' };
    return { text: `${feeText(t, est.coin)}`, usd: feeUsd(t, est.coin), speed: SPEED_NAME[t.speed] || '', eta: t.eta, coin: est.coin, tier: t, est };
  }

  return {
    lanes, summary, appRows, usdOf, coinAmt,
    fee: fetchFee, cached, tierOf, feeWidget, feeLine, retry,
    get SPEED_NAME() { return SPEED_NAME; }
  };
})();

window.PF = PF;

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module, so its top-level names are private to it.
   Inline onclick= handlers and every other module still look them up
   on the global object, so they are republished here. */
import { publish } from '../globals.js?v=3';
publish('features/payflow.js', {
  PF: () => PF
});
