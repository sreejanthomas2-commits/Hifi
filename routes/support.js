/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SUPPORT — tickets tied to the transaction they are about          ║
   ║                                                                   ║
   ║  POST /api/support/tickets              { category, txRef?, message }
   ║  GET  /api/support/tickets              your own, newest first    ║
   ║  GET  /api/support/tickets/:ref         one of yours              ║
   ║  POST /api/support/tickets/:ref/messages { text }                  ║
   ║  GET  /api/support/admin/tickets        staff, read-only, audited ║
   ║                                                                   ║
   ║  A ticket is visible to the person who opened it and to staff.    ║
   ║  Anyone else asking for it gets the same 404 as a ticket that     ║
   ║  doesn't exist, so references can't be probed. Staff see the      ║
   ║  ticket and its transaction reference - never a password, token   ║
   ║  or key, because none of those are ever stored here.              ║
   ║                                                                   ║
   ║  Text is stored as typed and escaped wherever it is shown.        ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { idempotent } = require('../middleware/idempotency');
const { limit } = require('../middleware/ratelimit');
const { send } = require('../lib/problem');

const router = express.Router();
const models = () => require('../models/sandbox');
const audit = () => require('../models/custody').AuditLog;

const TXREF = /^[A-Za-z0-9_-]{3,64}$/;
const TICKET = /^SUP-[A-Z2-9]{8}$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newRef = () => 'SUP-' + Array.from(crypto.randomBytes(8), b => ALPHABET[b % ALPHABET.length]).join('');

// Printable text, newlines kept, everything else that controls a terminal dropped.
function text(v, max) {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();
  return t.length >= 1 && t.length <= max ? t : null;
}

const needDb = (req, res, next) =>
  (mongoose.connection && mongoose.connection.readyState === 1 ? next() : send(res, 'database_unavailable'));

// What a person sees of their ticket.
const view = t => ({
  ref: t.ref, category: t.category, txRef: t.txRef, status: t.status,
  messages: (t.messages || []).map(m => ({ from: m.from, text: m.text, at: m.at })),
  createdAt: t.createdAt, updatedAt: t.updatedAt
});

router.use(needDb);

router.get('/admin/tickets', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const q = {};
    if (typeof req.query.status === 'string' && models().TICKET_STATES.includes(req.query.status)) q.status = req.query.status;
    const rows = await models().SupportTicket.find(q).sort({ createdAt: -1 }).limit(100).lean();
    await audit().create({ actor: req.user.id, action: 'support.staff_list', subject: q.status || 'all', detail: { count: rows.length } });
    res.json({ tickets: rows.map(t => ({ ...view(t), userId: t.userId })) });
  } catch (e) { next(e); }
});

router.post('/tickets', requireAuth, limit({ scope: 'support.create', windowMs: 10 * 60 * 1000, max: 5 }),
  idempotent('support.create'), async (req, res, next) => {
    try {
      const b = req.body || {};
      const { SupportTicket, TICKET_CATEGORIES } = models();
      const message = text(b.message, 2000);
      if (!TICKET_CATEGORIES.includes(b.category) || !message) return send(res, 'bad_request', { message: 'Pick a category and describe the problem (up to 2,000 characters).' });
      if (b.txRef != null && b.txRef !== '' && !(typeof b.txRef === 'string' && TXREF.test(b.txRef))) return send(res, 'bad_request', { message: 'That transaction reference is not valid.' });
      for (let i = 0; i < 3; i++) {
        try {
          const t = await SupportTicket.create({ ref: newRef(), userId: req.user.id, category: b.category,
            txRef: b.txRef || null, messages: [{ from: 'user', text: message }] });
          return res.status(201).json({ ticket: view(t.toObject()) });
        } catch (e) { if (!e || e.code !== 11000) throw e; }
      }
      return send(res, 'server_error');
    } catch (e) { next(e); }
  });

router.get('/tickets', requireAuth, async (req, res, next) => {
  try {
    const rows = await models().SupportTicket.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ tickets: rows.map(view) });
  } catch (e) { next(e); }
});

router.get('/tickets/:ref', requireAuth, async (req, res, next) => {
  try {
    if (!TICKET.test(req.params.ref)) return send(res, 'not_found');
    const t = await models().SupportTicket.findOne({ ref: req.params.ref, userId: req.user.id }).lean();
    return t ? res.json({ ticket: view(t) }) : send(res, 'not_found');
  } catch (e) { next(e); }
});

router.post('/tickets/:ref/messages', requireAuth, limit({ scope: 'support.reply', windowMs: 10 * 60 * 1000, max: 20 }),
  idempotent('support.reply'), async (req, res, next) => {
    try {
      if (!TICKET.test(req.params.ref)) return send(res, 'not_found');
      const msg = text((req.body || {}).text, 2000);
      if (!msg) return send(res, 'bad_request', { message: 'Write a message of up to 2,000 characters.' });
      const t = await models().SupportTicket.findOneAndUpdate(
        { ref: req.params.ref, userId: req.user.id, status: { $ne: 'closed' } },
        { $push: { messages: { from: 'user', text: msg } }, $set: { status: 'open', updatedAt: new Date() } },
        { new: true }).lean();
      return t ? res.json({ ticket: view(t) }) : send(res, 'not_found', { message: 'That ticket was not found, is closed, or is not yours.' });
    } catch (e) { next(e); }
  });

module.exports = router;
