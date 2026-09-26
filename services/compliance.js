/* ╔══════════════════════════════════════════════════════════════════╗
   ║  COMPLIANCE — the question every money action asks first          ║
   ║                                                                   ║
   ║  check({ userId, action, book, country, amountUsd }) answers      ║
   ║  allowed / refused / held, with the reason in words.              ║
   ║                                                                   ║
   ║  The checks a real-money service needs are slots, each empty:     ║
   ║    kyc          who the person is, and to what level              ║
   ║    sanctions    are they, or the other side, on a list            ║
   ║    monitoring   does this pattern look like fraud or laundering   ║
   ║    travelRule   the sender/recipient data a transfer to another   ║
   ║                 provider has to carry                             ║
   ║  An empty slot refuses. So:                                       ║
   ║    sandbox  allowed - practice money has no value to launder,     ║
   ║             and nothing leaves Trending                           ║
   ║    live     refused, every time, until each slot a product needs  ║
   ║             is filled by a real provider in the same change that  ║
   ║             tests it                                              ║
   ║  There is no "skip compliance" flag, and nothing here trusts a    ║
   ║  level, a country or a flag the client sends.                     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const PROVIDERS = Object.freeze({ kyc: null, sanctions: null, monitoring: null, travelRule: null });

// What each live action would need before it could be considered.
const NEEDS = {
  transfer:   ['kyc', 'sanctions', 'monitoring'],
  withdrawal: ['kyc', 'sanctions', 'monitoring', 'travelRule'],
  trade:      ['kyc', 'sanctions', 'monitoring'],
  p2p:        ['kyc', 'sanctions', 'monitoring'],
  remittance: ['kyc', 'sanctions', 'monitoring', 'travelRule'],
  fiat:       ['kyc', 'sanctions', 'monitoring'],
  earn:       ['kyc', 'sanctions']
};

function check(req, providers) {
  const r = req || {};
  const slots = providers || PROVIDERS;
  if (r.book === 'sandbox') return { allowed: true, decision: 'allow' };
  if (r.book !== 'live') return { allowed: false, decision: 'refuse', code: 'bad_request', why: 'Unknown book.' };
  const needs = NEEDS[r.action];
  if (!needs) return { allowed: false, decision: 'refuse', code: 'compliance_unavailable', why: `No compliance rules exist for "${r.action}".` };
  const missing = needs.filter(n => !slots[n]);
  if (missing.length) {
    return { allowed: false, decision: 'refuse', code: 'compliance_unavailable', missing,
      why: `Real-money ${r.action} needs ${missing.join(', ')} checks, which aren't connected.` };
  }
  // Every slot filled: the providers decide. None exist yet, so this
  // line has never run against a real one - it is where they plug in.
  return { allowed: false, decision: 'refuse', code: 'compliance_unavailable', why: 'Provider checks are not implemented yet.' };
}

module.exports = { check, PROVIDERS, NEEDS };
