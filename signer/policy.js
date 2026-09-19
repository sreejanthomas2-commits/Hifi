/* ╔══════════════════════════════════════════════════════════════════╗
   ║  POLICY — the signer's own mind                                   ║
   ║                                                                   ║
   ║  The web tier already checked this withdrawal. That is exactly    ║
   ║  why the signer checks it again: if the web tier is compromised,  ║
   ║  its checks are the attacker's checks. Everything here is         ║
   ║  evaluated against the signer's OWN configuration, which lives    ║
   ║  on the signer's own machine and which a web-tier intruder        ║
   ║  cannot reach.                                                    ║
   ║                                                                   ║
   ║  The rule that matters most: an amount over the hot threshold is  ║
   ║  never signed automatically, whatever the queue says about it.    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  /* Per asset, in base units. Above this a human approves, in person. */
  hotLimit: {},
  /* Per asset, in base units, over a rolling 24 hours. */
  dailyLimit: {},
  /* When set, only these destinations may be paid at all. */
  allowList: [],
  /* Destinations that are never paid, whatever else says otherwise. */
  denyList: [],
  /* A withdrawal older than this is suspicious: it may have sat in a
     queue while its fee quote went stale, or it may not be ours. */
  maxAgeMinutes: 180,
  /* Refuse to sign when the queue's fee is wildly off what the chain
     says now — a sign the web tier is quoting from somewhere else. */
  maxFeeDriftPercent: 300
};

function load(file) {
  const p = file || process.env.SIGNER_POLICY || path.join(__dirname, 'policy.json');
  let user = {};
  try { user = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) {
    if (e.code !== 'ENOENT') throw new Error(`policy file ${p} is not valid JSON: ${e.message}`);
  }
  return { ...DEFAULTS, ...user, _file: p, _found: !!Object.keys(user).length };
}

const big = v => BigInt(String(v == null ? '0' : v));
const norm = a => String(a || '').toLowerCase();

/* Returns one of:
     { action: 'sign' }     safe to sign without a human
     { action: 'approve' }  a human must confirm, in person
     { action: 'refuse' }   do not sign, and say why loudly            */
function decide(w, ctx) {
  const P = (ctx && ctx.policy) || load();
  const reasons = [];

  if (P.denyList.some(a => norm(a) === norm(w.to))) {
    return { action: 'refuse', why: 'the destination is on the signer\'s deny list' };
  }
  if (P.allowList.length && !P.allowList.some(a => norm(a) === norm(w.to))) {
    return { action: 'refuse', why: 'the destination is not on the signer\'s allow list' };
  }

  const age = (Date.now() - new Date(w.createdAt).getTime()) / 60000;
  if (age > P.maxAgeMinutes) {
    return { action: 'refuse', why: `this request is ${Math.round(age)} minutes old, past the ${P.maxAgeMinutes} minute limit` };
  }
  if (age < 0) return { action: 'refuse', why: 'this request is dated in the future' };

  const amount = big(w.amount);
  if (amount <= 0n) return { action: 'refuse', why: 'the amount is not positive' };

  /* The chain's current fee against the one the queue carries. A large
     gap means the two are not looking at the same network. */
  if (ctx && ctx.chainFee != null && big(w.fee) > 0n) {
    const quoted = big(w.fee), now = big(ctx.chainFee);
    const bigger = quoted > now ? quoted : now;
    const smaller = quoted > now ? now : quoted;
    if (smaller > 0n && (bigger * 100n) / smaller > BigInt(100 + P.maxFeeDriftPercent)) {
      return { action: 'refuse', why: `the queued fee (${quoted}) and the chain's fee (${now}) differ too much to trust` };
    }
  }

  const spent = big((ctx && ctx.spentToday && ctx.spentToday[w.asset]) || 0);
  const daily = P.dailyLimit[w.asset] == null ? null : big(P.dailyLimit[w.asset]);
  if (daily != null && spent + amount > daily) {
    return { action: 'refuse', why: `this would pass the signer's ${w.asset} daily limit (${daily} base units)` };
  }

  const hot = P.hotLimit[w.asset] == null ? null : big(P.hotLimit[w.asset]);
  if (hot == null) {
    reasons.push(`no hot limit is set for ${w.asset}`);
    return { action: 'approve', why: reasons.join('; ') };
  }
  if (amount > hot) {
    return { action: 'approve', why: `${amount} is over the ${w.asset} hot limit of ${hot}` };
  }
  return { action: 'sign', why: `within the ${w.asset} hot limit` };
}

module.exports = { load, decide, DEFAULTS };
