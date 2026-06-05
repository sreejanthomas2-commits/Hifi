const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const target = `<!-- ══════════════════════════════════════════════════════════ -->
<!-- ALINA JARVIS — DYNAMIC ISLAND AI ASSISTANT               -->
<!-- ══════════════════════════════════════════════════════════ -->


  <div class="card" style="width:100%; max-width:850px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; border:1px solid var(--border); box-shadow:var(--sh3); border-radius:var(--r3)">`;

const replacement = `<!-- MOBILE NAV -->
<nav class="mobile-nav">
  <div class="mobile-nav-items">
    <button class="m-nav-btn" data-pane="feeds">
      <span class="material-symbols-rounded emoji-3d" style="font-size:22px">home</span>
      <span>Home</span>
    </button>
    <button class="m-nav-btn" data-pane="explore">
      <span class="material-symbols-rounded emoji-3d" style="font-size:22px">search</span>
      <span>Explore</span>
    </button>
    <button class="m-nav-btn" data-pane="learn">
      <span class="material-symbols-rounded emoji-3d" style="font-size:22px; color:#4CAF50; margin-bottom:2px">grass</span>
      <span>Global Agri Hub</span>
    </button>
    <button class="m-nav-btn" data-pane="creator">
      <span class="material-symbols-rounded emoji-3d" style="font-size:22px">auto_awesome</span>
      <span>Create</span>
    </button>
    <button class="m-nav-btn" data-pane="fashionhub">
      <span class="material-symbols-rounded emoji-3d" style="font-size:22px; color:var(--pink)">checkroom</span>
      <span>Fashion</span>
    </button>
    <button class="m-nav-btn" data-pane="messages">
      <span class="material-symbols-rounded emoji-3d" style="font-size:22px">chat</span>
      <span>Messages</span>
    </button>
    <button class="m-nav-btn" data-pane="community">
      <span class="material-symbols-rounded emoji-3d" style="font-size:22px">groups</span>
      <span>Community</span>
    </button>
    <button class="m-nav-btn" data-pane="profile">
      <span class="material-symbols-rounded emoji-3d" style="font-size:22px">person</span>
      <span>Profile</span>
    </button>
    <button class="m-nav-btn" data-pane="settings">
      <span class="material-symbols-rounded emoji-3d" style="font-size:22px">settings</span>
      <span>Settings</span>
    </button>
  </div>
</nav>

<!-- COURSE DETAIL MODAL -->
<div id="course-detail-modal" class="hidden" style="position:fixed; inset:0; background:rgba(4,4,8,0.96); backdrop-filter:blur(20px); z-index:99999; display:none; place-items:center; padding:24px">
  <div class="card" style="width:100%; max-width:850px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; border:1px solid var(--border); box-shadow:var(--sh3); border-radius:var(--r3)">`;

html = html.replace(target, replacement);
fs.writeFileSync('index.html', html);
console.log('Restored!');
