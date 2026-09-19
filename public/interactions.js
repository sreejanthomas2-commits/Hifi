/**
 * ╔══════════════════════════════════════════════════════════════╗
 *   TRENDING — ICON & 3D INTERACTION ENGINE  v2.0
 *   Philosophy: Alive · Premium · Futuristic · Tactile · Smooth
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ─────────────────────────────────────────────────────────────────
   1. PERFORMANCE / ACCESSIBILITY DETECTION
───────────────────────────────────────────────────────────────── */
const IX = {
  /* Motion preference */
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,

  /* Device tier: 'high' | 'mid' | 'low' */
  tier: (() => {
    const mem   = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    if (mem >= 6 && cores >= 6) return 'high';
    if (mem >= 3 && cores >= 3) return 'mid';
    return 'low';
  })(),

  /* Battery saver */
  batterySaver: false,

  /* FPS cap */
  fpsCap: 60,

  /* Global enable flag */
  enabled: true,

  /* Pending RAF */
  _raf: null,

  /* Active tilt elements */
  _tiltEls: new WeakMap(),

  /* Ripple pool */
  _ripplePool: [],

  /* Emoji rain state */
  _rainActive: false,
  _rainPool: [],

  /* Emoji reaction queue */
  _reactionQueue: [],
};

/* Respect prefers-reduced-motion dynamically */
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => {
  IX.reducedMotion = e.matches;
  if (IX.reducedMotion) IX._killAllAnimations();
});

/* Battery API */
if ('getBattery' in navigator) {
  navigator.getBattery().then(bat => {
    IX.batterySaver = bat.level < 0.20 && !bat.charging;
    bat.addEventListener('levelchange', () => {
      IX.batterySaver = bat.level < 0.20 && !bat.charging;
    });
  });
}


