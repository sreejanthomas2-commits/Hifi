const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Replace script tag
html = html.replace('<script src="js/alina-jarvis.js?v=2"></script>', '<script src="js/buddy-pet.js?v=1"></script>');
html = html.replace('<script src="js/alina-jarvis.js"></script>', '<script src="js/buddy-pet.js"></script>');

// Replace Navigation
html = html.replace(/<span class="material-symbols-rounded">neurology<\/span>[\s\n]*<span class="nav-label">ALINA AI<\/span>/g, '<span class="material-symbols-rounded">pets</span>\n        <span class="nav-label">Buddy</span>');

// Replace Dynamic Island & Panel with Buddy HUD
const islandStart = html.indexOf('<!-- Dynamic Island Pill (always visible, click to expand) -->');
const panelEnd = html.indexOf('</div><!-- /alina-panel -->') + '</div><!-- /alina-panel -->'.length;

const buddyHTML = `<!-- BUDDY PET HUD -->
<div id="buddy-hud" onclick="navigateTo('alina')" style="position:fixed; top:20px; right:20px; background:rgba(15,23,42,0.8); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.1); border-radius:30px; padding:6px 12px; z-index:9999; cursor:pointer; box-shadow:0 10px 30px rgba(0,0,0,0.5); transition:all 0.3s; display:flex; align-items:center;">
  <!-- Filled by buddy-pet.js -->
</div>
`;

if (islandStart > -1 && panelEnd > islandStart) {
  html = html.substring(0, islandStart) + buddyHTML + html.substring(panelEnd);
} else {
  console.log("Could not find island bounds");
}

fs.writeFileSync('index.html', html);
console.log('index.html updated successfully.');
