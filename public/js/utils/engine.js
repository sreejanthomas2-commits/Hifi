// ── GLOBAL ENGINE AND LOCALIZER ─────────────────────────────────────

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

const TRANSLATIONS = {
  en: {
    feeds: "Home",
    explore: "Explore",
    reels: "Reels",
    shop: "Shop",
    fitness: "Fitness",
    gaming: "Gaming",
    learn: "Democracy Enclave",
    creator: "AI Studio",
    messages: "Messages",
    community: "Community",
    profile: "Profile",
    composer_placeholder: "What's trending with you today?",
    search_placeholder: "Search Trending...",
    post_btn: "Post",
    publish_success: "Published successfully! ✨ Check your Home Feed."
  },
  hi: {
    feeds: "मुख्य",
    explore: "अन्वेषण",
    reels: "रील्स",
    shop: "दुकान",
    fitness: "फिटनेस",
    gaming: "गेमिंग",
    learn: "ज्ञान एवं गिग्स",
    creator: "एआई स्टूडियो",
    messages: "संदेश",
    community: "समुदाय",
    profile: "प्रोफ़ाइल",
    composer_placeholder: "आज आपके साथ क्या ट्रेंड कर रहा है?",
    search_placeholder: "ट्रेंडिंग पर खोजें...",
    post_btn: "पोस्ट",
    publish_success: "सफलतापूर्वक प्रकाशित हुआ! अपना होम फ़ीड देखें।"
  },
  es: {
    feeds: "Inicio",
    explore: "Explorar",
    reels: "Reels",
    shop: "Tienda",
    fitness: "Fitness",
    gaming: "Juegos",
    learn: "Aprender",
    creator: "Estudio AI",
    messages: "Mensajes",
    community: "Comunidad",
    profile: "Perfil",
    composer_placeholder: "¿Qué es tendencia contigo hoy?",
    search_placeholder: "Buscar en Trending...",
    post_btn: "Publicar",
    publish_success: "¡Publicado con éxito! Revisa tu feed de inicio."
  },
  ja: {
    feeds: "ホーム",
    explore: "探検",
    reels: "リール",
    shop: "ショップ",
    fitness: "フィットネス",
    gaming: "ゲーム",
    learn: "学習＆ギグ",
    creator: "AIスタジオ",
    messages: "メッセージ",
    community: "コミュニティ",
    profile: "プロフィール",
    composer_placeholder: "今日のあなたのトレンドは何ですか？",
    search_placeholder: "トレンドで検索...",
    post_btn: "投稿",
    publish_success: "正常に投稿されました！フィードを確認してください。"
  }
};

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
  S.lang = lang;
  localStorage.setItem('ts_lang', lang);
  
  const trans = TRANSLATIONS[lang] || TRANSLATIONS.en;
  
  // 1. Translate Sidebar Nav items
  const sidebarMapping = {
    'feeds': trans.feeds,
    'explore': trans.explore,
    'reels': trans.reels,
    'shop': trans.shop,
    'fitness': trans.fitness,
    'gaming': trans.gaming,
    'learn': trans.learn,
    'creator': trans.creator,
    'messages': trans.messages,
    'community': trans.community,
    'profile': trans.profile
  };
  
  Object.keys(sidebarMapping).forEach(paneKey => {
    const navItem = document.querySelector(`.nav-item[data-pane="${paneKey}"] .nav-label`);
    if (navItem) navItem.textContent = sidebarMapping[paneKey];
    const mNavItem = document.querySelector(`.m-nav-btn[data-pane="${paneKey}"] span:not(.material-symbols-rounded)`);
    if (mNavItem) mNavItem.textContent = sidebarMapping[paneKey];
  });
  
  // 2. Translate Pane Titles dynamically
  const paneTitles = {
    'feeds': lang === 'en' ? '<span>Home</span> Feed' : (lang === 'hi' ? '<span>मुख्य</span> फ़ीड' : (lang === 'es' ? '<span>Inicio</span> Feed' : '<span>ホーム</span>フィード')),
    'explore': lang === 'en' ? '<span>Explore</span> Universe' : (lang === 'hi' ? '<span>खोज</span> ब्रह्मांड' : (lang === 'es' ? '<span>Explorar</span> Universo' : '<span>探検</span>宇宙')),
    'reels': lang === 'en' ? '<span>Reels</span> & Shorts' : (lang === 'hi' ? '<span>रील्स</span> और शॉर्ट्स' : (lang === 'es' ? '<span>Reels</span> y Shorts' : '<span>リール</span>＆ショート')),
    'fitness': lang === 'en' ? '💪 <span>Fitness</span> Hub' : (lang === 'hi' ? '💪 <span>फिटनेस</span> हब' : (lang === 'es' ? '💪 <span>Fitness</span> Centro' : '💪 <span>フィットネス</span>ハブ')),
    'gaming': lang === 'en' ? '🎮 <span>Game</span> Hub' : (lang === 'hi' ? '🎮 <span>गेम</span> हब' : (lang === 'es' ? '🎮 <span>Juegos</span> Centro' : '🎮 <span>ゲーム</span>ハブ')),
    'learn': lang === 'en' ? '🎓 <span>Democracy</span> Enclave' : (lang === 'hi' ? '🎓 <span>लोकतंत्र</span> एन्क्लेव' : (lang === 'es' ? '🎓 <span>Democracia</span> Enclave' : '🎓 <span>民主</span>飞地')),
    'creator': lang === 'en' ? '✨ <span>Creator</span> Studio' : (lang === 'hi' ? '✨ <span>क्रिएटर</span> स्टूडियो' : (lang === 'es' ? '✨ <span>Creador</span> Estudio' : '✨ <span>クリエイター</span>スタジオ')),
    'community': lang === 'en' ? '🌐 <span>Community</span>' : (lang === 'hi' ? '🌐 <span>समुदाय</span>' : (lang === 'es' ? '🌐 <span>Comunidad</span>' : '🌐 <span>コミュニティ</span>'))
  };
  
  Object.keys(paneTitles).forEach(paneKey => {
    const titleEl = document.querySelector(`#pane-${paneKey} .pane-title`);
    if (titleEl) titleEl.innerHTML = paneTitles[paneKey];
  });
  
  // Translate shop hero title
  const shopHeroTitle = document.querySelector('.shop-hero-title');
  if (shopHeroTitle) shopHeroTitle.innerHTML = `🛒 ${trans.shop}`;
  
  // 3. Translate Search Bar Placeholders
  const searchInput = $id('global-search');
  if (searchInput) searchInput.placeholder = trans.search_placeholder;
  const exploreSearch = $id('explore-search');
  if (exploreSearch) exploreSearch.placeholder = trans.search_placeholder;
  
  // 4. Translate Post Composer Placeholders & Buttons
  const postInp = $id('post-input');
  if (postInp) postInp.placeholder = trans.composer_placeholder;
  const postBtn = document.querySelector('button[onclick="publishPost()"]');
  if (postBtn) postBtn.textContent = trans.post_btn;
  
  // 5. Translate Server Latency Node Label
  const nodeLabelText = lang === 'hi' ? 'वैश्विक सर्वर नोड:' : (lang === 'es' ? 'Nodo del Servidor Global:' : (lang === 'ja' ? 'グローバルサーバーノード:' : 'Global Server Node:'));
  const lbl = $id('server-node-lbl');
  if (lbl) lbl.textContent = nodeLabelText;

  // 6. Update language select dropdown value
  const selector = $id('lang-selector');
  if (selector) selector.value = lang;
  
  showToast(`Language updated to: ${selector ? selector.options[selector.selectedIndex].text : lang} 🌍`);
}

