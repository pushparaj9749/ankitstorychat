#!/usr/bin/env python3
"""Build the original Hinglish recovery book as a navigable, designed PDF."""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import inch
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ASSETS = HERE / "assets"
OUTPUT = ROOT / "docs" / "books" / "Nasha_Aur_Masturbation_Addiction_Se_Azaadi_Ankit_Mahato.pdf"
MANIFEST = HERE / "book_manifest.json"

sys.path.insert(0, str(HERE))
from references import REFERENCES, REF_MAP  # noqa: E402
from extras import DISCLAIMER, GLOSSARY, HOW_TO_USE, RESOURCES, WORKSHEETS  # noqa: E402
from workbook import DAYS  # noqa: E402
import content_part1, content_part2, content_part3, content_part4  # noqa: E402
import content_part5, content_part6, content_part7, content_part8  # noqa: E402

PARTS = [
    content_part1.PART,
    content_part2.PART,
    content_part3.PART,
    content_part4.PART,
    content_part5.PART,
    content_part6.PART,
    content_part7.PART,
    content_part8.PART,
]

PAGE_W, PAGE_H = 6 * inch, 9 * inch
MARGIN_X = 43
TOP_MARGIN = 54
BOTTOM_MARGIN = 46
BODY_W = PAGE_W - 2 * MARGIN_X
BODY_H = PAGE_H - TOP_MARGIN - BOTTOM_MARGIN

