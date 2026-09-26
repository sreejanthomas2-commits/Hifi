/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SETTINGS & ACTIVITY — the control centre for the account         ║
   ║                                                                   ║
   ║  One scrolling list of plainly named rows, grouped by what they   ║
   ║  are for, with a search field that goes straight to the setting.  ║
   ║  Every row leads somewhere: another screen, a switch, a choice,   ║
   ║  or a sheet. There are no rows here that only look like rows.     ║
   ║                                                                   ║
   ║  WHERE THE ANSWERS COME FROM                                      ║
   ║                                                                   ║
   ║  features/prefs.js (TP) holds the settings with no other home.    ║
   ║  Everything else is read from whoever owns it — the theme from    ║
   ║  theme.js, the language from langs.js, what Discover has learned  ║
   ║  from discover.js, addresses from walletaddr.js, balances from    ║
   ║  money.js. This page never keeps a second copy of an answer, so   ║
   ║  it can never show one that has gone stale.                       ║
   ║                                                                   ║
   ║  SOCIAL AND MONEY ARE NOT THE SAME THING                          ║
   ║                                                                   ║
   ║  Who can reply to a story and who can spend from a wallet are     ║
   ║  different kinds of question, so they are in different sections   ║
   ║  and the money ones ask again before they change. Nothing here    ║
   ║  ever shows, asks for or stores a recovery phrase, a private key  ║
   ║  or a card number.                                                ║
   ║                                                                   ║
   ║  BUILT FROM A SPEC, NOT FROM COPY-PASTE                           ║
   ║                                                                   ║
   ║  Screens are declared in SCREENS; rows are built by row(), sw()   ║
   ║  and pick(). Adding a setting is a line of data, and the search   ║
   ║  index, the back stack and the deep links pick it up for free.    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

/* The screens live in four files beside this one, grouped the way the
   list itself is grouped. Each exports a register(SET) that declares
   its screens — imports are hoisted, so every one of these is defined
   by the time SET exists and they are called below. */
import registerAccount from './settings-account.js?v=sec2';
import registerPrivacy from './settings-privacy.js?v=st1';
import registerApp from './settings-app.js?v=st1';
import registerCrypto from './settings-crypto.js?v=sec0';

