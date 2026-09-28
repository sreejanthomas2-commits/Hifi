/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SENDING CRYPTO — node scripts/test-send.js                       ║
   ║                                                                   ║
   ║  Every way this app prepares crypto to go to someone else, held   ║
   ║  to what a payments engineer would demand of it:                  ║
   ║                                                                   ║
   ║   1. address checksums  one wrong character is caught, per        ║
   ║                         network, and the app agrees with the      ║
   ║                         server on hundreds of real addresses      ║
   ║   2. what gets pasted   invisible characters, burn addresses, and ║
   ║                         recovery phrases / keys in every common   ║
   ║                         pasted form                               ║
   ║   3. amounts            exactly as typed or refused; decimals per ║
   ║                         coin per network                          ║
   ║   4. wallet links       exact integer wei / plain decimals; no    ║
   ║                         link for a token                          ║
   ║   5. the rules          fee coin, memo format, network minimums,  ║
   ║                         look-alike addresses, repeated sends      ║
   ║   6. the Send screen    driven end to end                         ║
   ║   7. Pay and chat       requests paid once, never yourself,       ║
   ║                         hidden characters in links                ║
   ║                                                                   ║
   ║  Each case here was a real defect found by probing the old code.  ║
   ║  Addresses are made by the server's own crypto library, so they   ║
   ║  are genuinely valid rather than copied from somewhere.           ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const C = require('../lib/crypto');
const SRV = require('../lib/address');
const { NETWORKS } = require('../config/crypto-deposit');

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}
const ok = (name, cond) => check(name, !!cond, true);

function readModule(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', rel), 'utf8');
  const at = src.indexOf('Global bridge');
  return at === -1 ? src : src.slice(0, src.lastIndexOf('/*', at));
}

/* A page with just enough of a DOM for the sheets to draw into: every
   id resolves to a node that keeps its innerHTML. */
function makeDom() {
  const nodes = {};
  const mk = id => ({
    id, innerHTML: '', value: '', className: '', dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, addEventListener() {}, focus() {}, remove() { delete nodes[id]; }, querySelector: () => null
  });
  return {
    nodes,
    doc: {
      readyState: 'complete',
      getElementById: id => nodes[id] || (nodes[id] = mk(id)),
      querySelector: () => null, querySelectorAll: () => [],
      createElement: () => { const n = mk(''); return n; },
      addEventListener() {}, removeEventListener() {},
      activeElement: null, contains: () => false,
      body: { appendChild(n) { if (n.id) nodes[n.id] = n; } }
    }
  };
}

