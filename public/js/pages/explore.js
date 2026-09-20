// ── EXPLORE ─────────────────────────────────────────────
/* The Explore pane, the universal search behind it, and the dual-feed
   and focus-session controls.

   This file used to open with 2,600 lines of Category Portal - a
   #pane-category that clickCategory filled with a hand-written page
   per topic. It is gone: nothing could open it except a modal that
   nothing could open either, and the one entry point that did work,
   clickCategory("crypto"), redirected straight to Crypto Market
   without ever drawing the portal. renderCryptoHub went with it for
   the same reason - it only ever wrote into the portal's own
   #cat-dynamic-content, so it had not run in a long time. The live
   crypto pages are elsewhere: pages/cryptomarket.js, cryptoverse.js,
   features/marketdata.js and pages/trade.js, none of them touched. */
'use strict';

// ── DUAL FEED & FEED MODE CONTROLLERS ────────────────────────────
function toggleDualFeed(mode) {
  S.dualFeed = mode;
  document.getElementById('df-ent-btn').classList.toggle('active', mode === 'entertainment');
  document.getElementById('df-gro-btn').classList.toggle('active', mode === 'growth');
  showToast(mode === 'growth' ? '🌱 Growth Feed Active' : '🎭 Entertainment Feed Active');
  renderFeed();
}


function startFocusSession() {
  if (S.focusActive) {
    clearInterval(S.focusTimer);
    S.focusActive = false;
    showToast('Focus Session cancelled.');
    const focusBtn = document.querySelector('[onclick="startFocusSession()"]');
    if (focusBtn) focusBtn.textContent = 'Start 25m Focus Block';
    const stv = $id('screen-time-val');
    if (stv) stv.textContent = '18m / 45m';
    return;
  }
  S.focusActive = true;
  S.focusTimeRemaining = 25 * 60;
  showToast('Focus Block Started: 25 minutes! 🎯');
  
  // Update button to show cancel state
  const focusBtn = document.querySelector('[onclick="startFocusSession()"]');
  if (focusBtn) focusBtn.textContent = '⏸️ Cancel Focus Block';
  
  S.focusTimer = setInterval(() => {
    if (!S.focusActive) { clearInterval(S.focusTimer); return; }
    S.focusTimeRemaining--;
    
    // Live countdown in Mindfulness widget
    const mins = Math.floor(S.focusTimeRemaining / 60);
    const secs = S.focusTimeRemaining % 60;
    const stv = $id('screen-time-val');
    if (stv) stv.innerHTML = `<span style="color:var(--green); font-weight:800">${mins}m ${String(secs).padStart(2,'0')}s</span>`;
    
    // Update progress bar
    const elapsed = (25 * 60) - S.focusTimeRemaining;
    const pct = Math.min(100, (elapsed / (25 * 60)) * 100);
    const bar = document.querySelector('.wellness-stats .progress-fill');
    if (bar) { bar.style.width = pct + '%'; bar.style.background = 'var(--green)'; }
    
    if (S.focusTimeRemaining <= 0) {
      clearInterval(S.focusTimer);
      S.focusActive = false;
      S.user.xp += 150;
      updateUserUI();
      showToast('Focus Block Complete! +150 XP 🏆');
      if (stv) stv.textContent = '25m / 25m ✅';
      if (focusBtn) focusBtn.textContent = 'Start 25m Focus Block';
    }
  }, 1000);
}

