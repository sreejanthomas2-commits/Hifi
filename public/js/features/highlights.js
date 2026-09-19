/* ╔══════════════════════════════════════════════════════════════════╗
   ║  STORY HIGHLIGHTS — the circles on your profile                  ║
   ║                                                                  ║
   ║  The row of circles under Edit profile holds your highlights:    ║
   ║  named collections of photo and text stories that stay on the    ║
   ║  profile. "New" makes one; a tap plays it full screen; the ⋯ in  ║
   ║  the player edits or deletes it (so does a long press).          ║
   ║                                                                  ║
   ║  Photos never leave the device. They are shrunk to story size    ║
   ║  (at most 720×1280, JPEG) and kept in this browser's storage,    ║
   ║  separately for each account signed in here.                     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const HL = (() => {

  const KEY = 'ts_highlights_v1';
  const MAX_HL = 30, MAX_FRAMES = 20, TITLE_MAX = 20, TEXT_MAX = 200;
  const FRAME_MS = 5000;
  const BGS = [
    'linear-gradient(160deg, #7C5CFF, #EC4899)',
    'linear-gradient(160deg, #0EA5E9, #2EBD85)',
    'linear-gradient(160deg, #F97316, #F43F5E)',
    'linear-gradient(160deg, #111827, #4B5563)',
    'linear-gradient(160deg, #F0B90B, #F97316)',
    'linear-gradient(160deg, #1E3A8A, #7C3AED)'
  ];
  const PHOTO_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const ico = (n, cls) => `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}" aria-hidden="true">${n}</span>`;
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const bgOf = i => BGS[(+i || 0) % BGS.length] || BGS[0];

  /* ── Storage ─────────────────────────────────────────────────────── */
  function owner() {
    const u = (typeof S !== 'undefined' && S.user) || {};
    return String(u.uid || u.handle || 'local');
  }
  function readAll() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '{}');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) { return {}; }
  }
  /* Only well-formed items survive a read: stored text is shown through
     esc(), and a photo must be a JPEG data URL this module made. */
  function clean(list) {
    return (Array.isArray(list) ? list : []).map(h => {
      if (!h || typeof h !== 'object') return null;
      const frames = (Array.isArray(h.frames) ? h.frames : []).map(f => {
        if (!f || typeof f !== 'object') return null;
        if (f.kind === 'photo' && typeof f.src === 'string' && PHOTO_RE.test(f.src)) return { id: String(f.id || uid()), kind: 'photo', src: f.src, at: +f.at || Date.now() };
        if (f.kind === 'text' && typeof f.text === 'string' && f.text.trim()) return { id: String(f.id || uid()), kind: 'text', text: f.text.slice(0, TEXT_MAX), bg: (+f.bg || 0) % BGS.length, at: +f.at || Date.now() };
        return null;
      }).filter(Boolean).slice(0, MAX_FRAMES);
      if (!frames.length) return null;
      const cover = frames.some(f => f.id === h.cover) ? h.cover : frames[0].id;
      return { id: String(h.id || uid()), title: String(h.title || 'Highlights').slice(0, TITLE_MAX), cover, frames, created: +h.created || Date.now() };
    }).filter(Boolean).slice(0, MAX_HL);
  }
  function list() { return clean(readAll()[owner()]); }
  function write(items) {
    const all = readAll();
    all[owner()] = items;
    try { localStorage.setItem(KEY, JSON.stringify(all)); return true; }
    catch (e) {
      toast('Not enough space on this device for these photos. Remove a few and try again.');
      return false;
    }
  }
  const find = id => list().find(h => h.id === id) || null;

  /* ── The row on the profile ──────────────────────────────────────── */
  function coverHTML(h) {
    const f = h.frames.find(x => x.id === h.cover) || h.frames[0];
    if (f.kind === 'photo') return `<span class="hl-cov"><img src="${esc(f.src)}" alt="" loading="lazy" decoding="async"></span>`;
    return `<span class="hl-cov hl-cov-t" style="background:${bgOf(f.bg)}"><i>${esc(f.text.trim().slice(0, 24))}</i></span>`;
  }

  function paint() {
    const row = $('pg-hl');
    if (!row) return;
    const items = list();
    const full = items.length >= MAX_HL;
    row.innerHTML = `
      <button type="button" class="pg-hl-i hl-new" role="listitem" data-hl="new"${full ? ' disabled title="You have the most highlights allowed"' : ''}>
        <span class="pg-hl-c"><span class="hl-cov hl-cov-new">${ico('add')}</span></span>
        <span class="pg-hl-l">New</span>
      </button>
      ${items.map(h => `
        <button type="button" class="pg-hl-i" role="listitem" data-hl="open" data-id="${esc(h.id)}" aria-label="${esc(h.title)} highlight, ${h.frames.length} ${h.frames.length === 1 ? 'story' : 'stories'}">
          <span class="pg-hl-c">${coverHTML(h)}</span>
          <span class="pg-hl-l">${esc(h.title)}</span>
        </button>`).join('')}
      ${items.length ? '' : `<div class="hl-hint" role="presentation"><b>Story highlights</b><span>Keep your favourite stories on your profile</span></div>`}`;
  }

  /* ── Photos: shrink to story size on the device ──────────────────── */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('type'));
      if (file.size > 25 * 1024 * 1024) return reject(new Error('big'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) throw new Error('empty');
          const k = Math.min(1, 720 / w, 1280 / h);
          const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
          const c = document.createElement('canvas');
          c.width = cw; c.height = ch;
          const g = c.getContext('2d');
          g.fillStyle = '#000';
          g.fillRect(0, 0, cw, ch);
          g.drawImage(img, 0, 0, cw, ch);
          resolve(c.toDataURL('image/jpeg', 0.78));
        } catch (e) { reject(e); }
        finally { URL.revokeObjectURL(url); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  /* ── Editor ──────────────────────────────────────────────────────── */
  let D = null;          // the draft while the editor is open
  let edFrom = null;

  function openEditor(id) {
    if (id && D && D.id === id && $('hl-editor')) return;   // long press and right click both ask
    const h = id ? find(id) : null;
    if (!h && list().length >= MAX_HL) { toast(`You can keep up to ${MAX_HL} highlights.`); return; }
    closeEditor(true);
    edFrom = document.activeElement;
    D = h
      ? { id: h.id, title: h.title, cover: h.cover, frames: h.frames.map(f => ({ ...f })), editing: true, dirty: false, textOpen: false, bg: 0, busy: 0 }
      : { id: '', title: '', cover: '', frames: [], editing: false, dirty: false, textOpen: false, bg: 0, busy: 0 };
    const el = document.createElement('div');
    el.id = 'hl-editor';
    el.className = 'mob-scrim';
    el.innerHTML = `<div class="mob-sheet hl-ed" role="dialog" aria-modal="true" aria-labelledby="hl-ed-t"></div>`;
    el.addEventListener('click', onEditorClick);
    el.addEventListener('input', onEditorInput);
    el.addEventListener('change', onEditorChange);
    document.body.appendChild(el);
    document.addEventListener('keydown', editorKey, true);
    renderEditor();
    requestAnimationFrame(() => {
      el.classList.add('open');
      const f = el.querySelector(D.frames.length ? '#hl-name' : '[data-ed="photo"]');
      if (f) f.focus({ preventScroll: true });
    });
  }

  function editorBody() {
    const n = D.frames.length;
    const cover = D.frames.find(f => f.id === D.cover) || D.frames[0];
    return `
      <div class="hl-ed-h">
        <button type="button" class="icon-btn" data-ed="cancel" aria-label="Close">${ico('close')}</button>
        <b id="hl-ed-t">${D.editing ? 'Edit highlight' : 'New highlight'}</b>
        <button type="button" class="btn btn-primary btn-sm" data-ed="save"${n && !D.busy ? '' : ' disabled'}>${D.editing ? 'Done' : 'Add'}</button>
      </div>
      <div class="hl-ed-body">
        <div class="hl-ed-top">
          <span class="pg-hl-c hl-ed-cov">${cover ? coverHTML({ frames: D.frames, cover: cover.id }) : `<span class="hl-cov hl-cov-new">${ico('auto_stories')}</span>`}</span>
          <label class="hl-ed-name">
            <span>Name</span>
            <input class="input" id="hl-name" type="text" maxlength="${TITLE_MAX}" placeholder="Highlights" value="${esc(D.title)}" autocomplete="off">
            <em id="hl-name-n">${D.title.length}/${TITLE_MAX}</em>
          </label>
        </div>

        <div class="hl-ed-sec">
          <b>Stories <span>${n}/${MAX_FRAMES}</span></b>
          ${n > 1 ? '<em>Tap a story to make it the cover</em>' : ''}
        </div>
        <div class="hl-ed-frames" role="list">
          <button type="button" class="hl-add" data-ed="photo"${n >= MAX_FRAMES ? ' disabled' : ''}>${ico('add_photo_alternate')}<span>Photo</span></button>
          <button type="button" class="hl-add" data-ed="text"${n >= MAX_FRAMES ? ' disabled' : ''} aria-expanded="${D.textOpen}">${ico('text_fields')}<span>Text</span></button>
          ${D.busy ? `<div class="hl-thumb hl-thumb-busy" role="listitem" aria-label="Adding photo">${ico('progress_activity', 'hl-spin')}</div>` : ''}
          ${D.frames.map((f, i) => `
            <div class="hl-thumb${f.id === (cover && cover.id) ? ' is-cover' : ''}" role="listitem">
              <button type="button" class="hl-thumb-b" data-ed="cover" data-i="${i}" aria-label="Story ${i + 1}${f.id === (cover && cover.id) ? ', cover' : ', make cover'}"
                ${f.kind === 'text' ? `style="background:${bgOf(f.bg)}"` : ''}>
                ${f.kind === 'photo' ? `<img src="${esc(f.src)}" alt="">` : `<i>${esc(f.text.slice(0, 40))}</i>`}
              </button>
              ${f.id === (cover && cover.id) ? `<span class="hl-cover-tag">Cover</span>` : ''}
              <button type="button" class="hl-x" data-ed="remove" data-i="${i}" aria-label="Remove story ${i + 1}">${ico('close')}</button>
            </div>`).join('')}
        </div>
        <input type="file" id="hl-file" accept="image/*" multiple hidden>

        ${D.textOpen ? `
          <div class="hl-textform">
            <div class="hl-textprev" style="background:${bgOf(D.bg)}">
              <textarea id="hl-text" maxlength="${TEXT_MAX}" rows="3" placeholder="Type your story…" aria-label="Story text"></textarea>
            </div>
            <div class="hl-swatches" role="radiogroup" aria-label="Background">
              ${BGS.map((b, i) => `<button type="button" role="radio" aria-checked="${i === D.bg}" aria-label="Background ${i + 1}" class="hl-sw${i === D.bg ? ' on' : ''}" data-ed="bg" data-i="${i}" style="background:${b}"></button>`).join('')}
            </div>
            <div class="hl-textform-a">
              <button type="button" class="btn btn-ghost btn-sm" data-ed="text-cancel">Cancel</button>
              <button type="button" class="btn btn-primary btn-sm" data-ed="text-add">Add to highlight</button>
            </div>
          </div>` : ''}

        ${n ? '' : '<p class="hl-ed-note">Add photos from your device or write a text story. Photos stay on this device.</p>'}
        ${D.editing ? `<button type="button" class="hl-del" data-ed="delete">${ico('delete')}Delete highlight</button>` : ''}
      </div>`;
  }

  function renderEditor(focusSel) {
    const box = document.querySelector('#hl-editor .hl-ed');
    if (!box || !D) return;
    const scroller = box.querySelector('.hl-ed-body');
    const top = scroller ? scroller.scrollTop : 0;
    const typed = $('hl-text') ? $('hl-text').value : null;
    box.innerHTML = editorBody();
    const body = box.querySelector('.hl-ed-body');
    if (body) body.scrollTop = top;
    if (typed != null && $('hl-text')) $('hl-text').value = typed;
    if (focusSel) { const f = box.querySelector(focusSel); if (f) f.focus({ preventScroll: true }); }
  }

  function onEditorInput(e) {
    if (e.target.id === 'hl-name') {
      D.title = e.target.value.slice(0, TITLE_MAX);
      D.dirty = true;
      const n = $('hl-name-n');
      if (n) n.textContent = `${D.title.length}/${TITLE_MAX}`;
    }
  }

  async function onEditorChange(e) {
    if (e.target.id !== 'hl-file') return;
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length || !D) return;
    const room = MAX_FRAMES - D.frames.length;
    if (files.length > room) toast(`Only ${room} more ${room === 1 ? 'story fits' : 'stories fit'} in one highlight.`);
    let failed = 0;
    for (const file of files.slice(0, Math.max(0, room))) {
      D.busy++;
      renderEditor();
      try {
        const src = await shrink(file);
        if (!D) return;
        D.frames.push({ id: uid(), kind: 'photo', src, at: Date.now() });
        if (!D.cover) D.cover = D.frames[0].id;
        D.dirty = true;
      } catch (err) { failed++; }
      if (!D) return;
      D.busy--;
      renderEditor();
    }
    if (failed) toast(failed === 1 ? "That photo couldn't be opened. Try a JPG or PNG." : `${failed} photos couldn't be opened. Try JPG or PNG files.`);
  }

  async function onEditorClick(e) {
    const scrim = $('hl-editor');
    if (e.target === scrim) { cancelEditor(); return; }
    const b = e.target.closest('[data-ed]');
    if (!b || b.disabled || !D) return;
    const i = +b.dataset.i;
    switch (b.dataset.ed) {
      case 'cancel': cancelEditor(); return;
      case 'photo': { const f = $('hl-file'); if (f) f.click(); return; }
      case 'text': D.textOpen = !D.textOpen; renderEditor(D.textOpen ? '#hl-text' : '[data-ed="text"]'); return;
      case 'text-cancel': D.textOpen = false; renderEditor('[data-ed="text"]'); return;
      case 'bg': D.bg = i; renderEditor('.hl-sw.on'); return;
      case 'text-add': {
        const t = ($('hl-text') ? $('hl-text').value : '').trim();
        if (!t) { toast('Write something first.'); const x = $('hl-text'); if (x) x.focus(); return; }
        if (D.frames.length >= MAX_FRAMES) return;
        D.frames.push({ id: uid(), kind: 'text', text: t.slice(0, TEXT_MAX), bg: D.bg, at: Date.now() });
        if (!D.cover) D.cover = D.frames[0].id;
        D.textOpen = false; D.dirty = true;
        const ta = $('hl-text'); if (ta) ta.value = '';
        renderEditor('[data-ed="text"]');
        return;
      }
      case 'cover': if (D.frames[i]) { D.cover = D.frames[i].id; D.dirty = true; renderEditor(`[data-ed="cover"][data-i="${i}"]`); } return;
      case 'remove': {
        const f = D.frames[i];
        if (!f) return;
        D.frames.splice(i, 1);
        if (D.cover === f.id) D.cover = D.frames[0] ? D.frames[0].id : '';
        D.dirty = true;
        renderEditor(D.frames.length ? '[data-ed="remove"]' : '[data-ed="photo"]');
        return;
      }
      case 'save': saveDraft(); return;
      case 'delete': {
        const ok = await confirmIt(`“${D.title || 'Highlights'}” and its ${D.frames.length === 1 ? 'story' : 'stories'} will be removed from your profile.`, { title: 'Delete highlight?', ok: 'Delete', danger: true });
        if (!ok || !D) return;
        const id = D.id;
        if (write(list().filter(h => h.id !== id))) { closeEditor(); paint(); toast('Highlight deleted'); }
        return;
      }
    }
  }

  function saveDraft() {
    if (!D || D.busy) return;
    if (!D.frames.length) { toast('Add at least one photo or text story.'); return; }
    const pendingText = $('hl-text') && $('hl-text').value.trim();
    if (D.textOpen && pendingText) { toast('Tap “Add to highlight” to keep your text, or Cancel it.'); return; }
    const items = list();
    const item = {
      id: D.id || uid(),
      title: (D.title.trim() || 'Highlights').slice(0, TITLE_MAX),
      cover: D.frames.some(f => f.id === D.cover) ? D.cover : D.frames[0].id,
      frames: D.frames.slice(0, MAX_FRAMES),
      created: Date.now()
    };
    const at = items.findIndex(h => h.id === item.id);
    if (at > -1) { item.created = items[at].created; items[at] = item; }
    else items.unshift(item);
    if (!write(items)) return;
    const editing = D.editing;
    closeEditor();
    paint();
    toast(editing ? 'Highlight updated' : 'Added to your profile');
    const b = document.querySelector(`#pg-hl [data-id="${CSS.escape(item.id)}"]`);
    if (b) { b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); b.focus({ preventScroll: true }); }
  }

  async function cancelEditor() {
    if (!D) return;
    if (D.busy) return;
    if (D.dirty && D.frames.length) {
      const ok = await confirmIt('Your changes to this highlight will be lost.', { title: 'Discard changes?', ok: 'Discard', danger: true });
      if (!ok) return;
    }
    closeEditor();
  }

  function closeEditor(quiet) {
    const el = $('hl-editor');
    if (el) el.remove();
    document.removeEventListener('keydown', editorKey, true);
    D = null;
    if (!quiet && edFrom && document.contains(edFrom)) { try { edFrom.focus({ preventScroll: true }); } catch (e) {} }
    edFrom = null;
  }

  function editorKey(e) {
    if (document.querySelector('.mob-dialog-scrim')) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (D && D.textOpen) { D.textOpen = false; renderEditor('[data-ed="text"]'); return; }
      cancelEditor();
      return;
    }
    if (e.key !== 'Tab') return;
    const box = document.querySelector('#hl-editor .hl-ed');
    if (!box) return;
    const f = [...box.querySelectorAll('button:not([disabled]), input:not([type="file"]), textarea')];
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === f.length - 1 || i === -1)) { e.preventDefault(); f[0].focus(); }
  }

  function confirmIt(message, o) {
    if (typeof appConfirm === 'function') return appConfirm(message, o);
    return Promise.resolve(window.confirm(message));
  }

  /* ── Player ──────────────────────────────────────────────────────── */
  const P = { h: null, i: 0, t0: 0, done: 0, raf: 0, held: false, menu: false, from: null };

  function ago(t) {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 604800) return Math.floor(s / 86400) + 'd';
    return Math.floor(s / 604800) + 'w';
  }

  function openPlayer(id, at) {
    const h = find(id);
    if (!h) { paint(); return; }
    closePlayer(true);
    P.h = h; P.i = Math.min(Math.max(0, at || 0), h.frames.length - 1); P.done = 0; P.held = false; P.menu = false;
    P.from = document.activeElement;
    const el = document.createElement('div');
    el.id = 'hl-view';
    el.className = 'hl-view';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', `${h.title} highlight`);
    el.innerHTML = `<div class="hl-stage">
      <div class="hl-bars">${h.frames.map((_, i) => `<span class="hl-bar"><i id="hl-bar-${i}"></i></span>`).join('')}</div>
      <div class="hl-head">
        <span class="hl-head-av">${coverHTML(h)}</span>
        <span class="hl-head-t"><b>${esc(h.title)}</b><em id="hl-when"></em></span>
        <button type="button" class="hl-ib" data-pl="menu" aria-label="Highlight options" aria-haspopup="menu" aria-expanded="false">${ico('more_horiz')}</button>
        <button type="button" class="hl-ib" data-pl="close" aria-label="Close">${ico('close')}</button>
      </div>
      <div class="hl-frame" id="hl-frame" aria-live="polite"></div>
      <button type="button" class="hl-tap hl-prev" data-pl="prev" aria-label="Previous story"></button>
      <button type="button" class="hl-tap hl-next" data-pl="next" aria-label="Next story"></button>
      <div class="hl-menu" id="hl-menu" role="menu" hidden>
        <button type="button" role="menuitem" data-pl="edit">${ico('edit')}Edit highlight</button>
        <button type="button" role="menuitem" data-pl="delete" class="danger">${ico('delete')}Delete highlight</button>
      </div>
    </div>`;
    el.addEventListener('click', onPlayerClick);
    el.addEventListener('pointerdown', e => { if (e.target.closest('.hl-tap')) { P.held = true; P.heldAt = Date.now(); } });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => el.addEventListener(t, () => { P.held = false; }));
    el.addEventListener('contextmenu', e => { if (e.target.closest('.hl-tap')) e.preventDefault(); });
    document.body.appendChild(el);
    document.addEventListener('keydown', playerKey, true);
    show(P.i);
    const c = el.querySelector('[data-pl="close"]');
    if (c) c.focus({ preventScroll: true });
    loop();
  }

  function show(i) {
    if (!P.h) return;
    P.i = i; P.done = 0; P.t0 = performance.now();
    const f = P.h.frames[i];
    const box = $('hl-frame');
    if (!box || !f) return;
    box.innerHTML = f.kind === 'photo'
      ? `<div class="hl-ph-bg" style="background-image:url('${esc(f.src)}')"></div><img class="hl-ph" src="${esc(f.src)}" alt="Story ${i + 1} of ${P.h.frames.length}">`
      : `<div class="hl-tx" style="background:${bgOf(f.bg)}"><p>${esc(f.text)}</p></div>`;
    const w = $('hl-when');
    if (w) w.textContent = ago(f.at);
    P.h.frames.forEach((_, k) => { const b = $('hl-bar-' + k); if (b) b.style.transform = `scaleX(${k < i ? 1 : 0})`; });
  }

  function loop() {
    cancelAnimationFrame(P.raf);
    let last = performance.now();
    const step = now => {
      if (!P.h || !$('hl-view')) return;
      const paused = P.held || P.menu || document.hidden || !!document.querySelector('.mob-dialog-scrim');
      if (!paused) P.done += now - last;
      last = now;
      const b = $('hl-bar-' + P.i);
      if (b) b.style.transform = `scaleX(${Math.min(1, P.done / FRAME_MS)})`;
      if (P.done >= FRAME_MS) { next(); if (!P.h) return; }
      P.raf = requestAnimationFrame(step);
    };
    P.raf = requestAnimationFrame(step);
  }

  function next() {
    if (!P.h) return;
    if (P.i < P.h.frames.length - 1) show(P.i + 1);
    else closePlayer();
  }
  function prev() {
    if (!P.h) return;
    show(Math.max(0, P.i - 1));
  }

  function toggleMenu(open) {
    const m = $('hl-menu');
    const b = document.querySelector('#hl-view [data-pl="menu"]');
    if (!m) return;
    P.menu = typeof open === 'boolean' ? open : m.hidden;
    m.hidden = !P.menu;
    if (b) b.setAttribute('aria-expanded', P.menu ? 'true' : 'false');
    if (P.menu) { const f = m.querySelector('button'); if (f) f.focus({ preventScroll: true }); }
    else if (b) b.focus({ preventScroll: true });
  }

  async function onPlayerClick(e) {
    const b = e.target.closest('[data-pl]');
    if (!b) { if (P.menu && !e.target.closest('#hl-menu')) toggleMenu(false); return; }
    // A long hold pauses; letting go shouldn't also skip.
    if (b.dataset.pl === 'next' || b.dataset.pl === 'prev') {
      const wasHold = P.heldAt && Date.now() - P.heldAt > 350;
      P.heldAt = 0;
      if (wasHold) return;
    }
    if (P.menu && b.dataset.pl !== 'edit' && b.dataset.pl !== 'delete' && b.dataset.pl !== 'menu') { toggleMenu(false); return; }
    switch (b.dataset.pl) {
      case 'close': closePlayer(); return;
      case 'next': next(); return;
      case 'prev': prev(); return;
      case 'menu': toggleMenu(); return;
      case 'edit': { const id = P.h.id; closePlayer(true); openEditor(id); return; }
      case 'delete': {
        const h = P.h;
        const ok = await confirmIt(`“${h.title}” and its ${h.frames.length === 1 ? 'story' : 'stories'} will be removed from your profile.`, { title: 'Delete highlight?', ok: 'Delete', danger: true });
        if (!ok) { toggleMenu(false); return; }
        if (write(list().filter(x => x.id !== h.id))) { closePlayer(true); paint(); toast('Highlight deleted'); focusRow(); }
        return;
      }
    }
  }

  function playerKey(e) {
    if (!$('hl-view') || document.querySelector('.mob-dialog-scrim')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (P.menu) toggleMenu(false); else closePlayer(); return; }
    if (P.menu) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); P.held = !P.held; }
    else if (e.key === 'Tab') {
      const f = [...document.querySelectorAll('#hl-view .hl-head button, #hl-view .hl-tap')];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === f.length - 1 || i === -1)) { e.preventDefault(); f[0].focus(); }
    }
  }

  function closePlayer(quiet) {
    cancelAnimationFrame(P.raf);
    const el = $('hl-view');
    if (el) el.remove();
    document.removeEventListener('keydown', playerKey, true);
    const from = P.from;
    P.h = null; P.menu = false; P.held = false; P.from = null;
    if (!quiet && from && document.contains(from)) { try { from.focus({ preventScroll: true }); } catch (e) {} }
  }

  function focusRow() {
    const b = document.querySelector('#pg-hl [data-hl]');
    if (b) b.focus({ preventScroll: true });
  }

  /* ── Wiring: taps and long presses on the row ────────────────────── */
  let pressTimer = null, pressed = false, px0 = 0, py0 = 0;
  document.addEventListener('click', e => {
    const b = e.target.closest('#pg-hl [data-hl]');
    if (!b || b.disabled) return;
    if (pressed) { pressed = false; return; }
    if (b.dataset.hl === 'new') openEditor();
    else openPlayer(b.dataset.id, 0);
  });
  // Long press (or right click) on a highlight edits it, as on Instagram.
  document.addEventListener('contextmenu', e => {
    const b = e.target.closest('#pg-hl [data-hl="open"]');
    if (!b) return;
    e.preventDefault();
    openEditor(b.dataset.id);
  });
  document.addEventListener('pointerdown', e => {
    pressed = false;
    clearTimeout(pressTimer);
    const b = e.target.closest('#pg-hl [data-hl="open"]');
    if (!b || e.pointerType === 'mouse') return;
    px0 = e.clientX; py0 = e.clientY;
    pressTimer = setTimeout(() => { pressed = true; openEditor(b.dataset.id); }, 550);
  });
  // Scrolling the row is not a long press.
  document.addEventListener('pointermove', e => {
    if (Math.abs(e.clientX - px0) + Math.abs(e.clientY - py0) > 8) clearTimeout(pressTimer);
  }, { passive: true });
  ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => clearTimeout(pressTimer), { passive: true }));

  return {
    paint, openEditor, openPlayer, closePlayer, closeEditor, list,
    get count() { return list().length; }
  };
})();

window.HL = HL;

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
publish('features/highlights.js', {
  HL: () => HL
});
