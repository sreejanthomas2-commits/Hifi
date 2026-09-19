/* ╔══════════════════════════════════════════════════════════════╗
   ║  TRENDING -- app.js  Complete Digital Ecosystem v4.0     ║
   ╚══════════════════════════════════════════════════════════════╝  */

'use strict';

// ── BOOT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _safe('initApp', 'initApp');
});

function initApp() {
  // Load posts and comments from LocalStorage for persistence
  const savedPosts = localStorage.getItem('ts_posts');
  if (savedPosts && savedPosts !== 'undefined') {
    try { DATA.posts = JSON.parse(savedPosts); } catch(e) {}
  } else {
    localStorage.setItem('ts_posts', JSON.stringify(DATA.posts || []));
  }

  const savedComments = localStorage.getItem('ts_comments_db');
  if (savedComments && savedComments !== 'undefined') {
    try { DATA.commentsDb = JSON.parse(savedComments); } catch(e) {}
  } else {
    DATA.commentsDb = DATA.commentsDb || {};
    localStorage.setItem('ts_comments_db', JSON.stringify(DATA.commentsDb));
  }

  updateUserUI();
  _safe('renderCategoryGrid', 'renderCategoryGrid');
  _safe('setupNav',       'setupNav');
  _safe('setupHeader',    'setupHeader');
  _safe('setupMessages',  'setupMessages');
  _safe('setupAI',        'setupAI');
  _safe('setupUniversalSearch', 'setupUniversalSearch');
  _safe('populateCategorySidebar', 'populateCategorySidebar');
  
  // Language is chosen in Settings now; here we just restore the choice.
  const savedLang = localStorage.getItem('ts_lang') || 'en';
  _safe(() => applyLanguage(savedLang), 'applyLanguage');

  _safe('initAdRevenueAccrual', 'initAdRevenueAccrual');
  
  navigateTo('feeds');
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
publish('main.js', {
  initApp: () => initApp
});