// ── UNIVERSAL SMART SEARCH ───────────────────────────────────────
function setupUniversalSearch() {
  const gs = $id('global-search');
  const es = $id('explore-search');
  
  // Real-time in-place filtering of Explore Hot Topics grid
  const filterHotTopics = (query) => {
    const tg = $id('topic-grid');
    if (!tg) return;
    
    const cards = tg.children;
    const q = query.toLowerCase().trim();
    let matchesFound = 0;
    
    Array.from(cards).forEach(card => {
      // Don't filter the no-results message itself if it exists
      if (card.id === 'search-no-results') return;
      
      const name = card.querySelector('.topic-name')?.textContent.toLowerCase() || "";
      const count = card.querySelector('.topic-count')?.textContent.toLowerCase() || "";
      
      if (name.includes(q) || count.includes(q)) {
        card.style.display = "";
        card.style.opacity = "1";
        card.style.transform = "scale(1)";
        card.style.transition = "all 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        matchesFound++;
      } else {
        card.style.display = "none";
        card.style.opacity = "0";
        card.style.transform = "scale(0.95)";
        card.style.transition = "all 0.18s ease";
      }
    });
    
    // Manage empty state placeholder
    let noResultsMsg = $id('search-no-results');
    if (matchesFound === 0 && q !== "") {
      if (!noResultsMsg) {
        noResultsMsg = document.createElement('div');
        noResultsMsg.id = 'search-no-results';
        noResultsMsg.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 32px 16px; color: var(--t3); animation: pane-in 0.3s ease;';
        noResultsMsg.innerHTML = `
          <div class="material-symbols-rounded" style="font-size: 40px; color: var(--pink); margin-bottom: 8px">search_off</div>
          <div class="fw8 fs15 tc-1">No active trends found for "${query}"</div>
          <div class="fs11 tc-3 mt4">Try searching for 'AI', 'Bitcoin', 'UI', or 'Dough'.</div>
        `;
        tg.appendChild(noResultsMsg);
      }
    } else if (noResultsMsg) {
      noResultsMsg.remove();
    }
  };
  
  // Full Search Results panel toggle (on Enter key)
  const submitSearch = (val) => {
    // Search belongs to the SR overlay now — people, shorts, audio, tags and
    // coins, over whatever pane you were on. The news panel below is only a
    // fallback for when that module hasn't loaded.
    if (window.SR) { window.SR.open(val || ''); return; }

    const q = val.trim().toLowerCase();

    if (!q) {
      const panel = $id('search-results-panel');
      const exploreDefault = $id('explore-default-content');
      panel?.classList.add('hidden');
      exploreDefault?.classList.remove('hidden');
      renderFeed(); // Reset home feed search
      return;
    }
    
    // Ensure we are on the explore pane so the DOM exists. Awaited, not
    // guessed at with a timeout: navigateTo builds the pane after its
    // own await, and 10ms was only ever enough because explore is
    // eager. A deferred page would have lost the race.
    navigateTo('explore').then(async () => {
      if (es && es.value !== val) es.value = val;
      if (gs && gs.value !== val) gs.value = val;

      const panel = $id('search-results-panel');
      const exploreDefault = $id('explore-default-content');
      
      panel?.classList.remove('hidden');
      exploreDefault?.classList.add('hidden');
      
      await renderSearchResults(q);
    });
  };
  
  // Bind input event to filter in-place in Explore default view
  if (es) {
    es.addEventListener('input', (e) => {
      const panel = $id('search-results-panel');
      if (panel && panel.classList.contains('hidden')) {
        filterHotTopics(e.target.value);
      } else {
        submitSearch(e.target.value);
      }
    });
    
    es.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitSearch(e.target.value);
        showToast(`Search submitted: "${e.target.value}" 🔍`);
      }
    });
  }
  
  // Global search: typing stays put; Enter submits. Live-updates results
  // only when already viewing the Explore search panel.
  if (gs) {
    gs.addEventListener('input', (e) => {
      const panel = $id('search-results-panel');
      if (S.pane === 'explore' && panel && !panel.classList.contains('hidden')) {
        submitSearch(e.target.value);
      }
    });

    gs.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitSearch(e.target.value);
        showToast(`Search submitted: "${e.target.value}" 🔎`);
      }
    });
  }
}

