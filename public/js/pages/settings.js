// ─────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────

/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

function renderSettings() {
  // Both pickers are rebuilt on every visit so they show what is actually set.
  const host = document.getElementById('settings-language');
  if (host && typeof LG !== 'undefined') host.innerHTML = LG.cardHTML();
  const look = document.getElementById('settings-appearance');
  if (look) look.innerHTML = appearanceCardHTML();
  const acc = document.getElementById('settings-account');
  if (acc && window.PME) acc.innerHTML = PME.settingsCardHTML();
}

/* ── Appearance ────────────────────────────────────────────────────────
   The theme switch used to sit in the header and did not survive a
   reload. It lives here now, remembers the choice, and can follow the
   operating system instead of being told. */

const THEME_CHOICES = [
  ['light',  'Light',  'light_mode', 'Bright surfaces — the default.'],
  ['dark',   'Dark',   'dark_mode',  'Low light, high contrast.'],
  ['system', 'System', 'contrast',   'Follow your device setting.']
];

function appearanceCardHTML() {
  const pref = (typeof themePref === 'function') ? themePref() : 'light';
  const now = (typeof resolvedTheme === 'function') ? resolvedTheme(pref) : 'light';
  const meshOff = document.body.classList.contains('no-mesh');
  return `
    <div class="card set-card">
      <h3 class="set-h3"><span class="material-symbols-rounded">palette</span>Appearance</h3>
      <p class="set-sub">Showing the <b>${now}</b> theme${pref === 'system' ? ' — matching your device' : ''}.</p>

      <div class="set-themes">
        ${THEME_CHOICES.map(([k, label, icon, note]) => `
          <button class="set-theme${pref === k ? ' on' : ''}" onclick="pickTheme('${k}')" aria-pressed="${pref === k}">
            <span class="set-theme-prev ${k}"><i class="bar"></i><i class="dot"></i><i class="line"></i><i class="line short"></i></span>
            <span class="set-theme-t">
              <b><span class="material-symbols-rounded">${icon}</span>${label}</b>
              <span>${note}</span>
            </span>
            <span class="material-symbols-rounded set-theme-tick">${pref === k ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
          </button>`).join('')}
      </div>

      <div class="set-row">
        <div>
          <div class="set-row-t">Dynamic backgrounds</div>
          <div class="set-row-s">Moving gradient mesh behind the app</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" ${meshOff ? '' : 'checked'} onchange="toggleMesh(this.checked)">
          <span class="slider round"></span>
        </label>
      </div>
    </div>`;
}

function pickTheme(pref) {
  if (typeof setTheme === 'function') setTheme(pref);
  const look = document.getElementById('settings-appearance');
  if (look) look.innerHTML = appearanceCardHTML();
  if (typeof showToast === 'function') {
    showToast(pref === 'system' ? 'Appearance follows your device' : pref.charAt(0).toUpperCase() + pref.slice(1) + ' theme on');
  }
}

function toggleMesh(on) {
  document.body.classList.toggle('no-mesh', !on);
  try { localStorage.setItem('ts_mesh', on ? '1' : '0'); } catch (e) {}
  if (typeof showToast === 'function') showToast(on ? 'Dynamic backgrounds on' : 'Dynamic backgrounds off');
}

try { if (localStorage.getItem('ts_mesh') === '0') document.body.classList.add('no-mesh'); } catch (e) {}

function getSettingsTemplate() {
  return `<section id="pane-settings" class="pane">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px 0;">
      <h1 class="pane-title" style="display:flex; align-items:center; gap:10px; margin-bottom: 24px;">
        <span class="material-symbols-rounded emoji-3d" style="font-size:32px; color:var(--blue)">settings</span>
        <span>Settings</span> Preferences
      </h1>

      <div id="settings-account">${window.PME ? PME.settingsCardHTML() : ''}</div>

      <div id="settings-appearance">${appearanceCardHTML()}</div>

      <div id="settings-language">${typeof LG !== 'undefined' ? LG.cardHTML() : ''}</div>

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
          background-color: var(--brand-fill);
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
publish('pages/settings.js', {
  renderSettings: () => renderSettings, THEME_CHOICES: () => THEME_CHOICES,
  appearanceCardHTML: () => appearanceCardHTML, pickTheme: () => pickTheme,
  toggleMesh: () => toggleMesh,
  getSettingsTemplate: () => getSettingsTemplate
});
