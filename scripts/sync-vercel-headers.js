/* ╔══════════════════════════════════════════════════════════════════╗
   ║  node scripts/sync-vercel-headers.js [--enforce]                  ║
   ║                                                                   ║
   ║  Writes vercel.json's "headers" from middleware/security.js, so   ║
   ║  the page Vercel serves carries exactly what the API does. Run it ║
   ║  after changing any header there; scripts/test-security.js fails  ║
   ║  until you do.                                                    ║
   ║                                                                   ║
   ║  --enforce turns the Content-Security-Policy on for the page      ║
   ║  (set CSP_ENFORCE=true on the server at the same time). Without   ║
   ║  it the policy only reports, which is today's setting.            ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const fs = require('fs');
const path = require('path');
const { SOURCE, expected } = require('./lib/vercel-headers');

const file = path.join(__dirname, '..', 'vercel.json');
const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
const enforce = process.argv.includes('--enforce');

cfg.headers = [{ source: SOURCE, headers: expected({ enforce }) }];
fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
console.log(`vercel.json: ${cfg.headers[0].headers.length} headers on ${SOURCE}, CSP ${enforce ? 'enforced' : 'report-only'}`);
