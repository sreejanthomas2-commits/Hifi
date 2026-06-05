// ── SHORTY (Formerly Reels) ────────────────────────────────────────────────────────
function renderReels(filter = 'all') {
  const el = $id('reels-grid'); if (!el) return;
  
  let reels = DATA.reels;
  const emojis = MODE_REEL_MAP[S.feedMode || 'entertainment'];
  if (emojis) {
    reels = reels.filter(r => emojis.includes(r.emoji));
  }
  if (!reels.length) reels = DATA.reels;
  
  el.innerHTML = reels.map(r => {
    const iconData = get3DIconForEmoji(r.emoji);
    const masterIdx = DATA.reels.indexOf(r);
    return `
    <div class="reel-card" onclick="openShortyPopup(${masterIdx})">
      <div class="reel-thumb" style="background:${r.bg}">
        <span class="material-symbols-rounded emoji-3d" style="font-size:48px; color:${iconData.color}; text-shadow: 0 0 16px ${iconData.color}s">${iconData.icon}</span>
        <div class="reel-overlay">
          <div class="reel-creator">${r.creator}</div>
          <div class="reel-desc">${r.desc}</div>
          <div class="reel-stats">
            <span class="reel-stat" style="display:inline-flex; align-items:center; gap:4px">
              <span class="material-symbols-rounded" style="font-size:12px; color:var(--pink); font-variation-settings:'FILL' 1">favorite</span> ${r.likes}
            </span>
            <span class="reel-stat" style="display:inline-flex; align-items:center; gap:4px">
              <span class="material-symbols-rounded" style="font-size:12px; color:var(--blue)">visibility</span> ${r.views}
            </span>
          </div>
        </div>
        <div class="reel-actions">
          <div class="reel-act" onclick="event.stopPropagation(); showToast('Liked!')"><span class="material-symbols-rounded" style="font-size:16px; color:#fff">favorite</span></div>
          <div class="reel-act" onclick="event.stopPropagation(); showToast('Commented!')"><span class="material-symbols-rounded" style="font-size:16px; color:#fff">chat_bubble</span></div>
          <div class="reel-act" onclick="event.stopPropagation(); showToast('Shared!')"><span class="material-symbols-rounded" style="font-size:16px; color:#fff">share</span></div>
          <div class="reel-act" onclick="event.stopPropagation(); showToast('Saved!')"><span class="material-symbols-rounded" style="font-size:16px; color:#fff">bookmark</span></div>
        </div>
      </div>
    </div>`;
  }).join('');
}
function filterReels(f) {
  document.querySelectorAll('#pane-reels .tab-btn').forEach((b,i) => {
    b.classList.toggle('active', ['all','trending','following','new'][i] === f);
  });
  renderReels(f);
}

function getReelsTemplate() {
  return `<section id="pane-reels" class="pane">
        <h1 class="pane-title"><span class="material-symbols-rounded emoji-3d" style="color:var(--orange)">electric_bolt</span> <span>Shorty</span> Hub</h1>

        <div class="tabs">
          <button class="tab-btn active" onclick="filterReels('all')">All</button>
          <button class="tab-btn" onclick="filterReels('trending')">Trending</button>
          <button class="tab-btn" onclick="filterReels('following')">Following</button>
          <button class="tab-btn" onclick="filterReels('new')">New Shortys</button>
        </div>

        <div class="reels-grid" id="reels-grid"></div>
      </section>`;
}

