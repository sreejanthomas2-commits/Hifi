// ── HOME FEED ────────────────────────────────────────────────────
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

function renderStories() {
  const el = $id('stories-row'); if (!el) return;
  const mine = (window.CR && CR.myStories) ? CR.myStories() : [];
  const last = mine[mine.length - 1];
  const myStory = last
    ? `<div class="story-item" onclick="CR.viewMyStory()"><div class="story-ring"><div class="story-inner" style="display:grid; place-items:center; overflow:hidden">${
        last.kind === 'image'
          ? `<img src="${escapeHTML(last.src)}" alt="" style="width:100%;height:100%;object-fit:cover">`
          : `<span class="material-symbols-rounded" style="color:var(--brand-hi)">amp_stories</span>`
      }</div></div><div class="story-name">Your Story</div></div>`
    : `<div class="story-item" onclick="CR.open('story')"><div class="story-ring"><div class="story-inner" style="font-size:18px;background:var(--card2);display:grid;place-items:center;"><span class="material-symbols-rounded" style="color:var(--t3)">add</span></div></div><div class="story-name">Your Story</div></div>`;
  const stories = DATA.stories.map(s => {
    const iconData = get3DIconForEmoji(s.emoji);
    return `
    <div class="story-item" onclick="viewStory('${s.name}')">
      <div class="story-ring${s.seen?' seen':''}">
        <div class="story-inner" style="display:grid; place-items:center;">
          <span class="material-symbols-rounded emoji-3d" style="font-size:22px; color:${iconData.color}">${iconData.icon}</span>
        </div>
      </div>
      <div class="story-name">${s.name}</div>
    </div>`;
  }).join('');
  el.innerHTML = myStory + stories;
}

function renderFeed(query = '') {
  const el = $id('feed-posts'); if (!el) return;
  const q = (query || ($id('global-search') ? $id('global-search').value : '')).toLowerCase();
  
  // Render the universal ticker
  renderUniversalTicker();

  let posts = DATA.posts;

  // Dual feed filter
  if (S.dualFeed === 'growth') {
    posts = posts.filter(p => ['tech','fitness','science','motivation','agriculture'].includes(p.category));
  }
  if (window.HX && HX.filterPosts) posts = HX.filterPosts(posts);
  
  const filtered = posts.filter(p => !q || p.body.toLowerCase().includes(q) || p.tags.join(' ').toLowerCase().includes(q));
  el.innerHTML = filtered.map(p => renderPostCard(p)).join('');
  if (!filtered.length && window.HX && HX.emptyFeed) el.innerHTML = HX.emptyFeed(q);
}

/* Prices small enough to read at a glance, precise enough to be useful
   across a range that spans $100k (BTC) down to $0.000005 (SHIB). Long
   runs of zeros collapse the way exchanges show them: $0.0₅5123. */
function tickerPrice(v) {
  if (v === null || v === undefined || isNaN(v) || v <= 0) return '$0.00';
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (v >= 1)    return '$' + v.toFixed(2);
  if (v >= 0.01) return '$' + v.toFixed(4);
  let zeros = Math.floor(-Math.log10(v));
  if (zeros < 4) return '$' + v.toFixed(zeros + 4).replace(/0+$/, '');
  let digits = Math.round(v * Math.pow(10, zeros + 4));
  if (digits >= 10000) { zeros--; digits = Math.round(digits / 10); }
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  return '$0.0' + String(zeros).split('').map(d => SUB[d]).join('') + String(digits).replace(/0+$/, '');
}

/* ── Global markets ticker ──────────────────────────────────────────
   Rotates the coins through a RECYCLED set of ~8 chips.

   The previous version rendered every coin twice (2,100 nodes, 300 images)
   into a single 57,000px-wide element and animated it in CSS. That is far
   past the GPU's max texture size, so the layer could never be composited
   and the browser repainted the whole thing every frame — measured at
   51fps with frames as long as 100ms.

   Here the track holds only enough chips to cover the viewport plus one
   spare. When a chip scrolls off the left it is re-bound to the next coin
   and moved to the end, so the DOM stays tiny and the track stays a few
   thousand pixels wide — small enough to composite properly.

   Chips are a FIXED width, which keeps the loop pure arithmetic: no
   offsetWidth reads, so no forced layout on any frame.

   It pauses on hover, while a finger is on it, while the tab is hidden
   and while Home isn't the pane on screen. With reduced motion switched
   on it doesn't move at all: every coin is laid out and scrolls by hand.

   In a narrow column (the Home sidebar card, marked .vertical) the same
   recycling runs upward as a list of rows instead of sideways. */
const TickerFX = (() => {
  let SPEED  = 70;             // px per second — slower when running vertically
  let CHIP_W = 190;            // chip width, or row height when vertical; measured once per build
  let vertical = false, sizeObs = null, boxH = -1;

  let track = null, pane = null, chips = [], syms = [], next = 0;
  let offset = 0, raf = null, lastT = 0;
  let hover = false, touch = false, hidden = false, touchTimer = null;
  let still = false;

  const live = () => window.liveCryptoPrices || {};
  const calm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function bind(el, sym) {
    const c = live()[sym];
    if (!c) return;
    const chg = c.usd_24h_change || 0;
    const up = chg >= 0;
    el.dataset.sym = sym;
    el.title = `${c.name || sym} — open token page`;
    el.setAttribute('aria-label', `${c.name || sym}, ${tickerPrice(c.usd)}, ${up ? 'up' : 'down'} ${Math.abs(chg).toFixed(2)} percent in 24 hours`);
    el.innerHTML =
      `${coinIcon(sym, 18)}` +
      `<strong class="mkt-sym">${escapeHTML(sym)}</strong>` +
      `<span class="mkt-px">${tickerPrice(c.usd)}</span>` +
      `<span class="mkt-ch ${up ? 'up' : 'down'}">${up ? '▲' : '▼'}${Math.abs(chg).toFixed(2)}%</span>`;
  }

  const nextSym = () => { const s = syms[next % syms.length]; next++; return s; };

  function chip(sym) {
    const el = document.createElement('button');
    el.className = 'mkt-chip';
    el.onclick = () => { if (typeof W3 !== 'undefined') W3.openToken(el.dataset.sym); };
    bind(el, sym);
    return el;
  }

  function build(ticker) {
    track = ticker;
    pane = ticker.closest('.pane');
    track.innerHTML = '';
    track.style.transform = '';
    chips = [];
    offset = 0;
    next = 0;
    still = calm();
    vertical = !!(track.parentElement && track.parentElement.classList.contains('vertical'));
    SPEED = vertical ? 16 : 70;

    // One layout read per build, never per frame: the chip's CSS size.
    const probe = chip(syms[0]);
    track.appendChild(probe);
    CHIP_W = (vertical ? probe.offsetHeight : probe.offsetWidth) || (vertical ? 40 : 190);
    probe.remove();

    // Reduced motion: every coin, laid out once, scrolled by hand.
    const box = vertical ? (track.parentElement.clientHeight || 240) : (track.parentElement.clientWidth || 600);
    const need = still ? syms.length : Math.ceil(box / CHIP_W) + 2;
    for (let i = 0; i < need; i++) {
      const el = chip(nextSym());
      track.appendChild(el);
      chips.push(el);
    }
    if (track.parentElement) track.parentElement.classList.toggle('still', still);
  }

  function frame(now) {
    if (!track || !track.isConnected) { raf = null; return; }
    if (!lastT) lastT = now;
    const dt = Math.min((now - lastT) / 1000, 0.05);   // clamp after a stall
    lastT = now;

    // boxH 0 means the card is display:none (the sidebar hides on small screens).
    const offscreen = (pane && !pane.classList.contains('active')) || boxH === 0;
    if (!(hover || touch || hidden || offscreen)) {
      offset -= SPEED * dt;
      // Recycle whole chips off the leading edge — no measurement needed.
      while (offset <= -CHIP_W && chips.length) {
        offset += CHIP_W;
        const el = chips.shift();
        bind(el, nextSym());
        track.appendChild(el);
        chips.push(el);
      }
      track.style.transform = vertical ? `translate3d(0,${offset.toFixed(2)}px,0)` : `translate3d(${offset.toFixed(2)}px,0,0)`;
    }
    raf = requestAnimationFrame(frame);
  }

  function start(ticker, symbols) {
    syms = (symbols && symbols.length) ? symbols.slice() : [];
    if (!syms.length) return;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    build(ticker);
    lastT = 0;

    const wrap = ticker.parentElement;
    if (wrap && !wrap.dataset.tickerBound) {
      wrap.dataset.tickerBound = '1';
      wrap.addEventListener('mouseenter', () => { hover = true; });
      wrap.addEventListener('mouseleave', () => { hover = false; });
      // Touch screens have no hover: hold still while a finger is down,
      // and for a moment after, so a coin can be read and tapped.
      wrap.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { clearTimeout(touchTimer); touch = true; } });
      const release = e => { if (e.pointerType !== 'mouse') { clearTimeout(touchTimer); touchTimer = setTimeout(() => { touch = false; }, 1800); } };
      wrap.addEventListener('pointerup', release);
      wrap.addEventListener('pointercancel', release);
    }
    // Hidden and shown again (sidebar collapsing at a breakpoint): rebuild
    // so the number of rows matches the space it has.
    if (sizeObs) sizeObs.disconnect();
    if (window.ResizeObserver && wrap) {
      boxH = -1;
      sizeObs = new ResizeObserver(entries => {
        const h = Math.round(entries[0].contentRect.height);
        const wasHidden = boxH === 0;
        boxH = h;
        if (wasHidden && h > 0 && track && !still) { build(track); lastT = 0; }
      });
      sizeObs.observe(wrap);
    }
    if (!document.body.dataset.tickerVis) {
      document.body.dataset.tickerVis = '1';
      document.addEventListener('visibilitychange', () => { lastT = 0; hidden = document.hidden; });
    }

    if (!still) raf = requestAnimationFrame(frame);
  }

  /* Price refresh: rewrite the visible chips in place. The track and its
     animation are never touched, so the scroll doesn't stutter. */
  function refresh() {
    chips.forEach(el => bind(el, el.dataset.sym));
  }

  /* A changed coin list slots in without restarting the scroll: chips
     pick up the new list as they come round. */
  function setSymbols(list) {
    if (!list || !list.length) return;
    const same = list.length === syms.length && list.every((s, i) => s === syms[i]);
    if (same) return;
    syms = list.slice();
    next = next % syms.length;
    if (still && track) { build(track); return; }
    chips.forEach(el => { if (syms.indexOf(el.dataset.sym) < 0) bind(el, nextSym()); });
  }

  const isRunning = () => raf !== null || (still && chips.length > 0);
  const symbolCount = () => syms.length;

  return { start, refresh, setSymbols, isRunning, symbolCount, get CHIP_W() { return CHIP_W; }, get count() { return chips.length; } };
})();

