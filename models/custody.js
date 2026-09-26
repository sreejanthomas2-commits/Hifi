/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CUSTODY DATA MODEL                                               ║
   ║                                                                   ║
   ║  Five collections, and the constraints on them are the product.   ║
   ║  A deposit system is not hard because the happy path is hard —    ║
   ║  it is hard because the watcher restarts mid-credit, two workers  ║
   ║  see the same transaction, a chain reorganises, and any of those  ║
   ║  must not create money.                                           ║
   ║                                                                   ║
   ║  · deposit_addresses  unique per (network, address) AND per       ║
   ║                       (xpubId, change, index) so one derivation   ║
   ║                       index is never handed to two people         ║
   ║  · deposit_txs        unique per (network, txHash, vout) — the    ║
   ║                       idempotency key that makes double-crediting ║
   ║                       impossible rather than unlikely             ║
   ║  · ledger_entries     append-only, double-entry. A balance is the ║
   ║                       sum of entries, never a column someone      ║
   ║                       overwrites                                  ║
   ║  · wallet_accounts    a cached balance for reads, rebuildable     ║
   ║                       from the ledger at any time; the ledger     ║
   ║                       wins every disagreement                     ║
   ║  · withdrawals        a request, a hold and a queue position —    ║
   ║                       never a key or a signed payload             ║
   ║  · audit_log          who did what, append-only                   ║
   ║                                                                   ║
   ║  No private key, seed, mnemonic or signing material appears in    ║
   ║  any schema here. There is nowhere to put one.                    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const mongoose = require('mongoose');

/* Amounts are stored as integer strings in the asset's base unit
   (satoshi, wei, …). Floating point has no business near a balance. */
const Amount = { type: String, required: true, default: '0' };

const DepositAddressSchema = new mongoose.Schema({
  userId:     { type: String, required: true, index: true },
  asset:      { type: String, required: true },
  network:    { type: String, required: true },
  address:    { type: String, required: true },
  xpubId:     { type: String, required: true },     // which account key derived it
  change:     { type: Number, required: true, default: 0 },
  index:      { type: Number, required: true },
  derivation: { type: String, required: true },     // the path, for the operator's recovery
  tag:        { type: String, default: '' },        // destination tag / memo where the chain uses one
  status:     { type: String, enum: ['active', 'retired'], default: 'active' },
  assignedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: null }
});
DepositAddressSchema.index({ network: 1, address: 1 }, { unique: true });
DepositAddressSchema.index({ xpubId: 1, change: 1, index: 1 }, { unique: true });
DepositAddressSchema.index({ userId: 1, asset: 1, network: 1, status: 1 });

const DepositTxSchema = new mongoose.Schema({
  network:       { type: String, required: true },
  txHash:        { type: String, required: true },
  vout:          { type: Number, required: true, default: 0 },
  addressId:     { type: String, required: true, index: true },
  address:       { type: String, required: true },
  userId:        { type: String, required: true, index: true },
  asset:         { type: String, required: true },
  amount:        Amount,                              // base units, as seen on chain
  contract:      { type: String, default: '' },       // token contract the transfer used
  confirmations: { type: Number, default: 0 },
  required:      { type: Number, required: true },
  blockHeight:   { type: Number, default: null },
  status: {
    type: String,
    enum: ['detected', 'confirming', 'confirmed', 'credited', 'rejected', 'orphaned'],
    default: 'detected', index: true
  },
  rejectedReason: { type: String, default: '' },
  firstSeenAt:  { type: Date, default: Date.now },
  creditedAt:   { type: Date, default: null },
  ledgerEntryId:{ type: String, default: null }
});
/* The whole safety of the credit path rests on this one line. */
DepositTxSchema.index({ network: 1, txHash: 1, vout: 1 }, { unique: true });

const LedgerEntrySchema = new mongoose.Schema({
  accountId:     { type: String, required: true, index: true },
  userId:        { type: String, required: true, index: true },
  asset:         { type: String, required: true },
  direction:     { type: String, enum: ['credit', 'debit'], required: true },
  amount:        Amount,
  balanceAfter:  Amount,
  referenceType: { type: String, required: true },   // 'deposit' | 'reversal' | …
  referenceId:   { type: String, required: true },
  groupId:       { type: String, required: true, index: true },  // both legs share this
  memo:          { type: String, default: '' },
  createdAt:     { type: Date, default: Date.now }
});
LedgerEntrySchema.index({ referenceType: 1, referenceId: 1, direction: 1 }, { unique: true });

