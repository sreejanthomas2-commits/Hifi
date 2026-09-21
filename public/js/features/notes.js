/* ╔══════════════════════════════════════════════════════════════════╗
   ║  TRENDING NOTES (NT)                                              ║
   ║                                                                  ║
   ║  Short, temporary updates shown above your chats in Messages.    ║
   ║  A Note can carry text and emoji, a music clip, a link preview,  ║
   ║  a photo, video or GIF, hashtags, @mentions and $coins, a poll,  ║
   ║  a place name, or a post / Shorty / community it points to.      ║
   ║                                                                  ║
   ║  Layers, top to bottom:                                          ║
   ║   · NOTE_CONFIG — limits and durations in one place              ║
   ║   · stores — Note records apart from reactions, replies, poll    ║
   ║     votes and interactions, so no record grows without bound     ║
   ║   · api — the Promise-based service boundary. It runs on this    ║
   ║     device today; a server adapter can replace it without the    ║
   ║     UI changing                                                  ║
   ║   · visibility — audience, blocks, mutes, hidden and reported    ║
   ║     notes, community membership, age                             ║
   ║   · UI — Notes row, composer, audience picker, viewer, menus,     ║
   ║     insights, settings                                           ║
   ║   · lifetime — expiry sweep, purge, cross-tab sync               ║
   ║                                                                  ║
   ║  Replies go into the DM with the note's owner. Nothing is ever   ║
   ║  public: a Note is only visible to the audience its owner picks. ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const NOTE_CONFIG = Object.freeze({
  maxChars: 60,                                   // grapheme count, so an emoji is one
  durations: [[1, '1 hour'], [6, '6 hours'], [12, '12 hours'], [24, '24 hours']],
  defaultHours: 24,
  customMaxHours: 72,
  purgeAfterMs: 24 * 3600 * 1000,                 // records are removed a day after a note ends
  replyMax: 500,
  poll: { minOptions: 2, maxOptions: 4, questionMax: 60, optionMax: 25 },
  media: {
    imageBytes: 15 * 1024 * 1024, gifBytes: 15 * 1024 * 1024,
    videoBytes: 50 * 1024 * 1024, videoSeconds: 30,
    audioBytes: 15 * 1024 * 1024, clipSeconds: 30,
    thumbPx: 360, thumbQuality: 0.78
  },
  reactions: ['❤️', '😂', '🔥', '😮', '😢', '👏'],
  notifyWindowMs: 60 * 1000,
  linkPreviewEndpoint: '/api/link-preview'
});

const NT = (() => {

  /* ── Helpers ─────────────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const ico = (n, cls) => `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}" aria-hidden="true">${esc(n)}</span>`;
  // Colours can come from user-made communities; only plain colour values reach a style attribute.
  const safeColor = (c, d) => (/^#[0-9a-f]{3,8}$/i.test(String(c || '')) || /^(rgb|hsl)a?\([\d\s.,%]+\)$/i.test(String(c || '')) ? String(c) : (d || '#FCD535'));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const now = () => Date.now();
  const rid = p => `${p}_${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const HOUR = 3600 * 1000;
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const glen = s => (seg ? [...seg.segment(String(s || ''))].length : [...String(s || '')].length);
  const gslice = (s, n) => (seg ? [...seg.segment(String(s || ''))].slice(0, n).map(x => x.segment).join('') : [...String(s || '')].slice(0, n).join(''));

  function ago(ts) {
    const d = Math.max(0, now() - ts);
    if (d < 60000) return 'now';
    if (d < HOUR) return Math.floor(d / 60000) + 'm';
    if (d < 24 * HOUR) return Math.floor(d / HOUR) + 'h';
    return Math.floor(d / (24 * HOUR)) + 'd';
  }
  function left(ts) {
    const d = ts - now();
    if (d <= 0) return 'Expired';
    if (d < HOUR) return Math.max(1, Math.ceil(d / 60000)) + 'm left';
    return Math.ceil(d / HOUR) + 'h left';
  }
  const COLORS = ['#FCD535', '#5C6BC0', '#26A69A', '#EF5350', '#AB47BC', '#FF7043', '#42A5F5', '#EC4899'];
  const colorOf = s => COLORS[Math.abs([...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % COLORS.length];
  const initials = n => String(n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  /* ── Identity ────────────────────────────────────────────────────── */
  function me() {
    const u = (typeof S !== 'undefined' && S.user) || {};
    const guest = !u.uid && u.fname === 'Guest';
    const name = `${u.fname || ''} ${u.lname || ''}`.trim();
    return {
      id: u.uid || 'local-guest', guest,
      name: name || 'You',
      handle: guest ? '@guest' : (u.handle || '@you'),
      photo: window.PME && PME.photo ? PME.photo() : ''
    };
  }

  /* ── People ──────────────────────────────────────────────────────────
     Trending has no server-side social graph yet, so the people you chat
     with carry their relationship to you here: whether they follow you,
     whether you follow them, and whether you are on their Close Friends.
     Visibility rules read only these fields, so a real graph slots in. */
  const PEOPLE = [
    { id: 'u_sarah',  name: 'Sarah Chen',    handle: '@sarahc',      followsYou: true,  youFollow: true,  closeFriendOf: true },
    { id: 'u_marcus', name: 'Marcus Webb',   handle: '@marcusw',     followsYou: true,  youFollow: true,  closeFriendOf: true },
    { id: 'u_zara',   name: 'Zara Ahmed',    handle: '@zaraa',       followsYou: true,  youFollow: true,  closeFriendOf: false },
    { id: 'u_dev',    name: 'Dev Kumar',     handle: '@devk',        followsYou: true,  youFollow: true,  closeFriendOf: false },
    { id: 'u_mia',    name: 'Mia Thompson',  handle: '@miat',        followsYou: true,  youFollow: true,  closeFriendOf: false },
    { id: 'u_luna',   name: 'Luna Park',     handle: '@lunap',       followsYou: false, youFollow: true,  closeFriendOf: false },
    { id: 'u_whale',  name: 'Crypto Whale',  handle: '@whale_alert', followsYou: false, youFollow: true,  closeFriendOf: false },
    { id: 'u_kai',    name: 'Kai Brooks',    handle: '@kaib',        followsYou: true,  youFollow: false, closeFriendOf: false },
    { id: 'u_priya',  name: 'Priya Sharma',  handle: '@priyas',      followsYou: true,  youFollow: false, closeFriendOf: false }
  ].map(p => ({ ...p, color: colorOf(p.handle) }));

  const person = id => (id === me().id ? { ...me(), color: colorOf(me().handle), self: true } : PEOPLE.find(p => p.id === id) || null);
  const personByHandle = h => PEOPLE.find(p => p.handle.toLowerCase() === String(h || '').toLowerCase()) || null;
  const firstName = p => (p ? (p.self ? 'You' : String(p.name).split(/\s+/)[0]) : 'Someone');

  /* ── Stores ──────────────────────────────────────────────────────── */
  const KEYS = {
    notes: 'ts_notes_v1', reactions: 'ts_note_reactions_v1', replies: 'ts_note_replies_v1',
    votes: 'ts_note_votes_v1', interactions: 'ts_note_interactions_v1', prefs: 'ts_note_prefs_v1'
  };
  const PREFS = { closeFriends: ['u_sarah', 'u_marcus'], mutedUsers: [], hiddenNotes: [], reports: [], blocked: [], restricted: [],
                  seen: {}, notify: true, demoActivity: true, lastAudience: 'mutuals', lastHours: 24, seededAt: 0, seededFor: '' };

  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  let DB = {};
  function loadAll() {
    DB = {
      notes: read(KEYS.notes, []), reactions: read(KEYS.reactions, []), replies: read(KEYS.replies, []),
      votes: read(KEYS.votes, []), interactions: read(KEYS.interactions, []),
      prefs: { ...PREFS, ...read(KEYS.prefs, {}) }
    };
  }
  function write(which) {
    const list = which ? [which] : Object.keys(KEYS);
    try { list.forEach(k => localStorage.setItem(KEYS[k], JSON.stringify(DB[k]))); return true; }
    catch (e) { toast('This device is out of storage space, so the note could not be saved.'); return false; }
  }
  loadAll();

  /* ── Media (IndexedDB) ───────────────────────────────────────────── */
  /* Full-size photos, videos, GIFs and audio stay out of localStorage.
     Records keep a small thumbnail; the file loads when a note opens. */
  let dbp = null;
  function idb() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('trending-notes', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('media');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function putMedia(id, blob) {
    const db = await idb();
    return new Promise((res, rej) => { const tx = db.transaction('media', 'readwrite'); tx.objectStore('media').put(blob, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }
  async function getMedia(id) {
    const db = await idb();
    return new Promise((res, rej) => { const r = db.transaction('media').objectStore('media').get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); });
  }
  async function delMedia(id) {
    try {
      const db = await idb();
      await new Promise(res => { const tx = db.transaction('media', 'readwrite'); tx.objectStore('media').delete(id); tx.oncomplete = res; tx.onerror = res; });
    } catch (e) { /* nothing to delete */ }
  }
  const mediaIdOf = url => (String(url || '').indexOf('idb:') === 0 ? String(url).slice(4) : '');

  function loadImage(src) {
    return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; });
  }
  async function thumbFrom(source, w, h) {
    const max = NOTE_CONFIG.media.thumbPx;
    const k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', NOTE_CONFIG.media.thumbQuality);
  }
  async function imageThumb(blob) {
    const url = URL.createObjectURL(blob);
    try { const img = await loadImage(url); return await thumbFrom(img, img.naturalWidth, img.naturalHeight); }
    finally { URL.revokeObjectURL(url); }
  }
  async function shrinkDataUrl(dataUrl) {
    try { const img = await loadImage(dataUrl); return await thumbFrom(img, img.naturalWidth, img.naturalHeight); }
    catch (e) { return null; }
  }
  function videoInfo(blob) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob);
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = url;
      const done = r => { URL.revokeObjectURL(url); resolve(r); };
      v.onerror = () => done(null);
      v.onloadedmetadata = () => { v.currentTime = Math.min(0.2, (v.duration || 1) / 2); };
      v.onseeked = async () => {
        let thumb = null;
        try { thumb = await thumbFrom(v, v.videoWidth || 320, v.videoHeight || 568); } catch (e) {}
        done({ duration: v.duration || 0, thumb });
      };
      setTimeout(() => done(null), 8000);
    });
  }

  /* ── Service boundary ────────────────────────────────────────────── */
  const TAB = rid('tab');
  const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('trending-notes') : null;
  function emit(type, payload) {
    if (bus) { try { bus.postMessage({ type, payload, from: TAB }); } catch (e) {} }
    document.dispatchEvent(new CustomEvent('notes:change', { detail: { type, payload } }));
  }

  const isExpired = n => !n || n.expiresAt <= now();
  const noteById = id => DB.notes.find(n => n.id === id) || null;
  const byNote = (list, id) => DB[list].filter(x => x.noteId === id);

  const api = {
    /* Notes the current viewer may see right now, newest first. */
    visible: () => Promise.resolve(DB.notes.filter(canSee).sort((a, b) => b.createdAt - a.createdAt)),
    get: id => Promise.resolve(noteById(id)),

    create(record) {
      DB.notes.push(record);
      if (!write('notes')) { DB.notes = DB.notes.filter(n => n.id !== record.id); return Promise.reject(new Error('storage')); }
      emit('note:created', { id: record.id, userId: record.userId });
      return Promise.resolve(record);
    },
    update(id, patch) {
      const n = noteById(id);
      if (!n) return Promise.reject(new Error('missing'));
      Object.assign(n, patch, { updatedAt: now() });
      write('notes');
      emit('note:updated', { id });
      return Promise.resolve(n);
    },
    remove(id) {
      const n = noteById(id);
      if (!n) return Promise.resolve();
      purge(n);
      emit('note:deleted', { id });
      return Promise.resolve();
    },

    /* One reaction per person per note: a different emoji replaces it, the same one takes it back. */
    react(id, emoji, userId) {
      const uid = userId || me().id;
      const cur = DB.reactions.find(r => r.noteId === id && r.userId === uid);
      let on = true;
      if (cur && cur.emoji === emoji) { DB.reactions = DB.reactions.filter(r => r !== cur); on = false; }
      else if (cur) { cur.emoji = emoji; cur.createdAt = now(); }
      else DB.reactions.push({ id: rid('nr'), noteId: id, userId: uid, emoji, createdAt: now() });
      write('reactions');
      emit('note:reaction', { id, userId: uid, emoji, on });
      return Promise.resolve(on);
    },
    like(id, userId) {
      const uid = userId || me().id;
      const cur = DB.interactions.find(x => x.noteId === id && x.userId === uid && x.type === 'like');
      if (cur) DB.interactions = DB.interactions.filter(x => x !== cur);
      else DB.interactions.push({ id: rid('ni'), noteId: id, userId: uid, type: 'like', createdAt: now() });
      write('interactions');
      emit('note:like', { id, userId: uid, on: !cur });
      return Promise.resolve(!cur);
    },
    track(id, type) {
      DB.interactions.push({ id: rid('ni'), noteId: id, userId: me().id, type, createdAt: now() });
      write('interactions');
      return Promise.resolve();
    },
    vote(id, optionId, userId) {
      const uid = userId || me().id;
      const cur = DB.votes.find(v => v.noteId === id && v.userId === uid);
      if (cur) { cur.optionId = optionId; cur.createdAt = now(); }
      else DB.votes.push({ id: rid('nv'), noteId: id, userId: uid, optionId, createdAt: now() });
      write('votes');
      emit('note:vote', { id });
      return Promise.resolve();
    },
    reply(id, text, convoId) {
      const rec = { id: rid('np'), noteId: id, userId: me().id, text, convoId, createdAt: now() };
      DB.replies.push(rec);
      write('replies');
      emit('note:reply', { id });
      return Promise.resolve(rec);
    },
    /* Counts only — who viewed or reacted is never listed. */
    insights(id) {
      const n = noteById(id);
      const reactions = {};
      byNote('reactions', id).forEach(r => { reactions[r.emoji] = (reactions[r.emoji] || 0) + 1; });
      const ints = byNote('interactions', id);
      const votes = {};
      byNote('votes', id).forEach(v => { votes[v.optionId] = (votes[v.optionId] || 0) + 1; });
      return Promise.resolve({
        likes: ints.filter(x => x.type === 'like').length,
        linkClicks: ints.filter(x => x.type === 'link_click').length,
        shares: ints.filter(x => x.type === 'share').length,
        reactions, reactionTotal: Object.values(reactions).reduce((a, b) => a + b, 0),
        replies: byNote('replies', id).length,
        votes, voteTotal: Object.values(votes).reduce((a, b) => a + b, 0),
        reach: n ? audienceSize(n) : 0
      });
    }
  };

  /* Removes a note and everything that belongs to it. */
  function purge(n) {
    DB.notes = DB.notes.filter(x => x.id !== n.id);
    ['reactions', 'replies', 'votes', 'interactions'].forEach(k => { DB[k] = DB[k].filter(x => x.noteId !== n.id); });
    [mediaIdOf(n.mediaUrl), n.musicData && n.musicData.mediaId].filter(Boolean).forEach(delMedia);
    write();
  }

  /* ── Visibility ──────────────────────────────────────────────────── */
  const communityMember = cid => !!(cid && typeof CMD !== 'undefined' && CMD.isJoined && CMD.isJoined(cid));
  function myAge() { try { return window.PME && PME.age ? PME.age() : null; } catch (e) { return null; } }

  function canSee(n) {
    if (!n || n.status !== 'active' || isExpired(n)) return false;
    const P = DB.prefs;
    const self = me();
    if (n.userId === self.id) return true;
    const owner = person(n.userId);
    if (!owner) return false;
    if (P.blocked.includes(n.userId) || owner.blocksYou) return false;
    if (P.mutedUsers.includes(n.userId) || P.hiddenNotes.includes(n.id)) return false;
    if (P.reports.some(r => r.noteId === n.id)) return false;
    if (n.sensitive && (myAge() == null || myAge() < 18)) return false;
    switch (n.audienceType) {
      case 'mutuals':       return owner.followsYou && owner.youFollow;
      case 'close_friends': return !!owner.closeFriendOf;
      case 'followers':     return !!owner.youFollow;
      case 'selected':      return (n.selectedAudienceIds || []).some(x => x === self.id || x === 'me');
      case 'community':     return communityMember(n.communityId);
      default:              return false;    // nothing is public unless an audience says so
    }
  }

  /* Who your own note reaches, by the same rules seen from their side. */
  function reachable(n) {
    const P = DB.prefs;
    return PEOPLE.filter(p => {
      if (P.blocked.includes(p.id)) return false;
      switch (n.audienceType) {
        case 'mutuals':       return p.followsYou && p.youFollow;
        case 'close_friends': return P.closeFriends.includes(p.id);
        case 'followers':     return p.followsYou;
        case 'selected':      return (n.selectedAudienceIds || []).includes(p.id);
        default:              return false;
      }
    });
  }
  function audienceSize(n) {
    if (n.audienceType === 'community') {
      const c = typeof CMD !== 'undefined' && CMD.byId ? CMD.byId(n.communityId) : null;
      return c ? Math.max(0, (c.members || 1) - 1) : 0;
    }
    return reachable(n).length;
  }

  const AUDIENCES = [
    ['mutuals', 'Followers you follow back', 'sync_alt', 'Only people you both follow'],
    ['close_friends', 'Close Friends', 'star', 'Only people on your Close Friends list'],
    ['followers', 'Followers', 'group', 'Everyone who follows you'],
    ['selected', 'Selected people', 'person_check', 'Only the people you choose'],
    ['community', 'Community', 'hub', 'Members of one of your communities']
  ];
  const audienceOf = k => AUDIENCES.find(a => a[0] === k) || AUDIENCES[0];
  function audienceLabel(n) {
    if (n.audienceType === 'selected') { const c = (n.selectedAudienceIds || []).length; return `${c} ${c === 1 ? 'person' : 'people'}`; }
    if (n.audienceType === 'community') {
      const c = typeof CMD !== 'undefined' && CMD.byId ? CMD.byId(n.communityId) : null;
      return c ? c.name : 'Community';
    }
    return audienceOf(n.audienceType)[1];
  }

  /* ── Text: hashtags, mentions, $coins and links ──────────────────── */
  const TOKEN = /(https?:\/\/[^\s<>"']+)|(^|[\s(])#([\p{L}\p{N}_]{1,50})|(^|[\s(])@([A-Za-z0-9_.]{2,30})|(^|[\s(])\$([A-Za-z]{2,6})(?![A-Za-z0-9])/gu;
  const trimUrl = u => u.replace(/[.,!?;:)\]]+$/, '');

  function tokensOf(text) {
    const out = { hashtags: [], mentions: [], cashtags: [], urls: [] };
    String(text || '').replace(TOKEN, (m, url, p1, tag, p2, men, p3, coin) => {
      if (url) out.urls.push(trimUrl(url));
      if (tag && !out.hashtags.includes(tag.toLowerCase())) out.hashtags.push(tag.toLowerCase());
      if (men && !out.mentions.includes('@' + men.toLowerCase())) out.mentions.push('@' + men.toLowerCase());
      if (coin && !out.cashtags.includes(coin.toUpperCase())) out.cashtags.push(coin.toUpperCase());
      return m;
    });
    return out;
  }

  /* Escapes everything, then turns tokens into controls. Links open only
     when tapped, in a new tab, without passing this page along. */
  function richHTML(text, noteId) {
    const s = String(text || '');
    let html = '';
    let last = 0;
    TOKEN.lastIndex = 0;
    let m;
    while ((m = TOKEN.exec(s))) {
      const [all, url, p1, tag, p2, men, p3, coin] = m;
      html += esc(s.slice(last, m.index));
      if (url) {
        const clean = trimUrl(url);
        html += `<a class="nt-inl" href="${esc(clean)}" target="_blank" rel="noopener noreferrer" data-nt-link="${esc(noteId || '')}">${esc(clean.replace(/^https?:\/\//, ''))}</a>${esc(url.slice(clean.length))}`;
      } else if (tag) {
        html += `${esc(p1)}<button type="button" class="nt-tok" data-nt="tag" data-v="${esc(tag)}">#${esc(tag)}</button>`;
      } else if (men) {
        html += `${esc(p2)}<button type="button" class="nt-tok" data-nt="mention" data-v="@${esc(men)}">@${esc(men)}</button>`;
      } else if (coin) {
        html += `${esc(p3)}<button type="button" class="nt-tok coin" data-nt="coin" data-v="${esc(coin.toUpperCase())}">$${esc(coin.toUpperCase())}</button>`;
      }
      last = m.index + all.length;
    }
    return html + esc(s.slice(last));
  }

  function normalizeUrl(input) {
    let v = String(input || '').trim();
    if (!v) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
    try {
      const u = new URL(v);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
      if (!u.hostname.includes('.') || u.username || u.password) return '';
      return u.toString();
    } catch (e) { return ''; }
  }

  async function linkPreview(url) {
    const u = new URL(url);
    const fallback = { url, domain: u.hostname.replace(/^www\./, ''), title: u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : ''), description: '', image: null };
    try {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = ctl ? setTimeout(() => ctl.abort(), 7000) : null;
      const r = await fetch(`${NOTE_CONFIG.linkPreviewEndpoint}?url=${encodeURIComponent(url)}`, { headers: { Accept: 'application/json' }, signal: ctl ? ctl.signal : undefined });
      if (t) clearTimeout(t);
      if (!r.ok) return fallback;
      const d = await r.json();
      if (!d || !d.ok) return fallback;
      return {
        url: d.url || url, domain: d.domain || fallback.domain, title: String(d.title || fallback.title).slice(0, 120),
        description: String(d.description || '').slice(0, 200), image: d.image ? await shrinkDataUrl(d.image) : null
      };
    } catch (e) { return fallback; }
  }

  /* ── Moderation ──────────────────────────────────────────────────── */
  /* The same scanner communities use for scams, phishing and pressure
     tactics runs before a note is shared. */
  function moderate(text) {
    if (typeof CPM === 'undefined' || !CPM.aiScan || !String(text || '').trim()) return { ok: true };
    try {
      const r = CPM.aiScan(text);
      if (r.score >= 75) return { ok: false, why: (r.flags || []).map(f => f.label).join(', ') || 'unsafe content' };
      return { ok: true, sensitive: r.score >= 55 };
    } catch (e) { return { ok: true }; }
  }

  /* ── People who have notes today ─────────────────────────────────── */
  function libraryTracks() {
    const cat = typeof SH !== 'undefined' && Array.isArray(SH.CATALOG) ? SH.CATALOG : [];
    const seen = {};
    return cat.map(s => {
      const [title, artist] = String(s.audio || '').split(' · ');
      if (!title || /^original audio$/i.test(title) || seen[title]) return null;
      seen[title] = 1;
      return { title, artist: artist || s.creator || '', src: s.src, source: 'library' };
    }).filter(Boolean);
  }

  function seed() {
    const P = DB.prefs;
    const self = me().id;
    if (P.seededAt && now() - P.seededAt < 20 * HOUR && P.seededFor === self) return;
    DB.notes.filter(n => String(n.userId).indexOf('u_') === 0).forEach(purge);

    const t = now();
    const make = (userId, minsAgo, fields) => {
      const createdAt = t - minsAgo * 60000;
      const text = fields.text || '';
      const tk = tokensOf(text);
      return {
        id: rid('n'), userId, text, contentType: fields.contentType || 'text',
        mediaUrl: '', thumbnailUrl: '', musicData: null, linkData: null, pollData: null, locationData: null,
        attachedContentId: null, attachedContentType: null, attachedContent: null,
        hashtags: tk.hashtags, mentions: tk.mentions, cashtags: tk.cashtags,
        audienceType: 'followers', selectedAudienceIds: [], communityId: null,
        createdAt, updatedAt: createdAt, expiresAt: createdAt + 24 * HOUR, status: 'active', demo: true,
        ...fields
      };
    };
    const tracks = libraryTracks();
    const coms = typeof CMD !== 'undefined' && CMD.all ? CMD.all().filter(c => !c.mine) : [];
    const com = coms[0];

    const notes = [
      make('u_sarah', 24, { text: 'Shipping day 🚀 wish me luck', audienceType: 'close_friends', contentType: 'music',
        musicData: tracks[0] ? { ...tracks[0], clipStart: 0, clipSeconds: NOTE_CONFIG.media.clipSeconds } : { title: 'Ambient Tide', artist: 'Deep Blue', source: 'library', clipStart: 0, clipSeconds: 30 } }),
      make('u_marcus', 70, { text: '5AM run done. Who is in tomorrow? #5amclub', audienceType: 'mutuals' }),
      make('u_zara', 125, { text: '', audienceType: 'followers', contentType: 'poll',
        pollData: { question: 'Best time to post?', options: [{ id: 'a', text: 'Morning ☀️' }, { id: 'b', text: 'Lunch 🍜' }, { id: 'c', text: 'Night 🌙' }] } }),
      make('u_dev', 210, { text: 'Wrote up our realtime stack', audienceType: 'followers', contentType: 'link',
        linkData: { url: 'https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel', domain: 'developer.mozilla.org', title: 'BroadcastChannel - Web APIs | MDN', description: 'Communicate between browsing contexts on the same origin.', image: null } }),
      make('u_whale', 300, { text: '$BTC weekly close is the one to watch 👀 #crypto', audienceType: 'followers' }),
      make('u_mia', 420, { text: 'Made you a playlist 🎧', audienceType: 'selected', selectedAudienceIds: ['me'], contentType: 'text',
        locationData: { name: 'Brooklyn, NY' } }),
      make('u_luna', 540, com
        ? { text: 'Design critique tonight — bring your WIP', audienceType: 'followers', contentType: 'content',
            attachedContentId: com.id, attachedContentType: 'community', attachedContent: { type: 'community', id: com.id, title: com.name, subtitle: `${(com.members || 0).toLocaleString()} members`, icon: com.icon || 'groups', color: com.color || '#FCD535' } }
        : { text: 'Design critique tonight — bring your WIP ✏️', audienceType: 'followers' }),
      // Not visible to you: you don't follow Kai, and you're not on Priya's Close Friends.
      make('u_kai', 90, { text: 'Track PR today 🏃', audienceType: 'followers' }),
      make('u_priya', 150, { text: 'Quiet morning, big plans', audienceType: 'close_friends' })
    ];
    DB.notes.push(...notes);
    const zara = notes[2];
    [['a', 12], ['b', 5], ['c', 9]].forEach(([opt, count]) => {
      for (let i = 0; i < count; i++) DB.votes.push({ id: rid('nv'), noteId: zara.id, userId: `voter_${opt}${i}`, optionId: opt, createdAt: zara.createdAt + i * 60000 });
    });
    P.seededAt = t;
    P.seededFor = self;
    write();
  }

  /* ── Notes row ───────────────────────────────────────────────────── */
  function avatarHTML(p, size) {
    const photo = p && p.self && /^(data:image\/|https:\/\/)/.test(p.photo || '') && p.photo;
    return `<span class="nt-av${size ? ' ' + size : ''}" style="background:${photo ? `url('${esc(photo)}') center / cover` : safeColor(p && p.color)}">${photo ? '' : esc(initials(p ? p.name : '?'))}</span>`;
  }

  function summaryOf(n) {
    if (n.text) return n.text;
    if (n.pollData) return '📊 ' + n.pollData.question;
    if (n.contentType === 'image') return '📷 Photo';
    if (n.contentType === 'gif') return 'GIF';
    if (n.contentType === 'video') return '🎬 Video';
    if (n.linkData) return '🔗 ' + n.linkData.domain;
    if (n.musicData) return '';
    if (n.attachedContent) return '↪ ' + n.attachedContent.title;
    if (n.locationData) return '📍 ' + n.locationData.name;
    return '';
  }

  function bubbleHTML(n, placeholder) {
    if (!n) return `<span class="nt-bubble empty"><span class="nt-bubble-t">${esc(placeholder)}</span></span>`;
    const text = summaryOf(n);
    const thumb = n.thumbnailUrl ? `<img class="nt-bubble-img" src="${esc(n.thumbnailUrl)}" alt="" loading="lazy" decoding="async">` : '';
    const music = n.musicData ? `<span class="nt-bubble-m">${ico('graphic_eq')}<span>${esc(n.musicData.title)}</span></span>` : '';
    return `<span class="nt-bubble">${thumb}${text ? `<span class="nt-bubble-t">${esc(text)}</span>` : ''}${music}</span>`;
  }

  let order = [];
  function paintRow() {
    const host = $('nt-row');
    if (!host) return;
    const self = me();
    const mine = DB.notes.find(n => n.userId === self.id && n.status === 'active' && !isExpired(n));
    const others = DB.notes.filter(n => n.userId !== self.id && canSee(n))
      .sort((a, b) => (!!DB.prefs.seen[a.id] - !!DB.prefs.seen[b.id]) || (b.createdAt - a.createdAt));
    order = [...(mine ? [mine.id] : []), ...others.map(n => n.id)];
    const selfP = person(self.id);

    const yours = `
      <div class="nt-item mine" role="listitem">
        <button type="button" class="nt-card" data-nt="${mine ? 'open' : 'compose'}" data-id="${mine ? mine.id : ''}"
          aria-label="${mine ? `Your note: ${esc(summaryOf(mine) || 'note')}` : 'Add a note'}">
          <span class="nt-avwrap">
            ${bubbleHTML(mine, 'Share what’s trending…')}
            ${avatarHTML(selfP)}
            ${mine ? `<span class="nt-aud" title="${esc(audienceLabel(mine))}">${ico(audienceOf(mine.audienceType)[2])}</span>` : `<span class="nt-add">${ico('add')}</span>`}
          </span>
          <span class="nt-name">Your note</span>
          ${mine ? `<span class="nt-sub">${esc(left(mine.expiresAt))}</span>` : ''}
        </button>
      </div>`;

    const items = others.map(n => {
      const p = person(n.userId);
      const cf = n.audienceType === 'close_friends';
      return `
      <div class="nt-item${DB.prefs.seen[n.id] ? '' : ' unseen'}" role="listitem">
        <button type="button" class="nt-card" data-nt="open" data-id="${n.id}" aria-label="Note from ${esc(p.name)}: ${esc(summaryOf(n) || (n.musicData ? n.musicData.title : 'note'))}">
          <span class="nt-avwrap">
            ${bubbleHTML(n)}
            ${avatarHTML(p)}
            ${cf ? `<span class="nt-aud cf" title="Close Friends">${ico('star')}</span>` : ''}
          </span>
          <span class="nt-name">${esc(p.name)}</span>
        </button>
      </div>`;
    }).join('');

    host.innerHTML = yours + items;
  }

  /* ── Viewer ──────────────────────────────────────────────────────── */
  let VW = null;                  // { id, urls: [] }
  const lastFocus = { el: null };

  function open(id) {
    const n = noteById(id);
    if (!n || (!canSee(n) && n.userId !== me().id)) { toast('This note is no longer available.'); paintRow(); return; }
    closeMenus();
    if (!VW) lastFocus.el = document.activeElement;
    if (n.userId !== me().id && !DB.prefs.seen[n.id]) { DB.prefs.seen[n.id] = now(); write('prefs'); }
    revokeUrls();
    VW = { id, urls: [] };
    renderViewer(true);
  }

  function revokeUrls() {
    if (VW && VW.urls) VW.urls.forEach(u => URL.revokeObjectURL(u));
    stopMusic();
  }

  let closing = null;
  function closeViewer() {
    const el = $('nt-viewer');
    revokeUrls();
    VW = null;
    if (el) {
      if (reduced()) el.remove();
      else {
        el.classList.add('closing');
        el.id = 'nt-viewer-closing';          // a note opened during the fade gets a fresh viewer
        clearTimeout(closing);
        closing = setTimeout(() => { el.remove(); closing = null; }, 160);
      }
    }
    document.removeEventListener('keydown', viewerKey, true);
    paintRow();
    if (lastFocus.el && document.contains(lastFocus.el)) { try { lastFocus.el.focus({ preventScroll: true }); } catch (e) {} }
  }

  function viewerKey(e) {
    if (!VW || $('nt-menu') || $('nt-composer') || document.querySelector('.mob-dialog-scrim')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeViewer(); }
    else if (e.key === 'ArrowRight' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) step(1);
    else if (e.key === 'ArrowLeft' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) step(-1);
  }

  function step(d) {
    if (!VW) return;
    const i = order.indexOf(VW.id);
    const next = order[i + d];
    if (!next) return;
    const box = document.querySelector('#nt-viewer .nt-view');
    if (box && !reduced()) { box.classList.remove('slide-l', 'slide-r'); void box.offsetWidth; box.classList.add(d > 0 ? 'slide-l' : 'slide-r'); }
    open(next);
  }

  function pollHTML(n, own) {
    const P = n.pollData;
    if (!P) return '';
    const votes = byNote('votes', n.id);
    const total = votes.length;
    const mine = votes.find(v => v.userId === me().id);
    const showResults = !!mine || own || isExpired(n);
    return `<div class="nt-poll" role="group" aria-label="Poll: ${esc(P.question)}">
      <b class="nt-poll-q">${esc(P.question)}</b>
      ${P.options.map(o => {
        const c = votes.filter(v => v.optionId === o.id).length;
        const pct = total ? Math.round((c / total) * 100) : 0;
        return showResults
          ? `<button type="button" class="nt-opt res${mine && mine.optionId === o.id ? ' on' : ''}" data-nt="vote" data-v="${esc(o.id)}" ${own || isExpired(n) ? 'disabled' : ''} style="--p:${pct}%">
               <span class="nt-opt-t">${esc(o.text)}${mine && mine.optionId === o.id ? ico('check_circle') : ''}</span><span class="nt-opt-p">${pct}%</span></button>`
          : `<button type="button" class="nt-opt" data-nt="vote" data-v="${esc(o.id)}"><span class="nt-opt-t">${esc(o.text)}</span></button>`;
      }).join('')}
      <span class="nt-poll-n">${total} ${total === 1 ? 'vote' : 'votes'}${mine && !isExpired(n) ? ' · tap another option to change' : ''}</span>
    </div>`;
  }

  function contentCardHTML(c, clickable) {
    if (!c) return '';
    const icon = { post: 'article', short: 'slow_motion_video', community: c.icon || 'groups', community_post: 'forum' }[c.type] || 'link';
    const kind = { post: 'Post', short: 'Shorty', community: 'Community', community_post: 'Community post' }[c.type] || 'Content';
    return `<${clickable ? 'button type="button" data-nt="content"' : 'div'} class="nt-content">
      ${c.thumb ? `<img src="${esc(c.thumb)}" alt="" loading="lazy">` : `<span class="nt-content-ic" style="--c:${safeColor(c.color)}">${ico(icon)}</span>`}
      <span class="nt-content-t"><em>${kind}</em><b>${esc(c.title)}</b>${c.subtitle ? `<span>${esc(c.subtitle)}</span>` : ''}</span>
      ${clickable ? ico('chevron_right') : ''}
    </${clickable ? 'button' : 'div'}>`;
  }

  function linkCardHTML(l, noteId) {
    if (!l) return '';
    const href = normalizeUrl(l.url);
    if (!href) return '';
    return `<a class="nt-linkcard" href="${esc(href)}" target="_blank" rel="noopener noreferrer" data-nt-link="${esc(noteId || '')}">
      ${l.image ? `<img src="${esc(l.image)}" alt="" loading="lazy">` : `<span class="nt-linkcard-ic">${ico('link')}</span>`}
      <span class="nt-linkcard-t"><em>${esc(l.domain)}</em><b>${esc(l.title)}</b>${l.description ? `<span>${esc(l.description)}</span>` : ''}</span>
      ${ico('open_in_new', 'nt-linkcard-go')}
    </a>`;
  }

  function musicHTML(m) {
    if (!m) return '';
    const playable = !!(m.src || m.mediaId);
    return `<div class="nt-music">
      <button type="button" class="nt-music-b" data-nt="music" ${playable ? '' : 'disabled'} aria-label="${playable ? 'Play' : 'Preview unavailable'} ${esc(m.title)}">${ico('play_arrow')}</button>
      <span class="nt-music-t"><b>${esc(m.title)}</b><span>${esc(m.artist || '')}</span></span>
      <span class="nt-eq" aria-hidden="true"><i></i><i></i><i></i></span>
    </div>`;
  }

  function mediaHTML(n) {
    if (!n.mediaUrl) return '';
    const kind = n.contentType === 'video' ? 'video' : 'image';
    return `<div class="nt-media ${kind}" id="nt-media" data-kind="${kind}">
      ${n.thumbnailUrl ? `<img class="nt-media-thumb" src="${esc(n.thumbnailUrl)}" alt="">` : ''}
      <span class="nt-media-load">${ico(kind === 'video' ? 'play_circle' : 'image')}</span>
    </div>`;
  }

  async function hydrateMedia(n) {
    const box = $('nt-media');
    const id = mediaIdOf(n.mediaUrl);
    if (!box || !id) return;
    let blob = null;
    try { blob = await getMedia(id); } catch (e) {}
    if (!VW || VW.id !== n.id || !document.contains(box)) return;
    if (!blob) { box.classList.add('gone'); box.innerHTML = `<span class="nt-media-load">${ico('broken_image')}<em>The file for this note is not on this device.</em></span>`; return; }
    const url = URL.createObjectURL(blob);
    VW.urls.push(url);
    box.innerHTML = n.contentType === 'video'
      ? `<video src="${url}" controls playsinline preload="metadata"${n.thumbnailUrl ? ` poster="${esc(n.thumbnailUrl)}"` : ''}></video>`
      : `<img src="${url}" alt="${n.contentType === 'gif' ? 'GIF' : 'Photo'} in note">`;
  }

  let audio = null;
  function musicUI(playing) {
    document.querySelectorAll('#nt-viewer .nt-music').forEach(box => {
      box.classList.toggle('playing', playing);
      const b = box.querySelector('.nt-music-b');
      if (b) { b.innerHTML = ico(playing ? 'pause' : 'play_arrow'); b.setAttribute('aria-pressed', playing ? 'true' : 'false'); }
    });
  }
  function stopMusic() {
    const a = audio;
    audio = null;
    if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
    musicUI(false);
  }
  async function toggleMusic(n, btn) {
    if (audio) { stopMusic(); return; }
    const m = n.musicData;
    let src = m.src || '';
    if (m.mediaId) {
      try { const b = await getMedia(m.mediaId); if (b) { src = URL.createObjectURL(b); if (VW) VW.urls.push(src); } } catch (e) {}
    }
    if (!src) { toast('This clip is not available on this device.'); return; }
    const a = new Audio(src);
    audio = a;
    a.currentTime = m.clipStart || 0;
    const end = (m.clipStart || 0) + (m.clipSeconds || NOTE_CONFIG.media.clipSeconds);
    a.addEventListener('timeupdate', () => { if (audio === a && a.currentTime >= end) stopMusic(); });
    a.addEventListener('ended', () => { if (audio === a) stopMusic(); });
    a.play().then(() => { if (audio === a) musicUI(true); }).catch(() => { if (audio === a) { toast('Tap play again to hear the clip.'); stopMusic(); } });
  }

  function renderViewer(first) {
    if (!VW) return;
    const n = noteById(VW.id);
    let el = $('nt-viewer');
    if (!n) { if (el) el.remove(); VW = null; return; }
    const p = person(n.userId);
    const own = n.userId === me().id;
    const expired = isExpired(n);
    const i = order.indexOf(n.id);
    const myReact = DB.reactions.find(r => r.noteId === n.id && r.userId === me().id);
    const liked = DB.interactions.some(x => x.noteId === n.id && x.userId === me().id && x.type === 'like');
    const counts = { likes: DB.interactions.filter(x => x.noteId === n.id && x.type === 'like').length, reacts: byNote('reactions', n.id).length, replies: byNote('replies', n.id).length };

    const body = `
      <header class="nt-vh">
        ${avatarHTML(p, 'sm')}
        <span class="nt-vh-t"><b>${esc(own ? 'Your note' : p.name)}</b>
          <span>${esc(own ? me().handle : p.handle)} · ${esc(ago(n.createdAt))}${n.updatedAt - n.createdAt > 60000 ? ' · edited' : ''}${own ? ` · ${ico(audienceOf(n.audienceType)[2])}${esc(audienceLabel(n))}` : ''}</span></span>
        <button type="button" class="nt-ib" data-nt="menu" aria-label="More options" aria-haspopup="dialog">${ico('more_horiz')}</button>
        <button type="button" class="nt-ib" data-nt="close" aria-label="Close">${ico('close')}</button>
      </header>
      ${order.length > 1 ? `<div class="nt-dots" aria-hidden="true">${order.map(id => `<i class="${id === n.id ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      <div class="nt-vbody">
        ${n.text ? `<p class="nt-vtext">${richHTML(n.text, n.id)}</p>` : ''}
        ${mediaHTML(n)}
        ${musicHTML(n.musicData)}
        ${linkCardHTML(n.linkData, n.id)}
        ${pollHTML(n, own)}
        ${n.locationData ? `<span class="nt-loc">${ico('location_on')}${esc(n.locationData.name)}</span>` : ''}
        ${contentCardHTML(n.attachedContent, true)}
        <span class="nt-left">${ico('schedule')}${esc(left(n.expiresAt))}</span>
      </div>
      ${expired ? `<div class="nt-expired">${ico('timer_off')}This note has expired. Reactions and replies are closed.</div>`
      : own ? `
      <div class="nt-own">
        <button type="button" class="nt-stat" data-nt="insights">${ico('favorite')}<b>${counts.likes}</b>${ico('add_reaction')}<b>${counts.reacts}</b>${ico('chat_bubble')}<b>${counts.replies}</b><span>View interactions</span></button>
        <div class="nt-own-a">
          <button type="button" class="nt-btn" data-nt="edit">${ico('edit')}Edit</button>
          <button type="button" class="nt-btn" data-nt="audience">${ico('group')}Audience</button>
          <button type="button" class="nt-btn danger" data-nt="delete">${ico('delete')}Delete</button>
        </div>
      </div>`
      : `
      <div class="nt-foot">
        <div class="nt-reacts" role="group" aria-label="React">
          ${NOTE_CONFIG.reactions.map(e => `<button type="button" class="nt-react${myReact && myReact.emoji === e ? ' on' : ''}" data-nt="react" data-v="${e}" aria-pressed="${!!(myReact && myReact.emoji === e)}" aria-label="React ${e}">${e}</button>`).join('')}
        </div>
        <form class="nt-replyf" data-nt-form="reply">
          <button type="button" class="nt-ib${liked ? ' liked' : ''}" data-nt="like" aria-pressed="${liked}" aria-label="${liked ? 'Unlike' : 'Like'}">${ico('favorite')}</button>
          <input id="nt-reply" type="text" maxlength="${NOTE_CONFIG.replyMax}" placeholder="Reply to this Note…" aria-label="Reply to ${esc(p.name)}'s note" autocomplete="off" enterkeyhint="send">
          <button type="submit" class="nt-ib send" aria-label="Send reply">${ico('send')}</button>
          <button type="button" class="nt-ib" data-nt="share" aria-label="Share">${ico('ios_share')}</button>
        </form>
      </div>`}
      ${i > 0 ? `<button type="button" class="nt-nav prev" data-nt="prev" aria-label="Previous note">${ico('chevron_left')}</button>` : ''}
      ${i > -1 && i < order.length - 1 ? `<button type="button" class="nt-nav next" data-nt="next" aria-label="Next note">${ico('chevron_right')}</button>` : ''}`;

    if (!el) {
      el = document.createElement('div');
      el.id = 'nt-viewer';
      el.className = 'nt-scrim';
      el.innerHTML = `<div class="nt-view" role="dialog" aria-modal="true" aria-label="Note"></div>`;
      el.addEventListener('click', e => { if (e.target === el) closeViewer(); });
      wireSwipe(el);
      document.body.appendChild(el);
      document.addEventListener('keydown', viewerKey, true);
    }
    const box = el.querySelector('.nt-view');
    box.setAttribute('aria-label', own ? 'Your note' : `Note from ${p.name}`);
    const draft = $('nt-reply') ? $('nt-reply').value : '';
    box.innerHTML = body;
    if ($('nt-reply') && draft && !first) $('nt-reply').value = draft;
    hydrateMedia(n);
    if (audio && !audio.paused) musicUI(true);
    if (first) requestAnimationFrame(() => { const f = box.querySelector('[data-nt="close"]'); if (f) f.focus({ preventScroll: true }); });
  }

  function wireSwipe(el) {
    let x0 = null, y0 = 0;
    el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || e.target.closest('input, video, .nt-poll, a, button')) return; x0 = e.clientX; y0 = e.clientY; });
    el.addEventListener('pointerup', e => {
      if (x0 == null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    });
  }

  /* ── Reactions, likes, votes, replies ────────────────────────────── */
  async function react(emoji, btn) {
    const n = noteById(VW && VW.id);
    if (!n || isExpired(n) || n.userId === me().id) return;
    const on = await api.react(n.id, emoji);
    if (on && btn && !reduced()) {
      const f = document.createElement('span');
      f.className = 'nt-float';
      f.textContent = emoji;
      btn.appendChild(f);
      setTimeout(() => f.remove(), 700);
      setTimeout(renderViewer, 260);
    } else renderViewer();
  }

  /* A reply is a DM to the note's owner, quoting the note it answers. */
  async function sendReply(text) {
    const n = noteById(VW && VW.id);
    const body = String(text || '').trim().slice(0, NOTE_CONFIG.replyMax);
    if (!n || !body) return;
    if (isExpired(n)) { toast('This note has expired.'); renderViewer(); return; }
    const owner = person(n.userId);
    if (!owner || owner.self) return;
    const scan = moderate(body);
    if (!scan.ok) { toast(`That reply was blocked: ${scan.why}.`); return; }

    const convo = conversationFor(owner);
    if (!convo) { toast('Messages are unavailable right now.'); return; }
    const quote = gslice(summaryOf(n) || (n.musicData ? '♫ ' + n.musicData.title : 'note'), 50);
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    DATA.chatHistory = DATA.chatHistory || {};
    DATA.chatHistory[convo.id] = DATA.chatHistory[convo.id] || [];
    DATA.chatHistory[convo.id].push({ me: true, text: `↩ Replied to ${firstName(owner)}'s note: “${quote}”\n${body}`, time, ts: now() });
    convo.preview = body;
    convo.time = 'now';
    await api.reply(n.id, body, convo.id);

    closeViewer();
    toast('Reply sent');
    if (typeof navigateTo === 'function' && (typeof S === 'undefined' || S.pane !== 'messages')) navigateTo('messages');
    setTimeout(() => {
      if (typeof TG !== 'undefined') TG.open('c:' + convo.id);
      if (typeof replyBack === 'function') replyBack();
    }, 80);
  }

  function conversationFor(p) {
    if (typeof DATA === 'undefined') return null;
    DATA.conversations = DATA.conversations || [];
    let c = DATA.conversations.find(x => (x.type || 'chats') === 'chats' && x.name === p.name);
    if (!c) {
      const id = Math.max(1000, ...DATA.conversations.map(x => Number(x.id) || 0)) + 1;
      c = { id, name: p.name, emoji: '', type: 'chats', preview: '', unread: 0, online: false, time: 'now' };
      DATA.conversations.unshift(c);
    }
    return c;
  }

  /* Only notes shared with all followers can be passed on; Close Friends
     and hand-picked notes stay with the people they were meant for. */
  function share(n) {
    if (n.audienceType !== 'followers') { toast('Only notes shared with all followers can be shared.'); return; }
    const chats = typeof TG !== 'undefined' ? TG.chats().filter(c => c.src === 'convo' || c.src === 'saved') : [];
    menu(`Share ${firstName(person(n.userId))}'s note`, [
      ...chats.slice(0, 8).map(c => [`share-to:${c.key}`, c.name, c.src === 'saved' ? 'bookmark' : 'send']),
      ['share-copy', 'Copy note text', 'content_copy']
    ]);
  }
  function shareTo(key) {
    const n = noteById(VW && VW.id);
    if (!n || typeof TG === 'undefined') return;
    const target = TG.chats().find(c => c.key === key);
    if (!target) return;
    const owner = person(n.userId);
    const text = `📝 ${owner.name}'s note: “${summaryOf(n) || (n.musicData ? '♫ ' + n.musicData.title : '')}”`;
    if (target.src === 'saved') TG.state.saved.push({ id: 's' + now(), text, ts: now() });
    else {
      DATA.chatHistory[target.raw.id] = DATA.chatHistory[target.raw.id] || [];
      DATA.chatHistory[target.raw.id].push({ me: true, text, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), ts: now() });
      target.raw.preview = text; target.raw.time = 'now';
    }
    api.track(n.id, 'share');
    if (typeof TG.paintList === 'function') TG.paintList();
    toast(`Shared with ${target.name}`);
  }

  /* ── Menus ───────────────────────────────────────────────────────── */
  let menuFrom = null;
  function menu(title, rows, extraHTML) {
    closeMenus();
    menuFrom = document.activeElement;
    const el = document.createElement('div');
    el.id = 'nt-menu';
    el.className = 'nt-scrim sheet';
    el.innerHTML = `<div class="nt-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <span class="nt-grab" aria-hidden="true"></span>
      <h3 class="nt-sheet-h">${esc(title)}</h3>
      ${extraHTML || ''}
      ${rows.map(([k, l, i, cls, sub]) => `<button type="button" class="nt-row-b${cls ? ' ' + cls : ''}" data-nt="${esc(k)}">${ico(i)}<span><b>${esc(l)}</b>${sub ? `<em>${esc(sub)}</em>` : ''}</span></button>`).join('')}
    </div>`;
    el.addEventListener('click', e => { if (e.target === el) closeMenus(); });
    document.body.appendChild(el);
    requestAnimationFrame(() => { const f = el.querySelector('button, input'); if (f) f.focus({ preventScroll: true }); });
    return el;
  }
  function closeMenus() {
    const el = $('nt-menu');
    if (!el) return;
    el.remove();
    if (menuFrom && document.contains(menuFrom)) { try { menuFrom.focus({ preventScroll: true }); } catch (e) {} }
    menuFrom = null;
  }

  function noteMenu() {
    const n = noteById(VW && VW.id);
    if (!n) return;
    if (n.userId === me().id) {
      menu('Your note', [
        ['insights', 'View interactions', 'insights'],
        ['edit', 'Edit note', 'edit'],
        ['replace', 'Replace note', 'autorenew', '', 'Start a new note in its place'],
        ['audience', 'Change audience', 'group', '', audienceLabel(n)],
        ['delete', 'Delete note', 'delete', 'danger']
      ]);
    } else {
      const p = person(n.userId);
      menu(`${p.name}'s note`, [
        ['mute-user', `Mute notes from ${firstName(p)}`, 'notifications_off', '', 'You can unmute them in Notes settings'],
        ['hide', 'Hide this note', 'visibility_off'],
        ['report', 'Report note', 'flag', 'danger'],
        ['profile', 'Go to profile', 'person']
      ]);
    }
  }

  const REPORT_REASONS = ['Spam', 'Scam or fraud', 'Harassment or bullying', 'Hate speech', 'Nudity or sexual content', 'Violence or dangerous acts', 'False information', 'Self-harm or suicide', 'Something else'];
  function reportMenu() {
    const n = noteById(VW && VW.id);
    if (!n) return;
    const p = person(n.userId);
    const el = menu('Why are you reporting this note?', REPORT_REASONS.map((r, i) => [`report-reason:${i}`, r, i === 7 ? 'support' : 'chevron_right']),
      `<label class="nt-check"><input type="checkbox" id="nt-report-block"> Also block ${esc(p.handle)}</label>`);
    el.classList.add('report');
  }
  function submitReport(i) {
    const n = noteById(VW && VW.id);
    if (!n) return;
    const block = $('nt-report-block') && $('nt-report-block').checked;
    DB.prefs.reports.push({ noteId: n.id, userId: n.userId, reason: REPORT_REASONS[i], at: now() });
    if (block && !DB.prefs.blocked.includes(n.userId)) DB.prefs.blocked.push(n.userId);
    write('prefs');
    closeMenus();
    closeViewer();
    const help = i === 7 ? ' If someone is in immediate danger, contact local emergency services.' : '';
    toast(`Thanks — this note is hidden${block ? ' and the account is blocked' : ''}. Reports are saved on this device until moderation review is available.${help}`);
  }

  async function confirmDelete() {
    const n = noteById(VW && VW.id);
    if (!n) return;
    const ok = typeof appConfirm === 'function' ? await appConfirm('Delete your note? It disappears for everyone right away.', { ok: 'Delete', danger: true }) : true;
    if (!ok) return;
    const card = document.querySelector('#nt-viewer .nt-view');
    if (card && !reduced()) card.classList.add('deleting');
    await api.remove(n.id);
    setTimeout(() => { closeViewer(); toast('Note deleted'); }, reduced() ? 0 : 180);
  }

  async function insights() {
    const n = noteById(VW && VW.id);
    if (!n) return;
    const d = await api.insights(n.id);
    const P = n.pollData;
    const extra = `
      <div class="nt-ins">
        <div class="nt-ins-grid">
          <span>${ico('favorite')}<b>${d.likes}</b><em>${d.likes === 1 ? 'Like' : 'Likes'}</em></span>
          <span>${ico('add_reaction')}<b>${d.reactionTotal}</b><em>${d.reactionTotal === 1 ? 'Reaction' : 'Reactions'}</em></span>
          <span>${ico('chat_bubble')}<b>${d.replies}</b><em>${d.replies === 1 ? 'Reply' : 'Replies'}</em></span>
          ${P ? `<span>${ico('ballot')}<b>${d.voteTotal}</b><em>Poll votes</em></span>` : ''}
          ${n.linkData || tokensOf(n.text).urls.length ? `<span>${ico('link')}<b>${d.linkClicks}</b><em>Link clicks</em></span>` : ''}
          <span>${ico('ios_share')}<b>${d.shares}</b><em>Shares</em></span>
        </div>
        ${d.reactionTotal ? `<div class="nt-ins-react">${Object.keys(d.reactions).map(e => `<span>${e} ${d.reactions[e]}</span>`).join('')}</div>` : ''}
        ${P ? `<div class="nt-ins-poll">${P.options.map(o => { const c = d.votes[o.id] || 0; const pct = d.voteTotal ? Math.round(c / d.voteTotal * 100) : 0; return `<span style="--p:${pct}%"><b>${esc(o.text)}</b><em>${c} · ${pct}%</em></span>`; }).join('')}</div>` : ''}
        <p class="nt-ins-note">${ico('group')}Visible to ${esc(audienceLabel(n))}${n.audienceType !== 'community' ? ` · ${d.reach} ${d.reach === 1 ? 'person' : 'people'}` : ''}. ${ico('lock')}Names aren't shown here — replies arrive in your chats.</p>
      </div>`;
    menu('Note interactions', [], extra);
  }

  /* ── Composer ────────────────────────────────────────────────────── */
  let C = null;
  const TOOLS = [
    ['emoji', 'Emoji', 'mood'], ['music', 'Music', 'music_note'], ['link', 'Link', 'link'], ['photo', 'Photo', 'image'],
    ['video', 'Video', 'videocam'], ['gif', 'GIF', 'gif_box'], ['hashtag', 'Hashtag', 'tag'], ['mention', 'Mention', 'alternate_email'],
    ['poll', 'Poll', 'ballot'], ['location', 'Location', 'location_on'], ['post', 'Post', 'post_add']
  ];
  const EMOJIS = ['😀', '😂', '🥹', '😍', '🤩', '😎', '🤔', '😴', '🥳', '😭', '😤', '🙏', '👏', '🙌', '💪', '👀', '🔥', '✨', '💯', '🚀', '❤️', '💜', '💔', '🎉', '🎧', '🎮', '📚', '☕', '🍕', '🌙', '☀️', '🌧️', '🏃', '💼', '📈', '📉', '💎', '🪙', '₿', '🤝'];

  function emptyDraft() {
    return {
      mode: 'create', noteId: null, text: '', media: null, music: null, link: null, poll: null, location: null, content: null,
      audienceType: DB.prefs.lastAudience || 'mutuals', selectedIds: [], communityId: null,
      hours: DB.prefs.lastHours || NOTE_CONFIG.defaultHours, panel: null, view: 'main', busy: false
    };
  }

  function draftFromNote(n) {
    return {
      ...emptyDraft(), mode: 'edit', noteId: n.id, text: n.text || '',
      media: n.mediaUrl ? { kind: n.contentType === 'video' ? 'video' : n.contentType === 'gif' ? 'gif' : 'image', mediaUrl: n.mediaUrl, thumb: n.thumbnailUrl } : null,
      music: n.musicData ? { ...n.musicData } : null, link: n.linkData ? { ...n.linkData } : null,
      poll: n.pollData ? { question: n.pollData.question, options: n.pollData.options.map(o => ({ ...o })) } : null,
      location: n.locationData ? { ...n.locationData } : null, content: n.attachedContent ? { ...n.attachedContent } : null,
      audienceType: n.audienceType, selectedIds: [...(n.selectedAudienceIds || [])], communityId: n.communityId,
      hours: Math.round((n.expiresAt - n.createdAt) / HOUR) || NOTE_CONFIG.defaultHours,
      original: JSON.stringify(n.pollData || null)
    };
  }

  async function compose(opts) {
    opts = opts || {};
    const self = me();
    const active = DB.notes.find(n => n.userId === self.id && n.status === 'active' && !isExpired(n));
    if (opts.edit) {
      const n = noteById(opts.edit);
      if (!n) return;
      C = draftFromNote(n);
    } else {
      if (active && !opts.replaceOk) {
        const ok = typeof appConfirm === 'function'
          ? await appConfirm('You already have a note up. Replace it with a new one? Its likes and reactions go with it; replies stay in your chats.', { ok: 'Replace' })
          : true;
        if (!ok) return;
      }
      C = emptyDraft();
      if (active) { C.mode = 'replace'; C.replaces = active.id; }
      if (opts.content) C.content = opts.content;
      if (opts.panel) C.panel = opts.panel;
    }
    closeMenus();
    renderComposer(true);
  }

  function validPoll(p) {
    return !!(p && p.question.trim() && p.options.filter(o => o.text.trim()).length >= NOTE_CONFIG.poll.minOptions);
  }
  function valid() {
    if (!C) return false;
    if (glen(C.text) > NOTE_CONFIG.maxChars) return false;
    if (C.poll && !validPoll(C.poll)) return false;
    if (C.audienceType === 'selected' && !C.selectedIds.length) return false;
    if (C.audienceType === 'community' && !C.communityId) return false;
    return !!(C.text.trim() || C.media || C.music || C.link || validPoll(C.poll) || C.content || C.location);
  }

  function counterHTML() {
    const n = glen(C.text);
    return `<span class="nt-count${n >= NOTE_CONFIG.maxChars ? ' full' : ''}" id="nt-count" aria-live="polite">${n}/${NOTE_CONFIG.maxChars}</span>`;
  }

  function attachmentsHTML() {
    const parts = [];
    if (C.media) parts.push(`<div class="nt-att media">${C.media.thumb ? `<img src="${esc(C.media.thumb)}" alt="">` : ico('image')}
      <span><b>${C.media.kind === 'video' ? 'Video' : C.media.kind === 'gif' ? 'GIF' : 'Photo'}</b><em>${C.media.duration ? Math.round(C.media.duration) + 's · ' : ''}Shown larger when opened</em></span>
      <button type="button" class="nt-ib" data-nt="rm:media" aria-label="Remove media">${ico('close')}</button></div>`);
    if (C.music) parts.push(`<div class="nt-att">${ico('music_note')}<span><b>${esc(C.music.title)}</b><em>${esc(C.music.artist || 'Audio clip')} · ${C.music.clipSeconds || NOTE_CONFIG.media.clipSeconds}s clip</em></span>
      <button type="button" class="nt-ib" data-nt="rm:music" aria-label="Remove music">${ico('close')}</button></div>`);
    if (C.link) parts.push(`<div class="nt-att link">${C.link.loading ? `<span class="nt-spin" aria-hidden="true"></span>` : C.link.image ? `<img src="${esc(C.link.image)}" alt="">` : ico('link')}
      <span><b>${esc(C.link.loading ? 'Getting preview…' : C.link.title)}</b><em>${esc(C.link.domain)}</em></span>
      <button type="button" class="nt-ib" data-nt="rm:link" aria-label="Remove link">${ico('close')}</button></div>`);
    if (C.location) parts.push(`<div class="nt-att">${ico('location_on')}<span><b>${esc(C.location.name)}</b><em>Only this place name is shared</em></span>
      <button type="button" class="nt-ib" data-nt="rm:location" aria-label="Remove location">${ico('close')}</button></div>`);
    if (C.content) parts.push(`<div class="nt-att wide">${contentCardHTML(C.content, false)}
      <button type="button" class="nt-ib" data-nt="rm:content" aria-label="Remove attached content">${ico('close')}</button></div>`);
    if (C.poll) {
      parts.push(`<div class="nt-att poll">
        <div class="nt-poll-ed">
          <span class="nt-poll-ed-h">${ico('ballot')}<b>Poll</b><button type="button" class="nt-ib" data-nt="rm:poll" aria-label="Remove poll">${ico('close')}</button></span>
          <input class="input" data-nt-in="poll-q" maxlength="${NOTE_CONFIG.poll.questionMax}" placeholder="Ask a question" value="${esc(C.poll.question)}" aria-label="Poll question">
          ${C.poll.options.map((o, i) => `<span class="nt-poll-row"><input class="input" data-nt-in="poll-o:${i}" maxlength="${NOTE_CONFIG.poll.optionMax}" placeholder="Option ${i + 1}" value="${esc(o.text)}" aria-label="Option ${i + 1}">
            ${C.poll.options.length > NOTE_CONFIG.poll.minOptions ? `<button type="button" class="nt-ib" data-nt="poll-rm:${i}" aria-label="Remove option ${i + 1}">${ico('remove')}</button>` : ''}</span>`).join('')}
          ${C.poll.options.length < NOTE_CONFIG.poll.maxOptions ? `<button type="button" class="nt-chip" data-nt="poll-add">${ico('add')}Add option</button>` : ''}
        </div></div>`);
    }
    return parts.length ? `<div class="nt-atts">${parts.join('')}</div>` : '';
  }

  function panelHTML() {
    switch (C.panel) {
      case 'emoji':
        return `<div class="nt-panel emoji">${EMOJIS.map(e => `<button type="button" data-nt="emoji:${e}" aria-label="Insert ${e}">${e}</button>`).join('')}</div>`;
      case 'music': {
        const tracks = libraryTracks();
        return `<div class="nt-panel list">
          <span class="nt-panel-h">Trending sounds</span>
          ${tracks.length ? tracks.map((t, i) => `<button type="button" class="nt-pick" data-nt="track:${i}">${ico('music_note')}<span><b>${esc(t.title)}</b><em>${esc(t.artist)}</em></span></button>`).join('') : '<p class="nt-muted">No sounds in the library right now.</p>'}
          <button type="button" class="nt-chip" data-nt="music-file">${ico('upload')}Use an audio file from this device</button>
        </div>`;
      }
      case 'link':
        return `<form class="nt-panel inline" data-nt-form="link">
          <input class="input" id="nt-link-in" type="url" inputmode="url" placeholder="Paste a link (https://…)" aria-label="Link" autocomplete="off">
          <button type="submit" class="nt-btn primary">Add</button>
        </form>`;
      case 'hashtag': {
        const tags = trendingTags();
        return `<div class="nt-panel chips"><span class="nt-panel-h">Trending tags</span>${tags.map(t => `<button type="button" class="nt-chip" data-nt="insert:#${esc(t)} ">#${esc(t)}</button>`).join('')}
          <button type="button" class="nt-chip" data-nt="insert:#">${ico('add')}Type your own</button></div>`;
      }
      case 'mention':
        return `<div class="nt-panel list">
          <input class="input" data-nt-in="mention-q" placeholder="Search people" aria-label="Search people to mention" autocomplete="off">
          <div id="nt-mention-list">${mentionList('')}</div>
        </div>`;
      case 'location': {
        const u = (typeof S !== 'undefined' && S.user) || {};
        return `<form class="nt-panel inline col" data-nt-form="location">
          <span class="nt-panel-h">Add a place <em>Only the name you type is shared — never your precise position.</em></span>
          <span class="nt-inline"><input class="input" id="nt-loc-in" maxlength="40" placeholder="City, venue or neighbourhood" aria-label="Place name" autocomplete="off">
          <button type="submit" class="nt-btn primary">Add</button></span>
          ${u.location ? `<button type="button" class="nt-chip" data-nt="loc:${esc(u.location)}">${ico('home_pin')}${esc(u.location)}</button>` : ''}
        </form>`;
      }
      case 'post': return contentPickerHTML();
      default: return '';
    }
  }

  function trendingTags() {
    const counts = {};
    ((typeof DATA !== 'undefined' && DATA.posts) || []).forEach(p => (p.tags || []).forEach(t => { const k = String(t).replace(/^#/, ''); counts[k] = (counts[k] || 0) + (p.likes || 1); }));
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 8);
  }

  function mentionList(q) {
    const s = String(q || '').toLowerCase().replace(/^@/, '');
    const list = PEOPLE.filter(p => !DB.prefs.blocked.includes(p.id) && (!s || p.name.toLowerCase().includes(s) || p.handle.toLowerCase().includes(s))).slice(0, 8);
    return list.length ? list.map(p => `<button type="button" class="nt-pick" data-nt="insert:${esc(p.handle)} ">${avatarHTML(p, 'xs')}<span><b>${esc(p.name)}</b><em>${esc(p.handle)}</em></span></button>`).join('') : '<p class="nt-muted">No one matches.</p>';
  }

  function contentPickerHTML() {
    const self = me();
    const posts = ((typeof DATA !== 'undefined' && DATA.posts) || []);
    const mine = posts.filter(p => p.mine || p.handle === self.handle);
    const rest = posts.filter(p => !mine.includes(p)).slice(0, 12);
    const shorts = typeof SH !== 'undefined' && SH.all ? SH.all().slice(0, 10) : [];
    const coms = typeof CMD !== 'undefined' && CMD.all ? CMD.all().filter(c => CMD.isJoined && CMD.isJoined(c.id)).slice(0, 10) : [];
    const row = (k, icon, title, sub) => `<button type="button" class="nt-pick" data-nt="${esc(k)}">${ico(icon)}<span><b>${esc(title)}</b><em>${esc(sub)}</em></span></button>`;
    const snip = s => gslice(String(s || '').replace(/\s+/g, ' ').trim(), 70);
    return `<div class="nt-panel list tall">
      ${mine.length ? `<span class="nt-panel-h">Your posts</span>${mine.slice(0, 6).map(p => row(`attach:post:${p.id}`, 'article', snip(p.body), 'Your post')).join('')}` : ''}
      ${rest.length ? `<span class="nt-panel-h">Posts</span>${rest.map(p => row(`attach:post:${p.id}`, 'article', snip(p.body), p.author)).join('')}` : ''}
      ${shorts.length ? `<span class="nt-panel-h">Shorty</span>${shorts.map(s => row(`attach:short:${s.id}`, 'slow_motion_video', snip(s.caption) || s.creator, s.mine ? 'Your Shorty' : s.creator)).join('')}` : ''}
      ${coms.length ? `<span class="nt-panel-h">Your communities</span>${coms.map(c => row(`attach:community:${c.id}`, c.icon || 'groups', c.name, `${(c.members || 0).toLocaleString()} members`)).join('')}` : ''}
    </div>`;
  }

  function audienceViewHTML() {
    const P = DB.prefs;
    const coms = typeof CMD !== 'undefined' && CMD.all ? CMD.all().filter(c => CMD.isJoined && CMD.isJoined(c.id)) : [];
    const count = k => {
      const fake = { audienceType: k, selectedAudienceIds: C.selectedIds, communityId: C.communityId };
      return audienceSize(fake);
    };
    return `
      <header class="nt-ch">
        <button type="button" class="nt-ib" data-nt="aud-back" aria-label="Back">${ico('arrow_back')}</button>
        <h2>Who can see your note</h2>
      </header>
      <div class="nt-cbody">
        <div class="nt-auds" role="radiogroup" aria-label="Audience">
          ${AUDIENCES.map(([k, l, i, sub]) => `
            <button type="button" role="radio" aria-checked="${C.audienceType === k}" class="nt-aud-o${C.audienceType === k ? ' on' : ''}" data-nt="aud:${k}">
              <span class="nt-aud-i">${ico(i)}</span>
              <span class="nt-aud-t"><b>${l}</b><em>${sub}${k !== 'community' && k !== 'selected' ? ` · ${count(k)}` : ''}</em></span>
              <span class="nt-radio" aria-hidden="true"></span>
            </button>`).join('')}
        </div>
        ${C.audienceType === 'close_friends' ? `
          <span class="nt-panel-h">Your Close Friends <em>${P.closeFriends.length} ${P.closeFriends.length === 1 ? 'person' : 'people'}</em></span>
          <div class="nt-people">${PEOPLE.map(p => `<label class="nt-person">${avatarHTML(p, 'xs')}<span><b>${esc(p.name)}</b><em>${esc(p.handle)}</em></span>
            <input type="checkbox" data-nt-cf="${p.id}" ${P.closeFriends.includes(p.id) ? 'checked' : ''}></label>`).join('')}</div>` : ''}
        ${C.audienceType === 'selected' ? `
          <span class="nt-panel-h">Choose people <em>${C.selectedIds.length} selected</em></span>
          <div class="nt-people">${PEOPLE.filter(p => p.followsYou || p.youFollow).map(p => `<label class="nt-person">${avatarHTML(p, 'xs')}<span><b>${esc(p.name)}</b><em>${esc(p.handle)}</em></span>
            <input type="checkbox" data-nt-sel="${p.id}" ${C.selectedIds.includes(p.id) ? 'checked' : ''}></label>`).join('')}</div>` : ''}
        ${C.audienceType === 'community' ? (coms.length ? `
          <span class="nt-panel-h">Pick a community</span>
          <div class="nt-people">${coms.map(c => `<label class="nt-person"><span class="nt-av xs" style="background:${safeColor(c.color)}">${ico(c.icon || 'groups')}</span><span><b>${esc(c.name)}</b><em>${(c.members || 0).toLocaleString()} members</em></span>
            <input type="radio" name="nt-com" data-nt-com="${esc(c.id)}" ${C.communityId === c.id ? 'checked' : ''}></label>`).join('')}</div>`
          : '<p class="nt-muted">Join a community first to share a note with its members.</p>') : ''}
        <p class="nt-muted">${ico('lock')}Notes are never public. Blocked accounts never see them.</p>
      </div>
      <footer class="nt-cfoot"><span></span><button type="button" class="nt-btn primary" data-nt="aud-back">Done</button></footer>`;
  }

  function renderComposer(first) {
    if (!C) return;
    let el = $('nt-composer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nt-composer';
      el.className = 'nt-scrim sheet';
      el.innerHTML = '<div class="nt-compose" role="dialog" aria-modal="true" aria-label="New note"></div>';
      el.addEventListener('click', e => { if (e.target === el) cancelCompose(); });
      document.body.appendChild(el);
    }
    const box = el.querySelector('.nt-compose');
    const self = person(me().id);
    const title = C.mode === 'edit' ? 'Edit note' : C.mode === 'replace' ? 'Replace note' : 'New note';
    box.setAttribute('aria-label', title);

    if (C.view === 'audience') { box.innerHTML = audienceViewHTML(); return; }

    const aud = audienceOf(C.audienceType);
    const audSub = C.audienceType === 'selected' ? `${C.selectedIds.length} selected`
      : C.audienceType === 'community' ? (C.communityId && typeof CMD !== 'undefined' ? (CMD.byId(C.communityId) || {}).name || 'Pick a community' : 'Pick a community')
      : aud[1];
    const focusedInput = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.ntIn : null;
    const caret = $('nt-text') && document.activeElement === $('nt-text') ? [$('nt-text').selectionStart, $('nt-text').selectionEnd] : null;

    box.innerHTML = `
      <header class="nt-ch">
        <button type="button" class="nt-ib" data-nt="cancel" aria-label="Close">${ico('close')}</button>
        <h2>${title}</h2>
        <span class="nt-ch-r"></span>
      </header>
      <div class="nt-cbody">
        <div class="nt-cme">
          ${avatarHTML(self)}
          <div class="nt-cbubble">
            <textarea id="nt-text" rows="2" placeholder="Share what's trending…" aria-label="Your note" aria-describedby="nt-count">${esc(C.text)}</textarea>
            ${counterHTML()}
          </div>
          <span class="nt-cme-l">Your note</span>
        </div>
        ${tokensLineHTML()}
        ${attachmentsHTML()}
        <div class="nt-tools" role="toolbar" aria-label="Add to your note">
          ${TOOLS.map(([k, l, i]) => `<button type="button" class="nt-tool${C.panel === k ? ' on' : ''}" data-nt="tool:${k}" aria-pressed="${C.panel === k}" aria-label="${l}">${ico(i)}<span>${l}</span></button>`).join('')}
        </div>
        ${panelHTML()}
        <button type="button" class="nt-setting" data-nt="aud-open">${ico(aud[2])}<span><em>Audience</em><b>${esc(audSub)}</b></span>${ico('chevron_right')}</button>
        <div class="nt-setting static">${ico('schedule')}<span><em>Disappears after</em>
          <span class="nt-durs" role="radiogroup" aria-label="Disappears after">${NOTE_CONFIG.durations.map(([h, l]) => `<button type="button" role="radio" aria-checked="${C.hours === h}" class="nt-chip${C.hours === h ? ' on' : ''}" data-nt="hours:${h}">${l.replace(' hours', 'h').replace(' hour', 'h')}</button>`).join('')}
          <button type="button" role="radio" aria-checked="${!NOTE_CONFIG.durations.some(d => d[0] === C.hours)}" class="nt-chip${NOTE_CONFIG.durations.some(d => d[0] === C.hours) ? '' : ' on'}" data-nt="hours-custom">${NOTE_CONFIG.durations.some(d => d[0] === C.hours) ? 'Custom' : C.hours + 'h'}</button></span></span></div>
        ${C.mode === 'edit' ? `<p class="nt-muted">${ico('info')}Editing keeps your likes, reactions and replies. The note still ends at its original time unless you change the duration.</p>` : ''}
      </div>
      <footer class="nt-cfoot">
        <button type="button" class="nt-btn" data-nt="cancel">Cancel</button>
        <button type="button" class="nt-btn primary" data-nt="publish" ${valid() && !C.busy ? '' : 'disabled'}>${C.busy ? '<span class="nt-spin" aria-hidden="true"></span>' : ''}${C.mode === 'edit' ? 'Save note' : 'Share Note'}</button>
      </footer>`;

    const ta = $('nt-text');
    if (first) requestAnimationFrame(() => { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); });
    else if (caret) { ta.focus({ preventScroll: true }); ta.setSelectionRange(caret[0], caret[1]); }
    else if (focusedInput) { const f = box.querySelector(`[data-nt-in="${focusedInput}"]`); if (f) { f.focus({ preventScroll: true }); const v = f.value.length; try { f.setSelectionRange(v, v); } catch (e) {} } }
    if (C.panel === 'link' && $('nt-link-in')) $('nt-link-in').focus({ preventScroll: true });
    if (C.panel === 'location' && $('nt-loc-in')) $('nt-loc-in').focus({ preventScroll: true });
  }

  function tokensLineHTML() {
    const t = tokensOf(C.text);
    const chips = [...t.hashtags.map(x => '#' + x), ...t.mentions, ...t.cashtags.map(x => '$' + x)];
    return chips.length ? `<div class="nt-toks" aria-label="Detected tags">${chips.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : '';
  }

  /* Only the parts that change while typing repaint, so the caret and the
     on-screen keyboard stay put. */
  function onText(ta) {
    let v = ta.value;
    // A pasted link becomes a link card rather than eating the character limit.
    const url = (v.match(/https?:\/\/[^\s<>"']+/) || [])[0];
    if (url && !C.link) {
      v = v.replace(url, '').replace(/\s{2,}/g, ' ');
      ta.value = v;
      addLink(trimUrl(url));
    }
    if (glen(v) > NOTE_CONFIG.maxChars) {
      const pos = ta.selectionStart;
      v = gslice(v, NOTE_CONFIG.maxChars);
      ta.value = v;
      try { ta.setSelectionRange(Math.min(pos, v.length), Math.min(pos, v.length)); } catch (e) {}
      const cnt = $('nt-count');
      if (cnt && !reduced()) { cnt.classList.remove('shake'); void cnt.offsetWidth; cnt.classList.add('shake'); }
    }
    C.text = v;
    C.caret = [ta.selectionStart, ta.selectionEnd];
    const cnt = $('nt-count');
    if (cnt) { cnt.textContent = `${glen(v)}/${NOTE_CONFIG.maxChars}`; cnt.classList.toggle('full', glen(v) >= NOTE_CONFIG.maxChars); }
    const toks = document.querySelector('#nt-composer .nt-toks');
    const html = tokensLineHTML();
    if (toks) { if (html) toks.outerHTML = html; else toks.remove(); }
    else if (html) { const me_ = document.querySelector('#nt-composer .nt-cme'); if (me_) me_.insertAdjacentHTML('afterend', html); }
    syncPublish();
  }
  function syncPublish() {
    const b = document.querySelector('#nt-composer [data-nt="publish"]');
    if (b) b.disabled = !valid() || C.busy;
  }

  function insertText(s) {
    const ta = $('nt-text');
    if (!ta) return;
    const focused = document.activeElement === ta;
    const a = focused ? ta.selectionStart : (C.caret != null ? Math.min(C.caret[0], ta.value.length) : ta.value.length);
    const b = focused ? ta.selectionEnd : (C.caret != null ? Math.min(C.caret[1], ta.value.length) : a);
    const before = ta.value.slice(0, a);
    const pad = s[0] === '#' || s[0] === '@' ? (before && !/\s$/.test(before) ? ' ' : '') : '';
    const next = before + pad + s + ta.value.slice(b);
    if (glen(next) > NOTE_CONFIG.maxChars) { toast(`Notes are up to ${NOTE_CONFIG.maxChars} characters.`); return; }
    ta.value = next;
    const pos = (before + pad + s).length;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(pos, pos);
    onText(ta);
  }

  async function addLink(raw) {
    const url = normalizeUrl(raw);
    if (!url) { toast('That link doesn’t look right — use a full web address.'); return; }
    const u = new URL(url);
    C.link = { url, domain: u.hostname.replace(/^www\./, ''), title: u.hostname, loading: true };
    C.panel = null;
    renderComposer();
    const d = await linkPreview(url);
    if (!C || !C.link || C.link.url !== url) return;
    C.link = { ...d };
    renderComposer();
  }

  function pickFile(accept, onFile) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.hidden = true;
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) onFile(f); });
    document.body.appendChild(inp);
    inp.click();
  }

  function pickMedia(kind) {
    const M = NOTE_CONFIG.media;
    const accept = kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : kind === 'gif' ? 'image/gif' : 'image/png,image/jpeg,image/webp';
    pickFile(accept, async f => {
      if (!C) return;
      const okType = kind === 'video' ? /^video\//.test(f.type) : kind === 'gif' ? f.type === 'image/gif' : /^image\/(png|jpeg|webp)$/.test(f.type);
      if (!okType) { toast(kind === 'gif' ? 'Choose a .gif file.' : kind === 'video' ? 'Choose an MP4, WebM or MOV video.' : 'Choose a PNG, JPG or WebP image.'); return; }
      const limit = kind === 'video' ? M.videoBytes : kind === 'gif' ? M.gifBytes : M.imageBytes;
      if (f.size > limit) { toast(`That file is over ${Math.round(limit / 1048576)} MB.`); return; }
      C.busy = true; syncPublish();
      try {
        if (kind === 'video') {
          const info = await videoInfo(f);
          if (!info) { toast('That video couldn’t be read.'); return; }
          if (info.duration > M.videoSeconds + 0.5) { toast(`Note videos can be up to ${M.videoSeconds} seconds.`); return; }
          C.media = { kind, file: f, thumb: info.thumb, duration: info.duration, replaced: C.media && C.media.mediaUrl };
        } else {
          const thumb = await imageThumb(f);
          C.media = { kind: kind === 'gif' ? 'gif' : 'image', file: f, thumb, replaced: C.media && C.media.mediaUrl };
        }
        C.panel = null;
      } catch (e) { toast('That file couldn’t be used.'); }
      finally { if (C) { C.busy = false; renderComposer(); } }
    });
  }

  function pickAudio() {
    pickFile('audio/*', f => {
      if (!C) return;
      if (!/^audio\//.test(f.type)) { toast('Choose an audio file.'); return; }
      if (f.size > NOTE_CONFIG.media.audioBytes) { toast(`Audio files can be up to ${Math.round(NOTE_CONFIG.media.audioBytes / 1048576)} MB.`); return; }
      const base = f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
      const [artist, title] = base.includes(' - ') ? base.split(' - ') : ['', base];
      C.music = { title: gslice(title.trim() || 'Audio clip', 60), artist: gslice(artist.trim(), 40), source: 'upload', file: f, clipStart: 0, clipSeconds: NOTE_CONFIG.media.clipSeconds, replaced: C.music && C.music.mediaId };
      C.panel = null;
      renderComposer();
    });
  }

  function contentSnapshot(type, id) {
    const snip = s => gslice(String(s || '').replace(/\s+/g, ' ').trim(), 80);
    if (type === 'post') {
      const p = ((typeof DATA !== 'undefined' && DATA.posts) || []).find(x => String(x.id) === String(id));
      return p ? { type, id: p.id, title: snip(p.body) || 'Post', subtitle: `${p.author}${p.handle ? ' · ' + p.handle : ''}` } : null;
    }
    if (type === 'short') {
      const s = typeof SH !== 'undefined' && SH.byId ? SH.byId(id) : null;
      return s ? { type, id: s.id, title: snip(String(s.caption || '').replace(/#[\p{L}\p{N}_]+/gu, '')) || s.creator, subtitle: s.mine ? 'Your Shorty' : s.creator } : null;
    }
    if (type === 'community') {
      const c = typeof CMD !== 'undefined' && CMD.byId ? CMD.byId(id) : null;
      return c ? { type, id: c.id, title: c.name, subtitle: `${(c.members || 0).toLocaleString()} members`, icon: c.icon || 'groups', color: c.color } : null;
    }
    if (type === 'community_post') {
      const [cid, pid] = String(id).split(':');
      const c = typeof CMD !== 'undefined' && CMD.byId ? CMD.byId(cid) : null;
      let post = null;
      try { post = c && typeof CMD.feed === 'function' ? (CMD.feed(cid) || []).find(x => String(x.id) === pid) : null; } catch (e) {}
      if (!c) return null;
      return { type, id: `${cid}:${pid}`, title: post ? snip(post.text) : `Post in ${c.name}`, subtitle: c.name, icon: 'forum', color: c.color };
    }
    return null;
  }

  function cancelCompose() {
    const dirty = C && (C.text || C.media || C.music || C.link || C.poll || C.location || (C.content && C.mode !== 'create'));
    const go = () => { const el = $('nt-composer'); if (el) el.remove(); C = null; };
    if (dirty && C.mode !== 'edit' && typeof appConfirm === 'function') {
      appConfirm('Discard this note?', { ok: 'Discard', danger: true }).then(ok => { if (ok) go(); });
    } else go();
  }

  async function publish() {
    if (!C || !valid() || C.busy) return;
    const scan = moderate([C.text, C.poll && C.poll.question, C.poll && C.poll.options.map(o => o.text).join(' '), C.location && C.location.name].filter(Boolean).join(' '));
    if (!scan.ok) { toast(`This note can’t be shared: ${scan.why}.`); return; }
    C.busy = true; syncPublish();

    const self = me();
    const t = now();
    const editing = C.mode === 'edit' ? noteById(C.noteId) : null;
    const id = editing ? editing.id : rid('n');

    try {
      // Media files go to IndexedDB; the record keeps a pointer and a thumbnail.
      let mediaUrl = editing ? editing.mediaUrl : '';
      let thumbnailUrl = editing ? editing.thumbnailUrl : '';
      if (C.media && C.media.file) {
        const mid = `${id}_m_${t.toString(36)}`;
        await putMedia(mid, C.media.file);
        if (C.media.replaced) delMedia(mediaIdOf(C.media.replaced));
        mediaUrl = 'idb:' + mid;
        thumbnailUrl = C.media.thumb || '';
      } else if (!C.media) {
        if (editing && editing.mediaUrl) delMedia(mediaIdOf(editing.mediaUrl));
        mediaUrl = ''; thumbnailUrl = '';
      }
      let musicData = null;
      if (C.music) {
        musicData = { title: C.music.title, artist: C.music.artist || '', source: C.music.source, clipStart: C.music.clipStart || 0, clipSeconds: C.music.clipSeconds || NOTE_CONFIG.media.clipSeconds };
        if (C.music.file) {
          const aid = `${id}_a_${t.toString(36)}`;
          await putMedia(aid, C.music.file);
          if (C.music.replaced) delMedia(C.music.replaced);
          musicData.mediaId = aid;
        } else if (C.music.mediaId) musicData.mediaId = C.music.mediaId;
        else if (C.music.src) musicData.src = C.music.src;
      } else if (editing && editing.musicData && editing.musicData.mediaId) delMedia(editing.musicData.mediaId);

      const pollData = C.poll ? { question: C.poll.question.trim(), options: C.poll.options.filter(o => o.text.trim()).map(o => ({ id: o.id, text: o.text.trim() })) } : null;
      const tk = tokensOf(C.text);
      const contentType = C.media ? C.media.kind : pollData ? 'poll' : C.link ? 'link' : C.content ? 'content' : C.music ? 'music' : 'text';
      const createdAt = editing ? editing.createdAt : t;
      const fields = {
        text: C.text.trim(), contentType, mediaUrl, thumbnailUrl, musicData,
        linkData: C.link && !C.link.loading ? { url: C.link.url, domain: C.link.domain, title: C.link.title, description: C.link.description || '', image: C.link.image || null } : null,
        hashtags: tk.hashtags, mentions: tk.mentions, cashtags: tk.cashtags,
        pollData, locationData: C.location ? { name: C.location.name } : null,
        attachedContentId: C.content ? C.content.id : null, attachedContentType: C.content ? C.content.type : null, attachedContent: C.content || null,
        audienceType: C.audienceType, selectedAudienceIds: C.audienceType === 'selected' ? [...C.selectedIds] : [],
        communityId: C.audienceType === 'community' ? C.communityId : null,
        expiresAt: createdAt + Math.min(NOTE_CONFIG.customMaxHours, Math.max(1, C.hours)) * HOUR,
        sensitive: !!scan.sensitive
      };

      if (editing) {
        // A changed poll can't keep votes cast for different options.
        if (C.original !== JSON.stringify(pollData)) {
          const had = byNote('votes', id).length;
          const changedOptions = JSON.stringify((JSON.parse(C.original || 'null') || {}).options || []) !== JSON.stringify((pollData || {}).options || []);
          if (had && changedOptions) {
            const ok = typeof appConfirm === 'function' ? await appConfirm(`Changing the poll options clears its ${had} ${had === 1 ? 'vote' : 'votes'}.`, { ok: 'Change poll', danger: true }) : true;
            if (!ok) { C.busy = false; renderComposer(); return; }
            DB.votes = DB.votes.filter(v => v.noteId !== id);
            write('votes');
          }
        }
        await api.update(id, fields);
        toast('Note updated');
      } else {
        if (C.mode === 'replace' && C.replaces) await api.remove(C.replaces);
        await api.create({ id, userId: self.id, ...fields, createdAt: t, updatedAt: t, status: 'active' });
        DB.prefs.lastAudience = C.audienceType;
        if (NOTE_CONFIG.durations.some(d => d[0] === C.hours)) DB.prefs.lastHours = C.hours;
        write('prefs');
        toast('Note shared');
        simulateActivity(id);
      }
      const el = $('nt-composer');
      if (el) el.remove();
      C = null;
      schedule();
      paintRow();
      const first = document.querySelector('#nt-row .nt-item.mine');
      if (first && !reduced()) first.classList.add('pop');
      if (VW) renderViewer();
    } catch (e) {
      if (C) { C.busy = false; renderComposer(); }
    }
  }

  /* ── Your note: management ───────────────────────────────────────── */
  function editNote() { const n = noteById(VW && VW.id); if (n) compose({ edit: n.id }); }
  function changeAudience() {
    const n = noteById(VW && VW.id);
    if (!n) return;
    C = draftFromNote(n);
    C.view = 'audience';
    C.audienceOnly = true;
    closeMenus();
    renderComposer(true);
  }
  async function saveAudienceOnly() {
    if (!C || !C.audienceOnly) return false;
    if ((C.audienceType === 'selected' && !C.selectedIds.length) || (C.audienceType === 'community' && !C.communityId)) {
      toast(C.audienceType === 'selected' ? 'Choose at least one person.' : 'Pick a community.');
      return true;
    }
    await api.update(C.noteId, { audienceType: C.audienceType, selectedAudienceIds: C.audienceType === 'selected' ? [...C.selectedIds] : [], communityId: C.audienceType === 'community' ? C.communityId : null });
    const el = $('nt-composer'); if (el) el.remove();
    C = null;
    toast('Audience updated');
    paintRow();
    if (VW) renderViewer();
    return true;
  }
  async function replaceNote() {
    const n = noteById(VW && VW.id);
    if (!n) return;
    const ok = typeof appConfirm === 'function' ? await appConfirm('Replace your note? Its likes and reactions go with it; replies stay in your chats.', { ok: 'Replace' }) : true;
    if (!ok) return;
    closeViewer();
    compose({ replaceOk: true });
  }

  /* ── Simulated friends (the demo social graph) ───────────────────── */
  /* Mirrors how DMs answer back in this build: a couple of the people
     your note reaches react to it, so interactions and notifications
     have something to show. Turn it off in Notes settings. */
  function simulateActivity(id) {
    if (!DB.prefs.demoActivity) return;
    const n = noteById(id);
    if (!n) return;
    const pool = reachable(n).sort(() => Math.random() - 0.5).slice(0, 3);
    pool.forEach((p, i) => {
      setTimeout(async () => {
        const cur = noteById(id);
        if (!cur || cur.status !== 'active' || isExpired(cur)) return;
        if (i === 1) await api.like(id, p.id);
        else await api.react(id, NOTE_CONFIG.reactions[Math.floor(Math.random() * NOTE_CONFIG.reactions.length)], p.id);
        notify(cur, p, i === 1 ? 'liked' : 'reacted to');
        if (VW && VW.id === id) renderViewer();
      }, 7000 + i * 9000 + Math.random() * 3000);
    });
  }

  /* ── Notifications ───────────────────────────────────────────────── */
  const buckets = {};
  function notify(n, p, verb) {
    if (!DB.prefs.notify || !n || n.userId !== me().id) return;
    if (DB.prefs.blocked.includes(p.id) || DB.prefs.restricted.includes(p.id)) return;
    const list = document.querySelector('#notif-dropdown-menu .notif-list');
    const key = n.id;
    const t = now();
    let b = buckets[key];
    // Several interactions close together become one notification.
    if (b && t - b.at < NOTE_CONFIG.notifyWindowMs && b.el && document.contains(b.el)) {
      b.people.add(p.name);
      b.at = t;
    } else {
      b = buckets[key] = { people: new Set([p.name]), at: t, verb, el: null };
    }
    const names = [...b.people];
    const who = names.length === 1 ? `<strong>${esc(names[0])}</strong>` : `<strong>${esc(names[0])}</strong> and ${names.length - 1} ${names.length === 2 ? 'other' : 'others'}`;
    const html = `<div class="notif-item-avatar" style="background:var(--brand-fill)">📝</div>
      <div class="notif-item-content"><div class="notif-item-text">${who} ${names.length === 1 ? esc(verb) : 'interacted with'} your note</div><div class="notif-item-time">just now</div></div>`;
    if (list) {
      if (!b.el || !document.contains(b.el)) {
        b.el = document.createElement('div');
        b.el.className = 'notif-item unread nt-notif';
        b.el.addEventListener('click', e => { e.stopPropagation(); const dd = $('notif-dropdown-menu'); if (dd) dd.classList.add('hidden'); if (typeof navigateTo === 'function') navigateTo('messages'); setTimeout(() => { open(n.id); insights(); }, 150); });
      }
      b.el.innerHTML = html;
      b.el.classList.add('unread');
      list.prepend(b.el);
      const dot = document.querySelector('.notif-dot');
      if (dot) dot.classList.remove('hidden');
    }
  }

  /* ── Settings ────────────────────────────────────────────────────── */
  function settings() {
    const P = DB.prefs;
    const muted = PEOPLE.filter(p => P.mutedUsers.includes(p.id));
    const blocked = PEOPLE.filter(p => P.blocked.includes(p.id));
    const extra = `
      <div class="nt-set">
        <label class="nt-switch"><span><b>Note notifications</b><em>Likes, reactions and replies to your note</em></span><input type="checkbox" data-nt-pref="notify" ${P.notify ? 'checked' : ''}></label>
        <label class="nt-switch"><span><b>Friends' activity (demo)</b><em>Let the people your note reaches react in this build</em></span><input type="checkbox" data-nt-pref="demoActivity" ${P.demoActivity ? 'checked' : ''}></label>
        <span class="nt-panel-h">Close Friends <em>${P.closeFriends.length}</em></span>
        <div class="nt-people">${PEOPLE.map(p => `<label class="nt-person">${avatarHTML(p, 'xs')}<span><b>${esc(p.name)}</b><em>${esc(p.handle)}</em></span><input type="checkbox" data-nt-cf="${p.id}" ${P.closeFriends.includes(p.id) ? 'checked' : ''}></label>`).join('')}</div>
        ${muted.length ? `<span class="nt-panel-h">Muted notes</span>${muted.map(p => `<span class="nt-person">${avatarHTML(p, 'xs')}<span><b>${esc(p.name)}</b><em>${esc(p.handle)}</em></span><button type="button" class="nt-chip" data-nt="unmute:${p.id}">Unmute</button></span>`).join('')}` : ''}
        ${blocked.length ? `<span class="nt-panel-h">Blocked</span>${blocked.map(p => `<span class="nt-person">${avatarHTML(p, 'xs')}<span><b>${esc(p.name)}</b><em>${esc(p.handle)}</em></span><button type="button" class="nt-chip" data-nt="unblock:${p.id}">Unblock</button></span>`).join('')}` : ''}
        ${P.hiddenNotes.length ? `<button type="button" class="nt-chip" data-nt="unhide">${ico('visibility')}Show ${P.hiddenNotes.length} hidden ${P.hiddenNotes.length === 1 ? 'note' : 'notes'} again</button>` : ''}
      </div>`;
    menu('Notes and chats', [
      ['go:saved', 'Saved Messages', 'bookmark'],
      ['go:archived', 'Archived chats', 'archive'],
      ['go:profile', 'Your profile', 'person']
    ], extra);
  }

  /* ── Opening what a note points to ───────────────────────────────── */
  function openContent(c) {
    if (!c) return;
    const gone = () => toast('That content is no longer available.');
    closeViewer();
    if (c.type === 'post') {
      if (!((typeof DATA !== 'undefined' && DATA.posts) || []).some(p => String(p.id) === String(c.id))) return gone();
      if (window.SR && SR.openPost) SR.openPost(c.id); else if (typeof navigateTo === 'function') navigateTo('feeds');
    } else if (c.type === 'short') {
      const s = typeof SH !== 'undefined' && SH.byId ? SH.byId(c.id) : null;
      if (!s) return gone();
      SH.openAt(0, [s]);
    } else if (c.type === 'community' || c.type === 'community_post') {
      const cid = String(c.id).split(':')[0];
      if (typeof CMD === 'undefined' || !CMD.byId || !CMD.byId(cid)) return gone();
      if (typeof navigateTo === 'function') navigateTo('community');
      setTimeout(() => { if (window.HUB && HUB.open) HUB.open(cid); }, 150);
    }
  }

  function openProfile(handle) {
    const h = String(handle || '');
    closeMenus();
    closeViewer();
    if (h.toLowerCase() === me().handle.toLowerCase()) { if (typeof navigateTo === 'function') navigateTo('profile'); return; }
    if (window.SR && SR.show && SR.show('account', h)) return;
    toast(`${h} isn’t on Trending yet.`);
  }

  /* ── Events ──────────────────────────────────────────────────────── */
  function inNotes(el) { return el.closest('#nt-row, #nt-viewer, #nt-composer, #nt-menu'); }

  async function onClick(e) {
    const link = e.target.closest('[data-nt-link]');
    if (link && inNotes(link)) { const id = link.dataset.ntLink; if (id) api.track(id, 'link_click'); return; }
    const el = e.target.closest('[data-nt]');
    if (!el || !inNotes(el)) return;
    const k = el.dataset.nt;
    const v = el.dataset.v;
    const n = VW ? noteById(VW.id) : null;
    const colon = k.indexOf(':');
    const head = colon > -1 ? k.slice(0, colon) : k;
    const arg = colon > -1 ? k.slice(colon + 1) : '';

    switch (head) {
      /* row and viewer */
      case 'open': return open(el.dataset.id);
      case 'compose': return compose();
      case 'close': return closeViewer();
      case 'prev': return step(-1);
      case 'next': return step(1);
      case 'menu': return noteMenu();
      case 'react': return react(v, el);
      case 'like': if (n && !isExpired(n)) { await api.like(n.id); renderViewer(); } return;
      case 'vote': if (n && !isExpired(n) && n.userId !== me().id) { await api.vote(n.id, v); renderViewer(); } return;
      case 'music': if (n) toggleMusic(n, el); return;
      case 'content': if (n) openContent(n.attachedContent); return;
      case 'share': if (n) share(n); return;
      case 'share-to': closeMenus(); return shareTo(arg);
      case 'share-copy':
        closeMenus();
        if (n) { try { await navigator.clipboard.writeText(summaryOf(n) || ''); toast('Note text copied'); api.track(n.id, 'share'); } catch (err) { toast('Couldn’t copy on this device.'); } }
        return;
      case 'tag': closeViewer(); if (window.SR && SR.show) SR.show('tag', v); else if (window.DX) DX.open('#' + v); return;
      case 'mention': return openProfile(v);
      case 'coin': closeViewer(); if (window.HC && HC.openCoin) HC.openCoin(v); else if (typeof navigateTo === 'function') navigateTo('cryptomarket'); return;

      /* own note */
      case 'insights': closeMenus(); return insights();
      case 'edit': closeMenus(); return editNote();
      case 'audience': return changeAudience();
      case 'replace': closeMenus(); return replaceNote();
      case 'delete': closeMenus(); return confirmDelete();

      /* someone else's note */
      case 'mute-user':
        if (n && !DB.prefs.mutedUsers.includes(n.userId)) { DB.prefs.mutedUsers.push(n.userId); write('prefs'); }
        closeMenus(); closeViewer(); toast('Muted. You won’t see their notes.'); return;
      case 'hide':
        if (n && !DB.prefs.hiddenNotes.includes(n.id)) { DB.prefs.hiddenNotes.push(n.id); write('prefs'); }
        closeMenus(); closeViewer(); toast('Note hidden'); return;
      case 'report': return reportMenu();
      case 'report-reason': return submitReport(+arg);
      case 'profile': if (n) openProfile(person(n.userId).handle); return;

      /* settings */
      case 'unmute': DB.prefs.mutedUsers = DB.prefs.mutedUsers.filter(x => x !== arg); write('prefs'); paintRow(); return settings();
      case 'unblock': DB.prefs.blocked = DB.prefs.blocked.filter(x => x !== arg); write('prefs'); paintRow(); return settings();
      case 'unhide': DB.prefs.hiddenNotes = []; write('prefs'); paintRow(); return settings();
      case 'go':
        closeMenus();
        if (arg === 'profile') { if (typeof navigateTo === 'function') navigateTo('profile'); return; }
        if (typeof TG === 'undefined') return;
        if (arg === 'saved') { TG.open('saved'); return; }
        if (arg === 'archived') { TG.setFolder('archived'); return; }
        return;

      /* composer */
      case 'cancel': return cancelCompose();
      case 'publish': return publish();
      case 'tool': {
        if (!C) return;
        if (arg === 'photo' || arg === 'video' || arg === 'gif') {
          if (C.poll || C.link) { const ok = typeof appConfirm === 'function' ? await appConfirm(`A note holds one main attachment. Replace the ${C.poll ? 'poll' : 'link'} with ${arg === 'photo' ? 'a photo' : arg === 'gif' ? 'a GIF' : 'a video'}?`, { ok: 'Replace' }) : true; if (!ok) return; C.poll = null; C.link = null; }
          return pickMedia(arg);
        }
        if (arg === 'poll') {
          if (!C.poll) {
            if (C.media || C.link) { const ok = typeof appConfirm === 'function' ? await appConfirm(`A note holds one main attachment. Replace the ${C.media ? 'media' : 'link'} with a poll?`, { ok: 'Replace' }) : true; if (!ok) return; C.media = null; C.link = null; }
            C.poll = { question: gslice(C.text.trim(), NOTE_CONFIG.poll.questionMax), options: [{ id: 'a', text: '' }, { id: 'b', text: '' }] };
          }
          C.panel = null;
          renderComposer();
          const q = document.querySelector('[data-nt-in="poll-q"]');
          if (q) q.focus();
          return;
        }
        if (arg === 'link' && (C.media || C.poll)) { const ok = typeof appConfirm === 'function' ? await appConfirm(`A note holds one main attachment. Replace the ${C.media ? 'media' : 'poll'} with a link?`, { ok: 'Replace' }) : true; if (!ok) return; C.media = null; C.poll = null; }
        C.panel = C.panel === arg ? null : arg;
        return renderComposer();
      }
      case 'emoji': return insertText(arg);
      case 'insert': C.panel = null; renderComposer(); return insertText(arg);
      case 'track': {
        const tr = libraryTracks()[+arg];
        if (tr && C) { C.music = { ...tr, clipStart: 0, clipSeconds: NOTE_CONFIG.media.clipSeconds, replaced: C.music && C.music.mediaId }; C.panel = null; renderComposer(); }
        return;
      }
      case 'music-file': return pickAudio();
      case 'loc': if (C) { C.location = { name: gslice(arg, 40) }; C.panel = null; renderComposer(); } return;
      case 'attach': {
        const [type, ...rest] = arg.split(':');
        const snap = contentSnapshot(type, rest.join(':'));
        if (snap && C) { C.content = snap; C.panel = null; renderComposer(); }
        return;
      }
      case 'rm':
        if (!C) return;
        if (arg === 'media') C.media = null;
        if (arg === 'music') C.music = null;
        if (arg === 'link') C.link = null;
        if (arg === 'poll') C.poll = null;
        if (arg === 'location') C.location = null;
        if (arg === 'content') C.content = null;
        return renderComposer();
      case 'poll-add':
        if (C && C.poll && C.poll.options.length < NOTE_CONFIG.poll.maxOptions) { C.poll.options.push({ id: 'abcdef'[C.poll.options.length] || rid('o'), text: '' }); renderComposer(); const last = document.querySelector(`[data-nt-in="poll-o:${C.poll.options.length - 1}"]`); if (last) last.focus(); }
        return;
      case 'poll-rm': if (C && C.poll) { C.poll.options.splice(+arg, 1); renderComposer(); } return;
      case 'hours': if (C) { C.hours = +arg; renderComposer(); } return;
      case 'hours-custom': {
        if (!C || typeof appPrompt !== 'function') return;
        const val = await appPrompt(`How many hours should it last? (1–${NOTE_CONFIG.customMaxHours})`, String(C.hours), { ok: 'Set' });
        if (val === null) return;
        const h = Math.round(Number(val));
        if (!h || h < 1 || h > NOTE_CONFIG.customMaxHours) { toast(`Choose between 1 and ${NOTE_CONFIG.customMaxHours} hours.`); return; }
        C.hours = h; renderComposer(); return;
      }
      case 'aud-open': if (C) { C.view = 'audience'; renderComposer(); } return;
      case 'aud': if (C) { C.audienceType = arg; renderComposer(); } return;
      case 'aud-back':
        if (!C) return;
        if (await saveAudienceOnly()) return;
        C.view = 'main'; renderComposer(); return;
      default: return;
    }
  }

  function onInput(e) {
    const t = e.target;
    if (!inNotes(t)) return;
    if (t.id === 'nt-text' && C) return onText(t);
    const k = t.dataset.ntIn;
    if (k && C) {
      if (k === 'poll-q' && C.poll) C.poll.question = t.value;
      else if (k.indexOf('poll-o:') === 0 && C.poll) { const i = +k.slice(7); if (C.poll.options[i]) C.poll.options[i].text = t.value; }
      else if (k === 'mention-q') { const l = $('nt-mention-list'); if (l) l.innerHTML = mentionList(t.value); }
      syncPublish();
    }
  }

  function onChange(e) {
    const t = e.target;
    if (!inNotes(t)) return;
    if (t.dataset.ntCf) {
      const id = t.dataset.ntCf;
      const P = DB.prefs;
      P.closeFriends = t.checked ? [...new Set([...P.closeFriends, id])] : P.closeFriends.filter(x => x !== id);
      write('prefs');
      emit('prefs', {});
      if (C && C.view === 'audience') renderComposer();
    } else if (t.dataset.ntSel && C) {
      const id = t.dataset.ntSel;
      C.selectedIds = t.checked ? [...new Set([...C.selectedIds, id])] : C.selectedIds.filter(x => x !== id);
      renderComposer();
    } else if (t.dataset.ntCom && C) {
      C.communityId = t.dataset.ntCom;
      renderComposer();
    } else if (t.dataset.ntPref) {
      DB.prefs[t.dataset.ntPref] = t.checked;
      write('prefs');
    }
  }

  function onSubmit(e) {
    const f = e.target.closest('[data-nt-form]');
    if (!f || !inNotes(f)) return;
    e.preventDefault();
    const kind = f.dataset.ntForm;
    if (kind === 'reply') { const inp = $('nt-reply'); if (inp && inp.value.trim()) sendReply(inp.value); }
    else if (kind === 'link') { const inp = $('nt-link-in'); if (inp && inp.value.trim()) addLink(inp.value); }
    else if (kind === 'location') {
      const inp = $('nt-loc-in');
      const name = inp ? inp.value.replace(/\s+/g, ' ').trim() : '';
      if (name && C) { C.location = { name: gslice(name, 40) }; C.panel = null; renderComposer(); }
    }
  }

  function onKey(e) {
    if (e.key !== 'Escape' || document.querySelector('.mob-dialog-scrim')) return;
    if ($('nt-menu')) { e.preventDefault(); e.stopImmediatePropagation(); closeMenus(); return; }
    if ($('nt-composer')) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (C && C.view === 'audience' && !C.audienceOnly) { C.view = 'main'; renderComposer(); } else cancelCompose();
    }
  }

  /* ── Lifetime ────────────────────────────────────────────────────── */
  let timer = null;
  function sweep() {
    const t = now();
    let changed = false;
    DB.notes.forEach(n => { if (n.status === 'active' && n.expiresAt <= t) { n.status = 'expired'; changed = true; } });
    const dead = DB.notes.filter(n => n.status !== 'active' && n.expiresAt < t - NOTE_CONFIG.purgeAfterMs);
    if (dead.length) { dead.forEach(purge); changed = true; }
    if (changed) { write('notes'); emit('note:expired', {}); }
    return changed;
  }
  function schedule() {
    clearTimeout(timer);
    const next = DB.notes.filter(n => n.status === 'active').reduce((m, n) => Math.min(m, n.expiresAt), Infinity);
    const wait = next === Infinity ? 60000 : Math.min(Math.max(1000, next - now() + 250), 60000);
    timer = setTimeout(() => { if (sweep()) refresh(); schedule(); }, wait);
  }
  function refresh() {
    paintRow();
    if (VW) renderViewer();
  }

  // Another tab changed something: reload and repaint.
  if (bus) bus.onmessage = e => { if (!e.data || e.data.from === TAB) return; loadAll(); refresh(); };
  window.addEventListener('storage', e => { if (e.key && e.key.indexOf('ts_note') === 0) { loadAll(); refresh(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && sweep()) refresh(); });

  /* ── Add a Note from published content ───────────────────────────── */
  function fromContent(type, id) {
    const snap = contentSnapshot(type, id);
    if (!snap) { toast('That can’t be attached to a note.'); return; }
    closeMenus();
    compose({ content: snap });
  }

  function shareSheet(id) {
    menu('Share post', [
      [`share-note:${id}`, 'Add a Note', 'sticky_note_2', '', 'Share a short note about this post with your friends'],
      [`share-link:${id}`, 'Copy link', 'link']
    ]);
  }

  /* ── Boot ────────────────────────────────────────────────────────── */
  let ready = false;
  let origShare = null;
  function init() {
    if (ready) return;
    ready = true;
    seed();
    sweep();
    schedule();
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', onKey, true);
    ['keyup', 'mouseup', 'focusout'].forEach(ev => document.addEventListener(ev, e => {
      if (C && e.target && e.target.id === 'nt-text') C.caret = [e.target.selectionStart, e.target.selectionEnd];
    }, true));

    // Post cards: Share offers "Add a Note" next to Copy link.
    if (typeof window.sharePost === 'function' && !window.sharePost.__nt) {
      origShare = window.sharePost;
      const wrapped = id => shareSheet(id);
      wrapped.__nt = true;
      window.sharePost = wrapped;
      document.addEventListener('click', e => {
        const b = e.target.closest('#nt-menu [data-nt^="share-note:"], #nt-menu [data-nt^="share-link:"]');
        if (!b) return;
        const [k, pid] = b.dataset.nt.split(':');
        closeMenus();
        const post = ((typeof DATA !== 'undefined' && DATA.posts) || []).find(p => String(p.id) === pid);
        const realId = post ? post.id : pid;
        if (k === 'share-note') fromContent('post', realId);
        else origShare(realId);
      });
    }

    // Messages: paint the row whenever the pane is (re)built.
    if (typeof window.setupMessages === 'function' && !window.setupMessages.__nt) {
      const setup = window.setupMessages;
      const w = function () { const r = setup.apply(this, arguments); paintHead(); paintRow(); return r; };
      w.__nt = true;
      window.setupMessages = w;
    }
    if (typeof window.updateUserUI === 'function' && !window.updateUserUI.__nt) {
      const up = window.updateUserUI;
      const w = function () { const r = up.apply(this, arguments); try { if (DB.prefs.seededFor !== me().id) seed(); paintHead(); paintRow(); } catch (err) {} return r; };
      w.__nt = true;
      window.updateUserUI = w;
    }
    paintHead();
    paintRow();
  }

  function paintHead() {
    const h = $('msgr-handle');
    if (h) h.textContent = me().handle.replace(/^@/, '');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
  else setTimeout(init, 0);

  return {
    init, open, compose, settings, fromContent, paintRow, closeViewer,
    api, canSee, tokensOf, richHTML, normalizeUrl,
    people: () => PEOPLE.slice(),
    get state() { return { notes: DB.notes.slice(), prefs: { ...DB.prefs } }; }
  };
})();

window.NT = NT;
window.NOTE_CONFIG = NOTE_CONFIG;

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
publish('features/notes.js', {
  NOTE_CONFIG: () => NOTE_CONFIG, NT: () => NT
});
