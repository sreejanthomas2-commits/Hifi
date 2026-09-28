/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SECURITY EVENTS — what probing looks like, on the server log     ║
   ║                                                                   ║
   ║  One JSON line per event, for the things that matter when someone ║
   ║  is trying the doors: a refused session, a refused admin, a rate  ║
   ║  limit hit, a bad signer token or webhook signature, an admin     ║
   ║  action. Hosting log search and alerts can match on "sec".        ║
   ║                                                                   ║
   ║  No personal data. A user id becomes a short keyed hash - the     ║
   ║  same person gives the same tag, so a run can be followed, but    ║
   ║  the tag is not their id - and an address is cut to its network   ║
   ║  (/24, /48). Never a token, a body, a query string or an email.   ║
   ║  Set LOG_HASH_KEY so tags stay the same across servers; without   ║
   ║  it each process picks its own.                                   ║
   ║                                                                   ║
   ║  The same event from the same place is written once a minute at   ║
   ║  most, with a count of the repeats, so a flood cannot flood the   ║
   ║  log.                                                             ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');

const KEY = process.env.LOG_HASH_KEY || crypto.randomBytes(16).toString('hex');
const WINDOW_MS = 60 * 1000;
const EXTRA = ['reason', 'scope', 'status', 'action', 'subject'];

const tag = id => crypto.createHmac('sha256', KEY).update(String(id)).digest('hex').slice(0, 12);

function network(ip) {
  const a = String(ip || '').replace(/^::ffff:/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(a)) return a.split('.').slice(0, 3).join('.') + '.0/24';
  if (a.includes(':')) return a.split(':').slice(0, 3).join(':') + '::/48';
  return null;
}

let sink = line => console.warn(line);
const recent = new Map();                 // event + source -> { at, repeats }

function seclog(event, req, extra) {
  const user = req && req.user && req.user.id ? tag(req.user.id) : null;
  const net = network(req && req.ip);
  const e = extra || {};
  const key = [event, user || net || '?', e.scope || '', e.reason || ''].join(' ');
  const now = Date.now();
  const seen = recent.get(key);
  if (seen && now - seen.at < WINDOW_MS) { seen.repeats++; return; }
  if (recent.size > 5000) recent.clear();
  recent.set(key, { at: now, repeats: 0 });

  const line = { sec: event, at: new Date(now).toISOString() };
  if (user) line.user = user;
  if (net) line.net = net;
  if (req && req.method) line.method = req.method;
  if (req && typeof req.path === 'string') line.path = String((req.baseUrl || '') + req.path).slice(0, 120);
  EXTRA.forEach(k => {
    const v = e[k];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') line[k] = String(v).slice(0, 80);
  });
  if (seen && seen.repeats) line.repeatsBefore = seen.repeats;
  sink(JSON.stringify(line));
}

/* For tests: collect lines instead of printing them. */
function _setSink(fn) { sink = fn; recent.clear(); }

module.exports = { seclog, _setSink, _tag: tag, _network: network };
