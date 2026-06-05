const fs = require('fs');
let c = fs.readFileSync('js/pages/feeds.js', 'utf8');

c = c.replace(
  /<button class="icon-btn" style="background:rgba\(0,0,0,0\.5\); color:#fff; backdrop-filter:blur\(10px\); width:44px; height:44px; border-radius:50%; border:1px solid rgba\(255,255,255,0\.2\);">\s*<span class="material-symbols-rounded" style="font-size:22px;">mood<\/span>\s*<\/button>/g,
  `<button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Opening Stickers... 😊')">
        <span class="material-symbols-rounded" style="font-size:22px;">mood</span>
      </button>`
);

c = c.replace(
  /<button class="icon-btn" style="background:rgba\(0,0,0,0\.5\); color:#fff; backdrop-filter:blur\(10px\); width:44px; height:44px; border-radius:50%; border:1px solid rgba\(255,255,255,0\.2\);">\s*<span class="material-symbols-rounded" style="font-size:22px;">music_note<\/span>\s*<\/button>/g,
  `<button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Opening Music Library... 🎵')">
        <span class="material-symbols-rounded" style="font-size:22px;">music_note</span>
      </button>`
);

c = c.replace(
  /<button class="icon-btn" style="background:rgba\(0,0,0,0\.5\); color:#fff; backdrop-filter:blur\(10px\); width:44px; height:44px; border-radius:50%; border:1px solid rgba\(255,255,255,0\.2\);">\s*<span class="material-symbols-rounded" style="font-size:22px;">auto_awesome<\/span>\s*<\/button>/g,
  `<button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Applying AI Filters... ✨')">
        <span class="material-symbols-rounded" style="font-size:22px;">auto_awesome</span>
      </button>`
);

c = c.replace(
  /<button class="icon-btn" style="background:rgba\(0,0,0,0\.5\); color:#fff; backdrop-filter:blur\(10px\); width:44px; height:44px; border-radius:50%; border:1px solid rgba\(255,255,255,0\.2\);">\s*<span class="material-symbols-rounded" style="font-size:22px;">alternate_email<\/span>\s*<\/button>/g,
  `<button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Tagging Creators... @')">
        <span class="material-symbols-rounded" style="font-size:22px;">alternate_email</span>
      </button>`
);

c = c.replace(
  /<button class="icon-btn" style="background:rgba\(0,0,0,0\.5\); color:#fff; backdrop-filter:blur\(10px\); width:44px; height:44px; border-radius:50%; border:1px solid rgba\(255,255,255,0\.2\);">\s*<span class="material-symbols-rounded" style="font-size:22px;">draw<\/span>\s*<\/button>/g,
  `<button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Drawing Mode Enabled 🖌️')">
        <span class="material-symbols-rounded" style="font-size:22px;">draw</span>
      </button>`
);

c = c.replace(
  /<button class="icon-btn" style="background:rgba\(0,0,0,0\.5\); color:#fff; backdrop-filter:blur\(10px\); width:44px; height:44px; border-radius:50%; border:1px solid rgba\(255,255,255,0\.2\);">\s*<span class="material-symbols-rounded" style="font-size:22px;">download<\/span>\s*<\/button>/g,
  `<button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Draft Saved to Device! 💾')">
        <span class="material-symbols-rounded" style="font-size:22px;">download</span>
      </button>`
);

fs.writeFileSync('js/pages/feeds.js', c);
console.log('Toolbar handlers added successfully!');
