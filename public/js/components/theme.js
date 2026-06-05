// ── THEME & HEADER INTERACTION ─────────────────────────────────────
function setupHeader() {
  const btn = $id('theme-btn');
  if (btn) btn.addEventListener('click', toggleTheme);
  
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
          <div class="notif-item unread" onclick="handleNotificationClick('fashionhub', event)">
            <div class="notif-item-avatar" style="background:var(--purple)">🎬</div>
            <div class="notif-item-content">
              <div class="notif-item-text"><strong>Global Fashion Hub</strong>: Live stream event "Summer Paris 2026 Runways" is broadcasting!</div>
              <div class="notif-item-time">1h ago</div>
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

function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  html.setAttribute('data-theme', isLight ? 'dark' : 'light');
  S.theme = isLight ? 'dark' : 'light';
  const icon = $id('theme-icon');
  if (icon) icon.textContent = isLight ? 'dark_mode' : 'light_mode';
}

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

function signInWithGoogle() {
  const mainView = $id('auth-main-view');
  const loadingView = $id('auth-loading-view');
  const statusLbl = $id('auth-loading-status');
  
  if (mainView && loadingView && statusLbl) {
    mainView.style.display = 'none';
    loadingView.style.display = 'flex';
    loadingView.classList.remove('hidden');
    
    // Simulate stages of OAuth
    statusLbl.textContent = 'Contacting Google Accounts services...';
    
    setTimeout(() => {
      statusLbl.textContent = 'Verifying secure OAuth2 credentials...';
    }, 1200);
    
    setTimeout(() => {
      statusLbl.textContent = 'Applying secure user profile tokens...';
    }, 2400);

    setTimeout(() => {
      S.user = {
        fname: 'Google',
        lname: 'Creator',
        handle: '@gmail_creator',
        bio: 'Logged in via secure Google OAuth2 🛡️. Creating digital fashion experiences.'
      };
      
      updateUserUI();
      closeAuthModal();
      showToast('Successfully signed in with Google! 🚀🔑');
      
      if (typeof IX !== 'undefined' && IX.burstReaction) {
        IX.burstReaction('🔑', window.innerWidth/2, window.innerHeight/2, 12);
      }
    }, 3600);
  }
}

function signInWithGmail(event) {
  if (event) event.preventDefault();
  
  const emailInput = $id('auth-email');
  const passInput = $id('auth-password');
  if (!emailInput || !passInput) return;
  
  const email = emailInput.value.trim();
  const password = passInput.value.trim();
  
  if (!email || !password) return;
  
  const mainView = $id('auth-main-view');
  const loadingView = $id('auth-loading-view');
  const statusLbl = $id('auth-loading-status');
  
  if (mainView && loadingView && statusLbl) {
    mainView.style.display = 'none';
    loadingView.style.display = 'flex';
    loadingView.classList.remove('hidden');
    
    statusLbl.textContent = 'Validating Gmail credentials...';
    
    setTimeout(() => {
      statusLbl.textContent = 'Generating encrypted user session...';
    }, 1500);

    setTimeout(() => {
      const username = email.split('@')[0];
      const displayName = username.charAt(0).toUpperCase() + username.slice(1);
      
      S.user = {
        fname: displayName,
        lname: 'Vance',
        handle: `@${username}`,
        bio: `Authenticated securely via ${email} 🛡️`
      };
      
      updateUserUI();
      closeAuthModal();
      showToast(`Welcome back, ${displayName}! 🌟`);
      
      emailInput.value = '';
      passInput.value = '';
      
      if (typeof IX !== 'undefined' && IX.burstReaction) {
        IX.burstReaction('📩', window.innerWidth/2, window.innerHeight/2, 12);
      }
    }, 3000);
  }
}

function signOut() {
  if (confirm('Sign out of Trending?')) {
    S.user = {
      fname: 'Guest',
      lname: 'User',
      handle: '@guest_user',
      bio: 'Explore Trending as a guest! Sign in to publish posts and buy digital fashion outfits.'
    };
    updateUserUI();
    showToast('Signed out of ecosystem! 👤');
    openAuthModal();
  }
}

