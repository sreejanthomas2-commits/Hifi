/* ╔══════════════════════════════════════════════════════════════════╗
   ║  WALLET CONNECT / CREATE                                         ║
   ║                                                                  ║
   ║  Connect an existing browser wallet (MetaMask, Phantom, Coinbase)║
   ║  or generate a demo wallet for the prototype.                    ║
   ║                                                                  ║
   ║  Connecting uses the provider's own permission prompt and only   ║
   ║  ever reads the public address — this app never sees a key.      ║
   ║                                                                  ║
   ║  There is deliberately NO "import by recovery phrase" flow. A    ║
   ║  page asking for your seed phrase is indistinguishable from a    ║
   ║  phishing page, and a real wallet never needs one to connect.    ║
   ║                                                                  ║
   ║  Created wallets are SIMULATED — an address generated locally    ║
   ║  for this prototype. They hold nothing and control nothing.      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const WL = (() => {

  const KEY = 'ts_wallet';

  /* Official brand marks, served from the web3icons source tree on jsDelivr.
     `slug` is the file name; `dir` is which folder it lives in — a few
     wallets run by exchanges only have a logo under exchanges/. */
  const LOGO_BASE = 'https://cdn.jsdelivr.net/gh/0xa3k5/web3icons@main/packages/core/src/svgs';
  const logoUrl = p => p.slug ? `${LOGO_BASE}/${p.dir || 'wallets'}/branded/${p.slug}.svg` : '';

  /* `popular` controls what shows before you expand the full list. */
  const PROVIDERS = {
    metamask:      { label: 'MetaMask',        slug: 'metamask',        color: '#F6851B', chain: 'Ethereum',    popular: true },
    phantom:       { label: 'Phantom',         slug: 'phantom',         color: '#AB9FF2', chain: 'Solana',      popular: true },
    coinbase:      { label: 'Coinbase Wallet', slug: 'coinbase',        color: '#0052FF', chain: 'Ethereum',    popular: true },
    walletconnect: { label: 'WalletConnect',   slug: 'wallet-connect',  color: '#3B99FC', chain: 'Multi-chain', popular: true },
    bitget:        { label: 'Bitget Wallet',   slug: 'bitget',  dir: 'exchanges', color: '#00F0FF', chain: 'Multi-chain', popular: true },
    trust:         { label: 'Trust Wallet',    slug: 'trust',           color: '#3375BB', chain: 'Multi-chain', popular: true },
    okx:           { label: 'OKX Wallet',      slug: 'okx',             color: '#000000', chain: 'Multi-chain', popular: true },
    binance:       { label: 'Binance Web3',    slug: 'binance', dir: 'exchanges', color: '#F0B90B', chain: 'BNB Chain',   popular: true },

    bybit:         { label: 'Bybit Wallet',    slug: 'bybit',   dir: 'exchanges', color: '#F7A600', chain: 'Multi-chain' },
    rainbow:       { label: 'Rainbow',         slug: 'rainbow',         color: '#001E59', chain: 'Ethereum' },
    rabby:         { label: 'Rabby',           slug: 'rabby',           color: '#7084FF', chain: 'Multi-chain' },
    zerion:        { label: 'Zerion',          slug: 'zerion',          color: '#2962EF', chain: 'Multi-chain' },
    ledger:        { label: 'Ledger',          slug: 'ledger',          color: '#000000', chain: 'Hardware' },
    trezor:        { label: 'Trezor',          slug: 'trezor',          color: '#00854D', chain: 'Hardware' },
    safe:          { label: 'Safe',            slug: 'safe',            color: '#12FF80', chain: 'Multi-sig' },
    argent:        { label: 'Argent',          slug: 'argent',          color: '#FF875B', chain: 'Starknet' },
    exodus:        { label: 'Exodus',          slug: 'exodus',          color: '#8952FF', chain: 'Multi-chain' },
    backpack:      { label: 'Backpack',        slug: 'backpack',        color: '#E33E3F', chain: 'Solana' },
    solflare:      { label: 'Solflare',        slug: 'solflare',        color: '#FC7227', chain: 'Solana' },
    keplr:         { label: 'Keplr',           slug: 'keplr',           color: '#1B1D28', chain: 'Cosmos' },
    ronin:         { label: 'Ronin',           slug: 'ronin',           color: '#1273EA', chain: 'Ronin' },
    imtoken:       { label: 'imToken',         slug: 'imtoken',         color: '#11C4D1', chain: 'Multi-chain' },
    tokenpocket:   { label: 'TokenPocket',     slug: 'token-pocket',    color: '#2980FE', chain: 'Multi-chain' },
    xdefi:         { label: 'Ctrl (XDEFI)',    slug: 'xdefi',           color: '#2761E7', chain: 'Multi-chain' },
    coin98:        { label: 'Coin98',          slug: 'coin98',          color: '#D8AB4C', chain: 'Multi-chain' },
    enkrypt:       { label: 'Enkrypt',         slug: 'enkrypt',         color: '#3C43F1', chain: 'Multi-chain' },
    zengo:         { label: 'ZenGo',           slug: 'zengo',           color: '#4C6FFF', chain: 'Keyless' },
    sequence:      { label: 'Sequence',        slug: 'sequence',        color: '#4F45E4', chain: 'Multi-chain' },
    kraken:        { label: 'Kraken Wallet',   slug: 'kraken',          color: '#7132F5', chain: 'Multi-chain' },
    atomic:        { label: 'Atomic Wallet',   slug: 'atomic',          color: '#2B44FF', chain: 'Multi-chain' },
    bitbox:        { label: 'BitBox',          slug: 'bitbox',          color: '#5E94E4', chain: 'Hardware' },
    mew:           { label: 'MyEtherWallet',   slug: 'my-ether-wallet', color: '#1896A4', chain: 'Ethereum' },
    daimo:         { label: 'Daimo',           slug: 'daimo',           color: '#007AFF', chain: 'Base' },

    demo:          { label: 'Demo Wallet',     slug: null, emoji: '🧪', color: '#7C4DFF', chain: 'Simulated', popular: true }
  };

  /* Supported networks. `family` decides how we talk to an account:
     EVM chains share eth_* RPC, Solana has its own provider shape. */
  const NETWORKS = {
    ethereum: { label: 'Ethereum',  symbol: 'ETH', color: '#627EEA', chainId: '0x1',    family: 'evm' },
    base:     { label: 'Base',      symbol: 'ETH', color: '#0052FF', chainId: '0x2105', family: 'evm' },
    arbitrum: { label: 'Arbitrum',  symbol: 'ETH', color: '#12AAFF', chainId: '0xa4b1', family: 'evm' },
    optimism: { label: 'Optimism',  symbol: 'ETH', color: '#FF0420', chainId: '0xa',    family: 'evm' },
    polygon:  { label: 'Polygon',   symbol: 'POL', color: '#8247E5', chainId: '0x89',   family: 'evm' },
    bnb:      { label: 'BNB Chain', symbol: 'BNB', color: '#F0B90B', chainId: '0x38',   family: 'evm' },
    solana:   { label: 'Solana',    symbol: 'SOL', color: '#14F195', family: 'solana' },
    cosmos:   { label: 'Cosmos',    symbol: 'ATOM', color: '#2E3148', family: 'cosmos' },
    simulated:{ label: 'Simulated', symbol: 'ETH', color: '#7C4DFF', family: 'demo' }
  };

  const netByChainId = id => Object.keys(NETWORKS).find(k => NETWORKS[k].chainId === id);

  /* accounts[] — one SocialFi profile, many wallets across many chains. */
  const DEFAULT = { accounts: [], created: null, primary: null };
  let W = load();

  /* Older single-wallet state is migrated rather than dropped. */
  if (W.connected && !W.accounts.length) {
    W.accounts = [{ ...W.connected, id: 'w0', net: W.connected.simulated ? 'simulated' : 'ethereum' }];
    W.primary = 'w0';
    delete W.connected;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(W)); } catch (e) {} }

  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));

  /* ── Provider detection ─────────────────────────────────────────── */
  /* Each wallet injects its own marker. These resolvers return the object
     to talk to, or null — nothing is *requested* until the user picks one,
     so simply opening the sheet triggers no wallet prompts. */
  const RESOLVERS = {
    metamask:    () => evm(p => p.isMetaMask && !p.isBraveWallet),
    coinbase:    () => evm(p => p.isCoinbaseWallet) || window.coinbaseWalletExtension || null,
    trust:       () => evm(p => p.isTrust || p.isTrustWallet) || (window.trustwallet || null),
    okx:         () => window.okxwallet || window.okexchain || null,
    bitget:      () => (window.bitkeep && window.bitkeep.ethereum) || window.bitget || null,
    binance:     () => window.BinanceChain || null,
    bybit:       () => (window.bybitWallet) || null,
    rabby:       () => evm(p => p.isRabby),
    zerion:      () => evm(p => p.isZerion),
    rainbow:     () => evm(p => p.isRainbow),
    imtoken:     () => evm(p => p.isImToken),
    tokenpocket: () => evm(p => p.isTokenPocket),
    enkrypt:     () => evm(p => p.isEnkrypt),
    xdefi:       () => (window.xfi && window.xfi.ethereum) || null,
    coin98:      () => (window.coin98 && window.coin98.provider) || null,
    exodus:      () => (window.exodus && window.exodus.ethereum) || null,
    ronin:       () => (window.ronin && window.ronin.provider) || null,

    // Non-EVM
    phantom:     () => (window.phantom && window.phantom.solana) || (window.solana && window.solana.isPhantom ? window.solana : null),
    solflare:    () => window.solflare || null,
    backpack:    () => window.backpack || null,
    keplr:       () => window.keplr || null,

    demo:        () => true
  };

  const SOLANA_KEYS = ['phantom', 'solflare', 'backpack'];

  /* window.ethereum may be a single provider or a multiplexed list. */
  function evm(test) {
    const eth = window.ethereum;
    if (!eth) return null;
    if (Array.isArray(eth.providers)) {
      const hit = eth.providers.find(test);
      if (hit) return hit;
    }
    return test(eth) ? eth : null;
  }

  function detect() {
    const out = {};
    Object.keys(PROVIDERS).forEach(k => {
      const r = RESOLVERS[k];
      try { out[k] = k === 'demo' ? true : !!(r && r()); }
      catch (e) { out[k] = false; }
    });
    // WalletConnect is a protocol, not an injected extension — it needs the
    // WC SDK and a project id, which this prototype doesn't ship.
    out.walletconnect = false;
    return out;
  }

  const available = () => Object.entries(detect()).filter(([, v]) => v).map(([k]) => k);

  /* ── Connect ────────────────────────────────────────────────────── */
  async function connect(key) {
    const p = PROVIDERS[key];
    if (!p) return { ok: false, msg: 'Unknown wallet.' };

    if (key === 'demo') return connectDemo();

    const found = detect();
    if (!found[key]) {
      return { ok: false, msg: `${p.label} isn’t installed in this browser.`, missing: true };
    }

    try {
      let address, chain = p.chain, rawChainId = null;
      const provider = RESOLVERS[key] ? RESOLVERS[key]() : null;
      if (!provider) throw new Error('Provider went away');

      if (key === 'keplr') {
        // Keplr needs a chain id up front; Cosmos hub is the safe default.
        await provider.enable('cosmoshub-4');
        const signer = provider.getOfflineSigner('cosmoshub-4');
        const accts = await signer.getAccounts();
        address = accts[0].address;

      } else if (SOLANA_KEYS.includes(key)) {
        // Solana wallets return the public key; no signing, no key material.
        const res = await provider.connect();
        address = (res && res.publicKey ? res.publicKey : provider.publicKey).toString();

      } else {
        // eth_requestAccounts opens the wallet's own approval prompt.
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        if (!accounts || !accounts.length) throw new Error('No account returned');
        address = accounts[0];
        try {
          rawChainId = await provider.request({ method: 'eth_chainId' });
          chain = chainName(rawChainId);
        } catch (e) { /* chain id is a nicety, not required */ }
      }

      const net = SOLANA_KEYS.includes(key) ? 'solana'
        : key === 'keplr' ? 'cosmos'
        : (netByChainId(rawChainId) || 'ethereum');

      return addAccount({ provider: key, address, chain, net, simulated: false });

    } catch (err) {
      // Code 4001 is the user declining in the wallet — not an error state.
      const declined = err && (err.code === 4001 || /reject|denied/i.test(err.message || ''));
      return { ok: false, msg: declined ? 'Connection cancelled in your wallet.' : `Could not connect: ${err.message || err}` };
    }
  }

  function connectDemo(net) {
    const n = NETWORKS[net] ? net : 'simulated';
    const address = n === 'solana' ? randomAddress('', 44) : randomAddress('0x', 40);
    return addAccount({ provider: 'demo', address, chain: NETWORKS[n].label, net: n, simulated: true });
  }

  /* Adds a wallet to the profile rather than replacing the previous one —
     the whole point of multi-chain is holding several at once. */
  function addAccount(a) {
    const dupe = W.accounts.find(x => x.address.toLowerCase() === a.address.toLowerCase() && x.net === a.net);
    if (dupe) {
      toast(`${PROVIDERS[a.provider].label} is already connected on ${NETWORKS[a.net].label}.`);
      return { ok: true, address: a.address, duplicate: true };
    }
    const acct = { id: 'w' + Date.now() + Math.floor(Math.random() * 1000), at: Date.now(), native: null, ...a };
    W.accounts.push(acct);
    if (!W.primary) W.primary = acct.id;
    save();
    applyToProfile();
    refreshBalance(acct.id);
    toast(`${PROVIDERS[a.provider].label} connected on ${NETWORKS[a.net].label} · ${shortAddr(a.address)}`);
    return { ok: true, address: a.address, id: acct.id };
  }

  function chainName(hexId) {
    return ({
      '0x1': 'Ethereum', '0x89': 'Polygon', '0x2105': 'Base',
      '0xa4b1': 'Arbitrum', '0x38': 'BNB Chain', '0xa': 'Optimism'
    })[hexId] || `Chain ${parseInt(hexId, 16)}`;
  }

  function disconnect(id) {
    if (!id) return disconnectAll();
    const i = W.accounts.findIndex(a => a.id === id);
    if (i < 0) return;
    const [gone] = W.accounts.splice(i, 1);
    if (W.primary === id) W.primary = W.accounts.length ? W.accounts[0].id : null;
    save();
    applyToProfile();
    toast(`Disconnected ${PROVIDERS[gone.provider].label} on ${NETWORKS[gone.net].label}`);
  }

  function disconnectAll() {
    W.accounts = [];
    W.primary = null;
    save();
    applyToProfile();
    toast('All wallets disconnected');
  }

  function setPrimary(id) {
    if (!W.accounts.some(a => a.id === id)) return;
    W.primary = id;
    save();
    applyToProfile();
    toast('Primary wallet updated');
  }

  /* ── Native balances ────────────────────────────────────────────── */
  /* For a real EVM wallet this is a genuine on-chain read through the
     wallet's own RPC — no API key, no server. Demo accounts get a stable
     pseudo-balance derived from their address so the UI has something
     consistent to show. */
  async function refreshBalance(id) {
    const a = W.accounts.find(x => x.id === id);
    if (!a) return;
    const net = NETWORKS[a.net];

    if (a.simulated) {
      let h = 0;
      for (let i = 0; i < a.address.length; i++) h = (h * 31 + a.address.charCodeAt(i)) % 100000;
      a.native = { symbol: net.symbol, amount: +((h % 5000) / 1000 + 0.05).toFixed(4), simulated: true };
      save(); applyToProfile();
      return;
    }

    try {
      if (net.family === 'evm') {
        const provider = RESOLVERS[a.provider] ? RESOLVERS[a.provider]() : null;
        if (!provider) return;
        const wei = await provider.request({ method: 'eth_getBalance', params: [a.address, 'latest'] });
        a.native = { symbol: net.symbol, amount: +(parseInt(wei, 16) / 1e18).toFixed(6), simulated: false };
        save(); applyToProfile();
      }
      // Solana/Cosmos balances need an RPC endpoint the wallet doesn't expose
      // for reads, so they stay unlabelled rather than being faked.
    } catch (e) { /* leave the balance blank rather than guessing */ }
  }

  function refreshAll() { W.accounts.forEach(a => refreshBalance(a.id)); }

  /* Ask the wallet to move to another EVM chain — its own prompt, not ours. */
  async function switchNetwork(id, netKey) {
    const a = W.accounts.find(x => x.id === id);
    const net = NETWORKS[netKey];
    if (!a || !net || net.family !== 'evm') return;
    if (a.simulated) {
      a.net = netKey; a.chain = net.label;
      save(); refreshBalance(id); applyToProfile();
      toast(`Switched to ${net.label}`);
      return;
    }
    try {
      const provider = RESOLVERS[a.provider] ? RESOLVERS[a.provider]() : null;
      if (!provider) return;
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: net.chainId }] });
      a.net = netKey; a.chain = net.label;
      save(); refreshBalance(id); applyToProfile();
      toast(`Switched to ${net.label}`);
    } catch (e) {
      toast(e && e.code === 4902 ? `${net.label} isn’t added to your wallet yet.` : 'Network switch cancelled.');
    }
  }

  /* Assets grouped by chain — what "one place" actually means. */
  function byNetwork() {
    const map = {};
    W.accounts.forEach(a => {
      if (!map[a.net]) map[a.net] = { net: a.net, ...NETWORKS[a.net], accounts: [], native: 0 };
      map[a.net].accounts.push(a);
      if (a.native) map[a.net].native += a.native.amount;
    });
    return Object.values(map);
  }

  /* ── Create (simulated) ─────────────────────────────────────────── */
  /* Uses crypto.getRandomValues so the address at least looks the part.
     It is still only an identifier for this prototype. */
  function randomAddress(prefix, hexChars) {
    const bytes = new Uint8Array(hexChars / 2);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return prefix + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function createWallet(label, net) {
    const n = NETWORKS[net] ? net : 'simulated';
    const address = n === 'solana' ? randomAddress('', 44) : randomAddress('0x', 40);
    W.created = { address, label: String(label || 'My Trending Wallet').trim(), at: Date.now(), simulated: true };
    const r = addAccount({ provider: 'demo', address, chain: NETWORKS[n].label, net: n, simulated: true });
    return { ok: true, address, id: r.id };
  }

  /* ── Shared helpers ─────────────────────────────────────────────── */
  const isConnected = () => W.accounts.length > 0;
  const accounts = () => W.accounts;
  const account = () => W.accounts.find(a => a.id === W.primary) || W.accounts[0] || null;

  function shortAddr(a) {
    const s = String(a || '');
    return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
  }

  /* The wallet address shown on the Profile pane follows the connection. */
  function applyToProfile() {
    const primary = account();
    if (typeof DATA !== 'undefined' && DATA.wallet) {
      DATA.wallet.address = primary ? shortAddr(primary.address) : '0x8A9F…2C11';
    }
    if (typeof TR !== 'undefined' && document.getElementById('pf-root')) TR.paintPortfolio();
    paintProfileCard();
    if (typeof renderProfile === 'function' && S.pane === 'profile') {
      try { renderProfile('wallet'); } catch (e) {}
    }
  }

  function copyAddress(id) {
    const acct = id ? W.accounts.find(x => x.id === id) : account();
    if (!acct) return;
    const a = acct.address;
    if (navigator.clipboard) navigator.clipboard.writeText(a).then(() => toast('Address copied'), () => toast(a));
    else toast(a);
  }

  /* ── Icon ───────────────────────────────────────────────────────── */
  /* Real brand mark, with a tinted monogram underneath so a blocked or
     slow CDN degrades to something readable instead of an empty square. */
  function icon(key, size) {
    const p = PROVIDERS[key];
    if (!p) return '';
    const s = size || 36;
    const mono = p.emoji
      ? `<span class="wl-mono" style="font-size:${Math.round(s * 0.5)}px">${p.emoji}</span>`
      : `<span class="wl-mono" style="background:${p.color}; font-size:${Math.round(s * 0.42)}px">${esc(p.label[0])}</span>`;
    const img = p.slug
      ? `<img class="wl-logo" src="${logoUrl(p)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`
      : '';
    return `<span class="wl-ic" style="--sz:${s}px; background:${p.color}1a">${mono}${img}</span>`;
  }

  /* ── Chooser modal ──────────────────────────────────────────────── */
  let showAll = false;
  let query = '';

  function setQuery(v) { query = (v || '').toLowerCase(); renderList(); }
  function toggleAll() { showAll = !showAll; renderList(); }

  function walletRows() {
    const found = detect();
    let entries = Object.entries(PROVIDERS);

    if (query) {
      entries = entries.filter(([, p]) => p.label.toLowerCase().includes(query) || p.chain.toLowerCase().includes(query));
    } else if (!showAll) {
      // Anything actually installed is worth surfacing even if not "popular".
      entries = entries.filter(([k, p]) => p.popular || found[k]);
    }

    // Installed wallets float to the top — that's the one you can actually use.
    entries.sort((a, b) => (found[b[0]] ? 1 : 0) - (found[a[0]] ? 1 : 0));

    const rows = entries.map(([k, p]) => {
      const ready = found[k];
      const tag = k === 'demo' ? 'Always on'
        : k === 'walletconnect' ? 'Needs SDK'
        : ready ? 'Detected' : 'Not installed';
      return `
        <button class="wl-option${ready ? '' : ' missing'}" onclick="WL.pick('${k}')">
          ${icon(k, 36)}
          <span class="wl-opt-main">
            <span class="wl-opt-name">${esc(p.label)}</span>
            <span class="wl-opt-sub">${esc(p.chain)}</span>
          </span>
          <span class="wl-tag ${ready ? 'ok' : ''}">${tag}</span>
        </button>`;
    }).join('') || `<div class="wl-note">No wallet matches “${esc(query)}”.</div>`;

    const hidden = Object.keys(PROVIDERS).length - entries.length;
    const more = (!query && hidden > 0)
      ? `<button class="wl-more" onclick="WL.toggleAll()">${showAll ? 'Show fewer' : `Show all ${Object.keys(PROVIDERS).length} wallets`}</button>`
      : (!query && showAll ? `<button class="wl-more" onclick="WL.toggleAll()">Show fewer</button>` : '');

    return rows + more +
      `<div class="wl-note">Trending never asks for a recovery phrase or private key. Any site that does is trying to steal your funds.</div>`;
  }

  function renderList() {
    const b = document.getElementById('wl-body');
    if (b) b.innerHTML = walletRows();
  }

  function openChooser(mode) {
    closeChooser();
    showAll = false;
    query = '';

    const netOpts = Object.entries(NETWORKS).filter(([k]) => k !== 'simulated' && k !== 'cosmos')
      .map(([k, n]) => `<option value="${k}">${esc(n.label)}</option>`).join('');

    const createPane = `
      <div class="wl-create">
        <label class="form-label">Wallet name</label>
        <input class="input mb8" id="wl-name" placeholder="My Trending Wallet" maxlength="40">
        <label class="form-label">Network</label>
        <select class="input mb12" id="wl-net">${netOpts}</select>
        <div class="wl-warn">
          <span class="material-symbols-rounded ms-18">science</span>
          <div><b>This creates a simulated wallet.</b> It exists only in this browser for the prototype — it holds no funds and controls nothing on any chain. Never send real assets to it.</div>
        </div>
        <button class="btn btn-primary w100" onclick="WL.doCreate()">Create wallet</button>
      </div>`;

    const el = document.createElement('div');
    el.id = 'wl-modal';
    el.className = 'sf-overlay';
    el.onclick = e => { if (e.target === el) closeChooser(); };
    el.innerHTML = `<div class="card wl-modal">
      <button class="icon-btn sf-close" onclick="WL.closeChooser()" aria-label="Close"><span class="material-symbols-rounded">close</span></button>
      <h3 class="fw9 tc-1 m0">${mode === 'create' ? 'Create a wallet' : 'Connect a wallet'}</h3>
      <div class="fs12 tc-3 mb16">${mode === 'create'
        ? 'Spin up a wallet for this prototype.'
        : 'Approve the connection in your wallet. Trending only ever reads your public address.'}</div>

      <div class="wl-tabs">
        <button class="wl-tab${mode !== 'create' ? ' active' : ''}" onclick="WL.openChooser('connect')">Connect existing</button>
        <button class="wl-tab${mode === 'create' ? ' active' : ''}" onclick="WL.openChooser('create')">Create new</button>
      </div>

      ${mode === 'create' ? '' : `<input class="input wl-search" placeholder="Search wallets…" oninput="WL.setQuery(this.value)">`}
      <div id="wl-body">${mode === 'create' ? createPane : walletRows()}</div>
    </div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('open'), 20);
  }

  function closeChooser() {
    const el = document.getElementById('wl-modal');
    if (el) { el.classList.remove('open'); setTimeout(() => el.remove(), 200); }
  }

  async function pick(key) {
    const r = await connect(key);
    if (r.ok) { closeChooser(); return; }
    toast(r.msg);
    if (r.missing) {
      // Leave the sheet open so another wallet can be chosen.
      const b = document.getElementById('wl-body');
      if (b) b.insertAdjacentHTML('afterbegin', `<div class="wl-note wl-note-warn">${esc(r.msg)} Pick another, or use the demo wallet.</div>`);
    }
  }

  function doCreate() {
    const el = document.getElementById('wl-name');
    const net = document.getElementById('wl-net');
    const r = createWallet(el ? el.value : '', net ? net.value : 'ethereum');
    closeChooser();
    toast(`Wallet created · ${shortAddr(r.address)}`);
  }

  /* ── Sidebar / auth chip ────────────────────────────────────────── */
  function paintProfileCard() {
    document.querySelectorAll('[data-wl-status]').forEach(el => {
      el.innerHTML = statusHTML();
    });
  }

  function statusHTML() {
    if (!isConnected()) {
      return `<div class="wl-cta">
        <button class="btn btn-primary btn-sm" onclick="WL.openChooser('connect')">
          <span class="material-symbols-rounded ms-16">account_balance_wallet</span> Connect Wallet
        </button>
        <button class="btn btn-ghost btn-sm" onclick="WL.openChooser('create')">Create Wallet</button>
      </div>`;
    }

    const nets = byNetwork();
    const evmNets = Object.entries(NETWORKS).filter(([, n]) => n.family === 'evm');

    const rows = W.accounts.map(a => {
      const p = PROVIDERS[a.provider] || PROVIDERS.demo;
      const n = NETWORKS[a.net];
      const isPrimary = a.id === W.primary;
      return `
      <div class="wl-acct${isPrimary ? ' primary' : ''}">
        ${icon(a.provider, 30)}
        <div class="wl-conn-main">
          <div class="wl-conn-name">
            ${esc(p.label)}
            ${isPrimary ? '<span class="wl-primary-tag">primary</span>' : ''}
            ${a.simulated ? '<span class="wl-sim">simulated</span>' : ''}
          </div>
          <button class="wl-addr" onclick="WL.copyAddress('${a.id}')" title="Copy address">${esc(shortAddr(a.address))}</button>
        </div>
        <div class="wl-acct-net">
          <span class="wl-net-chip" style="--c:${n.color}">${esc(n.label)}</span>
          ${a.native ? `<span class="wl-native">${a.native.amount} ${esc(a.native.symbol)}</span>` : ''}
        </div>
        <div class="wl-acct-acts">
          ${NETWORKS[a.net].family === 'evm' ? `<select class="wl-net-sel" onchange="WL.switchNetwork('${a.id}', this.value)">
            ${evmNets.map(([k, n2]) => `<option value="${k}"${k === a.net ? ' selected' : ''}>${esc(n2.label)}</option>`).join('')}
          </select>` : ''}
          ${!isPrimary ? `<button class="wl-mini" onclick="WL.setPrimary('${a.id}')" title="Make primary">★</button>` : ''}
          <button class="wl-mini danger" onclick="WL.disconnect('${a.id}')" title="Disconnect">✕</button>
        </div>
      </div>`;
    }).join('');

    return `
      <div class="wl-multi-hd">
        <span><b>${W.accounts.length}</b> wallet${W.accounts.length > 1 ? 's' : ''} across <b>${nets.length}</b> network${nets.length > 1 ? 's' : ''}</span>
        <button class="btn btn-ghost btn-sm" onclick="WL.openChooser('connect')">
          <span class="material-symbols-rounded ms-16">add</span> Add wallet
        </button>
      </div>
      <div class="wl-accts">${rows}</div>`;
  }

  function init() {
    applyToProfile();
    // Reflect account/network switches made inside the wallet itself.
    if (window.ethereum && window.ethereum.on) {
      window.ethereum.on('accountsChanged', accs => {
        const evm = W.accounts.filter(a => !a.simulated && NETWORKS[a.net].family === 'evm');
        if (!evm.length) return;
        if (!accs || !accs.length) { evm.forEach(a => disconnect(a.id)); return; }
        evm.forEach(a => { a.address = accs[0]; refreshBalance(a.id); });
        save(); applyToProfile();
        toast(`Switched to ${shortAddr(accs[0])}`);
      });
      window.ethereum.on('chainChanged', id => {
        const key = netByChainId(id);
        W.accounts.filter(a => !a.simulated && NETWORKS[a.net].family === 'evm').forEach(a => {
          a.chain = chainName(id);
          if (key) a.net = key;
          refreshBalance(a.id);
        });
        save(); applyToProfile();
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    PROVIDERS, NETWORKS, detect, available, connect, disconnect, disconnectAll, createWallet,
    isConnected, account, accounts, byNetwork, setPrimary, switchNetwork,
    refreshBalance, refreshAll, shortAddr, copyAddress, connectDemo,
    openChooser, closeChooser, pick, doCreate, statusHTML, paintProfileCard,
    icon, logoUrl, setQuery, toggleAll,
    get state() { return W; }
  };
})();

window.WL = WL;

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
publish('features/wallet.js', {
  WL: () => WL
});
