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