/* ─────────────────────────────────────────────────────────────────
   2. CSS UTILITY: inject style sheet once
───────────────────────────────────────────────────────────────── */
IX._injectCSS = function () {
  if (document.getElementById('ix-styles')) return;
  const st = document.createElement('style');
  st.id = 'ix-styles';
  st.textContent = `
/* ── IX Base ── */
.ix-target {
  transform-style: preserve-3d;
  will-change: transform;
  -webkit-font-smoothing: antialiased;
}

/* 3D Tilt card wrapper */
.ix-tilt {
  transform-style: preserve-3d;
  transition: transform 0.08s linear, box-shadow 0.12s ease;
  cursor: pointer;
  position: relative;
}
.ix-tilt .ix-shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.14) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.18s ease;
  z-index: 10;
  mix-blend-mode: screen;
}
.ix-tilt:hover .ix-shine { opacity: 1; }

/* Magnetic icon */
.ix-magnetic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
  position: relative;
}
.ix-magnetic::after {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  pointer-events: none;
}

/* Floating idle */
.ix-float {
  animation: ix-float-idle 3.4s ease-in-out infinite;
}
@keyframes ix-float-idle {
  0%,100% { transform: translateY(0px) rotate(0deg); }
  33%  { transform: translateY(-5px) rotate(1.5deg); }
  66%  { transform: translateY(-2px) rotate(-1deg); }
}

/* Elastic press */
.ix-press-active {
  animation: ix-press 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
@keyframes ix-press {
  0%  { transform: scale(1) translateZ(0); }
  35% { transform: scale(0.88) translateZ(-6px); }
  65% { transform: scale(1.06) translateZ(4px); }
  100%{ transform: scale(1) translateZ(0); }
}

/* Bounce */
.ix-bounce {
  animation: ix-bounce-kf 0.44s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
@keyframes ix-bounce-kf {
  0%  { transform: scale(1); }
  30% { transform: scale(1.28); }
  55% { transform: scale(0.92); }
  75% { transform: scale(1.08); }
  100%{ transform: scale(1); }
}

/* Ripple */
.ix-ripple-host { position: relative; overflow: hidden; }
.ix-ripple-wave {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 70%);
  pointer-events: none;
  transform: scale(0);
  animation: ix-ripple-expand 0.55s ease-out forwards;
  z-index: 99;
}
@keyframes ix-ripple-expand {
  to { transform: scale(4); opacity: 0; }
}

/* Glow pulse */
.ix-glow-pulse {
  animation: ix-glow-kf 0.6s ease-out forwards;
}
@keyframes ix-glow-kf {
  0%  { box-shadow: 0 0 0 0  hsla(213,78%,60%,.0); }
  30% { box-shadow: 0 0 16px 6px hsla(213,78%,60%,.55); }
  100%{ box-shadow: 0 0 0  0  hsla(213,78%,60%,.0); }
}

/* Depth pop */
.ix-depth-pop {
  animation: ix-depth-kf 0.36s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
@keyframes ix-depth-kf {
  0%  { transform: scale(1)    translateZ(0)  rotateX(0deg); filter: brightness(1); }
  50% { transform: scale(1.14) translateZ(18px) rotateX(-3deg); filter: brightness(1.18); }
  100%{ transform: scale(1)    translateZ(0)  rotateX(0deg); filter: brightness(1); }
}

/* Shake */
.ix-shake {
  animation: ix-shake-kf 0.38s ease both;
}
@keyframes ix-shake-kf {
  0%,100%{ transform: translateX(0); }
  20%{ transform: translateX(-5px) rotate(-2deg); }
  40%{ transform: translateX(5px)  rotate(2deg);  }
  60%{ transform: translateX(-3px) rotate(-1deg); }
  80%{ transform: translateX(3px)  rotate(1deg);  }
}

/* Swipe momentum */
.ix-swipe { transition: transform 0.14s ease-out; }

/* Nav item active pop */
.ix-nav-pop {
  animation: ix-nav-pop-kf 0.30s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
@keyframes ix-nav-pop-kf {
  0%  { transform: scale(1); }
  45% { transform: scale(0.94) translateX(-2px); }
  100%{ transform: scale(1); }
}

/* ── 3D Emoji upgrades ── */
.emoji-3d {
  display: inline-block;
  font-style: normal;
  transform-style: preserve-3d;
  position: relative;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: transform 0.20s cubic-bezier(0.34,1.56,0.64,1), filter 0.20s ease;
  /* No resting drop-shadow: a filter on a continuously animated element
     forces a re-rasterise every frame instead of a cheap composite.
     The shadow still appears on hover/active, where it costs nothing. */
}
/* The float only runs while the icon is actually on screen — see the
   IntersectionObserver below. Animating all ~90 icons at once measured
   34fps with 217ms frames; gating it to the visible handful fixes that. */
.emoji-3d.ix-float:not(.emoji-no-anim) {
  animation: emoji-float 3.2s ease-in-out infinite;
  animation-delay: var(--emoji-delay, 0ms);
}
@media (prefers-reduced-motion: reduce) {
  .emoji-3d.ix-float:not(.emoji-no-anim) { animation: none; }
}
@keyframes emoji-float {
  0%,100% { transform: translateY(0) scale(1) rotate(0deg); }
  40%     { transform: translateY(-3px) scale(1.04) rotate(2deg); }
  70%     { transform: translateY(-1px) scale(1.01) rotate(-1deg); }
}
.emoji-3d:hover {
  transform: scale(1.35) translateY(-4px) rotateY(15deg) rotateX(-8deg);
  filter: drop-shadow(0 8px 14px rgba(0,0,0,0.45));
  z-index: 10;
}
.emoji-3d:active {
  transform: scale(0.88) translateY(2px) rotateY(-5deg);
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.35));
}
.emoji-3d.emoji-no-anim {
  animation: none;
  transition: none;
}
.emoji-3d.emoji-low-graphics {
  animation: none;
  filter: none;
  transform: none;
  transition: transform 0.12s ease;
}
.emoji-3d.emoji-low-graphics:hover {
  transform: scale(1.16);
}

/* ── Reaction emoji rain ── */
.ix-rain-emoji {
  position: fixed;
  font-size: 28px;
  pointer-events: none;
  z-index: 99999;
  user-select: none;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));
  animation: ix-rain-fall linear forwards;
}
@keyframes ix-rain-fall {
  0%   { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
  60%  { opacity: 0.9; }
  100% { opacity: 0; transform: translateY(-55vh) scale(0.6) rotate(var(--rain-rot, 20deg)); }
}

/* ── Celebration burst ── */
.ix-burst-particle {
  position: fixed;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 99999;
  animation: ix-burst-fly 0.8s ease-out forwards;
}
@keyframes ix-burst-fly {
  0%   { opacity: 1; transform: translate(0,0) scale(1); }
  100% { opacity: 0; transform: translate(var(--bx,20px), var(--by,-40px)) scale(0.2); }
}

/* ── Icon shadow depth ── */
.ix-icon-depth {
  filter: drop-shadow(0 2px 5px rgba(0,0,0,0.28));
  transition: filter 0.18s ease, transform 0.18s ease;
}
.ix-icon-depth:hover {
  filter: drop-shadow(0 6px 16px rgba(0,0,0,0.45));
  transform: translateY(-2px) scale(1.08);
}

/* ── Haptic visual feedback ── */
.ix-haptic {
  animation: ix-haptic-kf 0.16s ease-out;
}
@keyframes ix-haptic-kf {
  0%  { box-shadow: 0 0 0 0 hsla(213,78%,60%,.0); }
  50% { box-shadow: 0 0 0 8px hsla(213,78%,60%,.22); }
  100%{ box-shadow: 0 0 0 0 hsla(213,78%,60%,.0); }
}

/* ── Livestream reaction overlay ── */
#ix-reaction-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 99998;
  overflow: hidden;
}

/* ── AI suggestion pill ── */
.ix-ai-suggestion {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  background: hsla(213,78%,52%,.12);
  border: 1px solid hsla(213,78%,52%,.24);
  font-size: 11px;
  font-weight: 600;
  color: hsl(213,78%,62%);
  cursor: pointer;
  transition: all 0.20s cubic-bezier(0.34,1.56,0.64,1);
  animation: ix-float-idle 2.8s ease-in-out infinite;
}
.ix-ai-suggestion:hover {
  background: hsl(213,78%,52%);
  color: #fff;
  transform: scale(1.08) translateY(-2px);
  box-shadow: 0 6px 18px hsla(213,78%,52%,.38);
}

/* Performance: reduced-motion overrides */
@media (prefers-reduced-motion: reduce) {
  .ix-float,
  .emoji-3d,
  .ix-ai-suggestion { animation: none !important; }
  .ix-tilt { transition: none !important; }
  .emoji-3d:hover { transform: scale(1.15) !important; }
}
  `;
  document.head.appendChild(st);
};


