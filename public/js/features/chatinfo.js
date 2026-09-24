/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CHAT DETAILS — the page behind a chat's header                  ║
   ║                                                                  ║
   ║  Tap the name or picture at the top of a chat and this opens     ║
   ║  over the thread. What it holds depends on who you are talking   ║
   ║  to:                                                             ║
   ║                                                                  ║
   ║    a person   profile, search, mute, options; crypto with them   ║
   ║               (send, request, their Trending Tag, the wallet     ║
   ║               addresses they shared, recent payments); theme,    ║
   ║               disappearing messages, nickname, privacy, a new    ║
   ║               group with them; what was shared                   ║
   ║    a group    add people, search, mute, options; split a bill    ║
   ║               or send a gift packet; name and photo, invite      ║
   ║               link, people, theme, disappearing messages         ║
   ║    a channel, a community room, a bot, Saved Messages — the      ║
   ║               parts of the above that make sense for each        ║
   ║                                                                  ║
   ║  Everything reuses what the chat already had: TG's mute, archive ║
   ║  and invite link, CFI's crypto panel, WAD's address book, the    ║
   ║  Settings block and restrict lists. What is new lives here —     ║
   ║  themes, nicknames, per-chat disappearing messages, group        ║
   ║  names, photos and members — and all of it stays on this device. ║
   ║                                                                  ║
   ║  Crypto rules that hold here as everywhere: wallet addresses     ║
   ║  appear only when the person shared one in this chat or you      ║
   ║  saved it (the seed contacts' made-up addresses never do); the   ║
   ║  Trending Tag is an in-app code, never shown as a chain address; ║
   ║  chat payments are the paper account and say so.                 ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CI = (() => {

  const KEY = 'ts_chatinfo_v1';
  const DEFAULT = { theme: {}, nick: {}, vanish: {}, photo: {}, name: {}, members: {}, groups: [], left: [] };

  /* The sample group's people. Its own history has Sarah sharing
     layout files there, so she and two others are in it. */
  const SEED_MEMBERS = { 'c:5': ['@sarahc', '@devk', '@zaraa'] };

  /* Themes tint the thread and colour your own bubbles. They are drawn
     for Trending rather than borrowed: two-stop gradients that keep
     white text readable, and a tint faint enough to work in light and
     dark mode alike. */
  const THEMES = [
    { id: 'classic',  name: 'Trending' },
    { id: 'ocean',    name: 'Ocean',    a: '#1F6FEB', b: '#2F95D6', tint: '31,111,235' },
    { id: 'aurora',   name: 'Aurora',   a: '#0E8F8F', b: '#6A4FD6', tint: '14,143,143' },
    { id: 'sunset',   name: 'Sunset',   a: '#D9481F', b: '#B8305E', tint: '217,72,31' },
    { id: 'berry',    name: 'Berry',    a: '#9333B0', b: '#CF3A6E', tint: '147,51,176' },
    { id: 'forest',   name: 'Forest',   a: '#12714F', b: '#23875C', tint: '18,113,79' },
    { id: 'lavender', name: 'Lavender', a: '#5B4BD6', b: '#7C6BE8', tint: '91,75,214' },
    { id: 'graphite', name: 'Graphite', a: '#2B2F38', b: '#4A505C', tint: '74,80,92' }
  ];

  const VANISH = [[0, 'Off'], [60, '1 minute'], [3600, '1 hour'], [86400, '24 hours'], [604800, '7 days']];

  let D = load();
  /* The open page: which chat, which view, what is typed. */
  let V = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const base = JSON.parse(JSON.stringify(DEFAULT));
      return raw ? Object.assign(base, JSON.parse(raw)) : base;
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { toast('Could not save that on this device.'); } }

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s)) : String(s == null ? '' : s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const ico = (n, cls) => `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}" aria-hidden="true">${n}</span>`;
  const $ = id => document.getElementById(id);
  const hasTG = () => typeof TG !== 'undefined';
  const initials = n => String(n || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const first = n => String(n || '').split(/\s+/)[0] || 'them';
  const timeOf = ts => ts ? new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  const usd = v => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const short = a => { a = String(a || ''); return a.length > 16 ? a.slice(0, 8) + '…' + a.slice(-6) : a; };
  const ask = (msg, o) => (typeof appConfirm === 'function' ? appConfirm(msg, o) : Promise.resolve(window.confirm(msg)));

  /* ── Who is this chat with ──────────────────────────────────────── */
  function kindOf(c) {
    if (!c) return '';
    if (c.src === 'saved') return 'saved';
    if (c.src === 'com') return 'com';
    if (c.kind === 'groups') return 'group';
    if (c.kind === 'channels') return 'channel';
    if (c.kind === 'bots') return 'bot';
    return 'person';
  }

  function people() {
    if (window.UID && UID.contacts) return UID.contacts();
    return (typeof DATA !== 'undefined' && DATA.users) || [];
  }
  const byHandle = h => people().find(u => String(u.handle).toLowerCase() === String(h).toLowerCase());

  /* The account behind a one-to-one chat. Conversations carry a name and
     no handle, so it is matched by name; a chat with nobody on record
     simply has no Profile button. */
  function account(c) {
    if (!c || kindOf(c) !== 'person') return null;
    const n = String(c.raw && c.raw.name || c.name).toLowerCase();
    return people().find(u => String(u.name).toLowerCase() === n) || null;
  }

  const chatId = c => (c && c.raw ? c.raw.id : null);
  const dmFor = name => (typeof DATA !== 'undefined' ? (DATA.conversations || []) : [])
    .find(x => (x.type || 'chats') === 'chats' && String(x.name).toLowerCase() === String(name).toLowerCase());

  /* ── Stored per chat ────────────────────────────────────────────── */
  const nickOf = key => D.nick[key] || '';
  const photoOf = key => D.photo[key] || '';
  const themeOf = key => THEMES.find(t => t.id === D.theme[key]) || THEMES[0];

  const TP_ = () => (typeof TP !== 'undefined' ? TP : null);
  function onList(list, c) {
    const a = account(c), tp = TP_();
    return !!(a && tp && tp.listHas && tp.listHas(list, a.handle));
  }
  const isBlocked = c => onList('blocked', c);
  const isRestricted = c => onList('restricted', c);

  function membersOf(key) {
    if (D.members[key]) return D.members[key].slice();
    return (SEED_MEMBERS[key] || []).slice();
  }
  const ownGroup = key => D.groups.some(g => 'c:' + g.id === key);
  const editable = c => kindOf(c) === 'group';

  /* ── Disappearing messages ──────────────────────────────────────── */
  /* Each chat keeps the windows in which the timer was on. A message
     disappears when it was sent inside a window and is older than that
     window's timer - so turning the timer off later does not bring the
     vanished ones back, and messages from before it was on are never
     touched. Payment cards are exempt: they are a record of money. */
  function windows(key) { return Array.isArray(D.vanish[key]) ? D.vanish[key] : []; }
  function vanishOf(key) {
    const w = windows(key);
    const cur = w[w.length - 1];
    return cur && !cur.off ? cur.ttl : 0;
  }
  function setVanish(key, ttl) {
    const w = windows(key).slice();
    const cur = w[w.length - 1];
    const now = Date.now();
    if (cur && !cur.off) cur.off = now;
    if (ttl > 0) w.push({ ttl, since: now, off: 0 });
    D.vanish[key] = w;
    save();
  }

  let nextAt = Infinity, timer = null;
  function arm(at) {
    if (at >= nextAt) return;
    nextAt = at;
    clearTimeout(timer);
    timer = setTimeout(() => { nextAt = Infinity; if (hasTG()) TG.paintThread(); },
      Math.min(Math.max(at - Date.now(), 250), 2147483000));
  }

  function gone(key, m) {
    if (!m || m.fi || m.stamped === false || !m.ts) return false;
    const w = windows(key);
    if (!w.length) return false;
    const now = Date.now();
    for (const x of w) {
      if (m.ts < x.since || (x.off && m.ts >= x.off)) continue;
      const end = m.ts + x.ttl * 1000;
      if (end <= now) return true;
      arm(end);
    }
    return false;
  }

  /* ── Hooks the chat calls ───────────────────────────────────────── */
  /* Groups you made, left or renamed survive a reload: the seed data is
     rebuilt on every load, so this puts your changes back on top. */
  function sync() {
    if (typeof DATA === 'undefined' || !Array.isArray(DATA.conversations)) return;
    const list = DATA.conversations;
    D.groups.slice().reverse().forEach(g => {
      if (!list.some(x => String(x.id) === String(g.id))) list.unshift(Object.assign({ unread: 0, online: false }, g));
    });
    for (let i = list.length - 1; i >= 0; i--) {
      if (D.left.indexOf('c:' + list[i].id) > -1) list.splice(i, 1);
    }
    list.forEach(x => { const n = D.name['c:' + x.id]; if (n) x.name = n; });
  }

  /* Called whenever the header repaints: the theme follows the chat,
     and a details page left open for another chat closes. */
  function dress(c) {
    const chat = document.querySelector('#msgr-root .msgr-chat');
    if (chat && c) {
      const t = themeOf(c.key);
      if (t.a) {
        chat.dataset.ct = t.id;
        chat.style.setProperty('--ct-a', t.a);
        chat.style.setProperty('--ct-b', t.b);
        chat.style.setProperty('--ct-tint', t.tint);
      } else {
        delete chat.dataset.ct;
        ['--ct-a', '--ct-b', '--ct-tint'].forEach(p => chat.style.removeProperty(p));
      }
    }
    if (V && c && V.key !== c.key) close(true);
  }

  const headerName = c => (c && nickOf(c.key)) || (c ? c.name : '');

  /* Their messages go to Requests while restricted — what the Settings
     page promises about restricting. */
  const inRequests = c => kindOf(c) === 'person' && isRestricted(c);

  function canSend(c) {
    if (kindOf(c) === 'person' && isBlocked(c)) {
      toast(`You blocked ${first(c.name)}. Unblock them in chat details to send a message.`);
      return false;
    }
    return true;
  }

  /* ── Open and close ─────────────────────────────────────────────── */
  function open() {
    const c = hasTG() ? TG.activeChat() : null;
    if (!c) return;
    V = { key: c.key, view: 'main', stack: [], q: '', tab: 'media', sheet: null, pick: [], draft: {} };
    const host = document.querySelector('#msgr-root .msgr-chat');
    if (!host) return;
    let el = $('ci');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ci';
      el.className = 'ci';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Chat details');
      el.addEventListener('click', onClick);
      el.addEventListener('input', onInput);
      el.addEventListener('change', onChange);
      host.appendChild(el);
    }
    paint();
    const b = el.querySelector('.ci-back');
    if (b) b.focus({ preventScroll: true });
  }

  function close(quiet) {
    const el = $('ci');
    V = null;
    if (el) el.remove();
    if (!quiet) {
      const who = document.querySelector('.msgr-head-who');
      if (who) who.focus({ preventScroll: true });
    }
  }

  const chat = () => (V && hasTG() ? (TG.chats().find(c => c.key === V.key) || null) : null);

  function go(view) { V.stack.push(V.view); V.view = view; V.sheet = null; paint(0); }
  function back() {
    if (!V) return;
    if (V.sheet) { V.sheet = null; paint(); return; }
    if (V.stack.length) { V.view = V.stack.pop(); paint(0); return; }
    close();
  }

  /* ── Rendering ──────────────────────────────────────────────────── */
  function paint(scroll) {
    const el = $('ci');
    const c = chat();
    if (!el) return;
    if (!c) { close(true); return; }
    const body = el.querySelector('.ci-body');
    const keep = scroll === undefined && body ? body.scrollTop : (scroll || 0);

    const titles = { main: 'Details', search: 'Search in chat', people: 'People', add: 'Add people', newgroup: 'New group' };
    const views = { main: mainHTML, search: searchHTML, people: peopleHTML, add: addHTML, newgroup: newGroupHTML };

    el.innerHTML = `
      <header class="ci-top">
        <button type="button" class="icon-btn ci-back" data-ci="back" aria-label="Back">${ico('arrow_back')}</button>
        <h2 class="ci-title">${titles[V.view] || 'Details'}</h2>
      </header>
      <div class="ci-body">${(views[V.view] || mainHTML)(c)}</div>
      ${V.sheet ? sheetHTML(c) : ''}`;

    const nb = el.querySelector('.ci-body');
    if (nb) nb.scrollTop = keep;
    const f = el.querySelector('[data-autofocus]');
    if (f) { f.focus({ preventScroll: true }); if (f.value && f.setSelectionRange) f.setSelectionRange(f.value.length, f.value.length); }
  }

  function avatarHTML(c, cls) {
    const pic = photoOf(c.key);
    const inner = pic ? '' : (c.icon ? ico(c.icon) : esc(initials(c.name)));
    const style = `background:${esc(c.color || '#78909C')}${pic ? `;background-image:url('${pic}')` : ''}`;
    return `<div class="${cls}${pic ? ' has-pic' : ''}" style="${style}">${inner}</div>`;
  }

  function subline(c, k, acct) {
    switch (k) {
      case 'person': {
        const bits = [];
        if (acct) bits.push(esc(acct.handle));
        bits.push(c.online ? '<span class="ci-on">Active now</span>' : 'Offline');
        return bits.join(' · ');
      }
      case 'bot': return 'Bot';
      case 'group': { const n = membersOf(c.key).length + 1; return `Group · ${n} ${n === 1 ? 'person' : 'people'}`; }
      case 'channel': return 'Channel';
      case 'com': return `Community · ${c.com.members.toLocaleString()} members · ${c.com.online.toLocaleString()} online`;
      case 'saved': return 'Only you can see this';
      default: return '';
    }
  }

  function actionsFor(c, k, acct) {
    const muted = hasTG() && TG.isMuted(c.key);
    const mute = ['mute', muted ? 'notifications_off' : 'notifications', muted ? 'Unmute' : 'Mute'];
    const search = ['search', 'search', 'Search'];
    const opts = ['options', 'more_horiz', 'Options'];
    switch (k) {
      case 'person': return [acct ? ['profile', 'person', 'Profile'] : null, search, mute, opts].filter(Boolean);
      case 'group': return [['add', 'person_add', 'Add'], search, mute, opts];
      case 'com': return [['community', 'hub', 'Community'], search, mute, opts];
      case 'saved': return [search];
      default: return [search, mute, opts];
    }
  }

  function row(icon, label, value, act, o) {
    o = o || {};
    return `<button type="button" class="ci-row${o.danger ? ' danger' : ''}" data-ci="${act}">
      <span class="ci-row-ic${o.swatch ? ' swatch' : ''}"${o.swatch ? ` style="background:${o.swatch}"` : ''}>${o.swatch ? '' : ico(icon)}</span>
      <span class="ci-row-t"><span class="ci-row-l">${esc(label)}</span>${o.sub ? `<span class="ci-row-s">${esc(o.sub)}</span>` : ''}</span>
      ${value ? `<span class="ci-row-v">${esc(value)}</span>` : ''}
      ${o.noChevron ? '' : ico('chevron_right', 'ci-chev')}
    </button>`;
  }

  function mainHTML(c) {
    const k = kindOf(c);
    const acct = account(c);
    const nick = nickOf(c.key);
    const acts = actionsFor(c, k, acct);
    const blocked = k === 'person' && isBlocked(c);

    return `
      <div class="ci-hero">
        <div class="ci-av-wrap">
          ${editable(c)
            ? `<button type="button" class="ci-av-btn" data-ci="sheet:rename" aria-label="Change group photo">${avatarHTML(c, 'ci-av')}<span class="ci-av-cam">${ico('photo_camera')}</span></button>`
            : avatarHTML(c, 'ci-av')}
          ${(k === 'person' || k === 'bot') && c.online ? '<span class="ci-dot" aria-hidden="true"></span>' : ''}
        </div>
        <h2 class="ci-name">${esc(nick || c.name)}</h2>
        ${nick ? `<div class="ci-real">${esc(c.name)}</div>` : ''}
        <div class="ci-sub">${subline(c, k, acct)}</div>
        ${editable(c) ? `<button type="button" class="ci-link" data-ci="sheet:rename">Change name and photo</button>` : ''}
      </div>

      <div class="ci-acts" role="group" aria-label="Chat actions">
        ${acts.map(([a, i, l]) => `<button type="button" class="ci-act" data-ci="${a}">
          <span class="ci-act-ic">${ico(i)}</span><span class="ci-act-l">${l}</span></button>`).join('')}
      </div>

      ${blocked ? `<div class="ci-banner">${ico('block')}
        <div><b>You blocked ${esc(first(c.name))}.</b> You can't send each other messages here.</div>
        <button type="button" class="btn btn-ghost btn-sm" data-ci="unblock">Unblock</button></div>` : ''}

      ${cryptoHTML(c, k, acct)}
      ${settingsHTML(c, k, acct)}
      ${sharedHTML(c, k)}`;
  }

  /* ── Crypto ─────────────────────────────────────────────────────── */
  function fiList(c) {
    const id = chatId(c);
    if (id == null || typeof CFI === 'undefined' || !CFI.state) return [];
    return (CFI.state.msgs[id] || []).slice();
  }

  function fiText(fi) {
    const q = v => (Number(v) || 0).toLocaleString('en-US', { maximumFractionDigits: 8 });
    switch (fi.kind) {
      case 'send':    return `${fi.me ? 'You sent' : 'You received'} ${q(fi.qty)} ${fi.coin}`;
      case 'request': return `${fi.me ? 'You requested' : 'Requested'} ${q(fi.qty)} ${fi.coin}`;
      case 'gift':    return `Gift packet · ${q(fi.qty)} ${fi.coin}`;
      case 'split':   return `Split bill · ${usd(fi.total)}`;
      case 'price':   return `${fi.coin} price card`;
      case 'alert':   return `Alert on ${fi.coin}`;
      default:
        if (window.WAD && WAD.previewOf && /^wad/.test(fi.kind || '')) return WAD.previewOf(fi);
        if (window.PAY && PAY.previewOf) return PAY.previewOf(fi);
        return 'Crypto message';
    }
  }
  const fiIcon = k => ({ send: 'north_east', request: 'request_quote', payreq: 'request_quote', payok: 'check_circle',
    gift: 'featured_seasonal_and_gifts', split: 'call_split', price: 'monitoring', alert: 'notifications_active',
    wadaddr: 'account_balance_wallet', wadask: 'add_link', wadsend: 'link' }[k] || 'currency_bitcoin');
  /* Cards that move or ask for money - not price cards, alerts or
     address swaps. */
  const MONEY = ['send', 'request', 'gift', 'split', 'payreq', 'payok', 'wadsend'];

  function tiles(list) {
    return `<div class="ci-tiles">${list.map(([a, i, l]) =>
      `<button type="button" class="ci-tile" data-ci="${a}"><span class="ci-tile-ic">${ico(i)}</span><span>${l}</span></button>`).join('')}</div>`;
  }

  function recentHTML(c) {
    const list = fiList(c).slice(-3).reverse();
    if (!list.length) return '';
    return `<div class="ci-sub-h">Recent</div>
      <div class="ci-mini">${list.map(fi => `
        <button type="button" class="ci-mini-row" data-ci="jump:${esc(fi.id)}">
          <span class="ci-mini-ic">${ico(fiIcon(fi.kind))}</span>
          <span class="ci-mini-t">${esc(fiText(fi))}</span>
          <span class="ci-mini-v">${esc(timeOf(fi.ts))}</span>
        </button>`).join('')}</div>`;
  }

  function cryptoHTML(c, k, acct) {
    if (k === 'person') {
      if (isBlocked(c)) return '';
      const list = fiList(c);
      const sent = list.filter(f => f.kind === 'send' && f.me).reduce((s, f) => s + (Number(f.value) || 0), 0);
      const pays = list.filter(f => MONEY.indexOf(f.kind) > -1).length;
      const addrs = (window.WAD && WAD.peerList) ? WAD.peerList(chatId(c)) : [];
      const nets = (window.WAD && WAD.NETS) || {};
      return `
        <section class="ci-sec">
          <div class="ci-sec-h"><h3>Crypto with ${esc(first(c.name))}</h3><span class="ci-chip">Paper account</span></div>
          <div class="ci-card">
            ${tiles([['cfi:send', 'north_east', 'Send'], ['cfi:request', 'request_quote', 'Request'],
                     ['cfi:price', 'monitoring', 'Share price'], ['cfi:alert', 'notifications_active', 'Price alert']])}
            <div class="ci-stats">
              <div><b>${usd(sent)}</b><span>Sent in this chat</span></div>
              <div><b>${pays}</b><span>${pays === 1 ? 'Payment' : 'Payments'}</span></div>
            </div>
            ${acct && acct.tag ? `
              <div class="ci-kv">
                <div><span class="ci-kv-l">Trending Tag</span><span class="ci-kv-v">${esc(acct.tag)}</span>
                  <span class="ci-kv-s">For paying inside Trending. It is not a blockchain address.</span></div>
                <button type="button" class="icon-btn" data-ci="copytag" aria-label="Copy Trending Tag">${ico('content_copy')}</button>
              </div>` : ''}
            <div class="ci-sub-h">Wallet addresses</div>
            ${addrs.length ? `<div class="ci-mini">${addrs.map(p => `
              <button type="button" class="ci-mini-row" data-ci="copyaddr:${esc(p.id)}" title="Copy address">
                <span class="ci-mini-ic" style="color:${esc((nets[p.net] || {}).color || 'inherit')}">${ico('account_balance_wallet')}</span>
                <span class="ci-mini-t">${esc(p.label || (nets[p.net] || {}).label || p.net)}<small>${esc((nets[p.net] || {}).label || p.net)} · ${esc(short(p.address))}</small></span>
                ${ico('content_copy', 'ci-mini-v')}
              </button>`).join('')}</div>`
            : `<p class="ci-empty">No address saved for ${esc(first(c.name))}. One appears here when they share it in this chat.</p>
               <button type="button" class="btn btn-ghost btn-sm ci-ask" data-ci="askaddr">${ico('add_link')}Ask for an address</button>`}
            ${recentHTML(c)}
          </div>
        </section>`;
    }

    if (k === 'group') {
      const n = fiList(c).length;
      return `
        <section class="ci-sec">
          <div class="ci-sec-h"><h3>Crypto in this group</h3><span class="ci-chip">Paper account</span></div>
          <div class="ci-card">
            ${tiles([['cfi:split', 'call_split', 'Split bill'], ['cfi:gift', 'featured_seasonal_and_gifts', 'Gift packet'],
                     ['cfi:send', 'north_east', 'Send'], ['cfi:price', 'monitoring', 'Share price']])}
            ${n ? recentHTML(c) : '<p class="ci-empty">Split a bill or drop a gift packet and it shows up here.</p>'}
          </div>
        </section>`;
    }

    if (k === 'com' && typeof CH !== 'undefined' && c.com && c.com.token) {
      const t = c.com.token;
      const held = CH.tokenBal ? CH.tokenBal(t.sym) : 0;
      return `
        <section class="ci-sec">
          <div class="ci-sec-h"><h3>Community token</h3><span class="ci-chip">Paper account</span></div>
          <div class="ci-card">
            <div class="ci-stats">
              <div><b>${esc(t.sym)} ${usd(t.price)}</b><span>Price</span></div>
              <div><b>${Number(held || 0).toLocaleString()}</b><span>You hold</span></div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm ci-ask" data-ci="community">${ico('hub')}Trade on the community hub</button>
          </div>
        </section>`;
    }
    return '';
  }

  /* ── Settings list ──────────────────────────────────────────────── */
  function settingsHTML(c, k, acct) {
    const t = themeOf(c.key);
    const vv = vanishOf(c.key);
    const vLabel = (VANISH.find(x => x[0] === vv) || VANISH[0])[1];
    const swatch = t.a ? `linear-gradient(135deg, ${t.a}, ${t.b})` : 'var(--g-brand)';
    const theme = row('palette', 'Theme', t.name, 'sheet:theme', { swatch });
    const vanish = row('timer', 'Disappearing messages', vLabel, 'sheet:vanish');
    const invite = row('link', 'Invite link', '', 'invite', { sub: 'Copy a link to this chat' });
    const rows = [];

    if (k === 'person') {
      rows.push(theme, vanish,
        row('badge', 'Nickname', nickOf(c.key) || 'Add', 'sheet:nick'),
        row('shield_person', 'Privacy & safety', isBlocked(c) ? 'Blocked' : isRestricted(c) ? 'Restricted' : '', 'sheet:privacy'),
        row('group_add', `Create a group with ${first(c.name)}`, '', 'newgroup'));
    } else if (k === 'bot') {
      rows.push(theme, vanish);
    } else if (k === 'group') {
      const n = membersOf(c.key).length + 1;
      rows.push(theme, vanish, invite,
        row('group', 'People', String(n), 'people'),
        row('group_add', 'Create a new group', '', 'newgroup'));
    } else if (k === 'channel') {
      rows.push(theme, invite);
    } else if (k === 'com') {
      rows.push(theme, vanish, invite,
        row('group', 'People', c.com.members.toLocaleString(), 'community'));
    } else {
      rows.push(theme);
    }
    return `<section class="ci-sec"><div class="ci-list">${rows.join('')}</div></section>`;
  }

  /* ── What was shared ────────────────────────────────────────────── */
  const LINK = /(https?:\/\/[^\s<]+|\b[a-z0-9-]+\.(?:com|app|io|org|net|xyz|dev|me)\b[^\s<]*)/i;
  const MEDIA = /^(📷|📄|📍|🎥|🎤)/u;

  function msgs() {
    if (!hasTG() || !TG.messages) return [];
    return TG.messages().filter(m => !gone(V ? V.key : '', m));
  }

  function sharedHTML(c) {
    const all = msgs().filter(m => !m.fi);
    const media = all.filter(m => MEDIA.test(String(m.text || '')));
    const links = all.filter(m => LINK.test(String(m.text || '')));
    const tab = V.tab === 'links' ? 'links' : 'media';
    const list = tab === 'links' ? links : media;
    const icon = t => /^📄/u.test(t) ? 'description' : /^📍/u.test(t) ? 'location_on' : /^🎥/u.test(t) ? 'movie' : /^🎤/u.test(t) ? 'mic' : 'image';

    return `
      <section class="ci-sec">
        <div class="ci-tabs" role="tablist">
          <button type="button" role="tab" class="ci-tab${tab === 'media' ? ' on' : ''}" aria-selected="${tab === 'media'}" data-ci="tab:media">${ico('perm_media')}Media & files <em>${media.length}</em></button>
          <button type="button" role="tab" class="ci-tab${tab === 'links' ? ' on' : ''}" aria-selected="${tab === 'links'}" data-ci="tab:links">${ico('link')}Links <em>${links.length}</em></button>
        </div>
        ${list.length ? `<div class="ci-mini">${list.slice().reverse().map(m => {
          const txt = String(m.text || '');
          const shown = tab === 'links' ? (txt.match(LINK) || [txt])[0] : txt.replace(MEDIA, '').trim() || 'Attachment';
          return `<button type="button" class="ci-mini-row" data-ci="jump:${esc(m.id)}">
            <span class="ci-mini-ic">${ico(tab === 'links' ? 'link' : icon(txt))}</span>
            <span class="ci-mini-t">${esc(shown)}<small>${m.me ? 'You' : esc(m.name)} · ${esc(timeOf(m.ts))}</small></span>
          </button>`; }).join('')}</div>`
        : `<p class="ci-empty ci-empty-c">${tab === 'links' ? 'Links shared in this chat show up here.' : 'Photos, files and places shared in this chat show up here.'}</p>`}
      </section>`;
  }

  /* ── Search ─────────────────────────────────────────────────────── */
  function searchHTML() {
    const q = V.q.trim().toLowerCase();
    const hits = q ? msgs().filter(m => !m.fi && String(m.text || '').toLowerCase().includes(q)) : [];
    const mark = t => {
      const s = String(t), i = s.toLowerCase().indexOf(q);
      if (i < 0) return esc(s);
      const from = Math.max(0, i - 40);
      return (from ? '…' : '') + esc(s.slice(from, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length, i + q.length + 80));
    };
    return `
      <div class="ci-search">
        ${ico('search')}
        <input type="search" id="ci-q" data-autofocus placeholder="Search this chat" aria-label="Search this chat" value="${esc(V.q)}" autocomplete="off" enterkeyhint="search">
      </div>
      ${!q ? '<p class="ci-empty ci-empty-c">Type a word to find it in this conversation.</p>'
        : hits.length ? `<div class="ci-hits-n">${hits.length} ${hits.length === 1 ? 'message' : 'messages'}</div>
          <div class="ci-mini">${hits.slice().reverse().map(m => `
            <button type="button" class="ci-mini-row" data-ci="jump:${esc(m.id)}">
              <span class="ci-mini-t">${mark(m.text)}<small>${m.me ? 'You' : esc(m.name)} · ${esc(timeOf(m.ts))}</small></span>
            </button>`).join('')}</div>`
        : `<p class="ci-empty ci-empty-c">No messages match “${esc(V.q.trim())}”.</p>`}`;
  }

  /* ── People ─────────────────────────────────────────────────────── */
  function personRow(u, o) {
    o = o || {};
    const dm = dmFor(u.name);
    return `<div class="ci-person">
      <div class="ci-p-av" style="background:${esc(o.color || '#78909C')}">${esc(initials(u.name))}${u.online ? '<i></i>' : ''}</div>
      <div class="ci-p-t"><b>${esc(u.name)}</b><span>${esc(u.handle || '')}${o.note ? ' · ' + esc(o.note) : ''}</span></div>
      ${o.me ? '' : `<div class="ci-p-acts">
        ${dm ? `<button type="button" class="btn btn-ghost btn-sm" data-ci="dm:${esc(dm.id)}">Message</button>` : ''}
        ${o.removable ? `<button type="button" class="icon-btn" data-ci="remove:${esc(u.handle)}" aria-label="Remove ${esc(u.name)}">${ico('person_remove')}</button>` : ''}
      </div>`}
    </div>`;
  }

  function me() {
    const u = (typeof S !== 'undefined' && S.user) || {};
    return { name: [u.fname, u.lname].filter(Boolean).join(' ') || 'You', handle: u.handle || '' };
  }

  function peopleHTML(c) {
    const hs = membersOf(c.key);
    const mine = ownGroup(c.key);
    return `
      <button type="button" class="ci-row" data-ci="add">
        <span class="ci-row-ic">${ico('person_add')}</span><span class="ci-row-t"><span class="ci-row-l">Add people</span></span>${ico('chevron_right', 'ci-chev')}
      </button>
      <div class="ci-sub-h">${hs.length + 1} in this group</div>
      ${personRow(me(), { me: true, note: mine ? 'You · Admin' : 'You' })}
      ${hs.map(h => byHandle(h) || { name: h, handle: h }).map(u => personRow(u, { removable: mine })).join('')}`;
  }

  function pickerHTML(exclude) {
    const list = people().filter(u => exclude.map(x => x.toLowerCase()).indexOf(String(u.handle).toLowerCase()) < 0);
    if (!list.length) return '<p class="ci-empty ci-empty-c">Everyone you know is already here.</p>';
    return `<div class="ci-pick">${list.map(u => {
      const on = V.pick.indexOf(u.handle) > -1;
      return `<label class="ci-pick-row">
        <div class="ci-p-av">${esc(initials(u.name))}</div>
        <div class="ci-p-t"><b>${esc(u.name)}</b><span>${esc(u.handle)}</span></div>
        <input type="checkbox" data-pick="${esc(u.handle)}"${on ? ' checked' : ''}>
      </label>`; }).join('')}</div>`;
  }

  function addHTML(c) {
    const n = V.pick.length;
    return `${pickerHTML(membersOf(c.key))}
      <div class="ci-foot"><button type="button" class="btn btn-primary" data-ci="doadd"${n ? '' : ' disabled'}>${n ? `Add ${n}` : 'Pick people to add'}</button></div>`;
  }

  function newGroupHTML(c) {
    const n = V.pick.length;
    return `
      <label class="ci-field"><span>Group name</span>
        <input type="text" id="ci-gname" maxlength="48" placeholder="${esc(kindOf(c) === 'person' ? first(c.name) + ' and you' : 'Name your group')}" value="${esc(V.draft.gname || '')}" data-autofocus></label>
      <div class="ci-sub-h">People</div>
      ${pickerHTML([])}
      <div class="ci-foot"><button type="button" class="btn btn-primary" data-ci="docreate"${n ? '' : ' disabled'}>${n ? `Create group with ${n}` : 'Pick at least one person'}</button></div>`;
  }

  /* ── Sheets ─────────────────────────────────────────────────────── */
  function sheetHTML(c) {
    const k = kindOf(c);
    const s = V.sheet;
    let title = '', body = '';

    if (s === 'theme') {
      const cur = themeOf(c.key).id;
      title = 'Theme';
      body = `<p class="ci-note">Colours your messages and tints this chat. Only you see it.</p>
        <div class="ci-themes">${THEMES.map(t => `
          <button type="button" class="ci-theme${t.id === cur ? ' on' : ''}" data-ci="theme:${t.id}" aria-pressed="${t.id === cur}">
            <span class="ci-theme-sw" style="background:${t.a ? `linear-gradient(135deg, ${t.a}, ${t.b})` : 'var(--g-brand)'}">${t.id === cur ? ico('check') : ''}</span>
            <span>${t.name}</span></button>`).join('')}</div>`;
    } else if (s === 'vanish') {
      const cur = vanishOf(c.key);
      title = 'Disappearing messages';
      body = `<p class="ci-note">New messages disappear this long after they are sent. Messages from before you turn it on stay.</p>
        <div class="ci-radios">${VANISH.map(([v, l]) => `
          <button type="button" class="ci-radio${v === cur ? ' on' : ''}" data-ci="vanish:${v}" role="radio" aria-checked="${v === cur}">
            <span>${l}</span><i></i></button>`).join('')}</div>
        <p class="ci-note">Payments and requests never disappear — they are a record of money. Everything here happens on this device.</p>`;
    } else if (s === 'nick') {
      title = 'Nickname';
      body = `<p class="ci-note">Only you see this name, at the top of this chat.</p>
        <label class="ci-field"><span>Nickname for ${esc(c.name)}</span>
          <input type="text" id="ci-nick" maxlength="32" value="${esc(nickOf(c.key))}" placeholder="${esc(first(c.name))}" data-autofocus></label>
        <div class="ci-sheet-acts">
          ${nickOf(c.key) ? '<button type="button" class="btn btn-ghost" data-ci="nickclear">Remove</button>' : ''}
          <button type="button" class="btn btn-primary" data-ci="nicksave">Save</button></div>`;
    } else if (s === 'rename') {
      const pic = V.draft.photo !== undefined ? V.draft.photo : photoOf(c.key);
      title = 'Name and photo';
      body = `
        <div class="ci-rename-av">
          <div class="ci-av${pic ? ' has-pic' : ''}" style="background:${esc(c.color || '#78909C')}${pic ? `;background-image:url('${pic}')` : ''}">${pic ? '' : esc(initials(V.draft.gname || c.name))}</div>
          <div class="ci-rename-b">
            <label class="btn btn-ghost btn-sm">${ico('photo_camera')}${pic ? 'Change photo' : 'Choose photo'}
              <input type="file" accept="image/*" id="ci-photo" hidden></label>
            ${pic ? '<button type="button" class="btn btn-ghost btn-sm" data-ci="photoclear">Remove</button>' : ''}
          </div>
        </div>
        <label class="ci-field"><span>Group name</span>
          <input type="text" id="ci-gname2" maxlength="48" value="${esc(V.draft.gname !== undefined ? V.draft.gname : c.name)}" data-autofocus></label>
        <p class="ci-note">The photo stays on this device.</p>
        <div class="ci-sheet-acts"><button type="button" class="btn btn-primary" data-ci="renamesave">Save</button></div>`;
    } else if (s === 'privacy') {
      const b = isBlocked(c), r = isRestricted(c);
      title = 'Privacy & safety';
      body = `<div class="ci-list">
          ${row('person_off', r ? 'Unrestrict' : 'Restrict', '', r ? 'unrestrict' : 'restrict',
            { sub: r ? 'Their messages are in Requests' : 'Their messages go to Requests. They aren’t told.', noChevron: true })}
          ${row('block', b ? 'Unblock' : 'Block', '', b ? 'unblock' : 'block',
            { sub: b ? 'You can message each other again' : 'You won’t be able to message each other here', danger: !b, noChevron: true })}
          ${row('forum', 'Who can message you', '', 'set:msgprivacy')}
          ${row('do_not_disturb_on', 'Blocked accounts', '', 'set:blocked')}
        </div>`;
    } else if (s === 'options') {
      const archived = hasTG() && TG.isArchived(c.key);
      const rows = [row(archived ? 'unarchive' : 'archive', archived ? 'Unarchive chat' : 'Archive chat', '', 'archive', { noChevron: true })];
      const acct = account(c);
      if (k === 'person' && acct) rows.push(row('alternate_email', 'Copy username', '', 'copyhandle', { noChevron: true }));
      if (k === 'group' || k === 'com' || k === 'channel') rows.push(row('link', 'Copy invite link', '', 'invite', { noChevron: true }));
      if (k === 'com') rows.push(row('hub', 'Open in Community', '', 'community', { noChevron: true }));
      if (k === 'group' || k === 'channel') rows.push(row('logout', k === 'group' ? 'Leave group' : 'Leave channel', '', 'leave', { danger: true, noChevron: true }));
      title = 'Options';
      body = `<div class="ci-list">${rows.join('')}</div>`;
    }

    return `<div class="ci-scrim" data-ci="sheetclose"></div>
      <div class="ci-sheet" role="dialog" aria-label="${esc(title)}">
        <div class="ci-sheet-h"><h3>${esc(title)}</h3>
          <button type="button" class="icon-btn" data-ci="sheetclose" aria-label="Close">${ico('close')}</button></div>
        <div class="ci-sheet-b">${body}</div>
      </div>`;
  }

  /* ── Actions ────────────────────────────────────────────────────── */
  function copy(text, done) {
    const ok = () => toast(done);
    const fail = () => toast('Couldn’t copy — ' + text);
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, fail);
    else fail();
  }

  /* Leave the details page and jump to one message in the thread. */
  function jump(id) {
    close(true);
    requestAnimationFrame(() => {
      const host = $('chat-messages');
      const el = host && host.querySelector(`[data-mid="${CSS.escape(String(id))}"]`);
      if (!el) { toast('That message is no longer in the chat.'); return; }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('ci-flash');
      setTimeout(() => el.classList.remove('ci-flash'), 1800);
    });
  }

  function crypto(kind) {
    close(true);
    if (typeof openChatCrypto === 'function') openChatCrypto(kind);
  }

  function settings(screen) {
    const run = () => { if (window.SET && SET.open) SET.open(screen); };
    if (window.SET) run();
    else if (globalThis.__lazy && globalThis.__lazy.ensurePane) globalThis.__lazy.ensurePane('settings').then(run, () => toast('Settings did not load. Try again.'));
  }

  function setList(list, on, c) {
    const a = account(c), tp = TP_();
    if (!a || !tp) return;
    if (on) tp.listAdd(list, a.handle, { name: a.name });
    else tp.listRemove(list, a.handle);
  }

  function leave(c) {
    const k = kindOf(c);
    ask(`Leave ${c.name}?`, { ok: 'Leave', danger: true }).then(yes => {
      if (!yes) return;
      const key = c.key;
      if (D.left.indexOf(key) < 0) D.left.push(key);
      D.groups = D.groups.filter(g => 'c:' + g.id !== key);
      delete D.members[key];
      save();
      sync();
      close(true);
      if (hasTG()) { TG.state.activeKey = null; TG.setFolder(TG.state.folder); TG.paintAll(); }
      if (typeof msgrBack === 'function') msgrBack();
      toast(`You left ${c.name}`);
    });
  }

  function createGroup(c) {
    const inp = $('ci-gname');
    const name = (inp && inp.value.trim()) || (kindOf(c) === 'person' ? `${first(c.name)} and you` : 'New group');
    const handles = V.pick.slice();
    if (!handles.length) return;
    const id = Date.now();
    const g = { id, name, emoji: '👥', type: 'groups', preview: 'You created this group', time: 'now', online: false };
    D.groups.unshift(g);
    D.members['c:' + id] = handles;
    save();
    sync();
    close(true);
    if (hasTG()) { TG.paintList(); TG.open('c:' + id); }
    toast(`Created ${name}`);
  }

  function onClick(e) {
    const b = e.target.closest('[data-ci]');
    if (!b || !V) return;
    const [act, arg] = String(b.dataset.ci).split(/:(.*)/s);
    const c = chat();
    if (!c) { close(true); return; }
    const acct = account(c);

    switch (act) {
      case 'back': return back();
      case 'sheet': V.sheet = arg; V.draft = {}; return paint();
      case 'sheetclose': V.sheet = null; return paint();
      case 'tab': V.tab = arg; return paint();

      case 'profile':
        if (!acct) return;
        if (window.PG && PG.openUser) PG.openUser(acct.handle, acct.name);
        else if (window.SF && SF.openCreatorPage) SF.openCreatorPage(acct.handle, acct.name);
        return;
      case 'search': V.q = ''; return go('search');
      case 'mute': if (hasTG()) TG.toggleMute(c.key); return paint();
      case 'options': V.sheet = 'options'; return paint();
      case 'add': V.pick = []; return go('add');
      case 'people': return go('people');
      case 'community': close(true); if (typeof navigateTo === 'function') navigateTo('community'); return;
      case 'newgroup':
        V.pick = kindOf(c) === 'person' && acct ? [acct.handle] : [];
        V.draft = {};
        return go('newgroup');

      case 'cfi': return crypto(arg);
      case 'copytag': if (acct && acct.tag) copy(acct.tag, 'Trending Tag copied'); return;
      case 'copyaddr': {
        const p = (window.WAD ? WAD.peerList(chatId(c)) : []).find(x => x.id === arg);
        if (p) copy(p.address, 'Address copied — check it on your wallet before sending');
        return;
      }
      case 'askaddr': {
        if (!window.WAD || !WAD.askForAddress) return;
        const r = WAD.askForAddress(chatId(c), 'ethereum');
        close(true);
        toast(r && r.msg ? r.msg : 'Asked for an address');
        return;
      }
      case 'jump': return jump(arg);

      case 'theme':
        if (arg === 'classic') delete D.theme[c.key]; else D.theme[c.key] = arg;
        save(); dress(c);
        V.sheet = null; paint();
        return toast(`Theme: ${themeOf(c.key).name}`);
      case 'vanish': {
        const ttl = parseInt(arg, 10) || 0;
        setVanish(c.key, ttl);
        V.sheet = null; paint();
        if (hasTG()) TG.paintThread();
        return toast(ttl ? `New messages disappear after ${(VANISH.find(x => x[0] === ttl) || [0, ''])[1]}` : 'Disappearing messages off');
      }
      case 'nicksave': {
        const v = ($('ci-nick') || {}).value;
        const n = String(v || '').trim().slice(0, 32);
        if (n) D.nick[c.key] = n; else delete D.nick[c.key];
        save(); V.sheet = null;
        if (hasTG()) TG.paintAll();
        return paint();
      }
      case 'nickclear': delete D.nick[c.key]; save(); V.sheet = null; if (hasTG()) TG.paintAll(); return paint();

      case 'photoclear': V.draft.photo = ''; return paint();
      case 'renamesave': {
        const inp = $('ci-gname2');
        const n = String(inp ? inp.value : '').trim().slice(0, 48);
        if (!n) return toast('Give the group a name.');
        D.name[c.key] = n;
        if (V.draft.photo !== undefined) { if (V.draft.photo) D.photo[c.key] = V.draft.photo; else delete D.photo[c.key]; }
        const g = D.groups.find(x => 'c:' + x.id === c.key);
        if (g) g.name = n;
        save(); sync();
        V.sheet = null; V.draft = {};
        if (hasTG()) TG.paintAll();
        paint();
        return toast('Group updated');
      }

      case 'restrict': setList('restricted', true, c); V.sheet = null; paint(); if (hasTG()) TG.paintList();
        return toast(`${first(c.name)} is restricted. Their chat is in Requests now.`);
      case 'unrestrict': setList('restricted', false, c); V.sheet = null; paint(); if (hasTG()) TG.paintList();
        return toast(`${first(c.name)} is no longer restricted`);
      case 'block':
        return ask(`Block ${c.name}? You won’t be able to message each other here.`, { ok: 'Block', danger: true }).then(yes => {
          if (!yes || !V) return;
          setList('blocked', true, c); V.sheet = null; paint();
          toast(`Blocked ${c.name}`);
        });
      case 'unblock': setList('blocked', false, c); V.sheet = null; paint(); return toast(`Unblocked ${c.name}`);
      case 'set': return settings(arg);

      case 'archive': {
        const was = hasTG() && TG.isArchived(c.key);
        if (!hasTG()) return;
        if (!was) { close(true); TG.toggleArchive(c.key); if (typeof msgrBack === 'function') msgrBack(); return; }
        TG.toggleArchive(c.key); V.sheet = null; return paint();
      }
      case 'copyhandle': if (acct) copy(acct.handle, 'Username copied'); V.sheet = null; return paint();
      case 'invite': if (hasTG()) TG.inviteLink(); V.sheet = null; return paint();
      case 'leave': V.sheet = null; paint(); return leave(c);

      case 'dm': close(true); if (hasTG()) TG.open('c:' + arg); return;
      case 'remove': {
        const u = byHandle(arg) || { name: arg };
        return ask(`Remove ${u.name} from ${c.name}?`, { ok: 'Remove', danger: true }).then(yes => {
          if (!yes || !V) return;
          D.members[c.key] = membersOf(c.key).filter(h => h.toLowerCase() !== String(arg).toLowerCase());
          save(); paint();
          toast(`Removed ${u.name}`);
        });
      }
      case 'doadd': {
        if (!V.pick.length) return;
        const n = V.pick.length;
        D.members[c.key] = membersOf(c.key).concat(V.pick.filter(h => membersOf(c.key).indexOf(h) < 0));
        save();
        V.pick = [];
        back();
        return toast(`Added ${n} ${n === 1 ? 'person' : 'people'}`);
      }
      case 'docreate': return createGroup(c);
    }
  }

  function onInput(e) {
    if (!V) return;
    if (e.target.id === 'ci-q') {
      V.q = e.target.value;
      const pos = e.target.selectionStart;
      paint();
      const f = $('ci-q');
      if (f) { f.focus(); try { f.setSelectionRange(pos, pos); } catch (x) {} }
    } else if (e.target.id === 'ci-gname') {
      V.draft.gname = e.target.value;
    }
  }

  function onChange(e) {
    if (!V) return;
    const t = e.target;
    if (t.dataset && t.dataset.pick !== undefined) {
      const h = t.dataset.pick;
      V.pick = t.checked ? V.pick.concat(h) : V.pick.filter(x => x !== h);
      const g = $('ci-gname');
      if (g) V.draft.gname = g.value;
      paint();
    } else if (t.id === 'ci-photo' && t.files && t.files[0]) {
      const g = $('ci-gname2');
      if (g) V.draft.gname = g.value;
      shrink(t.files[0]).then(url => { if (V) { V.draft.photo = url; paint(); } },
        () => toast('That picture could not be read. Try another one.'));
    }
  }

  /* A group photo is kept small: a 192px square, centre-cropped, so a
     handful of them fit easily in this device's storage. */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) { reject(new Error('not an image')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const S = 192, s = Math.min(img.naturalWidth, img.naturalHeight);
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        cv.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, S, S);
        URL.revokeObjectURL(url);
        try { resolve(cv.toDataURL('image/jpeg', 0.82)); } catch (err) { reject(err); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }

  /* The header's timer button opens the same choice as the details page. */
  function openVanish() {
    open();
    if (V) { V.sheet = 'vanish'; paint(); }
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !V || !$('ci')) return;
    e.stopPropagation();
    back();
  }, true);

  return {
    open, close, back, openVanish,
    sync, dress, gone, canSend, inRequests, headerName, photoOf,
    THEMES,
    get state() { return D; }
  };
})();

window.CI = CI;

import { publish } from '../globals.js?v=3';
publish('features/chatinfo.js', { CI: () => CI });
