/* ╔══════════════════════════════════════════════════════════════════╗
   ║  FEE ESTIMATE TESTS —  node scripts/test-fees.js                  ║
   ║                                                                   ║
   ║  The estimates sit beside a payment to a wallet address, so the   ║
   ║  cases that matter are the honest ones:                           ║
   ║                                                                   ║
   ║  · every number is worked out from what the network answered      ║
   ║  · a network that does not answer gives no number, never a guess  ║
   ║  · a tier costing the same as a faster one is not offered         ║
   ║  · a configured RPC is used before the public default             ║
   ║                                                                   ║
   ║  fetch is replaced with a stub, so nothing here touches a network.║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got) === String(want);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`);
  if (!ok) console.log(`        got  ${got}\n        want ${want}`);
  ok ? pass++ : fail++;
}
const ok = (name, cond) => check(name, !!cond, true);

/* ── A network, near enough ──────────────────────────────────────── */
let calls = [];
let answer = () => { throw new Error('offline'); };
global.fetch = async (url, init) => {
  const body = init && init.body ? JSON.parse(init.body) : null;
  calls.push({ url, method: body ? body.method : 'GET' });
  const out = answer(url, body);
  if (out instanceof Error) throw out;
  // A JSON-RPC call gets a JSON-RPC envelope; a plain GET/POST gets the body.
  const payload = body && body.jsonrpc ? { jsonrpc: '2.0', id: body.id, result: out } : out;
  return { ok: true, status: 200, json: async () => payload };
};
const gwei = n => '0x' + (BigInt(Math.round(n * 1e9))).toString(16);

function fresh() {
  delete require.cache[require.resolve('../services/fees')];
  calls = [];
  return require('../services/fees');
}

(async () => {
  console.log('\nEVM: base fee of the next block plus the tip at three percentiles');
  {
    const f = fresh();
    answer = (url, b) => b.method === 'eth_feeHistory'
      ? { baseFeePerGas: [gwei(9), gwei(10), gwei(10)], reward: [[gwei(1), gwei(2), gwei(5)], [gwei(1), gwei(2), gwei(5)]] }
      : new Error('unexpected');
    const r = await f.estimate('ethereum', { token: true });
    ok('it answers', r.ok);
    check('  in the gas coin', r.coin, 'ETH');
    check('  three speeds', r.tiers.map(t => t.speed).join(','), 'slow,standard,fast');
    // 65,000 gas × (10 + 1) gwei = 715,000 gwei
    check('  slow is base + the 10th-percentile tip, for a token transfer', r.tiers[0].amount, '0.000715');
    check('  standard uses the median tip', r.tiers[1].amount, '0.00078');
    check('  fast uses the 90th', r.tiers[2].amount, '0.000975');
    ok('  and says how it got there', /65000 gas at 11 gwei/.test(r.tiers[0].basis));
    const n = await f.estimate('ethereum', { token: false });
    check('a native transfer is 21,000 gas', n.tiers[0].amount, '0.000231');
  }

  console.log('\nEVM: a chain with no tips, or no fee history');
  {
    const f = fresh();
    answer = (url, b) => b.method === 'eth_feeHistory'
      ? { baseFeePerGas: [gwei(0.01), gwei(0.01)], reward: [[gwei(0), gwei(0), gwei(0)]] }
      : new Error('unexpected');
    const r = await f.estimate('arbitrum', { token: false });
    check('identical tiers become one', r.tiers.length, 1);
    check('  called standard', r.tiers[0].speed, 'standard');
    ok('  a rollup says it adds an L1 fee', /posting to Ethereum/.test(r.note));

    const g = fresh();
    answer = (url, b) => b.method === 'eth_feeHistory' ? new Error('method not found')
      : b.method === 'eth_gasPrice' ? gwei(3) : new Error('unexpected');
    const q = await g.estimate('bnb', { token: false });
    ok('without fee history it falls back to gasPrice', q.ok && q.source === 'eth_gasPrice');
    check('  gas coin BNB', q.coin, 'BNB');
    check('  21,000 × 3 gwei', q.tiers[0].amount, '0.000063');
  }

  console.log('\nnothing answers: no number');
  {
    const f = fresh();
    answer = () => new Error('offline');
    const r = await f.estimate('ethereum', { token: true });
    ok('the estimate fails', !r.ok);
    ok('  with a reason', /did not answer/.test(r.reason));
    ok('  and no amount anywhere', !r.tiers);
    const b = await f.estimate('bitcoin');
    ok('bitcoin fails the same way', !b.ok && !b.tiers);
    const t = await f.estimate('tron', { token: true });
    ok('so does tron', !t.ok && !t.tiers);
  }

  console.log('\nbitcoin: mempool.space targets');
  {
    const f = fresh();
    answer = url => /fees\/recommended/.test(url) ? { fastestFee: 12, halfHourFee: 8, hourFee: 5, economyFee: 3 } : new Error('x');
    const r = await f.estimate('bitcoin');
    check('three speeds', r.tiers.length, 3);
    check('  slow is the hour rate × 141 vB', r.tiers[0].amount, '0.00000705');
    check('  fast is the next-block rate', r.tiers[2].amount, '0.00001692');
    check('  with its target time', r.tiers[2].eta, 'about 10 min');

    const g = fresh();
    answer = url => /fees\/recommended/.test(url) ? { fastestFee: 2, halfHourFee: 1, hourFee: 1 } : new Error('x');
    const q = await g.estimate('bitcoin');
    check('slow costing the same as standard is dropped', q.tiers.map(t => t.speed).join(','), 'standard,fast');
  }

  console.log('\nsolana: the protocol fee');
  {
    const f = fresh();
    answer = () => new Error('must not be called');
    const r = await f.estimate('solana', { token: true });
    check('5,000 lamports', r.tiers[0].amount, '0.000005');
    check('  plus a first-time token account', r.extra.amount, '0.00203928');
    check('  with no network call', calls.length, 0);
    const n = await f.estimate('solana', { token: false });
    check('native SOL has no account deposit', n.extra, null);
  }

  console.log('\ntron: energy and bandwidth from the chain');
  {
    const f = fresh();
    answer = url => /getchainparameters/.test(url)
      ? { chainParameter: [{ key: 'getEnergyFee', value: 100 }, { key: 'getTransactionFee', value: 1000 }] }
      : new Error('x');
    const r = await f.estimate('tron', { token: true });
    // 64,285 × 100 + 345 × 1000 sun = 6,773,500 sun
    check('USDT low end', r.tiers[0].amount, '6.7735');
    check('  high end, their first USDT', r.tiers[0].amountMax, '13.3735');
    const n = await f.estimate('tron', { token: false });
    check('native TRX is bandwidth only', n.tiers[0].amount, '0.27');
  }

  console.log('\nthe rest');
  {
    const f = fresh();
    answer = (url, b) => b && b.method === 'eth_feeHistory'
      ? { baseFeePerGas: [gwei(1)], reward: [[gwei(1), gwei(1), gwei(1)]] } : new Error('x');
    process.env.WATCHER_RPC_POLYGON = 'http://rpc.test/polygon';
    await f.estimate('polygon', { token: true });
    check('a configured RPC is used first', calls[0].url, 'http://rpc.test/polygon');
    delete process.env.WATCHER_RPC_POLYGON;
    const before = calls.length;
    await f.estimate('polygon', { token: true });
    check('a fresh estimate is served from the cache', calls.length, before);
    const u = await f.estimate('dogecoin');
    ok('an unknown network is refused', !u.ok && u.unknown);
    const x = await f.estimate('xrpl');
    ok('as is one this does not estimate', !x.ok && x.unknown);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
