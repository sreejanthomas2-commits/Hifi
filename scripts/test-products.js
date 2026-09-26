/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SWITCHBOARD TESTS —  node scripts/test-products.js               ║
   ║                                                                   ║
   ║  The Crypto Hub shows what services/products.js says. What has to ║
   ║  hold:                                                            ║
   ║   · every service in the brief is on the board, and each one that ║
   ║     can't be used says why                                        ║
   ║   · nothing is real money by default, and a line of configuration ║
   ║     alone can't make it so - there has to be a backend too        ║
   ║   · with a backend, it is real money only in a licensed country,  ║
   ║     at the right identity level, and a country header the client  ║
   ║     could forge is not believed                                   ║
   ║   · one bad entry in the configuration switches every product off ║
   ║     real money, and a pause beats everything                      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const http = require('http');
const express = require('express');
const SB = require('../services/products');

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}
const ok = (name, cond) => check(name, !!cond, true);

const stateOf = (board, id) => board.products.find(p => p.id === id).state;
const good = { spot: { licence: 'Test licence 001', partner: 'Test partner', countries: ['IN'], kyc: 2 } };

(async () => {
  console.log('\nthe catalogue');
  {
    check('no problems in it', SB.checkCatalogue(SB.CATALOGUE).join('; '), '');
    // The 21 services the brief lists, plus Help.
    const brief = ['spot', 'buysell', 'convert', 'deposit', 'withdraw', 'p2p', 'fiat_in', 'fiat_out', 'earn', 'card',
      'pay', 'qr', 'send', 'receive', 'remit', 'wallet', 'history', 'portfolio', 'markets', 'asset', 'security'];
    const ids = new Set(SB.CATALOGUE.products.map(p => p.id));
    check('every service in the brief is on the board', brief.filter(id => !ids.has(id)).join(', '), '');
    const silent = SB.CATALOGUE.products.filter(p => (p.base === 'unavailable' || p.base === 'coming') && !p.why);
    check('everything unavailable says why', silent.map(p => p.id).join(', '), '');
    const realMoney = SB.CATALOGUE.products.filter(p => p.regulated && p.base === 'real');
    check('no money product claims to be real', realMoney.map(p => p.id).join(', '), '');
    const broken = SB.checkCatalogue({ groups: [{ id: 'trade' }], products: [
      { id: 'x', group: 'trade', base: 'live' }, { id: 'y', group: 'nope', base: 'unavailable' }] });
    check('a catalogue that says live, or unavailable without a reason, is refused', broken.length, 3);
  }

  console.log('\nby default');
  {
    const sb = SB.load({});
    check('no configuration problems', sb.problems.join('; '), '');
    const board = SB.list(sb, { country: 'IN', kyc: 3 });
    check('nothing is real money', board.live, false);
    check('  not even for a fully verified person in a listed country', board.products.filter(p => p.state === 'live').length, 0);
    check('spot is practice money', stateOf(board, 'spot'), 'sandbox');
    check('the card is unavailable', stateOf(board, 'card'), 'unavailable');
    check('transfers abroad are coming', stateOf(board, 'remit'), 'coming');
    check('live prices are real', stateOf(board, 'markets'), 'real');
    const w = board.products.find(p => p.id === 'withdraw');
    ok('withdraw explains itself and offers Send instead', w.why && w.alt === 'send');
  }

  console.log('\nconfiguration alone switches nothing on');
  {
    const sb = SB.load({ PRODUCTS_LIVE: JSON.stringify(good) });
    check('spot is still practice money', stateOf(SB.list(sb, { country: 'IN', kyc: 3 }), 'spot'), 'sandbox');
    ok('  and the server says why', sb.problems.some(p => /no real-money backend/.test(p)));
  }

  console.log('\nwith a backend, only where and for whom it is licensed');
  {
    const backends = new Set(['spot']);
    const sb = SB.load({ PRODUCTS_LIVE: JSON.stringify(good) }, { backends });
    check('licensed country, verified: real money', stateOf(SB.list(sb, { country: 'IN', kyc: 2 }), 'spot'), 'live');
    const other = SB.resolve(SB.CATALOGUE.products.find(p => p.id === 'spot'), sb, { country: 'US', kyc: 3 });
    check('another country: practice money', other.state, 'sandbox');
    ok('  saying it is not available there', /isn't available in your country \(US\)/.test(other.liveWhy));
    const unverified = SB.resolve(SB.CATALOGUE.products.find(p => p.id === 'spot'), sb, { country: 'IN', kyc: 1 });
    check('not verified enough: practice money', unverified.state, 'sandbox');
    check('  with the verify action', unverified.action, 'verify');
    check('country unknown: practice money', stateOf(SB.list(sb, { country: null, kyc: 3 }), 'spot'), 'sandbox');
    check('convert, not listed, is unaffected', stateOf(SB.list(sb, { country: 'IN', kyc: 3 }), 'convert'), 'sandbox');
    const paused = SB.load({ PRODUCTS_LIVE: JSON.stringify(good), PRODUCTS_PAUSED: 'spot' }, { backends });
    const p = SB.resolve(SB.CATALOGUE.products.find(x => x.id === 'spot'), paused, { country: 'IN', kyc: 3 });
    check('a pause beats everything', p.state, 'paused');
    ok('  and says balances are not affected', /Nothing you hold is affected/.test(p.why));
  }

  console.log('\none bad entry switches everything off');
  {
    const backends = new Set(['spot', 'convert']);
    const mixed = { ...good, convert: { licence: 'L', partner: 'Test partner', countries: ['IN'], kyc: 2 } };
    const sb = SB.load({ PRODUCTS_LIVE: JSON.stringify(mixed) }, { backends });
    check('a licence too short to be one: nothing is live', stateOf(SB.list(sb, { country: 'IN', kyc: 3 }), 'spot'), 'sandbox');
    ok('  and the problem is named', sb.problems.some(p => /convert: names no licence/.test(p)));
    check('not JSON: nothing is live', SB.parseLive('{nope').problems.length, 1);
    check('a product that holds no money cannot be made live', SB.parseLive(JSON.stringify({ markets: good.spot })).problems[0], 'markets: not a money product, so it has no live mode');
    check('lower-case country codes are refused', SB.parseLive(JSON.stringify({ spot: { ...good.spot, countries: ['in'] } })).problems.length, 1);
    check('identity level 0 is refused', SB.parseLive(JSON.stringify({ spot: { ...good.spot, kyc: 0 } })).problems.length, 1);
    check('an unknown product is refused', SB.parseLive(JSON.stringify({ lottery: good.spot })).problems.length, 1);
  }

  console.log('\nwhere the country comes from');
  {
    const req = { headers: { 'x-vercel-ip-country': 'IN' } };
    check('a header is not believed unless the operator names it', SB.countryOf(req, {}), 'null');
    check('named, it is read', SB.countryOf(req, { COUNTRY_HEADER: 'X-Vercel-IP-Country' }), 'IN');
    check('anything but a country code is dropped', SB.countryOf({ headers: { 'x-vercel-ip-country': 'IN<script>' } }, { COUNTRY_HEADER: 'x-vercel-ip-country' }), 'null');
    check('paused ids that are not products are ignored', [...SB.parsePaused('earn, nope ,p2p')].join(','), 'earn,p2p');
  }

  console.log('\nGET /api/products');
  {
    const app = express();
    app.use('/api/products', require('../routes/products'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    const { port } = server.address();
    const res = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: '/api/products', headers: { 'x-vercel-ip-country': 'IN' } }, r => {
        let body = '';
        r.on('data', d => { body += d; });
        r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, body }));
      }).on('error', reject);
    });
    server.close();
    check('answers 200', res.status, 200);
    check('is never cached', res.headers['cache-control'], 'no-store');
    const board = JSON.parse(res.body);
    check('lists every product', board.products.length, SB.CATALOGUE.products.length);
    check('nothing is real money', board.live, false);
    check('a forged country header is ignored', board.country, 'null');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
