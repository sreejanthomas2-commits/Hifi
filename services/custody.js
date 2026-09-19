/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CUSTODY — issuing deposit addresses without holding a key        ║
   ║                                                                   ║
   ║  The trick that makes this safe: an operator registers an account ║
   ║  level EXTENDED PUBLIC key (xpub/zpub) for each chain. From that  ║
   ║  the server can derive an unlimited run of receiving addresses    ║
   ║  and watch them — and can do nothing else with them. Spending     ║
   ║  needs the matching private key, which stays in the hardware      ║
   ║  wallet or HSM that generated it and never comes near this box.   ║
   ║                                                                   ║
   ║  So a server compromise leaks a mapping of users to addresses.    ║
   ║  It does not lose funds. That is the whole design.                ║
   ║                                                                   ║
   ║  Configuration (environment, never the repository):               ║
   ║                                                                   ║
   ║    CUSTODY_XPUB_BITCOIN = zpub6r…                                 ║
   ║    CUSTODY_XPUB_EVM     = xpub6C…                                 ║
   ║    CUSTODY_ENABLED      = true                                    ║
   ║                                                                   ║
   ║  With nothing configured the API answers 503 and explains why.    ║
   ║  There is no default, no example key and no fallback: an address  ║
   ║  nobody holds the key to would swallow every coin sent to it.     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const { addressAt, parseXpub } = require('../lib/crypto');
const { DepositAddress, AuditLog, NetworkState } = require('../models/custody');
const { NETWORKS } = require('../config/crypto-deposit');

const DUPLICATE = 11000;

/* Which xpub covers which chain. EVM chains share one account key
   because the address is identical on all of them. */
const KEY_FOR = {
  bitcoin: 'BITCOIN',
  ethereum: 'EVM', base: 'EVM', arbitrum: 'EVM',
  optimism: 'EVM', polygon: 'EVM', bnb: 'EVM'
};

const cache = new Map();

function xpubFor(network) {
  const slot = KEY_FOR[network];
  if (!slot) return null;
  const raw = process.env['CUSTODY_XPUB_' + slot];
  if (!raw) return null;
  if (cache.has(slot)) return cache.get(slot);
  const node = parseXpub(raw);                      // throws on a private key, bad checksum, off-curve point
  const entry = { id: slot.toLowerCase() + ':' + node.fingerprint.toString('hex'), node };
  cache.set(slot, entry);
  return entry;
}

const enabled = () => String(process.env.CUSTODY_ENABLED || '').toLowerCase() === 'true';

function status(network) {
  if (!enabled()) {
    return { ok: false, code: 'custody_disabled',
      message: 'Trending is not holding deposits yet. Custody has to be switched on by an operator with keys in hardware — until then, use an address from your own wallet.' };
  }
  const net = NETWORKS[network];
  if (!net) return { ok: false, code: 'unsupported_network', message: 'That network is not supported.' };
  if (net.status !== 'open') return { ok: false, code: 'network_' + net.status, message: `Deposits on ${net.label} are ${net.status}.` };
  if (!KEY_FOR[network]) return { ok: false, code: 'no_derivation', message: `Address derivation for ${net.label} is not implemented.` };
  let key = null;
  try { key = xpubFor(network); }
  catch (e) { return { ok: false, code: 'bad_key', message: 'The configured account key is not usable: ' + e.message }; }
  if (!key) return { ok: false, code: 'no_key', message: `No account key is configured for ${net.label}.` };
  return { ok: true, key, net };
}

/* One address per (user, asset, network), reused on every later ask —
   an exchange behaves the same way, and it keeps the watched set small
   enough to scan. */
async function addressFor(userId, asset, network) {
  const st = status(network);
  if (!st.ok) return st;

  const existing = await DepositAddress.findOne({ userId, asset, network, status: 'active' });
  if (existing) return { ok: true, reused: true, address: existing };

  // The next free index on this account key. A unique index on
  // (xpubId, change, index) is what actually prevents two users being
  // handed the same address when two requests race.
  for (let attempt = 0; attempt < 8; attempt++) {
    const last = await DepositAddress.findOne({ xpubId: st.key.id }).sort({ index: -1 }).select('index');
    const index = (last ? last.index : -1) + 1 + attempt;
    let derived;
    try {
      derived = addressAt(st.key.node, index, st.net.family, { change: 0 });
    } catch (e) {
      continue;                                     // BIP-32 says skip an unusable index
    }
    try {
      const rec = await DepositAddress.create({
        userId, asset, network, address: derived.address,
        xpubId: st.key.id, change: 0, index,
        derivation: `${st.key.id}/0/${index}`,
        status: 'active'
      });
      await AuditLog.create([{
        actor: userId, action: 'deposit.address.issued', subject: derived.address,
        detail: { asset, network, index, xpubId: st.key.id }
      }]);
      return { ok: true, reused: false, address: rec };
    } catch (e) {
      if (e && e.code === DUPLICATE) continue;      // someone took that index; try the next
      throw e;
    }
  }
  return { ok: false, code: 'address_unavailable', message: 'Could not issue an address just now. Try again in a moment.' };
}

/* Used by the watcher to answer "is this address ours, and whose?" */
async function ownerOf(network, address) {
  return DepositAddress.findOne({ network, address });
}

/* An operator check that costs nothing and catches the worst mistake:
   derive index 0 and compare it against what the hardware wallet
   shows. If they differ, the key is wrong and no address should be
   issued until they match. */
function preview(network, count) {
  const st = status(network);
  if (!st.ok) return st;
  const rows = [];
  for (let i = 0; i < (count || 3); i++) {
    rows.push({ index: i, ...addressAt(st.key.node, i, st.net.family, { change: 0 }) });
  }
  return { ok: true, xpubId: st.key.id, fingerprint: st.key.node.fingerprint.toString('hex'), addresses: rows };
}

async function networkState(network) {
  const row = await NetworkState.findOne({ network });
  return row || { network, status: (NETWORKS[network] || {}).status || 'open', message: '' };
}

module.exports = { enabled, status, addressFor, ownerOf, preview, networkState, xpubFor, KEY_FOR };
