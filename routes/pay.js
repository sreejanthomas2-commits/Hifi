/* ╔══════════════════════════════════════════════════════════════════╗
   ║  /api/pay — Trending Pay                                          ║
   ║                                                                   ║
   ║  GET  /status                  is Pay running, and on what        ║
   ║  GET  /me                      your Pay ID, code and balances     ║
   ║  POST /resolve                 who a @handle or Pay ID is         ║
   ║  POST /scan                    is this a real Trending code       ║
   ║  POST /quotes                  the full price, held 60 s          ║
   ║  POST /transfers               pay a quote (Idempotency-Key)      ║
   ║  GET  /transfers[/:id]         history and tracking               ║
   ║  GET  /transfers/:id/receipt                                      ║
   ║  POST /transfers/:id/respond   answer the payout partner          ║
   ║  POST /transfers/:id/cancel    stop a payment under review        ║
   ║  POST /transfers/:id/refund    a merchant refunds                 ║
   ║  POST /requests · GET /requests · POST /requests/:id/cancel       ║
   ║  POST /merchant                turn on merchant payments          ║
   ║  POST /demo/charge             a charge from the practice café    ║
   ║  GET  /corridors · GET|POST /recipients · DELETE /recipients/:id  ║
   ║  POST /webhooks/:partner       partner events, signed (raw body)  ║
   ║  GET  /admin/reviews · POST /admin/reviews/:id · /admin/reconcile ║
   ║                                                                   ║
   ║  Who is paying comes from the verified sign-in token, never from  ║
   ║  the request. The browser sends a quote id and a retry key; the   ║
   ║  amount, the recipient and the fees come from the server's own    ║
   ║  quote. Nothing the browser says can mark money as sent,          ║
   ║  received, refunded or settled.                                   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { idempotent, KEY } = require('../middleware/idempotency');
const { limit } = require('../middleware/ratelimit');
const { send } = require('../lib/problem');
const { open } = require('../services/pay/store');
const { makePay } = require('../services/pay/engine');
const { makeDirectory } = require('../services/pay/directory');
const { makeSandboxPartner } = require('../services/pay/partner-sandbox');
const CONFIG = require('../config/pay.json');

/* Build Pay for a store. Tests pass their own store, clock and directory. */
function build(opts) {
  const o = opts || {};
  const store = o.store !== undefined ? o.store : open(process.env);
  if (!store) return { pay: null, store: null };
  const fx = o.fx || require('../services/fx').shared();
  const directory = o.directory || makeDirectory({ now: o.now });
  const partners = {};
  const pay = makePay({ store, directory, fx, now: o.now, rand: o.rand, env: o.env, partners, config: o.config });
  partners.sandbox = makeSandboxPartner({
    store, now: o.now, seconds: (o.config || CONFIG).sandbox.partnerSeconds,
    secret: () => pay.hookSecretNow(),
    // The partner's events arrive through the same check as a real one's.
    deliver: (raw, headers) => pay.webhook('sandbox', raw, headers)
  });
  return { pay, store, partners };
}

