/* ╔══════════════════════════════════════════════════════════════════╗
   ║  DEPOSIT API (custodial) — /api/crypto/deposit/…                  ║
   ║                                                                   ║
   ║    POST /deposit/address        issue or reuse this user's addr   ║
   ║    GET  /deposits               this user's deposits              ║
   ║    GET  /deposits/:id           one deposit                       ║
   ║    GET  /deposits/:id/status    just the status, for polling      ║
   ║    GET  /balances               balances, from the ledger         ║
   ║    GET  /custody/preview        operator check (admin only)       ║
   ║                                                                   ║
   ║  Every route needs a signed session. A wallet endpoint that       ║
   ║  answers to an unauthenticated caller is not a wallet endpoint,   ║
   ║  it is a leak — so the middleware runs before the router, not     ║
   ║  per-handler where one forgotten line undoes it.                  ║
   ║                                                                   ║
   ║  The balance returned here is the ledger's, never the client's.   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const express = require('express');
const mongoose = require('mongoose');
const custody = require('../services/custody');
const ledger = require('../services/ledger');
const { DepositTx, DepositAddress, AuditLog } = require('../models/custody');
const { NETWORKS, ASSETS } = require('../config/crypto-deposit');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/* Writes are rarer and more expensive than reads, so they get their own
   budget per user. */
const RATE = { windowMs: 60000, max: 10 };
const hits = new Map();
function limited(req, res) {
  const id = (req.user && req.user.id) || req.ip;
  const now = Date.now();
  const rec = hits.get(id);
  if (!rec || now - rec.start > RATE.windowMs) hits.set(id, { start: now, n: 1 });
  else if (++rec.n > RATE.max) {
    res.status(429).json({ error: 'rate_limited', message: 'Too many requests. Try again in a minute.' });
    return true;
  }
  return false;
}

const dbReady = () => mongoose.connection && mongoose.connection.readyState === 1;
function needDb(res) {
  if (dbReady()) return false;
  res.status(503).json({ error: 'no_database', message: 'The wallet database is not connected.' });
  return true;
}

const assetOf = sym => ASSETS.find(a => a.symbol === String(sym || '').toUpperCase());

const publicTx = t => ({
  id: String(t._id), asset: t.asset, network: t.network, networkLabel: (NETWORKS[t.network] || {}).label || t.network,
  amount: t.amount, txHash: t.txHash, vout: t.vout, address: t.address,
  confirmations: t.confirmations, required: t.required, status: t.status,
  reason: t.rejectedReason || undefined,
  explorer: (NETWORKS[t.network] || {}).explorer ? (NETWORKS[t.network].explorer + t.txHash) : null,
  firstSeenAt: t.firstSeenAt, creditedAt: t.creditedAt
});

router.use(requireAuth);

/* ── Issue an address ────────────────────────────────────────────── */
/* Order is deliberate. A caller who asks for something impossible should
   be told that, whatever else is wrong with the deployment — answering
   "no database" to "can I deposit BTC over Ethereum?" hides the real
   mistake and sends them looking in the wrong place. The database check
   comes last, immediately before the write that needs it. */
router.post('/deposit/address', async (req, res) => {
  if (limited(req, res)) return;
  const asset = String((req.body && req.body.asset) || '').toUpperCase();
  const network = String((req.body && req.body.network) || '').toLowerCase();

  const a = assetOf(asset);
  if (!a) return res.status(400).json({ error: 'unsupported_asset', message: `${asset || 'That asset'} is not supported.` });
  if (!a.networks.some(n => n.net === network)) {
    return res.status(400).json({ error: 'unsupported_pair', message: `${asset} cannot be deposited over that network.` });
  }

  const gate = custody.status(network);
  if (!gate.ok) {
    return res.status(gate.code === 'custody_disabled' ? 503 : 409).json({ error: gate.code, message: gate.message });
  }
  if (needDb(res)) return;

  try {
    const out = await custody.addressFor(req.user.id, asset, network);
    if (!out.ok) return res.status(out.code === 'custody_disabled' ? 503 : 409).json({ error: out.code, message: out.message });
    const net = NETWORKS[network];
    res.json({
      asset, network, networkLabel: net.label, tag: net.tagField || null,
      address: out.address.address,
      memo: out.address.tag || null,
      reused: !!out.reused,
      confirmationsRequired: require('../services/watcher').CONFIRMATIONS[network] || null,
      warning: `Only send ${asset} over ${net.label} to this address.`
    });
  } catch (e) {
    await AuditLog.create([{ actor: req.user.id, action: 'deposit.address.error', detail: { message: e.message } }]).catch(() => {});
    res.status(500).json({ error: 'address_failed', message: 'Could not issue an address just now.' });
  }
});

/* ── Read deposits ───────────────────────────────────────────────── */
router.get('/deposits', async (req, res) => {
  if (needDb(res)) return;
  const q = { userId: req.user.id };
  if (req.query.asset) q.asset = String(req.query.asset).toUpperCase();
  if (req.query.status) q.status = String(req.query.status);
  const rows = await DepositTx.find(q).sort({ firstSeenAt: -1 }).limit(Math.min(100, Number(req.query.limit) || 50));
  res.json({ deposits: rows.map(publicTx) });
});

router.get('/deposits/:id', async (req, res) => {
  if (needDb(res)) return;
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'bad_id' });
  const row = await DepositTx.findById(req.params.id);
  // Not-found and not-yours answer the same way: a 404 that leaks nothing.
  if (!row || row.userId !== req.user.id) return res.status(404).json({ error: 'not_found' });
  res.json({ deposit: publicTx(row) });
});

router.get('/deposits/:id/status', async (req, res) => {
  if (needDb(res)) return;
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'bad_id' });
  const row = await DepositTx.findById(req.params.id).select('userId status confirmations required creditedAt');
  if (!row || row.userId !== req.user.id) return res.status(404).json({ error: 'not_found' });
  res.json({ status: row.status, confirmations: row.confirmations, required: row.required, creditedAt: row.creditedAt });
});

/* ── Balances, straight from the ledger ──────────────────────────── */
router.get('/balances', async (req, res) => {
  if (needDb(res)) return;
  const wanted = req.query.asset ? [String(req.query.asset).toUpperCase()] : ASSETS.map(a => a.symbol);
  const out = {};
  for (const sym of wanted) out[sym] = await ledger.balanceOf(req.user.id, sym);
  res.json({ balances: out, source: 'ledger' });
});

router.get('/deposit/addresses', async (req, res) => {
  if (needDb(res)) return;
  const rows = await DepositAddress.find({ userId: req.user.id, status: 'active' });
  res.json({ addresses: rows.map(r => ({ asset: r.asset, network: r.network, address: r.address, assignedAt: r.assignedAt })) });
});

/* ── Operator: check the key before trusting it with money ───────── */
router.get('/custody/preview', requireAdmin, (req, res) => {
  const network = String(req.query.network || '').toLowerCase();
  const out = custody.preview(network, Math.min(10, Number(req.query.count) || 3));
  if (!out.ok) return res.status(409).json(out);
  res.json(out);
});

module.exports = router;
