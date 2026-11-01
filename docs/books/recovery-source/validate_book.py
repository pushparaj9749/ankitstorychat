#!/usr/bin/env python3
"""Technical and content-structure QA for the finished recovery book."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

import pymupdf
from PIL import Image
from pypdf import PdfReader

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PDF = ROOT / "docs" / "books" / "Nasha_Aur_Masturbation_Addiction_Se_Azaadi_Ankit_Mahato.pdf"
REPORT = HERE / "validation_report.json"
MANIFEST = HERE / "book_manifest.json"
sys.path.insert(0, str(HERE))

from references import REFERENCES, REF_MAP  # noqa: E402
from extras import WORKSHEETS  # noqa: E402
from workbook import DAYS  # noqa: E402
import content_part1, content_part2, content_part3, content_part4  # noqa: E402
import content_part5, content_part6, content_part7, content_part8  # noqa: E402

PARTS = [m.PART for m in [
    content_part1, content_part2, content_part3, content_part4,
    content_part5, content_part6, content_part7, content_part8,
]]
CHAPTERS = [c for p in PARTS for c in p["chapters"]]
SECTIONS = [s for c in CHAPTERS for s in c["sections"]]


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def flatten_outline(items):
    count = 0
    for item in items:
        if isinstance(item, list):
            count += flatten_outline(item)
        else:
            count += 1
    return count


def source_words():
    chunks = []
    for part in PARTS:
        chunks.extend([part["title"], part["subtitle"], part["intro"]])
        for chapter in part["chapters"]:
            chunks.extend([chapter["title"], chapter["subtitle"]])
            for section in chapter["sections"]:
                chunks.append(section["title"])
                chunks.extend(section["paragraphs"])
                chunks.extend(section["bullets"])
                if section.get("callout"):
                    chunks.extend(section["callout"])
                if section.get("exercise"):
                    chunks.append(section["exercise"][0])
                    chunks.extend(section["exercise"][1])
    for day in DAYS:
        chunks.extend(str(v) for key, v in day.items() if key != "day")
        chunks.extend(day["reflection"])
    return len(" ".join(chunks).split())


def validate_source():
    require(len(PARTS) == 8, "Expected eight core parts")
    require([c["number"] for c in CHAPTERS] == list(range(1, 19)), "Chapter numbering must be 1–18")
    require(len(SECTIONS) == 117, "Expected 117 detailed sections")
    require([d["day"] for d in DAYS] == list(range(1, 31)), "Workbook days must be 1–30")
    require(len(WORKSHEETS) == 8, "Expected eight reusable worksheets")
    require(len(REFERENCES) == 26 and len(REF_MAP) == 26, "Expected 26 unique references")
    require(len({r["url"] for r in REFERENCES}) == 26, "Reference URLs must be unique")

    used = []
    for chapter in CHAPTERS:
        require(chapter["refs"], f"Chapter {chapter['number']} lacks a research trail")
        used.extend(chapter["refs"])
        for section in chapter["sections"]:
            require(section["paragraphs"], f"Empty section: {section['title']}")
            require(len(section["paragraphs"]) >= 2, f"Section needs depth: {section['title']}")
    unknown = sorted(set(used) - set(REF_MAP))
    require(not unknown, f"Unknown reference IDs: {unknown}")
    uncited = sorted(set(REF_MAP) - set(used))
    require(not uncited, f"References not used in any chapter: {uncited}")

    for part in PARTS:
        path = HERE / "assets" / part["image"]
        require(path.is_file(), f"Missing part image: {path.name}")
        with Image.open(path) as im:
            require(im.size == (1376, 768), f"Unexpected illustration dimensions: {path.name} {im.size}")
    for extra in ["09-30-day-plan.jpg", "03-triggers.jpg"]:
        require((HERE / "assets" / extra).is_file(), f"Missing workbook/toolkit image {extra}")
    with Image.open(HERE / "assets" / "cover.jpg") as cover:
        require(cover.size == (848, 1264), f"Unexpected cover dimensions {cover.size}")

    all_source = json.dumps([PARTS, DAYS], ensure_ascii=False)
    for token in ["112", "14446", "14416", "1800-891-4416", "1800-11-2356"]:
        require(token in all_source or token in json.dumps(WORKSHEETS), f"Missing safety number {token}")
    return {
        "core_parts": len(PARTS),
        "chapters": len(CHAPTERS),
        "detailed_sections": len(SECTIONS),
        "workbook_days": len(DAYS),
        "reusable_worksheets": len(WORKSHEETS),
        "references": len(REFERENCES),
        "source_words": source_words(),
        "reference_use_counts": dict(sorted(Counter(used).items())),
    }


def validate_pdf():
    require(PDF.is_file() and PDF.stat().st_size > 1_000_000, "PDF missing or unexpectedly small")
    doc = pymupdf.open(PDF)
    reader = PdfReader(str(PDF))
    require(len(doc) >= 140, "Unexpectedly short PDF")
    require(len(doc) == len(reader.pages), "Page count mismatch between PDF libraries")
    require(all(abs(p.rect.width - 432) < 0.01 and abs(p.rect.height - 648) < 0.01 for p in doc), "Non-6×9 page detected")
    require(reader.metadata.title == "Nasha Aur Masturbation Addiction Se Azaadi", "Incorrect PDF title metadata")
    require(reader.metadata.author == "Ankit Mahato", "Incorrect PDF author metadata")

    page_texts = [p.get_text() for p in doc]
    full_text = "\n".join(page_texts)
    normalised = re.sub(r"\s+", " ", full_text)
    require("**" not in full_text and "<b>" not in full_text, "Unrendered markup leaked into PDF")
    require("Traceback" not in full_text and "\ufffd" not in full_text, "Error/replacement glyph in PDF")

    for chapter in CHAPTERS:
        require(re.sub(r"\s+", " ", chapter["title"]) in normalised, f"Missing chapter title {chapter['number']}")
    chapter_pages = {}
    for number in range(1, 19):
        needle = f"CHAPTER {number:02d}"
        pages = [i + 1 for i, text in enumerate(page_texts) if needle in text]
        require(len(pages) == 1, f"Chapter marker {needle} should appear on one page, got {pages}")
        chapter_pages[number] = pages[0]
    day_pages = {}
    for number in range(1, 31):
        pattern = re.compile(rf"DAY\s+{number:02d}\s*/\s*30")
        pages = [i + 1 for i, text in enumerate(page_texts) if pattern.search(text)]
        require(len(pages) == 1, f"Workbook day {number} should start on exactly one page, got {pages}")
        day_pages[number] = pages[0]
    require(len(set(day_pages.values())) == 30, "Workbook days are not on 30 distinct pages")
    require(all(day_pages[n + 1] == day_pages[n] + 1 for n in range(1, 30)), "Workbook day pages are not contiguous")
    for ref in REFERENCES:
        require(ref["citation"].split(".")[0] in normalised, f"Reference missing from PDF: {ref['id']}")

    blank_pages = [i + 1 for i, text in enumerate(page_texts) if len(text.strip()) < 150]
    require(blank_pages == [1], f"Unexpected blank/near-blank pages: {blank_pages}")
    out_of_bounds = []
    for idx, page in enumerate(doc, 1):
        for block in page.get_text("blocks"):
            x0, y0, x1, y1 = block[:4]
            if x0 < -0.5 or y0 < -0.5 or x1 > page.rect.width + 0.5 or y1 > page.rect.height + 0.5:
                out_of_bounds.append({"page": idx, "bbox": [x0, y0, x1, y1]})
    require(not out_of_bounds, f"Text outside page bounds: {out_of_bounds[:3]}")

    links = [link for page in doc for link in page.get_links()]
    uris = {link.get("uri") for link in links if link.get("uri")}
    expected_uris = {r["url"] for r in REFERENCES}
    require(expected_uris <= uris, f"Missing external reference links: {sorted(expected_uris - uris)}")
    unresolved = [link for link in links if link.get("kind") == pymupdf.LINK_GOTO and link.get("page", 0) < 0]
    require(not unresolved, "Unresolved internal PDF links")
    require(len(links) >= 250, "Expected clickable TOC, research trails and references")
    outline_count = flatten_outline(reader.outline)
    require(outline_count >= 190, f"Too few PDF bookmarks: {outline_count}")

    image_xrefs = {img[0] for page in doc for img in page.get_images(full=True)}
    require(len(image_xrefs) == 10, f"Expected ten unique embedded illustrations including cover, got {len(image_xrefs)}")
    require(len(doc[0].get_images(full=True)) == 1, "Cover image missing")
    require(len(page_texts[0].strip()) == 0, "Cover should be image-only")

    report = {
        "status": "PASS",
        "pdf": str(PDF.relative_to(ROOT)),
        "pages": len(doc),
        "page_size_inches": [6, 9],
        "file_bytes": PDF.stat().st_size,
        "sha256": hashlib.sha256(PDF.read_bytes()).hexdigest(),
        "extracted_words_including_navigation": len(full_text.split()),
        "chapter_start_pages": chapter_pages,
        "workbook_start_pages": day_pages,
        "bookmarks": outline_count,
        "links_total": len(links),
        "external_reference_links": len(expected_uris & uris),
        "unique_embedded_illustrations": len(image_xrefs),
        "blank_pages_except_image_cover": [],
        "out_of_bounds_text_blocks": 0,
        "metadata": {"title": reader.metadata.title, "author": reader.metadata.author},
    }
    return report


def main():
    source_report = validate_source()
    pdf_report = validate_pdf()
    report = {**pdf_report, **source_report}
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    manifest.update({
        "status": "validated",
        "pages": report["pages"],
        "file_bytes": report["file_bytes"],
        "sha256": report["sha256"],
        "source_words": report["source_words"],
        "bookmarks": report["bookmarks"],
        "clickable_links": report["links_total"],
        "validation_report": "docs/books/recovery-source/validation_report.json",
    })
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
