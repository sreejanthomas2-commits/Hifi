/* ╔══════════════════════════════════════════════════════════════════╗
   ║  WEB3 DISCOVERY                                                  ║
   ║                                                                  ║
   ║  Three services that hang off the Crypto Hub tabs:               ║
   ║   1. dApp Discovery   — browsable directory by category          ║
   ║   2. Project Pages    — verified Web3 project profiles           ║
   ║   3. Token Pages      — per-coin detail from the live feed       ║
   ║                                                                  ║
   ║  Token pages read window.liveCryptoPrices, so price, 24h change  ║
   ║  and the 7-day chart are real CoinGecko data, not mock numbers.  ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const W3 = (() => {

  const DAPP_CATEGORIES = [
    { id: 'all',      label: 'All',          icon: 'apps' },
    { id: 'defi',     label: 'DeFi',         icon: 'account_balance' },
    { id: 'gaming',   label: 'Gaming',       icon: 'sports_esports' },
    { id: 'social',   label: 'Social',       icon: 'group' },
    { id: 'nft',      label: 'NFTs',         icon: 'token' },
    { id: 'infra',    label: 'Infrastructure', icon: 'lan' },
    { id: 'devtools', label: 'Dev Tools',    icon: 'code' }
  ];

  const DAPPS = [
    { id:'uniswap', url:'https://uniswap.org',  name:'Uniswap',    cat:'defi',     sym:'UNI',   chain:'Ethereum', users:'612K', tvl:'$4.1B',  desc:'Automated market maker for swapping ERC-20 tokens without an order book.' },
    { id:'aave', url:'https://aave.com',     name:'Aave',       cat:'defi',     sym:'AAVE',  chain:'Multi',    users:'184K', tvl:'$11.2B', desc:'Liquidity protocol for over-collateralised lending and borrowing.' },
    { id:'lido', url:'https://lido.fi',     name:'Lido',       cat:'defi',     sym:'LDO',   chain:'Ethereum', users:'268K', tvl:'$22.8B', desc:'Liquid staking — stake ETH and keep a transferable receipt token.' },
    { id:'curve', url:'https://curve.finance',    name:'Curve',      cat:'defi',     sym:'CRV',   chain:'Multi',    users:'96K',  tvl:'$1.9B',  desc:'Stableswap AMM tuned for low-slippage trades between like-priced assets.' },
    { id:'jupiter', url:'https://jup.ag',  name:'Jupiter',    cat:'defi',     sym:'JUP',   chain:'Solana',   users:'1.1M', tvl:'$980M',  desc:'Solana swap aggregator routing across every major on-chain venue.' },
    { id:'axie', url:'https://axieinfinity.com',     name:'Axie Infinity', cat:'gaming', sym:'AXS',  chain:'Ronin',    users:'420K', tvl:'$210M',  desc:'Creature-battling game with tradable on-chain characters and land.' },
    { id:'sandbox', url:'https://sandbox.game',  name:'The Sandbox', cat:'gaming',  sym:'SAND',  chain:'Ethereum', users:'310K', tvl:'$140M',  desc:'Voxel metaverse where players build, own and monetise experiences.' },
    { id:'gala', url:'https://gala.com',     name:'Gala Games', cat:'gaming',   sym:'GALA',  chain:'GalaChain',users:'286K', tvl:'$96M',   desc:'Publisher network where players hold game assets and run nodes.' },
    { id:'lens', url:'https://lens.xyz',     name:'Lens Protocol', cat:'social', sym:null,   chain:'Polygon',  users:'142K', tvl:'—',      desc:'Composable social graph — your follows and posts travel between apps.' },
    { id:'farcaster', url:'https://farcaster.xyz',name:'Farcaster',  cat:'social',   sym:null,    chain:'Optimism', users:'385K', tvl:'—',      desc:'Sufficiently decentralised social protocol with a portable identity.' },
    { id:'mirror', url:'https://mirror.xyz',   name:'Mirror',     cat:'social',   sym:null,    chain:'Ethereum', users:'74K',  tvl:'—',      desc:'Publishing platform where essays can be minted and collected.' },
    { id:'opensea', url:'https://opensea.io',  name:'OpenSea',    cat:'nft',      sym:null,    chain:'Multi',    users:'1.8M', tvl:'—',      desc:'General-purpose NFT marketplace spanning many chains and standards.' },
    { id:'blur', url:'https://blur.io',     name:'Blur',       cat:'nft',      sym:'BLUR',  chain:'Ethereum', users:'218K', tvl:'$320M',  desc:'Pro-grade NFT marketplace built around sweeping and bidding.' },
    { id:'zora', url:'https://zora.co',     name:'Zora',       cat:'nft',      sym:null,    chain:'Zora',     users:'156K', tvl:'—',      desc:'Mint and collect media with onchain royalties for creators.' },
    { id:'chainlink', url:'https://chain.link',name:'Chainlink',  cat:'infra',    sym:'LINK',  chain:'Multi',    users:'—',    tvl:'$18.4B', desc:'Oracle network feeding off-chain data and prices to smart contracts.' },
    { id:'thegraph', url:'https://thegraph.com', name:'The Graph',  cat:'infra',    sym:'GRT',   chain:'Multi',    users:'—',    tvl:'$740M',  desc:'Indexing protocol that makes on-chain data queryable over GraphQL.' },
    { id:'arbitrum', url:'https://arbitrum.io', name:'Arbitrum',   cat:'infra',    sym:'ARB',   chain:'Ethereum L2', users:'2.4M', tvl:'$13.1B', desc:'Optimistic rollup scaling Ethereum with cheaper, faster execution.' },
    { id:'safe', url:'https://safe.global',     name:'Safe',       cat:'infra',    sym:null,    chain:'Multi',    users:'204K', tvl:'$46B',   desc:'Multi-signature smart accounts used to custody treasuries.' },
    { id:'hardhat', url:'https://hardhat.org',  name:'Hardhat',    cat:'devtools', sym:null,    chain:'Ethereum', users:'—',    tvl:'—',      desc:'Development environment for compiling, testing and debugging contracts.' },
    { id:'foundry', url:'https://getfoundry.sh',  name:'Foundry',    cat:'devtools', sym:null,    chain:'Ethereum', users:'—',    tvl:'—',      desc:'Fast Solidity toolchain with fuzzing and Solidity-native tests.' },
    { id:'alchemy', url:'https://alchemy.com',  name:'Alchemy',    cat:'devtools', sym:null,    chain:'Multi',    users:'—',    tvl:'—',      desc:'Node infrastructure and APIs for reading and writing chain state.' },
    { id:'walletconnect', url:'https://walletconnect.network', name:'WalletConnect', cat:'devtools', sym:null, chain:'Multi', users:'—', tvl:'—',       desc:'Open protocol connecting wallets to dApps across chains.' }
  ];

  const PROJECTS = [
    { id:'ethereum', name:'Ethereum', handle:'@ethereum', sym:'ETH', verified:true, chain:'Ethereum',
      tag:'Smart contract platform', followers:'4.2M', founded:'2015',
      about:'A programmable blockchain and the settlement layer most of Web3 is built on. Secures a large share of the ecosystem\'s value through proof of stake.',
      links:[['Website','ethereum.org'],['Docs','ethereum.org/developers'],['Forum','ethresear.ch']] },
    { id:'solana', name:'Solana', handle:'@solana', sym:'SOL', verified:true, chain:'Solana',
      tag:'High-throughput L1', followers:'2.8M', founded:'2020',
      about:'A single-shard chain aiming for very high throughput and low fees, favoured by consumer apps, payments and on-chain order books.',
      links:[['Website','solana.com'],['Docs','docs.solana.com'],['Explorer','explorer.solana.com']] },
    { id:'chainlink', name:'Chainlink', handle:'@chainlink', sym:'LINK', verified:true, chain:'Multi-chain',
      tag:'Oracle network', followers:'1.6M', founded:'2017',
      about:'Decentralised oracle infrastructure. Supplies price feeds, randomness and cross-chain messaging that contracts cannot fetch on their own.',
      links:[['Website','chain.link'],['Docs','docs.chain.link'],['Data feeds','data.chain.link']] },
    { id:'uniswap', name:'Uniswap', handle:'@uniswap', sym:'UNI', verified:true, chain:'Multi-chain',
      tag:'DEX protocol', followers:'1.3M', founded:'2018',
      about:'The AMM design that made on-chain trading practical. Governed by UNI holders, deployed across Ethereum and several L2s.',
      links:[['Website','uniswap.org'],['App','app.uniswap.org'],['Governance','gov.uniswap.org']] },
    { id:'aave', name:'Aave', handle:'@aave', sym:'AAVE', verified:true, chain:'Multi-chain',
      tag:'Lending protocol', followers:'890K', founded:'2017',
      about:'Over-collateralised money market. Depositors earn yield, borrowers post collateral, and liquidations are handled entirely on-chain.',
      links:[['Website','aave.com'],['Docs','docs.aave.com'],['Governance','governance.aave.com']] },
    { id:'arbitrum', name:'Arbitrum', handle:'@arbitrum', sym:'ARB', verified:true, chain:'Ethereum L2',
      tag:'Optimistic rollup', followers:'1.1M', founded:'2021',
      about:'Scales Ethereum by executing transactions off-chain and posting compressed data back to L1, inheriting Ethereum\'s security.',
      links:[['Website','arbitrum.io'],['Bridge','bridge.arbitrum.io'],['Docs','docs.arbitrum.io']] },
    { id:'lido', name:'Lido', handle:'@lidofinance', sym:'LDO', verified:true, chain:'Ethereum',
      tag:'Liquid staking', followers:'640K', founded:'2020',
      about:'Lets holders stake without running a validator, issuing a liquid receipt token that stays usable across DeFi.',
      links:[['Website','lido.fi'],['Docs','docs.lido.fi'],['Research','research.lido.fi']] },
    { id:'thegraph', name:'The Graph', handle:'@graphprotocol', sym:'GRT', verified:true, chain:'Multi-chain',
      tag:'Data indexing', followers:'520K', founded:'2018',
      about:'An indexing layer that turns raw chain events into queryable subgraphs, so applications do not each rebuild the same pipelines.',
      links:[['Website','thegraph.com'],['Docs','thegraph.com/docs'],['Explorer','thegraph.com/explorer']] }
  ];

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const icon = (sym, size) => (typeof coinIcon === 'function' && sym) ? coinIcon(sym, size) : '';
  const live = sym => (window.liveCryptoPrices || {})[sym];

  function money(v) {
    if (v === null || v === undefined) return '—';
    if (v < 0.01) return '$' + v.toFixed(6);
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function change(v) {
    if (v === null || v === undefined) return '<span class="tc-3">0.0%</span>';
    const cls = v >= 0 ? 'w3-up' : 'w3-down';
    return `<span class="${cls}">${v >= 0 ? '+' : ''}${v.toFixed(2)}%</span>`;
  }

  /* ── 1. dApp Discovery ──────────────────────────────────────────── */
  let dappCat = 'all';

  function renderDapps(cat) {
    if (cat) dappCat = cat;
    const host = document.getElementById('crypto-tab-content');
    if (!host) return;

    const chips = DAPP_CATEGORIES.map(c => `
      <button class="chip${dappCat === c.id ? ' active' : ''}" onclick="W3.renderDapps('${c.id}')">
        <span class="material-symbols-rounded ms-16">${c.icon}</span> ${c.label}
      </button>`).join('');

    const list = DAPPS.filter(d => dappCat === 'all' || d.cat === dappCat);

    const cards = list.map(d => `
      <div class="card w3-dapp">
        <div class="w3-dapp-top">
          ${d.sym ? icon(d.sym, 34) : `<span class="w3-dapp-mono">${esc(d.name[0])}</span>`}
          <div class="w3-dapp-id">
            <div class="w3-dapp-name">${esc(d.name)}</div>
            <div class="w3-dapp-chain">${esc(d.chain)}</div>
          </div>
          <span class="w3-cat-tag">${esc((DAPP_CATEGORIES.find(c => c.id === d.cat) || {}).label || d.cat)}</span>
        </div>
        <p class="w3-dapp-desc">${esc(d.desc)}</p>
        <div class="w3-dapp-stats">
          <span><b>${esc(d.users)}</b> users</span>
          <span><b>${esc(d.tvl)}</b> TVL</span>
        </div>
        <div class="w3-dapp-acts">
          <button class="btn btn-primary btn-sm" onclick="W3.openDapp('${d.id}')">Open dApp</button>
          ${d.sym ? `<button class="btn btn-ghost btn-sm" onclick="W3.openToken('${d.sym}')">${d.sym}</button>` : ''}
        </div>
      </div>`).join('');

    host.innerHTML = `
      <div class="w3-intro">
        <h3 class="fw8 tc-1 m0">Discover dApps</h3>
        <p class="fs12 tc-3 m0">${list.length} applications across ${DAPP_CATEGORIES.length - 1} categories.</p>
      </div>
      <div class="w3-chips">${chips}</div>
      <div class="w3-grid">${cards}</div>`;
  }

  /* Opening a dApp used to raise a toast and stop there. It now opens the
     page the card promises: what the dApp is, what its token is doing,
     what connecting would authorise, and the real actions this app can
     actually carry out — connect a wallet, watch the token, set an alert,
     post about it, or leave for the official site. */
  function openDapp(id) {
    const d = DAPPS.find(x => x.id === id);
    if (!d) return;
    const l = d.sym ? live(d.sym) : null;
    const cat = (DAPP_CATEGORIES.find(c => c.id === d.cat) || {}).label || d.cat;
    const connected = (typeof WL !== 'undefined' && WL.isConnected && WL.isConnected());
    const acct = connected && WL.account ? WL.account() : null;
    const addr = acct && typeof WL.shortAddr === 'function' ? WL.shortAddr(acct.address || acct) : '';
    const watched = (typeof CT !== 'undefined' && d.sym && CT.isWatched) ? CT.isWatched(d.sym) : false;
    const related = DAPPS.filter(x => x.cat === d.cat && x.id !== d.id).slice(0, 4);

    modal('w3-dapp-overlay', `
      <div class="w3-modal-head">
        ${d.sym ? icon(d.sym, 52) : `<span class="w3-dapp-mono lg">${esc(d.name[0])}</span>`}
        <div style="flex:1; min-width:0">
          <h3 class="fw9 tc-1 m0">${esc(d.name)}</h3>
          <div class="fs12 tc-3">${esc(cat)} · ${esc(d.chain)}${d.sym ? ' · $' + esc(d.sym) : ''}</div>
        </div>
      </div>

      <div class="w3-dstats">
        <div><span>Users</span><b>${esc(d.users)}</b></div>
        <div><span>Value locked</span><b>${esc(d.tvl)}</b></div>
        <div><span>Network</span><b>${esc(d.chain)}</b></div>
      </div>

      ${l ? `<div class="w3-price-strip">
        <div><div class="fs11 tc-3">${esc(d.sym)} price</div><div class="fw9 fs18 tc-1">${money(l.usd)}</div></div>
        <div style="text-align:right"><div class="fs11 tc-3">24h</div><div class="fw8 fs16">${change(l.usd_24h_change)}</div></div>
      </div>` : ''}

      <div class="w3-sec-t">About</div>
      <p class="w3-about">${esc(d.desc)}</p>

      <div class="w3-sec-t">Connect</div>
      <div class="w3-connect">
        <span class="material-symbols-rounded">${connected ? 'link' : 'link_off'}</span>
        <div>
          <b>${connected ? 'Wallet connected' : 'No wallet connected'}</b>
          <span>${connected
            ? esc(addr) + ' — ' + esc(d.name) + ' would see this public address and your public balances. Nothing is signed here.'
            : 'Connecting shares your public address only. This app never asks for a seed phrase or a private key, and cannot sign a transaction for you.'}</span>
        </div>
        <button class="btn ${connected ? 'btn-ghost' : 'btn-primary'} btn-sm" onclick="W3.dappConnect('${d.id}')">
          ${connected ? 'Manage wallet' : 'Connect wallet'}</button>
      </div>

      <div class="w3-dapp-acts wide">
        ${d.url ? `<button class="btn btn-primary btn-sm" onclick="W3.visitDapp('${d.id}')">
          <span class="material-symbols-rounded ms-16">open_in_new</span> Official site</button>` : ''}
        ${d.sym ? `<button class="btn btn-ghost btn-sm" onclick="W3.closeModal(); W3.openToken('${d.sym}')">View ${esc(d.sym)} token</button>` : ''}
        ${d.sym && typeof CT !== 'undefined' ? `<button class="btn btn-ghost btn-sm" onclick="W3.dappWatch('${d.id}')">
          <span class="material-symbols-rounded ms-16">${watched ? 'star' : 'star_border'}</span> ${watched ? 'Watching' : 'Watch'}</button>` : ''}
        ${d.sym ? `<button class="btn btn-ghost btn-sm" onclick="W3.postAbout('${d.sym}')">Post about it</button>` : ''}
      </div>

      ${related.length ? `<div class="w3-sec-t">More in ${esc(cat)}</div>
        <div class="w3-related">
          ${related.map(r => `<button class="w3-rel" onclick="W3.openDapp('${r.id}')">
            ${r.sym ? icon(r.sym, 26) : `<span class="w3-dapp-mono sm">${esc(r.name[0])}</span>`}
            <span><b>${esc(r.name)}</b><i>${esc(r.chain)}</i></span>
          </button>`).join('')}
        </div>` : ''}

      ${d.url ? `<p class="w3-foot-note">${esc(d.name)} is a real product on ${esc(d.chain)}. Trending links to it —
        the app itself runs nothing on-chain, and the user and value figures above are illustrative.</p>` : ''}
    `);
    if (typeof SF !== 'undefined') SF.earn('curate');
  }

  /* Outside links open in a new tab, on the user's tap, never
     automatically. */
  function visitURL(url) {
    if (!url) return;
    const full = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    window.open(full, '_blank', 'noopener,noreferrer');
    if (typeof showToast === 'function') showToast('Opening ' + full.replace(/^https?:\/\//, '') + ' in a new tab');
  }

  function visitDapp(id) {
    const d = DAPPS.find(x => x.id === id);
    if (!d || !d.url) return;
    window.open(d.url, '_blank', 'noopener,noreferrer');
    if (typeof showToast === 'function') showToast(`Opening ${d.name} in a new tab`);
  }

  function dappConnect(id) {
    const d = DAPPS.find(x => x.id === id);
    closeModal();
    if (typeof WL !== 'undefined' && WL.openChooser) { WL.openChooser(); return; }
    if (typeof showToast === 'function') showToast('Wallet module unavailable.');
  }

  function dappWatch(id) {
    const d = DAPPS.find(x => x.id === id);
    if (!d || !d.sym || typeof CT === 'undefined' || !CT.toggleWatch) return;
    CT.toggleWatch(d.sym);
    openDapp(id);      // reopen so the star reflects the new state
  }

  /* ── 2. Web3 Project Pages ──────────────────────────────────────── */
  function renderProjects() {
    const host = document.getElementById('crypto-tab-content');
    if (!host) return;
    const cards = PROJECTS.map(p => {
      const l = p.sym ? live(p.sym) : null;
      return `
      <div class="card w3-proj" onclick="W3.openProject('${p.id}')">
        <div class="w3-proj-top">
          ${icon(p.sym, 40)}
          <div class="w3-dapp-id">
            <div class="w3-dapp-name">${esc(p.name)} ${p.verified ? '<span class="w3-verified" title="Verified project">✓</span>' : ''}</div>
            <div class="w3-dapp-chain">${esc(p.handle)} · ${esc(p.tag)}</div>
          </div>
        </div>
        <div class="w3-proj-stats">
          <span><b>${esc(p.followers)}</b> followers</span>
          ${l ? `<span><b>${money(l.usd)}</b> ${change(l.usd_24h_change)}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    host.innerHTML = `
      <div class="w3-intro">
        <h3 class="fw8 tc-1 m0">Web3 Projects</h3>
        <p class="fs12 tc-3 m0">Verified project profiles — follow them like any other account.</p>
      </div>
      <div class="w3-grid">${cards}</div>`;
    if (typeof SF !== 'undefined') SF.paintFollowButtons();
  }

  function openProject(id) {
    const p = PROJECTS.find(x => x.id === id);
    if (!p) return;
    const l = p.sym ? live(p.sym) : null;
    const links = p.links.map(([label, url]) =>
      `<button class="w3-link" onclick="W3.visitURL('${esc(url)}')" title="Open ${esc(url)} in a new tab">
         <span class="material-symbols-rounded ms-16">link</span><span>${esc(label)}</span><b>${esc(url)}</b>
         <span class="material-symbols-rounded ms-16 w3-link-go">open_in_new</span>
       </button>`).join('');

    modal('w3-project-overlay', `
      <div class="w3-modal-head">
        ${icon(p.sym, 52)}
        <div style="flex:1; min-width:0">
          <h3 class="fw9 tc-1 m0">${esc(p.name)} ${p.verified ? '<span class="w3-verified">✓</span>' : ''}</h3>
          <div class="fs12 tc-3">${esc(p.handle)} · ${esc(p.chain)} · since ${esc(p.founded)}</div>
        </div>
      </div>

      <div class="w3-modal-acts">
        ${typeof SF !== 'undefined' ? SF.followBtn(p.handle, p.name) : ''}
        ${p.sym ? `<button class="btn btn-ghost btn-sm" onclick="W3.closeModal(); W3.openToken('${p.sym}')">View ${p.sym} token</button>` : ''}
      </div>

      ${l ? `<div class="w3-price-strip">
        <div><div class="fs11 tc-3">Price</div><div class="fw9 fs18 tc-1">${money(l.usd)}</div></div>
        <div style="text-align:right"><div class="fs11 tc-3">24h</div><div class="fw8 fs16">${change(l.usd_24h_change)}</div></div>
      </div>` : ''}

      <div class="w3-sec-t">About</div>
      <p class="w3-about">${esc(p.about)}</p>

      <div class="w3-sec-t">Official links</div>
      ${links}

      <div class="w3-sec-t">Community</div>
      <div class="fs12 tc-2">${esc(p.followers)} followers on Trending · ${esc(p.tag)}</div>
    `);
  }

  /* ── 3. Token Pages ─────────────────────────────────────────────── */
  function openToken(symbol) {
    const sym = String(symbol || '').toUpperCase();
    const d = live(sym);
    if (!d) { if (typeof showToast === 'function') showToast(`No live market data for ${sym}.`); return; }

    const proj = PROJECTS.find(p => p.sym === sym);
    const dapp = DAPPS.find(x => x.sym === sym);
    const spark = Array.isArray(d.spark) && d.spark.length > 2 ? d.spark : null;

    modal('w3-token-overlay', `
      <div class="w3-modal-head">
        ${icon(sym, 52)}
        <div style="flex:1; min-width:0">
          <h3 class="fw9 tc-1 m0">${esc(d.name || sym)}</h3>
          <div class="fs12 tc-3">${esc(sym)} · live market</div>
        </div>
      </div>

      <div class="w3-price-strip">
        <div><div class="fs11 tc-3">Price</div><div class="fw9 tc-1" style="font-size:26px">${money(d.usd)}</div></div>
        <div style="text-align:right"><div class="fs11 tc-3">24h change</div><div class="fw8 fs18">${change(d.usd_24h_change)}</div></div>
      </div>

      ${spark ? `<div class="w3-sec-t">7-day chart</div>${sparkline(spark, d.usd_24h_change >= 0)}`
              : `<div class="w3-chart-empty">7-day chart unavailable for this token.</div>`}

      <div class="w3-sec-t">Market</div>
      <div class="w3-kv"><span>Symbol</span><b>${esc(sym)}</b></div>
      <div class="w3-kv"><span>Name</span><b>${esc(d.name || sym)}</b></div>
      <div class="w3-kv"><span>Price (USD)</span><b>${money(d.usd)}</b></div>
      <div class="w3-kv"><span>24h change</span><b>${change(d.usd_24h_change)}</b></div>
      ${dapp ? `<div class="w3-kv"><span>Network</span><b>${esc(dapp.chain)}</b></div>` : ''}

      <div class="w3-modal-acts mt12">
        <button class="btn btn-primary btn-sm" onclick="W3.closeModal(); navigateTo('profile')">Trade in wallet</button>
        ${proj ? `<button class="btn btn-ghost btn-sm" onclick="W3.closeModal(); W3.openProject('${proj.id}')">Project page</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="W3.postAbout('${esc(sym)}')">Post about ${esc(sym)}</button>
      </div>

      ${proj ? `<div class="w3-sec-t">Official links</div>
        ${proj.links.map(([l, u]) => `<div class="w3-link"><span class="material-symbols-rounded ms-16">link</span><span>${esc(l)}</span><b>${esc(u)}</b></div>`).join('')}` : ''}
    `);
  }

  /* Inline SVG sparkline — no chart library, scales to the data range. */
  function sparkline(points, up) {
    const w = 300, h = 76, pad = 4;
    const min = Math.min(...points), max = Math.max(...points);
    const span = (max - min) || 1;
    const step = (w - pad * 2) / (points.length - 1);
    const coords = points.map((p, i) => {
      const x = pad + i * step;
      const y = pad + (h - pad * 2) * (1 - (p - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const stroke = up ? 'var(--green)' : 'var(--red)';
    return `
      <svg class="w3-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="7 day price chart">
        <polyline fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${coords.join(' ')}"/>
        <polyline fill="${up ? 'rgba(76,175,80,.12)' : 'rgba(229,57,53,.12)'}" stroke="none"
          points="${pad},${h - pad} ${coords.join(' ')} ${w - pad},${h - pad}"/>
      </svg>
      <div class="w3-spark-lbl"><span>${money(min)}</span><span>${money(max)}</span></div>`;
  }

  /* Jump to the composer with the ticker pre-filled. */
  function postAbout(sym) {
    closeModal();
    if (typeof navigateTo === 'function') navigateTo('feeds');
    setTimeout(() => {
      const box = document.getElementById('composer-input') || document.querySelector('.composer-input, #post-input');
      if (box) {
        const text = `$${sym} — `;
        if ('value' in box) { box.value = text; box.focus(); }
        else { box.textContent = text; box.focus(); }
      }
      if (typeof showToast === 'function') showToast(`Composer ready for $${sym}`);
    }, 300);
  }

  /* ── Shared modal shell ─────────────────────────────────────────── */
  function modal(id, inner) {
    closeModal();
    const el = document.createElement('div');
    el.id = id;
    el.className = 'sf-overlay w3-overlay';
    el.onclick = e => { if (e.target === el) closeModal(); };
    el.innerHTML = `<div class="card w3-modal">
      <button class="icon-btn sf-close" onclick="W3.closeModal()" aria-label="Close"><span class="material-symbols-rounded">close</span></button>
      ${inner}
    </div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('open'), 20);
    if (typeof SF !== 'undefined') SF.paintFollowButtons();
  }

  function closeModal() {
    document.querySelectorAll('.w3-overlay').forEach(el => {
      el.classList.remove('open');
      setTimeout(() => el.remove(), 220);
    });
  }

  return { renderDapps, renderProjects, openProject, openToken, openDapp, visitDapp, visitURL, dappConnect, dappWatch,
           postAbout, closeModal, DAPPS, PROJECTS, DAPP_CATEGORIES };
})();

window.W3 = W3;
