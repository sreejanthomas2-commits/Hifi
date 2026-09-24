/* ╔══════════════════════════════════════════════════════════════════╗
   ║  STUDIO CAPTIONS — speech to timed captions, on this device       ║
   ║                                                                   ║
   ║  Whisper (tiny, multilingual) running in the browser through      ║
   ║  transformers.js. The first run downloads the model - about 41 MB ║
   ║  from Hugging Face - and the browser keeps it; the audio itself   ║
   ║  never leaves the device, and no API key is involved.             ║
   ║                                                                   ║
   ║  Each clip is transcribed at its own speed and its timestamps     ║
   ║  mapped onto the reel's timeline - through the trim, the speed    ║
   ║  change and the clips before it - so a caption shows while its    ║
   ║  words are heard. Muted clips are skipped; a voiceover is         ║
   ║  transcribed too.                                                 ║
   ║                                                                   ║
   ║  Nothing is invented when there is no speech: the result is an    ║
   ║  empty list and the studio says so.                               ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CAP = (() => {

  /* Pinned, not a range: this is code the page runs. */
  const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
  const MODEL = 'onnx-community/whisper-tiny';
  const MODEL_MB = 41;

  const LANGS = [
    ['', 'Detect automatically'], ['english', 'English'], ['hindi', 'Hindi'], ['spanish', 'Spanish'],
    ['portuguese', 'Portuguese'], ['french', 'French'], ['german', 'German'], ['arabic', 'Arabic'],
    ['indonesian', 'Indonesian'], ['japanese', 'Japanese'], ['korean', 'Korean'], ['chinese', 'Chinese'],
    ['russian', 'Russian'], ['turkish', 'Turkish'], ['italian', 'Italian'], ['bengali', 'Bengali'],
    ['tamil', 'Tamil'], ['urdu', 'Urdu']
  ];

  let asr = null, loading = null;

  /* The model files arrive in several parts; this folds their progress
     into one number. */
  function progressFolder(cb) {
    const files = {};
    return p => {
      if (!p || !cb) return;
      if (p.status === 'progress' && p.file) {
        files[p.file] = { loaded: p.loaded || 0, total: p.total || 0 };
        const vals = Object.values(files);
        const total = vals.reduce((a, f) => a + f.total, 0);
        const loaded = vals.reduce((a, f) => a + f.loaded, 0);
        cb({ stage: 'download', pct: total ? Math.round(loaded / total * 100) : 0, mb: loaded / 1e6 });
      } else if (p.status === 'ready') cb({ stage: 'ready' });
    };
  }

  async function load(onProgress) {
    if (asr) return asr;
    if (!loading) {
      loading = (async () => {
        const T = await import(LIB);
        T.env.allowLocalModels = false;
        return T.pipeline('automatic-speech-recognition', MODEL, { dtype: 'q8', progress_callback: progressFolder(onProgress) });
      })();
    }
    try { asr = await loading; }
    catch (e) { loading = null; throw e; }
    return asr;
  }
  const ready = () => !!asr;

  /* A clip's audio between two points, as 16 kHz mono - what Whisper
     reads. A clip with no sound track fails to decode; that is "no
     speech", not an error. */
  async function pcm16k(blob, from, to) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !window.OfflineAudioContext) throw new Error('This browser cannot decode audio.');
    const ab = await blob.arrayBuffer();
    const ctx = new AC();
    let buf;
    try { buf = await ctx.decodeAudioData(ab); }
    catch (e) { return null; }
    finally { try { ctx.close(); } catch (e) {} }
    const a = Math.max(0, from || 0);
    const b = Math.min(buf.duration, to && to > a ? to : buf.duration);
    if (b - a < 0.3) return null;
    const off = new OfflineAudioContext(1, Math.ceil((b - a) * 16000), 16000);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.connect(off.destination);
    src.start(0, a, b - a);
    const out = await off.startRendering();
    return out.getChannelData(0);
  }

  /* Long stretches read badly on a phone: split any line over seven
     words into shorter ones, sharing its time by word count. */
  function splitLong(seg) {
    const words = seg.text.split(/\s+/).filter(Boolean);
    if (words.length <= 7) return [seg];
    const parts = [];
    const n = Math.ceil(words.length / 6);
    const per = Math.ceil(words.length / n);
    const span = seg.t1 - seg.t0;
    for (let i = 0; i < words.length; i += per) {
      const w = words.slice(i, i + per);
      parts.push({
        t0: seg.t0 + span * (i / words.length),
        t1: seg.t0 + span * (Math.min(words.length, i + per) / words.length),
        text: w.join(' ')
      });
    }
    return parts;
  }

  function collect(res, map, into) {
    const chunks = (res && res.chunks) || [];
    chunks.forEach(ch => {
      const text = String(ch.text || '').trim();
      if (!text || /^\[.*\]$|^\(.*\)$/.test(text)) return;       // [Music], (applause)
      const ts = ch.timestamp || [];
      const s = Number(ts[0]) || 0;
      const e = ts[1] == null ? s + 2.5 : Number(ts[1]);
      const seg = map(s, e);
      if (seg && seg.t1 - seg.t0 > 0.05) into.push({ ...seg, text });
    });
  }

  /* project: the studio project. o: { lang, onProgress({stage, pct, mb, label}) } */
  async function transcribe(project, o) {
    o = o || {};
    const say = x => { if (o.onProgress) o.onProgress(x); };
    const pipe = await load(say);
    const opts = { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5, task: 'transcribe' };
    if (o.lang) opts.language = o.lang;

    const segs = [];
    const clips = project.clips || [];
    let offset = 0;
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      const speed = c.speed || 1;
      const len = Math.max(0, ((c.out || 0) - (c.in || 0)) / speed);
      if (!c.mute && c.blob && len > 0.3) {
        say({ stage: 'listen', label: clips.length > 1 ? `Listening to clip ${i + 1} of ${clips.length}…` : 'Listening…' });
        const pcm = await pcm16k(c.blob, c.in || 0, c.out || 0);
        if (pcm && pcm.length) {
          const res = await pipe(pcm, opts);
          const base = offset;
          collect(res, (s, e) => ({ t0: base + s / speed, t1: Math.min(base + len, base + e / speed) }), segs);
        }
      }
      offset += len;
    }

    const m = project.music;
    if (m && m.voice && m.blob) {
      say({ stage: 'listen', label: 'Listening to your voiceover…' });
      const pcm = await pcm16k(m.blob, 0, 0);
      if (pcm && pcm.length) {
        const res = await pipe(pcm, opts);
        const start = m.start || 0;
        collect(res, (s, e) => ({ t0: Math.max(0, s - start), t1: Math.min(offset, e - start) }), segs);
      }
    }

    return segs
      .sort((a, b) => a.t0 - b.t0)
      .flatMap(splitLong)
      .map((s, i) => ({ id: 'cl' + Date.now().toString(36) + i, t0: Math.round(s.t0 * 100) / 100, t1: Math.round(s.t1 * 100) / 100, text: s.text }));
  }

  return { transcribe, load, ready, LANGS, MODEL_MB, MODEL };
})();

window.CAP = CAP;

import { publish } from '../globals.js?v=3';
publish('features/studio-captions.js', { CAP: () => CAP });
