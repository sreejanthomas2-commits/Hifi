/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CRYPTO DEPOSIT CONFIGURATION                                     ║
   ║                                                                   ║
   ║  The authoritative list of assets and networks the deposit flow   ║
   ║  may offer. The browser never decides what is supported: it asks  ║
   ║  /api/crypto for this, so a network can be turned off or put into ║
   ║  maintenance here, on the server, without shipping a new build.   ║
   ║                                                                   ║
   ║  What this file deliberately does NOT contain:                    ║
   ║                                                                   ║
   ║  · Token contract addresses. One wrong character in a contract    ║
   ║    address is somebody's money gone. The sending app already      ║
   ║    knows the contract for the asset it is sending; Trending has   ║
   ║    no business publishing a second copy that could drift. The UI  ║
   ║    tells people to verify the contract where they send from.      ║
   ║                                                                   ║
   ║  · Minimum deposits and fees. Trending is not in the middle of    ║
   ║    these transfers — funds go to the user's own wallet — so there ║
   ║    is no platform minimum to state. The minimum and the fee are   ║
   ║    set by the exchange or wallet doing the sending, and only it   ║
   ║    can quote them honestly.                                       ║
   ║                                                                   ║
   ║  · Confirmation thresholds for crediting. Nothing is credited:    ║
   ║    a deposit lands in the user's own wallet, and the blockchain   ║
   ║    is the record. `finality` below describes how each network     ║
   ║    settles, which is a property of the network, not a promise.    ║
   ║                                                                   ║
   ║  Everything here is a protocol fact (block times, address shapes, ║
   ║  explorers, whether a destination tag exists) or an operational   ║
   ║  switch (`status`).                                               ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

/* status: 'open' | 'paused' | 'maintenance'
   family: decides the address check and the URI scheme a wallet app reads
   blockSeconds: the network's own target block/ledger time
   tagField: set when the network carries an extra routing field         */
const NETWORKS = {
  bitcoin: {
    key: 'bitcoin', code: 'BTC', label: 'Bitcoin', tag: 'Bitcoin network', family: 'bitcoin',
    status: 'open', blockSeconds: 600, color: '#F7931A',
    finality: 'Each confirmation is one more block, roughly every 10 minutes. Your wallet shows the transfer as unconfirmed the moment it is broadcast.',
    explorer: 'https://mempool.space/tx/', addressExplorer: 'https://mempool.space/address/',
    note: 'Very small amounts can be uneconomic to move later, because spending them costs a network fee.'
  },
  ethereum: {
    key: 'ethereum', code: 'ETH', label: 'Ethereum', tag: 'ERC-20', family: 'evm', chainId: 1,
    status: 'open', blockSeconds: 12, color: '#627EEA',
    finality: 'A new block about every 12 seconds; the chain finalises a block after about 13 minutes.',
    explorer: 'https://etherscan.io/tx/', addressExplorer: 'https://etherscan.io/address/',
    note: 'Ethereum fees rise when the network is busy — check the fee where you send from.'
  },
  base: {
    key: 'base', code: 'BASE', label: 'Base', tag: 'Base', family: 'evm', chainId: 8453,
    status: 'open', blockSeconds: 2, color: '#0052FF',
    finality: 'A new block about every 2 seconds. Base settles to Ethereum, so full settlement takes longer than the block.',
    explorer: 'https://basescan.org/tx/', addressExplorer: 'https://basescan.org/address/'
  },
  arbitrum: {
    key: 'arbitrum', code: 'ARB', label: 'Arbitrum One', tag: 'Arbitrum One', family: 'evm', chainId: 42161,
    status: 'open', blockSeconds: 2, color: '#12AAFF',
    finality: 'Transfers appear in seconds. Arbitrum settles to Ethereum, so full settlement takes longer.',
    explorer: 'https://arbiscan.io/tx/', addressExplorer: 'https://arbiscan.io/address/'
  },
  optimism: {
    key: 'optimism', code: 'OP', label: 'OP Mainnet', tag: 'OP Mainnet', family: 'evm', chainId: 10,
    status: 'open', blockSeconds: 2, color: '#FF0420',
    finality: 'Transfers appear in seconds. OP Mainnet settles to Ethereum, so full settlement takes longer.',
    explorer: 'https://optimistic.etherscan.io/tx/', addressExplorer: 'https://optimistic.etherscan.io/address/'
  },
  polygon: {
    key: 'polygon', code: 'POL', label: 'Polygon PoS', tag: 'Polygon PoS', family: 'evm', chainId: 137,
    status: 'open', blockSeconds: 2, color: '#8247E5',
    finality: 'A new block about every 2 seconds.',
    explorer: 'https://polygonscan.com/tx/', addressExplorer: 'https://polygonscan.com/address/'
  },
  bnb: {
    key: 'bnb', code: 'BSC', label: 'BNB Smart Chain', tag: 'BEP-20', family: 'evm', chainId: 56,
    status: 'open', blockSeconds: 3, color: '#F0B90B',
    finality: 'A new block every few seconds.',
    explorer: 'https://bscscan.com/tx/', addressExplorer: 'https://bscscan.com/address/'
  },
  solana: {
    key: 'solana', code: 'SOL', label: 'Solana', tag: 'SPL', family: 'solana',
    status: 'open', blockSeconds: 1, color: '#14F195',
    finality: 'Slots are under a second; a transfer is usually final within about half a minute.',
    explorer: 'https://solscan.io/tx/', addressExplorer: 'https://solscan.io/account/',
    note: 'A wallet receiving an SPL token for the first time needs a token account, which costs a small amount of SOL.'
  },
  tron: {
    key: 'tron', code: 'TRX', label: 'Tron', tag: 'TRC-20', family: 'tron',
    status: 'open', blockSeconds: 3, color: '#EF0027',
    finality: 'A new block every few seconds.',
    explorer: 'https://tronscan.org/#/transaction/', addressExplorer: 'https://tronscan.org/#/address/'
  },
  xrpl: {
    key: 'xrpl', code: 'XRP', label: 'XRP Ledger', tag: 'XRPL', family: 'xrpl',
    status: 'open', blockSeconds: 4, color: '#23292F',
    finality: 'A ledger closes every three to five seconds, and a closed ledger is final.',
    explorer: 'https://livenet.xrpl.org/transactions/', addressExplorer: 'https://livenet.xrpl.org/accounts/',
    tagField: { name: 'Destination tag', hint: 'Exchanges route XRP by destination tag. Your own wallet usually needs none — leave it empty unless the sender asks for one.', required: false },
    note: 'An XRP account must hold a small reserve before it can receive.'
  }
};