/* ─────────────────────────────────────────────────────────────────
   3. RIPPLE ENGINE
───────────────────────────────────────────────────────────────── */
IX.spawnRipple = function (el, x, y, color = 'rgba(255,255,255,0.28)') {
  if (IX.reducedMotion || IX.batterySaver) return;

  el.classList.add('ix-ripple-host');
  const rect = el.getBoundingClientRect();
  const cx   = (x ?? (rect.left + rect.width  / 2)) - rect.left;
  const cy   = (y ?? (rect.top  + rect.height / 2)) - rect.top;
  const size = Math.max(rect.width, rect.height) * 2.2;

  const wave = document.createElement('span');
  wave.className = 'ix-ripple-wave';
  wave.style.cssText = `
    width:${size}px; height:${size}px;
    left:${cx - size/2}px; top:${cy - size/2}px;
    background: radial-gradient(circle, ${color} 0%, rgba(255,255,255,0) 70%);
  `;
  el.appendChild(wave);
  wave.addEventListener('animationend', () => wave.remove(), { once: true });
};


/* ─────────────────────────────────────────────────────────────────
   4. 3D TILT ENGINE  (mouse/pointer)
───────────────────────────────────────────────────────────────── */
IX.attachTilt = function (el, opts = {}) {
  if (IX.reducedMotion || IX.tier === 'low') return;

  const cfg = {
    maxTilt:   opts.maxTilt   ?? 14,
    scale:     opts.scale     ?? 1.04,
    glare:     opts.glare     ?? true,
    speed:     opts.speed     ?? 400,
    ...opts
  };

  /* inject shine layer */
  if (cfg.glare && !el.querySelector('.ix-shine')) {
    const shine = document.createElement('span');
    shine.className = 'ix-shine';
    el.classList.add('ix-tilt');
    el.appendChild(shine);
  }

  const shine = el.querySelector('.ix-shine');
  let rect = null;
  let ticking = false;
  let clientX = null;
  let clientY = null;

  const updateTilt = () => {
    if (!rect || clientX === null || clientY === null) {
      ticking = false;
      return;
    }
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    const dx = (clientX - cx) / (rect.width  / 2);  // -1 … 1
    const dy = (clientY - cy) / (rect.height / 2);  // -1 … 1
    const rx = -dy * cfg.maxTilt;
    const ry =  dx * cfg.maxTilt;

    el.style.transform   = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(${cfg.scale},${cfg.scale},${cfg.scale})`;
    el.style.transition  = `transform ${cfg.speed/1000*0.15}s linear`;
    el.style.boxShadow   = `${-ry*0.5}px ${rx*0.5+6}px 28px rgba(0,0,0,0.28)`;

    if (shine) {
      const px = ((clientX - rect.left) / rect.width  * 100).toFixed(1);
      const py = ((clientY - rect.top ) / rect.height * 100).toFixed(1);
      shine.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.18) 0%, transparent 65%)`;
      shine.style.opacity = '1';
    }
    ticking = false;
  };

  const onEnter = () => {
    rect = el.getBoundingClientRect();
  };

  const onMove = (e) => {
    clientX = e.clientX ?? (e.touches?.[0]?.clientX);
    clientY = e.clientY ?? (e.touches?.[0]?.clientY);

    if (!rect) {
      rect = el.getBoundingClientRect();
    }

    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateTilt);
    }
  };

  const onLeave = () => {
    rect = null;
    clientX = null;
    clientY = null;
    el.style.transform  = `perspective(600px) rotateX(0) rotateY(0) scale3d(1,1,1)`;
    el.style.transition = `transform ${cfg.speed/1000}s cubic-bezier(0.23,1,0.32,1), box-shadow 0.4s ease`;
    el.style.boxShadow  = '';
    if (shine) shine.style.opacity = '0';
  };

  el.addEventListener('mouseenter', onEnter);
  el.addEventListener('mousemove',  onMove);
  el.addEventListener('touchmove',  onMove, { passive: true });
  el.addEventListener('mouseleave', onLeave);
  el.addEventListener('touchend',   onLeave);

  IX._tiltEls.set(el, { onEnter, onMove, onLeave });
};

