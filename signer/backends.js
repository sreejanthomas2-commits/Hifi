/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SIGNING BACKENDS — where the signature comes from                ║
   ║                                                                   ║
   ║  Three of them, and none holds a private key in this process:     ║
   ║                                                                   ║
   ║    airgap    prints the hash, waits for a signature typed back    ║
   ║              from a machine with no network. The default, and     ║
   ║              the only one that needs nothing but a human.         ║
   ║    external  posts the hash to an HSM or KMS that signs and       ║
   ║              returns r, s and the parity bit                      ║
   ║    dryrun    returns nothing and marks the withdrawal as          ║
   ║              rehearsed, for testing the whole path safely         ║
   ║                                                                   ║
   ║  There is deliberately no `local` backend that reads a key from   ║
   ║  an environment variable. That backend is how hot wallets are     ║
   ║  drained, and adding one would undo the reason this service is    ║
   ║  separate from the web tier at all.                               ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const readline = require('readline');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(question, a => { rl.close(); res(String(a).trim()); }));
}

/* ── Air-gapped ───────────────────────────────────────────────────── */
/* The operator reads the transaction on this screen, checks it against
   the hardware wallet's own screen, and types back what the device
   produced. The key never touches a networked machine. */
const airgap = {
  name: 'airgap',
  needsHuman: true,
  async sign({ hash, describe }) {
    console.log('\n' + '─'.repeat(64));
    console.log('SIGN THIS TRANSACTION ON YOUR OFFLINE DEVICE');
    console.log('─'.repeat(64));
    console.log(describe);
    console.log('─'.repeat(64));
    console.log('hash to sign  0x' + hash.toString('hex'));
    console.log('─'.repeat(64));
    console.log('Check every line above against the device screen before approving.');
    const r = await ask('r  (0x…) : ');
    if (!r) return { ok: false, why: 'cancelled at the prompt' };
    const s = await ask('s  (0x…) : ');
    const parity = await ask('parity/v (0 or 1) : ');
    if (!/^0x[0-9a-fA-F]{1,64}$/.test(r) || !/^0x[0-9a-fA-F]{1,64}$/.test(s)) {
      return { ok: false, why: 'r and s must be hex' };
    }
    if (parity !== '0' && parity !== '1') return { ok: false, why: 'parity must be 0 or 1' };
    return { ok: true, sig: { r, s, yParity: parity === '1' } };
  }
};

/* ── External signer (HSM / KMS / remote service) ─────────────────── */
const external = {
  name: 'external',
  needsHuman: false,
  async sign({ hash, withdrawal }) {
    const url = process.env.SIGNER_HSM_URL;
    const token = process.env.SIGNER_HSM_TOKEN || '';
    if (!url) return { ok: false, why: 'SIGNER_HSM_URL is not set' };
    let body;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}),
        body: JSON.stringify({
          hash: '0x' + hash.toString('hex'),
          /* Sent so the HSM can apply its own policy rather than trusting
             ours — a second opinion is the point of a second system. */
          context: {
            asset: withdrawal.asset, network: withdrawal.network,
            to: withdrawal.to, amount: withdrawal.amount, id: withdrawal.id
          }
        }),
        signal: AbortSignal.timeout(30000)
      });
      if (!r.ok) return { ok: false, why: `the signer answered ${r.status}` };
      body = await r.json();
    } catch (e) {
      return { ok: false, why: 'the signer could not be reached: ' + e.message };
    }
    if (!body || !body.r || !body.s || body.yParity == null) {
      return { ok: false, why: 'the signer did not return r, s and yParity' };
    }
    return { ok: true, sig: { r: body.r, s: body.s, yParity: !!body.yParity } };
  }
};

/* ── Dry run ──────────────────────────────────────────────────────── */
const dryrun = {
  name: 'dryrun',
  needsHuman: false,
  async sign({ hash, describe }) {
    console.log('\n[dry run] would sign:\n' + describe);
    console.log('[dry run] hash 0x' + hash.toString('hex'));
    return { ok: false, dryRun: true, why: 'dry run — nothing was signed' };
  }
};

const ALL = { airgap, external, dryrun };

function pick(name) {
  const key = String(name || process.env.SIGNER_BACKEND || 'airgap').toLowerCase();
  if (key === 'local' || key === 'hot' || key === 'privatekey') {
    throw new Error(
      'There is no local key backend, on purpose. A key in this process is a hot wallet, ' +
      'and a hot wallet on a machine that talks to the internet is how exchanges lose customer funds. ' +
      'Use airgap, or external with an HSM.'
    );
  }
  const b = ALL[key];
  if (!b) throw new Error(`unknown signing backend "${key}" — use airgap, external or dryrun`);
  return b;
}

module.exports = { pick, ALL, ask };
