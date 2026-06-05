// ── PROFILE ──────────────────────────────────────────────────────
function renderProfile() {
  const content = $id('prof-tab-dynamic-content');
  if (content && !content.innerHTML) {
    switchProfileTab('posts');
  }
}


function toggleEditForm() {
  const f = $id('edit-form');
  if (f) {
    const isHidden = f.style.display === 'none';
    f.style.display = isHidden ? 'block' : 'none';
    
    // Pre-populate input values on open
    if (isHidden) {
      $id('edit-fname').value = S.user.fname || '';
      $id('edit-lname').value = S.user.lname || '';
      $id('edit-handle').value = S.user.handle || '';
      $id('edit-bio').value = S.user.bio || '';
    }
  }
}

window.updateSwapEstimate = function() {
  const m = typeof DATA !== 'undefined' && DATA.cryptoMarkets ? DATA.cryptoMarkets : [];
  const getPrice = (coin) => {
    if (coin === 'USDT') return 1.0;
    if (coin === 'TREND') return 0.1;
    const pair = m.find(x => x.pair === `${coin}/USDT`);
    return pair ? pair.price : 1.0;
  };
  const amtIn = parseFloat($id('swap-amount-in').value) || 0;
  const coinIn = $id('swap-coin-in').value;
  const coinOut = $id('swap-coin-out').value;
  
  if (amtIn <= 0) {
    $id('swap-amount-out').value = '';
    return;
  }
  
  const inValUsd = amtIn * getPrice(coinIn);
  const outPriceUsd = getPrice(coinOut);
  // Subtract 1% fee
  const receivedUsd = inValUsd * 0.99;
  const estOut = receivedUsd / outPriceUsd;
  $id('swap-amount-out').value = estOut.toFixed(4);
};

window.submitTokenSwap = function() {
  const amtIn = parseFloat($id('swap-amount-in').value);
  const coinIn = $id('swap-coin-in').value;
  const coinOut = $id('swap-coin-out').value;
  const estOut = $id('swap-amount-out').value;
  
  if (!amtIn || amtIn <= 0) {
    showToast('Enter an amount to swap ❌');
    return;
  }
  if (coinIn === coinOut) {
    showToast('Cannot swap same coin ❌');
    return;
  }
  
  const b = DATA.wallet.balances;
  if (!b[coinIn] || b[coinIn] < amtIn) {
    showToast(`Insufficient ${coinIn} balance ❌`);
    return;
  }
  
  // Deduct in, add out
  b[coinIn] -= amtIn;
  b[coinOut] = (b[coinOut] || 0) + parseFloat(estOut);
  
  const ledger = $id('wallet-ledger');
  if (ledger) {
    const div = document.createElement('div');
    div.className = "flex-between py4";
    div.style.borderBottom = "1px solid var(--border)";
    div.innerHTML = `
      <span class="tc-blue" style="display:inline-flex; align-items:center; gap:4px"><span class="material-symbols-rounded" style="font-size:14px">currency_exchange</span> Swapped Tokens</span>
      <span class="fw7">-${amtIn} ${coinIn} ➔ +${parseFloat(estOut).toFixed(2)} ${coinOut}</span>
    `;
    ledger.prepend(div);
  }
  
  $id('swap-amount-in').value = '';
  $id('swap-amount-out').value = '';
  showToast(`Swapped ${amtIn} ${coinIn} for ${parseFloat(estOut).toFixed(2)} ${coinOut}! ✅`);
  
  setTimeout(() => switchProfileTab('wallet'), 1500);
};

function saveProfileChanges() {
  const fn = $id('edit-fname').value.trim();
  const ln = $id('edit-lname').value.trim();
  const hn = $id('edit-handle').value.trim();
  const bio = $id('edit-bio').value.trim();
  
  if (!fn || !hn) {
    showToast('First Name and Handle are required! ❌');
    return;
  }
  
  S.user.fname = fn;
  S.user.lname = ln;
  S.user.handle = hn;
  S.user.bio = bio;
  
  updateUserUI();
  toggleEditForm();
  showToast('Profile details updated! ✅');
}



function getProfileTemplate() {
  return `<section id="pane-profile" class="pane">
        <!-- Cover Banner -->
        <div class="profile-cover-banner" style="position:relative; height:160px; background:linear-gradient(135deg, var(--blue), var(--purple), var(--pink)); border-radius:var(--r3); overflow:hidden; margin-bottom:-50px; border:1px solid var(--border)">
          <div style="position:absolute; inset:0; background:radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 60%); pointer-events:none"></div>
          <div style="position:absolute; right:20px; bottom:12px; display:flex; gap:8px">
            <span class="badge badge-blue" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; font-variation-settings:'FILL' 1">bolt</span> Level 14</span>
            <span class="badge badge-purple" style="border:1px solid rgba(255,255,255,0.15)">Verified Creator</span>
          </div>
        </div>

        <div class="profile-header" style="position:relative; padding-top:60px; z-index:2">
          <div class="avatar av-xl emoji-3d" id="profile-av" style="background:var(--g-brand); border:4px solid var(--card); box-shadow:var(--sh2); margin-top:-90px; display:grid; place-items:center; color:#fff; font-size:24px; font-weight:700">AV</div>
          <div>
            <div style="display:flex; align-items:center; gap:8px">
              <div style="font-size:24px; font-weight:900; letter-spacing:-0.04em" id="profile-name">Alex Vance</div>
              <span class="material-symbols-rounded" style="color:var(--blue); font-size:20px; font-variation-settings:'FILL' 1" title="Verified Creator">verified</span>
              <span class="badge badge-green" style="font-size:10px; padding:2px 6px">● Online</span>
            </div>
            
            <div class="flex-center gap12 mt4" style="justify-content:flex-start; font-size:12.5px; color:var(--t2); flex-wrap:wrap">
              <span id="profile-handle">@alex_vance</span>
              <span>·</span>
              <span class="flex-center gap4" style="color:var(--orange)"><span class="material-symbols-rounded" style="font-size:16px">bolt</span> Active Focus</span>
              <span>·</span>
              <span class="flex-center gap4"><span class="material-symbols-rounded" style="font-size:16px">location_on</span> San Francisco, CA</span>
              <span>·</span>
              <span class="flex-center gap4"><span class="material-symbols-rounded" style="font-size:16px">link</span> <a href="#" class="tc-blue" style="text-decoration:none">trending.app/alex</a></span>
              <span>·</span>
              <span class="flex-center gap4" style="color:var(--purple)"><span class="material-symbols-rounded" style="font-size:16px">calendar_month</span> Joined May 2024</span>
            </div>

            <div class="profile-bio mt8" id="profile-bio">Digital creator &amp; tech enthusiast. Building the future one post at a time.</div>

            <div class="profile-tags mt8" style="display:flex; gap:6px">
              <span class="badge badge-blue">Developer</span>
              <span class="badge badge-purple">Creator</span>
              <span class="badge badge-pink">Gamer</span>
              <span class="badge badge-green">Musician</span>
            </div>
            
            <div class="profile-stats-row mt16">
              <div class="profile-stat">
                <div class="profile-stat-val">28.4K</div>
                <div class="profile-stat-lbl">Followers</div>
              </div>
              <div class="profile-stat">
                <div class="profile-stat-val">892</div>
                <div class="profile-stat-lbl">Following</div>
              </div>
              <div class="profile-stat">
                <div class="profile-stat-val">347</div>
                <div class="profile-stat-lbl">Posts</div>
              </div>
              <div class="profile-stat">
                <div class="profile-stat-val tc-green" id="profile-rep">98%</div>
                <div class="profile-stat-lbl">Reputation Score</div>
              </div>
              <div class="profile-stat">
                <div class="profile-stat-val tc-blue" id="profile-ai-trust">99%</div>
                <div class="profile-stat-lbl">AI Trust Score</div>
              </div>
              <div class="profile-stat">
                <div class="profile-stat-val tc-pink">5 Days</div>
                <div class="profile-stat-lbl">Daily Streak</div>
              </div>
            </div>
            <!-- Profile Actions -->
            <div class="flex gap8 mt16">
              <button class="btn btn-primary btn-sm flex-center gap4" onclick="toggleEditForm()" style="display:inline-flex; align-items:center; gap:4px">
                <span class="material-symbols-rounded" style="font-size:16px">edit</span> Edit Profile
              </button>
              <button class="btn btn-ghost btn-sm flex-center gap4" onclick="signOut()" style="display:inline-flex; align-items:center; gap:4px">
                <span class="material-symbols-rounded" style="font-size:16px">logout</span> Sign Out
              </button>
            </div>
          </div>
        </div>

        <!-- Edit Profile Form (Sliding Card) -->
        <div id="edit-form" class="card mt16" style="display:none; padding:24px; background:var(--card2); border:1px solid var(--border); border-radius:var(--r3); box-shadow:var(--sh2); margin-bottom:20px; animation:pane-in 0.3s ease both">
          <h3 class="fw8 mb16 tc-1" style="display:flex; align-items:center; gap:8px">
            <span class="material-symbols-rounded" style="color:var(--blue)">edit</span> Edit Profile Details
          </h3>
          <div class="grid-2 gap12" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px">
            <div class="form-group">
              <label class="form-label" style="display:block; font-size:11px; color:var(--t3); margin-bottom:4px">First Name</label>
              <input class="input" type="text" id="edit-fname" value="Alex" style="width:100%">
            </div>
            <div class="form-group">
              <label class="form-label" style="display:block; font-size:11px; color:var(--t3); margin-bottom:4px">Last Name</label>
              <input class="input" type="text" id="edit-lname" value="Vance" style="width:100%">
            </div>
          </div>
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label" style="display:block; font-size:11px; color:var(--t3); margin-bottom:4px">Username @handle</label>
            <input class="input" type="text" id="edit-handle" value="@alex_vance" style="width:100%">
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label" style="display:block; font-size:11px; color:var(--t3); margin-bottom:4px">Bio Description</label>
            <textarea class="input" id="edit-bio" style="height:80px; width:100%; resize:none">Digital creator & tech enthusiast. Building the future one post at a time. 🚀</textarea>
          </div>
          <div class="flex gap8">
            <button class="btn btn-primary btn-sm" onclick="saveProfileChanges()">Save Changes</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleEditForm()">Cancel</button>
          </div>
        </div>

        <!-- 22-Tab Profile Navigation -->
        <div class="tabs mb16 overflow-x-auto" style="scrollbar-width:none; display:flex; gap:6px; flex-wrap:nowrap; -webkit-overflow-scrolling:touch; padding-bottom:6px">
          <button class="tab-btn active" onclick="switchProfileTab('posts')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">dynamic_feed</span>Posts</button>
          <button class="tab-btn" onclick="switchProfileTab('videos')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">video_library</span>Videos</button>
          <button class="tab-btn" onclick="switchProfileTab('shorty')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">movie</span>Reels</button>
          <button class="tab-btn" onclick="switchProfileTab('photos')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">image</span>Photos</button>
          <button class="tab-btn" onclick="switchProfileTab('articles')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">article</span>Articles</button>
          <button class="tab-btn" onclick="switchProfileTab('podcasts')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">podcasts</span>Podcasts</button>
          <button class="tab-btn" onclick="switchProfileTab('music')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">music_note</span>Music</button>
          <button class="tab-btn" onclick="switchProfileTab('livestreams')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">sensors</span>Livestreams</button>
          <button class="tab-btn" onclick="switchProfileTab('documents')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">description</span>Documents</button>
          <button class="tab-btn" onclick="switchProfileTab('research')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">school</span>Research</button>
          <button class="tab-btn" onclick="switchProfileTab('saved')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">bookmark</span>Saved</button>
          <button class="tab-btn" onclick="switchProfileTab('history')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">history</span>History</button>
          <button class="tab-btn" onclick="switchProfileTab('liked')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">favorite</span>Liked</button>
          <button class="tab-btn" onclick="switchProfileTab('purchases')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">shopping_cart</span>Purchases</button>
          <button class="tab-btn" onclick="switchProfileTab('nfts')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">token</span>NFTs</button>
          <button class="tab-btn" onclick="switchProfileTab('wallet')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">account_balance_wallet</span>Wallet</button>
          <button class="tab-btn" onclick="switchProfileTab('communities')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">forum</span>Communities</button>
          <button class="tab-btn" onclick="switchProfileTab('courses')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">local_library</span>Courses</button>

          <button class="tab-btn" onclick="switchProfileTab('analytics')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">trending_up</span>Analytics</button>
          <button class="tab-btn" onclick="switchProfileTab('ai')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">auto_awesome</span>AI Assistant</button>
          <button class="tab-btn" onclick="switchProfileTab('settings')"><span class="material-symbols-rounded" style="font-size:16px; margin-right:4px">settings</span>Settings</button>
        </div>

        <!-- Dynamic Content Viewport -->
        <div id="prof-tab-dynamic-content" class="mt16"></div>
      </div>
      </section>`;
}