IX.detachTilt = function (el) {
  const handlers = IX._tiltEls.get(el);
  if (!handlers) return;
  el.removeEventListener('mouseenter', handlers.onEnter);
  el.removeEventListener('mousemove',  handlers.onMove);
  el.removeEventListener('touchmove',  handlers.onMove);
  el.removeEventListener('mouseleave', handlers.onLeave);
  el.removeEventListener('touchend',   handlers.onLeave);
  IX._tiltEls.delete(el);
};


/* ─────────────────────────────────────────────────────────────────
   5. MAGNETIC HOVER  (follows cursor within proximity zone)
───────────────────────────────────────────────────────────────── */
// Global active set to track ONLY elements being hovered with zero layout thrashing
IX._activeMagnetics = IX._activeMagnetics || new Set();
IX._magneticTicking = false;
IX._mouseX = -9999;
IX._mouseY = -9999;

if (!IX._magneticBound) {
  IX._magneticBound = true;
  document.addEventListener('mousemove', (e) => {
    IX._mouseX = e.clientX;
    IX._mouseY = e.clientY;
    if (!IX._magneticTicking && IX._activeMagnetics.size > 0) {
      IX._magneticTicking = true;
      requestAnimationFrame(IX._updateMagnetics);
    }
  });

  IX._updateMagnetics = function () {
    IX._activeMagnetics.forEach(item => {
      const el = item.el;
      if (!item.rect) return;
      const cx = item.rect.left + item.rect.width  / 2;
      const cy = item.rect.top  + item.rect.height / 2;
      const dx = IX._mouseX - cx;
      const dy = IX._mouseY - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const zone = Math.max(item.rect.width, item.rect.height) * 1.8;

      if (dist < zone) {
        const factor = (1 - dist / zone) * item.strength;
        el.style.transform = `translate(${dx * factor}px, ${dy * factor}px)`;
      } else {
        el.style.transform = '';
      }
    });
    IX._magneticTicking = false;
  };
}

IX.attachMagnetic = function (el, strength = 0.42) {
  if (IX.reducedMotion || IX.tier === 'low') return;
  el.classList.add('ix-magnetic');

  const item = { el, strength, rect: null };

  const onEnter = () => {
    item.rect = el.getBoundingClientRect();
    IX._activeMagnetics.add(item);
  };

  const onLeave = () => {
    IX._activeMagnetics.delete(item);
    el.style.transform = '';
    item.rect = null;
  };

  el.addEventListener('mouseenter', onEnter);
  el.addEventListener('mouseleave', onLeave);

  el._ixMagCleanup = () => {
    IX._activeMagnetics.delete(item);
    el.removeEventListener('mouseenter', onEnter);
    el.removeEventListener('mouseleave', onLeave);
    el.style.transform = '';
  };
};


/* ─────────────────────────────────────────────────────────────────
   6. PRESS / DEPTH FEEDBACK  (pointer down/up)
───────────────────────────────────────────────────────────────── */
IX.attachPress = function (el) {
  const fire = (e) => {
    if (IX.reducedMotion) return;
    IX.spawnRipple(el, e.clientX, e.clientY);
    IX._triggerClass(el, 'ix-press-active', 280);
    IX._triggerClass(el, 'ix-haptic', 200);
    IX._triggerClass(el, 'ix-glow-pulse', 600);
  };
  el.addEventListener('pointerdown', fire);
  el._ixPressCleanup = () => el.removeEventListener('pointerdown', fire);
};


/* ─────────────────────────────────────────────────────────────────
   7. DEPTH POP  (single click / tap)
───────────────────────────────────────────────────────────────── */
IX.attachDepthPop = function (el) {
  const fire = () => { IX._triggerClass(el, 'ix-depth-pop', 360); };
  el.addEventListener('click', fire);
};


