// ── GLOBAL ENGINE AND LOCALIZER ─────────────────────────────────────

/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

window.updateUserUI = function() {
  if (typeof S === 'undefined' || !S.user) return;
  const av = document.getElementById('sidebar-av');
  const isAnon = S.anonymousMode;
  
  if (av) {
    if (isAnon) {
      av.textContent = '👻';
      av.style.background = '#333';
    } else {
      av.textContent = (S.user.fname.charAt(0) || '') + (S.user.lname.charAt(0) || '');
      av.style.background = 'var(--g-brand)';
    }
  }
  
  const nameEl = document.getElementById('sidebar-name');
  if (nameEl) nameEl.textContent = isAnon ? 'Anonymous User' : `${S.user.fname} ${S.user.lname}`;
  
  const handleEl = document.getElementById('sidebar-handle');
  if (handleEl) handleEl.textContent = isAnon ? '@ghost_user' : S.user.handle;
  
  const xpEl = document.getElementById('sidebar-xp');
  if (xpEl) xpEl.textContent = `XP: ${S.user.xp}`;
};

window.toggleAnonymousMode = function(checked) {
  if (typeof S !== 'undefined') {
    S.anonymousMode = checked;
    updateUserUI();
    if (typeof showToast === 'function') {
      showToast(checked ? '👻 Ghost Mode Activated. Your identity is hidden.' : '👤 Ghost Mode Deactivated.');
    }
  }
};

/* Interface strings live in js/data/i18n.js, which loads first. Kept under
   the old name so nothing else has to change. */
const TRANSLATIONS = window.I18N || {};

const MODE_CATEGORY_MAP = {
  entertainment: ['design', 'art', 'music', 'gaming', 'ent'],
  focus: ['tech', 'productivity', 'business', 'coding', 'innovation'],
  study: ['tech', 'science', 'education', 'blockchain', 'cyber', 'robotics'],
  chill: ['music', 'art', 'nature', 'travel', 'photo', 'philosophy'],
  motivation: ['motivation', 'career', 'sports', 'fitness'],
  news: ['politics', 'news', 'world', 'climate', 'emergency'],
  wellness: ['fitness', 'health', 'wellness', 'food'],
  productivity: ['productivity', 'career', 'business', 'startups', 'freelance']
};

const MODE_REEL_MAP = {
  entertainment: ['🎵', '🎨'],
  focus: ['💻'],
  study: ['💻'],
  chill: ['🌅', '🎨', '🐶'],
  motivation: ['💪'],
  news: ['💻'],
  wellness: ['🧘', '💪', '🍕'],
  productivity: ['💻']
};

const MODE_LEARN_MAP = {
  entertainment: ['Design'],
  focus: ['Code'],
  study: ['Science', 'Code'],
  chill: ['Design'],
  motivation: ['Business'],
  news: ['Science'],
  wellness: ['Science'],
  productivity: ['Code', 'Business']
};

const MODE_PEOPLE_MAP = {
  entertainment: ['Sarah Chen', 'Zara Ahmed'],
  focus: ['Dev Kumar', 'Sarah Chen'],
  study: ['Dev Kumar', 'Sarah Chen'],
  chill: ['Sarah Chen', 'Marcus Webb'],
  motivation: ['Marcus Webb', 'Dev Kumar'],
  news: ['Dev Kumar', 'Zara Ahmed'],
  wellness: ['Marcus Webb'],
  productivity: ['Dev Kumar', 'Sarah Chen']
};

