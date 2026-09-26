/* ╔══════════════════════════════════════════════════════════════════╗
   ║  PROBLEM — the one shape every money error takes                  ║
   ║                                                                   ║
   ║  A failure answers six questions, so nobody is left guessing      ║
   ║  whether their money is gone:                                     ║
   ║                                                                   ║
   ║    error      a stable code the app can act on                    ║
   ║    message    what happened, in plain words                       ║
   ║    fundsSafe  true when nothing moved or everything moved back    ║
   ║    status     where the request is now: not_started, processing,  ║
   ║               held, completed, unknown                            ║
   ║    action     what the person can do next, or "nothing"           ║
   ║    support    where to get help, with the reference to quote      ║
   ║                                                                   ║
   ║  Codes live in one table so the same failure says the same thing  ║
   ║  wherever it happens. Nothing here echoes back what was sent: a   ║
   ║  message never contains a request body, a token or a key.         ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const SUPPORT = 'Settings → Help and support';

const CODES = {
  idempotency_key_required: [400, 'This request is missing its retry-protection key, so it was not run.', true, 'not_started', 'Refresh the app and try again.'],
  idempotency_key_reused: [422, 'That retry key was already used for a different request, so this one was not run.', true, 'not_started', 'Refresh the app and try again.'],
  request_in_progress: [409, 'This request is already being processed.', true, 'processing', 'Wait a moment, then check your history before trying again.'],
  rate_limited: [429, 'Too many requests in a short time, so this one was not run.', true, 'not_started', 'Wait a minute and try again.'],
  bad_request: [400, 'Something in the request was missing or not valid, so it was not run.', true, 'not_started', 'Check the details and try again.'],
  bad_amount: [400, 'That amount is not valid.', true, 'not_started', 'Enter a positive amount with at most 8 decimal places.'],
  insufficient_funds: [409, 'There is not enough available balance for this.', true, 'not_started', 'Lower the amount, or add funds first.'],
  not_found: [404, 'That was not found, or it is not yours.', true, 'unknown', 'Check the reference and try again.'],
  transactions_unavailable: [503, "The database can't make this change safely right now, so nothing was changed.", true, 'not_started', 'Try again later.'],
  database_unavailable: [503, "Trending's database isn't connected, so nothing was changed.", true, 'not_started', 'Try again later.'],
  compliance_unavailable: [403, "Real-money services need identity checks and screening that aren't connected yet.", true, 'not_started', 'Use the practice version for now.'],
  held_for_review: [202, 'This was held for a review before it goes ahead.', true, 'held', 'Nothing. You will be told when the review is done.'],
  server_error: [500, "Something went wrong on Trending's side.", null, 'unknown', 'Check your history before trying again.']
};

/* problem('insufficient_funds', { ref: 'SUP-1234' }) ->
   [status, body]. fundsSafe null means "we don't know" - it is never
   claimed true on a failure we can't account for. */
function problem(code, extra) {
  const row = CODES[code] || CODES.server_error;
  const e = extra || {};
  const body = {
    error: CODES[code] ? code : 'server_error',
    message: e.message || row[1],
    fundsSafe: row[2],
    status: e.status || row[3],
    action: e.action || row[4],
    support: SUPPORT + (e.ref ? `, quoting ${e.ref}` : '') + '.'
  };
  if (e.retryAfter) body.retryAfter = e.retryAfter;
  if (e.ref) body.ref = e.ref;
  return [row[0], body];
}

// Express convenience: send(res, 'rate_limited', { retryAfter: 30 }).
function send(res, code, extra) {
  const [status, body] = problem(code, extra);
  if (body.retryAfter) res.set('Retry-After', String(body.retryAfter));
  return res.status(status).json(body);
}

module.exports = { problem, send, CODES, SUPPORT };
