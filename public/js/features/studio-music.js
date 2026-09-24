/* ╔══════════════════════════════════════════════════════════════════╗
   ║  STUDIO MUSIC — the music browser behind a reel's Sound tool      ║
   ║                                                                   ║
   ║  Three kinds of track, one list:                                  ║
   ║                                                                   ║
   ║   · Trending Originals - composed on this device with Web Audio.  ║
   ║     Each is a recipe (genre, tempo, key, chords, a seed); tapping ║
   ║     play renders it to real audio in about a second. No licence   ║
   ║     question, and a real waveform to trim against.               ║
   ║   · SoundHelix demos - free example tracks streamed from          ║
   ║     soundhelix.com, as before.                                    ║
   ║   · Your audio - files you add, kept in this browser's storage    ║
   ║     so they are there for the next reel.                          ║
   ║                                                                   ║
   ║  Featured, For you, Trending here, New releases, Saved, Recently  ║
   ║  used, Genres and Moods; search with suggestions; preview, save.  ║
   ║  "Trending here" and use counts come from reels made on this      ║
   ║  device - there is no server to count anyone else's, and nothing  ║
   ║  here pretends there is.                                          ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const MUS = (() => {

  const KEY = 'ts_stu_music_v1';      // { saved: [ids], recent: [ids], uses: { id: n } }
  const LIB = 'ts_stu_audio_v1';      // your files: [{ id, title, dur, size, added }]
  const SR = 22050;
  const MAX_FILE = 30 * 1024 * 1024;

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s)) : String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const ico = (n, cls) => `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}" aria-hidden="true">${n}</span>`;
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const $ = id => document.getElementById(id);
  const fmt = t => { t = Math.max(0, Math.round(t || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

  /* ── The catalogue ───────────────────────────────────────────────── */

  const GENRES = {
    lofi: ['Lo-fi', 'coffee'], house: ['House', 'nightlife'], trap: ['Trap', 'bolt'], ambient: ['Ambient', 'water_drop'],
    synthwave: ['Synthwave', 'wb_twilight'], pop: ['Chill pop', 'wb_sunny'], cinematic: ['Cinematic', 'movie'],
    afro: ['Afrobeat', 'celebration'], demo: ['Demo', 'radio'], yours: ['Your audio', 'folder_open']
  };
  const MOODS = ['Chilled', 'Happy', 'Energetic', 'Calm', 'Dreamy', 'Nostalgic', 'Groovy', 'Dark', 'Epic'];

  const O = (id, title, genre, mood, bpm, root, scale, prog, seed, added, art) =>
    ({ id, title, genre, mood, bpm, root, scale, prog, seed, added, art, artist: 'Trending Originals', album: 'Originals · Vol. 1', source: 'gen' });

  const ORIGINALS = [
    O('g-rainy',   'Rainy Window',      'lofi',      'Chilled',   76,  57, 'minor',  [0, 5, 3, 4], 11,  '2026-07-02', ['#4F5BD5', '#8E7CF0']),
    O('g-tram',    'Late Tram Home',    'lofi',      'Nostalgic', 82,  50, 'dorian', [0, 3, 6, 4], 23,  '2026-08-14', ['#3B4A6B', '#8A6FB5']),
    O('g-lantern', 'Paper Lanterns',    'lofi',      'Calm',      74,  53, 'major',  [0, 5, 3, 4], 31,  '2026-09-10', ['#C0643F', '#F2B880']),
    O('g-rooftop', 'Rooftop at Nine',   'house',     'Energetic', 122, 55, 'minor',  [0, 5, 6, 4], 41,  '2026-06-20', ['#0F9D8A', '#3A63E0']),
    O('g-glass',   'Glass Elevator',    'house',     'Groovy',    124, 48, 'minor',  [0, 3, 4, 0], 53,  '2026-09-05', ['#6D28D9', '#DB2777']),
    O('g-night',   'Night Shift',       'trap',      'Dark',      140, 54, 'minor',  [0, 5, 0, 6], 61,  '2026-07-28', ['#111827', '#7F1D1D']),
    O('g-chrome',  'Cold Chrome',       'trap',      'Energetic', 144, 49, 'minor',  [0, 6, 5, 4], 67,  '2026-09-12', ['#334155', '#0EA5E9']),
    O('g-still',   'Still Water',       'ambient',   'Calm',      66,  52, 'major',  [0, 3, 5, 4], 71,  '2026-05-30', ['#0E7490', '#67E8F9']),
    O('g-north',   'North Light',       'ambient',   'Dreamy',    60,  50, 'minor',  [0, 5, 2, 6], 79,  '2026-08-02', ['#1E3A8A', '#38BDF8']),
    O('g-neon',    'Neon Coastline',    'synthwave', 'Nostalgic', 100, 57, 'minor',  [0, 5, 2, 6], 83,  '2026-07-11', ['#DB2777', '#7C3AED']),
    O('g-tape',    'Tape Deck Drive',   'synthwave', 'Energetic', 104, 52, 'minor',  [0, 3, 5, 4], 89,  '2026-09-15', ['#EA580C', '#BE185D']),
    O('g-weekend', 'Weekend Plans',     'pop',       'Happy',     96,  48, 'major',  [0, 4, 5, 3], 97,  '2026-08-22', ['#D97706', '#DB2777']),
    O('g-golden',  'Golden Hour Walk',  'pop',       'Happy',     92,  55, 'major',  [0, 5, 3, 4], 101, '2026-06-08', ['#EA580C', '#CA8A04']),
    O('g-reveal',  'The Long Reveal',   'cinematic', 'Epic',      88,  50, 'minor',  [0, 5, 2, 6], 107, '2026-09-18', ['#1F2937', '#B45309']),
    O('g-market',  'Market Day',        'afro',      'Groovy',    108, 57, 'minor',  [0, 3, 6, 4], 113, '2026-07-19', ['#15803D', '#CA8A04']),
    O('g-sun',     'Sun on the Street', 'afro',      'Happy',     112, 50, 'major',  [0, 3, 4, 0], 127, '2026-09-20', ['#EA580C', '#16A34A'])
  ];
  const FEATURED = ['g-rainy', 'g-neon', 'g-rooftop', 'g-golden', 'g-still', 'g-market'];

  const barSec = t => 240 / t.bpm;
  /* A track is one pass through its chords, rendered once and repeated
     to about thirty seconds - ambient and cinematic hold each chord for
     two bars, so their pass is twice as long. */
  const cycleBars = t => (t.genre === 'ambient' || t.genre === 'cinematic' ? 2 : 1) * t.prog.length;
  const cycleOf = t => cycleBars(t) * barSec(t);
  const repsOf = t => Math.max(1, Math.round(30 / cycleOf(t)));
  const genDur = t => repsOf(t) * cycleOf(t);

  function streams() {
    const list = (window.STU && STU.MUSIC) || [];
    return list.map(m => ({
      id: m.id, title: m.title, artist: 'SoundHelix', album: 'SoundHelix demos', genre: 'demo', mood: m.mood,
      src: m.src, source: 'stream', art: ['#374151', '#6B7280']
    }));
  }

  function files() {
    return lib().map(f => ({
      id: f.id, title: f.title, artist: 'Your audio', album: 'On this device', genre: 'yours', mood: '',
      source: 'file', dur: f.dur, size: f.size, added: f.added, art: ['#475569', '#94A3B8']
    }));
  }

  const all = () => [...ORIGINALS, ...files(), ...streams()];
  const byId = id => all().find(t => t.id === id) || null;
  const durOf = t => t.source === 'gen' ? genDur(t) : (t.dur || (cache.get(t.id) || {}).dur || 0);

  /* ── What you saved, used and added ──────────────────────────────── */

  function st() {
    try { return Object.assign({ saved: [], recent: [], uses: {} }, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return { saved: [], recent: [], uses: {} }; }
  }
  function putSt(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function lib() { try { return JSON.parse(localStorage.getItem(LIB) || '[]'); } catch (e) { return []; } }
  function putLib(l) { try { localStorage.setItem(LIB, JSON.stringify(l)); } catch (e) {} }

  const isSaved = id => st().saved.indexOf(id) > -1;
  function toggleSave(id) {
    const s = st();
    s.saved = isSaved(id) ? s.saved.filter(x => x !== id) : [id].concat(s.saved);
    putSt(s);
    return s.saved.indexOf(id) > -1;
  }
  function noteRecent(id) { const s = st(); s.recent = [id].concat(s.recent.filter(x => x !== id)).slice(0, 20); putSt(s); }
  function noteUse(id) { if (!id) return; const s = st(); s.uses[id] = (s.uses[id] || 0) + 1; putSt(s); }
  const usesOf = id => st().uses[id] || 0;

  /* The blob store belongs to Shorty, which loads on demand. */
  async function store() {
    if (!(window.SH && SH.store)) {
      try { if (globalThis.__lazy && globalThis.__lazy.ensurePane) await globalThis.__lazy.ensurePane('reels'); } catch (e) {}
    }
    return window.SH && SH.store ? SH.store : null;
  }

  /* ── The synthesiser ─────────────────────────────────────────────── */

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10] };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  /* Every drum sound, synthesised once into a short sample. A hit in the
     track is then two nodes - the sample and its level - instead of the
     five to seven it takes to build the sound from scratch each time,
     which is what made a busy track slow to render. */
  const SHOTS = ['kick', 'snare', 'clap', 'hatC', 'hatO', 'shaker', 'crackle', 'tomLo', 'tomMid', 'tomHi', 'conga'];
  const SLOT = 0.7;                       // 0.7 s x 22050 Hz = 15435 samples, a whole number

  async function oneShots(r) {
    const len = Math.round(SR * SLOT);
    const ctx = new OfflineAudioContext(1, len * SHOTS.length, SR);
    const noise = ctx.createBuffer(1, SR, SR);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;

    const env = (node, t, vol, dec) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      node.connect(g); g.connect(ctx.destination);
    };
    const nz = (t, type, f, q, vol, dec) => {
      const src = ctx.createBufferSource(); src.buffer = noise;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      src.connect(fl); env(fl, t, vol, dec);
      src.start(t, r() * 0.5, dec + 0.05);
    };
    const sweep = (t, type, f0, f1, time, vol, dec) => {
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + time);
      env(o, t, vol, dec);
      o.start(t); o.stop(t + dec + 0.02);
    };

    SHOTS.forEach((k, i) => {
      const t = (i * len) / SR;
      if (k === 'kick')    { sweep(t, 'sine', 155, 46, 0.11, 0.95, 0.42); nz(t, 'highpass', 3200, 0.7, 0.06, 0.012); }
      if (k === 'snare')   { nz(t, 'bandpass', 1900, 0.6, 0.42, 0.19); sweep(t, 'triangle', 196, 196, 0, 0.2, 0.08); }
      if (k === 'clap')    { [0, 0.011, 0.023].forEach((d, j) => nz(t + d, 'bandpass', 1400, 0.9, 0.3, j === 2 ? 0.16 : 0.02)); }
      if (k === 'hatC')    nz(t, 'highpass', 7600, 0.7, 0.065, 0.035);
      if (k === 'hatO')    nz(t, 'highpass', 7600, 0.7, 0.085, 0.22);
      if (k === 'shaker')  nz(t, 'bandpass', 6400, 1.3, 0.07, 0.055);
      if (k === 'crackle') nz(t, 'highpass', 2400, 0.7, 0.04, 0.004);
      if (k === 'tomLo' || k === 'tomMid' || k === 'tomHi' || k === 'conga') {
        const m = { tomLo: 38, tomMid: 43, tomHi: 45, conga: 62 }[k];
        sweep(t, 'sine', hz(m + 7), hz(m), 0.08, 0.7, 0.6);
        nz(t, 'lowpass', 900, 0.7, 0.12, 0.08);
      }
    });

    const all = await ctx.startRendering();
    const d = all.getChannelData(0);
    const out = {};
    SHOTS.forEach((k, i) => {
      const b = new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: SR });
      b.copyToChannel(d.slice(i * len, (i + 1) * len), 0);
      out[k] = b;
    });
    return out;
  }

  function kit(ctx, bus, verb, dly, shots, r) {
    /* Notes and hits that share a pan and the same reverb and delay
       amounts share one bus, so a note is only its own oscillator,
       filter and level. */
    const buses = new Map();
    function busFor(o) {
      const pan = Math.round((o.pan || 0) * 10) / 10;
      const v = Math.round((o.verb || 0) * 20) / 20;
      const dl = Math.round((o.dly || 0) * 20) / 20;
      const key = pan + '|' + v + '|' + dl;
      let b = buses.get(key);
      if (b) return b;
      b = ctx.createGain();
      let n = b;
      if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; b.connect(p); n = p; }
      n.connect(bus);
      if (v) { const x = ctx.createGain(); x.gain.value = v; n.connect(x); x.connect(verb); }
      if (dl) { const x = ctx.createGain(); x.gain.value = dl; n.connect(x); x.connect(dly); }
      buses.set(key, b);
      return b;
    }

    /* One oscillator voice. hold: sustain for dur then release;
       otherwise an exponential decay (plucks, stabs). */
    function tone(type, midi, t, o) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(hz(midi), t);
      if (o.detune) osc.detune.setValueAtTime(o.detune, t);
      if (o.glide != null) osc.frequency.exponentialRampToValueAtTime(hz(o.glide), t + (o.glideT || 0.1));
      let node = osc;
      if (o.lp) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(o.lp, t);
        if (o.lpTo) f.frequency.exponentialRampToValueAtTime(o.lpTo, t + (o.lpT || 0.3));
        f.Q.value = o.q || 0.7;
        node.connect(f); node = f;
      }
      const g = ctx.createGain();
      node.connect(g);
      const vol = o.vol || 0.2, a = o.a || 0.005;
      let end;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + a);
      if (o.hold) {
        const d = Math.max(a + 0.01, o.dur || 0.5), rel = o.rel || 0.2;
        g.gain.setValueAtTime(vol, t + d);
        g.gain.linearRampToValueAtTime(0.0001, t + d + rel);
        end = t + d + rel;
      } else {
        const dec = o.dec || 0.3;
        g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
        end = t + a + dec;
      }
      g.connect(busFor(o));
      osc.start(t);
      osc.stop(end + 0.02);
    }

    function play(name, t, vol, o) {
      const src = ctx.createBufferSource();
      src.buffer = shots[name];
      const g = ctx.createGain();
      g.gain.value = vol == null ? 1 : vol;
      src.connect(g);
      g.connect(busFor(o || {}));
      src.start(t);
    }
    const side = () => (r() < 0.5 ? -0.1 : 0.1);

    return {
      tone,
      kick:    (t, v) => play('kick', t, v),
      snare:   (t, v, verbAmt) => play('snare', t, v, { verb: verbAmt == null ? 0.25 : verbAmt }),
      clap:    (t, v) => play('clap', t, v, { verb: 0.3 }),
      hat:     (t, v, open) => play(open ? 'hatO' : 'hatC', t, v, { pan: side() }),
      shaker:  (t, v) => play('shaker', t, v, { pan: 0.2 }),
      crackle: t => play('crackle', t, 0.5 + r() * 0.7, { pan: side() * 3 }),
      tom:     (t, midi, v) => play(midi >= 60 ? 'conga' : midi >= 45 ? 'tomHi' : midi >= 43 ? 'tomMid' : 'tomLo', t, v, { verb: 0.35 })
    };
  }

  function impulse(ctx, secs, r) {
    const len = Math.floor(ctx.sampleRate * secs);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return b;
  }

  /* The eight arrangements. Each gets the kit, the track and the grid:
     bars, the length of a sixteenth, and helpers for chords. */
  const PATTERNS = {
    lofi(K, t, g) {
      const swing = i => (i % 2 ? g.step * 0.28 : 0);
      for (let b = 0; b < g.bars; b++) {
        const t0 = b * g.bar, d = t.prog[b % t.prog.length];
        const at = i => t0 + i * g.step + swing(i);
        K.kick(at(0)); K.kick(at(10), 0.8); if (b % 2 && g.r() < 0.6) K.kick(at(7), 0.55);
        K.snare(at(4), 0.75); K.snare(at(12), 0.8);
        for (let i = 0; i < 16; i += 2) if (g.r() > 0.12) K.hat(at(i), 0.55 + g.r() * 0.4);
        g.chord(d, 4, 12).forEach((m, n) => {
          K.tone('triangle', m, at(0) + n * 0.012, { vol: 0.055, hold: true, dur: g.bar * 0.55, rel: 0.4, lp: 1700, verb: 0.3, a: 0.01 });
          K.tone('sine', m, at(0) + n * 0.012, { vol: 0.04, hold: true, dur: g.bar * 0.55, rel: 0.4 });
          if (b % 2) K.tone('triangle', m, at(10), { vol: 0.035, dec: 0.5, lp: 1500 });
        });
        K.tone('sine', g.bass(d), at(0), { vol: 0.34, hold: true, dur: g.step * 5, rel: 0.12, a: 0.01 });
        K.tone('sine', g.bass(d), at(10), { vol: 0.28, hold: true, dur: g.step * 4, rel: 0.12, a: 0.01 });
        const pent = g.chord(d, 3, 24);
        [2, 6, 8, 12, 14].forEach(i => { if (g.r() < 0.32) K.tone('sine', pent[Math.floor(g.r() * pent.length)], at(i), { vol: 0.07, dec: 0.55, dly: 0.25, verb: 0.2 }); });
        for (let k = 0; k < 10; k++) K.crackle(t0 + g.r() * g.bar);
      }
    },
    house(K, t, g) {
      for (let b = 0; b < g.bars; b++) {
        const t0 = b * g.bar, d = t.prog[b % t.prog.length], at = i => t0 + i * g.step;
        [0, 4, 8, 12].forEach(i => K.kick(at(i)));
        K.clap(at(4)); K.clap(at(12));
        [2, 6, 10, 14].forEach(i => K.hat(at(i), 0.9, true));
        for (let i = 1; i < 16; i += 2) K.hat(at(i), 0.4);
        [2, 6, 10, 14].forEach(i => K.tone('sawtooth', g.bass(d) + 12, at(i), { vol: 0.2, dec: 0.2, lp: 700, lpTo: 180, lpT: 0.18 }));
        [3, 11].forEach(i => g.chord(d, 3, 12).forEach(m => K.tone('sawtooth', m, at(i), { vol: 0.045, dec: 0.28, lp: 2600, lpTo: 600, lpT: 0.25, verb: 0.25, dly: 0.15 })));
        g.chord(d, 3, 12).forEach(m => K.tone('triangle', m, t0, { vol: 0.03, hold: true, dur: g.bar * 0.95, rel: 0.1, a: 0.3, lp: 1100 }));
      }
    },
    trap(K, t, g) {
      const kicks = [[0, 10], [0, 7, 11], [0, 3, 10], [0, 10, 14]];
      for (let b = 0; b < g.bars; b++) {
        const t0 = b * g.bar, d = t.prog[b % t.prog.length], at = i => t0 + i * g.step;
        const ks = kicks[Math.floor(g.r() * kicks.length)];
        ks.forEach((i, n) => {
          K.kick(at(i), 0.9);
          const next = n + 1 < ks.length ? ks[n + 1] : 16;
          const glide = g.r() < 0.25 ? g.bass(d) + 7 : null;
          K.tone('sine', g.bass(d), at(i), { vol: 0.5, hold: true, dur: (next - i) * g.step * 0.92, rel: 0.1, a: 0.004, glide, glideT: 0.12 });
        });
        K.clap(at(8), 1); K.snare(at(8), 0.5, 0.35);
        for (let i = 0; i < 16; i += 2) K.hat(at(i), 0.7);
        if (g.r() < 0.6) { const s = 12 + Math.floor(g.r() * 2) * 2; for (let k = 0; k < 6; k++) K.hat(at(s) + k * g.step / 3, 0.5); }
        const pent = g.chord(d, 3, 24);
        [0, 3, 6, 10, 12].forEach(i => { if (g.r() < 0.42) K.tone('sine', pent[Math.floor(g.r() * 3)], at(i), { vol: 0.08, dec: 0.4, dly: 0.3, verb: 0.25 }); });
        g.chord(d, 3, 12).forEach(m => K.tone('triangle', m, t0, { vol: 0.025, hold: true, dur: g.bar, rel: 0.2, a: 0.4, lp: 1000 }));
      }
    },
    ambient(K, t, g) {
      for (let b = 0; b < g.bars; b += 2) {
        const t0 = b * g.bar, d = t.prog[(b / 2) % t.prog.length];
        g.chord(d, 4, 12).forEach((m, n) => {
          K.tone('sawtooth', m, t0, { vol: 0.022, hold: true, dur: g.bar * 2, rel: 1.4, a: 1.2, lp: 700, detune: n % 2 ? 7 : -7, verb: 0.6 });
          K.tone('sine', m + 12, t0, { vol: 0.016, hold: true, dur: g.bar * 2, rel: 1.4, a: 1.4, verb: 0.5 });
        });
        if (b % 4 === 0) K.tone('sine', g.bass(t.prog[0]), t0, { vol: 0.12, hold: true, dur: g.bar * 4, rel: 1.5, a: 1.5 });
        for (let k = 0; k < 5; k++) {
          const hi = g.chord(d, 3, 24 + (g.r() < 0.4 ? 12 : 0));
          K.tone(g.r() < 0.5 ? 'sine' : 'triangle', hi[Math.floor(g.r() * 3)], t0 + g.r() * g.bar * 2, { vol: 0.06, dec: 1.6, dly: 0.5, verb: 0.6, pan: (g.r() - 0.5) * 0.8 });
        }
      }
    },
    synthwave(K, t, g) {
      for (let b = 0; b < g.bars; b++) {
        const t0 = b * g.bar, d = t.prog[b % t.prog.length], at = i => t0 + i * g.step;
        K.kick(at(0)); K.kick(at(8)); if (g.r() < 0.4) K.kick(at(10), 0.7);
        K.snare(at(4), 1, 0.55); K.snare(at(12), 1, 0.55);
        for (let i = 0; i < 16; i += 2) K.hat(at(i), 0.55);
        const arp = g.chord(d, 4, 12);
        for (let i = 0; i < 16; i++) K.tone('sawtooth', arp[i % 4] + (i % 8 > 3 ? 12 : 0), at(i), { vol: 0.04, dec: 0.14, lp: 2200, lpTo: 700, lpT: 0.12, dly: 0.2, pan: i % 2 ? 0.25 : -0.25 });
        for (let i = 0; i < 16; i += 2) K.tone('sawtooth', g.bass(d) + (i % 4 ? 12 : 0), at(i), { vol: 0.16, dec: 0.2, lp: 600 });
        g.chord(d, 3, 12).forEach(m => K.tone('sawtooth', m, t0, { vol: 0.02, hold: true, dur: g.bar * 0.95, rel: 0.2, a: 0.25, lp: 1400, verb: 0.35 }));
      }
    },
    pop(K, t, g) {
      for (let b = 0; b < g.bars; b++) {
        const t0 = b * g.bar, d = t.prog[b % t.prog.length], at = i => t0 + i * g.step;
        K.kick(at(0)); K.kick(at(8), 0.85); if (g.r() < 0.5) K.kick(at(10), 0.6);
        K.snare(at(4), 0.8); K.snare(at(12), 0.8);
        for (let i = 0; i < 16; i += 2) K.hat(at(i), i % 4 ? 0.45 : 0.7);
        const ch = g.chord(d, 4, 12);
        [0, 2, 4, 6, 8, 10, 12, 14].forEach((i, n) => K.tone('triangle', ch[n % 4] + (n > 3 ? 12 : 0), at(i), { vol: 0.07, dec: 0.4, lp: 3200, dly: 0.15, pan: n % 2 ? 0.2 : -0.2 }));
        K.tone('sine', g.bass(d), at(0), { vol: 0.3, hold: true, dur: g.step * 3.5, rel: 0.1 });
        K.tone('sine', g.bass(d), at(8), { vol: 0.28, hold: true, dur: g.step * 3.5, rel: 0.1 });
        ch.slice(0, 3).forEach(m => K.tone('sine', m, t0, { vol: 0.03, hold: true, dur: g.bar * 0.9, rel: 0.3, a: 0.05, verb: 0.2 }));
      }
    },
    cinematic(K, t, g) {
      for (let b = 0; b < g.bars; b++) {
        const t0 = b * g.bar, d = t.prog[Math.floor(b / 2) % t.prog.length], at = i => t0 + i * g.step;
        const late = b >= g.bars - 4;
        [0, 3, 6, 8, 10].forEach((i, n) => K.tom(at(i), n % 2 ? 43 : 38, n === 0 ? 1 : 0.7));
        if (late) for (let i = 12; i < 16; i++) K.tom(at(i), 45, 0.55);
        if (b % 2 === 0) {
          g.chord(d, 3, 12).forEach(m => K.tone('sawtooth', m, t0, { vol: 0.028, hold: true, dur: g.bar * 2, rel: 0.8, a: 0.9, lp: 1300, verb: 0.5 }));
          K.tone('sawtooth', g.bass(d), t0, { vol: 0.09, hold: true, dur: g.bar * 2, rel: 0.6, a: 0.6, lp: 320 });
        }
        const top = g.chord(d, 3, 24);
        K.tone('triangle', top[b % 3], at(0), { vol: 0.08, dec: 1.4, verb: 0.45, dly: 0.2 });
      }
    },
    afro(K, t, g) {
      for (let b = 0; b < g.bars; b++) {
        const t0 = b * g.bar, d = t.prog[b % t.prog.length], at = i => t0 + i * g.step;
        [0, 7, 10].forEach(i => K.kick(at(i), i ? 0.75 : 1));
        K.clap(at(4), 0.55); K.clap(at(12), 0.6);
        for (let i = 0; i < 16; i++) K.shaker(at(i), [2, 6, 10, 14].indexOf(i) > -1 ? 1 : 0.45);
        [3, 11, 14].forEach(i => K.tom(at(i), 62, 0.35));
        [0, 3, 6, 10].forEach((i, n) => K.tone('sine', g.bass(d) + (n === 2 ? 7 : 0), at(i), { vol: 0.3, dec: 0.28 }));
        const ch = g.chord(d, 3, 24);
        [2, 5, 8, 13].forEach((i, n) => K.tone('triangle', ch[n % 3], at(i), { vol: 0.06, dec: 0.22, lp: 3600, dly: 0.12, pan: 0.3 }));
      }
    }
  };

  async function renderGen(t) {
    const r = rng(t.seed);
    const bar = barSec(t);
    const bars = cycleBars(t);
    const cycle = bars * bar;
    const tail = t.genre === 'ambient' || t.genre === 'cinematic' ? 3.5 : 2;
    const shots = await oneShots(rng(t.seed + 1));
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * (cycle + tail)), SR);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.2;
    comp.connect(ctx.destination);

    const bus = ctx.createGain();
    if (t.genre === 'lofi') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3300;
      bus.connect(lp); lp.connect(comp);
    } else bus.connect(comp);

    const verb = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = impulse(ctx, t.genre === 'ambient' || t.genre === 'cinematic' ? 3.2 : 1.6, r);
    const wet = ctx.createGain(); wet.gain.value = t.genre === 'ambient' ? 0.55 : 0.3;
    verb.connect(conv); conv.connect(wet); wet.connect(comp);

    const dly = ctx.createDelay(2);
    dly.delayTime.value = (bar / 16) * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const dOut = ctx.createGain(); dOut.gain.value = 0.4;
    dly.connect(fb); fb.connect(dly); dly.connect(dOut); dOut.connect(bus);

    const S = SCALES[t.scale] || SCALES.minor;
    const deg = i => S[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
    const g = {
      r, bar, bars, step: bar / 16,
      chord: (d, n, up) => [0, 2, 4, 6].slice(0, n).map(k => t.root + (up || 0) + deg(d + k)),
      bass: d => { let m = t.root + deg(d) - 24; while (m < 33) m += 12; return m; }
    };
    PATTERNS[t.genre](kit(ctx, bus, verb, dly, shots, r), t, g);
    const one = await ctx.startRendering();

    /* Repeat the pass, letting each repeat's reverb and echoes ring into
       the next - and the last one's into the first - so the loop has no
       seam where the music player wraps round. */
    const cyc = Math.round(cycle * SR);
    const reps = repsOf(t);
    const total = cyc * reps;
    const out = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: SR });
    for (let c = 0; c < 2; c++) {
      const src = one.getChannelData(c);
      const dst = new Float32Array(total);
      for (let k = 0; k < reps; k++) dst.set(src.subarray(0, cyc), k * cyc);
      const tl = src.length - cyc;
      for (let k = 0; k < reps; k++) {
        const at = ((k + 1) * cyc) % total;
        for (let i = 0; i < tl && at + i < total; i++) dst[at + i] += src[cyc + i];
      }
      out.copyToChannel(dst, c);
    }
    return out;
  }

  function wav(buf) {
    const ch = buf.numberOfChannels, len = buf.length;
    const view = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); view.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true);
    view.setUint32(24, buf.sampleRate, true); view.setUint32(28, buf.sampleRate * ch * 2, true);
    view.setUint16(32, ch * 2, true); view.setUint16(34, 16, true); w(36, 'data'); view.setUint32(40, len * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let peak = 0;
    chans.forEach(c => { for (let i = 0; i < len; i++) { const a = Math.abs(c[i]); if (a > peak) peak = a; } });
    const k = peak > 0 ? 0.89 / peak : 1;
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i] * k));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      o += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  function peaksOf(buf, n) {
    n = n || 160;
    const d0 = buf.getChannelData(0), d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0;
    const per = Math.max(1, Math.floor(d0.length / n));
    const out = [];
    let max = 0;
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = i * per, e = Math.min(d0.length, j + per); j < e; j += 4) {
        const a = Math.max(Math.abs(d0[j]), Math.abs(d1[j]));
        if (a > m) m = a;
      }
      out.push(m);
      if (m > max) max = m;
    }
    return out.map(v => (max ? v / max : 0));
  }

  /* ── Getting a track ready to play ───────────────────────────────── */

  const cache = new Map();     // id -> { blob, url, dur, peaks }
  const pending = new Map();

  async function decodePeaks(blob) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return { peaks: null, dur: 0 };
    const ctx = new AC();
    try {
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      return { peaks: peaksOf(buf), dur: buf.duration };
    } catch (e) { return { peaks: null, dur: 0 }; }
    finally { try { ctx.close(); } catch (e) {} }
  }

  function prepare(t) {
    if (cache.has(t.id)) return Promise.resolve(cache.get(t.id));
    if (pending.has(t.id)) return pending.get(t.id);
    const job = (async () => {
      let out;
      if (t.source === 'gen') {
        const buf = await renderGen(t);
        const blob = wav(buf);
        out = { blob, url: URL.createObjectURL(blob), dur: buf.duration, peaks: peaksOf(buf) };
      } else if (t.source === 'file') {
        const s = await store();
        const blob = s ? await s.get('lib_audio_' + t.id) : null;
        if (!blob) throw new Error('gone');
        const p = await decodePeaks(blob);
        out = { blob, url: URL.createObjectURL(blob), dur: p.dur || t.dur || 0, peaks: p.peaks };
      } else {
        out = { blob: null, url: t.src, dur: 0, peaks: null };
      }
      cache.set(t.id, out);
      return out;
    })();
    pending.set(t.id, job);
    job.then(() => pending.delete(t.id), () => pending.delete(t.id));
    return job;
  }

  /* Waveform for whatever the reel is using. A streamed track is read
     only if its host allows it; otherwise the trimmer draws a plain bar
     rather than a made-up waveform. */
  async function peaksFor(music) {
    if (!music) return null;
    const c = cache.get(music.id);
    if (c && c.peaks) return c.peaks;
    if (music.blob) {
      const p = await decodePeaks(music.blob);
      if (p.peaks) cache.set(music.id, Object.assign({}, c || {}, { peaks: p.peaks, dur: p.dur }));
      return p.peaks;
    }
    if (music.src) {
      try {
        const res = await fetch(music.src, { mode: 'cors' });
        if (!res.ok) return null;
        const p = await decodePeaks(await res.blob());
        if (p.peaks) cache.set(music.id, Object.assign({}, c || {}, { peaks: p.peaks, dur: p.dur, url: music.src }));
        return p.peaks;
      } catch (e) { return null; }
    }
    return null;
  }

  /* The trimmer's picture: the waveform, the part the reel uses lit,
     the rest dimmed. */
  function drawWave(cv, peaks, o) {
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 300, h = cv.clientHeight || 56;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const x = cv.getContext('2d');
    x.scale(dpr, dpr);
    x.clearRect(0, 0, w, h);
    const dur = o.dur || 0;
    const a = dur ? (o.start / dur) * w : 0;
    const b = dur ? Math.min(w, ((o.start + o.len) / dur) * w) : w;
    if (peaks && peaks.length) {
      const n = peaks.length, bw = w / n;
      for (let i = 0; i < n; i++) {
        const cx = i * bw + bw / 2;
        const bh = Math.max(2, peaks[i] * (h - 8));
        x.fillStyle = cx >= a && cx <= b ? '#FFFFFF' : 'rgba(255,255,255,.28)';
        x.fillRect(i * bw + bw * 0.18, (h - bh) / 2, Math.max(1, bw * 0.64), bh);
      }
    } else {
      x.fillStyle = 'rgba(255,255,255,.22)';
      x.fillRect(0, h / 2 - 3, w, 6);
      x.fillStyle = '#FFFFFF';
      x.fillRect(a, h / 2 - 3, b - a, 6);
    }
    x.strokeStyle = '#FCD535';
    x.lineWidth = 2;
    x.beginPath();
    if (x.roundRect) x.roundRect(a + 1, 1, Math.max(4, b - a - 2), h - 2, 8); else x.rect(a + 1, 1, Math.max(4, b - a - 2), h - 2);
    x.stroke();
  }

  /* ── The browser ─────────────────────────────────────────────────── */

  let B = null;     // { q, view, focus, playing, loading, audio, opts }

  function artHTML(t, big) {
    const g = GENRES[t.genre] || GENRES.demo;
    const a = t.art || ['#374151', '#6B7280'];
    return `<span class="mb-art${big ? ' big' : ''}" style="background:linear-gradient(135deg, ${a[0]}, ${a[1]})">${ico(g[1])}</span>`;
  }

  function metaLine(t) {
    const bits = [t.artist];
    const d = durOf(t);
    if (d) bits.push(fmt(d));
    else if (t.source === 'stream') bits.push('Streamed');
    const u = usesOf(t.id);
    if (u) bits.push(`Used in ${u} of your reel${u === 1 ? '' : 's'}`);
    return bits.map(esc).join(' · ');
  }

  function playIcon(t) {
    if (B && B.loading === t.id) return ico('progress_activity', 'mb-spin');
    return ico(B && B.playing === t.id ? 'pause' : 'play_arrow');
  }

  function rowHTML(t, o) {
    const saved = isSaved(t.id), cur = B && B.opts && B.opts.current === t.id;
    return `<div class="mb-row${cur ? ' cur' : ''}" data-mb="pick:${esc(t.id)}" role="button" tabindex="0" aria-label="Use ${esc(t.title)}">
      ${artHTML(t)}
      <span class="mb-t"><b>${esc(t.title)}${cur ? ' <em class="mb-in">In your reel</em>' : ''}</b><span>${metaLine(t)}</span></span>
      <button type="button" class="mb-ib" data-mb="play:${esc(t.id)}" aria-label="${B && B.playing === t.id ? 'Pause' : 'Preview'} ${esc(t.title)}">${playIcon(t)}</button>
      <button type="button" class="mb-ib${saved ? ' on' : ''}" data-mb="save:${esc(t.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from saved' : 'Save'}">${ico('bookmark')}</button>
      ${o && o.remove ? `<button type="button" class="mb-ib" data-mb="remove:${esc(t.id)}" aria-label="Remove from this device">${ico('delete')}</button>` : ''}
    </div>`;
  }

  function cardHTML(t) {
    return `<div class="mb-card" data-mb="pick:${esc(t.id)}" role="button" tabindex="0" aria-label="Use ${esc(t.title)}">
      <span class="mb-card-art">${artHTML(t, true)}
        <button type="button" class="mb-card-p" data-mb="play:${esc(t.id)}" aria-label="Preview ${esc(t.title)}">${playIcon(t)}</button></span>
      <b>${esc(t.title)}</b><span>${esc(GENRES[t.genre] ? GENRES[t.genre][0] : '')} · ${esc(t.mood)}</span>
    </div>`;
  }

  const secH = (title, note, more) => `<div class="mb-sec"><h3>${esc(title)}</h3>${note ? `<span>${esc(note)}</span>` : ''}${
    more ? `<button type="button" class="mb-more" data-mb="view:${esc(more)}">See all</button>` : ''}</div>`;

  function forYou() {
    const s = st();
    const seen = s.saved.concat(s.recent).map(byId).filter(Boolean);
    const like = {};
    seen.forEach(t => { like[t.genre] = (like[t.genre] || 0) + 2; like[t.mood] = (like[t.mood] || 0) + 1; });
    const score = t => (like[t.genre] || 0) + (like[t.mood] || 0);
    return ORIGINALS.filter(t => s.recent.indexOf(t.id) < 0)
      .map((t, i) => ({ t, k: score(t) * 10 - i * 0.01 + (seen.length ? 0 : rng(t.seed + new Date().getDate())()) }))
      .sort((a, b) => b.k - a.k).slice(0, 5).map(x => x.t);
  }

  function homeHTML() {
    const s = st();
    const saved = s.saved.map(byId).filter(Boolean);
    const recent = s.recent.map(byId).filter(Boolean);
    const used = all().filter(t => usesOf(t.id) > 0).sort((a, b) => usesOf(b.id) - usesOf(a.id)).slice(0, 5);
    const fresh = ORIGINALS.slice().sort((a, b) => String(b.added).localeCompare(String(a.added))).slice(0, 4);
    const mine = files();

    return `
      <div class="mb-short" role="group" aria-label="Shortcuts">
        ${B.opts.onVoiceover ? `<button type="button" class="mb-chip" data-mb="voice">${ico('mic')}Voiceover</button>` : ''}
        <button type="button" class="mb-chip" data-mb="add">${ico('upload')}Add your audio</button>
        <button type="button" class="mb-chip" data-mb="view:saved">${ico('bookmark')}Saved${saved.length ? ` <em>${saved.length}</em>` : ''}</button>
        <button type="button" class="mb-chip" data-mb="view:recent">${ico('history')}Recent</button>
        ${B.opts.current ? `<button type="button" class="mb-chip" data-mb="none">${ico('music_off')}No music</button>` : ''}
      </div>

      ${secH('Featured')}
      <div class="mb-cards">${FEATURED.map(byId).filter(Boolean).map(cardHTML).join('')}</div>

      ${secH('For you', saved.length || recent.length ? 'from what you save and use' : '')}
      ${forYou().map(t => rowHTML(t)).join('')}

      ${secH('Trending here', 'by reels made on this device')}
      ${used.length ? used.map(t => rowHTML(t)).join('')
        : '<p class="mb-empty">Tracks you use in reels show up here, most-used first.</p>'}

      ${secH('New releases')}
      ${fresh.map(t => rowHTML(t)).join('')}

      ${saved.length ? secH('Saved', '', saved.length > 3 ? 'saved' : '') + saved.slice(0, 3).map(t => rowHTML(t)).join('') : ''}
      ${recent.length ? secH('Recently used', '', recent.length > 3 ? 'recent' : '') + recent.slice(0, 3).map(t => rowHTML(t)).join('') : ''}

      ${secH('Your audio', 'kept on this device', mine.length > 3 ? 'yours' : '')}
      ${mine.length ? mine.slice(0, 3).map(t => rowHTML(t, { remove: true })).join('')
        : '<p class="mb-empty">Add a song or sound from your device and it stays here for your next reel.</p>'}

      ${secH('Genres')}
      <div class="mb-tiles">${Object.keys(GENRES).filter(k => ORIGINALS.some(t => t.genre === k)).map(k => {
        const t = ORIGINALS.find(x => x.genre === k);
        return `<button type="button" class="mb-tile" data-mb="view:genre:${k}" style="background:linear-gradient(135deg, ${t.art[0]}, ${t.art[1]})">${ico(GENRES[k][1])}<b>${esc(GENRES[k][0])}</b></button>`;
      }).join('')}</div>

      ${secH('Moods')}
      <div class="mb-moods">${MOODS.map(m => `<button type="button" class="mb-chip" data-mb="view:mood:${m}">${esc(m)}</button>`).join('')}</div>

      ${secH('SoundHelix demos', 'streamed from soundhelix.com')}
      ${streams().slice(0, 4).map(t => rowHTML(t)).join('')}
      <button type="button" class="mb-more wide" data-mb="view:genre:demo">All ${streams().length} demos</button>

      <p class="mb-note">Trending Originals are composed on this device when you play them, so they are free to use in anything you post. SoundHelix demos stream from their site. Your audio never leaves this device.</p>`;
  }

  function viewList() {
    const v = B.view;
    const s = st();
    if (v === 'saved') return ['Saved', s.saved.map(byId).filter(Boolean), 'Tap the bookmark on any track to keep it here.'];
    if (v === 'recent') return ['Recently used', s.recent.map(byId).filter(Boolean), 'Tracks you add to a reel show up here.'];
    if (v === 'yours') return ['Your audio', files(), 'Nothing added yet.'];
    if (v.indexOf('genre:') === 0) { const k = v.slice(6); return [(GENRES[k] || [k])[0], all().filter(t => t.genre === k), 'No tracks in this genre yet.']; }
    if (v.indexOf('mood:') === 0) { const m = v.slice(5); return [m, all().filter(t => t.mood === m), 'No tracks with this mood yet.']; }
    return ['', [], ''];
  }

  function matches(t, q) {
    const g = GENRES[t.genre] ? GENRES[t.genre][0] : '';
    return [t.title, t.artist, t.album, g, t.mood].some(x => String(x || '').toLowerCase().includes(q));
  }

  function suggestions(q) {
    if (!q) return [];
    const out = [], seen = new Set();
    const add = (label, kind) => { const k = label.toLowerCase(); if (!seen.has(k) && k.includes(q)) { seen.add(k); out.push([label, kind]); } };
    all().forEach(t => add(t.title, 'Song'));
    Object.keys(GENRES).forEach(k => add(GENRES[k][0], 'Genre'));
    MOODS.forEach(m => add(m, 'Mood'));
    ['Trending Originals', 'SoundHelix', 'Your audio'].forEach(a => add(a, 'Artist'));
    return out.sort((a, b) => (b[0].toLowerCase().startsWith(q) - a[0].toLowerCase().startsWith(q))).slice(0, 6);
  }

  function bodyHTML() {
    const q = B.q.trim().toLowerCase();
    if (q) {
      const hits = all().filter(t => matches(t, q));
      return `${secH(hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : 'No results')}
        ${hits.length ? hits.map(t => rowHTML(t, { remove: t.source === 'file' })).join('')
          : `<p class="mb-empty">Nothing matches “${esc(B.q.trim())}”. Try a genre like lo-fi or a mood like calm.</p>`}`;
    }
    if (B.view === 'home') return homeHTML();
    const [title, list, empty] = viewList();
    return `<button type="button" class="mb-back" data-mb="view:home">${ico('arrow_back')}All music</button>
      ${secH(title, list.length ? `${list.length} track${list.length === 1 ? '' : 's'}` : '')}
      ${list.length ? list.map(t => rowHTML(t, { remove: t.source === 'file' })).join('') : `<p class="mb-empty">${esc(empty)}</p>`}
      ${B.view === 'yours' ? `<button type="button" class="mb-more wide" data-mb="add">${ico('upload')}Add audio from your device</button>` : ''}`;
  }

  function paintBody(keepScroll) {
    const body = $('mb-body');
    if (!body || !B) return;
    const y = keepScroll ? body.scrollTop : 0;
    body.innerHTML = bodyHTML();
    body.scrollTop = y;
  }

  function paintSugg() {
    const box = $('mb-sugg');
    if (!box || !B) return;
    const list = B.focus ? suggestions(B.q.trim().toLowerCase()) : [];
    box.hidden = !list.length;
    box.innerHTML = list.map(([l, k]) => `<button type="button" class="mb-sug" data-mb="sug:${esc(l)}">${ico(k === 'Song' ? 'music_note' : k === 'Genre' ? 'category' : k === 'Mood' ? 'mood' : 'person')}<b>${esc(l)}</b><em>${k}</em></button>`).join('');
    const x = $('mb-x');
    if (x) x.hidden = !B.q;
  }

  /* opts: { host, current, onPick(track, ready), onVoiceover(), onNone(), onClose() } */
  function open(opts) {
    close(true);
    B = { q: '', view: 'home', focus: false, playing: null, loading: null, audio: null, opts: opts || {} };
    const el = document.createElement('div');
    el.id = 'mb';
    el.className = 'mb';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Music');
    el.innerHTML = `
      <div class="mb-top">
        <button type="button" class="stu-round" data-mb="close" aria-label="Close music">${ico('arrow_back')}</button>
        <label class="mb-search">${ico('search')}
          <input id="mb-q" type="search" placeholder="Search songs, artists, genres, moods" autocomplete="off" aria-label="Search music" enterkeyhint="search">
          <button type="button" class="mb-x" id="mb-x" data-mb="clear" aria-label="Clear search" hidden>${ico('close')}</button>
        </label>
      </div>
      <div class="mb-sugg" id="mb-sugg" hidden></div>
      <div class="mb-body" id="mb-body"></div>
      <input type="file" id="mb-file" accept="audio/*" hidden>`;
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); if (B && B.q) { setQ(''); } else close(); }
      else if (e.key === 'Enter' && e.target.matches('.mb-row, .mb-card')) { e.preventDefault(); onClick({ target: e.target }); }
    });
    el.addEventListener('input', e => { if (e.target.id === 'mb-q') { B.q = e.target.value; B.focus = true; paintSugg(); paintBody(); } });
    el.addEventListener('focusin', e => { if (e.target.id === 'mb-q') { B.focus = true; paintSugg(); } });
    el.addEventListener('focusout', e => { if (e.target.id === 'mb-q') setTimeout(() => { if (B) { B.focus = false; paintSugg(); } }, 150); });
    el.querySelector('#mb-file').addEventListener('change', onFile);
    (B.opts.host || document.body).appendChild(el);
    paintBody();
  }

  function close(silent) {
    stopPreview();
    const el = $('mb');
    if (el) el.remove();
    const had = !!B;
    const cb = B && B.opts.onClose;
    B = null;
    if (had && !silent && cb) cb();
  }

  function setQ(v) {
    B.q = v;
    const i = $('mb-q');
    if (i) i.value = v;
    paintSugg(); paintBody();
  }

  function stopPreview() {
    if (B && B.audio) { try { B.audio.pause(); } catch (e) {} B.audio = null; }
    if (B) B.playing = null;
  }

  async function preview(id) {
    const t = byId(id);
    if (!t || !B) return;
    if (B.playing === id) { stopPreview(); paintBody(true); return; }
    stopPreview();
    B.loading = id; paintBody(true);
    try {
      const r = await prepare(t);
      if (!B || B.loading !== id) return;
      B.loading = null;
      const a = new Audio(r.url);
      a.volume = 0.85;
      a.onended = () => { if (B && B.playing === id) { B.playing = null; paintBody(true); } };
      B.audio = a; B.playing = id;
      await a.play();
      if (!r.dur && isFinite(a.duration)) r.dur = a.duration;
    } catch (e) {
      if (B) { B.loading = null; B.playing = null; }
      toast(t.source === 'file' ? 'That audio is no longer on this device.' : 'Could not play that track.');
    }
    paintBody(true);
  }

  async function pick(id) {
    const t = byId(id);
    if (!t || !B) return;
    stopPreview();
    B.loading = id; paintBody(true);
    try {
      const r = await prepare(t);
      if (!B) return;
      noteRecent(t.id);
      const cb = B.opts.onPick;
      close(true);
      if (cb) cb(t, r);
    } catch (e) {
      if (B) { B.loading = null; paintBody(true); }
      toast(t.source === 'file' ? 'That audio is no longer on this device.' : 'Could not load that track.');
    }
  }

  async function onFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!/^audio\//.test(f.type)) { toast('That is not an audio file.'); return; }
    if (f.size > MAX_FILE) { toast('Audio over 30 MB is too big to keep on this device.'); return; }
    const s = await store();
    if (!s) { toast('This browser’s storage is not available.'); return; }
    const id = 'f' + Date.now().toString(36);
    try { await s.put('lib_audio_' + id, f); }
    catch (err) { toast('Could not save — this device may be out of storage.'); return; }
    const p = await decodePeaks(f);
    const l = lib();
    l.unshift({ id, title: f.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 60) || 'Your audio', dur: p.dur || 0, size: f.size, added: new Date().toISOString().slice(0, 10) });
    putLib(l);
    if (p.peaks) cache.set(id, { blob: f, url: URL.createObjectURL(f), dur: p.dur, peaks: p.peaks });
    toast('Added to your audio');
    if (B) { B.view = 'yours'; paintBody(); }
  }

  async function removeFile(id) {
    const t = byId(id);
    if (!t || t.source !== 'file') return;
    putLib(lib().filter(f => f.id !== id));
    const s = st(); s.saved = s.saved.filter(x => x !== id); s.recent = s.recent.filter(x => x !== id); putSt(s);
    const c = cache.get(id);
    if (c && c.url) { try { URL.revokeObjectURL(c.url); } catch (e) {} }
    cache.delete(id);
    const bs = await store();
    if (bs && bs.del) { try { await bs.del('lib_audio_' + id); } catch (e) {} }
    toast('Removed from this device');
    paintBody(true);
  }

  function onClick(e) {
    const b = e.target.closest && e.target.closest('[data-mb]');
    if (!b || !B) return;
    if (e.stopPropagation) e.stopPropagation();
    const [act, arg] = b.dataset.mb.split(/:(.*)/s);
    switch (act) {
      case 'close': return close();
      case 'clear': return setQ('');
      case 'sug': B.focus = false; return setQ(arg);
      case 'view': B.view = arg || 'home'; setQ(''); { const body = $('mb-body'); if (body) body.scrollTop = 0; } return;
      case 'play': return preview(arg);
      case 'save': { const on = toggleSave(arg); toast(on ? 'Saved' : 'Removed from saved'); return paintBody(true); }
      case 'pick': return pick(arg);
      case 'remove': return removeFile(arg);
      case 'add': { const f = $('mb-file'); if (f) f.click(); return; }
      case 'voice': { const cb = B.opts.onVoiceover; close(true); if (cb) cb(); return; }
      case 'none': { const cb = B.opts.onNone; close(true); if (cb) cb(); return; }
    }
  }

  return {
    open, close, prepare, peaksFor, drawWave, noteUse, noteRecent, byId, all,
    GENRES, ORIGINALS, genDur
  };
})();

window.MUS = MUS;

import { publish } from '../globals.js?v=3';
publish('features/studio-music.js', { MUS: () => MUS });
