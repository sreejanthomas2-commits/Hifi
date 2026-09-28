// ── NAVIGATION ───────────────────────────────────────────────────
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

import { ensurePane } from './lazy.js?v=c4';

/* Through window, not the module-local binding a few lines down.
   components/mobile.js and features/discover.js both decorate
   window.navigateTo - closing Discover on the way out of it is one of
   those decorations - and a call to the local function walks straight
   past every one of them. Before the ES-module conversion every file
   shared one scope and the two were the same function, so this was
   free; afterwards the sidebar and the bottom bar were the only ways
   of navigating that stopped closing Discover, which left it sitting
   over whichever pane you had just asked for. */
const go = pane => (window.navigateTo || navigateTo)(pane);

function setupNav() {
  document.querySelectorAll('.nav-item[data-pane]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default raw browser hash URL shifts
      go(el.dataset.pane);
      closeSidebar();
    });
  });
  document.querySelectorAll('.m-nav-btn[data-pane]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default raw browser hash URL shifts
      go(el.dataset.pane);
    });
  });
  const ham = $id('hamburger');
  if (ham) ham.addEventListener('click', toggleSidebar);
  const ov = $id('sidebar-overlay');
  if (ov) ov.addEventListener('click', closeSidebar);

  // Three ways out of the drawer: the X, the dimmed area, and Escape.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const s = document.querySelector('.sidebar');
    if (s && s.classList.contains('open')) closeSidebar();
  });
}

/* Async because a page module may still need fetching — see lazy.js.
   Callers that only navigate can ignore the promise, which is what every
   inline onclick= handler does. Callers that navigate and then touch the
   new page must chain: navigateTo('profile').then(() => ...). */
async function navigateTo(pane) {
  // Clear the sidebar drawer overlays and drawer states
  closeSidebar();
  
  // Clear any modal or blur classes on document body
  document.body.classList.remove('modal-open');
  document.body.classList.remove('blurred-state');
  
  // Hide active modal popups to prevent obscuring views on transition
  const playStoreModal = $id('play-store-modal'); if (playStoreModal) { playStoreModal.style.display = 'none'; playStoreModal.classList.add('hidden'); }
  const courseDetailModal = $id('course-detail-modal'); if (courseDetailModal) { courseDetailModal.style.display = 'none'; courseDetailModal.classList.add('hidden'); }
  const gigWorkspaceModal = $id('gig-workspace-modal'); if (gigWorkspaceModal) { gigWorkspaceModal.style.display = 'none'; gigWorkspaceModal.classList.add('hidden'); }
  const eduReelsModal = $id('edu-reels-modal'); if (eduReelsModal) { eduReelsModal.style.display = 'none'; eduReelsModal.classList.add('hidden'); }
  const callModal = $id('call-modal'); if (callModal) { callModal.style.display = 'none'; callModal.classList.add('hidden'); }
  /* Fetch the page module if this is the first time here. Resolves
     immediately for everything boot.js already loaded. */
  await ensurePane(pane);

  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  let target = $id(`pane-${pane}`);
  if (!target) {
    const funcName = `get${pane.charAt(0).toUpperCase()}${pane.slice(1)}Template`;
    if (typeof window[funcName] === 'function') {
      try {
        const htmlContent = window[funcName]();
        const mainContent = $id('main-content');
        if (mainContent) {
          mainContent.insertAdjacentHTML('beforeend', htmlContent);
          target = $id(`pane-${pane}`);
        }
      } catch (err) {
        console.error(`Error rendering template for pane '${pane}':`, err);
      }
    }
  }
  
  if (!target && pane !== 'feeds') {
    console.warn(`Pane '${pane}' not found or failed to render. Falling back to 'feeds'.`);
    return navigateTo('feeds');
  }

  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.querySelector(`.nav-item[data-pane="${pane}"]`);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.m-nav-btn').forEach(n => n.classList.remove('active'));
  const mEl = document.querySelector(`.m-nav-btn[data-pane="${pane}"]`);
  if (mEl) mEl.classList.add('active');

  S.pane = pane;

  if (pane === 'trade') _safe('renderTrade', 'renderTrade');
  if (pane === 'portfolio') _safe('renderPortfolio', 'renderPortfolio');
  if (pane === 'p2p') _safe('renderP2p', 'renderP2p');
  if (pane === 'feeds') {
    _safe('renderFeed', 'renderFeed');
    _safe('renderStories', 'renderStories');
    _safe('renderWhoToFollow', 'renderWhoToFollow');
    _safe('renderTrending', 'renderTrending');
    _safe('renderHomeCrypto', 'renderHomeCrypto');
    _safe('renderHomeHub', 'renderHomeHub');
  }
  if (pane === 'explore') _safe('renderExplore', 'renderExplore');
  if (pane === 'cryptomarket') _safe('renderCryptomarket', 'renderCryptomarket');  if (pane === 'reels') _safe('renderReels', 'renderReels');
  if (pane === 'community') _safe('renderCommunity', 'renderCommunity');
  if (pane === 'profile') _safe('renderProfile', 'renderProfile');
  if (pane === 'messages') _safe('setupMessages', 'setupMessages');
  if (pane === 'earn') _safe('renderEarn', 'renderEarn');
  if (pane === 'settings') _safe('renderSettings', 'renderSettings');
  if (pane === 'card') _safe('renderCard', 'renderCard');
}

function toggleSidebar() {
  const s = document.querySelector('.sidebar');
  const o = $id('sidebar-overlay');
  if (s) s.classList.toggle('open');
  if (o) o.classList.toggle('open');
}
function closeSidebar() {
  const s = document.querySelector('.sidebar');
  const o = $id('sidebar-overlay');
  if (s) s.classList.remove('open');
  if (o) o.classList.remove('open');
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
import { publish } from './globals.js?v=3';
publish('router.js', {
  setupNav: () => setupNav, navigateTo: () => navigateTo,
  toggleSidebar: () => toggleSidebar, closeSidebar: () => closeSidebar
});
