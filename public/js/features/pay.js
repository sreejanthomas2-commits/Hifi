/* ╔══════════════════════════════════════════════════════════════════╗
   ║  PAY — QR payments and payment requests                          ║
   ║                                                                  ║
   ║   1. My QR       — every account has a payment code: name,       ║
   ║                    handle and a 9-digit Pay ID, optionally with  ║
   ║                    an amount baked in                            ║
   ║   2. Scan        — camera, a photo from the gallery, or a        ║
   ║                    pasted link; the payer picks the asset and    ║
   ║                    confirms before anything moves                ║
   ║   3. Request     — recipient, asset, amount, note, expiry;       ║
   ║                    shareable as a QR, a link, or a card sent     ║
   ║                    straight into the other person's chat         ║
   ║                                                                  ║
   ║  Money moves through MNY, so a payment here, a tip and a send    ║
   ║  in a chat all touch one balance. Paying draws on Funding and    ║
   ║  tops up from Spot when Funding is short, and the receipt says   ║
   ║  when it did.                                                    ║
   ║  Contacts here are simulated, so anything they pay you is money  ║
   ║  the app invents; it goes through the same daily inbound cap as  ║
   ║  chat crypto so paper balances stay honest.                      ║
   ║                                                                  ║
   ║  The QR encoder below is written out in full rather than pulled  ║
   ║  from a CDN, so a code still renders with no network. Reading a  ║
   ║  code uses the browser's own BarcodeDetector where it exists and ║
   ║  falls back to jsQR, fetched only the first time you scan.       ║
   ╚══════════════════════════════════════════════════════════════════╝ */

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
      <circle cx="${c}" cy="${c}" r="${r.toFixed(2)}" fill="#7C5CFF"/>
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