function formatRelativeTime(val) {
  if (typeof val === 'string') return val;
  const diff = Date.now() - val;
  if (diff < 1000) return 'just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function applyLanguage(lang) {
  const table = window.I18N || {};
  const en = table.en || {};
  // A region code falls back to its base language, then to English, key by key.
  const exact = table[lang] || table[String(lang).split('-')[0]] || {};
  const t = k => (exact[k] !== undefined ? exact[k] : (en[k] !== undefined ? en[k] : ''));
  const esc = v => (typeof escapeHTML === 'function' ? escapeHTML(String(v)) : String(v));

  S.lang = lang;
  try { localStorage.setItem('ts_lang', lang); } catch (e) {}

  const info = (window.LANGS || []).find(l => l.c === lang);
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', info && info.r ? 'rtl' : 'ltr');

  // 1. Sidebar and mobile nav labels
  const labels = {
    feeds: t('feeds'), explore: t('explore'), reels: t('reels'), shop: t('shop'),
    gaming: t('gaming'), messages: t('messages'), community: t('community'), profile: t('profile')
  };
  Object.keys(labels).forEach(pane => {
    if (!labels[pane]) return;
    const navItem = document.querySelector(`.nav-item[data-pane="${pane}"] .nav-label`);
    if (navItem) navItem.textContent = labels[pane];
    const mNavItem = document.querySelector(`.m-nav-btn[data-pane="${pane}"] span:not(.material-symbols-rounded)`);
    if (mNavItem) mNavItem.textContent = labels[pane];
  });

  // 2. Pane titles. Cryptoverse and Shorty are product names, so they stand.
  const paneTitles = {
    feeds: `<span>${esc(t('feeds'))}</span> ${esc(t('word_feed'))}`,
    explore: '<span>Crypto</span>verse',
    reels: '<span>Shorty</span>',
    gaming: `🎮 <span>${esc(t('gaming'))}</span> ${esc(t('word_hub'))}`,
    community: `🌐 <span>${esc(t('community'))}</span>`
  };
  Object.keys(paneTitles).forEach(pane => {
    const titleEl = document.querySelector(`#pane-${pane} .pane-title`);
    if (titleEl) titleEl.innerHTML = paneTitles[pane];
  });

  const shopHeroTitle = document.querySelector('.shop-hero-title');
  if (shopHeroTitle) shopHeroTitle.innerHTML = `🛒 ${esc(t('shop'))}`;

  // 3. Search and composer
  const searchInput = $id('global-search');
  if (searchInput) searchInput.placeholder = t('search_placeholder');
  const exploreSearch = $id('explore-search');
  if (exploreSearch) exploreSearch.placeholder = t('search_placeholder');

  const postInp = $id('post-input');
  if (postInp) postInp.placeholder = t('composer_placeholder');
  const postBtn = document.querySelector('button[onclick="publishPost()"]');
  if (postBtn) postBtn.textContent = t('post_btn');
}

function savePostsToLocal() {
  localStorage.setItem('ts_posts', JSON.stringify(DATA.posts));
}

function saveCommentsToLocal() {
  localStorage.setItem('ts_comments_db', JSON.stringify(DATA.commentsDb));
}

// ── AD REVENUE ACCRUAL ON SCROLL ──
let lastScrollTime = 0;
function initAdRevenueAccrual() {
  // Listen for scroll events on any active pane to accumulate ad share & track healthy screen time
  document.querySelectorAll('.pane').forEach(pane => {
    pane.addEventListener('scroll', () => {
      const now = Date.now();
      if (now - lastScrollTime > 300) {
        lastScrollTime = now;
        
        // Dynamically increment ad revenue by a fraction of a cent
        const shareEl = $id('ew-ad-share');
        if (shareEl) {
          const match = shareEl.textContent.match(/\$([0-9.]+)/);
          if (match) {
            const currentVal = parseFloat(match[1]);
            const newVal = currentVal + (0.01 + Math.random()*0.02);
            const btcVal = (newVal / (window.liveBtcPrice || 68450)).toFixed(4);
            shareEl.textContent = `$${newVal.toFixed(2)} (${btcVal} BTC)`;
          }
        }
      }
    });
  });
}

