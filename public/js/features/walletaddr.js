/* ╔══════════════════════════════════════════════════════════════════╗
   ║  WALLET ADDRESSES — the on-chain half of crypto in chat          ║
   ║                                                                  ║
   ║  Chat crypto has two different lanes, and the difference is the  ║
   ║  whole reason this file exists:                                  ║
   ║                                                                  ║
   ║   · In Trending  — CFI/PAY move the paper balance between two    ║
   ║                    Trending accounts. Instant, reversible by us,  ║
   ║                    addressed by handle or Pay ID. No wallet       ║
   ║                    address is involved, which is why none was     ║
   ║                    ever asked for.                                ║
   ║   · On-chain     — a real transfer between two wallets. Trending  ║
   ║                    is not in the middle of it: it can hold your   ║
   ║                    receiving addresses, show them as a card or a  ║
   ║                    QR, keep an address book per conversation and  ║
   ║                    track whether you marked a transfer as sent.   ║
   ║                    The transfer itself is finished in your own    ║
   ║                    wallet app.                                    ║
   ║                                                                  ║
   ║  Rules this file keeps, deliberately:                            ║
   ║   1. Trending never signs or broadcasts anything. No key, no     ║
   ║      seed phrase, no transaction is ever built here.             ║
   ║   2. No receiving address is ever invented. Every address shown  ║
   ║      was either connected through the user's own wallet, typed   ║
   ║      by the user, or saved by the user for a contact. The demo   ║
   ║      addresses in the seed data are never offered as a payment   ║
   ║      destination — sending real funds to one would burn them.    ║
   ║   3. Anything that looks like a recovery phrase or a private     ║
   ║      key is refused on sight and never stored, echoed or logged. ║
   ║   4. A simulated wallet is labelled as simulated everywhere it   ║
   ║      appears, so it can't be mistaken for somewhere to receive.  ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const WAD = (() => {

  const KEY = 'ts_wallet_addr_v1';
  const MAX_LABEL = 28;
  const MAX_NOTE = 60;

  /* ── Networks ────────────────────────────────────────────────────── */
  /* `family` decides which address shape is valid and which URI scheme a
     wallet app understands. Explorers are opened only when the user taps. */
  const NETS = {
    ethereum: { label: 'Ethereum', tag: 'ERC-20', family: 'evm', chainId: 1,     symbol: 'ETH', color: '#627EEA',
                addr: 'https://etherscan.io/address/',            tx: 'https://etherscan.io/tx/' },
    base:     { label: 'Base',     tag: 'Base',   family: 'evm', chainId: 8453,  symbol: 'ETH', color: '#0052FF',
                addr: 'https://basescan.org/address/',            tx: 'https://basescan.org/tx/' },
    arbitrum: { label: 'Arbitrum', tag: 'Arbitrum One', family: 'evm', chainId: 42161, symbol: 'ETH', color: '#12AAFF',
                addr: 'https://arbiscan.io/address/',             tx: 'https://arbiscan.io/tx/' },
    optimism: { label: 'Optimism', tag: 'OP Mainnet', family: 'evm', chainId: 10, symbol: 'ETH', color: '#FF0420',
                addr: 'https://optimistic.etherscan.io/address/',  tx: 'https://optimistic.etherscan.io/tx/' },
    polygon:  { label: 'Polygon',  tag: 'Polygon PoS', family: 'evm', chainId: 137, symbol: 'POL', color: '#8247E5',
                addr: 'https://polygonscan.com/address/',          tx: 'https://polygonscan.com/tx/' },
    bnb:      { label: 'BNB Chain', tag: 'BEP-20', family: 'evm', chainId: 56,   symbol: 'BNB', color: '#F0B90B',
                addr: 'https://bscscan.com/address/',              tx: 'https://bscscan.com/tx/' },
    solana:   { label: 'Solana',   tag: 'SPL',    family: 'solana', symbol: 'SOL', color: '#14F195',
                addr: 'https://solscan.io/account/',               tx: 'https://solscan.io/tx/' },
    tron:     { label: 'Tron',     tag: 'TRC-20', family: 'tron',   symbol: 'TRX', color: '#EF0027',
                addr: 'https://tronscan.org/#/address/',           tx: 'https://tronscan.org/#/transaction/' },
    bitcoin:  { label: 'Bitcoin',  tag: 'BTC',    family: 'bitcoin', symbol: 'BTC', color: '#F7931A',
                addr: 'https://mempool.space/address/',            tx: 'https://mempool.space/tx/' },
    /* The rest of the chains a top-250 coin lives on — the same list the
       server's deposit config has, so Deposit and Send agree. */
    xrpl:     { label: 'XRP Ledger', tag: 'XRPL', family: 'xrpl', symbol: 'XRP', color: '#23292F',
                addr: 'https://livenet.xrpl.org/accounts/',        tx: 'https://livenet.xrpl.org/transactions/' },
    avalanche:{ label: 'Avalanche C-Chain', tag: 'C-Chain', family: 'evm', chainId: 43114, symbol: 'AVAX', color: '#E84142',
                addr: 'https://snowtrace.io/address/',             tx: 'https://snowtrace.io/tx/' },
    etc:      { label: 'Ethereum Classic', tag: 'ETC', family: 'evm', chainId: 61, symbol: 'ETC', color: '#328332',
                addr: 'https://etc.blockscout.com/address/',       tx: 'https://etc.blockscout.com/tx/' },
    dogecoin: { label: 'Dogecoin', tag: 'DOGE', family: 'dogecoin', symbol: 'DOGE', color: '#C2A633',
                addr: 'https://blockchair.com/dogecoin/address/',  tx: 'https://blockchair.com/dogecoin/transaction/' },
    litecoin: { label: 'Litecoin', tag: 'LTC', family: 'litecoin', symbol: 'LTC', color: '#345D9D',
                addr: 'https://blockchair.com/litecoin/address/',  tx: 'https://blockchair.com/litecoin/transaction/' },
    bitcoincash: { label: 'Bitcoin Cash', tag: 'BCH', family: 'bitcoincash', symbol: 'BCH', color: '#8DC351',
                addr: 'https://blockchair.com/bitcoin-cash/address/', tx: 'https://blockchair.com/bitcoin-cash/transaction/' },
    cardano:  { label: 'Cardano', tag: 'ADA', family: 'cardano', symbol: 'ADA', color: '#0033AD',
                addr: 'https://cardanoscan.io/address/',           tx: 'https://cardanoscan.io/transaction/' },
    polkadot: { label: 'Polkadot', tag: 'DOT', family: 'polkadot', symbol: 'DOT', color: '#E6007A',
                addr: 'https://polkadot.subscan.io/account/',      tx: 'https://polkadot.subscan.io/extrinsic/' },
    ton:      { label: 'TON', tag: 'The Open Network', family: 'ton', symbol: 'TON', color: '#0098EA',
                addr: 'https://tonviewer.com/',                    tx: 'https://tonviewer.com/transaction/' },
    stellar:  { label: 'Stellar', tag: 'XLM', family: 'stellar', symbol: 'XLM', color: '#14B6E7',
                addr: 'https://stellar.expert/explorer/public/account/', tx: 'https://stellar.expert/explorer/public/tx/' },
    near:     { label: 'NEAR Protocol', tag: 'NEAR', family: 'near', symbol: 'NEAR', color: '#00C08B',
                addr: 'https://nearblocks.io/address/',            tx: 'https://nearblocks.io/txns/' },
    hedera:   { label: 'Hedera', tag: 'HBAR', family: 'hedera', symbol: 'HBAR', color: '#3C3C3C',
                addr: 'https://hashscan.io/mainnet/account/',      tx: 'https://hashscan.io/mainnet/transaction/' },
    algorand: { label: 'Algorand', tag: 'ALGO', family: 'algorand', symbol: 'ALGO', color: '#4A4A4A',
                addr: 'https://allo.info/account/',                tx: 'https://allo.info/tx/' },
    tezos:    { label: 'Tezos', tag: 'XTZ', family: 'tezos', symbol: 'XTZ', color: '#2C7DF7',
                addr: 'https://tzkt.io/',                          tx: 'https://tzkt.io/' },
    cosmos:   { label: 'Cosmos Hub', tag: 'ATOM', family: 'cosmos', symbol: 'ATOM', color: '#2E3148',
                addr: 'https://www.mintscan.io/cosmos/address/',   tx: 'https://www.mintscan.io/cosmos/tx/' },
    kaspa:    { label: 'Kaspa', tag: 'KAS', family: 'kaspa', symbol: 'KAS', color: '#49EACB',
                addr: 'https://explorer.kaspa.org/addresses/',     tx: 'https://explorer.kaspa.org/txs/' }
  };

  const NET_KEYS = Object.keys(NETS);
  const netOf = k => NETS[k] || NETS.ethereum;

  /* What a wallet can actually hold on each family. Token contracts are
     deliberately absent — the sender's wallet knows them, we don't, and a
     wrong contract address pasted from an app is how people lose funds. */
  const COINS = {
    evm:     ['USDT', 'USDC', 'ETH', 'DAI', 'WBTC'],
    solana:  ['SOL', 'USDC', 'USDT'],
    tron:    ['USDT', 'TRX'],
    bitcoin: ['BTC'],
    ton:     ['USDT'],
    near:    ['USDT', 'USDC'],
    stellar: ['USDC'],
    algorand:['USDC'],
    hedera:  ['USDC']
  };

  function coinsFor(netKey) {
    const n = netOf(netKey);
    const list = (COINS[n.family] || ['USDT']).slice();
    if (list.indexOf(n.symbol) === -1) list.unshift(n.symbol);
    return list;
  }

  /* ── Address shapes ──────────────────────────────────────────────── */
  const SHAPE = {
    evm:     /^0x[0-9a-fA-F]{40}$/,
    solana:  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    tron:    /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    bitcoin: /^(bc1[a-z0-9]{11,71}|BC1[A-Z0-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/,
    xrpl:    /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
    dogecoin:/^[DA9][1-9A-HJ-NP-Za-km-z]{25,34}$/,
    litecoin:/^(ltc1[a-z0-9]{11,71}|LTC1[A-Z0-9]{11,71}|[LM3][1-9A-HJ-NP-Za-km-z]{26,33})$/,
    bitcoincash: /^((bitcoincash:)?[qp][02-9ac-hj-np-z]{41}|[13][1-9A-HJ-NP-Za-km-z]{25,33})$/,
    cardano: /^(addr1[02-9ac-hj-np-z]{50,110}|Ae2[1-9A-HJ-NP-Za-km-z]{50,70}|DdzFF[1-9A-HJ-NP-Za-km-z]{80,120})$/,
    polkadot:/^1[1-9A-HJ-NP-Za-km-z]{46,47}$/,
    ton:     /^([EUk0]Q[A-Za-z0-9_-]{46}|-?[01]:[0-9a-fA-F]{64})$/,
    stellar: /^G[A-Z2-7]{55}$/,
    /* Named accounts only: an implicit NEAR account is 64 hex characters,
       which is also what a raw private key looks like. */
    near:    /^(([a-z0-9]+[-_])*[a-z0-9]+\.)+near$/,
    hedera:  /^0\.0\.\d{1,10}(-[a-z]{5})?$/,
    algorand:/^[A-Z2-7]{58}$/,
    tezos:   /^(tz[1-4]|KT1)[1-9A-HJ-NP-Za-km-z]{33}$/,
    cosmos:  /^cosmos1[02-9ac-hj-np-z]{38}$/,
    kaspa:   /^kaspa:[02-9ac-hj-np-z]{61,63}$/
  };

  /* A recovery phrase or a private key must never reach this app. Detected
     by shape only, and the value is dropped without being shown again. */
  function secretLooking(raw) {
    if (typeof SSF !== 'undefined' && SSF.secretKind) return SSF.secretKind(raw);
    const t = String(raw || '').trim();
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length >= 11 && words.every(w => /^[A-Za-z]{3,9}$/.test(w))) return 'phrase';
    if (/^(0x)?[0-9a-fA-F]{64}$/.test(t)) return 'key';
    if (/^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(t)) return 'key';
    if (/^xprv[0-9A-Za-z]{50,}$/.test(t)) return 'key';
    return '';
  }
  // Invisible characters copied along with an address are dropped (utils/addrcheck.js).
  const cleaned = raw => (typeof ADDR !== 'undefined' ? ADDR.clean(raw) : { value: String(raw || '').trim(), hidden: false });

  /* Which networks a pasted address could belong to. EVM addresses are the
     same on every EVM chain, so this narrows the family, never the chain. */
  /* Most specific shape first: a Dogecoin or XRP address would also pass
     Solana's looser pattern, so Solana is asked last. */
  const DETECT = ['evm', 'tron', 'bitcoin', 'litecoin', 'bitcoincash', 'cardano', 'cosmos', 'kaspa', 'ton',
    'stellar', 'algorand', 'tezos', 'hedera', 'near', 'polkadot', 'xrpl', 'dogecoin', 'solana'];
  function detectNets(address) {
    const a = cleaned(address).value;
    for (const fam of DETECT) {
      if (!SHAPE[fam].test(a)) continue;
      return NET_KEYS.filter(k => NETS[k].family === fam);
    }
    return [];
  }

  /* The shape says which network an address could be on; the checksum
     (utils/addrcheck.js) says whether every character is right. A shape
     check alone passed almost every one-character typo, and a typo is
     an address nobody owns. Returns the cleaned address as `value`:
     callers store that, not what was pasted. */
  function validate(netKey, address) {
    const c = cleaned(address);
    const a = c.value;
    const n = netOf(netKey);
    if (!a) return { ok: false, msg: 'Paste an address.' };

    const secret = secretLooking(address);
    if (secret) {
      return {
        ok: false, secret,
        msg: secret === 'phrase'
          ? 'That looks like a recovery phrase. Never paste it into any app, including this one — it hands over the whole wallet. Nothing was saved.'
          : 'That looks like a private key. Never paste it into any app, including this one. Nothing was saved.'
      };
    }

    if (/\s/.test(a)) return { ok: false, msg: 'An address has no spaces in it — copy it again from your wallet.' };
    const ck = typeof ADDR !== 'undefined' ? ADDR.check(n.family, a) : null;
    if (!SHAPE[n.family].test(a) && !(ck && ck.ok)) {
      const an = l => (/^[AEIOU]/i.test(l) ? 'an ' : 'a ') + l;
      const guess = detectNets(a);
      if (guess.length) {
        return { ok: false, msg: `That isn't ${an(n.label)} address — it looks like ${netOf(guess[0]).label}${guess.length > 1 ? ' (or another EVM chain)' : ''}. Pick the matching network.` };
      }
      // The checksum check can often say more precisely what this is (an X-address, a muxed account, testnet).
      if (ck && !ck.ok && ck.reason) return { ok: false, msg: ck.reason };
      return { ok: false, msg: `That doesn't look like ${an(n.label)} address. Copy it again from your wallet.` };
    }

    if (ck && !ck.ok) return { ok: false, msg: ck.reason };
    const notes = [];
    if (c.hidden) notes.push('Invisible characters copied with it were removed.');
    if (ck && ck.note) notes.push(ck.note);
    else if (!ck) notes.push('Only the format of this address could be checked — compare it character by character.');
    return { ok: true, value: a, checksum: !!(ck && ck.checksum), kind: ck && ck.kind, dustSats: ck && ck.dustSats, warn: notes.join(' ') };
  }

  /* ── Store ───────────────────────────────────────────────────────── */
  /* own    — receiving addresses you typed in (connected wallets are read
              live from WL instead of being copied in here)
     peers  — an address book per conversation, saved by you
     shares — a snapshot of every address card posted into a chat
     sends  — outgoing on-chain transfers you chose to track
     asks   — "please send me your address" cards                        */
  const DEFAULT = { own: [], peers: {}, shares: {}, sends: {}, asks: {}, primary: '' };
  let D = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }

  /* ── Small helpers ───────────────────────────────────────────────── */
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s)) : String(s == null ? '' : s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const ic = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);

  function shortAddr(a) {
    const s = String(a || '');
    return s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
  }

  /* Addresses are read character by character when someone verifies one, so
     they're shown in groups with the ends marked — the two parts people
     actually compare against their wallet. */
  function chunked(a) {
    const s = String(a || '');
    if (s.length < 12) return `<span class="wad-addr">${esc(s)}</span>`;
    const head = s.slice(0, 6), tail = s.slice(-4), mid = s.slice(6, -4);
    const groups = (mid.match(/.{1,4}/g) || []).join(' ');
    return `<span class="wad-addr"><b>${esc(head)}</b> ${esc(groups)} <b>${esc(tail)}</b></span>`;
  }

  const netChip = k => {
    const n = netOf(k);
    return `<span class="wad-net" style="--nc:${n.color}">${esc(n.label)}<em>${esc(n.tag)}</em></span>`;
  };

  function priceOf(sym) {
    if (sym === 'USDT' || sym === 'USDC' || sym === 'DAI') return 1;
    const c = (window.liveCryptoPrices || {})[sym];
    return c ? c.usd : 0;
  }

  function usd(v) {
    if (!v) return '';
    return '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const qty = v => (!v ? '0' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 8 }));

  /* ── Chat glue ───────────────────────────────────────────────────── */
  /* Cards need a numeric conversation id, the same one the chat crypto
     panel uses. Community rooms and Saved Messages have no counterparty, so
     they resolve to null and the sheet simply drops its per-chat sections. */
  function activeChat() {
    if (typeof TG !== 'undefined' && TG.activeChat) {
      const c = TG.activeChat();
      if (c && c.src === 'convo' && c.raw) {
        if (typeof S !== 'undefined') S.activeChatId = c.raw.id;
        return c.raw.id;
      }
      return null;
    }
    return (typeof S !== 'undefined' ? S.activeChatId : null);
  }

  function peerName(chatId) {
    const c = (typeof DATA !== 'undefined' && DATA.conversations || [])
      .find(x => String(x.id) === String(chatId));
    return c ? c.name : 'them';
  }

  const firstName = id => String(peerName(id) || 'them').split(/\s+/)[0];

  function post(chatId, fi) {
    if (typeof CFI === 'undefined' || !CFI.push) { toast('Chat is still loading — try again in a second.'); return null; }
    return CFI.push(chatId, fi);
  }

  function repaintChat() {
    if (typeof renderChatMessages === 'function') renderChatMessages();
    if (typeof renderConversations === 'function') renderConversations();
  }

  /* ── Your receiving addresses ────────────────────────────────────── */
  /* Connected wallets are read from WL every time rather than copied, so
     disconnecting a wallet removes it from here too. */
  function connectedOwn() {
    if (typeof WL === 'undefined' || !WL.accounts) return [];
    return WL.accounts()
      // Cosmos addresses can't be validated or used by the networks here, so
      // they stay in the Wallet tab rather than being shown as payable.
      .filter(a => a.net !== 'cosmos' && (NETS[a.net] || a.net === 'simulated'))
      .map(a => ({
        id: 'wl:' + a.id,
        address: a.address,
        net: NETS[a.net] ? a.net : 'ethereum',
        label: ((WL.PROVIDERS && WL.PROVIDERS[a.provider]) ? WL.PROVIDERS[a.provider].label : (a.chain || 'Connected wallet')),
        source: 'connected',
        simulated: !!a.simulated,
        at: a.at || 0
      }));
  }

  function ownList() {
    const manual = (D.own || []).map(o => ({ ...o, source: 'added' }));
    const all = connectedOwn().concat(manual);
    const seen = {};
    return all.filter(a => {
      const k = a.net + ':' + String(a.address).toLowerCase();
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    }).sort((a, b) => (b.id === D.primary ? 1 : 0) - (a.id === D.primary ? 1 : 0));
  }

  const ownById = id => ownList().find(a => a.id === id) || null;

  /* Every address this device has used or saved - your own, the ones
     saved per chat, the ones you sent to or shared. A new address that
     matches one of these at both ends but not in the middle is how
     address poisoning works (SSF.lookalike). */
  function knownAddresses() {
    const out = ownList().map(a => a.address);
    Object.keys(D.peers || {}).forEach(k => (D.peers[k] || []).forEach(p => out.push(p.address)));
    Object.keys(D.sends || {}).forEach(k => out.push(D.sends[k].address));
    Object.keys(D.shares || {}).forEach(k => out.push(D.shares[k].address));
    return out.filter(Boolean);
  }

  /* The amount exactly as typed, in this coin's decimals on this network,
     or why it can't be (features/sendsafe.js). */
  function amountOf(amount, coin, net) {
    if (typeof SSF === 'undefined') {
      const n = parseFloat(amount);
      return n > 0 ? { ok: true, number: n, text: String(n) } : { ok: false, msg: 'Enter an amount.' };
    }
    return SSF.parseAmount(amount, SSF.decimalsFor(coin, net), coin);
  }

  function primaryOwn(netKey) {
    const list = ownList().filter(a => !a.simulated);
    if (netKey) {
      const onNet = list.filter(a => a.net === netKey);
      if (onNet.length) return onNet.find(a => a.id === D.primary) || onNet[0];
    }
    return list.find(a => a.id === D.primary) || list[0] || null;
  }

  function addOwn(netKey, address, label) {
    const net = NETS[netKey] ? netKey : 'ethereum';
    const a = String(address || '').trim();
    const v = validate(net, a);
    if (!v.ok) return v;

    const dupe = ownList().find(x => x.net === net && x.address.toLowerCase() === v.value.toLowerCase());
    if (dupe) return { ok: false, msg: 'That address is already saved on this network.' };

    const rec = { id: uid('a_'), net, address: v.value, label: clean(label, MAX_LABEL) || (netOf(net).label + ' wallet'),
                  source: 'added', simulated: false, at: Date.now() };
    D.own.push(rec);
    if (!D.primary) D.primary = rec.id;
    save();
    return { ok: true, id: rec.id, warn: v.warn, msg: 'Receiving address saved.' };
  }

  function removeOwn(id) {
    if (String(id).indexOf('wl:') === 0) {
      toast('That address comes from a connected wallet — disconnect it in Wallet to remove it.');
      return;
    }
    const i = D.own.findIndex(o => o.id === id);
    if (i < 0) return;
    D.own.splice(i, 1);
    if (D.primary === id) D.primary = '';
    save();
    render();
    toast('Address removed.');
  }

  function setPrimary(id) {
    if (!ownById(id)) return;
    D.primary = id;
    save();
    render();
    toast('Default receiving address updated.');
  }

  /* ── Their addresses, per conversation ───────────────────────────── */
  /* Only what the user saved themselves. The seed contacts carry fake
     truncated addresses for the profile UI; those never appear here, because
     a fabricated destination is a way to lose real money. */
  const peerKey = chatId => 'c' + String(chatId);
  const peerList = chatId => (D.peers[peerKey(chatId)] || []).slice();

  function addPeer(chatId, netKey, address, label) {
    const net = NETS[netKey] ? netKey : 'ethereum';
    const a = String(address || '').trim();
    const v = validate(net, a);
    if (!v.ok) return v;

    const k = peerKey(chatId);
    D.peers[k] = D.peers[k] || [];
    if (D.peers[k].some(p => p.net === net && p.address.toLowerCase() === v.value.toLowerCase())) {
      return { ok: false, msg: 'That address is already saved for this chat.' };
    }
    const rec = { id: uid('p_'), net, address: v.value, label: clean(label, MAX_LABEL) || (firstName(chatId) + '’s ' + netOf(net).label), at: Date.now() };
    D.peers[k].push(rec);
    save();
    return { ok: true, id: rec.id, warn: v.warn, msg: `Saved for ${firstName(chatId)}.` };
  }

  function removePeer(chatId, id) {
    const k = peerKey(chatId);
    D.peers[k] = (D.peers[k] || []).filter(p => p.id !== id);
    save();
    render();
  }

  /* ── URIs and QR codes ───────────────────────────────────────────── */
  /* The QR holds the plain address: every wallet app reads that, while URI
     schemes vary. The URI is used only for the "open in wallet" button, and
     only for the chain's own coin, with the amount written exactly
     (SSF.walletURI). A token send gets no link: without a contract address,
     which this app has no business guessing, the link would open a send of
     the chain's own coin - ETH instead of USDT. */
  function walletURI(netKey, address, coin, amount) {
    if (typeof SSF !== 'undefined') return SSF.walletURI(NETS[netKey] ? netKey : 'ethereum', address, coin, amount);
    const n = netOf(netKey);
    const amt = parseFloat(amount) > 0 ? parseFloat(amount) : 0;
    const native = amt && coin === n.symbol;
    if (n.family === 'evm') return `ethereum:${address}@${n.chainId}` + (native ? `?value=${amt}e18` : '');
    if (n.family === 'bitcoin') return `bitcoin:${address}` + (native ? `?amount=${amt}` : '');
    if (n.family === 'solana') return `solana:${address}` + (native ? `?amount=${amt}` : '');
    if (n.family === 'dogecoin' || n.family === 'litecoin') return `${n.family}:${address}` + (native ? `?amount=${amt}` : '');
    if (n.family === 'bitcoincash') return (address.indexOf(':') > -1 ? address : `bitcoincash:${address}`) + (native ? `?amount=${amt}` : '');
    return address;
  }

  function qrHTML(address, px) {
    if (typeof QRGEN === 'undefined') return '<div class="pay-empty">QR codes are unavailable right now.</div>';
    try { return QRGEN.svg(QRGEN.make(String(address)), px || 200, ''); }
    catch (e) { return '<div class="pay-empty">This address is too long to render as a code.</div>'; }
  }

  function copy(text, what) {
    const t = String(text || '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(() => toast((what || 'Address') + ' copied'), () => toast(t));
    } else toast(t);
  }

  const copyAddr = id => { const a = ownById(id); if (a) copy(a.address, 'Address'); };
  const copyText = t => copy(t, 'Address');

  /* ── Cards in the thread ─────────────────────────────────────────── */
  /* Cards hold a record id, not the record — the same pattern PAY uses, so
     status stays in one place instead of being copied into chat history. */
  function shareAddress(chatId, ownId, coin, amount, note) {
    const a = ownById(ownId);
    if (!a) return { ok: false, msg: 'Pick an address first.' };
    if (a.simulated) return { ok: false, msg: 'That is a simulated wallet — it can’t receive anything. Add or connect a real one.' };

    // An amount is optional here; if one is given it has to be a real one.
    const sym = String(coin || coinsFor(a.net)[0]).toUpperCase();
    const typed = String(amount == null ? '' : amount).trim();
    const parsed = typed ? amountOf(typed, sym, a.net) : null;
    if (parsed && !parsed.ok && !parsed.zero) return { ok: false, msg: parsed.msg };
    const amt = parsed && parsed.ok ? parsed.number : 0;
    const rec = {
      id: uid('s_'), chatId: String(chatId), net: a.net, address: a.address, label: a.label,
      coin: amt ? sym : '', amount: amt, amountText: amt ? parsed.text : '',
      note: clean(note, MAX_NOTE), at: Date.now()
    };
    D.shares[rec.id] = rec;
    save();
    post(chatId, { kind: 'wadaddr', me: true, sid: rec.id });
    return { ok: true, msg: amt ? `Asked ${firstName(chatId)} for ${qty(amt)} ${rec.coin}` : 'Address shared in the chat' };
  }

  function askForAddress(chatId, netKey) {
    const rec = { id: uid('k_'), chatId: String(chatId), net: NETS[netKey] ? netKey : 'ethereum', at: Date.now(), status: 'waiting' };
    D.asks[rec.id] = rec;
    save();
    post(chatId, { kind: 'wadask', me: true, aid: rec.id });
    return { ok: true, msg: `Asked ${firstName(chatId)} for a ${netOf(rec.net).label} address` };
  }

  /* An outgoing transfer is a note-to-self with a checklist, not a payment:
     Trending cannot send it, so the record starts life as "not sent yet" and
     only the user can move it forward. */
  function trackSend(chatId, netKey, address, coin, amount, note) {
    const net = NETS[netKey] ? netKey : 'ethereum';
    const v = validate(net, address);
    if (!v.ok) return v;
    const sym = String(coin || coinsFor(net)[0]).toUpperCase();
    const amt = amountOf(amount, sym, net);
    if (!amt.ok) return { ok: false, msg: amt.msg };

    const rec = {
      id: uid('t_'), chatId: String(chatId), net, address: v.value,
      coin: sym, amount: amt.number, amountText: amt.text,
      note: clean(note, MAX_NOTE), status: 'todo', txid: '', at: Date.now()
    };
    D.sends[rec.id] = rec;
    save();
    post(chatId, { kind: 'wadsend', me: true, tid: rec.id });
    return { ok: true, id: rec.id, msg: 'Added to the chat — finish it in your wallet app.' };
  }

  function markSent(id) {
    const r = D.sends[id];
    if (!r || r.status === 'sent') return;
    const ask = txHash => {
      r.txid = clean(txHash, 90);
      r.status = 'sent';
      r.sentAt = Date.now();
      save();
      repaintChat();
      render();
      toast('Marked as sent.');
    };
    if (typeof appPrompt === 'function') {
      appPrompt('Paste the transaction ID from your wallet, or leave it blank.', '', {
        title: 'Mark as sent', ok: 'Mark as sent'
      }).then(v => { if (v !== null && v !== false) ask(v); });
    } else ask('');
  }

  function cancelSend(id) {
    const r = D.sends[id];
    if (!r || r.status === 'sent') return;
    r.status = 'cancelled';
    save();
    repaintChat();
    toast('Marked as cancelled. Nothing was sent by Trending either way.');
  }

  function explorerFor(kind, netKey, value) {
    const n = netOf(netKey);
    const base = kind === 'tx' ? n.tx : n.addr;
    return base + encodeURIComponent(String(value || ''));
  }

  function openExplorer(kind, netKey, value) {
    const url = explorerFor(kind, netKey, value);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /* ── Card rendering ──────────────────────────────────────────────── */
  const KINDS = { wadaddr: 1, wadask: 1, wadsend: 1 };

  function previewOf(fi) {
    if (!fi) return '';
    if (fi.kind === 'wadaddr') {
      const r = D.shares[fi.sid];
      return r && r.amount ? `Requested ${qty(r.amount)} ${r.coin} on-chain` : 'Shared a wallet address';
    }
    if (fi.kind === 'wadask') return 'Asked for a wallet address';
    if (fi.kind === 'wadsend') {
      const r = D.sends[fi.tid];
      return r ? `On-chain transfer — ${qty(r.amount)} ${r.coin}` : 'On-chain transfer';
    }
    return '';
  }

  function cardHTML(fi) {
    if (!fi) return '';
    if (fi.kind === 'wadaddr') return addrCard(fi);
    if (fi.kind === 'wadask') return askCard(fi);
    if (fi.kind === 'wadsend') return sendCard(fi);
    return '';
  }

  const gone = text => `<div class="cfi-card wad-card"><div class="cfi-sub">${esc(text)}</div></div>`;

  function addrCard(fi) {
    const r = D.shares[fi.sid];
    if (!r) return gone('This address card was removed.');
    const n = netOf(r.net);
    const value = r.amount ? usd(r.amount * priceOf(r.coin)) : '';
    return `<div class="cfi-card wad-card">
      <div class="cfi-head">
        <span class="material-symbols-rounded ms-16 tc-purple">account_balance_wallet</span>
        <span class="cfi-label">${r.amount ? 'Payment request · on-chain' : 'My wallet address'}</span>
      </div>
      ${r.amount ? `<div class="cfi-amt">${ic(r.coin, 22)}<span>${esc(qty(r.amount))} ${esc(r.coin)}</span></div>
        <div class="cfi-sub">${value ? esc(value) + ' · ' : ''}send on ${esc(n.label)}${r.note ? ' · ' + esc(r.note) : ''}</div>` : ''}
      <div class="wad-netrow">${netChip(r.net)}<span class="wad-lbl">${esc(r.label)}</span></div>
      <button type="button" class="wad-addrbox" onclick="WAD.copyText('${esc(r.address)}')" title="Copy address">
        ${chunked(r.address)}<span class="material-symbols-rounded ms-16">content_copy</span>
      </button>
      <div class="cfi-foot wad-foot">
        <button class="btn btn-sm btn-ghost" onclick="WAD.copyText('${esc(r.address)}')">
          <span class="material-symbols-rounded ms-16">content_copy</span> Copy</button>
        <button class="btn btn-sm btn-ghost" onclick="WAD.openShare('${esc(r.id)}')">
          <span class="material-symbols-rounded ms-16">qr_code_2</span> QR</button>
      </div>
      <div class="wad-mini">Only ${esc(n.label)} (${esc(n.tag)}) assets reach this address.</div>
    </div>`;
  }

  function askCard(fi) {
    const r = D.asks[fi.aid];
    if (!r) return gone('This request was removed.');
    const saved = peerList(r.chatId).length;
    return `<div class="cfi-card wad-card">
      <div class="cfi-head">
        <span class="material-symbols-rounded ms-16 tc-blue">contact_page</span>
        <span class="cfi-label">Asked for a wallet address</span>
      </div>
      <div class="cfi-sub">${esc(netOf(r.net).label)} · so crypto can be sent on-chain</div>
      <div class="cfi-foot wad-foot">
        ${saved
          ? '<span class="cfi-pill ok">Address saved</span>'
          : '<span class="cfi-pill wait">Waiting for their reply</span>'}
        <button class="btn btn-sm btn-ghost" onclick="WAD.open(${esc(JSON.stringify(String(r.chatId)))}, 'peer', { origin: 'chat' })">
          <span class="material-symbols-rounded ms-16">add</span> Save their address</button>
      </div>
      <div class="wad-mini">Trending won’t fill this in for them — an address has to come from ${esc(firstName(r.chatId))}, and you should check it with them before sending.</div>
    </div>`;
  }

  function sendCard(fi) {
    const r = D.sends[fi.tid];
    if (!r) return gone('This transfer note was removed.');
    const n = netOf(r.net);
    const pill = r.status === 'sent' ? '<span class="cfi-pill ok">Marked as sent</span>'
      : r.status === 'cancelled' ? '<span class="cfi-pill bad">Cancelled</span>'
      : '<span class="cfi-pill wait">Not sent yet</span>';
    const value = usd(r.amount * priceOf(r.coin));
    return `<div class="cfi-card wad-card">
      <div class="cfi-head">
        <span class="material-symbols-rounded ms-16 tc-green">north_east</span>
        <span class="cfi-label">On-chain transfer</span>
      </div>
      <div class="cfi-amt">${ic(r.coin, 22)}<span>${esc(qty(r.amount))} ${esc(r.coin)}</span></div>
      <div class="cfi-sub">${value ? esc(value) + ' · ' : ''}${esc(n.label)}${r.note ? ' · ' + esc(r.note) : ''}</div>
      <div class="wad-netrow">${netChip(r.net)}</div>
      <button type="button" class="wad-addrbox" onclick="WAD.copyText('${esc(r.address)}')" title="Copy address">
        ${chunked(r.address)}<span class="material-symbols-rounded ms-16">content_copy</span>
      </button>
      ${r.status === 'sent' && r.txid
        ? `<button class="wad-tx" onclick="WAD.openExplorer('tx','${esc(r.net)}','${esc(r.txid)}')">
             <span class="material-symbols-rounded ms-16">open_in_new</span> ${esc(shortAddr(r.txid))}</button>`
        : ''}
      <div class="cfi-foot wad-foot">
        ${pill}
        ${r.status === 'todo'
          ? `<button class="btn btn-sm btn-primary" onclick="WAD.markSent('${esc(r.id)}')">Mark as sent</button>
             <button class="btn btn-sm btn-ghost" onclick="WAD.cancelSend('${esc(r.id)}')">Cancel</button>`
          : ''}
      </div>
      <div class="wad-mini">Trending doesn’t move this — you send it from your own wallet app. This card is the record.</div>
    </div>`;
  }

  /* CFI hands unknown card kinds to PAY; both are wrapped so the new kinds
     render and everything else keeps its existing path untouched. */
  function installCards() {
    if (typeof CFI !== 'undefined' && CFI.cardHTML && !CFI.cardHTML.__wad) {
      const prev = CFI.cardHTML;
      const next = fi => (fi && KINDS[fi.kind] ? cardHTML(fi) : prev(fi));
      next.__wad = true;
      CFI.cardHTML = next;
    }
    if (typeof PAY !== 'undefined' && PAY.previewOf && !PAY.previewOf.__wad) {
      const prev = PAY.previewOf;
      const next = fi => (fi && KINDS[fi.kind] ? previewOf(fi) : prev(fi));
      next.__wad = true;
      PAY.previewOf = next;
    }
    if (typeof PAY !== 'undefined' && PAY.cardHTML && !PAY.cardHTML.__wad) {
      const prev = PAY.cardHTML;
      const next = fi => (fi && KINDS[fi.kind] ? cardHTML(fi) : prev(fi));
      next.__wad = true;
      PAY.cardHTML = next;
    }
  }

  /* ── Sheet ───────────────────────────────────────────────────────── */
  let V = null;

  const TITLES = {
    home: 'Wallet addresses', mine: 'My receiving addresses', add: 'Add a receiving address',
    share: 'Receive to my wallet', send: 'Send to an address', review: 'Check before you send',
    peer: 'Save their address'
  };

  /* Navigation. `trail` holds the screens behind this one; `origin` is
     where Back goes once it's empty:
       cfi  — chat crypto (the menu, the panel): back to the Chat Crypto
              panel, restored as it was (`cfi` holds its state)
       chat — a card in the thread: back to the thread                   */
  function open(chatId, view, opts) {
    const menu = document.getElementById('chat-attach-menu');
    if (menu) menu.classList.add('hidden');
    const o = opts || {};
    V = { view: view || 'home', trail: [], origin: o.origin || 'cfi', cfi: o.cfi || null, hint: o.hint || '',
          chatId: chatId != null ? chatId : activeChat(),
          net: 'ethereum', address: '', label: '', coin: 'USDT', amount: '', note: '',
          ownId: (primaryOwn() || {}).id || '', peerId: '', err: '', warn: '', speed: 'standard' };
    if (V.view === 'send') preselectPeer();
    render();
  }

  const openMine = () => open(activeChat(), 'mine');
  const openReceive = () => open(activeChat(), 'share');

  function openShare(sid) {
    const r = D.shares[sid];
    if (!r) return;
    V = { view: 'share', trail: [], origin: 'chat', cfi: null, hint: '', chatId: r.chatId, net: r.net, address: r.address, label: r.label,
          coin: r.coin || 'USDT', amount: r.amount ? (r.amountText || (typeof SSF !== 'undefined' ? SSF.parseAmount(r.amount, SSF.decimalsFor(r.coin, r.net), r.coin).text || '' : String(r.amount))) : '', note: r.note || '',
          ownId: (ownList().find(a => a.address === r.address && a.net === r.net) || {}).id || '', err: '', warn: '' };
    render();
  }

  /* Opened from the chat crypto panel's "Wallet address" option. It lands on
     the on-chain page, with the matching action marked and whatever was
     typed in the panel carried over; Back returns to the panel as it was. */
  function fromChat(kind, coin, amount) {
    const sheet = (typeof CFI !== 'undefined' && CFI.sheet) ? { ...CFI.sheet } : null;
    const chatId = (sheet && sheet.chatId) || activeChat();
    const c = String(coin || (sheet && sheet.coin) || 'USDT').toUpperCase();
    const amt = amount != null ? amount : (sheet ? sheet.amount : '');
    if (typeof CFI !== 'undefined' && CFI.close) CFI.close();
    openFor(kind === 'request' ? 'share' : 'send', { chatId, origin: 'cfi', cfi: sheet, coin: c, amount: amt });
  }

  /* Straight to sending or receiving on-chain, with the coin and amount
     already chosen elsewhere carried over. It used to land on an overview
     that explained both routes a second time and made you pick again.
     The network follows the coin: BTC means Bitcoin, SOL means Solana. */
  function openFor(view, o) {
    const v = view === 'share' ? 'share' : 'send';
    const c = String(o.coin || 'USDT').toUpperCase();
    open(o.chatId != null ? o.chatId : activeChat(), v, { origin: o.origin || 'chat', cfi: o.cfi || null, hint: v });
    if (coinsFor(V.net).indexOf(c) === -1) {
      const k = NET_KEYS.find(n => coinsFor(n).indexOf(c) !== -1);
      if (k && !V.peerId) V.net = k;
      else if (!k) toast(`${c} can't be sent on-chain from here — pick a coin this network carries.`);
    }
    V.coin = c;
    if (v === 'share') {
      const own = ownList().filter(a => !a.simulated);
      const match = own.find(a => coinsFor(a.net).indexOf(c) !== -1);
      if (match) V.ownId = match.id;
    }
    V.amount = parseFloat(o.amount) > 0 ? String(o.amount) : '';
    render();
  }

  /* A scanned QR that holds a wallet address rather than a Trending code. */
  function parseScan(text) {
    const raw = String(text || '').trim();
    let m = raw.match(/^ethereum:(0x[0-9a-fA-F]{40})(?:@(\d+))?/i);
    if (m) {
      const chain = parseInt(m[2] || '1', 10);
      const net = NET_KEYS.find(k => NETS[k].chainId === chain) || 'ethereum';
      return validate(net, m[1]).ok ? { net, address: m[1], coin: '', amount: '' } : null;
    }
    m = raw.match(/^(bitcoin|solana):([^?\s]+)(?:\?(.*))?$/i);
    if (m) {
      const net = m[1].toLowerCase();
      const amt = new URLSearchParams(m[3] || '').get('amount') || '';
      return validate(net, m[2]).ok ? { net, address: m[2], coin: NETS[net].symbol, amount: parseFloat(amt) > 0 ? amt : '' } : null;
    }
    const nets = detectNets(raw);
    return nets.length && validate(nets[0], raw).ok ? { net: nets[0], address: raw, coin: '', amount: '' } : null;
  }

  function fromScan(p, opts) {
    const o = opts || {};
    open(activeChat(), 'send', { origin: o.origin || 'chat', cfi: o.cfi || null });
    V.net = p.net; V.address = p.address; V.peerId = '';
    if (p.coin) V.coin = p.coin;
    if (coinsFor(V.net).indexOf(V.coin) === -1) V.coin = coinsFor(V.net)[0];
    if (p.amount) V.amount = String(p.amount);
    render();
    toast(`Scanned a ${netOf(p.net).label} address — check it before you send.`);
  }

  function preselectPeer() {
    if (!V || V.address || !V.chatId) return;
    const saved = peerList(V.chatId);
    if (saved.length) {
      V.peerId = saved[0].id; V.net = saved[0].net; V.address = saved[0].address;
      if (coinsFor(V.net).indexOf(V.coin) === -1) V.coin = coinsFor(V.net)[0];
    }
  }

  function go(view, patch) {
    if (!V) return;
    const p = { ...(patch || {}) };
    const replace = !!p.replace;
    delete p.replace;
    const trail = (V.trail || []).slice();
    if (!replace && V.view && V.view !== view) trail.push(V.view);
    V = { ...V, ...p, view, trail, err: '', warn: '' };
    if (view === 'send') preselectPeer();
    render();
  }

  /* One screen back; with nothing behind, back to where the sheet came from.
     `patch` lands on the screen being returned to. */
  function back(patch) {
    if (!V) return;
    const trail = (V.trail || []).slice();
    if (!trail.length) { leave(); return; }
    const view = trail.pop();
    V = { ...V, err: '', warn: '', ...(patch || {}), view, trail };
    render();
  }

  function leave() {
    const origin = V ? V.origin : 'chat';
    const snap = V ? V.cfi : null;
    close();
    if (origin === 'cfi' && typeof CFI !== 'undefined' && CFI.restore) CFI.restore(snap);
    else if (origin === 'pay' && typeof PAY !== 'undefined' && PAY.openHub) PAY.openHub();
  }

  /* After saving: back to the screen that asked for it, or on to `view`. */
  function returnTo(view, patch) {
    if (V && (V.trail || []).length) back(patch);
    else go(view, { ...(patch || {}), replace: true });
  }

  const hasBack = () => !!V && (V.view !== 'home' || (V.trail || []).length > 0 || (V.origin === 'cfi' && !!V.chatId));

  /* "Use in-app send/request": the same step, in the Trending lane. */
  function toInApp() {
    const snap = V ? V.cfi : null, chatId = V ? V.chatId : null;
    const receiving = !!V && (V.view === 'share' || V.hint === 'share');
    const coin = V ? V.coin : 'USDT', amount = V ? V.amount : '';
    close();
    if (typeof PAY === 'undefined') return;
    if (chatId == null) {
      // Not in a chat: the same step in Pay, where you choose who.
      if (receiving) PAY.openRequestFor('');
      else PAY.openPayTo({ asset: coin, amount });
      return;
    }
    if (receiving && PAY.openRequestForChat) {
      PAY.openRequestForChat(chatId, { origin: 'cfi', cfi: snap });
      return;
    }
    if (typeof CFI !== 'undefined' && CFI.restore) CFI.restore(snap ? { ...snap, kind: 'send' } : { kind: 'send', chatId });
  }

  /* The route this sheet is, with the free one a tap away: the same two
     cards every payment screen shows (features/payflow.js). */
  function lanesFor(kind) {
    if (typeof PF === 'undefined') return '';
    return PF.lanes({ kind, active: 'chain', who: V.chatId ? peerName(V.chatId) : '', onApp: 'WAD.toInApp()' });
  }

  function pickSpeed(sp) {
    if (!V) return;
    V.speed = sp;
    render();
  }

  const isToken = () => V.coin !== netOf(V.net).symbol;

  function f(key, value, repaint) {
    if (!V) return;
    V[key] = value;
    if (key === 'net' && COINS[netOf(value).family] && coinsFor(value).indexOf(V.coin) === -1) V.coin = coinsFor(value)[0];
    if (repaint) render();
  }

  /* Typing an address suggests its network, so the commonest mistake —
     right address, wrong chain — gets caught before anything is saved. */
  function onAddress(value) {
    if (!V) return;
    V.address = value;
    const guess = detectNets(value);
    if (guess.length && guess.indexOf(V.net) === -1) {
      V.net = guess[0];
      if (coinsFor(V.net).indexOf(V.coin) === -1) V.coin = coinsFor(V.net)[0];
      render();
      const box = document.getElementById('wad-address');
      if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
    } else {
      const hint = document.getElementById('wad-guess');
      if (hint) hint.textContent = guess.length ? `Looks like ${netOf(guess[0]).label}.` : '';
    }
  }

  function close() {
    const s = document.getElementById('wad-scrim');
    if (s) s.remove();
    V = null;
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !V || !document.getElementById('wad-scrim')) return;
    if (document.querySelector('.mob-dialog-scrim') || document.getElementById('wl-modal')) return;
    e.preventDefault();
    e.stopPropagation();
    back();
  }, true);

  function render() {
    if (!V) return;
    let scrim = document.getElementById('wad-scrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.id = 'wad-scrim';
      scrim.className = 'pay-scrim';
      scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
      document.body.appendChild(scrim);
    }
    scrim.innerHTML = `<div class="pay-card" role="dialog" aria-label="Wallet addresses">
      <div class="pay-head">
        ${hasBack()
          ? `<button class="icon-btn" onclick="WAD.back()" aria-label="Back"><span class="material-symbols-rounded ms-18">arrow_back</span></button>`
          : '<div class="pay-kicker">ON-CHAIN</div>'}
        <h3 class="pay-title">${esc(TITLES[V.view] || 'Wallet addresses')}</h3>
        <button class="icon-btn" onclick="WAD.close()" aria-label="Close"><span class="material-symbols-rounded ms-18">close</span></button>
      </div>
      <div class="pay-body">${bodyHTML()}</div>
    </div>`;
  }

  function bodyHTML() {
    switch (V.view) {
      case 'mine':   return mineView();
      case 'add':    return addView();
      case 'share':  return shareView();
      case 'send':   return sendView();
      case 'review': return reviewView();
      case 'peer':   return peerView();
      default:       return homeView();
    }
  }

  const errHTML = () => (V.err ? `<div class="wad-err">${esc(V.err)}</div>` : '');

  const SAFETY = `<div class="wad-safe">
    <span class="material-symbols-rounded ms-16">shield</span>
    <div><b>Trending never holds your keys.</b> It stores addresses so you can share them, and it never asks for a
    recovery phrase or a private key. An on-chain transfer is signed in your own wallet app and cannot be undone by anyone.</div>
  </div>`;

  /* ── Home ────────────────────────────────────────────────────────── */
  function homeView() {
    const chatId = V.chatId;
    const who = chatId ? firstName(chatId) : '';
    const mine = ownList();
    const real = mine.filter(a => !a.simulated);
    const theirs = chatId ? peerList(chatId) : [];

    return `
      <div class="wad-lanes">
        <div class="wad-lane">
          <div class="wad-lane-h"><span class="material-symbols-rounded ms-18 tc-purple">bolt</span> Trending balance</div>
          <p>Moves your in-app balance to ${chatId ? esc(who) + '’s' : 'another'} Trending account straight away. Instant,
          free, and no address needed.</p>
          ${chatId ? `<button class="btn btn-sm btn-ghost" onclick="WAD.toInApp()">${V.hint === 'share' ? 'Use in-app request' : 'Use in-app send'}</button>` : ''}
        </div>
        <div class="wad-lane active">
          <div class="wad-lane-h"><span class="material-symbols-rounded ms-18 tc-green">link</span> Crypto wallet</div>
          <p>A real on-chain transfer to a wallet address, with a network fee. Trending holds the address, the QR and the
          record; your wallet app signs and sends it.</p>
        </div>
      </div>

      ${V.hint ? `<div class="wad-carry"><span class="material-symbols-rounded ms-16">north_west</span>
        <span>${parseFloat(V.amount) > 0 ? `${esc(qty(parseFloat(V.amount)))} ${esc(V.coin)} carried over · ` : ''}choose <b>${V.hint === 'share' ? 'Receive' : 'Send'}</b> to continue on-chain</span></div>` : ''}
      <div class="pay-tiles">
        <button class="pay-tile${V.hint === 'share' ? ' wad-suggest' : ''}" onclick="WAD.go('share')">
          <span class="material-symbols-rounded">qr_code_2</span><span>Receive</span></button>
        <button class="pay-tile${V.hint === 'send' ? ' wad-suggest' : ''}" onclick="WAD.go('send')">
          <span class="material-symbols-rounded">north_east</span><span>Send</span></button>
        ${chatId ? `<button class="pay-tile" onclick="WAD.ask()">
          <span class="material-symbols-rounded">contact_page</span><span>Ask for theirs</span></button>` : ''}
      </div>

      <div class="pay-sec">My receiving addresses
        <button class="pay-link" onclick="WAD.go('mine')">Manage</button></div>
      ${real.length
        ? real.slice(0, 3).map(a => ownRow(a, false)).join('')
        : `<div class="pay-empty">No receiving address yet. Add one you own, or connect a wallet — Trending only ever reads the public address.</div>`}
      <div class="pay-actions">
        <button class="btn btn-ghost" onclick="WAD.go('add')">
          <span class="material-symbols-rounded ms-18">add</span> Add address</button>
        <button class="btn btn-ghost" onclick="WAD.connectWallet()">
          <span class="material-symbols-rounded ms-18">account_balance_wallet</span> Connect wallet</button>
      </div>

      ${chatId ? `<div class="pay-sec">${esc(who)}’s addresses
        <button class="pay-link" onclick="WAD.go('peer')">Add</button></div>
      ${theirs.length
        ? theirs.map(p => peerRow(p)).join('')
        : `<div class="pay-empty">Nothing saved for ${esc(who)}. Ask them to send their address in the chat, check it with them,
           then save it here. Trending will never fill in someone else’s address for you.</div>`}` : ''}

      ${SAFETY}`;
  }

  function ownRow(a, manage) {
    const n = netOf(a.net);
    return `<div class="wad-row${a.simulated ? ' sim' : ''}">
      <span class="wad-dot" style="background:${n.color}"></span>
      <div class="wad-row-main">
        <div class="wad-row-top">
          <b>${esc(a.label)}</b>
          <span class="wad-src">${a.source === 'connected' ? (a.simulated ? 'Simulated' : 'Connected') : 'Added by you'}</span>
        </div>
        <div class="wad-row-sub">${esc(n.label)} · ${esc(shortAddr(a.address))}</div>
      </div>
      ${a.simulated
        ? '<span class="wad-simtag" title="A demo wallet — it can’t receive anything">demo</span>'
        : `<button class="icon-btn" onclick="WAD.share('${esc(a.id)}')" title="Show code and share"><span class="material-symbols-rounded ms-18">qr_code_2</span></button>
           <button class="icon-btn" onclick="WAD.copyAddr('${esc(a.id)}')" title="Copy address"><span class="material-symbols-rounded ms-18">content_copy</span></button>`}
      ${manage && !a.simulated
        ? `<button class="icon-btn" onclick="WAD.setPrimary('${esc(a.id)}')" title="Make default">
             <span class="material-symbols-rounded ms-18">${D.primary === a.id ? 'star' : 'star_border'}</span></button>` : ''}
      ${manage && a.source === 'added'
        ? `<button class="icon-btn" onclick="WAD.removeOwn('${esc(a.id)}')" title="Remove"><span class="material-symbols-rounded ms-18">delete</span></button>` : ''}
    </div>`;
  }

  function peerRow(p) {
    const n = netOf(p.net);
    return `<div class="wad-row">
      <span class="wad-dot" style="background:${n.color}"></span>
      <div class="wad-row-main">
        <div class="wad-row-top"><b>${esc(p.label)}</b></div>
        <div class="wad-row-sub">${esc(n.label)} · ${esc(shortAddr(p.address))}</div>
      </div>
      <button class="icon-btn" onclick="WAD.usePeer('${esc(p.id)}')" title="Send to this address"><span class="material-symbols-rounded ms-18">north_east</span></button>
      <button class="icon-btn" onclick="WAD.removePeer('${esc(p.id)}')" title="Remove"><span class="material-symbols-rounded ms-18">delete</span></button>
    </div>`;
  }

  /* ── My addresses ────────────────────────────────────────────────── */
  function mineView() {
    const mine = ownList();
    return `
      ${mine.length
        ? mine.map(a => ownRow(a, true)).join('')
        : '<div class="pay-empty">No addresses yet.</div>'}
      <div class="pay-actions">
        <button class="btn btn-primary" onclick="WAD.go('add')">
          <span class="material-symbols-rounded ms-18">add</span> Add address</button>
        <button class="btn btn-ghost" onclick="WAD.connectWallet()">
          <span class="material-symbols-rounded ms-18">account_balance_wallet</span> Connect wallet</button>
      </div>
      <div class="pay-hint">A connected wallet appears here automatically and disappears when you disconnect it.
      Demo wallets are marked and can’t be shared as a destination.</div>
      ${SAFETY}`;
  }

  /* ── Add an address ──────────────────────────────────────────────── */
  function netSelect(cur, handler) {
    return `<select class="pay-input" onchange="${handler}">
      ${NET_KEYS.map(k => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(NETS[k].label)} — ${esc(NETS[k].tag)}</option>`).join('')}
    </select>`;
  }

  function addView() {
    return `
      ${errHTML()}
      <label class="pay-lbl">Network</label>
      ${netSelect(V.net, "WAD.f('net', this.value, true)")}
      <label class="pay-lbl">Your address on ${esc(netOf(V.net).label)}</label>
      <textarea class="pay-input wad-input" id="wad-address" rows="2" spellcheck="false" autocapitalize="off" autocomplete="off"
        placeholder="Paste your receiving address" oninput="WAD.onAddress(this.value)">${esc(V.address)}</textarea>
      <div class="pay-hint sm" id="wad-guess"></div>
      <label class="pay-lbl">Label</label>
      <input class="pay-input" maxlength="${MAX_LABEL}" placeholder="e.g. Main wallet" value="${esc(V.label)}"
        oninput="WAD.f('label', this.value)">
      <button class="btn btn-primary w100 mt12" onclick="WAD.saveOwn()">Save address</button>
      <div class="wad-warn">
        <span class="material-symbols-rounded ms-16">warning</span>
        <div>Paste only a <b>public receiving address</b> — the one your wallet shows under “Receive”. Never paste a recovery
        phrase or a private key here or anywhere else; this app refuses them and cannot use them.</div>
      </div>`;
  }

  function saveOwn() {
    const box = document.getElementById('wad-address');
    const addr = box ? box.value : V.address;
    const r = addOwn(V.net, addr, V.label);
    if (!r.ok) {
      V.err = r.msg;
      if (r.secret) V.address = '';        // never keep or re-display a secret
      render();
      return;
    }
    toast(r.msg + (r.warn ? ' ' + r.warn : ''));
    returnTo('mine', { address: '', label: '', ownId: r.id });
  }

  /* ── Receive / share ─────────────────────────────────────────────── */
  function shareView() {
    const mine = ownList().filter(a => !a.simulated);
    if (!mine.length) {
      return `${lanesFor('request')}
        <div class="pay-empty">You need a receiving address first — one from your own wallet.</div>
        <div class="pay-actions">
          <button class="btn btn-primary" onclick="WAD.go('add')"><span class="material-symbols-rounded ms-18">add</span> Add address</button>
          <button class="btn btn-ghost" onclick="WAD.connectWallet()"><span class="material-symbols-rounded ms-18">account_balance_wallet</span> Connect wallet</button>
        </div>${SAFETY}`;
    }

    const sel = mine.find(a => a.id === V.ownId) || mine[0];
    V.ownId = sel.id;
    const n = netOf(sel.net);
    const amt = parseFloat(V.amount) > 0 ? parseFloat(V.amount) : 0;
    const coins = coinsFor(sel.net);
    if (coins.indexOf(V.coin) === -1) V.coin = coins[0];

    return `
      ${lanesFor('request')}
      <div class="pay-qrwrap">
        ${qrHTML(sel.address, 208)}
        <div class="pay-qr-name">${esc(sel.label)}</div>
        <div class="pay-qr-handle">${esc(n.label)} · ${esc(n.tag)}</div>
        <div class="pay-qr-amt" id="wad-amt">${amountLine()}</div>
      </div>

      <button type="button" class="wad-addrbox big" onclick="WAD.copyAddr('${esc(sel.id)}')" title="Copy address">
        ${chunked(sel.address)}<span class="material-symbols-rounded ms-16">content_copy</span>
      </button>

      ${mine.length > 1 ? `<label class="pay-lbl">Receive into</label>
        <select class="pay-input" onchange="WAD.f('ownId', this.value, true)">
          ${mine.map(a => `<option value="${esc(a.id)}"${a.id === sel.id ? ' selected' : ''}>${esc(a.label)} — ${esc(netOf(a.net).label)}</option>`).join('')}
        </select>` : ''}

      <div class="pay-sec">Ask for an amount <span class="fs11 tc-3">(optional)</span></div>
      <div class="pay-row">
        <input class="pay-input" type="number" step="any" min="0" placeholder="0.00" value="${esc(V.amount)}"
          oninput="WAD.setAmount(this.value)">
        <select class="pay-input pay-asset" onchange="WAD.setAmount(null, this.value)">
          ${coins.map(c => `<option value="${c}"${c === V.coin ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <input class="pay-input mt8" maxlength="${MAX_NOTE}" placeholder="Note (optional)" value="${esc(V.note)}"
        oninput="WAD.f('note', this.value)">

      <div class="pay-actions">
        ${V.chatId ? `<button class="btn btn-primary" onclick="WAD.sendToChat()">
          <span class="material-symbols-rounded ms-18">send</span> Send to chat</button>` : ''}
        <button class="btn btn-ghost" onclick="WAD.copyAddr('${esc(sel.id)}')">
          <span class="material-symbols-rounded ms-18">content_copy</span> Copy address</button>
        <button class="btn btn-ghost" onclick="WAD.openExplorer('addr','${esc(sel.net)}','${esc(sel.address)}')">
          <span class="material-symbols-rounded ms-18">open_in_new</span> Explorer</button>
      </div>

      <div class="wad-warn">
        <span class="material-symbols-rounded ms-16">warning</span>
        <div>This address receives <b>${esc(n.label)} (${esc(n.tag)})</b> assets only. Coins sent on a different network are
        usually lost. The amount above is a message, not part of the code — the sender still types it in their wallet,
        and pays the network fee from it.</div>
      </div>`;
  }

  /* The amount is patched in place rather than re-rendered: rebuilding the
     sheet on every keystroke takes the focus out of the field mid-number. */
  function amountLine() {
    const amt = parseFloat(V.amount) > 0 ? parseFloat(V.amount) : 0;
    if (!amt) return '';
    const px = priceOf(V.coin);
    return `${esc(qty(amt))} ${esc(V.coin)}<span>${px ? ' · ' + esc(usd(amt * px)) : ''}</span>`;
  }

  function setAmount(amount, coin) {
    if (!V) return;
    if (amount != null) V.amount = amount;
    if (coin != null) V.coin = coin;
    const box = document.getElementById('wad-amt');
    if (box) box.innerHTML = amountLine();
  }

  function sendToChat() {
    if (!V || !V.chatId) return;
    const r = shareAddress(V.chatId, V.ownId, V.coin, V.amount, V.note);
    toast(r.msg);
    if (r.ok) close();
  }

  const share = id => { if (V) go('share', { ownId: id }); else { open(activeChat(), 'share'); V.ownId = id; render(); } };

  /* ── Send to an address ──────────────────────────────────────────── */
  function sendView() {
    const saved = V.chatId ? peerList(V.chatId) : [];
    const coins = coinsFor(V.net);
    if (coins.indexOf(V.coin) === -1) V.coin = coins[0];

    return `
      ${lanesFor('send')}
      ${errHTML()}
      ${saved.length ? `<label class="pay-lbl">Saved for ${esc(firstName(V.chatId))}</label>
        <div class="pay-chips">
          ${saved.map(p => `<button class="pay-chip${V.peerId === p.id ? ' active' : ''}" onclick="WAD.usePeer('${esc(p.id)}')">
            <span class="wad-dot" style="background:${netOf(p.net).color}"></span>${esc(p.label)}</button>`).join('')}
        </div>` : ''}

      <label class="pay-lbl">Network</label>
      ${netSelect(V.net, "WAD.f('net', this.value, true)")}

      <label class="pay-lbl">Destination address</label>
      <textarea class="pay-input wad-input" id="wad-address" rows="2" spellcheck="false" autocapitalize="off" autocomplete="off"
        placeholder="Paste the address they gave you" oninput="WAD.onAddress(this.value)">${esc(V.address)}</textarea>
      <div class="pay-hint sm" id="wad-guess"></div>

      <label class="pay-lbl">Amount</label>
      <div class="pay-row">
        <input class="pay-input" type="number" step="any" min="0" placeholder="0.00" value="${esc(V.amount)}"
          oninput="WAD.f('amount', this.value)">
        <select class="pay-input pay-asset" onchange="WAD.f('coin', this.value, true)">
          ${coins.map(c => `<option value="${c}"${c === V.coin ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <input class="pay-input mt8" maxlength="${MAX_NOTE}" placeholder="Note (optional)" value="${esc(V.note)}"
        oninput="WAD.f('note', this.value)">

      ${typeof PF !== 'undefined' ? PF.feeWidget({
        net: V.net, label: netOf(V.net).label, token: isToken(), coin: V.coin,
        speed: V.speed || 'standard', onPick: 'WAD.pickSpeed' }) : ''}

      <button class="btn btn-primary w100 mt12" onclick="WAD.toReview()">Continue</button>

      <div class="wad-warn">
        <span class="material-symbols-rounded ms-16">warning</span>
        <div>Only use an address the person gave you themselves, and confirm it with them somewhere else before you send —
        address swapping is the most common crypto scam. Trending never supplies someone else’s address.</div>
      </div>`;
  }

  function usePeer(id) {
    const list = peerList(V ? V.chatId : activeChat());
    const p = list.find(x => x.id === id);
    if (!p) return;
    const patch = { peerId: p.id, net: p.net, address: p.address };
    if (coinsFor(p.net).indexOf((V && V.coin) || 'USDT') === -1) patch.coin = coinsFor(p.net)[0];
    if (!V) { open(activeChat(), 'send'); Object.assign(V, patch); render(); }
    else if (V.view !== 'send') go('send', patch);
    else { Object.assign(V, patch); render(); }
  }

  function toReview() {
    const box = document.getElementById('wad-address');
    if (box) V.address = box.value;
    const v = validate(V.net, V.address);
    if (!v.ok) { V.err = v.msg; if (v.secret) V.address = ''; render(); return; }
    const amt = amountOf(V.amount, V.coin, V.net);
    if (!amt.ok) { V.err = amt.msg; render(); return; }
    const min = typeof SSF !== 'undefined' ? SSF.minimum(V.coin, V.net, amt, v) : {};
    if (min.refuse) { V.err = min.refuse; render(); return; }
    V.address = v.value;
    V.warn = v.warn || '';
    go('review', { warn: v.warn || '', minWarn: min.warn || '' });
  }

  function reviewView() {
    const n = netOf(V.net);
    const parsed = amountOf(V.amount, V.coin, V.net);
    const amt = parsed.ok ? parsed.number : 0;
    const uri = walletURI(V.net, V.address, V.coin, parsed.ok ? parsed.text : '');
    const scheme = uri && uri !== V.address ? uri : '';
    const known = V.chatId ? peerList(V.chatId).some(p => p.address.toLowerCase() === String(V.address).toLowerCase()) : false;
    const alike = typeof SSF !== 'undefined' ? SSF.lookalike(V.address, knownAddresses(), V.net) : null;
    const mine = ownList().find(a => a.address.toLowerCase() === String(V.address).toLowerCase());
    const gasNote = typeof SSF !== 'undefined' ? SSF.feeCoinNote(V.coin, V.net) : '';
    const cautions = [
      alike ? ['hard', '<b>This address looks like one you have used before, but it is not the same.</b> ' + esc(shortAddr(alike)) +
        ' matches it at both ends and differs in the middle. That is how address poisoning works: check every character with the person, not just the ends.'] : null,
      mine ? ['', 'That is one of your own addresses (' + esc(mine.label || 'saved') + '). Sending there moves the coins to yourself.'] : null,
      gasNote ? ['', esc(gasNote)] : null,
      V.minWarn ? ['', esc(V.minWarn)] : null
    ].filter(Boolean);

    return `
      <div class="wad-review">
        <div class="wad-rev-amt">${ic(V.coin, 26)}<span>${esc(qty(amt))} ${esc(V.coin)}</span></div>
        ${priceOf(V.coin) ? `<div class="pay-qr-handle">${esc(usd(amt * priceOf(V.coin)))}</div>` : ''}
        <div class="wad-netrow center">${netChip(V.net)}</div>
        <button type="button" class="wad-addrbox big" onclick="WAD.copyText('${esc(V.address)}')" title="Copy address">
          ${chunked(V.address)}<span class="material-symbols-rounded ms-16">content_copy</span>
        </button>
        ${V.warn ? `<div class="pay-hint sm">${esc(V.warn)}</div>` : ''}
      </div>

      ${reviewSum()}
      ${cautions.map(([cls, text]) => `<div class="wad-warn${cls ? ' ' + cls : ''}"><span class="material-symbols-rounded ms-16">warning</span><div>${text}</div></div>`).join('')}

      <div class="wad-check">
        <div><span class="material-symbols-rounded ms-16">check</span> <b>Every</b> character matches what they sent you, not just the ends. Look-alike addresses copy the ends.</div>
        <div><span class="material-symbols-rounded ms-16">check</span> They expect <b>${esc(V.coin)}</b> on <b>${esc(n.label)}</b>.</div>
        <div><span class="material-symbols-rounded ms-16">check</span> You confirmed the address with them somewhere other than this chat.</div>
      </div>

      <div class="pay-actions">
        <button class="btn btn-ghost" onclick="WAD.copyText('${esc(V.address)}')">
          <span class="material-symbols-rounded ms-18">content_copy</span> Copy address</button>
        ${scheme ? `<a class="btn btn-ghost" href="${esc(scheme)}">
          <span class="material-symbols-rounded ms-18">open_in_new</span> Open in wallet app</a>` : ''}
      </div>

      <details class="wad-qrfold">
        <summary>Show as a QR code</summary>
        <div class="pay-qrwrap">${qrHTML(V.address, 190)}
          <div class="pay-qr-handle">Scan from the wallet holding your ${esc(V.coin)}</div></div>
      </details>

      ${V.chatId && !known ? `<label class="wad-savebox">
        <input type="checkbox" id="wad-savepeer" checked> Save this address for ${esc(firstName(V.chatId))}
      </label>` : ''}

      ${V.chatId
        ? `<button class="btn btn-primary w100 mt12" onclick="WAD.confirmSend()">
             <span class="material-symbols-rounded ms-18">post_add</span> Add to chat as pending</button>`
        : `<button class="btn btn-primary w100 mt12" onclick="WAD.close()">Done</button>`}

      <div class="wad-warn">
        <span class="material-symbols-rounded ms-16">info</span>
        <div><b>Trending is not sending this.</b> Send it from your wallet app, then mark the card as sent. On-chain
        transfers can’t be reversed by Trending or by anyone else.</div>
      </div>`;
  }

  /* What this payment costs and what lands, in the same rows every
     payment ends with. The fee is the estimate for the speed picked on
     the previous screen; the wallet app has the final word on it. */
  function reviewSum() {
    if (typeof PF === 'undefined') return '';
    const n = netOf(V.net);
    const parsed = amountOf(V.amount, V.coin, V.net);
    const amt = parsed.ok ? parsed.number : 0;
    const token = isToken();
    if (!PF.cached(V.net, token)) PF.fee(V.net, token).then(() => { if (V && V.view === 'review') render(); });
    const fee = PF.feeLine(V.net, token, V.speed || 'standard');
    const usdAmt = PF.usdOf(amt, V.coin);
    const who = V.chatId ? firstName(V.chatId) : '';
    const rows = [
      ['You send', `${esc(qty(amt))} ${esc(V.coin)}${usdAmt ? ` <small>${esc(usdAmt)}</small>` : ''}`],
      ['Network fee', fee.tier
        ? `${esc(fee.text)}<small>${fee.usd ? esc(fee.usd) + ' · ' : ''}${esc(fee.speed)} · paid from your wallet</small>`
        : `<small>${esc(fee.text)}</small>`],
      [`${who || 'They'} receive${who ? 's' : ''}`, `${esc(qty(amt))} ${esc(V.coin)}`],
      ['Arrives', fee.eta ? esc(fee.eta) : 'When the network confirms it']
    ];
    if (fee.tier && !token) {
      const total = amt + parseFloat(fee.tier.amountMax || fee.tier.amount);
      rows.push(['Total from your wallet', `${esc(PF.coinAmt(total))} ${esc(n.symbol)}`, 'total']);
    }

    /* A fee that eats a real share of the payment deserves a sentence,
       and the free route deserves a mention next to it. */
    let warn = '';
    if (fee.tier && typeof MNY !== 'undefined') {
      const feeUsd = parseFloat(fee.tier.amountMax || fee.tier.amount) * MNY.price(fee.coin);
      const amtUsd = amt * MNY.price(V.coin);
      if (amtUsd > 0 && feeUsd / amtUsd >= 0.05) {
        warn = `<div class="pf-warn"><span class="material-symbols-rounded">warning</span><div>The network fee is about
          ${Math.round((feeUsd / amtUsd) * 100)}% of this payment.${V.chatId
            ? ` Paying ${esc(who)} from your Trending balance is free — <button type="button" class="pf-link" onclick="WAD.toInApp()">switch</button>.`
            : ''}</div></div>`;
      }
    }
    return PF.summary(rows) + warn;
  }

  function confirmSend() {
    const savebox = document.getElementById('wad-savepeer');
    const r = trackSend(V.chatId, V.net, V.address, V.coin, V.amount, V.note);
    if (!r.ok) { back({ err: r.msg }); return; }
    if (savebox && savebox.checked) addPeer(V.chatId, V.net, V.address, firstName(V.chatId) + '’s ' + netOf(V.net).label);
    toast(r.msg);
    close();
  }

  /* ── Save their address ──────────────────────────────────────────── */
  function peerView() {
    const who = firstName(V.chatId);
    const saved = peerList(V.chatId);
    return `
      ${errHTML()}
      ${saved.length ? saved.map(peerRow).join('') + '<div class="pay-sec">Add another</div>' : ''}
      <label class="pay-lbl">Network</label>
      ${netSelect(V.net, "WAD.f('net', this.value, true)")}
      <label class="pay-lbl">${esc(who)}’s address</label>
      <textarea class="pay-input wad-input" id="wad-address" rows="2" spellcheck="false" autocapitalize="off" autocomplete="off"
        placeholder="Paste the address they sent you" oninput="WAD.onAddress(this.value)">${esc(V.address)}</textarea>
      <div class="pay-hint sm" id="wad-guess"></div>
      <label class="pay-lbl">Label</label>
      <input class="pay-input" maxlength="${MAX_LABEL}" placeholder="${esc(who)}’s main wallet" value="${esc(V.label)}"
        oninput="WAD.f('label', this.value)">
      <button class="btn btn-primary w100 mt12" onclick="WAD.savePeer()">Save address</button>
      <div class="wad-warn">
        <span class="material-symbols-rounded ms-16">warning</span>
        <div>Check it with ${esc(who)} on a call or in person before you send anything. Malware and impersonators swap
        pasted addresses, and a transfer to the wrong one cannot be recovered.</div>
      </div>`;
  }

  function savePeer() {
    const box = document.getElementById('wad-address');
    const r = addPeer(V.chatId, V.net, box ? box.value : V.address, V.label);
    if (!r.ok) { V.err = r.msg; if (r.secret) V.address = ''; render(); return; }
    toast(r.msg);
    repaintChat();
    // Opened from the card in the thread: saved, so back to the thread.
    if (!(V.trail || []).length && V.origin === 'chat') { close(); return; }
    const toSend = (V.trail || [])[V.trail.length - 1] === 'send';
    const saved = peerList(V.chatId).find(x => x.id === r.id);
    returnTo('home', toSend && saved
      ? { peerId: saved.id, net: saved.net, address: saved.address, label: '' }
      : { address: '', label: '' });
  }

  function ask() {
    if (!V || !V.chatId) { toast('Open a conversation first.'); return; }
    const r = askForAddress(V.chatId, V.net);
    toast(r.msg);
    close();
  }

  function connectWallet() {
    if (typeof WL === 'undefined' || !WL.openChooser) { toast('Wallet connect is unavailable.'); return; }
    const keep = { ...V };
    close();
    WL.openChooser('connect');
    // Back to this screen once the chooser closes, connected or not.
    const started = Date.now();
    const iv = setInterval(() => {
      if (document.getElementById('wl-modal') && Date.now() - started < 15 * 60000) return;
      clearInterval(iv);
      if (V) return;                    // something else opened the sheet meanwhile
      V = { ...keep, err: '', warn: '' };
      render();
    }, 300);
  }

  /* ── The row shown inside the chat crypto panel ──────────────────── */
  /* Rendered by CFI's Send and Request forms so the two lanes are visible at
     the moment someone wonders where the address field went. */
  function destBar(kind, who) {
    const k = kind === 'request' ? 'request' : 'send';
    if (typeof PF !== 'undefined') return PF.lanes({ kind: k, active: 'app', who: who || '', onChain: `WAD.fromChat('${k}')` });
    return `<label class="cfi-lbl">Where does it go?</label>
      <div class="cfi-seg wad-seg">
        <button class="cfi-segbtn active" type="button" title="Moves your in-app balance">In Trending</button>
        <button class="cfi-segbtn" type="button" onclick="WAD.fromChat('${k}')" title="Uses a wallet address">Wallet address</button>
      </div>
      <div class="wad-segnote">In Trending moves the in-app balance instantly — no address needed.
      ${k === 'send' ? 'A wallet address is an on-chain transfer you finish in your own wallet app.'
                     : 'A wallet address shows them your address and QR to pay on-chain.'}</div>`;
  }

  /* ── Boot ────────────────────────────────────────────────────────── */
  function boot() {
    installCards();
    // CFI and PAY publish their card renderers as they load; re-wrap once
    // more after everything has settled so ordering can't matter.
    setTimeout(installCards, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);

  return {
    open, openMine, openReceive, openShare, openFor, close, go, back, f, onAddress, fromChat, toInApp, parseScan, fromScan, pickSpeed,
    knownAddresses, amountOf,
    saveOwn, savePeer, sendToChat, setAmount, toReview, confirmSend, usePeer, ask, connectWallet,
    share, copyAddr, copyText, setPrimary, removeOwn,
    removePeer: id => removePeer(V ? V.chatId : activeChat(), id),
    markSent, cancelSend, openExplorer,
    addOwn, addPeer, ownList, peerList, validate, detectNets, walletURI,
    shareAddress, askForAddress, trackSend, cardHTML, previewOf, destBar,
    NETS,
    get state() { return D; }
  };
})();

window.WAD = WAD;

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
publish('features/walletaddr.js', {
  WAD: () => WAD
});
