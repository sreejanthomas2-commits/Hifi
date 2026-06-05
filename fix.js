const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

const correctSidebar = `<nav class="sidebar-nav">
      <a class="nav-item active" data-pane="feeds" href="#">
        <span class="nav-icon material-symbols-rounded emoji-3d" style="font-size:22px">home</span>
        <span class="nav-label">Home</span>
      </a>
      <a class="nav-item" data-pane="explore" href="#">
        <span class="nav-icon material-symbols-rounded emoji-3d" style="font-size:22px">search</span>
        <span class="nav-label">Explore</span>
      </a>
      <a class="nav-item" data-pane="reels" href="#">
        <span class="nav-icon material-symbols-rounded emoji-3d" style="font-size:22px; color:var(--orange)">electric_bolt</span>
        <span class="nav-label">Shorty</span>
      </a>
      <a class="nav-item" data-pane="fashionverse" href="#">
        <span class="nav-icon material-symbols-rounded emoji-3d" style="font-size:22px; color:var(--pink)">checkroom</span>
        <span class="nav-label">FashionVerse</span>
      </a>
      <a class="nav-item" data-pane="fitness" href="#">
        <span class="nav-icon material-symbols-rounded emoji-3d" style="font-size:22px">fitness_center</span>
        <span class="nav-label">Fitness</span>
      </a>
      <a class="nav-item" data-pane="learn" href="#">
        <span class="nav-icon material-symbols-rounded emoji-3d" style="font-size:22px; color:#4CAF50">grass</span>
        <span class="nav-label">Global Agri Hub</span>
      </a>
      <a class="nav-item" data-pane="fashionhub" href="#">
        <span class="nav-icon material-symbols-rounded emoji-3d" style="font-size:22px; color:var(--pink)">checkroom</span>
        <span class="nav-label">Global Fashion Hub</span>
      </a>
      <a class="nav-item" data-pane="creator" href="#">
        <span class="nav-icon material-symbols-rounded emoji-3d" style="font-size:22px">auto_awesome</span>
        <span class="nav-label">Creator Studio</span>
      </a>
      <a class="nav-item" data-pane="messages" href="#">
        <span class="nav-icon material-symbols-rounded emoji-3d" style="font-size:22px">chat</span>
        <span class="nav-label">Messages</span>
        <span class="nav-badge" id="msg-badge">3</span>
      </a>
      <a class="nav-item" data-pane="community" href="#">
        <span class="nav-icon material-symbols-rounded emoji-3d" style="font-size:22px">groups</span>
        <span class="nav-label">Community</span>
      </a>
      <a class="nav-item" data-pane="profile" href="#">
        <span class="nav-icon material-symbols-rounded emoji-3d" style="font-size:22px">person</span>
        <span class="nav-label">Profile</span>
      </a>
      <a class="nav-item" data-pane="settings" href="#">
        <span class="nav-icon material-symbols-rounded emoji-3d" style="font-size:22px">settings</span>
        <span class="nav-label">Settings</span>
      </a>
    </nav>`;

c = c.replace(/<nav class="sidebar-nav">[\s\S]*?<\/nav>/, correctSidebar);
fs.writeFileSync('index.html', c);
console.log('Fixed index.html sidebar!');
