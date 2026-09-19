#!/usr/bin/env node
/* ╔══════════════════════════════════════════════════════════════════╗
   ║  TRENDING SIGNER                                                  ║
   ║                                                                   ║
   ║  A separate program, run on a separate machine, with no inbound   ║
   ║  route from anywhere. It PULLS work from the web tier; nothing    ║
   ║  pushes to it. That direction is the security property: an        ║
   ║  intruder in the web tier can put a row in a queue, but cannot    ║
   ║  reach the thing that signs, and cannot make it sign faster than  ║
   ║  its own policy allows.                                           ║
   ║                                                                   ║
   ║    node signer/index.js run       work the queue                  ║
   ║    node signer/index.js once      one pass, then exit             ║
   ║    node signer/index.js status    what it can see and do          ║
   ║                                                                   ║
   ║  What it does with each withdrawal:                               ║
   ║                                                                   ║
   ║    1. re-reads the withdrawal from its OWN fetch, not a payload   ║
   ║       handed to it                                                ║
   ║    2. re-checks the destination address itself                    ║
   ║    3. asks its own policy: sign, ask a human, or refuse           ║
   ║    4. builds the transaction and shows it in full                 ║
   ║    5. gets a signature from a device this process cannot read     ║
   ║    6. broadcasts, and reports the hash back                       ║
   ║                                                                   ║
   ║  It holds no key. It cannot hold a key: there is no code path in  ║
   ║  this directory that loads one.                                   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const addressLib = require('../lib/address');
const { NETWORKS } = require('../config/crypto-deposit');
const evmtx = require('./lib/evmtx');
const policy = require('./policy');
const backends = require('./backends');

const CFG = {
  api: process.env.SIGNER_API || 'http://127.0.0.1:3000',
  token: process.env.SIGNER_TOKEN || '',
  intervalMs: Number(process.env.SIGNER_INTERVAL_MS || 30000),
  batch: Number(process.env.SIGNER_BATCH || 5)
};

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const big = v => BigInt(String(v == null ? '0' : v));

async function api(path, init) {
  const r = await fetch(CFG.api + path, {
    ...init,
    headers: Object.assign(
      { Accept: 'application/json' },
      CFG.token ? { Authorization: 'Bearer ' + CFG.token } : {},
      init && init.body ? { 'Content-Type': 'application/json' } : {},
      (init && init.headers) || {}
    ),
    signal: AbortSignal.timeout(20000)
  });
  let body = null;
  try { body = await r.json(); } catch (e) {}
  if (!r.ok) {
    const err = new Error((body && body.message) || `${path} answered ${r.status}`);
    err.status = r.status;
    err.code = body && body.error;
    throw err;
  }
  return body;
}

async function rpc(network, method, params) {
  const url = process.env['SIGNER_RPC_' + network.toUpperCase()] ||
              process.env['WATCHER_RPC_' + network.toUpperCase()];
  if (!url) throw new Error(`no RPC endpoint configured for ${network}`);
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params: params || [] }),
    signal: AbortSignal.timeout(20000)
  });
  const body = await r.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

/* ── One withdrawal, start to finish ─────────────────────────────── */
async function handle(w, ctx) {
  log(`· ${w.id}  ${w.amount} ${w.asset} on ${w.network} → ${w.to}`);

  const net = NETWORKS[w.network];
  if (!net) return refuse(w, `unknown network ${w.network}`);
  if (net.family !== 'evm') {
    /* Bitcoin needs UTXO selection and a different signing flow. Saying
       so beats half-building it. */
    return skip(w, `${net.label} signing is not implemented in this signer`);
  }

  /* The address is checked here, by this program, against its own copy
     of the rules. The queue's opinion of it is not evidence. */
  const v = addressLib.validate('evm', w.to);
  if (!v.ok) return refuse(w, `destination failed validation here: ${v.reason}`);
  if (v.normalized && v.normalized.toLowerCase() !== String(w.to).toLowerCase()) {
    return refuse(w, 'the destination does not match its own checksum');
  }

  let chainFee = null, nonce, maxFee, priority, gasLimit, from;
  try {
    from = process.env.SIGNER_FROM;
    if (!from) return skip(w, 'SIGNER_FROM is not set — the signer does not know which account it spends from');
    const [block, tip, count] = await Promise.all([
      rpc(w.network, 'eth_getBlockByNumber', ['latest', false]),
      rpc(w.network, 'eth_maxPriorityFeePerGas').catch(() => '0x0'),
      rpc(w.network, 'eth_getTransactionCount', [from, 'pending'])
    ]);
    const base = BigInt(block.baseFeePerGas || '0x0');
    priority = BigInt(tip || '0x0');
    maxFee = base * 2n + priority;
    nonce = BigInt(count);
    gasLimit = w.contract ? 100000n : 21000n;
    chainFee = maxFee * gasLimit;
  } catch (e) {
    return skip(w, 'the chain could not be reached: ' + e.message);
  }

  const call = policy.decide(w, { policy: ctx.policy, chainFee: chainFee.toString(), spentToday: ctx.spentToday });
  log(`  policy: ${call.action} — ${call.why}`);
  if (call.action === 'refuse') return refuse(w, 'signer policy: ' + call.why);

  const tx = evmtx.build({
    chainId: net.chainId, nonce, priorityFee: priority, maxFee, gasLimit,
    to: w.to, amount: w.amount, contract: w.contract || ''
  });
  const { hash } = evmtx.unsigned(tx);
  const describe = evmtx.describe(tx, { recipient: w.to, asset: w.asset });

  if (call.action === 'approve' && !ctx.backend.needsHuman) {
    /* A human is required, and this backend cannot ask for one. */
    const yes = await backends.ask(`\n${describe}\n\nThis is over the automatic limit. Approve it? (type YES) `);
    if (yes !== 'YES') return skip(w, 'a human did not approve it');
  }

  const signed = await ctx.backend.sign({ hash, describe, withdrawal: w, tx });
  if (!signed.ok) return skip(w, signed.why);

  let raw;
  try { raw = evmtx.assemble(tx, signed.sig); }
  catch (e) { return skip(w, 'the signature did not assemble: ' + e.message); }

  let txHash;
  try {
    txHash = await rpc(w.network, 'eth_sendRawTransaction', [raw.raw]);
  } catch (e) {
    /* Already-known means it is on the network; anything else is not. */
    if (/known|already/i.test(e.message)) txHash = raw.hash;
    else return skip(w, 'broadcast failed: ' + e.message);
  }

  log(`  broadcast ${txHash}`);
  await report(w, 'broadcast', { txHash });
  ctx.spentToday[w.asset] = (big(ctx.spentToday[w.asset]) + big(w.amount)).toString();
  return 'broadcast';
}

