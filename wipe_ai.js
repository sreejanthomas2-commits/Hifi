const fs = require('fs');

function wipe(filePath) {
  if (!fs.existsSync(filePath)) return;
  let code = fs.readFileSync(filePath, 'utf8');

  // General text replacements
  code = code.replace(/ALINA/g, 'Buddy');
  code = code.replace(/alina/g, 'buddy');
  code = code.replace(/JARVIS/g, 'Pet');
  code = code.replace(/Mentor AI/g, 'Study Buddy');
  code = code.replace(/AI Studio/g, 'Creator Studio');
  
  // Custom tweaks for messages.js (if any ALINA stuff was there)
  if (filePath.includes('messages.js')) {
    code = code.replace(/Artificial Learning & Intelligent Network Assistant/g, 'Virtual Pet Companion');
    code = code.replace(/female AI companion/g, 'friendly virtual dog');
    code = code.replace(/AI Voice/g, 'Pet Sounds');
  }

  if (filePath.includes('learn.js')) {
    code = code.replace(/AgriHub AI Assistant/g, 'AgriHub Study Buddy');
    code = code.replace(/AgriHub AI/g, 'AgriHub Study Buddy');
  }
  
  fs.writeFileSync(filePath, code);
  console.log('Wiped AI from ' + filePath);
}

wipe('js/pages/messages.js');
wipe('js/pages/learn.js');
wipe('js/pages/explore.js');
wipe('js/pages/creator.js');
wipe('js/app.js');
