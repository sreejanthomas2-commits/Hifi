/* ╔══════════════════════════════════════════════════════════════════╗
   ║  PREFS — the account's settings, and the one place they live     ║
   ║                                                                  ║
   ║  Settings & Activity is a control centre, and a control centre   ║
   ║  is only worth having if the controls are wired to something.    ║
   ║  This file is that something: every switch, choice and list the  ║
   ║  settings pages offer reads and writes here, and the rest of     ║
   ║  the app reads here too.                                         ║
   ║                                                                  ║
   ║  WHAT IT IS NOT                                                  ║
   ║                                                                  ║
   ║  It is not a second copy of settings that already have an owner. ║
   ║  Theme belongs to components/theme.js, language to langs.js,     ║
   ║  Discover's tuning to discover.js, addresses to walletaddr.js.   ║
   ║  Those are read through their owners and written through them,   ║
   ║  so there is never a stored answer disagreeing with the live     ║
   ║  one. Only settings with no home of their own are kept here.     ║
   ║                                                                  ║
   ║  LOCAL FIRST, THEN THE ACCOUNT                                   ║
   ║                                                                  ║
   ║  A change lands in localStorage and repaints immediately; the    ║
   ║  copy on the account follows when the network allows. A setting  ║
   ║  that only reached the cloud would be lost on a phone that was   ║
   ║  offline, and one that only reached the cloud slowly would feel  ║
   ║  broken. Signing in merges the account's copy in, newest wins    ║
   ║  per setting, so a second device does not overwrite the first.   ║
   ║                                                                  ║
   ║  NOTHING SECRET IS KEPT HERE                                     ║
   ║                                                                  ║
   ║  No password, no recovery phrase, no private key, no card. The   ║
   ║  security page turns things on and off and says what is on; the  ║
   ║  secrets themselves stay with the provider that owns them.       ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const TP = (() => {

  const KEY = 'ts_prefs_v1';
  const DEVKEY = 'ts_devices_v1';

  /* ── What a new account starts with ──────────────────────────────── */
  /* Defaults are the cautious answer wherever the cautious answer is
     not annoying: filters on, security alerts on, location off. */
  const DEFAULTS = {
    account: { type: 'personal' },

    privacy: {
      account: 'public',              // public | private
      activityStatus: true,
      readReceipts: true,
      storyAudience: 'followers',     // everyone | followers | close | nobody
      storyReplies: 'followers',      // everyone | followers | nobody
      liveAudience: 'followers',
      liveChat: 'followers',
      location: false,
      actLikes: true, actComments: true, actFollows: true, actCommunities: true,
      xpostThreads: false, xpostCommunities: false
    },

    interact: {
      messages: 'everyone',           // everyone | following | nobody
      requests: true,
      groupInvites: 'following',
      tags: 'everyone',
      tagApproval: false,
      mentions: 'everyone',
      comments: 'everyone',
      commentOffensive: true,
      commentSpam: true,
      shPosts: true, shShorty: true, shStories: true, shRepost: true, shDm: true,
      limitOn: false, limitComments: true, limitMessages: true, limitMentions: true,
      limitTags: true, limitFollows: false,
      hideOffensive: true, hideCustom: true, hideRequests: true, hideSpam: true
    },

    see: {
      likeCounts: 'show',             // show | hideOthers | hideAll
      shareCounts: 'show',
      sensitive: 'standard',          // less | standard | more
      suggested: true,
      topics: {}                      // topic key → 'more' | 'less'
    },

    notif: {
      pause: false,
      posts: true, messages: true, followers: true, mentions: true, comments: true,
      communities: true, live: true, creator: true, security: true, crypto: true,
      quietOn: false, quietFrom: '22:00', quietTo: '07:00',
      sound: true, vibrate: true
    },

    time: {
      reminder: 0,                    // minutes of daily use, 0 = off
      breaks: 0,                      // minutes between breaks, 0 = off
      sleepOn: false, sleepFrom: '23:00', sleepTo: '07:00'
    },

    media: {
      dataSaver: false,
      autoplay: 'wifi',               // always | wifi | never
      autoplaySound: false,
      uploadQuality: 'high',          // standard | high
      videoQuality: 'auto',           // auto | saver | high
      imageQuality: 'high',
      wifiOnlyHQ: true
    },

    a11y: {
      textScale: 100, contrast: false, motion: false, captions: true, haptics: true
    },

    archive: { stories: true, live: false, originals: true },

    security: { twoFactor: false, passkeys: false, alerts: true, loginAlerts: true },

    crypto: {
      confirmSends: true,             // review step before any hand-off
      whitelistOnly: false,           // only addresses in the address book
      hideBalances: false,
      notifPrice: true, notifDeposit: true, notifSend: true, notifSecurity: true,
      defaultNetwork: '',             // '' = ask every time
      verifyMins: 5                   // how long a verification lasts
    },

    /* Lists. Kept flat so a settings page can show a count without
       walking a tree. */
    blocked: {},                      // handle → { at }
    restricted: {},                   // handle → { at }
    closeFriends: {},                 // handle → { at }
    favorites: {},                    // handle → { at }
    mutedAccounts: {},                // handle → { posts, stories, notes, messages }
    hiddenWords: [],                  // custom words to hide
    sitePerms: {},                    // origin → { at, scopes }

    _at: {}                           // path → when it last changed, for merges
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

  /* A stored file from an older build is missing whatever was added
     since. Filling from DEFAULTS rather than replacing keeps the
     answers someone already chose. */
  function fill(into, from) {
    Object.keys(from).forEach(k => {
      if (isObj(from[k])) { if (!isObj(into[k])) into[k] = {}; fill(into[k], from[k]); }
      else if (into[k] === undefined) into[k] = Array.isArray(from[k]) ? from[k].slice() : from[k];
    });
    return into;
  }

  let P = null;
  const listeners = [];

  function load() {
    if (P) return P;
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    P = fill(isObj(raw) ? raw : {}, DEFAULTS);
    return P;
  }

  let saveTimer = 0;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {}
    clearTimeout(saveTimer);
    saveTimer = setTimeout(push, 1200);        // the account's copy can wait
  }

  function fire(path) {
    listeners.forEach(fn => { try { fn(path, P); } catch (e) {} });
  }

  /* ── Reading and writing by path ─────────────────────────────────── */

  function get(path, fallback) {
    load();
    const parts = String(path).split('.');
    let at = P;
    for (let i = 0; i < parts.length; i++) {
      if (!isObj(at) && !Array.isArray(at)) return fallback;
      at = at[parts[i]];
      if (at === undefined) return fallback;
    }
    return at;
  }

  function set(path, value) {
    load();
    if (JSON.stringify(get(path)) === JSON.stringify(value)) return value;
    const parts = String(path).split('.');
    let at = P;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!isObj(at[parts[i]])) at[parts[i]] = {};
      at = at[parts[i]];
    }
    at[parts[parts.length - 1]] = value;
    P._at[path] = Date.now();
    save();
    apply(path);
    fire(path);
    return value;
  }

  const toggle = path => set(path, !get(path));

  /* ── Lists of people, words and sites ────────────────────────────── */

  const norm = h => String(h || '').trim().replace(/^@+/, '').toLowerCase();

  function listAdd(list, handle, extra) {
    const h = norm(handle);
    if (!h) return false;
    load();
    if (!isObj(P[list])) P[list] = {};
    P[list][h] = Object.assign({ at: Date.now() }, extra || {});
    P._at[list] = Date.now();
    save(); fire(list);
    return true;
  }

  function listRemove(list, handle) {
    const h = norm(handle);
    load();
    if (!isObj(P[list]) || !P[list][h]) return false;
    delete P[list][h];
    P._at[list] = Date.now();
    save(); fire(list);
    return true;
  }

  const listHas = (list, handle) => !!(load()[list] || {})[norm(handle)];
  const listAll = list => Object.keys(load()[list] || {}).sort();
  const listCount = list => Object.keys(load()[list] || {}).length;

  function words() { return (load().hiddenWords || []).slice(); }
  function wordAdd(w) {
    const t = String(w || '').trim().toLowerCase();
    if (!t) return false;
    load();
    if (P.hiddenWords.indexOf(t) > -1) return false;
    P.hiddenWords.push(t);
    P._at.hiddenWords = Date.now();
    save(); fire('hiddenWords');
    return true;
  }
  function wordRemove(w) {
    load();
    const i = P.hiddenWords.indexOf(String(w || '').toLowerCase());
    if (i < 0) return false;
    P.hiddenWords.splice(i, 1);
    P._at.hiddenWords = Date.now();
    save(); fire('hiddenWords');
    return true;
  }

  /* The word filter the rest of the app calls. Offensive words come from
     a short built-in list; the custom list is whatever the person added.
     Matching is on word boundaries, so "class" is not caught by "ass". */
  const OFFENSIVE = ['scam', 'scammer', 'rugpull', 'rug pull', 'pump and dump', 'ponzi',
    'giveaway winner', 'send seed', 'seed phrase', 'private key', 'dm me for profit',
    'guaranteed returns', 'double your crypto', 'idiot', 'moron', 'loser', 'trash', 'kill yourself'];

  function hidden(text) {
    const t = String(text || '').toLowerCase();
    if (!t) return null;
    const hit = list => list.find(w => new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(t));
    if (get('interact.hideOffensive')) { const w = hit(OFFENSIVE); if (w) return w; }
    if (get('interact.hideCustom')) { const w = hit(words()); if (w) return w; }
    return null;
  }

  /* ── Settings that change the running app ────────────────────────── */

  /* Written as classes and CSS variables on <html>, so a preference
     survives every repaint without each page having to remember it. */
  function apply(path) {
    load();
    const root = document.documentElement;
    if (!root) return;
    if (!path || path.indexOf('a11y') === 0) {
      const scale = Math.max(80, Math.min(140, +get('a11y.textScale') || 100));
      root.style.setProperty('--text-scale', (scale / 100).toFixed(2));
      root.classList.toggle('tp-contrast', !!get('a11y.contrast'));
      root.classList.toggle('tp-still', !!get('a11y.motion'));
    }
    if (!path || path.indexOf('media') === 0) {
      root.classList.toggle('tp-saver', !!get('media.dataSaver'));
    }
    if (!path || path.indexOf('see') === 0) {
      const lc = get('see.likeCounts'), sc = get('see.shareCounts');
      root.classList.toggle('tp-no-likes', lc === 'hideAll' || lc === 'hideOthers');
      root.classList.toggle('tp-no-shares', sc === 'hideAll' || sc === 'hideOthers');
      // Tells "everywhere" apart from "other people's posts", which keeps your own.
      root.classList.toggle('tp-no-likes-all', lc === 'hideAll');
      root.classList.toggle('tp-no-shares-all', sc === 'hideAll');
    }
    if (!path || path.indexOf('crypto.hideBalances') === 0) {
      root.classList.toggle('tp-hide-bal', !!get('crypto.hideBalances'));
    }
  }

  /* Should a notification of this kind be shown right now? Read by
     anything that would like to interrupt someone. */
  function notifyOk(kind) {
    load();
    if (get('notif.pause')) return false;
    if (kind && get('notif.' + kind) === false) return false;
    if (get('notif.quietOn') && inWindow(get('notif.quietFrom'), get('notif.quietTo'))) {
      return kind === 'security';        // security still gets through
    }
    return true;
  }

  /* Windows that run past midnight are the normal case here, so the
     comparison has to handle from > to. */
  function inWindow(from, to, now) {
    const mins = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? (+m[1]) * 60 + (+m[2]) : -1; };
    const a = mins(from), b = mins(to);
    if (a < 0 || b < 0) return false;
    const d = now || new Date();
    const t = d.getHours() * 60 + d.getMinutes();
    return a <= b ? (t >= a && t < b) : (t >= a || t < b);
  }

  /* ── Money moves get a second look ───────────────────────────────── */

  /* A send, a withdrawal or a security change asks again, and the
     answer lasts a few minutes rather than for the session — long
     enough to do several things, short enough that a borrowed phone
     is not an open wallet. Nothing is stored: the clock is in memory
     and resets when the tab closes.

     Signed in, "again" means proving it is you to the sign-in provider:
     the password for an email account, a fresh Google or Apple sign-in
     in a pop-up for those. It used to be a Yes button, which anyone
     holding the unlocked device could press. A sign-in within the same
     few minutes already counts. A guest has nothing to re-prove - their
     paper money lives only on this device - so a guest still confirms. */
  let verifiedAt = 0;
  const verifiedFor = () => Math.max(1, +get('crypto.verifyMins') || 5) * 60000;
  const isVerified = () => Date.now() - verifiedAt < verifiedFor();
  const AUTH_SDK = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

  async function verify(what) {
    if (isVerified()) return true;
    const user = window.firebaseAuth && window.firebaseAuth.currentUser;
    const ok = user ? await reauthenticate(user, what || 'This change') : await confirmOnly(what);
    if (ok) verifiedAt = Date.now();
    return !!ok;
  }

  async function confirmOnly(what) {
    const ask = window.appConfirm;
    if (typeof ask !== 'function') return true;
    return !!(await ask(`${what || 'This change'} affects your money or your account security. Continue?`,
      { title: 'Confirm this change', ok: 'Yes, continue' }));
  }

  async function reauthenticate(user, what) {
    try {
      const t = await user.getIdTokenResult();
      if (Date.now() - Number(t.claims.auth_time) * 1000 < verifiedFor()) return true;
    } catch (e) { /* offline: fall through and ask */ }
    const ask = window.appConfirm, askText = window.appPrompt;
    const via = (user.providerData || []).map(p => p && p.providerId);
    const say = m => { if (m && typeof showToast === 'function') showToast(m); };
    try {
      const m = await import(AUTH_SDK);
      if (via.indexOf('password') > -1 && user.email && typeof askText === 'function') {
        const pw = await askText(`${what} affects your money or your account security. Enter your password to confirm it is you.`, '',
          { title: 'Confirm it is you', ok: 'Confirm', password: true });
        if (!pw) return false;
        await m.reauthenticateWithCredential(user, m.EmailAuthProvider.credential(user.email, pw));
        return true;
      }
      const google = via.indexOf('google.com') > -1, apple = via.indexOf('apple.com') > -1;
      if ((google || apple) && typeof ask === 'function') {
        if (!(await ask(`${what} affects your money or your account security. Sign in with ${google ? 'Google' : 'Apple'} again to confirm it is you.`,
          { title: 'Confirm it is you', ok: 'Continue' }))) return false;
        await m.reauthenticateWithPopup(user, google ? new m.GoogleAuthProvider() : new m.OAuthProvider('apple.com'));
        return true;
      }
      // A phone account would need a new text message; signing in again is simpler.
      if (typeof ask === 'function') {
        await ask('To confirm it is you, sign out and sign in again, then try this within a few minutes.', { title: 'Sign in again', ok: 'OK', alert: true });
      }
      return false;
    } catch (e) {
      const code = e && e.code;
      say(code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials' ? 'That password is not right.'
        : code === 'auth/too-many-requests' ? 'Too many attempts. Wait a few minutes and try again.'
        : code === 'auth/user-mismatch' ? 'That was a different account. Sign in with the one you are using here.'
        : code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' ? ''
        : 'That could not be confirmed. Check your connection and try again.');
      return false;
    }
  }
  const dropVerify = () => { verifiedAt = 0; };

  /* ── Devices signed in to this account ───────────────────────────── */

  /* A real list, not a decorated one: this browser records itself, and
     if the account syncs, the devices it has recorded come back with
     the rest of the settings. Ending a session here removes the record
     and, for this device, signs it out. */
  function deviceId() {
    let id = '';
    try { id = localStorage.getItem(DEVKEY + '_id') || ''; } catch (e) {}
    if (!id) {
      id = 'd' + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(DEVKEY + '_id', id); } catch (e) {}
    }
    return id;
  }

  function deviceName() {
    const ua = navigator.userAgent || '';
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android'
      : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS'
      : /Linux/.test(ua) ? 'Linux' : 'This device';
    const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return br + ' on ' + os;
  }

  function devices() {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(DEVKEY) || '{}') || {}; } catch (e) {}
    return Object.keys(all).map(id => Object.assign({ id, here: id === deviceId() }, all[id]))
      .sort((a, b) => (b.here ? 1 : 0) - (a.here ? 1 : 0) || (b.seen || 0) - (a.seen || 0));
  }

  function touchDevice() {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(DEVKEY) || '{}') || {}; } catch (e) {}
    const id = deviceId();
    all[id] = { name: deviceName(), first: (all[id] && all[id].first) || Date.now(), seen: Date.now() };
    try { localStorage.setItem(DEVKEY, JSON.stringify(all)); } catch (e) {}
  }

  function endDevice(id) {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(DEVKEY) || '{}') || {}; } catch (e) {}
    delete all[id];
    try { localStorage.setItem(DEVKEY, JSON.stringify(all)); } catch (e) {}
    fire('devices');
    return id === deviceId();
  }

  /* ── The copy on the account ─────────────────────────────────────── */

  /* Same shape as everywhere else in this app: the device is the truth
     it can always reach, and the account is a copy that catches up.
     A failed push is not an error anyone needs to see - the next
     change tries again. */
  const uid = () => (typeof S !== 'undefined' && S.user && S.user.uid) ? String(S.user.uid) : '';

  async function fire_store() {
    if (!window.db || !uid()) return null;
    const m = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    return { m, ref: m.doc(window.db, 'users', uid()) };
  }

  let pushing = false;
  async function push() {
    if (pushing || !uid() || !window.db) return false;
    pushing = true;
    try {
      const f = await fire_store();
      if (!f) return false;
      await f.m.setDoc(f.ref, { prefs: P, prefsAt: Date.now() }, { merge: true });
      return true;
    } catch (e) { return false; }
    finally { pushing = false; }
  }

  /* Merging, not replacing: for each path the newer timestamp wins, so
     a change made on a phone that was offline is not thrown away by a
     laptop that happened to sync first. */
  async function pull() {
    if (!uid() || !window.db) return false;
    try {
      const f = await fire_store();
      if (!f) return false;
      const snap = await f.m.getDoc(f.ref);
      if (!snap.exists()) return false;
      const far = (snap.data() || {}).prefs;
      if (!isObj(far)) return false;
      load();
      const at = isObj(far._at) ? far._at : {};
      Object.keys(at).forEach(path => {
        if ((at[path] || 0) <= (P._at[path] || 0)) return;
        const parts = path.split('.');
        let src = far;
        for (let i = 0; i < parts.length && src !== undefined; i++) src = (isObj(src) || Array.isArray(src)) ? src[parts[i]] : undefined;
        if (src === undefined) return;
        let dst = P;
        for (let i = 0; i < parts.length - 1; i++) { if (!isObj(dst[parts[i]])) dst[parts[i]] = {}; dst = dst[parts[i]]; }
        dst[parts[parts.length - 1]] = src;
        P._at[path] = at[path];
      });
      try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {}
      apply();
      fire('*');
      return true;
    } catch (e) { return false; }
  }

  /* ── Everything this device knows about you, as a file ───────────── */

  /* "Download your information" that actually downloads it. Reads the
     app's own storage keys, leaves anything that looks like a key or a
     token out, and hands back a blob the browser saves. */
  const SECRETISH = /(key|token|secret|seed|phrase|password)/i;

  function exportData() {
    const out = { app: 'Trending', exportedAt: new Date().toISOString(), account: {}, data: {} };
    const u = (typeof S !== 'undefined' && S.user) || {};
    out.account = { name: `${u.fname || ''} ${u.lname || ''}`.trim(), handle: u.handle || '', signedIn: !!u.uid };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf('ts_') !== 0 || SECRETISH.test(k)) continue;
      const raw = localStorage.getItem(k);
      try { out.data[k] = JSON.parse(raw); } catch (e) { out.data[k] = raw; }
    }
    return out;
  }

  function download() {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trending-data-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }

  /* ── What the device will let the app do ─────────────────────────── */

  /* Answers come from the browser, not from a stored guess, so the row
     cannot claim the camera is allowed after someone revoked it. */
  async function permission(name) {
    const map = { camera: 'camera', microphone: 'microphone', location: 'geolocation', notifications: 'notifications' };
    if (name === 'notifications' && typeof Notification !== 'undefined') {
      const p = Notification.permission;
      return p === 'default' ? 'ask' : p;
    }
    if (!navigator.permissions || !navigator.permissions.query || !map[name]) return 'unknown';
    try {
      const r = await navigator.permissions.query({ name: map[name] });
      return r.state === 'prompt' ? 'ask' : r.state;
    } catch (e) { return 'unknown'; }
  }

  async function request(name) {
    try {
      if (name === 'notifications') {
        if (typeof Notification === 'undefined') return 'unknown';
        const r = await Notification.requestPermission();
        return r === 'default' ? 'ask' : r;
      }
      if (name === 'location') {
        return await new Promise(res => navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(() => res('granted'), () => res('denied'), { timeout: 8000 })
          : res('unknown'));
      }
      if (name === 'camera' || name === 'microphone') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'unknown';
        const s = await navigator.mediaDevices.getUserMedia(name === 'camera' ? { video: true } : { audio: true });
        s.getTracks().forEach(t => t.stop());
        return 'granted';
      }
    } catch (e) { return 'denied'; }
    return 'unknown';
  }

  /* ── Time in the app ─────────────────────────────────────────────── */

  /* Counted here, on the device, and never sent anywhere — a usage
     figure that had to be uploaded to be shown would be worse than not
     showing one. Only time with the tab actually visible counts, so
     leaving Trending open in a background tab does not inflate it. */
  const TKEY = 'ts_time_v1';
  const today = () => new Date().toISOString().slice(0, 10);
  let seenAt = Date.now(), sat = 0, nudged = { day: false, sit: false };

  function timeRead() {
    let t = {};
    try { t = JSON.parse(localStorage.getItem(TKEY) || '{}') || {}; } catch (e) {}
    if (t.day !== today()) t = { day: today(), ms: 0 };
    return t;
  }

  const usedToday = () => timeRead().ms || 0;

  function tick() {
    const now = Date.now();
    const gap = now - seenAt;
    seenAt = now;
    if (document.hidden || gap > 120000) { sat = 0; nudged.sit = false; return; }
    const t = timeRead();
    t.ms = (t.ms || 0) + gap;
    try { localStorage.setItem(TKEY, JSON.stringify(t)); } catch (e) {}
    sat += gap;

    const daily = (+get('time.reminder') || 0) * 60000;
    if (daily && t.ms >= daily && !nudged.day) {
      nudged.day = true;
      if (typeof window.showToast === 'function') window.showToast('You have been on Trending for ' + Math.round(t.ms / 60000) + ' minutes today.');
    }
    const brk = (+get('time.breaks') || 0) * 60000;
    if (brk && sat >= brk && !nudged.sit) {
      nudged.sit = true;
      sat = 0;
      if (typeof window.showToast === 'function') window.showToast('Time for a break — you have been here ' + Math.round(brk / 60000) + ' minutes straight.');
    }
  }

  document.addEventListener('visibilitychange', () => { seenAt = Date.now(); if (document.hidden) sat = 0; });
  setInterval(tick, 20000);

  /* ── Starting up ─────────────────────────────────────────────────── */

  function reset() {
    P = clone(DEFAULTS);
    try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {}
    apply();
    fire('*');
  }

  const on = fn => { if (typeof fn === 'function') listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); } };

  load();
  apply();
  touchDevice();
  /* Signing in brings the account's copy down; it may arrive after the
     first paint, which is why anything showing a preference listens. */
  setTimeout(() => { if (uid()) pull(); }, 2500);

  return {
    get, set, toggle, on, reset, apply, all: load,
    listAdd, listRemove, listHas, listAll, listCount,
    words, wordAdd, wordRemove, hidden,
    notifyOk, inWindow,
    verify, isVerified, dropVerify,
    usedToday,
    devices, endDevice, deviceName,
    exportData, download,
    permission, request,
    push, pull,
    get DEFAULTS() { return clone(DEFAULTS); }
  };
})();

window.TP = TP;

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module, so its top-level names are private to it.
   Inline onclick= handlers and every other module still look them up
   on the global object, so they are republished here. */
import { publish } from '../globals.js?v=3';
publish('features/prefs.js', {
  TP: () => TP
});