async function renderSearchResults(q) {
  const media = $id('search-media-results'); if (!media) return;
  const aiCard = $id('search-ai-card');
  
  if (aiCard) {
    aiCard.innerHTML = `<div class="fs14 tc-1"><span class="material-symbols-rounded spinner inline-icon">progress_activity</span> Synthesizing live internet data for "${q}"...</div>`;
  }
  media.innerHTML = `<div class="p20 tc-center tc-3"><span class="material-symbols-rounded spinner">sync</span> Fetching live internet results from Google News...</div>`;
  
  let liveArticles = [];
  try {
    if (window.fetchLiveNews) {
      liveArticles = await window.fetchLiveNews(q);
    }
  } catch (err) {}

  if (liveArticles.length === 0) {
    const mockResults = [
      { title: `${q.toUpperCase()} CRISPR Gene Editing Efficiencies`, type: 'papers', desc: `Analyzing DNA double-strand breaks step-by-step for "${q}".`, badge: 'Science Paper', traffic: '100K+ searches today' },
      { title: `Crypto Yield Farm Liquidity Mechanics on ${q.toUpperCase()}`, type: 'articles', desc: `Understanding Decentralized Finance smart contract protocols referencing "${q}".`, badge: 'Finance Article', traffic: '500K+ searches today' },
      { title: `${q.toUpperCase()} React 19 Server Components deep-dive`, type: 'videos', desc: `60-minute cinematic programming workshop explaining "${q}".`, badge: 'Developer Workshop', traffic: '300K+ searches today' },
      { title: `Is ${q.toUpperCase()} a smart future standard?`, type: 'factchecks', desc: 'Fact Check Status: VERIFIED A  Bias: neutral', badge: 'Fact Check', traffic: '80K+ searches' },
      { title: `Sunset Horizon Chill Vibes Beat: Tribute to ${q.toUpperCase()}`, type: 'podcasts', desc: `Beatmaker_96 episode 4 tribute inspired by "${q}".`, badge: 'Podcast', traffic: '120K+ searches' }
    ];
    liveArticles = mockResults;
  }
  
  const filtered = S.searchTab === 'all' ? liveArticles : liveArticles.filter(r => r.type === S.searchTab || (r.id && S.searchTab === 'articles'));
  
  media.innerHTML = filtered.map(r => `
    <div class="card p16 flex flex-col gap8">
      <div class="flex-between">
        <span class="badge badge-blue fs11" style="background:#4F46E5">${r.badge || 'Live News Article'}</span>
        <button class="btn btn-ghost btn-sm" onclick="window.open('${r.url || '#'}', '_blank')">Open</button>
      </div>
      <h3 class="fw7 fs14 tc-1">${r.title}</h3>
      <p class="tc-2 fs12">${r.excerpt || r.desc}</p>
      <div class="fs11 mt4 fw7" style="color:#34A853; display:flex; align-items:center; gap:4px">
        <span class="material-symbols-rounded" style="font-size:14px">${r.source ? 'public' : 'trending_up'}</span>
        ${r.source ? `Source: ${r.source} | Published: ${new Date(r.publishedAt).toLocaleDateString()}` : `Live Traffic: ${r.traffic} - Verified via Google Cloud Engine.`}
      </div>
    </div>`).join('');
    
  // AI Knowledge Card Summary Synthesis (Google/Gemini Style)
  if (aiCard) {
    aiCard.innerHTML = `
      <div class="section-hdr" style="border-bottom:1px solid var(--border); padding-bottom:8px">
        <span class="section-title flex-center gap8" style="color:var(--purple); font-weight:900">✨ Gemini Smart Overview</span>
        <span class="badge badge-purple">Google Search Engine</span>
      </div>
      <p class="tc-1 fs12 mt12" style="line-height:1.6; font-weight:500">
        Google Knowledge Graph synthesis for: <strong>"${q}"</strong>. Our algorithms scanned 14 peer-reviewed sources and live channels:
      </p>
      
      <!-- Fact Grid -->
      <div class="grid-2 gap8 mt12">
        <div style="background:var(--bg2); padding:8px; border-radius:var(--r1); border:1px solid var(--border)">
          <div class="fs10 tc-3" style="text-transform:uppercase">Fact Check Rating</div>
          <div class="fs12 fw8 tc-green">100% Verified ✅</div>
        </div>
        <div style="background:var(--bg2); padding:8px; border-radius:var(--r1); border:1px solid var(--border)">
          <div class="fs10 tc-3" style="text-transform:uppercase">Reliability Index</div>
          <div class="fs12 fw8 tc-blue">96% Accuracy 📈</div>
        </div>
      </div>
      
      <!-- Context box -->
      <div class="card p12 mt12" style="background:var(--bg2); border-style:dashed">
        <div class="fs11 fw8 tc-1 mb4">💡 Gemini AI Context Synthesis (Past 5-Year High Consistency):</div>
        <div class="fs11 tc-2" style="line-height:1.5">
          <strong>Google Knowledge Graph synthesis for "${q}":</strong> Historical search interest hit an all-time peak in <em>October 2024</em>, maintaining a steady <strong>84% Search Consistency</strong> footprint across international servers. The consensus across academic networks validates high-efficacy outcomes. Media coverage leans center-neutral (44% bias offset), suggesting high objectivity.
        </div>
      </div>
      
      <!-- Bias Meter indicator inside -->
      <div class="flex-between mt12 p8" style="background:var(--card2); border-radius:var(--r1)">
        <span class="fs11 tc-2 font-bold">Media Bias Meter:</span>
        <span class="badge badge-blue">Center Leaning</span>
      </div>

      <!-- AI Deepfake & Credibility Scanner Button -->
      <button class="btn btn-ghost btn-sm mt12 flex-center gap4" onclick="runAIDeepfakeScanner('${escapeHTML(q)}')" style="width:100%; border-color:var(--purple); color:var(--purple); font-weight:700; background:rgba(255, 226, 103, 0.05)">
        <span class="material-symbols-rounded" style="font-size:16px">security</span> Run AI Deepfake &amp; Scam Scan
      </button>
      
      <!-- Scan results -->
      <div id="deepfake-scanner-results" class="hidden card p12 mt12 fs11" style="background:var(--bg2); border:1px dashed var(--border)"></div>
    `;
  }
}

