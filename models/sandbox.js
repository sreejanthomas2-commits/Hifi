/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SANDBOX BOOK, RETRY KEYS, SUPPORT — the collections              ║
   ║                                                                   ║
   ║  The practice-money book has collections of its own, apart from   ║
   ║  the custody ledger (models/custody.js). Nothing can move a unit  ║
   ║  from one to the other, because no code touches both: a bug that  ║
   ║  forgets a filter can't mix practice money into a real balance.   ║
   ║                                                                   ║
   ║  Amounts are whole units (1 unit = 0.00000001 of the asset),      ║
   ║  stored as Decimal128 so the database can compare and add them    ║
   ║  exactly - "only if the balance is at least this much" is a       ║
   ║  condition on the update itself, which is what makes two          ║
   ║  simultaneous spends of one balance impossible.                   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const mongoose = require('mongoose');
const { Decimal128 } = mongoose.Schema.Types;

/* One row per person, asset and bucket. `available` is spendable;
   `locked` is theirs but committed (an open order, P2P escrow). The
   system's `mint` account issues each person's starting grant and is
   the only one allowed below zero, so the book always sums to zero. */
const SandboxAccountSchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  asset:     { type: String, required: true },
  bucket:    { type: String, required: true, enum: ['available', 'locked', 'mint'] },
  balance:   { type: Decimal128, required: true, default: () => mongoose.Types.Decimal128.fromString('0') },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });
SandboxAccountSchema.index({ userId: 1, asset: 1, bucket: 1 }, { unique: true });

/* Two entries per movement, one debit and one credit, sharing groupId.
   (groupId, leg) is unique, so the same movement can never be written
   twice - a retry finds the first one instead. */
const SandboxEntrySchema = new mongoose.Schema({
  groupId:      { type: String, required: true },
  leg:          { type: Number, required: true, enum: [0, 1] },
  userId:       { type: String, required: true },
  bucket:       { type: String, required: true },
  asset:        { type: String, required: true },
  direction:    { type: String, required: true, enum: ['debit', 'credit'] },
  amount:       { type: Decimal128, required: true },
  balanceAfter: { type: Decimal128, required: true },
  refType:      { type: String, required: true },
  refId:        { type: String, required: true },
  memo:         { type: String, default: '', maxlength: 200 },
  at:           { type: Date, default: Date.now }
}, { versionKey: false });
SandboxEntrySchema.index({ groupId: 1, leg: 1 }, { unique: true });
SandboxEntrySchema.index({ userId: 1, at: -1 });

const IdempotencyKeySchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  scope:     { type: String, required: true },
  key:       { type: String, required: true },
  hash:      { type: String, required: true },
  state:     { type: String, required: true, enum: ['started', 'done'] },
  code:      { type: Number },
  body:      { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, expires: 24 * 60 * 60 }
}, { versionKey: false });
IdempotencyKeySchema.index({ userId: 1, scope: 1, key: 1 }, { unique: true });

const TICKET_CATEGORIES = ['payment', 'card', 'p2p', 'trade', 'convert', 'deposit', 'withdrawal', 'earn', 'account', 'other'];
const TICKET_STATES = ['open', 'waiting_on_you', 'resolved', 'closed'];
const SupportTicketSchema = new mongoose.Schema({
  ref:       { type: String, required: true },
  userId:    { type: String, required: true },
  category:  { type: String, required: true, enum: TICKET_CATEGORIES },
  txRef:     { type: String, default: null },
  status:    { type: String, required: true, enum: TICKET_STATES, default: 'open' },
  messages:  [{ from: { type: String, enum: ['user', 'staff'], required: true },
                text: { type: String, required: true, maxlength: 2000 },
                at: { type: Date, default: Date.now } }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });
SupportTicketSchema.index({ ref: 1 }, { unique: true });
SupportTicketSchema.index({ userId: 1, createdAt: -1 });

const model = (name, schema, collection) =>
  mongoose.models[name] || mongoose.model(name, schema, collection);

module.exports = {
  SandboxAccount: model('SandboxAccount', SandboxAccountSchema, 'sandbox_accounts'),
  SandboxEntry:   model('SandboxEntry', SandboxEntrySchema, 'sandbox_entries'),
  IdempotencyKey: model('IdempotencyKey', IdempotencyKeySchema, 'idempotency_keys'),
  SupportTicket:  model('SupportTicket', SupportTicketSchema, 'support_tickets'),
  TICKET_CATEGORIES, TICKET_STATES
};
