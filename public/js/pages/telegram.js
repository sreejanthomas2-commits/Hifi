/* ╔══════════════════════════════════════════════════════════════════╗
   ║  TELEGRAM LAYER — one messenger for chats and communities        ║
   ║                                                                  ║
   ║  Merges the Community rooms into the Messages pane so there is   ║
   ║  a single chat list holding DMs, groups, channels, bots and      ║
   ║  community rooms — the way Telegram keeps everything in one      ║
   ║  place. The Community pane keeps discovery, governance, the      ║
   ║  Asset Lab and the Launchpad; only the *rooms* move here.        ║
   ║                                                                  ║
   ║  Community history is read straight out of CH's own store, so a  ║
   ║  message sent here shows up there and vice versa — one          ║
   ║  conversation with two doors, not two copies.                    ║
   ║                                                                  ║
   ║  Feature layer on top of any chat: replies, reactions, pins,     ║
   ║  edit, delete, forward, mute, archive, drafts, read ticks,       ║
   ║  in-chat search, invite links and Saved Messages.                ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const TG = (() => {

  const KEY = 'ts_telegram';

  const REACTIONS = ['👍', '❤️', '🔥', '😂', '🎉', '👀'];

  const FOLDERS = [
    ['all',       'All',         'forum'],
    ['chats',     'Chats',       'person'],
    ['groups',    'Groups',      'group'],
    ['channels',  'Channels',    'campaign'],
    ['bots',      'Bots',        'smart_toy'],
    ['coms',      'Communities', 'hub'],
    ['archived',  'Archived',    'archive']
  ];

  const DEFAULT = {
    reactions: {}, pinned: {}, edits: {}, deleted: [], drafts: {},
    muted: [], archived: [], read: {}, saved: [], folder: 'all',
    activeKey: null, activeTopic: 'general', replyTo: null,
    editing: null, search: '', forwarding: null
  };

  let T = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) {} }

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const hasCH = () => typeof CH !== 'undefined';

  const AV_COLORS = ['#78909C', '#5C6BC0', '#26A69A', '#EF5350', '#AB47BC', '#FF7043', '#42A5F5'];
  const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hashColor = s => AV_COLORS[Math.abs(String(s).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AV_COLORS.length];
  const timeOf = ts => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  /* ── Unified chat registry ───────────────────────────────────────── */
  /* Every conversation gets a stable key so features attach to it no
     matter which source it came from. */
  const KEYS = { convo: id => 'c:' + id, com: cid => 'com:' + cid, saved: 'saved' };

  function convoChats() {
    const list = (typeof DATA !== 'undefined' && Array.isArray(DATA.conversations)) ? DATA.conversations : [];
    return list.map(c => ({
      key: KEYS.convo(c.id), kind: c.type || 'chats', name: c.name,
      preview: c.preview || '', time: c.time || '', unread: c.unread || 0,
      online: !!c.online, color: hashColor(c.id), src: 'convo', raw: c
    }));
  }

  /* A community you've joined behaves like a Telegram group with topics. */
  function comChats() {
    if (!hasCH()) return [];
    return CH.state.joined.map(cid => {
      const c = CH.byId(cid);
      if (!c) return null;
      const msgs = lastComMessage(cid);
      return {
        key: KEYS.com(cid), kind: 'coms', name: c.name,
        preview: msgs ? `${msgs.name}: ${msgs.text}` : c.desc,
        time: msgs ? timeOf(msgs.ts) : '', unread: 0, online: true,
        color: c.color, src: 'com', com: c, icon: c.icon
      };
    }).filter(Boolean);
  }

  function lastComMessage(cid) {
    if (!hasCH()) return null;
    let latest = null;
    Object.keys(CH.state.msgs).forEach(k => {
      if (!k.startsWith(cid + ':')) return;
      const arr = CH.state.msgs[k];
      const m = arr[arr.length - 1];
      if (m && (!latest || m.ts > latest.ts)) latest = m;
    });
    return latest;
  }

  const savedChat = () => ({
    key: KEYS.saved, kind: 'chats', name: 'Saved Messages', preview:
      T.saved.length ? T.saved[T.saved.length - 1].text : 'Forward anything here to keep it',
    time: T.saved.length ? timeOf(T.saved[T.saved.length - 1].ts) : '',
    unread: 0, online: false, color: '#42A5F5', src: 'saved', icon: 'bookmark'
  });

  function chats() { return [savedChat(), ...comChats(), ...convoChats()]; }

  function chatByKey(key) { return chats().find(c => c.key === key); }
  const activeChat = () => chatByKey(T.activeKey);

  const isMuted = k => T.muted.includes(k);
  const isArchived = k => T.archived.includes(k);

  /* ── Filtering ───────────────────────────────────────────────────── */
  function visibleChats() {
    const q = (T.search || '').toLowerCase();
    return chats().filter(c => {
      const archived = isArchived(c.key);
      // Requests: messages from people you don't follow wait here first.
      if (T.folder === 'requests') return !archived && !!(c.raw && c.raw.request) && (!q || c.name.toLowerCase().includes(q));
      if (c.raw && c.raw.request) return false;
      if (T.folder === 'archived') { if (!archived) return false; }
      else if (archived) return false;

      if (T.folder !== 'all' && T.folder !== 'archived' && c.kind !== T.folder) return false;
      if (q && !c.name.toLowerCase().includes(q) && !String(c.preview).toLowerCase().includes(q)) return false;
      return true;
    });
  }

  /* ── Message access ──────────────────────────────────────────────── */
  /* Normalises the three stores into one view model so the feature layer
     doesn't care where a message lives. */
  function messages() {
    const c = activeChat();
    if (!c) return [];

    if (c.src === 'saved') {
      return T.saved.map(m => ({ ...m, me: true, name: 'You' }));
    }

    if (c.src === 'com') {
      if (!hasCH()) return [];
      CH.setActive(c.com.id, T.activeTopic);        // ensures the topic seeds
      const arr = CH.state.msgs[c.com.id + ':' + T.activeTopic] || [];
      return arr.map(m => ({ id: m.id, name: m.name, role: m.role, text: m.text, me: !!m.me, ts: m.ts }));
    }

    const hist = (typeof DATA !== 'undefined' && DATA.chatHistory) ? (DATA.chatHistory[c.raw.id] || []) : [];
    return hist.map((m, i) => ({
      id: m.fi ? m.fi.id : 'h' + i, name: m.me ? 'You' : c.name,
      text: m.text, me: !!m.me, fi: m.fi,
      ts: m.ts || (Date.now() - (hist.length - i) * 60000)
    }));
  }

  const msgKey = id => T.activeKey + '|' + id;
  const isDeleted = id => T.deleted.includes(msgKey(id));
  const textOf = m => T.edits[msgKey(m.id)] !== undefined ? T.edits[msgKey(m.id)] : m.text;

  /* ── Feature actions ─────────────────────────────────────────────── */
  function react(id, emoji) {
    const k = msgKey(id);
    T.reactions[k] = T.reactions[k] || {};
    const list = T.reactions[k][emoji] || [];
    // One reaction per person per emoji — tapping again takes it back.
    if (list.includes('You')) {
      T.reactions[k][emoji] = list.filter(n => n !== 'You');
      if (!T.reactions[k][emoji].length) delete T.reactions[k][emoji];
    } else {
      T.reactions[k][emoji] = list.concat('You');
    }
    save(); paintThread();
  }

  function setReply(id) {
    T.replyTo = id;
    T.editing = null;
    save(); paintThread();
    const el = document.getElementById('chat-input');
    if (el) el.focus();
  }
  function clearReply() { T.replyTo = null; save(); paintThread(); }

  function pin(id) {
    const cur = T.pinned[T.activeKey];
    T.pinned[T.activeKey] = (cur === id) ? null : id;
    save(); paintThread();
    toast(T.pinned[T.activeKey] ? 'Pinned to this chat' : 'Unpinned');
  }

  function startEdit(id) {
    const m = messages().find(x => String(x.id) === String(id));
    if (!m || !m.me) return;
    T.editing = id;
    T.replyTo = null;
    save();
    const el = document.getElementById('chat-input');
    if (el) { el.value = textOf(m); el.focus(); }
    paintThread();
  }

  function commitEdit(text) {
    if (!T.editing) return false;
    T.edits[msgKey(T.editing)] = text;
    T.editing = null;
    save(); paintThread();
    toast('Message edited');
    return true;
  }
  function cancelEdit() {
    T.editing = null;
    const el = document.getElementById('chat-input');
    if (el) el.value = '';
    save(); paintThread();
  }

  function del(id) {
    T.deleted.push(msgKey(id));
    if (T.pinned[T.activeKey] === id) T.pinned[T.activeKey] = null;
    save(); paintThread();
    toast('Message deleted');
  }

  /* ── Forwarding ──────────────────────────────────────────────────── */
  function openForward(id) {
    const m = messages().find(x => String(x.id) === String(id));
    if (!m) return;
    T.forwarding = { text: textOf(m), from: m.name };
    save();
    renderForwardModal();
  }

  function renderForwardModal() {
    closeForward(true);
    if (!T.forwarding) return;
    const scrim = document.createElement('div');
    scrim.id = 'tg-scrim';
    scrim.className = 'sf-scrim open';
    scrim.onclick = () => closeForward();
    document.body.appendChild(scrim);

    const box = document.createElement('div');
    box.id = 'tg-forward';
    box.className = 'tg-forward';
    box.innerHTML = `
      <div class="tg-fwd-head">
        <div><div class="sf-kicker">FORWARD TO</div><h3 class="sf-title">Pick a chat</h3></div>
        <button class="icon-btn" onclick="TG.closeForward()"><span class="material-symbols-rounded ms-18">close</span></button>
      </div>
      <div class="tg-fwd-quote">${esc(T.forwarding.text).slice(0, 160)}</div>
      <div class="tg-fwd-list">
        ${chats().filter(c => c.key !== T.activeKey).map(c => `
          <button class="tg-fwd-item" onclick="TG.doForward('${c.key}')">
            <span class="tg-av" style="background:${c.color}">${esc(initials(c.name))}</span>
            <span>${esc(c.name)}</span>
          </button>`).join('')}
      </div>`;
    document.body.appendChild(box);
  }

  function closeForward(silent) {
    ['tg-scrim', 'tg-forward'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
    if (!silent) { T.forwarding = null; save(); }
  }

  function doForward(key) {
    const f = T.forwarding;
    if (!f) return;
    const target = chatByKey(key);
    if (!target) return;
    const body = `↪ ${f.text}`;

    if (target.src === 'saved') {
      T.saved.push({ id: 's' + Date.now(), text: body, ts: Date.now() });
    } else if (target.src === 'com' && hasCH()) {
      const k = target.com.id + ':general';
      CH.state.msgs[k] = CH.state.msgs[k] || [];
      CH.state.msgs[k].push({ id: 'm' + Date.now(), name: 'You', role: 'Member', text: body, me: true, ts: Date.now() });
      CH.persist();
    } else if (typeof DATA !== 'undefined') {
      DATA.chatHistory = DATA.chatHistory || {};
      DATA.chatHistory[target.raw.id] = DATA.chatHistory[target.raw.id] || [];
      DATA.chatHistory[target.raw.id].push({ me: true, text: body, time: timeOf(Date.now()), ts: Date.now() });
      if (target.raw) { target.raw.preview = body; target.raw.time = 'now'; }
    }
    T.forwarding = null;
    save(); closeForward(true);
    toast(`Forwarded to ${target.name}`);
    paintList();
  }

  /* ── Saved Messages ──────────────────────────────────────────────── */
  function saveMessage(id) {
    const m = messages().find(x => String(x.id) === String(id));
    if (!m) return;
    T.saved.push({ id: 's' + Date.now(), text: textOf(m), ts: Date.now() });
    save(); paintList();
    toast('Saved');
  }

  /* ── Chat-level actions ──────────────────────────────────────────── */
  function toggleMute(key) {
    const k = key || T.activeKey;
    T.muted = isMuted(k) ? T.muted.filter(x => x !== k) : T.muted.concat(k);
    save(); paintAll();
    toast(isMuted(k) ? 'Muted' : 'Unmuted');
  }

  function toggleArchive(key) {
    const k = key || T.activeKey;
    const was = isArchived(k);
    T.archived = was ? T.archived.filter(x => x !== k) : T.archived.concat(k);
    if (!was && T.activeKey === k) T.activeKey = null;
    save(); paintAll();
    toast(was ? 'Unarchived' : 'Archived');
  }

  function inviteLink() {
    const c = activeChat();
    if (!c) return;
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const link = `https://trending.app/join/${slug}`;
    if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {});
    toast(`Invite link copied — ${link}`);
  }

  /* ── Read state ──────────────────────────────────────────────────── */
  function markRead(key) { T.read[key] = Date.now(); save(); }
  const ticks = m => (m.me
    ? `<span class="tg-ticks${T.read[T.activeKey] ? ' read' : ''}">${T.read[T.activeKey] ? '✓✓' : '✓'}</span>`
    : '');

  /* ── Drafts ──────────────────────────────────────────────────────── */
  function saveDraft(text) {
    if (!T.activeKey) return;
    if (text) T.drafts[T.activeKey] = text; else delete T.drafts[T.activeKey];
    save();
  }
  const draftFor = k => T.drafts[k] || '';

  /* ── Navigation ──────────────────────────────────────────────────── */
  function setFolder(f) { T.folder = f; save(); paintList(); }
  function setSearch(v) { T.search = v || ''; save(); paintList(); }

  function open(key) {
    const c = chatByKey(key);
    if (!c) return;
    // Stash whatever was half-typed before switching away.
    const inp = document.getElementById('chat-input');
    if (inp && T.activeKey) saveDraft(inp.value);

    T.activeKey = key;
    T.replyTo = null;
    T.editing = null;
    if (c.src === 'com') T.activeTopic = 'general';
    if (c.src === 'convo' && c.raw) c.raw.unread = 0;
    markRead(key);
    save();
    paintAll();

    if (inp) inp.value = draftFor(key);
    const root = document.getElementById('msgr-root');
    if (root) root.classList.add('show-chat');
    scrollDown();
  }

  function setTopic(t) {
    const c = activeChat();
    if (!c || c.src !== 'com' || !hasCH()) return;
    const topic = CH.topicsFor(c.com).find(x => x.id === t);
    if (topic && topic.locked) {
      toast(`${topic.name} needs ${topic.gate} ${c.com.token.sym} — earn it from bounties.`);
      return;
    }
    T.activeTopic = t;
    save(); paintThread(); scrollDown();
  }

  function scrollDown() {
    setTimeout(() => {
      const el = document.getElementById('chat-messages');
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }

  /* ── Sending ─────────────────────────────────────────────────────── */
  function send(preset) {
    const inp = document.getElementById('chat-input');
    const text = (preset !== undefined ? preset : (inp ? inp.value : '')).trim();
    if (!text) return;
    const c = activeChat();
    if (!c) { toast('Pick a conversation first.'); return; }

    if (T.editing) { if (inp) inp.value = ''; commitEdit(text); return; }

    // Slash commands belong to the crypto layer, not the transcript.
    if (typeof CFI !== 'undefined' && c.src === 'convo' && CFI.handleSlash(text, c.raw.id)) {
      if (inp && preset === undefined) inp.value = '';
      saveDraft('');
      return;
    }

    if (c.kind === 'channels') { toast('This is a channel — only admins can post.'); return; }
    if (c.src === 'com' && hasCH()) {
      const topic = CH.topicsFor(c.com).find(x => x.id === T.activeTopic);
      if (topic && topic.readOnly) { toast('Announcements is read-only — post in General.'); return; }
    }

    const replyTo = T.replyTo;
    const quoted = replyTo ? messages().find(m => String(m.id) === String(replyTo)) : null;
    const body = quoted ? `↩ ${quoted.name}: ${String(textOf(quoted)).slice(0, 60)}\n${text}` : text;

    if (c.src === 'saved') {
      T.saved.push({ id: 's' + Date.now(), text: body, ts: Date.now() });
    } else if (c.src === 'com' && hasCH()) {
      CH.postMessage(c.com.id, T.activeTopic, body);
    } else if (typeof DATA !== 'undefined') {
      DATA.chatHistory = DATA.chatHistory || {};
      DATA.chatHistory[c.raw.id] = DATA.chatHistory[c.raw.id] || [];
      DATA.chatHistory[c.raw.id].push({ me: true, text: body, time: timeOf(Date.now()), ts: Date.now() });
      c.raw.preview = text; c.raw.time = 'now';
      if (typeof replyBack === 'function') replyBack();
    }

    T.replyTo = null;
    if (inp && preset === undefined) inp.value = '';
    saveDraft('');
    save(); paintAll(); scrollDown();
  }

  /* ── Rendering ───────────────────────────────────────────────────── */
  function foldersHTML() {
    return FOLDERS.map(([k, l, i]) => {
      const n = k === 'archived' ? T.archived.length
        : chats().filter(c => !isArchived(c.key) && (k === 'all' || c.kind === k)).length;
      return `<button class="tg-folder${T.folder === k ? ' active' : ''}" onclick="TG.setFolder('${k}')" title="${l}">
        <span class="material-symbols-rounded ms-16">${i}</span>
        <span>${l}</span>${n ? `<i>${n}</i>` : ''}
      </button>`;
    }).join('');
  }

  function paintList() {
    const folders = document.getElementById('tg-folders');
    if (folders) folders.innerHTML = foldersHTML();

    const host = document.getElementById('chat-list');
    if (!host) return;
    const list = visibleChats();

    const req = T.folder === 'requests';
    const secT = document.getElementById('msgr-sec-t');
    if (secT) secT.textContent = req ? 'Message requests' : 'Messages';
    const reqBtn = document.getElementById('msgr-req-btn');
    if (reqBtn) {
      const n = chats().filter(c => c.raw && c.raw.request && !isArchived(c.key)).length;
      reqBtn.textContent = req ? 'Back to messages' : (n ? `Requests (${n})` : 'Requests');
    }

    if (!list.length) {
      host.innerHTML = req
        ? `<div class="msgr-empty tc-3 fs12">No message requests.<br>When someone you don't follow messages you, it waits here until you accept.</div>`
        : T.search
          ? `<div class="msgr-empty tc-3 fs12">No chats match “${esc(T.search)}”.<br><button type="button" class="btn btn-ghost btn-sm mt8" onclick="askAlina(document.getElementById('msgr-search-input').value)"><span class="material-symbols-rounded ms-16">auto_awesome</span> Ask ALINA</button></div>`
          : `<div class="msgr-empty tc-3 fs12">No conversations here.</div>`;
      if (typeof updateUnreadBadge === 'function') updateUnreadBadge();
      return;
    }

    host.innerHTML = list.map(c => {
      const draft = draftFor(c.key);
      const preview = draft ? `<span class="tg-draft">Draft:</span> ${esc(draft)}` : esc(c.preview);
      return `<div class="msgr-convo${c.key === T.activeKey ? ' active' : ''}${c.unread ? ' unread' : ''}"
                   onclick="TG.open('${c.key}')">
        <div class="msgr-av" style="background:${c.color}">
          ${c.icon ? `<span class="material-symbols-rounded ms-18">${c.icon}</span>` : esc(initials(c.name))}
          ${c.online ? '<span class="msgr-dot"></span>' : ''}
        </div>
        <div class="msgr-convo-main">
          <div class="msgr-convo-top">
            <div class="msgr-name">${esc(c.name)}
              ${isMuted(c.key) ? '<span class="material-symbols-rounded tg-mute">notifications_off</span>' : ''}</div>
            <div class="msgr-time">${esc(c.time)}</div>
          </div>
          <div class="msgr-convo-bottom">
            <div class="msgr-preview">${preview}</div>
            ${c.unread ? `<span class="msgr-badge">${c.unread}</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    if (typeof updateUnreadBadge === 'function') updateUnreadBadge();
  }

  function paintHeader() {
    const c = activeChat();
    if (!c) return;
    const av = document.getElementById('chat-header-av');
    if (av) {
      av.innerHTML = c.icon ? `<span class="material-symbols-rounded ms-20">${c.icon}</span>` : esc(initials(c.name));
      av.style.background = c.color;
    }
    const n = document.getElementById('chat-header-name');
    if (n) n.textContent = c.name;
    const s = document.getElementById('chat-header-status');
    if (s) {
      s.textContent = c.src === 'com'
        ? `${c.com.members.toLocaleString()} members · ${c.com.online.toLocaleString()} online`
        : (c.online ? 'Online' : 'Offline');
    }
  }

  /* The community strip and topic rail only exist for community rooms. */
  function comExtrasHTML(c) {
    if (c.src !== 'com' || !hasCH()) return '';
    const topics = CH.topicsFor(c.com);
    const bal = CH.tokenBal(c.com.token.sym);
    return `
      <div class="tg-com-strip">
        <span><b>${esc(c.com.token.sym)}</b> $${c.com.token.price.toFixed(2)}</span>
        <span>You hold <b>${bal.toLocaleString()}</b></span>
        <button class="btn btn-ghost btn-sm" onclick="navigateTo('community')">Community hub</button>
      </div>
      <div class="tg-topics">
        ${topics.map(t => `
          <button class="tg-topic${t.id === T.activeTopic ? ' active' : ''}${t.locked ? ' locked' : ''}"
                  onclick="TG.setTopic('${t.id}')">
            <span class="material-symbols-rounded ms-16">${t.locked ? 'lock' : t.icon}</span>${esc(t.name)}
          </button>`).join('')}
      </div>`;
  }

  function paintThread() {
    const host = document.getElementById('chat-messages');
    if (!host) return;
    const c = activeChat();
    if (!c) { host.innerHTML = `<div class="msgr-empty tc-3 fs12">Pick a conversation.</div>`; return; }

    const all = messages().filter(m => !isDeleted(m.id));
    const q = (T.search || '').toLowerCase();
    const pinnedId = T.pinned[T.activeKey];
    const pinned = pinnedId ? all.find(m => String(m.id) === String(pinnedId)) : null;

    const extras = comExtrasHTML(c);
    const pinBar = pinned ? `
      <div class="tg-pinned">
        <span class="material-symbols-rounded ms-16">push_pin</span>
        <div><b>Pinned</b> ${esc(String(textOf(pinned)).slice(0, 90))}</div>
        <button class="icon-btn" onclick="TG.pin('${pinned.id}')"><span class="material-symbols-rounded ms-16">close</span></button>
      </div>` : '';

    if (!all.length) {
      host.innerHTML = extras + pinBar + `<div class="msgr-empty tc-3 fs12">No messages yet — say hello.</div>`;
      return;
    }

    const rows = all.map(m => {
      const txt = textOf(m);
      const edited = T.edits[msgKey(m.id)] !== undefined;
      const rk = T.reactions[msgKey(m.id)] || {};
      const chips = Object.keys(rk).filter(e => rk[e].length).map(e =>
        `<button class="tg-react${rk[e].includes('You') ? ' mine' : ''}" onclick="TG.react('${m.id}','${e}')">${e} ${rk[e].length}</button>`).join('');

      if (m.fi && typeof CFI !== 'undefined') {
        return `<div class="msgr-row${m.me ? ' me' : ''} msgr-row-fi">${CFI.cardHTML(m.fi)}</div>`;
      }

      const hit = q && String(txt).toLowerCase().includes(q);
      const body = typeof CFI !== 'undefined' ? CFI.linkify(esc(txt)) : esc(txt);

      return `<div class="msgr-row tg-row${m.me ? ' me' : ''}${hit ? ' hit' : ''}">
        <div class="tg-msg-wrap">
          ${c.src === 'com' && !m.me ? `<div class="tg-sender">${esc(m.name)}${
            m.role && m.role !== 'Member' ? `<span class="tg-role">${esc(m.role)}</span>` : ''}</div>` : ''}
          <div class="msgr-bubble">${body}${edited ? '<span class="tg-edited">edited</span>' : ''}
            <span class="tg-meta">${timeOf(m.ts)}${ticks(m)}</span></div>
          ${chips ? `<div class="tg-reacts">${chips}</div>` : ''}
          <div class="tg-actions">
            ${REACTIONS.map(e => `<button onclick="TG.react('${m.id}','${e}')" title="React">${e}</button>`).join('')}
            <button onclick="TG.setReply('${m.id}')" title="Reply"><span class="material-symbols-rounded ms-16">reply</span></button>
            <button onclick="TG.pin('${m.id}')" title="Pin"><span class="material-symbols-rounded ms-16">push_pin</span></button>
            <button onclick="TG.openForward('${m.id}')" title="Forward"><span class="material-symbols-rounded ms-16">forward</span></button>
            <button onclick="TG.saveMessage('${m.id}')" title="Save"><span class="material-symbols-rounded ms-16">bookmark</span></button>
            ${m.me ? `<button onclick="TG.startEdit('${m.id}')" title="Edit"><span class="material-symbols-rounded ms-16">edit</span></button>
                      <button onclick="TG.del('${m.id}')" title="Delete"><span class="material-symbols-rounded ms-16">delete</span></button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    const typing = (typeof S !== 'undefined' && S.peerTyping && c.src === 'convo' && String(S.peerTyping) === String(c.raw.id))
      ? '<div class="msgr-row"><div class="msgr-bubble msgr-typing"><i></i><i></i><i></i></div></div>' : '';

    host.innerHTML = extras + pinBar + `<div class="msgr-day">Today</div>` + rows + typing;

    // The reply/edit banner is part of the thread's state, so it repaints
    // with it — otherwise setReply() would update the list but not the bar.
    paintComposer();
  }

  function paintComposer() {
    const bar = document.getElementById('tg-context');
    if (!bar) return;
    if (T.editing) {
      bar.innerHTML = `<div class="tg-ctx"><span class="material-symbols-rounded ms-16">edit</span>
        <div><b>Editing</b> — press Send to save</div>
        <button class="icon-btn" onclick="TG.cancelEdit()"><span class="material-symbols-rounded ms-16">close</span></button></div>`;
      return;
    }
    if (T.replyTo) {
      const m = messages().find(x => String(x.id) === String(T.replyTo));
      bar.innerHTML = m ? `<div class="tg-ctx"><span class="material-symbols-rounded ms-16">reply</span>
        <div><b>${esc(m.name)}</b> ${esc(String(textOf(m)).slice(0, 70))}</div>
        <button class="icon-btn" onclick="TG.clearReply()"><span class="material-symbols-rounded ms-16">close</span></button></div>` : '';
      return;
    }
    bar.innerHTML = '';
  }

  function paintAll() { paintList(); paintHeader(); paintThread(); }

  /* ── Boot ────────────────────────────────────────────────────────── */
  function setup() {
    if (!document.getElementById('chat-list')) return;
    if (typeof CFI !== 'undefined') { CFI.installBot(); CFI.rehydrate(); }

    const inp = document.getElementById('chat-input');
    if (inp && !inp.dataset.tgWired) {
      inp.dataset.tgWired = '1';
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        if (e.key === 'Escape') { T.replyTo = null; cancelEdit(); }
      });
      inp.addEventListener('input', () => saveDraft(inp.value));
    }
    const btn = document.getElementById('send-msg-btn');
    if (btn && !btn.dataset.tgWired) {
      btn.dataset.tgWired = '1';
      btn.addEventListener('click', () => send());
    }

    if (!T.activeKey || !chatByKey(T.activeKey)) {
      const first = visibleChats()[0];
      T.activeKey = first ? first.key : null;
    }
    save();
    paintAll();
    if (inp) inp.value = draftFor(T.activeKey);

    const root = document.getElementById('msgr-root');
    if (root) root.classList.remove('show-chat');
  }

  return {
    setup, open, send, setFolder, setSearch, setTopic,
    react, setReply, clearReply, pin, startEdit, commitEdit, cancelEdit, del,
    openForward, closeForward, doForward, saveMessage,
    toggleMute, toggleArchive, inviteLink,
    paintAll, paintList, paintThread, chats, visibleChats, activeChat,
    isMuted, isArchived, FOLDERS, REACTIONS,
    get state() { return T; }
  };
})();

window.TG = TG;

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
publish('pages/telegram.js', {
  TG: () => TG
});
