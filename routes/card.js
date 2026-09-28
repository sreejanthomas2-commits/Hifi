/* ╔══════════════════════════════════════════════════════════════════╗
   ║  /api/card — what the Trending Card is, here, today               ║
   ║                                                                   ║
   ║  GET /api/card/status   the card's state from the switchboard     ║
   ║                         (practice, paused or unavailable), and    ║
   ║                         what a real card would still need         ║
   ║  GET /api/card/fx       the day's ECB reference rates             ║
   ║                                                                   ║
   ║  Both are public and read-only: they describe the product, not a  ║
   ║  person. There is deliberately no endpoint that issues a card,    ║
   ║  shows a card number or answers a card network, because there is  ║
   ║  no issuing partner behind it. When there is one:                 ║
   ║                                                                   ║
   ║  · Cards are issued by the partner. Trending stores its card id   ║
   ║    and the last 4 digits - never the number, security code or     ║
   ║    PIN, which stay with the partner (and out of PCI scope here).  ║
   ║  · Showing the number uses the partner's own secure frame, opened ║
   ║    with a short-lived key this server mints only after checking   ║
   ║    that the sign-in is recent (the same step-up the page asks).   ║
   ║  · The network's authorisation request arrives on a signed        ║
   ║    webhook. It is verified, looked up by the network's            ║
   ║    transaction id (a repeat gets the same answer), decided by the ║
   ║    same rules as features/cardcore.js, and the coin is sold on    ║
   ║    the ledger in one transaction with the hold.                   ║
   ║  · The card only goes live through PRODUCTS_LIVE, which needs     ║
   ║    that partner, a licence, a country list and a KYC level -      ║
   ║    see services/products.js.                                      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const express = require('express');
const switchboard = require('../services/products');
const fx = require('../services/fx');

const router = express.Router();
const sb = switchboard.load(process.env);
const rates = fx.shared();

const NEEDS = [
  'A licensed card-issuing partner and a card network',
  'Identity verification by that partner',
  'Approval in each country where the card is offered'
];

router.get('/status', (req, res) => {
  const product = switchboard.CATALOGUE.products.find(p => p.id === 'card');
  res.set('Cache-Control', 'no-store');
  if (!product) return res.json({ state: 'unavailable', why: 'The card is not part of this build.', partner: null, needs: NEEDS });
  const p = switchboard.resolve(product, sb, { country: switchboard.countryOf(req, process.env), kyc: 0 });
  res.json({ state: p.state, why: p.why, note: p.note, partner: null, needs: NEEDS });
});

router.get('/fx', async (req, res) => {
  let out;
  try { out = await rates.rates(); } catch (e) { out = { ok: false, reason: 'Exchange rates are unavailable right now.' }; }
  res.set('Cache-Control', out.ok ? 'public, max-age=600' : 'no-store');
  res.status(out.ok ? 200 : 503).json(out);
});

module.exports = router;
