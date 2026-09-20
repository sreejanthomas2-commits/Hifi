/* ╔══════════════════════════════════════════════════════════════════╗
   ║  COMMUNE HUB+ — the model for everything beyond the Discord shape ║
   ║                                                                   ║
   ║  Discovery:   For You feed, Rising, Following, Nearby Interests,  ║
   ║               Trend Radar, posts that go viral into Trending      ║
   ║  Identity:    Universal passport, portable reputation,            ║
   ║               contribution score, levels, skills, proofs,         ║
   ║               reputation graph                                    ║
   ║  Community:   Missions, governance + proposals + verifiable       ║
   ║               history, treasury, crowdfunding, marketplace, tips, ║
   ║               collaborations, joint events, knowledge base        ║
   ║  Safety & AI: AI moderator, assistant, AI search — on-device      ║
   ║  Web3 layer:  token-gated spaces, membership passes, credentials, ║
   ║               wallet-optional personalisation                     ║
   ║  Platform:    mini apps and the Open Community API                ║
   ║                                                                   ║
   ║  It sits beside commune.js and never rewrites it: communities,    ║
   ║  roles, channels and messages still come from CMD. This file adds ║
   ║  its own records under its own storage key.                       ║
   ║                                                                   ║
   ║  Honesty rules this file keeps:                                   ║
   ║  · Money is simulated. Treasury, pledges, purchases and tips are  ║
   ║    records on this device. Nothing is charged, no payment details ║
   ║    are collected, no transaction is ever sent.                    ║
   ║  · Nothing here is recorded on a blockchain. Proofs are SHA-256   ║
   ║    digests in a hash chain anyone can recompute. A wallet can     ║
   ║    optionally sign a plain-text message — never a transaction.    ║
   ║  · Passes and credentials are non-transferable. They are          ║
   ║    membership and achievement records, not investments.           ║
   ║  · The AI is on-device heuristics. No text leaves the browser.    ║
   ║  · Seeded demo records carry seed: true so they can be told apart ║
   ║    from what a real user created, and removed in one pass.        ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CPM = (() => {

  const KEY = 'ts_commune_plus';
  const HOUR = 3600000, DAY = 86400000;

  /* ── SHA-256 (synchronous, UTF-8) ────────────────────────────────── */
  /* Kept synchronous so a digest can be shown in the same render that
     creates it. Checked against Node's crypto on known vectors. */
  function sha256(input) {
    const bytes = new TextEncoder().encode(String(input));
    const K = [], H = [];
    for (let n = 2, found = 0; found < 64; n++) {
      let prime = true;
      for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
      if (!prime) continue;
      if (found < 8) H.push((Math.pow(n, 1 / 2) * 4294967296) | 0);
      K.push((Math.pow(n, 1 / 3) * 4294967296) | 0);
      found++;
    }
    const len = bytes.length;
    const total = Math.ceil((len + 9) / 64) * 64;
    const buf = new Uint8Array(total);
    buf.set(bytes);
    buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(len / 0x20000000));
    dv.setUint32(total - 4, (len << 3) >>> 0);
    const W = new Int32Array(64);
    const rot = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < total; off += 64) {
      for (let t = 0; t < 16; t++) W[t] = dv.getInt32(off + t * 4);
      for (let t = 16; t < 64; t++) {
        const x = W[t - 15], y = W[t - 2];
        W[t] = (W[t - 16] + (rot(x, 7) ^ rot(x, 18) ^ (x >>> 3)) + W[t - 7] + (rot(y, 17) ^ rot(y, 19) ^ (y >>> 10))) | 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) | 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
  }

  /* Stable JSON so the same record always hashes the same way. */
  function canon(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }

  function rng(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 100000) / 100000; };
  }
  const uid = p => p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const hashtags = t => (String(t || '').match(/#([\p{L}\p{N}_-]+)/gu) || []).map(x => x.slice(1).toLowerCase());

  /* ── Storage ─────────────────────────────────────────────────────── */
  const DEFAULT = {
    v: 1,
    prefs: { interests: [], wallet: false, web3Trends: true },
    lane: 'all', gov: 'proposals', market: 'all', kbCat: 'all',
    follows: { communities: [], people: [] },
    likes: {}, comments: {}, viral: {},
    missions: {}, missionOff: {}, progress: {}, checkins: {},
    badges: [], skills: [], endorsements: [], proofs: [], sigs: {},
    proposals: {}, govLog: {}, govSettings: {},
    treasury: {}, funding: {}, market: {}, library: [], tips: [], payout: null,
    collabs: null, collabMsgs: {},
    kb: {}, passes: {}, myPasses: {}, roleLinks: {},
    aiMod: {}, held: {}, aiLog: {},
    miniApps: {}, trust: {}
  };

  let P = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const base = JSON.parse(JSON.stringify(DEFAULT));
      return raw ? { ...base, ...JSON.parse(raw) } : base;
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} }

  /* ── Open Community API event bus ────────────────────────────────── */
  const listeners = {};
  const recentEvents = [];
  function emit(type, data) {
    const ev = Object.freeze({ type, at: Date.now(), data: data || {} });
    recentEvents.unshift(ev);
    if (recentEvents.length > 40) recentEvents.length = 40;
    (listeners[type] || []).concat(listeners['*'] || []).forEach(fn => { try { fn(ev); } catch (e) {} });
  }
  function on(type, fn) {
    if (typeof fn !== 'function') return () => {};
    (listeners[type] = listeners[type] || []).push(fn);
    return () => { listeners[type] = (listeners[type] || []).filter(f => f !== fn); };
  }

  /* ── Identity ────────────────────────────────────────────────────── */
  const me = () => CMD.me();
  const joined = () => CMD.all().filter(c => CMD.isJoined(c.id));
  const lastWrite = { at: 0 };

  function wallet() {
    if (typeof WL === 'undefined' || !WL.isConnected || !WL.isConnected()) return null;
    const a = WL.account();
    if (!a) return null;
    const net = (WL.NETWORKS && WL.NETWORKS[a.net]) || {};
    return {
      address: a.address, net: a.net, family: net.family || 'evm', label: net.label || a.chain,
      symbol: net.symbol || '', native: a.native || null, simulated: !!a.simulated, provider: a.provider,
      chainId: net.chainId || null
    };
  }

  function did() {
    const w = wallet();
    if (w && w.family === 'evm') return `did:pkh:eip155:${parseInt(w.chainId || '0x1', 16) || 1}:${w.address}`;
    if (w && w.family === 'solana') return `did:pkh:solana:${w.address}`;
    return 'did:trending:' + me().handle.replace('@', '');
  }

  /* ══════════════════════════════════════════════════════════════════
     1 · 2 · 30  Discovery — feed, ranking, viral, rising, radar
     ══════════════════════════════════════════════════════════════════ */

  const LANES = [
    ['all', 'For You', 'auto_awesome'], ['crypto', 'Web3', 'token'], ['gaming', 'Gaming', 'sports_esports'],
    ['tech', 'Technology', 'memory'], ['finance', 'Finance', 'account_balance'], ['science', 'Science', 'science'],
    ['creator', 'Creators', 'movie_edit'], ['music', 'Music', 'music_note'], ['sports', 'Sports', 'sports_soccer']
  ];

  const INTERESTS = [
    ['build', 'Building'], ['learn', 'Learning'], ['safety', 'Safety'], ['research', 'Research'], ['art', 'Art & design'],
    ['governance', 'Governance'], ['events', 'Events'], ['careers', 'Careers'], ['gaming', 'Gaming'], ['music', 'Music'],
    ['sports', 'Sports'], ['markets', 'Markets & macro']
  ];
  const INTEREST_TAGS = {
    build: ['builders', 'hackathon', 'architecture', 'ci', 'opensource', 'clients', 'nodes', 'editing', 'production'],
    learn: ['guide', 'education', 'study', 'cohort', 'papers', 'calendar'],
    safety: ['safety', 'phishing', 'scams', 'security', 'postmortem', 'provenance', 'selfcustody'],
    research: ['research', 'data', 'replication', 'openscience', 'analysis', 'protocol', 'eips'],
    art: ['art', 'thumbnails', 'provenance', 'samples'],
    governance: ['governance', 'treasury', 'roadmap', 'feedback'],
    events: ['tournament', 'challenge', 'community', 'charity', 'cohort'],
    careers: ['hiring', 'careers', 'founders', 'rates', 'brands'],
    gaming: ['patch', 'ranked', 'clips', 'tournament'],
    music: ['mixing', 'production', 'samples'],
    sports: ['tactics', 'transfers', 'analysis'],
    markets: ['earnings', 'macro', 'risk', 'journal', 'research']
  };

  /* Public posts for each community — [text, hours ago]. Tags come from
     the hashtags in the text. Crypto content is educational and
     project-focused on purpose: no price calls. */
  const SEED_POSTS = {
    btc: [['Lightning channel rebalancing in one diagram: why inbound liquidity disappears after a big payment, and three ways to get it back without closing the channel. #lightning #guide', 5],
          ['Ran a full node on a 4GB board for 30 days. Sync took five days, bandwidth was about 180GB. Full numbers in the discussion. #nodes #selfcustody', 29]],
    eth: [['Plain-words summary of the latest core devs call: what got scheduled, what got pushed, and which proposals client teams still disagree on. #protocol #eips', 3],
          ['If you run a validator: the new client release fixes the memory leak some of you saw after the last fork. Upgrade notes in #dev. #clients', 20]],
    sol: [['Hackathon retro: we shipped a payments demo in 36 hours. The biggest time sink was local validator setup, not the program itself. #hackathon #builders', 8],
          ['Priority fees, simply: what they buy you, when they do not help, and how to set them without guessing. #guide #education', 40]],
    defi: [['Before you deposit anywhere, ask three things: who can upgrade the contract, is there a timelock, and where does the oracle price come from. #safety #research', 2],
           ['Wrote up how impermanent loss actually works with one worked example and one table — no jargon. #education #guide', 33]],
    l2: [['Rollup data costs after the blob change, compared across five chains. Short version: calldata-heavy apps saw the biggest drop. #rollups #data', 6],
         ['What "stage 1" actually means for a rollup, and why the security council detail matters more than the TPS number. #security #research', 51]],
    nft: [['Provenance thread: how to check an artwork\'s creator wallet and mint history before you trust a listing. #provenance #safety', 4],
          ['Community show — 12 artists, one theme: winter. Submissions open until Friday. #art #community', 26]],
    sec: [['Post-mortem template we use internally: timeline, root cause, blast radius, what detection missed, and the fix. Free to copy. #postmortem #security', 7],
          ['Phishing pattern this week: fake "wallet sync" pages linked from lookalike support accounts. Real support never asks you to connect a wallet to "validate". #phishing #safety', 1]],
    quest: [['Testnet guide: take part without your main wallet — use a fresh address and never approve unlimited spending. #testnet #safety', 9],
            ['A list of "quests" that are really social engineering. If it asks for a signature you do not understand, stop. #scams #safety', 30]],
    found: [['Hiring your first protocol engineer: the take-home we use and what we look for in the review. #hiring #founders', 12],
            ['We moved our community treasury to a 3-of-5 multisig with public signers. Setup and policy doc inside. #governance #treasury', 44]],
    trade: [['Risk first: the position-sizing rules I use so one bad trade never ruins the week. Paper-trade them before you trust them. #risk #education', 10],
            ['Journaling template — setup, thesis, invalidation, result, lesson. The lesson column is the only one that matters. #journal #education', 55]],
    gamearena: [['Patch day breakdown: the three changes that will actually move ranked, and the two everyone is overreacting to. #patch #ranked', 2],
                ['Charity tournament with Matchday this weekend — squads of four, sign-ups in #looking-for-group. #tournament #charity', 14],
                ['Clip of the week explained frame by frame. The flick is nice; the positioning is better. #clips', 36]],
    studio: [['Thumbnail A/B results: faces versus no faces across 14 videos. The answer depends on the niche — data inside. #thumbnails #data', 5],
             ['The editing workflow that cut my turnaround from three days to one: proxies, a rough-cut rule and a single music pass. #editing #guide', 22],
             ['Rate card sanity check — what members charge for a 60-second integration, by audience size. #brands #rates', 60]],
    soundlab: [['Mixdown checklist before you bounce: gain staging, mono check, a reference track and a ten-minute break. #mixing #production', 11],
               ['Free sample pack from this month\'s challenge — every sound made from kitchen objects. #samples #challenge', 27]],
    devcore: [['Monorepo migration notes: what broke, what got faster, and the one CI change that paid for everything. #architecture #ci', 4],
              ['Open-source audit week with Security & Audits starts Monday — pick an issue, get a reviewer. #opensource #security', 16],
              ['The interview loop we switched to: one real bug-fix pairing session instead of four whiteboard rounds. #careers #hiring', 48]],
    matchday: [['Tactics breakdown: why the high press collapsed in the second half, with the passing maps. #tactics #analysis', 3],
               ['Transfer window tracker: confirmed deals only, sources linked, no rumours. #transfers', 19]],
    marketsdesk: [['Earnings season primer: the three numbers we read in every report and why guidance moves more than the headline. #earnings #research', 6],
                  ['This week\'s macro calendar with plain-language notes on what each release measures. #macro #calendar', 25]],
    labnotes: [['Replication club result: the effect held in two of three runs, smaller than reported. Methods and data linked. #replication #openscience', 8],
               ['How to read a paper in 20 minutes: abstract, figures, methods, then the discussion — in that order. #papers #guide', 41]],
    insiders: [['Early build notes: Commune Hub now has missions, proposals and a knowledge base. Tell us what is confusing. #feedback #governance', 1],
               ['Roadmap vote is open in Governance — three candidates, one week. #governance #roadmap', 18]],
    learners: [['Cohort 5 starts Monday: six weeks, two hours a day, Friday check-ins. Study buddies are matched on Sunday. #cohort #study', 7],
               ['Wins thread: finished a course, shipped a project, passed an exam? Post it and we will celebrate. #community #study', 31]]
  };

  let feedCache = null;
  function feedItems() {
    if (feedCache && Date.now() - feedCache.at < 1200 && feedCache.w === lastWrite.at) return feedCache.items;
    const items = [];
    const D = CMD.state();
    CMD.all().forEach(c => {
      let mem = null;
      const author = i => {
        mem = mem || CMD.members(c.id).filter(m => !m.you && !m.bot);
        return mem[(i * 3 + 1) % Math.max(1, mem.length)] || { name: 'Member', handle: '@member' };
      };
      (SEED_POSTS[c.id] || []).forEach((p, i) => {
        const r = rng(c.id + ':post:' + i);
        const a = author(i);
        items.push({ key: `sp:${c.id}:${i}`, cid: c.id, name: a.name, handle: a.handle, text: p[0], tags: hashtags(p[0]),
          ts: Date.now() - p[1] * HOUR, likes: Math.floor(30 + r() * 900), replies: Math.floor(2 + r() * 70), seed: true });
      });
      ((D.feed || {})[c.id] || []).filter(p => p.mine).forEach(p => {
        items.push({ key: `cf:${c.id}:${p.id}`, cid: c.id, fid: p.id, name: p.name, handle: p.handle, text: p.text,
          tags: hashtags(p.text), ts: p.ts, likes: p.likes || 0, replies: (p.comments || []).length, mine: true });
      });
      ((D.boards || {})[c.id] || []).filter(p => p.mine).forEach(p => {
        items.push({ key: `bd:${c.id}:${p.id}`, cid: c.id, bid: p.id, name: p.author, handle: p.handle, title: p.title,
          text: p.body, tags: (p.tags || []).map(t => String(t).toLowerCase()), ts: p.ts, likes: p.votes || 0,
          replies: (p.comments || []).length, mine: true, topic: true });
      });
    });
    feedCache = { at: Date.now(), items, w: lastWrite.at };
    return items;
  }
  const touch = () => { lastWrite.at = Date.now(); feedCache = null; };

  const likedByMe = key => !!P.likes[key];
  function likeCount(it) {
    if (it.fid) return it.likes;
    return (it.likes || 0) + (P.likes[it.key] ? 1 : 0);
  }
  const replyList = key => P.comments[key] || [];
  const replyCount = it => (it.replies || 0) + replyList(it.key).length;

  function like(key) {
    const it = feedItems().find(x => x.key === key);
    if (it && it.fid) { CMD.likeFeed(it.cid, it.fid); touch(); return; }
    if (P.likes[key]) delete P.likes[key]; else P.likes[key] = true;
    save(); touch();
  }

  function reply(key, text) {
    const t = String(text || '').trim();
    if (!t) return { error: 'Write a reply first.' };
    const it = feedItems().find(x => x.key === key);
    const scan = aiScan(t, it ? it.cid : null);
    if (scan.score >= 75) return { error: 'The AI Moderator held that reply: ' + scan.flags.map(f => f.label).join(', ') + '.' };
    const m = me();
    (P.comments[key] = P.comments[key] || []).push({ id: uid('r'), name: m.name, handle: m.handle, text: t, ts: Date.now() });
    if (it && it.handle) bumpTrust(it.handle, it.name, 1);
    save(); touch();
    emit('reply', { key, cid: it ? it.cid : null });
    return { ok: true };
  }

  /* Wallet-optional personalisation: only read when the user switched it
     on, and only the network and native balance the wallet module
     already holds. */
  function walletSignals() {
    if (!P.prefs.wallet) return null;
    const w = wallet();
    if (!w) return null;
    const boost = {};
    const nets = (typeof WL !== 'undefined' ? WL.accounts() : []).map(a => a.net);
    nets.forEach(n => {
      const fam = ((WL.NETWORKS || {})[n] || {}).family;
      if (fam === 'evm' || n === 'simulated') { boost.eth = 1; boost.l2 = 1; boost.defi = 1; boost.nft = 1; }
      if (fam === 'solana') boost.sol = 1;
      if (n === 'base' || n === 'arbitrum' || n === 'optimism') boost.l2 = 2;
    });
    return { boost, simulated: w.simulated };
  }

  function affinity() {
    const cats = {};
    joined().forEach(c => { cats[c.category] = (cats[c.category] || 0) + 1; });
    P.follows.communities.forEach(id => { const c = CMD.byId(id); if (c) cats[c.category] = (cats[c.category] || 0) + 0.6; });
    return cats;
  }

  function scoreItem(it, ctx) {
    const c = CMD.byId(it.cid);
    if (!c) return null;
    const reasons = [];
    let s = 0;
    if (CMD.isJoined(it.cid)) { s += 38; reasons.push('You joined ' + c.name); }
    else if (P.follows.communities.indexOf(it.cid) > -1) { s += 30; reasons.push('You follow ' + c.name); }
    if (P.follows.people.some(p => p.handle === it.handle)) { s += 26; reasons.push('You follow ' + it.name); }
    const aff = ctx.aff[c.category] || 0;
    if (aff && !CMD.isJoined(it.cid)) { s += aff * 11; reasons.push('Similar to communities you are in'); }
    const tagHit = (P.prefs.interests || []).filter(k => (INTEREST_TAGS[k] || []).some(t => it.tags.indexOf(t) > -1));
    if (tagHit.length) { s += tagHit.length * 12; reasons.push('Matches your interest: ' + tagHit.map(k => (INTERESTS.find(x => x[0] === k) || [k, k])[1]).join(', ')); }
    if (ctx.wallet && ctx.wallet.boost[it.cid]) { s += 16 * ctx.wallet.boost[it.cid]; reasons.push('Relevant to your connected wallet' + (ctx.wallet.simulated ? ' (demo)' : '')); }
    const eng = likeCount(it) + replyCount(it) * 3;
    s += Math.log10(eng + 1) * 9;
    const hrs = (Date.now() - it.ts) / HOUR;
    s -= Math.min(40, hrs * 0.55);
    const v = P.viral[it.key];
    if (v && v.status === 'published') { s += 14; reasons.push('Went viral into Trending'); }
    if (it.mine) { s += 6; reasons.push('Your post'); }
    if (!reasons.length) reasons.push(eng > 400 ? 'Popular across Commune Hub' : 'New in ' + c.name);
    return { ...it, score: s, reasons, community: c };
  }

  function forYou(lane) {
    const ctx = { aff: affinity(), wallet: walletSignals() };
    return feedItems()
      .filter(it => { const c = CMD.byId(it.cid); return c && (lane === 'all' || !lane || c.category === lane); })
      .map(it => scoreItem(it, ctx)).filter(Boolean)
      .sort((a, b) => b.score - a.score);
  }

  function followingFeed(lane) {
    const people = P.follows.people.map(p => p.handle);
    return forYou(lane).filter(it => CMD.isJoined(it.cid) || P.follows.communities.indexOf(it.cid) > -1 || people.indexOf(it.handle) > -1)
      .sort((a, b) => b.ts - a.ts);
  }

  function picks(lane) {
    const aff = affinity();
    const w = walletSignals();
    return CMD.all().filter(c => !CMD.isJoined(c.id) && (lane === 'all' || !lane || c.category === lane)).map(c => {
      const reasons = [];
      let s = (c.verified ? 8 : 0) + Math.log10((c.online || 1)) * 4;
      if (aff[c.category]) { s += aff[c.category] * 14; reasons.push('Like communities you are in'); }
      const tags = (c.tags || []).map(t => t.toLowerCase());
      const hit = (P.prefs.interests || []).filter(k => (INTEREST_TAGS[k] || []).some(t => tags.indexOf(t) > -1 || (SEED_POSTS[c.id] || []).some(p => hashtags(p[0]).indexOf(t) > -1)));
      if (hit.length) { s += hit.length * 10; reasons.push('Matches ' + hit.map(k => (INTERESTS.find(x => x[0] === k) || [k, k])[1]).join(', ')); }
      if (w && w.boost[c.id]) { s += 18; reasons.push('Fits your wallet activity' + (w.simulated ? ' (demo)' : '')); }
      if (P.follows.communities.indexOf(c.id) > -1) { s += 10; reasons.push('You follow it'); }
      if (!reasons.length) reasons.push(c.verified ? 'Verified and active' : 'Active right now');
      return { c, s, reasons };
    }).sort((a, b) => b.s - a.s);
  }

  function prefs() { return P.prefs; }
  function setPrefs(patch) { P.prefs = { ...P.prefs, ...patch }; save(); touch(); }
  function setLane(l) { P.lane = l; save(); }

  /* Follow is lighter than join: posts reach your feeds, nothing else. */
  function followCommunity(cid) {
    const i = P.follows.communities.indexOf(cid);
    if (i > -1) P.follows.communities.splice(i, 1); else P.follows.communities.push(cid);
    save(); touch();
    emit('follow', { cid, on: i < 0 });
    return i < 0;
  }
  function followPerson(handle, name) {
    const i = P.follows.people.findIndex(p => p.handle === handle);
    if (i > -1) P.follows.people.splice(i, 1); else P.follows.people.push({ handle, name, at: Date.now() });
    if (i < 0) bumpTrust(handle, name, 2);
    save(); touch();
    return i < 0;
  }
  const followsCommunity = cid => P.follows.communities.indexOf(cid) > -1;
  const followsPerson = h => P.follows.people.some(p => p.handle === h);
  const follows = () => P.follows;

  /* ── 2 · Posts go viral ──────────────────────────────────────────── */
  function viralScore(it) {
    const v = P.viral[it.key];
    return likeCount(it) + replyCount(it) * 3 + ((v && v.noms.length) || 0) * 25;
  }
  const VIRAL_AT = 300;
  const viral = key => P.viral[key] || null;

  function nominate(key) {
    const it = feedItems().find(x => x.key === key);
    if (!it) return { error: 'Post not found.' };
    const v = P.viral[key] = P.viral[key] || { noms: [], status: 'nominated', at: Date.now(), cid: it.cid };
    const h = me().handle;
    const i = v.noms.indexOf(h);
    if (i > -1) v.noms.splice(i, 1); else v.noms.push(h);
    if (!v.noms.length && v.status === 'nominated') delete P.viral[key];
    save(); touch();
    return { on: i < 0, score: viralScore(it), eligible: viralScore(it) >= VIRAL_AT };
  }

  function viralQueue(cid) {
    return feedItems().filter(it => it.cid === cid).map(it => ({ ...it, v: P.viral[it.key] || null, vs: viralScore(it) }))
      .filter(it => it.v || it.vs >= VIRAL_AT).sort((a, b) => b.vs - a.vs);
  }

  function publishViral(key) {
    const it = feedItems().find(x => x.key === key);
    if (!it) return { error: 'Post not found.' };
    if (!CMD.can(it.cid, 'broadcast')) return { error: 'Only community broadcasters can send a post into Trending.' };
    const ok = CMD.shareToTrending(it.cid, `${it.title ? it.title + '\n\n' : ''}${it.text}\n\n— ${it.name} ${it.handle}`);
    if (!ok) return { error: 'The Trending feed is not available right now.' };
    P.viral[key] = { ...(P.viral[key] || { noms: [] }), status: 'published', at: Date.now(), cid: it.cid, by: me().handle };
    save(); touch();
    emit('viral', { cid: it.cid, key });
    return { ok: true };
  }
  function dismissViral(key) {
    const it = feedItems().find(x => x.key === key);
    if (it && !CMD.can(it.cid, 'moderate')) return;
    P.viral[key] = { ...(P.viral[key] || { noms: [] }), status: 'dismissed', at: Date.now() };
    save(); touch();
  }

  /* ── Rising & Nearby ─────────────────────────────────────────────── */
  function growth(cid) {
    const c = CMD.byId(cid);
    if (!c) return { pct: 0, spark: [] };
    const r = rng(cid + ':growth');
    const base = (r() * 14) - 2 + (c.members < 40000 ? 4 : 0);
    const local = Math.min(8, (CMD.rep(cid) || 0) / 12 + (CMD.boosts(cid) || 0) * 0.8 + (P.follows.communities.indexOf(cid) > -1 ? 1.5 : 0));
    const pct = +(base + local).toFixed(1);
    const spark = [];
    let v = 50;
    for (let i = 0; i < 8; i++) { v += (pct / 8) + (r() - 0.5) * 6; spark.push(Math.max(4, v)); }
    return { pct, spark, newMembers: Math.round((c.members || 0) * Math.max(0, pct) / 100) };
  }

  function rising(lane) {
    return CMD.all().filter(c => lane === 'all' || !lane || c.category === lane)
      .map(c => ({ c, g: growth(c.id) })).sort((a, b) => b.g.pct - a.g.pct);
  }

  function nearby() {
    const mine = joined().concat(P.follows.communities.map(CMD.byId).filter(Boolean));
    if (!mine.length) return [];
    const out = [];
    CMD.all().forEach(c => {
      if (CMD.isJoined(c.id)) return;
      let best = null;
      mine.forEach(m => {
        if (m.id === c.id) return;
        const shared = (c.tags || []).filter(t => (m.tags || []).map(x => x.toLowerCase()).indexOf(t.toLowerCase()) > -1);
        const sameCat = m.category === c.category;
        const collab = collabs().some(k => k.communities.indexOf(c.id) > -1 && k.communities.indexOf(m.id) > -1);
        const s = shared.length * 3 + (sameCat ? 2 : 0) + (collab ? 4 : 0);
        if (s && (!best || s > best.s)) {
          best = { s, via: m, why: collab ? `Collaborates with ${m.name}` : shared.length ? `Shares #${shared[0]} with ${m.name}` : `Same interest area as ${m.name}` };
        }
      });
      if (best) out.push({ c, ...best });
    });
    return out.sort((a, b) => b.s - a.s);
  }

  /* ── 30 · Trend Radar ────────────────────────────────────────────── */
  /* Topics are hashtags plus discussion tags, counted in a recent window
     against the window before it. Anything that reads like a price call
     is left out — this is a community trend view, not a trading screen. */
  const PRICE_WORDS = /^(pump|dump|moon|100x|1000x|lambo|ath|bullrun|shill|gem|ape|wagmi|signals?|entry|target|tp|sl|long|short)$/i;
  function radar(opts) {
    const o = opts || {};
    const now = Date.now();
    const WIN = 36 * HOUR;
    const topics = {};
    const add = (tag, cid, ts, weight) => {
      if (!tag || PRICE_WORDS.test(tag) || /^\$/.test(tag)) return;
      const c = CMD.byId(cid);
      if (!c) return;
      const t = topics[tag] = topics[tag] || { tag, recent: 0, prior: 0, total: 0, communities: {}, cats: {} };
      const w = weight || 1;
      if (now - ts <= WIN) t.recent += w; else if (now - ts <= WIN * 4) t.prior += w;
      t.total += w;
      t.communities[cid] = (t.communities[cid] || 0) + w;
      t.cats[c.category] = (t.cats[c.category] || 0) + w;
    };
    feedItems().forEach(it => it.tags.forEach(t => add(t, it.cid, it.ts, 1 + Math.log10(likeCount(it) + 1) / 2)));
    Object.keys(P.comments).forEach(k => {
      const it = feedItems().find(x => x.key === k);
      if (it) P.comments[k].forEach(c => it.tags.forEach(t => add(t, it.cid, c.ts, 0.5)));
    });
    const D = CMD.state();
    Object.keys(D.boards || {}).forEach(cid => (D.boards[cid] || []).forEach(p => (p.tags || []).forEach(t => add(String(t).toLowerCase(), cid, p.ts, 0.8))));
    Object.keys(P.proposals).forEach(cid => (P.proposals[cid] || []).forEach(p => add('governance', cid, p.created || p.start, 0.6)));
    const list = Object.values(topics).map(t => {
      // Change against the earlier window, with a floor on the base so a
      // topic that simply did not exist before does not read as +2000%.
      const r = rng('radar:' + t.tag)();
      const growthPct = Math.round(Math.max(-90, Math.min(400, ((t.recent - t.prior) / Math.max(3, t.prior)) * 100 + r * 12)));
      const cat = Object.keys(t.cats).sort((a, b) => t.cats[b] - t.cats[a])[0];
      return {
        tag: t.tag, growth: growthPct, volume: +t.total.toFixed(1), cat, web3: cat === 'crypto',
        communities: Object.keys(t.communities).sort((a, b) => t.communities[b] - t.communities[a]).slice(0, 4)
      };
    }).filter(t => o.web3 !== false || !t.web3);
    return list.sort((a, b) => (b.growth + b.volume * 6) - (a.growth + a.volume * 6)).slice(0, o.limit || 24);
  }

  /* ══════════════════════════════════════════════════════════════════
     3 · 4 · 5 · 6 · 7 · 14 · 15 · 21  Identity & reputation
     ══════════════════════════════════════════════════════════════════ */

  const LEVELS = [[0, 'Newcomer', 'eco'], [25, 'Member', 'person'], [100, 'Contributor', 'construction'], [300, 'Expert', 'psychology'], [800, 'Leader', 'workspace_premium']];

  function rawMsgs(cid) {
    const out = [];
    const D = CMD.state();
    Object.keys(D.msgs || {}).forEach(k => { if (k.indexOf(cid + ':') === 0) (D.msgs[k] || []).forEach(m => out.push({ ...m, chan: k.slice(cid.length + 1) })); });
    if (typeof CH !== 'undefined' && CH.state && CH.state.msgs) {
      Object.keys(CH.state.msgs).forEach(k => { if (k.indexOf(cid + ':') === 0) (CH.state.msgs[k] || []).forEach(m => out.push({ ...m, chan: k.slice(cid.length + 1) })); });
    }
    return out;
  }

  /* Every number here is counted from records on this device. */
  function contribution(onlyCid) {
    const D = CMD.state();
    const h = me().handle;
    const ids = onlyCid ? [onlyCid] : Object.keys(D.joined || {});
    const parts = { messages: 0, threads: 0, posts: 0, topics: 0, comments: 0, solved: 0, events: 0, missions: 0, proposals: 0, votes: 0, articles: 0, moderation: 0, collabs: 0, skills: 0, endorsements: 0 };
    ids.forEach(cid => {
      rawMsgs(cid).forEach(m => {
        if (m.me && m.kind !== 'system') parts.messages++;
        (m.thread || []).forEach(t => { if (t.me) parts.threads++; });
      });
      parts.posts += ((D.feed || {})[cid] || []).filter(p => p.mine).length;
      ((D.boards || {})[cid] || []).forEach(p => {
        if (p.mine) { parts.topics++; if (p.solved) parts.solved++; }
        parts.comments += (p.comments || []).filter(c => c.me).length;
      });
      ((D.events || {})[cid] || []).forEach(e => { if ((e.going || []).indexOf(h) > -1 && e.start < Date.now()) parts.events++; });
      parts.events += Object.keys(P.checkins[cid] || {}).length;
      Object.keys(P.progress).forEach(k => { if (k.indexOf(cid + ':') === 0 && P.progress[k].status === 'done') parts.missions += (P.progress[k].points || 0); });
      (P.proposals[cid] || []).forEach(p => { if (p.handle === h && !p.seed) parts.proposals++; if (p.votes && p.votes[h]) parts.votes++; });
      parts.articles += (P.kb[cid] || []).filter(a => a.handle === h && !a.seed).length;
      parts.moderation += ((D.modlog || {})[cid] || []).filter(e => e.by === h && e.action !== 'automod').length;
    });
    collabs().forEach(k => { if (!onlyCid || k.communities.indexOf(onlyCid) > -1) parts.collabs += (P.collabMsgs[k.id] || []).filter(m => m.handle === h).length; });
    if (!onlyCid) { parts.skills = P.skills.filter(s => s.status === 'verified').length; parts.endorsements = P.endorsements.length; }
    const W = { messages: 2, threads: 1, posts: 3, topics: 5, comments: 2, solved: 6, events: 3, missions: 1, proposals: 6, votes: 1, articles: 8, moderation: 4, collabs: 2, skills: 10, endorsements: 1 };
    const score = Object.keys(parts).reduce((s, k) => s + parts[k] * W[k], 0);
    return { score, parts, weights: W };
  }

  function level(score) {
    const s = score == null ? contribution().score : score;
    let i = 0;
    LEVELS.forEach((l, j) => { if (s >= l[0]) i = j; });
    const next = LEVELS[i + 1];
    return { i, name: LEVELS[i][1], icon: LEVELS[i][2], at: LEVELS[i][0], next: next ? { name: next[1], at: next[0] } : null,
      pct: next ? Math.round(((s - LEVELS[i][0]) / (next[0] - LEVELS[i][0])) * 100) : 100 };
  }

  const portableRep = () => joined().reduce((s, c) => s + (CMD.rep(c.id) || 0), 0);

  /* ── Credentials (badges) ────────────────────────────────────────── */
  function issue(cred) {
    const c = cred.cid ? CMD.byId(cred.cid) : null;
    const body = {
      type: ['VerifiableCredential', cred.kind === 'skill' ? 'SkillCredential' : cred.kind === 'event' ? 'AttendanceCredential' : cred.kind === 'pass' ? 'MembershipPass' : 'AchievementCredential'],
      title: cred.title, kind: cred.kind, icon: cred.icon || 'military_tech',
      issuer: c ? 'did:web:trending.app:community:' + c.id : 'did:web:trending.app',
      issuerName: c ? c.name : 'Trending',
      subject: did(), holder: me().handle, cid: cred.cid || null, ref: cred.ref || null,
      issued: Date.now(), transferable: false
    };
    const rec = { id: uid('vc'), ...body, digest: sha256(canon(body)) };
    P.badges.unshift(rec);
    save(); touch();
    addProof(cred.kind === 'event' ? 'attendance' : cred.kind === 'skill' ? 'skill' : cred.kind === 'pass' ? 'membership' : 'achievement', cred.cid, rec.id, cred.title);
    if (cred.cid) syncRoleLinks(cred.cid);
    emit('badge', { cid: cred.cid, title: cred.title });
    return rec;
  }
  const badges = cid => P.badges.filter(b => !cid || b.cid === cid);
  const hasBadge = (cid, title) => P.badges.some(b => b.cid === cid && b.title === title);

  function verifyCredential(id) {
    const b = P.badges.find(x => x.id === id);
    if (!b) return false;
    const { id: _i, digest, sig, ...body } = b;
    return sha256(canon(body)) === digest;
  }

  /* ── 15 · Proof-of-contribution chain ────────────────────────────── */
  function addProof(kind, cid, ref, summary) {
    const prev = P.proofs.length ? P.proofs[0].hash : '0'.repeat(64);
    const body = { kind, cid: cid || null, ref: ref || null, summary: String(summary || '').slice(0, 160), at: Date.now(), holder: did() };
    const rec = { id: uid('pf'), ...body, prev, hash: sha256(prev + '|' + canon(body)) };
    P.proofs.unshift(rec);
    if (P.proofs.length > 500) P.proofs.length = 500;
    save();
    return rec;
  }

  function verifyProofs() {
    const list = P.proofs.slice().reverse();
    let prev = '0'.repeat(64);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const body = { kind: p.kind, cid: p.cid, ref: p.ref, summary: p.summary, at: p.at, holder: p.holder };
      if (p.prev !== prev || sha256(prev + '|' + canon(body)) !== p.hash) return { ok: false, at: list.length - i, count: list.length };
      prev = p.hash;
    }
    return { ok: true, count: list.length, root: prev };
  }

  /* Optional: the connected wallet signs a plain-text statement of the
     chain root. personal_sign shows the exact text in the wallet; it is
     a signature, not a transaction, and it moves nothing. */
  async function signRoot() {
    const w = wallet();
    const v = verifyProofs();
    if (!v.count) return { error: 'Nothing to sign yet — earn a badge or finish a mission first.' };
    if (!v.ok) return { error: 'The proof chain does not verify, so it cannot be signed.' };
    if (!w) return { error: 'Connect a wallet first. Signing is optional.' };
    if (w.simulated) return { error: 'Demo wallets cannot sign — they hold no key. Connect a real browser wallet to sign.' };
    if (w.family !== 'evm' || !window.ethereum || !window.ethereum.request) return { error: 'Signing is available for EVM browser wallets in this build.' };
    const text = `Trending proof-of-contribution\nHolder: ${me().handle}\nDID: ${did()}\nChain root: ${v.root}\nRecords: ${v.count}\nSigned: ${new Date().toISOString()}\n\nThis signature authorises nothing and moves no funds.`;
    const hex = '0x' + Array.from(unescape(encodeURIComponent(text))).map(ch => ch.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    try {
      const signature = await window.ethereum.request({ method: 'personal_sign', params: [hex, w.address] });
      P.sigs.root = { root: v.root, count: v.count, address: w.address, signature, text, at: Date.now() };
      save();
      return { ok: true, signature };
    } catch (e) {
      return { error: e && e.code === 4001 ? 'Signature declined in your wallet.' : 'The wallet could not sign: ' + (e.message || e) };
    }
  }

  function passportExport() {
    const lv = level();
    const cont = contribution();
    return {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation', 'TrendingPassport'],
      holder: did(), handle: me().handle, name: me().name, exported: new Date().toISOString(),
      level: lv.name, contributionScore: cont.score, contributionParts: cont.parts, portableReputation: portableRep(),
      communities: joined().map(c => ({ id: c.id, name: c.name, role: CMD.topRole(c.id).name, reputation: CMD.rep(c.id), joined: (CMD.membership(c.id) || {}).at })),
      credentials: P.badges, skills: P.skills,
      proofChain: { records: P.proofs, verification: verifyProofs(), walletSignature: P.sigs.root || null,
        howToVerify: 'Walk the records oldest-first. For each, hash = SHA-256(prev + "|" + canonicalJSON({kind,cid,ref,summary,at,holder})), where prev is the previous hash (64 zeros for the first).' },
      note: 'Records were produced on-device. Nothing here was written to a blockchain.'
    };
  }

  /* ── 7 · Skills ──────────────────────────────────────────────────── */
  const SKILLS = ['Developer', 'Designer', 'Artist', 'Researcher', 'Creator', 'Educator', 'Moderator', 'Analyst', 'Musician', 'Writer'];
  function requestSkill(skill, cid, evidence) {
    if (SKILLS.indexOf(skill) < 0) return { error: 'Pick a skill from the list.' };
    if (!CMD.isJoined(cid)) return { error: 'Join the community that should verify it.' };
    if (P.skills.some(s => s.skill === skill && s.cid === cid && s.status !== 'declined')) return { error: 'You already asked this community about that skill.' };
    const ev = String(evidence || '').trim();
    if (ev && !/^https:\/\//i.test(ev) && ev.length < 20) return { error: 'Add an https link or a short description of your work.' };
    const rec = { id: uid('sk'), skill, cid, evidence: ev, status: 'pending', at: Date.now(), holder: me().handle, name: me().name };
    P.skills.unshift(rec);
    save();
    return rec;
  }
  function reviewSkill(id, approve) {
    const s = P.skills.find(x => x.id === id);
    if (!s) return { error: 'Request not found.' };
    if (!CMD.can(s.cid, 'moderate')) return { error: 'Only this community\'s moderators can verify skills.' };
    s.status = approve ? 'verified' : 'declined';
    s.reviewed = Date.now();
    s.by = me().handle;
    save();
    if (approve) issue({ kind: 'skill', cid: s.cid, title: s.skill, icon: 'verified', ref: s.id });
    return s;
  }
  const skills = () => P.skills;

  function endorse(handle, name, skill) {
    if (handle === me().handle) return { error: 'You cannot endorse yourself.' };
    const i = P.endorsements.findIndex(e => e.handle === handle && e.skill === skill);
    if (i > -1) { P.endorsements.splice(i, 1); save(); return { on: false }; }
    P.endorsements.unshift({ handle, name, skill, at: Date.now() });
    bumpTrust(handle, name, 3);
    save();
    return { on: true };
  }
  const endorsedBy = handle => P.endorsements.filter(e => e.handle === handle).map(e => e.skill);

  /* ── 21 · Trust and the reputation graph ─────────────────────────── */
  function bumpTrust(handle, name, n) {
    if (!handle || handle === me().handle) return;
    const t = P.trust[handle] = P.trust[handle] || { name: name || handle, w: 0 };
    t.w += n;
    if (name) t.name = name;
  }

  function graph() {
    const nodes = [{ id: 'me', label: me().name, kind: 'me', verified: !!(wallet() && !wallet().simulated) }];
    const edges = [];
    joined().forEach(c => {
      nodes.push({ id: 'c:' + c.id, label: c.name, kind: 'community', color: c.color, verified: !!c.verified, w: CMD.rep(c.id) });
      edges.push({ a: 'me', b: 'c:' + c.id, w: 1 + Math.min(6, (CMD.rep(c.id) || 0) / 20), kind: CMD.topRole(c.id).name });
    });
    const people = Object.keys(P.trust).map(h => ({ h, ...P.trust[h] })).sort((a, b) => b.w - a.w).slice(0, 10);
    people.forEach(p => {
      nodes.push({ id: 'p:' + p.h, label: p.name, kind: 'person', w: p.w });
      edges.push({ a: 'me', b: 'p:' + p.h, w: Math.min(6, p.w / 2), kind: 'trust' });
      joined().forEach(c => { if (CMD.members(c.id).some(m => m.handle === p.h)) edges.push({ a: 'p:' + p.h, b: 'c:' + c.id, w: 0.6, kind: 'member' }); });
    });
    collabs().forEach(k => {
      const ins = k.communities.filter(id => CMD.isJoined(id));
      if (ins.length >= 1) {
        k.communities.forEach(id => {
          if (!nodes.some(n => n.id === 'c:' + id)) { const c = CMD.byId(id); if (c) nodes.push({ id: 'c:' + id, label: c.name, kind: 'community', color: c.color, verified: !!c.verified, outer: true }); }
        });
        for (let i = 1; i < k.communities.length; i++) edges.push({ a: 'c:' + k.communities[0], b: 'c:' + k.communities[i], w: 1.4, kind: 'collab' });
      }
    });
    return { nodes, edges };
  }

  /* ══════════════════════════════════════════════════════════════════
     8  Missions
     ══════════════════════════════════════════════════════════════════ */

  const MISSION_LIB = [
    { id: 'intro',    title: 'Introduce yourself',        desc: 'Post in #introductions — who you are and what you are working on.', mode: 'auto', metric: 'intro', target: 1, points: 10, badge: 'Hello World', icon: 'waving_hand' },
    { id: 'answer',   title: 'Answer three questions',    desc: 'Reply in #help or comment on a discussion topic.', mode: 'auto', metric: 'answers', target: 3, points: 30, badge: 'Helper', icon: 'support_agent' },
    { id: 'topic',    title: 'Start a useful discussion', desc: 'Open a discussion topic with a clear question or finding.', mode: 'auto', metric: 'topics', target: 1, points: 20, badge: 'Conversation Starter', icon: 'topic' },
    { id: 'attend',   title: 'Attend a community event',  desc: 'Follow an event and check in once it has started.', mode: 'auto', metric: 'checkins', target: 1, points: 25, badge: 'Showed Up', icon: 'event_available' },
    { id: 'vote',     title: 'Have your say',             desc: 'Vote on an open proposal in Governance.', mode: 'auto', metric: 'votes', target: 1, points: 10, badge: 'Voter', icon: 'how_to_vote' },
    { id: 'kb',       title: 'Grow the knowledge base',   desc: 'Turn a useful conversation into a knowledge-base article.', mode: 'auto', metric: 'kb', target: 1, points: 40, badge: 'Librarian', icon: 'library_books' },
    { id: 'tutorial', title: 'Write a tutorial',          desc: 'Publish a step-by-step guide. A moderator reviews it before it counts.', mode: 'review', points: 60, badge: 'Teacher', icon: 'menu_book', skill: 'Educator' },
    { id: 'guard',    title: 'Help keep it safe',         desc: 'Report a scam or phishing attempt with a short explanation. A moderator confirms it.', mode: 'review', points: 25, badge: 'Guardian', icon: 'shield', skill: 'Moderator' }
  ];
  const CATEGORY_MISSION = {
    crypto:  { id: 'explain', title: 'Explain an upgrade in plain words', desc: 'Summarise a protocol change so a newcomer understands it. No price talk.', mode: 'review', points: 45, badge: 'Explainer', icon: 'lightbulb', skill: 'Educator' },
    gaming:  { id: 'breakdown', title: 'Break down a clip', desc: 'Post a clip with a written breakdown of what made it work.', mode: 'review', points: 30, badge: 'Analyst', icon: 'slow_motion_video', skill: 'Analyst' },
    creator: { id: 'critique', title: 'Give three real critiques', desc: 'Comment on three pieces of work with specific, useful feedback.', mode: 'auto', metric: 'comments', target: 3, points: 30, badge: 'Critic', icon: 'rate_review' },
    music:   { id: 'stems', title: 'Share a production tip', desc: 'Show a before/after with the settings you used.', mode: 'review', points: 30, badge: 'Producer', icon: 'tune', skill: 'Musician' },
    tech:    { id: 'review', title: 'Review someone\'s code', desc: 'Leave a thoughtful review on a showcase project.', mode: 'review', points: 40, badge: 'Reviewer', icon: 'code', skill: 'Developer' },
    sports:  { id: 'predict', title: 'Write a match preview', desc: 'Formations, key match-ups and one bold call.', mode: 'review', points: 25, badge: 'Pundit', icon: 'sports', skill: 'Analyst' },
    finance: { id: 'explainer', title: 'Explain one indicator', desc: 'What it measures, why it moves and what it does not tell you.', mode: 'review', points: 35, badge: 'Explainer', icon: 'query_stats', skill: 'Analyst' },
    science: { id: 'summary', title: 'Summarise a paper', desc: 'Question, method, result and one limitation — under 300 words.', mode: 'review', points: 40, badge: 'Reader', icon: 'article', skill: 'Researcher' },
    brand:   { id: 'feedback', title: 'Send product feedback', desc: 'Start a discussion with a concrete problem and a suggestion.', mode: 'auto', metric: 'topics', target: 1, points: 20, badge: 'Insider', icon: 'feedback' },
    learning:{ id: 'finish', title: 'Post a win', desc: 'Share something you finished in #wins or the community feed.', mode: 'auto', metric: 'posts', target: 1, points: 15, badge: 'Finisher', icon: 'emoji_events' }
  };

  function missions(cid) {
    const c = CMD.byId(cid);
    if (!c) return [];
    const off = P.missionOff[cid] || [];
    const base = MISSION_LIB.concat(CATEGORY_MISSION[c.category] ? [CATEGORY_MISSION[c.category]] : []);
    return base.map(m => ({ ...m, lib: true })).concat(P.missions[cid] || []).filter(m => off.indexOf(m.id) < 0);
  }
  const allMissions = cid => {
    const c = CMD.byId(cid);
    return MISSION_LIB.concat(c && CATEGORY_MISSION[c.category] ? [CATEGORY_MISSION[c.category]] : []).map(m => ({ ...m, lib: true })).concat(P.missions[cid] || []);
  };

  function metric(cid, name) {
    const h = me().handle;
    const D = CMD.state();
    const msgs = rawMsgs(cid);
    const boards = (D.boards || {})[cid] || [];
    switch (name) {
      case 'intro':    return msgs.filter(m => m.me && m.chan === 'intros').length;
      case 'answers':  return msgs.filter(m => m.me && m.chan === 'support').length
                              + boards.reduce((s, p) => s + (p.comments || []).filter(x => x.me).length, 0)
                              + msgs.reduce((s, m) => s + (m.thread || []).filter(t => t.me).length, 0);
      case 'topics':   return boards.filter(p => p.mine).length;
      case 'comments': return boards.reduce((s, p) => s + (p.comments || []).filter(x => x.me).length, 0);
      case 'posts':    return ((D.feed || {})[cid] || []).filter(p => p.mine).length + msgs.filter(m => m.me && m.chan === 'wins').length;
      case 'checkins': return Object.keys(P.checkins[cid] || {}).length + collabs().filter(k => k.communities.indexOf(cid) > -1 && k.checkins && k.checkins[h]).length;
      case 'votes':    return (P.proposals[cid] || []).filter(p => p.votes && p.votes[h]).length;
      case 'kb':       return (P.kb[cid] || []).filter(a => a.handle === h && !a.seed).length;
      default:         return 0;
    }
  }

  function missionState(cid, m) {
    const pr = P.progress[cid + ':' + m.id] || null;
    if (pr && pr.status === 'done') return { status: 'done', have: m.target || 1, need: m.target || 1, pct: 100, pr };
    if (m.mode === 'review') return { status: pr ? pr.status : 'open', have: 0, need: 1, pct: pr && pr.status === 'submitted' ? 50 : 0, pr };
    const have = metric(cid, m.metric);
    const need = m.target || 1;
    return { status: have >= need ? 'ready' : 'open', have: Math.min(have, need), need, pct: Math.round(Math.min(1, have / need) * 100), pr };
  }

  function claimMission(cid, mid) {
    const m = missions(cid).find(x => x.id === mid);
    if (!m) return { error: 'Mission not found.' };
    if (!CMD.isJoined(cid)) return { error: 'Join the community first.' };
    const st = missionState(cid, m);
    if (st.status !== 'ready') return { error: 'Not finished yet.' };
    return completeMission(cid, m);
  }

  function completeMission(cid, m) {
    P.progress[cid + ':' + m.id] = { ...(P.progress[cid + ':' + m.id] || {}), status: 'done', at: Date.now(), points: m.points };
    save();
    CMD.addRep(cid, m.points);
    const b = issue({ kind: 'mission', cid, title: m.badge, icon: m.icon, ref: m.id });
    emit('mission', { cid, mission: m.id });
    return { ok: true, badge: b, points: m.points };
  }

  function submitMission(cid, mid, text) {
    const m = missions(cid).find(x => x.id === mid);
    if (!m || m.mode !== 'review') return { error: 'This mission completes on its own.' };
    if (!CMD.isJoined(cid)) return { error: 'Join the community first.' };
    const t = String(text || '').trim();
    if (t.length < 20) return { error: 'Add a link or at least a couple of sentences so a moderator can review it.' };
    const scan = aiScan(t, cid);
    if (scan.score >= 75) return { error: 'The AI Moderator blocked that submission: ' + scan.flags.map(f => f.label).join(', ') };
    P.progress[cid + ':' + mid] = { status: 'submitted', at: Date.now(), proof: t, handle: me().handle, name: me().name, points: m.points };
    save();
    return { ok: true };
  }

  function reviewQueue(cid) {
    return Object.keys(P.progress).filter(k => k.indexOf(cid + ':') === 0 && P.progress[k].status === 'submitted')
      .map(k => ({ key: k, mid: k.slice(cid.length + 1), ...P.progress[k], mission: allMissions(cid).find(m => m.id === k.slice(cid.length + 1)) }));
  }
  function reviewMission(cid, mid, approve, note) {
    if (!CMD.can(cid, 'moderate')) return { error: 'Only moderators review missions.' };
    const k = cid + ':' + mid;
    const pr = P.progress[k];
    if (!pr) return { error: 'Nothing to review.' };
    const m = allMissions(cid).find(x => x.id === mid);
    if (!approve) { P.progress[k] = { ...pr, status: 'returned', note: note || 'Needs more detail.', at: Date.now() }; save(); return { ok: true }; }
    const res = completeMission(cid, m);
    if (m.skill && !P.skills.some(s => s.skill === m.skill && s.cid === cid && s.status === 'verified')) {
      P.skills.unshift({ id: uid('sk'), skill: m.skill, cid, evidence: 'Mission: ' + m.title, status: 'verified', at: Date.now(), reviewed: Date.now(), by: me().handle, holder: me().handle, name: me().name, via: 'mission' });
      save();
      issue({ kind: 'skill', cid, title: m.skill, icon: 'verified', ref: mid });
    }
    return res;
  }

  function addMission(cid, form) {
    if (!CMD.can(cid, 'manage') && !CMD.can(cid, 'moderate')) return { error: 'Moderators and owners create missions.' };
    const title = String(form.title || '').trim();
    if (!title) return { error: 'Give the mission a title.' };
    const m = {
      id: uid('ms'), title, desc: String(form.desc || '').trim(), mode: form.mode === 'auto' ? 'auto' : 'review',
      metric: form.metric || 'answers', target: Math.max(1, Math.min(50, +form.target || 1)),
      points: Math.max(5, Math.min(200, +form.points || 20)), badge: String(form.badge || title).trim().slice(0, 40), icon: form.icon || 'flag',
      custom: true, created: Date.now()
    };
    (P.missions[cid] = P.missions[cid] || []).push(m);
    save();
    return m;
  }
  function toggleMission(cid, mid) {
    const off = P.missionOff[cid] = P.missionOff[cid] || [];
    const i = off.indexOf(mid);
    if (i > -1) off.splice(i, 1); else off.push(mid);
    save();
    return i > -1;
  }
  function removeMission(cid, mid) { P.missions[cid] = (P.missions[cid] || []).filter(m => m.id !== mid); save(); }

  /* 29 · Event check-in → attendance credential. Only once the event has
     started, only if you said you were going. */
  function checkIn(cid, eid) {
    const e = CMD.events(cid).find(x => x.id === eid);
    if (!e) return { error: 'Event not found.' };
    if (e.start > Date.now() + 10 * 60000) return { error: 'Check-in opens ten minutes before the start.' };
    if (Date.now() > e.start + (e.mins + 24 * 60) * 60000) return { error: 'Check-in closed a day after the event.' };
    if ((e.going || []).indexOf(me().handle) < 0) return { error: 'Tap “Follow event” first so you are on the list.' };
    const map = P.checkins[cid] = P.checkins[cid] || {};
    if (map[eid]) return { error: 'You already checked in.' };
    map[eid] = Date.now();
    save();
    CMD.addRep(cid, 5);
    const b = issue({ kind: 'event', cid, title: 'Attended: ' + e.title, icon: 'event_available', ref: eid });
    return { ok: true, badge: b };
  }
  const checkedIn = (cid, eid) => !!((P.checkins[cid] || {})[eid]);

  /* ══════════════════════════════════════════════════════════════════
     9 · 10 · 11  Governance
     ══════════════════════════════════════════════════════════════════ */

  const PROPOSAL_TYPES = [
    ['rule', 'Rule change', 'gavel'], ['event', 'Event', 'event'], ['priority', 'Priority', 'flag'],
    ['budget', 'Budget / treasury', 'account_balance_wallet'], ['role', 'Role or moderator', 'shield_person'], ['collab', 'Collaboration', 'handshake']
  ];
  const VOTE_MODES = [
    ['member', 'One member, one vote', 'Every member who joined before voting opened counts once.'],
    ['reputation', 'Reputation-weighted', 'Weight = 1 + √reputation, capped at 10 so no one dominates.'],
    ['pass', 'Membership-pass holders', 'Only members holding this community\'s pass can vote.'],
    ['token', 'Wallet-verified (optional)', 'Requires a connected wallet; weight grows slowly with balance and is capped at 5. Wallets are never required to join.']
  ];

  function govSettings(cid) {
    return P.govSettings[cid] || { proposeRole: 'member', proposeRep: 0, mode: 'member', quorum: 40, days: 5, passPct: 50, publicBallots: true };
  }
  function saveGovSettings(cid, patch) {
    if (!CMD.can(cid, 'manage')) return { error: 'Changing governance rules needs the manage permission.' };
    const before = govSettings(cid);
    P.govSettings[cid] = { ...before, ...patch };
    save();
    logGov(cid, 'settings', { changed: Object.keys(patch).filter(k => before[k] !== patch[k]) });
    return P.govSettings[cid];
  }

  const PROPOSAL_SEED = {
    crypto:  ['Fund a plain-language docs sprint', 'budget', 'Pay three members to rewrite getting-started docs for non-developers.', 'New members ask the same five questions every day in #help.', 'Budget of 1,200 from the treasury, released in two milestones after review.', 'Repeat questions in #help halve within a month.'],
    gaming:  ['Run a monthly charity tournament', 'event', 'A recurring bracket where entry is free and the prize pool is donated.', 'Our biggest turnout days were community tournaments.', 'Last Saturday monthly, squads of four, results posted to the knowledge base.', '150+ players per event.'],
    creator: ['Start a feedback-for-feedback rule', 'rule', 'Posting work in #feedback requires giving feedback to one other post first.', 'Critique requests outnumber critiques four to one.', 'AutoMod reminder plus a pinned guide; moderators enforce for the first month.', 'Every post gets at least one real critique.'],
    music:   ['Quarterly compilation album', 'priority', 'Release a members\' compilation every quarter.', 'Members want a reason to finish tracks.', 'Open call, blind listening panel of five, mastering funded from the treasury.', 'Ten finished tracks per release.'],
    tech:    ['Adopt a code of conduct for reviews', 'rule', 'A short, enforceable code for how we review each other\'s code.', 'A few harsh reviews drove away new contributors.', 'Three rules pinned in #showcase; repeated violations lose the Reviewer role.', 'Showcase posts up 30%.'],
    sports:  ['No-spoiler match threads', 'rule', 'Match threads hide the score in titles for 12 hours.', 'Members in other time zones keep getting spoiled.', 'Title format enforced by AutoMod; scores go inside spoiler tags.', 'Fewer complaints and more late-night threads.'],
    finance: ['Sources required on research posts', 'rule', 'Research posts need at least one primary source.', 'Unsourced claims spread fast.', 'Posts without a source are held for review in #research.', 'Share of sourced research posts over 90%.'],
    science: ['Monthly replication club', 'event', 'Pick one result a month and try to replicate it together.', 'Members want hands-on practice, not only reading.', 'Vote on the paper in week one, share methods by week three.', 'Three completed replications by year end.'],
    brand:   ['Pick the next feature to build', 'priority', 'Choose between offline mode, better search, and creator analytics.', 'All three are requested weekly; we can build one this quarter.', 'Winning option is scheduled; the other two go back to the board next quarter.', 'Shipped within the quarter.'],
    learning:['Scholarships for the next cohort', 'budget', 'Fund ten free places in cohort six.', 'Cost is the main reason people drop out before starting.', 'Budget of 800 from the treasury; applications reviewed blind by three volunteers.', 'Ten scholars, eight finishing.']
  };
  const PROPOSAL_COMMON = [
    ['Monthly community call on stage', 'event', 'Hold a 60-minute town hall on stage on the first Tuesday of each month.', 'Updates are scattered across channels and people miss them.', 'Owner hosts; notes are posted to the knowledge base within 48 hours.', 'At least 80 attendees on average.'],
    ['Add a paid job board channel', 'priority', 'Let companies pay to post jobs in a dedicated channel.', 'Some members want income for the community.', 'A #jobs channel limited to paid posts, reviewed by moderators.', 'Covers moderation costs.']
  ];

  function proposals(cid) {
    if (!P.proposals[cid]) seedGovernance(cid);
    const list = P.proposals[cid] || [];
    list.forEach(p => settle(cid, p));
    return list;
  }

  function seedGovernance(cid) {
    const c = CMD.byId(cid);
    if (!c) return;
    const mem = CMD.members(cid).filter(m => !m.you && !m.bot);
    const who = i => mem[(i * 5 + 2) % Math.max(1, mem.length)] || { name: 'Member', handle: '@member' };
    const owner = CMD.ownerOf(c);
    const first = PROPOSAL_SEED[c.category] || PROPOSAL_SEED.tech;
    const defs = [
      { d: PROPOSAL_COMMON[1], status: 'rejected', start: -24, end: -19, tally: [31, 58, 12] },
      { d: PROPOSAL_COMMON[0], status: 'implemented', start: -14, end: -9, tally: [124, 21, 9], impl: 'Scheduled as a recurring stage event. First call held; notes are in the knowledge base.' },
      { d: first, status: 'voting', start: -2, end: 3, tally: [58, 17, 6] }
    ];
    P.proposals[cid] = defs.map((x, i) => {
      const a = who(i);
      return {
        id: 'gp' + i + cid, cid, title: x.d[0], type: x.d[1], summary: x.d[2], motivation: x.d[3], spec: x.d[4], metric: x.d[5],
        options: ['For', 'Against', 'Abstain'], mode: 'member', quorum: 40, passPct: 50,
        author: a.name, handle: a.handle, created: Date.now() + (x.start - 1) * DAY, start: Date.now() + x.start * DAY, end: Date.now() + x.end * DAY,
        status: x.status, votes: {}, seedTally: x.tally, seed: true, comments: [],
        implementedBy: x.impl ? owner : null, implNote: x.impl || null, implAt: x.impl ? Date.now() - 6 * DAY : null
      };
    });
    P.govLog[cid] = [];
    const entries = [];
    P.proposals[cid].forEach(p => {
      entries.push({ at: p.created, action: 'proposed', actor: p.handle, pid: p.id, detail: { title: p.title, type: p.type } });
      entries.push({ at: p.start, action: 'voting-opened', actor: '@governance', pid: p.id, detail: { mode: p.mode, quorum: p.quorum } });
      if (p.status !== 'voting') entries.push({ at: p.end, action: p.status === 'rejected' ? 'rejected' : 'passed', actor: '@governance', pid: p.id, detail: { tally: p.seedTally } });
      if (p.status === 'implemented') entries.push({ at: p.implAt, action: 'implemented', actor: p.implementedBy, pid: p.id, detail: { note: p.implNote } });
    });
    entries.sort((a, b) => a.at - b.at).forEach(e => appendGov(cid, e, true));
    save();
  }

  function appendGov(cid, e, seed) {
    const log = P.govLog[cid] = P.govLog[cid] || [];
    const prev = log.length ? log[log.length - 1].hash : '0'.repeat(64);
    const body = { at: e.at || Date.now(), action: e.action, actor: e.actor, pid: e.pid || null, detail: e.detail || {} };
    log.push({ i: log.length, ...body, prev, hash: sha256(prev + '|' + canon(body)), seed: !!seed });
  }
  function logGov(cid, action, detail, pid) {
    if (!P.govLog[cid]) proposals(cid);
    appendGov(cid, { action, actor: me().handle, pid, detail });
    save();
    emit('governance', { cid, action, pid });
  }
  function govLog(cid) { if (!P.govLog[cid]) proposals(cid); return P.govLog[cid] || []; }

  function verifyGov(cid) {
    const log = govLog(cid);
    let prev = '0'.repeat(64);
    for (let i = 0; i < log.length; i++) {
      const e = log[i];
      const body = { at: e.at, action: e.action, actor: e.actor, pid: e.pid, detail: e.detail };
      if (e.prev !== prev || sha256(prev + '|' + canon(body)) !== e.hash) return { ok: false, at: i, count: log.length };
      prev = e.hash;
    }
    return { ok: true, count: log.length, root: prev };
  }

  function exportGov(cid) {
    const c = CMD.byId(cid);
    return {
      community: { id: cid, name: c ? c.name : cid }, exported: new Date().toISOString(),
      settings: govSettings(cid), proposals: proposals(cid), log: govLog(cid), verification: verifyGov(cid),
      howToVerify: 'For each entry in order: hash = SHA-256(prev + "|" + canonicalJSON({at,action,actor,pid,detail})). prev is the previous entry\'s hash, 64 zeros for the first. Canonical JSON sorts object keys.',
      note: 'Entries marked seed are demo history. Nothing here was written on-chain; the root hash can be anchored by anyone who chooses to.'
    };
  }

  function weightFor(cid, mode) {
    const w = wallet();
    if (mode === 'reputation') return Math.min(10, 1 + Math.floor(Math.sqrt(CMD.rep(cid) || 0)));
    if (mode === 'pass') return P.myPasses[cid] ? 1 : 0;
    if (mode === 'token') {
      if (!w) return 0;
      const amt = (w.native && w.native.amount) || 0;
      return Math.min(5, 1 + Math.floor(Math.log10(amt * 100 + 1)));
    }
    return 1;
  }

  const isYesNo = p => p.options[0] === 'For' && p.options[1] === 'Against';

  function tally(p) {
    const t = p.options.map((_, i) => (p.seedTally && p.seedTally[i]) || 0);
    Object.values(p.votes || {}).forEach(v => { t[v.opt] = (t[v.opt] || 0) + v.weight; });
    const total = t.reduce((s, n) => s + n, 0);
    const decisive = (t[0] || 0) + (t[1] || 0);
    const top = t.indexOf(Math.max(...t));
    return { t, total, forPct: decisive ? Math.round((t[0] / decisive) * 100) : 0, quorumMet: total >= (p.quorum || 0), top };
  }

  /* A yes/no proposal passes on quorum plus a For majority above the pass
     line. A multiple-choice proposal passes on quorum and records the
     leading option as the decision. */
  function outcome(p) {
    const r = tally(p);
    if (!r.quorumMet) return { status: 'rejected', r, why: 'quorum not met' };
    if (isYesNo(p)) return { status: r.forPct > (p.passPct || 50) ? 'passed' : 'rejected', r };
    return { status: r.total ? 'passed' : 'rejected', r, winner: r.total ? p.options[r.top] : null };
  }

  function settle(cid, p) {
    if (['discussion', 'voting'].indexOf(p.status) < 0) return;
    if (p.status === 'discussion' && Date.now() >= p.start) { p.status = 'voting'; appendGov(cid, { at: p.start, action: 'voting-opened', actor: '@governance', pid: p.id, detail: { mode: p.mode } }); save(); }
    if (p.status === 'voting' && Date.now() >= p.end) {
      const o = outcome(p);
      p.status = o.status;
      if (o.winner) p.winner = o.winner;
      appendGov(cid, { at: p.end, action: p.status, actor: '@governance', pid: p.id, detail: { tally: o.r.t, quorumMet: o.r.quorumMet, winner: o.winner || undefined } });
      save();
    }
  }

  /* An owner can close a vote early once quorum is reached. It is written
     into the history as an early close, so nobody can do it quietly. */
  function closeEarly(cid, pid) {
    const p = proposals(cid).find(x => x.id === pid);
    if (!p || p.status !== 'voting') return { error: 'Only an open vote can be closed.' };
    if (!CMD.can(cid, 'manage')) return { error: 'Only the owner can close a vote early.' };
    const o = outcome(p);
    if (!o.r.quorumMet) return { error: `Quorum is ${p.quorum} and the vote has ${o.r.total}. It cannot close early.` };
    p.status = o.status;
    if (o.winner) p.winner = o.winner;
    p.end = Date.now();
    appendGov(cid, { action: 'closed-early', actor: me().handle, pid, detail: { tally: o.r.t, result: o.status, winner: o.winner || undefined } });
    save();
    return { ok: true, status: p.status };
  }

  function canPropose(cid) {
    if (!CMD.isJoined(cid)) return { ok: false, why: 'Join the community to propose.' };
    const s = govSettings(cid);
    const need = CMD.roleById(cid, s.proposeRole || 'member');
    if (CMD.myLevel(cid) < need.level) return { ok: false, why: `Proposals need the ${need.name} role.` };
    if ((CMD.rep(cid) || 0) < (s.proposeRep || 0)) return { ok: false, why: `Proposals need ${s.proposeRep} reputation — you have ${CMD.rep(cid)}.` };
    return { ok: true };
  }

  function propose(cid, form) {
    const gate = canPropose(cid);
    if (!gate.ok) return { error: gate.why };
    const title = String(form.title || '').trim();
    if (title.length < 6) return { error: 'Give the proposal a clear title.' };
    if (String(form.summary || '').trim().length < 12) return { error: 'Write a one-paragraph summary.' };
    const scan = aiScan([form.title, form.summary, form.motivation, form.spec].join(' '), cid);
    if (scan.score >= 75) return { error: 'The AI Moderator blocked this proposal: ' + scan.flags.map(f => f.label).join(', ') };
    const s = govSettings(cid);
    const discuss = Math.max(0, Math.min(72, +form.discussHours || 0));
    const days = Math.max(1, Math.min(14, +form.days || s.days));
    const opts = String(form.options || '').split('\n').map(x => x.trim()).filter(Boolean);
    const m = me();
    const p = {
      id: uid('gp'), cid, title, type: form.type || 'priority', summary: String(form.summary).trim(),
      motivation: String(form.motivation || '').trim(), spec: String(form.spec || '').trim(), metric: String(form.metric || '').trim(),
      options: opts.length >= 2 ? opts.slice(0, 6) : ['For', 'Against', 'Abstain'],
      mode: form.mode || s.mode, quorum: s.quorum, passPct: s.passPct,
      amount: form.type === 'budget' ? Math.max(0, +form.amount || 0) : 0,
      author: m.name, handle: m.handle, created: Date.now(), start: Date.now() + discuss * HOUR, end: Date.now() + discuss * HOUR + days * DAY,
      status: discuss ? 'discussion' : 'voting', votes: {}, comments: []
    };
    proposals(cid).unshift(p);
    appendGov(cid, { action: 'proposed', actor: m.handle, pid: p.id, detail: { title: p.title, type: p.type, mode: p.mode, amount: p.amount || undefined } });
    if (!discuss) appendGov(cid, { action: 'voting-opened', actor: '@governance', pid: p.id, detail: { mode: p.mode, quorum: p.quorum } });
    save();
    CMD.addRep(cid, 4);
    emit('proposal', { cid, pid: p.id });
    return p;
  }

  function vote(cid, pid, opt) {
    const p = proposals(cid).find(x => x.id === pid);
    if (!p) return { error: 'Proposal not found.' };
    if (p.status !== 'voting') return { error: p.status === 'discussion' ? 'Voting has not opened yet.' : 'Voting has closed.' };
    if (!CMD.isJoined(cid)) return { error: 'Join the community to vote.' };
    const weight = weightFor(cid, p.mode);
    if (!weight) return { error: p.mode === 'pass' ? 'This vote is for membership-pass holders.' : 'This vote needs a connected wallet — connecting is optional and only reads your public address.' };
    const h = me().handle;
    const had = p.votes[h];
    if (had && had.opt === opt) return { error: 'You already voted for that option.' };
    p.votes[h] = { opt, weight, at: Date.now() };
    const s = govSettings(cid);
    appendGov(cid, { action: had ? 'vote-changed' : 'voted', actor: h, pid, detail: s.publicBallots === false ? { weight } : { option: p.options[opt], weight } });
    save();
    if (!had) CMD.addRep(cid, 1);
    emit('vote', { cid, pid });
    return { ok: true, weight };
  }

  function commentProposal(cid, pid, text) {
    const p = proposals(cid).find(x => x.id === pid);
    const t = String(text || '').trim();
    if (!p || !t) return { error: 'Write a comment.' };
    const check = CMD.screen(cid, 'boards', t);
    if (check && !check.ok) return { error: check.why };
    const m = me();
    p.comments.push({ id: uid('pc'), name: m.name, handle: m.handle, text: t, ts: Date.now() });
    save();
    return { ok: true };
  }

  function implement(cid, pid, note) {
    const p = proposals(cid).find(x => x.id === pid);
    if (!p) return { error: 'Proposal not found.' };
    if (p.status !== 'passed') return { error: 'Only passed proposals can be marked implemented.' };
    if (!CMD.can(cid, 'manage') && !CMD.can(cid, 'moderate')) return { error: 'Moderators or the owner mark proposals implemented.' };
    p.status = 'implemented';
    p.implementedBy = me().handle;
    p.implNote = String(note || '').trim() || 'Implemented.';
    p.implAt = Date.now();
    appendGov(cid, { action: 'implemented', actor: me().handle, pid, detail: { note: p.implNote } });
    save();
    addProof('governance', cid, pid, 'Implemented: ' + p.title);
    return { ok: true };
  }

  function cancelProposal(cid, pid) {
    const p = proposals(cid).find(x => x.id === pid);
    if (!p || p.handle !== me().handle || ['discussion', 'voting'].indexOf(p.status) < 0) return { error: 'Only the author can withdraw an open proposal.' };
    p.status = 'withdrawn';
    appendGov(cid, { action: 'withdrawn', actor: me().handle, pid, detail: {} });
    save();
    return { ok: true };
  }

  /* ── 18 · Treasury ───────────────────────────────────────────────── */
  function treasury(cid) {
    if (P.treasury[cid]) return P.treasury[cid];
    const c = CMD.byId(cid);
    if (!c) return null;
    const mem = CMD.members(cid).filter(m => !m.you && !m.bot);
    const owner = CMD.ownerOf(c);
    const helpers = mem.filter(m => (m.role === 'admin' || m.role === 'mod') && m.handle !== owner).slice(0, 2).map(m => m.handle);
    for (let i = 0; helpers.length < 2 && i < mem.length; i++) {
      if (mem[i].handle !== owner && helpers.indexOf(mem[i].handle) < 0) helpers.push(mem[i].handle);
    }
    const seeded = !!c.verified && !c.mine && !c.owner;
    const r = rng(cid + ':treasury');
    const ledger = seeded ? [
      { id: 'tl0' + cid, at: Date.now() - 40 * DAY, kind: 'in', amount: Math.round(1800 + r() * 2400), memo: 'Supporter memberships — last quarter', seed: true },
      { id: 'tl1' + cid, at: Date.now() - 22 * DAY, kind: 'in', amount: Math.round(600 + r() * 1400), memo: 'Event sponsorship from a partner community', seed: true },
      { id: 'tl2' + cid, at: Date.now() - 8 * DAY, kind: 'out', amount: Math.round(300 + r() * 500), memo: 'Stage equipment for the monthly community call (passed proposal)', seed: true }
    ] : [];
    P.treasury[cid] = {
      enabled: seeded, attested: seeded ? { by: owner, at: Date.now() - 60 * DAY, adult: true } : null,
      signers: [owner].concat(helpers).slice(0, 3), threshold: 2, ledger, requests: [], seed: seeded
    };
    save();
    return P.treasury[cid];
  }
  const balance = cid => (treasury(cid) ? treasury(cid).ledger.reduce((s, e) => s + (e.kind === 'in' ? e.amount : -e.amount), 0) : 0);

  function enableTreasury(cid, opts) {
    if (!CMD.can(cid, 'manage')) return { error: 'Only the owner can switch the treasury on.' };
    if (!opts || !opts.adult || !opts.rules) return { error: 'Confirm that the community is managed by adults and that spending follows passed proposals.' };
    const t = treasury(cid);
    t.enabled = true;
    t.attested = { by: me().handle, at: Date.now(), adult: true };
    if (t.signers.indexOf(me().handle) < 0) t.signers[0] = me().handle;
    t.threshold = Math.max(1, Math.min(t.signers.length, +opts.threshold || 2));
    save();
    logGov(cid, 'treasury-enabled', { threshold: t.threshold, signers: t.signers });
    return t;
  }
  function setSigners(cid, signers, threshold) {
    if (!CMD.can(cid, 'manage')) return { error: 'Only the owner manages signers.' };
    const t = treasury(cid);
    t.signers = signers.filter(Boolean).slice(0, 7);
    t.threshold = Math.max(1, Math.min(t.signers.length, +threshold || 2));
    save();
    logGov(cid, 'signers-changed', { signers: t.signers, threshold: t.threshold });
    return t;
  }

  function requestSpend(cid, pid, amount, memo) {
    const t = treasury(cid);
    if (!t || !t.enabled) return { error: 'This community has no treasury switched on.' };
    const p = proposals(cid).find(x => x.id === pid);
    if (!p || p.type !== 'budget' || ['passed', 'implemented'].indexOf(p.status) < 0) return { error: 'Spending needs a passed budget proposal.' };
    const amt = Math.round(+amount || 0);
    if (amt <= 0) return { error: 'Enter an amount.' };
    if (amt > balance(cid)) return { error: 'The treasury does not hold that much.' };
    if (!CMD.can(cid, 'moderate') && !CMD.can(cid, 'manage')) return { error: 'Moderators or signers raise spend requests.' };
    const req = { id: uid('sr'), pid, amount: amt, memo: String(memo || p.title).trim(), approvals: [], status: 'pending', at: Date.now(), by: me().handle };
    t.requests.unshift(req);
    save();
    logGov(cid, 'spend-requested', { amount: amt, memo: req.memo }, pid);
    return req;
  }

  function approveSpend(cid, rid, simulateCoSigner) {
    const t = treasury(cid);
    const req = t && t.requests.find(x => x.id === rid);
    if (!req || req.status !== 'pending') return { error: 'Request not found.' };
    let who = me().handle;
    if (simulateCoSigner) {
      const c = CMD.byId(cid);
      if (!c || !CMD.iOwn(c)) return { error: 'Co-signer simulation is only for communities you own.' };
      who = t.signers.find(s => s !== me().handle && req.approvals.indexOf(s) < 0);
      if (!who) return { error: 'Every signer has approved.' };
    } else if (t.signers.indexOf(who) < 0) return { error: 'You are not a signer on this treasury.' };
    if (req.approvals.indexOf(who) > -1) return { error: 'Already approved by ' + who };
    req.approvals.push(who);
    logGov(cid, 'spend-approved', { amount: req.amount, signer: who, simulated: !!simulateCoSigner || undefined }, req.pid);
    if (req.approvals.length >= t.threshold) {
      req.status = 'executed';
      t.ledger.unshift({ id: uid('tl'), at: Date.now(), kind: 'out', amount: req.amount, memo: req.memo, pid: req.pid, approvals: req.approvals.slice() });
      logGov(cid, 'spend-executed', { amount: req.amount, approvals: req.approvals }, req.pid);
    }
    save();
    return req;
  }

  /* ── 19 · Crowdfunding ───────────────────────────────────────────── */
  const FUND_SEED = {
    crypto: ['Independent audit of our open-source wallet tools', 'Two auditors, public report, fixes tracked in the open.', 8000],
    gaming: ['Charity tournament prize pool and stream kit', 'Capture cards, a caster headset and a donated prize pool.', 2500],
    creator: ['Community short film', 'Twelve members, one script, a weekend shoot and a festival submission.', 4000],
    music: ['Mastering for the members\' compilation', 'Professional mastering and distribution for ten tracks.', 1800],
    tech: ['Maintainer stipend for our open-source CLI', 'Six months of part-time maintenance and a security review.', 6000],
    sports: ['Kits for a grassroots youth team', 'Kits, balls and first-aid supplies, delivered by members.', 1500],
    finance: ['Open data: a free earnings calendar', 'Hosting and a part-time data cleaner for a public dataset.', 3000],
    science: ['Materials for the replication club', 'Lab consumables and data storage for three replications.', 2200],
    brand: ['Accessibility audit of the app', 'An external audit and fixes for screen readers and contrast.', 5000],
    learning: ['Ten scholarships for cohort six', 'Free places for people who cannot afford the course.', 1600]
  };
  function funding(cid) {
    if (P.funding[cid]) return P.funding[cid];
    const c = CMD.byId(cid);
    if (!c) return [];
    const s = FUND_SEED[c.category] || FUND_SEED.tech;
    const r = rng(cid + ':fund');
    const raised = Math.round(s[2] * (0.35 + r() * 0.5));
    P.funding[cid] = [{
      id: 'fc0' + cid, cid, title: s[0], desc: s[1], goal: s[2], seedRaised: raised, seedBackers: Math.round(raised / (25 + r() * 40)),
      pledges: [], deadline: Date.now() + Math.round(6 + r() * 20) * DAY, creator: CMD.ownerOf(c), seed: true, status: 'live',
      milestones: [{ t: 'Plan and budget published', pct: 25, status: 'released' }, { t: 'Work delivered', pct: 50, status: 'locked' }, { t: 'Report to backers', pct: 25, status: 'locked' }]
    }];
    save();
    return P.funding[cid];
  }
  const raised = f => (f.seedRaised || 0) + f.pledges.reduce((s, p) => s + p.amount, 0);
  const backers = f => (f.seedBackers || 0) + f.pledges.length;

  function back(cid, fid, amount) {
    const f = funding(cid).find(x => x.id === fid);
    if (!f) return { error: 'Campaign not found.' };
    if (f.status !== 'live' || Date.now() > f.deadline) return { error: 'This campaign is closed.' };
    const amt = Math.round(+amount || 0);
    if (amt < 1 || amt > 500) return { error: 'Pledges are between 1 and 500 in this demo.' };
    f.pledges.push({ handle: me().handle, amount: amt, at: Date.now() });
    if (raised(f) >= f.goal) f.status = 'funded';
    save();
    addProof('pledge', cid, fid, `Pledged ${amt} (simulated) to ${f.title}`);
    emit('pledge', { cid, fid });
    return { ok: true, funded: f.status === 'funded' };
  }

  function addCampaign(cid, form) {
    if (!CMD.can(cid, 'manage') && !CMD.can(cid, 'moderate')) return { error: 'Moderators and owners start campaigns.' };
    const title = String(form.title || '').trim();
    const goal = Math.round(+form.goal || 0);
    if (!title || goal < 100) return { error: 'A campaign needs a title and a goal of at least 100.' };
    const scan = aiScan(title + ' ' + (form.desc || ''), cid);
    if (scan.score >= 60) return { error: 'The AI Moderator flagged this campaign: ' + scan.flags.map(f => f.label).join(', ') };
    const f = {
      id: uid('fc'), cid, title, desc: String(form.desc || '').trim(), goal, pledges: [], creator: me().handle, status: 'live',
      deadline: Date.now() + Math.max(3, Math.min(60, +form.days || 21)) * DAY,
      milestones: String(form.milestones || 'Plan published\nWork delivered\nReport to backers').split('\n').map(t => t.trim()).filter(Boolean).slice(0, 5)
        .map((t, i, arr) => ({ t, pct: Math.round(100 / arr.length), status: 'locked' }))
    };
    funding(cid).unshift(f);
    save();
    return f;
  }
  function releaseMilestone(cid, fid, i) {
    if (!CMD.can(cid, 'manage')) return { error: 'The owner releases milestones.' };
    const f = funding(cid).find(x => x.id === fid);
    if (!f || !f.milestones[i]) return { error: 'Milestone not found.' };
    f.milestones[i].status = 'released';
    f.milestones[i].at = Date.now();
    save();
    logGov(cid, 'milestone-released', { campaign: f.title, milestone: f.milestones[i].t });
    return { ok: true };
  }

  /* ── 16 · Marketplace & 17 · Tips ────────────────────────────────── */
  const KINDS = [['template', 'Templates'], ['course', 'Courses'], ['guide', 'Guides'], ['asset', 'Assets'], ['theme', 'Themes'], ['preset', 'Presets']];
  const MARKET_SEED = {
    crypto: [['Wallet safety checklist', 'guide', 0, 'The twelve checks we walk new members through before they connect anything.', ['Use a separate wallet for testnets and mints.', 'Never type a recovery phrase into a website.', 'Read what a signature asks for; stop if it is unclear.', 'Revoke unlimited approvals you no longer use.', 'Bookmark official sites instead of clicking links.']],
             ['Smart-contract review template', 'template', 12, 'A structured checklist for reading a contract before you trust it.', ['Upgradeability and admin keys', 'Timelocks and pause functions', 'Oracle sources and fallbacks', 'External calls and re-entrancy', 'Test coverage and audits']],
             ['Run your own node — 6 lessons', 'course', 29, 'From hardware choice to monitoring, with the mistakes we made.', ['Lesson 1: Hardware and storage', 'Lesson 2: Sync strategies', 'Lesson 3: Security basics', 'Lesson 4: Monitoring', 'Lesson 5: Upgrades', 'Lesson 6: Troubleshooting']]],
    gaming: [['Aim training routine (4 weeks)', 'guide', 5, 'Daily 20-minute routine with progress checkpoints.', ['Week 1: tracking', 'Week 2: flicks', 'Week 3: target switching', 'Week 4: in-game application']],
             ['Stream overlay theme pack', 'theme', 9, 'Six scenes and alerts in two colour ways.', ['Starting soon', 'Live', 'Be right back', 'Ending', 'Alerts', 'Panels']],
             ['Tournament bracket template', 'template', 0, 'Single and double elimination sheets that update automatically.', ['Seeding sheet', 'Single elimination', 'Double elimination', 'Results export']]],
    creator: [['Thumbnail template pack', 'template', 8, 'Twenty layouts tested across niches.', ['Face + text layouts', 'Object close-ups', 'Before/after splits', 'Colour guide']],
              ['Brand deal contract checklist', 'guide', 0, 'Clauses to read twice before you sign.', ['Usage rights and duration', 'Exclusivity', 'Payment terms', 'Approval rounds', 'Kill fee']],
              ['Cinematic LUT pack', 'preset', 14, 'Twelve looks for log and standard footage.', ['Warm film', 'Cool night', 'Neutral clean', 'High contrast']]],
    music: [['Kitchen objects sample pack', 'asset', 0, '120 one-shots from this month\'s challenge.', ['Percussion', 'Textures', 'Risers', 'FX']],
            ['Mixdown checklist', 'guide', 3, 'A printable pre-bounce checklist.', ['Gain staging', 'Mono check', 'Reference track', 'Headroom', 'Break before bounce']],
            ['Vocal chain presets', 'preset', 11, 'Five chains for common DAWs.', ['Clean pop', 'Warm R&B', 'Rap presence', 'Airy', 'Lo-fi']]],
    tech: [['System design interview guide', 'guide', 15, 'Frameworks and worked examples.', ['Clarify requirements', 'Estimate load', 'Sketch components', 'Deep-dive a bottleneck', 'Trade-offs']],
           ['CI pipeline templates', 'template', 0, 'Copy-ready pipelines for common stacks.', ['Node', 'Python', 'Go', 'Monorepo']],
           ['README templates', 'template', 4, 'Six README layouts that get contributors.', ['Library', 'CLI', 'App', 'API', 'Research', 'Starter']]],
    sports: [['Match analysis template', 'template', 0, 'A one-page sheet for tactical notes.', ['Formations', 'Pressing triggers', 'Key duels', 'Set pieces']],
             ['8-week amateur training plan', 'course', 12, 'Fitness and ball work for weekend players.', ['Weeks 1–2 base', 'Weeks 3–4 speed', 'Weeks 5–6 match fitness', 'Weeks 7–8 taper']]],
    finance: [['Earnings model template', 'template', 18, 'A clean three-statement sheet with notes.', ['Income statement', 'Balance sheet', 'Cash flow', 'Scenario tab']],
              ['Macro calendar planner', 'template', 0, 'Weekly planner with plain-language release notes.', ['Inflation releases', 'Jobs data', 'Central bank dates', 'Earnings weeks']]],
    science: [['Paper reading template', 'template', 0, 'Structured notes for any paper.', ['Question', 'Method', 'Result', 'Limitations', 'Would it replicate?']],
              ['Lab notebook template', 'template', 6, 'Digital notebook pages with version notes.', ['Protocol', 'Observations', 'Data links', 'Deviations']]],
    brand: [['Trending UI kit', 'asset', 0, 'Components and tokens for community mock-ups.', ['Colours', 'Type scale', 'Cards', 'Buttons']],
            ['Community launch playbook', 'guide', 19, 'The first 30 days of a new community.', ['Week 1: rules and channels', 'Week 2: first event', 'Week 3: missions', 'Week 4: first proposal']]],
    learning: [['Study planner', 'template', 0, 'Six-week cohort planner with check-ins.', ['Goals', 'Weekly plan', 'Friday check-in', 'Reflection']],
               ['Statistics flashcards', 'asset', 5, '200 cards from basics to regression.', ['Descriptive stats', 'Probability', 'Inference', 'Regression']]]
  };

  function market(cid) {
    if (P.market[cid]) return P.market[cid];
    const c = CMD.byId(cid);
    if (!c) return [];
    const mem = CMD.members(cid).filter(m => !m.you && !m.bot);
    const r = rng(cid + ':market');
    P.market[cid] = (MARKET_SEED[c.category] || MARKET_SEED.tech).map((x, i) => {
      const a = mem[(i * 7 + 4) % Math.max(1, mem.length)] || { name: 'Creator', handle: '@creator' };
      return { id: 'ml' + i + cid, cid, title: x[0], kind: x[1], price: x[2], desc: x[3], content: x[4], seller: a.name, handle: a.handle,
        sales: Math.floor(20 + r() * 600), rating: +(4 + r() * 0.9).toFixed(1), crypto: i % 2 === 1, license: 'Personal use', seed: true, at: Date.now() - (i + 2) * 5 * DAY };
    });
    save();
    return P.market[cid];
  }
  const owns = (cid, lid) => P.library.some(l => l.cid === cid && l.lid === lid);

  function buy(cid, lid, method) {
    const l = market(cid).find(x => x.id === lid);
    if (!l) return { error: 'Listing not found.' };
    if (owns(cid, lid)) return { error: 'Already in your library.' };
    if (l.handle === me().handle) return { error: 'This is your own listing.' };
    if (method === 'crypto' && !l.crypto) return { error: 'This seller only accepts the standard checkout.' };
    const receipt = { cid, lid, title: l.title, price: l.price, method: l.price ? (method || 'card') : 'free', at: Date.now(), seller: l.handle, simulated: true };
    P.library.unshift({ ...receipt, digest: sha256(canon(receipt)) });
    l.sales = (l.sales || 0) + 1;
    save();
    emit('purchase', { cid, lid });
    return { ok: true };
  }

  function sell(cid, form) {
    if (!CMD.isJoined(cid)) return { error: 'Join the community to sell here.' };
    if (CMD.myLevel(cid) < 30 && !CMD.can(cid, 'manage')) return { error: 'Selling needs the Contributor role or above — it unlocks at 60 reputation.' };
    const title = String(form.title || '').trim();
    if (title.length < 4) return { error: 'Give the listing a title.' };
    const price = Math.max(0, Math.min(500, +form.price || 0));
    const content = String(form.content || '').split('\n').map(x => x.trim()).filter(Boolean);
    if (!content.length) return { error: 'Add what the buyer receives, one item per line.' };
    const scan = aiScan([title, form.desc, content.join(' ')].join(' '), cid);
    if (scan.score >= 55) return { error: 'The AI Moderator blocked this listing: ' + scan.flags.map(f => f.label).join(', ') };
    const m = me();
    const l = { id: uid('ml'), cid, title, kind: form.kind || 'guide', price, desc: String(form.desc || '').trim(), content, seller: m.name, handle: m.handle,
      sales: 0, rating: 0, crypto: !!form.crypto, license: form.license || 'Personal use', at: Date.now(), mine: true };
    market(cid).unshift(l);
    save();
    CMD.addRep(cid, 3);
    return l;
  }
  function unlist(cid, lid) {
    const l = market(cid).find(x => x.id === lid);
    if (!l) return;
    if (l.handle !== me().handle && !CMD.can(cid, 'moderate')) return;
    P.market[cid] = market(cid).filter(x => x.id !== lid);
    if (l.handle !== me().handle) CMD.logMod(cid, 'unlist', l.handle, l.title);
    save();
  }
  const library = () => P.library;

  /* Tips are simulated credits. A crypto tip is only offered to someone
     who has added a receiving address that matches a wallet they
     connected — nobody else gets an address shown, so no one can be sent
     to a made-up one. */
  const TIP_CAP = 100;
  function tipsToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return P.tips.filter(t => t.at >= d.getTime()).reduce((s, t) => s + t.amount, 0); }
  function tip(cid, handle, name, amount, note) {
    const amt = Math.round(+amount || 0);
    if (handle === me().handle) return { error: 'You cannot tip yourself.' };
    if (amt < 1 || amt > 50) return { error: 'Tips are between 1 and 50 credits.' };
    if (tipsToday() + amt > TIP_CAP) return { error: `Daily tipping limit is ${TIP_CAP} credits — a safeguard against mistakes and pressure.` };
    const scan = aiScan(note || '', cid);
    if (scan.score >= 60) return { error: 'The note was blocked: ' + scan.flags.map(f => f.label).join(', ') };
    P.tips.unshift({ id: uid('tp'), cid, handle, name, amount: amt, note: String(note || '').slice(0, 140), at: Date.now(), simulated: true });
    bumpTrust(handle, name, 2);
    save();
    emit('tip', { cid, handle });
    return { ok: true, left: TIP_CAP - tipsToday() };
  }
  const tips = () => P.tips;

  function setPayout() {
    const w = wallet();
    if (!w) return { error: 'Connect the wallet you want to receive tips on.' };
    if (w.simulated) return { error: 'Demo wallets cannot receive anything — connect a real wallet.' };
    P.payout = { address: w.address, net: w.net, label: w.label, at: Date.now() };
    save();
    return P.payout;
  }
  function clearPayout() { P.payout = null; save(); }
  const payout = () => P.payout;

  /* ══════════════════════════════════════════════════════════════════
     20 · 28  Collaboration across communities
     ══════════════════════════════════════════════════════════════════ */

  function collabs() {
    if (!P.collabs) {
      const now = Date.now();
      P.collabs = [
        { id: 'kc1', title: 'Charity tournament finals', kind: 'event', goal: 'Raise money for a youth sports charity with a joint bracket.',
          communities: ['gamearena', 'matchday'], host: 'gamearena', accepted: { gamearena: true, matchday: true }, status: 'active', seed: true, created: now - 12 * DAY,
          tasks: [{ t: 'Bracket published', done: true }, { t: 'Casters booked', done: true }, { t: 'Finals stream', done: false }],
          event: { title: 'Charity tournament finals', start: now - 15 * 60000, mins: 150, room: 'Town Hall' }, going: {}, checkins: {} },
        { id: 'kc2', title: 'Open-source audit week', kind: 'project', goal: 'Developers pair with auditors to fix real issues in community tools.',
          communities: ['devcore', 'sec'], host: 'devcore', accepted: { devcore: true, sec: true }, status: 'active', seed: true, created: now - 5 * DAY,
          tasks: [{ t: 'Issue list triaged', done: true }, { t: 'Reviewers assigned', done: false }, { t: 'Public report', done: false }],
          event: { title: 'Audit week kickoff', start: now + 2 * DAY, mins: 60, room: 'Stage' }, going: {}, checkins: {} },
        { id: 'kc3', title: 'Soundtrack a short film', kind: 'project', goal: 'Musicians score the Creator Studio community short.',
          communities: ['studio', 'soundlab'], host: 'studio', accepted: { studio: true, soundlab: true }, status: 'active', seed: true, created: now - 20 * DAY,
          tasks: [{ t: 'Rough cut shared', done: true }, { t: 'Themes drafted', done: true }, { t: 'Final mix', done: false }],
          event: { title: 'Premiere watch party', start: now + 4 * DAY, mins: 90, room: 'Community Live' }, going: {}, checkins: {} },
        { id: 'kc4', title: 'Replication study club', kind: 'project', goal: 'Learners follow along as Lab Notes replicates a result.',
          communities: ['learners', 'labnotes'], host: 'labnotes', accepted: { labnotes: true, learners: true }, status: 'active', seed: true, created: now - 9 * DAY,
          tasks: [{ t: 'Paper chosen', done: true }, { t: 'Methods walkthrough', done: false }], event: null, going: {}, checkins: {} }
      ];
      save();
    }
    return P.collabs;
  }
  const collabsFor = cid => collabs().filter(k => k.communities.indexOf(cid) > -1);
  const collab = id => collabs().find(k => k.id === id) || null;

  function proposeCollab(cid, form) {
    if (!CMD.can(cid, 'manage') && !CMD.can(cid, 'moderate') && !CMD.can(cid, 'events')) return { error: 'Moderators, creators and owners start collaborations.' };
    const partner = CMD.byId(form.partner);
    if (!partner || partner.id === cid) return { error: 'Pick a different partner community.' };
    const title = String(form.title || '').trim();
    if (title.length < 4) return { error: 'Give the collaboration a title.' };
    const iRunPartner = CMD.iOwn(partner) || CMD.can(partner.id, 'manage') || CMD.can(partner.id, 'moderate');
    const k = {
      id: uid('kc'), title, kind: form.kind === 'event' ? 'event' : 'project', goal: String(form.goal || '').trim(),
      communities: [cid, partner.id], host: cid, accepted: { [cid]: true, [partner.id]: iRunPartner }, status: iRunPartner ? 'active' : 'invited',
      created: Date.now(), tasks: String(form.tasks || '').split('\n').map(t => t.trim()).filter(Boolean).slice(0, 8).map(t => ({ t, done: false })),
      event: form.kind === 'event' && form.start ? { title, start: +form.start, mins: Math.max(15, +form.mins || 60), room: 'Stage' } : null,
      going: {}, checkins: {}, by: me().handle
    };
    collabs().unshift(k);
    save();
    logGov(cid, 'collab-proposed', { title, partner: partner.id });
    emit('collab', { id: k.id, cid, partner: partner.id });
    return k;
  }
  function acceptCollab(id, cid) {
    const k = collab(id);
    if (!k) return { error: 'Not found.' };
    if (!CMD.can(cid, 'manage') && !CMD.can(cid, 'moderate')) return { error: 'The partner community\'s moderators accept invitations.' };
    k.accepted[cid] = true;
    if (k.communities.every(x => k.accepted[x])) k.status = 'active';
    save();
    return k;
  }
  function toggleTask(id, i) {
    const k = collab(id);
    if (!k || !k.tasks[i]) return;
    if (!k.communities.some(cid => CMD.isJoined(cid))) return;
    k.tasks[i].done = !k.tasks[i].done;
    k.tasks[i].by = me().handle;
    if (k.tasks.length && k.tasks.every(t => t.done)) k.status = 'done'; else if (k.status === 'done') k.status = 'active';
    save();
  }
  function collabMessages(id) { return P.collabMsgs[id] || []; }
  function postCollab(id, text) {
    const k = collab(id);
    const t = String(text || '').trim();
    if (!k || !t) return { error: 'Write a message.' };
    if (!k.communities.some(cid => CMD.isJoined(cid))) return { error: 'Join one of the partner communities to talk here.' };
    const scan = aiScan(t, k.host);
    if (scan.score >= 60) return { error: 'The AI Moderator blocked that: ' + scan.flags.map(f => f.label).join(', ') };
    const from = k.communities.find(cid => CMD.isJoined(cid));
    const m = me();
    (P.collabMsgs[id] = P.collabMsgs[id] || []).push({ id: uid('km'), name: m.name, handle: m.handle, from, text: t, ts: Date.now() });
    save();
    return { ok: true };
  }
  function rsvpCollab(id) {
    const k = collab(id);
    if (!k || !k.event) return;
    const h = me().handle;
    if (k.going[h]) delete k.going[h]; else k.going[h] = Date.now();
    save();
  }
  function checkInCollab(id) {
    const k = collab(id);
    if (!k || !k.event) return { error: 'No event on this collaboration.' };
    const h = me().handle;
    if (!k.going[h]) return { error: 'RSVP first.' };
    if (k.event.start > Date.now() + 10 * 60000) return { error: 'Check-in opens ten minutes before the start.' };
    if (Date.now() > k.event.start + (k.event.mins + 24 * 60) * 60000) return { error: 'Check-in has closed.' };
    if (k.checkins[h]) return { error: 'Already checked in.' };
    k.checkins[h] = Date.now();
    save();
    const cid = k.communities.find(x => CMD.isJoined(x)) || k.host;
    if (CMD.isJoined(cid)) CMD.addRep(cid, 5);
    return { ok: true, badge: issue({ kind: 'event', cid, title: 'Attended: ' + k.event.title, icon: 'diversity_3', ref: id }) };
  }

  /* ══════════════════════════════════════════════════════════════════
     25  Knowledge base
     ══════════════════════════════════════════════════════════════════ */

  const KB_CATS = ['Getting started', 'FAQ', 'Guides', 'Decisions', 'Safety', 'Glossary'];

  function kb(cid) {
    if (!P.kb[cid]) {
      const c = CMD.byId(cid);
      if (!c) return [];
      const owner = CMD.ownerOf(c);
      const chans = CMD.channels(cid).filter(ch => ['text', 'announce', 'forum'].indexOf(ch.kind) > -1).slice(0, 8).map(ch => '#' + ch.name).join(', ');
      P.kb[cid] = [
        mkArticle(cid, { title: 'Start here: how ' + c.name + ' works', cat: 'Getting started', tags: ['onboarding'],
          body: `${c.desc}\n\nWhere things are: ${chans}.\n\nRead the rules, introduce yourself, and pick your interests — they decide which channels are suggested. Events are listed in Events; decisions are made in Governance; useful answers end up here.`,
          author: c.name + ' team', handle: owner, seed: true, sources: [{ type: 'channel', ref: 'rules', label: '#rules' }] }),
        mkArticle(cid, { title: 'Safety: how to spot a scam here', cat: 'Safety', tags: ['safety', 'scams'],
          body: 'Nobody from this community will ever ask for a recovery phrase, a private key or a "wallet sync".\n\nReal moderators do not start support conversations in DMs.\n\nBe suspicious of urgency, guaranteed returns, and links that look almost like an official site.\n\nReport anything that feels off — the Guardian mission rewards it.',
          author: 'AutoMod', handle: '@automod', seed: true, sources: [{ type: 'channel', ref: 'rules', label: '#rules' }] })
      ];
      save();
    }
    return P.kb[cid];
  }
  function mkArticle(cid, a) {
    const body = { cid, title: a.title, cat: a.cat, body: a.body, tags: a.tags || [], sources: a.sources || [], author: a.author, handle: a.handle, at: a.at || Date.now() };
    return { id: a.id || uid('kb'), ...body, digest: sha256(canon(body)), seed: !!a.seed, views: 0, edits: [] };
  }

  function addArticle(cid, form) {
    if (!CMD.isJoined(cid)) return { error: 'Join the community to write here.' };
    const title = String(form.title || '').trim();
    const text = String(form.body || '').trim();
    if (title.length < 4 || text.length < 30) return { error: 'An article needs a title and at least a few sentences.' };
    const check = CMD.screen(cid, 'boards', title + ' ' + text);
    if (check && !check.ok) return { error: check.why };
    const scan = aiScan(title + ' ' + text, cid);
    if (scan.score >= 60) return { error: 'The AI Moderator blocked this article: ' + scan.flags.map(f => f.label).join(', ') };
    const m = me();
    const a = mkArticle(cid, { title, body: text, cat: KB_CATS.indexOf(form.cat) > -1 ? form.cat : 'Guides',
      tags: String(form.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 6),
      sources: form.sources || [], author: m.name, handle: m.handle });
    kb(cid).unshift(a);
    save();
    CMD.addRep(cid, 8);
    addProof('knowledge', cid, a.id, 'Article: ' + title);
    emit('article', { cid, id: a.id });
    return a;
  }
  function removeArticle(cid, id) {
    const a = kb(cid).find(x => x.id === id);
    if (!a) return;
    if (a.handle !== me().handle && !CMD.can(cid, 'moderate')) return;
    P.kb[cid] = kb(cid).filter(x => x.id !== id);
    save();
  }
  function verifyArticle(a) {
    const body = { cid: a.cid, title: a.title, cat: a.cat, body: a.body, tags: a.tags, sources: a.sources, author: a.author, handle: a.handle, at: a.at };
    return sha256(canon(body)) === a.digest;
  }

  /* FAQ and decisions are derived, not stored — they update themselves. */
  function derivedFaq(cid) {
    const D = CMD.state();
    const out = [];
    ((D.boards || {})[cid] || []).forEach(p => {
      if (!p.solved && !(p.comments || []).length) return;
      const best = (p.comments || []).slice(-1)[0];
      out.push({ q: p.title, a: best ? best.text : p.body, by: best ? best.name : p.author, solved: !!p.solved, bid: p.id });
    });
    rawMsgs(cid).forEach(m => {
      if (m.chan !== 'support' || !/\?\s*$/.test(m.text || '')) return;
      const answer = (m.thread || [])[0];
      if (answer) out.push({ q: m.text, a: answer.text, by: answer.name, solved: true, mid: m.id });
    });
    return out.slice(0, 12);
  }
  const decisions = cid => proposals(cid).filter(p => p.status === 'implemented' || p.status === 'passed');

  /* ══════════════════════════════════════════════════════════════════
     22 · 23 · 24  On-device AI — moderator, assistant, search
     ══════════════════════════════════════════════════════════════════ */

  const OFFICIAL = ['uniswap.org', 'aave.com', 'lido.fi', 'curve.finance', 'jup.ag', 'opensea.io', 'blur.io', 'metamask.io', 'phantom.app', 'coinbase.com',
    'binance.com', 'ledger.com', 'trezor.io', 'safe.global', 'arbitrum.io', 'chain.link', 'ethereum.org', 'bitcoin.org', 'solana.com', 'github.com', 'trending.app',
    'ethereum-magicians.org', 'ethresear.ch', 'etherscan.io', 'solscan.io', 'l2beat.com', 'defillama.com', 'discord.com', 'discord.gg', 'telegram.org',
    'mirror.xyz', 'farcaster.xyz', 'lens.xyz', 'zora.co', 'thegraph.com', 'walletconnect.network', 'rabby.io', 'rainbow.me'];
  const BRANDS = ['uniswap', 'metamask', 'opensea', 'coinbase', 'binance', 'phantom', 'ledger', 'trezor', 'aave', 'lido', 'arbitrum', 'ethereum', 'solana', 'trending', 'discord', 'telegram'];
  const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at', 'tiny.cc', 'ow.ly'];

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 3;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const deconfuse = s => s.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/rn/g, 'm').replace(/vv/g, 'w');

  const PATTERNS = [
    ['seed', 'scam', 60, 'Asks about recovery phrases or private keys', /\b(seed|recovery|secret|backup)\s*(phrase|words?)\b|\bprivate\s*keys?\b|\bmnemonic\b|\b(12|24)[\s-]*words?\b/i],
    ['sync', 'phishing', 40, 'Asks you to "validate", "sync" or "rectify" a wallet', /\b(validate|verify|sync|synchroni[sz]e|rectify|restore|unlock)\s+(your\s+)?(wallet|account|metamask|phantom)\b/i],
    ['support', 'impersonation', 30, 'Pulls "support" into private messages', /\b(dm|pm|message|contact|text)\s+(me|us|our\s+team|support|an?\s+admin)\b[^.]{0,40}\b(help|support|fix|issue|problem|refund|recover)|\b(official|live)\s+support\s+(team|agent|desk)\b/i],
    ['airdrop', 'scam', 35, 'Unsolicited free-token or airdrop claim', /\b(claim|free|exclusive|surprise)\s+(your\s+|the\s+|an?\s+)?(airdrop|nfts?|tokens?|mint|rewards?|allocation)\b|\bairdrop\s+(is\s+)?(live|now)\b/i],
    ['doubling', 'scam', 55, 'Send-to-receive-more giveaway', /\bsend\s+[\d.,]+\s*(eth|btc|sol|usdt|usdc|bnb|coins?)\b.{0,60}\b(get|receive|back|return)|\b(double|triple|2x|3x)\s+(your|the)\s+(crypto|eth|btc|sol|money|coins|deposit)\b/i],
    ['returns', 'scam', 35, 'Promises guaranteed or fixed high returns', /\b(guaranteed|risk[-\s]?free|assured)\s+(returns?|profits?|gains?|income)\b|\b\d{2,}\s*%\s*(daily|weekly|per\s+day|a\s+day)\b/i],
    ['urgency', 'pressure', 12, 'Artificial urgency', /\b(urgent|act\s+now|last\s+chance|hurry|expires?\s+(soon|today|in)|within\s+\d+\s*(min|minutes|hours?))\b/i],
    ['approve', 'phishing', 25, 'Asks for an approval or signature without saying what it does', /\b(sign|approve)\s+(this|the)\s+(transaction|message|permit|approval)\s+to\s+(claim|receive|unlock|verify)/i]
  ];

  function aiScan(text, cid, author) {
    const t = String(text || '');
    const flags = [];
    const settings = cid ? aiSettings(cid) : { scam: true, phishing: true, address: true, impersonation: true };
    // "Never share your recovery phrase" is safety advice, not a scam. A
    // warning in the same text drops those two patterns to a note.
    // The negation has to govern the verb directly ("never share", "nobody
    // will ask") — a loose "do not worry, share…" does not count.
    const warning = /\b(never|don'?t|do not|nobody|no one|won'?t|will not|should not|shouldn'?t)(?:[ \t]+[a-z]+){0,2}[ \t]+(share|send|give|type|enter|post|ask|request|paste|reveal|connect|sync|validate)\b/i.test(t);
    PATTERNS.forEach(([id, kind, w, label, re]) => {
      if (kind === 'phishing' && !settings.phishing) return;
      if ((kind === 'scam' || kind === 'pressure') && !settings.scam) return;
      if (kind === 'impersonation' && !settings.impersonation) return;
      if (!re.test(t)) return;
      if (warning && (id === 'seed' || id === 'sync')) flags.push({ id, kind: 'note', w: 6, label: label + ' (in a warning)' });
      else flags.push({ id, kind, w, label });
    });
    if (settings.phishing) {
      (t.match(/https?:\/\/[^\s<>"')]+/gi) || []).forEach(u => {
        let host = '';
        try { host = new URL(u).hostname.toLowerCase(); } catch (e) { return; }
        if (OFFICIAL.some(d => host === d || host.endsWith('.' + d))) return;
        if (/^xn--|\.xn--/.test(host)) flags.push({ id: 'puny', kind: 'phishing', w: 45, label: 'Link uses a disguised (punycode) domain: ' + host });
        else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) flags.push({ id: 'ip', kind: 'phishing', w: 35, label: 'Link points to a raw IP address' });
        else if (SHORTENERS.indexOf(host) > -1) flags.push({ id: 'short', kind: 'phishing', w: 15, label: 'Shortened link hides the destination' });
        const parts = deconfuse(host).split(/[.-]/);
        // Official hosts returned above, so any remaining host that carries
        // a brand name — exactly or one typo away — is borrowing it.
        const brand = BRANDS.find(b => parts.some(p => p === b || (p.length >= 4 && lev(p, b) <= (b.length > 6 ? 2 : 1))));
        if (brand) flags.push({ id: 'lookalike', kind: 'phishing', w: 45, label: `Link imitates ${brand} — ${host} is not an official domain` });
        if (/(claim|airdrop|wallet-?connect|validate|recover|sync|support-)/.test(host)) flags.push({ id: 'bait', kind: 'phishing', w: 25, label: 'Domain name is built to bait: ' + host });
      });
    }
    if (settings.address) {
      const evm = t.match(/\b0x[a-fA-F0-9]{40}\b/g) || [];
      const btc = t.match(/\b(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g) || [];
      const n = evm.length + btc.length;
      if (n) {
        const sendy = /\b(send|deposit|transfer|pay|donate|fund)\b/i.test(t);
        flags.push({ id: 'address', kind: 'address', w: sendy ? 35 : 10, label: sendy ? 'Asks people to send funds to a posted address' : 'Contains a wallet address' });
      }
    }
    if (settings.impersonation && cid) {
      const name = (author && author.name) || me().name;
      const handle = (author && author.handle) || me().handle;
      const level = author ? CMD.roleById(cid, author.role || 'member').level : CMD.myLevel(cid);
      if (/\b(admin|moderator|mod team|support|official|team)\b/i.test(name) && level < 60) {
        flags.push({ id: 'title', kind: 'impersonation', w: 40, label: 'Display name claims a staff title the account does not hold' });
      }
      const staff = CMD.members(cid).filter(m => ['owner', 'admin', 'mod'].indexOf(m.role) > -1 && m.handle !== handle && !m.bot);
      const clone = staff.find(s => lev(deconfuse(s.name.replace(/\s/g, '')), deconfuse(String(name).replace(/\s/g, ''))) <= 1);
      if (clone && level < 60) flags.push({ id: 'clone', kind: 'impersonation', w: 50, label: `Name is nearly identical to ${CMD.roleById(cid, clone.role).name.toLowerCase()} ${clone.name}` });
    }
    if ((t.match(/@\w+/g) || []).length > 6) flags.push({ id: 'mass', kind: 'pressure', w: 15, label: 'Mass-mentions people' });
    const score = Math.min(100, flags.reduce((s, f) => s + f.w, 0));
    return { score, flags, risk: score >= 75 ? 'high' : score >= 45 ? 'medium' : score >= 20 ? 'low' : 'none' };
  }

  const SENS = { relaxed: { block: 85, hold: 65 }, balanced: { block: 75, hold: 50 }, strict: { block: 60, hold: 35 } };
  function aiSettings(cid) { return P.aiMod[cid] || { on: true, scam: true, phishing: true, address: true, impersonation: true, sensitivity: 'balanced' }; }
  function setAiSettings(cid, patch) {
    if (!CMD.can(cid, 'moderate')) return { error: 'Moderators configure the AI Moderator.' };
    P.aiMod[cid] = { ...aiSettings(cid), ...patch };
    save();
    return P.aiMod[cid];
  }

  /* Called from CMD.screen after AutoMod. Chat messages at hold level wait
     for a moderator; anything else at that level is refused with the
     reason, so a board comment never silently turns into a chat message. */
  function aiScreen(cid, chId, text, ctx) {
    const s = aiSettings(cid);
    if (!s.on || CMD.myLevel(cid) >= 60) return { ok: true };
    const r = aiScan(text, cid);
    const th = SENS[s.sensitivity] || SENS.balanced;
    if (r.score < th.hold) return { ok: true };
    const why = r.flags.map(f => f.label).join('; ');
    const log = P.aiLog[cid] = P.aiLog[cid] || [];
    log.unshift({ at: Date.now(), score: r.score, flags: r.flags.map(f => f.id), handle: me().handle, chan: chId, action: r.score >= th.block ? 'blocked' : ctx === 'chat' ? 'held' : 'refused', text: String(text).slice(0, 160) });
    if (log.length > 100) log.length = 100;
    if (r.score >= th.block || ctx !== 'chat') {
      save();
      return { ok: false, why: `AI Moderator blocked that (risk ${r.score}) — ${why}.`, rule: 'ai' };
    }
    const m = me();
    (P.held[cid] = P.held[cid] || []).unshift({ id: uid('hd'), cid, chId, text: String(text), name: m.name, handle: m.handle, role: CMD.topRole(cid).id, at: Date.now(), score: r.score, flags: r.flags });
    save();
    return { ok: false, why: `Held for a moderator — the AI Moderator saw: ${why}. It posts if they approve.`, rule: 'ai-hold', held: true };
  }

  const held = cid => P.held[cid] || [];
  const aiLog = cid => P.aiLog[cid] || [];
  function resolveHeld(cid, id, approve) {
    if (!CMD.can(cid, 'moderate')) return { error: 'Moderators review held messages.' };
    const h = held(cid).find(x => x.id === id);
    if (!h) return { error: 'Already handled.' };
    P.held[cid] = held(cid).filter(x => x.id !== id);
    if (approve && CMD.insertMessage) {
      CMD.insertMessage(cid, h.chId, { id: 'm' + Date.now(), name: h.name, handle: h.handle, role: h.role, text: h.text, ts: Date.now(), me: h.handle === me().handle, approvedBy: me().handle });
    }
    CMD.logMod(cid, approve ? 'ai-approve' : 'ai-reject', h.handle, `risk ${h.score}`);
    save();
    return { ok: true };
  }

  function scanCommunity(cid) {
    const out = [];
    rawMsgs(cid).forEach(m => {
      if (m.kind === 'system' || !m.text) return;
      const r = aiScan(m.text, cid, { name: m.name, handle: m.handle, role: m.role });
      if (r.score >= 20) out.push({ where: '#' + m.chan, name: m.name, text: m.text, ...r });
    });
    ((CMD.state().boards || {})[cid] || []).forEach(p => {
      const r = aiScan(p.title + ' ' + p.body, cid, { name: p.author, handle: p.handle, role: 'member' });
      if (r.score >= 20) out.push({ where: 'Discussions', name: p.author, text: p.title, ...r });
    });
    market(cid).forEach(l => {
      const r = aiScan(l.title + ' ' + l.desc, cid, { name: l.seller, handle: l.handle, role: 'member' });
      if (r.score >= 20) out.push({ where: 'Marketplace', name: l.seller, text: l.title, ...r });
    });
    return out.sort((a, b) => b.score - a.score);
  }

  /* ── Assistant ───────────────────────────────────────────────────── */
  const STOP = new Set('a an and are as at be but by for from has have i if in into is it its of on or so that the their then there these they this to was we were what when where which who why will with you your our not no can just do does did up out about more most some any all one two new get got like been than too very also how them its'.split(' '));
  const stem = w => w.replace(/(ing|ed|ies|es|s)$/,'').replace(/(.)\1$/, '$1');
  const terms = t => String(t || '').toLowerCase().replace(/https?:\/\/\S+/g, ' ').match(/[\p{L}\p{N}]+/gu) || [];
  const keyTerms = t => terms(t).filter(w => w.length > 2 && !STOP.has(w)).map(stem);

  function corpus(cid) {
    const items = [];
    const c = CMD.byId(cid);
    rawMsgs(cid).forEach(m => { if (m.text && m.kind !== 'system') items.push({ type: 'message', where: '#' + m.chan, chan: m.chan, title: m.name, text: m.text, ts: m.ts, ref: m.id }); });
    ((CMD.state().boards || {})[cid] || CMD.boards(cid)).forEach(p => {
      items.push({ type: 'discussion', where: 'Discussions', title: p.title, text: p.body + ' ' + (p.comments || []).map(x => x.text).join(' '), ts: p.ts, ref: p.id, solved: p.solved });
    });
    CMD.feed(cid).forEach(p => items.push({ type: 'post', where: 'Feed', title: p.name, text: p.text, ts: p.ts, ref: p.id }));
    CMD.events(cid).forEach(e => items.push({ type: 'event', where: 'Events', title: e.title, text: e.desc, ts: e.start, ref: e.id }));
    proposals(cid).forEach(p => items.push({ type: 'proposal', where: 'Governance', title: p.title, text: [p.summary, p.motivation, p.spec, p.implNote].join(' '), ts: p.created, ref: p.id, status: p.status }));
    govLog(cid).forEach(e => items.push({ type: 'governance', where: 'History', title: e.action, text: e.action + ' ' + canon(e.detail), ts: e.at, ref: e.pid }));
    kb(cid).forEach(a => items.push({ type: 'article', where: 'Knowledge', title: a.title, text: a.body, ts: a.at, ref: a.id }));
    (SEED_POSTS[cid] || []).forEach((p, i) => items.push({ type: 'post', where: 'Public feed', title: c ? c.name : '', text: p[0], ts: Date.now() - p[1] * HOUR, ref: 'sp' + i }));
    collabsFor(cid).forEach(k => items.push({ type: 'collab', where: 'Collabs', title: k.title, text: k.goal + ' ' + collabMessages(k.id).map(m => m.text).join(' '), ts: k.created, ref: k.id }));
    return items;
  }

  function timeRange(q) {
    const s = q.toLowerCase();
    const now = Date.now();
    if (/\btoday\b/.test(s)) { const d = new Date(); d.setHours(0, 0, 0, 0); return { from: d.getTime(), label: 'today' }; }
    if (/\byesterday\b/.test(s)) return { from: now - 2 * DAY, label: 'since yesterday' };
    if (/\b(this|past|last)\s+week\b|\b7\s*days\b/.test(s)) return { from: now - 7 * DAY, label: 'this week' };
    if (/\b(this|past|last)\s+month\b|\b30\s*days\b/.test(s)) return { from: now - 30 * DAY, label: 'this month' };
    return null;
  }

  function digest(cid, days) {
    const from = Date.now() - (days || 7) * DAY;
    const items = corpus(cid).filter(i => i.ts >= from && i.ts <= Date.now() + 14 * DAY);
    const df = {};
    items.forEach(i => new Set(keyTerms(i.title + ' ' + i.text)).forEach(w => { df[w] = (df[w] || 0) + 1; }));
    const topics = Object.keys(df).filter(w => df[w] > 1 && w.length > 3).sort((a, b) => df[b] - df[a]).slice(0, 6);
    const byWhere = {};
    items.forEach(i => { byWhere[i.where] = (byWhere[i.where] || 0) + 1; });
    const scored = items.filter(i => i.type !== 'governance').map(i => {
      const ks = keyTerms(i.title + ' ' + i.text);
      const s = ks.reduce((a, w) => a + (df[w] || 0), 0) / Math.sqrt(ks.length + 4) + (i.type === 'proposal' || i.type === 'article' ? 2 : 0);
      return { ...i, s };
    }).sort((a, b) => b.s - a.s);
    const highlights = [];
    const seen = new Set();
    scored.forEach(i => { const k = i.type + i.title; if (highlights.length < 5 && !seen.has(k)) { seen.add(k); highlights.push(i); } });
    const decided = govLog(cid).filter(e => e.at >= from && ['passed', 'rejected', 'implemented', 'spend-executed'].indexOf(e.action) > -1)
      .map(e => { const p = proposals(cid).find(x => x.id === e.pid); return { action: e.action, title: p ? p.title : (e.detail && e.detail.memo) || e.action, at: e.at }; });
    const openQs = rawMsgs(cid).filter(m => m.ts >= from && /\?\s*$/.test(m.text || '') && !(m.thread || []).length).slice(-4);
    const upcoming = CMD.events(cid).filter(e => e.start > Date.now() && e.start < Date.now() + 7 * DAY).slice(0, 3);
    const voting = proposals(cid).filter(p => p.status === 'voting');
    return { days: days || 7, count: items.length, topics, byWhere, highlights, decided, openQs, upcoming, voting };
  }

  function ask(cid, question) {
    const q = String(question || '').trim();
    if (!q) return { error: 'Ask something about this community.' };
    const tr = timeRange(q);
    if (/\b(what\s+happen|summar|catch\s+me\s+up|recap|digest|what('|’)?s\s+new|overview)\b/i.test(q)) {
      return { kind: 'digest', range: tr ? tr.label : 'this week', digest: digest(cid, tr ? Math.max(1, Math.round((Date.now() - tr.from) / DAY)) : 7) };
    }
    if (/\b(wallet|connect|seed|private key|sign|gas|address)\b/i.test(q) && /\b(what|how|is|should|explain|safe)\b/i.test(q)) {
      return { kind: 'wallet', text: explainWallet() };
    }
    const qTerms = keyTerms(q);
    if (!qTerms.length) return { kind: 'search', results: [], summary: 'Try a few specific words.' };
    let items = corpus(cid);
    if (tr) items = items.filter(i => i.ts >= tr.from);
    const N = items.length || 1;
    const df = {};
    items.forEach(i => new Set(keyTerms(i.title + ' ' + i.text)).forEach(w => { df[w] = (df[w] || 0) + 1; }));
    const avg = items.reduce((s, i) => s + keyTerms(i.title + ' ' + i.text).length, 0) / N || 1;
    const results = items.map(i => {
      const ks = keyTerms(i.title + ' ' + i.text);
      const tf = {};
      ks.forEach(w => { tf[w] = (tf[w] || 0) + 1; });
      let s = 0;
      qTerms.forEach(w => {
        const f = tf[w] || 0;
        if (!f) return;
        const idf = Math.log(1 + (N - (df[w] || 0) + 0.5) / ((df[w] || 0) + 0.5));
        s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * ks.length / avg));
      });
      if (s && keyTerms(i.title).some(w => qTerms.indexOf(w) > -1)) s *= 1.4;
      if (s && /\b(proposal|vote|decid|govern|treasur)/i.test(q) && (i.type === 'proposal' || i.type === 'governance')) s *= 1.6;
      return { ...i, s };
    }).filter(i => i.s > 0).sort((a, b) => b.s - a.s).slice(0, 8);
    const kinds = {};
    results.forEach(r => { kinds[r.type] = (kinds[r.type] || 0) + 1; });
    const summary = results.length
      ? `Found ${results.length} match${results.length === 1 ? '' : 'es'}${tr ? ' ' + tr.label : ''}: ${Object.keys(kinds).map(k => kinds[k] + ' ' + k + (kinds[k] > 1 ? 's' : '')).join(', ')}. The strongest is “${(results[0].title || '').slice(0, 60)}” in ${results[0].where}.`
      : `Nothing in this community mentions that${tr ? ' ' + tr.label : ''}.`;
    return { kind: 'search', results, summary, range: tr ? tr.label : null };
  }

  function explainWallet() {
    const w = wallet();
    const lines = [];
    if (!w) {
      lines.push('No wallet is connected. You do not need one — every community feature works without it.');
      lines.push('If you connect one, Trending reads your public address and, on EVM networks, your native balance. That is all.');
    } else {
      lines.push(`Connected: ${w.label} ${w.simulated ? '(demo wallet — simulated, holds nothing)' : ''} · ${w.address.slice(0, 6)}…${w.address.slice(-4)}.`);
      if (w.native) lines.push(`Native balance read from the wallet: ${w.native.amount} ${w.native.symbol}${w.native.simulated ? ' (simulated)' : ''}.`);
      lines.push('Communities can use it for wallet-verified membership, token-gated spaces and optional wallet-weighted votes.');
    }
    lines.push('Trending never asks for a recovery phrase or private key, never holds funds, and never sends a transaction for you.');
    lines.push('A signature request should always show plain text you understand. If it mentions approvals, permits or claims, stop.');
    return lines;
  }

  /* ══════════════════════════════════════════════════════════════════
     12 · 13  Token-gated spaces & membership passes
     ══════════════════════════════════════════════════════════════════ */

  const GATE_TYPES = [
    ['wallet', 'Any connected wallet', 'Members who connected a wallet — no balance required.'],
    ['native', 'Holds a native balance', 'Reads the balance your wallet already exposes. Set a minimum.'],
    ['pass', 'Holds the membership pass', 'Members who claimed this community\'s non-transferable pass.'],
    ['credential', 'Holds a credential', 'Members who earned a specific badge here.']
  ];

  function gateStatus(cid, ch) {
    const g = ch && ch.gate;
    if (!g) return { ok: true };
    if (!CMD.isJoined(cid)) return { ok: false, need: 'Join the community first.' };
    if (CMD.myLevel(cid) >= 60) return { ok: true, staff: true };
    const w = wallet();
    if (g.type === 'wallet') return w ? { ok: true, demo: w.simulated } : { ok: false, need: 'Connect a wallet to open this space.', action: 'connect' };
    if (g.type === 'native') {
      if (!w) return { ok: false, need: `Connect a wallet holding at least ${g.min} ${g.symbol || 'native tokens'}.`, action: 'connect' };
      const accts = typeof WL !== 'undefined' ? WL.accounts() : [];
      const best = accts.reduce((m, a) => Math.max(m, (a.native && (!g.symbol || a.native.symbol === g.symbol)) ? a.native.amount : 0), 0);
      const demo = accts.some(a => a.simulated && a.native && a.native.amount >= g.min);
      return best >= (+g.min || 0) ? { ok: true, demo } : { ok: false, need: `Needs ${g.min} ${g.symbol || ''} — your connected wallets show ${best}.`, action: 'connect' };
    }
    if (g.type === 'pass') return P.myPasses[cid] ? { ok: true } : { ok: false, need: 'Claim this community\'s membership pass to enter.', action: 'pass' };
    if (g.type === 'credential') return hasBadge(cid, g.title) ? { ok: true } : { ok: false, need: `Earn the “${g.title}” credential to enter.`, action: 'missions' };
    return { ok: false, need: 'Unknown requirement.' };
  }
  const gateOpen = (cid, ch) => gateStatus(cid, ch).ok;

  function addGatedChannel(cid, form) {
    if (!CMD.can(cid, 'channels')) return { error: 'Creating gated spaces needs the manage channels permission.' };
    const name = String(form.name || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!name) return { error: 'Name the space.' };
    const type = GATE_TYPES.find(t => t[0] === form.type) ? form.type : 'wallet';
    const gate = { type };
    if (type === 'native') { gate.min = Math.max(0, +form.min || 0); gate.symbol = form.symbol || 'ETH'; }
    if (type === 'credential') { gate.title = String(form.title || '').trim(); if (!gate.title) return { error: 'Pick the credential that unlocks it.' }; }
    const list = CMD.channels(cid).slice();
    const ch = { id: 'g' + Date.now().toString(36), name, kind: form.kind === 'voice' ? 'voice' : 'text', space: 'Token-gated', topic: String(form.topic || '').trim() || GATE_TYPES.find(t => t[0] === type)[1], gate };
    list.push(ch);
    CMD.saveChannels(cid, list);
    logGov(cid, 'gate-created', { channel: name, gate });
    return ch;
  }
  const gatedChannels = cid => CMD.channels(cid).filter(ch => ch.gate);

  function passConfig(cid) {
    if (P.passes[cid]) return P.passes[cid];
    const c = CMD.byId(cid);
    const seeded = c && ['insiders', 'eth', 'devcore', 'studio', 'sec'].indexOf(c.id) > -1;
    return { enabled: !!seeded, name: c ? c.name + ' Pass' : 'Pass', perks: ['Pass-holder space', 'Pass-holder votes', 'Early event seats'], supply: 0,
      minted: seeded ? Math.floor(200 + rng(cid + ':pass')() * 1800) : 0, color: c ? c.color : '#FCD535', seed: !!seeded };
  }
  function savePass(cid, patch) {
    if (!CMD.can(cid, 'manage')) return { error: 'The owner designs the membership pass.' };
    P.passes[cid] = { ...passConfig(cid), ...patch, transferable: false };
    save();
    logGov(cid, 'pass-updated', { enabled: P.passes[cid].enabled, name: P.passes[cid].name });
    return P.passes[cid];
  }
  function claimPass(cid) {
    const cfg = passConfig(cid);
    if (!cfg.enabled) return { error: 'This community has not switched on a membership pass.' };
    if (!CMD.isJoined(cid)) return { error: 'Join the community first — a pass is proof of membership.' };
    if (P.myPasses[cid]) return { error: 'You already hold this pass.' };
    if (cfg.supply && cfg.minted >= cfg.supply) return { error: 'All passes have been claimed.' };
    const w = wallet();
    const serial = (cfg.minted || 0) + 1;
    const body = { cid, name: cfg.name, serial, holder: me().handle, subject: did(), boundTo: w && !w.simulated ? w.address : null, at: Date.now(), transferable: false };
    P.myPasses[cid] = { ...body, digest: sha256(canon(body)) };
    if (P.passes[cid]) P.passes[cid].minted = serial; else P.passes[cid] = { ...cfg, minted: serial };
    save();
    issue({ kind: 'pass', cid, title: cfg.name, icon: 'badge', ref: 'pass#' + serial });
    return P.myPasses[cid];
  }
  const myPass = cid => P.myPasses[cid] || null;

  /* Credential-linked roles: holding a credential grants a role. */
  function roleLinks(cid) { return P.roleLinks[cid] || []; }
  function addRoleLink(cid, credential, role) {
    if (!CMD.can(cid, 'roles')) return { error: 'Linking roles needs the manage roles permission.' };
    const r = CMD.roleById(cid, role);
    if (r.level >= CMD.myLevel(cid)) return { error: 'You can only link roles below your own.' };
    (P.roleLinks[cid] = P.roleLinks[cid] || []).push({ credential, role, at: Date.now() });
    save();
    syncRoleLinks(cid);
    return { ok: true };
  }
  function removeRoleLink(cid, i) { (P.roleLinks[cid] || []).splice(i, 1); save(); }
  function syncRoleLinks(cid) {
    if (!CMD.isJoined(cid)) return;
    roleLinks(cid).forEach(l => {
      const holds = l.credential === '__pass' ? !!P.myPasses[cid] : hasBadge(cid, l.credential);
      if (holds && CMD.myRoles(cid).indexOf(l.role) < 0) CMD.grantRole(cid, l.role);
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     26 · 27  Mini apps & the Open Community API
     ══════════════════════════════════════════════════════════════════ */

  const MINI_APPS = [
    { id: 'focus', name: 'Focus Timer', icon: 'timer', what: 'A work-along pomodoro for focus rooms.', perms: ['context'] },
    { id: 'picker', name: 'Fair Picker', icon: 'casino', what: 'Pick a speaker or giveaway winner from a visible, repeatable seed.', perms: ['context', 'members'] },
    { id: 'standup', name: 'Standup Board', icon: 'view_kanban', what: 'Yesterday, today, blockers — posted to #general only when you confirm.', perms: ['context', 'post'] },
    { id: 'addr', name: 'Address Checker', icon: 'fact_check', what: 'Checks a pasted address is well-formed and warns about lookalikes. Makes no network calls.', perms: [], web3: true }
  ];
  function installedApps(cid) {
    if (P.miniApps[cid]) return P.miniApps[cid];
    const c = CMD.byId(cid);
    return ['focus', 'picker', 'standup'].concat(c && c.category === 'crypto' ? ['addr'] : []);
  }
  function toggleMiniApp(cid, id) {
    if (!CMD.can(cid, 'manage') && !CMD.can(cid, 'channels')) return { error: 'Installing apps needs the manage permission.' };
    const list = installedApps(cid).slice();
    const i = list.indexOf(id);
    if (i > -1) list.splice(i, 1); else list.push(id);
    P.miniApps[cid] = list;
    save();
    return { on: i < 0 };
  }

  /* Read-only by design. A developer can build on community data and
     listen for activity, but writing anything goes through the same
     permission checks and confirmations as the user interface. */
  const API = Object.freeze({
    version: '1.0',
    communities: () => CMD.all().map(c => ({ id: c.id, name: c.name, category: c.category, members: CMD.memberCount(c.id), verified: !!c.verified, joined: CMD.isJoined(c.id) })),
    community: id => { const c = CMD.byId(id); return c ? { id: c.id, name: c.name, desc: c.desc, category: c.category, tags: c.tags || [], members: CMD.memberCount(id), online: CMD.onlineCount(id) } : null; },
    channels: id => CMD.channels(id).map(ch => ({ id: ch.id, name: ch.name, kind: ch.kind, space: ch.space, gated: !!ch.gate, private: !!ch.private })),
    events: id => CMD.events(id).map(e => ({ id: e.id, title: e.title, start: e.start, mins: e.mins, going: e.going.length })),
    proposals: id => proposals(id).map(p => ({ id: p.id, title: p.title, type: p.type, status: p.status, mode: p.mode, tally: tally(p).t, options: p.options })),
    governanceRoot: id => verifyGov(id),
    missions: id => missions(id).map(m => ({ id: m.id, title: m.title, points: m.points, mode: m.mode })),
    knowledge: id => kb(id).map(a => ({ id: a.id, title: a.title, cat: a.cat, digest: a.digest })),
    trends: () => radar({ limit: 12 }).map(t => ({ tag: t.tag, growth: t.growth, volume: t.volume })),
    passport: () => ({ handle: me().handle, did: did(), level: level().name, contributionScore: contribution().score, credentials: P.badges.length }),
    wallet: () => { const w = wallet(); return w ? { connected: true, network: w.label, address: w.address.slice(0, 6) + '…' + w.address.slice(-4), simulated: w.simulated } : { connected: false }; },
    on: (type, fn) => on(type, fn),
    events_log: () => recentEvents.slice()
  });

  /* Called by CMD.post through the hub after a message lands, so apps can
     subscribe to live activity. */
  function notifyPost(cid, chId) { emit('post', { cid, channel: chId }); touch(); }

  /* ── Studio summaries ────────────────────────────────────────────── */
  function money(cid) {
    const m = market(cid);
    const sales = P.library.filter(l => l.cid === cid);
    const t = P.tips.filter(x => x.cid === cid);
    const f = funding(cid);
    const tierIncome = CMD.tiers(cid).filter(x => x.price > 0 && CMD.myTier(cid) === x.id).reduce((s, x) => s + x.price, 0);
    return {
      listings: m.length, sold: sales.length, revenue: sales.reduce((s, l) => s + (l.price || 0), 0),
      seededSales: m.filter(l => l.seed).reduce((s, l) => s + l.sales * (l.price || 0), 0),
      tips: t.reduce((s, x) => s + x.amount, 0), raised: f.reduce((s, x) => s + raised(x), 0), campaigns: f.length,
      treasury: balance(cid), tierIncome
    };
  }

  /* ── Seed cleanup — what launching without demo data looks like ─── */
  function seedCounts() {
    let n = 0;
    Object.values(P.proposals).forEach(l => l.forEach(p => { if (p.seed) n++; }));
    Object.values(P.market).forEach(l => l.forEach(x => { if (x.seed) n++; }));
    Object.values(P.funding).forEach(l => l.forEach(x => { if (x.seed) n++; }));
    Object.values(P.kb).forEach(l => l.forEach(x => { if (x.seed) n++; }));
    (P.collabs || []).forEach(x => { if (x.seed) n++; });
    return n;
  }

  const state = () => P;

  return {
    // util
    sha256, canon, verifyCredential, on, emit, API, state, save, touch, notifyPost, seedCounts,
    // discovery
    LANES, INTERESTS, feedItems, forYou, followingFeed, picks, prefs, setPrefs, setLane,
    like, likedByMe, likeCount, reply, replyList, replyCount,
    followCommunity, followPerson, followsCommunity, followsPerson, follows,
    nominate, viral, viralScore, viralQueue, publishViral, dismissViral, VIRAL_AT,
    growth, rising, nearby, radar,
    // identity
    wallet, did, LEVELS, contribution, level, portableRep, badges, hasBadge, issue,
    proofs: () => P.proofs, verifyProofs, signRoot, passportExport, signature: () => P.sigs.root || null,
    SKILLS, requestSkill, reviewSkill, skills, endorse, endorsedBy, graph, trust: () => P.trust,
    // missions
    missions, allMissions, missionState, claimMission, submitMission, reviewQueue, reviewMission, addMission, toggleMission, removeMission,
    checkIn, checkedIn,
    // governance
    PROPOSAL_TYPES, VOTE_MODES, govSettings, saveGovSettings, proposals, propose, vote, tally, weightFor, canPropose,
    commentProposal, implement, cancelProposal, closeEarly, govLog, verifyGov, exportGov,
    treasury, balance, enableTreasury, setSigners, requestSpend, approveSpend,
    funding, raised, backers, back, addCampaign, releaseMilestone,
    // money
    KINDS, market, owns, buy, sell, unlist, library, tip, tips, tipsToday, TIP_CAP, setPayout, clearPayout, payout, money,
    // collabs
    collabs, collabsFor, collab, proposeCollab, acceptCollab, toggleTask, collabMessages, postCollab, rsvpCollab, checkInCollab,
    // knowledge & AI
    KB_CATS, kb, addArticle, removeArticle, verifyArticle, derivedFaq, decisions,
    aiScan, aiScreen, aiSettings, setAiSettings, held, resolveHeld, aiLog, scanCommunity, digest, ask, explainWallet,
    // web3 layer
    GATE_TYPES, gateStatus, gateOpen, addGatedChannel, gatedChannels, passConfig, savePass, claimPass, myPass,
    roleLinks, addRoleLink, removeRoleLink, syncRoleLinks,
    // platform
    MINI_APPS, installedApps, toggleMiniApp
  };
})();

window.CPM = CPM;
/* The Open Community API, for developers building on communities. */
window.CommuneAPI = CPM.API;

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
publish('features/communeplus.js', {
  CPM: () => CPM
});
