/* ╔══════════════════════════════════════════════════════════════════╗
   ║  DEPOSIT CRYPTO — bringing coins in from another exchange         ║
   ║                                                                   ║
   ║  Method → Asset → Network → Address, the four steps anyone who    ║
   ║  has withdrawn from an exchange already knows.                    ║
   ║                                                                   ║
   ║  Where the address comes from, and why it matters                 ║
   ║  ─────────────────────────────────────────────────                ║
   ║  An exchange hands you a deposit address because it holds the     ║
   ║  key to it: your coins land in its wallet and it credits a        ║
   ║  number next to your name. That is custody, and it needs a key-   ║
   ║  management service, a chain watcher, an auditable ledger and     ║
   ║  someone on call. Trending has none of that, so it does not       ║
   ║  invent an address — an address nobody holds the key to is a      ║
   ║  hole you throw money into.                                       ║
   ║                                                                   ║
   ║  So a deposit here goes to an address YOU control: the wallet     ║
   ║  you connected, or one you saved. Everything else is real — the   ║
   ║  network list comes from the server, the QR encodes your actual   ║
   ║  address, the warnings are the ones that matter. What is missing  ║
   ║  is the part that would need custody, and that part says so       ║
   ║  rather than pretending.                                          ║
   ║                                                                   ║
   ║  Rules kept here, deliberately:                                   ║
   ║   1. No address is ever generated, guessed or filled in for you.  ║
   ║   2. A simulated wallet is never offered as a destination.        ║
   ║   3. No token contract address is published — one wrong           ║
   ║      character is somebody's money. Verify it where you send.     ║
   ║   4. Trending does not watch the chain, so it never claims a      ║
   ║      transfer confirmed. The explorer is the authority and is     ║
   ║      one tap away.                                                ║
   ║   5. A real transfer never touches the simulated paper balance.   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const DEP = (() => {

  const CKEY = 'ts_deposit_cfg_v1';
  const RKEY = 'ts_deposit_recent_v1';
  const DKEY = 'ts_deposits_v1';
  const CFG_TTL = 10 * 60 * 1000;
  const MAX_RECENT = 6;

  const $ = id => document.getElementById(id);
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
  const ico = (n, c) => `<span class="material-symbols-rounded${c ? ' ' + c : ''}" aria-hidden="true">${n}</span>`;
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const uid = p => (p || 'd_') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  /* ── What the server says can be deposited ───────────────────────── */
  let ASSETS = null;       // [{symbol,name,color,rank,token,networks[],search}]
  let NETS = {};           // symbol -> {asset, networks[]}
  let stale = false;       // showing a cached copy because the server didn't answer
  let custody = null;      // null = not asked yet, false = self-custody only
  const issued = {};       // 'ASSET:net' -> the address the server issued, or null

  async function api(path) {
    const r = await fetch(path, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    if (!r.ok) {
      let body = null;
      try { body = await r.json(); } catch (e) {}
      const err = new Error((body && body.message) || ('Server answered ' + r.status));
      err.status = r.status;
      err.code = body && body.error;
      throw err;
    }
    return r.json();
  }

  async function loadAssets(force) {
    if (ASSETS && !force) return ASSETS;
    const cached = read(CKEY);
    try {
      const j = await api('/api/crypto/assets');
      ASSETS = j.assets || [];
      stale = false;
      write(CKEY, { at: Date.now(), version: j.version, assets: ASSETS });
      return ASSETS;
    } catch (e) {
      // A cached list still tells the truth about which chains exist; it is
      // shown with a note rather than blocking the screen entirely.
      if (cached && Array.isArray(cached.assets) && cached.assets.length) {
        ASSETS = cached.assets;
        stale = true;
        return ASSETS;
      }
      throw e;
    }
  }

  async function loadNets(symbol, force) {
    if (NETS[symbol] && !force) return NETS[symbol];
    const j = await api('/api/crypto/assets/' + encodeURIComponent(symbol) + '/networks');
    NETS[symbol] = { asset: j.asset, networks: j.networks || [] };
    return NETS[symbol];
  }

  /* Is this deployment holding deposits, or is it the self-custody build?
     One cheap public call decides, and it is asked once. A server with no
     custody configured says so plainly, and the flow stays on the path
     where the address belongs to the user. */
  async function askCustody() {
    if (custody !== null) return custody;
    try {
      const j = await api('/api/crypto/config');
      custody = j.custody && j.custody !== 'none' ? j : false;
    } catch (e) { custody = false; }
    return custody;
  }

  /* Ask the server for this user's deposit address. Anything other than a
     clean answer means the self-custody path — there is no fallback that
     invents an address. */
  async function askAddress(sym, net) {
    const key = sym + ':' + net;
    if (key in issued) return issued[key];
    issued[key] = null;
    if (!(await askCustody())) return null;
    try {
      // The wallet server knows who you are only from your sign-in token.
      const who = typeof authHeaders === 'function' ? await authHeaders() : {};
      const r = await fetch('/api/crypto/deposit/address', {
        method: 'POST', credentials: 'same-origin',
        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, who),
        body: JSON.stringify({ asset: sym, network: net })
      });
      if (r.status === 200) issued[key] = await r.json();
      else if (r.status === 401) issued[key] = { signIn: true };
    } catch (e) { /* stay on the self-custody path */ }
    return issued[key];
  }

  const assetOf = sym => (ASSETS || []).find(a => a.symbol === sym) || null;
  const netOf = (sym, key) => ((NETS[sym] || {}).networks || []).find(n => n.key === key) || null;

  /* ── Your own receiving addresses ────────────────────────────────── */
  /* WAD owns these. A simulated wallet is filtered out here as well as
     there, because a demo address that received real coins is a loss. */
  const XRPL_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

  function myAddresses(netKey, family) {
    const all = (typeof WAD !== 'undefined' && WAD.ownList) ? WAD.ownList() : [];
    const usable = all.filter(a => !a.simulated && a.address);
    // A network WAD does not store yet is held for this session only.
    if (V && V.extra && V.extra.net === netKey && !usable.some(x => x.address === V.extra.address)) usable.push(V.extra);
    const exact = usable.filter(a => a.net === netKey);
    // The same EVM address works on every EVM chain, but only if the wallet
    // itself is there — a contract wallet may not be. Offered, with the
    // caveat, and never silently chosen.
    const evm = family === 'evm'
      ? usable.filter(a => a.net !== netKey && evmFamily(a.net))
          .filter((a, i, list) => list.findIndex(x => x.address.toLowerCase() === a.address.toLowerCase()) === i)
      : [];
    return { exact, evm };
  }
  const EVM_NETS = { ethereum: 1, base: 1, arbitrum: 1, optimism: 1, polygon: 1, bnb: 1 };
  const evmFamily = k => !!EVM_NETS[k];

  function checkAddress(netKey, family, address) {
    const a = String(address || '').trim();
    if (!a) return { ok: false, msg: 'Paste the address you want to receive at.' };
    if (family === 'xrpl') {
      return XRPL_RE.test(a) ? { ok: true }
        : { ok: false, msg: 'An XRP Ledger address starts with r and is 25–35 characters.' };
    }
    if (typeof WAD !== 'undefined' && WAD.validate && WAD.NETS && WAD.NETS[netKey]) return WAD.validate(netKey, a);
    return { ok: true, warn: 'This address could not be checked on this device.' };
  }

  /* The link a wallet app understands. For a token there is no amount and
     no contract in the URI on purpose: the sending app picks the token. */
  function uriFor(net, address) {
    if (!net) return address;
    if (net.family === 'evm') return 'ethereum:' + address + (net.chainId ? '@' + net.chainId : '');
    if (net.family === 'bitcoin') return 'bitcoin:' + address;
    if (net.family === 'solana') return 'solana:' + address;
    return address;                                  // tron, xrpl: the address itself
  }

  /* ── Deposit records ─────────────────────────────────────────────── */
  /* A record is a note the user keeps, not a claim by Trending. Status
     only ever moves because the user moved it or the explorer showed
     them something — never because this file decided. */
  const records = () => { const v = read(DKEY); return Array.isArray(v) ? v : []; };
  function saveRecord(rec) {
    const list = records().filter(r => r.id !== rec.id);
    list.unshift(rec);
    write(DKEY, list.slice(0, 40));
    return rec;
  }
  function dropRecord(id) { write(DKEY, records().filter(r => r.id !== id)); }
  const recordOf = id => records().find(r => r.id === id) || null;

  const STATUS = {
    waiting: ['Waiting for your transfer', 'wait'],
    sent: ['Sent — not checked yet', 'wait'],
    arrived: ['You marked this arrived', 'ok'],
    archived: ['Closed', 'off']
  };

  /* ── Recently used assets ────────────────────────────────────────── */
  const recent = () => { const v = read(RKEY); return Array.isArray(v) ? v.slice(0, MAX_RECENT) : []; };
  function pushRecent(sym) {
    write(RKEY, [sym].concat(recent().filter(s => s !== sym)).slice(0, MAX_RECENT));
  }
  function clearRecent() { write(RKEY, []); paint(); toast('Recent assets cleared'); }

  /* ══ View ════════════════════════════════════════════════════════ */
  let V = null;            // { screen, sym, net, addrId, tag, q, busy, err, recId }
  let lastFocus = null;

  const TITLES = {
    method: 'Add funds', asset: 'Select asset', network: 'Choose network',
    address: sym => 'Deposit ' + sym, activity: 'Deposit activity'
  };

  function open(screen) {
    if ($('dep-sheet')) return;
    lastFocus = document.activeElement;
    V = { screen: screen || 'method', sym: '', net: '', addrId: '', tag: '', q: '', busy: false, err: '', stack: [] };
    const el = document.createElement('div');
    el.id = 'dep-sheet';
    el.className = 'dep-sheet';
    el.innerHTML = '<div class="dep-in" role="dialog" aria-modal="true" aria-label="Deposit crypto"><div id="dep-head"></div><div class="dep-body" id="dep-body"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-dep]');
      if (b) { e.preventDefault(); act(b.dataset.dep, b.dataset.v, b); return; }
      if (e.target === el) close();
    });
    el.addEventListener('input', e => {
      const s = e.target.closest('[data-depf]');
      if (!s) return;
      if (s.dataset.depf === 'q') { V.q = s.value; paintList(); return; }
      V[s.dataset.depf] = s.value;
    });
    document.addEventListener('keydown', key, true);
    paint();
    requestAnimationFrame(() => el.classList.add('open'));
    if (V.screen === 'asset') ensureAssets();
  }

  function close() {
    const el = $('dep-sheet');
    if (el) el.remove();
    document.removeEventListener('keydown', key, true);
    V = null;
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    lastFocus = null;
  }
  function key(e) {
    if (e.key !== 'Escape' || !$('dep-sheet')) return;
    if (document.querySelector('.mob-dialog-scrim')) return;
    e.preventDefault(); e.stopPropagation();
    if (V && V.stack.length) back(); else close();
  }

  function go(screen, patch) {
    if (!V) return;
    V.stack.push({ screen: V.screen, sym: V.sym, net: V.net, addrId: V.addrId, tag: V.tag, q: V.q });
    Object.assign(V, patch || {}, { screen, err: '', q: '' });
    paint();
  }
  function back() {
    if (!V) return;
    const prev = V.stack.pop();
    if (!prev) { close(); return; }
    Object.assign(V, prev, { err: '', busy: false });
    paint();
  }

  /* ── Paint ───────────────────────────────────────────────────────── */
  function paint() {
    if (!V || !$('dep-body')) return;
    const title = typeof TITLES[V.screen] === 'function' ? TITLES[V.screen](V.sym) : TITLES[V.screen];
    $('dep-head').innerHTML = `<div class="dep-head">
      <button type="button" class="dep-ib" data-dep="${V.stack.length ? 'back' : 'close'}" aria-label="${V.stack.length ? 'Back' : 'Close'}">${ico(V.stack.length ? 'arrow_back' : 'close')}</button>
      <b>${esc(title)}</b>
      ${V.screen === 'address' || V.screen === 'activity' ? '' : `<button type="button" class="dep-ib" data-dep="activity" aria-label="Deposit activity" title="Deposit activity">${ico('history')}</button>`}
    </div>`;
    const body = $('dep-body');
    body.innerHTML = V.screen === 'method' ? methodHTML()
      : V.screen === 'asset' ? assetHTML()
      : V.screen === 'network' ? networkHTML()
      : V.screen === 'address' ? addressHTML()
      : activityHTML();
    const s = body.querySelector('[data-depf="q"]');
    if (s && V.screen === 'asset') setTimeout(() => { try { s.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }

  /* ── 1 · How do you want to add funds ────────────────────────────── */
  function methodHTML() {
    const rows = [
      ['crypto', 'token', 'Deposit crypto', 'Receive coins from another exchange or wallet', '#FCD535', true],
      ['p2p', 'swap_horiz', 'Buy with P2P', 'Pay a seller in your local currency, off-platform', '#26A69A', typeof P2P !== 'undefined'],
      ['payid', 'qr_code_2', 'Ask someone on Trending', 'Share your pay code in a chat', '#EC6CB9', typeof PAY !== 'undefined' && !!PAY.openMyQR]
    ].filter(r => r[5]);
    return `
      <p class="dep-lead">Crypto you deposit goes to your own wallet, on the blockchain. Trending never holds it.</p>
      ${rows.map(([k, i, t, d, c]) => `<button type="button" class="dep-row" data-dep="method" data-v="${k}">
        <span class="dep-row-i" style="--c:${c}">${ico(i)}</span>
        <span class="dep-row-t"><b>${esc(t)}</b><em>${esc(d)}</em></span>
        ${ico('chevron_right', 'dep-row-go')}</button>`).join('')}
      <div class="dep-note">${ico('info')}<span>Trending balances shown elsewhere in the app are simulated paper trading. A real transfer lands in your own wallet and is never mixed with them.</span></div>`;
  }

  /* ── 2 · Which coin ──────────────────────────────────────────────── */
  function assetHTML() {
    if (V.err) return errHTML(V.err, 'assets');
    if (!ASSETS) return skeleton(8);
    return `
      <label class="dep-search">${ico('search')}
        <input type="search" data-depf="q" value="${esc(V.q)}" placeholder="Search coins, tickers or a network" aria-label="Search coins" autocomplete="off">
      </label>
      ${stale ? `<div class="dep-note warn">${ico('cloud_off')}<span>Showing the list this device saved earlier — the server did not answer. <button type="button" class="dep-link" data-dep="reload">Try again</button></span></div>` : ''}
      <div id="dep-list">${listHTML()}</div>`;
  }

  function listHTML() {
    const q = V.q.trim().toLowerCase();
    if (q) {
      const hits = ASSETS.filter(a => a.search.indexOf(q) > -1)
        .sort((a, b) => (a.symbol.toLowerCase() === q ? -1 : b.symbol.toLowerCase() === q ? 1 : a.rank - b.rank));
      return hits.length
        ? `<div class="dep-sec">${hits.length} result${hits.length === 1 ? '' : 's'}</div>${hits.map(assetRow).join('')}`
        : `<div class="dep-empty">${ico('search_off', 'dep-empty-i')}<b>No coin called “${esc(V.q)}”</b>
             <p>Trending lists ${ASSETS.length} assets for deposit. If yours is missing, it has no supported network here yet — sending it anyway would lose it.</p></div>`;
    }
    const rec = recent().map(assetOf).filter(Boolean);
    /* The market's order: the ten biggest first, then every coin that has
       a network here. It was twenty coins, hard-coded, each a letter. */
    const byRank = ASSETS.slice().sort((a, b) => a.rank - b.rank);
    const popular = byRank.slice(0, 10), rest = byRank.slice(10);
    return `
      ${rec.length ? `<div class="dep-sec">Recent<button type="button" class="dep-ib sm" data-dep="clearrecent" aria-label="Clear recent">${ico('delete')}</button></div>
        <div class="dep-chips">${rec.map(a => `<button type="button" class="dep-chip" data-dep="asset" data-v="${esc(a.symbol)}">${dot(a)}${esc(a.symbol)}</button>`).join('')}</div>` : ''}
      <div class="dep-sec">Popular</div>
      ${popular.map(assetRow).join('')}
      ${rest.length ? `<div class="dep-sec">All coins<span class="dep-sec-n">${ASSETS.length}</span></div>${rest.map(assetRow).join('')}` : ''}`;
  }

  /* The coin's own logo, with its first letter underneath for the moment
     before it loads, or if it can't. */
  const dot = (a, big) => `<span class="dep-dot${big ? ' big' : ''}" style="--c:${esc(a.color)}"><b>${esc(a.symbol.slice(0, 1))}</b>${
    a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
  const assetRow = a => `<button type="button" class="dep-row" data-dep="asset" data-v="${esc(a.symbol)}">
      ${dot(a)}
      <span class="dep-row-t"><b>${esc(a.symbol)}</b><em>${esc(a.name)}</em></span>
      <span class="dep-row-n">${a.networks.length} network${a.networks.length === 1 ? '' : 's'}</span>
      ${ico('chevron_right', 'dep-row-go')}</button>`;

  function paintList() {
    const box = $('dep-list');
    if (box && ASSETS) box.innerHTML = listHTML();
  }

  /* ── 3 · Which network ───────────────────────────────────────────── */
  function networkHTML() {
    if (V.err) return errHTML(V.err, 'nets');
    const data = NETS[V.sym];
    if (!data) return skeleton(4);
    const a = data.asset;
    return `
      <div class="dep-asset">${dot(assetOf(a.symbol) || a, true)}
        <div><b>${esc(a.symbol)}</b><em>${esc(a.name)}</em></div></div>

      <div class="dep-warn">${ico('warning')}<span><b>Pick the same network the sender will use</b>
        A coin sent over a network this address does not cover is usually gone for good. Nobody can reverse it — not the sender, not Trending.</span></div>

      ${data.networks.map(n => {
        const off = n.status !== 'open';
        return `<button type="button" class="dep-net${off ? ' off' : ''}" data-dep="${off ? 'netoff' : 'net'}" data-v="${esc(n.key)}"${off ? ' aria-disabled="true"' : ''}>
          <span class="dep-net-i" style="--c:${esc(n.color)}">${esc(n.code)}</span>
          <span class="dep-net-t">
            <b>${esc(n.label)}${n.tag && n.tag !== n.label ? `<i>${esc(n.tag)}</i>` : ''}</b>
            <em>${esc(n.finality)}</em>
            <span class="dep-net-m">
              <span>${ico('bolt')}New block ~${blockText(n.blockSeconds)}</span>
              ${n.wrapped ? `<span class="wrap">${ico('link')}Bridged token</span>` : ''}
              ${n.tagField ? `<span>${ico('label')}${esc(n.tagField.name)}</span>` : ''}
            </span>
          </span>
          ${off ? `<span class="dep-pill off">${n.status === 'maintenance' ? 'Maintenance' : 'Paused'}</span>` : ico('chevron_right', 'dep-row-go')}
        </button>`;
      }).join('')}

      <div class="dep-note">${ico('savings')}<span>There is no Trending minimum, because the coins land in your own wallet. The exchange you send from sets its own minimum and fee — check them there.</span></div>`;
  }
  const blockText = s => s >= 60 ? Math.round(s / 60) + ' min' : s + 's';

  /* ── 4 · The address ─────────────────────────────────────────────── */
  function addressHTML() {
    const a = assetOf(V.sym);
    const n = netOf(V.sym, V.net);
    if (!a || !n) return errHTML('That network is no longer listed for this coin.', 'nets');

    const mine = myAddresses(n.key, n.family);
    const server = issued[V.sym + ':' + V.net];
    const chosen = server && server.address
      ? { id: 'srv', address: server.address, label: 'Your Trending deposit address', source: 'trending', tag: server.memo || '' }
      : pickAddress(mine);

    return `
      <div class="dep-asset">${dot(a, true)}<div><b>${esc(a.symbol)}</b><em>${esc(a.name)}</em></div></div>
      <button type="button" class="dep-netcard" data-dep="back" aria-label="Change network">
        <span class="dep-netcard-l">Network</span>
        <span class="dep-netcard-v"><b>${esc(n.code)}</b><em>${esc(n.label)}${n.tag && n.tag !== n.label ? ' · ' + esc(n.tag) : ''}</em></span>
        ${ico('chevron_right')}
      </button>

      ${server && server.signIn ? `<div class="dep-note warn">${ico('lock')}<span>Sign in to get your Trending deposit address, or use one of your own below.</span></div>` : ''}
      ${!chosen ? noAddressHTML(a, n, mine) : addrCardHTML(a, n, chosen, mine, server)}`;
  }

  function pickAddress(mine) {
    const all = mine.exact.concat(mine.evm);
    if (!all.length) return null;
    const hit = all.find(x => x.id === V.addrId);
    if (hit) return hit;
    V.addrId = all[0].id;
    return all[0];
  }

  function noAddressHTML(a, n, mine) {
    return `
      <div class="dep-empty tall">
        ${ico('account_balance_wallet', 'dep-empty-i')}
        <b>Where should ${esc(a.symbol)} land?</b>
        <p>A deposit goes to a wallet you control, so Trending needs the address you want to receive at on ${esc(n.label)}. It never makes one up — coins sent to an address nobody holds the key to are gone.</p>
      </div>
      ${typeof WAD !== 'undefined' && WAD.connectWallet ? `<button type="button" class="dep-btn primary" data-dep="connect">${ico('link')}Connect a wallet</button>` : ''}
      <label class="dep-field"><span>Or paste your ${esc(n.label)} address</span>
        <input type="text" data-depf="paste" placeholder="${esc(n.family === 'bitcoin' ? 'bc1…' : n.family === 'evm' ? '0x…' : n.family === 'xrpl' ? 'r…' : 'Your address')}" autocomplete="off" spellcheck="false">
      </label>
      <button type="button" class="dep-btn" data-dep="savepaste">${ico('add')}Use this address</button>
      <div class="dep-note">${ico('shield')}<span>Paste a receiving address only. Never a recovery phrase or a private key — no app should ask you for one, and this one refuses them.</span></div>`;
  }

  function addrCardHTML(a, n, chosen, mine, server) {
    const uri = uriFor(n, chosen.address);
    const held = chosen.source === 'trending';
    const cross = !held && mine.exact.indexOf(chosen) === -1;
    const list = held ? [] : mine.exact.concat(mine.evm);
    return `
      ${list.length > 1 ? `<div class="dep-chips wrap">${list.map(x => `<button type="button" class="dep-chip${x.id === chosen.id ? ' on' : ''}" data-dep="addr" data-v="${esc(x.id)}">${esc(x.label || 'Wallet')}<i>${esc(short(x.address))}</i></button>`).join('')}</div>` : ''}

      <div class="dep-card">
        <div class="dep-qr">${qrHTML(uri, a.symbol)}</div>
        <span class="dep-qr-l">${esc(a.symbol)} · ${esc(n.label)}</span>

        <div class="dep-addr">
          <code id="dep-addr-text">${esc(chosen.address)}</code>
          <button type="button" class="dep-ib" data-dep="copy" data-v="addr" aria-label="Copy address">${ico('content_copy')}</button>
        </div>
        <span class="dep-addr-src">${ico(held ? 'verified_user' : chosen.source === 'connected' ? 'link' : 'bookmark')}${esc(chosen.label || 'Your wallet')}${
          held ? ' · held by Trending' : chosen.source === 'connected' ? ' · connected wallet' : ' · saved by you'}</span>

        ${n.tagField ? `<div class="dep-tag">
          <label class="dep-field"><span>${esc(n.tagField.name)}</span>
            <input type="text" data-depf="tag" value="${esc(V.tag)}" placeholder="Leave empty unless asked" inputmode="numeric" autocomplete="off">
          </label>
          <p class="dep-tag-h">${esc(n.tagField.hint)}</p>
        </div>` : ''}

        <div class="dep-acts">
          <button type="button" class="dep-btn" data-dep="copy" data-v="addr">${ico('content_copy')}Copy address</button>
          <button type="button" class="dep-btn" data-dep="share">${ico('ios_share')}Share</button>
        </div>
      </div>

      <div class="dep-warn hard">${ico('warning')}<span><b>Only send ${esc(a.symbol)} over ${esc(n.label)} to this address</b>
        ${a.token
          ? `${esc(a.symbol)} is a token on ${esc(n.label)}. Check the token and the network in the app you send from — Trending does not publish contract addresses, because one wrong character costs you the transfer.`
          : `Anything sent over a different network will not arrive and cannot be recovered.`}
        ${cross ? ` This address was saved for another EVM chain. It is the same address on ${esc(n.label)}, but only use it if your wallet app supports ${esc(n.label)} too — a smart-contract wallet may not exist there.` : ''}</span></div>

      ${n.note ? `<div class="dep-note">${ico('info')}<span>${esc(n.note)}</span></div>` : ''}

      <details class="dep-more">
        <summary>More details${ico('expand_more')}</summary>
        <dl class="dep-kv">
          <div><dt>Asset</dt><dd>${esc(a.symbol)} · ${esc(a.name)}</dd></div>
          <div><dt>Network</dt><dd>${esc(n.label)} (${esc(n.tag)})</dd></div>
          <div><dt>Address</dt><dd class="mono">${esc(chosen.address)}</dd></div>
          ${n.tagField ? `<div><dt>${esc(n.tagField.name)}</dt><dd>${V.tag ? esc(V.tag) : 'None'}</dd></div>` : ''}
          <div><dt>Minimum</dt><dd>None from Trending — the sender sets one</dd></div>
          <div><dt>Settlement</dt><dd>${esc(n.finality)}</dd></div>
          <div><dt>Deposit status</dt><dd>${n.status === 'open' ? 'Open' : esc(n.status)}</dd></div>
          ${a.token ? `<div><dt>Token contract</dt><dd>Verify it in the sending app — not published here</dd></div>` : ''}
          <div><dt>Wallet</dt><dd>Your own ${chosen.source === 'connected' ? 'connected' : 'saved'} wallet — Trending holds no key</dd></div>
          <div><dt>Config version</dt><dd>${esc((read(CKEY) || {}).version || 'live')}</dd></div>
        </dl>
      </details>

      ${held
        ? `<div class="dep-note">${ico('schedule')}<span>Trending watches this address and credits your balance after ${server && server.confirmationsRequired ? esc(server.confirmationsRequired) + ' confirmations' : 'the network confirms it'}. The deposit appears in your activity as soon as it is seen on chain.</span></div>
           <button type="button" class="dep-btn wide" data-dep="activity">${ico('history')}See deposit activity</button>`
        : `<button type="button" class="dep-btn primary wide" data-dep="track">${ico('notifications_active')}I'm sending — keep a record</button>
           <div class="dep-note">${ico('travel_explore')}<span>This address is your own wallet, so Trending has nothing to credit and does not watch the chain. Your wallet and the block explorer are the record — a record here keeps the details and the explorer link in one place.</span></div>`}`;
  }

  const short = a => String(a).length > 16 ? String(a).slice(0, 7) + '…' + String(a).slice(-5) : String(a);
  function qrHTML(text, sym) {
    if (typeof QRGEN === 'undefined') return `<div class="dep-qr-off">${ico('qr_code_2')}<span>QR codes are unavailable right now — copy the address instead.</span></div>`;
    try { return QRGEN.svg(QRGEN.make(String(text)), 208, String(sym || '').slice(0, 1)); }
    catch (e) { return `<div class="dep-qr-off">${ico('qr_code_2')}<span>This address is too long to draw as a code — copy it instead.</span></div>`; }
  }

  /* ── 5 · Activity ────────────────────────────────────────────────── */
  function activityHTML() {
    const list = records();
    if (!list.length) return `<div class="dep-empty tall">${ico('inbox', 'dep-empty-i')}<b>No deposits recorded</b>
      <p>When you send coins to one of your addresses, keep a record here so the network, the address and the explorer link stay together.</p>
      <button type="button" class="dep-btn primary" data-dep="method">${ico('add')}Start a deposit</button></div>`;
    return list.map(r => {
      const n = (NETS[r.asset] && netOf(r.asset, r.net)) || null;
      const [label, cls] = STATUS[r.status] || STATUS.waiting;
      return `<div class="dep-rec">
        <div class="dep-rec-h">
          <b>${esc(r.asset)}</b><span class="dep-pill ${cls}">${esc(label)}</span>
        </div>
        <div class="dep-rec-m">${esc(r.netLabel || (n ? n.label : r.net))}${r.amount ? ' · ' + esc(r.amount) + ' ' + esc(r.asset) : ''}</div>
        <code>${esc(short(r.address))}</code>
        ${r.txid ? `<code class="tx">${esc(short(r.txid))}</code>` : ''}
        <div class="dep-rec-t">${esc(new Date(r.at).toLocaleString())}</div>
        <div class="dep-rec-a">
          ${r.txid ? `<button type="button" class="dep-btn sm" data-dep="explorer" data-v="${esc(r.id)}">${ico('open_in_new')}Explorer</button>`
            : `<button type="button" class="dep-btn sm" data-dep="addtx" data-v="${esc(r.id)}">${ico('tag')}Add transaction ID</button>`}
          ${r.status !== 'arrived' ? `<button type="button" class="dep-btn sm" data-dep="arrived" data-v="${esc(r.id)}">${ico('check')}Mark arrived</button>` : ''}
          ${typeof CFI !== 'undefined' && CFI.push ? `<button type="button" class="dep-btn sm" data-dep="tochat" data-v="${esc(r.id)}">${ico('forum')}Post to chat</button>` : ''}
          <button type="button" class="dep-btn sm danger" data-dep="drop" data-v="${esc(r.id)}">${ico('delete')}</button>
        </div>
      </div>`;
    }).join('') + `<div class="dep-note">${ico('info')}<span>These are your own notes. Trending does not check the chain, so a status here means what you told it — the explorer is the truth.</span></div>`;
  }

  /* ── Shared bits ─────────────────────────────────────────────────── */
  const skeleton = n => `<div class="dep-skel">${Array.from({ length: n }, () => '<span></span>').join('')}</div>`;
  const errHTML = (msg, retry) => `<div class="dep-empty tall">${ico('cloud_off', 'dep-empty-i')}<b>Could not load this</b>
    <p>${esc(msg)}</p>
    <button type="button" class="dep-btn primary" data-dep="${retry === 'nets' ? 'renets' : 'reload'}">${ico('refresh')}Try again</button></div>`;

  /* ── Actions ─────────────────────────────────────────────────────── */
  async function act(what, v, el) {
    if (!V) return;
    switch (what) {
      case 'close': close(); return;
      case 'back': back(); return;
      case 'activity': go('activity'); return;
      case 'method':
        if (v === 'p2p') { close(); if (typeof P2P !== 'undefined' && P2P.setSide) P2P.setSide('buy'); navigateTo('p2p'); return; }
        if (v === 'payid') { close(); if (typeof PAY !== 'undefined' && PAY.openMyQR) PAY.openMyQR(); return; }
        go('asset'); ensureAssets(); return;
      case 'reload': V.err = ''; paint(); ensureAssets(true); return;
      case 'renets': V.err = ''; paint(); ensureNets(V.sym, true); return;
      case 'clearrecent': clearRecent(); return;
      case 'asset': pushRecent(v); go('network', { sym: v }); ensureNets(v); return;
      case 'net':
        go('address', { net: v, addrId: '', tag: '' });
        askAddress(V.sym, v).then(() => { if (V && V.screen === 'address') paint(); });
        return;
      case 'netoff': toast('Deposits on that network are paused right now.'); return;
      case 'addr': V.addrId = v; paint(); return;
      case 'connect': connect(); return;
      case 'savepaste': savePaste(); return;
      case 'copy': copy(v); return;
      case 'share': share(); return;
      case 'track': track(); return;
      case 'addtx': addTx(v); return;
      case 'arrived': markArrived(v); return;
      case 'explorer': openExplorer(v); return;
      case 'tochat': toChat(v); return;
      case 'drop': drop(v); return;
    }
  }

  async function ensureAssets(force) {
    try { await loadAssets(force); V.err = ''; }
    catch (e) { V.err = e.message || 'The server did not answer.'; }
    if (V && V.screen === 'asset') paint();
  }
  async function ensureNets(sym, force) {
    try { await loadNets(sym, force); V.err = ''; }
    catch (e) { V.err = e.code === 'unsupported_asset' ? `Trending does not list ${sym} for deposit yet.` : (e.message || 'The server did not answer.'); }
    if (V && V.screen === 'network') paint();
  }

  function connect() {
    if (typeof WAD === 'undefined' || !WAD.connectWallet) { toast('Wallet connect is unavailable right now.'); return; }
    Promise.resolve(WAD.connectWallet()).then(() => { if (V) paint(); }).catch(() => {});
  }

  function savePaste() {
    const input = document.querySelector('#dep-sheet [data-depf="paste"]');
    const n = netOf(V.sym, V.net);
    if (!input || !n) return;
    const addr = String(input.value || '').trim();
    const v = checkAddress(n.key, n.family, addr);
    if (!v.ok) { toast(v.msg || 'That address does not look right.'); return; }
    if (typeof WAD !== 'undefined' && WAD.addOwn && WAD.NETS && WAD.NETS[n.key]) {
      const r = WAD.addOwn(n.key, addr, n.label + ' wallet');
      if (!r.ok) { toast(r.msg || 'That address could not be saved.'); return; }
      V.addrId = r.id;
    } else {
      // A network WAD does not keep (XRP Ledger today) is held for this
      // session only, so nothing half-supported is written to storage.
      V.extra = { id: 'x_' + n.key, net: n.key, address: addr, label: n.label + ' wallet', source: 'added', simulated: false };
      V.addrId = V.extra.id;
    }
    toast(v.warn || 'Address saved');
    paint();
  }

  function copy(which) {
    const n = netOf(V.sym, V.net);
    const chosen = pickAddress(myAddresses(n.key, n.family));
    const text = which === 'tag' ? V.tag : (chosen ? chosen.address : '');
    if (!text) return;
    const done = () => toast(which === 'tag' ? 'Tag copied' : 'Address copied');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => toast(text));
    else { toast(text); }
  }

  function share() {
    const a = assetOf(V.sym), n = netOf(V.sym, V.net);
    const chosen = pickAddress(myAddresses(n.key, n.family));
    if (!chosen) return;
    const text = `My ${a.symbol} address on ${n.label} (${n.tag}):\n${chosen.address}` +
      (V.tag ? `\n${n.tagField.name}: ${V.tag}` : '') +
      `\n\nOnly send ${a.symbol} over ${n.label} to this address.`;
    if (navigator.share) {
      navigator.share({ title: `Deposit ${a.symbol}`, text }).catch(() => {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Deposit details copied'), () => toast(text));
      return;
    }
    toast(text);
  }

  function track() {
    const a = assetOf(V.sym), n = netOf(V.sym, V.net);
    const chosen = pickAddress(myAddresses(n.key, n.family));
    if (!chosen) return;
    if (n.tagField && n.tagField.required && !V.tag) { toast(`${n.tagField.name} is required on ${n.label}.`); return; }
    const rec = saveRecord({
      id: uid('dep_'), asset: a.symbol, net: n.key, netLabel: n.label, address: chosen.address,
      tag: V.tag || '', at: Date.now(), status: 'waiting', txid: '', amount: '',
      explorerTx: n.explorer || '', explorerAddr: n.addressExplorer || ''
    });
    V.recId = rec.id;
    go('activity');
    toast('Record kept — add the transaction ID once you have sent it');
  }

  async function addTx(id) {
    const r = recordOf(id);
    if (!r || typeof appPrompt !== 'function') return;
    const v = await appPrompt('Paste the transaction ID from the app you sent from.', r.txid || '', { title: 'Transaction ID', ok: 'Save' });
    if (v == null) return;
    const tx = String(v).trim().replace(/^0x/i, m => m).slice(0, 120);
    if (!tx) return;
    r.txid = tx;
    r.status = 'sent';
    saveRecord(r);
    paint();
    toast('Saved — open the explorer to see its confirmations');
  }

  async function markArrived(id) {
    const r = recordOf(id);
    if (!r) return;
    if (typeof appConfirm === 'function') {
      const ok = await appConfirm('Mark this as arrived in your wallet? Trending cannot check the chain, so this records what you saw.', { title: 'Arrived?', ok: 'It arrived' });
      if (!ok) return;
    }
    r.status = 'arrived';
    saveRecord(r);
    paint();
  }

  function openExplorer(id) {
    const r = recordOf(id);
    if (!r || !r.txid) return;
    const base = r.explorerTx || '';
    if (!base) { toast('No explorer is configured for that network.'); return; }
    window.open(base + encodeURIComponent(r.txid), '_blank', 'noopener,noreferrer');
  }

  async function drop(id) {
    if (typeof appConfirm === 'function') {
      const ok = await appConfirm('Remove this deposit record? The transfer itself is on the blockchain and is not affected.', { ok: 'Remove', danger: true });
      if (!ok) return;
    }
    dropRecord(id);
    paint();
  }

  /* ── Crypto Chat ─────────────────────────────────────────────────── */
  /* A deposit record can be posted into a chat as a card. It is a record,
     not a receipt: the card says who vouched for it. */
  const KINDS = { depnote: 1 };

  function toChat(id) {
    const r = recordOf(id);
    if (!r) return;
    const chatId = activeChat();
    if (!chatId) { toast('Open a chat first, then post the record into it.'); return; }
    if (typeof CFI === 'undefined' || !CFI.push) { toast('Chat is still loading — try again in a second.'); return; }
    CFI.push(chatId, { kind: 'depnote', me: true, rid: r.id });
    close();
    toast('Posted to the chat');
  }
  function activeChat() {
    try {
      if (typeof S !== 'undefined' && S.activeChat) return S.activeChat;
      if (typeof MSG !== 'undefined' && MSG.state && MSG.state.chatId) return MSG.state.chatId;
    } catch (e) {}
    return null;
  }

  function cardHTML(fi) {
    const r = recordOf(fi && fi.rid);
    if (!r) return `<div class="cfi-card dep-card"><div class="cfi-sub">This deposit record was removed.</div></div>`;
    const [label, cls] = STATUS[r.status] || STATUS.waiting;
    return `<div class="cfi-card dep-card">
      <div class="cfi-head">${ico('south_west', 'ms-16 tc-green')}<span class="cfi-label">Incoming deposit</span></div>
      <div class="cfi-amt"><span>${esc(r.amount ? r.amount + ' ' : '')}${esc(r.asset)}</span></div>
      <div class="cfi-sub">${esc(r.netLabel || r.net)} · to your own wallet</div>
      <div class="cfi-foot"><span class="cfi-pill ${cls === 'ok' ? 'ok' : 'wait'}">${esc(label)}</span>
        ${r.txid ? `<button class="btn btn-sm btn-ghost" onclick="DEP.openRecord('${esc(r.id)}')">Details</button>` : ''}</div>
      <div class="dep-card-mini">A record you kept — Trending does not confirm blockchain transfers.</div>
    </div>`;
  }
  const previewOf = () => 'Deposit record';
  function openRecord(id) { open('activity'); V.recId = id; paint(); }

  /* Straight to one coin's networks, from a screen that already knows
     which coin (Receive in chat or Pay, say). */
  function openFor(sym) {
    const s = String(sym || '').toUpperCase();
    open('asset');
    loadAssets().then(() => {
      if (!V) return;
      if (assetOf(s)) act('asset', s); else paint();
    }).catch(() => { if (V) paint(); });
  }

  /* CFI hands unknown kinds down a chain; wrapping keeps every existing
     card exactly where it was. */
  function installCards() {
    if (typeof CFI !== 'undefined' && CFI.cardHTML && !CFI.cardHTML.__dep) {
      const prev = CFI.cardHTML;
      const next = fi => (fi && KINDS[fi.kind] ? cardHTML(fi) : prev(fi));
      next.__dep = true;
      CFI.cardHTML = next;
    }
    if (typeof PAY !== 'undefined' && PAY.previewOf && !PAY.previewOf.__dep) {
      const prev = PAY.previewOf;
      const next = fi => (fi && KINDS[fi.kind] ? previewOf(fi) : prev(fi));
      next.__dep = true;
      PAY.previewOf = next;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installCards);
  else setTimeout(installCards, 0);

  return {
    open, openFor, close, act, back, cardHTML, previewOf, openRecord, records, clearRecent,
    loadAssets, loadNets,
    get state() { return V; }
  };
})();

window.DEP = DEP;

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
publish('features/deposit.js', {
  DEP: () => DEP
});
