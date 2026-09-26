/* ╔══════════════════════════════════════════════════════════════════╗
   ║  WITHDRAW API — /api/crypto/…                                     ║
   ║                                                                   ║
   ║    POST /withdraw/quote      what it costs, what lands            ║
   ║    POST /withdraw/validate   is this address right for this chain ║
   ║    POST /withdraw            request it (needs an idempotency key)║
   ║    GET  /withdrawals         this user's withdrawals              ║
   ║    GET  /withdrawals/:id                                          ║
   ║    POST /withdrawals/:id/cancel   only while still queued         ║
   ║    GET  /2fa  · POST /2fa/enrol · /2fa/confirm · /2fa/disable     ║
   ║                                                                   ║
   ║  Quote and validate are cheap and safe to call as the user types. ║
   ║  POST /withdraw is the only one that moves anything, and it       ║
   ║  re-runs every check the other two did: what the client believes  ║
   ║  about balances, fees and addresses is a hint for drawing the     ║
   ║  screen, never an input to a decision.                            ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const express = require('express');
const mongoose = require('mongoose');
const withdraw = require('../services/withdraw');
const twofactor = require('../services/twofactor');
const { Withdrawal } = require('../models/custody');
const { NETWORKS } = require('../config/crypto-deposit');
const custody = require('../services/custody');
const address = require('../lib/address');
const { requireAuth } = require('../middleware/auth');
const { limit } = require('../middleware/ratelimit');

const router = express.Router();

/* Sending money gets a tighter budget than reading about it. */
const RATE = { quote: { windowMs: 60000, max: 60 }, send: { windowMs: 60000, max: 5 } };
const buckets = { quote: new Map(), send: new Map() };
function limited(kind, req, res) {
  const cfg = RATE[kind], map = buckets[kind];
  const id = (req.user && req.user.id) || req.ip;
  const now = Date.now();
  const rec = map.get(id);
  if (!rec || now - rec.start > cfg.windowMs) map.set(id, { start: now, n: 1 });
  else if (++rec.n > cfg.max) {
    res.status(429).json({ error: 'rate_limited', message: 'Too many attempts. Wait a minute and try again.' });
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

/* Custody off means Trending holds nothing, so there is nothing to send
   out. Saying that plainly beats an empty balance and a dead button. */
function needCustody(res) {
  if (custody.enabled()) return false;
  res.status(503).json({
    error: 'custody_disabled',
    message: 'Trending is not holding crypto for you, so there is nothing here to withdraw. Coins you deposited went straight to your own wallet — send them from there.'
  });
  return true;
}

/* One place that maps a refusal to an HTTP status. */
const STATUS = {
  twofactor: 401, twofactor_required: 401, twofactor_reused: 401,
  twofactor_locked: 429, cooling_off: 403, twofactor_unconfigured: 503, twofactor_unavailable: 503,
  insufficient: 409, below_minimum: 409, conflict: 409, already_enrolled: 409, no_enrolment: 409
};
const statusFor = code => STATUS[code] || 400;

const publicWd = w => ({
  id: String(w._id), asset: w.asset, network: w.network,
  networkLabel: (NETWORKS[w.network] || {}).label || w.network,
  to: w.toAddress, amount: w.amount, fee: w.fee, receives: w.receives,
  feeBasis: w.feeBasis, status: w.status, txHash: w.txHash || null,
  confirmations: w.confirmations,
  explorer: withdraw.explorerFor(w.network, w.txHash),
  reason: w.failureReason || undefined,
  signerWaiting: w.status === 'queued_for_signing' && !withdraw.signerConfigured(),
  createdAt: w.createdAt, broadcastAt: w.broadcastAt, completedAt: w.completedAt
});

router.use(requireAuth);

/* Per person. Checking an address or a quote happens as someone types,
   so it gets room; asking to send, and every two-factor step, do not -
   a burst there is a script, not a person. Nothing half-runs: over the
   limit is a 429 before the handler starts. */
const MIN = 60 * 1000;
const typing = limit({ scope: 'wd.typing', windowMs: MIN, max: 120 });
const sending = limit({ scope: 'wd.request', windowMs: 10 * MIN, max: 10 });
const cancelling = limit({ scope: 'wd.cancel', windowMs: 10 * MIN, max: 20 });
const factor = limit({ scope: 'wd.2fa', windowMs: 10 * MIN, max: 10 });

/* ── Address check, as the user types ────────────────────────────── */
router.post('/withdraw/validate', typing, (req, res) => {
  if (limited('quote', req, res)) return;
  const network = String((req.body && req.body.network) || '').toLowerCase();
  const net = NETWORKS[network];
  if (!net) return res.status(400).json({ error: 'unsupported_network', message: 'Pick a network first.' });
  const v = address.validate(net.family, (req.body && req.body.address) || '');
  /* A refused secret is never echoed back, logged or stored. */
  res.json({
    valid: !!v.ok, checksum: !!v.checksum,
    normalized: v.ok ? (v.normalized || null) : null,
    kind: v.kind || null,
    message: v.ok ? null : v.reason
  });
});

/* ── Quote ───────────────────────────────────────────────────────── */
/* The pair is checked before the database, for the same reason the
   deposit route does it: answering "no database" to "can I send ETH over
   Bitcoin?" hides the answer that would have saved someone's money. */
router.post('/withdraw/quote', typing, async (req, res) => {
  if (limited('quote', req, res)) return;
  const pair = withdraw.checkPair(String((req.body || {}).asset || '').toUpperCase(),
                                  String((req.body || {}).network || '').toLowerCase());
  if (!pair.ok) return res.status(400).json(pair);
  if (needCustody(res) || needDb(res)) return;
  const b = req.body || {};
  const q = await withdraw.quote({
    userId: req.user.id, asset: String(b.asset || '').toUpperCase(),
    network: String(b.network || '').toLowerCase(),
    amount: b.amount == null ? null : String(b.amount)
  });
  res.status(q.ok ? 200 : 400).json(q);
});

/* ── Request ─────────────────────────────────────────────────────── */
router.post('/withdraw', sending, async (req, res) => {
  if (limited('send', req, res)) return;
  const pair = withdraw.checkPair(String((req.body || {}).asset || '').toUpperCase(),
                                  String((req.body || {}).network || '').toLowerCase());
  if (!pair.ok) return res.status(400).json(pair);
  if (needCustody(res) || needDb(res)) return;
  const b = req.body || {};
  try {
    const out = await withdraw.request({
      userId: req.user.id,
      asset: String(b.asset || '').toUpperCase(),
      network: String(b.network || '').toLowerCase(),
      to: String(b.to || ''),
      amount: String(b.amount || '0'),
      twoFactor: b.twoFactor,
      idempotencyKey: req.get('Idempotency-Key') || b.idempotencyKey,
      ip: req.ip
    });
    if (!out.ok) return res.status(statusFor(out.code)).json(out);
    res.status(out.idempotent ? 200 : 201).json({
      ok: true, idempotent: !!out.idempotent, withdrawal: publicWd(out.withdrawal)
    });
  } catch (e) {
    res.status(500).json({ error: 'withdraw_failed', message: 'That could not be submitted. Nothing was sent.' });
  }
});

/* ── Read ────────────────────────────────────────────────────────── */
router.get('/withdrawals', async (req, res) => {
  if (needDb(res)) return;
  const rows = await Withdrawal.find({ userId: req.user.id })
    .sort({ createdAt: -1 }).limit(Math.min(100, Number(req.query.limit) || 50));
  res.json({ withdrawals: rows.map(publicWd), signerConfigured: withdraw.signerConfigured() });
});

router.get('/withdrawals/:id', async (req, res) => {
  if (needDb(res)) return;
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'bad_id' });
  const row = await Withdrawal.findById(req.params.id);
  if (!row || row.userId !== req.user.id) return res.status(404).json({ error: 'not_found' });
  res.json({ withdrawal: publicWd(row) });
});

