/* ╔══════════════════════════════════════════════════════════════════╗
   ║  TWO-FACTOR FOR WITHDRAWALS                                       ║
   ║                                                                   ║
   ║  The withdrawal route used to pass req.walletUser to the check -  ║
   ║  a field nothing ever set - so there was never a secret to check  ║
   ║  against. With WD_REQUIRE_2FA on, every withdrawal failed; with   ║
   ║  it off, none needed a second factor. This is the missing half:   ║
   ║                                                                   ║
   ║    begin    make a secret, keep it sealed as "pending", show the  ║
   ║             otpauth:// link once                                  ║
   ║    confirm  a correct code turns pending into the real secret     ║
   ║    check    a withdrawal's code: right secret, right window, not  ║
   ║             used before, not locked out, not cooling off          ║
   ║    disable  needs a valid code too, or a stolen session could     ║
   ║             switch the factor off and then withdraw               ║
   ║                                                                   ║
   ║  Secrets are sealed with lib/secretbox.js and never stored or     ║
   ║  logged in the clear. Without TOTP_ENCRYPTION_KEY nothing can be  ║
   ║  enrolled and every check fails - closed, not open.               ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const totp = require('../lib/totp');
const box = require('../lib/secretbox');
const { WithdrawalSecurity, AuditLog } = require('../models/custody');

const MAX_FAILS = 5;                    // wrong codes in a row before a lock
const LOCK_MS = 15 * 60 * 1000;

/* Withdrawals stay closed for a while after a factor is set up, so a
   stolen session cannot enrol its own authenticator and withdraw at
   once. The operator can change it; the default is a day. */
function coolOffMs() {
  const v = process.env.WD_COOLOFF_MS;
  return v == null || v === '' ? 24 * 60 * 60 * 1000 : Math.max(0, Number(v) || 0);
}

const audit = (actor, action) => AuditLog.create([{ actor, action, subject: actor }]).catch(() => {});

function lockedOut(p) {
  if (!p || !p.lockedUntil || new Date(p.lockedUntil).getTime() <= Date.now()) return null;
  const mins = Math.ceil((new Date(p.lockedUntil).getTime() - Date.now()) / 60000);
  return { ok: false, code: 'twofactor_locked', message: `Too many wrong codes. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` };
}

/* Count a wrong code; the fifth in a row locks the factor for a while. */
async function failed(userId) {
  const p = await WithdrawalSecurity.findOneAndUpdate({ userId },
    { $inc: { failedAttempts: 1 }, $set: { updatedAt: new Date() } }, { new: true });
  if (p && p.failedAttempts >= MAX_FAILS) {
    await WithdrawalSecurity.updateOne({ userId },
      { $set: { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MS), updatedAt: new Date() } });
    await audit(userId, 'twofactor.locked');
  }
}

async function status(userId) {
  const p = await WithdrawalSecurity.findOne({ userId });
  return {
    available: box.ready(),
    enrolled: !!(p && p.totpSecretEnc),
    pending: !!(p && p.totpPendingEnc),
    confirmedAt: (p && p.totpConfirmedAt) || null
  };
}

async function begin(userId, label) {
  if (!box.ready()) return { ok: false, code: 'twofactor_unconfigured', message: 'Two-factor is not set up on this server yet.' };
  const p = await WithdrawalSecurity.findOne({ userId });
  if (p && p.totpSecretEnc) {
    return { ok: false, code: 'already_enrolled', message: 'Two-factor is already on. Turn it off first to move it to a new device.' };
  }
  const { secret, uri } = totp.enrol(String(label || userId).slice(0, 64), 'Trending');
  await WithdrawalSecurity.updateOne({ userId },
    { $set: { totpPendingEnc: box.seal(secret, userId), updatedAt: new Date() } }, { upsert: true });
  await audit(userId, 'twofactor.enrol.started');
  // Returned once, to be shown once. Only the sealed copy is kept.
  return { ok: true, secret, uri };
}