function simulateCreatorTip() {
  const amount = parseFloat((10 + Math.random()*40).toFixed(2));
  const btcAmount = (amount / (window.liveBtcPrice || 68450)).toFixed(4);
  showToast(`🎁 Tipped active creator $${amount.toFixed(2)} (${btcAmount} BTC) from your ecosystem balance!`);
  
  const balanceEl = $id('ew-ad-share');
  if (balanceEl) {
    const match = balanceEl.textContent.match(/\$([0-9.]+)/);
    if (match) {
      const currentVal = parseFloat(match[1]);
      if (currentVal >= amount) {
        const newVal = currentVal - amount;
        const btcVal = (newVal / (window.liveBtcPrice || 68450)).toFixed(4);
        balanceEl.textContent = `$${newVal.toFixed(2)} (${btcVal} BTC)`;
      }
    }
  }
  
  // Confetti reaction burst
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('💸', window.innerWidth/2, window.innerHeight/2);
  }

  // Tipping is a contribution to the network, so it counts toward reputation.
  if (typeof SF !== 'undefined') SF.rep('gave_tip');
}

/* ── COIN ICONS ────────────────────────────────────────────────────
   Every coin renders with its official logo, straight from the
   CoinGecko payload (`image`) that fetchCryptoPrices already stores.
   A tinted monogram sits underneath the artwork and is only ever seen
   if the image fails to load, or for tokens CoinGecko doesn't carry
   (TREND, NEON). Its hue is derived from the ticker, so a given coin
   always gets the same colour. */
const TOKEN_MONOGRAM = { TREND: 'T', NEON: 'N' };

/* Real currency glyphs — for the one place markup can't go: <option>. */
const CURRENCY_GLYPH = {
  BTC:'₿', ETH:'Ξ', SOL:'◎', DOGE:'Ð', USDT:'₮', USDC:'$', XRP:'✕',
  LTC:'Ł', BCH:'Ƀ', DASH:'Đ', XMR:'ɱ', ADA:'₳', TREND:'⬥', NEON:'◈'
};

const normSym = s => String(s || '').split('/')[0].trim().toUpperCase();

function coinHue(sym) {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) % 360;
  return h;
}

/* Premium 2D chip: official artwork layered over a monogram fallback. */
/* Exchange tickers for coins whose CoinGecko symbol isn't one. The feed key
   stays as CoinGecko sends it (Binance streams use it); only the label
   changes. 币安人生 trades as BINANCELIFE on most exchanges. */
const TICKER_ALIAS = { '币安人生': 'BINANCELIFE' };
window.tickerOf = sym => TICKER_ALIAS[normSym(sym)] || normSym(sym);

window.coinIcon = function(symbol, size = 28) {
  const sym = normSym(symbol);
  if (!sym) return '';
  let live = (window.liveCryptoPrices || {})[sym] || {};
  // Tokenized stocks keep their logos in TokenMarkets, not the crypto feed.
  if (!live.image && window.TokenMarkets && TokenMarkets.info) {
    const tm = TokenMarkets.info(sym);
    if (tm) live = { name: tm.name, image: tm.image };
  }
  const name = live.name || sym;
  const shown = TICKER_ALIAS[sym] || sym;
  const label = TOKEN_MONOGRAM[sym] || (shown.length <= 3 ? shown : shown.slice(0, 3));
  const ratio = label.length >= 3 ? 0.30 : (label.length === 2 ? 0.38 : 0.44);
  const fs = Math.max(7, Math.round(size * ratio));
  // Both layers are decorative: every call site prints the ticker next to
  // the chip, so exposing them would read the symbol twice.
  const mono = `<span class="coin-ic-mono" aria-hidden="true" style="--h:${coinHue(sym)}; font-size:${fs}px">${escapeHTML(label)}</span>`;
  const img = /^https:\/\/[^\s"'<>]+$/.test(String(live.image || '')) ? live.image : '';
  const art = img
    ? `<img class="coin-ic-img" src="${escapeHTML(img)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`
    : '';
  return `<span class="coin-ic" style="--sz:${size}px" title="${escapeHTML(name)}">${mono}${art}</span>`;
};

/* Text-only symbol, for <option> and other markup-free contexts. */
window.coinGlyph = function(symbol) {
  return CURRENCY_GLYPH[normSym(symbol)] || '';
};

// ── CRYPTO TIPPING ENGINE ─────────────────────────────────────────
/* Tips are creator payments, so they come out of the social wallet
   (DATA.wallet.balances) — the same account SocialFi pays rewards into.

   Fixed here:
   · The overlay sat at z-index 9999, under the Shorty player (10000),
     so tipping from a short opened an invisible window.
   · Author and handle were pasted raw into an onclick string, so a name
     with an apostrophe broke the button. They now ride on dataset.
   · You couldn't see what you had; the balance now shows and updates.   */
const TIP_FEE = 0.01;
/* The coins tipping starts with. Anything else you hold is appended by
   tipCoins() below — the fixed list meant a coin in the wallet could not
   be tipped, while chat and Pay both accepted it. */
const TIP_COINS = ['USDT', 'TREND', 'BTC', 'ETH', 'SOL', 'DOGE'];

function tipCoins() {
  if (typeof MNY === 'undefined') return TIP_COINS;
  const out = TIP_COINS.slice();
  MNY.holdings().forEach(r => { if (r.priced && out.indexOf(r.sym) === -1) out.push(r.sym); });
  return out;
}

/* Spendable across Funding and Spot, the same figure the payment itself
   uses — the old one read Funding only and refused tips a user could
   plainly afford. */
function tipHave(coin) {
  if (typeof MNY !== 'undefined') return MNY.spendable(coin);
  const b = tipWallet() || {};
  return Number(b[coin]) || 0;
}

function tipWallet() {
  return (typeof DATA !== 'undefined' && DATA.wallet) ? DATA.wallet.balances : null;
}

function tipFmt(n) {
  return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 2 : 6 });
}