NAVY = colors.HexColor("#0C1B26")
NAVY_2 = colors.HexColor("#142B38")
TEAL = colors.HexColor("#2E7773")
TEAL_DARK = colors.HexColor("#225B59")
TEAL_PALE = colors.HexColor("#E8F0ED")
GOLD = colors.HexColor("#C49A50")
GOLD_PALE = colors.HexColor("#F4EDDF")
PAPER = colors.HexColor("#FAF8F3")
INK = colors.HexColor("#243039")
MUTED = colors.HexColor("#65737A")
LINE = colors.HexColor("#D9DFDC")
DANGER = colors.HexColor("#A54C40")
DANGER_PALE = colors.HexColor("#F7EAE5")
WHITE = colors.HexColor("#FFFFFF")

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
pdfmetrics.registerFont(TTFont("BookSans", str(FONT_DIR / "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("BookSans-Bold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))
pdfmetrics.registerFont(TTFont("BookSerif", str(FONT_DIR / "DejaVuSerif.ttf")))
pdfmetrics.registerFont(TTFont("BookSerif-Bold", str(FONT_DIR / "DejaVuSerif-Bold.ttf")))
pdfmetrics.registerFontFamily("BookSans", normal="BookSans", bold="BookSans-Bold")
pdfmetrics.registerFontFamily("BookSerif", normal="BookSerif", bold="BookSerif-Bold")

styles = getSampleStyleSheet()


def style(name, **kw):
    base = dict(fontName="BookSans", fontSize=9.2, leading=14.1, textColor=INK, spaceAfter=7)
    base.update(kw)
    return ParagraphStyle(name, **base)


ST = {
    "body": style("Body", spaceAfter=8),
    "body_small": style("BodySmall", fontSize=8.1, leading=12.2, spaceAfter=5),
    "lead": style("Lead", fontName="BookSerif", fontSize=10.3, leading=16.1, textColor=NAVY_2, spaceAfter=10),
    "section": style("Section", fontName="BookSerif-Bold", fontSize=13.3, leading=17, textColor=TEAL_DARK, spaceBefore=10, spaceAfter=7, keepWithNext=True),
    "chapter_label": style("ChapterLabel", fontName="BookSans-Bold", fontSize=7.5, leading=10, textColor=GOLD, tracking=1.6, spaceAfter=9),
    "chapter_title": style("ChapterTitle", fontName="BookSerif-Bold", fontSize=21.5, leading=26.5, textColor=NAVY, spaceAfter=8),
    "chapter_sub": style("ChapterSub", fontSize=9.2, leading=14, textColor=MUTED, spaceAfter=14),
    "part_label": style("PartLabel", fontName="BookSans-Bold", fontSize=7.2, leading=10, textColor=GOLD, tracking=1.7, alignment=TA_CENTER, spaceAfter=8),
    "part_title": style("PartTitle", fontName="BookSerif-Bold", fontSize=22, leading=27, alignment=TA_CENTER, textColor=NAVY, spaceAfter=6),
    "part_sub": style("PartSub", fontSize=9.2, leading=13, alignment=TA_CENTER, textColor=TEAL_DARK, spaceAfter=12),
    "part_intro": style("PartIntro", fontName="BookSerif", fontSize=9.2, leading=14.2, textColor=INK, spaceAfter=10),
    "front_title": style("FrontTitle", fontName="BookSerif-Bold", fontSize=22, leading=27, textColor=NAVY, spaceAfter=10),
    "front_sub": style("FrontSub", fontSize=9, leading=13.5, textColor=MUTED, spaceAfter=12),
    "h1": style("H1", fontName="BookSerif-Bold", fontSize=20, leading=25, textColor=NAVY, spaceAfter=10),
    "h2": style("H2", fontName="BookSerif-Bold", fontSize=13.2, leading=17, textColor=TEAL_DARK, spaceBefore=9, spaceAfter=6, keepWithNext=True),
    "kicker": style("Kicker", fontName="BookSans-Bold", fontSize=7, leading=10, textColor=GOLD, tracking=1.5, spaceAfter=8),
    "bullet": style("Bullet", fontSize=8.8, leading=13.3, leftIndent=15, firstLineIndent=0, bulletIndent=2, spaceAfter=4),
    "callout": style("Callout", fontSize=8.5, leading=12.8, textColor=NAVY_2, spaceAfter=0),
    "exercise": style("Exercise", fontSize=8.3, leading=12.6, textColor=NAVY_2, spaceAfter=0),
    "refs": style("Refs", fontSize=6.8, leading=10, textColor=MUTED, spaceBefore=9, spaceAfter=4),
    "ref": style("Reference", fontSize=7.6, leading=11.2, spaceAfter=4),
    "url": style("URL", fontSize=6.1, leading=8.4, textColor=TEAL_DARK, leftIndent=15, spaceAfter=8),
    "toc_title": style("TOCHeading", fontName="BookSerif-Bold", fontSize=22, leading=26, textColor=NAVY, spaceAfter=14),
    "day_label": style("DayLabel", fontName="BookSans-Bold", fontSize=7.5, leading=10, textColor=GOLD, tracking=1.6, spaceAfter=8),
    "day_title": style("DayTitle", fontName="BookSerif-Bold", fontSize=19, leading=24, textColor=NAVY, spaceAfter=5),
    "day_intent": style("DayIntent", fontName="BookSerif", fontSize=9.2, leading=13, textColor=TEAL_DARK, spaceAfter=12),
    "track": style("Track", fontSize=7.8, leading=11.6, textColor=NAVY_2, spaceAfter=0),
    "resource_no": style("ResourceNo", fontName="BookSerif-Bold", fontSize=15, leading=18, textColor=TEAL_DARK, spaceAfter=3),
    "center": style("Center", alignment=TA_CENTER),
    "dark_title": style("DarkTitle", fontName="BookSerif-Bold", fontSize=24, leading=30, textColor=WHITE, alignment=TA_CENTER, spaceAfter=12),
    "dark_body": style("DarkBody", fontName="BookSerif", fontSize=10, leading=16, textColor=colors.HexColor("#E6ECEA"), alignment=TA_CENTER, spaceAfter=12),
    "dark_small": style("DarkSmall", fontSize=8.2, leading=13, textColor=colors.HexColor("#D2DEDA"), alignment=TA_CENTER, spaceAfter=7),
}


def fmt(text: str) -> str:
    value = html.escape(str(text))
    value = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", value)
    # A tiny allowlist for deliberate layout markup in front/back matter.
    for escaped, tag in {
        "&lt;br/&gt;": "<br/>",
        "&lt;b&gt;": "<b>",
        "&lt;/b&gt;": "</b>",
    }.items():
        value = value.replace(escaped, tag)
    return value


_bookmark_counter = 0


def marked(paragraph: Paragraph, level: int, toc: bool = True, key: str | None = None) -> Paragraph:
    global _bookmark_counter
    _bookmark_counter += 1
    paragraph._outline_level = level
    paragraph._toc_enabled = toc
    paragraph._bookmark_key = key or f"section-{_bookmark_counter:04d}"
    return paragraph


def P(text, kind="body"):
    return Paragraph(fmt(text), ST[kind])


def bullet(text):
    return Paragraph(fmt(text), ST["bullet"], bulletText="•")


def box(title, body, kind="callout", bg=TEAL_PALE, accent=TEAL):
    content = Paragraph(f"<b>{fmt(title)}</b><br/>{fmt(body)}", ST[kind])
    table = Table([[content]], colWidths=[BODY_W], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    table.spaceBefore = 5
    table.spaceAfter = 10
    return table


def exercise_box(title, items):
    lines = [f"<b>{fmt(title).upper()}</b>"]
    for idx, item in enumerate(items, 1):
        lines.append(f"<font color='#2E7773'><b>{idx:02d}</b></font>&nbsp;&nbsp;{fmt(item)}")
    content = Paragraph("<br/>".join(lines), ST["exercise"])
    table = Table([[content]], colWidths=[BODY_W], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GOLD_PALE),
        ("LINEBEFORE", (0, 0), (0, -1), 3, GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    table.spaceBefore = 5
    table.spaceAfter = 11
    return table


class CoverFlowable(Flowable):
    def wrap(self, availWidth, availHeight):
        return PAGE_W, PAGE_H - 0.01

    def draw(self):
        self.canv.drawImage(str(ASSETS / "cover.jpg"), 0, 0, PAGE_W, PAGE_H, mask="auto")


class RoundedImage(Flowable):
    def __init__(self, path, width=BODY_W, height=BODY_W * 768 / 1376, radius=10):
        super().__init__()
        self.path = str(path)
        self.width = width
        self.height = height
        self.radius = radius

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.saveState()
        path = c.beginPath()
        path.roundRect(0, 0, self.width, self.height, self.radius)
        c.clipPath(path, stroke=0, fill=0)
        c.drawImage(self.path, 0, 0, self.width, self.height, mask="auto")
        c.restoreState()
        c.setStrokeColor(colors.HexColor("#D3DCD8"))
        c.setLineWidth(0.5)
        c.roundRect(0, 0, self.width, self.height, self.radius, stroke=1, fill=0)


class NotesLines(Flowable):
    def __init__(self, height=66, spacing=15):
        super().__init__()
        self.width = BODY_W
        self.height = height
        self.spacing = spacing

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.saveState()
        c.setStrokeColor(LINE)
        c.setLineWidth(0.45)
        y = self.height - 8
        while y > 3:
            c.line(0, y, self.width, y)
            y -= self.spacing
        c.restoreState()


class BookDocTemplate(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if not hasattr(flowable, "_outline_level"):
            return
        text = flowable.getPlainText()
        key = flowable._bookmark_key
        level = flowable._outline_level
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=level, closed=level < 2)
        if flowable._toc_enabled:
            self.notify("TOCEntry", (level, text, self.page, key))


def page_background(canvas, doc, dark=False, header=True):
    canvas.saveState()
    canvas.setTitle("Nasha Aur Masturbation Addiction Se Azaadi")
    canvas.setAuthor("Ankit Mahato")
    canvas.setSubject("A practical, shame-free Hinglish recovery guide")
    canvas.setKeywords("Hinglish, recovery, substance use, compulsive sexual behaviour, workbook")
    canvas.setFillColor(NAVY if dark else PAPER)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    if not dark:
        canvas.setFillColor(TEAL)
        canvas.rect(0, PAGE_H - 5, PAGE_W, 5, stroke=0, fill=1)
        if header:
            canvas.setFont("BookSans-Bold", 5.8)
            canvas.setFillColor(MUTED)
            canvas.drawString(MARGIN_X, PAGE_H - 31, "NASHA AUR MASTURBATION ADDICTION SE AZAADI")
            canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 31, "ANKIT MAHATO")
            canvas.setStrokeColor(LINE)
            canvas.setLineWidth(0.4)
            canvas.line(MARGIN_X, PAGE_H - 37, PAGE_W - MARGIN_X, PAGE_H - 37)
        canvas.setStrokeColor(LINE)
        canvas.line(MARGIN_X, 30, PAGE_W - MARGIN_X, 30)
        canvas.setFont("BookSans", 6.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN_X, 18, "PRACTICAL • SHAME-FREE • EVIDENCE-AWARE")
        canvas.setFont("BookSans-Bold", 7)
        canvas.drawRightString(PAGE_W - MARGIN_X, 18, str(doc.page))
    canvas.restoreState()


def plain_page(canvas, doc):
    page_background(canvas, doc, header=False)


def body_page(canvas, doc):
    page_background(canvas, doc, header=True)


def dark_page(canvas, doc):
    page_background(canvas, doc, dark=True, header=False)
    canvas.saveState()
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(1)
    canvas.line(PAGE_W / 2 - 35, PAGE_H - 60, PAGE_W / 2 + 35, PAGE_H - 60)
    canvas.restoreState()


def part_opener(story, number, title, subtitle, image, intro, chapters, toc_title=None):
    story.append(PageBreak())
    story.append(P(f"PART {number:02d}" if isinstance(number, int) else number, "part_label"))
    story.append(RoundedImage(ASSETS / image))
    story.append(Spacer(1, 14))
    story.append(marked(P(title, "part_title"), 0, key=f"part-{number}"))
    story.append(P(subtitle, "part_sub"))
    story.append(P(intro, "part_intro"))
    if chapters:
        story.append(Spacer(1, 3))
        story.append(P("IN THIS PART", "kicker"))
        for ch in chapters:
            story.append(Paragraph(
                f"<font color='#C49A50'><b>{ch['number']:02d}</b></font>&nbsp;&nbsp;"
                f"<b>{fmt(ch['title'])}</b><br/>"
                f"<font size='7.5' color='#65737A'>{fmt(ch['subtitle'])}</font>",
                style(f"PartChapter{number}-{ch['number']}", fontSize=8.5, leading=12.4, leftIndent=8, spaceAfter=7),
            ))


def chapter(story, ch):
    story.append(PageBreak())
    story.append(P(f"CHAPTER {ch['number']:02d}", "chapter_label"))
    story.append(marked(P(ch["title"], "chapter_title"), 1, key=f"chapter-{ch['number']:02d}"))
    story.append(P(ch["subtitle"], "chapter_sub"))
    story.append(Table([[""]], colWidths=[46], rowHeights=[2], style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)]) , hAlign="LEFT"))
    if ch.get("refs"):
        links = " &nbsp;·&nbsp; ".join(f"<link href='#ref-{rid}' color='#2E7773'>{rid}</link>" for rid in ch["refs"])
        story.append(Paragraph(f"<b>RESEARCH TRAIL</b>&nbsp;&nbsp; {links}", ST["refs"]))
    story.append(Spacer(1, 5))
    for sec in ch["sections"]:
        section_start = len(story)
        story.append(marked(P(sec["title"], "section"), 2, toc=False))
        for para in sec["paragraphs"]:
            story.append(P(para))
        for item in sec["bullets"]:
            story.append(bullet(item))
        if sec.get("callout"):
            title, body = sec["callout"]
            story.append(box(title, body))
        if sec.get("exercise"):
            title, items = sec["exercise"]
            story.append(exercise_box(title, items))
        if sec.get("keep_together"):
            section_flowables = story[section_start:]
            del story[section_start:]
            story.append(KeepTogether(section_flowables))


