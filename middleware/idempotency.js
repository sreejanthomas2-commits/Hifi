/* ╔══════════════════════════════════════════════════════════════════╗
   ║  IDEMPOTENCY — a money request runs once, however often it's sent ║
   ║                                                                   ║
   ║  Every request that moves value carries an Idempotency-Key header ║
   ║  the app makes once per action. The first request with a key      ║
   ║  claims it (a unique index, so two racing requests cannot both    ║
   ║  claim it) and runs. After that, the same key:                    ║
   ║                                                                   ║
   ║    same body, finished    -> the first answer again, not a second ║
   ║                              transfer                             ║
   ║    same body, still going -> 409 request_in_progress              ║
   ║    different body         -> 422 idempotency_key_reused           ║
   ║                                                                   ║
   ║  A 5xx releases the key, so a retry can run. That is safe because ║
   ║  the ledger keys every movement on the same reference: whatever   ║
   ║  did land the first time is found, not repeated.                  ║
   ║                                                                   ║
   ║  Keys are per person and per route, and kept for 24 hours.        ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const crypto = require('crypto');
const { send } = require('../lib/problem');

const KEY = /^[A-Za-z0-9_-]{8,80}$/;
const DUPLICATE = 11000;

// Same body, same hash, whatever order the fields came in.
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = canonical(v[k]); return o; }, {});
  return v;
}
const hashOf = body => crypto.createHash('sha256').update(JSON.stringify(canonical(body || {}))).digest('hex');

/* The store is Mongo in the app and an in-memory one in the tests.
   create() must fail with code 11000 on a key that exists. */
function mongoStore() {
  const { IdempotencyKey } = require('../models/sandbox');
  return {
    create: doc => IdempotencyKey.create(doc),
    find: q => IdempotencyKey.findOne(q).lean(),
    finish: (q, set) => IdempotencyKey.updateOne(q, { $set: set }),
    drop: q => IdempotencyKey.deleteOne(q)
  };
}

function idempotent(scope, opts) {
  const o = opts || {};
  let store = o.store || null;
  return async function idempotency(req, res, next) {
    store = store || mongoStore();
    const key = req.get('Idempotency-Key');
    if (!key || !KEY.test(key)) return send(res, 'idempotency_key_required');
    const userId = req.user && req.user.id;
    if (!userId) return send(res, 'bad_request');
    const q = { userId, scope, key };
    const hash = hashOf(req.body);

    try {
      await store.create({ ...q, hash, state: 'started', createdAt: new Date() });
    } catch (e) {
      if (!e || e.code !== DUPLICATE) return next(e);
      const prev = await store.find(q);
      if (!prev) return send(res, 'request_in_progress');
      if (prev.hash !== hash) return send(res, 'idempotency_key_reused');
      if (prev.state === 'done') {
        res.set('Idempotent-Replay', 'true');
        return res.status(prev.code).json(prev.body);
      }
      return send(res, 'request_in_progress');
    }

    req.idempotencyKey = key;
    // Record the answer before sending it, so a replay can never find
    // "still going" for a request that has in fact finished.
    const json = res.json.bind(res);
    res.json = body => {
      const code = res.statusCode;
      const done = code >= 500 ? store.drop(q) : store.finish(q, { state: 'done', code, body });
      Promise.resolve(done).then(() => json(body), () => json(body));
      return res;
    };
    next();
  };
}

module.exports = { idempotent, hashOf, canonical, KEY };