window.openTipModal = function(authorName, handle) {
  const existing = document.getElementById('tip-modal-overlay');
  if (existing) existing.remove();

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s || '')) : String(s || ''));
  const first = tipCoins().find(c => tipHave(c) > 0) || 'USDT';

  const overlay = document.createElement('div');
  overlay.id = 'tip-modal-overlay';
  overlay.className = 'tip-scrim';
  overlay.dataset.author = authorName || '';
  overlay.dataset.handle = handle || '';
  overlay.innerHTML = `
    <div class="tip-card" role="dialog" aria-label="Send a tip">
      <button class="icon-btn tip-x" onclick="closeTipModal()" aria-label="Close">
        <span class="material-symbols-rounded">close</span></button>
      <div class="tip-head">
        <div class="tip-av">${esc(String(authorName || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</div>
        <div class="tip-to">Tip <b>${esc(authorName)}</b></div>
        <div class="tip-handle">${esc(handle)}</div>
      </div>

      <label class="tip-lbl">Amount</label>
      <div class="tip-row">
        <input class="input" type="number" id="tip-amount" min="0" step="any" placeholder="0.00" oninput="updateTipSummary()">
        <select class="input" id="tip-coin" onchange="updateTipSummary()">
          ${tipCoins().map(c => `<option value="${c}"${c === first ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="tip-quick">${[1, 5, 10, 25].map(n => `<button class="tip-q" onclick="setTipAmount(${n})">${n}</button>`).join('')}</div>

      <div class="tip-sum" id="tip-summary"></div>
      <button class="btn btn-primary tip-send" id="tip-send" onclick="submitTip()">Send tip</button>
      <div class="tip-note">Paid from your social wallet. Paper balance — no real funds move.</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeTipModal(); });
  document.body.appendChild(overlay);
  updateTipSummary();
  const amt = document.getElementById('tip-amount');
  if (amt) amt.focus();
};

window.closeTipModal = function() {
  const o = document.getElementById('tip-modal-overlay');
  if (o) o.remove();
};

window.setTipAmount = function(n) {
  const el = document.getElementById('tip-amount');
  if (el) { el.value = n; updateTipSummary(); }
};

/* Live balance, fee and total — and the send button only enables when the
   tip is actually affordable, so the error never has to be a surprise. */