def front_heading(story, title, subtitle=None, key=None):
    story.append(P("READER’S GUIDE", "kicker"))
    story.append(marked(P(title, "h1"), 0, key=key))
    if subtitle:
        story.append(P(subtitle, "front_sub"))


def add_front_matter(story):
    story.append(CoverFlowable())
    story.append(NextPageTemplate("Front"))
    story.append(PageBreak())

    story.append(Spacer(1, 34))
    story.append(P("AN ORIGINAL HINGLISH RECOVERY BOOK", "kicker"))
    story.append(marked(P("Nasha Aur Masturbation<br/>Addiction Se Azaadi", "front_title"), 0, key="title-page"))
    story.append(P("Ek practical, shame-free, evidence-aware recovery guide", "lead"))
    story.append(Spacer(1, 8))
    story.append(P("<b>Ankit Mahato</b>", "body"))
    story.append(P("First edition • 1 November 2026", "body_small"))
    story.append(Spacer(1, 30))
    story.append(box("Book ka promise", "Yahan koi moral lecture, miracle cure, dopamine-reset myth ya semen-retention claim nahi milega. Milega clear science, safe treatment guidance, practical skills, 30-day workbook aur honest recovery planning."))
    story.append(Spacer(1, 15))
    story.append(P("Substance-use recovery • Compulsive masturbation/porn patterns • Consent • Professional help • Lapse recovery", "body_small"))

    story.append(PageBreak())
    front_heading(story, "Important Medical & Safety Note", "Is page ko skip mat karo — especially agar substance use involved hai.", "disclaimer")
    for para in DISCLAIMER:
        story.append(P(para, "body_small"))
    story.append(box("Immediate emergency", "India mein 112 ya nearest emergency service. Seizure, unresponsiveness, breathing problem, severe confusion/hallucinations, chest pain, serious injury, suicidal thoughts ya violence risk mein self-help exercises ka wait mat karo.", bg=DANGER_PALE, accent=DANGER))

    story.append(PageBreak())
    front_heading(story, "How To Use This Book", "Linear padho ya apni current need se start karo — safety chapters pehle.", "how-to-use")
    for title, body in HOW_TO_USE:
        story.append(P(title, "h2"))
        story.append(P(body))
    story.append(P("Suggested reading routes", "h2"))
    for item in [
        "Substance use involved: Chapters 4–10 pehle, phir shared skills and workbook.",
        "Masturbation/porn concern: Chapters 1–3, 11–14, phir relationships and workbook.",
        "Recent lapse: Chapter 15 and safety plan; shame spiral mein poora book start se padhna mandatory nahi.",
        "Family/support person: Chapters 4–5, 10, 16 and reusable support agreement.",
    ]:
        story.append(bullet(item))

    story.append(PageBreak())
    front_heading(story, "Quick Safety Directory", "Numbers ko phone mein save karo. Current availability official channel se verify karo.", "quick-safety")
    for name, number, use, rid in RESOURCES[:4]:
        story.append(P(name, "h2"))
        story.append(P(number, "resource_no"))
        story.append(P(use, "body_small"))
    story.append(box("Emergency vs craving", "Craving mein pause/support/coping plan. Emergency signs mein 112/emergency care. Withdrawal ko willpower challenge na banao.", bg=DANGER_PALE, accent=DANGER))

    story.append(PageBreak())
    story.append(marked(Paragraph("Contents", ST["toc_title"]), 0, key="contents"))
    story.append(P("Clickable entries • PDF bookmarks mein detailed sections bhi available hain", "front_sub"))
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle("TOC0", fontName="BookSans-Bold", fontSize=8.4, leading=14, textColor=NAVY, leftIndent=0, firstLineIndent=0, spaceBefore=6),
        ParagraphStyle("TOC1", fontName="BookSans", fontSize=7.6, leading=11.5, textColor=INK, leftIndent=13, firstLineIndent=0, spaceBefore=1),
        ParagraphStyle("TOC2", fontName="BookSans", fontSize=7, leading=10, textColor=MUTED, leftIndent=25),
    ]
    toc.dotsMinLevel = 0
    story.append(toc)


