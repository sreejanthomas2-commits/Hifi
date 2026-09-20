/* ╔══════════════════════════════════════════════════════════════════╗
   ║  COMMUNEHUB — the model                                           ║
   ║                                                                   ║
   ║  The community pane used to be a directory: a card grid, one chat ║
   ║  room per community, and a token balance. This is the Discord     ║
   ║  shape instead — communities that contain spaces, spaces that     ║
   ║  contain channels, and channels that are text, voice, stage,      ║
   ║  boards or announcements, all under roles and permissions.        ║
   ║                                                                   ║
   ║  This file is the model and the rules: seeds, membership, roles,  ║
   ║  permission checks, channels, messages, boards, events, invites,  ║
   ║  moderation, reputation and the numbers the Studio reports on.    ║
   ║  It touches no DOM — communehub.js and communestudio.js draw it.  ║
   ║                                                                   ║
   ║  Two things it deliberately shares with the old module: the       ║
   ║  community list (CH.COMMUNITIES) and the message store for the    ║
   ║  five original topics, so the Messages page keeps showing the     ║
   ║  same conversations rather than a second, diverging copy.         ║
   ║                                                                   ║
   ║  Everything lives in this browser. No server, no accounts.        ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CMD = (() => {

  const KEY = 'ts_commune';
  const ME_FALLBACK = '@you';

  /* ── Permissions ─────────────────────────────────────────────────── */
  /* Every gate in the UI asks can(cid, perm). Roles carry a level too,
     so a moderator can act on a member but never on an admin. */
  const PERMS = [
    ['view',          'View channels'],
    ['post',          'Send messages'],
    ['upload',        'Attach files'],
    ['react',         'Add reactions'],
    ['thread',        'Start threads'],
    ['speak',         'Speak in voice'],
    ['video',         'Share camera'],
    ['stream',        'Go live'],
    ['events',        'Create events'],
    ['boards',        'Post on boards'],
    ['invite',        'Create invites'],
    ['mention',       'Mention @everyone'],
    ['pin',           'Pin messages'],
    ['moderate',      'Delete messages, timeout members'],
    ['ban',           'Remove and ban members'],
    ['channels',      'Manage channels'],
    ['roles',         'Manage roles'],
    ['broadcast',     'Publish broadcasts'],
    ['analytics',     'See analytics'],
    ['manage',        'Manage the community']
  ];
  const ALL = PERMS.map(p => p[0]);

  const ROLE_LIB = {
    owner:       { name: 'Owner',       level: 100, color: '#FFD60A', perms: ALL },
    admin:       { name: 'Admin',       level: 80,  color: '#FF6B81', perms: ALL.filter(p => p !== 'manage') },
    mod:         { name: 'Moderator',   level: 60,  color: '#4FC3F7',
                   perms: ['view','post','upload','react','thread','speak','video','stream','events','boards','invite','mention','pin','moderate','analytics'] },
    creator:     { name: 'Creator',     level: 40,  color: '#EC6CB9',
                   perms: ['view','post','upload','react','thread','speak','video','stream','events','boards','invite','pin'] },
    contributor: { name: 'Contributor', level: 30,  color: '#FCD535',
                   perms: ['view','post','upload','react','thread','speak','video','boards','invite'] },
    expert:      { name: 'Expert',      level: 25,  color: '#26A69A',
                   perms: ['view','post','upload','react','thread','speak','boards','invite'] },
    subscriber:  { name: 'Subscriber',  level: 20,  color: '#FFA726',
                   perms: ['view','post','upload','react','thread','speak','boards'] },
    member:      { name: 'Member',      level: 10,  color: '#9AA0AA',
                   perms: ['view','post','react','thread','speak','boards'] },
    guest:       { name: 'Guest',       level: 5,   color: '#78808C', perms: ['view'] }
  };

  /* ── Categories & seeds ──────────────────────────────────────────── */
  const CATEGORIES = [
    ['all',      'All',        'apps'],
    ['crypto',   'Crypto',     'currency_bitcoin'],
    ['tech',     'Technology', 'memory'],
    ['gaming',   'Gaming',     'sports_esports'],
    ['creator',  'Creator',    'movie_edit'],
    ['music',    'Music',      'music_note'],
    ['sports',   'Sports',     'sports_soccer'],
    ['finance',  'Finance',    'account_balance'],
    ['science',  'Science',    'science'],
    ['brand',    'Brand',      'verified'],
    ['learning', 'Learning',   'school']
  ];

  /* The crypto communities come from the original module so nothing the
     user already joined disappears; these fill out the other categories
     the hub is meant to cover. */
  const EXTRA = [
    { id: 'gamearena', name: 'Game Arena', handle: '@gamearena', icon: 'sports_esports', color: '#8B5CF6',
      desc: 'Squads, clips and patch-day arguments across every platform.',
      members: 128400, online: 9120, verified: true, category: 'gaming', tags: ['Gaming', 'Esports', 'Clips'] },
    { id: 'studio', name: 'Creator Studio', handle: '@creatorstudio', icon: 'movie_edit', color: '#EC6CB9',
      desc: 'Editing, thumbnails, audience growth and honest feedback.',
      members: 74100, online: 3860, verified: true, category: 'creator', tags: ['Creators', 'Editing', 'Growth'] },
    { id: 'soundlab', name: 'Sound Lab', handle: '@soundlab', icon: 'graphic_eq', color: '#F97316',
      desc: 'Production, sample packs, mixdowns and release-day rituals.',
      members: 41800, online: 2140, verified: false, category: 'music', tags: ['Music', 'Production'] },
    { id: 'devcore', name: 'Dev Core', handle: '@devcore', icon: 'terminal', color: '#38BDF8',
      desc: 'Shipping software — reviews, architecture and career talk.',
      members: 96300, online: 5410, verified: true, category: 'tech', tags: ['Engineering', 'Careers'] },
    { id: 'matchday', name: 'Matchday', handle: '@matchday', icon: 'sports_soccer', color: '#22C55E',
      desc: 'Live match threads, transfers and post-game breakdowns.',
      members: 152900, online: 12800, verified: false, category: 'sports', tags: ['Football', 'Live'] },
    { id: 'marketsdesk', name: 'Markets Desk', handle: '@marketsdesk', icon: 'monitoring', color: '#0EA5E9',
      desc: 'Macro, earnings and positioning — theses with numbers attached.',
      members: 63700, online: 3020, verified: true, category: 'finance', tags: ['Macro', 'Research'] },
    { id: 'labnotes', name: 'Lab Notes', handle: '@labnotes', icon: 'biotech', color: '#14B8A6',
      desc: 'Papers, replication and science that survives a second look.',
      members: 28500, online: 940, verified: true, category: 'science', tags: ['Research', 'Papers'] },
    { id: 'insiders', name: 'Trending Insiders', handle: '@insiders', icon: 'workspace_premium', color: '#FCD535',
      desc: 'The community you run: product news, feedback and early builds.',
      members: 3120, online: 210, verified: true, category: 'brand', tags: ['Trending', 'Product'], mine: true },
    { id: 'learners', name: 'Learn Together', handle: '@learntogether', icon: 'school', color: '#F59E0B',
      desc: 'Study groups, cohorts and people finishing what they started.',
      members: 37600, online: 1680, verified: false, category: 'learning', tags: ['Study', 'Cohorts'] }
  ];

  /* Which crypto ids map to which category label. */
  const CRYPTO_IDS = ['btc', 'eth', 'sol', 'defi', 'l2', 'nft', 'sec', 'quest', 'found', 'trade'];

  /* ── Channel blueprints ──────────────────────────────────────────── */
  /* The first five text ids match the original module's topics on purpose,
     so those channels stay the same conversation the Messages page shows. */
  const BASE_CHANNELS = [
    { id: 'rules',     name: 'rules',          kind: 'text',   space: 'Welcome', topic: 'Read this before posting.', locked: true },
    { id: 'announce',  name: 'announcements',  kind: 'announce', space: 'Welcome', topic: 'Community broadcasts.' },
    { id: 'general',   name: 'general',        kind: 'text',   space: 'Community', topic: 'Everything and anything.' },
    { id: 'intros',    name: 'introductions',  kind: 'text',   space: 'Community', topic: 'Say hello — who are you and what are you building?' },
    { id: 'media',     name: 'media',          kind: 'text',   space: 'Community', topic: 'Images, clips and links.' },
    { id: 'support',   name: 'help',           kind: 'text',   space: 'Support', topic: 'Ask and answer questions.' },
    { id: 'lounge',    name: 'Lounge',         kind: 'voice',  space: 'Voice', topic: 'Drop in and talk.' },
    { id: 'focusroom', name: 'Focus Room',     kind: 'voice',  space: 'Voice', topic: 'Cameras off, work along.' },
    { id: 'townhall',  name: 'Town Hall',      kind: 'stage',  space: 'Voice', topic: 'Speakers on stage, everyone else listens.' },
    { id: 'live',      name: 'Community Live', kind: 'live',   space: 'Voice', topic: 'Screens, demos and launches.' },
    { id: 'boards',    name: 'discussions',    kind: 'forum',  space: 'Boards', topic: 'Longer topics with their own comments.' },
    { id: 'qna',       name: 'q-and-a',        kind: 'forum',  space: 'Boards', topic: 'Questions that deserve a proper answer.' }
  ];

  const FOCUS = {
    crypto:   [{ id: 'alpha', name: 'alpha', topic: 'Contributor-only research.', role: 'contributor', private: true },
               { id: 'dev', name: 'dev', topic: 'Code, deploys and post-mortems.' },
               { id: 'charts', name: 'charts', topic: 'Levels, theses and receipts.' }],
    gaming:   [{ id: 'clips', name: 'clips', topic: 'Your best 20 seconds.' },
               { id: 'lfg', name: 'looking-for-group', topic: 'Find a squad.' },
               { id: 'patch', name: 'patch-notes', topic: 'What changed and who it hurts.' }],
    creator:  [{ id: 'feedback', name: 'feedback', topic: 'Post work, get a real critique.' },
               { id: 'collabs', name: 'collabs', topic: 'Find someone to make it with.' },
               { id: 'deals', name: 'brand-deals', topic: 'Rates, contracts and red flags.', role: 'contributor', private: true }],
    music:    [{ id: 'releases', name: 'releases', topic: 'Out now.' },
               { id: 'production', name: 'production', topic: 'Mixing, mastering and gear.' },
               { id: 'gigs', name: 'gigs', topic: 'Shows, bookings and tours.' }],
    tech:     [{ id: 'dev', name: 'dev', topic: 'Code and architecture.' },
               { id: 'careers', name: 'careers', topic: 'Hiring, interviews and offers.' },
               { id: 'showcase', name: 'showcase', topic: 'Ship it here first.' }],
    sports:   [{ id: 'matchthread', name: 'match-thread', topic: 'Live during games.' },
               { id: 'transfers', name: 'transfers', topic: 'Rumours, fees and done deals.' }],
    finance:  [{ id: 'markets', name: 'markets', topic: 'Open, close and everything between.' },
               { id: 'research', name: 'research', topic: 'Long form, sources attached.' }],
    science:  [{ id: 'papers', name: 'papers', topic: 'One paper, one thread.' },
               { id: 'lab', name: 'lab', topic: 'Methods, data and replication.' }],
    brand:    [{ id: 'product', name: 'product', topic: 'What we are building next.' },
               { id: 'builds', name: 'early-builds', topic: 'Test builds for members.', role: 'subscriber', private: true }],
    learning: [{ id: 'cohort', name: 'cohort', topic: 'This month\'s group.' },
               { id: 'wins', name: 'wins', topic: 'Finished something? Post it.' }]
  };

  /* ── People ──────────────────────────────────────────────────────── */
  const NAMES = [
    'Aria Volkov', 'Kenji Sato', 'Nadia Rahman', 'Theo Marsh', 'Priya Anand', 'Luca Bianchi',
    'Sam Okafor', 'Mei Lin', 'Ravi Desai', 'Elena Duarte', 'Jonas Weber', 'Amara Diallo',
    'Yuki Tanaka', 'Omar Haddad', 'Sofia Rossi', 'Daniel Kim', 'Zoë Fischer', 'Ibrahim Musa',
    'Hana Park', 'Marco Silva', 'Lena Petrova', 'Arjun Mehta', 'Chloe Dubois', 'Tomas Nowak',
    'Fatima Zahra', 'Noah Bennett', 'Ines Carvalho', 'Wei Zhang', 'Grace Mwangi', 'Felix Braun',
    'Aditi Sharma', 'Pablo Ortega', 'Sana Iqbal', 'Erik Lindqvist', 'Camila Reyes', 'Deniz Yilmaz'
  ];
  const BOTS = [
    { name: 'Welcome Bot', handle: '@welcome', bot: true, role: 'mod' },
    { name: 'AutoMod', handle: '@automod', bot: true, role: 'mod' },
    { name: 'Poll Bot', handle: '@pollbot', bot: true, role: 'member' }
  ];

  /* A tiny deterministic generator: the same community always produces the
     same member list, so nothing has to be stored and nothing shuffles
     between reloads. */
  function rng(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 100000) / 100000; };
  }

  const handleOf = name => '@' + name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);

  /* ── Storage ─────────────────────────────────────────────────────── */
  const DEFAULT = {
    v: 1,
    hubTab: 'discover', cat: 'all', screen: 'hub', cid: null, tab: 'home', chan: 'general', studioTab: 'overview',
    joined: {},          // cid -> { roles, at, interests, notify, rules, rep, tier, nick }
    msgs: {},            // cid:chan -> [msg]     (except the five legacy topics)
    boards: {},          // cid -> [post]
    events: {},          // cid -> [event]
    feed: {},            // cid -> [post]
    channels: {},        // cid -> [channel]      (only when customised)
    roles: {},           // cid -> [role]         (only when customised)
    memberRoles: {},     // cid -> { handle: roleId }
    invites: {},         // cid -> [invite]
    automod: {},         // cid -> { words, links, caps, slow, on }
    modlog: {},          // cid -> [entry]
    memberships: {},     // cid -> [tier]
    integrations: {},    // cid -> [hook]
    apps: {},            // cid -> [appId]
    bans: {},            // cid -> [handle]
    timeouts: {},        // cid -> { handle: untilTs }
    boosts: {},          // cid -> n
    read: {},            // cid:chan -> ts
    made: [],            // communities created here
    presence: 'online',
    rep: {},             // cid -> n
    tiers: {}            // cid -> tier id the viewer holds
  };

  let D = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }

  const me = () => {
    const u = (typeof S !== 'undefined' && S.user) ? S.user : null;
    if (!u || !u.handle || u.handle === 'Sign In') return { name: 'You', handle: ME_FALLBACK };
    return { name: `${u.fname} ${u.lname || ''}`.trim() || 'You', handle: u.handle };
  };

  /* ── Communities ─────────────────────────────────────────────────── */
  function legacyList() {
    if (typeof CH === 'undefined' || !CH.COMMUNITIES) return [];
    return CH.COMMUNITIES.map(c => ({
      ...c,
      category: CRYPTO_IDS.indexOf(c.id) > -1 ? 'crypto' : 'crypto',
      legacy: true
    }));
  }

  /* Owners can restyle a seeded community; that edit is stored as an
     override record and merged onto the original, not listed twice. */
  function all() {
    const over = {};
    D.made.forEach(c => { if (c.override) over[c.id] = c; });
    const base = legacyList().concat(EXTRA).map(c => over[c.id] ? { ...c, ...over[c.id] } : c);
    return base.concat(D.made.filter(c => !c.override));
  }
  const byId = id => all().find(c => c.id === id) || null;

  const isJoined = id => !!D.joined[id];
  const membership = id => D.joined[id] || null;

  function ownerOf(c) {
    if (!c) return '@unknown';
    if (c.owner) return c.owner;
    if (c.mine) return me().handle;
    return handleOf(NAMES[Math.floor(rng(c.id + 'owner')() * NAMES.length)]);
  }
  const iOwn = c => ownerOf(c) === me().handle;

  /* ── Roles ───────────────────────────────────────────────────────── */
  function roles(cid) {
    if (D.roles[cid]) return D.roles[cid];
    const c = byId(cid);
    const base = ['owner', 'admin', 'mod', 'creator', 'contributor', 'expert', 'subscriber', 'member'];
    return base.map(k => ({ id: k, ...ROLE_LIB[k], perms: ROLE_LIB[k].perms.slice(), self: k === 'contributor' || k === 'expert' }))
      .concat(c && c.category === 'brand' ? [] : []);
  }
  const roleById = (cid, rid) => roles(cid).find(r => r.id === rid) || { id: 'member', ...ROLE_LIB.member };

  /* Which roles the viewer holds. Owning a community makes you the owner;
     the seeded ones hand out a role so every tier is reachable somewhere. */
  function myRoles(cid) {
    const m = membership(cid);
    if (!m) return [];
    const c = byId(cid);
    if (c && iOwn(c)) return ['owner'];
    return (m.roles && m.roles.length) ? m.roles : ['member'];
  }
  const topRole = cid => myRoles(cid).map(r => roleById(cid, r)).sort((a, b) => b.level - a.level)[0] || roleById(cid, 'member');
  const myLevel = cid => (topRole(cid) || {}).level || 0;

  function can(cid, perm) {
    if (!isJoined(cid)) return perm === 'view';
    const timeout = (D.timeouts[cid] || {})[me().handle];
    if (timeout && timeout > Date.now() && perm !== 'view') return false;
    // A lapsed paid membership can read but not take part.
    if (perm !== 'view' && typeof CMB !== 'undefined' && CMB.blocks(cid, perm)) return false;
    return myRoles(cid).some(r => (roleById(cid, r).perms || []).indexOf(perm) > -1);
  }

  function grantRole(cid, rid) {
    const m = membership(cid);
    if (!m) return;
    m.roles = m.roles || [];
    if (m.roles.indexOf(rid) < 0) m.roles.push(rid);
    save();
  }
  function revokeRole(cid, rid) {
    const m = membership(cid);
    if (!m) return;
    m.roles = (m.roles || []).filter(r => r !== rid);
    if (!m.roles.length) m.roles = ['member'];
    save();
  }
  function saveRoles(cid, list) { D.roles[cid] = list; save(); }

  /* ── Members ─────────────────────────────────────────────────────── */
  /* Generated from the community id, then overlaid with anything stored
     (role changes, bans, timeouts) and with the viewer themselves. */
  function members(cid) {
    const c = byId(cid);
    if (!c) return [];
    const r = rng(cid + 'members');
    const count = 34;
    const out = [];
    const used = {};
    const ownerHandle = ownerOf(c);
    for (let i = 0; i < count; i++) {
      const name = NAMES[Math.floor(r() * NAMES.length)];
      const h = handleOf(name);
      if (used[h]) continue;
      used[h] = 1;
      const pick = r();
      let role = pick > 0.94 ? 'admin' : pick > 0.86 ? 'mod' : pick > 0.74 ? 'creator'
        : pick > 0.58 ? 'contributor' : pick > 0.48 ? 'expert' : pick > 0.4 ? 'subscriber' : 'member';
      if (h === ownerHandle) role = 'owner';
      const stored = (D.memberRoles[cid] || {})[h];
      const pres = r();
      out.push({
        name, handle: h, role: stored || role,
        presence: pres > 0.72 ? 'online' : pres > 0.6 ? 'live' : pres > 0.48 ? 'idle' : pres > 0.4 ? 'dnd' : 'offline',
        rep: Math.floor(r() * 2400), joined: Date.now() - Math.floor(r() * 400) * 86400000,
        activity: pres > 0.6 ? ['In Lounge', 'Listening', 'Watching a stream', 'On stage'][Math.floor(r() * 4)] : ''
      });
    }
    if (!out.some(m => m.handle === ownerHandle)) {
      out.unshift({ name: ownerHandle.replace('@', ''), handle: ownerHandle, role: 'owner', presence: 'online', rep: 4200, joined: c.createdAt || Date.now() - 500 * 86400000, activity: '' });
    }
    (D.apps[cid] || []).forEach(a => {
      const b = BOTS.find(x => x.handle === '@' + a) || null;
      if (b) out.push({ ...b, presence: 'online', rep: 0, joined: Date.now(), activity: 'Automation' });
    });
    if (isJoined(cid)) {
      const mine = me();
      out.unshift({
        name: mine.name, handle: mine.handle, role: topRole(cid).id, presence: D.presence,
        rep: D.rep[cid] || 0, joined: membership(cid).at, activity: '', you: true
      });
    }
    const banned = D.bans[cid] || [];
    return out.filter(m => banned.indexOf(m.handle) < 0);
  }

  const memberCount = cid => {
    const c = byId(cid);
    return (c ? c.members || 0 : 0) + (isJoined(cid) ? 1 : 0);
  };
  const onlineCount = cid => {
    const c = byId(cid);
    return c ? c.online || Math.round((c.members || 0) * 0.06) : 0;
  };

  /* ── Channels ────────────────────────────────────────────────────── */
  function channels(cid) {
    if (D.channels[cid]) return D.channels[cid];
    const c = byId(cid);
    if (!c) return [];
    const focus = (FOCUS[c.category] || FOCUS.tech).map(f => ({
      kind: 'text', space: 'Focus', ...f
    }));
    const list = BASE_CHANNELS.slice(0, 6).concat(focus).concat(BASE_CHANNELS.slice(6));
    return list.map(ch => ({ ...ch }));
  }
  const channel = (cid, chId) => channels(cid).find(c => c.id === chId) || channels(cid)[0] || null;
  const spaces = cid => {
    const out = [];
    channels(cid).forEach(ch => { if (out.indexOf(ch.space) < 0) out.push(ch.space); });
    return out;
  };
  function saveChannels(cid, list) { D.channels[cid] = list; save(); }

  /* A private channel needs the role it names, or a role above it. */
  function channelOpen(cid, ch) {
    if (!ch) return false;
    if (ch.gate && typeof CPM !== 'undefined') return CPM.gateOpen(cid, ch);
    if (!ch.private) return true;
    if (!isJoined(cid)) return false;
    const need = roleById(cid, ch.role || 'contributor');
    return myLevel(cid) >= need.level;
  }

  /* ── Messages ────────────────────────────────────────────────────── */
  /* The five original topics live in the old module's store so the
     Messages page and CommuneHub show one conversation, not two. */
  const LEGACY = ['general', 'announce', 'alpha', 'dev', 'support'];
  const legacyOk = cid => typeof CH !== 'undefined' && CH.COMMUNITIES && CH.COMMUNITIES.some(c => c.id === cid);
  const isLegacy = (cid, chId) => LEGACY.indexOf(chId) > -1 && legacyOk(cid);
  const key = (cid, chId) => cid + ':' + chId;

  function store(cid, chId) {
    if (isLegacy(cid, chId)) {
      CH.state.msgs[key(cid, chId)] = CH.state.msgs[key(cid, chId)] || [];
      return CH.state.msgs[key(cid, chId)];
    }
    D.msgs[key(cid, chId)] = D.msgs[key(cid, chId)] || [];
    return D.msgs[key(cid, chId)];
  }
  function persist(cid, chId) {
    if (isLegacy(cid, chId) && typeof CH !== 'undefined' && CH.persist) CH.persist();
    save();
  }

  /* Openers so a channel is never an empty box on the first visit. */
  const OPENERS = {
    rules: [['AutoMod', 'Be useful, be kind, no spam, no scams. Moderators act on reports within the hour.']],
    announce: [['{owner}', 'Welcome to the new home. Announcements land here and nowhere else.']],
    intros: [['{a}', 'Hi all — joined after seeing a thread in the feed. Happy to be here.'],
             ['{b}', 'Welcome! Drop what you are working on and someone will have notes.']],
    media: [['{a}', 'Shot this on the way in this morning 📷']],
    support: [['{b}', 'Anyone else seeing the sync spinner hang on first load?'],
              ['{c}', 'Clear the cache and reload once — it fixed it for me.']],
    general: [['{a}', 'Morning everyone.'], ['{b}', 'Is the call still on for Thursday?'],
              ['{c}', 'Yes — town hall, 18:00 UTC, stage channel.']]
  };

  function seedChannel(cid, chId) {
    const list = store(cid, chId);
    if (list.length) return list;
    const c = byId(cid);
    const mem = members(cid).filter(m => !m.you && !m.bot);
    const pick = i => (mem[i % mem.length] || { name: 'Member', handle: '@member', role: 'member' });
    const map = { '{owner}': pick(0), '{a}': pick(1), '{b}': pick(2), '{c}': pick(3) };
    const seeds = OPENERS[chId];
    if (!seeds) return list;
    seeds.forEach(([who, text], i) => {
      const p = map[who] || { name: who, handle: handleOf(who), role: 'mod' };
      list.push({
        id: 'sm' + chId + i, name: p.name, handle: p.handle, role: p.role || 'member',
        text: text.replace('{community}', c ? c.name : ''), ts: Date.now() - (seeds.length - i) * 5400000
      });
    });
    persist(cid, chId);
    return list;
  }

  const messages = (cid, chId) => seedChannel(cid, chId);

  /* AutoMod runs before anything is stored. It is a real filter: blocked
     words, link control, shouting and a per-channel slow mode. */
  function automod(cid) {
    return D.automod[cid] || (D.automod[cid] = {
      on: true, words: ['scam', 'airdrop claim', 'seed phrase', 'send eth to'],
      links: false, caps: true, slow: 0, spam: true
    });
  }

  function screen(cid, chId, text, ctx) {
    const am = automod(cid);
    const ai = () => (typeof CPM !== 'undefined' && CPM.aiScreen) ? CPM.aiScreen(cid, chId, text, ctx) : { ok: true };
    if (!am.on || myLevel(cid) >= 60) return ai();
    const low = text.toLowerCase();
    const hit = (am.words || []).find(w => w && low.indexOf(w.toLowerCase()) > -1);
    if (hit) return { ok: false, why: `AutoMod blocked that — “${hit}” is on this community's filter list.`, rule: 'word' };
    if (am.links && /https?:\/\//i.test(text) && myLevel(cid) < 30) {
      return { ok: false, why: 'AutoMod blocked that — links need the Contributor role here.', rule: 'link' };
    }
    if (am.caps && text.length > 12 && text === text.toUpperCase() && /[A-Z]{8}/.test(text)) {
      return { ok: false, why: 'AutoMod blocked that — please stop shouting.', rule: 'caps' };
    }
    const ch = channel(cid, chId);
    const slow = (ch && ch.slow) || am.slow || 0;
    if (slow) {
      const mine = store(cid, chId).filter(m => m.me).slice(-1)[0];
      if (mine && Date.now() - mine.ts < slow * 1000) {
        return { ok: false, why: `Slow mode: ${slow}s between messages here.`, rule: 'slow' };
      }
    }
    return ai();
  }

  function post(cid, chId, text, extra) {
    const t = String(text || '').trim();
    if (!t && !(extra && extra.attach)) return null;
    const ch = channel(cid, chId);
    if (ch && ch.locked && myLevel(cid) < 60) return { error: 'This channel is read-only.' };
    if (ch && ch.kind === 'announce' && !can(cid, 'broadcast')) return { error: 'Only broadcasters can post in announcements.' };
    if (!can(cid, 'post')) return { error: 'You do not have permission to post here.' };
    const check = screen(cid, chId, t, 'chat');
    if (!check.ok) {
      logMod(cid, check.held ? 'ai-hold' : 'automod', me().handle, check.why);
      return { error: check.why, automod: true, held: !!check.held };
    }
    const m = me();
    const msg = {
      id: 'm' + Date.now() + Math.floor(Math.random() * 999),
      name: m.name, handle: m.handle, role: topRole(cid).id,
      text: t, ts: Date.now(), me: true, ...(extra || {})
    };
    store(cid, chId).push(msg);
    persist(cid, chId);
    addRep(cid, 2);
    if (typeof CPM !== 'undefined' && CPM.notifyPost) CPM.notifyPost(cid, chId);
    return msg;
  }

  /* A message a moderator approved out of the AI hold queue. */
  function insertMessage(cid, chId, msg) {
    store(cid, chId).push(msg);
    persist(cid, chId);
    return msg;
  }

  function systemMsg(cid, chId, text) {
    seedChannel(cid, chId);          // openers first, so a join notice never
    store(cid, chId).push({ id: 'sys' + Date.now(), name: 'Welcome Bot', handle: '@welcome', role: 'mod', bot: true, kind: 'system', text, ts: Date.now() });
    persist(cid, chId);
  }

  function react(cid, chId, mid, emoji) {
    const msg = store(cid, chId).find(x => x.id === mid);
    if (!msg || !can(cid, 'react')) return;
    msg.react = msg.react || {};
    const who = me().handle;
    const list = msg.react[emoji] = msg.react[emoji] || [];
    const i = list.indexOf(who);
    if (i > -1) list.splice(i, 1); else list.push(who);
    if (!list.length) delete msg.react[emoji];
    persist(cid, chId);
  }

  function pin(cid, chId, mid) {
    if (!can(cid, 'pin')) return false;
    const msg = store(cid, chId).find(x => x.id === mid);
    if (!msg) return false;
    msg.pin = !msg.pin;
    persist(cid, chId);
    return msg.pin;
  }

  function remove(cid, chId, mid) {
    const list = store(cid, chId);
    const msg = list.find(x => x.id === mid);
    if (!msg) return false;
    if (!msg.me && !can(cid, 'moderate')) return false;
    list.splice(list.indexOf(msg), 1);
    if (!msg.me) logMod(cid, 'delete', msg.handle, 'Message removed');
    persist(cid, chId);
    return true;
  }

  function replyTo(cid, chId, mid, text) {
    const msg = store(cid, chId).find(x => x.id === mid);
    if (!msg || !can(cid, 'thread')) return null;
    const check = screen(cid, chId, text);
    if (!check.ok) return { error: check.why };
    const m = me();
    msg.thread = msg.thread || [];
    msg.thread.push({ id: 't' + Date.now(), name: m.name, handle: m.handle, role: topRole(cid).id, text, ts: Date.now(), me: true });
    persist(cid, chId);
    addRep(cid, 1);
    return msg;
  }

  function poll(cid, chId, question, options) {
    if (!can(cid, 'post')) return { error: 'You cannot post here.' };
    const m = me();
    const msg = {
      id: 'p' + Date.now(), name: m.name, handle: m.handle, role: topRole(cid).id, me: true,
      kind: 'poll', text: question, ts: Date.now(),
      poll: { q: question, opts: options.map(t => ({ t, votes: [] })) }
    };
    store(cid, chId).push(msg);
    persist(cid, chId);
    return msg;
  }

  function votePoll(cid, chId, mid, idx) {
    const msg = store(cid, chId).find(x => x.id === mid);
    if (!msg || !msg.poll) return;
    const who = me().handle;
    msg.poll.opts.forEach((o, i) => {
      o.votes = o.votes.filter(v => v !== who);
      if (i === idx) o.votes.push(who);
    });
    persist(cid, chId);
  }

  const pins = (cid, chId) => store(cid, chId).filter(m => m.pin);
  const unread = (cid, chId) => {
    const last = D.read[key(cid, chId)] || 0;
    return store(cid, chId).filter(m => m.ts > last && !m.me).length;
  };
  function markRead(cid, chId) { D.read[key(cid, chId)] = Date.now(); save(); }

  /* ── Boards (forum channels) ─────────────────────────────────────── */
  function boards(cid) { return D.boards[cid] || (D.boards[cid] = seedBoards(cid)); }

  function seedBoards(cid) {
    const c = byId(cid);
    const mem = members(cid).filter(m => !m.you && !m.bot);
    const pick = i => mem[i % mem.length] || { name: 'Member', handle: '@member' };
    const topics = {
      crypto: [['What actually changed after the last upgrade?', 'Fees are down but only for calldata-heavy apps. Numbers inside.', ['research', 'protocol']],
               ['Post-mortem: the bridge incident, hour by hour', 'Timeline, the exact call that drained it, and what stopped it.', ['security']]],
      gaming: [['Ranked is unplayable at peak hours — is it just me?', 'Two-minute queues, then a 40-ping lobby. Anyone else?', ['ranked', 'help']],
               ['Clip of the week thread', 'Post yours. Top comment wins the role.', ['clips']]],
      creator: [['Thumbnail A/B test: 42% lift, here is the data', 'Same video, two thumbnails, 30k impressions each.', ['growth', 'data']],
                ['How much do you charge for a 60-second spot?', 'Trying to sanity check a rate card.', ['rates']]],
      music:  [['Mixing low end on cheap monitors', 'What I do when I cannot trust the room.', ['production']],
               ['Release day checklist', 'Everything I wish I had done the first time.', ['releases']]],
      tech:   [['Monorepo or many repos in 2026?', 'Team of nine, four services, one very tired build.', ['architecture']],
               ['Interview loop that actually predicts performance', 'We changed ours and retention went up.', ['careers']]],
      sports: [['Match thread archive: what we got wrong', 'Reading back our predictions is humbling.', ['analysis']]],
      finance:[['Positioning into the print', 'What the options market implies versus the consensus.', ['macro']]],
      science:[['Replication attempt: results inside', 'Three runs, one clean failure, methods attached.', ['replication']]],
      brand:  [['What should we build next?', 'Three candidates, tell us which one hurts most today.', ['product']]],
      learning:[['Cohort 4 study plan', 'Six weeks, two hours a day, checkpoints on Fridays.', ['cohort']]]
    };
    const list = (topics[c ? c.category : 'tech'] || topics.tech);
    return list.map((t, i) => {
      const p = pick(i);
      return {
        id: 'b' + i + cid, title: t[0], body: t[1], tags: t[2],
        author: p.name, handle: p.handle, ts: Date.now() - (i + 1) * 7200000,
        votes: 12 + i * 7, voters: [], comments: [], solved: false, pinned: i === 0
      };
    });
  }

  function addBoard(cid, title, body, tags) {
    if (!can(cid, 'boards')) return { error: 'You cannot post on the boards here.' };
    const check = screen(cid, 'boards', title + ' ' + body);
    if (!check.ok) return { error: check.why };
    const m = me();
    const post = {
      id: 'b' + Date.now(), title, body, tags: tags || [], author: m.name, handle: m.handle,
      ts: Date.now(), votes: 1, voters: [m.handle], comments: [], solved: false, mine: true
    };
    boards(cid).unshift(post);
    save();
    addRep(cid, 5);
    return post;
  }

  function voteBoard(cid, id) {
    const p = boards(cid).find(x => x.id === id);
    if (!p) return;
    const who = me().handle;
    const i = p.voters.indexOf(who);
    if (i > -1) { p.voters.splice(i, 1); p.votes--; } else { p.voters.push(who); p.votes++; }
    save();
  }

  function commentBoard(cid, id, text) {
    const p = boards(cid).find(x => x.id === id);
    if (!p || !text.trim()) return;
    const check = screen(cid, 'boards', text);
    if (!check.ok) return { error: check.why };
    const m = me();
    p.comments.push({ id: 'c' + Date.now(), name: m.name, handle: m.handle, text: text.trim(), ts: Date.now(), me: true });
    save();
    addRep(cid, 2);
    return p;
  }

  function solveBoard(cid, id) {
    const p = boards(cid).find(x => x.id === id);
    if (!p) return;
    if (!p.mine && !can(cid, 'moderate')) return;
    p.solved = !p.solved;
    save();
  }

  /* ── Events ──────────────────────────────────────────────────────── */
  function events(cid) { return D.events[cid] || (D.events[cid] = seedEvents(cid)); }

  function seedEvents(cid) {
    const c = byId(cid);
    const mem = members(cid).filter(m => !m.you && !m.bot);
    const host = i => (mem[i % mem.length] || { name: 'Host', handle: '@host' });
    const day = 86400000;
    const base = [
      ['Community town hall', 'stage', 'townhall', 'What shipped, what is next, and your questions.', 1],
      ['Open voice hours', 'voice', 'lounge', 'Drop in, ask anything, no agenda.', 3],
      ['Live build session', 'live', 'live', 'Screen share while we put the next release together.', 6]
    ];
    return base.map((e, i) => ({
      id: 'e' + i + cid, title: e[0], kind: e[1], channel: e[2], desc: e[3],
      start: Date.now() + e[4] * day - (i * 3600000), mins: 60,
      host: host(i).name, hostHandle: host(i).handle, going: [], interested: []
    }));
  }

  function addEvent(cid, ev) {
    if (!can(cid, 'events')) return { error: 'You cannot create events here.' };
    const m = me();
    const e = {
      id: 'e' + Date.now(), title: ev.title, kind: ev.kind || 'voice', channel: ev.channel || 'lounge',
      desc: ev.desc || '', start: ev.start, mins: ev.mins || 60,
      host: m.name, hostHandle: m.handle, going: [m.handle], interested: [], mine: true
    };
    events(cid).push(e);
    events(cid).sort((a, b) => a.start - b.start);
    save();
    return e;
  }

  function rsvp(cid, id, how) {
    const e = events(cid).find(x => x.id === id);
    if (!e) return;
    const who = me().handle;
    e.going = e.going.filter(h => h !== who);
    e.interested = e.interested.filter(h => h !== who);
    if (how === 'going') e.going.push(who);
    if (how === 'interested') e.interested.push(who);
    save();
    return e;
  }

  function removeEvent(cid, id) {
    const e = events(cid).find(x => x.id === id);
    if (!e) return;
    if (!e.mine && !can(cid, 'events')) return;
    D.events[cid] = events(cid).filter(x => x.id !== id);
    save();
  }

  /* ── Community feed ──────────────────────────────────────────────── */
  function feed(cid) { return D.feed[cid] || (D.feed[cid] = seedFeed(cid)); }

  function seedFeed(cid) {
    const c = byId(cid);
    const mem = members(cid).filter(m => !m.you && !m.bot);
    const lines = [
      'Spent the morning cleaning up the onboarding flow. Three fewer steps, same result.',
      'Reminder that the town hall is this week — bring the awkward questions.',
      'Small win: the thing that broke twice last month has now survived a full week.'
    ];
    return lines.map((t, i) => {
      const p = mem[i % mem.length] || { name: 'Member', handle: '@member' };
      return { id: 'f' + i + cid, name: p.name, handle: p.handle, text: t, ts: Date.now() - (i + 1) * 9000000, likes: 8 + i * 5, liked: false, comments: [] };
    });
  }

  function addFeed(cid, text, opts) {
    if (!can(cid, 'post')) return { error: 'You cannot post here.' };
    const check = screen(cid, 'general', text);
    if (!check.ok) return { error: check.why };
    const m = me();
    const p = { id: 'f' + Date.now(), name: m.name, handle: m.handle, text: text.trim(), ts: Date.now(), likes: 0, liked: false, comments: [], mine: true };
    feed(cid).unshift(p);
    save();
    addRep(cid, 3);
    if (opts && opts.toTrending) shareToTrending(cid, text);
    return p;
  }

  function likeFeed(cid, id) {
    const p = feed(cid).find(x => x.id === id);
    if (!p) return;
    p.liked = !p.liked;
    p.likes += p.liked ? 1 : -1;
    save();
  }

  /* A broadcast can leave the community: same shape the rest of the app
     uses for a post, pushed through the feed's own storage helpers. */
  function shareToTrending(cid, text, title) {
    const c = byId(cid);
    if (!c || typeof DATA === 'undefined' || !Array.isArray(DATA.posts)) return false;
    const m = me();
    DATA.posts.unshift({
      id: Date.now(),
      type: 'text',
      author: c.name,
      handle: c.handle || ('@' + c.id),
      emoji: '📣',
      body: (title ? title + '\n\n' : '') + text,
      time: Date.now(),
      tags: (c.tags || []).slice(0, 3),
      likes: 0, comments: 0, shares: 0, liked: false, mine: true,
      category: 'community',
      fromCommunity: { id: c.id, name: c.name, by: m.handle }
    });
    if (typeof savePostsToLocal === 'function') savePostsToLocal();
    if (typeof renderFeed === 'function') renderFeed();
    return true;
  }

  /* ── Membership ──────────────────────────────────────────────────── */
  function join(cid, opts) {
    const c = byId(cid);
    if (!c || isJoined(cid)) return false;
    if ((D.bans[cid] || []).indexOf(me().handle) > -1) return false;
    D.joined[cid] = {
      at: Date.now(), roles: [iOwn(c) ? 'owner' : 'member'],
      interests: (opts && opts.interests) || [], notify: 'important', rules: !!(opts && opts.rules),
      tier: 'free'
    };
    D.rep[cid] = D.rep[cid] || 0;
    // Keep the old module in step so the Messages page lists it too.
    if (legacyOk(cid) && CH.state.joined.indexOf(cid) < 0) { CH.state.joined.push(cid); CH.persist(); }
    if ((D.apps[cid] || []).indexOf('welcome') > -1 || true) {
      systemMsg(cid, 'general', `${me().name} joined the community — say hello.`);
    }
    save();
    return true;
  }

  function leave(cid) {
    delete D.joined[cid];
    if (legacyOk(cid) && typeof CH !== 'undefined') {
      CH.state.joined = CH.state.joined.filter(x => x !== cid);
      CH.persist();
    }
    save();
  }

  function setNotify(cid, mode) { const m = membership(cid); if (m) { m.notify = mode; save(); } }
  function setInterests(cid, list) {
    const m = membership(cid);
    if (!m) return;
    m.interests = list;
    // Interests double as self-assignable roles, the way onboarding works.
    if (list.indexOf('build') > -1) grantRole(cid, 'contributor');
    if (list.indexOf('teach') > -1) grantRole(cid, 'expert');
    save();
  }
  function acceptRules(cid) { const m = membership(cid); if (m) { m.rules = true; save(); } }

  /* ── Reputation ──────────────────────────────────────────────────── */
  function addRep(cid, n) {
    if (!isJoined(cid)) return;
    D.rep[cid] = (D.rep[cid] || 0) + n;
    const r = D.rep[cid];
    // Contribution unlocks roles rather than anything tradeable.
    if (r >= 60) grantRole(cid, 'contributor');
    if (r >= 200) grantRole(cid, 'expert');
    save();
    if (typeof SF !== 'undefined' && SF.earn) { try { SF.earn('community_action'); } catch (e) {} }
  }
  const rep = cid => D.rep[cid] || 0;
  const REP_TIERS = [[0, 'Newcomer'], [60, 'Contributor'], [200, 'Expert'], [600, 'Pillar'], [1500, 'Legend']];
  const repTier = cid => REP_TIERS.filter(t => rep(cid) >= t[0]).slice(-1)[0][1];

  /* ── Invites ─────────────────────────────────────────────────────── */
  function invites(cid) { return D.invites[cid] || (D.invites[cid] = []); }
  function makeInvite(cid, opts) {
    if (!can(cid, 'invite')) return { error: 'You cannot create invites here.' };
    const code = Math.random().toString(36).slice(2, 9);
    const inv = {
      code, by: me().handle, at: Date.now(), uses: 0,
      max: (opts && opts.max) || 0, exp: (opts && opts.days) ? Date.now() + opts.days * 86400000 : 0
    };
    invites(cid).unshift(inv);
    save();
    return inv;
  }
  function revokeInvite(cid, code) { D.invites[cid] = invites(cid).filter(i => i.code !== code); save(); }
  const inviteLink = (cid, code) => `${location.origin}${location.pathname}#commune=${cid}${code ? '&i=' + code : ''}`;

  function useInvite(cid, code) {
    const inv = invites(cid).find(i => i.code === code);
    if (inv) { inv.uses++; save(); }
    return !!inv;
  }

  /* ── Moderation ──────────────────────────────────────────────────── */
  function modlog(cid) { return D.modlog[cid] || (D.modlog[cid] = []); }
  function logMod(cid, action, target, reason) {
    modlog(cid).unshift({ ts: Date.now(), action, target, by: me().handle, reason: reason || '' });
    if (modlog(cid).length > 200) modlog(cid).length = 200;
    save();
  }
  function timeout(cid, handle, mins) {
    if (!can(cid, 'moderate')) return false;
    D.timeouts[cid] = D.timeouts[cid] || {};
    D.timeouts[cid][handle] = Date.now() + mins * 60000;
    logMod(cid, 'timeout', handle, mins + ' minutes');
    save();
    return true;
  }
  function ban(cid, handle, reason) {
    if (!can(cid, 'ban')) return false;
    D.bans[cid] = D.bans[cid] || [];
    if (D.bans[cid].indexOf(handle) < 0) D.bans[cid].push(handle);
    logMod(cid, 'ban', handle, reason || '');
    save();
    return true;
  }
  function unban(cid, handle) {
    D.bans[cid] = (D.bans[cid] || []).filter(h => h !== handle);
    logMod(cid, 'unban', handle, '');
    save();
  }
  function setMemberRole(cid, handle, rid) {
    if (!can(cid, 'roles')) return false;
    const target = members(cid).find(m => m.handle === handle);
    if (target && roleById(cid, target.role).level >= myLevel(cid)) return false;   // hierarchy
    D.memberRoles[cid] = D.memberRoles[cid] || {};
    D.memberRoles[cid][handle] = rid;
    logMod(cid, 'role', handle, roleById(cid, rid).name);
    save();
    return true;
  }
  function setAutomod(cid, patch) { D.automod[cid] = { ...automod(cid), ...patch }; save(); }

  /* ── Memberships, apps, integrations, boosts ─────────────────────── */
  const TIER_SEED = [
    { id: 'free', name: 'Member', price: 0, perks: ['All public channels', 'Boards and events', 'Community roles'] },
    { id: 'plus', name: 'Supporter', price: 4.99, perks: ['Supporter badge', 'Early builds channel', 'Priority in Q&A', 'Custom expressions'] },
    { id: 'vip', name: 'Inner Circle', price: 14.99, perks: ['Everything in Supporter', 'Monthly private call', 'Direct line to the team', 'Name in credits'] }
  ];
  function tiers(cid) { return D.memberships[cid] || (D.memberships[cid] = TIER_SEED.map(t => ({ ...t }))); }
  function saveTiers(cid, list) { D.memberships[cid] = list; save(); }
  function subscribe(cid, tid) {
    const t = tiers(cid).find(x => x.id === tid);
    if (!t) return { error: 'Unknown tier.' };
    D.tiers[cid] = tid;
    const m = membership(cid);
    if (m) m.tier = tid;
    if (tid !== 'free') grantRole(cid, 'subscriber');
    save();
    return t;
  }
  const myTier = cid => D.tiers[cid] || 'free';

  const APPS = [
    { id: 'welcome',  name: 'Welcome Bot',  icon: 'waving_hand',   what: 'Posts a greeting in #general when someone joins.' },
    { id: 'automod',  name: 'AutoMod',      icon: 'shield',        what: 'Filters blocked words, links and shouting before a message lands.' },
    { id: 'pollbot',  name: 'Poll Bot',     icon: 'ballot',        what: 'Adds /poll to any channel.' },
    { id: 'stats',    name: 'Stats',        icon: 'insights',      what: 'Weekly activity summary posted to the announcements channel.' },
    { id: 'reminder', name: 'Event Nudge',  icon: 'alarm',         what: 'Reminds you when an event you follow is about to start.' }
  ];
  function apps(cid) { return D.apps[cid] || (D.apps[cid] = ['welcome', 'automod', 'pollbot']); }
  function toggleApp(cid, id) {
    const list = apps(cid);
    const i = list.indexOf(id);
    if (i > -1) list.splice(i, 1); else list.push(id);
    save();
    return list.indexOf(id) > -1;
  }

  function hooks(cid) { return D.integrations[cid] || (D.integrations[cid] = []); }
  function addHook(cid, h) { hooks(cid).unshift({ id: 'h' + Date.now(), on: true, ...h }); save(); }
  function removeHook(cid, id) { D.integrations[cid] = hooks(cid).filter(h => h.id !== id); save(); }

  function boost(cid) { D.boosts[cid] = (D.boosts[cid] || 0) + 1; save(); return D.boosts[cid]; }
  const boosts = cid => D.boosts[cid] || 0;
  const boostTier = cid => (boosts(cid) >= 14 ? 3 : boosts(cid) >= 7 ? 2 : boosts(cid) >= 2 ? 1 : 0);

  /* ── Creating a community ────────────────────────────────────────── */
  function create(form) {
    const id = 'my' + Date.now().toString(36);
    const m = me();
    const c = {
      id, name: form.name, handle: '@' + form.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14),
      icon: form.icon || 'groups', color: form.color || '#FCD535', desc: form.desc || '',
      category: form.category || 'tech', tags: (form.tags || '').split(',').map(s => s.trim()).filter(Boolean),
      members: 0, online: 1, verified: false, owner: m.handle, mine: true,
      privacy: form.privacy || 'public', createdAt: Date.now()
    };
    D.made.unshift(c);
    D.joined[id] = { at: Date.now(), roles: ['owner'], interests: [], notify: 'all', rules: true, tier: 'free' };
    save();
    systemMsg(id, 'general', `${c.name} was created. Set up your channels and invite the first members.`);
    return c;
  }

  function updateCommunity(cid, patch) {
    const c = D.made.find(x => x.id === cid);
    if (c) { Object.assign(c, patch); save(); return c; }
    // Seeded communities keep their own record; overrides live alongside.
    D.made.unshift({ ...byId(cid), ...patch, override: true });
    save();
    return byId(cid);
  }

  function destroy(cid) {
    D.made = D.made.filter(c => c.id !== cid);
    delete D.joined[cid];
    save();
  }

  /* ── Analytics ───────────────────────────────────────────────────── */
  /* Counts what this browser actually holds — messages, posts, events,
     reputation — next to the community's seeded size, and says which is
     which rather than inventing a dashboard. */
  function analytics(cid) {
    const chans = channels(cid);
    let msgs = 0, mine = 0, week = 0, byChannel = [];
    const weekAgo = Date.now() - 7 * 86400000;
    chans.forEach(ch => {
      if (ch.kind === 'voice' || ch.kind === 'stage' || ch.kind === 'live' || ch.kind === 'forum') return;
      const list = store(cid, ch.id);
      msgs += list.length;
      mine += list.filter(m => m.me).length;
      week += list.filter(m => m.ts > weekAgo).length;
      byChannel.push({ id: ch.id, name: ch.name, n: list.length });
    });
    byChannel.sort((a, b) => b.n - a.n);
    const b = boards(cid);
    const ev = events(cid);
    return {
      members: memberCount(cid), online: onlineCount(cid),
      msgs, mine, week, byChannel: byChannel.slice(0, 6),
      boards: b.length, comments: b.reduce((s, p) => s + p.comments.length, 0),
      events: ev.length, rsvps: ev.reduce((s, e) => s + e.going.length, 0),
      feed: feed(cid).length, rep: rep(cid), boosts: boosts(cid),
      channels: chans.length, roles: roles(cid).length,
      mod: modlog(cid).length, tier: myTier(cid)
    };
  }

  /* ── Search across one community ─────────────────────────────────── */
  function search(cid, q) {
    const term = String(q || '').toLowerCase().trim();
    if (!term) return { msgs: [], people: [], boards: [], events: [], channels: [] };
    const hit = s => String(s || '').toLowerCase().indexOf(term) > -1;
    const msgs = [];
    channels(cid).forEach(ch => {
      if (['voice', 'stage', 'live', 'forum'].indexOf(ch.kind) > -1) return;
      store(cid, ch.id).forEach(m => { if (hit(m.text)) msgs.push({ ...m, chan: ch }); });
    });
    return {
      msgs: msgs.sort((a, b) => b.ts - a.ts).slice(0, 25),
      people: members(cid).filter(m => hit(m.name) || hit(m.handle)).slice(0, 12),
      boards: boards(cid).filter(p => hit(p.title) || hit(p.body) || (p.tags || []).some(hit)).slice(0, 12),
      events: events(cid).filter(e => hit(e.title) || hit(e.desc)).slice(0, 8),
      channels: channels(cid).filter(ch => hit(ch.name) || hit(ch.topic)).slice(0, 8)
    };
  }

  /* ── Discovery ranking ───────────────────────────────────────────── */
  function trending() {
    return all().slice().sort((a, b) => {
      const score = c => (c.online || 0) * 3 + (c.members || 0) / 100 + (isJoined(c.id) ? 500 : 0);
      return score(b) - score(a);
    });
  }
  function recommended() {
    // Interests you picked anywhere, then categories you already sit in.
    const mineCats = {};
    Object.keys(D.joined).forEach(id => { const c = byId(id); if (c) mineCats[c.category] = (mineCats[c.category] || 0) + 1; });
    return all().filter(c => !isJoined(c.id)).sort((a, b) => {
      const s = c => (mineCats[c.category] || 0) * 1000 + (c.verified ? 300 : 0) + (c.online || 0) / 10;
      return s(b) - s(a);
    });
  }

  const state = () => D;
  const setState = patch => { Object.assign(D, patch); save(); };

  return {
    // reference data
    PERMS, ALL, ROLE_LIB, CATEGORIES, APPS, NAMES, BOTS, REP_TIERS,
    // communities
    all, byId, isJoined, membership, join, leave, create, updateCommunity, destroy,
    ownerOf, iOwn, memberCount, onlineCount, trending, recommended,
    // roles & permissions
    roles, roleById, myRoles, topRole, myLevel, can, grantRole, revokeRole, saveRoles, setMemberRole,
    // channels
    channels, channel, spaces, saveChannels, channelOpen, BASE_CHANNELS,
    // messages
    messages, post, react, pin, remove, replyTo, poll, votePoll, pins, unread, markRead, systemMsg, screen, insertMessage,
    // boards / events / feed
    boards, addBoard, voteBoard, commentBoard, solveBoard,
    events, addEvent, rsvp, removeEvent,
    feed, addFeed, likeFeed, shareToTrending,
    // people
    members, handleOf, me,
    // membership extras
    setNotify, setInterests, acceptRules, addRep, rep, repTier,
    tiers, saveTiers, subscribe, myTier,
    invites, makeInvite, revokeInvite, inviteLink, useInvite,
    apps, toggleApp, hooks, addHook, removeHook, boost, boosts, boostTier,
    // moderation
    automod, setAutomod, modlog, logMod, timeout, ban, unban,
    // reporting
    analytics, search,
    state, setState, save
  };
})();

window.CMD = CMD;

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
publish('features/commune.js', {
  CMD: () => CMD
});