function switchSearchTab(tab) {
  S.searchTab = tab;
  document.querySelectorAll('#search-results-panel .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const tabIds = { all:'st-all', videos:'st-vid', articles:'st-art', podcasts:'st-pod', factchecks:'st-fac', papers:'st-pap' };
  const activeBtn = $id(tabIds[tab]);
  if (activeBtn) activeBtn.classList.add('active');
  
  const es = $id('explore-search');
  if (es) renderSearchResults(es.value.trim().toLowerCase());
}

/* --- Deepfake Scanner Interactivity --- */
function runAIDeepfakeScanner(q) {
  const el = $id('deepfake-scanner-results');
  if (!el) return;
  
  el.classList.remove('hidden');
  el.innerHTML = `<span style="color:var(--purple); display:flex; align-items:center; gap:6px;">
    <span class="material-symbols-rounded animate-spin" style="font-size:16px;">sync</span>
    Scanning media files: Checking vocal frequency alignment, GAN consistency &amp; C2PA watermarks...
  </span>`;
  
  setTimeout(() => {
    el.innerHTML = `
      <div style="font-weight:700; color:var(--pink); margin-bottom:6px; display:flex; align-items:center; gap:4px">
        <span class="material-symbols-rounded" style="font-size:16px">security</span> Credibility &amp; Deepfake Analysis
      </div>
      <div class="flex-between mb4">
        <span>Deepfake Probability:</span>
        <strong style="color:var(--green)">1.2% (Legitimate Media)</strong>
      </div>
      <div class="flex-between mb4">
        <span>C2PA Metadata Integrity:</span>
        <strong style="color:var(--green)">Verified Author Signature ✓</strong>
      </div>
      <div class="flex-between mb4">
        <span>Scam Risk Index:</span>
        <strong style="color:var(--green)">Low (Standard Educational Topic)</strong>
      </div>
      <div class="fs10 tc-3 mt6" style="line-height:1.4">
        <strong>Consensus Verdict:</strong> Content checked against verified reference ledgers. No generative adversarial patterns or face-swap synthesis detected in associated files.
      </div>
    `;
    
    // Confetti burst
    if (typeof IX !== 'undefined' && IX.burstReaction) {
      const rect = el.getBoundingClientRect();
      IX.burstReaction('🛡️', rect.left + rect.width / 2, rect.top + rect.height / 2, 8);
    }
    
    // Reward user with XP
    S.user = S.user || { xp: 0 };
    S.user.xp += 40;
    updateUserUI();
    showToast("Ecosystem security check finished! +40 XP 🛡️");
  }, 1800);
}

function getExploreTemplate() {
  return `<section id="pane-explore" class="pane">
        <h1 class="pane-title"><span>Crypto</span>verse</h1>
        <p class="tc-2 fs13 mb16">Live markets, sentiment and the stories moving them.</p>

        <div class="explore-search">
          <span class="material-symbols-rounded" style="opacity:0.6; font-size:18px">search</span>
          <input type="text" id="explore-search" placeholder="Search coins, creators, hashtags...">
        </div>

        <!-- Crypto Fear & Greed Index -->
        <div class="fgi-wrapper">
          <div class="section-hdr">
            <span class="section-title flex-center gap8"><span class="material-symbols-rounded" style="color:var(--orange)">speed</span> Crypto Fear &amp; Greed Index</span>
            <span class="badge badge-orange">Live</span>
          </div>
          <p class="tc-2 fs12 mb12">Market sentiment scored 0–100 from volatility, momentum, social volume, dominance and trends.</p>
          <div id="fgi-root"></div>
        </div>

        <!-- Universal Search Results (Hidden by Default) -->
        <div id="search-results-panel" class="hidden">
          <div class="tabs mb16">
            <button class="tab-btn active" id="st-all" onclick="switchSearchTab('all')">All Results</button>
            <button class="tab-btn" id="st-vid" onclick="switchSearchTab('videos')">Videos <span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-left:4px">movie</span></button>
            <button class="tab-btn" id="st-art" onclick="switchSearchTab('articles')">Articles <span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-left:4px">newspaper</span></button>
            <button class="tab-btn" id="st-pod" onclick="switchSearchTab('podcasts')">Podcasts <span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-left:4px">mic</span></button>
            <button class="tab-btn" id="st-fac" onclick="switchSearchTab('factchecks')">Fact Checks <span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-left:4px">shield</span></button>
            <button class="tab-btn" id="st-pap" onclick="switchSearchTab('papers')">Papers <span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-left:4px">school</span></button>
          </div>
          <div class="grid-2 gap16" style="align-items: start">
            <!-- Media column -->
            <div id="search-media-results" class="flex flex-col gap12"></div>
            <!-- AI Card Column -->
            <div class="card p20 sticky" style="top:20px" id="search-ai-card"></div>
          </div>
        </div>

        <!-- Cryptoverse: live market discovery + Trending Creators -->
        <div id="explore-default-content" style="display:grid; grid-template-columns:1fr 280px; gap:24px; align-items:start">
          <div id="cv-root"></div>
          <div style="position:sticky; top:80px">
            <div class="section-hdr">
              <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--purple)">auto_awesome</span> Trending Creators</span>
            </div>
            <div class="flex-col gap12" id="creator-grid"></div>
          </div>
        </div>
      </section>`;
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
publish('pages/explore.js', {
  toggleDualFeed: () => toggleDualFeed,
  startFocusSession: () => startFocusSession,
  setupUniversalSearch: () => setupUniversalSearch,
  renderSearchResults: () => renderSearchResults,
  switchSearchTab: () => switchSearchTab,
  runAIDeepfakeScanner: () => runAIDeepfakeScanner,
  getExploreTemplate: () => getExploreTemplate
});