// ── SHORTY VIEWER ──────────────────────────────────────────────────
window.openShortyPopup = function(idx) {
  let modal = document.getElementById('reels-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reels-modal';
    modal.style.cssText = 'position:fixed; inset:0; z-index:9999; background:#000; overflow-y:scroll; scroll-snap-type:y mandatory; scroll-behavior:smooth; opacity:0; transition:all 0.3s ease;';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <!-- Top Bar Controls -->
    <div style="position:fixed; top:20px; right:20px; z-index:10000; display:flex; gap:12px;">
      <button class="btn btn-ghost btn-sm" style="background:rgba(0,0,0,0.5); backdrop-filter:blur(10px); color:#fff;" onclick="toggleShortyPiP()">
        <span class="material-symbols-rounded" style="font-size:18px">picture_in_picture_alt</span> Pin PiP
      </button>
      <button class="icon-btn" style="width:40px; height:40px; background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px);" onclick="closeShortyPopup()">
        <span class="material-symbols-rounded" style="font-size:20px">close</span>
      </button>
    </div>

    <!-- Extract Drawer Overlay (Hidden) -->
    <div id="extract-drawer" style="position:fixed; top:0; bottom:0; right:-100%; width:300px; background:var(--card); z-index:10001; transition:right 0.3s ease; box-shadow:-5px 0 20px rgba(0,0,0,0.5); padding:24px; overflow-y:auto;">
      <div class="flex-between mb16">
        <h3 class="fw8 tc-1" style="display:flex; align-items:center; gap:6px;"><span class="material-symbols-rounded" style="color:var(--purple)">auto_awesome</span> AI Extractor</h3>
        <button class="icon-btn" onclick="closeExtractDrawer()"><span class="material-symbols-rounded">close</span></button>
      </div>
      <p class="fs12 tc-2 mb12">Extracted from video:</p>
      <div class="card p12 mb12" style="background:var(--card2); font-family:monospace; font-size:11px; color:var(--green)">
        const tipCreator = (amt) => {<br>&nbsp;&nbsp;wallet.deduct(amt);<br>&nbsp;&nbsp;showToast('Tipped!');<br>};
      </div>
      <div class="card p12 mb12" style="background:var(--card2); font-size:12px;">
        <strong class="tc-blue">Links Found:</strong><br>
        <a href="#" class="tc-pink">https://github.com/alex/trending</a>
      </div>
      <button class="btn btn-primary" style="width:100%" onclick="showToast('Copied to clipboard!')">Copy All</button>
    </div>
  ` + DATA.reels.map((r, i) => {
    const iconData = get3DIconForEmoji(r.emoji);
    return `
      <div id="reel-panel-${i}" style="position:relative; width:100%; height:100vh; scroll-snap-align:start; display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden">
        <div style="position:absolute; inset:0; background:${r.bg}; opacity:0.8; z-index:1"></div>
        
        <div style="position:relative; z-index:2; text-align:center; padding:20px; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <span class="material-symbols-rounded emoji-3d" style="font-size:120px; color:${iconData.color}; text-shadow: 0 0 32px ${iconData.color}s; margin-bottom:24px; animation:ix-float-idle 3s ease-in-out infinite">${iconData.icon}</span>
          <h2 style="color:#fff; font-size:24px; font-weight:800; margin-bottom:12px; text-shadow:0 2px 8px rgba(0,0,0,0.5)">${r.creator}</h2>
          <p style="color:rgba(255,255,255,0.9); font-size:16px; margin-bottom:16px; max-width:80%; line-height:1.4">${r.desc}</p>
          
          <!-- Branching Choices (Interactive Video) -->
          <div class="card p12 mt16" style="background:rgba(255,255,255,0.1); backdrop-filter:blur(8px); max-width:300px;">
            <div class="fs12 fw7 tc-1 mb8" style="color:#fff">Choose Path:</div>
            <div class="flex flex-col gap8">
              <button class="btn btn-primary btn-sm" onclick="openShortyPopup(${Math.floor(Math.random() * DATA.reels.length)})">Deep Dive: Code</button>
              <button class="btn btn-primary btn-sm" style="background:var(--pink)" onclick="openShortyPopup(${Math.floor(Math.random() * DATA.reels.length)})">Skip to Results</button>
            </div>
          </div>

          <!-- Right Action Bar -->
          <div style="position:absolute; right:20px; bottom:120px; display:flex; flex-direction:column; gap:20px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:6px" onclick="showToast('Liked!')">
              <button class="icon-btn" style="width:48px; height:48px; background:rgba(255,255,255,0.15); color:#fff; backdrop-filter:blur(10px)"><span class="material-symbols-rounded" style="font-size:24px; font-variation-settings:'FILL' 1; color:var(--pink)">favorite</span></button>
              <span style="color:#fff; font-weight:600; font-size:13px; text-shadow:0 1px 4px rgba(0,0,0,0.5)">${r.likes}</span>
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:6px" onclick="showToast('Commented!')">
              <button class="icon-btn" style="width:48px; height:48px; background:rgba(255,255,255,0.15); color:#fff; backdrop-filter:blur(10px)"><span class="material-symbols-rounded" style="font-size:24px">chat_bubble</span></button>
              <span style="color:#fff; font-weight:600; font-size:13px; text-shadow:0 1px 4px rgba(0,0,0,0.5)">${Math.floor(parseInt(r.likes)*0.12)}K</span>
            </div>
            
            <!-- Tip Button -->
            <div style="display:flex; flex-direction:column; align-items:center; gap:6px" onclick="openTipModal('${r.creator}', '@creator')">
              <button class="icon-btn" style="width:48px; height:48px; background:rgba(255,255,255,0.15); color:#fff; backdrop-filter:blur(10px); border:2px solid var(--orange)"><span class="material-symbols-rounded" style="font-size:24px; color:var(--orange)">volunteer_activism</span></button>
              <span style="color:var(--orange); font-weight:800; font-size:13px; text-shadow:0 1px 4px rgba(0,0,0,0.8)">Tip 💎</span>
            </div>

            <!-- Extract Feature Button -->
            <div style="display:flex; flex-direction:column; align-items:center; gap:6px" onclick="openExtractDrawer()">
              <button class="icon-btn" style="width:48px; height:48px; background:linear-gradient(135deg, var(--purple), var(--blue)); color:#fff; backdrop-filter:blur(10px)"><span class="material-symbols-rounded" style="font-size:24px">auto_awesome</span></button>
              <span style="color:var(--purple); font-weight:800; font-size:13px; text-shadow:0 1px 4px rgba(0,0,0,0.8)">Extract</span>
            </div>
          </div>
          
          <div style="position:absolute; bottom:40px; left:20px; background:rgba(0,0,0,0.4); padding:6px 16px; border-radius:20px; display:flex; align-items:center; gap:8px; backdrop-filter:blur(8px)">
            <span class="material-symbols-rounded" style="font-size:18px; color:var(--blue)">visibility</span>
            <span style="color:#fff; font-weight:700; font-size:15px">${r.views}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  modal.style.display = 'block';
  
  // Wait for display:block to apply before scrolling
  setTimeout(() => {
    const target = document.getElementById(`reel-panel-${idx}`);
    if (target) {
      modal.style.scrollBehavior = 'auto'; // instant scroll initially
      target.scrollIntoView();
      modal.style.scrollBehavior = 'smooth';
    }
    modal.style.opacity = '1';
  }, 10);
};

window.closeShortyPopup = function() {
  const modal = document.getElementById('reels-modal');
  if (modal) {
    // If PiP mode, restore normal before closing
    modal.style.width = '100%';
    modal.style.height = '100vh';
    modal.style.top = '0';
    modal.style.right = '0';
    modal.style.borderRadius = '0';
    modal.style.boxShadow = 'none';
    modal.classList.remove('pip-mode');

    modal.style.opacity = '0';
    setTimeout(() => modal.style.display = 'none', 300);
  }
};

window.toggleShortyPiP = function() {
  const modal = document.getElementById('reels-modal');
  if (!modal) return;
  
  if (modal.classList.contains('pip-mode')) {
    // Restore
    modal.style.width = '100%';
    modal.style.height = '100vh';
    modal.style.top = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.borderRadius = '0';
    modal.style.boxShadow = 'none';
    modal.classList.remove('pip-mode');
  } else {
    // Pin to corner
    modal.style.width = '300px';
    modal.style.height = '500px';
    modal.style.top = 'auto';
    modal.style.bottom = '20px';
    modal.style.right = '20px';
    modal.style.borderRadius = '16px';
    modal.style.boxShadow = '0 10px 40px rgba(0,0,0,0.8)';
    modal.classList.add('pip-mode');
    showToast('Shorty pinned to screen corner! 📌');
  }
};

window.openExtractDrawer = function() {
  const drawer = document.getElementById('extract-drawer');
  if (drawer) {
    drawer.style.right = '0';
  }
};

window.closeExtractDrawer = function() {
  const drawer = document.getElementById('extract-drawer');
  if (drawer) {
    drawer.style.right = '-100%';
  }
};
