/* ╔══════════════════════════════════════════════════════════════════╗
   ║  HASHTAGS — the picker behind every caption's # button            ║
   ║                                                                   ║
   ║  Search, Trending, Related and Recent, each tag with the number   ║
   ║  of posts that carry it. Picking one inserts it into the caption  ║
   ║  at the cursor; the sheet stays open so several can be added.     ║
   ║                                                                   ║
   ║  The counts are real for what this app holds: feed posts, your    ║
   ║  own posts and the Shorty library. With no server they are not    ║
   ║  platform-wide numbers, and the sheet does not pretend they are.  ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const HT = (() => {

  const RKEY = 'ts_tags_recent_v1';
  const TAG = /#([\p{L}\p{N}_]{2,40})/gu;

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s)) : String(s == null ? '' : s));
  const ico = n => `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
  const norm = t => String(t || '').replace(/^#/, '').trim().toLowerCase();
  const tagsIn = text => { const out = []; String(text || '').replace(TAG, (m, t) => { out.push(t.toLowerCase()); return m; }); return out; };

  function recent() { try { return JSON.parse(localStorage.getItem(RKEY) || '[]'); } catch (e) { return []; } }
  function remember(t) {
    const list = [t].concat(recent().filter(x => x !== t)).slice(0, 12);
    try { localStorage.setItem(RKEY, JSON.stringify(list)); } catch (e) {}
  }

  /* Every tag the app holds, how many posts carry it, and which tags
     travel together — the last is what "Related" is built from. */
  function index() {
    const count = new Map(), pair = new Map();
    const add = list => {
      const uniq = [...new Set(list.map(norm).filter(Boolean))];
      uniq.forEach(t => count.set(t, (count.get(t) || 0) + 1));
      uniq.forEach(a => uniq.forEach(b => {
        if (a === b) return;
        const m = pair.get(a) || new Map();
        m.set(b, (m.get(b) || 0) + 1);
        pair.set(a, m);
      }));
    };
    const posts = (typeof DATA !== 'undefined' && Array.isArray(DATA.posts)) ? DATA.posts : [];
    posts.forEach(p => add((p.tags || []).concat(tagsIn(p.body))));
    const shorts = (window.SH && SH.CATALOG) ? SH.CATALOG : [];
    shorts.forEach(s => add(tagsIn(s.caption)));
    return { count, pair };
  }

  let V = null;

  /* opts: { text(): string, insert(str) } */
  function open(opts) {
    close();
    V = { q: '', picked: [], opts: opts || {}, idx: index() };
    const el = document.createElement('div');
    el.id = 'ht';
    el.className = 'ht-scrim';
    el.innerHTML = `<div class="ht-sheet" role="dialog" aria-label="Add hashtags">
      <div class="ht-head"><h3>Hashtags</h3>
        <button type="button" class="ht-done" data-ht="close">Done</button></div>
      <label class="ht-search">${ico('tag')}
        <input type="search" id="ht-q" placeholder="Search hashtags" autocomplete="off" enterkeyhint="done" aria-label="Search hashtags"></label>
      <div class="ht-body" id="ht-body"></div>
    </div>`;
    el.addEventListener('click', e => {
      if (e.target === el) return close();
      const b = e.target.closest('[data-ht]');
      if (!b) return;
      const [act, arg] = b.dataset.ht.split(/:(.*)/s);
      if (act === 'close') close();
      else if (act === 'pick') pick(arg);
    });
    el.addEventListener('input', e => { if (e.target.id === 'ht-q') { V.q = e.target.value; paint(); } });
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Enter' && e.target.id === 'ht-q') {
        e.preventDefault();
        const q = norm(V.q).replace(/[^\p{L}\p{N}_]/gu, '');
        if (q.length >= 2) pick(q);
      }
    });
    document.body.appendChild(el);
    paint();
    const q = document.getElementById('ht-q');
    if (q) q.focus({ preventScroll: true });
  }

  function close() {
    const el = document.getElementById('ht');
    if (el) el.remove();
    V = null;
  }

  const inCaption = () => new Set(tagsIn(V && V.opts.text ? V.opts.text() : ''));

  function row(t, n, has) {
    return `<button type="button" class="ht-row${has ? ' on' : ''}" data-ht="pick:${esc(t)}" aria-pressed="${has}">
      <span class="ht-hash">#</span>
      <span class="ht-t"><b>#${esc(t)}</b><em>${n ? `${n.toLocaleString()} ${n === 1 ? 'post' : 'posts'}` : 'New tag'}</em></span>
      ${ico(has ? 'check_circle' : 'add')}
    </button>`;
  }

  function paint() {
    const host = document.getElementById('ht-body');
    if (!host || !V) return;
    const { count, pair } = V.idx;
    const have = inCaption();
    const q = norm(V.q).replace(/[^\p{L}\p{N}_]/gu, '');
    const sec = (title, list, note) => list.length
      ? `<div class="ht-sec">${esc(title)}${note ? `<span>${esc(note)}</span>` : ''}</div>${list.map(t => row(t, count.get(t) || 0, have.has(t))).join('')}` : '';

    if (q) {
      const hits = [...count.keys()].filter(t => t.includes(q))
        .sort((a, b) => (b.startsWith(q) - a.startsWith(q)) || (count.get(b) - count.get(a))).slice(0, 30);
      const exact = count.has(q);
      host.innerHTML = (exact ? '' : row(q, 0, have.has(q))) + sec('Matching', hits)
        + (!hits.length && q.length < 2 ? '<p class="ht-empty">Type at least two letters.</p>' : '');
      return;
    }

    const trending = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(e => e[0]);
    const rel = new Map();
    have.forEach(t => (pair.get(t) || new Map()).forEach((n, u) => { if (!have.has(u)) rel.set(u, (rel.get(u) || 0) + n); }));
    const related = [...rel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
    const rec = recent().filter(t => t);

    host.innerHTML =
      sec('Related', related, 'to the tags in your caption') +
      sec('Recent', rec.slice(0, 8)) +
      sec('Trending', trending, 'by posts on Trending') ||
      '<p class="ht-empty">No hashtags yet. Type one above to add it.</p>';
  }

  function pick(t) {
    t = norm(t);
    if (!t || !V) return;
    if (inCaption().has(t)) { paint(); return; }
    if (V.opts.insert) V.opts.insert('#' + t);
    remember(t);
    V.q = '';
    const q = document.getElementById('ht-q');
    if (q) q.value = '';
    paint();
  }

  /* Put a tag into a text box at the cursor, with a space either side
     only where one is missing. Returns the new value. */
  function insertAt(box, str) {
    if (!box) return '';
    const v = box.value;
    const at = box.selectionStart != null ? box.selectionStart : v.length;
    const end = box.selectionEnd != null ? box.selectionEnd : at;
    const before = v.slice(0, at), after = v.slice(end);
    const lead = before && !/\s$/.test(before) ? ' ' : '';
    const tail = after && /^\s/.test(after) ? '' : ' ';
    box.value = before + lead + str + tail + after;
    const pos = (before + lead + str + tail).length;
    try { box.setSelectionRange(pos, pos); } catch (e) {}
    box.dispatchEvent(new Event('input', { bubbles: true }));
    return box.value;
  }

  return { open, close, index, tagsIn, insertAt };
})();

window.HT = HT;

import { publish } from '../globals.js?v=3';
publish('features/hashtags.js', { HT: () => HT });
