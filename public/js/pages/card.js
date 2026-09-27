/* ╔══════════════════════════════════════════════════════════════════╗
   ║  TRENDING CARD — the page                                         ║
   ║                                                                   ║
   ║  Draws the card and everything around it: activity, controls,     ║
   ║  spending coins, card management and support. The rules are in   ║
   ║  features/cardcore.js (CDX); this file never decides what a       ║
   ║  payment does, it asks CDX and shows the answer.                  ║
   ║                                                                   ║
   ║  PRACTICE. Trending has no card-issuing partner, so the card is a ║
   ║  practice card and the page says so at the top. Payments happen   ║
   ║  at made-up shops in "Pay at a practice shop", and spend the      ║
   ║  practice balance through MNY, which writes each one into the     ║
   ║  wallet's history.                                                ║
   ║                                                                   ║
   ║  SENSITIVE ACTIONS ask who you are (TP.verify: your password, or  ║
   ║  a fresh Google or Apple sign-in): getting a card, showing its    ║
   ║  details (every time), unfreezing, turning a control back on,     ║
   ║  raising a limit, ordering, activating, replacing or closing a    ║
   ║  card. Protective ones - freezing, reporting it lost, turning     ║
   ║  something off - ask nothing, because a thief gains nothing from  ║
   ║  them and the owner may be in a hurry.                            ║
   ║                                                                   ║
   ║  CARD DETAILS are built when shown, kept in memory for 30         ║
   ║  seconds, hidden when you leave the tab, and never written to     ║
   ║  storage or the console.                                          ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const TCD = (() => {

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const ico = (n, cls) => `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}" aria-hidden="true">${n}</span>`;
  const toast = m => { if (m && typeof showToast === 'function') showToast(m); };
  const ask = (msg, opts) => (typeof appConfirm === 'function' ? appConfirm(msg, opts) : Promise.resolve(true));
  const askText = (msg, value, opts) => (typeof appPrompt === 'function' ? appPrompt(msg, value, opts) : Promise.resolve(null));
  const X = () => CDX;

  /* ── The shops you can practise at ───────────────────────────────── */
  /* Made up, with plain descriptive names, so none of them is a real
     business. Each one exists to show something: a tip, a hotel
     deposit, a foreign currency, a cash machine, an offline terminal,
     and two kinds of shop no crypto card may pay. */
  const SHOPS = [
    { id: 'books',   name: 'Byte Books',             mcc: 5942, city: 'Online',   country: 'US', currency: 'USD', amount: '29.99',  channel: 'online',      icon: 'menu_book' },
    { id: 'stream',  name: 'Stream subscription',    mcc: 4899, city: 'Online',   country: 'US', currency: 'USD', amount: '9.99',   channel: 'online',      icon: 'live_tv' },
    { id: 'hotel',   name: 'Hotel Aurora',           mcc: 7011, city: 'Lisbon',   country: 'PT', currency: 'EUR', amount: '180.00', channel: 'online',      icon: 'hotel', hint: 'Holds a deposit, then collects less' },
    { id: 'cafe',    name: 'Café Lumen',             mcc: 5814, city: 'Portland', country: 'US', currency: 'USD', amount: '12.40',  channel: 'contactless', icon: 'local_cafe', hint: 'May add a tip when it collects' },
    { id: 'grocer',  name: 'Corner Grocer',          mcc: 5411, city: 'Austin',   country: 'US', currency: 'USD', amount: '42.18',  channel: 'contactless', icon: 'local_grocery_store' },
    { id: 'ramen',   name: 'Ramen Bar Shibuya',      mcc: 5812, city: 'Tokyo',    country: 'JP', currency: 'JPY', amount: '1850',   channel: 'contactless', icon: 'ramen_dining' },
    { id: 'tea',     name: 'Monsoon Tea House',      mcc: 5814, city: 'Mumbai',   country: 'IN', currency: 'INR', amount: '240.00', channel: 'contactless', icon: 'emoji_food_beverage' },
    { id: 'bikes',   name: 'Riverside Bike Hire',    mcc: 5941, city: 'London',   country: 'GB', currency: 'GBP', amount: '24.50',  channel: 'chip',        icon: 'pedal_bike' },
    { id: 'transit', name: 'Transit gate',           mcc: 4111, city: 'Chicago',  country: 'US', currency: 'USD', amount: '2.50',   channel: 'contactless', icon: 'train', offline: true, hint: 'Can approve without going online' },
    { id: 'atm',     name: 'Cash machine',           mcc: 6011, city: 'Paris',    country: 'FR', currency: 'EUR', amount: '100.00', channel: 'atm',         icon: 'local_atm' },
    { id: 'casino',  name: 'Online casino',          mcc: 7995, city: 'Online',   country: 'MT', currency: 'EUR', amount: '50.00',  channel: 'online',      icon: 'casino', hint: 'Never allowed on a crypto card' },
    { id: 'topup',   name: 'Crypto exchange top-up', mcc: 6051, city: 'Online',   country: 'US', currency: 'USD', amount: '200.00', channel: 'online',      icon: 'currency_bitcoin', hint: 'Never allowed on a crypto card' }
  ];
  const CAT_ICON = { groceries: 'local_grocery_store', dining: 'restaurant', transport: 'directions_bus', travel: 'flight', shopping: 'shopping_bag', digital: 'apps', health: 'medical_services', cash: 'local_atm', other: 'storefront' };

  /* ── State ───────────────────────────────────────────────────────── */
  /* One practice card per person on this device: the key carries the
     signed-in account, so a second person on the same browser starts
     with nothing of the first one's. */
  const uid = () => { try { const u = window.firebaseAuth && window.firebaseAuth.currentUser; return u && u.uid ? u.uid : 'guest'; } catch (e) { return 'guest'; } };
  const keyNow = () => 'ts_card_v1:' + uid();
  let STATE = null, STATE_KEY = '';

  const V = {
    tab: 'activity', cardId: null, filter: 'all', agreed: false,
    reveal: null, revealTimer: 0, tickTimer: 0,
    sheet: null, faq: '',
    shop: { id: null, cardId: null, amount: '', offline: false, result: null },
    fx: null, fxAt: 0, fxErr: '',
    program: { state: 'sandbox', why: '' }, programAt: 0,
    sending: false
  };

  function st() {
    const k = keyNow();
    if (!STATE || STATE_KEY !== k) {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { raw = null; }
      STATE = X().normalize(raw);
      STATE_KEY = k;
      V.cardId = null;
      hideReveal(true);
    }
    return STATE;
  }
  function save() { try { localStorage.setItem(STATE_KEY || keyNow(), JSON.stringify(STATE)); } catch (e) {} }

  const rnd = () => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); } };

  /* The practice balance, as CDX sees it. A coin with only a remembered
     or declared price is not live, so the card will not sell it. */
  const wallet = {
    quote(a) {
      const s = st();
      const stable = X().ASSETS[a] && X().ASSETS[a].stable;
      if (s.sim.pricesDown && !stable) return { usd: 0, live: false };
      if (typeof MNY === 'undefined') return { usd: 0, live: false };
      const q = MNY.quote(a);
      return { usd: q.usd, live: !!q.live && !q.reference, at: Date.now(), source: '' };
    },
    balance: a => (typeof MNY !== 'undefined' ? Number(MNY.spendable(a)) || 0 : 0),
    debit: (a, qty, m) => typeof MNY !== 'undefined' && !!MNY.spend(a, qty, { kind: 'card', via: 'Trending Card', to: m.merchant, note: m.note }).ok,
    credit: (a, qty, m) => typeof MNY !== 'undefined' && !!MNY.receive(a, qty, { kind: 'receive', via: m.via || 'Trending Card', from: m.merchant, simulated: false }).ok
  };
  const env = () => ({ now: Date.now(), rand: rnd, wallet, fx: V.fx, outage: st().sim.outage, paused: V.program.state === 'paused' });

  /* ── Server: the programme's state and the day's exchange rates ──── */
  async function getJSON(url) {
    const r = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    let j = null;
    try { j = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, data: j || {} };
  }
  async function loadProgram() {
    if (Date.now() - V.programAt < 5 * 60000) return;
    V.programAt = Date.now();
    try {
      const r = await getJSON('/api/card/status');
      if (r.ok && r.data.state) V.program = { state: r.data.state, why: r.data.why || '', needs: r.data.needs || [] };
    } catch (e) { /* offline: the practice card still works */ }
  }
  async function loadFx() {
    if (V.fx && Date.now() - V.fxAt < 30 * 60000) return;
    V.fxAt = Date.now();
    try {
      const r = await getJSON('/api/card/fx');
      if (r.ok && r.data.ok) { V.fx = { ...r.data, fetchedAt: Date.now() }; V.fxErr = ''; }
      else V.fxErr = r.data.reason || 'Exchange rates are unavailable right now.';
    } catch (e) { V.fxErr = 'Exchange rates are unavailable right now.'; }
  }

  /* ── Proving it's you ────────────────────────────────────────────── */
  async function stepUp(what, fresh) {
    if (typeof TP === 'undefined' || !TP.verify) {
      return !!(await ask(`${what} affects your card. Continue?`, { title: 'Confirm it is you', ok: 'Continue' }));
    }
    if (fresh && TP.dropVerify) TP.dropVerify();
    return !!(await TP.verify(what));
  }

  /* ── Helpers ─────────────────────────────────────────────────────── */
  const cards = () => st().cards;
  const liveCards = () => cards().filter(c => X().USABLE.includes(c.status));
  function current() {
    const s = st();
    let c = s.cards.find(x => x.id === V.cardId);
    if (!c) c = liveCards().find(x => x.kind === 'virtual') || liveCards()[0] || s.cards[s.cards.length - 1] || null;
    V.cardId = c ? c.id : null;
    return c;
  }
  const holderName = () => {
    const u = (typeof S !== 'undefined' && S.user) || {};
    const n = u.name || [u.fname, u.lname].filter(Boolean).join(' ');
    // A guest has no name to print; the profile marks one with fname 'Guest'.
    return n && u.fname !== 'Guest' && !/^guest( user)?$/i.test(n.trim()) ? n : 'Practice cardholder';
  };
  const cardLabel = c => `${c.kind === 'virtual' ? 'Virtual' : 'Physical'} •••• ${c.last4}`;
  const STATUS_TEXT = { active: 'Active', frozen: 'Frozen', inactive: 'Not activated', lost: 'Reported lost', stolen: 'Reported stolen', closed: 'Closed', replaced: 'Replaced', expired: 'Expired' };
  function when(t) {
    const d = new Date(t), now = new Date();
    const hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    if (diff === 0) return 'Today ' + hm;
    if (diff === 1) return 'Yesterday ' + hm;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + ' ' + hm;
  }
  const unread = () => st().notes.filter(n => !n.read).length;
  function note(n) { return X().note(st(), { now: Date.now(), ...n }); }
  const toggle = (on, attrs, label) => `<button type="button" class="cd-switch${on ? ' on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="${esc(label)}" ${attrs}><span></span></button>`;

  /* ── The card face ───────────────────────────────────────────────── */
  /* The Trending card's own look: an ink-teal virtual card and a
     graphite physical one, each carrying the rising trend line the
     name comes from. No network mark: that belongs to whichever card
     network a future partner uses, so the practice card says PRACTICE
     where the mark would go. */
  function face(c, big) {
    const now = Date.now();
    const status = X().statusOf(c, now);
    const shown = V.reveal && V.reveal.id === c.id && V.reveal.until > now ? V.reveal.details : null;
    const dead = ['lost', 'stolen', 'closed', 'replaced', 'expired'].includes(status);
    return `<div class="cd-face ${c.kind}${status === 'frozen' ? ' frozen' : ''}${dead ? ' dead' : ''}${big ? ' big' : ''}" aria-label="${esc(cardLabel(c))}, ${esc(STATUS_TEXT[status] || status)}">
      <svg class="cd-trend" viewBox="0 0 320 200" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-10 170 L40 150 L78 158 L120 118 L158 126 L204 78 L236 88 L330 18" />
        <path class="glow" d="M-10 170 L40 150 L78 158 L120 118 L158 126 L204 78 L236 88 L330 18" />
      </svg>
      <div class="cd-face-top">
        <span class="cd-mark">${ico('trending_up')}<b>trending</b></span>
        <span class="cd-kind">${c.kind === 'virtual' ? 'Virtual' : 'Card'}</span>
      </div>
      ${c.kind === 'physical' ? `<div class="cd-chiprow"><span class="cd-chip" aria-hidden="true"></span>${ico('contactless', 'cd-nfc')}</div>` : '<div class="cd-chiprow"></div>'}
      <div class="cd-num" ${shown ? 'aria-live="polite"' : ''}>${shown ? esc(shown.number) : '•••• •••• •••• ' + esc(c.last4)}</div>
      <div class="cd-face-bot">
        <div><small>Cardholder</small><span>${esc(c.name)}</span></div>
        <div><small>Expires</small><span>${esc(X().expText(c))}</span></div>
        ${shown ? `<div><small>CVC</small><span>${esc(shown.cvc)}</span></div>` : ''}
        <span class="cd-practice">Practice</span>
      </div>
      ${status === 'frozen' ? `<div class="cd-over">${ico('ac_unit')}<b>Frozen</b></div>` : ''}
      ${dead ? `<div class="cd-over">${ico(status === 'expired' ? 'event_busy' : 'block')}<b>${esc(STATUS_TEXT[status])}</b></div>` : ''}
    </div>`;
  }

  /* ══ Paint ═══════════════════════════════════════════════════════ */
  function paint() {
    const root = $('card-root');
    if (!root) return;
    const s = st();
    // Both calls mark their time before fetching, so the repaint can't loop.
    if (Date.now() - V.programAt > 5 * 60000) loadProgram().then(() => paint());
    if (Date.now() - V.fxAt > 30 * 60000) loadFx().then(() => paint());
    const e = env();
    X().expireHolds(s, e).length && save();
    if (V.program.state === 'unavailable') { root.innerHTML = unavailableHTML(); return; }
    root.innerHTML = s.cards.length ? mainHTML() : introHTML();
  }

  function unavailableHTML() {
    return `<div class="cd-panel">${ico('credit_card_off', 'cd-big-ico')}<h2>The Trending Card isn’t available</h2><p class="cd-lead">${esc(V.program.why || 'The card needs a card-issuing partner.')}</p></div>`;
  }

  function mechanismHTML() {
    const P = X().PROGRAM;
    return `<ol class="cd-steps">
      <li><b>Your card account is in US dollars.</b> When you pay, Trending sells just enough of your chosen coin for dollars, at the live market price at that moment. A coin with no live price is never sold — the payment is declined instead.</li>
      <li><b>Paying in another currency?</b> It is converted at the European Central Bank’s reference rate for the day, plus a ${P.fees.fxBps / 100}% foreign-currency fee. Nothing is added to the rate itself.</li>
      <li><b>Conversion fee:</b> ${P.fees.convBps / 100}% when a coin that moves in price (BTC, ETH, SOL, BNB) is sold. None for USDT or USDC, which count as dollars.</li>
      <li><b>You choose the coin.</b> Your preferred coin pays first; if it can’t cover a payment, the next coin you turned on does. One coin pays each payment.</li>
      <li><b>Refunds</b> come back in the coin you paid with, at its price on the day they arrive, with the matching share of your fees. If the price moved, the amount of coin differs.</li>
      <li><b>At a real till there is no time for a quote,</b> so Assets shows today’s rates and fees at any time, and every payment’s message says exactly what was sold, at what price, and what the fees were.</li>
    </ol>`;
  }

  function feesHTML() {
    const P = X().PROGRAM;
    const rows = [
      ['Getting a card', '$0.00'], ['Monthly fee', '$0.00'],
      ['Selling BTC, ETH, SOL or BNB to pay', `${P.fees.convBps / 100}% of the card charge`],
      ['Paying with USDT or USDC', 'No conversion fee'],
      ['Paying in another currency', `${P.fees.fxBps / 100}% of the dollar amount`],
      ['Cash machine withdrawal', `${X().usd(P.fees.atmCents)} each, plus the cash machine’s own fee if it has one`],
      ['Replacing a card', '$0.00'], ['Refunds', 'Your share of fees comes back with them']
    ];
    return `<table class="cd-table"><tbody>${rows.map(([a, b]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table>`;
  }

  function introHTML() {
    const demo = { id: 'CRD-PREVIEW', kind: 'virtual', status: 'active', last4: '0000', expMonth: new Date().getMonth() + 1, expYear: new Date().getFullYear() + 3, name: holderName().toUpperCase() };
    return `<div class="cd-intro">
      <div class="cd-intro-art">${face(demo, true)}</div>
      <div class="cd-intro-copy">
        <h2>Spend your crypto anywhere cards work</h2>
        <p class="cd-lead">A virtual card for paying online at once, and a physical card for shops and cash machines if you want one. You choose which coins it may sell, freeze it with one tap, and see every payment explained.</p>
        <ul class="cd-ticks">
          <li>${ico('check_circle')}Freeze, limits and controls for online, international, contactless and cash machines</li>
          <li>${ico('check_circle')}Every payment shows the rate, the fees and the coin used</li>
          <li>${ico('check_circle')}Refunds, cancelled payments and reports tracked to the end</li>
        </ul>
      </div>
    </div>
    <section class="cd-panel"><h3>How paying with crypto works</h3>${mechanismHTML()}</section>
    <section class="cd-panel"><h3>Fees</h3>${feesHTML()}<p class="cd-note">Practice pricing. A real card’s prices would be set with its card partner and shown here before you got it.</p></section>
    <section class="cd-panel"><h3>A real card would need</h3>
      <ul class="cd-needs">
        <li>${ico('account_balance')}<span><b>A licensed card-issuing partner.</b> Cards are issued by a regulated partner and a card network, not by Trending. Trending doesn’t have one yet.</span></li>
        <li>${ico('badge')}<span><b>Identity verification</b> by that partner, as the law requires for any payment card.</span></li>
        <li>${ico('public')}<span><b>A country where it’s offered.</b> Each country is approved separately.</span></li>
      </ul>
    </section>
    <section class="cd-panel cd-get">
      <label class="cd-agree"><input type="checkbox" data-cd="agree"${V.agreed ? ' checked' : ''}> <span>I understand this is a <b>practice card</b>: there is no real card, no real card number and no real money, and it spends my practice balance.</span></label>
      <button type="button" class="btn btn-primary cd-wide" data-cd="issue"${V.agreed ? '' : ' disabled'}>${ico('add_card')}Get my practice virtual card</button>
      <p class="cd-note">You’ll be asked to confirm it’s you first.</p>
    </section>`;
  }

  function mainHTML() {
    const s = st(), c = current(), now = Date.now();
    const status = X().statusOf(c, now);
    const tabs = [['activity', 'Activity'], ['controls', 'Controls'], ['assets', 'Assets'], ['manage', 'Manage'], ['help', 'Help']];
    const list = [...liveCards(), ...cards().filter(x => !X().USABLE.includes(x.status)).slice(-3).reverse()];
    const n = unread();
    return `
      ${list.length > 1 ? `<div class="cd-switcher" role="tablist" aria-label="Your cards">${list.map(x => `<button type="button" role="tab" aria-selected="${x.id === c.id}" class="cd-chipbtn${x.id === c.id ? ' on' : ''}" data-cd="pick" data-id="${esc(x.id)}">${ico(x.kind === 'virtual' ? 'credit_card' : 'contactless')}${esc(cardLabel(x))}<small>${esc(STATUS_TEXT[X().statusOf(x, now)] || '')}</small></button>`).join('')}</div>` : ''}
      <div class="cd-hero">
        <div class="cd-hero-card">${face(c, true)}${revealBar(c)}</div>
        <div class="cd-hero-side">
          ${alertsHTML(c, status)}
          <div class="cd-actions">${actionsHTML(c, status)}</div>
        </div>
      </div>
      <div class="cd-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${V.tab === k}" class="cd-tab${V.tab === k ? ' on' : ''}" data-cd="tab" data-k="${k}">${esc(l)}${k === 'activity' && n ? `<span class="cd-dot" aria-label="${n} unread">${n > 9 ? '9+' : n}</span>` : ''}</button>`).join('')}</div>
      <div class="cd-tabbody">${V.tab === 'controls' ? controlsHTML(c) : V.tab === 'assets' ? assetsHTML() : V.tab === 'manage' ? manageHTML(c, status) : V.tab === 'help' ? helpHTML() : activityHTML()}</div>`;
  }

  function revealBar(c) {
    const r = V.reveal;
    if (!r || r.id !== c.id || r.until <= Date.now()) return '';
    return `<div class="cd-revealbar" role="status">${ico('visibility')}<span>Showing for <b id="cd-reveal-ttl">${Math.ceil((r.until - Date.now()) / 1000)}</b>s. It hides when you leave this tab.</span>
      <button type="button" class="cd-link" data-cd="copy">Copy number</button><button type="button" class="cd-link" data-cd="hide">Hide</button></div>`;
  }

  function alertsHTML(c, status) {
    const s = st(), out = [];
    const A = (tone, icon, text, btn) => out.push(`<div class="cd-alert ${tone}">${ico(icon)}<span>${text}</span>${btn || ''}</div>`);
    if (V.program.state === 'paused') A('bad', 'pause_circle', esc(V.program.why || 'The card is paused by Trending. Payments are declined until it’s back; nothing you hold is affected.'));
    if (s.owed > 0) A('bad', 'error', `You owe <b>${X().usd(s.owed)}</b> on the card. New payments are paused until it’s paid.`, `<button type="button" class="btn btn-primary btn-sm" data-cd="payowed">Pay it</button>`);
    if (s.sim.outage) A('warn', 'cloud_off', 'Practice: Trending’s card partner is “down”. The card network approves payments up to $50 by itself; they’re taken when the partner is back.', `<button type="button" class="btn btn-ghost btn-sm" data-cd="sim" data-k="outage">End outage</button>`);
    if (s.sim.pricesDown) A('warn', 'trending_flat', 'Practice: the price feed is “down”, so only USDT and USDC can pay.', `<button type="button" class="btn btn-ghost btn-sm" data-cd="sim" data-k="pricesDown">Restore prices</button>`);
    if (status === 'frozen') A('info', 'ac_unit', 'This card is frozen. Every payment is declined until you unfreeze it.');
    if (status === 'inactive') A('info', 'local_shipping', c.ship && X().SHIP.indexOf(c.ship.state) >= 2 ? 'Your card has shipped. Activate it once it’s in your hands.' : `Your card is ${esc((X().SHIP_TEXT[c.ship && c.ship.state] || 'on its way').toLowerCase())}. You can activate it when it arrives.`);
    if (status === 'expired') A('bad', 'event_busy', `This card expired at the end of ${esc(X().expText(c))}. Renew it under Manage.`);
    else if (X().expiringSoon(c, Date.now()) && !c.replacedBy) A('warn', 'event', `This card expires at the end of ${esc(X().expText(c))}. Renew it under Manage — the number stays the same.`);
    if (status === 'lost' || status === 'stolen' || status === 'closed' || status === 'replaced') {
      const next = c.replacedBy && X().findCard(s, c.replacedBy);
      A('info', 'block', `This card can’t be used any more.${next ? ` Its replacement is ${esc(cardLabel(next))}.` : ''}`, next ? `<button type="button" class="btn btn-ghost btn-sm" data-cd="pick" data-id="${esc(next.id)}">Show it</button>` : `<button type="button" class="btn btn-ghost btn-sm" data-cd="replace" data-id="${esc(c.id)}">Replace</button>`);
    }
    return out.join('');
  }

  function actionsHTML(c, status) {
    const B = (cd, icon, label, extra, cls) => `<button type="button" class="cd-act${cls ? ' ' + cls : ''}" data-cd="${cd}" data-id="${esc(c.id)}"${extra || ''}>${ico(icon)}<span>${esc(label)}</span></button>`;
    const out = [];
    if (status === 'active' || status === 'frozen') out.push(B('reveal', 'visibility', 'Details'));
    if (status === 'active') out.push(B('freeze', 'ac_unit', 'Freeze'));
    if (status === 'frozen') out.push(B('unfreeze', 'sunny', 'Unfreeze', '', 'hi'));
    if (status === 'inactive') out.push(B('activate', 'task_alt', 'Activate', '', 'hi'), B('ship-next', 'local_shipping', 'Track'));
    out.push(`<button type="button" class="cd-act" data-cd="pay">${ico('storefront')}<span>Pay (practice)</span></button>`);
    if (X().USABLE.includes(status)) out.push(B('report-ask', 'report', 'Lost or stolen', '', 'danger'));
    return out.join('');
  }

  /* ── Activity ────────────────────────────────────────────────────── */
  const FILTERS = [['all', 'All'], ['pending', 'Pending'], ['refunds', 'Refunds'], ['declined', 'Declined'], ['reports', 'Reports']];
  function filtered() {
    const f = V.filter;
    return st().txs.filter(t =>
      f === 'pending' ? ['pending', 'offline'].includes(t.status)
      : f === 'refunds' ? (t.refunds && t.refunds.length) || t.status === 'reversed'
      : f === 'declined' ? t.status === 'declined'
      : f === 'reports' ? !!t.dispute
      : true);
  }
  function txRow(t) {
    const L = X().statusLabel(t);
    const declined = t.status === 'declined';
    const amt = t.kind === 'repayment' ? X().usd(t.billing)
      : declined || t.amount.currency !== 'USD' ? X().fmtMinor(t.final ? t.final.minor : t.amount.minor, t.amount.currency)
      : X().usd(t.final ? t.final.billing : t.billing);
    const sub = [when(t.t), t.kind === 'repayment' ? '' : (X().CHANNELS[t.channel] || {}).label, t.last4 ? '•••• ' + t.last4 : ''].filter(Boolean).join(' · ');
    const paid = t.funding ? X().netText(t) : declined ? explainShort(t) : t.flags && (t.flags.awaitingPost || t.flags.offline) ? 'Not taken yet' : '';
    return `<button type="button" class="cd-tx" data-cd="tx" data-id="${esc(t.id)}">
      <span class="cd-tx-ic ${L.tone}">${ico(t.kind === 'repayment' ? 'payments' : CAT_ICON[t.merchant.category] || 'storefront')}</span>
      <span class="cd-tx-main"><b>${esc(t.merchant.name)}</b><small>${esc(sub)}</small>${paid ? `<small class="cd-tx-paid">${esc(paid)}</small>` : ''}</span>
      <span class="cd-tx-amt"><b class="${declined || t.status === 'reversed' ? 'cd-struck' : ''}">${esc(amt)}</b><span class="cd-pill ${L.tone}">${esc(L.label)}</span></span>
    </button>`;
  }
  const explainShort = t => X().explainDecline(t).title;

  function activityHTML() {
    const s = st(), list = filtered(), notes = s.notes.slice(0, 4), n = unread();
    return `
      <div class="cd-try">
        <div><b>Try the card</b><p>Pay at a made-up shop to see how a payment is priced, approved or declined — and what the shop can do afterwards.</p></div>
        <button type="button" class="btn btn-primary" data-cd="pay">${ico('storefront')}Pay at a practice shop</button>
      </div>
      ${notes.length ? `<section class="cd-panel cd-notes"><div class="cd-row-h"><h3>Messages${n ? ` <span class="cd-dot">${n}</span>` : ''}</h3>${n ? '<button type="button" class="cd-link" data-cd="notes-read">Mark all read</button>' : ''}</div>
        ${notes.map(m => `<button type="button" class="cd-note-row${m.read ? '' : ' unread'}" ${m.txId ? `data-cd="tx" data-id="${esc(m.txId)}"` : 'data-cd="notes-read"'}>${ico({ payment: 'credit_card', decline: 'block', refund: 'undo', owed: 'error', security: 'shield' }[m.kind] || 'notifications')}<span><b>${esc(m.title)}</b><small>${esc(m.body)}</small><small class="cd-when">${esc(when(m.t))}</small></span></button>`).join('')}
        ${s.notes.length > 4 ? `<button type="button" class="cd-link" data-cd="notes-all">See all ${s.notes.length} messages</button>` : ''}
      </section>` : ''}
      <div class="cd-filters" role="tablist" aria-label="Filter payments">${FILTERS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${V.filter === k}" class="cd-chipbtn sm${V.filter === k ? ' on' : ''}" data-cd="filter" data-k="${k}">${esc(l)}</button>`).join('')}</div>
      <div class="cd-txs">${list.length ? list.slice(0, 60).map(txRow).join('') : `<p class="cd-empty">${ico('receipt_long')}${V.filter === 'all' ? 'No card payments yet.' : 'Nothing here.'}</p>`}</div>`;
  }

  /* ── Controls ────────────────────────────────────────────────────── */
  function controlsHTML(c) {
    const s = st(), now = Date.now(), sp = X().spent(s, now), L = s.limits;
    const usable = X().USABLE.includes(c.status);
    const ctl = Object.entries(X().CONTROLS).filter(([, v]) => !v.physicalOnly || c.kind === 'physical');
    const bar = (used, max) => `<span class="cd-bar"><i style="width:${Math.min(100, Math.round(used / max * 100))}%"></i></span>`;
    const limitRow = (k, used) => `<div class="cd-limit"><div><b>${esc(X().LIMIT_NAMES[k])}</b><small>${used == null ? 'Per payment' : `${X().usd(used)} used · ${X().usd(Math.max(0, L[k] - used))} left`}</small>${used == null ? '' : bar(used, L[k])}</div>
      <span class="cd-limit-v">${X().usd(L[k])}</span><button type="button" class="cd-link" data-cd="limit" data-k="${k}">Change</button></div>`;
    return `
      <section class="cd-panel"><h3>${esc(cardLabel(c))}</h3>
        ${usable ? '' : '<p class="cd-note">This card can’t be used any more, so its controls no longer matter.</p>'}
        ${ctl.map(([k, v]) => `<div class="cd-set"><span>${ico({ online: 'language', international: 'public', contactless: 'contactless', atm: 'local_atm' }[k])}<span><b>${esc(v.label)}</b><small>${esc(v.sub)}</small></span></span>${toggle(c.controls[k], `data-cd="control" data-id="${esc(c.id)}" data-k="${k}" data-on="${c.controls[k] ? '0' : '1'}"${usable ? '' : ' disabled'}`, v.label)}</div>`).join('')}
        ${c.kind === 'virtual' ? '<p class="cd-note">A virtual card only pays online. Tapping, chip and PIN, and cash machines need a physical card.</p>' : ''}
        <p class="cd-note">Turning something off takes effect at once. Turning it back on asks you to confirm it’s you.</p>
      </section>
      <section class="cd-panel"><h3>Kinds of shop</h3><p class="cd-note">Block a kind of shop and this card declines it.</p>
        ${Object.entries(X().CATS).map(([k, v]) => { const blocked = c.blocked.includes(k); return `<div class="cd-set"><span>${ico(v.icon)}<span><b>${esc(v.label)}</b><small>${blocked ? 'Blocked' : 'Allowed'}</small></span></span>${toggle(!blocked, `data-cd="block" data-id="${esc(c.id)}" data-k="${k}" data-on="${blocked ? '0' : '1'}"${usable ? '' : ' disabled'}`, v.label + ' allowed')}</div>`; }).join('')}
        <div class="cd-never"><b>${ico('do_not_disturb_on')}Never allowed on a crypto card</b><p>${Object.values(X().UNSUPPORTED).map(u => esc(u.label)).join(' · ')}. This is the card partner’s rule, not a setting: each would turn the card into a way of cashing out.</p></div>
      </section>
      <section class="cd-panel"><h3>Limits</h3><p class="cd-note">For all your Trending cards together. Lowering a limit is instant; raising one asks you to confirm it’s you.</p>
        ${limitRow('perTx', null)}${limitRow('daily', sp.day)}${limitRow('monthly', sp.month)}${limitRow('atmDaily', sp.atm)}
        <p class="cd-note">Daily limits reset at midnight, monthly ones on the 1st. The card’s own maximums: ${X().LIMIT_KEYS.map(k => `${X().LIMIT_NAMES[k].toLowerCase()} ${X().usd(X().PROGRAM.caps[k])}`).join(', ')}.</p>
      </section>`;
  }

  /* ── Assets ──────────────────────────────────────────────────────── */
  function assetsHTML() {
    const s = st(), A = s.assets, order = X().fundingOrder(s);
    const rows = A.order.map((a, i) => {
      const q = wallet.quote(a), bal = wallet.balance(a), meta = X().ASSETS[a], on = !!A.enabled[a];
      const fee = X().feeBps(a) / 100;
      const pos = order.indexOf(a);
      const priceText = meta.stable ? '$1.00 · counts as dollars' : q.live ? X().fmtPrice(q.usd) + ' · live' : 'No live price — won’t be sold';
      const worth = q.live ? X().usd(Math.floor(bal * q.usd * 100)) : '—';
      return `<div class="cd-asset${on ? '' : ' off'}">
        <span class="cd-asset-ic">${typeof coinIcon === 'function' ? coinIcon(a, 28) : esc(a)}</span>
        <span class="cd-asset-main"><b>${esc(a)} ${A.preferred === a ? '<span class="cd-pill ok">Preferred</span>' : pos > 0 ? `<span class="cd-pill mute">Back-up ${pos}</span>` : ''}</b>
          <small>${esc(priceText)} · fee ${fee ? fee + '%' : 'none'}</small><small>You hold ${esc(X().fmtQty(bal, a))} (${esc(worth)})</small></span>
        <span class="cd-asset-ctl">
          <button type="button" class="cd-mini" data-cd="asset-move" data-k="${a}" data-on="-1" aria-label="Move ${a} up"${i === 0 ? ' disabled' : ''}>${ico('arrow_upward')}</button>
          <button type="button" class="cd-mini" data-cd="asset-move" data-k="${a}" data-on="1" aria-label="Move ${a} down"${i === A.order.length - 1 ? ' disabled' : ''}>${ico('arrow_downward')}</button>
          ${A.preferred === a ? '' : `<button type="button" class="cd-link" data-cd="asset-pref" data-k="${a}">Prefer</button>`}
          ${toggle(on, `data-cd="asset-on" data-k="${a}" data-on="${on ? '0' : '1'}"${A.preferred === a ? ' disabled' : ''}`, `Let the card sell ${a}`)}
        </span></div>`;
    }).join('');
    const ex = X().preview(s, { cardId: (current() || {}).id, merchant: { name: 'Example', mcc: 5999, country: 'US' }, minor: 1000, currency: 'USD', channel: 'online' }, env());
    const exText = ex.pick
      ? `A $10.00 payment right now would sell <b>${esc(X().fmtQty(ex.pick.qty, ex.pick.asset))}</b>${X().ASSETS[ex.pick.asset].stable ? ' — no conversion fee' : ` at ${esc(X().fmtPrice(ex.pick.price))}, including a ${esc(X().usd(ex.pick.fee))} conversion fee`}.`
      : 'A $10.00 payment right now would be declined: none of the coins you turned on can cover it at a live price.';
    const fx = V.fx;
    const fxText = fx && X().fxUsable(fx, Date.now())
      ? `European Central Bank reference rates for ${esc(fx.date)}: 1 USD = ${['EUR', 'GBP', 'JPY', 'INR'].filter(k => fx.rates[k]).map(k => `${fx.rates[k]} ${k}`).join(', ')}. Plus a ${X().PROGRAM.fees.fxBps / 100}% foreign-currency fee.`
      : `Exchange rates aren’t available right now${V.fxErr ? ' (' + esc(V.fxErr) + ')' : ''}, so payments in other currencies are declined until they are. Dollar payments still work.`;
    return `
      <section class="cd-panel"><h3>Coins the card may sell</h3>
        <p class="cd-note">Your preferred coin pays first. ${A.fallback ? 'If it can’t cover a payment, the next coin that’s turned on pays instead.' : 'Back-up is off, so if it can’t cover a payment, the payment is declined.'} One coin pays each payment.</p>
        <div class="cd-assets">${rows}</div>
        <div class="cd-set"><span>${ico('swap_vert')}<span><b>Use back-up coins</b><small>Try the next coin when the preferred one can’t cover a payment</small></span></span>${toggle(A.fallback, `data-cd="fallback" data-on="${A.fallback ? '0' : '1'}"`, 'Use back-up coins')}</div>
      </section>
      <section class="cd-panel"><h3>Right now</h3><p>${exText}</p><p class="cd-note">${fxText}</p></section>
      <section class="cd-panel"><h3>How paying with crypto works</h3>${mechanismHTML()}</section>`;
  }

  /* ── Manage ──────────────────────────────────────────────────────── */
  function manageHTML(c, status) {
    const s = st(), now = Date.now();
    const phys = liveCards().find(x => x.kind === 'physical');
    const usable = X().USABLE.includes(status) || status === 'expired';
    const info = [
      ['Card', cardLabel(c)], ['Status', STATUS_TEXT[status] || status], ['Name on card', c.name], ['Expires', X().expText(c)],
      ['Issued', new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
      ['Card network', 'Set by the card partner'], ['Account currency', 'US dollar']
    ];
    const ship = c.ship ? `<div class="cd-ship">${X().SHIP.map((k, i) => { const reached = X().SHIP.indexOf(c.ship.state) >= i; return `<div class="cd-ship-step${reached ? ' on' : ''}"><i></i><b>${esc(X().SHIP_TEXT[k])}</b><small>${c.ship.at[k] ? esc(when(c.ship.at[k])) : ''}</small></div>`; }).join('')}</div>` : '';
    return `
      <section class="cd-panel"><h3>This card</h3>
        <table class="cd-table"><tbody>${info.map(([a, b]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table>
        ${ship ? `<h4>Delivery</h4>${ship}<p class="cd-note">Practice delivery: nothing is posted and no address was collected. A real card is sent to the address the card partner verified.</p>${c.status === 'inactive' ? `<div class="cd-btnrow"><button type="button" class="btn btn-ghost btn-sm" data-cd="ship-next" data-id="${esc(c.id)}"${c.ship.state === 'delivered' ? ' disabled' : ''}>${ico('fast_forward')}Practice: next delivery step</button><button type="button" class="btn btn-primary btn-sm" data-cd="activate" data-id="${esc(c.id)}">${ico('task_alt')}Activate</button></div>` : ''}` : ''}
      </section>
      ${s.owed > 0 ? `<section class="cd-panel cd-owed"><h3>Money owed</h3><p>The card owes <b>${X().usd(s.owed)}</b> from a payment taken after your balance ran low. Card payments are paused until it’s paid.</p><button type="button" class="btn btn-primary" data-cd="payowed">Pay ${X().usd(s.owed)}</button></section>` : ''}
      <section class="cd-panel"><h3>Card</h3>
        ${phys ? '' : `<button type="button" class="cd-rowbtn" data-cd="order-physical">${ico('contactless')}<span><b>Order a physical card</b><small>For shops, tapping to pay and cash machines</small></span>${ico('chevron_right')}</button>`}
        ${c.kind === 'physical' ? `<div class="cd-rowbtn static">${ico('pin')}<span><b>PIN</b><small>With a card partner you set and change your PIN in the partner’s own secure screen; Trending never sees or stores it. A practice card has no PIN.</small></span></div>` : ''}
        ${usable && !c.replacedBy ? `<button type="button" class="cd-rowbtn" data-cd="replace" data-id="${esc(c.id)}">${ico('autorenew')}<span><b>Replace or renew this card</b><small>Damaged, expiring, or someone else may have the details</small></span>${ico('chevron_right')}</button>` : ''}
        ${X().USABLE.includes(c.status) ? `<button type="button" class="cd-rowbtn danger" data-cd="report-ask" data-id="${esc(c.id)}">${ico('report')}<span><b>Report lost or stolen</b><small>Blocks the card at once, for good</small></span>${ico('chevron_right')}</button>
        <button type="button" class="cd-rowbtn" data-cd="close-card" data-id="${esc(c.id)}">${ico('credit_card_off')}<span><b>Close this card</b><small>Stops it for good. Pending payments can still be collected.</small></span>${ico('chevron_right')}</button>` : ''}
        ${liveCards().some(x => x.kind === 'virtual') ? '' : `<button type="button" class="cd-rowbtn" data-cd="issue-more">${ico('add_card')}<span><b>Get a new virtual card</b><small>Works online straight away</small></span>${ico('chevron_right')}</button>`}
      </section>
      <section class="cd-panel"><h3>Messages about payments</h3>
        ${[['payments', 'Approved payments'], ['declines', 'Declined payments'], ['refunds', 'Refunds and cancelled payments']].map(([k, l]) => `<div class="cd-set"><span><span><b>${esc(l)}</b></span></span>${toggle(s.notify[k], `data-cd="notify" data-k="${k}" data-on="${s.notify[k] ? '0' : '1'}"`, l)}</div>`).join('')}
        <div class="cd-set"><span><span><b>Always tell me about payments over</b><small>Even with approved-payment messages off</small></span></span><button type="button" class="cd-link" data-cd="notify-large">${X().usd(s.notify.large)}</button></div>
        <p class="cd-note">Security messages — the card being frozen, its details being shown, a possible double charge, money owed — are always sent.</p>
      </section>
      <section class="cd-panel"><h3>Terms and fees</h3>${feesHTML()}<button type="button" class="cd-link" data-cd="terms">How paying with crypto works</button></section>
      <section class="cd-panel cd-practice-tools"><h3>Practice situations</h3><p class="cd-note">Make things go wrong on purpose, to see what the card does.</p>
        <div class="cd-set"><span>${ico('cloud_off')}<span><b>Card partner outage</b><small>The network approves up to $50 by itself; nothing is taken until the partner is back</small></span></span>${toggle(s.sim.outage, 'data-cd="sim" data-k="outage"', 'Card partner outage')}</div>
        <div class="cd-set"><span>${ico('trending_flat')}<span><b>Price feed down</b><small>No live prices, so only USDT and USDC can pay</small></span></span>${toggle(s.sim.pricesDown, 'data-cd="sim" data-k="pricesDown"', 'Price feed down')}</div>
        <div class="cd-btnrow"><button type="button" class="btn btn-ghost btn-sm" data-cd="demo-expire" data-id="${esc(c.id)}"${X().USABLE.includes(c.status) && status !== 'expired' ? '' : ' disabled'}>${ico('event_busy')}Make this card expire</button>
        <button type="button" class="btn btn-ghost btn-sm danger" data-cd="reset">${ico('restart_alt')}Delete practice card data</button></div>
      </section>`;
  }

  /* ── Help ────────────────────────────────────────────────────────── */
  function helpHTML() {
    const s = st();
    const lastDecline = s.txs.find(t => t.status === 'declined');
    const FAQ = [
      ['declined', 'Why was my payment declined?', lastDecline
        ? `Your last decline, at ${esc(lastDecline.merchant.name)}: <b>${esc(X().explainDecline(lastDecline).title)}</b>. ${esc(X().explainDecline(lastDecline).why)} ${esc(X().explainDecline(lastDecline).fix)} Nothing was taken.<br><button type="button" class="cd-link" data-cd="tx" data-id="${esc(lastDecline.id)}">Open that payment</button>`
        : 'Open the payment in Activity: every decline says exactly why, and what to do. A declined payment never takes anything from your balance. Shops often show only “declined” — the real reason is here.'],
      ['price', 'How is the price decided?', `The coin is sold at its live price the moment the payment is approved. Payments in other currencies use the European Central Bank’s rate for the day. Fees are separate lines: ${X().PROGRAM.fees.convBps / 100}% to sell a coin that moves in price, none for USDT or USDC, and ${X().PROGRAM.fees.fxBps / 100}% for another currency. Each payment shows all of it.`],
      ['pending', 'Why is a payment still pending?', `The shop approved it but hasn’t collected it yet. Most collect within 1–3 days. The final amount can be lower (hotels, fuel) or, at restaurants and taxis, a little higher for a tip. If a shop never collects, the hold is released after ${X().PROGRAM.holdDays} days and the coin comes back.`],
      ['refund', 'When does a refund arrive?', 'Usually 3–10 days after the shop starts it — the shop decides when. It comes back in the coin you paid with, at its price on the day it arrives, with your share of the fees. Track it on the payment: it shows “Refund on its way” until it lands.'],
      ['twice', 'I was charged twice', 'If both are pending, one often drops off by itself within a few days. If both are collected, open the extra one and choose Report a problem → “I was charged twice”. The card also warns you when the same shop charges the same amount within 2 minutes.'],
      ['unknown', 'A payment I don’t recognise', 'Freeze the card straight away — it takes one tap and you can undo it. Check the shop name and date: some shops use a different name on statements. If it still isn’t you, report the card lost or stolen and report the payment.'],
      ['owed', 'Why do I owe money on my card?', 'A few payments are approved before your balance is checked: an offline terminal on a train or plane, a payment the network approved while the card partner was down, or a tip added later. The shop is still paid, so what your balance couldn’t cover is owed. Pay it under Manage; refunds pay it off first.'],
      ['arrive', 'My physical card hasn’t arrived', 'Cards usually arrive in 5–10 working days. If it’s been longer, report it lost — the card is blocked before anyone can use it — and order a replacement.'],
      ['pin', 'PIN', 'With a card partner, your PIN is set in the partner’s own secure screen and never passes through Trending. No one from Trending will ever ask for it.']
    ];
    const recent = s.txs.slice(0, 20);
    return `
      <section class="cd-panel"><h3>Common questions</h3>
        ${FAQ.map(([k, q, a]) => `<div class="cd-faq${V.faq === k ? ' open' : ''}"><button type="button" data-cd="faq" data-k="${k}" aria-expanded="${V.faq === k}">${esc(q)}${ico(V.faq === k ? 'expand_less' : 'expand_more')}</button>${V.faq === k ? `<div class="cd-faq-a">${a}</div>` : ''}</div>`).join('')}
      </section>
      <section class="cd-panel"><h3>Contact support</h3>
        <p class="cd-note">Never send a card number, security code, PIN or password — support will never ask for them.</p>
        <label class="form-label" for="cd-sup-topic">What’s it about?</label>
        <select id="cd-sup-topic" class="input">${[['payment', 'A payment'], ['declined', 'A declined payment'], ['refund', 'A refund'], ['report', 'A reported payment'], ['card', 'My card (delivery, activation, lost)'], ['other', 'Something else']].map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>
        <label class="form-label" for="cd-sup-tx">Which payment? (optional)</label>
        <select id="cd-sup-tx" class="input"><option value="">None</option>${recent.map(t => `<option value="${esc(t.id)}">${esc(t.id)} · ${esc(t.merchant.name)} · ${esc(when(t.t))}</option>`).join('')}</select>
        <label class="form-label" for="cd-sup-msg">Tell us what happened</label>
        <textarea id="cd-sup-msg" class="input" rows="4" maxlength="1500" placeholder="What happened, and what you expected"></textarea>
        <button type="button" class="btn btn-primary cd-wide" data-cd="support-send"${V.sending ? ' disabled' : ''}>${ico('send')}Send to support</button>
        <div id="cd-sup-out" role="status"></div>
      </section>`;
  }

  /* ══ Sheets ══════════════════════════════════════════════════════ */
  let sheetFrom = null;
  function openSheet(kind, data) {
    V.sheet = { kind, ...(data || {}) };
    if (!$('cd-sheet')) {
      sheetFrom = document.activeElement;
      const el = document.createElement('div');
      el.id = 'cd-sheet';
      el.className = 'mob-scrim cd-scrim';
      el.innerHTML = '<div class="mob-sheet cd-sheet" role="dialog" aria-modal="true" aria-labelledby="cd-sheet-t"><span class="mob-grab" aria-hidden="true"></span><div id="cd-sheet-body"></div></div>';
      el.addEventListener('click', e => { if (e.target === el) closeSheet(); });
      document.body.appendChild(el);
      document.addEventListener('keydown', sheetKey, true);
      requestAnimationFrame(() => el.classList.add('open'));
    }
    paintSheet();
    const f = document.querySelector('#cd-sheet-body button, #cd-sheet-body input');
    if (f && f.focus) try { f.focus({ preventScroll: true }); } catch (e) {}
  }
  function closeSheet() {
    V.sheet = null;
    const el = $('cd-sheet');
    if (el) el.remove();
    document.removeEventListener('keydown', sheetKey, true);
    if (sheetFrom && document.contains(sheetFrom) && sheetFrom.focus) { try { sheetFrom.focus({ preventScroll: true }); } catch (e) {} }
    sheetFrom = null;
  }
  function sheetKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
    if (e.key !== 'Tab') return;
    const f = [...document.querySelectorAll('#cd-sheet button:not([disabled]), #cd-sheet input, #cd-sheet select, #cd-sheet textarea')];
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }
  const head = (title, sub) => `<div class="cd-sh-head"><div><h3 id="cd-sheet-t">${esc(title)}</h3>${sub ? `<small>${esc(sub)}</small>` : ''}</div><button type="button" class="cd-x" data-cd="sheet-close" aria-label="Close">${ico('close')}</button></div>`;

  function paintSheet() {
    const b = $('cd-sheet-body');
    if (!b || !V.sheet) return;
    const k = V.sheet.kind;
    b.innerHTML = k === 'tx' ? txSheet() : k === 'shop' ? shopSheet() : k === 'replace' ? replaceSheet() : k === 'report' ? reportSheet()
      : k === 'reported' ? reportedSheet() : k === 'dispute' ? disputeSheet() : k === 'owed' ? owedSheet() : k === 'physical' ? physicalSheet()
      : k === 'notes' ? notesSheet() : k === 'terms' ? `${head('How paying with crypto works')}${mechanismHTML()}${feesHTML()}` : '';
  }

  /* One payment, all of it: what happened, how much, which coin, what
     conversion, which fees, and where it stands. */
  function txSheet() {
    const s = st(), t = X().findTx(s, V.sheet.id);
    if (!t) return head('Payment') + '<p class="cd-empty">This payment is no longer on this device.</p>';
    const L = X().statusLabel(t), now = Date.now();
    const rows = X().breakdown(t);
    const d = t.status === 'declined' ? X().explainDecline(t) : null;
    const place = [t.merchant.city, X().countryName(t.merchant.country)].filter(Boolean).join(', ');
    const cur = t.amount.currency;
    const openDispute = t.dispute && ['submitted', 'review'].includes(t.dispute.state);
    const demo = [];
    if (t.status === 'pending' && !(t.flags && t.flags.awaitingPost)) {
      const tip = X().TIP_MCC.has(t.merchant.mcc), pre = X().PREAUTH_MCC.has(t.merchant.mcc);
      const sugg = tip ? Math.round(t.amount.minor * 1.15) : pre ? Math.round(t.amount.minor * 0.8) : t.amount.minor;
      const e = X().expOf(cur);
      demo.push(`<div class="cd-demo-in"><label for="cd-final">The shop collects</label><input id="cd-final" class="input" inputmode="decimal" value="${(sugg / 10 ** e).toFixed(e)}"><span>${esc(cur)}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-cd="tx-settle" data-id="${esc(t.id)}">Collect</button></div>
        <small class="cd-note">${tip ? 'A restaurant or taxi may add up to 20% for a tip.' : pre ? 'A hotel usually collects less than it held.' : 'Change it to collect less than was approved.'}</small>`);
      demo.push(`<button type="button" class="btn btn-ghost btn-sm" data-cd="tx-cancel" data-id="${esc(t.id)}">${ico('undo')}The shop cancels it</button>`);
      demo.push(`<button type="button" class="btn btn-ghost btn-sm" data-cd="tx-again" data-id="${esc(t.id)}">${ico('content_copy')}The shop charges again</button>`);
    }
    if (t.networkId && t.status !== 'reversed') demo.push(`<button type="button" class="btn btn-ghost btn-sm" data-cd="tx-resend" data-id="${esc(t.id)}">${ico('sync')}The network resends this message</button>`);
    if (t.status === 'offline') demo.push(`<button type="button" class="btn btn-ghost btn-sm" data-cd="tx-post" data-id="${esc(t.id)}">${ico('upload')}The shop sends it</button>`);
    if (['completed', 'partially_refunded'].includes(t.status) && t.kind !== 'repayment' && !openDispute) {
      const left = (t.final ? t.final.minor : t.amount.minor) - (t.refunds || []).filter(r => r.state !== 'cancelled').reduce((n, r) => n + r.minor, 0);
      const e = X().expOf(cur);
      if (left > 0) demo.push(`<div class="cd-demo-in"><label for="cd-refund">The shop refunds</label><input id="cd-refund" class="input" inputmode="decimal" value="${(left / 10 ** e).toFixed(e)}"><span>${esc(cur)}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-cd="tx-refund" data-id="${esc(t.id)}">Refund</button></div>`);
    }
    (t.refunds || []).filter(r => r.state === 'pending').forEach(r => demo.push(`<button type="button" class="btn btn-ghost btn-sm" data-cd="tx-refund-arrive" data-id="${esc(t.id)}" data-k="${esc(r.id)}">${ico('call_received')}The ${esc(X().fmtMinor(r.minor, cur))} refund arrives</button>`));
    if (openDispute) {
      if (t.dispute.state === 'submitted') demo.push(`<button type="button" class="btn btn-ghost btn-sm" data-cd="dispute-review" data-id="${esc(t.id)}">${ico('forum')}Ask the shop for its side</button>`);
      demo.push(`<button type="button" class="btn btn-ghost btn-sm" data-cd="dispute-won" data-id="${esc(t.id)}">${ico('thumb_up')}Decide for me</button>`, `<button type="button" class="btn btn-ghost btn-sm" data-cd="dispute-lost" data-id="${esc(t.id)}">${ico('thumb_down')}Decide for the shop</button>`);
    }
    const can = t.kind === 'repayment' ? { ok: false } : X().canDispute(t, now);
    return `${head(t.merchant.name, [t.merchant.categoryLabel, place].filter(Boolean).join(' · '))}
      <div class="cd-tx-hero"><b class="${t.status === 'declined' || t.status === 'reversed' ? 'cd-struck' : ''}">${esc(t.kind === 'repayment' ? X().usd(t.billing) : X().fmtMinor(t.final ? t.final.minor : t.amount.minor, cur))}</b><span class="cd-pill ${L.tone}">${esc(L.label)}</span>${d ? '' : `<p>${esc(L.what)}</p>`}</div>
      ${d ? `<div class="cd-decline"><b>${ico('block')}${esc(d.title)}</b><p>${esc(d.why)}</p>${d.fix ? `<p><b>What to do:</b> ${esc(d.fix)}</p>` : ''}<p class="cd-safe">${ico('verified_user')}Nothing was taken from your balance.${t.flags && t.flags.standIn ? ' The card network answered for Trending’s partner, which was down.' : ''}</p>${d.act ? `<button type="button" class="btn btn-primary btn-sm" data-cd="fix" data-k="${esc(d.act)}" data-id="${esc(t.cardId || '')}">${esc({ unfreeze: 'Unfreeze card', controls: 'Open controls', limits: 'Change limits', assets: 'Open assets', replace: 'Replace card', activate: 'Activate card', payowed: 'Pay what’s owed', physical: 'Order a physical card', freeze: 'Freeze card' }[d.act] || 'Fix it')}</button>` : ''}</div>` : ''}
      ${t.flags && t.flags.repeatOf ? `<div class="cd-alert warn">${ico('content_copy')}<span>Same shop, same amount, within ${Math.round(X().PROGRAM.repeatMs / 60000)} minutes of another payment. If you paid once, the extra usually drops off; if it’s collected, report it as “I was charged twice”.</span><button type="button" class="cd-link" data-cd="tx" data-id="${esc(t.flags.repeatOf)}">See the other</button></div>` : ''}
      ${t.flags && t.flags.offline ? `<div class="cd-alert info">${ico('signal_disconnected')}<span>The terminal approved this without going online, so your freeze, controls and balance couldn’t be checked at the time.</span></div>` : ''}
      ${t.flags && t.flags.standIn && t.status !== 'declined' ? `<div class="cd-alert info">${ico('cloud_off')}<span>The card network approved this while Trending’s card partner was down. The network knows whether a card is blocked, frozen or expired, but not your controls, limits or balance.</span></div>` : ''}
      ${t.retries ? `<div class="cd-alert info">${ico('sync')}<span>The network sent this payment ${t.retries + 1} times. Each time got the same answer, and money moved once.</span></div>` : ''}
      <table class="cd-table cd-break"><tbody>${rows.map(r => `<tr><th scope="row">${esc(r.label)}</th><td>${esc(r.value)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</td></tr>`).join('')}</tbody></table>
      <h4>What happened</h4>
      <ol class="cd-timeline">${(t.timeline || []).map(x => `<li><small>${esc(when(x.t))}</small><span>${esc(x.text)}</span></li>`).join('')}</ol>
      <table class="cd-table cd-refs"><tbody>
        <tr><th scope="row">Reference</th><td>${esc(t.id)}</td></tr>
        ${t.networkId ? `<tr><th scope="row">Network reference</th><td>${esc(t.networkId)}</td></tr>` : ''}
        ${t.last4 ? `<tr><th scope="row">Card</th><td>${esc((t.cardKind === 'physical' ? 'Physical' : 'Virtual') + ' •••• ' + t.last4)}</td></tr>` : ''}
        ${t.kind !== 'repayment' ? `<tr><th scope="row">How</th><td>${esc((X().CHANNELS[t.channel] || {}).label || t.channel)}</td></tr><tr><th scope="row">Shop category</th><td>${esc(t.merchant.categoryLabel)} (MCC ${esc(t.merchant.mcc)})</td></tr>` : ''}
        ${t.dispute ? `<tr><th scope="row">Report</th><td>${esc(t.dispute.id)} · ${esc(X().DISPUTE_STATES[t.dispute.state])} · “${esc(X().DISPUTE_REASONS[t.dispute.reason])}”</td></tr>` : ''}
      </tbody></table>
      <div class="cd-btnrow">
        ${can.ok ? `<button type="button" class="btn btn-ghost btn-sm" data-cd="tx-dispute" data-id="${esc(t.id)}">${ico('flag')}Report a problem</button>` : ''}
        ${openDispute ? `<button type="button" class="btn btn-ghost btn-sm" data-cd="dispute-withdraw" data-id="${esc(t.id)}">Withdraw report</button>` : ''}
        <button type="button" class="btn btn-ghost btn-sm" data-cd="tx-support" data-id="${esc(t.id)}">${ico('support_agent')}Contact support</button>
      </div>
      ${demo.length ? `<div class="cd-demo"><b>${ico('science')}Practice: the shop’s and network’s side</b><p class="cd-note">In real life these happen on their own. Here you play the shop, to see what the card does.</p><div class="cd-demo-grid">${demo.join('')}</div></div>` : ''}`;
  }

  function shopSheet() {
    const s = st(), sh = SHOPS.find(x => x.id === V.shop.id);
    const usable = liveCards().filter(c => X().statusOf(c, Date.now()) !== 'inactive');
    if (V.shop.result) {
      const t = V.shop.result.tx, d = t.status === 'declined' ? X().explainDecline(t) : null;
      return `${head(d ? 'Declined' : t.status === 'offline' ? 'Approved offline' : 'Approved', t.merchant.name)}
        <div class="cd-result ${d ? 'bad' : 'ok'}">${ico(d ? 'block' : 'check_circle')}<b>${esc(d ? d.title : X().summary(t))}</b>${d ? `<p>${esc(d.why)}</p>${d.fix ? `<p><b>What to do:</b> ${esc(d.fix)}</p>` : ''}<p class="cd-safe">${ico('verified_user')}Nothing was taken from your balance.</p>` : ''}</div>
        <div class="cd-btnrow"><button type="button" class="btn btn-primary" data-cd="tx" data-id="${esc(t.id)}">See the payment</button><button type="button" class="btn btn-ghost" data-cd="shop-back">Pay somewhere else</button></div>`;
    }
    if (!sh) {
      return `${head('Pay at a practice shop', 'Made-up shops. Your practice balance is spent.')}
        <div class="cd-shops">${SHOPS.map(x => `<button type="button" class="cd-shop" data-cd="shop" data-k="${x.id}">${ico(x.icon)}<span><b>${esc(x.name)}</b><small>${esc(x.city)}${x.country !== 'US' ? ', ' + esc(X().countryName(x.country)) : ''} · ${esc(X().CHANNELS[x.channel].label)}${X().CHANNELS[x.channel].physicalOnly ? ' · physical card' : ''}</small>${x.hint ? `<small class="cd-hint">${esc(x.hint)}</small>` : ''}</span><em>${esc(X().fmtMinor(X().parseMinor(x.amount, x.currency), x.currency))}</em></button>`).join('')}</div>`;
    }
    if (!usable.length) return `${head(sh.name)}<p class="cd-empty">You have no card that can pay right now.</p><button type="button" class="btn btn-ghost" data-cd="shop-back">Back</button>`;
    if (!usable.some(c => c.id === V.shop.cardId)) V.shop.cardId = (usable.find(c => c.kind === 'physical' && X().CHANNELS[sh.channel].physicalOnly) || usable[0]).id;
    const card = X().findCard(s, V.shop.cardId);
    const minor = X().parseMinor(V.shop.amount, sh.currency);
    const req = { cardId: card.id, merchant: sh, minor: minor || 0, currency: sh.currency, channel: sh.channel };
    let quote = '';
    if (!minor) quote = `<p class="cd-note">Enter an amount in ${esc(sh.currency)}.</p>`;
    else {
      const p = X().preview(s, req, env());
      const t = p.tx;
      if (!t.billing) quote = `<div class="cd-alert warn">${ico('info')}<span>${esc(X().explainDecline({ decline: { code: p.code, currency: sh.currency } }).why)}</span></div>`;
      else {
        const lines = [[`${sh.name} charges`, X().fmtMinor(minor, sh.currency)]];
        if (t.fx) lines.push(['Exchange rate', `1 USD = ${t.fx.rate} ${sh.currency} (ECB, ${t.fx.date})`], ['In US dollars', X().usd(t.usdCents)], [`Foreign-currency fee (${X().PROGRAM.fees.fxBps / 100}%)`, X().usd(t.fees.fx)]);
        if (t.fees.atm) lines.push(['Cash machine fee', X().usd(t.fees.atm)]);
        lines.push(['Card charge', X().usd(t.billing)]);
        if (p.pick) {
          const stable = X().ASSETS[p.pick.asset].stable;
          lines.push(['Paid with', X().fmtQty(p.pick.qty, p.pick.asset) + (stable ? '' : ` at ${X().fmtPrice(p.pick.price)}`)]);
          lines.push([`Conversion fee (${p.pick.bps / 100}%)`, X().usd(p.pick.fee)]);
          lines.push(['Total cost', X().usd(p.pick.total)]);
        }
        quote = `<table class="cd-table cd-quote"><tbody>${lines.map(([a, v]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
          ${p.pick ? `<p class="cd-note">${X().ASSETS[p.pick.asset].stable ? `${esc(p.pick.asset)} counts as dollars, so this is exactly what the payment takes.` : 'The coin is sold at its live price the moment the payment is approved, so the final figure can differ by a little from this preview. It is shown exactly on the payment.'}</p>` : `<div class="cd-alert warn">${ico('info')}<span>${esc(X().explainDecline({ decline: { code: p.code, tried: p.tried, need: t.billing } }).why)} You can still try, to see the decline.</span></div>`}`;
      }
    }
    return `${head(sh.name, `${sh.city}${sh.country !== 'US' ? ', ' + X().countryName(sh.country) : ''} · ${X().CHANNELS[sh.channel].label}`)}
      ${usable.length > 1 ? `<div class="cd-switcher">${usable.map(c => `<button type="button" class="cd-chipbtn sm${c.id === card.id ? ' on' : ''}" data-cd="shop-card" data-id="${esc(c.id)}">${esc(cardLabel(c))}</button>`).join('')}</div>` : ''}
      <label class="form-label" for="cd-shop-amt">Amount (${esc(sh.currency)})</label>
      <input id="cd-shop-amt" class="input" inputmode="decimal" autocomplete="off" value="${esc(V.shop.amount)}" data-cdi="shop-amt">
      ${sh.offline && card.kind === 'physical' ? `<label class="cd-agree"><input type="checkbox" data-cd="shop-offline"${V.shop.offline ? ' checked' : ''}> <span>The terminal is offline (it approves by itself, up to ${X().usd(X().PROGRAM.offlineCents)})</span></label>` : ''}
      <div id="cd-quote">${quote}</div>
      <div class="cd-btnrow"><button type="button" class="btn btn-ghost" data-cd="shop-back">Back</button><button type="button" class="btn btn-primary" data-cd="shop-pay"${minor ? '' : ' disabled'}>${ico(sh.channel === 'contactless' ? 'contactless' : sh.channel === 'atm' ? 'local_atm' : 'shopping_cart_checkout')}${sh.channel === 'atm' ? 'Withdraw' : 'Pay'} ${minor ? esc(X().fmtMinor(minor, sh.currency)) : ''}</button></div>`;
  }

  function replaceSheet() {
    const c = X().findCard(st(), V.sheet.id);
    if (!c) return head('Replace card');
    const reasons = Object.entries(X().REPLACE).filter(([, r]) => !r.physicalOnly || c.kind === 'physical');
    const pick = V.sheet.reason && X().REPLACE[V.sheet.reason] ? V.sheet.reason : '';
    const plan = pick ? X().replacePlan(c, pick) : null;
    return `${head('Replace or renew', cardLabel(c))}
      <div class="cd-radios" role="radiogroup" aria-label="Why">${reasons.map(([k, r]) => `<button type="button" role="radio" aria-checked="${pick === k}" class="cd-radio${pick === k ? ' on' : ''}" data-cd="replace-reason" data-k="${k}">${esc(r.label)}</button>`).join('')}</div>
      ${plan ? `<ul class="cd-plan">
        <li>${ico(plan.sameNumber ? 'pin' : 'fiber_new')}${plan.sameNumber ? 'Same card number. The expiry date and security code change.' : 'A new card number. Update it wherever the old one was saved (subscriptions, shops).'}</li>
        <li>${ico('block')}The old card stops ${esc(plan.oldStops)}.</li>
        <li>${ico('check_circle')}The new card works ${esc(plan.newWorks)}.</li>
        <li>${ico('tune')}Your controls, blocked shops and limits carry over.</li>
        <li>${ico('payments')}Fee: ${esc(X().usd(plan.fee))}.</li>
        ${pick === 'lost' || pick === 'stolen' || pick === 'compromised' ? `<li>${ico('flag')}Check recent payments afterwards, and report any that weren’t you.</li>` : ''}
      </ul>
      <button type="button" class="btn btn-primary cd-wide" data-cd="replace-go" data-id="${esc(c.id)}" data-k="${pick}">Replace this card</button><p class="cd-note">You’ll be asked to confirm it’s you.</p>` : '<p class="cd-note">Pick why, to see exactly what happens.</p>'}`;
  }

  function reportSheet() {
    const c = X().findCard(st(), V.sheet.id);
    return `${head('Report lost or stolen', c ? cardLabel(c) : '')}
      <p>The card is blocked at once and can never be used again. Payments already approved may still be collected by the shop.</p>
      <div class="cd-btnrow"><button type="button" class="btn btn-primary mob-danger" data-cd="report" data-id="${esc(c.id)}" data-k="lost">${ico('help')}It’s lost</button><button type="button" class="btn btn-primary mob-danger" data-cd="report" data-id="${esc(c.id)}" data-k="stolen">${ico('report')}It was stolen</button></div>
      <p class="cd-note">Not sure? Freeze it instead — you can undo that.</p><button type="button" class="btn btn-ghost btn-sm" data-cd="freeze" data-id="${esc(c.id)}">${ico('ac_unit')}Freeze instead</button>`;
  }
  function reportedSheet() {
    const c = X().findCard(st(), V.sheet.id);
    const recent = st().txs.filter(t => c && t.cardId === c.id && t.status !== 'declined').slice(0, 5);
    return `${head('Card blocked', c ? cardLabel(c) : '')}
      <div class="cd-result ok">${ico('lock')}<b>The card is blocked for good.</b><p>No new payment can be made with it.${V.sheet.pending ? ` ${V.sheet.pending} payment${V.sheet.pending === 1 ? ' was' : 's were'} already approved and may still be collected.` : ''}</p></div>
      <h4>Were these you?</h4>
      ${recent.length ? `<div class="cd-txs">${recent.map(txRow).join('')}</div><p class="cd-note">Open one that wasn’t you and choose Report a problem once it’s collected.</p>` : '<p class="cd-note">No recent payments on this card.</p>'}
      ${c && !c.replacedBy ? `<button type="button" class="btn btn-primary cd-wide" data-cd="replace-go" data-id="${esc(c.id)}" data-k="${c.status === 'stolen' ? 'stolen' : 'lost'}">Get a replacement card</button>` : ''}`;
  }
  function disputeSheet() {
    const t = X().findTx(st(), V.sheet.id);
    const pick = V.sheet.reason || '';
    return `${head('Report a problem', t ? `${t.merchant.name} · ${X().fmtMinor(t.final ? t.final.minor : t.amount.minor, t.amount.currency)}` : '')}
      <div class="cd-radios" role="radiogroup" aria-label="What went wrong">${Object.entries(X().DISPUTE_REASONS).map(([k, l]) => `<button type="button" role="radio" aria-checked="${pick === k}" class="cd-radio${pick === k ? ' on' : ''}" data-cd="dispute-reason" data-k="${k}">${esc(l)}</button>`).join('')}</div>
      ${pick === 'unrecognised' ? `<div class="cd-alert warn">${ico('shield')}<span>If someone else may have your card, freeze it or report it lost first.</span></div>` : ''}
      ${pick === 'not_received' || pick === 'cancelled' || pick === 'refund' ? `<p class="cd-note">It helps to contact the shop first — most sort it out faster than a report.</p>` : ''}
      <label class="form-label" for="cd-dsp-text">Anything that helps (optional)</label>
      <textarea id="cd-dsp-text" class="input" rows="3" maxlength="1000" placeholder="Dates, order numbers, what the shop said">${esc(V.sheet.text || '')}</textarea>
      <button type="button" class="btn btn-primary cd-wide" data-cd="dispute-go" data-id="${esc(V.sheet.id)}"${pick ? '' : ' disabled'}>Send report</button>
      <p class="cd-note">The shop gets a chance to answer. Most reports are decided within 30–45 days, and you’ll get a message at each step.</p>`;
  }
  function owedSheet() {
    const s = st();
    const p = X().pick(s, s.owed, env());
    return `${head('Pay what the card owes', X().usd(s.owed))}
      ${p.ok ? `<table class="cd-table"><tbody><tr><th scope="row">Owed</th><td>${esc(X().usd(s.owed))}</td></tr><tr><th scope="row">Paid with</th><td>${esc(X().fmtQty(p.pick.qty, p.pick.asset))}${X().ASSETS[p.pick.asset].stable ? '' : ` at ${esc(X().fmtPrice(p.pick.price))}`}</td></tr><tr><th scope="row">Conversion fee</th><td>${esc(X().usd(p.pick.fee))}</td></tr></tbody></table>
        <button type="button" class="btn btn-primary cd-wide" data-cd="payowed-go">Pay ${esc(X().usd(s.owed))}</button>`
      : `<p>${esc(X().explainDecline({ decline: { code: p.code, tried: p.tried, need: s.owed } }).why)}</p><p class="cd-note">Add funds, or turn on another coin in Assets, then come back.</p>`}`;
  }
  function physicalSheet() {
    return `${head('Order a physical card')}
      <ul class="cd-plan">
        <li>${ico('contactless')}Tap to pay, chip and PIN, and cash machines — each with its own switch in Controls.</li>
        <li>${ico('local_shipping')}Practice delivery: nothing is posted and no address is asked for. You move it along yourself, then activate it with the last 4 digits printed on it.</li>
        <li>${ico('pin')}A real card’s PIN is set in the card partner’s own secure screen; Trending never sees it.</li>
        <li>${ico('payments')}Fee: $0.00.</li>
      </ul>
      <button type="button" class="btn btn-primary cd-wide" data-cd="order-physical-go">Order it</button><p class="cd-note">You’ll be asked to confirm it’s you.</p>`;
  }
  function notesSheet() {
    const s = st();
    return `${head('Card messages', `${s.notes.length} kept on this device`)}
      ${s.notes.map(m => `<button type="button" class="cd-note-row" ${m.txId ? `data-cd="tx" data-id="${esc(m.txId)}"` : ''}>${ico('notifications')}<span><b>${esc(m.title)}</b><small>${esc(m.body)}</small><small class="cd-when">${esc(when(m.t))}</small></span></button>`).join('')}`;
  }

  /* ══ Doing things ════════════════════════════════════════════════ */
  function after(msg) { save(); paint(); if (V.sheet) paintSheet(); toast(msg); refreshBadge(); }

  function hideReveal(quiet) {
    clearTimeout(V.revealTimer); clearInterval(V.tickTimer);
    const had = !!V.reveal;
    V.reveal = null;                                     // the details go with it
    if (had && !quiet) paint();
  }

  async function setLimitFrom(k, text) {
    const s = st();
    const cents = X().parseMinor(String(text || '').replace(/^\$/, '').trim(), 'USD');
    if (!cents) { toast('Enter an amount in dollars, like 250 or 250.00.'); return false; }
    const chk = X().checkLimit(s, k, cents);
    if (!chk.ok) { toast(chk.msg); return false; }
    if (chk.raises && !(await stepUp(`Raising your ${X().LIMIT_NAMES[k].toLowerCase()} limit`))) return false;
    X().setLimit(s, k, cents);
    note({ kind: 'security', title: 'Card limit changed', body: `${X().LIMIT_NAMES[k]} limit is now ${X().usd(cents)}.` });
    after(`${X().LIMIT_NAMES[k]} limit set to ${X().usd(cents)}`);
    return true;
  }

  function practicePay(o) {
    const s = st(), sh = SHOPS.find(x => x.id === o.shop);
    if (!sh) return { ok: false, msg: 'Pick a shop.' };
    const minor = X().parseMinor(o.amount, sh.currency);
    if (!minor) return { ok: false, msg: `Enter an amount in ${sh.currency}.` };
    const req = { networkId: 'NET-' + Date.now().toString(36).toUpperCase() + Math.floor(rnd() * 1e6).toString(36).toUpperCase(),
      cardId: o.cardId, merchant: sh, minor, currency: sh.currency, channel: sh.channel };
    const e = env();
    const r = o.offline ? X().offlineSale(s, req, e) : X().authorize(s, req, e);
    save();
    refreshBadge();
    return r;
  }

  function rebuild(t) {
    return { cardId: t.cardId, merchant: { name: t.merchant.name, mcc: t.merchant.mcc, city: t.merchant.city, country: t.merchant.country }, minor: t.amount.minor, currency: t.amount.currency, channel: t.channel };
  }
  const minorFrom = (id, cur) => { const el = $(id); return el ? X().parseMinor(el.value, cur) : null; };

  async function act(name, d) {
    const s = st(), e = () => env();
    const id = d && d.id, k = d && d.k;
    const card = id ? X().findCard(s, id) : current();
    switch (name) {
      case 'tab': V.tab = k; paint(); return;
      case 'pick': V.cardId = id; hideReveal(true); closeSheet(); paint(); return;
      case 'filter': V.filter = k; paint(); return;
      case 'faq': V.faq = V.faq === k ? '' : k; paint(); return;
      case 'agree': V.agreed = !V.agreed; paint(); return;

      case 'issue': case 'issue-more': {
        if (V.program.state === 'unavailable' || V.program.state === 'paused') { toast('The card isn’t available right now.'); return; }
        if (name === 'issue' && !V.agreed && !s.cards.length) { toast('Tick the box first, to confirm you understand it’s a practice card.'); return; }
        if (!(await stepUp('Getting a practice card'))) return;
        const r = X().issue(s, { kind: 'virtual', name: holderName(), now: Date.now(), rand: rnd });
        if (!r.ok) { toast(r.msg); return; }
        s.agreed = s.agreed || Date.now();
        V.cardId = r.card.id; V.tab = 'activity';
        { const p = $('pane-card'); if (p) p.scrollTop = 0; }
        note({ kind: 'security', title: 'Practice virtual card ready', body: `${cardLabel(r.card)} works online now. Choose which coins it may sell under Assets.` });
        after('Your practice virtual card is ready');
        return;
      }
      case 'freeze': {
        const r = X().freeze(s, card && card.id, Date.now());
        if (!r.ok) { toast(r.msg); return; }
        hideReveal(true); closeSheet();
        note({ kind: 'security', title: 'Card frozen', body: `${cardLabel(card)} declines every payment until you unfreeze it.` });
        after('Card frozen. Payments are declined until you unfreeze it.');
        return;
      }
      case 'unfreeze': {
        if (!(await stepUp('Unfreezing your card'))) return;
        const r = X().unfreeze(s, card && card.id, Date.now());
        if (!r.ok) { toast(r.msg); return; }
        note({ kind: 'security', title: 'Card unfrozen', body: `${cardLabel(card)} can pay again.` });
        after('Card unfrozen');
        return;
      }
      case 'reveal': {
        if (!card || !['active', 'frozen'].includes(X().statusOf(card, Date.now()))) { toast('This card’s details can’t be shown.'); return; }
        // Every time, not within a few minutes of the last check.
        if (!(await stepUp('Showing your card details', true))) return;
        hideReveal(true);
        V.reveal = { id: card.id, until: Date.now() + X().PROGRAM.revealMs, details: X().practiceDetails(card) };
        V.revealTimer = setTimeout(() => hideReveal(), X().PROGRAM.revealMs);
        V.tickTimer = setInterval(() => { const el = $('cd-reveal-ttl'); if (el && V.reveal) el.textContent = String(Math.max(0, Math.ceil((V.reveal.until - Date.now()) / 1000))); }, 1000);
        note({ kind: 'security', title: 'Card details shown', body: `The details of ${cardLabel(card)} were shown on this device. If that wasn’t you, freeze the card.` });
        save(); paint(); refreshBadge();
        return;
      }
      case 'hide': hideReveal(); return;
      case 'copy': {
        if (!V.reveal) return;
        const num = V.reveal.details.number.replace(/\s/g, '');
        try { await navigator.clipboard.writeText(num); toast('Copied. It’s a practice number: it works nowhere.'); } catch (err) { toast('Copying isn’t allowed here.'); }
        return;
      }
      case 'control': {
        const on = d.on === '1';
        const label = (X().CONTROLS[k] || {}).label || k;
        if (X().loosensControl(card, k, on) && !(await stepUp(`Turning on ${label.toLowerCase()}`))) return;
        const r = X().setControl(s, card.id, k, on);
        if (!r.ok) { toast(r.msg); return; }
        note({ kind: 'security', title: 'Card controls changed', body: `${label}: ${on ? 'on' : 'off'} for ${cardLabel(card)}.` });
        after(`${label} ${on ? 'on' : 'off'}`);
        return;
      }
      case 'block': {
        const allow = d.on === '1';
        const label = (X().CATS[k] || {}).label || k;
        if (X().loosensBlock(card, k, !allow) && !(await stepUp(`Allowing ${label.toLowerCase()}`))) return;
        X().setBlocked(s, card.id, k, !allow);
        note({ kind: 'security', title: 'Card controls changed', body: `${label}: ${allow ? 'allowed' : 'blocked'} on ${cardLabel(card)}.` });
        after(`${label} ${allow ? 'allowed' : 'blocked'}`);
        return;
      }
      case 'limit': {
        const v = await askText(`New ${X().LIMIT_NAMES[k].toLowerCase()} limit, in dollars. The card allows up to ${X().usd(X().PROGRAM.caps[k])}.`, (s.limits[k] / 100).toFixed(2), { title: `${X().LIMIT_NAMES[k]} limit`, ok: 'Set limit' });
        if (v == null || v === false) return;
        await setLimitFrom(k, v);
        return;
      }
      case 'asset-pref': X().setPreferred(s, k); after(`${k} is now your preferred coin`); return;
      case 'asset-on': {
        const on = d.on === '1';
        if (on && !X().ASSETS[k].stable && !(await ask(`The card may sell ${k} when you pay, at its live price, with a ${X().PROGRAM.fees.convBps / 100}% conversion fee. Selling may have tax consequences where you live.`, { title: `Let the card sell ${k}?`, ok: `Turn on ${k}` }))) return;
        const r = X().setEnabled(s, k, on);
        if (!r.ok) { toast(r.msg); return; }
        after(`${k} ${on ? 'can' : 'can’t'} pay now`);
        return;
      }
      case 'asset-move': X().moveAsset(s, k, Number(d.on)); after(''); return;
      case 'fallback': s.assets.fallback = d.on === '1'; after(`Back-up coins ${s.assets.fallback ? 'on' : 'off'}`); return;
      case 'notify': s.notify[k] = d.on === '1'; after(''); return;
      case 'notify-large': {
        const v = await askText('Always send a message about payments over this many dollars:', (s.notify.large / 100).toFixed(2), { title: 'Large payments', ok: 'Save' });
        const c = v == null ? null : X().parseMinor(String(v).replace(/^\$/, ''), 'USD');
        if (v != null && !c) { toast('Enter an amount in dollars.'); return; }
        if (c) { s.notify.large = c; after(`Messages for payments over ${X().usd(c)}`); }
        return;
      }
      case 'notes-read': s.notes.forEach(n => { n.read = true; }); after(''); return;
      case 'notes-all': s.notes.forEach(n => { n.read = true; }); save(); openSheet('notes'); paint(); return;

      case 'pay': V.shop = { id: null, cardId: V.cardId, amount: '', offline: false, result: null }; openSheet('shop'); return;
      case 'shop': { const sh = SHOPS.find(x => x.id === k); V.shop.id = k; V.shop.amount = sh ? sh.amount : ''; V.shop.result = null; V.shop.offline = false; paintSheet(); return; }
      case 'shop-back': V.shop.id = null; V.shop.result = null; paintSheet(); return;
      case 'shop-card': V.shop.cardId = id; paintSheet(); return;
      case 'shop-offline': V.shop.offline = !V.shop.offline; paintSheet(); return;
      case 'shop-pay': {
        const el = $('cd-shop-amt');
        if (el) V.shop.amount = el.value;
        const r = practicePay({ shop: V.shop.id, cardId: V.shop.cardId, amount: V.shop.amount, offline: V.shop.offline });
        if (!r.ok && !r.tx) { toast(r.msg); return; }
        V.shop.result = r;
        paint(); paintSheet();
        return;
      }

      case 'tx': {
        openSheet('tx', { id });
        if (s.notes.some(m => m.txId === id && !m.read)) { s.notes.forEach(m => { if (m.txId === id) m.read = true; }); save(); paint(); refreshBadge(); }
        return;
      }
      case 'tx-settle': { const t = X().findTx(s, id); const r = X().settle(s, id, minorFrom('cd-final', t.amount.currency), e()); if (!r.ok) { toast(r.msg); return; } after('The shop collected the payment'); return; }
      case 'tx-cancel': { const r = X().reverse(s, id, e(), 'merchant'); if (!r.ok) { toast(r.msg); return; } after('Cancelled — the coin came back'); return; }
      case 'tx-again': {
        const t = X().findTx(s, id);
        const r = X().authorize(s, { ...rebuild(t), networkId: 'NET-' + Date.now().toString(36).toUpperCase() + Math.floor(rnd() * 1e6).toString(36).toUpperCase() }, e());
        save(); openSheet('tx', { id: r.tx.id }); paint(); refreshBadge(); toast(r.tx.flags && r.tx.flags.repeatOf ? 'Charged again — flagged as a possible double charge' : 'Charged again');
        return;
      }
      case 'tx-resend': { const t = X().findTx(s, id); const r = X().authorize(s, { ...rebuild(t), networkId: t.networkId }, e()); after(r.duplicate ? 'Same message again: same answer, nothing more taken' : ''); return; }
      case 'tx-post': { const r = X().postOffline(s, id, e()); if (!r.ok) { toast(r.msg); return; } after(s.owed ? 'Posted — your balance didn’t cover it, so it’s owed' : 'Posted and taken'); return; }
      case 'tx-refund': { const t = X().findTx(s, id); const r = X().refundStart(s, id, minorFrom('cd-refund', t.amount.currency), e()); if (!r.ok) { toast(r.msg); return; } after('Refund started — it arrives in 3–10 days'); return; }
      case 'tx-refund-arrive': { const r = X().refundArrive(s, id, k, e()); if (!r.ok) { toast(r.msg); return; } after('Refund arrived'); return; }
      case 'tx-dispute': openSheet('dispute', { id }); return;
      case 'dispute-reason': V.sheet.reason = k; { const el = $('cd-dsp-text'); if (el) V.sheet.text = el.value; } paintSheet(); return;
      case 'dispute-go': {
        const el = $('cd-dsp-text');
        const text = el ? el.value : '';
        if (/\b(?:\d[ -]?){13,19}\b/.test(text)) { toast('Please don’t include a card number. Support never needs it.'); return; }
        const r = X().openDispute(s, id, V.sheet.reason, text, e());
        if (!r.ok) { toast(r.msg); return; }
        save(); openSheet('tx', { id }); paint(); refreshBadge(); toast('Report sent');
        return;
      }
      case 'dispute-withdraw': { const r = X().withdrawDispute(s, id, e()); if (!r.ok) { toast(r.msg); return; } after('Report withdrawn'); return; }
      case 'dispute-review': X().decideDispute(s, id, 'review', e()); after(''); return;
      case 'dispute-won': X().decideDispute(s, id, 'won', e()); after('Decided for you — the money came back'); return;
      case 'dispute-lost': X().decideDispute(s, id, 'lost', e()); after('Decided for the shop'); return;
      case 'tx-support': closeSheet(); V.tab = 'help'; V.sheet = null; paint(); { const sel = $('cd-sup-tx'); if (sel) sel.value = id; const m = $('cd-sup-msg'); if (m && m.focus) m.focus(); } return;

      case 'sim': {
        s.sim[k] = !s.sim[k];
        let msg = k === 'outage' ? (s.sim.outage ? 'Practice: card partner outage started' : 'Card partner is back') : (s.sim.pricesDown ? 'Practice: price feed down' : 'Prices are back');
        if (k === 'outage' && !s.sim.outage) {
          const posted = X().postStandIn(s, e());
          if (posted.length) msg += ` — ${posted.length} payment${posted.length === 1 ? '' : 's'} approved during the outage ${posted.length === 1 ? 'was' : 'were'} taken`;
        }
        after(msg);
        return;
      }
      case 'order-physical': openSheet('physical'); return;
      case 'order-physical-go': {
        if (!(await stepUp('Ordering a physical card'))) return;
        const r = X().issue(s, { kind: 'physical', name: holderName(), now: Date.now(), rand: rnd });
        if (!r.ok) { toast(r.msg); return; }
        closeSheet(); V.cardId = r.card.id; V.tab = 'manage';
        note({ kind: 'security', title: 'Physical card ordered', body: `${cardLabel(r.card)} is on its way (practice delivery). Activate it when it arrives.` });
        after('Physical card ordered');
        return;
      }
      case 'ship-next': {
        const r = X().advanceShip(s, card.id, Date.now());
        if (!r.ok) { toast(r.msg); return; }
        if (r.state === 'delivered') note({ kind: 'security', title: 'Your card has arrived', body: `Activate ${cardLabel(card)} with the last 4 digits printed on it.` });
        after(`Delivery: ${X().SHIP_TEXT[r.state]}`);
        return;
      }
      case 'activate': {
        const v = await askText(`Type the last 4 digits printed on your card. (Practice: they are ${card.last4}.)`, '', { title: 'Activate your card', ok: 'Activate' });
        if (v == null || v === false || v === '') return;
        if (!(await stepUp('Activating your card'))) return;
        const r = X().activate(s, card.id, v, Date.now());
        if (!r.ok) { save(); toast(r.msg); paint(); return; }
        note({ kind: 'security', title: 'Card activated', body: `${cardLabel(card)} is ready for shops${card.controls.contactless ? ', tapping' : ''} and chip and PIN.` });
        after('Card activated');
        return;
      }
      case 'replace': openSheet('replace', { id: card.id }); return;
      case 'replace-reason': V.sheet.reason = k; paintSheet(); return;
      case 'replace-go': {
        if (!(await stepUp('Replacing your card'))) return;
        const r = X().replace(s, id, k, Date.now(), rnd);
        if (!r.ok) { toast(r.msg); return; }
        closeSheet(); V.cardId = r.card.id; hideReveal(true);
        note({ kind: 'security', title: 'Card replaced', body: `${cardLabel(r.card)} replaces •••• ${card.last4}. ${r.plan.sameNumber ? 'Same number.' : 'New number: update it wherever the old one was saved.'}` });
        after(r.card.kind === 'virtual' ? 'Your new card works now' : 'Your new card is on its way');
        return;
      }
      case 'report-ask': openSheet('report', { id: card.id }); return;
      case 'report': {
        if (!(await ask(`Block ${cardLabel(card)} for good? This can’t be undone.`, { title: k === 'stolen' ? 'Report stolen' : 'Report lost', ok: 'Block the card', danger: true }))) return;
        const r = X().report(s, card.id, k, Date.now());
        if (!r.ok) { toast(r.msg); return; }
        hideReveal(true);
        note({ kind: 'security', title: `Card reported ${k}`, body: `${cardLabel(card)} is blocked for good. Order a replacement under Manage.` });
        save(); paint(); refreshBadge();
        openSheet('reported', { id: card.id, pending: r.pending });
        toast('Card blocked');
        return;
      }
      case 'close-card': {
        if (!(await ask(`Close ${cardLabel(card)} for good? Pending payments can still be collected, and refunds still arrive.`, { title: 'Close card', ok: 'Close card', danger: true }))) return;
        if (!(await stepUp('Closing your card'))) return;
        const r = X().close(s, card.id, Date.now());
        if (!r.ok) { toast(r.msg); return; }
        hideReveal(true);
        note({ kind: 'security', title: 'Card closed', body: `${cardLabel(card)} is closed.` });
        after('Card closed');
        return;
      }
      case 'payowed': openSheet('owed'); return;
      case 'payowed-go': {
        const r = X().payOwed(s, e());
        if (!r.ok) { toast(r.msg); return; }
        closeSheet();
        after('Paid. Card payments work again.');
        return;
      }
      case 'demo-expire': {
        if (!(await ask('Set this practice card’s expiry to last month, to see what happens to an expired card?', { title: 'Make it expire', ok: 'Expire it' }))) return;
        const d0 = new Date(); d0.setDate(1); d0.setMonth(d0.getMonth() - 1);
        card.expMonth = d0.getMonth() + 1; card.expYear = d0.getFullYear();
        after('The card has expired');
        return;
      }
      case 'reset': {
        if (!(await ask('Delete every practice card, payment and message on this device? Your practice balance isn’t touched.', { title: 'Delete practice card data', ok: 'Delete', danger: true }))) return;
        try { localStorage.removeItem(STATE_KEY); } catch (err) {}
        STATE = null; V.cardId = null; V.tab = 'activity'; V.agreed = false; hideReveal(true); closeSheet();
        st(); paint(); refreshBadge(); toast('Practice card data deleted');
        return;
      }
      case 'terms': openSheet('terms'); return;
      case 'sheet-close': closeSheet(); return;
      case 'fix': {
        closeSheet();
        if (k === 'unfreeze' || k === 'freeze' || k === 'activate') { if (id) V.cardId = id; return act(k, { id: id || (current() || {}).id }); }
        if (k === 'payowed') return act('payowed', {});
        if (k === 'replace') return act('replace', { id: id || (current() || {}).id });
        V.tab = k === 'assets' ? 'assets' : k === 'physical' ? 'manage' : 'controls';
        paint();
        return;
      }
      case 'support-send': return sendSupport();
      default: return;
    }
  }

  /* Support goes to the server's ticket desk with the payment's
     reference only - never a card number. If the desk isn't connected
     (no database in this build), the page says so plainly and keeps
     what you wrote. */
  async function sendSupport() {
    const topic = ($('cd-sup-topic') || {}).value || 'other';
    const txRef = ($('cd-sup-tx') || {}).value || '';
    const msg = String(($('cd-sup-msg') || {}).value || '').trim();
    const out = $('cd-sup-out');
    const say = (html, tone) => { if (out) out.innerHTML = `<div class="cd-alert ${tone || 'info'}">${html}</div>`; };
    if (msg.length < 10) { say('Tell us a little more — at least a sentence.', 'warn'); return; }
    if (/\b(?:\d[ -]?){13,19}\b/.test(msg)) { say('Please remove the card number. Support never needs it, and nobody from Trending will ask for it.', 'bad'); return; }
    V.sending = true;
    try {
      const who = typeof authHeaders === 'function' ? await authHeaders() : {};
      if (!who.Authorization) { say('Sign in to contact support, so we can reply to you.', 'warn'); return; }
      const key = 'card-' + Date.now().toString(36) + Math.floor(rnd() * 1e9).toString(36);
      const r = await fetch('/api/support/tickets', {
        method: 'POST', credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': key, ...who },
        body: JSON.stringify({ category: 'card', txRef: txRef || undefined, message: `[${topic}] ${msg}` })
      });
      let j = {};
      try { j = await r.json(); } catch (err) {}
      if (r.ok && j.ticket) { say(`Sent. Your reference is <b>${esc(j.ticket.ref)}</b>. We’ll reply in the app.`, 'ok'); const m = $('cd-sup-msg'); if (m) m.value = ''; return; }
      if (r.status === 503) { say('Support messages aren’t connected in this build yet, so this wasn’t sent. Nothing about your card changed. Keep the payment’s reference to hand.', 'warn'); return; }
      say(esc(j.message || 'That couldn’t be sent. Try again in a minute.'), 'bad');
    } catch (err) {
      say('You seem to be offline. Nothing was sent.', 'warn');
    } finally { V.sending = false; }
  }

  function refreshBadge() {
    const n = STATE ? STATE.notes.filter(m => !m.read).length : 0;
    document.querySelectorAll('.pg-act[data-pg="card"]').forEach(b => { b.classList.toggle('has-dot', n > 0); });
  }

  /* ── Wiring ──────────────────────────────────────────────────────── */
  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener('click', ev => {
      const el = ev.target && ev.target.closest ? ev.target.closest('[data-cd]') : null;
      if (!el || !(el.closest('#pane-card') || el.closest('#cd-sheet'))) return;
      if (el.disabled) return;
      if (el.tagName !== 'INPUT') ev.preventDefault();
      act(el.dataset.cd, el.dataset);
    });
    document.addEventListener('input', ev => {
      const el = ev.target;
      if (!el || !el.dataset || el.dataset.cdi !== 'shop-amt') return;
      V.shop.amount = el.value;
      // Repaint the quote only, so the caret stays where it is.
      const q = $('cd-quote');
      if (q && V.sheet && V.sheet.kind === 'shop') {
        const pos = el.selectionStart;
        paintSheet();
        const again = $('cd-shop-amt');
        if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
      }
    });
    // Card details never outlive the tab being on screen.
    document.addEventListener('visibilitychange', () => { if (document.hidden && V.reveal) hideReveal(); });
    window.addEventListener && window.addEventListener('pagehide', () => hideReveal(true));
  }
  wire();

  return {
    paint, act, practicePay, setLimitFrom, openSheet, closeSheet, hideReveal, refreshBadge, SHOPS,
    get state() { return st(); }
  };
})();

window.TCD = TCD;

function getCardTemplate() {
  return `<section id="pane-card" class="pane">
    <h1 class="pane-title cd-title">
      <span class="material-symbols-rounded" aria-hidden="true">credit_card</span>
      <span>Trending Card</span>
    </h1>
    <div class="tr-banner">
      <span class="material-symbols-rounded ms-16" aria-hidden="true">info</span>
      <span>Practice card. Trending has no card-issuing partner yet, so there is no real card, card number or money here: the card spends your practice balance at made-up shops. The rules — conversions, fees, limits, declines, refunds and reports — work the way a real card’s would.</span>
    </div>
    <div id="card-root"></div>
  </section>`;
}

/* Leaving the page hides any card details on screen. */
function renderCard() { TCD.paint(); }

/* ── Global bridge ───────────────────────────────────────────────────
   See globals.js. The card's rules load first: this page asks CDX for
   every decision. */
import '../features/cardcore.js?v=c3';
import { publish } from '../globals.js?v=3';
publish('pages/card.js', {
  TCD: () => TCD, getCardTemplate: () => getCardTemplate, renderCard: () => renderCard
});