/* Which coins the home ticker carries. "Global markets" means the coins
   people actually follow: the majors first, then the rest of the top by
   market cap — without stablecoins sitting at $1.00, or wrapped and staked
   copies of coins that are already on the list. */
const TICKER_SIZE = 40;
const TICKER_MAJORS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'TRX', 'TON', 'AVAX', 'LINK', 'DOT', 'SUI', 'LTC', 'SHIB', 'XLM', 'BCH', 'NEAR', 'APT', 'PEPE'];
const TICKER_STABLE = new Set(('USDT USDC DAI FDUSD USDE USDS PYUSD TUSD USDD FRAX BUSD USD1 RLUSD USDX GUSD USDP LUSD USDY BUIDL USDTB USD0 ' +
  'EURC SUSDE SUSDS USDF USDG BFUSD USDB USDO OUSG USTB USYC').split(' '));
const TICKER_DERIV_NAME = /\b(wrapped|staked|bridged|restaked|liquid staking|binance-peg|heloc|tokeni[sz]ed|treasury)\b/i;
const TICKER_DERIV_SYM = /^(W|ST|WST|CB|R|M|WE|EZ|RS|LB|SOLV|JITO|BN|B|K|JUP|UNI)(BTC|ETH|SOL|BNB)$/;

function tickerCoins(live) {
  const ok = s => {
    const c = live[s];
    // The five hard-coded fallback prices have neither a name nor a live
    // stream behind them; they must never be shown as market data.
    if (!c || !(c.name || c.live) || !(c.usd > 0)) return false;
    if (!/^[A-Z0-9]{2,8}$/.test(s)) return false;
    if (TICKER_STABLE.has(s)) return false;
    if (/\busd\b|dollar|stablecoin/i.test(c.name || '') && Math.abs(c.usd - 1) < 0.05) return false;
    if (TICKER_DERIV_NAME.test(c.name || '') || TICKER_DERIV_SYM.test(s)) return false;
    return true;
  };
  const all = Object.keys(live).filter(ok);
  const majors = TICKER_MAJORS.filter(s => all.indexOf(s) > -1);
  const rest = all.filter(s => live[s].mcap && majors.indexOf(s) < 0).sort((a, b) => live[b].mcap - live[a].mcap);
  return majors.concat(rest).slice(0, TICKER_SIZE);
}

/* Live when the Binance stream is carrying prices, Delayed when only the
   CoinGecko poll is, Offline when nothing has arrived. */
function paintTickerStatus(list) {
  const el = $id('ticker-count');
  if (!el) return;
  const streaming = typeof MD !== 'undefined' && MD.isLive && MD.isLive();
  const since = window.__tickerAt ? Math.round((Date.now() - window.__tickerAt) / 1000) : null;
  let state, label, tip;
  if (!list.length) {
    state = window.__tickerOffline ? 'offline' : 'sync';
    label = window.__tickerOffline ? 'Offline' : 'Syncing';
    tip = window.__tickerOffline ? 'Live prices are unavailable right now. Retrying in the background.' : 'Fetching live prices…';
  } else {
    state = streaming ? 'live' : 'delayed';
    label = streaming ? 'Live' : 'Delayed';
    tip = `Top ${list.length} coins — the majors, then by market cap. Stablecoins and wrapped tokens are left out. ` +
      (streaming ? 'Streaming from Binance.' : 'Prices from CoinGecko, refreshed about every 30 seconds.') +
      (since != null ? ` Updated ${since < 5 ? 'just now' : since + 's ago'}.` : '');
  }
  el.className = 'mkt-status ' + state;
  el.textContent = label;
  el.title = tip;
}

/* ── Phones: the sidebar as a swipeable row ─────────────────────────
   Below 768px the right column used to be display:none, so Portfolio,
   Market Pulse, Earn, the wallet, Trending, Suggested Friends and Global
   Markets simply disappeared. CSS now lays those cards out as one
   sideways-swiping row between the composer and the posts; this keeps
   the dots under it in step with the swipe and lets a dot jump to its
   card. On wider screens it does nothing. */
