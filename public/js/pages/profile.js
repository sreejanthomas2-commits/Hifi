// ── PROFILE ──────────────────────────────────────────────────────
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

function renderProfile(tab) {
  PG.init();
  /* Whose page is this? PG.openUser sets a subject and then navigates
     here, so it arms this. Every other way into the pane - the nav bar,
     the sidebar, a deep link - arrives unarmed and gets you. That is the
     single place the question is answered, so there is one place to look
     when the wrong person shows up. */
  PG.claim();
  // The profile template is injected lazily, so the initial updateUserUI()
  // ran before these nodes existed — re-sync name/handle/bio with the
  // signed-in (or guest) user every time the pane opens.
  if (typeof updateUserUI === 'function') updateUserUI();
  syncProfileIdentity();
  const content = $id('prof-tab-dynamic-content');
  const st = PG.state;
  if (content && !content.innerHTML) PG.show('posts');
  // Posts and Shorty can change while you're elsewhere; the Crypto tab keeps
  // whatever you were typing, unless a wallet just connected.
  else if (!st.section && (st.tab === 'posts' || st.tab === 'shorty' || (tab === 'wallet' && st.tab === 'crypto'))) PG.show(st.tab);
  PG.paint();
}

// Fill the profile fields that updateUserUI() doesn't own, so a guest never
// sees another person's hardcoded identity.
function syncProfileIdentity() {
  /* PG.user() is you unless a subject is set. updateUserUI() runs just
     before this and writes YOUR name into these same fields - correct
     for the sidebar, wrong for the pane - so this runs after it and
     paints whoever the page is actually about. */
  const u = (typeof PG !== 'undefined' && PG.user) ? PG.user()
          : ((typeof S !== 'undefined' && S.user) ? S.user : null);
  if (!u) return;

  /* You are stored as fname/lname; everybody else arrives as one name.
     Reading the wrong pair is how the page came out saying "undefined". */
  const other = !!(typeof PG !== 'undefined' && PG.subject && PG.subject());
  const isGuest = !other && u.fname === 'Guest';
  const fullName = other ? (u.name || u.handle || 'Account')
    : (isGuest ? 'Guest Explorer' : `${u.fname} ${u.lname || ''}`.trim());
  const handle = other ? (u.handle || '@account') : (isGuest ? '@guest' : (u.handle || '@user'));

  const set = (id, val) => { const el = $id(id); if (el) el.textContent = val; };
  set('profile-name', fullName);

  /* updateUserUI() owns these for your own page and appends your level to
     the handle; on someone else's it has just written your identity into
     them, so they are set here from the subject instead. The avatar is
     their initials, and the camera that edits your photo goes with it. */
  if (other) {
    set('profile-handle', handle);
    const av = $id('profile-av');
    if (av) {
      av.textContent = String(fullName).split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      av.style.backgroundImage = '';
      av.classList.remove('pme-photo');
    }
    document.querySelectorAll('#pane-profile .pme-pav-cam, #pane-profile .pme-avcam, #pane-profile .pg-avcam')
      .forEach(c => { c.style.display = 'none'; });
  } else {
    /* Put your own initials back. updateUserUI only writes this slot for
       a signed-in user, so a guest returning from somebody else's page
       kept their letters sitting in it. Left alone when a real photo is
       in there - that is profileme's, and it owns the background. */
    const av = $id('profile-av');
    if (av && !av.classList.contains('pme-photo')) {
      av.textContent = isGuest ? 'AV'
        : `${(u.fname || 'A')[0]}${(u.lname || 'V')[0]}`.toUpperCase();
    }
    document.querySelectorAll('#pane-profile .pme-pav-cam, #pane-profile .pme-avcam, #pane-profile .pg-avcam')
      .forEach(c => { c.style.display = ''; });
  }

  const editName = $id('edit-name'); if (editName && !other) editName.value = fullName;
  const editHandle = $id('edit-handle'); if (editHandle && !other) editHandle.value = handle;

  // A guest is nobody's verified creator — hide the badge and zero the
  // stats rather than showing a demo account's numbers as if they're theirs.
  // Nor is a fixture account: nothing here has verified anybody.
  const verified = $id('profile-verified');
  if (verified) verified.style.display = (isGuest || other) ? 'none' : '';

  if (other) {
    /* Followers, following and the post count are PG.dress()'s — it has
       the subject and the seeded numbers search already shows. */
    set('profile-location', '');
  } else if (isGuest) {
    set('profile-stat-followers', '0');
    set('profile-stat-following', '0');
    set('profile-stat-posts', String((DATA.posts || []).filter(p => p.mine).length));
    set('profile-location', 'Location not set');
    const link = $id('profile-link'); if (link) link.textContent = 'Add a link';
  } else {
    set('profile-location', u.location || 'Location not set');
    const link = $id('profile-link');
    if (link) link.textContent = u.link || `trending.app/${handle.replace('@','')}`;
  }
}


