/* ╔══════════════════════════════════════════════════════════════════╗
   ║  THE COIN CATALOGUE — every coin the deposit and send screens     ║
   ║  can offer, with its logo and the networks it really lives on     ║
   ║                                                                   ║
   ║  The curated list in config/crypto-deposit.js has twenty coins.   ║
   ║  The market has thousands. This builds the list from the market   ║
   ║  itself: CoinGecko's top coins by value (name, ticker, logo,      ║
   ║  rank) joined to CoinGecko's platform table, which says which     ║
   ║  chains each token is issued on. A coin shows up only on networks ║
   ║  this app supports, and a coin with none is left out, because     ║
   ║  sending it anyway would lose it.                                 ║
   ║                                                                   ║
   ║  What is taken from the platform table is the list of chains and  ║
   ║  nothing else. Its contract addresses are not stored or served —  ║
   ║  the same rule as the config file: the app you send from already  ║
   ║  knows the contract, and a second copy that drifts costs money.   ║
   ║                                                                   ║
   ║  A coin on a chain that isn't its own (DOGE on BNB Chain, say) is ║
   ║  a bridged copy, and is marked as one.                            ║
   ║                                                                   ║
   ║  Built at most twice a day, kept on disk, and when CoinGecko      ║
   ║  doesn't answer the last good copy is served; with no copy at all ║
   ║  the curated twenty are. The list is never empty and never made   ║
   ║  up. CATALOG_LIVE=0 turns the network fetch off (tests use it).   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const fs = require('fs');
const path = require('path');
const { NETWORKS, ASSETS } = require('../config/crypto-deposit');

const TTL = Number(process.env.CATALOG_TTL_MS || 12 * 3600 * 1000);
const TOP = Math.min(250, Number(process.env.CATALOG_TOP || 250));
const FILE = process.env.CATALOG_FILE || path.join(__dirname, '..', 'data', 'catalog-cache.json');
const CG = process.env.COINGECKO_API || 'https://api.coingecko.com/api/v3';

/* CoinGecko platform id → network key here. */
const PLATFORM_NET = {
  ethereum: 'ethereum', 'binance-smart-chain': 'bnb', 'polygon-pos': 'polygon', 'arbitrum-one': 'arbitrum',
  'optimistic-ethereum': 'optimism', base: 'base', avalanche: 'avalanche', solana: 'solana', tron: 'tron',
  'the-open-network': 'ton', stellar: 'stellar', 'near-protocol': 'near',
  cardano: 'cardano', 'hedera-hashgraph': 'hedera', algorand: 'algorand', tezos: 'tezos', cosmos: 'cosmos',
  'ethereum-classic': 'etc'
};

/* A chain's own coin, by CoinGecko id → the networks where it is native.
   ETH is native on Ethereum and on the rollups built on it. */
const NATIVE = {
  bitcoin: ['bitcoin'], ethereum: ['ethereum', 'arbitrum', 'base', 'optimism'], binancecoin: ['bnb'],
  'polygon-ecosystem-token': ['polygon'], 'avalanche-2': ['avalanche'], solana: ['solana'], tron: ['tron'],
  ripple: ['xrpl'], dogecoin: ['dogecoin'], litecoin: ['litecoin'], 'bitcoin-cash': ['bitcoincash'],
  cardano: ['cardano'], polkadot: ['polkadot'], 'the-open-network': ['ton'], stellar: ['stellar'],
  near: ['near'], 'hedera-hashgraph': ['hedera'], algorand: ['algorand'],
  tezos: ['tezos'], cosmos: ['cosmos'], kaspa: ['kaspa'], 'ethereum-classic': ['etc']
};

/* Sui and Aptos are left out on purpose: their addresses are 0x plus 64
   hex characters, the exact shape of a raw private key, and the address
   screens refuse anything shaped like a key so one can never be saved
   and shared as an "address". NEAR is offered for named accounts only,
   for the same reason (its implicit accounts are 64 hex characters).

   The order networks are offered in, after a coin's native chain. */
const NET_ORDER = ['ethereum', 'tron', 'bnb', 'solana', 'arbitrum', 'base', 'polygon', 'optimism', 'avalanche',
  'ton', 'near', 'stellar', 'cardano', 'algorand', 'hedera', 'tezos', 'cosmos', 'etc'];

const CURATED = {};
ASSETS.forEach(a => { CURATED[a.symbol] = a; });

let current = null;           // { at, source, assets }
let building = null;

/* A colour for a coin the curated list doesn't know, stable per ticker,
   used only behind the logo while it loads. */
