/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CREATE — one + button, every kind of Trending content           ║
   ║                                                                   ║
   ║  CreateHub                                                        ║
   ║   ├── PostCreator    photos, video, text, background styles      ║
   ║   ├── StoryCreator   camera, gallery, text, editor, 24h stories  ║
   ║   ├── ReelCreator    hands over to the Shorty studio (SH)        ║
   ║   ├── VideoCreator   longer video with title and description     ║
   ║   ├── PollCreator    question, options, duration, audience       ║
   ║   └── LiveCreator    pre-live setup and camera check             ║
   ║                                                                   ║
   ║  Shared pieces every creator uses:                                ║
   ║    MediaPicker   one picker, told what each mode accepts          ║
   ║    Camera        getUserMedia preview, photo capture, recording   ║
   ║    MediaEditor   filters, rotate, text over an image              ║
   ║    CaptionEditor caption with hashtags and mentions               ║
   ║    Audience      who can see it                                   ║
   ║    Drafts        saved on this device, restored on reopen         ║
   ║    Publisher     the one place that hands work to the feed,       ║
   ║                  stories, Shorty or the poll system               ║
   ║                                                                   ║
   ║  Photos are shrunk on the device before they are kept. Video      ║
   ║  stays in this browser (Shorty's blob store when it is around),   ║
   ║  never uploaded anywhere, because Trending has no media server.   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CR = (() => {

  const DKEY = 'ts_drafts_v1';
  const SKEY = 'ts_mystories_v1';
  const STORY_MS = 24 * 3600 * 1000;

  const MODES = [
    ['post', 'Post', 'edit_square'],
    ['story', 'Story', 'amp_stories'],
    ['reel', 'Reel', 'slow_motion_video'],
    ['video', 'Video', 'movie'],
    ['live', 'Live', 'sensors'],
    ['poll', 'Poll', 'bar_chart']
  ];
  const AUDIENCES = [
    ['everyone', 'Everyone', 'public'],
    ['followers', 'Followers', 'group'],
    ['close', 'Close friends', 'stars']
  ];
  const BGS = [
    'linear-gradient(140deg, #FCD535, #EC4899)',
    'linear-gradient(140deg, #0EA5E9, #2EBD85)',
    'linear-gradient(140deg, #F97316, #F43F5E)',
    'linear-gradient(140deg, #111827, #4B5563)',
    'linear-gradient(140deg, #F0B90B, #F97316)',
    'linear-gradient(140deg, #1E3A8A, #7C3AED)'
  ];
  const FILTERS = [
    ['none', 'Original', ''],
    ['warm', 'Warm', 'saturate(1.25) sepia(.18) contrast(1.05)'],
    ['cool', 'Cool', 'saturate(1.1) hue-rotate(-12deg) brightness(1.04)'],
    ['vivid', 'Vivid', 'saturate(1.7) contrast(1.12) brightness(1.02)'],
    ['mono', 'Mono', 'grayscale(1) contrast(1.1)'],
    ['noir', 'Noir', 'grayscale(1) contrast(1.45) brightness(.92)'],
    ['fade', 'Fade', 'saturate(.8) brightness(1.08) contrast(.92)'],
    ['punch', 'Punch', 'saturate(1.5) contrast(1.15)'],
    ['dusk', 'Dusk', 'hue-rotate(14deg) saturate(1.25) brightness(.94) contrast(1.12)'],
    ['mint', 'Mint', 'hue-rotate(-28deg) saturate(1.2) brightness(1.05)'],
    ['film', 'Film', 'sepia(.5) saturate(1.25) contrast(1.06) brightness(1.02)']
  ];
  const CATEGORIES = ['general', 'crypto', 'tech', 'design', 'fitness', 'motivation', 'sports', 'music', 'gaming'];

  const $ = id => document.getElementById(id);
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
  const ico = (n, c) => `<span class="material-symbols-rounded${c ? ' ' + c : ''}" aria-hidden="true">${n}</span>`;
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const user = () => (typeof S !== 'undefined' && S.user) || {};
  const guest = () => !user().fname || user().fname === 'Guest';
  const filterOf = k => (FILTERS.find(f => f[0] === k) || FILTERS[0])[2];

  /* The draft being worked on. One shape for every mode, so switching
     mode keeps whatever still makes sense. */
  const blank = () => ({
    mode: 'post', media: [], caption: '', audience: 'everyone', location: '',
    bg: -1, filter: 'none', title: '', desc: '', category: 'general',
    question: '', options: ['', ''], days: 1, comments: true,
    id: uid(), at: Date.now()
  });
  let D = blank();
  let view = 'compose';      // compose | camera
  let cam = null;            // live camera state
  let camFx = true;          // filter tray open over the camera

  /* ── Drafts ──────────────────────────────────────────────────────── */
  function drafts() {
    try {
      const v = JSON.parse(localStorage.getItem(DKEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function saveDraft(quiet) {
    // Video frames live in memory only, so a draft keeps images and words.
    const media = D.media.filter(m => m.kind === 'image' && m.src && m.src.startsWith('data:'));
    if (!D.caption && !D.title && !D.question && !media.length && D.bg < 0) { if (!quiet) toast('Nothing to save yet.'); return false; }
    const list = drafts().filter(x => x.id !== D.id);
    list.unshift({ ...D, media, at: Date.now() });
    try { localStorage.setItem(DKEY, JSON.stringify(list.slice(0, 12))); }
    catch (e) { if (!quiet) toast('This device has no room left for another draft.'); return false; }
    if (!quiet) toast('Saved to drafts');
    return true;
  }
  function loadDraft(id) {
    const d = drafts().find(x => x.id === id);
    if (!d) return;
    D = { ...blank(), ...d };
    view = 'compose';
    paint();
  }
  function dropDraft(id) {
    try { localStorage.setItem(DKEY, JSON.stringify(drafts().filter(x => x.id !== id))); } catch (e) {}
    paint();
  }

  /* ── Media picker (one for every mode) ───────────────────────────── */
  const ACCEPT = {
    post: 'image/*,video/*', story: 'image/*,video/*', reel: 'video/*',
    video: 'video/*', poll: 'image/*', live: 'image/*'
  };
  function pick(multiple) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = ACCEPT[D.mode] || 'image/*';
    if (multiple) inp.multiple = true;
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', async () => {
      const files = [...(inp.files || [])];
      inp.remove();
      // Something was chosen, so the camera has done its job.
      if (files.length && view === 'camera') { stopCamera(); view = 'compose'; paint(); }
      await addFiles(files);
    }, { once: true });
    inp.click();
  }
  async function addFiles(files) {
    if (!files.length) return;
    const room = maxMedia() - D.media.length;
    if (room <= 0) { toast(`That's the most ${D.mode === 'post' ? 'items' : 'clips'} for one ${D.mode}.`); return; }
    let failed = 0;
    for (const f of files.slice(0, room)) {
      try {
        if (/^image\//.test(f.type)) D.media.push({ id: uid(), kind: 'image', src: await shrink(f), name: f.name });
        else if (/^video\//.test(f.type)) D.media.push({ id: uid(), kind: 'video', src: URL.createObjectURL(f), file: f, size: f.size, name: f.name });
        else failed++;
      } catch (e) { failed++; }
      paint();
    }
    if (failed) toast(failed === 1 ? "That file couldn't be opened." : `${failed} files couldn't be opened.`);
  }
  const maxMedia = () => (D.mode === 'post' ? 10 : D.mode === 'video' ? 1 : D.mode === 'poll' ? 1 : 6);

  /* Shrink on the device: nothing leaves the browser, and a 12MP photo
     doesn't have to be carried around at full size. */
  function shrink(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const cap = max || 1440;
          const k = Math.min(1, cap / img.naturalWidth, cap / img.naturalHeight);
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * k));
          c.height = Math.max(1, Math.round(img.naturalHeight * k));
          const g = c.getContext('2d');
          g.fillStyle = '#000';
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82));
        } catch (e) { reject(e); }
        finally { URL.revokeObjectURL(url); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  /* Filters and rotation are baked in when the piece is published, so what
     is posted matches what the editor showed. */
  function bake(src, filter, rotate) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const turned = rotate % 180 !== 0;
          const c = document.createElement('canvas');
          c.width = turned ? img.naturalHeight : img.naturalWidth;
          c.height = turned ? img.naturalWidth : img.naturalHeight;
          const g = c.getContext('2d');
          g.filter = filterOf(filter) || 'none';
          g.translate(c.width / 2, c.height / 2);
          g.rotate((rotate * Math.PI) / 180);
          g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
          resolve(c.toDataURL('image/jpeg', 0.85));
        } catch (e) { resolve(src); }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }

  /* ── Camera ──────────────────────────────────────────────────────────
     One live camera behind every mode. The preview wears the filter that
     is picked, the mode strip sits on top of it, and switching mode never
     tears the camera down — the picture just keeps running.            */
  const CAMOK = { post: 1, story: 1, video: 1, poll: 1, live: 1 };
  const camMode = m => !!CAMOK[m || D.mode];
  const HINT = {
    post: 'Tap for a photo · hold to record',
    story: 'Tap for a photo · hold to record',
    video: 'Tap to start · tap again to stop',
    poll: 'Tap to take the photo',
    live: '', reel: ''
  };
  const MAXREC = 60000;
  const RING = 226;
  const hasCam = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

  async function openCamera(facing) {
    const was = cam && cam.facing;
    stopCamera();
    view = 'camera';
    cam = { facing: facing || was || 'user', rec: null, chunks: [], since: 0,
            stream: null, timer: null, holdTimer: null, raf: 0, out: null, tap: false };
    paint();
    const mine = cam;
    if (!hasCam()) {
      camOff('This browser does not hand web pages a camera. You can still pick something from your gallery.');
      return;
    }
    let s = null;
    try {
      s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mine.facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: D.mode !== 'poll'
      });
    } catch (e1) {
      try { s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mine.facing } }); }
      catch (e2) {
        if (cam !== mine) return;
        camOff(e2 && (e2.name === 'NotAllowedError' || e2.name === 'SecurityError')
          ? 'The camera is blocked for this page. Allow it in your browser settings and try again.'
          : e2 && e2.name === 'NotFoundError'
            ? 'No camera answered on this device.'
            : 'The camera could not be started here.');
        return;
      }
    }
    if (cam !== mine || view !== 'camera') { s.getTracks().forEach(t => t.stop()); return; }
    cam.stream = s;
    mountCam();
  }

  /* Hangs the live stream on the <video> the current paint put there. */
  function mountCam() {
    const v = $('cr-cam');
    const wrap = $('cr-camwrap');
    if (!v || !cam || !cam.stream) return;
    v.srcObject = cam.stream;
    v.play().catch(() => {});
    if (wrap) { wrap.classList.add('live'); wrap.classList.remove('off'); }
    const off = $('cr-cam-off');
    if (off) off.hidden = true;
    applyLiveFilter();
  }
  function camOff(msg) {
    const wrap = $('cr-camwrap');
    if (wrap) { wrap.classList.add('off'); wrap.classList.remove('live'); }
    const off = $('cr-cam-off');
    if (off) off.hidden = false;
    const note = $('cr-cam-note');
    if (note) note.textContent = msg;
  }
  function stopCamera() {
    const c = cam;
    cam = null;
    if (!c) return;
    if (c.holdTimer) clearTimeout(c.holdTimer);
    if (c.timer) clearInterval(c.timer);
    if (c.raf) cancelAnimationFrame(c.raf);
    if (c.rec) { try { c.rec.onstop = null; c.rec.stop(); } catch (e) {} }
    if (c.out) c.out.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    if (c.stream) c.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
  }
  function flip() {
    const f = cam && cam.facing === 'user' ? 'environment' : 'user';
    openCamera(f);
  }

  /* ── Live filter ─────────────────────────────────────────────────── */
  function applyLiveFilter() {
    const v = $('cr-cam');
    if (v) v.style.filter = filterOf(D.filter) || 'none';
    const rail = $('cr-fxrail');
    if (!rail) return;
    rail.querySelectorAll('[data-cr="filter"]').forEach(b => {
      const on = b.dataset.v === D.filter;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
      if (on && b.scrollIntoView) { try { b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
    });
  }

  /* ── Taking the shot ─────────────────────────────────────────────── */
  function flash() {
    const f = $('cr-flash');
    if (!f) return;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }
  function snap() {
    const v = $('cr-cam');
    if (!v || !v.videoWidth) { toast('The camera is not ready yet.'); return; }
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const g = c.getContext('2d');
    if (cam && cam.facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(v, 0, 0, c.width, c.height);
    flash();
    buzz(12);
    /* The frame is kept as the camera saw it; the filter rides along on
       the draft and is baked in once, at publish. */
    D.media.push({ id: uid(), kind: 'image', src: c.toDataURL('image/jpeg', 0.88) });
    stopCamera();
    view = 'compose';
    paint();
  }

  /* A filtered or mirrored recording is drawn through a canvas first, so
     the clip that is kept looks like the preview did. */
  function recSource() {
    const v = $('cr-cam');
    const f = filterOf(D.filter);
    const mirror = cam && cam.facing === 'user';
    if (!cam || !cam.stream) return null;
    if ((!f && !mirror) || !v || !v.videoWidth || !HTMLCanvasElement.prototype.captureStream) return cam.stream;
    try {
      const k = Math.min(1, 720 / v.videoWidth, 1280 / v.videoHeight);
      const c = document.createElement('canvas');
      c.width = Math.max(2, Math.round(v.videoWidth * k / 2) * 2);
      c.height = Math.max(2, Math.round(v.videoHeight * k / 2) * 2);
      const g = c.getContext('2d');
      const draw = () => {
        if (!cam) return;
        g.save();
        g.filter = f || 'none';
        if (mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
        try { g.drawImage(v, 0, 0, c.width, c.height); } catch (e) {}
        g.restore();
        cam.raf = requestAnimationFrame(draw);
      };
      draw();
      const out = c.captureStream(30);
      cam.stream.getAudioTracks().forEach(t => out.addTrack(t));
      cam.out = out;
      return out;
    } catch (e) { return cam.stream; }
  }
  function startRec() {
    if (!cam || !cam.stream) return;
    if (!window.MediaRecorder) { toast('This browser cannot record video.'); return; }
    try {
      const src = recSource();
      const mt = pickMime();
      cam.rec = new MediaRecorder(src, mt ? { mimeType: mt } : undefined);
      cam.chunks = [];
      cam.fx = D.filter;
      cam.rec.ondataavailable = e => { if (e.data && e.data.size) cam.chunks.push(e.data); };
      cam.rec.onstop = onRecStop;
      cam.rec.start();
      cam.since = Date.now();
      const wrap = $('cr-camwrap');
      if (wrap) wrap.classList.add('rec');
      cam.timer = setInterval(tickRec, 100);
      tickRec();
      buzz(18);
    } catch (e) { cam.rec = null; toast('This browser cannot record video.'); }
  }
  function tickRec() {
    if (!cam || !cam.since) return;
    const ms = Date.now() - cam.since;
    const t = $('cr-rec-time');
    if (t) t.textContent = Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0');
    const ring = $('cr-ring');
    if (ring) ring.style.strokeDashoffset = String(RING * (1 - Math.min(1, ms / MAXREC)));
    if (ms >= MAXREC) stopRec();
  }
  function stopRec() {
    if (!cam || !cam.rec) return;
    try { cam.rec.stop(); } catch (e) {}
    cam.rec = null;
  }
  function onRecStop() {
    const c = cam;
    if (!c) return;
    clearInterval(c.timer); c.timer = null;
    if (c.raf) { cancelAnimationFrame(c.raf); c.raf = 0; }
    const blob = new Blob(c.chunks, { type: c.chunks[0] ? c.chunks[0].type : 'video/webm' });
    c.chunks = [];
    c.since = 0;
    const wrap = $('cr-camwrap');
    if (wrap) wrap.classList.remove('rec');
    if (blob.size < 2000) {                       // nothing usable came out
      const t = $('cr-rec-time'); if (t) t.textContent = '';
      const ring = $('cr-ring'); if (ring) ring.style.strokeDashoffset = String(RING);
      return;
    }
    D.media.push({ id: uid(), kind: 'video', src: URL.createObjectURL(blob), file: blob,
                   size: blob.size, name: 'camera', filter: c.fx || 'none' });
    stopCamera();
    view = 'compose';
    paint();
  }

  /* Tap or hold, decided by the mode under the shutter. */
  function shutterDown() {
    if (!cam || !cam.stream) { toast('The camera is not ready yet.'); return; }
    const b = $('cr-shutter');
    if (b) b.classList.add('down');
    if (D.mode === 'video') { cam.tap = true; if (cam.rec) stopRec(); else startRec(); return; }
    if (D.mode === 'poll') { cam.tap = true; snap(); return; }
    cam.tap = false;
    cam.holdAt = Date.now();
    cam.holdTimer = setTimeout(() => { if (cam && !cam.rec) startRec(); }, 340);
  }
  function shutterUp() {
    const b = $('cr-shutter');
    if (b) b.classList.remove('down');
    if (!cam) return;
    if (cam.tap) { cam.tap = false; return; }
    clearTimeout(cam.holdTimer); cam.holdTimer = null;
    if (cam.rec) { stopRec(); return; }
    if (cam.holdAt) { cam.holdAt = 0; snap(); }
  }
  function wireShutter() {
    const b = $('cr-shutter');
    if (!b || b.dataset.wired) return;
    b.dataset.wired = '1';
    b.addEventListener('pointerdown', e => { e.preventDefault(); shutterDown(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => shutterUp()));
    b.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); shutterDown(); } });
    b.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); shutterUp(); } });
  }
  function pickMime() {
    const want = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    return want.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  }

  /* ── Publishing ──────────────────────────────────────────────────── */
  /* One place that hands finished work to whatever already owns it. */
  const Publisher = {
    async post() {
      if (guest()) return signIn();
      const text = D.caption.trim();
      if (!text && !D.media.length) { toast('Write something or add a photo.'); return; }
      const media = await Promise.all(D.media.map(async m => m.kind === 'image'
        ? { kind: 'image', src: await bake(m.src, D.filter, 0) }
        : { kind: 'video', src: m.src }));
      const tags = [...new Set((text.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.toLowerCase()))].slice(0, 6);
      const p = {
        id: Date.now(),
        author: authorName(), handle: user().handle || '@you', uid: user().uid || 'anon',
        emoji: initials(), time: Date.now(), body: text, tags,
        likes: 0, comments: 0, shares: 0, liked: false, mine: true,
        type: media.length ? (media[0].kind === 'video' ? 'video' : 'photo') : 'text',
        category: D.category || 'general',
        media, audience: D.audience, bg: D.bg >= 0 ? BGS[D.bg] : '',
        place: D.location || ''
      };
      commit(p, 'Posted to your feed');
    },
    async video() {
      if (guest()) return signIn();
      if (!D.media.length) { toast('Pick or record a video first.'); return; }
      const title = D.title.trim();
      if (!title) { toast('Give the video a title.'); return; }
      const p = {
        id: Date.now(),
        author: authorName(), handle: user().handle || '@you', uid: user().uid || 'anon',
        emoji: initials(), time: Date.now(),
        body: title + (D.desc.trim() ? '\n\n' + D.desc.trim() : ''),
        tags: [...new Set(((title + ' ' + D.desc).match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.toLowerCase()))].slice(0, 6),
        likes: 0, comments: 0, shares: 0, liked: false, mine: true,
        type: 'video', category: D.category || 'general',
        media: D.media.map(m => ({ kind: m.kind, src: m.src })),
        audience: D.audience, title, desc: D.desc, comments_open: D.comments
      };
      commit(p, 'Video published');
    },
    poll() {
      if (guest()) return signIn();
      const q = D.question.trim();
      const opts = D.options.map(o => o.trim()).filter(Boolean);
      if (!q) { toast('Ask a question first.'); return; }
      if (opts.length < 2) { toast('Add at least two options.'); return; }
      if (new Set(opts.map(o => o.toLowerCase())).size !== opts.length) { toast('Options must be different.'); return; }
      const p = {
        id: Date.now(), type: 'poll',
        author: authorName(), handle: user().handle || '@you', uid: user().uid || 'anon',
        emoji: initials(), time: Date.now(), body: q,
        options: opts.map(text => ({ text, votes: 0 })),
        hasVoted: false, votedIdx: -1,
        tags: [], likes: 0, comments: 0, shares: 0, liked: false, mine: true,
        category: D.category || 'general', audience: D.audience,
        closesAt: Date.now() + D.days * 864e5, comments_open: D.comments,
        media: D.media.map(m => ({ kind: m.kind, src: m.src }))
      };
      commit(p, 'Poll published');
    },
    async story() {
      if (guest()) return signIn();
      if (!D.media.length && D.bg < 0 && !D.caption.trim()) { toast('Add a photo or write something.'); return; }
      const frames = D.media.length
        ? await Promise.all(D.media.map(async m => m.kind === 'image'
            ? { kind: 'image', src: await bake(m.src, D.filter, 0), text: D.caption.trim() }
            : { kind: 'video', src: m.src, text: D.caption.trim() }))
        : [{ kind: 'text', text: D.caption.trim(), bg: BGS[Math.max(0, D.bg)] }];
      const list = myStories();
      frames.forEach(f => list.push({ id: uid(), ...f, at: Date.now(), audience: D.audience }));
      if (!writeStories(list)) return;
      close();
      toast(D.audience === 'close' ? 'Shared with close friends' : 'Added to your story');
      if (typeof renderStories === 'function') renderStories();
      offerHighlight(frames);
    }
  };

  function commit(p, msg) {
    if (typeof DATA === 'undefined' || !Array.isArray(DATA.posts)) { toast('The feed is still loading.'); return; }
    DATA.posts.unshift(p);
    if (typeof savePostsToLocal === 'function') savePostsToLocal();
    if (typeof renderFeed === 'function') renderFeed();
    if (typeof SF !== 'undefined' && SF.earn) SF.earn('publish_post');
    close();
    toast(msg);
    if (typeof navigateTo === 'function' && (typeof S === 'undefined' || S.pane !== 'feeds')) navigateTo('feeds');
  }
  const authorName = () => (typeof S !== 'undefined' && S.anonymousMode) ? 'Anonymous'
    : `${user().fname || ''} ${user().lname || ''}`.trim() || 'You';
  const initials = () => ((user().fname || 'Y')[0] + (user().lname || 'U')[0]).toUpperCase();
  function signIn() {
    toast('Sign in to publish.');
    if (typeof openAuthModal === 'function') openAuthModal();
  }

  /* ── Your stories (24 hours, on this device) ─────────────────────── */
  function myStories() {
    let v = [];
    try { v = JSON.parse(localStorage.getItem(SKEY) || '[]'); } catch (e) { v = []; }
    if (!Array.isArray(v)) v = [];
    return v.filter(s => s && s.at && Date.now() - s.at < STORY_MS);
  }
  function writeStories(list) {
    try { localStorage.setItem(SKEY, JSON.stringify(list.slice(-30))); return true; }
    catch (e) { toast('This device has no room left for another story.'); return false; }
  }
  function offerHighlight(frames) {
    if (typeof HL === 'undefined' || !HL.openEditor) return;
    const keep = frames.filter(f => f.kind === 'image' || f.kind === 'text');
    if (!keep.length) return;
    // A story is gone in a day; the profile circles are where it stays.
    setTimeout(() => {
      if (typeof appConfirm !== 'function') return;
      appConfirm('Keep this on your profile as a highlight too?', { title: 'Add to highlights?', ok: 'Add', cancel: 'Not now' })
        .then(ok => { if (ok) HL.openEditor(); });
    }, 600);
  }

  /* ══ Screens ═════════════════════════════════════════════════════ */
  function modeStrip(onCam) {
    return `<div class="cr-modes${onCam ? ' cr-modes-cam' : ''}" role="tablist" aria-label="What are you making?">${MODES.map(([k, l, i]) =>
      `<button type="button" role="tab" aria-selected="${D.mode === k}" class="cr-mode${D.mode === k ? ' on' : ''}" data-cr="mode" data-v="${k}">
        ${ico(i)}<span>${l}</span></button>`).join('')}</div>`;
  }
  function centerMode() {
    const b = document.querySelector('#cr-sheet .cr-mode.on');
    if (b && b.scrollIntoView) { try { b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
  }

  const audienceRow = () => `<button type="button" class="cr-field" data-cr="audience">
      ${ico((AUDIENCES.find(a => a[0] === D.audience) || AUDIENCES[0])[2])}
      <span><b>Audience</b><em>${esc((AUDIENCES.find(a => a[0] === D.audience) || AUDIENCES[0])[1])}</em></span>${ico('expand_more')}</button>`;

  const mediaGrid = () => !D.media.length ? '' : `<div class="cr-media${D.media.length === 1 ? ' one' : ''}">${D.media.map((m, i) => `
      <div class="cr-thumb">
        ${m.kind === 'image'
          ? `<img src="${esc(m.src)}" alt="" style="filter:${esc(filterOf(D.filter))}">`
          : `<video src="${esc(m.src)}" muted playsinline preload="metadata"></video><span class="cr-vtag">${ico('movie')}</span>`}
        <button type="button" class="cr-x" data-cr="drop" data-v="${i}" aria-label="Remove">${ico('close')}</button>
      </div>`).join('')}</div>`;

  /* The filter strip shows the real photo under each look, not a name. */
  const fxRail = (flat, shot) => `<div class="cr-fxrail on${flat ? ' flat' : ''}" id="cr-fxrail" role="group" aria-label="Filters">${FILTERS.map(([k, l]) =>
      `<button type="button" class="cr-fx${D.filter === k ? ' on' : ''}" data-cr="filter" data-v="${k}" aria-pressed="${D.filter === k}">
        <span class="cr-fx-sw">${shot ? `<img src="${esc(shot)}" alt="" style="filter:${esc(filterOf(k)) || 'none'}">`
          : `<i style="filter:${esc(filterOf(k)) || 'none'}"></i>`}</span><em>${l}</em></button>`).join('')}</div>`;

  const filterRow = () => {
    const im = D.media.find(m => m.kind === 'image');
    return im ? fxRail(true, im.src) : '';
  };

  function postScreen() {
    const bgOn = D.bg >= 0 && !D.media.length;
    return `
      <div class="cr-pickrow">
        <button type="button" class="cr-pick" data-cr="camera">${ico('photo_camera')}<span>Camera</span></button>
        <button type="button" class="cr-pick" data-cr="gallery">${ico('image')}<span>Gallery</span></button>
        <button type="button" class="cr-pick${bgOn ? ' on' : ''}" data-cr="bg">${ico('format_color_fill')}<span>Background</span></button>
      </div>
      ${mediaGrid()}${filterRow()}
      ${bgOn ? `<div class="cr-bgs">${BGS.map((b, i) => `<button type="button" class="cr-bg${D.bg === i ? ' on' : ''}" style="background:${b}" data-cr="setbg" data-v="${i}" aria-label="Background ${i + 1}"></button>`).join('')}</div>` : ''}
      <div class="cr-cap${bgOn ? ' onbg' : ''}"${bgOn ? ` style="background:${BGS[D.bg]}"` : ''}>
        <textarea id="cr-caption" data-crf="caption" rows="${bgOn ? 4 : 3}" placeholder="What's trending with you today?" aria-label="Caption">${esc(D.caption)}</textarea>
      </div>
      <div class="cr-hints">
        <button type="button" class="cr-chip" data-cr="ins" data-v="#">#hashtag</button>
        <button type="button" class="cr-chip" data-cr="ins" data-v="@">@mention</button>
        <button type="button" class="cr-chip" data-cr="ins" data-v="🔥">🔥</button>
        <button type="button" class="cr-chip" data-cr="ins" data-v="🚀">🚀</button>
      </div>
      <button type="button" class="cr-field" data-cr="place">${ico('location_on')}<span><b>Location</b><em>${esc(D.location || 'Add a place')}</em></span>${ico('chevron_right')}</button>
      ${audienceRow()}
      ${draftsRow()}`;
  }

  function videoScreen() {
    return `
      <div class="cr-pickrow">
        <button type="button" class="cr-pick" data-cr="camera">${ico('videocam')}<span>Record</span></button>
        <button type="button" class="cr-pick" data-cr="gallery">${ico('video_library')}<span>Choose video</span></button>
      </div>
      ${mediaGrid()}
      <label class="cr-label">Title<input type="text" data-crf="title" value="${esc(D.title)}" placeholder="Give it a title" maxlength="120"></label>
      <label class="cr-label">Description<textarea data-crf="desc" rows="3" placeholder="What is it about?">${esc(D.desc)}</textarea></label>
      <label class="cr-label">Category<select data-crf="category">${CATEGORIES.map(c => `<option value="${c}"${D.category === c ? ' selected' : ''}>${c[0].toUpperCase() + c.slice(1)}</option>`).join('')}</select></label>
      <button type="button" class="cr-field" data-cr="toggle" data-v="comments">${ico(D.comments ? 'chat' : 'chat_bubble_outline')}<span><b>Comments</b><em>${D.comments ? 'Anyone can reply' : 'Turned off'}</em></span>${ico(D.comments ? 'toggle_on' : 'toggle_off')}</button>
      ${audienceRow()}
      <p class="cr-note">Video stays on this device — Trending has no upload server yet, so it plays for you and is kept with your posts here.</p>
      ${draftsRow()}`;
  }

  function pollScreen() {
    return `
      <label class="cr-label">Question<input type="text" data-crf="question" value="${esc(D.question)}" placeholder="Ask something" maxlength="140"></label>
      <div class="cr-opts">${D.options.map((o, i) => `
        <div class="cr-opt">
          <input type="text" data-cropt="${i}" value="${esc(o)}" placeholder="Option ${i + 1}" maxlength="60">
          ${D.options.length > 2 ? `<button type="button" class="cr-x" data-cr="dropopt" data-v="${i}" aria-label="Remove option ${i + 1}">${ico('close')}</button>` : ''}
        </div>`).join('')}</div>
      ${D.options.length < 6 ? `<button type="button" class="cr-add" data-cr="addopt">${ico('add')}Add option</button>` : ''}
      <div class="cr-pickrow">
        <button type="button" class="cr-pick" data-cr="gallery">${ico('image')}<span>Add image</span></button>
        <button type="button" class="cr-pick" data-cr="camera">${ico('photo_camera')}<span>Camera</span></button>
      </div>
      ${mediaGrid()}
      <label class="cr-label">Runs for<select data-crf="days">${[1, 3, 7, 14].map(d => `<option value="${d}"${+D.days === d ? ' selected' : ''}>${d} day${d > 1 ? 's' : ''}</option>`).join('')}</select></label>
      <button type="button" class="cr-field" data-cr="toggle" data-v="comments">${ico(D.comments ? 'chat' : 'chat_bubble_outline')}<span><b>Comments</b><em>${D.comments ? 'Anyone can reply' : 'Turned off'}</em></span>${ico(D.comments ? 'toggle_on' : 'toggle_off')}</button>
      ${audienceRow()}
      <p class="cr-note">Results show as percentages once people vote. Votes are counted on this device while Trending has no server.</p>`;
  }

  function storyScreen() {
    const mine = myStories();
    return `
      <div class="cr-pickrow cr-pickrow-3">
        <button type="button" class="cr-pick big" data-cr="camera">${ico('photo_camera')}<span>Camera</span></button>
        <button type="button" class="cr-pick big" data-cr="gallery">${ico('image')}<span>Gallery</span></button>
        <button type="button" class="cr-pick big${D.bg >= 0 ? ' on' : ''}" data-cr="bg">${ico('text_fields')}<span>Text</span></button>
      </div>
      ${mediaGrid()}${filterRow()}
      ${D.bg >= 0 && !D.media.length ? `<div class="cr-bgs">${BGS.map((b, i) => `<button type="button" class="cr-bg${D.bg === i ? ' on' : ''}" style="background:${b}" data-cr="setbg" data-v="${i}" aria-label="Background ${i + 1}"></button>`).join('')}</div>
        <div class="cr-storyprev" style="background:${BGS[Math.max(0, D.bg)]}"><textarea data-crf="caption" rows="3" placeholder="Type something…" aria-label="Story text">${esc(D.caption)}</textarea></div>`
      : `<label class="cr-label">Text on your story<input type="text" data-crf="caption" value="${esc(D.caption)}" placeholder="Say something (optional)" maxlength="140"></label>`}
      ${audienceRow()}
      ${mine.length ? `<div class="cr-mine"><b>Your story</b><span>${mine.length} item${mine.length === 1 ? '' : 's'} · disappears after 24 hours</span>
        <button type="button" class="cr-chip" data-cr="viewstory">View</button></div>` : ''}
      <p class="cr-note">Stories stay on this device for 24 hours. You can keep one on your profile as a highlight when you publish.</p>`;
  }

  function reelScreen() {
    const has = typeof SH !== 'undefined' && SH.openCreate;
    return `<div class="cr-hand">
        ${ico('slow_motion_video', 'cr-hand-i')}
        <b>Reels are made in the Shorty studio</b>
        <p>Record or upload clips, trim them, add a cover and publish — the studio already has the full set of reel tools.</p>
        <button type="button" class="btn btn-primary" data-cr="reelgo"${has ? '' : ' disabled'}>${has ? 'Open the Shorty studio' : 'Shorty is still loading'}</button>
      </div>`;
  }

  function liveScreen() {
    return `
      <div class="cr-livecam">
        <video id="cr-live-prev" playsinline muted></video>
        <button type="button" class="cr-chip cr-livecam-b" data-cr="livecheck">${ico('videocam')}Check camera</button>
      </div>
      <label class="cr-label">Title<input type="text" data-crf="title" value="${esc(D.title)}" placeholder="What is the stream about?" maxlength="120"></label>
      <label class="cr-label">Category<select data-crf="category">${CATEGORIES.map(c => `<option value="${c}"${D.category === c ? ' selected' : ''}>${c[0].toUpperCase() + c.slice(1)}</option>`).join('')}</select></label>
      ${audienceRow()}
      <button type="button" class="cr-field" data-cr="toggle" data-v="comments">${ico('forum')}<span><b>Comments during the stream</b><em>${D.comments ? 'On' : 'Off'}</em></span>${ico(D.comments ? 'toggle_on' : 'toggle_off')}</button>
      <div class="cr-warn">${ico('info')}<span><b>Going live needs a streaming server</b>Trending has none yet, so nothing is broadcast. You can check your camera and sound here, and post an announcement so people know when you plan to stream.</span></div>
      <button type="button" class="btn btn-primary w100" data-cr="announce">Post a "going live" announcement</button>`;
  }

  const draftsRow = () => {
    const list = drafts();
    if (!list.length) return '';
    return `<div class="cr-drafts"><b>Drafts</b>${list.slice(0, 6).map(d => `
      <span class="cr-draft">
        <button type="button" data-cr="draft" data-v="${esc(d.id)}">${esc((d.caption || d.title || d.question || 'Untitled').slice(0, 28))}</button>
        <button type="button" class="cr-x" data-cr="dropdraft" data-v="${esc(d.id)}" aria-label="Delete draft">${ico('close')}</button>
      </span>`).join('')}</div>`;
  };

  /* The row that changes with the mode: gallery, shutter, next. */
  function camRow() {
    const last = [...D.media].reverse().find(m => m.kind === 'image');
    return `<button type="button" class="cr-gal" data-cr="gallery" aria-label="Pick from gallery">${
        last ? `<img src="${esc(last.src)}" alt="" style="filter:${esc(filterOf(D.filter)) || 'none'}">` : ico('image')
      }${D.media.length ? `<b>${D.media.length}</b>` : ''}</button>
      ${D.mode === 'live'
        ? `<button type="button" class="btn btn-primary cr-golive" data-cr="livesetup">Set up your stream</button>`
        : `<button type="button" id="cr-shutter" class="cr-shutter" data-cr="shutter"
             aria-label="${D.mode === 'video' ? 'Start or stop recording' : 'Take a photo, hold to record'}">
            <svg viewBox="0 0 80 80" aria-hidden="true"><circle class="cr-ring-bg" cx="40" cy="40" r="36"></circle><circle id="cr-ring" class="cr-ring" cx="40" cy="40" r="36"></circle></svg>
            <i></i></button>`}
      ${D.media.length
        ? `<button type="button" class="cr-next" data-cr="camnext">Next${ico('arrow_forward')}</button>`
        : `<span class="cr-gal ghost" aria-hidden="true"></span>`}`;
  }

  function cameraScreen() {
    return `<div class="cr-camwrap" id="cr-camwrap" data-mode="${D.mode}">
      <video id="cr-cam" class="cr-camvid${cam && cam.facing === 'user' ? ' mirror' : ''}" playsinline muted autoplay></video>
      <span class="cr-cam-grad t" aria-hidden="true"></span>
      <span class="cr-cam-grad b" aria-hidden="true"></span>
      <span class="cr-flash" id="cr-flash" aria-hidden="true"></span>

      <div class="cr-cam-wait" aria-hidden="true"><span class="cr-cam-spin"></span>Waking the camera…</div>

      <div class="cr-cam-top">
        <button type="button" class="cr-ib" data-cr="close" aria-label="Close">${ico('close')}</button>
        <span class="cr-rec-slot"><span class="cr-rec-pill"><i></i><span id="cr-rec-time"></span></span></span>
        <span class="cr-cam-tools">
          ${D.mode === 'post' || D.mode === 'story'
            ? `<button type="button" class="cr-ib" data-cr="towrite" aria-label="Write instead" title="Write instead">${ico('text_fields')}</button>` : ''}
          <button type="button" class="cr-ib cr-fxb" data-cr="fx" aria-label="Filters" title="Filters" aria-pressed="${camFx}">${ico('auto_awesome')}</button>
          <button type="button" class="cr-ib" data-cr="flip" aria-label="Switch camera" title="Switch camera">${ico('cameraswitch')}</button>
        </span>
      </div>

      <div class="cr-cam-live"${D.mode === 'live' ? '' : ' hidden'}>${ico('info')}<span>Trending cannot broadcast yet — this is a camera and sound check.</span></div>

      <div class="cr-cam-off" id="cr-cam-off" hidden>
        ${ico('videocam_off', 'cr-off-i')}
        <b>The camera is not available here</b>
        <p id="cr-cam-note"></p>
        <span class="cr-cam-off-b">
          <button type="button" class="btn btn-primary btn-sm" data-cr="gallery">Choose from gallery</button>
          <button type="button" class="cr-chip" data-cr="retry">Try again</button>
          <button type="button" class="cr-chip" data-cr="camback">Write instead</button>
        </span>
      </div>

      <div class="cr-cam-foot">
        ${fxRail(false, '')}
        <div class="cr-cam-row" id="cr-cam-row">${camRow()}</div>
        <span class="cr-cam-hint" id="cr-cam-hint">${esc(HINT[D.mode] || '')}</span>
        ${modeStrip(true)}
      </div>
    </div>`;
  }

  /* Switching mode should never blink the picture, so the chrome around
     the camera is updated in place instead of repainted. */
  function syncCam() {
    const wrap = $('cr-camwrap');
    if (!wrap) return false;
    wrap.dataset.mode = D.mode;
    const row = $('cr-cam-row');
    if (row) { row.innerHTML = camRow(); wireShutter(); }
    const hint = $('cr-cam-hint');
    if (hint) hint.textContent = HINT[D.mode] || '';
    const live = wrap.querySelector('.cr-cam-live');
    if (live) live.hidden = D.mode !== 'live';
    wrap.querySelectorAll('.cr-mode').forEach(b => {
      const on = b.dataset.v === D.mode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
    });
    centerMode();
    applyLiveFilter();
    return true;
  }

  function body() {
    if (view === 'camera') return cameraScreen();
    switch (D.mode) {
      case 'story': return storyScreen();
      case 'reel': return reelScreen();
      case 'video': return videoScreen();
      case 'poll': return pollScreen();
      case 'live': return liveScreen();
      default: return postScreen();
    }
  }

  const ACTION = { post: 'Post', story: 'Share story', video: 'Publish', poll: 'Publish poll', reel: '', live: '' };

  function paint() {
    const el = $('cr-sheet');
    if (!el) return;
    const onCam = view === 'camera';
    const act = ACTION[D.mode];
    el.classList.toggle('cam', onCam);
    el.innerHTML = `<div class="cr-in" role="dialog" aria-modal="true" aria-label="Create">
      ${onCam ? '' : `<div class="cr-head">
        <button type="button" class="cr-ib" data-cr="close" aria-label="Close">${ico('close')}</button>
        <b>Create</b>
        <span class="cr-head-a">
          ${D.mode === 'post' || D.mode === 'video' || D.mode === 'story' ? `<button type="button" class="cr-ib" data-cr="savedraft" aria-label="Save draft" title="Save draft">${ico('bookmark_add')}</button>` : ''}
          ${act ? `<button type="button" class="btn btn-primary btn-sm" data-cr="publish">${act}</button>` : ''}
        </span>
      </div>
      ${modeStrip()}`}
      <div class="cr-body">${body()}</div>
    </div>`;
    if (onCam) {
      if (cam && cam.stream) mountCam();
      wireShutter();
      centerMode();
    }
  }

  /* ── Actions ─────────────────────────────────────────────────────── */
  function act(what, v, el) {
    switch (what) {
      case 'close': close(); return;
      case 'mode': setMode(v); return;
      case 'camera': openCamera(); return;
      case 'camback': stopCamera(); view = 'compose'; paint(); return;
      case 'camnext': stopCamera(); view = 'compose'; paint(); return;
      case 'retry': openCamera(cam && cam.facing); return;
      case 'towrite': stopCamera(); view = 'compose'; if (D.mode === 'story' && !D.media.length) D.bg = 0; paint(); return;
      case 'livesetup': stopCamera(); view = 'compose'; paint(); return;
      case 'flip': flip(); return;
      case 'shutter': return;                       // handled by pointer events
      case 'fx': camFx = !camFx; {
        const r = $('cr-fxrail'), b = el || document.querySelector('[data-cr="fx"]');
        if (r) r.classList.toggle('on', camFx);
        if (b) b.setAttribute('aria-pressed', camFx);
        if (camFx) applyLiveFilter();
      } return;
      case 'gallery': pick(D.mode === 'post' || D.mode === 'story'); return;
      case 'filters': stopCamera(); view = 'compose'; paint(); toast('Pick a photo, then choose a filter under it.'); return;
      case 'drop': D.media.splice(+v, 1); paint(); return;
      case 'filter':
        D.filter = v;
        if (view === 'camera') { applyLiveFilter(); const g = document.querySelector('.cr-gal img'); if (g) g.style.filter = filterOf(v) || 'none'; return; }
        paint();
        return;
      case 'bg': D.bg = D.bg >= 0 ? -1 : 0; if (view === 'camera') { stopCamera(); view = 'compose'; } paint(); return;
      case 'setbg': D.bg = +v; paint(); return;
      case 'ins': insert(v); return;
      case 'place': place(); return;
      case 'audience': audience(); return;
      case 'toggle': D[v] = !D[v]; paint(); return;
      case 'addopt': if (D.options.length < 6) { D.options.push(''); paint(); } return;
      case 'dropopt': D.options.splice(+v, 1); paint(); return;
      case 'savedraft': saveDraft(); paint(); return;
      case 'draft': loadDraft(v); return;
      case 'dropdraft': dropDraft(v); return;
      case 'viewstory': viewMyStory(); return;
      case 'reelgo': close(); if (typeof SH !== 'undefined' && SH.openCreate) SH.openCreate(); return;
      case 'livecheck': liveCheck(); return;
      case 'announce': announce(); return;
      case 'publish': publish(); return;
    }
  }

  function setMode(m) {
    if (!MODES.some(x => x[0] === m) || m === D.mode) return;
    // Media that still makes sense for the new mode is kept.
    const keepVideo = m === 'reel' || m === 'video' || m === 'story' || m === 'post';
    D.media = D.media.filter(x => x.kind === 'image' ? m !== 'reel' && m !== 'video' : keepVideo);
    if (m === 'video' && D.media.length > 1) D.media = D.media.slice(0, 1);
    D.mode = m;
    if (m === 'live' || m === 'reel') D.bg = -1;
    if (view === 'camera') {
      if (cam && cam.rec) stopRec();
      if (camMode(m) && syncCam()) return;         // the picture keeps running
      stopCamera();
      view = 'compose';
    }
    paint();
  }

  function publish() {
    if (D.mode === 'post') Publisher.post();
    else if (D.mode === 'video') Publisher.video();
    else if (D.mode === 'poll') Publisher.poll();
    else if (D.mode === 'story') Publisher.story();
  }

  function insert(t) {
    const box = document.querySelector('#cr-sheet [data-crf="caption"]');
    if (!box) return;
    const at = box.selectionStart != null ? box.selectionStart : box.value.length;
    box.value = box.value.slice(0, at) + t + box.value.slice(at);
    D.caption = box.value;
    box.focus();
    try { box.setSelectionRange(at + t.length, at + t.length); } catch (e) {}
  }
  async function place() {
    if (typeof appPrompt !== 'function') return;
    const v = await appPrompt('Where was this?', D.location, { title: 'Add a place', ok: 'Save' });
    if (v == null) return;
    D.location = String(v).slice(0, 60);
    paint();
  }
  function audience() {
    const el = document.createElement('div');
    el.className = 'mob-scrim';
    el.id = 'cr-aud';
    el.innerHTML = `<div class="mob-sheet" role="dialog" aria-modal="true" aria-label="Audience">
      <span class="mob-grab" aria-hidden="true"></span>
      ${AUDIENCES.map(([k, l, i]) => `<button type="button" class="pg-row" data-a="${k}">${ico(i)}<span>${l}</span>${D.audience === k ? ico('check') : ''}</button>`).join('')}
      <p class="cr-note">Audience is saved with the post. Sharing rules are enforced on this device until Trending has accounts on a server.</p>
    </div>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (b) { D.audience = b.dataset.a; el.remove(); paint(); return; }
      if (e.target === el) el.remove();
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));
  }

  async function liveCheck() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const v = $('cr-live-prev');
      if (v) { v.srcObject = stream; v.play().catch(() => {}); }
      cam = { stream, facing: 'user' };
      toast('Camera and microphone are working.');
    } catch (e) { toast('The camera or microphone was not allowed.'); }
  }
  function announce() {
    const t = D.title.trim();
    D.caption = t ? `Going live soon: ${t} 🔴` : 'Going live soon 🔴';
    D.mode = 'post';
    D.media = [];
    stopCamera();
    paint();
    toast('Announcement ready — tap Post to share it.');
  }

  /* Your own story, played back with the highlights player when it is
     around, so there is one story viewer rather than two. */
  function viewMyStory() {
    const mine = myStories();
    if (!mine.length) { toast('You have no story right now.'); return; }
    close();
    openStoryViewerLocal(mine);
  }
  function openStoryViewerLocal(items) {
    const el = document.createElement('div');
    el.className = 'cr-viewer';
    el.innerHTML = `<div class="cr-viewer-in">
      <div class="cr-viewer-bars">${items.map((_, i) => `<span><i id="cr-vb-${i}"></i></span>`).join('')}</div>
      <button type="button" class="cr-ib cr-viewer-x" aria-label="Close">${ico('close')}</button>
      <div class="cr-viewer-frame" id="cr-viewer-frame"></div>
    </div>`;
    document.body.appendChild(el);
    let i = 0, timer = null;
    const show = () => {
      const f = items[i];
      const box = el.querySelector('#cr-viewer-frame');
      box.innerHTML = f.kind === 'image' ? `<img src="${esc(f.src)}" alt="">`
        : f.kind === 'video' ? `<video src="${esc(f.src)}" autoplay playsinline controls></video>`
        : `<div class="cr-viewer-text" style="background:${esc(f.bg || BGS[0])}"><p>${esc(f.text || '')}</p></div>`;
      if (f.kind !== 'video' && f.text) box.insertAdjacentHTML('beforeend', `<span class="cr-viewer-cap">${esc(f.text)}</span>`);
      items.forEach((_, k) => { const b = el.querySelector('#cr-vb-' + k); if (b) b.style.width = k < i ? '100%' : k === i ? '0%' : '0%'; });
      const bar = el.querySelector('#cr-vb-' + i);
      const start = Date.now();
      clearInterval(timer);
      timer = setInterval(() => {
        const p = Math.min(1, (Date.now() - start) / 5000);
        if (bar) bar.style.width = (p * 100) + '%';
        if (p >= 1) { i++; if (i >= items.length) done(); else show(); }
      }, 60);
    };
    const done = () => { clearInterval(timer); el.remove(); document.removeEventListener('keydown', key, true); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); done(); } };
    el.addEventListener('click', e => {
      if (e.target.closest('.cr-viewer-x')) return done();
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left + r.width * 0.33) { i = Math.max(0, i - 1); show(); }
      else { i++; if (i >= items.length) done(); else show(); }
    });
    document.addEventListener('keydown', key, true);
    requestAnimationFrame(() => el.classList.add('open'));
    show();
  }

  /* ── Open and close ──────────────────────────────────────────────── */
  let from = null;
  /* open('story') lands on the camera, open('post', 'compose') on the form. */
  function open(mode, at) {
    if ($('cr-sheet')) return;
    from = document.activeElement;
    D = blank();
    if (mode && MODES.some(m => m[0] === mode)) D.mode = mode;
    camFx = true;
    view = (at !== 'compose' && camMode(D.mode) && D.mode !== 'poll' && hasCam()) ? 'camera' : 'compose';
    const el = document.createElement('div');
    el.id = 'cr-sheet';
    el.className = 'cr-sheet';
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-cr]');
      if (b) { e.preventDefault(); act(b.dataset.cr, b.dataset.v, b); return; }
      if (e.target === el) close();
    });
    el.addEventListener('input', e => {
      const f = e.target.closest('[data-crf]');
      if (f) { D[f.dataset.crf] = f.value; return; }
      const o = e.target.closest('[data-cropt]');
      if (o) D.options[+o.dataset.cropt] = o.value;
    });
    el.addEventListener('change', e => {
      const f = e.target.closest('[data-crf]');
      if (f && (f.tagName === 'SELECT')) { D[f.dataset.crf] = f.value; paint(); }
    });
    document.addEventListener('keydown', key, true);
    paint();
    requestAnimationFrame(() => el.classList.add('open'));
    if (view === 'camera') openCamera();
  }
  function close() {
    stopCamera();
    view = 'compose';
    const el = $('cr-sheet');
    if (el) el.remove();
    document.removeEventListener('keydown', key, true);
    if (from && document.contains(from)) { try { from.focus({ preventScroll: true }); } catch (e) {} }
    from = null;
  }
  function key(e) {
    if (e.key !== 'Escape' || !$('cr-sheet')) return;
    if (document.querySelector('.mob-dialog-scrim, #cr-aud')) return;
    e.preventDefault(); e.stopPropagation();
    if (view === 'camera') { stopCamera(); view = 'compose'; paint(); return; }
    close();
  }

  return {
    open, close, paint, act, publish, setMode, addFiles, openCamera,
    myStories, viewMyStory, openStoryViewerLocal, drafts,
    MODES, BGS, FILTERS,
    get draft() { return D; }
  };
})();

window.CR = CR;

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
publish('features/create.js', {
  CR: () => CR
});