const SET = (() => {

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ico = (n, c) => `<span class="material-symbols-rounded${c ? ' ' + c : ''}" aria-hidden="true">${n}</span>`;
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const has = (o, f) => typeof window[o] !== 'undefined' && window[o] && typeof window[o][f] === 'function';
  const P = () => window.TP;

  /* ── Where we are ────────────────────────────────────────────────── */
  const V = { screen: 'root', stack: [], q: '', scroll: {}, sub: null };

  const SCREENS = {};
  const reg = (id, def) => { SCREENS[id] = Object.assign({ id }, def); return id; };

  /* ══════════════════════════════════════════════════════════════════
     Components — every row on every screen is one of these
     ══════════════════════════════════════════════════════════════════ */

  /* A heading with a hairline above it, not a card. Cards around every
     group made the list read as fifty separate things.

     A section with a heading but no rows is legitimate and common: it
     labels the radio list or the swatches that follow it. This used to
     return nothing unless it had rows, which silently swallowed the
     heading above every choice on every screen. It returns nothing
     only when there is genuinely nothing to show. */
  const sec = (title, rows, note) => {
    const body = (rows || []).filter(Boolean).join('');
    if (!body && !title && !note) return '';
    return `<section class="st-sec">
      ${title ? `<h2 class="st-sec-h">${esc(title)}</h2>` : ''}
      ${body ? `<div class="st-rows">${body}</div>` : ''}
      ${note ? `<p class="st-note">${note}</p>` : ''}
    </section>`;
  };

  /* The navigation row: icon, name, what it is set to now, chevron. */
  function row(o) {
    const act = o.to ? `go:${o.to}` : o.act || '';
    return `<button type="button" class="st-row${o.danger ? ' danger' : ''}" ${act ? `data-st="${esc(act)}"` : ''}
      ${o.arg ? `data-a="${esc(o.arg)}"` : ''} data-label="${esc(o.label)}"${o.disabled ? ' disabled' : ''}>
      ${o.icon ? `<span class="st-row-i">${ico(o.icon)}</span>` : ''}
      <span class="st-row-t"><b>${esc(o.label)}</b>${o.sub ? `<em>${esc(o.sub)}</em>` : ''}</span>
      ${o.value != null && o.value !== '' ? `<span class="st-row-v${o.warn ? ' warn' : ''}${o.good ? ' good' : ''}">${esc(o.value)}</span>` : ''}
      ${o.badge ? `<span class="st-row-b">${esc(o.badge)}</span>` : ''}
      ${o.to || o.chev ? ico('chevron_right', 'st-row-go') : ''}
    </button>`;
  }

  /* A switch bound to a preference path. The label element is the hit
     target, so the whole row is tappable rather than just the switch. */
  function sw(path, label, sub, o) {
    o = o || {};
    const on = o.value != null ? !!o.value : !!P().get(path);
    return `<label class="st-row st-sw-row${o.off ? ' off' : ''}" data-label="${esc(label)}">
      ${o.icon ? `<span class="st-row-i">${ico(o.icon)}</span>` : ''}
      <span class="st-row-t"><b>${esc(label)}</b>${sub ? `<em>${esc(sub)}</em>` : ''}</span>
      <span class="st-sw">
        <input type="checkbox" ${on ? 'checked' : ''} ${o.off ? 'disabled' : ''}
          data-st="${esc(o.act || 'tg')}" data-a="${esc(o.a != null ? o.a : path)}"${o.b != null ? ` data-b="${esc(o.b)}"` : ''} aria-label="${esc(label)}">
        <i></i>
      </span>
    </label>`;
  }

  /* A choice, shown as a radio list. Tapping any line sets it. */
  function pick(path, options, o) {
    o = o || {};
    const now = o.value != null ? o.value : P().get(path);
    return `<div class="st-rows st-picks">${options.map(([k, l, s]) => `
      <button type="button" class="st-row st-pick${String(now) === String(k) ? ' on' : ''}"
        data-st="${esc(o.act || 'set')}" data-a="${esc(path)}" data-b="${esc(k)}" data-label="${esc(l)}">
        <span class="st-row-t"><b>${esc(l)}</b>${s ? `<em>${esc(s)}</em>` : ''}</span>
        <span class="st-tick">${ico(String(now) === String(k) ? 'radio_button_checked' : 'radio_button_unchecked')}</span>
      </button>`).join('')}</div>`;
  }

  /* Nothing here yet, and what to do about it. */
  const empty = (icon, title, text, act, label) => `
    <div class="st-empty">
      <span class="st-empty-i">${ico(icon)}</span>
      <b>${esc(title)}</b>
      <p>${esc(text)}</p>
      ${act ? `<button type="button" class="btn btn-primary btn-sm" data-st="${esc(act)}">${esc(label)}</button>` : ''}
    </div>`;

  /* Something is being fetched. Shown while a screen waits rather than
     leaving the body blank, which reads as a broken page. */
  const skeleton = n => `<div class="st-rows">${Array.from({ length: n || 3 },
    () => '<div class="st-skel"><i class="st-skel-i"></i><i class="st-skel-t"></i></div>').join('')}</div>`;

  const failed = (what, retry) => `
    <div class="st-empty">
      <span class="st-empty-i">${ico('cloud_off')}</span>
      <b>${esc(what)}</b>
      <p>Check your connection and try again.</p>
      ${retry ? `<button type="button" class="btn btn-primary btn-sm" data-st="${esc(retry)}">Try again</button>` : ''}
    </div>`;

  /* A person on a list — blocked, restricted, close friends, muted. */
  const person = (h, listName, sub) => `
    <div class="st-person" data-label="${esc(h)}">
      <span class="st-person-av">${esc(String(h).slice(0, 2).toUpperCase())}</span>
      <span class="st-person-t"><b>@${esc(h)}</b>${sub ? `<em>${esc(sub)}</em>` : ''}</span>
      <button type="button" class="st-person-x" data-st="unlist" data-a="${esc(listName)}" data-b="${esc(h)}">Remove</button>
    </div>`;

  const money = n => (typeof MNY !== 'undefined' && MNY.usd) ? MNY.usd(n) : '$' + Number(n || 0).toFixed(2);
  const when = ts => {
    if (!ts) return '';
    const d = Math.floor((Date.now() - ts) / 86400000);
    if (d <= 0) return 'today';
    if (d === 1) return 'yesterday';
    if (d < 30) return d + ' days ago';
    return new Date(ts).toLocaleDateString();
  };

  /* ══════════════════════════════════════════════════════════════════
     Navigating between screens
     ══════════════════════════════════════════════════════════════════ */

  function go(id, keepSearch) {
    if (!SCREENS[id]) { toast('That setting has moved.'); return; }
    const body = $('st-body');
    if (body) V.scroll[V.screen] = pane() ? pane().scrollTop : 0;
    V.stack.push(V.screen);
    V.screen = id;
    V.sub = null;
    if (!keepSearch) clearQuery(true);
    paint();
  }

  /* Back gives the screen its scroll position and its search text back,
     because losing either is what makes settings feel like a maze. */
  function back() {
    if (V.q) { clearQuery(); return; }
    if (!V.stack.length) {
      if (typeof navigateTo === 'function') navigateTo('profile');
      return;
    }
    V.screen = V.stack.pop();
    V.sub = null;
    paint(V.scroll[V.screen] || 0);
  }

  const pane = () => $('pane-settings');

  function open(id) {
    const to = () => { V.stack = id && id !== 'root' ? ['root'] : []; V.screen = SCREENS[id] ? id : 'root'; V.q = ''; paint(0); };
    if (typeof navigateTo === 'function') Promise.resolve(navigateTo('settings')).then(to);
    else to();
  }

  /* ══════════════════════════════════════════════════════════════════
     Search — over every screen name, every row label and the words
     someone would actually type
     ══════════════════════════════════════════════════════════════════ */

  let INDEX = null;

  /* Row labels are not listed twice: a screen is built once, here, and
     its labels read back out of the markup. A setting that exists is
     therefore always findable, and one that is removed stops being. */
  function index() {
    if (INDEX) return INDEX;
    INDEX = [];
    Object.keys(SCREENS).forEach(id => {
      const s = SCREENS[id];
      if (s.hidden) return;
      let labels = [];
      try {
        const html = typeof s.html === 'function' ? s.html() : '';
        labels = (String(html).match(/data-label="[^"]*"/g) || [])
          .map(m => m.slice(12, -1).replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
      } catch (e) { labels = []; }
      INDEX.push({ id, title: s.t, parent: s.p, icon: s.i, keys: s.k || '', labels });
    });
    return INDEX;
  }
  const dropIndex = () => { INDEX = null; };

  function results(q) {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const words = t.split(/\s+/);
    /* A setting's own name beats a row inside it, and a row inside it
       beats a keyword. Without that last step "private" found "private
       key" on the wallet screen before it found "Private account",
       because both merely contained the word somewhere. */
    const whole = (hay, w) => new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(hay);
    const score = s => {
      const title = s.title.toLowerCase();
      const labels = (s.labels || []).join(' · ').toLowerCase();
      const keys = (s.keys || '').toLowerCase();
      let n = 0;
      words.forEach(w => {
        if (title === w) n += 100;
        else if (title.indexOf(w) === 0) n += 60;
        else if (whole(title, w)) n += 45;
        else if (title.indexOf(w) > -1) n += 30;
        else if (whole(labels, w)) n += 22;
        else if (labels.indexOf(w) > -1) n += 14;
        else if (whole(keys, w)) n += 10;
        else if (keys.indexOf(w) > -1) n += 6;
        else n -= 100;
      });
      return n;
    };
    return index().map(s => ({ s, n: score(s) })).filter(r => r.n > 0)
      .sort((a, b) => b.n - a.n).slice(0, 24).map(r => r.s);
  }

  function resultsHTML() {
    const list = results(V.q);
    if (!list.length) {
      return empty('search_off', 'Nothing matches “' + V.q + '”',
        'Try a word from the setting itself — “password”, “mute”, “network fee”, “private”.');
    }
    const hit = s => {
      const w = V.q.trim().toLowerCase();
      const m = (s.labels || []).find(l => l.toLowerCase().indexOf(w) > -1 && l.toLowerCase() !== s.title.toLowerCase());
      return m ? 'Includes “' + m + '”' : (s.parent && SCREENS[s.parent] ? SCREENS[s.parent].t : 'Settings');
    };
    return sec(list.length + (list.length === 1 ? ' result' : ' results'),
      list.map(s => row({ icon: s.icon || 'tune', label: s.title, sub: hit(s), act: 'goq:' + s.id, chev: true })));
  }

  function onQuery(v) {
    V.q = v;
    const body = $('st-body');
    if (!body) return;
    body.innerHTML = V.q.trim() ? resultsHTML() : screenHTML();
    const x = $('st-qx');
    if (x) x.hidden = !V.q;
  }

  function clearQuery(silent) {
    V.q = '';
    const f = $('st-q');
    if (f) f.value = '';
    const x = $('st-qx');
    if (x) x.hidden = true;
    if (!silent) paint();
  }

  /* ══════════════════════════════════════════════════════════════════
     Painting
     ══════════════════════════════════════════════════════════════════ */

  function screenHTML() {
    const s = SCREENS[V.screen] || SCREENS.root;
    try { return typeof s.html === 'function' ? s.html() : ''; }
    catch (e) {
      console.error('[settings] ' + V.screen + ' failed to draw', e);
      return failed('This screen could not be opened', 'repaint');
    }
  }

  function paint(scrollTo) {
    const host = pane();
    if (!host) return;
    const s = SCREENS[V.screen] || SCREENS.root;
    const shell = $('st-shell');
    if (!shell) { host.innerHTML = shellHTML(); bind(); }
    const title = $('st-title');
    if (title) title.textContent = V.screen === 'root' ? 'Settings & Activity' : s.t;
    const search = $('st-searchbar');
    /* The field belongs to the whole of settings, not to one screen, so
       it stays — but only the root list is long enough to need it. */
    if (search) search.hidden = V.screen !== 'root';
    const body = $('st-body');
    if (body) body.innerHTML = V.q.trim() ? resultsHTML() : screenHTML();
    if (host) host.scrollTop = scrollTo || 0;
    late();
  }

  const repaint = () => { const b = $('st-body'); if (b) b.innerHTML = V.q.trim() ? resultsHTML() : screenHTML(); late(); };

  /* Screens whose content has to be fetched fill themselves in after
     the first paint. Each one is responsible for its own body. */
  const LATE = {};
  function late() {
    const fn = LATE[V.screen];
    if (typeof fn === 'function' && !V.q.trim()) { try { fn(); } catch (e) {} }
  }

  function shellHTML() {
    /* The title and the search field are one sticky block, not two
       sticky siblings: stacked separately they each needed their own
       offset, and the second one's offset had to know the first one's
       height, which is a number that changes with the text size. */
    return `<div class="st" id="st-shell">
      <div class="st-head" id="st-head">
        <header class="st-top">
          <button type="button" class="st-ib" data-st="back" aria-label="Back">${ico('arrow_back')}</button>
          <h1 class="st-title" id="st-title">Settings &amp; Activity</h1>
        </header>
        <div class="st-searchbar" id="st-searchbar">
          <label class="st-q">
            ${ico('search')}
            <input id="st-q" type="search" placeholder="Search settings" autocomplete="off" aria-label="Search settings">
            <button type="button" id="st-qx" class="st-qx" data-st="clearq" aria-label="Clear search" hidden>${ico('close')}</button>
          </label>
        </div>
      </div>
      <div class="st-body" id="st-body"></div>
    </div>`;
  }

  /* ══════════════════════════════════════════════════════════════════
     One handler for the page
     ══════════════════════════════════════════════════════════════════ */

  const DO = {};        // action name → function, filled in by the screens below

  async function act(k, el) {
    const a = el.dataset.a || '', b = el.dataset.b || '';
    if (k === 'back') return back();
    if (k === 'repaint') return paint();
    if (k === 'clearq') return clearQuery();
    if (k.indexOf('go:') === 0) return go(k.slice(3));
    if (k.indexOf('goq:') === 0) { clearQuery(true); return go(k.slice(4), true); }
    if (k === 'tg') { P().toggle(a); repaint(); return; }
    if (k === 'set') { P().set(a, isNaN(b) || b === '' ? b : +b); repaint(); return; }
    if (k === 'unlist') { P().listRemove(a, b); repaint(); toast('@' + b + ' removed'); return; }
    if (k.indexOf('pane:') === 0) { if (typeof navigateTo === 'function') navigateTo(k.slice(5)); return; }
    const fn = DO[k];
    if (typeof fn === 'function') return fn(a, b, el);
    console.warn('[settings] no handler for ' + k);
  }

  let bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-st]');
      if (!el || !el.closest('#pane-settings')) return;
      if (el.tagName === 'INPUT') return;                 // handled on change
      e.preventDefault();
      act(el.dataset.st, el);
    });
    document.addEventListener('change', e => {
      const el = e.target.closest('[data-st]');
      if (!el || !el.closest('#pane-settings') || el.tagName !== 'INPUT') return;
      act(el.dataset.st, el);
    });
    document.addEventListener('input', e => {
      if (e.target && e.target.id === 'st-q') onQuery(e.target.value);
    });
    /* Escape backs out one screen, the way the arrow does. */
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !pane() || !pane().classList.contains('active')) return;
      if (document.querySelector('.mob-scrim, .modal-overlay-full:not(.hidden)')) return;
      if (V.q) { clearQuery(); return; }
      if (V.stack.length) { e.preventDefault(); back(); }
    });
    /* A preference changed somewhere else — the cloud copy arriving, or
       another page writing one — so whatever is on screen is redrawn. */
    if (P() && P().on) P().on(() => { if (pane() && pane().classList.contains('active')) repaint(); });
  }

  /* ══════════════════════════════════════════════════════════════════
     Sheets and confirmations
     ══════════════════════════════════════════════════════════════════ */

  let sheetFrom = null;
  function sheet(label, html) {
    closeSheet();
    sheetFrom = document.activeElement;
    const el = document.createElement('div');
    el.id = 'st-sheet';
    el.className = 'mob-scrim';
    el.innerHTML = `<div class="mob-sheet st-sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">
      <span class="mob-grab" aria-hidden="true"></span>
      <h2 class="st-sheet-h">${esc(label)}</h2>
      <div class="st-sheet-b">${html}</div>
    </div>`;
    el.addEventListener('click', e => { if (e.target === el) closeSheet(); });
    document.body.appendChild(el);
    document.addEventListener('keydown', sheetKey, true);
    requestAnimationFrame(() => {
      el.classList.add('open');
      const f = el.querySelector('input, button');
      if (f) f.focus({ preventScroll: true });
    });
  }
  function closeSheet() {
    const el = $('st-sheet');
    if (!el) return;
    el.remove();
    document.removeEventListener('keydown', sheetKey, true);
    if (sheetFrom && document.contains(sheetFrom)) { try { sheetFrom.focus({ preventScroll: true }); } catch (e) {} }
    sheetFrom = null;
  }
  function sheetKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(); } }
  DO.closesheet = () => closeSheet();

  const ask = (m, o) => (typeof appConfirm === 'function') ? appConfirm(m, o) : Promise.resolve(window.confirm(m));
  const askText = (m, v, o) => (typeof appPrompt === 'function') ? appPrompt(m, v, o) : Promise.resolve(window.prompt(m, v));

  /* Money and security changes ask again before they take effect. */
  async function guarded(what, fn) {
    if (!(await P().verify(what))) { toast('Not changed.'); return false; }
    await fn();
    return true;
  }

  /* ══════════════════════════════════════════════════════════════════
     Small shared pieces
     ══════════════════════════════════════════════════════════════════ */

  const me = () => (typeof S !== 'undefined' && S.user) || {};
  const guest = () => { const u = me(); return !u.uid || u.fname === 'Guest'; };
  const myName = () => `${me().fname || ''} ${me().lname || ''}`.trim() || 'Guest';
  const myHandle = () => String(me().handle || '@guest').replace(/^@?/, '@');

  /* The card at the top of the root list: who is signed in. */
  function accountCard() {
    const src = (window.PME && PME.photo) ? PME.photo() : '';
    const ini = (myName() || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `<button type="button" class="st-me" data-st="${guest() ? 'signin' : 'go:account'}" data-label="Your account">
      <span class="st-me-av"${src ? ` style="background-image:url('${esc(src)}')"` : ''}>${src ? '' : esc(ini)}</span>
      <span class="st-me-t">
        <b>${esc(guest() ? 'Sign in to Trending' : myName())}</b>
        <em>${esc(guest() ? 'Your settings are kept on this device until you do' : myHandle() + ' · Account Centre')}</em>
      </span>
      ${ico('chevron_right', 'st-row-go')}
    </button>`;
  }

  const gate = text => guest() ? `<p class="st-note st-gate">${esc(text)} <button type="button" class="st-link" data-st="signin">Sign in</button></p>` : '';

  DO.signin = () => { if (typeof openAuthModal === 'function') openAuthModal(); else toast('Sign-in is still loading…'); };

  /* Some of what Settings lists is drawn by the profile page — your
     saved bookmarks, your likes, your watch history, your orders, your
     analytics. Those screens are not copied here; Settings opens the
     real one. The profile pane has to exist before PG can show a
     section in it, hence the wait. */
  DO.profsec = name => {
    if (typeof navigateTo !== 'function') { toast('Still loading…'); return; }
    Promise.resolve(navigateTo('profile')).then(() => {
      if (window.PG && PG.show) PG.show(name);
    });
  };

  /* ══════════════════════════════════════════════════════════════════
     ROOT
     ══════════════════════════════════════════════════════════════════ */

  const count = l => { const n = P().listCount(l); return n ? String(n) : ''; };

  reg('root', {
    t: 'Settings & Activity', i: 'settings', k: 'settings activity preferences options',
    html: () => accountCard() + [

      sec('Your account', [
        row({ icon: 'account_circle', label: 'Account Centre', sub: 'Personal details, password, login and security', to: 'account' }),
        // No "Protected" badge: it read the two-factor switch, which never
        // protected anything and is now shown as not available yet.
        row({ icon: 'shield', label: 'Security', sub: 'Password, devices and alerts', to: 'security' }),
        row({ icon: 'lock', label: 'Crypto and wallet security', sub: 'Confirmations, whitelist and connected wallets', to: 'cryptosec' })
      ]),

      sec('How you use Trending', [
        row({ icon: 'bookmark', label: 'Saved', to: 'saved' }),
        row({ icon: 'archive', label: 'Archive', to: 'archive' }),
        row({ icon: 'bar_chart', label: 'Your activity', to: 'activity' }),
        row({ icon: 'notifications', label: 'Notifications', to: 'notif', value: P().get('notif.pause') ? 'Paused' : '', warn: !!P().get('notif.pause') }),
        row({ icon: 'schedule', label: 'Time management', to: 'time' })
      ]),

      sec('Who can see your content', [
        row({ icon: 'lock_person', label: 'Account privacy', to: 'privacy', value: P().get('privacy.account') === 'private' ? 'Private' : 'Public' }),
        row({ icon: 'stars', label: 'Close friends', to: 'closefriends', value: count('closeFriends') }),
        row({ icon: 'dashboard_customize', label: 'Crossposting', to: 'xpost' }),
        row({ icon: 'block', label: 'Blocked', to: 'blocked', value: count('blocked') }),
        row({ icon: 'auto_stories', label: 'Story, live and location', to: 'storylive' }),
        row({ icon: 'groups', label: 'Activity in friends’ feed', to: 'friendsact' })
      ]),

      sec('How others can interact with you', [
        row({ icon: 'send', label: 'Messages and story replies', to: 'msgprivacy' }),
        row({ icon: 'alternate_email', label: 'Tags and mentions', to: 'tags' }),
        row({ icon: 'mode_comment', label: 'Comments', to: 'comments' }),
        row({ icon: 'ios_share', label: 'Sharing', to: 'sharing' }),
        row({ icon: 'person_off', label: 'Restricted', to: 'restricted', value: count('restricted') }),
        row({ icon: 'error', label: 'Limit interactions', to: 'limits', value: P().get('interact.limitOn') ? 'On' : 'Off' }),
        row({ icon: 'text_fields', label: 'Hidden words', to: 'hiddenwords', value: P().words().length ? String(P().words().length) : '' }),
        row({ icon: 'person_add', label: 'Follow and invite friends', to: 'follow' })
      ]),

      sec('What you see', [
        row({ icon: 'star', label: 'Favourites', to: 'favorites', value: count('favorites') }),
        row({ icon: 'volume_off', label: 'Muted accounts', to: 'muted', value: count('mutedAccounts') }),
        row({ icon: 'tune', label: 'Content preferences', to: 'content' }),
        row({ icon: 'favorite', label: 'Like and share counts', to: 'counts',
          value: P().get('see.likeCounts') === 'show' ? '' : 'Hidden' })
      ]),

      sec('Your app and media', [
        row({ icon: 'palette', label: 'Appearance', to: 'appearance',
          value: (typeof resolvedTheme === 'function' ? resolvedTheme() : 'light') === 'dark' ? 'Dark' : 'Light' }),
        row({ icon: 'phone_iphone', label: 'Device permissions', to: 'permissions' }),
        row({ icon: 'download', label: 'Archiving and downloading', to: 'archiving' }),
        row({ icon: 'accessibility_new', label: 'Accessibility', to: 'a11y' }),
        row({ icon: 'translate', label: 'Language and sound', to: 'langsound',
          value: (typeof LG !== 'undefined' && LG.current) ? (LG.current().name || '') : '' }),
        row({ icon: 'data_usage', label: 'Data usage and media quality', to: 'data', value: P().get('media.dataSaver') ? 'Saver' : '' }),
        row({ icon: 'captive_portal', label: 'Website permissions', to: 'siteperms' })
      ]),

      sec('Your insights and tools', [
        row({ icon: 'workspace_premium', label: 'Account type and tools', to: 'acctype',
          value: ({ personal: 'Personal', creator: 'Creator', business: 'Business' })[P().get('account.type')] || 'Personal' }),
        P().get('account.type') === 'personal' ? '' :
          row({ icon: 'insights', label: 'Creator dashboard', to: 'creator' })
      ]),

      sec('Crypto and Web3', [
        row({ icon: 'account_balance_wallet', label: 'Wallets and connections', to: 'wallets' }),
        row({ icon: 'south_west', label: 'Deposits', to: 'depositset' }),
        row({ icon: 'north_east', label: 'Sends and withdrawals', to: 'withdrawset' }),
        row({ icon: 'receipt_long', label: 'Transaction history', to: 'txhistory' }),
        row({ icon: 'contacts', label: 'Address book', to: 'addressbook' }),
        row({ icon: 'lan', label: 'Networks', to: 'networks' }),
        row({ icon: 'notifications_active', label: 'Price alerts', to: 'alerts' }),
        row({ icon: 'visibility', label: 'Watchlist', to: 'watchlist' }),
        row({ icon: 'candlestick_chart', label: 'Trading preferences', to: 'tradingprefs' }),
        row({ icon: 'pie_chart', label: 'Portfolio preferences', to: 'portfolioprefs' })
      ], 'Trading, Earn and P2P are paper accounts. Deposits and sends move real coins from your own wallet — Trending never holds them.'),

      sec('Subscriptions', [
        row({ icon: 'bolt', label: 'Trending Plus', to: 'plus', value: P().get('subs.plus') ? 'Active' : 'Not subscribed' }),
        row({ icon: 'verified', label: 'Trending Verified', to: 'verified', value: P().get('subs.verified') ? 'Active' : 'Not subscribed' }),
        row({ icon: 'subscriptions', label: 'All subscriptions', to: 'allsubs' })
      ]),

      sec('Your orders and payments', [
        row({ icon: 'receipt', label: 'Orders and payments', to: 'orders' })
      ]),

      sec('More info and support', [
        row({ icon: 'help', label: 'Help', to: 'help' }),
        row({ icon: 'auto_awesome', label: 'Trending AI support', to: 'aihelp' }),
        row({ icon: 'privacy_tip', label: 'Privacy Centre', to: 'privacycentre' }),
        row({ icon: 'gavel', label: 'Account status', to: 'status' }),
        row({ icon: 'info', label: 'About', to: 'about' })
      ]),

      sec('Trending ecosystem', [
        row({ icon: 'auto_awesome', label: 'Trending AI', sub: 'Ask, summarise and draft — on this device', act: 'ai', chev: true }),
        row({ icon: 'groups', label: 'Communities', sub: 'Spaces, governance and treasuries', act: 'pane:community', chev: true }),
        row({ icon: 'currency_bitcoin', label: 'Crypto', sub: 'Markets, portfolio and the trading desk', act: 'pane:cryptomarket', chev: true }),
        row({ icon: 'movie_edit', label: 'Creator Studio', sub: 'Your posts, Shorty and analytics', act: 'studio', chev: true }),
        row({ icon: 'hub', label: 'Web3', sub: 'Connected wallets, networks and addresses', to: 'wallets' })
      ]),

      sec('Login', [
        row({ icon: 'person_add', label: 'Add account', sub: 'Use more than one Trending account on this device', act: 'addaccount', chev: true }),
        row({ icon: 'sync_alt', label: 'Switch account', act: 'switchaccount', chev: true }),
        guest()
          ? row({ icon: 'login', label: 'Sign in', act: 'signin', chev: true })
          : row({ icon: 'logout', label: 'Log out', act: 'signout', danger: true })
      ]),

      `<p class="st-ver">Trending · ${esc(VERSION)}</p>`
    ].join('')
  });

  const VERSION = 'v1.9';

  /* ══════════════════════════════════════════════════════════════════
     Wiring into the app
     ══════════════════════════════════════════════════════════════════ */

  function getSettingsTemplate() {
    return `<section id="pane-settings" class="pane">${shellHTML()}</section>`;
  }

  /* The router calls this every time Settings opens. */
  function renderSettings() {
    bind();
    dropIndex();
    if (!$('st-shell') && pane()) pane().innerHTML = shellHTML();
    paint(V.screen === 'root' ? (V.scroll.root || 0) : 0);
  }

  return {
    open, go, back, paint, repaint, renderSettings, getSettingsTemplate,
    sheet, closeSheet, row, sw, pick, sec,
    get version() { return VERSION; },
    usedToday: () => (P() && P().usedToday) ? P().usedToday() : 0,
    _: { V, SCREENS, DO, LATE, reg, results, index, esc, ico, toast, ask, askText, guarded,
         empty, failed, skeleton, person, money, when, gate, guest, me, myHandle, myName, has, P, $ }
  };
})();

window.SET = SET;

/* The screens, in the order they appear in the list. */
registerAccount(SET);
registerPrivacy(SET);
registerApp(SET);
registerCrypto(SET);

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module, so its top-level names are private to it.
   router.js calls renderSettings when the pane opens and theme.js calls
   it again when the theme changes, so both are republished here. */
import { publish } from '../globals.js?v=3';
publish('pages/settings.js', {
  SET: () => SET,
  renderSettings: () => SET.renderSettings,
  getSettingsTemplate: () => SET.getSettingsTemplate
});
