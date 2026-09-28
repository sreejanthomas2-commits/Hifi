// Existing QR encoder and compatibility entry points for Trending Pay.
// Legacy localStorage payments are retired; old history is never imported as funds.
'use strict';

/* ── QR encoder — byte mode, error correction level M, versions 1-20 ── */
const QRGEN = (() => {

  /* [ec codewords per block, blocks·group1, data·group1, blocks·group2, data·group2] */
  const BLK = {
    1:  [10, 1, 16, 0, 0],   2:  [16, 1, 28, 0, 0],   3:  [26, 1, 44, 0, 0],
    4:  [18, 2, 32, 0, 0],   5:  [24, 2, 43, 0, 0],   6:  [16, 4, 27, 0, 0],
    7:  [18, 4, 31, 0, 0],   8:  [22, 2, 38, 2, 39],  9:  [22, 3, 36, 2, 37],
    10: [26, 4, 43, 1, 44],  11: [30, 1, 50, 4, 51],  12: [22, 6, 36, 2, 37],
    13: [22, 8, 37, 1, 38],  14: [24, 4, 40, 5, 41],  15: [24, 5, 41, 5, 42],
    16: [28, 7, 45, 3, 46],  17: [28, 10, 46, 1, 47], 18: [26, 9, 43, 4, 44],
    19: [26, 3, 44, 11, 45], 20: [26, 3, 41, 13, 42]
  };

  const dataCount = v => BLK[v][1] * BLK[v][2] + BLK[v][3] * BLK[v][4];

  /* ── GF(256) arithmetic for Reed-Solomon ─────────────────────────── */
  function gmul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }

  function divisorFor(deg) {
    const r = new Array(deg).fill(0);
    r[deg - 1] = 1;
    let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < deg; j++) {
        r[j] = gmul(r[j], root);
        if (j + 1 < deg) r[j] ^= r[j + 1];
      }
      root = gmul(root, 2);
    }
    return r;
  }

  function remainder(data, div) {
    const res = new Array(div.length).fill(0);
    for (let k = 0; k < data.length; k++) {
      const factor = data[k] ^ res.shift();
      res.push(0);
      for (let i = 0; i < div.length; i++) res[i] ^= gmul(div[i], factor);
    }
    return res;
  }

  /* ── Bit stream ──────────────────────────────────────────────────── */
  function bitstream(bytes, ver) {
    const cap = dataCount(ver) * 8;
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };

    put(4, 4);                                  // byte mode
    put(bytes.length, ver < 10 ? 8 : 16);
    for (let i = 0; i < bytes.length; i++) put(bytes[i], 8);

    for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const out = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      out.push(b);
    }
    for (let pad = 0xEC; out.length < dataCount(ver); pad ^= 0xEC ^ 0x11) out.push(pad);
    return out;
  }

  /* Blocks are built, given their check bytes, then interleaved — the
     order the spec wants so a scratch never wipes one whole block. */
  function withEcc(data, ver) {
    const [ec, c1, d1, c2, d2] = BLK[ver];
    const div = divisorFor(ec);
    const blocks = [], checks = [];
    let p = 0;
    for (let i = 0; i < c1 + c2; i++) {
      const n = i < c1 ? d1 : d2;
      const b = data.slice(p, p + n);
      p += n;
      blocks.push(b);
      checks.push(remainder(b, div));
    }
    const out = [];
    const longest = Math.max(d1, d2);
    for (let i = 0; i < longest; i++) blocks.forEach(b => { if (i < b.length) out.push(b[i]); });
    for (let i = 0; i < ec; i++) checks.forEach(c => out.push(c[i]));
    return out;
  }

  /* ── Matrix ──────────────────────────────────────────────────────── */
  function alignPos(ver) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2;
    const step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
    const res = [6];
    for (let pos = ver * 4 + 17 - 7; res.length < n; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function maskAt(m, x, y) {
    switch (m) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
  }

  function build(cw, ver, mask) {
    const size = ver * 4 + 17;
    const mod = [], fn = [];
    for (let i = 0; i < size; i++) {
      mod.push(new Array(size).fill(false));
      fn.push(new Array(size).fill(false));
    }
    const set = (x, y, dark) => {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      mod[y][x] = dark;
      fn[y][x] = true;
    };

    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }

    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    const pos = alignPos(ver);
    for (let i = 0; i < pos.length; i++) for (let j = 0; j < pos.length; j++) {
      const corner = (i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0);
      if (corner) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }

    // Format info: level M is 00, so the five data bits are just the mask.
    let rem = mask;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fbits = ((mask << 10) | rem) ^ 0x5412;
    const fb = i => ((fbits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, fb(i));
    set(8, 7, fb(6)); set(8, 8, fb(7)); set(7, 8, fb(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, fb(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, fb(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, fb(i));
    set(8, size - 8, true);

    if (ver >= 7) {
      let vr = ver;
      for (let i = 0; i < 12; i++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1F25);
      const vbits = (ver << 12) | vr;
      for (let i = 0; i < 18; i++) {
        const dark = ((vbits >>> i) & 1) !== 0;
        const a = size - 11 + (i % 3), b = Math.floor(i / 3);
        set(a, b, dark); set(b, a, dark);
      }
    }

    // Zig-zag the codewords up and down the two-module columns.
    let bit = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && bit < cw.length * 8) {
            mod[y][x] = ((cw[bit >>> 3] >>> (7 - (bit & 7))) & 1) !== 0;
            bit++;
          }
        }
      }
    }

    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!fn[y][x] && maskAt(mask, x, y)) mod[y][x] = !mod[y][x];
    }
    return { size, mod, ver };
  }

  /* The spec's four penalties — the mask that scores lowest is the one
     that scans best, so all eight are built and compared. */
  function penalty(m) {
    const n = m.size;
    let score = 0;

    const scan = arr => {
      let s = 0, run = 1;
      for (let i = 1; i < n; i++) {
        if (arr[i] === arr[i - 1]) { run++; if (run === 5) s += 3; else if (run > 5) s += 1; }
        else run = 1;
      }
      const str = arr.map(v => (v ? '1' : '0')).join('');
      ['10111010000', '00001011101'].forEach(p => {
        let i = str.indexOf(p);
        while (i !== -1) { s += 40; i = str.indexOf(p, i + 1); }
      });
      return s;
    };

    for (let y = 0; y < n; y++) score += scan(m.mod[y]);
    for (let x = 0; x < n; x++) score += scan(m.mod.map(r => r[x]));

    let dark = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (m.mod[y][x]) dark++;
      if (x + 1 < n && y + 1 < n) {
        const v = m.mod[y][x];
        if (v === m.mod[y][x + 1] && v === m.mod[y + 1][x] && v === m.mod[y + 1][x + 1]) score += 3;
      }
    }
    score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
    return score;
  }

  function bytesOf(text) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
    const out = [];
    const s = unescape(encodeURIComponent(text));
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function make(text) {
    const bytes = bytesOf(text);
    let ver = 0;
    for (let v = 1; v <= 20; v++) {
      if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= dataCount(v) * 8) { ver = v; break; }
    }
    if (!ver) throw new Error('Payload too long for a QR code');
    const cw = withEcc(bitstream(bytes, ver), ver);

    let best = null, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const m = build(cw, ver, mask);
      const s = penalty(m);
      if (s < bestScore) { bestScore = s; best = m; }
    }
    return best;
  }

  const QUIET = 4;

  /* Dark on light, always — a QR inverted by a dark theme won't scan. */
  function svg(m, px, brandLetter) {
    const n = m.size + QUIET * 2;
    let path = '';
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) {
      if (m.mod[y][x]) path += 'M' + (x + QUIET) + ' ' + (y + QUIET) + 'h1v1h-1z';
    }
    const c = n / 2, r = n * 0.075;
    const badge = brandLetter ? `
      <rect x="${(c - r * 1.35).toFixed(2)}" y="${(c - r * 1.35).toFixed(2)}"
            width="${(r * 2.7).toFixed(2)}" height="${(r * 2.7).toFixed(2)}" rx="${(r * 0.8).toFixed(2)}" fill="#fff"/>
      <circle cx="${c}" cy="${c}" r="${r.toFixed(2)}" fill="#FCD535"/>
      <text x="${c}" y="${(c + r * 0.36).toFixed(2)}" text-anchor="middle"
            font-family="Inter, system-ui, sans-serif" font-weight="900"
            font-size="${(r * 1.15).toFixed(2)}" fill="#fff">${brandLetter}</text>` : '';
    return `<svg viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges"
                 xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Payment QR code">
      <rect width="${n}" height="${n}" fill="#ffffff"/>
      <path d="${path}" fill="#0B0C10"/>${badge}</svg>`;
  }

  function canvas(m, scale) {
    const n = m.size + QUIET * 2;
    const c = document.createElement('canvas');
    c.width = c.height = n * scale;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#0B0C10';
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) {
      if (m.mod[y][x]) g.fillRect((x + QUIET) * scale, (y + QUIET) * scale, scale, scale);
    }
    return c;
  }

  return { make, svg, canvas };
})();



