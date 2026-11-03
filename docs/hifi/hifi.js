/* Hi-Fi document helpers: line icons, phone nav bars, contents page numbers.
   Runs in Chromium before the page is printed (see build-pdf.js). */
'use strict';

const ICONS = {
  wave: 'M3 10v4M7 7v10M11 4v16M15 8v8M19 6v12M23 11v2',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM21 21l-5-5',
  shorty: 'M7 3h10a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM10 8.5l5.5 3.5-5.5 3.5z',
  chat: 'M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.6A8.5 8.5 0 1 1 21 11.5z',
  groups: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8',
  person: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  apps: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  send: 'M21.5 2.5 10.5 13.5M21.5 2.5l-7 19-4-8-8-4z',
  receive: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  gift: 'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8C10.5 4 7 3.5 6.5 5.5S9.5 8 12 8zM12 8c1.5-4 5-4.5 5.5-2.5S14.5 8 12 8z',
  split: 'M16 3h5v5M21 3l-9 9M8 3H3v5M3 3l9 9v9',
  chart: 'M3 3v18h18M7 15l4-4 3 3 6-6',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9zM10 20.5a2 2 0 0 0 4 0',
  slash: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM14.5 7l-5 10',
  bot: 'M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM12 4v4M9 12.5v1.5M15 12.5v1.5M9.5 17h5',
  lock: 'M5 11h14v10H5zM8 11V7.5a4 4 0 0 1 8 0V11',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  shieldok: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  key: 'M8 16a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM12 12h9M18 12v3M21 12v2',
  coin: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM15 9.2c-.4-1-1.6-1.7-3-1.7-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.5 0 1.3-1.3 2.3-3 2.3-1.5 0-2.7-.7-3.1-1.8M12 5.8v1.7M12 16.5v1.7',
  wallet: 'M3 7a2 2 0 0 1 2-2h12v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16.5 14.5h.01',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2M18 14h2',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
  vote: 'M4 21h16M5 17h14l-1.5-8h-11zM9 12.5l2 2 4-4',
  rocket: 'M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M14 4c3-1.5 6-1 6-1s.5 3-1 6l-7 7-5-5zM9 10H5l-2 3 4 1M14 15v4l-3 2-1-4',
  store: 'M3 9l2-5h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6',
  trophy: 'M8 21h8M12 16v5M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3.5 4M17 6h3a3 3 0 0 1-3.5 4',
  globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18.5h2',
  check: 'M5 12.5l4.5 4.5L20 6.5',
  x: 'M6 6l12 12M18 6 6 18',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z',
  eyeoff: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM3 3l18 18',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  laptop: 'M4 5h16v10H4zM2 19h20',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  layers: 'M12 3 2 8l10 5 10-5zM2 12.5l10 5 10-5M2 17l10 5 10-5',
  chain: 'M3 8h6v6H3zM15 8h6v6h-6zM9 11h6M6 14v4h12v-4M6 8V5h12v3',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  heart: 'M12 20s-7.5-4.6-9.3-9.3A5 5 0 0 1 12 6.3a5 5 0 0 1 9.3 4.4C19.5 15.4 12 20 12 20z',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  camera: 'M4 7h3l2-3h6l2 3h3v13H4zM12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  plus: 'M12 5v14M5 12h14',
  sliders: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  idcard: 'M3 5h18v14H3zM9 9.5a2 2 0 1 0 0 4a2 2 0 0 0 0-4zM6 16.5a3.2 3.2 0 0 1 6 0M14 10h4M14 13.5h3',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 7v5l3.5 2',
  flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  book: 'M3 5h6a3 3 0 0 1 3 2 3 3 0 0 1 3-2h6v14h-6a3 3 0 0 0-3 2 3 3 0 0 0-3-2H3zM12 7v14',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  percent: 'M19 5 5 19M7 5a2 2 0 1 0 0 4a2 2 0 0 0 0-4zM17 15a2 2 0 1 0 0 4a2 2 0 0 0 0-4z',
  learn: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6',
  badge: 'M12 2.5l2.4 1.8 3-.1.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3-.1-2.4 1.8-2.4-1.8-3 .1-.9-2.9-2.4-1.8.9-2.9-.9-2.9 2.4-1.8.9-2.9 3 .1zM8.5 12l2.5 2.5 4.5-5',
  bank: 'M3 10h18L12 4zM5.5 10v8M10 10v8M14 10v8M18.5 10v8M3 20.5h18',
  alert: 'M12 3.5 2.5 20h19zM12 10v4.5M12 17.2h.01',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
  cpu: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  fire: 'M12 22a7 7 0 0 0 7-7c0-4.5-3.5-6.5-4.5-10-1.2 2.4-2.3 3.4-3.4 3.4.2-2.2-.8-4.3-2.6-6.4.1 4.6-4.5 7.7-4.5 13a7 7 0 0 0 8 7z',
  sun: 'M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9zM12 1.5v2M12 20.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1.5 12h2M20.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  translate: 'M4 5h8M8 3v2M6 5c0 4 3 7 6 8M10 5c0 4-3 7-6 8M13 21l4-9 4 9M14.5 18h5',
  scan: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16',
  doc: 'M6 3h9l5 5v13H6zM14 3v6h6M9 13h8M9 17h6',
  hash: 'M5 9h15M4 15h15M10 3 8 21M16 3l-2 18',
  live: 'M12 10a2 2 0 1 0 0 4a2 2 0 0 0 0-4zM7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14',
  note: 'M5 4h14v11l-5 5H5zM14 20v-5h5',
  menu: 'M4 6h16M4 12h16M4 18h16',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  back: 'M15 5l-7 7 7 7',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  refresh: 'M20 11a8 8 0 0 0-14.9-4M4 3.5V7h3.5M4 13a8 8 0 0 0 14.9 4M20 20.5V17h-3.5',
  hand: 'M12 21c-4 0-7-3-7-7V9.5a1.5 1.5 0 0 1 3 0V12M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2 7-5 7',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  play: 'M7 4l13 8-13 8z',
  comment: 'M4 4h16v12H8l-4 4z',
  share: 'M18 3a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM6 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM18 15a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  passkey: 'M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM2 21a7 7 0 0 1 11-5.7M18 13a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5zM18 18v4M18 20h2',
  burn: 'M12 22a7 7 0 0 0 7-7c0-4.5-3.5-6.5-4.5-10-1.2 2.4-2.3 3.4-3.4 3.4.2-2.2-.8-4.3-2.6-6.4.1 4.6-4.5 7.7-4.5 13a7 7 0 0 0 8 7z',
  storage: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  handshake: 'M2 12l4-4 4 2 3-3 4 1 5 4M6 8v6l5 5 2-2M13 17l2 2 2-2-4-4M17 15l2-2'
};

