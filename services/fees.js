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

/* ╔══════════════════════════════════════════════════════════════════╗
   ║  ESTIMATES — for payments Trending does not send                  ║
   ║                                                                   ║
   ║  A payment to a wallet address is signed and sent in the person's ║
   ║  own wallet app. Trending can't set its fee, but it can say what  ║
   ║  the network is charging right now, at up to three speeds, so the ║
   ║  choice between "free inside Trending" and "on-chain" is made     ║
   ║  with the cost in view.                                           ║
   ║                                                                   ║
   ║  Same rule as quote(): every number comes from the network. Gas   ║
   ║  from eth_feeHistory, sat/vB from mempool.space, energy prices    ║
   ║  from Tron's own chain parameters, Solana's fee from its protocol ║
   ║  constant. A source that does not answer gives no number.         ║
   ║                                                                   ║
   ║  RPCs default to public endpoints so estimates work with nothing  ║
   ║  configured; WATCHER_RPC_<NETWORK> overrides them, as for quote().║
   ╚══════════════════════════════════════════════════════════════════╝ */

const PUBLIC_RPC = {
  ethereum: 'https://ethereum-rpc.publicnode.com',
  base: 'https://base-rpc.publicnode.com',
  arbitrum: 'https://arbitrum-one-rpc.publicnode.com',
  optimism: 'https://optimism-rpc.publicnode.com',
  polygon: 'https://polygon-bor-rpc.publicnode.com',
  bnb: 'https://bsc-rpc.publicnode.com'
};
const rpcUrl = network => process.env['WATCHER_RPC_' + network.toUpperCase()] || PUBLIC_RPC[network] || '';

/* The coin the fee is paid in. Not NETWORKS[].code: Base's code is BASE,
   but its gas is ETH. */
const GAS_COIN = { ethereum: 'ETH', base: 'ETH', arbitrum: 'ETH', optimism: 'ETH', polygon: 'POL', bnb: 'BNB',
                   bitcoin: 'BTC', solana: 'SOL', tron: 'TRX' };
const ROLLUPS = { base: 1, arbitrum: 1, optimism: 1 };

/* Solana charges a fixed 5,000 lamports per signature. A wallet receiving
   an SPL token for the first time also needs a token account, whose
   rent-exempt minimum (165 bytes) is 2,039,280 lamports. */
const SOL_SIG_LAMPORTS = 5000n;
const SOL_TOKEN_ACCOUNT_LAMPORTS = 2039280n;

/* Tron prices a USDT transfer in energy. The USDT contract uses about
   64,285 energy when the receiving address already holds USDT and about
   130,285 when it doesn't, so the fee is a range. Bandwidth is the
   transaction's size in bytes; every account gets some free each day. */
const TRON_USDT_ENERGY = { min: 64285n, max: 130285n };
const TRON_BYTES = { native: 270n, token: 345n };

const EST_TTL = Number(process.env.FEE_ESTIMATE_CACHE_MS || 30000);
const estCache = new Map();

const SPEEDS = ['slow', 'standard', 'fast'];

/* base units -> "0.000123" with trailing zeros dropped */
function toCoin(units, decimals) {
  const neg = units < 0n;
  const u = neg ? -units : units;
  const d = 10n ** BigInt(decimals);
  const whole = u / d;
  const frac = (u % d).toString().padStart(decimals, '0').replace(/0+$/, '');
  return (neg ? '-' : '') + whole.toString() + (frac ? '.' + frac : '');
}

function median(list) {
  if (!list.length) return 0n;
  const s = list.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return s[Math.floor(s.length / 2)];
}

function eta(seconds) {
  if (seconds < 60) return `about ${Math.max(1, Math.round(seconds))} s`;
  const m = Math.round(seconds / 60);
  return m < 60 ? `about ${m} min` : `about ${Math.round(m / 60)} h`;
}

/* A tier that costs the same as a faster one isn't a choice: paying that
   fee gets the faster speed. So it is dropped, and when every tier costs
   the same, what is left is one tier, called standard. */
function collapse(tiers) {
  const kept = tiers.filter((t, i) => !tiers.slice(i + 1).some(n => n.amount === t.amount && n.amountMax === t.amountMax));
  return kept.length === 1 ? [{ ...kept[0], speed: 'standard' }] : kept;
}

async function evmEstimate(network, isToken) {
  const url = rpcUrl(network);
  const label = NETWORKS[network].label;
  if (!url) return { ok: false, reason: `No RPC endpoint is set for ${label}, so its fee cannot be estimated.` };
  const gas = isToken ? GAS.token : GAS.native;
  const block = NETWORKS[network].blockSeconds || 12;
  let perGas = null, source = 'eth_feeHistory';
  try {
    // Base fee of the next block, plus the tip paid at the 10th, 50th and
    // 90th percentile over the last ten blocks.
    const h = await rpc(url, 'eth_feeHistory', ['0xa', 'latest', [10, 50, 90]]);
    const bases = (h && h.baseFeePerGas || []).map(x => BigInt(x));
    const next = bases.length ? bases[bases.length - 1] : 0n;
    const rewards = (h && h.reward) || [];
    perGas = [0, 1, 2].map(i => next + median(rewards.map(r => BigInt((r && r[i]) || '0x0'))));
    if (perGas.every(p => p === 0n)) perGas = null;             // a chain that prices by gasPrice alone
  } catch (e) { perGas = null; }
  if (!perGas) {
    try {
      const gp = BigInt(await rpc(url, 'eth_gasPrice'));
      if (gp <= 0n) throw new Error('zero');
      perGas = [gp, gp, gp];
      source = 'eth_gasPrice';
    } catch (e) {
      return { ok: false, reason: `${label} did not answer with a gas price just now.` };
    }
  }
  const blocks = [5, 2, 1];
  const tiers = collapse(SPEEDS.map((speed, i) => ({
    speed,
    amount: toCoin(perGas[i] * gas, 18),
    eta: eta(block * blocks[i]),
    basis: `${gas} gas at ${toCoin(perGas[i], 9)} gwei`
  })));
  return {
    ok: true, network, coin: GAS_COIN[network], token: isToken, tiers, source,
    note: ROLLUPS[network]
      ? `${label} also adds a small fee for posting to Ethereum, which your wallet includes.`
      : ''
  };
}

