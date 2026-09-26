/* ╔══════════════════════════════════════════════════════════════════╗
   ║  TOKEN ALLOW-LIST — which contracts the watcher may credit        ║
   ║                                                                   ║
   ║  A token is a contract, and anyone can deploy one. A Transfer     ║
   ║  event from a contract someone deployed this morning looks, on    ║
   ║  the chain, exactly like one from the real USDT. So a token is    ║
   ║  credited only when its contract is on this list, and only as    ║
   ║  the asset the list names. Everything else is recorded, flagged,  ║
   ║  and never credited.                                              ║
   ║                                                                   ║
   ║  The list comes from the operator's environment, never from this  ║
   ║  repository - config/crypto-deposit.js explains why Trending      ║
   ║  does not publish contract addresses. The operator copies each    ║
   ║  one from the issuer's own documentation and checks it twice:     ║
   ║                                                                   ║
   ║    CUSTODY_TOKENS={"ethereum":{"0x…":{"asset":"USDT","decimals":6}}}
   ║                                                                   ║
   ║  Fail closed: one malformed entry and NO token is credited, with  ║
   ║  the reasons available from problems(). A list that is partly     ║
   ║  wrong is not a list anyone checked.                              ║
   ║                                                                   ║
   ║  Decimals must agree per asset. The ledger keeps one balance per  ║
   ║  asset in base units, and USDT has 6 decimals on Ethereum but 18  ║
   ║  on BNB Smart Chain - crediting both into one balance would mix   ║
   ║  units. Until amounts are normalised, an asset's contracts must   ║
   ║  all share one decimals value or the list is refused.             ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const { NETWORKS, ASSETS } = require('./crypto-deposit');

let cached = { raw: null, value: null };

function parse(raw) {
  const problems = [];
  const tokens = new Map();
  if (!raw || !String(raw).trim()) return { tokens, problems, configured: false };

  let json;
  try { json = JSON.parse(raw); }
  catch (e) { return { tokens: new Map(), problems: ['CUSTODY_TOKENS is not valid JSON'], configured: true }; }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { tokens: new Map(), problems: ['CUSTODY_TOKENS must be an object keyed by network'], configured: true };
  }

  const decimalsOf = {};
  for (const [network, entries] of Object.entries(json)) {
    const net = NETWORKS[network];
    if (!net || net.family !== 'evm') { problems.push(`${network}: not an EVM network Trending knows`); continue; }
    if (!entries || typeof entries !== 'object') { problems.push(`${network}: expected an object of contracts`); continue; }
    for (const [contractRaw, spec] of Object.entries(entries)) {
      const contract = String(contractRaw).toLowerCase();
      const where = `${network} ${contractRaw}`;
      if (!/^0x[0-9a-f]{40}$/.test(contract)) { problems.push(`${where}: not a contract address`); continue; }
      const symbol = spec && String(spec.asset || '').toUpperCase();
      const asset = ASSETS.find(a => a.symbol === symbol);
      if (!asset || !asset.token) { problems.push(`${where}: ${symbol || 'no asset'} is not a token Trending lists`); continue; }
      if (!asset.networks.some(n => n.net === network)) { problems.push(`${where}: ${symbol} is not listed on ${network}`); continue; }
      const decimals = spec.decimals;
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) { problems.push(`${where}: decimals must be a whole number 0-36`); continue; }
      if (decimalsOf[symbol] != null && decimalsOf[symbol] !== decimals) {
        problems.push(`${symbol}: contracts disagree on decimals (${decimalsOf[symbol]} and ${decimals}); one ledger balance cannot hold both`);
        continue;
      }
      decimalsOf[symbol] = decimals;
      const key = `${network}:${contract}`;
      if (tokens.has(key)) { problems.push(`${where}: listed twice`); continue; }
      tokens.set(key, { network, contract, asset: symbol, decimals });
    }
  }
  return { tokens: problems.length ? new Map() : tokens, problems, configured: true };
}

function current() {
  const raw = process.env.CUSTODY_TOKENS || '';
  if (cached.raw !== raw) cached = { raw, value: parse(raw) };
  return cached.value;
}

/* The asset a contract may be credited as on a network, or null. */
function tokenFor(network, contract) {
  return current().tokens.get(`${network}:${String(contract || '').toLowerCase()}`) || null;
}

const problems = () => current().problems.slice();

module.exports = { tokenFor, problems, parse };
