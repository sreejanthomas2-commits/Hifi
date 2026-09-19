/* ╔══════════════════════════════════════════════════════════════════╗
   ║  COMMUNE STUDIO+ — owner tools for Commune Hub+                   ║
   ║                                                                   ║
   ║  New tabs: Content · AI · Monetization · Governance · Web3        ║
   ║  Added to existing tabs: Rewards (missions & reviews) and         ║
   ║  Integrations (mini apps & the Open Community API).               ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CPS = (() => {
  const { esc, toast, $, compact, money, ago, ico, modal, closeModal, download, copy, short } = CPX.h;
  const D = () => CMD.state();
  const cidNow = () => D().cid;
  const repaint = () => CST.repaint();
  const TABS = ['content', 'ai', 'monetization', 'governance', 'web3'];
  const has = t => TABS.indexOf(t) > -1;

  function head(title, sub, actions) {
    return `<header class="cst-head"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>${actions ? `<div class="cst-head-a">${actions}</div>` : ''}</header>`;
  }
  const lock = perm => `<span class="cst-lock" title="Needs the ${perm} permission">${ico('lock')}</span>`;
  const cards = list => `<div class="cst-cards">${list.map(([l, v, i]) => `<div class="cst-card">${i ? ico(i) : ''}<b>${v}</b><span>${l}</span></div>`).join('')}</div>`;

  function body(cid, tab) {
    try {
      switch (tab) {
        case 'content':      return content(cid);
        case 'ai':           return ai(cid);
        case 'monetization': return monetization(cid);
        case 'governance':   return governance(cid);
        case 'web3':         return web3(cid);
      }
    } catch (e) { console.error(e); return `<div class="hub-none">This tab hit a problem: ${esc(e.message)}</div>`; }
    return '';
  }

  /* ── Content ─────────────────────────────────────────────────────── */
  function content(cid) {
    const queue = CPM.viralQueue(cid);
    const posts = CMD.feed(cid);
    const arts = CPM.kb(cid);
    const canPub = CMD.can(cid, 'broadcast');
    const canMod = CMD.can(cid, 'moderate');
    return `
      ${head('Content', 'What your community publishes, what is ready to go viral, and what belongs in the knowledge base.')}
      ${cards([['Community posts', compact(posts.length), 'dynamic_feed'], ['Trending candidates', compact(queue.length), 'rocket_launch'],
        ['In Trending', compact(queue.filter(q => q.v && q.v.status === 'published').length), 'local_fire_department'], ['Knowledge articles', compact(arts.length), 'library_books']])}

      <section class="cst-panel">
        <h3>${ico('rocket_launch')}Viral queue — community posts that can enter the Trending feed</h3>
        ${queue.map(q => `<div class="cst-hook">
          <div><b>${esc((q.title || q.text).slice(0, 90))}</b><span>${esc(q.name)} · score ${q.vs} · ${(q.v && q.v.noms.length) || 0} nominations${q.seed ? ' · demo' : ''}</span></div>
          ${q.v && q.v.status === 'published' ? `<span class="cpx-pill hot">${ico('local_fire_department')}Published</span>`
            : q.v && q.v.status === 'dismissed' ? '<span class="hub-chip-s">dismissed</span>'
            : `${canPub ? `<button class="hub-btn sm primary" onclick="CPS.publish('${q.key}')">Publish to Trending</button>` : lock('broadcast')}
               ${canMod ? `<button class="hub-act" onclick="CPS.dismiss('${q.key}')" title="Dismiss">${ico('close')}</button>` : ''}`}
        </div>`).join('') || '<p class="hub-none">Posts become candidates when members nominate them or engagement passes ' + CPM.VIRAL_AT + '.</p>'}
        <p class="hub-none sm">Score = likes + replies × 3 + nominations × 25. Publishing credits the author and links back to ${esc(CMD.byId(cid).name)}.</p>
      </section>

      <section class="cst-panel">
        <h3>${ico('dynamic_feed')}Community posts</h3>
        ${posts.map(p => `<div class="cst-log"><b>${esc(p.name)}</b><span>${esc(p.text.slice(0, 90))}</span><i>${ago(p.ts)} · ${p.likes} likes</i>
          ${canMod || p.mine ? `<button class="hub-act danger" onclick="CPS.delPost('${p.id}')">${ico('delete')}</button>` : ''}</div>`).join('') || '<p class="hub-none">No posts.</p>'}
      </section>

      <section class="cst-panel">
        <h3>${ico('library_books')}Knowledge base</h3>
        ${arts.map(a => `<div class="cst-log"><span class="cst-log-a">${esc(a.cat)}</span><b>${esc(a.title)}</b><span>${esc(a.author)}${a.seed ? ' · demo' : ''}</span>
          <i>${CPM.verifyArticle(a) ? '✓ digest' : '✗ altered'}</i>${canMod ? `<button class="hub-act danger" onclick="CPS.delArticle('${a.id}')">${ico('delete')}</button>` : ''}</div>`).join('')}
        <div class="hub-acts"><button class="hub-btn sm" onclick="HUB.open('${cid}');HUB.setTab('knowledge')">${ico('open_in_new')}Open knowledge base</button>
          <button class="hub-btn sm" onclick="CPX.openArticle()">${ico('edit')}Write article</button></div>
      </section>`;
  }
  function publish(key) { const r = CPM.publishViral(key); toast(r.error || 'Published into the Trending feed'); repaint(); }
  function dismiss(key) { CPM.dismissViral(key); repaint(); }
  async function delPost(id) {
    const cid = cidNow();
    if (!(await appConfirm('Delete this post?', { ok: 'Delete', danger: true }))) return;
    const st = D();
    const p = (st.feed[cid] || []).find(x => x.id === id);
    st.feed[cid] = (st.feed[cid] || []).filter(x => x.id !== id);
    if (p && !p.mine) CMD.logMod(cid, 'delete', p.handle, 'Community post removed');
    CMD.save(); CPM.touch(); repaint();
  }
  async function delArticle(id) { if (!(await appConfirm('Delete this article?', { ok: 'Delete', danger: true }))) return; CPM.removeArticle(cidNow(), id); repaint(); }

  /* ── AI ──────────────────────────────────────────────────────────── */
  function ai(cid) {
    const s = CPM.aiSettings(cid);
    const may = CMD.can(cid, 'moderate');
    const held = CPM.held(cid);
    const log = CPM.aiLog(cid);
    const tog = (k, l, d) => `<label class="cst-rule"><input type="checkbox" ${s[k] ? 'checked' : ''} ${may ? '' : 'disabled'} onchange="CPS.setAI('${k}',this.checked)"><b>${l}</b><span>${d}</span></label>`;
    return `
      ${head('AI', 'An on-device moderator and assistant. It reads text in this browser only — no message is sent to any AI service.',
        `<label class="cst-switch"><input type="checkbox" ${s.on ? 'checked' : ''} ${may ? '' : 'disabled'} onchange="CPS.setAI('on',this.checked)"><i></i>AI Moderator ${s.on ? 'on' : 'off'}</label>`)}

      <section class="cst-panel">
        <h3>${ico('shield')}AI Moderator</h3>
        <div class="cst-rules">
          ${tog('scam', 'Scam patterns', 'Recovery-phrase requests, doubling giveaways, guaranteed returns, fake urgency.')}
          ${tog('phishing', 'Phishing links', 'Lookalike domains, punycode, raw IPs, link shorteners, “wallet sync” pages.')}
          ${tog('address', 'Wallet addresses', 'Flags posted addresses — more strongly when people are asked to send funds.')}
          ${tog('impersonation', 'Impersonation', 'Names one letter away from a moderator, and staff titles on ordinary accounts.')}
        </div>
        <div class="hub-chips">${[['relaxed', 'Relaxed'], ['balanced', 'Balanced'], ['strict', 'Strict']].map(([k, l]) =>
          `<button class="hub-chip${s.sensitivity === k ? ' on' : ''}" ${may ? `onclick="CPS.setAI('sensitivity','${k}')"` : 'disabled'}>${l}</button>`).join('')}</div>
        <p class="hub-none sm">Runs after AutoMod. Moderators are exempt. A chat message in the middle band is held for review; a high-risk one is blocked with the reason shown to the sender.</p>
      </section>

      <section class="cst-panel">
        <h3>${ico('pending_actions')}Held for review · ${held.length}</h3>
        ${held.map(h => `<div class="cpx-held">
          <div><b>${esc(h.name)} in #${esc(h.chId)}</b> <span class="cpx-risk r${Math.min(3, Math.floor(h.score / 25))}">risk ${h.score}</span>
            <p>${esc(h.text)}</p><span class="hub-none sm">${h.flags.map(f => esc(f.label)).join(' · ')}</span></div>
          ${may ? `<div class="hub-acts"><button class="hub-btn sm primary" onclick="CPS.held('${h.id}',true)">Approve</button><button class="hub-btn sm danger" onclick="CPS.held('${h.id}',false)">Reject</button></div>` : ''}
        </div>`).join('') || '<p class="hub-none">Nothing waiting.</p>'}
      </section>

      <section class="cst-panel">
        <h3>${ico('science')}Test the scanner</h3>
        <label class="hub-f"><span>Paste any message</span><textarea id="cps-ai-t" rows="3" oninput="CPS.test()" placeholder="URGENT: validate your wallet at https://uniswap-claim.io to claim the airdrop"></textarea></label>
        <div id="cps-ai-r"><p class="hub-none">Results appear as you type.</p></div>
      </section>

      <section class="cst-panel">
        <h3>${ico('manage_search')}Scan what is already here</h3>
        <button class="hub-btn sm" onclick="CPS.scan()">${ico('radar')}Scan messages, discussions and listings</button>
        <div id="cps-ai-scan"></div>
      </section>

      <section class="cst-panel">
        <h3>${ico('summarize')}Assistant</h3>
        <p class="hub-guide">Members open the assistant from the ✦ button in any channel. You can also post this week's digest to #announcements.</p>
        <div class="hub-acts">
          <button class="hub-btn sm" onclick="HUB.open('${cid}');setTimeout(()=>CPX.openAssistant('digest'),80)">${ico('auto_awesome')}Open assistant</button>
          ${CMD.can(cid, 'broadcast') ? `<button class="hub-btn sm primary" onclick="CPS.postDigest()">${ico('campaign')}Post weekly digest</button>` : lock('broadcast')}
        </div>
      </section>

      <section class="cst-panel">
        <h3>${ico('history')}AI Moderator log</h3>
        ${log.slice(0, 20).map(e => `<div class="cst-log"><span class="cst-log-a ${e.action === 'blocked' ? 'ban' : 'automod'}">${esc(e.action)}</span><b>${esc(e.handle)}</b><span>${esc(e.text.slice(0, 70))}</span><i>risk ${e.score} · ${ago(e.at)} ago</i></div>`).join('') || '<p class="hub-none">Nothing flagged yet.</p>'}
      </section>`;
  }
  function setAI(k, v) { const r = CPM.setAiSettings(cidNow(), { [k]: v }); if (r.error) toast(r.error); repaint(); }
  function resolve(id, ok) { const r = CPM.resolveHeld(cidNow(), id, ok); toast(r.error || (ok ? 'Approved — the message is posted' : 'Rejected')); repaint(); }
  const riskHTML = r => `<div class="cpx-scanres"><span class="cpx-risk r${Math.min(3, Math.floor(r.score / 25))}">risk ${r.score} · ${r.risk}</span>
    ${r.flags.map(f => `<div class="cst-log"><span class="cst-log-a ${f.kind === 'note' ? '' : 'automod'}">${esc(f.kind)}</span><span>${esc(f.label)}</span><i>+${f.w}</i></div>`).join('') || '<p class="hub-none">No risk signals.</p>'}</div>`;
  function test() {
    const box = $('cps-ai-r');
    const t = ($('cps-ai-t') || {}).value || '';
    if (box) box.innerHTML = t.trim() ? riskHTML(CPM.aiScan(t, cidNow())) : '<p class="hub-none">Results appear as you type.</p>';
  }
  function scan() {
    const box = $('cps-ai-scan');
    const list = CPM.scanCommunity(cidNow());
    if (box) box.innerHTML = list.length ? list.slice(0, 20).map(x => `<div class="cpx-held"><div><b>${esc(x.name)} · ${esc(x.where)}</b> <span class="cpx-risk r${Math.min(3, Math.floor(x.score / 25))}">risk ${x.score}</span>
      <p>${esc(String(x.text).slice(0, 160))}</p><span class="hub-none sm">${x.flags.map(f => esc(f.label)).join(' · ')}</span></div></div>`).join('')
      : '<p class="hub-none cpx-mt">Scanned — nothing with a risk signal.</p>';
  }
  function postDigest() {
    const cid = cidNow();
    const d = CPM.digest(cid, 7);
    const lines = [`**This week in ${CMD.byId(cid).name}**`, `${d.count} things happened across ${Object.keys(d.byWhere).length} places.`];
    if (d.topics.length) lines.push('Talked about: ' + d.topics.join(', '));
    d.highlights.slice(0, 3).forEach(h => lines.push(`• ${h.where}: ${(h.title || '').slice(0, 60)}`));
    d.decided.forEach(x => lines.push(`✓ ${x.action}: ${x.title}`));
    d.voting.forEach(p => lines.push(`🗳 Vote open: ${p.title}`));
    d.upcoming.forEach(e => lines.push(`📅 ${e.title}`));
    const r = CMD.post(cid, 'announce', lines.join('\n'));
    toast(r && r.error ? r.error : 'Digest posted to #announcements');
  }

  /* ── Monetization ────────────────────────────────────────────────── */
  function monetization(cid) {
    const m = CPM.money(cid);
    const list = CPM.market(cid);
    const funds = CPM.funding(cid);
    const may = CMD.can(cid, 'manage');
    const st = CPM.state();
    const opts = (st.payOpts || {})[cid] || { crypto: true, stable: true, tips: true };
    return `
      ${head('Monetization', 'Marketplace, tips, crowdfunding and memberships in one place. Everything here is simulated — no money moves.')}
      ${cards([['Listings', compact(m.listings), 'storefront'], ['Your purchases here', compact(m.sold), 'shopping_bag'], ['Tips you sent', m.tips + ' cr', 'volunteer_activism'],
        ['Crowdfunding raised', money(m.raised), 'savings'], ['Treasury', money(m.treasury), 'account_balance'], ['Demo marketplace volume', money(m.seededSales), 'insights']])}

      <section class="cst-panel">
        <h3>${ico('storefront')}Marketplace listings</h3>
        <div class="cst-table">
          <div class="cst-tr head"><span>Listing</span><span>Seller</span><span>Price</span><span>Sold</span><span>Actions</span></div>
          ${list.map(l => `<div class="cst-tr"><span class="cst-mname"><b>${esc(l.title)}</b><small>${esc(l.kind)}${l.crypto ? ' · crypto accepted' : ''}${l.seed ? ' · demo' : ''}</small></span>
            <span>${esc(l.seller)}</span><span>${l.price ? money(l.price) : 'Free'}</span><span>${compact(l.sales)}</span>
            <span class="cst-tr-a">${CMD.can(cid, 'moderate') ? `<button class="hub-act danger" onclick="CPS.unlist('${l.id}')" title="Unlist">${ico('remove_shopping_cart')}</button>` : ''}</span></div>`).join('')}
        </div>
      </section>

      <section class="cst-panel">
        <h3>${ico('savings')}Crowdfunding campaigns</h3>
        ${funds.map(f => `<div class="cst-bounty"><div><b>${esc(f.title)}</b><span>${money(CPM.raised(f))} of ${money(f.goal)} · ${compact(CPM.backers(f))} backers · ${esc(f.status)}${f.seed ? ' · demo' : ''}</span>
          <div class="cpx-prog"><i style="width:${Math.min(100, CPM.raised(f) / f.goal * 100)}%"></i></div></div></div>`).join('')}
        ${CMD.can(cid, 'moderate') || may ? `<button class="hub-btn sm primary" onclick="CPX.openCampaign()">${ico('add')}Start a campaign</button>` : ''}
      </section>

      <section class="cst-panel">
        <h3>${ico('credit_card')}Payment options</h3>
        <div class="cst-rules">
          <label class="cst-rule"><input type="checkbox" ${opts.crypto ? 'checked' : ''} ${may ? '' : 'disabled'} onchange="CPS.payOpt('crypto',this.checked)"><b>Optional crypto payments</b><span>Sellers may accept crypto alongside the normal checkout. Never required.</span></label>
          <label class="cst-rule"><input type="checkbox" ${opts.stable ? 'checked' : ''} ${may ? '' : 'disabled'} onchange="CPS.payOpt('stable',this.checked)"><b>Stablecoins only</b><span>Fixed-price items should not swing with the market.</span></label>
          <label class="cst-rule"><input type="checkbox" ${opts.tips ? 'checked' : ''} ${may ? '' : 'disabled'} onchange="CPS.payOpt('tips',this.checked)"><b>Creator tips</b><span>Daily limits, verified receiving addresses only, no pressure tactics.</span></label>
        </div>
        <h4 class="hub-h4">Safeguards that are always on</h4>
        <ul class="hub-rules">
          <li>No recovery phrases, private keys or card numbers are ever asked for.</li>
          <li>Crypto tips only go to addresses their owner connected — never a typed or pasted one.</li>
          <li>Listings and campaigns pass the AI Moderator before they publish.</li>
          <li>Backing a project is support, not investment: no returns, tokens or profit share.</li>
        </ul>
        <p class="hub-none sm">Real payments need a payment processor, a server that holds order state, and payout accounts. None exist in this build.</p>
      </section>`;
  }
  async function unlist(lid) { if (!(await appConfirm('Unlist this item?', { ok: 'Unlist', danger: true }))) return; CPM.unlist(cidNow(), lid); repaint(); }
  function payOpt(k, v) {
    const st = CPM.state();
    st.payOpts = st.payOpts || {};
    st.payOpts[cidNow()] = { ...((st.payOpts[cidNow()]) || { crypto: true, stable: true, tips: true }), [k]: v };
    CPM.save();
  }

  /* ── Governance ──────────────────────────────────────────────────── */
  function governance(cid) {
    const s = CPM.govSettings(cid);
    const may = CMD.can(cid, 'manage');
    const t = CPM.treasury(cid);
    const v = CPM.verifyGov(cid);
    const roles = CMD.roles(cid);
    const staff = CMD.members(cid).filter(m => ['owner', 'admin', 'mod'].indexOf(m.role) > -1 || m.you).map(m => m.handle);
    return `
      ${head('Governance', may ? 'Who can propose, how votes count, and how the treasury is controlled.' : 'Read-only — changing governance needs the manage permission.')}

      <section class="cst-panel">
        <h3>${ico('rule')}Proposal rules</h3>
        <div class="hub-form-row">
          <label class="hub-f"><span>Who can propose</span><select id="cps-g-role" ${may ? '' : 'disabled'}>${roles.map(r => `<option value="${r.id}"${s.proposeRole === r.id ? ' selected' : ''}>${esc(r.name)} and above</option>`).join('')}</select></label>
          <label class="hub-f"><span>Minimum reputation</span><input type="number" id="cps-g-rep" value="${s.proposeRep}" min="0" ${may ? '' : 'disabled'}></label>
        </div>
        <label class="hub-f"><span>Default voting</span><select id="cps-g-mode" ${may ? '' : 'disabled'}>${CPM.VOTE_MODES.map(m => `<option value="${m[0]}"${s.mode === m[0] ? ' selected' : ''}>${m[1]} — ${m[2]}</option>`).join('')}</select></label>
        <div class="hub-form-row">
          <label class="hub-f"><span>Quorum (votes)</span><input type="number" id="cps-g-q" value="${s.quorum}" min="1" ${may ? '' : 'disabled'}></label>
          <label class="hub-f"><span>Voting days</span><input type="number" id="cps-g-d" value="${s.days}" min="1" max="14" ${may ? '' : 'disabled'}></label>
          <label class="hub-f"><span>Pass above %</span><input type="number" id="cps-g-p" value="${s.passPct}" min="50" max="90" ${may ? '' : 'disabled'}></label>
        </div>
        <label class="hub-check"><input type="checkbox" id="cps-g-pub" ${s.publicBallots !== false ? 'checked' : ''} ${may ? '' : 'disabled'}> Public ballots — the history shows who voted for what</label>
        <div class="hub-acts"><button class="hub-btn primary" onclick="CPS.saveGov()" ${may ? '' : 'disabled'}>Save rules</button></div>
        <p class="hub-none sm">Token-weighted voting is optional and capped. Nobody ever needs a wallet to join, post or vote in a member vote.</p>
      </section>

      <section class="cst-panel">
        <h3>${ico('account_balance')}Community treasury</h3>
        ${t.enabled ? `
          <p class="hub-guide">Balance <b>${money(CPM.balance(cid))}</b> (simulated) · ${t.threshold} of ${t.signers.length} signers · attested ${t.attested ? 'by ' + esc(t.attested.by) : ''}</p>
          <label class="hub-f"><span>Signers — handles, comma separated</span><input id="cps-t-s" value="${esc(t.signers.join(', '))}" ${may ? '' : 'disabled'}></label>
          <label class="hub-f"><span>Approvals required</span><input type="number" id="cps-t-th" value="${t.threshold}" min="1" max="7" ${may ? '' : 'disabled'}></label>
          <p class="hub-none sm">Suggested: ${staff.slice(0, 5).map(esc).join(', ')}</p>
          <div class="hub-acts"><button class="hub-btn primary" onclick="CPS.saveSigners()" ${may ? '' : 'disabled'}>Save signers</button>
            <button class="hub-btn" onclick="HUB.open('${cid}');CPX.go('governance');CPX.govTab('treasury')">${ico('open_in_new')}Open treasury</button></div>`
        : `
          <p class="hub-guide">A shared budget for clearly defined projects, spent only through passed budget proposals and multi-signer approval.</p>
          <label class="cst-rule"><input type="checkbox" id="cps-t-adult" ${may ? '' : 'disabled'}><b>This community is managed by adults</b><span>Treasuries are only for adult-managed communities.</span></label>
          <label class="cst-rule"><input type="checkbox" id="cps-t-rules" ${may ? '' : 'disabled'}><b>Spending follows passed proposals</b><span>No signer can move funds without a passed budget proposal.</span></label>
          <label class="hub-f"><span>Approvals required</span><input type="number" id="cps-t-th" value="2" min="1" max="3" ${may ? '' : 'disabled'}></label>
          <button class="hub-btn primary" onclick="CPS.enableTreasury()" ${may ? '' : 'disabled'}>Switch on the treasury</button>`}
        <p class="hub-none sm">Simulated ledger. A real treasury is an on-chain multisig controlled by the signers' own wallets — Trending would only show it.</p>
      </section>

      <section class="cst-panel">
        <h3>${ico('verified')}History integrity</h3>
        <div class="cpx-proofhead ${v.ok ? 'ok' : 'bad'}">${ico(v.ok ? 'verified' : 'gpp_bad')}<div><b>${v.ok ? 'Verifies' : 'Broken at #' + v.at}</b><span>${v.count} entries · root ${short(v.root || '')}</span></div>
          <button class="hub-btn sm" onclick="CPS.exportGov()">${ico('download')}Export</button></div>
      </section>`;
  }
  function saveGov() {
    const v = id => ($(id) || {}).value;
    const r = CPM.saveGovSettings(cidNow(), { proposeRole: v('cps-g-role'), proposeRep: Math.max(0, +v('cps-g-rep') || 0), mode: v('cps-g-mode'),
      quorum: Math.max(1, +v('cps-g-q') || 1), days: Math.max(1, Math.min(14, +v('cps-g-d') || 5)), passPct: Math.max(50, Math.min(90, +v('cps-g-p') || 50)),
      publicBallots: !!($('cps-g-pub') || {}).checked });
    toast(r.error || 'Governance rules saved — the change is in the history');
    repaint();
  }
  function enableTreasury() {
    const r = CPM.enableTreasury(cidNow(), { adult: !!($('cps-t-adult') || {}).checked, rules: !!($('cps-t-rules') || {}).checked, threshold: ($('cps-t-th') || {}).value });
    toast(r.error || 'Treasury switched on');
    repaint();
  }
  function saveSigners() {
    const list = (($('cps-t-s') || {}).value || '').split(',').map(x => x.trim()).filter(Boolean).map(x => x[0] === '@' ? x : '@' + x);
    const r = CPM.setSigners(cidNow(), list, ($('cps-t-th') || {}).value);
    toast(r.error || 'Signers saved');
    repaint();
  }
  function exportGov() { download(cidNow() + '-governance.json', CPM.exportGov(cidNow())); toast('Exported'); }

  /* ── Web3 ────────────────────────────────────────────────────────── */
  function web3(cid) {
    const c = CMD.byId(cid);
    const gated = CPM.gatedChannels(cid);
    const pass = CPM.passConfig(cid);
    const links = CPM.roleLinks(cid);
    const creds = Array.from(new Set(CPM.allMissions(cid).map(m => m.badge).concat(CPM.SKILLS)));
    const pending = CPM.skills().filter(s => s.cid === cid && s.status === 'pending');
    const gov = CPM.verifyGov(cid);
    const proofs = CPM.verifyProofs();
    const mayCh = CMD.can(cid, 'channels');
    const mayMan = CMD.can(cid, 'manage');
    const lower = CMD.roles(cid).filter(r => r.level < CMD.myLevel(cid));
    return `
      ${head('Web3', 'An optional layer on top of the community. Members who never connect a wallet lose nothing.')}
      ${cards([['Token-gated spaces', gated.length, 'lock'], ['Membership pass', pass.enabled ? compact(pass.minted) + ' claimed' : 'off', 'badge'],
        ['Credentials issued here', CPM.badges(cid).length, 'military_tech'], ['Credential-linked roles', links.length, 'link'], ['Skill reviews waiting', pending.length, 'pending']])}

      <section class="cst-panel">
        <h3>${ico('lock')}Token-gated spaces</h3>
        ${gated.map(ch => { const t = CPM.GATE_TYPES.find(x => x[0] === ch.gate.type) || ['', ch.gate.type]; return `<div class="cst-chan">${ico('token')}
          <div class="cst-chan-t"><b>#${esc(ch.name)}</b><span>${esc(t[1])}${ch.gate.min ? ' · ' + ch.gate.min + ' ' + esc(ch.gate.symbol || '') : ''}${ch.gate.title ? ' · ' + esc(ch.gate.title) : ''}</span></div>
          <span class="hub-chip-s">${CPM.gateOpen(cid, ch) ? 'you can enter' : 'locked for you'}</span></div>`; }).join('') || '<p class="hub-none">No gated spaces yet.</p>'}
        ${mayCh ? `<div class="hub-form-row cpx-mt">
          <label class="hub-f"><span>Name</span><input id="cps-gt-n" placeholder="holders-lounge"></label>
          <label class="hub-f"><span>Unlocks for</span><select id="cps-gt-t" onchange="CPS.gateForm()">${CPM.GATE_TYPES.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select></label>
          <label class="hub-f"><span>Channel</span><select id="cps-gt-k"><option value="text">Text</option><option value="voice">Voice</option></select></label>
        </div>
        <div class="hub-form-row" id="cps-gt-native" hidden>
          <label class="hub-f"><span>Minimum balance</span><input type="number" id="cps-gt-min" value="0.01" step="0.01" min="0"></label>
          <label class="hub-f"><span>Token</span><select id="cps-gt-sym"><option>ETH</option><option>POL</option><option>BNB</option></select></label>
        </div>
        <label class="hub-f" id="cps-gt-cred" hidden><span>Credential</span><select id="cps-gt-title">${creds.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>
        <button class="hub-btn primary" onclick="CPS.addGate()">${ico('add')}Create gated space</button>` : lock('manage channels')}
        <p class="hub-none sm">Wallet ownership unlocks a space without passwords. Eligibility reads the public address and the balance the wallet reports; demo wallets pass as demo.</p>
      </section>

      <section class="cst-panel">
        <h3>${ico('badge')}Membership pass</h3>
        <label class="cst-switch"><input type="checkbox" id="cps-ps-on" ${pass.enabled ? 'checked' : ''} ${mayMan ? '' : 'disabled'}><i></i>Pass enabled</label>
        <div class="hub-form-row cpx-mt">
          <label class="hub-f"><span>Name</span><input id="cps-ps-n" value="${esc(pass.name)}" ${mayMan ? '' : 'disabled'}></label>
          <label class="hub-f"><span>Supply (0 = unlimited)</span><input type="number" id="cps-ps-sup" value="${pass.supply || 0}" min="0" ${mayMan ? '' : 'disabled'}></label>
          <label class="hub-f"><span>Colour</span><input type="color" id="cps-ps-col" value="${esc(pass.color || c.color)}" ${mayMan ? '' : 'disabled'}></label>
        </div>
        <label class="hub-f"><span>Perks — one per line</span><textarea id="cps-ps-p" rows="3" ${mayMan ? '' : 'disabled'}>${esc(pass.perks.join('\n'))}</textarea></label>
        <div class="cst-rules">
          <label class="cst-rule"><input type="checkbox" checked disabled><b>Non-transferable</b><span>Always on. A pass proves membership; it cannot be sold, so it never becomes an investment.</span></label>
          <label class="cst-rule"><input type="checkbox" checked disabled><b>Free to claim</b><span>Members claim it after joining. No price, no secondary market.</span></label>
        </div>
        <button class="hub-btn primary" onclick="CPS.savePass()" ${mayMan ? '' : 'disabled'}>Save pass</button>
        <p class="hub-none sm">${compact(pass.minted)} claimed${pass.seed ? ' (includes demo claims)' : ''}. Passes are records with a digest on this device, bound to a wallet if one is connected — not minted on-chain.</p>
      </section>

      <section class="cst-panel">
        <h3>${ico('link')}Credential-linked roles</h3>
        ${links.map((l, i) => `<div class="cst-log"><b>${esc(l.credential === '__pass' ? pass.name : l.credential)}</b><span>→ ${esc(CMD.roleById(cid, l.role).name)}</span>
          ${CMD.can(cid, 'roles') ? `<button class="hub-act danger" onclick="CPS.delLink(${i})">${ico('delete')}</button>` : ''}</div>`).join('') || '<p class="hub-none">No links yet.</p>'}
        ${CMD.can(cid, 'roles') ? `<div class="hub-form-row cpx-mt">
          <label class="hub-f"><span>Holding</span><select id="cps-rl-c"><option value="__pass">${esc(pass.name)}</option>${creds.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>
          <label class="hub-f"><span>Grants role</span><select id="cps-rl-r">${lower.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></label>
        </div><button class="hub-btn" onclick="CPS.addLink()">${ico('add')}Link</button>` : lock('manage roles')}
      </section>

      <section class="cst-panel">
        <h3>${ico('workspace_premium')}Skill verification requests</h3>
        ${pending.map(s => `<div class="cpx-held"><div><b>${esc(s.name)} · ${esc(s.skill)}</b><p>${esc(s.evidence || 'No evidence given')}</p>
          ${s.holder === CMD.me().handle ? '<span class="hub-none sm">Your own request — in a live community another moderator reviews it.</span>' : ''}</div>
          ${CMD.can(cid, 'moderate') ? `<div class="hub-acts"><button class="hub-btn sm primary" onclick="CPS.skill('${s.id}',true)">Verify</button><button class="hub-btn sm danger" onclick="CPS.skill('${s.id}',false)">Decline</button></div>` : ''}
        </div>`).join('') || '<p class="hub-none">No requests waiting.</p>'}
      </section>

      <section class="cst-panel">
        <h3>${ico('anchor')}Anchoring</h3>
        <div class="cst-split">
          <div><b>${gov.count}</b><span>Governance entries · root <code>${short(gov.root || '')}</code></span>
            <button class="hub-btn sm cpx-mt" onclick="CPX.copy('${gov.root || ''}','Governance root copied')">Copy root</button></div>
          <div><b>${proofs.count}</b><span>Your proof records · root <code>${short(proofs.root || '')}</code></span>
            <button class="hub-btn sm cpx-mt" onclick="CPX.copy('${proofs.root || ''}','Proof root copied')">Copy root</button></div>
        </div>
        <p class="hub-none sm">A root hash commits to every record before it. Writing one on-chain is a transaction you would send from your own wallet, if you choose to — Trending does not send transactions.</p>
      </section>`;
  }
  function gateForm() {
    const t = ($('cps-gt-t') || {}).value;
    const n = $('cps-gt-native'), cr = $('cps-gt-cred');
    if (n) n.hidden = t !== 'native';
    if (cr) cr.hidden = t !== 'credential';
  }
  function addGate() {
    const v = id => ($(id) || {}).value;
    const r = CPM.addGatedChannel(cidNow(), { name: v('cps-gt-n'), type: v('cps-gt-t'), kind: v('cps-gt-k'), min: v('cps-gt-min'), symbol: v('cps-gt-sym'), title: v('cps-gt-title') });
    toast(r.error || `#${r.name} created in the Token-gated space`);
    repaint();
  }
  function savePass() {
    const v = id => ($(id) || {}).value;
    const r = CPM.savePass(cidNow(), { enabled: !!($('cps-ps-on') || {}).checked, name: v('cps-ps-n'), supply: Math.max(0, +v('cps-ps-sup') || 0), color: v('cps-ps-col'),
      perks: (v('cps-ps-p') || '').split('\n').map(x => x.trim()).filter(Boolean) });
    toast(r.error || 'Pass saved');
    repaint();
  }
  function addLink() { const r = CPM.addRoleLink(cidNow(), ($('cps-rl-c') || {}).value, ($('cps-rl-r') || {}).value); toast(r.error || 'Linked'); repaint(); }
  function delLink(i) { CPM.removeRoleLink(cidNow(), i); repaint(); }
  function skill(id, ok) { const r = CPM.reviewSkill(id, ok); toast(r.error || (ok ? 'Skill verified — credential issued' : 'Declined')); repaint(); }

  /* ── Rewards: missions ───────────────────────────────────────────── */
  function rewardsExtra(cid) {
    const all = CPM.allMissions(cid);
    const active = CPM.missions(cid).map(m => m.id);
    const queue = CPM.reviewQueue(cid);
    const may = CMD.can(cid, 'moderate') || CMD.can(cid, 'manage');
    return `
      <section class="cst-panel">
        <h3>${ico('flag')}Missions</h3>
        ${all.map(m => `<div class="cst-app${active.indexOf(m.id) > -1 ? ' on' : ''}">${ico(m.icon || 'flag')}
          <div><b>${esc(m.title)}</b><span>${m.mode === 'auto' ? `Completes automatically at ${m.target || 1}` : 'Moderator-reviewed'} · +${m.points} rep · “${esc(m.badge)}”${m.custom ? ' · custom' : ''}</span></div>
          ${may ? `<label class="cst-switch"><input type="checkbox" ${active.indexOf(m.id) > -1 ? 'checked' : ''} onchange="CPS.toggleMission('${m.id}')"><i></i></label>` : ''}
          ${may && m.custom ? `<button class="hub-act danger" onclick="CPS.delMission('${m.id}')">${ico('delete')}</button>` : ''}
        </div>`).join('')}
        ${may ? `<button class="hub-btn primary cpx-mt" onclick="CPS.newMission()">${ico('add')}New mission</button>` : ''}
      </section>
      <section class="cst-panel">
        <h3>${ico('fact_check')}Mission reviews · ${queue.length}</h3>
        ${queue.map(q => `<div class="cpx-held"><div><b>${esc(q.name)} · ${esc(q.mission ? q.mission.title : q.mid)}</b><p>${esc(q.proof)}</p><span class="hub-none sm">submitted ${ago(q.at)} ago</span></div>
          ${may ? `<div class="hub-acts"><button class="hub-btn sm primary" onclick="CPS.review('${q.mid}',true)">Approve</button><button class="hub-btn sm" onclick="CPS.review('${q.mid}',false)">Return</button></div>` : ''}</div>`).join('')
          || '<p class="hub-none">No submissions waiting.</p>'}
      </section>`;
  }
  function toggleMission(id) { CPM.toggleMission(cidNow(), id); repaint(); }
  function delMission(id) { CPM.removeMission(cidNow(), id); repaint(); }
  async function review(mid, ok) {
    let note = '';
    if (!ok) {
      const v = await appPrompt('What should they add?', 'Needs more detail.', { ok: 'Return with note' });
      if (v === null) return;
      note = v.trim() || 'Needs more detail.';
    }
    const r = CPM.reviewMission(cidNow(), mid, ok, note);
    toast(r.error || (ok ? 'Approved — reputation and credential issued' : 'Returned with a note'));
    repaint();
  }
  function newMission() {
    modal('New mission', `
      <label class="hub-f"><span>Title</span><input id="cps-m-t" placeholder="Record a walkthrough"></label>
      <label class="hub-f"><span>What to do</span><textarea id="cps-m-d" rows="2"></textarea></label>
      <div class="hub-form-row">
        <label class="hub-f"><span>Completes</span><select id="cps-m-mode" onchange="document.getElementById('cps-m-auto').hidden=this.value!=='auto'"><option value="review">After moderator review</option><option value="auto">Automatically</option></select></label>
        <label class="hub-f"><span>Reputation</span><input type="number" id="cps-m-p" value="25" min="5" max="200"></label>
      </div>
      <div class="hub-form-row" id="cps-m-auto" hidden>
        <label class="hub-f"><span>Counts</span><select id="cps-m-metric"><option value="answers">Answers &amp; replies</option><option value="topics">Discussion topics</option><option value="comments">Comments</option><option value="posts">Community posts</option><option value="checkins">Event check-ins</option><option value="votes">Votes</option><option value="kb">Knowledge articles</option></select></label>
        <label class="hub-f"><span>Target</span><input type="number" id="cps-m-target" value="3" min="1" max="50"></label>
      </div>
      <label class="hub-f"><span>Credential name</span><input id="cps-m-b" placeholder="Guide"></label>
      <button class="hub-btn primary wide" onclick="CPS.saveMission()">Create mission</button>`);
  }
  function saveMission() {
    const v = id => ($(id) || {}).value;
    const r = CPM.addMission(cidNow(), { title: v('cps-m-t'), desc: v('cps-m-d'), mode: v('cps-m-mode'), points: v('cps-m-p'), metric: v('cps-m-metric'), target: v('cps-m-target'), badge: v('cps-m-b') });
    if (r.error) { toast(r.error); return; }
    closeModal(); repaint();
    toast('Mission created');
  }

  /* ── Integrations: mini apps & API ───────────────────────────────── */
  let unsub = null;
  function integrationsExtra(cid) {
    const on = CPM.installedApps(cid);
    const may = CMD.can(cid, 'manage') || CMD.can(cid, 'channels');
    const calls = [['communities()', 'communities'], [`community('${cid}')`, 'community'], [`channels('${cid}')`, 'channels'], [`proposals('${cid}')`, 'proposals'],
      [`missions('${cid}')`, 'missions'], [`knowledge('${cid}')`, 'knowledge'], [`governanceRoot('${cid}')`, 'governanceRoot'], ['trends()', 'trends'], ['passport()', 'passport'], ['wallet()', 'wallet']];
    setTimeout(liveSubscribe, 0);
    return `
      <section class="cst-panel">
        <h3>${ico('widgets')}Mini apps</h3>
        <div class="cst-apps">${CPM.MINI_APPS.map(a => `<div class="cst-app${on.indexOf(a.id) > -1 ? ' on' : ''}">${ico(a.icon)}
          <div><b>${esc(a.name)}</b><span>${esc(a.what)} · permissions: ${a.perms.join(', ') || 'none'}</span></div>
          ${may ? `<label class="cst-switch"><input type="checkbox" ${on.indexOf(a.id) > -1 ? 'checked' : ''} onchange="CPS.toggleApp('${a.id}')"><i></i></label>` : ''}</div>`).join('')}</div>
        <p class="hub-none sm">Apps run in a sandboxed frame with no network and no access to accounts or storage. They open from the ▦ button in any channel.</p>
      </section>

      <section class="cst-panel">
        <h3>${ico('api')}Open Community API</h3>
        <p class="hub-guide">Developers build on communities through <code>window.CommuneAPI</code> — read methods for communities, channels, events, proposals, missions, knowledge and trends, plus <code>on(type, fn)</code> for live activity. It is read-only: anything that writes goes through the same permissions and confirmations as the interface, and wallet data is limited to network and a shortened public address.</p>
        <div class="hub-chips">${calls.map(([label, fn]) => `<button class="hub-chip" onclick="CPS.call('${fn}')"><code>${esc(label)}</code></button>`).join('')}</div>
        <pre class="cpx-console" id="cps-api-out">// Pick a call to run it against this browser's data</pre>
        <h4 class="hub-h4">Live events <span class="hub-none sm">CommuneAPI.on('*', fn)</span></h4>
        <div id="cps-api-live" class="cpx-live">${CommuneAPI.events_log().slice(0, 8).map(liveRow).join('') || '<p class="hub-none sm">Post, vote or claim a mission in another tab and events appear here.</p>'}</div>
      </section>`;
  }
  const liveRow = e => `<div class="cst-log"><span class="cst-log-a">${esc(e.type)}</span><span>${esc(JSON.stringify(e.data))}</span><i>${ago(e.at)} ago</i></div>`;
  function liveSubscribe() {
    if (unsub) unsub();
    unsub = CommuneAPI.on('*', e => {
      const box = $('cps-api-live');
      if (!box) { if (unsub) { unsub(); unsub = null; } return; }
      box.insertAdjacentHTML('afterbegin', liveRow(e));
    });
  }
  function toggleApp(id) { const r = CPM.toggleMiniApp(cidNow(), id); if (r.error) toast(r.error); repaint(); }
  function call(fn) {
    const cid = cidNow();
    const out = $('cps-api-out');
    if (!out) return;
    try {
      const needsId = ['community', 'channels', 'proposals', 'missions', 'knowledge', 'governanceRoot'].indexOf(fn) > -1;
      const res = needsId ? CommuneAPI[fn](cid) : CommuneAPI[fn]();
      const text = JSON.stringify(res, null, 2);
      out.textContent = `> CommuneAPI.${fn}(${needsId ? `'${cid}'` : ''})\n` + (text.length > 4000 ? text.slice(0, 4000) + '\n… (truncated)' : text);
    } catch (e) { out.textContent = 'Error: ' + e.message; }
  }

  return {
    has, body, rewardsExtra, integrationsExtra,
    publish, dismiss, delPost, delArticle,
    setAI, held: resolve, test, scan, postDigest,
    unlist, payOpt,
    saveGov, enableTreasury, saveSigners, exportGov,
    gateForm, addGate, savePass, addLink, delLink, skill,
    toggleMission, delMission, review, newMission, saveMission,
    toggleApp, call
  };
})();

window.CPS = CPS;
