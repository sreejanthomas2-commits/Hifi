/* ╔══════════════════════════════════════════════════════════════════╗
   ║  RISK — does this action look like it is being done TO someone?   ║
   ║                                                                   ║
   ║  assess() scores one action from the signals that precede most    ║
   ║  account takeovers and scams, and decides allow / review / block: ║
   ║                                                                   ║
   ║    new device, then money out soon after           +40            ║
   ║    a destination never used before                 +25            ║
   ║    a large amount for this account                 +25            ║
   ║    a burst of actions in a short time              +30            ║
   ║    two-factor changed in the last day              +30            ║
   ║                                                                   ║
   ║    under 50 allow · 50 to 79 review (held, and the person told)   ║
   ║    80 and over block                                              ║
   ║                                                                   ║
   ║  Every reason is kept and returned, so a hold can always say why. ║
   ║  The velocity count is per process, like the rate limits.         ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const HOUR = 60 * 60 * 1000;
const RULES = {
  newDevice:   { points: 40, why: 'This device signed in recently and is moving money soon after.' },
  newAddress:  { points: 25, why: 'The destination has never been used from this account.' },
  largeAmount: { points: 25, why: 'The amount is large for this account.' },
  burst:       { points: 30, why: 'Many actions in a short time.' },
  recent2fa:   { points: 30, why: 'Two-factor settings changed in the last day.' }
};
const REVIEW = 50, BLOCK = 80;
const BURST = { windowMs: 10 * 60 * 1000, max: 10 };

function makeRisk(opts) {
  const now = (opts && opts.now) || Date.now;
  const recent = new Map();   // userId -> timestamps

  function burst(userId) {
    const t = now();
    const list = (recent.get(userId) || []).filter(x => x > t - BURST.windowMs);
    list.push(t);
    recent.set(userId, list);
    return list.length > BURST.max;
  }

  /* s = { userId, deviceAgeMs, newAddress, amountUsd, typicalUsd, twoFactorChangedAt } */
  function assess(s) {
    const x = s || {};
    const hits = [];
    if (Number.isFinite(x.deviceAgeMs) && x.deviceAgeMs < HOUR) hits.push('newDevice');
    if (x.newAddress) hits.push('newAddress');
    if (Number(x.amountUsd) > 0 && Number(x.amountUsd) > Math.max(1000, 5 * (Number(x.typicalUsd) || 0))) hits.push('largeAmount');
    if (x.userId && burst(x.userId)) hits.push('burst');
    if (x.twoFactorChangedAt && now() - Number(x.twoFactorChangedAt) < 24 * HOUR) hits.push('recent2fa');
    const score = hits.reduce((t, k) => t + RULES[k].points, 0);
    const decision = score >= BLOCK ? 'block' : score >= REVIEW ? 'review' : 'allow';
    return { score, decision, reasons: hits.map(k => RULES[k].why), signals: hits };
  }

  return { assess };
}

module.exports = { makeRisk, RULES, REVIEW, BLOCK, BURST, ...makeRisk() };
