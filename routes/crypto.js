/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CRYPTO DEPOSIT API — /api/crypto/…                               ║
   ║                                                                   ║
   ║    GET /api/crypto/assets                  what can be deposited  ║
   ║    GET /api/crypto/assets/:symbol/networks which chains for one   ║
   ║    GET /api/crypto/networks                every chain            ║
   ║    GET /api/crypto/config                  version + a health tag ║
   ║                                                                   ║
   ║  These are read-only and hold no user data, so they need no       ║
   ║  session — but they are still the authority for what the deposit  ║
   ║  screen may offer. The browser asks; it does not decide.          ║
   ║                                                                   ║
   ║  There is deliberately no POST /deposit/address here. Handing a   ║
   ║  user an address that Trending generated would mean Trending      ║
   ║  holds the key to it, and custody is not something to improvise   ║
   ║  next to a static file server: it needs a key-management service, ║
   ║  a chain watcher, an auditable ledger and an operator who can be  ║
   ║  woken at 3am. Until that exists, deposits go to an address the   ║
   ║  user already controls, which the client supplies from the        ║
   ║  wallet they connected. docs/crypto-deposit-architecture.md sets  ║
   ║  out what the custodial version needs.                            ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const express = require('express');
const { NETWORKS, ASSETS, VERSION } = require('../config/crypto-deposit');

const router = express.Router();

/* A small per-IP limit: this is cheap to serve, but nothing public
   should be free to hammer. */
const RATE = { windowMs: 60 * 1000, max: 120 };
const hits = new Map();

function limited(req, res) {
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > RATE.windowMs) {
    hits.set(ip, { start: now, n: 1 });
  } else if (++rec.n > RATE.max) {
    res.status(429).json({ error: 'rate_limited', message: 'Too many requests. Try again in a minute.' });
    return true;
  }
  if (hits.size > 5000) {                       // keep the map from growing forever
    for (const [k, v] of hits) if (now - v.start > RATE.windowMs) hits.delete(k);
  }
  return false;
}

/* Config is static per process, so the answers are built once. */
const netPublic = n => ({
  key: n.key, code: n.code, label: n.label, tag: n.tag, family: n.family,
  chainId: n.chainId || null, status: n.status, blockSeconds: n.blockSeconds,
  finality: n.finality, color: n.color, explorer: n.explorer, addressExplorer: n.addressExplorer,
  tagField: n.tagField || null, note: n.note || ''
});

const NET_LIST = Object.keys(NETWORKS).map(k => netPublic(NETWORKS[k]));

const ASSET_LIST = ASSETS.map(a => ({
  symbol: a.symbol, name: a.name, color: a.color, rank: a.rank, token: !!a.token,
  networks: a.networks.filter(n => NETWORKS[n.net]).map(n => n.net),
  // so the search box can match "USDT on tron" without a second request
  search: [a.symbol, a.name].concat(a.networks.map(n => NETWORKS[n.net] ? NETWORKS[n.net].label : ''))
    .join(' ').toLowerCase()
}));

const bySymbol = {};
ASSETS.forEach(a => { bySymbol[a.symbol] = a; });

router.get('/assets', (req, res) => {
  if (limited(req, res)) return;
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ version: VERSION, assets: ASSET_LIST });
});

router.get('/networks', (req, res) => {
  if (limited(req, res)) return;
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ version: VERSION, networks: NET_LIST });
});

router.get('/assets/:symbol/networks', (req, res) => {
  if (limited(req, res)) return;
  const sym = String(req.params.symbol || '').toUpperCase().slice(0, 16);
  const asset = bySymbol[sym];
  if (!asset) {
    return res.status(404).json({ error: 'unsupported_asset', message: `Trending does not list ${sym} for deposit yet.` });
  }
  const rows = asset.networks
    .filter(n => NETWORKS[n.net])
    .map(n => ({
      ...netPublic(NETWORKS[n.net]),
      // The asset-on-network facts, kept apart from the network's own.
      wrapped: !!n.wrapped,
      token: !!asset.token,
      // No contract address is published on purpose — see the config file.
      verifyContract: !!asset.token
    }));
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    version: VERSION,
    asset: { symbol: asset.symbol, name: asset.name, color: asset.color, token: !!asset.token },
    networks: rows
  });
});

router.get('/config', (req, res) => {
  if (limited(req, res)) return;
  res.json({
    version: VERSION,
    assets: ASSET_LIST.length,
    networks: NET_LIST.length,
    custody: 'none',
    custodyNote: 'Deposits go to an address the user controls. Trending holds no keys and credits no balance from a chain transfer.'
  });
});

module.exports = router;
