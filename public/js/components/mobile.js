/* ╔══════════════════════════════════════════════════════════════════╗
   ║  MOBILE — what the app needs on a phone                           ║
   ║                                                                   ║
   ║  · appConfirm / appPrompt: in-app dialogs instead of the browser's║
   ║    confirm() and prompt(), which in an app shell look like system ║
   ║    errors ("localhost says…") and block the whole page            ║
   ║  · Bottom bar: five tabs and a More sheet for the rest            ║
   ║  · Search is a tab after Home; the header carries the wordmark    ║
  ║  · While the keyboard is up, the bottom bar steps aside           ║
   ║  · Touch has no hover: tap a community message for its tools, tap ║
   ║    the markets badge for what it means                            ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const MOB = (() => {

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const coarse = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const noHover = () => !!(window.matchMedia && matchMedia('(hover: none)').matches);

  /* ── Dialogs ─────────────────────────────────────────────────────── */
  let queue = Promise.resolve();

  function dialog(opts) {
    // One at a time: a second request waits for the first to close.
    const run = () => new Promise(resolve => {
      const back = document.activeElement;
      const el = document.createElement('div');
      el.className = 'mob-dialog-scrim';
      el.innerHTML = `
        <div class="mob-dialog" role="alertdialog" aria-modal="true" aria-labelledby="mob-dlg-t" aria-describedby="mob-dlg-m">
          ${opts.title ? `<h3 id="mob-dlg-t">${esc(opts.title)}</h3>` : '<h3 id="mob-dlg-t" class="mob-sr">Confirm</h3>'}
          <p id="mob-dlg-m">${esc(opts.message)}</p>
          ${opts.input ? `<input class="input mob-dlg-in" type="text" value="${esc(opts.value || '')}" aria-label="${esc(opts.message)}">` : ''}
          <div class="mob-dialog-a">
            ${opts.alert ? '' : `<button type="button" class="btn btn-ghost" data-v="0">${esc(opts.cancel || 'Cancel')}</button>`}
            <button type="button" class="btn ${opts.danger ? 'mob-danger' : 'btn-primary'}" data-v="1">${esc(opts.ok || 'OK')}</button>
          </div>
        </div>`;
      const input = () => el.querySelector('.mob-dlg-in');
      const done = ok => {
        document.removeEventListener('keydown', onKey, true);
        const v = ok ? (opts.input ? input().value : true) : (opts.input ? null : false);
        el.remove();
        if (back && back.focus && document.contains(back)) { try { back.focus({ preventScroll: true }); } catch (e) {} }
        resolve(v);
      };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
        else if (e.key === 'Enter' && (!e.target.dataset || e.target.dataset.v !== '0')) { e.preventDefault(); e.stopPropagation(); done(true); }
        else if (e.key === 'Tab') {
          const f = [...el.querySelectorAll('button, input')];
          const i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      };
      el.addEventListener('click', e => {
        const b = e.target.closest('button[data-v]');
        if (b) done(b.dataset.v === '1');
        else if (e.target === el && !opts.alert) done(false);
      });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(el);
      // Destructive: start on Cancel, so a stray Enter doesn't delete anything.
      const first = opts.input ? input() : el.querySelector(opts.danger ? 'button[data-v="0"]' : 'button[data-v="1"]');
      requestAnimationFrame(() => { if (first) { first.focus(); if (opts.input) first.select(); } });
    });
    const p = queue.then(run);
    queue = p.catch(() => {});
    return p;
  }

  const appConfirm = (message, o) => dialog({ ...(o || {}), message });
  const appPrompt = (message, value, o) => dialog({ ...(o || {}), message, value, input: true });
  const appAlert = (message, o) => dialog({ ...(o || {}), message, alert: true });

  /* ── Bottom bar: five tabs and More ──────────────────────────────── */
  // Every pane reachable from More (data-also covers Crypto Markets, which
  // opens the "category" pane rather than a pane of its own name).
  const EXTRA = () => [...document.querySelectorAll('.mobile-nav .m-nav-extra')].map(b => [b.dataset.pane, b.dataset.also]).flat().filter(Boolean);

  function markMore() {
    const more = $('m-nav-more');
    if (!more) return;
    const pane = (typeof S !== 'undefined' && S.pane) || '';
    const on = EXTRA().indexOf(pane) > -1;
    more.classList.toggle('active', on);
    more.setAttribute('aria-current', on ? 'page' : 'false');
  }

  /* The ☰ drawer is hidden on phones and tablets, so its account row —
     sign in, or your profile — lives at the top of More. */
  function accountHTML() {
    const u = (typeof S !== 'undefined' && S.user) || {};
    const guest = !u.uid || u.fname === 'Guest';
    const src = window.PME && PME.photo ? PME.photo() : '';
    const name = `${u.fname || ''} ${u.lname || ''}`.trim();
    const ini = (name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `<button type="button" class="mob-account" data-account>
      <span class="mob-account-av"${src ? ` style="background-image:url('${src}')"` : ''}>${src ? '' : guest ? '<span class="material-symbols-rounded">login</span>' : esc(ini)}</span>
      <span class="mob-account-t"><b>${guest ? 'Sign in to Trending' : esc(name)}</b><em>${guest ? 'Unlock your digital universe' : esc(u.handle || 'Your profile')}</em></span>
      <span class="material-symbols-rounded mob-account-go">chevron_right</span>
    </button>`;
  }

  function openMore() {
    if ($('mob-more')) { closeMore(); return; }
    const pane = (typeof S !== 'undefined' && S.pane) || '';
    const items = [...document.querySelectorAll('.mobile-nav .m-nav-extra')];
    const isOn = b => b.dataset.pane === pane || (b.dataset.also && b.dataset.also === pane && (b.dataset.action !== 'crypto' || S.selectedCategory === 'crypto'));
    const el = document.createElement('div');
    el.id = 'mob-more';
    el.className = 'mob-scrim';
    el.innerHTML = `
      <div class="mob-sheet" role="dialog" aria-modal="true" aria-label="More">
        <span class="mob-grab" aria-hidden="true"></span>
        ${accountHTML()}
        <div class="mob-more-grid">
          ${items.map(b => `<button type="button" class="mob-more-item${isOn(b) ? ' on' : ''}" data-pane="${esc(b.dataset.pane || '')}" data-action="${esc(b.dataset.action || '')}"
            ${isOn(b) ? 'aria-current="page"' : ''}>${b.innerHTML}</button>`).join('')}
        </div>
      </div>`;
    el.addEventListener('click', e => {
      const item = e.target.closest('.mob-more-item');
      if (item) {
        closeMore();
        if (item.dataset.action === 'crypto' && typeof clickCategory === 'function') clickCategory('crypto');
        else if (item.dataset.pane && typeof navigateTo === 'function') navigateTo(item.dataset.pane);
        return;
      }
      if (e.target.closest('[data-account]')) {
        closeMore();
        if (typeof handleUserAuthClick === 'function') handleUserAuthClick();
        else if (typeof navigateTo === 'function') navigateTo('profile');
        return;
      }
      if (e.target === el) closeMore();
    });
    document.body.appendChild(el);
    const btn = $('m-nav-more');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', moreKey, true);
    requestAnimationFrame(() => { el.classList.add('open'); const f = el.querySelector('.mob-more-item.on') || el.querySelector('.mob-more-item'); if (f) f.focus({ preventScroll: true }); });
  }
  function closeMore() {
    const el = $('mob-more');
    if (!el) return;
    el.remove();
    document.removeEventListener('keydown', moreKey, true);
    const btn = $('m-nav-more');
    if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus({ preventScroll: true }); }
  }
  function moreKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMore(); } }

  function wrapNav() {
    if (typeof window.navigateTo !== 'function' || window.navigateTo.__mob) return;
    const nav = window.navigateTo;
    const wrapped = function () { const r = nav.apply(this, arguments); markMore(); return r; };
    wrapped.__mob = true;
    window.navigateTo = wrapped;
  }

  /* ── Search: a tab after Home ────────────────────────────────────── */
  /* Opens Discover. Tapped again while Discover is showing, it puts the
     caret in the search field, the way a search tab does. */
  function openSearch() {
    closeMore();
    if (window.DX && DX.open) {
      if (document.getElementById('dx')) {
        const q = $('dx-q');
        if (q) { q.focus(); q.select(); }
        return;
      }
      DX.open();
    } else if (window.SR && SR.open) SR.open('');
  }

  /* While Discover is open the Search tab is the lit one; when it closes,
     the tab for the page underneath lights up again. */
  const searchTabs = () => [...document.querySelectorAll('.m-nav-search, .nav-search')];
  let dxShown = false;
  function syncSearchTab() {
    const open = document.body.classList.contains('dx-open');
    if (open === dxShown) return;
    dxShown = open;
    if (open) {
      document.querySelectorAll('.m-nav-btn.active, .nav-item.active').forEach(n => { n.classList.remove('active'); n.removeAttribute('aria-current'); });
      searchTabs().forEach(n => { n.classList.add('active'); n.setAttribute('aria-current', 'page'); });
    } else {
      searchTabs().forEach(n => { n.classList.remove('active'); n.removeAttribute('aria-current'); });
      const pane = (typeof S !== 'undefined' && S.pane) || '';
      if (pane) document.querySelectorAll(`.m-nav-btn[data-pane="${pane}"], .nav-item[data-pane="${pane}"]`).forEach(n => n.classList.add('active'));
      markMore();
    }
  }

  /* The header field used to show a filter the feed was using (a tag from
     "See in feed", say). With the field gone, the feed says so itself and
     offers the way back to every post. */
  function feedFilterChip() {
    const posts = $('feed-posts');
    const gs = $('global-search');
    if (!posts || posts.querySelector('.feed-filter')) return;
    const q = (gs ? gs.value : '').trim();
    if (!q) return;
    const none = !posts.children.length;
    const el = document.createElement('div');
    el.className = 'feed-filter';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">filter_list</span>
      <span class="feed-filter-t">${none ? 'No posts match' : 'Showing posts matching'} <b>${esc(q)}</b></span>
      <button type="button" class="feed-filter-x">Show all</button>`;
    el.querySelector('button').addEventListener('click', () => {
      if (gs) gs.value = '';
      if (typeof renderFeed === 'function') renderFeed('');
    });
    posts.prepend(el);
  }
  function wrapFeed() {
    if (typeof window.renderFeed !== 'function' || window.renderFeed.__mob) return;
    const render = window.renderFeed;
    const wrapped = function () { const r = render.apply(this, arguments); feedFilterChip(); return r; };
    wrapped.__mob = true;
    window.renderFeed = wrapped;
  }

  /* ── Keyboard up: the bottom bar gets out of the way ─────────────── */
  const typing = el => !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit|reset|file|color|image)$/i.test(el.type || '')));
  document.addEventListener('focusin', e => { if (coarse() && typing(e.target)) document.body.classList.add('kb-open'); });
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (!typing(document.activeElement)) document.body.classList.remove('kb-open'); }, 60);
  });

  /* ── Touch stand-ins for hover ───────────────────────────────────── */
  document.addEventListener('click', e => {
    if (!noHover()) return;
    // Commune Hub message tools (react, reply, pin…) appear on hover on a
    // desktop; on a phone, tapping the message shows them.
    const msg = e.target.closest('.hub-msg');
    document.querySelectorAll('.hub-msg.tools-open').forEach(m => { if (m !== msg) m.classList.remove('tools-open'); });
    if (msg && !e.target.closest('a, button, input, textarea, select, label, .hub-msg-tools, .hub-poll, img, video')) msg.classList.toggle('tools-open');
    // The markets badge explains itself in a tooltip; tap reads it out.
    const badge = e.target.closest('.mkt-status');
    if (badge && badge.title && typeof showToast === 'function') showToast(badge.title.split('. ')[0] + '.');
  });

  function init() {
    wrapNav();
    markMore();
    if (window.MutationObserver) new MutationObserver(syncSearchTab).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // feeds.js loads after this file; renderFeed exists once every deferred script has run.
    const late = () => { wrapFeed(); feedFilterChip(); };
    late();
    document.addEventListener('DOMContentLoaded', late);
    window.addEventListener('load', late);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  return { appConfirm, appPrompt, appAlert, openMore, closeMore, markMore, openSearch };
})();

window.MOB = MOB;
window.appConfirm = MOB.appConfirm;
window.appPrompt = MOB.appPrompt;
window.appAlert = MOB.appAlert;
