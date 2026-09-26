/* ╔══════════════════════════════════════════════════════════════════╗
   ║  PRODUCTS — the switchboard                                       ║
   ║                                                                   ║
   ║  What each crypto service is, for this person, here, right now.   ║
   ║  The Crypto Hub draws what this says; it does not decide.         ║
   ║                                                                   ║
   ║    real        works for real, without Trending holding money:    ║
   ║                live prices, your own wallet's address, security   ║
   ║    sandbox     works, on practice money                           ║
   ║    coming      being built; says what it will do                  ║
   ║    unavailable says why, and what would have to exist first       ║
   ║    paused      switched off by the operator for maintenance       ║
   ║    live        real money - and nothing can be, yet               ║
   ║                                                                   ║
   ║  A regulated product becomes live only when ALL of these hold:    ║
   ║   1. the operator lists it in PRODUCTS_LIVE with the licence and  ║
   ║      the partner it runs under, and the countries and identity    ║
   ║      level it needs - in the environment, never the repository;   ║
   ║   2. a real-money backend for it exists in this code (LIVE, below ║
   ║      - empty today, so step 1 alone switches nothing on);         ║
   ║   3. the person's country is one it is licensed for, as reported  ║
   ║      by a header the operator names (COUNTRY_HEADER). A header    ║
   ║      the client could set itself is never trusted by default;     ║
   ║   4. their identity check is at the level it needs.               ║
   ║  Anything malformed in PRODUCTS_LIVE switches every product off   ║
   ║  live rather than guessing which part was meant.                  ║
   ║                                                                   ║
   ║  "Do not activate regulated services merely because the UI        ║
   ║  exists" - or merely because a line of configuration does.        ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CATALOGUE = require('../config/crypto-products.json');

const STATES = new Set(['real', 'sandbox', 'coming', 'unavailable', 'paused', 'live']);
const BASE = new Set(['real', 'sandbox', 'coming', 'unavailable']);

/* Products with a real-money backend in this codebase. None: every
   money product runs on practice balances. A backend is added here in
   the same change that builds and tests it. */
const LIVE = new Set();

const PAUSE_WHY = 'Paused for maintenance. Nothing you hold is affected: balances and open orders stay exactly as they are.';

const byId = new Map(CATALOGUE.products.map(p => [p.id, p]));

/* The catalogue is checked when the server starts, so a typo there is a
   failed boot and not a tile that silently shows the wrong state. */
function checkCatalogue(cat) {
  const problems = [];
  const groups = new Set((cat.groups || []).map(g => g.id));
  const seen = new Set();
  (cat.products || []).forEach(p => {
    if (!p.id || seen.has(p.id)) problems.push(`duplicate or missing id: ${p.id}`);
    seen.add(p.id);
    if (!BASE.has(p.base)) problems.push(`${p.id}: base state "${p.base}" is not one of ${[...BASE].join(', ')}`);
    if (!groups.has(p.group)) problems.push(`${p.id}: unknown group "${p.group}"`);
    if ((p.base === 'unavailable' || p.base === 'coming') && !p.why) problems.push(`${p.id}: says it is ${p.base} without saying why`);
    if (p.alt && !byId.has(p.alt)) problems.push(`${p.id}: alternative "${p.alt}" is not a product`);
  });
  return problems;
}

/* PRODUCTS_LIVE, e.g.
     {"spot":{"licence":"FIU-IND reg. no. ...","partner":"...","countries":["IN"],"kyc":2}}
   Returns { config, problems }. Any problem empties the config. */
function parseLive(raw) {
  if (!raw || !String(raw).trim()) return { config: {}, problems: [] };
  let obj;
  try { obj = JSON.parse(raw); } catch (e) { return { config: {}, problems: ['PRODUCTS_LIVE is not valid JSON'] }; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { config: {}, problems: ['PRODUCTS_LIVE must be an object'] };
  const problems = [];
  const config = {};
  for (const [id, v] of Object.entries(obj)) {
    const p = byId.get(id);
    if (!p) { problems.push(`${id}: not a product`); continue; }
    if (!p.regulated) { problems.push(`${id}: not a money product, so it has no live mode`); continue; }
    const str = x => typeof x === 'string' && x.trim().length >= 3;
    if (!v || !str(v.licence)) problems.push(`${id}: names no licence`);
    if (!v || !str(v.partner)) problems.push(`${id}: names no partner`);
    const countries = v && Array.isArray(v.countries) ? v.countries : null;
    if (!countries || !countries.length || !countries.every(c => /^[A-Z]{2}$/.test(c))) problems.push(`${id}: countries must be two-letter codes`);
    if (!v || !Number.isInteger(v.kyc) || v.kyc < 1 || v.kyc > 3) problems.push(`${id}: kyc must be a level from 1 to 3`);
    config[id] = v && { licence: v.licence, partner: v.partner, countries: countries || [], kyc: v.kyc };
  }
  return problems.length ? { config: {}, problems } : { config, problems };
}

function parsePaused(raw) {
  return new Set(String(raw || '').split(',').map(s => s.trim()).filter(id => byId.has(id)));
}

/* The country a request comes from, only from a header the operator has
   said their host sets (Vercel: x-vercel-ip-country). */
function countryOf(req, env) {
  const name = String((env || process.env).COUNTRY_HEADER || '').trim().toLowerCase();
  if (!name || !req || !req.headers) return null;
  const v = String(req.headers[name] || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) ? v : null;
}

/* Everything read from the environment, once, with what was wrong. */
function load(env, opts) {
  const e = env || process.env;
  const live = parseLive(e.PRODUCTS_LIVE);
  const backends = (opts && opts.backends) || LIVE;
  const problems = [...checkCatalogue(CATALOGUE), ...live.problems];
  Object.keys(live.config).forEach(id => {
    if (!backends.has(id)) problems.push(`${id}: listed as live, but this code has no real-money backend for it - it stays ${byId.get(id).base}`);
  });
  return { live: live.config, paused: parsePaused(e.PRODUCTS_PAUSED), backends, problems };
}

/* One product, for one person. */
function resolve(p, sb, who) {
  const w = who || {};
  const out = {
    id: p.id, name: p.name, group: p.group, icon: p.icon,
    state: p.base, note: p.note || '', why: p.why || '',
    alt: p.alt || null, altLabel: p.altLabel || null
  };
  if (sb.paused.has(p.id)) return { ...out, state: 'paused', why: PAUSE_WHY };

  const cfg = p.regulated && sb.live[p.id];
  if (!cfg || !sb.backends.has(p.id)) return out;
  if (!w.country) return { ...out, liveWhy: 'Your country could not be confirmed, so only practice mode is available.' };
  if (!cfg.countries.includes(w.country)) return { ...out, liveWhy: `Real-money ${p.name} isn't available in your country (${w.country}) yet.` };
  if (!(Number(w.kyc) >= cfg.kyc)) return { ...out, liveWhy: `Real-money ${p.name} needs identity verification level ${cfg.kyc}.`, action: 'verify' };
  return { ...out, state: 'live', note: `Real money · ${cfg.partner}`, why: '' };
}

function list(sb, who) {
  return {
    version: CATALOGUE.version,
    groups: CATALOGUE.groups,
    country: (who && who.country) || null,
    live: CATALOGUE.products.some(p => resolve(p, sb, who).state === 'live'),
    products: CATALOGUE.products.map(p => resolve(p, sb, who))
  };
}

module.exports = { load, list, resolve, parseLive, parsePaused, countryOf, checkCatalogue, CATALOGUE, STATES, LIVE, PAUSE_WHY };