def add_workbook(story):
    part_opener(
        story,
        "WORKBOOK",
        "Your 30-Day Recovery Workbook",
        "One page a day • Track S + Track M • No perfection requirement",
        "09-30-day-plan.jpg",
        "Yeh thirty-day structure treatment replacement nahi, treatment aur daily action ka companion hai. Har din common practice ke saath substance aur compulsion tracks ke specific prompts hain. Apna relevant track choose karo. Missed day ko skip nahi, simply resume karo — doubling ya punishment nahi.",
        [],
    )
    for day in DAYS:
        story.append(PageBreak())
        story.append(P(f"DAY {day['day']:02d} / 30  •  WEEK {(day['day'] - 1) // 7 + 1}", "day_label"))
        story.append(marked(P(day["title"], "day_title"), 1, key=f"day-{day['day']:02d}"))
        story.append(P(day["intention"], "day_intent"))
        story.append(P(day["common"], "body_small"))
        story.append(box("TRACK S  •  SUBSTANCE RECOVERY", day["substance"], kind="track", bg=TEAL_PALE, accent=TEAL))
        story.append(box("TRACK M  •  MASTURBATION / PORN COMPULSION", day["compulsion"], kind="track", bg=GOLD_PALE, accent=GOLD))
        story.append(P("EVENING REFLECTION", "kicker"))
        for question in day["reflection"]:
            story.append(bullet(question))
        story.append(P("Optional effort score: 0 not done  •  1 attempted  •  2 completed   |   Score effort, not worth.", "refs"))
        story.append(NotesLines(height=61 if day["day"] not in (7, 14, 21, 30) else 74, spacing=14))


