/* Drop CSS rules that can never match anything.

   A selector is dead when ANY class in it never appears in the JS or the
   HTML: .ds-btn.active cannot match if nothing is ever given ds-btn,
   whatever `active` does elsewhere. A selector list loses only its dead
   members; the rule goes when they are all dead. @media blocks left
   empty go with them.

   Deliberately conservative: a class counts as alive if its name turns
   up as a plain substring anywhere, which covers class="a b", `${x}-row`
   and classList.add('x'). Run with --write to apply. */
const fs = require('fs');
const path = require('path');

const CSS = 'public/css/index.css';
const css = fs.readFileSync(CSS, 'utf8');
let hay = fs.readFileSync('public/index.html', 'utf8') + fs.readFileSync('public/interactions.js', 'utf8');
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js')) hay += fs.readFileSync(p, 'utf8');
  }
})('public/js');

const aliveCache = new Map();
const alive = t => {
  if (!aliveCache.has(t)) aliveCache.set(t, hay.includes(t));
  return aliveCache.get(t);
};
const selDead = sel => {
  const cls = [...sel.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map(m => m[1]);
  return cls.length > 0 && cls.some(c => !alive(c));
};

/* Split a block into its rules, keeping whatever is not a style rule. */
function prune(block, depth) {
  let out = '', i = 0, start = 0;
  while (i < block.length) {
    const c = block[i];
    if (c === '/' && block[i + 1] === '*') { const e = block.indexOf('*/', i); i = (e === -1 ? block.length : e + 2); continue; }
    if (c === '"' || c === "'") { const q = c; i++; while (i < block.length && block[i] !== q) { if (block[i] === '\\') i++; i++; } i++; continue; }
    if (c === '{') {
      const head = block.slice(start, i);
      let d = 1, j = i + 1;
      while (j < block.length && d > 0) {
        if (block[j] === '/' && block[j + 1] === '*') { const e = block.indexOf('*/', j); j = (e === -1 ? block.length : e + 2); continue; }
        if (block[j] === '"' || block[j] === "'") { const q = block[j]; j++; while (j < block.length && block[j] !== q) { if (block[j] === '\\') j++; j++; } j++; continue; }
        if (block[j] === '{') d++;
        else if (block[j] === '}') d--;
        j++;
      }
      const inner = block.slice(i + 1, j - 1);
      const sel = head.trim();
      if (/^@(media|supports|container|layer)/i.test(sel)) {
        const kept = prune(inner, depth + 1);
        if (kept.trim()) out += head + '{' + kept + '}';
        else dropped.media++;
      } else if (/^@/.test(sel)) {
        out += head + '{' + inner + '}';                       // @keyframes, @font-face: leave alone
      } else {
        const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
        const live = parts.filter(s => !selDead(s));
        if (live.length === parts.length) out += head + '{' + inner + '}';
        else if (live.length === 0) { dropped.rules++; dropped.bytes += (j - start); }
        else { out += head.replace(sel, live.join(', ')) + '{' + inner + '}'; dropped.trimmed++; }
      }
      i = j; start = j; continue;
    }
    i++;
  }
  return out + block.slice(start);
}

const dropped = { rules: 0, trimmed: 0, media: 0, bytes: 0 };
const result = prune(css, 0).replace(/\n{3,}/g, '\n\n');
console.log('rules dropped   : ' + dropped.rules);
console.log('lists trimmed   : ' + dropped.trimmed);
console.log('empty @media    : ' + dropped.media);
console.log('size            : ' + (css.length / 1024).toFixed(0) + ' KB -> ' + (result.length / 1024).toFixed(0) + ' KB  (' +
  (100 - result.length / css.length * 100).toFixed(1) + '% smaller)');

if (process.argv.includes('--write')) {
  fs.writeFileSync(CSS, result);
  console.log('\nwritten.');
} else {
  console.log('\ndry run - pass --write to apply');
}
