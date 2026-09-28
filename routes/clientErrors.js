'use strict';

/* Script errors from browsers (public/js/utils/errors.js), written to this
   process's log as one JSON line each. A failure in production then shows
   up in the host's logs instead of waiting for someone to write in. It is
   a stand-in for an error tracker such as Sentry, which needs an account.

   Nothing identifies the person: no account, no address, no query string,
   and the message and stack are cut short. Twenty reports a minute per
   address; each browser also sends a given error once, and at most ten a
   page. */

const express = require('express');
const { perIp } = require('../middleware/ratelimit');

let sink = line => console.error(line);

// One line, no control characters, no longer than n.
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, n);
// The same, with every ?query and #fragment taken out, keeping :line:col.
const bare = (v, n) => clip(v, n * 2).replace(/[?#][^\s:)]*/g, '').slice(0, n);

const router = express.Router();

router.post('/',
  perIp({ scope: 'client-errors', windowMs: 60 * 1000, max: 20 }),
  express.json({ limit: '8kb' }),
  (req, res) => {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    if (!b.message) return res.status(400).json({ error: 'bad_request' });
    sink(JSON.stringify({
      client_error: clip(b.message, 300),
      source: bare(b.source, 200),
      line: Math.max(0, parseInt(b.line, 10) || 0),
      col: Math.max(0, parseInt(b.col, 10) || 0),
      page: bare(b.page, 120),
      stack: bare(b.stack, 1200)
    }));
    res.status(204).end();
  });

module.exports = router;
// Tests read the lines instead of the console.
module.exports._setSink = fn => { sink = fn; };
