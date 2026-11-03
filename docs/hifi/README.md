# HiFi — Your Digital Universe

The full and final guide to HiFi, as one 47-page A4 PDF:
[`HiFi - Your Digital Universe.pdf`](./HiFi%20-%20Your%20Digital%20Universe.pdf).

| Pages | Part | Source |
|---|---|---|
| 1–3 | Cover, contents, about this edition | `index.html` |
| 4–19 | **Part 1 · How HiFi works**: every screen, with screenshots and flow charts | `how-hifi-works.pdf` (supplied, inserted unchanged apart from page numbers) |
| 20–47 | **Part 2 · Beyond the screens**: crypto in chat, communities, community crypto, earning, security end to end (including the end-to-end encryption design), HiFi on mobile, HiFi Chain and the HIFI coin, roadmap | `index.html` |

## Rebuilding

```bash
node docs/hifi/build-pdf.js
```

Needs Playwright's Chromium (preinstalled in Claude Code cloud sessions) and
Python 3 with `pypdf` and `reportlab`.

1. `build-pdf.js` prints `index.html` with Chromium and refuses to write the
   PDF if any page's content runs into the footer.
2. `finalize.py` inserts `how-hifi-works.pdf` after page 3, numbers its pages,
   and adds the title and bookmarks.

`<body data-insert-at="3" data-insert-n="16">` in `index.html` tells the page
numbers, contents and cross-references where Part 1 sits. If Part 1 changes
length, update `data-insert-n`; the `PART1` list in `finalize.py` holds its
bookmarks.

## Files

| File | What it is |
|---|---|
| `index.html` | Cover, contents and Part 2, one `<section class="page">` per A4 page |
| `hifi.css` | Print styles in HiFi's orange-and-gold brand, including the phone mock-ups |
| `hifi.js` | Line icons, phone bottom bars, running heads, page numbers and cross-references |
| `hifi-logo.png`, `hifi-logo-ink.png` | The HiFi logo from Part 1's cover: white letters for dark pages, ink letters for light ones |

## Labels

Every feature carries one: **Real**, **Practice** and **This device** (as in
Part 1), plus **Ready** (built on the server, switched off until a licence,
partner or hardware exists) and **Planned** (designed, not built). Keep them
true to the code: the app's rule is that a screen never claims something the
app does not do, and this document follows it.