/* ─────────────────────────────────────────────────────────────────
   8. EMOJI INTERACTION ENGINE
───────────────────────────────────────────────────────────────── */
IX._bindEmoji = function (span) {
  /* stagger delays for natural look */
  const delay = Math.floor(Math.random() * 1800);
  span.style.setProperty('--emoji-delay', `${delay}ms`);

  span.addEventListener('click', () => {
    IX._triggerClass(span, 'ix-bounce', 440);
    IX.spawnRipple(span, null, null, 'rgba(255,220,80,0.35)');
    IX._burstParticles(span, 6, ['#FFD700','#FF6B6B','#4AE','#B86EFF','#FFA500']);
  });

  span.addEventListener('dblclick', (e) => {
    e.preventDefault();
    IX._triggerClass(span, 'ix-shake', 380);
    IX._triggerClass(span, 'ix-glow-pulse', 600);
  });

  /* 3D tilt on emoji (lightweight) */
  span.addEventListener('mousemove', (e) => {
    if (IX.reducedMotion) return;
    const rect = span.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width/2))  / (rect.width/2);
    const dy = (e.clientY - (rect.top  + rect.height/2)) / (rect.height/2);
    span.style.transform = `scale(1.28) translateY(-4px) rotateY(${dx*18}deg) rotateX(${-dy*12}deg)`;
  });
  span.addEventListener('mouseleave', () => {
    span.style.transform = '';
  });
};

/* apply to all .emoji-3d nodes in the document */
IX.bindAllEmojis = function (root = document) {
  root.querySelectorAll('.emoji-3d').forEach(span => IX._bindEmoji(span));
};

/* observe DOM mutations to auto-bind freshly injected emojis */
IX._observeEmojis = function () {
  const obs = new MutationObserver(muts => {
    muts.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.classList?.contains('emoji-3d')) IX._bindEmoji(node);
        node.querySelectorAll?.('.emoji-3d').forEach(s => IX._bindEmoji(s));
      });
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
};


/* ─────────────────────────────────────────────────────────────────
   9. BURST PARTICLE EFFECT
───────────────────────────────────────────────────────────────── */
IX._burstParticles = function (el, count = 8, colors = ['#4e8cff','#f76e9f','#9a62ff','#FFD700']) {
  if (IX.reducedMotion || IX.batterySaver) return;
  const rect = el.getBoundingClientRect();
  const ox = rect.left + rect.width  / 2;
  const oy = rect.top  + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const angle  = (i / count) * Math.PI * 2;
    const radius = 36 + Math.random() * 28;
    const bx     = Math.cos(angle) * radius;
    const by     = Math.sin(angle) * radius;
    const color  = colors[i % colors.length];

    const p = document.createElement('span');
    p.className = 'ix-burst-particle';
    p.style.cssText = `
      left:${ox}px; top:${oy}px;
      background:${color};
      --bx:${bx}px; --by:${by}px;
      width:${5 + Math.random()*5}px;
      height:${5 + Math.random()*5}px;
      border-radius:${Math.random() > 0.5 ? '50%' : '3px'};
    `;
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove(), { once: true });
  }
};


/* ─────────────────────────────────────────────────────────────────
   10. EMOJI RAIN (Livestream / Celebration)
───────────────────────────────────────────────────────────────── */
IX._ensureOverlay = function () {
  let ov = document.getElementById('ix-reaction-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ix-reaction-overlay';
    document.body.appendChild(ov);
  }
  return ov;
};

IX.startEmojiRain = function (emojis = ['🔥','❤️','😂','🚀','💫','✨','🎉','💎'], rate = 6) {
  if (IX._rainActive || IX.reducedMotion || IX.batterySaver) return;
  IX._rainActive = true;
  const ov = IX._ensureOverlay();

  IX._rainInterval = setInterval(() => {
    if (!IX._rainActive) return;
    const em = emojis[Math.floor(Math.random() * emojis.length)];
    const el = document.createElement('span');
    const dur = 1.8 + Math.random() * 1.2;
    const rot = -30 + Math.random() * 60;
    el.className = 'ix-rain-emoji';
    el.textContent = em;
    el.style.cssText = `
      left:${5 + Math.random() * 90}%;
      bottom: 60px;
      font-size:${22 + Math.random()*16}px;
      animation-duration:${dur}s;
      --rain-rot:${rot}deg;
    `;
    ov.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, Math.max(80, 1000 / rate));
};

IX.stopEmojiRain = function () {
  IX._rainActive = false;
  clearInterval(IX._rainInterval);
};

/* burst celebratory reaction at a position */
IX.burstReaction = function (emoji, x, y, count = 12) {
  if (IX.reducedMotion) return;
  const ov = IX._ensureOverlay();
  for (let i = 0; i < count; i++) {
    const angle  = (i / count) * Math.PI * 2;
    const radius = 40 + Math.random() * 50;
    const el = document.createElement('span');
    el.className = 'ix-rain-emoji';
    const dur = 0.7 + Math.random() * 0.5;
    el.textContent = emoji;
    el.style.cssText = `
      left:${x}px; top:${y}px;
      bottom: auto;
      font-size:${18 + Math.random()*14}px;
      animation-duration:${dur}s;
      --rain-rot:${-40 + Math.random()*80}deg;
      transform: translate(-50%, -50%);
    `;
    ov.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }
};


/* ─────────────────────────────────────────────────────────────────
   11. FEED REACTION BUTTONS  (like, share, tip)
───────────────────────────────────────────────────────────────── */
IX.bindFeedReactions = function (root = document) {
  root.querySelectorAll('.act-btn').forEach(btn => {
    if (btn._ixBound) return;
    btn._ixBound = true;
    IX.attachPress(btn);
    IX.attachMagnetic(btn, 0.30);

    btn.addEventListener('click', (e) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top  + rect.height/2;
      IX.burstReaction('✨', cx, cy, 6);
      IX._triggerClass(btn, 'ix-bounce', 400);
    });
  });
};