function makeRouters(opts) {
  const o = opts || {};
  const { pay, store } = build(o);
  let ready = null;
  const init = () => (ready = ready || pay.init().catch(e => { ready = null; throw e; }));
  const worker = () => {
    if (o.worker === false || !pay) return;
    let ticking = false;
    const t = setInterval(async () => {
      if (ticking) return;
      ticking = true;
      try { await init(); await pay.tick(); }
      catch (e) { console.error('[pay worker]', e.code || e.name || 'error'); }
      finally { ticking = false; }
    }, o.tickMs || 2000);
    if (t.unref) t.unref();
  };

  // Every failure answers: what happened, is my money safe, what now.
  function fault(res, e) {
    const code = e && e.code;
    const status = { reauth_required: 401, bad_signature: 401, not_found: 404, recipient_not_found: 404,
      own_account: 400, bad_request: 400, bad_amount: 400, below_minimum: 400,
      quote_expired: 409, quote_used: 409, quote_modified: 409, confirm_repeat: 409, confirm_lookalike: 409, recipient_changed: 409,
      request_invalid: 409, over_limit: 409, insufficient_funds: 409,
      rate_unavailable: 503, directory_unavailable: 503, partner_unavailable: 503, database_unavailable: 503, transactions_unavailable: 503 }[code];
    if (!status) {
      if (!(e instanceof Error) || !code) console.error('[pay]', e && e.name, e && e.message);   // never the request itself
      return send(res, 'server_error');
    }
    const known = ['bad_request', 'bad_amount', 'insufficient_funds', 'not_found', 'database_unavailable', 'transactions_unavailable'];
    if (known.includes(code)) return send(res, code, e.message && e.message !== code ? { message: e.message } : {});
    return res.status(status).json({ error: code, message: e.message, fundsSafe: true, status: 'not_started',
      action: code === 'reauth_required' ? 'Confirm it’s you, then pay.' : code.startsWith('confirm_') ? 'Read the warning, then confirm it if you still want to pay.' : 'Nothing was sent. Check the details and try again.',
      support: 'Settings → Help and support.' });
  }
  const run = fn => async (req, res) => {
    if (!pay) return res.status(503).json({ error: 'pay_unavailable', message: 'Trending Pay needs its database, which isn’t configured on this server. Nothing was changed.', fundsSafe: true, status: 'not_started', action: 'Try again later.' });
    try { await init(); res.set('Cache-Control', 'no-store'); res.json(await fn(req, res)); }
    catch (e) { fault(res, e); }
  };
  const token = req => { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7).trim() : ''; };
  const origin = req => {
    const configured = (o.env || process.env).PAY_PUBLIC_ORIGIN;
    if (configured) return new URL(configured).origin;
    // The Host header is not an identity authority for a published app.
    const local = /^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$/i.test(req.get('host') || '');
    return (o.env || process.env).NODE_ENV !== 'production' && local ? `${req.protocol}://${req.get('host')}` : null;
  };
  const auth = o.auth || requireAuth;
  const admin = o.admin || requireAdmin;
  const lim = (scope, max, windowMs) => limit({ scope: 'pay.' + scope, windowMs: windowMs || 60000, max });
  const idem = scope => async (req, res, next) => {
    if (!pay) return res.status(503).json({ error: 'pay_unavailable' });
    try { await init(); } catch (e) { return fault(res, e); }
    return idempotent('pay.' + scope + ':' + (req.params.id || ''), { store: pay.idemStore })(req, res, next);
  };

  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const recent = req => {
    const now = o.now ? o.now() : Date.now();
    if (!Number.isFinite(req.user.authTime) || req.user.authTime > now + 5000 || now - req.user.authTime > (o.config || CONFIG).reauthSeconds * 1000) {
      const e = new Error('Confirm it is you before authorizing this action.'); e.code = 'reauth_required'; throw e;
    }
  };
  router.get('/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ available: !!pay, store: store ? store.kind : null, mode: 'practice', livePayments: false,
      limitations: ['Live custody and licensed payout partner are not connected. No real funds can move through Trending Pay.'],
      handles: 'Paying by @handle uses the app’s handle directory; if it can’t be read, use a Pay ID or scan a code.' });
  });
  router.get('/corridors', run(() => pay.corridors()));

  router.use(auth);
  router.get('/me', lim('me', 60), run(req => pay.me(req.user.id, token(req), { name: req.user.name })));
  router.post('/resolve', lim('resolve', 60), run(async req => {
    const r = await pay.resolve(req.user.id, (req.body || {}).to, token(req));
    return { recipient: r };
  }));
  router.post('/scan', lim('scan', 60), run(req => pay.scan(req.user.id, (req.body || {}).payload, origin(req), token(req))));
  router.post('/quotes', lim('quote', 30), run(req => pay.quote(req.user.id, { ...(req.body || {}), origin: origin(req) }, token(req))));
  router.post('/transfers', lim('confirm', 10), run(req => {
    const b = req.body || {};
    const key = req.get('Idempotency-Key');
    if (!KEY.test(key || '')) { const e = new Error('A valid Idempotency-Key is required.'); e.code = 'bad_request'; throw e; }
    return pay.confirm(req.user.id, b.quoteId, { authTime: req.user.authTime, acknowledge: b.acknowledge || {}, token: token(req), key });
  }));
  router.get('/transfers', lim('list', 120), run(async req => ({ transfers: await pay.transfers(req.user.id, { limit: req.query.limit }) })));
  router.get('/transfers/:id', lim('list', 120), run(req => pay.transfer(req.user.id, req.params.id)));
  router.get('/transfers/:id/receipt', lim('list', 120), run(req => pay.receipt(req.user.id, req.params.id)));
  router.post('/transfers/:id/respond', lim('respond', 10), idem('respond'), run(req => { recent(req); return pay.respond(req.user.id, req.params.id, (req.body || {}).answer); }));
  router.post('/transfers/:id/cancel', lim('respond', 10), idem('cancel'), run(req => pay.cancel(req.user.id, req.params.id)));
  router.post('/transfers/:id/refund', lim('respond', 10), idem('refund'), run(req => { recent(req); return pay.refund(req.user.id, req.params.id); }));
  router.post('/requests', lim('request', 20), run(req => pay.createRequest(req.user.id, req.body || {}, token(req))));
  router.get('/requests', lim('list', 120), run(async req => ({ requests: await pay.myRequests(req.user.id) })));
  router.post('/requests/:id/cancel', lim('request', 20), run(req => pay.cancelRequest(req.user.id, req.params.id)));
  router.post('/merchant', lim('request', 20), run(async req => ({ profile: await pay.becomeMerchant(req.user.id, req.body || {}) })));
  router.post('/demo/charge', lim('demo', 10), run(req => pay.demoCharge(req.user.id)));
  router.get('/recipients', lim('list', 120), run(async req => ({ recipients: await pay.recipients(req.user.id) })));
  router.post('/recipients', lim('request', 20), run(async req => ({ recipient: await pay.saveRecipient(req.user.id, req.body || {}) })));
  router.delete('/recipients/:id', lim('request', 20), run(req => pay.removeRecipient(req.user.id, req.params.id)));

  router.get('/admin/reviews', admin, run(async () => ({ reviews: (await pay.reviews()).map(t => pay.view(t, t.payer)) })));
  router.post('/admin/reviews/:id', admin, run(async req => {
    const d = (req.body || {}).decision;
    if (!['approve', 'reject'].includes(d)) { const e = new Error('Decide approve or reject.'); e.code = 'bad_request'; throw e; }
    return pay.view(await pay.decideReview(req.params.id, d, req.user.id), req.user.id);
  }));
  router.get('/admin/reconcile', admin, run(() => pay.reconcile()));

  /* Partner events need the exact bytes that were signed, so this router
     is mounted before the JSON parser, with a raw body. */
  const webhooks = express.Router();
  webhooks.post('/:partner', express.raw({ type: () => true, limit: '32kb' }), async (req, res) => {
    if (!pay) return res.status(503).json({ error: 'pay_unavailable' });
    try {
      await init();
      const out = await pay.webhook(req.params.partner, Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '', req.headers);
      res.json(out);
    } catch (e) {
      res.status(e && e.code === 'bad_signature' ? 401 : e && e.code === 'not_found' ? 404 : e && e.code === 'bad_request' ? 400 : 500)
        .json({ error: (e && e.code) || 'server_error' });
    }
  });

  if (pay && o.worker !== false) { init().then(worker, () => worker()); }
  return { router, webhooks, pay, store };
}

module.exports = { makeRouters, build };
