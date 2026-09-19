/* ╔══════════════════════════════════════════════════════════════════╗
   ║  WEB3 COMMUNITIES                                                ║
   ║                                                                  ║
   ║   • Cross-chain communities — one social layer, many ecosystems  ║
   ║   • Token gating — access checked against what your wallet holds ║
   ║   • Governance — proposal → discussion → vote → result           ║
   ║   • Asset Lab — issue the tokens that gate and weight the above  ║
   ║                                                                  ║
   ║  Vote weight and gate checks both read AL.balanceOf(), so a      ║
   ║  token minted in the Asset Lab immediately does real work here.  ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CM = (() => {

  const KEY = 'ts_web3communities';

  const SEED = [
    { id: 'c1', name: 'Ethereum Builders', emoji: '⟠', color: '#627EEA',
      desc: 'Protocol devs, rollup researchers and anyone shipping on the EVM.',
      chains: ['ethereum', 'base', 'arbitrum', 'polygon'], members: 18400, gate: null, treasury: 4200 },
    { id: 'c2', name: 'Solana Collective', emoji: '◎', color: '#14F195',
      desc: 'High-throughput apps, consumer crypto and on-chain order books.',
      chains: ['solana'], members: 12750, gate: null, treasury: 3100 },
    { id: 'c3', name: 'Multichain DeFi', emoji: '🌐', color: '#7C4DFF',
      desc: 'Yield, liquidity and risk — discussed across every ecosystem at once.',
      chains: ['ethereum', 'solana', 'polygon', 'base', 'arbitrum', 'bnb'], members: 9320, gate: null, treasury: 8800 },
    { id: 'c4', name: 'NFT Creators Guild', emoji: '🎨', color: '#FF7043',
      desc: 'Artists and collectors shipping drops. Holders-only channels inside.',
      chains: ['ethereum', 'base', 'solana'], members: 6180, gate: { ref: 'ETH', min: 0.05 }, treasury: 1500 },
    { id: 'c5', name: 'Trending Founders', emoji: '🚀', color: '#26A69A',
      desc: 'Private circle for TREND holders shaping the platform roadmap.',
      chains: ['base', 'polygon'], members: 2410, gate: { ref: 'TREND', min: 100 }, treasury: 12000 }
  ];

  const SEED_PROPOSALS = [
    { id: 'p1', communityId: 'c3', title: 'Fund the cross-chain bridge audit',
      body: 'Allocate 2,500 TREND from the treasury to commission an independent audit of the bridge contracts before the public launch. The alternative is shipping unaudited, which we should not do.',
      options: [{ label: 'Approve funding', votes: 0, voters: [] }, { label: 'Reject', votes: 0, voters: [] }, { label: 'Reduce to 1,000', votes: 0, voters: [] }],
      quorum: 50, weighting: 'member', ends: Date.now() + 4 * 86400000, status: 'active', discussion: [
        { author: 'Dev Kumar', handle: '@devk', text: 'Audit first. We have seen what happens to unaudited bridges.', t: Date.now() - 7200000 },
        { author: 'Zara Ahmed', handle: '@zaraa', text: '2,500 feels high — has anyone got quotes from more than one firm?', t: Date.now() - 3600000 }
      ] },
    { id: 'p2', communityId: 'c5', title: 'Set creator revenue split at 90/10',
      body: 'Ratify the 90% creator / 10% platform split as the permanent default for all creator rewards, rather than leaving it adjustable by the team.',
      options: [{ label: 'Ratify 90/10', votes: 0, voters: [] }, { label: 'Keep it adjustable', votes: 0, voters: [] }],
      quorum: 30, weighting: 'token', ends: Date.now() + 2 * 86400000, status: 'active', discussion: [
        { author: 'Luna Park', handle: '@lunap', text: 'Locking it in is the whole point. Creators need to be able to plan.', t: Date.now() - 5400000 }
      ] }
  ];

  const DEFAULT = { communities: SEED, proposals: SEED_PROPOSALS, joined: [], tab: 'communities', chainFilter: 'all', activeCommunity: null };
  let M = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      const p = JSON.parse(raw);
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...p };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(M)); } catch (e) {} }

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const me = () => (typeof S !== 'undefined' && S.user ? S.user.handle : '@guest');
  const chains = () => (typeof AL !== 'undefined' ? AL.CHAINS : {});
  const num = v => (v || 0).toLocaleString('en-US', { maximumFractionDigits: 4 });

  const byId = id => M.communities.find(c => c.id === id);
  const isJoined = id => M.joined.includes(id);

  /* ── Token gating ───────────────────────────────────────────────── */
  /* A gate is satisfied by holding enough of an issued asset OR enough
     of a traded coin — AL.balanceOf resolves both. */
  function gateStatus(c) {
    if (!c || !c.gate) return { open: true, ok: true };
    const held = typeof AL !== 'undefined' ? AL.balanceOf(c.gate.ref) : 0;
    return { open: false, ok: held >= c.gate.min, held, need: c.gate.min, ref: c.gate.ref };
  }

  function join(id) {
    const c = byId(id);
    if (!c) return;
    if (isJoined(id)) {
      M.joined = M.joined.filter(x => x !== id);
      c.members--;
      save(); paint();
      toast(`Left ${c.name}`);
      return;
    }
    const g = gateStatus(c);
    if (!g.ok) {
      toast(`🔒 Requires ${num(g.need)} ${g.ref} — your wallet holds ${num(g.held)}`);
      return;
    }
    M.joined.push(id);
    c.members++;
    save(); paint();
    toast(`Joined ${c.name}${c.gate ? ' — gate passed 🔓' : ''}`);
    if (typeof SF !== 'undefined') SF.earn('join_community');
  }

  function createCommunity(form) {
    const name = String(form.name || '').trim();
    if (!name) return toast('Give the community a name.');
    const picked = form.chains || [];
    if (!picked.length) return toast('Pick at least one chain.');

    const gate = form.gateRef ? { ref: String(form.gateRef).toUpperCase(), min: parseFloat(form.gateMin) || 0 } : null;
    const c = {
      id: 'c' + Date.now(), name, emoji: form.emoji || '🌐', color: '#7C4DFF',
      desc: String(form.desc || '').trim() || 'A new Web3 community.',
      chains: picked, members: 1, gate, treasury: 0, mine: true
    };
    M.communities.unshift(c);
    M.joined.push(c.id);
    save(); closeModal(); paint();
    toast(`${name} created across ${picked.length} chain${picked.length > 1 ? 's' : ''}`);
  }

  function setGate(id, ref, min) {
    const c = byId(id);
    if (!c) return;
    c.gate = ref ? { ref: String(ref).toUpperCase(), min: parseFloat(min) || 0 } : null;
    save(); paint();
    toast(c.gate ? `${c.name} now requires ${num(c.gate.min)} ${c.gate.ref} 🔒` : `${c.name} is open to everyone`);
  }

  /* ── Governance ─────────────────────────────────────────────────── */
  /* Weight is either one-member-one-vote, or by holding of the gate
     asset when the community is token-weighted. */
  function voteWeight(prop) {
    if (prop.weighting !== 'token') return 1;
    const c = byId(prop.communityId);
    const ref = c && c.gate ? c.gate.ref : null;
    if (!ref || typeof AL === 'undefined') return 1;
    return Math.max(1, Math.floor(AL.balanceOf(ref)));
  }

  const hasVoted = p => p.options.some(o => o.voters.includes(me()));

  function totalVotes(p) { return p.options.reduce((s, o) => s + o.votes, 0); }

  function vote(propId, optIdx) {
    const p = M.proposals.find(x => x.id === propId);
    if (!p) return;
    if (p.status !== 'active') return toast('Voting has closed on this proposal.');
    if (!isJoined(p.communityId)) return toast('Join the community to vote.');
    if (hasVoted(p)) return toast('You already voted on this proposal.');

    const w = voteWeight(p);
    p.options[optIdx].votes += w;
    p.options[optIdx].voters.push(me());
    save(); paint();
    toast(`Vote cast with weight ${w}${p.weighting === 'token' ? ' (token-weighted)' : ''}`);
    if (typeof SF !== 'undefined') SF.rep('write_comment');
  }

  /* Close a proposal and record the outcome against quorum. */
  function closeProposal(id) {
    const p = M.proposals.find(x => x.id === id);
    if (!p || p.status !== 'active') return;
    const total = totalVotes(p);
    const winner = p.options.reduce((a, b) => (b.votes > a.votes ? b : a), p.options[0]);
    p.status = total >= p.quorum ? 'passed' : 'failed_quorum';
    p.result = { winner: winner.label, votes: winner.votes, total, quorum: p.quorum };
    save(); paint();
    toast(p.status === 'passed'
      ? `Passed — "${winner.label}" with ${winner.votes} of ${total} votes`
      : `Failed quorum — ${total} of ${p.quorum} votes needed`);
  }

  function createProposal(form) {
    const title = String(form.title || '').trim();
    const body = String(form.body || '').trim();
    const opts = String(form.options || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!title) return toast('Give the proposal a title.');
    if (!body) return toast('Describe what is being decided.');
    if (opts.length < 2) return toast('Add at least two options, one per line.');
    if (!M.joined.length) return toast('Join a community before proposing.');

    M.proposals.unshift({
      id: 'p' + Date.now(),
      communityId: form.communityId,
      title, body,
      options: opts.map(o => ({ label: o, votes: 0, voters: [] })),
      quorum: parseInt(form.quorum, 10) || 10,
      weighting: form.weighting || 'member',
      ends: Date.now() + (parseInt(form.days, 10) || 3) * 86400000,
      status: 'active',
      discussion: [],
      mine: true
    });
    save(); closeModal(); M.tab = 'governance'; paint();
    toast('Proposal opened for discussion and voting');
  }

  function discuss(propId, text) {
    const p = M.proposals.find(x => x.id === propId);
    const t = String(text || '').trim();
    if (!p || !t) return;
    const u = (typeof S !== 'undefined' && S.user) ? S.user : { fname: 'Guest', lname: '', handle: '@guest' };
    p.discussion.push({ author: `${u.fname} ${u.lname}`.trim(), handle: u.handle, text: t, t: Date.now() });
    save(); paint();
    if (typeof SF !== 'undefined') SF.earn('write_comment');
  }

  /* ── UI ─────────────────────────────────────────────────────────── */
  function setTab(t) { M.tab = t; save(); paint(); }

  /* Embedded mode: the Community pane owns the tab bar now, so paint()
     renders only the body and its action button. */
  let embedded = false;
  function setEmbedded(v) { embedded = !!v; }
  function setChain(c) { M.chainFilter = c; save(); paint(); }

  function chainPills(list) {
    const C = chains();
    return `<div class="cm-chains">${list.map(k => {
      const ch = C[k];
      return ch ? `<span class="cm-chain" style="--c:${ch.color}">${esc(ch.label)}</span>` : '';
    }).join('')}</div>`;
  }

  function paint() {
    const root = document.getElementById('cm-root');
    if (!root) return;
    const tabs = [['communities', 'Communities'], ['governance', 'Governance'], ['assets', 'Asset Lab']];
    const action = `<button class="btn btn-ghost btn-sm cm-new" onclick="CM.${M.tab === 'governance' ? 'openProposalForm' : M.tab === 'assets' ? 'openAssetForm' : 'openCommunityForm'}()">
          <span class="material-symbols-rounded ms-16">add</span>
          ${M.tab === 'governance' ? 'New proposal' : M.tab === 'assets' ? 'Create asset' : 'New community'}
        </button>`;
    root.innerHTML = `
      <div class="cm-tabs${embedded ? ' cm-tabs-embedded' : ''}">
        ${embedded ? '' : tabs.map(([k, l]) => `<button class="p2p-tab${M.tab === k ? ' active' : ''}" onclick="CM.setTab('${k}')">${l}</button>`).join('')}
        ${action}
      </div>
      <div id="cm-body">${M.tab === 'communities' ? communitiesHTML() : M.tab === 'governance' ? governanceHTML() : assetsHTML()}</div>`;
  }

  function communitiesHTML() {
    const C = chains();
    const filterChips = ['all', ...Object.keys(C)].map(k => `
      <button class="chip${M.chainFilter === k ? ' active' : ''}" onclick="CM.setChain('${k}')">
        ${k === 'all' ? 'All chains' : esc(C[k].label)}
      </button>`).join('');

    const list = M.communities.filter(c => M.chainFilter === 'all' || c.chains.includes(M.chainFilter));

    const cards = list.map(c => {
      const g = gateStatus(c);
      const joined = isJoined(c.id);
      return `
      <div class="card cm-card">
        <div class="cm-card-top">
          <div class="cm-emoji" style="background:${c.color}22; color:${c.color}">${esc(c.emoji)}</div>
          <div class="cm-id">
            <div class="cm-name">${esc(c.name)}${c.gate ? ' <span class="cm-lock" title="Token-gated">🔒</span>' : ''}</div>
            <div class="cm-meta">${c.members.toLocaleString()} members · treasury ${num(c.treasury)} TREND</div>
          </div>
        </div>
        <p class="cm-desc">${esc(c.desc)}</p>
        ${chainPills(c.chains)}
        ${c.gate ? `<div class="cm-gate${g.ok ? ' ok' : ''}">
          <span class="material-symbols-rounded ms-16">${g.ok ? 'lock_open' : 'lock'}</span>
          Requires <b>${num(g.need)} ${esc(g.ref)}</b> · you hold <b>${num(g.held)}</b>
        </div>` : ''}
        <div class="cm-acts">
          <button class="btn btn-sm ${joined ? 'btn-ghost' : 'btn-primary'}" onclick="CM.join('${c.id}')">
            ${joined ? '✓ Joined' : c.gate && !g.ok ? '🔒 Locked' : 'Join'}
          </button>
          <button class="btn btn-ghost btn-sm" onclick="CM.openGateForm('${c.id}')">Gate</button>
        </div>
      </div>`;
    }).join('') || '<div class="p2p-empty">No communities on that chain yet.</div>';

    return `
      <div class="sf-sec-sub">One social layer across every ecosystem — a community can span several chains at once, and members join from whichever they use.</div>
      <div class="w3-chips">${filterChips}</div>
      <div class="cm-grid">${cards}</div>`;
  }

  function governanceHTML() {
    if (!M.proposals.length) return '<div class="p2p-empty">No proposals yet.</div>';

    return `<div class="cm-props">${M.proposals.map(p => {
      const c = byId(p.communityId);
      const total = totalVotes(p);
      const quorumPct = Math.min(100, Math.round((total / p.quorum) * 100));
      const voted = hasVoted(p);
      const joined = isJoined(p.communityId);
      const days = Math.max(0, Math.ceil((p.ends - Date.now()) / 86400000));

      const bars = p.options.map((o, i) => {
        const share = total > 0 ? Math.round((o.votes / total) * 100) : 0;
        const mine = o.voters.includes(me());
        return `
          <button class="cm-opt${mine ? ' mine' : ''}" ${p.status === 'active' && !voted && joined ? `onclick="CM.vote('${p.id}',${i})"` : 'disabled'}>
            <span class="cm-opt-bar" style="width:${share}%"></span>
            <span class="cm-opt-l">${mine ? '✓ ' : ''}${esc(o.label)}</span>
            <span class="cm-opt-v">${o.votes} · ${share}%</span>
          </button>`;
      }).join('');

      return `
      <div class="card cm-prop">
        <div class="cm-prop-top">
          <div>
            <div class="cm-prop-c">${esc(c ? c.name : 'Community')} · ${p.weighting === 'token' ? 'token-weighted' : 'one member, one vote'}</div>
            <h3 class="cm-prop-t">${esc(p.title)}</h3>
          </div>
          <span class="p2p-status ${p.status === 'active' ? 'warn' : p.status === 'passed' ? 'ok' : 'off'}">
            ${p.status === 'active' ? `${days}d left` : p.status === 'passed' ? 'Passed' : 'Failed quorum'}
          </span>
        </div>
        <p class="cm-prop-b">${esc(p.body)}</p>

        <div class="cm-opts">${bars}</div>

        <div class="cm-quorum">
          <div class="cm-quorum-bar"><span style="width:${quorumPct}%"></span></div>
          <span>${total} / ${p.quorum} votes for quorum</span>
        </div>

        ${p.result ? `<div class="cm-result">Result — <b>${esc(p.result.winner)}</b> with ${p.result.votes} of ${p.result.total} votes</div>` : ''}

        ${!joined ? `<div class="cm-hint">Join ${esc(c ? c.name : 'this community')} to vote.
             <button class="btn btn-primary btn-sm" onclick="CM.join('${p.communityId}')">Join</button></div>`
          : voted && p.status === 'active' ? '<div class="cm-hint">You have voted.</div>' : ''}

        <div class="cm-disc">
          <div class="tr-sec-t">Discussion · ${p.discussion.length}</div>
          ${p.discussion.map(d => `
            <div class="cm-msg">
              <b>${esc(d.author)}</b> <span class="tc-3">${esc(d.handle)}</span>
              <div>${esc(d.text)}</div>
            </div>`).join('') || '<div class="sf-empty">No comments yet.</div>'}
          <div class="ct-row mt8">
            <input class="input" id="disc-${p.id}" placeholder="Add to the discussion…">
            <button class="btn btn-ghost btn-sm" onclick="CM.discuss('${p.id}', document.getElementById('disc-${p.id}').value); document.getElementById('disc-${p.id}').value=''">Post</button>
          </div>
        </div>

        ${p.status === 'active' ? `<button class="btn btn-ghost btn-sm mt8" onclick="CM.closeProposal('${p.id}')">Close & tally</button>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  function assetsHTML() {
    if (typeof AL === 'undefined') return '<div class="p2p-empty">Asset Lab unavailable.</div>';
    const list = AL.list();
    const C = chains();

    const cards = list.map(a => {
      const ch = C[a.chain] || { label: a.chain, color: 'var(--t3)' };
      const left = a.supply - a.minted;
      return `
      <div class="card cm-asset">
        <div class="cm-card-top">
          <div class="cm-emoji" style="background:${ch.color}22">${esc(a.emoji)}</div>
          <div class="cm-id">
            <div class="cm-name">${esc(a.name)} <span class="tc-3 fs11">${esc(a.symbol)}</span></div>
            <div class="cm-meta">${esc(AL.TEMPLATES[a.template].label)} · <span style="color:${ch.color}">${esc(ch.label)}</span>${a.soulbound ? ' · non-transferable' : ''}</div>
          </div>
        </div>
        ${a.description ? `<p class="cm-desc">${esc(a.description)}</p>` : ''}
        <div class="cm-asset-stats">
          <div><span>You hold</span><b>${num(a.balance)}</b></div>
          <div><span>Minted</span><b>${num(a.minted)} / ${num(a.supply)}</b></div>
          <div><span>Remaining</span><b>${num(left)}</b></div>
          ${a.royalty ? `<div><span>Royalty</span><b>${a.royalty}%</b></div>` : ''}
        </div>
        <div class="ct-row">
          <input class="input" id="mint-${a.id}" type="number" step="any" placeholder="Amount">
          <button class="btn btn-primary btn-sm" onclick="CM.doMint('${a.id}')">Mint</button>
        </div>
        <div class="ct-row mt8">
          <input class="input" id="to-${a.id}" placeholder="@handle">
          <input class="input" id="amt-${a.id}" type="number" step="any" placeholder="Amount">
          <button class="btn btn-ghost btn-sm" onclick="CM.doTransfer('${a.id}')">Send</button>
        </div>
        <div class="cm-acts mt8">
          <button class="btn btn-ghost btn-sm" onclick="CM.doBurn('${a.id}')">Burn</button>
          <button class="btn btn-ghost btn-sm" onclick="CM.removeAsset('${a.id}')">Delete</button>
        </div>
      </div>`;
    }).join('') || '<div class="p2p-empty">No assets yet. Create one to gate a community or weight its votes.</div>';

    return `
      <div class="sf-sec-sub">Issue a collectible, membership token, community token or access pass. Anything you create here can gate a community or weight its governance.</div>
      <div class="cm-grid">${cards}</div>`;
  }

  /* ── Asset actions (thin wrappers so the UI repaints) ────────────── */
  function doMint(id) {
    const el = document.getElementById('mint-' + id);
    const r = AL.mint(id, el ? el.value : 1);
    toast(r.msg); if (r.ok) paint();
  }
  function doTransfer(id) {
    const to = document.getElementById('to-' + id), amt = document.getElementById('amt-' + id);
    const r = AL.transfer(id, to ? to.value : '', amt ? amt.value : 0);
    toast(r.msg); if (r.ok) paint();
  }
  function doBurn(id) {
    const el = document.getElementById('mint-' + id);
    const r = AL.burn(id, el ? el.value : 0);
    toast(r.msg); if (r.ok) paint();
  }
  function removeAsset(id) { AL.remove(id); paint(); toast('Asset removed'); }

  /* ── Modals ─────────────────────────────────────────────────────── */
  function shell(inner) {
    closeModal();
    const el = document.createElement('div');
    el.id = 'cm-modal';
    el.className = 'sf-overlay';
    el.onclick = e => { if (e.target === el) closeModal(); };
    el.innerHTML = `<div class="card p2p-modal">
      <button class="icon-btn sf-close" onclick="CM.closeModal()" aria-label="Close"><span class="material-symbols-rounded">close</span></button>
      ${inner}</div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('open'), 20);
  }

  function closeModal() {
    const el = document.getElementById('cm-modal');
    if (el) { el.classList.remove('open'); setTimeout(() => el.remove(), 200); }
  }

  function openCommunityForm() {
    const C = chains();
    shell(`
      <h3 class="fw9 tc-1 m0">New community</h3>
      <div class="fs12 tc-3 mb16">Pick every chain your members trade on — they all land in the same space.</div>
      <label class="form-label">Name</label>
      <input class="input mb8" id="cm-name" placeholder="Base Builders">
      <label class="form-label">Description</label>
      <input class="input mb8" id="cm-desc" placeholder="What is this community for?">
      <label class="form-label">Icon</label>
      <input class="input mb8" id="cm-emoji" maxlength="2" placeholder="🌐">
      <label class="form-label">Chains</label>
      <div class="cm-chain-pick mb8">
        ${Object.entries(C).map(([k, v]) => `
          <label class="cm-cbx"><input type="checkbox" value="${k}" class="cm-chain-cb"> <span style="--c:${v.color}">${esc(v.label)}</span></label>`).join('')}
      </div>
      <label class="form-label">Token gate (optional)</label>
      <div class="ct-row mb12">
        <input class="input" id="cm-gate-ref" placeholder="Symbol e.g. TREND">
        <input class="input" id="cm-gate-min" type="number" step="any" placeholder="Min amount">
      </div>
      <button class="btn btn-primary w100" onclick="CM.createCommunity({
        name: document.getElementById('cm-name').value,
        desc: document.getElementById('cm-desc').value,
        emoji: document.getElementById('cm-emoji').value,
        chains: [...document.querySelectorAll('.cm-chain-cb:checked')].map(c=>c.value),
        gateRef: document.getElementById('cm-gate-ref').value,
        gateMin: document.getElementById('cm-gate-min').value })">Create community</button>`);
  }

  function openGateForm(id) {
    const c = byId(id);
    if (!c) return;
    shell(`
      <h3 class="fw9 tc-1 m0">Token gate</h3>
      <div class="fs12 tc-3 mb16">${esc(c.name)} — access is checked against your wallet on join.</div>
      <label class="form-label">Required asset (symbol)</label>
      <input class="input mb8" id="g-ref" placeholder="TREND, ETH, or one you issued" value="${c.gate ? esc(c.gate.ref) : ''}">
      <label class="form-label">Minimum held</label>
      <input class="input mb12" id="g-min" type="number" step="any" value="${c.gate ? c.gate.min : ''}">
      <div style="display:flex; gap:8px">
        <button class="btn btn-primary" style="flex:2" onclick="CM.setGate('${id}', document.getElementById('g-ref').value, document.getElementById('g-min').value); CM.closeModal()">Apply gate</button>
        <button class="btn btn-ghost" style="flex:1" onclick="CM.setGate('${id}', null); CM.closeModal()">Remove</button>
      </div>`);
  }

  function openProposalForm() {
    const joined = M.communities.filter(c => isJoined(c.id));
    if (!joined.length) return toast('Join a community before proposing.');
    shell(`
      <h3 class="fw9 tc-1 m0">New proposal</h3>
      <div class="fs12 tc-3 mb16">Proposal → discussion → vote → recorded result.</div>
      <label class="form-label">Community</label>
      <select class="input mb8" id="pr-c">${joined.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <label class="form-label">Title</label>
      <input class="input mb8" id="pr-t" placeholder="Should the treasury fund…">
      <label class="form-label">Details</label>
      <textarea class="input mb8" id="pr-b" rows="3" placeholder="What exactly is being decided, and why now?"></textarea>
      <label class="form-label">Options — one per line</label>
      <textarea class="input mb8" id="pr-o" rows="3" placeholder="Approve&#10;Reject"></textarea>
      <div class="ct-row mb8">
        <label style="flex:1"><span class="form-label">Quorum</span><input class="input" id="pr-q" type="number" value="10"></label>
        <label style="flex:1"><span class="form-label">Days open</span><input class="input" id="pr-d" type="number" value="3"></label>
      </div>
      <label class="form-label">Vote weighting</label>
      <select class="input mb12" id="pr-w">
        <option value="member">One member, one vote</option>
        <option value="token">Token-weighted (by gate asset)</option>
      </select>
      <button class="btn btn-primary w100" onclick="CM.createProposal({
        communityId: document.getElementById('pr-c').value,
        title: document.getElementById('pr-t').value,
        body: document.getElementById('pr-b').value,
        options: document.getElementById('pr-o').value,
        quorum: document.getElementById('pr-q').value,
        days: document.getElementById('pr-d').value,
        weighting: document.getElementById('pr-w').value })">Open proposal</button>`);
  }

  function openAssetForm() {
    const T = AL.TEMPLATES, C = chains();
    shell(`
      <h3 class="fw9 tc-1 m0">Create Web3 asset</h3>
      <div class="fs12 tc-3 mb16">Pick a template — the rest is naming.</div>
      <label class="form-label">Template</label>
      <select class="input mb8" id="a-tpl" onchange="CM.syncAssetForm()">
        ${Object.entries(T).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}
      </select>
      <div class="cm-tpl-blurb fs11 tc-3 mb8" id="a-blurb">${esc(T.collectible.blurb)}</div>
      <label class="form-label">Name</label>
      <input class="input mb8" id="a-name" placeholder="Founding Members">
      <div class="ct-row mb8">
        <label style="flex:1"><span class="form-label">Symbol</span><input class="input" id="a-sym" maxlength="10" placeholder="FOUND"></label>
        <label style="flex:1"><span class="form-label">Icon</span><input class="input" id="a-emoji" maxlength="2" placeholder="🎨"></label>
      </div>
      <label class="form-label">Chain</label>
      <select class="input mb8" id="a-chain">
        ${Object.entries(C).map(([k, v]) => `<option value="${k}">${esc(v.label)} — ${esc(v.std)}</option>`).join('')}
      </select>
      <div class="ct-row mb8">
        <label style="flex:1"><span class="form-label">Supply</span><input class="input" id="a-supply" type="number" value="100"></label>
        <label style="flex:1"><span class="form-label">Royalty %</span><input class="input" id="a-roy" type="number" value="5"></label>
      </div>
      <label class="form-label">Description</label>
      <input class="input mb12" id="a-desc" placeholder="What does holding this get you?">
      <button class="btn btn-primary w100" onclick="CM.submitAsset()">Create asset</button>`);
  }

  function syncAssetForm() {
    const sel = document.getElementById('a-tpl');
    if (!sel) return;
    const t = AL.TEMPLATES[sel.value];
    const b = document.getElementById('a-blurb');
    if (b) b.textContent = t.blurb;
    const s = document.getElementById('a-supply'); if (s) s.value = t.defaults.supply;
    const r = document.getElementById('a-roy');    if (r) r.value = t.defaults.royalty;
    const e = document.getElementById('a-emoji');  if (e) e.placeholder = t.defaults.emoji;
  }

  function submitAsset() {
    const g = id => (document.getElementById(id) || {}).value;
    const r = AL.create({
      template: g('a-tpl'), name: g('a-name'), symbol: g('a-sym'),
      emoji: g('a-emoji'), chain: g('a-chain'), supply: g('a-supply'),
      royalty: g('a-roy'), description: g('a-desc')
    });
    toast(r.msg);
    if (r.ok) { closeModal(); M.tab = 'assets'; paint(); }
  }

  return {
    paint, setTab, setEmbedded, setChain, join, createCommunity, setGate, gateStatus,
    vote, closeProposal, createProposal, discuss, voteWeight, totalVotes,
    doMint, doTransfer, doBurn, removeAsset,
    openCommunityForm, openGateForm, openProposalForm, openAssetForm,
    syncAssetForm, submitAsset, closeModal,
    isJoined, byId, get state() { return M; }
  };
})();

window.CM = CM;

function getDaoTemplate() {
  return `<section id="pane-dao" class="pane">
    <h1 class="pane-title" style="display:flex; align-items:center; gap:10px">
      <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:#7C4DFF">hub</span>
      <span>Web3</span> Communities
    </h1>
    <div class="tr-banner">
      <span class="material-symbols-rounded ms-16">info</span>
      Simulated issuance and governance. Assets are not deployed to a chain and votes are not settled on-chain — gates and vote weights are checked against your in-app balances.
    </div>
    <div id="cm-root"></div>
  </section>`;
}

function renderDao() { CM.paint(); }

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
publish('pages/web3communities.js', {
  CM: () => CM, getDaoTemplate: () => getDaoTemplate,
  renderDao: () => renderDao
});
