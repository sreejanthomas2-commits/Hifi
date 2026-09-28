/* ╔══════════════════════════════════════════════════════════════════╗
   ║  TRENDING PAY — the engine                                        ║
   ║                                                                   ║
   ║  Every payment follows one path, and the server owns every step:  ║
   ║                                                                   ║
   ║    quote     who (from the directory, never from the screen or a  ║
   ║              QR code), how much, which asset, the rate and its    ║
   ║              source, every fee, what arrives, when - frozen for   ║
   ║              60 seconds under a hash                              ║
   ║    confirm   the quote, still open, still unchanged, still for    ║
   ║              the same account; a recent sign-in; the person's     ║
   ║              acknowledgement of any warning; limits; a risk       ║
   ║              check. Then, in one change: the quote is spent, the  ║
   ║              transfer is written and the money moves.             ║
   ║    track     the transfer's state only ever moves forward, along  ║
   ║              allowed edges, on the server's own decision or a     ║
   ║              verified partner event                               ║
   ║    receipt   built from the transfer record, never from the page  ║
   ║                                                                   ║
   ║  Practice mode: the balances are practice money kept in the       ║
   ║  server's book (store.js), and cross-border payouts go to the     ║
   ║  sandbox partner. The rules are the ones real money would need.   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');
const CONFIG = require('../../config/pay.json');
const { fail, PayError, MINT, DUP } = require('./store');
const { normHandle, confusable } = require('./directory');
const { makeRisk } = require('../risk');

/* ── Units ───────────────────────────────────────────────────────── */
const ONE = 10n ** 8n;
function toUnits(v, maxDec) {
  const s = String(v == null ? '' : v).trim();
  if (!/^\d{1,13}(\.\d{1,8})?$/.test(s)) fail('bad_amount');
  const [w, f = ''] = s.split('.');
  if (maxDec != null && f.length > maxDec) fail('bad_amount', `At most ${maxDec} decimal places.`);
  const u = BigInt(w) * ONE + BigInt((f + '00000000').slice(0, 8));
  if (u <= 0n) fail('bad_amount');
  return u;
}
function fromUnits(u) {
  const n = BigInt(u), neg = n < 0n, a = neg ? -n : n;
  const frac = (a % ONE).toString().padStart(8, '0').replace(/0+$/, '');
  return (neg ? '-' : '') + (a / ONE).toString() + (frac ? '.' + frac : '');
}
const U = s => BigInt(String(s));                         // stored unit strings
const bpsOf = (u, bps) => (u * BigInt(bps) + 5000n) / 10000n;
const ZERO_DEC = new Set(['JPY', 'KRW', 'ISK', 'CLP', 'VND']);
const expOf = ccy => (ZERO_DEC.has(ccy) ? 0 : 2);
const floorTo = (u, dec) => { const step = 10n ** BigInt(8 - dec); return (u / step) * step; };
const ceilTo = (u, dec) => { const step = 10n ** BigInt(8 - dec); return ((u + step - 1n) / step) * step; };

/* ── States ──────────────────────────────────────────────────────── */
const STATUS = {
  awaiting_confirmation: 'Awaiting confirmation',
  processing: 'Processing',
  sent: 'Sent',
  recipient_processing: 'Recipient processing',
  completed: 'Completed',
  failed: 'Failed',
  refunded: 'Refunded',
  under_review: 'Under review',
  action_required: 'Action required'
};
const TERMINAL = new Set(['failed', 'refunded']);
const EDGES = {
  processing: ['sent', 'recipient_processing', 'completed', 'failed', 'refunded', 'under_review', 'action_required'],
  under_review: ['processing', 'sent', 'recipient_processing', 'completed', 'failed', 'refunded'],
  sent: ['recipient_processing', 'completed', 'refunded', 'under_review', 'action_required'],
  recipient_processing: ['completed', 'refunded', 'action_required'],
  action_required: ['recipient_processing', 'processing', 'completed', 'refunded'],
  completed: ['refunded']
};
const canMove = (from, to) => (EDGES[from] || []).includes(to);

const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const token = (n, rand) => Array.from(rand(n), b => ALPH[b % ALPH.length]).join('');
const canonical = v => (Array.isArray(v) ? v.map(canonical)
  : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { o[k] = canonical(v[k]); return o; }, {}) : v);
const sha = v => crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const DEMO_MERCHANT = 'merchant:demo-cafe';

