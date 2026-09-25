// ── SAFE HELPER ──────────────────────────────────────────────────
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

function $id(id) { return document.getElementById(id); }
/* Everything comes back as escaped text. Non-strings used to be passed
   through untouched, so an array or object reached the page through
   its own toString() without any escaping at all - and a post's fields
   now arrive from other people's accounts, where the type is theirs. */
function escapeHTML(str) {
  str = str == null ? '' : String(str);
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
/* A value passed as an argument to a function called from a quoted
   inline handler attribute. Two readers see it: the HTML parser decodes
   the attribute first - turning &#39; back into an apostrophe - and then
   JS parses what is left. So it is encoded for JS first (JSON: quotes,
   backslashes, and numbers stay numbers) and then escaped for HTML, which
   the attribute decoding undoes exactly. escapeHTML alone inside '...' is
   not enough: the decoded apostrophe closes the string. */
function jsArg(v) {
  return escapeHTML(JSON.stringify(v === undefined ? null : v));
}
/* Accepts a function OR a global's name. Passing a bare identifier that
   does not exist throws a ReferenceError while the argument is being
   evaluated — before this function is even entered — which is enough to
   kill the whole boot sequence. Passing the name as a string avoids that,
   so one missing module can no longer take the app down with it. */
function _safe(fn, label) {
  try {
    const f = typeof fn === 'string' ? window[fn] : fn;
    if (typeof f === 'function') return f();
    console.warn('[TS]', label || fn, 'is not defined — skipped');
  } catch (e) { console.warn('[TS]', label, e.message); }
}

function get3DIconForEmoji(emoji) {
  const map = {
    // Categories & topics
    '🔬': { icon: 'science', color: 'var(--blue)' },
    '📰': { icon: 'newspaper', color: 'var(--purple)' },
    '🪙': { icon: 'toll', color: 'var(--orange)' },
    '🎮': { icon: 'sports_esports', color: 'var(--orange)' },
    '🎵': { icon: 'music_note', color: 'var(--pink)' },
    '💻': { icon: 'terminal', color: 'var(--blue)' },
    '🦌': { icon: 'pets', color: 'var(--green)' },
    '📍': { icon: 'location_on', color: 'var(--blue)' },
    '🏠': { icon: 'home', color: 'var(--blue)' },
    '🔥': { icon: 'local_fire_department', color: 'var(--orange)' },
    '📢': { icon: 'campaign', color: 'var(--pink)' },
    '🎭': { icon: 'theater_comedy', color: 'var(--purple)' },
    '🚀': { icon: 'rocket_launch', color: 'var(--purple)' },
    '🌳': { icon: 'park', color: 'var(--green)' },
    '🌱': { icon: 'eco', color: 'var(--green)' },
    '🌦️': { icon: 'partly_cloudy_day', color: 'var(--orange)' },
    '🌍': { icon: 'public', color: 'var(--blue)' },
    '🔗': { icon: 'link', color: 'var(--t2)' },
    '📈': { icon: 'trending_up', color: 'var(--green)' },
    '📊': { icon: 'bar_chart', color: 'var(--blue)' },
    '💼': { icon: 'work', color: 'var(--purple)' },
    '💡': { icon: 'lightbulb', color: 'var(--orange)' },
    '🎓': { icon: 'school', color: 'var(--purple)' },
    '📜': { icon: 'description', color: 'var(--purple)' },
    '⚽': { icon: 'sports_soccer', color: 'var(--green)' },
    '🍿': { icon: 'movie', color: 'var(--pink)' },
    '🧘': { icon: 'self_improvement', color: 'var(--green)' },
    '⚡': { icon: 'bolt', color: 'var(--orange)' },
    '🚨': { icon: 'emergency', color: 'var(--red)' },
    '📦': { icon: 'inventory_2', color: 'var(--pink)' },
    '🧬': { icon: 'biotech', color: 'var(--blue)' },
    '🛸': { icon: 'ufo', color: 'var(--blue)' },
    '🌾': { icon: 'agriculture', color: 'var(--green)' },
    '🚲': { icon: 'pedal_bike', color: 'var(--orange)' },

    // New category & topic icons
    '🤖': { icon: 'smart_toy', color: 'var(--blue)' },
    '🎨': { icon: 'palette', color: 'var(--pink)' },
    '✈️': { icon: 'flight', color: 'var(--blue)' },
    '🍕': { icon: 'restaurant', color: 'var(--orange)' },
    '📸': { icon: 'photo_camera', color: 'var(--purple)' },
    '🏎️': { icon: 'directions_car', color: 'var(--orange)' },
    '🔒': { icon: 'lock', color: 'var(--blue)' },
    '🧠': { icon: 'psychology', color: 'var(--purple)' },
    '😂': { icon: 'sentiment_very_satisfied', color: 'var(--orange)' },
    '👗': { icon: 'checkroom', color: 'var(--pink)' },
    '🤝': { icon: 'handshake', color: 'var(--green)' },
    '🎪': { icon: 'festival', color: 'var(--purple)' },
    '🖼️': { icon: 'image', color: 'var(--pink)' },
    '🏗️': { icon: 'construction', color: 'var(--orange)' },
    '🖥️': { icon: 'code', color: 'var(--blue)' },
    '🧗': { icon: 'hiking', color: 'var(--green)' },
    
    // Skill Tree & Course items
    '⭐': { icon: 'star', color: 'var(--orange)' },
    '📖': { icon: 'menu_book', color: 'var(--blue)' },
    '🔧': { icon: 'build', color: 'var(--t2)' },
    '💎': { icon: 'diamond', color: 'var(--blue)' },
    '👑': { icon: 'crown', color: 'var(--orange)' },
    '🏆': { icon: 'emoji_events', color: 'var(--orange)' },
    '🎯': { icon: 'track_changes', color: 'var(--pink)' },
    '🌟': { icon: 'auto_awesome', color: 'var(--orange)' },
    '💪': { icon: 'fitness_center', color: 'var(--green)' },
    
    // Muscles (Fitness Group)
    '🏋️‍♂️': { icon: 'fitness_center', color: 'var(--purple)' },
    '🏋️': { icon: 'fitness_center', color: 'var(--purple)' },
    '🏃': { icon: 'directions_run', color: 'var(--orange)' },
    '🍑': { icon: 'favorite', color: 'var(--pink)' },

    // Stories (Avatars)
    '✨': { icon: 'person', color: 'var(--blue)' },
    '👩': { icon: 'face_3', color: 'var(--pink)' },
    '👨': { icon: 'face', color: 'var(--blue)' },
    '👩‍💼': { icon: 'face_3', color: 'var(--purple)' },
    '🧑': { icon: 'face_4', color: 'var(--green)' },
    
    // Shop
    '🎧': { icon: 'headphones', color: 'var(--blue)' },
    '⌚': { icon: 'watch', color: 'var(--green)' },
    '📱': { icon: 'smartphone', color: 'var(--pink)' },
    '🎒': { icon: 'backpack', color: 'var(--blue)' }
  };
  return map[emoji] || { icon: 'auto_awesome', color: 'var(--blue)' };
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
publish('utils/dom.js', {
  $id: () => $id, escapeHTML: () => escapeHTML, jsArg: () => jsArg, _safe: () => _safe,
  get3DIconForEmoji: () => get3DIconForEmoji
});
