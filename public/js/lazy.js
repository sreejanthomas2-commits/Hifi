/* ╔══════════════════════════════════════════════════════════════════╗
   ║  LAZY — the pages that load when you open them                    ║
   ║                                                                   ║
   ║  boot.js loads everything the app needs to be a working app. The  ║
   ║  modules listed here are not that: each one draws a single page   ║
   ║  and is dead weight until someone asks for that page.             ║
   ║                                                                   ║
   ║  WHAT IS NOT HERE MATTERS MORE THAN WHAT IS.                      ║
   ║                                                                   ║
   ║  Deferring a module is only safe if two things hold. Miss either  ║
   ║  and nothing crashes — the app just quietly does the wrong thing, ║
   ║  which is how this list got too long once already.                ║
   ║                                                                   ║
   ║  1. NOTHING LOADED AT BOOT MAY READ ITS GLOBALS.                  ║
   ║                                                                   ║
   ║     trade.js    owns the Spot balances the wallet, Assets and     ║
   ║                 chat crypto read. Deferred, Spot reads as zero.   ║
   ║     earn.js     owns the staked value netWorth() adds up.         ║
   ║     messages.js declares showToast, which everything calls.       ║
   ║     explore.js  main.js calls setupUniversalSearch() at startup.  ║
   ║                 Deferred, the search bar never starts.            ║
   ║     feeds.js    is the page you land on.                          ║
   ║                                                                   ║
   ║  2. NO NAME IT DECLARES MAY ALSO BE DECLARED SOMEWHERE ELSE.      ║
   ║                                                                   ║
   ║     With fixed script order a duplicate had one fixed winner.     ║
   ║     Loaded on demand, the winner becomes whichever page you       ║
   ║     opened last — the same app behaving differently depending on  ║
   ║     where you clicked first. That rules out:                      ║
   ║                                                                   ║
   ║     communityhub.js  getCommunityTemplate and renderCommunity are ║
   ║                      also in communehub.js                        ║
   ║     profile.js       updateUserUI is also in engine.js, ui.js,    ║
   ║                      profileme.js and notes.js                    ║
   ║                                                                   ║
   ║     Those two go back on this list once the duplicates are        ║
   ║     renamed. scripts/audit-frontend.js reports them.              ║
   ║                                                                   ║
   ║  This file is the version manifest for the modules it lists, the  ║
   ║  way boot.js is for the rest.                                     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

/* pane name (as navigateTo receives it) → the module that draws it. */
const PAGES = {
  /* Nothing at boot reads the hub's globals: it only reads everyone
     else's (MNY, TR, P2P), and MNY checks CXH exists before calling it. */
  cryptohub:    './pages/cryptohub.js?v=hb1',
  reels:        './pages/reels.js?v=cm1',
  cryptomarket: './pages/cryptomarket.js?v=8m8',
  settings:     './pages/settings.js?v=sec2'
};

/* One promise per module, so two quick taps on the same tab do not
   fetch it twice and a failed load can be retried. */
const inflight = new Map();

export function isLazy(pane) { return Object.prototype.hasOwnProperty.call(PAGES, pane); }

export function isLoaded(pane) {
  const spec = PAGES[pane];
  return !spec || (inflight.has(spec) && inflight.get(spec).done === true);
}

/* Returns a promise that settles once the page can be drawn. For a page
   that was never deferred this resolves immediately, so callers can
   await it unconditionally. */
export function ensurePane(pane) {
  const spec = PAGES[pane];
  if (!spec) return Promise.resolve(false);
  if (inflight.has(spec)) return inflight.get(spec).promise;

  const entry = { done: false, promise: null };
  entry.promise = import(spec)
    .then(() => { entry.done = true; return true; })
    .catch(err => {
      /* Let it be retried — a page that failed to load once because the
         network blinked should not stay broken for the session. */
      inflight.delete(spec);
      console.error(`[lazy] ${pane} could not be loaded from ${spec}`, err);
      return false;
    });

  inflight.set(spec, entry);
  return entry.promise;
}

/* For the console: what has actually been fetched so far. */
export function loaded() {
  return Object.keys(PAGES).filter(p => isLoaded(p));
}

globalThis.__lazy = { ensurePane, isLazy, isLoaded, loaded, PAGES };