const SideRow = (() => {
  const mq = window.matchMedia ? matchMedia('(max-width: 768px)') : null;
  let raf = 0;
  let watched = [];
  const ro = window.ResizeObserver ? new ResizeObserver(() => schedule()) : null;

  const side = () => document.querySelector('#pane-feeds .trend-sidebar');
  const cardsOf = el => [...el.querySelectorAll(':scope > .trend-card, :scope > #hc-side > .trend-card')];
  // The card's own heading, without the icon's ligature name or the header's link.
  const titleOf = c => {
    const hdr = c.querySelector('.section-hdr');
    const t = c.querySelector('.section-title') || (hdr && hdr.firstElementChild);
    if (!t) return 'Card';
    const copy = t.cloneNode(true);
    copy.querySelectorAll('.material-symbols-rounded').forEach(i => i.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim() || 'Card';
  };

  function paint() {
    raf = 0;
    const el = side();
    const dots = $id('side-dots');
    if (!el || !dots) return;
    if (!mq || !mq.matches) { if (dots.childElementCount) dots.innerHTML = ''; el.style.height = ''; return; }
    const cards = cardsOf(el);
    // Cards change height as their content loads. HC repaints its three on
    // every price tick, so re-watch only when the set of cards changed —
    // and drop the old ones rather than holding on to them.
    if (ro && (cards.length !== watched.length || cards.some((c, i) => c !== watched[i]))) {
      ro.disconnect();
      cards.forEach(c => ro.observe(c));
      watched = cards;
    }
    if (dots.childElementCount !== cards.length) {
      dots.innerHTML = cards.map((c, i) => `<button type="button" data-i="${i}" aria-label="${escapeHTML(titleOf(c))}"></button>`).join('');
    }
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    let active = 0, best = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft - pad - el.scrollLeft);
      if (d < best) { best = d; active = i; }
    });
    [...dots.children].forEach((b, i) => {
      b.classList.toggle('on', i === active);
      b.setAttribute('aria-current', i === active ? 'true' : 'false');
    });
    // The row takes the height of the card on screen, so a short card
    // doesn't leave the space of the tallest one under it.
    if (cards[active]) {
      const cs = getComputedStyle(el);
      el.style.height = Math.ceil(cards[active].offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)) + 'px';
    }
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };

  function wire() {
    const el = side();
    const dots = $id('side-dots');
    if (!el || !dots) return;
    if (!el.dataset.rowBound) {
      el.dataset.rowBound = '1';
      el.addEventListener('scroll', schedule, { passive: true });
      dots.addEventListener('click', e => {
        const b = e.target.closest('button[data-i]');
        if (!b) return;
        const card = cardsOf(el)[+b.dataset.i];
        const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
        if (card) el.scrollTo({ left: card.offsetLeft - pad, behavior: 'smooth' });
      });
      // Portfolio, Market Pulse and Earn are painted in later by HC.
      const hc = $id('hc-side');
      if (hc && window.MutationObserver) new MutationObserver(schedule).observe(hc, { childList: true });
      if (mq) { try { mq.addEventListener('change', schedule); } catch (e) { mq.addListener(schedule); } }
    }
    schedule();
  }

  return { wire, paint };
})();

function renderUniversalTicker() {
  SideRow.wire();
  const ticker = $id('universal-market-ticker');
  if (!ticker) return;

  const list = tickerCoins(window.liveCryptoPrices || {});

  if (!list.length) {
    // Give the feeds a fair chance before admitting they're down.
    if (!window.__tickerWait) {
      window.__tickerWait = setTimeout(() => {
        if (tickerCoins(window.liveCryptoPrices || {}).length) return;
        window.__tickerOffline = true;
        const t = $id('universal-market-ticker');
        if (t && !t.querySelector('.mkt-chip')) t.innerHTML = '<span class="tc-3 fs11">Live prices are unavailable right now — retrying.</span>';
        paintTickerStatus([]);
      }, 20000);
    }
    if (!ticker.querySelector('.mkt-chip')) {
      ticker.innerHTML = `<span class="tc-3 fs11">${window.__tickerOffline ? 'Live prices are unavailable right now — retrying.' : 'Syncing live market data…'}</span>`;
    }
    paintTickerStatus([]);
    return;
  }

  window.__tickerOffline = false;
  window.__tickerAt = Date.now();
  paintTickerStatus(list);
  if (!window.__tickerClock) window.__tickerClock = setInterval(() => paintTickerStatus(tickerCoins(window.liveCryptoPrices || {})), 15000);

  /* Already running: take any change to the list without restarting the
     scroll, then update prices in place. */
  if (TickerFX.isRunning() && ticker.querySelector('.mkt-chip')) {
    TickerFX.setSymbols(list);
    TickerFX.refresh();
    return;
  }

  TickerFX.start(ticker, list);
}

