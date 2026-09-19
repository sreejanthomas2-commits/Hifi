/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CRYPTO COMMUNITY FEED — the Community tab in Crypto Markets      ║
   ║                                                                   ║
   ║  It used to read window.DATA.cryptoPosts. DATA is declared with   ║
   ║  const in a classic script, so it is a global *lexical* binding   ║
   ║  and never appears on window — the lookup returned undefined and  ║
   ║  the tab rendered an empty box. That is the whole bug.            ║
   ║                                                                   ║
   ║  Rather than just restore four static cards, this makes the tab   ║
   ║  work: you can post, your likes and comments persist, and posts   ║
   ║  from the crypto communities you joined in CommuneHub are merged  ║
   ║  in so the feed reflects what is actually happening in the app.   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CF = (() => {

  const KEY = 'ts_cryptofeed';

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const $ = id => document.getElementById(id);

  const DEFAULT = { posts: [], likes: {}, comments: {}, open: null };
  let D = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) } : JSON.parse(JSON.stringify(DEFAULT));
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }

  const me = () => {
    const u = (typeof S !== 'undefined' && S.user) ? S.user : null;
    return (u && u.handle && u.handle !== 'Sign In')
      ? { name: `${u.fname} ${u.lname || ''}`.trim() || 'You', handle: u.handle }
      : { name: 'You', handle: '@you' };
  };

  function ago(ts) {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
  const compact = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
    : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n || 0));

  /* Seed posts carry a written age ("3h ago"); turn that into a real
     timestamp once so everything can sort on the same axis. */
  function ageToTs(str) {
    const m = /(\d+)\s*([smhd])/.exec(String(str || ''));
    if (!m) return Date.now() - 3600000;
    const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]] || 60000;
    return Date.now() - Number(m[1]) * mult;
  }

  /* ── Sources ─────────────────────────────────────────────────────── */
  function seeded() {
    const list = (typeof DATA !== 'undefined' && DATA.cryptoPosts) ? DATA.cryptoPosts : [];
    return list.map(p => ({
      id: p.id, author: p.author, handle: p.handle, avatar: p.avatar,
      body: p.content, tags: p.tags || [], ts: ageToTs(p.time),
      likes: p.likes || 0, comments: p.comments || 0, source: 'crypto'
    }));
  }

  /* Anything posted inside a crypto community in CommuneHub belongs in
     this feed too — same subject, same people. */
  function fromCommunities() {
    if (typeof CMD === 'undefined') return [];
    const out = [];
    CMD.all().forEach(c => {
      if (c.category !== 'crypto' || !CMD.isJoined(c.id)) return;
      (CMD.feed(c.id) || []).forEach(p => out.push({
        id: 'cm-' + c.id + '-' + p.id, author: p.name, handle: p.handle, avatar: '💬',
        body: p.text, tags: (c.tags || []).slice(0, 2), ts: p.ts,
        likes: p.likes || 0, comments: (p.comments || []).length,
        source: 'community', community: { id: c.id, name: c.name, color: c.color, icon: c.icon }
      }));
    });
    return out;
  }

  const mine = () => D.posts.map(p => ({ ...p, source: 'mine' }));

  function all() {
    return seeded().concat(fromCommunities(), mine()).sort((a, b) => b.ts - a.ts);
  }

  const likeCount = p => (p.likes || 0) + (D.likes[p.id] ? 1 : 0);
  const commentList = p => D.comments[p.id] || [];
  const commentCount = p => (p.comments || 0) + commentList(p).length;

  /* ── Actions ─────────────────────────────────────────────────────── */
  function post() {
    const box = $('cf-input');
    if (!box) return;
    const text = box.value.trim();
    if (!text) { toast('Write something first.'); return; }
    const m = me();
    const tags = (text.match(/#([\p{L}\p{N}_]+)/gu) || []).map(t => t.slice(1)).slice(0, 4);
    D.posts.unshift({
      id: 'my' + Date.now(), author: m.name, handle: m.handle, avatar: '🧑‍💻',
      body: text, tags, ts: Date.now(), likes: 0, comments: 0, mine: true
    });
    save();
    box.value = '';
    render();
    toast('Posted to the crypto community');
    if (typeof SF !== 'undefined' && SF.earn) { try { SF.earn('publish_post'); } catch (e) {} }
  }

  function like(id) {
    D.likes[id] = !D.likes[id];
    if (!D.likes[id]) delete D.likes[id];
    save();
    render();
  }

  function toggleComments(id) {
    D.open = D.open === id ? null : id;
    save();
    render();
    if (D.open) setTimeout(() => { const el = $('cf-c-' + id); if (el) el.focus(); }, 40);
  }

  function comment(id) {
    const el = $('cf-c-' + id);
    if (!el || !el.value.trim()) return;
    const m = me();
    D.comments[id] = D.comments[id] || [];
    D.comments[id].push({ id: 'c' + Date.now(), name: m.name, handle: m.handle, text: el.value.trim(), ts: Date.now() });
    save();
    render();
    setTimeout(() => { const n = $('cf-c-' + id); if (n) n.focus(); }, 40);
  }

  function removeMine(id) {
    D.posts = D.posts.filter(p => p.id !== id);
    save();
    render();
    toast('Post removed');
  }

  async function share(id) {
    const p = all().find(x => x.id === id);
    if (!p) return;
    const url = `${location.origin}${location.pathname}#cryptofeed-${id}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Trending — crypto community', text: p.body, url }); return; }
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(url); toast('Link copied'); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    toast(url);
  }

  function openCommunity(cid) {
    if (typeof navigateTo === 'function') navigateTo('community');
    setTimeout(() => { if (window.HUB) HUB.open(cid); }, 220);
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  function cardHTML(p) {
    const liked = !!D.likes[p.id];
    const comments = commentList(p);
    const open = D.open === p.id;
    return `
      <article class="cf-post">
        <header class="cf-head">
          <span class="cf-av">${esc(p.avatar || '🪙')}</span>
          <div class="cf-who">
            <b>${esc(p.author)}</b>
            <span>${esc(p.handle)} · ${ago(p.ts)}</span>
          </div>
          ${p.community ? `<button class="cf-src" style="--c:${p.community.color}" onclick="CF.openCommunity('${p.community.id}')">
              <span class="material-symbols-rounded">${esc(p.community.icon)}</span>${esc(p.community.name)}</button>`
            : p.mine ? '<span class="cf-src mine">You</span>' : ''}
          ${p.mine ? `<button class="cf-x" onclick="CF.removeMine('${p.id}')" title="Delete"><span class="material-symbols-rounded">delete</span></button>` : ''}
        </header>

        <p class="cf-body">${esc(p.body)}</p>
        ${(p.tags || []).length ? `<div class="cf-tags">${p.tags.map(t => `<span class="cf-tag">#${esc(t)}</span>`).join('')}</div>` : ''}

        <footer class="cf-acts">
          <button class="cf-act${liked ? ' on' : ''}" onclick="CF.like('${p.id}')">
            <span class="material-symbols-rounded">favorite</span>${compact(likeCount(p))}</button>
          <button class="cf-act${open ? ' on' : ''}" onclick="CF.toggleComments('${p.id}')">
            <span class="material-symbols-rounded">chat_bubble</span>${compact(commentCount(p))}</button>
          <button class="cf-act" onclick="CF.share('${p.id}')">
            <span class="material-symbols-rounded">share</span>Share</button>
        </footer>

        ${open ? `
          <div class="cf-comments">
            ${comments.map(c => `<div class="cf-comment">
              <b>${esc(c.name)}</b><span>${ago(c.ts)}</span><p>${esc(c.text)}</p></div>`).join('')
              || '<p class="cf-none">No replies yet — say the first thing.</p>'}
            <div class="cf-comment-in">
              <input id="cf-c-${p.id}" placeholder="Write a reply" onkeydown="if(event.key==='Enter')CF.comment('${p.id}')">
              <button class="btn btn-primary btn-sm" onclick="CF.comment('${p.id}')">Reply</button>
            </div>
          </div>` : ''}
      </article>`;
  }

  function render(el) {
    const host = el || $('crypto-tab-content');
    if (!host) return;
    const list = all();
    const joined = (typeof CMD !== 'undefined') ? CMD.all().filter(c => c.category === 'crypto' && CMD.isJoined(c.id)) : [];

    host.innerHTML = `
      <div class="cf">
        <div class="cf-compose">
          <span class="cf-av">🧑‍💻</span>
          <div class="cf-compose-b">
            <textarea id="cf-input" rows="2" placeholder="Share a thesis, a chart or a warning — #hashtags work"></textarea>
            <div class="cf-compose-a">
              <span class="cf-none">Posts stay on this device${joined.length ? ` · merged with ${joined.length} joined ${joined.length === 1 ? 'community' : 'communities'}` : ''}.</span>
              <button class="btn btn-primary btn-sm" onclick="CF.post()">Post</button>
            </div>
          </div>
        </div>

        ${joined.length ? `<div class="cf-strip">
          ${joined.map(c => `<button class="cf-strip-b" style="--c:${c.color}" onclick="CF.openCommunity('${c.id}')">
            <span class="material-symbols-rounded">${esc(c.icon)}</span>${esc(c.name)}</button>`).join('')}
        </div>` : `<div class="cf-hint">
          <span class="material-symbols-rounded">groups</span>
          Join a crypto community in CommuneHub and its posts appear here too.
          <button class="btn btn-ghost btn-sm" onclick="navigateTo('community')">Browse communities</button>
        </div>`}

        ${list.map(cardHTML).join('')}
      </div>`;
  }

  return { render, post, like, toggleComments, comment, removeMine, share, openCommunity, all };
})();

window.CF = CF;