/* kind: 'user' is what the person can spend; 'hold' is theirs but on its
   way out in a withdrawal; 'omnibus' is the other side of every deposit
   and payout. */
const WalletAccountSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  asset:     { type: String, required: true },
  kind:      { type: String, enum: ['user', 'hold', 'omnibus'], default: 'user' },
  available: Amount,
  pending:   Amount,
  updatedAt: { type: Date, default: Date.now }
});
WalletAccountSchema.index({ userId: 1, asset: 1, kind: 1 }, { unique: true });

/* A withdrawal is a request, an authorisation and a hold — the sending
   itself happens somewhere else, which is why there is no key field and
   no signed payload anywhere in this schema. */
const WithdrawalSchema = new mongoose.Schema({
  userId:         { type: String, required: true, index: true },
  idempotencyKey: { type: String, required: true },
  asset:          { type: String, required: true },
  network:        { type: String, required: true },
  toAddress:      { type: String, required: true },
  tag:            { type: String, default: '' },
  amount:         Amount,                            // base units, what leaves the balance
  fee:            Amount,                            // base units, taken from the amount
  receives:       Amount,                            // what lands at the destination
  feeBasis:       { type: String, default: '' },     // how the fee was worked out
  status: {
    type: String,
    enum: ['queued_for_signing', 'signing', 'broadcast', 'confirming', 'completed',
           'cancelled', 'rejected', 'failed'],
    default: 'queued_for_signing', index: true
  },
  failureReason:  { type: String, default: '' },
  txHash:         { type: String, default: '' },
  confirmations:  { type: Number, default: 0 },
  holdRef:        { type: String, default: '' },
  claimedAt:      { type: Date, default: null },     // a signer took it; expires so a dead signer does not hold it forever
  requestIp:      { type: String, default: '' },
  createdAt:      { type: Date, default: Date.now, index: true },
  broadcastAt:    { type: Date, default: null },
  completedAt:    { type: Date, default: null }
});
/* One key, one withdrawal — a retried request returns the first one
   instead of sending twice. */
WithdrawalSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
WithdrawalSchema.index({ status: 1, createdAt: 1 });

/* The second factor for withdrawals. The TOTP secret is stored only
   encrypted (lib/secretbox.js, AES-256-GCM, bound to this userId), with
   a pending slot for an enrolment that has not been confirmed yet. The
   last accepted counter is kept so a code cannot be used twice, and
   failures are counted so guessing is slowed and then stopped. */
const WithdrawalSecuritySchema = new mongoose.Schema({
  userId:          { type: String, required: true, unique: true },
  totpSecretEnc:   { type: String, default: '' },
  totpPendingEnc:  { type: String, default: '' },
  totpConfirmedAt: { type: Date, default: null },
  lastTotpCounter: { type: Number, default: null },
  failedAttempts:  { type: Number, default: 0 },
  lockedUntil:     { type: Date, default: null },
  updatedAt:       { type: Date, default: Date.now }
});

const AuditLogSchema = new mongoose.Schema({
  actor:     { type: String, required: true },
  action:    { type: String, required: true },
  subject:   { type: String, default: '' },
  detail:    { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
});

const NetworkStateSchema = new mongoose.Schema({
  network:     { type: String, required: true, unique: true },
  status:      { type: String, enum: ['open', 'paused', 'maintenance'], default: 'open' },
  message:     { type: String, default: '' },
  lastScanned: { type: Number, default: 0 },          // block height the watcher reached
  updatedAt:   { type: Date, default: Date.now }
});

const model = (name, schema, collection) =>
  mongoose.models[name] || mongoose.model(name, schema, collection);

module.exports = {
  DepositAddress: model('DepositAddress', DepositAddressSchema, 'deposit_addresses'),
  Withdrawal:     model('Withdrawal', WithdrawalSchema, 'withdrawals'),
  DepositTx:      model('DepositTx', DepositTxSchema, 'deposit_txs'),
  LedgerEntry:    model('LedgerEntry', LedgerEntrySchema, 'ledger_entries'),
  WalletAccount:  model('WalletAccount', WalletAccountSchema, 'wallet_accounts'),
  AuditLog:       model('AuditLog', AuditLogSchema, 'audit_log'),
  WithdrawalSecurity: model('WithdrawalSecurity', WithdrawalSecuritySchema, 'withdrawal_security'),
  NetworkState:   model('NetworkState', NetworkStateSchema, 'network_state')
};