/* Initials, not the sparkle that was stamped on every mock author. */
function postInitials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function renderPostCard(p) {
  const tags = p.tags.map(t => `<span class="post-tag">${escapeHTML(t)}</span>`).join('');
  
  let pollHTML = '';
  if (p.type === 'poll' && p.options) {
    const totalVotes = p.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
    const maxVotes = Math.max(...p.options.map(o => o.votes || 0));
    // String ids (mock/Firestore posts) must stay quoted in the onclick.
    const pollId = typeof p.id === 'string' ? `'${p.id}'` : p.id;
    // votedIdx remembers which option you picked; hasVoted covers older stored polls.
    const votedIdx = typeof p.votedIdx === 'number' ? p.votedIdx : -1;
    const hasVoted = votedIdx > -1 || !!p.hasVoted;
    pollHTML = '<div class="post-poll mt12">';
    p.options.forEach((opt, idx) => {
      const pct = totalVotes === 0 ? 0 : Math.round(((opt.votes || 0) / totalVotes) * 100);
      const isWinner = totalVotes > 0 && (opt.votes || 0) === maxVotes;
      const isMine = votedIdx === idx;
      const hover = hasVoted ? '' : ` onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background='transparent'"`;
      pollHTML += `
        <div class="poll-option mb8" style="cursor:${hasVoted ? 'default' : 'pointer'}; padding:8px; border:1px solid ${isMine ? 'var(--blue)' : 'var(--border)'}; border-radius:var(--r2); transition:var(--tr)" onclick="votePoll(${pollId}, ${idx})"${hover}>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; font-weight:500; color:var(--t1)">
            <span>${isMine ? '✓ ' : ''}${escapeHTML(opt.text)}</span>
            <span>${pct}%</span>
          </div>
          <div class="poll-bar-bg" style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden">
            <div class="poll-bar-fill" style="height:100%; width:${pct}%; background:${isWinner ? 'var(--blue)' : 'var(--t3)'}; transition:width 0.4s cubic-bezier(0.4, 0, 0.2, 1)"></div>
          </div>
        </div>
      `;
    });
    pollHTML += `<div class="fs11 tc-3 mt4">${totalVotes} vote${totalVotes === 1 ? '' : 's'}${hasVoted ? ' · you voted' : ''}</div></div>`;
  }

  const idStr = typeof p.id === 'string' ? `'${p.id}'` : p.id;
  const authorSafe = p.author ? p.author.replace(/'/g, "\\'") : '';
  const handleSafe = p.handle ? p.handle.replace(/'/g, "\\'") : '';

  return `
  <div class="post-card" id="post-${p.id}">
    <div class="post-header">
      <div class="avatar av-sm post-av">${escapeHTML(postInitials(p.author))}</div>
      <div class="post-author" style="flex:1; min-width:0">
        <div class="post-author-name">
          <span class="sf-author-link" onclick="SF.openCreatorPage('${handleSafe}','${authorSafe}')" title="Open creator page">${escapeHTML(p.author)}</span>
          <span class="post-handle">${escapeHTML(p.handle)}</span>
          ${p.mine ? '' : SF.followBtn(p.handle, p.author, 'sf-inline-follow')}
        </div>
        <div class="post-meta">${formatRelativeTime(p.time)}${
          p.repostOf ? ` · <span class="material-symbols-rounded post-meta-ic">sync</span> reposted from <b>${escapeHTML(p.repostOf.author)}</b>` : ''}</div>
      </div>
    </div>

    <div class="post-body${p.bg ? ' post-body-bg' : ''}" id="post-body-${p.id}"${p.bg ? ` style="background:${escapeHTML(p.bg)}"` : ''}>${escapeHTML(p.body).replace(/\n/g,'<br>')}</div>
    ${Array.isArray(p.media) && p.media.length ? `<div class="post-media${p.media.length > 1 ? ' many' : ''}">${p.media.map(m => m.kind === 'video'
        ? `<video src="${escapeHTML(m.src)}" controls playsinline preload="metadata"></video>`
        : `<img src="${escapeHTML(m.src)}" alt="" loading="lazy">`).join('')}</div>` : ''}
    ${p.place ? `<div class="post-place"><span class="material-symbols-rounded">location_on</span>${escapeHTML(p.place)}</div>` : ''}
    ${pollHTML}

    ${tags ? `<div class="post-tags">${tags}</div>` : ''}
    <div class="post-actions">
      <button class="post-act-btn${p.liked?' liked':''}" onclick="likePost(event, ${idStr})" title="Like">
        <span class="material-symbols-rounded" style="font-variation-settings: 'FILL' ${p.liked?1:0}">favorite</span> ${p.likes}
      </button>
      <button class="post-act-btn" onclick="toggleComments(${idStr})" title="Comment">
        <span class="material-symbols-rounded">chat_bubble</span> ${p.comments}
      </button>
      <button class="post-act-btn${SF.hasReposted(p.id) ? ' liked' : ''}" onclick="SF.repost(${idStr})" title="Repost to your feed">
        <span class="material-symbols-rounded">sync</span> ${p.shares}
      </button>
      <button class="post-act-btn post-tip" onclick="openTipModal('${authorSafe}', '${handleSafe}')" title="Tip in crypto">
        <span class="material-symbols-rounded">toll</span> Tip
      </button>
      <button class="post-act-btn post-share" onclick="sharePost(${idStr})" title="Copy link">
        <span class="material-symbols-rounded">ios_share</span>
      </button>
    </div>
  </div>`;
}

/* Share used to toast "copied" without copying anything. It now copies a
   real link and only claims success when the clipboard accepted it. */
function sharePost(id) {
  const url = `${location.origin}${location.pathname}#post-${id}`;
  const done = () => showToast('Link copied');
  const fail = () => showToast('Couldn\'t copy — ' + url);
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(done, fail);
  } else {
    fail();
  }
}
window.sharePost = sharePost;

async function likePost(e, id) {
  const p = DATA.posts.find(x => x.id === id);
  if (!p) return;
  
  // Check login
  if (!S.user || S.user.fname === 'Guest') {
    showToast('Please sign in to like posts!');
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }

  p.liked = !p.liked;
  const change = p.liked ? 1 : -1;
  p.likes += change;

  // Engagement on a post mints creator rewards (90% creator / 10% platform).
  if (p.liked && typeof SF !== 'undefined') SF.accrueEngagement('like');

  if (p.liked && e && typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('❤️', e.clientX, e.clientY, 8);
  }
  
  // If it's a Firestore post (string ID), update the cloud database
  if (typeof id === 'string' && window.db && window.firebaseDoc && window.firebaseUpdateDoc) {
    try {
      const postRef = window.firebaseDoc(window.db, 'posts', id);
      await window.firebaseUpdateDoc(postRef, {
        likes: window.firebaseIncrement ? window.firebaseIncrement(change) : p.likes
      });
    } catch (err) {
      console.error("Error updating likes:", err);
      // Revert local UI if failed
      p.liked = !p.liked;
      p.likes -= change;
      showToast('Error liking post.');
    }
  } else {
    savePostsToLocal();
  }
  
  renderFeed();
}

/* Every row used to open the Politics category portal, whichever trend
   you tapped. The portal is gone and the row now searches for the trend
   it is actually showing. */
function openTrend(name) {
  if (window.DX && DX.open) { DX.open(name); return; }
  if (window.SR && SR.open) { SR.open(name); return; }
  if (typeof navigateTo === 'function') navigateTo('explore');
}

function renderTrending() {
  const el = $id('trending-list'); if (!el) return;
  el.innerHTML = DATA.trending.map((t,i) => `
    <div class="trend-item" onclick="openTrend('${String(t.name || '').replace(/'/g, "\\'")}')">
      <div class="trend-rank">${i+1}</div>
      <div class="trend-info">
        <div class="trend-name">${t.name}</div>
        <div class="trend-count">${t.count}</div>
      </div>
      <div class="trend-icon">${t.icon}</div>
    </div>`).join('');
}

function renderWhoToFollow() {
  const el = $id('who-to-follow'); if (!el) return;
  if (!DATA.suggestedFriends) {
    DATA.suggestedFriends = [
      { id: 1, name: 'Sarah Chen', emoji: '\u2728', handle: '@sarahc', shared: ['Design', 'Tech'], match: '96%', state: 'add' },
      { id: 2, name: 'Marcus Webb', emoji: '\u2728', handle: '@marcusw', shared: ['Fitness', 'Gaming'], match: '88%', state: 'add' },
      { id: 3, name: 'Zara Ahmed', emoji: '\u2728', handle: '@zaraa', shared: ['Creator', 'Design'], match: '92%', state: 'add' },
      { id: 4, name: 'Dev Kumar', emoji: '\u2728', handle: '@devk', shared: ['Tech', 'Creator'], match: '90%', state: 'add' }
    ];
  }
  
  let friends = DATA.suggestedFriends;
  const names = MODE_PEOPLE_MAP[S.feedMode || 'entertainment'];
  if (names) {
    friends = friends.filter(f => names.includes(f.name));
  }
  if (!friends.length) friends = DATA.suggestedFriends;

  el.innerHTML = friends.map(f => {
    let btnHtml = '';
    if (f.state === 'add') {
      btnHtml = `<button class="btn btn-ghost btn-sm" onclick="sendFriendRequest(${f.id}, event)" style="color:var(--blue); font-weight:700">Add</button>`;
    } else if (f.state === 'pending') {
      btnHtml = `<span class="tc-3 fs11 fw7 flex-center" style="gap:4px">Pending ⏳</span>`;
    } else {
      btnHtml = `<span class="tc-green fs11 fw7 flex-center" style="gap:4px">Friends 🤝</span>`;
    }
    
    return `
    <div class="trend-item flex-between" style="padding:10px 0; border-bottom:1px solid var(--border)">
      <div class="flex gap8" style="align-items:center; flex:1; min-width:0">
        <div class="avatar av-xs" style="background:var(--g-brand); display:grid; place-items:center; color:#fff; font-size:11px; font-weight:800">${escapeHTML(postInitials(f.name))}</div>
        <div style="flex:1; min-width:0">
          <div class="fw8 tc-1" style="font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${f.name} <span class="badge badge-blue fs9" style="margin-left:4px; padding:2px 4px">${f.match} match</span></div>
          <div class="fs10 tc-3" style="margin-top:2px">Shared: ${f.shared.join(', ')}</div>
        </div>
      </div>
      <div>${btnHtml}</div>
    </div>`;
  }).join('');
}

function sendFriendRequest(id, event) {
  event.stopPropagation();
  const f = DATA.suggestedFriends.find(x => x.id === id);
  if (!f) return;
  
  f.state = 'pending';
  showToast(`Friend request sent to ${f.name}! 📬`);
  
  // Dynamic burst explosion
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('🤝', event.clientX, event.clientY, 8);
  }
  
  renderWhoToFollow();
  
  // Simulate acceptance after 3 seconds!
  setTimeout(() => {
    f.state = 'friends';
    showToast(`You and ${f.name} are now Friends! 🤝🎉`);
    renderWhoToFollow();
    
    // Burst hearts at the sidebar location
    const el = document.getElementById('who-to-follow');
    if (el && typeof IX !== 'undefined' && IX.burstReaction) {
      const rect = el.getBoundingClientRect();
      IX.burstReaction('💖', rect.left + rect.width / 2, rect.top + rect.height / 2, 8);
    }
  }, 3000);
}
async function publishPost() {
  const input = $id('post-input'); if (!input) return;
  const text = input.value.trim();
  if (!text) { input.focus(); return; }

  // Check login
  if (!S.user || S.user.fname === 'Guest') {
    showToast('Please sign in to post!');
    if (typeof openAuthModal === 'function') openAuthModal();
    return;
  }

  const isAnon = S.anonymousMode;
  const authorName = isAnon ? 'Anonymous' : `${S.user.fname} ${S.user.lname}`.trim();
  const handleName = isAnon ? '@anonymous' : S.user.handle;

  // Tags come from the hashtags actually written in the post, not a fixed
  // pair left over from when this app was a farming network.
  const writtenTags = [...new Set((text.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.toLowerCase()))].slice(0, 6);

  const newPost = {
    author: authorName,
    handle: handleName,
    uid: S.user.uid || 'anon',
    time: window.firebaseServerTimestamp ? window.firebaseServerTimestamp() : Date.now(),
    body: text,
    tags: writtenTags,
    likes: 0,
    comments: 0,
    shares: 0,
    type: 'text',
    category: 'general'
  };

  input.value = '';
  
  if (window.db && window.firebaseCollection && window.firebaseAddDoc) {
    try {
      const postsRef = window.firebaseCollection(window.db, 'posts');
      await window.firebaseAddDoc(postsRef, newPost);
      showToast('Post published to the global network! 🌍');
    } catch (e) {
      console.error("Error adding document: ", e);
      showToast('Error publishing post. ❌');
    }
  } else {
    // Fallback to local
    newPost.id = Date.now();
    newPost.time = Date.now();
    newPost.mine = true;
    DATA.posts.unshift(newPost);
    savePostsToLocal();
    renderFeed();
  }

  // Social-to-earn: publishing is a contribution, so it pays (up to a daily cap).
  if (typeof SF !== 'undefined') SF.earn('publish_post');
}