function savePostsToLocal() {
  localStorage.setItem('ts_posts', JSON.stringify(DATA.posts));
}

function saveCommentsToLocal() {
  localStorage.setItem('ts_comments_db', JSON.stringify(DATA.commentsDb));
}

function initNetworkLatencyTracker() {
  const latencyVal = $id('latency-val');
  if (!latencyVal) return;
  
  setInterval(() => {
    const lat = Math.floor(18 + Math.random() * 19); // Fluctuates 18ms-36ms
    const activeWord = S.lang === 'hi' ? 'सक्रिय' : (S.lang === 'es' ? 'Activo' : (S.lang === 'ja' ? 'アクティブ' : 'Active'));
    
    latencyVal.innerHTML = `
      <span style="width:6px; height:6px; background:var(--green); border-radius:50%; display:inline-block; box-shadow:0 0 8px var(--green)"></span> 
      ${activeWord} (${lat}ms)
    `;
  }, 4000);
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
        
        // 1. Healthy scroll reminder system
        S.scrollCount = (S.scrollCount || 0) + 1;
        if (S.scrollCount >= 15) {
          S.scrollCount = 0;
          if (typeof triggerMindfulnessIntervention === 'function') {
            triggerMindfulnessIntervention();
          }
        }

        // 2. Dynamically increment ad revenue by a fraction of a cent
        const shareEl = $id('ew-ad-share');
        if (shareEl) {
          const currentVal = parseFloat(shareEl.textContent.replace('$', ''));
          const newVal = currentVal + (0.01 + Math.random()*0.02);
          shareEl.textContent = `$${newVal.toFixed(2)}`;
        }
      }
    });
  });
}

