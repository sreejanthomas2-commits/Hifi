/* ╔══════════════════════════════════════════════════════════════════╗
   ║  RATE LIMITS — per person, per kind of action                     ║
   ║                                                                   ║
   ║  A sliding window: at most `max` requests in any `windowMs`,      ║
   ║  counted per signed-in person (or per address when signed out).   ║
   ║  Over the limit is a 429 that says nothing ran and when to try    ║
   ║  again - it never half-runs anything.                             ║
   ║                                                                   ║
   ║  The counts live in this process's memory. That is right for one  ║
   ║  server and wrong for several, where each would count on its own; ║
   ║  a shared store (Redis) comes with the hosting decision, and this ║
   ║  file is the only thing that changes.                             ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const { send } = require('../lib/problem');
const { seclog } = require('../lib/seclog');

function limit({ scope, windowMs, max, now }) {
  const clock = now || Date.now;
  const hits = new Map();                // who -> [timestamps], oldest first
  let sweptAt = 0;

  function sweep(t) {
    if (t - sweptAt < windowMs) return;
    sweptAt = t;
    for (const [who, list] of hits) {
      while (list.length && list[0] <= t - windowMs) list.shift();
      if (!list.length) hits.delete(who);
    }
  }

  return function rateLimit(req, res, next) {
    const t = clock();
    sweep(t);
    const who = scope + ':' + (req.user && req.user.id ? 'u:' + req.user.id : 'ip:' + (req.ip || 'unknown'));
    const list = hits.get(who) || [];
    while (list.length && list[0] <= t - windowMs) list.shift();
    if (list.length >= max) {
      const retryAfter = Math.max(1, Math.ceil((list[0] + windowMs - t) / 1000));
      hits.set(who, list);
      seclog('rate_limited', req, { scope });
      return send(res, 'rate_limited', { retryAfter });
    }
    list.push(t);
    hits.set(who, list);
    next();
  };
}

/* A coarse ceiling per address over the whole API, in front of every
   route. It blunts a flood from one place and is nowhere near normal
   use; the per-action limits above stay the real ones. Fixed windows and
   one counter per address, so a flood costs a number, not a list. Needs
   the client's real address - see "trust proxy" in server.js. */
function perIp({ scope, windowMs, max, now }) {
  const clock = now || Date.now;
  const counts = new Map();              // address -> { start, n }
  let sweptAt = 0;
  return function ipLimit(req, res, next) {
    const t = clock();
    if (t - sweptAt >= windowMs) {
      sweptAt = t;
      for (const [ip, c] of counts) if (t - c.start >= windowMs) counts.delete(ip);
    }
    const ip = req.ip || 'unknown';
    let c = counts.get(ip);
    if (!c || t - c.start >= windowMs) {
      if (counts.size >= 100000) counts.clear();     // a memory ceiling, not a policy
      c = { start: t, n: 0 };
      counts.set(ip, c);
    }
    c.n++;
    if (c.n > max) {
      const retryAfter = Math.max(1, Math.ceil((c.start + windowMs - t) / 1000));
      seclog('rate_limited', req, { scope });
      return send(res, 'rate_limited', { retryAfter });
    }
    next();
  };
}

module.exports = { limit, perIp };
