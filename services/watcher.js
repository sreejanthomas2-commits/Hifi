/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CHAIN WATCHER — the part that decides a deposit is real          ║
   ║                                                                   ║
   ║  The browser never credits anything. This does, and only after    ║
   ║  the chain says so:                                               ║
   ║                                                                   ║
   ║    see a payment to an address we issued                          ║
   ║      → is it ours, and whose?                                     ║
   ║      → is the asset the one that address was issued for?          ║
   ║      → for a token, does the contract match exactly?              ║
   ║      → record it (unique on network+txHash+vout)                  ║
   ║      → follow it until confirmations ≥ the policy for that chain  ║
   ║      → credit the ledger once, idempotently                       ║
   ║                                                                   ║
   ║  Every step is safe to interrupt. The watcher can be killed at    ║
   ║  any line and restarted: the unique indexes mean a repeat of any  ║
   ║  step is a no-op rather than a second credit.                     ║
   ║                                                                   ║
   ║  Drivers talk to ordinary public endpoints, configured by the     ║
   ║  operator. Nothing is hard-coded to a provider, and with none     ║
   ║  configured the watcher simply does not run.                      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const { DepositAddress, DepositTx, AuditLog, NetworkState } = require('../models/custody');
const { NETWORKS, NATIVE_ASSET } = require('../config/crypto-deposit');
const tokenList = require('../config/custody-tokens');
const custody = require('./custody');
const ledger = require('./ledger');

const TICK_MS = Number(process.env.WATCHER_INTERVAL_MS || 60000);
const MAX_BLOCKS_PER_TICK = Number(process.env.WATCHER_MAX_BLOCKS || 50);

/* ERC-20 Transfer(address,address,uint256) */
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const json = async (url, init) => {
  const r = await fetch(url, { ...init, headers: { Accept: 'application/json', ...(init && init.headers) } });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return r.json();
};

async function rpc(url, method, params) {
  const body = await json(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params: params || [] })
  });
  if (body.error) throw new Error(`${method}: ${body.error.message || 'rpc error'}`);
  return body.result;
}

/* ── Bitcoin ─────────────────────────────────────────────────────────
   Any esplora-compatible endpoint works; mempool.space is the default
   because it is public and needs no key. Point it at your own node in
   production — a third party that can lie to you about payments is a
   third party that can be made to lie to you.                       */
const bitcoin = {
  base: () => process.env.WATCHER_BITCOIN_API || 'https://mempool.space/api',
  async height() { return Number(await json(this.base() + '/blocks/tip/height')); },
  async scan(addresses) {
    const tip = await this.height();
    const found = [];
    for (const rec of addresses) {
      let txs;
      try { txs = await json(`${this.base()}/address/${rec.address}/txs`); }
      catch (e) { continue; }                        // one bad address must not stop the sweep
      for (const tx of txs) {
        (tx.vout || []).forEach((out, i) => {
          if (out.scriptpubkey_address !== rec.address) return;
          const height = tx.status && tx.status.block_height;
          found.push({
            network: 'bitcoin', txHash: tx.txid, vout: i, address: rec.address,
            addressId: String(rec._id), userId: rec.userId, asset: 'BTC',
            amount: String(out.value),               // satoshi
            confirmations: height ? (tip - height + 1) : 0,
            blockHeight: height || null, contract: ''
          });
        });
      }
    }
    return { tip, found };
  }
};

/* ── EVM chains ──────────────────────────────────────────────────────
   Tokens come from logs, which is exact and cheap. Native coin needs
   the blocks themselves, so that sweep is bounded per tick and picks
   up where it left off.                                             */