const PAY = (() => {

  const KEY = 'ts_pay';
  /* The assets Pay used to be limited to. Kept as the fallback list and
     as the chips shown first, but `payable()` below is what a payment is
     actually checked against — it comes from MNY, so chat and Pay accept
     the same coins. */
  const ASSETS = ['USDT', 'BTC', 'ETH', 'SOL', 'DOGE', 'TREND'];
  const TREND_REF = 0.10;                       // pre-listing reference, as the Wallet tab uses
  const MAX_NOTE = 60;
  const INBOUND_CAP = 5000;                     // fallback when chat crypto isn't loaded
  const TTLS = [['15 min', 9e5], ['1 hour', 36e5], ['24 hours', 864e5], ['7 days', 6048e5]];

  const DEFAULT = { id: '', tx: [], sent: [], recv: [], dms: [], seeded: false, inbound: { day: '', used: 0 } };

  let D = load();
  let V = null;                                 // modal view state while open
  let cam = { stream: null, timer: null };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      return { ...JSON.parse(JSON.stringify(DEFAULT)), ...JSON.parse(raw) };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }

  const esc = s => (typeof escapeHTML === 'function' ? escapeHTML(String(s == null ? '' : s)) : String(s == null ? '' : s));
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const ic = (s, n) => (typeof coinIcon === 'function' ? coinIcon(s, n) : '');

  /* ── Money ───────────────────────────────────────────────────────── */
  /* All of it now comes from MNY, so Pay, chat crypto and the Wallet tab
     cannot hold three different opinions of one balance. The fallbacks
     below only matter if MNY somehow failed to load. */
  const hasMNY = () => typeof MNY !== 'undefined';

  function priceOf(sym) {
    if (hasMNY()) return MNY.price(sym);
    if (sym === 'USDT') return 1;
    if (sym === 'TREND') return TREND_REF;
    const c = (window.liveCryptoPrices || {})[sym];
    return c ? c.usd : 0;
  }

  const bal = () => (typeof DATA !== 'undefined' && DATA.wallet) ? DATA.wallet.balances : null;

  /* Spendable, not just what sits in Funding — a payment reaches Spot
     too, and quoting the smaller number turned working payments into
     "not enough". */
  const balOf = sym => {
    if (hasMNY()) return MNY.spendable(sym);
    const b = bal(); return b ? (Number(b[sym]) || 0) : 0;
  };

  /* Which assets a payment may use. This was a fixed list of six while
     chat allowed anything priced, so a request that chat accepted was
     one Pay rejected. */
  const payable = () => (hasMNY() ? MNY.assets() : ASSETS);

  /* Chips stay short: what you hold, then the familiar names, then
     whatever is selected. The full list is one tap away in the select. */
  function chipAssets(current) {
    const held = (hasMNY() ? MNY.holdings().filter(r => r.priced).map(r => r.sym) : []);
    const out = [];
    held.concat(ASSETS).concat(current ? [current] : []).forEach(a => {
      const k = String(a || '').toUpperCase();
      if (k && out.indexOf(k) === -1 && canPay(k)) out.push(k);
    });
    return out.slice(0, 8);
  }
  const canPay = sym => payable().indexOf(String(sym || '').toUpperCase()) !== -1;

  function usd(v) {
    const a = Math.abs(Number(v) || 0);
    const s = a > 0 && a < 0.01 ? a.toFixed(6)
      : a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 ? '-$' : '$') + s;
  }
  function qty(v) {
    const n = Number(v) || 0;
    if (!n) return '0';
    if (n < 0.0001) return n.toExponential(2);
    return n.toLocaleString('en-US', { maximumFractionDigits: n >= 1 ? 4 : 8 });
  }

  /* Every coin, not the six Pay happened to list — the header total was
     quietly leaving out whatever else was in the wallet. */
  const walletUSD = () => (hasMNY() ? MNY.total().value : ASSETS.reduce((s, c) => s + balOf(c) * priceOf(c), 0));

  const today = () => new Date().toISOString().slice(0, 10);

  /* Simulated contacts can't be allowed to mint: their payments share the
     same daily ceiling as chat crypto. */
  function takeInbound(value) {
    if (typeof CFI !== 'undefined' && CFI.takeInbound) return CFI.takeInbound(value);
    if (D.inbound.day !== today()) D.inbound = { day: today(), used: 0 };
    if (D.inbound.used + value > INBOUND_CAP) return false;
    D.inbound.used += value;
    save();
    return true;
  }

  function debit(sym, amount, meta) {
    if (hasMNY()) {
      const r = MNY.spend(sym, amount, { kind: 'spend', via: 'Pay', ...(meta || {}) });
      return r.ok ? r : false;
    }
    const b = bal();
    if (!b) return false;
    if ((Number(b[sym]) || 0) + 1e-12 < amount) return false;
    b[sym] = (Number(b[sym]) || 0) - amount;     // the wallet proxy persists this
    return true;
  }
  function credit(sym, amount, meta) {
    if (hasMNY()) {
      /* The cap is applied by the caller, which already took it — this
         is the crediting half only. */
      return MNY.receive(sym, amount, { kind: 'receive', via: 'Pay', simulated: false, ...(meta || {}) }).ok;
    }
    const b = bal();
    if (!b) return false;
    b[sym] = (Number(b[sym]) || 0) + amount;
    return true;
  }

  /* ── Identity ────────────────────────────────────────────────────── */
  function digits(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return String(100000000 + (h % 900000000));
  }
  const prettyId = id => String(id || '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');

  function myId() {
    if (!D.id) {
      D.id = String(100000000 + Math.floor(Math.random() * 900000000));
      save();
    }
    return D.id;
  }

  function me() {
    const u = (typeof S !== 'undefined' && S.user) ? S.user : {};
    const name = `${u.fname || 'Guest'} ${u.lname || ''}`.trim() || 'Guest';
    let handle = String(u.handle || '').trim();
    if (!handle || handle === 'Sign In') handle = '@' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (handle[0] !== '@') handle = '@' + handle;
    return { name, handle, payId: myId() };
  }

  const contacts = () => ((typeof DATA !== 'undefined' && DATA.users) || [])
    .map(u => ({ name: u.name, handle: u.handle, online: !!u.online, payId: digits(u.handle) }));

  const contactBy = handle => contacts().find(c => c.handle.toLowerCase() === String(handle || '').toLowerCase());

  const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  /* ── Chat delivery ───────────────────────────────────────────────── */
  /* A request or receipt belongs in the conversation with that person, so
     a DM is opened for contacts who don't have one yet. */
  function ensureDM(contact) {
    if (typeof DATA === 'undefined' || !Array.isArray(DATA.conversations)) return null;
    const existing = DATA.conversations.find(c => c.type === 'chats' && c.name === contact.name);
    if (existing) return existing.id;
    const id = 'p' + String(contact.handle).replace(/[^a-z0-9]/gi, '');
    if (!DATA.conversations.some(c => String(c.id) === id)) {
      DATA.conversations.push({
        id, name: contact.name, emoji: '✨', preview: 'Payments',
        time: 'now', unread: 0, online: !!contact.online, type: 'chats'
      });
    }
    if (!D.dms.some(d => d.id === id)) { D.dms.push({ id, name: contact.name, handle: contact.handle, online: !!contact.online }); save(); }
    return id;
  }

  function installDMs() {
    if (typeof DATA === 'undefined' || !Array.isArray(DATA.conversations)) return;
    D.dms.forEach(d => {
      if (!DATA.conversations.some(c => String(c.id) === String(d.id))) {
        DATA.conversations.push({
          id: d.id, name: d.name, emoji: '✨', preview: 'Payments',
          time: '', unread: 0, online: !!d.online, type: 'chats'
        });
      }
    });
  }

  function postCard(chatId, fi) {
    if (chatId == null) return null;
    if (typeof CFI !== 'undefined' && CFI.push) return CFI.push(chatId, fi);
    return null;
  }

  function openChat(handle) {
    const c = contactBy(handle);
    if (!c) { toast('That account has no chat yet.'); return; }
    const id = ensureDM(c);
    close();
    if (typeof navigateTo === 'function') navigateTo('messages');
    setTimeout(() => { if (typeof TG !== 'undefined') TG.open('c:' + id); }, 120);
  }

  /* ── Payment links ───────────────────────────────────────────────── */
  function baseURL() {
    return location.origin + location.pathname;
  }

  function linkFor(p) {
    const q = new URLSearchParams();
    Object.keys(p).forEach(k => { if (p[k] !== '' && p[k] != null) q.set(k, p[k]); });
    return baseURL() + '#pay?' + q.toString();
  }

  function myLink(extra) {
    const m = me();
    return linkFor({ t: 'u', id: m.payId, h: m.handle, n: m.name, ...(extra || {}) });
  }

  function requestLink(r) {
    return linkFor({
      t: 'r', rid: r.rid, id: r.from.payId, h: r.from.handle, n: r.from.name,
      a: r.asset, m: r.amount, x: r.exp, c: r.created, note: r.note || '', to: r.to ? r.to.handle : ''
    });
  }

  /* Anything scanned is untrusted text — parse it, never evaluate it. */
  function parsePayload(text) {
    const raw = String(text || '').trim();
    const i = raw.indexOf('#pay?');
    if (i === -1) return { ok: false, raw };
    const q = new URLSearchParams(raw.slice(i + 5));
    const t = q.get('t');
    if (t !== 'u' && t !== 'r') return { ok: false, raw };

    const clean = s => String(s || '').replace(/[ -]/g, '').slice(0, 80);
    const p = {
      ok: true, type: t,
      payId: String(q.get('id') || '').replace(/\D/g, '').slice(0, 12),
      handle: clean(q.get('h')),
      name: clean(q.get('n')) || 'Unknown account',
      asset: String(q.get('a') || '').toUpperCase().slice(0, 8),
      amount: parseFloat(q.get('m')),
      note: clean(q.get('note')).slice(0, MAX_NOTE),
      rid: clean(q.get('rid')),
      exp: parseInt(q.get('x'), 10) || 0,
      created: parseInt(q.get('c'), 10) || 0,
      to: clean(q.get('to'))
    };
    if (p.asset && !canPay(p.asset)) p.asset = '';
    if (!isFinite(p.amount) || p.amount <= 0) p.amount = 0;
    return p;
  }

  /* ── Requests ────────────────────────────────────────────────────── */
  const newRid = () => 'R' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();

  function statusOf(r) {
    if (!r) return 'unknown';
    if (r.status === 'pending' && r.exp && Date.now() > r.exp) return 'expired';
    return r.status;
  }

  function findRequest(rid) {
    return D.sent.find(r => r.rid === rid) || D.recv.find(r => r.rid === rid) || null;
  }
  const isMine = rid => D.sent.some(r => r.rid === rid);

  function leftOf(r) {
    const ms = (r.exp || 0) - Date.now();
    if (ms <= 0) return 'expired';
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    if (h >= 24) return 'expires in ' + Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
    if (h >= 1) return 'expires in ' + h + 'h ' + m + 'm';
    return 'expires in ' + Math.max(1, m) + 'm';
  }

  function createRequest(opts) {
    const asset = String(opts.asset || 'USDT').toUpperCase();
    const amount = parseFloat(opts.amount);
    if (!canPay(asset)) return { ok: false, msg: 'Pick a supported asset.' };
    if (!amount || amount <= 0) return { ok: false, msg: 'Enter an amount.' };

    const to = opts.to ? contactBy(opts.to) : null;
    if (opts.to && !to) return { ok: false, msg: 'Pick someone from your contacts.' };

    // Sent from a conversation, the request is delivered to that thread even
    // when the other side isn't one of the contact cards (a group, say).
    const chatId = opts.chatId != null ? opts.chatId : (to ? ensureDM(to) : null);
    const r = {
      rid: newRid(), from: me(),
      to: to ? { name: to.name, handle: to.handle } : (opts.toName ? { name: opts.toName, handle: '' } : null),
      chatId, asset, amount, note: String(opts.note || '').slice(0, MAX_NOTE),
      created: Date.now(), exp: Date.now() + (opts.ttl || 864e5),
      status: 'pending'
    };
    D.sent.unshift(r);
    save();

    if (chatId != null) {
      postCard(chatId, { kind: 'payreq', me: true, rid: r.rid });
      scheduleSettle(r.rid);
    }
    return { ok: true, msg: `Request created — ${qty(amount)} ${asset}`, r };
  }

  function cancelRequest(rid) {
    const r = D.sent.find(x => x.rid === rid);
    if (!r || statusOf(r) !== 'pending') return;
    r.status = 'cancelled';
    save(); repaint();
    toast('Request cancelled');
  }

  function declineRequest(rid) {
    const r = D.recv.find(x => x.rid === rid);
    if (!r || statusOf(r) !== 'pending') return;
    r.status = 'declined';
    save(); repaint();
    toast('Request declined');
  }

  /* The other side is simulated: give it a beat, then pay or pass. */
  function scheduleSettle(rid) {
    setTimeout(() => settle(rid), 3200 + Math.random() * 3600);
  }

  function settle(rid) {
    const r = D.sent.find(x => x.rid === rid);
    if (!r || statusOf(r) !== 'pending' || (!r.to && r.chatId == null)) return;
    const value = r.amount * priceOf(r.asset);
    const who = r.to ? r.to.name : 'They';

    if (Math.random() < 0.15) {
      r.status = 'declined';
      r.reason = who + ' declined this request';
    } else if (!takeInbound(value)) {
      r.status = 'declined';
      r.reason = `Daily settlement cap reached (${usd(INBOUND_CAP)}/day)`;
    } else {
      credit(r.asset, r.amount, { from: who, note: r.note });
      r.status = 'paid';
      r.paidAt = Date.now();
      D.tx.unshift({
        id: 'tx' + Date.now(), dir: 'in', name: who, handle: r.to ? r.to.handle : '',
        asset: r.asset, qty: r.amount, usd: value, note: r.note, ts: Date.now(), rid: r.rid
      });
      postCard(r.chatId, { kind: 'payok', me: false, rid: r.rid, asset: r.asset, qty: r.amount, note: r.note });
    }
    save();
    repaint();
    if (typeof renderChatMessages === 'function') renderChatMessages();
    toast(r.status === 'paid'
      ? `${who} paid ${qty(r.amount)} ${r.asset}`
      : `Request declined — ${String(r.reason || '').toLowerCase()}`);
  }

  /* ── Paying ──────────────────────────────────────────────────────── */
  function pay(opts) {
    const asset = String(opts.asset || '').toUpperCase();
    const amount = parseFloat(opts.amount);
    const to = opts.to || {};

    if (!canPay(asset)) return { ok: false, msg: 'Pick a supported asset.' };
    if (!amount || amount <= 0) return { ok: false, msg: 'Enter an amount.' };
    if (to.payId && String(to.payId) === String(myId())) return { ok: false, msg: "That's your own code — you can't pay yourself." };
    if (balOf(asset) + 1e-12 < amount) return { ok: false, msg: `Not enough ${asset} — you hold ${qty(balOf(asset))}.` };

    const paid = debit(asset, amount, { to: to.name || to.handle || '', note: opts.note });
    if (!paid) return { ok: false, msg: 'Payment failed — balance unavailable.' };
    const moved = paid && paid.moved ? paid.moved : 0;

    const value = amount * priceOf(asset);
    const tx = {
      id: 'tx' + Date.now(), dir: 'out', name: to.name || 'Unknown account', handle: to.handle || '',
      payId: to.payId || '', asset, qty: amount, usd: value,
      note: String(opts.note || '').slice(0, MAX_NOTE), ts: Date.now(), rid: opts.rid || ''
    };
    D.tx.unshift(tx);

    if (opts.rid) {
      const r = D.recv.find(x => x.rid === opts.rid);
      if (r) { r.status = 'paid'; r.paidAt = Date.now(); }
    }
    save();

    const c = contactBy(to.handle);
    if (c) postCard(ensureDM(c), { kind: 'payok', me: true, rid: opts.rid || '', asset, qty: amount, note: tx.note });

    if (typeof IX !== 'undefined' && IX.burstReaction) {
      IX.burstReaction('💸', window.innerWidth / 2, window.innerHeight / 2, 6);
    }
    return {
      ok: true, moved,
      msg: `Paid ${qty(amount)} ${asset} to ${tx.name}${moved > 0 ? ` · ${qty(moved)} moved from Spot` : ''}`,
      tx
    };
  }

  /* ── Chat cards ──────────────────────────────────────────────────── */
  function previewOf(fi) {
    if (!fi) return 'Payment';
    if (fi.kind === 'payreq') {
      const r = findRequest(fi.rid);
      return r ? `Payment request — ${qty(r.amount)} ${r.asset}` : 'Payment request';
    }
    if (fi.kind === 'payok') return `${fi.me ? 'Paid' : 'Received'} ${qty(fi.qty)} ${fi.asset}`;
    return 'Payment';
  }

  function cardHTML(fi) {
    if (!fi) return '';

    if (fi.kind === 'payok') {
      return `<div class="cfi-card pay-card-ok">
        <div class="cfi-head"><span class="material-symbols-rounded ms-16 tc-green">${fi.me ? 'north_east' : 'south_west'}</span>
          <span class="cfi-label">${fi.me ? 'Payment sent' : 'Payment received'}</span></div>
        <div class="cfi-amt">${ic(fi.asset, 22)}<span>${esc(qty(fi.qty))} ${esc(fi.asset)}</span></div>
        <div class="cfi-sub">${esc(usd((Number(fi.qty) || 0) * priceOf(fi.asset)))}${fi.note ? ' · ' + esc(fi.note) : ''}</div>
        <div class="cfi-foot"><span class="cfi-pill ok">Completed</span></div>
      </div>`;
    }

    if (fi.kind !== 'payreq') return '';
    const r = findRequest(fi.rid);
    if (!r) return `<div class="cfi-card pay-card-req"><div class="cfi-sub">This payment request is no longer available.</div></div>`;

    const st = statusOf(r);
    const mine = isMine(r.rid);
    const pill = st === 'paid' ? '<span class="cfi-pill ok">Paid</span>'
      : st === 'pending' ? `<span class="cfi-pill wait">${esc(leftOf(r))}</span>`
      : st === 'expired' ? '<span class="cfi-pill bad">Expired</span>'
      : st === 'cancelled' ? '<span class="cfi-pill bad">Cancelled</span>'
      : '<span class="cfi-pill bad">Declined</span>';

    const actions = st !== 'pending' ? ''
      : mine
        ? `<button class="btn btn-sm btn-ghost" onclick="PAY.share('${esc(r.rid)}')">Share</button>
           <button class="btn btn-sm btn-ghost" onclick="PAY.cancelRequest('${esc(r.rid)}')">Cancel</button>`
        : `<button class="btn btn-sm btn-primary" onclick="PAY.payRequest('${esc(r.rid)}')">Pay</button>
           <button class="btn btn-sm btn-ghost" onclick="PAY.declineRequest('${esc(r.rid)}')">Decline</button>`;

    return `<div class="cfi-card pay-card-req">
      <div class="cfi-head"><span class="material-symbols-rounded ms-16 tc-blue">request_quote</span>
        <span class="cfi-label">${mine ? 'You requested' : esc(r.from.name) + ' requested'}</span></div>
      <div class="cfi-amt">${ic(r.asset, 22)}<span>${esc(qty(r.amount))} ${esc(r.asset)}</span></div>
      <div class="cfi-sub">${esc(usd(r.amount * priceOf(r.asset)))}${r.note ? ' · ' + esc(r.note) : ''}</div>
      ${r.reason ? `<div class="cfi-note">${esc(r.reason)}</div>` : ''}
      <div class="cfi-foot">${pill}<span class="pay-card-acts">${actions}</span></div>
    </div>`;
  }

  /* ── Modal shell ─────────────────────────────────────────────────── */
  /* Navigation. `trail` is the screens behind this one; `origin` is where
     the sheet was opened from, which is where Back goes once the trail is
     empty:
       hub  — the Wallet/Pay hub (Profile, Home, search): back to Pay home
       cfi  — chat crypto (menu, quick actions, the panel): back to the
              Chat Crypto panel, restored as it was (`cfi` holds it)
       chat — a card in the thread: back to the thread
     `replace` swaps the current screen instead of stacking it, for result
     screens that must not lead back into a form already submitted. */
  function openHub() { V = { view: 'home', origin: 'hub', trail: [] }; render(); }
  function go(view, patch) {
    stopCam();
    const prev = V || {};
    const p = { ...(patch || {}) };
    const replace = !!p.replace;
    delete p.replace;
    const trail = (prev.trail || []).slice();
    if (!replace && prev.view && prev.view !== view) trail.push(prev.view);
    V = { ...prev, ...p, view, trail };
    render();
    if (view === 'scan') startScan();
  }
  function back() {
    const trail = (V && V.trail) || [];
    if (trail.length) {
      stopCam();
      const view = trail[trail.length - 1];
      V = { ...V, view, trail: trail.slice(0, -1) };
      render();
      if (view === 'scan') startScan();
      return;
    }
    leave();
  }
  /* Nothing left behind this screen: return to where the sheet came from. */
  function leave() {
    const origin = V ? (V.origin || 'hub') : 'hub';
    const snap = V ? V.cfi : null;
    if (origin === 'hub') {
      if (V && V.view !== 'home') { V = { ...V, view: 'home', trail: [] }; stopCam(); render(); }
      else close();
      return;
    }
    close();
    if (origin === 'cfi' && typeof CFI !== 'undefined' && CFI.restore) CFI.restore(snap);
  }
  /* The "Done" of a finished payment. */
  function finish() {
    if (V && (V.origin || 'hub') === 'hub') { V = { ...V, view: 'home', trail: [] }; render(); }
    else leave();
  }
  const hasBack = () => !!V && (V.view !== 'home' || (V.trail || []).length > 0);
  const fromChat = o => (o && (o.from === 'chat' || o.origin === 'cfi')) ? 'cfi' : (o && o.origin) || 'hub';

  function render() {
    let scrim = document.getElementById('pay-scrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.id = 'pay-scrim';
      scrim.className = 'pay-scrim';
      scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
      document.body.appendChild(scrim);
    }
    scrim.innerHTML = `<div class="pay-card" role="dialog" aria-label="Payments">${headHTML()}<div class="pay-body">${bodyHTML()}</div></div>`;
    if (V && V.view === 'scan') {
      const box = document.getElementById('pay-video-box');
      if (box && cam.video) box.appendChild(cam.video);
    }
    paintSummary();
  }

  function repaint() { if (document.getElementById('pay-scrim')) render(); }

  function close() {
    stopCam();
    const s = document.getElementById('pay-scrim');
    if (s) s.remove();
    V = null;
  }

  const TITLES = {
    home: 'Pay', qr: 'My payment code', scan: 'Scan to pay', req: 'Request a payment',
    made: 'Request ready', pay: 'Confirm payment', done: 'Payment sent', list: 'Requests'
  };

  function headHTML() {
    const v = V ? V.view : 'home';
    return `<div class="pay-head">
      ${!hasBack()
        ? '<div class="pay-kicker">WALLET</div>'
        : `<button class="icon-btn" onclick="PAY.back()" aria-label="Back"><span class="material-symbols-rounded ms-18">arrow_back</span></button>`}
      <h3 class="pay-title">${esc(TITLES[v] || 'Pay')}</h3>
      <button class="icon-btn" onclick="PAY.close()" aria-label="Close"><span class="material-symbols-rounded ms-18">close</span></button>
    </div>`;
  }

  function bodyHTML() {
    switch (V.view) {
      case 'qr':   return qrView();
      case 'scan': return scanView();
      case 'req':  return reqView();
      case 'made': return madeView();
      case 'pay':  return payView();
      case 'done': return doneView();
      case 'list': return listView();
      default:     return homeView();
    }
  }

  const note = `<div class="pay-disclaimer"><span class="material-symbols-rounded ms-16">info</span>
    Paper balances only. Contacts are simulated and anything they pay you is capped at
    ${usd(INBOUND_CAP)}/day. Nothing leaves this browser and no real funds move.</div>`;

  /* ── Home ────────────────────────────────────────────────────────── */
  function homeView() {
    const m = me();
    const pendingIn = D.recv.filter(r => statusOf(r) === 'pending');
    const pendingOut = D.sent.filter(r => statusOf(r) === 'pending');

    return `
      <div class="pay-bal">
        <div>
          <div class="fs11 tc-3">Wallet balance</div>
          <div class="pay-bal-v">${esc(usd(walletUSD()))}</div>
        </div>
        <div class="pay-me">
          <div class="pay-av">${esc(initials(m.name))}</div>
          <div>
            <div class="fw7 fs12">${esc(m.name)}</div>
            <div class="fs11 tc-3">Pay ID ${esc(prettyId(m.payId))}</div>
          </div>
        </div>
      </div>

      <div class="pay-tiles">
        <button class="pay-tile" onclick="PAY.go('scan')">
          <span class="material-symbols-rounded">qr_code_scanner</span><span>Scan &amp; pay</span></button>
        <button class="pay-tile" onclick="PAY.go('qr')">
          <span class="material-symbols-rounded">qr_code_2</span><span>My QR code</span></button>
        <button class="pay-tile" onclick="PAY.go('req')">
          <span class="material-symbols-rounded">request_quote</span><span>Request</span></button>
      </div>

      ${pendingIn.length ? `<div class="pay-sec">To pay</div>${pendingIn.slice(0, 3).map(reqRow).join('')}` : ''}
      ${pendingOut.length ? `<div class="pay-sec">Waiting on</div>${pendingOut.slice(0, 3).map(reqRow).join('')}` : ''}

      <div class="pay-sec">
        Recent activity
        <button class="pay-link" onclick="PAY.go('list')">All requests</button>
      </div>
      ${D.tx.length
        ? D.tx.slice(0, 6).map(txRow).join('')
        : '<div class="pay-empty">No payments yet. Scan a code or send a request to get started.</div>'}
      ${note}`;
  }

  function txRow(t) {
    const out = t.dir === 'out';
    return `<div class="pay-item">
      <div class="pay-item-ic ${out ? 'out' : 'in'}">
        <span class="material-symbols-rounded ms-18">${out ? 'north_east' : 'south_west'}</span></div>
      <div class="pay-item-main">
        <div class="pay-item-top"><b>${esc(t.name)}</b><span class="${out ? '' : 'tc-green'}">${out ? '-' : '+'}${esc(qty(t.qty))} ${esc(t.asset)}</span></div>
        <div class="pay-item-sub"><span>${esc(t.note || (out ? 'Payment sent' : 'Payment received'))}</span><span>${esc(usd(t.usd))}</span></div>
      </div>
    </div>`;
  }

  function reqRow(r) {
    const mine = isMine(r.rid);
    const st = statusOf(r);
    const who = mine ? (r.to ? r.to.name : 'Anyone with the link') : r.from.name;
    const pill = st === 'paid' ? '<span class="cfi-pill ok">Paid</span>'
      : st === 'pending' ? `<span class="cfi-pill wait">${esc(leftOf(r))}</span>`
      : `<span class="cfi-pill bad">${esc(st[0].toUpperCase() + st.slice(1))}</span>`;

    const acts = st !== 'pending' ? ''
      : mine
        ? `<button class="btn btn-sm btn-ghost" onclick="PAY.share('${esc(r.rid)}')">Share</button>
           <button class="btn btn-sm btn-ghost" onclick="PAY.cancelRequest('${esc(r.rid)}')">Cancel</button>`
        : `<button class="btn btn-sm btn-primary" onclick="PAY.payRequest('${esc(r.rid)}')">Pay</button>
           <button class="btn btn-sm btn-ghost" onclick="PAY.declineRequest('${esc(r.rid)}')">Decline</button>`;

    return `<div class="pay-req">
      <div class="pay-req-top">
        <div class="coin-cell">${ic(r.asset, 18)}<b>${esc(qty(r.amount))} ${esc(r.asset)}</b></div>
        ${pill}
      </div>
      <div class="pay-req-sub">${mine ? 'To' : 'From'} ${esc(who)}${r.note ? ' · ' + esc(r.note) : ''} · ${esc(usd(r.amount * priceOf(r.asset)))}</div>
      ${acts ? `<div class="pay-req-acts">${acts}</div>` : ''}
    </div>`;
  }

  function listView() {
    const all = D.recv.concat(D.sent).sort((a, b) => b.created - a.created);
    if (!all.length) return `<div class="pay-empty">No payment requests yet.</div>${note}`;
    return all.map(reqRow).join('') + note;
  }

  /* ── My QR ───────────────────────────────────────────────────────── */
  function qrView() {
    const m = me();
    const amount = parseFloat(V.amount) > 0 ? parseFloat(V.amount) : 0;
    const asset = V.asset || 'USDT';
    const link = amount ? myLink({ a: asset, m: amount, note: V.note || '' }) : myLink();
    let code = '';
    try { code = QRGEN.svg(QRGEN.make(link), 232, 'T'); }
    catch (e) { code = '<div class="pay-empty">This code is too long to render.</div>'; }

    return `
      <div class="pay-qrwrap">
        ${code}
        <div class="pay-qr-name">${esc(m.name)}</div>
        <div class="pay-qr-handle">${esc(m.handle)} · Pay ID ${esc(prettyId(m.payId))}</div>
        ${amount ? `<div class="pay-qr-amt">${esc(qty(amount))} ${esc(asset)}<span> · ${esc(usd(amount * priceOf(asset)))}</span></div>` : ''}
      </div>

      <div class="pay-sec">Ask for a set amount <span class="fs11 tc-3">(optional)</span></div>
      <div class="pay-row">
        <input class="pay-input" type="number" step="any" min="0" placeholder="0.00" value="${esc(V.amount || '')}"
               oninput="PAY.f('amount', this.value, true)">
        ${assetSelect(asset, "PAY.f('asset', this.value, true)")}
      </div>
      <input class="pay-input mt8" type="text" maxlength="${MAX_NOTE}" placeholder="Note (optional)" value="${esc(V.note || '')}"
             oninput="PAY.f('note', this.value, true)">

      <div class="pay-actions">
        <button class="btn btn-primary" onclick="PAY.copyMyLink()">
          <span class="material-symbols-rounded ms-18">link</span> Copy link</button>
        <button class="btn btn-ghost" onclick="PAY.shareMyLink()">
          <span class="material-symbols-rounded ms-18">ios_share</span> Share</button>
        <button class="btn btn-ghost" onclick="PAY.saveQR()">
          <span class="material-symbols-rounded ms-18">download</span> Save image</button>
      </div>
      <div class="pay-hint">Anyone can scan this with their camera or with Scan &amp; pay. They choose which asset to send unless you set an amount above.</div>`;
  }

  function assetSelect(cur, handler) {
    const list = payable().slice(0, 160);
    if (cur && list.indexOf(cur) === -1) list.unshift(cur);
    return `<select class="pay-input pay-asset" onchange="${handler}">
      ${list.map(a => `<option value="${a}"${a === cur ? ' selected' : ''}>${a}${balOf(a) > 0 ? ' — ' + qty(balOf(a)) : ''}</option>`).join('')}
    </select>`;
  }

  /* ── Scanner ─────────────────────────────────────────────────────── */
  function scanView() {
    return `
      <div class="pay-scan">
        <div class="pay-video" id="pay-video-box"><div class="pay-frame"></div></div>
        <div class="pay-scan-status" id="pay-scan-status">Point the camera at a payment QR code…</div>
      </div>
      <div class="pay-actions">
        <button class="btn btn-ghost" onclick="PAY.pickImage()">
          <span class="material-symbols-rounded ms-18">image</span> Upload a photo</button>
        <button class="btn btn-ghost" onclick="PAY.focusPaste()">
          <span class="material-symbols-rounded ms-18">content_paste</span> Paste a link</button>
      </div>
      <input type="file" id="pay-file" accept="image/*" capture="environment" hidden onchange="PAY.onFile(this)">
      <div class="pay-sec">Or paste a payment link</div>
      <textarea class="pay-input" id="pay-paste" rows="2" placeholder="Paste a Trending payment link or code"></textarea>
      <button class="btn btn-primary mt8" style="width:100%" onclick="PAY.usePasted()">Open code</button>
      ${note}`;
  }

  function setScanStatus(msg, bad) {
    const el = document.getElementById('pay-scan-status');
    if (el) { el.textContent = msg; el.className = 'pay-scan-status' + (bad ? ' bad' : ''); }
  }

  async function startScan() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanStatus('This browser can only use the camera over HTTPS or on localhost — upload a photo instead.', true);
      return;
    }
    try {
      cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (e) {
      setScanStatus(e && e.name === 'NotAllowedError'
        ? 'Camera permission was refused — upload a photo or paste a link instead.'
        : 'No camera available — upload a photo or paste a link instead.', true);
      return;
    }
    const v = document.createElement('video');
    v.playsInline = true; v.muted = true; v.autoplay = true;
    v.className = 'pay-video-el';
    v.srcObject = cam.stream;
    cam.video = v;
    const box = document.getElementById('pay-video-box');
    if (box) box.appendChild(v);
    try { await v.play(); } catch (e) {}
    setScanStatus('Scanning…');

    cam.timer = setInterval(async () => {
      if (!cam.video || cam.video.readyState < 2) return;
      try {
        const text = await decodeFrom(cam.video, cam.video.videoWidth, cam.video.videoHeight);
        if (text) { stopCam(); handleScanned(text); }
      } catch (e) {
        stopCam();
        setScanStatus('No QR reader available offline — upload a photo or paste the link.', true);
      }
    }, 260);
  }

  function stopCam() {
    if (cam.timer) { clearInterval(cam.timer); cam.timer = null; }
    if (cam.stream) { cam.stream.getTracks().forEach(t => t.stop()); cam.stream = null; }
    if (cam.video) { try { cam.video.pause(); } catch (e) {} cam.video = null; }
  }

  let jsqrLoad = null;
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (jsqrLoad) return jsqrLoad;
    const urls = [
      'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
      'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
    ];
    jsqrLoad = urls.reduce((chain, url) => chain.catch(() => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => (window.jsQR ? res(window.jsQR) : rej(new Error('bad script')));
      s.onerror = () => rej(new Error('offline'));
      document.head.appendChild(s);
    })), Promise.reject(new Error('start')));
    return jsqrLoad;
  }

  /* Native first: Chrome and Safari on phones decode in the browser, so the
     library is only fetched when there's nothing built in. */
  async function decodeFrom(source, w, h) {
    const width = Math.min(720, w || 640);
    const scale = width / (w || width);
    const c = document.createElement('canvas');
    c.width = width;
    c.height = Math.round((h || width) * scale);
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);

    if (window.BarcodeDetector) {
      try {
        const det = new window.BarcodeDetector({ formats: ['qr_code'] });
        const found = await det.detect(c);
        if (found && found.length) return found[0].rawValue;
        return null;
      } catch (e) { /* fall through to the library */ }
    }
    const jsQR = await loadJsQR();
    const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
    return r ? r.data : null;
  }

  function pickImage() { const f = document.getElementById('pay-file'); if (f) f.click(); }

  function onFile(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    setScanStatus('Reading that image…');
    const img = new Image();
    img.onload = async () => {
      try {
        const text = await decodeFrom(img, img.naturalWidth, img.naturalHeight);
        if (text) handleScanned(text);
        else setScanStatus('No QR code found in that image — try a sharper photo.', true);
      } catch (e) {
        setScanStatus('No QR reader available offline — paste the link instead.', true);
      }
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => setScanStatus('That file could not be read.', true);
    img.src = URL.createObjectURL(file);
  }

  function focusPaste() {
    const el = document.getElementById('pay-paste');
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus(); }
  }

  function usePasted() {
    const el = document.getElementById('pay-paste');
    if (!el || !el.value.trim()) { toast('Paste a payment link first.'); return; }
    handleScanned(el.value.trim());
  }

  function handleScanned(text) {
    const p = parsePayload(text);
    if (!p.ok) {
      const onchain = typeof WAD !== 'undefined' && WAD.fromScan ? WAD.parseScan(text) : null;
      if (onchain) {
        stopCam();
        const origin = V ? V.origin : 'hub', snap = V ? V.cfi : null;
        close();
        WAD.fromScan(onchain, { origin: origin === 'cfi' ? 'cfi' : 'chat', cfi: snap });
        return;
      }
      if (/^(0x[a-f0-9]{6,}|bc1|bitcoin:|ethereum:)/i.test(String(text).trim())) {
        setScanStatus('That looks like a blockchain address. Paper balances stay inside the app, so only Trending codes work here.', true);
      } else {
        setScanStatus("That isn't a Trending payment code.", true);
      }
      toast("That isn't a Trending payment code.");
      return;
    }
    stopCam();
    if (p.type === 'r') openRequestPayload(p);
    else go('pay', { to: { name: p.name, handle: p.handle, payId: p.payId }, asset: p.asset || 'USDT', amount: p.amount ? String(p.amount) : '', note: p.note || '', locked: !!p.amount, rid: '' });
  }

  /* A scanned request is stored so its status has somewhere to live. */
  function openRequestPayload(p) {
    if (!p.rid || !p.amount || !p.asset) { toast('That request is incomplete.'); return; }
    if (String(p.payId) === String(myId())) {
      const own = D.sent.find(r => r.rid === p.rid);
      if (own) { go('list'); toast('That’s your own request.'); return; }
    }
    let r = D.recv.find(x => x.rid === p.rid);
    if (!r) {
      r = {
        rid: p.rid, from: { name: p.name, handle: p.handle, payId: p.payId },
        asset: p.asset, amount: p.amount, note: p.note,
        created: p.created || Date.now(), exp: p.exp || (Date.now() + 864e5), status: 'pending'
      };
      D.recv.unshift(r);
      save();
      const c = contactBy(p.handle);
      if (c) postCard(ensureDM(c), { kind: 'payreq', me: false, rid: r.rid });
    }
    payRequest(r.rid);
  }

  function payRequest(rid) {
    const r = D.recv.find(x => x.rid === rid);
    if (!r) { toast('Request not found.'); return; }
    const st = statusOf(r);
    if (st !== 'pending') { toast(`This request is ${st}.`); return; }
    if (!V) V = { origin: 'chat', trail: [] };
    go('pay', {
      to: { name: r.from.name, handle: r.from.handle, payId: r.from.payId },
      asset: r.asset, amount: String(r.amount), note: r.note || '', locked: true, rid: r.rid
    });
  }

  /* ── Create a request ────────────────────────────────────────────── */
  function reqView() {
    const asset = V.asset || 'USDT';
    const ttl = V.ttl || 864e5;
    return `
      <label class="pay-lbl">Recipient</label>
      <select class="pay-input" onchange="PAY.f('to', this.value)">
        <option value=""${!V.to ? ' selected' : ''}>${V.chatId != null && V.chatName
          ? esc(V.chatName) + ' (this chat)' : 'Anyone with the link'}</option>
        ${contacts().map(c => `<option value="${esc(c.handle)}"${V.to === c.handle ? ' selected' : ''}>${esc(c.name)} (${esc(c.handle)})</option>`).join('')}
      </select>

      <label class="pay-lbl">Asset and amount</label>
      <div class="pay-row">
        <input class="pay-input" type="number" step="any" min="0" placeholder="0.00" value="${esc(V.amount || '')}"
               oninput="PAY.f('amount', this.value)">
        ${assetSelect(asset, "PAY.f('asset', this.value)")}
      </div>

      <label class="pay-lbl">Note</label>
      <input class="pay-input" type="text" maxlength="${MAX_NOTE}" placeholder="What's it for?" value="${esc(V.note || '')}"
             oninput="PAY.f('note', this.value)">

      <label class="pay-lbl">Expires in</label>
      <div class="pay-chips">
        ${TTLS.map(([l, ms]) => `<button class="pay-chip${ttl === ms ? ' active' : ''}" onclick="PAY.f('ttl', ${ms})">${l}</button>`).join('')}
      </div>

      <div class="pay-sum" id="pay-sum"></div>
      <button class="btn btn-primary mt12" style="width:100%" onclick="PAY.submitRequest()">Create request</button>
      ${note}`;
  }

  function submitRequest() {
    const res = createRequest({
      to: V.to || '', chatId: V.to ? null : (V.chatId != null ? V.chatId : null), toName: V.chatName || '',
      asset: V.asset || 'USDT', amount: V.amount, note: V.note, ttl: V.ttl || 864e5
    });
    toast(res.msg);
    if (res.ok) go('made', { rid: res.r.rid, replace: true });
  }

  function madeView() {
    const r = D.sent.find(x => x.rid === V.rid);
    if (!r) return `<div class="pay-empty">That request is gone.</div>`;
    const link = requestLink(r);
    let code = '';
    try { code = QRGEN.svg(QRGEN.make(link), 208, 'T'); }
    catch (e) { code = '<div class="pay-empty">This request is too long to put in a QR code.</div>'; }

    return `
      <div class="pay-qrwrap">
        ${code}
        <div class="pay-qr-amt">${esc(qty(r.amount))} ${esc(r.asset)}<span> · ${esc(usd(r.amount * priceOf(r.asset)))}</span></div>
        <div class="pay-qr-handle">${r.to ? 'For ' + esc(r.to.name) : 'Anyone with the link'} · ${esc(leftOf(r))}</div>
        ${r.note ? `<div class="pay-qr-note">${esc(r.note)}</div>` : ''}
      </div>
      <div class="pay-actions">
        ${r.to ? `<button class="btn btn-primary" onclick="PAY.openChat('${esc(r.to.handle)}')">
          <span class="material-symbols-rounded ms-18">chat</span> Open chat</button>` : ''}
        <button class="btn btn-ghost" onclick="PAY.share('${esc(r.rid)}')">
          <span class="material-symbols-rounded ms-18">ios_share</span> Share</button>
        <button class="btn btn-ghost" onclick="PAY.copyLink('${esc(r.rid)}')">
          <span class="material-symbols-rounded ms-18">link</span> Copy link</button>
      </div>
      <div class="pay-hint">${r.to
        ? esc(r.to.name) + ' has the request in your chat. You\'ll be credited when it\'s paid.'
        : 'Anyone who opens this link or scans the code can pay it until it expires.'}</div>`;
  }

  /* ── Pay sheet ───────────────────────────────────────────────────── */
  function payView() {
    const to = V.to || {};
    const known = contactBy(to.handle);
    const asset = V.asset || 'USDT';

    return `
      <div class="pay-to">
        <div class="pay-av lg">${esc(initials(to.name))}</div>
        <div class="pay-to-name">${esc(to.name || 'Unknown account')}</div>
        <div class="pay-to-handle">${esc(to.handle || '')}${to.payId ? ' · Pay ID ' + esc(prettyId(to.payId)) : ''}</div>
        <div class="pay-verdict ${known ? 'ok' : 'warn'}">
          <span class="material-symbols-rounded ms-16">${known ? 'verified' : 'info'}</span>
          ${known ? 'In your contacts' : 'Not in your contacts — check the name before paying'}
        </div>
      </div>

      <label class="pay-lbl">Asset</label>
      ${V.locked
        ? `<div class="pay-locked">${ic(asset, 20)}<b>${esc(asset)}</b><span>set by the request</span></div>`
        : `<div class="pay-chips">${chipAssets(asset).map(a => `
            <button class="pay-chip${a === asset ? ' active' : ''}" onclick="PAY.f('asset','${a}')">
              ${ic(a, 16)} ${a}</button>`).join('')}</div>
           ${payable().length > 8 ? assetSelect(asset, "PAY.f('asset', this.value)") : ''}
           <div class="pay-hint sm">Available: <b>${esc(qty(balOf(asset)))} ${esc(asset)}</b> · ${esc(usd(balOf(asset) * priceOf(asset)))}</div>`}

      <label class="pay-lbl">Amount</label>
      ${V.locked
        ? `<div class="pay-locked big">${esc(qty(parseFloat(V.amount)))} ${esc(asset)}</div>`
        : `<input class="pay-input" type="number" step="any" min="0" placeholder="0.00" value="${esc(V.amount || '')}"
                  oninput="PAY.f('amount', this.value)">`}

      <label class="pay-lbl">Note</label>
      <input class="pay-input" type="text" maxlength="${MAX_NOTE}" placeholder="Optional" value="${esc(V.note || '')}"
             ${V.locked ? 'readonly' : ''} oninput="PAY.f('note', this.value)">

      <div class="pay-sum" id="pay-sum"></div>
      <button class="btn btn-primary" id="pay-go" style="width:100%" onclick="PAY.submitPay()">Confirm payment</button>
      ${note}`;
  }

  function paintSummary() {
    const box = document.getElementById('pay-sum');
    if (!box || !V) return;
    const asset = V.asset || 'USDT';
    const amt = parseFloat(V.amount) || 0;
    const px = priceOf(asset);

    if (V.view === 'req') {
      box.innerHTML = `
        <div class="pay-line"><span>Value</span><b>${esc(usd(amt * px))}</b></div>
        <div class="pay-line"><span>Goes to</span><b>Your wallet</b></div>
        <div class="pay-line"><span>Expires</span><b>${esc((TTLS.find(t => t[1] === (V.ttl || 864e5)) || TTLS[2])[0])}</b></div>`;
      return;
    }

    const have = balOf(asset);
    const short = amt > 0 && amt > have;
    box.innerHTML = `
      <div class="pay-line"><span>Value</span><b>${esc(usd(amt * px))}</b></div>
      <div class="pay-line"><span>Network fee</span><b>Free · in-app transfer</b></div>
      <div class="pay-line"><span>Balance after</span><b class="${short ? 'tc-red' : ''}">${esc(qty(Math.max(0, have - amt)))} ${esc(asset)}</b></div>
      ${short ? `<div class="pay-warn">Not enough ${esc(asset)} — you hold ${esc(qty(have))}.</div>` : ''}`;
    const btn = document.getElementById('pay-go');
    if (btn) btn.disabled = !(amt > 0) || short;
  }

  function submitPay() {
    const res = pay({ to: V.to, asset: V.asset, amount: V.amount, note: V.note, rid: V.rid });
    toast(res.msg);
    if (res.ok) go('done', { tx: res.tx, replace: true });
  }

  function doneView() {
    const t = V.tx || {};
    return `
      <div class="pay-done">
        <div class="pay-check"><span class="material-symbols-rounded">check</span></div>
        <div class="pay-done-amt">${esc(qty(t.qty))} ${esc(t.asset)}</div>
        <div class="pay-done-sub">${esc(usd(t.usd))} to ${esc(t.name)}</div>
        ${t.note ? `<div class="pay-qr-note">${esc(t.note)}</div>` : ''}
        <div class="pay-receipt">
          <div class="pay-line"><span>Reference</span><b>${esc(String(t.id || '').toUpperCase())}</b></div>
          <div class="pay-line"><span>Time</span><b>${esc(new Date(t.ts || Date.now()).toLocaleString())}</b></div>
          <div class="pay-line"><span>Paid from</span><b>Your wallet</b></div>
        </div>
      </div>
      <div class="pay-actions">
        <button class="btn btn-primary" onclick="PAY.finish()">Done</button>
        ${contactBy(t.handle) ? `<button class="btn btn-ghost" onclick="PAY.openChat('${esc(t.handle)}')">
          <span class="material-symbols-rounded ms-18">chat</span> Open chat</button>` : ''}
      </div>`;
  }

  /* ── Field updates ───────────────────────────────────────────────── */
  /* Amount and note repaint only the summary so the caret stays put; the
     asset and expiry change what's drawn, so those repaint fully. */
  function f(key, value, rerender) {
    if (!V) return;
    V[key] = value;
    // Naming a contact overrides "this chat" as the delivery address.
    if (key === 'to' && value) V.chatId = null;
    if (rerender || key === 'asset' || key === 'ttl' || key === 'to') render();
    else paintSummary();
  }

  /* ── Sharing ─────────────────────────────────────────────────────── */
  function copy(text, okMsg) {
    const done = () => toast(okMsg || 'Copied');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed — select the link manually.'); }
    ta.remove();
  }

  function shareURL(url, title, text) {
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => {});
      return;
    }
    copy(url, 'Link copied — paste it anywhere');
  }

  function copyMyLink() {
    const amt = parseFloat(V && V.amount) > 0 ? parseFloat(V.amount) : 0;
    copy(amt ? myLink({ a: V.asset || 'USDT', m: amt, note: V.note || '' }) : myLink(), 'Payment link copied');
  }
  function shareMyLink() {
    const amt = parseFloat(V && V.amount) > 0 ? parseFloat(V.amount) : 0;
    const m = me();
    shareURL(amt ? myLink({ a: V.asset || 'USDT', m: amt, note: V.note || '' }) : myLink(),
      'Pay ' + m.name, 'Pay me on Trending');
  }

  function copyLink(rid) {
    const r = D.sent.find(x => x.rid === rid) || D.recv.find(x => x.rid === rid);
    if (r) copy(requestLink(r), 'Request link copied');
  }
  function share(rid) {
    const r = D.sent.find(x => x.rid === rid) || D.recv.find(x => x.rid === rid);
    if (!r) return;
    shareURL(requestLink(r), 'Payment request', `${qty(r.amount)} ${r.asset}${r.note ? ' — ' + r.note : ''}`);
  }

  function saveQR() {
    const amt = parseFloat(V && V.amount) > 0 ? parseFloat(V.amount) : 0;
    const link = amt ? myLink({ a: V.asset || 'USDT', m: amt, note: V.note || '' }) : myLink();
    try {
      const c = QRGEN.canvas(QRGEN.make(link), 10);
      const a = document.createElement('a');
      a.download = 'trending-pay-qr.png';
      a.href = c.toDataURL('image/png');
      a.click();
      toast('QR code saved');
    } catch (e) { toast('Could not save the image.'); }
  }

  /* ── Entry points used by other modules ──────────────────────────── */
  function openRequestFor(handle) {
    const c = contactBy(handle);
    V = { view: 'req', origin: 'hub', trail: [], to: c ? c.handle : '', asset: 'USDT', amount: '', note: '', ttl: 864e5 };
    render();
  }

  /* The chat panel's Request button — the thread is the delivery address. */
  function openRequestForChat(chatId, opts) {
    const o = opts || {};
    const convo = ((typeof DATA !== 'undefined' && DATA.conversations) || [])
      .find(c => String(c.id) === String(chatId));
    const c = convo ? contacts().find(u => u.name === convo.name) : null;
    V = {
      view: 'req', origin: o.origin || 'cfi', cfi: o.cfi || null, trail: [],
      to: c ? c.handle : '', chatId: chatId != null ? chatId : null,
      chatName: convo ? convo.name : '', asset: 'USDT', amount: '', note: '', ttl: 864e5
    };
    render();
  }

  /* Used by the chat panel and the Wallet tab's send form. */
  function openPayTo(opts) {
    const o = opts || {};
    const c = o.handle ? contactBy(o.handle) : null;
    V = {
      view: 'pay', origin: o.origin || 'hub', trail: [],
      to: c ? { name: c.name, handle: c.handle, payId: c.payId } : { name: o.name || o.handle || 'Unknown account', handle: o.handle || '', payId: '' },
      asset: (o.asset || 'USDT').toUpperCase(), amount: o.amount ? String(o.amount) : '', note: o.note || '', locked: false, rid: ''
    };
    render();
  }

  // From the chat menu these pass { from: 'chat' }; Profile's wallet passes nothing.
  const openScan = o => { V = { origin: fromChat(o), trail: [] }; go('scan'); };
  const openMyQR = o => { V = { view: 'qr', origin: fromChat(o), trail: [], asset: 'USDT', amount: '', note: '' }; render(); };

  /* ── Deep links ──────────────────────────────────────────────────── */
  function handleHash() {
    const h = location.hash || '';
    if (h.indexOf('#pay?') !== 0) return false;
    const p = parsePayload(h);
    history.replaceState(null, '', location.pathname + location.search);
    if (!p.ok) return false;
    if (p.type === 'r') openRequestPayload(p);
    else {
      V = {};
      go('pay', {
        to: { name: p.name, handle: p.handle, payId: p.payId },
        asset: p.asset || 'USDT', amount: p.amount ? String(p.amount) : '',
        note: p.note || '', locked: !!p.amount, rid: ''
      });
    }
    return true;
  }

  /* ── Boot ────────────────────────────────────────────────────────── */
  function seed() {
    if (D.seeded) return;
    D.seeded = true;
    myId();
    const from = contacts()[0];
    if (from) {
      const r = {
        rid: newRid(), from: { name: from.name, handle: from.handle, payId: from.payId },
        asset: 'USDT', amount: 12, note: 'Coffee ☕',
        created: Date.now() - 12 * 60000, exp: Date.now() + 23 * 3600000, status: 'pending'
      };
      D.recv.unshift(r);
      save();
      const chatId = ensureDM(from);
      postCard(chatId, { kind: 'payreq', me: false, rid: r.rid });
    }
    save();
  }

  function boot() {
    installDMs();
    seed();
    // Messages may already have painted its list by now.
    if (typeof TG !== 'undefined' && TG.paintList && document.getElementById('chat-list')) TG.paintList();
    setTimeout(handleHash, 600);
    window.addEventListener('hashchange', handleHash);
  }

  // Never during this script's own evaluation: boot() posts chat cards, and
  // the modules it calls back into would find PAY still uninitialised.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);

  return {
    openHub, openScan, openMyQR, openRequestFor, openRequestForChat, openPayTo, openChat,
    go, back, finish, close, f, submitPay, submitRequest,
    createRequest, cancelRequest, declineRequest, payRequest, pay,
    pickImage, onFile, usePasted, focusPaste, copyMyLink, shareMyLink, copyLink, share, saveQR,
    cardHTML, previewOf, parsePayload, linkFor, myLink, requestLink,
    contacts, me, statusOf, ASSETS,
    get state() { return D; }
  };
})();

window.PAY = PAY;
