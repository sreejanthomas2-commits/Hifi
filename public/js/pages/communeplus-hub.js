/* ╔══════════════════════════════════════════════════════════════════╗
   ║  COMMUNE HUB+ — hub screens                                       ║
   ║                                                                   ║
   ║  For You · Rising · Following · Nearby Interests · Trend Radar ·  ║
   ║  Passport — added beside Discover, Joined, Trending, Categories.  ║
   ║                                                                   ║
   ║  CPX is shared with communeplus-community.js, which adds the      ║
   ║  community tabs. Everything is drawn from CPM and CMD.            ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CPX = (() => {

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const $ = id => document.getElementById(id);
  const compact = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
    : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(Math.round(n || 0)));
  const money = n => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString();
  function ago(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 0) { const f = -s; return f < 3600 ? 'in ' + Math.max(1, Math.round(f / 60)) + 'm' : f < 86400 ? 'in ' + Math.round(f / 3600) + 'h' : 'in ' + Math.round(f / 86400) + 'd'; }
    if (s < 60) return Math.max(1, s) + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 604800) return Math.floor(s / 86400) + 'd';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  const when = ts => new Date(ts).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const initials = n => String(n || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = s => { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) % 360; return h; };
  const av = (name, handle, size) => `<span class="hub-av${window.PME && PME.isMe(handle) ? ' pme-me' : ''}" style="--h:${hue(handle || name)};${size ? `width:${size}px;height:${size}px;font-size:${Math.round(size / 2.6)}px` : ''}">${esc(initials(name))}</span>`;
  const short = h => h ? h.slice(0, 10) + '…' + h.slice(-6) : '';
  const ico = (n, cls) => `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}">${n}</span>`;
  const cico = c => (window.CCR && c) ? CCR.icon(c) : ico((c && c.icon) || 'groups');
  function linkify(t) {
    return esc(t)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, '$1<span class="hub-tag">#$2</span>')
      .replace(/(^|\s)@([\p{L}\p{N}_.]+)/gu, '$1<span class="hub-men">@$2</span>');
  }
  const modal = (t, b, wide) => HUB.modal(t, b, wide);
  const closeModal = () => HUB.closeModal();

  /* Repaint without throwing the reader back to the top. */
  function repaint() {
    const sc = document.querySelector('#hub-root .hub') || document.querySelector('#hub-body .hub-scroll') || document.querySelector('#cst-main');
    const top = sc ? sc.scrollTop : 0;
    const cls = sc ? sc.className : '';
    HUB.paint();
    const again = cls ? document.querySelector('#hub-root .' + cls.split(' ')[0]) : null;
    if (again) again.scrollTop = top;
  }

  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async function copy(text, label) {
    try { await navigator.clipboard.writeText(text); toast((label || 'Copied') + ' ✓'); }
    catch (e) { toast(text); }
  }

  const ui = { limit: 12, open: null, radarWeb3: true };

  /* ══════════════════════════════════════════════════════════════════
     Hub tabs
     ══════════════════════════════════════════════════════════════════ */

  const HUB_TABS = [
    ['foryou', 'For You', 'auto_awesome'], ['rising', 'Rising', 'rocket'], ['following', 'Following', 'favorite'],
    ['nearby', 'Nearby Interests', 'explore_nearby'], ['radar', 'Trend Radar', 'radar'], ['passport', 'Passport', 'badge']
  ];
  const isHubTab = t => HUB_TABS.some(x => x[0] === t);

  function hubTabsHTML(tab) {
    return `<span class="cpx-tabsep"></span>` + HUB_TABS.map(([k, l, i]) =>
      `<button class="hub-tab plus${tab === k ? ' on' : ''}" onclick="HUB.hubTab('${k}')">${ico(i)}${l}</button>`).join('');
  }

  function hubBody(tab) {
    try {
      switch (tab) {
        case 'foryou':    return forYouHTML();
        case 'rising':    return risingHTML();
        case 'following': return followingHTML();
        case 'nearby':    return nearbyHTML();
        case 'radar':     return radarHTML();
        case 'passport':  return passportHTML();
      }
    } catch (e) {
      console.error(e);
      return `<div class="hub-empty">${ico('error')}<p>This view hit a problem: ${esc(e.message)}</p></div>`;
    }
    return '';
  }
  function wireHub() { /* inline handlers only */ }

  function lanesHTML() {
    const lane = CPM.state().lane || 'all';
    return `<div class="cpx-lanes">${CPM.LANES.map(([k, l, i]) =>
      `<button class="cpx-lane${lane === k ? ' on' : ''}" onclick="CPX.setLane('${k}')">${ico(i)}${l}</button>`).join('')}</div>`;
  }
  const setLane = l => { CPM.setLane(l); ui.limit = 12; repaint(); };

  /* ── Posts ───────────────────────────────────────────────────────── */
  function postHTML(it, opts) {
    const c = it.community || CMD.byId(it.cid);
    const liked = it.fid ? !!(CMD.feed(it.cid).find(p => p.id === it.fid) || {}).liked : CPM.likedByMe(it.key);
    const v = CPM.viral(it.key);
    const vs = CPM.viralScore(it);
    const nominated = v && v.noms && v.noms.indexOf(CMD.me().handle) > -1;
    const open = ui.open === it.key;
    const replies = CPM.replyList(it.key);
    const joined = CMD.isJoined(it.cid);
    return `
    <article class="cpx-post">
      <header class="cpx-post-h">
        ${av(it.name, it.handle, 38)}
        <div class="cpx-post-who">
          <b>${esc(it.name)}</b>
          <span>${esc(it.handle)} · ${ago(it.ts)}</span>
        </div>
        <button class="cpx-cchip" style="--c:${c.color}" onclick="CPX.openCommunity('${c.id}')">${cico(c)}${esc(c.name)}</button>
        ${!joined ? `<button class="hub-btn sm${CPM.followsCommunity(c.id) ? '' : ' primary'}" onclick="CPX.followCommunity('${c.id}')">${CPM.followsCommunity(c.id) ? 'Following' : 'Follow'}</button>` : ''}
      </header>
      ${it.title ? `<h4 class="cpx-post-title">${esc(it.title)}</h4>` : ''}
      <p class="cpx-post-b">${linkify(it.text)}</p>
      ${opts && opts.why === false ? '' : `<div class="cpx-why">${ico('info')}<span>${esc((it.reasons || []).slice(0, 2).join(' · '))}</span></div>`}
      <footer class="cpx-post-a">
        <button class="hub-act${liked ? ' on' : ''}" onclick="CPX.like('${it.key}')">${ico('favorite')}${compact(CPM.likeCount(it))}</button>
        <button class="hub-act${open ? ' sel' : ''}" onclick="CPX.toggleReplies('${it.key}')">${ico('mode_comment')}${compact(CPM.replyCount(it))}</button>
        <button class="hub-act${nominated ? ' sel' : ''}" onclick="CPX.nominate('${it.key}')" title="Nominate for the Trending feed">${ico('rocket_launch')}${nominated ? 'Nominated' : 'Nominate'}</button>
        <button class="hub-act" onclick="CPX.share('${it.key}')">${ico('share')}</button>
        <span class="cpx-post-gap"></span>
        ${v && v.status === 'published' ? `<span class="cpx-pill hot">${ico('local_fire_department')}In Trending</span>`
          : vs >= CPM.VIRAL_AT ? `<span class="cpx-pill warm" title="Viral score ${vs}">${ico('trending_up')}Trending-eligible</span>` : ''}
      </footer>
      ${open ? `<div class="cpx-replies">
        ${replies.map(r => `<div class="cpx-reply">${av(r.name, r.handle, 26)}<div><b>${esc(r.name)}</b> <span>${ago(r.ts)}</span><p>${linkify(r.text)}</p></div></div>`).join('')
          || `<p class="hub-none sm">${it.replies ? it.replies + ' earlier replies live in the community. ' : ''}Be the first to reply here.</p>`}
        <div class="cpx-reply-in">
          <input id="cpx-r-${esc(it.key.replace(/[^a-z0-9]/gi, '_'))}" placeholder="Write a reply" onkeydown="if(event.key==='Enter')CPX.reply('${it.key}')">
          <button class="hub-btn primary sm" onclick="CPX.reply('${it.key}')">Reply</button>
        </div>
      </div>` : ''}
    </article>`;
  }

  const like = key => { CPM.like(key); repaint(); };
  const toggleReplies = key => { ui.open = ui.open === key ? null : key; repaint(); setTimeout(() => { const el = $('cpx-r-' + key.replace(/[^a-z0-9]/gi, '_')); if (el) el.focus(); }, 30); };
  function reply(key) {
    const el = $('cpx-r-' + key.replace(/[^a-z0-9]/gi, '_'));
    if (!el) return;
    const r = CPM.reply(key, el.value);
    if (r.error) { toast(r.error); return; }
    repaint();
    setTimeout(() => { const n = $('cpx-r-' + key.replace(/[^a-z0-9]/gi, '_')); if (n) n.focus(); }, 30);
  }
  function nominate(key) {
    const r = CPM.nominate(key);
    if (r.error) { toast(r.error); return; }
    toast(r.on ? (r.eligible ? 'Nominated — this post is now eligible for Trending. A community broadcaster makes the final call.' : 'Nominated for Trending') : 'Nomination removed');
    repaint();
  }
  async function share(key) {
    const it = CPM.feedItems().find(x => x.key === key);
    if (!it) return;
    const url = `${location.origin}${location.pathname}#commune=${it.cid}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Trending — Commune Hub', text: it.text.slice(0, 140), url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    copy(url, 'Community link copied');
  }
  function followCommunity(cid) {
    const on = CPM.followCommunity(cid);
    toast(on ? `Following ${CMD.byId(cid).name} — its posts reach For You and Following` : 'Unfollowed');
    repaint();
  }
  function openCommunity(cid) {
    if (CMD.isJoined(cid)) HUB.open(cid); else HUB.openJoin(cid);
  }

  /* ── For You ─────────────────────────────────────────────────────── */
  function forYouHTML() {
    const lane = CPM.state().lane || 'all';
    const items = CPM.forYou(lane);
    const picks = CPM.picks(lane).slice(0, 5);
    const joinedList = CMD.all().filter(c => CMD.isJoined(c.id));
    const pr = CPM.prefs();
    const w = CPM.wallet();
    const events = CPM.collabs().filter(k => k.event && k.event.start + k.event.mins * 60000 > Date.now()).slice(0, 3);
    return `
    ${lanesHTML()}
    <div class="cpx-2col">
      <div class="cpx-feed">
        ${joinedList.length ? `<div class="hub-compose cpx-compose">
          ${av(CMD.me().name, CMD.me().handle, 38)}
          <div class="hub-compose-b">
            <textarea id="cpx-fy-text" rows="2" placeholder="Share something with one of your communities — #hashtags feed Trend Radar"></textarea>
            <div class="hub-compose-a">
              <select id="cpx-fy-cid" class="cst-sel">${joinedList.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
              <label class="hub-check"><input type="checkbox" id="cpx-fy-nom"> Nominate for Trending</label>
              <button class="hub-btn primary sm" onclick="CPX.postForYou()">Post</button>
            </div>
          </div>
        </div>` : `<div class="cpx-hint">${ico('group_add')}<span>Join or follow a community and For You starts learning what you care about.</span>
          <button class="hub-btn sm" onclick="HUB.hubTab('discover')">Discover</button></div>`}
        ${items.slice(0, ui.limit).map(it => postHTML(it)).join('') || `<div class="hub-empty">${ico('dynamic_feed')}<p>Nothing in this lane yet.</p></div>`}
        ${items.length > ui.limit ? `<button class="hub-btn wide" onclick="CPX.more()">Show more · ${items.length - ui.limit} left</button>` : ''}
      </div>

      <aside class="cpx-side">
        <section class="hub-panel">
          <h3 class="hub-h3">${ico('recommend')}Picked for you</h3>
          ${picks.map(({ c, reasons }) => `<div class="cpx-pick">
            <span class="hub-card-icon sm" style="--c:${c.color}">${cico(c)}</span>
            <div><b>${esc(c.name)}</b><span>${esc(reasons[0])}</span></div>
            <button class="hub-btn sm primary" onclick="HUB.openJoin('${c.id}')">Join</button>
          </div>`).join('') || '<p class="hub-none">You have joined everything in this lane.</p>'}
        </section>

        ${events.length ? `<section class="hub-panel">
          <h3 class="hub-h3">${ico('diversity_3')}Across communities</h3>
          ${events.map(k => `<button class="cpx-xev" onclick="CPX.openCollab('${k.id}')">
            <b>${esc(k.event.title)}</b>
            <span>${k.communities.map(id => esc((CMD.byId(id) || {}).name || id)).join(' × ')}</span>
            <i>${k.event.start < Date.now() ? '<em class="hub-livepill">LIVE</em>' : when(k.event.start)}</i>
          </button>`).join('')}
        </section>` : ''}

        <section class="hub-panel">
          <h3 class="hub-h3">${ico('tune')}Tune your feed</h3>
          <p class="hub-none sm">${pr.interests.length ? 'Interests: ' + pr.interests.map(k => (CPM.INTERESTS.find(x => x[0] === k) || [k, k])[1]).join(', ') : 'No interests picked — ranking uses your communities and what is popular.'}</p>
          <p class="hub-none sm">Wallet personalisation: <b>${pr.wallet ? (w ? 'on' + (w.simulated ? ' (demo wallet)' : '') : 'on, no wallet connected') : 'off'}</b></p>
          <button class="hub-btn sm" onclick="CPX.openTune()">${ico('tune')}Tune</button>
          <p class="hub-none sm cpx-mt">Every post says why it is here. Ranking runs on this device.</p>
        </section>

        <section class="hub-panel">
          <h3 class="hub-h3">${ico('radar')}Rising topics</h3>
          ${CPM.radar({ limit: 5, web3: true }).map(t => `<div class="cpx-trow"><span class="hub-tag">#${esc(t.tag)}</span><b class="${t.growth >= 0 ? 'up' : 'down'}">${t.growth >= 0 ? '+' : ''}${t.growth}%</b></div>`).join('')}
          <button class="hub-btn sm cpx-mt" onclick="HUB.hubTab('radar')">Open Trend Radar</button>
        </section>
      </aside>
    </div>`;
  }

  const more = () => { ui.limit += 12; repaint(); };

  function postForYou() {
    const text = ($('cpx-fy-text') || {}).value || '';
    const cid = ($('cpx-fy-cid') || {}).value;
    if (!text.trim() || !cid) { toast('Write something first.'); return; }
    const res = CMD.addFeed(cid, text);
    if (res && res.error) { toast(res.error); return; }
    CPM.touch();
    if (($('cpx-fy-nom') || {}).checked) CPM.nominate(`cf:${cid}:${res.id}`);
    toast(`Posted to ${CMD.byId(cid).name}`);
    repaint();
  }

  function openTune() {
    const pr = CPM.prefs();
    const w = CPM.wallet();
    modal('Tune your feed', `
      <h4 class="hub-h4">What are you into?</h4>
      <div class="hub-chips" id="cpx-tune-int">
        ${CPM.INTERESTS.map(([k, l]) => `<button class="hub-chip${pr.interests.indexOf(k) > -1 ? ' on' : ''}" data-k="${k}" onclick="this.classList.toggle('on')">${esc(l)}</button>`).join('')}
      </div>
      <h4 class="hub-h4">Wallet personalisation — optional</h4>
      <label class="cst-rule"><input type="checkbox" id="cpx-tune-w" ${pr.wallet ? 'checked' : ''}>
        <b>Use my connected wallet to suggest Web3 communities</b>
        <span>Reads only which networks your wallets are on. No transactions, no history, nothing leaves this device.
          ${w ? `Connected: ${esc(w.label)}${w.simulated ? ' (demo)' : ''}.` : 'No wallet connected — nothing to read.'}</span></label>
      <label class="cst-rule"><input type="checkbox" id="cpx-tune-t" ${pr.web3Trends ? 'checked' : ''}>
        <b>Show Web3 ecosystem trends</b><span>Topics only — Trend Radar never shows prices or trade calls.</span></label>
      <button class="hub-btn primary wide" onclick="CPX.saveTune()">Save</button>`);
  }
  function saveTune() {
    const interests = Array.from(document.querySelectorAll('#cpx-tune-int .hub-chip.on')).map(b => b.dataset.k);
    CPM.setPrefs({ interests, wallet: !!($('cpx-tune-w') || {}).checked, web3Trends: !!($('cpx-tune-t') || {}).checked });
    closeModal();
    repaint();
    toast('Feed tuned');
  }

  /* ── Rising ──────────────────────────────────────────────────────── */
  function spark(points, color) {
    const max = Math.max(...points), min = Math.min(...points);
    const d = points.map((v, i) => `${(i / (points.length - 1)) * 100},${28 - ((v - min) / Math.max(1, max - min)) * 24}`).join(' ');
    return `<svg class="cpx-spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="${d}" fill="none" stroke="${color}" stroke-width="2.2" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function communityCard(c, extra) {
    const joined = CMD.isJoined(c.id);
    const follows = CPM.followsCommunity(c.id);
    return `<article class="cpx-ccard">
      <div class="cpx-ccard-h">
        <span class="hub-card-icon sm" style="--c:${c.color}">${cico(c)}</span>
        <div><b>${esc(c.name)}${c.verified ? ico('verified', 'hub-verif') : ''}</b><span>${compact(CMD.memberCount(c.id))} members · ${esc((CMD.CATEGORIES.find(x => x[0] === c.category) || ['', c.category])[1])}</span></div>
      </div>
      ${extra || ''}
      <p class="hub-card-desc">${esc(c.desc)}</p>
      <div class="cpx-ccard-a">
        <button class="hub-btn sm${joined ? '' : ' primary'}" onclick="CPX.openCommunity('${c.id}')">${joined ? 'Open' : 'Join'}</button>
        ${joined ? '' : `<button class="hub-btn sm" onclick="CPX.followCommunity('${c.id}')">${ico(follows ? 'check' : 'add')}${follows ? 'Following' : 'Follow'}</button>`}
      </div>
    </article>`;
  }

  function risingHTML() {
    const lane = CPM.state().lane || 'all';
    const list = CPM.rising(lane);
    return `${lanesHTML()}
      <p class="hub-sub cpx-note">${ico('info')}Growth over the last seven days. Seeded communities include demo growth; your activity, follows and support add to it.</p>
      <div class="cpx-grid">${list.map(({ c, g }, i) => communityCard(c, `
        <div class="cpx-grow">
          <span class="cpx-rank">#${i + 1}</span>
          <b class="${g.pct >= 0 ? 'up' : 'down'}">${g.pct >= 0 ? '+' : ''}${g.pct}%</b>
          ${spark(g.spark, g.pct >= 0 ? 'var(--green, #1A9E6C)' : 'var(--red, #E5484D)')}
          <span>~${compact(g.newMembers)} new</span>
        </div>`)).join('')}</div>`;
  }

  /* ── Following ───────────────────────────────────────────────────── */
  function followingHTML() {
    const lane = CPM.state().lane || 'all';
    const f = CPM.follows();
    const items = CPM.followingFeed(lane);
    const joinedList = CMD.all().filter(c => CMD.isJoined(c.id));
    return `${lanesHTML()}
      <section class="hub-panel">
        <h3 class="hub-h3">${ico('favorite')}You follow</h3>
        <div class="hub-chips">
          ${joinedList.map(c => `<button class="cpx-cchip" style="--c:${c.color}" onclick="HUB.open('${c.id}')">${cico(c)}${esc(c.name)}<i>joined</i></button>`).join('')}
          ${f.communities.map(id => CMD.byId(id)).filter(Boolean).map(c => `<span class="cpx-cchip" style="--c:${c.color}">${cico(c)}${esc(c.name)}
            <button class="cpx-x" onclick="CPX.followCommunity('${c.id}')" title="Unfollow">${ico('close')}</button></span>`).join('')}
          ${f.people.map(p => `<span class="cpx-cchip person">${av(p.name, p.handle, 20)}${esc(p.name)}
            <button class="cpx-x" onclick="CPX.followPerson('${esc(p.handle)}','${esc(p.name)}')" title="Unfollow">${ico('close')}</button></span>`).join('')}
        </div>
        ${!joinedList.length && !f.communities.length && !f.people.length ? '<p class="hub-none">Follow a community from For You or Rising, or a person from their profile — following is lighter than joining.</p>' : ''}
      </section>
      <div class="cpx-feed narrow">
        ${items.slice(0, ui.limit).map(it => postHTML(it, { why: false })).join('') || `<div class="hub-empty">${ico('favorite')}<p>Posts from communities and people you follow land here, newest first.</p></div>`}
        ${items.length > ui.limit ? `<button class="hub-btn wide" onclick="CPX.more()">Show more</button>` : ''}
      </div>`;
  }
  function followPerson(handle, name) {
    const on = CPM.followPerson(handle, name);
    toast(on ? `Following ${name}` : `Unfollowed ${name}`);
    repaint();
  }

  /* ── Nearby Interests ────────────────────────────────────────────── */
  function nearbyHTML() {
    const list = CPM.nearby();
    if (!list.length) {
      return `<div class="hub-empty">${ico('explore_nearby')}<p>Nearby Interests maps outward from the communities you join or follow. Join one and this fills in.</p>
        <button class="hub-btn primary" onclick="HUB.hubTab('discover')">Discover communities</button></div>`;
    }
    return `<p class="hub-sub cpx-note">${ico('hub')}Communities one step from yours — shared tags, the same interest area, or an active collaboration.</p>
      <div class="cpx-grid">${list.map(n => communityCard(n.c, `<div class="cpx-via">${ico('conversion_path')}<span>${esc(n.why)}</span></div>`)).join('')}</div>`;
  }

  /* ── Trend Radar ─────────────────────────────────────────────────── */
  const SECTORS = ['crypto', 'gaming', 'tech', 'finance', 'science', 'creator', 'music', 'sports'];
  const SECTOR_OF = { brand: 'tech', learning: 'science' };

  function radarHTML() {
    const web3 = CPM.prefs().web3Trends !== false && ui.radarWeb3;
    const list = CPM.radar({ web3, limit: 24 });
    const S = 380, C = S / 2;
    const maxG = Math.max(1, ...list.map(t => t.growth));
    const pos = t => {
      const sec = SECTORS.indexOf(SECTOR_OF[t.cat] || t.cat);
      const r0 = CPM.sha256(t.tag);
      const jitter = (parseInt(r0.slice(0, 4), 16) / 65535 - 0.5) * (Math.PI / 5);
      const ang = ((sec < 0 ? 0 : sec) + 0.5) / SECTORS.length * Math.PI * 2 - Math.PI / 2 + jitter;
      const rad = 34 + Math.max(0, t.growth) / maxG * 118;
      return [C + Math.cos(ang) * rad, C + Math.sin(ang) * rad];
    };
    const sectorLines = SECTORS.map((s, i) => {
      const a = i / SECTORS.length * Math.PI * 2 - Math.PI / 2;
      const la = (i + 0.5) / SECTORS.length * Math.PI * 2 - Math.PI / 2;
      const label = (CPM.LANES.find(l => l[0] === s) || ['', s])[1];
      return `<line x1="${C}" y1="${C}" x2="${C + Math.cos(a) * 176}" y2="${C + Math.sin(a) * 176}" class="cpx-rad-l"/>
        <text x="${C + Math.cos(la) * 184}" y="${C + Math.sin(la) * 184}" class="cpx-rad-sec" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
    }).join('');
    const dots = list.map((t, i) => {
      const [x, y] = pos(t);
      const r = 4 + Math.min(9, t.volume / 1.5);
      return `<g class="cpx-rad-dot${t.growth >= 0 ? ' up' : ''}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"><title>#${esc(t.tag)} · ${t.growth >= 0 ? '+' : ''}${t.growth}%</title></circle>
        ${i < 9 ? `<text x="${x.toFixed(1)}" y="${(y - r - 4).toFixed(1)}" text-anchor="middle">#${esc(t.tag)}</text>` : ''}</g>`;
    }).join('');
    return `
    <div class="cpx-radar-wrap">
      <section class="hub-panel cpx-radar-p">
        <div class="cpx-radar-top">
          <h3 class="hub-h3">${ico('radar')}Trend Radar</h3>
          <label class="cst-switch"><input type="checkbox" ${web3 ? 'checked' : ''} onchange="CPX.radarWeb3(this.checked)"><i></i>Web3 ecosystem trends</label>
        </div>
        <svg viewBox="-24 -12 ${S + 48} ${S + 24}" class="cpx-radar">
          ${[0.33, 0.66, 1].map(f => `<circle cx="${C}" cy="${C}" r="${34 + f * 118}" class="cpx-rad-ring"/>`).join('')}
          ${sectorLines}${dots}
        </svg>
        <p class="hub-none sm">Distance from the centre is growth; dot size is volume. Built from hashtags and discussion tags across Commune Hub, recent 36 hours against the 108 before. Price-talk words and $tickers are excluded — this is not a trading screen.</p>
      </section>
      <section class="hub-panel">
        <h3 class="hub-h3">${ico('trending_up')}Growing fastest</h3>
        ${list.map((t, i) => `<div class="cpx-trend">
          <span class="cpx-rank">${i + 1}</span>
          <div class="cpx-trend-t"><b>#${esc(t.tag)}</b>
            <span>${t.communities.map(id => esc((CMD.byId(id) || {}).name || id)).join(', ')}</span></div>
          ${t.web3 ? '<span class="hub-chip-s">Web3</span>' : ''}
          <b class="cpx-trend-g ${t.growth >= 0 ? 'up' : 'down'}">${t.growth >= 0 ? '+' : ''}${t.growth}%</b>
          <button class="hub-btn sm" onclick="CPX.openCommunity('${t.communities[0]}')">Open</button>
        </div>`).join('') || '<p class="hub-none">No topics yet.</p>'}
      </section>
    </div>`;
  }
  const radarWeb3 = on => { ui.radarWeb3 = on; CPM.setPrefs({ web3Trends: on }); repaint(); };

  /* ══════════════════════════════════════════════════════════════════
     Passport
     ══════════════════════════════════════════════════════════════════ */

  function passportHTML() {
    const me = CMD.me();
    const cont = CPM.contribution();
    const lv = CPM.level(cont.score);
    const w = CPM.wallet();
    const joined = CMD.all().filter(c => CMD.isJoined(c.id));
    const badges = CPM.badges();
    const proofs = CPM.proofs();
    const vp = CPM.verifyProofs();
    const sig = CPM.signature();
    const skills = CPM.skills();
    const payout = CPM.payout();
    const voted = joined.some(c => CPM.proposals(c.id).some(p => p.votes && p.votes[me.handle]));
    const layer = [
      ['Trending account', true, me.handle, 'person'],
      ['Optional wallet', !!w, w ? `${w.label}${w.simulated ? ' · demo' : ''}` : 'Not connected — not required', 'account_balance_wallet'],
      ['Web3 identity', !!w, CPM.did().slice(0, 26) + (CPM.did().length > 26 ? '…' : ''), 'fingerprint'],
      ['Community membership', joined.length > 0, joined.length + ' communities', 'groups'],
      ['Roles + reputation', CPM.portableRep() > 0 || joined.some(c => CMD.topRole(c.id).level > 10), CPM.portableRep() + ' reputation', 'shield_person'],
      ['Verifiable achievements', badges.length > 0, badges.length + ' credentials', 'military_tech'],
      ['Token / NFT eligibility', joined.some(c => CPM.myPass(c.id)), joined.filter(c => CPM.myPass(c.id)).length + ' passes', 'badge'],
      ['Governance', voted, voted ? 'Voted' : 'No votes yet', 'how_to_vote'],
      ['Optional payments / rewards', CPM.tips().length + CPM.library().length > 0, CPM.tips().length + ' tips · ' + CPM.library().length + ' items', 'volunteer_activism']
    ];
    const PART_LABEL = { messages: 'Messages', threads: 'Thread replies', posts: 'Community posts', topics: 'Discussion topics', comments: 'Comments', solved: 'Solved topics', events: 'Events attended', missions: 'Mission points', proposals: 'Proposals', votes: 'Votes', articles: 'Knowledge articles', moderation: 'Moderation actions', collabs: 'Collab messages', skills: 'Verified skills', endorsements: 'Endorsements given' };

    return `
    <div class="cpx-passport">
      <section class="cpx-pp-head">
        ${av(me.name, me.handle, 76)}
        <div class="cpx-pp-id">
          <h2>${esc(me.name)} <span class="cpx-level">${ico(lv.icon)}${esc(lv.name)}</span></h2>
          <span>${esc(me.handle)}</span>
          <button class="cpx-did" onclick="CPX.copy('${esc(CPM.did())}','DID copied')" title="Copy decentralised identifier">${ico('fingerprint')}<code>${esc(CPM.did())}</code></button>
          <div class="cpx-lvbar"><i style="width:${lv.pct}%"></i></div>
          <span class="hub-none sm">${lv.next ? `${cont.score} / ${lv.next.at} to ${lv.next.name}` : 'Top level reached'}</span>
        </div>
        <div class="cpx-pp-stats">
          <div><b>${compact(cont.score)}</b><span>Contribution score</span></div>
          <div><b>${compact(CPM.portableRep())}</b><span>Portable reputation</span></div>
          <div><b>${joined.length}</b><span>Communities</span></div>
          <div><b>${badges.length}</b><span>Credentials</span></div>
        </div>
        <div class="cpx-pp-a">
          <button class="hub-btn" onclick="CPX.exportPassport()">${ico('download')}Export passport</button>
          ${w ? '' : `<button class="hub-btn" onclick="WL.openChooser()">${ico('account_balance_wallet')}Connect wallet (optional)</button>`}
        </div>
      </section>

      <section class="hub-panel">
        <h3 class="hub-h3">${ico('stacks')}Your Web3 layer <span class="hub-none sm cpx-ml">everything after your account is optional</span></h3>
        <div class="cpx-layer">${layer.map(([l, ok, s, i], n) => `
          <div class="cpx-step${ok ? ' ok' : ''}"><span class="cpx-step-n">${ok ? ico('check') : n + 1}</span>
            <div><b>${ico(i)}${esc(l)}</b><span>${esc(s)}</span></div></div>`).join(`<span class="cpx-step-arrow">${ico('south')}</span>`)}</div>
      </section>

      <div class="cpx-cols">
        <section class="hub-panel">
          <h3 class="hub-h3">${ico('travel_explore')}Multi-community passport</h3>
          <div class="cpx-stamps">${joined.map(c => {
            const role = CMD.topRole(c.id);
            const pass = CPM.myPass(c.id);
            return `<button class="cpx-stamp" style="--c:${c.color}" onclick="HUB.open('${c.id}')">
              <span class="hub-card-icon sm" style="--c:${c.color}">${cico(c)}</span>
              <b>${esc(c.name)}</b>
              <span class="ink" style="color:${role.color}">${esc(role.name)}</span>
              <span>${CMD.rep(c.id)} rep · ${CPM.badges(c.id).length} badges${pass ? ' · pass #' + pass.serial : ''}</span>
            </button>`;
          }).join('') || '<p class="hub-none">Join a community to get your first stamp.</p>'}</div>
        </section>

        <section class="hub-panel">
          <h3 class="hub-h3">${ico('calculate')}Contribution score</h3>
          <div class="cpx-parts">${Object.keys(cont.parts).filter(k => cont.parts[k]).map(k =>
            `<div><span>${PART_LABEL[k]}</span><b>${cont.parts[k]} × ${cont.weights[k]}</b><i>${cont.parts[k] * cont.weights[k]}</i></div>`).join('')
            || '<p class="hub-none">Post, reply, answer, host or vote — every action adds up here.</p>'}</div>
          <div class="cpx-ladder">${CPM.LEVELS.map(([at, name, icon], i) =>
            `<span class="cpx-rung${i <= lv.i ? ' on' : ''}">${ico(icon)}${name}<i>${at}+</i></span>`).join('')}</div>
          <p class="hub-none sm">Reputation earned in any community stays attached to your Trending identity. None of it is a token, and none of it can be bought or traded.</p>
        </section>
      </div>

      <section class="hub-panel">
        <h3 class="hub-h3">${ico('military_tech')}Achievements &amp; credentials</h3>
        <div class="cpx-badges">${badges.map(b => `
          <div class="cpx-badge">
            <span class="cpx-badge-i">${ico(b.icon || 'military_tech')}</span>
            <b>${esc(b.title)}</b>
            <span>${esc(b.issuerName)} · ${new Date(b.issued).toLocaleDateString()}</span>
            <span class="cpx-badge-k">${esc(b.type[1].replace(/([A-Z])/g, ' $1').trim())} · non-transferable</span>
            <button class="hub-act" onclick="CPX.verifyBadge('${b.id}')">${ico('verified_user')}Verify</button>
          </div>`).join('') || '<p class="hub-none">Finish a mission, check in to an event or claim a membership pass to earn your first credential.</p>'}</div>
      </section>

      <div class="cpx-cols">
        <section class="hub-panel">
          <h3 class="hub-h3">${ico('workspace_premium')}Skills</h3>
          ${skills.map(s => `<div class="cst-log"><span class="cst-log-a ${s.status === 'verified' ? '' : s.status === 'declined' ? 'ban' : 'automod'}">${esc(s.status)}</span>
            <b>${esc(s.skill)}</b><span>${esc((CMD.byId(s.cid) || {}).name || '')}${s.via ? ' · via mission' : ''}</span><i>${ago(s.at)}</i></div>`).join('')
            || '<p class="hub-none">Ask a community to recognise a skill — developers, artists, researchers, educators and more.</p>'}
          <button class="hub-btn sm cpx-mt" onclick="CPX.openSkill()" ${joined.length ? '' : 'disabled'}>${ico('add')}Request verification</button>
        </section>

        <section class="hub-panel">
          <h3 class="hub-h3">${ico('link')}Proof-of-contribution</h3>
          <div class="cpx-proofhead ${vp.ok ? 'ok' : 'bad'}">${ico(vp.ok ? 'verified' : 'gpp_bad')}
            <div><b>${vp.count ? (vp.ok ? 'Chain verifies' : 'Chain broken at record ' + vp.at) : 'No records yet'}</b>
              <span>${vp.count} records${vp.root ? ' · root ' + short(vp.root) : ''}</span></div></div>
          ${sig ? `<p class="hub-none sm">${ico('draw')} Signed by ${esc(sig.address.slice(0, 6))}…${esc(sig.address.slice(-4))} over root ${short(sig.root)} (${sig.count} records)${sig.root !== vp.root ? ' — new records since; sign again to cover them' : ''}.</p>` : ''}
          ${proofs.slice(0, 6).map(p => `<div class="cpx-proof"><span class="cst-log-a">${esc(p.kind)}</span><span>${esc(p.summary)}</span><code>${p.hash.slice(0, 10)}</code></div>`).join('')}
          <div class="hub-acts">
            <button class="hub-btn sm" onclick="CPX.checkProofs()">${ico('fact_check')}Verify chain</button>
            <button class="hub-btn sm" onclick="CPX.signProofs()">${ico('draw')}Sign with wallet (optional)</button>
          </div>
          <p class="hub-none sm">Each record is a SHA-256 hash of the one before it, so changing any record breaks every hash after it. Signing asks your wallet to sign plain text — never a transaction. Nothing is written on-chain.</p>
        </section>
      </div>

      <section class="hub-panel">
        <h3 class="hub-h3">${ico('hub')}Reputation graph</h3>
        ${graphSVG(CPM.graph())}
        <p class="hub-none sm">You, the communities you are in, and the people you have replied to, endorsed, followed or tipped. Thicker lines are stronger ties; dashed lines are collaborations between communities.</p>
      </section>

      <div class="cpx-cols">
        <section class="hub-panel">
          <h3 class="hub-h3">${ico('volunteer_activism')}Receiving tips</h3>
          ${payout ? `<p class="hub-guide">Crypto tips can be sent to <code>${esc(payout.address.slice(0, 8))}…${esc(payout.address.slice(-6))}</code> on ${esc(payout.label)}.</p>
            <button class="hub-btn sm danger" onclick="CPX.clearPayout()">Remove address</button>`
            : `<p class="hub-guide">Nobody can send you a crypto tip until you add a receiving address — and it has to be a wallet you actually connected, so a typo or a pasted scam address is impossible.</p>
            <button class="hub-btn sm" onclick="CPX.setPayout()">${ico('add_link')}Use my connected wallet</button>`}
        </section>
        <section class="hub-panel">
          <h3 class="hub-h3">${ico('receipt_long')}Library, tips &amp; pledges</h3>
          ${CPM.library().slice(0, 4).map(l => `<div class="cst-log"><span class="cst-log-a">bought</span><b>${esc(l.title)}</b><span>${l.price ? money(l.price) + ' · ' + esc(l.method) : 'free'}</span><i>${ago(l.at)}</i></div>`).join('')}
          ${CPM.tips().slice(0, 4).map(t => `<div class="cst-log"><span class="cst-log-a">tip</span><b>${esc(t.name)}</b><span>${t.amount} credits</span><i>${ago(t.at)}</i></div>`).join('')}
          ${!CPM.library().length && !CPM.tips().length ? '<p class="hub-none">Nothing yet.</p>' : ''}
          <p class="hub-none sm">All simulated — nothing was charged and no payment details exist anywhere in the app.</p>
        </section>
      </div>
    </div>`;
  }

  function graphSVG(g) {
    const W = 640, H = 340, cx = W / 2, cy = H / 2;
    const comms = g.nodes.filter(n => n.kind === 'community');
    const people = g.nodes.filter(n => n.kind === 'person');
    const P = { me: [cx, cy] };
    comms.forEach((n, i) => { const a = (i / Math.max(1, comms.length)) * Math.PI * 2 - Math.PI / 2; const r = n.outer ? 150 : 105; P[n.id] = [cx + Math.cos(a) * r * 1.7, cy + Math.sin(a) * r * 0.95]; });
    people.forEach((n, i) => { const a = (i / Math.max(1, people.length)) * Math.PI * 2 - Math.PI / 2 + 0.3; P[n.id] = [cx + Math.cos(a) * 290, cy + Math.sin(a) * 150]; });
    if (g.nodes.length === 1) return `<p class="hub-none">Your graph grows as you join communities and interact with people.</p>`;
    const lines = g.edges.filter(e => P[e.a] && P[e.b]).map(e => `<line x1="${P[e.a][0].toFixed(0)}" y1="${P[e.a][1].toFixed(0)}" x2="${P[e.b][0].toFixed(0)}" y2="${P[e.b][1].toFixed(0)}" class="cpx-g-e ${e.kind}" stroke-width="${Math.max(0.8, e.w).toFixed(1)}"/>`).join('');
    const nodes = g.nodes.filter(n => P[n.id]).map(n => {
      const [x, y] = P[n.id];
      const r = n.kind === 'me' ? 22 : n.kind === 'community' ? 15 : 10;
      const label = n.label.length > 16 ? n.label.slice(0, 15) + '…' : n.label;
      return `<g class="cpx-g-n ${n.kind}"><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r}" style="${n.color ? `--c:${n.color}` : ''}"/>
        ${n.verified ? `<circle cx="${(x + r * 0.7).toFixed(0)}" cy="${(y - r * 0.7).toFixed(0)}" r="4.5" class="cpx-g-v"/>` : ''}
        <text x="${x.toFixed(0)}" y="${(y + r + 13).toFixed(0)}" text-anchor="middle">${esc(label)}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H + 20}" class="cpx-graph">${lines}${nodes}</svg>`;
  }

  function verifyBadge(id) { toast(CPM.verifyCredential(id) ? 'Credential verifies — its digest matches its contents ✓' : 'This credential does not match its digest — it was altered.'); }
  function checkProofs() {
    const v = CPM.verifyProofs();
    toast(!v.count ? 'No records yet.' : v.ok ? `All ${v.count} records verify ✓` : `Broken at record ${v.at} — a record was changed.`);
  }
  async function signProofs() {
    const r = await CPM.signRoot();
    toast(r.error || 'Signed — the signature is stored with your passport.');
    if (r.ok) repaint();
  }
  function exportPassport() { download('trending-passport.json', CPM.passportExport()); toast('Passport exported'); }
  function setPayout() { const r = CPM.setPayout(); toast(r.error || 'Receiving address set from your connected wallet'); if (!r.error) repaint(); }
  function clearPayout() { CPM.clearPayout(); repaint(); }

  function openSkill() {
    const joined = CMD.all().filter(c => CMD.isJoined(c.id));
    modal('Request skill verification', `
      <label class="hub-f"><span>Skill</span><select id="cpx-sk-s">${CPM.SKILLS.map(s => `<option>${s}</option>`).join('')}</select></label>
      <label class="hub-f"><span>Community that verifies it</span><select id="cpx-sk-c">${joined.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
      <label class="hub-f"><span>Evidence — an https link or a short description</span><textarea id="cpx-sk-e" rows="3" placeholder="https://github.com/you/project — or what you built and where"></textarea></label>
      <p class="hub-none sm">The community's moderators review it. Some missions verify a skill automatically when approved.</p>
      <button class="hub-btn primary wide" onclick="CPX.submitSkill()">Send request</button>`);
  }
  function submitSkill() {
    const r = CPM.requestSkill(($('cpx-sk-s') || {}).value, ($('cpx-sk-c') || {}).value, ($('cpx-sk-e') || {}).value);
    if (r.error) { toast(r.error); return; }
    closeModal(); repaint();
    toast('Request sent to the moderators');
  }

  /* ── Someone else's public passport ──────────────────────────────── */
  function openPerson(cid, handle) {
    const m = CMD.members(cid).find(x => x.handle === handle);
    if (!m) return;
    const inComms = CMD.all().filter(c => CMD.isJoined(c.id) && CMD.members(c.id).some(x => x.handle === handle));
    const lv = CPM.level(m.rep);
    const endorsed = CPM.endorsedBy(handle);
    const follows = CPM.followsPerson(handle);
    const h = CPM.sha256(handle);
    const demoBadges = ['Helper', 'Conversation Starter', 'Showed Up', 'Voter', 'Librarian', 'Teacher'].filter((_, i) => parseInt(h[i], 16) > 7);
    modal(m.name + ' · passport', `
      <div class="hub-profile">${av(m.name, m.handle, 60)}
        <div><b>${esc(m.name)}</b><span>${esc(m.handle)} · <span class="cpx-level sm">${ico(lv.icon)}${lv.name}</span></span>
          <span>${compact(m.rep)} reputation in ${esc(CMD.byId(cid).name)}</span></div></div>
      <h4 class="hub-h4">Communities you share</h4>
      <div class="hub-chips">${inComms.map(c => { const r = CMD.roleById(c.id, (CMD.members(c.id).find(x => x.handle === handle) || {}).role); return `<span class="cpx-cchip" style="--c:${c.color}">${cico(c)}${esc(c.name)} <i class="ink" style="color:${r.color}">${esc(r.name)}</i></span>`; }).join('')}</div>
      <h4 class="hub-h4">Achievements</h4>
      <div class="hub-chips">${demoBadges.map(b => `<span class="hub-chip-s">${ico('military_tech')}${b}</span>`).join('') || '<span class="hub-none sm">None shown.</span>'}</div>
      <p class="hub-none sm">Demo member — achievements are illustrative. A real passport would list credentials that verify.</p>
      <h4 class="hub-h4">Endorse a skill</h4>
      <div class="hub-chips">${CPM.SKILLS.map(s => `<button class="hub-chip${endorsed.indexOf(s) > -1 ? ' on' : ''}" onclick="CPX.endorse('${cid}','${esc(handle)}','${esc(m.name)}','${s}')">${s}</button>`).join('')}</div>
      <div class="hub-acts">
        <button class="hub-btn${follows ? '' : ' primary'}" onclick="CPX.followPerson('${esc(handle)}','${esc(m.name)}');CPX.openPerson('${cid}','${esc(handle)}')">${ico(follows ? 'check' : 'person_add')}${follows ? 'Following' : 'Follow'}</button>
        <button class="hub-btn" onclick="CPX.openTip('${cid}','${esc(handle)}','${esc(m.name)}')">${ico('volunteer_activism')}Tip creator</button>
      </div>`);
  }
  function endorse(cid, handle, name, skill) {
    const r = CPM.endorse(handle, name, skill);
    if (r.error) { toast(r.error); return; }
    toast(r.on ? `Endorsed ${name} for ${skill}` : 'Endorsement removed');
    openPerson(cid, handle);
  }

  /* ── 17 · Tips ───────────────────────────────────────────────────── */
  function openTip(cid, handle, name) {
    const left = CPM.TIP_CAP - CPM.tipsToday();
    modal('Tip ' + name, `
      <p class="hub-guide">Support ${esc(name)} directly. Tips here are simulated credits — nothing is charged.</p>
      <div class="hub-chips" id="cpx-tip-amt">${[1, 5, 10, 25].map((n, i) => `<button class="hub-chip${i === 1 ? ' on' : ''}" data-n="${n}" onclick="document.querySelectorAll('#cpx-tip-amt .hub-chip').forEach(b=>b.classList.remove('on'));this.classList.add('on')">${n} credits</button>`).join('')}</div>
      <label class="hub-f cpx-mt"><span>Note (optional)</span><input id="cpx-tip-note" maxlength="140" placeholder="Thanks for the breakdown!"></label>
      <div class="cpx-safe">${ico('shield')}<div><b>Crypto tip</b>
        <span>${esc(name)} has not added a verified receiving address, so no address is shown. Trending never displays an address that its owner did not connect themselves, and never sends a transaction for you.</span></div></div>
      <p class="hub-none sm">Daily limit ${CPM.TIP_CAP} credits · ${left} left today. Anyone pressuring you to tip is breaking the rules — report it.</p>
      <button class="hub-btn primary wide" onclick="CPX.sendTip('${cid}','${esc(handle)}','${esc(name)}')">Send tip</button>`);
  }
  function sendTip(cid, handle, name) {
    const on = document.querySelector('#cpx-tip-amt .hub-chip.on');
    const r = CPM.tip(cid, handle, name, on ? +on.dataset.n : 0, ($('cpx-tip-note') || {}).value);
    if (r.error) { toast(r.error); return; }
    closeModal();
    toast(`Tipped ${name} — simulated credits · ${r.left} left today`);
  }

  return {
    // shared helpers for the other Commune Hub+ files
    h: { esc, toast, $, compact, money, ago, when, av, ico, cico, linkify, modal, closeModal, repaint, download, copy, short, spark, communityCard },
    ui, isHubTab, hubTabsHTML, hubBody, wireHub, setLane, more,
    like, toggleReplies, reply, nominate, share, followCommunity, followPerson, openCommunity, postForYou,
    openTune, saveTune, radarWeb3,
    verifyBadge, checkProofs, signProofs, exportPassport, setPayout, clearPayout, openSkill, submitSkill, copy,
    openPerson, endorse, openTip, sendTip
  };
})();

window.CPX = CPX;

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
publish('pages/communeplus-hub.js', {
  CPX: () => CPX
});
