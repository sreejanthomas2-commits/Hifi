/* ╔══════════════════════════════════════════════════════════════════╗
   ║  /api/fees/:network — what the network charges right now          ║
   ║                                                                   ║
   ║  Read-only and public: it takes a network name and whether the    ║
   ║  transfer is a token, and returns the network's current fee at up ║
   ║  to three speeds. No user data comes in, nothing is stored, and   ║
   ║  no transaction is built. The browser uses it to show the network ║
   ║  fee beside a payment to a wallet address, which the person then  ║
   ║  sends from their own wallet app. services/fees.js has the rules. ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const express = require('express');
const fees = require('../services/fees');

const router = express.Router();

router.get('/:network', async (req, res) => {
  const network = String(req.params.network || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 20);
  let out;
  try {
    out = await fees.estimate(network, { token: req.query.token === '1' });
  } catch (e) {
    out = { ok: false, reason: 'The fee could not be estimated right now.' };
  }
  res.set('Cache-Control', 'no-store');
  res.status(out.ok ? 200 : out.unknown ? 404 : 503).json(out);
});

module.exports = router;
