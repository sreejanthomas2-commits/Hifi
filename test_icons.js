const fs = require('fs');
const code = fs.readFileSync('app.js', 'utf8');

// Extract get3DIconForEmoji function
const funcStart = code.indexOf('function get3DIconForEmoji');
let funcEnd = code.indexOf('function ', funcStart + 10);
if (funcEnd === -1) funcEnd = code.length;
const funcCode = code.substring(funcStart, funcEnd);

// Extract DATA object
const dataStart = code.indexOf('const DATA = {');
let braces = 0;
let dataEnd = dataStart;
for(let i = dataStart; i < code.length; i++) {
  if (code[i] === '{') braces++;
  if (code[i] === '}') {
    braces--;
    if (braces === 0) {
      dataEnd = i + 1;
      break;
    }
  }
}
const dataCode = code.substring(dataStart, dataEnd);

// Create a safe sandbox script
const script = dataCode.replace('const DATA', 'global.DATA') + '\n\n' + 
               funcCode.replace('function get3DIconForEmoji', 'global.get3DIconForEmoji = function get3DIconForEmoji') + '\n\n' + 
`let failed = false;
global.DATA.topics.forEach(t => {
  let res = global.get3DIconForEmoji(t.emoji);
  if (!res) {
    console.log('MISSING ICON FOR EMOJI:', t.emoji, t.name);
    failed = true;
  }
});
if (!failed) console.log('All topics OK!');
`;

fs.writeFileSync('test_icons_run.js', script);
