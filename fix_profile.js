const fs = require('fs');
let c = fs.readFileSync('js/pages/profile.js', 'utf8');

c = c.replace(/switchProfileTab\('reels'\)/g, "switchProfileTab('shorty')");
c = c.replace(/tab === 'reels'/g, "tab === 'shorty'");
c = c.replace(/Creator Reels/g, "Shorty Hub");
c = c.replace(/openReelsPopup/g, "openShortyPopup");
c = c.replace(/posts, reels, and articles/g, "posts, shortys, and articles");
c = c.replace(/Swipe Reel/g, "Play Shorty");

fs.writeFileSync('js/pages/profile.js', c);
console.log('profile.js updated successfully!');
