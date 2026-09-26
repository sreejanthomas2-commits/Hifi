/* ╔══════════════════════════════════════════════════════════════════╗
   ║  FINANCIAL UI — the pieces every money screen shares              ║
   ║                                                                   ║
   ║  problem()   a failure that answers the six questions: what       ║
   ║              happened, is my money safe, what is the status now,  ║
   ║              do I have to do anything, what can I do, and where   ║
   ║              is help. A red toast answers none of them.           ║
   ║  skeleton()  grey shapes while something loads, in place of the   ║
   ║              real layout, so the page doesn't jump when it lands  ║
   ║  offline()   a banner that shows itself when the connection goes  ║
   ║              and says what that means for money on screen         ║
   ║                                                                   ║
   ║  The status timeline and the confirmation sheet join these when   ║
   ║  the first server-side transaction does (Phase D), so they are    ║
   ║  built against a real one rather than guessed.                    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const FUI = (() => {
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));

  /* p = { title, what, safe, status, todo, act: { label, onclick }, ref }
     Every field is text and is escaped, except act.onclick: that is a
     handler the calling module writes itself, never anything a person
     typed or a server sent. */
  function problem(p) {
    const o = p || {};
    const rows = [
      ['What happened', o.what],
      ['Your money', o.safe],
      ['Status now', o.status],
      ['Do you need to act?', o.todo || 'No.'],
    ].filter(r => r[1]);
    const help = 'Settings → Help and support' + (o.ref ? `, quoting ${o.ref}` : '') + '.';
    return `<div class="fui-problem" role="alert">
      <div class="fui-problem-t"><span class="material-symbols-rounded" aria-hidden="true">error</span>${esc(o.title || 'Something went wrong')}</div>
      <dl>
        ${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
        <div><dt>Help</dt><dd>${esc(help)}</dd></div>
      </dl>
      ${o.act ? `<button type="button" class="btn btn-primary btn-sm" onclick="${o.act.onclick}">${esc(o.act.label)}</button>` : ''}
    </div>`;
  }

  /* n placeholder blocks shaped like the thing that is coming. */
  function skeleton(n, kind) {
    const k = kind === 'row' ? 'row' : 'tile';
    return `<div class="fui-skel-wrap fui-skel-${k}s" aria-busy="true" aria-label="Loading">${
      Array.from({ length: n || 3 }, () => `<div class="fui-skel fui-skel-${k}"><i></i><i></i></div>`).join('')}</div>`;
  }

  /* Markup for the banner; one listener for the whole app keeps every
     copy of it in step with the connection. */
  function offline(text) {
    const on = typeof navigator === 'undefined' || navigator.onLine !== false;
    return `<div class="fui-offline" role="status"${on ? ' hidden' : ''}>
      <span class="material-symbols-rounded" aria-hidden="true">cloud_off</span>
      <span>${esc(text || "You're offline. Prices and availability on this screen may be out of date, and nothing will be sent until you're back.")}</span>
    </div>`;
  }
  function syncOffline() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    const off = typeof navigator !== 'undefined' && navigator.onLine === false;
    document.querySelectorAll('.fui-offline').forEach(el => { el.hidden = !off; });
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('online', syncOffline);
    window.addEventListener('offline', syncOffline);
  }

  return { problem, skeleton, offline, syncOffline, esc };
})();

window.FUI = FUI;

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module, so its top-level names are private to it.
   Inline onclick= handlers and every other module still look them up
   on the global object, so they are republished here. */
import { publish } from '../globals.js?v=3';
publish('components/finui.js', {
  FUI: () => FUI
});
