/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SETTINGS — your account, and how you use Trending                ║
   ║                                                                   ║
   ║  Account Centre, security, saved, archive, activity,              ║
   ║  notifications and time management.                               ║
   ║                                                                   ║
   ║  The rule for everything in here: a row either changes a stored   ║
   ║  preference, opens the screen that owns the thing, or performs    ║
   ║  a real action. Passwords are reset by the provider that holds    ║
   ║  them; Trending never sees one.                                   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

export default function register(SET) {

  const { reg, DO, esc, toast, ask, askText, empty, when, gate, guest, me, myHandle, myName, P } = SET._;
  const { row, sw, pick, sec } = SET;

  /* Counts come from whichever feature stores the thing, read at the
     moment the row is drawn, so a number here is the real number. */
  function store(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (e) { return fallback; }
  }
  const shorty = () => store('ts_shorty', {});
  const nkeys = o => Object.keys(o || {}).length;

  /* ── Account Centre ──────────────────────────────────────────────── */

  reg('account', {
    t: 'Account Centre', i: 'account_circle', p: 'root',
    k: 'account centre center profile personal details username display name email phone password login ownership delete deactivate',
    html: () => {
      const u = me();
      return [
        `<p class="st-lead">Your details, how you sign in, and what happens to the account.</p>`,
        gate('Settings stay on this device until you sign in.'),
        sec('Profile', [
          row({ icon: 'badge', label: 'Personal details', sub: 'Name, bio, birthday and pronouns', act: 'edit', chev: true }),
          row({ icon: 'alternate_email', label: 'Username', value: guest() ? '—' : myHandle(), act: 'edit', arg: 'handle', chev: true }),
          row({ icon: 'person', label: 'Display name', value: guest() ? '—' : myName(), act: 'edit', arg: 'fname', chev: true }),
          row({ icon: 'photo_camera', label: 'Profile photo and cover', act: 'edit', arg: 'avatar', chev: true })
        ]),
        sec('How you sign in', [
          row({ icon: 'mail', label: 'Email', value: guest() ? 'Not signed in' : (u.email || 'Not set'), act: 'email', chev: true }),
          row({ icon: 'smartphone', label: 'Phone number', value: P().get('account.phone') || u.phone || 'Not set', act: 'phone', chev: true }),
          row({ icon: 'password', label: 'Password', sub: 'Send a reset link to your email', act: 'password', chev: true }),
          row({ icon: 'login', label: 'Login methods', sub: 'Google, Apple, email or phone', to: 'loginmethods' }),
          row({ icon: 'link', label: 'Connected accounts', to: 'connected' })
        ]),
        sec('Ownership and control', [
          row({ icon: 'shield', label: 'Security', to: 'security' }),
          row({ icon: 'download', label: 'Download your information', act: 'download', chev: true }),
          row({ icon: 'pause_circle', label: 'Deactivate account', sub: 'Hide your profile and posts — reversible', act: 'deactivate', chev: true }),
          row({ icon: 'delete_forever', label: 'Delete account', sub: 'Permanent. Everything on this device is erased.', act: 'deleteacct', danger: true, chev: true })
        ])
      ].join('');
    }
  });

  DO.edit = a => {
    if (guest()) { toast('Sign in to edit your profile.'); return DO.signin(); }
    if (window.PME && PME.open) PME.open(a || '');
    else toast('The profile editor is still loading…');
  };

  DO.email = async () => {
    if (guest()) { toast('Sign in first.'); return DO.signin(); }
    await ask(`This account signs in with ${me().email || 'no email yet'}. An email address is changed with the provider that verifies it, so it cannot be swapped here without proving you own the new one.`,
      { title: 'Email', ok: 'Got it', alert: true });
  };

  DO.phone = async () => {
    if (guest()) { toast('Sign in first.'); return DO.signin(); }
    const v = await askText('Phone number for sign-in and security alerts', P().get('account.phone') || '', { title: 'Phone number', ok: 'Save' });
    if (v == null) return;
    const clean = String(v).replace(/[^\d+]/g, '');
    if (clean && !/^\+?\d{7,15}$/.test(clean)) { toast('That does not look like a phone number.'); return; }
    P().set('account.phone', clean);
    toast(clean ? 'Phone number saved' : 'Phone number removed');
    SET.repaint();
  };

  /* A real reset, sent by the provider that owns the password. Trending
     never sees it, sets it, or stores it. */
  DO.password = async () => {
    const u = me();
    if (guest() || !u.email) { toast('Sign in with an email address first.'); return DO.signin(); }
    if (!window.firebaseAuth) { toast('Sign-in is offline right now.'); return; }
    if (!(await ask(`Send a password reset link to ${u.email}?`, { title: 'Reset password', ok: 'Send link' }))) return;
    try {
      const m = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      await m.sendPasswordResetEmail(window.firebaseAuth, u.email);
      toast('Reset link sent to ' + u.email);
    } catch (e) {
      toast(e && e.code === 'auth/too-many-requests' ? 'Too many attempts — try again later.' : 'The link could not be sent.');
    }
  };

  DO.download = async () => {
    if (!(await ask('Save everything this device holds for your account as a file? Anything that looks like a key, token or password is left out.',
      { title: 'Download your information', ok: 'Download' }))) return;
    P().download();
    toast('Your data is downloading');
  };

  DO.deactivate = async () => {
    if (!(await ask('Deactivating marks your account private on this device and signs you out. Nothing is deleted, and signing back in undoes it. Posts you already shared to the feed stay public — delete your account to remove them.',
      { title: 'Deactivate account', ok: 'Deactivate', danger: true }))) return;
    P().set('privacy.account', 'private');
    P().set('account.deactivated', Date.now());
    toast('Account deactivated — your profile is now private');
    if (typeof signOut === 'function') signOut();
  };

  /* Firebase deletes a sign-in account only from a session that signed
     in within the last few minutes. That is checked BEFORE anything is
     deleted, so a stale session is not left half-way: posts gone, account
     still there. A Google account re-confirms in a pop-up; any other is
     asked to sign in again first. */
  async function freshSignIn(user) {
    const t = await user.getIdTokenResult();
    if (Date.now() - Number(t.claims.auth_time) * 1000 < 4 * 60 * 1000) return true;
    if ((user.providerData || []).some(p => p && p.providerId === 'google.com')) {
      const { reauthenticateWithPopup, GoogleAuthProvider } = await import(AUTH_SDK);
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      return true;
    }
    return false;
  }

  function wipeDevice() {
    try {
      Object.keys(localStorage).filter(k => k.indexOf('ts_') === 0 && k !== 'ts_theme')
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }

  /* Signed in, this deletes the account itself: every post shared to the
     feed, the profile, the sessions record, then the sign-in - in that
     order, because once the sign-in is gone nothing can prove the posts
     were yours. A guest has only this device, so only this device is
     erased. It used to erase the device alone and call that deleting the
     account, while the account and its public posts stayed. */
  DO.deleteacct = async () => {
    const user = !guest() ? fbUser() : null;
    const what = user
      ? 'This deletes your Trending account: your sign-in, your profile and every post you shared to the feed — and erases everything this device holds. It cannot be undone.'
      : 'This erases every Trending post, message, setting and paper balance stored on this device. It cannot be undone.';
    if (!(await ask(what, { title: 'Delete account', ok: 'Delete everything', danger: true }))) return;
    const typed = await askText('Type DELETE to confirm.', '', { title: 'Are you certain?', ok: 'Delete' });
    if (String(typed || '').trim().toUpperCase() !== 'DELETE') { toast('Not deleted.'); return; }
    if (!(await P().verify('Deleting your account'))) return;

    if (user) {
      if (!window.db) { toast('Trending is offline right now, so nothing was deleted.'); return; }
      try {
        if (!(await freshSignIn(user))) {
          await ask('For your safety, an account can only be deleted right after signing in. Sign in again, then delete it within five minutes.',
            { title: 'Sign in again', ok: 'Sign out', alert: true });
          await window.firebaseSignOut(window.firebaseAuth);
          return;
        }
      } catch (e) { toast('Your sign-in was not confirmed, so nothing was deleted.'); return; }

      toast('Deleting your account…');
      try {
        const m = await import(FIRESTORE);
        const mine = await m.getDocs(m.query(m.collection(window.db, 'posts'), m.where('uid', '==', user.uid)));
        for (let i = 0; i < mine.docs.length; i += 400) {        // a batch holds at most 500 writes
          const batch = m.writeBatch(window.db);
          mine.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
        await m.deleteDoc(m.doc(window.db, 'users', user.uid));
        await m.deleteDoc(m.doc(window.db, 'sessions', user.uid));
      } catch (e) {
        toast('Your posts and profile could not all be deleted, so the account was kept. Try again when you are online.');
        return;
      }
      try {
        await user.delete();
      } catch (e) {
        toast(e && e.code === 'auth/requires-recent-login'
          ? 'Your posts and profile are deleted. Sign in once more and repeat this to delete the sign-in itself.'
          : 'Your posts and profile are deleted, but the sign-in could not be. Try again.');
        return;
      }
    }
    wipeDevice();
    toast(user ? 'Your account has been deleted' : 'Everything on this device has been erased');
    setTimeout(() => location.reload(), 900);
  };

  /* ── Login methods and connected accounts ────────────────────────── */

  reg('loginmethods', {
    t: 'Login methods', i: 'login', p: 'account', k: 'sign in google apple email phone passkey method two factor',
    html: () => {
      const u = me();
      const via = String(u.provider || (u.email ? 'email' : 'guest'));
      const r = (id, label, icon, note) => row({
        icon, label, sub: note,
        value: via.indexOf(id) > -1 ? 'In use' : 'Not set up',
        good: via.indexOf(id) > -1, act: 'addlogin', arg: id, chev: true
      });
      return [
        `<p class="st-lead">Ways into this account. More than one means losing a phone or an inbox does not lock you out.</p>`,
        sec('', [
          r('google', 'Google', 'g_translate', 'One tap, no password to remember'),
          r('apple', 'Apple', 'phone_iphone', 'Sign in with Apple'),
          r('email', 'Email and password', 'mail', 'A reset link is always available'),
          r('phone', 'Phone number', 'sms', 'A code by text message')
        ]),
        sec('', [row({ icon: 'key', label: 'Passkeys', sub: 'Your face, fingerprint or device PIN instead of a password', value: 'Not available yet', to: 'passkeys' })])
      ].join('');
    }
  });

  DO.addlogin = async id => {
    if (guest()) { toast('Sign in once, then add another method.'); return DO.signin(); }
    if (id === 'google' && typeof signInWithGoogle === 'function') { signInWithGoogle(); return; }
    await ask('Adding a sign-in method opens that provider so it can prove the account is yours. Trending never sees the password.',
      { title: 'Add a login method', ok: 'Got it', alert: true });
  };

  reg('connected', {
    t: 'Connected accounts', i: 'link', p: 'account', k: 'connected linked wallet google apple web3 services',
    html: () => {
      const w = (typeof WL !== 'undefined' && WL.accounts) ? WL.accounts() : [];
      const u = me();
      return [
        `<p class="st-lead">Other services signed in to this account, and what each one can see.</p>`,
        sec('Sign-in providers', u.email
          ? [row({ icon: 'mail', label: u.email, sub: 'Used to sign in', value: 'Connected', good: true })]
          : [empty('link_off', 'Nothing connected', 'Sign in to link an account.', 'signin', 'Sign in')]),
        sec('Wallets', w.length
          ? w.map(a => row({ icon: 'account_balance_wallet', label: a.label || a.provider || 'Wallet',
              sub: (typeof WL !== 'undefined' && WL.shortAddr) ? WL.shortAddr(a.address) : '',
              value: 'Read-only', act: 'go:wallets', chev: true }))
          : [row({ icon: 'account_balance_wallet', label: 'Connect a wallet', sub: 'Trending reads the public address only', to: 'wallets' })]),
        `<p class="st-note">A connected wallet lets Trending show your address and balance. It can never move funds — Trending does not sign transactions.</p>`
      ].join('');
    }
  });

  /* Said plainly rather than switched on. This page used to check that
     the device had a screen lock, store "on", and promise a passkey at
     the next sign-in - but no key was ever created and sign-in never
     asked for one. A passkey needs a server that registers the public
     key and checks each signature, and Trending does not have that part
     yet. Until it does, the page says so and offers nothing to press. */
  reg('passkeys', {
    t: 'Passkeys', i: 'key', p: 'loginmethods', k: 'passkey face fingerprint biometric webauthn screen lock',
    html: () => [
      `<p class="st-lead">A passkey replaces the password with the way you already unlock this device.</p>`,
      sec('', [
        row({ icon: 'key', label: 'Passkey on this device', value: 'Not available yet', disabled: true })
      ]),
      `<p class="st-note">Passkeys are not built yet: they need Trending's servers to register your key and check it each time you sign in. Until then, sign in with Google or with your email and password.</p>`
    ].join('')
  });

  /* ── Security ────────────────────────────────────────────────────── */

  reg('security', {
    t: 'Security', i: 'shield', p: 'root',
    k: 'security two factor 2fa authentication passkey login activity sessions devices alerts password protect',
    html: () => [
      `<p class="st-lead">What protects the account, and what is signed in to it.</p>`,
      /* Two-factor was a switch that stored "on" and changed nothing:
         no sign-in ever asked for a second step. It stays visible so
         people know it is coming, but as a statement, not a control. */
      sec('Sign-in protection', [
        ...(me().needsVerification ? [row({ icon: 'mark_email_unread', label: 'Confirm your email',
          sub: 'Needed before you can post or like in the shared feed. Tap to check again, or to get a new link.',
          value: 'Not confirmed', warn: true, act: 'verifyemail', chev: true })] : []),
        row({ icon: 'password', label: 'Change password', sub: 'A reset link goes to your email', act: 'password', chev: true }),
        row({ icon: 'phonelink_lock', label: 'Two-factor authentication', sub: 'A second step when signing in. Not built yet — today your password or Google account is the only step.', value: 'Not available yet', disabled: true }),
        row({ icon: 'key', label: 'Passkeys', to: 'passkeys', value: 'Not available yet' })
      ]),
      sec('Activity', [
        row({ icon: 'devices', label: 'Devices and sessions', to: 'devices', value: String(P().devices().length) }),
        row({ icon: 'history', label: 'Login activity', to: 'loginactivity' })
      ]),
      sec('Alerts', [
        sw('security.alerts', 'Security alerts', 'Password changes and new login methods', { icon: 'notification_important' }),
        sw('security.loginAlerts', 'New login alerts', 'A sign-in from a device the account has not seen', { icon: 'travel_explore' })
      ]),
      /* Not switches. They are how the app is built, and a control
         that cannot be turned off should say so rather than pretend
         to be a choice. */
      /* This row used to say "End-to-end encryption: On". Nothing in the
         app encrypts messages; they are plain text in this browser's
         storage and are never sent anywhere. That is the true statement,
         so it is the one made. */
      sec('Always on', [
        row({ icon: 'smartphone', label: 'Where your chats are kept', sub: 'In this browser only. They are not sent to Trending servers, and they are not end-to-end encrypted.', value: 'This device' }),
        row({ icon: 'key_off', label: 'Zero-knowledge storage', sub: 'Your recovery phrases and private keys are never sent to Trending', value: 'On', good: true })
      ]),
      `<p class="st-note">Trending never asks for a recovery phrase or a private key, and nobody from support ever will. Anyone who does is not us.</p>`
    ].join('')
  });

  /* Checks first - the link may already have been opened on the phone -
     and only sends a new one if it has not. */
  DO.verifyemail = async () => {
    if (typeof sendEmailVerificationLink !== 'function') { toast('Sign-in is offline right now.'); return; }
    const r = await sendEmailVerificationLink();
    toast(r.message);
    SET.repaint();
  };

  reg('devices', {
    t: 'Devices and sessions', i: 'devices', p: 'security', k: 'devices sessions active trusted sign out remote logout everywhere',
    html: () => {
      /* One device cannot be signed out on its own from here - that needs
         a server that can revoke a single session - so the list is a
         record and removing a line only tidies it. Signing out of EVERY
         device is real: it records the time in sessions/{uid}, the
         database refuses any session that signed in before then, and each
         of those devices notices and signs itself out. */
      const list = P().devices();
      return [
        `<p class="st-lead">Devices this browser has recorded for your account. Removing one only tidies this list; to end the other sessions, sign out of every device.</p>`,
        sec('', list.map(d => row({
          icon: d.here ? 'smartphone' : 'computer',
          label: d.name + (d.here ? ' · this device' : ''),
          sub: 'First seen ' + when(d.first) + ' · last used ' + when(d.seen),
          value: d.here ? 'Active' : 'Remove from list', good: d.here,
          act: d.here ? '' : 'enddevice', arg: d.id, chev: !d.here
        }))),
        sec('', [row({ icon: 'logout', label: 'Sign out of every device', sub: 'Every device, including this one, has to sign in again', act: 'endall', danger: true, chev: true })])
      ].join('');
    }
  });

  DO.enddevice = async id => {
    if (!(await ask('Remove this device from the list? This does not sign it out — use "Sign out of every device" for that.', { ok: 'Remove', danger: true }))) return;
    P().endDevice(id);
    toast('Removed from the list');
    SET.repaint();
  };

  const FIRESTORE = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
  const AUTH_SDK = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
  const fbUser = () => (window.firebaseAuth && window.firebaseAuth.currentUser) || null;

  DO.endall = async () => {
    const user = fbUser();
    if (guest() || !user || !window.db) { if (typeof signOut === 'function') signOut(); return; }
    if (!(await ask('Sign out on every device, including this one? Each will have to sign in again.', { ok: 'Sign out everywhere', danger: true }))) return;
    if (!(await P().verify('Signing out of every device'))) return;
    try {
      const m = await import(FIRESTORE);
      await m.setDoc(m.doc(window.db, 'sessions', user.uid), { revokedAt: m.serverTimestamp() });
    } catch (e) {
      toast('That did not go through, so your other devices are still signed in. Try again.');
      return;
    }
    P().devices().forEach(d => P().endDevice(d.id));
    await window.firebaseSignOut(window.firebaseAuth);
    toast('Signed out on every device');
  };

  reg('loginactivity', {
    t: 'Login activity', i: 'history', p: 'security', k: 'login activity history where signed in recent',
    html: () => {
      const list = P().devices();
      return [
        `<p class="st-lead">Where the account has been opened. Anything you do not recognise is worth a password change.</p>`,
        list.length
          ? sec('', list.map(d => row({ icon: 'schedule', label: d.name, sub: 'Last used ' + when(d.seen), value: d.here ? 'This device' : '' })))
          : empty('history_toggle_off', 'No activity yet', 'Sessions appear here as the account is opened on each device.'),
        sec('', [row({ icon: 'password', label: 'Something is wrong — reset my password', act: 'password', danger: true, chev: true })])
      ].join('');
    }
  });

  /* ── Crypto and wallet security ──────────────────────────────────── */

  reg('cryptosec', {
    t: 'Crypto and wallet security', i: 'lock', p: 'root',
    k: 'crypto wallet security withdrawal verification whitelist address confirm transaction web3 seed phrase private key',
    html: () => [
      `<p class="st-lead">Extra care around anything that moves coins — sends, withdrawals and address changes.</p>`,
      sec('Before money moves', [
        sw('crypto.confirmSends', 'Confirm every send', 'A review step with amount, network and fee before the hand-off', { icon: 'fact_check' }),
        sw('crypto.whitelistOnly', 'Only send to saved addresses', 'Refuse any address that is not in your address book', { icon: 'verified_user', act: 'tgwhitelist' }),
        row({ icon: 'timer', label: 'Ask again after', value: P().get('crypto.verifyMins') + ' min', to: 'verifywindow' })
      ]),
      sec('Addresses and wallets', [
        row({ icon: 'contacts', label: 'Address book', to: 'addressbook' }),
        row({ icon: 'account_balance_wallet', label: 'Connected wallets', to: 'wallets' })
      ]),
      sec('Alerts', [
        sw('crypto.notifSecurity', 'Crypto security alerts', 'New address saved, wallet connected, unusually large send', { icon: 'gpp_maybe' }),
        row({ icon: 'notifications_active', label: 'All crypto notifications', to: 'cryptonotif' })
      ]),
      `<p class="st-note"><b>Trending never signs or broadcasts a transaction.</b> A send is prepared here and handed to your own wallet app, which asks you to approve it. Your recovery phrase and private keys stay in that wallet — Trending will never ask for them, show them, or store them.</p>`
    ].join('')
  });

  DO.tgwhitelist = async (a, b, el) => {
    const on = el.checked;
    if (!(await P().verify(on ? 'Restricting sends to saved addresses' : 'Allowing sends to any address'))) { SET.repaint(); return; }
    if (on && (!window.WAD || !WAD.peerList || !WAD.peerList().length)) {
      const go = await ask('Your address book is empty, so this would block every send. Add an address first?', { ok: 'Open address book' });
      SET.repaint();
      if (go) SET.go('addressbook');
      return;
    }
    P().set('crypto.whitelistOnly', on);
    toast(on ? 'Sends are limited to saved addresses' : 'Sends to any address are allowed again');
    SET.repaint();
  };

  reg('verifywindow', {
    t: 'Ask again after', i: 'timer', p: 'cryptosec', k: 'verification window timeout confirm again minutes re-auth',
    html: () => [
      `<p class="st-lead">Once you have confirmed it is you, Trending will not ask again for this long.</p>`,
      pick('crypto.verifyMins', [
        [1, 'Every time', 'Safest — every send and security change asks'],
        [5, '5 minutes', 'Enough for several sends in a row'],
        [15, '15 minutes', 'Convenient on a device only you use'],
        [60, '1 hour', 'Only on a device nobody else touches']
      ]),
      `<p class="st-note">The clock is kept in memory, so closing the tab always ends it.</p>`
    ].join('')
  });

  /* ── Saved ───────────────────────────────────────────────────────── */

  reg('saved', {
    t: 'Saved', i: 'bookmark', p: 'root', k: 'saved bookmarks collections posts videos shorty reels crypto watchlist',
    html: () => {
      const sh = shorty();
      const savedShorts = nkeys(sh.saved);
      const savedPosts = nkeys(store('ts_note_interactions_v1', {}).saved);
      const watch = (typeof CT !== 'undefined' && CT.state && CT.state.watch) ? CT.state.watch.length : 0;
      const cols = P().get('saved.collections', []) || [];
      const nothing = !savedShorts && !savedPosts && !watch && !cols.length;
      return [
        `<p class="st-lead">Only you can see what you have saved.</p>`,
        /* The rows stay even when the counts are zero: they are the way
           into the drawers themselves, and a screen that hides its own
           doors until it has something in them is a dead end. */
        nothing ? empty('bookmark_border', 'Nothing saved yet',
          'Tap save on a post or a Shorty and it is kept here.') : '',
        sec('', [
          row({ icon: 'bookmark', label: 'Saved bookmarks', sub: 'Articles, posts and links you kept',
            value: String(savedPosts), act: 'profsec', arg: 'saved', chev: true }),
          row({ icon: 'slow_motion_video', label: 'Saved Shorty', value: String(savedShorts), act: 'savedshorts', chev: true }),
          row({ icon: 'currency_bitcoin', label: 'Watchlist', sub: 'Coins you follow', value: String(watch), to: 'watchlist' })
        ]),
        sec('Collections', cols.map((c, i) => row({
          icon: 'folder', label: c.name, sub: (c.items || []).length + ' items', act: 'delcollection', arg: String(i), chev: true
        })).concat([row({ icon: 'create_new_folder', label: 'New collection', sub: 'Group saved things by topic', act: 'newcollection', chev: true })]))
      ].join('');
    }
  });

  DO.savedshorts = () => {
    if (typeof SH !== 'undefined' && SH.setTab) SH.setTab('saved');
    if (typeof navigateTo === 'function') navigateTo('reels');
  };

  DO.newcollection = async () => {
    const name = await askText('Name this collection', '', { title: 'New collection', ok: 'Create' });
    if (!name || !String(name).trim()) return;
    const list = (P().get('saved.collections', []) || []).slice();
    list.push({ name: String(name).trim(), at: Date.now(), items: [] });
    P().set('saved.collections', list);
    toast('“' + String(name).trim() + '” created — save into it from a post’s share menu');
    SET.repaint();
  };

  DO.delcollection = async i => {
    const list = (P().get('saved.collections', []) || []).slice();
    const c = list[+i];
    if (!c) return;
    if (!(await ask('Delete the collection “' + c.name + '”? What is in it stays saved.', { ok: 'Delete', danger: true }))) return;
    list.splice(+i, 1);
    P().set('saved.collections', list);
    toast('Collection deleted');
    SET.repaint();
  };

  /* ── Archive ─────────────────────────────────────────────────────── */

  reg('archive', {
    t: 'Archive', i: 'archive', p: 'root', k: 'archive archived stories posts live videos highlights',
    html: () => {
      const stories = (store('ts_mystories_v1', []) || []).length;
      const hl = (store('ts_highlights_v1', []) || []).length;
      return [
        `<p class="st-lead">Things that have come off your profile but are still yours.</p>`,
        sec('', [
          row({ icon: 'auto_stories', label: 'Stories archive', sub: 'Kept here after 24 hours', value: String(stories), act: 'pane:profile', chev: true }),
          row({ icon: 'star', label: 'Highlights', sub: 'Archived stories pinned to your profile', value: String(hl), act: 'pane:profile', chev: true }),
          row({ icon: 'grid_on', label: 'Archived posts', sub: 'Hidden from your profile, still yours', act: 'pane:profile', chev: true }),
          row({ icon: 'sensors', label: 'Archived live sessions', sub: 'Recordings of streams you have ended', act: 'pane:profile', chev: true })
        ]),
        sec('Keep automatically', [
          sw('archive.stories', 'Archive stories', 'Keep every story after it expires', { icon: 'history' }),
          sw('archive.live', 'Archive live sessions', 'Keep a recording when a stream ends', { icon: 'videocam' })
        ])
      ].join('');
    }
  });

  /* ── Your activity ───────────────────────────────────────────────── */

  reg('activity', {
    t: 'Your activity', i: 'bar_chart', p: 'root',
    k: 'activity likes comments replies shares search history link history recently viewed clear',
    html: () => {
      const sh = shorty();
      const ni = store('ts_note_interactions_v1', {});
      const sr = store('ts_search', {});
      const searches = Object.keys(sr.recent || sr || {}).length;
      const links = (P().get('activity.links', []) || []).length;
      return [
        `<p class="st-lead">What you have done on Trending, and the controls to clear it.</p>`,
        sec('Interactions', [
          row({ icon: 'favorite', label: 'Likes', sub: 'Everything you have liked',
            value: String(nkeys(sh.liked) + nkeys(ni.liked)), act: 'profsec', arg: 'liked', chev: true }),
          row({ icon: 'mode_comment', label: 'Comments and replies', value: String(nkeys(sh.comments)), act: 'pane:feeds', chev: true }),
          row({ icon: 'ios_share', label: 'Shares', act: 'pane:feeds', chev: true }),
          row({ icon: 'bookmark', label: 'Saved', to: 'saved' })
        ]),
        sec('History', [
          row({ icon: 'history', label: 'Watch history', sub: 'What you have read and watched', act: 'profsec', arg: 'history', chev: true }),
          row({ icon: 'search', label: 'Search history', value: searches ? String(searches) : 'Empty', act: 'clearsearches', chev: true }),
          row({ icon: 'link', label: 'Link history', sub: 'External links you have opened', value: links ? String(links) : 'Empty', act: 'clearlinks', chev: true }),
          row({ icon: 'visibility', label: 'Recently viewed', sub: 'What Discover has seen you watch', act: 'tunediscover', chev: true })
        ]),
        sec('Account activity', [
          row({ icon: 'insights', label: 'Analytics', sub: 'Views, reach and growth on what you post', act: 'profsec', arg: 'analytics', chev: true }),
          row({ icon: 'shopping_cart', label: 'Purchases', sub: 'Your marketplace orders', act: 'profsec', arg: 'purchases', chev: true }),
          row({ icon: 'receipt_long', label: 'Payments and transfers', to: 'txhistory' }),
          row({ icon: 'devices', label: 'Where you are signed in', to: 'devices' })
        ]),
        sec('Clear', [
          row({ icon: 'delete_sweep', label: 'Clear search history', act: 'clearsearches', danger: true, chev: true }),
          row({ icon: 'restart_alt', label: 'Reset what Discover has learned', act: 'resetdiscover', danger: true, chev: true })
        ])
      ].join('');
    }
  });

  DO.clearsearches = async () => {
    if (!(await ask('Clear your search history on this device?', { ok: 'Clear', danger: true }))) return;
    if (window.DX && DX.clearSearches) DX.clearSearches();
    else { try { localStorage.removeItem('ts_search'); } catch (e) {} toast('Search history cleared'); }
    SET.repaint();
  };

  DO.clearlinks = async () => {
    if (!(P().get('activity.links', []) || []).length) { toast('Nothing to clear.'); return; }
    if (!(await ask('Clear the list of external links you have opened?', { ok: 'Clear', danger: true }))) return;
    P().set('activity.links', []);
    toast('Link history cleared');
    SET.repaint();
  };

  DO.tunediscover = () => { if (window.DX && DX.openSettings) DX.openSettings(); else toast('Discover is still loading…'); };
  DO.resetdiscover = () => { if (window.DX && DX.resetAll) DX.resetAll(); else toast('Discover is still loading…'); };

  /* ── Notifications ───────────────────────────────────────────────── */

  reg('notif', {
    t: 'Notifications', i: 'notifications', p: 'root',
    k: 'notifications push alerts posts messages followers mentions comments communities live creator security crypto quiet hours pause sound vibration',
    html: () => {
      const paused = !!P().get('notif.pause');
      const line = (k, l, s, i) => sw('notif.' + k, l, s, { icon: i, off: paused });
      return [
        `<p class="st-lead">What Trending may interrupt you for.</p>`,
        sec('', [sw('notif.pause', 'Pause all notifications', 'Nothing comes through except security alerts', { icon: 'do_not_disturb_on' })]),
        sec('Social', [
          line('posts', 'Posts', 'Likes and activity on what you post', 'grid_on'),
          line('messages', 'Messages', 'New messages and message requests', 'chat'),
          line('followers', 'Followers', 'New followers and follow requests', 'person_add'),
          line('mentions', 'Mentions', 'When someone tags you', 'alternate_email'),
          line('comments', 'Comments', 'Replies to your posts and comments', 'mode_comment')
        ]),
        sec('Communities and live', [
          line('communities', 'Communities', 'Posts, polls and proposals where you are a member', 'groups'),
          line('live', 'Live streams', 'When someone you follow goes live', 'sensors'),
          line('creator', 'Creator', 'Milestones, insights and monetisation', 'insights')
        ]),
        sec('Account and money', [
          line('crypto', 'Crypto', 'Deposits, sends, price alerts and orders', 'currency_bitcoin'),
          row({ icon: 'currency_exchange', label: 'Which crypto notifications', sub: 'Price, deposits, sends and security separately', to: 'cryptonotif' }),
          sw('notif.security', 'Security', 'Always on — sign-ins, password changes and wallet alerts', { icon: 'shield', off: true, value: true })
        ]),
        sec('When', [
          sw('notif.quietOn', 'Quiet hours', 'Hold everything except security alerts', { icon: 'bedtime' }),
          P().get('notif.quietOn') ? row({ icon: 'schedule', label: 'Quiet from',
            value: P().get('notif.quietFrom') + ' – ' + P().get('notif.quietTo'), act: 'quiethours', chev: true }) : ''
        ]),
        sec('How', [
          sw('notif.sound', 'Sound', '', { icon: 'volume_up', off: paused }),
          sw('notif.vibrate', 'Vibration', '', { icon: 'vibration', off: paused }),
          row({ icon: 'notifications_active', label: 'Browser notifications', sub: 'What this device allows', to: 'permissions' })
        ]),
        paused ? `<p class="st-note">Notifications are paused, so the choices above are on hold.</p>` : ''
      ].join('');
    }
  });

  DO.quiethours = () => SET.sheet('Quiet hours', `
    <p class="st-sheet-p">Nothing comes through between these times except security alerts.</p>
    <div class="st-times">
      <label class="st-time"><span>From</span><input type="time" value="${esc(P().get('notif.quietFrom'))}" data-st="settime" data-a="notif.quietFrom"></label>
      <label class="st-time"><span>To</span><input type="time" value="${esc(P().get('notif.quietTo'))}" data-st="settime" data-a="notif.quietTo"></label>
    </div>
    <button type="button" class="btn btn-primary w100" data-st="closesheet">Done</button>`);

  DO.settime = (path, b, el) => {
    if (!/^\d{2}:\d{2}$/.test(el.value)) return;
    P().set(path, el.value);
    SET.repaint();
  };

  /* ── Time management ─────────────────────────────────────────────── */

  /* The clock runs on this device and the total never leaves it. A
     number that had to be uploaded to be shown would be worse than
     not showing one. */
  reg('time', {
    t: 'Time management', i: 'schedule', p: 'root',
    k: 'time management daily usage reminder break sleep quiet hours screen time limit',
    html: () => {
      const mins = +P().get('time.reminder') || 0;
      const brk = +P().get('time.breaks') || 0;
      const used = Math.round((SET.usedToday() || 0) / 60000);
      return [
        `<p class="st-lead">Trending counts time spent in the app on this device. The count stays here.</p>`,
        sec('Today', [
          row({ icon: 'timelapse', label: 'Time in the app today',
            value: used >= 60 ? Math.floor(used / 60) + 'h ' + (used % 60) + 'm' : used + ' min' })
        ]),
        sec('Reminders', [
          row({ icon: 'alarm', label: 'Daily limit reminder', sub: 'A nudge once you pass this much in a day',
            value: mins ? mins + ' min' : 'Off', act: 'setreminder', chev: true }),
          row({ icon: 'self_improvement', label: 'Break reminder', sub: 'A nudge after this long in one sitting',
            value: brk ? brk + ' min' : 'Off', act: 'setbreaks', chev: true })
        ]),
        sec('Sleep', [
          sw('time.sleepOn', 'Sleep mode', 'Dim the app and hold notifications overnight', { icon: 'bedtime' }),
          P().get('time.sleepOn') ? row({ icon: 'schedule', label: 'Sleep hours',
            value: P().get('time.sleepFrom') + ' – ' + P().get('time.sleepTo'), act: 'sleephours', chev: true }) : ''
        ])
      ].join('');
    }
  });

  const MINUTES = [[0, 'Off'], [15, '15 minutes'], [30, '30 minutes'], [45, '45 minutes'], [60, '1 hour'], [90, '1 hour 30'], [120, '2 hours']];

  DO.setreminder = () => SET.sheet('Daily limit reminder',
    pick('time.reminder', MINUTES) + `<button type="button" class="btn btn-primary w100 mt12" data-st="closesheet">Done</button>`);

  DO.setbreaks = () => SET.sheet('Break reminder',
    pick('time.breaks', MINUTES.filter(m => m[0] < 90)) + `<button type="button" class="btn btn-primary w100 mt12" data-st="closesheet">Done</button>`);

  DO.sleephours = () => SET.sheet('Sleep hours', `
    <p class="st-sheet-p">The app dims and notifications wait until morning.</p>
    <div class="st-times">
      <label class="st-time"><span>From</span><input type="time" value="${esc(P().get('time.sleepFrom'))}" data-st="settime" data-a="time.sleepFrom"></label>
      <label class="st-time"><span>To</span><input type="time" value="${esc(P().get('time.sleepTo'))}" data-st="settime" data-a="time.sleepTo"></label>
    </div>
    <button type="button" class="btn btn-primary w100" data-st="closesheet">Done</button>`);
}
