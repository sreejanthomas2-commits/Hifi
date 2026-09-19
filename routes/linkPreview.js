/* ╔══════════════════════════════════════════════════════════════════╗
   ║  LINK PREVIEW — GET /api/link-preview?url=https://…               ║
   ║                                                                  ║
   ║  Reads a page's title, description and preview image so a Note   ║
   ║  can show a compact card. The browser can't read other sites     ║
   ║  (CORS), so the server does — carefully, because a URL fetcher   ║
   ║  is a classic way into a private network:                        ║
   ║                                                                  ║
   ║  · http and https only, ports 80 and 443 only                    ║
   ║  · every hostname is resolved first; loopback, private, link-    ║
   ║    local, carrier-grade NAT, multicast and reserved addresses    ║
   ║    are refused, and the request is pinned to the address that    ║
   ║    was checked (no DNS rebinding between check and connect)      ║
   ║  · redirects are followed at most 3 times, each one re-checked   ║
   ║  · 5 s timeout, 512 KB page cap, 200 KB image cap                ║
   ║  · the preview image comes back as a data: URL, so people who    ║
   ║    view the Note never load anything from the linked site        ║
   ║  · per-IP rate limit and a short in-memory cache                 ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');

const router = express.Router();

const LIMITS = { timeoutMs: 5000, pageBytes: 512 * 1024, imageBytes: 200 * 1024, redirects: 3 };
const CACHE_TTL = 60 * 60 * 1000;
const CACHE_MAX = 200;
const RATE = { windowMs: 60 * 1000, max: 20 };

const cache = new Map();
const hits = new Map();

/* ── Address checks ──────────────────────────────────────────────── */
function v4ToInt(ip) { return ip.split('.').reduce((n, o) => (n * 256) + Number(o), 0) >>> 0; }
const V4_BLOCKED = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
].map(([base, bits]) => [v4ToInt(base), bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0]);

function blockedV4(ip) {
  const n = v4ToInt(ip);
  return V4_BLOCKED.some(([base, mask]) => ((n & mask) >>> 0) === ((base & mask) >>> 0));
}

/* Eight 16-bit groups, whatever the spelling: '::ffff:127.0.0.1', '::ffff:7f00:1'
   and '0:0:0:0:0:ffff:7f00:0001' are all the same address. */
function expandV6(ip) {
  let a = ip.toLowerCase().split('%')[0];
  const dotted = a.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const n = v4ToInt(dotted[1]);
    a = a.slice(0, -dotted[1].length) + ((n >>> 16) & 0xffff).toString(16) + ':' + (n & 0xffff).toString(16);
  }
  const [head, tail] = a.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail ? tail.split(':') : [];
  const fill = a.includes('::') ? Array(8 - h.length - t.length).fill('0') : [];
  return [...h, ...fill, ...t].map(g => parseInt(g || '0', 16));
}

function blockedV6(ip) {
  const g = expandV6(ip);
  if (g.length !== 8 || g.some(x => isNaN(x))) return true;
  const v4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  const zero80 = g.slice(0, 5).every(x => x === 0);
  if (zero80 && g[5] === 0xffff) return blockedV4(v4);     // IPv4-mapped
  if (zero80 && g[5] === 0) return true;                    // ::, ::1 and IPv4-compatible
  const first = g[0];
  if ((first & 0xfe00) === 0xfc00) return true;           // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true;           // fe80::/10 link local
  if ((first & 0xff00) === 0xff00) return true;           // ff00::/8 multicast
  if (first === 0x2001 && g[1] === 0x0db8) return true;   // 2001:db8::/32 documentation
  if (first === 0x2001 && g[1] === 0x0000) return true;   // 2001::/32 Teredo tunnels
  if (first === 0x2002) return true;                      // 2002::/16 6to4 embeds any IPv4
  if (first === 0x0064 && g[1] === 0xff9b) return true;   // 64:ff9b::/96 NAT64 reaches IPv4
  if (first === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true;  // 100::/64 discard
  return false;
}

function isBlockedAddress(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) return blockedV4(ip);
  if (kind === 6) return blockedV6(ip);
  return true;
}

async function resolvePublic(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new Error('blocked address');
    return { address: host, family: net.isIP(host) };
  }
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) throw new Error('blocked host');
  const all = await dns.lookup(host, { all: true, verbatim: true });
  if (!all.length) throw new Error('no address');
  // Every address must be public: a name that also points inside is refused.
  if (all.some(r => isBlockedAddress(r.address))) throw new Error('blocked address');
  return all[0];
}

