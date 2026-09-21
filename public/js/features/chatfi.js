/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CHAT FI — crypto services inside the message section            ║
   ║                                                                  ║
   ║   1. Send        — move coin from your account into a thread     ║
   ║   2. Request     — ask a contact for coin, they settle back      ║
   ║   3. Gift packet — fund a packet, members claim a random share   ║
   ║   4. Split bill  — split a total, members pay their share        ║
   ║   5. Price card  — drop a live quote into the conversation       ║
   ║   6. Alert       — arm a CT price alert without leaving chat     ║
   ║   7. /commands   — the same six from the composer                ║
   ║   8. Crypto Desk — a bot thread answering off the live feed      ║
   ║                                                                  ║
   ║  Everything settles through MNY, so chat never keeps its own     ║
   ║  idea of your balance. It used to debit the Spot account while   ║
   ║  a request paid into Funding — the same button row spending      ║
   ║  from one pocket and paying into another. Now a send draws on    ║
   ║  Funding, tops up from Spot when it has to, and says so.         ║
   ║                                                                  ║
   ║  Inbound settlements (a request paid, a split share) are capped  ║
   ║  per day — otherwise the Request button would be a mint and      ║
   ║  Portfolio equity would stop meaning anything.                   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CFI = (() => {

  const KEY = 'ts_chatfi';
  const INBOUND_DAY_CAP = 5000;        // USD of counterparty settlements per day
  const SETTLE_MS = 2600;              // how long a simulated peer takes to respond

  const BOT_ID = 8;                    // Crypto Desk conversation

  const DEFAULT = { msgs: {}, inbound: { day: '', used: 0 } };

  let D = load();
  let sheet = null;                    // { kind, coin, ... } while the panel is open

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const ic = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');
  const hasTR = () => typeof TR !== 'undefined';
  const hasMNY = () => typeof MNY !== 'undefined';

  /* One price for the whole app. This used to read liveCryptoPrices
     directly, which returned 0 for TREND and NEON — so the app's own
     tokens sat in the wallet and could not be sent in a chat. */
  function priceOf(sym) {
    if (hasMNY()) return MNY.price(sym);
    if (sym === 'USDT') return 1;
    const c = (window.liveCryptoPrices || {})[sym];
    return c ? c.usd : 0;
  }

  /* What a send can draw on: Funding plus Spot, because that is what
     MNY.spend actually reaches. Showing only the Spot balance made a
     tip you had just received look like money you did not have. */
  const isLivePrice = sym => (hasMNY() ? MNY.isLive(sym) : !!priceOf(sym));

  function haveOf(sym) {
    if (hasMNY()) return MNY.spendable(sym);
    return hasTR() ? TR.availableOf(sym) : 0;
  }

  function usd(v) {
    if (!v && v !== 0) return '$0.00';
    const a = Math.abs(v);
    if (a > 0 && a < 0.01) return '$' + a.toFixed(6);
    return '$' + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function qty(v) {
    if (!v) return '0';
    if (v < 0.0001) return v.toExponential(2);
    return v.toLocaleString('en-US', { maximumFractionDigits: 8 });
  }

  /* Coins you can actually move, held first. The same list Pay offers —
     they used to differ, so a coin you could request in chat was one Pay
     refused, and the app's own tokens were in neither. */
  function coinList() {
    if (hasMNY()) return MNY.assets();
    const live = Object.keys(window.liveCryptoPrices || {}).filter(s => s !== 'USDT');
    const all = ['USDT', ...live.sort()];
    if (!hasTR()) return all;
    return all.sort((a, b) => (TR.availableOf(b) > 0 ? 1 : 0) - (TR.availableOf(a) > 0 ? 1 : 0));
  }

  const today = () => new Date().toISOString().slice(0, 10);

  /* ── Inbound cap ─────────────────────────────────────────────────── */
  /* Counterparties here are simulated, so money they send you is money
     the app invents. Capping it keeps paper equity honest. */
  function inboundLeft() {
    if (D.inbound.day !== today()) { D.inbound = { day: today(), used: 0 }; save(); }
    return Math.max(0, INBOUND_DAY_CAP - D.inbound.used);
  }

  function takeInbound(value) {
    const left = inboundLeft();
    if (value > left) return false;
    D.inbound.used += value;
    save();
    return true;
  }

  /* ── Message store ───────────────────────────────────────────────── */
  function push(chatId, fi) {
    fi.id = fi.id || 'fi' + Date.now() + Math.random().toString(36).slice(2, 6);
    fi.ts = fi.ts || Date.now();
    D.msgs[chatId] = D.msgs[chatId] || [];
    D.msgs[chatId].push(fi);
    save();

    if (typeof DATA !== 'undefined') {
      DATA.chatHistory = DATA.chatHistory || {};
      DATA.chatHistory[chatId] = DATA.chatHistory[chatId] || [];
      DATA.chatHistory[chatId].push({ me: !!fi.me, fi, text: previewOf(fi), time: timeOf(fi.ts) });
    }

    const convo = (typeof DATA !== 'undefined' && DATA.conversations || [])
      .find(c => String(c.id) === String(chatId));
    if (convo) { convo.preview = previewOf(fi); convo.time = 'now'; }

    repaintThread();
    return fi;
  }

  function findFi(id) {
    for (const chatId of Object.keys(D.msgs)) {
      const m = D.msgs[chatId].find(x => x.id === id);
      if (m) return { chatId, fi: m };
    }
    return null;
  }

  const timeOf = ts => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  function previewOf(fi) {
    switch (fi.kind) {
      case 'send':    return `${fi.me ? 'Sent' : 'Received'} ${qty(fi.qty)} ${fi.coin}`;
      case 'request': return `Requested ${qty(fi.qty)} ${fi.coin}`;
      case 'gift':    return `🧧 Gift packet — ${qty(fi.qty)} ${fi.coin}`;
      case 'split':   return `Split bill — ${usd(fi.total)}`;
      case 'price':   return `${fi.coin} price`;
      case 'alert':   return `Alert set on ${fi.coin}`;
      default:        return (window.PAY && window.PAY.previewOf) ? window.PAY.previewOf(fi) : 'Crypto message';
    }
  }

  /* Rebuild chat history from the store. mockDb reseeds DATA.chatHistory on
     every load, so stored cards are appended back on top of the seed. */
  function rehydrate() {
    if (typeof DATA === 'undefined') return;
    DATA.chatHistory = DATA.chatHistory || {};
    Object.keys(D.msgs).forEach(chatId => {
      const arr = DATA.chatHistory[chatId] = DATA.chatHistory[chatId] || [];
      D.msgs[chatId].forEach(fi => {
        if (arr.some(m => m.fi && m.fi.id === fi.id)) return;
        arr.push({ me: !!fi.me, fi, text: previewOf(fi), time: timeOf(fi.ts) });
      });
    });
  }

  function repaintThread() {
    if (typeof renderChatMessages === 'function') renderChatMessages();
    if (typeof renderConversations === 'function') renderConversations();
  }

  const activeChat = () => (typeof S !== 'undefined' ? S.activeChatId : null);

  function peerName(chatId) {
    const c = (typeof DATA !== 'undefined' && DATA.conversations || [])
      .find(x => String(x.id) === String(chatId));
    return c ? c.name : 'them';
  }

  /* ── 1. Send ─────────────────────────────────────────────────────── */
  function doSend(chatId, coin, amount, note) {
    const amt = parseFloat(amount);
    if (!coin || !priceOf(coin)) return { ok: false, msg: 'Pick a coin with a price.' };
    if (!amt || amt <= 0) return { ok: false, msg: 'Enter an amount.' };
    if (!hasMNY()) return { ok: false, msg: 'Accounts are still loading…' };

    /* Funding first, topped up from Spot if it is short — one balance
       to the person paying, and the ledger records both halves. */
    const out = MNY.spend(coin, amt, { kind: 'spend', via: 'Chat', to: peerName(chatId), note });
    if (!out.ok) return out;

    push(chatId, {
      kind: 'send', me: true, coin, qty: amt,
      value: amt * priceOf(coin), note: note || '', status: 'sent'
    });
    return { ok: true, msg: `Sent ${qty(amt)} ${coin} to ${peerName(chatId)}${out.moved > 0 ? ` · ${qty(out.moved)} moved from Spot` : ''}` };
  }

  /* ── 2. Request ──────────────────────────────────────────────────── */
  /* Payment requests belong to PAY — one system behind the chat button,
     the QR code and a shared link, so a request has one status wherever
     it's read. The block below is the fallback for when PAY isn't loaded. */
  function doRequest(chatId, coin, amount, note) {
    const amt = parseFloat(amount);
    const sym = String(coin || 'USDT').toUpperCase();

    if (typeof PAY !== 'undefined' && PAY.createRequest) {
      if (PAY.ASSETS.indexOf(sym) === -1) {
        return { ok: false, msg: `Requests support ${PAY.ASSETS.join(', ')}.` };
      }
      const convo = (typeof DATA !== 'undefined' && DATA.conversations || [])
        .find(c => String(c.id) === String(chatId));
      const contact = convo ? PAY.contacts().find(u => u.name === convo.name) : null;
      const res = PAY.createRequest({
        to: contact ? contact.handle : '', chatId: contact ? null : chatId,
        toName: convo ? convo.name : '', asset: sym, amount: amt, note
      });
      return res.ok
        ? { ok: true, msg: `Requested ${qty(amt)} ${sym} from ${peerName(chatId)}` }
        : res;
    }

    if (!coin || !priceOf(coin)) return { ok: false, msg: 'Pick a coin with a price.' };
    if (!amt || amt <= 0) return { ok: false, msg: 'Enter an amount.' };

    const fi = push(chatId, {
      kind: 'request', me: true, coin, qty: amt,
      value: amt * priceOf(coin), note: note || '', status: 'pending'
    });

    // The counterparty is simulated — give it a beat, then settle or decline.
    setTimeout(() => settleRequest(fi.id), SETTLE_MS);
    return { ok: true, msg: `Requested ${qty(amt)} ${coin} from ${peerName(chatId)}` };
  }

  function settleRequest(id) {
    const hit = findFi(id);
    if (!hit || hit.fi.status !== 'pending') return;
    const fi = hit.fi;
    const value = fi.qty * priceOf(fi.coin);

    /* Paid into Funding, which is where a request paid through PAY has
       always landed. Chat used to credit Spot instead, so the same
       request settled into a different account depending on which code
       path answered it. MNY.receive applies the cap itself. */
    const got = hasMNY()
      ? MNY.receive(fi.coin, fi.qty, { kind: 'receive', via: 'Chat', from: peerName(hit.chatId), note: fi.note })
      : (takeInbound(value) ? { ok: true } : { ok: false, capped: true });

    if (!got.ok) {
      fi.status = 'declined';
      fi.reason = `Daily settlement cap reached (${usd(INBOUND_DAY_CAP)}/day)`;
      save(); repaintThread();
      toast(`Request declined — ${fi.reason.toLowerCase()}.`);
      return;
    }

    fi.status = 'paid';
    fi.settledAt = Date.now();
    save(); repaintThread();
    toast(`${peerName(hit.chatId)} paid ${qty(fi.qty)} ${fi.coin}`);
  }

  /* ── 3. Gift packet ──────────────────────────────────────────────── */
  /* Funded up front, so claims cost you nothing further — the packet is
     already paid for and claims only decide who gets which slice. */
  function doGift(chatId, coin, amount, slots) {
    const amt = parseFloat(amount);
    const n = Math.max(1, Math.min(20, parseInt(slots, 10) || 5));
    if (!coin || !priceOf(coin)) return { ok: false, msg: 'Pick a coin with a price.' };
    if (!amt || amt <= 0) return { ok: false, msg: 'Enter an amount.' };
    if (!hasMNY()) return { ok: false, msg: 'Accounts are still loading…' };

    const out = MNY.spend(coin, amt, { kind: 'spend', via: 'Chat · gift packet', to: peerName(chatId) });
    if (!out.ok) return out;

    push(chatId, {
      kind: 'gift', me: true, coin, qty: amt, slots: n,
      value: amt * priceOf(coin), claims: [], status: 'open'
    });
    return { ok: true, msg: `Packet funded — ${qty(amt)} ${coin} across ${n} slots` };
  }

  /* Random shares that always sum to the funded amount: each claim takes a
     random slice of what's left, and the final slot sweeps the remainder. */
  function claimGift(id) {
    const hit = findFi(id);
    if (!hit) return;
    const fi = hit.fi;
    if (fi.status !== 'open') return;

    const taken = fi.claims.reduce((s, c) => s + c.qty, 0);
    const left = fi.qty - taken;
    const slotsLeft = fi.slots - fi.claims.length;
    if (slotsLeft <= 0 || left <= 0) { fi.status = 'done'; save(); repaintThread(); return; }

    // Last slot sweeps the remainder so claims always sum to the funded
    // amount; earlier slots take a random 0.5×–1.5× of an even share.
    const cut = slotsLeft === 1
      ? left
      : Math.min(left, (left / slotsLeft) * (0.5 + Math.random()));

    const names = ['Sarah Chen', 'Marcus Webb', 'Zara Ahmed', 'Dev Kumar', 'Priya N.', 'Leo M.'];
    fi.claims.push({ name: names[fi.claims.length % names.length], qty: cut, ts: Date.now() });

    const remaining = fi.qty - fi.claims.reduce((s, c) => s + c.qty, 0);
    if (fi.claims.length >= fi.slots || remaining <= 1e-12) fi.status = 'done';

    save(); repaintThread();
  }

  /* ── 4. Split bill ───────────────────────────────────────────────── */
  function doSplit(chatId, coin, total, people, note) {
    const t = parseFloat(total);
    const n = Math.max(2, Math.min(20, parseInt(people, 10) || 2));
    if (!coin || !priceOf(coin)) return { ok: false, msg: 'Pick a coin with a price.' };
    if (!t || t <= 0) return { ok: false, msg: 'Enter a total.' };

    push(chatId, {
      kind: 'split', me: true, coin, total: t, people: n,
      share: t / n, paid: 0, note: note || '', status: 'open'
    });
    return { ok: true, msg: `Split ${qty(t)} ${coin} ${n} ways — ${qty(t / n)} each` };
  }

  /* Your own share isn't collectable, so a split of n only ever pays you
     back n-1 shares. Each one goes through the inbound cap. */
  function collectSplit(id) {
    const hit = findFi(id);
    if (!hit) return;
    const fi = hit.fi;
    if (fi.status !== 'open') return;

    const value = fi.share * priceOf(fi.coin);
    const got = hasMNY()
      ? MNY.receive(fi.coin, fi.share, { kind: 'receive', via: 'Chat · split bill', from: peerName(hit.chatId), note: fi.note })
      : (takeInbound(value) ? { ok: true } : { ok: false, capped: true });
    if (!got.ok) {
      toast(`Daily settlement cap reached (${usd(INBOUND_DAY_CAP)}/day).`);
      return;
    }

    fi.paid += 1;
    if (fi.paid >= fi.people - 1) fi.status = 'settled';
    save(); repaintThread();
    toast(`Collected ${qty(fi.share)} ${fi.coin}`);
  }

  /* ── 5. Price card ───────────────────────────────────────────────── */
  function doPrice(chatId, coin) {
    const c = String(coin || '').toUpperCase();
    if (!c || !isLivePrice(c)) return { ok: false, msg: `No live price for ${c || 'that coin'}.` };
    push(chatId, { kind: 'price', me: true, coin: c });
    return { ok: true, msg: `Shared ${c} price` };
  }

  /* ── 6. Alert ────────────────────────────────────────────────────── */
  function doAlert(chatId, coin, direction, target) {
    const c = String(coin || '').toUpperCase();
    const t = parseFloat(target);
    if (typeof CT === 'undefined') return { ok: false, msg: 'Crypto tools unavailable.' };
    if (!c || !isLivePrice(c)) return { ok: false, msg: `No live price for ${c || 'that coin'}.` };
    if (!t || t <= 0) return { ok: false, msg: 'Enter a target price.' };

    const dir = direction === 'below' ? 'below' : 'above';
    CT.addAlert(c, dir, t);
    push(chatId, { kind: 'alert', me: true, coin: c, direction: dir, target: t, base: priceOf(c) });
    return { ok: true, msg: `Alert armed — ${c} ${dir} ${usd(t)}` };
  }

  /* ── Cards ───────────────────────────────────────────────────────── */
  function cardHTML(fi) {
    switch (fi.kind) {
      case 'send':    return sendCard(fi);
      case 'request': return requestCard(fi);
      case 'gift':    return giftCard(fi);
      case 'split':   return splitCard(fi);
      case 'price':   return priceCard(fi);
      case 'alert':   return alertCard(fi);
      // QR payments and payment requests live in PAY, which owns their state.
      default:        return (window.PAY && window.PAY.cardHTML) ? window.PAY.cardHTML(fi) : '';
    }
  }

  const head = (icon, label, tone) =>
    `<div class="cfi-head">
       <span class="material-symbols-rounded ms-16 ${tone || ''}">${icon}</span>
       <span class="cfi-label">${esc(label)}</span>
     </div>`;

  function sendCard(fi) {
    return `<div class="cfi-card cfi-send">
      ${head('north_east', fi.me ? 'Sent' : 'Received', 'tc-green')}
      <div class="cfi-amt">${ic(fi.coin, 22)}<span>${qty(fi.qty)} ${esc(fi.coin)}</span></div>
      <div class="cfi-sub">${usd(fi.value)}${fi.note ? ' · ' + esc(fi.note) : ''}</div>
      <div class="cfi-foot"><span class="cfi-pill ok">Completed</span></div>
    </div>`;
  }

  function requestCard(fi) {
    const pill = fi.status === 'paid' ? '<span class="cfi-pill ok">Paid</span>'
      : fi.status === 'declined' ? `<span class="cfi-pill bad">Declined</span>`
      : '<span class="cfi-pill wait">Waiting…</span>';
    return `<div class="cfi-card cfi-request">
      ${head('south_west', 'Payment request', 'tc-blue')}
      <div class="cfi-amt">${ic(fi.coin, 22)}<span>${qty(fi.qty)} ${esc(fi.coin)}</span></div>
      <div class="cfi-sub">${usd(fi.value)}${fi.note ? ' · ' + esc(fi.note) : ''}</div>
      ${fi.reason ? `<div class="cfi-note">${esc(fi.reason)}</div>` : ''}
      <div class="cfi-foot">${pill}</div>
    </div>`;
  }

  function giftCard(fi) {
    const taken = fi.claims.reduce((s, c) => s + c.qty, 0);
    const pctDone = fi.qty > 0 ? Math.min(100, (taken / fi.qty) * 100) : 0;
    const rows = fi.claims.slice(-3).map(c =>
      `<div class="cfi-claim"><span>${esc(c.name)}</span><b>${qty(c.qty)} ${esc(fi.coin)}</b></div>`).join('');
    return `<div class="cfi-card cfi-gift">
      ${head('featured_seasonal_and_gifts', 'Gift packet', 'tc-red')}
      <div class="cfi-amt">${ic(fi.coin, 22)}<span>${qty(fi.qty)} ${esc(fi.coin)}</span></div>
      <div class="cfi-sub">${fi.claims.length}/${fi.slots} claimed · ${usd(fi.value)} funded</div>
      <div class="cfi-bar"><i style="width:${pctDone.toFixed(1)}%"></i></div>
      ${rows}
      <div class="cfi-foot">
        ${fi.status === 'open'
          ? `<button class="btn btn-sm btn-primary" onclick="CFI.claimGift('${fi.id}')">Open packet</button>`
          : '<span class="cfi-pill ok">All claimed</span>'}
      </div>
    </div>`;
  }

  function splitCard(fi) {
    const owed = fi.people - 1;
    return `<div class="cfi-card cfi-split">
      ${head('call_split', 'Split bill', 'tc-purple')}
      <div class="cfi-amt">${ic(fi.coin, 22)}<span>${qty(fi.total)} ${esc(fi.coin)}</span></div>
      <div class="cfi-sub">${fi.people} people · ${qty(fi.share)} ${esc(fi.coin)} each${fi.note ? ' · ' + esc(fi.note) : ''}</div>
      <div class="cfi-bar"><i style="width:${owed ? (fi.paid / owed) * 100 : 100}%"></i></div>
      <div class="cfi-foot">
        <span class="cfi-sub">${fi.paid}/${owed} settled</span>
        ${fi.status === 'open'
          ? `<button class="btn btn-sm btn-ghost" onclick="CFI.collectSplit('${fi.id}')">Collect a share</button>`
          : '<span class="cfi-pill ok">Settled</span>'}
      </div>
    </div>`;
  }

  function priceCard(fi) {
    const c = (window.liveCryptoPrices || {})[fi.coin];
    const px = fi.coin === 'USDT' ? 1 : (c ? c.usd : 0);
    const ch = c ? (c.change24h || c.usd_24h_change || 0) : 0;
    const up = ch >= 0;
    return `<div class="cfi-card cfi-price" data-cfi-price="${esc(fi.coin)}">
      ${head('monitoring', 'Live price', 'tc-blue')}
      <div class="cfi-amt">${ic(fi.coin, 22)}<span>${esc(fi.coin)}</span></div>
      <div class="cfi-px">
        <b data-cfi-px>${px ? usd(px) : '—'}</b>
        <span class="${up ? 'tc-green' : 'tc-red'}" data-cfi-ch>${px ? (up ? '+' : '') + ch.toFixed(2) + '%' : ''}</span>
      </div>
      <div class="cfi-foot">
        ${hasTR() && TR.isTradable(fi.coin)
          ? `<button class="btn btn-sm btn-primary" onclick="CFI.openSpot('${esc(fi.coin)}')">Trade</button>`
          : ''}
        <button class="btn btn-sm btn-ghost" onclick="CFI.open('alert','${esc(fi.coin)}')">Set alert</button>
      </div>
    </div>`;
  }

  function alertCard(fi) {
    return `<div class="cfi-card cfi-alert">
      ${head('notifications_active', 'Price alert', 'tc-orange')}
      <div class="cfi-amt">${ic(fi.coin, 22)}<span>${esc(fi.coin)} ${fi.direction} ${usd(fi.target)}</span></div>
      <div class="cfi-sub">Armed at ${usd(fi.base)} · fires in Crypto Tools</div>
    </div>`;
  }

  /* Price cards are patched in place so a repaint never scrolls the
     thread out from under whoever is reading it. */
  function onPriceTick() {
    document.querySelectorAll('[data-cfi-price]').forEach(el => {
      const sym = el.getAttribute('data-cfi-price');
      const c = (window.liveCryptoPrices || {})[sym];
      const px = sym === 'USDT' ? 1 : (c ? c.usd : 0);
      const ch = c ? (c.change24h || c.usd_24h_change || 0) : 0;
      const pxEl = el.querySelector('[data-cfi-px]');
      const chEl = el.querySelector('[data-cfi-ch]');
      if (pxEl) pxEl.textContent = px ? usd(px) : '—';
      if (chEl) {
        chEl.textContent = px ? (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%' : '';
        chEl.className = ch >= 0 ? 'tc-green' : 'tc-red';
      }
    });
  }

  function openSpot(sym) {
    if (!hasTR() || !TR.isTradable(sym)) { toast(`${sym} isn't in the live market feed.`); return; }
    TR.setPair(sym);
    if (typeof navigateTo === 'function') navigateTo('trade');
  }

  /* ── $TICKER chips ───────────────────────────────────────────────── */
  /* Runs over already-escaped text, so the pattern only ever sees plain
     characters — no chance of reopening an injection hole. */
  function linkify(escaped) {
    return String(escaped).replace(/\$([A-Za-z]{2,10})\b/g, (m, raw) => {
      const sym = raw.toUpperCase();
      if (!priceOf(sym)) return m;
      return `<button class="cfi-chip" onclick="CFI.open('price','${sym}')">${ic(sym, 14)}${sym}</button>`;
    });
  }

  /* ── Slash commands ──────────────────────────────────────────────── */
  const COMMANDS = [
    ['/price BTC',            'Share a live quote'],
    ['/send 10 USDT [note]',  'Send from your balance'],
    ['/request 25 USDT',      'Ask for a payment'],
    ['/gift 50 USDT 5',       'Fund a gift packet'],
    ['/split 120 USDT 4',     'Split a bill'],
    ['/alert BTC above 90000', 'Arm a price alert'],
    ['/tip',                  'Quick 1 USDT tip']
  ];

  /* Returns true when the text was a command — the caller then skips its
     normal send path so the raw "/send 10 USDT" never lands as a bubble. */
  function handleSlash(text, chatId) {
    const t = String(text || '').trim();
    if (t[0] !== '/') return false;

    const parts = t.slice(1).split(/\s+/);
    const cmd = (parts.shift() || '').toLowerCase();
    const r = res => { toast(res.msg); return true; };

    switch (cmd) {
      case 'help':
        toast('Chat commands: ' + COMMANDS.map(c => c[0].split(' ')[0]).join(' '));
        openHelp(chatId);
        return true;
      case 'price':
        return r(doPrice(chatId, parts[0]));
      case 'send':
        return r(doSend(chatId, (parts[1] || 'USDT').toUpperCase(), parts[0], parts.slice(2).join(' ')));
      case 'request':
        return r(doRequest(chatId, (parts[1] || 'USDT').toUpperCase(), parts[0], parts.slice(2).join(' ')));
      case 'tip':
        return r(doSend(chatId, 'USDT', parts[0] || 1, 'Tip'));
      case 'gift':
        return r(doGift(chatId, (parts[1] || 'USDT').toUpperCase(), parts[0], parts[2] || 5));
      case 'split':
        return r(doSplit(chatId, (parts[1] || 'USDT').toUpperCase(), parts[0], parts[2] || 2, parts.slice(3).join(' ')));
      case 'alert': {
        const coin = parts[0];
        const dirRaw = (parts[1] || '').toLowerCase();
        const dir = (dirRaw === 'below' || dirRaw === '<') ? 'below' : 'above';
        return r(doAlert(chatId, coin, dir, parts[2]));
      }
      default:
        toast(`Unknown command /${cmd} — try /help`);
        return true;
    }
  }

  function openHelp(chatId) {
    sheet = { kind: 'help', chatId };
    openPanel();
  }

  /* ── Crypto Desk bot ─────────────────────────────────────────────── */
  const isBot = chatId => String(chatId) === String(BOT_ID);

  /* Registered into DATA so the bot shows up under the "AI" filter
     alongside ALINA, without editing the seed file. */
  function installBot() {
    if (typeof DATA === 'undefined' || !Array.isArray(DATA.conversations)) return;
    if (DATA.conversations.some(c => String(c.id) === String(BOT_ID))) return;
    DATA.conversations.push({
      id: BOT_ID, name: 'Crypto Desk', emoji: '✨',
      preview: 'Ask me any coin price, or type /help',
      time: 'now', unread: 0, online: true, type: 'bots'
    });
    DATA.chatHistory = DATA.chatHistory || {};
    if (!DATA.chatHistory[BOT_ID]) {
      DATA.chatHistory[BOT_ID] = [
        { me: false, text: 'Crypto Desk here. Ask me "price of ETH", "top movers", or "market" — I read the same live feed as the trading desk.', time: 'now' },
        { me: false, text: 'You can also use /price, /send, /gift and /split right from this box.', time: 'now' }
      ];
    }
  }

  /* Answers off window.liveCryptoPrices — never invents a number. */
  function botReply(text) {
    const t = String(text || '').toLowerCase();
    const live = window.liveCryptoPrices || {};
    const syms = Object.keys(live);

    if (!syms.length) return 'The live market feed hasn\'t landed yet — give it a few seconds and ask again.';

    const asked = syms.find(s => new RegExp('\\b' + s.toLowerCase() + '\\b').test(t));
    if (asked) {
      const c = live[asked];
      const ch = c.change24h || c.usd_24h_change || 0;
      return `${asked} is ${usd(c.usd)}, ${ch >= 0 ? 'up' : 'down'} ${Math.abs(ch).toFixed(2)}% over 24h. Type "/price ${asked}" to drop a live card in here.`;
    }

    if (/mover|gainer|top|best/.test(t)) {
      const top = syms
        .map(s => ({ s, ch: live[s].change24h || live[s].usd_24h_change || 0 }))
        .sort((a, b) => b.ch - a.ch).slice(0, 3);
      return 'Top movers right now: ' + top.map(x => `${x.s} ${x.ch >= 0 ? '+' : ''}${x.ch.toFixed(2)}%`).join(', ') + '.';
    }

    if (/market|overview|how.*doing|sentiment/.test(t)) {
      const chs = syms.map(s => live[s].change24h || live[s].usd_24h_change || 0);
      const up = chs.filter(c => c > 0).length;
      const avg = chs.reduce((a, b) => a + b, 0) / chs.length;
      return `${up} of ${syms.length} tracked coins are green, average 24h move ${avg >= 0 ? '+' : ''}${avg.toFixed(2)}%.`;
    }

    if (/help|command|what can/.test(t)) {
      return 'Try: /price BTC · /send 10 USDT · /request 25 USDT · /gift 50 USDT 5 · /split 120 USDT 4 · /alert BTC above 90000';
    }

    return 'I can quote any coin in the live feed — try "price of SOL", "top movers", or "market".';
  }

  /* ── Panel ───────────────────────────────────────────────────────── */
  function open(kind, coin) {
    const chatId = activeChat();
    if (!chatId) { toast('Pick a conversation first.'); return; }
    if (kind === 'request' && typeof PAY !== 'undefined' && PAY.openRequestForChat) {
      // Back from the request page returns to this panel as it was.
      const snap = sheet ? { ...sheet } : null;
      close();
      PAY.openRequestForChat(chatId, { origin: 'cfi', cfi: snap });
      return;
    }
    sheet = {
      kind: kind || 'send', chatId,
      coin: coin || 'USDT', amount: '', note: '',
      slots: 5, people: 4, direction: 'above', target: ''
    };
    openPanel();
  }

  function openPanel() {
    if (document.getElementById('cfi-panel')) { paint(); return; }
    const p = document.createElement('div');
    p.id = 'cfi-panel';
    p.className = 'sf-panel';
    document.body.appendChild(p);
    const s = document.createElement('div');
    s.id = 'cfi-scrim';
    s.className = 'sf-scrim';
    s.onclick = close;
    document.body.appendChild(s);
    paint();
    setTimeout(() => { p.classList.add('open'); s.classList.add('open'); }, 20);
  }

  function close() {
    const p = document.getElementById('cfi-panel'), s = document.getElementById('cfi-scrim');
    // Renamed while they fade, so a panel reopened straight away (Back from
    // the request or wallet-address page) is built fresh, not removed.
    if (p) { p.id = 'cfi-panel-closing'; p.classList.remove('open'); setTimeout(() => p.remove(), 260); }
    if (s) { s.id = 'cfi-scrim-closing'; s.onclick = null; s.classList.remove('open'); setTimeout(() => s.remove(), 260); }
    sheet = null;
  }

  /* Reopen the panel where the user left it (Back from a page it opened). */
  function restore(snap) {
    const chatId = (snap && snap.chatId) || activeChat();
    if (!chatId) return;
    if (typeof S !== 'undefined') S.activeChatId = chatId;
    const base = { kind: 'send', chatId, coin: 'USDT', amount: '', note: '', slots: 5, people: 4, direction: 'above', target: '' };
    sheet = { ...base, ...(snap || {}), chatId };
    if (sheet.kind === 'request') sheet.kind = 'send';
    openPanel();
  }

  function setTab(k) {
    if (!sheet) return;
    if (k === 'request' && typeof PAY !== 'undefined' && PAY.openRequestForChat) {
      const snap = { ...sheet };
      close();
      PAY.openRequestForChat(snap.chatId, { origin: 'cfi', cfi: snap });
      return;
    }
    sheet.kind = k;
    paint();
  }
  function setField(k, v) { if (sheet) { sheet[k] = v; if (k === 'coin' || k === 'amount') paintPreview(); } }

  const TABS = [
    ['send',    'Send',    'north_east'],
    ['request', 'Request', 'south_west'],
    ['gift',    'Gift',    'featured_seasonal_and_gifts'],
    ['split',   'Split',   'call_split'],
    ['price',   'Price',   'monitoring'],
    ['alert',   'Alert',   'notifications_active']
  ];

  function paint() {
    const p = document.getElementById('cfi-panel');
    if (!p || !sheet) return;
    const title = sheet.kind === 'help' ? 'Chat commands'
      : (TABS.find(t => t[0] === sheet.kind) || TABS[0])[1];

    p.innerHTML = `
      <div class="sf-head">
        <div>
          <div class="sf-kicker">CHAT CRYPTO</div>
          <h3 class="sf-title">${esc(title)}</h3>
          <div class="fs11 tc-3">with ${esc(peerName(sheet.chatId))}</div>
        </div>
        <button class="icon-btn" onclick="CFI.close()" aria-label="Close">
          <span class="material-symbols-rounded ms-18">close</span>
        </button>
      </div>
      <div class="cfi-tabs">
        ${TABS.map(([k, l, i]) => `
          <button class="cfi-tab${sheet.kind === k ? ' active' : ''}" onclick="CFI.setTab('${k}')" title="${l}">
            <span class="material-symbols-rounded ms-18">${i}</span><span>${l}</span>
          </button>`).join('')}
      </div>
      <div id="cfi-body">${sheet.kind === 'help' ? helpHTML() : formHTML()}</div>
      <div class="cfi-disclaimer">
        <span class="material-symbols-rounded ms-16">info</span>
        Paper balances only. Contacts here are simulated, so anything they send back is capped at
        ${usd(INBOUND_DAY_CAP)}/day (${usd(inboundLeft())} left today) to keep your portfolio honest.
        Nothing leaves this browser and no real funds move.
      </div>`;
    paintPreview();
  }

  function coinSelect(compact) {
    const list = coinList().slice(0, 160);
    // Beside the amount there's room for the symbol only; the balance line
    // under it says what you hold.
    return `<select class="cfi-input" aria-label="Coin" onchange="CFI.setField('coin', this.value); CFI.repaint()">
      ${list.map(c => {
        const bal = haveOf(c);
        return `<option value="${c}"${c === sheet.coin ? ' selected' : ''}>${c}${bal > 0 && !compact ? ` — ${qty(bal)}` : ''}</option>`;
      }).join('')}
    </select>`;
  }

  const balLine = () => {
    const bal = haveOf(sheet.coin);
    const inSpot = (typeof MNY !== 'undefined') ? MNY.balanceOf(sheet.coin, 'spot') : 0;
    /* Where it sits matters to nobody paying, but saying so explains the
       Spot line that appears on the receipt when Funding was short. */
    const where = inSpot > 0 && inSpot < bal ? ` · ${qty(inSpot)} in Spot` : '';
    return `<div class="cfi-bal">Available: <b>${qty(bal)} ${esc(sheet.coin)}</b> · ${usd(bal * priceOf(sheet.coin))}${where}</div>`;
  };

  function formHTML() {
    const k = sheet.kind;

    if (k === 'price') {
      return `
        <label class="cfi-lbl">Coin</label>
        ${coinSelect()}
        <div class="cfi-preview" id="cfi-preview"></div>
        <button class="btn btn-primary cfi-go" onclick="CFI.submit()">Share live price</button>`;
    }

    if (k === 'alert') {
      return `
        <label class="cfi-lbl">Coin</label>
        ${coinSelect()}
        <label class="cfi-lbl">Fire when price goes</label>
        <div class="cfi-seg">
          <button class="cfi-segbtn${sheet.direction === 'above' ? ' active' : ''}" onclick="CFI.setField('direction','above'); CFI.repaint()">Above</button>
          <button class="cfi-segbtn${sheet.direction === 'below' ? ' active' : ''}" onclick="CFI.setField('direction','below'); CFI.repaint()">Below</button>
        </div>
        <label class="cfi-lbl">Target price (USD)</label>
        <input class="cfi-input" type="number" step="any" placeholder="0.00" value="${esc(sheet.target)}"
               oninput="CFI.setField('target', this.value)">
        <div class="cfi-preview" id="cfi-preview"></div>
        <button class="btn btn-primary cfi-go" onclick="CFI.submit()">Arm alert</button>`;
    }

    const amountLabel = k === 'split' ? 'Total amount' : 'Amount';
    const extra = k === 'gift'
      ? `<label class="cfi-lbl">Slots</label>
         <input class="cfi-input" type="number" min="1" max="20" value="${sheet.slots}" oninput="CFI.setField('slots', this.value)">`
      : k === 'split'
      ? `<label class="cfi-lbl">People (including you)</label>
         <input class="cfi-input" type="number" min="2" max="20" value="${sheet.people}" oninput="CFI.setField('people', this.value)">`
      : `<label class="cfi-lbl">Note (optional)</label>
         <input class="cfi-input" type="text" maxlength="60" placeholder="What's it for?" value="${esc(sheet.note)}"
                oninput="CFI.setField('note', this.value)">`;

    const quickPct = (k === 'send' || k === 'gift')
      ? `<div class="cfi-quick">${[25, 50, 75, 100].map(p =>
          `<button class="cfi-qbtn" onclick="CFI.quick(${p})">${p}%</button>`).join('')}</div>`
      : '';

    const verb = { send: 'Send', request: 'Request', gift: 'Fund packet', split: 'Post split' }[k] || 'Confirm';

    /* Send starts with the question people actually have: how does the
       money get there? Two cards — Trending balance (instant, free, just
       their name) or Crypto wallet (on-chain, network fee, their address).
       The old version was a small switch under the coin, labelled "In
       Trending" and "Wallet address", that didn't say what either meant. */
    if (k === 'send') {
      const lanes = typeof PF !== 'undefined'
        ? PF.lanes({ kind: 'send', active: 'app', who: peerName(sheet.chatId), onChain: "WAD.fromChat('send')" })
        : (window.WAD ? WAD.destBar('send') : '');
      return `
        ${lanes}
        <label class="cfi-lbl">Amount</label>
        <div class="cfi-amtrow">
          <input class="cfi-input cfi-amt-in" type="number" step="any" min="0" inputmode="decimal" placeholder="0.00"
                 value="${esc(sheet.amount)}" oninput="CFI.setField('amount', this.value)" aria-label="Amount">
          ${coinSelect(true)}
        </div>
        ${balLine()}
        ${quickPct}
        ${extra}
        <div class="cfi-preview" id="cfi-preview"></div>
        <button class="btn btn-primary cfi-go" id="cfi-go" onclick="CFI.submit()">Send</button>`;
    }

    const dest = k === 'request' && window.WAD ? WAD.destBar(k, peerName(sheet.chatId)) : '';

    return `
      <label class="cfi-lbl">Coin</label>
      ${coinSelect()}
      ${k === 'request' ? '' : balLine()}
      ${dest}
      <label class="cfi-lbl">${amountLabel}</label>
      <input class="cfi-input" type="number" step="any" placeholder="0.00" value="${esc(sheet.amount)}"
             oninput="CFI.setField('amount', this.value)">
      ${quickPct}
      ${extra}
      <div class="cfi-preview" id="cfi-preview"></div>
      <button class="btn btn-primary cfi-go" onclick="CFI.submit()">${verb}</button>`;
  }

  function helpHTML() {
    return `<div class="cfi-help">
      ${COMMANDS.map(([c, d]) => `
        <div class="cfi-cmd">
          <code>${esc(c)}</code>
          <span>${esc(d)}</span>
        </div>`).join('')}
      <div class="fs11 tc-3" style="margin-top:10px">
        Typing <code>$BTC</code> in any message turns it into a live price chip.
      </div>
    </div>`;
  }

  function quick(pct) {
    if (!sheet) return;
    const bal = haveOf(sheet.coin);
    sheet.amount = String(bal * (pct / 100));
    paint();
  }

  function paintPreview() {
    const box = document.getElementById('cfi-preview');
    if (!box || !sheet) return;
    const px = priceOf(sheet.coin);

    if (sheet.kind === 'price') {
      box.innerHTML = px
        ? `<div class="cfi-prow"><span>Live ${esc(sheet.coin)}</span><b>${usd(px)}</b></div>`
        : `<div class="cfi-prow"><span>No live price</span><b>—</b></div>`;
      return;
    }
    if (sheet.kind === 'alert') {
      const t = parseFloat(sheet.target);
      box.innerHTML = `<div class="cfi-prow"><span>${esc(sheet.coin)} now</span><b>${usd(px)}</b></div>` +
        (t ? `<div class="cfi-prow"><span>Distance to target</span><b>${px ? (((t - px) / px) * 100).toFixed(2) + '%' : '—'}</b></div>` : '');
      return;
    }

    const amt = parseFloat(sheet.amount) || 0;

    if (sheet.kind === 'send' && typeof PF !== 'undefined') {
      const have = haveOf(sheet.coin);
      const who = peerName(sheet.chatId);
      const inFunding = hasMNY() ? MNY.balanceOf(sheet.coin, 'funding') : have;
      const short = amt > have + 1e-12;
      let html = PF.summary(PF.appRows({ coin: sheet.coin, amount: amt, who, after: have - amt }));
      if (short) html += `<div class="cfi-note short">You hold ${esc(qty(have))} ${esc(sheet.coin)} — lower the amount.</div>`;
      else if (amt > inFunding + 1e-12) html += `<div class="cfi-note">${esc(qty(amt - inFunding))} ${esc(sheet.coin)} moves over from your Spot account to cover this.</div>`;
      box.innerHTML = html;
      const go = document.getElementById('cfi-go');
      if (go) {
        go.disabled = !(amt > 0) || short;
        go.textContent = amt > 0 ? `Send ${qty(amt)} ${sheet.coin} to ${String(who).split(/\s+/)[0]}` : 'Send';
      }
      return;
    }

    const rows = [[`Value`, usd(amt * px)]];
    if (sheet.kind === 'gift') rows.push(['Per slot (avg)', `${qty(amt / Math.max(1, sheet.slots))} ${sheet.coin}`]);
    if (sheet.kind === 'split') {
      const n = Math.max(2, parseInt(sheet.people, 10) || 2);
      rows.push(['Each pays', `${qty(amt / n)} ${sheet.coin}`]);
      rows.push(['You collect', `${qty((amt / n) * (n - 1))} ${sheet.coin}`]);
    }
    if (sheet.kind === 'send' || sheet.kind === 'gift') {
      const after = haveOf(sheet.coin) - amt;
      rows.push(['Balance after', `${qty(Math.max(0, after))} ${sheet.coin}`]);
    }
    box.innerHTML = rows.map(([l, v]) => `<div class="cfi-prow"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('');
  }

  function submit() {
    if (!sheet) return;
    const { kind, chatId, coin, amount, note } = sheet;
    let res;
    switch (kind) {
      case 'send':    res = doSend(chatId, coin, amount, note); break;
      case 'request': res = doRequest(chatId, coin, amount, note); break;
      case 'gift':    res = doGift(chatId, coin, amount, sheet.slots); break;
      case 'split':   res = doSplit(chatId, coin, amount, sheet.people, note); break;
      case 'price':   res = doPrice(chatId, coin); break;
      case 'alert':   res = doAlert(chatId, coin, sheet.direction, sheet.target); break;
      default: return;
    }
    toast(res.msg);
    if (res.ok) close();
  }

  return {
    open, close, restore, setTab, setField, submit, quick, repaint: paint,
    cardHTML, linkify, handleSlash, rehydrate, onPriceTick,
    claimGift, collectSplit, openSpot,
    installBot, botReply, isBot,
    doSend, doRequest, doGift, doSplit, doPrice, doAlert,
    inboundLeft, takeInbound, push,
    get sheet() { return sheet; },
    get BOT_ID() { return BOT_ID; },
    get state() { return D; }
  };
})();

window.CFI = CFI;

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
publish('features/chatfi.js', {
  CFI: () => CFI
});
