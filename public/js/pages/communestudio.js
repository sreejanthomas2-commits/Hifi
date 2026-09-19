/* ╔══════════════════════════════════════════════════════════════════╗
   ║  COMMUNITY STUDIO — the owner's side of CommuneHub                ║
   ║                                                                   ║
   ║  Overview · Channels · Roles · Members · Moderation · Analytics · ║
   ║  Memberships · Rewards · Integrations · Settings                  ║
   ║                                                                   ║
   ║  Everything here writes to the same model the community reads     ║
   ║  from, so a permission you switch off really does stop the        ║
   ║  button working, a channel you create really appears in the       ║
   ║  sidebar, and AutoMod words you add really block a message.       ║
   ║                                                                   ║
   ║  Analytics counts what this device holds and says so — the        ║
   ║  member totals a seeded community ships with are labelled         ║
   ║  separately from activity you generated.                          ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CST = (() => {

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const $ = id => document.getElementById(id);
  const D = () => CMD.state();
  const compact = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
    : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n || 0));
  const ago = ts => {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    return s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd';
  };

  const NAV = [
    ['overview',    'Overview',     'dashboard'],
    ['content',     'Content',      'article',                true],
    ['channels',    'Channels',     'tag'],
    ['roles',       'Roles',        'shield'],
    ['members',     'Members',      'group'],
    ['moderation',  'Moderation',   'gavel'],
    ['ai',          'AI',           'auto_awesome',           true],
    ['analytics',   'Analytics',    'insights'],
    ['memberships', 'Memberships',  'card_membership'],
    ['monetization','Monetization', 'payments',               true],
    ['rewards',     'Rewards',      'redeem'],
    ['governance',  'Governance',   'how_to_vote',            true],
    ['web3',        'Web3',         'token',                  true],
    ['integrations','Integrations', 'webhook'],
    ['settings',    'Settings',     'settings']
  ];
  // Entries marked true come from Commune Hub+ and only show when it is loaded.

  /* ── Shell ───────────────────────────────────────────────────────── */
  function html(cid) {
    const c = CMD.byId(cid);
    if (!c) return '<div class="hub-none">Community not found.</div>';
    const tab = D().studioTab || 'overview';
    return `
    <div class="cst">
      <aside class="cst-nav">
        <button class="cst-back" onclick="HUB.open('${cid}')"><span class="material-symbols-rounded">arrow_back</span>Back to ${esc(c.name)}</button>
        <div class="cst-nav-h" style="--c:${c.color}">
          <span class="hub-card-icon" style="--c:${c.color}">${window.CCR ? CCR.icon(c) : `<span class="material-symbols-rounded">${esc(c.icon)}</span>`}</span>
          <div><b>${esc(c.name)}</b><span>Community Studio</span></div>
        </div>
        ${NAV.filter(n => !n[3] || window.CPS).map(([k, l, i]) => `<button class="cst-nav-b${tab === k ? ' on' : ''}" onclick="CST.tab('${k}')">
          <span class="material-symbols-rounded">${i}</span>${l}</button>`).join('')}
        <div class="cst-role">Acting as <b class="ink" style="color:${CMD.topRole(cid).color}">${esc(CMD.topRole(cid).name)}</b></div>
      </aside>
      <main class="cst-main" id="cst-main">${body(cid, tab)}</main>
    </div>`;
  }

  function body(cid, tab) {
    switch (tab) {
      case 'channels':     return channels(cid);
      case 'roles':        return rolesTab(cid);
      case 'members':      return membersTab(cid);
      case 'moderation':   return moderation(cid);
      case 'analytics':    return analytics(cid);
      case 'memberships':  return window.CCR ? CCR.studioMemberships(cid) : memberships(cid);
      case 'rewards':      return rewards(cid) + (window.CPS ? CPS.rewardsExtra(cid) : '');
      case 'integrations': return integrations(cid) + (window.CPS ? CPS.integrationsExtra(cid) : '');
      case 'settings':     return settings(cid);
      default:             return (window.CPS && CPS.has(tab)) ? CPS.body(cid, tab) : overview(cid);
    }
  }

  function tab(t) { CMD.setState({ studioTab: t }); repaint(); }
  function repaint() {
    const main = $('cst-main');
    const cid = D().cid;
    if (main) { main.innerHTML = body(cid, D().studioTab || 'overview'); wire(); }
    else if (window.HUB) HUB.paint();
  }

  function head(title, sub, actions) {
    return `<header class="cst-head">
      <div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>
      ${actions ? `<div class="cst-head-a">${actions}</div>` : ''}
    </header>`;
  }

  const lock = perm => `<span class="cst-lock" title="Needs the ${perm} permission"><span class="material-symbols-rounded">lock</span></span>`;

  /* ── Overview ────────────────────────────────────────────────────── */
  function overview(cid) {
    const c = CMD.byId(cid);
    const a = CMD.analytics(cid);
    const health = [
      ['Description written', !!c.desc, 'settings'],
      ['At least six channels', a.channels >= 6, 'channels'],
      ['Rules agreed by members', !!(CMD.membership(cid) || {}).rules, ''],
      ['An event on the calendar', a.events > 0, ''],
      ['AutoMod switched on', CMD.automod(cid).on, 'moderation'],
      ['An invite link out', CMD.invites(cid).length > 0, ''],
      ['A membership tier priced', CMD.tiers(cid).some(t => t.price > 0), 'memberships']
    ];
    const done = health.filter(h => h[1]).length;

    return `
    ${head('Overview', `${esc(c.name)} at a glance — and the jobs still open.`,
      `<button class="hub-btn" onclick="HUB.openInvite()"><span class="material-symbols-rounded">person_add</span>Invite</button>
       <button class="hub-btn primary" onclick="CST.broadcast()"><span class="material-symbols-rounded">campaign</span>Broadcast</button>`)}

    <div class="cst-cards">
      ${[['Members', compact(a.members), 'group'], ['Online now', compact(a.online), 'bolt'],
         ['Messages here', compact(a.msgs), 'forum'], ['Discussions', compact(a.boards), 'topic'],
         ['Events', compact(a.events), 'event'], ['Channels', compact(a.channels), 'tag']]
        .map(([l, v, i]) => `<div class="cst-card"><span class="material-symbols-rounded">${i}</span><b>${v}</b><span>${l}</span></div>`).join('')}
    </div>

    <section class="cst-panel">
      <h3>Community health <span class="cst-pct">${done}/${health.length}</span></h3>
      <div class="cst-health">
        ${health.map(([label, ok, goTab]) => `
          <button class="cst-h-row${ok ? ' ok' : ''}" ${goTab ? `onclick="CST.tab('${goTab}')"` : ''}>
            <span class="material-symbols-rounded">${ok ? 'check_circle' : 'radio_button_unchecked'}</span>${esc(label)}
          </button>`).join('')}
      </div>
    </section>

    <section class="cst-panel">
      <h3>Recent moderation</h3>
      ${CMD.modlog(cid).slice(0, 6).map(e => `<div class="cst-log">
        <span class="cst-log-a">${esc(e.action)}</span>
        <b>${esc(e.target)}</b><span>${esc(e.reason)}</span><i>${ago(e.ts)} ago</i></div>`).join('')
        || '<p class="hub-none">Nothing logged yet.</p>'}
    </section>`;
  }

  function broadcast() {
    const cid = D().cid;
    if (!CMD.can(cid, 'broadcast')) { toast('You need the broadcast permission.'); return; }
    HUB.modal('Community broadcast', `
      <label class="hub-f"><span>Title</span><input id="cst-b-t" placeholder="What has happened?"></label>
      <label class="hub-f"><span>Message</span><textarea id="cst-b-m" rows="5" placeholder="Keep it short — this goes to everyone."></textarea></label>
      <label class="hub-check"><input type="checkbox" id="cst-b-feed" checked> Also publish into the Trending feed</label>
      <p class="hub-none sm">Broadcasts post to the announcements channel and reach every member whose notifications are set to All or Important.</p>
      <button class="hub-btn primary wide" onclick="CST.sendBroadcast()">Send broadcast</button>`);
  }

  function sendBroadcast() {
    const cid = D().cid;
    const t = ($('cst-b-t') || {}).value || '';
    const m = ($('cst-b-m') || {}).value || '';
    if (!m.trim()) { toast('Write the message first.'); return; }
    const res = CMD.post(cid, 'announce', (t ? '**' + t + '**\n' : '') + m.trim());
    if (res && res.error) { toast(res.error); return; }
    if (($('cst-b-feed') || {}).checked) CMD.shareToTrending(cid, m.trim(), t);
    HUB.closeModal();
    toast('Broadcast sent');
    repaint();
  }

  /* ── Channels ────────────────────────────────────────────────────── */
  function channels(cid) {
    const list = CMD.channels(cid);
    const may = CMD.can(cid, 'channels');
    return `
    ${head('Channels', 'Spaces group channels. A channel can be text, announcements, voice, stage, live or a discussion board.',
      may ? `<button class="hub-btn primary" onclick="HUB.openChannelForm('Community')"><span class="material-symbols-rounded">add</span>New channel</button>` : lock('manage channels'))}

    ${CMD.spaces(cid).map(space => `
      <section class="cst-panel">
        <h3>${esc(space)}</h3>
        ${list.filter(ch => ch.space === space).map(ch => {
          const i = list.indexOf(ch);
          return `<div class="cst-chan">
            <span class="material-symbols-rounded">${ch.kind === 'voice' ? 'volume_up' : ch.kind === 'stage' ? 'podium' : ch.kind === 'live' ? 'screen_share' : ch.kind === 'forum' ? 'forum' : ch.kind === 'announce' ? 'campaign' : 'tag'}</span>
            <div class="cst-chan-t">
              <b>${esc(ch.name)}</b>
              <span>${esc(ch.topic || 'No topic')}</span>
            </div>
            <span class="hub-chip-s">${esc(ch.kind)}</span>
            ${ch.private ? `<span class="hub-chip-s" style="color:#FFD60A">${esc(CMD.roleById(cid, ch.role || 'contributor').name)} only</span>` : ''}
            ${ch.slow ? `<span class="hub-chip-s">slow ${ch.slow}s</span>` : ''}
            ${may ? `<div class="cst-chan-a">
              <button class="hub-act" onclick="CST.moveChan(${i},-1)" title="Move up"><span class="material-symbols-rounded">arrow_upward</span></button>
              <button class="hub-act" onclick="CST.moveChan(${i},1)" title="Move down"><span class="material-symbols-rounded">arrow_downward</span></button>
              <button class="hub-act" onclick="CST.editChan(${i})" title="Edit"><span class="material-symbols-rounded">edit</span></button>
              <button class="hub-act danger" onclick="CST.delChan(${i})" title="Delete"><span class="material-symbols-rounded">delete</span></button>
            </div>` : ''}
          </div>`;
        }).join('')}
      </section>`).join('')}`;
  }

  function moveChan(i, dir) {
    const cid = D().cid;
    const list = CMD.channels(cid).slice();
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const [ch] = list.splice(i, 1);
    list.splice(j, 0, ch);
    CMD.saveChannels(cid, list);
    repaint();
  }

  function editChan(i) {
    const cid = D().cid;
    const list = CMD.channels(cid).slice();
    const ch = list[i];
    if (!ch) return;
    HUB.modal('Edit #' + ch.name, `
      <label class="hub-f"><span>Name</span><input id="cst-ce-n" value="${esc(ch.name)}"></label>
      <label class="hub-f"><span>Topic</span><input id="cst-ce-t" value="${esc(ch.topic || '')}"></label>
      <div class="hub-form-row">
        <label class="hub-f"><span>Space</span><input id="cst-ce-s" value="${esc(ch.space)}"></label>
        <label class="hub-f"><span>Slow mode (s)</span><input type="number" id="cst-ce-sl" value="${ch.slow || 0}" min="0" max="600"></label>
      </div>
      <label class="hub-check"><input type="checkbox" id="cst-ce-p"${ch.private ? ' checked' : ''}> Exclusive space</label>
      <label class="hub-f"><span>Required role</span><select id="cst-ce-r">
        ${CMD.roles(cid).map(r => `<option value="${r.id}"${(ch.role || 'contributor') === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
      <label class="hub-check"><input type="checkbox" id="cst-ce-l"${ch.locked ? ' checked' : ''}> Read-only for members</label>
      <button class="hub-btn primary wide" onclick="CST.saveChan(${i})">Save channel</button>`);
  }

  function saveChan(i) {
    const cid = D().cid;
    const list = CMD.channels(cid).slice();
    const ch = list[i];
    if (!ch) return;
    ch.name = (($('cst-ce-n') || {}).value || ch.name).trim().toLowerCase().replace(/\s+/g, '-');
    ch.topic = ($('cst-ce-t') || {}).value || '';
    ch.space = (($('cst-ce-s') || {}).value || ch.space).trim();
    ch.slow = Number(($('cst-ce-sl') || {}).value || 0);
    ch.private = !!($('cst-ce-p') || {}).checked;
    ch.role = ($('cst-ce-r') || {}).value;
    ch.locked = !!($('cst-ce-l') || {}).checked;
    CMD.saveChannels(cid, list);
    HUB.closeModal();
    repaint();
    toast('Channel saved');
  }

  async function delChan(i) {
    const cid = D().cid;
    const list = CMD.channels(cid).slice();
    const ch = list[i];
    if (!ch) return;
    if (!(await appConfirm(`Delete #${ch.name}? Its messages stay on the device but the channel disappears.`, { ok: 'Delete', danger: true }))) return;
    list.splice(i, 1);
    CMD.saveChannels(cid, list);
    repaint();
    toast('Channel deleted');
  }

  /* ── Roles ───────────────────────────────────────────────────────── */
  function rolesTab(cid) {
    const list = CMD.roles(cid);
    const may = CMD.can(cid, 'roles');
    const mine = CMD.myLevel(cid);
    return `
    ${head('Roles and permissions', 'Higher roles manage lower ones. A permission switched off here really does disable the button.',
      may ? `<button class="hub-btn primary" onclick="CST.newRole()"><span class="material-symbols-rounded">add</span>New role</button>` : lock('manage roles'))}

    <div class="cst-authority">
      ${list.slice().sort((a, b) => b.level - a.level).map(r =>
        `<span class="cst-auth" style="--c:${r.color}">${esc(r.name)}<i>${r.level}</i></span>`).join('<span class="cst-arrow">→</span>')}
    </div>

    ${list.map((r, i) => `
      <section class="cst-panel role">
        <div class="cst-role-h">
          <span class="cst-swatch" style="background:${r.color}"></span>
          <b>${esc(r.name)}</b>
          <span class="hub-chip-s">level ${r.level}</span>
          <span class="hub-chip-s">${CMD.members(cid).filter(m => m.role === r.id).length} members</span>
          ${r.self ? '<span class="hub-chip-s">self-assignable</span>' : ''}
          ${(may && r.level < mine) ? `<button class="hub-act danger" onclick="CST.delRole(${i})"><span class="material-symbols-rounded">delete</span></button>` : ''}
        </div>
        <div class="cst-perms">
          ${CMD.PERMS.map(([p, label]) => {
            const on = (r.perms || []).indexOf(p) > -1;
            const editable = may && r.level < mine;
            return `<label class="cst-perm${on ? ' on' : ''}${editable ? '' : ' fixed'}">
              <input type="checkbox" ${on ? 'checked' : ''} ${editable ? '' : 'disabled'} onchange="CST.togglePerm(${i},'${p}')">
              <span>${esc(label)}</span></label>`;
          }).join('')}
        </div>
      </section>`).join('')}`;
  }

  function togglePerm(i, perm) {
    const cid = D().cid;
    const list = CMD.roles(cid).map(r => ({ ...r, perms: (r.perms || []).slice() }));
    const r = list[i];
    if (!r) return;
    const at = r.perms.indexOf(perm);
    if (at > -1) r.perms.splice(at, 1); else r.perms.push(perm);
    CMD.saveRoles(cid, list);
    toast(`${r.name}: ${perm} ${at > -1 ? 'off' : 'on'}`);
  }

  function newRole() {
    HUB.modal('New role', `
      <label class="hub-f"><span>Name</span><input id="cst-r-n" placeholder="Curator"></label>
      <div class="hub-form-row">
        <label class="hub-f"><span>Colour</span><input type="color" id="cst-r-c" value="#7C5CFF"></label>
        <label class="hub-f"><span>Level</span><input type="number" id="cst-r-l" value="35" min="1" max="95"></label>
      </div>
      <label class="hub-check"><input type="checkbox" id="cst-r-s"> Members can assign this to themselves</label>
      <button class="hub-btn primary wide" onclick="CST.saveNewRole()">Create role</button>`);
  }

  function saveNewRole() {
    const cid = D().cid;
    const name = (($('cst-r-n') || {}).value || '').trim();
    if (!name) { toast('Name the role.'); return; }
    const level = Math.min(CMD.myLevel(cid) - 1, Number(($('cst-r-l') || {}).value || 30));
    const list = CMD.roles(cid).map(r => ({ ...r }));
    list.push({
      id: 'r' + Date.now().toString(36), name, level, color: ($('cst-r-c') || {}).value || '#7C5CFF',
      self: !!($('cst-r-s') || {}).checked,
      perms: ['view', 'post', 'react', 'thread', 'speak', 'boards']
    });
    CMD.saveRoles(cid, list);
    HUB.closeModal();
    repaint();
    toast('Role created');
  }

  async function delRole(i) {
    const cid = D().cid;
    const list = CMD.roles(cid).map(r => ({ ...r }));
    const r = list[i];
    if (!r || !(await appConfirm(`Delete the ${r.name} role?`, { ok: 'Delete', danger: true }))) return;
    list.splice(i, 1);
    CMD.saveRoles(cid, list);
    repaint();
    toast('Role deleted');
  }

  /* ── Members ─────────────────────────────────────────────────────── */
  function membersTab(cid) {
    const list = CMD.members(cid);
    const bans = D().bans[cid] || [];
    const tos = D().timeouts[cid] || {};
    const may = CMD.can(cid, 'roles');
    return `
    ${head('Members', `${compact(CMD.memberCount(cid))} in the community · acting on anyone at or above your role is blocked.`,
      `<input class="cst-find" placeholder="Find a member" oninput="CST.findMember(this.value)">`)}

    <section class="cst-panel">
      <div class="cst-table" id="cst-mtable">
        <div class="cst-tr head"><span>Member</span><span>Role</span><span>Reputation</span><span>Joined</span><span>Actions</span></div>
        ${list.map(m => {
          const role = CMD.roleById(cid, m.role);
          const canAct = may && !m.you && role.level < CMD.myLevel(cid);
          const timedOut = tos[m.handle] && tos[m.handle] > Date.now();
          return `<div class="cst-tr" data-name="${esc((m.name + ' ' + m.handle).toLowerCase())}">
            <span class="cst-mname"><b>${esc(m.name)}</b>${m.you ? ' <i>(you)</i>' : ''}${m.bot ? ' <i class="hub-bot">BOT</i>' : ''}<small>${esc(m.handle)}</small></span>
            <span>${canAct ? `<select class="cst-sel" onchange="CST.setRole('${esc(m.handle)}',this.value)">
                ${CMD.roles(cid).filter(r => r.level < CMD.myLevel(cid)).map(r => `<option value="${r.id}"${r.id === m.role ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}
              </select>` : `<b class="ink" style="color:${role.color}">${esc(role.name)}</b>`}</span>
            <span>${compact(m.rep)}</span>
            <span>${ago(m.joined)} ago</span>
            <span class="cst-tr-a">
              ${timedOut ? '<span class="hub-chip-s" style="color:#FFA726">timed out</span>' : ''}
              ${canAct ? `<button class="hub-act" onclick="HUB.timeout('${esc(m.handle)}',10)" title="Timeout 10m"><span class="material-symbols-rounded">timer</span></button>
                          <button class="hub-act" onclick="CST.reward('${esc(m.handle)}')" title="Reward reputation"><span class="material-symbols-rounded">redeem</span></button>
                          <button class="hub-act danger" onclick="HUB.ban('${esc(m.handle)}')" title="Remove"><span class="material-symbols-rounded">person_remove</span></button>` : ''}
            </span>
          </div>`;
        }).join('')}
      </div>
    </section>

    ${bans.length ? `<section class="cst-panel">
      <h3>Removed members</h3>
      ${bans.map(h => `<div class="cst-log"><b>${esc(h)}</b><span>banned</span>
        <button class="hub-btn sm" onclick="CST.unban('${esc(h)}')">Lift ban</button></div>`).join('')}
    </section>` : ''}`;
  }

  const findMember = q => {
    const term = String(q || '').toLowerCase();
    document.querySelectorAll('#cst-mtable .cst-tr[data-name]').forEach(el => {
      el.style.display = !term || el.dataset.name.indexOf(term) > -1 ? '' : 'none';
    });
  };
  function setRole(handle, rid) {
    if (!CMD.setMemberRole(D().cid, handle, rid)) toast('Blocked — that member is at or above your role.');
    else { toast('Role updated'); repaint(); }
  }
  function unban(handle) { CMD.unban(D().cid, handle); repaint(); toast('Ban lifted'); }
  function reward(handle) {
    CMD.logMod(D().cid, 'reward', handle, '+25 reputation');
    toast(`${handle} rewarded 25 reputation`);
    repaint();
  }

  /* ── Moderation ──────────────────────────────────────────────────── */
  function moderation(cid) {
    const am = CMD.automod(cid);
    const may = CMD.can(cid, 'moderate');
    return `
    ${head('Community safety', 'AutoMod runs before a message is stored. Moderators and above are exempt.',
      `<label class="cst-switch"><input type="checkbox" ${am.on ? 'checked' : ''} onchange="CST.setAM('on',this.checked)"><i></i>AutoMod ${am.on ? 'on' : 'off'}</label>`)}

    <section class="cst-panel">
      <h3>Filters</h3>
      <div class="cst-rules">
        <label class="cst-rule"><input type="checkbox" ${am.links ? 'checked' : ''} onchange="CST.setAM('links',this.checked)">
          <b>Link control</b><span>Only Contributor and above may post links.</span></label>
        <label class="cst-rule"><input type="checkbox" ${am.caps ? 'checked' : ''} onchange="CST.setAM('caps',this.checked)">
          <b>Block shouting</b><span>Stops all-caps messages over 12 characters.</span></label>
        <label class="cst-rule"><input type="checkbox" ${am.spam ? 'checked' : ''} onchange="CST.setAM('spam',this.checked)">
          <b>Repeat protection</b><span>Slows a member posting the same thing again and again.</span></label>
      </div>
      <label class="hub-f"><span>Community-wide slow mode (seconds, 0 for off)</span>
        <input type="number" value="${am.slow || 0}" min="0" max="600" onchange="CST.setAM('slow',+this.value)"></label>
      <label class="hub-f"><span>Blocked words — one per line</span>
        <textarea id="cst-am-words" rows="5">${esc((am.words || []).join('\n'))}</textarea></label>
      <button class="hub-btn primary" onclick="CST.saveWords()" ${may ? '' : 'disabled'}>Save filter list</button>
      <p class="hub-none sm">Try posting one of these words in a channel — the message is refused and the block is logged.</p>
    </section>

    <section class="cst-panel">
      <h3>Moderation log</h3>
      ${CMD.modlog(cid).slice(0, 30).map(e => `<div class="cst-log">
        <span class="cst-log-a ${esc(e.action)}">${esc(e.action)}</span>
        <b>${esc(e.target)}</b><span>${esc(e.reason)}</span><i>${ago(e.ts)} ago · by ${esc(e.by)}</i>
      </div>`).join('') || '<p class="hub-none">Nothing logged yet.</p>'}
    </section>`;
  }

  function setAM(k, v) { CMD.setAutomod(D().cid, { [k]: v }); repaint(); }
  function saveWords() {
    const t = ($('cst-am-words') || {}).value || '';
    CMD.setAutomod(D().cid, { words: t.split('\n').map(s => s.trim()).filter(Boolean) });
    toast('Filter list saved');
  }

  /* ── Analytics ───────────────────────────────────────────────────── */
  function analytics(cid) {
    const a = CMD.analytics(cid);
    const max = Math.max(1, ...a.byChannel.map(c => c.n));
    const w = 520, h = 150, pad = 26;
    const bars = a.byChannel.map((c, i) => {
      const bw = (w - pad * 2) / Math.max(1, a.byChannel.length) - 8;
      const x = pad + i * ((w - pad * 2) / Math.max(1, a.byChannel.length));
      const bh = Math.max(2, (c.n / max) * (h - 40));
      return `<g>
        <rect x="${x}" y="${h - 20 - bh}" width="${bw}" height="${bh}" rx="4" fill="url(#cstg)"></rect>
        <text x="${x + bw / 2}" y="${h - 6}" text-anchor="middle" class="cst-ax">#${esc(c.name.slice(0, 8))}</text>
        <text x="${x + bw / 2}" y="${h - 26 - bh}" text-anchor="middle" class="cst-val">${c.n}</text>
      </g>`;
    }).join('');

    return `
    ${head('Community analytics', 'Counted from what this device holds. Seeded community size is shown separately.')}

    <div class="cst-cards">
      ${[['Messages stored', compact(a.msgs)], ['Sent by you', compact(a.mine)], ['Last 7 days', compact(a.week)],
         ['Board topics', compact(a.boards)], ['Board comments', compact(a.comments)], ['Event RSVPs', compact(a.rsvps)],
         ['Community posts', compact(a.feed)], ['Your reputation', compact(a.rep)]]
        .map(([l, v]) => `<div class="cst-card"><b>${v}</b><span>${l}</span></div>`).join('')}
    </div>

    <section class="cst-panel">
      <h3>Messages by channel</h3>
      ${a.byChannel.length ? `<svg viewBox="0 0 ${w} ${h}" class="cst-chart" preserveAspectRatio="xMidYMid meet">
        <defs><linearGradient id="cstg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#9A83FF"></stop><stop offset="100%" stop-color="#7C5CFF"></stop></linearGradient></defs>
        ${bars}
      </svg>` : '<p class="hub-none">No channel activity yet.</p>'}
    </section>

    <section class="cst-panel">
      <h3>Membership</h3>
      <div class="cst-split">
        <div><b>${compact(a.members)}</b><span>Total members — the seeded size this community ships with, plus you</span></div>
        <div><b>${compact(a.online)}</b><span>Shown as online — part of the seeded community</span></div>
        <div><b>${compact(a.mine + a.comments + a.feed)}</b><span>Contributions actually made on this device</span></div>
        <div><b>${esc(a.tier)}</b><span>Your membership tier</span></div>
      </div>
      <p class="hub-none sm">Retention and growth curves need a server that records history over time; this build reports the
        activity it can actually see rather than drawing a chart from numbers it made up.</p>
    </section>`;
  }

  /* ── Memberships ─────────────────────────────────────────────────── */
  function memberships(cid) {
    const list = CMD.tiers(cid);
    const may = CMD.can(cid, 'manage');
    return `
    ${head('Community memberships', 'Free and paid tiers with the benefits spelled out.',
      may ? `<button class="hub-btn primary" onclick="CST.newTier()"><span class="material-symbols-rounded">add</span>New tier</button>` : lock('manage'))}

    <div class="cst-tiers">
      ${list.map((t, i) => `
        <div class="cst-tier">
          <div class="cst-tier-h"><b>${esc(t.name)}</b><span>${t.price ? '$' + t.price.toFixed(2) + '/mo' : 'Free'}</span></div>
          <ul>${t.perks.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
          <div class="cst-tier-n">${CMD.myTier(cid) === t.id ? 'Your current tier' : ''}</div>
          ${may ? `<div class="cst-tier-a">
            <button class="hub-btn sm" onclick="CST.editTier(${i})">Edit</button>
            ${t.id !== 'free' ? `<button class="hub-act danger" onclick="CST.delTier(${i})"><span class="material-symbols-rounded">delete</span></button>` : ''}
          </div>` : ''}
        </div>`).join('')}
    </div>

    <section class="cst-panel">
      <h3>Payouts</h3>
      <p class="hub-none">Memberships in this build are simulated: choosing a tier records it on the device, nothing is
        charged, and no payment details are collected anywhere in the app. Real subscriptions need a payment processor,
        a server that holds the subscription state, and a payout account — none of which exist here.</p>
    </section>`;
  }

  function newTier() {
    HUB.modal('New membership tier', `
      <label class="hub-f"><span>Name</span><input id="cst-t-n" placeholder="Supporter"></label>
      <label class="hub-f"><span>Price per month (USD)</span><input type="number" id="cst-t-p" value="4.99" step="0.5" min="0"></label>
      <label class="hub-f"><span>Benefits — one per line</span><textarea id="cst-t-b" rows="4">Supporter badge
Early access channel</textarea></label>
      <button class="hub-btn primary wide" onclick="CST.saveNewTier()">Create tier</button>`);
  }
  function saveNewTier() {
    const cid = D().cid;
    const name = (($('cst-t-n') || {}).value || '').trim();
    if (!name) { toast('Name the tier.'); return; }
    const list = CMD.tiers(cid).map(t => ({ ...t }));
    list.push({
      id: 't' + Date.now().toString(36), name,
      price: Number(($('cst-t-p') || {}).value || 0),
      perks: (($('cst-t-b') || {}).value || '').split('\n').map(s => s.trim()).filter(Boolean)
    });
    CMD.saveTiers(cid, list);
    HUB.closeModal();
    repaint();
    toast('Tier created');
  }
  function editTier(i) {
    const cid = D().cid;
    const t = CMD.tiers(cid)[i];
    if (!t) return;
    HUB.modal('Edit ' + t.name, `
      <label class="hub-f"><span>Name</span><input id="cst-t-n" value="${esc(t.name)}"></label>
      <label class="hub-f"><span>Price per month (USD)</span><input type="number" id="cst-t-p" value="${t.price}" step="0.5" min="0"></label>
      <label class="hub-f"><span>Benefits — one per line</span><textarea id="cst-t-b" rows="4">${esc(t.perks.join('\n'))}</textarea></label>
      <button class="hub-btn primary wide" onclick="CST.saveTier(${i})">Save tier</button>`);
  }
  function saveTier(i) {
    const cid = D().cid;
    const list = CMD.tiers(cid).map(t => ({ ...t }));
    const t = list[i];
    if (!t) return;
    t.name = (($('cst-t-n') || {}).value || t.name).trim();
    t.price = Number(($('cst-t-p') || {}).value || 0);
    t.perks = (($('cst-t-b') || {}).value || '').split('\n').map(s => s.trim()).filter(Boolean);
    CMD.saveTiers(cid, list);
    HUB.closeModal();
    repaint();
    toast('Tier saved');
  }
  async function delTier(i) {
    const cid = D().cid;
    const list = CMD.tiers(cid).map(t => ({ ...t }));
    if (!(await appConfirm(`Delete the ${list[i].name} tier?`, { ok: 'Delete', danger: true }))) return;
    list.splice(i, 1);
    CMD.saveTiers(cid, list);
    repaint();
  }

  /* ── Rewards ─────────────────────────────────────────────────────── */
  function rewards(cid) {
    const bounties = (typeof CH !== 'undefined' && CH.BOUNTIES) ? CH.BOUNTIES : [];
    const top = CMD.members(cid).slice().sort((a, b) => b.rep - a.rep).slice(0, 8);
    return `
    ${head('Rewards and contribution', 'Reputation is earned by doing the work, and unlocks roles and channels — it is not a token and cannot be traded.')}

    <section class="cst-panel">
      <h3>How reputation is earned here</h3>
      <div class="cst-rewards">
        ${[['Post a message', '+2'], ['Reply in a thread', '+1'], ['Post to the community feed', '+3'],
           ['Start a discussion topic', '+5'], ['Comment on a topic', '+2'], ['Moderator reward', '+25']]
          .map(([l, v]) => `<div class="cst-reward"><b>${v}</b><span>${l}</span></div>`).join('')}
      </div>
      <div class="cst-unlocks">
        ${CMD.REP_TIERS.map(([n, label]) => `<span class="hub-chip-s${CMD.rep(cid) >= n ? ' on' : ''}">${n}+ ${esc(label)}</span>`).join('')}
        <span class="hub-none sm">You have ${CMD.rep(cid)} — 60 unlocks Contributor, 200 unlocks Expert.</span>
      </div>
    </section>

    ${bounties.length ? `<section class="cst-panel">
      <h3>Open bounties</h3>
      ${bounties.map(b => `<div class="cst-bounty">
        <div><b>${esc(b.title)}</b><span>${esc(b.effort)} effort</span></div>
        <span class="hub-chip-s">${b.reward} tokens</span>
        <button class="hub-btn sm" onclick="CST.claim('${b.id}')">Assign to a member</button>
      </div>`).join('')}
    </section>` : ''}

    <section class="cst-panel">
      <h3>Top contributors</h3>
      ${top.map((m, i) => `<div class="cst-log"><span class="cst-log-a">#${i + 1}</span><b>${esc(m.name)}</b>
        <span>${esc(CMD.roleById(cid, m.role).name)}</span><i>${compact(m.rep)} rep</i>
        <button class="hub-btn sm" onclick="CST.reward('${esc(m.handle)}')">Reward</button></div>`).join('')}
    </section>`;
  }

  function claim(bid) {
    HUB.modal('Assign a bounty', `
      <p class="hub-none">Pick the member who takes this on. They get the reputation reward when it is marked done.</p>
      <div class="hub-chips">${CMD.members(D().cid).filter(m => !m.bot).slice(0, 12).map(m =>
        `<button class="hub-chip" onclick="CST.assign('${bid}','${esc(m.handle)}')">${esc(m.name)}</button>`).join('')}</div>`);
  }
  function assign(bid, handle) {
    CMD.logMod(D().cid, 'bounty', handle, 'Assigned ' + bid);
    HUB.closeModal();
    toast(`Bounty assigned to ${handle}`);
    repaint();
  }

  /* ── Integrations ────────────────────────────────────────────────── */
  function integrations(cid) {
    const list = CMD.hooks(cid);
    const on = CMD.apps(cid);
    return `
    ${head('Apps and integrations', 'Automations that run inside the app, and webhook configuration for services outside it.',
      `<button class="hub-btn primary" onclick="CST.newHook()"><span class="material-symbols-rounded">add</span>Add webhook</button>`)}

    <section class="cst-panel">
      <h3>Community apps</h3>
      <div class="cst-apps">
        ${CMD.APPS.map(a => `
          <div class="cst-app${on.indexOf(a.id) > -1 ? ' on' : ''}">
            <span class="material-symbols-rounded">${a.icon}</span>
            <div><b>${esc(a.name)}</b><span>${esc(a.what)}</span></div>
            <label class="cst-switch"><input type="checkbox" ${on.indexOf(a.id) > -1 ? 'checked' : ''} onchange="CST.toggleApp('${a.id}')"><i></i></label>
          </div>`).join('')}
      </div>
    </section>

    <section class="cst-panel">
      <h3>Webhooks</h3>
      ${list.map(h => `<div class="cst-hook">
        <div><b>${esc(h.name)}</b><code>${esc(h.url)}</code><span>${esc((h.events || []).join(', ') || 'all events')}</span></div>
        <label class="cst-switch"><input type="checkbox" ${h.on ? 'checked' : ''} onchange="CST.toggleHook('${h.id}')"><i></i></label>
        <button class="hub-act danger" onclick="CST.delHook('${h.id}')"><span class="material-symbols-rounded">delete</span></button>
      </div>`).join('') || '<p class="hub-none">No webhooks configured.</p>'}
      <p class="hub-none sm">Webhook targets are stored as configuration only — this build never sends community content
        to an outside URL from your browser. Delivering them needs a server that can hold the secret and retry.</p>
    </section>`;
  }

  function toggleApp(id) {
    const now = CMD.toggleApp(D().cid, id);
    repaint();
    toast(`${id} ${now ? 'enabled' : 'disabled'}`);
  }
  function newHook() {
    HUB.modal('Add a webhook', `
      <label class="hub-f"><span>Name</span><input id="cst-h-n" placeholder="Release notifier"></label>
      <label class="hub-f"><span>URL</span><input id="cst-h-u" placeholder="https://example.com/hooks/…"></label>
      <label class="hub-f"><span>Events</span><input id="cst-h-e" placeholder="announcement, event, member_join"></label>
      <button class="hub-btn primary wide" onclick="CST.saveHook()">Save webhook</button>`);
  }
  function saveHook() {
    const name = (($('cst-h-n') || {}).value || '').trim();
    const url = (($('cst-h-u') || {}).value || '').trim();
    if (!name || !/^https?:\/\//.test(url)) { toast('Give it a name and a full https URL.'); return; }
    CMD.addHook(D().cid, { name, url, events: (($('cst-h-e') || {}).value || '').split(',').map(s => s.trim()).filter(Boolean) });
    HUB.closeModal();
    repaint();
    toast('Webhook saved');
  }
  function toggleHook(id) {
    const h = CMD.hooks(D().cid).find(x => x.id === id);
    if (h) { h.on = !h.on; CMD.save(); }
  }
  function delHook(id) { CMD.removeHook(D().cid, id); repaint(); }

  /* ── Settings ────────────────────────────────────────────────────── */
  function settings(cid) {
    const c = CMD.byId(cid);
    const may = CMD.can(cid, 'manage');
    return `
    ${head('Community settings', may ? 'Branding, identity, discovery and the danger zone.' : 'You can look, but changing these needs the manage permission.')}
    ${window.CCR ? CCR.brandingPanel(cid) : ''}

    <section class="cst-panel">
      <h3>Identity</h3>
      <label class="hub-f"><span>Name</span><input id="cst-s-n" value="${esc(c.name)}" ${may ? '' : 'disabled'}></label>
      <label class="hub-f"><span>Description</span><textarea id="cst-s-d" rows="3" ${may ? '' : 'disabled'}>${esc(c.desc)}</textarea></label>
      <label class="hub-f"><span>Community guide — what a new member should read first</span>
        <textarea id="cst-s-g" rows="3" ${may ? '' : 'disabled'}>${esc(c.guide || '')}</textarea></label>
      <div class="hub-form-row">
        <label class="hub-f"><span>Category</span><select id="cst-s-c" ${may ? '' : 'disabled'}>
          ${CMD.CATEGORIES.filter(x => x[0] !== 'all').map(x => `<option value="${x[0]}"${c.category === x[0] ? ' selected' : ''}>${x[1]}</option>`).join('')}</select></label>
        <label class="hub-f"><span>Colour</span><input type="color" id="cst-s-col" value="${esc(c.color)}" ${may ? '' : 'disabled'}></label>
        <label class="hub-f"><span>Privacy</span><select id="cst-s-p" ${may ? '' : 'disabled'}>
          <option value="public"${c.privacy === 'public' || !c.privacy ? ' selected' : ''}>Public</option>
          <option value="invite"${c.privacy === 'invite' ? ' selected' : ''}>Invite only</option>
          <option value="private"${c.privacy === 'private' ? ' selected' : ''}>Private</option></select></label>
      </div>
      <label class="hub-f"><span>Tags</span><input id="cst-s-t" value="${esc((c.tags || []).join(', '))}" ${may ? '' : 'disabled'}></label>
      <button class="hub-btn primary" onclick="CST.saveSettings()" ${may ? '' : 'disabled'}>Save changes</button>
    </section>

    <section class="cst-panel">
      <h3>Discovery and verification</h3>
      <div class="cst-rules">
        <label class="cst-rule"><input type="checkbox" ${c.listed === false ? '' : 'checked'} ${may ? '' : 'disabled'} onchange="window.CCR && CCR.setListed(this.checked)">
          <b>List in Community Discover</b><span>Appears in Discover, Trending and category browsing.</span></label>
        <label class="cst-rule"><input type="checkbox" ${c.verified ? 'checked disabled' : 'disabled'}>
          <b>Verified community</b><span>${c.verified ? 'This community is verified.' : 'Verification is granted by the platform, not self-applied.'}</span></label>
      </div>
      <button class="hub-btn" onclick="CST.requestVerify()">Request verification</button>
    </section>

    <section class="cst-panel danger">
      <h3>Danger zone</h3>
      <div class="hub-acts">
        <button class="hub-btn" onclick="CST.exportData()"><span class="material-symbols-rounded">download</span>Export this community's data</button>
        <button class="hub-btn danger" onclick="CST.wipe()"><span class="material-symbols-rounded">delete_forever</span>Delete community</button>
      </div>
      <p class="hub-none sm">Deleting removes the community and its local content from this device. Seeded communities
        cannot be deleted — you can only leave them.</p>
    </section>`;
  }

  function saveSettings() {
    const cid = D().cid;
    const patch = {
      name: (($('cst-s-n') || {}).value || '').trim(),
      desc: ($('cst-s-d') || {}).value || '',
      guide: ($('cst-s-g') || {}).value || '',
      category: ($('cst-s-c') || {}).value,
      color: ($('cst-s-col') || {}).value,
      privacy: ($('cst-s-p') || {}).value,
      tags: (($('cst-s-t') || {}).value || '').split(',').map(s => s.trim()).filter(Boolean)
    };
    if (!patch.name) { toast('The community needs a name.'); return; }
    CMD.updateCommunity(cid, patch);
    repaint();
    toast('Settings saved');
  }

  function requestVerify() {
    toast('Verification request noted — a real review needs the platform team, so nothing changes here yet.');
  }

  function exportData() {
    const cid = D().cid;
    const d = D();
    const dump = {
      community: CMD.byId(cid), channels: CMD.channels(cid), roles: CMD.roles(cid),
      boards: CMD.boards(cid), events: CMD.events(cid), feed: CMD.feed(cid),
      messages: Object.keys(d.msgs).filter(k => k.indexOf(cid + ':') === 0).reduce((o, k) => { o[k] = d.msgs[k]; return o; }, {}),
      automod: CMD.automod(cid), modlog: CMD.modlog(cid), analytics: CMD.analytics(cid)
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = cid + '-community.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Exported');
  }

  async function wipe() {
    const cid = D().cid;
    const c = CMD.byId(cid);
    if (!c.mine) { toast('Seeded communities cannot be deleted — leave it instead.'); return; }
    if (!(await appConfirm(`Delete ${c.name}? This cannot be undone.`, { ok: 'Delete', danger: true }))) return;
    CMD.destroy(cid);
    CMD.setState({ screen: 'hub', cid: null });
    HUB.paint();
    toast('Community deleted');
  }

  /* ── Wiring ──────────────────────────────────────────────────────── */
  function wire() {
    // Nothing needs listeners beyond the inline handlers, but keep the hook
    // so the shell can call it uniformly after every repaint.
  }

  return {
    html, wire, tab, repaint,
    broadcast, sendBroadcast,
    moveChan, editChan, saveChan, delChan,
    togglePerm, newRole, saveNewRole, delRole,
    findMember, setRole, unban, reward,
    setAM, saveWords,
    newTier, saveNewTier, editTier, saveTier, delTier,
    claim, assign,
    toggleApp, newHook, saveHook, toggleHook, delHook,
    saveSettings, requestVerify, exportData, wipe
  };
})();

window.CST = CST;
