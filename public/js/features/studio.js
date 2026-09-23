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
    const sticks = (reel.stickers || []).map(s =>
      `<div class="stu-node stu-sticker" data-id="${esc(s.id)}" data-t0="${s.start || 0}" data-t1="${s.end || 0}"
        style="left:${s.x}%;top:${s.y}%;font-size:${s.size}px;font-size:${(s.size / 4.05).toFixed(2)}cqw;transform:translate(-50%,-50%) rotate(${s.rot || 0}deg)">${esc(s.emoji)}</div>`
    ).join('');
    const vignette = vig ? `<div class="stu-vig" style="opacity:${vig / 100}"></div>` : '';
    return vignette + texts + sticks;
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
    if (!silent) {
      // Free anything the project held that never got published.
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
    if (c && c.tmp && c.url) URL.revokeObjectURL(c.url);
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
    ov.querySelectorAll('.stu-node').forEach(node => {
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
    if (c && c.tmp && c.url && !P.clips.some(x => x.url === c.url)) URL.revokeObjectURL(c.url);
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
    return `
      <div class="stu-row-lbl">Original audio<span class="stu-val" data-k="orig">${Math.round((P.origVol == null ? 1 : P.origVol) * 100)}%</span></div>
      <input class="stu-range" type="range" min="0" max="100" value="${Math.round((P.origVol == null ? 1 : P.origVol) * 100)}"
             oninput="STU.setOrigVol(this.value)">

      ${m ? `
        <div class="stu-track on">
          <span class="material-symbols-rounded">graphic_eq</span>
          <div class="stu-track-t"><b>${esc(m.title)}</b><span>${esc(m.mood || 'Your audio')}</span></div>
          <button class="stu-x" onclick="STU.clearMusic()" aria-label="Remove"><span class="material-symbols-rounded">close</span></button>
        </div>
        <div class="stu-row-lbl">Music volume<span class="stu-val">${Math.round((m.vol == null ? 0.8 : m.vol) * 100)}%</span></div>
        <input class="stu-range" type="range" min="0" max="100" value="${Math.round((m.vol == null ? 0.8 : m.vol) * 100)}"
               oninput="STU.setMusicVol(this.value)">
        <div class="stu-row-lbl">Start the track at<span class="stu-val">${fmt(m.start || 0)}</span></div>
        <input class="stu-range" type="range" min="0" max="${Math.max(1, Math.round(m.dur || 120))}" value="${Math.round(m.start || 0)}"
               oninput="STU.setMusicStart(this.value)">
      ` : ''}

      <div class="stu-row-lbl">Add sound</div>
      <div class="stu-acts">
        <button class="stu-act" onclick="STU.importAudio()"><span class="material-symbols-rounded">library_music</span>Your file</button>
        <button class="stu-act${P.voice ? ' on' : ''}" id="stu-vo" onclick="STU.voiceover()">
          <span class="material-symbols-rounded">mic</span>${P.voice ? 'Re-record' : 'Voiceover'}</button>
        ${P.voice ? '<button class="stu-act danger" onclick="STU.clearVoice()"><span class="material-symbols-rounded">delete</span>Voice</button>' : ''}
      </div>

      <div class="stu-tracks">
        ${MUSIC.map(t => `
          <button class="stu-track${m && m.id === t.id ? ' on' : ''}" onclick="STU.useMusic('${t.id}')">
            <span class="stu-track-art material-symbols-rounded">music_note</span>
            <div class="stu-track-t"><b>${esc(t.title)}</b><span>${esc(t.mood)} · SoundHelix</span></div>
            <span class="stu-track-p material-symbols-rounded" onclick="event.stopPropagation();STU.previewMusic('${t.id}',this)">play_arrow</span>
          </button>`).join('')}
      </div>
      <div class="stu-note">Tracks are the free demo set from soundhelix.com — real audio, streamed live, free to use while you build.</div>
      <input type="file" id="stu-audio-file" accept="audio/*" hidden>`;
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
    if (P.voice && P.voice.url) URL.revokeObjectURL(P.voice.url);
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
        <button class="stu-act danger wide" onclick="STU.delNode()"><span class="material-symbols-rounded">delete</span>Delete this text</button>
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
    touch();
    repaintPanel();
  }

  /* — Stickers ——————————————————————————————————————————————— */

  function stickerPanel() {
    const cur = selNode && selNode.kind === 'sticker' ? P.stickers.find(s => s.id === selNode.id) : null;
    const tot = totalOut();
    return `
      ${cur ? `
        <div class="stu-row-lbl">Selected ${esc(cur.emoji)}<span class="stu-val" data-k="size">${cur.size}px</span></div>
        <input class="stu-range" type="range" min="20" max="140" value="${cur.size}" oninput="STU.setSticker('size',+this.value)">
        <div class="stu-row-lbl">Rotate<span class="stu-val" data-k="rot">${cur.rot || 0}°</span></div>
        <input class="stu-range" type="range" min="-180" max="180" value="${cur.rot || 0}" oninput="STU.setSticker('rot',+this.value)">
        <div class="stu-row-lbl">Appears<span class="stu-val">${fmt(cur.start || 0)} → ${fmt(cur.end || tot)}</span></div>
        <input class="stu-range" type="range" min="0" max="${Math.max(1, Math.ceil(tot * 10))}" value="${Math.round((cur.start || 0) * 10)}" oninput="STU.setTiming('start',this.value/10)">
        <input class="stu-range" type="range" min="0" max="${Math.max(1, Math.ceil(tot * 10))}" value="${Math.round((cur.end || tot) * 10)}" oninput="STU.setTiming('end',this.value/10)">
        <button class="stu-act danger wide" onclick="STU.delNode()"><span class="material-symbols-rounded">delete</span>Remove sticker</button>
      ` : '<div class="stu-none">Tap a sticker to drop it on the reel, then drag it into place.</div>'}
      <div class="stu-emoji">
        ${STICKERS.map(e => `<button class="stu-em" onclick="STU.addSticker('${e}')">${e}</button>`).join('')}
      </div>`;
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
    s[k] = v;
    touch();
    const lbl = document.querySelector(`.stu-panel .stu-val[data-k="${k}"]`);
    if (lbl) lbl.textContent = k === 'size' ? v + 'px' : v + '°';
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
    if (!window.SH || !SH.store) { toast('The Shorty library is not ready.'); return; }
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
      audio: P.music ? (P.music.voice ? 'Your voiceover' : `${P.music.title} · ${P.music.custom ? 'Your audio' : 'SoundHelix'}`) : 'Original audio · You',
      edit: {
        filter: P.filter,
        adj: { ...P.adj },
        texts: P.texts.map(t => ({ ...t })),
        stickers: P.stickers.map(s => ({ ...s })),
        origVol: P.origVol,
        music: P.music ? {
          id: P.music.id, title: P.music.title, vol: P.music.vol, start: P.music.start,
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
