/* ╔══════════════════════════════════════════════════════════════════╗
   ║  LAZY — the pages that load when you open them                    ║
   ║                                                                   ║
   ║  boot.js loads everything the app needs to be a working app. The  ║
   ║  modules listed here are not that: each one draws a single page   ║
   ║  and is dead weight until someone asks for that page. They are    ║
   ║  imported on the first navigation to it and never again.          ║
   ║                                                                   ║
   ║  WHAT IS NOT HERE MATTERS MORE THAN WHAT IS.                      ║
   ║                                                                   ║
   ║  A page module can only be deferred if nothing still loading at   ║
   ║  boot reads one of its globals. That rules out more than it       ║
   ║  sounds like:                                                     ║
   ║                                                                   ║
   ║    trade.js    owns the Spot balances, which the wallet, the      ║
   ║                Assets page and chat crypto all read. Deferred, a  ║
   ║                Spot balance would read as zero until you happened ║
   ║                to open the trading desk.                          ║
   ║    earn.js     owns the staked value that MNY.netWorth() adds up. ║
   ║                Deferred, your total would silently be missing it. ║
   ║    messages.js declares showToast, which the whole app calls.     ║
   ║    feeds.js    is the page you land on.                           ║
   ║                                                                   ║
   ║  Those four are the interesting cases: deferring them would not   ║
   ║  crash anything. It would quietly return a wrong number, which is ║
   ║  worse. They stay in boot.js until the data they own moves out of ║
   ║  the page module that happens to hold it.                         ║
   ║                                                                   ║
   ║  This file is the version manifest for the modules it lists, the  ║
   ║  way boot.js is for the rest.                                     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

/* pane name (as navigateTo receives it) → the module that draws it. */
const PAGES = {
  explore:      './pages/explore.js?v=17m5',
  category:     './pages/explore.js?v=17m5',      // same file, getCategoryTemplate
  reels:        './pages/reels.js?v=20260916em5',
  fashionverse: './pages/fashionverse.js?v=5m5',
  cryptomarket: './pages/cryptomarket.js?v=8m5',
  dao:          './pages/web3communities.js?v=3m5',
  community:    './pages/communityhub.js?v=5m5',
  profile:      './pages/profile.js?v=20m5',
  settings:     './pages/settings.js?v=20260917cm5'
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
