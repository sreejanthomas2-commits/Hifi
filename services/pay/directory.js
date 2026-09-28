/* ╔══════════════════════════════════════════════════════════════════╗
   ║  DIRECTORY — who a handle really belongs to                       ║
   ║                                                                   ║
   ║  A payment goes to an account, never to a name typed on a screen  ║
   ║  or printed on a QR code. The account behind a handle comes from  ║
   ║  the app's own records in Firestore:                              ║
   ║                                                                   ║
   ║    handles/{name}   → { uid }   claimed once, by one account      ║
   ║    profiles/{uid}   → { name, displayName }                       ║
   ║                                                                   ║
   ║  and both must agree: the handle points at the account and the    ║
   ║  account says it uses that handle. A handle that was given up and ║
   ║  taken by someone else resolves to the new owner, and Pay notices ║
   ║  the change between quote and payment (see engine.js).            ║
   ║                                                                   ║
   ║  Both collections are public by the rules, so no credentials are  ║
   ║  needed. The person's own token is passed anyway, so this keeps   ║
   ║  working if the rules ever require a signed-in reader. Answers    ║
   ║  are cached for a minute.                                         ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const HANDLE = /^[a-z0-9_.]{3,30}$/;
const TTL = 60 * 1000;

function normHandle(v) {
  const h = String(v == null ? '' : v).trim().replace(/^@/, '').toLowerCase();
  if (!HANDLE.test(h) || h.startsWith('.') || h.endsWith('.') || h.includes('..')) return null;
  return h;
}

function makeDirectory(opts) {
  const o = opts || {};
  const fetchImpl = o.fetch || fetch;
  const now = o.now || Date.now;
  const projectId = () => o.projectId || process.env.FIREBASE_PROJECT_ID || '';
  const databaseId = () => o.databaseId || process.env.FIRESTORE_DATABASE_ID || 'default';
  const cache = new Map();

  async function doc(pathPart, token) {
    const pid = projectId();
    if (!pid) { const e = new Error('directory_unavailable'); e.code = 'directory_unavailable'; throw e; }
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/${encodeURIComponent(databaseId())}/documents/${pathPart}`;
    const r = await fetchImpl(url, { headers: token ? { Authorization: 'Bearer ' + token } : {}, signal: AbortSignal.timeout(5000) });
    if (r.status === 404) return null;
    if (!r.ok) { const e = new Error('directory_unavailable'); e.code = 'directory_unavailable'; throw e; }
    const j = await r.json();
    const f = (j && j.fields) || {};
    const out = {};
    Object.entries(f).forEach(([k, v]) => { out[k] = v.stringValue != null ? v.stringValue : v.timestampValue != null ? v.timestampValue : null; });
    return out;
  }

  /* The account behind a handle, with the name it shows - or null. */
  async function byHandle(raw, token, options) {
    const h = normHandle(raw);
    if (!h) return null;
    const hit = cache.get('h:' + h);
    if (!(options && options.fresh) && hit && now() - hit.at < TTL) return hit.v;
    const claim = await doc('handles/' + encodeURIComponent(h), token);
    let v = null;
    if (claim && claim.uid) {
      const prof = await doc('profiles/' + encodeURIComponent(claim.uid), token);
      // Both sides must agree, or the handle is mid-change and isn't used.
      if (prof && prof.name === h) v = { uid: claim.uid, handle: h, displayName: prof.displayName || h };
    }
    cache.set('h:' + h, { v, at: now() });
    return v;
  }

  /* An account's own handle and name, from its profile. */
  async function profileOf(uid, token) {
    const hit = cache.get('u:' + uid);
    if (hit && now() - hit.at < TTL) return hit.v;
    const prof = await doc('profiles/' + encodeURIComponent(uid), token);
    let v = null;
    if (prof && prof.name) {
      const claim = await doc('handles/' + encodeURIComponent(prof.name), token);
      if (claim && claim.uid === uid) v = { uid, handle: prof.name, displayName: prof.displayName || prof.name };
    }
    cache.set('u:' + uid, { v, at: now() });
    return v;
  }

  return { byHandle, profileOf, clear: () => cache.clear() };
}

/* Two handles a person could mistake for each other: the same once
   look-alike characters are folded (0/o, 1/l/i, 5/s, rn/m, vv/w, and
   dots and underscores dropped), or one typo apart. */
function fold(h) {
  return String(h).toLowerCase().replace(/[._]/g, '').replace(/rn/g, 'm').replace(/vv/g, 'w')
    .replace(/0/g, 'o').replace(/[1i]/g, 'l').replace(/5/g, 's').replace(/3/g, 'e').replace(/8/g, 'b');
}
function oneApart(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
function confusable(a, b) {
  if (!a || !b || a === b) return false;
  if (fold(a) === fold(b)) return true;
  return Math.min(a.length, b.length) >= 5 && oneApart(a, b);
}

module.exports = { makeDirectory, normHandle, confusable, fold };
