/* ╔══════════════════════════════════════════════════════════════════╗
   ║  ASSET LAB — Create Web3 Asset                                   ║
   ║                                                                  ║
   ║  Templates for issuing collectibles, membership tokens, access   ║
   ║  passes and community tokens without writing a contract. Mint,   ║
   ║  transfer, burn, and display what you hold.                      ║
   ║                                                                  ║
   ║  Assets issued here are the same objects the communities module  ║
   ║  reads for token gating and for weighting governance votes.      ║
   ║                                                                  ║
   ║  Simulated issuance: nothing is deployed to a chain. The chain   ║
   ║  field records intent, not a real deployment.                    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const AL = (() => {

  const KEY = 'ts_assets';

  const CHAINS = {
    ethereum: { label: 'Ethereum', color: '#627EEA', std: 'ERC-721 / ERC-20' },
    solana:   { label: 'Solana',   color: '#14F195', std: 'SPL' },
    polygon:  { label: 'Polygon',  color: '#8247E5', std: 'ERC-721 / ERC-20' },
    base:     { label: 'Base',     color: '#0052FF', std: 'ERC-721 / ERC-20' },
    arbitrum: { label: 'Arbitrum', color: '#12AAFF', std: 'ERC-721 / ERC-20' },
    bnb:      { label: 'BNB Chain',color: '#F0B90B', std: 'BEP-20 / BEP-721' }
  };

  /* Each template pre-fills the fields that matter for that asset shape,
     so issuing one is a naming exercise rather than a config puzzle. */
  const TEMPLATES = {
    collectible: {
      label: 'Digital Collectible', icon: 'image', kind: 'nft',
      blurb: 'A limited-edition NFT drop. Each mint is one of a numbered edition.',
      defaults: { supply: 100, royalty: 5, emoji: '🎨' }
    },
    membership: {
      label: 'Membership Token', icon: 'card_membership', kind: 'token',
      blurb: 'A fungible token for community membership. Holders can be gated and can vote.',
      defaults: { supply: 1000000, royalty: 0, emoji: '🎟️' }
    },
    community: {
      label: 'Community Token', icon: 'groups', kind: 'token',
      blurb: 'A social token for your community treasury, rewards and governance weight.',
      defaults: { supply: 10000000, royalty: 0, emoji: '🪙' }
    },
    pass: {
      label: 'Access Pass', icon: 'key', kind: 'nft',
      blurb: 'A non-transferable pass granting access to a gated space.',
      defaults: { supply: 500, royalty: 0, emoji: '🔑', soulbound: true }
    }
  };

  const DEFAULT = { assets: [], activity: [] };
  let A = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(A)); } catch (e) {} }

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const me = () => (typeof S !== 'undefined' && S.user ? S.user.handle : '@guest');

  function qty(v) {
    if (!v) return '0';
    return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }

  function log(kind, text) {
    A.activity.unshift({ id: 'ev' + Date.now() + Math.random(), kind, text, t: Date.now() });
    if (A.activity.length > 80) A.activity.length = 80;
  }

  /* ── Issue ──────────────────────────────────────────────────────── */
  function create(form) {
    const tpl = TEMPLATES[form.template];
    if (!tpl) return { ok: false, msg: 'Pick a template.' };

    const name = String(form.name || '').trim();
    const symbol = String(form.symbol || '').trim().toUpperCase();
    const supply = parseFloat(form.supply);
    const chain = form.chain;

    if (!name) return { ok: false, msg: 'Give your asset a name.' };
    if (!symbol || !/^[A-Z0-9]{2,10}$/.test(symbol)) return { ok: false, msg: 'Symbol must be 2–10 letters or digits.' };
    if (A.assets.some(a => a.symbol === symbol)) return { ok: false, msg: `You already issued ${symbol}.` };
    if (!supply || supply <= 0) return { ok: false, msg: 'Supply must be greater than zero.' };
    if (!CHAINS[chain]) return { ok: false, msg: 'Pick a chain.' };

    const asset = {
      id: 'as' + Date.now(),
      template: form.template,
      kind: tpl.kind,
      soulbound: !!tpl.defaults.soulbound,
      name, symbol, chain,
      emoji: form.emoji || tpl.defaults.emoji,
      description: String(form.description || '').trim(),
      supply,
      minted: 0,
      royalty: parseFloat(form.royalty) || 0,
      creator: me(),
      created: Date.now(),
      balance: 0                       // what you personally hold
    };

    A.assets.unshift(asset);
    log('create', `Issued ${name} (${symbol}) on ${CHAINS[chain].label}`);
    save();
    if (typeof SF !== 'undefined') SF.rep('publish_post');
    return { ok: true, asset, msg: `${name} issued on ${CHAINS[chain].label} 🎉` };
  }

  /* ── Mint / transfer / burn ─────────────────────────────────────── */
  function mint(id, amount) {
    const a = byId(id);
    if (!a) return { ok: false, msg: 'Asset not found.' };
    const n = a.kind === 'nft' ? Math.floor(parseFloat(amount) || 1) : parseFloat(amount);
    if (!n || n <= 0) return { ok: false, msg: 'Enter an amount to mint.' };
    if (a.minted + n > a.supply) {
      return { ok: false, msg: `Only ${qty(a.supply - a.minted)} left of the ${qty(a.supply)} supply.` };
    }
    a.minted += n;
    a.balance += n;
    log('mint', `Minted ${qty(n)} ${a.symbol}`);
    save();
    return { ok: true, msg: `Minted ${qty(n)} ${a.symbol}` };
  }

  function transfer(id, to, amount) {
    const a = byId(id);
    if (!a) return { ok: false, msg: 'Asset not found.' };
    if (a.soulbound) return { ok: false, msg: `${a.symbol} is an access pass — it cannot be transferred.` };
    const handle = String(to || '').trim();
    if (!handle) return { ok: false, msg: 'Enter a recipient handle.' };
    const n = parseFloat(amount);
    if (!n || n <= 0) return { ok: false, msg: 'Enter an amount.' };
    if (n > a.balance) return { ok: false, msg: `You only hold ${qty(a.balance)} ${a.symbol}.` };

    a.balance -= n;
    log('transfer', `Sent ${qty(n)} ${a.symbol} to ${handle}`);
    save();
    return { ok: true, msg: `Sent ${qty(n)} ${a.symbol} to ${handle}` };
  }

  function burn(id, amount) {
    const a = byId(id);
    if (!a) return { ok: false, msg: 'Asset not found.' };
    const n = parseFloat(amount);
    if (!n || n <= 0 || n > a.balance) return { ok: false, msg: 'Enter an amount you actually hold.' };
    a.balance -= n;
    a.minted -= n;
    log('burn', `Burned ${qty(n)} ${a.symbol}`);
    save();
    return { ok: true, msg: `Burned ${qty(n)} ${a.symbol}` };
  }

  function remove(id) {
    const i = A.assets.findIndex(a => a.id === id);
    if (i < 0) return;
    const a = A.assets[i];
    A.assets.splice(i, 1);
    log('delete', `Removed ${a.symbol}`);
    save();
  }

  /* ── Lookups used by gating and governance ──────────────────────── */
  const byId = id => A.assets.find(a => a.id === id);
  const bySymbol = sym => A.assets.find(a => a.symbol === String(sym || '').toUpperCase());
  const list = () => A.assets;

  /* Balance across both issued assets and traded coins, so a gate can
     require either "100 of my community token" or "0.1 BTC". */
  function balanceOf(ref) {
    const a = byId(ref) || bySymbol(ref);
    if (a) return a.balance;
    if (typeof TR !== 'undefined') return TR.availableOf(String(ref).toUpperCase());
    return 0;
  }

  function chainOf(ref) {
    const a = byId(ref) || bySymbol(ref);
    return a ? CHAINS[a.chain] : null;
  }

  return {
    CHAINS, TEMPLATES,
    create, mint, transfer, burn, remove,
    byId, bySymbol, list, balanceOf, chainOf,
    get state() { return A; }
  };
})();

window.AL = AL;

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
publish('features/assets.js', {
  AL: () => AL
});