function makePay(deps) {
  const { store, directory } = deps;
  const cfg = deps.config || CONFIG;
  const clock = deps.now || Date.now;
  const rand = deps.rand || (n => crypto.randomBytes(n));
  const fx = deps.fx;                                  // { rates() } from services/fx.js
  const risk = deps.risk || makeRisk({ now: clock });
  const partners = deps.partners || {};                 // name -> partner
  const env = deps.env || process.env;
  const ASSETS = cfg.assets;
  const XB = cfg.crossBorder;

  const assetOf = a => { const k = String(a || '').toUpperCase(); if (!ASSETS[k]) fail('bad_request', 'Pick an asset Trending Pay supports.'); return k; };
  const stable = a => !!(ASSETS[a] && ASSETS[a].stable);

  /* ── Secrets that sign codes and verify partners ───────────────── */
  async function secret(name, envName) {
    if (env[envName]) return env[envName];
    // Only a practice book on a developer's machine may make its own key;
    // production must be given one (store.js open() refuses to start without).
    if (env.NODE_ENV === 'production') fail('pay_unavailable', 'Trending Pay is missing a signing key on this server. Nothing was changed.');
    const had = await store.read(u => u.get('meta', 'secret:' + name));
    if (had) return had.value;
    return store.tx(async u => {
      const again = await u.get('meta', 'secret:' + name);
      if (again) return again.value;
      const value = crypto.randomBytes(32).toString('hex');
      await u.insert('meta', { _id: 'secret:' + name, value, at: clock() });
      return value;
    });
  }
  let qrKey = null, hookKey = null;
  const qrSecret = async () => (qrKey = qrKey || await secret('qr', 'PAY_QR_SECRET'));
  const hookSecret = async () => (hookKey = hookKey || await secret('webhook:sandbox', 'PAY_SANDBOX_WEBHOOK_SECRET'));

  /* ── Setup ─────────────────────────────────────────────────────── */
  async function init() {
    await store.init();
    await qrSecret(); await hookSecret();
    // A practice merchant run by Trending, so merchant payments can be tried.
    await store.tx(async u => {
      if (await u.get('profiles', DEMO_MERCHANT)) return;
      await u.insert('profiles', { _id: DEMO_MERCHANT, payId: '100000001', handle: null, displayName: 'Practice Café',
        merchant: { name: 'Practice Café', category: 'Café', verified: true, demo: true, since: clock() }, createdAt: clock(), grantedAt: clock() });
    });
    return api;
  }

  /* ── Profiles ──────────────────────────────────────────────────── */
  async function newPayId(u) {
    for (let i = 0; i < 20; i++) {
      const id = String(100000000 + (rand(4).readUInt32BE(0) % 900000000));
      if (!(await u.findOne('profiles', { payId: id }))) return id;
    }
    fail('server_error', 'Could not assign a Pay ID.');
  }

  /* Make sure an account has a Pay profile. A recipient gets one the
     first time someone pays them; their starting practice balance waits
     until they open Trending Pay themselves. */
  async function ensureProfile(u, uid, ident, grant) {
    let p = await u.get('profiles', uid);
    if (!p) {
      p = { _id: uid, payId: await newPayId(u), handle: ident && ident.handle || null, displayName: (ident && ident.displayName) || 'Trending user',
        merchant: null, createdAt: clock(), grantedAt: 0 };
      if (p.handle) await releaseHandle(u, p.handle, uid);
      await u.insert('profiles', p);
    } else if (ident && ident.handle && (ident.handle !== p.handle || ident.displayName !== p.displayName)) {
      await releaseHandle(u, ident.handle, uid);
      p = await u.update('profiles', uid, { handle: ident.handle, displayName: ident.displayName || p.displayName });
    }
    if (grant && !p.grantedAt) {
      for (const [asset, amount] of Object.entries(cfg.grant || {})) {
        await u.move({ asset, units: toUnits(amount), from: MINT, to: { userId: uid, bucket: 'available' }, refType: 'grant', refId: `${uid}:${asset}`, memo: 'Starting practice balance', at: clock() });
      }
      p = await u.update('profiles', uid, { grantedAt: clock() });
    }
    if (grant && !(await u.findOne('requests', { payee: uid, kind: 'code' }))) {
      await u.insert('requests', { _id: 'R' + token(10, rand), kind: 'code', payee: uid, asset: null, amount: null, note: '', orderRef: null,
        merchant: false, singleUse: false, expiresAt: null, status: 'open', createdAt: clock() });
    }
    return p;
  }
  // The directory says this handle is uid's now: an old holder here gave it up.
  async function releaseHandle(u, handle, uid) {
    const other = await u.findOne('profiles', { handle });
    if (other && other._id !== uid) await u.update('profiles', other._id, { handle: null });
  }

  const identity = p => p && ({ uid: p._id, handle: p.handle || null, displayName: p.displayName, payId: p.payId,
    merchant: p.merchant ? { name: p.merchant.name, category: p.merchant.category, verified: !!p.merchant.verified, demo: !!p.merchant.demo } : null });

  /* ── Me ────────────────────────────────────────────────────────── */
  async function me(uid, tokenStr, claims) {
    let ident = null;
    try { ident = await directory.profileOf(uid, tokenStr); } catch (e) { ident = null; }
    if (!ident && claims && claims.name) ident = { handle: null, displayName: String(claims.name).slice(0, 60) };
    const p = await store.tx(u => ensureProfile(u, uid, ident, true));
    const out = await store.read(async u => ({
      balances: await u.balances(uid),
      code: await u.findOne('requests', { payee: uid, kind: 'code' })
    }));
    return {
      profile: identity(p),
      balances: Object.fromEntries(Object.keys(ASSETS).map(a => {
        const b = out.balances[a] || { available: 0n, locked: 0n };
        return [a, { available: fromUnits(b.available || 0n), locked: fromUnits(b.locked || 0n) }];
      })),
      code: out.code ? await publicCode(out.code) : null,
      today: await usedToday(uid),
      assets: Object.fromEntries(Object.entries(ASSETS).map(([k, a]) => [k, { name: a.name, decimals: a.decimals, stable: !!a.stable, perTx: a.perTx, daily: a.daily }])),
      mode: 'practice', store: store.kind
    };
  }

  async function usedToday(uid) {
    const since = clock() - 24 * 3600 * 1000;
    const rows = await store.read(u => u.find('transfers', { payer: uid, createdAt: { $gte: since } }, {}));
    const out = {};
    rows.filter(t => !['failed', 'refunded'].includes(t.status)).forEach(t => { out[t.send.asset] = (out[t.send.asset] || 0n) + U(t.totalUnits); });
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, fromUnits(v)]));
  }

  /* ── Recipients ────────────────────────────────────────────────── */
  const PAYID = /^(?:TP-?)?(\d{9})$/i;

  /* Who "to" is, from the directory - or why it can't be paid. */
  async function resolve(payer, to, tokenStr) {
    const raw = String(to == null ? '' : to).trim();
    let p = null;
    const pid = PAYID.exec(raw.replace(/\s/g, ''));
    if (pid) {
      p = await store.read(u => u.findOne('profiles', { payId: pid[1] }));
      if (!p) fail('recipient_not_found', 'No Trending Pay account has that Pay ID.');
    } else {
      const h = normHandle(raw);
      if (!h) fail('recipient_not_found', 'Enter a Trending @handle or a 9-digit Pay ID.');
      let found = null;
      try { found = await directory.byHandle(h, tokenStr); }
      catch (e) { fail('directory_unavailable', 'Trending couldn’t check @handles just now, so it can’t confirm who that is. Use their 9-digit Pay ID, or scan their Trending Pay code.'); }
      if (!found) fail('recipient_not_found', `No Trending account has the handle @${h}.`);
      p = await store.tx(u => ensureProfile(u, found.uid, found, false));
    }
    if (p._id === payer) fail('own_account', "That's your own account. You can't pay yourself.");
    return identity(p);
  }

  /* Warnings about who is being paid: never paid before, a handle that
     looks like someone you have paid, a merchant nobody has verified. */
  async function recipientWarnings(payer, r) {
    const past = await store.read(u => u.find('transfers', { payer, status: { $in: ['completed', 'processing', 'sent', 'recipient_processing'] } }, { sort: { createdAt: -1 }, limit: 200 }));
    const paidBefore = past.some(t => t.recipient && t.recipient.uid === r.uid);
    const w = [];
    if (!paidBefore) w.push({ code: 'first_payment', text: `You haven't paid ${r.handle ? '@' + r.handle : r.displayName} before. Check this is the right account.` });
    if (r.handle) {
      const look = [...new Set(past.map(t => t.recipient && t.recipient.handle).filter(Boolean))].find(h => h !== r.handle && confusable(h, r.handle));
      if (look) w.push({ code: 'lookalike', ack: true, text: `@${r.handle} looks like @${look}, someone you've paid before. Scammers copy handles one character apart. Make sure this is who you mean.` });
    }
    if (r.merchant && !r.merchant.verified) w.push({ code: 'unverified_merchant', text: `${r.merchant.name} is a business account Trending hasn't verified.` });
    return { warnings: w, paidBefore };
  }

  /* ── Codes and requests ────────────────────────────────────────── */
  const requestTerms = r => ({ id: r._id, payee: r.payee, asset: r.asset, amount: r.amount,
    expiresAt: r.expiresAt, kind: r.kind, note: r.note || '', orderRef: r.orderRef || null,
    singleUse: !!r.singleUse, merchant: !!r.merchant });
  async function sigOf(r) {
    const body = JSON.stringify(canonical(requestTerms(r)));
    return crypto.createHmac('sha256', await qrSecret()).update(body).digest('base64url').slice(0, 22);
  }
  async function tokenOf(r) { return `TP1.${r._id}.${await sigOf(r)}`; }
  async function publicCode(r) {
    return { id: r._id, token: await tokenOf(r), kind: r.kind, asset: r.asset, amount: r.amount ? fromUnits(r.amount) : null,
      note: r.note || '', orderRef: r.orderRef || null, expiresAt: r.expiresAt, status: statusOfRequest(r), createdAt: r.createdAt, paidBy: r.paidBy || null, transferId: r.transferId || null };
  }
  const statusOfRequest = r => (r.status === 'open' && r.expiresAt && clock() >= r.expiresAt ? 'expired' : r.status);

  async function createRequest(uid, input, tokenStr) {
    const i = input || {};
    const p = await store.read(u => u.get('profiles', uid));
    if (!p) fail('bad_request', 'Open Trending Pay first.');
    const merchant = !!i.merchant;
    if (merchant && !p.merchant) fail('bad_request', 'Turn on merchant payments first.');
    const asset = assetOf(i.asset);
    const amount = i.amount == null || i.amount === '' ? null : toUnits(i.amount, ASSETS[asset].decimals).toString();
    if (merchant && !amount) fail('bad_amount', 'A merchant charge needs an amount.');
    const note = String(i.note || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 80);
    const orderRef = merchant ? String(i.orderRef || '').replace(/[^A-Za-z0-9 _#/-]/g, '').trim().slice(0, 32) || null : null;
    const hours = merchant ? cfg.requestHours.merchant : Math.min(Number(i.hours) || cfg.requestHours.default, cfg.requestHours.max);
    if (!Number.isFinite(hours) || hours <= 0) fail('bad_request', 'Choose a future expiry.');
    const r = { _id: 'R' + token(10, rand), kind: merchant ? 'merchant' : 'request', payee: uid, asset, amount, note, orderRef, merchant,
      singleUse: true, expiresAt: clock() + Math.round(hours * 3600 * 1000), status: 'open', createdAt: clock() };
    await store.tx(u => u.insert('requests', r));
    return publicCode(r);
  }

  async function myRequests(uid) {
    const rows = await store.read(u => u.find('requests', { payee: uid, kind: { $in: ['request', 'merchant'] } }, { sort: { createdAt: -1 }, limit: 50 }));
    return Promise.all(rows.map(publicCode));
  }

  async function cancelRequest(uid, id) {
    const r = await store.tx(u => u.update('requests', id, { status: 'cancelled', cancelledAt: clock() }, { payee: uid, status: 'open' }));
    if (!r) fail('not_found', 'That request is not open, or it is not yours.');
    return publicCode(r);
  }

  /* A practice charge from Trending's own practice café. */
  async function demoCharge(uid) {
    const amount = ['3.50', '4.20', '6.75', '12.00'][rand(1)[0] % 4];
    const r = { _id: 'R' + token(10, rand), kind: 'merchant', payee: DEMO_MERCHANT, asset: 'USDT', amount: toUnits(amount).toString(), note: 'Flat white and a croissant',
      orderRef: 'ORDER-' + token(5, rand), merchant: true, singleUse: true, expiresAt: clock() + cfg.requestHours.merchant * 3600 * 1000, status: 'open', createdAt: clock(), demoFor: uid };
    await store.tx(u => u.insert('requests', r));
    return publicCode(r);
  }

  async function becomeMerchant(uid, input) {
    const name = String((input || {}).name || '').replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, 40);
    const category = String((input || {}).category || 'Shop').replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, 30) || 'Shop';
    if (name.length < 2) fail('bad_request', 'Give your business a name.');
    const p = await store.tx(u => u.update('profiles', uid, { merchant: { name, category, verified: false, since: clock() } }));
    if (!p) fail('bad_request', 'Open Trending Pay first.');
    return identity(p);
  }

  /* ── Scanning: is this a real Trending code, and what does it ask? ─ */
  const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;
  const TOKEN = /^TP1\.(R[A-Z2-9]{10})\.([A-Za-z0-9_-]{22})$/;
  const WALLET = /^(bitcoin:|ethereum:|solana:|litecoin:|dogecoin:|tron:|0x[0-9a-fA-F]{40}\b|bc1[0-9a-z]{20,}|[13][1-9A-HJ-NP-Za-km-z]{25,34}$|T[1-9A-HJ-NP-Za-km-z]{33}$)/;

  async function scan(payer, payload, origin, tokenStr) {
    const raw = String(payload == null ? '' : payload);
    const text = raw.trim();
    const refuse = (code, message) => ({ ok: false, code, message });
    // Spaces or a line break around a pasted or scanned code are harmless;
    // an invisible character inside one is how a lookalike is built.
    if (text.replace(INVISIBLE, '') !== text) return refuse('tampered', 'This code contains hidden characters. Ask for a new code.');
    if (!text) return refuse('empty', 'Nothing was read from that code.');
    if (text.length > 600) return refuse('not_trending', 'That code is too long to be a Trending payment code. Nothing was paid.');
    let tok = null;
    if (/^TP1\./.test(text)) tok = text;
    else if (/^https?:\/\//i.test(text)) {
      let url;
      try { url = new URL(text); } catch (e) { return refuse('not_trending', 'That link is not a Trending payment code. Nothing was paid.'); }
      const m = /^#tpay=(TP1\.[A-Za-z0-9_.-]+)$/.exec(url.hash || '');
      const ours = origin && new URL(origin).origin === url.origin && !url.username && !url.password && url.pathname === '/' && !url.search;
      if (m && !ours) return refuse('foreign_link', `This payment link points at ${url.host}, not Trending. It may be a fake made to look like one - don't pay it, and don't sign in there.`);
      if (/#pay\?/.test(text)) return refuse('legacy_code', 'This is an old practice code from before Trending Pay. It can’t be paid; ask them for a new Trending Pay code.');
      if (!m) return refuse('not_trending', 'That link is not a Trending payment code. Nothing was paid.');
      tok = decodeURIComponent(m[1]);
    } else if (WALLET.test(text)) {
      return { ok: false, code: 'wallet_address', message: 'This is a crypto wallet address, not a Trending account. Paying it is an on-chain transfer: use Send to a wallet, which checks the address and network first.', address: text };
    } else if (/^#?pay\?/.test(text)) {
      return refuse('legacy_code', 'This is an old practice code from before Trending Pay. It can’t be paid; ask them for a new Trending Pay code.');
    } else {
      return refuse('not_trending', 'That is not a Trending payment code. Nothing was paid.');
    }

    const m = TOKEN.exec(tok);
    if (!m) return refuse('tampered', 'This code is damaged or has been changed. Don’t pay it — ask for a new one.');
    const r = await store.read(u => u.get('requests', m[1]));
    if (!r) return refuse('unknown', 'Trending has no record of this code. It may be fake. Don’t pay it.');
    const good = await sigOf(r);
    const a = Buffer.from(good), b = Buffer.from(m[2]);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return refuse('tampered', 'This code doesn’t match the one Trending issued — it has been changed. Don’t pay it.');
    const st = statusOfRequest(r);
    if (st === 'expired') return refuse('expired', 'This payment request has expired. Ask for a new one.');
    if (st === 'paid') return refuse('paid', 'This request has already been paid. Nothing was sent again.');
    if (st === 'cancelled') return refuse('cancelled', 'The person who made this request cancelled it.');
    if (st !== 'open') return refuse('reserved', 'A payment is already in progress for this request. Check its status before trying again.');
    if (r.payee === payer) return refuse('own_code', "That's your own code. You can't pay yourself.");
    const payee = await store.read(u => u.get('profiles', r.payee));
    if (!payee) return refuse('unknown', 'The account behind this code no longer exists.');
    const who = identity(payee);
    const { warnings } = await recipientWarnings(payer, who);
    return { ok: true, request: await publicCode(r), recipient: who, warnings };
  }

  /* ── Quotes ────────────────────────────────────────────────────── */
  async function rates() {
    const r = fx && await fx.rates();
    const age = r && clock() - Date.parse(r.date + 'T00:00:00Z');
    const fresh = r && r.ok && !r.stale && r.fetchedAt && r.fetchedAt <= clock() + 5000 && clock() - r.fetchedAt < 26 * 3600 * 1000 && age >= -86400000 && age < 7 * 86400000;
    if (!fresh) fail('rate_unavailable', 'Today’s exchange rate couldn’t be fetched, so no price was made. Nothing was sent.');
    return r;
  }

  async function quote(payer, input, tokenStr) {
    const i = input || {};
    const kind = i.kind === 'xb' ? 'xb' : i.token ? 'request' : 'p2p';
    const payerProfile = await store.read(u => u.get('profiles', payer));
    if (!payerProfile) fail('bad_request', 'Open Trending Pay first.');
    let q;
    if (kind === 'xb') q = await quoteXb(payer, i);
    else q = await quoteInternal(payer, i, kind, tokenStr);
    if (kind === 'xb') {
      const recent = await store.read(u => u.find('transfers', { payer, kind: 'xb', createdAt: { $gte: clock() - cfg.repeatMinutes * 60000 } }, {}));
      if (recent.some(t => !['failed', 'refunded'].includes(t.status) && t.recipient.xb.recipientId === q.recipient.xb.recipientId && t.send.asset === q.send.asset && t.send.units === q.send.units)) {
        q.warnings.push({ code: 'repeat', ack: true, text: 'You recently made the same transfer to this recipient. Continue only if you intend to pay twice.' });
        q.ack.push('repeat');
      }
    }
    const now = clock();
    q._id = 'Q' + token(12, rand);
    q.payer = payer;
    q.payerIdentity = identity(payerProfile);
    q.createdAt = now;
    q.expiresAt = now + cfg.quoteSeconds * 1000;
    q.status = 'open';
    q.hash = sha(economics(q));
    await store.tx(u => u.insert('quotes', q));
    return publicQuote(q);
  }

  // The fields a confirmation is bound to. Change any of them and the
  // stored hash no longer matches.
  const economics = q => ({ kind: q.kind, payer: q.payer, recipient: q.recipient, send: q.send, fees: q.fees, totalUnits: q.totalUnits,
    rate: q.rate, receive: q.receive, requestId: q.requestId || null, requestHash: q.requestHash || null,
    rail: q.rail, eta: q.eta, note: q.note, orderRef: q.orderRef, expiresAt: q.expiresAt,
    ack: q.ack, warnings: q.warnings, corridor: q.corridor || null });

  async function quoteInternal(payer, i, kind, tokenStr) {
    let recipient, req = null, asset, units;
    if (kind === 'request') {
      const s = await scan(payer, i.token, i.origin, tokenStr);
      if (!s.ok) fail(s.code === 'wallet_address' ? 'bad_request' : 'request_invalid', s.message);
      req = await store.read(u => u.get('requests', s.request.id));
      recipient = s.recipient;
      if (req.asset) asset = req.asset; else asset = assetOf(i.asset);
      units = req.amount ? U(req.amount) : toUnits(i.amount, ASSETS[asset].decimals);
    } else {
      recipient = await resolve(payer, i.to, tokenStr);
      asset = assetOf(i.asset);
      units = toUnits(i.amount, ASSETS[asset].decimals);
    }
    const lim = ASSETS[asset];
    if (units > toUnits(lim.perTx)) fail('over_limit', `One payment can be at most ${lim.perTx} ${asset}.`);
    const merchant = !!(req && req.merchant);
    const merchantFee = merchant ? bpsOf(units, cfg.merchantFeeBps) : 0n;
    const { warnings } = await recipientWarnings(payer, recipient);
    // The same person, the same amount, a few minutes ago: likely a double tap.
    const since = clock() - cfg.repeatMinutes * 60000;
    const recent = await store.read(u => u.find('transfers', { payer, 'recipient.uid': recipient.uid, 'send.asset': asset, createdAt: { $gte: since } }, {}));
    const dupe = recent.find(t => t.send.units === units.toString() && t.status !== 'failed');
    if (dupe) warnings.push({ code: 'repeat', ack: true, text: `You paid ${recipient.handle ? '@' + recipient.handle : recipient.displayName} exactly this amount ${Math.max(1, Math.round((clock() - dupe.createdAt) / 60000))} minute(s) ago (${dupe._id}). Pay again only if you mean to pay twice.` });
    if (stable(asset) && units >= toUnits(cfg.largeUsd)) warnings.push({ code: 'large', text: 'This is a large payment. Payments between Trending accounts can’t be pulled back once they complete.' });
    const note = String(i.note || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 80);
    return {
      kind: merchant ? 'merchant' : kind, rail: 'trending', recipient,
      requestId: req ? req._id : null, requestHash: req ? sha(requestTerms(req)) : null,
      orderRef: req ? req.orderRef : null, note: req ? req.note : note,
      send: { asset, units: units.toString() },
      fees: { trending: '0', provider: '0', network: '0', merchant: merchantFee.toString() },
      totalUnits: units.toString(),
      rate: null,
      receive: { kind: 'asset', code: asset, units: (units - merchantFee).toString() },
      eta: { text: 'Instantly', seconds: 0 },
      warnings, ack: warnings.filter(w => w.ack).map(w => w.code)
    };
  }

  function corridorOf(code) {
    const c = XB.corridors.find(x => x.country === String(code || '').toUpperCase());
    if (!c) fail('bad_request', 'Trending Pay doesn’t send to that country yet.');
    return c;
  }

  async function quoteXb(payer, i) {
    const c = corridorOf(i.corridor);
    const rec = await store.read(u => u.get('recipients', String(i.recipientId || '')));
    if (!rec || rec.owner !== payer) fail('bad_request', 'Pick who receives the money.');
    if (rec.country !== c.country) fail('bad_request', 'That recipient is in another country.');
    const asset = assetOf(i.asset || 'USDT');
    if (!XB.fundingAssets.includes(asset)) fail('bad_request', 'Cross-border transfers are paid from USDT or USDC.');
    const fxr = await rates();
    const r = fxr.rates[c.currency];
    if (!(r > 0)) fail('rate_unavailable', `There is no rate for ${c.currency} today, so no price was made.`);
    const rateU = toUnits(String(r));                        // units of currency per 1 USD, x1e8
    const stableU = toUnits(XB.stableRate);                  // USD per 1 USDT, x1e8
    const per = rateU * stableU / ONE;                       // currency per 1 unit of the asset
    const dec = expOf(c.currency);
    let sendU, receiveU;
    if (i.mode === 'receive') {
      const want = toUnits(i.amount, dec);
      sendU = ceilTo((want * ONE + per - 1n) / per, ASSETS[asset].decimals);
      receiveU = floorTo(sendU * per / ONE, dec);
    } else {
      sendU = toUnits(i.amount, ASSETS[asset].decimals);
      receiveU = floorTo(sendU * per / ONE, dec);
    }
    if (sendU < toUnits(c.min)) fail('below_minimum', `The smallest transfer to ${c.name} is ${c.min} ${asset}.`);
    if (sendU > toUnits(c.max)) fail('over_limit', `The largest transfer to ${c.name} is ${c.max} ${asset}.`);
    if (receiveU <= 0n) fail('bad_amount', 'That is too small to send.');
    const tfee = (() => { const f = bpsOf(sendU, XB.trendingFee.bps), min = toUnits(XB.trendingFee.min); return f > min ? f : min; })();
    const pfee = toUnits(c.providerFee);
    const partner = partners[XB.partner];
    const method = XB.methods[rec.method] || rec.method;
    return {
      kind: 'xb', rail: 'payout:' + XB.partner, corridor: c.country,
      recipient: { uid: null, handle: null, displayName: rec.name, payId: null, merchant: null,
        xb: { recipientId: rec._id, name: rec.name, country: c.country, countryName: c.name, method: rec.method, methodLabel: method, label: rec.label || '' } },
      requestId: null, orderRef: null, note: '',
      send: { asset, units: sendU.toString() },
      fees: { trending: tfee.toString(), provider: pfee.toString(), network: '0', merchant: '0' },
      totalUnits: (sendU + tfee + pfee).toString(),
      rate: { text: `1 ${asset} = ${fromUnits(per)} ${c.currency}`, value: fromUnits(per), from: asset, to: c.currency,
        legs: [
          { text: `1 ${asset} = ${XB.stableRate} USD`, source: 'Trending counts one stablecoin as one US dollar (practice rate)' },
          { text: `1 USD = ${r} ${c.currency}`, source: `${fxr.source}, ${fxr.date}` }
        ], markup: '0' },
      receive: { kind: 'fiat', code: c.currency, units: receiveU.toString() },
      eta: { text: `About a minute (${partner ? partner.label.toLowerCase() : 'practice payout partner'})`, live: (c.liveEta || {})[rec.method] || '', seconds: cfg.sandbox.partnerSeconds.complete },
      warnings: [{ code: 'practice_payout', text: 'Practice payout: the sandbox partner pays a test account. No bank or wallet is paid.' }],
      ack: []
    };
  }

  function publicQuote(q) {
    const f = q.fees;
    const lines = [
      { key: 'send', label: 'You send', value: fromUnits(q.send.units), unit: q.send.asset },
      { key: 'rate', label: 'Exchange rate', value: q.rate ? q.rate.text : '1:1 — no conversion', legs: q.rate ? q.rate.legs : [], note: q.rate ? 'FX markup: 0%. Trending and provider fees are listed separately.' : '' },
      { key: 'trending', label: 'Trending fee', value: fromUnits(f.trending), unit: q.send.asset },
      { key: 'provider', label: q.kind === 'xb' ? 'Payout partner fee' : 'Network fee', value: fromUnits(q.kind === 'xb' ? f.provider : f.network), unit: q.send.asset,
        note: q.kind === 'xb' ? '' : 'None — the money moves inside Trending, not on a blockchain.' },
      { key: 'total', label: 'Total', value: fromUnits(q.totalUnits), unit: q.send.asset, note: 'What leaves your balance' }
    ];
    if (U(f.merchant) > 0n) lines.push({ key: 'merchant', label: `Merchant’s fee (${cfg.merchantFeeBps / 100}%, paid by the business)`, value: fromUnits(f.merchant), unit: q.send.asset });
    lines.push({ key: 'receive', label: 'Recipient receives', value: fromUnits(q.receive.units), unit: q.receive.code });
    lines.push({ key: 'eta', label: 'Estimated arrival', value: q.eta.text });
    return {
      id: q._id, kind: q.kind, rail: q.rail, railLabel: railLabel(q.rail), recipient: q.recipient, payer: q.payerIdentity,
      send: { asset: q.send.asset, amount: fromUnits(q.send.units) }, total: fromUnits(q.totalUnits),
      fees: { trending: fromUnits(f.trending), provider: fromUnits(f.provider), network: fromUnits(f.network), merchant: fromUnits(f.merchant) },
      rate: q.rate, receive: { kind: q.receive.kind, code: q.receive.code, amount: fromUnits(q.receive.units) },
      eta: q.eta, note: q.note, orderRef: q.orderRef, requestId: q.requestId, corridor: q.corridor || null,
      lines, warnings: q.warnings, ack: q.ack, expiresAt: q.expiresAt, createdAt: q.createdAt
    };
  }
  const railLabel = r => (r === 'trending' ? 'Trending balance (inside Trending, instant)' : r === 'payout:sandbox' ? 'Practice payout partner → local account' : r);

  /* ── Confirming ────────────────────────────────────────────────── */
  async function confirm(payer, quoteId, opts) {
    const o = opts || {};
    const operationId = o.key ? sha({ payer, key: o.key }) : null;
    const operationHash = sha({ quoteId, acknowledge: o.acknowledge || {} });
    if (operationId) {
      const prior = await store.read(u => u.get('operations', operationId));
      if (prior) {
        if (prior.hash !== operationHash) fail('bad_request', 'This retry key belongs to a different payment.');
        return transfer(payer, prior.transferId);
      }
    }
    const q = await store.read(u => u.get('quotes', String(quoteId || '')));
    if (!q || q.payer !== payer) fail('not_found', 'That quote is not yours, or it doesn’t exist.');
    if (q.status === 'used') fail('quote_used', 'This quote was already paid. Nothing was sent again.');
    if (clock() >= q.expiresAt) fail('quote_expired', 'The price expired. Review a new quote before paying.');
    if (sha(economics(q)) !== q.hash) fail('quote_modified', 'This quote changed after it was made, so it was refused. Nothing was sent.');
    // Proving it's you: a sign-in, or a re-entered password, within minutes.
    if (!Number.isFinite(o.authTime) || !(o.authTime > 0) || o.authTime > clock() + 5000 || clock() - o.authTime > cfg.reauthSeconds * 1000) {
      fail('reauth_required', 'Confirm it’s you to send this payment.', { status: 401 });
    }
    const ack = o.acknowledge || {};
    for (const code of q.ack || []) {
      if (!ack[code]) fail('confirm_' + code, (q.warnings.find(w => w.code === code) || {}).text || 'Confirm the warning first.');
    }
    // The handle must still belong to the account the quote was made for.
    if (q.recipient.handle && q.kind !== 'xb') {
      let now = null;
      try { now = await directory.byHandle(q.recipient.handle, o.token, { fresh: true }); }
      catch (e) { fail('directory_unavailable', 'The recipient could not be verified again. Nothing was sent.'); }
      if (now === null || (now && now.uid !== q.recipient.uid)) fail('recipient_changed', `@${q.recipient.handle} now belongs to a different account, so this payment was stopped. Nothing was sent.`);
    }
    const units = U(q.totalUnits), asset = q.send.asset;
    const lim = ASSETS[asset];

    // Risk: someone else at the controls tends to pay new people, in bulk, fast.
    const { paidBefore } = q.kind === 'xb' ? { paidBefore: false } : await recipientWarnings(payer, q.recipient);
    const hist = await store.read(u => u.find('transfers', { payer, status: 'completed' }, { sort: { createdAt: -1 }, limit: 20 }));
    const typical = hist.filter(t => stable(t.send.asset)).map(t => Number(fromUnits(t.send.units)));
    const assessment = risk.assess({
      userId: payer, newAddress: !paidBefore,
      amountUsd: stable(asset) ? Number(fromUnits(units)) : 0,
      typicalUsd: typical.length ? typical.reduce((a, b) => a + b, 0) / typical.length : 0
    });

    const now = clock();
    const id = 'TP-' + token(10, rand);
    const t = {
      _id: id, kind: q.kind, rail: q.rail, quoteId: q._id, payer, payerIdentity: q.payerIdentity,
      recipient: q.recipient, requestId: q.requestId || null, orderRef: q.orderRef || null, note: q.note || '',
      send: q.send, fees: q.fees, totalUnits: q.totalUnits, rate: q.rate, receive: q.receive, eta: q.eta, corridor: q.corridor || null,
      risk: { score: assessment.score, decision: assessment.decision, reasons: assessment.reasons },
      status: 'processing', reason: '', action: null, partner: null, refunds: [],
      timeline: [{ status: 'awaiting_confirmation', at: q.createdAt, note: 'Quote made and shown to you' }, { status: 'processing', at: now, note: 'You confirmed it' }],
      createdAt: now, updatedAt: now, completedAt: null
    };
    const step = (status, note) => { t.status = status; t.updatedAt = clock(); t.timeline.push({ status, at: clock(), note }); if (status === 'completed') t.completedAt = clock(); };
    const payerA = { userId: payer, bucket: 'available' }, payerL = { userId: payer, bucket: 'locked' };

    let replayId = null;
    const draft = JSON.stringify(t);
    await store.tx(async u => {
      Object.assign(t, JSON.parse(draft));
      replayId = null;
      // Serialize the payer's limits and duplicate checks in Mongo as well
      // as the file store. Two quotes must not spend the daily cap twice.
      await u.update('profiles', payer, { lastConfirmNonce: id });
      if (operationId) {
        const prior = await u.get('operations', operationId);
        if (prior) {
          if (prior.hash !== operationHash) fail('bad_request', 'This retry key belongs to a different payment.');
          replayId = prior.transferId; return;
        }
      }
      const currentQuote = await u.get('quotes', q._id);
      if (!currentQuote || sha(economics(currentQuote)) !== q.hash) fail('quote_modified', 'The quote changed. Nothing was sent.');
      if (clock() >= q.expiresAt) fail('quote_expired', 'The quote expired before payment could be committed.');
      const recent = await u.find('transfers', { payer, createdAt: { $gte: clock() - 86400000 } }, {});
      const usedUnits = recent.filter(x => x.send.asset === asset && !['failed', 'refunded'].includes(x.status)).reduce((n, x) => n + U(x.totalUnits), 0n);
      if (usedUnits + units > toUnits(lim.daily)) fail('over_limit', `Your 24-hour limit is ${lim.daily} ${asset}.`);
      const repeat = recent.some(x => x.createdAt >= clock() - cfg.repeatMinutes * 60000 &&
        !['failed', 'refunded'].includes(x.status) && x.rail === q.rail &&
        x.recipient.uid === q.recipient.uid && (x.recipient.xb?.recipientId || null) === (q.recipient.xb?.recipientId || null) &&
        x.send.asset === asset && x.send.units === q.send.units);
      if (repeat && !(q.ack.includes('repeat') && ack.repeat)) fail('confirm_repeat', 'An identical payment was just made. Get a new quote and review the duplicate warning.');
      if (!(await u.update('quotes', q._id, { status: 'used', usedAt: now, transferId: id }, { status: 'open' }))) fail('quote_used', 'This quote was already paid. Nothing was sent again.');
      if (q.requestId && assessment.decision !== 'block') {
        const r = await u.get('requests', q.requestId);
        if (!r || statusOfRequest(r) !== 'open' || sha(requestTerms(r)) !== q.requestHash) fail('request_invalid', 'That request expired, changed, or is no longer open. Nothing was sent.');
        if (r.singleUse && !(await u.update('requests', r._id, { status: 'reserved', paidBy: payer, transferId: id }, { status: 'open' }))) fail('request_invalid', 'That request was just paid by someone else. Nothing was sent.');
      }
      if (assessment.decision === 'block') {
        step('failed', 'Stopped for your safety. Nothing left your balance.');
        t.reason = 'This looked like it might not be you: ' + assessment.reasons.join(' ') + ' Nothing was sent. Contact support if it was you.';
      } else if (assessment.decision === 'review' || q.kind === 'xb') {
        await u.move({ asset, units, from: payerA, to: payerL, refType: 'hold', refId: id, memo: 'Held for ' + id, at: now });
        if (assessment.decision === 'review') {
          step('under_review', 'Held for a safety review before it goes ahead');
          t.reason = assessment.reasons.join(' ');
          t.reviewDue = now + cfg.sandbox.reviewSeconds * 1000;
        }
      } else {
        await settleInternal(u, t, now);
        step('completed', t.kind === 'merchant' ? 'Paid to the merchant' : 'Arrived in their Trending balance');
      }
      await u.insert('transfers', t);
      if (operationId) await u.insert('operations', { _id: operationId, hash: operationHash, transferId: id, at: clock() });
    });
    if (replayId) return transfer(payer, replayId);
    if (t.kind === 'xb' && t.status === 'processing') await startPayout(t._id);
    return view(await store.read(u => u.get('transfers', id)), payer);
  }

  /* Money for a payment inside Trending: from the payer (available, or
     the hold if it was reviewed) to the recipient, and a merchant's fee
     to Trending. One reference per leg, so it can never land twice. */
  async function settleInternal(u, t, now, fromHold) {
    const asset = t.send.asset;
    const from = { userId: t.payer, bucket: fromHold ? 'locked' : 'available' };
    const fee = U(t.fees.merchant || '0');
    await u.move({ asset, units: U(t.send.units) - fee, from, to: { userId: t.recipient.uid, bucket: 'available' }, refType: 'pay', refId: t._id, memo: 'Trending Pay ' + t._id, at: now });
    if (fee > 0n) await u.move({ asset, units: fee, from, to: { userId: 'system:fees', bucket: 'available' }, refType: 'fee', refId: t._id, memo: 'Merchant fee ' + t._id, at: now });
    if (t.requestId) await u.update('requests', t.requestId, { status: 'paid', paidAt: now }, { transferId: t._id });
  }

  /* ── Cross-border: the partner does the payout ─────────────────── */
  async function startPayout(id) {
    const t = await store.read(u => u.get('transfers', id));
    if (!t || t.kind !== 'xb' || !['processing', 'under_review'].includes(t.status) || (t.partner && t.partner.ref)) return;
    const partner = partners[XB.partner];
    if (!partner) return;
    // Durable submission intent prevents a timeout being mistaken for a
    // rejection. Reconcile by the same transfer ID before any resubmission.
    if (t.partner && t.partner.submission) {
      if (!partner.lookup) return;                              // nothing to ask: an operator decides
      let found;
      try { found = await partner.lookup(id); } catch (e) { return; }   // partner unreachable: ask again later
      if (found && found.ref) {
        await store.tx(u => u.update('transfers', id, {
          partner: { name: partner.name, label: partner.label, ref: found.ref }, status: 'processing', reason: '', updatedAt: clock(),
          timeline: t.timeline.concat({ status: 'processing', at: clock(), note: 'The payout partner confirmed it has the payout; tracking resumed' })
        }, { status: t.status }));
        return;
      }
      // The partner says it never received it. Sending it again is safe:
      // the payout is keyed by this transfer's ID, so a late original and a
      // retry are one payout. After a few tries it waits for an operator.
      const tries = (t.partner.tries || 1);
      if (tries >= 5) return;
      const reset = await store.tx(async u => {
        const cur = await u.get('transfers', id);
        if (!cur || !cur.partner || cur.partner.ref || !cur.partner.submission) return false;
        await u.update('transfers', id, { partner: null, submissions: tries, status: 'processing', reason: '', updatedAt: clock(),
          timeline: cur.timeline.concat({ status: 'processing', at: clock(), note: 'The payout partner had no record of it, so it was sent again under the same reference' }) });
        return true;
      });
      if (!reset) return;
      return startPayout(id);
    }
    const claimed = await store.tx(async u => {
      const cur = await u.get('transfers', id);
      if (!cur || cur.status !== 'processing' || cur.partner) return false;
      await u.update('transfers', id, { partner: { name: partner.name, label: partner.label, ref: null, submission: 'pending', tries: (cur.submissions || 0) + 1 }, updatedAt: clock() });
      return true;
    });
    if (!claimed) return;
    let res = null;
    try {
      if (!partner) throw new Error('no partner');
      res = await partner.createPayout({ transferId: t._id, amount: fromUnits(t.receive.units), currency: t.receive.code, recipient: t.recipient.xb && { name: t.recipient.xb.name, country: t.recipient.xb.country, method: t.recipient.xb.method } });
    } catch (e) {
      // An HTTP/network error cannot prove whether the provider accepted.
      // Keep the hold and reconcile; never fabricate a failure or refund.
      await store.tx(async u => {
        const cur = await u.get('transfers', id);
        if (!cur || cur.status !== 'processing') return;
        await u.update('transfers', id, { status: 'under_review', reason: 'The payout result is not confirmed. Your balance remains reserved while Trending checks with the partner. Do not create another payment.', updatedAt: clock(),
          timeline: cur.timeline.concat({ status: 'under_review', at: clock(), note: 'Partner response uncertain; reconciliation required' }) });
      });
      return;
    }
    if (!res || typeof res.ref !== 'string' || !res.ref) return;
    await store.tx(u => u.update('transfers', id, { partner: { name: partner.name, label: partner.label, ref: res.ref }, updatedAt: clock() }));
  }

  /* A partner event, verified before anything is believed: the
     signature over the exact bytes, a timestamp within five minutes, and
     an event id never seen before. Then only an allowed state change. */
  async function webhook(partnerName, rawBody, headers) {
    if (partnerName !== 'sandbox' || !partners.sandbox) fail('not_found');
    const sig = String((headers && (headers['trending-signature'] || headers['Trending-Signature'])) || '');
    const m = /^t=(\d{9,11}),v1=([0-9a-f]{64})$/.exec(sig);
    if (!m) fail('bad_signature', 'Missing or malformed signature.', { status: 401 });
    const ts = Number(m[1]);
    if (Math.abs(clock() / 1000 - ts) > 300) fail('bad_signature', 'The event is too old or from the future.', { status: 401 });
    const want = crypto.createHmac('sha256', await hookSecret()).update(`${ts}.${rawBody}`).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(want), Buffer.from(m[2]))) fail('bad_signature', 'The signature does not match.', { status: 401 });
    let ev;
    try { ev = JSON.parse(String(rawBody)); } catch (e) { fail('bad_request', 'Not JSON.'); }
    if (!ev || !/^evt_[A-Za-z0-9]{6,40}$/.test(String(ev.id)) || typeof ev.transferId !== 'string' || typeof ev.type !== 'string') fail('bad_request', 'Not an event.');

    return store.tx(async u => {
      try { await u.insert('events', { _id: `${partnerName}:${ev.id}`, type: ev.type, transferId: ev.transferId, at: clock() }); }
      catch (e) { if (e.code === DUP) return { ok: true, duplicate: true }; throw e; }
      const t = await u.get('transfers', ev.transferId);
      if (!t || t.kind !== 'xb' || !t.partner || t.partner.name !== partnerName || t.partner.ref !== ev.ref) fail('partner_unavailable', 'Transfer reference is not reconciled yet. Retry this event.');
      if (String(ev.amount) !== fromUnits(t.receive.units) || ev.currency !== t.receive.code) fail('bad_request', 'Provider amount or currency does not match the authorized quote.');
      const d = ev.data || {};
      const map = {
        'payout.accepted': ['sent', 'The payout partner accepted it'],
        'payout.processing': ['recipient_processing', 'Being paid into the recipient’s account'],
        'payout.review': ['under_review', d.reason || 'The payout partner is checking it'],
        'payout.released': ['recipient_processing', 'Cleared; being paid into the recipient’s account'],
        'payout.action_required': ['action_required', 'The payout partner needs an answer from you'],
        'payout.completed': ['completed', 'Paid into the recipient’s account'],
        'payout.failed': ['refunded', d.reason || 'The payout failed']
      };
      const next = map[ev.type];
      if (!next) return { ok: true, ignored: 'unknown type' };
      const [to, note] = next;
      // A failed payout is not evidence of a post-settlement refund.
      if (t.status === 'completed' && to === 'refunded') return { ok: true, ignored: 'settled transfer requires a separate verified refund' };
      if (t.status === to || !canMove(t.status, to)) return { ok: true, ignored: `${t.status} → ${to} is not allowed` };
      const set = { status: to, updatedAt: clock(), timeline: t.timeline.concat({ status: to, at: clock(), note }) };
      const locked = { userId: t.payer, bucket: 'locked' };
      if (to === 'completed') {
        // The money has left: the converted amount and the partner's fee
        // to the partner, Trending's fee to Trending.
        await u.move({ asset: t.send.asset, units: U(t.send.units) + U(t.fees.provider), from: locked, to: { userId: 'system:payouts', bucket: 'available' }, refType: 'payout', refId: t._id, at: clock() });
        await u.move({ asset: t.send.asset, units: U(t.fees.trending), from: locked, to: { userId: 'system:fees', bucket: 'available' }, refType: 'fee', refId: t._id, at: clock() });
        set.completedAt = clock();
      }
      if (to === 'refunded') {
        await u.move({ asset: t.send.asset, units: U(t.totalUnits), from: locked, to: { userId: t.payer, bucket: 'available' }, refType: 'release', refId: t._id, at: clock() });
        set.reason = String(d.reason || 'The payout failed').replace(/[.\s]+$/, '') + '. The full amount, fees included, is back in your balance.';
        set.refunds = (t.refunds || []).concat({ at: clock(), units: t.totalUnits, why: d.reason || 'Payout failed' });
      }
      if (to === 'action_required') set.action = { question: String(d.question || 'The payout partner needs an answer.').slice(0, 300), options: ['confirm', 'cancel'] };
      if (to === 'under_review') set.reason = d.reason || 'The payout partner is checking it.';
      if (t.status === 'action_required' && to !== 'action_required') set.action = null;
      await u.update('transfers', t._id, set);
      return { ok: true, status: to };
    });
  }

  /* The person answers the partner's question. The answer goes to the
     partner; the transfer moves only when the partner's event comes. */
  async function respond(uid, id, answer) {
    const t = await store.read(u => u.get('transfers', id));
    if (!t || t.payer !== uid) fail('not_found');
    if (t.status !== 'action_required' || !t.action) fail('bad_request', 'Nothing is waiting for an answer.');
    if (!['confirm', 'cancel'].includes(answer)) fail('bad_request', 'Answer confirm or cancel.');
    const partner = partners[XB.partner];
    const r = partner ? await partner.resolve(t._id, answer) : { ok: false };
    if (!r.ok) fail('partner_unavailable', 'The payout partner didn’t take the answer. Try again shortly.');
    await store.tx(u => u.update('transfers', id, { action: { ...t.action, answered: answer, answeredAt: clock() }, updatedAt: clock(),
      timeline: t.timeline.concat({ status: 'action_required', at: clock(), note: answer === 'confirm' ? 'You confirmed the recipient' : 'You asked to cancel' }) }));
    return view(await store.read(u => u.get('transfers', id)), uid);
  }

  /* ── Reviews ───────────────────────────────────────────────────── */
  async function decideReview(id, decision, who) {
    const t = await store.read(u => u.get('transfers', id));
    // A payout whose submission is unconfirmed: an operator may send it
    // again (same reference, so still one payout), or stop it - but only
    // once the partner confirms it never received it.
    if (t && t.status === 'under_review' && t.partner && !t.partner.ref && t.partner.submission) return resolveUncertain(t, decision);
    if (!t || t.status !== 'under_review' || t.partner) fail('bad_request', 'That payment is not waiting for Trending’s review.');
    if (decision === 'approve') {
      await store.tx(async u => {
        const cur = await u.get('transfers', id);
        if (cur.status !== 'under_review') return;
        const tl = cur.timeline.concat({ status: 'processing', at: clock(), note: who === 'sandbox' ? 'Practice reviewer approved it (with real money, a person reviews it)' : 'Approved after review' });
        if (cur.kind === 'xb') { await u.update('transfers', id, { status: 'processing', timeline: tl, updatedAt: clock(), reason: '' }); return; }
        await settleInternal(u, cur, clock(), true);
        await u.update('transfers', id, { status: 'completed', completedAt: clock(), updatedAt: clock(), reason: '',
          timeline: tl.concat({ status: 'completed', at: clock(), note: 'Arrived in their Trending balance' }) });
      });
      await startPayout(id);
    } else {
      await store.tx(async u => {
        const cur = await u.get('transfers', id);
        if (cur.status !== 'under_review') return;
        await u.move({ asset: cur.send.asset, units: U(cur.totalUnits), from: { userId: cur.payer, bucket: 'locked' }, to: { userId: cur.payer, bucket: 'available' }, refType: 'release', refId: id, at: clock() });
        if (cur.requestId) await u.update('requests', cur.requestId, { status: 'open', paidBy: null, transferId: null }, { transferId: id });
        await u.update('transfers', id, { status: 'failed', updatedAt: clock(), reason: 'Stopped after a safety review. Nothing was sent; the held amount is back in your balance.',
          timeline: cur.timeline.concat({ status: 'failed', at: clock(), note: 'Stopped after review; money released' }) });
      });
    }
    return store.read(u => u.get('transfers', id));
  }

  async function resolveUncertain(t, decision) {
    const partner = partners[XB.partner];
    if (!partner || !partner.lookup) fail('partner_unavailable', 'The payout partner can’t be asked about this payout right now.');
    let found;
    try { found = await partner.lookup(t._id); } catch (e) { fail('partner_unavailable', 'The payout partner can’t be asked about this payout right now.'); }
    if (found && found.ref) {
      // It arrived after all: record it and let the partner's events decide.
      await store.tx(u => u.update('transfers', t._id, { partner: { name: partner.name, label: partner.label, ref: found.ref }, status: 'processing', reason: '', updatedAt: clock(),
        timeline: t.timeline.concat({ status: 'processing', at: clock(), note: 'The payout partner confirmed it has the payout; tracking resumed' }) }, { status: 'under_review' }));
      return store.read(u => u.get('transfers', t._id));
    }
    if (decision === 'approve') {
      await store.tx(u => u.update('transfers', t._id, { partner: null, submissions: 0, status: 'processing', reason: '', updatedAt: clock(),
        timeline: t.timeline.concat({ status: 'processing', at: clock(), note: 'Sent to the payout partner again by Trending, under the same reference' }) }, { status: 'under_review' }));
      await startPayout(t._id);
    } else {
      await store.tx(async u => {
        const cur = await u.get('transfers', t._id);
        if (!cur || cur.status !== 'under_review' || (cur.partner && cur.partner.ref)) return;
        await u.move({ asset: cur.send.asset, units: U(cur.totalUnits), from: { userId: cur.payer, bucket: 'locked' }, to: { userId: cur.payer, bucket: 'available' }, refType: 'release', refId: cur._id, at: clock() });
        await u.update('transfers', cur._id, { status: 'failed', updatedAt: clock(), reason: 'The payout partner confirmed it never received this payout, so Trending stopped it. Nothing was sent; the full amount is back in your balance.',
          timeline: cur.timeline.concat({ status: 'failed', at: clock(), note: 'Partner confirmed no payout exists; money released' }) });
      });
    }
    return store.read(u => u.get('transfers', t._id));
  }

  /* The payer may stop a payment Trending is still reviewing. */
  async function cancel(uid, id) {
    const t = await store.read(u => u.get('transfers', id));
    if (!t || t.payer !== uid) fail('not_found');
    if (t.status !== 'under_review' || t.partner) fail('bad_request', 'Only a payment still under Trending’s review can be cancelled here.');
    await decideReview(id, 'reject', uid);
    await store.tx(async u => {
      const cur = await u.get('transfers', id);
      await u.update('transfers', id, { reason: 'You cancelled it during the review. Nothing was sent; the held amount is back in your balance.' });
      return cur;
    });
    return view(await store.read(u => u.get('transfers', id)), uid);
  }

  /* ── Merchant refunds ──────────────────────────────────────────── */
  async function refund(uid, id) {
    const t = await store.read(u => u.get('transfers', id));
    // The merchant refunds; the practice café, which nobody can sign in
    // as, refunds when the person who paid it asks.
    const demo = t && t.recipient.uid === DEMO_MERCHANT && t.payer === uid;
    if (!t || (t.recipient.uid !== uid && !demo)) fail('not_found');
    if (t.kind !== 'merchant' || t.status !== 'completed') fail('bad_request', 'Only a completed merchant payment can be refunded.');
    const merchantId = t.recipient.uid;
    await store.tx(async u => {
      const cur = await u.get('transfers', id);
      if (cur.status !== 'completed') fail('bad_request', 'This payment was already refunded.');
      const asset = cur.send.asset, fee = U(cur.fees.merchant || '0');
      await u.move({ asset, units: U(cur.send.units) - fee, from: { userId: merchantId, bucket: 'available' }, to: { userId: cur.payer, bucket: 'available' }, refType: 'refund', refId: id, at: clock() });
      if (fee > 0n) await u.move({ asset, units: fee, from: { userId: 'system:fees', bucket: 'available' }, to: { userId: cur.payer, bucket: 'available' }, refType: 'refund-fee', refId: id, at: clock() });
      await u.update('transfers', id, { status: 'refunded', updatedAt: clock(), reason: `${cur.recipient.merchant ? cur.recipient.merchant.name : 'The merchant'} refunded it in full.`,
        refunds: (cur.refunds || []).concat({ at: clock(), units: cur.send.units, why: 'Merchant refund' }),
        timeline: cur.timeline.concat({ status: 'refunded', at: clock(), note: 'The merchant refunded the full amount' }) });
    });
    return view(await store.read(u => u.get('transfers', id)), uid);
  }

  /* ── Reading payments ──────────────────────────────────────────── */
  function view(t, uid) {
    if (!t) return null;
    const role = t.payer === uid ? 'sender' : 'recipient';
    const q = { ...t, fees: t.fees };
    return {
      id: t._id, kind: t.kind, role, rail: t.rail, railLabel: railLabel(t.rail), status: t.status, statusLabel: STATUS[t.status],
      sender: t.payerIdentity, recipient: t.recipient, note: t.note, orderRef: t.orderRef, requestId: t.requestId,
      send: { asset: t.send.asset, amount: fromUnits(t.send.units) }, total: fromUnits(t.totalUnits),
      fees: { trending: fromUnits(q.fees.trending), provider: fromUnits(q.fees.provider), network: fromUnits(q.fees.network), merchant: fromUnits(q.fees.merchant || '0') },
      rate: t.rate, receive: { kind: t.receive.kind, code: t.receive.code, amount: fromUnits(t.receive.units) }, eta: t.eta,
      reason: t.reason || '', action: role === 'sender' ? t.action : null, partner: t.partner ? { label: t.partner.label, ref: t.partner.ref } : null,
      timeline: t.timeline.map(x => ({ ...x, label: STATUS[x.status] })), refunds: (t.refunds || []).map(r => ({ at: r.at, amount: fromUnits(r.units), why: r.why })),
      canCancel: role === 'sender' && t.status === 'under_review' && !t.partner,
      canRefund: t.kind === 'merchant' && t.status === 'completed' && (role === 'recipient' || t.recipient.uid === DEMO_MERCHANT),
      createdAt: t.createdAt, updatedAt: t.updatedAt, completedAt: t.completedAt, mode: 'practice'
    };
  }

  async function transfers(uid, o) {
    const rows = await store.read(u => u.find('transfers', { $or: [{ payer: uid }, { 'recipient.uid': uid }] }, { sort: { createdAt: -1 }, limit: Math.min(Number(o && o.limit) || 50, 200) }));
    return rows.filter(t => t.payer === uid || t.status === 'completed' || t.status === 'refunded').map(t => view(t, uid));
  }
  async function transfer(uid, id) {
    const t = await store.read(u => u.get('transfers', String(id)));
    // A recipient sees a payment once it has reached them, not while it's held.
    if (!t || (t.payer !== uid && !(t.recipient.uid === uid && ['completed', 'refunded'].includes(t.status)))) fail('not_found');
    return view(t, uid);
  }

  /* A receipt is the transfer record, in words. */
  async function receipt(uid, id) {
    const v = await transfer(uid, id);
    const who = p => p && (p.merchant ? `${p.merchant.name}${p.merchant.verified ? '' : ' (business, not verified)'}` : p.xb ? `${p.xb.name} · ${p.xb.methodLabel}, ${p.xb.countryName}` : `${p.displayName}${p.handle ? ' (@' + p.handle + ')' : ''}`);
    const fees = [
      ['Trending fee', v.fees.trending, v.send.asset],
      [v.kind === 'xb' ? 'Payout partner fee' : 'Network fee', v.kind === 'xb' ? v.fees.provider : v.fees.network, v.send.asset]
    ];
    if (Number(v.fees.merchant) > 0) fees.push(['Merchant’s fee (paid by the business)', v.fees.merchant, v.send.asset]);
    return {
      title: 'Trending Pay receipt', mode: 'Practice payment — practice money, no real funds moved',
      transactionId: v.id, createdAt: v.createdAt, completedAt: v.completedAt,
      status: v.status, statusLabel: v.statusLabel,
      sender: who(v.sender) + (v.sender && v.sender.payId ? ` · Pay ID ${v.sender.payId}` : ''),
      recipient: who(v.recipient) + (v.recipient && v.recipient.payId ? ` · Pay ID ${v.recipient.payId}` : ''),
      amount: `${v.send.amount} ${v.send.asset}`,
      exchangeRate: v.rate ? `${v.rate.text} (${v.rate.legs.map(l => l.source).join('; ')})` : '1:1 — no conversion',
      fees: fees.map(([label, value, unit]) => ({ label, value: `${value} ${unit}` })),
      total: `${v.total} ${v.send.asset}`,
      amountExpected: `${v.receive.amount} ${v.receive.code}`,
      amountReceived: v.status === 'completed' ? `${v.receive.amount} ${v.receive.code}` : null,
      receiptNote: v.status === 'completed' ? 'Confirmed in the practice ledger.' : 'Not a confirmation of receipt. See the current transaction status.',
      rail: v.railLabel, partnerReference: v.partner ? v.partner.ref : null,
      reference: v.orderRef || v.note || null, requestId: v.requestId || null
    };
  }

  /* ── Cross-border recipients ───────────────────────────────────── */
  /* Only a name, a country and how they receive money. Account numbers
     are never asked for here: a live partner collects them in its own
     secure form, and Trending stores only the partner's reference. */
  async function saveRecipient(uid, input) {
    const i = input || {};
    const c = corridorOf(i.country);
    const name = String(i.name || '').replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (name.length < 2 || !/[A-Za-zÀ-ɏऀ-ॿ]/.test(name)) fail('bad_request', 'Enter the recipient’s full name, as their bank or wallet has it.');
    if (/\d{6,}/.test(name)) fail('bad_request', 'Enter a name only — never an account or card number.');
    if (!c.methods.includes(i.method)) fail('bad_request', 'Pick how they receive money.');
    const label = String(i.label || '').replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, 30);
    const r = { _id: 'XR' + token(10, rand), owner: uid, name, country: c.country, method: i.method, label, createdAt: clock() };
    await store.tx(u => u.insert('recipients', r));
    return r;
  }
  const recipients = uid => store.read(u => u.find('recipients', { owner: uid }, { sort: { createdAt: -1 } }));
  async function removeRecipient(uid, id) {
    const r = await store.read(u => u.get('recipients', id));
    if (!r || r.owner !== uid) fail('not_found');
    await store.tx(u => u.remove('recipients', id));
    return { ok: true };
  }
  const corridors = () => ({ fundingAssets: XB.fundingAssets, trendingFee: XB.trendingFee, methods: XB.methods,
    corridors: XB.corridors.map(c => ({ country: c.country, name: c.name, currency: c.currency, methods: c.methods, providerFee: c.providerFee, min: c.min, max: c.max, liveEta: c.liveEta })) });

  /* ── The clock's jobs ──────────────────────────────────────────── */
  /* Sandbox reviews that are due; payouts that never reached the partner
     (a restart between confirming and asking); the partner's own events;
     and quotes and retry keys past their life. */
  async function tick() {
    const now = clock();
    const due = await store.read(u => u.find('transfers', { status: 'under_review', reviewDue: { $lte: now } }, {}));
    for (const t of due) if (!t.partner) { try { await decideReview(t._id, 'approve', 'sandbox'); } catch (e) { /* next tick */ } }
    const stuck = await store.read(u => u.find('transfers', { kind: 'xb', status: { $in: ['processing', 'under_review'] } }, {}));
    for (const t of stuck) if ((!t.partner || !t.partner.ref) && now - t.updatedAt > 5000 && !t.reviewDue) await startPayout(t._id);
    if (partners.sandbox) await partners.sandbox.tick();
    const old = await store.read(u => u.find('quotes', { expiresAt: { $lt: now - 3600 * 1000 } }, { limit: 500 }));
    const keys = await store.read(u => u.find('idem', { at: { $lt: now - 24 * 3600 * 1000 } }, { limit: 500 }));
    if (old.length || keys.length) await store.tx(async u => { for (const x of old) await u.remove('quotes', x._id); for (const x of keys) await u.remove('idem', x._id); });
  }

  const reviews = () => store.read(u => u.find('transfers', { status: 'under_review' }, { sort: { createdAt: 1 } }));
  const reconcile = () => store.read(u => u.reconcile());

  /* Idempotency keys, in this store, for middleware/idempotency.js. */
  const idemStore = {
    create: doc => store.tx(u => u.insert('idem', { _id: `${doc.userId}|${doc.scope}|${doc.key}`, userId: doc.userId, scope: doc.scope, key: doc.key, hash: doc.hash, state: doc.state, at: clock() })),
    find: q => store.read(u => u.get('idem', `${q.userId}|${q.scope}|${q.key}`)),
    finish: (q, set) => store.tx(u => u.update('idem', `${q.userId}|${q.scope}|${q.key}`, set)),
    drop: q => store.tx(u => u.remove('idem', `${q.userId}|${q.scope}|${q.key}`))
  };

  const api = {
    init, me, resolve, scan, quote, confirm, respond, cancel, refund, transfers, transfer, receipt,
    createRequest, myRequests, cancelRequest, demoCharge, becomeMerchant,
    corridors, saveRecipient, recipients, removeRecipient,
    webhook, decideReview, reviews, reconcile, tick, idemStore, hookSecret, hookSecretNow: () => hookKey, view,
    STATUS, DEMO_MERCHANT, toUnits, fromUnits
  };
  return api;
}

module.exports = { makePay, STATUS, EDGES, canMove, toUnits, fromUnits, PayError };
