/* ╔══════════════════════════════════════════════════════════════════╗
   ║  STUDIO STICKERS — the sticker kinds a reel can carry             ║
   ║                                                                   ║
   ║  One renderer for the studio preview and the Shorty player, so a  ║
   ║  sticker looks the same where it is made and where it is watched: ║
   ║                                                                   ║
   ║    emoji      static, or animated (pulse, bounce, spin, float,    ║
   ║               wiggle)                                             ║
   ║    pills      mention, hashtag, location, time, date, day,        ║
   ║               music, link                                         ║
   ║    cards      poll, quiz, question, countdown                     ║
   ║                                                                   ║
   ║  In the player the interactive ones answer a tap: vote in a poll, ║
   ║  answer a quiz, reply to a question, open the person, the tag or  ║
   ║  the link. Votes and answers are kept on this device - there is   ║
   ║  no server to count anyone else's - and the cards say so rather   ║
   ║  than inventing a crowd.                                          ║
   ║                                                                   ║
   ║  A link opens only on a tap, in a new tab, with noopener and      ║
   ║  noreferrer, and only if it is https.                             ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const STK = (() => {

  const VKEY = 'ts_stu_votes_v1';

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s)) : String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const ico = n => `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const pad = n => String(n).padStart(2, '0');

  const KINDS = {
    mention:   { n: 'Mention',   icon: 'alternate_email', pill: true, int: true },
    hashtag:   { n: 'Hashtag',   icon: 'tag',             pill: true, int: true },
    location:  { n: 'Location',  icon: 'location_on',     pill: true },
    time:      { n: 'Time',      icon: 'schedule',        pill: true },
    date:      { n: 'Date',      icon: 'calendar_today',  pill: true },
    day:       { n: 'Day',       icon: 'today',           pill: true },
    music:     { n: 'Music',     icon: 'music_note',      pill: true },
    link:      { n: 'Link',      icon: 'link',            pill: true, int: true },
    poll:      { n: 'Poll',      icon: 'ballot',          card: true, int: true },
    quiz:      { n: 'Quiz',      icon: 'quiz',            card: true, int: true },
    question:  { n: 'Question',  icon: 'help',            card: true, int: true },
    countdown: { n: 'Countdown', icon: 'timer',           card: true }
  };

  const STYLES = [['light', 'Light'], ['dark', 'Dark'], ['glass', 'Glass'], ['brand', 'Colour']];
  const ANIMS = [['none', 'Still'], ['pulse', 'Pulse'], ['bounce', 'Bounce'], ['spin', 'Spin'], ['float', 'Float'], ['wiggle', 'Wiggle']];

  /* Every sticker drawn, by id, so a tap in the player can redraw the
     one it landed on without the rest of the overlay. */
  const REG = new Map();

  function store() {
    try { return Object.assign({ v: {}, a: {} }, JSON.parse(localStorage.getItem(VKEY) || '{}')); }
    catch (e) { return { v: {}, a: {} }; }
  }
  function put(s) { try { localStorage.setItem(VKEY, JSON.stringify(s)); } catch (e) {} }

  function safeUrl(u) {
    try {
      const x = new URL(String(u || '').trim());
      return x.protocol === 'https:' ? x.href : '';
    } catch (e) { return ''; }
  }
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'Link'; } };

  function cdText(at) {
    let ms = (Number(at) || 0) - Date.now();
    if (ms <= 0) return 'Ended';
    const d = Math.floor(ms / 864e5); ms -= d * 864e5;
    const h = Math.floor(ms / 36e5); ms -= h * 36e5;
    const m = Math.floor(ms / 6e4); ms -= m * 6e4;
    const s = Math.floor(ms / 1000);
    return d ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function pillText(s) {
    const d = s.d || {};
    switch (s.kind) {
      case 'mention':  return d.handle || '@someone';
      case 'hashtag':  return '#' + String(d.tag || '').replace(/^#/, '');
      case 'location': return d.place || 'Somewhere';
      case 'music':    return d.title ? d.title + (d.artist ? ' · ' + d.artist : '') : 'Music';
      case 'link':     return d.label || hostOf(d.url);
      default:         return d.text || '';
    }
  }

  function inner(s) {
    const k = KINDS[s.kind];
    const d = s.d || {};
    if (!k) {
      const a = s.anim && s.anim !== 'none' ? ' a-' + s.anim : '';
      return `<span class="stk-e${a}">${esc(s.emoji || '')}</span>`;
    }
    if (k.pill) {
      return `<span class="stk-pill st-${esc(d.style || 'light')}"${k.int ? ' data-sk="go" role="button" tabindex="0"' : ''}>${ico(k.icon)}<span>${esc(pillText(s))}</span></span>`;
    }

    const st = store();
    if (s.kind === 'poll' || s.kind === 'quiz') {
      const mine = st.v[s.id];
      const voted = mine != null;
      const opts = (d.opts || []).filter(o => String(o || '').trim());
      const rows = opts.map((o, i) => {
        if (s.kind === 'quiz' && voted) {
          const right = i === d.ans, picked = i === mine;
          return `<div class="stk-opt res${right ? ' right' : picked ? ' wrong' : ''}">${ico(right ? 'check_circle' : picked ? 'cancel' : 'radio_button_unchecked')}<span>${esc(o)}</span></div>`;
        }
        if (s.kind === 'poll' && voted) {
          const pct = i === mine ? 100 : 0;
          return `<div class="stk-opt res${i === mine ? ' mine' : ''}"><i style="width:${pct}%"></i><span>${esc(o)}</span><b>${pct}%</b></div>`;
        }
        return `<button type="button" class="stk-opt" data-sk="${s.kind === 'quiz' ? 'answer' : 'vote'}" data-o="${i}">${
          s.kind === 'quiz' ? `<em>${'ABCD'[i]}</em>` : ''}<span>${esc(o)}</span></button>`;
      }).join('');
      const foot = !voted ? ''
        : s.kind === 'poll' ? '<div class="stk-foot">Your vote · counted on this device</div>'
        : `<div class="stk-foot">${mine === d.ans ? 'Correct!' : 'Not quite — the answer is marked'}</div>`;
      return `<div class="stk-card st-${esc(d.style || 'light')}"><div class="stk-q">${esc(d.q || k.n)}</div><div class="stk-opts">${rows}</div>${foot}</div>`;
    }

    if (s.kind === 'question') {
      const n = (st.a[s.id] || []).length;
      return `<div class="stk-card st-${esc(d.style || 'light')}"><div class="stk-q">${esc(d.q || 'Ask me a question')}</div>
        <button type="button" class="stk-ask" data-sk="ask">${n ? `You answered ${n === 1 ? 'once' : n + ' times'} · add another` : 'Tap to answer'}</button></div>`;
    }

    if (s.kind === 'countdown') {
      return `<div class="stk-card st-${esc(d.style || 'light')}"><div class="stk-q">${esc(d.title || 'Countdown')}</div>
        <b class="stk-cd" data-at="${Number(d.at) || 0}">${cdText(d.at)}</b></div>`;
    }
    return '';
  }

  /* One node - the same markup in the studio preview and the player. */
  function node(s) {
    REG.set(s.id, s);
    const k = KINDS[s.kind];
    const cls = ['stu-node', 'stu-sticker'];
    if (k) cls.push('stk', 'stk-k-' + s.kind);
    if (k && k.int) cls.push('stu-int');
    const size = s.size || (k ? 22 : 64);
    if (k && s.kind === 'countdown') tick();
    return `<div class="${cls.join(' ')}" data-id="${esc(s.id)}" data-t0="${s.start || 0}" data-t1="${s.end || 0}"
      style="left:${s.x}%;top:${s.y}%;font-size:${size}px;font-size:${(size / 4.05).toFixed(2)}cqw;transform:translate(-50%,-50%) rotate(${s.rot || 0}deg)">${inner(s)}</div>`;
  }

  /* Countdowns count down while one is on screen, and stop when none is. */
  let ticker = 0;
  function tick() {
    if (ticker) return;
    ticker = setInterval(() => {
      const els = document.querySelectorAll('.stk-cd');
      if (!els.length) { clearInterval(ticker); ticker = 0; return; }
      els.forEach(e => { e.textContent = cdText(e.dataset.at); });
    }, 1000);
  }

  function redraw(el) {
    const s = REG.get(el.dataset.id);
    if (s) el.innerHTML = inner(s);
  }

  function closePlayer() { if (window.SH && SH.close) SH.close(); }

  function act(what, el, b) {
    const s = REG.get(el.dataset.id);
    if (!s) return;
    const d = s.d || {};

    if (what === 'vote' || what === 'answer') {
      const st = store();
      if (st.v[s.id] != null) return;
      st.v[s.id] = Number(b.dataset.o);
      put(st);
      redraw(el);
      return;
    }

    if (what === 'ask') {
      if (typeof appPrompt !== 'function') return;
      Promise.resolve(appPrompt(d.q || 'Your answer', '', { title: 'Answer', ok: 'Send' })).then(v => {
        const text = String(v == null ? '' : v).trim();
        if (!text) return;
        const st = store();
        (st.a[s.id] = st.a[s.id] || []).push({ text: text.slice(0, 280), at: Date.now() });
        put(st);
        redraw(el);
        toast('Answer saved on this device');
      });
      return;
    }

    if (what === 'go') {
      if (s.kind === 'link') {
        const u = safeUrl(d.url);
        if (u) window.open(u, '_blank', 'noopener,noreferrer');
        else toast('That link is not a secure https address, so it will not open.');
        return;
      }
      if (s.kind === 'mention' && d.handle) {
        closePlayer();
        if (window.PG && PG.openUser) PG.openUser(d.handle, d.name || d.handle);
        return;
      }
      if (s.kind === 'hashtag' && d.tag) {
        const tag = String(d.tag).replace(/^#/, '');
        closePlayer();
        if (window.SR && SR.open && SR.openTag) { SR.open('#' + tag, true); SR.openTag(tag); }
      }
    }
  }

  /* Taps in the player. In the studio the overlay is in edit mode and
     every sticker is something to drag, so nothing here fires. */
  function onTap(e) {
    const b = e.target.closest && e.target.closest('[data-sk]');
    if (!b) return;
    const el = b.closest('.stu-node');
    const ov = el && el.closest('.stu-ov');
    if (!ov || ov.classList.contains('edit')) return;
    e.preventDefault();
    e.stopPropagation();
    act(b.dataset.sk, el, b);
  }
  document.addEventListener('click', onTap, true);
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.stu-ov:not(.edit) [data-sk]')) onTap(e);
  }, true);

  return { node, inner, KINDS, STYLES, ANIMS, safeUrl, cdText, store };
})();

window.STK = STK;

import { publish } from '../globals.js?v=3';
publish('features/studio-stickers.js', { STK: () => STK });