const evm = {
  url(network) { return process.env['WATCHER_RPC_' + network.toUpperCase()] || ''; },
  async height(url) { return parseInt(await rpc(url, 'eth_blockNumber'), 16); },

  async scan(addresses, network, state) {
    const url = this.url(network);
    if (!url) return { tip: 0, found: [] };
    const tip = await this.height(url);
    const from = Math.max((state.lastScanned || tip - 1) + 1, tip - MAX_BLOCKS_PER_TICK);
    const found = [];
    if (from > tip) return { tip, found };

    const byAddress = new Map(addresses.map(a => [a.address.toLowerCase(), a]));
    const topics = addresses.map(a => '0x' + a.address.slice(2).toLowerCase().padStart(64, '0'));

    /* Token transfers to any of our addresses. */
    if (topics.length) {
      for (let i = 0; i < topics.length; i += 100) {   // some providers cap topic lists
        const slice = topics.slice(i, i + 100);
        let logs = [];
        try {
          logs = await rpc(url, 'eth_getLogs', [{
            fromBlock: '0x' + from.toString(16), toBlock: '0x' + tip.toString(16),
            topics: [TRANSFER_TOPIC, null, slice]
          }]);
        } catch (e) { logs = []; }
        for (const log of logs) {
          /* What arrived is decided by the contract that emitted the
             event, looked up in the operator's allow-list - never by the
             asset the receiving address happens to have been issued for.
             That was the old rule, and it credited any token at all,
             including one deployed for the purpose, as the real thing.

             ERC-721 shares the Transfer signature but has four topics
             and no amount in data; BigInt('0x') on its empty data threw
             and stopped the whole sweep for that chain, every tick, for
             good. So the shape is checked, and one odd log is skipped
             rather than allowed to stop the rest. */
          try {
            if (!Array.isArray(log.topics) || log.topics.length !== 3) continue;
            if (!/^0x[0-9a-fA-F]{64}$/.test(String(log.data))) continue;
            const to = '0x' + String(log.topics[2]).slice(26).toLowerCase();
            const rec = byAddress.get(to);
            if (!rec) continue;
            const height = parseInt(log.blockNumber, 16);
            const contract = String(log.address).toLowerCase();
            const token = tokenList.tokenFor(network, contract);
            found.push({
              network, txHash: log.transactionHash, vout: parseInt(log.logIndex, 16),
              address: rec.address, addressId: String(rec._id), userId: rec.userId,
              asset: token ? token.asset : null, amount: BigInt(log.data).toString(),
              confirmations: tip - height + 1, blockHeight: height, contract
            });
          } catch (e) { /* malformed log - skip it, keep sweeping */ }
        }
      }
    }

    /* Native coin, block by block. */
    for (let h = from; h <= tip; h++) {
      let block;
      try { block = await rpc(url, 'eth_getBlockByNumber', ['0x' + h.toString(16), true]); }
      catch (e) { break; }
      if (!block || !block.transactions) continue;
      for (const tx of block.transactions) {
        const to = (tx.to || '').toLowerCase();
        const rec = byAddress.get(to);
        if (!rec || !tx.value || BigInt(tx.value) === 0n) continue;
        // The native coin, not the network's code: ETH on Arbitrum is
        // ETH, and ARB there is a token.
        found.push({
          network, txHash: tx.hash, vout: 0, address: rec.address,
          addressId: String(rec._id), userId: rec.userId, asset: NATIVE_ASSET[network] || null,
          amount: BigInt(tx.value).toString(),
          confirmations: tip - h + 1, blockHeight: h, contract: ''
        });
      }
    }
    return { tip, found };
  }
};

/* ── The loop ────────────────────────────────────────────────────── */
/* Confirmations are a policy, not a fact about the chain: how long
   Trending waits before it treats a payment as irreversible. */
const CONFIRMATIONS = {
  bitcoin: Number(process.env.CONF_BITCOIN || 2),
  ethereum: Number(process.env.CONF_ETHEREUM || 12),
  base: Number(process.env.CONF_BASE || 20),
  arbitrum: Number(process.env.CONF_ARBITRUM || 20),
  optimism: Number(process.env.CONF_OPTIMISM || 20),
  polygon: Number(process.env.CONF_POLYGON || 60),
  bnb: Number(process.env.CONF_BNB || 15)
};