const PAY = {
  ASSETS: ['USDT', 'USDC', 'BTC', 'ETH'],
  openHub: () => window.TPAY.open('home'),
  openScan: () => window.TPAY.open('scan'),
  openMyQR: () => window.TPAY.open('receive'),
  openPayTo: options => window.TPAY.open('send', options || {}),
  openRequestFor: () => window.TPAY.open('request'),
  openRequestForChat: () => window.TPAY.open('request'),
  contacts: () => [],
  createRequest(options) {
    window.TPAY.open('request', options || {});
    return { ok: false, msg: 'Review and create your signed request in Trending Pay.' };
  },
  pay: () => ({ ok: false, msg: 'Payment requires a server quote and authentication in Trending Pay.' }),
  payRequest: () => window.TPAY.open('scan'),
  previewOf: () => 'Archived practice payment — not a verified transfer',
  cardHTML: () => '<div class="cfi-card"><b>Archived practice payment</b><p>This browser-only record is not proof of payment. Ask for a new signed Trending Pay request.</p></div>',
  close: () => window.TPAY.close()
};
window.PAY = PAY;
window.QRGEN = QRGEN;
/* ── Global bridge ───────────────────────────────────────────────── */
import { publish } from '../globals.js?v=3';
publish('features/pay.js', { QRGEN: () => QRGEN, PAY: () => PAY });
