/* ╔══════════════════════════════════════════════════════════════════╗
   ║  COMMUNE MEMBERSHIPS — paid entry, tiers and subscriptions        ║
   ║                                                                   ║
   ║  A community can be free to join (with optional paid tiers) or    ║
   ║  require a paid membership to join. A subscription has a real     ║
   ║  lifecycle: free trial → active → renews every month or year →    ║
   ║  cancelled (access until the period ends) → expired, plus         ║
   ║  upgrades, scheduled downgrades, a cycle switch and a refund      ║
   ║  window. Lapsing really removes posting rights and the roles the  ║
   ║  tier granted.                                                    ║
   ║                                                                   ║
   ║  Payment is SIMULATED. No card, UPI or wallet details are ever    ║
   ║  asked for or stored, and nothing is charged. Receipts are        ║
   ║  records on this device. A live build would hand this step to a   ║
   ║  payment processor's hosted checkout on a server — the shape of   ║
   ║  the records here is what that server would store.                ║
   ║                                                                   ║
   ║  Members who joined before a community switched to paid entry     ║
   ║  keep their access — switching never locks out existing people.   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CMB = (() => {

  const KEY = 'ts_commune_members';
  const DAY = 86400000;

  const CURRENCIES = {
    USD: { symbol: '$', locale: 'en-US' }, INR: { symbol: '₹', locale: 'en-IN' }, EUR: { symbol: '€', locale: 'de-DE' },
    GBP: { symbol: '£', locale: 'en-GB' }, AED: { symbol: 'AED', locale: 'en-AE' }
  };
  const METHODS = [
    ['card', 'Card', 'credit_card', 'Visa, Mastercard, RuPay, Amex'],
    ['upi', 'UPI', 'qr_code_2', 'Scan the code or open your UPI app'],
    ['wallet', 'Apple Pay / Google Pay', 'contactless', 'Your device wallet'],
    ['crypto', 'Crypto', 'token', 'USDT, BTC, ETH, XRP, USD1 and more']
  ];
  const REFUND_DAYS = 7;

  /* ── Paying in crypto ────────────────────────────────────────────────
     The coins people actually hold, and the networks each one settles on.
     Token contract addresses are deliberately absent: the payer's own
     wallet knows them, this app does not, and a wrong contract pasted
     from somewhere is how people lose funds. */
  const PAY_NETS = {
    ethereum: { label: 'Ethereum',  tag: 'ERC-20',       family: 'evm' },
    bnb:      { label: 'BNB Chain', tag: 'BEP-20',       family: 'evm' },
    tron:     { label: 'Tron',      tag: 'TRC-20',       family: 'tron' },
    solana:   { label: 'Solana',    tag: 'SPL',          family: 'solana' },
    polygon:  { label: 'Polygon',   tag: 'Polygon PoS',  family: 'evm' },
    arbitrum: { label: 'Arbitrum',  tag: 'Arbitrum One', family: 'evm' },
    base:     { label: 'Base',      tag: 'Base',         family: 'evm' },
    optimism: { label: 'Optimism',  tag: 'OP Mainnet',   family: 'evm' },
    bitcoin:  { label: 'Bitcoin',   tag: 'BTC',          family: 'bitcoin' },
    xrpl:     { label: 'XRP Ledger', tag: 'XRPL',        family: 'xrpl' }
  };
  const COINS = [
    ['USDT', 'Tether',   ['tron', 'ethereum', 'bnb', 'solana', 'polygon', 'arbitrum'], 1],
    ['USDC', 'USD Coin', ['ethereum', 'base', 'solana', 'polygon', 'arbitrum', 'optimism'], 1],
    ['USD1', 'USD1',     ['bnb', 'ethereum', 'tron'], 1],
    ['BTC',  'Bitcoin',  ['bitcoin'], 0],
    ['ETH',  'Ether',    ['ethereum', 'base', 'arbitrum', 'optimism'], 0],
    ['XRP',  'XRP',      ['xrpl'], 0],
    ['BNB',  'BNB',      ['bnb'], 0],
    ['SOL',  'Solana',   ['solana'], 0],
    ['TRX',  'TRON',     ['tron'], 0],
    ['POL',  'Polygon',  ['polygon'], 0],
    ['DAI',  'Dai',      ['ethereum', 'polygon', 'arbitrum'], 1]
  ];
  const coinOf = k => COINS.find(c => c[0] === String(k || '').toUpperCase()) || COINS[0];
  const netOf = k => PAY_NETS[k] || PAY_NETS.ethereum;
  const netsFor = coin => coinOf(coin)[2];

  /* USD per unit, straight from the live feed. Nothing is invented: when
     the feed has no rate the caller is told so rather than handed a
     number. A USD stablecoin falls back to its 1.00 peg, and says so. */
  function rate(coin) {
    const row = (window.liveCryptoPrices || {})[String(coin || '').toUpperCase()];
    if (row && +row.usd > 0) return { usd: +row.usd, at: row.at || 0, stale: !!row.stale, src: row.src || '', peg: false };
    if (coinOf(coin)[3]) return { usd: 1, at: 0, stale: false, src: 'peg', peg: true };
    return null;
  }

  /* Fiat other than USD uses P2P's indicative rate, the same one the rest
     of the app quotes local currency with, and is labelled as indicative. */
  function fx(code) {
    if (code === 'USD') return { rate: 1, indicative: false };
    const t = (typeof P2P !== 'undefined' && P2P.FIAT) ? P2P.FIAT[code] : null;
    return t && +t.rate > 0 ? { rate: +t.rate, indicative: true } : null;
  }

  /* What the membership costs in a coin. Returns why it cannot be worked
     out rather than a made-up figure. */
  function cryptoQuote(cid, amount, coin) {
    const cur = entry(cid).currency;
    const f = fx(cur);
    if (!f) return { error: `No rate is available for ${cur} right now.` };
    const r = rate(coin);
    if (!r) return { error: `No live price for ${coin} right now — pick another coin or try again in a moment.` };
    const usd = (+amount || 0) / f.rate;
    const units = usd / r.usd;
    const dp = units >= 1000 ? 2 : units >= 1 ? 4 : units >= 0.001 ? 6 : 8;
    return {
      coin: String(coin).toUpperCase(), units, text: units.toFixed(dp).replace(/0+$/, '').replace(/\.$/, ''),
      usd, usdRate: r.usd, peg: r.peg, stale: r.stale, at: r.at, src: r.src,
      fxIndicative: f.indicative, currency: cur
    };
  }

  /* ── Where the money would go ────────────────────────────────────────
     A receiving address or UPI ID is only ever shown when the community's
     owner has actually published one. Trending never invents a payment
     destination, and a demo wallet can never be one. */
  const UPI_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}@[a-zA-Z][a-zA-Z0-9.]{1,63}$/;
  function payTo(cid) { return (P.payto && P.payto[cid]) || {}; }

  function setPayCrypto(cid, o) {
    if (!CMD.can(cid, 'manage')) return { error: 'Only the owner sets where payments go.' };
    const net = o && PAY_NETS[o.net] ? o.net : '';
    const address = String((o && o.address) || '').trim();
    if (!net) return { error: 'Pick the network first.' };
    if (!address) return { error: 'Paste the receiving address.' };
    // WAD owns address checking, including refusing anything that looks
    // like a recovery phrase or a private key. It has no XRP Ledger rules,
    // so that one is only length-checked here rather than wrongly judged.
    if (typeof WAD !== 'undefined' && WAD.validate && WAD.NETS && WAD.NETS[net]) {
      const v = WAD.validate(net, address);
      if (v && v.ok === false) return { error: v.msg || 'That address does not look right for this network.' };
    } else if (net === 'xrpl' && !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)) {
      return { error: 'An XRP Ledger address starts with r and is 25–35 characters.' };
    }
    P.payto = P.payto || {};
    P.payto[cid] = { ...payTo(cid), crypto: { net, address, at: Date.now() } };
    save();
    return P.payto[cid].crypto;
  }
  function setPayUpi(cid, o) {
    if (!CMD.can(cid, 'manage')) return { error: 'Only the owner sets where payments go.' };
    const vpa = String((o && o.vpa) || '').trim();
    const name = String((o && o.name) || '').trim().slice(0, 40);
    if (!UPI_RE.test(vpa)) return { error: 'That is not a UPI ID — they look like name@bank.' };
    P.payto = P.payto || {};
    P.payto[cid] = { ...payTo(cid), upi: { vpa, name, at: Date.now() } };
    save();
    return P.payto[cid].upi;
  }
  function clearPayTo(cid, kind) {
    if (!CMD.can(cid, 'manage')) return { error: 'Only the owner sets where payments go.' };
    P.payto = P.payto || {};
    const cur = { ...payTo(cid) };
    delete cur[kind];
    P.payto[cid] = cur;
    save();
    return cur;
  }

  /* The link a UPI app opens. UPI settles in rupees only, so an amount is
     embedded just when the community charges in INR — for any other
     currency the payer types the amount their app converts to, rather
     than one this app guessed. */
  function upiURI(cid, amount, note) {
    const u = payTo(cid).upi;
    if (!u) return '';
    const e = encodeURIComponent;
    const inr = entry(cid).currency === 'INR';
    return 'upi://pay?pa=' + e(u.vpa) + '&pn=' + e(u.name || 'Trending community')
      + (inr && +amount > 0 ? '&am=' + (+amount).toFixed(2) : '')
      + '&cu=INR' + (note ? '&tn=' + e(String(note).slice(0, 50)) : '');
  }

  /* A couple of seeded communities show both models: one paid to enter,
     the rest free with optional tiers. */
  const SEED_ENTRY = { marketsdesk: { mode: 'paid', trialDays: 7, yearlyDiscount: 20, currency: 'USD', grace: 3 } };
  const DEFAULT_ENTRY = { mode: 'free', trialDays: 0, yearlyDiscount: 17, currency: 'USD', grace: 3 };

  const DEFAULT = { v: 1, entry: {}, subs: {}, receipts: [], trialed: {}, invited: {}, payto: {} };
  let P = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const base = JSON.parse(JSON.stringify(DEFAULT));
      return raw ? { ...base, ...JSON.parse(raw) } : base;
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} }

  const me = () => CMD.me();
  const uid = p => p + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36);
  const digest = obj => (typeof CPM !== 'undefined' && CPM.sha256) ? CPM.sha256(CPM.canon(obj)) : '';

  /* ── Entry settings ──────────────────────────────────────────────── */
  function entry(cid) {
    if (P.entry[cid]) return P.entry[cid];
    if (SEED_ENTRY[cid]) {
      // The switch to paid is dated the first time this browser sees it,
      // so anyone already in the community is grandfathered.
      P.entry[cid] = { ...DEFAULT_ENTRY, ...SEED_ENTRY[cid], since: Date.now(), seed: true };
      save();
      return P.entry[cid];
    }
    return { ...DEFAULT_ENTRY, since: 0 };
  }

  function setEntry(cid, patch) {
    if (!CMD.can(cid, 'manage')) return { error: 'Only the owner changes how people join.' };
    const before = entry(cid);
    const next = { ...before, ...patch };
    next.trialDays = Math.max(0, Math.min(30, Math.round(+next.trialDays || 0)));
    next.yearlyDiscount = Math.max(0, Math.min(40, Math.round(+next.yearlyDiscount || 0)));
    next.grace = Math.max(0, Math.min(14, Math.round(+next.grace || 0)));
    if (!CURRENCIES[next.currency]) next.currency = 'USD';
    if (next.mode === 'paid' && before.mode !== 'paid') {
      if (!paidTiers(cid).length) return { error: 'Add at least one paid tier before requiring a membership to join.' };
      next.since = Date.now();
    }
    delete next.seed;
    P.entry[cid] = next;
    save();
    return next;
  }

  /* ── Tiers and prices ────────────────────────────────────────────── */
  const tiers = cid => CMD.tiers(cid);
  const paidTiers = cid => tiers(cid).filter(t => +t.price > 0);
  const tier = (cid, tid) => tiers(cid).find(t => t.id === tid) || null;

  function price(cid, t, cycle) {
    if (!t) return 0;
    if (cycle === 'yearly') {
      if (+t.yearly > 0) return +t.yearly;
      return Math.round(+t.price * 12 * (1 - entry(cid).yearlyDiscount / 100) * 100) / 100;
    }
    return +t.price || 0;
  }
  const saving = (cid, t) => {
    const full = (+t.price || 0) * 12;
    return full ? Math.round((1 - price(cid, t, 'yearly') / full) * 100) : 0;
  };

  function fmt(amount, currency) {
    const c = CURRENCIES[currency] || CURRENCIES.USD;
    const code = CURRENCIES[currency] ? currency : 'USD';
    try { return new Intl.NumberFormat(c.locale, { style: 'currency', currency: code, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount); }
    catch (e) { return c.symbol + (+amount).toFixed(2); }
  }
  const money = (cid, amount) => fmt(amount, entry(cid).currency);
  const per = cycle => cycle === 'yearly' ? '/yr' : '/mo';

  /* ── Subscriptions ───────────────────────────────────────────────── */
  const addCycle = (ts, cycle) => {
    const d = new Date(ts);
    if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1); else d.setMonth(d.getMonth() + 1);
    return d.getTime();
  };

  function receipt(cid, s, kind, amount, extra) {
    const body = { cid, community: (CMD.byId(cid) || {}).name, tier: s.tier, tierName: (tier(cid, s.tier) || {}).name, kind, amount,
      currency: s.currency, cycle: s.cycle, method: s.method, at: Date.now(), holder: me().handle, simulated: true, ...(extra || {}) };
    const r = { id: uid('rc'), ...body, digest: digest(body) };
    P.receipts.unshift(r);
    if (P.receipts.length > 300) P.receipts.length = 300;
    return r;
  }

  function grant(cid, s) {
    const t = tier(cid, s.tier);
    const role = (t && t.role) || 'subscriber';
    s.granted = s.granted || [];
    if (CMD.isJoined(cid) && CMD.myRoles(cid).indexOf(role) < 0) { CMD.grantRole(cid, role); if (s.granted.indexOf(role) < 0) s.granted.push(role); }
    const m = CMD.membership(cid);
    if (m) m.tier = s.tier;
    CMD.state().tiers[cid] = s.tier;
    CMD.save();
  }

  function revoke(cid, s) {
    (s.granted || []).forEach(r => { if (CMD.isJoined(cid)) CMD.revokeRole(cid, r); });
    s.granted = [];
    const m = CMD.membership(cid);
    if (m) m.tier = 'free';
    CMD.state().tiers[cid] = 'free';
    CMD.save();
  }

  /* Time moves the lifecycle forward: trials convert, periods renew or
     end. Runs lazily whenever a subscription is read. */
  function settle(cid) {
    const s = P.subs[cid];
    if (!s) return null;
    const now = Date.now();
    let changed = false;
    if (s.status === 'trialing' && now >= s.trialEnd) {
      if (s.autoRenew) {
        s.status = 'active';
        s.periodStart = s.trialEnd;
        s.periodEnd = addCycle(s.trialEnd, s.cycle);
        receipt(cid, s, 'charge', price(cid, tier(cid, s.tier), s.cycle), { note: 'First payment after free trial', periodStart: s.periodStart, periodEnd: s.periodEnd });
        s.history.push({ at: s.trialEnd, what: 'Trial converted' });
      } else {
        s.status = 'expired';
        s.history.push({ at: s.trialEnd, what: 'Trial ended' });
        revoke(cid, s);
      }
      changed = true;
    }
    let guard = 0;
    while ((s.status === 'active' || s.status === 'cancelled') && now >= s.periodEnd && guard++ < 36) {
      if (s.status === 'active' && s.autoRenew) {
        if (s.pendingTier) { s.history.push({ at: s.periodEnd, what: 'Changed to ' + ((tier(cid, s.pendingTier) || {}).name || s.pendingTier) }); revoke(cid, s); s.tier = s.pendingTier; delete s.pendingTier; }
        if (s.pendingCycle) { s.cycle = s.pendingCycle; delete s.pendingCycle; }
        s.periodStart = s.periodEnd;
        s.periodEnd = addCycle(s.periodEnd, s.cycle);
        receipt(cid, s, 'charge', price(cid, tier(cid, s.tier), s.cycle), { note: 'Renewal', periodStart: s.periodStart, periodEnd: s.periodEnd });
        s.history.push({ at: s.periodStart, what: 'Renewed' });
        grant(cid, s);
      } else {
        s.status = 'expired';
        s.history.push({ at: s.periodEnd, what: 'Membership ended' });
        revoke(cid, s);
      }
      changed = true;
    }
    if (changed) save();
    return s;
  }

  const sub = cid => settle(cid);
  const live = s => !!s && ['trialing', 'active', 'cancelled'].indexOf(s.status) > -1;
  const activeTier = cid => { const s = sub(cid); return live(s) ? s.tier : null; };

  function grandfathered(cid) {
    const e = entry(cid);
    const m = CMD.membership(cid);
    return !!(m && e.mode === 'paid' && e.since && m.at < e.since);
  }

  function hasAccess(cid) {
    const c = CMD.byId(cid);
    if (entry(cid).mode !== 'paid') return true;
    if (!CMD.isJoined(cid)) return false;
    if (c && CMD.iOwn(c)) return true;
    if (grandfathered(cid)) return true;
    const s = sub(cid);
    if (live(s)) return true;
    // A short grace period after a lapse, the way real billing retries do.
    if (s && s.status === 'expired' && !s.refunded && s.periodEnd && Date.now() < s.periodEnd + entry(cid).grace * DAY) return true;
    return false;
  }

  /* Called from CMD.can: a lapsed member of a paid community can still
     read, but not post, react, speak or vote. Staff are never locked. */
  function blocks(cid, perm) {
    if (perm === 'view' || entry(cid).mode !== 'paid' || !CMD.isJoined(cid)) return false;
    const m = CMD.membership(cid);
    if (m && (m.roles || []).some(r => ['owner', 'admin', 'mod'].indexOf(r) > -1)) return false;
    return !hasAccess(cid);
  }

  function status(cid) {
    const s = sub(cid);
    const e = entry(cid);
    if (s && live(s)) return { kind: s.status, s };
    const c = CMD.byId(cid);
    if (c && CMD.isJoined(cid) && CMD.iOwn(c)) return { kind: 'owner', s };
    if (e.mode !== 'paid') return { kind: s && s.status === 'expired' ? 'ended' : CMD.isJoined(cid) ? 'free' : 'none', s };
    if (!CMD.isJoined(cid)) return { kind: 'none', s };
    if (grandfathered(cid)) return { kind: 'founding', s };
    if (hasAccess(cid)) return { kind: 'grace', s };
    return { kind: 'lapsed', s };
  }

  /* ── Checkout ────────────────────────────────────────────────────── */
  function quote(cid, tid, cycle) {
    const t = tier(cid, tid);
    const e = entry(cid);
    if (!t) return null;
    const amount = price(cid, t, cycle);
    const trial = e.trialDays > 0 && !P.trialed[cid] && !live(P.subs[cid]) ? e.trialDays : 0;
    const now = Date.now();
    const firstCharge = trial ? now + trial * DAY : now;
    return { t, amount, cycle, trial, dueToday: trial ? 0 : amount, firstCharge, renews: addCycle(firstCharge, cycle), currency: e.currency, saving: cycle === 'yearly' ? saving(cid, t) : 0 };
  }

  function seatsTaken(cid, tid) {
    const c = CMD.byId(cid);
    const t = tier(cid, tid);
    if (!c || !t) return 0;
    return Math.round((c.members || 0) * (t.price >= 10 ? 0.0015 : 0.008)) + (activeTier(cid) === tid ? 1 : 0);
  }

  function checkout(cid, opts) {
    const o = opts || {};
    const t = tier(cid, o.tier);
    if (!t || !(+t.price > 0)) return { error: 'Pick a paid tier.' };
    if (!o.agree) return { error: 'Confirm that you understand how renewal works.' };
    if (METHODS.every(m => m[0] !== o.method)) return { error: 'Choose how you would pay.' };
    if (!CMD.isJoined(cid)) return { error: 'Join first.' };
    if (t.limit && seatsTaken(cid, t.id) >= t.limit) return { error: `${t.name} is full — all ${t.limit} places are taken.` };
    const cur = sub(cid);
    if (live(cur)) return changeTier(cid, t.id, o.method, o);
    const q = quote(cid, t.id, o.cycle === 'yearly' ? 'yearly' : 'monthly');
    const now = Date.now();
    const s = {
      cid, tier: t.id, cycle: q.cycle, method: o.method, currency: q.currency, autoRenew: true, started: now,
      coin: o.method === 'crypto' ? String(o.coin || '').toUpperCase() : '', net: o.method === 'crypto' ? (o.net || '') : '',
      status: q.trial ? 'trialing' : 'active', trialEnd: q.trial ? q.firstCharge : null,
      periodStart: q.trial ? null : now, periodEnd: q.trial ? q.firstCharge : q.renews, granted: [], history: (cur && cur.history) || []
    };
    if (q.trial) {
      P.trialed[cid] = now;
      s.history.push({ at: now, what: `Started a ${q.trial}-day free trial of ${t.name}` });
      receipt(cid, s, 'trial', 0, { note: `${q.trial}-day free trial · first payment ${new Date(q.firstCharge).toLocaleDateString()}` });
    } else {
      s.history.push({ at: now, what: `Joined ${t.name} (${q.cycle})` });
      receipt(cid, s, 'charge', q.amount, { note: 'First payment', periodStart: s.periodStart, periodEnd: s.periodEnd });
    }
    P.subs[cid] = s;
    grant(cid, s);
    save();
    CMD.addRep(cid, 5);
    if (typeof CPM !== 'undefined' && CPM.emit) CPM.emit('membership', { cid, tier: t.id, status: s.status });
    return { ok: true, s, trial: q.trial, amount: q.dueToday };
  }

  /* Upgrades apply now and charge the difference for the rest of the
     period. Downgrades wait until renewal so nobody loses what they paid
     for. */
  function changeTier(cid, tid, method, o) {
    const s = sub(cid);
    const t = tier(cid, tid);
    if (!live(s)) return { error: 'No active membership to change.' };
    if (!t) return { error: 'Tier not found.' };
    if (s.tier === tid) { delete s.pendingTier; save(); return { error: `You are already on ${t.name}.` }; }
    const curT = tier(cid, s.tier);
    const now = Date.now();
    if (!(+t.price > 0)) return cancel(cid);
    if (price(cid, t, s.cycle) > price(cid, curT, s.cycle)) {
      const left = s.status === 'trialing' ? 0 : Math.max(0, (s.periodEnd - now) / Math.max(1, s.periodEnd - s.periodStart));
      const diff = Math.round((price(cid, t, s.cycle) - price(cid, curT, s.cycle)) * left * 100) / 100;
      revoke(cid, s);
      s.tier = tid;
      delete s.pendingTier;
      if (method) s.method = method;
      if (method === 'crypto' && o) { s.coin = String(o.coin || '').toUpperCase(); s.net = o.net || ''; }
      if (s.status === 'cancelled') { s.status = 'active'; s.autoRenew = true; }
      if (diff > 0) receipt(cid, s, 'charge', diff, { note: `Upgrade to ${t.name} — prorated for the rest of this period` });
      s.history.push({ at: now, what: `Upgraded to ${t.name}` });
      grant(cid, s);
      save();
      return { ok: true, upgraded: true, amount: diff, s };
    }
    s.pendingTier = tid;
    s.history.push({ at: now, what: `Scheduled change to ${t.name} at renewal` });
    save();
    return { ok: true, scheduled: true, s };
  }

  function switchCycle(cid, cycle) {
    const s = sub(cid);
    if (!live(s)) return { error: 'No active membership.' };
    if (s.cycle === cycle) { delete s.pendingCycle; save(); return { ok: true }; }
    s.pendingCycle = cycle;
    s.history.push({ at: Date.now(), what: `Billing switches to ${cycle} at renewal` });
    save();
    return { ok: true, s };
  }

  function cancel(cid) {
    const s = sub(cid);
    if (!live(s)) return { error: 'No active membership to cancel.' };
    s.autoRenew = false;
    if (s.status === 'active') s.status = 'cancelled';
    delete s.pendingTier; delete s.pendingCycle;
    s.history.push({ at: Date.now(), what: 'Cancelled — access continues until the period ends' });
    save();
    return { ok: true, until: s.status === 'trialing' ? s.trialEnd : s.periodEnd, s };
  }

  function resume(cid) {
    const s = sub(cid);
    if (!s || !(s.status === 'cancelled' || (s.status === 'trialing' && !s.autoRenew))) return { error: 'Nothing to resume.' };
    s.autoRenew = true;
    if (s.status === 'cancelled') s.status = 'active';
    s.history.push({ at: Date.now(), what: 'Renewal switched back on' });
    save();
    return { ok: true, s };
  }

  function lastCharge(cid) { return P.receipts.find(r => r.cid === cid && r.kind === 'charge' && r.amount > 0) || null; }
  function canRefund(cid) {
    const s = sub(cid);
    const r = lastCharge(cid);
    return !!(live(s) && r && Date.now() - r.at < REFUND_DAYS * DAY && !P.receipts.some(x => x.kind === 'refund' && x.of === r.id));
  }
  function refund(cid) {
    if (!canRefund(cid)) return { error: `Refunds are available within ${REFUND_DAYS} days of a payment.` };
    const s = sub(cid);
    const r = lastCharge(cid);
    receipt(cid, s, 'refund', -r.amount, { of: r.id, note: 'Refund of ' + r.id });
    s.status = 'expired';
    s.refunded = true;
    s.autoRenew = false;
    s.periodEnd = Date.now();
    s.history.push({ at: Date.now(), what: 'Refunded and ended' });
    revoke(cid, s);
    save();
    return { ok: true, amount: r.amount };
  }

  /* Demo only: move this subscription's clock forward so renewal, trial
     conversion and expiry can be seen without waiting a month. */
  function fastForward(cid, days) {
    const s = P.subs[cid];
    if (!s) return { error: 'No membership.' };
    const ms = days * DAY;
    ['started', 'trialEnd', 'periodStart', 'periodEnd'].forEach(k => { if (s[k]) s[k] -= ms; });
    s.history.forEach(h => { h.at -= ms; });
    // Receipts move with the clock, and their digests are recomputed so
    // they still verify.
    P.receipts.filter(r => r.cid === cid).forEach(r => { r.at -= ms; const { id, digest: d, ...body } = r; r.digest = digest(body); });
    save();
    return { ok: true, s: settle(cid) };
  }

  const receipts = cid => P.receipts.filter(r => !cid || r.cid === cid);
  const mySubs = () => Object.keys(P.subs).map(cid => ({ cid, s: settle(cid) })).filter(x => x.s);

  function markInvited(cid) { P.invited[cid] = Date.now(); save(); }
  const invited = cid => !!P.invited[cid];

  /* ── Studio numbers ──────────────────────────────────────────────── */
  /* Subscriber counts for seeded communities are estimates labelled as
     demo; the viewer's own subscription is counted as real. */
  function stats(cid) {
    const c = CMD.byId(cid);
    const e = entry(cid);
    const rows = paidTiers(cid).map(t => {
      const demo = c && !c.owner ? Math.round((c.members || 0) * (t.price >= 10 ? 0.0015 : 0.008)) : 0;
      const real = activeTier(cid) === t.id && !CMD.iOwn(c) ? 1 : 0;
      return { t, demo, real, count: demo + real, mrr: (demo + real) * t.price };
    });
    const mrr = rows.reduce((s, r) => s + r.mrr, 0);
    const subs = rows.reduce((s, r) => s + r.count, 0);
    const fees = mrr * 0.1 + mrr * 0.03;
    const history = [];
    for (let i = 5; i >= 0; i--) history.push({ label: new Date(new Date().setMonth(new Date().getMonth() - i)).toLocaleDateString(undefined, { month: 'short' }), v: Math.round(mrr * (0.62 + (5 - i) * 0.076)) });
    return { rows, mrr, arr: mrr * 12, subs, arpm: subs ? mrr / subs : 0, fees, payout: mrr - fees, history, currency: e.currency, demo: rows.some(r => r.demo) };
  }

  settleAll();
  function settleAll() { Object.keys(P.subs).forEach(settle); }

  return {
    CURRENCIES, METHODS, REFUND_DAYS, COINS, PAY_NETS, coinOf, netOf, netsFor,
    rate, cryptoQuote, payTo, setPayCrypto, setPayUpi, clearPayTo, upiURI,
    entry, setEntry, tiers, paidTiers, tier, price, saving, fmt, money, per,
    sub, live, activeTier, status, hasAccess, blocks, grandfathered,
    quote, seatsTaken, checkout, changeTier, switchCycle, cancel, resume, canRefund, refund, fastForward,
    receipts, mySubs, markInvited, invited, stats, settleAll,
    state: () => P, save
  };
})();

window.CMB = CMB;

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module now, so its top-level names are private
   to it. Inline onclick= handlers and every other module still look
   them up on the global object, so they are republished here.

   Each one is a thunk because the list is produced by scanning, and
   scanning over-collects — a line inside a template literal can look
   like a declaration. publish() calls each thunk and skips the ones
   that do not resolve, so a phantom costs one caught error and not a
   dead module graph. */
import { publish } from '../globals.js?v=3';
publish('features/communemember.js', {
  CMB: () => CMB
});