async function btcEstimate() {
  const base = process.env.WATCHER_BITCOIN_API || 'https://mempool.space/api';
  let r;
  try {
    const res = await fetch(base + '/v1/fees/recommended', { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(String(res.status));
    r = await res.json();
  } catch (e) {
    return { ok: false, reason: 'The Bitcoin fee estimator did not answer just now.' };
  }
  const rate = v => BigInt(Math.max(1, Math.ceil(Number(v) || 0)));
  const vb = BTC_VBYTES.p2wpkh;
  // mempool.space's own targets: within an hour, half an hour, next block.
  const picks = [[r.hourFee, 3600], [r.halfHourFee, 1800], [r.fastestFee, 600]];
  if (picks.some(([v]) => !(Number(v) > 0))) return { ok: false, reason: 'The Bitcoin fee estimator gave no rate just now.' };
  const tiers = collapse(SPEEDS.map((speed, i) => ({
    speed,
    amount: toCoin(rate(picks[i][0]) * vb, 8),
    eta: eta(picks[i][1]),
    basis: `${vb} vB at ${rate(picks[i][0])} sat/vB`
  })));
  return { ok: true, network: 'bitcoin', coin: 'BTC', token: false, tiers, source: 'mempool.space', note: '' };
}

function solEstimate(isToken) {
  return {
    ok: true, network: 'solana', coin: 'SOL', token: isToken, source: 'protocol',
    tiers: [{ speed: 'standard', amount: toCoin(SOL_SIG_LAMPORTS, 9), eta: 'a few seconds',
              basis: '5,000 lamports per signature, set by the protocol' }],
    extra: isToken
      ? { amount: toCoin(SOL_TOKEN_ACCOUNT_LAMPORTS, 9), why: 'if their wallet has never held this token (a one-off account deposit)' }
      : null,
    note: 'Some wallets add an optional priority fee when the network is busy.'
  };
}

async function tronEstimate(isToken) {
  let params;
  try {
    const res = await fetch('https://api.trongrid.io/wallet/getchainparameters', {
      method: 'POST', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.json();
    params = {};
    (body.chainParameter || []).forEach(p => { if (p && p.key) params[p.key] = p.value; });
  } catch (e) {
    return { ok: false, reason: 'The Tron network did not answer with its fee rates just now.' };
  }
  const energy = BigInt(params.getEnergyFee || 0), byte = BigInt(params.getTransactionFee || 0);
  if (energy <= 0n || byte <= 0n) return { ok: false, reason: 'The Tron network gave no fee rates just now.' };
  if (!isToken) {
    return {
      ok: true, network: 'tron', coin: 'TRX', token: false, source: 'trongrid',
      tiers: [{ speed: 'standard', amount: toCoin(TRON_BYTES.native * byte, 6), eta: 'about 1 min',
                basis: `${TRON_BYTES.native} bytes of bandwidth at ${byte} sun` }],
      note: 'Free if your account still has its daily free bandwidth.'
    };
  }
  const bw = TRON_BYTES.token * byte;
  return {
    ok: true, network: 'tron', coin: 'TRX', token: true, source: 'trongrid',
    tiers: [{ speed: 'standard',
              amount: toCoin(TRON_USDT_ENERGY.min * energy + bw, 6),
              amountMax: toCoin(TRON_USDT_ENERGY.max * energy + bw, 6),
              eta: 'about 1 min',
              basis: `${TRON_USDT_ENERGY.min}–${TRON_USDT_ENERGY.max} energy at ${energy} sun` }],
    note: 'The higher figure applies when their address has never held USDT. Staked TRX energy lowers it.'
  };
}

async function estimate(network, opts) {
  const o = opts || {};
  const net = NETWORKS[network];
  if (!net || !GAS_COIN[network]) return { ok: false, unknown: true, reason: 'Fees for that network are not estimated here.' };
  const isToken = !!o.token;
  const key = `${network}:${isToken ? 'token' : 'native'}`;
  const hit = estCache.get(key);
  if (hit && Date.now() - hit.at < EST_TTL) return { ...hit, cached: true };

  let out;
  if (net.family === 'evm') out = await evmEstimate(network, isToken);
  else if (net.family === 'bitcoin') out = await btcEstimate();
  else if (net.family === 'solana') out = solEstimate(isToken);
  else if (net.family === 'tron') out = await tronEstimate(isToken);
  else out = { ok: false, unknown: true, reason: 'Fees for that network are not estimated here.' };

  if (out.ok) {
    out.at = Date.now();
    estCache.set(key, out);
  }
  return out;
}

module.exports = { quote, isFresh, FRESH_MS, GAS, BTC_VBYTES, estimate, GAS_COIN, PUBLIC_RPC };
