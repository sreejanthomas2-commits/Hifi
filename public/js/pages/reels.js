/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SHORTY — short video, built on real <video>                     ║
   ║                                                                  ║
   ║  The previous hub had no video in it: every "short" was a        ║
   ║  coloured panel with an icon, the camera was a label reading     ║
   ║  "Simulated Viewfinder", and most buttons only raised a toast.   ║
   ║                                                                  ║
   ║  What this does instead:                                         ║
   ║   · Hub grid with live previews (Instagram Explore shape)        ║
   ║   · Full-screen vertical player that snaps short to short, and   ║
   ║     only plays the one on screen (Reels + Shorts)                ║
   ║   · Instagram: double-tap like, save, remix, audio label         ║
   ║   · YouTube: dislike, subscribe, scrub bar, keyboard, native PiP ║
   ║   · Both: comments sheet, share, mute, loop, view counts         ║
   ║   · Crypto: tip the creator from the player                      ║
   ║   · Upload a real video — kept in IndexedDB, so it survives      ║
   ║     a reload; object URLs alone would not                        ║
   ║                                                                  ║
   ║  Sample clips: MDN's CC0 set and test-videos.co.uk. Google's     ║
   ║  public sample bucket, the usual demo source, now returns 403.   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const SH = (() => {

  const KEY = 'ts_shorty';
  const DB_NAME = 'trending-shorty';
  const STORE = 'videos';
  const MAX_BYTES = 100 * 1024 * 1024;   // 100 MB
  const MAX_SECONDS = 180;               // Shorts and Reels both cap at 3 min
  const VIEW_AFTER_MS = 2000;            // a view counts after 2s of playback

  const MDN = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos';
  const TV = 'https://test-videos.co.uk/vids';

  const CATALOG = [
    { id: 's1', src: `${MDN}/flower.mp4`, creator: 'Mia Tanaka', handle: '@miatanaka',
      caption: 'Macro mornings — slowed right down so you catch every petal opening. #macro #nature #slowmo',
      audio: 'Original audio · Mia Tanaka', likes: 48200, views: 1240000, comments: 3 },
    { id: 's2', src: `${TV}/jellyfish/mp4/h264/720/Jellyfish_720_10s_2MB.mp4`, creator: 'Deep Blue', handle: '@deepblue',
      caption: 'Ten seconds of calm before the market opens. Put the sound on. #ocean #calm #reset',
      audio: 'Ambient Tide · Deep Blue', likes: 91400, views: 3200000, comments: 3 },
    { id: 's3', src: `${TV}/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4`, creator: 'Frame by Frame', handle: '@framebyframe',
      caption: 'Animation study — watch the timing on the ears. Every frame is doing work. #animation #motion',
      audio: 'Original audio · Frame by Frame', likes: 27600, views: 780000, comments: 3 },
    { id: 's4', src: `${TV}/sintel/mp4/h264/720/Sintel_720_10s_2MB.mp4`, creator: 'Short Film Club', handle: '@shortfilmclub',
      caption: 'Open-source short film, and still better lit than most blockbusters. #film #cgi #opensource',
      audio: 'Sintel OST · Blender Studio', likes: 63900, views: 2100000, comments: 3,
      zoom: 1.35 },   // letterboxed 2.39:1 source — crop the baked-in bars
    { id: 's5', src: `${MDN}/friday.mp4`, creator: 'Weekend Mode', handle: '@weekendmode',
      caption: 'Friday energy. Logging off, see you Monday. #friday #weekend',
      audio: 'Original audio · Weekend Mode', likes: 15300, views: 410000, comments: 3 }
  ];

  const SEED_COMMENTS = [
    ['Sam Okafor', 'This is so clean 🔥'],
    ['Priya Anand', 'Watched it five times, not even sorry'],
    ['Kenji Sato', 'What did you shoot this on?']
  ];

  const TABS = [
    ['foryou',    'For You',   'auto_awesome'],
    ['following', 'Following', 'group'],
    ['trending',  'Trending',  'local_fire_department'],
    ['saved',     'Saved',     'bookmark'],
    ['mine',      'Yours',     'video_library']
  ];

  const DEFAULT = {
    tab: 'foryou', muted: true, liked: {}, disliked: {}, saved: {}, subs: {},
    comments: {}, views: {}, uploads: []
  };

  let D = load();
  let blobUrls = {};          // upload id -> object URL, rebuilt each session
  let feed = [];              // the list the viewer is currently swiping through
  let active = -1;
  let observer = null;
  let viewTimer = null;
  let countedThisSession = {};
  let startIdx = 0;           // which short the viewer was opened on

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const initials = n => String(n || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  /* Discover listens to these to learn what someone enjoys watching. */
  const emit = (type, detail) => { try { window.dispatchEvent(new CustomEvent('shorty:' + type, { detail })); } catch (e) {} };

  function compact(n) {
    n = n || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  /* Captions render hashtags as tappable tags; everything else is escaped. */
  function captionHTML(text) {
    return esc(text).replace(/#([\p{L}\p{N}_]+)/gu, '<span class="sh-tag">#$1</span>');
  }

  /* ── IndexedDB for uploaded videos ───────────────────────────────── */
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function putBlob(id, blob) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  async function getBlob(id) {
    const db = await idb();
    return new Promise((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  }
  async function delBlob(id) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  /* Object URLs die with the page, so each session re-reads the stored
     blobs. An upload whose blob is gone (storage cleared) is dropped
     rather than left as a dead tile. */
  /* Which blobs a saved upload needs. The first uploads were one file
     under the record's own id; a studio reel keeps one blob per clip plus
     its cover and any imported audio. */
  function blobIdsOf(u) {
    const video = (u.clipIds && u.clipIds.length) ? u.clipIds.map(c => c.id) : [u.id];
    const extra = [];
    if (u.cover) extra.push(u.cover);
    if (u.edit && u.edit.music && u.edit.music.blobId) extra.push(u.edit.music.blobId);
    return { video, extra };
  }

  async function hydrateUploads() {
    const keep = [];
    for (const u of D.uploads) {
      const { video, extra } = blobIdsOf(u);
      let playable = true;
      for (const id of video.concat(extra)) {
        if (blobUrls[id]) continue;
        try {
          const blob = await getBlob(id);
          if (blob) blobUrls[id] = URL.createObjectURL(blob);
          else if (video.indexOf(id) > -1) playable = false;
        } catch (e) { /* storage hiccup — keep it and let playback try */ }
      }
      if (playable) keep.push(u);
    }
    if (keep.length !== D.uploads.length) { D.uploads = keep; save(); }
  }

  /* ── Library ─────────────────────────────────────────────────────── */
  /* A studio reel carries its edit with it: the clip list with each
     trim, the filter, the overlays and the music. `reel` is exactly what
     the shared engine in Studio expects, so the player reproduces what
     was edited rather than approximating it. */
  function uploadsAsShorts() {
    return D.uploads.map(u => {
      const studio = !!(u.clipIds && u.clipIds.length);
      const base = { ...u, mine: true, audio: u.audio || 'Original audio · You', likes: 0, views: 0, comments: 0 };

      if (!studio) {
        if (!blobUrls[u.id]) return null;
        return { ...base, src: blobUrls[u.id] };
      }

      const clips = u.clipIds.filter(c => blobUrls[c.id]).map(c => ({
        url: blobUrls[c.id], in: c.in || 0, out: c.out || 0, speed: c.speed || 1, mute: !!c.mute
      }));
      if (!clips.length) return null;

      const e = u.edit || {};
      const music = e.music
        ? { ...e.music, src: e.music.blobId ? (blobUrls[e.music.blobId] || '') : (e.music.src || '') }
        : null;

      return {
        ...base,
        src: clips[0].url,
        coverUrl: u.cover ? (blobUrls[u.cover] || '') : '',
        reel: {
          clips,
          filter: e.filter || 'none',
          adj: e.adj || {},
          texts: e.texts || [],
          stickers: e.stickers || [],
          captions: e.captions || null,
          origVol: e.origVol == null ? 1 : e.origVol,
          music: music && music.src ? music : null
        }
      };
    }).filter(Boolean);
  }
  const all = () => [...uploadsAsShorts(), ...CATALOG];
  const byId = id => all().find(s => s.id === id);

  const likeCount = s => (s.likes || 0) + (D.liked[s.id] ? 1 : 0);
  const viewCount = s => (s.views || 0) + (D.views[s.id] || 0);
  const commentList = s => {
    if (!D.comments[s.id]) {
      D.comments[s.id] = s.mine ? [] : SEED_COMMENTS.map(([name, text], i) => ({
        id: 'c' + i, name, text, ts: Date.now() - (i + 1) * 3600000, likes: 12 - i * 4, liked: false
      }));
    }
    return D.comments[s.id];
  };

  function listFor(tab) {
    const every = all();
    switch (tab) {
      case 'following': return every.filter(s => D.subs[s.handle]);
      case 'trending':  return every.slice().sort((a, b) => viewCount(b) - viewCount(a));
      case 'saved':     return every.filter(s => D.saved[s.id]);
      case 'mine':      return every.filter(s => s.mine);
      default:          return every;
    }
  }

  /* ── Hub ─────────────────────────────────────────────────────────── */
  async function paintHub() {
    const root = document.getElementById('sh-root');
    if (!root) return;
    await hydrateUploads();

    const list = listFor(D.tab);
    const empty = {
      following: ['group', 'Subscribe to a creator in the player and their shorts land here.'],
      saved:     ['bookmark', 'Tap save on any short to keep it here.'],
      mine:      ['video_library', 'Record or import a video in the studio and it lands here — stored on this device.']
    }[D.tab];

    root.innerHTML = `
      <div class="sh-tabs">
        ${TABS.map(([k, l, i]) => `
          <button class="sh-tab${D.tab === k ? ' active' : ''}" onclick="SH.setTab('${k}')">
            <span class="material-symbols-rounded">${i}</span>${l}
          </button>`).join('')}
      </div>
      ${list.length ? `<div class="sh-grid">${list.map((s, i) => tileHTML(s, i)).join('')}</div>`
        : `<div class="sh-empty">
             <span class="material-symbols-rounded">${empty ? empty[0] : 'movie'}</span>
             <p>${esc(empty ? empty[1] : 'Nothing here yet.')}</p>
             ${D.tab === 'mine' ? '<button class="btn btn-primary" onclick="SH.openCreate()">Create a reel</button>' : ''}
           </div>`}`;

    wireTilePreviews(root);
  }

  function tileHTML(s, i) {
    const look = s.reel && window.STU ? STU.filterCSS(s.reel) : '';
    const style = [s.zoom ? `transform:scale(${s.zoom})` : '', look && look !== 'none' ? `filter:${look}` : ''].filter(Boolean).join(';');
    const media = s.coverUrl
      ? `<img class="sh-tile-v" src="${esc(s.coverUrl)}" alt="">
         <video class="sh-tile-v hov" data-src="${esc(s.src)}" muted loop playsinline preload="none"${style ? ` style="${style}"` : ''}></video>`
      : `<video class="sh-tile-v" src="${esc(s.src)}#t=0.5" muted loop playsinline preload="metadata"${style ? ` style="${style}"` : ''}></video>`;
    return `<button class="sh-tile" onclick="SH.openAt(${i})" aria-label="Play short by ${esc(s.creator)}">
      ${media}
      <span class="sh-tile-shade"></span>
      <span class="sh-tile-views"><span class="material-symbols-rounded">play_arrow</span>${compact(viewCount(s))}</span>
      ${s.mine ? '<span class="sh-tile-badge">Yours</span>' : ''}
      ${D.saved[s.id] ? '<span class="sh-tile-saved material-symbols-rounded">bookmark</span>' : ''}
    </button>`;
  }

  /* Tiles preview on hover and rest on a still frame otherwise — the grid
     never plays a dozen videos at once. */
  function wireTilePreviews(root) {
    root.querySelectorAll('.sh-tile').forEach(tile => {
      const v = tile.querySelector('video');
      if (!v) return;
      tile.addEventListener('mouseenter', () => {
        // Cover tiles hold their video back until it's wanted.
        if (v.dataset.src && !v.getAttribute('src')) { v.src = v.dataset.src; v.load(); }
        v.classList.add('show');
        v.play().catch(() => {});
      });
      tile.addEventListener('mouseleave', () => {
        v.pause();
        v.classList.remove('show');
        try { v.currentTime = 0.5; } catch (e) {}
      });
    });
  }

  function setTab(t) { D.tab = t; save(); paintHub(); }

  /* ── Viewer ──────────────────────────────────────────────────────── */
  async function openAt(index, list, opts) {
    await hydrateUploads();
    feed = list || listFor(D.tab);
    if (!feed.length) { toast('Nothing to play here yet.'); return; }
    const start = Math.max(0, Math.min(index || 0, feed.length - 1));
    startIdx = start;

    // A tile's hover preview is still playing when you click it — the
    // player covers the tile, so mouseleave never fires to stop it.
    document.querySelectorAll('.sh-tile video').forEach(x => x.pause());

    closeViewer(true);
    moreFn = opts && typeof opts.more === 'function' ? opts.more : null;
    const v = document.createElement('div');
    v.id = 'sh-viewer';
    v.className = 'sh-viewer';
    v.innerHTML = `
      <div class="sh-top">
        <button class="sh-round" onclick="SH.close()" aria-label="Close"><span class="material-symbols-rounded">close</span></button>
        <div class="sh-top-title">Shorty</div>
        <div class="sh-top-right">
          ${document.pictureInPictureEnabled ? `<button class="sh-round" onclick="SH.pip()" aria-label="Picture in picture"><span class="material-symbols-rounded">picture_in_picture_alt</span></button>` : ''}
          <button class="sh-round" id="sh-mute" onclick="SH.toggleMute()" aria-label="Mute"><span class="material-symbols-rounded">${D.muted ? 'volume_off' : 'volume_up'}</span></button>
        </div>
      </div>
      <div class="sh-feed" id="sh-feed">${feed.map((s, i) => panelHTML(s, i)).join('')}</div>
      <div class="sh-hint">↑ ↓ to swipe · Space to pause · M to mute · L to like</div>`;
    document.body.appendChild(v);
    document.body.classList.add('sh-open');

    wirePanels();
    const target = document.getElementById('sh-panel-' + start);
    if (target) target.scrollIntoView({ block: 'start' });
    document.addEventListener('keydown', onKey);
    // Play the opened short straight away rather than waiting for the
    // observer's first report — that report only arrives once the page
    // paints, so a busy or throttled page could leave it sitting still.
    // activate() ignores a repeat for the same index, so the observer
    // agreeing a moment later is harmless.
    activate(start);
  }

  function panelHTML(s, i) {
    const liked = !!D.liked[s.id], disliked = !!D.disliked[s.id], saved = !!D.saved[s.id];
    const subbed = !!D.subs[s.handle];
    return `
      <section class="sh-panel" id="sh-panel-${i}" data-i="${i}">
        <div class="sh-stage">
          ${s.reel
            ? `<video class="sh-video" playsinline preload="${i === startIdx ? 'auto' : 'metadata'}"${D.muted ? ' muted' : ''}></video>
               <div class="stu-ov sh-ov"></div>
               <audio class="sh-music" loop></audio>`
            : `<video class="sh-video" src="${esc(s.src)}" loop playsinline preload="${i === startIdx ? 'auto' : Math.abs(i - startIdx) <= 2 ? 'metadata' : 'none'}"
                 ${D.muted ? 'muted' : ''}${s.zoom ? ` style="transform:scale(${s.zoom})"` : ''}></video>`}
          <div class="sh-tap" data-i="${i}"></div>
          <div class="sh-pause-ic material-symbols-rounded">play_arrow</div>

          <div class="sh-meta">
            <div class="sh-creator">
              <span class="sh-av">${esc(initials(s.creator))}</span>
              <span class="sh-handle">${esc(s.handle)}</span>
              ${s.mine ? '' : `<button class="sh-sub${subbed ? ' on' : ''}" onclick="SH.subscribe(${i})">${subbed ? 'Subscribed' : 'Subscribe'}</button>`}
            </div>
            <div class="sh-caption" onclick="this.classList.toggle('open')">${captionHTML(s.caption)}</div>
            ${s.meta && (s.meta.place || (s.meta.tagged || []).length) ? `<div class="sh-extra">
              ${s.meta.place ? `<span class="sh-chip-x"><span class="material-symbols-rounded">location_on</span>${esc(s.meta.place)}</span>` : ''}
              ${(s.meta.tagged || []).length ? `<span class="sh-chip-x"><span class="material-symbols-rounded">person</span>${esc(s.meta.tagged.join(', '))}</span>` : ''}
            </div>` : ''}
            <div class="sh-audio"><span class="material-symbols-rounded">music_note</span><span class="sh-audio-t">${esc(s.audio)}</span></div>
          </div>

          <div class="sh-rail">
            <button class="sh-act sh-like${liked ? ' on' : ''}" onclick="SH.like(${i})" aria-label="Like">
              <span class="material-symbols-rounded"${liked ? ' style="font-variation-settings:\'FILL\' 1"' : ''}>favorite</span>
              <b data-like="${i}">${compact(likeCount(s))}</b>
            </button>
            ${s.meta && s.meta.allowComments === false ? '' : `
            <button class="sh-act" onclick="SH.openComments(${i})" aria-label="Comments">
              <span class="material-symbols-rounded">mode_comment</span>
              <b data-cmt="${i}">${compact((s.comments || 0) + commentList(s).length - (s.mine ? 0 : SEED_COMMENTS.length))}</b>
            </button>`}
            <button class="sh-act" onclick="SH.share(${i})" aria-label="Share">
              <span class="material-symbols-rounded">send</span><b>Share</b>
            </button>
            <button class="sh-act sh-save${saved ? ' on' : ''}" onclick="SH.toggleSave(${i})" aria-label="${saved ? 'Saved' : 'Save'}">
              <span class="material-symbols-rounded"${saved ? ' style="font-variation-settings:\'FILL\' 1"' : ''}>bookmark</span>
              <b>${saved ? 'Saved' : 'Save'}</b>
            </button>
            ${s.mine ? '' : `<button class="sh-act sh-tip" onclick="SH.tip(${i})" aria-label="Tip in crypto">
                <span class="material-symbols-rounded">toll</span><b>Tip</b></button>`}
            <button class="sh-act sh-more-btn${disliked ? ' dot' : ''}" onclick="SH.more(${i})" aria-label="More: dislike, remix${s.mine ? ', delete' : ', feedback'}" aria-haspopup="dialog">
              <span class="material-symbols-rounded">more_horiz</span><b>More</b>
            </button>
          </div>

          <div class="sh-progress" data-i="${i}"><i></i></div>
        </div>
      </section>`;
  }

  function videoAt(i) { const p = document.getElementById('sh-panel-' + i); return p ? p.querySelector('video.sh-video') : null; }

  /* Studio reels are sequenced by the shared engine — several clips, each
     with its own trim and speed, plus overlays and music. Plain shorts
     stay on the <video> element's own playback. */
  let engines = {};
  const engineAt = i => engines[i] || null;

  function wirePanels(from) {
    from = from || 0;
    const root = document.getElementById('sh-feed');
    if (!root) return;

    // Only the short that's actually on screen plays.
    if (!observer) observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const i = Number(e.target.dataset.i);
        if (e.isIntersecting && e.intersectionRatio >= 0.6) activate(i);
      });
    }, { root, threshold: [0.6] });
    root.querySelectorAll('.sh-panel').forEach(p => { if (Number(p.dataset.i) >= from) observer.observe(p); });

    root.querySelectorAll('.sh-panel').forEach(p => {
      const i = Number(p.dataset.i);
      if (i < from) return;
      const v = p.querySelector('video');
      const bar = p.querySelector('.sh-progress');
      const fill = bar.querySelector('i');

      const s = feed[i];
      if (s && s.reel && window.STU) {
        engines[i] = STU.engine({
          video: v,
          overlay: p.querySelector('.sh-ov'),
          music: p.querySelector('.sh-music'),
          reel: s.reel,
          muted: D.muted,
          onTime: (t, tot) => { fill.style.width = (tot ? (t / tot) * 100 : 0) + '%'; }
        });
      } else {
        v.addEventListener('timeupdate', () => {
          if (v.duration) fill.style.width = (v.currentTime / v.duration * 100) + '%';
        });
        // A looping short jumping back to the start is a replay.
        let lastT = 0;
        v.addEventListener('timeupdate', () => {
          if (i === active && v.currentTime + 0.5 < lastT) loops++;
          lastT = v.currentTime;
        });
      }

      // Scrub: click or drag along the bar.
      const seek = ev => {
        const r = bar.getBoundingClientRect();
        const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
        const pct = Math.max(0, Math.min(1, x / r.width));
        const e = engineAt(i);
        if (e) e.seekPct(pct);
        else if (v.duration) v.currentTime = pct * v.duration;
      };
      bar.addEventListener('pointerdown', ev => {
        seek(ev);
        const move = e => seek(e);
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });

      // Single tap pauses; a second tap inside 260ms is a double-tap like.
      const tap = p.querySelector('.sh-tap');
      let last = 0, timer = null;
      tap.addEventListener('click', ev => {
        const now = Date.now();
        if (now - last < 260) {
          clearTimeout(timer); last = 0;
          heartBurst(p, ev.clientX, ev.clientY);
          if (!D.liked[feed[i].id]) like(i);
          return;
        }
        last = now;
        timer = setTimeout(() => togglePlay(i), 260);
      });
    });
  }

  let since = 0, loops = 0;
  let moreFn = null, fetchingMore = false;

  /* How long the last short stayed on screen, against its length. */
  function leaveActive() {
    const s = feed[active];
    if (!s || !since) return;
    const v = videoAt(active);
    emit('leave', { id: s.id, handle: s.handle, ms: Date.now() - since, duration: v && isFinite(v.duration) ? v.duration : 0, loops });
    since = 0; loops = 0;
  }

  /* Near the end of the list, ask whoever opened the player for more. */
  async function requestMore() {
    if (fetchingMore || !moreFn) return;
    fetchingMore = true;
    try {
      const more = await moreFn(feed.slice());
      const root = document.getElementById('sh-feed');
      if (root && more && more.length) {
        const from = feed.length;
        feed = feed.concat(more);
        root.insertAdjacentHTML('beforeend', more.map((s, k) => panelHTML(s, from + k)).join(''));
        wirePanels(from);
      }
    } catch (e) { /* the feed just ends */ }
    fetchingMore = false;
  }

  function activate(i) {
    if (i === active) return;
    leaveActive();
    const prevEngine = engineAt(active);
    if (prevEngine) prevEngine.pause();
    const prev = videoAt(active);
    if (prev) prev.pause();
    active = i;
    since = Date.now(); loops = 0;
    if (feed[i]) emit('active', { id: feed[i].id, index: i });
    if (moreFn && i >= feed.length - 2) requestMore();

    const v = videoAt(i);
    if (!v) return;
    // Warm the next one so the swipe lands on a ready frame.
    const next = videoAt(i + 1);
    if (next) next.preload = 'auto';
    // The one after that and the one behind only need their first frame.
    [videoAt(i + 2), videoAt(i - 1)].forEach(x => { if (x && x.preload === 'none') x.preload = 'metadata'; });

    fitAudioLabel(i);
    const e = engineAt(i);
    if (e) {
      e.setMuted(D.muted);
      e.restart(true);
      // Sound-on autoplay can be refused; fall back to muted rather than
      // a frozen frame — same rule as a plain short, checked once the
      // play() promise has had a moment to settle.
      setTimeout(() => {
        if (active !== i || !v.paused || D.muted) return;
        D.muted = true; save(); syncMuteIcon();
        e.setMuted(true); e.play();
      }, 300);
    } else {
      v.muted = D.muted;
      try { v.currentTime = 0; } catch (er) {}
      const p = v.play();
      if (p && p.catch) {
        p.catch(() => { v.muted = true; D.muted = true; save(); syncMuteIcon(); v.play().catch(() => {}); });
      }
    }
    setPausedUI(i, false);

    clearTimeout(viewTimer);
    const s = feed[i];
    viewTimer = setTimeout(() => {
      if (active !== i || countedThisSession[s.id]) return;
      countedThisSession[s.id] = true;
      D.views[s.id] = (D.views[s.id] || 0) + 1;
      save();
    }, VIEW_AFTER_MS);
  }

  function fitAudioLabel(i) {
    const p = document.getElementById('sh-panel-' + i);
    const t = p && p.querySelector('.sh-audio-t');
    if (!t) return;
    const box = t.parentElement;
    const over = t.scrollWidth - (box.clientWidth - 24);
    t.classList.toggle('scroll', over > 4);
    t.style.setProperty('--mq', over > 4 ? `-${Math.ceil(over)}px` : '0px');
  }

  function togglePlay(i) {
    const e = engineAt(i);
    if (e) { e.toggle(); setPausedUI(i, e.paused); return; }
    const v = videoAt(i);
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPausedUI(i, false); }
    else { v.pause(); setPausedUI(i, true); }
  }

  function setPausedUI(i, paused) {
    const p = document.getElementById('sh-panel-' + i);
    if (p) p.classList.toggle('paused', paused);
  }

  function heartBurst(panel, x, y) {
    const h = document.createElement('span');
    h.className = 'sh-burst material-symbols-rounded';
    h.textContent = 'favorite';
    // Position against the stage the heart is drawn into. Measuring the
    // panel put it (panel width − stage width) / 2 off on desktop — 179px at
    // 800px wide — and past the right edge, where the stage clipped it.
    const stage = panel.querySelector('.sh-stage');
    const r = stage.getBoundingClientRect();
    h.style.left = (x - r.left) + 'px';
    h.style.top = (y - r.top) + 'px';
    stage.appendChild(h);
    setTimeout(() => h.remove(), 700);
  }

  function repaintPanel(i) {
    const old = document.getElementById('sh-panel-' + i);
    if (!old) return;
    const v = old.querySelector('video');
    const t = v ? v.currentTime : 0;
    const wasPlaying = v && !v.paused;

    // Rebuild only the overlay — keep the <video> so playback isn't interrupted.
    const tmp = document.createElement('div');
    tmp.innerHTML = panelHTML(feed[i], i);
    const fresh = tmp.firstElementChild;
    ['.sh-meta', '.sh-rail'].forEach(sel => old.querySelector(sel).replaceWith(fresh.querySelector(sel)));
    if (v && wasPlaying && v.paused) { v.currentTime = t; v.play().catch(() => {}); }
  }

  /* ── Actions ─────────────────────────────────────────────────────── */
  function like(i) {
    const s = feed[i];
    D.liked[s.id] = !D.liked[s.id];
    if (D.liked[s.id]) delete D.disliked[s.id];      // YouTube: one or the other
    save(); repaintPanel(i);
    emit('signal', { id: s.id, handle: s.handle, type: 'like', on: !!D.liked[s.id] });
  }

  function dislike(i) {
    const s = feed[i];
    D.disliked[s.id] = !D.disliked[s.id];
    if (D.disliked[s.id]) delete D.liked[s.id];
    save(); repaintPanel(i);
    emit('signal', { id: s.id, handle: s.handle, type: 'dislike', on: !!D.disliked[s.id] });
  }

  function toggleSave(i) {
    const s = feed[i];
    D.saved[s.id] = !D.saved[s.id];
    if (!D.saved[s.id]) delete D.saved[s.id];
    save(); repaintPanel(i);
    emit('signal', { id: s.id, handle: s.handle, type: 'save', on: !!D.saved[s.id] });
    toast(D.saved[s.id] ? 'Saved to your collection' : 'Removed from saved');
  }

  function subscribe(i) {
    const s = feed[i];
    D.subs[s.handle] = !D.subs[s.handle];
    if (!D.subs[s.handle]) delete D.subs[s.handle];
    save();
    emit('signal', { id: s.id, handle: s.handle, type: 'follow', on: !!D.subs[s.handle] });
    // Every panel from the same creator flips together.
    feed.forEach((x, j) => { if (x.handle === s.handle) repaintPanel(j); });
    toast(D.subs[s.handle] ? `Subscribed to ${s.creator}` : `Unsubscribed from ${s.creator}`);
  }

  /* Native share sheet where the device has one; clipboard otherwise. Only
     claims success once something actually accepted the link. */
  async function share(i) {
    const s = feed[i];
    emit('signal', { id: s.id, handle: s.handle, type: 'share', on: true });
    const url = `${location.origin}${location.pathname}#shorty-${s.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: `${s.creator} on Trending`, text: s.caption, url }); return; }
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(url); toast('Link copied'); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    toast('Couldn\'t share — ' + url);
  }

  function tip(i) {
    const s = feed[i];
    if (typeof openTipModal === 'function') openTipModal(s.creator, s.handle);
  }

  function remix(i) {
    const s = feed[i];
    close();
    openCreate(`Remix of ${s.handle} — `);
  }

  function toggleMute() {
    D.muted = !D.muted;
    save();
    document.querySelectorAll('#sh-feed video').forEach(v => { v.muted = D.muted; });
    Object.keys(engines).forEach(k => engines[k].setMuted(D.muted));
    syncMuteIcon();
  }
  function syncMuteIcon() {
    const b = document.querySelector('#sh-mute .material-symbols-rounded');
    if (b) b.textContent = D.muted ? 'volume_off' : 'volume_up';
  }

  async function pip() {
    const v = videoAt(active);
    if (!v || !document.pictureInPictureEnabled) { toast('Picture-in-picture isn\'t available here.'); return; }
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch (e) { toast('Picture-in-picture was blocked.'); }
  }

  function go(delta) {
    const target = document.getElementById('sh-panel-' + (active + delta));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onKey(e) {
    if (!document.getElementById('sh-viewer')) return;
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowdown' || k === 'j') { e.preventDefault(); go(1); }
    else if (k === 'arrowup' || k === 'k') { e.preventDefault(); go(-1); }
    else if (k === ' ') { e.preventDefault(); togglePlay(active); }
    else if (k === 'm') toggleMute();
    else if (k === 'l') like(active);
    else if (k === 'escape') {
      if (document.getElementById('sh-more')) closeMore();
      else if (document.getElementById('sh-comments')) closeComments(); else close();
    }
  }

  function closeViewer(silent) {
    leaveActive();
    moreFn = null;
    Object.keys(engines).forEach(k => engines[k].destroy());
    engines = {};
    const v = document.getElementById('sh-viewer');
    if (v) {
      v.querySelectorAll('video').forEach(x => { x.pause(); x.removeAttribute('src'); x.load(); });
      v.remove();
    }
    if (observer) { observer.disconnect(); observer = null; }
    clearTimeout(viewTimer);
    active = -1;
    document.body.classList.remove('sh-open');
    document.removeEventListener('keydown', onKey);
    if (!silent) paintHub();
  }
  const close = () => closeViewer(false);

  /* ── Comments ────────────────────────────────────────────────────── */
  function openComments(i) {
    const s = feed[i];
    closeComments();
    const sheet = document.createElement('div');
    sheet.id = 'sh-comments';
    sheet.className = 'sh-sheet';
    sheet.dataset.i = i;
    sheet.innerHTML = commentsHTML(s);
    document.getElementById('sh-viewer').appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('open'));
    const inp = sheet.querySelector('input');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') postComment(i); });
  }

  function commentsHTML(s) {
    const list = commentList(s);
    return `
      <div class="sh-sheet-head">
        <b>Comments</b><span>${list.length}</span>
        <button class="sh-round sm" onclick="SH.closeComments()" aria-label="Close"><span class="material-symbols-rounded">close</span></button>
      </div>
      <div class="sh-cmts">
        ${list.length ? list.map(c => `
          <div class="sh-cmt">
            <span class="sh-av sm">${esc(initials(c.name))}</span>
            <div class="sh-cmt-body"><b>${esc(c.name)}</b><p>${esc(c.text)}</p></div>
            <button class="sh-cmt-like${c.liked ? ' on' : ''}" onclick="SH.likeComment('${s.id}','${c.id}')">
              <span class="material-symbols-rounded"${c.liked ? ' style="font-variation-settings:\'FILL\' 1"' : ''}>favorite</span>${c.likes || ''}
            </button>
          </div>`).join('') : '<div class="sh-cmt-empty">No comments yet. Start the conversation.</div>'}
      </div>
      <div class="sh-cmt-input">
        <input placeholder="Add a comment…" maxlength="300">
        <button class="btn btn-primary btn-sm" onclick="SH.postComment(${feed.indexOf(s)})">Post</button>
      </div>`;
  }

  function postComment(i) {
    const sheet = document.getElementById('sh-comments');
    const inp = sheet && sheet.querySelector('input');
    const text = inp ? inp.value.trim() : '';
    if (!text) return;
    const s = feed[i];
    commentList(s).push({ id: 'c' + Date.now(), name: 'You', text, ts: Date.now(), likes: 0, liked: false });
    save();
    emit('signal', { id: s.id, handle: s.handle, type: 'comment', on: true });
    sheet.innerHTML = commentsHTML(s);
    sheet.querySelector('input').addEventListener('keydown', e => { if (e.key === 'Enter') postComment(i); });
    const box = sheet.querySelector('.sh-cmts');
    box.scrollTop = box.scrollHeight;
    repaintPanel(i);
  }

  function likeComment(sid, cid) {
    const s = byId(sid);
    const c = commentList(s).find(x => x.id === cid);
    if (!c) return;
    c.liked = !c.liked;
    c.likes = (c.likes || 0) + (c.liked ? 1 : -1);
    save();
    const sheet = document.getElementById('sh-comments');
    if (sheet) {
      const i = Number(sheet.dataset.i);
      sheet.innerHTML = commentsHTML(s);
      sheet.querySelector('input').addEventListener('keydown', e => { if (e.key === 'Enter') postComment(i); });
    }
  }

  function closeComments() {
    const sheet = document.getElementById('sh-comments');
    if (sheet) { sheet.classList.remove('open'); setTimeout(() => sheet.remove(), 220); }
  }

  /* ── More ─────────────────────────────────────────────────────────
     The rail keeps the five actions people reach for on every short.
     The rest live here, one tap away: dislike, remix, delete on your
     own, and Discover's feedback (not interested, hide, report). */
  function more(i) {
    const s = feed[i];
    if (!s) return;
    closeComments(); closeMore(true);
    const sheet = document.createElement('div');
    sheet.id = 'sh-more';
    sheet.className = 'sh-sheet sh-more';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'More options');
    sheet.innerHTML = moreHTML(s, i);
    document.getElementById('sh-viewer').appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('open'));
    const first = sheet.querySelector('.sh-opt');
    if (first) first.focus({ preventScroll: true });
  }

  function moreHTML(s, i) {
    const disliked = !!D.disliked[s.id];
    const opt = (icon, label, sub, act, o) => `
      <button type="button" class="sh-opt${o && o.danger ? ' danger' : ''}${o && o.on ? ' on' : ''}" onclick="${act}">
        <span class="material-symbols-rounded"${o && o.on ? ' style="font-variation-settings:\'FILL\' 1"' : ''}>${icon}</span>
        <span><b>${label}</b>${sub ? `<em>${sub}</em>` : ''}</span>
      </button>`;
    return `
      <div class="sh-sheet-head">
        <b>More</b>
        <button class="sh-round sm" onclick="SH.closeMore()" aria-label="Close"><span class="material-symbols-rounded">close</span></button>
      </div>
      <div class="sh-opts">
        ${opt('thumb_down', disliked ? 'Disliked' : 'Dislike', disliked ? 'Tap to take it back' : 'Show fewer shorts like this',
              `SH.dislike(${i}); SH.more(${i})`, { on: disliked })}
        ${s.meta && s.meta.allowRemix === false ? '' :
          opt('auto_awesome_motion', 'Remix', 'Make your own short from this one', `SH.closeMore(true); SH.remix(${i})`)}
        ${!s.mine && window.DX ? opt('tune', 'Not interested, hide or report', 'And why you’re seeing this',
              `SH.closeMore(true); DX.menu('short:' + SH.feed[${i}].id, true)`) : ''}
        ${s.mine ? opt('delete', 'Delete', 'Remove this short from this device', `SH.closeMore(true); SH.removeUpload('${s.id}')`, { danger: true }) : ''}
      </div>`;
  }

  function closeMore(now) {
    const sheet = document.getElementById('sh-more');
    if (!sheet) return;
    if (now) { sheet.remove(); return; }
    sheet.classList.remove('open');
    setTimeout(() => sheet.remove(), 220);
  }

  /* ── Create / upload ─────────────────────────────────────────────── */
  let draft = null;     // { file, url, duration }

  /* The studio is the create flow now: camera, editor, share screen. The
     one-dialog uploader below is kept as the fallback for a browser where
     the studio module didn't load. */
  function openCreate(prefill) {
    closeViewer(true);
    if (window.STU) { STU.open(prefill || ''); return; }
    closeCreate();
    draft = null;
    const m = document.createElement('div');
    m.id = 'sh-create';
    m.className = 'sh-create-scrim';
    m.innerHTML = `
      <div class="sh-create">
        <div class="sh-create-head">
          <div><div class="sf-kicker">NEW SHORT</div><h3 class="sf-title">Upload a video</h3></div>
          <button class="icon-btn" onclick="SH.closeCreate()" aria-label="Close"><span class="material-symbols-rounded">close</span></button>
        </div>
        <label class="sh-drop" id="sh-drop">
          <input type="file" accept="video/*" id="sh-file" hidden>
          <div class="sh-drop-empty" id="sh-drop-empty">
            <span class="material-symbols-rounded">upload</span>
            <b>Choose a video</b>
            <span>or drop it here · up to 3 minutes, 100 MB</span>
          </div>
          <video id="sh-preview" class="sh-preview" playsinline muted loop hidden></video>
        </label>
        <div class="sh-file-meta" id="sh-file-meta"></div>
        <label class="sh-lbl">Caption</label>
        <textarea id="sh-caption" class="input" rows="3" maxlength="220" placeholder="Say something about it — #hashtags work">${esc(prefill || '')}</textarea>
        <div class="sh-create-note">Stored on this device only. Nothing is uploaded to a server.</div>
        <button class="btn btn-primary sh-publish" id="sh-publish" onclick="SH.publish()" disabled>Publish</button>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) closeCreate(); });

    const file = m.querySelector('#sh-file');
    file.addEventListener('change', () => { if (file.files[0]) pick(file.files[0]); });
    const drop = m.querySelector('#sh-drop');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('over');
      if (e.dataTransfer.files[0]) pick(e.dataTransfer.files[0]);
    });
  }

  /* Validate before accepting: it must be a video, within size, and the
     browser must be able to read its duration — which also proves it's a
     format this browser can actually play. */
  function pick(f) {
    const meta = document.getElementById('sh-file-meta');
    const btn = document.getElementById('sh-publish');
    const fail = msg => { meta.innerHTML = `<span class="tc-red">${esc(msg)}</span>`; btn.disabled = true; draft = null; };

    if (!f.type.startsWith('video/')) return fail('That isn\'t a video file.');
    if (f.size > MAX_BYTES) return fail(`Too large — ${(f.size / 1048576).toFixed(0)} MB. The limit is 100 MB.`);

    const url = URL.createObjectURL(f);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const d = probe.duration;
      if (!isFinite(d) || d <= 0) { URL.revokeObjectURL(url); return fail('Couldn\'t read that video.'); }
      if (d > MAX_SECONDS) { URL.revokeObjectURL(url); return fail(`Too long — ${Math.round(d)}s. Shorts are up to 3 minutes.`); }
      draft = { file: f, url, duration: d };
      const pv = document.getElementById('sh-preview');
      pv.src = url; pv.hidden = false; pv.play().catch(() => {});
      document.getElementById('sh-drop-empty').hidden = true;
      meta.textContent = `${f.name} · ${Math.round(d)}s · ${(f.size / 1048576).toFixed(1)} MB`;
      btn.disabled = false;
    };
    probe.onerror = () => { URL.revokeObjectURL(url); fail('This browser can\'t play that format.'); };
    probe.src = url;
  }

  async function publish() {
    if (!draft) return;
    const btn = document.getElementById('sh-publish');
    btn.disabled = true; btn.textContent = 'Publishing…';
    const caption = (document.getElementById('sh-caption').value || '').trim() || 'New short';
    const id = 'u' + Date.now();
    const user = (typeof S !== 'undefined' && S.user && S.user.fname && S.user.fname !== 'Guest') ? S.user : null;
    try {
      await putBlob(id, draft.file);
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Publish';
      toast('Couldn\'t save — this device may be out of storage.');
      return;
    }
    blobUrls[id] = draft.url;        // reuse the preview URL for this session
    D.uploads.unshift({
      id, caption,
      creator: user ? `${user.fname} ${user.lname || ''}`.trim() : 'You',
      handle: user && user.handle ? user.handle : '@you',
      duration: draft.duration, ts: Date.now()
    });
    save();
    draft = null;
    closeCreate(true);
    D.tab = 'mine'; save();
    toast('Published');
    await paintHub();
    openAt(0, listFor('mine'));
  }

  async function removeUpload(id) {
    if (!(await appConfirm('Delete this reel from this device?', { ok: 'Delete', danger: true }))) return;
    const rec = D.uploads.find(u => u.id === id);
    const ids = rec ? blobIdsOf(rec).video.concat(blobIdsOf(rec).extra) : [id];
    for (const b of ids) {
      try { await delBlob(b); } catch (e) {}
      if (blobUrls[b]) { URL.revokeObjectURL(blobUrls[b]); delete blobUrls[b]; }
    }
    D.uploads = D.uploads.filter(u => u.id !== id);
    ['liked', 'disliked', 'saved', 'views', 'comments'].forEach(k => { delete D[k][id]; });
    save();
    close();
    toast('Deleted');
  }

  function closeCreate(keepUrl) {
    const m = document.getElementById('sh-create');
    if (m) m.remove();
    if (draft && draft.url && !keepUrl) URL.revokeObjectURL(draft.url);
    if (!keepUrl) draft = null;
  }

  /* Publishing a reel from the studio: keep the object URLs it already
     made, drop the record in, and open it. */
  async function addUpload(rec, urls) {
    Object.keys(urls || {}).forEach(k => { if (urls[k]) blobUrls[k] = urls[k]; });
    D.uploads.unshift(rec);
    D.tab = 'mine';
    save();
    if (!document.getElementById('sh-root') && typeof navigateTo === 'function') {
      navigateTo('reels');
      await new Promise(r => setTimeout(r, 120));
    }
    toast('Your reel is live');
    await paintHub();
    openAt(0, listFor('mine'));
  }

  return {
    paintHub, setTab, openAt, close, openCreate, closeCreate, publish, removeUpload, addUpload,
    store: { put: putBlob, get: getBlob, del: delBlob },
    like, dislike, toggleSave, subscribe, share, tip, remix, toggleMute, pip,
    openComments, closeComments, postComment, likeComment, go, more, closeMore,
    listFor, all, CATALOG, byId,
    // Your uploads, ready to play (their video files load from this device first).
    mine: async () => { await hydrateUploads(); return listFor('mine'); },
    get state() { return D; }, get feed() { return feed; }, get active() { return active; }
  };
})();

window.SH = SH;

/* ── Pane template & router hook ───────────────────────────────────── */
function getReelsTemplate() {
  return `<section id="pane-reels" class="pane">
    <div class="sh-head">
      <h1 class="pane-title" style="margin-bottom:0">
        <span class="material-symbols-rounded">slow_motion_video</span> Shorty
      </h1>
      <button class="btn btn-primary" onclick="SH.openCreate()">
        <span class="material-symbols-rounded" style="font-size:18px">add</span> Create
      </button>
    </div>
    <div id="sh-root"></div>
  </section>`;
}

function renderReels() { SH.paintHub(); }

/* Older entry points: Profile opens a short by index, and the assistant's
   "open reels" command called openReelsPopup — which was never defined, so
   that command threw. Both now land in the real player. */
window.openShortyPopup = idx => { if (typeof navigateTo === 'function') navigateTo('reels'); SH.openAt(Number(idx) || 0, SH.listFor('foryou')); };
window.openReelsPopup = window.openShortyPopup;
window.openCreateReelModal = () => SH.openCreate();

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
publish('pages/reels.js', {
  SH: () => SH, getReelsTemplate: () => getReelsTemplate,
  renderReels: () => renderReels
});
