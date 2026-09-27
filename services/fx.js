/* ╔══════════════════════════════════════════════════════════════════╗
   ║  FX — the day's exchange rates, from a named public source        ║
   ║                                                                   ║
   ║  The card prices a payment in euros, pounds or yen at the         ║
   ║  European Central Bank's daily reference rate (published through  ║
   ║  Frankfurter, a free, keyless mirror). It is a real published     ║
   ║  rate with a date on it - not a market quote, and not a number    ║
   ║  this app made up - and the card says which it used.              ║
   ║                                                                   ║
   ║  One fetch an hour at most. If the source is down, the last good  ║
   ║  answer is served, marked stale, with its date; if there has      ║
   ║  never been one, the answer is "unavailable" and the card         ║
   ║  declines foreign-currency payments rather than guess.            ║
   ║                                                                   ║
   ║  Nothing about the person asking is sent anywhere: the request    ║
   ║  to the source is the same for everyone.                          ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const SOURCE = 'European Central Bank reference rate';
const DEFAULT_URL = 'https://api.frankfurter.dev/v1/latest?base=USD';
const FRESH_MS = 60 * 60 * 1000;
const RETRY_MS = 60 * 1000;

/* Only what a rate table should look like gets through. */
function validate(j) {
  if (!j || typeof j !== 'object') return null;
  if (j.base !== 'USD') return null;
  if (typeof j.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(j.date)) return null;
  if (!j.rates || typeof j.rates !== 'object') return null;
  const rates = {};
  for (const [k, v] of Object.entries(j.rates)) {
    const n = Number(v);
    if (/^[A-Z]{3}$/.test(k) && Number.isFinite(n) && n > 0 && n < 1e7) rates[k] = n;
  }
  if (Object.keys(rates).length < 5) return null;
  return { base: 'USD', date: j.date, rates };
}

function make(opts) {
  const o = opts || {};
  const url = o.url || process.env.FX_URL || DEFAULT_URL;
  const fetchImpl = o.fetch || (typeof fetch === 'function' ? fetch : null);
  const clock = o.now || Date.now;
  let good = null;          // { base, date, rates, fetchedAt }
  let failedAt = 0;
  let inflight = null;

  const answer = (g, stale) => ({ ok: true, source: SOURCE, base: 'USD', date: g.date, rates: g.rates, fetchedAt: g.fetchedAt, stale: !!stale });

  async function pull() {
    const r = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error('status ' + r.status);
    const v = validate(await r.json());
    if (!v) throw new Error('unexpected shape');
    return v;
  }

  async function rates() {
    const now = clock();
    if (good && now - good.fetchedAt < FRESH_MS) return answer(good);
    if (failedAt && now - failedAt < RETRY_MS) {
      return good ? answer(good, true) : { ok: false, reason: 'Exchange rates are unavailable right now.' };
    }
    if (!fetchImpl) return { ok: false, reason: 'Exchange rates are unavailable right now.' };
    if (!inflight) {
      inflight = pull()
        .then(v => { good = { ...v, fetchedAt: clock() }; failedAt = 0; })
        .catch(() => { failedAt = clock(); })
        .finally(() => { inflight = null; });
    }
    await inflight;
    if (good && !failedAt) return answer(good);
    return good ? answer(good, true) : { ok: false, reason: 'Exchange rates are unavailable right now.' };
  }

  return { rates, validate };
}

module.exports = { make, validate, SOURCE };