async function confirm(userId, code) {
  const p = await WithdrawalSecurity.findOne({ userId });
  if (!p || !p.totpPendingEnc) return { ok: false, code: 'no_enrolment', message: 'Start setting up two-factor first.' };
  const lock = lockedOut(p);
  if (lock) return lock;
  let pending;
  try { pending = box.open(p.totpPendingEnc, userId); }
  catch (e) { return { ok: false, code: 'twofactor_unavailable', message: 'Two-factor cannot be checked on this server right now.' }; }
  const v = totp.verify(pending, code);
  if (!v.ok) { await failed(userId); return { ok: false, code: 'twofactor', message: v.reason }; }
  // Conditional on the pending secret just checked, so a second begin()
  // racing this one cannot have its secret confirmed by the first code.
  const r = await WithdrawalSecurity.updateOne({ userId, totpPendingEnc: p.totpPendingEnc }, {
    $set: {
      totpSecretEnc: p.totpPendingEnc, totpPendingEnc: '', totpConfirmedAt: new Date(),
      lastTotpCounter: v.counter, failedAttempts: 0, lockedUntil: null, updatedAt: new Date()
    }
  });
  if (!r.matchedCount) return { ok: false, code: 'conflict', message: 'Setup changed while that code was checked. Start again.' };
  await audit(userId, 'twofactor.enabled');
  return { ok: true };
}

/* A code for an action. `coolOff` is false only for turning the factor
   off, which must work however recently it was turned on. */
async function verifyFor(userId, code, { coolOff }) {
  const p = await WithdrawalSecurity.findOne({ userId });
  if (!p || !p.totpSecretEnc) {
    return { ok: false, code: 'twofactor_required', message: 'Turn on two-factor authentication before withdrawing.' };
  }
  const lock = lockedOut(p);
  if (lock) return lock;
  const wait = coolOffMs();
  const since = p.totpConfirmedAt ? Date.now() - new Date(p.totpConfirmedAt).getTime() : Infinity;
  if (coolOff && wait > 0 && since < wait) {
    const hrs = Math.ceil((wait - since) / 3600000);
    return { ok: false, code: 'cooling_off', message: `Two-factor was set up recently. Withdrawals open in about ${hrs} hour${hrs === 1 ? '' : 's'}.` };
  }
  let secret;
  try { secret = box.open(p.totpSecretEnc, userId); }
  catch (e) { return { ok: false, code: 'twofactor_unavailable', message: 'Two-factor cannot be checked on this server right now.' }; }
  const v = totp.verify(secret, code);
  if (!v.ok) { await failed(userId); return { ok: false, code: 'twofactor', message: v.reason }; }
  /* Claimed atomically. Of two requests carrying the same code, one moves
     the counter and the other finds it already moved - the old check read
     the counter and never wrote it back, so a code could be used again. */
  const claimed = await WithdrawalSecurity.findOneAndUpdate(
    { userId, $or: [{ lastTotpCounter: null }, { lastTotpCounter: { $lt: v.counter } }] },
    { $set: { lastTotpCounter: v.counter, failedAttempts: 0, updatedAt: new Date() } },
    { new: true });
  if (!claimed) return { ok: false, code: 'twofactor_reused', message: 'That code has already been used. Wait for the next one.' };
  return { ok: true, counter: v.counter };
}

const check = (userId, code) => verifyFor(userId, code, { coolOff: true });

async function disable(userId, code) {
  const v = await verifyFor(userId, code, { coolOff: false });
  if (!v.ok) return v;
  await WithdrawalSecurity.updateOne({ userId },
    { $set: { totpSecretEnc: '', totpPendingEnc: '', totpConfirmedAt: null, updatedAt: new Date() } });
  await audit(userId, 'twofactor.disabled');
  return { ok: true };
}

module.exports = { status, begin, confirm, check, disable, coolOffMs, MAX_FAILS };
