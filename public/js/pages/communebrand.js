/* ╔══════════════════════════════════════════════════════════════════╗
   ║  COMMUNE HUB — create, brand and join                             ║
   ║                                                                   ║
   ║  · Create wizard: basics → look (photo or icon, colour, banner)   ║
   ║    → access & membership → channels, rules & links → review       ║
   ║  · Image cropper for the community photo (1:1) and banner (3:1)   ║
   ║  · Branding editor in Community Studio → Settings                 ║
   ║  · Join screen with the community's banner, rules, age check      ║
   ║    and membership choice, then a checkout step                    ║
   ║  · Your membership: change tier, switch billing, cancel, resume,  ║
   ║    refund, receipts                                               ║
   ║  · Community Studio → Memberships: entry rules, tiers, revenue,   ║
   ║    members-only channels, subscribers                             ║
   ║                                                                   ║
   ║  Checkout is a demonstration. It never shows a card, UPI or       ║
   ║  wallet field, nothing is charged, and it says so on screen.      ║
   ║  Images are resized in the browser and stored on this device.     ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const CCR = (() => {

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const $ = id => document.getElementById(id);
  const ico = n => `<span class="material-symbols-rounded">${n}</span>`;
  const compact = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
    : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(Math.round(n || 0)));
  const date = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const cidNow = () => CMD.state().cid;

  /* ══════════════════════════════════════════════════════════════════
     Look: photo, icon, colour, banner
     ══════════════════════════════════════════════════════════════════ */

  const ICONS = ['groups', 'diversity_3', 'forum', 'hub', 'rocket_launch', 'code', 'terminal', 'memory', 'smart_toy', 'sports_esports',
    'videogame_asset', 'music_note', 'graphic_eq', 'headphones', 'mic', 'podcasts', 'movie', 'movie_edit', 'live_tv', 'photo_camera',
    'palette', 'brush', 'draw', 'auto_awesome', 'school', 'menu_book', 'science', 'biotech', 'psychology', 'lightbulb',
    'public', 'travel_explore', 'language', 'flight', 'sports_soccer', 'sports_basketball', 'sports_cricket', 'fitness_center',
    'self_improvement', 'restaurant', 'local_cafe', 'pets', 'eco', 'park', 'favorite', 'volunteer_activism', 'handshake',
    'workspace_premium', 'verified', 'star', 'bolt', 'local_fire_department', 'diamond', 'token', 'currency_bitcoin',
    'account_balance', 'monitoring', 'candlestick_chart', 'savings', 'storefront', 'shopping_bag', 'work', 'campaign',
    'newspaper', 'home', 'construction', 'shield', 'celebration', 'theater_comedy', 'nightlife', 'cake', 'checkroom'];
  const COLORS = ['#7C5CFF', '#EC6CB9', '#FF6B6B', '#F97316', '#F59E0B', '#22C55E', '#14B8A6', '#0EA5E9', '#3B82F6', '#8B5CF6', '#64748B', '#111827'];

  const okColor = c => /^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? c : '#7C5CFF';
  const okImage = s => typeof s === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s);

  const BANNERS = {
    classic: ['Classic', c => `linear-gradient(135deg, ${c}, ${c}44)`],
    glow:    ['Glow', c => `radial-gradient(120% 160% at 0% 0%, ${c} 0%, transparent 58%), linear-gradient(135deg, #1b1f2a, ${c})`],
    mesh:    ['Mesh', c => `radial-gradient(at 15% 20%, ${c} 0, transparent 50%), radial-gradient(at 85% 10%, #EC6CB9 0, transparent 45%), radial-gradient(at 60% 100%, #38BDF8 0, transparent 50%), #151826`],
    grid:    ['Grid', c => `linear-gradient(rgba(255,255,255,.13) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, rgba(255,255,255,.13) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(135deg, ${c}, #151826)`],
    dots:    ['Dots', c => `radial-gradient(rgba(255,255,255,.28) 1.2px, transparent 1.7px) 0 0 / 16px 16px, linear-gradient(135deg, ${c}, ${c}99)`],
    waves:   ['Waves', c => `repeating-radial-gradient(circle at 100% 100%, transparent 0 18px, rgba(255,255,255,.1) 18px 20px), linear-gradient(135deg, ${c}, #151826)`],
    sunset:  ['Sunset', () => 'linear-gradient(135deg, #FF7A59, #FF3D8B 55%, #7C5CFF)'],
    ocean:   ['Ocean', () => 'linear-gradient(135deg, #00C6FB, #005BEA)'],
    forest:  ['Forest', () => 'linear-gradient(135deg, #0BAB64, #3BB78F)'],
    night:   ['Night', () => 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)']
  };

  function bannerCSS(c) {
    const color = okColor(c && c.color);
    if (c && okImage(c.banner)) return `url('${c.banner}') center / cover no-repeat, ${color}`;
    return (BANNERS[(c && c.bannerPreset) || 'classic'] || BANNERS.classic)[1](color);
  }
  const hasBanner = c => !!(c && (okImage(c.banner) || (c.bannerPreset && c.bannerPreset !== 'classic')));

  /* The community's picture where one exists, its icon otherwise. */
  function icon(c) {
    if (c && okImage(c.avatar)) return `<img class="cc-img" src="${c.avatar}" alt="" draggable="false">`;
    return `<span class="material-symbols-rounded">${esc((c && c.icon) || 'groups')}</span>`;
  }

  /* ── Image processing ────────────────────────────────────────────── */
  function loadImage(file) {
    return new Promise((res, rej) => {
      if (!file || !/^image\/(png|jpe?g|webp|gif|svg\+xml|avif|bmp)$/i.test(file.type)) { rej(new Error('Choose a PNG, JPG, WebP or GIF image.')); return; }
      if (file.size > 15 * 1024 * 1024) { rej(new Error('That image is over 15 MB.')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => res({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file could not be read as an image.')); };
      img.src = url;
    });
  }

  function encode(canvas, maxChars, fill) {
    let q = 0.86;
    let out = canvas.toDataURL('image/webp', q);
    const webp = out.indexOf('data:image/webp') === 0;
    if (!webp) {
      // Browsers without WebP encoding fall back to JPEG, which has no
      // transparency — paint the community colour behind a logo first.
      const c2 = document.createElement('canvas');
      c2.width = canvas.width; c2.height = canvas.height;
      const x = c2.getContext('2d');
      x.fillStyle = fill; x.fillRect(0, 0, c2.width, c2.height); x.drawImage(canvas, 0, 0);
      canvas = c2;
      out = canvas.toDataURL('image/jpeg', q);
    }
    while (out.length > maxChars && q > 0.4) { q -= 0.08; out = canvas.toDataURL(webp ? 'image/webp' : 'image/jpeg', q); }
    return out;
  }

  /* A small pan-and-zoom cropper. It sits above any open dialog and
     resolves with a resized data URL, or null if the user cancels. */
  function crop(file, kind, fill, opts) {
    opts = opts || {};
    const spec = Object.assign(kind === 'banner' ? { aspect: 3, w: 1200, h: 400, max: 360000, title: 'Position your banner' }
      : { aspect: 1, w: 320, h: 320, max: 120000, title: 'Position your community photo' }, opts.spec || {}, opts.title ? { title: opts.title } : {});
    return loadImage(file).then(({ img, url }) => new Promise(resolve => {
      const el = document.createElement('div');
      el.id = 'ccr-crop';
      el.innerHTML = `<div class="ccr-crop-card">
        <header><b>${spec.title}</b><button class="hub-ico" data-x>${ico('close')}</button></header>
        <div class="ccr-crop-frame ${kind}${opts.round ? ' round' : ''}" style="aspect-ratio:${spec.aspect}"><img alt="" draggable="false"></div>
        <div class="ccr-crop-row">${ico('zoom_out')}<input type="range" min="1" max="4" step="0.01" value="1">${ico('zoom_in')}</div>
        <p class="hub-none sm">${opts.hint ? esc(opts.hint) : `Drag to position. ${kind === 'banner' ? 'Shown at 3:1 across the top of your community.' : 'Shown as a rounded square.'}`}</p>
        <div class="hub-acts"><button class="hub-btn" data-x>Cancel</button><button class="hub-btn primary" data-ok>${opts.ok ? esc(opts.ok) : `Use this ${kind === 'banner' ? 'banner' : 'photo'}`}</button></div>
      </div>`;
      document.body.appendChild(el);
      const frame = el.querySelector('.ccr-crop-frame');
      const pic = frame.querySelector('img');
      const range = el.querySelector('input[type=range]');
      pic.src = url;
      let FW = 0, FH = 0, base = 1, zoom = 1, x = 0, y = 0;
      const clamp = () => {
        const s = base * zoom;
        x = Math.min(0, Math.max(FW - img.naturalWidth * s, x));
        y = Math.min(0, Math.max(FH - img.naturalHeight * s, y));
      };
      const draw = () => {
        const s = base * zoom;
        pic.style.width = img.naturalWidth * s + 'px';
        pic.style.height = img.naturalHeight * s + 'px';
        pic.style.transform = `translate(${x}px, ${y}px)`;
      };
      const layout = () => {
        FW = frame.clientWidth; FH = frame.clientHeight;
        base = Math.max(FW / img.naturalWidth, FH / img.naturalHeight);
        const s = base * zoom;
        x = (FW - img.naturalWidth * s) / 2; y = (FH - img.naturalHeight * s) / 2;
        clamp(); draw();
      };
      requestAnimationFrame(layout);
      range.addEventListener('input', () => {
        const old = base * zoom;
        const cx = FW / 2 - x, cy = FH / 2 - y;
        zoom = +range.value;
        const s = base * zoom;
        x = FW / 2 - cx * s / old; y = FH / 2 - cy * s / old;
        clamp(); draw();
      });
      let drag = null;
      frame.addEventListener('pointerdown', e => { drag = { px: e.clientX, py: e.clientY, x, y }; frame.setPointerCapture(e.pointerId); });
      frame.addEventListener('pointermove', e => { if (!drag) return; x = drag.x + e.clientX - drag.px; y = drag.y + e.clientY - drag.py; clamp(); draw(); });
      frame.addEventListener('pointerup', () => { drag = null; });
      frame.addEventListener('wheel', e => { e.preventDefault(); range.value = Math.max(1, Math.min(4, zoom - e.deltaY / 600)); range.dispatchEvent(new Event('input')); }, { passive: false });
      const done = val => { URL.revokeObjectURL(url); el.remove(); resolve(val); };
      el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => done(null)));
      el.addEventListener('click', e => { if (e.target === el) done(null); });
      el.querySelector('[data-ok]').addEventListener('click', () => {
        const s = base * zoom;
        const cv = document.createElement('canvas');
        const sw = FW / s, sh = FH / s;
        cv.width = Math.min(spec.w, Math.max(kind === 'banner' ? 600 : 160, Math.round(sw * 2)));
        cv.height = Math.round(cv.width / spec.aspect);
        cv.getContext('2d').drawImage(img, -x / s, -y / s, sw, sh, 0, 0, cv.width, cv.height);
        done(encode(cv, spec.max, fill || '#7C5CFF'));
      });
    })).catch(err => { toast(err.message); return null; });
  }

  /* ── Shared look editor (wizard step and Studio branding) ────────── */
  const drafts = { w: null, b: null };
  let iconQuery = '';

  function lookHTML(mode) {
    const d = drafts[mode];
    const color = okColor(d.color);
    const icons = ICONS.filter(n => !iconQuery || n.indexOf(iconQuery.toLowerCase().replace(/\s+/g, '_')) > -1);
    return `
      <div class="ccr-look">
        <section>
          <h4 class="hub-h4">Community photo or icon</h4>
          <div class="ccr-avrow">
            <span class="ccr-av" style="--c:${color}">${icon(d)}</span>
            <div class="ccr-avact">
              <label class="hub-btn sm primary">${ico('add_photo_alternate')}${okImage(d.avatar) ? 'Change photo' : 'Upload photo'}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onchange="CCR.pickImage('${mode}','avatar',this)"></label>
              ${okImage(d.avatar) ? `<button class="hub-btn sm" onclick="CCR.look('${mode}','avatar','')">${ico('delete')}Use an icon instead</button>` : ''}
              <span class="hub-none sm">Square works best. PNG logos keep their transparency.</span>
            </div>
          </div>
          ${okImage(d.avatar) ? '' : `
          <label class="hub-find sm ccr-isearch">${ico('search')}<input placeholder="Search icons — music, code, school…" value="${esc(iconQuery)}" oninput="CCR.iconSearch('${mode}',this.value)"></label>
          <div class="ccr-icons" id="ccr-icons-${mode}">${icons.map(n => `<button class="ccr-ic${d.icon === n ? ' on' : ''}" style="--c:${color}" title="${n.replace(/_/g, ' ')}" onclick="CCR.look('${mode}','icon','${n}')">${ico(n)}</button>`).join('') || '<p class="hub-none sm">No icon matches.</p>'}</div>`}
        </section>

        <section>
          <h4 class="hub-h4">Accent colour</h4>
          <div class="ccr-swatches">
            ${COLORS.map(c => `<button class="ccr-sw${color.toLowerCase() === c.toLowerCase() ? ' on' : ''}" style="background:${c}" title="${c}" onclick="CCR.look('${mode}','color','${c}')"></button>`).join('')}
            <label class="ccr-sw custom" title="Custom colour" style="background:${color}">${ico('colorize')}<input type="color" value="${color}" onchange="CCR.look('${mode}','color',this.value)"></label>
          </div>
        </section>

        <section>
          <h4 class="hub-h4">Banner</h4>
          <div class="ccr-banrow">
            <label class="hub-btn sm primary">${ico('wallpaper')}${okImage(d.banner) ? 'Change banner image' : 'Upload banner image'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onchange="CCR.pickImage('${mode}','banner',this)"></label>
            ${okImage(d.banner) ? `<button class="hub-btn sm" onclick="CCR.look('${mode}','banner','')">${ico('delete')}Remove image</button>` : ''}
            <span class="hub-none sm">1200 × 400 or wider. Or pick a style:</span>
          </div>
          <div class="ccr-presets">${Object.keys(BANNERS).map(k => `<button class="ccr-preset${!okImage(d.banner) && (d.bannerPreset || 'classic') === k ? ' on' : ''}"
            style="background:${BANNERS[k][1](color)}" onclick="CCR.look('${mode}','bannerPreset','${k}')"><span>${BANNERS[k][0]}</span></button>`).join('')}</div>
        </section>
      </div>`;
  }

  function previewHTML(d) {
    const c = { ...d, color: okColor(d.color), name: d.name || 'Your community', handle: d.handle ? '@' + d.handle : '@yourcommunity' };
    const cat = (CMD.CATEGORIES.find(x => x[0] === d.category) || ['', 'Community'])[1];
    const paid = d.entryMode === 'paid' && (d.tiers || []).some(t => +t.price > 0);
    const from = paid ? Math.min(...d.tiers.filter(t => +t.price > 0).map(t => +t.price)) : 0;
    return `
      <div class="ccr-prev">
        <span class="hub-none sm">How it appears in Discover</span>
        <article class="hub-card ccr-prevcard">
          <div class="hub-card-banner" style="background:${bannerCSS(c)}">
            <span class="hub-card-cat">${esc(cat)}</span>
            ${paid ? `<span class="ccr-cbadge">${ico('lock')}Members · from ${CMB.fmt(from, d.currency)}/mo</span>` : ''}
          </div>
          <div class="hub-card-body">
            <div class="hub-card-icon" style="--c:${c.color}">${icon(c)}</div>
            <div class="hub-card-name">${esc(c.name)}</div>
            <div class="hub-card-handle">${esc(c.handle)}</div>
            <p class="hub-card-desc">${esc(d.tagline || d.desc || 'A one-line description tells people whether they belong here.')}</p>
            <div class="hub-card-foot">${String(d.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 2).map(t => `<span class="hub-chip-s">${esc(t)}</span>`).join('')}
              <button class="hub-btn primary sm" disabled>Join</button></div>
          </div>
        </article>
      </div>`;
  }

  function look(mode, key, val) {
    const d = drafts[mode];
    if (!d) return;
    if (key === 'color') val = okColor(val);
    if (key === 'bannerPreset') d.banner = '';
    d[key] = val;
    if (key === 'icon') d.avatar = '';
    d.dirty = true;
    paintLook(mode);
  }
  function iconSearch(mode, q) {
    iconQuery = q;
    const box = $('ccr-icons-' + mode);
    const d = drafts[mode];
    if (!box || !d) return;
    const color = okColor(d.color);
    const icons = ICONS.filter(n => !q || n.indexOf(q.toLowerCase().trim().replace(/\s+/g, '_')) > -1);
    box.innerHTML = icons.map(n => `<button class="ccr-ic${d.icon === n ? ' on' : ''}" style="--c:${color}" title="${n.replace(/_/g, ' ')}" onclick="CCR.look('${mode}','icon','${n}')">${ico(n)}</button>`).join('') || '<p class="hub-none sm">No icon matches.</p>';
  }
  async function pickImage(mode, key, input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file || !drafts[mode]) return;
    const data = await crop(file, key === 'banner' ? 'banner' : 'avatar', okColor(drafts[mode].color));
    if (!data) return;
    drafts[mode][key] = data;
    drafts[mode].dirty = true;
    paintLook(mode);
  }
  /* The first wizard step shows the photo and banner up front, so
     nobody has to find them on the Look step. */
  function idHeadHTML(mode) {
    const d = drafts[mode];
    const c = { ...d, color: okColor(d.color) };
    return `
      <div class="ccr-idban" style="background:${bannerCSS(c)}">
        <label class="ccr-idbtn">${ico('wallpaper')}${okImage(d.banner) ? 'Change banner' : 'Add banner'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onchange="CCR.pickImage('${mode}','banner',this)"></label>
      </div>
      <div class="ccr-idrow">
        <span class="ccr-idav" style="--c:${c.color}">${icon(c)}
          <label class="ccr-idcam" title="${okImage(d.avatar) ? 'Change' : 'Add'} community photo">${ico('photo_camera')}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onchange="CCR.pickImage('${mode}','avatar',this)"></label></span>
        <div><b>Community photo and banner</b>
          <span>${okImage(d.avatar) || okImage(d.banner) ? 'Looking good. Icons, colours and banner styles are on the next step.' : 'Upload your own photo and banner — or pick an icon and a style on the next step.'}</span></div>
      </div>`;
  }

  function paintLook(mode) {
    const box = $('ccr-' + mode + 'look');
    const idHead = $('ccr-' + mode + 'id');
    if (idHead) idHead.innerHTML = idHeadHTML(mode);
    const prev = $('ccr-' + mode + 'prev');
    const y = box ? box.closest('.hub-dialog, .cst-main') : null;
    const top = y ? y.scrollTop : 0;
    if (box) box.innerHTML = lookHTML(mode);
    if (prev) prev.innerHTML = previewHTML(drafts[mode]);
    if (y) y.scrollTop = top;
  }

  /* ══════════════════════════════════════════════════════════════════
     Create wizard
     ══════════════════════════════════════════════════════════════════ */

  const DEFAULT_RULES = ['Be useful and be civil — disagree with the argument, not the person.', 'No spam, scams or referral dumps.',
    'Never post or ask for seed phrases, passwords or private keys.', 'Keep channels on topic; long tangents go in a thread.', 'Moderators act on reports. Ban evasion is permanent.'];
  const LANGUAGES = ['English', 'Hindi', 'Malayalam', 'Tamil', 'Bengali', 'Spanish', 'Portuguese', 'French', 'German', 'Arabic', 'Japanese', 'Indonesian', 'Multilingual'];
  const LINKS = [['website', 'Website', 'language'], ['x', 'X / Twitter', 'alternate_email'], ['youtube', 'YouTube', 'smart_display'],
    ['instagram', 'Instagram', 'photo_camera'], ['discord', 'Discord or Telegram', 'forum']];

  const ch = (id, name, kind, space, topic, extra) => ({ id, name, kind, space, topic, ...(extra || {}) });
  const TEMPLATES = {
    standard: ['Standard', 'Welcome, community, support, voice and boards — shaped by your category.', null],
    minimal:  ['Minimal', 'Just the essentials. Add more later.', () => [
      ch('rules', 'rules', 'text', 'Welcome', 'Read this before posting.', { locked: true }), ch('announce', 'announcements', 'announce', 'Welcome', 'News from the team.'),
      ch('general', 'general', 'text', 'Community', 'Everything and anything.'), ch('lounge', 'Lounge', 'voice', 'Voice', 'Drop in and talk.')]],
    creator:  ['Creator', 'Showcase, feedback, collabs and a members-only behind-the-scenes space.', () => [
      ch('rules', 'rules', 'text', 'Welcome', 'Read this before posting.', { locked: true }), ch('announce', 'announcements', 'announce', 'Welcome', 'Drops and news.'),
      ch('general', 'general', 'text', 'Community', 'Hang out.'), ch('intros', 'introductions', 'text', 'Community', 'Say hello.'),
      ch('showcase', 'showcase', 'text', 'Create', 'Post what you made.'), ch('feedback', 'feedback', 'forum', 'Create', 'Honest critique.'),
      ch('collabs', 'collabs', 'text', 'Create', 'Find someone to make it with.'),
      ch('bts', 'behind-the-scenes', 'text', 'Members', 'Early cuts and process — for members.', { private: true, role: 'subscriber' }),
      ch('lounge', 'Lounge', 'voice', 'Voice', 'Drop in.'), ch('live', 'Creator Live', 'live', 'Voice', 'Streams and premieres.')]],
    study:    ['Study group', 'Resources, homework help, a study room and office hours.', () => [
      ch('rules', 'rules', 'text', 'Welcome', 'Read this before posting.', { locked: true }), ch('announce', 'announcements', 'announce', 'Welcome', 'Schedule and news.'),
      ch('general', 'general', 'text', 'Community', 'Chat.'), ch('intros', 'introductions', 'text', 'Community', 'Who are you and what are you learning?'),
      ch('resources', 'resources', 'text', 'Learn', 'Notes, links and books.'), ch('help', 'homework-help', 'forum', 'Learn', 'Ask a proper question.'),
      ch('wins', 'wins', 'text', 'Learn', 'Finished something? Post it.'), ch('studyroom', 'Study Room', 'voice', 'Voice', 'Cameras off, work along.'),
      ch('office', 'Office Hours', 'stage', 'Voice', 'Weekly Q&A.')]],
    gaming:   ['Gaming', 'Clips, squads, patch notes, voice for squads and a tournament stage.', () => [
      ch('rules', 'rules', 'text', 'Welcome', 'Read this before posting.', { locked: true }), ch('announce', 'announcements', 'announce', 'Welcome', 'Events and news.'),
      ch('general', 'general', 'text', 'Community', 'Hang out.'), ch('clips', 'clips', 'text', 'Play', 'Your best 20 seconds.'),
      ch('lfg', 'looking-for-group', 'text', 'Play', 'Find a squad.'), ch('patch', 'patch-notes', 'forum', 'Play', 'What changed.'),
      ch('squad1', 'Squad 1', 'voice', 'Voice', 'Four seats.'), ch('squad2', 'Squad 2', 'voice', 'Voice', 'Four seats.'),
      ch('arena', 'Tournament Stage', 'stage', 'Voice', 'Casters on stage.'), ch('live', 'Watch Party', 'live', 'Voice', 'Streams together.')]],
    web3:     ['Web3 project', 'Research, dev, governance, support and a wallet-holders space.', () => [
      ch('rules', 'rules', 'text', 'Welcome', 'Read this before posting. Nobody here will ever ask for your seed phrase.', { locked: true }),
      ch('announce', 'announcements', 'announce', 'Welcome', 'Official news only.'), ch('general', 'general', 'text', 'Community', 'Chat.'),
      ch('research', 'research', 'text', 'Build', 'Long form, sources attached.'), ch('dev', 'dev', 'text', 'Build', 'Code, deploys, post-mortems.'),
      ch('proposals', 'proposal-discussion', 'forum', 'Build', 'Talk it through before it goes to a vote.'), ch('support', 'help', 'text', 'Support', 'Moderators never DM first.'),
      ch('holders', 'wallet-holders', 'text', 'Members', 'For members with a connected wallet.', typeof CPM !== 'undefined' ? { gate: { type: 'wallet' } } : { private: true, role: 'contributor' }),
      ch('townhall', 'Town Hall', 'stage', 'Voice', 'Monthly call.')]]
  };

  const WSTEPS = ['Basics', 'Look', 'Access & membership', 'Channels & rules', 'Review'];
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);

  function openCreate() {
    drafts.w = {
      step: 0, name: '', handle: '', handleTouched: false, tagline: '', desc: '', category: 'tech', tags: '', language: 'English',
      avatar: '', icon: 'groups', color: '#7C5CFF', banner: '', bannerPreset: 'glow',
      privacy: 'public', listed: true, age: 'all',
      entryMode: 'free', offerTiers: true, currency: 'USD', trialDays: 0, yearlyDiscount: 17,
      tiers: [{ name: 'Supporter', price: 4.99, perks: 'Supporter badge, Members-only channels, Early access' },
              { name: 'Inner Circle', price: 14.99, perks: 'Everything in Supporter, Monthly private call, Name in credits' }],
      template: 'standard', rules: DEFAULT_RULES.join('\n'), welcome: 'Welcome! Read #rules, say hello in #general, and pick your interests.',
      links: {}
    };
    iconQuery = '';
    HUB.modal('Create a community', '<div id="ccr-wiz"></div>', true);
    const dlg = document.querySelector('#hub-modal .hub-dialog');
    if (dlg) dlg.classList.add('ccr-wide');
    paintWizard();
  }

  function paintWizard() {
    const box = $('ccr-wiz');
    const d = drafts.w;
    if (!box || !d) return;
    const bodies = [basicsHTML, lookStepHTML, accessHTML, setupHTML, reviewHTML];
    box.innerHTML = `
      <ol class="ccr-steps">${WSTEPS.map((s, i) => `<li class="${i === d.step ? 'on' : i < d.step ? 'done' : ''}">
        <button onclick="CCR.goStep(${i})" ${i > d.step ? 'disabled' : ''}><i>${i < d.step ? ico('check') : i + 1}</i><span>${s}</span></button></li>`).join('')}</ol>
      <div class="ccr-wbody">${bodies[d.step]()}</div>
      <footer class="ccr-wfoot">
        ${d.step ? `<button class="hub-btn" onclick="CCR.goStep(${d.step - 1})">${ico('arrow_back')}Back</button>` : '<span></span>'}
        ${d.step < WSTEPS.length - 1 ? `<button class="hub-btn primary" onclick="CCR.next()">Next · ${WSTEPS[d.step + 1]}${ico('arrow_forward')}</button>`
          : `<button class="hub-btn primary" onclick="CCR.submitCreate()">${ico('rocket_launch')}Create community</button>`}
      </footer>`;
    const dlg = box.closest('.hub-dialog');
    if (dlg) dlg.scrollTop = 0;
  }

  const field = (key, label, input) => `<label class="hub-f"><span>${label}</span>${input}</label>`;
  const val = k => esc(drafts.w[k] == null ? '' : drafts.w[k]);

  function basicsHTML() {
    const d = drafts.w;
    return `
      <div class="ccr-split">
        <div>
          <div class="ccr-idhead" id="ccr-wid">${idHeadHTML('w')}</div>
          ${field('name', 'Name', `<input id="ccr-name" maxlength="40" value="${val('name')}" placeholder="What is it called?" oninput="CCR.w('name',this.value)">`)}
          <label class="hub-f"><span>Handle</span><div class="ccr-handle"><i>@</i><input id="ccr-handle" maxlength="20" value="${val('handle')}" placeholder="yourcommunity" oninput="CCR.w('handle',this.value)"></div>
            <em class="ccr-hint" id="ccr-handle-hint">${handleHint()}</em></label>
          ${field('tagline', 'Tagline', `<input maxlength="80" value="${val('tagline')}" placeholder="One line that tells people whether they belong" oninput="CCR.w('tagline',this.value)">`)}
          ${field('desc', 'About', `<textarea rows="4" maxlength="600" placeholder="Who it is for, what happens here, what makes it different." oninput="CCR.w('desc',this.value)">${val('desc')}</textarea>`)}
          <div class="hub-form-row">
            ${field('category', 'Category', `<select onchange="CCR.w('category',this.value)">${CMD.CATEGORIES.filter(c => c[0] !== 'all').map(c => `<option value="${c[0]}"${d.category === c[0] ? ' selected' : ''}>${c[1]}</option>`).join('')}</select>`)}
            ${field('language', 'Main language', `<select onchange="CCR.w('language',this.value)">${LANGUAGES.map(l => `<option${d.language === l ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}
          </div>
          ${field('tags', 'Tags', `<input value="${val('tags')}" placeholder="design, beginners, weekly calls" oninput="CCR.w('tags',this.value)">`)}
        </div>
        <div id="ccr-wprev">${previewHTML(d)}</div>
      </div>`;
  }

  function handleHint() {
    const h = slug(drafts.w.handle);
    if (!h) return 'Letters, numbers and underscores.';
    if (h.length < 3) return 'At least 3 characters.';
    if (CMD.all().some(c => String(c.handle || '').toLowerCase() === '@' + h)) return `<b class="bad">@${esc(h)} is taken</b>`;
    return `<b class="good">@${esc(h)} is available</b>`;
  }

  function w(key, value) {
    const d = drafts.w;
    if (!d) return;
    if (key === 'handle') { d.handleTouched = true; d.handle = slug(value); const i = $('ccr-handle'); if (i && i.value !== d.handle) i.value = d.handle; }
    else d[key] = value;
    if (key === 'name' && !d.handleTouched) { d.handle = slug(value); const i = $('ccr-handle'); if (i) i.value = d.handle; }
    const hint = $('ccr-handle-hint');
    if (hint) hint.innerHTML = handleHint();
    const prev = $('ccr-wprev');
    if (prev) prev.innerHTML = previewHTML(d);
  }
  function wset(key, value) { drafts.w[key] = value; paintWizard(); }

  function lookStepHTML() {
    return `<div class="ccr-split"><div id="ccr-wlook">${lookHTML('w')}</div><div id="ccr-wprev">${previewHTML(drafts.w)}</div></div>`;
  }

  function accessHTML() {
    const d = drafts.w;
    const radio = (key, v, l, s, i) => `<button class="hub-radio${d[key] === v ? ' on' : ''}" onclick="CCR.wset('${key}','${v}')">${ico(i)}<b>${l}</b><span>${s}</span></button>`;
    return `
      <div class="ccr-cols2">
        <section>
          <h4 class="hub-h4">Who can find and join</h4>
          <div class="hub-radios">
            ${radio('privacy', 'public', 'Public', 'Anyone can find it in Discover and join.', 'public')}
            ${radio('privacy', 'invite', 'Invite only', 'Visible, but joining needs an invite link.', 'mail')}
            ${radio('privacy', 'private', 'Private', 'Hidden from Discover. Invite links only.', 'lock')}
          </div>
          ${d.privacy === 'public' ? `<label class="hub-check cpx-mt"><input type="checkbox" ${d.listed ? 'checked' : ''} onchange="CCR.w('listed',this.checked)"> List in Discover, Trending and categories</label>` : ''}
          <h4 class="hub-h4">Age</h4>
          <div class="hub-chips">${[['all', 'All ages'], ['13', '13+'], ['18', '18+ only']].map(([k, l]) => `<button class="hub-chip${d.age === k ? ' on' : ''}" onclick="CCR.wset('age','${k}')">${l}</button>`).join('')}</div>
          <p class="hub-none sm">Members confirm their age when they join. 18+ communities are hidden from younger accounts in a live build.</p>
        </section>

        <section>
          <h4 class="hub-h4">Joining</h4>
          <div class="hub-radios">
            ${radio('entryMode', 'free', 'Free to join', 'Paid memberships are optional extras.', 'lock_open')}
            ${radio('entryMode', 'paid', 'Membership required', 'People pick a paid tier to join.', 'workspace_premium')}
          </div>
          ${d.entryMode === 'free' ? `<label class="hub-check cpx-mt"><input type="checkbox" ${d.offerTiers ? 'checked' : ''} onchange="CCR.wset('offerTiers',this.checked)"> Offer optional paid memberships</label>` : ''}
        </section>
      </div>

      ${d.entryMode === 'paid' || d.offerTiers ? `
      <section class="ccr-tiersed">
        <h4 class="hub-h4">Membership tiers</h4>
        ${d.tiers.map((t, i) => `<div class="ccr-trow">
          <input class="ccr-tname" value="${esc(t.name)}" placeholder="Tier name" oninput="CCR.tier(${i},'name',this.value)">
          <label class="ccr-tprice"><i>${CMB.CURRENCIES[d.currency].symbol}</i><input type="number" min="0.5" step="0.5" value="${t.price}" oninput="CCR.tier(${i},'price',this.value)"><em>/mo</em></label>
          <input class="ccr-tperks" value="${esc(t.perks)}" placeholder="Perks, comma separated" oninput="CCR.tier(${i},'perks',this.value)">
          ${d.tiers.length > 1 ? `<button class="hub-act danger" onclick="CCR.tierDel(${i})">${ico('delete')}</button>` : ''}
        </div>`).join('')}
        ${d.tiers.length < 4 ? `<button class="hub-btn sm" onclick="CCR.tierAdd()">${ico('add')}Add a tier</button>` : ''}
        <div class="hub-form-row cpx-mt">
          <label class="hub-f"><span>Currency</span><select onchange="CCR.wset('currency',this.value)">${Object.keys(CMB.CURRENCIES).map(k => `<option${d.currency === k ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
          <label class="hub-f"><span>Free trial</span><select onchange="CCR.wset('trialDays',+this.value)">${[0, 3, 7, 14, 30].map(n => `<option value="${n}"${+d.trialDays === n ? ' selected' : ''}>${n ? n + ' days' : 'No trial'}</option>`).join('')}</select></label>
          <label class="hub-f"><span>Yearly discount</span><select onchange="CCR.wset('yearlyDiscount',+this.value)">${[0, 10, 17, 20, 25, 30].map(n => `<option value="${n}"${+d.yearlyDiscount === n ? ' selected' : ''}>${n ? n + '% off' : 'None'}</option>`).join('')}</select></label>
        </div>
        <p class="hub-none sm">Every paid tier grants the Subscriber role, which opens members-only channels. Checkout in this build is simulated — nothing is charged and no payment details are collected. Real payouts need a payment processor connected on a server.</p>
      </section>` : ''}`;
  }
  function tier(i, key, v) { const t = drafts.w.tiers[i]; if (!t) return; t[key] = key === 'price' ? Math.max(0, +v || 0) : v; const prev = $('ccr-wprev'); if (prev) prev.innerHTML = previewHTML(drafts.w); }
  function tierAdd() { drafts.w.tiers.push({ name: 'New tier', price: 9.99, perks: '' }); paintWizard(); }
  function tierDel(i) { drafts.w.tiers.splice(i, 1); paintWizard(); }

  function setupHTML() {
    const d = drafts.w;
    const list = TEMPLATES[d.template][2] ? TEMPLATES[d.template][2]() : null;
    return `
      <h4 class="hub-h4">Channels</h4>
      <div class="ccr-templates">${Object.keys(TEMPLATES).map(k => `<button class="ccr-tpl${d.template === k ? ' on' : ''}" onclick="CCR.wset('template','${k}')">
        <b>${TEMPLATES[k][0]}</b><span>${TEMPLATES[k][1]}</span></button>`).join('')}</div>
      <div class="ccr-chanprev">${list ? list.map(c => `<span class="hub-chip-s">${ico(c.kind === 'voice' ? 'volume_up' : c.kind === 'stage' ? 'podium' : c.kind === 'live' ? 'screen_share' : c.kind === 'forum' ? 'forum' : c.kind === 'announce' ? 'campaign' : c.private || c.gate ? 'lock' : 'tag')}${esc(c.name)}</span>`).join('')
        : '<span class="hub-none sm">Welcome, community, support, voice and discussion channels, plus focus channels for your category.</span>'}</div>

      <div class="ccr-cols2 cpx-mt">
        <section>
          ${field('rules', 'Rules — one per line', `<textarea rows="6" oninput="CCR.w('rules',this.value)">${val('rules')}</textarea>`)}
          ${field('welcome', 'Welcome message — posted when someone joins', `<textarea rows="3" maxlength="300" oninput="CCR.w('welcome',this.value)">${val('welcome')}</textarea>`)}
        </section>
        <section>
          <h4 class="hub-h4">Links</h4>
          ${LINKS.map(([k, l, i]) => `<label class="ccr-link">${ico(i)}<input type="url" placeholder="https:// — ${l}" value="${esc(d.links[k] || '')}" oninput="CCR.link('${k}',this.value)"></label>`).join('')}
          <p class="hub-none sm">Links open in a new tab and only accept https addresses.</p>
        </section>
      </div>`;
  }
  function link(k, v) { drafts.w.links[k] = v.trim(); }

  function reviewHTML() {
    const d = drafts.w;
    const paidRows = (d.entryMode === 'paid' || d.offerTiers) ? d.tiers.filter(t => +t.price > 0) : [];
    const rows = [
      ['Name', `${esc(d.name || '—')} · @${esc(slug(d.handle) || '—')}`],
      ['Category', esc((CMD.CATEGORIES.find(c => c[0] === d.category) || ['', d.category])[1]) + ' · ' + esc(d.language)],
      ['Privacy', { public: 'Public', invite: 'Invite only', private: 'Private' }[d.privacy] + (d.privacy === 'public' && !d.listed ? ' · not listed' : '') + ' · ' + { all: 'All ages', 13: '13+', 18: '18+ only' }[d.age]],
      ['Joining', d.entryMode === 'paid' ? 'Membership required' : 'Free to join'],
      ['Memberships', paidRows.length ? paidRows.map(t => `${esc(t.name)} ${CMB.fmt(+t.price, d.currency)}/mo`).join(' · ') + (d.trialDays ? ` · ${d.trialDays}-day trial` : '') : 'None'],
      ['Channels', TEMPLATES[d.template][0]],
      ['Rules', String(d.rules).split('\n').filter(x => x.trim()).length + ' rules'],
      ['Links', Object.values(d.links).filter(Boolean).length || 'None']
    ];
    const problems = validate();
    return `
      <div class="ccr-split">
        <div>
          <div class="ccr-review">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
          ${problems.length ? `<div class="ccr-problems">${problems.map(p => `<p>${ico('error')}${esc(p)}</p>`).join('')}</div>`
            : `<p class="hub-none sm cpx-mt">${ico('check_circle')} Ready. You become the owner, with every channel, role and Studio tool unlocked — and you can change all of this later in Community Studio.</p>`}
        </div>
        <div id="ccr-wprev">${previewHTML(d)}</div>
      </div>`;
  }

  function validate() {
    const d = drafts.w;
    const out = [];
    if (!String(d.name).trim()) out.push('Give the community a name.');
    const h = slug(d.handle);
    if (h.length < 3) out.push('The handle needs at least 3 characters.');
    else if (CMD.all().some(c => String(c.handle || '').toLowerCase() === '@' + h)) out.push(`@${h} is already taken.`);
    if (d.entryMode === 'paid' && !d.tiers.some(t => String(t.name).trim() && +t.price > 0)) out.push('A membership-required community needs at least one priced tier.');
    Object.keys(d.links).forEach(k => { if (d.links[k] && !/^https:\/\/[^\s]+\.[^\s]+/i.test(d.links[k])) out.push(`The ${k} link must start with https://`); });
    const text = [d.name, d.tagline, d.desc, d.welcome].join(' ');
    if (typeof CPM !== 'undefined') { const scan = CPM.aiScan(text); if (scan.score >= 60) out.push('The AI Moderator flagged the description: ' + scan.flags.map(f => f.label).join(', ')); }
    return out;
  }

  function goStep(i) { drafts.w.step = Math.max(0, Math.min(WSTEPS.length - 1, i)); paintWizard(); }
  function next() {
    const d = drafts.w;
    if (d.step === 0) {
      if (!String(d.name).trim()) { toast('Give it a name first.'); const i = $('ccr-name'); if (i) i.focus(); return; }
      const h = slug(d.handle);
      if (h.length < 3 || CMD.all().some(c => String(c.handle || '').toLowerCase() === '@' + h)) { toast('Pick an available handle.'); return; }
    }
    if (d.step === 2 && d.entryMode === 'paid' && !d.tiers.some(t => +t.price > 0)) { toast('Add a priced tier.'); return; }
    goStep(d.step + 1);
  }

  function submitCreate() {
    const d = drafts.w;
    const problems = validate();
    if (problems.length) { toast(problems[0]); return; }
    const c = CMD.create({ name: d.name.trim(), desc: (d.desc || d.tagline).trim(), category: d.category, privacy: d.privacy, icon: d.icon, color: okColor(d.color), tags: d.tags });
    const links = {};
    Object.keys(d.links).forEach(k => { if (d.links[k]) links[k] = d.links[k]; });
    CMD.updateCommunity(c.id, {
      handle: '@' + slug(d.handle), tagline: d.tagline.trim(), avatar: okImage(d.avatar) ? d.avatar : '', banner: okImage(d.banner) ? d.banner : '',
      bannerPreset: d.bannerPreset, listed: d.privacy === 'public' ? !!d.listed : false, age: d.age, language: d.language,
      rules: String(d.rules).split('\n').map(x => x.trim()).filter(Boolean).slice(0, 15), welcome: d.welcome.trim(), links, template: d.template
    });
    if (TEMPLATES[d.template][2]) CMD.saveChannels(c.id, TEMPLATES[d.template][2]());
    const paid = (d.entryMode === 'paid' || d.offerTiers) ? d.tiers.filter(t => String(t.name).trim() && +t.price > 0) : [];
    CMD.saveTiers(c.id, [{ id: 'free', name: 'Member', price: 0, perks: ['All public channels', 'Events and discussions', 'Community roles'] }]
      .concat(paid.map((t, i) => ({ id: 't' + i + Date.now().toString(36), name: t.name.trim(), price: Math.round(+t.price * 100) / 100, role: 'subscriber', highlight: i === paid.length - 1 && paid.length > 1,
        perks: String(t.perks || '').split(',').map(x => x.trim()).filter(Boolean) }))));
    const e = CMB.setEntry(c.id, { mode: d.entryMode === 'paid' && paid.length ? 'paid' : 'free', trialDays: d.trialDays, yearlyDiscount: d.yearlyDiscount, currency: d.currency });
    if (e && e.error) toast(e.error);
    if (d.welcome.trim()) CMD.post(c.id, 'announce', d.welcome.trim());
    const stored = persisted(c.id);
    HUB.closeModal();
    drafts.w = null;
    HUB.open(c.id);
    toast(stored ? `${c.name} is live — invite the first members` : `${c.name} is live, but the images were too large to keep on this device, so they were removed.`);
  }

  /* localStorage has a quota. If the images pushed the save over it,
     drop them rather than lose the community itself. */
  function persisted(cid) {
    try {
      if ((localStorage.getItem('ts_commune') || '').indexOf(cid) > -1) return true;
      CMD.updateCommunity(cid, { avatar: '', banner: '' });
      return false;
    } catch (e) { return false; }
  }

  /* ══════════════════════════════════════════════════════════════════
     Branding in Community Studio → Settings
     ══════════════════════════════════════════════════════════════════ */

  function brandingPanel(cid) {
    const c = CMD.byId(cid);
    if (!c) return '';
    const may = CMD.can(cid, 'manage');
    if (!drafts.b || drafts.b.cid !== cid || !drafts.b.dirty) {
      drafts.b = { cid, name: c.name, handle: String(c.handle || '').replace('@', ''), tagline: c.tagline || '', desc: c.desc, category: c.category, tags: (c.tags || []).join(', '),
        avatar: c.avatar || '', icon: c.icon, color: okColor(c.color), banner: c.banner || '', bannerPreset: c.bannerPreset || 'classic', entryMode: CMB.entry(cid).mode,
        currency: CMB.entry(cid).currency, tiers: CMD.tiers(cid), rules: (c.rules || DEFAULT_RULES).join('\n'), welcome: c.welcome || '', links: { ...(c.links || {}) },
        language: c.language || 'English', age: c.age || 'all', listed: c.listed !== false };
    }
    const d = drafts.b;
    return `
      <section class="cst-panel">
        <h3>${ico('palette')}Branding</h3>
        ${may ? '' : '<p class="hub-none">Changing the look needs the manage permission.</p>'}
        <div class="ccr-split${may ? '' : ' ccr-disabled'}">
          <div id="ccr-blook">${lookHTML('b')}</div>
          <div id="ccr-bprev">${previewHTML(d)}</div>
        </div>
        <div class="hub-form-row cpx-mt">
          <label class="hub-f"><span>Tagline</span><input maxlength="80" value="${esc(d.tagline)}" oninput="CCR.b('tagline',this.value)" ${may ? '' : 'disabled'}></label>
          <label class="hub-f"><span>Main language</span><select onchange="CCR.b('language',this.value)" ${may ? '' : 'disabled'}>${LANGUAGES.map(l => `<option${d.language === l ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="hub-f"><span>Age</span><select onchange="CCR.b('age',this.value)" ${may ? '' : 'disabled'}>${[['all', 'All ages'], ['13', '13+'], ['18', '18+ only']].map(([k, l]) => `<option value="${k}"${d.age === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <div class="ccr-cols2">
          <div>
            <label class="hub-f"><span>Rules — one per line</span><textarea rows="5" oninput="CCR.b('rules',this.value)" ${may ? '' : 'disabled'}>${esc(d.rules)}</textarea></label>
            <label class="hub-f"><span>Welcome message</span><textarea rows="2" maxlength="300" oninput="CCR.b('welcome',this.value)" ${may ? '' : 'disabled'}>${esc(d.welcome)}</textarea></label>
          </div>
          <div>
            <h4 class="hub-h4">Links</h4>
            ${LINKS.map(([k, l, i]) => `<label class="ccr-link">${ico(i)}<input type="url" placeholder="https:// — ${l}" value="${esc(d.links[k] || '')}" oninput="CCR.blink('${k}',this.value)" ${may ? '' : 'disabled'}></label>`).join('')}
          </div>
        </div>
        <button class="hub-btn primary" onclick="CCR.saveBranding()" ${may ? '' : 'disabled'}>${ico('save')}Save branding</button>
      </section>`;
  }
  function b(key, v) { if (drafts.b) { drafts.b[key] = v; drafts.b.dirty = true; } }
  function blink(k, v) { if (drafts.b) { drafts.b.links[k] = v.trim(); drafts.b.dirty = true; } }

  function saveBranding() {
    const d = drafts.b;
    const cid = cidNow();
    if (!d || d.cid !== cid) return;
    if (!CMD.can(cid, 'manage')) { toast('Branding needs the manage permission.'); return; }
    const links = {};
    for (const k of Object.keys(d.links)) {
      if (!d.links[k]) continue;
      if (!/^https:\/\/[^\s]+\.[^\s]+/i.test(d.links[k])) { toast(`The ${k} link must start with https://`); return; }
      links[k] = d.links[k];
    }
    CMD.updateCommunity(cid, {
      avatar: okImage(d.avatar) ? d.avatar : '', icon: d.icon, color: okColor(d.color), banner: okImage(d.banner) ? d.banner : '', bannerPreset: d.bannerPreset,
      tagline: d.tagline.trim(), language: d.language, age: d.age, welcome: d.welcome.trim(), links,
      rules: String(d.rules).split('\n').map(x => x.trim()).filter(Boolean).slice(0, 15)
    });
    const ok = persisted(cid);
    drafts.b = null;
    CST.repaint();
    toast(ok ? 'Branding saved' : 'Saved — but the images were too large to keep on this device and were removed.');
  }

  /* ══════════════════════════════════════════════════════════════════
     Surfaces in the hub and community screens
     ══════════════════════════════════════════════════════════════════ */

  const underAge = c => !!(window.PME && (c.age === '18' || c.age === '13') && PME.age() != null && PME.age() < +c.age);
  const visible = c => CMD.isJoined(c.id) || (c.privacy !== 'private' && c.listed !== false && !underAge(c));

  function cardBadge(c) {
    const st = CMB.status(c.id);
    if (['trialing', 'active', 'cancelled'].indexOf(st.kind) > -1) return `<span class="ccr-cbadge member">${ico('workspace_premium')}${esc((CMB.tier(c.id, st.s.tier) || {}).name || 'Member')}</span>`;
    const e = CMB.entry(c.id);
    const paid = CMB.paidTiers(c.id);
    if (e.mode === 'paid' && paid.length) return `<span class="ccr-cbadge">${ico('lock')}Members · from ${CMB.money(c.id, Math.min(...paid.map(t => +t.price)))}/mo${e.trialDays ? ' · ' + e.trialDays + '-day trial' : ''}</span>`;
    return '';
  }

  const sideBanner = c => hasBanner(c) ? `<div class="ccr-sidebanner" style="background:${bannerCSS(c)}"></div>` : '';
  const heroBanner = c => hasBanner(c) ? `<div class="ccr-herobanner" style="background:${bannerCSS(c)}"></div>` : '';

  const STATUS_LABEL = { trialing: 'Free trial', active: 'Active', cancelled: 'Cancelled — ends soon', founding: 'Founding member', owner: 'Owner', grace: 'Grace period', lapsed: 'Membership ended', ended: 'Ended', free: 'Free member', none: '' };

  function heroAction(cid) {
    const st = CMB.status(cid);
    const paid = CMB.paidTiers(cid);
    if (st.kind === 'owner') return paid.length ? `<button class="hub-btn" onclick="CCR.studioMembers()">${ico('workspace_premium')}Memberships</button>` : '';
    if (['trialing', 'active', 'cancelled', 'grace'].indexOf(st.kind) > -1 && st.s) return `<button class="hub-btn" onclick="CCR.openManage('${cid}')">${ico('workspace_premium')}${esc((CMB.tier(cid, st.s.tier) || {}).name || 'Membership')}</button>`;
    if (st.kind === 'lapsed') return `<button class="hub-btn primary" onclick="CCR.startCheckout('${cid}')">${ico('autorenew')}Renew membership</button>`;
    if (st.kind === 'founding') return `<span class="cpx-pill ok">${ico('verified')}Founding member</span>`;
    return paid.length ? `<button class="hub-btn primary" onclick="CCR.startCheckout('${cid}')">${ico('workspace_premium')}Become a member</button>` : '';
  }

  function lapseBanner(cid) {
    const st = CMB.status(cid);
    if (st.kind === 'lapsed') {
      return `<div class="ccr-lapse">${ico('lock_clock')}<span><b>Your membership has ended.</b> You can still read, but posting, reactions, voice and votes are paused.</span>
        <button class="hub-btn primary sm" onclick="CCR.startCheckout('${cid}')">Renew</button></div>`;
    }
    if (st.kind === 'grace') {
      return `<div class="ccr-lapse warn">${ico('schedule')}<span><b>Your membership ended.</b> You have a short grace period before posting is paused.</span>
        <button class="hub-btn sm" onclick="CCR.startCheckout('${cid}')">Renew</button></div>`;
    }
    if (st.kind === 'cancelled' && st.s) {
      return `<div class="ccr-lapse info">${ico('event_busy')}<span>Your ${esc((CMB.tier(cid, st.s.tier) || {}).name || '')} membership ends on <b>${date(st.s.periodEnd)}</b>.</span>
        <button class="hub-btn sm" onclick="CCR.resume('${cid}')">Keep it</button></div>`;
    }
    return '';
  }

  /* A channel that a paid tier unlocks says so, instead of pointing at
     reputation. */
  function lockedHTML(cid, chn) {
    if (!chn || !chn.private) return '';
    const unlocking = CMB.paidTiers(cid).filter(t => CMD.roleById(cid, t.role || 'subscriber').level >= CMD.roleById(cid, chn.role || 'contributor').level);
    if (!unlocking.length || (chn.role || 'contributor') !== 'subscriber' && !unlocking.some(t => t.role === chn.role)) return '';
    const cheapest = unlocking.slice().sort((a, b) => a.price - b.price)[0];
    return `<div class="hub-locked">
      ${ico('workspace_premium')}
      <b>#${esc(chn.name)} is for members</b>
      <p>${esc(chn.topic || 'A members-only space.')} Join ${unlocking.map(t => esc(t.name)).join(' or ')} to open it — from ${CMB.money(cid, cheapest.price)}/mo.</p>
      <div class="hub-acts"><button class="hub-btn primary" onclick="CCR.startCheckout('${cid}','${cheapest.id}')">Become a member</button>
        <button class="hub-btn" onclick="HUB.setTab('about')">See all tiers</button></div>
    </div>`;
  }

  function aboutTiersHTML(cid) {
    const e = CMB.entry(cid);
    const st = CMB.status(cid);
    const current = st.s && CMB.live(st.s) ? st.s.tier : (st.kind === 'founding' || st.kind === 'owner' ? null : 'free');
    const list = CMB.tiers(cid).filter(t => !(e.mode === 'paid' && !(+t.price > 0)));
    const curPrice = current ? +((CMB.tier(cid, current) || {}).price || 0) : 0;
    return `
      <div class="ccr-status">
        <span class="cpx-pill ${['lapsed', 'grace'].indexOf(st.kind) > -1 ? 'warm' : 'ok'}">${ico('workspace_premium')}${esc(STATUS_LABEL[st.kind] || 'Member')}${st.s && CMB.live(st.s) ? ' · ' + esc((CMB.tier(cid, st.s.tier) || {}).name || '') : ''}</span>
        <span class="hub-none sm">${e.mode === 'paid' ? 'Membership required to take part' : 'Free to join · memberships are optional'}${e.trialDays ? ` · ${e.trialDays}-day free trial` : ''}</span>
        ${st.s ? `<button class="hub-btn sm" onclick="CCR.openManage('${cid}')">${ico('manage_accounts')}Manage</button>` : ''}
      </div>
      <div class="hub-tiers">${list.map(t => {
        const on = current === t.id;
        const pricey = +t.price > 0;
        const label = on ? 'Your tier' : !pricey ? 'Switch to free' : (st.s && CMB.live(st.s)) ? (+t.price > curPrice ? 'Upgrade' : 'Downgrade') : 'Join';
        if (st.kind === 'owner') return `<div class="hub-tier${t.highlight ? ' pop' : ''}">${t.highlight ? '<span class="ccr-pop">Most popular</span>' : ''}<b>${esc(t.name)}</b>
          <span class="hub-tier-p">${pricey ? CMB.money(cid, +t.price) + '<small>/mo</small>' : 'Free'}</span><ul>${(t.perks || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
          <button class="hub-btn sm" onclick="CCR.studioMembers()">Edit in Studio</button></div>`;
        return `<div class="hub-tier${on ? ' on' : ''}${t.highlight ? ' pop' : ''}">
          ${t.highlight ? '<span class="ccr-pop">Most popular</span>' : ''}
          <b>${esc(t.name)}</b>
          <span class="hub-tier-p">${pricey ? CMB.money(cid, +t.price) + '<small>/mo</small>' : 'Free'}</span>
          ${pricey ? `<span class="hub-none sm">or ${CMB.money(cid, CMB.price(cid, t, 'yearly'))}/yr${CMB.saving(cid, t) ? ` · save ${CMB.saving(cid, t)}%` : ''}</span>` : ''}
          <ul>${(t.perks || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
          <button class="hub-btn sm${on ? '' : ' primary'}" ${on ? 'disabled' : `onclick="CCR.chooseTier('${cid}','${t.id}')"`}>${label}</button>
        </div>`;
      }).join('')}</div>`;
  }

  async function chooseTier(cid, tid) {
    const t = CMB.tier(cid, tid);
    const s = CMB.sub(cid);
    if (!t) return;
    if (!(+t.price > 0)) {
      if (s && CMB.live(s)) { openManage(cid); return; }
      toast('You are on the free tier.');
      return;
    }
    if (s && CMB.live(s) && +t.price < +((CMB.tier(cid, s.tier) || {}).price || 0)) {
      if (!(await appConfirm(`Switch to ${t.name} at your next renewal? You keep your current perks until then.`, { ok: 'Switch' }))) return;
      const r = CMB.changeTier(cid, tid);
      toast(r.error || `Changes to ${t.name} on ${date(r.s.periodEnd)}`);
      HUB.paint();
      return;
    }
    startCheckout(cid, tid);
  }

  function aboutExtra(c) {
    const links = Object.keys(c.links || {}).filter(k => /^https:\/\//i.test(c.links[k]));
    const facts = [c.language && ['translate', c.language], c.age && c.age !== 'all' && ['shield_person', c.age + '+ only'],
      c.privacy && ['lock', { public: 'Public', invite: 'Invite only', private: 'Private' }[c.privacy]]].filter(Boolean);
    if (!links.length && !facts.length && !c.tagline) return '';
    return `${c.tagline ? `<p class="ccr-tagline">${esc(c.tagline)}</p>` : ''}
      ${facts.length ? `<div class="hub-tagrow">${facts.map(([i, l]) => `<span class="hub-chip-s">${ico(i)}${esc(l)}</span>`).join('')}</div>` : ''}
      ${links.length ? `<div class="ccr-links">${links.map(k => { const L = LINKS.find(x => x[0] === k) || [k, k, 'link'];
        return `<button class="hub-btn sm" onclick="CCR.visit('${c.id}','${k}')">${ico(L[2])}${esc(L[1])}</button>`; }).join('')}</div>` : ''}`;
  }
  function visit(cid, k) {
    const c = CMD.byId(cid);
    const url = c && c.links && c.links[k];
    if (!url || !/^https:\/\//i.test(url)) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const rulesFor = c => (c && Array.isArray(c.rules) && c.rules.length) ? c.rules : null;

  /* ══════════════════════════════════════════════════════════════════
     Join → membership → checkout
     ══════════════════════════════════════════════════════════════════ */

  let J = null;

  function openJoin(cid) {
    const c = CMD.byId(cid);
    if (!c) return true;
    if (c.privacy === 'invite' || c.privacy === 'private') {
      if (!CMB.invited(cid) && !CMD.iOwn(c)) {
        HUB.modal(c.name, `<div class="hub-empty">${ico('mail_lock')}<p><b>${esc(c.name)}</b> is invite only.</p>
          <p class="hub-none">Ask a member for an invite link — opening it lets you join.</p></div>`);
        return true;
      }
    }
    const e = CMB.entry(cid);
    const paid = CMB.paidTiers(cid);
    J = { cid, step: 'join', rules: false, age: false, interests: [], tier: e.mode === 'paid' ? ((paid.find(t => t.highlight) || paid[0] || {}).id) : 'free',
      cycle: 'monthly', method: 'card', agree: false };
    HUB.modal(`Join ${c.name}`, '<div id="ccr-join"></div>', true);
    paintJoin();
    return true;
  }

  function startCheckout(cid, tid) {
    const c = CMD.byId(cid);
    if (!c) return;
    if (CMD.isJoined(cid) && CMD.iOwn(c)) { HUB.closeModal(); studioMembers(); toast('You own this community — tiers are managed in Studio.'); return; }
    const paid = CMB.paidTiers(cid);
    if (!paid.length) { toast('This community has no paid memberships.'); return; }
    if (!CMD.isJoined(cid)) { openJoin(cid); if (tid && J) { J.tier = tid; paintJoin(); } return; }
    const s = CMB.sub(cid);
    const pick = tid || (s && CMB.live(s) ? (paid.find(t => +t.price > +((CMB.tier(cid, s.tier) || {}).price || 0)) || paid[0]).id : (paid.find(t => t.highlight) || paid[0]).id);
    J = { cid, step: 'pay', joined: true, rules: true, age: true, interests: [], tier: pick, cycle: (s && s.cycle) || 'monthly', method: (s && s.method) || 'card', agree: false };
    HUB.modal(`${c.name} membership`, '<div id="ccr-join"></div>', true);
    paintJoin();
  }

  function paintJoin() {
    const box = $('ccr-join');
    if (!box || !J) return;
    const c = CMD.byId(J.cid);
    const dlg = box.closest('.hub-dialog');
    const keep = dlg && J.painted === J.step ? dlg.scrollTop : 0;
    box.innerHTML = J.step === 'done' ? doneHTML(c) : J.step === 'pay' ? payHTML(c) : joinHTML(c);
    J.painted = J.step;
    if (dlg) dlg.scrollTop = keep;
  }

  function headHTML(c) {
    return `<div class="ccr-jhead">
      <div class="ccr-jbanner" style="background:${bannerCSS(c)}"></div>
      <div class="ccr-jrow">
        <span class="ccr-av lg" style="--c:${okColor(c.color)}">${icon(c)}</span>
        <div><b>${esc(c.name)}${c.verified ? '<span class="material-symbols-rounded hub-verif">verified</span>' : ''}</b>
          <span>${esc(c.handle || '@' + c.id)} · ${compact(CMD.memberCount(c.id))} members · ${compact(CMD.onlineCount(c.id))} online${c.language ? ' · ' + esc(c.language) : ''}</span></div>
      </div>
    </div>`;
  }

  function joinHTML(c) {
    const cid = c.id;
    const e = CMB.entry(cid);
    const paid = CMB.paidTiers(cid);
    const tiers = e.mode === 'paid' ? paid : CMB.tiers(cid).filter(t => !(+t.price > 0)).slice(0, 1).concat(paid);
    const rules = rulesFor(c) || ['Be useful and be civil.', 'No spam, scams or referral dumps.', 'Never share or ask for seed phrases or keys.', 'Keep channels on topic.'];
    const sel = CMB.tier(cid, J.tier);
    const q = sel && +sel.price > 0 ? CMB.quote(cid, sel.id, J.cycle) : null;
    const hasYearly = paid.length > 0;
    return `
      ${headHTML(c)}
      <p class="hub-guide">${esc(c.tagline || c.desc)}</p>

      <h4 class="hub-h4">1 · Community rules</h4>
      <ol class="hub-rules sm">${rules.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
      <label class="hub-check"><input type="checkbox" ${J.rules ? 'checked' : ''} onchange="CCR.j('rules',this.checked)"> I agree to these rules</label>
      ${ageCheckHTML(c)}

      <h4 class="hub-h4">2 · What are you here for?</h4>
      <div class="hub-chips" id="hub-join-int">
        ${[['lurk', 'Reading and learning'], ['chat', 'Chatting daily'], ['build', 'Building and contributing'], ['teach', 'Helping and answering'], ['events', 'Events and calls'], ['news', 'News only']]
          .map(([k, l]) => `<button class="hub-chip${J.interests.indexOf(k) > -1 ? ' on' : ''}" data-k="${k}" onclick="CCR.jint('${k}',this)">${l}</button>`).join('')}
      </div>

      ${tiers.length > 1 || e.mode === 'paid' ? `
      <h4 class="hub-h4">3 · Membership${e.mode === 'paid' ? ' — required to join' : ' — optional'}</h4>
      ${hasYearly ? `<div class="ccr-cycle">${['monthly', 'yearly'].map(k => `<button class="${J.cycle === k ? 'on' : ''}" onclick="CCR.j('cycle','${k}')">${k === 'monthly' ? 'Monthly' : 'Yearly'}${k === 'yearly' && e.yearlyDiscount ? ` <i>save up to ${Math.max(...paid.map(t => CMB.saving(cid, t)))}%</i>` : ''}</button>`).join('')}</div>` : ''}
      <div class="ccr-tpick">${tiers.map(t => tierPickHTML(cid, t)).join('')}</div>
      ${e.trialDays && q && q.trial ? `<p class="hub-none sm">${ico('redeem')} ${e.trialDays}-day free trial on any paid tier — you will not be charged until ${date(q.firstCharge)}, and you can cancel before then.</p>` : ''}` : ''}

      <button class="hub-btn primary wide" onclick="CCR.joinNext()">${!q ? 'Join community' : q.trial ? `Start ${q.trial}-day free trial` : `Continue · ${CMB.money(cid, q.amount)}${CMB.per(J.cycle)}`}</button>`;
  }

  function ageCheckHTML(c) {
    if (c.age !== '18' && c.age !== '13') return '';
    const a = window.PME ? PME.age() : null;
    if (a != null && a >= +c.age) { J.age = true; return `<p class="ccr-agechk ok">${ico('verified_user')}The birthday on your profile confirms you are ${c.age} or older.</p>`; }
    if (a != null) return `<p class="ccr-agechk bad">${ico('block')}This community is for ${c.age}+ only, and the birthday on your profile says you are under ${c.age}.</p>`;
    return `<label class="hub-check cpx-mt"><input type="checkbox" ${J.age ? 'checked' : ''} onchange="CCR.j('age',this.checked)"> I confirm I am ${c.age} or older</label>`;
  }

  function tierPickHTML(cid, t) {
    const pricey = +t.price > 0;
    const amount = CMB.price(cid, t, J.cycle);
    const full = CMB.seatsTaken(cid, t.id) >= (t.limit || Infinity);
    return `<button class="ccr-tp${J.tier === t.id ? ' on' : ''}${t.highlight ? ' pop' : ''}" ${full ? 'disabled' : ''} onclick="CCR.j('tier','${t.id}')">
      ${t.highlight ? '<span class="ccr-pop">Most popular</span>' : ''}
      <span class="ccr-tp-r">${ico(J.tier === t.id ? 'radio_button_checked' : 'radio_button_unchecked')}</span>
      <b>${esc(t.name)}</b>
      <span class="ccr-tp-p">${pricey ? `${CMB.money(cid, amount)}<small>${CMB.per(J.cycle)}</small>` : 'Free'}</span>
      ${pricey && J.cycle === 'yearly' && CMB.saving(cid, t) ? `<span class="ccr-save">save ${CMB.saving(cid, t)}%</span>` : ''}
      <ul>${(t.perks || []).slice(0, 4).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      ${t.limit ? `<span class="hub-none sm">${full ? 'Full' : `${Math.max(0, t.limit - CMB.seatsTaken(cid, t.id))} of ${t.limit} places left`}</span>` : ''}
    </button>`;
  }

  function j(key, v) { if (!J) return; J[key] = v; if (key !== 'rules' && key !== 'age' && key !== 'agree') paintJoin(); }
  function jint(k, btn) { if (!J) return; const i = J.interests.indexOf(k); if (i > -1) J.interests.splice(i, 1); else J.interests.push(k); if (btn) btn.classList.toggle('on', i < 0); }

  function joinNext() {
    if (!J) return;
    const c = CMD.byId(J.cid);
    if (!J.rules) { toast('Agree to the rules first.'); return; }
    if ((c.age === '18' || c.age === '13') && window.PME && PME.age() != null && PME.age() < +c.age) { toast(`This community is for ${c.age}+ only.`); return; }
    if ((c.age === '18' || c.age === '13') && !J.age) { toast(`Confirm you are ${c.age} or older.`); return; }
    const t = CMB.tier(J.cid, J.tier);
    if (CMB.entry(J.cid).mode === 'paid' && !(t && +t.price > 0)) { toast('Pick a membership tier to join.'); return; }
    if (t && +t.price > 0) {
      if (t.limit && CMB.seatsTaken(J.cid, t.id) >= t.limit) { toast(`${t.name} is full.`); return; }
      J.step = 'pay';
      paintJoin();
      return;
    }
    doJoin();
    HUB.closeModal();
    HUB.open(J.cid);
    toast(`Welcome to ${c.name}`);
    J = null;
  }

  function doJoin() {
    const c = CMD.byId(J.cid);
    if (CMD.isJoined(J.cid)) return true;
    const ok = CMD.join(J.cid, { rules: true, interests: J.interests });
    if (!ok) { toast('You cannot join this community.'); return false; }
    CMD.setInterests(J.cid, J.interests);
    if (c.welcome) CMD.systemMsg(J.cid, 'general', c.welcome);
    return true;
  }


  /* ── What each payment method actually shows ─────────────────────────
     A receiving address, a UPI ID or a QR code only ever appears when the
     community's owner has published one. Nothing here is invented, and no
     card, UPI or wallet detail is ever collected by Trending. */
  const QR_OK = () => typeof QRGEN !== 'undefined';
  function qrSVG(text, px) {
    if (!QR_OK()) return '<p class="hub-none sm">QR codes are unavailable right now.</p>';
    try { return QRGEN.svg(QRGEN.make(String(text)), px || 180, ''); }
    catch (e) { return '<p class="hub-none sm">That is too long to draw as a code.</p>'; }
  }

  function coinPanel(cid, q) {
    const coin = J.coin || 'USDT';
    const nets = CMB.netsFor(coin);
    const net = nets.indexOf(J.net) >= 0 ? J.net : nets[0];
    J.coin = coin; J.net = net;
    // On a trial nothing is due today, so the coin figure is what the
    // first payment will come to, and says so rather than looking due now.
    const due = q.dueToday || q.amount;
    const cq = CMB.cryptoQuote(cid, due, coin);
    const to = CMB.payTo(cid).crypto;
    const n = CMB.netOf(net);
    const uri = to && to.net === net && typeof WAD !== 'undefined' && WAD.walletURI
      ? WAD.walletURI(net, to.address, coin, cq.error ? 0 : cq.units) : (to ? to.address : '');
    return `
      <div class="ccr-pm">
        <div class="ccr-pm-l">Coin</div>
        <div class="hub-chips">${CMB.COINS.map(([k, name]) => `<button class="hub-chip${k === coin ? ' on' : ''}" onclick="CCR.j('coin','${k}')" title="${esc(name)}">${k}</button>`).join('')}</div>
        <div class="ccr-pm-l">Network</div>
        <div class="hub-chips">${nets.map(k => `<button class="hub-chip${k === net ? ' on' : ''}" onclick="CCR.j('net','${k}')">${esc(CMB.netOf(k).label)} · ${esc(CMB.netOf(k).tag)}</button>`).join('')}</div>

        ${cq.error
          ? `<div class="ccr-pm-warn">${ico('info')}<span>${esc(cq.error)}</span></div>`
          : `<div class="ccr-pm-amt"><b>${esc(cq.text)} ${esc(cq.coin)}</b>
               <span>${cq.peg ? `at the 1.00 USD peg — not a live market rate` : `1 ${esc(cq.coin)} = $${cq.usdRate >= 1 ? cq.usdRate.toLocaleString('en-US', { maximumFractionDigits: 2 }) : cq.usdRate.toPrecision(4)}${cq.stale ? ' · last known rate' : cq.at ? ' · live' : ''}`}${cq.fxIndicative ? ` · ${esc(cq.currency)} converted at an indicative rate` : ''}</span>
               ${q.trial ? `<span>Nothing is due today — this is what the first payment on ${date(q.firstCharge)} comes to at today's rate.</span>` : ''}</div>`}

        ${to && to.net === net ? `
          <div class="ccr-pm-qr">${qrSVG(uri || to.address, 168)}</div>
          <div class="ccr-pm-addr"><code>${esc(to.address)}</code>
            <button class="hub-act" onclick="CCR.copyPay('${esc(to.address)}')" aria-label="Copy address">${ico('content_copy')}</button></div>
          <p class="hub-none sm">${esc(n.label)} · ${esc(n.tag)}. Check the first and last six characters in your own wallet before sending${net === 'xrpl' ? ', and add a destination tag if the owner gave you one' : ''}. Sending on the wrong network loses the funds.</p>`
        : to ? `<div class="ccr-pm-warn">${ico('info')}<span>This community receives on ${esc(CMB.netOf(to.net).label)}. Pick that network, or another coin that settles there.</span></div>`
        : `<div class="ccr-pm-warn">${ico('info')}<span>A payment code is built from the community's own receiving address, and this one has not published theirs yet. Trending never shows a made-up address, because coins sent to one are gone. Confirming below records the membership as simulated.</span></div>
          ${CMD.can(cid, 'manage') ? `<button class="hub-btn wide" onclick="CCR.goPaySetup()">${ico('add_link')}Publish your address</button>` : ''}`}

        <p class="hub-none sm">${ico('shield')} You approve the payment in your own wallet. Trending never holds funds, never asks for a recovery phrase and never signs for you.</p>
      </div>`;
  }

  function upiPanel(cid, q) {
    const u = CMB.payTo(cid).upi;
    const e = CMB.entry(cid);
    const amt = q.dueToday || q.amount;
    if (!u) return `<div class="ccr-pm"><div class="ccr-pm-warn">${ico('info')}<span>A UPI code is built from the community's own UPI ID, and this one has not added theirs yet — so there is nothing to scan. Trending never shows a made-up UPI ID, because a wrong one sends real money to a stranger.</span></div>
      ${CMD.can(cid, 'manage')
        ? `<button class="hub-btn wide" onclick="CCR.goPaySetup()">${ico('qr_code_2')}Add your UPI ID</button>`
        : `<p class="hub-none sm">Pick another way to pay, or ask the owner to add one in Community Studio → Memberships.</p>`}</div>`;
    const link = CMB.upiURI(cid, amt, 'Membership');
    const inr = e.currency === 'INR';
    return `
      <div class="ccr-pm">
        <div class="ccr-pm-qr">${qrSVG(link, 188)}</div>
        <p class="ccr-pm-scan">Scan with GPay, PhonePe, Paytm, BHIM or your bank's app</p>
        <div class="ccr-pm-addr"><code>${esc(u.vpa)}</code>
          <button class="hub-act" onclick="CCR.copyPay('${esc(u.vpa)}')" aria-label="Copy UPI ID">${ico('content_copy')}</button></div>
        <button class="hub-btn wide" onclick="CCR.openUpi()">${ico('open_in_new')}Open in your UPI app</button>
        <p class="hub-none sm">${inr
          ? `The code carries ${esc(CMB.money(cid, amt))}, so your app fills the amount in.`
          : `UPI settles in rupees only. This community charges in ${esc(e.currency)}, so the code carries no amount — your app will show what it converts to and you enter it there.`}</p>
      </div>`;
  }

  /* Apple Pay and Google Pay are reported as the device actually answers,
     not as a promise. Nothing here opens a payment sheet: a real one needs
     a merchant account and a processor, which this build does not have. */
  function walletPanel() {
    let apple = false, prc = false;
    try { apple = !!(window.ApplePaySession && ApplePaySession.canMakePayments && ApplePaySession.canMakePayments()); } catch (e) {}
    try { prc = !!window.PaymentRequest; } catch (e) {}
    const rows = [
      ['Apple Pay', apple ? 'Ready on this device' : 'Not offered by this browser', apple],
      ['Google Pay', prc ? 'This browser supports the payment sheet' : 'Not offered by this browser', prc]
    ];
    return `
      <div class="ccr-pm">
        <div class="ccr-pm-dev">${rows.map(([l, s, ok]) => `<div class="${ok ? 'on' : ''}">${ico(ok ? 'check_circle' : 'remove_circle_outline')}<b>${l}</b><span>${s}</span></div>`).join('')}</div>
        <p class="hub-none sm">Your card details stay with Apple or Google — they hand the shop a one-time token, never your card number. Turning that on for real needs a merchant account with a payment processor and a verified domain, which this build does not have, so nothing is charged here.</p>
      </div>`;
  }

  function cardPanel() {
    return `<div class="ccr-pm">
      <p class="hub-none sm">${ico('lock')} In the live app this opens the payment processor's own hosted page. Your card number is typed there, never into Trending, and never reaches this device's storage.</p>
    </div>`;
  }

  function methodPanel(cid, q) {
    return J.method === 'crypto' ? coinPanel(cid, q)
      : J.method === 'upi' ? upiPanel(cid, q)
      : J.method === 'wallet' ? walletPanel()
      : cardPanel();
  }

  /* From the checkout to the one screen that fills this gap. */
  function goPaySetup() {
    const cid = J ? J.cid : cidNow();
    HUB.closeModal();
    J = null;
    if (CMD.state) CMD.state().cid = cid;
    HUB.openStudio();
    setTimeout(() => { CST.tab('memberships'); setTimeout(() => { const el = $('ccr-pt-vpa') || $('ccr-pt-addr'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 120); }, 60);
  }

  function copyPay(text) {
    const t = String(text || '');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('Copied'), () => toast(t));
    else toast(t);
  }
  function openUpi() {
    if (!J) return;
    const q = CMB.quote(J.cid, J.tier, J.cycle);
    const link = CMB.upiURI(J.cid, q.dueToday || q.amount, 'Membership');
    if (!link) { toast('This community has not added a UPI ID.'); return; }
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  function payHTML(c) {
    const cid = c.id;
    const t = CMB.tier(cid, J.tier);
    const q = CMB.quote(cid, t.id, J.cycle);
    const s = CMB.sub(cid);
    const change = s && CMB.live(s);
    const paid = CMB.paidTiers(cid);
    return `
      ${J.joined ? '' : `<button class="hub-back" onclick="CCR.j('step','join')">${ico('arrow_back')}Back</button>`}
      <div class="ccr-pay">
        <section class="ccr-sum">
          <div class="ccr-sum-h"><span class="ccr-av" style="--c:${okColor(c.color)}">${icon(c)}</span><div><b>${esc(c.name)}</b><span>${esc(t.name)} membership</span></div></div>
          ${paid.length > 1 ? `<div class="hub-chips">${paid.map(x => `<button class="hub-chip${x.id === t.id ? ' on' : ''}" onclick="CCR.j('tier','${x.id}')">${esc(x.name)}</button>`).join('')}</div>` : ''}
          <div class="ccr-cycle">${['monthly', 'yearly'].map(k => `<button class="${J.cycle === k ? 'on' : ''}" onclick="CCR.j('cycle','${k}')">${k === 'monthly' ? 'Monthly' : 'Yearly'}${k === 'yearly' && CMB.saving(cid, t) ? ` <i>save ${CMB.saving(cid, t)}%</i>` : ''}</button>`).join('')}</div>
          <ul class="ccr-perks">${(t.perks || []).map(p => `<li>${ico('check')}${esc(p)}</li>`).join('')}</ul>
          <div class="ccr-lines">
            <div><span>${esc(t.name)} · ${J.cycle}</span><b>${CMB.money(cid, q.amount)}</b></div>
            ${q.trial ? `<div><span>${q.trial}-day free trial</span><b>−${CMB.money(cid, q.amount)}</b></div>` : ''}
            ${change ? `<div><span>Change from ${esc((CMB.tier(cid, s.tier) || {}).name || '')}</span><b>prorated</b></div>` : ''}
            <div class="tot"><span>Due today</span><b>${change ? 'Prorated difference' : CMB.money(cid, q.dueToday)}</b></div>
            <div class="muted"><span>${q.trial ? 'First payment' : 'Renews'}</span><b>${date(q.trial ? q.firstCharge : q.renews)}</b></div>
          </div>
          <p class="hub-none sm">Prices include any taxes shown by the processor in a live build.</p>
        </section>

        <section>
          <h4 class="hub-h4">Pay with</h4>
          <div class="ccr-methods">${CMB.METHODS.map(([k, l, i, sub]) => `<button class="ccr-method${J.method === k ? ' on' : ''}" onclick="CCR.j('method','${k}')">
            ${ico(i)}<div><b>${l}</b><span>${sub}</span></div>${ico(J.method === k ? 'radio_button_checked' : 'radio_button_unchecked')}</button>`).join('')}</div>
          ${methodPanel(cid, q)}
          <div class="ccr-demo">${ico('science')}<div><b>Demo checkout</b><span>Nothing is charged and no card, UPI or wallet details are asked for. In the live app this button opens the payment processor's own secure page${J.method === 'crypto' ? ', and a crypto payment is approved in your own wallet — Trending never holds funds' : ''}.</span></div></div>
          <label class="hub-check ccr-agree"><input type="checkbox" ${J.agree ? 'checked' : ''} onchange="CCR.j('agree',this.checked)">
            <span>I understand ${esc(t.name)} ${q.trial ? `is free for ${q.trial} days, then ` : ''}renews ${J.cycle === 'yearly' ? 'every year' : 'every month'} at ${CMB.money(cid, q.amount)} until I cancel. I can cancel any time in <b>Your membership</b>, and refunds are available for ${CMB.REFUND_DAYS} days after a payment.</span></label>
          <button class="hub-btn primary wide" onclick="CCR.pay()">${ico('lock')}${q.trial ? `Start free trial` : change ? `Confirm change` : `Pay ${CMB.money(cid, q.amount)} & join`}</button>
        </section>
      </div>`;
  }

  function pay() {
    if (!J) return;
    const c = CMD.byId(J.cid);
    if (!J.agree) { toast('Tick the renewal confirmation first.'); return; }
    if (!CMD.isJoined(J.cid) && !doJoin()) return;
    const r = CMB.checkout(J.cid, { tier: J.tier, cycle: J.cycle, method: J.method, agree: true, coin: J.coin, net: J.net });
    if (r.error) { toast(r.error); return; }
    J.result = r;
    J.step = 'done';
    paintJoin();
    HUB.paint();
    const t = CMB.tier(J.cid, J.tier);
    toast(r.trial ? `${r.trial}-day trial of ${t.name} started` : r.scheduled ? `Changes to ${t.name} at renewal` : `Welcome to ${t.name} — simulated, nothing charged`);
  }

  function doneHTML(c) {
    const r = J.result || {};
    const t = CMB.tier(c.id, J.tier);
    const rec = CMB.receipts(c.id)[0];
    return `
      ${headHTML(c)}
      <div class="ccr-done">
        <span class="ccr-done-i">${ico(r.scheduled ? 'event_repeat' : 'celebration')}</span>
        <h3>${r.scheduled ? `${esc(t.name)} starts at renewal` : r.trial ? `Your ${r.trial}-day trial has started` : `You're in — welcome to ${esc(t.name)}`}</h3>
        <p class="hub-guide">${r.scheduled ? 'You keep your current perks until then.' : `Members-only channels are open${r.trial ? ` — first payment ${date(r.s.trialEnd)}` : ''}.`}</p>
        ${rec ? `<div class="ccr-receipt"><span>Receipt ${esc(rec.id)}</span><b>${rec.kind === 'trial' ? 'Trial · ' + CMB.money(c.id, 0) : CMB.money(c.id, rec.amount)}</b><code>${esc((rec.digest || '').slice(0, 16))}</code></div>` : ''}
        <div class="hub-acts" style="justify-content:center">
          <button class="hub-btn primary" onclick="CCR.finish()">Open ${esc(c.name)}</button>
          <button class="hub-btn" onclick="CCR.openManage('${c.id}')">Manage membership</button>
        </div>
      </div>`;
  }
  function finish() { const cid = J && J.cid; HUB.closeModal(); J = null; if (cid) HUB.open(cid); }

  /* ── Your membership ─────────────────────────────────────────────── */
  function openManage(cid) {
    cid = cid || cidNow();
    const c = CMD.byId(cid);
    if (!c) return;
    const st = CMB.status(cid);
    const s = st.s;
    const e = CMB.entry(cid);
    const live = s && CMB.live(s);
    const t = s ? CMB.tier(cid, s.tier) : null;
    const recs = CMB.receipts(cid);
    const endLabel = !s ? '' : s.status === 'trialing' ? (s.autoRenew ? 'Trial ends · first payment' : 'Trial ends') : s.status === 'cancelled' ? 'Access until' : s.status === 'active' ? 'Renews' : 'Ended';
    const endAt = !s ? 0 : s.status === 'trialing' ? s.trialEnd : s.periodEnd;
    HUB.modal('Your membership', `
      ${headHTML(c)}
      ${s ? `
      <div class="ccr-mcard${live ? '' : ' ended'}">
        <div><span class="hub-none sm">Tier</span><b>${esc(t ? t.name : s.tier)}</b></div>
        <div><span class="hub-none sm">Status</span><b>${esc(STATUS_LABEL[st.kind] || s.status)}</b></div>
        <div><span class="hub-none sm">${endLabel}</span><b>${endAt ? date(endAt) : '—'}</b></div>
        <div><span class="hub-none sm">Price</span><b>${t ? CMB.money(cid, CMB.price(cid, t, s.cycle)) + CMB.per(s.cycle) : '—'}</b></div>
        <div><span class="hub-none sm">Pay with</span><b>${esc((CMB.METHODS.find(m => m[0] === s.method) || ['', s.method])[1])}${s.method === 'crypto' && s.coin ? ` · ${esc(s.coin)}${s.net ? ' on ' + esc(CMB.netOf(s.net).label) : ''}` : ''}</b></div>
      </div>
      ${s.pendingTier ? `<p class="hub-none sm">${ico('event_repeat')} Changes to ${esc((CMB.tier(cid, s.pendingTier) || {}).name || '')} at renewal.</p>` : ''}
      ${s.pendingCycle ? `<p class="hub-none sm">${ico('event_repeat')} Billing switches to ${esc(s.pendingCycle)} at renewal.</p>` : ''}
      <div class="hub-acts">
        ${live ? `<button class="hub-btn primary" onclick="CCR.startCheckout('${cid}')">${ico('swap_vert')}Change tier</button>` : `<button class="hub-btn primary" onclick="CCR.startCheckout('${cid}','${s.tier}')">${ico('autorenew')}Rejoin</button>`}
        ${live && s.status !== 'trialing' ? `<button class="hub-btn" onclick="CCR.cycle('${cid}','${s.cycle === 'yearly' ? 'monthly' : 'yearly'}')">${ico('calendar_month')}Switch to ${s.cycle === 'yearly' ? 'monthly' : 'yearly'}</button>` : ''}
        ${live && s.autoRenew ? `<button class="hub-btn danger" onclick="CCR.cancel('${cid}')">${ico('cancel')}Cancel membership</button>` : ''}
        ${live && !s.autoRenew ? `<button class="hub-btn" onclick="CCR.resume('${cid}')">${ico('restart_alt')}Resume renewal</button>` : ''}
        ${CMB.canRefund(cid) ? `<button class="hub-btn" onclick="CCR.refund('${cid}')">${ico('undo')}Request refund</button>` : ''}
      </div>` : `
      <p class="hub-guide">${st.kind === 'founding' ? 'You joined before memberships were required, so you keep full access as a founding member.' : st.kind === 'owner' ? 'You own this community.' : 'You are on the free tier.'}</p>
      ${CMB.paidTiers(cid).length ? `<button class="hub-btn primary" onclick="CCR.startCheckout('${cid}')">${ico('workspace_premium')}See memberships</button>` : ''}`}

      ${s && s.history.length ? `<h4 class="hub-h4">History</h4>
        <div class="ccr-hist">${s.history.slice().reverse().map(h => `<div><i></i><span>${esc(h.what)}</span><em>${date(h.at)}</em></div>`).join('')}</div>` : ''}

      ${recs.length ? `<h4 class="hub-h4">Receipts</h4>
        ${recs.map(r => `<div class="cst-log"><span class="cst-log-a ${r.kind === 'refund' ? 'ban' : ''}">${esc(r.kind)}</span><b>${r.kind === 'trial' ? 'Free trial' : CMB.fmt(Math.abs(r.amount), r.currency)}</b>
          <span>${esc(r.tierName || '')} · ${esc(r.note || '')}</span><i>${date(r.at)} · ${esc(r.id)}</i></div>`).join('')}
        <p class="hub-none sm">Simulated receipts — no money moved. Each carries a digest of its contents.</p>` : ''}

      ${s ? `<details class="ccr-demo-tools"><summary>${ico('science')}Demo tools</summary>
        <p class="hub-none sm">Move this membership's clock forward to see a trial convert, a renewal, or a cancellation end — without waiting.</p>
        <div class="hub-acts"><button class="hub-btn sm" onclick="CCR.ff('${cid}',8)">+8 days</button><button class="hub-btn sm" onclick="CCR.ff('${cid}',31)">+31 days</button><button class="hub-btn sm" onclick="CCR.ff('${cid}',366)">+1 year</button></div>
      </details>` : ''}`, true);
  }
  function cycle(cid, c) { const r = CMB.switchCycle(cid, c); toast(r.error || `Billing switches to ${c} at renewal`); openManage(cid); }
  async function cancel(cid) {
    const s = CMB.sub(cid);
    const t = s && CMB.tier(cid, s.tier);
    if (!(await appConfirm(`Cancel ${t ? t.name : 'your membership'}? You keep access until the end of the period you paid for.`, { ok: 'Cancel membership', cancel: 'Keep it', danger: true }))) return;
    const r = CMB.cancel(cid);
    toast(r.error || `Cancelled — access until ${date(r.until)}`);
    HUB.paint(); openManage(cid);
  }
  function resume(cid) { const r = CMB.resume(cid); toast(r.error || 'Renewal is back on'); HUB.paint(); if ($('hub-modal')) openManage(cid); }
  async function refund(cid) {
    if (!(await appConfirm('Refund your last payment and end the membership now?', { ok: 'Refund', danger: true }))) return;
    const r = CMB.refund(cid);
    toast(r.error || `Refunded ${CMB.money(cid, r.amount)} (simulated)`);
    HUB.paint(); openManage(cid);
  }
  function ff(cid, days) {
    const r = CMB.fastForward(cid, days);
    if (r.error) { toast(r.error); return; }
    toast(`Moved forward ${days} days — ${STATUS_LABEL[CMB.status(cid).kind] || r.s.status}`);
    HUB.paint(); openManage(cid);
  }

  /* ══════════════════════════════════════════════════════════════════
     Community Studio → Memberships
     ══════════════════════════════════════════════════════════════════ */

  function studioMembers() { HUB.openStudio(); setTimeout(() => CST.tab('memberships'), 40); }


  /* ── Owner: where members pay ────────────────────────────────────────
     Two destinations a creator owns outright — a wallet address and a UPI
     ID. Both are typed by the owner and checked before they are kept; a
     demo wallet and anything that looks like a secret are refused. */
  function payToHTML(cid, may) {
    const to = CMB.payTo(cid);
    const nets = Object.keys(CMB.PAY_NETS);
    return `
      <div class="ccr-payto">
        <div class="ccr-payto-c">
          <b>${ico('token')}Crypto</b>
          ${to.crypto ? `<div class="ccr-payto-set"><code>${esc(to.crypto.address)}</code>
              <span>${esc(CMB.netOf(to.crypto.net).label)} · ${esc(CMB.netOf(to.crypto.net).tag)}</span>
              ${may ? `<button class="hub-act danger" onclick="CCR.clearPayTo('crypto')" aria-label="Remove">${ico('close')}</button>` : ''}</div>
            <div class="ccr-payto-qr"><div class="ccr-pm-qr">${qrSVG(to.crypto.address, 150)}</div>
              <span>What members see</span></div>
            <p class="hub-none sm">Members paying in any coin that settles on ${esc(CMB.netOf(to.crypto.net).label)} see this address and its code.</p>`
          : `<div class="hub-form-row">
              <label class="hub-f"><span>Network</span><select id="ccr-pt-net" ${may ? '' : 'disabled'}>${nets.map(k => `<option value="${k}">${esc(CMB.PAY_NETS[k].label)} · ${esc(CMB.PAY_NETS[k].tag)}</option>`).join('')}</select></label>
              <label class="hub-f"><span>Receiving address</span><input id="ccr-pt-addr" placeholder="Paste your own wallet address" ${may ? '' : 'disabled'}></label>
            </div>
            <button class="hub-btn" onclick="CCR.savePayTo('crypto')" ${may ? '' : 'disabled'}>${ico('save')}Publish address</button>
            <p class="hub-none sm">Paste a receiving address only. Never a recovery phrase or a private key — no app should ever ask you for one.</p>`}
        </div>

        <div class="ccr-payto-c">
          <b>${ico('qr_code_2')}UPI</b>
          ${to.upi ? `<div class="ccr-payto-set"><code>${esc(to.upi.vpa)}</code>
              <span>${esc(to.upi.name || 'No name set')}</span>
              ${may ? `<button class="hub-act danger" onclick="CCR.clearPayTo('upi')" aria-label="Remove">${ico('close')}</button>` : ''}</div>
            <div class="ccr-payto-qr"><div class="ccr-pm-qr">${qrSVG(CMB.upiURI(cid, CMB.price(cid, CMB.paidTiers(cid)[0] || {}, 'monthly'), 'Membership'), 150)}</div>
              <span>What members see</span></div>
            <p class="hub-none sm">Members see a scannable code built from this ID${CMB.entry(cid).currency === 'INR' ? ', with the amount filled in' : '. UPI settles in rupees, so a code for a ' + esc(CMB.entry(cid).currency) + ' price carries no amount'}.</p>`
          : `<div class="hub-form-row">
              <label class="hub-f"><span>UPI ID</span><input id="ccr-pt-vpa" placeholder="name@bank" ${may ? '' : 'disabled'}></label>
              <label class="hub-f"><span>Name shown in the app</span><input id="ccr-pt-name" placeholder="${esc((CMD.byId(cid) || {}).name || 'Your community')}" ${may ? '' : 'disabled'}></label>
            </div>
            <button class="hub-btn" onclick="CCR.savePayTo('upi')" ${may ? '' : 'disabled'}>${ico('save')}Publish UPI ID</button>
            <p class="hub-none sm">Your UPI ID is safe to share — it is how people pay you. Never share an OTP or a UPI PIN with anyone.</p>`}
        </div>
      </div>`;
  }

  function savePayTo(kind) {
    const cid = cidNow();
    const v = id => (($(id) || {}).value || '').trim();
    const r = kind === 'crypto'
      ? CMB.setPayCrypto(cid, { net: v('ccr-pt-net'), address: v('ccr-pt-addr') })
      : CMB.setPayUpi(cid, { vpa: v('ccr-pt-vpa'), name: v('ccr-pt-name') });
    if (r.error) { toast(r.error); return; }
    toast(kind === 'crypto' ? 'Address published — members can pay you in crypto' : 'UPI ID published — members get a scannable code');
    CST.repaint();
  }
  async function clearPayTo(kind) {
    if (!(await appConfirm(kind === 'crypto' ? 'Stop showing this address to members?' : 'Stop showing this UPI ID to members?', { ok: 'Remove', danger: true }))) return;
    const r = CMB.clearPayTo(cidNow(), kind);
    if (r && r.error) { toast(r.error); return; }
    toast('Removed');
    CST.repaint();
  }

  function studioMemberships(cid) {
    const c = CMD.byId(cid);
    const e = CMB.entry(cid);
    const may = CMD.can(cid, 'manage');
    const st = CMB.stats(cid);
    const list = CMD.tiers(cid);
    const roles = CMD.roles(cid).filter(r => r.id !== 'owner');
    const membersOnly = CMD.channels(cid).filter(x => x.private && CMB.paidTiers(cid).some(t => CMD.roleById(cid, t.role || 'subscriber').level >= CMD.roleById(cid, x.role || 'contributor').level));
    const subs = CMD.members(cid).filter(m => m.role === 'subscriber' && !m.bot).slice(0, 12);
    const me = CMB.sub(cid);
    const max = Math.max(1, ...st.history.map(h => h.v));
    return `
      <header class="cst-head"><div><h2>Memberships</h2><p>How people join, what each tier includes, and what memberships bring in.</p></div>
        <div class="cst-head-a">${may ? `<button class="hub-btn primary" onclick="CCR.editTier(-1)">${ico('add')}New tier</button>` : ''}</div></header>

      <div class="cst-cards">
        <div class="cst-card">${ico('group')}<b>${compact(st.subs)}</b><span>Paying members${st.demo ? ' · demo estimate' : ''}</span></div>
        <div class="cst-card">${ico('autorenew')}<b>${CMB.fmt(st.mrr, st.currency)}</b><span>Monthly recurring</span></div>
        <div class="cst-card">${ico('calendar_month')}<b>${CMB.fmt(st.arr, st.currency)}</b><span>Yearly run-rate</span></div>
        <div class="cst-card">${ico('person')}<b>${CMB.fmt(Math.round(st.arpm * 100) / 100, st.currency)}</b><span>Per paying member</span></div>
        <div class="cst-card">${ico('account_balance')}<b>${CMB.fmt(st.payout, st.currency)}</b><span>Est. monthly payout after 10% platform + 3% processing</span></div>
      </div>

      <section class="cst-panel">
        <h3>${ico('door_open')}How people join</h3>
        <div class="hub-radios ccr-entry">
          <button class="hub-radio${e.mode === 'free' ? ' on' : ''}" ${may ? `onclick="CCR.setMode('free')"` : 'disabled'}>${ico('lock_open')}<b>Free to join</b><span>Anyone joins; paid tiers are optional extras.</span></button>
          <button class="hub-radio${e.mode === 'paid' ? ' on' : ''}" ${may ? `onclick="CCR.setMode('paid')"` : 'disabled'}>${ico('workspace_premium')}<b>Membership required</b><span>People choose a paid tier to join. Existing members keep access as founding members.</span></button>
        </div>
        <div class="hub-form-row cpx-mt">
          <label class="hub-f"><span>Currency</span><select id="ccr-e-cur" ${may ? '' : 'disabled'}>${Object.keys(CMB.CURRENCIES).map(k => `<option${e.currency === k ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
          <label class="hub-f"><span>Free trial</span><select id="ccr-e-trial" ${may ? '' : 'disabled'}>${[0, 3, 7, 14, 30].map(n => `<option value="${n}"${e.trialDays === n ? ' selected' : ''}>${n ? n + ' days' : 'No trial'}</option>`).join('')}</select></label>
          <label class="hub-f"><span>Yearly discount %</span><input type="number" id="ccr-e-disc" min="0" max="40" value="${e.yearlyDiscount}" ${may ? '' : 'disabled'}></label>
          <label class="hub-f"><span>Grace after a lapse (days)</span><input type="number" id="ccr-e-grace" min="0" max="14" value="${e.grace}" ${may ? '' : 'disabled'}></label>
        </div>
        <button class="hub-btn" onclick="CCR.saveEntry()" ${may ? '' : 'disabled'}>${ico('save')}Save</button>
        ${e.seed ? '<p class="hub-none sm">This community ships as a paid-entry demo.</p>' : ''}
      </section>

      <section class="cst-panel">
        <h3>${ico('card_membership')}Tiers</h3>
        <div class="cst-tiers">${list.map((t, i) => {
          const row = st.rows.find(r => r.t.id === t.id);
          const hidden = e.mode === 'paid' && !(+t.price > 0);
          return `<div class="cst-tier${t.highlight ? ' pop' : ''}${hidden ? ' off' : ''}">
            <div class="cst-tier-h"><b>${esc(t.name)}</b><span>${+t.price > 0 ? CMB.money(cid, +t.price) + '/mo' : 'Free'}</span></div>
            ${+t.price > 0 ? `<span class="hub-none sm">${CMB.money(cid, CMB.price(cid, t, 'yearly'))}/yr · grants ${esc(CMD.roleById(cid, t.role || 'subscriber').name)}${t.limit ? ` · ${t.limit} places` : ''}</span>` : `<span class="hub-none sm">${hidden ? 'Hidden while a membership is required' : 'Default for everyone who joins'}</span>`}
            <ul>${(t.perks || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
            ${row ? `<div class="cst-tier-n">${compact(row.count)} members · ${CMB.fmt(row.mrr, st.currency)}/mo</div>` : ''}
            ${t.highlight ? '<span class="hub-chip-s on">Most popular</span>' : ''}
            ${may ? `<div class="cst-tier-a"><button class="hub-btn sm" onclick="CCR.editTier(${i})">Edit</button>
              ${t.id !== 'free' ? `<button class="hub-act danger" onclick="CCR.delTier(${i})">${ico('delete')}</button>` : ''}</div>` : ''}
          </div>`;
        }).join('')}</div>
      </section>

      <section class="cst-panel">
        <h3>${ico('bar_chart')}Monthly recurring revenue</h3>
        ${st.mrr ? `<div class="ccr-bars">${st.history.map(h => `<div><i style="height:${Math.max(4, h.v / max * 100)}%"></i><b>${CMB.fmt(h.v, st.currency)}</b><span>${h.label}</span></div>`).join('')}</div>
          <p class="hub-none sm">${st.demo ? 'Demo trend built from this community\'s seeded size. ' : ''}Real revenue history needs a server that records payments over time.</p>`
          : '<p class="hub-none">No paying members yet.</p>'}
      </section>

      <section class="cst-panel">
        <h3>${ico('lock')}Members-only channels</h3>
        ${membersOnly.map(x => `<div class="cst-chan">${ico('lock')}<div class="cst-chan-t"><b>#${esc(x.name)}</b><span>${esc(x.topic || '')} · needs ${esc(CMD.roleById(cid, x.role || 'contributor').name)}</span></div></div>`).join('') || '<p class="hub-none">None yet — create one so paying members get somewhere of their own.</p>'}
        ${CMD.can(cid, 'channels') && CMB.paidTiers(cid).length ? `<div class="hub-form-row cpx-mt">
          <label class="hub-f"><span>Channel name</span><input id="ccr-mo-n" placeholder="members-lounge"></label>
          <label class="hub-f"><span>Kind</span><select id="ccr-mo-k"><option value="text">Text</option><option value="voice">Voice</option><option value="forum">Discussion board</option><option value="live">Live</option></select></label>
          <label class="hub-f"><span>Unlocked by</span><select id="ccr-mo-r">${Array.from(new Set(CMB.paidTiers(cid).map(t => t.role || 'subscriber'))).map(r => `<option value="${r}">${esc(CMD.roleById(cid, r).name)} (${CMB.paidTiers(cid).filter(t => (t.role || 'subscriber') === r).map(t => esc(t.name)).join(', ')})</option>`).join('')}</select></label>
        </div><button class="hub-btn" onclick="CCR.addMembersChannel()">${ico('add')}Create members-only channel</button>` : ''}
      </section>

      <section class="cst-panel">
        <h3>${ico('groups')}Subscribers</h3>
        <div class="cst-table">
          <div class="cst-tr head"><span>Member</span><span>Tier</span><span>Status</span><span>Since</span><span></span></div>
          ${me ? `<div class="cst-tr"><span class="cst-mname"><b>${esc(CMD.me().name)}</b> <i>(you)</i><small>${esc(CMD.me().handle)}</small></span>
            <span>${esc((CMB.tier(cid, me.tier) || {}).name || me.tier)}</span><span>${esc(STATUS_LABEL[CMB.status(cid).kind] || me.status)}</span><span>${date(me.started)}</span><span></span></div>` : ''}
          ${subs.map((m, i) => { const paid = CMB.paidTiers(cid); const t = paid[i % Math.max(1, paid.length)]; return `<div class="cst-tr"><span class="cst-mname"><b>${esc(m.name)}</b><small>${esc(m.handle)}</small></span>
            <span>${esc(t ? t.name : 'Subscriber')}</span><span>Active · demo</span><span>${date(m.joined)}</span><span></span></div>`; }).join('')}
        </div>
      </section>

      <section class="cst-panel">
        <h3>${ico('qr_code_2')}Where members pay you</h3>
        <p class="hub-none sm">Crypto and UPI go straight from the member to you, so they work without a processor — but only once you publish where. Trending never shows an address or a UPI ID you did not enter here, and never stores a key or a phrase.</p>
        ${payToHTML(cid, may)}
      </section>

      <section class="cst-panel">
        <h3>${ico('payments')}Card, Apple Pay and Google Pay</h3>
        <p class="hub-none">Card checkout in this build is simulated: nothing is charged, and no card or wallet details are collected anywhere. Going live needs a payment processor (for example Stripe with Connect for creator payouts, or Razorpay for UPI in India), a server that verifies payment webhooks before granting access, and a payout account for you. Apple Pay also needs a verified domain, and both device wallets need that merchant account. The subscription records here are shaped the way that server would store them.</p>
        <button class="hub-btn" disabled>${ico('link')}Connect payout account — needs the backend</button>
      </section>`;
  }

  async function setMode(mode) {
    const cid = cidNow();
    if (mode === 'paid' && !(await appConfirm('Require a paid membership to join? Everyone already in the community keeps access as a founding member.', { ok: 'Require membership' }))) return;
    const r = CMB.setEntry(cid, { mode });
    toast(r.error || (mode === 'paid' ? 'New members now choose a paid tier to join' : 'Joining is free again'));
    CST.repaint();
  }
  function saveEntry() {
    const r = CMB.setEntry(cidNow(), { currency: ($('ccr-e-cur') || {}).value, trialDays: ($('ccr-e-trial') || {}).value, yearlyDiscount: ($('ccr-e-disc') || {}).value, grace: ($('ccr-e-grace') || {}).value });
    toast(r.error || 'Membership settings saved');
    CST.repaint();
  }

  function editTier(i) {
    const cid = cidNow();
    const t = i >= 0 ? CMD.tiers(cid)[i] : { name: '', price: 9.99, perks: ['Members-only channels'], role: 'subscriber' };
    if (!t) return;
    const free = t.id === 'free';
    const roles = CMD.roles(cid).filter(r => r.id !== 'owner' && r.level < CMD.myLevel(cid));
    HUB.modal(i >= 0 ? 'Edit ' + t.name : 'New membership tier', `
      <label class="hub-f"><span>Name</span><input id="ccr-t-n" value="${esc(t.name)}" placeholder="Supporter"></label>
      ${free ? '' : `<div class="hub-form-row">
        <label class="hub-f"><span>Monthly price (${esc(CMB.entry(cid).currency)})</span><input type="number" id="ccr-t-p" min="0.5" step="0.5" value="${t.price}"></label>
        <label class="hub-f"><span>Yearly price — blank uses the discount</span><input type="number" id="ccr-t-y" min="0" step="1" value="${t.yearly || ''}"></label>
      </div>
      <div class="hub-form-row">
        <label class="hub-f"><span>Grants role</span><select id="ccr-t-r">${roles.map(r => `<option value="${r.id}"${(t.role || 'subscriber') === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
        <label class="hub-f"><span>Places (0 = unlimited)</span><input type="number" id="ccr-t-l" min="0" value="${t.limit || 0}"></label>
      </div>
      <label class="hub-check"><input type="checkbox" id="ccr-t-h" ${t.highlight ? 'checked' : ''}> Mark as most popular</label>`}
      <label class="hub-f cpx-mt"><span>Benefits — one per line</span><textarea id="ccr-t-b" rows="5">${esc((t.perks || []).join('\n'))}</textarea></label>
      <button class="hub-btn primary wide" onclick="CCR.saveTier(${i})">Save tier</button>`);
  }
  function saveTier(i) {
    const cid = cidNow();
    if (!CMD.can(cid, 'manage')) { toast('Tiers need the manage permission.'); return; }
    const list = CMD.tiers(cid).map(t => ({ ...t }));
    const name = (($('ccr-t-n') || {}).value || '').trim();
    if (!name) { toast('Name the tier.'); return; }
    const t = i >= 0 ? list[i] : { id: 't' + Date.now().toString(36) };
    t.name = name;
    t.perks = (($('ccr-t-b') || {}).value || '').split('\n').map(x => x.trim()).filter(Boolean);
    if (t.id !== 'free') {
      t.price = Math.max(0.5, Math.round((+($('ccr-t-p') || {}).value || 0) * 100) / 100);
      t.yearly = Math.max(0, +($('ccr-t-y') || {}).value || 0) || undefined;
      t.role = ($('ccr-t-r') || {}).value || 'subscriber';
      t.limit = Math.max(0, Math.round(+($('ccr-t-l') || {}).value || 0)) || undefined;
      t.highlight = !!($('ccr-t-h') || {}).checked;
      if (t.highlight) list.forEach(x => { if (x !== t) x.highlight = false; });
    }
    if (i < 0) list.push(t);
    CMD.saveTiers(cid, list);
    HUB.closeModal();
    CST.repaint();
    toast('Tier saved');
  }
  async function delTier(i) {
    const cid = cidNow();
    const list = CMD.tiers(cid).map(t => ({ ...t }));
    const t = list[i];
    if (!t || t.id === 'free') return;
    const e = CMB.entry(cid);
    if (e.mode === 'paid' && CMB.paidTiers(cid).length <= 1) { toast('A membership-required community needs at least one paid tier. Switch joining to free first.'); return; }
    if (CMB.activeTier(cid) === t.id) { toast('You are subscribed to this tier — cancel it first.'); return; }
    if (!(await appConfirm(`Delete ${t.name}? Current members keep it until their period ends.`, { ok: 'Delete', danger: true }))) return;
    list.splice(i, 1);
    CMD.saveTiers(cid, list);
    CST.repaint();
  }
  function addMembersChannel() {
    const cid = cidNow();
    const name = (($('ccr-mo-n') || {}).value || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!name) { toast('Name the channel.'); return; }
    const list = CMD.channels(cid).slice();
    list.push({ id: 'm' + Date.now().toString(36), name, kind: ($('ccr-mo-k') || {}).value || 'text', space: 'Members', topic: 'For paying members.', private: true, role: ($('ccr-mo-r') || {}).value || 'subscriber' });
    CMD.saveChannels(cid, list);
    CST.repaint();
    toast(`#${name} created for members`);
  }

  function setListed(on) {
    const cid = cidNow();
    if (!CMD.can(cid, 'manage')) return;
    CMD.updateCommunity(cid, { listed: !!on });
    toast(on ? 'Listed in Discover' : 'Hidden from Discover');
  }

  return {
    // look
    icon, bannerCSS, hasBanner, crop, look, iconSearch, pickImage,
    // create
    openCreate, w, wset, tier, tierAdd, tierDel, link, goStep, next, submitCreate,
    // branding
    brandingPanel, b, blink, saveBranding, setListed,
    // surfaces
    visible, cardBadge, sideBanner, heroBanner, heroAction, lapseBanner, lockedHTML, aboutTiersHTML, aboutExtra, rulesFor, visit, chooseTier,
    // join & pay
    openJoin, startCheckout, j, jint, joinNext, pay, finish, copyPay, openUpi, savePayTo, clearPayTo, goPaySetup,
    openManage, cycle, cancel, resume, refund, ff,
    // studio
    studioMembers, studioMemberships, setMode, saveEntry, editTier, saveTier, delTier, addMembersChannel,
    TEMPLATES, BANNERS
  };
})();

window.CCR = CCR;

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module now, so its top-level names are private
   to it. Inline onclick= handlers and every other module still look
   them up on the global object, so they are republished here.

   Each one is a thunk because the list is produced by scanning, and
   scanning over-collects — a line inside a template literal can look
   like a declaration. publish() calls each thunk and skips the ones
   that do not resolve, so a phantom costs one caught error and not a
   dead module graph. */
import { publish } from '../globals.js?v=2';
publish('pages/communebrand.js', {
  CCR: () => CCR
});