/* ── Fetching ────────────────────────────────────────────────────── */
function fetchSafe(rawUrl, accept, maxBytes, redirectsLeft = LIMITS.redirects) {
  return new Promise(async (resolve, reject) => {
    let url;
    try { url = new URL(rawUrl); } catch (e) { return reject(new Error('bad url')); }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return reject(new Error('bad protocol'));
    if (url.port && url.port !== '80' && url.port !== '443') return reject(new Error('bad port'));
    if (url.username || url.password) return reject(new Error('credentials in url'));

    let target;
    try { target = await resolvePublic(url.hostname); } catch (e) { return reject(e); }

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method: 'GET',
      headers: { 'User-Agent': 'TrendingLinkPreview/1.0 (+https://trending.app)', Accept: accept, 'Accept-Encoding': 'identity' },
      timeout: LIMITS.timeoutMs,
      // Connect to the address that was checked, not whatever DNS says next.
      lookup: (hostname, opts, cb) => {
        if (opts && opts.all) cb(null, [{ address: target.address, family: target.family }]);
        else cb(null, target.address, target.family);
      }
    }, res => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) return reject(new Error('too many redirects'));
        let next;
        try { next = new URL(res.headers.location, url).toString(); } catch (e) { return reject(new Error('bad redirect')); }
        return fetchSafe(next, accept, maxBytes, redirectsLeft - 1).then(resolve, reject);
      }
      if (status !== 200) { res.resume(); return reject(new Error('status ' + status)); }
      const type = String(res.headers['content-type'] || '').toLowerCase();
      const len = Number(res.headers['content-length'] || 0);
      if (len && len > maxBytes && !accept.startsWith('text/html')) { res.resume(); return reject(new Error('too large')); }

      const chunks = [];
      let size = 0;
      res.on('data', c => {
        size += c.length;
        if (size > maxBytes) {
          // A page only needs its <head>; keep what fits and stop reading.
          if (accept.startsWith('text/html')) { chunks.push(c.slice(0, Math.max(0, c.length - (size - maxBytes)))); res.destroy(); return; }
          res.destroy(new Error('too large'));
          return;
        }
        chunks.push(c);
      });
      const done = () => resolve({ body: Buffer.concat(chunks), type, finalUrl: url.toString() });
      res.on('end', done);
      res.on('close', () => { if (accept.startsWith('text/html') && size > maxBytes) done(); });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

/* ── Reading the page head ───────────────────────────────────────── */
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (m, d) => { const n = Number(d); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; })
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => { const n = parseInt(h, 16); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; })
    .replace(/&([a-z]+);/gi, (m, k) => ENTITIES[k.toLowerCase()] || m)
    .replace(/\s+/g, ' ').trim();
}

function meta(html, names) {
  for (const name of names) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${name}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${name}["']`, 'i');
    const m = html.match(re1) || html.match(re2);
    if (m && m[1].trim()) return decode(m[1]);
  }
  return '';
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

async function preview(rawUrl) {
  const page = await fetchSafe(rawUrl, 'text/html,application/xhtml+xml', LIMITS.pageBytes);
  if (!/text\/html|application\/xhtml\+xml/.test(page.type)) throw new Error('not html');
  const html = page.body.toString('utf8');
  const head = html.slice(0, 200000);
  const final = new URL(page.finalUrl);

  const title = clip(meta(head, ['og:title', 'twitter:title']) || decode((head.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]), 120);
  const description = clip(meta(head, ['og:description', 'twitter:description', 'description']), 200);
  const siteName = clip(meta(head, ['og:site_name', 'application-name']), 60);

  let image = null;
  const imageUrl = meta(head, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
  if (imageUrl) {
    try {
      const abs = new URL(imageUrl, final).toString();
      const img = await fetchSafe(abs, 'image/png,image/jpeg,image/webp,image/gif', LIMITS.imageBytes);
      const type = img.type.split(';')[0].trim();
      if (/^image\/(png|jpeg|webp|gif)$/.test(type)) image = `data:${type};base64,${img.body.toString('base64')}`;
    } catch (e) { /* no image is fine */ }
  }

  return {
    ok: true,
    url: final.toString(),
    domain: final.hostname.replace(/^www\./, ''),
    title: title || final.hostname.replace(/^www\./, ''),
    description,
    siteName,
    image
  };
}

/* ── Route ───────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  res.set('Cache-Control', 'private, max-age=600');
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  const now = Date.now();
  const h = (hits.get(ip) || []).filter(t => now - t < RATE.windowMs);
  if (h.length >= RATE.max) { hits.set(ip, h); return res.status(429).json({ ok: false, error: 'rate_limited' }); }
  h.push(now);
  hits.set(ip, h);
  if (hits.size > 5000) hits.clear();

  const raw = String(req.query.url || '').trim();
  if (!raw || raw.length > 2048) return res.status(400).json({ ok: false, error: 'bad_url' });

  const cached = cache.get(raw);
  if (cached && now - cached.at < CACHE_TTL) return res.json(cached.data);

  try {
    const data = await preview(raw);
    cache.set(raw, { at: now, data });
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    res.json(data);
  } catch (e) {
    // Not an error for the caller: the note just shows a plain link card.
    res.json({ ok: false, error: 'unavailable' });
  }
});

module.exports = router;
module.exports._test = { isBlockedAddress };