// ── REAL-TIME FIRESTORE LISTENER ──
/* Retries used to fire every second forever. When Firestore is simply not
   provisioned — as it is here — that's an endless 1Hz loop of work and
   console noise for something that will never succeed, and it showed up
   as periodic long tasks. Back off, then stop and run on local data. */
let _feedRetries = 0;
const FEED_MAX_RETRIES = 6;

function listenToGlobalFeed() {
  if (!window.db || !window.firebaseCollection || !window.firebaseOnSnapshot) {
    if (_feedRetries >= FEED_MAX_RETRIES) {
      console.warn('Firestore unavailable — continuing with local posts.');
      return;
    }
    const wait = 1000 * Math.pow(2, _feedRetries++);   // 1s, 2s, 4s … 32s
    setTimeout(listenToGlobalFeed, wait);
    return;
  }
  _feedRetries = 0;

  const q = window.firebaseQuery(
    window.firebaseCollection(window.db, 'posts'),
    window.firebaseOrderBy('time', 'desc')
  );

  window.firebaseOnSnapshot(q, (snapshot) => {
    const cloudPosts = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      cloudPosts.push({
        id: doc.id,
        author: data.author,
        handle: data.handle,
        emoji: data.emoji || '✨',
        time: data.time ? (data.time.toMillis ? data.time.toMillis() : data.time) : Date.now(),
        body: data.body,
        tags: data.tags || [],
        likes: data.likes || 0,
        comments: data.comments || 0,
        shares: data.shares || 0,
        liked: false,
        type: data.type || 'text',
        category: data.category || 'general'
      });
    });

    // Merge with mock posts to keep the feed populated if cloud is empty
    if (cloudPosts.length > 0) {
      // Create a map to merge correctly, prioritizing cloud posts
      const merged = [...cloudPosts];
      DATA.posts.forEach(mock => {
        if (!cloudPosts.find(cp => cp.id === mock.id || cp.body === mock.body)) {
          merged.push(mock);
        }
      });
      // Sort by time
      merged.sort((a,b) => b.time - a.time);
      DATA.posts = merged;
    }

    renderFeed();
    console.log(`📡 Real-time feed updated: ${cloudPosts.length} cloud posts fetched.`);
  }, (error) => {
    console.error("Firebase feed listener error:", error);
  });
}

// Start listener when this file runs
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', listenToGlobalFeed);
} else {
  listenToGlobalFeed();
}
function openPostComposer() { $id('post-input') && $id('post-input').focus(); }

