// ── FIREBASE AUTHENTICATION MODULE ─────────────────────────────────
// Real Google OAuth + Email/Password Authentication using Firebase

/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

(function() {
  'use strict';

  // Wait for Firebase to be ready
  let auth = null;
  let googleProvider = null;

  function initAuth() {
    if (!window.firebaseAuth) {
      console.warn('⏳ Firebase Auth SDK not yet loaded, retrying...');
      setTimeout(initAuth, 500);
      return;
    }

    auth = window.firebaseAuth;
    googleProvider = new window.FirebaseGoogleAuthProvider();
    
    // Listen for auth state changes
    window.firebaseOnAuthStateChanged(auth, handleAuthStateChange);
    console.log('🔐 Firebase Auth initialized and listening.');
  }

  // ── AUTH STATE LISTENER ──
  function handleAuthStateChange(user) {
    if (user) {
      // User is signed in
      console.log('✅ User signed in:', user.displayName || user.email);
      
      /* A phone-number account has no email and often no display name, so
         neither can be assumed. This used to read user.email.split(), which
         threw for a phone sign-in: Firebase signed the person in and the app
         never let them in. The handle falls back to the uid, never to digits
         of the phone number, which would be public on the profile. */
      const shortId = String(user.uid || '').slice(0, 6).toLowerCase();
      const emailName = user.email ? user.email.split('@')[0] : '';
      const displayName = user.displayName || emailName || 'Trending user';
      const nameParts = displayName.split(' ');
      
      S.user = {
        uid: user.uid,
        fname: nameParts[0] || 'User',
        lname: nameParts.slice(1).join(' ') || '',
        handle: '@' + (emailName || 'user' + shortId),
        email: user.email,
        avatar: user.photoURL || null,
        bio: 'Verified Trending member 🛡️',
        level: 1,
        /* An email-and-password account that has not opened its
           confirmation link yet. The shared feed refuses its posts and
           likes (firestore.rules verified()), so the app says why. */
        needsVerification: needsVerification(user)
      };
      if (S.user.needsVerification) recheckVerification(user);

      // Save user profile to Firestore
      saveUserProfile(user);
      loadPublicProfile(user);
      watchSessions(user);
      
      updateUserUI();
      updateAvatarWithPhoto();
      closeAuthModal();
      
      // Show the app
      document.querySelector('.app-wrapper').style.display = '';
      document.querySelector('.mobile-nav').style.display = '';
      
      showToast(`Welcome, ${S.user.fname}! 🚀`);
    } else {
      stopWatchingSessions();
      // User is signed out — show auth modal
      console.log('👤 No user signed in, showing auth modal.');
      S.user = {
        fname: 'Guest',
        lname: 'User',
        handle: '@guest_user',
        bio: 'Sign in to unlock your digital universe.'
      };
      updateUserUI();
      // Respect a previous "Explore as Guest" choice
      if (localStorage.getItem('ts_guest') === '1') {
        closeAuthModal();
      } else {
        openAuthModal();
      }
    }
  }

  // ── EMAIL CONFIRMATION ──
  const AUTH_SDK = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
  const needsVerification = user => !user.emailVerified &&
    (user.providerData || []).some(p => p && p.providerId === 'password');

  /* The link is opened in the mail app, often on another device, so this
     session does not hear about it. Asking Firebase again picks it up,
     and a fresh token carries the confirmed flag to the database. */
  async function recheckVerification(user) {
    try {
      await user.reload();
      const now = auth && auth.currentUser;
      if (now && now.emailVerified) {
        await now.getIdToken(true);
        if (S.user) S.user.needsVerification = false;
        return true;
      }
    } catch (e) { /* offline - keep the old answer */ }
    return false;
  }
  window.recheckEmailVerification = () => auth && auth.currentUser ? recheckVerification(auth.currentUser) : Promise.resolve(false);

  window.sendEmailVerificationLink = async function() {
    const u = auth && auth.currentUser;
    if (!u || !u.email) return { ok: false, message: 'Sign in with an email address first.' };
    if (await recheckVerification(u)) return { ok: true, already: true, message: 'Your email is confirmed.' };
    try {
      const { sendEmailVerification } = await import(AUTH_SDK);
      await sendEmailVerification(u);
      return { ok: true, message: 'Confirmation link sent to ' + u.email };
    } catch (e) {
      return { ok: false, message: e && e.code === 'auth/too-many-requests'
        ? 'A link was sent a moment ago. Check your inbox, or try again in a few minutes.'
        : 'The link could not be sent right now.' };
    }
  };

  // ── WHO YOU ARE, FOR THE WALLET SERVER ──
  /* The server checks the Firebase sign-in token itself (middleware/
     auth.js). Callers use this only for the app's own /api addresses,
     never another site. getIdToken() refreshes an expired token. */
  window.authHeaders = async function() {
    const u = auth && auth.currentUser;
    if (!u) return {};
    try { return { Authorization: 'Bearer ' + await u.getIdToken() }; } catch (e) { return {}; }
  };

  // ── SIGNED OUT EVERYWHERE ──
  /* "Sign out of every device" writes a time to sessions/{uid}. Each
     signed-in device watches that document, and one that signed in
     before that time signs itself out. The database enforces it anyway -
     an older session can no longer write, or read the profile - this
     just makes the device notice instead of failing quietly. */
  let unwatchSessions = null;
  function stopWatchingSessions() {
    if (unwatchSessions) { try { unwatchSessions(); } catch (e) {} unwatchSessions = null; }
  }
  async function watchSessions(user) {
    stopWatchingSessions();
    if (!window.db || !window.firebaseOnSnapshot || !window.firebaseDoc) return;
    let signedInAt = 0;
    try { signedInAt = Number((await user.getIdTokenResult()).claims.auth_time) * 1000; } catch (e) { return; }
    if (!signedInAt || !auth.currentUser || auth.currentUser.uid !== user.uid) return;
    unwatchSessions = window.firebaseOnSnapshot(window.firebaseDoc(window.db, 'sessions', user.uid), snap => {
      const at = snap.exists() ? snap.data().revokedAt : null;
      const endedAt = at && at.toMillis ? at.toMillis() : 0;
      if (endedAt && endedAt >= signedInAt) {
        stopWatchingSessions();
        window.firebaseSignOut(auth).then(() => {
          if (typeof showToast === 'function') showToast('You were signed out on every device. Sign in again to continue.');
        });
      }
    }, () => { /* rules not published yet, or offline - the database still enforces it */ });
  }

  // ── GUEST MODE ──
  window.continueAsGuest = function() {
    localStorage.setItem('ts_guest', '1');
    closeAuthModal();
    if (typeof showToast === 'function') showToast('Browsing as guest — sign in anytime 👋');
  };

  // ── SAVE USER PROFILE TO FIRESTORE ──
  async function saveUserProfile(user) {
    if (!window.db) return;
    try {
      const { doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const userRef = doc(window.db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // First time user — create profile
        await setDoc(userRef, {
          displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Trending user'),
          email: user.email || null,
          photoURL: user.photoURL || null,
          xp: 0,
          level: 1,
          joinedAt: window.firebaseServerTimestamp(),
          followers: 0,
          following: 0
        });
        console.log('📝 New user profile created in Firestore.');
        showToast('Your profile has been created! 🎉');
      } else {
        console.log('📂 Existing user profile loaded from Firestore.');
        // Load existing XP/level
        const data = userSnap.data();
        S.user.level = data.level || 1;
        S.user.xp = data.xp || 0;
      }
    } catch (err) {
      console.warn('⚠️ Could not save user profile to Firestore:', err);
    }
  }

  /* The handle and name this account posts under in the shared feed, if
     it has claimed one (profiles/{uid}). Known up front, the feed shares
     under it without asking and Edit profile can say it is fixed. */
  async function loadPublicProfile(user) {
    if (!window.db) return;
    try {
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const snap = await getDoc(doc(window.db, 'profiles', user.uid));
      if (snap.exists() && S.user && S.user.uid === user.uid) {
        const d = snap.data();
        S.user.publicProfile = { name: d.name, displayName: d.displayName };
      }
    } catch (e) { /* offline: the feed asks again when it needs to */ }
  }

  // ── UPDATE AVATAR WITH REAL PHOTO ──
  function updateAvatarWithPhoto() {
    if (!S.user.avatar) return;
    
    const avatarIds = ['sidebar-av', 'header-av', 'composer-av', 'profile-av'];
    avatarIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '';
        el.style.backgroundImage = `url(${S.user.avatar})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
      }
    });
  }

  // ── GOOGLE SIGN-IN (REAL) ──
  window.signInWithGoogle = async function() {
    localStorage.removeItem('ts_guest');
    const mainView = document.getElementById('auth-main-view');
    const loadingView = document.getElementById('auth-loading-view');
    const statusLbl = document.getElementById('auth-loading-status');

    if (mainView && loadingView && statusLbl) {
      mainView.style.display = 'none';
      loadingView.style.display = 'flex';
      loadingView.classList.remove('hidden');
      statusLbl.textContent = 'Opening Google Sign-In...';
    }

    try {
      const result = await window.firebaseSignInWithPopup(auth, googleProvider);
      // Auth state listener handles the rest
      console.log('✅ Google Sign-In successful:', result.user.displayName);
    } catch (error) {
      console.error('❌ Google Sign-In error:', error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        showToast('Sign-in cancelled. Try again when ready.');
      } else if (error.code === 'auth/popup-blocked') {
        showToast('Pop-up blocked! Please allow pop-ups for this site.');
      } else {
        showToast('Sign-in failed: ' + (error.message || 'Unknown error'));
      }
      
      // Reset the modal back to main view
      if (mainView && loadingView) {
        mainView.style.display = 'block';
        loadingView.style.display = 'none';
        loadingView.classList.add('hidden');
      }
    }
  };

  /* Email sign-in is js/signin.js, which owns this modal's markup
     (#gmail-login-form, #ts-submit, #ts-reset) and loads last. A
     second window.signInWithGmail used to sit here, overwritten
     before it could ever run, together with the resetAuthModal
     only it called. The auth-state spinner above is still ours. */

  // ── SIGN OUT (REAL) ──
  window.signOut = async function() {
    if (await appConfirm('Sign out of Trending?', { ok: 'Sign out' })) {
      try {
        await window.firebaseSignOut(auth);
        showToast('Signed out successfully 👋');
      } catch (error) {
        console.error('❌ Sign out error:', error);
        showToast('Error signing out.');
      }
    }
  };

  // ── INITIALIZE ──
  // Wait for DOM and Firebase SDK to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initAuth, 1000));
  } else {
    setTimeout(initAuth, 1000);
  }
})();

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
publish('utils/firebase-auth.js', {});