function colorOf(sym) {
  let h = 0;
  for (const ch of String(sym)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 55% 48%)`;
}

const curatedOnly = () => ASSETS.map(a => ({
  symbol: a.symbol, name: a.name, color: a.color, rank: a.rank, token: !!a.token, image: '',
  networks: a.networks.filter(n => NETWORKS[n.net]).map(n => ({ net: n.net, wrapped: !!n.wrapped }))
}));

/* markets: CoinGecko /coins/markets rows. list: /coins/list?include_platform=true rows. */
function build(markets, list) {
  const byId = new Map(list.map(c => [c.id, c]));
  const out = new Map();                                    // symbol -> asset

  markets.forEach((m, i) => {
    const sym = String(m.symbol || '').toUpperCase().trim();
    if (!sym || !/^[A-Z0-9.]{1,12}$/.test(sym)) return;
    const native = NATIVE[m.id] || [];
    const platforms = (byId.get(m.id) || {}).platforms || {};
    const nets = new Map();
    native.forEach(k => { if (NETWORKS[k]) nets.set(k, { net: k, wrapped: false }); });
    Object.keys(platforms).forEach(p => {
      const k = PLATFORM_NET[p];
      if (!k || !NETWORKS[k] || nets.has(k)) return;
      // A native coin that also appears on another chain is a bridged copy there.
      nets.set(k, { net: k, wrapped: native.length > 0 });
    });
    if (!nets.size) return;

    const curated = CURATED[sym];
    // The curated entry's flags (WBTC is wrapped everywhere) win for its networks.
    if (curated) curated.networks.forEach(n => { if (NETWORKS[n.net]) nets.set(n.net, { net: n.net, wrapped: !!n.wrapped }); });

    const ordered = [...nets.values()].sort((a, b) => {
      const na = native.indexOf(a.net), nb = native.indexOf(b.net);
      if (na !== nb) return (na < 0 ? 99 : na) - (nb < 0 ? 99 : nb);
      return (NET_ORDER.indexOf(a.net) + 1 || 99) - (NET_ORDER.indexOf(b.net) + 1 || 99);
    });

    const rank = Number(m.market_cap_rank) || (1000 + i);
    const prev = out.get(sym);
    if (prev && prev.rank <= rank) return;                  // one entry per ticker: the bigger coin
    out.set(sym, {
      symbol: sym, name: String(m.name || sym).slice(0, 60),
      color: curated ? curated.color : colorOf(sym), rank,
      token: native.length === 0,
      image: typeof m.image === 'string' && /^https:\/\//.test(m.image) ? m.image : '',
      networks: ordered
    });
  });

  // A curated coin the market list missed (a small one) is still offered.
  ASSETS.forEach(a => {
    if (out.has(a.symbol)) return;
    const nets = a.networks.filter(n => NETWORKS[n.net]).map(n => ({ net: n.net, wrapped: !!n.wrapped }));
    if (nets.length) out.set(a.symbol, { symbol: a.symbol, name: a.name, color: a.color, rank: 900 + a.rank, token: !!a.token, image: '', networks: nets });
  });

  return [...out.values()].sort((a, b) => a.rank - b.rank);
}

async function getJSON(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${url.split('?')[0]}: ${r.status}`);
  return r.json();
}

function readDisk() {
  try {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return j && Array.isArray(j.assets) && j.assets.length ? j : null;
  } catch (e) { return null; }
}
function writeDisk(snap) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(snap));
  } catch (e) { /* a read-only disk just means no cache across restarts */ }
}

/* After a failed build, wait before asking CoinGecko again: its free API
   rate-limits by IP, and asking on every request would keep it failing. */
const RETRY_MS = Number(process.env.CATALOG_RETRY_MS || 5 * 60 * 1000);
let lastTry = 0;

async function refresh() {
  if (building) return building;
  if (current && Date.now() - lastTry < RETRY_MS) return current;
  lastTry = Date.now();
  building = (async () => {
    try {
      if (process.env.CATALOG_LIVE === '0') throw new Error('live catalogue off');
      const [markets, list] = await Promise.all([
        getJSON(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${TOP}&page=1`),
        getJSON(`${CG}/coins/list?include_platform=true`)
      ]);
      if (!Array.isArray(markets) || !markets.length || !Array.isArray(list)) throw new Error('empty answer');
      const assets = build(markets, list);
      if (assets.length < ASSETS.length) throw new Error('suspiciously short catalogue');
      current = { at: Date.now(), source: 'coingecko', assets };
      writeDisk(current);
    } catch (e) {
      if (!current) {
        const disk = readDisk();
        current = disk ? { ...disk, source: 'cache' } : { at: 0, source: 'curated', assets: curatedOnly() };
      }
    } finally {
      building = null;
    }
    return current;
  })();
  return building;
}

/* What the routes call. Never waits longer than `waitMs` for a fresh
   build: past that, the best copy there is is answered and the build
   carries on in the background. */
async function assets(waitMs) {
  if (!current) {
    const disk = readDisk();
    if (disk) current = { ...disk, source: 'cache' };
  }
  const fresh = current && current.source === 'coingecko' && Date.now() - current.at < TTL;
  if (fresh) return current;
  if (current && current.source !== 'curated' && Date.now() - current.at < TTL) return current;
  const job = refresh();
  if (!current) {
    const timer = new Promise(res => setTimeout(() => res(null), waitMs == null ? 8000 : waitMs));
    const got = await Promise.race([job, timer]);
    if (!got && !current) current = { at: 0, source: 'curated', assets: curatedOnly() };
  }
  return current;
}

function bySymbol(sym) {
  const list = current ? current.assets : curatedOnly();
  return list.find(a => a.symbol === sym) || null;
}

/* Start building when the server starts, so the first person to open
   Deposit doesn't wait for it. */
function warm() { assets(0).catch(() => {}); }

/* For tests. */
function reset() { current = null; building = null; lastTry = 0; }

module.exports = { assets, bySymbol, warm, refresh, build, reset, PLATFORM_NET, NATIVE };
