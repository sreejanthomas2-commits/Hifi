/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SHORTY STUDIO — the create flow, Instagram-shaped                ║
   ║                                                                   ║
   ║  The old "create" was one dialog: pick a file, type a caption,    ║
   ║  publish. This replaces it with the three screens a reel really   ║
   ║  goes through.                                                    ║
   ║                                                                   ║
   ║   1 · CAPTURE — a real viewfinder (getUserMedia + MediaRecorder), ║
   ║       segmented recording, hold or hands-free, 15s/30s/60s/3m,    ║
   ║       speed, self-timer, front/back flip, or import from gallery. ║
   ║   2 · EDIT — sequence several clips, trim each one on a frame     ║
   ║       strip, split, reorder, per-clip speed and mute, filters,    ║
   ║       colour adjustments, text layers with fonts and timing,      ║
   ║       stickers you drag around, music, voiceover, cover frame.    ║
   ║   3 · SHARE — cover, caption, tagged people, location, audience   ║
   ║       and the per-reel switches, then publish.                    ║
   ║                                                                   ║
   ║  Nothing here is a mock-up: the camera really records, the trim   ║
   ║  really trims, and the edit is stored with the reel so the player ║
   ║  reproduces it exactly. The same playback engine drives the       ║
   ║  studio preview and the Shorty player, so what you edit is what   ║
   ║  everyone watches.                                                ║
   ║                                                                   ║
   ║  Video stays on the device — blobs in IndexedDB, edit metadata in ║
   ║  localStorage. Nothing is uploaded anywhere.                      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const STU = (() => {

  /* ── Constants ───────────────────────────────────────────────────── */

  const MAX_BYTES = 100 * 1024 * 1024;
  const MAX_SECONDS = 180;
  const LENGTHS = [[15, '15s'], [30, '30s'], [60, '60s'], [180, '3m']];
  const SPEEDS = [0.3, 0.5, 1, 2, 3];

  const FILTERS = [
    { k: 'none',      n: 'Normal',    f: '' },
    { k: 'clarendon', n: 'Clarendon', f: 'contrast(1.15) saturate(1.35) brightness(1.06)' },
    { k: 'juno',      n: 'Juno',      f: 'saturate(1.4) contrast(1.05) sepia(.12) hue-rotate(-8deg)' },
    { k: 'gingham',   n: 'Gingham',   f: 'brightness(1.06) contrast(.9) sepia(.08)' },
    { k: 'lark',      n: 'Lark',      f: 'brightness(1.09) contrast(.9) saturate(1.15)' },
    { k: 'nashville', n: 'Nashville', f: 'sepia(.25) contrast(1.2) brightness(1.05) saturate(1.2) hue-rotate(-10deg)' },
    { k: 'aden',      n: 'Aden',      f: 'sepia(.2) brightness(1.1) saturate(.9) hue-rotate(-12deg)' },
    { k: 'valencia',  n: 'Valencia',  f: 'sepia(.15) saturate(1.5) contrast(.9) brightness(1.08)' },
    { k: 'xpro',      n: 'X-Pro II',  f: 'sepia(.3) contrast(1.3) saturate(1.3) hue-rotate(-8deg)' },
    { k: 'vivid',     n: 'Vivid',     f: 'saturate(1.7) contrast(1.15)' },
    { k: 'moon',      n: 'Moon',      f: 'grayscale(1) contrast(1.1) brightness(1.1)' },
    { k: 'noir',      n: 'Noir',      f: 'grayscale(1) contrast(1.4) brightness(.95)' },
    { k: 'willow',    n: 'Willow',    f: 'grayscale(.6) contrast(.95) brightness(1.1) sepia(.2)' },
    { k: 'neon',      n: 'Neon',      f: 'hue-rotate(215deg) saturate(1.6) contrast(1.12)' }
  ];

  const FONTS = [
    { k: 'classic', n: 'Classic', css: "'Inter', system-ui, -apple-system, sans-serif", w: 800 },
    { k: 'strong',  n: 'Strong',  css: "'Arial Black', Impact, sans-serif",             w: 900 },
    { k: 'type',    n: 'Type',    css: "'Courier New', ui-monospace, monospace",        w: 700 },
    { k: 'serif',   n: 'Serif',   css: "Georgia, 'Times New Roman', serif",             w: 700 },
    { k: 'light',   n: 'Light',   css: "'Inter', system-ui, sans-serif",                w: 300 }
  ];

  const COLORS = ['#FFFFFF', '#000000', '#FF3B5C', '#FF9F0A', '#FFD60A', '#32D74B', '#0A84FF', '#FCD535', '#FF2D95', '#9AA0AA'];

  const STICKERS = [
    '🔥', '💜', '😂', '😍', '🤯', '👀', '✨', '💯', '🙌', '👏',
    '🚀', '📈', '📉', '🪙', '💎', '🧠', '⚡', '🌙', '☀️', '🌊',
    '🎧', '🎬', '📷', '🕶️', '👟', '🍜', '☕', '🏆', '❤️‍🔥', '🫶',
    '😎', '🥹', '🤝', '🎉', '💃', '🕺', '🐂', '🐻', '⏰', '📍'
  ];

  /* Real, freely usable demo tracks — soundhelix.com publishes them for
     exactly this. They are algorithmically composed, so the titles below
     are the real ones rather than invented artist names. */
  const SH_BASE = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-';
  const MUSIC = [
    { id: 'sh1',  title: 'Song 1',  mood: 'Upbeat',      src: SH_BASE + '1.mp3' },
    { id: 'sh2',  title: 'Song 2',  mood: 'Driving',     src: SH_BASE + '2.mp3' },
    { id: 'sh3',  title: 'Song 3',  mood: 'Bright',      src: SH_BASE + '3.mp3' },
    { id: 'sh5',  title: 'Song 5',  mood: 'Chilled',     src: SH_BASE + '5.mp3' },
    { id: 'sh8',  title: 'Song 8',  mood: 'Cinematic',   src: SH_BASE + '8.mp3' },
    { id: 'sh9',  title: 'Song 9',  mood: 'Warm',        src: SH_BASE + '9.mp3' },
    { id: 'sh11', title: 'Song 11', mood: 'Late night',  src: SH_BASE + '11.mp3' },
    { id: 'sh12', title: 'Song 12', mood: 'Playful',     src: SH_BASE + '12.mp3' },
    { id: 'sh15', title: 'Song 15', mood: 'Focus',       src: SH_BASE + '15.mp3' },
    { id: 'sh17', title: 'Song 17', mood: 'Big finish',  src: SH_BASE + '17.mp3' }
  ];

  const TOOLS = [
    ['clips',    'Clips',    'video_library'],
    ['sound',    'Sound',    'music_note'],
    ['text',     'Text',     'title'],
    ['stickers', 'Stickers', 'emoji_emotions'],
    ['captions', 'Captions', 'closed_caption'],
    ['filters',  'Filters',  'auto_awesome'],
    ['adjust',   'Adjust',   'tune'],
    ['cover',    'Cover',    'image']
  ];

  /* ── Small helpers ───────────────────────────────────────────────── */

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const uid = p => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const $ = id => document.getElementById(id);
  const A = v => esc(JSON.stringify(v === undefined ? null : v));

  function fmt(t) {
    t = Math.max(0, t || 0);
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  }
  const fmtMs = t => (t || 0).toFixed(1) + 's';

  /* A blob from MediaRecorder carries no duration in its header, so the
     browser reports Infinity. Seeking far past the end makes it work it
     out — the standard way round it. */
  function probe(url) {
    return new Promise(res => {
      const v = document.createElement('video');
      let done = false;
      const finish = d => {
        if (done) return;
        done = true;
        try { v.removeAttribute('src'); v.load(); } catch (e) {}
        res(isFinite(d) && d > 0 ? d : 0);
      };
      v.preload = 'metadata';
      v.muted = true;
      v.onloadedmetadata = () => {
        if (isFinite(v.duration) && v.duration > 0) return finish(v.duration);
        v.ontimeupdate = () => { v.ontimeupdate = null; finish(v.duration); };
        try { v.currentTime = 1e6; } catch (e) { finish(0); }
      };
      v.onerror = () => finish(0);
      v.src = url;
      setTimeout(() => finish(v.duration), 5000);
    });
  }

  /* Draw one frame of a video to a data URL. Used for the trim strip and
     for the cover. Only ever pointed at local blobs, so the canvas is
     never tainted. */
  function grab(video, w, h, filter) {
    try {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      if (filter && x.filter !== undefined) x.filter = filter;
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return '';
      // cover-fit, same as the player
      const scale = Math.max(w / vw, h / vh);
      const dw = vw * scale, dh = vh * scale;
      x.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
      return c.toDataURL('image/jpeg', 0.72);
    } catch (e) { return ''; }
  }

  function dataURLToBlob(d) {
    try {
      const [head, b64] = String(d).split(',');
      const mime = (head.match(/:(.*?);/) || [, 'image/jpeg'])[1];
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch (e) { return null; }
  }

  /* ── Filter maths, shared with the player ────────────────────────── */

  function filterCSS(reel) {
    if (!reel) return 'none';
    const preset = FILTERS.find(f => f.k === (reel.filter || 'none'));
    const a = reel.adj || {};
    const parts = [];
    if (preset && preset.f) parts.push(preset.f);
    if (a.bright != null && a.bright !== 100) parts.push(`brightness(${a.bright / 100})`);
    if (a.contrast != null && a.contrast !== 100) parts.push(`contrast(${a.contrast / 100})`);
    if (a.sat != null && a.sat !== 100) parts.push(`saturate(${a.sat / 100})`);
    if (a.warm) parts.push(`sepia(${clamp(a.warm, 0, 100) / 100})`);
    if (a.blur) parts.push(`blur(${(a.blur / 100) * 6}px)`);
    return parts.length ? parts.join(' ') : 'none';
  }

  const fontOf = k => FONTS.find(f => f.k === k) || FONTS[0];

  /* ── Overlay layer (text + stickers), shared with the player ─────── */

  function overlayHTML(reel) {
    if (!reel) return '';
    const vig = (reel.adj && reel.adj.vig) || 0;
    const texts = (reel.texts || []).map(t => {
      const f = fontOf(t.font);
      const bg = t.bg === 'solid' ? `background:${t.color};color:${t.color === '#FFFFFF' ? '#111' : '#fff'};padding:.18em .5em;border-radius:10px;`
        : t.bg === 'shade' ? 'background:rgba(0,0,0,.42);padding:.18em .5em;border-radius:10px;color:' + t.color + ';'
        : `color:${t.color};text-shadow:0 2px 10px rgba(0,0,0,.55);`;
      // Two font-size declarations on purpose: px is the fallback, and the
      // cqw one wins wherever container queries work, so a line sized in
      // the 405px-wide studio keeps its proportions on a full-height player.
      return `<div class="stu-node stu-text" data-id="${esc(t.id)}" data-t0="${t.start || 0}" data-t1="${t.end || 0}"
        style="left:${t.x}%;top:${t.y}%;font-family:${f.css};font-weight:${f.w};font-size:${t.size}px;font-size:${(t.size / 4.05).toFixed(2)}cqw;${bg}">${esc(t.text)}</div>`;
    }).join('');
    // Polls, quizzes, mentions and the rest are drawn by STK; a plain
    // emoji is drawn the way it always was if STK is not loaded.
    const sticks = (reel.stickers || []).map(s => window.STK ? STK.node(s) :
      `<div class="stu-node stu-sticker" data-id="${esc(s.id)}" data-t0="${s.start || 0}" data-t1="${s.end || 0}"
        style="left:${s.x}%;top:${s.y}%;font-size:${s.size}px;font-size:${(s.size / 4.05).toFixed(2)}cqw;transform:translate(-50%,-50%) rotate(${s.rot || 0}deg)">${esc(s.emoji || '')}</div>`
    ).join('');
    const vignette = vig ? `<div class="stu-vig" style="opacity:${vig / 100}"></div>` : '';
    return vignette + texts + sticks + captionsHTML(reel.captions);
  }

  /* Timed captions: a node per line, shown in its own window like any
     other overlay, at the chosen height. Not draggable - where they sit
     is part of the style, so every line moves together. */
  /* Middle by default: it stays in view above the editing panel, and in
     the player it clears the creator's name and caption at the bottom. */
  const CAP_STYLE = { pos: 'middle', bg: 'shade', font: 'classic', size: 22, color: '#FFFFFF' };
  function captionsHTML(c) {
    if (!c || !Array.isArray(c.segs) || !c.segs.length) return '';
    const st = Object.assign({}, CAP_STYLE, c.style || {});
    const f = fontOf(st.font);
    const look = st.bg === 'solid' ? `background:${st.color};color:${st.color === '#FFFFFF' ? '#111' : '#fff'};`
      : st.bg === 'shade' ? `background:rgba(0,0,0,.55);color:${st.color};`
      : `color:${st.color};text-shadow:0 2px 8px rgba(0,0,0,.75);`;
    const top = { top: 16, middle: 48, bottom: 68 }[st.pos] || 48;
    return c.segs.map(g => `<div class="stu-node stu-cap" data-id="${esc(g.id)}" data-t0="${Number(g.t0) || 0}" data-t1="${Number(g.t1) || 0.01}"
      style="left:50%;top:${top}%;font-family:${f.css};font-weight:${f.w};font-size:${st.size}px;font-size:${(st.size / 4.05).toFixed(2)}cqw;${look}">${esc(g.text)}</div>`).join('');
  }

  /* ── Playback engine ─────────────────────────────────────────────── */
  /* One implementation drives both the studio preview and every panel in
     the Shorty player, so a reel plays the same in both. It sequences the
     clips, honours each clip's trim / speed / mute, keeps the music in
     step and shows each overlay inside its own time window. */

  function engine(cfg) {
    const v = cfg.video;
    const ov = cfg.overlay || null;
    const mus = cfg.music || null;
    let reel = cfg.reel || { clips: [] };
    let idx = -1, raf = 0, dead = false, paused = true, muted = !!cfg.muted, seeking = false;

    const clips = () => reel.clips || [];
    const outDur = c => Math.max(0.05, ((c.out || 0) - (c.in || 0)) / (c.speed || 1));
    const total = () => clips().reduce((a, c) => a + outDur(c), 0);
    const before = i => clips().slice(0, Math.max(0, i)).reduce((a, c) => a + outDur(c), 0);

    function applyLook() {
      v.style.filter = filterCSS(reel);
      if (ov && cfg.rebuildOverlay !== false) ov.innerHTML = overlayHTML(reel);
    }

    function nodes() { return ov ? ov.querySelectorAll('.stu-node') : []; }

    function paintOverlay(t) {
      const tot = total();
      nodes().forEach(n => {
        const a = parseFloat(n.dataset.t0) || 0;
        let b = parseFloat(n.dataset.t1) || 0;
        if (!b || b <= a) b = tot;
        n.classList.toggle('off', !(t >= a - 0.001 && t <= b + 0.001));
      });
    }

    function load(i, localT, thenPlay) {
      const c = clips()[i];
      if (!c) return;
      const changed = idx !== i;
      idx = i;
      const seek = () => {
        const target = clamp((c.in || 0) + (localT || 0) * (c.speed || 1), c.in || 0, Math.max((c.in || 0), (c.out || 0) - 0.04));
        try { v.currentTime = target; } catch (e) {}
        v.playbackRate = c.speed || 1;
        v.muted = muted || !!c.mute;
        v.volume = clamp(reel.origVol == null ? 1 : reel.origVol, 0, 1);
        if (thenPlay) v.play().catch(() => {});
      };
      if (changed && v.getAttribute('src') !== c.url) {
        v.src = c.url;
        v.addEventListener('loadedmetadata', seek, { once: true });
        v.load();
      } else if (v.readyState >= 1) seek();
      else v.addEventListener('loadedmetadata', seek, { once: true });
    }

    function musicStart(t) {
      if (!mus || !reel.music || !reel.music.src) return;
      if (mus.getAttribute('src') !== reel.music.src) { mus.src = reel.music.src; mus.load(); }
      mus.volume = clamp(reel.music.vol == null ? 0.8 : reel.music.vol, 0, 1);
      mus.muted = muted;
      const want = (reel.music.start || 0) + t;
      const go = () => {
        try { mus.currentTime = isFinite(mus.duration) && mus.duration ? want % mus.duration : want; } catch (e) {}
        if (!paused) mus.play().catch(() => {});
      };
      if (mus.readyState >= 1) go(); else mus.addEventListener('loadedmetadata', go, { once: true });
    }

    function syncMusic(t) {
      if (!mus || !reel.music || !reel.music.src || mus.readyState < 2) return;
      const dur = isFinite(mus.duration) && mus.duration ? mus.duration : 0;
      let want = (reel.music.start || 0) + t;
      if (dur) want = want % dur;
      if (Math.abs(mus.currentTime - want) > 0.45) { try { mus.currentTime = want; } catch (e) {} }
      if (!paused && mus.paused) mus.play().catch(() => {});
    }

    function tick() {
      if (dead) return;
      raf = requestAnimationFrame(tick);
      const c = clips()[idx];
      if (!c) return;
      if (!seeking && v.currentTime >= (c.out || 0) - 0.04) {
        if (idx + 1 < clips().length) load(idx + 1, 0, !paused);
        else restart(!paused);
        return;
      }
      const t = before(idx) + Math.max(0, (v.currentTime - (c.in || 0)) / (c.speed || 1));
      paintOverlay(t);
      syncMusic(t);
      if (cfg.onTime) cfg.onTime(t, total());
    }

    function play() {
      if (!clips().length) return;
      paused = false;
      if (idx < 0) load(0, 0, true); else v.play().catch(() => {});
      if (mus && reel.music && reel.music.src) mus.play().catch(() => {});
      if (!raf) raf = requestAnimationFrame(tick);
      if (cfg.onState) cfg.onState(false);
    }

    function pause() {
      paused = true;
      cancelAnimationFrame(raf);
      raf = 0;
      try { v.pause(); } catch (e) {}
      if (mus) { try { mus.pause(); } catch (e) {} }
      if (cfg.onState) cfg.onState(true);
    }

    function restart(autoplay) {
      if (autoplay) paused = false;
      load(0, 0, !!autoplay);
      musicStart(0);
      paintOverlay(0);
      if (cfg.onTime) cfg.onTime(0, total());
      if (autoplay) {
        if (!raf) raf = requestAnimationFrame(tick);
        if (mus && reel.music && reel.music.src) mus.play().catch(() => {});
        if (cfg.onState) cfg.onState(false);
      }
    }

    function seek(t) {
      const tot = total();
      t = clamp(t, 0, Math.max(0, tot - 0.05));
      let i = 0, acc = 0;
      const list = clips();
      for (; i < list.length; i++) {
        const d = outDur(list[i]);
        if (t < acc + d || i === list.length - 1) break;
        acc += d;
      }
      seeking = true;
      load(i, t - acc, !paused);
      setTimeout(() => { seeking = false; }, 120);
      paintOverlay(t);
      syncMusic(t);
      if (cfg.onTime) cfg.onTime(t, tot);
    }
    const seekPct = p => seek(clamp(p, 0, 1) * total());

    function setMuted(m) {
      muted = !!m;
      const c = clips()[idx];
      v.muted = muted || !!(c && c.mute);
      if (mus) mus.muted = muted;
    }

    function update(next, opts) {
      reel = next || reel;
      applyLook();
      const keep = opts && opts.keepTime;
      if (!keep) restart(!paused);
      if (mus && reel.music && reel.music.src) musicStart(current());
      else if (mus) { try { mus.pause(); mus.removeAttribute('src'); } catch (e) {} }
    }

    function current() {
      const c = clips()[idx];
      if (!c) return 0;
      return before(idx) + Math.max(0, (v.currentTime - (c.in || 0)) / (c.speed || 1));
    }

    function destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      raf = 0;
      try { v.pause(); } catch (e) {}
      if (mus) { try { mus.pause(); mus.removeAttribute('src'); } catch (e) {} }
    }

    applyLook();
    paintOverlay(0);
    if (clips().length) load(0, 0, false);
    if (reel.music && reel.music.src) musicStart(0);

    return {
      play, pause, restart, seek, seekPct, setMuted, update, destroy, applyLook,
      toggle: () => (paused ? play() : pause()),
      get paused() { return paused; },
      get total() { return total(); },
      get time() { return current(); },
      get clipIndex() { return idx; }
    };
  }

  /* ── Project state ───────────────────────────────────────────────── */

  const blank = () => ({
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    clips: [],
    filter: 'none',
    adj: { bright: 100, contrast: 100, sat: 100, warm: 0, blur: 0, vig: 0 },
    texts: [],
    stickers: [],
    captions: null,       // { segs: [{ id, t0, t1, text }], style, lang, auto }
    music: null,
    voice: null,
    origVol: 1,
    cover: null,          // { data, t }
    caption: '',
    tagged: [],
    place: '',
    audience: 'everyone',
    allowComments: true,
    allowRemix: true,
    tips: true,
    ai: false,            // made with AI, declared by the creator
    savedAt: 0
  });

  /* ── Drafts ────────────────────────────────────────────────────────
     A draft is the project without its video. The edit is small and
     goes in localStorage; the clips are large and go in the same
     IndexedDB store the published reels use, under this draft's id.
     Nothing is re-encoded to save a draft, so it is quick, and
     reopening one gives back the clips exactly as they were.

     Drafts are why the exit prompt can offer three answers instead of
     "discard, yes or no". */

  const DKEY = 'ts_stu_drafts_v1';
  const MAX_DRAFTS = 8;

  /* The blob store belongs to the Shorty page, and that page is
     fetched on demand — so on a session that has never opened Reels,
     window.SH does not exist yet. Everything that needs to read or
     write a blob waits for it here rather than checking for it and
     quietly doing nothing, which is how saving a draft used to fail
     with no visible reason. Publishing goes through this too: it had
     the same hole. */
  async function needSH() {
    if (window.SH && SH.store) return SH;
    try {
      if (globalThis.__lazy && globalThis.__lazy.ensurePane) await globalThis.__lazy.ensurePane('reels');
    } catch (e) { /* fall through to the check below */ }
    return (window.SH && SH.store) ? SH : null;
  }

  const draftList = () => {
    try { const v = JSON.parse(localStorage.getItem(DKEY) || '[]'); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  };

  const draftHasWork = () => !!(P.clips.length || (P.caption || '').trim());

  async function saveDraft(quiet) {
    if (!draftHasWork()) { if (!quiet) toast('Nothing to save yet.'); return false; }
    if (!(await needSH())) { if (!quiet) toast('Drafts need this browser\'s storage.'); return false; }
    try {
      for (const c of P.clips) {
        if (!c.blob) continue;
        await SH.store.put(P.id + '_' + c.id, c.blob);
      }
      if (P.music && P.music.custom && P.music.blob) await SH.store.put(P.id + '_audio', P.music.blob);

      /* The blob and its object URL belong to this session, so they are
         left out of what is written down and rebuilt on the way back. */
      const thin = JSON.parse(JSON.stringify({
        ...P,
        clips: P.clips.map(c => ({ id: c.id, in: c.in, out: c.out, dur: c.dur, speed: c.speed, mute: !!c.mute })),
        music: P.music ? { ...P.music, blob: undefined, src: P.music.custom ? '' : P.music.src } : null
      }));
      thin.savedAt = Date.now();
      thin.cover = P.cover ? { data: P.cover.data, t: P.cover.t } : null;

      const list = draftList().filter(d => d.id !== P.id);
      list.unshift(thin);
      const keep = list.slice(0, MAX_DRAFTS);
      localStorage.setItem(DKEY, JSON.stringify(keep));
      list.slice(MAX_DRAFTS).forEach(dropDraftBlobs);
      P.savedAt = thin.savedAt;
      if (!quiet) toast('Saved to drafts');
      return true;
    } catch (e) {
      if (!quiet) toast('Could not save — this device may be out of storage.');
      return false;
    }
  }

  function dropDraftBlobs(d) {
    if (!(window.SH && SH.store && SH.store.del)) return;
    (d.clips || []).forEach(c => { try { SH.store.del(d.id + '_' + c.id); } catch (e) {} });
    try { SH.store.del(d.id + '_audio'); } catch (e) {}
  }

  function deleteDraft(id) {
    const d = draftList().find(x => x.id === id);
    if (d) dropDraftBlobs(d);
    try { localStorage.setItem(DKEY, JSON.stringify(draftList().filter(x => x.id !== id))); } catch (e) {}
    paint();
  }

  async function openDraft(id) {
    const d = draftList().find(x => x.id === id);
    if (!d) { toast('That draft is gone.'); return; }
    if (!(await needSH())) { toast('Drafts need this browser\'s storage.'); return; }
    toast('Opening draft…');
    const clips = [];
    for (const c of (d.clips || [])) {
      try {
        const blob = await SH.store.get(d.id + '_' + c.id);
        if (!blob) continue;
        clips.push({ ...c, blob, url: URL.createObjectURL(blob), tmp: true });
      } catch (e) { /* one lost clip should not lose the draft */ }
    }
    if (!clips.length) {
      toast('This draft\'s video is no longer on the device.');
      deleteDraft(id);
      return;
    }
    P = { ...blank(), ...d, clips };
    if (P.music && P.music.custom) {
      try {
        const b = await SH.store.get(d.id + '_audio');
        if (b) { P.music.blob = b; P.music.src = URL.createObjectURL(b); }
        else P.music = null;
      } catch (e) { P.music = null; }
    }
    sel = 0; selNode = null; thumbCache = {};
    H = null; stkForm = null; stkQ = ''; capNote = '';
    stopCam();
    go('edit');
  }

  /* Leaving with work in progress. Three answers, because "are you
     sure?" throws away the only two that are useful. */
  function exitChoice() {
    return new Promise(res => {
      const el = document.createElement('div');
      el.className = 'mob-dialog-scrim';
      el.innerHTML = `<div class="mob-dialog" role="alertdialog" aria-modal="true">
        <h3>Keep this reel?</h3>
        <p>${P.clips.length} clip${P.clips.length === 1 ? '' : 's'} here. Drafts stay on this device.</p>
        <div class="mob-dialog-a stu-exit-a">
          <button type="button" class="btn btn-ghost" data-x="cancel">Keep editing</button>
          <button type="button" class="btn mob-danger" data-x="discard">Discard</button>
          <button type="button" class="btn btn-primary" data-x="save">Save draft</button>
        </div>
      </div>`;
      el.addEventListener('click', e => {
        const b = e.target.closest('button[data-x]');
        if (!b) return;
        el.remove();
        res(b.dataset.x);
      });
      document.body.appendChild(el);
      requestAnimationFrame(() => { const f = el.querySelector('[data-x="save"]'); if (f) f.focus(); });
    });
  }

  /* Every way out of the studio goes through here. */
  async function leave() {
    if (!draftHasWork()) { close(); return; }
    const out = await exitChoice();
    if (out === 'cancel') return;
    if (out === 'save') { await saveDraft(); }
    close();
  }

  let P = blank();
  let screen = 'capture';
  let tool = 'clips';
  let sel = 0;              // selected clip
  let selNode = null;       // { kind:'text'|'sticker', id }
  let eng = null;           // edit-screen engine
  let thumbCache = {};      // clip id -> [dataURL]
  let previewAudio = null;  // music preview in the sound tab
  let cam = { stream: null, rec: null, chunks: [], on: false, facing: 'user', timer: 0, started: 0, len: 60, speed: 1, count: 0, mic: true, tick: 0, hold: 0 };
  let H = null, hTimer = 0, hPending = null, pDown = false;   // edit history
  let stkForm = null, stkQ = '';                              // sticker being made
  let capBusy = null, capNote = '', capLang = '';             // captions run
  /* Object URLs of clips deleted during the edit. Undo can bring a clip
     back, so they are freed when the studio closes, not on delete. */
  const orphans = new Set();
  window.addEventListener('pointerup', () => { pDown = false; }, true);
  window.addEventListener('pointercancel', () => { pDown = false; }, true);

  const totalOut = () => P.clips.reduce((a, c) => a + Math.max(0.05, (c.out - c.in) / (c.speed || 1)), 0);
  const clipOut = c => Math.max(0.05, (c.out - c.in) / (c.speed || 1));

  /* ── Shell ───────────────────────────────────────────────────────── */

  function open(prefill, opts) {
    close(true);
    P = blank();
    if (prefill) P.caption = prefill;
    screen = (opts && opts.screen) || 'capture';
    tool = 'clips';
    sel = 0; selNode = null; thumbCache = {};
    H = null; stkForm = null; stkQ = ''; capNote = '';

    const root = document.createElement('div');
    root.id = 'stu';
    root.className = 'stu';
    root.innerHTML = '<div class="stu-shell" id="stu-shell"></div>';
    document.body.appendChild(root);
    document.body.classList.add('stu-open');
    document.addEventListener('keydown', onKey);
    paint();
  }

  function close(silent) {
    window.removeEventListener('resize', fitStage);
    stopCam();
    stopPreviewAudio();
    if (eng) { eng.destroy(); eng = null; }
    const el = $('stu');
    if (el) el.remove();
    document.body.classList.remove('stu-open');
    document.removeEventListener('keydown', onKey);
    clearInterval(hTimer); hTimer = 0; H = null;
    if (window.MUS) MUS.close(true);
    if (window.HT) HT.close();
    if (!silent) {
      // Free anything the project held that never got published - and the
      // clips deleted along the way, which undo could have brought back.
      const keep = new Set(P.clips.filter(c => !c.tmp).map(c => c.url));
      if (P.music && P.music.src) keep.add(P.music.src);
      orphans.forEach(u => { if (!keep.has(u)) { try { URL.revokeObjectURL(u); } catch (e) {} } });
      orphans.clear();
      P.clips.forEach(c => { if (c.url && c.tmp) URL.revokeObjectURL(c.url); });
      P = blank();
    }
  }

  function onKey(e) {
    if (!$('stu')) return;
    if (e.target && /input|textarea/i.test(e.target.tagName)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (screen === 'edit' && (e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (k === 'y') { e.preventDefault(); redo(); return; }
    }
    if (e.key === 'Escape') { e.preventDefault(); back(); }
    else if (e.key === ' ' && screen === 'edit') { e.preventDefault(); if (eng) eng.toggle(); }
  }

  async function back() {
    if (screen === 'share') { go('edit'); return; }
    if (screen === 'edit') { leave(); return; }
    leave();
  }

  function go(s) {
    if (s === 'edit' && !P.clips.length) { toast('Record or import a clip first.'); return; }
    stopPreviewAudio();
    if (screen === 'edit' && s !== 'edit') flushHist();
    if (screen === 'capture' && s !== 'capture') stopCam();
    if (eng && s !== 'edit') { eng.destroy(); eng = null; }
    screen = s;
    paint();
  }

  function paint() {
    const shell = $('stu-shell');
    if (!shell) return;
    if (screen === 'capture') { shell.innerHTML = captureHTML(); wireCapture(); }
    else if (screen === 'edit') { shell.innerHTML = editHTML(); wireEdit(); }
    else { shell.innerHTML = shareHTML(); wireShare(); }
  }

  /* ══════════════════════════════════════════════════════════════════
     1 · CAPTURE
     ══════════════════════════════════════════════════════════════════ */

  function captureHTML() {
    const segs = P.clips.map(c => `<i style="flex:${clamp(clipOut(c) / cam.len, 0.02, 1)}"></i>`).join('');
    return `
      <div class="stu-cap">
        <div class="stu-segs" id="stu-segs">${segs}<i class="live" id="stu-seg-live" style="flex:0"></i></div>

        <div class="stu-cap-top">
          <button class="stu-round" onclick="STU.leave()" aria-label="Close"><span class="material-symbols-rounded">close</span></button>
          <div class="stu-len">
            ${LENGTHS.map(([s, l]) => `<button class="stu-len-b${cam.len === s ? ' on' : ''}" onclick="STU.setLen(${s})">${l}</button>`).join('')}
          </div>
          <button class="stu-round" onclick="STU.flip()" aria-label="Flip camera"><span class="material-symbols-rounded">cameraswitch</span></button>
        </div>

        <div class="stu-view" id="stu-view">
          <video id="stu-cam" class="stu-cam${cam.facing === 'user' ? ' mirror' : ''}" autoplay playsinline muted></video>
          <div class="stu-cam-off" id="stu-cam-off" hidden>
            <span class="material-symbols-rounded">videocam_off</span>
            <b>Camera not available</b>
            <p id="stu-cam-msg">Allow camera access to record, or bring in a video from your gallery.</p>
            <button class="stu-btn" onclick="STU.startCam()">Try again</button>
          </div>
          <div class="stu-count" id="stu-count" hidden></div>
          <div class="stu-rec-time" id="stu-rec-time" hidden>0:00</div>
        </div>

        <div class="stu-rail">
          <button class="stu-rail-b" onclick="STU.cycleSpeed()">
            <span class="material-symbols-rounded">speed</span><b>${cam.speed}x</b></button>
          <button class="stu-rail-b${cam.timer ? ' on' : ''}" onclick="STU.cycleTimer()">
            <span class="material-symbols-rounded">timer</span><b>${cam.timer ? cam.timer + 's' : 'Timer'}</b></button>
          <button class="stu-rail-b${cam.mic ? '' : ' on'}" onclick="STU.toggleMic()">
            <span class="material-symbols-rounded">${cam.mic ? 'mic' : 'mic_off'}</span><b>${cam.mic ? 'Mic' : 'Muted'}</b></button>
          <button class="stu-rail-b" onclick="STU.pickFiles()">
            <span class="material-symbols-rounded">photo_library</span><b>Import</b></button>
        </div>

        <div class="stu-cap-bottom">
          <button class="stu-gallery" onclick="STU.pickFiles()" aria-label="Import from gallery">
            <span class="material-symbols-rounded">add_photo_alternate</span>
          </button>
          <div class="stu-shutter-wrap">
            <svg class="stu-ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle class="stu-ring-bg" cx="50" cy="50" r="45"></circle>
              <circle class="stu-ring-fg" id="stu-ring" cx="50" cy="50" r="45"
                      stroke-dasharray="283" stroke-dashoffset="283"></circle>
            </svg>
            <button class="stu-shutter" id="stu-shutter" aria-label="Record"><i></i></button>
          </div>
          <button class="stu-next${P.clips.length ? '' : ' ghost'}" id="stu-next" onclick="STU.go('edit')" aria-label="Next">
            <span class="material-symbols-rounded">arrow_forward</span>
          </button>
        </div>

        ${draftsBarHTML()}

        <div class="stu-cap-hint" id="stu-cap-hint">
          ${P.clips.length
            ? `${P.clips.length} clip${P.clips.length > 1 ? 's' : ''} · ${fmt(totalOut())} — <button class="stu-link" onclick="STU.undoClip()">delete last</button>`
            : 'Hold to record · tap for hands-free'}
        </div>

        <input type="file" id="stu-files" accept="video/*" multiple hidden>
      </div>`;
  }

  /* Only shown when there is something to come back to. */
  function draftsBarHTML() {
    const list = draftList();
    if (!list.length || P.clips.length) return '';
    return `<div class="stu-drafts" role="group" aria-label="Your drafts">
      <b>${list.length} draft${list.length === 1 ? '' : 's'}</b>
      ${list.slice(0, 6).map(d => `
        <span class="stu-draft">
          <button type="button" onclick="STU.openDraft('${esc(d.id)}')" title="${esc((d.caption || 'Untitled').slice(0, 60))}">
            ${d.cover && d.cover.data ? `<img src="${esc(d.cover.data)}" alt="">` : '<span class="material-symbols-rounded">movie</span>'}
            <em>${esc((d.caption || 'Untitled').slice(0, 18))}</em>
          </button>
          <button type="button" class="stu-draft-x" onclick="STU.deleteDraft('${esc(d.id)}')" aria-label="Delete draft">
            <span class="material-symbols-rounded">close</span>
          </button>
        </span>`).join('')}
    </div>`;
  }

  function wireCapture() {
    const files = $('stu-files');
    if (files) files.addEventListener('change', () => { importFiles(files.files); files.value = ''; });

    const sh = $('stu-shutter');
    if (sh) {
      sh.addEventListener('pointerdown', e => { e.preventDefault(); onShutterDown(); });
      sh.addEventListener('pointerup', e => { e.preventDefault(); onShutterUp(); });
      sh.addEventListener('pointercancel', () => onShutterUp());
    }
    startCam();
  }

  async function startCam() {
    const view = $('stu-cam');
    const off = $('stu-cam-off');
    if (!view) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return camFail('This browser has no camera API. Import a video instead.');
    }
    try {
      stopCam();
      cam.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cam.facing, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: cam.mic
      });
      view.srcObject = cam.stream;
      view.hidden = false;
      if (off) off.hidden = true;
      await view.play().catch(() => {});
    } catch (e) {
      const why = e && e.name === 'NotAllowedError' ? 'Camera access was blocked. Allow it in the address bar, or import a video.'
        : e && e.name === 'NotFoundError' ? 'No camera found on this device. Import a video instead.'
        : 'The camera could not start. Import a video instead.';
      camFail(why);
    }
  }

  function camFail(msg) {
    const view = $('stu-cam'), off = $('stu-cam-off'), m = $('stu-cam-msg');
    if (view) view.hidden = true;
    if (off) off.hidden = false;
    if (m) m.textContent = msg;
  }

  function stopCam() {
    clearInterval(cam.tick);
    clearTimeout(cam.hold);
    if (cam.rec && cam.rec.state !== 'inactive') { try { cam.rec.stop(); } catch (e) {} }
    cam.rec = null; cam.on = false;
    if (cam.stream) { cam.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); cam.stream = null; }
    const v = $('stu-cam');
    if (v) v.srcObject = null;
  }

  function flip() {
    cam.facing = cam.facing === 'user' ? 'environment' : 'user';
    const v = $('stu-cam');
    if (v) v.classList.toggle('mirror', cam.facing === 'user');
    startCam();
  }

  function toggleMic() { cam.mic = !cam.mic; paint(); }
  function setLen(s) { cam.len = s; paint(); }
  function cycleSpeed() {
    const i = SPEEDS.indexOf(cam.speed);
    cam.speed = SPEEDS[(i + 1) % SPEEDS.length];
    paint();
  }
  function cycleTimer() {
    cam.timer = cam.timer === 0 ? 3 : cam.timer === 3 ? 10 : 0;
    paint();
  }

  function mime() {
    const want = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    if (!window.MediaRecorder) return '';
    return want.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
  }

  function onShutterDown() {
    if (cam.on) { stopRec(); return; }          // hands-free: second tap stops
    cam.hold = setTimeout(() => { cam.hold = 0; }, 1);   // marker only
    cam.pressedAt = Date.now();
    beginRec();
  }
  function onShutterUp() {
    // A quick tap leaves it running (hands-free). A real hold stops on release.
    if (!cam.on) return;
    if (Date.now() - (cam.pressedAt || 0) > 380) stopRec();
  }

  async function beginRec() {
    if (!cam.stream) { toast('The camera is not running.'); return; }
    if (!window.MediaRecorder) { toast('This browser cannot record video. Import a clip instead.'); return; }
    if (totalOut() >= MAX_SECONDS) { toast('That is the three-minute limit.'); return; }

    if (cam.timer) {
      const el = $('stu-count');
      let n = cam.timer;
      el.hidden = false; el.textContent = n;
      await new Promise(res => {
        const iv = setInterval(() => {
          n--;
          if (n <= 0) { clearInterval(iv); el.hidden = true; res(); }
          else { el.textContent = n; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
        }, 1000);
      });
      if (!$('stu-shutter')) return;   // studio closed mid-countdown
    }

    const type = mime();
    try { cam.rec = new MediaRecorder(cam.stream, type ? { mimeType: type, videoBitsPerSecond: 4500000 } : undefined); }
    catch (e) { toast('Recording is not supported here. Import a clip instead.'); return; }

    cam.chunks = [];
    cam.rec.ondataavailable = e => { if (e.data && e.data.size) cam.chunks.push(e.data); };
    cam.rec.onstop = () => finishRec(type);
    cam.rec.start(250);
    cam.on = true;
    cam.started = Date.now();

    const btn = $('stu-shutter');
    if (btn) btn.classList.add('rec');
    const time = $('stu-rec-time');
    if (time) time.hidden = false;

    const budget = Math.min(cam.len, MAX_SECONDS - totalOut());
    clearInterval(cam.tick);
    cam.tick = setInterval(() => {
      const el = (Date.now() - cam.started) / 1000;
      const ring = $('stu-ring');
      if (ring) ring.style.strokeDashoffset = String(283 - 283 * clamp(el / budget, 0, 1));
      const t = $('stu-rec-time');
      if (t) t.textContent = fmt(el);
      const live = $('stu-seg-live');
      if (live) live.style.flex = String(clamp(el / cam.len, 0.02, 1));
      if (el >= budget) stopRec();
    }, 100);
  }

  function stopRec() {
    if (!cam.on) return;
    cam.on = false;
    clearInterval(cam.tick);
    try { cam.rec.stop(); } catch (e) {}
    const btn = $('stu-shutter');
    if (btn) btn.classList.remove('rec');
    const ring = $('stu-ring');
    if (ring) ring.style.strokeDashoffset = '283';
    const time = $('stu-rec-time');
    if (time) time.hidden = true;
  }

  async function finishRec(type) {
    const blob = new Blob(cam.chunks, { type: type || 'video/webm' });
    cam.chunks = [];
    if (blob.size < 2048) { toast('That clip was too short.'); return; }
    const url = URL.createObjectURL(blob);
    let dur = await probe(url);
    if (!dur) dur = Math.max(0.4, (Date.now() - cam.started) / 1000);
    addClip({ blob, url, dur, speed: cam.speed, name: 'Recording' });
    if (screen === 'capture') paint();
    toast('Clip added');
  }

  function addClip(c) {
    P.clips.push({
      id: uid('c'), url: c.url, blob: c.blob, tmp: true,
      name: c.name || 'Clip', src: c.dur, in: 0, out: c.dur,
      speed: c.speed || 1, mute: false
    });
  }

  function undoClip() {
    const c = P.clips.pop();
    if (c && c.tmp && c.url) orphans.add(c.url);
    thumbCache = {};
    paint();
  }

  function pickFiles() { const f = $('stu-files'); if (f) f.click(); }

  async function importFiles(list) {
    const files = Array.from(list || []);
    if (!files.length) return;
    let added = 0;
    for (const f of files) {
      if (!f.type.startsWith('video/')) { toast(`${f.name} is not a video.`); continue; }
      if (f.size > MAX_BYTES) { toast(`${f.name} is over 100 MB.`); continue; }
      const url = URL.createObjectURL(f);
      const dur = await probe(url);
      if (!dur) { URL.revokeObjectURL(url); toast(`This browser can't play ${f.name}.`); continue; }
      if (totalOut() + dur > MAX_SECONDS) {
        addClip({ blob: f, url, dur: Math.max(1, MAX_SECONDS - totalOut()), speed: 1, name: f.name });
        toast('Trimmed to the three-minute limit — adjust it in Clips.');
        added++;
        break;
      }
      addClip({ blob: f, url, dur, speed: 1, name: f.name });
      added++;
    }
    if (!added) { if (screen === 'capture') paint(); return; }
    if (screen === 'capture') { stopCam(); go('edit'); }
    else { thumbCache = {}; paint(); }
  }

  /* ══════════════════════════════════════════════════════════════════
     2 · EDIT
     ══════════════════════════════════════════════════════════════════ */

  function editHTML() {
    return `
      <div class="stu-edit">
        <div class="stu-bar">
          <button class="stu-round" onclick="STU.back()" aria-label="Back"><span class="material-symbols-rounded">arrow_back</span></button>
          <div class="stu-bar-t">Edit reel</div>
          <div class="stu-hist">
            <button class="stu-round sm" id="stu-undo" onclick="STU.undo()" aria-label="Undo" title="Undo (Ctrl+Z)" disabled><span class="material-symbols-rounded">undo</span></button>
            <button class="stu-round sm" id="stu-redo" onclick="STU.redo()" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled><span class="material-symbols-rounded">redo</span></button>
          </div>
          <button class="stu-nextb" onclick="STU.go('share')">Next</button>
        </div>

        <div class="stu-stage" id="stu-stage">
          <video id="stu-v" class="stu-v" playsinline webkit-playsinline></video>
          <div class="stu-ov" id="stu-ov"></div>
          <audio id="stu-music" loop></audio>
          <div class="stu-play" id="stu-play"><span class="material-symbols-rounded">play_arrow</span></div>
          <div class="stu-stage-tap" id="stu-tap"></div>
        </div>

        <div class="stu-sheet">
          <div class="stu-scrub">
            <div class="stu-scrub-bar" id="stu-scrub"><i id="stu-scrub-i"></i></div>
            <div class="stu-scrub-t"><span id="stu-t-now">0:00</span><span id="stu-t-all">${fmt(totalOut())}</span></div>
          </div>

          <div class="stu-tabs">
            ${TOOLS.map(([k, l, i]) => `<button class="stu-tab${tool === k ? ' on' : ''}" onclick="STU.setTool('${k}')">
              <span class="material-symbols-rounded">${i}</span><b>${l}</b></button>`).join('')}
          </div>

          <div class="stu-panel" id="stu-panel">${panelHTML()}</div>
        </div>
      </div>`;
  }

  function fitStage() {
    const wrap = document.querySelector('.stu-edit');
    const stage = $('stu-stage');
    if (!wrap || !stage) return;
    const h = Math.min(wrap.clientHeight, wrap.clientWidth * 16 / 9);
    stage.style.height = Math.round(h) + 'px';
    stage.style.width = Math.round(h * 9 / 16) + 'px';
  }

  function wireEdit() {
    const v = $('stu-v'), ov = $('stu-ov'), mus = $('stu-music');
    if (!v) return;
    fitStage();
    window.addEventListener('resize', fitStage);
    if (eng) eng.destroy();
    eng = engine({
      video: v, overlay: ov, music: mus, reel: P, muted: false,
      onTime: (t, tot) => {
        const i = $('stu-scrub-i'); if (i) i.style.width = (tot ? (t / tot) * 100 : 0) + '%';
        const n = $('stu-t-now'); if (n) n.textContent = fmt(t);
        const a = $('stu-t-all'); if (a) a.textContent = fmt(tot);
      },
      onState: paused => {
        const p = $('stu-play');
        if (p) p.classList.toggle('show', paused);
      }
    });

    const tap = $('stu-tap');
    if (tap) tap.addEventListener('click', () => eng.toggle());

    const bar = $('stu-scrub');
    if (bar) {
      const seek = e => {
        const r = bar.getBoundingClientRect();
        const x = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width;
        eng.seekPct(x);
      };
      bar.addEventListener('pointerdown', e => {
        seek(e);
        const mv = ev => seek(ev);
        const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', mv);
        window.addEventListener('pointerup', up);
      });
    }

    wireNodeDrag();
    wirePanel();
    eng.play();

    const root = document.querySelector('.stu-edit');
    if (root) root.addEventListener('pointerdown', () => { pDown = true; }, true);
    if (!H) histReset(); else paintHist();
    if (!hTimer) hTimer = setInterval(histTick, 350);
  }

  function setTool(t) {
    tool = t;
    stopPreviewAudio();
    document.querySelectorAll('.stu-tab').forEach(b => b.classList.toggle('on', b.getAttribute('onclick').includes(`'${t}'`)));
    repaintPanel();
  }

  function repaintPanel() {
    const p = $('stu-panel');
    if (!p) return;
    p.innerHTML = panelHTML();
    wirePanel();
  }

  /* Re-apply the edit without restarting playback. */
  function touch(keepTime) {
    if (eng) eng.update(P, { keepTime: keepTime !== false });
    if (keepTime !== false) wireNodeDrag();
  }

  /* ── Overlay dragging on the stage ───────────────────────────────── */

  function wireNodeDrag() {
    const ov = $('stu-ov');
    const stage = $('stu-stage');
    if (!ov || !stage) return;
    ov.classList.add('edit');
    ov.querySelectorAll('.stu-node:not(.stu-cap)').forEach(node => {
      node.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        const id = node.dataset.id;
        const isText = node.classList.contains('stu-text');
        selNode = { kind: isText ? 'text' : 'sticker', id };
        markSelection();
        const r = stage.getBoundingClientRect();
        const move = ev => {
          const x = clamp(((ev.clientX - r.left) / r.width) * 100, 2, 98);
          const y = clamp(((ev.clientY - r.top) / r.height) * 100, 3, 97);
          node.style.left = x + '%';
          node.style.top = y + '%';
          const item = (isText ? P.texts : P.stickers).find(t => t.id === id);
          if (item) { item.x = Math.round(x * 10) / 10; item.y = Math.round(y * 10) / 10; }
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          repaintPanel();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
      node.addEventListener('dblclick', () => {
        if (node.classList.contains('stu-text')) editText(node.dataset.id);
      });
    });
    markSelection();
  }

  function markSelection() {
    const ov = $('stu-ov');
    if (!ov) return;
    ov.querySelectorAll('.stu-node').forEach(n => n.classList.toggle('sel', !!selNode && n.dataset.id === selNode.id));
  }

  /* ── Tool panels ─────────────────────────────────────────────────── */

  function panelHTML() {
    switch (tool) {
      case 'clips':    return clipsPanel();
      case 'sound':    return soundPanel();
      case 'text':     return textPanel();
      case 'stickers': return stickerPanel();
      case 'captions': return captionsPanel();
      case 'filters':  return filterPanel();
      case 'adjust':   return adjustPanel();
      case 'cover':    return coverPanel();
      default:         return '';
    }
  }

  function wirePanel() {
    if (tool === 'clips') wireTrim();
    if (tool === 'cover') wireCoverStrip();
    if (tool === 'filters') paintFilterThumbs();
    if (tool === 'sound') wireWave();
  }

  /* — Clips ————————————————————————————————————————————————— */

  function clipsPanel() {
    const c = P.clips[sel];
    if (!c) return '<div class="stu-none">No clips yet.</div>';
    return `
      <div class="stu-strip">
        ${P.clips.map((x, i) => `
          <button class="stu-chip-clip${i === sel ? ' on' : ''}" onclick="STU.selClip(${i})" style="flex:${clamp(clipOut(x) / Math.max(1, totalOut()), 0.14, 1)}">
            <span class="stu-chip-n">${i + 1}</span>
            <span class="stu-chip-d">${fmtMs(clipOut(x))}</span>
            ${x.speed !== 1 ? `<span class="stu-chip-s">${x.speed}x</span>` : ''}
            ${x.mute ? '<span class="material-symbols-rounded stu-chip-m">volume_off</span>' : ''}
          </button>`).join('')}
        <button class="stu-chip-add" onclick="STU.pickFiles()" aria-label="Add clip"><span class="material-symbols-rounded">add</span></button>
      </div>

      <div class="stu-trim" id="stu-trim">
        <div class="stu-trim-frames" id="stu-frames"></div>
        <div class="stu-trim-mask left"  id="stu-mask-l"></div>
        <div class="stu-trim-mask right" id="stu-mask-r"></div>
        <div class="stu-trim-win" id="stu-win">
          <span class="stu-trim-h l" data-h="l"></span>
          <span class="stu-trim-h r" data-h="r"></span>
        </div>
      </div>
      <div class="stu-trim-read">
        <span>in ${fmtMs(c.in)}</span>
        <b>${fmtMs(clipOut(c))} after ${c.speed}x</b>
        <span>out ${fmtMs(c.out)}</span>
      </div>

      <div class="stu-row-lbl">Speed</div>
      <div class="stu-chips">
        ${SPEEDS.map(s => `<button class="stu-chip${c.speed === s ? ' on' : ''}" onclick="STU.clipSpeed(${s})">${s}x</button>`).join('')}
      </div>

      <div class="stu-acts">
        <button class="stu-act" onclick="STU.splitClip()"><span class="material-symbols-rounded">content_cut</span>Split</button>
        <button class="stu-act" onclick="STU.moveClip(-1)"><span class="material-symbols-rounded">chevron_left</span>Move</button>
        <button class="stu-act" onclick="STU.moveClip(1)"><span class="material-symbols-rounded">chevron_right</span>Move</button>
        <button class="stu-act${c.mute ? ' on' : ''}" onclick="STU.muteClip()"><span class="material-symbols-rounded">${c.mute ? 'volume_off' : 'volume_up'}</span>${c.mute ? 'Muted' : 'Sound'}</button>
        <button class="stu-act" onclick="STU.dupClip()"><span class="material-symbols-rounded">content_copy</span>Copy</button>
        <button class="stu-act danger" onclick="STU.delClip()"><span class="material-symbols-rounded">delete</span>Delete</button>
      </div>`;
  }

  function selClip(i) {
    sel = clamp(i, 0, P.clips.length - 1);
    repaintPanel();
    if (eng) eng.seek(P.clips.slice(0, sel).reduce((a, c) => a + clipOut(c), 0) + 0.01);
  }

  function clipSpeed(s) {
    const c = P.clips[sel];
    if (!c) return;
    c.speed = s;
    touch();
    repaintPanel();
  }

  function muteClip() {
    const c = P.clips[sel];
    if (!c) return;
    c.mute = !c.mute;
    touch();
    repaintPanel();
  }

  function moveClip(d) {
    const j = sel + d;
    if (j < 0 || j >= P.clips.length) return;
    const [c] = P.clips.splice(sel, 1);
    P.clips.splice(j, 0, c);
    sel = j;
    touch(false);
    repaintPanel();
  }

  function dupClip() {
    const c = P.clips[sel];
    if (!c) return;
    if (totalOut() + clipOut(c) > MAX_SECONDS) { toast('That would pass three minutes.'); return; }
    P.clips.splice(sel + 1, 0, { ...c, id: uid('c') });
    thumbCache = {};
    touch(false);
    repaintPanel();
  }

  function delClip() {
    if (P.clips.length <= 1) { toast('A reel needs at least one clip.'); return; }
    const [c] = P.clips.splice(sel, 1);
    if (c && c.tmp && c.url) orphans.add(c.url);
    sel = clamp(sel, 0, P.clips.length - 1);
    touch(false);
    repaintPanel();
  }

  /* Split at the playhead, the way a timeline editor does. */
  function splitClip() {
    const c = P.clips[sel];
    if (!c || !eng) return;
    const startOfClip = P.clips.slice(0, sel).reduce((a, x) => a + clipOut(x), 0);
    const localOut = eng.time - startOfClip;
    const at = (c.in || 0) + localOut * (c.speed || 1);
    if (at <= c.in + 0.25 || at >= c.out - 0.25) { toast('Move the playhead into the middle of the clip first.'); return; }
    const right = { ...c, id: uid('c'), in: at };
    c.out = at;
    P.clips.splice(sel + 1, 0, right);
    touch(false);
    repaintPanel();
    toast('Split');
  }

  /* Trim strip: real frames from the clip, dual handles over them. */
  async function wireTrim() {
    const c = P.clips[sel];
    const box = $('stu-trim');
    if (!c || !box) return;
    paintTrimWindow();

    const frames = $('stu-frames');
    if (frames) {
      const shots = await thumbs(c);
      if ($('stu-frames') === frames) {
        frames.innerHTML = shots.length
          ? shots.map(s => `<i style="background-image:url('${s}')"></i>`).join('')
          : '<i class="plain"></i><i class="plain"></i><i class="plain"></i><i class="plain"></i><i class="plain"></i>';
      }
    }

    box.querySelectorAll('.stu-trim-h').forEach(h => {
      h.addEventListener('pointerdown', e => {
        e.preventDefault();
        const side = h.dataset.h;
        const r = box.getBoundingClientRect();
        const move = ev => {
          const p = clamp((ev.clientX - r.left) / r.width, 0, 1);
          const t = p * c.src;
          if (side === 'l') c.in = clamp(t, 0, c.out - 0.4);
          else c.out = clamp(t, c.in + 0.4, c.src);
          paintTrimWindow();
          const read = document.querySelector('.stu-trim-read');
          if (read) read.innerHTML = `<span>in ${fmtMs(c.in)}</span><b>${fmtMs(clipOut(c))} after ${c.speed}x</b><span>out ${fmtMs(c.out)}</span>`;
          const v = $('stu-v');
          if (v && eng && eng.clipIndex === sel) { try { v.currentTime = side === 'l' ? c.in : Math.max(c.in, c.out - 0.05); } catch (er) {} }
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          touch(false);
          repaintPanel();
        };
        if (eng) eng.pause();
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    });
  }

  function paintTrimWindow() {
    const c = P.clips[sel];
    const win = $('stu-win'), ml = $('stu-mask-l'), mr = $('stu-mask-r');
    if (!c || !win) return;
    const a = (c.in / c.src) * 100, b = (c.out / c.src) * 100;
    win.style.left = a + '%';
    win.style.width = Math.max(2, b - a) + '%';
    if (ml) ml.style.width = a + '%';
    if (mr) mr.style.width = (100 - b) + '%';
  }

  /* Five real frames per clip, taken once and remembered. */
  function thumbs(c) {
    if (thumbCache[c.id]) return Promise.resolve(thumbCache[c.id]);
    return new Promise(res => {
      const v = document.createElement('video');
      v.preload = 'auto'; v.muted = true; v.playsInline = true;
      const out = [];
      const N = 6;
      let i = 0, failed = false;
      const done = () => { thumbCache[c.id] = out; try { v.removeAttribute('src'); v.load(); } catch (e) {} res(out); };
      const next = () => {
        if (failed || i >= N) return done();
        const t = (c.src / N) * i + c.src / (N * 2);
        i++;
        try { v.currentTime = Math.min(t, Math.max(0.05, c.src - 0.05)); } catch (e) { failed = true; done(); }
      };
      v.onloadeddata = () => next();
      v.onseeked = () => { const d = grab(v, 90, 160, ''); if (d) out.push(d); next(); };
      v.onerror = () => { failed = true; done(); };
      setTimeout(() => { if (out.length < N) done(); }, 6000);
      v.src = c.url;
    });
  }

  /* — Sound ————————————————————————————————————————————————— */

  function soundPanel() {
    const m = P.music;
    const tot = totalOut();
    const ov = Math.round((P.origVol == null ? 1 : P.origVol) * 100);
    const a = (m && m.art) || ['#374151', '#6B7280'];
    return `
      <div class="stu-acts">
        <button class="stu-act stu-act-main" onclick="STU.openMusic()"><span class="material-symbols-rounded">library_music</span>${m && !m.voice ? 'Change music' : 'Browse music'}</button>
        <button class="stu-act${P.voice ? ' on' : ''}" id="stu-vo" onclick="STU.voiceover()">
          <span class="material-symbols-rounded">mic</span>${P.voice ? 'Re-record' : 'Voiceover'}</button>
        ${P.voice ? '<button class="stu-act danger" onclick="STU.clearVoice()"><span class="material-symbols-rounded">delete</span>Voice</button>' : ''}
      </div>

      ${m ? `
        <div class="stu-track on">
          <span class="stu-track-art material-symbols-rounded" style="background:linear-gradient(135deg, ${esc(a[0])}, ${esc(a[1])})">${m.voice ? 'mic' : 'music_note'}</span>
          <div class="stu-track-t"><b>${esc(m.title)}</b><span>${esc(m.artist || m.mood || 'Your audio')}${m.dur ? ' · ' + fmt(m.dur) : ''}</span></div>
          <button class="stu-x" onclick="STU.clearMusic()" aria-label="Remove ${esc(m.title)}"><span class="material-symbols-rounded">close</span></button>
        </div>
        ${m.voice ? '' : `
        <div class="stu-row-lbl">Part of the song<span class="stu-val" id="stu-wave-v">${trimLabel()}</span></div>
        <canvas class="stu-wave" id="stu-wave" role="slider" tabindex="0" aria-label="Which part of the song plays. Drag, or use the arrow keys."
          aria-valuemin="0" aria-valuemax="${Math.round(m.dur || 0)}" aria-valuenow="${Math.round(m.start || 0)}"></canvas>
        <div class="stu-wave-h">The lit part is as long as your reel (${fmt(tot)}) — drag it to pick the moment.${m.dur && m.dur < tot ? ' The song is shorter than the reel, so it repeats.' : ''}</div>`}
        <div class="stu-row-lbl">${m.voice ? 'Voiceover' : 'Music'} volume<span class="stu-val">${Math.round((m.vol == null ? 0.8 : m.vol) * 100)}%</span></div>
        <input class="stu-range" type="range" min="0" max="100" value="${Math.round((m.vol == null ? 0.8 : m.vol) * 100)}"
               oninput="STU.setMusicVol(this.value)" aria-label="Music volume">
      ` : '<div class="stu-none">No music yet. Browse Trending Originals, the SoundHelix demos, or add your own audio.</div>'}

      <div class="stu-row-lbl">Original audio<span class="stu-val" data-k="orig">${ov}%</span></div>
      <input class="stu-range" type="range" min="0" max="100" value="${ov}" oninput="STU.setOrigVol(this.value)" aria-label="Original audio volume">
      <input type="file" id="stu-audio-file" accept="audio/*" hidden>`;
  }

  function trimLabel() {
    const m = P.music;
    if (!m) return '';
    const len = m.dur ? Math.min(totalOut(), m.dur) : totalOut();
    const a = m.start || 0;
    return `${fmt(a)}–${fmt(a + len)}${m.dur ? ' of ' + fmt(m.dur) : ''}`;
  }

  /* The trimmer: the song's waveform with the part the reel plays lit.
     Drag it, or tap somewhere to jump the window there. */
  async function wireWave() {
    const cv = $('stu-wave');
    const m = P.music;
    if (!cv || !m || m.voice) return;
    let peaks = null;
    const len = () => (m.dur ? Math.min(totalOut(), m.dur) : totalOut());
    const maxStart = () => Math.max(0, (m.dur || 0) - len());
    const draw = () => {
      if (window.MUS) MUS.drawWave(cv, peaks, { start: m.start || 0, len: len(), dur: m.dur || 0 });
      const l = $('stu-wave-v'); if (l) l.textContent = trimLabel();
      cv.setAttribute('aria-valuenow', Math.round(m.start || 0));
      cv.setAttribute('aria-valuetext', trimLabel());
    };
    draw();

    cv.addEventListener('pointerdown', e => {
      if (!m.dur) return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      const r = cv.getBoundingClientRect();
      const x0 = e.clientX;
      const at = ((e.clientX - r.left) / r.width) * m.dur;
      let base = m.start || 0;
      if (at < base || at > base + len()) base = clamp(at - len() / 2, 0, maxStart());
      const move = ev => { setMusicStart(clamp(base + ((ev.clientX - x0) / r.width) * m.dur, 0, maxStart())); draw(); };
      move(e);
      const up = () => { cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); };
      cv.addEventListener('pointermove', move);
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
    });
    cv.addEventListener('keydown', e => {
      const k = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (!k || !m.dur) return;
      e.preventDefault();
      setMusicStart(clamp((m.start || 0) + k * (e.shiftKey ? 5 : 1), 0, maxStart()));
      draw();
    });

    if (window.MUS) {
      peaks = await MUS.peaksFor(m);
      if ($('stu-wave') === cv && P.music === m) draw();
    }
  }

  function openMusic() {
    if (!window.MUS) { toast('Music is still loading.'); return; }
    stopPreviewAudio();
    if (eng) eng.pause();
    MUS.open({
      host: $('stu-shell'),
      current: P.music && !P.music.voice ? P.music.id : null,
      onPick: (t, r) => setTrack(t, r),
      onVoiceover: () => { if (tool !== 'sound') setTool('sound'); voiceover(); },
      onNone: () => { clearMusic(); toast('Music removed'); }
    });
  }

  function setTrack(t, r) {
    stopPreviewAudio();
    P.music = {
      id: t.id, title: t.title, artist: t.artist, mood: t.mood, genre: t.genre, art: t.art, source: t.source,
      src: r.url, blob: r.blob || null, custom: !!r.blob, vol: 0.8, start: 0, dur: r.dur || 0
    };
    if (!P.music.dur && P.music.src) {
      const a = new Audio();
      a.preload = 'metadata';
      a.onloadedmetadata = () => {
        if (P.music && P.music.id === t.id) {
          P.music.dur = isFinite(a.duration) ? a.duration : 0;
          if (tool === 'sound') repaintPanel();
        }
      };
      a.src = P.music.src;
    }
    touch();
    if (tool !== 'sound') setTool('sound'); else repaintPanel();
    toast(`Added “${t.title}”`);
  }

  function setOrigVol(v) {
    P.origVol = clamp(Number(v) / 100, 0, 1);
    const el = $('stu-v');
    if (el) el.volume = P.origVol;
    const lbl = document.querySelector('.stu-panel .stu-val[data-k="orig"]');
    if (lbl) lbl.textContent = Math.round(P.origVol * 100) + '%';
  }

  function useMusic(id) {
    const t = MUSIC.find(x => x.id === id);
    if (!t) return;
    stopPreviewAudio();
    P.music = { id: t.id, title: t.title, mood: t.mood, src: t.src, vol: 0.8, start: 0, dur: 0 };
    // Learn the real length so the "start at" slider has a sane range.
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      if (P.music && P.music.id === id) {
        P.music.dur = isFinite(a.duration) ? a.duration : 0;
        if (tool === 'sound') repaintPanel();
      }
    };
    a.src = t.src;
    touch();
    repaintPanel();
    toast('Music added');
  }

  function setMusicVol(v) { if (P.music) { P.music.vol = clamp(Number(v) / 100, 0, 1); const m = $('stu-music'); if (m) m.volume = P.music.vol; } }
  function setMusicStart(v) {
    if (!P.music) return;
    P.music.start = Number(v) || 0;
    const m = $('stu-music');
    if (m && eng) { try { m.currentTime = P.music.start + eng.time; } catch (e) {} }
  }
  function clearMusic() {
    P.music = null;
    const m = $('stu-music');
    if (m) { try { m.pause(); m.removeAttribute('src'); } catch (e) {} }
    touch();
    repaintPanel();
  }

  function previewMusic(id, btn) {
    const t = MUSIC.find(x => x.id === id);
    if (!t) return;
    const playing = previewAudio && previewAudio.dataset.id === id && !previewAudio.paused;
    stopPreviewAudio();
    if (playing) return;
    previewAudio = new Audio(t.src);
    previewAudio.dataset.id = id;
    previewAudio.volume = 0.85;
    previewAudio.play().catch(() => toast('Could not load that track.'));
    if (btn) btn.textContent = 'pause';
    if (eng) eng.pause();
  }

  function stopPreviewAudio() {
    if (previewAudio) { try { previewAudio.pause(); } catch (e) {} previewAudio = null; }
    document.querySelectorAll('.stu-track-p').forEach(b => { b.textContent = 'play_arrow'; });
  }

  function importAudio() {
    const f = $('stu-audio-file');
    if (!f) return;
    f.onchange = async () => {
      const file = f.files && f.files[0];
      f.value = '';
      if (!file) return;
      if (!file.type.startsWith('audio/')) { toast('That is not an audio file.'); return; }
      if (file.size > 30 * 1024 * 1024) { toast('Audio over 30 MB is too big to keep on the device.'); return; }
      const url = URL.createObjectURL(file);
      P.music = { id: uid('m'), title: file.name.replace(/\.[a-z0-9]+$/i, ''), mood: 'Your audio', src: url, blob: file, custom: true, vol: 0.85, start: 0, dur: 0 };
      const a = new Audio();
      a.onloadedmetadata = () => { if (P.music && P.music.custom) { P.music.dur = isFinite(a.duration) ? a.duration : 0; if (tool === 'sound') repaintPanel(); } };
      a.src = url;
      touch();
      repaintPanel();
    };
    f.click();
  }

  /* Voiceover: record the mic over the reel and mix it in on playback. */
  async function voiceover() {
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast('This browser cannot record audio.'); return; }
    const btn = $('stu-vo');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { toast('Microphone access was blocked.'); return; }

    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      P.voice = { id: uid('vo'), url, blob, vol: 1 };
      // The voiceover replaces the music slot — one extra track is enough.
      P.music = { id: P.voice.id, title: 'Your voiceover', mood: 'Recorded here', src: url, blob, custom: true, voice: true, vol: 1, start: 0, dur: 0 };
      touch();
      repaintPanel();
      toast('Voiceover added');
    };

    if (eng) { eng.restart(true); }
    rec.start();
    if (btn) { btn.classList.add('rec'); btn.innerHTML = '<span class="material-symbols-rounded">stop_circle</span>Stop'; }
    const stop = () => { if (rec.state !== 'inactive') rec.stop(); };
    const total = eng ? eng.total : 15;
    setTimeout(stop, Math.min(total, MAX_SECONDS) * 1000 + 400);
    if (btn) btn.onclick = stop;
  }

  function clearVoice() {
    if (P.voice && P.voice.url) orphans.add(P.voice.url);
    if (P.music && P.music.voice) P.music = null;
    P.voice = null;
    touch();
    repaintPanel();
  }

  /* — Text ————————————————————————————————————————————————— */

  function textPanel() {
    const cur = selNode && selNode.kind === 'text' ? P.texts.find(t => t.id === selNode.id) : null;
    const tot = totalOut();
    return `
      <button class="stu-big" onclick="STU.addText()"><span class="material-symbols-rounded">add</span>Add text</button>
      ${P.texts.length ? `<div class="stu-layers">
        ${P.texts.map(t => `<button class="stu-layer${cur && cur.id === t.id ? ' on' : ''}" onclick="STU.pickNode('text','${t.id}')">
          <span class="stu-layer-t" style="color:${esc(t.color)}">${esc(t.text.slice(0, 22) || 'Text')}</span>
          <span class="stu-layer-w">${fmt(t.start || 0)}–${fmt(t.end || tot)}</span>
        </button>`).join('')}
      </div>` : '<div class="stu-none">No text yet. Add a line, then drag it where you want it.</div>'}

      ${cur ? `
        <input class="stu-input" id="stu-text-in" value="${esc(cur.text)}" oninput="STU.setText(this.value)" placeholder="Type something">
        <div class="stu-row-lbl">Font</div>
        <div class="stu-chips">${FONTS.map(f => `<button class="stu-chip${cur.font === f.k ? ' on' : ''}" style="font-family:${f.css}" onclick="STU.setTextProp('font','${f.k}')">${f.n}</button>`).join('')}</div>
        <div class="stu-row-lbl">Colour</div>
        <div class="stu-swatches">${COLORS.map(c => `<button class="stu-sw${cur.color === c ? ' on' : ''}" style="background:${c}" onclick="STU.setTextProp('color','${c}')" aria-label="${c}"></button>`).join('')}</div>
        <div class="stu-row-lbl">Style</div>
        <div class="stu-chips">
          ${[['plain', 'Plain'], ['shade', 'Shaded'], ['solid', 'Filled']].map(([k, n]) =>
            `<button class="stu-chip${cur.bg === k ? ' on' : ''}" onclick="STU.setTextProp('bg','${k}')">${n}</button>`).join('')}
        </div>
        <div class="stu-row-lbl">Size<span class="stu-val">${cur.size}px</span></div>
        <input class="stu-range" type="range" min="12" max="72" value="${cur.size}" oninput="STU.setTextProp('size',+this.value)">
        <div class="stu-row-lbl">Appears<span class="stu-val">${fmt(cur.start || 0)} → ${fmt(cur.end || tot)}</span></div>
        <input class="stu-range" type="range" min="0" max="${Math.max(1, Math.ceil(tot * 10))}" value="${Math.round((cur.start || 0) * 10)}" oninput="STU.setTiming('start',this.value/10)">
        <input class="stu-range" type="range" min="0" max="${Math.max(1, Math.ceil(tot * 10))}" value="${Math.round((cur.end || tot) * 10)}" oninput="STU.setTiming('end',this.value/10)">
        <div class="stu-acts">
          <button class="stu-act" onclick="STU.dupNode()"><span class="material-symbols-rounded">content_copy</span>Duplicate</button>
          <button class="stu-act danger" onclick="STU.delNode()"><span class="material-symbols-rounded">delete</span>Delete</button>
        </div>
      ` : ''}`;
  }

  const nextY = () => clamp(38 + (P.texts.length + P.stickers.length) * 9, 20, 78);

  function addText() {
    const t = {
      id: uid('t'), text: 'Tap to edit', x: 50, y: nextY(), size: 30,
      color: '#FFFFFF', font: 'classic', bg: 'plain', start: 0, end: 0
    };
    P.texts.push(t);
    selNode = { kind: 'text', id: t.id };
    touch();
    repaintPanel();
    setTimeout(() => { const i = $('stu-text-in'); if (i) { i.focus(); i.select(); } }, 30);
  }

  function editText(id) {
    selNode = { kind: 'text', id };
    tool = 'text';
    paint();
  }

  function pickNode(kind, id) {
    selNode = { kind, id };
    stkForm = null;
    markSelection();
    repaintPanel();
  }

  function setText(v) {
    const t = P.texts.find(x => selNode && x.id === selNode.id);
    if (!t) return;
    t.text = v;
    const node = document.querySelector(`.stu-node[data-id="${t.id}"]`);
    if (node) node.textContent = v;
  }

  function setTextProp(k, v) {
    const t = P.texts.find(x => selNode && x.id === selNode.id);
    if (!t) return;
    t[k] = v;
    touch();
    repaintPanel();
  }

  function setTiming(which, v) {
    const list = selNode && selNode.kind === 'text' ? P.texts : P.stickers;
    const item = list.find(x => selNode && x.id === selNode.id);
    if (!item) return;
    const tot = totalOut();
    v = clamp(Number(v) || 0, 0, tot);
    if (which === 'start') item.start = Math.min(v, (item.end || tot) - 0.2);
    else item.end = Math.max(v, (item.start || 0) + 0.2);
    const lbl = document.querySelectorAll('.stu-panel .stu-val');
    if (lbl.length) lbl[lbl.length - 1].textContent = `${fmt(item.start || 0)} → ${fmt(item.end || tot)}`;
    touch();
  }

  function delNode() {
    if (!selNode) return;
    if (selNode.kind === 'text') P.texts = P.texts.filter(t => t.id !== selNode.id);
    else P.stickers = P.stickers.filter(s => s.id !== selNode.id);
    selNode = null;
    stkForm = null;
    touch();
    repaintPanel();
  }

  /* — Stickers ——————————————————————————————————————————————— */

  const EMOJI_KW = {
    '🔥': 'fire hot lit', '💜': 'heart purple love', '😂': 'laugh lol funny', '😍': 'love eyes heart', '🤯': 'mind blown wow',
    '👀': 'eyes look see', '✨': 'sparkle magic shine', '💯': 'hundred perfect', '🙌': 'hands yay praise', '👏': 'clap applause',
    '🚀': 'rocket launch moon', '📈': 'chart up pump bull', '📉': 'chart down dump', '🪙': 'coin crypto money', '💎': 'diamond gem',
    '🧠': 'brain smart', '⚡': 'lightning fast energy', '🌙': 'moon night', '☀️': 'sun day summer', '🌊': 'wave ocean sea',
    '🎧': 'music headphones', '🎬': 'film movie action', '📷': 'camera photo', '🕶️': 'cool sunglasses', '👟': 'shoe run sneaker',
    '🍜': 'food noodles', '☕': 'coffee morning', '🏆': 'trophy win', '❤️‍🔥': 'heart fire love', '🫶': 'heart hands love',
    '😎': 'cool', '🥹': 'cute touched', '🤝': 'deal handshake', '🎉': 'party celebrate', '💃': 'dance', '🕺': 'dance',
    '🐂': 'bull market', '🐻': 'bear market', '⏰': 'alarm time clock', '📍': 'pin location place'
  };
  const TOOL_KW = {
    captions: 'caption subtitles auto speech words text', mention: 'mention tag person @ user people', hashtag: 'hashtag tag #',
    location: 'location place map pin where', time: 'time clock now', date: 'date calendar today', day: 'day weekday',
    music: 'music song audio track', link: 'link url website', poll: 'poll vote ask choice', quiz: 'quiz answer test question',
    question: 'question ask answer q&a', countdown: 'countdown timer launch event date'
  };
  const toolTiles = () => [['captions', 'Captions', 'closed_caption']]
    .concat(window.STK ? Object.keys(STK.KINDS).map(k => [k, STK.KINDS[k].n, STK.KINDS[k].icon]) : []);

  function stickerGallery() {
    const q = stkQ.trim().toLowerCase();
    const hit = words => !q || words.toLowerCase().includes(q);
    const tiles = toolTiles().filter(([k, n]) => hit(n + ' ' + (TOOL_KW[k] || '')));
    const emo = STICKERS.filter(e => hit(e + ' ' + (EMOJI_KW[e] || '')));
    const noMusic = !(P.music && !P.music.voice);
    return `${tiles.length ? `<div class="stu-stk-tools">${tiles.map(([k, n, i]) => `
        <button class="stu-stk-tool${k === 'music' && noMusic ? ' off' : ''}" onclick="STU.stkNew('${k}')"${k === 'music' && noMusic ? ' title="Add a song in Sound first"' : ''}>
          <span class="material-symbols-rounded">${i}</span>${esc(n)}</button>`).join('')}</div>` : ''}
      ${emo.length ? `<div class="stu-row-lbl">Emoji</div><div class="stu-emoji">${emo.map(e => `<button class="stu-em" onclick="STU.addSticker('${e}')" aria-label="Add ${esc(EMOJI_KW[e] || 'emoji')} sticker">${e}</button>`).join('')}</div>` : ''}
      ${!tiles.length && !emo.length ? `<div class="stu-none">No stickers match “${esc(stkQ.trim())}”.</div>` : ''}`;
  }

  function stkSearch(v) {
    stkQ = v;
    const g = $('stu-stk-gal');
    if (g) g.innerHTML = stickerGallery();
  }

  function stickerPanel() {
    if (stkForm && window.STK) return stkFormHTML();
    const cur = selNode && selNode.kind === 'sticker' ? P.stickers.find(s => s.id === selNode.id) : null;
    const tot = totalOut();
    const kind = cur && window.STK ? STK.KINDS[cur.kind] : null;
    const editable = cur && ['poll', 'quiz', 'question', 'countdown', 'location', 'hashtag', 'link', 'mention'].indexOf(cur.kind) > -1;
    const [lo, hi] = kind ? [12, 48] : [20, 140];
    return `
      ${cur ? `
        <div class="stu-row-lbl">Selected ${kind ? esc(kind.n.toLowerCase()) : esc(cur.emoji || '')}<span class="stu-val" data-k="size">${cur.size}px</span></div>
        <input class="stu-range" type="range" min="${lo}" max="${hi}" value="${cur.size}" oninput="STU.setSticker('size',+this.value)" aria-label="Size">
        ${kind ? `<div class="stu-row-lbl">Style</div>
          <div class="stu-chips">${STK.STYLES.map(([k, n]) => `<button class="stu-chip${((cur.d || {}).style || 'light') === k ? ' on' : ''}" onclick="STU.setSticker('style','${k}')">${n}</button>`).join('')}</div>`
        : window.STK ? `<div class="stu-row-lbl">Motion</div>
          <div class="stu-chips">${STK.ANIMS.map(([k, n]) => `<button class="stu-chip${(cur.anim || 'none') === k ? ' on' : ''}" onclick="STU.setSticker('anim','${k}')">${n}</button>`).join('')}</div>` : ''}
        <div class="stu-row-lbl">Rotate<span class="stu-val" data-k="rot">${cur.rot || 0}°</span></div>
        <input class="stu-range" type="range" min="-180" max="180" value="${cur.rot || 0}" oninput="STU.setSticker('rot',+this.value)" aria-label="Rotate">
        <div class="stu-row-lbl">Appears<span class="stu-val">${fmt(cur.start || 0)} → ${fmt(cur.end || tot)}</span></div>
        <input class="stu-range" type="range" min="0" max="${Math.max(1, Math.ceil(tot * 10))}" value="${Math.round((cur.start || 0) * 10)}" oninput="STU.setTiming('start',this.value/10)" aria-label="Appears from">
        <input class="stu-range" type="range" min="0" max="${Math.max(1, Math.ceil(tot * 10))}" value="${Math.round((cur.end || tot) * 10)}" oninput="STU.setTiming('end',this.value/10)" aria-label="Appears until">
        <div class="stu-acts">
          ${editable ? '<button class="stu-act" onclick="STU.stkEdit()"><span class="material-symbols-rounded">edit</span>Edit</button>' : ''}
          <button class="stu-act" onclick="STU.dupNode()"><span class="material-symbols-rounded">content_copy</span>Duplicate</button>
          <button class="stu-act danger" onclick="STU.delNode()"><span class="material-symbols-rounded">delete</span>Remove</button>
        </div>
        <div class="stu-row-lbl stu-add-more">Add another</div>
      ` : ''}
      <input class="stu-input" id="stu-stk-q" type="search" value="${esc(stkQ)}" placeholder="Search stickers — poll, quiz, 🔥, music…" oninput="STU.stkSearch(this.value)" aria-label="Search stickers">
      <div id="stu-stk-gal">${stickerGallery()}</div>`;
  }

  const STK_NEW = {
    poll:      () => ({ q: '', opts: ['Yes', 'No'], style: 'light' }),
    quiz:      () => ({ q: '', opts: ['', '', ''], ans: 0, style: 'light' }),
    question:  () => ({ q: 'Ask me a question', style: 'light' }),
    countdown: () => ({ title: '', at: 0, style: 'light' }),
    location:  () => ({ place: P.place || '', style: 'light' }),
    hashtag:   () => ({ tag: '', style: 'light' }),
    link:      () => ({ url: 'https://', label: '', style: 'light' }),
    mention:   () => ({ handle: '', name: '', style: 'light', find: '' })
  };

  function localInput(ts) {
    const d = new Date(ts);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function stkNew(kind) {
    if (kind === 'captions') { setTool('captions'); return; }
    if (!window.STK || !STK.KINDS[kind]) return;
    const now = new Date();
    if (kind === 'time') return placeSticker(kind, { text: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), style: 'light' });
    if (kind === 'date') return placeSticker(kind, { text: now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }), style: 'light' });
    if (kind === 'day') return placeSticker(kind, { text: now.toLocaleDateString([], { weekday: 'long' }), style: 'light' });
    if (kind === 'music') {
      if (!P.music || P.music.voice) { toast('Add a song in Sound first, then its sticker.'); return; }
      return placeSticker(kind, { title: P.music.title, artist: P.music.artist || '', style: 'dark' });
    }
    stkForm = { kind, d: STK_NEW[kind](), edit: null };
    repaintPanel();
    setTimeout(() => { const f = document.querySelector('.stu-form input'); if (f) f.focus(); }, 30);
  }

  function placeSticker(kind, d) {
    const s = { id: uid('s'), kind, d, x: 50, y: nextY(), size: kind === 'poll' || kind === 'quiz' ? 19 : 22, rot: 0, start: 0, end: 0 };
    P.stickers.push(s);
    selNode = { kind: 'sticker', id: s.id };
    stkForm = null;
    touch();
    repaintPanel();
  }

  function mentionList(q) {
    q = String(q || '').trim().toLowerCase().replace(/^@/, '');
    const people = (typeof DATA !== 'undefined' && DATA.users) ? DATA.users : [];
    const list = people.filter(u => !q || u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q)).slice(0, 8);
    return list.length ? list.map(u => `<button class="stu-person" onclick="STU.stkPerson('${esc(u.handle)}')">
        <span class="stu-person-a">${esc(u.name.split(' ').map(w => w[0]).join('').slice(0, 2))}</span><b>${esc(u.name)}</b><span>${esc(u.handle)}</span></button>`).join('')
      : '<div class="stu-none">Nobody matches that.</div>';
  }

  function stkFormHTML() {
    const f = stkForm, d = f.d, k = STK.KINDS[f.kind];
    const inp = (key, ph, val, extra) => `<input class="stu-input" ${extra || ''} value="${esc(val == null ? '' : val)}" placeholder="${esc(ph)}" oninput="STU.stkField('${key}', this.value)">`;
    let body = '';
    if (f.kind === 'poll' || f.kind === 'quiz') {
      body = inp('q', f.kind === 'quiz' ? 'A question with one right answer' : 'Ask a question', d.q, 'maxlength="80" aria-label="Question"') +
        `<div class="stu-row-lbl">Options${f.kind === 'quiz' ? '<span class="stu-val">tick the right one</span>' : ''}</div>` +
        d.opts.map((o, i) => `<div class="stu-optrow">
          ${f.kind === 'quiz' ? `<button class="stu-tick${d.ans === i ? ' on' : ''}" onclick="STU.stkField('ans', ${i}, true)" aria-pressed="${d.ans === i}" aria-label="Option ${i + 1} is the right answer"><span class="material-symbols-rounded">${d.ans === i ? 'check_circle' : 'radio_button_unchecked'}</span></button>` : ''}
          <input class="stu-input" value="${esc(o)}" maxlength="40" placeholder="Option ${i + 1}" oninput="STU.stkOpt(${i}, this.value)" aria-label="Option ${i + 1}">
          ${d.opts.length > 2 ? `<button class="stu-x" onclick="STU.stkDelOpt(${i})" aria-label="Remove option ${i + 1}"><span class="material-symbols-rounded">close</span></button>` : ''}
        </div>`).join('') +
        (d.opts.length < 4 ? '<button class="stu-act" onclick="STU.stkAddOpt()"><span class="material-symbols-rounded">add</span>Add option</button>' : '') +
        `<div class="stu-note">${f.kind === 'poll' ? 'Viewers tap an option to vote. Votes are counted on this device.' : 'Viewers tap an answer and see straight away whether they were right.'}</div>`;
    } else if (f.kind === 'question') {
      body = inp('q', 'Ask me a question', d.q, 'maxlength="80" aria-label="Question"');
    } else if (f.kind === 'countdown') {
      body = inp('title', 'What are you counting down to?', d.title, 'maxlength="40" aria-label="Name"') +
        `<div class="stu-row-lbl">Ends</div>
         <input class="stu-input" type="datetime-local" value="${d.at ? localInput(d.at) : ''}" min="${localInput(Date.now() + 60000)}" onchange="STU.stkField('at', this.value)" aria-label="When it ends">`;
    } else if (f.kind === 'location') {
      body = inp('place', 'Where is this?', d.place, 'maxlength="40" aria-label="Place"');
    } else if (f.kind === 'hashtag') {
      const top = window.HT ? [...HT.index().count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]) : [];
      body = inp('tag', '#yourtag', d.tag, 'maxlength="40" aria-label="Hashtag"') +
        (top.length ? `<div class="stu-row-lbl">Popular on Trending</div><div class="stu-chips">${top.map(t =>
          `<button class="stu-chip" onclick="STU.stkField('tag','${esc(t)}'); STU.stkSave()">#${esc(t)}</button>`).join('')}</div>` : '');
    } else if (f.kind === 'link') {
      body = inp('url', 'https://', d.url, 'type="url" inputmode="url" maxlength="300" aria-label="Web address"') +
        inp('label', 'Label (optional)', d.label, 'maxlength="30" aria-label="Label"') +
        '<div class="stu-note">Only secure https links. Viewers open them in a new tab.</div>';
    } else if (f.kind === 'mention') {
      body = `<input class="stu-input" value="${esc(d.find)}" placeholder="Search people" oninput="STU.stkMention(this.value)" aria-label="Search people">
        <div class="stu-people stu-people-pick" id="stu-stk-people">${mentionList(d.find)}</div>`;
    }
    return `<div class="stu-form">
      <div class="stu-form-h"><span class="material-symbols-rounded">${k.icon}</span><b>${f.edit ? 'Edit' : 'Add a'} ${esc(k.n.toLowerCase())}</b>
        <button class="stu-x" onclick="STU.stkCancel()" aria-label="Cancel"><span class="material-symbols-rounded">close</span></button></div>
      ${body}
      ${f.kind === 'mention' ? '' : `<button class="stu-big" onclick="STU.stkSave()"><span class="material-symbols-rounded">${f.edit ? 'check' : 'add'}</span>${f.edit ? 'Save changes' : 'Add to reel'}</button>`}
    </div>`;
  }

  function stkField(k, v, repaint) {
    if (!stkForm) return;
    if (k === 'ans') stkForm.d.ans = Number(v) || 0;
    else if (k === 'at') stkForm.d.at = v ? new Date(v).getTime() : 0;
    else stkForm.d[k] = v;
    if (repaint) repaintPanel();
  }
  function stkOpt(i, v) { if (stkForm) stkForm.d.opts[i] = v; }
  function stkAddOpt() { if (stkForm && stkForm.d.opts.length < 4) { stkForm.d.opts.push(''); repaintPanel(); } }
  function stkDelOpt(i) {
    if (!stkForm || stkForm.d.opts.length <= 2) return;
    stkForm.d.opts.splice(i, 1);
    if (stkForm.d.ans != null && stkForm.d.ans >= stkForm.d.opts.length) stkForm.d.ans = 0;
    repaintPanel();
  }
  function stkMention(v) {
    if (!stkForm) return;
    stkForm.d.find = v;
    const el = $('stu-stk-people');
    if (el) el.innerHTML = mentionList(v);
  }
  function stkPerson(handle) {
    const u = ((typeof DATA !== 'undefined' && DATA.users) || []).find(x => x.handle === handle);
    if (!u || !stkForm) return;
    stkForm.d.handle = u.handle;
    stkForm.d.name = u.name;
    stkSave();
  }
  function stkCancel() { stkForm = null; repaintPanel(); }
  function stkEdit() {
    const cur = selNode && P.stickers.find(s => s.id === selNode.id);
    if (!cur || !cur.kind) return;
    stkForm = { kind: cur.kind, d: JSON.parse(JSON.stringify(cur.d || {})), edit: cur.id };
    if (cur.kind === 'mention') stkForm.d.find = '';
    repaintPanel();
  }

  function stkSave() {
    const f = stkForm;
    if (!f) return false;
    const d = f.d;
    const no = m => { toast(m); return false; };
    const has = v => !!String(v || '').trim();
    if (f.kind === 'poll' || f.kind === 'quiz') {
      if (!has(d.q)) return no('Add the question.');
      const right = f.kind === 'quiz' ? String(d.opts[d.ans] || '').trim() : '';
      const opts = d.opts.map(o => String(o || '').trim()).filter(Boolean);
      if (opts.length < 2) return no('Add at least two options.');
      if (f.kind === 'quiz' && !right) return no('Tick the right answer — and give it some text.');
      d.q = d.q.trim(); d.opts = opts;
      if (f.kind === 'quiz') d.ans = opts.indexOf(right);
    }
    if (f.kind === 'question' && !has(d.q)) d.q = 'Ask me a question';
    if (f.kind === 'countdown') {
      if (!has(d.title)) return no('Name what you are counting down to.');
      if (!d.at || d.at <= Date.now()) return no('Pick a time in the future.');
    }
    if (f.kind === 'location' && !has(d.place)) return no('Add a place.');
    if (f.kind === 'hashtag') {
      const t = String(d.tag || '').replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '');
      if (t.length < 2) return no('A hashtag needs at least two letters or numbers.');
      d.tag = t;
    }
    if (f.kind === 'link') {
      const u = window.STK ? STK.safeUrl(d.url) : '';
      if (!u) return no('Links must be a full https:// address.');
      d.url = u;
      d.label = String(d.label || '').trim().slice(0, 30);
    }
    if (f.kind === 'mention') {
      if (!d.handle) return no('Pick someone to mention.');
      delete d.find;
    }
    if (f.edit) {
      const cur = P.stickers.find(x => x.id === f.edit);
      if (cur) cur.d = d;
      selNode = { kind: 'sticker', id: f.edit };
      stkForm = null;
      touch();
      repaintPanel();
    } else placeSticker(f.kind, d);
    return true;
  }

  function dupNode() {
    if (!selNode) return;
    const list = selNode.kind === 'text' ? P.texts : P.stickers;
    const src = list.find(x => x.id === selNode.id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid(selNode.kind === 'text' ? 't' : 's');
    copy.x = clamp((src.x || 50) + 6, 4, 96);
    copy.y = clamp((src.y || 50) + 6, 4, 96);
    list.push(copy);
    selNode = { kind: selNode.kind, id: copy.id };
    touch();
    repaintPanel();
  }

  function addSticker(e) {
    const s = { id: uid('s'), emoji: e, x: 50, y: nextY(), size: 64, rot: 0, start: 0, end: 0 };
    P.stickers.push(s);
    selNode = { kind: 'sticker', id: s.id };
    touch();
    repaintPanel();
  }

  function setSticker(k, v) {
    const s = P.stickers.find(x => selNode && x.id === selNode.id);
    if (!s) return;
    if (k === 'style') { s.d = Object.assign({}, s.d, { style: v }); touch(); repaintPanel(); return; }
    if (k === 'anim') { s.anim = v; touch(); repaintPanel(); return; }
    s[k] = v;
    touch();
    const lbl = document.querySelector(`.stu-panel .stu-val[data-k="${k}"]`);
    if (lbl) lbl.textContent = k === 'size' ? v + 'px' : v + '°';
  }

  /* — Captions ———————————————————————————————————————————————— */

  function capStatusHTML() {
    if (capBusy) {
      return `<div class="stu-cap-busy"><span class="material-symbols-rounded stu-spin">progress_activity</span><span>${esc(capBusy.label)}</span></div>
        ${capBusy.pct >= 0 ? `<div class="stu-cap-bar"><i style="width:${capBusy.pct}%"></i></div>` : ''}`;
    }
    return capNote ? `<div class="stu-cap-note">${esc(capNote)}</div>` : '';
  }
  function paintCapStatus() {
    const el = $('stu-cap-status');
    if (el) el.innerHTML = capStatusHTML();
    const b = $('stu-cap-go');
    if (b) b.disabled = !!capBusy;
  }

  function captionsPanel() {
    const c = P.captions;
    const segs = c && Array.isArray(c.segs) ? c.segs : [];
    const langs = window.CAP ? CAP.LANGS : [['', 'Detect automatically']];
    const mb = window.CAP ? CAP.MODEL_MB : 41;
    if (!segs.length) {
      return `
        <div class="stu-cap-intro">
          <span class="material-symbols-rounded">closed_caption</span>
          <div><b>Captions</b><p>Turn what is said in your reel into captions that appear in time with the words. Fix any word and restyle them after.</p></div>
        </div>
        <div class="stu-row-lbl">Spoken language</div>
        <select class="stu-select wide" onchange="STU.capLang(this.value)" aria-label="Spoken language">
          ${langs.map(([v, n]) => `<option value="${v}"${capLang === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}
        </select>
        <button class="stu-big" id="stu-cap-go" onclick="STU.autoCaptions()"${capBusy ? ' disabled' : ''}><span class="material-symbols-rounded">auto_awesome</span>Auto-generate captions</button>
        <div class="stu-cap-status" id="stu-cap-status" aria-live="polite">${capStatusHTML()}</div>
        <button class="stu-act wide" onclick="STU.addCapLine()"><span class="material-symbols-rounded">edit_note</span>Write them yourself</button>
        <div class="stu-note">Runs on this device. The first time, it downloads a speech model (about ${mb} MB) from Hugging Face, which your browser keeps for next time. Your audio is not uploaded anywhere.</div>`;
    }
    const st = Object.assign({}, CAP_STYLE, c.style || {});
    return `
      <div class="stu-row-lbl">Position</div>
      <div class="stu-chips">${[['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']].map(([k, n]) =>
        `<button class="stu-chip${st.pos === k ? ' on' : ''}" onclick="STU.capStyle('pos','${k}')">${n}</button>`).join('')}</div>
      <div class="stu-row-lbl">Style</div>
      <div class="stu-chips">${[['plain', 'Plain'], ['shade', 'Shaded'], ['solid', 'Filled']].map(([k, n]) =>
        `<button class="stu-chip${st.bg === k ? ' on' : ''}" onclick="STU.capStyle('bg','${k}')">${n}</button>`).join('')}</div>
      <div class="stu-row-lbl">Font</div>
      <div class="stu-chips">${FONTS.map(f => `<button class="stu-chip${st.font === f.k ? ' on' : ''}" style="font-family:${f.css}" onclick="STU.capStyle('font','${f.k}')">${f.n}</button>`).join('')}</div>
      <div class="stu-row-lbl">Colour</div>
      <div class="stu-swatches">${COLORS.map(col => `<button class="stu-sw${st.color === col ? ' on' : ''}" style="background:${col}" onclick="STU.capStyle('color','${col}')" aria-label="${col}"></button>`).join('')}</div>
      <div class="stu-row-lbl">Size<span class="stu-val">${st.size}px</span></div>
      <input class="stu-range" type="range" min="14" max="40" value="${st.size}" onchange="STU.capStyle('size', +this.value)" aria-label="Caption size">
      <div class="stu-row-lbl">Lines<span class="stu-val">${segs.length} · tap a time to jump there</span></div>
      <div class="stu-caps">${segs.map((g, i) => `
        <div class="stu-cap-line">
          <button class="stu-cap-t" onclick="STU.capSeek(${i})" aria-label="Play from ${fmtMs(g.t0)}">${fmtMs(g.t0)}</button>
          <input class="stu-input" value="${esc(g.text)}" maxlength="120" oninput="STU.capText(${i}, this.value)" aria-label="Caption line ${i + 1}">
          <button class="stu-x" onclick="STU.capDel(${i})" aria-label="Delete line ${i + 1}"><span class="material-symbols-rounded">close</span></button>
        </div>`).join('')}</div>
      <div class="stu-acts">
        <button class="stu-act" onclick="STU.addCapLine()"><span class="material-symbols-rounded">add</span>Line here</button>
        <button class="stu-act" onclick="STU.autoCaptions(true)"${capBusy ? ' disabled' : ''}><span class="material-symbols-rounded">refresh</span>Redo</button>
        <button class="stu-act danger" onclick="STU.capClear()"><span class="material-symbols-rounded">delete</span>Remove all</button>
      </div>
      <div class="stu-cap-status" id="stu-cap-status" aria-live="polite">${capStatusHTML()}</div>`;
  }

  const capLangSet = v => { capLang = v || ''; };

  async function autoCaptions() {
    if (capBusy) return;
    if (!window.CAP) { toast('Captions are still loading.'); return; }
    if (!P.clips.some(c => !c.mute && c.blob) && !(P.music && P.music.voice)) {
      capNote = 'Every clip is muted, so there is nothing to listen to.';
      paintCapStatus();
      return;
    }
    capNote = '';
    capBusy = { label: CAP.ready() ? 'Getting ready…' : 'Downloading the speech model…', pct: CAP.ready() ? -1 : 0 };
    paintCapStatus();
    if (eng) eng.pause();
    try {
      const segs = await CAP.transcribe(P, {
        lang: capLang,
        onProgress: p => {
          if (p.stage === 'download') capBusy = { label: `Downloading the speech model… ${p.pct}%`, pct: p.pct };
          else if (p.stage === 'listen') capBusy = { label: p.label, pct: -1 };
          else return;
          paintCapStatus();
        }
      });
      capBusy = null;
      if (!segs.length) {
        capNote = 'No speech was found in this reel. You can write captions yourself.';
        paintCapStatus();
        return;
      }
      P.captions = { segs, style: Object.assign({}, CAP_STYLE, (P.captions && P.captions.style) || {}), lang: capLang, auto: true };
      touch();
      if (tool === 'captions') repaintPanel();
      toast(`${segs.length} caption line${segs.length === 1 ? '' : 's'} added — tap any to fix a word`);
    } catch (e) {
      capBusy = null;
      capNote = navigator.onLine === false
        ? 'You are offline, and the speech model has not been downloaded yet.'
        : 'Captions could not run in this browser (' + String((e && e.message) || e).slice(0, 90) + '). You can write them yourself.';
      if (tool === 'captions') repaintPanel(); else paintCapStatus();
    }
  }

  function capSegs() {
    if (!P.captions) P.captions = { segs: [], style: Object.assign({}, CAP_STYLE), lang: capLang, auto: false };
    return P.captions.segs;
  }

  function addCapLine() {
    const segs = capSegs();
    const tot = totalOut();
    let t = clamp(eng ? eng.time : 0, 0, Math.max(0, tot - 0.3));
    // Start where the line on screen ends, so two lines never overlap.
    for (const g of segs.slice().sort((a, b) => a.t0 - b.t0)) if (t >= g.t0 - 0.05 && t < g.t1) t = g.t1;
    t = Math.min(t, Math.max(0, tot - 0.3));
    const next = segs.filter(g => g.t0 > t + 0.05).sort((a, b) => a.t0 - b.t0)[0];
    const end = Math.min(tot, t + 2.5, next ? next.t0 : tot);
    const seg = { id: uid('cl'), t0: Math.round(t * 10) / 10, t1: Math.round(Math.max(end, t + 0.3) * 10) / 10, text: 'New caption' };
    segs.push(seg);
    segs.sort((a, b) => a.t0 - b.t0);
    touch();
    if (tool !== 'captions') setTool('captions'); else repaintPanel();
    setTimeout(() => {
      const i = P.captions.segs.indexOf(seg);
      const box = document.querySelectorAll('.stu-cap-line .stu-input')[i];
      if (box) { box.focus(); box.select(); }
    }, 40);
  }

  function capText(i, v) {
    const g = P.captions && P.captions.segs[i];
    if (!g) return;
    g.text = v;
    const node = document.querySelector(`.stu-cap[data-id="${g.id}"]`);
    if (node) node.textContent = v;
  }
  function capSeek(i) {
    const g = P.captions && P.captions.segs[i];
    if (g && eng) { eng.seek(g.t0 + 0.01); eng.play(); }
  }
  function capDel(i) {
    if (!P.captions) return;
    P.captions.segs.splice(i, 1);
    if (!P.captions.segs.length) P.captions = null;
    touch();
    repaintPanel();
  }
  function capClear() { P.captions = null; capNote = ''; touch(); repaintPanel(); }
  function capStyle(k, v) {
    if (!P.captions) return;
    P.captions.style = Object.assign({}, CAP_STYLE, P.captions.style || {}, { [k]: v });
    touch();
    repaintPanel();
  }

  /* — Undo / redo —————————————————————————————————————————————— */

  /* The edit only: clips, look, overlays, captions, sound, cover. The
     caption, tags and audience on the share screen are text fields, and
     text fields undo themselves. */
  function editState(from) {
    const x = from || P;
    return {
      clips: x.clips.map(c => ({ ...c })),
      filter: x.filter,
      adj: { ...x.adj },
      texts: x.texts.map(t => ({ ...t })),
      stickers: x.stickers.map(t => ({ ...t, d: t.d ? JSON.parse(JSON.stringify(t.d)) : t.d })),
      captions: x.captions ? JSON.parse(JSON.stringify(x.captions)) : null,
      music: x.music ? { ...x.music } : null,
      voice: x.voice ? { ...x.voice } : null,
      origVol: x.origVol,
      cover: x.cover ? { ...x.cover } : null
    };
  }
  function sigOf(st) {
    return JSON.stringify({
      ...st,
      clips: st.clips.map(c => [c.id, c.in, c.out, c.speed, !!c.mute]),
      music: st.music ? [st.music.id, st.music.vol, st.music.start] : null,
      voice: st.voice ? st.voice.id : null,
      cover: st.cover ? st.cover.t : null
    });
  }
  function histReset() {
    const st = editState();
    H = { past: [], future: [], cur: st, sig: sigOf(st) };
    hPending = null;
    paintHist();
  }
  function commitHist(st, g) {
    H.past.push(H.cur);
    if (H.past.length > 60) H.past.shift();
    H.cur = st; H.sig = g; H.future = []; hPending = null;
    paintHist();
  }
  /* A change is recorded once it has settled - a slider dragged for two
     seconds is one step, not twenty. */
  function histTick() {
    if (!H || screen !== 'edit' || pDown || !$('stu')) return;
    const st = editState(), g = sigOf(st);
    if (g === H.sig) { if (hPending) { hPending = null; paintHist(); } return; }
    if (hPending !== g) { hPending = g; paintHist(); return; }
    commitHist(st, g);
  }
  function flushHist() {
    if (!H) return;
    const st = editState(), g = sigOf(st);
    if (g !== H.sig) commitHist(st, g);
  }
  function undo() {
    if (!H) return;
    flushHist();
    if (!H.past.length) return;
    H.future.push(H.cur);
    H.cur = H.past.pop();
    restore(H.cur);
  }
  function redo() {
    if (!H) return;
    flushHist();
    if (!H.future.length) return;
    H.past.push(H.cur);
    H.cur = H.future.pop();
    restore(H.cur);
  }
  function restore(st) {
    const clipSig = () => P.clips.map(c => [c.id, c.in, c.out, c.speed, !!c.mute].join(':')).join('|');
    const before = clipSig();
    Object.assign(P, editState(st));
    H.sig = sigOf(editState());
    hPending = null;
    sel = clamp(sel, 0, Math.max(0, P.clips.length - 1));
    if (selNode && !(selNode.kind === 'text' ? P.texts : P.stickers).some(n => n.id === selNode.id)) selNode = null;
    stkForm = null;
    if (before !== clipSig()) { thumbCache = {}; touch(false); } else touch();
    repaintPanel();
    const a = $('stu-t-all');
    if (a) a.textContent = fmt(totalOut());
    paintHist();
  }
  function paintHist() {
    const u = $('stu-undo'), r = $('stu-redo');
    if (u) u.disabled = !(H && (H.past.length || hPending));
    if (r) r.disabled = !(H && H.future.length);
  }

  /* — Caption helpers on the share screen ——————————————————————— */

  function hashtags() {
    if (!window.HT) { toast('Hashtags are still loading.'); return; }
    HT.open({
      text: () => { const b = $('stu-caption'); return b ? b.value : P.caption; },
      insert: str => { const b = $('stu-caption'); if (b) { HT.insertAt(b, str); P.caption = b.value; } }
    });
  }
  function insertCap(str) {
    const b = $('stu-caption');
    if (!b) return;
    const at = b.selectionStart != null ? b.selectionStart : b.value.length;
    const before = b.value.slice(0, at);
    const lead = before && !/\s$/.test(before) ? ' ' : '';
    b.value = before + lead + str + b.value.slice(b.selectionEnd != null ? b.selectionEnd : at);
    const pos = (before + lead + str).length;
    b.focus();
    try { b.setSelectionRange(pos, pos); } catch (e) {}
    P.caption = b.value;
  }

    /* — Filters ———————————————————————————————————————————————— */

  function filterPanel() {
    return `
      <div class="stu-filters">
        ${FILTERS.map(f => `
          <button class="stu-filter${(P.filter || 'none') === f.k ? ' on' : ''}" onclick="STU.setFilter('${f.k}')">
            <span class="stu-filter-i" data-f="${esc(f.f || 'none')}"></span>
            <b>${f.n}</b>
          </button>`).join('')}
      </div>
      <div class="stu-note">Filters are applied when the reel plays, so the original video keeps its full quality.</div>`;
  }

  /* Each chip previews the reel's own first frame with that filter on it. */
  function paintFilterThumbs() {
    const v = $('stu-v');
    if (!v || !v.videoWidth) {
      setTimeout(() => { if (tool === 'filters') paintFilterThumbs(); }, 400);
      return;
    }
    const shot = grab(v, 84, 112, '');
    if (!shot) return;
    document.querySelectorAll('.stu-filter-i').forEach(el => {
      el.style.backgroundImage = `url('${shot}')`;
      el.style.filter = el.dataset.f === 'none' ? 'none' : el.dataset.f;
    });
  }

  function setFilter(k) {
    P.filter = k;
    touch();
    document.querySelectorAll('.stu-filter').forEach(b => b.classList.toggle('on', b.getAttribute('onclick').includes(`'${k}'`)));
  }

  /* — Adjust ————————————————————————————————————————————————— */

  function adjustPanel() {
    const a = P.adj;
    const row = (k, label, min, max, unit) => `
      <div class="stu-row-lbl">${label}<span class="stu-val" data-adj="${k}">${a[k]}${unit || ''}</span></div>
      <input class="stu-range" type="range" min="${min}" max="${max}" value="${a[k]}" oninput="STU.setAdj('${k}',+this.value)">`;
    return `
      ${row('bright', 'Brightness', 40, 180, '%')}
      ${row('contrast', 'Contrast', 40, 200, '%')}
      ${row('sat', 'Saturation', 0, 250, '%')}
      ${row('warm', 'Warmth', 0, 100, '')}
      ${row('vig', 'Vignette', 0, 100, '')}
      ${row('blur', 'Soften', 0, 100, '')}
      <button class="stu-act wide" onclick="STU.resetAdj()"><span class="material-symbols-rounded">restart_alt</span>Reset adjustments</button>`;
  }

  function setAdj(k, v) {
    P.adj[k] = v;
    const el = document.querySelector(`.stu-val[data-adj="${k}"]`);
    if (el) el.textContent = v + (k === 'bright' || k === 'contrast' || k === 'sat' ? '%' : '');
    const vid = $('stu-v');
    if (vid) vid.style.filter = filterCSS(P);
    const vig = document.querySelector('.stu-vig');
    if (k === 'vig') {
      if (vig) vig.style.opacity = String(v / 100);
      else if (v) touch();
    }
  }

  function resetAdj() {
    P.adj = { bright: 100, contrast: 100, sat: 100, warm: 0, blur: 0, vig: 0 };
    touch();
    repaintPanel();
  }

  /* — Cover ————————————————————————————————————————————————— */

  function coverPanel() {
    return `
      <div class="stu-cover-wrap">
        <div class="stu-cover-prev" id="stu-cover-prev">${P.cover ? `<img src="${P.cover.data}" alt="Cover">` : '<span class="material-symbols-rounded">image</span>'}</div>
        <div class="stu-cover-side">
          <p>Scrub to the frame you want people to see in the grid, then set it as the cover.</p>
          <button class="stu-btn" onclick="STU.setCoverHere()"><span class="material-symbols-rounded">photo_camera</span>Use this frame</button>
        </div>
      </div>
      <div class="stu-cover-strip" id="stu-cover-strip"><i class="plain"></i><i class="plain"></i><i class="plain"></i><i class="plain"></i><i class="plain"></i><i class="plain"></i></div>
      <div class="stu-note">The cover is the still that shows on your profile grid and in the Shorty hub.</div>`;
  }

  async function wireCoverStrip() {
    const strip = $('stu-cover-strip');
    if (!strip || !eng) return;
    strip.addEventListener('click', e => {
      const i = Array.from(strip.children).indexOf(e.target.closest('i'));
      if (i < 0) return;
      eng.pause();
      eng.seek((eng.total / 6) * i + 0.05);
    });
    // Frames across the whole reel, taken from the clips themselves.
    const shots = [];
    for (const c of P.clips) {
      const list = await thumbs(c);
      list.forEach(s => shots.push(s));
      if (shots.length >= 6) break;
    }
    if ($('stu-cover-strip') !== strip) return;
    const pick = [];
    for (let i = 0; i < 6; i++) pick.push(shots[Math.floor((i / 6) * shots.length)] || '');
    strip.innerHTML = pick.map(s => s ? `<i style="background-image:url('${s}')"></i>` : '<i class="plain"></i>').join('');
  }

  function setCoverHere() {
    const v = $('stu-v');
    if (!v || !v.videoWidth) { toast('Give the video a moment to load.'); return; }
    const data = grab(v, 405, 720, filterCSS(P));
    if (!data) { toast('That frame could not be captured.'); return; }
    P.cover = { data, t: eng ? eng.time : 0 };
    const box = $('stu-cover-prev');
    if (box) box.innerHTML = `<img src="${data}" alt="Cover">`;
    toast('Cover set');
  }

  /* ══════════════════════════════════════════════════════════════════
     3 · SHARE
     ══════════════════════════════════════════════════════════════════ */

  function shareHTML() {
    const people = (typeof DATA !== 'undefined' && DATA.users) ? DATA.users : [];
    const cover = P.cover ? `<img src="${P.cover.data}" alt="Cover">` : '<span class="material-symbols-rounded">movie</span>';
    return `
      <div class="stu-share">
        <div class="stu-bar">
          <button class="stu-round" onclick="STU.back()" aria-label="Back"><span class="material-symbols-rounded">arrow_back</span></button>
          <div class="stu-bar-t">New reel</div>
          <button class="stu-nextb" id="stu-share-b" onclick="STU.publish()">Share</button>
        </div>

        <div class="stu-share-body">
          <div class="stu-share-top">
            <button class="stu-share-cover" onclick="STU.editCover()">${cover}<span class="stu-share-cover-e">Edit cover</span></button>
            <textarea class="stu-cap-in" id="stu-caption" rows="4" maxlength="2200"
              placeholder="Write a caption… #hashtags and @mentions work">${esc(P.caption)}</textarea>
          </div>
          <div class="stu-captools">
            <button type="button" class="stu-captool" onclick="STU.hashtags()"><span class="material-symbols-rounded">tag</span>Hashtags</button>
            <button type="button" class="stu-captool" onclick="STU.insertCap('@')"><span class="material-symbols-rounded">alternate_email</span>Mention</button>
          </div>

          <div class="stu-meta">${P.clips.length} clip${P.clips.length > 1 ? 's' : ''} · ${fmt(totalOut())}${P.music ? ' · ' + esc(P.music.title) : ''}${P.filter !== 'none' ? ' · ' + esc((FILTERS.find(f => f.k === P.filter) || {}).n) : ''}</div>

          <div class="stu-srow" onclick="STU.togglePeople()">
            <span class="material-symbols-rounded">person_add</span>
            <b>Tag people</b>
            <span class="stu-srow-v">${P.tagged.length ? esc(P.tagged.join(', ')) : 'None'}</span>
            <span class="material-symbols-rounded stu-chev">chevron_right</span>
          </div>
          <div class="stu-people" id="stu-people" hidden>
            ${people.map(u => `<button class="stu-person${P.tagged.includes(u.handle) ? ' on' : ''}" onclick="STU.tag('${esc(u.handle)}')">
              <span class="stu-person-a">${esc((u.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2))}</span>
              <b>${esc(u.name)}</b><span>${esc(u.handle)}</span></button>`).join('')}
          </div>

          <label class="stu-srow">
            <span class="material-symbols-rounded">location_on</span>
            <b>Location</b>
            <input class="stu-srow-in" value="${esc(P.place)}" placeholder="Add a place" oninput="STU.setPlace(this.value)">
          </label>

          <div class="stu-srow">
            <span class="material-symbols-rounded">visibility</span>
            <b>Audience</b>
            <select class="stu-select" onchange="STU.setAudience(this.value)">
              <option value="everyone"${P.audience === 'everyone' ? ' selected' : ''}>Everyone</option>
              <option value="followers"${P.audience === 'followers' ? ' selected' : ''}>Followers</option>
              <option value="close"${P.audience === 'close' ? ' selected' : ''}>Close friends</option>
            </select>
          </div>

          ${[['allowComments', 'Allow comments', 'mode_comment'],
             ['allowRemix', 'Allow remixing', 'auto_awesome_motion'],
             ['tips', 'Accept crypto tips', 'toll'],
             ['ai', 'Label as made with AI', 'smart_toy']].map(([k, l, i]) => `
            <div class="stu-srow">
              <span class="material-symbols-rounded">${i}</span>
              <b>${l}</b>
              <button class="stu-toggle${P[k] ? ' on' : ''}" onclick="STU.toggle('${k}')" role="switch" aria-checked="${!!P[k]}"><i></i></button>
            </div>`).join('')}

          <div class="stu-note stu-note-ai" id="stu-ai-note"${P.ai ? '' : ' hidden'}><span class="material-symbols-rounded">smart_toy</span>This reel will carry a "Made with AI" label.</div>

          <button class="stu-draftbtn" onclick="STU.saveDraft()">
            <span class="material-symbols-rounded">bookmark_add</span>Save as draft
          </button>

          <div class="stu-note">Your video stays on this device — the clips go into this browser's storage, not to a server.</div>
        </div>
      </div>`;
  }

  function wireShare() {
    const cap = $('stu-caption');
    if (cap) cap.addEventListener('input', () => { P.caption = cap.value; });
  }

  const setPlace = v => { P.place = v; };
  const setAudience = v => { P.audience = v; };
  function toggle(k) {
    P[k] = !P[k];
    const btn = document.querySelector(`.stu-toggle[onclick*="${k}"]`);
    if (btn) { btn.classList.toggle('on', P[k]); btn.setAttribute('aria-checked', String(!!P[k])); }
    /* No repaint here, deliberately — redrawing the share screen would
       take the caret out of the caption someone is in the middle of
       writing. Anything a switch affects updates itself instead. */
    if (k === 'ai') { const n = $('stu-ai-note'); if (n) n.hidden = !P.ai; }
  }
  function togglePeople() {
    const el = $('stu-people');
    if (el) el.hidden = !el.hidden;
  }
  function tag(handle) {
    P.tagged = P.tagged.includes(handle) ? P.tagged.filter(h => h !== handle) : P.tagged.concat(handle);
    const btn = document.querySelector(`.stu-person[onclick*="${handle}"]`);
    if (btn) btn.classList.toggle('on', P.tagged.includes(handle));
    const row = document.querySelector('.stu-srow-v');
    if (row) row.textContent = P.tagged.length ? P.tagged.join(', ') : 'None';
  }
  function editCover() { tool = 'cover'; go('edit'); }

  /* ── Publish ─────────────────────────────────────────────────────── */

  async function publish() {
    if (!P.clips.length) { toast('Nothing to publish yet.'); return; }
    /* No early "is Shorty loaded?" check here: Shorty loads on demand,
       and needSH() below waits for it. The old check ran first and
       refused to publish in any session that had not opened Shorty. */
    const btn = $('stu-share-b');
    if (btn) { btn.disabled = true; btn.textContent = 'Sharing…'; }

    const cap = $('stu-caption');
    if (cap) P.caption = cap.value;

    const id = 'u' + Date.now();
    const clipIds = [];

    if (!(await needSH())) {
      if (btn) { btn.disabled = false; btn.textContent = 'Share'; }
      toast('Could not reach this device\'s storage. Your reel is still here — try again.');
      return;
    }

    try {
      for (const c of P.clips) {
        const bid = id + '_' + c.id;
        await SH.store.put(bid, c.blob);
        clipIds.push({ id: bid, in: c.in, out: c.out, speed: c.speed, mute: !!c.mute });
      }
      if (P.music && P.music.custom && P.music.blob) {
        await SH.store.put(id + '_audio', P.music.blob);
      }
      if (P.cover && P.cover.data) {
        const b = dataURLToBlob(P.cover.data);
        if (b) await SH.store.put(id + '_cover', b);
      }
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Share'; }
      toast('Could not save — this device may be out of storage.');
      return;
    }

    const user = (typeof S !== 'undefined' && S.user && S.user.fname && S.user.fname !== 'Guest') ? S.user : null;
    const rec = {
      id,
      caption: (P.caption || '').trim() || 'New reel',
      creator: user ? `${user.fname} ${user.lname || ''}`.trim() : 'You',
      handle: user && user.handle ? user.handle : '@you',
      ts: Date.now(),
      duration: totalOut(),
      clipIds,
      cover: P.cover ? id + '_cover' : '',
      audio: P.music ? (P.music.voice ? 'Your voiceover' : `${P.music.title} · ${P.music.artist || (P.music.custom ? 'Your audio' : 'SoundHelix')}`) : 'Original audio · You',
      edit: {
        filter: P.filter,
        adj: { ...P.adj },
        texts: P.texts.map(t => ({ ...t })),
        stickers: JSON.parse(JSON.stringify(P.stickers)),
        captions: P.captions && P.captions.segs && P.captions.segs.length ? JSON.parse(JSON.stringify(P.captions)) : null,
        origVol: P.origVol,
        music: P.music ? {
          id: P.music.id, title: P.music.title, artist: P.music.artist || '', vol: P.music.vol, start: P.music.start,
          custom: !!P.music.custom, voice: !!P.music.voice,
          src: P.music.custom ? '' : P.music.src,
          blobId: P.music.custom ? id + '_audio' : ''
        } : null
      },
      meta: {
        tagged: P.tagged.slice(), place: P.place, audience: P.audience,
        allowComments: P.allowComments, allowRemix: P.allowRemix, tips: P.tips,
        ai: !!P.ai
      }
    };

    // The clips keep their object URLs for this session, so the reel plays
    // straight away without re-reading the blobs.
    const urls = {};
    P.clips.forEach(c => { urls[id + '_' + c.id] = c.url; });
    if (P.music && P.music.custom && P.music.src) urls[id + '_audio'] = P.music.src;

    P.clips.forEach(c => { c.tmp = false; });   // don't revoke on close
    /* It is published now, so the draft copy and its duplicate blobs
       are no longer earning their space. */
    if (draftList().some(d => d.id === P.id)) deleteDraft(P.id);
    if (P.music && !P.music.voice && window.MUS) MUS.noteUse(P.music.id);
    close();
    SH.addUpload(rec, urls);
  }

  /* ── Public surface ──────────────────────────────────────────────── */

  return {
    open, close, back, go, paint,
    // capture
    startCam, flip, setLen, cycleSpeed, cycleTimer, toggleMic, pickFiles, undoClip,
    // edit
    setTool, selClip, clipSpeed, muteClip, moveClip, dupClip, delClip, splitClip,
    setOrigVol, useMusic, setMusicVol, setMusicStart, clearMusic, previewMusic, importAudio, voiceover, clearVoice,
    addText, editText, pickNode, setText, setTextProp, setTiming, delNode,
    addSticker, setSticker, setFilter, setAdj, resetAdj, setCoverHere,
    openMusic, setTrack, undo, redo, dupNode,
    stkNew, stkSearch, stkField, stkOpt, stkAddOpt, stkDelOpt, stkMention, stkPerson, stkCancel, stkEdit, stkSave,
    autoCaptions, addCapLine, capText, capSeek, capDel, capClear, capStyle, capLang: capLangSet,
    hashtags, insertCap,
    // share
    togglePeople, tag, setPlace, setAudience, toggle, editCover, publish,
    // drafts
    saveDraft, openDraft, deleteDraft, leave, drafts: draftList,
    // shared with the player
    engine, filterCSS, overlayHTML, FILTERS, MUSIC,
    get project() { return P; }
  };
})();

window.STU = STU;

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
publish('features/studio.js', {
  STU: () => STU
});