function svg(name) {
  const d = ICONS[name];
  if (!d) { console.error('missing icon', name); return ''; }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

document.querySelectorAll('[data-i]').forEach(el => { el.innerHTML = svg(el.dataset.i); if (!el.classList.contains('i') && el.tagName === 'I') el.classList.add('i'); });

/* The phone's bottom bar, as the app draws it on a phone:
   Home · Search · Shorty · Chat · Community · Profile · More */
const NAV = [['home', 'home', 'Home'], ['search', 'search', 'Search'], ['shorty', 'shorty', 'Shorty'], ['chat', 'chat', 'Chat'],
  ['community', 'groups', 'Community'], ['profile', 'person', 'Profile'], ['more', 'apps', 'More']];
document.querySelectorAll('.pnav[data-on]').forEach(el => {
  const on = el.dataset.on;
  el.innerHTML = NAV.map(([k, ic, l]) => `<div class="${k === on ? 'on' : ''}">${svg(ic)}<span>${l}</span></div>`).join('');
});

/* Status bar and the camera island on every phone. */
document.querySelectorAll('.scr').forEach(el => {
  if (el.querySelector('.sbar')) return;
  const bar = document.createElement('div');
  bar.className = 'sbar';
  bar.innerHTML = '<span>9:41</span><span class="sig"><i style="height:3px"></i><i style="height:4px"></i><i style="height:5px"></i><i style="height:6px"></i>&nbsp;5G&nbsp;<i style="height:5px;width:9px;border:1px solid currentColor;background:none;border-radius:2px"></i></span>';
  el.prepend(bar);
  const isl = document.createElement('div');
  isl.className = 'island';
  el.prepend(isl);
});

/* The HiFi logo inside phone headers: ink letters on light screens,
   white letters on dark ones. */
document.querySelectorAll('.ahdr .w').forEach(el => {
  if (el.querySelector('img')) return;
  const dark = !!el.closest('.scr.dark');
  el.innerHTML = `<img src="${dark ? 'hifi-logo.png' : 'hifi-logo-ink.png'}" alt="HiFi">`;
});

/* Running heads and feet.
   "How HiFi works" (16 pages, supplied as its own PDF) is inserted after
   this document's page INSERT_AT when the two are merged, so every page
   number here counts those pages too. */
const INSERT_AT = Number(document.body.dataset.insertAt || 0);
const INSERT_N = Number(document.body.dataset.insertN || 0);
const pages = [...document.querySelectorAll('.page')];
const finalNo = idx => idx + 1 + (idx >= INSERT_AT ? INSERT_N : 0);
pages.forEach((p, idx) => {
  if (p.dataset.bare !== undefined) return;
  const ph = document.createElement('div');
  ph.className = 'ph';
  const dark = !!p.querySelector('.band');
  if (dark) p.classList.add('dark-head');
  ph.innerHTML = `<b><img src="${dark ? 'hifi-logo.png' : 'hifi-logo-ink.png'}" alt=""><span>— Your Digital Universe</span></b><span>${p.dataset.sec || ''}</span>`;
  p.appendChild(ph);
  const pf = document.createElement('div');
  pf.className = 'pf';
  pf.innerHTML = `<span>Final edition · November 2026</span><span class="n">${finalNo(idx)}</span>`;
  p.appendChild(pf);
});

/* Contents and cross-references: the final page number an anchor sits on. */
document.querySelectorAll('[data-pg], [data-ref]').forEach(el => {
  const id = el.dataset.pg || el.dataset.ref;
  const target = document.getElementById(id);
  if (!target) { el.textContent = '?'; console.error('missing anchor', id); return; }
  el.textContent = String(finalNo(pages.indexOf(target.closest('.page'))));
});

window.__HIFI_READY = true;
