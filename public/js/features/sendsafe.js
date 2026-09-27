/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SEND SAFETY — the rules every crypto send is checked against     ║
   ║                                                                   ║
   ║  One place for the things that lose people money when sending     ║
   ║  crypto, so the Send screen, the chat wallet and Pay all apply    ║
   ║  the same ones:                                                   ║
   ║                                                                   ║
   ║   amounts     read exactly as typed, or refused. "1,5" is not 15, ║
   ║               "1e3" is not 1000, and no more decimals than the    ║
   ║               coin has on that network (USDT: 6 on Ethereum, 18   ║
   ║               on BNB Chain). Kept as text and whole units, never  ║
   ║               as a float, so 0.1 + 0.2 stays 0.3.                 ║
   ║   links       the "open in wallet" link carries the exact amount  ║
   ║               in the format each wallet standard defines (EIP-681 ║
   ║               wei, BIP-21 decimals, Solana Pay). A TOKEN send     ║
   ║               gets no link: without the contract address, which   ║
   ║               Trending deliberately doesn't publish, the link     ║
   ║               would open a send of the chain's own coin instead.  ║
   ║   the fee     a token is sent, but the fee is paid in the chain's ║
   ║               own coin - said before the wallet refuses for it.   ║
   ║   memos       XRP, Stellar, TON, Cosmos and Hedera exchanges      ║
   ║               route deposits by tag or memo; its format is        ║
   ║               checked, and leaving it empty must be confirmed.    ║
   ║   minimums    Bitcoin dust, the XRP / Stellar reserve a new       ║
   ║               account needs, Solana rent.                         ║
   ║   look-alikes address poisoning: an address that matches one you  ║
   ║               used at both ends but not in the middle.            ║
   ║   repeats     the same send prepared twice.                       ║
   ║   secrets     recovery phrases and private keys in their common   ║
   ║               pasted forms (numbered, comma-separated, Solana     ║
   ║               base58 or byte array, Stellar S…, xprv/zprv…).      ║
   ║                                                                   ║
   ║  Pure functions: nothing here touches the page, storage or the    ║
   ║  network. scripts/test-send.js drives every rule.                 ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const SSF = (() => {

  /* ── Coins and their decimals ────────────────────────────────────── */
  // The coin each network charges its fee in.
  const GAS = {
    ethereum: 'ETH', base: 'ETH', arbitrum: 'ETH', optimism: 'ETH', polygon: 'POL', bnb: 'BNB', avalanche: 'AVAX',
    etc: 'ETC', bitcoin: 'BTC', solana: 'SOL', tron: 'TRX', xrpl: 'XRP', dogecoin: 'DOGE', litecoin: 'LTC',
    bitcoincash: 'BCH', cardano: 'ADA', polkadot: 'DOT', ton: 'TON', stellar: 'XLM', near: 'NEAR',
    hedera: 'HBAR', algorand: 'ALGO', tezos: 'XTZ', cosmos: 'ATOM', kaspa: 'KAS'
  };
  // Each network's own coin, in its smallest unit.
  const NATIVE = {
    ethereum: 18, base: 18, arbitrum: 18, optimism: 18, polygon: 18, bnb: 18, avalanche: 18, etc: 18,
    bitcoin: 8, litecoin: 8, dogecoin: 8, bitcoincash: 8, kaspa: 8, hedera: 8,
    solana: 9, ton: 9, tron: 6, xrpl: 6, cardano: 6, algorand: 6, tezos: 6, cosmos: 6,
    polkadot: 10, stellar: 7, near: 24
  };
  /* Tokens whose decimals differ by network. The same "USDT" is 6
     decimals on Ethereum and 18 on BNB Chain; typing 7 decimals of USDT
     on Ethereum asks for a fraction that does not exist. */
  const TOKEN = {
    USDT: { ethereum: 6, tron: 6, solana: 6, polygon: 6, arbitrum: 6, optimism: 6, avalanche: 6, ton: 6, near: 6, bnb: 18 },
    USDC: { ethereum: 6, base: 6, arbitrum: 6, optimism: 6, polygon: 6, solana: 6, avalanche: 6, algorand: 6, hedera: 6, near: 6, stellar: 7, bnb: 18 },
    DAI: { ethereum: 18, base: 18, arbitrum: 18, optimism: 18, polygon: 18, bnb: 18, avalanche: 18 },
    WBTC: { ethereum: 8, arbitrum: 8, optimism: 8, polygon: 8, avalanche: 8, base: 8 }
  };
  const STABLE = ['USDT', 'USDC', 'DAI', 'USD1', 'FDUSD', 'PYUSD'];
  const sym_ = s => String(s == null ? '' : s).toUpperCase().trim();

  const isNative = (asset, net) => !!GAS[net] && GAS[net] === sym_(asset);
  const isToken = (asset, net) => !!GAS[net] && GAS[net] !== sym_(asset);

  /* Decimals for this coin on this network. With no network (paper money
     inside Trending), 6 for dollar coins and 8 for everything else - the
     precision Pay and chat show. */
  function decimalsFor(asset, net) {
    const a = sym_(asset);
    if (net && isNative(a, net)) return NATIVE[net];
    if (net && TOKEN[a] && TOKEN[a][net] != null) return TOKEN[a][net];
    return STABLE.indexOf(a) > -1 ? 6 : 8;
  }

  /* ── Amounts ─────────────────────────────────────────────────────── */
  function formatUnits(units, decimals) {
    const neg = units < 0n, u = neg ? -units : units;
    const base = 10n ** BigInt(decimals);
    const frac = decimals ? (u % base).toString().padStart(decimals, '0').replace(/0+$/, '') : '';
    return (neg ? '-' : '') + (u / base).toString() + (frac ? '.' + frac : '');
  }

  /* Exactly what was typed, or a reason it can't be. Returns
     { ok, text, units, number } - `text` is the canonical decimal
     ("0.5", never "5e-1"), `units` the whole-unit BigInt. */
  function parseAmount(raw, decimals, asset) {
    const d = Number.isInteger(decimals) ? decimals : 8;
    /* A number handed in by code (not typed) is read to 15 significant
       digits, which is all a float holds - so 0.1 + 0.2 arrives as 0.3,
       not as 0.30000000000000004 and 44 extra wei. */
    const plain = n => { const p = n.toPrecision(15); return /e/i.test(p) ? n.toFixed(Math.min(20, d)) : p; };
    const s = typeof raw === 'number'
      ? (Number.isFinite(raw) && raw >= 0 ? plain(raw).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : '')
      : String(raw == null ? '' : raw).trim();
    const name = asset ? sym_(asset) : 'This coin';
    if (!s) return { ok: false, empty: true, msg: 'Enter an amount.' };
    if (/,/.test(s)) return { ok: false, msg: 'Use a point for decimals (1.5), with no thousands separators.' };
    if (!/^\d*\.?\d*$/.test(s) || s === '.') return { ok: false, msg: 'Enter the amount as plain digits, like 25 or 0.015.' };
    const [whole, frac = ''] = s.split('.');
    const f = frac;
    if (f.length > d) {
      return { ok: false, msg: d === 0 ? `${name} can't be split into fractions here.` : `${name} has ${d} decimal places on this network; this amount has ${f.length}. Round it to ${d}.` };
    }
    if ((whole || '').replace(/^0+/, '').length > 15) return { ok: false, msg: 'That amount is too large.' };
    const units = BigInt(whole || '0') * 10n ** BigInt(d) + BigInt((f + '0'.repeat(d)).slice(0, d) || '0');
    if (units === 0n) return { ok: false, zero: true, msg: 'The amount must be more than zero.' };
    const text = formatUnits(units, d);
    return { ok: true, text, units, number: Number(text), decimals: d };
  }

  /* ── The "open in wallet" link ───────────────────────────────────── */
  const CHAIN = { ethereum: 1, base: 8453, arbitrum: 42161, optimism: 10, polygon: 137, bnb: 56, avalanche: 43114, etc: 61 };
  const FAMILY_OF = net => (CHAIN[net] ? 'evm' : net);
  /* EIP-681 for EVM chains, with the chain id so the wallet switches to
     the right network, and the value in wei as an integer. BIP-21 style
     for the Bitcoin family, Solana Pay for Solana - both plain decimals.
     A token, or a network with no standard link, gets the bare address:
     the person pastes it and picks the coin themselves. */
  function walletURI(net, address, asset, amount) {
    const a = String(address || '');
    if (!a || isToken(asset, net)) return a;
    const amt = amount === '' || amount == null ? null : parseAmount(amount, NATIVE[net] != null ? NATIVE[net] : 8, asset);
    const good = amt && amt.ok ? amt : null;
    if (CHAIN[net]) return `ethereum:${a}@${CHAIN[net]}` + (good ? `?value=${good.units.toString()}` : '');
    if (net === 'bitcoin' || net === 'litecoin' || net === 'dogecoin') return `${net}:${a}` + (good ? `?amount=${good.text}` : '');
    if (net === 'bitcoincash') return (a.indexOf(':') > -1 ? a : `bitcoincash:${a}`) + (good ? `?amount=${good.text}` : '');
    if (net === 'solana') return `solana:${a}` + (good ? `?amount=${good.text}` : '');
    return a;
  }

  /* ── The fee coin ────────────────────────────────────────────────── */
  function feeCoinNote(asset, net) {
    if (!isToken(asset, net)) return '';
    const g = GAS[net], a = sym_(asset);
    if (net === 'tron') return `The network fee is paid in TRX, not ${a}. Your wallet needs some TRX too (a token send on Tron can burn several TRX), or it will refuse.`;
    if (net === 'solana') return `The network fee is paid in SOL, not ${a}. Keep a little SOL in your wallet, plus about 0.002 SOL if the receiver has never held ${a} (it opens their token account).`;
    return `The network fee is paid in ${g}, not ${a}. Your wallet needs some ${g} on ${label(net)} too, or it will refuse with "insufficient funds for gas".`;
  }
  const LABELS = { ethereum: 'Ethereum', base: 'Base', arbitrum: 'Arbitrum', optimism: 'Optimism', polygon: 'Polygon', bnb: 'BNB Chain', avalanche: 'Avalanche', etc: 'Ethereum Classic', tron: 'Tron', solana: 'Solana' };
  const label = net => LABELS[net] || net;

  /* ── Tags and memos ──────────────────────────────────────────────── */
  const TAGGED = { xrpl: 'destination tag', stellar: 'memo', ton: 'comment', cosmos: 'memo', hedera: 'memo' };
  const bytes = s => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : unescape(encodeURIComponent(s)).length);
  function checkTag(net, raw) {
    const t = String(raw == null ? '' : raw).trim();
    if (!t) return { ok: true, empty: true };
    if (/[\u0000-\u001F\u007F]/.test(t)) return { ok: false, msg: 'The memo contains characters that cannot be sent.' };
    if (net === 'xrpl') {
      return /^\d{1,10}$/.test(t) && Number(t) <= 4294967295 ? { ok: true, text: String(Number(t)) }
        : { ok: false, msg: 'An XRP destination tag is a whole number, from 0 to 4294967295. Copy it again from the exchange.' };
    }
    if (net === 'stellar' && !/^\d+$/.test(t) && bytes(t) > 28) return { ok: false, msg: 'A Stellar text memo can be at most 28 bytes.' };
    if (net === 'hedera' && bytes(t) > 100) return { ok: false, msg: 'A Hedera memo can be at most 100 bytes.' };
    if (net === 'cosmos' && t.length > 256) return { ok: false, msg: 'A Cosmos memo can be at most 256 characters.' };
    if (net === 'ton' && bytes(t) > 120) return { ok: false, msg: 'Keep a TON comment under 120 bytes.' };
    return { ok: true, text: t };
  }
  const needsTagChoice = net => !!TAGGED[net];
  const tagName = net => TAGGED[net] || 'memo';

  /* ── Network minimums ────────────────────────────────────────────── */
  /* { refuse } when the network itself will reject the send, { warn }
     when it depends on something Trending can't see (whether the
     receiving account already exists). */
  function minimum(asset, net, amount, addr) {
    if (!amount || !amount.ok || !isNative(asset, net)) return {};
    const u = amount.units;
    if (net === 'bitcoin') {
      const dust = BigInt((addr && addr.dustSats) || 546);
      if (u < dust) return { refuse: `Bitcoin nodes won't relay an output this small. The minimum to this kind of address is ${formatUnits(dust, 8)} BTC (${dust} sats).` };
      if (u < 10000n) return { warn: 'An amount this small can cost more in fees to spend later than it is worth.' };
    }
    if (net === 'xrpl' && u < 1000000n) return { warn: 'If the receiving XRP account is new, the XRP Ledger needs at least 1 XRP to create it, and a smaller send fails. Exchanges and wallets you already use are not affected.' };
    if (net === 'stellar' && u < 10000000n) return { warn: 'If the receiving Stellar account is new, it needs at least 1 XLM to exist, and a smaller send fails.' };
    if (net === 'solana' && u < 890880n) return { warn: 'A new Solana account needs about 0.00089 SOL to exist. Less than that to an empty address fails.' };
    return {};
  }

  /* ── Address poisoning ───────────────────────────────────────────── */
  /* Attackers send you a tiny transfer from an address that starts and
     ends like one you use, hoping you copy it from your history next
     time. Match: same length, same first 4 and last 4 characters after
     the prefix, different in between. */
  const PREFIX = /^(0x|bc1[qp]|ltc1q|bitcoincash:[qp]|kaspa:q|cosmos1|addr1|tz[1-4]|KT1|[TrLMDEU]Q|[TrLMD13G])/;
  const norm = (a, net) => (FAMILY_OF(net) === 'evm' ? String(a).toLowerCase() : String(a));
  function lookalike(address, known, net) {
    const a = norm(address, net);
    const body = a.replace(PREFIX, '');
    if (body.length < 12) return null;
    for (const k of known || []) {
      const kk = norm(k, net);
      if (!kk || kk === a || kk.length !== a.length) continue;
      const kb = kk.replace(PREFIX, '');
      if (kb.slice(0, 4) === body.slice(0, 4) && kb.slice(-4) === body.slice(-4)) return k;
    }
    return null;
  }

  /* ── The same send, twice ────────────────────────────────────────── */
  function repeatOf(records, draft, now, windowMs) {
    const t = now || Date.now(), w = windowMs || 24 * 60 * 60 * 1000;
    return (records || []).find(r => r && r.status !== 'cancelled' && r.asset === draft.asset && r.net === draft.net &&
      norm(r.to, r.net) === norm(draft.to, draft.net) && String(r.amountText || r.amount) === String(draft.amountText) &&
      t - (r.at || 0) < w) || null;
  }

  /* ── Secrets ─────────────────────────────────────────────────────── */
  const b58len = s => (typeof ADDR !== 'undefined' && ADDR.b58decode ? (ADDR.b58decode(s) || []).length : 0);
  function secretKind(raw) {
    const t = String(raw == null ? '' : raw).trim();
    if (!t) return '';
    // A phrase, however it was copied: numbered, comma- or line-separated.
    const words = t.replace(/(^|\s)\d{1,2}[.):]?(?=\s|$)/g, ' ').replace(/(^|\s)\d{1,2}[.):](?=[A-Za-z])/g, ' ')
      .split(/[\s,;|]+/).filter(Boolean);
    if (words.length >= 11 && words.length <= 25 && words.every(w => /^[A-Za-z]{3,9}$/.test(w))) return 'phrase';
    if (/^(0x)?[0-9a-fA-F]{64}$/.test(t)) return 'key';                                  // raw 32-byte key
    if (/^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(t)) return 'key';                       // Bitcoin WIF
    if (/^[xyzuvt]prv[1-9A-HJ-NP-Za-km-z]{100,}$/.test(t) || /^xprv1[02-9ac-hj-np-z]{50,}$/.test(t)) return 'key'; // extended keys
    if (/^S[A-Z2-7]{55}$/.test(t)) return 'key';                                          // Stellar secret seed
    if (/^[1-9A-HJ-NP-Za-km-z]{85,90}$/.test(t) && b58len(t) === 64) return 'key';        // Solana secret key (base58)
    if (/^\[\s*\d{1,3}(\s*,\s*\d{1,3}){63}\s*\]$/.test(t)) return 'key';                  // Solana keypair file
    return '';
  }

  return {
    GAS, NATIVE, TOKEN, decimalsFor, isNative, isToken, formatUnits, parseAmount, walletURI,
    feeCoinNote, checkTag, needsTagChoice, tagName, minimum, lookalike, repeatOf, secretKind
  };
})();

window.SSF = SSF;

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module, so its top-level names are private to it.
   Other modules look SSF up on the global object. */
import { publish } from '../globals.js?v=3';
publish('features/sendsafe.js', {
  SSF: () => SSF
});
