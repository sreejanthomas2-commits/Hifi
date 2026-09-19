/* ╔══════════════════════════════════════════════════════════════════╗
   ║  NETWORK FEES — quoted from the chain, or not quoted at all       ║
   ║                                                                   ║
   ║  A withdrawal screen that shows a made-up fee is worse than one   ║
   ║  that shows nothing: the user budgets against it, sends, and      ║
   ║  finds out later. So every number here comes from the network —   ║
   ║  gas price from an RPC, sat/vB from a fee estimator — and when    ║
   ║  the source does not answer, the quote fails and the flow stops   ║
   ║  with "we cannot price this right now".                           ║
   ║                                                                   ║
   ║  The minimum withdrawal is derived, not decreed: three times the  ║
   ║  current fee, because sending an amount the fee would eat is not  ║
   ║  a service. It moves when the network moves, which is honest.     ║
   ║                                                                   ║
   ║  Quotes are cached briefly and carry the moment they were taken,  ║
   ║  so a stale one can be recognised rather than trusted.            ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const { NETWORKS } = require('../config/crypto-deposit');

const TTL = Number(process.env.FEE_CACHE_MS || 30000);
const cache = new Map();

/* Gas a transfer actually costs. A token transfer touches storage, so it
   is dearer than moving the chain's own coin — quoting one for the other
   is how a withdrawal fails for "out of gas". */
const GAS = { native: 21000n, token: 65000n };
const BTC_VBYTES = { p2wpkh: 141n, p2pkh: 226n, p2sh: 170n, p2tr: 111n };

async function rpc(url, method, params) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] }),
    signal: AbortSignal.timeout(6000)
  });
  if (!r.ok) throw new Error(`${method}: ${r.status}`);
  const body = await r.json();
  if (body.error) throw new Error(`${method}: ${body.error.message || 'rpc error'}`);
  return body.result;
}

/* ── EVM ─────────────────────────────────────────────────────────── */
async function evmFee(network, isToken) {
  const url = process.env['WATCHER_RPC_' + network.toUpperCase()];
  if (!url) return { ok: false, reason: `No RPC endpoint is configured for ${NETWORKS[network].label}, so its fee cannot be quoted.` };
  let wei;
  try {
    // EIP-1559 where it exists: base fee of the next block plus a tip.
    const [block, tip] = await Promise.all([
      rpc(url, 'eth_getBlockByNumber', ['latest', false]),
      rpc(url, 'eth_maxPriorityFeePerGas').catch(() => null)
    ]);
    const base = block && block.baseFeePerGas ? BigInt(block.baseFeePerGas) : null;
    if (base != null) {
      const priority = tip ? BigInt(tip) : base / 10n;
      wei = (base * 2n + priority);                 // room for one base-fee rise
    } else {
      wei = BigInt(await rpc(url, 'eth_gasPrice'));
    }
  } catch (e) {
    return { ok: false, reason: `${NETWORKS[network].label} did not answer with a gas price just now.` };
  }
  const gas = isToken ? GAS.token : GAS.native;
  const fee = wei * gas;
  return {
    ok: true, fee: fee.toString(), decimals: 18, unit: NETWORKS[network].code,
    basis: `${gas} gas at ${(wei / 1000000000n).toString()} gwei`, at: Date.now()
  };
}

/* ── Bitcoin ─────────────────────────────────────────────────────── */
async function btcFee(kind) {
  const base = process.env.WATCHER_BITCOIN_API || 'https://mempool.space/api';
  let satPerVb;
  try {
    const r = await fetch(base + '/v1/fees/recommended', { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(String(r.status));
    const body = await r.json();
    satPerVb = BigInt(Math.max(1, Math.ceil(body.halfHourFee || body.hourFee || 0)));
    if (satPerVb <= 0n) throw new Error('no rate');
  } catch (e) {
    return { ok: false, reason: 'The Bitcoin fee estimator did not answer just now.' };
  }
  const vbytes = BTC_VBYTES[kind] || BTC_VBYTES.p2wpkh;
  return {
    ok: true, fee: (satPerVb * vbytes).toString(), decimals: 8, unit: 'BTC',
    basis: `${vbytes} vB at ${satPerVb} sat/vB`, at: Date.now()
  };
}

/* ── The one call the rest of the system makes ───────────────────── */
async function quote(network, opts) {
  const o = opts || {};
  const net = NETWORKS[network];
  if (!net) return { ok: false, reason: 'Unknown network.' };
  if (net.status !== 'open') return { ok: false, reason: `Withdrawals on ${net.label} are ${net.status}.` };

  const key = `${network}:${o.token ? 'token' : 'native'}:${o.kind || ''}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { ...hit, cached: true };

  let out;
  if (net.family === 'evm') out = await evmFee(network, !!o.token);
  else if (net.family === 'bitcoin') out = await btcFee(o.kind);
  else out = { ok: false, reason: `Fees on ${net.label} cannot be quoted here yet.` };

  if (out.ok) {
    // Three times the fee: below that, the fee is most of what you sent.
    out.minimum = (BigInt(out.fee) * 3n).toString();
    out.network = network;
    cache.set(key, out);
  }
  return out;
}

/* A quote older than this must not be used to send. */
const FRESH_MS = Number(process.env.FEE_FRESH_MS || 120000);
const isFresh = q => !!(q && q.at && Date.now() - q.at < FRESH_MS);

module.exports = { quote, isFresh, FRESH_MS, GAS, BTC_VBYTES };