/* ─────────────────────────────────────────────────────────────────
   12. NAVIGATION  (sidebar + bottom nav)
───────────────────────────────────────────────────────────────── */
IX.bindNavItems = function () {
  /* Sidebar nav */
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item._ixBound) return;
    item._ixBound = true;
    IX.attachPress(item);
    IX.attachMagnetic(item, 0.22);
    item.querySelectorAll('svg').forEach(s => s.classList.add('ix-icon-depth'));
    item.addEventListener('click', () => IX._triggerClass(item, 'ix-nav-pop', 300));
  });

  /* Bottom mobile nav */
  document.querySelectorAll('.mob-nav-btn, .mob-nav-center').forEach(btn => {
    if (btn._ixBound) return;
    btn._ixBound = true;
    IX.attachPress(btn);
    btn.addEventListener('click', () => IX._triggerClass(btn, 'ix-bounce', 380));
  });
};


/* ─────────────────────────────────────────────────────────────────
   13. CARDS  (post cards, short cards, community cards)
───────────────────────────────────────────────────────────────── */
IX.bindCards = function (root = document) {
  const cards = root.querySelectorAll('.post-card, .short-card, .card, .community-hub-card, .auth-card');
  cards.forEach(card => {
    if (card._ixTiltBound) return;
    card._ixTiltBound = true;
    /* Only tilt on high/mid tier non-reduced-motion */
    if (!IX.reducedMotion && IX.tier !== 'low') {
      IX.attachTilt(card, { maxTilt: 6, scale: 1.02, speed: 500 });
    }
    IX.attachPress(card);
  });
};


/* ─────────────────────────────────────────────────────────────────
   14. ICON BUTTONS (header, create, notif, theme)
───────────────────────────────────────────────────────────────── */
IX.bindIconButtons = function () {
  document.querySelectorAll('.icon-btn, #create-btn, #notif-btn, #theme-btn').forEach(btn => {
    if (btn._ixBound) return;
    btn._ixBound = true;
    IX.attachMagnetic(btn, 0.35);
    IX.attachPress(btn);
    IX.attachDepthPop(btn);
    btn.querySelectorAll('svg').forEach(s => s.classList.add('ix-icon-depth'));
  });
};


/* ─────────────────────────────────────────────────────────────────
   15. STORY CIRCLES
───────────────────────────────────────────────────────────────── */
IX.bindStoryCircles = function () {
  document.querySelectorAll('.story-circle-item').forEach(item => {
    if (item._ixBound) return;
    item._ixBound = true;
    IX.attachPress(item);
    item.classList.add('ix-float');
    /* stagger the float animation */
    const delay = Math.floor(Math.random() * 2000);
    item.style.animationDelay = `${delay}ms`;

    item.addEventListener('click', (e) => {
      const rect = item.getBoundingClientRect();
      IX.burstReaction('✨', rect.left + rect.width/2, rect.top, 8);
    });
  });
};


/* ─────────────────────────────────────────────────────────────────
   16. BADGE / ACHIEVEMENT ELEMENTS
───────────────────────────────────────────────────────────────── */
IX.bindBadges = function (root = document) {
  root.querySelectorAll('.badge, .edu-pill, .m-chip').forEach(b => {
    if (b._ixBound) return;
    b._ixBound = true;
    b.addEventListener('click', () => {
      IX._triggerClass(b, 'ix-bounce', 400);
      IX.spawnRipple(b, null, null, 'rgba(78,140,255,0.3)');
    });
  });
};


