/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CARD CORE — the Trending Card's rules, with no screen attached   ║
   ║                                                                   ║
   ║  Everything that decides what happens to a card payment lives     ║
   ║  here, as plain functions over a plain state object, so the rules ║
   ║  can be tested without a browser and a screen can never quietly   ║
   ║  disagree with them. pages/card.js draws it; this file decides.   ║
   ║                                                                   ║
   ║  PRACTICE ONLY. Trending has no card-issuing partner, so there is ║
   ║  no real card, no card network and no real money. The practice    ║
   ║  card spends the practice balance (MNY) at made-up shops, and     ║
   ║  every rule below is the one a real programme would need:         ║
   ║                                                                   ║
   ║  · The card account is in US dollars. Crypto is sold for dollars  ║
   ║    AT APPROVAL, at the live price, and that is disclosed before   ║
   ║    the card exists and before every practice payment. A coin      ║
   ║    with no live price is never converted.                         ║
   ║  · Fees are their own lines, never hidden in a rate.              ║
   ║  · Amounts are whole cents and whole coin units. Debits round up  ║
   ║    to the coin's smallest unit, credits round down, and both say  ║
   ║    so.                                                            ║
   ║  · A network message seen twice gets the same answer twice, and   ║
   ║    money moves once.                                              ║
   ║  · A decline never moves money, and always says why.              ║
   ║                                                                   ║
   ║  CARD DATA. The state holds the last 4 digits and the expiry and  ║
   ║  nothing else from the card. A practice "number" is built at the  ║
   ║  moment it is shown, from zeros that fail every card network's    ║
   ║  check, and is never stored. A live card would show its number    ║
   ║  inside the issuing partner's own secure frame, so the number     ║
   ║  would never reach Trending's servers or this device's storage.   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CDX = (() => {

  /* ── The programme ───────────────────────────────────────────────── */
  const PROGRAM = {
    currency: 'USD',
    home: 'US',                       // outside this country is "international"
    homeName: 'the United States',
    caps:     { perTx: 250000, daily: 500000, monthly: 2000000, atmDaily: 50000 },  // cents
    defaults: { perTx: 100000, daily: 200000, monthly: 500000, atmDaily: 20000 },
    fees: {
      fxBps: 100,                     // 1% on a payment in another currency
      convBps: 100,                   // 1% to sell a coin that moves in price
      stableBps: 0,                   // USDT and USDC are dollars already
      atmCents: 200                   // $2 a cash withdrawal
    },
    standInCents: 5000,               // what the network may approve while the partner is down
    offlineCents: 10000,              // what a chip terminal may approve without going online
    holdDays: 7,                      // an uncollected approval is released after this
    disputeDays: 120,
    tipPct: 20,                       // how far a restaurant or taxi may add a tip
    revealMs: 30000,
    velocity: { max: 8, windowMs: 10 * 60 * 1000 },
    repeatMs: 2 * 60 * 1000,          // same shop, same amount, this close: say so
    years: { virtual: 3, physical: 4 },
    activationTries: 5,
    fxMaxAgeMs: 26 * 60 * 60 * 1000,  // a fetched rate older than this is not used
    fxMaxDays: 7                      // nor an ECB date older than this
  };

  const LIMIT_KEYS = ['perTx', 'daily', 'monthly', 'atmDaily'];
  const LIMIT_NAMES = { perTx: 'Single payment', daily: 'Daily', monthly: 'Monthly', atmDaily: 'Cash machine, daily' };

  /* The coins the card can sell. Only ones with a live market: the app's
     own tokens have a declared reference price, not a market, so they
     can't be spent by card. */
  const ASSETS = {
    USDT: { dec: 6, stable: true, name: 'Tether USD' },
    USDC: { dec: 6, stable: true, name: 'USD Coin' },
    BTC:  { dec: 8, name: 'Bitcoin' },
    ETH:  { dec: 8, name: 'Ether' },
    SOL:  { dec: 8, name: 'Solana' },
    BNB:  { dec: 8, name: 'BNB' }
  };
  const decOf = a => (ASSETS[a] ? ASSETS[a].dec : 8);
  const feeBps = a => (ASSETS[a] && ASSETS[a].stable ? PROGRAM.fees.stableBps : PROGRAM.fees.convBps);

  /* ── Where a payment happens ─────────────────────────────────────── */
  const CHANNELS = {
    online:      { label: 'Online',              physicalOnly: false },
    contactless: { label: 'Tap (contactless)',   physicalOnly: true },
    chip:        { label: 'Chip and PIN',        physicalOnly: true },
    atm:         { label: 'Cash machine',        physicalOnly: true }
  };

  /* Merchant category codes, grouped the way a person thinks about
     shops. The ones in UNSUPPORTED are the card partner's rule, not a
     setting: crypto cards can't buy more crypto, gamble, or load money
     elsewhere, because each turns the card into a cash-out route. */
  const CATS = {
    groceries: { label: 'Groceries', icon: 'local_grocery_store', mcc: [5411, 5422, 5441, 5451, 5462, 5499] },
    dining:    { label: 'Restaurants and cafés', icon: 'restaurant', mcc: [5812, 5813, 5814] },
    transport: { label: 'Transport and fuel', icon: 'directions_bus', mcc: [4111, 4112, 4121, 4131, 4784, 5541, 5542, 7523] },
    travel:    { label: 'Travel and hotels', icon: 'flight', mcc: [4411, 4511, 4722, 7011, 7012, 7512, 7513], ranges: [[3000, 3999]] },
    shopping:  { label: 'Shopping', icon: 'shopping_bag', mcc: [5200, 5311, 5331, 5399, 5651, 5661, 5691, 5732, 5734, 5941, 5942, 5945, 5977, 5999] },
    digital:   { label: 'Apps, games and subscriptions', icon: 'apps', mcc: [4899, 5815, 5816, 5817, 5818] },
    health:    { label: 'Health and pharmacy', icon: 'medical_services', mcc: [5912, 8011, 8021, 8062, 8099] },
    cash:      { label: 'Cash machines', icon: 'local_atm', mcc: [6011] },
    other:     { label: 'Everything else', icon: 'category', mcc: [] }
  };
  const UNSUPPORTED = {
    gambling:       { label: 'Gambling and betting', mcc: [7800, 7801, 7802, 7995] },
    quasi_cash:     { label: 'Buying crypto, money orders or prepaid top-ups', mcc: [6050, 6051, 6540] },
    money_transfer: { label: 'Money transfer services', mcc: [4829] },
    securities:     { label: 'Brokers and securities', mcc: [6211] }
  };
  const TIP_MCC = new Set([5812, 5813, 5814, 4121]);
  const PREAUTH_MCC = new Set([7011, 7512, 5542, 7513]);

  function categoryOf(mcc) {
    const m = Number(mcc);
    for (const [id, u] of Object.entries(UNSUPPORTED)) if (u.mcc.includes(m)) return { id, unsupported: true, label: u.label };
    for (const [id, c] of Object.entries(CATS)) {
      if (c.mcc.includes(m) || (c.ranges || []).some(([a, b]) => m >= a && m <= b)) return { id, unsupported: false, label: c.label };
    }
    return { id: 'other', unsupported: false, label: CATS.other.label };
  }

  /* ── Money, in whole units ───────────────────────────────────────── */
  const ZERO_DEC = new Set(['JPY', 'KRW', 'ISK', 'CLP', 'VND', 'UGX', 'XAF', 'XOF']);
  const expOf = ccy => (ZERO_DEC.has(ccy) ? 0 : 2);
  const SYMBOL = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹', AUD: 'A$', CAD: 'C$', SGD: 'S$', CHF: 'CHF ', THB: '฿', AED: 'AED ' };
  const pct = (cents, bps) => Math.round(cents * bps / 10000);

  function fmtMinor(minor, ccy) {
    const e = expOf(ccy), n = Number(minor) / 10 ** e, neg = n < 0;
    const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: e, maximumFractionDigits: e });
    return (neg ? '-' : '') + (SYMBOL[ccy] || ccy + ' ') + s;
  }
  const usd = cents => fmtMinor(cents, 'USD');

  /* "12.40" in a currency → whole minor units, or null. Strict: digits,
     one point, no more decimals than the currency has. */
  function parseMinor(raw, ccy) {
    const t = String(raw == null ? '' : raw).trim();
    const e = expOf(ccy);
    if (!/^\d+(\.\d*)?$/.test(t) && !/^\.\d+$/.test(t)) return null;
    const [w, f = ''] = t.split('.');
    if (f.length > e) return null;
    const minor = Number(w || '0') * 10 ** e + Number((f + '0'.repeat(e)).slice(0, e) || '0');
    return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
  }

  /* Cents → whole coin units at a price. Up for a debit, down for a
     credit, exact either way (BigInt), so a price like 109,700.12 never
     leaves a float's dust in anyone's balance. */
  function unitsFor(cents, price, dec, up) {
    const p = BigInt(Math.round(Number(price) * 1e8));
    if (p <= 0n || cents < 0) return null;
    const num = BigInt(cents) * (10n ** BigInt(dec)) * 1000000n;
    return Number(up ? (num + p - 1n) / p : num / p);
  }
  const toQty = (units, dec) => Number((units / 10 ** dec).toFixed(dec));
  const centsOf = (units, dec, price) => Math.round(units / 10 ** dec * price * 100);
  function fmtQty(q, a) {
    const d = decOf(a);
    return Number(q).toLocaleString('en-US', { minimumFractionDigits: ASSETS[a] && ASSETS[a].stable ? 2 : 0, maximumFractionDigits: d }) + ' ' + a;
  }
  const fmtPrice = p => '$' + Number(p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: p < 1 ? 6 : 2 });

  /* ── Exchange rates ──────────────────────────────────────────────── */
  /* `fx` is what /api/card/fx returned: units of each currency per US
     dollar, from the European Central Bank's daily reference. A rate
     too old to trust is treated as no rate: the payment is declined,
     never priced from a guess. */
  function fxUsable(fx, now) {
    if (!fx || !fx.ok || !fx.rates) return false;
    if (fx.fetchedAt && now - fx.fetchedAt > PROGRAM.fxMaxAgeMs) return false;
    const d = Date.parse(fx.date + 'T00:00:00Z');
    return Number.isFinite(d) && now - d <= PROGRAM.fxMaxDays * 86400000;
  }
  function toUsd(minor, ccy, fx, now) {
    if (ccy === 'USD') return { ok: true, cents: minor, fx: null };
    if (!/^[A-Z]{3}$/.test(ccy)) return { ok: false, code: 'currency_not_supported' };
    if (!fxUsable(fx, now)) return { ok: false, code: 'fx_unavailable' };
    const rate = Number(fx.rates[ccy]);
    if (!(rate > 0)) return { ok: false, code: 'currency_not_supported' };
    const cents = Math.round(minor / 10 ** expOf(ccy) / rate * 100);
    return { ok: true, cents, fx: { rate, date: fx.date, source: fx.source || 'European Central Bank reference rate' } };
  }

  /* ── State ───────────────────────────────────────────────────────── */
  function blank() {
    return {
      v: 1, agreed: 0, cards: [], txs: [], notes: [], seen: {}, owed: 0,
      limits: { ...PROGRAM.defaults },
      assets: {
        order: Object.keys(ASSETS),
        // Coins that move in price start off: selling BTC should be a choice.
        enabled: { USDT: true, USDC: true, BTC: false, ETH: false, SOL: false, BNB: false },
        preferred: 'USDT', fallback: true
      },
      notify: { payments: true, declines: true, refunds: true, large: 50000 },
      sim: { outage: false, pricesDown: false }
    };
  }

  /* A stored state from an older build, or a damaged one, comes back
     whole: every field the rules read exists and has the right type. */
  function normalize(raw) {
    const b = blank();
    if (!raw || typeof raw !== 'object') return b;
    const s = { ...b, ...raw };
    s.cards = Array.isArray(raw.cards) ? raw.cards : [];
    s.txs = Array.isArray(raw.txs) ? raw.txs : [];
    s.notes = Array.isArray(raw.notes) ? raw.notes : [];
    s.seen = raw.seen && typeof raw.seen === 'object' ? raw.seen : {};
    s.owed = Math.max(0, Math.round(Number(raw.owed) || 0));
    s.limits = { ...b.limits, ...(raw.limits || {}) };
    LIMIT_KEYS.forEach(k => { const v = Math.round(Number(s.limits[k])); s.limits[k] = v >= 100 && v <= PROGRAM.caps[k] ? v : b.limits[k]; });
    const a = raw.assets || {};
    s.assets = {
      order: Array.isArray(a.order) ? [...a.order.filter(x => ASSETS[x]), ...Object.keys(ASSETS).filter(x => !(a.order || []).includes(x))] : b.assets.order,
      enabled: { ...b.assets.enabled, ...(a.enabled || {}) },
      preferred: ASSETS[a.preferred] ? a.preferred : 'USDT',
      fallback: a.fallback !== false
    };
    s.assets.enabled[s.assets.preferred] = true;
    s.notify = { ...b.notify, ...(raw.notify || {}) };
    s.sim = { ...b.sim, ...(raw.sim || {}) };
    // Never trust a stored card number, whatever put it there.
    s.cards.forEach(c => { delete c.number; delete c.pan; delete c.cvc; delete c.cvv; delete c.pin; });
    return s;
  }

  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const mkId = (p, rand) => p + '-' + Array.from({ length: 8 }, () => ALPH[Math.floor(rand() * ALPH.length)]).join('');
  const findCard = (s, id) => s.cards.find(c => c.id === id) || null;
  const findTx = (s, id) => s.txs.find(t => t.id === id) || null;
  const stamp = (tx, now, text) => { (tx.timeline = tx.timeline || []).push({ t: now, text }); };

  /* ── Card numbers that can't be used ─────────────────────────────── */
  function luhnOk(digits) {
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    return sum % 10 === 0;
  }
  /* Twelve zeros and four digits chosen so the whole fails the Luhn
     check. No network routes a number starting 0, and no checkout
     accepts one that fails Luhn, so it can't be mistaken for a card. */
  function practiceLast4(rand) {
    for (let i = 0; i < 100; i++) {
      const l = String(Math.floor(rand() * 10000)).padStart(4, '0');
      if (!luhnOk('000000000000' + l)) return l;
    }
    return '0001';
  }
  /* Built when shown, from the card id; never stored, never logged. */
  function practiceDetails(card) {
    let h = 2166136261;
    for (const ch of String(card.id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return {
      number: '0000 0000 0000 ' + card.last4,
      cvc: String(h % 1000).padStart(3, '0'),
      exp: expText(card)
    };
  }

  /* ── Card lifecycle ──────────────────────────────────────────────── */
  const USABLE = ['active', 'frozen', 'inactive'];      // could still pay, now or once activated
  const expText = c => String(c.expMonth).padStart(2, '0') + '/' + String(c.expYear).slice(-2);
  const expEnd = c => new Date(c.expYear, c.expMonth, 1).getTime();   // midnight after the last day
  const isExpired = (c, now) => now >= expEnd(c);
  const expiringSoon = (c, now) => !isExpired(c, now) && expEnd(c) - now < 60 * 86400000;

  function statusOf(c, now) {
    if (USABLE.includes(c.status) && isExpired(c, now)) return 'expired';
    return c.status;
  }

  function issue(s, o) {
    const now = o.now, rand = o.rand || Math.random;
    const kind = o.kind === 'physical' ? 'physical' : 'virtual';
    if (!o.force && s.cards.some(c => c.kind === kind && USABLE.includes(statusOf(c, now)))) {
      return { ok: false, msg: kind === 'virtual' ? 'You already have a virtual card.' : 'You already have a physical card, or one on its way.' };
    }
    const d = new Date(now);
    const card = {
      id: mkId('CRD', rand), kind,
      status: kind === 'virtual' ? 'active' : 'inactive',
      last4: o.last4 || practiceLast4(rand),
      expMonth: d.getMonth() + 1, expYear: d.getFullYear() + PROGRAM.years[kind],
      name: String(o.name || 'PRACTICE CARDHOLDER').toUpperCase().slice(0, 26),
      createdAt: now, activatedAt: kind === 'virtual' ? now : 0,
      controls: { online: true, international: true, contactless: kind === 'physical', atm: false },
      blocked: [],
      ship: kind === 'physical' ? { state: 'ordered', at: { ordered: now } } : null,
      tries: 0, replaces: o.replaces || null, replacedBy: null
    };
    s.cards.push(card);
    return { ok: true, card };
  }

  const SHIP = ['ordered', 'printed', 'shipped', 'delivered'];
  const SHIP_TEXT = { ordered: 'Ordered', printed: 'Made', shipped: 'On its way', delivered: 'Delivered' };
  function advanceShip(s, id, now) {
    const c = findCard(s, id);
    if (!c || !c.ship) return { ok: false, msg: 'That card has no delivery.' };
    const i = SHIP.indexOf(c.ship.state);
    if (i >= SHIP.length - 1) return { ok: false, msg: 'It has already been delivered.' };
    c.ship.state = SHIP[i + 1];
    c.ship.at[c.ship.state] = now;
    return { ok: true, state: c.ship.state };
  }

  function activate(s, id, typed, now) {
    const c = findCard(s, id);
    if (!c || c.kind !== 'physical') return { ok: false, msg: 'Only a physical card needs activating.' };
    if (c.status !== 'inactive') return { ok: false, msg: 'This card is already activated.' };
    if (SHIP.indexOf(c.ship && c.ship.state) < SHIP.indexOf('shipped')) return { ok: false, msg: "Activate the card once it's in your hands." };
    if (c.tries >= PROGRAM.activationTries) return { ok: false, locked: true, msg: 'Too many wrong tries. Contact support to activate this card.' };
    if (String(typed || '').trim() !== c.last4) {
      c.tries++;
      const left = PROGRAM.activationTries - c.tries;
      return { ok: false, locked: left <= 0, msg: left > 0 ? `Those aren't the last 4 digits on the card. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Contact support to activate this card.' };
    }
    c.status = 'active';
    c.activatedAt = now;
    c.tries = 0;
    // A renewed or repaired card takes over from the one it replaces.
    const old = c.replaces && findCard(s, c.replaces);
    if (old && USABLE.includes(old.status)) { old.status = 'replaced'; old.closedAt = now; }
    return { ok: true };
  }

  function freeze(s, id, now) {
    const c = findCard(s, id);
    if (!c || c.status !== 'active') return { ok: false, msg: 'Only an active card can be frozen.' };
    c.status = 'frozen'; c.frozenAt = now;
    return { ok: true };
  }
  function unfreeze(s, id, now) {
    const c = findCard(s, id);
    if (!c || c.status !== 'frozen') return { ok: false, msg: 'This card is not frozen.' };
    c.status = 'active'; c.frozenAt = 0; c.unfrozenAt = now;
    return { ok: true };
  }

  /* Protective, so it asks nothing: a thief gains nothing by blocking
     your card, and the owner may have seconds to spare. */
  function report(s, id, why, now) {
    const c = findCard(s, id);
    if (!c || !USABLE.includes(c.status)) return { ok: false, msg: 'This card is already closed.' };
    c.status = why === 'stolen' ? 'stolen' : 'lost';
    c.closedAt = now;
    const pending = s.txs.filter(t => t.cardId === id && t.status === 'pending').length;
    return { ok: true, pending };
  }

  function close(s, id, now) {
    const c = findCard(s, id);
    if (!c || !USABLE.includes(c.status)) return { ok: false, msg: 'This card is already closed.' };
    c.status = 'closed'; c.closedAt = now;
    return { ok: true };
  }

  /* Replacing. A renewal or a damaged card keeps the number - only the
     expiry and security code change - and the old card works until the
     new one is activated. A compromised, lost or stolen card gets a new
     number and the old one stops at once. */
  const REPLACE = {
    damaged:     { label: 'Damaged or not working', sameNumber: true, physicalOnly: true },
    expiring:    { label: 'Expired or expiring soon', sameNumber: true },
    compromised: { label: 'Someone else may have the details', sameNumber: false },
    lost:        { label: 'Lost', sameNumber: false },
    stolen:      { label: 'Stolen', sameNumber: false }
  };
  function replacePlan(c, reason) {
    const r = REPLACE[reason];
    return {
      sameNumber: r.sameNumber,
      oldStops: !r.sameNumber || c.kind === 'virtual' ? 'now' : 'when the new card is activated',
      newWorks: c.kind === 'virtual' ? 'straight away' : 'once it arrives and you activate it',
      fee: 0
    };
  }
  function replace(s, id, reason, now, rand) {
    const c = findCard(s, id);
    const r = REPLACE[reason];
    if (!c || !r) return { ok: false, msg: 'Pick a reason.' };
    if (c.replacedBy) return { ok: false, msg: 'This card has already been replaced.' };
    if (r.physicalOnly && c.kind !== 'physical') return { ok: false, msg: 'A virtual card can’t be damaged. Pick another reason.' };
    if (['closed', 'replaced'].includes(c.status)) return { ok: false, msg: 'A closed card can’t be replaced. Get a new card instead.' };
    if ((c.status === 'lost' || c.status === 'stolen') && r.sameNumber) return { ok: false, msg: 'A lost or stolen card always gets a new number.' };
    if (reason === 'expiring' && !isExpired(c, now) && !expiringSoon(c, now)) return { ok: false, msg: `This card is valid until ${expText(c)}. It can be renewed in its last 60 days.` };
    const out = issue(s, { kind: c.kind, name: c.name, last4: r.sameNumber ? c.last4 : undefined, replaces: c.id, force: true, now, rand });
    const n = out.card;
    n.controls = { ...c.controls };
    n.blocked = [...c.blocked];
    c.replacedBy = n.id;
    if (!r.sameNumber) { if (USABLE.includes(c.status)) { c.status = reason === 'stolen' ? 'stolen' : reason === 'lost' ? 'lost' : 'closed'; c.closedAt = now; } }
    else if (c.kind === 'virtual' && USABLE.includes(c.status)) { c.status = 'replaced'; c.closedAt = now; }
    return { ok: true, card: n, plan: replacePlan(c, reason) };
  }

  /* ── Controls and limits ─────────────────────────────────────────── */
  const CONTROLS = {
    online:        { label: 'Online payments', sub: 'Shopping on websites and in apps' },
    international: { label: 'International payments', sub: `Shops outside ${PROGRAM.homeName}` },
    contactless:   { label: 'Contactless', sub: 'Tapping the card to pay', physicalOnly: true },
    atm:           { label: 'Cash machines', sub: 'Withdrawing cash', physicalOnly: true }
  };
  /* Whether a change makes the card easier to use. Those need the owner
     to prove it's them; making it harder never does. */
  const loosensControl = (c, key, on) => !!on && !c.controls[key];
  const loosensBlock = (c, cat, blocked) => !blocked && c.blocked.includes(cat);

  function setControl(s, id, key, on) {
    const c = findCard(s, id);
    if (!c || !CONTROLS[key]) return { ok: false, msg: 'Unknown setting.' };
    if (CONTROLS[key].physicalOnly && c.kind !== 'physical') return { ok: false, msg: 'Only a physical card can do that.' };
    c.controls[key] = !!on;
    return { ok: true };
  }
  function setBlocked(s, id, cat, blocked) {
    const c = findCard(s, id);
    if (!c || !CATS[cat]) return { ok: false, msg: 'Unknown category.' };
    c.blocked = c.blocked.filter(x => x !== cat);
    if (blocked) c.blocked.push(cat);
    return { ok: true };
  }
  /* Limits are the account's, shared by every card, so a replacement
     card can't start the day with a fresh allowance. */
  function checkLimit(s, key, cents) {
    if (!LIMIT_KEYS.includes(key)) return { ok: false, msg: 'Unknown limit.' };
    if (!Number.isSafeInteger(cents) || cents < 100) return { ok: false, msg: 'A limit must be at least $1.' };
    if (cents > PROGRAM.caps[key]) return { ok: false, msg: `The most the card allows is ${usd(PROGRAM.caps[key])}.` };
    const L = { ...s.limits, [key]: cents };
    if (L.perTx > L.daily) return { ok: false, msg: 'A single payment can’t be more than the daily limit.' };
    if (L.daily > L.monthly) return { ok: false, msg: 'The daily limit can’t be more than the monthly one.' };
    if (L.atmDaily > L.daily) return { ok: false, msg: 'The cash limit can’t be more than the daily limit.' };
    return { ok: true, raises: cents > s.limits[key] };
  }
  function setLimit(s, key, cents) {
    const r = checkLimit(s, key, cents);
    if (r.ok) s.limits[key] = cents;
    return r;
  }

  /* ── Spending assets ─────────────────────────────────────────────── */
  function setEnabled(s, a, on) {
    if (!ASSETS[a]) return { ok: false, msg: 'Unknown coin.' };
    if (!on && s.assets.preferred === a) return { ok: false, msg: 'Pick another preferred coin before turning this one off.' };
    s.assets.enabled[a] = !!on;
    return { ok: true };
  }
  function setPreferred(s, a) {
    if (!ASSETS[a]) return { ok: false, msg: 'Unknown coin.' };
    s.assets.preferred = a;
    s.assets.enabled[a] = true;
    return { ok: true };
  }
  function moveAsset(s, a, dir) {
    const o = s.assets.order, i = o.indexOf(a), j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= o.length) return { ok: false };
    [o[i], o[j]] = [o[j], o[i]];
    return { ok: true };
  }
  /* The order the card tries coins in: the preferred one, then - if
     back-up is on - the others that are turned on, in your order. One
     coin pays each payment; it is never split across two. */
  function fundingOrder(s) {
    const a = s.assets;
    const rest = a.fallback ? a.order.filter(x => x !== a.preferred && a.enabled[x]) : [];
    return [a.preferred, ...rest];
  }

  /* Which coin would pay `cents`, at what price, costing what. */
  function pick(s, cents, env, only) {
    const tried = [];
    for (const a of only ? [only] : fundingOrder(s)) {
      const q = env.wallet.quote(a) || {};
      if (!q.live || !(q.usd > 0)) { tried.push({ asset: a, why: 'no_price' }); continue; }
      const bps = feeBps(a), fee = pct(cents, bps), total = cents + fee;
      const units = unitsFor(total, q.usd, decOf(a), true);
      const qty = toQty(units, decOf(a));
      const have = Number(env.wallet.balance(a)) || 0;
      if (have + 1e-12 < qty) {
        tried.push({ asset: a, why: 'short', haveCents: Math.floor(have * q.usd * 100), needCents: total });
        continue;
      }
      return { ok: true, pick: { asset: a, price: q.usd, priceAt: q.at || env.now, source: q.source || '', bps, fee, total, units, qty }, tried };
    }
    const allNoPrice = tried.length > 0 && tried.every(t => t.why === 'no_price');
    return { ok: false, code: allNoPrice ? 'conversion_unavailable' : 'insufficient_funds', tried };
  }

  /* ── Spending so far ─────────────────────────────────────────────── */
  const COUNTS = new Set(['pending', 'completed', 'offline', 'partially_refunded', 'refunded']);
  const billed = t => (t.final ? t.final.billing : t.billing) || 0;
  function spent(s, now) {
    const d = new Date(now);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const month = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    let dayC = 0, monthC = 0, atmC = 0;
    s.txs.forEach(t => {
      if (t.kind === 'repayment' || !COUNTS.has(t.status)) return;
      const b = billed(t);
      if (t.t >= month) monthC += b;
      if (t.t >= day) { dayC += b; if (t.kind === 'atm') atmC += b; }
    });
    return { day: dayC, month: monthC, atm: atmC };
  }

  /* ── Notifications ───────────────────────────────────────────────── */
  const NOTE_MAX = 100;
  function note(s, n) {
    const kind = n.kind || 'security';
    const on = kind === 'payment' ? s.notify.payments
      : kind === 'decline' ? s.notify.declines
      : kind === 'refund' ? s.notify.refunds
      : true;                                    // security and money owed are always sent
    const large = kind === 'payment' && n.cents >= s.notify.large;
    if (!on && !large) return null;
    const e = { id: 'n' + n.now.toString(36) + Math.random().toString(36).slice(2, 5), t: n.now, kind, title: n.title, body: n.body, txId: n.txId || null, read: false };
    s.notes.unshift(e);
    s.notes.length = Math.min(s.notes.length, NOTE_MAX);
    return e;
  }

  /* ── Authorisation ───────────────────────────────────────────────── */
  /* env: { now, rand, wallet, fx, outage, paused }
     wallet: { quote(a) → {usd, live, at, source}, balance(a), debit(a, qty, meta) → bool, credit(a, qty, meta) → bool } */
  function baseTx(s, req, card, env) {
    const m = req.merchant || {};
    const cat = categoryOf(m.mcc);
    return {
      id: mkId('CTX', env.rand || Math.random),
      networkId: req.networkId || null,
      cardId: card ? card.id : req.cardId, last4: card ? card.last4 : '', cardKind: card ? card.kind : '',
      kind: Number(m.mcc) === 6011 ? 'atm' : 'purchase',
      merchant: {
        name: String(m.name || 'Unknown shop').slice(0, 60), mcc: Number(m.mcc) || 0,
        category: cat.id, categoryLabel: cat.label,
        city: String(m.city || '').slice(0, 40), country: String(m.country || PROGRAM.home).toUpperCase().slice(0, 2)
      },
      channel: CHANNELS[req.channel] ? req.channel : 'online',
      t: env.now,
      amount: { minor: req.minor, currency: String(req.currency || 'USD').toUpperCase() },
      status: 'declined', decline: null, fx: null,
      usdCents: 0, billing: 0, fees: { fx: 0, conversion: 0, atm: 0 },
      funding: null, final: null, refunds: [], refunded: 0, dispute: null,
      flags: {}, timeline: []
    };
  }

  function priceIt(tx, env) {
    const conv = toUsd(tx.amount.minor, tx.amount.currency, env.fx, env.now);
    if (!conv.ok) return conv;
    tx.fx = conv.fx;
    tx.usdCents = conv.cents;
    tx.fees.fx = tx.amount.currency === 'USD' ? 0 : pct(conv.cents, PROGRAM.fees.fxBps);
    tx.fees.atm = tx.kind === 'atm' ? PROGRAM.fees.atmCents : 0;
    tx.billing = tx.usdCents + tx.fees.fx + tx.fees.atm;
    return { ok: true };
  }

  function decline(s, tx, code, extra, env) {
    tx.status = 'declined';
    tx.decline = { code, ...(extra || {}) };
    stamp(tx, env.now, 'Declined. Nothing was taken from your balance.');
    s.txs.unshift(tx);
    if (tx.networkId) s.seen[tx.networkId] = tx.id;
    const d = explainDecline(tx);
    note(s, { kind: 'decline', now: env.now, txId: tx.id, title: `Declined at ${tx.merchant.name}`, body: `${d.title}. ${d.why} Nothing was taken.` });
    return { ok: true, tx };
  }

  function recentAttempts(s, cardId, now) {
    return s.txs.filter(t => t.cardId === cardId && now - t.t < PROGRAM.velocity.windowMs && t.kind !== 'repayment').length;
  }

  function authorize(s, req, env) {
    const now = env.now;

    // 1. The same network message twice: the same answer, and money moves once.
    if (req.networkId && s.seen[req.networkId]) {
      const prev = findTx(s, s.seen[req.networkId]);
      if (prev) {
        prev.retries = (prev.retries || 0) + 1;
        stamp(prev, now, 'The card network sent this payment again. It got the same answer, and nothing more was taken.');
        return { ok: true, tx: prev, duplicate: true };
      }
    }

    const card = findCard(s, req.cardId);
    const tx = baseTx(s, req, card, env);
    if (!Number.isSafeInteger(req.minor) || req.minor <= 0) return { ok: false, msg: 'Enter an amount.' };
    if (!card) return decline(s, tx, 'card_unknown', null, env);
    if (env.paused) return decline(s, tx, 'program_paused', null, env);

    // 2. The partner is down: the network decides alone, with less to go on.
    if (env.outage) return standIn(s, tx, card, env);

    // 3. The card itself.
    const st = statusOf(card, now);
    if (st === 'frozen') return decline(s, tx, 'card_frozen', null, env);
    if (st === 'lost' || st === 'stolen') return decline(s, tx, 'card_' + st, null, env);
    if (st === 'closed' || st === 'replaced') return decline(s, tx, 'card_closed', null, env);
    if (st === 'inactive') return decline(s, tx, 'card_not_active', null, env);
    if (st === 'expired') return decline(s, tx, 'card_expired', { exp: expText(card) }, env);
    if (recentAttempts(s, card.id, now) >= PROGRAM.velocity.max) return decline(s, tx, 'unusual_activity', { n: PROGRAM.velocity.max }, env);
    if (s.owed > 0) return decline(s, tx, 'balance_owed', { owed: s.owed }, env);

    // 4. How and where.
    if (CHANNELS[tx.channel].physicalOnly && card.kind !== 'physical') return decline(s, tx, 'channel_virtual', { channel: tx.channel }, env);
    if (tx.channel === 'online' && !card.controls.online) return decline(s, tx, 'online_blocked', null, env);
    if (tx.channel === 'contactless' && !card.controls.contactless) return decline(s, tx, 'contactless_blocked', null, env);
    if (tx.kind === 'atm' && !card.controls.atm) return decline(s, tx, 'atm_blocked', null, env);
    if (tx.merchant.country !== PROGRAM.home && !card.controls.international) return decline(s, tx, 'international_blocked', { country: tx.merchant.country }, env);
    const cat = categoryOf(tx.merchant.mcc);
    if (cat.unsupported) return decline(s, tx, 'category_not_supported', { label: cat.label }, env);
    if (card.blocked.includes(cat.id)) return decline(s, tx, 'category_blocked', { label: cat.label, cat: cat.id }, env);

    // 5. How much, in dollars.
    const priced = priceIt(tx, env);
    if (!priced.ok) return decline(s, tx, priced.code, { currency: tx.amount.currency }, env);

    // 6. Limits.
    const L = s.limits, sp = spent(s, now);
    if (tx.billing > L.perTx) return decline(s, tx, 'over_tx_limit', { limit: L.perTx, need: tx.billing }, env);
    if (sp.day + tx.billing > L.daily) return decline(s, tx, 'over_daily_limit', { limit: L.daily, left: Math.max(0, L.daily - sp.day), need: tx.billing }, env);
    if (sp.month + tx.billing > L.monthly) return decline(s, tx, 'over_monthly_limit', { limit: L.monthly, left: Math.max(0, L.monthly - sp.month), need: tx.billing }, env);
    if (tx.kind === 'atm' && sp.atm + tx.billing > L.atmDaily) return decline(s, tx, 'over_atm_limit', { limit: L.atmDaily, left: Math.max(0, L.atmDaily - sp.atm), need: tx.billing }, env);

    // 7. Which coin pays, at what price.
    const p = pick(s, tx.billing, env);
    if (!p.ok) return decline(s, tx, p.code, { tried: p.tried, need: tx.billing }, env);

    // 8. Sell it. If the sale fails, nothing was taken.
    const f = p.pick;
    if (!env.wallet.debit(f.asset, f.qty, { merchant: tx.merchant.name, note: `Card payment ${tx.id}` })) {
      return decline(s, tx, 'conversion_failed', { asset: f.asset }, env);
    }
    return approve(s, tx, f, env, 'Approved. The amount is held until the shop collects it.');
  }

  function approve(s, tx, f, env, text) {
    const now = env.now;
    tx.status = 'pending';
    tx.funding = { asset: f.asset, price: f.price, priceAt: f.priceAt, source: f.source, bps: f.bps, units: f.units, qty: f.qty, cents: f.total };
    tx.fees.conversion = f.fee;
    tx.holdUntil = now + PROGRAM.holdDays * 86400000;
    stamp(tx, now, text);
    // Same shop, same amount, moments apart: likely a double charge.
    const rep = s.txs.find(t => t.cardId === tx.cardId && t.id !== tx.id && COUNTS.has(t.status)
      && t.merchant.name === tx.merchant.name && t.amount.minor === tx.amount.minor && t.amount.currency === tx.amount.currency
      && Math.abs(now - t.t) <= PROGRAM.repeatMs);
    if (rep) tx.flags.repeatOf = rep.id;
    s.txs.unshift(tx);
    if (tx.networkId) s.seen[tx.networkId] = tx.id;
    note(s, { kind: 'payment', now, txId: tx.id, cents: tx.billing, title: `${usd(tx.billing)} at ${tx.merchant.name}`, body: summary(tx) });
    if (rep) note(s, { kind: 'security', now, txId: tx.id, title: 'Possible double charge', body: `${tx.merchant.name} charged ${fmtMinor(tx.amount.minor, tx.amount.currency)} twice within ${Math.round(PROGRAM.repeatMs / 60000)} minutes. If you paid once, the extra usually drops off; if it's collected, report it as "Charged twice".` });
    return { ok: true, tx };
  }

  /* The network's stand-in: while the partner can't be reached, the
     network approves small payments by itself. It knows whether the
     card is blocked, frozen or expired, and the partner's banned shop
     types, but not your controls, limits or balance. Nothing is taken
     until the partner is back - then it is converted at that moment's
     price, or recorded as owed if the balance can't cover it. */
  function standIn(s, tx, card, env) {
    const st = statusOf(card, env.now);
    tx.flags.standIn = true;
    if (st !== 'active') return decline(s, tx, st === 'frozen' ? 'card_frozen' : st === 'expired' ? 'card_expired' : st === 'inactive' ? 'card_not_active' : st === 'lost' || st === 'stolen' ? 'card_' + st : 'card_closed', { exp: expText(card) }, env);
    if (CHANNELS[tx.channel].physicalOnly && card.kind !== 'physical') return decline(s, tx, 'channel_virtual', { channel: tx.channel }, env);
    const cat = categoryOf(tx.merchant.mcc);
    if (cat.unsupported) return decline(s, tx, 'category_not_supported', { label: cat.label }, env);
    const priced = priceIt(tx, env);
    if (!priced.ok || tx.billing > PROGRAM.standInCents) return decline(s, tx, 'issuer_unavailable', { max: PROGRAM.standInCents }, env);
    tx.status = 'pending';
    tx.flags.awaitingPost = true;
    tx.holdUntil = env.now + PROGRAM.holdDays * 86400000;
    stamp(tx, env.now, 'Approved by the card network while Trending’s card partner was offline. Nothing has been taken yet.');
    s.txs.unshift(tx);
    if (tx.networkId) s.seen[tx.networkId] = tx.id;
    note(s, { kind: 'payment', now: env.now, txId: tx.id, cents: tx.billing, title: `${usd(tx.billing)} at ${tx.merchant.name}, approved offline`, body: 'The card network approved this while Trending’s card partner was down. It will be converted and taken from your balance when the partner is back, at that moment’s price.' });
    return { ok: true, tx };
  }

  /* Taking money for a payment that was approved without it: a stand-in
     approval, an offline chip sale, or a tip added at collection. The
     shop is paid regardless - that is what "approved" promised it - so
     what the balance can't cover becomes money owed on the card. */
  function collect(s, tx, cents, env, why) {
    const p = pick(s, cents, env);
    if (p.ok) {
      const f = p.pick;
      if (env.wallet.debit(f.asset, f.qty, { merchant: tx.merchant.name, note: `Card payment ${tx.id}` })) return { ok: true, f };
    }
    s.owed += cents;
    tx.owed = (tx.owed || 0) + cents;
    stamp(tx, env.now, `${usd(cents)} couldn't be taken from your balance, so it is owed on the card.`);
    note(s, { kind: 'owed', now: env.now, txId: tx.id, title: `You owe ${usd(s.owed)} on your card`, body: `${why} ${usd(cents)} couldn't be covered by your balance. New card payments are paused until it's paid.` });
    return { ok: false };
  }

  function postStandIn(s, env) {
    const out = [];
    s.txs.filter(t => t.flags && t.flags.awaitingPost && (t.status === 'pending' || t.status === 'completed')).forEach(tx => {
      tx.flags.awaitingPost = false;
      tx.flags.postedAt = env.now;
      const c = collect(s, tx, tx.billing, env, `The partner is back and posted a payment at ${tx.merchant.name} that the network approved while it was offline.`);
      if (c.ok) {
        const f = c.f;
        tx.funding = { asset: f.asset, price: f.price, priceAt: f.priceAt, source: f.source, bps: f.bps, units: f.units, qty: f.qty, cents: f.total };
        tx.fees.conversion = f.fee;
        stamp(tx, env.now, `Trending’s card partner is back. Converted at ${fmtPrice(f.price)} per ${f.asset} and taken from your balance.`);
        note(s, { kind: 'payment', now: env.now, txId: tx.id, cents: tx.billing, title: `${usd(tx.billing)} at ${tx.merchant.name} was taken`, body: summary(tx) });
      }
      out.push(tx.id);
    });
    return out;
  }

  /* An offline chip sale: the terminal approved it without asking
     anyone (on a plane, at a transit gate). It arrives later, when the
     shop sends it, and is taken then. The card's freeze and controls
     can't be checked by a terminal that isn't online. */
  function offlineSale(s, req, env) {
    const card = findCard(s, req.cardId);
    const tx = baseTx(s, req, card, env);
    if (!card) return { ok: false, msg: 'Pick a card.' };
    if (card.kind !== 'physical') return decline(s, tx, 'channel_virtual', { channel: tx.channel }, env);
    if (isExpired(card, env.now)) return decline(s, tx, 'card_expired', { exp: expText(card) }, env);
    const priced = priceIt(tx, env);
    if (!priced.ok) return decline(s, tx, priced.code, { currency: tx.amount.currency }, env);
    if (tx.billing > PROGRAM.offlineCents) return decline(s, tx, 'offline_over_limit', { max: PROGRAM.offlineCents }, env);
    tx.status = 'offline';
    tx.flags.offline = true;
    stamp(tx, env.now, 'Approved by the card terminal without going online. It will be taken when the shop sends it.');
    s.txs.unshift(tx);
    note(s, { kind: 'payment', now: env.now, txId: tx.id, cents: tx.billing, title: `${usd(tx.billing)} at ${tx.merchant.name}, approved offline`, body: 'The terminal approved this without going online. It will be taken from your balance when the shop sends it, usually within 1–3 days, at that moment’s price.' });
    return { ok: true, tx };
  }
  function postOffline(s, id, env) {
    const tx = findTx(s, id);
    if (!tx || tx.status !== 'offline') return { ok: false, msg: 'Nothing to post.' };
    const c = collect(s, tx, tx.billing, env, `${tx.merchant.name} sent an offline payment.`);
    if (c.ok) {
      const f = c.f;
      tx.funding = { asset: f.asset, price: f.price, priceAt: f.priceAt, source: f.source, bps: f.bps, units: f.units, qty: f.qty, cents: f.total };
      tx.fees.conversion = f.fee;
    }
    tx.status = 'completed';
    tx.settledAt = env.now;
    tx.final = { minor: tx.amount.minor, billing: tx.billing };
    stamp(tx, env.now, c.ok ? `The shop sent it. Converted at ${fmtPrice(c.f.price)} per ${c.f.asset} and taken from your balance.` : 'The shop sent it.');
    if (c.ok) note(s, { kind: 'payment', now: env.now, txId: tx.id, cents: tx.billing, title: `${usd(tx.billing)} at ${tx.merchant.name} was taken`, body: summary(tx) });
    return { ok: true, tx };
  }

  /* ── After approval ──────────────────────────────────────────────── */
  /* The shop collects. The final amount may be lower (a hotel deposit,
     a fuel pump) or, at a restaurant or taxi, up to 20% higher for a
     tip. Lower: the unused part comes back at the approval's price,
     fees included, because it was never paid out. Higher: the extra
     is converted now, at today's price. */
  function settle(s, id, finalMinor, env) {
    const tx = findTx(s, id);
    if (!tx || tx.status !== 'pending') return { ok: false, msg: 'Only a pending payment can be collected.' };
    if (tx.flags.awaitingPost) return { ok: false, msg: 'This payment is collected once Trending’s card partner is back.' };
    const fin = finalMinor == null ? tx.amount.minor : finalMinor;
    if (!Number.isSafeInteger(fin) || fin <= 0) return { ok: false, msg: 'Enter the final amount.' };
    const maxTip = Math.floor(tx.amount.minor * (100 + PROGRAM.tipPct) / 100);
    if (fin > tx.amount.minor && !(TIP_MCC.has(tx.merchant.mcc) && fin <= maxTip)) {
      return { ok: false, msg: TIP_MCC.has(tx.merchant.mcc) ? `A tip can take it to at most ${fmtMinor(maxTip, tx.amount.currency)}.` : 'A shop can’t collect more than you approved.' };
    }
    const usdFinal = tx.amount.currency === 'USD' ? fin : Math.round(fin / 10 ** expOf(tx.amount.currency) / tx.fx.rate * 100);
    const fxFee = tx.amount.currency === 'USD' ? 0 : pct(usdFinal, PROGRAM.fees.fxBps);
    const billing = usdFinal + fxFee + tx.fees.atm;
    const delta = billing - tx.billing;
    tx.final = { minor: fin, billing, usdCents: usdFinal, fxFee };
    if (delta < 0 && tx.funding) {
      // Give back the unused part, in the same coin, at the same price.
      const f = tx.funding, back = Math.floor(f.units * (-delta) / tx.billing);
      const qty = toQty(back, decOf(f.asset));
      if (back > 0) env.wallet.credit(f.asset, qty, { merchant: tx.merchant.name, via: 'Trending Card release' });
      const convBack = pct(-delta, f.bps);
      tx.release = { units: back, qty, asset: f.asset, cents: -delta };
      tx.fees.conversion -= convBack;
      stamp(tx, env.now, `${tx.merchant.name} collected ${fmtMinor(fin, tx.amount.currency)}, less than approved. ${fmtQty(qty, f.asset)} came back — the same price as the approval, so nothing was lost to price moves.`);
    } else if (delta > 0) {
      const c = collect(s, tx, delta, env, `${tx.merchant.name} added a tip.`);
      if (c.ok) {
        tx.extra = { asset: c.f.asset, qty: c.f.qty, units: c.f.units, price: c.f.price, cents: delta, fee: c.f.fee };
        tx.fees.conversion += c.f.fee;
        stamp(tx, env.now, `${tx.merchant.name} added ${usd(delta)} (a tip). It was converted at today’s price: ${fmtQty(c.f.qty, c.f.asset)} at ${fmtPrice(c.f.price)}.`);
      }
    } else {
      stamp(tx, env.now, `${tx.merchant.name} collected the payment.`);
    }
    tx.fees.fx = fxFee;
    tx.status = 'completed';
    tx.settledAt = env.now;
    return { ok: true, tx };
  }

  /* The shop cancels before collecting, or the hold runs out: the coin
     that was taken comes back, unit for unit, whatever the price is now. */
  function reverse(s, id, env, why) {
    const tx = findTx(s, id);
    if (!tx || tx.status !== 'pending') return { ok: false, msg: 'Only a pending payment can be cancelled.' };
    if (tx.funding) env.wallet.credit(tx.funding.asset, tx.funding.qty, { merchant: tx.merchant.name, via: 'Trending Card release' });
    tx.status = 'reversed';
    tx.reversedAt = env.now;
    tx.reversal = why === 'expired' ? 'expired' : 'merchant';
    const back = tx.funding ? `${fmtQty(tx.funding.qty, tx.funding.asset)} came back — exactly what was taken, fees included.` : 'Nothing had been taken.';
    stamp(tx, env.now, (why === 'expired' ? `${tx.merchant.name} didn’t collect within ${PROGRAM.holdDays} days, so the hold was released. ` : `${tx.merchant.name} cancelled the payment. `) + back);
    note(s, { kind: 'refund', now: env.now, txId: tx.id, title: `${tx.merchant.name} payment cancelled`, body: back });
    return { ok: true, tx };
  }
  function expireHolds(s, env) {
    return s.txs.filter(t => t.status === 'pending' && t.holdUntil && env.now >= t.holdUntil).map(t => { reverse(s, t.id, env, 'expired'); return t.id; });
  }

  /* ── Refunds ─────────────────────────────────────────────────────── */
  /* A refund returns what the shop gives back plus the same share of
     the fees you paid. It comes back in the coin you paid with, at the
     price when it arrives - so if the price moved, the amount of coin
     does too. If that coin has no live price then, it comes back as
     USDT, dollar for dollar. Money owed on the card is paid first. */
  const refundedMinor = tx => tx.refunds.filter(r => r.state !== 'cancelled').reduce((n, r) => n + r.minor, 0);
  function refundStart(s, id, minor, env) {
    const tx = findTx(s, id);
    if (!tx || !['completed', 'partially_refunded'].includes(tx.status)) return { ok: false, msg: 'Only a collected payment can be refunded.' };
    const fin = tx.final ? tx.final.minor : tx.amount.minor;
    const left = fin - refundedMinor(tx);
    if (!Number.isSafeInteger(minor) || minor <= 0) return { ok: false, msg: 'Enter the refund amount.' };
    if (minor > left) return { ok: false, msg: `At most ${fmtMinor(left, tx.amount.currency)} can still be refunded.` };
    const r = { id: mkId('RFD', env.rand || Math.random), minor, state: 'pending', startedAt: env.now };
    tx.refunds.push(r);
    stamp(tx, env.now, `${tx.merchant.name} started a refund of ${fmtMinor(minor, tx.amount.currency)}. Refunds usually arrive in 3–10 days.`);
    note(s, { kind: 'refund', now: env.now, txId: tx.id, title: `Refund on its way from ${tx.merchant.name}`, body: `${fmtMinor(minor, tx.amount.currency)}. It usually arrives in 3–10 days; you'll get a message when it does.` });
    return { ok: true, tx, refund: r };
  }

  function creditBack(s, tx, cents, env) {
    let owedPaid = 0;
    if (s.owed > 0) { owedPaid = Math.min(s.owed, cents); s.owed -= owedPaid; cents -= owedPaid; }
    let asset = tx.funding ? tx.funding.asset : 'USDT';
    let q = env.wallet.quote(asset) || {};
    let fallback = false;
    if (!q.live || !(q.usd > 0)) { asset = 'USDT'; q = { usd: 1, live: true }; fallback = true; }
    const units = cents > 0 ? unitsFor(cents, q.usd, decOf(asset), false) : 0;
    const qty = toQty(units, decOf(asset));
    if (qty > 0) env.wallet.credit(asset, qty, { merchant: tx.merchant.name, via: 'Trending Card refund' });
    return { asset, qty, price: q.usd, owedPaid, fallback };
  }

  function refundArrive(s, id, rid, env) {
    const tx = findTx(s, id);
    const r = tx && tx.refunds.find(x => x.id === rid);
    if (!r || r.state !== 'pending') return { ok: false, msg: 'That refund has already arrived.' };
    const fin = tx.final ? tx.final.minor : tx.amount.minor;
    const share = r.minor / fin;
    const usdPart = tx.amount.currency === 'USD' ? r.minor : Math.round(r.minor / 10 ** expOf(tx.amount.currency) / tx.fx.rate * 100);
    const feesBack = Math.round((tx.fees.fx + tx.fees.conversion) * share);
    const cents = usdPart + feesBack;
    const c = creditBack(s, tx, cents, env);
    Object.assign(r, { state: 'credited', creditedAt: env.now, cents, feesBack, ...c });
    tx.refunded = refundedMinor(tx);
    tx.status = tx.refunded >= fin ? 'refunded' : 'partially_refunded';
    const got = c.qty > 0 ? `${fmtQty(c.qty, c.asset)} at ${fmtPrice(c.price)}` : '';
    const text = `Refund of ${usd(cents)} arrived (${usd(usdPart)} from the shop + ${usd(feesBack)} of fees returned)` +
      (c.owedPaid ? `. ${usd(c.owedPaid)} paid off what the card owed` : '') + (got ? `. You got ${got}` : '') +
      (c.fallback ? ` — as USDT, because ${tx.funding.asset} had no live price` : '') + '.';
    stamp(tx, env.now, text);
    note(s, { kind: 'refund', now: env.now, txId: tx.id, title: `Refund from ${tx.merchant.name} arrived`, body: text });
    return { ok: true, tx, refund: r };
  }

  /* ── Disputes ────────────────────────────────────────────────────── */
  const DISPUTE_REASONS = {
    unrecognised: 'I don’t recognise this payment',
    duplicate:    'I was charged twice',
    amount:       'The amount is wrong',
    not_received: 'I didn’t get what I paid for',
    cancelled:    'I cancelled, but was still charged',
    refund:       'A refund I was promised never came'
  };
  function canDispute(tx, now) {
    if (!tx) return { ok: false, msg: 'Unknown payment.' };
    if (tx.dispute && ['submitted', 'review'].includes(tx.dispute.state)) return { ok: false, msg: 'This payment already has an open report.' };
    if (tx.dispute && ['won', 'lost'].includes(tx.dispute.state)) return { ok: false, msg: 'This payment’s report was already decided. Contact support to ask for another look.' };
    if (tx.status === 'pending') return { ok: false, msg: 'Pending payments can still change or drop off. If you don’t recognise it, freeze the card now and report it once it’s collected.' };
    if (!['completed', 'partially_refunded'].includes(tx.status)) return { ok: false, msg: 'Only a collected payment can be reported.' };
    const from = tx.settledAt || tx.t;
    if (now - from > PROGRAM.disputeDays * 86400000) return { ok: false, msg: `Payments can be reported for ${PROGRAM.disputeDays} days after they’re collected.` };
    return { ok: true };
  }
  function openDispute(s, id, reason, text, env) {
    const tx = findTx(s, id);
    const can = canDispute(tx, env.now);
    if (!can.ok) return can;
    if (!DISPUTE_REASONS[reason]) return { ok: false, msg: 'Pick what went wrong.' };
    tx.dispute = { id: mkId('DSP', env.rand || Math.random), reason, text: String(text || '').slice(0, 1000), state: 'submitted', openedAt: env.now };
    stamp(tx, env.now, `You reported this payment: “${DISPUTE_REASONS[reason]}”. Reference ${tx.dispute.id}.`);
    note(s, { kind: 'security', now: env.now, txId: tx.id, title: 'Payment reported', body: `We'll look into ${tx.merchant.name} (${tx.dispute.id}). The shop gets a chance to answer; most reports are decided within 30–45 days.` });
    return { ok: true, tx };
  }
  function withdrawDispute(s, id, env) {
    const tx = findTx(s, id);
    if (!tx || !tx.dispute || !['submitted', 'review'].includes(tx.dispute.state)) return { ok: false, msg: 'There is no open report.' };
    tx.dispute.state = 'withdrawn';
    tx.dispute.closedAt = env.now;
    stamp(tx, env.now, 'You withdrew your report.');
    return { ok: true, tx };
  }
  function decideDispute(s, id, outcome, env) {
    const tx = findTx(s, id);
    const d = tx && tx.dispute;
    if (!d || !['submitted', 'review'].includes(d.state)) return { ok: false, msg: 'There is no open report.' };
    if (outcome === 'review') { d.state = 'review'; stamp(tx, env.now, `${tx.merchant.name} has been asked for its side.`); return { ok: true, tx }; }
    d.closedAt = env.now;
    if (outcome === 'won') {
      // Everything not already refunded comes back, fees included.
      const fin = tx.final ? tx.final.minor : tx.amount.minor;
      const left = fin - refundedMinor(tx);
      const r = { id: mkId('RFD', env.rand || Math.random), minor: left, state: 'pending', startedAt: env.now, dispute: true };
      tx.refunds.push(r);
      d.state = 'won';
      stamp(tx, env.now, 'Decided in your favour.');
      refundArrive(s, id, r.id, env);
      note(s, { kind: 'security', now: env.now, txId: tx.id, title: 'Report decided in your favour', body: `The ${tx.merchant.name} payment was returned to you.` });
    } else {
      d.state = 'lost';
      stamp(tx, env.now, 'Decided in the shop’s favour: it showed the payment was valid. Nothing changes on your balance.');
      note(s, { kind: 'security', now: env.now, txId: tx.id, title: 'Report decided for the shop', body: `${tx.merchant.name} showed the payment was valid. You can ask support to look again.` });
    }
    return { ok: true, tx };
  }

  /* ── Money owed ──────────────────────────────────────────────────── */
  function payOwed(s, env) {
    if (!(s.owed > 0)) return { ok: false, msg: 'Nothing is owed.' };
    const p = pick(s, s.owed, env);
    if (!p.ok) return { ok: false, msg: p.code === 'conversion_unavailable' ? 'No live price right now. Try again shortly, or pay with USDT.' : 'Your card coins don’t cover it yet. Add funds, then try again.' };
    const f = p.pick;
    if (!env.wallet.debit(f.asset, f.qty, { merchant: 'Trending Card', note: 'Paying what the card owed' })) return { ok: false, msg: 'The payment could not be made.' };
    const tx = {
      id: mkId('CTX', env.rand || Math.random), kind: 'repayment', cardId: null, last4: '', t: env.now, status: 'completed',
      merchant: { name: 'Money owed on the card', mcc: 0, category: 'other', categoryLabel: '', city: '', country: PROGRAM.home },
      channel: 'online', amount: { minor: s.owed, currency: 'USD' }, usdCents: s.owed, billing: s.owed,
      fees: { fx: 0, conversion: f.fee, atm: 0 }, funding: { asset: f.asset, price: f.price, priceAt: f.priceAt, source: f.source, bps: f.bps, units: f.units, qty: f.qty, cents: f.total },
      refunds: [], refunded: 0, flags: {}, timeline: []
    };
    stamp(tx, env.now, `Paid ${usd(s.owed)} owed on the card with ${fmtQty(f.qty, f.asset)}.`);
    s.txs.unshift(tx);
    s.owed = 0;
    note(s, { kind: 'owed', now: env.now, txId: tx.id, title: 'Card balance paid', body: 'Nothing is owed any more. Card payments work again.' });
    return { ok: true, tx };
  }

  /* ── Explaining ──────────────────────────────────────────────────── */
  const STATUS = {
    pending:            { label: 'Pending', tone: 'wait', what: 'Approved and held. The shop hasn’t collected it yet; until then it can still change or drop off.' },
    offline:            { label: 'Approved offline', tone: 'wait', what: 'Approved by the terminal without going online. It will be taken when the shop sends it.' },
    completed:          { label: 'Completed', tone: 'ok', what: 'The shop collected it.' },
    declined:           { label: 'Declined', tone: 'bad', what: 'Nothing was taken from your balance.' },
    reversed:           { label: 'Cancelled', tone: 'mute', what: 'The hold was released and the coin came back.' },
    partially_refunded: { label: 'Partly refunded', tone: 'ok', what: 'Part of it was refunded.' },
    refunded:           { label: 'Refunded', tone: 'ok', what: 'All of it was refunded.' }
  };
  const DISPUTE_STATES = { submitted: 'Report sent', review: 'Under review', won: 'Decided for you', lost: 'Decided for the shop', withdrawn: 'Report withdrawn' };

  function statusLabel(tx) {
    const s = STATUS[tx.status] || { label: tx.status, tone: 'mute', what: '' };
    if (tx.dispute && ['submitted', 'review'].includes(tx.dispute.state)) return { ...s, label: DISPUTE_STATES[tx.dispute.state], tone: 'wait' };
    if (tx.refunds && tx.refunds.some(r => r.state === 'pending')) return { ...s, label: 'Refund on its way', tone: 'wait' };
    if (tx.flags && tx.flags.awaitingPost) return { ...s, label: 'Approved offline', tone: 'wait', what: 'The network approved it while the partner was down. Nothing is taken until the partner is back.' };
    return s;
  }

  const COUNTRY = { US: 'United States', PT: 'Portugal', JP: 'Japan', GB: 'United Kingdom', IN: 'India', FR: 'France', MT: 'Malta', DE: 'Germany', ES: 'Spain', AE: 'United Arab Emirates', SG: 'Singapore' };
  const countryName = c => COUNTRY[c] || c;

  function explainDecline(tx) {
    const d = tx.decline || {};
    const channel = d.channel && CHANNELS[d.channel] ? CHANNELS[d.channel].label.toLowerCase() : '';
    const tried = (d.tried || []).map(t => t.why === 'no_price'
      ? `${t.asset} had no live price`
      : `${t.asset}: you have ${usd(t.haveCents)} of the ${usd(t.needCents)} needed`).join('; ');
    const T = {
      card_unknown:           ['Card not found', 'That card isn’t on your account.', '', ''],
      program_paused:         ['Card paused by Trending', 'The card is paused for maintenance. Nothing you hold is affected.', 'Try again later.', ''],
      card_frozen:            ['Card frozen', 'You froze this card, so it declines every payment until you unfreeze it.', 'Unfreeze it, then pay again.', 'unfreeze'],
      card_expired:           ['Card expired', `This card expired at the end of ${d.exp || 'its expiry month'}.`, 'Renew it under Manage → Replace. A renewed card keeps its number; the expiry date and security code change.', 'replace'],
      card_not_active:        ['Card not activated', 'This physical card hasn’t been activated yet.', 'Activate it with the last 4 digits printed on it.', 'activate'],
      card_lost:              ['Card reported lost', 'This card was reported lost, so it can never be used again.', 'Use your replacement card, or order one.', 'replace'],
      card_stolen:            ['Card reported stolen', 'This card was reported stolen, so it can never be used again.', 'Use your replacement card, or order one.', 'replace'],
      card_closed:            ['Card closed', 'This card is closed, or was replaced by a newer one.', 'Pay with your current card.', ''],
      balance_owed:           ['Money owed on the card', `The card owes ${usd(d.owed || 0)} from an earlier payment that was taken after your balance ran low. New payments are paused until it’s paid.`, 'Pay what’s owed under Manage.', 'payowed'],
      channel_virtual:        ['Virtual cards only pay online', `A virtual card can’t pay by ${channel || 'this method'}. Tapping, chip and cash machines need a physical card.`, 'Pay online, or order a physical card.', 'physical'],
      online_blocked:         ['Online payments are off', 'You turned off online payments for this card.', 'Turn them on in Controls, then pay again.', 'controls'],
      contactless_blocked:    ['Contactless is off', 'You turned off contactless for this card.', 'Turn it on in Controls, or insert the card and use your PIN.', 'controls'],
      atm_blocked:            ['Cash machines are off', 'Cash withdrawals are off for this card.', 'Turn them on in Controls.', 'controls'],
      international_blocked:  ['International payments are off', `The shop is in ${countryName(d.country)}, outside ${PROGRAM.homeName}, and international payments are off for this card.`, 'Turn them on in Controls.', 'controls'],
      category_not_supported: ['The card can’t be used here', `${d.label || 'This kind of shop'}: the card partner doesn’t allow crypto cards to pay for it. It isn’t a setting you can change.`, '', ''],
      category_blocked:       ['You blocked this kind of shop', `${d.label || 'This category'} is blocked in your controls.`, 'Unblock it in Controls.', 'controls'],
      currency_not_supported: ['Currency not supported', `The shop charged in ${d.currency}, which the card can’t convert.`, '', ''],
      fx_unavailable:         ['Exchange rate unavailable', `The shop charged in ${d.currency}, and a current exchange rate couldn’t be fetched, so the payment couldn’t be priced safely.`, 'Try again in a few minutes.', ''],
      over_tx_limit:          ['Over your single-payment limit', `This payment is ${usd(d.need || 0)}; your limit for one payment is ${usd(d.limit || 0)}.`, 'Raise it under Controls → Limits.', 'limits'],
      over_daily_limit:       ['Over your daily limit', `This ${usd(d.need || 0)} payment would pass your daily limit of ${usd(d.limit || 0)}. ${usd(d.left || 0)} is left today; the limit resets at midnight.`, 'Raise it under Controls → Limits.', 'limits'],
      over_monthly_limit:     ['Over your monthly limit', `This ${usd(d.need || 0)} payment would pass your monthly limit of ${usd(d.limit || 0)}. ${usd(d.left || 0)} is left this month.`, 'Raise it under Controls → Limits.', 'limits'],
      over_atm_limit:         ['Over your cash limit', `This ${usd(d.need || 0)} withdrawal would pass your daily cash limit of ${usd(d.limit || 0)}. ${usd(d.left || 0)} is left today.`, 'Raise it under Controls → Limits.', 'limits'],
      insufficient_funds:     ['Not enough balance', `The card needed ${usd(d.need || 0)}. ${tried || 'None of your card coins could cover it.'}.`, 'Add funds, or turn on another coin in Assets.', 'assets'],
      conversion_unavailable: ['Couldn’t convert your crypto', `${tried || 'No coin had a live price'}, so the card couldn’t sell it at a fair price.`, 'Try again shortly, or pay with USDT or USDC, which don’t need a market price.', 'assets'],
      conversion_failed:      ['Conversion failed', `Selling ${d.asset || 'the coin'} for this payment didn’t go through.`, 'Try again.', ''],
      issuer_unavailable:     ['Card partner unreachable', `The card network couldn’t reach Trending’s card partner. While it’s down, the network approves only payments up to ${usd(d.max || PROGRAM.standInCents)}.`, 'Try again in a few minutes.', ''],
      offline_over_limit:     ['Too large to approve offline', `A terminal that isn’t online can approve up to ${usd(d.max || PROGRAM.offlineCents)}.`, 'Pay where the terminal is online.', ''],
      unusual_activity:       ['Paused for your safety', `There were ${d.n || PROGRAM.velocity.max} card payments in 10 minutes, which is unusual, so this one was declined in case someone else has your card.`, 'If it was you, wait 10 minutes. If not, freeze the card now.', 'freeze']
    };
    const [title, why, fix, act] = T[d.code] || ['Declined', 'The payment was declined.', '', ''];
    return { code: d.code, title, why, fix, act, fundsSafe: true };
  }

  /* What the payment took in the end: the coin sold at approval, less
     what came back when the shop collected less, plus any tip. */
  function netPaid(tx) {
    const f = tx.funding;
    if (!f) return [];
    const out = [{ asset: f.asset, units: f.units - (tx.release ? tx.release.units : 0) }];
    if (tx.extra) {
      if (tx.extra.asset === f.asset) out[0].units += tx.extra.units;
      else out.push({ asset: tx.extra.asset, units: tx.extra.units });
    }
    return out.map(x => ({ asset: x.asset, qty: toQty(x.units, decOf(x.asset)) }));
  }
  const netText = tx => netPaid(tx).map(x => fmtQty(x.qty, x.asset)).join(' + ');

  /* The one line a list row or a notification carries: how much, which
     coin, what it cost to convert, and where it stands. */
  function summary(tx) {
    if (tx.status === 'declined') return explainDecline(tx).title + '. Nothing was taken.';
    const parts = [];
    const bill = tx.final ? tx.final.billing : tx.billing;
    parts.push(tx.amount.currency === 'USD' ? `${usd(bill)} card charge` : `${fmtMinor(tx.final ? tx.final.minor : tx.amount.minor, tx.amount.currency)} → ${usd(bill)} card charge`);
    const f = tx.funding;
    if (f) {
      parts.push(`paid with ${netText(tx)}` + (ASSETS[f.asset] && ASSETS[f.asset].stable ? '' : ` at ${fmtPrice(f.price)}`));
      parts.push(tx.fees.conversion ? `conversion fee ${usd(tx.fees.conversion)}` : 'no conversion fee');
    } else if (tx.flags && (tx.flags.awaitingPost || tx.flags.offline)) {
      parts.push('not taken yet');
    }
    if (tx.fees.fx) parts.push(`foreign-currency fee ${usd(tx.fees.fx)}`);
    if (tx.fees.atm) parts.push(`cash machine fee ${usd(tx.fees.atm)}`);
    parts.push(statusLabel(tx).label);
    return parts.join(' · ');
  }

  /* Every line of what happened to the money, in order. */
  function breakdown(tx) {
    const rows = [];
    const cur = tx.amount.currency;
    const fin = tx.final;
    const add = (label, value, sub) => rows.push({ label, value, sub: sub || '' });
    if (tx.kind === 'repayment') {
      add('Paid', usd(tx.billing), 'Money owed on the card');
    } else {
      add(fin && fin.minor !== tx.amount.minor ? 'Shop approved' : 'Shop charged', fmtMinor(tx.amount.minor, cur));
      if (fin && fin.minor !== tx.amount.minor) add('Shop collected', fmtMinor(fin.minor, cur), fin.minor > tx.amount.minor ? 'Includes a tip' : 'Less than approved');
      if (tx.fx) {
        add('Exchange rate', `1 USD = ${tx.fx.rate} ${cur}`, `${tx.fx.source}, ${tx.fx.date}. No markup: the fee below is the whole cost.`);
        add('In US dollars', usd(fin ? fin.usdCents : tx.usdCents));
        add(`Foreign-currency fee (${PROGRAM.fees.fxBps / 100}%)`, usd(tx.fees.fx));
      }
      if (tx.fees.atm) add('Cash machine fee', usd(tx.fees.atm));
      if (tx.status !== 'declined') add('Card charge', usd(fin ? fin.billing : tx.billing), 'What the card account paid, in dollars');
    }
    const f = tx.funding;
    if (f) {
      const stable = ASSETS[f.asset] && ASSETS[f.asset].stable;
      add('Paid with', fmtQty(f.qty, f.asset), stable
        ? `1 ${f.asset} = $1.00 in Trending. Rounded up to the coin's smallest unit.`
        : `Sold at ${fmtPrice(f.price)} per ${f.asset}, the live price when the payment was approved${f.source ? ' (' + f.source + ')' : ''}. Rounded up to the coin's smallest unit.`);
      add(`Conversion fee (${f.bps / 100}%)`, usd(tx.fees.conversion), stable ? 'Stablecoins are dollars already' : 'Shown as its own line, never hidden in the price');
      if (tx.release) add('Came back', fmtQty(tx.release.qty, tx.release.asset), 'The part the shop didn’t collect, at the approval’s price');
      if (tx.extra) add('Tip, taken later', fmtQty(tx.extra.qty, tx.extra.asset), `At ${fmtPrice(tx.extra.price)}, the price when the shop collected`);
      if (tx.release || tx.extra) add('In total', netText(tx), 'What this payment took in the end, before any refund');
    } else if (tx.status !== 'declined' && tx.status !== 'reversed') {
      add('Paid with', 'Not taken yet', 'It is converted when the payment posts, at that moment’s price');
    }
    if (tx.owed) add('Owed on the card', usd(tx.owed), 'Your balance didn’t cover this part');
    (tx.refunds || []).forEach(r => {
      if (r.state === 'pending') add('Refund', fmtMinor(r.minor, cur), 'On its way');
      else if (r.state === 'credited') add(r.dispute ? 'Returned (report)' : 'Refunded', r.qty > 0 ? fmtQty(r.qty, r.asset) : usd(r.cents),
        `${usd(r.cents)}: ${usd(r.cents - r.feesBack)} from the shop + ${usd(r.feesBack)} of fees` + (r.owedPaid ? `; ${usd(r.owedPaid)} paid off money owed` : '') + (r.qty > 0 ? `; at ${fmtPrice(r.price)}` : ''));
    });
    const st = statusLabel(tx);
    add('Status', st.label, st.what);
    return rows;
  }

  /* What a practice payment would cost right now, before it's made. */
  function preview(s, req, env) {
    const card = findCard(s, req.cardId);
    const tx = baseTx(s, req, card, env);
    const priced = priceIt(tx, env);
    if (!priced.ok) return { ok: false, code: priced.code, tx };
    const p = pick(s, tx.billing, env);
    return { ok: p.ok, code: p.code, tx, pick: p.pick || null, tried: p.tried };
  }

  return {
    PROGRAM, ASSETS, CHANNELS, CATS, UNSUPPORTED, CONTROLS, LIMIT_KEYS, LIMIT_NAMES, REPLACE, SHIP, SHIP_TEXT,
    STATUS, DISPUTE_REASONS, DISPUTE_STATES, TIP_MCC, PREAUTH_MCC, USABLE,
    blank, normalize, categoryOf, countryName,
    fmtMinor, usd, parseMinor, unitsFor, toQty, centsOf, fmtQty, fmtPrice, expOf, feeBps, decOf,
    fxUsable, toUsd, luhnOk, practiceLast4, practiceDetails,
    expText, isExpired, expiringSoon, statusOf,
    issue, advanceShip, activate, freeze, unfreeze, report, close, replace, replacePlan,
    loosensControl, loosensBlock, setControl, setBlocked, checkLimit, setLimit,
    setEnabled, setPreferred, moveAsset, fundingOrder, pick, spent,
    authorize, postStandIn, offlineSale, postOffline, settle, reverse, expireHolds,
    refundStart, refundArrive, canDispute, openDispute, withdrawDispute, decideDispute, payOwed,
    statusLabel, explainDecline, summary, breakdown, preview, note, findTx, findCard, netPaid, netText
  };
})();

window.CDX = CDX;

/* ── Global bridge ───────────────────────────────────────────────────
   See globals.js: inline handlers look names up on the global object. */
import { publish } from '../globals.js?v=3';
publish('features/cardcore.js', { CDX: () => CDX });
