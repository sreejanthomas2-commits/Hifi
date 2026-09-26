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
      return send(res, 'rate_limited', { retryAfter });
    }
    list.push(t);
    hits.set(who, list);
    next();
  };
}

module.exports = { limit };
