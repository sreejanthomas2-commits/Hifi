/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

(() => {
 let creating=false;
 const get=id=>document.getElementById(id);
 const feedback=text=>{get('ts-auth-feedback').textContent=text;};
 get('ts-show').addEventListener('click',()=>{const visible=get('auth-password').type==='password';get('auth-password').type=visible?'text':'password';get('ts-show').setAttribute('aria-label',visible?'Hide password':'Show password');get('ts-show').setAttribute('aria-pressed',String(visible));get('ts-show').firstElementChild.textContent=visible?'visibility_off':'visibility';});
 get('ts-mode').addEventListener('click',()=>{creating=!creating;get('signin-title').textContent=creating?'Join your universe.':'Welcome back.';get('ts-submit').innerHTML=creating?'Create account <span>↗</span>':'Sign in <span>↗</span>';get('ts-mode').textContent=creating?'Sign in instead':'Create an account';get('auth-password').autocomplete=creating?'new-password':'current-password';get('ts-reset').hidden=creating;feedback('');});
 window.signInWithGmail=async event=>{
  event?.preventDefault();feedback('');
  if(!get('gmail-login-form').reportValidity())return;
  if(!window.firebaseAuth){feedback('Sign-in is still connecting. Please try again in a moment.');return;}
  const submit=get('ts-submit');submit.disabled=true;submit.textContent=creating?'Creating account…':'Signing in…';
  try{const method=creating?window.firebaseCreateUserWithEmailAndPassword:window.firebaseSignInWithEmailAndPassword;await method(window.firebaseAuth,get('auth-email').value.trim(),get('auth-password').value);localStorage.removeItem('ts_guest');get('auth-password').value='';}
  catch(error){const messages={'auth/invalid-credential':'The email or password is incorrect. Please try again.','auth/wrong-password':'The email or password is incorrect. Please try again.','auth/user-not-found':'The email or password is incorrect. Please try again.','auth/email-already-in-use':'This email already has an account. Sign in instead.','auth/too-many-requests':'Too many attempts. Please wait and try again.','auth/network-request-failed':'Unable to connect. Check your internet and try again.','auth/weak-password':'Choose a stronger password with at least 6 characters.'};feedback(messages[error.code]||'Unable to sign in. Please try again.');}
  finally{submit.disabled=false;submit.innerHTML=creating?'Create account <span>↗</span>':'Sign in <span>↗</span>';}
 };
 get('ts-reset').addEventListener('click',async()=>{
  if(!get('auth-email').reportValidity())return;
  if(!window.firebaseAuth){feedback('Sign-in is still connecting. Please try again in a moment.');return;}
  const button=get('ts-reset');button.disabled=true;
  try{const {sendPasswordResetEmail}=await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');await sendPasswordResetEmail(window.firebaseAuth,get('auth-email').value.trim());feedback('If an account exists for this email, you’ll receive a password reset link.');}catch{feedback('Unable to send a reset link. Please try again later.');}finally{button.disabled=false;}
 });
 if(location.hash==='#signin')openAuthModal();
 const modal=get('auth-modal');
 new MutationObserver(()=>{const visible=!modal.classList.contains('hidden');document.querySelector('.app-wrapper')?.toggleAttribute('inert',visible);if(visible)get('auth-email').focus({preventScroll:true});}).observe(modal,{attributes:true,attributeFilter:['class']});
 modal.addEventListener('keydown',event=>{if(event.key==='Escape'){continueAsGuest();return;}if(event.key!=='Tab')return;const focusable=[...modal.querySelectorAll('button,input,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
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
import { publish } from './globals.js?v=2';
publish('signin.js', {});
