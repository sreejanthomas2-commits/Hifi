/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CONVERT — one coin into another, in one step                     ║
   ║                                                                   ║
   ║  The Assets row used to offer "Trade", which sent you to the      ║
   ║  order book to work out a pair, a side and a price. Turning 1 BTC ║
   ║  into SOL is not a trading decision, so it should not need one.   ║
   ║                                                                   ║
   ║  This is the single conversion engine. The Wallet tab's panel and ║
   ║  the Convert button on every balance row both come through here,  ║
   ║  so the rate, the fee and the ledger entry cannot drift apart the ║
   ║  way the rest of the payment system had.                          ║
   ║                                                                   ║
   ║  Honesty rules, which are the whole point:                        ║
   ║                                                                   ║
   ║  · BOTH sides need a live market price. A token the app prices    ║
   ║    by declared reference has no market to convert at, so it is    ║
   ║    refused by name rather than converted at a number we made up.  ║
   ║                                                                   ║
   ║  · The rate moves while you read it. The quote is taken again at  ║
   ║    the moment you confirm, and if the result has moved more than  ║
   ║    a whisker you are shown the new figure and asked again — you   ║
   ║    never get a different deal than the one on the button.         ║
   ║                                                                   ║
   ║  · It spends through MNY, so a conversion draws on the same       ║
   ║    balance a payment does and lands in the same history.          ║
   ║                                                                   ║
   ║  Paper money. Nothing is traded on any exchange.                  ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CVT = (() => {

  const FEE = 0.01;                  // the platform fee, as the Wallet panel charged
  const DRIFT = 0.005;               // 0.5% — how far the rate may move before we re-ask

  let V = null;                      // { from, to, amount, step, quoted, done } while open

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const attr = s => esc(JSON.stringify(String(s)));
  const ico = n => `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
  const coin = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const has = () => typeof MNY !== 'undefined';
  const qty = v => (has() ? MNY.qty(v) : String(v || 0));
  const usd = v => (has() ? MNY.usd(v) : '$0.00');
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const sym_ = s => String(s == null ? '' : s).toUpperCase().trim();

  /* ── What can be converted ───────────────────────────────────────── */
  /* A live market on both sides, or there is no honest rate to use. */
  function canConvert(s) { return has() && MNY.isLive(s); }

  function whyNot(s) {
    if (!has()) return 'Accounts are still loading.';
    const q = MNY.quote(s);
    if (q.reference) return `${sym_(s)} has no market yet — its price here is a reference, not something to convert at.`;
    if (!q.known) return `There is no price for ${sym_(s)} right now.`;
    return '';
  }

  /* Coins you hold first, then everything with a live price. */
  function options() {
    if (!has()) return ['USDT'];
    return MNY.assets().filter(canConvert);
  }

  /* ── The quote ───────────────────────────────────────────────────── */
  /* Pure: given two coins and an amount it returns what you would get
     right now, and refuses rather than guessing. */
  function quote(from, to, amount) {
    const f = sym_(from), t = sym_(to), amt = num(amount);
    if (!f || !t) return { ok: false, why: 'Pick two coins.' };
    if (f === t) return { ok: false, why: 'Pick two different coins.' };
    if (!canConvert(f)) return { ok: false, why: whyNot(f) };
    if (!canConvert(t)) return { ok: false, why: whyNot(t) };

    const px = MNY.price(f), pxTo = MNY.price(t);
    if (!(px > 0) || !(pxTo > 0)) return { ok: false, why: 'Waiting for a live price on both sides.' };

    const rate = (px / pxTo) * (1 - FEE);          // what one unit becomes, after the fee
    if (!(amt > 0)) return { ok: false, why: 'Enter an amount.', rate, px, pxTo, zero: true };

    const have = MNY.spendable(f);
    const usdIn = amt * px;
    const feeQty = amt * FEE;
    const out = amt * rate;

    return {
      ok: true, from: f, to: t, amount: amt, out, rate,
      px, pxTo, usdIn, feeQty, feeUsd: feeQty * px,
      have, short: amt > have + 1e-12
    };
  }

  /* ── Doing it ────────────────────────────────────────────────────── */
  /* Both legs go through MNY: the coin leaves the way a payment leaves,
     the new one arrives the way a payment arrives, and both are in the
     history. `expect` is the figure the person agreed to — if the rate
     has moved past DRIFT since then this refuses and hands back the new
     number rather than converting at a rate nobody saw. */
  function execute(from, to, amount, opts) {
    const o = opts || {};
    const q = quote(from, to, amount);
    if (!q.ok) return { ok: false, msg: q.why };
    if (q.short) return { ok: false, msg: `Not enough ${q.from}. You hold ${qty(q.have)}.` };

    if (o.expect > 0) {
      const drift = Math.abs(q.out - o.expect) / o.expect;
      if (drift > DRIFT) {
        return {
          ok: false, moved: true, quote: q,
          msg: `The rate moved — ${qty(q.amount)} ${q.from} is now ${qty(q.out)} ${q.to}.`
        };
      }
    }

    const paid = MNY.spend(q.from, q.amount, {
      kind: 'swap', via: 'Convert', to: q.to, note: `Converted to ${q.to}`
    });
    if (!paid.ok) return { ok: false, msg: paid.msg };

    /* Already your own money changing shape, so it does not go through
       the daily cap that exists to stop simulated contacts minting. */
    const got = MNY.receive(q.to, q.out, {
      kind: 'swap', via: 'Convert', from: q.from, simulated: false, note: `Converted from ${q.from}`
    });
    if (!got.ok) {
      MNY.receive(q.from, q.amount, { kind: 'receive', via: 'Convert reversed', simulated: false });
      return { ok: false, msg: 'The conversion could not be completed.' };
    }

    return {
      ok: true, quote: q, out: q.out, moved: paid.moved || 0,
      msg: `Converted ${qty(q.amount)} ${q.from} to ${qty(q.out)} ${q.to}`
    };
  }

  /* ── The sheet ───────────────────────────────────────────────────── */
  function open(from, to) {
    if (!has()) { toast('Accounts are still loading…'); return; }
    const list = options();
    if (!list.length) { toast('No coin has a live price right now.'); return; }

    let f = sym_(from);
    if (!f || !canConvert(f)) {
      if (f) { toast(whyNot(f)); return; }
      f = list[0];
    }
    const t = sym_(to) && canConvert(to) && sym_(to) !== f
      ? sym_(to)
      : (f === 'USDT' ? (list.find(s => s !== 'USDT') || 'USDT') : 'USDT');

    V = { from: f, to: t, amount: '', step: 'form', quoted: null, done: null };
    render();
  }

  function close() {
    const s = document.getElementById('cvt-scrim');
    if (s) s.remove();
    V = null;
  }

  function render() {
    if (!V) return;
    let scrim = document.getElementById('cvt-scrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.id = 'cvt-scrim';
      scrim.className = 'cvt-scrim';
      scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
      document.body.appendChild(scrim);
    }
    scrim.innerHTML = `<div class="cvt-card" role="dialog" aria-label="Convert">
      <div class="cvt-head">
        ${V.step === 'review'
          ? `<button class="icon-btn" onclick="CVT.back()" aria-label="Back">${ico('arrow_back')}</button>`
          : '<span class="cvt-kicker">WALLET</span>'}
        <h3 class="cvt-title">${V.step === 'done' ? 'Converted' : V.step === 'review' ? 'Confirm' : 'Convert'}</h3>
        <button class="icon-btn" onclick="CVT.close()" aria-label="Close">${ico('close')}</button>
      </div>
      <div class="cvt-body">${V.step === 'done' ? doneHTML() : V.step === 'review' ? reviewHTML() : formHTML()}</div>
    </div>`;
    if (V.step === 'form') {
      const el = document.getElementById('cvt-amt');
      if (el) el.focus({ preventScroll: true });
    }
  }

  const picker = (side, cur) => `<select class="cvt-sel" aria-label="${side === 'from' ? 'Coin to convert' : 'Coin to receive'}"
      onchange="CVT.field(${attr(side)}, this.value)">
    ${options().map(s => `<option value="${esc(s)}"${s === cur ? ' selected' : ''}>${esc(s)}</option>`).join('')}
  </select>`;

  function formHTML() {
    const q = quote(V.from, V.to, V.amount);
    const have = MNY.spendable(V.from);
    const inSpot = MNY.balanceOf(V.from, 'spot');
    const amt = num(V.amount);
    const ready = q.ok && !q.short;

    return `
      <div class="cvt-leg">
        <div class="cvt-leg-h"><span>From</span>
          <button type="button" class="cvt-max" onclick="CVT.max()">Max</button></div>
        <div class="cvt-leg-row">
          <input class="cvt-amt" id="cvt-amt" type="number" step="any" inputmode="decimal" placeholder="0.00"
                 value="${esc(V.amount)}" oninput="CVT.setAmount(this.value)" aria-label="Amount to convert">
          <span class="cvt-coin">${coin(V.from, 22)}${picker('from', V.from)}</span>
        </div>
        <div class="cvt-leg-b">
          Available <b>${esc(qty(have))} ${esc(V.from)}</b>
          ${inSpot > 0 && inSpot < have ? ` · ${esc(qty(inSpot))} in Spot` : ''}
          ${amt > 0 && q.usdIn ? ` · ≈ ${esc(usd(q.usdIn))}` : ''}
        </div>
        ${q.short ? `<div class="cvt-warn">${ico('error')} You hold ${esc(qty(have))} ${esc(V.from)}.</div>` : ''}
      </div>

      <button type="button" class="cvt-flip" onclick="CVT.flip()" aria-label="Swap the two coins">${ico('swap_vert')}</button>

      <div class="cvt-leg">
        <div class="cvt-leg-h"><span>To</span><span class="cvt-est">estimated</span></div>
        <div class="cvt-leg-row">
          <output class="cvt-amt cvt-out" id="cvt-out">${q.ok ? esc(qty(q.out)) : '0.00'}</output>
          <span class="cvt-coin">${coin(V.to, 22)}${picker('to', V.to)}</span>
        </div>
        <div class="cvt-leg-b">Lands in your Funding account</div>
      </div>

      <div class="cvt-rate" id="cvt-rate">${rateHTML(q)}</div>

      <button type="button" class="btn btn-primary w100 cvt-go" onclick="CVT.review()" ${ready ? '' : 'disabled'}>
        ${q.ok || q.zero ? 'Preview conversion' : esc(q.why || 'Convert')}
      </button>
      <div class="cvt-fine">Simulated balances. The rate is live and moves — it is taken again when you confirm.</div>`;
  }

  function rateHTML(q) {
    if (!q.rate) return `<span class="cvt-rate-w">${esc(q.why || 'Waiting for a live price on both sides.')}</span>`;
    return `<span>1 ${esc(q.from || V.from)} ≈ <b>${esc(qty(q.rate))} ${esc(q.to || V.to)}</b></span>
            <span class="cvt-rate-f">${(FEE * 100).toFixed(1)}% fee${q.feeQty ? ` · ${esc(qty(q.feeQty))} ${esc(q.from)}` : ''}</span>`;
  }

  function reviewHTML() {
    const q = V.quoted;
    if (!q) return '<div class="cvt-warn">That quote expired. Go back and try again.</div>';
    const row = (l, v, cls) => `<div class="cvt-row"><span>${esc(l)}</span><b class="${cls || ''}">${v}</b></div>`;
    return `
      <div class="cvt-sum">
        <div class="cvt-sum-t">${coin(q.from, 26)}<b>${esc(qty(q.amount))} ${esc(q.from)}</b></div>
        <div class="cvt-sum-a">${ico('arrow_downward')}</div>
        <div class="cvt-sum-t">${coin(q.to, 26)}<b>${esc(qty(q.out))} ${esc(q.to)}</b></div>
      </div>
      <div class="cvt-rows">
        ${row('Rate', `1 ${esc(q.from)} ≈ ${esc(qty(q.rate))} ${esc(q.to)}`)}
        ${row('Value', esc(usd(q.usdIn)))}
        ${row(`Fee (${(FEE * 100).toFixed(1)}%)`, `${esc(qty(q.feeQty))} ${esc(q.from)} · ${esc(usd(q.feeUsd))}`)}
        ${row(`${esc(q.from)} after`, `${esc(qty(Math.max(0, q.have - q.amount)))} ${esc(q.from)}`)}
      </div>
      <button type="button" class="btn btn-primary w100 cvt-go" onclick="CVT.submit()">Convert</button>
      <div class="cvt-fine">If the rate has moved by the time you tap, you will be shown the new figure rather than converted at it.</div>`;
  }

  function doneHTML() {
    const d = V.done || {};
    return `
      <div class="cvt-done">
        <span class="cvt-done-i">${ico('check_circle')}</span>
        <b>${esc(qty(d.amount))} ${esc(d.from)} → ${esc(qty(d.out))} ${esc(d.to)}</b>
        <em>${d.moved > 0 ? `${esc(qty(d.moved))} ${esc(d.from)} was moved from Spot to cover it. ` : ''}It is in your Funding account.</em>
      </div>
      <div class="cvt-done-a">
        <button type="button" class="btn btn-ghost" onclick="CVT.open(${attr(d.to)})">Convert again</button>
        <button type="button" class="btn btn-primary" onclick="CVT.close()">Done</button>
      </div>`;
  }

  /* ── Handlers ────────────────────────────────────────────────────── */
  /* Typing only refreshes the estimate and the button — a full re-render
     would take the caret out of the field on every keystroke. */
  function setAmount(v) {
    if (!V) return;
    V.amount = v;
    const q = quote(V.from, V.to, v);
    const out = document.getElementById('cvt-out');
    const rate = document.getElementById('cvt-rate');
    const go = document.querySelector('#cvt-scrim .cvt-go');
    if (out) out.textContent = q.ok ? qty(q.out) : '0.00';
    if (rate) rate.innerHTML = rateHTML(q);
    if (go) {
      go.disabled = !(q.ok && !q.short);
      go.textContent = q.short ? `Not enough ${V.from}` : 'Preview conversion';
    }
  }

  function field(side, value) {
    if (!V) return;
    const v = sym_(value);
    if (side === 'from') { V.from = v; if (V.to === v) V.to = options().find(s => s !== v) || V.to; }
    else { V.to = v; if (V.from === v) V.from = options().find(s => s !== v) || V.from; }
    render();
  }

  function flip() {
    if (!V) return;
    const f = V.from;
    V.from = V.to; V.to = f;
    V.amount = '';
    render();
  }

  function max() {
    if (!V) return;
    const have = MNY.spendable(V.from);
    if (!(have > 0)) { toast(`You hold no ${V.from}.`); return; }
    V.amount = String(have);
    render();
  }

  function review() {
    if (!V) return;
    const q = quote(V.from, V.to, V.amount);
    if (!q.ok) { toast(q.why); return; }
    if (q.short) { toast(`Not enough ${q.from}. You hold ${qty(q.have)}.`); return; }
    V.quoted = q;
    V.step = 'review';
    render();
  }

  function back() { if (V) { V.step = 'form'; render(); } }

  function submit() {
    if (!V || !V.quoted) return;
    const q = V.quoted;
    const r = execute(q.from, q.to, q.amount, { expect: q.out });

    if (!r.ok && r.moved) {
      /* The rate moved past the threshold. Show the new number on the
         same screen and let them agree to that one instead. */
      V.quoted = r.quote;
      toast(r.msg);
      render();
      return;
    }
    if (!r.ok) { toast(r.msg); return; }

    V.done = { from: q.from, to: q.to, amount: q.amount, out: r.out, moved: r.moved };
    V.step = 'done';
    render();
    toast(r.msg);
  }

  return {
    open, close, back, submit, review, flip, max, field, setAmount,
    quote, execute, options, canConvert, whyNot,
    get FEE() { return FEE; },
    get state() { return V; }
  };
})();

window.CVT = CVT;
