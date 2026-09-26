/* GET /api/products — what each crypto service is for the person asking.
   See services/products.js for the rules. Public: it describes the app,
   and a signed-out visitor sees the same hub (identity level 0). */

'use strict';

const express = require('express');
const switchboard = require('../services/products');

const router = express.Router();

const sb = switchboard.load(process.env);
sb.problems.forEach(p => console.warn('[products]', p));

router.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store');
  // No identity checks exist yet, so everyone is at level 0.
  res.json(switchboard.list(sb, { country: switchboard.countryOf(req, process.env), kyc: 0 }));
});

module.exports = router;
