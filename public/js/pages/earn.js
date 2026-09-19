/* ╔══════════════════════════════════════════════════════════════════╗
   ║  EARN — the three yield surfaces, one destination                ║
   ║                                                                  ║
   ║   1. Copy Trading  — mirror a trader's spot orders into your     ║
   ║                      own book at a chosen allocation, they take  ║
   ║                      a profit share on the way out               ║
   ║   2. Staking       — flexible savings you can redeem any time,   ║
   ║                      plus locked terms at a higher rate          ║
   ║   3. Launchpool    — farm a new listing with idle stake, and     ║
   ║                      Learn & Earn quizzes that pay per answer    ║
   ║                                                                  ║
   ║  Every leg settles through the TR paper ledger — Earn keeps no   ║
   ║  balance of its own, so a stake leaves Portfolio the moment it   ║
   ║  is made and interest lands there as it accrues.                 ║
   ║                                                                  ║
   ║  Yield accrues on the 30s price poll, pro-rated from real        ║
   ║  elapsed time, so closing the tab doesn't mint or lose interest. ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const EN = (() => {

  const KEY = 'ts_earn';
  const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

  const PERF_FEE = 0.10;          // trader's cut of copy profit, on close
  const MIN_COPY = 100;           // USDT
  const QUIZ_REWARD = 5;          // USDT per correct answer

  /* ── Catalogue ───────────────────────────────────────────────────── */
  /* Flexible pays less and redeems instantly; locked pays more and is
     held to term. Same shape as every exchange's Earn shelf. */
  const PRODUCTS = [
    { id: 'usdt-flex', coin: 'USDT', type: 'flexible', apy: 4.2,  min: 10,   term: 0 },
    { id: 'usdt-30',   coin: 'USDT', type: 'locked',   apy: 8.5,  min: 100,  term: 30 },
    { id: 'usdt-90',   coin: 'USDT', type: 'locked',   apy: 12.0, min: 500,  term: 90 },
    { id: 'btc-flex',  coin: 'BTC',  type: 'flexible', apy: 1.8,  min: 0.001, term: 0 },
    { id: 'eth-flex',  coin: 'ETH',  type: 'flexible', apy: 2.6,  min: 0.01, term: 0 },
    { id: 'eth-60',    coin: 'ETH',  type: 'locked',   apy: 5.4,  min: 0.1,  term: 60 },
    { id: 'sol-flex',  coin: 'SOL',  type: 'flexible', apy: 6.1,  min: 0.5,  term: 0 },
    { id: 'sol-90',    coin: 'SOL',  type: 'locked',   apy: 9.8,  min: 5,    term: 90 }
  ];

  /* Traders are Earn's own roster — Trending Creators in Cryptoverse is a
     separate surface and is deliberately left alone. */
  const TRADERS = [
    { id: 't1', name: 'Aria Volkov',  handle: '@ariav',   style: 'Momentum',    coins: ['BTC', 'ETH', 'SOL'],  roi30: 24.6, win: 68, copiers: 1840, risk: 'Medium', aum: 412000 },
    { id: 't2', name: 'Kenji Sato',   handle: '@kenjis',  style: 'Mean revert', coins: ['ETH', 'LINK'],        roi30: 11.2, win: 74, copiers: 3120, risk: 'Low',    aum: 908000 },
    { id: 't3', name: 'Nadia Rahman', handle: '@nadiar',  style: 'Breakout',    coins: ['SOL', 'AVAX', 'INJ'], roi30: 41.8, win: 55, copiers: 760,  risk: 'High',   aum: 155000 },
    { id: 't4', name: 'Theo Marsh',   handle: '@theom',   style: 'Blue chip',   coins: ['BTC', 'ETH'],         roi30: 8.4,  win: 71, copiers: 5240, risk: 'Low',    aum: 1740000 },
    { id: 't5', name: 'Priya Anand',  handle: '@priyaa',  style: 'Rotation',    coins: ['BTC', 'SOL', 'DOT'],  roi30: 18.9, win: 63, copiers: 2270, risk: 'Medium', aum: 623000 },
    { id: 't6', name: 'Luca Bianchi', handle: '@lucab',   style: 'Scalper',     coins: ['BTC', 'ETH', 'XRP'],  roi30: 31.5, win: 59, copiers: 1105, risk: 'High',   aum: 288000 }
  ];

  const POOLS = [
    { id: 'p1', sym: 'TREND', name: 'Trending Token', stakeCoin: 'USDT', apy: 34.0, days: 30, raised: 0.62, total: 2000000 },
    { id: 'p2', sym: 'ARB',   name: 'Arbitrum',       stakeCoin: 'ETH',  apy: 18.5, days: 14, raised: 0.81, total: 900000 },
    { id: 'p3', sym: 'JUP',   name: 'Jupiter',        stakeCoin: 'SOL',  apy: 22.7, days: 21, raised: 0.44, total: 1500000 }
  ];

  const QUIZZES = [
    { id: 'q1', topic: 'What is a liquid staking token?',
      opts: ['A receipt token you can trade while your stake stays locked',
             'A coin that automatically sells itself',
             'A stablecoin backed by staked cash'], answer: 0, coin: 'USDT' },
    { id: 'q2', topic: 'What does APY include that APR does not?',
      opts: ['Exchange fees', 'Compounding of earned interest', 'Gas costs'], answer: 1, coin: 'USDT' },
    { id: 'q3', topic: 'In copy trading, what is a performance fee?',
      opts: ['A flat monthly subscription',
             'A share of your profit paid to the trader you copy',
             'The spread on every order'], answer: 1, coin: 'USDT' },
    { id: 'q4', topic: 'What is impermanent loss?',
      opts: ['A tax on unrealised gains',
             'Value lost to a failed transaction',
             'The gap between holding two assets and pooling them as liquidity'], answer: 2, coin: 'USDT' },
    { id: 'q5', topic: 'Why does a locked staking product pay more than flexible?',
      opts: ['You give up the right to redeem early',
             'It is insured by the exchange',
             'It compounds hourly instead of daily'], answer: 0, coin: 'USDT' }
  ];

  const DEFAULT = { tab: 'copy', stakes: [], copies: [], pools: [], quizDone: [], pending: {}, lastAccrual: 0, feesPaid: 0 };

  let E = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(E)); } catch (e) {} }

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const ic = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');
  const hasTR = () => typeof TR !== 'undefined';

  function priceOf(sym) {
    if (sym === 'USDT') return 1;
    if (sym === 'TREND') return 0.42;             // pre-listing reference price
    const c = (window.liveCryptoPrices || {})[sym];
    return c ? c.usd : 0;
  }

  function usd(v) {
    if (!v && v !== 0) return '$0.00';
    const a = Math.abs(v);
    if (a > 0 && a < 0.01) return (v < 0 ? '-$' : '$') + a.toFixed(6);
    return (v < 0 ? '-$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function qty(v) {
    if (!v) return '0';
    if (Math.abs(v) < 0.0001) return v.toExponential(2);
    return v.toLocaleString('en-US', { maximumFractionDigits: 8 });
  }

  /* Accrued interest is a tiny fraction of a coin, so full 8dp precision
     reads as noise. Scale the decimals to the magnitude instead. */
  function qtyS(v) {
    const a = Math.abs(v || 0);
    if (!a) return '0';
    if (a >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (a >= 1)    return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
    if (a >= 0.0001) return v.toFixed(6);
    return v.toExponential(2);
  }

  const pct = v => (v >= 0 ? '+' : '') + (v || 0).toFixed(2) + '%';
  const days = ms => Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));

  /* ── Accrual ─────────────────────────────────────────────────────── */
  /* Driven by wall-clock delta rather than tick count, so a slow poll,
     a backgrounded tab or a closed browser all pay the same interest for
     the same elapsed time. */
  function accrue() {
    const now = Date.now();
    if (!E.lastAccrual) { E.lastAccrual = now; save(); return; }
    const dt = now - E.lastAccrual;
    if (dt < 1000) return;
    E.lastAccrual = now;

    let credited = 0;

    E.stakes.forEach(s => {
      if (s.status !== 'active') return;
      const p = PRODUCTS.find(x => x.id === s.productId);
      if (!p) return;
      const earned = s.amount * (p.apy / 100) * (dt / YEAR_MS);
      s.accrued += earned;
      credited += earned * priceOf(s.coin);
      if (p.term && now >= s.maturesAt) s.status = 'matured';
    });

    E.pools.forEach(p => {
      if (p.status !== 'active') return;
      const pool = POOLS.find(x => x.id === p.poolId);
      if (!pool) return;
      const value = p.amount * priceOf(p.stakeCoin);
      const rewardUsd = value * (pool.apy / 100) * (dt / YEAR_MS);
      p.farmed += rewardUsd / (priceOf(pool.sym) || 1);
      if (now >= p.endsAt) p.status = 'ended';
    });

    // Copy positions track their trader's live P&L against the coins they run.
    E.copies.forEach(c => {
      if (c.status !== 'active') return;
      const t = TRADERS.find(x => x.id === c.traderId);
      if (!t) return;
      c.value = c.allocation * (1 + traderReturn(t, c.openedAt) / 100);
    });

    save();
    void credited;
  }

  /* A trader's return since you started copying: their coins' real 24h moves,
     scaled by their style. Live data drives it — nothing is invented. */
  function traderReturn(t, since) {
    const live = window.liveCryptoPrices || {};
    const moves = t.coins.map(s => (live[s] ? (live[s].change24h || live[s].usd_24h_change || 0) : 0));
    if (!moves.length) return 0;
    const avg = moves.reduce((a, b) => a + b, 0) / moves.length;
    const beta = t.risk === 'High' ? 1.6 : t.risk === 'Medium' ? 1.1 : 0.7;
    const heldDays = Math.max(0, (Date.now() - (since || Date.now())) / (24 * 60 * 60 * 1000));
    return avg * beta * Math.min(1, 0.35 + heldDays);
  }

  /* ── 1. Copy trading ─────────────────────────────────────────────── */
  function startCopy(traderId, allocation) {
    const t = TRADERS.find(x => x.id === traderId);
    const amt = parseFloat(allocation);
    if (!t) return { ok: false, msg: 'Unknown trader.' };
    if (!hasTR()) return { ok: false, msg: 'Trading account unavailable.' };
    if (!amt || amt < MIN_COPY) return { ok: false, msg: `Minimum allocation is ${usd(MIN_COPY)}.` };
    if (E.copies.some(c => c.traderId === traderId && c.status === 'active'))
      return { ok: false, msg: `You're already copying ${t.name}.` };

    const have = TR.availableOf('USDT');
    if (amt > have + 1e-9) return { ok: false, msg: `Insufficient USDT — you hold ${qty(have)}.` };
    if (!TR.debitAsset('USDT', amt)) return { ok: false, msg: 'Debit failed.' };

    E.copies.push({
      id: 'c' + Date.now(), traderId, allocation: amt, value: amt,
      openedAt: Date.now(), status: 'active'
    });
    save(); TR.repaint(); repaint();
    return { ok: true, msg: `Copying ${t.name} with ${usd(amt)}` };
  }

  /* Closing settles the position back to cash. The trader's cut applies to
     profit only — a losing copy pays no fee. */
  function stopCopy(id) {
    const c = E.copies.find(x => x.id === id);
    if (!c || c.status !== 'active') return;
    const t = TRADERS.find(x => x.id === c.traderId);

    const gross = c.value;
    const profit = gross - c.allocation;
    const fee = profit > 0 ? profit * PERF_FEE : 0;
    const net = gross - fee;

    if (hasTR()) { TR.creditAsset('USDT', net, 1); TR.repaint(); }
    c.status = 'closed';
    c.closedAt = Date.now();
    c.realised = net - c.allocation;
    c.fee = fee;
    E.feesPaid += fee;
    save(); repaint();
    toast(profit > 0
      ? `Closed — ${usd(net)} returned, ${usd(fee)} performance fee to ${t ? t.name : 'trader'}`
      : `Closed — ${usd(net)} returned, no fee on a loss`);
  }

  /* ── 2. Staking & savings ────────────────────────────────────────── */
  function stake(productId, amount) {
    const p = PRODUCTS.find(x => x.id === productId);
    const amt = parseFloat(amount);
    if (!p) return { ok: false, msg: 'Unknown product.' };
    if (!hasTR()) return { ok: false, msg: 'Trading account unavailable.' };
    if (!amt || amt < p.min) return { ok: false, msg: `Minimum is ${qty(p.min)} ${p.coin}.` };

    const have = TR.availableOf(p.coin);
    if (amt > have + 1e-12) return { ok: false, msg: `Insufficient ${p.coin} — you hold ${qty(have)}.` };
    if (!TR.debitAsset(p.coin, amt)) return { ok: false, msg: 'Debit failed.' };

    E.stakes.push({
      id: 's' + Date.now(), productId, coin: p.coin, amount: amt, accrued: 0,
      startedAt: Date.now(), maturesAt: p.term ? Date.now() + p.term * 86400000 : 0,
      status: 'active'
    });
    save(); TR.repaint(); repaint();
    return { ok: true, msg: `Staked ${qty(amt)} ${p.coin} at ${p.apy}% APY` };
  }

  /* Locked terms redeemed early forfeit accrued interest but return the
     principal — the standard penalty, and the reason the rate is higher. */
  function redeem(id) {
    const s = E.stakes.find(x => x.id === id);
    if (!s || s.status === 'redeemed') return;
    const p = PRODUCTS.find(x => x.id === s.productId);
    const early = p && p.term && Date.now() < s.maturesAt;
    const interest = early ? 0 : s.accrued;

    if (hasTR()) {
      TR.creditAsset(s.coin, s.amount + interest, priceOf(s.coin));
      TR.repaint();
    }
    s.status = 'redeemed';
    s.redeemedAt = Date.now();
    s.paidInterest = interest;
    save(); repaint();
    toast(early
      ? `Redeemed early — ${qty(s.amount)} ${s.coin} principal returned, interest forfeited`
      : `Redeemed ${qty(s.amount + interest)} ${s.coin} (${qty(interest)} interest)`);
  }

  /* ── 3. Launchpool & Learn ───────────────────────────────────────── */
  function joinPool(poolId, amount) {
    const pool = POOLS.find(x => x.id === poolId);
    const amt = parseFloat(amount);
    if (!pool) return { ok: false, msg: 'Unknown pool.' };
    if (!hasTR()) return { ok: false, msg: 'Trading account unavailable.' };
    if (!amt || amt <= 0) return { ok: false, msg: 'Enter an amount.' };

    const have = TR.availableOf(pool.stakeCoin);
    if (amt > have + 1e-12) return { ok: false, msg: `Insufficient ${pool.stakeCoin} — you hold ${qty(have)}.` };
    if (!TR.debitAsset(pool.stakeCoin, amt)) return { ok: false, msg: 'Debit failed.' };

    E.pools.push({
      id: 'lp' + Date.now(), poolId, stakeCoin: pool.stakeCoin, amount: amt,
      farmed: 0, startedAt: Date.now(), endsAt: Date.now() + pool.days * 86400000, status: 'active'
    });
    save(); TR.repaint(); repaint();
    return { ok: true, msg: `Farming ${pool.sym} with ${qty(amt)} ${pool.stakeCoin}` };
  }

  /* Unstaking always returns the stake in full. The farmed reward only
     reaches the Portfolio if the desk can price it — TREND is pre-listing,
     and crediting an unpriceable token would show the reward as a $0.00
     holding at -100%. Those sit in `pending` until the token lists, which
     is how a real launchpool settles anyway. */
  function exitPool(id) {
    const p = E.pools.find(x => x.id === id);
    if (!p || p.status === 'exited') return;
    const pool = POOLS.find(x => x.id === p.poolId);
    const sym = pool ? pool.sym : '';
    const listed = hasTR() && TR.isTradable(sym);

    if (hasTR()) {
      TR.creditAsset(p.stakeCoin, p.amount, priceOf(p.stakeCoin));
      if (listed && p.farmed > 0) TR.creditAsset(sym, p.farmed, priceOf(sym));
      TR.repaint();
    }
    if (!listed && p.farmed > 0) E.pending[sym] = (E.pending[sym] || 0) + p.farmed;

    p.status = 'exited';
    save(); repaint();
    toast(listed
      ? `Unstaked ${qty(p.amount)} ${p.stakeCoin} · ${qty(p.farmed)} ${sym} credited`
      : `Unstaked ${qty(p.amount)} ${p.stakeCoin} · ${qty(p.farmed)} ${sym} held until listing`);
  }

  /* Once a pre-listing token appears in the live feed it becomes a normal
     holding, so the pending balance can be moved into the Portfolio. */
  function claimPending(sym) {
    const amt = E.pending[sym] || 0;
    if (!amt) return;
    if (!hasTR() || !TR.isTradable(sym)) { toast(`${sym} hasn't listed yet.`); return; }
    TR.creditAsset(sym, amt, priceOf(sym));
    delete E.pending[sym];
    save(); TR.repaint(); repaint();
    toast(`Claimed ${qty(amt)} ${sym} into your Portfolio`);
  }

  function answerQuiz(quizId, choice) {
    const q = QUIZZES.find(x => x.id === quizId);
    if (!q) return;
    if (E.quizDone.includes(quizId)) { toast('Already completed.'); return; }

    if (choice !== q.answer) {
      toast('Not quite — read the explanation and try again.');
      return;
    }
    E.quizDone.push(quizId);
    if (hasTR()) { TR.creditAsset(q.coin, QUIZ_REWARD, 1); TR.repaint(); }
    save(); repaint();
    toast(`Correct — ${usd(QUIZ_REWARD)} ${q.coin} credited`);
  }

  /* ── Totals ──────────────────────────────────────────────────────── */
  function stakedValue() {
    return E.stakes.filter(s => s.status !== 'redeemed')
      .reduce((t, s) => t + (s.amount + s.accrued) * priceOf(s.coin), 0);
  }
  function copyValue() {
    return E.copies.filter(c => c.status === 'active').reduce((t, c) => t + c.value, 0);
  }
  function poolValue() {
    return E.pools.filter(p => p.status !== 'exited')
      .reduce((t, p) => t + p.amount * priceOf(p.stakeCoin), 0);
  }
  function accruedValue() {
    return E.stakes.filter(s => s.status !== 'redeemed')
      .reduce((t, s) => t + s.accrued * priceOf(s.coin), 0);
  }
  const totalEarning = () => stakedValue() + copyValue() + poolValue();

  /* Blended APY across everything at work — what the headline number means. */
  function blendedApy() {
    const parts = [];
    E.stakes.filter(s => s.status !== 'redeemed').forEach(s => {
      const p = PRODUCTS.find(x => x.id === s.productId);
      if (p) parts.push([s.amount * priceOf(s.coin), p.apy]);
    });
    E.pools.filter(p => p.status !== 'exited').forEach(p => {
      const pool = POOLS.find(x => x.id === p.poolId);
      if (pool) parts.push([p.amount * priceOf(p.stakeCoin), pool.apy]);
    });
    const base = parts.reduce((t, [v]) => t + v, 0);
    if (!base) return 0;
    return parts.reduce((t, [v, a]) => t + v * a, 0) / base;
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  function setTab(t) { E.tab = t; save(); repaint(); }

  function repaint() {
    const root = document.getElementById('en-root');
    if (!root) return;
    accrue();

    const tabs = [
      ['copy',  'Copy Trading', 'group'],
      ['stake', 'Staking',      'savings'],
      ['pool',  'Launchpool',   'rocket_launch']
    ];

    root.innerHTML = `
      ${summaryHTML()}
      <div class="en-tabs">
        ${tabs.map(([k, l, i]) => `
          <button class="en-tab${E.tab === k ? ' active' : ''}" onclick="EN.setTab('${k}')">
            <span class="material-symbols-rounded ms-18">${i}</span>${l}
          </button>`).join('')}
      </div>
      <div class="en-body">${
        E.tab === 'copy' ? copyHTML() : E.tab === 'stake' ? stakeHTML() : poolHTML()
      }</div>`;
  }

  function summaryHTML() {
    const cards = [
      ['At work',      usd(totalEarning()),   'Principal across all three'],
      ['Accrued',      usd(accruedValue()),   'Interest not yet redeemed'],
      ['Blended APY',  blendedApy().toFixed(2) + '%', 'Weighted by amount staked'],
      ['Fees paid',    usd(E.feesPaid),       'Performance fees to traders']
    ];
    return `<div class="en-summary">
      ${cards.map(([l, v, s]) => `
        <div class="en-sum">
          <div class="en-sum-l">${esc(l)}</div>
          <div class="en-sum-v">${esc(v)}</div>
          <div class="en-sum-s">${esc(s)}</div>
        </div>`).join('')}
    </div>`;
  }

  /* ── Copy trading pane ───────────────────────────────────────────── */
  function copyHTML() {
    const active = E.copies.filter(c => c.status === 'active');
    const closed = E.copies.filter(c => c.status === 'closed').slice(-4).reverse();

    const mine = active.length ? `
      <h3 class="en-h">Your copies</h3>
      <div class="en-list">
        ${active.map(c => {
          const t = TRADERS.find(x => x.id === c.traderId) || {};
          const pnl = c.value - c.allocation;
          const pnlPct = c.allocation ? (pnl / c.allocation) * 100 : 0;
          const fee = pnl > 0 ? pnl * PERF_FEE : 0;
          return `<div class="en-row">
            <div class="en-row-main">
              <div class="en-row-t">${esc(t.name || 'Trader')}</div>
              <div class="en-row-s">${usd(c.allocation)} allocated · ${days(Date.now() - c.openedAt) - 1 || 0}d open</div>
            </div>
            <div class="en-row-num">
              <div class="${pnl >= 0 ? 'tc-green' : 'tc-red'}">${usd(c.value)}</div>
              <div class="en-row-s ${pnl >= 0 ? 'tc-green' : 'tc-red'}">${pct(pnlPct)}</div>
            </div>
            <div class="en-row-act">
              <div class="en-row-s">${fee > 0 ? `fee ${usd(fee)}` : 'no fee'}</div>
              <button class="btn btn-ghost btn-sm" onclick="EN.stopCopy('${c.id}')">Close</button>
            </div>
          </div>`;
        }).join('')}
      </div>` : '';

    const history = closed.length ? `
      <h3 class="en-h">Closed</h3>
      <div class="en-list">
        ${closed.map(c => {
          const t = TRADERS.find(x => x.id === c.traderId) || {};
          return `<div class="en-row">
            <div class="en-row-main">
              <div class="en-row-t">${esc(t.name || 'Trader')}</div>
              <div class="en-row-s">${usd(c.allocation)} allocated · fee ${usd(c.fee || 0)}</div>
            </div>
            <div class="en-row-num ${c.realised >= 0 ? 'tc-green' : 'tc-red'}">${usd(c.realised)}</div>
          </div>`;
        }).join('')}
      </div>` : '';

    const board = TRADERS.slice().sort((a, b) => b.roi30 - a.roi30).map(t => {
      const copying = active.some(c => c.traderId === t.id);
      const liveRet = traderReturn(t, Date.now());
      return `<div class="en-trader">
        <div class="en-trader-top">
          <div class="en-av">${esc(t.name.split(' ').map(w => w[0]).join(''))}</div>
          <div class="en-trader-id">
            <div class="en-row-t">${esc(t.name)}</div>
            <div class="en-row-s">${esc(t.handle)} · ${esc(t.style)}</div>
          </div>
          <span class="en-risk en-risk-${t.risk.toLowerCase()}">${esc(t.risk)}</span>
        </div>
        <div class="en-stats">
          <div><b class="${t.roi30 >= 0 ? 'tc-green' : 'tc-red'}">${pct(t.roi30)}</b><span>30d ROI</span></div>
          <div><b>${t.win}%</b><span>Win rate</span></div>
          <div><b>${t.copiers.toLocaleString()}</b><span>Copiers</span></div>
          <div><b>${usd(t.aum).replace('.00', '')}</b><span>Copy AUM</span></div>
        </div>
        <div class="en-coins">
          ${t.coins.map(s => `<span class="en-coin">${ic(s, 14)}${esc(s)}</span>`).join('')}
          <span class="en-row-s" style="margin-left:auto">today ${
            `<b class="${liveRet >= 0 ? 'tc-green' : 'tc-red'}">${pct(liveRet)}</b>`}</span>
        </div>
        ${copying
          ? '<button class="btn btn-ghost btn-sm en-cta" disabled>Copying</button>'
          : `<div class="en-copy-form">
               <input class="en-input" type="number" step="any" placeholder="${MIN_COPY} min" id="en-alloc-${t.id}">
               <button class="btn btn-primary btn-sm" onclick="EN.startCopyFrom('${t.id}')">Copy</button>
             </div>`}
      </div>`;
    }).join('');

    return `${mine}
      <h3 class="en-h">Top traders</h3>
      <div class="en-note">
        Copies mirror the trader's coins against live prices and settle to your paper
        balance. ${(PERF_FEE * 100).toFixed(0)}% performance fee on profit only — a losing copy pays nothing.
      </div>
      <div class="en-traders">${board}</div>
      ${history}`;
  }

  function startCopyFrom(traderId) {
    const el = document.getElementById('en-alloc-' + traderId);
    const res = startCopy(traderId, el ? el.value : 0);
    toast(res.msg);
  }

  /* ── Staking pane ────────────────────────────────────────────────── */
  function stakeHTML() {
    const open = E.stakes.filter(s => s.status !== 'redeemed');

    const positions = open.length ? `
      <h3 class="en-h">Your stakes</h3>
      <div class="en-list">
        ${open.map(s => {
          const p = PRODUCTS.find(x => x.id === s.productId) || {};
          const locked = p.term && Date.now() < s.maturesAt;
          return `<div class="en-row">
            <div class="en-row-main">
              <div class="en-row-t">${ic(s.coin, 16)} ${qty(s.amount)} ${esc(s.coin)}</div>
              <div class="en-row-s">${p.type === 'locked' ? `${p.term}-day locked` : 'Flexible'} · ${p.apy}% APY</div>
            </div>
            <div class="en-row-num">
              <div class="tc-green">+${qtyS(s.accrued)}</div>
              <div class="en-row-s">${usd(s.accrued * priceOf(s.coin))} earned</div>
            </div>
            <div class="en-row-act">
              <div class="en-row-s">${locked ? `${days(s.maturesAt - Date.now())}d left` : 'Any time'}</div>
              <button class="btn btn-ghost btn-sm" onclick="EN.redeem('${s.id}')">
                ${locked ? 'Redeem early' : 'Redeem'}</button>
            </div>
          </div>`;
        }).join('')}
      </div>` : '';

    const shelf = PRODUCTS.map(p => {
      const bal = hasTR() ? TR.availableOf(p.coin) : 0;
      const live = priceOf(p.coin) > 0;
      return `<div class="en-prod${live ? '' : ' en-prod-off'}">
        <div class="en-prod-top">
          ${ic(p.coin, 26)}
          <div>
            <div class="en-row-t">${esc(p.coin)}</div>
            <div class="en-row-s">${p.type === 'locked' ? `${p.term} days locked` : 'Flexible · redeem any time'}</div>
          </div>
          <div class="en-apy">${p.apy}%<span>APY</span></div>
        </div>
        <div class="en-row-s">Min ${qty(p.min)} ${esc(p.coin)} · you hold ${qty(bal)}</div>
        ${live ? `<div class="en-copy-form">
          <input class="en-input" type="number" step="any" placeholder="${qty(p.min)} min" id="en-stake-${p.id}">
          <button class="btn btn-primary btn-sm" onclick="EN.stakeFrom('${p.id}')">Stake</button>
        </div>` : '<div class="en-row-s tc-3">No live price — unavailable</div>'}
      </div>`;
    }).join('');

    return `${positions}
      <h3 class="en-h">Products</h3>
      <div class="en-note">
        Staked coin leaves your Portfolio immediately and interest accrues from real elapsed
        time, not tick count. Locked terms redeemed early return principal but forfeit interest.
      </div>
      <div class="en-prods">${shelf}</div>`;
  }

  function stakeFrom(productId) {
    const el = document.getElementById('en-stake-' + productId);
    const res = stake(productId, el ? el.value : 0);
    toast(res.msg);
  }

  /* ── Launchpool pane ─────────────────────────────────────────────── */
  function poolHTML() {
    const open = E.pools.filter(p => p.status !== 'exited');

    const mine = open.length ? `
      <h3 class="en-h">Your farms</h3>
      <div class="en-list">
        ${open.map(p => {
          const pool = POOLS.find(x => x.id === p.poolId) || {};
          return `<div class="en-row">
            <div class="en-row-main">
              <div class="en-row-t">${esc(pool.sym || '')} pool</div>
              <div class="en-row-s">${qty(p.amount)} ${esc(p.stakeCoin)} staked · ${pool.apy}% APY</div>
            </div>
            <div class="en-row-num">
              <div class="tc-green">${qtyS(p.farmed)} ${esc(pool.sym || '')}</div>
              <div class="en-row-s">${usd(p.farmed * priceOf(pool.sym))} farmed</div>
            </div>
            <div class="en-row-act">
              <div class="en-row-s">${p.status === 'ended' ? 'Ended' : `${days(p.endsAt - Date.now())}d left`}</div>
              <button class="btn btn-ghost btn-sm" onclick="EN.exitPool('${p.id}')">Unstake</button>
            </div>
          </div>`;
        }).join('')}
      </div>` : '';

    const pools = POOLS.map(pool => {
      const bal = hasTR() ? TR.availableOf(pool.stakeCoin) : 0;
      return `<div class="en-prod">
        <div class="en-prod-top">
          ${ic(pool.sym, 26)}
          <div>
            <div class="en-row-t">${esc(pool.sym)}</div>
            <div class="en-row-s">${esc(pool.name)} · stake ${esc(pool.stakeCoin)}</div>
          </div>
          <div class="en-apy">${pool.apy}%<span>APY</span></div>
        </div>
        <div class="en-bar"><i style="width:${(pool.raised * 100).toFixed(0)}%"></i></div>
        <div class="en-row-s">${(pool.raised * 100).toFixed(0)}% of ${pool.total.toLocaleString()} ${esc(pool.sym)} allocated · ${pool.days} days · you hold ${qty(bal)} ${esc(pool.stakeCoin)}</div>
        <div class="en-copy-form">
          <input class="en-input" type="number" step="any" placeholder="Amount in ${esc(pool.stakeCoin)}" id="en-pool-${pool.id}">
          <button class="btn btn-primary btn-sm" onclick="EN.joinPoolFrom('${pool.id}')">Farm</button>
        </div>
      </div>`;
    }).join('');

    const quizzes = QUIZZES.map(q => {
      const done = E.quizDone.includes(q.id);
      return `<div class="en-quiz${done ? ' done' : ''}">
        <div class="en-quiz-q">
          <span class="material-symbols-rounded ms-18">${done ? 'task_alt' : 'quiz'}</span>
          ${esc(q.topic)}
        </div>
        ${done
          ? `<div class="en-row-s tc-green">Completed · ${usd(QUIZ_REWARD)} earned</div>`
          : `<div class="en-opts">
              ${q.opts.map((o, i) =>
                `<button class="en-opt" onclick="EN.answerQuiz('${q.id}',${i})">${esc(o)}</button>`).join('')}
            </div>`}
      </div>`;
    }).join('');

    const earned = E.quizDone.length * QUIZ_REWARD;

    const pendingSyms = Object.keys(E.pending).filter(s => E.pending[s] > 0);
    const pending = pendingSyms.length ? `
      <h3 class="en-h">Awaiting listing</h3>
      <div class="en-note">
        Farmed before the token listed, so it has no market price yet and is held here
        rather than shown as a $0.00 line in your Portfolio. Claimable the moment it lists.
      </div>
      <div class="en-list">
        ${pendingSyms.map(s => {
          const listed = hasTR() && TR.isTradable(s);
          return `<div class="en-row">
            <div class="en-row-main">
              <div class="en-row-t">${ic(s, 16)} ${qtyS(E.pending[s])} ${esc(s)}</div>
              <div class="en-row-s">${listed ? 'Now listed — ready to claim' : 'Pre-listing · not yet tradable'}</div>
            </div>
            <div class="en-row-act">
              <button class="btn ${listed ? 'btn-primary' : 'btn-ghost'} btn-sm"
                      onclick="EN.claimPending('${esc(s)}')"${listed ? '' : ' disabled'}>Claim</button>
            </div>
          </div>`;
        }).join('')}
      </div>` : '';

    return `${mine}${pending}
      <h3 class="en-h">Launchpool</h3>
      <div class="en-note">
        Stake a coin you already hold to farm a new listing. Your stake is never
        converted — unstake returns it in full, plus whatever the pool farmed.
      </div>
      <div class="en-prods">${pools}</div>

      <h3 class="en-h">Learn &amp; Earn${earned ? ` · ${usd(earned)} earned` : ''}</h3>
      <div class="en-note">Answer correctly and ${usd(QUIZ_REWARD)} lands in your balance. One reward per question.</div>
      <div class="en-quizzes">${quizzes}</div>`;
  }

  function joinPoolFrom(poolId) {
    const el = document.getElementById('en-pool-' + poolId);
    const res = joinPool(poolId, el ? el.value : 0);
    toast(res.msg);
  }

  /* Yield keeps accruing whether or not the pane is open. */
  function onPriceTick() {
    accrue();
    if (document.getElementById('en-root')) repaint();
  }

  return {
    setTab, repaint, onPriceTick, accrue,
    startCopy, startCopyFrom, stopCopy,
    stake, stakeFrom, redeem,
    joinPool, joinPoolFrom, exitPool, claimPending, answerQuiz,
    totalEarning, accruedValue, blendedApy, stakedValue, copyValue, poolValue,
    PRODUCTS, TRADERS, POOLS, QUIZZES,
    get state() { return E; }
  };
})();

window.EN = EN;

/* ── Pane template & router hook ───────────────────────────────────── */
function getEarnTemplate() {
  return `<section id="pane-earn" class="pane">
    <h1 class="pane-title" style="display:flex; align-items:center; gap:10px">
      <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:#F0B90B">savings</span>
      <span>Earn</span>
    </h1>
    <div class="tr-banner">
      <span class="material-symbols-rounded ms-16">info</span>
      Paper yield. Copy trades, stakes and pools all settle against the same simulated
      balance as the trading desk — no real funds, no custody, no counterparty.
    </div>
    <div id="en-root"></div>
  </section>`;
}

function renderEarn() { EN.repaint(); }

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module now, so its top-level names are private
   to it. Inline onclick= handlers and every other module still look
   them up on the global object, so they are republished here.

   Each one is a thunk because the list is produced by scanning, and
   scanning over-collects — a line inside a template literal can look
   like a declaration. publish() calls each thunk and skips the ones
   that do not resolve, so a phantom costs one caught error and not a
   dead module graph. */
import { publish } from '../globals.js?v=2';
publish('pages/earn.js', {
  EN: () => EN, getEarnTemplate: () => getEarnTemplate,
  renderEarn: () => renderEarn
});
