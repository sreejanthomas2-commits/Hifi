/* Builds "HiFi - Your Digital Universe.pdf":

     node docs/hifi/build-pdf.js

   1. Prints index.html (the cover, contents and Part 2) with Chromium.
   2. finalize.py inserts how-hifi-works.pdf (Part 1, 16 pages) after
      page INSERT_AT, numbers its pages, and adds the title and bookmarks.

   Needs Playwright's Chromium, and Python 3 with pypdf and reportlab.
   Refuses to write the PDF if any page's content runs into the footer,
   so a long paragraph cannot silently disappear off a page. */
'use strict';

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const DIR = __dirname;
const SRC = path.join(DIR, 'index.html');
const RAW = path.join(DIR, '.raw.pdf');
const OUT = path.join(DIR, 'HiFi - Your Digital Universe.pdf');
const PART1 = path.join(DIR, 'how-hifi-works.pdf');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + SRC, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__HIFI_READY === true);
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });

  // Content must end above the footer rule (17 mm from the bottom).
  const report = await page.evaluate(() => {
    const mm = 96 / 25.4;
    const out = [];
    const outline = [];
    document.querySelectorAll('.page').forEach((p, i) => {
      if (p.dataset.toc) outline.push({ title: p.dataset.toc, page: i, level: Number(p.dataset.level || 0) });
      if (p.dataset.bare !== undefined) return;
      const r = p.getBoundingClientRect();
      const limit = r.bottom - 16.5 * mm;
      const right = r.right - 14 * mm;
      let worst = null;
      p.querySelectorAll('*').forEach(el => {
        if (el.closest('.ph, .pf, .band')) return;
        const b = el.getBoundingClientRect();
        if (!b.height) return;
        if (b.bottom > limit + 0.5 && (!worst || b.bottom > worst.bottom)) worst = { bottom: b.bottom, tag: el.tagName + '.' + el.className, text: (el.textContent || '').trim().slice(0, 60) };
        if (b.right > right + 0.5 && !el.closest('.phone')) out.push({ page: i + 1, kind: 'right', by: Math.round(b.right - right), tag: el.tagName + '.' + el.className });
      });
      if (worst) out.push({ page: i + 1, kind: 'bottom', by: Math.round(worst.bottom - limit), tag: worst.tag, text: worst.text });
    });
    return { out, outline, pages: document.querySelectorAll('.page').length };
  });

  if (errors.length) { console.error('Script errors:\n' + errors.join('\n')); }
  if (report.out.length) {
    console.error('Layout problems:');
    const seen = new Set();
    report.out.forEach(o => { const k = o.page + o.kind + o.tag; if (!seen.has(k)) { seen.add(k); console.error(' ', JSON.stringify(o)); } });
    if (!process.argv.includes('--force')) { await browser.close(); process.exit(1); }
  }

  await page.pdf({ path: RAW, printBackground: true, preferCSSPageSize: true });
  await browser.close();

  fs.writeFileSync(path.join(DIR, '.outline.json'), JSON.stringify(report.outline));
  const insertAt = Number(fs.readFileSync(SRC, 'utf8').match(/data-insert-at="(\d+)"/)[1]);
  execFileSync('python3', ['-I', path.join(DIR, 'finalize.py'), RAW, PART1, path.join(DIR, '.outline.json'), OUT, String(insertAt)], { stdio: 'inherit' });
  fs.unlinkSync(RAW);
  fs.unlinkSync(path.join(DIR, '.outline.json'));
  console.log(`Wrote ${OUT} (${report.pages} printed pages + Part 1)`);
})().catch(e => { console.error(e); process.exit(1); });
