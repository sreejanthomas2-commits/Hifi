/* ╔══════════════════════════════════════════════════════════════════╗
   ║  MONEY — one account system for the whole app                     ║
   ║                                                                   ║
   ║  Before this file there were three pots and nobody in charge:     ║
   ║                                                                   ║
   ║    · Funding (DATA.wallet.balances) — tips, Pay, P2P, rewards     ║
   ║    · Spot    (TR)                   — trading, and chat crypto    ║
   ║    · Earn    (EN)                   — staked                      ║
   ║                                                                   ║
   ║  So a tip you received could not be sent in a chat, because chat  ║
   ║  spent from Spot and the tip landed in Funding. Worse: a payment  ║
   ║  REQUEST sent from chat was paid into Funding while a SEND from   ║
   ║  the same button row came out of Spot. Same row, two accounts.    ║
   ║                                                                   ║
   ║  Everything that moves money now comes through here.              ║
   ║                                                                   ║
   ║  · ONE price. Live where a market exists; a declared reference    ║
   ║    for the app's own pre-listing tokens, flagged as a reference   ║
   ║    so no screen can pass it off as a market price; and nothing    ║
   ║    invented for a coin with neither. An unpriced coin shows its   ║
   ║    quantity and no value, and stays out of totals.                ║
   ║                                                                   ║
   ║  · ONE spendable balance. Paying draws on Funding and, if that    ║
   ║    is short, moves the rest over from Spot and says so — the      ║
   ║    transfer is a real ledger line, not a fudge.                   ║
   ║                                                                   ║
   ║  · Transfer moves ANY asset. It used to move USDT only, so coins  ║
   ║    could arrive in Funding and never leave.                       ║
   ║                                                                   ║
   ║  · ONE ledger, written on every move and kept. The Wallet tab's   ║
   ║    old "history" was three hard-coded rows that never changed.    ║
   ║                                                                   ║
   ║  All of it is simulated paper money. Nothing here touches a       ║
   ║  chain, a card or a bank — real deposits and withdrawals live in  ║
   ║  DEP and WD and keep their own custody ledger on the server.      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const MNY = (() => {

  const LEDGER_KEY = 'ts_money_ledger_v1';
  const MAX_LEDGER = 300;

  /* Quote assets are worth a dollar by definition in this app — the same
     three the trading desk prices against. */
  const STABLE = { USDT: 1, USDC: 1, USD1: 1 };

  /* Tokens the app issues itself, which no exchange lists. The number is
     a reference the product declares, NOT a market price, and every
     caller can tell the difference by asking `quote()`. TREND's 0.10 is
     the figure Pay and the Wallet tab already used; NEON's 2.45 is the
     one the markets table already carried. Nothing is re-valued here. */
  const REFERENCE = { TREND: 0.10, NEON: 2.45 };

  const ACCOUNTS = {
    funding: { label: 'Funding', note: 'Tips, Pay, chat crypto and P2P settle here.' },
    spot:    { label: 'Spot',    note: 'The paper trading account.' },
    earn:    { label: 'Earn',    note: 'Staked and at work.', readOnly: true }
  };

  const hasTR = () => typeof TR !== 'undefined';
  const hasEN = () => typeof EN !== 'undefined';
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const sym_ = s => String(s == null ? '' : s).toUpperCase().trim();

  /* ── Price ───────────────────────────────────────────────────────── */
  function liveMap() {
    return { ...(window.liveCryptoPrices || {}), ...((window.TokenMarkets && TokenMarkets.prices()) || {}) };
  }

  /* The single answer to "what is this worth". `live` means a market is
     quoting it right now; `reference` means the app declared a number
     and a screen showing it owes the reader that word. */
  function quote(s) {
    const k = sym_(s);
    if (!k) return { usd: 0, known: false, live: false, reference: false, change24h: 0 };
    if (STABLE[k]) return { usd: 1, known: true, live: true, reference: false, change24h: 0 };
    const c = liveMap()[k];
    const px = c ? num(c.usd) : 0;
    if (px > 0) {
      /* A remembered price (the cached list at start-up, or a coin the
         stream has not refreshed) still values a holding, but it is not
         live: nothing may be converted or traded at it. */
      return {
        usd: px, known: true, live: !c.stale, reference: false,
        change24h: num(c.change24h != null ? c.change24h : c.usd_24h_change),
        name: c.name || k
      };
    }
    if (REFERENCE[k] != null) {
      return { usd: REFERENCE[k], known: true, live: false, reference: true, change24h: 0 };
    }
    return { usd: 0, known: false, live: false, reference: false, change24h: 0 };
  }

  const price = s => quote(s).usd;
  const isPriced = s => quote(s).known;
  const isLive = s => quote(s).live;
  const isReference = s => quote(s).reference;
  const value = (s, q) => price(s) * num(q);

  function nameOf(s) {
    const k = sym_(s);
    const c = liveMap()[k];
    if (c && c.name) return c.name;
    if (k === 'USDT') return 'TetherUS';
    if (k === 'TREND') return 'Trending Token';
    if (k === 'NEON') return 'Neon Protocol';
    return k;
  }

  /* ── Formatting ──────────────────────────────────────────────────── */
  function usd(v, dp) {
    const n = num(v), a = Math.abs(n);
    const d = dp != null ? dp : (a > 0 && a < 0.01 ? 6 : 2);
    return (n < 0 ? '-$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function qty(v) {
    const n = num(v);
    if (!n) return '0';
    const a = Math.abs(n);
    if (a < 0.0001) return n.toExponential(2);
    return n.toLocaleString('en-US', { maximumFractionDigits: a >= 1000 ? 2 : a >= 1 ? 6 : 8 });
  }
  /* What a row shows in the value column. An unpriced coin gets a dash,
     never a zero — zero reads as "worthless", and we simply don't know. */
  const valueLabel = (s, q) => (isPriced(s) ? usd(value(s, q)) : '—');

  /* ── The accounts ────────────────────────────────────────────────── */
  const fundingStore = () => ((typeof DATA !== 'undefined' && DATA.wallet && DATA.wallet.balances) || null);

  function balanceOf(s, account) {
    const k = sym_(s);
    if ((account || 'funding') === 'spot') return hasTR() ? num(TR.availableOf(k)) : 0;
    const b = fundingStore();
    return b ? num(b[k]) : 0;
  }

  /* What you can actually pay with: Funding plus Spot, because paying
     now reaches both. One number, so no screen can promise what another
     refuses. */
  const spendable = s => balanceOf(s, 'funding') + balanceOf(s, 'spot');

  function rawDebit(s, amount, account) {
    const k = sym_(s), amt = num(amount);
    if (amt <= 0) return false;
    if (account === 'spot') return hasTR() ? !!TR.debitAsset(k, amt) : false;
    const b = fundingStore();
    if (!b) return false;
    if (num(b[k]) + 1e-12 < amt) return false;
    b[k] = num(b[k]) - amt;                  // the mockDb proxy persists this
    if (b[k] < 1e-12) b[k] = 0;
    return true;
  }

  function rawCredit(s, amount, account) {
    const k = sym_(s), amt = num(amount);
    if (amt <= 0) return false;
    if (account === 'spot') return hasTR() ? !!TR.creditAsset(k, amt, price(k)) : false;
    const b = fundingStore();
    if (!b) return false;
    b[k] = num(b[k]) + amt;
    return true;
  }

  /* ── The ledger ──────────────────────────────────────────────────── */
  /* Append-only and kept, so the history screen reports what happened
     rather than a fixed set of example rows. */
  function ledger(limit) {
    let rows_ = [];
    try { rows_ = JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]'); } catch (e) { rows_ = []; }
    if (!Array.isArray(rows_)) rows_ = [];
    return limit ? rows_.slice(0, limit) : rows_;
  }

  function record(entry) {
    const e = {
      id: 'mv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      t: Date.now(),
      kind: entry.kind || 'move',          // spend | receive | transfer | tip | swap | trade
      sym: sym_(entry.sym),
      qty: num(entry.qty),
      dir: entry.dir || (entry.kind === 'receive' ? 'in' : 'out'),
      account: entry.account || 'funding',
      to: entry.to || '', from: entry.from || '',
      via: entry.via || '',                // Chat, Pay, Tip, P2P, Transfer…
      note: String(entry.note || '').slice(0, 120),
      value: isPriced(entry.sym) ? +value(entry.sym, entry.qty).toFixed(2) : null
    };
    const rows_ = ledger();
    rows_.unshift(e);
    try { localStorage.setItem(LEDGER_KEY, JSON.stringify(rows_.slice(0, MAX_LEDGER))); } catch (err) {}
    return e;
  }

  function clearLedger() { try { localStorage.removeItem(LEDGER_KEY); } catch (e) {} }

  /* ── Transfer, for any asset ─────────────────────────────────────── */
  /* The old one moved the quote currency and nothing else, so a coin
     tipped into Funding could never reach the trading desk. */
  function transfer(s, amount, from, to, opts) {
    const k = sym_(s), amt = num(amount);
    const a = from === 'spot' ? 'spot' : 'funding';
    const b = to === 'spot' ? 'spot' : 'funding';
    const o = opts || {};
    if (a === b) return { ok: false, msg: 'Pick two different accounts.' };
    if (amt <= 0) return { ok: false, msg: 'Enter an amount to transfer.' };
    if ((a === 'spot' || b === 'spot') && !hasTR()) return { ok: false, msg: 'The trading account is unavailable.' };
    const have = balanceOf(k, a);
    if (amt > have + 1e-12) {
      // Spot's balance here is what open orders haven't set aside; say so.
      const held = a === 'spot' && hasTR() && TR.lockedOf ? num(TR.lockedOf(k)) : 0;
      return { ok: false, msg: held > 1e-12
        ? `Spot has ${qty(have)} ${k} free — ${qty(held)} is held by open orders.`
        : `${ACCOUNTS[a].label} holds ${qty(have)} ${k}.` };
    }
    if (!rawDebit(k, amt, a)) return { ok: false, msg: 'The transfer could not be made.' };
    if (!rawCredit(k, amt, b)) { rawCredit(k, amt, a); return { ok: false, msg: 'The transfer could not be made.' }; }
    if (!o.silent) {
      record({ kind: 'transfer', sym: k, qty: amt, dir: 'move', from: ACCOUNTS[a].label, to: ACCOUNTS[b].label, via: 'Transfer' });
    }
    if (!o.quiet) repaint();
    return { ok: true, msg: `Moved ${qty(amt)} ${k} to ${ACCOUNTS[b].label}` };
  }

  /* ── Paying ──────────────────────────────────────────────────────── */
  /* Funding first — it is the payments account. If it is short and Spot
     has the rest, the difference moves across and the receipt says so,
     which is what an exchange does when you pay from the wrong pocket.
     Pass `sweep: false` to refuse rather than move anything. */
  function spend(s, amount, opts) {
    const k = sym_(s), amt = num(amount), o = opts || {};
    if (!k) return { ok: false, msg: 'Pick a coin.' };
    if (amt <= 0) return { ok: false, msg: 'Enter an amount.' };
    if (!isPriced(k) && !o.allowUnpriced) {
      return { ok: false, msg: `${k} has no price right now, so it can't be sent.` };
    }

    const inFunding = balanceOf(k, 'funding');
    const inSpot = balanceOf(k, 'spot');
    const sweep = o.sweep !== false;

    if (amt > inFunding + (sweep ? inSpot : 0) + 1e-12) {
      const where = inSpot > 0 && !sweep
        ? `Funding holds ${qty(inFunding)} ${k} (${qty(inSpot)} is in Spot).`
        : `You hold ${qty(inFunding + (sweep ? inSpot : 0))} ${k}.`;
      return { ok: false, msg: `Not enough ${k}. ${where}` };
    }

    let moved = 0;
    if (amt > inFunding + 1e-12) {
      moved = Math.min(inSpot, amt - inFunding);
      const mv = transfer(k, moved, 'spot', 'funding', { silent: true, quiet: true });
      if (!mv.ok) return mv;
      record({ kind: 'transfer', sym: k, qty: moved, dir: 'move', from: 'Spot', to: 'Funding', via: 'Auto top-up', note: 'Covering a payment' });
    }
    if (!rawDebit(k, amt, 'funding')) {
      if (moved > 0) transfer(k, moved, 'funding', 'spot', { silent: true, quiet: true });
      return { ok: false, msg: 'The payment could not be made.' };
    }
    record({ kind: o.kind || 'spend', sym: k, qty: amt, dir: 'out', to: o.to || '', via: o.via || '', note: o.note || '' });
    repaint();
    return {
      ok: true, moved,
      msg: moved > 0 ? `Sent ${qty(amt)} ${k} — ${qty(moved)} moved from Spot to cover it` : `Sent ${qty(amt)} ${k}`
    };
  }

  /* Money coming in. Counterparties in this app are simulated, so their
     payments run through chat crypto's daily ceiling — otherwise every
     Request button is a mint and the portfolio stops meaning anything. */
  function receive(s, amount, opts) {
    const k = sym_(s), amt = num(amount), o = opts || {};
    if (amt <= 0) return { ok: false, msg: 'Nothing to receive.' };
    if (o.simulated !== false) {
      const worth = value(k, amt);
      const room = (typeof CFI !== 'undefined' && CFI.takeInbound) ? CFI.takeInbound(worth) : true;
      if (!room) return { ok: false, msg: 'Daily settlement cap reached.', capped: true };
    }
    if (!rawCredit(k, amt, o.account === 'spot' ? 'spot' : 'funding')) return { ok: false, msg: 'Could not credit the account.' };
    record({ kind: o.kind || 'receive', sym: k, qty: amt, dir: 'in', account: o.account || 'funding', from: o.from || '', via: o.via || '', note: o.note || '' });
    repaint();
    return { ok: true, msg: `Received ${qty(amt)} ${k}` };
  }

  /* ── Reading the accounts ────────────────────────────────────────── */
  function mkRow(s, q, account, extra) {
    const k = sym_(s), qn = num(q), qt = quote(k);
    return {
      sym: k, qty: qn, account,
      px: qt.usd, val: qt.known ? qt.usd * qn : 0,
      priced: qt.known, live: qt.live, reference: qt.reference,
      change24h: qt.change24h, name: nameOf(k),
      ...(extra || {})
    };
  }

  function rows(account) {
    const acct = account === 'spot' ? 'spot' : 'funding';
    const out = [];
    if (acct === 'spot') {
      if (!hasTR()) return out;
      const T = TR.state;
      if (num(T.cash) > 0) out.push(mkRow('USDT', T.cash, acct, { cash: true }));
      Object.keys(T.holdings || {}).forEach(k => {
        const h = T.holdings[k];
        if (h && num(h.qty) > 0) out.push(mkRow(k, h.qty, acct, { avgCost: num(h.avgCost) }));
      });
    } else {
      const b = fundingStore() || {};
      Object.keys(b).forEach(k => { if (num(b[k]) > 0) out.push(mkRow(k, b[k], acct, {})); });
    }
    return out.sort((x, y) => y.val - x.val || x.sym.localeCompare(y.sym));
  }

  /* Both accounts, one line per coin — the way a person thinks about
     what they own. `parts` keeps where it actually sits. */
  function holdings() {
    const by = new Map();
    ['funding', 'spot'].forEach(acct => rows(acct).forEach(r => {
      const cur = by.get(r.sym);
      if (!cur) {
        by.set(r.sym, { ...r, account: 'all', parts: { [acct]: r.qty }, pnlQty: r.avgCost > 0 ? r.qty : 0 });
        return;
      }
      cur.qty += r.qty;
      cur.val += r.val;
      cur.parts[acct] = (cur.parts[acct] || 0) + r.qty;
      if (r.avgCost > 0) { cur.avgCost = r.avgCost; cur.px = r.px; cur.pnlQty = num(cur.pnlQty) + r.qty; }
      if (r.cash) cur.cash = true;
    }));
    return [...by.values()].sort((a, b) => b.val - a.val || a.sym.localeCompare(b.sym));
  }

  /* Totals count what the app can price. Unpriced coins are reported
     separately so the number stays true and the holding stays visible. */
  function total(account) {
    const list = account ? rows(account) : holdings();
    let val = 0, unpriced = 0;
    list.forEach(r => { if (r.priced) val += r.val; else unpriced++; });
    return { value: val, unpriced, rows: list };
  }

  function earnTotal() {
    if (!hasEN()) return 0;
    try { return num(EN.totalEarning && EN.totalEarning()); } catch (e) { return 0; }
  }

  /* Everything across every account — the one figure the home screen,
     the Assets page and the Wallet tab all now read. */
  function netWorth() {
    const t = total();
    const earn = earnTotal();
    return { total: t.value + earn, wallet: t.value, earn, unpriced: t.unpriced, rows: t.rows };
  }

  /* The day's move on what you hold. Cash doesn't move, so a mostly-cash
     balance correctly shows a small percentage. */
  function dayMove(list) {
    const rs = list || holdings();
    let now = 0, then = 0;
    rs.forEach(r => {
      if (!r.priced || !r.live || STABLE[r.sym]) return;
      const ch = num(r.change24h);
      now += r.val;
      then += r.val / (1 + ch / 100);
    });
    const abs = now - then;
    return { abs, pct: then > 0 ? (abs / then) * 100 : 0 };
  }

  /* What you can choose in a payment picker: held first, then anything
     the app can price. One list, so chat and Pay can never disagree
     about which coins exist. */
  function assets(opts) {
    const o = opts || {};
    const held = holdings().filter(r => r.priced || o.includeUnpriced).map(r => r.sym);
    const liveKeys = Object.keys(liveMap()).filter(s => quote(s).known);
    const extra = ['USDT', ...Object.keys(REFERENCE), ...liveKeys.sort()];
    const seen = new Set(), out = [];
    held.concat(extra).forEach(s => { const k = sym_(s); if (k && !seen.has(k)) { seen.add(k); out.push(k); } });
    return o.limit ? out.slice(0, o.limit) : out;
  }

  /* ── Repaint ─────────────────────────────────────────────────────── */
  /* Money moved, so every open surface showing a balance is now stale.
     Each one is asked politely and none of them is required to exist. */
  function repaint() {
    try { if (hasTR() && TR.repaint) TR.repaint(); } catch (e) {}
    try { if (typeof AS !== 'undefined' && AS.repaint) AS.repaint(); } catch (e) {}
    try { if (typeof HX !== 'undefined' && HX.repaint) HX.repaint(); } catch (e) {}
    try { if (typeof window.repaintWalletTab === 'function') window.repaintWalletTab(); } catch (e) {}
    try { if (typeof window.updateTipSummary === 'function' && document.getElementById('tip-summary')) window.updateTipSummary(); } catch (e) {}
  }

  return {
    quote, price, isPriced, isLive, isReference, value, nameOf,
    usd, qty, valueLabel,
    balanceOf, spendable, transfer, spend, receive,
    rows, holdings, total, netWorth, earnTotal, dayMove, assets,
    ledger, record, clearLedger, repaint,
    get ACCOUNTS() { return ACCOUNTS; },
    get REFERENCE() { return REFERENCE; },
    get STABLE() { return STABLE; }
  };
})();

window.MNY = MNY;

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
publish('features/money.js', {
  MNY: () => MNY
});
