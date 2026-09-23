/* ╔══════════════════════════════════════════════════════════════════╗
   ║  ADDRESS TESTS —  node scripts/test-addresses.js                  ║
   ║                                                                   ║
   ║  Deposit and Send accept a pasted wallet address on 24 networks.  ║
   ║  The check is by shape, and a wrong answer either way costs:      ║
   ║                                                                   ║
   ║  · a real address refused — the person can't use the network      ║
   ║  · a wrong-network address accepted — the coins are lost          ║
   ║  · a private key or recovery phrase accepted — it gets saved and  ║
   ║    shown as an "address", and shared, and the wallet is emptied   ║
   ║                                                                   ║
   ║  walletaddr.js is evaluated as the browser runs it.               ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}

function readModule(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', rel), 'utf8');
  const at = src.indexOf('Global bridge');
  return at === -1 ? src : src.slice(0, src.lastIndexOf('/*', at));
}

const store = {};
const ctx = {
  window: {},
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { readyState: 'complete', getElementById: () => null, addEventListener() {} },
  setTimeout: () => 0, console
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readModule('features/walletaddr.js'), ctx);
const WAD = ctx.window.WAD;

const hex = n => '0123456789abcdef'.repeat(8).slice(0, n);
const b32 = (n) => 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'.repeat(4).slice(0, n);   // bech32 alphabet

/* One real-format address per network. */
const GOOD = {
  ethereum: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  base: '0x742d35cc6634c0532925a3b844bc454e4438f44e',
  avalanche: '0x742d35cc6634c0532925a3b844bc454e4438f44e',
  etc: '0x742d35cc6634c0532925a3b844bc454e4438f44e',
  bitcoin: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  solana: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  tron: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  xrpl: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
  dogecoin: 'DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L',
  litecoin: 'ltc1qg42tkwuuxefutzxezdkdel39gfstuap288mfea',
  bitcoincash: 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
  cardano: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x',
  polkadot: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
  ton: 'UQ' + 'Dtdyr7MXUgcVAUUXyabKjc1ZGbEfFhc_wjuL0SbAl6pC_C'.slice(0, 46),
  stellar: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
  near: 'alice.near',
  hedera: '0.0.123456',
  algorand: 'VCMJKWOY5P5P7SKMZFFOCEROPJCZOTIJMNIYNUCKH7LRO45JMJP6UYBIJA',
  tezos: 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb',
  cosmos: 'cosmos1' + b32(38),
  kaspa: 'kaspa:' + b32(61)
};

console.log('\na real address is accepted on its own network');
Object.keys(GOOD).forEach(net => check(net, WAD.validate(net, GOOD[net]).ok, true));

console.log('\nthe same address is refused on another network');
[['tron', GOOD.ethereum], ['ethereum', GOOD.tron], ['solana', GOOD.bitcoin], ['bitcoin', GOOD.litecoin],
 ['litecoin', GOOD.dogecoin], ['stellar', GOOD.algorand], ['cardano', GOOD.cosmos], ['xrpl', GOOD.solana],
 ['polkadot', GOOD.solana], ['near', GOOD.ethereum]].forEach(([net, a]) =>
  check(`${net} refuses a ${a.slice(0, 8)}… address`, WAD.validate(net, a).ok, false));

console.log('\nand says which network it looks like');
[[GOOD.tron, 'tron'], [GOOD.dogecoin, 'dogecoin'], [GOOD.litecoin, 'litecoin'], [GOOD.xrpl, 'xrpl'],
 [GOOD.stellar, 'stellar'], [GOOD.cardano, 'cardano'], [GOOD.solana, 'solana'], [GOOD.kaspa, 'kaspa']]
  .forEach(([a, net]) => check(`${a.slice(0, 10)}… is ${net}`, WAD.detectNets(a)[0], net));
check('an EVM address matches every EVM chain', WAD.detectNets(GOOD.ethereum).length >= 8, true);

console.log('\nsecrets are refused on every network, and never echoed');
const phrase = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
const key = hex(64);
Object.keys(GOOD).forEach(net => {
  const p = WAD.validate(net, phrase), k = WAD.validate(net, key), k0 = WAD.validate(net, '0x' + key);
  check(`${net}: phrase, key and 0x-key all refused`, [p.ok, k.ok, k0.ok].join(), 'false,false,false');
});
const r = WAD.validate('ethereum', phrase);
check('  the refusal is flagged as a secret', r.secret, 'phrase');
check('  and the message does not repeat it', r.msg.indexOf('abandon') === -1, true);
check('  a 64-hex key is not a NEAR account either', WAD.validate('near', key).ok, false);

console.log('\nthe rest');
check('a space inside is refused', WAD.validate('bitcoin', 'bc1q ar0s').ok, false);
check('an empty paste is refused', WAD.validate('bitcoin', '').ok, false);
check('a mixed-case EVM address passes with a checksum warning', !!WAD.validate('ethereum', GOOD.ethereum).warn, true);
check('a wallet link carries the chain id', WAD.walletURI('avalanche', GOOD.avalanche, 'USDT', 0), 'ethereum:' + GOOD.avalanche + '@43114');
check('a Dogecoin link uses its own scheme', WAD.walletURI('dogecoin', GOOD.dogecoin, 'DOGE', 5), 'dogecoin:' + GOOD.dogecoin + '?amount=5');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
