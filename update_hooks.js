const fs = require('fs');

function injectHook(filePath, functionSignature, hookCode) {
  let content = fs.readFileSync(filePath, 'utf8');
  let idx = content.indexOf(functionSignature);
  if (idx > -1) {
    let openBraceIdx = content.indexOf('{', idx);
    content = content.substring(0, openBraceIdx + 1) + '\n  if (typeof buddyGainXP === "function") { ' + hookCode + ' }' + content.substring(openBraceIdx + 1);
    fs.writeFileSync(filePath, content);
    console.log('Hooked ' + functionSignature + ' in ' + filePath);
  }
}

injectHook('js/pages/feeds.js', 'function likePost(e, id)', 'buddyGainXP(5, \"Liked a post\");');
injectHook('js/pages/messages.js', 'function submitComment(postId)', 'buddyGainXP(15, \"Commented\");');
injectHook('app.js', 'function submitComment(postId)', 'buddyGainXP(15, \"Commented\");');
injectHook('app.js', 'function toggleReelLike(idx, event, btn)', 'buddyGainXP(5, \"Liked Reel\");');
