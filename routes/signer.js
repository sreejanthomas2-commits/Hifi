/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SIGNER QUEUE — /api/crypto/signer/…                              ║
   ║                                                                   ║
   ║    GET  /queue                 what is waiting                    ║
   ║    POST /withdrawals/:id/claim take one, exclusively              ║
   ║    POST /withdrawals/:id       report what happened               ║
   ║                                                                   ║
   ║  Mounted on its own prefix rather than sharing /api/crypto with   ║
   ║  the user routes: a router mounted there runs its auth over every ║
   ║  path beneath it, and these callers are not users.                ║
   ║                                                                   ║
   ║  The signer PULLS from here. There is no route that pushes to     ║
   ║  the signer, and no address on which the signer listens — so a    ║
   ║  compromised web tier can add rows to a queue and nothing else.   ║
   ║  It cannot make anything sign, cannot reach the keys, and cannot  ║
   ║  raise the signer's own limits.                                   ║
   ║                                                                   ║
   ║  A separate secret from user sessions, because these are not      ║
   ║  users: SIGNER_TOKEN, compared in constant time. With it unset    ║
   ║  every route here answers 503 rather than opening up.             ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Withdrawal, AuditLog } = require('../models/custody');
const { NETWORKS } = require('../config/crypto-deposit');
const withdraw = require('../services/withdraw');

const router = express.Router();

/* A claim goes stale if a signer dies mid-transaction, so it expires and
   the row returns to the queue rather than being stuck forever. */
const CLAIM_MS = Number(process.env.SIGNER_CLAIM_MS || 10 * 60 * 1000);

function tokenOk(req) {
  const want = process.env.SIGNER_TOKEN || '';
  if (!want) return false;
  const given = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given), b = Buffer.from(want);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

router.use((req, res, next) => {
  if (!process.env.SIGNER_TOKEN) {
    return res.status(503).json({ error: 'signer_unconfigured', message: 'No signer is connected to this deployment.' });
  }
  if (!tokenOk(req)) {
    AuditLog.create([{ actor: 'unknown', action: 'signer.auth.failed', detail: { ip: req.ip } }]).catch(() => {});
    return res.status(401).json({ error: 'unauthenticated' });
  }
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'no_database' });
  }
  next();
});

/* What the signer is told. Deliberately narrow: enough to build and
   check a transaction, and nothing about the person behind it. */
const forSigner = w => ({
  id: String(w._id), asset: w.asset, network: w.network,
  chainId: (NETWORKS[w.network] || {}).chainId || null,
  to: w.toAddress, amount: w.amount, fee: w.fee, receives: w.receives,
  contract: '', tag: w.tag || '', status: w.status, createdAt: w.createdAt
});

router.get('/queue', async (req, res) => {
  const cutoff = new Date(Date.now() - CLAIM_MS);
  const q = {
    $or: [
      { status: 'queued_for_signing' },
      { status: 'signing', claimedAt: { $lt: cutoff } }     // a dead signer's work
    ]
  };
  const rows = await Withdrawal.find(q).sort({ createdAt: 1 })
    .limit(Math.min(50, Number(req.query.limit) || 10));
  const total = await Withdrawal.countDocuments(q);
  res.json({ withdrawals: rows.map(forSigner), total });
});

/* Claiming is a conditional update, so two signers racing cannot both
   win: whichever update matches first moves the row out of the queue. */
router.post('/withdrawals/:id/claim', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'bad_id' });
  const cutoff = new Date(Date.now() - CLAIM_MS);
  const out = await Withdrawal.findOneAndUpdate(
    {
      _id: req.params.id,
      $or: [{ status: 'queued_for_signing' }, { status: 'signing', claimedAt: { $lt: cutoff } }]
    },
    { status: 'signing', claimedAt: new Date() },
    { new: true }
  );
  if (!out) return res.status(409).json({ ok: false, error: 'already_claimed' });
  await AuditLog.create([{ actor: 'signer', action: 'withdrawal.claimed', subject: String(out._id) }]);
  res.json({ ok: true, withdrawal: forSigner(out) });
});

/* The signer reports; the service moves the state. It cannot set an
   arbitrary status — `advance` only allows the legal next steps, so a
   compromised signer token cannot mark a withdrawal complete without
   one ever having been broadcast. */
const ALLOWED = { broadcast: 1, confirming: 1, completed: 1, failed: 1, rejected: 1 };

router.post('/withdrawals/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'bad_id' });
  const b = req.body || {};
  const status = String(b.status || '');
  if (!ALLOWED[status]) return res.status(400).json({ error: 'bad_status' });

  const patch = {};
  if (b.txHash) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(b.txHash))) return res.status(400).json({ error: 'bad_tx_hash' });
    patch.txHash = String(b.txHash);
  }
  if (status === 'broadcast' && !patch.txHash) {
    return res.status(400).json({ error: 'tx_hash_required', message: 'A broadcast must come with the transaction hash.' });
  }
  if (b.reason) patch.failureReason = String(b.reason).slice(0, 300);
  if (b.confirmations != null) patch.confirmations = Math.max(0, Number(b.confirmations) || 0);

  const out = await withdraw.advance(req.params.id, status, patch, 'signer');
  if (!out.ok) return res.status(409).json(out);
  res.json({ ok: true, status: out.withdrawal.status });
});

module.exports = router;