async function record(hit) {
  const required = CONFIRMATIONS[hit.network] || 12;
  const key = { network: hit.network, txHash: hit.txHash, vout: hit.vout };

  /* The address was issued for one asset. Anything else arriving on it
     is recorded and flagged, never credited quietly - and so is a token
     whose contract is not on the allow-list (hit.asset is null then),
     and anything arriving on an address this system did not issue. */
  const addr = await DepositAddress.findById(hit.addressId);
  const refuse = !hit.asset ? `token contract ${hit.contract || '(none)'} is not on the allow-list`
    : !addr ? 'the receiving address is not one Trending issued'
    : addr.asset !== hit.asset ? `address was issued for ${addr.asset}, received ${hit.asset}`
    : '';

  let doc = await DepositTx.findOne(key);
  if (!doc) {
    try {
      doc = await DepositTx.create({
        ...key, addressId: hit.addressId, address: hit.address, userId: hit.userId,
        asset: hit.asset || 'UNLISTED', amount: hit.amount, contract: hit.contract,
        confirmations: hit.confirmations, required, blockHeight: hit.blockHeight,
        status: refuse ? 'rejected' : (hit.confirmations >= required ? 'confirmed' : 'confirming'),
        rejectedReason: refuse
      });
      await AuditLog.create([{ actor: 'watcher', action: 'deposit.detected', subject: hit.txHash,
        detail: { network: hit.network, asset: hit.asset, amount: hit.amount, userId: hit.userId } }]);
    } catch (e) {
      if (!e || e.code !== 11000) throw e;
      doc = await DepositTx.findOne(key);            // another worker won the race
    }
  }
  if (!doc || doc.status === 'credited' || doc.status === 'rejected') return doc;

  if (doc.confirmations !== hit.confirmations || doc.blockHeight !== hit.blockHeight) {
    doc.confirmations = hit.confirmations;
    doc.blockHeight = hit.blockHeight;
    if (hit.confirmations >= doc.required) doc.status = 'confirmed';
    await doc.save();
  }

  if (doc.status === 'confirmed') {
    const res = await ledger.credit({
      userId: doc.userId, asset: doc.asset, amount: doc.amount,
      referenceType: 'deposit', referenceId: String(doc._id),
      memo: `${doc.network} ${doc.txHash.slice(0, 12)}…`
    });
    doc.status = 'credited';
    doc.creditedAt = new Date();
    doc.ledgerEntryId = res.groupId;
    await doc.save();
    await AuditLog.create([{ actor: 'watcher', action: 'deposit.credited', subject: doc.txHash,
      detail: { userId: doc.userId, asset: doc.asset, amount: doc.amount, duplicate: !!res.duplicate } }]);
  }
  return doc;
}

async function tick(network) {
  const cfg = NETWORKS[network];
  if (!cfg || !custody.enabled()) return { skipped: 'disabled' };
  const st = await custody.networkState(network);
  if (st.status !== 'open') return { skipped: st.status };

  const addresses = await DepositAddress.find({ network, status: 'active' }).limit(5000);
  if (!addresses.length) return { scanned: 0 };

  let out;
  if (cfg.family === 'bitcoin') out = await bitcoin.scan(addresses);
  else if (cfg.family === 'evm') out = await evm.scan(addresses, network, st);
  else return { skipped: 'no driver' };

  for (const hit of out.found) {
    try { await record(hit); }
    catch (e) {
      await AuditLog.create([{ actor: 'watcher', action: 'deposit.error', subject: hit.txHash,
        detail: { message: e.message } }]);
    }
  }
  await NetworkState.updateOne({ network },
    { network, lastScanned: out.tip, updatedAt: new Date() }, { upsert: true });
  return { scanned: addresses.length, found: out.found.length, tip: out.tip };
}

let timer = null;
function start() {
  if (timer || !custody.enabled()) return false;
  const chains = Object.keys(NETWORKS).filter(k => custody.KEY_FOR[k]);
  const run = async () => {
    for (const net of chains) {
      try { await tick(net); } catch (e) { /* a chain being down must not stop the others */ }
    }
  };
  timer = setInterval(run, TICK_MS);
  run();
  return true;
}
function stop() { if (timer) clearInterval(timer); timer = null; }

module.exports = { start, stop, tick, record, CONFIRMATIONS, drivers: { bitcoin, evm } };
