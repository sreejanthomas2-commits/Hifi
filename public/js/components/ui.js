// ── USER UI ──────────────────────────────────────────────────────
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

/* Ghost Mode (Settings, through toggleAnonymousMode) has to reach the
   sidebar, or the toast claims the identity is hidden while the name
   and handle sit there in plain sight. That branch used to live in a
   second updateUserUI in utils/engine.js, which this one silently
   overwrote - ui.js loads two lines after engine.js in boot.js - so
   the switch had stopped changing anything on screen. Only the
   sidebar identity is masked here, which is all the original masked;
   posts are anonymised separately in pages/feeds.js and
   features/create.js. */
function updateUserUI() {
  const u = S.user || { fname: 'Guest' };
  const isGuest = u.fname === 'Guest';
  const isAnon = !!(typeof S !== 'undefined' && S.anonymousMode);
  
  const sn = $id('sidebar-name');
  const sh = $id('sidebar-handle');
  const sav = $id('sidebar-av');
  
  if (isAnon) {
    if (sn) sn.textContent = 'Anonymous User';
    if (sh) sh.textContent = '@ghost_user';
    if (sav) { sav.textContent = '👻'; sav.style.background = '#333'; }
  } else if (isGuest) {
    if (sav) sav.style.background = '';
    if (sn) sn.textContent = 'Sign In to Trending';
    if (sh) sh.textContent = 'Unlock your digital universe';
    if (sav) sav.innerHTML = '<span class="material-symbols-rounded" style="font-size:16px">login</span>';
  } else {
    if (sav) sav.style.background = '';
    const initials = `${(u.fname||'A')[0]}${(u.lname||'V')[0]}`.toUpperCase();
    ['sidebar-av','header-av','composer-av','profile-av'].forEach(id => {
      const el = $id(id); if (el) el.textContent = initials;
    });
    if (sn) sn.textContent = `${u.fname} ${u.lname}`;
    if (sh) sh.textContent = u.handle;
  }
  
  const pn = $id('profile-name');   if (pn) pn.textContent = `${u.fname} ${u.lname}`;
  const ph = $id('profile-handle'); if (ph) ph.textContent = `${u.handle} · Level ${u.level || 1}`;
  const pb = $id('profile-bio');    if (pb) pb.textContent = u.bio;
}

/* This sat on the same line as the brace above it: `}function ...`. It
   was a top-level declaration either way, but the bridge generator
   looks for declarations at the start of a line, so it was never
   published to the global object - and index.html's sidebar calls it
   from an onclick, which had silently done nothing since the module
   conversion. */
function handleUserAuthClick() {
  const isGuest = S.user && S.user.fname === 'Guest';
  if (isGuest) {
    if (typeof openAuthModal === 'function') openAuthModal();
  } else {
    if (typeof navigateTo === 'function') navigateTo('profile');
  }
}

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module now, so its top-level names are private
   to it. Inline onclick= handlers and every other module still look
   them up on the global object, so they are republished here.

   Each one is a thunk because the list is produced by scanning, and
   scanning over-collects — a line inside a template literal can look
   like a declaration. publish() calls each thunk and skips the ones
   that do not resolve, so a phantom costs one caught error and not a
   dead module graph. */
import { publish } from '../globals.js?v=3';
publish('components/ui.js', {
  handleUserAuthClick: () => handleUserAuthClick,
  updateUserUI: () => updateUserUI
});