/* ─────────────────────────────────────────────────────────────────
   17. AMBIENT SOUND / WELLNESS CONTROLS
───────────────────────────────────────────────────────────────── */
IX.bindAmbientControls = function () {
  document.querySelectorAll('.ambient-btn').forEach(btn => {
    if (btn._ixBound) return;
    btn._ixBound = true;
    IX.attachPress(btn);
    btn.addEventListener('click', () => IX._triggerClass(btn, 'ix-glow-pulse', 600));
  });
};


/* ─────────────────────────────────────────────────────────────────
   18. PROFILE ACTIONS
───────────────────────────────────────────────────────────────── */
IX.bindProfileActions = function () {
  document.querySelectorAll('.btn-primary, .btn-secondary').forEach(btn => {
    if (btn._ixBound) return;
    btn._ixBound = true;
    IX.attachPress(btn);
  });

  /* Profile avatar pop */
  const av = document.getElementById('profile-av');
  if (av && !av._ixBound) {
    av._ixBound = true;
    IX.attachTilt(av, { maxTilt: 10, scale: 1.06 });
    IX.attachPress(av);
  }
};


/* ─────────────────────────────────────────────────────────────────
   19. AI SUGGESTION PILLS
───────────────────────────────────────────────────────────────── */
IX.injectAISuggestions = function (containerSel, suggestions) {
  const container = document.querySelector(containerSel);
  if (!container) return;
  if (container.querySelector('.ix-ai-suggestion')) return; // already injected

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; padding: 0 4px;';

  suggestions.forEach(({ emoji, label, pane }) => {
    const pill = document.createElement('button');
    pill.className = 'ix-ai-suggestion';
    let iconHtml = `<span>${emoji}</span>`;
    if (typeof window.get3DIconForEmoji === 'function') {
      const iconData = window.get3DIconForEmoji(emoji);
      iconHtml = `<span class="material-symbols-rounded emoji-3d" style="font-size:16px; color:${iconData.color}; vertical-align:middle; margin-right:4px">${iconData.icon}</span>`;
    }
    pill.innerHTML = `${iconHtml}<span>${label}</span>`;
    pill.addEventListener('click', () => {
      IX._triggerClass(pill, 'ix-bounce', 400);
      IX.burstReaction(emoji, pill.getBoundingClientRect().left, pill.getBoundingClientRect().top, 8);
      if (pane && window.navigateTo) navigateTo(pane);
    });
    wrapper.appendChild(pill);
  });

  container.appendChild(wrapper);
};


/* ─────────────────────────────────────────────────────────────────
   20. HELPER: ONE-SHOT CLASS TRIGGER
───────────────────────────────────────────────────────────────── */
IX._triggerClass = function (el, cls, duration = 400) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // reflow
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), duration);
};

IX._killAllAnimations = function () {
  document.querySelectorAll(
    '.ix-float, .emoji-3d, .ix-tilt, .ix-magnetic, .ix-rain-emoji, .ix-burst-particle'
  ).forEach(el => {
    el.style.animation = 'none';
    el.style.transform = '';
    el.style.transition = 'none';
  });
};


/* ─────────────────────────────────────────────────────────────────
   21. PERFORMANCE-AWARE RE-BIND (called after DOM mutations)
───────────────────────────────────────────────────────────────── */
IX.rebind = function (root = document) {
  IX.bindCards(root);
  IX.bindFeedReactions(root);
  IX.bindBadges(root);
  IX.bindEmojis(root);
};

IX.bindEmojis = function (root = document) {
  IX.bindAllEmojis(root);
};


/* ─────────────────────────────────────────────────────────────────
   22. SWIPE MOMENTUM TRACKING
───────────────────────────────────────────────────────────────── */
IX.attachSwipeTracking = function (el) {
  let startX = 0, startY = 0, startT = 0;

  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startT = Date.now();
  }, { passive: true });

  el.addEventListener('touchend', e => {
    const dt   = Date.now() - startT;
    const dx   = e.changedTouches[0].clientX - startX;
    const dy   = e.changedTouches[0].clientY - startY;
    const speed = Math.sqrt(dx*dx + dy*dy) / dt;

    if (speed > 0.5 && Math.abs(dx) > 30) {
      el.style.transition = 'transform 0.12s ease-out';
      el.style.transform  = `translateX(${dx * 0.15}px)`;
      setTimeout(() => {
        el.style.transition = 'transform 0.4s cubic-bezier(0.23,1,0.32,1)';
        el.style.transform  = '';
      }, 120);
    }
  }, { passive: true });
};


