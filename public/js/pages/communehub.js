/* ╔══════════════════════════════════════════════════════════════════╗
   ║  COMMUNEHUB — the screens                                         ║
   ║                                                                   ║
   ║  Hub:        Discover · Joined · Trending · Categories            ║
   ║  Community:  Home · Feed · Chat · Voice · Live · Discussions ·    ║
   ║              Events · Members · About                             ║
   ║  Commune Hub+ (communeplus-*.js) adds For You, Rising, Following, ║
   ║  Nearby, Trend Radar, Passport, and Missions · Governance ·       ║
   ║  Marketplace · Knowledge · Collabs, through the hooks marked      ║
   ║  window.CPX below. Without those files this screen is unchanged.  ║
   ║  Owner:      Community Studio (communestudio.js)                  ║
   ║                                                                   ║
   ║  The layout is the one a community app needs: a rail of the       ║
   ║  communities you're in, a sidebar of spaces and channels, the     ║
   ║  room itself, and the member list beside it.                      ║
   ║                                                                   ║
   ║  What is real here: every message, thread, reaction, pin, poll,   ║
   ║  board post, comment, event and role change is yours and is       ║
   ║  stored on this device. In a voice or live room your microphone,  ║
   ║  camera and screen share are real — the other people in the room  ║
   ║  are the community's demo members, because peer-to-peer calling   ║
   ║  needs a signalling server this app doesn't have. The UI says so  ║
   ║  rather than pretending otherwise.                                ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const HUB = (() => {

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const $ = id => document.getElementById(id);
  const A = v => esc(JSON.stringify(v === undefined ? null : v));
  const D = () => CMD.state();

  /* Session-only bits: what's open, what the mic is doing. */
  let ui = { members: true, sidebar: false, thread: null, search: '', boardOpen: null, sort: 'new', filter: '' };
  let room = null;    // { cid, chId, kind, stream, cam, screen, muted, deaf, meter, ctx }

  const initials = n => String(n || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = s => { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) % 360; return h; };
  const av = (name, handle, size) => `<span class="hub-av${window.PME && PME.isMe(handle) ? ' pme-me' : ''}" style="--h:${hue(handle || name)};${size ? `width:${size}px;height:${size}px;font-size:${Math.round(size / 2.6)}px` : ''}">${esc(initials(name))}</span>`;

  function ago(ts) {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 604800) return Math.floor(s / 86400) + 'd';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  const clock = ts => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const when = ts => new Date(ts).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const compact = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
    : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n || 0));

  const CH_ICON = { text: 'tag', announce: 'campaign', voice: 'volume_up', stage: 'podium', live: 'screen_share', forum: 'forum' };
  const chanIcon = ch => CH_ICON[ch.kind] || 'tag';

  /* ══════════════════════════════════════════════════════════════════
     Paint
     ══════════════════════════════════════════════════════════════════ */

  function paint() {
    const root = $('hub-root');
    if (!root) return;
    const d = D();
    if (d.screen === 'studio' && window.CST) { root.innerHTML = CST.html(d.cid); CST.wire(); return; }
    if (d.screen === 'community' && CMD.byId(d.cid)) { root.innerHTML = communityHTML(d.cid); wireCommunity(); return; }
    root.innerHTML = hubHTML();
    wireHub();
  }

  const go = patch => { CMD.setState(patch); paint(); };

  function open(cid) {
    const c = CMD.byId(cid);
    if (!c) return;
    if (!CMD.isJoined(cid)) { openJoin(cid); return; }
    const first = CMD.channels(cid).find(ch => ch.kind === 'text') || CMD.channels(cid)[0];
    if (D().screen !== 'community') ui.sidebar = false;
    go({ screen: 'community', cid, tab: 'home', chan: first ? first.id : 'general' });
  }
  const backToHub = () => { leaveRoom(); ui.sidebar = false; go({ screen: 'hub' }); };

  /* ══════════════════════════════════════════════════════════════════
     Hub
     ══════════════════════════════════════════════════════════════════ */

  function hubHTML() {
    const d = D();
    const tab = d.hubTab;
    let list = tab === 'joined' ? CMD.all().filter(c => CMD.isJoined(c.id))
      : tab === 'trending' ? CMD.trending()
      : tab === 'discover' ? CMD.recommended().concat(CMD.all().filter(c => CMD.isJoined(c.id)))
      : CMD.all();
    if (d.cat !== 'all') list = list.filter(c => c.category === d.cat);
    if (window.CCR && tab !== 'joined') list = list.filter(c => CCR.visible(c));
    if (ui.filter) {
      const q = ui.filter.toLowerCase();
      list = list.filter(c => (c.name + ' ' + c.desc + ' ' + (c.tags || []).join(' ')).toLowerCase().indexOf(q) > -1);
    }

    const joinedCount = Object.keys(d.joined).length;

    return `
    <div class="hub">
      <div class="hub-top">
        <div class="hub-top-l">
          <h1 class="hub-h1"><span class="material-symbols-rounded">hub</span>Commune<span class="hub-h1-b">Hub</span></h1>
          <p class="hub-sub">Communities with spaces, channels, voice rooms, boards and events — ${joinedCount ? `you're in ${joinedCount}` : 'join one to get started'}.</p>
        </div>
        <div class="hub-top-r">
          <label class="hub-find">
            <span class="material-symbols-rounded">search</span>
            <input id="hub-find" placeholder="Search communities" value="${esc(ui.filter)}">
          </label>
          <button class="hub-btn primary" onclick="HUB.openCreate()"><span class="material-symbols-rounded">add</span>Create</button>
        </div>
      </div>

      <div class="hub-tabs">
        ${[['discover', 'Discover', 'explore'], ['joined', 'Joined', 'check_circle'], ['trending', 'Trending', 'trending_up'], ['categories', 'Categories', 'category']]
          .map(([k, l, i]) => `<button class="hub-tab${tab === k ? ' on' : ''}" onclick="HUB.hubTab('${k}')">
            <span class="material-symbols-rounded">${i}</span>${l}</button>`).join('')}
        ${window.CPX ? CPX.hubTabsHTML(tab) : ''}
        <span class="hub-tabs-gap"></span>
        ${[['launchpad', 'Projects', 'rocket_launch'], ['governance', 'Governance', 'how_to_vote'], ['assets', 'Asset Lab', 'auto_awesome']]
          .map(([k, l, i]) => `<button class="hub-tab ghost${tab === k ? ' on' : ''}" onclick="HUB.hubTab('${k}')">
            <span class="material-symbols-rounded">${i}</span>${l}</button>`).join('')}
      </div>

      ${['launchpad', 'governance', 'assets'].indexOf(tab) > -1
        ? `<div id="ch-root" class="hub-legacy"></div>`
        : (window.CPX && CPX.isHubTab(tab)) ? CPX.hubBody(tab)
        : `
      <div class="hub-cats">
        ${CMD.CATEGORIES.map(([k, l, i]) => `<button class="hub-cat${d.cat === k ? ' on' : ''}" onclick="HUB.setCat('${k}')">
          <span class="material-symbols-rounded">${i}</span>${l}</button>`).join('')}
      </div>

      ${tab === 'categories' ? categoryGridHTML() : list.length
        ? `<div class="hub-grid">${list.map(cardHTML).join('')}</div>`
        : `<div class="hub-empty"><span class="material-symbols-rounded">groups</span>
             <p>${tab === 'joined' ? "You haven't joined a community yet — Discover has a few worth a look." : 'Nothing matches that.'}</p></div>`}
      `}
    </div>`;
  }

  function cardHTML(c) {
    const joined = CMD.isJoined(c.id);
    const cat = (CMD.CATEGORIES.find(x => x[0] === c.category) || ['', c.category, 'tag'])[1];
    const pulse = Math.min(100, Math.round(((c.online || 0) / Math.max(1, c.members || 1)) * 1200));
    return `
    <article class="hub-card" onclick="HUB.open('${c.id}')">
      <div class="hub-card-banner" style="background:${window.CCR ? CCR.bannerCSS(c) : `linear-gradient(135deg, ${c.color}, ${c.color}44)`}">
        <span class="hub-card-cat">${esc(cat)}</span>
        ${window.CCR ? CCR.cardBadge(c) : ''}
        ${CMD.boosts(c.id) ? `<span class="hub-card-boost"><span class="material-symbols-rounded">bolt</span>${CMD.boosts(c.id)}</span>` : ''}
      </div>
      <div class="hub-card-body">
        <div class="hub-card-icon" style="--c:${c.color}">${window.CCR ? CCR.icon(c) : `<span class="material-symbols-rounded">${esc(c.icon)}</span>`}</div>
        <div class="hub-card-name">${esc(c.name)}${c.verified ? '<span class="material-symbols-rounded hub-verif" title="Verified community">verified</span>' : ''}</div>
        <div class="hub-card-handle">${esc(c.handle || '@' + c.id)}</div>
        <p class="hub-card-desc">${esc(c.desc)}</p>
        <div class="hub-card-stats">
          <span><b>${compact(CMD.memberCount(c.id))}</b> members</span>
          <span class="hub-dot-live"></span><span><b>${compact(CMD.onlineCount(c.id))}</b> online</span>
        </div>
        <div class="hub-card-bar"><i style="width:${pulse}%"></i></div>
        <div class="hub-card-foot">
          ${(c.tags || []).slice(0, 2).map(t => `<span class="hub-chip-s">${esc(t)}</span>`).join('')}
          <button class="hub-btn ${joined ? '' : 'primary'} sm" onclick="event.stopPropagation();HUB.${joined ? `open('${c.id}')` : `openJoin('${c.id}')`}">
            ${joined ? 'Open' : 'Join'}</button>
        </div>
      </div>
    </article>`;
  }

  function categoryGridHTML() {
    return `<div class="hub-catgrid">
      ${CMD.CATEGORIES.filter(c => c[0] !== 'all').map(([k, l, i]) => {
        const list = CMD.all().filter(c => c.category === k);
        const people = list.reduce((s, c) => s + (c.members || 0), 0);
        return `<button class="hub-catcard" onclick="HUB.setCat('${k}');HUB.hubTab('discover')">
          <span class="material-symbols-rounded">${i}</span>
          <b>${l}</b>
          <span class="hub-catcard-n">${list.length} communities · ${compact(people)} members</span>
        </button>`;
      }).join('')}
    </div>`;
  }

  function wireHub() {
    const f = $('hub-find');
    if (f) {
      f.addEventListener('input', () => {
        ui.filter = f.value;
        const grid = document.querySelector('.hub-grid');
        if (grid) paint();
      });
    }
    const d = D();
    if (window.CPX && CPX.isHubTab(d.hubTab)) CPX.wireHub();
    if (['launchpad', 'governance', 'assets'].indexOf(d.hubTab) > -1 && typeof CH !== 'undefined') {
      CH.setView(d.hubTab === 'launchpad' ? 'launchpad' : d.hubTab);
    }
  }

  const hubTab = t => { ui.filter = ''; go({ hubTab: t }); };
  const setCat = c => go({ cat: c });

  /* ══════════════════════════════════════════════════════════════════
     Community shell
     ══════════════════════════════════════════════════════════════════ */

  const TABS = [
    ['home', 'Home', 'home'], ['feed', 'Feed', 'dynamic_feed'], ['chat', 'Chat', 'forum'],
    ['voice', 'Voice', 'volume_up'], ['live', 'Live', 'screen_share'], ['boards', 'Discussions', 'topic'],
    ['events', 'Events', 'event'], ['missions', 'Missions', 'flag'], ['governance', 'Governance', 'how_to_vote'],
    ['members', 'Members', 'group'], ['marketplace', 'Marketplace', 'storefront'], ['knowledge', 'Knowledge', 'library_books'],
    ['collabs', 'Collabs', 'handshake'], ['about', 'About', 'info']
  ];
  const PLUS_TABS = ['missions', 'governance', 'marketplace', 'knowledge', 'collabs'];

  function communityHTML(cid) {
    const c = CMD.byId(cid);
    const d = D();
    const tab = d.tab;
    const mine = CMD.all().filter(x => CMD.isJoined(x.id));
    const showMembers = ui.members && ['chat', 'members', 'voice', 'live'].indexOf(tab) > -1;

    return `
    <div class="hub-app${showMembers ? ' with-members' : ''}${ui.sidebar ? ' side-open' : ''}">
      ${ui.sidebar ? '<button type="button" class="hub-shade" onclick="HUB.toggleSide(false)" aria-label="Close menu"></button>' : ''}
      <nav class="hub-rail">
        <button class="hub-rail-b home" onclick="HUB.backToHub()" title="All communities"><span class="material-symbols-rounded">hub</span></button>
        <span class="hub-rail-sep"></span>
        ${mine.map(x => `<button class="hub-rail-b${x.id === cid ? ' on' : ''}" style="--c:${x.color}" onclick="HUB.open('${x.id}')" title="${esc(x.name)}">
            ${window.CCR ? CCR.icon(x) : `<span class="material-symbols-rounded">${esc(x.icon)}</span>`}
            ${unreadTotal(x.id) ? `<i class="hub-rail-dot">${unreadTotal(x.id) > 9 ? '9+' : unreadTotal(x.id)}</i>` : ''}
          </button>`).join('')}
        <button class="hub-rail-b add" onclick="HUB.openCreate()" title="Create a community"><span class="material-symbols-rounded">add</span></button>
      </nav>

      <aside class="hub-side">
        ${window.CCR ? CCR.sideBanner(c) : ''}
        <header class="hub-side-head" style="--c:${c.color}">
          <div class="hub-side-name">
            <b>${esc(c.name)}</b>${c.verified ? '<span class="material-symbols-rounded hub-verif">verified</span>' : ''}
          </div>
          <button class="hub-ico" onclick="HUB.openCommunityMenu()" title="Community menu"><span class="material-symbols-rounded">expand_more</span></button>
          <button class="hub-ico only-mobile hub-side-x" onclick="HUB.toggleSide(false)" title="Close menu" aria-label="Close menu"><span class="material-symbols-rounded">close</span></button>
        </header>
        <div class="hub-side-meta">
          <span class="hub-dot-live"></span>${compact(CMD.onlineCount(cid))} online
          <span class="hub-side-sep">·</span>${compact(CMD.memberCount(cid))} members
        </div>

        <div class="hub-side-nav">
          ${TABS.filter(t => window.CPX || PLUS_TABS.indexOf(t[0]) < 0).map(([k, l, i]) => `<button class="hub-nav-b${tab === k ? ' on' : ''}" onclick="HUB.setTab('${k}')">
            <span class="material-symbols-rounded">${i}</span>${l}</button>`).join('')}
          ${CMD.can(cid, 'analytics') || CMD.iOwn(c) ? `<button class="hub-nav-b studio" onclick="HUB.openStudio()">
            <span class="material-symbols-rounded">tune</span>Community Studio</button>` : ''}
        </div>

        <div class="hub-side-chans">${channelListHTML(cid)}</div>

        <footer class="hub-side-foot">
          <button class="hub-me" onclick="HUB.openPresence()">
            ${av(CMD.me().name, CMD.me().handle, 30)}
            <span class="hub-me-t"><b>${esc(CMD.me().name)}</b><span>${esc(CMD.topRole(cid).name)} · ${esc(d.presence)}</span></span>
            <span class="hub-pres ${esc(d.presence)}"></span>
          </button>
          <button class="hub-ico" onclick="HUB.openNotify()" title="Notification settings"><span class="material-symbols-rounded">notifications</span></button>
        </footer>
      </aside>

      <main class="hub-main">
        <header class="hub-bar">
          <button class="hub-ico only-mobile" onclick="HUB.toggleSide()" title="Menu" aria-label="Open menu" aria-expanded="${ui.sidebar ? 'true' : 'false'}"><span class="material-symbols-rounded">menu</span></button>
          ${barHTML(cid, tab)}
          <span class="hub-bar-gap"></span>
          ${window.CPX ? CPX.barButtons(cid) : ''}
          <button class="hub-ico" onclick="HUB.openSearch()" title="Search this community"><span class="material-symbols-rounded">search</span></button>
          <button class="hub-ico" onclick="HUB.openPins()" title="Pinned"><span class="material-symbols-rounded">push_pin</span></button>
          <button class="hub-ico${ui.members ? ' on' : ''}" onclick="HUB.toggleMembers()" title="Members"><span class="material-symbols-rounded">group</span></button>
        </header>
        ${window.CCR ? CCR.lapseBanner(cid) : ''}
        <div class="hub-body" id="hub-body">${tabHTML(cid, tab)}</div>
      </main>

      ${showMembers ? `<aside class="hub-members">${memberListHTML(cid)}</aside>` : ''}
    </div>`;
  }

  function unreadTotal(cid) {
    if (!CMD.isJoined(cid)) return 0;
    return CMD.channels(cid).filter(ch => ch.kind === 'text' || ch.kind === 'announce')
      .reduce((s, ch) => s + CMD.unread(cid, ch.id), 0);
  }

  function channelListHTML(cid) {
    const d = D();
    return CMD.spaces(cid).map(space => {
      const list = CMD.channels(cid).filter(ch => ch.space === space);
      return `<div class="hub-space">
        <div class="hub-space-h"><span class="material-symbols-rounded">expand_more</span>${esc(space)}
          ${CMD.can(cid, 'channels') ? `<button class="hub-space-add" onclick="HUB.openChannelForm('${esc(space)}')" title="Add channel">+</button>` : ''}
        </div>
        ${list.map(ch => {
          const open = CMD.channelOpen(cid, ch);
          const n = (ch.kind === 'text' || ch.kind === 'announce') ? CMD.unread(cid, ch.id) : 0;
          const active = d.chan === ch.id;
          return `<button class="hub-chan${active ? ' on' : ''}${open ? '' : ' locked'}" onclick="HUB.openChannel('${ch.id}')">
            <span class="material-symbols-rounded">${open ? chanIcon(ch) : 'lock'}</span>
            <span class="hub-chan-n">${esc(ch.name)}</span>
            ${ch.private ? '<span class="material-symbols-rounded hub-chan-lock">shield</span>' : ''}
            ${n ? `<i class="hub-chan-badge">${n > 99 ? '99+' : n}</i>` : ''}
          </button>`;
        }).join('')}
      </div>`;
    }).join('');
  }

  function barHTML(cid, tab) {
    const d = D();
    const ch = CMD.channel(cid, d.chan);
    if (['chat', 'voice', 'live'].indexOf(tab) > -1 && ch) {
      return `<div class="hub-bar-t">
        <span class="material-symbols-rounded">${chanIcon(ch)}</span><b>${esc(ch.name)}</b>
        ${ch.topic ? `<span class="hub-bar-topic">${esc(ch.topic)}</span>` : ''}
      </div>`;
    }
    const label = (TABS.find(t => t[0] === tab) || ['', tab])[1];
    return `<div class="hub-bar-t"><b>${esc(label)}</b></div>`;
  }

  function memberListHTML(cid) {
    const list = CMD.members(cid);
    const roles = CMD.roles(cid);
    const groups = [];
    roles.forEach(r => {
      const inRole = list.filter(m => m.role === r.id && m.presence !== 'offline');
      if (inRole.length) groups.push([r.name + ' — ' + inRole.length, inRole, r.color]);
    });
    const off = list.filter(m => m.presence === 'offline');
    if (off.length) groups.push(['Offline — ' + off.length, off, '']);
    return `
      <div class="hub-members-h">
        <b>Community network</b>
        <input class="hub-members-find" placeholder="Find a member" oninput="HUB.filterMembers(this.value)">
      </div>
      <div class="hub-members-l" id="hub-mlist">
        ${groups.map(([label, arr, color]) => `
          <div class="hub-mgroup">${esc(label)}</div>
          ${arr.map(m => rowMember(cid, m, color)).join('')}
        `).join('')}
      </div>`;
  }

  function rowMember(cid, m, color) {
    return `<button class="hub-m" data-name="${esc((m.name + ' ' + m.handle).toLowerCase())}" onclick="HUB.openMember('${esc(m.handle)}')">
      <span class="hub-m-av">${av(m.name, m.handle, 30)}<i class="hub-pres ${esc(m.presence)}"></i></span>
      <span class="hub-m-t">
        <b class="ink" style="${color ? `color:${color}` : ''}">${esc(m.name)}${m.you ? ' (you)' : ''}${m.bot ? ' <i class="hub-bot">BOT</i>' : ''}</b>
        ${m.activity ? `<span>${esc(m.activity)}</span>` : `<span>${esc(CMD.roleById(cid, m.role).name)}</span>`}
      </span>
    </button>`;
  }

  const filterMembers = q => {
    const term = String(q || '').toLowerCase();
    document.querySelectorAll('#hub-mlist .hub-m').forEach(el => {
      el.style.display = !term || el.dataset.name.indexOf(term) > -1 ? '' : 'none';
    });
  };

  /* ══════════════════════════════════════════════════════════════════
     Tabs
     ══════════════════════════════════════════════════════════════════ */

  function tabHTML(cid, tab) {
    switch (tab) {
      case 'home':    return homeHTML(cid);
      case 'feed':    return feedHTML(cid);
      case 'chat':    return chatHTML(cid);
      case 'voice':   return roomHTML(cid, 'voice');
      case 'live':    return roomHTML(cid, 'live');
      case 'boards':  return boardsHTML(cid);
      case 'events':  return eventsHTML(cid);
      case 'members': return membersPageHTML(cid);
      case 'about':   return aboutHTML(cid);
      default:        return (window.CPX && CPX.communityTab) ? CPX.communityTab(cid, tab) : '';
    }
  }

  /* ── Home ────────────────────────────────────────────────────────── */
  function homeHTML(cid) {
    const c = CMD.byId(cid);
    const ev = CMD.events(cid).filter(e => e.start > Date.now() - 3600000).slice(0, 3);
    const pins = [];
    CMD.channels(cid).forEach(ch => { if (ch.kind === 'text' || ch.kind === 'announce') CMD.pins(cid, ch.id).forEach(p => pins.push({ ...p, chan: ch })); });
    const top = CMD.members(cid).slice().sort((a, b) => b.rep - a.rep).slice(0, 5);
    const m = CMD.membership(cid);
    const first = [
      ['Read the rules', 'rules', !!(m && m.rules)],
      ['Say hello in introductions', 'intros', CMD.messages(cid, 'intros').some(x => x.me)],
      ['Pick your interests', '', !!(m && m.interests && m.interests.length)],
      ['Follow an event', '', CMD.events(cid).some(e => e.going.indexOf(CMD.me().handle) > -1)]
    ];

    return `
    <div class="hub-scroll">
      ${window.CCR ? CCR.heroBanner(c) : ''}
      <section class="hub-hero" style="--c:${c.color}">
        <div class="hub-hero-icon" style="--c:${c.color}">${window.CCR ? CCR.icon(c) : `<span class="material-symbols-rounded">${esc(c.icon)}</span>`}</div>
        <div class="hub-hero-t">
          <h2>${esc(c.name)}${c.verified ? '<span class="material-symbols-rounded hub-verif">verified</span>' : ''}</h2>
          <p>${esc(c.tagline || c.desc)}</p>
          <div class="hub-hero-s">
            <span><b>${compact(CMD.memberCount(cid))}</b> members</span>
            <span><b>${compact(CMD.onlineCount(cid))}</b> online</span>
            <span><b>${CMD.rep(cid)}</b> your reputation · ${esc(CMD.repTier(cid))}</span>
          </div>
        </div>
        <div class="hub-hero-a">
          ${window.CCR ? CCR.heroAction(cid) : ''}
          <button class="hub-btn" onclick="HUB.openInvite()"><span class="material-symbols-rounded">person_add</span>Invite</button>
          <button class="hub-btn" onclick="HUB.doBoost()"><span class="material-symbols-rounded">bolt</span>Support${CMD.boosts(cid) ? ' · ' + CMD.boosts(cid) : ''}</button>
        </div>
      </section>

      <div class="hub-cols">
        <section class="hub-panel">
          <h3 class="hub-h3"><span class="material-symbols-rounded">flag</span>Community guide</h3>
          <p class="hub-guide">${esc(c.guide || `New here? Start in #general, introduce yourself in #introductions, and check #announcements for anything important. Voice rooms are open all day — Lounge is the busy one.`)}</p>
          <div class="hub-tasks">
            ${first.map(([label, chan, done]) => `
              <button class="hub-task${done ? ' done' : ''}" ${chan ? `onclick="HUB.openChannel('${chan}')"` : 'onclick="HUB.openInterests()"'}>
                <span class="material-symbols-rounded">${done ? 'check_circle' : 'radio_button_unchecked'}</span>${esc(label)}
              </button>`).join('')}
          </div>
        </section>

        <section class="hub-panel">
          <h3 class="hub-h3"><span class="material-symbols-rounded">event</span>Coming up</h3>
          ${ev.length ? ev.map(e => eventRow(cid, e, true)).join('') : '<p class="hub-none">No events scheduled.</p>'}
          <button class="hub-btn sm" onclick="HUB.setTab('events')">All events</button>
        </section>

        <section class="hub-panel">
          <h3 class="hub-h3"><span class="material-symbols-rounded">push_pin</span>Highlights</h3>
          ${pins.length ? pins.slice(0, 4).map(p => `
            <button class="hub-hl" onclick="HUB.openChannel('${p.chan.id}')">
              <b>#${esc(p.chan.name)}</b><span>${esc(p.text.slice(0, 90))}</span>
            </button>`).join('') : '<p class="hub-none">Pin a message and it shows up here.</p>'}
        </section>

        <section class="hub-panel">
          <h3 class="hub-h3"><span class="material-symbols-rounded">military_tech</span>Top contributors</h3>
          ${top.map((m, i) => `<div class="hub-topc">
            <span class="hub-topc-n">${i + 1}</span>${av(m.name, m.handle, 28)}
            <b>${esc(m.name)}</b><span>${compact(m.rep)} rep</span>
          </div>`).join('')}
        </section>

        <section class="hub-panel">
          <h3 class="hub-h3"><span class="material-symbols-rounded">volume_up</span>Voice right now</h3>
          ${CMD.channels(cid).filter(ch => ch.kind === 'voice' || ch.kind === 'stage').map(ch => {
            const n = Math.max(0, Math.round(CMD.onlineCount(cid) / 400) + (room && room.chId === ch.id ? 1 : 0));
            return `<button class="hub-vroom" onclick="HUB.openChannel('${ch.id}')">
              <span class="material-symbols-rounded">${chanIcon(ch)}</span><b>${esc(ch.name)}</b>
              <span class="hub-vroom-n">${n} in room</span></button>`;
          }).join('')}
        </section>
        ${window.CPX ? CPX.homePanels(cid) : ''}
      </div>
    </div>`;
  }

  /* ── Feed ────────────────────────────────────────────────────────── */
  function feedHTML(cid) {
    const list = CMD.feed(cid);
    const canBroadcast = CMD.can(cid, 'broadcast');
    return `
    <div class="hub-scroll">
      <div class="hub-compose">
        ${av(CMD.me().name, CMD.me().handle, 38)}
        <div class="hub-compose-b">
          <textarea id="hub-fpost" rows="2" placeholder="Share something with ${esc(CMD.byId(cid).name)}"></textarea>
          <div class="hub-compose-a">
            ${canBroadcast ? `<label class="hub-check"><input type="checkbox" id="hub-fshare"> Also publish to the Trending feed</label>` : '<span class="hub-none sm">Community post — stays inside this community.</span>'}
            <button class="hub-btn primary sm" onclick="HUB.postFeed()">Post</button>
          </div>
        </div>
      </div>
      ${list.map(p => `
        <article class="hub-post">
          <div class="hub-post-h">${av(p.name, p.handle, 36)}
            <div><b>${esc(p.name)}</b><span>${esc(p.handle)} · ${ago(p.ts)}</span></div>
          </div>
          <p class="hub-post-b">${linkify(p.text)}</p>
          <div class="hub-post-a">
            <button class="hub-act${p.liked ? ' on' : ''}" onclick="HUB.likeFeed('${p.id}')">
              <span class="material-symbols-rounded">favorite</span>${p.likes}</button>
            <button class="hub-act" onclick="HUB.setTab('boards')"><span class="material-symbols-rounded">mode_comment</span>Discuss</button>
            ${window.NT ? `<button class="hub-act" onclick="NT.fromContent('community_post', '${cid}:${p.id}')"><span class="material-symbols-rounded">sticky_note_2</span>Note</button>` : ''}
            ${CMD.can(cid, 'broadcast') ? `<button class="hub-act" onclick="HUB.pushToTrending('${p.id}')"><span class="material-symbols-rounded">campaign</span>To Trending</button>` : ''}
            ${window.CPX ? CPX.feedExtra(cid, p) : ''}
          </div>
        </article>`).join('')}
    </div>`;
  }

  function linkify(t) {
    return esc(t)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, '$1<span class="hub-tag">#$2</span>')
      .replace(/(^|\s)@([\p{L}\p{N}_.]+)/gu, '$1<span class="hub-men">@$2</span>');
  }

  /* ── Chat ────────────────────────────────────────────────────────── */
  function chatHTML(cid) {
    const d = D();
    const ch = CMD.channel(cid, d.chan);
    if (!ch) return '<div class="hub-none">No channel selected.</div>';
    if (['voice', 'stage', 'live'].indexOf(ch.kind) > -1) return roomHTML(cid, ch.kind === 'live' ? 'live' : 'voice');
    if (ch.kind === 'forum') return boardsHTML(cid);
    if (ch.gate && window.CPX && !CMD.channelOpen(cid, ch)) return CPX.gateLockedHTML(cid, ch);
    if (!CMD.channelOpen(cid, ch) && window.CCR) { const members = CCR.lockedHTML(cid, ch); if (members) return members; }
    if (!CMD.channelOpen(cid, ch)) {
      const need = CMD.roleById(cid, ch.role || 'contributor');
      return `<div class="hub-locked">
        <span class="material-symbols-rounded">lock</span>
        <b>#${esc(ch.name)} is an exclusive space</b>
        <p>You need the <b class="ink" style="color:${need.color}">${esc(need.name)}</b> role to see this channel. Contribute in the open channels and it unlocks at ${need.id === 'contributor' ? '60' : '200'} reputation — you have ${CMD.rep(cid)}.</p>
      </div>`;
    }

    CMD.markRead(cid, ch.id);
    const list = CMD.messages(cid, ch.id);
    const canPost = CMD.can(cid, 'post') && !(ch.locked && CMD.myLevel(cid) < 60) && !(ch.kind === 'announce' && !CMD.can(cid, 'broadcast'));
    const am = CMD.automod(cid);

    return `
    <div class="hub-chat">
      <div class="hub-msgs" id="hub-msgs">
        <div class="hub-chan-intro">
          <span class="material-symbols-rounded" style="color:${CMD.byId(cid).color}">${chanIcon(ch)}</span>
          <h3>Welcome to #${esc(ch.name)}</h3>
          <p>${esc(ch.topic || 'This is the start of the channel.')}</p>
        </div>
        ${list.map((m, i) => msgHTML(cid, ch, m, list[i - 1])).join('')}
      </div>

      ${ui.thread ? threadHTML(cid, ch) : ''}

      ${canPost ? `
      <div class="hub-composer">
        <button class="hub-ico" onclick="HUB.attach()" title="Attach"><span class="material-symbols-rounded">add_circle</span></button>
        <div class="hub-composer-in">
          <textarea id="hub-in" rows="1" placeholder="Message #${esc(ch.name)}${ch.slow || am.slow ? ` · slow mode ${ch.slow || am.slow}s` : ''}"></textarea>
          <div class="hub-mention" id="hub-mention" hidden></div>
        </div>
        <button class="hub-ico" onclick="HUB.openEmoji()" title="Expressions"><span class="material-symbols-rounded">mood</span></button>
        <button class="hub-ico send" onclick="HUB.send()" title="Send"><span class="material-symbols-rounded">send</span></button>
        <input type="file" id="hub-file" accept="image/*,video/*,.pdf,.txt,.md,.csv" hidden>
      </div>
      <div class="hub-composer-note">${am.on ? 'AutoMod is on · ' : ''}Slash commands: <b>/poll</b> question | a | b · <b>/event</b> title | in 2h · <b>/me</b> action</div>
      ` : `<div class="hub-composer-locked"><span class="material-symbols-rounded">lock</span>${ch.kind === 'announce' ? 'Only broadcasters post here.' : 'You do not have permission to post in this channel.'}</div>`}
    </div>`;
  }

  function msgHTML(cid, ch, m, prev) {
    const grouped = prev && prev.handle === m.handle && (m.ts - prev.ts) < 300000 && !m.kind && !prev.kind;
    const role = CMD.roleById(cid, m.role || 'member');
    if (m.kind === 'system') {
      return `<div class="hub-sys"><span class="material-symbols-rounded">waving_hand</span>${esc(m.text)}<i>${clock(m.ts)}</i></div>`;
    }
    const reacts = Object.keys(m.react || {}).map(e =>
      `<button class="hub-react${(m.react[e] || []).indexOf(CMD.me().handle) > -1 ? ' on' : ''}" onclick="HUB.react('${m.id}','${e}')">${e} ${m.react[e].length}</button>`).join('');

    const body = m.kind === 'poll' ? pollHTML(cid, m) : `<div class="hub-msg-t">${linkify(m.text)}${m.edited ? ' <i class="hub-edited">(edited)</i>' : ''}</div>`;

    return `
    <div class="hub-msg${grouped ? ' grouped' : ''}${m.pin ? ' pinned' : ''}" id="msg-${m.id}">
      ${grouped ? `<span class="hub-msg-time">${clock(m.ts)}</span>` : av(m.name, m.handle, 38)}
      <div class="hub-msg-b">
        ${grouped ? '' : `<div class="hub-msg-h">
          <b class="ink" style="color:${role.color}">${esc(m.name)}</b>
          ${m.bot ? '<i class="hub-bot">BOT</i>' : ''}
          <span class="hub-msg-role">${esc(role.name)}</span>
          <span class="hub-msg-ts">${clock(m.ts)}</span>
          ${m.pin ? '<span class="material-symbols-rounded hub-pinned">push_pin</span>' : ''}
        </div>`}
        ${body}
        ${m.attach ? attachHTML(m.attach) : ''}
        ${reacts ? `<div class="hub-reacts">${reacts}</div>` : ''}
        ${(m.thread && m.thread.length) ? `<button class="hub-thread-b" onclick="HUB.openThread('${m.id}')">
          <span class="material-symbols-rounded">forum</span>${m.thread.length} ${m.thread.length === 1 ? 'reply' : 'replies'}
          <span class="hub-thread-last">${esc(m.thread[m.thread.length - 1].name)}: ${esc(m.thread[m.thread.length - 1].text.slice(0, 40))}</span>
        </button>` : ''}
      </div>
      <div class="hub-msg-tools">
        <button onclick="HUB.react('${m.id}','🔥')" title="React 🔥">🔥</button>
        <button onclick="HUB.react('${m.id}','💜')" title="React 💜">💜</button>
        <button onclick="HUB.openThread('${m.id}')" title="Reply in thread"><span class="material-symbols-rounded">forum</span></button>
        ${window.CPX ? CPX.msgTools(cid, ch, m) : ''}
        ${CMD.can(cid, 'pin') ? `<button onclick="HUB.pin('${m.id}')" title="Pin"><span class="material-symbols-rounded">push_pin</span></button>` : ''}
        ${(m.me || CMD.can(cid, 'moderate')) ? `<button onclick="HUB.del('${m.id}')" title="Delete"><span class="material-symbols-rounded">delete</span></button>` : ''}
        ${(!m.me && CMD.can(cid, 'moderate')) ? `<button onclick="HUB.openModerate('${esc(m.handle)}')" title="Moderate"><span class="material-symbols-rounded">gavel</span></button>` : ''}
      </div>
    </div>`;
  }

  function attachHTML(a) {
    if (a.type === 'image') return `<img class="hub-att-img" src="${esc(a.src)}" alt="${esc(a.name)}">`;
    if (a.type === 'video') return `<video class="hub-att-img" src="${esc(a.src)}" controls playsinline></video>`;
    return `<a class="hub-att-f" href="${esc(a.src)}" target="_blank" rel="noopener"><span class="material-symbols-rounded">draft</span>${esc(a.name)}</a>`;
  }

  function pollHTML(cid, m) {
    const total = m.poll.opts.reduce((s, o) => s + o.votes.length, 0);
    const mine = CMD.me().handle;
    return `<div class="hub-poll">
      <b>${esc(m.poll.q)}</b>
      ${m.poll.opts.map((o, i) => {
        const pct = total ? Math.round((o.votes.length / total) * 100) : 0;
        const voted = o.votes.indexOf(mine) > -1;
        return `<button class="hub-poll-o${voted ? ' on' : ''}" onclick="HUB.vote('${m.id}',${i})">
          <i style="width:${pct}%"></i><span>${esc(o.t)}</span><b>${pct}%</b></button>`;
      }).join('')}
      <span class="hub-poll-n">${total} vote${total === 1 ? '' : 's'}</span>
    </div>`;
  }

  function threadHTML(cid, ch) {
    const m = CMD.messages(cid, ch.id).find(x => x.id === ui.thread);
    if (!m) return '';
    return `<aside class="hub-threadpane">
      <header><b>Thread</b><button class="hub-ico" onclick="HUB.closeThread()"><span class="material-symbols-rounded">close</span></button></header>
      <div class="hub-thread-src">${av(m.name, m.handle, 30)}<div><b>${esc(m.name)}</b><p>${linkify(m.text)}</p></div></div>
      <div class="hub-thread-l">
        ${(m.thread || []).map(t => `<div class="hub-thread-m">${av(t.name, t.handle, 26)}
          <div><b>${esc(t.name)}</b> <span>${ago(t.ts)}</span><p>${linkify(t.text)}</p></div></div>`).join('')}
      </div>
      <div class="hub-thread-in">
        <input id="hub-thread-in" placeholder="Reply to this thread">
        <button class="hub-ico send" onclick="HUB.sendThread()"><span class="material-symbols-rounded">send</span></button>
      </div>
    </aside>`;
  }

  /* ── Voice / Stage / Live ────────────────────────────────────────── */
  function roomHTML(cid, mode) {
    const d = D();
    let ch = CMD.channel(cid, d.chan);
    if (!ch || ['voice', 'stage', 'live'].indexOf(ch.kind) < 0) {
      ch = CMD.channels(cid).find(x => (mode === 'live' ? x.kind === 'live' : (x.kind === 'voice' || x.kind === 'stage')));
    }
    if (!ch) return '<div class="hub-none">No room in this community.</div>';

    const inRoom = room && room.cid === cid && room.chId === ch.id;
    const isStage = ch.kind === 'stage';
    const speakers = CMD.members(cid).filter(m => ['owner', 'admin', 'mod', 'creator'].indexOf(m.role) > -1).slice(0, isStage ? 4 : 6);
    const listeners = CMD.members(cid).filter(m => m.presence !== 'offline' && speakers.indexOf(m) < 0).slice(0, isStage ? 18 : 8);
    const canSpeak = CMD.can(cid, 'speak') && (!isStage || CMD.myLevel(cid) >= 40);

    const rooms = CMD.channels(cid).filter(x => ['voice', 'stage', 'live'].indexOf(x.kind) > -1);

    return `
    <div class="hub-room">
      <div class="hub-room-tabs">
        ${rooms.map(r => `<button class="hub-chip${r.id === ch.id ? ' on' : ''}" onclick="HUB.openChannel('${r.id}')">
          <span class="material-symbols-rounded">${chanIcon(r)}</span>${esc(r.name)}</button>`).join('')}
      </div>

      <div class="hub-room-stage${isStage ? ' stage' : ''}">
        ${inRoom ? `
          <div class="hub-tile you${room.cam || room.screen ? ' video' : ''}">
            <video id="hub-self" autoplay playsinline muted${room.cam ? '' : ' hidden'}></video>
            ${room.screen ? '' : (room.cam ? '' : `<div class="hub-tile-av">${av(CMD.me().name, CMD.me().handle, 66)}</div>`)}
            <div class="hub-meter" id="hub-meter"><i></i></div>
            <span class="hub-tile-n">${esc(CMD.me().name)} (you)${room.muted ? ' · muted' : ''}</span>
            ${room.screen ? '<span class="hub-tile-badge">Sharing screen</span>' : ''}
          </div>` : ''}
        ${speakers.map(m => `
          <div class="hub-tile">
            <div class="hub-tile-av">${av(m.name, m.handle, 66)}</div>
            <span class="hub-tile-n">${esc(m.name)}</span>
            <span class="hub-tile-role">${esc(CMD.roleById(cid, m.role).name)}</span>
          </div>`).join('')}
      </div>

      ${isStage ? `<div class="hub-audience">
        <div class="hub-aud-h">Audience — ${listeners.length}</div>
        <div class="hub-aud-l">${listeners.map(m => `<span class="hub-aud-m">${av(m.name, m.handle, 34)}<b>${esc(m.name.split(' ')[0])}</b></span>`).join('')}</div>
      </div>` : ''}

      <div class="hub-room-bar">
        ${inRoom ? `
          <button class="hub-rbtn${room.muted ? ' off' : ''}" onclick="HUB.toggleMic()">
            <span class="material-symbols-rounded">${room.muted ? 'mic_off' : 'mic'}</span>${room.muted ? 'Unmute' : 'Mute'}</button>
          <button class="hub-rbtn${room.cam ? ' on' : ''}" onclick="HUB.toggleCam()">
            <span class="material-symbols-rounded">${room.cam ? 'videocam' : 'videocam_off'}</span>Camera</button>
          <button class="hub-rbtn${room.screen ? ' on' : ''}" onclick="HUB.toggleScreen()">
            <span class="material-symbols-rounded">screen_share</span>${room.screen ? 'Stop share' : 'Share screen'}</button>
          <button class="hub-rbtn${room.deaf ? ' off' : ''}" onclick="HUB.toggleDeaf()">
            <span class="material-symbols-rounded">${room.deaf ? 'headset_off' : 'headset'}</span>${room.deaf ? 'Undeafen' : 'Deafen'}</button>
          <button class="hub-rbtn leave" onclick="HUB.leaveRoom(true)"><span class="material-symbols-rounded">call_end</span>Leave</button>
        ` : `
          <button class="hub-btn primary" onclick="HUB.joinRoom('${ch.id}')" ${canSpeak ? '' : 'disabled'}>
            <span class="material-symbols-rounded">${isStage ? 'podium' : 'headset_mic'}</span>
            ${isStage ? (canSpeak ? 'Take the stage' : 'Listen in') : 'Join ' + esc(ch.name)}</button>
          ${!canSpeak && isStage ? `<button class="hub-btn" onclick="HUB.raiseHand()"><span class="material-symbols-rounded">front_hand</span>Request to speak</button>` : ''}
        `}
      </div>

      <p class="hub-room-note">
        <span class="material-symbols-rounded">info</span>
        Your microphone, camera and screen share are real and stay on this device. The other people shown are this
        community's members — live peer-to-peer calling needs a signalling server, which this app doesn't run.
      </p>
    </div>`;
  }

  /* ── Discussion boards ───────────────────────────────────────────── */
  function boardsHTML(cid) {
    let list = CMD.boards(cid).slice();
    const sort = ui.sort;
    if (sort === 'top') list.sort((a, b) => b.votes - a.votes);
    else if (sort === 'active') list.sort((a, b) => (b.comments.length - a.comments.length) || b.ts - a.ts);
    else list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.ts - a.ts);
    if (ui.filter) {
      const q = ui.filter.toLowerCase();
      list = list.filter(p => (p.title + p.body + (p.tags || []).join(' ')).toLowerCase().indexOf(q) > -1);
    }
    const openPost = ui.boardOpen ? CMD.boards(cid).find(p => p.id === ui.boardOpen) : null;
    if (openPost) return boardPostHTML(cid, openPost);

    const tags = {};
    CMD.boards(cid).forEach(p => (p.tags || []).forEach(t => { tags[t] = (tags[t] || 0) + 1; }));

    return `
    <div class="hub-scroll">
      <div class="hub-board-top">
        <div class="hub-sorts">
          ${[['new', 'New'], ['top', 'Top'], ['active', 'Active']].map(([k, l]) =>
            `<button class="hub-chip${sort === k ? ' on' : ''}" onclick="HUB.setSort('${k}')">${l}</button>`).join('')}
        </div>
        <label class="hub-find sm"><span class="material-symbols-rounded">search</span>
          <input placeholder="Search discussions" value="${esc(ui.filter)}" oninput="HUB.boardFilter(this.value)"></label>
        <button class="hub-btn primary sm" onclick="HUB.openBoardForm()"><span class="material-symbols-rounded">add</span>New topic</button>
      </div>

      ${Object.keys(tags).length ? `<div class="hub-tagrow">${Object.keys(tags).map(t =>
        `<button class="hub-chip-s" onclick="HUB.boardFilter('${esc(t)}')">#${esc(t)} <i>${tags[t]}</i></button>`).join('')}</div>` : ''}

      ${list.map(p => `
        <article class="hub-bpost" onclick="HUB.openBoard('${p.id}')">
          <div class="hub-bvote" onclick="event.stopPropagation();HUB.voteBoard('${p.id}')">
            <span class="material-symbols-rounded${(p.voters || []).indexOf(CMD.me().handle) > -1 ? ' on' : ''}">keyboard_arrow_up</span>
            <b>${p.votes}</b>
          </div>
          <div class="hub-bpost-b">
            <h4>${p.pinned ? '<span class="material-symbols-rounded hub-pinned">push_pin</span>' : ''}${esc(p.title)}${p.solved ? '<span class="hub-solved">Solved</span>' : ''}</h4>
            <p>${esc(p.body.slice(0, 160))}</p>
            <div class="hub-bpost-f">
              ${av(p.author, p.handle, 22)}<b>${esc(p.author)}</b><span>${ago(p.ts)}</span>
              <span class="material-symbols-rounded">mode_comment</span>${p.comments.length}
              ${(p.tags || []).map(t => `<span class="hub-chip-s">#${esc(t)}</span>`).join('')}
            </div>
          </div>
        </article>`).join('') || '<div class="hub-none">No topics yet — start the first one.</div>'}
    </div>`;
  }

  function boardPostHTML(cid, p) {
    return `
    <div class="hub-scroll">
      <button class="hub-back" onclick="HUB.closeBoard()"><span class="material-symbols-rounded">arrow_back</span>All discussions</button>
      <article class="hub-bfull">
        <h2>${esc(p.title)}${p.solved ? '<span class="hub-solved">Solved</span>' : ''}</h2>
        <div class="hub-bfull-h">${av(p.author, p.handle, 30)}<b>${esc(p.author)}</b><span>${esc(p.handle)} · ${ago(p.ts)}</span>
          <span class="hub-bfull-a">
            <button class="hub-act" onclick="HUB.voteBoard('${p.id}')"><span class="material-symbols-rounded">keyboard_arrow_up</span>${p.votes}</button>
            ${(p.mine || CMD.can(cid, 'moderate')) ? `<button class="hub-act" onclick="HUB.solveBoard('${p.id}')"><span class="material-symbols-rounded">task_alt</span>${p.solved ? 'Reopen' : 'Mark solved'}</button>` : ''}
            ${window.CPX ? CPX.boardExtra(cid, p) : ''}
          </span>
        </div>
        <p class="hub-bfull-b">${linkify(p.body)}</p>
        <div class="hub-tagrow">${(p.tags || []).map(t => `<span class="hub-chip-s">#${esc(t)}</span>`).join('')}</div>
      </article>

      <h3 class="hub-h3"><span class="material-symbols-rounded">mode_comment</span>${p.comments.length} comments</h3>
      ${p.comments.map(c => `<div class="hub-bcomment">${av(c.name, c.handle, 30)}
        <div><b>${esc(c.name)}</b> <span>${ago(c.ts)}</span><p>${linkify(c.text)}</p></div></div>`).join('')}
      <div class="hub-bcomment-in">
        ${av(CMD.me().name, CMD.me().handle, 30)}
        <input id="hub-bcin" placeholder="Add a comment">
        <button class="hub-btn primary sm" onclick="HUB.comment('${p.id}')">Comment</button>
      </div>
    </div>`;
  }

  /* ── Events ──────────────────────────────────────────────────────── */
  function eventsHTML(cid) {
    const list = CMD.events(cid).slice().sort((a, b) => a.start - b.start);
    const upcoming = list.filter(e => e.start > Date.now() - 3600000);
    const past = list.filter(e => e.start <= Date.now() - 3600000);
    return `
    <div class="hub-scroll">
      <div class="hub-board-top">
        <h3 class="hub-h3"><span class="material-symbols-rounded">event</span>Community events</h3>
        ${CMD.can(cid, 'events') ? `<button class="hub-btn primary sm" onclick="HUB.openEventForm()"><span class="material-symbols-rounded">add</span>Schedule</button>` : ''}
      </div>
      ${upcoming.length ? upcoming.map(e => eventRow(cid, e)).join('') : '<div class="hub-none">Nothing scheduled yet.</div>'}
      ${past.length ? `<h3 class="hub-h3 muted"><span class="material-symbols-rounded">history</span>Past</h3>
        ${past.slice(0, 5).map(e => eventRow(cid, e)).join('')}` : ''}
    </div>`;
  }

  function eventRow(cid, e, compactRow) {
    const meH = CMD.me().handle;
    const going = e.going.indexOf(meH) > -1;
    const interested = e.interested.indexOf(meH) > -1;
    const soon = e.start - Date.now();
    const live = soon < 0 && soon > -e.mins * 60000;
    const ICON = { stage: 'podium', voice: 'volume_up', live: 'screen_share', irl: 'location_on' };
    return `<div class="hub-event${live ? ' live' : ''}">
      <div class="hub-event-d">
        <b>${new Date(e.start).toLocaleDateString(undefined, { day: 'numeric' })}</b>
        <span>${new Date(e.start).toLocaleDateString(undefined, { month: 'short' })}</span>
      </div>
      <div class="hub-event-b">
        <div class="hub-event-t">
          <span class="material-symbols-rounded">${ICON[e.kind] || 'event'}</span>
          <b>${esc(e.title)}</b>
          ${live ? '<span class="hub-livepill">LIVE NOW</span>' : ''}
        </div>
        <span class="hub-event-w">${when(e.start)} · ${e.mins}m · hosted by ${esc(e.host)}</span>
        ${compactRow ? '' : `<p>${esc(e.desc)}</p>`}
        <div class="hub-event-a">
          <button class="hub-btn sm${going ? ' primary' : ''}" onclick="HUB.rsvp('${e.id}','${going ? 'none' : 'going'}')">
            <span class="material-symbols-rounded">${going ? 'check' : 'notifications'}</span>${going ? 'Going' : 'Follow event'}</button>
          <button class="hub-btn sm${interested ? ' primary' : ''}" onclick="HUB.rsvp('${e.id}','${interested ? 'none' : 'interested'}')">Interested</button>
          ${live || going ? `<button class="hub-btn sm" onclick="HUB.openChannel('${e.channel}')">Open room</button>` : ''}
          ${window.CPX ? CPX.eventExtra(cid, e) : ''}
          ${(e.mine || CMD.can(cid, 'events')) ? `<button class="hub-act" onclick="HUB.removeEvent('${e.id}')"><span class="material-symbols-rounded">delete</span></button>` : ''}
          <span class="hub-event-n">${e.going.length} going · ${e.interested.length} interested</span>
        </div>
      </div>
    </div>`;
  }

  /* ── Members page ────────────────────────────────────────────────── */
  function membersPageHTML(cid) {
    const list = CMD.members(cid);
    const roles = CMD.roles(cid);
    return `
    <div class="hub-scroll">
      <div class="hub-board-top">
        <h3 class="hub-h3"><span class="material-symbols-rounded">group</span>Community network — ${compact(CMD.memberCount(cid))}</h3>
        <label class="hub-find sm"><span class="material-symbols-rounded">search</span>
          <input placeholder="Search members" oninput="HUB.filterDirectory(this.value)"></label>
      </div>
      <div class="hub-rolebar">
        ${roles.map(r => {
          const n = list.filter(m => m.role === r.id).length;
          return n ? `<span class="hub-chip-s ink" style="border-color:${r.color}55;color:${r.color}">${esc(r.name)} · ${n}</span>` : '';
        }).join('')}
      </div>
      <div class="hub-dir" id="hub-dir">
        ${list.map(m => `
          <div class="hub-dircard" data-name="${esc((m.name + ' ' + m.handle).toLowerCase())}">
            <span class="hub-m-av">${av(m.name, m.handle, 44)}<i class="hub-pres ${esc(m.presence)}"></i></span>
            <b>${esc(m.name)}${m.you ? ' (you)' : ''}</b>
            <span class="hub-dir-h">${esc(m.handle)}</span>
            <span class="hub-chip-s ink" style="color:${CMD.roleById(cid, m.role).color}">${esc(CMD.roleById(cid, m.role).name)}</span>
            <span class="hub-dir-rep">${compact(m.rep)} rep · joined ${ago(m.joined)} ago</span>
            <div class="hub-dir-a">
              ${m.you ? '' : `<button class="hub-btn sm" onclick="HUB.message('${esc(m.handle)}')">Message</button>`}
              ${(!m.you && CMD.can(cid, 'roles')) ? `<button class="hub-btn sm" onclick="HUB.openMember('${esc(m.handle)}')">Manage</button>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  const filterDirectory = q => {
    const term = String(q || '').toLowerCase();
    document.querySelectorAll('#hub-dir .hub-dircard').forEach(el => {
      el.style.display = !term || el.dataset.name.indexOf(term) > -1 ? '' : 'none';
    });
  };

  /* ── About ───────────────────────────────────────────────────────── */
  function aboutHTML(cid) {
    const c = CMD.byId(cid);
    const a = CMD.analytics(cid);
    const m = CMD.membership(cid);
    const tiersList = CMD.tiers(cid);
    const mine = CMD.myTier(cid);
    return `
    <div class="hub-scroll">
      <section class="hub-panel">
        <h3 class="hub-h3"><span class="material-symbols-rounded">info</span>About ${esc(c.name)}</h3>
        <p class="hub-guide">${esc(c.desc)}</p>
        ${window.CCR ? CCR.aboutExtra(c) : ''}
        <div class="hub-abgrid">
          <div><b>${compact(CMD.memberCount(cid))}</b><span>Members</span></div>
          <div><b>${compact(CMD.onlineCount(cid))}</b><span>Online</span></div>
          <div><b>${a.channels}</b><span>Channels</span></div>
          <div><b>${a.events}</b><span>Events</span></div>
          <div><b>${esc((CMD.CATEGORIES.find(x => x[0] === c.category) || ['', 'Other'])[1])}</b><span>Category</span></div>
          <div><b>${esc(CMD.ownerOf(c))}</b><span>Owner</span></div>
        </div>
        ${(c.tags || []).length ? `<div class="hub-tagrow">${c.tags.map(t => `<span class="hub-chip-s">${esc(t)}</span>`).join('')}</div>` : ''}
      </section>

      <section class="hub-panel">
        <h3 class="hub-h3"><span class="material-symbols-rounded">gavel</span>Community entry rules</h3>
        <ol class="hub-rules">
          ${window.CCR && CCR.rulesFor(c) ? CCR.rulesFor(c).map(r => `<li>${esc(r)}</li>`).join('') : `
          <li>Be useful and be civil — disagree with the argument, not the person.</li>
          <li>No spam, no referral dumps, no unsolicited DMs to members.</li>
          <li>Never post seed phrases, private keys or anything that asks for them.</li>
          <li>Keep channels on topic; long tangents belong in a thread or on the boards.</li>
          <li>Moderators act on reports. Ban evasion is a permanent removal.</li>`}
        </ol>
        <span class="hub-none sm">${m && m.rules ? '✓ You agreed to these when you joined.' : 'You have not agreed to these yet.'}</span>
      </section>

      <section class="hub-panel">
        <h3 class="hub-h3"><span class="material-symbols-rounded">card_membership</span>Community memberships</h3>
        ${window.CCR ? CCR.aboutTiersHTML(cid) : `<div class="hub-tiers">
          ${tiersList.map(t => `
            <div class="hub-tier${mine === t.id ? ' on' : ''}">
              <b>${esc(t.name)}</b>
              <span class="hub-tier-p">${t.price ? '$' + t.price.toFixed(2) + '/mo' : 'Free'}</span>
              <ul>${t.perks.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
              <button class="hub-btn sm${mine === t.id ? '' : ' primary'}" onclick="HUB.subscribe('${t.id}')" ${mine === t.id ? 'disabled' : ''}>
                ${mine === t.id ? 'Your tier' : t.price ? 'Choose' : 'Switch to free'}</button>
            </div>`).join('')}
        </div>`}
        <span class="hub-none sm">Memberships are simulated — nothing is charged and no payment details are collected.</span>
      </section>

      <section class="hub-panel">
        <h3 class="hub-h3"><span class="material-symbols-rounded">workspace_premium</span>Your standing here</h3>
        <div class="hub-abgrid">
          <div><b>${CMD.rep(cid)}</b><span>Reputation</span></div>
          <div><b>${esc(CMD.repTier(cid))}</b><span>Tier</span></div>
          <div><b>${esc(CMD.topRole(cid).name)}</b><span>Top role</span></div>
          <div><b>${a.mine}</b><span>Your messages</span></div>
        </div>
        <div class="hub-tagrow">${CMD.myRoles(cid).map(r => {
          const role = CMD.roleById(cid, r);
          return `<span class="hub-chip-s ink" style="border-color:${role.color}66;color:${role.color}">${esc(role.name)}</span>`;
        }).join('')}</div>
        <p class="hub-none sm">Reputation comes from posting, replying, answering and hosting. It unlocks roles and channels — it is not a token and cannot be traded.</p>
      </section>

      <section class="hub-panel">
        <h3 class="hub-h3"><span class="material-symbols-rounded">settings</span>Your settings</h3>
        <div class="hub-acts">
          <button class="hub-btn" onclick="HUB.openNotify()"><span class="material-symbols-rounded">notifications</span>Notifications</button>
          <button class="hub-btn" onclick="HUB.openInterests()"><span class="material-symbols-rounded">interests</span>Interests &amp; roles</button>
          <button class="hub-btn" onclick="HUB.openInvite()"><span class="material-symbols-rounded">person_add</span>Invite people</button>
          <button class="hub-btn danger" onclick="HUB.leave()"><span class="material-symbols-rounded">logout</span>Leave community</button>
        </div>
      </section>
    </div>`;
  }

  /* ══════════════════════════════════════════════════════════════════
     Wiring
     ══════════════════════════════════════════════════════════════════ */

  function wireCommunity() {
    const box = $('hub-msgs');
    if (box) box.scrollTop = box.scrollHeight;

    const input = $('hub-in');
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(140, input.scrollHeight) + 'px';
        mentionHint(input);
      });
      input.focus();
    }
    const file = $('hub-file');
    if (file) file.addEventListener('change', () => { if (file.files[0]) sendFile(file.files[0]); file.value = ''; });

    const t = $('hub-thread-in');
    if (t) t.addEventListener('keydown', e => { if (e.key === 'Enter') sendThread(); });

    const bc = $('hub-bcin');
    if (bc) bc.addEventListener('keydown', e => { if (e.key === 'Enter') comment(ui.boardOpen); });

    if (room && room.cam && $('hub-self')) $('hub-self').srcObject = room.stream;
    if (room) startMeter();
    if (window.CPX && CPX.wireCommunity) CPX.wireCommunity();
  }

  /* ── Chat actions ────────────────────────────────────────────────── */
  function send() {
    const d = D();
    const input = $('hub-in');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    // Slash commands
    if (text.indexOf('/poll ') === 0) {
      const parts = text.slice(6).split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length < 3) { toast('Try: /poll Question | option | option'); return; }
      CMD.poll(d.cid, d.chan, parts[0], parts.slice(1, 6));
      input.value = ''; repaintChat(); return;
    }
    if (text.indexOf('/event ') === 0) {
      const [title, whenStr] = text.slice(7).split('|').map(s => s.trim());
      const mins = /in (\d+)h/.test(whenStr || '') ? parseInt(RegExp.$1, 10) * 60 : /in (\d+)m/.test(whenStr || '') ? parseInt(RegExp.$1, 10) : 120;
      const ev = CMD.addEvent(d.cid, { title: title || 'Community event', start: Date.now() + mins * 60000, kind: 'voice', channel: 'lounge' });
      if (ev && ev.error) toast(ev.error);
      else { CMD.systemMsg(d.cid, d.chan, `${CMD.me().name} scheduled “${title}” for ${when(ev.start)}.`); toast('Event scheduled'); }
      input.value = ''; repaintChat(); return;
    }
    if (text.indexOf('/me ') === 0) {
      CMD.post(d.cid, d.chan, '*' + text.slice(4) + '*');
      input.value = ''; repaintChat(); return;
    }

    const res = CMD.post(d.cid, d.chan, text);
    if (res && res.error) { toast(res.error); if (res.automod) shakeComposer(); return; }
    input.value = '';
    input.style.height = 'auto';
    repaintChat();
  }

  async function sendFile(f) {
    const d = D();
    if (!CMD.can(d.cid, 'upload')) { toast('You cannot attach files in this community yet.'); return; }
    const isImg = f.type.startsWith('image/');
    const isVid = f.type.startsWith('video/');
    if (f.size > 25 * 1024 * 1024) { toast('That file is over 25 MB.'); return; }

    let src = URL.createObjectURL(f);
    let kept = false;
    if (isImg) {
      // Small images are downscaled and stored, so they survive a reload.
      const small = await shrink(f).catch(() => null);
      if (small && small.length < 420000) { src = small; kept = true; }
    }
    const res = CMD.post(d.cid, d.chan, f.name, { attach: { type: isImg ? 'image' : isVid ? 'video' : 'file', src, name: f.name, temp: !kept } });
    if (res && res.error) { toast(res.error); return; }
    if (!kept) toast('Attached for this session — large files are not kept after a reload.');
    repaintChat();
  }

  function shrink(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1080;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        try { res(c.toDataURL('image/jpeg', 0.72)); } catch (e) { rej(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
      img.src = url;
    });
  }

  function shakeComposer() {
    const el = document.querySelector('.hub-composer');
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }

  function repaintChat() {
    const d = D();
    const body = $('hub-body');
    if (!body) { paint(); return; }
    body.innerHTML = tabHTML(d.cid, d.tab);
    wireCommunity();
  }

  function mentionHint(input) {
    const box = $('hub-mention');
    if (!box) return;
    const m = /@([\w]*)$/.exec(input.value);
    if (!m) { box.hidden = true; return; }
    const q = m[1].toLowerCase();
    const d = D();
    const people = CMD.members(d.cid).filter(x => (x.name + x.handle).toLowerCase().indexOf(q) > -1).slice(0, 5);
    const roles = CMD.roles(d.cid).filter(r => r.name.toLowerCase().indexOf(q) > -1).slice(0, 3);
    if (!people.length && !roles.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = people.map(p => `<button onclick="HUB.pickMention('${esc(p.handle)}')">${av(p.name, p.handle, 22)}${esc(p.name)} <span>${esc(p.handle)}</span></button>`).join('')
      + roles.map(r => `<button onclick="HUB.pickMention('${esc(r.name.toLowerCase())}')"><span class="material-symbols-rounded">shield</span>@${esc(r.name)}</button>`).join('')
      + (CMD.can(d.cid, 'mention') ? `<button onclick="HUB.pickMention('everyone')"><span class="material-symbols-rounded">groups</span>@everyone</button>` : '');
  }

  function pickMention(handle) {
    const input = $('hub-in');
    if (!input) return;
    input.value = input.value.replace(/@[\w]*$/, (handle.charAt(0) === '@' ? handle : '@' + handle) + ' ');
    const box = $('hub-mention');
    if (box) box.hidden = true;
    input.focus();
  }

  const react = (mid, e) => { const d = D(); CMD.react(d.cid, d.chan, mid, e); repaintChat(); };
  const pin = mid => { const d = D(); const on = CMD.pin(d.cid, d.chan, mid); toast(on ? 'Pinned to highlights' : 'Unpinned'); repaintChat(); };
  const del = mid => { const d = D(); if (CMD.remove(d.cid, d.chan, mid)) repaintChat(); else toast('You cannot delete that.'); };
  const vote = (mid, i) => { const d = D(); CMD.votePoll(d.cid, d.chan, mid, i); repaintChat(); };
  const openThread = mid => { ui.thread = mid; repaintChat(); setTimeout(() => { const t = $('hub-thread-in'); if (t) t.focus(); }, 30); };
  const closeThread = () => { ui.thread = null; repaintChat(); };

  function sendThread() {
    const d = D();
    const input = $('hub-thread-in');
    if (!input || !input.value.trim()) return;
    const res = CMD.replyTo(d.cid, d.chan, ui.thread, input.value.trim());
    if (res && res.error) { toast(res.error); return; }
    input.value = '';
    repaintChat();
    setTimeout(() => { const t = $('hub-thread-in'); if (t) t.focus(); }, 30);
  }

  const attach = () => { const f = $('hub-file'); if (f) f.click(); };

  function openEmoji() {
    const list = ['🔥', '💜', '😂', '👀', '🚀', '💯', '🙌', '🤝', '🧠', '☕', '✅', '❌', '🎉', '📈', '📉', '🪙', '⚡', '👏'];
    modal('Community expressions', `
      <p class="hub-none">Reactions and emoji available in this community.</p>
      <div class="hub-emoji">${list.map(e => `<button onclick="HUB.putEmoji('${e}')">${e}</button>`).join('')}</div>`);
  }
  function putEmoji(e) {
    const input = $('hub-in');
    if (input) { input.value += e; input.focus(); }
    closeModal();
  }

  /* ── Rooms ───────────────────────────────────────────────────────── */
  async function joinRoom(chId) {
    const d = D();
    const ch = CMD.channel(d.cid, chId);
    if (!ch) return;
    if (!CMD.can(d.cid, 'speak')) { toast('You do not have permission to speak here.'); return; }
    leaveRoom();
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      toast('Microphone blocked — joining without audio.');
    }
    room = { cid: d.cid, chId, kind: ch.kind, stream, cam: false, screen: false, muted: false, deaf: false };
    CMD.setState({ chan: chId, tab: ch.kind === 'live' ? 'live' : 'voice' });
    paint();
    toast(`Connected to ${ch.name}`);
  }

  function leaveRoom(announce) {
    if (!room) return;
    [room.stream, room.camStream, room.screenStream].forEach(s => {
      if (s) s.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    });
    if (room.ctx) { try { room.ctx.close(); } catch (e) {} }
    cancelAnimationFrame(room.raf || 0);
    room = null;
    if (announce) { paint(); toast('Left the room'); }
  }

  function toggleMic() {
    if (!room || !room.stream) return;
    room.muted = !room.muted;
    room.stream.getAudioTracks().forEach(t => { t.enabled = !room.muted; });
    paint();
  }
  function toggleDeaf() {
    if (!room) return;
    room.deaf = !room.deaf;
    if (room.deaf && !room.muted) toggleMic(); else paint();
  }

  async function toggleCam() {
    if (!room) return;
    if (room.cam) {
      if (room.camStream) room.camStream.getTracks().forEach(t => t.stop());
      room.camStream = null; room.cam = false; paint(); return;
    }
    try {
      room.camStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 } } });
      room.cam = true;
      paint();
      const v = $('hub-self');
      if (v) { v.srcObject = room.camStream; v.play().catch(() => {}); }
    } catch (e) { toast('Camera blocked.'); }
  }

  async function toggleScreen() {
    if (!room) return;
    if (room.screen) {
      if (room.screenStream) room.screenStream.getTracks().forEach(t => t.stop());
      room.screenStream = null; room.screen = false; paint(); return;
    }
    if (!navigator.mediaDevices.getDisplayMedia) { toast('Screen sharing is not available in this browser.'); return; }
    try {
      room.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      room.screen = true;
      room.screenStream.getVideoTracks()[0].addEventListener('ended', () => { room.screen = false; room.screenStream = null; paint(); });
      paint();
      const v = $('hub-self');
      if (v) { v.hidden = false; v.srcObject = room.screenStream; v.play().catch(() => {}); }
    } catch (e) { /* the user dismissed the picker */ }
  }

  /* A real level meter from the real microphone, so "you are live" is
     something the UI can actually show rather than assert. */
  function startMeter() {
    if (!room || !room.stream || room.ctx) return;
    const bar = document.querySelector('#hub-meter i');
    if (!bar) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(room.stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      room.ctx = ctx;
      const tick = () => {
        if (!room || !room.ctx) return;
        an.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        const level = room.muted ? 0 : Math.min(100, (sum / buf.length) * 2.4);
        const el = document.querySelector('#hub-meter i');
        if (el) el.style.width = level + '%';
        room.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) { /* no analyser, no meter */ }
  }

  function raiseHand() {
    toast('Hand raised — a moderator has to approve you before you can speak on stage.');
  }

  /* ── Boards / events / feed actions ──────────────────────────────── */
  const setSort = s => { ui.sort = s; repaintChat(); };
  const boardFilter = v => { ui.filter = v; repaintChat(); };
  const openBoard = id => { ui.boardOpen = id; repaintChat(); };
  const closeBoard = () => { ui.boardOpen = null; repaintChat(); };
  const voteBoard = id => { CMD.voteBoard(D().cid, id); repaintChat(); };
  const solveBoard = id => { CMD.solveBoard(D().cid, id); repaintChat(); };

  function comment(id) {
    const input = $('hub-bcin');
    if (!input || !input.value.trim()) return;
    const res = CMD.commentBoard(D().cid, id, input.value);
    if (res && res.error) { toast(res.error); return; }
    input.value = '';
    repaintChat();
  }

  function postFeed() {
    const el = $('hub-fpost');
    if (!el || !el.value.trim()) return;
    const share = $('hub-fshare');
    const res = CMD.addFeed(D().cid, el.value, { toTrending: share && share.checked });
    if (res && res.error) { toast(res.error); return; }
    el.value = '';
    toast(share && share.checked ? 'Posted — and published to the Trending feed' : 'Posted to the community');
    repaintChat();
  }
  const likeFeed = id => { CMD.likeFeed(D().cid, id); repaintChat(); };
  function pushToTrending(id) {
    const p = CMD.feed(D().cid).find(x => x.id === id);
    if (!p) return;
    CMD.shareToTrending(D().cid, p.text);
    toast('Published to the Trending feed');
  }

  const rsvp = (id, how) => { CMD.rsvp(D().cid, id, how); repaintChat(); };
  const removeEvent = id => { CMD.removeEvent(D().cid, id); repaintChat(); };

  /* ── Navigation ──────────────────────────────────────────────────── */
  function setTab(t) {
    if (t !== 'voice' && t !== 'live' && room) { /* stay connected while you browse */ }
    ui.boardOpen = null; ui.thread = null; ui.filter = '';
    ui.sidebar = false;
    go({ tab: t });
  }

  function openChannel(chId) {
    const d = D();
    const ch = CMD.channel(d.cid, chId);
    if (!ch) return;
    ui.thread = null; ui.boardOpen = null; ui.sidebar = false;
    const tab = ch.kind === 'forum' ? 'boards' : ch.kind === 'live' ? 'live'
      : (ch.kind === 'voice' || ch.kind === 'stage') ? 'voice' : 'chat';
    go({ chan: chId, tab });
  }

  const toggleMembers = () => { ui.members = !ui.members; paint(); };
  const toggleSide = force => { ui.sidebar = typeof force === 'boolean' ? force : !ui.sidebar; paint(); };
  const openStudio = () => { ui.sidebar = false; go({ screen: 'studio' }); };

  // Escape closes the phone menu, unless a dialog on top of it is open.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !ui.sidebar) return;
    if (!document.querySelector('#pane-community .hub-app.side-open')) return;
    if ($('hub-modal') || document.querySelector('.mob-dialog-scrim')) return;
    e.preventDefault();
    toggleSide(false);
  });

  async function leave() {
    const d = D();
    const c = CMD.byId(d.cid);
    if (!(await appConfirm(`Leave ${c.name}?`, { ok: 'Leave', danger: true }))) return;
    leaveRoom();
    CMD.leave(d.cid);
    go({ screen: 'hub' });
    toast(`Left ${c.name}`);
  }

  function message(handle) {
    toast(`Opening a private message with ${handle}`);
    if (typeof navigateTo === 'function') navigateTo('messages');
  }

  /* ══════════════════════════════════════════════════════════════════
     Modals
     ══════════════════════════════════════════════════════════════════ */

  function modal(title, body, wide) {
    closeModal();
    const el = document.createElement('div');
    el.id = 'hub-modal';
    el.className = 'hub-scrim';
    el.innerHTML = `<div class="hub-dialog${wide ? ' wide' : ''}">
      <header><b>${esc(title)}</b><button class="hub-ico" onclick="HUB.closeModal()"><span class="material-symbols-rounded">close</span></button></header>
      <div class="hub-dialog-b">${body}</div>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) closeModal(); });
    const first = el.querySelector('input,textarea,select');
    if (first) setTimeout(() => first.focus(), 40);
  }
  function closeModal() { const m = $('hub-modal'); if (m) m.remove(); }

  /* Join flow: rules, then interests, then the channels that match. */
  function openJoin(cid) {
    if (window.CCR && CCR.openJoin(cid)) return;
    const c = CMD.byId(cid);
    if (!c) return;
    modal(`Join ${c.name}`, `
      <div class="hub-join">
        <div class="hub-join-head" style="--c:${c.color}">
          <span class="hub-card-icon" style="--c:${c.color}"><span class="material-symbols-rounded">${esc(c.icon)}</span></span>
          <div><b>${esc(c.name)}</b><span>${compact(CMD.memberCount(cid))} members · ${compact(CMD.onlineCount(cid))} online</span></div>
        </div>
        <p class="hub-guide">${esc(c.desc)}</p>

        <h4 class="hub-h4">1 · Community entry rules</h4>
        <ol class="hub-rules sm">
          <li>Be useful and be civil.</li>
          <li>No spam, scams or referral dumps.</li>
          <li>Never share or ask for seed phrases or keys.</li>
          <li>Keep channels on topic.</li>
        </ol>
        <label class="hub-check"><input type="checkbox" id="hub-join-rules"> I agree to these rules</label>

        <h4 class="hub-h4">2 · What are you here for?</h4>
        <div class="hub-chips" id="hub-join-int">
          ${[['lurk', 'Reading and learning'], ['chat', 'Chatting daily'], ['build', 'Building and contributing'],
             ['teach', 'Helping and answering'], ['events', 'Events and calls'], ['news', 'News only']]
            .map(([k, l]) => `<button class="hub-chip" data-k="${k}" onclick="this.classList.toggle('on')">${l}</button>`).join('')}
        </div>
        <p class="hub-none sm">Your picks decide which channels are suggested and which self-assignable roles you get.</p>

        <button class="hub-btn primary wide" onclick="HUB.doJoin('${cid}')">Join community</button>
      </div>`);
  }

  function doJoin(cid) {
    const rules = $('hub-join-rules');
    if (!rules || !rules.checked) { toast('Agree to the rules first.'); return; }
    const interests = Array.from(document.querySelectorAll('#hub-join-int .hub-chip.on')).map(b => b.dataset.k);
    CMD.join(cid, { rules: true, interests });
    CMD.setInterests(cid, interests);
    closeModal();
    open(cid);
    toast(`Welcome to ${CMD.byId(cid).name}`);
  }

  function openInterests() {
    const cid = D().cid;
    const m = CMD.membership(cid) || { interests: [] };
    modal('Interests and roles', `
      <p class="hub-none">Pick what you are here for. Some choices grant a self-assignable role.</p>
      <div class="hub-chips" id="hub-int">
        ${[['lurk', 'Reading and learning'], ['chat', 'Chatting daily'], ['build', 'Building and contributing → Contributor'],
           ['teach', 'Helping and answering → Expert'], ['events', 'Events and calls'], ['news', 'News only']]
          .map(([k, l]) => `<button class="hub-chip${(m.interests || []).indexOf(k) > -1 ? ' on' : ''}" data-k="${k}" onclick="this.classList.toggle('on')">${esc(l)}</button>`).join('')}
      </div>
      <button class="hub-btn primary wide" onclick="HUB.saveInterests()">Save</button>`);
  }
  function saveInterests() {
    const list = Array.from(document.querySelectorAll('#hub-int .hub-chip.on')).map(b => b.dataset.k);
    CMD.setInterests(D().cid, list);
    closeModal(); paint();
    toast('Updated');
  }

  function openNotify() {
    const cid = D().cid;
    const m = CMD.membership(cid) || { notify: 'important' };
    modal('Community notifications', `
      <div class="hub-radios">
        ${[['all', 'All messages', 'Everything in every channel you can see.'],
           ['important', 'Important only', 'Announcements, replies and events.'],
           ['mentions', 'Mentions only', 'Only when someone mentions you or a role you hold.'],
           ['events', 'Events only', 'Just the schedule.'],
           ['none', 'Muted', 'Nothing at all.']]
          .map(([k, l, d]) => `<button class="hub-radio${m.notify === k ? ' on' : ''}" onclick="HUB.setNotify('${k}')">
            <span class="material-symbols-rounded">${m.notify === k ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
            <b>${l}</b><span>${d}</span></button>`).join('')}
      </div>`);
  }
  function setNotify(k) { CMD.setNotify(D().cid, k); closeModal(); toast('Notification setting saved'); }

  function openPresence() {
    modal('Your presence', `
      <div class="hub-radios">
        ${[['online', 'Online', 'Available'], ['idle', 'Idle', 'Away from the keyboard'],
           ['dnd', 'Do not disturb', 'No notifications'], ['invisible', 'Invisible', 'Appear offline']]
          .map(([k, l, d]) => `<button class="hub-radio${D().presence === k ? ' on' : ''}" onclick="HUB.setPresence('${k}')">
            <span class="hub-pres ${k}"></span><b>${l}</b><span>${d}</span></button>`).join('')}
      </div>`);
  }
  function setPresence(p) { CMD.setState({ presence: p }); closeModal(); paint(); }

  function openInvite() {
    const cid = D().cid;
    const list = CMD.invites(cid);
    modal('Community invite links', `
      <p class="hub-none">Share a link. You choose how long it lasts and how many people can use it.</p>
      <div class="hub-form-row">
        <label>Expires<select id="hub-inv-days"><option value="0">Never</option><option value="1">1 day</option><option value="7" selected>7 days</option><option value="30">30 days</option></select></label>
        <label>Max uses<select id="hub-inv-max"><option value="0">Unlimited</option><option value="1">1</option><option value="10" selected>10</option><option value="100">100</option></select></label>
        <button class="hub-btn primary" onclick="HUB.makeInvite()">Create invite</button>
      </div>
      <div id="hub-inv-list">${list.map(i => `
        <div class="hub-inv">
          <code>${esc(CMD.inviteLink(cid, i.code))}</code>
          <span>${i.uses}${i.max ? '/' + i.max : ''} uses · ${i.exp ? 'expires ' + new Date(i.exp).toLocaleDateString() : 'never expires'}</span>
          <button class="hub-btn sm" onclick="HUB.copyInvite('${i.code}')">Copy</button>
          <button class="hub-act" onclick="HUB.revokeInvite('${i.code}')"><span class="material-symbols-rounded">delete</span></button>
        </div>`).join('') || '<p class="hub-none sm">No invites yet.</p>'}</div>`, true);
  }
  function makeInvite() {
    const cid = D().cid;
    const days = Number(($('hub-inv-days') || {}).value || 0);
    const max = Number(($('hub-inv-max') || {}).value || 0);
    const inv = CMD.makeInvite(cid, { days, max });
    if (inv && inv.error) { toast(inv.error); return; }
    openInvite();
    toast('Invite created');
  }
  async function copyInvite(code) {
    const link = CMD.inviteLink(D().cid, code);
    try { await navigator.clipboard.writeText(link); toast('Invite link copied'); }
    catch (e) { toast(link); }
  }
  function revokeInvite(code) { CMD.revokeInvite(D().cid, code); openInvite(); }

  function openBoardForm() {
    modal('New discussion topic', `
      <label class="hub-f"><span>Title</span><input id="hub-bt" placeholder="What is this about?"></label>
      <label class="hub-f"><span>Body</span><textarea id="hub-bb" rows="6" placeholder="Say the useful part first."></textarea></label>
      <label class="hub-f"><span>Tags</span><input id="hub-btag" placeholder="comma, separated"></label>
      <button class="hub-btn primary wide" onclick="HUB.submitBoard()">Post topic</button>`);
  }
  function submitBoard() {
    const t = ($('hub-bt') || {}).value || '';
    const b = ($('hub-bb') || {}).value || '';
    if (!t.trim()) { toast('Give it a title.'); return; }
    const tags = (($('hub-btag') || {}).value || '').split(',').map(s => s.trim()).filter(Boolean);
    const res = CMD.addBoard(D().cid, t.trim(), b.trim(), tags);
    if (res && res.error) { toast(res.error); return; }
    closeModal();
    ui.boardOpen = res.id;
    go({ tab: 'boards' });
    toast('Topic posted');
  }

  function openEventForm() {
    const cid = D().cid;
    const rooms = CMD.channels(cid).filter(c => ['voice', 'stage', 'live'].indexOf(c.kind) > -1);
    const soon = new Date(Date.now() + 3600000 * 24);
    const iso = new Date(soon.getTime() - soon.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    modal('Schedule an event', `
      <label class="hub-f"><span>Title</span><input id="hub-ev-t" placeholder="Community town hall"></label>
      <label class="hub-f"><span>Description</span><textarea id="hub-ev-d" rows="3" placeholder="What happens and who it is for."></textarea></label>
      <div class="hub-form-row">
        <label class="hub-f"><span>Starts</span><input type="datetime-local" id="hub-ev-s" value="${iso}"></label>
        <label class="hub-f"><span>Minutes</span><input type="number" id="hub-ev-m" value="60" min="10" max="480"></label>
      </div>
      <div class="hub-form-row">
        <label class="hub-f"><span>Kind</span><select id="hub-ev-k">
          <option value="voice">Voice room</option><option value="stage">Stage</option>
          <option value="live">Community Live</option><option value="irl">In person</option></select></label>
        <label class="hub-f"><span>Room</span><select id="hub-ev-c">
          ${rooms.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></label>
      </div>
      <button class="hub-btn primary wide" onclick="HUB.submitEvent()">Schedule</button>`);
  }
  function submitEvent() {
    const title = ($('hub-ev-t') || {}).value || '';
    if (!title.trim()) { toast('Give the event a title.'); return; }
    const start = new Date(($('hub-ev-s') || {}).value || Date.now()).getTime();
    const res = CMD.addEvent(D().cid, {
      title: title.trim(), desc: ($('hub-ev-d') || {}).value || '',
      start, mins: Number(($('hub-ev-m') || {}).value || 60),
      kind: ($('hub-ev-k') || {}).value, channel: ($('hub-ev-c') || {}).value
    });
    if (res && res.error) { toast(res.error); return; }
    closeModal();
    go({ tab: 'events' });
    toast('Event scheduled');
  }

  function openChannelForm(space) {
    const cid = D().cid;
    modal('Add a channel', `
      <label class="hub-f"><span>Name</span><input id="hub-ch-n" placeholder="new-channel"></label>
      <label class="hub-f"><span>Topic</span><input id="hub-ch-t" placeholder="What belongs in here"></label>
      <div class="hub-form-row">
        <label class="hub-f"><span>Type</span><select id="hub-ch-k">
          <option value="text">Text</option><option value="announce">Announcements</option>
          <option value="voice">Voice room</option><option value="stage">Stage</option>
          <option value="live">Community Live</option><option value="forum">Discussion board</option></select></label>
        <label class="hub-f"><span>Space</span><input id="hub-ch-s" value="${esc(space || 'Community')}"></label>
      </div>
      <label class="hub-check"><input type="checkbox" id="hub-ch-p"> Exclusive space — needs a role</label>
      <label class="hub-f"><span>Required role</span><select id="hub-ch-r">
        ${CMD.roles(cid).map(r => `<option value="${r.id}"${r.id === 'contributor' ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
      <label class="hub-f"><span>Slow mode (seconds, 0 for off)</span><input type="number" id="hub-ch-sl" value="0" min="0" max="600"></label>
      <button class="hub-btn primary wide" onclick="HUB.submitChannel()">Create channel</button>`);
  }
  function submitChannel() {
    const cid = D().cid;
    const name = (($('hub-ch-n') || {}).value || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!name) { toast('Name the channel.'); return; }
    const list = CMD.channels(cid).slice();
    list.push({
      id: 'c' + Date.now().toString(36), name, kind: ($('hub-ch-k') || {}).value || 'text',
      space: (($('hub-ch-s') || {}).value || 'Community').trim(),
      topic: ($('hub-ch-t') || {}).value || '',
      private: !!($('hub-ch-p') || {}).checked, role: ($('hub-ch-r') || {}).value,
      slow: Number(($('hub-ch-sl') || {}).value || 0)
    });
    CMD.saveChannels(cid, list);
    closeModal();
    paint();
    toast('Channel created');
  }

  function openCreate() {
    if (window.CCR) { CCR.openCreate(); return; }
    modal('Create a community', `
      <label class="hub-f"><span>Name</span><input id="hub-c-n" placeholder="What is it called?"></label>
      <label class="hub-f"><span>What is it for?</span><textarea id="hub-c-d" rows="3" placeholder="One line that tells people whether they belong here."></textarea></label>
      <div class="hub-form-row">
        <label class="hub-f"><span>Category</span><select id="hub-c-c">
          ${CMD.CATEGORIES.filter(c => c[0] !== 'all').map(c => `<option value="${c[0]}">${c[1]}</option>`).join('')}</select></label>
        <label class="hub-f"><span>Privacy</span><select id="hub-c-p">
          <option value="public">Public — anyone can find and join</option>
          <option value="invite">Invite only</option>
          <option value="private">Private — hidden</option></select></label>
      </div>
      <div class="hub-form-row">
        <label class="hub-f"><span>Icon</span><select id="hub-c-i">
          ${['groups', 'rocket_launch', 'sports_esports', 'music_note', 'code', 'palette', 'science', 'sports_soccer', 'currency_bitcoin', 'school']
            .map(i => `<option value="${i}">${i.replace(/_/g, ' ')}</option>`).join('')}</select></label>
        <label class="hub-f"><span>Colour</span><input type="color" id="hub-c-col" value="#7C5CFF"></label>
      </div>
      <label class="hub-f"><span>Tags</span><input id="hub-c-t" placeholder="comma, separated"></label>
      <p class="hub-none sm">You become the owner, with every channel, role and Studio tool unlocked.</p>
      <button class="hub-btn primary wide" onclick="HUB.submitCreate()">Create community</button>`);
  }
  function submitCreate() {
    const name = (($('hub-c-n') || {}).value || '').trim();
    if (!name) { toast('Name it first.'); return; }
    const c = CMD.create({
      name, desc: ($('hub-c-d') || {}).value || '', category: ($('hub-c-c') || {}).value,
      privacy: ($('hub-c-p') || {}).value, icon: ($('hub-c-i') || {}).value,
      color: ($('hub-c-col') || {}).value, tags: ($('hub-c-t') || {}).value || ''
    });
    closeModal();
    open(c.id);
    toast(`${c.name} is live — invite the first members`);
  }

  function openCommunityMenu() {
    const cid = D().cid;
    const c = CMD.byId(cid);
    modal(c.name, `
      <div class="hub-menu">
        <button onclick="HUB.openInvite()"><span class="material-symbols-rounded">person_add</span>Invite people</button>
        <button onclick="HUB.openNotify()"><span class="material-symbols-rounded">notifications</span>Notification settings</button>
        <button onclick="HUB.openInterests()"><span class="material-symbols-rounded">interests</span>Interests and roles</button>
        <button onclick="HUB.doBoost()"><span class="material-symbols-rounded">bolt</span>Support this community</button>
        <button onclick="HUB.setTab('about');HUB.closeModal()"><span class="material-symbols-rounded">info</span>About and memberships</button>
        ${window.CCR ? `<button onclick="CCR.openManage('${cid}')"><span class="material-symbols-rounded">workspace_premium</span>Your membership</button>` : ''}
        ${CMD.can(cid, 'analytics') ? `<button onclick="HUB.openStudio();HUB.closeModal()"><span class="material-symbols-rounded">tune</span>Community Studio</button>` : ''}
        <button class="danger" onclick="HUB.leave()"><span class="material-symbols-rounded">logout</span>Leave community</button>
      </div>`);
  }

  function openPins() {
    const d = D();
    const list = CMD.pins(d.cid, d.chan);
    modal('Community highlights', list.length
      ? list.map(m => `<div class="hub-hl-row">${av(m.name, m.handle, 30)}
          <div><b>${esc(m.name)}</b> <span>${ago(m.ts)}</span><p>${linkify(m.text)}</p></div>
          <button class="hub-act" onclick="HUB.pin('${m.id}');HUB.openPins()"><span class="material-symbols-rounded">push_pin</span></button>
        </div>`).join('')
      : '<p class="hub-none">Nothing pinned in this channel yet. Hover a message and pin it.</p>', true);
  }

  function openSearch() {
    modal('Search this community', `
      <label class="hub-find"><span class="material-symbols-rounded">search</span>
        <input id="hub-sq" placeholder="People, messages, topics, events, channels" oninput="HUB.runSearch(this.value)"></label>
      <div id="hub-sr" class="hub-sr"><p class="hub-none">Type to search everything in this community.</p></div>`, true);
  }

  function runSearch(q) {
    const box = $('hub-sr');
    if (!box) return;
    const cid = D().cid;
    const r = CMD.search(cid, q);
    const total = r.msgs.length + r.people.length + r.boards.length + r.events.length + r.channels.length;
    if (!q.trim()) { box.innerHTML = '<p class="hub-none">Type to search everything in this community.</p>'; return; }
    if (!total) { box.innerHTML = '<p class="hub-none">Nothing matched.</p>'; return; }
    box.innerHTML = `
      ${r.channels.length ? `<h4 class="hub-h4">Channels</h4>${r.channels.map(c =>
        `<button class="hub-sr-row" onclick="HUB.openChannel('${c.id}');HUB.closeModal()">
          <span class="material-symbols-rounded">${chanIcon(c)}</span><b>${esc(c.name)}</b><span>${esc(c.topic || '')}</span></button>`).join('')}` : ''}
      ${r.people.length ? `<h4 class="hub-h4">People</h4>${r.people.map(m =>
        `<button class="hub-sr-row" onclick="HUB.openMember('${esc(m.handle)}')">${av(m.name, m.handle, 26)}<b>${esc(m.name)}</b><span>${esc(m.handle)}</span></button>`).join('')}` : ''}
      ${r.msgs.length ? `<h4 class="hub-h4">Messages</h4>${r.msgs.map(m =>
        `<button class="hub-sr-row" onclick="HUB.openChannel('${m.chan.id}');HUB.closeModal()">
          ${av(m.name, m.handle, 26)}<b>${esc(m.name)}</b><span>#${esc(m.chan.name)} · ${esc(m.text.slice(0, 70))}</span></button>`).join('')}` : ''}
      ${r.boards.length ? `<h4 class="hub-h4">Discussions</h4>${r.boards.map(p =>
        `<button class="hub-sr-row" onclick="HUB.openBoard('${p.id}');HUB.setTab('boards');HUB.closeModal()">
          <span class="material-symbols-rounded">topic</span><b>${esc(p.title)}</b><span>${p.comments.length} comments</span></button>`).join('')}` : ''}
      ${r.events.length ? `<h4 class="hub-h4">Events</h4>${r.events.map(e =>
        `<button class="hub-sr-row" onclick="HUB.setTab('events');HUB.closeModal()">
          <span class="material-symbols-rounded">event</span><b>${esc(e.title)}</b><span>${when(e.start)}</span></button>`).join('')}` : ''}`;
  }

  function openMember(handle) {
    const cid = D().cid;
    const m = CMD.members(cid).find(x => x.handle === handle);
    if (!m) return;
    const role = CMD.roleById(cid, m.role);
    const canManage = CMD.can(cid, 'roles') && !m.you && role.level < CMD.myLevel(cid);
    const canMod = CMD.can(cid, 'moderate') && !m.you && role.level < CMD.myLevel(cid);
    modal(m.name, `
      <div class="hub-profile">
        ${av(m.name, m.handle, 64)}
        <div>
          <b>${esc(m.name)}</b>
          <span>${esc(m.handle)} · ${esc(role.name)}</span>
          <span>${compact(m.rep)} reputation · member for ${ago(m.joined)}</span>
          <span class="hub-pres-row"><i class="hub-pres ${esc(m.presence)}"></i>${esc(m.presence)}${m.activity ? ' · ' + esc(m.activity) : ''}</span>
        </div>
      </div>
      <div class="hub-acts">
        ${m.you ? '' : `<button class="hub-btn" onclick="HUB.message('${esc(m.handle)}')"><span class="material-symbols-rounded">chat</span>Message</button>`}
        ${m.you ? '' : `<button class="hub-btn" onclick="HUB.tipMember('${esc(m.name)}','${esc(m.handle)}')"><span class="material-symbols-rounded">toll</span>Tip</button>`}
        ${window.CPX ? CPX.memberExtra(cid, m) : ''}
      </div>
      ${canManage ? `
        <h4 class="hub-h4">Role</h4>
        <div class="hub-chips">${CMD.roles(cid).filter(r => r.level < CMD.myLevel(cid)).map(r =>
          `<button class="hub-chip${m.role === r.id ? ' on' : ''}" onclick="HUB.setRole('${esc(m.handle)}','${r.id}')">${esc(r.name)}</button>`).join('')}</div>` : ''}
      ${canMod ? `
        <h4 class="hub-h4">Moderation</h4>
        <div class="hub-acts">
          <button class="hub-btn sm" onclick="HUB.timeout('${esc(m.handle)}',10)">Timeout 10m</button>
          <button class="hub-btn sm" onclick="HUB.timeout('${esc(m.handle)}',1440)">Timeout 24h</button>
          <button class="hub-btn sm danger" onclick="HUB.ban('${esc(m.handle)}')">Remove and ban</button>
        </div>` : ''}
      ${(!canManage && !canMod && !m.you) ? '<p class="hub-none sm">You can act on members below your own role only.</p>' : ''}`);
  }

  function openModerate(handle) { openMember(handle); }
  function setRole(handle, rid) {
    if (!CMD.setMemberRole(D().cid, handle, rid)) { toast('That member is at or above your role.'); return; }
    closeModal(); paint(); toast('Role updated');
  }
  function timeout(handle, mins) {
    if (CMD.timeout(D().cid, handle, mins)) { closeModal(); toast(`${handle} timed out for ${mins >= 60 ? mins / 60 + 'h' : mins + 'm'}`); }
  }
  async function ban(handle) {
    if (!(await appConfirm(`Remove and ban ${handle}?`, { ok: 'Remove and ban', danger: true }))) return;
    if (CMD.ban(D().cid, handle, 'Removed by moderator')) { closeModal(); paint(); toast(`${handle} was removed`); }
  }
  function tipMember(name, handle) {
    closeModal();
    if (typeof openTipModal === 'function') openTipModal(name, handle);
    else toast('Tipping is unavailable right now.');
  }

  function subscribe(tid) {
    const cid = D().cid;
    if (window.CCR) { CCR.chooseTier(cid, tid); return; }
    const t = CMD.subscribe(cid, tid);
    if (t && t.error) { toast(t.error); return; }
    paint();
    toast(t.price ? `${t.name} membership active — simulated, nothing was charged.` : 'Switched to the free tier.');
  }

  function doBoost() {
    const cid = D().cid;
    const n = CMD.boost(cid);
    paint();
    toast(`Community support sent — ${n} total. Level ${CMD.boostTier(cid)} perks unlocked.`);
  }

  /* ── Deep links: #commune=<id>&i=<code> ──────────────────────────── */
  function handleHash() {
    const m = /#commune=([a-z0-9_]+)(?:&i=([a-z0-9]+))?/i.exec(location.hash || '');
    if (!m) return false;
    const cid = m[1], code = m[2];
    const c = CMD.byId(cid);
    if (!c) return false;
    if (typeof navigateTo === 'function') navigateTo('community');
    setTimeout(() => {
      if (code) { CMD.useInvite(cid, code); if (window.CMB) CMB.markInvited(cid); }
      if (CMD.isJoined(cid)) open(cid); else openJoin(cid);
    }, 200);
    return true;
  }

  return {
    paint, open, backToHub, hubTab, setCat, setTab, openChannel, toggleMembers, toggleSide,
    send, sendThread, react, pin, del, vote, openThread, closeThread, attach, openEmoji, putEmoji, pickMention,
    joinRoom, leaveRoom, toggleMic, toggleCam, toggleScreen, toggleDeaf, raiseHand,
    setSort, boardFilter, openBoard, closeBoard, voteBoard, solveBoard, comment, openBoardForm, submitBoard,
    postFeed, likeFeed, pushToTrending,
    rsvp, removeEvent, openEventForm, submitEvent,
    openJoin, doJoin, openInterests, saveInterests, openNotify, setNotify, openPresence, setPresence,
    openInvite, makeInvite, copyInvite, revokeInvite, openCreate, submitCreate, openChannelForm, submitChannel,
    openCommunityMenu, openPins, openSearch, runSearch, openMember, openModerate, setRole, timeout, ban, tipMember,
    filterMembers, filterDirectory, message, leave, subscribe, doBoost, openStudio,
    modal, closeModal, handleHash,
    get ui() { return ui; }, get room() { return room; }
  };
})();

window.HUB = HUB;

/* ── Pane template & router hook ───────────────────────────────────── */
window.getCommunityTemplate = function () {
  return `<section id="pane-community" class="pane">
    <div id="hub-root"></div>
  </section>`;
};

window.renderCommunity = function () { HUB.paint(); };

window.addEventListener('hashchange', () => HUB.handleHash());
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(HUB.handleHash, 400));
else setTimeout(() => HUB.handleHash(), 400);

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module now, so its top-level names are private
   to it. Inline onclick= handlers and every other module still look
   them up on the global object, so they are republished here.

   Each one is a thunk because the list is produced by scanning, and
   scanning over-collects — a line inside a template literal can look
   like a declaration. publish() calls each thunk and skips the ones
   that do not resolve, so a phantom costs one caught error and not a
   dead module graph. */
import { publish } from '../globals.js?v=2';
publish('pages/communehub.js', {
  HUB: () => HUB
});
