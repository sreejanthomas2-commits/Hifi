/* ╔══════════════════════════════════════════════════════════════════╗
   ║  WITHDRAW API TESTS —  node scripts/test-withdraw-api.js          ║
   ║                                                                   ║
   ║  The fee pipeline is exercised against a mock JSON-RPC rather     ║
   ║  than a public node: a test that depends on somebody else's       ║
   ║  uptime is a test that will one day fail for no reason, and a     ║
   ║  test that quietly falls back to a hard-coded fee is worse than   ║
   ║  no test at all. The mock answers like a chain, and the numbers   ║
   ║  below are checked against what that chain said.                  ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const http = require('http');
const express = require('express');

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${ok ? '' : `\n        got  ${got}\n        want ${want}`}`);
  ok ? pass++ : fail++;
};
const ok = (name, cond) => check(name, !!cond, true);

/* A chain that always answers, with numbers we chose. */
const GWEI = 20n;
const BASE_FEE = GWEI * 1000000000n;
function mockChain() {
  return new Promise(res => {
    const s = http.createServer((req, r) => {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        let call = {};
        try { call = JSON.parse(body); } catch (e) {}
        const reply = v => { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, result: v })); };
        if (call.method === 'eth_getBlockByNumber') return reply({ number: '0x1', baseFeePerGas: '0x' + BASE_FEE.toString(16) });
        if (call.method === 'eth_maxPriorityFeePerGas') return reply('0x0');
        if (call.method === 'eth_blockNumber') return reply('0x1');
        reply(null);
      });
    });
    s.listen(0, () => res(s));
  });
}

(async () => {
  const chain = await mockChain();
  const rpcUrl = `http://127.0.0.1:${chain.address().port}`;

  Object.assign(process.env, {
    CUSTODY_ENABLED: 'true',
    WATCHER_RPC_ETHEREUM: rpcUrl,
    FEE_CACHE_MS: '1'
  });

  const fees = require('../services/fees');
  const T = require('./lib/test-tokens');
  T.install(require('../middleware/auth'));

  console.log('\nfees come from the chain, and only from the chain');
  const q = await fees.quote('ethereum', { token: false });
  ok('a fee was quoted', q.ok);
  /* 21000 gas × (2 × base + 0 tip) = 21000 × 40 gwei */
  check('native transfer fee', q.fee, (21000n * BASE_FEE * 2n).toString());
  check('the basis is shown', q.basis, '21000 gas at 40 gwei');
  const qt = await fees.quote('ethereum', { token: true });
  check('a token transfer costs more gas', qt.fee, (65000n * BASE_FEE * 2n).toString());
  check('minimum is three times the fee', q.minimum, (BigInt(q.fee) * 3n).toString());
  ok('a fresh quote is fresh', fees.isFresh(q));
  ok('an old quote is not', !fees.isFresh({ at: Date.now() - 10 * 60 * 1000 }));

  console.log('\na chain that does not answer is not guessed at');
  process.env.WATCHER_RPC_BASE = 'http://127.0.0.1:1';       // nothing listens here
  const dead = await fees.quote('base', {});
  ok('the quote fails', !dead.ok);
  ok('and says which chain', /Base/.test(dead.reason));
  const none = await fees.quote('arbitrum', {});
  ok('an unconfigured chain fails too', !none.ok);
  ok('and says it is unconfigured', /No RPC endpoint/.test(none.reason));

  console.log('\nthe API');
  const app = express();
  app.use(express.json());
  app.use('/api/crypto', require('../routes/crypto'));
  app.use('/api/crypto', require('../routes/withdraw'));
  const PORT = 3188;
  const server = await new Promise(res => { const s = app.listen(PORT, () => res(s)); });
  const call = async (path, body, token) => {
    const r = await fetch(`http://127.0.0.1:${PORT}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: Object.assign({ Connection: 'close', Accept: 'application/json' },
        body ? { 'Content-Type': 'application/json' } : {},
        token ? { Authorization: 'Bearer ' + token } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null; try { data = await r.json(); } catch (e) {}
    return { status: r.status, data: data || {} };
  };
  const token = T.mint('user_wd_1');

  let r = await call('/api/crypto/withdraw/quote', { asset: 'ETH', network: 'ethereum' });
  check('quote without a session → 401', r.status, 401);

  r = await call('/api/crypto/withdraw/validate', { network: 'ethereum', address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed' }, token);
  check('a good address validates', r.data.valid, 'true');
  check('  and is returned checksummed', r.data.normalized, '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
  r = await call('/api/crypto/withdraw/validate', { network: 'ethereum', address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD' }, token);
  check('a bad checksum is refused', r.data.valid, 'false');
  r = await call('/api/crypto/withdraw/validate', { network: 'ethereum', address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' }, token);
  check('a Bitcoin address on Ethereum is refused', r.data.valid, 'false');

  r = await call('/api/crypto/withdraw/validate', { network: 'ethereum', address: 'legal winner thank year wave sausage worth useful legal winner thank yellow' }, token);
  check('a recovery phrase is refused', r.data.valid, 'false');
  ok('  and the phrase is never echoed back', !/legal winner/.test(JSON.stringify(r.data)));

  r = await call('/api/crypto/withdraw', { asset: 'ETH', network: 'ethereum', to: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', amount: '1000000000000000' }, token);
  ok('a withdrawal with no idempotency key or database is refused', r.status >= 400);

  r = await call('/api/crypto/withdraw/quote', { asset: 'ETH', network: 'bitcoin' }, token);
  check('ETH over Bitcoin is refused', r.data.code, 'unsupported_pair');
  ok('  with a warning about losing funds', /lost/.test(r.data.message || ''));

  await new Promise(d => server.close(d));
  await new Promise(d => chain.close(d));
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
