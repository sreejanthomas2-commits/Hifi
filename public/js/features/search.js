/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SEARCH — one search surface for the whole app                   ║
   ║                                                                  ║
   ║  Typing in the header used to throw you onto the Cryptoverse     ║
   ║  pane with a wall of synthesised news. This replaces that with   ║
   ║  the search people actually expect: an overlay that opens over   ║
   ║  whatever you were doing and answers as you type.                ║
   ║                                                                  ║
   ║   Top      — the best few of everything                          ║
   ║   Accounts — people, creators and communities                    ║
   ║   Shorts   — the Shorty grid, playable from the result           ║
   ║   Audio    — the track behind the shorts that use it             ║
   ║   Tags     — hashtags, with the posts and shorts carrying them   ║
   ║   Coins    — live prices, straight into the trading desk         ║
   ║                                                                  ║
   ║  Everything is matched against what the app already holds, so    ║
   ║  nothing here invents a result. Recent searches are kept per     ║
   ║  browser; an account opens a profile card with their posts and   ║
   ║  shorts, and the buttons that already exist elsewhere.           ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const SR = (() => {

  const KEY = 'ts_search';
  const MAX_RECENT = 8;

  const TABS = [
    ['top',      'Top',      'auto_awesome'],
    ['accounts', 'Accounts', 'person'],
    ['shorts',   'Shorts',   'play_circle'],
    ['audio',    'Audio',    'music_note'],
    ['tags',     'Tags',     'tag'],
    ['coins',    'Coins',    'currency_bitcoin']
  ];

  let D = load();
  let V = null;                     // { q, tab, view, ... } while the overlay is open
  let timer = null;

  function load() {
    try { return { recent: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch (e) { return { recent: [] }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s)) : String(s == null ? '' : s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const ic = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');
  /* A value dropped into an onclick="" attribute: JSON first so the JS
     parser is happy, HTML-escaped second so the attribute is. */
  const A = v => esc(JSON.stringify(v === undefined ? null : v));
  const initials = n => String(n || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K';
    return String(n);
  }

  /* A number that never changes for a given handle — follower counts have
     to look stable across visits, and nothing here has a real one. */
  function seeded(handle, min, max) {
    let h = 2166136261;
    const s = String(handle || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return min + (h % Math.max(1, max - min));
  }

  /* ── Scoring ─────────────────────────────────────────────────────── */
  /* Exact, then "starts with", then a word boundary, then anywhere —
     so "sa" puts Sarah above someone with "sa" buried mid-word. */
  function score(text, q) {
    const t = String(text || '').toLowerCase();
    if (!t) return 0;
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    const words = t.split(/[^a-z0-9]+/);
    if (words.some(w => w.startsWith(q))) return 60;
    if (t.includes(q)) return 30;
    return 0;
  }
  const best = (fields, q) => fields.reduce((m, f) => Math.max(m, score(f, q)), 0);

  /* ── Sources ─────────────────────────────────────────────────────── */
  function accounts() {
    const map = {};
    const names = {};
    /* One row per person. The same name turns up with a different handle
       across posts, chats and the reel catalogue; first source wins. */
    const add = (name, handle, kind, extra) => {
      const h = String(handle || '').toLowerCase();
      const n = String(name || '').trim().toLowerCase();
      if (!n || !h || map[h] || names[n]) return;
      names[n] = true;
      map[h] = { name, handle, kind: kind || 'person', ...(extra || {}) };
    };

    ((typeof DATA !== 'undefined' && DATA.users) || []).forEach(u => add(u.name, u.handle, 'person'));
    ((typeof DATA !== 'undefined' && DATA.posts) || []).forEach(p => add(p.author, p.handle, 'person'));
    ((typeof DATA !== 'undefined' && DATA.cryptoPosts) || []).forEach(p => add(p.author, p.handle, 'person'));
    if (typeof SH !== 'undefined' && SH.CATALOG) SH.CATALOG.forEach(s => add(s.creator, s.handle, 'creator'));
    ((typeof DATA !== 'undefined' && DATA.conversations) || []).forEach(c => {
      if (c.type === 'chats') add(c.name, '@' + String(c.name).toLowerCase().replace(/[^a-z0-9]+/g, ''), 'person');
    });
    if (typeof CH !== 'undefined' && CH.COMMUNITIES) {
      CH.COMMUNITIES.forEach(c => add(c.name, '@' + c.id, 'community', { icon: c.icon, color: c.color, members: c.members, com: c.id }));
    }

    const me = (typeof S !== 'undefined' && S.user) ? S.user : null;
    if (me && me.handle && me.handle !== 'Sign In') {
      add(`${me.fname || ''} ${me.lname || ''}`.trim() || 'You', me.handle, 'me');
    }
    return Object.keys(map).map(k => map[k]);
  }

  const shorts = () => (typeof SH !== 'undefined' && SH.all) ? SH.all() : [];

  function audioTracks() {
    const map = {};
    shorts().forEach(s => {
      const name = s.audio || 'Original audio';
      map[name] = map[name] || { name, count: 0, clips: [] };
      map[name].count++;
      map[name].clips.push(s);
    });
    return Object.keys(map).map(k => map[k]);
  }

  function tags() {
    const map = {};
    const add = (raw, kind) => {
      const t = String(raw || '').replace(/^#/, '').toLowerCase();
      if (!t) return;
      map[t] = map[t] || { tag: t, posts: 0, clips: 0 };
      map[t][kind]++;
    };
    ((typeof DATA !== 'undefined' && DATA.posts) || []).forEach(p => (p.tags || []).forEach(t => add(t, 'posts')));
    shorts().forEach(s => (String(s.caption || '').match(/#[\w]+/g) || []).forEach(t => add(t, 'clips')));
    return Object.keys(map).map(k => map[k]);
  }

  const coins = () => {
    const live = window.liveCryptoPrices || {};
    return Object.keys(live).map(sym => ({ sym, name: live[sym].name || sym, px: live[sym].usd, ch: live[sym].change24h || live[sym].usd_24h_change || 0 }));
  };

  const posts = () => ((typeof DATA !== 'undefined' && DATA.posts) || []);

  /* ── Query ───────────────────────────────────────────────────────── */
  function results(qRaw) {
    const q = String(qRaw || '').trim().toLowerCase().replace(/^[#@]/, '');
    if (!q) return null;

    const rank = (list, fields, floor) => list
      .map(item => ({ item, s: best(fields(item), q) }))
      .filter(r => r.s >= (floor || 1))
      .sort((a, b) => b.s - a.s)
      .map(r => r.item);

    return {
      q,
      accounts: rank(accounts(), a => [a.name, a.handle]),
      shorts:   rank(shorts(),   s => [s.caption, s.creator, s.handle, s.audio]),
      audio:    rank(audioTracks(), a => [a.name]),
      tags:     rank(tags(),     t => [t.tag]),
      // 150-odd live tickers: a loose substring match buries the real answer
      // under obscure funds, so a coin has to actually start with the query.
      coins:    rank(coins(),    c => [c.sym, c.name], 60),
      posts:    rank(posts(),    p => [p.body, p.author, p.handle, (p.tags || []).join(' ')])
    };
  }

  /* ── Recent searches ─────────────────────────────────────────────── */
  function remember(q) {
    const t = String(q || '').trim();
    if (t.length < 2) return;
    D.recent = [t].concat(D.recent.filter(x => x.toLowerCase() !== t.toLowerCase())).slice(0, MAX_RECENT);
    save();
  }
  function forget(i) { D.recent.splice(i, 1); save(); paint(); }
  function clearRecent() { D.recent = []; save(); paint(); }

  /* ── Overlay ─────────────────────────────────────────────────────── */
  function open(q, raw) {
    // The header search now opens Discover; this overlay still serves the
    // person, sound and tag pages Discover links into.
    if (!raw && window.DX) { DX.open(q || ''); return; }
    V = { q: q || '', tab: 'top', view: 'search' };
    let host = document.getElementById('sr-overlay');
    if (!host) {
      host = document.createElement('div');
      host.id = 'sr-overlay';
      host.className = 'sr-overlay';
      document.body.appendChild(host);
      document.addEventListener('keydown', onKey);
    }
    paint();
    const inp = document.getElementById('sr-input');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }

  function close() {
    const host = document.getElementById('sr-overlay');
    if (host) host.remove();
    document.removeEventListener('keydown', onKey);
    V = null;
    const gs = document.getElementById('global-search');
    if (gs) gs.blur();
  }

  function onKey(e) {
    if (!V) return;
    if (e.key === 'Escape') { e.preventDefault(); if (V.view !== 'search') back(); else close(); }
  }

  /* Typing repaints the results but never the input, so the caret and any
     selection survive every keystroke. */
  function type(value) {
    if (!V) return;
    V.q = value;
    clearTimeout(timer);
    timer = setTimeout(() => { paintBody(); }, 110);
  }

  function submit() {
    if (!V) return;
    remember(V.q);
    paintBody();
  }

  function setTab(t) { if (V) { V.tab = t; paintBody(); } }

  function pick(q) {
    if (!V) return;
    V.q = q;
    remember(q);
    const inp = document.getElementById('sr-input');
    if (inp) inp.value = q;
    paintBody();
  }

  /* Discover opens a person, sound or tag straight into its page here;
     Back closes this layer and lands on Discover again. */
  function show(kind, arg) {
    open('', true);
    V.fromDiscover = true;
    if (kind === 'account') openAccount(arg);
    else if (kind === 'track') openTrack(arg);
    else if (kind === 'tag') openTag(arg);
    if (V && V.view === 'search') { close(); return false; }
    return true;
  }

  function back() {
    if (!V) return;
    if (V.fromDiscover) { close(); return; }
    V.view = 'search';
    V.account = null;
    V.track = null;
    V.tag = null;
    paint();
  }

  function paint() {
    const host = document.getElementById('sr-overlay');
    if (!host || !V) return;
    host.innerHTML = `
      <div class="sr-sheet" role="dialog" aria-label="Search">
        <div class="sr-head">
          ${V.view === 'search' ? '' : `<button class="icon-btn" onclick="SR.back()" aria-label="Back">
            <span class="material-symbols-rounded ms-20">arrow_back</span></button>`}
          <div class="sr-field">
            <span class="material-symbols-rounded ms-18">search</span>
            <input id="sr-input" type="text" value="${esc(V.q)}" autocomplete="off" spellcheck="false"
                   placeholder="Search people, shorts, audio, tags"
                   oninput="SR.type(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();SR.submit();}">
            ${V.q ? `<button class="icon-btn sr-clear" onclick="SR.pick('')" aria-label="Clear">
              <span class="material-symbols-rounded ms-18">cancel</span></button>` : ''}
          </div>
          <button class="sr-cancel" onclick="SR.close()">Cancel</button>
        </div>
        <div id="sr-body" class="sr-body"></div>
      </div>`;
    host.onclick = e => { if (e.target === host) close(); };
    paintBody();
    const inp = document.getElementById('sr-input');
    if (inp) inp.focus();
  }

  function paintBody() {
    const box = document.getElementById('sr-body');
    if (!box || !V) return;

    if (V.view === 'account') { box.innerHTML = accountView(V.account); return; }
    if (V.view === 'track')   { box.innerHTML = trackView(V.track); wirePreviews(box); return; }
    if (V.view === 'tag')     { box.innerHTML = tagView(V.tag); wirePreviews(box); return; }

    const r = results(V.q);
    if (!r) { box.innerHTML = idleView(); return; }

    box.innerHTML = tabsHTML(r) + resultsHTML(r);
    wirePreviews(box);
  }

  /* ── Empty state ─────────────────────────────────────────────────── */
  function idleView() {
    const suggested = accounts().filter(a => a.kind !== 'me').slice(0, 6);
    return `
      ${D.recent.length ? `
        <div class="sr-sec">
          Recent
          <button class="sr-link" onclick="SR.clearRecent()">Clear all</button>
        </div>
        ${D.recent.map((t, i) => `
          <div class="sr-row" onclick="SR.pick(${A(t)})">
            <div class="sr-ic"><span class="material-symbols-rounded ms-20">history</span></div>
            <div class="sr-main"><div class="sr-name">${esc(t)}</div></div>
            <button class="icon-btn" onclick="event.stopPropagation();SR.forget(${i})" aria-label="Remove">
              <span class="material-symbols-rounded ms-18">close</span></button>
          </div>`).join('')}` : ''}
      <div class="sr-sec">Suggested for you</div>
      ${suggested.map(accountRow).join('')}`;
  }

  /* ── Tabs ────────────────────────────────────────────────────────── */
  function countFor(r, tab) {
    switch (tab) {
      case 'accounts': return r.accounts.length;
      case 'shorts':   return r.shorts.length;
      case 'audio':    return r.audio.length;
      case 'tags':     return r.tags.length;
      case 'coins':    return r.coins.length;
      default:         return r.accounts.length + r.shorts.length + r.tags.length + r.coins.length;
    }
  }

  function tabsHTML(r) {
    return `<div class="sr-tabs">${TABS.map(([k, label, icon]) => {
      const n = countFor(r, k);
      return `<button class="sr-tab${V.tab === k ? ' active' : ''}${n ? '' : ' empty'}" onclick="SR.setTab('${k}')">
        <span class="material-symbols-rounded ms-16">${icon}</span>${label}${n ? ` <i>${n}</i>` : ''}
      </button>`;
    }).join('')}</div>`;
  }

  /* ── Result lists ────────────────────────────────────────────────── */
  function resultsHTML(r) {
    const empty = `<div class="sr-empty">
      <span class="material-symbols-rounded">search_off</span>
      <div>No results for “${esc(r.q)}”</div>
      <div class="fs11 tc-3">Try a name, a @handle, a #tag or a coin.</div>
    </div>`;

    if (V.tab === 'accounts') return r.accounts.length ? r.accounts.map(accountRow).join('') : empty;
    if (V.tab === 'shorts')   return r.shorts.length ? grid(r.shorts) : empty;
    if (V.tab === 'audio')    return r.audio.length ? r.audio.map(audioRow).join('') : empty;
    if (V.tab === 'tags')     return r.tags.length ? r.tags.map(tagRow).join('') : empty;
    if (V.tab === 'coins')    return r.coins.length ? r.coins.map(coinRow).join('') : empty;

    // Top — a few of each, in the order people scan them.
    const parts = [];
    if (r.accounts.length) parts.push(section('Accounts', r.accounts.slice(0, 4).map(accountRow).join(''), r.accounts.length > 4 ? 'accounts' : ''));
    if (r.shorts.length)   parts.push(section('Shorts', grid(r.shorts.slice(0, 6)), r.shorts.length > 6 ? 'shorts' : ''));
    if (r.tags.length)     parts.push(section('Tags', r.tags.slice(0, 3).map(tagRow).join(''), r.tags.length > 3 ? 'tags' : ''));
    if (r.audio.length)    parts.push(section('Audio', r.audio.slice(0, 3).map(audioRow).join(''), r.audio.length > 3 ? 'audio' : ''));
    if (r.coins.length)    parts.push(section('Coins', r.coins.slice(0, 3).map(coinRow).join(''), r.coins.length > 3 ? 'coins' : ''));
    if (r.posts.length)    parts.push(section('Posts', r.posts.slice(0, 3).map(postRow).join(''), ''));
    return parts.length ? parts.join('') : empty;
  }

  const section = (title, body, more) => `
    <div class="sr-sec">${esc(title)}${more ? `<button class="sr-link" onclick="SR.setTab('${more}')">See all</button>` : ''}</div>
    ${body}`;

  function avatarHTML(a) {
    if (a.kind === 'community') {
      return `<div class="sr-av" style="background:${esc(a.color || 'var(--g-brand)')}">
        <span class="material-symbols-rounded ms-20">${esc(a.icon || 'hub')}</span></div>`;
    }
    return `<div class="sr-av">${esc(initials(a.name))}</div>`;
  }

  function accountRow(a) {
    const sub = a.kind === 'community'
      ? `${compact(a.members || 0)} members · Community`
      : `${esc(a.handle)} · ${compact(seeded(a.handle, 900, 480000))} followers`;
    return `<div class="sr-row" onclick="SR.openAccount(${A(a.handle)})">
      ${avatarHTML(a)}
      <div class="sr-main">
        <div class="sr-name">${esc(a.name)}${a.kind === 'creator' ? '<span class="sr-badge">Creator</span>' : ''}${a.kind === 'me' ? '<span class="sr-badge">You</span>' : ''}</div>
        <div class="sr-sub">${sub}</div>
      </div>
      <span class="material-symbols-rounded ms-18 tc-3">chevron_right</span>
    </div>`;
  }

  function audioRow(t) {
    return `<div class="sr-row" onclick="SR.openTrack(${A(t.name)})">
      <div class="sr-ic music"><span class="material-symbols-rounded ms-20">music_note</span></div>
      <div class="sr-main">
        <div class="sr-name">${esc(t.name)}</div>
        <div class="sr-sub">${t.count} short${t.count === 1 ? '' : 's'}</div>
      </div>
      <span class="material-symbols-rounded ms-18 tc-3">chevron_right</span>
    </div>`;
  }

  function tagRow(t) {
    const bits = [];
    if (t.posts) bits.push(t.posts + ' post' + (t.posts === 1 ? '' : 's'));
    if (t.clips) bits.push(t.clips + ' short' + (t.clips === 1 ? '' : 's'));
    return `<div class="sr-row" onclick="SR.openTag(${A(t.tag)})">
      <div class="sr-ic tag">#</div>
      <div class="sr-main">
        <div class="sr-name">#${esc(t.tag)}</div>
        <div class="sr-sub">${bits.join(' · ') || 'No posts yet'}</div>
      </div>
      <span class="material-symbols-rounded ms-18 tc-3">chevron_right</span>
    </div>`;
  }

  function coinRow(c) {
    const up = c.ch >= 0;
    return `<div class="sr-row" onclick="SR.openCoin(${A(c.sym)})">
      <div class="sr-ic plain">${ic(c.sym, 28)}</div>
      <div class="sr-main">
        <div class="sr-name">${esc(c.sym)}</div>
        <div class="sr-sub">${esc(c.name)}</div>
      </div>
      <div class="sr-right">
        <div class="sr-name">$${(c.px || 0).toLocaleString('en-US', { maximumFractionDigits: c.px < 1 ? 6 : 2 })}</div>
        <div class="sr-sub ${up ? 'tc-green' : 'tc-red'}">${up ? '+' : ''}${(c.ch || 0).toFixed(2)}%</div>
      </div>
    </div>`;
  }

  function postRow(p) {
    return `<div class="sr-row" onclick="SR.openPost(${A(p.id)})">
      <div class="sr-av">${esc(initials(p.author))}</div>
      <div class="sr-main">
        <div class="sr-name">${esc(p.author)}</div>
        <div class="sr-sub">${esc(String(p.body || '').slice(0, 70))}</div>
      </div>
    </div>`;
  }

  /* Shorts render as the same tiles the Shorty hub uses, so a result plays
     on tap and previews on hover. */
  function grid(list) {
    const ids = list.map(s => s.id);
    return `<div class="sr-grid">${list.map((s, i) => `
      <button class="sr-tile" onclick="SR.playShort(${i}, ${A(ids)})"
              aria-label="Play short by ${esc(s.creator)}">
        <video class="sr-tile-v" src="${esc(s.src)}#t=0.5" muted loop playsinline preload="metadata"${s.zoom ? ` style="transform:scale(${s.zoom})"` : ''}></video>
        <span class="sr-tile-shade"></span>
        <span class="sr-tile-meta"><span class="material-symbols-rounded">play_arrow</span>${compact(s.views || 0)}</span>
      </button>`).join('')}</div>`;
  }

  function wirePreviews(root) {
    root.querySelectorAll('.sr-tile').forEach(tile => {
      const v = tile.querySelector('video');
      if (!v) return;
      tile.addEventListener('mouseenter', () => { v.play().catch(() => {}); });
      tile.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0.5; });
    });
  }

  /* ── Sub-views ───────────────────────────────────────────────────── */
  function openAccount(handle) {
    const a = accounts().find(x => x.handle.toLowerCase() === String(handle).toLowerCase());
    if (!a) return;
    remember(a.name);
    V.view = 'account';
    V.account = a;
    paint();
  }

  function accountView(a) {
    if (!a) return '';
    const theirPosts = posts().filter(p => String(p.handle || '').toLowerCase() === a.handle.toLowerCase());
    const theirShorts = shorts().filter(s => String(s.handle || '').toLowerCase() === a.handle.toLowerCase());
    const followers = seeded(a.handle, 900, 480000);

    return `
      <div class="sr-profile">
        ${avatarHTML(a).replace('sr-av', 'sr-av xl')}
        <div class="sr-p-name">${esc(a.name)}</div>
        <div class="sr-p-handle">${esc(a.handle)}</div>
        <div class="sr-stats">
          <div><b>${theirPosts.length + theirShorts.length}</b><span>posts</span></div>
          <div><b>${compact(a.kind === 'community' ? (a.members || 0) : followers)}</b><span>${a.kind === 'community' ? 'members' : 'followers'}</span></div>
          <div><b>${compact(seeded(a.handle + 'f', 80, 2400))}</b><span>following</span></div>
        </div>
        <div class="sr-p-acts">
          ${a.kind === 'community'
            ? `<button class="btn btn-primary btn-sm" onclick="SR.openCommunity(${A(a.com)})">Open community</button>`
            : `<button class="btn btn-primary btn-sm" onclick="SR.message(${A(a.name)})">Message</button>
               <button class="btn btn-ghost btn-sm" onclick="SR.payTo(${A(a.handle)})">Pay</button>
               <button class="btn btn-ghost btn-sm" onclick="SR.follow(${A(a.name)})">Follow</button>`}
        </div>
      </div>
      ${theirShorts.length ? `<div class="sr-sec">Shorts</div>${grid(theirShorts)}` : ''}
      ${theirPosts.length ? `<div class="sr-sec">Posts</div>${theirPosts.map(postRow).join('')}` : ''}
      ${!theirPosts.length && !theirShorts.length
        ? '<div class="sr-empty"><span class="material-symbols-rounded">grid_off</span><div>No posts yet</div></div>' : ''}`;
  }

  /* The way in from anywhere outside this overlay.

     openAccount above is written for a row inside an overlay that is
     already painted: it assigns straight to V and would throw if nothing
     had opened yet. This opens first - raw, so it does not hand off to
     Discover the way the header search does - and lands on the person.

     A name given alongside the handle is a fallback for somebody the
     index has not seen: the page then shows them with no posts, which is
     true, rather than refusing to open at all. */
  function openProfile(handle, name) {
    const h = String(handle || '').toLowerCase();
    if (!h) return false;
    let a = accounts().find(x => String(x.handle).toLowerCase() === h);
    if (!a && name) a = { name: String(name), handle: String(handle), kind: 'person' };
    if (!a) return false;
    open('', true);
    V.view = 'account';
    V.account = a;
    remember(a.name);
    paint();
    return true;
  }

  function openTrack(name) {
    V.view = 'track';
    V.track = name;
    remember(name);
    paint();
  }

  function trackView(name) {
    const clips = shorts().filter(s => (s.audio || 'Original audio') === name);
    return `
      <div class="sr-profile">
        <div class="sr-av xl music"><span class="material-symbols-rounded" style="font-size:30px">music_note</span></div>
        <div class="sr-p-name">${esc(name)}</div>
        <div class="sr-p-handle">${clips.length} short${clips.length === 1 ? '' : 's'} use this audio</div>
        <div class="sr-p-acts">
          <button class="btn btn-primary btn-sm" onclick="SR.playShort(0, ${A(clips.map(c => c.id))})">Play all</button>
        </div>
      </div>
      ${clips.length ? grid(clips) : '<div class="sr-empty"><span class="material-symbols-rounded">music_off</span><div>Nothing uses this audio yet</div></div>'}`;
  }

  function openTag(tag) {
    V.view = 'tag';
    V.tag = tag;
    remember('#' + tag);
    paint();
  }

  function tagView(tag) {
    const t = String(tag).toLowerCase();
    const tagged = posts().filter(p => (p.tags || []).some(x => String(x).replace(/^#/, '').toLowerCase() === t));
    const clips = shorts().filter(s => String(s.caption || '').toLowerCase().includes('#' + t));
    return `
      <div class="sr-profile">
        <div class="sr-av xl tag">#</div>
        <div class="sr-p-name">#${esc(tag)}</div>
        <div class="sr-p-handle">${tagged.length} post${tagged.length === 1 ? '' : 's'} · ${clips.length} short${clips.length === 1 ? '' : 's'}</div>
        <div class="sr-p-acts">
          <button class="btn btn-primary btn-sm" onclick="SR.seeFeed(${A(tag)})">See in feed</button>
        </div>
      </div>
      ${clips.length ? `<div class="sr-sec">Shorts</div>${grid(clips)}` : ''}
      ${tagged.length ? `<div class="sr-sec">Posts</div>${tagged.map(postRow).join('')}` : ''}
      ${!tagged.length && !clips.length
        ? '<div class="sr-empty"><span class="material-symbols-rounded">tag</span><div>Nothing tagged yet</div></div>' : ''}`;
  }

  /* ── Actions ─────────────────────────────────────────────────────── */
  function playShort(index, ids) {
    if (typeof SH === 'undefined') return;
    const all = shorts();
    const list = (ids || []).map(id => all.find(s => s.id === id)).filter(Boolean);
    close();
    setTimeout(() => SH.openAt(index || 0, list.length ? list : undefined), 60);
  }

  function openCoin(sym) {
    close();
    if (typeof TR !== 'undefined' && TR.isTradable && TR.isTradable(sym)) {
      TR.setPair(sym);
      navigateTo('trade');
    } else {
      navigateTo('explore');
      toast(`${sym} has no live market right now.`);
    }
  }

  function openCommunity(id) {
    close();
    navigateTo('community');
    setTimeout(() => { if (typeof CH !== 'undefined' && CH.enter) CH.enter(id); }, 150);
  }

  function message(name) {
    const convo = ((typeof DATA !== 'undefined' && DATA.conversations) || []).find(c => c.name === name);
    close();
    navigateTo('messages');
    if (convo && typeof TG !== 'undefined') setTimeout(() => TG.open('c:' + convo.id), 140);
    else toast(`No chat with ${name} yet.`);
  }

  function payTo(handle) {
    close();
    if (typeof PAY !== 'undefined') PAY.openPayTo({ handle });
    else toast('Payments are still loading…');
  }

  function follow(name) { toast(`Following ${name}`); }

  function openPost(id) {
    close();
    /* Chained, not timed: navigateTo resolves once the pane is there. */
    navigateTo('feeds').then(() => setTimeout(() => {
      const el = document.querySelector(`[data-post-id="${id}"]`) || document.getElementById('post-' + id);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('sr-flash'); setTimeout(() => el.classList.remove('sr-flash'), 1600); }
    }, 200));
  }

  function seeFeed(tag) {
    close();
    navigateTo('feeds').then(() => {
      const gs = document.getElementById('global-search');
      if (gs) gs.value = '#' + tag;
      if (typeof renderFeed === 'function') renderFeed('#' + tag);
    });
    toast(`Showing posts tagged #${tag}`);
  }

  /* ── Wiring ──────────────────────────────────────────────────────── */
  /* The header field becomes a button: focusing it opens the overlay and
     hands focus to the overlay's own input. */
  function setup() {
    ['global-search', 'explore-search'].forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.srWired) return;
      el.dataset.srWired = '1';
      el.setAttribute('placeholder', 'Search people, shorts, audio, tags');
      el.addEventListener('focus', e => { e.preventDefault(); open(el.value || ''); });
      el.addEventListener('click', () => { if (!V) open(el.value || ''); });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); open(el.value || ''); }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(setup, 60));
  else setTimeout(setup, 60);

  return {
    open, close, back, type, submit, setTab, pick, forget, clearRecent,
    openAccount, openTrack, openTag, openCoin, openCommunity, openPost,
    playShort, message, payTo, follow, seeFeed, setup, show, remember, coins,
    results, accounts, get state() { return D; }, openProfile
  };
})();

window.SR = SR;

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
publish('features/search.js', {
  SR: () => SR
});
