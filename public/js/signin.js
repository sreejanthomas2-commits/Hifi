/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SIGN IN — js/signin.js                                           ║
   ║                                                                   ║
   ║  Owns #auth-modal: the email form, the three providers, and the   ║
   ║  phone-code flow. Everything here talks to real Firebase Auth.    ║
   ║  Nothing pretends to sign anyone in.                              ║
   ║                                                                   ║
   ║  Google already works. Apple and phone need their provider        ║
   ║  switched on in the Firebase console first - Apple also needs a   ║
   ║  paid Apple Developer account, and phone needs Blaze billing for  ║
   ║  the SMS. Until then Firebase answers auth/operation-not-allowed  ║
   ║  and the button says exactly that rather than failing vaguely.    ║
   ║                                                                   ║
   ║  Three views share the panel - main, phone, code - and only one   ║
   ║  is ever unhidden. show() is the only thing that moves between    ║
   ║  them, so there is one place to look when a view sticks.          ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

(() => {
  let creating = false;
  const get = id => document.getElementById(id);
  const feedback = text => { const el = get('ts-auth-feedback'); if (el) el.textContent = text; };

  /* ── The three views ─────────────────────────────────────────────── */
  const VIEWS = ['auth-main-view', 'auth-phone-view', 'auth-otp-view', 'auth-loading-view'];
  const COPY = {
    'auth-main-view':  ['GOOD TO SEE YOU AGAIN', 'Welcome back.', 'Your feed, your people and your wallet are where you left them.'],
    'auth-phone-view': ['SIGN IN WITH YOUR PHONE', 'What is your number?', 'We will text you a six-digit code. No password to remember.'],
    'auth-otp-view':   ['ONE LAST STEP', 'Check your messages.', 'Enter the six digits we just sent you.']
  };
  function show(id) {
    VIEWS.forEach(v => get(v)?.classList.toggle('hidden', v !== id));
    const copy = COPY[id];
    if (copy) {
      get('ts-eyebrow').textContent = copy[0];
      get('signin-title').innerHTML = copy[1].replace(/\.$/, '<span>.</span>');
      get('ts-subtitle').textContent = copy[2];
    }
  }

  /* Firebase reports the cause in error.code. Anything that is the
     project's configuration rather than the person's typing says so,
     because "try again" is useless advice for a provider that is off. */
  const SAYS = {
    'auth/invalid-credential':        'That email and password do not match. Please try again.',
    'auth/wrong-password':            'That email and password do not match. Please try again.',
    'auth/user-not-found':            'That email and password do not match. Please try again.',
    'auth/email-already-in-use':      'This email already has an account. Sign in instead.',
    'auth/weak-password':             'Choose a stronger password — at least 6 characters.',
    'auth/too-many-requests':         'Too many attempts. Please wait a few minutes and try again.',
    'auth/network-request-failed':    'Could not reach the server. Check your connection and try again.',
    'auth/popup-closed-by-user':      'Sign-in window closed before it finished.',
    'auth/cancelled-popup-request':   '',
    'auth/popup-blocked':             'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
    'auth/operation-not-allowed':     'This sign-in method is not switched on for this app yet. Use email or Google for now.',
    'auth/unauthorized-domain':       'This site is not on the app’s list of allowed sign-in domains yet.',
    'auth/invalid-phone-number':      'That does not look like a valid number. Include your country code, like +91.',
    'auth/missing-phone-number':      'Enter your mobile number first.',
    'auth/quota-exceeded':            'The app has sent too many codes today. Please try another way in.',
    'auth/invalid-verification-code': 'That code is not right. Check the digits and try again.',
    'auth/code-expired':              'That code has expired. Send yourself a new one.',
    'auth/captcha-check-failed':      'The robot check did not pass. Reload the page and try again.'
  };
  const why = (error, fallback) => {
    const said = SAYS[error && error.code];
    return said === undefined ? (fallback || 'Something went wrong. Please try again.') : said;
  };
  const ready = () => !!window.firebaseAuth;

  /* ── Email and password ──────────────────────────────────────────── */
  get('ts-show').addEventListener('click', () => {
    const hidden = get('auth-password').type === 'password';
    get('auth-password').type = hidden ? 'text' : 'password';
    get('ts-show').setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
    get('ts-show').setAttribute('aria-pressed', String(hidden));
    get('ts-show').firstElementChild.textContent = hidden ? 'visibility_off' : 'visibility';
  });

  get('ts-mode').addEventListener('click', () => {
    creating = !creating;
    get('ts-eyebrow').textContent = creating ? 'FIRST TIME HERE' : 'GOOD TO SEE YOU AGAIN';
    get('signin-title').innerHTML = creating ? 'Join your universe<span>.</span>' : 'Welcome back<span>.</span>';
    get('ts-subtitle').textContent = creating
      ? 'One account for the feed, the wallet and everything between.'
      : 'Your feed, your people and your wallet are where you left them.';
    get('ts-submit').innerHTML = creating ? 'Create account <span>↗</span>' : 'Sign in <span>↗</span>';
    get('ts-mode').textContent = creating ? 'Sign in instead' : 'Create an account';
    get('auth-password').autocomplete = creating ? 'new-password' : 'current-password';
    get('ts-reset').hidden = creating;
    feedback('');
  });

  window.signInWithGmail = async event => {
    event?.preventDefault();
    feedback('');
    if (!get('gmail-login-form').reportValidity()) return;
    if (!ready()) { feedback('Sign-in is still connecting. Please try again in a moment.'); return; }
    const submit = get('ts-submit');
    submit.disabled = true;
    submit.textContent = creating ? 'Creating account…' : 'Signing in…';
    try {
      const method = creating ? window.firebaseCreateUserWithEmailAndPassword : window.firebaseSignInWithEmailAndPassword;
      await method(window.firebaseAuth, get('auth-email').value.trim(), get('auth-password').value);
      localStorage.removeItem('ts_guest');
      get('auth-password').value = '';
    } catch (error) {
      feedback(why(error, 'Unable to sign in. Please try again.'));
    } finally {
      submit.disabled = false;
      submit.innerHTML = creating ? 'Create account <span>↗</span>' : 'Sign in <span>↗</span>';
    }
  };

  get('ts-reset').addEventListener('click', async () => {
    if (!get('auth-email').reportValidity()) return;
    if (!ready()) { feedback('Sign-in is still connecting. Please try again in a moment.'); return; }
    const button = get('ts-reset');
    button.disabled = true;
    try {
      const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      await sendPasswordResetEmail(window.firebaseAuth, get('auth-email').value.trim());
      feedback('If an account exists for that email, a reset link is on its way.');
    } catch (error) {
      feedback(why(error, 'Unable to send a reset link right now.'));
    } finally {
      button.disabled = false;
    }
  });

  /* ── Apple, phone, code ──────────────────────────────────────────── */
  let confirmation = null;         // what signInWithPhoneNumber hands back
  let verifier = null;             // the invisible reCAPTCHA, built once
  let lastNumber = '';

  const phoneSays = t => { get('ts-phone-feedback').textContent = t; };
  const otpSays = t => { get('ts-otp-feedback').textContent = t; };

  async function apple() {
    if (!ready()) { feedback('Sign-in is still connecting. Please try again in a moment.'); return; }
    if (!window.FirebaseOAuthProvider) { feedback('Apple sign-in is not available in this build.'); return; }
    feedback('');
    try {
      const provider = new window.FirebaseOAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      await window.firebaseSignInWithPopup(window.firebaseAuth, provider);
      localStorage.removeItem('ts_guest');
    } catch (error) {
      feedback(why(error, 'Apple sign-in did not complete.'));
    }
  }

  function phone() { phoneSays(''); show('auth-phone-view'); setTimeout(() => get('auth-phone').focus(), 60); }
  function back() { feedback(''); show('auth-main-view'); }

  /* One verifier for the life of the page. Firebase renders an invisible
     reCAPTCHA into #ts-recaptcha and solves it as part of sending; making
     a second one for a resend throws, so it is built once and reused. */
  async function getVerifier() {
    if (verifier) return verifier;
    const { RecaptchaVerifier } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    verifier = new RecaptchaVerifier(window.firebaseAuth, 'ts-recaptcha', { size: 'invisible' });
    await verifier.render();
    return verifier;
  }

  /* A second RecaptchaVerifier on an element that has held one throws
     "reCAPTCHA has already been rendered in this element", and that then
     gets reported as the reason the code could not be sent - hiding
     whatever actually went wrong the first time. clear() does not fix
     it and neither does emptying the div: grecaptcha remembers the
     element, not its contents. Only a different element is clean, so the
     box is replaced with a fresh one of the same id. */
  function dropVerifier() {
    try { verifier?.clear(); } catch (e) {}
    verifier = null;
    const box = get('ts-recaptcha');
    if (!box) return;
    const fresh = document.createElement('div');
    fresh.id = 'ts-recaptcha';
    box.replaceWith(fresh);
  }

  async function sendCode(event) {
    event?.preventDefault();
    phoneSays('');
    const number = get('auth-phone').value.trim();
    if (!number) { phoneSays('Enter your mobile number first.'); return; }
    if (!/^\+[1-9]\d{6,15}$/.test(number.replace(/[\s()-]/g, ''))) {
      phoneSays('Start with your country code, like +91 98765 43210.');
      return;
    }
    if (!ready()) { phoneSays('Sign-in is still connecting. Please try again in a moment.'); return; }
    if (!window.firebaseSignInWithPhoneNumber) { phoneSays('Phone sign-in is not available in this build.'); return; }

    const submit = get('ts-phone-submit');
    submit.disabled = true;
    submit.textContent = 'Sending…';
    try {
      const v = await getVerifier();
      confirmation = await window.firebaseSignInWithPhoneNumber(window.firebaseAuth, number.replace(/[\s()-]/g, ''), v);
      lastNumber = number;
      get('ts-otp-target').textContent = number;
      otpSays('');
      get('auth-otp').value = '';
      show('auth-otp-view');
      setTimeout(() => get('auth-otp').focus(), 60);
    } catch (error) {
      dropVerifier();                       // a spent widget cannot be reused
      phoneSays(why(error, 'Could not send the code. Please try again.'));
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Send code <span>↗</span>';
    }
  }

  async function verifyCode(event) {
    event?.preventDefault();
    otpSays('');
    const code = get('auth-otp').value.replace(/\D/g, '');
    if (code.length !== 6) { otpSays('The code is six digits.'); return; }
    if (!confirmation) { otpSays('That code has expired. Send yourself a new one.'); return; }
    const submit = get('ts-otp-submit');
    submit.disabled = true;
    submit.textContent = 'Checking…';
    try {
      await confirmation.confirm(code);
      localStorage.removeItem('ts_guest');
      confirmation = null;
    } catch (error) {
      otpSays(why(error, 'That code did not work. Please try again.'));
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Verify and sign in <span>↗</span>';
    }
  }

  function resend() {
    if (!lastNumber) { phone(); return; }
    get('auth-phone').value = lastNumber;
    show('auth-phone-view');
    phoneSays('');
    sendCode();
  }

  window.TSAuth = { apple, phone, back, sendCode, verifyCode, resend, show };

  /* ── Modal plumbing ──────────────────────────────────────────────── */
  if (location.hash === '#signin') openAuthModal();

  const modal = get('auth-modal');
  new MutationObserver(() => {
    const visible = !modal.classList.contains('hidden');
    document.querySelector('.app-wrapper')?.toggleAttribute('inert', visible);
    if (visible) { show('auth-main-view'); get('auth-email').focus({ preventScroll: true }); }
  }).observe(modal, { attributes: true, attributeFilter: ['class'] });

  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { continueAsGuest(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button,input,a[href]')].filter(el => !el.disabled && el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
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
import { publish } from './globals.js?v=3';
publish('signin.js', {});