function switchProfileTab(tab) {
  const container = $id('prof-tab-dynamic-content');
  if (!container) return;

  document.querySelectorAll('#pane-profile .tab-btn').forEach(btn => {
    const btnText = btn.textContent.trim().toLowerCase();
    btn.classList.toggle('active', btnText.includes(tab) || (tab === 'communities' && btnText.includes('communities')));
  });

  showToast(`Profile: Opened ${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  
  let html = '';

  if (tab === 'posts') {
    const myPosts = DATA.posts.filter(p => p.author === 'Alex Vance');
    const others = DATA.posts.slice(0, 3);
    const allProfilePosts = myPosts.concat(others);
    
    html = `
      <div class="composer card mb16" style="padding: 16px">
        <div class="composer-row">
          <div class="avatar av-sm" style="background:var(--g-brand); display:grid; place-items:center; color:#fff">AV</div>
          <input class="composer-input" id="profile-post-input" placeholder="Compose a microblog post... Add emojis! 🚀🔥" style="flex:1; margin-left:12px; background:var(--bg); border:1px solid var(--border); border-radius:var(--rf); padding:8px 16px; color:var(--t1)">
        </div>
        <div class="composer-actions mt12 flex-between" style="align-items:center">
          <div class="flex gap8">
            <button class="composer-act-btn btn-ghost" onclick="$id('profile-post-input').value += ' 🔥'" style="display:inline-flex; align-items:center; justify-content:center"><span class="material-symbols-rounded" style="color:var(--orange); font-size:18px">local_fire_department</span></button>
            <button class="composer-act-btn btn-ghost" onclick="$id('profile-post-input').value += ' 🚀'" style="display:inline-flex; align-items:center; justify-content:center"><span class="material-symbols-rounded" style="color:var(--blue); font-size:18px">rocket_launch</span></button>
            <button class="composer-act-btn btn-ghost" onclick="$id('profile-post-input').value += ' ✨'" style="display:inline-flex; align-items:center; justify-content:center"><span class="material-symbols-rounded" style="color:var(--purple); font-size:18px">auto_awesome</span></button>
          </div>
          <button class="btn btn-primary btn-sm" onclick="publishProfilePost()">Post</button>
        </div>
      </div>
      <div id="prof-posts-list" class="flex flex-col gap16">
        ${allProfilePosts.map(p => renderPostCard(p)).join('')}
      </div>
    `;
  }
  else if (tab === 'videos') {
    html = `
      <div class="card p20 mb16" id="video-player-container" style="display:none">
        <div class="video-player-sim">
          <span class="material-symbols-rounded video-glow-play" id="sim-play-icon" onclick="playSimulatedVideo()">play_arrow</span>
          <div class="fs14 fw8 mt12 tc-1" id="sim-player-title">Simulating Video Playback...</div>
          <div class="progress-bar mt16" style="width:80%; height:6px; margin:0 auto"><div class="progress-fill" id="sim-video-progress" style="width:0%"></div></div>
          <div class="flex-between mt8 mx-auto" style="width:80%; font-size:11px; color:var(--t3)">
            <span id="sim-video-time">0:00 / 5:40</span>
            <span onclick="closeSimulatedVideo()" style="cursor:pointer" class="tc-pink">✕ Close Player</span>
          </div>
        </div>
      </div>
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:var(--blue); font-size:18px">video_library</span>
          <span>Video Shelf</span>
        </span>
        <span class="badge badge-blue">YouTube Sync</span>
      </div>
      <div class="grid-3 gap16">
        <div class="card product-card" style="cursor:pointer" onclick="openSimulatedVideo('Building SaaS in 60 seconds - Complete Stack Rebuild', '5:40')">
          <div class="product-thumb flex-center" style="height:120px; background:linear-gradient(135deg, hsl(217, 50%, 18%), hsl(260, 50%, 14%))">
            <span class="material-symbols-rounded" style="font-size:48px; color:var(--blue)">video_library</span>
          </div>
          <div class="p12">
            <div class="fw8 fs13 tc-1 text-ellipsis">Building SaaS in 60 seconds</div>
            <div class="fs11 tc-3 mt4">280K views · 2 days ago</div>
          </div>
        </div>
        <div class="card product-card" style="cursor:pointer" onclick="openSimulatedVideo('Cyber Invaders Speedrun record - 2,400 pts', '12:15')">
          <div class="product-thumb flex-center" style="height:120px; background:linear-gradient(135deg, hsl(260, 50%, 18%), hsl(330, 50%, 14%))">
            <span class="material-symbols-rounded" style="font-size:48px; color:var(--purple)">sports_esports</span>
          </div>
          <div class="p12">
            <div class="fw8 fs13 tc-1 text-ellipsis">Cyber Invaders Speedrun record</div>
            <div class="fs11 tc-3 mt4">98K views · 5 days ago</div>
          </div>
        </div>
        <div class="card product-card" style="cursor:pointer" onclick="openSimulatedVideo('Consistency & Peak Focus: 5AM Daily Grind Routine', '8:30')">
          <div class="product-thumb flex-center" style="height:120px; background:linear-gradient(135deg, hsl(155, 50%, 14%), hsl(217, 50%, 12%))">
            <span class="material-symbols-rounded" style="font-size:48px; color:var(--green)">bolt</span>
          </div>
          <div class="p12">
            <div class="fw8 fs13 tc-1 text-ellipsis">Consistency & Peak Focus Routine</div>
            <div class="fs11 tc-3 mt4">150K views · 1 week ago</div>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'shorty') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:var(--pink); font-size:18px">movie</span>
          <span>Shorty Hub</span>
        </span>
        <span class="badge badge-pink">Portrait Swipes</span>
      </div>
      <div class="grid-4 gap12">
        <div class="card product-card text-center p12" style="background:var(--card2)">
          <div class="avatar av-lg mx-auto flex-center" style="background:var(--g-pink); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded" style="font-size:24px">movie</span>
          </div>
          <div class="fw8 fs13 tc-1 mt8">UI Design Secrets</div>
          <div class="fs11 tc-pink mt4" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px">favorite</span> 24.5K Likes</div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="openShortyPopup(5)">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Play Shorty
          </button>
        </div>
        <div class="card product-card text-center p12" style="background:var(--card2)">
          <div class="avatar av-lg mx-auto flex-center" style="background:var(--g-brand); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded" style="font-size:24px">bolt</span>
          </div>
          <div class="fw8 fs13 tc-1 mt8">5AM Cardio Hustle</div>
          <div class="fs11 tc-pink mt4" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px">favorite</span> 18.2K Likes</div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="openShortyPopup(1)">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Play Shorty
          </button>
        </div>
        <div class="card product-card text-center p12" style="background:linear-gradient(135deg, var(--orange), var(--red)); display:grid; place-items:center; color:#fff">
          <div class="avatar av-lg mx-auto flex-center" style="background:linear-gradient(135deg, var(--orange), var(--red)); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded" style="font-size:24px">local_fire_department</span>
          </div>
          <div class="fw8 fs13 tc-1 mt8">Methane synthesis lab</div>
          <div class="fs11 tc-pink mt4" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px">favorite</span> 31.7K Likes</div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="openShortyPopup(4)">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Play Shorty
          </button>
        </div>
        <div class="card product-card text-center p12" style="background:var(--card2)">
          <div class="avatar av-lg mx-auto flex-center" style="background:var(--g-brand); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded" style="font-size:24px">terminal</span>
          </div>
          <div class="fw8 fs13 tc-1 mt8">CSS Glassmorphism in 15s</div>
          <div class="fs11 tc-pink mt4" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px">favorite</span> 15.9K Likes</div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="openShortyPopup(3)">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Play Shorty
          </button>
        </div>
      </div>
    `;
  }
  else if (tab === 'photos') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:var(--purple); font-size:18px">photo_camera</span>
          <span>Visual Gallery</span>
        </span>
        <span class="badge badge-purple">Instagram Grid</span>
      </div>
      <div class="grid-3 gap12">
        <div class="card nft-holo-card" style="padding:0; aspect-ratio:1/1; position:relative" onclick="showToast('Opening photo in full size...')">
          <div style="position:absolute; inset:0; background:linear-gradient(135deg, hsl(217, 70%, 25%), hsl(260, 60%, 20%)); display:flex; align-items:center; justify-content:center">
            <span class="material-symbols-rounded" style="font-size:42px; color:#fff">terminal</span>
          </div>
          <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(0,0,0,0.8)); padding:12px; font-size:11px; color:#fff">
            <div class="fw7">Setup for deep work</div>
            <div class="mt4" style="display:flex; align-items:center; gap:6px">
              <span style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; color:var(--pink)">favorite</span> 1,203</span>
              <span style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; color:var(--blue)">forum</span> 42</span>
            </div>
          </div>
        </div>
        <div class="card nft-holo-card" style="padding:0; aspect-ratio:1/1; position:relative" onclick="showToast('Opening photo in full size...')">
          <div style="position:absolute; inset:0; background:linear-gradient(135deg, hsl(155, 60%, 20%), hsl(217, 50%, 15%)); display:flex; align-items:center; justify-content:center">
            <span class="material-symbols-rounded" style="font-size:42px; color:#fff">fitness_center</span>
          </div>
          <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(0,0,0,0.8)); padding:12px; font-size:11px; color:#fff">
            <div class="fw7">Consistency wins daily</div>
            <div class="mt4" style="display:flex; align-items:center; gap:6px">
              <span style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; color:var(--pink)">favorite</span> 847</span>
              <span style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; color:var(--blue)">forum</span> 19</span>
            </div>
          </div>
        </div>
        <div class="card nft-holo-card" style="padding:0; aspect-ratio:1/1; position:relative" onclick="showToast('Opening photo in full size...')">
          <div style="position:absolute; inset:0; background:linear-gradient(135deg, hsl(330, 70%, 25%), hsl(260, 60%, 20%)); display:flex; align-items:center; justify-content:center">
            <span class="material-symbols-rounded" style="font-size:42px; color:#fff">image</span>
          </div>
          <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(0,0,0,0.8)); padding:12px; font-size:11px; color:#fff">
            <div class="fw7">San Francisco sunset</div>
            <div class="mt4" style="display:flex; align-items:center; gap:6px">
              <span style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; color:var(--pink)">favorite</span> 2,341</span>
              <span style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px; color:var(--blue)">forum</span> 89</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'articles') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:var(--purple); font-size:18px">edit_note</span>
          <span>Substack Longforms</span>
        </span>
        <span class="badge badge-purple">Editor Choice</span>
      </div>
      <div class="grid-2 mb16" style="gap:16px">
        <div class="card p20">
          <div class="flex-between">
            <span class="badge badge-blue">UI/UX Design</span>
            <span class="tc-3 fs11">5 min read</span>
          </div>
          <h3 class="fw8 tc-1 mt8">The Architecture of Clean White Space</h3>
          <p class="tc-2 fs12 mt8 mb12" style="line-height:1.5">White space is not wasted space. It is the breathing room that directs focus, structures hierarchy, and transforms cluttered pages into high-fidelity user experiences...</p>
          <button class="btn btn-ghost btn-sm" onclick="showToast('Opening Article...')">Read Article →</button>
        </div>
        <div class="card p20">
          <div class="flex-between">
            <span class="badge badge-green">Coding &amp; SaaS</span>
            <span class="tc-3 fs11">8 min read</span>
          </div>
          <h3 class="fw8 tc-1 mt8">Refactoring Component Libraries for Speed</h3>
          <p class="tc-2 fs12 mt8 mb12" style="line-height:1.5">When scale scales, DOM repaints scale with it. Here is how we decoupled our state models to achieve 60fps renders on low-powered mobile web browsers...</p>
          <button class="btn btn-ghost btn-sm" onclick="showToast('Opening Article...')">Read Article →</button>
        </div>
      </div>
      <div class="card p20 text-center" style="background:linear-gradient(135deg, var(--blue-s), var(--purple-s))">
        <h3 class="fw8 tc-1">📬 Subscribe to Alex Vance Newsletter</h3>
        <p class="tc-3 fs12 mt4">Get weekly content strategies, design principles, and engineering deep-dives directly in your inbox.</p>
        <div class="flex gap8 mt12" style="justify-content:center; max-width:400px; margin-left:auto; margin-right:auto">
          <input type="email" class="input btn-sm" id="newsletter-email" placeholder="Enter your email address" style="background:var(--card)">
          <button class="btn btn-primary btn-sm" onclick="showToast('Subscribed! Check your email! 🚀')">Subscribe</button>
        </div>
      </div>
    `;
  }
  else if (tab === 'podcasts') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px">
          <span class="material-symbols-rounded" style="color:var(--green); font-size:18px">mic</span>
          <span>Spotify-style Podcasts</span>
        </span>
        <span class="badge badge-green">Active Listening</span>
      </div>
      <div class="card p20 mb16 flex gap16" style="align-items:center; background:linear-gradient(135deg, var(--card), var(--card2))">
        <div class="avatar av-xl flex-center" style="background:var(--g-brand); font-size:32px; display:grid; place-items:center; color:#fff">
          <span class="material-symbols-rounded" style="font-size:32px">mic</span>
        </div>
        <div style="flex:1">
          <div class="fw8 tc-1 fs15" id="podcast-player-title">Designing the Digital Sovereignty Stack</div>
          <div class="fs12 tc-3 mt4">Episode 42 · 18 min remaining</div>
          <div class="flex mt12" style="gap:8px">
            <button class="btn btn-ghost btn-sm flex-center gap4" onclick="showToast('Rewinding 15s')" style="display:inline-flex; align-items:center; gap:4px">
              <span class="material-symbols-rounded" style="font-size:14px">skip_previous</span> 15s
            </button>
            <button class="btn btn-primary btn-sm flex-center gap4" id="pod-play-btn" onclick="togglePodcastPlayback()" style="display:inline-flex; align-items:center; gap:4px">
              <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Play Podcast
            </button>
            <button class="btn btn-ghost btn-sm flex-center gap4" onclick="showToast('Fast Forwarding 15s')" style="display:inline-flex; align-items:center; gap:4px">
              15s <span class="material-symbols-rounded" style="font-size:14px">skip_next</span>
            </button>
          </div>
          <div class="flex gap8 mt12" style="align-items:center">
            <span class="fs10 tc-3" id="pod-current-time">0:00 / 18:00</span>
            <div class="progress-bar" style="width:200px; height:4px; margin:0"><div class="progress-fill" id="pod-progress-fill" style="width:0%"></div></div>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap8">
        <div class="card p12 flex-between" style="background:var(--card2)">
          <div>
            <div class="fw8 tc-1 fs12">Episode 41: DeFi Liquidity Mechanics &amp; Yield Optimizers</div>
            <div class="fs10 tc-3 mt4">24 min · Released 1 week ago</div>
          </div>
          <button class="btn btn-ghost btn-sm flex-center gap4" onclick="playSpecificPodcast('Episode 41: DeFi Liquidity Mechanics', 24)" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Load
          </button>
        </div>
        <div class="card p12 flex-between" style="background:var(--card2)">
          <div>
            <div class="fw8 tc-1 fs12">Episode 40: Product Sprints vs Refactor Debts</div>
            <div class="fs10 tc-3 mt4">14 min · Released 2 weeks ago</div>
          </div>
          <button class="btn btn-ghost btn-sm flex-center gap4" onclick="playSpecificPodcast('Episode 40: Product Sprints vs Refactor Debts', 14)" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Load
          </button>
        </div>
      </div>
    `;
  }
  else if (tab === 'music') {
    html = `
      <div class="grid-2 mb16" style="gap:16px">
        <div class="card p20 text-center">
          <div style="animation:spin 12s linear infinite; display:inline-block">
            <span class="material-symbols-rounded" style="font-size:64px; color:var(--pink)">album</span>
          </div>
          <h3 class="fw8 tc-1 mt8" id="profile-music-title">Sunset Horizon Beat</h3>
          <p class="tc-3 fs12">Synthesized Synthwave · Alex Vance</p>
          <div class="flex-center gap16 mt16" style="justify-content:center">
            <button class="btn btn-ghost" onclick="showToast('Previous Track')" style="display:inline-flex; align-items:center; justify-content:center">
              <span class="material-symbols-rounded" style="font-size:20px">skip_previous</span>
            </button>
            <button class="btn btn-primary flex-center gap4" id="profile-music-play" onclick="toggleProfileMusic()" style="display:inline-flex; align-items:center; gap:4px">
              <span class="material-symbols-rounded" style="font-size:16px">play_arrow</span> Play Track
            </button>
            <button class="btn btn-ghost" onclick="showToast('Next Track')" style="display:inline-flex; align-items:center; justify-content:center">
              <span class="material-symbols-rounded" style="font-size:20px">skip_next</span>
            </button>
          </div>
        </div>
        <div class="card p20 flex flex-col justify-between">
          <div>
            <div class="section-hdr">
              <span class="section-title" style="display:inline-flex; align-items:center; gap:6px">
                <span class="material-symbols-rounded" style="color:var(--blue); font-size:18px">mic</span>
                <span>Lyric Sync Monitor</span>
              </span>
              <span class="badge badge-blue">Sync Live</span>
            </div>
            <div class="lyric-scroller flex flex-col gap12 text-center mt12" id="profile-lyric-scroll" style="height:100px; overflow-y:auto; padding:10px; background:var(--bg); border-radius:var(--r2)">
              <div class="tc-3 fs12">Staring at the sunset line...</div>
              <div class="fw8 tc-blue fs13" id="lyric-1">Walking through the shadow of the evening... (Active)</div>
              <div class="tc-3 fs12">Feel the rhythm pulsing deep inside...</div>
              <div class="tc-3 fs12">Horizon waiting far and wide...</div>
            </div>
          </div>
          <div class="mt16">
            <div class="fs11 tc-3 mb4">Live Audio Pulse Output:</div>
            <canvas id="profile-audio-wave" style="width:100%; height:48px; background:#000; border-radius:var(--r1)"></canvas>
          </div>
        </div>
      </div>
    `;
    setTimeout(() => initProfileAudioWave(), 100);
  }
  else if (tab === 'livestreams') {
    html = `
      <div class="grid-3 mb16" style="gap:16px">
        <div style="grid-column: span 2">
          <div class="card p20">
            <div class="video-player-sim" style="height:280px; display:grid; place-items:center">
              <div style="position:absolute; top:12px; left:12px; z-index:3" class="flex gap8">
                <span class="badge badge-pink" style="animation:pulse-dot 1.5s infinite">● LIVE</span>
                <span class="badge badge-blue" style="background:rgba(0,0,0,0.6); display:inline-flex; align-items:center; gap:4px">
                  <span class="material-symbols-rounded" style="font-size:12px">groups</span> 12.4K Watching
                </span>
              </div>
              <div>
                <span class="material-symbols-rounded emoji-3d" style="font-size:84px; color:var(--purple)">sports_esports</span>
              </div>
              <div class="fw8 tc-1 mt8">Live coding &amp; game testing stream</div>
              <div class="fs12 tc-3 mt4">Click reaction buttons below to send real-time feedback!</div>
            </div>
            <div class="flex gap8 mt12 justify-center">
              <button class="btn btn-ghost btn-sm" onclick="sendLiveStreamReaction('🔥')">🔥 Burn</button>
              <button class="btn btn-ghost btn-sm" onclick="sendLiveStreamReaction('🚀')">🚀 Launch</button>
              <button class="btn btn-ghost btn-sm" onclick="sendLiveStreamReaction('🎉')">🎉 Celeb</button>
              <button class="btn btn-ghost btn-sm" onclick="sendLiveStreamReaction('💻')">💻 Code</button>
            </div>
          </div>
        </div>
        <div>
          <div class="card p20 flex flex-col" style="height:358px">
            <h3 class="fw8 mb12 tc-1" style="display:inline-flex; align-items:center; gap:6px">
              <span class="material-symbols-rounded" style="color:var(--blue)">forum</span>
              <span>Stream Chat</span>
            </h3>
            <div id="stream-chat-logs" style="flex:1; overflow-y:auto; margin-bottom:12px" class="flex flex-col gap8 fs12">
              <div><strong class="tc-blue">sarah_c:</strong> Insane refactoring speed! 🔥</div>
              <div><strong class="tc-purple">marcus_w:</strong> Lets gooo! Tell me if you need help with stress testing 💪</div>
              <div><strong class="tc-green">dev_kumar:</strong> Stethoscope tool is fully bound and ready!</div>
            </div>
            <div class="flex gap4">
              <input type="text" class="input btn-sm" id="stream-chat-input" placeholder="Type a chat message..." style="flex:1" onkeydown="if(event.key==='Enter')submitStreamChat()">
              <button class="btn btn-primary btn-sm" onclick="submitStreamChat()">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;
    setTimeout(() => startProfileStreamChatSimulation(), 100);
  }
  else if (tab === 'documents') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title">📂 Document Deck</span>
        <span class="badge badge-purple">LinkedIn PDFs</span>
      </div>
      <div class="grid-3 gap16">
        <div class="card p16">
          <div class="flex-between">
            <span class="material-symbols-rounded" style="color:var(--orange); font-size:32px">description</span>
            <span class="fs10 tc-3">PDF · 2.4 MB</span>
          </div>
          <h3 class="fw8 tc-1 mt8 fs13">Ecosystem Rebuild Roadmap 2026</h3>
          <p class="tc-3 fs11 mt4">Milestones, architecture diagrams, and HSL customizer guidelines.</p>
          <div class="flex-between mt12">
            <button class="btn btn-ghost btn-sm" onclick="showToast('Roadmap document opened!')">👁️ View</button>
            <button class="btn btn-primary btn-sm" onclick="showToast('Downloading Roadmap PDF...')">Download</button>
          </div>
        </div>
        <div class="card p16">
          <div class="flex-between">
            <span class="material-symbols-rounded" style="color:var(--blue); font-size:32px">description</span>
            <span class="fs10 tc-3">DOCX · 840 KB</span>
          </div>
          <h3 class="fw8 tc-1 mt8 fs13">Alex Vance Professional Resume</h3>
          <p class="tc-3 fs11 mt4">Updated tech stack experience, past startup projects, and education logs.</p>
          <div class="flex-between mt12">
            <button class="btn btn-ghost btn-sm" onclick="showToast('Resume opened!')">👁️ View</button>
            <button class="btn btn-primary btn-sm" onclick="showToast('Downloading Resume...')">Download</button>
          </div>
        </div>
        <div class="card p16">
          <div class="flex-between">
            <span class="material-symbols-rounded" style="color:var(--purple); font-size:32px">description</span>
            <span class="fs10 tc-3">PPTX · 5.8 MB</span>
          </div>
          <h3 class="fw8 tc-1 mt8 fs13">Investor Pitch Presentation Slides</h3>
          <p class="tc-3 fs11 mt4">Digital sovereign hubs pitch decks, demographic forecasts, and earnings.</p>
          <div class="flex-between mt12">
            <button class="btn btn-ghost btn-sm" onclick="showToast('Pitch slides opened!')">👁️ View</button>
            <button class="btn btn-primary btn-sm" onclick="showToast('Downloading PPTX...')">Download</button>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'research') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title">🎓 Academic Preprints</span>
        <span class="badge badge-blue">Research Gate</span>
      </div>
      <div class="flex flex-col gap12">
        <div class="card p16">
          <div class="flex-between">
            <h3 class="fw8 tc-1 fs13">A Matrix Framework for Generative User Interface Layouts</h3>
            <span class="badge badge-blue">DOI: 10.1145/3478</span>
          </div>
          <div class="fs11 tc-3 mt4">Published in ACM Journal of Human-Computer Interaction · 12 Citations</div>
          <div class="card p12 fs11 tc-2 mt8 hidden" id="abstract-matrix-doc">
            <strong>Abstract:</strong> Current UI synthesis tools struggle with structural intent conservation. We present an absolute matrix system mapping design tokens to modular grid states, securing reliable and fluid web app renders across various screen widths without page loads.
          </div>
          <div class="flex gap8 mt12">
            <button class="btn btn-ghost btn-sm" onclick="$id('abstract-matrix-doc').classList.toggle('hidden'); this.textContent = this.textContent.includes('Expand') ? 'Collapse Abstract' : 'Expand Abstract'">Expand Abstract</button>
            <button class="btn btn-primary btn-sm" onclick="showToast('Abstract paper PDF downloaded!')">📄 Full PDF</button>
          </div>
        </div>
        <div class="card p16">
          <div class="flex-between">
            <h3 class="fw8 tc-1 fs13">Decentralized Trust Protocols on High-Frequency Social Hubs</h3>
            <span class="badge badge-purple">Preprint</span>
          </div>
          <div class="fs11 tc-3 mt4">Submitted to IEEE Transactions on Network Security · Under Review</div>
          <div class="card p12 fs11 tc-2 mt8 hidden" id="abstract-crypto-doc">
            <strong>Abstract:</strong> High-volume microblogging sites require rapid state verification. We introduce a secure, lightweight validation algorithm leveraging peer nodes to construct tamperproof active status tags and verified creator emblems instantly.
          </div>
          <div class="flex gap8 mt12">
            <button class="btn btn-ghost btn-sm" onclick="$id('abstract-crypto-doc').classList.toggle('hidden'); this.textContent = this.textContent.includes('Expand') ? 'Collapse Abstract' : 'Expand Abstract'">Expand Abstract</button>
            <button class="btn btn-primary btn-sm" onclick="showToast('Abstract preprint PDF downloaded!')">📄 Full PDF</button>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'saved') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--purple)">bookmark</span> Saved Bookmarks</span>
        <span class="badge badge-purple">Bookmarks Drawer</span>
      </div>
      <div class="grid-3 gap12 mb16">
        <button class="btn btn-ghost p16 text-center" style="display:flex; flex-direction:column; height:auto; gap:8px" onclick="filterSaved('all')">
          <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--blue)">folder</span>
          <span class="fw7 fs13">All Bookmarks</span>
        </button>
        <button class="btn btn-ghost p16 text-center" style="display:flex; flex-direction:column; height:auto; gap:8px" onclick="filterSaved('article')">
          <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--purple)">article</span>
          <span class="fw7 fs13">Articles (1)</span>
        </button>
        <button class="btn btn-ghost p16 text-center" style="display:flex; flex-direction:column; height:auto; gap:8px" onclick="filterSaved('shop')">
          <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--pink)">shopping_cart</span>
          <span class="fw7 fs13">Products (1)</span>
        </button>
      </div>
      <div class="grid-3 gap12" id="saved-items-grid">
        <div class="card p12 flex gap12" style="background:var(--card2); align-items:center; cursor:pointer" onclick="showToast('Opening ProSound X1 page...')">
          <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:var(--bg2)">
            <span class="material-symbols-rounded emoji-3d" style="font-size:28px; color:var(--blue)">headphones</span>
          </div>
          <div>
            <div class="fw8 tc-1 fs13">ProSound X1 Headphones</div>
            <span class="badge badge-pink mt4 fs10">Shop Product</span>
          </div>
        </div>
        <div class="card p12 flex gap12" style="background:var(--card2); align-items:center; cursor:pointer" onclick="showToast('Opening UI/UX class...')">
          <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:var(--bg2)">
            <span class="material-symbols-rounded emoji-3d" style="font-size:28px; color:var(--pink)">palette</span>
          </div>
          <div>
            <div class="fw8 tc-1 fs13">UI/UX Design Masterclass</div>
            <span class="badge badge-blue mt4 fs10">Course</span>
          </div>
        </div>
        <div class="card p12 flex gap12" style="background:var(--card2); align-items:center; cursor:pointer" onclick="showToast('Opening CRISPR Paper...')">
          <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:var(--bg2)">
            <span class="material-symbols-rounded emoji-3d" style="font-size:28px; color:var(--blue)">science</span>
          </div>
          <div>
            <div class="fw8 tc-1 fs13">Visualizing CRISPR Efficiencies</div>
            <span class="badge badge-purple mt4 fs10">Science Paper</span>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'history') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">history</span> History Ledger</span>
        <span class="badge badge-blue">Watch Log</span>
      </div>
      <div class="flex flex-col gap8">
        <div class="card p12 flex-between" style="background:var(--card2)">
          <div>
            <div class="fw8 tc-1 fs12">Building SaaS in 60 seconds - Complete Rebuild</div>
            <div class="fs10 tc-3 mt4">Watched 5m ago · 85% Completed</div>
            <div class="progress-bar mt8" style="width:200px; height:4px; margin:0"><div class="progress-fill" style="width:85%"></div></div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="showToast('Loading Player...')">Resume Video</button>
        </div>
        <div class="card p12 flex-between" style="background:var(--card2)">
          <div>
            <div class="fw8 tc-1 fs12">Designing the Digital Sovereignty Stack - Episode 42</div>
            <div class="fs10 tc-3 mt4">Listened 1d ago · 10% Completed</div>
            <div class="progress-bar mt8" style="width:200px; height:4px; margin:0"><div class="progress-fill" style="width:10%"></div></div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="showToast('Loading Podcast...')">Resume Podcast</button>
        </div>
      </div>
    `;
  }
  else if (tab === 'liked') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--pink)">favorite</span> Curated Likes</span>
        <span class="badge badge-pink">Ecosystem Likes</span>
      </div>
      <div class="card p20 mb16 text-center" style="background:linear-gradient(135deg, var(--pink-s), var(--purple-s))">
        <div style="display:grid; place-items:center"><span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--pink)">favorite</span></div>
        <div class="fw8 tc-1 fs16 mt8">Your Likes Ledger</div>
        <p class="tc-3 fs12 mt4">You have liked posts, shortys, and articles in this session.</p>
      </div>
      <div id="liked-posts-list" class="flex flex-col gap12">
        ${DATA.posts.slice(0, 2).map(p => {
          const mockLiked = {...p, liked: true};
          return renderPostCard(mockLiked);
        }).join('')}
      </div>
    `;
  }
  else if (tab === 'purchases') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">shopping_cart</span> Marketplace Orders</span>
        <span class="badge badge-blue">Verified Transactions</span>
      </div>
      <div class="card p20 mb16">
        <div class="flex-between pb12" style="border-bottom:1px solid var(--border)">
          <div>
            <div class="fw8 tc-1 fs14">Order #TS-8420-18</div>
            <div class="fs11 tc-3 mt4">Purchased May 26, 2026 · Total: $89.99</div>
          </div>
          <span class="badge badge-blue" style="background:var(--blue-s); color:var(--blue); display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:14px">local_shipping</span> IN TRANSIT
          </span>
        </div>
        <div class="flex gap16 mt16" style="align-items:center">
          <div style="display:inline-flex; align-items:center; justify-content:center; width:64px; height:64px; border-radius:var(--r2); background:var(--bg2)">
            <span class="material-symbols-rounded emoji-3d" style="font-size:42px; color:var(--blue)">headphones</span>
          </div>
          <div style="flex:1">
            <div class="fw8 tc-1 fs13">ProSound X1 Wireless Headphones</div>
            <div class="fs11 tc-3 mt4">Seller: AudioTech · Status: Package left sorting center.</div>
          </div>
        </div>
        <div class="order-tracker mt16 flex gap4" style="align-items:center; justify-content:center">
          <div style="width:12px; height:12px; border-radius:50%; background:var(--blue)"></div>
          <div style="flex:1; height:3px; background:var(--blue)"></div>
          <div style="width:12px; height:12px; border-radius:50%; background:var(--blue)"></div>
          <div style="flex:1; height:3px; background:var(--blue)"></div>
          <div style="width:12px; height:12px; border-radius:50%; background:var(--blue); animation:pulse-dot 1.5s infinite"></div>
          <div style="flex:1; height:3px; background:var(--border)"></div>
          <div style="width:12px; height:12px; border-radius:50%; background:var(--border)"></div>
        </div>
        <div class="flex-between mt8 fs10 tc-3">
          <span>Processed</span>
          <span>Shipped</span>
          <span>In Transit</span>
          <span>Delivered</span>
        </div>
        <div class="flex gap8 mt20">
          <button class="btn btn-ghost btn-sm flex-center gap4" onclick="showToast('Tracking coordinates loaded!')" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:16px">location_on</span> Live Track
          </button>
          <button class="btn btn-primary btn-sm flex-center gap4" onclick="generatePdfReceipt()" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:16px">description</span> Generate PDF Receipt
          </button>
        </div>
      </div>
    `;
  }
  else if (tab === 'nfts') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--pink)">token</span> Blockchain Assets</span>
        <span class="badge badge-pink">Trendchain Mainnet</span>
      </div>
      <div class="grid-3 gap16">
        <div class="nft-holo-card">
          <div class="avatar av-xl mx-auto flex-center" style="background:linear-gradient(135deg, #00f2fe, #4facfe); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded emoji-3d" style="font-size:32px">rocket_launch</span>
          </div>
          <div class="fw8 tc-1 fs13 mt12 text-center">SpaceCrafting Alpha Ticket</div>
          <div class="fs10 tc-pink mt4 text-center">Token #1024 · Minted</div>
          <div class="fs11 tc-3 mt8 pb8" style="border-bottom:1px solid var(--border)">
            <div><strong>Contract:</strong> 0x3a4b...c69e</div>
            <div class="mt2"><strong>Royalties:</strong> 2.5% Creator</div>
          </div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="showToast('NFT locked on ledger!')">
            <span class="material-symbols-rounded" style="font-size:14px">lock</span> Transfer NFT
          </button>
        </div>
        <div class="nft-holo-card">
          <div class="avatar av-xl mx-auto flex-center" style="background:linear-gradient(135deg, #f355da, #700687); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded emoji-3d" style="font-size:32px">palette</span>
          </div>
          <div class="fw8 tc-1 fs13 mt12 text-center">Neon Story Ring #1</div>
          <div class="fs10 tc-pink mt4 text-center">Token #0082 · Minted</div>
          <div class="fs11 tc-3 mt8 pb8" style="border-bottom:1px solid var(--border)">
            <div><strong>Contract:</strong> 0x7c4e...d82a</div>
            <div class="mt2"><strong>Royalties:</strong> 5.0% Creator</div>
          </div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="showToast('NFT locked on ledger!')">
            <span class="material-symbols-rounded" style="font-size:14px">lock</span> Transfer NFT
          </button>
        </div>
        <div class="nft-holo-card">
          <div class="avatar av-xl mx-auto flex-center" style="background:linear-gradient(135deg, #ff0844, #ffb199); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded emoji-3d" style="font-size:32px">workspace_premium</span>
          </div>
          <div class="fw8 tc-1 fs13 mt12 text-center">Digital Sovereign Node #0014</div>
          <div class="fs10 tc-pink mt4 text-center">Token #0014 · Minted</div>
          <div class="fs11 tc-3 mt8 pb8" style="border-bottom:1px solid var(--border)">
            <div><strong>Contract:</strong> 0x8a9c...f44a</div>
            <div class="mt2"><strong>Royalties:</strong> 10.0% Creator</div>
          </div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="showToast('NFT locked on ledger!')">
            <span class="material-symbols-rounded" style="font-size:14px">lock</span> Transfer NFT
          </button>
        </div>
      </div>
    `;
  }
  else if (tab === 'wallet') {
    const b = typeof DATA !== 'undefined' && DATA.wallet ? DATA.wallet.balances : { USDT:0, BTC:0, ETH:0, SOL:0, TREND:0 };
    const m = typeof DATA !== 'undefined' && DATA.cryptoMarkets ? DATA.cryptoMarkets : [];
    
    // Helper to get real-time price
    const getPrice = (coin) => {
      if (coin === 'USDT') return 1.0;
      if (coin === 'TREND') return 0.1;
      const pair = m.find(x => x.pair === `${coin}/USDT`);
      return pair ? pair.price : 0;
    };
    
    const usdtVal = (b.USDT * getPrice('USDT')).toFixed(2);
    const btcVal = (b.BTC * getPrice('BTC')).toFixed(2);
    const ethVal = (b.ETH * getPrice('ETH')).toFixed(2);
    const solVal = (b.SOL * getPrice('SOL')).toFixed(2);
    const trendVal = (b.TREND * getPrice('TREND')).toFixed(2);
    const totalVal = (parseFloat(usdtVal) + parseFloat(btcVal) + parseFloat(ethVal) + parseFloat(solVal) + parseFloat(trendVal)).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--orange)">account_balance_wallet</span> Web3 Crypto Wallet</span>
        <span class="badge badge-purple" style="display:inline-flex; align-items:center; gap:4px"><span class="material-symbols-rounded" style="font-size:12px">lock</span> E2E Encrypted</span>
      </div>
      
      <!-- Portfolio Overview -->
      <div class="card p20 mb16 text-center" style="background: linear-gradient(135deg, var(--card2), rgba(0,0,0,0.2)); border: 1px solid var(--border);">
        <div class="fs12 tc-3 mb4">Total Portfolio Value (Real-time Market)</div>
        <div class="fw9 tc-1" style="font-size:32px">$${totalVal}</div>
        <div class="fs11 tc-green mt4">+2.4% (24h)</div>
        <div class="flex-center gap8 mt16">
          <button class="btn btn-primary btn-sm flex-center gap4"><span class="material-symbols-rounded" style="font-size:16px">add</span> Buy Crypto</button>
          <button class="btn btn-ghost btn-sm flex-center gap4"><span class="material-symbols-rounded" style="font-size:16px">credit_card</span> Withdraw</button>
        </div>
      </div>

      <div class="grid-3 gap12 mb16">
        <div class="card p16 text-center" style="background:var(--card2)">
          <div class="fs11 tc-3">BTC Balance</div>
          <div class="fw8 tc-1 fs18 mt4">${b.BTC} BTC</div>
          <div class="fs10 tc-green mt2">$${parseFloat(btcVal).toLocaleString()} USD</div>
        </div>
        <div class="card p16 text-center" style="background:var(--card2)">
          <div class="fs11 tc-3">ETH Balance</div>
          <div class="fw8 tc-1 fs18 mt4">${b.ETH} ETH</div>
          <div class="fs10 tc-green mt2">$${parseFloat(ethVal).toLocaleString()} USD</div>
        </div>
        <div class="card p16 text-center" style="background:var(--card2)">
          <div class="fs11 tc-3">TREND Balance</div>
          <div class="fw8 tc-1 fs18 mt4">${b.TREND} TREND</div>
          <div class="fs10 tc-blue mt2">$${parseFloat(trendVal).toLocaleString()} USD</div>
        </div>
      </div>
      
      <div class="grid-2 gap16">
        <!-- Send Crypto -->
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--green)">send</span> Send Crypto</h3>
          <div class="form-group">
            <label class="form-label">Recipient Wallet or @handle</label>
            <input class="input" type="text" id="wallet-recipient" placeholder="@alex_vance or 0x...">
          </div>
          <div class="form-group mt8">
            <label class="form-label">Coin Amount</label>
            <div class="flex gap4">
              <input class="input" type="number" id="wallet-amount" placeholder="0.0">
              <select class="input" id="wallet-coin" style="width:100px">
                <option value="TREND">TREND</option>
                <option value="USDT">USDT</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="SOL">SOL</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary mt12" style="width:100%" onclick="submitCryptoTransfer()">Send Payment</button>
        </div>

        <!-- Token Swap (DEX) -->
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--pink)">currency_exchange</span> Swap Tokens</h3>
          <div class="form-group">
            <label class="form-label">You Pay</label>
            <div class="flex gap4">
              <input class="input" type="number" id="swap-amount-in" placeholder="0.0">
              <select class="input" id="swap-coin-in" style="width:100px" onchange="updateSwapEstimate()">
                <option value="USDT">USDT</option>
                <option value="ETH">ETH</option>
              </select>
            </div>
          </div>
          <div class="text-center my4 tc-3"><span class="material-symbols-rounded" style="font-size:16px">arrow_downward</span></div>
          <div class="form-group">
            <label class="form-label">You Receive (Est.)</label>
            <div class="flex gap4">
              <input class="input" type="number" id="swap-amount-out" placeholder="0.0" disabled style="background:rgba(255,255,255,0.05)">
              <select class="input" id="swap-coin-out" style="width:100px" onchange="updateSwapEstimate()">
                <option value="TREND">TREND</option>
                <option value="SOL">SOL</option>
                <option value="BTC">BTC</option>
              </select>
            </div>
          </div>
          <div class="fs10 tc-3 mt4" style="text-align:right">Fee: 1.0% (Platform)</div>
          <button class="btn btn-primary mt8" style="width:100%; background:var(--pink)" onclick="submitTokenSwap()">Swap Tokens</button>
        </div>
      </div>
      
      <div class="grid-2 gap16 mt16">
        <!-- Staking Vault -->
        <div class="card p20" style="background: linear-gradient(135deg, rgba(124, 77, 255, 0.1), var(--card2))">
          <h3 class="fw8 mb12 tc-1" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--purple)">lock_clock</span> Staking Vault</h3>
          <div class="flex-between mb12">
            <span class="fs12 tc-2">Currently Staked:</span>
            <span class="fw8 tc-purple fs14">5,000 TREND</span>
          </div>
          <div class="flex-between mb12">
            <span class="fs12 tc-2">Est. APY:</span>
            <span class="fw8 tc-green fs14">12.5%</span>
          </div>
          <div class="flex gap8 mt16">
            <button class="btn btn-primary btn-sm flex-center gap4" style="flex:1" onclick="showToast('TREND Staked! +12.5% APY active.')"><span class="material-symbols-rounded" style="font-size:14px">add</span> Stake</button>
            <button class="btn btn-ghost btn-sm flex-center gap4" style="flex:1" onclick="showToast('TREND Unstaked.')"><span class="material-symbols-rounded" style="font-size:14px">remove</span> Unstake</button>
          </div>
        </div>

        <!-- Ledger History -->
        <div class="card p20 flex flex-col">
          <h3 class="fw8 mb12 tc-1" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">receipt_long</span> Ledger History</h3>
          <div style="flex:1; overflow-y:auto; max-height:160px" class="flex flex-col gap8 fs12" id="wallet-ledger">
            <div class="flex-between py4" style="border-bottom:1px solid var(--border)">
              <span class="tc-green" style="display:inline-flex; align-items:center; gap:4px"><span class="material-symbols-rounded" style="font-size:14px">arrow_downward</span> Received Deposit</span>
              <span class="fw7">+500 TREND · Just now</span>
            </div>
            <div class="flex-between py4" style="border-bottom:1px solid var(--border)">
              <span class="tc-pink" style="display:inline-flex; align-items:center; gap:4px"><span class="material-symbols-rounded" style="font-size:14px">arrow_upward</span> Sent Transfer</span>
              <span class="fw7">-50 TREND · 2h ago</span>
            </div>
            <div class="flex-between py4" style="border-bottom:1px solid var(--border)">
              <span class="tc-green" style="display:inline-flex; align-items:center; gap:4px"><span class="material-symbols-rounded" style="font-size:14px">emoji_events</span> Received Reward</span>
              <span class="fw7">+100 TREND · 1d ago</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'communities') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">forum</span> Joined Servers</span>
        <span class="badge badge-blue">Discord Sync</span>
      </div>
      <div class="discord-layout">
        <div class="server-sidebar">
          <div class="server-icon-btn active" onclick="switchDiscordServer('TechBuilders')" style="display:grid; place-items:center">
            <span class="material-symbols-rounded" style="font-size:20px; color:#fff">terminal</span>
          </div>
          <div class="server-icon-btn" onclick="switchDiscordServer('FitnessWarriors')" style="display:grid; place-items:center">
            <span class="material-symbols-rounded" style="font-size:20px; color:#fff">fitness_center</span>
          </div>
          <div class="server-icon-btn" onclick="showToast('Loading server...')" style="display:grid; place-items:center">
            <span class="material-symbols-rounded" style="font-size:20px; color:#fff">add</span>
          </div>
        </div>
        <div class="channel-sidebar">
          <div class="fw8 tc-3 fs10 mb8 uppercase">Channels</div>
          <div class="channel-link active" onclick="switchDiscordChannel('general')"># general</div>
          <div class="channel-link" onclick="switchDiscordChannel('announcements')" style="display:inline-flex; align-items:center; gap:4px">
            <span class="material-symbols-rounded" style="font-size:14px">campaign</span> announcements
          </div>
          <div class="channel-link" onclick="switchDiscordChannel('coding-tips')"># coding-tips</div>
          <div class="channel-link" onclick="switchDiscordChannel('design-critique')"># design-critique</div>
        </div>
        <div class="discord-chat-pane">
          <div class="chat-window-header" style="padding:10px 16px; border-bottom:1px solid var(--border)">
            <div class="fw8 tc-1 fs13" id="discord-channel-title"># general</div>
            <div class="fs10 tc-3 mt2">Welcome to TechBuilders Server general chat! Emojis fully active! 😊🚀</div>
          </div>
          <div style="flex:1; overflow-y:auto; padding:16px" class="flex flex-col gap8 fs12" id="discord-messages-log">
            <div><strong class="tc-blue">sarah_c:</strong> Hey guys, launching the app this afternoon! 🚀</div>
            <div><strong class="tc-purple">marcus_w:</strong> Lets gooo! Tell me if you need help with stress testing 💪</div>
            <div><strong class="tc-green">dev_kumar:</strong> Stethoscope tool is fully bound and ready!</div>
          </div>
          <div class="chat-input-row" style="padding:10px; border-top:1px solid var(--border); display:flex; gap:8px">
            <input type="text" class="input btn-sm" id="discord-input" placeholder="Message #general... Emojis supported!" style="flex:1" onkeydown="if(event.key==='Enter')submitDiscordMessage()">
            <button class="btn btn-primary btn-sm" onclick="submitDiscordMessage()">Send</button>
          </div>
        </div>
      </div>
    `;
  }
  else if (tab === 'courses') {
    html = `
      <div class="grid-2 mb16" style="gap:16px">
        <div class="card p20">
          <div class="section-hdr">
            <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--orange)">emoji_events</span> Streak Map &amp; XP Progression</span>
            <span class="badge badge-purple">Level 14</span>
          </div>
          <div class="flex gap12 mt12" style="align-items:center">
            <div class="avatar av-lg flex-center" style="background:var(--g-brand); display:grid; place-items:center; color:#fff">
              <span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--orange)">bolt</span>
            </div>
            <div style="flex:1">
              <div class="flex-between fw8 fs13 tc-1">
                <span>XP earned this week:</span>
                <span class="tc-blue">8,420 / 10,000 XP</span>
              </div>
              <div class="progress-bar mt8" style="height:8px"><div class="progress-fill" style="width:84.2%"></div></div>
              <div class="fs11 tc-3 mt4">Solve daily coding challenges to reach Level 15!</div>
            </div>
          </div>
          <div class="streak-grid mt16 flex gap4" style="justify-content:center">
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--green); color:var(--bg); font-weight:800; font-size:11px" class="flex-center">M</div>
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--green); color:var(--bg); font-weight:800; font-size:11px" class="flex-center">T</div>
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--green); color:var(--bg); font-weight:800; font-size:11px" class="flex-center">W</div>
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--blue); color:var(--bg); font-weight:800; font-size:11px; animation:pulse-dot 1.5s infinite" class="flex-center">T</div>
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--card2); border:1px solid var(--border); color:var(--t3); font-weight:800; font-size:11px" class="flex-center">F</div>
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--card2); border:1px solid var(--border); color:var(--t3); font-weight:800; font-size:11px" class="flex-center">S</div>
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--card2); border:1px solid var(--border); color:var(--t3); font-weight:800; font-size:11px" class="flex-center">S</div>
          </div>
          <div class="text-center fs11 tc-green mt8 fw7" style="display:flex; align-items:center; justify-content:center; gap:4px">
            Active streak: 4 Days in a row! <span class="material-symbols-rounded" style="font-size:16px; color:var(--orange)">local_fire_department</span>
          </div>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1" style="display:flex; align-items:center; gap:6px">
            <span class="material-symbols-rounded" style="color:var(--blue)">assignment</span> Daily Quests Checklist
          </h3>
          <div class="flex flex-col gap8 fs12">
            <div class="flex gap8" style="align-items:center">
              <input type="checkbox" checked disabled>
              <span class="tc-3" style="text-decoration:line-through">Log water macros in Fitness hub (+10 XP)</span>
            </div>
            <div class="flex gap8" style="align-items:center">
              <input type="checkbox" id="q-2" onchange="completeQuest('q-2')">
              <span id="q-txt-2">Comment on a trending post in Feed (+25 XP)</span>
            </div>
            <div class="flex gap8" style="align-items:center">
              <input type="checkbox" id="q-3" onchange="completeQuest('q-3')">
              <span id="q-txt-3">Submit a secure local civic report (+50 XP)</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  else if (tab === 'analytics') {
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--purple)">bar_chart</span> Creator Analytics</span>
        <span class="badge badge-purple">Live Feed</span>
      </div>
      <div class="grid-2 mb16" style="gap:16px">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">trending_up</span> Views Growth Dynamics</h3>
          <canvas id="profile-chart" style="width:100%; height:120px"></canvas>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--green)">monetization_on</span> Earnings &amp; Crowdfunding</h3>
          <p class="tc-3 fs12">Estimate your monthly creator payouts on Trending:</p>
          <div class="form-group mt12">
            <label class="form-label" id="calc-views-lbl">Monthly Video Views: 500K</label>
            <input type="range" class="input" min="10" max="2000" value="500" style="padding:0" oninput="calculatePayouts(this.value)">
          </div>
          <div class="flex-between mt16 pb8" style="border-bottom:1px solid var(--border)">
            <span class="fs12 tc-2">Estimated Ad Earnings:</span>
            <strong class="tc-green" id="calc-ad-earns">$1,250.00</strong>
          </div>
          <div class="flex-between mt8">
            <span class="fs12 tc-2">Estimated Royalties:</span>
            <strong class="tc-blue" id="calc-roy-earns">$450.00</strong>
          </div>
        </div>
      </div>
    `;
    setTimeout(() => drawProfileAnalyticsChart(), 100);
  }
  else if (tab === 'ai') {
    html = `
      <div class="card p20 mb16">
        <h3 class="fw8 mb12 tc-1 flex-center" style="justify-content:flex-start; gap:8px"><span class="material-symbols-rounded" style="color:var(--blue)">auto_awesome</span> Trending Voice Studio</h3>
        <p class="tc-3 fs12">Configure TTS parameters, voice clones, and subtitles:</p>
        <div class="form-group mt12">
          <label class="form-label">Voice Cloning Speed: <span id="v-speed-val">1.05x</span></label>
          <input type="range" min="0.5" max="2" step="0.05" value="1.05" class="input" style="padding:0" oninput="$id('v-speed-val').textContent = this.value+'x'; S.voiceSpeed = parseFloat(this.value);">
        </div>
        <div class="form-group mt8">
          <label class="form-label">Active Voice Model</label>
          <select class="input" id="active-voice-model" onchange="changeVoiceModel(this.value)">
            <option value="female-premium" ${S.voiceModel === 'female-premium' ? 'selected' : ''}>Premium Female Pet Sounds (Default)</option>
            <option value="female-natural" ${S.voiceModel === 'female-natural' ? 'selected' : ''}>Natural Female Assistant</option>
            <option value="male-premium" ${S.voiceModel === 'male-premium' ? 'selected' : ''}>Premium Male Pet Sounds</option>
          </select>
        </div>
        <div class="form-group mt8">
          <label class="form-label">Subtitles Auto-Caption Style</label>
          <select class="input" id="subtitles-style" onchange="showToast('Autocaptions updated!')">
            <option value="neon">Neon Spark Highlights</option>
            <option value="minimal">Minimal White Outlines</option>
            <option value="karaoke">Karaoke Sync</option>
          </select>
        </div>
        <div class="flex gap8 mt12">
          <button class="btn btn-ghost btn-sm" onclick="speakText('Test narration active on Trending engine! All settings verified!')">🔊 Test Voice</button>
          <button class="btn btn-primary btn-sm" onclick="showToast('Pet Sounds fingerprint updated!')">🔒 Sync Voice Profile</button>
        </div>
      </div>
    `;
  }
  else if (tab === 'settings') {
    html = `
      <div class="grid-2 gap16">
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1">🎨 Visual Customizer</h3>
          <p class="tc-3 fs12 mb12">Change the global ecosystem accent color instantly:</p>
          <div class="flex gap8 mb16">
            <div class="color-swatch swatch-blue active" onclick="changeThemeAccent('blue')" title="Blue Accent"></div>
            <div class="color-swatch swatch-green" onclick="changeThemeAccent('green')" title="Green Accent"></div>
            <div class="color-swatch swatch-orange" onclick="changeThemeAccent('orange')" title="Orange Accent"></div>
            <div class="color-swatch swatch-pink" onclick="changeThemeAccent('pink')" title="Pink Accent"></div>
            <div class="color-swatch swatch-purple" onclick="changeThemeAccent('purple')" title="Purple Accent"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Bio Details</label>
            <textarea class="input" id="profile-bio-editor" style="height:72px" placeholder="Update your creator bio...">Digital creator &amp; tech enthusiast. Building the future one post at a time. 🚀</textarea>
          </div>
          <button class="btn btn-primary mt12" onclick="saveProfileBioEditor()">Save Settings</button>
        </div>
        <div class="card p20">
          <h3 class="fw8 mb12 tc-1 flex-center" style="justify-content:flex-start; gap:8px"><span class="material-symbols-rounded" style="color:var(--pink)">security</span> Anti-Hack Security Core</h3>
          <p class="tc-3 fs12 mb12">Trigger system defenses and manage security settings:</p>
          <div class="flex-between py8" style="border-bottom:1px solid var(--border)">
            <div>
              <div class="fw7 fs12 tc-1">Ghost Privacy Mode</div>
              <div class="fs10 tc-3">Hide online status dots and profile handles.</div>
            </div>
            <input type="checkbox" onchange="toggleGhostMode(this)">
          </div>
          <div class="flex-between py8" style="border-bottom:1px solid var(--border)">
            <div>
              <div class="fw7 fs12 tc-1">System Anti-Lock Firewall</div>
              <div class="fs10 tc-3">Require biometric fingerprint mockup before withdrawals.</div>
            </div>
            <input type="checkbox" checked onchange="showToast('Biometrics mockup enforced!')">
          </div>
          <button class="btn btn-primary mt12" style="width:100%" onclick="showToast('2FA credentials verified via security key!')">Configure 2FA Token</button>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  if (typeof IX !== 'undefined' && IX.bindAllEmojis) {
    IX.bindAllEmojis(container);
  }
}