function openStoryComposer() {
  let modal = document.getElementById('story-composer-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'story-composer-modal';
    modal.style.cssText = 'position:fixed; inset:0; z-index:99999; background:#000; display:flex; flex-direction:column; opacity:0; transition:opacity 0.3s ease; overflow:hidden;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <!-- Video Background -->
    <video id="story-camera-feed" autoplay playsinline muted style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1; transform:scaleX(-1);"></video>
    
    <!-- Dim Overlay for better text visibility -->
    <div style="position:absolute; inset:0; background:rgba(0,0,0,0.25); z-index:2;"></div>

    <!-- Top Left Navigation -->
    <div style="position:absolute; top:40px; left:20px; z-index:100000; display:flex; align-items:center;">
      <button class="icon-btn" onclick="closeStoryComposer()" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:40px; height:40px; border-radius:50%; display:flex; justify-content:center; align-items:center; border:1px solid rgba(255,255,255,0.2);">
        <span class="material-symbols-rounded">arrow_back</span>
      </button>
    </div>

    <!-- Top Right Vertical Toolbar -->
    <div style="position:absolute; top:40px; right:20px; z-index:100000; display:flex; flex-direction:column; gap:16px;">
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="document.getElementById('story-compose-input').focus()">
        <span class="material-symbols-rounded" style="font-size:22px;">match_case</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Opening Stickers... 😊')">
        <span class="material-symbols-rounded" style="font-size:22px;">mood</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Opening Music Library... 🎵')">
        <span class="material-symbols-rounded" style="font-size:22px;">music_note</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Applying AI Filters... ✨')">
        <span class="material-symbols-rounded" style="font-size:22px;">auto_awesome</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Tagging Creators... @')">
        <span class="material-symbols-rounded" style="font-size:22px;">alternate_email</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Drawing Mode Enabled 🖌️')">
        <span class="material-symbols-rounded" style="font-size:22px;">draw</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Draft Saved to Device! 💾')">
        <span class="material-symbols-rounded" style="font-size:22px;">download</span>
      </button>
    </div>
    
    <!-- Central Text Canvas -->
    <div style="flex:1; display:flex; align-items:center; justify-content:center; position:relative; z-index:10; pointer-events:none;">
      <textarea id="story-compose-input" placeholder="Type something amazing..." style="pointer-events:auto; background:transparent; border:none; outline:none; color:#fff; font-size:36px; font-weight:800; text-align:center; width:80%; resize:none; text-shadow:0 4px 16px rgba(0,0,0,0.6)" rows="3" autofocus></textarea>
    </div>

    <!-- Bottom Sharing Footer -->
    <div style="position:absolute; bottom:30px; left:20px; right:20px; z-index:100000; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; gap:16px;">
        <!-- Your Story -->
        <button class="btn" style="background:rgba(0,0,0,0.5); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.2); border-radius:30px; padding:8px 16px; display:flex; align-items:center; gap:8px; color:#fff; font-weight:600;" onclick="submitStory('Your Story')">
          <div style="width:24px; height:24px; border-radius:50%; background:var(--g-brand); display:grid; place-items:center; font-size:10px;">AV</div>
          Your Story
        </button>
        <!-- Close Friends -->
        <button class="btn" style="background:rgba(0,0,0,0.5); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.2); border-radius:30px; padding:8px 16px; display:flex; align-items:center; gap:8px; color:#fff; font-weight:600;" onclick="submitStory('Close Friends')">
          <div style="width:24px; height:24px; border-radius:50%; background:var(--green); display:grid; place-items:center;">
            <span class="material-symbols-rounded" style="font-size:16px; color:#fff;">stars</span>
          </div>
          Close Friends
        </button>
      </div>
      <!-- Send Button -->
      <button class="icon-btn" style="width:56px; height:56px; border-radius:50%; background:var(--blue); color:#fff; box-shadow:0 4px 16px rgba(33,150,243,0.4); display:grid; place-items:center; border:none;" onclick="submitStory('Direct Message')">
        <span class="material-symbols-rounded" style="font-size:28px;">send</span>
      </button>
    </div>
  `;
  modal.style.display = 'flex';
  setTimeout(() => modal.style.opacity = '1', 10);

  // Request Camera Access
  const videoEl = document.getElementById('story-camera-feed');
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(function(stream) {
        window.currentStoryStream = stream;
        videoEl.srcObject = stream;
      })
      .catch(function(err) {
        console.warn("Camera access denied or unavailable: ", err);
        // Fallback gradient if camera fails (--g-brand is itself a gradient)
        videoEl.style.display = 'none';
        modal.style.background = 'var(--g-brand)';
      });
  } else {
    videoEl.style.display = 'none';
    modal.style.background = 'var(--g-brand)';
  }
}

function closeStoryComposer() {
  const modal = document.getElementById('story-composer-modal');
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.display = 'none';
      // Stop camera stream to free up resources
      if (window.currentStoryStream) {
        window.currentStoryStream.getTracks().forEach(track => track.stop());
        window.currentStoryStream = null;
      }
    }, 300);
  }
}

function submitStory(destination = 'Your Story') {
  closeStoryComposer();
  showToast(`Shared to ${destination}! ✨`);
}
// ── INSTAGRAM-STYLE STORIES VIEWER CONTROLLER ──────────────────────
let storyTimerInterval = null;
let currentStoryIdx = -1;
let storyProgressPct = 0;
let storyPaused = false;

const STORY_CONTENTS = {
  'Sarah': { text: "Brewing some fresh code this morning! ☕💻 Let's build something incredible today.", handle: "@sarahc", time: "2h ago", bg: "linear-gradient(135deg, #1b122c, #4a1240)" },
  'Marcus': { text: "No excuses. 5 AM cardio session demolished! 🏋️💪 Consistency beats talent every single day.", handle: "@marcusw", time: "5h ago", bg: "linear-gradient(135deg, #0e1a2f, #114b3e)" },
  'Zara': { text: "Off to Tokyo! ✈️🇯🇵 Exploring new minimal UI design trends for the next dashboard. Stay tuned!", handle: "@zaraa", time: "8h ago", bg: "linear-gradient(135deg, #3d1b11, #5c2c16)" },
  'Tyler': { text: "Apex Legends championship tournament starts in 10 minutes! Wish me luck. 🎮🏆 #gaming", handle: "@tylerr", time: "10h ago", bg: "linear-gradient(135deg, #2b120c, #481912)" },
  'Mia': { text: "Working on a new digital speed-painting canvas piece. 🎨✨ Reveal is coming soon! #procreate", handle: "@miat", time: "12h ago", bg: "linear-gradient(135deg, #290c2b, #4b1a4a)" },
  'Dev': { text: "Refactoring the entire database caching layer. 💻⚙️ Muting alerts to enter flow state.", handle: "@devk", time: "14h ago", bg: "linear-gradient(135deg, #0c202b, #12404b)" },
  'Luna': { text: "Chasing quiet sunsets and finding deep breathing room in design. 🌅🧘 #calm", handle: "@lunap", time: "16h ago", bg: "linear-gradient(135deg, #0f0a21, #25123d)" },
  'Kai': { text: "Crushed my running speed record today! ⚡🔥 Training pays off. Never stop pushing.", handle: "@kaib", time: "18h ago", bg: "linear-gradient(135deg, #2b250c, #4e3f11)" }
};

function openStoryViewer(startIndex) {
  // Clear any existing timers
  if (storyTimerInterval) clearInterval(storyTimerInterval);
  storyPaused = false;
  storyProgressPct = 0;
  currentStoryIdx = startIndex;
  
  // Suppress background scroll
  document.body.style.overflow = 'hidden';
  
  // Remove if exists
  const existing = document.getElementById('stories-popup-overlay');
  if (existing) existing.remove();
  
  const story = DATA.stories[startIndex];
  const content = STORY_CONTENTS[story.name] || { text: `Checking out the universe with ${story.name}!`, handle: `@${story.name.toLowerCase()}`, time: "Just now", bg: "linear-gradient(135deg, #1b122c, #07040a)" };
  const iconData = get3DIconForEmoji(story.emoji);
  
  // Build progress bars
  const progressBarsHTML = DATA.stories.map((s, idx) => {
    let fillWidth = '0%';
    if (idx < startIndex) fillWidth = '100%';
    return `
      <div class="story-progress-bar">
        <div class="story-progress-fill" id="story-progress-fill-${idx}" style="width: ${fillWidth}"></div>
      </div>
    `;
  }).join('');
  
  const overlay = document.createElement('div');
  overlay.id = 'stories-popup-overlay';
  overlay.innerHTML = `
    <div class="story-popup-player" style="background: ${content.bg}">
      <!-- Progress Bar Container -->
      <div class="story-progress-container">
        ${progressBarsHTML}
      </div>
      
      <!-- Story Header -->
      <div class="story-popup-header">
        <div class="story-popup-avatar">${story.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <div class="story-popup-username">${story.name}</div>
          <div class="story-popup-time">${content.time}</div>
        </div>
        <button class="story-popup-close" onclick="closeStoryViewer(event)" title="Close Story">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>
      
      <!-- Interactive Tap & Content Area -->
      <div class="story-popup-content-screen">
        <div class="story-popup-tap-zone-left" onclick="prevStory(event)"></div>
        <div class="story-popup-tap-zone-right" onclick="nextStory(event)"></div>
        
        <div class="story-popup-body">
          <div class="story-popup-emoji-container">
            <span class="material-symbols-rounded story-popup-emoji-3d" style="color: ${iconData.color}; text-shadow: 0 0 20px ${iconData.color}80">${iconData.icon}</span>
          </div>
          <div class="story-popup-text">"${content.text}"</div>
        </div>
      </div>
      
      <!-- Footer Reply Bar -->
      <div class="story-popup-footer">
        <input type="text" class="story-popup-input" id="story-reply-input" placeholder="Send a reply to ${story.name}..." onkeydown="handleStoryReplyKey(event, ${startIndex})" onclick="event.stopPropagation()">
        <button class="story-popup-send-btn" onclick="sendStoryReply(${startIndex}, event)">
          <span class="material-symbols-rounded">send</span>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Start the progress loop
  startStoryTimer();
}

function closeStoryViewer(event) {
  if (event) event.stopPropagation();
  document.body.style.overflow = '';
  if (storyTimerInterval) {
    clearInterval(storyTimerInterval);
    storyTimerInterval = null;
  }
  const overlay = document.getElementById('stories-popup-overlay');
  if (overlay) overlay.remove();
  currentStoryIdx = -1;
}

function startStoryTimer() {
  const fillElement = document.getElementById(`story-progress-fill-${currentStoryIdx}`);
  if (!fillElement) return;
  
  const tickTime = 40; // ms
  const totalDuration = 4000; // 4 seconds total
  const increments = totalDuration / tickTime;
  
  storyTimerInterval = setInterval(() => {
    if (storyPaused) return;
    
    storyProgressPct += (100 / increments);
    if (storyProgressPct >= 100) {
      storyProgressPct = 100;
      fillElement.style.width = '100%';
      clearInterval(storyTimerInterval);
      nextStory();
    } else {
      fillElement.style.width = `${storyProgressPct}%`;
    }
  }, tickTime);
}

function nextStory(event) {
  if (event) event.stopPropagation();
  if (storyTimerInterval) clearInterval(storyTimerInterval);
  
  const nextIdx = currentStoryIdx + 1;
  if (nextIdx < DATA.stories.length) {
    // Mark next story seen instantly as well
    DATA.stories[nextIdx].seen = true;
    renderStories();
    openStoryViewer(nextIdx);
  } else {
    closeStoryViewer();
  }
}

function prevStory(event) {
  if (event) event.stopPropagation();
  if (storyTimerInterval) clearInterval(storyTimerInterval);
  
  const prevIdx = currentStoryIdx - 1;
  if (prevIdx >= 0) {
    openStoryViewer(prevIdx);
  } else {
    // Reset timer on first slide
    openStoryViewer(0);
  }
}

function handleStoryReplyKey(event, idx) {
  event.stopPropagation();
  if (event.key === 'Enter') {
    sendStoryReply(idx, event);
  }
}

function sendStoryReply(idx, event) {
  if (event) event.stopPropagation();
  const input = document.getElementById('story-reply-input');
  if (!input) return;
  const reply = input.value.trim();
  if (!reply) return;
  
  const storyName = DATA.stories[idx].name;
  showToast(`Story reply sent to ${storyName}! 💬`);
  
  // Tactile visual feedback
  const rect = input.getBoundingClientRect();
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('📩', rect.left + rect.width / 2, rect.top - 20, 8);
  }
  
  input.value = '';
  // Close after brief response delay
  setTimeout(() => {
    closeStoryViewer();
  }, 100);
}

function viewStory(name) {
  const idx = DATA.stories.findIndex(s => s.name === name);
  if (idx !== -1) {
    DATA.stories[idx].seen = true;
    renderStories();
    openStoryViewer(idx);
  } else {
    showToast(`Viewing ${name}'s story ✨`);
  }
}

// ── EXPLORE ──────────────────────────────────────────────────────
function renderExplore() {
  // Repaint the sentiment gauge — the pane is built lazily, so #fgi-root
  // only exists from the first visit onward.
  if (typeof FGI !== 'undefined') FGI.paint();

  // Cryptoverse: live market discovery replaces the old topic grid + chips.
  if (typeof CV !== 'undefined') CV.render();

  const cg = $id('creator-grid');
  if (cg) {
    cg.innerHTML = DATA.users.map(u => {
      const initials = u.name.split(' ').map(n=>n[0]).join('');
      return `
      <div class="card" style="padding:14px;text-align:center;cursor:pointer;transition:var(--tr-spring)" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform=''">
        <div class="avatar av-md" style="margin:0 auto 8px;background:var(--g-brand);display:grid;place-items:center;font-size:14px;font-weight:700;color:#fff">${initials}</div>
        <div style="font-size:13px;font-weight:700">${u.name}</div>
        <div style="font-size:11px;color:var(--t3)">${u.handle}</div>
        <button class="btn btn-primary btn-sm" style="margin-top:10px;width:100%" onclick="showToast('Following ${u.name}!')">Follow</button>
      </div>`;
    }).join('');
  }
}



function getFeedsTemplate() {
  return `<section id="pane-feeds" class="pane active hx">
        <div class="flex-between mb16 hx-title">
          <h1 class="pane-title" style="margin-bottom:0"><span>Home</span> Feed</h1>
        </div>

        <!-- Search and scan — HX.paint() -->
        <div id="hx-search"></div>

        <!-- Full-width stories; the feed and sidebar start below this row. -->
        <div class="stories-row" id="stories-row"></div>

        <!-- Balance, Add Funds, promo, P2P and Send — HX.paint() -->
        <div class="hx-dash" id="hx-dash"></div>

        <!-- Crypto quick rail — one tap into the services people reach for -->
        <div id="hc-rail"></div>

        <!-- Favorites / Hot / Gainers / Losers / Stocks — HX.paint() -->
        <div id="hx-mkts"></div>

        <!-- Discover / Following / Crypto / Stocks, pinned while scrolling -->
        <div class="hx-sheet" id="hx-sheet"></div>

        <div class="home-layout">
          <!-- Left Column -->
          <div>
                        <!-- Feed Posts -->
            <div id="feed-posts"></div>
          </div>

          <!-- Right Column -->
          <div class="trend-sidebar">
            <!-- Portfolio, Market Pulse and Earn — injected by HC.paint() -->
            <div id="hc-side"></div>

            <!-- Creator Wallet & Live Earnings Card -->
            <div class="trend-card mb12 wallet-card" style="border:1px solid var(--border)">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--orange)">payments</span> Creator Economy Wallet</span>
                <span class="badge badge-green">Active Share</span>
              </div>
              <div class="mt12">
                <div class="flex-between">
                  <span class="fs11 tc-3">Ecosystem Balance:</span>
                  <strong class="fs14 tc-1" id="ew-balance">1.842 BTC</strong>
                </div>
                <div class="flex-between mt4">
                  <span class="fs11 tc-3">Ad Share Earnings:</span>
                  <strong class="fs13 tc-green" id="ew-ad-share">$248.15 (0.0036 BTC)</strong>
                </div>
                <div class="flex-between mt4">
                  <span class="fs11 tc-3">Escrow In Hold:</span>
                  <strong class="fs12 tc-blue" id="ew-escrow-hold">$0.00 (0.0000 BTC)</strong>
                </div>
              </div>
              <div class="flex gap8 mt12">
                <button class="btn btn-primary btn-sm flex-center gap4" onclick="navigateTo('profile').then(() =&gt; switchProfileTab('wallet'));" style="flex:1"><span class="material-symbols-rounded" style="font-size:12px">account_balance_wallet</span> Open Wallet</button>
                <button class="btn btn-ghost btn-sm" onclick="simulateCreatorTip()" title="Tip active creator">🎁 Tip Creator</button>
              </div>
            </div>

            <div class="trend-card">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--orange)">local_fire_department</span> Trending</span>
                <span class="section-link">See all</span>
              </div>
              <div id="trending-list"></div>
            </div>

            <div class="trend-card mt12">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">group_add</span> Suggested Friends</span>
              </div>
              <div id="who-to-follow"></div>
            </div>

            <!-- Global markets — live coin ticker, scrolling upward -->
            <div class="trend-card mt12 mkt-card">
              <div class="section-hdr">
                <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded">public</span> Global Markets</span>
                <span id="ticker-count" class="mkt-status sync" title="Fetching live prices…">Syncing</span>
              </div>
              <div class="mkt-ticker-mask vertical">
                <div id="universal-market-ticker">
                  <!-- Populated by renderUniversalTicker() -->
                  <span class="tc-3 fs11">Syncing live market data…</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Phones only: which card of the swipe row is showing -->
          <div class="side-dots" id="side-dots" role="group" aria-label="Home cards"></div>
        </div>

        <!-- Phones: the feed tabs peek from the bottom until you reach them -->
        <div class="hx-peek" id="hx-peek" aria-hidden="true" inert></div>
      </section>`;
}

function handleComposerFile(input, type) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('composer-preview');
  if (preview) {
    preview.style.display = 'flex';
    preview.style.alignItems = 'center';
    preview.style.gap = '8px';
    const icon = type === 'photo' ? 'image' : 'videocam';
    const color = type === 'photo' ? 'var(--blue)' : 'var(--pink)';
    preview.innerHTML = `<span class="material-symbols-rounded" style="font-size:16px; color:${color}">${icon}</span> <span style="flex:1">${file.name}</span> <span style="cursor:pointer; color:var(--red); font-size:14px" onclick="clearComposerFile()">✕</span>`;
  }
  showToast(`${type === 'photo' ? '📸' : '🎬'} ${file.name} attached!`);
}

