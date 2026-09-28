// ── KEYBOARD REACH ───────────────────────────────────────────────
/* Much of the app makes a row, a card or an avatar clickable with an
   inline onclick= on a <div> or a <span>. A mouse or a finger can use
   those; a keyboard cannot, because only real controls take focus. A
   conversation, a story or a community card was simply out of reach.

   This gives each of them what a <button> has for free: a place in the
   Tab order, and Enter or Space to press it. Nothing changes on screen.
   The ring shows only for keyboard focus (:focus-visible), and the click
   sent is the same one a tap sends, so no feature behaves differently. */
'use strict';

/* Real controls, and anything already given a tab stop, look after
   themselves. */
const NATIVE = 'a[href], button, input, select, textarea, label, option, summary, [contenteditable="true"], [contenteditable=""]';

/* A handler that only stops the click spreading is a wrapper around
   something else, not an action of its own. */
const ONLY_STOPS = /^\s*(event\.)?stopPropagation\(\)\s*;?\s*$/;

/* A dimmed backdrop closes its sheet when tapped. Escape already does
   that from the keyboard, and a focusable backdrop is a stop to nowhere. */
const BACKDROP = /scrim|overlay|backdrop/i;

/* Trending Creators is left exactly as it is. */
const LEFT_ALONE = '#creator-grid';

/* role="button" only where it does not erase what the element already
   is: a list item stays a list item and a heading stays a heading. A
   card holding buttons of its own gets the tab stop but not the role,
   because a button inside a button is announced as nonsense. */
const AS_BUTTON = new Set(['DIV', 'SPAN', 'IMG', 'I', 'B', 'P']);
const HAS_CONTROLS = 'a[href], button, input, select, textarea, [onclick], [tabindex]';

function adopt(el) {
  // May open later (a sheet shown by a class change): look again next time.
  if (el.closest('[aria-hidden="true"]')) return;
  const cls = typeof el.className === 'string' ? el.className : '';
  if (el.matches(NATIVE) || (el.parentElement && el.parentElement.closest('a[href], button')) ||
      ONLY_STOPS.test(el.getAttribute('onclick') || '') || BACKDROP.test(cls) || el.closest(LEFT_ALONE)) {
    el.setAttribute('data-kb-skip', '');
    return;
  }
  el.tabIndex = 0;
  el.setAttribute('data-kb', '');
  if (!el.hasAttribute('role') && AS_BUTTON.has(el.tagName) && !el.querySelector(HAS_CONTROLS)) el.setAttribute('role', 'button');
}

function scan() {
  document.querySelectorAll('[onclick]:not([tabindex]):not([data-kb-skip])').forEach(adopt);
}

/* Pages and sheets are drawn on demand, and live prices rewrite rows
   many times a second, so new markup is picked up at most four times a
   second rather than on every change. The first change after a quiet
   spell is picked up at once: a page opened from the keyboard is ready
   for the next Tab. */
const GAP = 250;
let last = 0, timer = 0;
function queue() {
  if (timer) return;
  timer = setTimeout(() => { timer = 0; last = Date.now(); scan(); }, Math.max(0, GAP - (Date.now() - last)));
}

/* On window, so it runs after every handler on the element or the
   document: a player or sheet that uses Enter or Space itself calls
   preventDefault, and this steps aside. Only elements adopted above are
   pressed, never anything that already had keyboard handling. */
window.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target;
  if (!(el instanceof Element) || !el.hasAttribute('data-kb')) return;
  e.preventDefault();
  el.click();
});

new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
scan();
