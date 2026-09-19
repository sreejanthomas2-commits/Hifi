/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SOCIALFI SERVICES                                               ║
   ║                                                                  ║
   ║  The creator-economy layer: follow graph, reputation, creator    ║
   ║  rewards (90/10), social-to-earn, subscriptions, community       ║
   ║  rewards and token gating.                                       ║
   ║                                                                  ║
   ║  Everything here holds real state and persists to localStorage — ║
   ║  no toast-only buttons. Rewards are paid in TREND out of the     ║
   ║  wallet in DATA.wallet.balances.                                 ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const SF = (() => {

  const KEY = 'ts_socialfi';

  /* ── Economics ──────────────────────────────────────────────────
     Engagement on a creator's post mints a small TREND reward. The
     creator keeps 90%, the platform takes 10% — the split the product
     brief calls for. Rates are deliberately tiny so a busy feed does
     not print absurd numbers. */
  const CREATOR_SPLIT = 0.90;
  const ENGAGEMENT_RATE = { like: 0.002, comment: 0.01, repost: 0.02, subscribe: 0.5 };

  /* Social-to-earn. Daily caps exist so the reward is for contributing,
     not for spamming — earning stops once the cap is hit. */
  const EARN = {
    publish_post:   { amount: 0.50, cap: 10, label: 'Published a post' },
    write_comment:  { amount: 0.20, cap: 15, label: 'Wrote a comment' },
    create_poll:    { amount: 0.40, cap: 5,  label: 'Created a poll' },
    join_community: { amount: 0.30, cap: 5,  label: 'Joined a community' },
    daily_checkin:  { amount: 1.00, cap: 1,  label: 'Daily check-in' },
    curate:         { amount: 0.10, cap: 20, label: 'Surfaced good content' }
  };

  /* Reputation is earned from contribution, not from follower count. */
  const REP_WEIGHT = {
    publish_post: 6, write_comment: 2, create_poll: 4, received_tip: 8,
    gave_tip: 2, join_community: 3, subscribed_to: 5, daily_checkin: 1,
    repost: 1, gained_follower: 4
  };

  const REP_TIERS = [
    { min: 0,   name: 'Newcomer',    color: 'var(--t3)' },
    { min: 40,  name: 'Contributor', color: 'var(--blue)' },
    { min: 120, name: 'Trusted',     color: 'var(--green)' },
    { min: 300, name: 'Pillar',      color: 'var(--purple)' },
    { min: 700, name: 'Luminary',    color: 'var(--orange)' }
  ];

  /* Subscription tiers a creator can offer, priced in USDT. */
  const TIERS = {
    supporter: { price: 3,  label: 'Supporter', perks: ['Supporter badge', 'Subscriber-only posts'] },
    insider:   { price: 9,  label: 'Insider',   perks: ['Everything in Supporter', 'Private community access', 'Monthly AMA'] },
    patron:    { price: 25, label: 'Patron',    perks: ['Everything in Insider', 'Direct messages', 'Name in credits'] }
  };

  const DEFAULT = {
    following: [],          // [{handle, name, since}]
    followers: 0,           // simulated inbound follows
    repEvents: [],          // [{t, type, weight}]
    earnLedger: [],         // [{t, type, label, amount}]
    subscriptions: [],      // [{handle, name, tier, price, since, renews}]
    creatorPool: 0,         // unclaimed TREND owed to you as a creator
    platformFees: 0,        // the 10% cut, shown for transparency
    engagementLog: [],      // [{t, kind, amount}]
    communities: {},        // name -> {funded, claimed:[], gate}
    reposts: [],            // post ids you reposted
    lastCheckin: null
  };

  let S_SF = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULT };
      return { ...DEFAULT, ...JSON.parse(raw) };
    } catch (e) { return { ...DEFAULT }; }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S_SF)); } catch (e) {}
  }

  const today = () => new Date().toISOString().slice(0, 10);
  const fmt = n => (Math.round(n * 10000) / 10000).toLocaleString('en-US', { maximumFractionDigits: 4 });
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const wallet = () => (typeof DATA !== 'undefined' && DATA.wallet ? DATA.wallet.balances : null);

  /* Rewards and spends go through MNY, so they land in the same account
     Pay and chat crypto use, appear in the one history and repaint every
     balance on screen. */
  function creditWallet(coin, amount) {
    if (typeof MNY !== 'undefined') {
      return MNY.receive(coin, amount, { kind: 'receive', via: 'SocialFi', simulated: false }).ok;
    }
    const b = wallet();
    if (!b) return false;
    b[coin] = (b[coin] || 0) + amount;
    return true;
  }

  function debitWallet(coin, amount) {
    if (typeof MNY !== 'undefined') {
      return MNY.spend(coin, amount, { kind: 'spend', via: 'SocialFi', allowUnpriced: true }).ok;
    }
    const b = wallet();
    if (!b || (b[coin] || 0) < amount) return false;
    b[coin] -= amount;
    return true;
  }

  /* ── Reputation ─────────────────────────────────────────────────── */
  function rep(type) {
    const w = REP_WEIGHT[type];
    if (!w) return;
    S_SF.repEvents.push({ t: Date.now(), type, weight: w });
    if (S_SF.repEvents.length > 500) S_SF.repEvents.shift();
    save();
  }

  function repScore() {
    return S_SF.repEvents.reduce((s, e) => s + e.weight, 0);
  }

  function repTier() {
    const s = repScore();
    let tier = REP_TIERS[0];
    for (const t of REP_TIERS) if (s >= t.min) tier = t;
    return tier;
  }

  function repBreakdown() {
    const by = {};
    S_SF.repEvents.forEach(e => { by[e.type] = (by[e.type] || 0) + e.weight; });
    return Object.entries(by).sort((a, b) => b[1] - a[1]);
  }

  /* ── Social-to-earn ─────────────────────────────────────────────── */
  function earnedToday(type) {
    const d = today();
    return S_SF.earnLedger.filter(e => e.type === type && e.day === d).length;
  }

  function earn(type) {
    const cfg = EARN[type];
    if (!cfg) return;
    if (earnedToday(type) >= cfg.cap) return;   // daily cap: contribution, not spam

    S_SF.earnLedger.unshift({ t: Date.now(), day: today(), type, label: cfg.label, amount: cfg.amount });
    if (S_SF.earnLedger.length > 300) S_SF.earnLedger.length = 300;
    creditWallet('TREND', cfg.amount);
    rep(type);
    save();
    toast(`+${cfg.amount} TREND — ${cfg.label}`);
    paintPill();
    refreshOpenPanel();
  }

  function checkin() {
    if (S_SF.lastCheckin === today()) { toast('Already checked in today.'); return; }
    S_SF.lastCheckin = today();
    save();
    earn('daily_checkin');
  }

  function earnedTotal() {
    return S_SF.earnLedger.reduce((s, e) => s + e.amount, 0);
  }

  /* ── Creator rewards (90 / 10) ──────────────────────────────────── */
  function accrueEngagement(kind) {
    const rate = ENGAGEMENT_RATE[kind];
    if (!rate) return;
    const creator = rate * CREATOR_SPLIT;
    const platform = rate - creator;
    S_SF.creatorPool += creator;
    S_SF.platformFees += platform;
    S_SF.engagementLog.unshift({ t: Date.now(), kind, amount: creator });
    if (S_SF.engagementLog.length > 200) S_SF.engagementLog.length = 200;
    save();
    refreshOpenPanel();
  }

  function claimCreatorRewards() {
    if (S_SF.creatorPool < 0.01) { toast('Nothing to claim yet — your pool is under 0.01 TREND.'); return; }
    const amount = S_SF.creatorPool;
    creditWallet('TREND', amount);
    S_SF.earnLedger.unshift({ t: Date.now(), day: today(), type: 'creator_rewards', label: 'Claimed creator rewards', amount });
    S_SF.creatorPool = 0;
    save();
    toast(`Claimed ${fmt(amount)} TREND in creator rewards 🎉`);
    refreshOpenPanel();
    if (typeof updateWalletUI === 'function') updateWalletUI();
  }

  /* ── Follow graph ───────────────────────────────────────────────── */
  const isFollowing = handle => S_SF.following.some(f => f.handle === handle);

  function toggleFollow(handle, name) {
    if (!handle) return false;
    const i = S_SF.following.findIndex(f => f.handle === handle);
    if (i > -1) {
      S_SF.following.splice(i, 1);
      save();
      toast(`Unfollowed ${name || handle}`);
    } else {
      S_SF.following.push({ handle, name: name || handle, since: Date.now() });
      rep('gained_follower');
      save();
      toast(`Following ${name || handle} ✓`);
    }
    paintFollowButtons();
    return isFollowing(handle);
  }

  /* Keeps every Follow button on the page in sync after a toggle. */
  function paintFollowButtons() {
    document.querySelectorAll('[data-follow-handle]').forEach(btn => {
      const h = btn.dataset.followHandle;
      const on = isFollowing(h);
      btn.textContent = on ? '✓ Following' : 'Follow';
      btn.classList.toggle('btn-primary', !on);
      btn.classList.toggle('btn-ghost', on);
    });
  }

  /* Drop-in markup for a real follow button. */
  function followBtn(handle, name, cls) {
    const on = isFollowing(handle);
    return `<button class="btn btn-sm ${on ? 'btn-ghost' : 'btn-primary'} ${cls || ''}"
      data-follow-handle="${esc(handle)}"
      onclick="SF.toggleFollow('${esc(handle)}', '${esc(name || handle)}')">${on ? '✓ Following' : 'Follow'}</button>`;
  }

  /* ── Reposts ────────────────────────────────────────────────────── */
  function repost(postId) {
    const id = String(postId);
    if (S_SF.reposts.includes(id)) { toast('You already reposted this.'); return; }
    S_SF.reposts.push(id);
    rep('repost');
    accrueEngagement('repost');
    save();

    // Surface it in the feed as a real entry, credited to the original author.
    if (typeof DATA !== 'undefined' && Array.isArray(DATA.posts)) {
      const src = DATA.posts.find(p => String(p.id) === id);
      if (src) {
        const me = (typeof S !== 'undefined' && S.user) ? S.user : { fname: 'Guest', lname: 'User', handle: '@guest' };
        DATA.posts.unshift({
          id: Date.now(),
          type: src.type || 'text',
          author: `${me.fname} ${me.lname}`.trim(),
          handle: me.handle,
          emoji: '🔁',
          body: src.body,
          time: Date.now(),
          tags: (src.tags || []).slice(0, 3),
          likes: 0, comments: 0, shares: 0, liked: false, mine: true,
          category: src.category,
          options: src.options ? src.options.map(o => ({ ...o })) : undefined,
          repostOf: { author: src.author, handle: src.handle }
        });
        if (typeof savePostsToLocal === 'function') savePostsToLocal();
        if (typeof renderFeed === 'function') renderFeed();
      }
    }
    toast('Reposted to your feed 🔁');
  }

  const hasReposted = id => S_SF.reposts.includes(String(id));

  /* ── Subscriptions ──────────────────────────────────────────────── */
  const isSubscribed = handle => S_SF.subscriptions.some(s => s.handle === handle);
  const subscriptionFor = handle => S_SF.subscriptions.find(s => s.handle === handle);

  function subscribe(handle, name, tierKey) {
    const tier = TIERS[tierKey];
    if (!tier) return;
    if (isSubscribed(handle)) { toast(`You already subscribe to ${name}.`); return; }
    if (!debitWallet('USDT', tier.price)) {
      toast(`Insufficient USDT — ${tier.label} costs $${tier.price}/mo ❌`);
      return;
    }
    const renews = Date.now() + 30 * 24 * 60 * 60 * 1000;
    S_SF.subscriptions.push({ handle, name, tier: tierKey, price: tier.price, since: Date.now(), renews });
    rep('subscribed_to');
    accrueEngagement('subscribe');
    save();
    toast(`Subscribed to ${name} · ${tier.label} — $${tier.price}/mo`);
    closeCreatorPage();
    if (typeof updateWalletUI === 'function') updateWalletUI();
  }

  function cancelSubscription(handle) {
    const i = S_SF.subscriptions.findIndex(s => s.handle === handle);
    if (i < 0) return;
    const s = S_SF.subscriptions[i];
    S_SF.subscriptions.splice(i, 1);
    save();
    toast(`Cancelled your ${TIERS[s.tier].label} subscription to ${s.name}`);
    refreshOpenPanel();
  }

  /* ── Community rewards & token gating ───────────────────────────── */
  function community(name) {
    if (!S_SF.communities[name]) S_SF.communities[name] = { funded: 0, claimed: [], gate: null };
    return S_SF.communities[name];
  }

  function fundCommunity(name, amount) {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast('Enter an amount to fund the pool.'); return; }
    if (!debitWallet('TREND', amt)) { toast('Insufficient TREND balance ❌'); return; }
    community(name).funded += amt;
    save();
    toast(`Funded ${name} rewards pool with ${fmt(amt)} TREND`);
    refreshOpenPanel();
  }

  /* A member may claim an equal share once per funding round. */
  function claimCommunityReward(name) {
    const c = community(name);
    const day = today();
    if (c.claimed.includes(day)) { toast('You already claimed from this pool today.'); return; }
    if (c.funded < 0.01) { toast('This pool is empty — fund it first.'); return; }
    const share = Math.min(c.funded, c.funded * 0.1 + 0.05);
    c.funded -= share;
    c.claimed.push(day);
    creditWallet('TREND', share);
    S_SF.earnLedger.unshift({ t: Date.now(), day, type: 'community_reward', label: `${name} reward`, amount: share });
    save();
    toast(`Claimed ${fmt(share)} TREND from ${name} 🎁`);
    refreshOpenPanel();
  }

  /* Token gate: hold enough TREND, or an eligible collectible. */
  function setGate(name, minTrend) {
    community(name).gate = minTrend > 0 ? { coin: 'TREND', min: minTrend } : null;
    save();
    toast(minTrend > 0 ? `${name} now requires ${minTrend} TREND to enter 🔒` : `${name} is now open to everyone`);
    refreshOpenPanel();
  }

  function checkGate(name) {
    const gate = community(name).gate;
    if (!gate) return { ok: true };
    const held = typeof MNY !== 'undefined' ? MNY.spendable(gate.coin) : ((wallet() || {})[gate.coin] || 0);
    return { ok: held >= gate.min, held, need: gate.min, coin: gate.coin };
  }

  /* ── Creator payment page ───────────────────────────────────────── */
  function openCreatorPage(handle, name) {
    closeCreatorPage();
    const sub = subscriptionFor(handle);
    const initials = (name || handle).replace('@', '').split(/[\s_]/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

    const tierCards = Object.entries(TIERS).map(([key, t]) => `
      <div class="sf-tier${sub && sub.tier === key ? ' active' : ''}">
        <div class="sf-tier-head">
          <span class="sf-tier-name">${t.label}</span>
          <span class="sf-tier-price">$${t.price}<span>/mo</span></span>
        </div>
        <ul class="sf-tier-perks">${t.perks.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        ${sub && sub.tier === key
          ? `<button class="btn btn-ghost btn-sm w100" onclick="SF.cancelSubscription('${esc(handle)}'); SF.closeCreatorPage()">Cancel</button>`
          : `<button class="btn btn-primary btn-sm w100" onclick="SF.subscribe('${esc(handle)}','${esc(name)}','${key}')">Subscribe</button>`}
      </div>`).join('');

    const el = document.createElement('div');
    el.id = 'sf-creator-overlay';
    el.className = 'sf-overlay';
    el.onclick = e => { if (e.target === el) closeCreatorPage(); };
    el.innerHTML = `
      <div class="card sf-creator-card">
        <button class="icon-btn sf-close" onclick="SF.closeCreatorPage()" aria-label="Close"><span class="material-symbols-rounded">close</span></button>
        <div class="sf-creator-head">
          <div class="avatar av-lg" style="background:var(--g-brand); display:grid; place-items:center; color:#fff; font-weight:800">${esc(initials)}</div>
          <div>
            <h3 class="fw9 tc-1 m0">${esc(name)}</h3>
            <div class="fs12 tc-3">${esc(handle)}</div>
            ${sub ? `<span class="sf-badge">${TIERS[sub.tier].label} subscriber</span>` : ''}
          </div>
        </div>

        <div class="sf-pay-row">
          <button class="btn btn-primary" onclick="SF.closeCreatorPage(); openTipModal('${esc(name)}','${esc(handle)}')">
            <span class="material-symbols-rounded ms-16">volunteer_activism</span> Tip
          </button>
          <button class="btn btn-ghost" onclick="SF.support('${esc(handle)}','${esc(name)}')">
            <span class="material-symbols-rounded ms-16">favorite</span> Support
          </button>
          ${followBtn(handle, name)}
        </div>

        <div class="sf-sec-title">Subscriptions</div>
        <div class="sf-tiers">${tierCards}</div>
        <div class="fs11 tc-3 mt12" style="text-align:center">
          Creators keep <b class="tc-1">90%</b> · platform fee <b class="tc-1">10%</b>
        </div>
      </div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('open'), 20);
  }

  function closeCreatorPage() {
    const el = document.getElementById('sf-creator-overlay');
    if (el) { el.classList.remove('open'); setTimeout(() => el.remove(), 220); }
  }

  /* One-off support payment, straight from the wallet. */
  function support(handle, name) {
    if (!debitWallet('USDT', 1)) { toast('Insufficient USDT ❌'); return; }
    accrueEngagement('subscribe');
    rep('gave_tip');
    save();
    toast(`Sent $1 of support to ${name} 💜`);
    if (typeof updateWalletUI === 'function') updateWalletUI();
  }

  /* ── Dashboard panel ────────────────────────────────────────────── */
  const isPanelOpen = () => !!document.getElementById('sf-panel');

  function refreshOpenPanel() { if (isPanelOpen()) paintPanel(); }

  function openPanel() {
    if (isPanelOpen()) { closePanel(); return; }
    const el = document.createElement('div');
    el.id = 'sf-panel';
    el.className = 'sf-panel';
    document.body.appendChild(el);
    const scrim = document.createElement('div');
    scrim.id = 'sf-scrim';
    scrim.className = 'sf-scrim';
    scrim.onclick = closePanel;
    document.body.appendChild(scrim);
    paintPanel();
    setTimeout(() => { el.classList.add('open'); scrim.classList.add('open'); }, 20);
  }

  function closePanel() {
    const p = document.getElementById('sf-panel'), s = document.getElementById('sf-scrim');
    if (p) { p.classList.remove('open'); setTimeout(() => p.remove(), 260); }
    if (s) { s.classList.remove('open'); setTimeout(() => s.remove(), 260); }
  }

  function paintPanel() {
    const p = document.getElementById('sf-panel');
    if (!p) return;
    const tier = repTier();
    const score = repScore();
    const next = REP_TIERS.find(t => t.min > score);
    const pct = next ? Math.round((score / next.min) * 100) : 100;
    const b = wallet() || {};

    const earnRows = S_SF.earnLedger.slice(0, 7).map(e => `
      <div class="sf-row"><span>${esc(e.label)}</span><span class="sf-pos">+${fmt(e.amount)}</span></div>`).join('')
      || '<div class="sf-empty">Nothing earned yet — post, comment or check in.</div>';

    const subRows = S_SF.subscriptions.map(s => `
      <div class="sf-row">
        <span>${esc(s.name)} <b class="tc-3">· ${TIERS[s.tier].label}</b></span>
        <span><b>$${s.price}</b>/mo <button class="sf-x" onclick="SF.cancelSubscription('${esc(s.handle)}')" title="Cancel">✕</button></span>
      </div>`).join('') || '<div class="sf-empty">No active subscriptions.</div>';

    const followRows = S_SF.following.slice(0, 6).map(f => `
      <div class="sf-row"><span>${esc(f.name)}</span><span class="tc-3 fs11">${esc(f.handle)}</span></div>`).join('')
      || '<div class="sf-empty">You are not following anyone yet.</div>';

    const repRows = repBreakdown().slice(0, 5).map(([t, w]) => `
      <div class="sf-row"><span>${esc(t.replace(/_/g, ' '))}</span><span class="sf-pos">${w}</span></div>`).join('')
      || '<div class="sf-empty">No reputation events yet.</div>';

    p.innerHTML = `
      <div class="sf-head">
        <div>
          <div class="sf-kicker">SOCIALFI</div>
          <h3 class="sf-title">Creator Dashboard</h3>
        </div>
        <button class="icon-btn" onclick="SF.closePanel()" aria-label="Close"><span class="material-symbols-rounded ms-18">close</span></button>
      </div>

      <div class="sf-hero">
        <div class="sf-hero-row">
          <div>
            <div class="sf-hero-lbl">Reputation</div>
            <div class="sf-hero-val">${score}</div>
            <div class="sf-tier-chip" style="color:${tier.color}; border-color:${tier.color}">${tier.name}</div>
          </div>
          <div style="text-align:right">
            <div class="sf-hero-lbl">TREND balance</div>
            <div class="sf-hero-val">${fmt(b.TREND || 0)}</div>
            <div class="fs11 tc-3">${fmt(earnedTotal())} earned all-time</div>
          </div>
        </div>
        <div class="sf-bar"><div class="sf-bar-fill" style="width:${pct}%"></div></div>
        <div class="fs11 tc-3 mt4">${next ? `${next.min - score} points to ${next.name}` : 'Top tier reached'}</div>
      </div>

      <div class="sf-sec">
        <div class="sf-sec-hd"><span class="material-symbols-rounded ms-16">savings</span> Creator Rewards</div>
        <div class="sf-sec-sub">Engagement on your posts pays out 90% to you, 10% to the platform.</div>
        <div class="sf-pool">
          <div><div class="sf-pool-val">${fmt(S_SF.creatorPool)}</div><div class="fs11 tc-3">unclaimed TREND</div></div>
          <div style="text-align:right"><div class="fs12 tc-3">platform fee</div><div class="fs12 tc-1">${fmt(S_SF.platformFees)}</div></div>
        </div>
        <button class="btn btn-primary w100 mt8" onclick="SF.claimCreatorRewards()">Claim rewards</button>
      </div>

      <div class="sf-sec">
        <div class="sf-sec-hd"><span class="material-symbols-rounded ms-16">bolt</span> Social-to-Earn</div>
        <div class="sf-sec-sub">Rewarded for contributing. Daily caps keep it from paying out spam.</div>
        <button class="btn btn-ghost btn-sm w100 mb8" onclick="SF.checkin()">
          ${S_SF.lastCheckin === today() ? '✓ Checked in today' : 'Daily check-in · +1 TREND'}
        </button>
        ${earnRows}
      </div>

      <div class="sf-sec">
        <div class="sf-sec-hd"><span class="material-symbols-rounded ms-16">workspace_premium</span> Reputation sources</div>
        ${repRows}
      </div>

      <div class="sf-sec">
        <div class="sf-sec-hd"><span class="material-symbols-rounded ms-16">card_membership</span> Subscriptions</div>
        ${subRows}
      </div>

      <div class="sf-sec">
        <div class="sf-sec-hd"><span class="material-symbols-rounded ms-16">group</span> Following · ${S_SF.following.length}</div>
        ${followRows}
      </div>`;
  }

  /* ── Boot ───────────────────────────────────────────────────────── */
  function init() {
    const actions = document.querySelector('.header-actions');
    if (actions && !document.getElementById('sf-pill')) {
      const pill = document.createElement('button');
      pill.id = 'sf-pill';
      pill.className = 'sf-pill';
      pill.setAttribute('aria-label', 'Creator dashboard');
      pill.title = 'Creator dashboard — reputation, rewards, subscriptions';
      pill.innerHTML = `<span class="material-symbols-rounded ms-16">workspace_premium</span><span class="sf-pill-val">${repScore()}</span>`;
      pill.onclick = openPanel;
      actions.insertBefore(pill, actions.firstChild);
    }
    paintPill();
    paintFollowButtons();
  }

  function paintPill() {
    const el = document.getElementById('sf-pill');
    if (!el) return;
    const v = el.querySelector('.sf-pill-val');
    if (v) v.textContent = repScore();
    el.dataset.tier = repTier().name.toLowerCase();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    // reputation
    rep, repScore, repTier, repBreakdown,
    // earning
    earn, checkin, earnedTotal,
    // creator rewards
    accrueEngagement, claimCreatorRewards,
    // follow
    toggleFollow, isFollowing, followBtn, paintFollowButtons,
    // reposts
    repost, hasReposted,
    // subscriptions
    subscribe, cancelSubscription, isSubscribed, subscriptionFor, TIERS,
    // communities
    fundCommunity, claimCommunityReward, setGate, checkGate, community,
    // creator page
    openCreatorPage, closeCreatorPage, support,
    // panel
    openPanel, closePanel,
    get state() { return S_SF; }
  };
})();

window.SF = SF;