/* ─────────────────────────────────────────────────────────────────
   23. LIVE STREAM REACTION TRIGGERS
───────────────────────────────────────────────────────────────── */
IX.livestreamReact = function (emoji, fromX, fromY) {
  IX.burstReaction(emoji, fromX || window.innerWidth/2, fromY || window.innerHeight*0.7, 10);
  IX._triggerClass(document.getElementById('ix-reaction-overlay'), 'ix-glow-pulse', 600);
};


/* ─────────────────────────────────────────────────────────────────
   24. MAIN INIT
───────────────────────────────────────────────────────────────── */
IX.init = function () {
  IX._injectCSS();
  IX._ensureOverlay();

  if (IX.reducedMotion || !IX.enabled) return;

  /* Bind all interactive elements */
  IX.bindNavItems();
  IX.bindIconButtons();
  IX.bindCards();
  IX.bindFeedReactions();
  IX.bindBadges();
  IX.bindStoryCircles();
  IX.bindAmbientControls();
  IX.bindProfileActions();
  IX.bindAllEmojis();
  IX._observeEmojis();
  IX.attachSwipeTracking(document.querySelector('.content-pane.active') || document.body);

  /* AI-powered suggestion pills in the feed header */
  IX.injectAISuggestions('#mood-bar', [
    { emoji: '🔥', label: 'Trending Now',    pane: 'feeds'    },
    { emoji: '🎬', label: 'Reels',           pane: 'reels'    },
    { emoji: '🧠', label: 'Research',        pane: 'reality'  },
    { emoji: '🌍', label: 'World Events',    pane: 'feeds'    },
    { emoji: '💬', label: 'Community',       pane: 'community'},
  ]);

  startFloatObserver();

  console.log(`%c✦ IX Engine v2.0 — Tier: ${IX.tier} | Motion: ${IX.reducedMotion ? 'reduced' : 'full'}`, 'color:#4e8cff;font-weight:bold;');
};

/* ── Viewport-gated idle float ──────────────────────────────────────
   .emoji-3d is on ~90 elements across the app. Running the float on all
   of them continuously pinned the main thread at ~34fps with frames up
   to 217ms, because each animated element needs its own composited
   layer and the icons off screen were costing exactly as much as the
   ones you can see.

   This observer adds .ix-float only while an icon is in view (plus a
   200px margin so it is already moving when it scrolls in) and strips
   it again on the way out. Panes are built lazily and re-render often,
   so a MutationObserver picks up icons added after load.            */
function startFloatObserver() {
  if (!('IntersectionObserver' in window)) {
    // No observer support: animate everything, as before.
    document.querySelectorAll('.emoji-3d').forEach(el => el.classList.add('ix-float'));
    return;
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => e.target.classList.toggle('ix-float', e.isIntersecting));
  }, { rootMargin: '200px' });

  const seen = new WeakSet();
  const observeAll = root => {
    (root.querySelectorAll ? root.querySelectorAll('.emoji-3d') : []).forEach(el => {
      if (seen.has(el)) return;
      seen.add(el);
      io.observe(el);
    });
  };

  observeAll(document);

  new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.classList && n.classList.contains('emoji-3d') && !seen.has(n)) { seen.add(n); io.observe(n); }
      observeAll(n);
    }));
  }).observe(document.body, { childList: true, subtree: true });
}


/* ─────────────────────────────────────────────────────────────────
   25. PUBLIC API (exposed globally)
───────────────────────────────────────────────────────────────── */
window.IX = IX;

/* Auto-boot after DOM ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', IX.init);
} else {
  IX.init();
}

// Virtual Keyboard Interaction
function toggleVirtualKeyboard() {
  const panel = document.getElementById('virtual-keyboard-panel');
  if (panel) {
    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
      panel.style.display = 'flex';
    } else {
      panel.classList.add('hidden');
      panel.style.display = 'none';
    }
  }
}

function vkType(char) {
  const input = document.getElementById('chat-input');
  if (!input) return;
  
  if (char === 'BACKSPACE') {
    input.value = input.value.slice(0, -1);
  } else if (char === 'ENTER') {
    sendMessage();
  } else if (char === 'SPACE') {
    input.value += ' ';
  } else {
    input.value += char;
  }
  input.focus();
}

function toggleAIVirtualKeyboard() {
  const panel = document.getElementById('ai-virtual-keyboard-panel');
  if (panel) {
    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
      panel.style.display = 'flex';
    } else {
      panel.classList.add('hidden');
      panel.style.display = 'none';
    }
  }
}

function vkTypeAI(char) {
  const input = document.getElementById('ai-input');
  if (!input) return;
  if (char === 'BACKSPACE') {
    input.value = input.value.slice(0, -1);
  } else if (char === 'ENTER') {
    sendAI();
  } else if (char === 'SPACE') {
    input.value += ' ';
  } else {
    input.value += char;
  }
  input.focus();
}
