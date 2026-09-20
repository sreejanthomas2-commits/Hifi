/* ╔══════════════════════════════════════════════════════════════════╗
   ║  DISCOVER — search and recommendations as one surface             ║
   ║                                                                   ║
   ║   Search bar → category chips → discovery grid → full-screen      ║
   ║   video feed. Typing switches to suggestions; Enter shows results ║
   ║   in tabs: Top · Accounts · Shorts · Posts · Communities · Topics ║
   ║   · Audio · Coins.                                                ║
   ║                                                                   ║
   ║   Four parts that stay separate on purpose:                       ║
   ║    1. Index           — everything the app holds, normalised      ║
   ║    2. Search ranking  — query relevance first                     ║
   ║    3. Discover ranking— candidates → safety → personalisation →   ║
   ║                         quality → ranking → diversity             ║
   ║    4. Layout          — decides tile sizes, never what is shown   ║
   ║                                                                   ║
   ║   The "api" object is the service boundary: discover(), search(), ║
   ║   suggest() and signal() return what a server would. Swapping it  ║
   ║   for fetch() calls later leaves the interface untouched.         ║
   ║                                                                   ║
   ║   Your interests, feedback and history stay in this browser and   ║
   ║   can be reviewed, paused or wiped from the tune button.          ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const DX = (() => {

  const KEY = 'ts_discover';
  const BATCH = 24;
  const DAY = 864e5;
  const HALF_LIFE = 10 * DAY;

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const $ = id => document.getElementById(id);
  const ico = (n, cls) => `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}">${n}</span>`;
  // A value for an onclick="" attribute: JSON for the JS parser, escaped for HTML.
  const A = v => esc(JSON.stringify(v === undefined ? null : v));
  const lower = s => String(s || '').toLowerCase();
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const initials = n => String(n || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  }
  function hash(s) {
    let h = 2166136261;
    s = String(s || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  // Same formula the search overlay uses, so follower counts agree.
  const seeded = (k, min, max) => min + (hash(k) % Math.max(1, max - min));
  const unit = k => (hash(k) % 10000) / 10000;

  /* ══════════════════════════════════════════════════════════════════
     Topics
     ══════════════════════════════════════════════════════════════════ */

  const TOPICS = {
    crypto:   ['Crypto', 'currency_bitcoin', 'crypto bitcoin btc ethereum eth solana sol defi web3 nft nfts token tokens blockchain altcoin onchain staking layer2 l2 coin coins wallet collectors airdrop'],
    gaming:   ['Gaming', 'sports_esports', 'gaming game games gamer gamers esports ranked fps speedrun console playstation xbox nintendo lfg arena tournament streamer'],
    tech:     ['Technology', 'memory', 'tech technology dev developer developers code coding programming software ai llm openai machine learning startup shipped buildinpublic engineering app apps cgi opensource devcore robotics airevolution'],
    music:    ['Music', 'music_note', 'music beat beats song songs audio producer track album dj soundlab ost sound singer ambient concert playlist'],
    news:     ['News', 'newspaper', 'news breaking report update headline announces regulation policy election'],
    sports:   ['Sports', 'sports_soccer', 'sports sport football soccer matchday goal cricket nba basketball premier league tennis f1 fitness workout gym running fitnessfriday'],
    finance:  ['Finance', 'monitoring', 'finance savings stocks trading markets invest investing economy marketsdesk fed inflation'],
    science:  ['Science', 'science', 'science space lab research physics biology nature ocean macro climate labnotes astronomy'],
    creators: ['Creators', 'palette', 'creator creators creatoreconomy studio design art animation film films filmmaking motion photography cinema shortfilm'],
    life:     ['Lifestyle', 'self_improvement', 'lifestyle friday weekend motivation wellness calm reset travel food fashion nightowls mindset'],
    learning: ['Learning', 'school', 'learning study course courses school learners education tutorial']
  };
  const WORDS = {};
  Object.keys(TOPICS).forEach(t => TOPICS[t][2].split(' ').forEach(w => { (WORDS[w] = WORDS[w] || []).push(t); }));
  const SYNONYMS = { football: ['soccer'], soccer: ['football'], ai: ['artificial', 'intelligence', 'llm'], btc: ['bitcoin'], bitcoin: ['btc'],
    eth: ['ethereum'], ethereum: ['eth'], dev: ['developer', 'code'], film: ['movie', 'cinema'], movie: ['film'], song: ['music'], beats: ['beat', 'music'],
    gym: ['fitness', 'workout'], crypto: ['bitcoin', 'web3'], games: ['gaming'], game: ['gaming'] };
  const CAT_TOPIC = { crypto: 'crypto', tech: 'tech', gaming: 'gaming', creator: 'creators', music: 'music', sports: 'sports', finance: 'finance',
    science: 'science', brand: 'creators', learning: 'learning', design: 'creators', fitness: 'sports', motivation: 'life', agriculture: 'science' };

  const tokenize = s => lower(s).replace(/[#@]/g, ' ').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

  function classify(text, cats) {
    const score = {};
    (cats || []).forEach(c => { const t = CAT_TOPIC[lower(c)] || (TOPICS[lower(c)] ? lower(c) : null); if (t) score[t] = (score[t] || 0) + 3; });
    tokenize(text).forEach(w => (WORDS[w] || []).forEach(t => { score[t] = (score[t] || 0) + 1; }));
    return Object.keys(score).sort((a, b) => score[b] - score[a]);
  }

  /* ══════════════════════════════════════════════════════════════════
     1 · Index — every kind of content, one shape
     ══════════════════════════════════════════════════════════════════ */

  function ageFromLabel(s) {
    const m = /(\d+)\s*(s|m|h|d|w)/i.exec(String(s || ''));
    if (!m) return /just now/i.test(String(s)) ? 0 : 6;
    return +m[1] * ({ s: 1 / 3600, m: 1 / 60, h: 1, d: 24, w: 168 })[m[2].toLowerCase()];
  }
  const parseCount = s => { const m = /([\d.]+)\s*([KMB]?)/i.exec(String(s || '')); return m ? +m[1] * ({ '': 1, K: 1e3, M: 1e6, B: 1e9 })[m[2].toUpperCase()] : 0; };
  const me = () => (typeof S !== 'undefined' && S.user) ? S.user : null;
  const myHandle = () => { const u = me(); return u && u.handle && u.handle !== 'Sign In' ? lower(u.handle) : ''; };

  let INDEX = null;
  let news = [];

  /* Headlines already on this device count straight away; a fresh set is
     requested in the background when Discover opens. */
  function cachedNews() {
    try {
      const c = JSON.parse(localStorage.getItem('ts_news_cache') || 'null');
      return c && Array.isArray(c.items) ? c.items.filter(n => Date.now() - (Date.parse(n.publishedAt) || 0) < 4 * DAY) : [];
    } catch (e) { return []; }
  }

  function buildIndex() {
    if (!news.length) news = cachedNews();
    const items = [];
    const now = Date.now();
    const push = it => { it.topics = it.topics.length ? it.topics : ['life']; it.primary = it.topics[0]; items.push(it); };

    // Shorts
    const shorts = (typeof SH !== 'undefined' && SH.all) ? SH.all() : [];
    const shState = (typeof SH !== 'undefined' && SH.state) ? SH.state : {};
    shorts.forEach(s => {
      const tags = (String(s.caption || '').match(/#[\w]+/g) || []).map(t => t.slice(1));
      push({
        key: 'short:' + s.id, kind: 'short', id: s.id, title: String(s.caption || '').replace(/#[\w]+/g, '').trim() || s.creator,
        text: s.caption || '', creator: s.creator, handle: s.handle, tags, audio: s.audio, mine: !!s.mine,
        topics: classify(`${s.caption} ${s.audio}`), ageH: s.mine ? 1 : 20 + seeded(s.id + 'age', 0, 460),
        stats: { views: (s.views || 0) + ((shState.views || {})[s.id] || 0), likes: (s.likes || 0) + ((shState.liked || {})[s.id] ? 1 : 0), comments: s.comments || 0 },
        visual: true, src: s.src, cover: s.coverUrl || '', zoom: s.zoom || 0, disliked: !!(shState.disliked || {})[s.id]
      });
    });

    // Posts
    const posts = (typeof DATA !== 'undefined' && DATA.posts) || [];
    posts.forEach(p => {
      const tags = (p.tags || []).map(t => String(t).replace(/^#/, ''));
      push({
        key: 'post:' + p.id, kind: 'post', id: p.id, title: String(p.body || '').slice(0, 90), text: p.body || '', creator: p.author, handle: p.handle,
        tags, mine: !!p.mine || (myHandle() && lower(p.handle) === myHandle()), emoji: p.emoji,
        topics: classify(`${p.body} ${tags.join(' ')}`, [p.category]), ageH: ageFromLabel(p.time),
        stats: { likes: p.likes || 0, comments: p.comments || 0, shares: p.shares || 0 }, visual: false
      });
    });

    // Communities
    const communes = (typeof CMD !== 'undefined' && CMD.all) ? CMD.all() : [];
    communes.forEach(c => {
      push({
        key: 'community:' + c.id, kind: 'community', id: c.id, title: c.name, text: `${c.tagline || ''} ${c.desc || ''}`, handle: c.handle,
        tags: c.tags || [], topics: classify(`${c.name} ${c.desc} ${(c.tags || []).join(' ')}`, [c.category]),
        ageH: c.createdAt ? (now - c.createdAt) / 36e5 : 200 + seeded(c.id, 0, 5000),
        stats: { members: c.members || 0, online: c.online || 0 }, verified: !!c.verified, visual: true, joined: !!(CMD.isJoined && CMD.isJoined(c.id)), c
      });
    });

    // Creators and people
    const seen = {};
    const addPerson = (name, handle, kind) => {
      const h = lower(handle);
      if (!name || !h || seen[h]) return;
      seen[h] = true;
      const theirs = items.filter(x => lower(x.handle) === h && (x.kind === 'short' || x.kind === 'post'));
      push({
        key: 'creator:' + h, kind: 'creator', id: handle, title: name, text: theirs.map(x => x.text).join(' ').slice(0, 400), handle, creator: name,
        topics: classify(theirs.map(x => x.text).join(' ')), ageH: 48, me: h === myHandle(), role: kind,
        stats: { followers: seeded(handle, 900, 480000), posts: theirs.length }, visual: false
      });
    };
    shorts.forEach(s => { if (!s.mine) addPerson(s.creator, s.handle, 'creator'); });
    ((typeof DATA !== 'undefined' && DATA.users) || []).forEach(u => addPerson(u.name, u.handle, 'person'));
    posts.forEach(p => addPerson(p.author, p.handle, 'person'));

    // Hashtags and topics
    ((typeof DATA !== 'undefined' && DATA.trending) || []).forEach(t => {
      const tag = String(t.name || '').replace(/^#/, '');
      push({ key: 'topic:' + lower(tag), kind: 'topic', id: tag, title: '#' + tag, text: tag.replace(/([a-z])([A-Z])/g, '$1 $2'), tags: [tag],
        topics: classify(tag.replace(/([a-z])([A-Z])/g, '$1 $2')), ageH: 10 + seeded(tag, 0, 60), stats: { posts: parseCount(t.count) }, hashtag: true, visual: false });
    });
    ((typeof DATA !== 'undefined' && DATA.topics) || []).forEach(t => {
      const k = 'topic:' + lower(t.name);
      if (items.some(x => x.key === k)) return;
      push({ key: k, kind: 'topic', id: t.name, title: t.name, text: t.name, emoji: t.emoji, tags: [],
        topics: classify(t.name, [t.cat]), ageH: 30 + seeded(t.name, 0, 400), stats: { posts: parseCount(t.count) }, visual: false });
    });

    // Real headlines from the news cache (never fetched just for this)
    news.forEach(n => {
      const ts = Date.parse(n.publishedAt) || now;
      push({ key: 'news:' + n.id, kind: 'news', id: n.id, title: n.title, text: n.excerpt || '', creator: n.source, source: n.source,
        topics: ['news'].concat(classify(`${n.title} ${n.excerpt}`).filter(t => t !== 'news')), ageH: Math.max(0, (now - ts) / 36e5),
        stats: { reads: seeded(n.id, 40, 900) }, url: n.url, thumb: /^https:\/\//.test(n.thumbnail || '') ? n.thumbnail : '', visual: !!n.thumbnail });
    });

    scoreStatic(items);
    INDEX = { items, byKey: Object.fromEntries(items.map(i => [i.key, i])), vocab: vocabulary(items), at: now };
    return INDEX;
  }
  const index = () => INDEX || buildIndex();

  /* Quality, freshness, popularity and trend don't depend on who's
     looking, so they're computed once per build. */
  function scoreStatic(items) {
    const engagement = it => {
      const s = it.stats;
      switch (it.kind) {
        case 'short': return s.likes + 3 * s.comments + s.views * 0.02;
        case 'post': return s.likes + 3 * s.comments + 5 * s.shares;
        case 'community': return s.online * 2 + s.members * 0.01;
        case 'creator': return s.followers * 0.002 + s.posts * 40;
        case 'topic': return s.posts / 1000;
        default: return s.reads || 0;
      }
    };
    const HALF = { short: 336, post: 72, news: 36, community: 4000, creator: 2000, topic: 120 };
    items.forEach(it => {
      it.eng = engagement(it);
      it.velocity = Math.log10(1 + it.eng / Math.pow(it.ageH + 2, 0.8));
      it.fresh = Math.pow(0.5, it.ageH / (HALF[it.kind] || 96));
      const s = it.stats;
      let q = 0.5;
      if (it.kind === 'short') q = clamp((s.likes / Math.max(1, s.views)) / 0.05, 0, 1) * 0.7 + clamp(s.comments / 10, 0, 1) * 0.3;
      if (it.kind === 'post') q = clamp((s.comments + s.shares) / Math.max(1, s.likes) * 2.5, 0, 1) * 0.6 + clamp(s.likes / 400, 0, 1) * 0.4;
      if (it.kind === 'community') q = (it.verified ? 0.25 : 0) + clamp(s.online / Math.max(1, s.members) * 12, 0, 0.45) + (it.c && (it.c.avatar || it.c.banner) ? 0.15 : 0.08) + (it.text.trim() ? 0.15 : 0);
      if (it.kind === 'news') q = (it.thumb ? 0.35 : 0.15) + (it.text ? 0.25 : 0.1) + 0.3;
      if (it.kind === 'creator') q = clamp(s.posts / 3, 0, 1) * 0.6 + 0.3;
      if (it.kind === 'topic') q = 0.55;
      if (it.disliked) q *= 0.2;
      it.quality = clamp(q, 0, 1);
    });
    // Popularity and velocity as percentiles within each kind, so a
    // community's member count doesn't drown out a post's likes.
    const byKind = {};
    items.forEach(it => (byKind[it.kind] = byKind[it.kind] || []).push(it));
    Object.keys(byKind).forEach(k => {
      const list = byKind[k];
      const pct = (field, out) => {
        const sorted = list.slice().sort((a, b) => a[field] - b[field]);
        // A group of five can't say much about who's best; pull small
        // groups toward the middle instead of handing out 0 and 1.
        const shrink = (list.length - 1) / (list.length + 3);
        sorted.forEach((it, i) => { it[out] = list.length > 1 ? 0.5 + (i / (list.length - 1) - 0.5) * shrink : 0.5; });
      };
      pct('eng', 'pop');
      pct('velocity', 'velPct');
    });
    items.forEach(it => { it.trend = it.velPct * (0.6 + 0.4 * it.quality) * (0.5 + 0.5 * it.fresh); });
    const cut = items.map(i => i.trend).sort((a, b) => b - a)[Math.floor(items.length * 0.12)] || 1;
    items.forEach(it => { it.hot = it.trend >= cut && it.trend > 0.35; });
  }

  function vocabulary(items) {
    const v = {};
    const add = (w, n) => { if (w.length >= 3) v[w] = (v[w] || 0) + (n || 1); };
    items.forEach(it => tokenize(`${it.title} ${it.handle || ''} ${(it.tags || []).join(' ')} ${it.creator || ''}`).forEach(w => add(w, 3)));
    items.forEach(it => tokenize(it.text).forEach(w => add(w, 1)));
    Object.keys(WORDS).forEach(w => add(w, 2));
    return v;
  }

  /* ══════════════════════════════════════════════════════════════════
     Interest model — what the feedback loop learns
     ══════════════════════════════════════════════════════════════════ */

  const DEFAULT = { interests: {}, creators: {}, items: {}, notInterested: {}, muted: {}, hidden: {}, reported: {}, follows: {},
    searches: {}, personalized: true, onboarded: false };
  let P = load();
  function load() {
    try { return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }
  let saveTimer = null;
  function save(now) {
    clearTimeout(saveTimer);
    const run = () => {
      // Per-item history is only a fatigue signal; keep the busiest 600.
      const keys = Object.keys(P.items);
      if (keys.length > 800) keys.sort((a, b) => (P.items[a].imp + 3 * P.items[a].opens) - (P.items[b].imp + 3 * P.items[b].opens))
        .slice(0, keys.length - 600).forEach(k => delete P.items[k]);
      try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {}
    };
    if (now) run(); else saveTimer = setTimeout(run, 400);
  }

  const decayed = e => e ? e.w * Math.pow(0.5, (Date.now() - e.t) / HALF_LIFE) : 0;
  function bump(map, k, delta) {
    if (!k) return;
    map[k] = { w: clamp(decayed(map[k]) + delta, -12, 40), t: Date.now() };
  }

  const WEIGHTS = { open: 1, like: 2, dislike: -2.5, save: 3, share: 3, comment: 2, follow: 3, join: 3, notInterested: -4 };

  /* One entry point for every interaction, wherever it happened. */
  function signal(key, type, extra) {
    const it = index().byKey[key];
    const e = P.items[key] = P.items[key] || { opens: 0, imp: 0, dwell: 0 };
    let w = WEIGHTS[type] || 0;
    if (type === 'impression') { e.imp++; save(); return; }
    if (type === 'open') e.opens++;
    if (type === 'watch') {
      const c = extra.completion, ms = extra.ms;
      e.dwell += ms;
      w = ms < 2500 && c < 0.25 ? -1.2 : c >= 0.9 ? 2 : c >= 0.5 ? 1 : 0.2;
      if (extra.loops) w += Math.min(2, extra.loops) * 1.2;
    }
    if (extra && extra.on === false) w = -w * 0.8;
    if (it && w) {
      it.topics.forEach((t, i) => bump(P.interests, t, w * (i === 0 ? 1 : 0.45)));
      if (it.handle && it.kind !== 'community') bump(P.creators, lower(it.handle), w * 1.2);
    }
    if (type === 'follow' && it && it.handle) {
      if (extra && extra.on === false) delete P.follows[lower(it.handle)]; else P.follows[lower(it.handle)] = Date.now();
    }
    save();
  }

  /* Things the app already knows count too, without being stored twice. */
  function implicit() {
    const imp = { topics: {}, creators: {}, rel: {} };
    const add = (m, k, v) => { if (k) m[k] = (m[k] || 0) + v; };
    const sh = (typeof SH !== 'undefined' && SH.state) ? SH.state : {};
    const idx = index();
    Object.keys(sh.liked || {}).forEach(id => { const it = idx.byKey['short:' + id]; if (it) it.topics.forEach(t => add(imp.topics, t, 1.2)); });
    Object.keys(sh.saved || {}).forEach(id => { const it = idx.byKey['short:' + id]; if (it) it.topics.forEach(t => add(imp.topics, t, 1.5)); });
    Object.keys(sh.subs || {}).forEach(h => { add(imp.creators, lower(h), 3); imp.rel[lower(h)] = 'follow'; });
    Object.keys(P.follows).forEach(h => { imp.rel[h] = 'follow'; });
    idx.items.filter(i => i.kind === 'community' && i.joined).forEach(c => { c.topics.slice(0, 2).forEach(t => add(imp.topics, t, 1)); imp.rel['community:' + c.id] = c.title; });
    return imp;
  }

  /* Searches nudge interests, but never more than a third of the total —
     one curious search shouldn't take over the whole feed. */
  function interestVector() {
    const v = {};
    Object.keys(P.interests).forEach(t => { v[t] = decayed(P.interests[t]); });
    const imp = implicit();
    Object.keys(imp.topics).forEach(t => { v[t] = (v[t] || 0) + imp.topics[t]; });
    const fromSearch = {};
    Object.keys(P.searches).forEach(q => {
      const n = Math.min(3, decayed(P.searches[q]));
      classify(q).slice(0, 2).forEach(t => { fromSearch[t] = (fromSearch[t] || 0) + n * 0.6; });
    });
    const pos = Object.values(v).reduce((a, b) => a + Math.max(0, b), 0);
    const sTotal = Object.values(fromSearch).reduce((a, b) => a + b, 0);
    const cap = Math.max(1.5, pos * 0.5);
    const scale = sTotal > cap ? cap / sTotal : 1;
    Object.keys(fromSearch).forEach(t => { v[t] = (v[t] || 0) + fromSearch[t] * scale; });
    const max = Math.max(1, ...Object.values(v).map(x => Math.abs(x)));
    const norm = {};
    Object.keys(v).forEach(t => { norm[t] = v[t] / max; });
    return { topics: norm, creators: imp.creators, rel: imp.rel, mass: pos + sTotal * scale };
  }

  /* ══════════════════════════════════════════════════════════════════
     Safety and eligibility
     ══════════════════════════════════════════════════════════════════ */

  const flagged = {};
  function unsafe(it) {
    if (flagged[it.key] != null) return flagged[it.key];
    let bad = false;
    if (typeof CPM !== 'undefined' && CPM.aiScan && (it.kind === 'post' || it.kind === 'short' || it.kind === 'community')) {
      try { bad = CPM.aiScan(`${it.title} ${it.text}`).score >= 60; } catch (e) { bad = false; }
    }
    return (flagged[it.key] = bad);
  }

  function eligible(it, mode) {
    if (P.reported[it.key]) return false;
    if (it.handle && P.hidden[lower(it.handle)]) return false;
    if (it.me) return false;
    if (it.kind === 'community' && it.c) {
      if (typeof CCR !== 'undefined' && CCR.visible && !CCR.visible(it.c)) return false;
    }
    if (unsafe(it)) return false;
    if (mode === 'discover') {
      if (it.mine) return false;
      if (P.notInterested[it.key]) return false;
      if (it.topics.some(t => P.muted[t])) return false;
    }
    return true;
  }

  /* ══════════════════════════════════════════════════════════════════
     3 · Discover ranking
     ══════════════════════════════════════════════════════════════════ */

  const CHIPS = [
    ['foryou', 'For You', 'auto_awesome'], ['trending', 'Trending', 'local_fire_department'], ['shorts', 'Shorts', 'slow_motion_video'],
    ['communities', 'Communities', 'groups'], ['creators', 'Creators', 'person'], ['crypto', 'Crypto', 'currency_bitcoin'],
    ['gaming', 'Gaming', 'sports_esports'], ['tech', 'Technology', 'memory'], ['music', 'Music', 'music_note'], ['news', 'News', 'newspaper']
  ];

  function candidates(chip) {
    const all = index().items;
    switch (chip) {
      case 'shorts': return all.filter(i => i.kind === 'short');
      case 'communities': return all.filter(i => i.kind === 'community');
      case 'creators': return all.filter(i => i.kind === 'creator');
      case 'news': return all.filter(i => i.kind === 'news' || i.topics[0] === 'news');
      case 'crypto': case 'gaming': case 'tech': case 'music': return all.filter(i => i.topics.indexOf(chip) > -1);
      default: return all;
    }
  }

  function personal(it, iv) {
    let s = 0, why = null, whyW = 0;
    it.topics.forEach((t, i) => {
      const v = (iv.topics[t] || 0) * (i === 0 ? 1 : 0.5);
      s += v;
      if (v > whyW) { whyW = v; why = `Because you're into ${TOPICS[t] ? TOPICS[t][0] : t}`; }
    });
    const h = lower(it.handle);
    const cw = (decayed(P.creators[h]) + (iv.creators[h] || 0)) / 10;
    s += clamp(cw, -1, 1) * 0.8;
    if (iv.rel[h] === 'follow') { s += 0.6; why = `From ${it.handle}, who you follow`; }
    if (it.kind === 'community' && iv.rel['community:' + it.id]) { s -= 0.3; why = 'A community you are in'; }
    const e = P.items[it.key];
    if (e) {
      s -= Math.min(0.6, Math.max(0, e.imp - 2 * e.opens) * 0.08);   // shown a lot, never opened
      if (e.opens && it.kind !== 'community') s -= 0.15;              // already opened
    }
    return { s: clamp(s, -1.5, 1.8), why };
  }

  /* A light thumb on the scale for what a discovery grid is for: short
     video first, then posts and headlines, then places and people. */
  const KIND_PRIOR = { short: 1.2, post: 1, news: 0.93, community: 0.94, creator: 0.86, topic: 0.74 };

  function rankDiscover(chip, seed) {
    const iv = interestVector();
    const usePersonal = P.personalized && iv.mass > 0.5;
    const list = candidates(chip).filter(it => eligible(it, 'discover'));
    const ranked = list.map(it => {
      const p = usePersonal ? personal(it, iv) : { s: 0, why: null };
      const jitter = (unit(seed + it.key) - 0.5) * 0.08;
      let score;
      if (chip === 'trending') score = it.trend * 0.75 + it.quality * 0.15 + it.fresh * 0.1 + (usePersonal ? p.s * 0.08 : 0);
      else if (usePersonal) score = 0.34 * ((p.s + 1.5) / 3.3) + 0.18 * it.quality + 0.13 * it.fresh + 0.13 * it.pop + 0.22 * it.trend;
      else score = 0.4 * it.trend + 0.3 * it.quality + 0.15 * it.fresh + 0.15 * it.pop;
      if (chip === 'foryou' || chip === 'trending') score *= KIND_PRIOR[it.kind] || 1;
      const why = p.why && p.s > 0.2 ? p.why
        : it.hot ? `Trending in ${TOPICS[it.primary] ? TOPICS[it.primary][0] : 'Trending'}`
        : it.kind === 'news' ? `Recent from ${it.source}` : 'Popular on Trending';
      return { it, score: score + jitter, why, interest: usePersonal ? (iv.topics[it.primary] || 0) : 0.5 };
    }).sort((a, b) => b.score - a.score);
    return diversify(ranked, chip === 'foryou' && usePersonal, seed);
  }

  /* Keeps the grid from turning into thirty of the same thing: no creator
     twice in six, no topic more than three times in eight, no kind four in
     a row — and now and then, something outside the usual interests. */
  function diversify(ranked, explore, seed) {
    const out = [];
    const pool = ranked.slice();
    while (pool.length) {
      const pos = out.length;
      let pick = -1;
      if (explore && pos % 9 === 6 && pool.length > 14) {
        const far = pool.slice(10).filter(r => r.interest < 0.15);
        if (far.length) {
          const r = far[Math.floor(unit(seed + pos) * Math.min(5, far.length))];
          pick = pool.indexOf(r);
          r.why = 'Something new for you';
        }
      }
      for (let j = 0; pick < 0 && j < Math.min(pool.length, 14); j++) {
        const it = pool[j].it;
        const recent = out.slice(-8).map(r => r.it);
        const sameCreator = it.handle && recent.slice(-6).some(x => x.handle && lower(x.handle) === lower(it.handle));
        const sameTopic = recent.filter(x => x.primary === it.primary).length >= 3;
        const last3 = recent.slice(-3);
        const sameKind = last3.length === 3 && last3.every(x => x.kind === it.kind);
        if (!sameCreator && !sameTopic && !sameKind) pick = j;
      }
      if (pick < 0) pick = 0;
      out.push(pool.splice(pick, 1)[0]);
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════
     2 · Search ranking — the query leads
     ══════════════════════════════════════════════════════════════════ */

  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let rowMin = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        rowMin = Math.min(rowMin, d[i][j]);
      }
      if (rowMin > max) return max + 1;
    }
    return d[a.length][b.length];
  }
  const allowed = w => w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0;

  /* "footbal" → "football": only for words nothing in the index starts with. */
  function correct(q) {
    const vocab = index().vocab;
    const words = Object.keys(vocab);
    let changed = false;
    const fixed = tokenize(q).map(w => {
      if (vocab[w] || words.some(v => v.startsWith(w))) return w;
      const max = allowed(w);
      if (!max) return w;
      let best = null, bestD = max + 1, bestN = 0;
      words.forEach(v => {
        const dd = editDistance(w, v, max);
        if (dd < bestD || (dd === bestD && vocab[v] > bestN)) { best = v; bestD = dd; bestN = vocab[v]; }
      });
      if (best && bestD <= max) { changed = true; return best; }
      return w;
    });
    return changed ? fixed.join(' ') : null;
  }

  function tokenMatch(q, words) {
    let best = 0;
    for (const w of words) {
      if (w === q) return 1;
      if (q.length >= 2 && w.startsWith(q)) best = Math.max(best, 0.8);
      else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 0.4);
      else if (best < 0.55 && allowed(q) && Math.abs(w.length - q.length) <= allowed(q) && editDistance(q, w, allowed(q)) <= allowed(q)) best = 0.55;
    }
    return best;
  }

  function relevance(it, qt, phrase) {
    const fields = it._fields || (it._fields = [
      [tokenize(it.title), 3], [tokenize(it.handle || ''), 2.5], [tokenize((it.tags || []).join(' ') + ' ' + (it.audio || '')), 2],
      [tokenize(it.creator || ''), 2], [tokenize(it.topics.map(t => TOPICS[t] ? TOPICS[t][0] : '').join(' ')), 1.1], [tokenize(it.text), 1]]);
    let total = 0, hits = 0;
    qt.forEach(({ w, weight, original }) => {
      let best = 0;
      fields.forEach(([words, fw]) => { const m = tokenMatch(w, words); if (m) best = Math.max(best, m * fw); });
      if (best && original) hits++;
      total += best * weight;
    });
    const originals = qt.filter(x => x.original).length || 1;
    let s = total / originals;
    if (hits < originals) s *= 0.35;
    if (phrase.length > 2 && lower(it.title).includes(phrase)) s += 1.5;
    if (lower(it.handle) === '@' + phrase || lower(it.title) === phrase) s += 2.5;
    return s;
  }

  function expand(q) {
    const words = tokenize(q);
    const out = words.map(w => ({ w, weight: 1, original: true }));
    words.forEach(w => (SYNONYMS[w] || []).forEach(s => out.push({ w: s, weight: 0.45, original: false })));
    return out;
  }

  function coinList(q) {
    if (typeof SR === 'undefined' || !SR.coins) return [];
    const t = lower(q).replace(/^[#@$]/, '');
    return SR.coins().filter(c => lower(c.sym).startsWith(t) || lower(c.name).startsWith(t) || lower(c.sym) === t).slice(0, 30);
  }
  function audioList(q) {
    const map = {};
    ((typeof SH !== 'undefined' && SH.all) ? SH.all() : []).forEach(s => {
      const name = s.audio || 'Original audio';
      map[name] = map[name] || { name, count: 0 };
      map[name].count++;
    });
    const qt = tokenize(q);
    return Object.values(map).filter(a => qt.every(w => tokenMatch(w, tokenize(a.name)) >= 0.55));
  }

  function runSearch(qRaw, noFix) {
    let q = String(qRaw || '').trim();
    if (!q) return null;
    const iv = interestVector();
    const doRank = query => {
      const qt = expand(query);
      const phrase = lower(query).replace(/^[#@]/, '');
      return index().items.filter(it => eligible(it, 'search')).map(it => {
        const rel = relevance(it, qt, phrase);
        if (rel < 0.5) return null;
        const p = P.personalized ? personal(it, iv).s : 0;
        return { it, rel, score: 0.62 * Math.min(rel, 6) / 6 + 0.13 * it.quality + 0.1 * it.fresh + 0.15 * ((p + 1.5) / 3.3) };
      }).filter(Boolean).sort((a, b) => b.score - a.score);
    };
    let hits = doRank(q);
    let corrected = null;
    const fix = noFix ? null : correct(q);
    if (fix && fix !== lower(q)) {
      const alt = doRank(fix);
      if (alt.length > hits.length && hits.length < 3) { corrected = { from: q, to: fix }; hits = alt; }
    }
    const of = (...kinds) => hits.filter(h => kinds.indexOf(h.it.kind) > -1).map(h => h.it);
    return {
      q, corrected, all: hits.map(h => h.it),
      accounts: of('creator'), shorts: of('short'), posts: of('post', 'news'), communities: of('community'), topics: of('topic'),
      audio: audioList(corrected ? corrected.to : q), coins: coinList(q)
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     Service boundary
     ══════════════════════════════════════════════════════════════════ */

  const sessions = {};
  const api = {
    /* Pages through one ranked, diversified list per chip and session. */
    discover({ chip = 'foryou', cursor = 0, limit = BATCH, session }) {
      const k = chip + ':' + session;
      if (!sessions[k]) sessions[k] = rankDiscover(chip, session);
      const list = sessions[k];
      const page = list.slice(cursor, cursor + limit);
      return Promise.resolve({ items: page, next: cursor + limit < list.length ? cursor + limit : null, total: list.length });
    },
    search({ q, noFix }) { return Promise.resolve(runSearch(q, noFix)); },
    suggest(q) { return Promise.resolve(suggestions(q)); },
    signal(key, type, extra) { signal(key, type, extra || {}); return Promise.resolve(true); }
  };

  /* ══════════════════════════════════════════════════════════════════
     4 · Layout — tile sizes, not content
     ══════════════════════════════════════════════════════════════════ */

  const PATTERN = { 3: ['row', 'bigL', 'row', 'bigR'], 2: ['row', 'row', 'wide'] };

  function newLayout(cols, uniform) { return { cols, uniform: !!uniform, row: 1, p: 0, pending: [], placed: [] }; }

  /* Places complete blocks only; leftovers wait for the next page so the
     grid never has a hole in it. flush=true at the end of the feed. */
  function place(L, entries, flush) {
    const q = L.pending.concat(entries);
    L.pending = [];
    const out = [];
    const big = e => e.it.visual && (e.it.kind === 'short' || e.it.thumb || e.it.kind === 'community');
    // Large slots go to video when there's one close by, then anything visual.
    const pickBig = win => { const v = win.findIndex(e => e.it.kind === 'short'); return v > -1 ? v : win.findIndex(big); };
    const pos = (e, col, row, cw, rh, size) => { const o = { e, col, row, cw, rh, size }; out.push(o); L.placed.push(o); };
    while (q.length) {
      const blk = L.uniform ? 'row' : PATTERN[L.cols][L.p % PATTERN[L.cols].length];
      if (blk === 'row') {
        if (q.length < L.cols && !flush) break;
        for (let c = 1; c <= L.cols && q.length; c++) pos(q.shift(), c, L.row, 1, 2, 's');
        L.row += 2; L.p++;
        continue;
      }
      const need = L.cols === 3 ? 3 : 1;
      if (q.length < need && !flush) break;
      const bi = pickBig(q.slice(0, 6));
      if (bi < 0 || q.length < need) { L.p++; continue; }
      const bigE = q.splice(bi, 1)[0];
      if (L.cols === 3) {
        const left = blk === 'bigL';
        pos(bigE, left ? 1 : 2, L.row, 2, 4, 'l');
        pos(q.shift(), left ? 3 : 1, L.row, 1, 2, 's');
        pos(q.shift(), left ? 3 : 1, L.row + 2, 1, 2, 's');
        L.row += 4;
      } else {
        pos(bigE, 1, L.row, 2, 3, 'l');
        L.row += 3;
      }
      L.p++;
    }
    L.pending = q;
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════
     Tiles
     ══════════════════════════════════════════════════════════════════ */

  const HUE = { crypto: 36, gaming: 150, tech: 255, music: 300, news: 205, sports: 12, finance: 165, science: 190, creators: 330, life: 25, learning: 45 };

  function tileHTML(o) {
    const { e, size } = o;
    const it = e.it;
    const area = `grid-area:${o.row} / ${o.col} / span ${o.rh} / span ${o.cw}`;
    const more = `<span class="dx-more" role="button" tabindex="0" aria-label="More options" onclick="event.stopPropagation();DX.menu(${A(it.key)})">${ico('more_horiz')}</span>`;
    const hot = it.hot ? `<span class="dx-hot">${ico('local_fire_department')}Trending</span>` : '';
    const label = { short: 'Short video', post: 'Post', community: 'Community', creator: 'Creator', topic: 'Topic', news: 'News' }[it.kind];
    const common = `class="dx-tile dx-k-${it.kind} dx-${size}" style="${area};--h:${HUE[it.primary] || 260}" data-key="${esc(it.key)}"
      onclick="DX.openItem(${A(it.key)})" aria-label="${esc(label + ': ' + it.title)}"`;

    if (it.kind === 'short') {
      const media = it.cover
        ? `<img class="dx-media" src="${esc(it.cover)}" alt="" loading="lazy">`
        : `<video class="dx-media" data-src="${esc(it.src)}" muted loop playsinline preload="none"${it.zoom ? ` style="transform:scale(${it.zoom})"` : ''}></video>`;
      return `<div ${common} role="button" tabindex="0">${media}<span class="dx-shade"></span>
        <span class="dx-kind">${ico('slow_motion_video')}</span>${more}${hot}
        <span class="dx-foot">${ico('play_arrow')}${compact(it.stats.views)}</span></div>`;
    }
    if (it.kind === 'news') {
      return `<div ${common} role="button" tabindex="0">
        ${it.thumb ? `<img class="dx-media" src="${esc(it.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
        <span class="dx-shade strong"></span><span class="dx-kind">${ico('newspaper')}</span>${more}
        <span class="dx-text"><em>${esc(it.source)} · ${ago(it.ageH)}</em><b>${esc(it.title)}</b></span></div>`;
    }
    if (it.kind === 'community') {
      const c = it.c;
      const bg = typeof CCR !== 'undefined' && CCR.bannerCSS ? CCR.bannerCSS(c) : `linear-gradient(135deg, ${c.color}, ${c.color}44)`;
      const icon = typeof CCR !== 'undefined' && CCR.icon ? CCR.icon(c) : ico(esc(c.icon || 'groups'));
      return `<div ${common} role="button" tabindex="0">
        <span class="dx-cban" style="background:${bg}"></span>${more}${hot}
        <span class="dx-cbody"><span class="dx-cico" style="--c:${esc(c.color || '#FCD535')}">${icon}</span>
          <b>${esc(it.title)}</b><em>${compact(it.stats.members)} members · ${compact(it.stats.online)} online</em>
          <span class="dx-cdesc">${esc(c.tagline || c.desc || '')}</span>
          <span class="dx-pill">${it.joined ? ico('check') + 'Joined' : ico('groups') + 'Community'}</span></span></div>`;
    }
    if (it.kind === 'creator') {
      const followed = !!P.follows[lower(it.handle)];
      return `<div ${common} role="button" tabindex="0">${more}
        <span class="dx-person"><span class="dx-av" style="--h:${hash(it.handle) % 360}">${esc(initials(it.title))}</span>
          <b>${esc(it.title)}</b><em>${esc(it.handle)}</em><em>${compact(it.stats.followers)} followers</em>
          <button class="dx-follow${followed ? ' on' : ''}" onclick="event.stopPropagation();DX.follow(${A(it.key)})">${followed ? 'Following' : 'Follow'}</button></span></div>`;
    }
    if (it.kind === 'topic') {
      return `<div ${common} role="button" tabindex="0">${more}${hot}
        <span class="dx-topic"><span class="dx-tico">${it.hashtag ? '#' : ico(TOPICS[it.primary] ? TOPICS[it.primary][1] : 'tag')}</span>
          <b>${esc(it.title)}</b><em>${compact(it.stats.posts)} posts</em></span></div>`;
    }
    // post
    return `<div ${common} role="button" tabindex="0">${more}${hot}
      <span class="dx-post"><span class="dx-quote">${esc(it.text.length > (size === 'l' ? 220 : 110) ? it.text.slice(0, size === 'l' ? 220 : 110) + '…' : it.text)}</span>
        <span class="dx-by"><span class="dx-av sm" style="--h:${hash(it.handle) % 360}">${esc(initials(it.creator))}</span>${esc(it.handle)}</span>
        <span class="dx-stat">${ico('favorite')}${compact(it.stats.likes)}</span></span></div>`;
  }
  const ago = h => h < 1 ? Math.max(1, Math.round(h * 60)) + 'm' : h < 48 ? Math.round(h) + 'h' : Math.round(h / 24) + 'd';

  /* ══════════════════════════════════════════════════════════════════
     Screen
     ══════════════════════════════════════════════════════════════════ */

  let V = null;
  let io = null, videoIO = null, sentinelIO = null, resizeObs = null;
  let typeTimer = null;
  let navWrapped = false;

  function isOpen() { return !!$('dx'); }

  function open(q) {
    buildIndex();
    if (!V) V = { mode: 'discover', chip: 'foryou', q: '', tab: 'top', session: Date.now().toString(36), cursor: 0, done: false, hl: -1 };
    if (!isOpen()) {
      const el = document.createElement('div');
      el.id = 'dx';
      el.className = 'dx';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Discover');
      el.innerHTML = shellHTML();
      document.body.appendChild(el);
      document.body.classList.add('dx-open');
      document.addEventListener('keydown', onKey);
      wireNav();
    }
    const gs = $('global-search');
    if (gs) gs.blur();
    if (q) { $('dx-q').value = q; submit(q); }
    else {
      V.mode = 'discover';
      paint();
      // On a desktop the caret waits in the field, but the grid stays until you type.
      if (window.matchMedia && matchMedia('(pointer: fine)').matches) { V.quietFocus = true; $('dx-q').focus(); }
    }
    refreshNews();
  }

  function close() {
    const el = $('dx');
    [io, videoIO, sentinelIO].forEach(o => o && o.disconnect());
    if (resizeObs) resizeObs.disconnect();
    io = videoIO = sentinelIO = resizeObs = null;
    if (el) { el.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); }); el.remove(); }
    document.body.classList.remove('dx-open');
    document.removeEventListener('keydown', onKey);
    if (V) { V.mode = 'discover'; V.q = ''; }
    closeMenu();
    save(true);
  }

  function refreshNews() {
    if (typeof window.fetchCryptoNews !== 'function') return;
    window.fetchCryptoNews(24).then(list => {
      if (!Array.isArray(list) || !list.length) return;
      const had = news.length;
      news = list;
      if (!had) { buildIndex(); Object.keys(sessions).forEach(k => delete sessions[k]); if (V && V.mode === 'discover' && V.chip === 'news') paint(); }
    }).catch(() => {});
  }

  function shellHTML() {
    return `
      <div class="dx-wrap">
        <header class="dx-head">
          <button class="dx-ib" onclick="DX.back()" aria-label="Back">${ico('arrow_back')}</button>
          <label class="dx-field">${ico('search')}
            <input id="dx-q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="Search Trending"
              oninput="DX.type(this.value)" onfocus="DX.focus()" onkeydown="DX.keys(event)" aria-label="Search Trending">
            <button class="dx-clear" onclick="DX.clear()" aria-label="Clear search">${ico('cancel')}</button>
          </label>
          <button class="dx-cancel" onclick="DX.cancel()">Cancel</button>
          <button class="dx-ib" onclick="DX.openSettings()" aria-label="Tune Discover" title="Tune Discover">${ico('tune')}</button>
        </header>
        <div class="dx-body" id="dx-body"></div>
      </div>`;
  }

  function setHeadState() {
    const el = $('dx');
    if (!el) return;
    el.classList.toggle('typing', V.mode !== 'discover');
    const inp = $('dx-q');
    el.classList.toggle('has-q', !!(inp && inp.value));
  }

  function paint() {
    const body = $('dx-body');
    if (!body || !V) return;
    setHeadState();
    [io, videoIO, sentinelIO].forEach(o => o && o.disconnect());
    io = videoIO = sentinelIO = null;
    if (V.mode === 'suggest') { paintSuggest(); return; }
    if (V.mode === 'results') { paintResults(); return; }
    V.cursor = 0; V.done = false; V.layout = null;
    body.innerHTML = `
      <div class="dx-chips" role="tablist">${CHIPS.map(([k, l, i]) => `<button class="dx-chip${V.chip === k ? ' on' : ''}" role="tab" aria-selected="${V.chip === k}"
        onclick="DX.chip('${k}')">${ico(i)}${l}</button>`).join('')}</div>
      ${V.chip === 'foryou' ? onboardHTML() : ''}
      <div class="dx-grid" id="dx-grid"></div>
      <div class="dx-sentinel" id="dx-sentinel"><span class="dx-spin"></span></div>
      <div id="dx-end"></div>`;
    body.scrollTop = 0;
    setupGrid($('dx-grid'), false);
    loadMore();
  }

  /* Cold start: a handful of taps gives For You something to work with. */
  function onboardHTML() {
    const iv = interestVector();
    if (P.onboarded || iv.mass > 3) return '';
    return `<section class="dx-onboard" id="dx-onboard">
      <div><b>Tune your For You</b><span>Pick a few topics. Watching, liking and searching keep tuning it after that.</span></div>
      <div class="dx-chipset">${Object.keys(TOPICS).map(t => `<button class="dx-chip sm${decayed(P.interests[t]) >= 3 ? ' on' : ''}" onclick="DX.pickTopic('${t}',this)">${ico(TOPICS[t][1])}${TOPICS[t][0]}</button>`).join('')}</div>
      <button class="dx-link" onclick="DX.doneOnboard()">Done</button>
    </section>`;
  }

  function setupGrid(grid, uniform) {
    if (!grid) return;
    const cols = () => (grid.clientWidth || window.innerWidth) < 560 ? 2 : 3;
    const sizeRows = () => {
      const gw = grid.clientWidth || window.innerWidth;
      const c = uniform ? (gw < 560 ? 3 : gw < 900 ? 4 : 5) : cols();
      const w = grid.clientWidth || 600;
      grid.style.setProperty('--cols', c);
      grid.style.setProperty('--unit', ((w - (c - 1) * 3) / c * (uniform ? 0.89 : 0.6)) + 'px');
      return c;
    };
    grid._layout = newLayout(sizeRows(), uniform);
    if (resizeObs) resizeObs.disconnect();
    resizeObs = new ResizeObserver(() => {
      const c = sizeRows();
      if (!grid._layout || c === grid._layout.cols) return;
      // Breakpoint crossed: lay the same items out again.
      const entries = grid._layout.placed.map(o => o.e).concat(grid._layout.pending);
      grid._layout = newLayout(c, uniform);
      grid.innerHTML = '';
      appendTiles(grid, entries, !!(V && V.done) || uniform);
    });
    resizeObs.observe(grid);
  }

  function appendTiles(grid, entries, flush) {
    const placed = place(grid._layout, entries, flush);
    grid.insertAdjacentHTML('beforeend', placed.map(tileHTML).join(''));
    const rows = grid._layout.row - 1;
    grid.style.gridTemplateRows = `repeat(${Math.max(rows, 1)}, var(--unit))`;
    watchTiles(grid);
  }

  async function loadMore() {
    if (!V || V.mode !== 'discover' || V.loading || V.done) return;
    V.loading = true;
    const chip = V.chip;
    const page = await api.discover({ chip, cursor: V.cursor, session: V.session });
    V.loading = false;
    if (!V || V.mode !== 'discover' || V.chip !== chip) return;
    const grid = $('dx-grid');
    if (!grid) return;
    V.cursor += page.items.length;
    V.done = page.next == null;
    appendTiles(grid, page.items, V.done);
    const sent = $('dx-sentinel');
    if (V.done) {
      if (sent) sent.hidden = true;
      const end = $('dx-end');
      if (end) end.innerHTML = page.total ? `<div class="dx-endcard">${ico('task_alt')}<b>You're all caught up</b>
        <span>That's everything we'd recommend right now. New posts, shorts and headlines show up here as they arrive.</span>
        <button class="btn btn-primary btn-sm" onclick="DX.refresh()">${ico('refresh')}Refresh recommendations</button></div>`
        : `<div class="dx-endcard">${ico('explore_off')}<b>Nothing to show here</b><span>Try another category, or unmute a topic from the tune button.</span></div>`;
    } else if (sent) {
      if (!sentinelIO) sentinelIO = new IntersectionObserver(en => { if (en.some(x => x.isIntersecting)) loadMore(); }, { root: $('dx-body'), rootMargin: '700px 0px' });
      // Re-observing reports the current state, so a marker that never
      // left the screen still asks for the next page.
      sentinelIO.unobserve(sent);
      sentinelIO.observe(sent);
    }
  }

  /* Impressions after a second on screen; video tiles fetch their first
     frame only when they come near the viewport, and at most one large
     tile plays (muted) at a time. */
  function watchTiles(root) {
    const body = $('dx-body');
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!io) io = new IntersectionObserver(en => en.forEach(x => {
      const t = x.target;
      if (x.isIntersecting) {
        const v = t.querySelector('video[data-src]');
        if (v && !v.getAttribute('src')) { v.src = v.dataset.src + '#t=0.5'; v.preload = 'metadata'; }
        if (!t._seen) t._seenTimer = setTimeout(() => { t._seen = true; signal(t.dataset.key, 'impression'); }, 1000);
      } else clearTimeout(t._seenTimer);
    }), { root: body, rootMargin: '250px 0px', threshold: 0.5 });
    if (!videoIO) videoIO = new IntersectionObserver(en => en.forEach(x => {
      const v = x.target.querySelector('video');
      if (!v) return;
      if (x.isIntersecting && x.intersectionRatio >= 0.7 && !saveData && !calm) {
        root.querySelectorAll('.dx-l video').forEach(o => { if (o !== v) o.pause(); });
        if (!v.getAttribute('src')) v.src = v.dataset.src;
        v.play().catch(() => {});
      } else v.pause();
    }), { root: body, threshold: [0, 0.7] });
    root.querySelectorAll('.dx-tile:not([data-w])').forEach(t => {
      t.dataset.w = '1';
      io.observe(t);
      if (t.classList.contains('dx-l') && t.classList.contains('dx-k-short')) videoIO.observe(t);
      const v = t.querySelector('video');
      if (v && !saveData) {
        t.addEventListener('mouseenter', () => { if (!v.getAttribute('src')) v.src = v.dataset.src; v.play().catch(() => {}); });
        t.addEventListener('mouseleave', () => { if (!t.classList.contains('dx-l')) { v.pause(); try { v.currentTime = 0.5; } catch (er) {} } });
      }
      t.addEventListener('keydown', ev => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        if (ev.target !== t) { if (ev.target.classList.contains('dx-more')) { ev.preventDefault(); ev.target.click(); } return; }
        ev.preventDefault(); t.click();
      });
    });
  }

  function wireNav() {
    if (navWrapped || typeof window.navigateTo !== 'function') return;
    navWrapped = true;
    const nav = window.navigateTo;
    // Going anywhere else in the app leaves Discover.
    window.navigateTo = function () { if (isOpen()) close(); return nav.apply(this, arguments); };
  }

  /* ── Chips and refresh ─────────────────────────────────────────── */
  function chip(k) {
    if (!V) return;
    if (V.chip === k && V.mode === 'discover') { refresh(); return; }
    V.chip = k;
    paint();
  }
  function refresh() {
    if (!V) return;
    Object.keys(sessions).forEach(k => delete sessions[k]);
    V.session = Date.now().toString(36);
    buildIndex();
    paint();
  }
  function pickTopic(t, btn) {
    const on = decayed(P.interests[t]) >= 3;
    P.interests[t] = { w: on ? 0 : 4, t: Date.now() };
    if (btn) btn.classList.toggle('on', !on);
    save();
  }
  function doneOnboard() {
    P.onboarded = true;
    save(true);
    refresh();
  }

  /* ── Opening things ────────────────────────────────────────────── */
  function openItem(key) {
    const it = index().byKey[key];
    if (!it) return;
    signal(key, 'open');
    if (it.kind === 'short') { play(key); return; }
    if (it.kind === 'news') {
      if (/^https:\/\//.test(it.url || '')) window.open(it.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (it.kind === 'topic') {
      $('dx-q').value = it.title;
      submit(it.title);
      return;
    }
    if (it.kind === 'creator') {
      if (!(typeof SR !== 'undefined' && SR.show && SR.show('account', it.handle))) toast(`${it.title}'s profile isn't available yet.`);
      return;
    }
    if (it.kind === 'community') {
      close();
      if (typeof navigateTo === 'function') navigateTo('community');
      setTimeout(() => { if (typeof HUB !== 'undefined' && HUB.open) HUB.open(it.id); }, 160);
      return;
    }
    if (it.kind === 'post' && typeof SR !== 'undefined' && SR.openPost) { close(); SR.openPost(it.id); }
  }

  /* A tapped short opens the vertical player with the next best shorts
     queued behind it, and more are fetched as you near the end. */
  function play(key) {
    if (typeof SH === 'undefined' || !SH.openAt) return;
    const start = index().byKey[key];
    const ranked = rankDiscover('shorts', V ? V.session : 'p').map(r => r.it).filter(it => it.key !== key);
    const toShort = it => SH.byId ? SH.byId(it.id) : null;
    const list = [start].concat(ranked).map(toShort).filter(Boolean);
    if (!list.length) return;
    SH.openAt(0, list, { more: seen => nextShorts(seen) });
  }

  function nextShorts(seen) {
    const pool = rankDiscover('shorts', Date.now().toString(36)).map(r => r.it);
    if (pool.length < 2) return [];
    const recent = seen.slice(-Math.min(pool.length - 1, 4)).map(s => s.id);
    return pool.filter(it => recent.indexOf(it.id) < 0).slice(0, 4).map(it => SH.byId(it.id)).filter(Boolean);
  }

  function follow(key) {
    const it = index().byKey[key];
    if (!it) return;
    const on = !P.follows[lower(it.handle)];
    signal(key, 'follow', { on });
    document.querySelectorAll(`.dx-tile[data-key="${CSS.escape(key)}"] .dx-follow`).forEach(b => { b.classList.toggle('on', on); b.textContent = on ? 'Following' : 'Follow'; });
    toast(on ? `Following ${it.title}` : `Unfollowed ${it.title}`);
  }

  /* ── Search: typing, suggestions, results ──────────────────────── */
  function focus() {
    if (!V) return;
    if (V.quietFocus) { V.quietFocus = false; return; }
    if (V.mode !== 'suggest') { V.mode = 'suggest'; V.hl = -1; paint(); }
  }
  function type(value) {
    if (!V) return;
    V.q = value;
    V.mode = 'suggest';
    V.hl = -1;
    setHeadState();
    clearTimeout(typeTimer);
    typeTimer = setTimeout(paint, 90);
  }
  function clear() {
    const inp = $('dx-q');
    if (inp) { inp.value = ''; inp.focus(); }
    V.q = '';
    V.mode = 'suggest';
    paint();
  }
  function cancel() {
    const inp = $('dx-q');
    if (inp) { inp.value = ''; inp.blur(); }
    V.q = '';
    V.mode = 'discover';
    paint();
  }
  function back() {
    if (!V) { close(); return; }
    if (V.mode !== 'discover') { cancel(); return; }
    close();
  }
  function keys(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); const rows = document.querySelectorAll('.dx-sg[data-act]'); if (V.hl >= 0 && rows[V.hl]) rows[V.hl].click(); else submit(ev.target.value); return; }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      const rows = document.querySelectorAll('.dx-sg[data-act]');
      if (!rows.length) return;
      ev.preventDefault();
      V.hl = (V.hl + (ev.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      rows.forEach((r, i) => r.classList.toggle('hl', i === V.hl));
      rows[V.hl].scrollIntoView({ block: 'nearest' });
    }
  }
  function onKey(e) {
    if (!isOpen() || document.getElementById('sh-viewer') || document.getElementById('sr-overlay')) return;
    if (e.key === 'Escape') { e.preventDefault(); if ($('dx-menu')) closeMenu(); else back(); }
  }

  function submit(q) {
    q = String(q == null ? V.q : q).trim();
    if (!q) return;
    V.q = q;
    V.mode = 'results';
    V.tab = 'top';
    const inp = $('dx-q');
    if (inp) { inp.value = q; inp.blur(); }
    if (typeof SR !== 'undefined' && SR.remember) SR.remember(q);
    bump(P.searches, lower(q), 1);
    save();
    paint();
  }
  function tab(t) { if (V) { V.tab = t; paint(); } }

  const recent = () => (typeof SR !== 'undefined' && SR.state && SR.state.recent) ? SR.state.recent : [];

  function suggestions(qRaw) {
    const q = String(qRaw || '').trim();
    const out = { recent: [], didYouMean: null, queries: [], entities: [], related: [], trending: [] };
    if (!q) {
      out.recent = recent().slice(0, 8);
      const idx = index();
      out.trending = idx.items.filter(i => i.kind === 'topic' && eligible(i, 'search')).sort((a, b) => b.trend - a.trend).slice(0, 6).map(i => i.title);
      return out;
    }
    const lq = lower(q);
    out.recent = recent().filter(r => lower(r).startsWith(lq) && lower(r) !== lq).slice(0, 3);
    const fix = correct(q);
    if (fix && fix !== lq) out.didYouMean = fix;
    const r = runSearch(q) || { all: [] };
    out.entities = r.all.filter(it => it.kind === 'creator' || it.kind === 'community' || it.kind === 'topic').slice(0, 6);
    // Completions: names, tags and topic labels that start with what's typed.
    const phrases = {};
    index().items.forEach(it => {
      [it.title, ...(it.tags || []).map(t => '#' + t)].forEach(p => {
        const lp = lower(p);
        if (lp.length < 60 && (lp.startsWith(lq) || lp.replace(/^#/, '').startsWith(lq)) && lp !== lq) phrases[p] = Math.max(phrases[p] || 0, it.pop + it.trend);
      });
    });
    Object.keys(TOPICS).forEach(t => { const l = TOPICS[t][0]; if (lower(l).startsWith(lq) && lower(l) !== lq) phrases[l] = 2; });
    out.queries = Object.keys(phrases).sort((a, b) => phrases[b] - phrases[a]).slice(0, 4);
    // Related: other words from the same topic, plus synonyms. A half-typed
    // word counts as whichever topic words it starts.
    const typed = tokenize(fix || q).map(w => WORDS[w] || SYNONYMS[w] || w.length < 3 ? w : (Object.keys(WORDS).find(k => k.startsWith(w)) || w));
    const topics = classify(typed.join(' ')).slice(0, 1);
    const rel = new Set();
    typed.forEach(w => (SYNONYMS[w] || []).forEach(s => rel.add(s)));
    topics.forEach(t => TOPICS[t][2].split(' ').filter(w => w.length > 3 && !lq.includes(w)).slice(0, 6).forEach(w => rel.add(w)));
    out.related = [...rel].filter(w => w !== lq && typed.indexOf(w) < 0).slice(0, 6);
    return out;
  }

  function sgRow(act, arg, icon, main, sub, extra) {
    return `<div class="dx-sg" data-act role="option" onclick="DX.${act}(${A(arg)})">
      <span class="dx-sgi">${icon}</span><span class="dx-sgm"><b>${main}</b>${sub ? `<em>${sub}</em>` : ''}</span>${extra || ''}</div>`;
  }

  function entityIcon(it) {
    if (it.kind === 'community' && it.c) return `<span class="dx-cico sm" style="--c:${esc(it.c.color || '#FCD535')}">${typeof CCR !== 'undefined' && CCR.icon ? CCR.icon(it.c) : ico(esc(it.c.icon || 'groups'))}</span>`;
    if (it.kind === 'creator') return `<span class="dx-av sm" style="--h:${hash(it.handle) % 360}">${esc(initials(it.title))}</span>`;
    return `<span class="dx-tico sm">${it.hashtag ? '#' : ico(TOPICS[it.primary] ? TOPICS[it.primary][1] : 'tag')}</span>`;
  }

  async function paintSuggest() {
    const body = $('dx-body');
    const q = V.q.trim();
    const s = await api.suggest(q);
    if (!V || V.mode !== 'suggest' || V.q.trim() !== q) return;
    if (!q) {
      body.innerHTML = `
        ${s.recent.length ? `<div class="dx-sec">Recent searches<button class="dx-link" onclick="DX.clearRecent()">Clear all</button></div>
          ${s.recent.map((r, i) => sgRow('submit', r, ico('history'), esc(r), '', `<button class="dx-x" onclick="event.stopPropagation();DX.forget(${i})" aria-label="Remove ${esc(r)}">${ico('close')}</button>`)).join('')}` : ''}
        ${s.trending.length ? `<div class="dx-sec">Trending searches</div>${s.trending.map(t => sgRow('submit', t, ico('trending_up'), esc(t), '')).join('')}` : ''}`;
      return;
    }
    body.innerHTML = `
      ${sgRow('submit', q, ico('search'), `Search for “${esc(q)}”`, '')}
      ${s.didYouMean ? sgRow('submit', s.didYouMean, ico('spellcheck'), `Did you mean <u>${esc(s.didYouMean)}</u>?`, '') : ''}
      ${s.recent.map(r => sgRow('submit', r, ico('history'), esc(r), 'Recent')).join('')}
      ${s.queries.map(p => sgRow('submit', p, ico('north_west'), esc(p), '')).join('')}
      ${s.entities.length ? `<div class="dx-sec">Accounts, communities and topics</div>${s.entities.map(it => sgRow('openItem', it.key, entityIcon(it), esc(it.title),
        it.kind === 'creator' ? `${esc(it.handle)} · ${compact(it.stats.followers)} followers` : it.kind === 'community' ? `Community · ${compact(it.stats.members)} members` : `Topic · ${compact(it.stats.posts)} posts`)).join('')}` : ''}
      ${s.related.length ? `<div class="dx-sec">Related</div><div class="dx-chipset pad">${s.related.map(w => `<button class="dx-chip sm" onclick="DX.submit(${A(w)})">${ico('search')}${esc(w)}</button>`).join('')}</div>` : ''}`;
  }

  const TABS = [['top', 'Top'], ['accounts', 'Accounts'], ['shorts', 'Shorts'], ['posts', 'Posts'], ['communities', 'Communities'], ['topics', 'Topics'], ['audio', 'Audio'], ['coins', 'Coins']];

  async function paintResults() {
    const body = $('dx-body');
    const r = await api.search({ q: V.q, noFix: V.exactQ === V.q });
    if (!V || V.mode !== 'results' || !r) return;
    const count = k => k === 'top' ? r.all.length + r.coins.length + r.audio.length : (r[k] || []).length;
    const empty = `<div class="dx-empty">${ico('search_off')}<b>No results for “${esc(r.q)}”</b><span>Check the spelling, or try a creator, a #tag, a community or a coin.</span></div>`;
    let content = '';
    const rows = (list, fn) => list.length ? list.map(fn).join('') : empty;
    switch (V.tab) {
      case 'accounts': content = rows(r.accounts, accountRow); break;
      case 'shorts': content = r.shorts.length ? '<div class="dx-grid uniform" id="dx-rgrid"></div>' : empty; break;
      case 'posts': content = rows(r.posts, postRow); break;
      case 'communities': content = rows(r.communities, communityRow); break;
      case 'topics': content = rows(r.topics, topicRow); break;
      case 'audio': content = rows(r.audio, audioRow); break;
      case 'coins': content = rows(r.coins, coinRow); break;
      default: {
        const parts = [];
        const sec = (title, tabKey, html, more) => `<div class="dx-sec">${title}${more ? `<button class="dx-link" onclick="DX.tab('${tabKey}')">See all</button>` : ''}</div>${html}`;
        // Sections follow the strongest match of each kind, not a fixed order.
        const firstKind = r.all.length ? r.all[0].kind : '';
        const order = ['creator', 'short', 'community', 'post', 'news', 'topic'].sort((a, b) => (a === firstKind ? -1 : 0) - (b === firstKind ? -1 : 0));
        order.forEach(k => {
          if (k === 'creator' && r.accounts.length) parts.push(sec('Accounts', 'accounts', r.accounts.slice(0, 3).map(accountRow).join(''), r.accounts.length > 3));
          if (k === 'short' && r.shorts.length) parts.push(sec('Shorts', 'shorts', '<div class="dx-grid uniform" id="dx-rgrid"></div>', r.shorts.length > 6));
          if (k === 'community' && r.communities.length) parts.push(sec('Communities', 'communities', r.communities.slice(0, 3).map(communityRow).join(''), r.communities.length > 3));
          if (k === 'post' && r.posts.length) parts.push(sec('Posts and news', 'posts', r.posts.slice(0, 3).map(postRow).join(''), r.posts.length > 3));
          if (k === 'topic' && r.topics.length) parts.push(sec('Topics', 'topics', r.topics.slice(0, 3).map(topicRow).join(''), r.topics.length > 3));
        });
        if (r.audio.length) parts.push(sec('Audio', 'audio', r.audio.slice(0, 2).map(audioRow).join(''), r.audio.length > 2));
        if (r.coins.length) parts.push(sec('Coins', 'coins', r.coins.slice(0, 3).map(coinRow).join(''), r.coins.length > 3));
        content = parts.join('') || empty;
      }
    }
    body.innerHTML = `
      <div class="dx-tabs" role="tablist">${TABS.map(([k, l]) => { const n = count(k); return `<button class="dx-tab${V.tab === k ? ' on' : ''}${n ? '' : ' empty'}" role="tab" aria-selected="${V.tab === k}" onclick="DX.tab('${k}')">${l}${n && k !== 'top' ? `<i>${n}</i>` : ''}</button>`; }).join('')}</div>
      ${r.corrected ? `<p class="dx-fix">Showing results for <b>${esc(r.corrected.to)}</b>. <button class="dx-link" onclick="DX.exact(${A(r.corrected.from)})">Search instead for ${esc(r.corrected.from)}</button></p>` : ''}
      <div class="dx-results">${content}</div>`;
    body.scrollTop = 0;
    const g = $('dx-rgrid');
    if (g) {
      setupGrid(g, true);
      appendTiles(g, (V.tab === 'shorts' ? r.shorts : r.shorts.slice(0, 6)).map(it => ({ it, why: 'Matches your search' })), true);
    }
  }

  /* Search again without spelling correction. */
  function exact(q) {
    V.q = q;
    V.exactQ = q;
    const inp = $('dx-q');
    if (inp) inp.value = q;
    paint();
  }

  function accountRow(it) {
    const followed = !!P.follows[lower(it.handle)];
    return `<div class="dx-row" onclick="DX.openItem(${A(it.key)})">${entityIcon(it).replace('dx-av sm', 'dx-av md')}
      <span class="dx-rm"><b>${esc(it.title)}${it.role === 'creator' ? '<i class="dx-badge">Creator</i>' : ''}</b><em>${esc(it.handle)} · ${compact(it.stats.followers)} followers</em></span>
      <button class="dx-follow${followed ? ' on' : ''}" onclick="event.stopPropagation();DX.follow(${A(it.key)})">${followed ? 'Following' : 'Follow'}</button></div>`;
  }
  function communityRow(it) {
    return `<div class="dx-row" onclick="DX.openItem(${A(it.key)})">${entityIcon(it).replace('dx-cico sm', 'dx-cico md')}
      <span class="dx-rm"><b>${esc(it.title)}</b><em>${compact(it.stats.members)} members · ${compact(it.stats.online)} online${it.c && it.c.tagline ? ' · ' + esc(it.c.tagline) : ''}</em></span>
      <span class="dx-pill ${it.joined ? 'on' : ''}">${it.joined ? 'Joined' : 'Open'}</span></div>`;
  }
  function postRow(it) {
    if (it.kind === 'news') {
      return `<div class="dx-row" onclick="DX.openItem(${A(it.key)})">${it.thumb ? `<img class="dx-thumb" src="${esc(it.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="dx-tico md">${ico('newspaper')}</span>`}
        <span class="dx-rm"><b class="clamp2">${esc(it.title)}</b><em>${esc(it.source)} · ${ago(it.ageH)} ago · opens in a new tab</em></span>${ico('open_in_new', 'dx-dim')}</div>`;
    }
    return `<div class="dx-row" onclick="DX.openItem(${A(it.key)})"><span class="dx-av md" style="--h:${hash(it.handle) % 360}">${esc(initials(it.creator))}</span>
      <span class="dx-rm"><b>${esc(it.creator)} <i class="dx-dim">${esc(it.handle)}</i></b><em class="clamp2">${esc(it.text)}</em></span>
      <span class="dx-stat">${ico('favorite')}${compact(it.stats.likes)}</span></div>`;
  }
  function topicRow(it) {
    return `<div class="dx-row" onclick="DX.openItem(${A(it.key)})">${entityIcon(it).replace('dx-tico sm', 'dx-tico md')}
      <span class="dx-rm"><b>${esc(it.title)}</b><em>${compact(it.stats.posts)} posts${it.hot ? ' · trending' : ''}</em></span>${ico('chevron_right', 'dx-dim')}</div>`;
  }
  function audioRow(a) {
    return `<div class="dx-row" onclick="SR.show('track', ${A(a.name)})"><span class="dx-tico md music">${ico('music_note')}</span>
      <span class="dx-rm"><b>${esc(a.name)}</b><em>${a.count} short${a.count === 1 ? '' : 's'}</em></span>${ico('chevron_right', 'dx-dim')}</div>`;
  }
  function coinRow(c) {
    const up = (c.ch || 0) >= 0;
    const icon = typeof coinIcon === 'function' ? coinIcon(c.sym, 32) : `<span class="dx-tico md">${ico('toll')}</span>`;
    return `<div class="dx-row" onclick="DX.coin(${A(c.sym)})"><span class="dx-coin">${icon}</span>
      <span class="dx-rm"><b>${esc(c.sym)}</b><em>${esc(c.name)}</em></span>
      <span class="dx-price"><b>$${(c.px || 0).toLocaleString('en-US', { maximumFractionDigits: c.px < 1 ? 6 : 2 })}</b><em class="${up ? 'tc-green' : 'tc-red'}">${up ? '+' : ''}${(c.ch || 0).toFixed(2)}%</em></span></div>`;
  }
  function coin(sym) { close(); if (typeof SR !== 'undefined' && SR.openCoin) SR.openCoin(sym); }

  function forget(i) { if (typeof SR !== 'undefined' && SR.forget) SR.forget(i); paint(); }
  function clearRecent() { if (typeof SR !== 'undefined' && SR.clearRecent) SR.clearRecent(); paint(); }

  /* ══════════════════════════════════════════════════════════════════
     Feedback: the ⋯ menu on tiles and in the video player
     ══════════════════════════════════════════════════════════════════ */

  function closeMenu() { const m = $('dx-menu'); if (m) m.remove(); }

  function menu(key, fromPlayer) {
    const it = (INDEX || buildIndex()).byKey[key];
    if (!it) return;
    closeMenu();
    const reason = explain(it);
    const topic = TOPICS[it.primary] ? TOPICS[it.primary][0] : it.primary;
    const m = document.createElement('div');
    m.id = 'dx-menu';
    m.className = 'dx-scrim';
    m.innerHTML = `<div class="dx-sheet" role="dialog" aria-label="Options">
      <header><b class="clamp1">${esc(it.title)}</b><button class="dx-ib" onclick="DX.closeMenu()" aria-label="Close">${ico('close')}</button></header>
      <p class="dx-why">${ico('info')}<span><b>Why you're seeing this</b>${esc(reason)}</span></p>
      ${window.NT && (it.kind === 'post' || it.kind === 'short' || it.kind === 'community') ? `<button class="dx-opt" onclick="DX.closeMenu(); NT.fromContent(${A(it.kind)}, ${A(it.id)})">${ico('sticky_note_2')}<span><b>Add a Note</b><em>Share a short note about this with your friends</em></span></button>` : ''}
      <button class="dx-opt" onclick="DX.feedback(${A(key)},'notInterested',${!!fromPlayer})">${ico('thumb_down')}<span><b>Not interested</b><em>See fewer posts like this</em></span></button>
      ${it.handle && it.kind !== 'community' ? `<button class="dx-opt" onclick="DX.feedback(${A(key)},'hide',${!!fromPlayer})">${ico('person_off')}<span><b>Hide ${esc(it.handle)}</b><em>Nothing from this account in Discover</em></span></button>` : ''}
      <button class="dx-opt" onclick="DX.feedback(${A(key)},'mute',${!!fromPlayer})">${ico('visibility_off')}<span><b>Mute ${esc(topic)}</b><em>Stop recommending this topic. Search still finds it.</em></span></button>
      <button class="dx-opt danger" onclick="DX.reportMenu(${A(key)},${!!fromPlayer})">${ico('flag')}<span><b>Report</b><em>Spam, scams, harassment or something that shouldn't be here</em></span></button>
    </div>`;
    m.addEventListener('click', e => { if (e.target === m) closeMenu(); });
    document.body.appendChild(m);
  }

  function explain(it) {
    const iv = interestVector();
    const p = P.personalized && iv.mass > 0.5 ? personal(it, iv) : { s: 0, why: null };
    if (p.why && p.s > 0.2) return p.why + '.';
    if (it.hot) return `It's gaining attention quickly in ${TOPICS[it.primary] ? TOPICS[it.primary][0] : 'Trending'}.`;
    if (!P.personalized) return 'Personalisation is off, so Discover shows what is popular and recent.';
    return 'It is popular on Trending and different from what you usually see.';
  }

  function reportMenu(key, fromPlayer) {
    const sheet = document.querySelector('#dx-menu .dx-sheet');
    if (!sheet) return;
    const reasons = [['spam', 'Spam or scam', 'report'], ['misleading', 'False or misleading', 'fact_check'], ['harassment', 'Harassment or hate', 'front_hand'],
      ['violence', 'Violence or dangerous acts', 'dangerous'], ['adult', 'Nudity or sexual content', 'no_adult_content'], ['other', 'Something else', 'more_horiz']];
    sheet.innerHTML = `<header><b>Why are you reporting this?</b><button class="dx-ib" onclick="DX.closeMenu()" aria-label="Close">${ico('close')}</button></header>
      ${reasons.map(([k, l, i]) => `<button class="dx-opt" onclick="DX.feedback(${A(key)},'report',${!!fromPlayer},'${k}')">${ico(i)}<span><b>${l}</b></span></button>`).join('')}
      <p class="dx-note">Reports are kept on this device and hide the item from your Discover. Sending them to a moderation team needs the app's server.</p>`;
  }

  function feedback(key, kind, fromPlayer, reason) {
    const it = index().byKey[key];
    if (!it) return;
    const undo = { key, kind, handle: lower(it.handle), topic: it.primary };
    if (kind === 'notInterested') { P.notInterested[key] = Date.now(); signal(key, 'notInterested'); }
    if (kind === 'hide' && it.handle) { P.hidden[lower(it.handle)] = Date.now(); bump(P.creators, lower(it.handle), -8); }
    if (kind === 'mute') { P.muted[it.primary] = Date.now(); }
    if (kind === 'report') { P.reported[key] = reason || 'other'; P.notInterested[key] = Date.now(); }
    save(true);
    closeMenu();
    Object.keys(sessions).forEach(k => delete sessions[k]);
    const msg = { notInterested: "Got it — you'll see fewer posts like this.", hide: `${it.handle} is hidden from Discover.`,
      mute: `${TOPICS[it.primary] ? TOPICS[it.primary][0] : 'That topic'} is muted.`, report: 'Thanks for reporting. It is hidden from your Discover.' }[kind];
    if (fromPlayer) {
      toast(msg);
      if (typeof SH !== 'undefined' && SH.go) SH.go(1);
      return;
    }
    // In the grid the tile keeps its slot, so nothing jumps.
    const affected = [...document.querySelectorAll('#dx .dx-tile')].filter(t => {
      const x = index().byKey[t.dataset.key];
      if (!x) return false;
      return t.dataset.key === key || (kind === 'hide' && lower(x.handle) === undo.handle) || (kind === 'mute' && x.topics.indexOf(undo.topic) > -1);
    });
    affected.forEach(t => {
      t.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); });
      t.classList.add('dx-gone');
      t.removeAttribute('onclick');
      t.innerHTML = `<span class="dx-goneb">${ico('check_circle')}<em>${esc(msg)}</em>${t.dataset.key === key ? `<button class="dx-link" onclick="event.stopPropagation();DX.undo(${A(undo)})">Undo</button>` : ''}</span>`;
    });
    if (!affected.length) toast(msg);
  }

  function undo(u) {
    if (u.kind === 'notInterested' || u.kind === 'report') { delete P.notInterested[u.key]; delete P.reported[u.key]; bump(P.interests, u.topic, 3); }
    if (u.kind === 'hide') { delete P.hidden[u.handle]; bump(P.creators, u.handle, 8); }
    if (u.kind === 'mute') delete P.muted[u.topic];
    save(true);
    Object.keys(sessions).forEach(k => delete sessions[k]);
    toast('Undone');
    if (V && V.mode === 'discover') paint();
  }

  /* ── Tune Discover: see and control what it has learned ────────── */
  function openSettings() {
    closeMenu();
    const iv = interestVector();
    const top = Object.keys(iv.topics).filter(t => iv.topics[t] > 0.05 && TOPICS[t]).sort((a, b) => iv.topics[b] - iv.topics[a]).slice(0, 8);
    const muted = Object.keys(P.muted);
    const hidden = Object.keys(P.hidden);
    const skipped = Object.keys(P.notInterested).length;
    const m = document.createElement('div');
    m.id = 'dx-menu';
    m.className = 'dx-scrim';
    m.innerHTML = `<div class="dx-sheet wide" role="dialog" aria-label="Tune Discover">
      <header><b>Tune Discover</b><button class="dx-ib" onclick="DX.closeMenu()" aria-label="Close">${ico('close')}</button></header>
      <label class="dx-toggle"><span><b>Personalised recommendations</b><em>Use what you watch, like, follow and search. Off shows what is popular and recent.</em></span>
        <input type="checkbox" ${P.personalized ? 'checked' : ''} onchange="DX.setPersonal(this.checked)"></label>
      <div class="dx-sec">What Discover thinks you like</div>
      ${top.length ? top.map(t => `<div class="dx-irow">${ico(TOPICS[t][1])}<b>${TOPICS[t][0]}</b><span class="dx-bar"><i style="width:${Math.round(iv.topics[t] * 100)}%"></i></span>
        <button class="dx-link" onclick="DX.forgetTopic('${t}')">Remove</button></div>`).join('') : '<p class="dx-note">Nothing yet — watch, like or follow a few things.</p>'}
      ${muted.length ? `<div class="dx-sec">Muted topics</div>${muted.map(t => `<div class="dx-irow">${ico('visibility_off')}<b>${TOPICS[t] ? TOPICS[t][0] : esc(t)}</b><span></span><button class="dx-link" onclick="DX.unmute('${esc(t)}')">Unmute</button></div>`).join('')}` : ''}
      ${hidden.length ? `<div class="dx-sec">Hidden accounts</div>${hidden.map(h => `<div class="dx-irow">${ico('person_off')}<b>${esc(h)}</b><span></span><button class="dx-link" onclick="DX.unhide(${A(h)})">Show again</button></div>`).join('')}` : ''}
      <div class="dx-sec">History</div>
      <div class="dx-acts">
        <button class="btn btn-ghost btn-sm" onclick="DX.clearSearches()">${ico('history')}Clear search history</button>
        ${skipped ? `<button class="btn btn-ghost btn-sm" onclick="DX.resetSkipped()">${ico('undo')}Reset ${skipped} “not interested”</button>` : ''}
        <button class="btn btn-ghost btn-sm dx-danger" onclick="DX.resetAll()">${ico('restart_alt')}Reset recommendations</button>
      </div>
      <p class="dx-note">All of this is stored in this browser only.</p>
    </div>`;
    m.addEventListener('click', e => { if (e.target === m) closeMenu(); });
    document.body.appendChild(m);
  }
  const afterSettings = () => { save(true); Object.keys(sessions).forEach(k => delete sessions[k]); openSettings(); if (V && V.mode === 'discover') paint(); };
  function setPersonal(on) { P.personalized = !!on; afterSettings(); }
  function forgetTopic(t) { P.interests[t] = { w: -2, t: Date.now() }; Object.keys(P.searches).forEach(q => { if (classify(q)[0] === t) delete P.searches[q]; }); afterSettings(); }
  function unmute(t) { delete P.muted[t]; afterSettings(); }
  function unhide(h) { delete P.hidden[h]; afterSettings(); }
  function clearSearches() { P.searches = {}; if (typeof SR !== 'undefined' && SR.clearRecent) SR.clearRecent(); afterSettings(); toast('Search history cleared'); }
  function resetSkipped() { P.notInterested = {}; P.reported = {}; afterSettings(); }
  async function resetAll() {
    if (!(await appConfirm('Reset everything Discover has learned? Your follows, likes and communities elsewhere in the app stay as they are.', { ok: 'Reset', danger: true }))) return;
    P = JSON.parse(JSON.stringify(DEFAULT));
    afterSettings();
    toast('Recommendations reset');
  }

  /* ── Signals from the Shorty player ────────────────────────────── */
  window.addEventListener('shorty:leave', e => {
    const d = e.detail || {};
    if (!d.id) return;
    const completion = d.duration ? clamp(d.ms / 1000 / d.duration, 0, 1) : 0;
    if (!INDEX) buildIndex();
    signal('short:' + d.id, 'watch', { ms: d.ms, completion, loops: d.loops || 0 });
  });
  window.addEventListener('shorty:signal', e => {
    const d = e.detail || {};
    if (!d.id) return;
    if (!INDEX) buildIndex();
    signal('short:' + d.id, d.type, { on: d.on });
  });

  return {
    open, close, back, chip, refresh, pickTopic, doneOnboard, openItem, play, follow,
    focus, type, clear, cancel, keys, submit, tab, exact, coin, forget, clearRecent,
    menu, closeMenu, reportMenu, feedback, undo,
    openSettings, setPersonal, forgetTopic, unmute, unhide, clearSearches, resetSkipped, resetAll,
    api, TOPICS,
    // exposed for testing and for a future server-side port
    _: { buildIndex, rankDiscover, runSearch, suggestions, correct, place, newLayout, interestVector, get P() { return P; } }
  };
})();

window.DX = DX;

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
publish('features/discover.js', {
  DX: () => DX
});
