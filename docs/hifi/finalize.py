"""Merges the printed Part 2 pages with "How HiFi works" (Part 1) into the
final PDF, and adds page numbers to Part 1, the title, and the bookmarks.

Usage: python3 -I finalize.py printed.pdf part1.pdf outline.json out.pdf INSERT_AT
"""
import io
import json
import sys

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas

printed_path, part1_path, outline_path, out_path, insert_at = sys.argv[1:6]
insert_at = int(insert_at)

printed = PdfReader(printed_path)
part1 = PdfReader(part1_path)
n1 = len(part1.pages)

# Part 1's chapters, by page within Part 1 (0-based).
PART1 = [
    ("Overview: what HiFi is", 1),
    ("1 Getting in: the opening page", 2),
    ("2 The map of the app", 3),
    ("3 Home, stories and posts", 4),
    ("3 Story shapes", 5),
    ("4 Search, Explore and Shorty", 6),
    ("5 Chat, notes and communities", 7),
    ("6 Profile and notifications", 8),
    ("7 HiFi Web3 Wallet", 9),
    ("8 HiFi Pay", 10),
    ("9 HiFi Crypto Card", 11),
    ("10 Markets, Trade and P2P", 12),
    ("11 Assets, Earn and Settings", 13),
    ("12 How HiFi is built", 14),
    ("13 Safety and what comes next", 15),
]
assert n1 == 16, f"expected the 16-page How HiFi works, got {n1} pages"


def number_stamp(page, number):
    """A small page number in the same place as Part 2's footer number:
    15 mm from the right edge, 8 mm from the bottom."""
    w = float(page.mediabox.width)
    h = float(page.mediabox.height)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(w, h))
    mm = 72 / 25.4
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(Color(0.55, 0.57, 0.66))
    c.drawRightString(w - 15 * mm, 8 * mm, str(number))
    c.save()
    buf.seek(0)
    return PdfReader(buf).pages[0]


writer = PdfWriter()
for i in range(insert_at):
    writer.add_page(printed.pages[i])
for j in range(n1):
    page = writer.add_page(part1.pages[j])
    if j > 0:  # the cover stays clean, as Part 2's opener does
        page.merge_page(number_stamp(page, insert_at + j + 1))
for i in range(insert_at, len(printed.pages)):
    writer.add_page(printed.pages[i])

writer.add_metadata({
    "/Title": "HiFi — Your Digital Universe",
    "/Author": "HiFi",
    "/Subject": "The full and final guide: how HiFi works screen by screen, plus crypto in chat, "
                "community crypto, earning, end-to-end security, the mobile app, and HiFi Chain "
                "with the HIFI coin",
    "/Keywords": "HiFi, social, chat, community, crypto, Web3 wallet, HiFi Pay, end-to-end "
                 "encryption, mobile app, blockchain, HIFI coin",
    "/Creator": "docs/hifi/build-pdf.js",
})
writer.page_mode = "/UseOutlines"

# Bookmarks: Part 2's own entries, moved past Part 1, plus Part 1's chapters.
items = []
for it in json.load(open(outline_path)):
    p = it["page"] if it["page"] < insert_at else it["page"] + n1
    items.append((p, it["level"], it["title"]))
items.append((insert_at, 0, "Part 1 · How HiFi works"))
for title, j in PART1:
    items.append((insert_at + j, 1, title))
items.sort(key=lambda x: (x[0], x[1]))

parents = {}
for page, level, title in items:
    parent = parents.get(level - 1) if level > 0 else None
    parents[level] = writer.add_outline_item(title, page, parent=parent)

with open(out_path, "wb") as f:
    writer.write(f)
print(f"{len(writer.pages)} pages")