function clearComposerFile() {
  const preview = document.getElementById('composer-preview');
  if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
  const pf = document.getElementById('composer-file-photo'); if (pf) pf.value = '';
  const vf = document.getElementById('composer-file-video'); if (vf) vf.value = '';
}

// ── POLL LOGIC ───────────────────────────────────────────────────
const POLL_MAX_OPTIONS = 4;

/* A poll must land in a category the active filter actually shows, or it
   publishes straight into an invisible bucket. With feed modes gone, the
   Growth toggle is the only filter left. Mirrors renderFeed(). */
function pollCategoryForCurrentFeed() {
  return S.dualFeed === 'growth' ? 'tech' : 'ent';
}

function createPoll() {
  closePollModal();

  const overlay = document.createElement('div');
  overlay.id = 'poll-modal-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(8px); animation:pane-in 0.3s ease; padding:20px';
  overlay.onclick = e => { if (e.target === overlay) closePollModal(); };

  overlay.innerHTML = `
    <div class="card" style="width:100%; max-width:440px; padding:24px; position:relative; max-height:88vh; overflow-y:auto">
      <button class="icon-btn" onclick="closePollModal()" style="position:absolute; top:12px; right:12px" aria-label="Close"><span class="material-symbols-rounded">close</span></button>

      <h3 class="fw9 tc-1" style="display:flex; align-items:center; gap:6px">
        <span class="material-symbols-rounded" style="color:var(--green)">bar_chart</span> Create a poll
      </h3>
      <div class="fs12 tc-3 mt4 mb16">Ask the feed something. Two options minimum, ${POLL_MAX_OPTIONS} max.</div>

      <div class="form-group mb12">
        <label class="form-label" for="poll-q">Question</label>
        <input class="input" id="poll-q" maxlength="140" placeholder="What should I build next?" autocomplete="off">
      </div>

      <div class="form-group">
        <label class="form-label">Options</label>
        <div id="poll-opts"></div>
      </div>

      <button class="btn btn-ghost btn-sm" id="poll-add-opt" onclick="addPollOption()">
        <span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle">add</span> Add option
      </button>

      <div class="fs11 mt12" id="poll-error" style="color:var(--red); min-height:16px"></div>

      <div style="display:flex; gap:8px">
        <button class="btn btn-ghost" style="flex:1" onclick="closePollModal()">Cancel</button>
        <button class="btn btn-primary" style="flex:2" onclick="submitPoll()">Publish poll</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  addPollOption();
  addPollOption();
  document.addEventListener('keydown', pollKeyHandler);
  setTimeout(() => $id('poll-q') && $id('poll-q').focus(), 50);
}

function pollKeyHandler(e) {
  if (!$id('poll-modal-overlay')) return;
  if (e.key === 'Escape') { closePollModal(); return; }
  if (e.key === 'Enter' && e.target && e.target.classList.contains('input')) {
    e.preventDefault();
    submitPoll();
  }
}

window.closePollModal = function() {
  document.removeEventListener('keydown', pollKeyHandler);
  const el = $id('poll-modal-overlay');
  if (el) el.remove();
};

window.addPollOption = function() {
  const host = $id('poll-opts');
  if (!host || host.children.length >= POLL_MAX_OPTIONS) return;
  const row = document.createElement('div');
  row.className = 'poll-opt-row';
  row.style.cssText = 'display:flex; gap:8px; align-items:center; margin-bottom:8px';
  row.innerHTML = `
    <input class="input poll-opt-input" maxlength="60" placeholder="Option ${host.children.length + 1}" autocomplete="off" style="flex:1">
    <button class="icon-btn poll-opt-del" title="Remove option" onclick="removePollOption(this)" style="flex-shrink:0"><span class="material-symbols-rounded" style="font-size:18px">close</span></button>`;
  host.appendChild(row);
  syncPollOptionUI();
  row.querySelector('.input').focus();
};

window.removePollOption = function(btn) {
  const host = $id('poll-opts');
  if (!host || host.children.length <= 2) return;
  const row = btn.closest('.poll-opt-row');
  if (row) row.remove();
  syncPollOptionUI();
};

function syncPollOptionUI() {
  const host = $id('poll-opts');
  if (!host) return;
  const rows = Array.from(host.children);
  rows.forEach((r, i) => {
    const inp = r.querySelector('.poll-opt-input');
    if (inp && !inp.value) inp.placeholder = `Option ${i + 1}`;
    const del = r.querySelector('.poll-opt-del');
    if (del) del.style.visibility = rows.length > 2 ? 'visible' : 'hidden';
  });
  const add = $id('poll-add-opt');
  if (add) add.style.display = rows.length >= POLL_MAX_OPTIONS ? 'none' : '';
}

window.submitPoll = function() {
  const err = $id('poll-error');
  const fail = m => { if (err) err.textContent = m; };

  const qEl = $id('poll-q');
  const q = qEl ? qEl.value.trim() : '';
  const opts = Array.from(document.querySelectorAll('.poll-opt-input'))
    .map(i => i.value.trim())
    .filter(Boolean);

  if (!q) return fail('Give your poll a question.');
  if (opts.length < 2) return fail('Fill in at least two options.');
  if (new Set(opts.map(o => o.toLowerCase())).size !== opts.length) return fail('Options must be different from each other.');

  const newPost = {
    id: Date.now(),
    type: 'poll',
    author: `${S.user.fname} ${S.user.lname}`.trim(),
    handle: S.user.handle,
    emoji: `${(S.user.fname || 'A')[0]}${(S.user.lname || 'V')[0]}`.toUpperCase(),
    body: q,
    time: Date.now(),
    tags: ['#poll', '#community'],
    likes: 0,
    comments: 0,
    shares: 0,
    liked: false,
    mine: true,
    category: pollCategoryForCurrentFeed(),
    options: opts.map(t => ({ text: t, votes: 0 }))
  };

  DATA.posts.unshift(newPost);
  savePostsToLocal();
  closePollModal();
  renderFeed();
  showToast('Poll published 🗳️');
  if (typeof SF !== 'undefined') SF.earn('create_poll');
};

window.votePoll = function(postId, optIdx) {
  const p = DATA.posts.find(x => x.id === postId || String(x.id) === String(postId));
  if (!p || p.type !== 'poll' || !p.options || !p.options[optIdx]) return;

  if (typeof p.votedIdx === 'number' || p.hasVoted) {
    showToast('You already voted on this poll.');
    return;
  }

  p.options[optIdx].votes = (p.options[optIdx].votes || 0) + 1;
  p.votedIdx = optIdx;
  p.hasVoted = true;
  savePostsToLocal();
  renderFeed();
  showToast('Vote recorded ✅');
};

function filterTopicGrid(cat, chipEl) {
  // Update active chip
  if (chipEl) {
    chipEl.parentNode.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
    chipEl.classList.add('active');
  }
  
  // Filter topic cards
  const grid = $id('topic-grid');
  if (!grid) return;
  
  const cards = grid.querySelectorAll('.topic-card');
  cards.forEach(card => {
    const name = card.querySelector('.topic-name')?.textContent.toLowerCase() || '';
    
    // Map chip filter to topic names
    const filterMap = {
      'all': null,
      'ai': 'artificial intelligence',
      'fitness': 'fitness',
      'gaming': 'gaming',
      'travel': 'travel',
      'design': 'design',
      'tech': 'tech',
      'food': 'food',
      'music': 'music',
      'finance': 'finance',
      'startup': 'startup'
    };
    
    const filterTerm = filterMap[cat];
    if (!filterTerm) {
      // Show all
      card.style.display = '';
      card.style.opacity = '1';
      card.style.transform = '';
    } else if (name.includes(filterTerm)) {
      card.style.display = '';
      card.style.opacity = '1';
      card.style.transform = '';
    } else {
      card.style.display = 'none';
    }
  });
}

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
publish('pages/feeds.js', {
  renderStories: () => renderStories, renderFeed: () => renderFeed,
  tickerPrice: () => tickerPrice, TickerFX: () => TickerFX,
  TICKER_SIZE: () => TICKER_SIZE, TICKER_MAJORS: () => TICKER_MAJORS,
  TICKER_STABLE: () => TICKER_STABLE,
  TICKER_DERIV_NAME: () => TICKER_DERIV_NAME,
  TICKER_DERIV_SYM: () => TICKER_DERIV_SYM, tickerCoins: () => tickerCoins,
  paintTickerStatus: () => paintTickerStatus, SideRow: () => SideRow,
  renderUniversalTicker: () => renderUniversalTicker,
  postInitials: () => postInitials, renderPostCard: () => renderPostCard,
  sharePost: () => sharePost, likePost: () => likePost,
  renderTrending: () => renderTrending, openTrend: () => openTrend,
  renderWhoToFollow: () => renderWhoToFollow,
  sendFriendRequest: () => sendFriendRequest,
  publishPost: () => publishPost, _feedRetries: () => _feedRetries,
  FEED_MAX_RETRIES: () => FEED_MAX_RETRIES,
  listenToGlobalFeed: () => listenToGlobalFeed,
  openPostComposer: () => openPostComposer,
  openStoryComposer: () => openStoryComposer,
  closeStoryComposer: () => closeStoryComposer,
  submitStory: () => submitStory,
  storyTimerInterval: () => storyTimerInterval,
  currentStoryIdx: () => currentStoryIdx,
  storyProgressPct: () => storyProgressPct, storyPaused: () => storyPaused,
  STORY_CONTENTS: () => STORY_CONTENTS,
  openStoryViewer: () => openStoryViewer,
  closeStoryViewer: () => closeStoryViewer,
  startStoryTimer: () => startStoryTimer, nextStory: () => nextStory,
  prevStory: () => prevStory,
  handleStoryReplyKey: () => handleStoryReplyKey,
  sendStoryReply: () => sendStoryReply, viewStory: () => viewStory,
  renderExplore: () => renderExplore,
  getFeedsTemplate: () => getFeedsTemplate,
  handleComposerFile: () => handleComposerFile,
  clearComposerFile: () => clearComposerFile,
  POLL_MAX_OPTIONS: () => POLL_MAX_OPTIONS,
  pollCategoryForCurrentFeed: () => pollCategoryForCurrentFeed,
  createPoll: () => createPoll, pollKeyHandler: () => pollKeyHandler,
  syncPollOptionUI: () => syncPollOptionUI,
  filterTopicGrid: () => filterTopicGrid
});