def add_back_matter(story):
    part_opener(
        story,
        "TOOLKIT",
        "Reusable Worksheets",
        "Print, copy or recreate privately — no graphic detail needed",
        "03-triggers.jpg",
        "In templates ko repeat use karo. Agar writing anxiety ya compulsive checking badhati hai, toh shorter version choose karo. Safety information current aur accessible rakho; sensitive notes ko shared device/public place par unsecured mat chhodo.",
        [],
    )
    for idx, (title, purpose, prompts) in enumerate(WORKSHEETS, 1):
        story.append(PageBreak())
        story.append(P(f"REUSABLE TEMPLATE {idx:02d}", "chapter_label"))
        story.append(marked(P(title, "h1"), 1, key=f"worksheet-{idx:02d}"))
        story.append(P(purpose, "front_sub"))
        for pidx, prompt in enumerate(prompts, 1):
            story.append(Paragraph(f"<font color='#2E7773'><b>{pidx:02d}</b></font>&nbsp;&nbsp;{fmt(prompt)}", ST["body_small"]))
            story.append(NotesLines(height=47, spacing=14))
        story.append(box("Safety remains primary", "Worksheet ka answer emergency/professional care delay nahi karna chahiye. Jo prompt applicable nahi hai usse skip ya clinician ke saath adapt karo."))

    story.append(PageBreak())
    front_heading(story, "Glossary", "Terms ko samajhna hai, khud ko label karna nahi.", "glossary")
    for term, definition in GLOSSARY:
        story.append(P(term, "h2"))
        story.append(P(definition, "body_small"))

    story.append(PageBreak())
    front_heading(story, "Verified Help Directory — India", "Official sources se checked 1 November 2026. Services/hours can change; verify when needed.", "resources")
    for name, number, use, rid in RESOURCES:
        story.append(P(name, "h2"))
        story.append(P(number, "resource_no"))
        story.append(P(use, "body_small"))
        story.append(Paragraph(f"<link href='#ref-{rid}' color='#2E7773'>Official source: {rid}</link>", ST["refs"]))
    story.append(box("Agar helpline connect na ho", "Immediate danger mein 112 / nearest emergency department. Non-emergency mein nearest government hospital, medical college, qualified physician/psychiatrist ya de-addiction service contact karo. Ek unavailable number ko help unavailable samajhkar give up mat karo."))
    story.append(P("Professional choose karte hue", "h2"))
    for item in [
        "Credentials, relevant experience and humane treatment approach.",
        "Withdrawal/medical support, emergency protocol and referral pathway.",
        "Consent, privacy, family involvement and transparent charges.",
        "No violence, forced labour, public humiliation, unlawful confinement or miracle-cure guarantee.",
        "Aftercare and lapse plan included in discharge/continuing care.",
    ]:
        story.append(bullet(item))

    story.append(PageBreak())
    front_heading(story, "Research Notes & References", "Original Hinglish synthesis • 26 linked sources • Accessed 1 November 2026", "references")
    story.append(P("References ko chapter-end Research Trail IDs se connect kiya gaya hai. WHO/ICD-11, NIDA, NIAAA, SAMHSA, systematic reviews and Indian government resources prioritise kiye gaye hain. CSBD/PPU evidence developing hai; substance-specific treatment evidence and medical risks ko same certainty ya same protocol mein merge nahi kiya gaya.", "body_small"))
    story.append(P("Har source ko read karke conclusions ko original practical framework mein synthesise kiya gaya hai. Yeh book kisi source ka copied translation ya replacement nahi. Clinical guidance ke liye current official documents and qualified professionals consult karo.", "body_small"))
    for ref in REFERENCES:
        rid = ref["id"]
        citation = fmt(ref["citation"])
        url = ref["url"]
        domain = urlparse(url).netloc.replace("www.", "")
        display_url = html.escape(url).replace("/", "/&#8203;").replace("-", "-&#8203;")
        story.append(Paragraph(
            f"<a name='ref-{rid}'/><font color='#C49A50'><b>{rid}</b></font>&nbsp;&nbsp;{citation}",
            ST["ref"],
        ))
        story.append(Paragraph(
            f"<link href='{html.escape(url, quote=True)}' color='#2E7773'><b>Open source · {fmt(domain)}</b></link><br/>{display_url}",
            ST["url"],
        ))

    story.append(NextPageTemplate("Dark"))
    story.append(PageBreak())
    story.append(Spacer(1, 90))
    story.append(marked(P("Azaadi Ka Matlab<br/>Choice Ka Wapas Aana", "dark_title"), 0, key="closing"))
    story.append(P("Tumhe apne past behaviour ke liye lifelong shame carry nahi karna. Responsibility lo, safe help lo, aur next choice ko thoda clearer banao. Recovery perfect streak nahi — honest, supported, repeatable life-building hai.", "dark_body"))
    story.append(Spacer(1, 14))
    story.append(P("EMERGENCY  <b>112</b><br/>DRUG DE-ADDICTION  <b>14446</b><br/>TELE-MANAS  <b>14416 / 1800-891-4416</b><br/>TOBACCO QUITLINE  <b>1800-11-2356</b>", "dark_small"))
    story.append(Spacer(1, 35))
    story.append(P("ANKIT MAHATO  •  ORIGINAL HINGLISH EDITION", "dark_small"))


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    cover_frame = Frame(0, 0, PAGE_W, PAGE_H, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="cover-frame")
    body_frame = Frame(MARGIN_X, BOTTOM_MARGIN, BODY_W, BODY_H, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="body-frame")
    doc = BookDocTemplate(
        str(OUTPUT),
        pagesize=(PAGE_W, PAGE_H),
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=TOP_MARGIN,
        bottomMargin=BOTTOM_MARGIN,
        title="Nasha Aur Masturbation Addiction Se Azaadi",
        author="Ankit Mahato",
        subject="A practical, shame-free Hinglish recovery guide",
        creator="Ankit Mahato — original Hinglish edition",
    )
    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[cover_frame], onPage=lambda c, d: None),
        PageTemplate(id="Front", frames=[body_frame], onPage=plain_page),
        PageTemplate(id="Body", frames=[body_frame], onPage=body_page),
        PageTemplate(id="Dark", frames=[body_frame], onPage=dark_page),
    ])
    story = []
    add_front_matter(story)
    story.append(NextPageTemplate("Body"))
    for idx, part in enumerate(PARTS, 1):
        part_opener(story, idx, part["title"], part["subtitle"], part["image"], part["intro"], part["chapters"])
        for ch in part["chapters"]:
            chapter(story, ch)
    add_workbook(story)
    add_back_matter(story)
    doc.multiBuild(story)

    manifest = {
        "title": "Nasha Aur Masturbation Addiction Se Azaadi",
        "author": "Ankit Mahato",
        "edition_date": "2026-11-01",
        "output": str(OUTPUT.relative_to(ROOT)),
        "page_size_inches": [6, 9],
        "parts": len(PARTS),
        "chapters": sum(len(p["chapters"]) for p in PARTS),
        "detailed_sections": sum(len(c["sections"]) for p in PARTS for c in p["chapters"]),
        "workbook_days": len(DAYS),
        "reusable_worksheets": len(WORKSHEETS),
        "references": len(REFERENCES),
        "illustrations_including_cover": 10,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build()