function toggleEditForm() {
  /* Reachable only from your own page - the button is not rendered on
     anyone else's - but guarded anyway, because a stale handler or a
     console call should not write your name over somebody else's. */
  if (typeof PG !== 'undefined' && PG.subject && PG.subject()) { PG.openMe(); return; }
  // The full Edit profile page (photo, cover, birthday) replaces the inline form.
  if (window.PME) { PME.open(); return; }
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

/* The Wallet tab's swap lives in WV now, priced off the live feed. These
   two used to read a static mock table, so a swap executed at a price no
   market was quoting. They are kept as forwarders because other screens
   still link to "swap". */
window.updateSwapEstimate = function() {
  if (typeof WV !== 'undefined') WV.setSwap('amount', (document.getElementById('wv-swap-amt') || {}).value || '');
};
window.submitTokenSwap = function() {
  if (typeof WV !== 'undefined') WV.doSwap();
};

function saveProfileChanges() {
  if (typeof PG !== 'undefined' && PG.subject && PG.subject()) return;
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
  const ico = n => `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
  return `<section id="pane-profile" class="pane">
      <div class="pg">
        <!-- Top bar: username, Create, menu -->
        <div class="pg-top">
          <h1 class="pg-top-u" id="pg-top-handle">profile</h1>
          <div class="pg-top-a">
            <button type="button" class="pg-ib" data-pg="create" aria-label="Create" title="Create">${ico('add_box')}</button>
            <button type="button" class="pg-ib" data-pg="menu" aria-label="Menu" title="Menu" aria-haspopup="dialog">${ico('menu')}</button>
          </div>
        </div>

        <!-- Photo, counts, name, bio, buttons -->
        <div class="pg-hero">
          <div class="pg-avcol">
            <div class="pg-ring"><div class="avatar pg-av" id="profile-av">AV</div></div>
          </div>
          <div class="pg-stats">
            <button type="button" class="pg-stat" data-pg="tab:posts"><b id="profile-stat-posts">0</b><span>posts</span></button>
            <div class="pg-stat"><b id="profile-stat-followers">28.4K</b><span>followers</span></div>
            <div class="pg-stat"><b id="profile-stat-following">892</b><span>following</span></div>
          </div>
          <div class="pg-info">
            <div class="pg-name">
              <span id="profile-name">Alex Vance</span>
              <span class="material-symbols-rounded pg-verified" id="profile-verified" title="Verified creator">verified</span>
            </div>
            <div class="pg-meta">
              <span id="profile-handle">@alex_vance</span>
              <span class="pme-metaitem" id="profile-location-wrap"><span>·</span><span id="profile-location">San Francisco, CA</span></span>
            </div>
            <div class="profile-bio pg-bio" id="profile-bio">Digital creator &amp; tech enthusiast. Building the future one post at a time.</div>
            <div class="pg-linkrow">${ico('link')}<a href="#" id="profile-link" data-pg="link">trending.app/alex</a></div>
            <div class="pg-chips">
              <span class="pg-chip">${ico('shield')}<b id="profile-rep">98%</b> reputation</span>
              <span class="pg-chip">${ico('auto_awesome')}<b id="profile-ai-trust">99%</b> AI trust</span>
              <span class="pg-chip">${ico('local_fire_department')}<b>5 days</b> streak</span>
            </div>
          </div>
          <div class="pg-btns">
            <button type="button" class="pg-btn" onclick="toggleEditForm()">Edit profile</button>
            <button type="button" class="pg-btn" data-pg="share">Share profile</button>
            <button type="button" class="pg-btn pg-btn-ic" data-pg="people" aria-label="Discover people" title="Discover people">${ico('person_add')}</button>
          </div>
        </div>

        <!-- Story highlights: the circles are for your stories (HL.paint) -->
        <div class="pg-hl" id="pg-hl" role="list" aria-label="Story highlights"></div>

        <!-- Crypto: always on the profile, whichever tab is open -->
        <div class="pg-cx" role="group" aria-label="Your crypto">
          <button type="button" class="pg-cx-cell" data-pg="portfolio">
            <span class="pg-cx-l">${ico('account_balance_wallet')}Assets</span><b id="pg-cx-equity">—</b>
          </button>
          <button type="button" class="pg-cx-cell" data-pg="wallet">
            <span class="pg-cx-l">${ico('account_balance_wallet')}Wallet</span><b id="pg-cx-wallet">—</b>
          </button>
          <button type="button" class="pg-cx-cell" data-pg="earn">
            <span class="pg-cx-l">${ico('savings')}Staked</span><b id="pg-cx-staked">—</b>
          </button>
          <div class="pg-cx-acts" id="pg-cx-acts" role="group" aria-label="Crypto actions"></div>
          <span class="pg-cx-note">${ico('info')}Simulated balances · no real money moves</span>
        </div>

        <!-- Posts · Shorty · Crypto · Library -->
        <div class="pg-tabs" id="pg-tabs" role="tablist" aria-label="Profile"></div>
        <div id="prof-tab-dynamic-content" class="pg-body" role="tabpanel"></div>

        <!-- Fallback editor, used only if the Edit profile page is unavailable -->
        <div id="edit-form" class="card mt16" style="display:none; padding:24px">
          <h3 class="fw8 mb16 tc-1">Edit Profile Details</h3>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px">
            <input class="input" type="text" id="edit-fname" aria-label="First name">
            <input class="input" type="text" id="edit-lname" aria-label="Last name">
          </div>
          <input class="input" type="text" id="edit-handle" aria-label="Username" style="margin-bottom:12px">
          <textarea class="input" id="edit-bio" aria-label="Bio" style="height:80px; resize:none; margin-bottom:16px"></textarea>
          <div class="flex gap8">
            <button class="btn btn-primary btn-sm" onclick="saveProfileChanges()">Save Changes</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleEditForm()">Cancel</button>
          </div>
        </div>
      </div>
      </section>`;
}


/* Kept for callers elsewhere (Home's wallet card, the swap form, the
   profile composer): Posts, Shorty, Crypto and Library are tabs, anything
   else opens as a section. */
function switchProfileTab(tab) { PG.show(tab); }

/* The markup for one profile section. */
function profileSectionHTML(tab) {
  let html = '';

  if (tab === 'posts') {
    html = PG.composerHTML() + PG.listHTML();
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
          <div class="avatar av-lg mx-auto flex-center" style="background:var(--g-pink); display:grid; place-items:center; color:var(--on-brand)">
            <span class="material-symbols-rounded" style="font-size:24px">movie</span>
          </div>
          <div class="fw8 fs13 tc-1 mt8">UI Design Secrets</div>
          <div class="fs11 tc-pink mt4" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px">favorite</span> 24.5K Likes</div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="navigateTo('reels').then(() =&gt; openShortyPopup(5))">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Play Shorty
          </button>
        </div>
        <div class="card product-card text-center p12" style="background:var(--card2)">
          <div class="avatar av-lg mx-auto flex-center" style="background:var(--g-brand); display:grid; place-items:center; color:var(--on-brand)">
            <span class="material-symbols-rounded" style="font-size:24px">bolt</span>
          </div>
          <div class="fw8 fs13 tc-1 mt8">5AM Cardio Hustle</div>
          <div class="fs11 tc-pink mt4" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px">favorite</span> 18.2K Likes</div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="navigateTo('reels').then(() =&gt; openShortyPopup(1))">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Play Shorty
          </button>
        </div>
        <div class="card product-card text-center p12" style="background:linear-gradient(135deg, var(--orange), var(--red)); display:grid; place-items:center; color:#fff">
          <div class="avatar av-lg mx-auto flex-center" style="background:linear-gradient(135deg, var(--orange), var(--red)); display:grid; place-items:center; color:#fff">
            <span class="material-symbols-rounded" style="font-size:24px">local_fire_department</span>
          </div>
          <div class="fw8 fs13 tc-1 mt8">Methane synthesis lab</div>
          <div class="fs11 tc-pink mt4" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px">favorite</span> 31.7K Likes</div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="navigateTo('reels').then(() =&gt; openShortyPopup(4))">
            <span class="material-symbols-rounded" style="font-size:14px">play_arrow</span> Play Shorty
          </button>
        </div>
        <div class="card product-card text-center p12" style="background:var(--card2)">
          <div class="avatar av-lg mx-auto flex-center" style="background:var(--g-brand); display:grid; place-items:center; color:var(--on-brand)">
            <span class="material-symbols-rounded" style="font-size:24px">terminal</span>
          </div>
          <div class="fw8 fs13 tc-1 mt8">CSS Glassmorphism in 15s</div>
          <div class="fs11 tc-pink mt4" style="display:inline-flex; align-items:center; gap:2px"><span class="material-symbols-rounded" style="font-size:12px">favorite</span> 15.9K Likes</div>
          <button class="btn btn-ghost btn-sm mt12 flex-center gap4" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px" onclick="navigateTo('reels').then(() =&gt; openShortyPopup(3))">
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
        <div class="avatar av-xl flex-center" style="background:var(--g-brand); font-size:32px; display:grid; place-items:center; color:var(--on-brand)">
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
          <div style="width:12px; height:12px; border-radius:50%; background:var(--brand-fill)"></div>
          <div style="flex:1; height:3px; background:var(--brand-fill)"></div>
          <div style="width:12px; height:12px; border-radius:50%; background:var(--brand-fill)"></div>
          <div style="flex:1; height:3px; background:var(--brand-fill)"></div>
          <div style="width:12px; height:12px; border-radius:50%; background:var(--brand-fill); animation:pulse-dot 1.5s infinite"></div>
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
    /* The Wallet tab and the Assets page used to be two balance screens
       that disagreed — different prices, different coins counted, and a
       history of three invented rows. Both are one view now; WV renders
       it from MNY, the same source the Assets page reads. */
    html = `
      <div class="section-hdr mb12">
        <span class="section-title" style="display:inline-flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--orange)">account_balance_wallet</span> Wallet</span>
        <button class="btn btn-ghost btn-sm flex-center gap4" onclick="navigateTo('portfolio')"><span class="material-symbols-rounded" style="font-size:14px">open_in_full</span> Full assets</button>
      </div>
      ${typeof WV !== 'undefined' ? WV.html() : '<div class="card p20 tc-3">The wallet is still loading…</div>'}
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
            <div class="avatar av-lg flex-center" style="background:var(--g-brand); display:grid; place-items:center; color:var(--on-brand)">
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
            <div style="width:24px; height:24px; border-radius:var(--r1); background:var(--brand-fill); color:var(--bg); font-weight:800; font-size:11px; animation:pulse-dot 1.5s infinite" class="flex-center">T</div>
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
            <strong class="tc-green" id="calc-ad-earns">$1,250.00 (0.0183 BTC)</strong>
          </div>
          <div class="flex-between mt8">
            <span class="fs12 tc-2">Estimated Royalties:</span>
            <strong class="tc-blue" id="calc-roy-earns">$450.00 (0.0066 BTC)</strong>
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

  return html;
}

/* ══════════════════════════════════════════════════════════════════
   PROFILE LAYOUT (PG)
   Instagram's profile shape: photo and counts, name and bio, Edit and
   Share, story highlights in circles, then Posts · Shorty · Crypto ·
   Library. The crypto card, with its action buttons, sits above the
   tabs, so it is on the profile whichever tab is open. Every older section is
   still here: content types in Library, account things in the menu.
   ══════════════════════════════════════════════════════════════════ */
const PG = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ico = (n, cls) => `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}" aria-hidden="true">${n}</span>`;
  // Whole dollars from $10,000 up, so the three amounts fit side by side on a phone.
  const money = v => { v = Number(v) || 0; const big = Math.abs(v) >= 1e4; return '$' + v.toLocaleString('en-US', { minimumFractionDigits: big ? 0 : 2, maximumFractionDigits: big ? 0 : 2 }); };
  const compact = n => { n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n); };
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  /* ── Whose profile ────────────────────────────────────────────────
     null is you. Anything else is a person from DATA.users, and every
     read below goes through user(), which is why one variable is enough
     to point the whole page at somebody else. */
  let SUBJECT = null;
  let ARMED = false;          // openUser navigated here on purpose
  let BACK_TO = '';           // the pane to return to

  const user = () => SUBJECT || (typeof S !== 'undefined' && S.user) || {};
  const subject = () => SUBJECT;
  const mine = () => !SUBJECT;
  const guest = () => mine() && user().fname === 'Guest';

  /* Follower counts come from SR, which already shows this person in
     search. Calling its function rather than copying it is the only way
     the two pages agree on the number - and a person whose profile says
     52K in one place and 41K in another is worse than no number. */
  const followerCount = (h, salt) =>
    (window.SR && SR.seeded) ? SR.seeded(String(h || '') + (salt || ''), salt ? 80 : 900, salt ? 2400 : 480000) : null;

  function accountFor(handle, name) {
    const h = String(handle || '').toLowerCase();
    const from = (window.UID && UID.contacts) ? UID.contacts() : ((typeof DATA !== 'undefined' && DATA.users) || []);
    const hit = from.find(u => String(u.handle || '').toLowerCase() === h);
    if (hit) return { name: hit.name, handle: hit.handle, online: !!hit.online };
    return name ? { name: String(name), handle: String(handle || '') } : null;
  }

  /* Open somebody else's page. Chained on navigateTo because the pane is
     built after its first await - the same thing that had Edit profile
     opening blank. */
  function openUser(handle, name) {
    const a = accountFor(handle, name);
    if (!a) return false;
    if (!mine() && String(a.handle).toLowerCase() === String(user().handle || '').toLowerCase()) return true;
    const me = (typeof S !== 'undefined' && S.user) ? String(S.user.handle || '').toLowerCase() : '';
    if (me && me === String(a.handle).toLowerCase()) return openMe();
    SUBJECT = a;
    ARMED = true;
    BACK_TO = (typeof S !== 'undefined' && S.pane && S.pane !== 'profile') ? S.pane : 'feeds';
    V.tab = 'posts';
    V.section = '';
    if (typeof navigateTo === 'function') {
      Promise.resolve(navigateTo('profile')).then(() => { dress(); show('posts'); paint(); });
    }
    return true;
  }

  function openMe() {
    SUBJECT = null; ARMED = false;
    V.tab = 'posts'; V.section = '';
    dress();
    if (typeof syncProfileIdentity === 'function') syncProfileIdentity();
    show('posts'); paint();
    return true;
  }

  function back() {
    const to = BACK_TO || 'feeds';
    SUBJECT = null; ARMED = false; BACK_TO = '';
    if (typeof navigateTo === 'function') navigateTo(to);
  }

  /* Called by renderProfile on every arrival: keep a subject that
     openUser just set, drop one left over from last time. */
  function claim() {
    if (ARMED) { ARMED = false; return; }
    if (SUBJECT) { SUBJECT = null; BACK_TO = ''; }
    dress();
  }

  /* The parts of the page that are yours and nobody else's: the crypto
     strip, your story highlights, Edit and Share, the Crypto and Library
     tabs, and the reputation chips. Hidden rather than rebuilt, so your
     own page is the same DOM it always was. */
  function dress() {
    const pg = document.querySelector('#pane-profile .pg');
    if (!pg) return;
    const other = !mine();
    pg.classList.toggle('pg--other', other);

    const btns = $('pg-btns') || pg.querySelector('.pg-btns');
    if (btns) {
      btns.innerHTML = other
        ? `<button type="button" class="pg-btn pg-btn-go" data-pg="follow">Follow</button>
           <button type="button" class="pg-btn" data-pg="message">Message</button>
           <button type="button" class="pg-btn" data-pg="payto">Pay</button>`
        : `<button type="button" class="pg-btn" onclick="toggleEditForm()">Edit profile</button>
           <button type="button" class="pg-btn" data-pg="share">Share profile</button>
           <button type="button" class="pg-btn pg-btn-ic" data-pg="people" aria-label="Discover people" title="Discover people">${ico('person_add')}</button>`;
    }

    const acts = pg.querySelector('.pg-top-a');
    if (acts) acts.style.display = other ? 'none' : '';
    let b = $('pg-back');
    if (other && !b) {
      b = document.createElement('button');
      b.type = 'button'; b.id = 'pg-back'; b.className = 'pg-ib pg-back';
      /* Not 'back' — act() already uses that for stepping out of a
         section into its tab. Two meanings on one key is how a button
         silently does the wrong thing. */
      b.setAttribute('aria-label', 'Back'); b.dataset.pg = 'leave';
      b.innerHTML = ico('arrow_back');
      pg.querySelector('.pg-top').prepend(b);
    } else if (!other && b) b.remove();

    /* Their numbers, or nothing. The seeded counts are the ones search
       already shows for this person; a bio, a location and a link are
       things a fixture account does not have, and inventing them would
       be putting words in somebody's mouth. */
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    if (other) {
      const u = user();
      const f = followerCount(u.handle), g2 = followerCount(u.handle, 'f');
      set('profile-stat-followers', f == null ? '—' : compact(f));
      set('profile-stat-following', g2 == null ? '—' : compact(g2));
      const bio = $('profile-bio'); if (bio) { bio.textContent = ''; bio.style.display = 'none'; }
      const lw = $('profile-location-wrap'); if (lw) lw.style.display = 'none';
      const lr = pg.querySelector('.pg-linkrow'); if (lr) lr.style.display = 'none';
    } else {
      const bio = $('profile-bio'); if (bio) bio.style.display = '';
      const lr = pg.querySelector('.pg-linkrow'); if (lr) lr.style.display = '';
    }
    paintTabs();
  }


  const TABS = [['posts', 'Posts', 'grid_on'], ['shorty', 'Shorty', 'slow_motion_video'], ['crypto', 'Crypto', 'token'], ['library', 'Library', 'widgets']];
  const LIBRARY = [
    ['videos', 'Videos', 'video_library'], ['photos', 'Photos', 'image'], ['articles', 'Articles', 'article'],
    ['podcasts', 'Podcasts', 'podcasts'], ['music', 'Music', 'music_note'], ['livestreams', 'Livestreams', 'sensors'],
    ['documents', 'Documents', 'description'], ['research', 'Research', 'school'], ['courses', 'Courses', 'local_library'],
    ['communities', 'Communities', 'forum']
  ];
  const MENU = [
    ['saved', 'Saved', 'bookmark'], ['liked', 'Liked', 'favorite'], ['history', 'History', 'history'],
    ['purchases', 'Purchases', 'shopping_cart'], ['analytics', 'Analytics', 'insights'],
    ['ai', 'AI Assistant', 'auto_awesome'], ['settings', 'Profile settings', 'tune']
  ];
  const CIRCLES = [
    ['wallet', 'Wallet', 'account_balance_wallet', '#FCD535'], ['send', 'Send', 'send', '#2EBD85'],
    ['receive', 'Receive', 'qr_code_2', '#3B82F6'], ['scan', 'Scan', 'qr_code_scanner', '#0EA5E9'],
    ['swap', 'Swap', 'currency_exchange', '#EC4899'], ['trade', 'Trade', 'candlestick_chart', '#8A6400'],
    ['earn', 'Earn', 'savings', '#F0B90B'], ['p2p', 'P2P', 'swap_horiz', '#26A69A'], ['nfts', 'NFTs', 'token', '#F355DA']
  ];
  const TITLES = Object.fromEntries([...TABS, ...LIBRARY, ...MENU].map(([k, l]) => [k, l]));
  // Which tab stays lit while a section is open.
  const OWNER = Object.fromEntries([...LIBRARY.map(([k]) => [k, 'library']), ['list', 'posts'], ['compose', 'posts']]);

  const V = { tab: 'posts', section: null };
  let shorts = [];

  /* ── Your posts ──────────────────────────────────────────────────── */
  function myPosts() {
    const u = user();
    const posts = (typeof DATA !== 'undefined' && DATA.posts) || [];
    /* p.mine marks the ones you wrote in this session; it means nothing
       on anybody else's page, where the handle is the only test. */
    if (!mine()) {
      const h = String(u.handle || '').toLowerCase();
      return posts.filter(p => String(p.handle || '').toLowerCase() === h);
    }
    return posts.filter(p => p.mine || (u.handle && p.handle === u.handle));
  }

  const HUES = { crypto: 32, tech: 250, fitness: 150, motivation: 330, design: 285, sports: 200, agriculture: 95, music: 300 };
  const hue = p => HUES[p.category] != null ? HUES[p.category] : [...String(p.body || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

  function postsGridHTML() {
    const list = myPosts();
    if (!list.length) return emptyHTML('photo_camera', 'Share your first post', 'Posts you publish show up here, on your profile.', 'compose', 'Create a post');
    return `<div class="pg-grid">${list.map((p, i) => {
      const text = String(p.body || '').replace(/\s+/g, ' ').trim();
      const kind = p.type === 'poll' ? 'ballot' : p.type === 'emoji' ? 'mood' : '';
      return `<button type="button" class="pg-tile${kind ? ' has-k' : ''}" data-pg="post" data-i="${i}" style="--h:${hue(p)}" aria-label="${esc(text.slice(0, 80) || 'Post')}">
        <span class="pg-tile-t">${esc(text.slice(0, 160))}</span>
        ${kind ? `<span class="pg-tile-k">${ico(kind)}</span>` : ''}
        <span class="pg-tile-o">${ico('favorite')}${compact(p.likes)}&nbsp;&nbsp;${ico('chat_bubble')}${compact(p.comments)}</span>
      </button>`;
    }).join('')}</div>`;
  }

  function composerHTML() {
    const u = user();
    const src = window.PME && PME.photo ? PME.photo() : '';
    const ini = `${(u.fname || '?')[0]}${(u.lname || '')[0] || ''}`.toUpperCase();
    return `<div class="composer card mb16 pg-composer">
        <div class="composer-row">
          <div class="avatar av-sm"${src ? ` style="background:url('${src}') center / cover"` : ''}>${src ? '' : esc(ini)}</div>
          <input class="composer-input" id="profile-post-input" placeholder="What's on your mind?" aria-label="Write a post" onkeydown="if(event.key==='Enter')publishProfilePost()">
        </div>
        <div class="composer-actions mt12 flex-between" style="align-items:center">
          <div class="flex gap8">
            <button type="button" class="composer-act-btn btn-ghost" onclick="$id('profile-post-input').value += ' 🔥'" aria-label="Add fire">${ico('local_fire_department')}</button>
            <button type="button" class="composer-act-btn btn-ghost" onclick="$id('profile-post-input').value += ' 🚀'" aria-label="Add rocket">${ico('rocket_launch')}</button>
            <button type="button" class="composer-act-btn btn-ghost" onclick="$id('profile-post-input').value += ' ✨'" aria-label="Add sparkles">${ico('auto_awesome')}</button>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="publishProfilePost()">Post</button>
        </div>
      </div>`;
  }

  function listHTML() {
    const list = myPosts();
    return `<div id="prof-posts-list" class="pg-list">${list.length && typeof renderPostCard === 'function'
      ? list.map(p => renderPostCard(p)).join('')
      : '<p class="pg-muted">Nothing posted yet.</p>'}</div>`;
  }

  /* ── Shorty ──────────────────────────────────────────────────────── */
  function shortyHTML(list, loading) {
    if (loading) return `<div class="pg-grid pg-tall">${'<span class="pg-tile pg-skel"></span>'.repeat(3)}</div>`;
    if (!list.length) return emptyHTML('slow_motion_video', 'Create your first Shorty', 'Short videos you record or import show up here. They are stored on this device.', 'shorty-new', 'Create a Shorty');
    return `<div class="pg-grid pg-tall">${list.map((s, i) => `
      <button type="button" class="pg-tile pg-reel" data-pg="reel" data-i="${i}" aria-label="Play ${esc(s.title || s.caption || 'your Shorty')}">
        ${s.coverUrl ? `<img src="${esc(s.coverUrl)}" alt="" loading="lazy">` : s.src ? `<video src="${esc(s.src)}" muted playsinline preload="metadata"></video>` : ''}
        <span class="pg-tile-o on">${ico('play_arrow')}${compact(s.views)}</span>
      </button>`).join('')}</div>`;
  }

  async function fillShorty() {
    let list = [];
    try { list = window.SH && SH.mine ? await SH.mine() : []; } catch (e) { list = []; }
    if (V.tab !== 'shorty' || V.section) return;
    shorts = list;
    const body = $('prof-tab-dynamic-content');
    if (body) body.innerHTML = shortyHTML(list);
  }

  /* ── Crypto ──────────────────────────────────────────────────────── */
  /* One source, so the number on this card matches the Wallet tab and the
     Assets page. It used to count five named coins at prices from a
     static mock table, which left the rest of the wallet out and drifted
     from every other total on screen. */
  function walletTotal() {
    if (typeof MNY !== 'undefined') return MNY.total('funding').value;
    const b = (typeof DATA !== 'undefined' && DATA.wallet && DATA.wallet.balances) || {};
    return Object.keys(b).reduce((t, c) => t + (Number(b[c]) || 0) * (c === 'USDT' ? 1 : 0), 0);
  }

  function paintCrypto() {
    const set = (id, v) => { const el = $(id); if (el && el.textContent !== v) el.textContent = v; };
    set('pg-cx-equity', window.TR && TR.equity ? money(TR.equity()) : '—');
    set('pg-cx-wallet', money(walletTotal()));
    set('pg-cx-staked', window.EN && EN.stakedValue ? money(EN.stakedValue()) : '—');
  }

  const cryptoHTML = () => `<div class="pg-crypto">${profileSectionHTML('wallet')}<div id="pg-nfts" class="pg-anchor"></div>${profileSectionHTML('nfts')}</div>`;

  function pay(fn) {
    if (window.PAY && typeof PAY[fn] === 'function') PAY[fn]();
    else show('crypto');
  }

  /* ── Library, sections, empty states ─────────────────────────────── */
  const libraryHTML = () => `<div class="pg-lib">${LIBRARY.map(([k, l, i]) =>
    `<button type="button" class="pg-lib-i" data-pg="${k}">${ico(i)}<span>${l}</span></button>`).join('')}</div>`;

  const headHTML = title => `<div class="pg-sec-h"><button type="button" class="pg-ib" data-pg="back" aria-label="Back">${ico('arrow_back')}</button><h2>${esc(title)}</h2></div>`;

  const emptyHTML = (icon, title, text, action, label) => `
    <div class="pg-empty">
      <span class="pg-empty-ic">${ico(icon)}</span>
      <b>${esc(title)}</b>
      <p>${esc(text)}</p>
      ${action ? `<button type="button" data-pg="${action}">${esc(label)}</button>` : ''}
    </div>`;

  /* ── Showing a tab or a section ──────────────────────────────────── */
  function show(name, focus) {
    const body = $('prof-tab-dynamic-content');
    if (!body) return;
    if (name === 'wallet') name = 'crypto';
    if (name === 'nfts' || name === 'swap') { focus = focus || name; name = 'crypto'; }
    if (name === 'reels') name = 'shorty';
    const isTab = TABS.some(t => t[0] === name);
    if (isTab) { V.tab = name; V.section = null; } else V.section = name;
    paintTabs();

    let html = '';
    if (name === 'posts') html = postsGridHTML();
    else if (name === 'shorty') html = shortyHTML(shorts, true);
    else if (name === 'crypto') html = cryptoHTML();
    else if (name === 'library') html = libraryHTML();
    else if (name === 'list') html = headHTML('Posts') + listHTML();
    else if (name === 'compose') html = headHTML('New post') + composerHTML() + listHTML();
    else html = headHTML(TITLES[name] || name) + profileSectionHTML(name);
    body.innerHTML = html;
    if (typeof IX !== 'undefined' && IX.bindAllEmojis) IX.bindAllEmojis(body);
    if (name === 'shorty') fillShorty();
    paint();

    if (focus === 'swap') reveal(document.getElementById('wv-swap-amt'));
    else if (focus === 'nfts') reveal($('pg-nfts'));
    else if (typeof focus === 'number') reveal(($('prof-posts-list') || body).children[focus]);
    else if (!isTab) reveal($('pg-tabs'));
    if (name === 'compose') { const inp = $('profile-post-input'); if (inp) inp.focus({ preventScroll: true }); }
  }

  // Brings an element to the top of the page, just under the sticky tabs.
  function reveal(el) {
    const pane = $('pane-profile');
    const tabs = $('pg-tabs');
    if (!el || !pane) return;
    const card = el.closest('.card') || el;
    requestAnimationFrame(() => {
      const offset = card === tabs ? 0 : (tabs ? tabs.offsetHeight + 8 : 0);
      const top = card.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - offset;
      if (card === tabs && tabs.getBoundingClientRect().top <= pane.getBoundingClientRect().top + 1) return;
      pane.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  }

  function paintTabs() {
    const bar = $('pg-tabs');
    if (!bar) return;
    /* Crypto is your holdings and Library is your saved things; neither
       is anyone else's to show. Rebuilt rather than hidden, so the row
       does not keep a gap where they were. */
    const want = mine() ? TABS : TABS.filter(([k]) => k === 'posts' || k === 'shorty');
    const forWho = mine() ? 'me' : 'other';
    if (bar.dataset.for !== forWho || bar.childElementCount !== want.length) {
      bar.dataset.for = forWho;
      bar.innerHTML = want.map(([k, l, i]) =>
        `<button type="button" class="pg-tab" role="tab" data-pg="tab:${k}" data-tab="${k}" aria-label="${l}" title="${l}">${ico(i)}<span>${l}</span></button>`).join('');
    }
    const on = V.section ? (OWNER[V.section] || '') : V.tab;
    bar.querySelectorAll('.pg-tab').forEach(b => {
      const a = b.dataset.tab === on;
      b.classList.toggle('on', a);
      b.setAttribute('aria-selected', a ? 'true' : 'false');
    });
  }

  /* Crypto actions as buttons in the crypto card. Wallet is already the
     card's Wallet box, so it isn't repeated. The circles hold highlights. */
  function paintCircles() {
    const acts = $('pg-cx-acts');
    if (acts && !acts.childElementCount) {
      acts.innerHTML = CIRCLES.filter(([k]) => k !== 'wallet').map(([k, l, i, c]) =>
        `<button type="button" class="pg-act" data-pg="${k}" style="--c:${c}">${ico(i)}<span>${l}</span></button>`).join('');
    }
    if (window.HL && HL.paint) HL.paint();
  }

  /* ── The header: name, handle, counts ────────────────────────────── */
  function paint() {
    if (!$('pane-profile') || !document.querySelector('#pane-profile .pg')) return;
    const u = user();
    const g = guest();
    const handle = g ? '@guest' : (u.handle || '@user');
    const top = $('pg-top-handle');
    if (top) top.textContent = handle.replace(/^@/, '');
    const ph = $('profile-handle');
    if (ph && g) ph.textContent = '@guest';
    const posts = $('profile-stat-posts');
    if (posts) posts.textContent = compact(myPosts().length);
    const loc = $('profile-location');
    const wrap = $('profile-location-wrap');
    if (wrap) wrap.style.display = !loc || /not set/i.test(loc.textContent) || !loc.textContent.trim() ? 'none' : '';
    paintCircles();
    paintTabs();
    paintCrypto();
  }

  /* ── Sheets: Create and the menu ─────────────────────────────────── */
  let sheetFrom = null;
  function sheet(label, rows) {
    closeSheet();
    sheetFrom = document.activeElement;
    const el = document.createElement('div');
    el.id = 'pg-sheet';
    el.className = 'mob-scrim';
    el.innerHTML = `<div class="mob-sheet pg-sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">
        <span class="mob-grab" aria-hidden="true"></span>
        ${rows.map(([k, l, i, danger]) => `<button type="button" class="pg-row${danger ? ' danger' : ''}" data-pg="${k}">${ico(i)}<span>${esc(l)}</span>${ico('chevron_right', 'pg-row-go')}</button>`).join('')}
      </div>`;
    el.addEventListener('click', e => { if (e.target === el) closeSheet(); });
    document.body.appendChild(el);
    document.addEventListener('keydown', sheetKey, true);
    requestAnimationFrame(() => { el.classList.add('open'); const f = el.querySelector('.pg-row'); if (f) f.focus({ preventScroll: true }); });
  }
  function closeSheet() {
    const el = $('pg-sheet');
    if (!el) return;
    el.remove();
    document.removeEventListener('keydown', sheetKey, true);
    if (sheetFrom && document.contains(sheetFrom)) { try { sheetFrom.focus({ preventScroll: true }); } catch (e) {} }
    sheetFrom = null;
  }
  function sheetKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
    if (e.key !== 'Tab') return;
    const f = [...document.querySelectorAll('#pg-sheet .pg-row')];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }

  const menu = () => sheet('Menu', [
    ...MENU,
    ['app-settings', 'Settings and privacy', 'settings'],
    guest() ? ['signin', 'Sign in', 'login'] : ['signout', 'Sign out', 'logout', true]
  ]);
  const create = () => sheet('Create', [['compose', 'Post', 'edit_square'], ['shorty-new', 'Shorty', 'slow_motion_video']]);

  /* ── Share and discover ──────────────────────────────────────────── */
  async function share() {
    const u = user();
    if (guest()) { toast('Sign in to share your profile.'); if (typeof openAuthModal === 'function') openAuthModal(); return; }
    const h = String(u.handle || '').replace(/^@/, '');
    const url = `https://trending.app/${encodeURIComponent(h)}`;
    const name = `${u.fname || ''} ${u.lname || ''}`.trim() || '@' + h;
    if (navigator.share) {
      try { await navigator.share({ title: `${name} on Trending`, text: `Follow @${h} on Trending`, url }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); toast('Profile link copied'); }
    catch (e) { toast(url); }
  }

  function people() {
    if (window.MOB && MOB.openSearch) MOB.openSearch();
    else if (window.DX && DX.open) DX.open();
    if (window.DX && DX.chip) DX.chip('creators');
  }

  /* ── One click handler for the page and its sheets ───────────────── */
  function act(k, el, e) {
    if (el.closest('#pg-sheet')) closeSheet();
    if (k.indexOf('tab:') === 0) {
      const t = k.slice(4);
      if (V.tab === t && !V.section && t !== 'posts') return;
      show(t);
      if (el.classList.contains('pg-stat')) reveal($('pg-tabs'));
      return;
    }
    switch (k) {
      case 'back': show(V.tab); reveal($('pg-tabs')); return;
      /* Someone else's page. Message, Pay and Follow hand off to the
         same functions search uses, so one person behaves one way
         wherever you reached them from. */
      case 'leave': back(); return;
      case 'follow': if (window.SR && SR.follow) SR.follow(user().name); else toast('Following ' + user().name); return;
      case 'message': if (window.SR && SR.message) SR.message(user().name); else toast('Messages are still loading…'); return;
      case 'payto': if (window.SR && SR.payTo) SR.payTo(user().handle); else toast('Payments are still loading…'); return;
      case 'post': show('list', +el.dataset.i); return;
      case 'reel': if (window.SH && SH.openAt) SH.openAt(+el.dataset.i, shorts); return;
      case 'compose': show('compose'); return;
      case 'shorty-new': if (window.SH && SH.openCreate) SH.openCreate(); else if (typeof navigateTo === 'function') navigateTo('reels'); return;
      case 'create': create(); return;
      case 'menu': menu(); return;
      case 'share': share(); return;
      case 'people': people(); return;
      case 'link': {
        const a = el.getAttribute('href') || '#';
        if (a !== '#') return;                     // a real website opens normally
        e.preventDefault();
        if (guest() || /add a link/i.test(el.textContent)) { if (typeof toggleEditForm === 'function') toggleEditForm(); }
        else share();
        return;
      }
      case 'wallet': show('crypto'); reveal($('pg-tabs')); return;
      case 'swap': case 'nfts': show('crypto', k); return;
      case 'send': pay('openHub'); return;
      case 'receive': pay('openMyQR'); return;
      case 'scan': pay('openScan'); return;
      case 'portfolio': case 'trade': case 'earn': case 'p2p':
        if (typeof navigateTo === 'function') navigateTo(k); return;
      case 'app-settings': if (typeof navigateTo === 'function') navigateTo('settings'); return;
      case 'signout': if (typeof signOut === 'function') signOut(); return;
      case 'signin': if (typeof openAuthModal === 'function') openAuthModal(); return;
      default: show(k);
    }
  }

  let ready = false;
  function init() {
    if (ready) return;
    ready = true;
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-pg]');
      if (!el || !(el.closest('#pane-profile') || el.closest('#pg-sheet'))) return;
      act(el.dataset.pg, el, e);
    });
    // Name, handle or photo changes (sign-in, Edit profile) repaint the header.
    if (typeof window.updateUserUI === 'function' && !window.updateUserUI.__pg) {
      const up = window.updateUserUI;
      const wrapped = function () {
        const r = up.apply(this, arguments);
        try { if ($('pane-profile')) { syncProfileIdentity(); paint(); } } catch (err) {}
        return r;
      };
      wrapped.__pg = true;
      window.updateUserUI = wrapped;
    }
    // Prices move; keep the crypto card current while the profile is open.
    setInterval(() => { if (typeof S !== 'undefined' && S.pane === 'profile' && !document.hidden) paintCrypto(); }, 10000);
  }

  return {
    init, show, paint, paintCrypto, myPosts, composerHTML, listHTML, closeSheet,
    user, subject, openUser, openMe, claim, back,
    get state() { return { tab: V.tab, section: V.section }; }
  };
})();

window.PG = PG;

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
publish('pages/profile.js', {
  renderProfile: () => renderProfile,
  syncProfileIdentity: () => syncProfileIdentity,
  toggleEditForm: () => toggleEditForm,
  saveProfileChanges: () => saveProfileChanges,
  getProfileTemplate: () => getProfileTemplate,
  switchProfileTab: () => switchProfileTab,
  profileSectionHTML: () => profileSectionHTML, PG: () => PG
});
