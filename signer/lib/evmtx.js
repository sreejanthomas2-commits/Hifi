/* ╔══════════════════════════════════════════════════════════════════╗
   ║  EVM TRANSACTIONS — build and assemble, never sign                ║
   ║                                                                   ║
   ║  This file turns a withdrawal into the exact 32 bytes a hardware  ║
   ║  wallet is asked to sign, and later puts the returned signature   ║
   ║  back together into something broadcastable. The signing itself   ║
   ║  happens on a device this process cannot reach.                   ║
   ║                                                                   ║
   ║  Type-2 (EIP-1559) transactions only. Legacy transactions are     ║
   ║  still accepted by every chain here, but they have no chainId in  ║
   ║  the signed payload unless EIP-155 is applied, and getting that   ║
   ║  wrong means a transaction signed for one chain can be replayed   ║
   ║  on another. Type 2 carries the chain id in the body, so the      ║
   ║  mistake cannot be made.                                          ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const { keccak256 } = require('../../lib/crypto');
const rlp = require('./rlp');

const TYPE = 0x02;

/* ERC-20 transfer(address,uint256) — the first four bytes of
   keccak("transfer(address,uint256)"). Computed, never pasted: a
   mistyped selector calls a different function. */
const TRANSFER_SELECTOR = keccak256('transfer(address,uint256)').slice(0, 4);

function pad32(hexOrBig) {
  const v = typeof hexOrBig === 'bigint' ? hexOrBig : BigInt(hexOrBig);
  return Buffer.from(v.toString(16).padStart(64, '0'), 'hex');
}

/* The calldata for sending a token. For the chain's own coin there is
   none — value carries the amount instead. */
function erc20Transfer(to, amount) {
  const addr = String(to).replace(/^0x/, '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(addr)) throw new Error('bad recipient address');
  return Buffer.concat([
    TRANSFER_SELECTOR,
    Buffer.concat([Buffer.alloc(12), Buffer.from(addr, 'hex')]),
    pad32(BigInt(amount))
  ]);
}

/* The fields, in the order EIP-1559 fixes them. Getting the order wrong
   produces a valid-looking transaction that sends somewhere else. */
function fields(tx) {
  return [
    tx.chainId, tx.nonce, tx.maxPriorityFeePerGas, tx.maxFeePerGas,
    tx.gasLimit, tx.to || '', tx.value || 0n, tx.data || Buffer.alloc(0),
    tx.accessList || []
  ];
}

/* What the device signs: keccak(0x02 || rlp(fields)). */
function unsigned(tx) {
  const payload = Buffer.concat([Buffer.from([TYPE]), rlp.encode(fields(tx))]);
  return { payload, hash: keccak256(payload) };
}

/* The signature comes back as r, s and a parity bit. Nothing here can
   produce one; it can only put one in the right place. */
function assemble(tx, sig) {
  if (!sig || sig.r == null || sig.s == null || sig.yParity == null) {
    throw new Error('a signature needs r, s and yParity');
  }
  const raw = Buffer.concat([
    Buffer.from([TYPE]),
    rlp.encode(fields(tx).concat([
      sig.yParity ? 1n : 0n,
      rlp.toBuf(BigInt(sig.r)),
      rlp.toBuf(BigInt(sig.s))
    ]))
  ]);
  return { raw: '0x' + raw.toString('hex'), hash: '0x' + keccak256(raw).toString('hex') };
}

/* Build the transaction for one withdrawal. Everything it needs is
   supplied by the caller — this file reads no network and no config, so
   what it builds can be checked by eye against the request. */
function build(w) {
  const isToken = !!w.contract;
  const base = {
    chainId: BigInt(w.chainId),
    nonce: BigInt(w.nonce),
    maxPriorityFeePerGas: BigInt(w.priorityFee),
    maxFeePerGas: BigInt(w.maxFee),
    gasLimit: BigInt(w.gasLimit),
    accessList: []
  };
  if (isToken) {
    return { ...base, to: w.contract, value: 0n, data: erc20Transfer(w.to, w.amount) };
  }
  return { ...base, to: w.to, value: BigInt(w.amount), data: Buffer.alloc(0) };
}

/* What a human is asked to compare against the device screen. Anything
   the operator cannot read here, they cannot check there. */
function describe(tx, meta) {
  const gwei = v => (BigInt(v) / 1000000000n).toString();
  return [
    `chain id      ${tx.chainId}`,
    `nonce         ${tx.nonce}`,
    `to            ${tx.to}`,
    `value         ${tx.value} (base units)`,
    `data          ${tx.data && tx.data.length ? '0x' + tx.data.toString('hex') : '(none)'}`,
    `gas limit     ${tx.gasLimit}`,
    `max fee       ${gwei(tx.maxFeePerGas)} gwei`,
    `priority fee  ${gwei(tx.maxPriorityFeePerGas)} gwei`,
    meta && meta.recipient ? `recipient     ${meta.recipient}` : null,
    meta && meta.asset ? `asset         ${meta.asset}` : null
  ].filter(Boolean).join('\n');
}

module.exports = { build, unsigned, assemble, describe, erc20Transfer, TRANSFER_SELECTOR, TYPE };