function simulateCreatorTip() {
  const amount = (10 + Math.random()*40).toFixed(2);
  showToast(`🎁 Tipped active creator $${amount} from your ecosystem balance!`);
  
  const balanceEl = $id('ew-ad-share');
  if (balanceEl) {
    const currentVal = parseFloat(balanceEl.textContent.replace('$', ''));
    if (currentVal >= amount) {
      balanceEl.textContent = `$${(currentVal - amount).toFixed(2)}`;
    }
  }
  
  // Confetti reaction burst
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    IX.burstReaction('💸', window.innerWidth/2, window.innerHeight/2);
  }
}

// ── CRYPTO TIPPING ENGINE ─────────────────────────────────────────
window.openTipModal = function(authorName, handle) {
  // Remove existing if any
  const existing = document.getElementById('tip-modal-overlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'tip-modal-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(8px); animation:pane-in 0.3s ease';
  
  overlay.innerHTML = `
    <div class="card" style="width:90%; max-width:400px; padding:24px; position:relative;">
      <button class="icon-btn" onclick="document.getElementById('tip-modal-overlay').remove()" style="position:absolute; top:12px; right:12px;"><span class="material-symbols-rounded">close</span></button>
      <div class="text-center mb16">
        <div class="avatar av-lg mx-auto" style="background:var(--g-brand); display:grid; place-items:center; color:#fff; font-size:24px;">💎</div>
        <h3 class="fw9 tc-1 mt12">Tip ${authorName}</h3>
        <div class="fs12 tc-3">${handle}</div>
      </div>
      
      <div class="form-group mb12">
        <label class="form-label">Select Coin & Amount</label>
        <div class="flex gap8">
          <input class="input" type="number" id="tip-amount" placeholder="0.0" style="flex:1">
          <select class="input" id="tip-coin" style="width:100px">
            <option value="USDT">USDT</option>
            <option value="TREND">TREND</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
            <option value="SOL">SOL</option>
            <option value="DOGE">DOGE</option>
          </select>
        </div>
      </div>
      
      <div class="fs11 tc-3 mb16" style="text-align:right">Platform Fee: <span class="tc-pink fw7">1.0%</span></div>
      
      <button class="btn btn-primary" style="width:100%; background:linear-gradient(135deg, var(--blue), var(--purple))" onclick="submitTip('${authorName}', '${handle}')">Send Tip Now</button>
    </div>
  `;
  document.body.appendChild(overlay);
};

window.submitTip = function(authorName, handle) {
  const amt = parseFloat(document.getElementById('tip-amount').value);
  const coin = document.getElementById('tip-coin').value;
  
  if (!amt || amt <= 0) {
    showToast('Enter a valid tip amount ❌');
    return;
  }
  
  const totalCost = amt * 1.01; // 1% fee
  const b = typeof DATA !== 'undefined' && DATA.wallet ? DATA.wallet.balances : null;
  
  if (!b || !b[coin] || b[coin] < totalCost) {
    showToast(`Insufficient ${coin} balance (includes 1% fee) ❌`);
    return;
  }
  
  // Deduct
  b[coin] -= totalCost;
  
  // Log to ledger
  const ledger = document.getElementById('wallet-ledger');
  if (ledger) {
    const div = document.createElement('div');
    div.className = "flex-between py4";
    div.style.borderBottom = "1px solid var(--border)";
    div.innerHTML = `
      <span class="tc-pink" style="display:inline-flex; align-items:center; gap:4px"><span class="material-symbols-rounded" style="font-size:14px">volunteer_activism</span> Tipped ${handle}</span>
      <span class="fw7">-${totalCost.toFixed(4)} ${coin}</span>
    `;
    ledger.prepend(div);
  }
  
  document.getElementById('tip-modal-overlay').remove();
  showToast(`Sent ${amt} ${coin} tip to ${authorName}! 💎`);
  
  // Rain animation
  if (typeof IX !== 'undefined' && IX.burstReaction) {
    for(let i=0; i<5; i++) {
      setTimeout(() => IX.burstReaction('💎', window.innerWidth/2 + (Math.random()*100-50), window.innerHeight/2), i*100);
    }
  }
};
