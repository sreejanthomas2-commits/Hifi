/* Top-level keys of DATA (js/data/mockDb.js) that nothing ever reads.
   Leftovers from pages that were removed: the data outlives the page
   because nothing points at it and nothing complains. */
const fs = require('fs');
const path = require('path');

const db = fs.readFileSync('public/js/data/mockDb.js', 'utf8');
let hay = fs.readFileSync('public/index.html', 'utf8') + fs.readFileSync('public/interactions.js', 'utf8');
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js') && !p.endsWith('mockDb.js')) hay += fs.readFileSync(p, 'utf8');
  }
})('public/js');

const lines = db.split('\n');
const keys = [];
lines.forEach((l, i) => {
  const m = l.match(/^  ([A-Za-z_$][\w$]*):/);
  if (m) keys.push({ key: m[1], line: i + 1 });
});
keys.forEach((k, i) => { k.end = (i + 1 < keys.length ? keys[i + 1].line : lines.length) - 1; });

const dead = keys.filter(k => {
  const re = new RegExp('(?:DATA|D)\\s*\\.\\s*' + k.key + '\\b|\\[[\'"]' + k.key + '[\'"]\\]');
  return !re.test(hay) && !hay.includes('.' + k.key);
});

console.log(keys.length + ' top-level DATA keys, ' + dead.length + ' with no reader anywhere\n');
for (const k of dead) {
  const bytes = lines.slice(k.line - 1, k.end).join('\n').length;
  console.log('  ' + k.key.padEnd(22) + 'lines ' + String(k.line).padStart(4) + '-' + String(k.end).padEnd(5) +
    '  ' + (bytes / 1024).toFixed(1) + ' KB');
}
console.log('\ntotal dead: ' +
  (dead.reduce((a, k) => a + lines.slice(k.line - 1, k.end).join('\n').length, 0) / 1024).toFixed(1) + ' KB');