/* `wrapped: true` means the asset on that network is a bridged token
   rather than the coin itself — the case that costs people the most
   money, so the UI says it in as many words. */
const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', color: '#F7931A', rank: 1,
    networks: [{ net: 'bitcoin' }] },
  { symbol: 'ETH', name: 'Ethereum', color: '#627EEA', rank: 2,
    networks: [{ net: 'ethereum' }, { net: 'base' }, { net: 'arbitrum' }, { net: 'optimism' }] },
  { symbol: 'USDT', name: 'Tether', color: '#26A17B', rank: 3, token: true,
    networks: [{ net: 'tron' }, { net: 'ethereum' }, { net: 'bnb' }, { net: 'solana' }, { net: 'polygon' }, { net: 'arbitrum' }] },
  { symbol: 'USDC', name: 'USD Coin', color: '#2775CA', rank: 4, token: true,
    networks: [{ net: 'ethereum' }, { net: 'base' }, { net: 'solana' }, { net: 'polygon' }, { net: 'arbitrum' }, { net: 'optimism' }] },
  { symbol: 'BNB', name: 'BNB', color: '#F0B90B', rank: 5,
    networks: [{ net: 'bnb' }] },
  { symbol: 'SOL', name: 'Solana', color: '#14F195', rank: 6,
    networks: [{ net: 'solana' }] },
  { symbol: 'XRP', name: 'XRP', color: '#23292F', rank: 7,
    networks: [{ net: 'xrpl' }] },
  { symbol: 'TRX', name: 'TRON', color: '#EF0027', rank: 8,
    networks: [{ net: 'tron' }] },
  { symbol: 'POL', name: 'Polygon', color: '#8247E5', rank: 9,
    networks: [{ net: 'polygon' }] },
  { symbol: 'DAI', name: 'Dai', color: '#F5AC37', rank: 10, token: true,
    networks: [{ net: 'ethereum' }, { net: 'polygon' }, { net: 'arbitrum' }] },
  { symbol: 'USD1', name: 'USD1', color: '#2E7D32', rank: 11, token: true,
    networks: [{ net: 'bnb' }, { net: 'ethereum' }, { net: 'tron' }] },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', color: '#F09242', rank: 12, token: true,
    networks: [{ net: 'ethereum', wrapped: true }, { net: 'arbitrum', wrapped: true }, { net: 'polygon', wrapped: true }] },
  { symbol: 'LINK', name: 'Chainlink', color: '#2A5ADA', rank: 13, token: true,
    networks: [{ net: 'ethereum' }, { net: 'arbitrum' }, { net: 'polygon' }, { net: 'bnb' }] },
  { symbol: 'UNI', name: 'Uniswap', color: '#FF007A', rank: 14, token: true,
    networks: [{ net: 'ethereum' }, { net: 'arbitrum' }, { net: 'polygon' }, { net: 'optimism' }] },
  { symbol: 'AAVE', name: 'Aave', color: '#B6509E', rank: 15, token: true,
    networks: [{ net: 'ethereum' }, { net: 'polygon' }, { net: 'arbitrum' }] },
  { symbol: 'ARB', name: 'Arbitrum', color: '#12AAFF', rank: 16, token: true,
    networks: [{ net: 'arbitrum' }, { net: 'ethereum' }] },
  { symbol: 'OP', name: 'Optimism', color: '#FF0420', rank: 17, token: true,
    networks: [{ net: 'optimism' }] },
  { symbol: 'CAKE', name: 'PancakeSwap', color: '#D1884F', rank: 18, token: true,
    networks: [{ net: 'bnb' }] },
  { symbol: 'SHIB', name: 'Shiba Inu', color: '#FFA409', rank: 19, token: true,
    networks: [{ net: 'ethereum' }, { net: 'bnb' }] },
  { symbol: 'PEPE', name: 'Pepe', color: '#4C9A2A', rank: 20, token: true,
    networks: [{ net: 'ethereum' }] }
];

/* Bumped whenever the two tables above change, so a client holding an
   older copy can tell that it is behind. */
const VERSION = '2026-09-18.1';

module.exports = { NETWORKS, ASSETS, VERSION };
