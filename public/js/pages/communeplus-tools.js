/* ╔══════════════════════════════════════════════════════════════════╗
   ║  COMMUNE HUB+ — community tabs, part two                          ║
   ║                                                                   ║
   ║  Marketplace & tips · Knowledge base · Collabs & joint events ·   ║
   ║  AI assistant & AI search · Mini apps · Token-gated spaces        ║
   ║                                                                   ║
   ║  Mini apps run in a sandboxed iframe with no same-origin access,  ║
   ║  no network (CSP default-src 'none') and a message bridge that    ║
   ║  only answers a few questions. Posting from an app always asks    ║
   ║  you first.                                                       ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

(() => {
  const { esc, toast, $, compact, money, ago, when, av, ico, linkify, modal, closeModal, repaint } = CPX.h;
  const cui = CPX.cui;
  const D = () => CMD.state();
  const cidNow = () => D().cid;

  /* ══════════════════════════════════════════════════════════════════
     Marketplace
     ══════════════════════════════════════════════════════════════════ */

  function marketHTML(cid) {
    const c = CMD.byId(cid);
    const kind = cui.mkt || 'all';
    const list = CPM.market(cid).filter(l => kind === 'all' || l.kind === kind);
    const canSell = CMD.isJoined(cid) && (CMD.myLevel(cid) >= 30 || CMD.can(cid, 'manage'));
    const owned = CPM.library().filter(l => l.cid === cid);
    const pass = CPM.passConfig(cid);
    const myPass = CPM.myPass(cid);
    const creators = CMD.members(cid).filter(m => !m.you && !m.bot && ['creator', 'contributor', 'expert', 'admin'].indexOf(m.role) > -1)
      .sort((a, b) => b.rep - a.rep).slice(0, 6);
    return `
      ${pass.enabled ? `<section class="cpx-passcard" style="--c:${pass.color || c.color}">
        <span class="cpx-pass-i">${ico('badge')}</span>
        <div><b>${esc(pass.name)}</b><span>${pass.perks.map(esc).join(' · ')}</span>
          <i>${myPass ? `You hold pass #${myPass.serial}${myPass.boundTo ? ' · bound to ' + esc(myPass.boundTo.slice(0, 6)) + '…' : ''}` : `Free · non-transferable · ${compact(pass.minted)} claimed`}</i></div>
        ${myPass ? `<span class="cpx-pill ok">${ico('check')}Member pass</span>` : `<button class="hub-btn primary sm" onclick="CPX.claimPass()">Claim pass</button>`}
      </section>` : ''}

      <div class="hub-board-top">
        <div class="hub-sorts">
          <button class="hub-chip${kind === 'all' ? ' on' : ''}" onclick="CPX.mktKind('all')">All</button>
          ${CPM.KINDS.map(([k, l]) => `<button class="hub-chip${kind === k ? ' on' : ''}" onclick="CPX.mktKind('${k}')">${l}</button>`).join('')}
        </div>
        ${canSell ? `<button class="hub-btn primary sm" onclick="CPX.openSell()">${ico('sell')}Sell a resource</button>` : `<span class="hub-none sm">Selling unlocks with the Contributor role.</span>`}
      </div>

      <div class="cpx-market">${list.map(l => {
        const mine = CPM.owns(cid, l.id);
        return `<article class="cpx-listing" onclick="CPX.openListing('${l.id}')">
          <div class="cpx-listing-top"><span class="hub-chip-s">${esc((CPM.KINDS.find(k => k[0] === l.kind) || ['', l.kind])[1])}</span>
            ${l.crypto ? `<span class="hub-chip-s" title="The seller accepts crypto for this listing">${ico('token')}crypto accepted</span>` : ''}${l.seed ? '<span class="hub-chip-s">demo</span>' : ''}</div>
          <h4>${esc(l.title)}</h4>
          <p>${esc(l.desc)}</p>
          <div class="cpx-listing-f">
            ${av(l.seller, l.handle, 22)}<span>${esc(l.seller)}</span>
            ${l.rating ? `<span>★ ${l.rating}</span>` : ''}<span>${compact(l.sales)} sold</span>
            <b>${mine ? 'Owned' : l.price ? money(l.price) : 'Free'}</b>
          </div>
        </article>`;
      }).join('') || '<div class="hub-none">Nothing listed in this category.</div>'}</div>

      ${owned.length ? `<section class="hub-panel"><h3 class="hub-h3">${ico('local_library')}Your library here</h3>
        ${owned.map(o => `<button class="cpx-hrow" onclick="CPX.openListing('${o.lid}')">${ico('description')}<div><b>${esc(o.title)}</b><span>${o.price ? money(o.price) + ' · ' + esc(o.method) : 'free'} · ${ago(o.at)} ago · receipt ${o.digest.slice(0, 10)}</span></div></button>`).join('')}
      </section>` : ''}

      <section class="hub-panel">
        <h3 class="hub-h3">${ico('volunteer_activism')}Support creators</h3>
        <div class="cpx-creators">${creators.map(m => `<div class="cpx-creator">
          ${av(m.name, m.handle, 40)}<b>${esc(m.name)}</b><span>${esc(CMD.roleById(cid, m.role).name)} · ${compact(m.rep)} rep</span>
          <div class="hub-acts"><button class="hub-btn sm primary" onclick="CPX.openTip('${cid}','${esc(m.handle)}','${esc(m.name)}')">Tip</button>
          <button class="hub-btn sm" onclick="CPX.openPerson('${cid}','${esc(m.handle)}')">Passport</button></div>
        </div>`).join('')}</div>
      </section>
      <p class="hub-none sm">Legitimate digital resources only. Checkout and tips are simulated — nothing is charged, no card or wallet details are collected, and no transaction is sent. Listings are screened by the AI Moderator.</p>`;
  }
  const mktKind = k => { cui.mkt = k; repaint(); };

  function openListing(lid) {
    const cid = cidNow();
    const l = CPM.market(cid).find(x => x.id === lid);
    if (!l) { toast('That listing was removed.'); return; }
    const owned = CPM.owns(cid, lid);
    const mine = l.handle === CMD.me().handle;
    modal(l.title, `
      <div class="hub-chips"><span class="hub-chip-s">${esc((CPM.KINDS.find(k => k[0] === l.kind) || ['', l.kind])[1])}</span><span class="hub-chip-s">${esc(l.license)}</span>${l.seed ? '<span class="hub-chip-s">demo listing</span>' : ''}</div>
      <p class="hub-guide cpx-mt">${esc(l.desc)}</p>
      <div class="hub-profile cpx-mt">${av(l.seller, l.handle, 36)}<div><b>${esc(l.seller)}</b><span>${esc(l.handle)} · ${compact(l.sales)} sold${l.rating ? ' · ★ ' + l.rating : ''}</span></div></div>
      <h4 class="hub-h4">${owned || mine ? 'What you get' : `Includes ${l.content.length} items`}</h4>
      ${owned || mine ? `<ol class="hub-rules">${l.content.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`
        : `<ol class="hub-rules cpx-blur">${l.content.map(x => `<li>${esc(x.replace(/[^\s]/g, '•'))}</li>`).join('')}</ol>`}
      ${owned ? `<p class="hub-none sm">${ico('check_circle')} In your library.</p>` : mine ? '' : `
        <div class="hub-acts">
          <button class="hub-btn primary" onclick="CPX.buy('${lid}','card')">${l.price ? 'Buy · ' + money(l.price) : 'Get it free'}</button>
          ${l.crypto && l.price ? `<button class="hub-btn" onclick="CPX.openCryptoPay('${lid}')">${ico('token')}Pay with crypto</button>` : ''}
        </div>
        <p class="hub-none sm">Simulated checkout — nothing is charged and no payment details are asked for.</p>`}
      <div class="hub-acts">
        ${mine || CMD.can(cid, 'moderate') ? `<button class="hub-btn sm danger" onclick="CPX.unlist('${lid}')">${mine ? 'Remove listing' : 'Unlist (moderator)'}</button>` : ''}
        ${!mine ? `<button class="hub-btn sm" onclick="CPX.report('${lid}')">${ico('flag')}Report</button>` : ''}
      </div>`);
  }
  function buy(lid, method) {
    const r = CPM.buy(cidNow(), lid, method);
    if (r.error) { toast(r.error); return; }
    toast('Added to your library — simulated, nothing charged');
    openListing(lid);
    repaint();
  }
  function openCryptoPay(lid) {
    const l = CPM.market(cidNow()).find(x => x.id === lid);
    const w = CPM.wallet();
    modal('Pay with crypto', `
      <div class="cpx-safe">${ico('shield')}<div><b>How a real crypto checkout stays safe</b>
        <span>Your own wallet shows the exact amount and the seller's address before anything moves. You approve it there — Trending never holds funds, never asks for a recovery phrase, and never signs for you.</span></div></div>
      <ul class="hub-rules cpx-mt">
        <li>Check the first and last six characters of the address in your wallet.</li>
        <li>A stablecoin holds its value between the moment you send and the moment it lands; a coin like BTC or ETH can move in that gap.</li>
        <li>A seller asking you to pay outside the checkout is breaking the rules.</li>
      </ul>
      <p class="hub-guide">${w ? `Connected: ${esc(w.label)}${w.simulated ? ' (demo wallet)' : ''}.` : 'No wallet connected.'} This demo sends no transaction — confirming records the purchase as simulated.</p>
      <button class="hub-btn primary wide" onclick="CPX.buy('${lid}','crypto')">Record simulated crypto purchase · ${money(l.price)}</button>`);
  }
  async function unlist(lid) {
    if (!(await appConfirm('Remove this listing?', { ok: 'Remove', danger: true }))) return;
    CPM.unlist(cidNow(), lid);
    closeModal(); repaint();
    toast('Listing removed');
  }
  function report(lid) {
    const l = CPM.market(cidNow()).find(x => x.id === lid);
    CMD.logMod(cidNow(), 'report', l.handle, 'Marketplace: ' + l.title);
    closeModal();
    toast('Reported to the moderators');
  }
  function openSell() {
    modal('Sell a digital resource', `
      <label class="hub-f"><span>Title</span><input id="cpx-sl-t" placeholder="What is it?"></label>
      <div class="hub-form-row">
        <label class="hub-f"><span>Kind</span><select id="cpx-sl-k">${CPM.KINDS.map(k => `<option value="${k[0]}">${k[1]}</option>`).join('')}</select></label>
        <label class="hub-f"><span>Price (0 for free)</span><input type="number" id="cpx-sl-p" value="5" min="0" max="500"></label>
      </div>
      <label class="hub-f"><span>Description</span><textarea id="cpx-sl-d" rows="2"></textarea></label>
      <label class="hub-f"><span>What the buyer receives — one item per line</span><textarea id="cpx-sl-c" rows="4"></textarea></label>
      <label class="hub-f"><span>License</span><select id="cpx-sl-l"><option>Personal use</option><option>Commercial use</option><option>CC BY 4.0</option></select></label>
      <label class="hub-check"><input type="checkbox" id="cpx-sl-x"> Accept crypto for this listing</label>
      <p class="hub-none sm">No financial products, no investment promises, nothing that asks buyers for keys or recovery phrases.</p>
      <button class="hub-btn primary wide" onclick="CPX.doSell()">List it</button>`);
  }
  function doSell() {
    const v = id => ($(id) || {}).value;
    const r = CPM.sell(cidNow(), { title: v('cpx-sl-t'), kind: v('cpx-sl-k'), price: v('cpx-sl-p'), desc: v('cpx-sl-d'), content: v('cpx-sl-c'), license: v('cpx-sl-l'), crypto: !!($('cpx-sl-x') || {}).checked });
    if (r.error) { toast(r.error); return; }
    closeModal(); repaint();
    toast('Listed');
  }
  function claimPass() {
    const r = CPM.claimPass(cidNow());
    if (r.error) { toast(r.error); return; }
    toast(`Pass #${r.serial} claimed — non-transferable, added to your Passport`);
    repaint();
  }

  /* ══════════════════════════════════════════════════════════════════
     Knowledge base
     ══════════════════════════════════════════════════════════════════ */

  function knowledgeHTML(cid) {
    if (cui.kb) {
      const a = CPM.kb(cid).find(x => x.id === cui.kb);
      if (a) return articleHTML(cid, a);
      cui.kb = null;
    }
    const cat = cui.kbCat || 'all';
    const q = (cui.kbQ || '').toLowerCase();
    const list = CPM.kb(cid).filter(a => (cat === 'all' || a.cat === cat) && (!q || (a.title + ' ' + a.body + ' ' + a.tags.join(' ')).toLowerCase().indexOf(q) > -1));
    const faq = CPM.derivedFaq(cid);
    const dec = CPM.decisions(cid);
    return `
      <section class="hub-panel cpx-askbox">
        <h3 class="hub-h3">${ico('auto_awesome')}Ask this community</h3>
        <div class="cpx-ask">
          <input id="cpx-kq" placeholder="What happened this week? · What did we decide about the budget? · How do I spot a scam?" onkeydown="if(event.key==='Enter')CPX.askInline()">
          <button class="hub-btn primary" onclick="CPX.askInline()">Ask</button>
        </div>
        <div id="cpx-kans"></div>
        <p class="hub-none sm">On-device AI search across messages, discussions, events, proposals, governance history and articles. Nothing leaves your browser.</p>
      </section>

      <div class="hub-board-top">
        <div class="hub-sorts">
          <button class="hub-chip${cat === 'all' ? ' on' : ''}" onclick="CPX.kbCat('all')">All</button>
          ${CPM.KB_CATS.map(k => `<button class="hub-chip${cat === k ? ' on' : ''}" onclick="CPX.kbCat('${k}')">${k}</button>`).join('')}
        </div>
        <label class="hub-find sm">${ico('search')}<input placeholder="Filter articles" value="${esc(cui.kbQ || '')}" onchange="CPX.kbFilter(this.value)"></label>
        ${CMD.isJoined(cid) ? `<button class="hub-btn primary sm" onclick="CPX.openArticle()">${ico('edit')}Write article</button>` : ''}
      </div>

      <div class="cpx-kb">${list.map(a => `<button class="cpx-article" onclick="CPX.openKB('${a.id}')">
        <span class="hub-chip-s">${esc(a.cat)}</span>
        <b>${esc(a.title)}</b>
        <p>${esc(a.body.slice(0, 140))}${a.body.length > 140 ? '…' : ''}</p>
        <span class="cpx-article-f">${esc(a.author)} · ${ago(a.at)} ago · ${a.sources.length} source${a.sources.length === 1 ? '' : 's'}${a.seed ? ' · demo' : ''}</span>
      </button>`).join('') || '<p class="hub-none">No articles match. Save a useful message or discussion from its menu to start one.</p>'}</div>

      <div class="cpx-cols">
        <section class="hub-panel">
          <h3 class="hub-h3">${ico('quiz')}FAQ — built from answered questions</h3>
          ${faq.map(f => `<details class="cpx-faq"><summary>${esc(f.q)}${f.solved ? ' <span class="hub-solved">Solved</span>' : ''}</summary><p>${linkify(f.a)}</p><span>— ${esc(f.by)}</span></details>`).join('')
            || '<p class="hub-none">Answer a question in #help as a thread, or comment on a discussion, and it appears here.</p>'}
        </section>
        <section class="hub-panel">
          <h3 class="hub-h3">${ico('gavel')}Decisions</h3>
          ${dec.map(p => `<button class="cpx-hrow" onclick="CPX.go('governance');CPX.openProp('${p.id}')">${ico(p.status === 'implemented' ? 'task_alt' : 'check_circle')}<div><b>${esc(p.title)}</b><span>${esc(p.status)} ${ago(p.implAt || p.end)} ago${p.winner ? ' · ' + esc(p.winner) : ''}</span></div></button>`).join('')
            || '<p class="hub-none">Passed proposals appear here automatically.</p>'}
        </section>
      </div>`;
  }
  const kbCat = c => { cui.kbCat = c; repaint(); };
  const kbFilter = q => { cui.kbQ = q; repaint(); };
  const openKB = id => { cui.kb = id; repaint(); };

  function articleHTML(cid, a) {
    const ok = CPM.verifyArticle(a);
    const canDel = a.handle === CMD.me().handle || CMD.can(cid, 'moderate');
    return `
      <button class="hub-back" onclick="CPX.openKB(null)">${ico('arrow_back')}Knowledge base</button>
      <article class="hub-bfull">
        <span class="hub-chip-s">${esc(a.cat)}</span>
        <h2>${esc(a.title)}</h2>
        <div class="hub-bfull-h">${av(a.author, a.handle, 26)}<b>${esc(a.author)}</b><span>${new Date(a.at).toLocaleDateString()}</span></div>
        <p class="hub-bfull-b">${linkify(a.body)}</p>
        <div class="hub-tagrow">${a.tags.map(t => `<span class="hub-chip-s">#${esc(t)}</span>`).join('')}</div>
      </article>
      <section class="hub-panel">
        <h3 class="hub-h3">${ico('source')}Sources &amp; provenance</h3>
        ${a.sources.map(s => `<div class="cst-log"><span class="cst-log-a">${esc(s.type)}</span><b>${esc(s.label)}</b></div>`).join('') || '<p class="hub-none">Written directly, no linked sources.</p>'}
        <div class="cpx-proofhead ${ok ? 'ok' : 'bad'} cpx-mt">${ico(ok ? 'verified' : 'gpp_bad')}
          <div><b>${ok ? 'Content matches its digest' : 'Content changed since it was published'}</b><span><code>${a.digest}</code></span></div></div>
        <p class="hub-none sm">The digest is SHA-256 over the title, body, sources, author and time. Anyone holding the article can recompute it.</p>
        ${canDel ? `<button class="hub-btn sm danger" onclick="CPX.delArticle('${a.id}')">Delete article</button>` : ''}
      </section>`;
  }
  async function delArticle(id) {
    if (!(await appConfirm('Delete this article?', { ok: 'Delete', danger: true }))) return;
    CPM.removeArticle(cidNow(), id);
    cui.kb = null; repaint();
  }

  function openArticle(prefill) {
    const p = prefill || {};
    cui.draftSources = p.sources || [];
    modal('Knowledge-base article', `
      <label class="hub-f"><span>Title</span><input id="cpx-a-t" value="${esc(p.title || '')}"></label>
      <div class="hub-form-row">
        <label class="hub-f"><span>Section</span><select id="cpx-a-c">${CPM.KB_CATS.map(k => `<option${(p.cat || 'Guides') === k ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
        <label class="hub-f"><span>Tags</span><input id="cpx-a-g" value="${esc(p.tags || '')}" placeholder="comma, separated"></label>
      </div>
      <label class="hub-f"><span>Article</span><textarea id="cpx-a-b" rows="8">${esc(p.body || '')}</textarea></label>
      ${cui.draftSources.length ? `<p class="hub-none sm">${ico('link')} Linked to ${cui.draftSources.map(s => esc(s.label)).join(', ')}</p>` : ''}
      <p class="hub-none sm">Tidy it up — a good article answers the question without the chat around it.</p>
      <button class="hub-btn primary wide" onclick="CPX.saveArticle()">Publish article</button>`, true);
  }
  function saveArticle() {
    const v = id => ($(id) || {}).value;
    const r = CPM.addArticle(cidNow(), { title: v('cpx-a-t'), cat: v('cpx-a-c'), tags: v('cpx-a-g'), body: v('cpx-a-b'), sources: cui.draftSources || [] });
    if (r.error) { toast(r.error); return; }
    closeModal();
    cui.kb = r.id; cui.draftSources = [];
    if (D().tab !== 'knowledge') HUB.setTab('knowledge'); else repaint();
    toast('Article published — +8 reputation');
  }
  function msgToKB(chId, mid) {
    const cid = cidNow();
    const m = CMD.messages(cid, chId).find(x => x.id === mid);
    const ch = CMD.channel(cid, chId);
    if (!m) return;
    const thread = (m.thread || []).map(t => `${t.name}: ${t.text}`).join('\n');
    openArticle({ title: m.text.slice(0, 70), body: m.text + (thread ? '\n\nFrom the thread:\n' + thread : ''), cat: /\?\s*$/.test(m.text) ? 'FAQ' : 'Guides',
      sources: [{ type: 'message', ref: chId + ':' + mid, label: '#' + (ch ? ch.name : chId) + ' · ' + m.name }] });
  }
  function boardToKB(bid) {
    const cid = cidNow();
    const p = CMD.boards(cid).find(x => x.id === bid);
    if (!p) return;
    const best = (p.comments || []).slice(-3).map(c => `${c.name}: ${c.text}`).join('\n');
    openArticle({ title: p.title, body: p.body + (best ? '\n\nWhat people said:\n' + best : ''), cat: p.solved ? 'FAQ' : 'Guides', tags: (p.tags || []).join(', '),
      sources: [{ type: 'topic', ref: bid, label: 'Discussion · ' + p.title.slice(0, 40) }] });
  }

  /* ══════════════════════════════════════════════════════════════════
     AI assistant & search
     ══════════════════════════════════════════════════════════════════ */

  const TYPE_ICON = { message: 'chat', discussion: 'topic', post: 'dynamic_feed', event: 'event', proposal: 'how_to_vote', governance: 'history', article: 'library_books', collab: 'handshake' };

  function jump(type, ref, chan) {
    closeModal();
    if (type === 'message') HUB.openChannel(chan || 'general');
    else if (type === 'discussion') { HUB.setTab('boards'); HUB.openBoard(ref); }
    else if (type === 'proposal' || type === 'governance') { CPX.go('governance'); if (ref) CPX.openProp(ref); }
    else if (type === 'article') { CPX.go('knowledge'); openKB(ref); }
    else if (type === 'event') HUB.setTab('events');
    else if (type === 'collab') openCollab(ref);
    else HUB.setTab('feed');
  }

  function resultRow(r) {
    const chan = r.chan ? `'${esc(r.chan)}'` : 'null';
    return `<button class="cpx-res" onclick="CPX.jump('${r.type}','${esc(r.ref || '')}',${chan})">
      ${ico(TYPE_ICON[r.type] || 'search')}<div><b>${esc(r.title || r.type)}</b><span>${esc(r.where)} · ${ago(r.ts)}${r.ts < Date.now() ? ' ago' : ''}</span>
      <p>${esc(String(r.text || '').slice(0, 150))}</p></div></button>`;
  }

  function digestHTML(d, label) {
    return `<div class="cpx-digest">
      <p class="hub-guide"><b>${label || 'The last ' + d.days + ' days'}:</b> ${d.count} items across ${Object.keys(d.byWhere).length} places — ${Object.keys(d.byWhere).map(k => `${d.byWhere[k]} in ${esc(k)}`).join(', ') || 'nothing yet'}.</p>
      ${d.topics.length ? `<div class="hub-chips">${d.topics.map(t => `<span class="hub-chip-s">${esc(t)}</span>`).join('')}</div>` : ''}
      ${d.highlights.length ? `<h4 class="hub-h4">Highlights</h4>${d.highlights.map(resultRow).join('')}` : ''}
      ${d.decided.length ? `<h4 class="hub-h4">Decided</h4>${d.decided.map(x => `<div class="cst-log"><span class="cst-log-a">${esc(x.action)}</span><b>${esc(x.title)}</b><i>${ago(x.at)} ago</i></div>`).join('')}` : ''}
      ${d.voting.length ? `<h4 class="hub-h4">Open votes</h4>${d.voting.map(p => resultRow({ type: 'proposal', ref: p.id, title: p.title, where: 'Governance', ts: p.end, text: 'Voting closes ' + ago(p.end) })).join('')}` : ''}
      ${d.openQs.length ? `<h4 class="hub-h4">Unanswered questions</h4>${d.openQs.map(m => resultRow({ type: 'message', chan: m.chan, ref: m.id, title: m.name, where: '#' + m.chan, ts: m.ts, text: m.text })).join('')}` : ''}
      ${d.upcoming.length ? `<h4 class="hub-h4">Coming up</h4>${d.upcoming.map(e => resultRow({ type: 'event', ref: e.id, title: e.title, where: 'Events', ts: e.start, text: when(e.start) })).join('')}` : ''}
    </div>`;
  }

  function answerHTML(res) {
    if (res.error) return `<p class="hub-none">${esc(res.error)}</p>`;
    if (res.kind === 'digest') return digestHTML(res.digest, 'Here is ' + res.range);
    if (res.kind === 'wallet') return `<ul class="hub-rules">${res.text.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
    return `<p class="hub-guide">${esc(res.summary)}</p>${res.results.map(resultRow).join('')}`;
  }

  function askInline() {
    const q = ($('cpx-kq') || {}).value || '';
    const box = $('cpx-kans');
    if (box) box.innerHTML = answerHTML(CPM.ask(cidNow(), q));
  }

  function openAssistant(mode) {
    const cid = cidNow();
    const m = mode || 'digest';
    const c = CMD.byId(cid);
    let body = '';
    if (m === 'digest') {
      const days = cui.aiDays || 7;
      body = `<div class="hub-chips">${[[1, '24 hours'], [7, '7 days'], [30, '30 days']].map(([n, l]) =>
        `<button class="hub-chip${days === n ? ' on' : ''}" onclick="CPX.cui.aiDays=${n};CPX.openAssistant('digest')">${l}</button>`).join('')}</div>${digestHTML(CPM.digest(cid, days))}`;
    } else if (m === 'ask') {
      body = `<div class="cpx-ask"><input id="cpx-aq" placeholder="Ask anything about ${esc(c.name)}" onkeydown="if(event.key==='Enter')CPX.runAsk()"><button class="hub-btn primary" onclick="CPX.runAsk()">Ask</button></div>
        <div class="hub-chips cpx-mt">${['What happened this week?', 'What did we decide recently?', 'Any events coming up?', 'How do I spot a scam?', 'Is connecting my wallet safe?']
          .map(s => `<button class="hub-chip" onclick="document.getElementById('cpx-aq').value=this.textContent;CPX.runAsk()">${s}</button>`).join('')}</div>
        <div id="cpx-aans" class="cpx-mt"></div>`;
    } else if (m === 'faq') {
      const faq = CPM.derivedFaq(cid);
      const arts = CPM.kb(cid).filter(a => a.cat === 'FAQ' || a.cat === 'Safety' || a.cat === 'Getting started');
      body = arts.map(a => `<details class="cpx-faq"><summary>${esc(a.title)}</summary><p>${linkify(a.body)}</p></details>`).join('')
        + faq.map(f => `<details class="cpx-faq"><summary>${esc(f.q)}</summary><p>${linkify(f.a)}</p><span>— ${esc(f.by)}</span></details>`).join('');
    } else {
      body = `<ul class="hub-rules">${CPM.explainWallet().map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        ${CPM.wallet() ? '' : `<button class="hub-btn sm" onclick="HUB.closeModal();WL.openChooser()">${ico('account_balance_wallet')}Connect a wallet (optional)</button>`}`;
    }
    modal('Community assistant', `
      <div class="cpx-subnav">${[['digest', 'Catch me up', 'summarize'], ['ask', 'Ask', 'search'], ['faq', 'FAQ', 'quiz'], ['wallet', 'Wallet help', 'account_balance_wallet']]
        .map(([k, l, i]) => `<button class="hub-chip${m === k ? ' on' : ''}" onclick="CPX.openAssistant('${k}')">${ico(i)}${l}</button>`).join('')}</div>
      ${body}
      <p class="hub-none sm cpx-mt">${ico('lock')} On-device assistant: it reads ${esc(c.name)}'s content inside your browser and sends nothing anywhere. It can explain wallets; it never touches keys.</p>`, true);
    if (m === 'ask') setTimeout(() => { const i = $('cpx-aq'); if (i) i.focus(); }, 40);
  }
  function runAsk() {
    const box = $('cpx-aans');
    if (box) box.innerHTML = answerHTML(CPM.ask(cidNow(), ($('cpx-aq') || {}).value));
  }

  /* ══════════════════════════════════════════════════════════════════
     Collabs & joint events
     ══════════════════════════════════════════════════════════════════ */

  function collabsHTML(cid) {
    if (cui.collab) {
      const k = CPM.collab(cui.collab);
      if (k && k.communities.indexOf(cid) > -1) return collabHTML(cid, k);
      cui.collab = null;
    }
    const list = CPM.collabsFor(cid);
    const can = CMD.can(cid, 'manage') || CMD.can(cid, 'moderate') || CMD.can(cid, 'events');
    return `
      <div class="hub-board-top">
        <p class="hub-none">Two or more communities work on one project or host one event — without merging, and each keeps its own rules.</p>
        ${can ? `<button class="hub-btn primary sm" onclick="CPX.openNewCollab()">${ico('add')}Start a collaboration</button>` : ''}
      </div>
      ${list.map(k => {
        const done = k.tasks.filter(t => t.done).length;
        return `<article class="cpx-collab" onclick="CPX.openCollab('${k.id}')">
          <div class="cpx-prop-h"><span class="cpx-status ${k.status === 'active' ? 'voting' : k.status === 'done' ? 'implemented' : 'discussion'}">${ico(k.kind === 'event' ? 'event' : 'construction')}${esc(k.status)}</span>
            ${k.seed ? '<span class="hub-chip-s">demo</span>' : ''}</div>
          <div class="cpx-partners">${k.communities.map(id => { const c = CMD.byId(id) || { name: id, color: '#888', icon: 'groups' }; return `<span class="cpx-cchip" style="--c:${c.color}">${CPX.h.cico(c)}${esc(c.name)}${k.accepted[id] ? '' : ' <i>invited</i>'}</span>`; }).join('<span class="cpx-x-join">×</span>')}</div>
          <h4>${esc(k.title)}</h4><p>${esc(k.goal)}</p>
          ${k.tasks.length ? `<div class="cpx-prog"><i style="width:${Math.round(done / k.tasks.length * 100)}%"></i></div><span class="hub-none sm">${done}/${k.tasks.length} tasks</span>` : ''}
          ${k.event ? `<div class="cpx-xevent">${ico('event')}<b>${esc(k.event.title)}</b><span>${k.event.start < Date.now() && k.event.start + k.event.mins * 60000 > Date.now() ? '<em class="hub-livepill">LIVE NOW</em>' : when(k.event.start)}</span></div>` : ''}
        </article>`;
      }).join('') || '<div class="hub-empty">' + ico('handshake') + '<p>No collaborations yet.</p></div>'}`;
  }

  function collabHTML(cid, k) {
    const me = CMD.me().handle;
    const msgs = CPM.collabMessages(k.id);
    const going = k.event && k.going[me];
    const live = k.event && k.event.start < Date.now() && k.event.start + k.event.mins * 60000 > Date.now();
    const pending = k.communities.filter(id => !k.accepted[id]);
    return `
      <button class="hub-back" onclick="CPX.openCollab(null)">${ico('arrow_back')}All collaborations</button>
      <article class="hub-bfull">
        <div class="cpx-partners">${k.communities.map(id => { const c = CMD.byId(id) || { name: id, color: '#888', icon: 'groups' }; return `<button class="cpx-cchip" style="--c:${c.color}" onclick="CPX.openCommunity('${id}')">${CPX.h.cico(c)}${esc(c.name)}${k.accepted[id] ? ' ✓' : ' · invited'}</button>`; }).join('<span class="cpx-x-join">×</span>')}</div>
        <h2>${esc(k.title)}</h2>
        <p class="hub-bfull-b">${esc(k.goal)}</p>
        ${pending.length ? `<div class="cpx-safe">${ico('hourglass_top')}<div><b>Waiting for ${pending.map(id => esc((CMD.byId(id) || {}).name || id)).join(', ')}</b>
          <span>Their moderators accept the invitation from their own community.</span></div>
          ${pending.some(id => CMD.can(id, 'manage') || CMD.can(id, 'moderate')) ? `<button class="hub-btn sm primary" onclick="CPX.acceptCollab('${k.id}','${pending.find(id => CMD.can(id, 'manage') || CMD.can(id, 'moderate'))}')">Accept</button>` : ''}</div>` : ''}
      </article>

      <div class="cpx-cols">
        <section class="hub-panel">
          <h3 class="hub-h3">${ico('checklist')}Shared plan</h3>
          ${k.tasks.map((t, i) => `<button class="hub-task${t.done ? ' done' : ''}" onclick="CPX.toggleTask('${k.id}',${i})">${ico(t.done ? 'check_circle' : 'radio_button_unchecked')}${esc(t.t)}${t.by ? ` <i class="hub-none sm">· ${esc(t.by)}</i>` : ''}</button>`).join('') || '<p class="hub-none">No tasks.</p>'}
        </section>
        ${k.event ? `<section class="hub-panel">
          <h3 class="hub-h3">${ico('diversity_3')}Joint event</h3>
          <div class="hub-event${live ? ' live' : ''}"><div class="hub-event-d"><b>${new Date(k.event.start).getDate()}</b><span>${new Date(k.event.start).toLocaleDateString(undefined, { month: 'short' })}</span></div>
            <div class="hub-event-b"><div class="hub-event-t">${ico('podium')}<b>${esc(k.event.title)}</b>${live ? '<span class="hub-livepill">LIVE NOW</span>' : ''}</div>
              <span class="hub-event-w">${when(k.event.start)} · ${k.event.mins}m · hosted by ${k.communities.length} communities</span>
              <div class="hub-event-a">
                <button class="hub-btn sm${going ? ' primary' : ''}" onclick="CPX.rsvpCollab('${k.id}')">${ico(going ? 'check' : 'notifications')}${going ? 'Going' : 'RSVP'}</button>
                ${k.checkins[me] ? `<span class="cpx-pill ok">${ico('verified')}Attendance credential earned</span>`
                  : going ? `<button class="hub-btn sm" onclick="CPX.checkInCollab('${k.id}')">${ico('where_to_vote')}Check in</button>` : ''}
                <span class="hub-event-n">${Object.keys(k.going).length} going from here</span>
              </div></div></div>
          <p class="hub-none sm">Attending earns a non-transferable attendance credential in your Passport — the kind a pass-based event would issue, without anything on-chain.</p>
        </section>` : ''}
      </div>

      <section class="hub-panel">
        <h3 class="hub-h3">${ico('forum')}Shared room — visible in every partner community</h3>
        <div class="cpx-room">${msgs.map(m => { const from = CMD.byId(m.from) || {}; return `<div class="hub-thread-m">${av(m.name, m.handle, 28)}<div><b>${esc(m.name)}</b> <span class="cpx-cchip mini" style="--c:${from.color || '#888'}">${esc(from.name || '')}</span> <span>${ago(m.ts)}</span><p>${linkify(m.text)}</p></div></div>`; }).join('')
          || '<p class="hub-none">Say hello to the other community.</p>'}</div>
        <div class="hub-thread-in"><input id="cpx-km" placeholder="Message both communities" onkeydown="if(event.key==='Enter')CPX.postCollab('${k.id}')">
          <button class="hub-ico send" onclick="CPX.postCollab('${k.id}')">${ico('send')}</button></div>
      </section>`;
  }

  function openCollab(id) {
    if (!id) { cui.collab = null; repaint(); return; }
    const k = CPM.collab(id);
    if (!k) return;
    const d = D();
    if (d.screen === 'community' && k.communities.indexOf(d.cid) > -1) {
      cui.collab = id;
      if (d.tab !== 'collabs') HUB.setTab('collabs'); else repaint();
      return;
    }
    const cid = k.communities.find(x => CMD.isJoined(x));
    if (!cid) {
      toast(`Join ${k.communities.map(x => (CMD.byId(x) || {}).name || x).join(' or ')} to take part`);
      HUB.openJoin(k.host);
      return;
    }
    cui.collab = id;
    HUB.open(cid);
    HUB.setTab('collabs');
  }
  function acceptCollab(id, cid) { const r = CPM.acceptCollab(id, cid); toast(r.error || 'Invitation accepted'); repaint(); }
  function toggleTask(id, i) { CPM.toggleTask(id, i); repaint(); }
  function postCollab(id) {
    const r = CPM.postCollab(id, ($('cpx-km') || {}).value);
    if (r.error) { toast(r.error); return; }
    repaint();
    setTimeout(() => { const el = $('cpx-km'); if (el) el.focus(); }, 30);
  }
  function rsvpCollab(id) { CPM.rsvpCollab(id); repaint(); }
  function checkInCollab(id) {
    const r = CPM.checkInCollab(id);
    if (r.error) { toast(r.error); return; }
    toast('Checked in — attendance credential added to your Passport');
    repaint();
  }
  function openNewCollab() {
    const cid = cidNow();
    const soon = new Date(Date.now() + 3 * 86400000);
    const iso = new Date(soon.getTime() - soon.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    modal('Start a collaboration', `
      <label class="hub-f"><span>Partner community</span><select id="cpx-kc-p">${CMD.all().filter(c => c.id !== cid).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
      <label class="hub-f"><span>Title</span><input id="cpx-kc-t" placeholder="What are you doing together?"></label>
      <label class="hub-f"><span>Goal</span><textarea id="cpx-kc-g" rows="2"></textarea></label>
      <label class="hub-f"><span>Kind</span><select id="cpx-kc-k" onchange="document.getElementById('cpx-kc-ev').hidden=this.value!=='event'"><option value="project">Shared project</option><option value="event">Joint event</option></select></label>
      <div class="hub-form-row" id="cpx-kc-ev" hidden>
        <label class="hub-f"><span>Starts</span><input type="datetime-local" id="cpx-kc-s" value="${iso}"></label>
        <label class="hub-f"><span>Minutes</span><input type="number" id="cpx-kc-m" value="60" min="15" max="480"></label>
      </div>
      <label class="hub-f"><span>Tasks — one per line</span><textarea id="cpx-kc-ts" rows="3"></textarea></label>
      <p class="hub-none sm">If you do not moderate the partner, it stays an invitation until their moderators accept.</p>
      <button class="hub-btn primary wide" onclick="CPX.doNewCollab()">Send</button>`);
  }
  function doNewCollab() {
    const v = id => ($(id) || {}).value;
    const r = CPM.proposeCollab(cidNow(), { partner: v('cpx-kc-p'), title: v('cpx-kc-t'), goal: v('cpx-kc-g'), kind: v('cpx-kc-k'),
      start: v('cpx-kc-s') ? new Date(v('cpx-kc-s')).getTime() : 0, mins: v('cpx-kc-m'), tasks: v('cpx-kc-ts') });
    if (r.error) { toast(r.error); return; }
    closeModal();
    cui.collab = r.id; repaint();
    toast(r.status === 'active' ? 'Collaboration started' : 'Invitation sent');
  }

  /* ══════════════════════════════════════════════════════════════════
     Token-gated spaces
     ══════════════════════════════════════════════════════════════════ */

  function gateLockedHTML(cid, ch) {
    const g = ch.gate;
    const st = CPM.gateStatus(cid, ch);
    const type = CPM.GATE_TYPES.find(t => t[0] === g.type) || ['', 'Requirement', ''];
    const detail = g.type === 'native' ? `${g.min} ${g.symbol || ''} or more` : g.type === 'credential' ? `“${g.title}”` : '';
    return `<div class="hub-locked cpx-gate">
      ${ico('token')}
      <b>#${esc(ch.name)} is a token-gated space</b>
      <p><b>${esc(type[1])}</b>${detail ? ' · ' + esc(detail) : ''} — ${esc(type[2])}</p>
      <p>${esc(st.need || '')}</p>
      <div class="hub-acts">
        ${st.action === 'connect' ? `<button class="hub-btn primary" onclick="WL.openChooser()">${ico('account_balance_wallet')}Connect wallet</button>` : ''}
        ${st.action === 'pass' ? `<button class="hub-btn primary" onclick="CPX.claimPass()">${ico('badge')}Claim membership pass</button>` : ''}
        ${st.action === 'missions' ? `<button class="hub-btn primary" onclick="CPX.go('missions')">${ico('flag')}See missions</button>` : ''}
      </div>
      <p class="hub-none sm">No passwords. Checking reads your public address and the balance your wallet reports — nothing is signed and nothing is sent.</p>
    </div>`;
  }

  /* ══════════════════════════════════════════════════════════════════
     Mini apps
     ══════════════════════════════════════════════════════════════════ */

  function barButtons(cid) {
    if (!CMD.isJoined(cid)) return '';
    return `<button class="hub-ico" onclick="CPX.openAssistant()" title="Community assistant">${ico('auto_awesome')}</button>
      <button class="hub-ico" onclick="CPX.openApps()" title="Mini apps">${ico('widgets')}</button>`;
  }

  function openApps() {
    const cid = cidNow();
    const on = CPM.installedApps(cid);
    modal('Mini apps', `
      <div class="cst-apps">${CPM.MINI_APPS.filter(a => on.indexOf(a.id) > -1).map(a => `<div class="cst-app on">${ico(a.icon)}
        <div><b>${esc(a.name)}</b><span>${esc(a.what)}</span></div>
        <button class="hub-btn sm primary" onclick="CPX.launchApp('${a.id}')">Open</button></div>`).join('') || '<p class="hub-none">No apps installed.</p>'}</div>
      <p class="hub-none sm cpx-mt">Apps run sandboxed: no access to your account, storage or the network. They can ask for community context, and posting always needs your confirmation. Owners install apps in Studio → Integrations.</p>`, true);
  }

  let frame = null;   // { win, app, cid }
  function launchApp(id) {
    const app = CPM.MINI_APPS.find(a => a.id === id);
    if (!app) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    modal(app.name, `<iframe id="cpx-app-frame" class="cpx-frame" sandbox="allow-scripts" referrerpolicy="no-referrer" title="${esc(app.name)}"></iframe>
      <p class="hub-none sm">${ico('shield')} Sandboxed mini app · permissions: ${app.perms.length ? app.perms.join(', ') : 'none'}</p>`, true);
    const el = $('cpx-app-frame');
    if (!el) return;
    el.srcdoc = APP_SRC[id](dark);
    frame = { el, app, cid: cidNow() };
  }

  window.addEventListener('message', async e => {
    if (!frame || !frame.el || !document.body.contains(frame.el) || e.source !== frame.el.contentWindow) return;
    const msg = e.data || {};
    const target = frame;
    const reply = data => { if (target.el && target.el.contentWindow) target.el.contentWindow.postMessage(data, '*'); };
    const c = CMD.byId(frame.cid);
    if (msg.type === 'context') {
      reply({ type: 'context', community: c ? c.name : '', members: c ? CMD.memberCount(c.id) : 0,
        names: frame.app.perms.indexOf('members') > -1 ? CMD.members(frame.cid).filter(m => !m.bot).slice(0, 30).map(m => m.name) : [] });
    } else if (msg.type === 'post' && frame.app.perms.indexOf('post') > -1) {
      const text = String(msg.text || '').slice(0, 1200).trim();
      if (!text) return;
      if (!(await appConfirm(`${target.app.name} wants to post this to #general as you:\n\n${text}`, { ok: 'Post' }))) { reply({ type: 'posted', ok: false }); return; }
      const r = CMD.post(target.cid, 'general', text);
      reply({ type: 'posted', ok: !(r && r.error), error: r && r.error });
      toast(r && r.error ? r.error : 'Posted to #general');
    } else if (msg.type === 'toast') {
      toast(String(msg.text || '').slice(0, 120));
    }
  });

  const shell = (dark, body, script) => `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
<style>
:root{--bg:${dark ? '#12141A' : '#FFFFFF'};--card:${dark ? '#1B1E26' : '#F4F5F8'};--t1:${dark ? '#F2F3F5' : '#12141A'};--t2:${dark ? '#A6ACB8' : '#555B66'};--b:${dark ? '#2A2E38' : '#E2E4E9'};--brand:#7C5CFF}
*{box-sizing:border-box}body{margin:0;padding:16px;background:var(--bg);color:var(--t1);font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
button{font:700 13px system-ui;padding:9px 14px;border-radius:10px;border:1px solid var(--b);background:var(--card);color:var(--t1);cursor:pointer}
button.p{background:var(--brand);color:#fff;border-color:transparent}input,textarea{width:100%;font:14px system-ui;padding:9px 11px;border-radius:10px;border:1px solid var(--b);background:var(--card);color:var(--t1)}
label{display:block;font:700 11px system-ui;text-transform:uppercase;letter-spacing:.05em;color:var(--t2);margin:10px 0 4px}.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.muted{color:var(--t2);font-size:12px}
.big{font:900 64px system-ui;letter-spacing:-.04em;text-align:center;margin:10px 0}.ok{color:#1A9E6C}.bad{color:#E5484D}code{font:12px ui-monospace,monospace;word-break:break-all}
</style></head><body>${body}<script>${script}</script></body></html>`;

  const APP_SRC = {
    focus: dark => shell(dark, `
      <div class="muted" id="c">Focus Timer</div><div class="big" id="t">25:00</div>
      <div class="row" style="justify-content:center"><button class="p" id="go">Start</button><button id="rs">Reset</button><button id="br">5-min break</button></div>
      <p class="muted" style="text-align:center">Cycles finished: <b id="n">0</b></p>`,
      `let left=1500,run=null,n=0,len=1500;const t=document.getElementById('t');
      const draw=()=>{t.textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0')};
      const stop=()=>{clearInterval(run);run=null;go.textContent='Start'};
      go.onclick=()=>{if(run){stop();return}go.textContent='Pause';run=setInterval(()=>{left--;draw();if(left<=0){stop();if(len===1500){n++;document.getElementById('n').textContent=n;parent.postMessage({type:'toast',text:'Focus cycle done — take a break'},'*')}left=len;draw()}},1000)};
      rs.onclick=()=>{stop();len=1500;left=len;draw()};br.onclick=()=>{stop();len=300;left=len;draw()};
      window.addEventListener('message',e=>{if(e.data&&e.data.type==='context')document.getElementById('c').textContent='Focus Timer · '+e.data.community});
      parent.postMessage({type:'context'},'*');`),

    picker: dark => shell(dark, `
      <label>Names — one per line</label><textarea id="names" rows="7"></textarea>
      <label>Seed — share it and anyone can repeat the pick</label><input id="seed">
      <div class="row"><button class="p" id="pick">Pick</button></div>
      <div class="big" id="win" style="font-size:30px"></div><p class="muted" id="how"></p>`,
      `const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
      seed.value=new Date().toISOString().slice(0,10);
      pick.onclick=()=>{const list=names.value.split('\\n').map(x=>x.trim()).filter(Boolean);if(!list.length)return;
        const i=fnv(seed.value+'|'+list.join('|'))%list.length;win.textContent=list[i];
        how.textContent='FNV-1a("'+seed.value+'|" + names joined by "|") mod '+list.length+' = '+i+'. Same names + same seed = same winner.'};
      window.addEventListener('message',e=>{if(e.data&&e.data.type==='context'){if(e.data.names.length)names.value=e.data.names.join('\\n');seed.value=e.data.community+' '+seed.value}});
      parent.postMessage({type:'context'},'*');`),

    standup: dark => shell(dark, `
      <label>Yesterday</label><textarea id="y" rows="2"></textarea>
      <label>Today</label><textarea id="td" rows="2"></textarea>
      <label>Blockers</label><textarea id="b" rows="2"></textarea>
      <div class="row"><button class="p" id="post">Post to #general</button></div><p class="muted" id="s">You will be asked to confirm before anything is posted.</p>`,
      `post.onclick=()=>{const txt='Standup\\n• Yesterday: '+(y.value||'—')+'\\n• Today: '+(td.value||'—')+'\\n• Blockers: '+(b.value||'none');parent.postMessage({type:'post',text:txt},'*')};
      window.addEventListener('message',e=>{if(e.data&&e.data.type==='posted')s.textContent=e.data.ok?'Posted ✓':(e.data.error||'Not posted')});`),

    addr: dark => shell(dark, `
      <label>Address you were given</label><input id="a" placeholder="0x… or bc1… or a Solana address" autocomplete="off">
      <label>Address you expected (optional)</label><input id="x" placeholder="Paste the one from your own records" autocomplete="off">
      <div id="out" style="margin-top:14px"></div>
      <p class="muted">Runs entirely inside this sandbox — no network calls. It checks the format, not who owns an address.</p>`,
      `const chk=()=>{const v=a.value.trim(),e=x.value.trim();let h='';
        if(!v){out.innerHTML='';return}
        const evm=/^0x[a-fA-F0-9]{40}$/.test(v),btc=/^(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(v),sol=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
        h+=evm?'<p class="ok">✓ Well-formed EVM address.'+(/[a-f]/.test(v.slice(2))&&/[A-F]/.test(v.slice(2))?' Mixed case — your wallet verifies the checksum.':'')+'</p>':btc?'<p class="ok">✓ Well-formed Bitcoin address.</p>':sol?'<p class="ok">✓ Looks like a Solana address.</p>':'<p class="bad">✗ Not a recognised address format.</p>';
        if(/\\s/.test(a.value))h+='<p class="bad">Contains spaces.</p>';
        if(e){if(e===v)h+='<p class="ok">✓ Exactly matches the address you expected.</p>';else{
          const sameEnds=e.slice(0,6)===v.slice(0,6)&&e.slice(-4)===v.slice(-4);
          h+='<p class="bad">✗ Does NOT match.'+(sameEnds?' The first and last characters match but the middle differs — this is how address-poisoning scams work.':'')+'</p>';
          let d='';for(let i=0;i<Math.max(e.length,v.length);i++){const c=v[i]||'·';d+=c===e[i]?c:'<b class="bad">'+c+'</b>'}h+='<code>'+d+'</code>'}}
        out.innerHTML=h};
      a.oninput=chk;x.oninput=chk;`)
  };

  Object.assign(CPX, {
    marketHTML, mktKind, openListing, buy, openCryptoPay, unlist, report, openSell, doSell, claimPass,
    knowledgeHTML, kbCat, kbFilter, openKB, delArticle, openArticle, saveArticle, msgToKB, boardToKB,
    jump, askInline, openAssistant, runAsk,
    collabsHTML, openCollab, acceptCollab, toggleTask, postCollab, rsvpCollab, checkInCollab, openNewCollab, doNewCollab,
    gateLockedHTML, barButtons, openApps, launchApp
  });
})();