window.updateTipSummary = function() {
  const box = document.getElementById('tip-summary');
  const btn = document.getElementById('tip-send');
  if (!box) return;
  const coin = (document.getElementById('tip-coin') || {}).value || 'USDT';
  const amt = parseFloat((document.getElementById('tip-amount') || {}).value) || 0;
  const have = tipHave(coin);
  const fee = amt * TIP_FEE, total = amt + fee;
  const short = amt > 0 && total > have;
  box.innerHTML = `
    <div class="tip-line"><span>Available</span><b>${tipFmt(have)} ${coin}</b></div>
    <div class="tip-line"><span>Fee (${TIP_FEE * 100}%)</span><b>${tipFmt(fee)} ${coin}</b></div>
    <div class="tip-line tip-total"><span>Total</span><b class="${short ? 'tc-red' : ''}">${tipFmt(total)} ${coin}</b></div>
    ${short ? `<div class="tip-warn">Not enough ${coin} — you have ${tipFmt(have)}.</div>` : ''}`;
  if (btn) btn.disabled = !(amt > 0) || short;
};

window.submitTip = function() {
  const overlay = document.getElementById('tip-modal-overlay');
  if (!overlay) return;
  const authorName = overlay.dataset.author, handle = overlay.dataset.handle;
  const amt = parseFloat(document.getElementById('tip-amount').value);
  const coin = document.getElementById('tip-coin').value;

  if (!amt || amt <= 0) { showToast('Enter a tip amount.'); return; }

  const totalCost = amt * (1 + TIP_FEE);

  /* Through MNY, so the tip is one ledger line, draws on the same money
     a chat send does, and repaints every balance on screen. The old
     version wrote straight to the wallet object and pushed a row into
     whatever history element happened to be in the DOM — which vanished
     on reload. */
  if (typeof MNY !== 'undefined') {
    const out = MNY.spend(coin, totalCost, {
      kind: 'tip', via: 'Tip', to: handle || authorName,
      note: `Tip to ${authorName || handle}` + (TIP_FEE ? ` (incl. ${TIP_FEE * 100}% fee)` : '')
    });
    if (!out.ok) { showToast(out.msg); updateTipSummary(); return; }
    closeTipModal();
    showToast(`Sent ${tipFmt(amt)} ${coin} to ${authorName}${out.moved > 0 ? ` · ${tipFmt(out.moved)} from Spot` : ''}`);
  } else {
    const b = tipWallet();
    if (!b || (b[coin] || 0) < totalCost) {
      showToast(`Not enough ${coin} (including the 1% fee).`);
      updateTipSummary();
      return;
    }
    b[coin] -= totalCost;        // the wallet proxy persists this
    closeTipModal();
    showToast(`Sent ${tipFmt(amt)} ${coin} to ${authorName}`);
  }

  if (typeof IX !== 'undefined' && IX.burstReaction) {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => IX.burstReaction('💎', window.innerWidth / 2 + (Math.random() * 100 - 50), window.innerHeight / 2), i * 100);
    }
  }
};

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
publish('utils/engine.js', {
  TRANSLATIONS: () => TRANSLATIONS,
  MODE_CATEGORY_MAP: () => MODE_CATEGORY_MAP,
  MODE_REEL_MAP: () => MODE_REEL_MAP, MODE_LEARN_MAP: () => MODE_LEARN_MAP,
  MODE_PEOPLE_MAP: () => MODE_PEOPLE_MAP,
  formatRelativeTime: () => formatRelativeTime,
  applyLanguage: () => applyLanguage,
  savePostsToLocal: () => savePostsToLocal,
  saveCommentsToLocal: () => saveCommentsToLocal,
  lastScrollTime: () => lastScrollTime,
  initAdRevenueAccrual: () => initAdRevenueAccrual,
  simulateCreatorTip: () => simulateCreatorTip,
  TOKEN_MONOGRAM: () => TOKEN_MONOGRAM,
  CURRENCY_GLYPH: () => CURRENCY_GLYPH, normSym: () => normSym,
  coinHue: () => coinHue, TICKER_ALIAS: () => TICKER_ALIAS,
  TIP_FEE: () => TIP_FEE, TIP_COINS: () => TIP_COINS,
  tipCoins: () => tipCoins, tipHave: () => tipHave,
  tipWallet: () => tipWallet, tipFmt: () => tipFmt
});
