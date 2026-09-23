/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SETTINGS — the app itself, your tools, and the way out           ║
   ║                                                                   ║
   ║  Appearance, device permissions, downloads, accessibility,        ║
   ║  language and sound, data usage, website permissions, account     ║
   ║  type, the creator dashboard, the ecosystem and login.            ║
   ║                                                                   ║
   ║  Device permissions ask the browser what it is actually allowed   ║
   ║  to do rather than showing a remembered answer, because a stored  ║
   ║  "allowed" that the person revoked last week is a lie.            ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

export default function register(SET) {

  const { reg, DO, LATE, esc, ico, toast, ask, empty, skeleton, guest, me, P, $ } = SET._;
  const { row, sw, pick, sec } = SET;

  /* ── Appearance ──────────────────────────────────────────────────── */

  const THEMES = [
    ['light', 'Light', 'light_mode', 'Bright surfaces'],
    ['dark', 'Dark', 'dark_mode', 'Low light, high contrast'],
    ['system', 'System', 'contrast', 'Follow your device']
  ];

  reg('appearance', {
    t: 'Appearance', i: 'palette', p: 'root',
    k: 'appearance theme dark light mode colour color background mesh look',
    html: () => {
      const pref = typeof themePref === 'function' ? themePref() : 'light';
      const now = typeof resolvedTheme === 'function' ? resolvedTheme(pref) : 'light';
      const mesh = !document.body.classList.contains('no-mesh');
      return [
        `<p class="st-lead">Showing the <b>${esc(now)}</b> theme${pref === 'system' ? ', matching your device' : ''}.</p>`,
        `<div class="st-themes">${THEMES.map(([k, label, icon, note]) => `
          <button type="button" class="st-theme${pref === k ? ' on' : ''}" data-st="theme" data-a="${k}"
            data-label="${esc(label)} theme" aria-pressed="${pref === k}">
            <span class="st-theme-p ${k}"><i class="bar"></i><i class="dot"></i><i class="line"></i><i class="line short"></i></span>
            <b>${ico(icon)}${esc(label)}</b>
            <em>${esc(note)}</em>
          </button>`).join('')}</div>`,
        sec('', [
          sw('a11y.mesh', 'Dynamic backgrounds', 'A moving gradient behind the app', { icon: 'blur_on', value: mesh, act: 'tgmesh' }),
          sw('a11y.contrast', 'Increase contrast', 'Stronger borders and text', { icon: 'contrast' }),
          sw('a11y.motion', 'Reduce motion', 'Stop animations and transitions', { icon: 'animation' })
        ]),
        sec('Text', [row({ icon: 'format_size', label: 'Text size', value: P().get('a11y.textScale') + '%', to: 'a11y' })])
      ].join('');
    }
  });

  DO.theme = k => {
    if (typeof setTheme === 'function') setTheme(k);
    toast(k === 'system' ? 'Appearance follows your device' : k.charAt(0).toUpperCase() + k.slice(1) + ' theme on');
    SET.repaint();
  };

  DO.tgmesh = (a, b, el) => {
    document.body.classList.toggle('no-mesh', !el.checked);
    try { localStorage.setItem('ts_mesh', el.checked ? '1' : '0'); } catch (e) {}
    P().set('a11y.mesh', el.checked);
    toast(el.checked ? 'Dynamic backgrounds on' : 'Dynamic backgrounds off');
  };

  /* ── Device permissions ──────────────────────────────────────────── */

  /* The state is asked of the browser each time this screen opens, so
     a permission revoked in the address bar shows as revoked here. */
  const PERMS = [
    ['camera', 'Camera', 'photo_camera', 'Taking photos and going live'],
    ['microphone', 'Microphone', 'mic', 'Voice notes, calls and live audio'],
    ['notifications', 'Notifications', 'notifications', 'Alerts when the app is closed'],
    ['location', 'Location', 'location_on', 'Adding a place to a post']
  ];

  reg('permissions', {
    t: 'Device permissions', i: 'phone_iphone', p: 'root',
    k: 'device permissions camera microphone photos contacts notifications location allow access',
    html: () => [
      `<p class="st-lead">What this device lets Trending use. These are granted by your browser, not by Trending, and you can take them back at any time.</p>`,
      `<div id="st-perms">${skeleton(4)}</div>`,
      sec('Files', [
        row({ icon: 'photo_library', label: 'Photos and videos', sub: 'Picked one at a time; your library is never browsed', value: 'On request' }),
        row({ icon: 'contacts', label: 'Contacts', sub: 'Matched on the device; nothing is uploaded', value: navigator.contacts ? 'On request' : 'Not available' })
      ]),
      `<p class="st-note">A permission that says “Blocked” has to be changed in your browser’s site settings — a website is not allowed to ask again.</p>`
    ].join('')
  });

  /* Permissions come back from a promise, so the rows fill in after the
     screen has already drawn rather than holding it up. */
  LATE.permissions = async () => {
    const host = $('st-perms');
    if (!host) return;
    const states = await Promise.all(PERMS.map(([k]) => P().permission(k)));
    if (!$('st-perms')) return;
    const label = { granted: 'Allowed', denied: 'Blocked', ask: 'Ask each time', unknown: 'Not available' };
    host.innerHTML = sec('', PERMS.map(([k, l, i, s], n) => row({
      icon: i, label: l, sub: s,
      value: label[states[n]] || 'Unknown',
      good: states[n] === 'granted', warn: states[n] === 'denied',
      act: states[n] === 'ask' || states[n] === 'unknown' ? 'askperm' : '', arg: k,
      chev: states[n] === 'ask'
    })));
  };

  DO.askperm = async k => {
    const state = await P().request(k);
    toast(state === 'granted' ? 'Allowed' : state === 'denied' ? 'Your browser blocked it' : 'Not available on this device');
    LATE.permissions();
  };

  /* ── Archiving and downloading ───────────────────────────────────── */

  reg('archiving', {
    t: 'Archiving and downloading', i: 'download', p: 'root',
    k: 'archiving downloading download your information export data original uploads save quality',
    html: () => [
      `<p class="st-lead">What Trending keeps for you, and how to take it away with you.</p>`,
      sec('Archive automatically', [
        sw('archive.stories', 'Stories', 'Keep every story after it expires', { icon: 'auto_stories' }),
        sw('archive.live', 'Live sessions', 'Keep a recording when a stream ends', { icon: 'sensors' }),
        sw('archive.originals', 'Save original uploads', 'Keep the full-quality file as well as the compressed one', { icon: 'high_quality' })
      ]),
      sec('Download', [
        row({ icon: 'download', label: 'Download your information', sub: 'Everything this device holds, as one file', act: 'download', chev: true }),
        row({ icon: 'folder_zip', label: 'What is included', act: 'whatsincluded', chev: true })
      ]),
      `<p class="st-note">The file is built on this device and saved by your browser. It is never uploaded anywhere.</p>`
    ].join('')
  });

  DO.whatsincluded = () => {
    const d = P().exportData();
    const keys = Object.keys(d.data || {});
    SET.sheet('What is included', [
      `<p class="st-sheet-p">${keys.length} sets of data from this device. Anything whose name suggests a key, token, password or recovery phrase is left out.</p>`,
      `<div class="st-rows">${keys.slice(0, 40).map(k => row({ icon: 'description', label: k })).join('')}</div>`,
      `<button type="button" class="btn btn-primary w100 mt12" data-st="download">Download</button>`
    ].join(''));
  };

  /* ── Accessibility ───────────────────────────────────────────────── */

  reg('a11y', {
    t: 'Accessibility', i: 'accessibility_new', p: 'root',
    k: 'accessibility text size scaling screen reader contrast reduce motion captions haptics vision',
    html: () => {
      const scale = +P().get('a11y.textScale') || 100;
      return [
        `<p class="st-lead">Trending follows your device’s own accessibility settings too. These are on top of those.</p>`,
        sec('Text', [], ''),
        `<div class="st-slide" data-label="Text size">
          <div class="st-slide-h"><b>Text size</b><span>${scale}%</span></div>
          <input type="range" min="80" max="140" step="10" value="${scale}" data-st="textscale" aria-label="Text size">
          <p class="st-slide-s" style="font-size:${(scale / 100 * 14).toFixed(1)}px">The quick brown fox jumps over the lazy dog.</p>
          <p class="st-note" style="padding:0">Applies to the text of posts, messages and these settings. Buttons and bars keep their size so the layout holds together.</p>
        </div>`,
        sec('Vision', [
          sw('a11y.contrast', 'Increase contrast', 'Stronger borders, darker text', { icon: 'contrast' }),
          sw('a11y.motion', 'Reduce motion', 'Stop animations, parallax and auto-playing effects', { icon: 'animation' })
        ]),
        sec('Media', [
          sw('a11y.captions', 'Captions', 'Show captions on video when a track exists', { icon: 'closed_caption' })
        ]),
        sec('Touch', [
          sw('a11y.haptics', 'Haptics', 'A short buzz on important actions', { icon: 'vibration', off: !navigator.vibrate })
        ]),
        sec('Screen readers', [
          row({ icon: 'record_voice_over', label: 'Screen reader support',
            sub: 'Every control here is labelled and reachable by keyboard', value: 'Always on', good: true })
        ]),
        !navigator.vibrate ? `<p class="st-note">This device does not support haptics.</p>` : ''
      ].join('');
    }
  });

  DO.textscale = (a, b, el) => {
    P().set('a11y.textScale', +el.value);
    SET.repaint();
  };

  /* ── Language and sound ──────────────────────────────────────────── */

  reg('langsound', {
    t: 'Language and sound', i: 'translate', p: 'root',
    k: 'language translation sound autoplay notification sounds video audio mute',
    html: () => {
      const cur = (typeof LG !== 'undefined' && LG.current) ? LG.current() : null;
      return [
        `<p class="st-lead">The language Trending speaks, and when it makes a noise.</p>`,
        sec('Language', [
          row({ icon: 'language', label: 'App language', value: cur ? (cur.name || cur.code || '') : 'English', act: 'pickLang', chev: true }),
          sw('a11y.translate', 'Offer to translate posts', 'Show a translate button on posts not in your language', { icon: 'g_translate' })
        ]),
        sec('Sound', [
          sw('media.autoplaySound', 'Start videos with sound', 'Off means video starts muted until you tap', { icon: 'volume_up' }),
          sw('notif.sound', 'Notification sounds', '', { icon: 'notifications_active' }),
          sw('a11y.uiSound', 'Interface sounds', 'Small sounds on sending and confirming', { icon: 'music_note' })
        ])
      ].join('');
    }
  });

  DO.pickLang = () => {
    if (typeof LG === 'undefined' || !LG.listHTML) { toast('Languages are still loading…'); return; }
    SET.sheet('App language', `<div class="st-langs">${LG.listHTML()}</div>`);
  };

  /* ── Data usage and media quality ────────────────────────────────── */

  reg('data', {
    t: 'Data usage and media quality', i: 'data_usage', p: 'root',
    k: 'data usage saver media quality upload video image autoplay wifi cellular mobile',
    html: () => [
      `<p class="st-lead">How much of your connection Trending is allowed to use.</p>`,
      sec('', [
        sw('media.dataSaver', 'Data saver', 'Lower-quality media, no preloading, no autoplay on mobile data', { icon: 'data_saver_on' })
      ]),
      sec('Autoplay video', []),
      pick('media.autoplay', [
        ['always', 'Always', 'On mobile data as well as Wi-Fi'],
        ['wifi', 'On Wi-Fi only', 'The usual choice'],
        ['never', 'Never', 'Tap to play everything']
      ]),
      sec('Video quality', []),
      pick('media.videoQuality', [
        ['auto', 'Automatic', 'Matches the connection'],
        ['saver', 'Data saver', 'Lower resolution, less data'],
        ['high', 'Highest quality', 'Uses noticeably more data']
      ]),
      sec('When you upload', [
        sw('media.wifiOnlyHQ', 'Upload at full quality on Wi-Fi only', '', { icon: 'wifi' })
      ]),
      pick('media.uploadQuality', [
        ['standard', 'Standard upload quality', 'Faster, smaller files'],
        ['high', 'High upload quality', 'Slower, better-looking posts']
      ]),
      `<p class="st-note">Trending cannot see your data plan. These settings limit what it asks for, not what your network charges.</p>`
    ].join('')
  });

  /* ── Website permissions ─────────────────────────────────────────── */

  reg('siteperms', {
    t: 'Website permissions', i: 'captive_portal', p: 'root',
    k: 'website permissions app external mini apps connected sites revoke web3 dapp',
    html: () => {
      const sites = P().listAll('sitePerms');
      return [
        `<p class="st-lead">Websites and mini apps you have let interact with your Trending account.</p>`,
        sites.length
          ? sec('', sites.map(s => {
              const rec = (P().all().sitePerms || {})[s] || {};
              return row({ icon: 'public', label: s, sub: (rec.scopes || ['Read your profile']).join(', '),
                value: 'Revoke', act: 'revokesite', arg: s, chev: true });
            }))
          : empty('public_off', 'Nothing connected', 'A site appears here the first time you let it read your Trending profile.'),
        `<p class="st-note">Mini apps run in a sandboxed frame. They cannot read your wallet, your messages or your settings, and posting on your behalf always asks first.</p>`
      ].join('');
    }
  });

  DO.revokesite = async s => {
    if (!(await ask('Revoke access for ' + s + '? It will have to ask again.', { ok: 'Revoke', danger: true }))) return;
    P().listRemove('sitePerms', s);
    toast('Access revoked');
    SET.repaint();
  };

  /* ── Account type and creator tools ──────────────────────────────── */

  reg('acctype', {
    t: 'Account type and tools', i: 'workspace_premium', p: 'root',
    k: 'account type personal creator business professional tools switch insights',
    html: () => {
      const t = P().get('account.type');
      return [
        `<p class="st-lead">A creator or business account unlocks analytics and monetisation. You can switch back whenever you like.</p>`,
        pick('account.type', [
          ['personal', 'Personal', 'The default. No analytics, no monetisation.'],
          ['creator', 'Creator', 'Audience insights, content analytics and tipping.'],
          ['business', 'Business', 'Everything a creator gets, plus a shop and contact buttons.']
        ], { act: 'setacctype' }),
        t !== 'personal' ? sec('Your tools', [
          row({ icon: 'insights', label: 'Creator dashboard', to: 'creator' }),
          row({ icon: 'movie_edit', label: 'Creator Studio', act: 'studio', chev: true }),
          row({ icon: 'payments', label: 'Monetisation', to: 'creator' })
        ]) : `<p class="st-note">Professional tools are hidden on a personal account rather than shown greyed out, because a control you cannot use is just noise.</p>`
      ].join('');
    }
  });

  DO.setacctype = async (a, b) => {
    const names = { personal: 'Personal', creator: 'Creator', business: 'Business' };
    if (b !== 'personal' && guest()) { toast('Sign in to switch account type.'); return DO.signin(); }
    P().set('account.type', b);
    toast(names[b] + ' account');
    SET.repaint();
  };

  reg('creator', {
    t: 'Creator dashboard', i: 'insights', p: 'root', hidden: false,
    k: 'creator dashboard insights analytics audience engagement monetisation earnings tools',
    html: () => {
      if (P().get('account.type') === 'personal') {
        return empty('workspace_premium', 'Creator tools are off',
          'Switch to a creator or business account to see insights, analytics and monetisation.',
          'go:acctype', 'Change account type');
      }
      const posts = (window.PG && PG.myPosts) ? PG.myPosts().length : 0;
      return [
        `<p class="st-lead">How your work is doing. Figures come from this account’s own activity.</p>`,
        `<div class="st-stats">
          <div class="st-stat"><b>${posts}</b><span>posts</span></div>
          <div class="st-stat"><b>${(me().followers || 0)}</b><span>followers</span></div>
          <div class="st-stat"><b>${(me().level || 1)}</b><span>level</span></div>
        </div>`,
        sec('Insights', [
          row({ icon: 'bar_chart', label: 'Account insights', sub: 'Reach, profile visits and follows', act: 'studio', chev: true }),
          row({ icon: 'grid_on', label: 'Content analytics', sub: 'How each post performed', act: 'studio', chev: true }),
          row({ icon: 'groups', label: 'Audience', sub: 'Who is following you', act: 'pane:profile', chev: true })
        ]),
        sec('Monetisation', [
          row({ icon: 'volunteer_activism', label: 'Tips', sub: 'Let people tip you in crypto', to: 'wallets' }),
          row({ icon: 'workspace_premium', label: 'Subscriptions', to: 'plus' }),
          row({ icon: 'payments', label: 'Where payments arrive', sub: 'Your Trending balance and connected wallets', to: 'wallets' })
        ]),
        sec('Notifications', [
          sw('notif.creator', 'Creator notifications', 'Milestones, insights and payouts', { icon: 'insights' })
        ])
      ].join('');
    }
  });

  DO.studio = () => {
    if (window.STU && STU.open) STU.open();
    else if (typeof navigateTo === 'function') navigateTo('profile');
  };

  DO.ai = () => {
    if (typeof toggleAI === 'function') toggleAI();
    else if (window.ALINA && ALINA.open) ALINA.open();
    else toast('The assistant is on this page — tap the sparkle in the header.');
  };

  /* ── Login ───────────────────────────────────────────────────────── */

  /* Several accounts on one device is a real feature only if switching
     keeps each account's data apart. Trending stores everything under
     one set of keys, so this offers what it can honestly offer: a
     clean sign-out and a sign-in as someone else. */
  DO.addaccount = async () => {
    const ok = await ask(guest()
      ? 'Sign in to your first account, then come back to add another.'
      : 'Adding another account signs this one out first. Your posts, settings and balances stay with the account you sign back in to.',
      { title: 'Add account', ok: guest() ? 'Sign in' : 'Continue', danger: !guest() });
    if (!ok) return;
    if (guest()) return DO.signin();
    if (typeof signOut === 'function') signOut();
    setTimeout(() => DO.signin(), 400);
  };

  DO.switchaccount = async () => {
    if (guest()) { toast('Sign in first.'); return DO.signin(); }
    const ok = await ask('Switching signs out of ' + (me().handle || 'this account') + ' and opens sign-in again.',
      { title: 'Switch account', ok: 'Switch' });
    if (!ok) return;
    if (typeof signOut === 'function') signOut();
    setTimeout(() => DO.signin(), 400);
  };

  DO.signout = async () => {
    if (!(await ask('Sign out of Trending on this device?', { ok: 'Sign out', danger: true }))) return;
    P().dropVerify();
    if (typeof signOut === 'function') signOut();
    else toast('Sign-out is still loading…');
  };
}
