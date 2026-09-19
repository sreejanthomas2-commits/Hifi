// ── USER UI ──────────────────────────────────────────────────────
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

function updateUserUI() {
  const u = S.user || { fname: 'Guest' };
  const isGuest = u.fname === 'Guest';
  
  const sn = $id('sidebar-name');
  const sh = $id('sidebar-handle');
  const sav = $id('sidebar-av');
  
  if (isGuest) {
    if (sn) sn.textContent = 'Sign In to Trending';
    if (sh) sh.textContent = 'Unlock your digital universe';
    if (sav) sav.innerHTML = '<span class="material-symbols-rounded" style="font-size:16px">login</span>';
  } else {
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

// ── CATEGORY GRID ────────────────────────────────────────────────
function renderCategoryGrid() {
  const container = document.getElementById('full-category-grid');
  if (!container) return;
  
  const categories = [
    { icon: 'biotech', name: 'Tech & AI', color: '#7C4DFF' },
    { icon: 'palette', name: 'Digital Art', color: '#FF4081' },
    { icon: 'currency_bitcoin', name: 'Crypto & Web3', color: '#FFB300' },
    { icon: 'fitness_center', name: 'Fitness & Health', color: '#00E676' },
    { icon: 'public', name: 'Global News', color: '#29B6F6' },
    { icon: 'science', name: 'Science', color: '#18FFFF' },
    { icon: 'movie', name: 'Cinema', color: '#FF5252' },
    { icon: 'music_note', name: 'Music Hub', color: '#E040FB' },
    { icon: 'sports_esports', name: 'Gaming', color: '#69F0AE' },
    { icon: 'restaurant', name: 'Culinary', color: '#FF9100' },
    { icon: 'flight_takeoff', name: 'Travel', color: '#81D4FA' },
    { icon: 'trending_up', name: 'Finance', color: '#4CAF50' },
    { icon: 'menu_book', name: 'Literature', color: '#BCAAA4' },
    { icon: 'brush', name: 'Design', color: '#CE93D8' },
    { icon: 'architecture', name: 'Architecture', color: '#90CAF9' },
    { icon: 'history_edu', name: 'History', color: '#DCE775' },
    { icon: 'psychology', name: 'Psychology', color: '#FFAB91' },
    { icon: 'self_improvement', name: 'Wellness', color: '#B2DFDB' },
    { icon: 'balance', name: 'Law & Policy', color: '#9E9E9E' },
    { icon: 'rocket_launch', name: 'Space Exploration', color: '#5C6BC0' },
    { icon: 'eco', name: 'Sustainability', color: '#8BC34A' },
    { icon: 'business_center', name: 'Startups', color: '#FFCA28' },
    { icon: 'draw', name: 'Animation', color: '#F48FB1' },
    { icon: 'pets', name: 'Animals', color: '#A1887F' },
    { icon: 'photo_camera', name: 'Photography', color: '#B0BEC5' },
    { icon: 'sports_soccer', name: 'Sports', color: '#FF8A65' },
    { icon: 'directions_car', name: 'Automotive', color: '#90A4AE' },
    { icon: 'code', name: 'Programming', color: '#4FC3F7' },
    { icon: 'memory', name: 'Hardware', color: '#9FA8DA' },
    { icon: 'home', name: 'Real Estate', color: '#81C784' },
    { icon: 'school', name: 'Education', color: '#FFB74D' },
    { icon: 'gavel', name: 'Democracy', color: '#BA68C8' },
    { icon: 'mic', name: 'Podcasts', color: '#F06292' },
    { icon: 'theater_comedy', name: 'Comedy', color: '#4DD0E1' },
    { icon: 'nature_people', name: 'Outdoors', color: '#AED581' },
    { icon: 'style', name: 'Beauty', color: '#F8BBD0' },
    { icon: 'emoji_objects', name: 'DIY & Crafts', color: '#FFF176' },
    { icon: 'child_care', name: 'Parenting', color: '#81D4FA' },
    { icon: 'favorite', name: 'Relationships', color: '#F06292' },
    { icon: 'park', name: 'Gardening', color: '#C5E1A5' },
    { icon: 'local_florist', name: 'Botany', color: '#69F0AE' },
    { icon: 'translate', name: 'Languages', color: '#64B5F6' },
    { icon: 'mosque', name: 'Philosophy', color: '#9575CD' },
    { icon: 'event', name: 'Events', color: '#4DB6AC' },
    { icon: 'celebration', name: 'Festivals', color: '#FF8A65' },
    { icon: 'work', name: 'Careers', color: '#A1887F' },
    { icon: 'military_tech', name: 'Defense', color: '#78909C' },
    { icon: 'campaign', name: 'Activism', color: '#E57373' },
    { icon: 'diversity_3', name: 'Culture', color: '#BA68C8' }
  ];

  container.innerHTML = categories.map(cat => `
    <div class="category-card" onclick="showToast('Explored ${cat.name} universe! dY"S'); document.getElementById('category-modal').classList.add('hidden')">
      <div class="material-symbols-rounded" style="font-size: 32px; color: ${cat.color}; margin-bottom: 12px">${cat.icon}</div>
      <div class="fw6 tc-1 fs14">${cat.name}</div>
    </div>
  `).join('');
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
  updateUserUI: () => updateUserUI,
  renderCategoryGrid: () => renderCategoryGrid
});