/* ── Second factor ───────────────────────────────────────────────── */
/* Status, enrol, confirm, turn off. Every one is scoped to the session's
   own user id; none takes a user id from the request. Guesses share the
   tight "send" budget, and the service itself locks the factor after
   repeated wrong codes. */
router.get('/2fa', async (req, res) => {
  if (needDb(res)) return;
  res.json(await twofactor.status(req.user.id));
});

router.post('/2fa/enrol', factor, async (req, res) => {
  if (limited('send', req, res) || needDb(res)) return;
  const out = await twofactor.begin(req.user.id, (req.body && req.body.label) || '');
  if (!out.ok) return res.status(statusFor(out.code)).json(out);
  // The secret is in this one response and nowhere else in the clear.
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, uri: out.uri, secret: out.secret });
});

router.post('/2fa/confirm', factor, async (req, res) => {
  if (limited('send', req, res) || needDb(res)) return;
  const out = await twofactor.confirm(req.user.id, (req.body || {}).code);
  res.status(out.ok ? 200 : statusFor(out.code)).json(out);
});

router.post('/2fa/disable', factor, async (req, res) => {
  if (limited('send', req, res) || needDb(res)) return;
  const out = await twofactor.disable(req.user.id, (req.body || {}).code);
  res.status(out.ok ? 200 : statusFor(out.code)).json(out);
});

router.post('/withdrawals/:id/cancel', cancelling, async (req, res) => {
  if (limited('send', req, res) || needDb(res)) return;
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'bad_id' });
  const out = await withdraw.cancel(req.user.id, req.params.id);
  if (!out.ok) return res.status(out.code === 'not_found' ? 404 : 409).json(out);
  res.json({ ok: true, withdrawal: publicWd(out.withdrawal) });
});

module.exports = router;
