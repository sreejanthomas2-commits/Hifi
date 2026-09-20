/* ╔══════════════════════════════════════════════════════════════════╗
   ║  UID — who you are, everywhere in the app                        ║
   ║                                                                  ║
   ║  One account identifier, and everything that addresses a person  ║
   ║  derives from it: the Pay ID on your QR, the Trending Tag people ║
   ║  can type, the code the scanner reads, and the destination a     ║
   ║  chat payment settles to.                                        ║
   ║                                                                  ║
   ║  WHY THIS FILE EXISTS                                            ║
   ║                                                                  ║
   ║  It did not, and the addressing did not round-trip. Your own Pay ║
   ║  ID was minted at random on first use and kept in localStorage,  ║
   ║  while every other account's was a hash of their handle. So the  ║
   ║  number on your QR was not the number anyone else's app would    ║
   ║  work out for you, and it changed on a new device, in a second   ║
   ║  browser, or the moment site data was cleared. Signing in did    ║
   ║  not touch it: the Firebase uid landed on S.user.uid and nothing ║
   ║  read it.                                                        ║
   ║                                                                  ║
   ║  Now there is one root. Signed in, it is the Firebase uid, so    ║
   ║  the same account shows the same code on every device it opens.  ║
   ║  Signed out, it is a guest uid minted once and kept locally -    ║
   ║  seeded, on first run, from whatever random Pay ID that browser  ║
   ║  already had, so nobody's existing code changes under them.      ║
   ║                                                                  ║
   ║  THE TAG IS NOT A BLOCKCHAIN ADDRESS                             ║
   ║                                                                  ║
   ║  TRD-XXXX-XXXX is an in-app destination. It moves the simulated  ║
   ║  balance between two Trending accounts and it means nothing to   ║
   ║  any chain. It is deliberately shaped so it can never be         ║
   ║  mistaken for one - no 0x, no bech32, no base58, and the letters ║
   ║  that look like digits are not in the alphabet. Real receiving   ║
   ║  addresses live in features/walletaddr.js, which never invents   ║
   ║  one; this file never produces one either.                       ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const UID = (() => {

  const KEY = 'ts_uid_guest';
  const listeners = [];
  let last = '';

  /* ── The root ────────────────────────────────────────────────────── */

  /* Signed in: the account's own id, the same on every device. Signed
     out: one minted for this browser and kept. */
  function get() {
    const signed = (typeof S !== 'undefined' && S.user && S.user.uid) ? String(S.user.uid) : '';
    if (signed) return signed;
    return guest();
  }

  function guest() {
    let g = '';
    try { g = localStorage.getItem(KEY) || ''; } catch (e) {}
    if (g) return g;
    /* Keep the Pay ID this browser is already showing, if it has one,
       so upgrading does not silently reissue somebody's code. */
    let seed = '';
    try {
      const old = JSON.parse(localStorage.getItem('ts_pay') || '{}');
      if (old && old.id) seed = 'legacy:' + old.id;
    } catch (e) {}
    g = seed || ('guest:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    try { localStorage.setItem(KEY, g); } catch (e) {}
    return g;
  }

  const isGuest = () => !(typeof S !== 'undefined' && S.user && S.user.uid);

  /* ── Derivations ─────────────────────────────────────────────────
     Two independent hashes of the same root. One number, one word, and
     neither can be worked back into the other, which matters only in
     that the Tag does not leak the Pay ID to someone who reads it. */

  function fnv(s, offset) {
    let h = offset >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  /* A legacy guest keeps the exact digits it had. */
  function payIdOf(root) {
    const s = String(root || '');
    const m = s.match(/^legacy:(\d{9})$/);
    if (m) return m[1];
    return String(100000000 + (fnv(s, 2166136261) % 900000000));
  }

  /* No I, O, S or Z, and no digits that could be read as letters: a Tag
     is meant to be read aloud and typed back in without a correction. */
  const ALPHA = '23456789ABCDEFGHJKLMNPQRTUVWXY';
  function tagOf(root) {
    let h = fnv(String(root || ''), 0x811c9dc5 ^ 0x5bf03635);
    let out = '';
    for (let i = 0; i < 8; i++) {
      out += ALPHA[h % ALPHA.length];
      h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0;
      if (i === 3) out += '-';
    }
    return 'TRD-' + out;
  }

  /* Anyone else, addressed by whatever we know them by. A handle is
     lower-cased first so @Sarah and @sarah are one person. */
  const rootOf = who => {
    const s = String(who || '').trim();
    return s.startsWith('@') ? 'handle:' + s.toLowerCase() : s;
  };
  const of = who => ({ uid: rootOf(who), payId: payIdOf(rootOf(who)), tag: tagOf(rootOf(who)) });

  const payId = () => payIdOf(get());
  const tag = () => tagOf(get());
  const pretty = id => String(id || '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');

  /* ── Reading one back ────────────────────────────────────────────
     Accepts a Tag, a nine-digit Pay ID with or without its spaces, or
     an @handle, and says which it was. Anything else is refused rather
     than guessed at - a payment destination is not a place to be
     generous about input. */
  const TAG_RE = /^TRD-[23456789ABCDEFGHJKLMNPQRTUVWXY]{4}-[23456789ABCDEFGHJKLMNPQRTUVWXY]{4}$/;

  function parse(text) {
    const raw = String(text || '').trim();
    if (!raw) return { ok: false, kind: '', raw };

    const asTag = raw.toUpperCase().replace(/\s+/g, '');
    if (TAG_RE.test(asTag)) return { ok: true, kind: 'tag', tag: asTag, raw };

    const asId = raw.replace(/[\s-]/g, '');
    if (/^\d{9}$/.test(asId)) return { ok: true, kind: 'payid', payId: asId, raw };

    if (/^@[a-z0-9_.]{2,30}$/i.test(raw)) return { ok: true, kind: 'handle', handle: raw.toLowerCase(), raw };

    return { ok: false, kind: '', raw };
  }

  /* Who does that address belong to? Contacts are the simulated
     accounts in DATA.users; the answer also says when it is you, so a
     caller can stop before trying to pay yourself. */
  function contacts() {
    const list = (typeof DATA !== 'undefined' && DATA.users) || [];
    return list.map(u => {
      const d = of(u.handle);
      return { name: u.name, handle: u.handle, online: !!u.online, uid: d.uid, payId: d.payId, tag: d.tag };
    });
  }

  function resolve(text) {
    const p = parse(text);
    if (!p.ok) return { ok: false, reason: 'That is not a Trending Tag, a Pay ID or a handle.' };

    const mine = { payId: payId(), tag: tag() };
    if ((p.kind === 'tag' && p.tag === mine.tag) ||
        (p.kind === 'payid' && p.payId === mine.payId)) {
      return { ok: false, self: true, reason: "That is your own code — you cannot pay yourself." };
    }

    const found = contacts().find(c =>
      (p.kind === 'tag' && c.tag === p.tag) ||
      (p.kind === 'payid' && c.payId === p.payId) ||
      (p.kind === 'handle' && c.handle.toLowerCase() === p.handle));
    if (found) return { ok: true, kind: p.kind, account: found };

    return { ok: false, reason: 'No Trending account matches that code.' };
  }

  /* ── Me ──────────────────────────────────────────────────────────── */
  function me() {
    const u = (typeof S !== 'undefined' && S.user) ? S.user : {};
    const name = `${u.fname || 'Guest'} ${u.lname || ''}`.trim() || 'Guest';
    let handle = String(u.handle || '').trim();
    if (!handle || handle === 'Sign In') handle = '@' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (handle[0] !== '@') handle = '@' + handle;
    return { name, handle, uid: get(), payId: payId(), tag: tag(), guest: isGuest() };
  }

  /* ── Changes ─────────────────────────────────────────────────────
     Signing in swaps the root, so every code on screen is stale the
     instant it happens. Anything showing one subscribes here. */
  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  function check() {
    const now = get();
    if (now === last) return;
    last = now;
    listeners.forEach(fn => { try { fn(me()); } catch (e) {} });
  }

  /* Anything showing a code repaints itself when the root changes. */
  onChange(() => {
    try { if (typeof window.repaintWalletTab === 'function') window.repaintWalletTab(); } catch (e) {}
  });

  last = get();
  if (typeof window !== 'undefined') {
    /* S.user is replaced wholesale by the auth-state handler rather than
       mutated, so there is nothing to observe; a slow poll is enough for
       something that changes once a session. */
    setInterval(check, 1500);
    window.addEventListener('focus', check);
  }

  return { get, isGuest, payId, tag, pretty, of, me, parse, resolve, contacts, onChange, check, TAG_RE };
})();

window.UID = UID;

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module, so its top-level names are private to it.
   Inline onclick= handlers and every other module still look them up on
   the global object, so they are republished here. */
import { publish } from '../globals.js?v=3';
publish('features/uid.js', {
  UID: () => UID
});