/* ── Reporting back ──────────────────────────────────────────────── */
async function report(w, status, patch) {
  try {
    await api(`/api/crypto/signer/withdrawals/${encodeURIComponent(w.id)}`, {
      method: 'POST', body: JSON.stringify({ status, ...(patch || {}) })
    });
  } catch (e) { log('  ! could not report back:', e.message); }
}
async function refuse(w, why) {
  log('  refused:', why);
  await report(w, 'rejected', { reason: why });
  return 'refused';
}
function skip(w, why) { log('  skipped:', why); return 'skipped'; }

/* ── The loop ────────────────────────────────────────────────────── */
async function pass(ctx) {
  let queue;
  try {
    queue = await api(`/api/crypto/signer/queue?limit=${CFG.batch}`);
  } catch (e) {
    log('queue unavailable:', e.message);
    return;
  }
  const rows = (queue && queue.withdrawals) || [];
  if (!rows.length) { log('nothing queued'); return; }
  log(`${rows.length} queued`);
  for (const w of rows) {
    try {
      /* Claimed one at a time, so two signers cannot work the same row. */
      const claim = await api(`/api/crypto/signer/withdrawals/${encodeURIComponent(w.id)}/claim`, { method: 'POST' });
      if (!claim || !claim.ok) { log(`· ${w.id} already claimed`); continue; }
      await handle(claim.withdrawal, ctx);
    } catch (e) {
      log(`· ${w.id} error:`, e.message);
    }
  }
}

async function main() {
  const cmd = process.argv[2] || 'status';
  const P = policy.load();
  let backend;
  try { backend = backends.pick(); }
  catch (e) { console.error('\n' + e.message + '\n'); process.exit(1); }

  const ctx = { policy: P, backend, spentToday: {} };

  if (cmd === 'status') {
    console.log('\nTrending signer');
    console.log('  api            ' + CFG.api);
    console.log('  token          ' + (CFG.token ? 'set' : 'NOT SET — the queue will refuse this signer'));
    console.log('  backend        ' + backend.name + (backend.needsHuman ? ' (a human signs each one)' : ''));
    console.log('  spends from    ' + (process.env.SIGNER_FROM || 'NOT SET'));
    console.log('  policy file    ' + P._file + (P._found ? '' : ' (not found — defaults in use)'));
    console.log('  hot limits     ' + (Object.keys(P.hotLimit).length ? JSON.stringify(P.hotLimit) : 'none set — every withdrawal needs a human'));
    console.log('  allow list     ' + (P.allowList.length ? P.allowList.length + ' addresses' : 'open'));
    console.log('  holds keys     no — and there is no code here that could\n');
    try {
      const q = await api('/api/crypto/signer/queue?limit=1');
      console.log('  queue          reachable, ' + (q.total == null ? '?' : q.total) + ' waiting\n');
    } catch (e) { console.log('  queue          unreachable: ' + e.message + '\n'); }
    return;
  }

  if (cmd === 'once') { await pass(ctx); return; }

  if (cmd === 'run') {
    log(`signer starting — backend ${backend.name}, every ${CFG.intervalMs / 1000}s`);
    await pass(ctx);
    setInterval(() => pass(ctx).catch(e => log('pass failed:', e.message)), CFG.intervalMs);
    return;
  }

  console.log('usage: node signer/index.js [status|once|run]');
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

module.exports = { handle, pass, api, CFG };
