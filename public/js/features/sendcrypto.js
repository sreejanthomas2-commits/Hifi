/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SEND VIA CRYPTO NETWORK — coin → address & network → amount →    ║
   ║  review → send from your wallet                                   ║
   ║                                                                   ║
   ║  The order an exchange's withdraw screen uses, so it reads the    ║
   ║  way people already know: pick the coin, paste the address (the   ║
   ║  network is matched to it), type the amount, see the network fee  ║
   ║  at the speed you choose, check it all once, send.                ║
   ║                                                                   ║
   ║  The last step is where this differs, and says so. An exchange    ║
   ║  sends from coins it holds for you. Trending holds no coins and   ║
   ║  no keys — the balances elsewhere in the app are simulated — so   ║
   ║  the transfer is signed and sent in your own wallet app. This     ║
   ║  screen prepares it exactly (address, network, amount, memo, fee  ║
   ║  speed), hands it over by link, QR or copy, and keeps a record    ║
   ║  you can mark sent and follow on the explorer.                    ║
   ║                                                                   ║
   ║  Rules, as everywhere else money leaves:                          ║
   ║   1. Trending never signs or broadcasts anything.                 ║
   ║   2. The address is the one you paste; nothing is filled in.      ║
   ║   3. Anything shaped like a recovery phrase or private key is     ║
   ║      refused and dropped (walletaddr.js does the check).          ║
   ║   4. The fee is the network's own estimate or none at all.        ║
   ║   5. A paper balance is never presented as something to send.     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const SC = (() => {

  const RKEY = 'ts_sendcrypto_v1';
  const MAX_REC = 50;

  const $ = id => document.getElementById(id);
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
  const ico = (n, c) => `<span class="material-symbols-rounded${c ? ' ' + c : ''}" aria-hidden="true">${n}</span>`;
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const uid = () => 'sc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
  const qty = v => (typeof MNY !== 'undefined' ? MNY.qty(v) : String(v));
  const hasPF = () => typeof PF !== 'undefined';

  /* ── The coin list and each coin's networks: the same catalogue the
        Deposit screen uses, so a coin you can receive you can send. ── */
  let ASSETS = null;
  const NETS = {};
  async function loadAssets() {
    if (ASSETS) return ASSETS;
    if (typeof DEP !== 'undefined' && DEP.loadAssets) ASSETS = await DEP.loadAssets();
    else {
      const r = await fetch('/api/crypto/assets', { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('The coin list did not load.');
      ASSETS = (await r.json()).assets || [];
    }
    return ASSETS;
  }
  async function loadNets(sym) {
    if (NETS[sym]) return NETS[sym];
    if (typeof DEP !== 'undefined' && DEP.loadNets) NETS[sym] = await DEP.loadNets(sym);
    else {
      const r = await fetch('/api/crypto/assets/' + encodeURIComponent(sym) + '/networks', { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`${sym} can't be sent on a network here yet.`);
      NETS[sym] = await r.json();
    }
    return NETS[sym];
  }
  const assetOf = sym => (ASSETS || []).find(a => a.symbol === sym) || null;
  const netsOf = sym => ((NETS[sym] || {}).networks || []);
  const netOf = (sym, key) => netsOf(sym).find(n => n.key === key) || null;

  /* The coin a network charges its fee in, and whether this send is a token. */
  const GAS = { ethereum: 'ETH', base: 'ETH', arbitrum: 'ETH', optimism: 'ETH', polygon: 'POL', bnb: 'BNB', avalanche: 'AVAX',
                etc: 'ETC', bitcoin: 'BTC', solana: 'SOL', tron: 'TRX', xrpl: 'XRP', dogecoin: 'DOGE', litecoin: 'LTC',
                bitcoincash: 'BCH', cardano: 'ADA', polkadot: 'DOT', ton: 'TON', stellar: 'XLM', near: 'NEAR',
                hedera: 'HBAR', algorand: 'ALGO', tezos: 'XTZ', cosmos: 'ATOM', kaspa: 'KAS' };
  const isToken = (sym, key) => {
    const n = netOf(sym, key);
    return !!(n && (n.token || n.wrapped)) || (GAS[key] && GAS[key] !== sym && !(key === 'ton' && sym === 'GRAM'));
  };

  /* ── Address ─────────────────────────────────────────────────────── */
  const WADok = () => typeof WAD !== 'undefined' && WAD.validate && WAD.NETS;
  function checkFor(key, address) {
    if (!String(address || '').trim()) return { ok: false, empty: true, msg: '' };
    if (WADok() && WAD.NETS[key]) return WAD.validate(key, address);
    return { ok: true, warn: 'This address could not be checked on this device.' };
  }
  /* Which of this coin's networks the typed address could be on. */
  function matchingNets(sym, address) {
    const a = String(address || '').trim();
    if (!a || !WADok()) return netsOf(sym).map(n => n.key);
    const fams = WAD.detectNets(a).map(k => (WAD.NETS[k] || {}).family);
    return netsOf(sym).filter(n => fams.indexOf(n.family) > -1).map(n => n.key);
  }

  /* ── Records ─────────────────────────────────────────────────────── */
  const records = () => { const v = read(RKEY); return Array.isArray(v) ? v : []; };
  function saveRec(r) { write(RKEY, [r].concat(records().filter(x => x.id !== r.id)).slice(0, MAX_REC)); return r; }
  const recOf = id => records().find(r => r.id === id) || null;
  const STATUS = { todo: ['Not sent yet', 'wait'], sent: ['Sent', 'ok'], cancelled: ['Cancelled', 'off'] };

  /* ══ Sheet ═══════════════════════════════════════════════════════ */
  let V = null;
  let lastFocus = null;
  const TITLES = {
    coin: 'Send crypto', form: sym => 'Send ' + sym, network: 'Choose network', review: 'Confirm send',
    handoff: 'Send from your wallet', history: 'Sends'
  };

  function open(opts) {
    const o = opts || {};
    if ($('sc-sheet')) close();
    lastFocus = document.activeElement;
    V = { screen: 'coin', stack: [], sym: '', net: '', to: '', amount: o.amount ? String(o.amount) : '', tag: '',
          speed: 'standard', q: '', err: '', recId: '' };
    const el = document.createElement('div');
    el.id = 'sc-sheet';
    el.className = 'dep-sheet';
    el.innerHTML = '<div class="dep-in" role="dialog" aria-modal="true" aria-label="Send crypto"><div id="sc-head"></div><div class="dep-body" id="sc-body"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-sc]');
      if (b) { e.preventDefault(); act(b.dataset.sc, b.dataset.v); return; }
      if (e.target === el) close();
    });
    el.addEventListener('input', e => {
      const f = e.target.closest('[data-scf]');
      if (!f) return;
      const k = f.dataset.scf;
      V[k] = f.value;
      if (k === 'q') { paintList(); return; }
      if (k === 'to') { onAddress(); return; }
      if (k === 'amount') { patchForm(); return; }
    });
    document.addEventListener('keydown', key, true);
    paint();
    requestAnimationFrame(() => el.classList.add('open'));
    loadAssets().then(() => {
      if (!V) return;
      const s = String(o.sym || '').toUpperCase();
      if (s && assetOf(s)) pickCoin(s, true); else paint();
    }).catch(e => { if (V) { V.err = e.message || 'The coin list did not load.'; paint(); } });
  }

  function close() {
    const el = $('sc-sheet');
    if (el) el.remove();
    document.removeEventListener('keydown', key, true);
    V = null;
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
  }
  function key(e) {
    if (e.key !== 'Escape' || !$('sc-sheet')) return;
    if (document.querySelector('.mob-dialog-scrim')) return;
    e.preventDefault(); e.stopPropagation();
    if (V && V.stack.length) back(); else close();
  }
  function go(screen, patch) {
    V.stack.push(V.screen);
    Object.assign(V, patch || {}, { screen, err: '' });
    paint();
  }
  function back() {
    const prev = V.stack.pop();
    if (!prev) { close(); return; }
    V.screen = prev; V.err = '';
    paint();
  }

  function paint() {
    if (!V || !$('sc-body')) return;
    const t = TITLES[V.screen];
    const title = typeof t === 'function' ? t(V.sym) : t;
    $('sc-head').innerHTML = `<div class="dep-head">
      <button type="button" class="dep-ib" data-sc="${V.stack.length ? 'back' : 'close'}" aria-label="${V.stack.length ? 'Back' : 'Close'}">${ico(V.stack.length ? 'arrow_back' : 'close')}</button>
      <b>${esc(title)}</b>
      ${V.screen === 'coin' || V.screen === 'form'
        ? `<button type="button" class="dep-ib" data-sc="history" aria-label="Your sends" title="Your sends">${ico('history')}</button>` : '<span></span>'}
    </div>`;
    const body = $('sc-body');
    body.innerHTML = V.screen === 'coin' ? coinHTML()
      : V.screen === 'form' ? formHTML()
      : V.screen === 'network' ? networkHTML()
      : V.screen === 'review' ? reviewHTML()
      : V.screen === 'handoff' ? handoffHTML()
      : historyHTML();
    if (V.screen === 'coin') { const s = body.querySelector('[data-scf="q"]'); if (s) setTimeout(() => { try { s.focus({ preventScroll: true }); } catch (e) {} }, 60); }
    if (V.screen === 'form') patchForm();
    if (V.screen === 'network') loadNetFees();
  }

  /* ── 1 · coin ────────────────────────────────────────────────────── */
  const dot = (a, big) => `<span class="dep-dot${big ? ' big' : ''}" style="--c:${esc(a.color || '#888')}"><b>${esc(String(a.symbol).slice(0, 1))}</b>${
    a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
  const coinRow = a => `<button type="button" class="dep-row" data-sc="coin" data-v="${esc(a.symbol)}">
      ${dot(a)}<span class="dep-row-t"><b>${esc(a.symbol)}</b><em>${esc(a.name)}</em></span>
      <span class="dep-row-n">${a.networks.length} network${a.networks.length === 1 ? '' : 's'}</span>
      ${ico('chevron_right', 'dep-row-go')}</button>`;

  function coinHTML() {
    if (V.err) return errHTML(V.err, 'reload');
    if (!ASSETS) return skeleton(8);
    return `
      <p class="dep-lead">Send to a wallet or exchange address, on the network it uses. The transfer is sent from your own wallet app — Trending never holds your coins or keys.</p>
      <label class="dep-search">${ico('search')}
        <input type="search" data-scf="q" value="${esc(V.q)}" placeholder="Search coins or networks" aria-label="Search coins" autocomplete="off">
      </label>
      <div id="sc-list">${listHTML()}</div>`;
  }
  function listHTML() {
    const q = V.q.trim().toLowerCase();
    if (q) {
      const hits = ASSETS.filter(a => a.search.indexOf(q) > -1)
        .sort((a, b) => (a.symbol.toLowerCase() === q ? -1 : b.symbol.toLowerCase() === q ? 1 : a.rank - b.rank));
      return hits.length ? `<div class="dep-sec">${hits.length} result${hits.length === 1 ? '' : 's'}</div>${hits.map(coinRow).join('')}`
        : `<div class="dep-empty">${ico('search_off', 'dep-empty-i')}<b>No coin called “${esc(V.q)}”</b><p>Only coins with a network Trending can check addresses on are listed — sending one anywhere else risks losing it.</p></div>`;
    }
    const recent = [...new Set(records().map(r => r.asset))].map(assetOf).filter(Boolean).slice(0, 6);
    const byRank = ASSETS.slice().sort((a, b) => a.rank - b.rank);
    return `
      ${recent.length ? `<div class="dep-sec">Recent</div><div class="dep-chips">${recent.map(a =>
        `<button type="button" class="dep-chip" data-sc="coin" data-v="${esc(a.symbol)}">${dot(a)}${esc(a.symbol)}</button>`).join('')}</div>` : ''}
      <div class="dep-sec">Popular</div>${byRank.slice(0, 10).map(coinRow).join('')}
      <div class="dep-sec">All coins<span class="dep-sec-n">${ASSETS.length}</span></div>${byRank.slice(10).map(coinRow).join('')}`;
  }
  function paintList() { const b = $('sc-list'); if (b && ASSETS) b.innerHTML = listHTML(); }

  async function pickCoin(sym, fresh) {
    const keep = V.sym === sym;
    if (fresh) V.stack = ['coin'];
    else V.stack.push(V.screen);
    Object.assign(V, { screen: 'form', sym, err: '' }, keep ? {} : { net: '', tag: '' });
    paint();
    try {
      await loadNets(sym);
      if (!V || V.sym !== sym) return;
      const list = netsOf(sym);
      // One network: nothing to choose. Otherwise the address decides.
      if (!V.net && list.length === 1) V.net = list[0].key;
      autoNet();
      paint();
    } catch (e) {
      if (V) { V.err = e.message || 'Networks did not load.'; paint(); }
    }
  }

  /* ── 2 · address, network, amount ────────────────────────────────── */
  function formHTML() {
    const a = assetOf(V.sym);
    if (!a) return errHTML('That coin is no longer listed.', 'reload');
    if (V.err) return errHTML(V.err, 'renets');
    const n = netOf(V.sym, V.net);
    const loaded = !!NETS[V.sym];
    return `
      <button type="button" class="dep-netcard" data-sc="back" aria-label="Change coin">
        ${dot(a)}<span class="dep-netcard-v"><b>${esc(a.symbol)}</b><em>${esc(a.name)}</em></span>${ico('chevron_right')}
      </button>

      <label class="dep-field sc-f"><span>Address</span>
        <textarea data-scf="to" rows="2" spellcheck="false" autocapitalize="off" autocomplete="off"
          placeholder="Paste the ${esc(a.symbol)} address you're sending to">${esc(V.to)}</textarea>
      </label>
      <div class="sc-tools">
        <button type="button" class="dep-btn sm" data-sc="paste">${ico('content_paste')}Paste</button>
        ${bookHTML()}
      </div>
      <div id="sc-addr-hint" class="sc-hint"></div>

      <div class="dep-field sc-f"><span>Network</span></div>
      <div id="sc-netcard">${netCardHTML(n, loaded)}</div>

      <label class="dep-field sc-f"><span>Amount</span>
        <span class="sc-amt"><input type="text" inputmode="decimal" data-scf="amount" value="${esc(V.amount)}" placeholder="0" aria-label="Amount">
          <b>${esc(a.symbol)}</b></span>
      </label>

      ${n && n.tagField ? `<label class="dep-field sc-f"><span>${esc(n.tagField.name)} <em class="sc-opt">optional</em></span>
        <input type="text" data-scf="tag" value="${esc(V.tag)}" placeholder="Only if the receiving exchange gives you one" autocomplete="off">
        <em class="sc-opt">${esc(n.tagField.hint)}</em></label>` : ''}

      <div id="sc-fee-host">${feeHTML(n)}</div>
      <div id="sc-sum"></div>
      <button type="button" class="dep-btn primary wide sc-go" id="sc-next" data-sc="review">Continue</button>

      <div class="dep-note">${ico('info')}<span>This prepares a transfer from <b>your own wallet</b>. Your Trending balance is simulated paper money and can't be sent on-chain.
        To pay someone on Trending instead — free and instant — <button type="button" class="dep-link" data-sc="inapp">send to a Trending user</button>.</span></div>`;
  }

  function netCardHTML(n, loaded) {
    if (!loaded) return `<div class="dep-skel"><span></span></div>`;
    return n
      ? `<button type="button" class="dep-netcard" data-sc="net" aria-label="Change network">
          <span class="dep-net-i" style="--c:${esc(n.color)}">${esc(n.code)}</span>
          <span class="dep-netcard-v"><b>${esc(n.label)}${n.tag && n.tag !== n.label ? ` · ${esc(n.tag)}` : ''}</b><em>${esc(n.finality)}</em></span>
          ${ico('chevron_right')}</button>`
      : `<button type="button" class="dep-netcard sc-pick" data-sc="net">
          <span class="dep-netcard-v"><b>Select network</b><em>${netsOf(V.sym).length} networks carry ${esc(V.sym)} — paste the address and the match is picked for you</em></span>
          ${ico('chevron_right')}</button>`;
  }

  function feeHTML(n) {
    if (!n || !hasPF()) return '';
    // The summary under the fee is redrawn once the network answers.
    return PF.feeWidget({ net: n.key, label: n.label, token: isToken(V.sym, n.key), coin: V.sym, speed: V.speed,
                          onPick: 'SC.pickSpeed', onLoad: () => patchForm() });
  }

  function bookHTML() {
    // Addresses you sent this coin to before, newest first.
    const seen = new Set();
    const list = records().filter(r => r.asset === V.sym && r.status !== 'cancelled' && !seen.has(r.to + r.net) && seen.add(r.to + r.net)).slice(0, 4);
    return list.map(r => `<button type="button" class="dep-chip" data-sc="usebook" data-v="${esc(r.id)}" title="${esc(r.to)}">
      ${ico('history')}${esc(r.netLabel)}<i>${esc(short(r.to))}</i></button>`).join('');
  }

  /* An address picks its network when only one of the coin's networks fits
     its shape; with several (every EVM chain), the choice stays yours. */
  function autoNet() {
    const fits = matchingNets(V.sym, V.to);
    if (V.to.trim() && fits.length === 1) V.net = fits[0];
    else if (V.net && V.to.trim() && fits.indexOf(V.net) === -1) V.net = '';
  }

  function onAddress() {
    const before = V.net;
    autoNet();
    if (V.net !== before) {
      const n = netOf(V.sym, V.net);
      const card = $('sc-netcard'); if (card) card.innerHTML = netCardHTML(n, true);
      const fee = $('sc-fee-host'); if (fee) fee.innerHTML = feeHTML(n);
      // A memo field belongs to one network; the form is redrawn for it.
      if ((n && n.tagField) || (before && (netOf(V.sym, before) || {}).tagField)) { paint(); return; }
    }
    patchForm();
  }

  /* The hint under the address, the summary and the button, patched in
     place so typing never loses the caret. */
  function patchForm() {
    if (!V || V.screen !== 'form') return;
    const n = netOf(V.sym, V.net);
    const a = V.to.trim();
    const hint = $('sc-addr-hint');
    let addrOk = false;
    if (hint) {
      if (!a) hint.innerHTML = '';
      else if (!n) {
        const fits = matchingNets(V.sym, a);
        hint.innerHTML = fits.length
          ? `<span class="sc-hint-i">${ico('info')}This address works on ${fits.length} of ${esc(V.sym)}'s networks — pick the one the receiver uses.</span>`
          : `<span class="sc-hint-e">${ico('error')}${esc(detectMsg(a))}</span>`;
      } else {
        const v = checkFor(n.key, a);
        addrOk = v.ok;
        if (v.secret) { V.to = ''; const t = document.querySelector('#sc-body [data-scf="to"]'); if (t) t.value = ''; }
        hint.innerHTML = v.ok
          ? `<span class="sc-hint-ok">${ico('check_circle')}${esc(n.label)} address${v.warn ? ' · ' + esc(v.warn) : ''}</span>`
          : `<span class="sc-hint-e">${ico('error')}${esc(v.msg)}</span>`;
      }
    }
    const amt = num(V.amount);
    const sum = $('sc-sum');
    if (sum && hasPF()) {
      sum.innerHTML = n && amt > 0 ? PF.summary(rows(n, amt, false)) : '';
    }
    const btn = $('sc-next');
    const ready = !!n && addrOk && amt > 0;
    if (btn) { btn.classList.toggle('off', !ready); btn.setAttribute('aria-disabled', String(!ready)); }
  }

  function detectMsg(a) {
    if (!WADok()) return `That doesn't look like an address for ${V.sym}.`;
    const v = WAD.validate(netsOf(V.sym)[0] ? netsOf(V.sym)[0].key : 'ethereum', a);
    if (v.secret) { V.to = ''; const t = document.querySelector('#sc-body [data-scf="to"]'); if (t) t.value = ''; return v.msg; }
    const guess = WAD.detectNets(a);
    return guess.length
      ? `That's a ${WAD.NETS[guess[0]].label} address, and ${V.sym} isn't sent on ${WAD.NETS[guess[0]].label} here. Sending it there would lose it.`
      : `That doesn't look like an address on any of ${V.sym}'s networks. Copy it again from the receiving app.`;
  }

  /* The rows every payment ends with (features/payflow.js), for this send. */
  function rows(n, amt, full) {
    const token = isToken(V.sym, n.key);
    const fee = hasPF() ? PF.feeLine(n.key, token, V.speed) : { text: 'Shown in your wallet app' };
    const usd = hasPF() ? PF.usdOf(amt, V.sym) : '';
    const out = [
      ['You send', `${esc(qty(amt))} ${esc(V.sym)}${usd ? ` <small>${esc(usd)}</small>` : ''}`],
      ['Network fee', fee.tier
        ? `${esc(fee.text)}<small>${fee.usd ? esc(fee.usd) + ' · ' : ''}${esc(fee.speed)} · paid from your wallet</small>`
        : `<small>${esc(fee.text)}</small>`],
      ['They receive', `${esc(qty(amt))} ${esc(V.sym)}`],
      ['Arrives', fee.eta ? esc(fee.eta) : esc(n.finality || 'When the network confirms it')]
    ];
    if (full) out.splice(0, 0, ['Network', `${esc(n.label)}${n.tag && n.tag !== n.label ? ` <small>${esc(n.tag)}</small>` : ''}`]);
    if (fee.tier && !token) {
      out.push(['Total from your wallet', `${esc(hasPF() ? PF.coinAmt(amt + num(fee.tier.amountMax || fee.tier.amount)) : amt)} ${esc(V.sym)}`, 'total']);
    }
    return out;
  }

  /* ── 3 · network ─────────────────────────────────────────────────── */
  function networkHTML() {
    const list = netsOf(V.sym);
    if (!list.length) return skeleton(4);
    const fits = V.to.trim() ? matchingNets(V.sym, V.to) : null;
    return `
      <div class="dep-warn">${ico('warning')}<span><b>Use the network the receiver uses for ${esc(V.sym)}</b>
        The same coin on two networks is not the same coin. Sent over a network the receiving address doesn't support, it is usually gone for good.</span></div>
      ${list.map(n => {
        const off = n.status !== 'open' || (fits && fits.indexOf(n.key) === -1);
        return `<button type="button" class="dep-net${off ? ' off' : ''}${n.key === V.net ? ' sc-on' : ''}" data-sc="${off ? 'netoff' : 'pick'}" data-v="${esc(n.key)}"${off ? ' aria-disabled="true"' : ''}>
          <span class="dep-net-i" style="--c:${esc(n.color)}">${esc(n.code)}</span>
          <span class="dep-net-t">
            <b>${esc(n.label)}${n.tag && n.tag !== n.label ? `<i>${esc(n.tag)}</i>` : ''}</b>
            <em>${fits && fits.indexOf(n.key) === -1 ? 'The address you pasted is not on this network' : esc(n.finality)}</em>
            <span class="dep-net-m">
              <span id="sc-nf-${esc(n.key)}">${ico('local_gas_station')}Fee…</span>
              ${n.wrapped ? `<span class="wrap">${ico('link')}Bridged token</span>` : ''}
              ${n.tagField ? `<span>${ico('label')}${esc(n.tagField.name)}</span>` : ''}
            </span>
          </span>
          ${off ? '' : ico('chevron_right', 'dep-row-go')}
        </button>`;
      }).join('')}`;
  }

  /* Each network's current fee, filled in as it arrives. */
  function loadNetFees() {
    if (!hasPF()) return;
    netsOf(V.sym).forEach(n => {
      const token = isToken(V.sym, n.key);
      PF.fee(n.key, token).then(est => {
        const el = $('sc-nf-' + n.key);
        if (!el) return;
        const t = PF.tierOf(est, 'standard');
        el.innerHTML = t
          ? `${ico('local_gas_station')}${esc(PF.coinAmt(t.amount))}${t.amountMax ? '–' + esc(PF.coinAmt(t.amountMax)) : ''} ${esc(est.coin)}${PF.usdOf(t.amount, est.coin) ? ' · ' + esc(PF.usdOf(t.amount, est.coin)) : ''}`
          : `${ico('local_gas_station')}Fee shown in your wallet`;
      });
    });
  }

  /* ── 4 · review ──────────────────────────────────────────────────── */
  function reviewHTML() {
    const a = assetOf(V.sym), n = netOf(V.sym, V.net);
    const amt = num(V.amount);
    let warn = '';
    if (hasPF() && typeof MNY !== 'undefined') {
      const f = PF.feeLine(n.key, isToken(V.sym, n.key), V.speed);
      if (f.tier) {
        const feeUsd = num(f.tier.amountMax || f.tier.amount) * MNY.price(f.coin), amtUsd = amt * MNY.price(V.sym);
        if (amtUsd > 0 && feeUsd / amtUsd >= 0.05) {
          warn = `<div class="pf-warn">${ico('warning')}<div>The network fee is about ${Math.round((feeUsd / amtUsd) * 100)}% of this send.
            A cheaper network for ${esc(V.sym)} may be listed — <button type="button" class="pf-link" data-sc="net">compare networks</button>.</div></div>`;
        }
      }
    }
    return `
      <div class="sc-rev">${dot(a, true)}<b>${esc(qty(amt))} ${esc(V.sym)}</b>
        ${hasPF() && PF.usdOf(amt, V.sym) ? `<span>${esc(PF.usdOf(amt, V.sym))}</span>` : ''}</div>
      <div class="sc-to"><span>To</span><code>${chunk(V.to)}</code></div>
      ${V.tag ? `<div class="sc-to"><span>${esc(n.tagField ? n.tagField.name : 'Memo')}</span><code>${esc(V.tag)}</code></div>` : ''}
      ${hasPF() ? PF.summary(rows(n, amt, true)) : ''}
      ${warn}
      <div class="dep-warn hard">${ico('warning')}<span><b>Check the address once more</b>
        The bold characters at each end should match what the receiver gave you. A blockchain transfer can't be reversed — not by you, the receiver or Trending.
        ${n.wrapped || a.token ? ` ${esc(V.sym)} is a token on ${esc(n.label)}: make sure your wallet sends the right one — Trending doesn't publish contract addresses.` : ''}</span></div>
      <button type="button" class="dep-btn primary wide" data-sc="handoff">${ico('account_balance_wallet')}Send from my wallet</button>`;
  }
  const chunk = a => {
    const s = String(a || '');
    if (s.length < 12) return esc(s);
    return `<b>${esc(s.slice(0, 6))}</b>${esc(s.slice(6, -6))}<b>${esc(s.slice(-6))}</b>`;
  };
  const short = a => { const s = String(a || ''); return s.length > 16 ? s.slice(0, 7) + '…' + s.slice(-5) : s; };

  /* ── 5 · hand it to the wallet ───────────────────────────────────── */
  function handoffHTML() {
    const r = recOf(V.recId);
    if (!r) return errHTML('That send is no longer here.', 'close');
    const uri = WADok() && WAD.walletURI ? WAD.walletURI(r.net, r.to, r.asset, r.amount) : r.to;
    const hasLink = uri && uri !== r.to;
    const [label, cls] = STATUS[r.status] || STATUS.todo;
    return `
      <div class="sc-rev">${dot(assetOf(r.asset) || { symbol: r.asset }, true)}<b>${esc(qty(r.amount))} ${esc(r.asset)}</b>
        <span class="dep-pill ${cls}">${esc(label)}</span></div>
      <ol class="sc-steps">
        <li><b>Open the wallet that holds your ${esc(r.asset)}</b>
          <span>${hasLink ? 'The button below opens it with the address filled in, if your wallet supports links.' : 'MetaMask, Trust Wallet, Phantom, an exchange app — wherever the coins are.'}</span>
          ${hasLink ? `<a class="dep-btn sm" href="${esc(uri)}">${ico('open_in_new')}Open in wallet app</a>` : ''}</li>
        <li><b>Send on ${esc(r.netLabel)}</b><span>Choose ${esc(r.asset)} and the ${esc(r.netLabel)} network in your wallet.</span></li>
        <li><b>Paste this address</b>
          <code class="sc-code">${chunk(r.to)}</code>
          <span class="sc-row"><button type="button" class="dep-btn sm" data-sc="copyto">${ico('content_copy')}Copy address</button>
          <button type="button" class="dep-btn sm" data-sc="qr">${ico('qr_code_2')}Show QR</button></span>
          <div id="sc-qr"></div></li>
        ${r.tag ? `<li><b>Add the ${esc(r.tagName || 'memo')}</b><code class="sc-code">${esc(r.tag)}</code>
          <button type="button" class="dep-btn sm" data-sc="copytag">${ico('content_copy')}Copy</button></li>` : ''}
        <li><b>Enter ${esc(qty(r.amount))} ${esc(r.asset)}</b>
          <button type="button" class="dep-btn sm" data-sc="copyamt">${ico('content_copy')}Copy amount</button>
          <span>${r.speedName ? `Pick <b>${esc(r.speedName)}</b> speed if your wallet offers one. ` : ''}Your wallet shows the exact fee before you confirm.</span></li>
      </ol>
      ${r.status === 'todo'
        ? `<button type="button" class="dep-btn primary wide" data-sc="sent" data-v="${esc(r.id)}">${ico('check')}I've sent it</button>
           <button type="button" class="dep-btn wide" data-sc="cancelrec" data-v="${esc(r.id)}">${ico('close')}I didn't send it</button>`
        : r.txid ? `<button type="button" class="dep-btn wide" data-sc="explorer" data-v="${esc(r.id)}">${ico('open_in_new')}View on explorer</button>` : ''}
      <div class="dep-note">${ico('shield')}<span>Trending didn't send this and can't see it. Your wallet and the block explorer are the record — this is a note of what you prepared, kept on this device.</span></div>`;
  }

  /* ── 6 · history ─────────────────────────────────────────────────── */
  function historyHTML() {
    const list = records();
    if (!list.length) return `<div class="dep-empty tall">${ico('inbox', 'dep-empty-i')}<b>No sends yet</b>
      <p>Sends you prepare here are kept on this device with their address, network and transaction, so the details are in one place.</p></div>`;
    return list.map(r => {
      const [label, cls] = STATUS[r.status] || STATUS.todo;
      return `<button type="button" class="dep-rec sc-rec" data-sc="openrec" data-v="${esc(r.id)}">
        <div class="dep-rec-h"><b>${esc(qty(r.amount))} ${esc(r.asset)}</b><span class="dep-pill ${cls}">${esc(label)}</span></div>
        <div class="dep-rec-m">${esc(r.netLabel)} · to ${esc(short(r.to))}</div>
        ${r.txid ? `<code class="tx">${esc(short(r.txid))}</code>` : ''}
        <div class="dep-rec-t">${esc(new Date(r.at).toLocaleString())}</div>
      </button>`;
    }).join('');
  }

  /* ── Shared ──────────────────────────────────────────────────────── */
  const skeleton = n => `<div class="dep-skel">${Array.from({ length: n }, () => '<span></span>').join('')}</div>`;
  const errHTML = (msg, retry) => `<div class="dep-empty tall">${ico('cloud_off', 'dep-empty-i')}<b>Could not load this</b>
    <p>${esc(msg)}</p><button type="button" class="dep-btn primary" data-sc="${retry}">${ico('refresh')}Try again</button></div>`;

  /* ── Actions ─────────────────────────────────────────────────────── */
  async function act(what, v) {
    if (!V) return;
    switch (what) {
      case 'close': close(); return;
      case 'back': back(); return;
      case 'history': go('history'); return;
      case 'reload': V.err = ''; ASSETS = null; paint(); loadAssets().then(() => V && paint()).catch(e => { if (V) { V.err = e.message; paint(); } }); return;
      case 'renets': V.err = ''; delete NETS[V.sym]; pickCoin(V.sym, true); return;
      case 'coin': pickCoin(v); return;
      case 'net': go('network'); return;
      case 'netoff': toast(V.to.trim() ? 'That network doesn’t match the address you pasted.' : 'That network is paused right now.'); return;
      case 'pick': V.net = v; back(); return;
      case 'paste': return paste();
      case 'usebook': { const r = recOf(v); if (r) { V.to = r.to; V.net = r.net; paint(); } return; }
      case 'review': return toReview();
      case 'handoff': return handoff();
      case 'inapp':
        close();
        if (typeof PAY !== 'undefined' && PAY.openPayTo) PAY.openPayTo({});
        return;
      case 'copyto': { const r = recOf(V.recId); if (r) copy(r.to, 'Address copied'); return; }
      case 'copytag': { const r = recOf(V.recId); if (r) copy(r.tag, 'Copied'); return; }
      case 'copyamt': { const r = recOf(V.recId); if (r) copy(String(r.amount), 'Amount copied'); return; }
      case 'qr': return showQR();
      case 'sent': return markSent(v);
      case 'cancelrec': return cancelRec(v);
      case 'explorer': return explorer(v);
      case 'openrec': V.recId = v; go('handoff'); return;
    }
  }

  function pickSpeed(sp) { if (!V) return; V.speed = sp; const n = netOf(V.sym, V.net); const f = $('sc-fee-host'); if (f) f.innerHTML = feeHTML(n); patchForm(); }

  async function paste() {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) { toast('The clipboard is empty.'); return; }
      V.to = t.trim();
      const box = document.querySelector('#sc-body [data-scf="to"]');
      if (box) box.value = V.to;
      onAddress();
    } catch (e) { toast('Paste it into the box — this browser didn’t allow reading the clipboard.'); }
  }

  function toReview() {
    const n = netOf(V.sym, V.net);
    if (!n) { toast('Choose the network first.'); return; }
    const v = checkFor(n.key, V.to);
    if (!v.ok) { toast(v.msg || 'Check the address.'); return; }
    if (!(num(V.amount) > 0)) { toast('Enter an amount.'); return; }
    // Keep the estimate warm for the review's summary.
    if (hasPF()) PF.fee(n.key, isToken(V.sym, n.key)).then(() => { if (V && V.screen === 'review') paint(); });
    go('review');
  }

  function handoff() {
    const n = netOf(V.sym, V.net);
    const fee = hasPF() ? PF.feeLine(n.key, isToken(V.sym, n.key), V.speed) : {};
    const r = saveRec({
      id: uid(), asset: V.sym, net: n.key, netLabel: n.label, to: V.to.trim(), amount: num(V.amount),
      tag: V.tag.trim(), tagName: n.tagField ? n.tagField.name : '',
      speedName: fee.tier ? fee.speed : '', feeText: fee.tier ? fee.text : '',
      explorerTx: n.explorer || '', status: 'todo', txid: '', at: Date.now()
    });
    V.recId = r.id;
    V.stack = [];                                    // done with the form
    V.screen = 'handoff';
    paint();
  }

  function showQR() {
    const r = recOf(V.recId), box = $('sc-qr');
    if (!r || !box) return;
    if (box.innerHTML) { box.innerHTML = ''; return; }
    let code = '';
    try { code = QRGEN.svg(QRGEN.make(r.to), 196, ''); } catch (e) { code = '<p class="sc-hint">This address is too long to draw as a code — copy it instead.</p>'; }
    box.innerHTML = `<div class="dep-qr sc-qr">${code}<span class="dep-qr-l">Scan with the wallet you send from</span></div>`;
  }

  async function markSent(id) {
    const r = recOf(id);
    if (!r) return;
    let tx = '';
    if (typeof appPrompt === 'function') {
      const v = await appPrompt('Paste the transaction ID from your wallet, or leave it blank.', '', { title: 'Sent', ok: 'Save' });
      if (v === null || v === false) return;
      tx = String(v || '').trim().slice(0, 120);
    }
    r.status = 'sent'; r.txid = tx; r.sentAt = Date.now();
    saveRec(r);
    paint();
    toast(tx ? 'Saved — follow it on the explorer' : 'Marked as sent');
  }
  function cancelRec(id) {
    const r = recOf(id);
    if (!r) return;
    r.status = 'cancelled';
    saveRec(r);
    close();
    toast('Marked as not sent — nothing left your wallet.');
  }
  function explorer(id) {
    const r = recOf(id);
    if (!r || !r.txid || !r.explorerTx) return;
    window.open(r.explorerTx + encodeURIComponent(r.txid), '_blank', 'noopener,noreferrer');
  }
  function copy(text, msg) {
    const t = String(text || '');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast(msg), () => toast(t));
    else toast(t);
  }

  return { open, close, act, pickSpeed, records, get state() { return V; } };
})();

window.SC = SC;

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module, so its top-level names are private to it.
   Inline onclick= handlers and every other module still look them up
   on the global object, so they are republished here. */
import { publish } from '../globals.js?v=3';
publish('features/sendcrypto.js', {
  SC: () => SC
});
