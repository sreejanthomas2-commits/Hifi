// ── THEME & HEADER INTERACTION ─────────────────────────────────────
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

function setupHeader() {
  
  const av = $id('header-av');
  if (av) {
    av.style.cursor = 'pointer';
    av.addEventListener('click', () => {
      navigateTo('profile');
      showToast('Profile: Opened from Header 👤');
    });
  }

  // ── NOTIFICATION DROPDOWN SETUP ──
  const notifContainer = document.querySelector('.notif-btn');
  if (notifContainer) {
    const notifBtn = notifContainer.querySelector('button.icon-btn');
    if (notifBtn) {
      notifBtn.id = 'notif-btn-element';
      
      // Inject dropdown
      const dropdown = document.createElement('div');
      dropdown.id = 'notif-dropdown-menu';
      dropdown.className = 'notif-dropdown hidden';
      dropdown.innerHTML = `
        <div class="notif-dropdown-header">
          <span class="notif-dropdown-title">Notifications</span>
          <button class="notif-dropdown-clear" onclick="markAllNotificationsAsRead(event)">Mark all read</button>
        </div>
        <div class="notif-list">
          <div class="notif-item unread" onclick="handleNotificationClick('feeds', event)">
            <div class="notif-item-avatar" style="background:var(--pink)">💖</div>
            <div class="notif-item-content">
              <div class="notif-item-text"><strong>Sarah Chen</strong> liked your recent fashion ecosystem concept post!</div>
              <div class="notif-item-time">2m ago</div>
            </div>
          </div>
          <div class="notif-item unread" onclick="handleNotificationClick('messages', event)">
            <div class="notif-item-avatar" style="background:var(--blue)">💬</div>
            <div class="notif-item-content">
              <div class="notif-item-text"><strong>Marcus Webb</strong>: "Hey Alex! Did you check out the new Tokyo minimal design?"</div>
              <div class="notif-item-time">15m ago</div>
            </div>
          </div>
          <div class="notif-item" onclick="handleNotificationClick('creator', event)">
            <div class="notif-item-avatar" style="background:var(--orange)">🎨</div>
            <div class="notif-item-content">
              <div class="notif-item-text"><strong>AI Creator Studio</strong> generated your 3D digital-twin avatar draft. View in canvas.</div>
              <div class="notif-item-time">4h ago</div>
            </div>
          </div>
        </div>
        <div class="notif-dropdown-footer">
          <button class="notif-dropdown-footer-btn" onclick="toggleNotifDropdown(event)">Close Panel</button>
        </div>
      `;
      notifContainer.appendChild(dropdown);

      // Bind click
      notifBtn.addEventListener('click', toggleNotifDropdown);
    }
  }
}

function toggleNotifDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = $id('notif-dropdown-menu');
  if (dropdown) {
    const isHidden = dropdown.classList.contains('hidden');
    // Hide virtual keyboard & other overlays
    document.querySelectorAll('.notif-dropdown').forEach(x => x.classList.add('hidden'));
    
    if (isHidden) {
      dropdown.classList.remove('hidden');
      if (typeof IX !== 'undefined' && IX.spawnRipple) {
        const btn = $id('notif-btn-element');
        if (btn) IX.spawnRipple(btn);
      }
    } else {
      dropdown.classList.add('hidden');
    }
  }
}

function markAllNotificationsAsRead(event) {
  if (event) event.stopPropagation();
  const dot = document.querySelector('.notif-dot');
  if (dot) dot.classList.add('hidden');
  
  document.querySelectorAll('.notif-item').forEach(item => {
    item.classList.remove('unread');
  });
  
  const badge = $id('msg-badge');
  if (badge) badge.style.display = 'none';

  showToast('Marked all notifications as read! 🔔');
}

function handleNotificationClick(pane, event) {
  if (event) event.stopPropagation();
  const item = event.currentTarget;
  if (item) item.classList.remove('unread');
  
  const dropdown = $id('notif-dropdown-menu');
  if (dropdown) dropdown.classList.add('hidden');
  
  if (window.navigateTo) {
    navigateTo(pane);
  } else {
    showToast(`Navigating to ${pane}...`);
  }
}

// Close dropdown on clicking outside
document.addEventListener('click', (e) => {
  const dropdown = $id('notif-dropdown-menu');
  const btn = $id('notif-btn-element');
  if (dropdown && !dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) {
    dropdown.classList.add('hidden');
  }
});

/* ── Appearance ──────────────────────────────────────────────────────
   The app is light by default. The choice is stored, so it survives a
   reload, and "system" follows the operating system as it changes.
   The control itself lives in Settings → Appearance. */

const THEME_KEY = 'ts_theme';

function themePref() {
  try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
}

function systemDark() {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function resolvedTheme(pref) {
  const p = pref || themePref();
  return p === 'system' ? (systemDark() ? 'dark' : 'light') : (p === 'dark' ? 'dark' : 'light');
}

function applyTheme(pref) {
  const mode = resolvedTheme(pref);
  document.documentElement.setAttribute('data-theme', mode);
  if (typeof S !== 'undefined') S.theme = mode;
  // Colours the browser chrome on mobile to match the app.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#0A0B0E' : '#F6F7F9');
  return mode;
}

function setTheme(pref) {
  try { localStorage.setItem(THEME_KEY, pref); } catch (e) {}
  const mode = applyTheme(pref);
  if (typeof renderSettings === 'function' && document.getElementById('pane-settings')) renderSettings();
  return mode;
}

/* Kept for anything that still asks for a straight flip. */
function toggleTheme() {
  return setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
}

/* Follow the system while the preference is "system". */
if (window.matchMedia) {
  try {
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => { if (themePref() === 'system') applyTheme('system'); });
  } catch (e) { /* older browsers: the stored choice still applies */ }
}
applyTheme();

function openAuthModal() {
  const modal = $id('auth-modal');
  if (modal) {
    modal.classList.remove('hidden');
    const mainView = $id('auth-main-view');
    const loadingView = $id('auth-loading-view');
    if (mainView) mainView.style.display = 'block';
    if (loadingView) {
      loadingView.style.display = 'none';
      loadingView.classList.add('hidden');
    }
  }
}

function closeAuthModal() {
  const modal = $id('auth-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// ── AUTH FUNCTIONS ──
// Real signInWithGoogle(), signInWithGmail(), and signOut() 
// are defined in firebase-auth.js using real Firebase Auth SDK.
// openAuthModal() and closeAuthModal() remain here for UI control.

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
publish('components/theme.js', {
  setupHeader: () => setupHeader,
  toggleNotifDropdown: () => toggleNotifDropdown,
  markAllNotificationsAsRead: () => markAllNotificationsAsRead,
  handleNotificationClick: () => handleNotificationClick,
  THEME_KEY: () => THEME_KEY, themePref: () => themePref,
  systemDark: () => systemDark, resolvedTheme: () => resolvedTheme,
  applyTheme: () => applyTheme, setTheme: () => setTheme,
  toggleTheme: () => toggleTheme, openAuthModal: () => openAuthModal,
  closeAuthModal: () => closeAuthModal
});
