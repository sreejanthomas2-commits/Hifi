/* ╔══════════════════════════════════════════════════════════════════╗
   ║  COMMUNE HUB+ — community tabs, part one                          ║
   ║                                                                   ║
   ║  Missions · Governance (proposals, verifiable history, treasury,  ║
   ║  crowdfunding) — plus the small additions to Home, Feed, Chat,    ║
   ║  Events, Discussions and member profiles.                         ║
   ║                                                                   ║
   ║  Marketplace, Knowledge, Collabs, the assistant, mini apps and    ║
   ║  gated spaces live in communeplus-tools.js.                       ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

(() => {
  const { esc, toast, $, compact, money, ago, when, av, ico, linkify, modal, closeModal, repaint, download, short } = CPX.h;
  const D = () => CMD.state();
  const cidNow = () => D().cid;
  const cui = CPX.cui = CPX.cui || { gov: 'proposals', prop: null, mkt: 'all', listing: null, kb: null, kbCat: 'all', kbQ: '', collab: null };

  function communityTab(cid, tab) {
    const map = { missions: missionsHTML, governance: governanceHTML, marketplace: CPX.marketHTML, knowledge: CPX.knowledgeHTML, collabs: CPX.collabsHTML };
    if (!map[tab]) return '';
    try { return `<div class="hub-scroll cpx-scroll">${map[tab](cid)}</div>`; }
    catch (e) { console.error(e); return `<div class="hub-none">This tab hit a problem: ${esc(e.message)}</div>`; }
  }
  function wireCommunity() { /* inline handlers */ }
  const go = tab => { cui.prop = null; cui.listing = null; cui.kb = null; cui.collab = null; HUB.setTab(tab); };

  /* ══════════════════════════════════════════════════════════════════
     Missions
     ══════════════════════════════════════════════════════════════════ */

  const HINT = {
    intro: ['Open #introductions', "HUB.openChannel('intros')"], answers: ['Open #help', "HUB.openChannel('support')"],
    topics: ['Open Discussions', "HUB.setTab('boards')"], comments: ['Open Discussions', "HUB.setTab('boards')"],
    checkins: ['Open Events', "HUB.setTab('events')"], votes: ['Open Governance', "CPX.go('governance')"],
    kb: ['Open Knowledge', "CPX.go('knowledge')"], posts: ['Open Feed', "HUB.setTab('feed')"]
  };

  function missionsHTML(cid) {
    const c = CMD.byId(cid);
    const list = CPM.missions(cid);
    const earned = CPM.badges(cid);
    const states = list.map(m => ({ m, st: CPM.missionState(cid, m) }));
    const done = states.filter(x => x.st.status === 'done').length;
    return `
      <section class="hub-hero cpx-mhero" style="--c:${c.color}">
        <div class="hub-hero-icon" style="--c:${c.color}">${ico('flag')}</div>
        <div class="hub-hero-t">
          <h2>Community missions</h2>
          <p>Create, help, moderate, learn and show up. Missions pay out in reputation and non-transferable credentials — never in tokens with a price.</p>
          <div class="hub-hero-s">
            <span><b>${done}/${list.length}</b> complete</span>
            <span><b>${CMD.rep(cid)}</b> reputation · ${esc(CMD.repTier(cid))}</span>
            <span><b>${earned.length}</b> credentials earned here</span>
          </div>
        </div>
      </section>

      <div class="cpx-missions">${states.map(({ m, st }) => {
        const hint = m.mode === 'auto' ? HINT[m.metric] : null;
        return `<article class="cpx-mission ${st.status}">
          <div class="cpx-mission-h">
            <span class="cpx-mission-i">${ico(m.icon || 'flag')}</span>
            <div><b>${esc(m.title)}</b><span>+${m.points} rep · “${esc(m.badge)}” credential${m.skill ? ' · verifies ' + esc(m.skill) : ''}</span></div>
            ${st.status === 'done' ? `<span class="cpx-pill ok">${ico('check_circle')}Done</span>` : m.mode === 'review' ? '<span class="cpx-pill">Reviewed</span>' : ''}
          </div>
          <p>${esc(m.desc)}</p>
          <div class="cpx-prog"><i style="width:${st.pct}%"></i></div>
          <div class="cpx-mission-a">
            ${m.mode === 'auto' && st.status !== 'done' ? `<span class="hub-none sm">${st.have} / ${st.need}</span>` : ''}
            ${st.status === 'ready' ? `<button class="hub-btn primary sm" onclick="CPX.claim('${m.id}')">${ico('redeem')}Claim reward</button>` : ''}
            ${st.status === 'open' && hint ? `<button class="hub-btn sm" onclick="${hint[1]}">${hint[0]}</button>` : ''}
            ${m.mode === 'review' && (st.status === 'open' || st.status === 'returned') ? `<button class="hub-btn primary sm" onclick="CPX.openSubmit('${m.id}')">${ico('upload')}Submit for review</button>` : ''}
            ${st.status === 'submitted' ? `<span class="cpx-pill warm">${ico('hourglass_top')}In review</span>` : ''}
            ${st.status === 'returned' ? `<span class="hub-none sm">Returned: ${esc(st.pr.note || '')}</span>` : ''}
          </div>
        </article>`;
      }).join('')}</div>

      <section class="hub-panel">
        <h3 class="hub-h3">${ico('military_tech')}Credentials earned in ${esc(c.name)}</h3>
        <div class="hub-chips">${earned.map(b => `<span class="hub-chip-s on">${ico(b.icon)}${esc(b.title)}</span>`).join('') || '<span class="hub-none">None yet — claim a mission above.</span>'}</div>
        <p class="hub-none sm">Credentials sit in your Passport with a digest anyone can check, and some communities link them to roles.</p>
      </section>`;
  }

  function claim(mid) {
    const r = CPM.claimMission(cidNow(), mid);
    if (r.error) { toast(r.error); return; }
    toast(`Mission complete — +${r.points} reputation and the “${r.badge.title}” credential`);
    repaint();
  }
  function openSubmit(mid) {
    const m = CPM.missions(cidNow()).find(x => x.id === mid);
    modal('Submit: ' + m.title, `
      <p class="hub-guide">${esc(m.desc)}</p>
      <label class="hub-f"><span>Link or write-up</span><textarea id="cpx-ms-t" rows="6" placeholder="https://… or describe what you did so a moderator can check it"></textarea></label>
      <p class="hub-none sm">Moderators review submissions in Community Studio → Rewards.</p>
      <button class="hub-btn primary wide" onclick="CPX.submit('${mid}')">Submit</button>`);
  }
  function submit(mid) {
    const r = CPM.submitMission(cidNow(), mid, ($('cpx-ms-t') || {}).value);
    if (r.error) { toast(r.error); return; }
    closeModal(); repaint();
    toast('Submitted — a moderator will review it');
  }

  /* ══════════════════════════════════════════════════════════════════
     Governance
     ══════════════════════════════════════════════════════════════════ */

  const STATUS = {
    discussion: ['Discussion', 'forum'], voting: ['Voting', 'how_to_vote'], passed: ['Passed', 'check_circle'],
    rejected: ['Rejected', 'cancel'], implemented: ['Implemented', 'task_alt'], withdrawn: ['Withdrawn', 'undo']
  };
  const typeOf = t => CPM.PROPOSAL_TYPES.find(x => x[0] === t) || ['priority', 'Priority', 'flag'];
  const modeOf = m => CPM.VOTE_MODES.find(x => x[0] === m) || CPM.VOTE_MODES[0];

  function governanceHTML(cid) {
    const sub = cui.gov || 'proposals';
    const nav = [['proposals', 'Proposals', 'description'], ['history', 'History', 'history'], ['treasury', 'Treasury', 'account_balance'], ['funding', 'Funding', 'savings']];
    let body = '';
    if (sub === 'proposals') body = cui.prop ? proposalHTML(cid, cui.prop) : proposalsHTML(cid);
    else if (sub === 'history') body = historyHTML(cid);
    else if (sub === 'treasury') body = treasuryHTML(cid);
    else body = fundingHTML(cid);
    return `<div class="cpx-subnav">${nav.map(([k, l, i]) => `<button class="hub-chip${sub === k ? ' on' : ''}" onclick="CPX.govTab('${k}')">${ico(i)}${l}</button>`).join('')}</div>${body}`;
  }
  const govTab = t => { cui.gov = t; cui.prop = null; repaint(); };

  function voteBar(p) {
    const r = CPM.tally(p);
    if (p.options[0] === 'For') {
      const decisive = (r.t[0] || 0) + (r.t[1] || 0);
      const f = decisive ? (r.t[0] / decisive) * 100 : 0;
      return `<div class="cpx-vbar"><i class="for" style="width:${f}%"></i><i class="against" style="width:${decisive ? 100 - f : 0}%"></i></div>
        <div class="cpx-vmeta"><span>For ${compact(r.t[0])}</span><span>Against ${compact(r.t[1])}</span><span>Abstain ${compact(r.t[2] || 0)}</span>
        <span class="${r.quorumMet ? 'up' : ''}">Quorum ${compact(r.total)}/${p.quorum}</span></div>`;
    }
    return `<div class="cpx-vmeta"><span>${compact(r.total)} votes · leading: ${esc(p.options[r.top])}</span><span class="${r.quorumMet ? 'up' : ''}">Quorum ${compact(r.total)}/${p.quorum}</span></div>`;
  }

  function proposalsHTML(cid) {
    const list = CPM.proposals(cid);
    const s = CPM.govSettings(cid);
    const can = CPM.canPropose(cid);
    const order = { voting: 0, discussion: 1, passed: 2, implemented: 3, rejected: 4, withdrawn: 5 };
    return `
      <div class="hub-board-top">
        <div class="hub-chips">
          <span class="hub-chip-s">${ico('how_to_vote')}${esc(modeOf(s.mode)[1])}</span>
          <span class="hub-chip-s">Quorum ${s.quorum}</span><span class="hub-chip-s">${s.days}-day votes</span>
          <span class="hub-chip-s">Pass &gt; ${s.passPct}%</span><span class="hub-chip-s">${s.publicBallots === false ? 'Secret' : 'Public'} ballots</span>
        </div>
        ${can.ok ? `<button class="hub-btn primary sm" onclick="CPX.openPropose()">${ico('add')}New proposal</button>` : `<span class="hub-none sm">${esc(can.why)}</span>`}
      </div>
      ${list.slice().sort((a, b) => (order[a.status] - order[b.status]) || b.created - a.created).map(p => {
        const st = STATUS[p.status] || [p.status, 'help'];
        const ty = typeOf(p.type);
        return `<article class="cpx-prop ${p.status}" onclick="CPX.openProp('${p.id}')">
          <div class="cpx-prop-h">
            <span class="cpx-status ${p.status}">${ico(st[1])}${st[0]}</span>
            <span class="hub-chip-s">${ico(ty[2])}${ty[1]}</span>
            ${p.seed ? '<span class="hub-chip-s" title="Seeded demo proposal">demo</span>' : ''}
            <span class="cpx-prop-t">${p.status === 'voting' ? 'ends ' + ago(p.end) : p.status === 'discussion' ? 'voting ' + ago(p.start) : ago(p.end) + ' ago'}</span>
          </div>
          <h4>${esc(p.title)}</h4>
          <p>${esc(p.summary)}</p>
          ${voteBar(p)}
          <div class="cpx-prop-f">${av(p.author, p.handle, 20)}<span>${esc(p.author)}</span><span>${p.comments.length} comments</span>
            ${p.votes[CMD.me().handle] ? `<span class="cpx-pill ok">${ico('check')}You voted</span>` : ''}</div>
        </article>`;
      }).join('')}
      <p class="hub-none sm">Structured proposals replace ad-hoc polls: every proposal states what, why, how and how we will know it worked. Each step is written to a hash-chained history anyone can verify.</p>`;
  }

  const openProp = id => { cui.prop = id; repaint(); };
  const closeProp = () => { cui.prop = null; repaint(); };

  function proposalHTML(cid, pid) {
    const p = CPM.proposals(cid).find(x => x.id === pid);
    if (!p) { cui.prop = null; return proposalsHTML(cid); }
    const st = STATUS[p.status] || [p.status, 'help'];
    const ty = typeOf(p.type);
    const r = CPM.tally(p);
    const mine = p.votes[CMD.me().handle];
    const weight = CPM.weightFor(cid, p.mode);
    const t = CPM.treasury(cid);
    const seedVotes = (p.seedTally || []).reduce((s, n) => s + n, 0);
    const history = CPM.govLog(cid).filter(e => e.pid === pid);
    return `
      <button class="hub-back" onclick="CPX.closeProp()">${ico('arrow_back')}All proposals</button>
      <article class="hub-bfull cpx-pfull">
        <div class="cpx-prop-h">
          <span class="cpx-status ${p.status}">${ico(st[1])}${st[0]}</span>
          <span class="hub-chip-s">${ico(ty[2])}${ty[1]}</span>
          <span class="hub-chip-s">${ico('how_to_vote')}${esc(modeOf(p.mode)[1])}</span>
          ${p.seed ? '<span class="hub-chip-s">demo</span>' : ''}
        </div>
        <h2>${esc(p.title)}</h2>
        <div class="hub-bfull-h">${av(p.author, p.handle, 26)}<b>${esc(p.author)}</b><span>${esc(p.handle)} · proposed ${ago(p.created)} ago</span></div>
        <div class="cpx-timeline">
          <span class="on">${ico('edit_note')}Proposed<br><i>${when(p.created)}</i></span>
          <span class="${Date.now() >= p.start ? 'on' : ''}">${ico('how_to_vote')}Voting opens<br><i>${when(p.start)}</i></span>
          <span class="${Date.now() >= p.end || ['passed', 'rejected', 'implemented'].indexOf(p.status) > -1 ? 'on' : ''}">${ico('gavel')}Closes<br><i>${when(p.end)}</i></span>
          <span class="${p.status === 'implemented' ? 'on' : ''}">${ico('task_alt')}Implemented<br><i>${p.implAt ? when(p.implAt) : '—'}</i></span>
        </div>
        <div class="cpx-psec"><h5>Summary</h5><p>${linkify(p.summary)}</p></div>
        ${p.motivation ? `<div class="cpx-psec"><h5>Why</h5><p>${linkify(p.motivation)}</p></div>` : ''}
        ${p.spec ? `<div class="cpx-psec"><h5>How it works</h5><p>${linkify(p.spec)}</p></div>` : ''}
        ${p.metric ? `<div class="cpx-psec"><h5>How we will know it worked</h5><p>${linkify(p.metric)}</p></div>` : ''}
        ${p.amount ? `<div class="cpx-psec"><h5>Budget requested</h5><p><b>${money(p.amount)}</b> from the community treasury (simulated ledger)</p></div>` : ''}
      </article>

      <section class="hub-panel">
        <h3 class="hub-h3">${ico('ballot')}Vote</h3>
        <div class="cpx-options">${p.options.map((o, i) => {
          const pct = r.total ? Math.round((r.t[i] / r.total) * 100) : 0;
          return `<button class="hub-poll-o${mine && mine.opt === i ? ' on' : ''}" ${p.status === 'voting' ? `onclick="CPX.vote('${p.id}',${i})"` : 'disabled'}>
            <i style="width:${pct}%"></i><span>${esc(o)}</span><b>${compact(r.t[i])} · ${pct}%</b></button>`;
        }).join('')}</div>
        ${voteBar(p)}
        <p class="hub-none sm">${p.status === 'voting'
          ? (weight ? `Your vote counts with weight ${weight} — ${esc(modeOf(p.mode)[2])}` : esc(modeOf(p.mode)[2]))
          : p.status === 'discussion' ? 'Voting opens ' + ago(p.start) + '.' : 'Voting is closed.'}
          ${seedVotes ? ` Includes ${seedVotes} demo votes seeded with this community.` : ''}${p.winner ? ` Decision: <b>${esc(p.winner)}</b>.` : ''}</p>
        ${p.mode === 'token' && !CPM.wallet() && p.status === 'voting' ? `<button class="hub-btn sm" onclick="WL.openChooser()">${ico('account_balance_wallet')}Connect a wallet to vote</button>` : ''}
        ${p.implNote ? `<div class="cpx-impl">${ico('task_alt')}<div><b>Implemented by ${esc(p.implementedBy)}</b><span>${esc(p.implNote)}</span></div></div>` : ''}
        <div class="hub-acts">
          ${p.status === 'passed' && (CMD.can(cid, 'moderate') || CMD.can(cid, 'manage')) ? `<button class="hub-btn primary sm" onclick="CPX.openImplement('${p.id}')">${ico('task_alt')}Mark implemented</button>` : ''}
          ${p.status === 'voting' && CMD.can(cid, 'manage') ? `<button class="hub-btn sm" onclick="CPX.closeEarly('${p.id}')">${ico('timer_off')}Close vote early</button>` : ''}
          ${['voting', 'discussion'].indexOf(p.status) > -1 && p.handle === CMD.me().handle ? `<button class="hub-btn sm danger" onclick="CPX.withdraw('${p.id}')">Withdraw</button>` : ''}
          ${p.type === 'budget' && ['passed', 'implemented'].indexOf(p.status) > -1 && t && t.enabled && CMD.can(cid, 'moderate') ? `<button class="hub-btn sm" onclick="CPX.openSpend('${p.id}')">${ico('payments')}Request treasury spend</button>` : ''}
        </div>
      </section>

      <section class="hub-panel">
        <h3 class="hub-h3">${ico('history')}Transparent history</h3>
        ${history.map(historyRow).join('')}
      </section>

      <section class="hub-panel">
        <h3 class="hub-h3">${ico('mode_comment')}${p.comments.length} comments</h3>
        ${p.comments.map(c => `<div class="hub-bcomment">${av(c.name, c.handle, 28)}<div><b>${esc(c.name)}</b> <span>${ago(c.ts)}</span><p>${linkify(c.text)}</p></div></div>`).join('')}
        <div class="hub-bcomment-in">${av(CMD.me().name, CMD.me().handle, 28)}
          <input id="cpx-pc" placeholder="Argue for it, against it, or improve it" onkeydown="if(event.key==='Enter')CPX.commentProp('${p.id}')">
          <button class="hub-btn primary sm" onclick="CPX.commentProp('${p.id}')">Comment</button></div>
      </section>`;
  }

  const ACTION_ICON = { proposed: 'edit_note', 'voting-opened': 'how_to_vote', voted: 'ballot', 'vote-changed': 'swap_horiz', passed: 'check_circle', rejected: 'cancel',
    implemented: 'task_alt', withdrawn: 'undo', 'closed-early': 'timer_off', settings: 'settings', 'treasury-enabled': 'account_balance', 'signers-changed': 'group',
    'spend-requested': 'request_quote', 'spend-approved': 'draw', 'spend-executed': 'payments', 'milestone-released': 'flag', 'gate-created': 'lock', 'pass-updated': 'badge', 'collab-proposed': 'handshake' };

  function historyRow(e) {
    const d = e.detail || {};
    const bits = [];
    if (d.title) bits.push(d.title);
    if (d.option) bits.push('→ ' + d.option);
    if (d.weight && d.weight !== 1) bits.push('weight ' + d.weight);
    if (d.tally) bits.push('tally ' + d.tally.join(' / '));
    if (d.winner) bits.push('decision: ' + d.winner);
    if (d.note) bits.push(d.note);
    if (d.amount) bits.push(money(d.amount) + (d.memo ? ' · ' + d.memo : ''));
    if (d.signer) bits.push('signer ' + d.signer + (d.simulated ? ' (simulated)' : ''));
    if (d.changed) bits.push('changed: ' + d.changed.join(', '));
    if (d.channel) bits.push('#' + d.channel);
    if (d.milestone) bits.push(d.milestone);
    return `<div class="cpx-hist">
      <span class="cpx-hist-i">${ico(ACTION_ICON[e.action] || 'radio_button_checked')}</span>
      <div><b>${esc(e.action.replace(/-/g, ' '))}</b> <span>${esc(e.actor)}</span>${e.seed ? ' <i class="cpx-demo">demo</i>' : ''}
        <p>${esc(bits.join(' · '))}</p></div>
      <div class="cpx-hist-r"><i>${ago(e.at)}${e.at < Date.now() ? ' ago' : ''}</i><code title="${e.hash}">#${e.i} ${e.hash.slice(0, 8)}</code></div>
    </div>`;
  }

  function historyHTML(cid) {
    const log = CPM.govLog(cid);
    const v = CPM.verifyGov(cid);
    return `
      <section class="hub-panel">
        <div class="cpx-proofhead ${v.ok ? 'ok' : 'bad'}">${ico(v.ok ? 'verified' : 'gpp_bad')}
          <div><b>${v.ok ? 'History verifies' : 'History was altered at entry #' + v.at}</b>
            <span>${v.count} entries · root ${short(v.root || '')}</span></div>
          <button class="hub-btn sm" onclick="CPX.verifyHistory()">${ico('fact_check')}Verify</button>
          <button class="hub-btn sm" onclick="CPX.exportHistory()">${ico('download')}Export</button>
        </div>
        <p class="hub-none sm">Who proposed, who voted, what passed, who implemented it, and every treasury movement — each entry hashes the one before it. Export it and anyone can recompute the chain. The root hash can be anchored on-chain by anyone who wants to; this app does not send transactions.</p>
      </section>
      <section class="hub-panel">${log.slice().reverse().map(historyRow).join('')}</section>`;
  }
  function verifyHistory() {
    const v = CPM.verifyGov(cidNow());
    toast(v.ok ? `All ${v.count} entries verify ✓` : `Entry #${v.at} does not match — the history was changed.`);
  }
  function exportHistory() { download(cidNow() + '-governance.json', CPM.exportGov(cidNow())); toast('Governance record exported'); }

  function vote(pid, i) {
    const r = CPM.vote(cidNow(), pid, i);
    if (r.error) { toast(r.error); return; }
    toast(`Vote recorded${r.weight !== 1 ? ' with weight ' + r.weight : ''} — written to the history`);
    repaint();
  }
  function commentProp(pid) {
    const r = CPM.commentProposal(cidNow(), pid, ($('cpx-pc') || {}).value);
    if (r.error) { toast(r.error); return; }
    repaint();
  }
  async function closeEarly(pid) {
    if (!(await appConfirm('Close this vote now? The early close is recorded in the public history.', { ok: 'Close vote' }))) return;
    const r = CPM.closeEarly(cidNow(), pid);
    toast(r.error || `Vote closed — ${r.status}`);
    repaint();
  }
  function withdraw(pid) {
    const r = CPM.cancelProposal(cidNow(), pid);
    toast(r.error || 'Proposal withdrawn');
    repaint();
  }
  function openImplement(pid) {
    modal('Mark implemented', `
      <label class="hub-f"><span>What was done</span><textarea id="cpx-impl" rows="4" placeholder="Links, dates, who did it"></textarea></label>
      <button class="hub-btn primary wide" onclick="CPX.doImplement('${pid}')">Record implementation</button>`);
  }
  function doImplement(pid) {
    const r = CPM.implement(cidNow(), pid, ($('cpx-impl') || {}).value);
    if (r.error) { toast(r.error); return; }
    closeModal(); repaint();
    toast('Implementation recorded');
  }

  function openPropose() {
    const cid = cidNow();
    const s = CPM.govSettings(cid);
    modal('New proposal', `
      <label class="hub-f"><span>Title</span><input id="cpx-p-t" placeholder="A clear, specific change"></label>
      <div class="hub-form-row">
        <label class="hub-f"><span>Type</span><select id="cpx-p-ty" onchange="document.getElementById('cpx-p-amt-w').hidden=this.value!=='budget'">
          ${CPM.PROPOSAL_TYPES.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select></label>
        <label class="hub-f"><span>Voting</span><select id="cpx-p-m">
          ${CPM.VOTE_MODES.map(m => `<option value="${m[0]}"${s.mode === m[0] ? ' selected' : ''}>${m[1]}</option>`).join('')}</select></label>
      </div>
      <label class="hub-f" id="cpx-p-amt-w" hidden><span>Budget amount (simulated treasury)</span><input type="number" id="cpx-p-amt" min="0" step="50" value="500"></label>
      <label class="hub-f"><span>Summary</span><textarea id="cpx-p-s" rows="3" placeholder="What changes, in one paragraph"></textarea></label>
      <label class="hub-f"><span>Why</span><textarea id="cpx-p-mo" rows="2" placeholder="The problem this solves"></textarea></label>
      <label class="hub-f"><span>How it works</span><textarea id="cpx-p-sp" rows="3" placeholder="Specifics: who, when, how much"></textarea></label>
      <label class="hub-f"><span>How we will know it worked</span><input id="cpx-p-me" placeholder="A measurable result"></label>
      <label class="hub-f"><span>Options — one per line (leave empty for For / Against / Abstain)</span><textarea id="cpx-p-o" rows="3"></textarea></label>
      <div class="hub-form-row">
        <label class="hub-f"><span>Discussion first (hours)</span><input type="number" id="cpx-p-dh" value="0" min="0" max="72"></label>
        <label class="hub-f"><span>Voting days</span><input type="number" id="cpx-p-d" value="${s.days}" min="1" max="14"></label>
      </div>
      <p class="hub-none sm">Quorum ${s.quorum} · passes above ${s.passPct}%. The AI Moderator screens proposals before they publish.</p>
      <button class="hub-btn primary wide" onclick="CPX.doPropose()">Publish proposal</button>`, true);
  }
  function doPropose() {
    const v = id => ($(id) || {}).value;
    const r = CPM.propose(cidNow(), { title: v('cpx-p-t'), type: v('cpx-p-ty'), mode: v('cpx-p-m'), amount: v('cpx-p-amt'), summary: v('cpx-p-s'),
      motivation: v('cpx-p-mo'), spec: v('cpx-p-sp'), metric: v('cpx-p-me'), options: v('cpx-p-o'), discussHours: v('cpx-p-dh'), days: v('cpx-p-d') });
    if (r.error) { toast(r.error); return; }
    closeModal();
    cui.gov = 'proposals'; cui.prop = r.id;
    repaint();
    toast('Proposal published');
  }

  /* ── Treasury ────────────────────────────────────────────────────── */
  function treasuryHTML(cid) {
    const t = CPM.treasury(cid);
    const c = CMD.byId(cid);
    if (!t || !t.enabled) {
      return `<div class="hub-empty">${ico('account_balance')}
        <p>${esc(c.name)} has no community treasury switched on.</p>
        <p class="hub-none">A treasury is a shared budget for clearly defined community projects. It needs an adult-managed community, named signers, and spending that follows passed proposals.</p>
        ${CMD.can(cid, 'manage') ? `<button class="hub-btn primary" onclick="HUB.openStudio();setTimeout(()=>CST.tab('governance'),60)">Set it up in Studio → Governance</button>` : ''}
      </div>`;
    }
    const bal = CPM.balance(cid);
    const me = CMD.me().handle;
    const ins = t.ledger.filter(e => e.kind === 'in').reduce((s, e) => s + e.amount, 0);
    const outs = t.ledger.filter(e => e.kind === 'out').reduce((s, e) => s + e.amount, 0);
    return `
      <div class="cst-cards">
        <div class="cst-card">${ico('account_balance')}<b>${money(bal)}</b><span>Balance · simulated ledger</span></div>
        <div class="cst-card">${ico('south_west')}<b>${money(ins)}</b><span>Received</span></div>
        <div class="cst-card">${ico('north_east')}<b>${money(outs)}</b><span>Spent via proposals</span></div>
        <div class="cst-card">${ico('draw')}<b>${t.threshold} of ${t.signers.length}</b><span>Signers required</span></div>
      </div>
      <section class="hub-panel">
        <h3 class="hub-h3">${ico('group')}Multisig signers</h3>
        <div class="hub-chips">${t.signers.map(s => `<span class="hub-chip-s${s === me ? ' on' : ''}">${ico('key')}${esc(s)}${s === me ? ' (you)' : ''}</span>`).join('')}</div>
        <p class="hub-none sm">${t.attested ? `Adult-managed community attested by ${esc(t.attested.by)} ${ago(t.attested.at)} ago. ` : ''}Every spend needs a passed budget proposal and ${t.threshold} signer approvals, and each step is written to the governance history. This is a simulated ledger — no funds are held, and a real treasury would be an on-chain multisig the signers control themselves.</p>
      </section>
      <section class="hub-panel">
        <h3 class="hub-h3">${ico('request_quote')}Spend requests</h3>
        ${t.requests.map(q => {
          const p = CPM.proposals(cid).find(x => x.id === q.pid);
          const iSign = t.signers.indexOf(me) > -1 && q.approvals.indexOf(me) < 0;
          return `<div class="cpx-spend ${q.status}">
            <div><b>${money(q.amount)} · ${esc(q.memo)}</b><span>${p ? 'Proposal: ' + esc(p.title) : ''} · ${q.approvals.length}/${t.threshold} approvals · ${esc(q.status)}</span>
              <div class="cpx-prog"><i style="width:${Math.min(100, q.approvals.length / t.threshold * 100)}%"></i></div></div>
            ${q.status === 'pending' && iSign ? `<button class="hub-btn primary sm" onclick="CPX.approveSpend('${q.id}')">Approve as signer</button>` : ''}
            ${q.status === 'pending' && CMD.iOwn(CMD.byId(cid)) && !iSign ? `<button class="hub-btn sm" onclick="CPX.approveSpend('${q.id}',true)" title="Your own community only — recorded as simulated">Simulate co-signer</button>` : ''}
          </div>`;
        }).join('') || '<p class="hub-none">No open requests. Moderators raise one from a passed budget proposal.</p>'}
      </section>
      <section class="hub-panel">
        <h3 class="hub-h3">${ico('receipt_long')}Ledger</h3>
        ${t.ledger.map(e => `<div class="cpx-ledger ${e.kind}">
          <span class="cpx-ledger-i">${ico(e.kind === 'in' ? 'south_west' : 'north_east')}</span>
          <div><b>${esc(e.memo)}</b><span>${new Date(e.at).toLocaleDateString()}${e.approvals ? ' · signed by ' + e.approvals.map(esc).join(', ') : ''}${e.seed ? ' · demo' : ''}</span></div>
          <b class="cpx-ledger-a">${e.kind === 'in' ? '+' : '−'}${money(e.amount).replace('−', '')}</b>
        </div>`).join('') || '<p class="hub-none">Empty.</p>'}
      </section>`;
  }
  function openSpend(pid) {
    const cid = cidNow();
    const p = CPM.proposals(cid).find(x => x.id === pid);
    modal('Request a treasury spend', `
      <p class="hub-guide">From the passed proposal “${esc(p.title)}”. Balance ${money(CPM.balance(cid))}.</p>
      <label class="hub-f"><span>Amount</span><input type="number" id="cpx-sp-a" value="${p.amount || 100}" min="1"></label>
      <label class="hub-f"><span>Memo</span><input id="cpx-sp-m" value="${esc(p.title)}"></label>
      <button class="hub-btn primary wide" onclick="CPX.doSpend('${pid}')">Raise request</button>`);
  }
  function doSpend(pid) {
    const r = CPM.requestSpend(cidNow(), pid, ($('cpx-sp-a') || {}).value, ($('cpx-sp-m') || {}).value);
    if (r.error) { toast(r.error); return; }
    closeModal(); cui.gov = 'treasury'; cui.prop = null; repaint();
    toast('Spend request raised — signers can approve it');
  }
  function approveSpend(rid, sim) {
    const r = CPM.approveSpend(cidNow(), rid, sim);
    if (r.error) { toast(r.error); return; }
    toast(r.status === 'executed' ? 'Threshold reached — spend recorded in the ledger' : 'Approval recorded');
    repaint();
  }

  /* ── Crowdfunding ────────────────────────────────────────────────── */
  function fundingHTML(cid) {
    const list = CPM.funding(cid);
    return `
      <div class="hub-board-top">
        <p class="hub-none">Fund clearly defined community projects. Backing is support, not investment — there are no returns, tokens or profit share.</p>
        ${CMD.can(cid, 'moderate') || CMD.can(cid, 'manage') ? `<button class="hub-btn primary sm" onclick="CPX.openCampaign()">${ico('add')}Start a campaign</button>` : ''}
      </div>
      ${list.map(f => {
        const raised = CPM.raised(f);
        const pct = Math.min(100, Math.round(raised / f.goal * 100));
        const mine = f.pledges.filter(p => p.handle === CMD.me().handle).reduce((s, p) => s + p.amount, 0);
        const days = Math.max(0, Math.ceil((f.deadline - Date.now()) / 86400000));
        return `<article class="cpx-fund">
          <div class="cpx-prop-h"><span class="cpx-status ${f.status === 'live' ? 'voting' : 'passed'}">${ico(f.status === 'live' ? 'savings' : 'celebration')}${f.status === 'live' ? 'Live' : 'Funded'}</span>
            ${f.seed ? '<span class="hub-chip-s">demo</span>' : ''}<span class="cpx-prop-t">${days} days left</span></div>
          <h4>${esc(f.title)}</h4><p>${esc(f.desc)}</p>
          <div class="cpx-prog big"><i style="width:${pct}%"></i></div>
          <div class="cpx-vmeta"><span><b>${money(raised)}</b> of ${money(f.goal)}</span><span>${pct}%</span><span>${compact(CPM.backers(f))} backers</span>${mine ? `<span class="up">You pledged ${money(mine)}</span>` : ''}</div>
          <div class="cpx-miles">${f.milestones.map((m, i) => `<span class="cpx-mile ${m.status}">${ico(m.status === 'released' ? 'lock_open' : 'lock')}${esc(m.t)} · ${m.pct}%
            ${m.status !== 'released' && CMD.can(cidNow(), 'manage') ? `<button class="cpx-x" onclick="CPX.release('${f.id}',${i})" title="Release milestone">${ico('check')}</button>` : ''}</span>`).join('')}</div>
          ${f.status === 'live' ? `<button class="hub-btn primary sm" onclick="CPX.openBack('${f.id}')">${ico('volunteer_activism')}Back this project</button>` : ''}
        </article>`;
      }).join('')}
      <p class="hub-none sm">Pledges are simulated and nothing is charged. Funds release by milestone, and every release is written to the governance history.</p>`;
  }
  function openBack(fid) {
    const f = CPM.funding(cidNow()).find(x => x.id === fid);
    modal('Back: ' + f.title, `
      <div class="hub-chips" id="cpx-back-amt">${[5, 10, 25, 50, 100].map((n, i) => `<button class="hub-chip${i === 1 ? ' on' : ''}" data-n="${n}" onclick="document.querySelectorAll('#cpx-back-amt .hub-chip').forEach(b=>b.classList.remove('on'));this.classList.add('on')">${money(n)}</button>`).join('')}</div>
      <div class="cpx-safe cpx-mt">${ico('info')}<div><b>What backing means</b><span>You are supporting a defined project. There are no returns, no tokens and no profit share. This demo charges nothing and collects no payment details.</span></div></div>
      <button class="hub-btn primary wide" onclick="CPX.doBack('${fid}')">Pledge</button>`);
  }
  function doBack(fid) {
    const on = document.querySelector('#cpx-back-amt .hub-chip.on');
    const r = CPM.back(cidNow(), fid, on ? +on.dataset.n : 0);
    if (r.error) { toast(r.error); return; }
    closeModal(); repaint();
    toast(r.funded ? 'Pledged — and the project is now fully funded!' : 'Pledged (simulated) — thank you');
  }
  function openCampaign() {
    modal('Start a campaign', `
      <label class="hub-f"><span>Project</span><input id="cpx-fc-t" placeholder="What will be made or done"></label>
      <label class="hub-f"><span>Description</span><textarea id="cpx-fc-d" rows="3" placeholder="Who does the work, what it costs, what backers get to see"></textarea></label>
      <div class="hub-form-row">
        <label class="hub-f"><span>Goal</span><input type="number" id="cpx-fc-g" value="1000" min="100"></label>
        <label class="hub-f"><span>Days</span><input type="number" id="cpx-fc-days" value="21" min="3" max="60"></label>
      </div>
      <label class="hub-f"><span>Milestones — one per line</span><textarea id="cpx-fc-m" rows="3">Plan published
Work delivered
Report to backers</textarea></label>
      <button class="hub-btn primary wide" onclick="CPX.doCampaign()">Launch campaign</button>`);
  }
  function doCampaign() {
    const v = id => ($(id) || {}).value;
    const r = CPM.addCampaign(cidNow(), { title: v('cpx-fc-t'), desc: v('cpx-fc-d'), goal: v('cpx-fc-g'), days: v('cpx-fc-days'), milestones: v('cpx-fc-m') });
    if (r.error) { toast(r.error); return; }
    closeModal(); repaint();
    toast('Campaign launched');
  }
  function release(fid, i) {
    const r = CPM.releaseMilestone(cidNow(), fid, i);
    toast(r.error || 'Milestone released — recorded in the history');
    repaint();
  }

  /* ══════════════════════════════════════════════════════════════════
     Additions to existing screens
     ══════════════════════════════════════════════════════════════════ */

  function homePanels(cid) {
    if (!CMD.isJoined(cid)) return '';
    const open = CPM.missions(cid).map(m => ({ m, st: CPM.missionState(cid, m) })).filter(x => x.st.status !== 'done')
      .sort((a, b) => (b.st.status === 'ready') - (a.st.status === 'ready') || b.st.pct - a.st.pct).slice(0, 3);
    const voting = CPM.proposals(cid).filter(p => p.status === 'voting').slice(0, 2);
    const k = CPM.collabsFor(cid).filter(x => x.status !== 'done').slice(0, 2);
    return `
      <section class="hub-panel">
        <h3 class="hub-h3">${ico('flag')}Missions</h3>
        ${open.map(({ m, st }) => `<button class="cpx-hrow" onclick="CPX.go('missions')">${ico(m.icon)}<div><b>${esc(m.title)}</b>
          <div class="cpx-prog"><i style="width:${st.pct}%"></i></div></div><span>${st.status === 'ready' ? 'Claim' : '+' + m.points}</span></button>`).join('') || '<p class="hub-none">All missions complete.</p>'}
      </section>
      <section class="hub-panel">
        <h3 class="hub-h3">${ico('how_to_vote')}Open votes</h3>
        ${voting.map(p => `<button class="cpx-hrow col" onclick="CPX.go('governance');CPX.openProp('${p.id}')"><b>${esc(p.title)}</b>${voteBar(p)}</button>`).join('') || '<p class="hub-none">Nothing to vote on right now.</p>'}
      </section>
      ${k.length ? `<section class="hub-panel">
        <h3 class="hub-h3">${ico('handshake')}Collaborations</h3>
        ${k.map(x => `<button class="cpx-hrow" onclick="CPX.go('collabs');CPX.openCollab('${x.id}')">${ico(x.kind === 'event' ? 'event' : 'construction')}<div><b>${esc(x.title)}</b>
          <span>${x.communities.map(id => esc((CMD.byId(id) || {}).name || id)).join(' × ')}</span></div></button>`).join('')}
      </section>` : ''}`;
  }

  const msgTools = (cid, ch, m) => (m.kind === 'system' || m.kind === 'poll' || !CMD.isJoined(cid)) ? ''
    : `<button onclick="CPX.msgToKB('${ch.id}','${m.id}')" title="Save to knowledge base">${ico('library_add')}</button>`;

  function eventExtra(cid, e) {
    const going = (e.going || []).indexOf(CMD.me().handle) > -1;
    if (CPM.checkedIn(cid, e.id)) return `<span class="cpx-pill ok">${ico('verified')}Badge earned</span>`;
    const started = e.start - Date.now() < 10 * 60000;
    const open = Date.now() < e.start + (e.mins + 24 * 60) * 60000;
    if (going && started && open) return `<button class="hub-btn sm primary" onclick="CPX.checkIn('${e.id}')">${ico('where_to_vote')}Check in</button>`;
    return '';
  }
  function checkIn(eid) {
    const r = CPM.checkIn(cidNow(), eid);
    if (r.error) { toast(r.error); return; }
    toast(`Checked in — “${r.badge.title}” credential added to your Passport`);
    repaint();
  }

  function memberExtra(cid, m) {
    if (m.bot) return '';
    if (m.you) return `<button class="hub-btn" onclick="HUB.closeModal();HUB.backToHub();HUB.hubTab('passport')">${ico('badge')}My passport</button>`;
    return `<button class="hub-btn" onclick="CPX.openPerson('${cid}','${esc(m.handle)}')">${ico('badge')}Passport</button>`;
  }

  const boardExtra = (cid, p) => CMD.isJoined(cid) ? `<button class="hub-act" onclick="CPX.boardToKB('${p.id}')">${ico('library_add')}Save to knowledge</button>` : '';

  function feedExtra(cid, p) {
    if (!p.mine) return '';
    const key = `cf:${cid}:${p.id}`;
    const v = CPM.viral(key);
    if (v && v.status === 'published') return `<span class="cpx-pill hot">${ico('local_fire_department')}In Trending</span>`;
    const on = v && v.noms && v.noms.indexOf(CMD.me().handle) > -1;
    return `<button class="hub-act${on ? ' sel' : ''}" onclick="CPX.nominate('${key}')">${ico('rocket_launch')}${on ? 'Nominated' : 'Nominate'}</button>`;
  }

  Object.assign(CPX, {
    communityTab, wireCommunity, go,
    claim, openSubmit, submit,
    govTab, openProp, closeProp, vote, commentProp, closeEarly, withdraw, openImplement, doImplement, openPropose, doPropose,
    verifyHistory, exportHistory, openSpend, doSpend, approveSpend, openBack, doBack, openCampaign, doCampaign, release,
    homePanels, msgTools, eventExtra, checkIn, memberExtra, boardExtra, feedExtra, voteBar
  });
})();

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
publish('pages/communeplus-community.js', {});
