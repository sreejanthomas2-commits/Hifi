/* ╔══════════════════════════════════════════════════════════════════╗
   ║  PROFILE — your photo, cover, details and birthday                ║
   ║                                                                   ║
   ║  · Edit profile page: profile photo (upload, crop, take a photo,  ║
   ║    remove), cover image or style, name, @username, bio, pronouns, ║
   ║    location, website, birthday and who can see it                ║
   ║  · Camera buttons on your profile's photo and cover               ║
   ║  · Your photo shows in the sidebar, header, composer, profile and ║
   ║    on your member cards and messages in Commune Hub               ║
   ║  · Your birthday answers the age check in 13+ and 18+ communities ║
   ║                                                                   ║
   ║  Saved per signed-in account on this device. A live build would   ║
   ║  upload the photo to storage and keep the birthday server-side.   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const PME = (() => {

  const KEY = 'ts_profiles';
  const MIN_AGE = 13;

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const $ = id => document.getElementById(id);
  const ico = n => `<span class="material-symbols-rounded">${n}</span>`;

  const COVERS = {
    classic: ['Classic', 'linear-gradient(135deg, var(--blue), var(--purple), var(--pink))'],
    sunset:  ['Sunset', 'linear-gradient(135deg, #FF7A59, #FF3D8B 55%, #7C5CFF)'],
    ocean:   ['Ocean', 'linear-gradient(135deg, #00C6FB, #005BEA)'],
    forest:  ['Forest', 'linear-gradient(135deg, #0BAB64, #3BB78F)'],
    aurora:  ['Aurora', 'radial-gradient(at 15% 20%, #7C5CFF 0, transparent 50%), radial-gradient(at 85% 10%, #EC6CB9 0, transparent 45%), radial-gradient(at 60% 100%, #38BDF8 0, transparent 50%), #151826'],
    peach:   ['Peach', 'linear-gradient(135deg, #FFD3A5, #FD6585)'],
    night:   ['Night', 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)'],
    graphite:['Graphite', 'linear-gradient(135deg, #3A3F4B, #11141A)']
  };
  const PRONOUNS = ['she/her', 'he/him', 'they/them', 'she/they', 'he/they'];
  const SEE = { private: ['Only me', 'lock'], followers: ['Followers', 'group'], public: ['Everyone', 'public'] };
  const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' }));

  /* ── Images ──────────────────────────────────────────────────────── */
  const isData = s => typeof s === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
  // Sign-in providers hand us an https photo URL; nothing else is accepted.
  const isRemote = s => typeof s === 'string' && s.length < 2048 && /^https:\/\/[^\s"'()\\<>]+$/.test(s);
  const okPhoto = s => isData(s) || isRemote(s);
  // Single quotes: these also land inside double-quoted style attributes.
  const cssUrl = s => `url('${s}')`;

  /* ── Birthday ────────────────────────────────────────────────────── */
  function parseDob(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    return makeDate(+m[1], +m[2], +m[3]);
  }
  function makeDate(y, mo, d) {
    if (!y || !mo || !d) return null;
    const t = new Date(y, mo - 1, d);
    return (t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d) ? t : null;
  }
  const iso = t => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  function ageOn(dob, now) {
    now = now || new Date();
    let a = now.getFullYear() - dob.getFullYear();
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) a--;
    return a;
  }
  const isBirthday = (dob, now) => { now = now || new Date(); return dob.getMonth() === now.getMonth() && dob.getDate() === now.getDate(); };
  function daysToBirthday(dob) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
    if (next < today) next = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
    return Math.round((next - today) / 86400000);
  }
  const daysIn = (mo, y) => new Date(y || 2000, mo || 1, 0).getDate();
  const bdayText = (dob, year) => dob.toLocaleDateString(undefined, year ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' });

  /* ── Account and storage ─────────────────────────────────────────── */
  let store = read();
  function read() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
  }
  function write() { try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch (e) { return false; } }

  const user = () => (typeof S !== 'undefined' && S.user) ? S.user : null;
  // Only a real sign-in has a uid; guests can look but not save.
  const signedIn = () => { const u = user(); return !!(u && u.uid && u.fname !== 'Guest'); };
  const acct = () => signedIn() ? 'u:' + user().uid : null;
  const record = () => { const k = acct(); return k ? store[k] || null : null; };
  const FIELDS = ['fname', 'lname', 'handle', 'bio', 'pronouns', 'location', 'link', 'cover', 'coverPreset', 'dob', 'dobShow', 'dobYear'];
  const hide = (o, k, v) => Object.defineProperty(o, k, { value: v, writable: true, configurable: true, enumerable: false });

  /* Sign-in rebuilds S.user from the provider each time, so the saved
     profile is laid over it — once per account and save. */
  function apply() {
    const u = user();
    if (!u || !signedIn()) return;
    if (!('providerPhoto' in u)) hide(u, 'providerPhoto', isRemote(u.avatar) ? u.avatar : null);
    const r = record();
    if (!r) return;
    const stamp = acct() + ':' + (r.updated || 0);
    if (u.__pme === stamp) return;
    FIELDS.forEach(f => { if (f in r) u[f] = r[f]; });
    if ('avatar' in r) u.avatar = okPhoto(r.avatar) ? r.avatar : null;
    hide(u, '__pme', stamp);
  }

  function photo() {
    const u = user();
    if (!u || !signedIn() || (typeof S !== 'undefined' && S.anonymousMode)) return '';
    return okPhoto(u.avatar) ? u.avatar : '';
  }
  const isMe = handle => { const u = user(); return !!(handle && u && photo() && handle === u.handle); };
  function age() {
    const u = user();
    if (!signedIn() || !u.dob) return null;
    const dob = parseDob(u.dob);
    return dob ? ageOn(dob) : null;
  }

  /* ── Painting the avatar slots ───────────────────────────────────── */
  const SLOTS = ['sidebar-av', 'header-av', 'composer-av', 'profile-av'];
  function paint() {
    const src = photo();
    SLOTS.forEach(id => {
      const el = $(id);
      if (!el) return;
      if (src) {
        el.textContent = '';
        el.style.backgroundImage = cssUrl(src);
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.backgroundRepeat = 'no-repeat';
        el.classList.add('pme-photo');
      } else if (el.classList.contains('pme-photo')) {
        el.classList.remove('pme-photo');
        el.style.backgroundImage = '';
        if (!el.textContent.trim() && id !== 'sidebar-av') {
          const u = user();
          el.textContent = signedIn() ? initials(u) : 'AV';
        }
      }
    });
    const root = document.documentElement;
    root.style.setProperty('--pme-photo', src ? cssUrl(src) : 'none');
    root.classList.toggle('pme-has-photo', !!src);
  }
  const initials = o => `${((o && o.fname) || '?').trim().charAt(0)}${((o && o.lname) || '').trim().charAt(0)}`.toUpperCase() || '?';

  function coverCSS(o) {
    if (o && isData(o.cover)) return `${cssUrl(o.cover)} center / cover no-repeat`;
    const k = o && COVERS[o.coverPreset] ? o.coverPreset : 'classic';
    return COVERS[k][1];
  }

  /* ── Your profile page: camera buttons, cover, birthday, pronouns ── */
  function paintProfile() {
    const pane = $('pane-profile');
    if (!pane) return;
    const u = user() || {};
    const me = signedIn();

    const cov = pane.querySelector('.profile-cover-banner');
    if (cov) {
      if (cov.dataset.pmeBase == null) cov.dataset.pmeBase = cov.style.background;
      const custom = me && (isData(u.cover) || (u.coverPreset && u.coverPreset !== 'classic' && COVERS[u.coverPreset]));
      cov.style.background = custom ? coverCSS(u) : cov.dataset.pmeBase;
      if (!$('pme-cover-btn')) cov.insertAdjacentHTML('beforeend',
        `<button type="button" id="pme-cover-btn" class="pme-cover-btn" onclick="PME.quick('cover')" title="Change cover">${ico('photo_camera')}<span>Edit cover</span></button>`);
    }

    const av = $('profile-av');
    if (av && !(av.parentElement && av.parentElement.classList.contains('pme-avwrap'))) {
      const wrap = document.createElement('div');
      wrap.className = 'pme-avwrap';
      wrap.style.marginTop = av.style.marginTop || '0';
      av.style.marginTop = '0';
      av.parentNode.insertBefore(wrap, av);
      wrap.appendChild(av);
      wrap.insertAdjacentHTML('beforeend',
        `<button type="button" class="pme-avcam" onclick="PME.quick('avatar')" title="Change profile photo" aria-label="Change profile photo">${ico('photo_camera')}</button>`);
    }

    const handleEl = $('profile-handle');
    if (handleEl) {
      let pr = $('pme-pron');
      if (me && u.pronouns) {
        if (!pr) { handleEl.insertAdjacentHTML('afterend', '<span class="pme-metaitem" id="pme-pron"></span>'); pr = $('pme-pron'); }
        pr.innerHTML = `<span>·</span><span>${esc(u.pronouns)}</span>`;
      } else if (pr) pr.remove();
    }

    const locWrap = $('profile-location-wrap');
    const meta = locWrap && locWrap.parentElement;
    if (meta) {
      let b = $('pme-bday');
      const dob = me ? parseDob(u.dob) : null;
      if (dob) {
        if (!b) { meta.insertAdjacentHTML('beforeend', '<span class="pme-metaitem" id="pme-bday"></span>'); b = $('pme-bday'); }
        const see = SEE[u.dobShow] || SEE.private;
        b.innerHTML = `<span>·</span><span class="pme-bday${isBirthday(dob) ? ' today' : ''}" title="Your birthday is visible to ${see[0].toLowerCase()}">${ico(isBirthday(dob) ? 'celebration' : 'cake')}${isBirthday(dob) ? 'Happy birthday!' : 'Birthday ' + esc(bdayText(dob, !!u.dobYear))}${ico(see[1])}</span>`;
      } else if (b) b.remove();
    }

    const link = $('profile-link');
    if (link) {
      if (me && cleanLink(u.link)) { link.href = u.link; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      else { link.setAttribute('href', '#'); link.removeAttribute('target'); }
    }
  }

  /* One hidden file input serves every picker on the page. */
  function fileInput(camera, onFile) {
    let inp = $('pme-file');
    if (inp) inp.remove();
    inp = document.createElement('input');
    inp.type = 'file';
    inp.id = 'pme-file';
    inp.hidden = true;
    inp.accept = camera ? 'image/*' : 'image/png,image/jpeg,image/webp,image/gif';
    if (camera) inp.setAttribute('capture', 'user');
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) onFile(f); });
    document.body.appendChild(inp);
    inp.click();
  }

  function cropImage(file, cover) {
    if (!(window.CCR && CCR.crop)) { toast('The photo editor is not available right now.'); return Promise.resolve(null); }
    return CCR.crop(file, cover ? 'banner' : 'avatar', '#7C5CFF', cover
      ? { title: 'Position your cover', hint: 'Drag to position. Shown across the top of your profile.', ok: 'Use this cover', spec: { w: 1500, h: 500, max: 380000 } }
      : { title: 'Position your profile photo', hint: 'Drag to position. Shown as a circle.', ok: 'Use this photo', round: true, spec: { w: 400, h: 400, max: 110000 } });
  }

  /* From the profile page: pick, crop and save straight away. */
  function quick(kind) {
    if (!signedIn()) { toast('Sign in to add a profile photo.'); signIn(); return; }
    fileInput(false, async file => {
      const data = await cropImage(file, kind === 'cover');
      if (!data) return;
      const res = commit(kind === 'cover' ? { cover: data } : { avatar: data });
      if (res) toast(res === 'cover' ? 'Your cover was too large to keep on this device.' : kind === 'cover' ? 'Cover updated' : 'Profile photo updated');
    });
  }

  function snapshotUser(u) {
    const o = {};
    ['fname', 'lname', 'handle', 'bio'].forEach(f => { if (u[f] != null) o[f] = u[f]; });
    return o;
  }

  function commit(patch) {
    if (!signedIn()) { signIn(); return false; }
    const k = acct();
    const u = user();
    const prev = store[k] ? { ...store[k] } : null;
    const rec = { ...(store[k] || snapshotUser(u)), ...patch, updated: Date.now() };
    store[k] = rec;
    let note = true;
    if (!write()) {
      // Over the storage quota: keep everything but the cover image.
      if (rec.cover) { rec.cover = ''; note = 'cover'; }
      if (!write()) {
        if (prev) store[k] = prev; else delete store[k];
        write();
        toast('This device is out of storage space, so the change was not saved. Try a smaller image.');
        return false;
      }
    }
    const from = u.handle;
    apply();
    if (from && rec.handle && from !== rec.handle) moveHandle(from, rec.handle);
    refresh();
    return note;
  }

  /* Communities you created record you as owner by @username. */
  function moveHandle(from, to) {
    if (typeof CMD === 'undefined') return;
    try {
      CMD.all().filter(c => c.mine && !c.override && c.owner === from).forEach(c => CMD.updateCommunity(c.id, { owner: to }));
    } catch (e) { /* the profile is saved either way */ }
  }

  function refresh() {
    if (typeof updateUserUI === 'function') updateUserUI(); else { apply(); paint(); paintProfile(); }
    if ($('pane-profile') && typeof syncProfileIdentity === 'function') syncProfileIdentity();
    paintProfile();
    const acc = $('settings-account');
    if (acc) acc.innerHTML = settingsCardHTML();
  }

  function signIn() { if (typeof openAuthModal === 'function') openAuthModal(); }

  /* ══════════════════════════════════════════════════════════════════
     Edit profile page
     ══════════════════════════════════════════════════════════════════ */

  let P = null;
  const touch = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  function draftFrom() {
    const u = user() || {};
    const me = signedIn();
    const dob = me ? parseDob(u.dob) : null;
    const pron = me ? String(u.pronouns || '') : '';
    return {
      fname: me ? u.fname || '' : '', lname: me ? u.lname || '' : '', handle: me ? String(u.handle || '').replace(/^@/, '') : '',
      bio: me ? u.bio || '' : '', location: me ? u.location || '' : '', link: me ? u.link || '' : '',
      pronSel: !pron ? '' : PRONOUNS.indexOf(pron) > -1 ? pron : 'custom', pronCustom: PRONOUNS.indexOf(pron) > -1 ? '' : pron,
      avatar: me && okPhoto(u.avatar) ? u.avatar : '', cover: me && isData(u.cover) ? u.cover : '',
      coverPreset: me && COVERS[u.coverPreset] ? u.coverPreset : 'classic',
      dd: dob ? dob.getDate() : '', mm: dob ? dob.getMonth() + 1 : '', yy: dob ? dob.getFullYear() : '',
      dobShow: me && SEE[u.dobShow] ? u.dobShow : 'private', dobYear: me ? !!u.dobYear : false
    };
  }

  function open(focus) {
    P = { draft: draftFrom(), tried: false, guest: !signedIn() };
    P.base = JSON.stringify(P.draft);
    P.baseHandle = P.draft.handle;
    if (typeof navigateTo === 'function') navigateTo('editprofile');
    render();
    const pane = $('pane-editprofile');
    if (pane) pane.scrollTop = 0;
    if (focus) { const f = $('pme-f-' + focus); if (f) f.scrollIntoView({ block: 'center' }); }
  }

  const dirty = () => !!P && JSON.stringify(P.draft) !== P.base;

  async function close() {
    if (dirty() && !(await appConfirm('Discard the changes to your profile?', { ok: 'Discard', danger: true }))) return;
    P = null;
    if (typeof navigateTo === 'function') navigateTo('profile');
  }

  function render() {
    const host = $('pme-page');
    if (!host || !P) return;
    const pane = $('pane-editprofile');
    const top = pane ? pane.scrollTop : 0;
    host.innerHTML = pageHTML();
    if (pane) pane.scrollTop = top;
    if (P.tried) paintErrors();
  }

  function pageHTML() {
    const me = signedIn();
    return `
      <header class="pme-top">
        <button type="button" class="pme-iconbtn" onclick="PME.close()" title="Back to profile" aria-label="Back to profile">${ico('arrow_back')}</button>
        <div class="pme-top-t"><h1>Edit profile</h1><span id="pme-state">${stateText()}</span></div>
        <div class="pme-top-a">
          <button type="button" class="btn btn-ghost btn-sm" onclick="PME.close()">Cancel</button>
          <button type="button" class="btn btn-primary btn-sm" id="pme-save" onclick="PME.save()">${ico('check')}Save</button>
        </div>
      </header>
      ${me ? '' : `
      <div class="pme-guest">${ico('account_circle')}
        <div><b>You are browsing as a guest</b><span>Sign in to save a profile photo and birthday to your account. What you enter here is kept until you leave this page.</span></div>
        <button type="button" class="btn btn-primary btn-sm" onclick="PME.signIn()">Sign in</button>
      </div>`}
      <div class="pme-grid">
        <div class="pme-main">
          ${photoCardHTML()}
          ${infoCardHTML()}
          ${birthdayCardHTML()}
        </div>
        <aside class="pme-side">
          <div class="pme-sticky">
            <div class="pme-prevlbl">${ico('visibility')}Preview — how other people see you</div>
            <div id="pme-prev">${previewHTML()}</div>
            <div class="card pme-privacy">${ico('shield')}<p>Your photo and details are saved to your account on this device. Your birthday stays private unless you choose otherwise; Trending uses your age for the checks in 13+ and 18+ communities.</p></div>
          </div>
        </aside>
      </div>`;
  }

  function stateText() {
    if (!P) return '';
    return dirty() ? 'Unsaved changes' : signedIn() ? 'Everything is saved' : 'Guest — sign in to save';
  }

  function photoCardHTML() {
    const d = P.draft;
    const u = user() || {};
    const provider = signedIn() && isRemote(u.providerPhoto) ? u.providerPhoto : '';
    return `
      <section class="card pme-card pme-idcard">
        <div class="pme-cover" style="background:${coverCSS(d)}">
          <div class="pme-cover-a">
            <button type="button" class="pme-chipbtn" onclick="PME.pick('cover')">${ico('wallpaper')}${d.cover ? 'Change cover' : 'Upload cover'}</button>
            ${d.cover ? `<button type="button" class="pme-chipbtn" onclick="PME.set('cover','',true)">${ico('delete')}Remove</button>` : ''}
          </div>
        </div>
        <div class="pme-idrow">
          <div class="pme-av"${d.avatar ? ` style="background-image:${cssUrl(d.avatar)}"` : ''}>
            ${d.avatar ? '' : d.fname || signedIn() ? `<span>${esc(initials(d.fname ? d : u))}</span>` : ico('person')}
            <button type="button" class="pme-cam" onclick="PME.pick('avatar')" title="Change profile photo" aria-label="Change profile photo">${ico('photo_camera')}</button>
          </div>
          <div class="pme-idtext">
            <h3>Profile photo</h3>
            <p>A clear photo helps people recognise you. PNG, JPG, WebP or GIF up to 15 MB — you can crop it next.</p>
            <div class="pme-acts">
              <button type="button" class="btn btn-primary btn-sm" onclick="PME.pick('avatar')">${ico('add_a_photo')}${d.avatar ? 'Change photo' : 'Upload photo'}</button>
              ${touch() ? `<button type="button" class="btn btn-ghost btn-sm" onclick="PME.pick('camera')">${ico('photo_camera')}Take a photo</button>` : ''}
              ${provider && d.avatar !== provider ? `<button type="button" class="btn btn-ghost btn-sm" onclick="PME.useProvider()">${ico('account_circle')}Use my sign-in photo</button>` : ''}
              ${d.avatar ? `<button type="button" class="btn btn-ghost btn-sm pme-danger" onclick="PME.set('avatar','',true)">${ico('delete')}Remove photo</button>` : ''}
            </div>
          </div>
        </div>
        <div class="pme-covers">
          <span class="pme-lbl">Cover style${d.cover ? ' <em>— remove the cover image to use a style</em>' : ''}</span>
          <div class="pme-coverrow">${Object.keys(COVERS).map(k => `<button type="button" class="pme-cv${!d.cover && d.coverPreset === k ? ' on' : ''}" style="background:${COVERS[k][1]}"
            onclick="PME.preset('${k}')" aria-pressed="${!d.cover && d.coverPreset === k}"><span>${COVERS[k][0]}</span></button>`).join('')}</div>
        </div>
      </section>`;
  }

  const field = (key, label, input, extra) =>
    `<label class="pme-f" id="pme-f-${key}"><span class="pme-lbl">${label}${extra || ''}</span>${input}<b class="pme-err" id="pme-err-${key}"></b></label>`;

  function infoCardHTML() {
    const d = P.draft;
    return `
      <section class="card pme-card">
        <h3 class="pme-h3">${ico('badge')}Basic info</h3>
        <div class="pme-row2">
          ${field('fname', 'First name', `<input class="input" maxlength="30" value="${esc(d.fname)}" autocomplete="given-name" oninput="PME.set('fname',this.value)">`)}
          ${field('lname', 'Last name', `<input class="input" maxlength="30" value="${esc(d.lname)}" autocomplete="family-name" oninput="PME.set('lname',this.value)">`)}
        </div>
        ${field('handle', 'Username', `<div class="pme-at"><i>@</i><input class="input" maxlength="30" value="${esc(d.handle)}" autocomplete="username" spellcheck="false" autocapitalize="off" oninput="PME.set('handle',this.value,false,this)"></div>`,
          ` <em id="pme-hint-handle">${handleHint()}</em>`)}
        ${field('bio', 'Bio', `<textarea class="input" rows="3" maxlength="160" placeholder="A line or two about you" oninput="PME.set('bio',this.value)">${esc(d.bio)}</textarea>`,
          ` <em><span id="pme-bio-n">${d.bio.length}</span>/160</em>`)}
        <div class="pme-row2">
          ${field('pronouns', 'Pronouns', `<select class="input" onchange="PME.set('pronSel',this.value,true)">
              <option value="">Don't show</option>${PRONOUNS.map(p => `<option${d.pronSel === p ? ' selected' : ''}>${p}</option>`).join('')}
              <option value="custom"${d.pronSel === 'custom' ? ' selected' : ''}>Write my own</option></select>
            ${d.pronSel === 'custom' ? `<input class="input pme-mt6" maxlength="20" placeholder="Your pronouns" value="${esc(d.pronCustom)}" oninput="PME.set('pronCustom',this.value)">` : ''}`)}
          ${field('location', 'Location', `<input class="input" maxlength="40" value="${esc(d.location)}" placeholder="City, country" autocomplete="address-level2" oninput="PME.set('location',this.value)">`)}
        </div>
        ${field('link', 'Website', `<input class="input" type="url" maxlength="120" value="${esc(d.link)}" placeholder="https://yoursite.com" oninput="PME.set('link',this.value)">`)}
      </section>`;
  }

  function handleHint() {
    const h = P.draft.handle.trim();
    if (h === P.baseHandle) return 'How people find and mention you';
    if (!/^[A-Za-z0-9_.]{3,30}$/.test(h)) return '3–30 letters, numbers, _ or .';
    return 'Messages you already sent keep the old one';
  }

  function birthdayCardHTML() {
    const d = P.draft;
    const y = new Date().getFullYear();
    const maxDay = daysIn(+d.mm || 1, +d.yy || 2000);
    const has = d.dd || d.mm || d.yy;
    return `
      <section class="card pme-card">
        <h3 class="pme-h3">${ico('cake')}Birthday</h3>
        <p class="pme-sub">Add your date of birth. You choose who can see it, and only your age is used for age-restricted communities.</p>
        <div class="pme-dob" id="pme-f-dob">
          <label class="pme-f"><span class="pme-lbl">Day</span><select class="input" onchange="PME.dob('dd',this.value)">
            <option value="">Day</option>${Array.from({ length: d.mm ? maxDay : 31 }, (_, i) => `<option${+d.dd === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></label>
          <label class="pme-f"><span class="pme-lbl">Month</span><select class="input" onchange="PME.dob('mm',this.value)">
            <option value="">Month</option>${MONTHS.map((m, i) => `<option value="${i + 1}"${+d.mm === i + 1 ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
          <label class="pme-f"><span class="pme-lbl">Year</span><select class="input" onchange="PME.dob('yy',this.value)">
            <option value="">Year</option>${Array.from({ length: 121 }, (_, i) => y - i).map(v => `<option${+d.yy === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <b class="pme-err" id="pme-err-dob"></b>
        <p class="pme-age" id="pme-dob-age">${ageLine()}</p>

        <span class="pme-lbl">Who can see your birthday</span>
        <div class="pme-see" role="radiogroup">${Object.keys(SEE).map(k => `<button type="button" role="radio" class="pme-seeb${d.dobShow === k ? ' on' : ''}" aria-checked="${d.dobShow === k}"
          onclick="PME.set('dobShow','${k}',true)">${ico(SEE[k][1])}<b>${SEE[k][0]}</b></button>`).join('')}</div>
        <label class="pme-check"><input type="checkbox" ${d.dobYear ? 'checked' : ''} onchange="PME.set('dobYear',this.checked)"> Show the year too, not just the day and month</label>
        ${has ? `<button type="button" class="btn btn-ghost btn-sm pme-danger pme-mt" onclick="PME.clearDob()">${ico('delete')}Remove birthday</button>` : ''}
      </section>`;
  }

  function ageLine() {
    const d = P.draft;
    const dob = makeDate(+d.yy, +d.mm, +d.dd);
    if (!dob) return (d.dd || d.mm || d.yy) ? `${ico('edit_calendar')}Choose a day, month and year.` : `${ico('event_busy')}No birthday on your profile.`;
    const a = ageOn(dob);
    if (dob > new Date() || a < 0) return '';
    if (isBirthday(dob)) return `${ico('celebration')}Happy birthday — you are ${a} today!`;
    const n = daysToBirthday(dob);
    return `${ico('cake')}You are ${a} · next birthday in ${n} day${n === 1 ? '' : 's'}`;
  }

  function pronounsOf(d) { return d.pronSel === 'custom' ? d.pronCustom.trim() : d.pronSel; }

  function cleanLink(s) {
    let v = String(s || '').trim();
    if (!v) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
    return /^https:\/\/[^\s"'<>\\]+\.[^\s"'<>\\]{2,}$/i.test(v) && v.length <= 128 ? v : '';
  }

  function previewHTML() {
    const d = P.draft;
    const u = user() || {};
    const name = `${d.fname} ${d.lname}`.trim() || 'Your name';
    const pron = pronounsOf(d);
    const dob = makeDate(+d.yy, +d.mm, +d.dd);
    const link = cleanLink(d.link);
    const shown = dob && d.dobShow === 'public';
    return `
      <article class="card pme-pcard">
        <div class="pme-pcover" style="background:${coverCSS(d)}"></div>
        <div class="pme-pbody">
          <div class="pme-pav"${d.avatar ? ` style="background-image:${cssUrl(d.avatar)}"` : ''}>${d.avatar ? '' : d.fname || signedIn() ? esc(initials(d.fname ? d : u)) : ico('person')}</div>
          <b class="pme-pname">${esc(name)}</b>
          <span class="pme-phandle">@${esc(d.handle || 'username')}${pron ? ` · ${esc(pron)}` : ''}</span>
          ${d.bio.trim() ? `<p>${esc(d.bio)}</p>` : '<p class="pme-muted">Your bio appears here.</p>'}
          <div class="pme-pmeta">
            ${d.location.trim() ? `<span>${ico('location_on')}${esc(d.location)}</span>` : ''}
            ${link ? `<span>${ico('link')}${esc(link.replace(/^https:\/\//, '').replace(/\/$/, ''))}</span>` : ''}
            ${shown ? `<span>${ico('cake')}${esc(bdayText(dob, d.dobYear))}</span>` : ''}
          </div>
          ${dob && !shown ? `<span class="pme-pnote">${ico(SEE[d.dobShow][1])}Birthday visible to ${d.dobShow === 'followers' ? 'your followers' : 'only you'}</span>` : ''}
        </div>
      </article>`;
  }

  /* ── Editing ─────────────────────────────────────────────────────── */
  function set(key, value, full, el) {
    if (!P) return;
    const d = P.draft;
    if (key === 'handle') {
      value = String(value).replace(/^@+/, '').replace(/\s+/g, '');
      if (el && el.value !== value) el.value = value;
    }
    if (key === 'avatar' && value && !okPhoto(value)) return;
    if (key === 'cover' && value && !isData(value)) return;
    d[key] = value;
    if (full) { render(); return; }
    const prev = $('pme-prev');
    if (prev) prev.innerHTML = previewHTML();
    if (key === 'bio') { const n = $('pme-bio-n'); if (n) n.textContent = d.bio.length; }
    if (key === 'handle') { const h = $('pme-hint-handle'); if (h) h.textContent = handleHint(); }
    paintState();
  }
  function paintState() {
    const st = $('pme-state');
    if (st) { st.textContent = stateText(); st.classList.toggle('dirty', dirty()); }
    if (P && P.tried) paintErrors();
  }
  function preset(k) { if (!P || !COVERS[k]) return; P.draft.coverPreset = k; P.draft.cover = ''; render(); }
  function useProvider() { const u = user(); if (P && u && isRemote(u.providerPhoto)) set('avatar', u.providerPhoto, true); }

  function pick(kind) {
    if (!P) return;
    fileInput(kind === 'camera', async file => {
      const data = await cropImage(file, kind === 'cover');
      if (!data || !P) return;
      set(kind === 'cover' ? 'cover' : 'avatar', data, true);
    });
  }

  function dob(part, v) {
    if (!P) return;
    const d = P.draft;
    d[part] = v ? +v : '';
    if (d.dd && d.mm && d.dd > daysIn(+d.mm, +d.yy || 2000)) d.dd = '';
    render();
  }
  function clearDob() { if (!P) return; Object.assign(P.draft, { dd: '', mm: '', yy: '' }); render(); }

  function validate(d) {
    const e = {};
    const fn = d.fname.trim();
    if (!fn) e.fname = 'Add your first name.';
    else if (/^guest$/i.test(fn)) e.fname = 'Choose a name other than “Guest”.';
    const h = d.handle.trim();
    if (!h) e.handle = 'Add a username.';
    else if (h !== P.baseHandle) {
      if (!/^[A-Za-z0-9_.]{3,30}$/.test(h)) e.handle = 'Use 3–30 letters, numbers, underscores or periods.';
      else if (/^\.|\.$|\.\./.test(h)) e.handle = 'A username can’t start or end with a period, or have two in a row.';
    }
    if (d.bio.length > 160) e.bio = 'Keep your bio to 160 characters.';
    if (d.pronSel === 'custom' && !d.pronCustom.trim()) e.pronouns = 'Write your pronouns, or choose “Don’t show”.';
    if (d.link.trim() && !cleanLink(d.link)) e.link = 'Enter a secure web address, like https://yoursite.com';
    if (d.dd || d.mm || d.yy) {
      const t = makeDate(+d.yy, +d.mm, +d.dd);
      if (!(d.dd && d.mm && d.yy)) e.dob = 'Choose a day, month and year — or remove your birthday.';
      else if (!t) e.dob = 'That date does not exist.';
      else if (t > new Date()) e.dob = 'Your birthday can’t be in the future.';
      else if (ageOn(t) < MIN_AGE) e.dob = `You need to be at least ${MIN_AGE} to have a Trending account.`;
      else if (ageOn(t) > 120) e.dob = 'Check the year.';
    }
    return e;
  }

  function paintErrors(errs) {
    errs = errs || validate(P.draft);
    ['fname', 'lname', 'handle', 'bio', 'pronouns', 'location', 'link', 'dob'].forEach(k => {
      const b = $('pme-err-' + k);
      if (b) b.textContent = errs[k] || '';
      const f = $('pme-f-' + k);
      if (f) f.classList.toggle('bad', !!errs[k]);
    });
    return errs;
  }

  function save() {
    if (!P) return;
    if (!signedIn()) { toast('Sign in to save your profile — what you typed stays here.'); signIn(); return; }
    P.tried = true;
    const errs = paintErrors();
    const first = Object.keys(errs)[0];
    if (first) {
      toast(errs[first]);
      const f = $('pme-f-' + first);
      if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const d = P.draft;
    const t = makeDate(+d.yy, +d.mm, +d.dd);
    const res = commit({
      fname: d.fname.trim(), lname: d.lname.trim(), handle: '@' + d.handle.trim(), bio: d.bio.trim(),
      pronouns: pronounsOf(d), location: d.location.trim(), link: cleanLink(d.link),
      avatar: okPhoto(d.avatar) ? d.avatar : '', cover: isData(d.cover) ? d.cover : '', coverPreset: d.coverPreset,
      dob: t ? iso(t) : '', dobShow: d.dobShow, dobYear: !!d.dobYear
    });
    if (!res) return;
    P = null;
    if (typeof navigateTo === 'function') navigateTo('profile');
    toast(res === 'cover' ? 'Profile saved — the cover image was too large to keep on this device, so it was left out.' : 'Profile saved');
  }

  /* ── Settings → Profile ──────────────────────────────────────────── */
  function settingsCardHTML() {
    const u = user() || {};
    const me = signedIn();
    const src = photo();
    return `
      <div class="card set-card">
        <h3 class="set-h3">${ico('account_circle')}Profile</h3>
        <p class="set-sub">Photo, cover, name, username, bio and birthday.</p>
        <div class="pme-setrow">
          <span class="pme-setav"${src ? ` style="background-image:${cssUrl(src)}"` : ''}>${src ? '' : esc(me ? initials(u) : '?')}</span>
          <div><b>${esc(me ? `${u.fname} ${u.lname || ''}`.trim() : 'Guest')}</b><span>${esc(me ? u.handle : 'Sign in to set up your profile')}</span></div>
          <button type="button" class="btn btn-primary btn-sm" onclick="PME.open()">${ico('edit')}Edit profile</button>
        </div>
      </div>`;
  }

  /* ── Wiring ──────────────────────────────────────────────────────── */
  const base = window.updateUserUI;
  window.updateUserUI = function () {
    apply();
    const out = typeof base === 'function' ? base.apply(this, arguments) : undefined;
    paint();
    paintProfile();
    // Signing in from the edit page keeps what the guest typed.
    if (P && P.guest && signedIn()) {
      const u = user();
      P.guest = false;
      if (!P.draft.fname) P.draft.fname = u.fname || '';
      if (!P.draft.lname) P.draft.lname = u.lname || '';
      if (!P.draft.handle) P.draft.handle = String(u.handle || '').replace(/^@/, '');
      P.baseHandle = String(u.handle || '').replace(/^@/, '');
      render();
    }
    return out;
  };

  window.getEditprofileTemplate = () => '<section id="pane-editprofile" class="pane"><div class="pme-page" id="pme-page"></div></section>';

  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    store = read();
    const u = user();
    if (u) hide(u, '__pme', '');
    refresh();
  });

  return {
    open, close, save, set, preset, pick, dob, clearDob, useProvider, quick, signIn,
    settingsCardHTML, paintProfile,
    age, isMe, photo, parseDob, ageOn
  };
})();

window.PME = PME;

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
publish('features/profileme.js', {
  PME: () => PME
});
