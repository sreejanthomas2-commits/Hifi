/* ╔══════════════════════════════════════════════════════════════════╗
   ║  COMMUNITY ECOSYSTEM — crypto rooms you actually enter           ║
   ║                                                                  ║
   ║  Three views:                                                    ║
   ║   1. Discover  — crypto communities, joined ones pinned first    ║
   ║   2. Room      — the Telegram-shaped space behind a join:        ║
   ║                  topics, live chat, members, bounties, treasury  ║
   ║   3. Launchpad — new crypto startup projects you can back        ║
   ║                                                                  ║
   ║  Division of labour with the Web3 Communities pane: that one     ║
   ║  owns the protocol layer (governance, gates, issuance), this     ║
   ║  one owns the social layer (the room you hang out in).           ║
   ║                                                                  ║
   ║  Community tokens and startup allocations are deliberately kept  ║
   ║  in CH's own ledger, never credited to TR — they have no market  ║
   ║  price, so pushing them into the Portfolio would render them as  ║
   ║  $0.00 holdings at -100%. USDT always settles through TR.        ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CH = (() => {

  const KEY = 'ts_community';

  /* ── Communities ─────────────────────────────────────────────────── */
  const TOPICS_BASE = [
    { id: 'general',   name: 'General',       icon: 'forum' },
    { id: 'announce',  name: 'Announcements', icon: 'campaign', readOnly: true },
    { id: 'alpha',     name: 'Alpha',         icon: 'bolt', gate: 250 },
    { id: 'dev',       name: 'Dev',           icon: 'code' },
    { id: 'support',   name: 'Support',       icon: 'help' }
  ];

  const COMMUNITIES = [
    { id: 'btc',   name: 'Bitcoin Builders',   handle: '@btcbuilders', icon: 'currency_bitcoin', color: '#F7931A',
      desc: 'Lightning, ordinals and everything shipping on Bitcoin.',
      members: 48210, online: 1840, verified: true, tags: ['Bitcoin', 'Lightning'],
      token: { sym: 'BUILD', price: 0.84, holders: 12400, supply: 21000000 }, treasury: 1840000 },
    { id: 'eth',   name: 'Ethereum Core',      handle: '@ethcore', icon: 'diamond', color: '#627EEA',
      desc: 'EIPs, client releases and protocol research in the open.',
      members: 62800, online: 2410, verified: true, tags: ['Ethereum', 'Protocol'],
      token: { sym: 'CORE', price: 2.15, holders: 28900, supply: 10000000 }, treasury: 4120000 },
    { id: 'sol',   name: 'Solana Speedrun',    handle: '@solspeed', icon: 'bolt', color: '#14F195',
      desc: 'Ship fast on Solana — hackathons, tooling, mainnet war stories.',
      members: 39400, online: 3120, verified: true, tags: ['Solana', 'Builders'],
      token: { sym: 'SPEED', price: 0.42, holders: 9800, supply: 50000000 }, treasury: 940000 },
    { id: 'defi',  name: 'DeFi Degens',        handle: '@defidegens', icon: 'water_drop', color: '#00BFA5',
      desc: 'Yield, liquidity and the art of not getting rekt.',
      members: 71300, online: 4890, verified: false, tags: ['DeFi', 'Yield'],
      token: { sym: 'DEGEN', price: 0.09, holders: 34100, supply: 400000000 }, treasury: 620000 },
    { id: 'l2',    name: 'Layer 2 Lab',        handle: '@l2lab', icon: 'layers', color: '#8A6400',
      desc: 'Rollups, proving systems and the road to cheap blockspace.',
      members: 24600, online: 980, verified: true, tags: ['L2', 'Rollups'],
      token: { sym: 'ROLL', price: 1.32, holders: 7600, supply: 25000000 }, treasury: 1180000 },
    { id: 'nft',   name: 'Collectors Guild',   handle: '@collectors', icon: 'palette', color: '#EC4899',
      desc: 'Art, provenance and collections worth holding through a winter.',
      members: 33900, online: 1120, verified: false, tags: ['NFT', 'Art'],
      token: { sym: 'GUILD', price: 0.27, holders: 15200, supply: 80000000 }, treasury: 410000 },
    { id: 'sec',   name: 'Security & Audits',  handle: '@secaudits', icon: 'shield', color: '#EF5350',
      desc: 'Post-mortems, audit findings and responsible disclosure.',
      members: 18700, online: 640, verified: true, tags: ['Security', 'Audits'],
      token: { sym: 'AUDIT', price: 3.40, holders: 4200, supply: 5000000 }, treasury: 2260000 },
    { id: 'quest', name: 'Airdrop Hunters',    handle: '@airdrops', icon: 'flag', color: '#FFA726',
      desc: 'Testnets, quests and points programmes worth the gas.',
      members: 88400, online: 6210, verified: false, tags: ['Airdrops', 'Quests'],
      token: { sym: 'HUNT', price: 0.05, holders: 51800, supply: 1000000000 }, treasury: 280000 },
    { id: 'found', name: 'Web3 Founders',      handle: '@web3founders', icon: 'rocket_launch', color: '#42A5F5',
      desc: 'Raising, hiring and shipping a crypto company.',
      members: 12400, online: 380, verified: true, tags: ['Startups', 'Founders'],
      token: { sym: 'FOUND', price: 5.60, holders: 2100, supply: 2000000 }, treasury: 3400000 },
    { id: 'trade', name: 'Trading Floor',      handle: '@tradingfloor', icon: 'candlestick_chart', color: '#26A69A',
      desc: 'Structure, levels and risk — charts posted with a thesis.',
      members: 56100, online: 4020, verified: false, tags: ['Trading', 'TA'],
      token: { sym: 'FLOOR', price: 0.66, holders: 22700, supply: 60000000 }, treasury: 780000 }
  ];

  /* ── Startup projects ────────────────────────────────────────────── */
  const STARTUPS = [
    { id: 'sp1', name: 'Meridian', sym: 'MRD', chain: 'Ethereum', cat: 'Infrastructure', stage: 'Seed',
      tagline: 'Intent-based settlement for cross-chain payments.',
      raised: 1840000, target: 3000000, backers: 412, valuation: 24000000, team: 9,
      desc: 'Routes a payment across chains from a stated intent instead of a bridge path, so the user never picks a route.',
      highlights: ['Testnet live on 4 chains', '$12M settled in beta', 'Ex-Circle founding team'] },
    { id: 'sp2', name: 'Loomfi', sym: 'LOOM', chain: 'Solana', cat: 'DeFi', stage: 'Private',
      tagline: 'Undercollateralised credit backed by on-chain cashflow.',
      raised: 2600000, target: 4000000, backers: 268, valuation: 41000000, team: 14,
      desc: 'Underwrites loans against recurring on-chain revenue rather than deposited collateral.',
      highlights: ['$4.1M loan book', 'Zero defaults in 11 months', 'Audited by OtterSec'] },
    { id: 'sp3', name: 'Palisade', sym: 'PAL', chain: 'Base', cat: 'Security', stage: 'Seed',
      tagline: 'Continuous monitoring that pauses a contract mid-exploit.',
      raised: 900000, target: 2500000, backers: 190, valuation: 15000000, team: 6,
      desc: 'Watches contract state and trips a circuit breaker before an exploit finishes draining a pool.',
      highlights: ['Caught 3 live exploits', '$40M protected', 'Backed by two audit firms'] },
    { id: 'sp4', name: 'Nomad Yield', sym: 'NMD', chain: 'Arbitrum', cat: 'DeFi', stage: 'Public',
      tagline: 'Yield that rebalances itself across every major venue.',
      raised: 3400000, target: 3500000, backers: 1240, valuation: 52000000, team: 11,
      desc: 'A single deposit that moves between lending markets as rates change, net of gas.',
      highlights: ['$28M TVL', '11.4% trailing APY', 'Live 14 months'] },
    { id: 'sp5', name: 'Ovation', sym: 'OVN', chain: 'Solana', cat: 'SocialFi', stage: 'Seed',
      tagline: 'Creator revenue split at the protocol level.',
      raised: 620000, target: 2000000, backers: 148, valuation: 11000000, team: 5,
      desc: 'Splits are enforced by the contract that receives the payment, so collaborators never chase an invoice.',
      highlights: ['4,100 creators onboarded', '$800K split to date', 'No platform fee'] },
    { id: 'sp6', name: 'Cardinal', sym: 'CRD', chain: 'Ethereum', cat: 'Infrastructure', stage: 'Private',
      tagline: 'Proof aggregation that makes L2 finality minutes, not days.',
      raised: 5100000, target: 6000000, backers: 320, valuation: 88000000, team: 18,
      desc: 'Batches proofs from multiple rollups into one settlement, cutting the cost each chain pays alone.',
      highlights: ['3 rollups integrated', '92% proving cost cut', 'Two research papers'] },
    { id: 'sp7', name: 'Thrift', sym: 'THR', chain: 'Base', cat: 'Payments', stage: 'Seed',
      tagline: 'Stablecoin payroll for teams that hire across borders.',
      raised: 1150000, target: 2200000, backers: 231, valuation: 18000000, team: 8,
      desc: 'Pays contractors in stablecoins on a schedule, with local off-ramps handled per country.',
      highlights: ['620 contractors paid', '18 countries', '$2.4M monthly volume'] },
    { id: 'sp8', name: 'Kiln Labs', sym: 'KILN', chain: 'Multi-chain', cat: 'Tooling', stage: 'Seed',
      tagline: 'One SDK for wallets, gas sponsorship and session keys.',
      raised: 780000, target: 2000000, backers: 165, valuation: 13000000, team: 7,
      desc: 'Wraps account abstraction so an app can sponsor gas and hold a session without shipping its own infra.',
      highlights: ['140 apps integrated', '2.1M sponsored txns', 'Open source core'] }
  ];

  /* ── Bounties ────────────────────────────────────────────────────── */
  /* Paid in the community's own token, which never touches the TR ledger. */
  const BOUNTIES = [
    { id: 'b1', title: 'Write a walkthrough for a first-time contributor', reward: 120, effort: 'Medium' },
    { id: 'b2', title: 'Reproduce and confirm the open testnet bug', reward: 60,  effort: 'Small' },
    { id: 'b3', title: 'Translate the docs landing page', reward: 200, effort: 'Medium' },
    { id: 'b4', title: 'Host a community call and post the notes', reward: 350, effort: 'Large' }
  ];

  const ROLES = ['Founder', 'Core', 'Mod', 'Member', 'Member', 'Member'];
  const NAMES = ['Aria Volkov', 'Kenji Sato', 'Nadia Rahman', 'Theo Marsh', 'Priya Anand', 'Luca Bianchi',
                 'Sam Okafor', 'Mei Lin', 'Ravi Desai', 'Elena Duarte'];

  const DEFAULT = {
    view: 'discover', joined: [], activeId: null, activeTopic: 'general',
    msgs: {}, tokens: {}, claimed: [], backed: [], xp: {}
  };

  let D = load();

  /* Rooms moved to Messages; a stored 'room' view would otherwise strand
     this pane on a screen it no longer routes to. */
  if (D.view === 'room') D.view = 'discover';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const hasTR = () => typeof TR !== 'undefined';

  function usd(v) {
    if (!v && v !== 0) return '$0.00';
    const a = Math.abs(v);
    if (a >= 1000000) return '$' + (a / 1000000).toFixed(2) + 'M';
    if (a >= 1000) return '$' + (a / 1000).toFixed(1) + 'K';
    return (v < 0 ? '-$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const num = v => (v || 0).toLocaleString('en-US');
  const qty = v => (v || 0).toLocaleString('en-US', { maximumFractionDigits: 4 });

  const byId = id => COMMUNITIES.find(c => c.id === id);
  const isJoined = id => D.joined.includes(id);
  const tokenBal = sym => D.tokens[sym] || 0;
  const xpOf = id => D.xp[id] || 0;

  const initials = n => String(n).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  /* Topics gate on the community token you hold, so Alpha stays shut until
     you've actually earned into the community. */
  function topicsFor(c) {
    return TOPICS_BASE.map(t => ({ ...t, locked: t.gate ? tokenBal(c.token.sym) < t.gate : false }));
  }

  /* ── Membership ──────────────────────────────────────────────────── */
  function join(id) {
    const c = byId(id);
    if (!c || isJoined(id)) return;
    D.joined.push(id);
    D.xp[id] = D.xp[id] || 0;
    save(); paint();
    toast(`Joined ${c.name} — you're in.`);
  }

  function leave(id) {
    const c = byId(id);
    D.joined = D.joined.filter(x => x !== id);
    if (D.activeId === id) { D.activeId = null; D.view = 'discover'; }
    save(); paint();
    toast(`Left ${c ? c.name : 'the community'}.`);
  }

  /* Joining and entering are one gesture — a community you tap into is a
     community you're in, the way a Telegram invite link behaves. */
  /* Rooms live in the Messages pane now, so entering one hands off there
     rather than opening a second copy of the same conversation here. This
     pane keeps discovery, governance, the Asset Lab and the Launchpad. */
  function enter(id) {
    const c = byId(id);
    if (!c) return;
    if (!isJoined(id)) { D.joined.push(id); D.xp[id] = D.xp[id] || 0; }
    D.activeId = id;
    D.activeTopic = 'general';
    D.view = 'discover';
    save();

    if (typeof TG !== 'undefined' && typeof navigateTo === 'function') {
      navigateTo('messages');
      setTimeout(() => TG.open('com:' + id), 60);
      return;
    }
    // No messenger loaded — fall back to the in-pane room.
    D.view = 'room';
    save(); paint(); scrollMessages();
  }

  function setView(v) { D.view = v; save(); paint(); }
  function back() { D.view = 'discover'; D.activeId = null; save(); paint(); }

  function setTopic(t) {
    const c = byId(D.activeId);
    if (!c) return;
    const topic = topicsFor(c).find(x => x.id === t);
    if (topic && topic.locked) {
      toast(`${topic.name} needs ${num(topic.gate)} ${c.token.sym} — earn it from bounties.`);
      return;
    }
    D.activeTopic = t;
    save(); paint(); scrollMessages();
  }

  /* ── Messages ────────────────────────────────────────────────────── */
  const keyOf = (cid, tid) => `${cid}:${tid}`;

  /* Each room opens with a little history so it never looks abandoned. */
  const SEED = {
    general: [
      ['Aria Volkov', 'Core', 'Morning all — weekly call notes are pinned in Announcements.'],
      ['Kenji Sato', 'Member', 'Anyone else seeing slower confirmations this week, or just me?'],
      ['Nadia Rahman', 'Mod', 'Known — the mempool has been busy since the listing. Should settle by tomorrow.']
    ],
    announce: [
      ['Aria Volkov', 'Founder', '📢 Bounty round 4 is open. Four tasks, paid on merge — check the Bounties panel.'],
      ['Aria Volkov', 'Founder', '📢 Treasury report published. Runway is 22 months at current burn.']
    ],
    alpha: [
      ['Theo Marsh', 'Core', 'Positioning notes for the week are up. Read the risk section before the entries.'],
      ['Priya Anand', 'Member', 'The funding flip on Friday was the tell. Sized in accordingly.']
    ],
    dev: [
      ['Luca Bianchi', 'Core', 'PR #418 is ready for review — cuts the indexer cold start by about 60%.'],
      ['Mei Lin', 'Member', 'Reviewed. One nit on error handling, otherwise ship it.']
    ],
    support: [
      ['Ravi Desai', 'Mod', 'If your wallet shows a stale balance, disconnect and reconnect — it re-reads on connect.']
    ]
  };

  function messages() {
    const k = keyOf(D.activeId, D.activeTopic);
    if (!D.msgs[k]) {
      const seed = SEED[D.activeTopic] || [];
      D.msgs[k] = seed.map(([name, role, text], i) => ({
        id: 'm' + i, name, role, text, me: false, ts: Date.now() - (seed.length - i) * 900000
      }));
      save();
    }
    return D.msgs[k];
  }

  /* ── Bridge for the Messages pane ────────────────────────────────── */
  /* The merged messenger reads and writes this same store, so a message
     posted in either place is the same message — one conversation with
     two doors rather than two copies that drift. */
  function setActive(cid, topic) {
    if (cid) D.activeId = cid;
    if (topic) D.activeTopic = topic;
    messages();                     // seeds the topic if it's new
  }

  function postMessage(cid, topic, text) {
    const body = String(text || '').trim();
    if (!body) return false;
    const k = keyOf(cid, topic);
    D.activeId = cid; D.activeTopic = topic;
    messages();
    D.msgs[k].push({ id: 'm' + Date.now(), name: 'You', role: 'Member', text: body, me: true, ts: Date.now() });
    D.xp[cid] = (D.xp[cid] || 0) + 5;
    save();
    reply(cid, topic);
    return true;
  }

  const persist = () => save();

  function send(preset) {
    const input = document.getElementById('ch-input');
    const text = (preset !== undefined ? preset : (input ? input.value : '')).trim();
    if (!text) return;
    const c = byId(D.activeId);
    if (!c) return;

    const topic = topicsFor(c).find(t => t.id === D.activeTopic);
    if (topic && topic.readOnly) { toast('Announcements is read-only — post in General.'); return; }

    const k = keyOf(c.id, D.activeTopic);
    messages();
    D.msgs[k].push({ id: 'm' + Date.now(), name: 'You', role: 'Member', text, me: true, ts: Date.now() });

    // Posting is the contribution that earns standing in the room.
    D.xp[c.id] = (D.xp[c.id] || 0) + 5;
    if (input && preset === undefined) input.value = '';
    save(); paint(); scrollMessages();

    reply(c.id, D.activeTopic);
  }

  const REPLIES = [
    'Good point — worth writing up properly.',
    'Agreed. That matches what we saw in testing.',
    'Can you drop a link? Want to read the detail.',
    'This has come up twice this week. Pinning it.',
    'Fair — though the tradeoff is on the gas side.',
    'Nice. That unblocks the thing I was stuck on.'
  ];

  function reply(cid, tid) {
    setTimeout(() => {
      const k = keyOf(cid, tid);
      if (!D.msgs[k]) return;
      const i = Math.floor(Math.random() * NAMES.length);
      D.msgs[k].push({
        id: 'r' + Date.now(), name: NAMES[i], role: ROLES[i % ROLES.length],
        text: REPLIES[Math.floor(Math.random() * REPLIES.length)], me: false, ts: Date.now()
      });
      save();
      if (D.activeId === cid && D.activeTopic === tid) { paint(); scrollMessages(); }
    }, 1500);
  }

  function scrollMessages() {
    setTimeout(() => {
      const el = document.getElementById('ch-msgs');
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }

  /* ── Bounties ────────────────────────────────────────────────────── */
  /* Rewards are the community's own token. They stay in CH's ledger
     because they have no market price — see the header note. */
  function claimBounty(bid) {
    const c = byId(D.activeId);
    const b = BOUNTIES.find(x => x.id === bid);
    if (!c || !b) return;
    const tag = c.id + ':' + bid;
    if (D.claimed.includes(tag)) { toast('Already claimed.'); return; }

    D.claimed.push(tag);
    D.tokens[c.token.sym] = tokenBal(c.token.sym) + b.reward;
    D.xp[c.id] = (D.xp[c.id] || 0) + 25;
    save(); paint();
    toast(`Bounty complete — ${num(b.reward)} ${c.token.sym} credited`);
  }

  /* ── Tipping ─────────────────────────────────────────────────────── */
  /* Tips are real USDT out of the paper account, so they debit TR. */
  function tip(name) {
    if (!hasTR()) { toast('Trading account unavailable.'); return; }
    const amount = 1;
    if (TR.availableOf('USDT') < amount) { toast('Not enough USDT to tip.'); return; }
    TR.debitAsset('USDT', amount);
    TR.repaint();
    const c = byId(D.activeId);
    if (c) D.xp[c.id] = (D.xp[c.id] || 0) + 2;
    save(); paint();
    toast(`Tipped ${name} ${usd(amount)}`);
  }

  /* ── Backing a startup ───────────────────────────────────────────── */
  function back_(id, amount) {
    const p = STARTUPS.find(x => x.id === id);
    const amt = parseFloat(amount);
    if (!p) return { ok: false, msg: 'Unknown project.' };
    if (!hasTR()) return { ok: false, msg: 'Trading account unavailable.' };
    if (!amt || amt < 50) return { ok: false, msg: 'Minimum ticket is $50.' };

    const have = TR.availableOf('USDT');
    if (amt > have + 1e-9) return { ok: false, msg: `Insufficient USDT — you hold ${qty(have)}.` };
    if (!TR.debitAsset('USDT', amt)) return { ok: false, msg: 'Debit failed.' };

    // Allocation is priced off the round's valuation and held here, not in
    // the Portfolio — the token does not exist on any market yet.
    const alloc = (amt / p.valuation) * 100;
    D.backed.push({ id, sym: p.sym, amount: amt, alloc, ts: Date.now() });
    save(); TR.repaint(); paint();
    return { ok: true, msg: `Backed ${p.name} with ${usd(amt)}` };
  }

  function backFrom(id) {
    const el = document.getElementById('ch-back-' + id);
    const res = back_(id, el ? el.value : 0);
    toast(res.msg);
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  /* Governance and the Asset Lab are the Web3 Communities module's, merged
     in here so there is one Community pane rather than two. CM keeps
     owning its own state and repaints — it just renders into a container
     this pane provides, with its tab bar suppressed. */
  const CM_VIEWS = { governance: 'governance', assets: 'assets', web3: 'communities' };

  function paint() {
    const root = document.getElementById('ch-root');
    if (!root) return;

    if (CM_VIEWS[D.view]) {
      root.innerHTML = `${tabsHTML()}<div id="cm-root"></div>`;
      if (typeof CM === 'undefined') {
        document.getElementById('cm-root').innerHTML =
          '<div class="ch-note">Governance module unavailable.</div>';
        return;
      }
      CM.setEmbedded(true);
      CM.setTab(CM_VIEWS[D.view]);   // setTab paints into #cm-root itself
      return;
    }

    root.innerHTML = D.view === 'room' ? roomHTML()
      : D.view === 'launchpad' ? launchpadHTML()
      : discoverHTML();
  }

  function tabsHTML() {
    const tabs = [
      ['discover',   'Communities', 'groups'],
      ['web3',       'Web3 DAOs',   'hub'],
      ['governance', 'Governance',  'how_to_vote'],
      ['assets',     'Asset Lab',   'auto_awesome'],
      ['launchpad',  'Launchpad',   'rocket_launch']
    ];
    return `<div class="ch-tabs">
      ${tabs.map(([k, l, i]) => `
        <button class="ch-tab${D.view === k || (k === 'discover' && D.view === 'room') ? ' active' : ''}"
                onclick="CH.setView('${k}')">
          <span class="material-symbols-rounded ms-18">${i}</span>${l}
        </button>`).join('')}
    </div>`;
  }

  /* ── Discover ────────────────────────────────────────────────────── */
  function discoverHTML() {
    const mine = COMMUNITIES.filter(c => isJoined(c.id));
    const rest = COMMUNITIES.filter(c => !isJoined(c.id));

    const card = c => {
      const joined = isJoined(c.id);
      return `<div class="ch-card">
        <div class="ch-card-top">
          <div class="ch-icon" style="background:${c.color}1f; color:${c.color}">
            <span class="material-symbols-rounded">${c.icon}</span>
          </div>
          <div class="ch-card-id">
            <div class="ch-name">${esc(c.name)}${c.verified
              ? '<span class="material-symbols-rounded ch-verified">verified</span>' : ''}</div>
            <div class="ch-handle">${esc(c.handle)}</div>
          </div>
          <span class="ch-token-pill">${esc(c.token.sym)}</span>
        </div>
        <div class="ch-desc">${esc(c.desc)}</div>
        <div class="ch-stats">
          <span><b>${num(c.members)}</b> members</span>
          <span class="ch-online"><i></i>${num(c.online)} online</span>
          <span><b>${usd(c.treasury)}</b> treasury</span>
        </div>
        <div class="ch-tags">${c.tags.map(t => `<span class="ch-tag">${esc(t)}</span>`).join('')}</div>
        <div class="ch-card-act">
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="CH.enter('${c.id}')">
            ${joined ? 'Open' : 'Join &amp; enter'}</button>
          ${joined ? `<button class="btn btn-ghost btn-sm" onclick="CH.leave('${c.id}')">Leave</button>` : ''}
        </div>
      </div>`;
    };

    const holdings = Object.keys(D.tokens).filter(s => D.tokens[s] > 0);
    const wallet = holdings.length ? `
      <h3 class="ch-h">Your community tokens</h3>
      <div class="ch-note">Earned from bounties. These have no market price yet, so they're held here
        rather than shown as $0.00 lines in your Portfolio.</div>
      <div class="ch-tokens">
        ${holdings.map(s => {
          const c = COMMUNITIES.find(x => x.token.sym === s);
          return `<div class="ch-tok">
            <span class="ch-tok-s">${esc(s)}</span>
            <b>${num(D.tokens[s])}</b>
            <span class="fs11 tc-3">${c ? esc(c.name) : ''}</span>
          </div>`;
        }).join('')}
      </div>` : '';

    return `${tabsHTML()}
      ${mine.length ? `<h3 class="ch-h">Your communities</h3>
        <div class="ch-grid">${mine.map(card).join('')}</div>` : ''}
      <h3 class="ch-h">${mine.length ? 'Discover more' : 'Discover communities'}</h3>
      <div class="ch-grid">${rest.map(card).join('')}</div>
      ${wallet}`;
  }

  /* ── Room ────────────────────────────────────────────────────────── */
  function roomHTML() {
    const c = byId(D.activeId);
    if (!c) { D.view = 'discover'; return discoverHTML(); }

    const topics = topicsFor(c);
    const active = topics.find(t => t.id === D.activeTopic) || topics[0];
    const msgs = messages();
    const bal = tokenBal(c.token.sym);

    const topicRail = topics.map(t => `
      <button class="ch-topic${t.id === D.activeTopic ? ' active' : ''}${t.locked ? ' locked' : ''}"
              onclick="CH.setTopic('${t.id}')">
        <span class="material-symbols-rounded ms-16">${t.locked ? 'lock' : t.icon}</span>
        <span>${esc(t.name)}</span>
        ${t.gate ? `<span class="ch-gate">${num(t.gate)}</span>` : ''}
      </button>`).join('');

    const stream = msgs.map(m => `
      <div class="ch-msg${m.me ? ' me' : ''}">
        <div class="ch-av" style="background:${m.me ? 'var(--g-brand)' : c.color + '33'}; color:${m.me ? '#fff' : c.color}">
          ${esc(initials(m.name))}</div>
        <div class="ch-msg-body">
          <div class="ch-msg-head">
            <b>${esc(m.name)}</b>
            ${m.role && m.role !== 'Member' ? `<span class="ch-role">${esc(m.role)}</span>` : ''}
            <span class="ch-time">${new Date(m.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            ${m.me ? '' : `<button class="ch-tip" onclick="CH.tip('${esc(m.name)}')" title="Tip $1">🎁</button>`}
          </div>
          <div class="ch-msg-text">${esc(m.text)}</div>
        </div>
      </div>`).join('');

    const members = NAMES.slice(0, 8).map((n, i) => `
      <div class="ch-member">
        <div class="ch-av sm" style="background:${c.color}33; color:${c.color}">${esc(initials(n))}</div>
        <div class="ch-member-id">
          <div class="ch-member-n">${esc(n)}</div>
          <div class="ch-member-r">${esc(ROLES[i % ROLES.length])}</div>
        </div>
        <span class="ch-dot${i % 3 ? '' : ' on'}"></span>
      </div>`).join('');

    const bounties = BOUNTIES.map(b => {
      const done = D.claimed.includes(c.id + ':' + b.id);
      return `<div class="ch-bounty${done ? ' done' : ''}">
        <div class="ch-bounty-t">${esc(b.title)}</div>
        <div class="ch-bounty-m">
          <span class="ch-reward">${num(b.reward)} ${esc(c.token.sym)}</span>
          <span class="fs11 tc-3">${esc(b.effort)}</span>
          ${done ? '<span class="ch-pill ok">Claimed</span>'
                 : `<button class="btn btn-ghost btn-sm" onclick="CH.claimBounty('${b.id}')">Claim</button>`}
        </div>
      </div>`;
    }).join('');

    return `
      <div class="ch-room">
        <div class="ch-room-head">
          <button class="icon-btn" onclick="CH.back()" title="Back">
            <span class="material-symbols-rounded ms-20">arrow_back</span></button>
          <div class="ch-icon" style="background:${c.color}1f; color:${c.color}">
            <span class="material-symbols-rounded">${c.icon}</span></div>
          <div class="ch-room-id">
            <div class="ch-name">${esc(c.name)}${c.verified
              ? '<span class="material-symbols-rounded ch-verified">verified</span>' : ''}</div>
            <div class="ch-handle">${num(c.members)} members · ${num(c.online)} online</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="CH.leave('${c.id}')">Leave</button>
        </div>

        <div class="ch-strip">
          <div><span>Token</span><b>${esc(c.token.sym)}</b></div>
          <div><span>Price</span><b>$${c.token.price.toFixed(2)}</b></div>
          <div><span>Holders</span><b>${num(c.token.holders)}</b></div>
          <div><span>Treasury</span><b>${usd(c.treasury)}</b></div>
          <div><span>You hold</span><b class="${bal ? 'tc-green' : ''}">${num(bal)}</b></div>
          <div><span>Your XP</span><b>${num(xpOf(c.id))}</b></div>
        </div>

        <div class="ch-room-body">
          <aside class="ch-topics">
            <div class="ch-side-l">Topics</div>
            ${topicRail}
          </aside>

          <div class="ch-chat">
            <div class="ch-chat-head">
              <span class="material-symbols-rounded ms-18">${active.icon}</span>
              <b>${esc(active.name)}</b>
              ${active.readOnly ? '<span class="ch-pill">Read-only</span>' : ''}
            </div>
            <div class="ch-msgs" id="ch-msgs">${stream}</div>
            ${active.readOnly
              ? '<div class="ch-readonly">Only admins can post in Announcements.</div>'
              : `<div class="ch-composer">
                   <input class="ch-input" id="ch-input" placeholder="Message ${esc(c.name)}…"
                          onkeydown="if(event.key==='Enter'){event.preventDefault();CH.send();}">
                   <button class="btn btn-primary btn-sm" onclick="CH.send()">Send</button>
                 </div>`}
          </div>

          <aside class="ch-side">
            <div class="ch-side-l">Bounties</div>
            <div class="ch-note">Paid in ${esc(c.token.sym)}. Earn ${num(250)} to unlock Alpha.</div>
            ${bounties}
            <div class="ch-side-l" style="margin-top:16px">Members</div>
            ${members}
          </aside>
        </div>
      </div>`;
  }

  /* ── Launchpad ───────────────────────────────────────────────────── */
  function launchpadHTML() {
    const mine = D.backed;
    const totalBacked = mine.reduce((t, b) => t + b.amount, 0);

    const positions = mine.length ? `
      <h3 class="ch-h">Your allocations</h3>
      <div class="ch-note">Pre-listing allocations are held here, not in your Portfolio — these
        tokens have no market price until the project lists.</div>
      <div class="ch-allocs">
        ${mine.map(b => {
          const p = STARTUPS.find(x => x.id === b.id) || {};
          return `<div class="ch-alloc">
            <div><b>${esc(p.name || b.sym)}</b><span class="fs11 tc-3"> ${esc(b.sym)}</span></div>
            <div>${usd(b.amount)}</div>
            <div class="fs11 tc-3">${b.alloc.toFixed(4)}% of round</div>
          </div>`;
        }).join('')}
      </div>
      <div class="ch-note" style="margin-top:6px">Total committed: <b>${usd(totalBacked)}</b></div>` : '';

    const cards = STARTUPS.map(p => {
      const progress = Math.min(100, (p.raised / p.target) * 100);
      const backed = mine.filter(b => b.id === p.id).reduce((t, b) => t + b.amount, 0);
      return `<div class="ch-proj">
        <div class="ch-proj-top">
          <div class="ch-proj-sym">${esc(p.sym)}</div>
          <div class="ch-proj-id">
            <div class="ch-name">${esc(p.name)}</div>
            <div class="ch-handle">${esc(p.cat)} · ${esc(p.chain)}</div>
          </div>
          <span class="ch-stage ch-stage-${p.stage.toLowerCase()}">${esc(p.stage)}</span>
        </div>
        <div class="ch-proj-tag">${esc(p.tagline)}</div>
        <div class="ch-desc">${esc(p.desc)}</div>
        <ul class="ch-hl">${p.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
        <div class="ch-bar"><i style="width:${progress.toFixed(0)}%"></i></div>
        <div class="ch-stats">
          <span><b>${usd(p.raised)}</b> of ${usd(p.target)}</span>
          <span><b>${num(p.backers)}</b> backers</span>
          <span><b>${usd(p.valuation)}</b> cap</span>
        </div>
        ${backed > 0 ? `<div class="fs11 tc-green">You've committed ${usd(backed)}</div>` : ''}
        <div class="ch-copy-form">
          <input class="ch-input" type="number" step="any" placeholder="$50 min" id="ch-back-${p.id}">
          <button class="btn btn-primary btn-sm" onclick="CH.backFrom('${p.id}')">Back</button>
        </div>
      </div>`;
    }).join('');

    return `${tabsHTML()}
      ${positions}
      <h3 class="ch-h">New crypto projects</h3>
      <div class="ch-note">Simulated rounds. Committing debits your paper USDT and records an
        allocation — no real investment, no securities, no transfer of anything.</div>
      <div class="ch-grid">${cards}</div>`;
  }

  return {
    paint, setView, enter, join, leave, back, setTopic, send,
    claimBounty, tip, backFrom, back_,
    setActive, postMessage, persist, topicsFor,
    isJoined, byId, tokenBal,
    COMMUNITIES, STARTUPS, BOUNTIES,
    get state() { return D; }
  };
})();

window.CH = CH;

/* The pane's template and its router hook are in pages/communehub.js,
   which loads after this file and renders CH inside itself: its
   Launchpad, Governance and Asset Lab tabs are a #ch-root that
   CH.setView paints. A getCommunityTemplate and a renderCommunity
   were declared here too and overwritten on every load. CH itself
   is live and stays. */

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
publish('pages/communityhub.js', {
  CH: () => CH
});
