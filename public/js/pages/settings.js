// ─────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────

function renderSettings() {
  // Initialization logic for settings can go here
  console.log('Settings page rendered');
}

function getSettingsTemplate() {
  return `<section id="pane-settings" class="pane">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px 0;">
      <h1 class="pane-title" style="display:flex; align-items:center; gap:10px; margin-bottom: 24px;">
        <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--blue)">settings</span>
        <span>Settings</span> Preferences
      </h1>

      <div class="card" style="padding: 24px; margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 16px; color: var(--t1);">Appearance</h3>
        
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border);">
          <div>
            <div style="font-weight: 700; font-size: 14px;">Dark Mode</div>
            <div style="font-size: 12px; color: var(--t3);">Toggle high-contrast dark theme</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" checked onchange="showToast('Theme updated')">
            <span class="slider round"></span>
          </label>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0;">
          <div>
            <div style="font-weight: 700; font-size: 14px;">Dynamic Backgrounds</div>
            <div style="font-size: 12px; color: var(--t3);">Enable moving gradient mesh</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" checked onchange="showToast('Background updated')">
            <span class="slider round"></span>
          </label>
        </div>
      </div>

      <div class="card" style="padding: 24px; margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 16px; color: var(--t1);">Notifications</h3>
        
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border);">
          <div>
            <div style="font-weight: 700; font-size: 14px;">Push Notifications</div>
            <div style="font-size: 12px; color: var(--t3);">Receive alerts for messages and mentions</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" checked onchange="showToast('Notification preferences saved')">
            <span class="slider round"></span>
          </label>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0;">
          <div>
            <div style="font-weight: 700; font-size: 14px;">Weekly Digest</div>
            <div style="font-size: 12px; color: var(--t3);">Receive a summary of trending posts</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" onchange="showToast('Email preferences saved')">
            <span class="slider round"></span>
          </label>
        </div>
      </div>

      <div class="card" style="padding: 24px;">
        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 16px; color: var(--t1); display:flex; align-items:center; gap:6px;">
          <span class="material-symbols-rounded" style="color:var(--green)">lock</span> Data, Privacy & Security
        </h3>
        
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border);">
          <div>
            <div style="font-weight: 700; font-size: 14px; display:flex; align-items:center; gap:6px;">Anonymous Mode <span style="font-size:10px; background:var(--pink); color:#fff; padding:2px 6px; border-radius:10px; font-weight:800">NEW</span></div>
            <div style="font-size: 12px; color: var(--t3);">Hide your identity. Post and browse as a Ghost.</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-anon" onchange="toggleAnonymousMode(this.checked)">
            <span class="slider round"></span>
          </label>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border);">
          <div>
            <div style="font-weight: 700; font-size: 14px;">End-to-End Encryption (E2EE)</div>
            <div style="font-size: 12px; color: var(--t3);">Military-grade encryption for all messages and data</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" checked disabled>
            <span class="slider round"></span>
          </label>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border);">
          <div>
            <div style="font-weight: 700; font-size: 14px;">Zero-Knowledge Architecture</div>
            <div style="font-size: 12px; color: var(--t3);">Servers cannot read your personal files</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" checked disabled>
            <span class="slider round"></span>
          </label>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border);">
          <div>
            <div style="font-weight: 700; font-size: 14px;">Data Saver</div>
            <div style="font-size: 12px; color: var(--t3);">Reduce media resolution on cellular</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" onchange="showToast('Data Saver updated')">
            <span class="slider round"></span>
          </label>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0;">
          <div>
            <div style="font-weight: 700; font-size: 14px;">Clear Local Cache</div>
            <div style="font-size: 12px; color: var(--t3);">Free up space on this device</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="showToast('Cache cleared!')" style="color:var(--pink)">Clear Cache</button>
        </div>
      </div>

      <style>
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 22px;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: var(--card2);
          border: 1px solid var(--border);
          transition: .4s;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: var(--t3);
          transition: .4s;
        }
        input:checked + .slider {
          background-color: var(--blue);
          border-color: var(--blue);
        }
        input:checked + .slider:before {
          background-color: white;
          transform: translateX(18px);
        }
        .slider.round {
          border-radius: 34px;
        }
        .slider.round:before {
          border-radius: 50%;
        }
      </style>
    </div>
  </section>`;
}
