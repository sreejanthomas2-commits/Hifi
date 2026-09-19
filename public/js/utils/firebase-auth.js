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
      
      const displayName = user.displayName || user.email.split('@')[0];
      const nameParts = displayName.split(' ');
      
      S.user = {
        uid: user.uid,
        fname: nameParts[0] || 'User',
        lname: nameParts.slice(1).join(' ') || '',
        handle: '@' + (user.email ? user.email.split('@')[0] : 'user'),
        email: user.email,
        avatar: user.photoURL || null,
        bio: 'Verified Trending member 🛡️',
        level: 1
      };

      // Save user profile to Firestore
      saveUserProfile(user);
      
      updateUserUI();
      updateAvatarWithPhoto();
      closeAuthModal();
      
      // Show the app
      document.querySelector('.app-wrapper').style.display = '';
      document.querySelector('.mobile-nav').style.display = '';
      
      showToast(`Welcome, ${S.user.fname}! 🚀`);
    } else {
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
          displayName: user.displayName || user.email.split('@')[0],
          email: user.email,
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

  // ── EMAIL/PASSWORD SIGN-IN (REAL) ──
  window.signInWithGmail = async function(event) {
    if (event) event.preventDefault();
    localStorage.removeItem('ts_guest');

    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');
    if (!emailInput || !passInput) return;

    const email = emailInput.value.trim();
    const password = passInput.value.trim();

    if (!email || !password) {
      showToast('Please enter your email and password.');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters.');
      return;
    }

    const mainView = document.getElementById('auth-main-view');
    const loadingView = document.getElementById('auth-loading-view');
    const statusLbl = document.getElementById('auth-loading-status');

    if (mainView && loadingView && statusLbl) {
      mainView.style.display = 'none';
      loadingView.style.display = 'flex';
      loadingView.classList.remove('hidden');
      statusLbl.textContent = 'Authenticating...';
    }

    try {
      // Try to sign in first
      await window.firebaseSignInWithEmailAndPassword(auth, email, password);
      console.log('✅ Email sign-in successful');
    } catch (signInError) {
      if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
        // User doesn't exist — create a new account
        if (statusLbl) statusLbl.textContent = 'Creating your account...';
        try {
          await window.firebaseCreateUserWithEmailAndPassword(auth, email, password);
          console.log('✅ New account created successfully');
          showToast('Account created! Welcome to Trending 🎉');
        } catch (createError) {
          console.error('❌ Account creation error:', createError);
          showToast('Error: ' + (createError.message || 'Could not create account'));
          resetAuthModal();
        }
      } else if (signInError.code === 'auth/wrong-password') {
        showToast('Incorrect password. Please try again.');
        resetAuthModal();
      } else if (signInError.code === 'auth/too-many-requests') {
        showToast('Too many attempts. Please try again later.');
        resetAuthModal();
      } else {
        console.error('❌ Email sign-in error:', signInError);
        showToast('Error: ' + (signInError.message || 'Sign-in failed'));
        resetAuthModal();
      }
    }

    emailInput.value = '';
    passInput.value = '';
  };

  function resetAuthModal() {
    const mainView = document.getElementById('auth-main-view');
    const loadingView = document.getElementById('auth-loading-view');
    if (mainView) mainView.style.display = 'block';
    if (loadingView) {
      loadingView.style.display = 'none';
      loadingView.classList.add('hidden');
    }
  }

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
