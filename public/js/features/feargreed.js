/* ╔══════════════════════════════════════════════════════════════════╗
   ║  CRYPTO FEAR & GREED INDEX                                       ║
   ║                                                                  ║
   ║  Live sentiment gauge from alternative.me's public API — the     ║
   ║  same 0–100 index quoted across the market. 0 is Extreme Fear,   ║
   ║  100 is Extreme Greed.                                           ║
   ║                                                                  ║
   ║  Drawn as a car speedometer: a 240° dial with band arcs, milled  ║
   ║  ticks, a tapered needle on a metal hub and a glowing trace of   ║
   ║  how far round the reading sits. The needle doesn't jump — it    ║
   ║  sweeps once on ignition (0 → 100 → today) and afterwards        ║
   ║  springs between readings, with the number counting along and    ║
   ║  the colour changing as it crosses each band.                    ║
   ║                                                                  ║
   ║  Pulls today's reading plus 30 days of history for the trend     ║
   ║  strip. The index only recalculates once a day, so this refreshes║
   ║  hourly rather than riding the 30s price poll.                   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const FGI = (() => {

  const API = 'https://api.alternative.me/fng/?limit=30';
  const REFRESH_MS = 60 * 60 * 1000;         // hourly; the index moves daily

  /* Bands match the published classification, so the label and colour
     always agree with the number. */
  const BANDS = [
    { max: 24,  label: 'Extreme Fear',  color: '#e53935', note: 'Investors are anxious — historically a zone of opportunity.' },
    { max: 44,  label: 'Fear',          color: '#FB8C00', note: 'Caution dominates. Selling pressure outweighs buying.' },
    { max: 55,  label: 'Neutral',       color: '#FDD835', note: 'The market is undecided; sentiment is balanced.' },
    { max: 74,  label: 'Greed',         color: '#7CB342', note: 'Buyers are confident. Momentum is building.' },
    { max: 100, label: 'Extreme Greed', color: '#43A047', note: 'Euphoria — historically a zone where corrections start.' }
  ];

  /* A band colour reads fine as a 17px arc on any background, but the
     lighter bands drop below 3:1 as small text on white. Darken them for
     the light theme; the hue stays put. */
  function ink(hex) {
    if (document.documentElement.getAttribute('data-theme') !== 'light') return hex;
    const n = parseInt(String(hex).slice(1), 16);
    const mix = c => Math.round(c * 0.55 + 11 * 0.45).toString(16).padStart(2, '0');
    return '#' + mix((n >> 16) & 255) + mix((n >> 8) & 255) + mix(n & 255);
  }

  /* Dial geometry. The sweep runs 210° → -30°, the way a rev counter
     does: bottom-left, over the top, down to bottom-right. */
  const D = { cx: 160, cy: 172, r: 120, w: 17, from: 210, sweep: 240, trail: 104 };

  let current = null;      // { value, label, updated }
  let history = [];        // [{ value, t }] oldest → newest
  let failed = false;

  let shown = 0;           // where the needle actually is right now
  let raf = null;
  let ignited = false;     // the 0 → 100 → reading sweep only happens once

  const band = v => BANDS.find(b => v <= b.max) || BANDS[BANDS.length - 1];
  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s));
  const clamp = v => Math.max(0, Math.min(100, Number(v) || 0));

  const angleOf = v => D.from - (clamp(v) / 100) * D.sweep;
  const polar = (a, r, cx, cy) => [
    (cx === undefined ? D.cx : cx) + Math.cos(a * Math.PI / 180) * r,
    (cy === undefined ? D.cy : cy) - Math.sin(a * Math.PI / 180) * r
  ];

  /* An arc between two values on the dial, at a given radius. */
  function arc(v0, v1, r, cx, cy) {
    const a0 = angleOf(v0), a1 = angleOf(v1);
    const [x0, y0] = polar(a0, r, cx, cy);
    const [x1, y1] = polar(a1, r, cx, cy);
    const large = (a0 - a1) > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  async function fetchIndex() {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json || !Array.isArray(json.data) || !json.data.length) throw new Error('empty payload');

      // API returns newest first; flip it so the chart reads left→right in time.
      const rows = json.data.slice().reverse().map(d => ({
        value: parseInt(d.value, 10),
        t: parseInt(d.timestamp, 10) * 1000
      })).filter(d => !isNaN(d.value));

      history = rows;
      const latest = rows[rows.length - 1];
      current = {
        value: latest.value,
        label: json.data[0].value_classification || band(latest.value).label,
        updated: latest.t
      };
      failed = false;
      paint();
      return true;
    } catch (e) {
      failed = !current;                       // only show the error if we have nothing cached
      console.warn('⚠️ Fear & Greed Index unavailable.', e);
      paint();
      return false;
    }
  }

  /* ── The dial ────────────────────────────────────────────────────── */
  function gauge(value) {
    const b = band(value);

    // One arc per band, with a hairline gap between them.
    let from = 0;
    const bands = BANDS.map(seg => {
      const a = from, z = seg.max;
      from = seg.max;
      return `<path d="${arc(a + (a ? 0.6 : 0), z - 0.6, D.r)}" fill="none" stroke="${seg.color}"
        stroke-width="${D.w}" stroke-linecap="butt" class="fgi-band"/>`;
    }).join('');

    // Ticks: a fine one every 5, a long labelled one every 20.
    let ticks = '';
    for (let v = 0; v <= 100; v += 5) {
      const major = v % 20 === 0;
      const a = angleOf(v);
      const [x0, y0] = polar(a, D.r - D.w / 2 - 5);
      const [x1, y1] = polar(a, D.r - D.w / 2 - (major ? 16 : 9));
      ticks += `<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}"
        class="fgi-tick-m${major ? ' major' : ''}"/>`;
      if (major) {
        const [lx, ly] = polar(a, D.r - D.w / 2 - 30);
        ticks += `<text x="${lx.toFixed(2)}" y="${(ly + 4).toFixed(2)}" class="fgi-tick">${v}</text>`;
      }
    }

    const [sx, sy] = polar(angleOf(0), D.r);

    return `
      <svg class="fgi-gauge" viewBox="0 0 320 252" role="img"
           aria-label="Fear and Greed Index ${value} out of 100, ${esc(b.label)}">
        <defs>
          <radialGradient id="fgi-face" cx="50%" cy="72%" r="68%">
            <stop offset="0%"   stop-color="rgba(255,255,255,.10)"/>
            <stop offset="70%"  stop-color="rgba(255,255,255,.02)"/>
            <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
          </radialGradient>
          <linearGradient id="fgi-needle-g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stop-color="var(--t2)"/>
            <stop offset="55%"  stop-color="var(--t1)"/>
            <stop offset="100%" stop-color="${b.color}"/>
          </linearGradient>
          <radialGradient id="fgi-hub-g" cx="35%" cy="30%" r="75%">
            <stop offset="0%"   stop-color="rgba(255,255,255,.92)"/>
            <stop offset="45%"  stop-color="rgba(190,192,205,.75)"/>
            <stop offset="100%" stop-color="rgba(25,26,34,.95)"/>
          </radialGradient>
          <filter id="fgi-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="fgi-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="3" flood-color="rgba(0,0,0,.45)"/>
          </filter>
        </defs>

        <circle cx="${D.cx}" cy="${D.cy}" r="${D.r + 14}" fill="url(#fgi-face)"/>
        <path d="${arc(0, 100, D.r)}" fill="none" stroke="rgba(125,130,155,.14)" stroke-width="${D.w + 6}"
              stroke-linecap="round"/>
        ${bands}
        <g class="fgi-ticks">${ticks}</g>
        <text x="${D.cx}" y="${D.cy - 58}" class="fgi-face-mark" text-anchor="middle">FEAR &amp; GREED</text>

        <path id="fgi-prog" d="${arc(0, 0.01, D.trail)}" fill="none" stroke="${b.color}" stroke-width="5"
              stroke-linecap="round" filter="url(#fgi-glow)" opacity=".95"/>
        <circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="2.6" fill="rgba(125,130,155,.5)"/>

        <g id="fgi-needle" transform="translate(${D.cx} ${D.cy}) rotate(${-angleOf(0)})" filter="url(#fgi-shadow)">
          <polygon points="-26,3.4 0,4.2 78,1.25 ${D.r - 26},0 78,-1.25 0,-4.2 -26,-3.4" fill="url(#fgi-needle-g)"/>
          <circle cx="-26" cy="0" r="3.6" fill="var(--t2)"/>
        </g>
        <circle cx="${D.cx}" cy="${D.cy}" r="15" fill="url(#fgi-hub-g)" filter="url(#fgi-shadow)"/>
        <circle cx="${D.cx}" cy="${D.cy}" r="6.5" fill="var(--card)" opacity=".92"/>
        <circle id="fgi-hub-dot" cx="${D.cx}" cy="${D.cy}" r="2.4" fill="${b.color}"/>
      </svg>`;
  }

  /* ── Motion ──────────────────────────────────────────────────────── */
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  /* Settles like a real needle: overshoots a touch, then falls back. */
  const easeSettle = t => {
    const c = 1.28;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };

  function frame(v) {
    const needle = document.getElementById('fgi-needle');
    if (!needle) return false;
    const b = band(v);

    needle.setAttribute('transform', `translate(${D.cx} ${D.cy}) rotate(${(-angleOf(v)).toFixed(2)})`);

    const prog = document.getElementById('fgi-prog');
    if (prog) {
      prog.setAttribute('d', arc(0, Math.max(0.01, v), D.trail));
      prog.setAttribute('stroke', b.color);
    }
    const dot = document.getElementById('fgi-hub-dot');
    if (dot) dot.setAttribute('fill', b.color);

    const valEl = document.querySelector('.fgi-value');
    if (valEl) { valEl.textContent = Math.round(v); valEl.style.color = b.color; }

    const labEl = document.querySelector('.fgi-label');
    if (labEl) {
      const settled = current && Math.abs(v - current.value) < 0.6;
      labEl.textContent = settled ? current.label : b.label;
      labEl.style.color = b.color;
    }
    shown = v;
    return true;
  }

  function animateTo(target) {
    if (raf) cancelAnimationFrame(raf);
    const to = clamp(target);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !document.getElementById('fgi-needle')) { frame(to); ignited = true; return; }

    // Ignition sweep the first time only, then straight springs after that.
    const legs = ignited
      ? [{ a: shown, b: to, ms: 950, ease: easeSettle }]
      : [{ a: 0, b: 100, ms: 700, ease: easeInOut }, { a: 100, b: to, ms: 1150, ease: easeSettle }];
    ignited = true;

    let leg = 0, t0 = performance.now();
    const step = now => {
      const L = legs[leg];
      const p = Math.min(1, (now - t0) / L.ms);
      if (!frame(L.a + (L.b - L.a) * L.ease(p))) { raf = null; return; }   // dial left the DOM
      if (p < 1) { raf = requestAnimationFrame(step); return; }
      if (++leg < legs.length) { t0 = now; raf = requestAnimationFrame(step); return; }
      frame(L.b);
      raf = null;
    };
    raf = requestAnimationFrame(step);
  }

  /* ── Small dial, for the home sidebar ────────────────────────────── */
  function miniHTML(value) {
    const v = clamp(value);
    const b = band(v);
    const cx = 40, cy = 44, r = 30, w = 7;
    const A = (x, y) => {
      const a0 = angleOf(x), a1 = angleOf(y);
      const [x0, y0] = polar(a0, r, cx, cy);
      const [x1, y1] = polar(a1, r, cx, cy);
      return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${(a0 - a1) > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    };
    const [nx, ny] = polar(angleOf(v), r - 9, cx, cy);
    return `<svg class="fgi-mini" viewBox="0 0 80 68" aria-hidden="true">
      <path d="${A(0, 100)}" fill="none" stroke="rgba(125,130,155,.18)" stroke-width="${w}" stroke-linecap="round"/>
      <path class="fgi-mini-prog" d="${A(0, Math.max(0.01, v))}" fill="none" stroke="${b.color}" stroke-width="${w}"
            stroke-linecap="round"/>
      <line class="fgi-mini-needle" x1="${cx}" y1="${cy}" x2="${nx.toFixed(2)}" y2="${ny.toFixed(2)}"
            stroke="var(--t1)" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="3.4" fill="var(--t1)"/>
      <text class="fgi-mini-v" x="${cx}" y="64" text-anchor="middle" fill="${b.color}">${Math.round(v)}</text>
    </svg>`;
  }

  /* 30-day history as bars, coloured by the band each day fell into. */
  function trend() {
    if (history.length < 2) return '';
    const bars = history.map((d, i) => {
      const b = band(d.value);
      const day = new Date(d.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `<span class="fgi-bar" style="height:${Math.max(6, d.value)}%; background:${b.color}; animation-delay:${i * 22}ms"
        title="${day}: ${d.value} · ${b.label}"></span>`;
    }).join('');
    const first = history[0], last = history[history.length - 1];
    const delta = last.value - first.value;
    return `
      <div class="fgi-trend-hd">
        <span>Last ${history.length} days</span>
        <span class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta} pts</span>
      </div>
      <div class="fgi-bars">${bars}</div>`;
  }

  function compare() {
    if (history.length < 8) return '';
    const at = n => history[history.length - 1 - n];
    const rows = [['Yesterday', at(1)], ['Last week', at(7)], ['Last month', history[0]]];
    return `<div class="fgi-compare">${rows.map(([label, d]) => d ? `
      <div><span>${label}</span><b style="color:${ink(band(d.value).color)}">${d.value}</b><i>${band(d.value).label}</i></div>` : '').join('')}</div>`;
  }

  /* Movement since yesterday, printed under the number. */
  function deltaLine() {
    if (!current || history.length < 2) return '';
    const prev = history[history.length - 2];
    const d = current.value - prev.value;
    if (!d) return `<div class="fgi-delta flat">Unchanged since yesterday</div>`;
    return `<div class="fgi-delta ${d > 0 ? 'up' : 'down'}">
      <span class="material-symbols-rounded">${d > 0 ? 'arrow_drop_up' : 'arrow_drop_down'}</span>
      ${Math.abs(d)} pts since yesterday</div>`;
  }

  function paint() {
    const host = document.getElementById('fgi-root');
    if (!host) return;

    if (failed) {
      host.innerHTML = `<div class="fgi-err">
        <span class="material-symbols-rounded ms-18">cloud_off</span>
        Sentiment feed unavailable right now.
        <button class="btn btn-ghost btn-sm" onclick="FGI.refresh()">Retry</button>
      </div>`;
      return;
    }

    if (!current) {
      host.innerHTML = `<div class="fgi-loading"><span class="material-symbols-rounded spinner">sync</span> Reading market sentiment…</div>`;
      return;
    }

    const b = band(current.value);
    host.innerHTML = `
      <div class="fgi-main">
        <div class="fgi-dial" style="--fg:${b.color}">
          <div class="fgi-face">
            ${gauge(current.value)}
            <div class="fgi-readout">
              <div class="fgi-value" style="color:${ink(b.color)}">0</div>
              <div class="fgi-label" style="color:${ink(b.color)}">${esc(b.label)}</div>
            </div>
          </div>
          ${deltaLine()}
        </div>
        <div class="fgi-side">
          <p class="fgi-note">${esc(b.note)}</p>
          ${compare()}
          <div class="fgi-stamp">Updated ${new Date(current.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · alternative.me</div>
        </div>
      </div>
      <div class="fgi-trend">${trend()}</div>`;

    frame(ignited ? shown : 0);
    animateTo(current.value);
  }

  function refresh() { current = null; failed = false; ignited = false; shown = 0; paint(); fetchIndex(); }

  function init() {
    fetchIndex();
    setInterval(fetchIndex, REFRESH_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    paint, refresh, fetchIndex, band, BANDS, miniHTML,
    get current() { return current; },
    get history() { return history; }
  };
})();

window.FGI = FGI;

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
publish('features/feargreed.js', {
  FGI: () => FGI
});
