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
  },

  /* ── More chains, so the coin list can be the market's, not twenty ──
     Each one is here because a top-250 coin lives on it. Same kind of
     entry as above: protocol facts and an operational switch.        */
  avalanche: {
    key: 'avalanche', code: 'AVAXC', label: 'Avalanche C-Chain', tag: 'C-Chain', family: 'evm', chainId: 43114,
    status: 'open', blockSeconds: 2, color: '#E84142',
    finality: 'Blocks every couple of seconds, final almost at once.',
    explorer: 'https://snowtrace.io/tx/', addressExplorer: 'https://snowtrace.io/address/',
    note: 'The C-Chain uses 0x addresses. Avalanche X-Chain addresses (X-avax…) are a different network.'
  },
  etc: {
    key: 'etc', code: 'ETC', label: 'Ethereum Classic', tag: 'ETC', family: 'evm', chainId: 61,
    status: 'open', blockSeconds: 13, color: '#328332',
    finality: 'A new block about every 13 seconds. Wait for many confirmations on large amounts.',
    explorer: 'https://etc.blockscout.com/tx/', addressExplorer: 'https://etc.blockscout.com/address/',
    note: 'Ethereum Classic is not Ethereum. The address looks the same; the coins are not interchangeable.'
  },
  dogecoin: {
    key: 'dogecoin', code: 'DOGE', label: 'Dogecoin', tag: 'Dogecoin network', family: 'dogecoin',
    status: 'open', blockSeconds: 60, color: '#C2A633',
    finality: 'A new block about every minute.',
    explorer: 'https://blockchair.com/dogecoin/transaction/', addressExplorer: 'https://blockchair.com/dogecoin/address/'
  },
  litecoin: {
    key: 'litecoin', code: 'LTC', label: 'Litecoin', tag: 'Litecoin network', family: 'litecoin',
    status: 'open', blockSeconds: 150, color: '#345D9D',
    finality: 'A new block about every two and a half minutes.',
    explorer: 'https://blockchair.com/litecoin/transaction/', addressExplorer: 'https://blockchair.com/litecoin/address/'
  },
  bitcoincash: {
    key: 'bitcoincash', code: 'BCH', label: 'Bitcoin Cash', tag: 'BCH network', family: 'bitcoincash',
    status: 'open', blockSeconds: 600, color: '#8DC351',
    finality: 'A new block about every 10 minutes.',
    explorer: 'https://blockchair.com/bitcoin-cash/transaction/', addressExplorer: 'https://blockchair.com/bitcoin-cash/address/',
    note: 'Bitcoin Cash is not Bitcoin. Sending BTC to a BCH address, or the reverse, loses it.'
  },
  cardano: {
    key: 'cardano', code: 'ADA', label: 'Cardano', tag: 'Cardano', family: 'cardano',
    status: 'open', blockSeconds: 20, color: '#0033AD',
    finality: 'A new block about every 20 seconds.',
    explorer: 'https://cardanoscan.io/transaction/', addressExplorer: 'https://cardanoscan.io/address/'
  },
  polkadot: {
    key: 'polkadot', code: 'DOT', label: 'Polkadot', tag: 'Polkadot relay chain', family: 'polkadot',
    status: 'open', blockSeconds: 6, color: '#E6007A',
    finality: 'A new block every 6 seconds; final within about a minute.',
    explorer: 'https://polkadot.subscan.io/extrinsic/', addressExplorer: 'https://polkadot.subscan.io/account/',
    note: 'A Polkadot account must hold a small existential deposit to exist.'
  },
  ton: {
    key: 'ton', code: 'TON', label: 'TON', tag: 'The Open Network', family: 'ton',
    status: 'open', blockSeconds: 5, color: '#0098EA',
    finality: 'Blocks every few seconds.',
    explorer: 'https://tonviewer.com/transaction/', addressExplorer: 'https://tonviewer.com/',
    tagField: { name: 'Comment', hint: 'Exchanges route TON by a comment. Your own wallet needs none — leave it empty unless the sender asks for one.', required: false }
  },
  stellar: {
    key: 'stellar', code: 'XLM', label: 'Stellar', tag: 'Stellar network', family: 'stellar',
    status: 'open', blockSeconds: 5, color: '#14B6E7',
    finality: 'A ledger closes every five seconds, and a closed ledger is final.',
    explorer: 'https://stellar.expert/explorer/public/tx/', addressExplorer: 'https://stellar.expert/explorer/public/account/',
    tagField: { name: 'Memo', hint: 'Exchanges route XLM by memo. Your own wallet needs none — leave it empty unless the sender asks for one.', required: false },
    note: 'A Stellar account needs a small XLM reserve, and a trustline before it can hold a token.'
  },
  near: {
    key: 'near', code: 'NEAR', label: 'NEAR Protocol', tag: 'NEAR', family: 'near',
    status: 'open', blockSeconds: 1, color: '#00C08B',
    finality: 'About a second a block; final within a few seconds.',
    explorer: 'https://nearblocks.io/txns/', addressExplorer: 'https://nearblocks.io/address/'
  },
  hedera: {
    key: 'hedera', code: 'HBAR', label: 'Hedera', tag: 'Hedera', family: 'hedera',
    status: 'open', blockSeconds: 3, color: '#3C3C3C',
    finality: 'Final in a few seconds.',
    explorer: 'https://hashscan.io/mainnet/transaction/', addressExplorer: 'https://hashscan.io/mainnet/account/',
    tagField: { name: 'Memo', hint: 'Exchanges route HBAR by memo. Your own wallet needs none — leave it empty unless the sender asks for one.', required: false }
  },
  algorand: {
    key: 'algorand', code: 'ALGO', label: 'Algorand', tag: 'Algorand', family: 'algorand',
    status: 'open', blockSeconds: 3, color: '#4A4A4A',
    finality: 'A block about every three seconds, final when it lands.',
    explorer: 'https://allo.info/tx/', addressExplorer: 'https://allo.info/account/',
    note: 'An Algorand account must opt in to a token before it can receive it.'
  },
  tezos: {
    key: 'tezos', code: 'XTZ', label: 'Tezos', tag: 'Tezos', family: 'tezos',
    status: 'open', blockSeconds: 10, color: '#2C7DF7',
    finality: 'A block about every ten seconds.',
    explorer: 'https://tzkt.io/', addressExplorer: 'https://tzkt.io/'
  },
  cosmos: {
    key: 'cosmos', code: 'ATOM', label: 'Cosmos Hub', tag: 'Cosmos', family: 'cosmos',
    status: 'open', blockSeconds: 6, color: '#2E3148',
    finality: 'A block about every six seconds, final when it lands.',
    explorer: 'https://www.mintscan.io/cosmos/tx/', addressExplorer: 'https://www.mintscan.io/cosmos/address/',
    tagField: { name: 'Memo', hint: 'Exchanges route ATOM by memo. Your own wallet needs none — leave it empty unless the sender asks for one.', required: false }
  },
  kaspa: {
    key: 'kaspa', code: 'KAS', label: 'Kaspa', tag: 'Kaspa', family: 'kaspa',
    status: 'open', blockSeconds: 1, color: '#49EACB',
    finality: 'Several blocks a second.',
    explorer: 'https://explorer.kaspa.org/txs/', addressExplorer: 'https://explorer.kaspa.org/addresses/'
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

/* The coin each network pays its own fees in - a protocol fact, and not
   the same thing as the network's `code`. Arbitrum's code is ARB, but ARB
   is a token there; the coin that moves in a plain transfer is ETH, as it
   is on Base and OP Mainnet. Anything that decides what arrived or what
   is being sent reads this table, never the code. */
const NATIVE_ASSET = {
  bitcoin: 'BTC', ethereum: 'ETH', base: 'ETH', arbitrum: 'ETH', optimism: 'ETH',
  polygon: 'POL', bnb: 'BNB', solana: 'SOL', tron: 'TRX', xrpl: 'XRP',
  avalanche: 'AVAX', etc: 'ETC', dogecoin: 'DOGE', litecoin: 'LTC', bitcoincash: 'BCH',
  cardano: 'ADA', polkadot: 'DOT', ton: 'TON', stellar: 'XLM', near: 'NEAR',
  hedera: 'HBAR', algorand: 'ALGO', tezos: 'XTZ', cosmos: 'ATOM', kaspa: 'KAS'
};

/* Bumped whenever the two tables above change, so a client holding an
   older copy can tell that it is behind. */
const VERSION = '2026-09-18.1';

module.exports = { NETWORKS, ASSETS, NATIVE_ASSET, VERSION };