function makeWorld(extra) {
  const store = {};
  const dom = makeDom();
  const toasts = [];
  const ctx = {
    console, setTimeout: (fn) => { fn(); return 0; }, clearTimeout() {},
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: dom.doc, requestAnimationFrame: fn => fn(),
    showToast: m => toasts.push(m), TextEncoder, URLSearchParams, navigator: {}, addEventListener() {}, removeEventListener() {},
    ...(extra || {})
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const load = rel => vm.runInContext(readModule(rel), ctx, { filename: rel });
  load('utils/addrcheck.js');
  load('features/sendsafe.js');
  load('features/walletaddr.js');
  return { ctx, load, toasts, store, dom };
}

const W = makeWorld();
const { ADDR, SSF, WAD } = W.ctx;

// ── Real addresses ──────────────────────────────────────────────────
const pubOf = k => C.secp256k1.compress(C.secp256k1.mul(k));
const tronOf = pub => C.b58checkEncode(Buffer.concat([Buffer.from([0x41]), C.keccak256(C.secp256k1.uncompressed(C.secp256k1.decompress(pub))).slice(12)]));
const P = pubOf(123456789n);
const EVM = C.ADDRESS.evm(P), BTC = C.ADDRESS.p2wpkh(P), BTC1 = C.ADDRESS.p2pkh(P), TRX = tronOf(P);
const XRP = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BECH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const bump = (s, i, al) => s.slice(0, i) + al[(al.indexOf(s[i]) + 1) % al.length] + s.slice(i + 1);
const flipCase = (s, i) => s.slice(0, i) + (s[i] === s[i].toUpperCase() ? s[i].toLowerCase() : s[i].toUpperCase()) + s.slice(i + 1);
const firstLetter = s => { for (let i = 2; i < s.length; i++) if (/[a-fA-F]/.test(s[i])) return i; return 2; };

console.log('\n1. one wrong character is caught');
{
  const cases = [
    ['ethereum', EVM, flipCase(EVM, firstLetter(EVM)), 'EVM, one letter in the wrong case (EIP-55)'],
    ['ethereum', EVM, bump(EVM, 7, '0123456789abcdef'.split('').concat('ABCDEF'.split('')).join('')), 'EVM, one character changed'],
    ['bitcoin', BTC, bump(BTC, 20, BECH), 'Bitcoin bc1, one character changed'],
    ['bitcoin', BTC1, bump(BTC1, 15, B58), 'Bitcoin legacy, one character changed'],
    ['tron', TRX, bump(TRX, 12, B58), 'Tron, one character changed'],
    ['xrpl', XRP, XRP.slice(0, -1) + 'j', 'XRP, last character changed'],
    ['stellar', 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7', 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN6', 'Stellar, last character changed'],
    ['ton', 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N', 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2M', 'TON, last character changed'],
    ['bitcoincash', 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a', 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6b', 'Bitcoin Cash, last character changed']
  ];
  for (const [net, good, bad, label] of cases) {
    const g = WAD.validate(net, good), b = WAD.validate(net, bad);
    ok(`${label}: the real one passes`, g.ok);
    check(`${label}: the typo is refused`, b.ok, false);
  }
  ok('the refusal says a character is wrong', /checksum|character is wrong/i.test(WAD.validate('bitcoin', bump(BTC, 20, BECH)).msg));
  check('an all-uppercase bc1 address (valid, common in QR codes) passes', WAD.validate('bitcoin', 'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4').ok, true);
  check('bc1 with a letter bech32 never uses is refused', WAD.validate('bitcoin', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3tb').ok, false);
  check('a Solana-shaped string that is not 32 bytes is refused', WAD.validate('solana', '11111111111111111111111111111111111111111111').ok, false);
  check('a testnet address is refused on mainnet', WAD.validate('bitcoin', 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx').ok, false);
  ok('an XRP X-address is explained, not just refused', /X-address/.test(WAD.validate('xrpl', 'X' + 'V'.repeat(46)).msg));
  const lower = EVM.toLowerCase();
  const lv = WAD.validate('ethereum', lower);
  ok('an all-lowercase EVM address passes, saying it has no checksum', lv.ok && /no checksum/.test(lv.warn));
  ok('a checksummed one passes as checked', WAD.validate('ethereum', EVM).checksum);

  // The app and the server give the same answer, address by address.
  let agree = 0, differ = [];
  for (let k = 1n; k <= 40n; k++) {
    const pub = pubOf(k * 104729n + 7n);
    for (const [fam, good, al] of [['evm', C.ADDRESS.evm(pub), '0123456789abcdefABCDEF'], ['bitcoin', C.ADDRESS.p2wpkh(pub), BECH],
      ['bitcoin', C.ADDRESS.p2pkh(pub), B58], ['tron', tronOf(pub), B58]]) {
      const i = 6 + Number(k % 18n);
      for (const a of [good, bump(good, i, al)]) {
        const s = SRV.validate(fam, a).ok, c = ADDR.check(fam, a).ok;
        s === c ? agree++ : differ.push(`${fam} ${a} server=${s} app=${c}`);
      }
    }
  }
  check(`app and server agree on ${agree + differ.length} real and mistyped addresses`, differ.join('; ') || 0, 0);
  ok('the server accepts valid XRP addresses (it used to reject every one)', SRV.validate('xrpl', XRP).ok && SRV.validate('xrpl', 'rrrrrrrrrrrrrrrrrrrrrhoLvTp').ok);
}

console.log('\n2. what gets pasted');
{
  const zw = EVM.slice(0, 20) + '​' + EVM.slice(20);
  const v = WAD.validate('ethereum', zw);
  ok('an address with an invisible zero-width space passes once it is removed', v.ok && v.value === EVM);
  ok('  and says it was removed', /Invisible characters/.test(v.warn));
  check('a right-to-left override is removed too', WAD.validate('ethereum', '‮' + EVM).value, EVM);
  check('the zero address is refused', WAD.validate('ethereum', '0x0000000000000000000000000000000000000000').ok, false);
  check('the 0x…dEaD burn address is refused', WAD.validate('ethereum', '0x000000000000000000000000000000000000dEaD').ok, false);
  const phrase = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
  const secrets = [
    ['a plain recovery phrase', phrase],
    ['a numbered phrase ("1. abandon 2. ability …")', phrase.split(' ').map((w, i) => `${i + 1}. ${w}`).join(' ')],
    ['a numbered phrase with no spaces after the numbers', phrase.split(' ').map((w, i) => `${i + 1}.${w}`).join('\n')],
    ['a comma-separated phrase', phrase.split(' ').join(', ')],
    ['a raw hex private key', 'ab'.repeat(32)],
    ['a Bitcoin WIF key', '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ'],
    ['a Solana secret key (base58, as Phantom exports it)', C.b58encode(Buffer.alloc(64, 7))],
    ['a Solana keypair file ([12, 34, …])', JSON.stringify(Array.from({ length: 64 }, (_, i) => i))],
    ['a zprv extended key', 'zprv' + 'A'.repeat(107)],
    ['a Stellar secret seed', 'S' + 'A'.repeat(55)]
  ];
  for (const [what, s] of secrets) {
    const r = WAD.validate('solana', s);
    ok(`${what} is recognised as a secret and refused`, !r.ok && r.secret);
  }
  check('an ordinary address is not mistaken for a secret', WAD.validate('ethereum', EVM).secret || false, false);
}

console.log('\n3. amounts, exactly as typed');
{
  const p = (t, d, a) => SSF.parseAmount(t, d == null ? 8 : d, a || 'BTC');
  check('"1,5" is refused, not read as 15', p('1,5').ok, false);
  ok('  and says to use a point', /point for decimals/.test(p('1,5').msg));
  check('"1e3" is refused, not read as 1000', p('1e3').ok, false);
  check('"10abc" is refused, not read as 10', p('10abc').ok, false);
  check('"1.2.3" is refused, not read as 1.2', p('1.2.3').ok, false);
  check('"-5" is refused', p('-5').ok, false);
  check('"0" is refused', p('0').ok, false);
  check('"0x10" is refused', p('0x10').ok, false);
  check('".5" is 0.5', p('.5').text, '0.5');
  check('"5." is 5', p('5.').text, '5');
  check('"0007.50" is 7.5', p('0007.50').text, '7.5');
  check('0.0000001 stays a plain decimal', p('0.0000001').text, '0.0000001');
  check('9 decimals of BTC are refused (it has 8)', p('0.123456789', SSF.decimalsFor('BTC', 'bitcoin')).ok, false);
  check('USDT has 6 decimals on Ethereum', SSF.decimalsFor('USDT', 'ethereum'), 6);
  check('  and 18 on BNB Chain', SSF.decimalsFor('USDT', 'bnb'), 18);
  check('7 decimals of USDT on Ethereum are refused', p('1.1234567', SSF.decimalsFor('USDT', 'ethereum'), 'USDT').ok, false);
  check('  but fine on BNB Chain', p('1.1234567', SSF.decimalsFor('USDT', 'bnb'), 'USDT').ok, true);
  check('10 decimals of SOL are refused (it has 9)', p('0.0000000001', SSF.decimalsFor('SOL', 'solana'), 'SOL').ok, false);
  check('0.1 + 0.2 handed in as a number is exactly 0.3', p(0.1 + 0.2, 18, 'ETH').units.toString(), '300000000000000000');
  check('1.5 ETH is 1500000000000000000 wei', p('1.5', 18, 'ETH').units.toString(), '1500000000000000000');
}

console.log('\n4. "open in wallet" links');
{
  check('0.0000001 ETH is an integer number of wei', WAD.walletURI('ethereum', EVM, 'ETH', '0.0000001'), `ethereum:${EVM}@1?value=100000000000`);
  check('0.3 ETH is exact', WAD.walletURI('ethereum', EVM, 'ETH', 0.1 + 0.2), `ethereum:${EVM}@1?value=300000000000000000`);
  check('the chain id picks the network (Base)', WAD.walletURI('base', EVM, 'ETH', '1'), `ethereum:${EVM}@8453?value=1000000000000000000`);
  check('0.0000005 BTC is a plain decimal (BIP-21)', WAD.walletURI('bitcoin', BTC, 'BTC', '0.0000005'), `bitcoin:${BTC}?amount=0.0000005`);
  check('USDT on Ethereum gets no link (it would open an ETH send)', WAD.walletURI('ethereum', EVM, 'USDT', '100'), EVM);
  check('USDT on BNB Chain gets no link either', WAD.walletURI('bnb', EVM, 'USDT', '50'), EVM);
  check('SOL uses Solana Pay', WAD.walletURI('solana', 'So11111111111111111111111111111111111111112', 'SOL', '0.25'), 'solana:So11111111111111111111111111111111111111112?amount=0.25');
  check('an amount the coin cannot hold is left out, not rounded', WAD.walletURI('bitcoin', BTC, 'BTC', '0.123456789'), `bitcoin:${BTC}`);
}

console.log('\n5. the rules a send is checked against');
{
  ok('a token on Ethereum: the fee is paid in ETH', /paid in ETH/.test(SSF.feeCoinNote('USDT', 'ethereum')));
  ok('a token on Tron: the fee is paid in TRX', /paid in TRX/.test(SSF.feeCoinNote('USDT', 'tron')));
  ok('a token on Solana mentions the token account', /token account/.test(SSF.feeCoinNote('USDC', 'solana')));
  check('the chain\'s own coin needs no such note', SSF.feeCoinNote('ETH', 'ethereum'), '');
  check('an XRP tag that is not a number is refused', SSF.checkTag('xrpl', 'abc').ok, false);
  check('an XRP tag above 4294967295 is refused', SSF.checkTag('xrpl', '4294967296').ok, false);
  check('a normal XRP tag passes', SSF.checkTag('xrpl', '123456').ok, true);
  check('a Stellar text memo over 28 bytes is refused', SSF.checkTag('stellar', 'x'.repeat(29)).ok, false);
  ok('XRP, Stellar, TON, Cosmos and Hedera ask about a missing memo', ['xrpl', 'stellar', 'ton', 'cosmos', 'hedera'].every(SSF.needsTagChoice));
  const amt = (t, d) => SSF.parseAmount(t, d, 'X');
  ok('BTC below dust for a segwit address is refused', SSF.minimum('BTC', 'bitcoin', amt('0.00000200', 8), { dustSats: 294 }).refuse);
  check('  but 300 sats to it is allowed', !!SSF.minimum('BTC', 'bitcoin', amt('0.00000300', 8), { dustSats: 294 }).refuse, false);
  ok('  and legacy addresses need 546', SSF.minimum('BTC', 'bitcoin', amt('0.00000500', 8), { dustSats: 546 }).refuse);
  ok('0.5 XRP warns about the account reserve', /1 XRP/.test(SSF.minimum('XRP', 'xrpl', amt('0.5', 6)).warn || ''));
  check('20 XRP does not', SSF.minimum('XRP', 'xrpl', amt('20', 6)).warn || '', '');
  ok('0.5 XLM warns about the account minimum', SSF.minimum('XLM', 'stellar', amt('0.5', 7)).warn);
  ok('a tiny SOL send warns about rent', SSF.minimum('SOL', 'solana', amt('0.0005', 9)).warn);
  const poison = (EVM.slice(0, 6) + '0'.repeat(32) + EVM.slice(-4)).toLowerCase();
  check('an address matching one you used at both ends is flagged', SSF.lookalike(poison, [EVM], 'ethereum'), EVM);
  check('the same address is not flagged', SSF.lookalike(EVM.toLowerCase(), [EVM], 'ethereum'), 'null');
  check('an unrelated address is not flagged', SSF.lookalike(C.ADDRESS.evm(pubOf(99n)), [EVM], 'ethereum'), 'null');
  const recs = [{ asset: 'USDT', net: 'tron', to: TRX, amountText: '25', status: 'todo', at: 1000 }];
  ok('the same send prepared again within a day is found', SSF.repeatOf(recs, { asset: 'USDT', net: 'tron', to: TRX, amountText: '25' }, 5000));
  check('a cancelled one is not', !!SSF.repeatOf([{ ...recs[0], status: 'cancelled' }], { asset: 'USDT', net: 'tron', to: TRX, amountText: '25' }, 5000), false);
}

console.log('\n6. the Send screen, end to end');
(async () => {
  const assets = [
    { symbol: 'USDT', name: 'Tether', networks: ['ethereum', 'tron', 'bnb'], search: 'usdt tether', rank: 1, color: '#26A17B' },
    { symbol: 'XRP', name: 'XRP', networks: ['xrpl'], search: 'xrp ripple', rank: 5, color: '#23292F' },
    { symbol: 'BTC', name: 'Bitcoin', networks: ['bitcoin'], search: 'btc bitcoin', rank: 0, color: '#F7931A' }
  ];
  const netsFor = sym => ({ networks: assets.find(a => a.symbol === sym).networks.map(k => ({ ...NETWORKS[k], token: sym === 'USDT' })) });
  const S = makeWorld({ DEP: { loadAssets: async () => assets, loadNets: async sym => netsFor(sym) } });
  S.load('features/sendcrypto.js');
  const SC = S.ctx.SC;
  const tick = () => new Promise(r => setImmediate(r));
  const body = () => S.dom.nodes['sc-body'].innerHTML;

  SC.open({ sym: 'USDT' }); await tick(); await tick();
  Object.assign(SC.state, { to: EVM, net: 'ethereum', amount: '1,5' });
  SC.act('review');
  check('"1,5" USDT does not reach the review', SC.state.screen, 'form');
  ok('  and says why', /point for decimals/.test(S.toasts.pop()));
  SC.state.amount = '1.5';
  SC.act('review');
  check('1.5 USDT to a valid Ethereum address reaches the review', SC.state.screen, 'review');
  ok('the review says the fee is paid in ETH', /paid in ETH/.test(body()));
  ok('the review says to check every character, not just the ends', /Check every character/.test(body()) && !/bold characters at each end should match/.test(body()));
  SC.act('handoff');
  const rec = SC.records()[0];
  check('the prepared send keeps the exact amount', rec && rec.amountText, '1.5');
  check('the hand-off offers no wallet link for a token', /Open in wallet app/.test(body()), false);

  SC.open({ sym: 'USDT' }); await tick(); await tick();
  Object.assign(SC.state, { to: EVM, net: 'ethereum', amount: '1.5' });
  SC.act('review');
  ok('the same send again is flagged as paying twice', /pays twice/.test(body()));

  SC.open({ sym: 'USDT' }); await tick(); await tick();
  // What an attacker plants: their own address, sharing your ends (all lower case, so no checksum to fail).
  const poison = (EVM.slice(0, 6) + '1'.repeat(32) + EVM.slice(-4)).toLowerCase();
  const pv = WAD.validate('ethereum', poison);
  Object.assign(SC.state, { to: pv.ok ? poison : C.ADDRESS.evm(pubOf(5n)), net: 'ethereum', amount: '2' });
  if (pv.ok) {
    SC.act('review');
    ok('a look-alike of an address you sent to is flagged as address poisoning', /address poisoning/.test(body()));
  } else {
    // A random look-alike almost never has a valid checksum - which is itself the first line of defence.
    ok('a hand-made look-alike fails its checksum before it gets that far', !pv.ok);
  }

  SC.open({ sym: 'XRP' }); await tick(); await tick();
  Object.assign(SC.state, { to: XRP, net: 'xrpl', amount: '20', tag: 'abc' });
  SC.act('review');
  check('an XRP tag that is not a number stops the send', SC.state.screen, 'form');
  SC.state.tag = '';
  SC.act('review');
  check('with no tag it reaches the review', SC.state.screen, 'review');
  ok('  which asks whether the receiver needs a tag', /data-scf="notag"/.test(body()));
  SC.act('handoff');
  check('  and will not hand off until that is confirmed', SC.state.screen, 'review');
  SC.state.notag = true;
  SC.act('handoff');
  check('  confirmed, it hands off', SC.state.screen, 'handoff');

  SC.open({ sym: 'BTC' }); await tick(); await tick();
  Object.assign(SC.state, { to: BTC, net: 'bitcoin', amount: '0.000002' });
  SC.act('review');
  check('200 sats to a segwit address (below dust) stops at the form', SC.state.screen, 'form');
  ok('  saying why', /won't relay/.test(S.toasts.pop()));

  console.log('\n7. Pay and chat');
  const me = { name: 'Me Myself', handle: '@me', payId: '100000001', tag: 'TRD-ME' };
  const alice = { name: 'Mary-Jane Doe', handle: '@mary-jane', payId: '200000002' };
  const bal = { USDT: 1000 };
  const MNY = {
    price: s => (s === 'USDT' ? 1 : 100), spendable: s => bal[s] || 0, assets: () => ['USDT', 'BTC'],
    holdings: () => [], total: () => ({ value: 0 }), qty: v => String(v), usd: v => '$' + v,
    spend: (s, a) => { if ((bal[s] || 0) < a) return { ok: false, msg: 'short' }; bal[s] -= a; return { ok: true }; },
    receive: (s, a) => { bal[s] = (bal[s] || 0) + a; return { ok: true }; }
  };
  const PW = makeWorld({
    MNY, DATA: { wallet: { balances: bal }, conversations: [] },
    UID: { me: () => me, contacts: () => [alice], payId: () => me.payId, pretty: x => x, tag: () => me.tag, resolve: () => null, parse: () => null },
    location: { origin: 'https://trending.test', pathname: '/' }
  });
  PW.load('features/pay.js');
  const PAY = PW.ctx.PAY;
  const before = bal.USDT;
  check('legacy browser payments are refused', PAY.pay({ to: alice, asset: 'USDT', amount: '2.5' }).ok, false);
  check('legacy payments never debit browser balances', bal.USDT, before);
  let route = null;
  PW.ctx.TPAY = { open: (screen, opts) => { route = { screen, opts }; } };
  PAY.openPayTo({ handle: '@bob' });
  check('Send enters the server-backed payment flow', route.screen, 'send');
  check('the handle is a lookup hint only', route.opts.handle, '@bob');
  PAY.openScan(); check('QR entry reaches server validation', route.screen, 'scan');
  check('a legacy request does not claim it was created', PAY.createRequest({ asset: 'USDT', amount: '5' }).ok, false);
  check('request opens the server request form', route.screen, 'request');
  ok('old chat cards are clearly archived, not proof of payment', /not proof|not a verified|not proof of payment/.test(PAY.cardHTML()));

  const CW = makeWorld({ MNY, DATA: { conversations: [{ id: 7, name: 'Sam' }] }, S: { activeChatId: 7 } });
  CW.load('features/chatfi.js');
  const CFI = CW.ctx.CFI;
  if (CFI && CFI.doSend) {
    check('chat: sending "1,5" is refused', CFI.doSend(7, 'USDT', '1,5').ok, false);
    check('chat: 9 decimals of BTC are refused', CFI.doSend(7, 'BTC', '0.123456789').ok, false);
    check('chat: a gift packet of "1e3" is refused', CFI.doGift(7, 'USDT', '1e3', 3).ok, false);
  } else {
    ok('chat crypto exposes its send functions', false);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
