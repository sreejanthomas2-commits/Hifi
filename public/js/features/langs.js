/* ╔══════════════════════════════════════════════════════════════════╗
   ║  LANGUAGE PICKER                                                 ║
   ║                                                                  ║
   ║  The language control used to sit in the header, where it ate a  ║
   ║  third of a phone's top bar for a setting people change once.    ║
   ║  It lives in Settings now, with every language in the list —     ║
   ║  searchable by English name, native name or code.                ║
   ║                                                                  ║
   ║  Languages whose interface is translated come first. The rest    ║
   ║  are selectable and remembered, and say plainly that menus stay  ║
   ║  in English until their strings land — nobody should pick a      ║
   ║  language and wonder why nothing changed.                        ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const LG = (() => {

  const KEY = 'ts_lang';
  let query = '';

  const all = () => (window.LANGS || []);
  const byCode = c => all().find(l => l.c === c) || null;
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s)) : String(s == null ? '' : s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };

  function current() {
    let c = '';
    try { c = localStorage.getItem(KEY) || ''; } catch (e) {}
    return byCode(c) ? c : 'en';
  }

  const isTranslated = code => !!(byCode(code) || {}).t;

  /* ── Applying ────────────────────────────────────────────────────── */
  function apply(code) {
    const l = byCode(code) || byCode('en');
    if (!l) return;
    if (typeof applyLanguage === 'function') applyLanguage(l.c);   // owns S.lang, storage, dir
    else {
      document.documentElement.setAttribute('lang', l.c);
      document.documentElement.setAttribute('dir', l.r ? 'rtl' : 'ltr');
    }
  }

  function set(code) {
    const l = byCode(code);
    if (!l) return;
    apply(l.c);
    paint();
    toast(l.t
      ? `Language: ${l.v}`
      : `${l.n} selected — menus stay in English until it's translated`);
  }

  /* ── Settings card ───────────────────────────────────────────────── */
  function cardHTML() {
    const cur = byCode(current()) || byCode('en');
    const done = all().filter(l => l.t).length;
    return `
      <div class="card lg-card" id="lg-card">
        <div class="lg-head">
          <div>
            <h3 class="lg-title">Language</h3>
            <div class="lg-sub">${all().length} languages · ${done} with a translated interface</div>
          </div>
          <div class="lg-current">
            <span class="material-symbols-rounded ms-18">translate</span>
            <div>
              <b>${esc(cur.v)}</b>
              <span>${esc(cur.n)}</span>
            </div>
          </div>
        </div>
        <div class="lg-search">
          <span class="material-symbols-rounded ms-18">search</span>
          <input type="text" id="lg-q" placeholder="Search languages" autocomplete="off"
                 value="${esc(query)}" oninput="LG.search(this.value)">
        </div>
        <div class="lg-list" id="lg-list">${listHTML()}</div>
      </div>`;
  }

  function rowHTML(l, cur) {
    const on = l.c === cur;
    return `<button class="lg-row${on ? ' active' : ''}" onclick="LG.set('${esc(l.c)}')" lang="${esc(l.c)}">
      <span class="lg-native"${l.r ? ' dir="rtl"' : ''}>${esc(l.v)}</span>
      <span class="lg-name">${esc(l.n)}${l.t ? '' : ' · English interface'}</span>
      ${on ? '<span class="material-symbols-rounded lg-check">check_circle</span>' : ''}
    </button>`;
  }

  function listHTML() {
    const cur = current();
    const q = query.trim().toLowerCase();
    const hit = l => !q || l.n.toLowerCase().includes(q) || l.v.toLowerCase().includes(q) || l.c.toLowerCase().includes(q);

    const ready = all().filter(l => l.t && hit(l));
    const rest = all().filter(l => !l.t && hit(l)).sort((a, b) => a.n.localeCompare(b.n));

    if (!ready.length && !rest.length) {
      return `<div class="lg-empty">No language matches “${esc(query)}”.</div>`;
    }
    return `
      ${ready.length ? `<div class="lg-group">Translated</div>${ready.map(l => rowHTML(l, cur)).join('')}` : ''}
      ${rest.length ? `<div class="lg-group">More languages<span>menus stay in English for now</span></div>
        ${rest.map(l => rowHTML(l, cur)).join('')}` : ''}`;
  }

  function search(v) {
    query = v || '';
    const host = document.getElementById('lg-list');
    if (host) host.innerHTML = listHTML();
  }

  /* Repaints the card in place, keeping whatever was typed in the box. */
  function paint() {
    const card = document.getElementById('lg-card');
    if (!card) return;
    const wrap = card.parentElement;
    card.outerHTML = cardHTML();
    const box = wrap && wrap.querySelector('#lg-q');
    if (box && query) { box.focus(); box.setSelectionRange(query.length, query.length); }
  }

  function boot() { apply(current()); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 80));
  else setTimeout(boot, 80);

  return { cardHTML, listHTML, search, set, apply, current, isTranslated, paint };
})();

window.LG = LG;

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
publish('features/langs.js', {
  LG: () => LG
});
