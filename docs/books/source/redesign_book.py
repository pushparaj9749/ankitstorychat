#!/usr/bin/env python3
"""Premium visual redesign of Ankit Mahato's 850-page Dark Psychology workbook.

The original PDF remains the content source. Ordinary pages keep their original
text and layout while receiving a new design frame and space-aware learning
modules. Cover, title page, part dividers and chapter openers are rebuilt.
"""
from __future__ import annotations

import re
from pathlib import Path
import pymupdf
from enrichment import PROFILES, FRONT_MODULES, WORKSHEET_NOTES, SAFETY_NOTES

SOURCE_DIR = Path(__file__).resolve().parent
ROOT = SOURCE_DIR.parents[2]
BOOKS = ROOT / "docs" / "books"
INPUT = BOOKS / "Ankit_Mahato_Dark_Psychology_Rishton_Ka_Andhera.pdf"
OUTPUT = BOOKS / "Ankit_Mahato_Dark_Psychology_Premium_Edition.pdf"
COVER = SOURCE_DIR / "premium_cover.png"
W, H = 595.2756, 841.8898

FONT_FILES = {
    "DVS": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "DVB": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "DVSER": "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "PLAY": str(ROOT / "docs" / "promo" / "ad2" / "fonts" / "PlayfairDisplay_700Bold.ttf"),
}
for path in FONT_FILES.values():
    if not Path(path).exists():
        raise FileNotFoundError(path)
FONT_OBJS = {name: pymupdf.Font(fontfile=path) for name, path in FONT_FILES.items()}


def rgb(value: str):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))


NAVY = rgb("101A2C")
NAVY_2 = rgb("1C2B40")
IVORY = rgb("FBF8F2")
WHITE = rgb("FFFFFF")
TEXT = rgb("202936")
MUTED = rgb("66707C")
GOLD = rgb("D2AA62")
PALE_GOLD = rgb("F4EAD8")
LIGHT_LINE = rgb("DDD8CF")

PART_STYLE = {
    "I": {"accent": rgb("9B3F55"), "pale": rgb("F5E7EB"), "start": 13,
          "title": "Foundations: Pehle Lens, Phir Labels",
          "desc": "Dark psychology se pehle gender stereotypes, consent, attraction, attachment aur empathy ka foundation."},
    "II": {"accent": rgb("6B5B8F"), "pale": rgb("ECE8F3"), "start": 140,
           "title": "Dark Traits aur Biased Thinking",
           "desc": "Traits ko diagnosis se alag rakho aur apne judgments ke biases ko pehchano."},
    "III": {"accent": rgb("A65A3E"), "pale": rgb("F5EAE4"), "start": 267,
            "title": "Manipulation Patterns ko Pehchano",
            "desc": "Gaslighting, love bombing, withdrawal, guilt, triangulation, modern dating aur DARVO."},
    "IV": {"accent": rgb("367278"), "pale": rgb("E4F0F0"), "start": 394,
           "title": "Control in Modern Relationships",
           "desc": "Coercive control, isolation, money, digital monitoring, social media aur threats."},
    "V": {"accent": rgb("55775A"), "pale": rgb("E8F0E8"), "start": 521,
          "title": "Boundaries, Communication aur Agency",
          "desc": "Boundaries, assertive conversations, repair, trust, self-respect aur informed decisions."},
    "VI": {"accent": rgb("936A35"), "pale": rgb("F3EBDF"), "start": 648,
           "title": "Healthy Love, Recovery aur Practice",
           "desc": "Repairable versus unsafe patterns, support, digital safety, compatibility, recovery aur practice."},
}
PART_REFLECTION = ("Is part ke baad apni ek belief, ek boundary aur ek support action likho. Knowledge ka test kisi ko label "
                   "karna nahi, zyada clear, safe aur respectful choices karna hai.")


def pdf_num(number: float) -> str:
    value = f"{number:.6f}".rstrip("0").rstrip(".")
    return value[1:] if value.startswith("0.") else value


def pdf_color(color) -> str:
    return " ".join(pdf_num(v) for v in color)


def ensure_fonts(page):
    for name, path in FONT_FILES.items():
        page.insert_font(fontname=name, fontfile=path)


def wrap_text(text: str, font: str, size: float, width: float):
    """Wrap without losing words; explicit newlines create paragraph breaks."""
    result = []
    for para in str(text).split("\n"):
        if not para.strip():
            result.append("")
            continue
        line = ""
        for word in para.split():
            candidate = word if not line else line + " " + word
            if FONT_OBJS[font].text_length(candidate, size) <= width or not line:
                line = candidate
            else:
                result.append(line)
                line = word
        if line:
            result.append(line)
    return result


def draw_lines(page, lines, x, y, font="DVS", size=9.2, color=TEXT, leading=None):
    leading = leading or size * 1.38
    for line in lines:
        if line:
            page.insert_text((x, y + size), line, fontname=font, fontsize=size, color=color)
        y += leading
    return y


def draw_wrapped(page, text, x, y, width, font="DVS", size=9.2, color=TEXT, leading=None):
    return draw_lines(page, wrap_text(text, font, size, width), x, y, font, size, color, leading)


def draw_centered(page, text, rect, font="DVS", size=9, color=TEXT):
    lines = wrap_text(text, font, size, rect.width - 8)
    leading = size * 1.3
    y = rect.y0 + max(0, (rect.height - len(lines) * leading) / 2)
    for line in lines:
        width = FONT_OBJS[font].text_length(line, size)
        page.insert_text((rect.x0 + (rect.width - width) / 2, y + size), line,
                         fontname=font, fontsize=size, color=color)
        y += leading


def text_lines(page):
    lines = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if text:
                lines.append({
                    "bbox": line["bbox"], "size": max(s["size"] for s in line["spans"]),
                    "font": line["spans"][0]["font"], "text": text,
                })
    return lines


def page_title(page):
    for line in text_lines(page):
        x0, y0, x1, y1 = line["bbox"]
        if 65 < y0 < 103 and 14.4 <= line["size"] <= 16:
            return line["text"]
    return ""


def original_bottom(page):
    bottom = 105.0
    for line in text_lines(page):
        x0, y0, x1, y1 = line["bbox"]
        if y0 > 52 and y1 < 790:
            bottom = max(bottom, y1)
    for drawing in page.get_drawings():
        rect = drawing["rect"]
        if rect.width > W * 0.95 and rect.height > H * 0.95:
            continue
        if rect.y0 > 55 and rect.y1 < 790:
            bottom = max(bottom, rect.y1)
    return bottom


def block_data(page):
    blocks = []
    for block in page.get_text("dict")["blocks"]:
        if "lines" not in block:
            continue
        parts, sizes = [], []
        for line in block["lines"]:
            txt = "".join(span["text"] for span in line["spans"]).strip()
            if txt:
                parts.append(txt)
                sizes.extend(span["size"] for span in line["spans"] if span["text"].strip())
        if parts:
            blocks.append({"text": " ".join(parts), "size": max(sizes or [9]),
                           "y0": block["bbox"][1], "y1": block["bbox"][3]})
    return sorted(blocks, key=lambda b: b["y0"])


def chapter_starts(doc):
    starts = []
    for index, page in enumerate(doc):
        text = page.get_text()
        match = re.search(r"Chapter (\d{2}) / Part ([IVX]+)", text)
        if not match:
            continue
        footer = [line["text"] for line in text_lines(page)
                  if line["bbox"][1] > 790 and not re.search(r"\d+ / 850", line["text"])]
        title = footer[0] if footer else f"Chapter {match.group(1)}"
        starts.append({"page": index + 1, "chapter": int(match.group(1)),
                       "part": match.group(2), "title": title})
    assert len(starts) == 42, len(starts)
    return starts


def chapter_for_page(page_number, starts):
    # Chapter 42 ends before the glossary; back matter has its own modules.
    if page_number >= 775:
        return None
    current = None
    for item in starts:
        if item["page"] <= page_number:
            current = item
        else:
            break
    return current


def part_for_page(page_number, starts):
    chapter = chapter_for_page(page_number, starts)
    if chapter and page_number >= chapter["page"]:
        return chapter["part"]
    current = "I"
    for roman, style in PART_STYLE.items():
        if style["start"] <= page_number:
            current = roman
    return current


def recolor_page(doc, page, accent, pale):
    replacements = {
        b".639216 .231373 .301961 rg": f"{pdf_color(accent)} rg".encode(),
        b".976471 .92549 .92549 rg": f"{pdf_color(pale)} rg".encode(),
        b".933333 .952941 .972549 rg": f"{pdf_color(rgb('EDF1F5'))} rg".encode(),
        b".843137 .862745 .890196 RG": f"{pdf_color(rgb('CFC7BD'))} RG".encode(),
        b".360784 .4 .458824 rg": f"{pdf_color(MUTED)} rg".encode(),
    }
    bg_old = b"1 1 1 rg\nn 0 0 595.2756 841.8898 re f*"
    bg_new = f"{pdf_color(IVORY)} rg\nn 0 0 595.2756 841.8898 re f*".encode()
    for xref in page.get_contents():
        data = doc.xref_stream(xref)
        data = data.replace(bg_old, bg_new)
        for old, new in replacements.items():
            data = data.replace(old, new)
        doc.update_stream(xref, data)


def draw_footer(page, page_number, accent, dark=False):
    color = rgb("D8D5CE") if dark else MUTED
    line = rgb("3B4658") if dark else LIGHT_LINE
    page.draw_line((48, 802.9), (547, 802.9), color=line, width=.55)
    page.insert_text((48, 817), "ANKIT MAHATO  /  DARK PSYCHOLOGY", fontname="DVS", fontsize=7.1, color=color)
    label = f"{page_number} / 850"
    width = FONT_OBJS["DVS"].text_length(label, 7.1)
    page.insert_text((547 - width, 817), label, fontname="DVS", fontsize=7.1, color=color)
    page.draw_circle((297.5, 813.5), 2.2, color=accent, fill=accent)


def draw_frame(page, page_number, accent):
    page.draw_rect((0, 0, W, 6), color=None, fill=accent)
    page.draw_rect((24, 71, 28, 96), color=None, fill=accent)
    page.draw_line((48, 100), (547, 100), color=accent, width=.65, stroke_opacity=.55)
    page.insert_text((245, 818), "ROSHNI EDITION", fontname="DVB", fontsize=6.1, color=accent)


def draw_card(page, rect, title, body, accent, pale, notes=False):
    rect = pymupdf.Rect(rect)
    page.draw_rect(rect, color=accent, fill=WHITE, width=.7, radius=.08, stroke_opacity=.45)
    page.draw_rect((rect.x0, rect.y0, rect.x0 + 5, rect.y1), color=None, fill=accent)
    page.insert_text((rect.x0 + 16, rect.y0 + 18), title, fontname="DVB", fontsize=8.1, color=accent)
    max_width = rect.width - 32
    chosen = None
    for size in (9.0, 8.6, 8.2, 7.8, 7.4):
        leading = size * 1.36
        lines = wrap_text(body, "DVS", size, max_width)
        max_lines = int((rect.height - 43) / leading)
        if len(lines) <= max(1, max_lines):
            chosen = (size, leading, lines)
            break
    if chosen is None:
        raise RuntimeError(f"Card text does not fit: {title}: {body[:80]}")
    size, leading, lines = chosen
    end_y = draw_lines(page, lines, rect.x0 + 16, rect.y0 + 29, "DVS", size, TEXT, leading)
    if notes:
        available = rect.y1 - 12 - max(end_y + 6, rect.y0 + 58)
        count = min(4, int(available // 18))
        if count > 0:
            y = rect.y1 - 12 - (count - 1) * 18
            for i in range(count):
                page.draw_line((rect.x0 + 16, y + i * 18), (rect.x1 - 16, y + i * 18),
                               color=LIGHT_LINE, width=.55, dashes="[2 2] 0")
    return end_y


def draw_flow(page, rect, text, accent, pale):
    rect = pymupdf.Rect(rect)
    page.draw_rect(rect, color=None, fill=pale, radius=.07)
    draw_centered(page, text, rect, "DVB", 7.4, accent)


def first_detail(page):
    for line in text_lines(page):
        if line["bbox"][1] > 105 and line["size"] >= 9:
            return line["text"].lstrip("- ")
    return "is page ke first concept"


def modules_for(page, page_number, title, chapter):
    if chapter and page_number != chapter["page"]:
        profile = PROFILES[chapter["chapter"]]
        match = re.match(r"(\d{2})", title)
        kind = int(match.group(1)) if match else 0
        mapping = {
            1: ("EVERYDAY LENS", profile["example"], "OBSERVE → DESCRIBE → CHECK"),
            2: ("MECHANISM KO SLOW KARO", profile["mechanism"], "TRIGGER → STORY → URGE → CHOICE"),
            3: ("CONTEXT CHECK", profile["question"], "PERSON → CONTEXT → EVIDENCE"),
            4: ("EVIDENCE LENS", profile["principle"] + " Is conclusion ko individual verdict mat banao.", "CLAIM → SCOPE → LIMIT"),
            5: ("CAREFUL LANGUAGE", "‘Yeh possibility hai’ aur ‘yeh proof hai’ ko alag rakho. " + profile["principle"], "MAY → CONTEXT → VERIFY"),
            6: ("ALTERNATIVE LENS", profile["example"] + " Ek benign explanation bhi likho.", "FACT → OPTIONS → IMPACT"),
            7: ("FACT–STORY–CHOICE", profile["question"], "FACT → INTERPRETATION → CHOICE"),
            8: ("SAME LENS, NEW DIRECTION", profile["healthy"], "CONTEXT → CHOICE → REPAIR"),
            9: ("REPAIR CHECK", "Feedback ke baad acknowledgement, change aur follow-through dikhai deta hai? " + profile["action"], "ACKNOWLEDGE → CHANGE → REVIEW"),
            10: ("PATTERN NOTE", profile["question"] + " Sirf actually hui events note karo.", "FREQUENCY → IMPACT → FREEDOM"),
            11: ("APNI AWAAZ MEIN", profile["script"], "SPECIFIC → CALM → RESPECTFUL"),
            12: ("BOUNDARY FOLLOW-THROUGH", profile["action"], "NEED → LIMIT → ACTION"),
            13: ("REGULATION PAUSE", profile["mechanism"], "PAUSE → NAME → CHOOSE"),
            14: ("OPTION D KA FILTER", profile["script"], "DIGNITY → CONSENT → SAFETY"),
            15: ("REALITY CHECK", profile["principle"], "MYTH → EVIDENCE → NUANCE"),
            16: ("AGLE CONVERSATION KE LIYE", profile["action"], "ONE INSIGHT → ONE CHOICE → ONE REVIEW"),
            17: ("THREE-LINE REVISION", profile["principle"] + " Reflect: " + profile["question"], "LEARN → APPLY → REVISIT"),
        }
        primary = mapping.get(kind, ("ROSHNI NOTE", profile["principle"], "NOTICE → PAUSE → CHOOSE"))
        if kind in (3, 8, 9, 16):
            secondary = ("HEALTHY COUNTERWEIGHT", profile["healthy"])
        elif kind in (4, 10, 17):
            secondary = ("REVISION PROMPT", profile["question"])
        else:
            secondary = ("TRY THIS", profile["action"])
        return [primary[:2], secondary], primary[2]

    if page_number in FRONT_MODULES:
        title_a, body, flow = FRONT_MODULES[page_number]
        return [(title_a, body), ("PERSONAL NOTE", "Is page ka ek useful takeaway apni words mein likho. Uske saath ek situation note karo jahan yeh lens choice ko zyada clear ya safe banata.")], flow
    if 775 <= page_number <= 786:
        detail = first_detail(page)
        return [("GLOSSARY IN ACTION", f"‘{detail}’ ko apni words mein explain karne ki koshish karo. Definition ratne ke bajay behaviour aur context ke saath use karo."),
                ("DISTINCTION CHECK", "Is term ka ek close concept likho aur dono ke beech ka difference ek sentence mein batao. Label se pehle observable behaviour.")], "TERM → EXAMPLE → DISTINCTION"
    if 787 <= page_number <= 798:
        return [("RESEARCH READING LENS", "Source ka main claim, sample, method aur limitation alag likho. Popular interpretation ko original finding ka synonym mat banao."),
                ("CAUTIOUS APPLICATION", "Is research se ek reasonable practical possibility aur ek unjustified conclusion likho. Individual verdict ke bajay better questions choose karo.")], "CLAIM → METHOD → SCOPE → LIMIT"
    if 799 <= page_number <= 810:
        key = title.split("/")[-1].strip()
        body = WORKSHEET_NOTES.get(key, "Worksheet ko judgement nahi, observation aur safe choice ke liye use karo.")
        return [("WORKSHEET NOTE", body),
                ("PRIVATE EXAMPLE", "Ek low-to-moderate intensity example choose karo. Sensitive detail likhna unsafe ho toh blank chhodna ya trusted guidance lena valid hai.")], "OBSERVE → WRITE → REVIEW"
    if 811 <= page_number <= 816:
        return [("SAFETY FIRST", SAFETY_NOTES[page_number - 811]),
                ("SUPPORT CHECK", "Kaunsa trusted person ya professional resource is step ke liye appropriate hai? Plan ko apne actual risk aur privacy context ke saath review karo.")], "SAFETY → SUPPORT → OPTIONS"
    if 817 <= page_number <= 822:
        return [("REVIEW, NOT SCORE", "Tracker ko perfection test mat banao. Kya practice helpful thi, kahan pressure tha aur kya adjust karna hai—bas itna note karo."),
                ("SMALL WIN", "Ek small but real choice identify karo: clear request, respected no, kept boundary, support call ya honest repair.")], "NOTICE → APPRECIATE → ADJUST"
    if 823 <= page_number <= 842:
        refs = re.findall(r"\[R\d+\]", page.get_text())
        ref = refs[0] if refs else "Ek source"
        return [(f"{ref} READING CARD", "Is source ka central claim, research method, population aur limitation note karo. Citation ko personality diagnosis ya universal rule mein convert mat karo."),
                ("CITATION PRACTICE", "Kisi ek reference ke liye three-line note banao: source ne kya study kiya, result kis scope tak hai, aur real-life decision par cautious application kya ho sakti hai.")], "READ → CHECK → CONTEXTUALISE"
    if 843 <= page_number <= 850:
        detail = first_detail(page)
        return [("CROSS-REFERENCE", f"‘{detail}’ ke chapter par wapas jaakar ek recognition point aur ek healthy response revise karo."),
                ("REVISION ROUTE", "Index ko answer key nahi, route map banao. Jis term par confusion ho, pehle definition, phir context aur phir safe application dekho.")], "TERM → CHAPTER → APPLICATION"
    return [("ROSHNI NOTE", "Is page ka ek takeaway apni words mein likho aur ek safe, proportionate real-life application note karo."),
            ("REFLECTION", "Kya main facts, interpretation, impact aur choice ko alag dekh pa raha/rahi hoon?")], "READ → REFLECT → APPLY"


def fill_free_space(page, page_number, bottom, modules, flow, accent, pale, placements):
    start = max(118, bottom + 18)
    end = 781.0
    height = end - start
    if height < 72:
        return
    if height >= 290:
        count, flow_h = 2, 44
    elif height >= 145:
        count, flow_h = 1, 44
    else:
        count, flow_h = 1, 0
    gap = 12
    card_total = height - flow_h - gap * (count if flow_h else count - 1)
    card_h = min(182, card_total / count)
    y = start
    for i in range(count):
        title, body = modules[i]
        rect = (40, y, 555, y + card_h)
        draw_card(page, rect, title, body, accent, pale, notes=card_h >= 118)
        placements.append({"page": page_number, "original_bottom": bottom, "start": y, "end": y + card_h})
        y += card_h + gap
    if flow_h:
        draw_flow(page, (40, y, 555, y + flow_h), flow, accent, pale)
        placements.append({"page": page_number, "original_bottom": bottom, "start": y, "end": y + flow_h})


def replace_page(doc, index, fill=IVORY):
    doc.delete_page(index)
    page = doc.new_page(pno=index, width=W, height=H)
    page.draw_rect((0, 0, W, H), color=None, fill=fill)
    ensure_fonts(page)
    return page


def render_cover(doc, index):
    page = replace_page(doc, index, NAVY)
    page.insert_image((0, 0, W, H), filename=str(COVER), keep_proportion=False)
    page.draw_rect((0, 0, W, 7), color=None, fill=GOLD)
    page.insert_text((48, 55), "RESEARCH  •  RECOGNITION  •  RECOVERY", fontname="DVB", fontsize=8.5, color=GOLD)
    page.insert_text((48, 112), "Dark Psychology", fontname="PLAY", fontsize=36, color=IVORY)
    draw_wrapped(page, "Rishton Ka Andhera,\nSamajh Ki Roshni", 48, 145, 390, "DVSER", 18, rgb("F1D9C9"), 26)
    page.draw_line((48, 220), (150, 220), color=GOLD, width=2)
    page.draw_rect((40, 237, 386, 315), color=None, fill=NAVY, fill_opacity=.76, radius=.06)
    draw_wrapped(page, "Manipulation ko recognise karna. Consent, boundaries aur emotional safety ko samajhna. Stereotypes nahi—clear lens aur practical recovery.",
                 52, 249, 318, "DVS", 9.6, rgb("E7E3DC"), 14.5)
    page.insert_text((48, 670), "CREATOR", fontname="DVB", fontsize=8.5, color=GOLD)
    page.insert_text((48, 704), "Ankit Mahato", fontname="PLAY", fontsize=25, color=IVORY)
    page.insert_text((48, 755), "42 CHAPTERS  •  150 SELECTED SOURCES", fontname="DVB", fontsize=8, color=rgb("E3D4C1"))
    page.insert_text((48, 776), "850-PAGE PREMIUM WORKBOOK EDITION  /  2026", fontname="DVS", fontsize=8, color=rgb("C9C5BE"))
    page.insert_text((48, 796), "CASE STUDIES  •  WORKSHEETS  •  SAFETY PLANS", fontname="DVS", fontsize=7.4, color=rgb("BFC5CE"))
    page.insert_text((48, 817), "Recognition, dignity, consent and recovery — not control.", fontname="DVS", fontsize=7.4, color=rgb("BFC5CE"))


def render_title_page(doc, index):
    page = replace_page(doc, index, IVORY)
    accent = PART_STYLE["I"]["accent"]
    pale = PART_STYLE["I"]["pale"]
    page.draw_rect((0, 0, W, 235), color=None, fill=NAVY)
    page.draw_rect((0, 0, W, 7), color=None, fill=GOLD)
    page.insert_text((48, 45), "PREMIUM WORKBOOK EDITION", fontname="DVB", fontsize=8.2, color=GOLD)
    page.insert_text((48, 98), "Dark Psychology", fontname="PLAY", fontsize=32, color=IVORY)
    page.insert_text((48, 135), "Rishton Ka Andhera, Samajh Ki Roshni", fontname="DVSER", fontsize=14, color=rgb("E9D8CD"))
    page.insert_text((48, 186), "ANKIT MAHATO", fontname="DVB", fontsize=12, color=IVORY)
    page.insert_text((48, 208), "Creator • 2026", fontname="DVS", fontsize=8.5, color=rgb("BFC7D2"))
    draw_wrapped(page, "Ladkiyon aur mahilaon se judi manipulation, attraction, attachment, boundaries aur emotional safety ki research-informed guide — bina gender stereotypes ke.",
                 48, 270, 499, "DVS", 10.2, TEXT, 15)
    page.insert_text((48, 337), "850-page workbook edition", fontname="DVB", fontsize=9.5, color=accent)
    draw_wrapped(page, "Research synthesis • fictional case studies • practical worksheets • ethical scripts • selected bibliography",
                 48, 357, 499, "DVS", 9.2, MUTED, 14)
    cards = [
        ("RESEARCH", "150 selected sources, cautious takeaways aur original evidence ko context ke saath padhne ka lens."),
        ("PRACTICE", "Fictional cases, recognition checklists, ethical scripts, worksheets aur 30-day practice."),
        ("ETHICS", "Consent, dignity, autonomy aur safety—control tricks aur gender stereotypes ke bajay."),
    ]
    y = 414
    for title, body in cards:
        draw_card(page, (40, y, 555, y + 86), title, body, accent, pale)
        y += 102
    draw_flow(page, (40, 731, 555, 774), "RECOGNITION • DIGNITY • CONSENT • RECOVERY", accent, pale)
    draw_footer(page, index + 1, accent)


def render_part(doc, index, roman, starts):
    style = PART_STYLE[roman]
    accent, pale = style["accent"], style["pale"]
    page = replace_page(doc, index, NAVY)
    page.draw_rect((0, 0, W, 8), color=None, fill=accent)
    page.insert_text((390, 170), roman, fontname="PLAY", fontsize=142, color=NAVY_2)
    page.insert_text((48, 58), f"PART {roman}", fontname="DVB", fontsize=9, color=GOLD)
    draw_wrapped(page, style["title"], 48, 102, 440, "PLAY", 27, IVORY, 35)
    draw_wrapped(page, style["desc"], 48, 206, 455, "DVS", 10.4, rgb("CFD6DF"), 16)
    page.insert_text((48, 278), "IS PART KE CHAPTERS", fontname="DVB", fontsize=8.3, color=accent)
    chapters = [c for c in starts if c["part"] == roman]
    y = 302
    for chapter in chapters:
        page.insert_text((48, y + 10), f"{chapter['chapter']:02d}", fontname="DVB", fontsize=9.2, color=GOLD)
        lines = wrap_text(chapter["title"], "DVS", 9.4, 445)
        end = draw_lines(page, lines, 92, y, "DVS", 9.4, rgb("E5E7EA"), 14)
        page.draw_line((48, end + 3), (547, end + 3), color=NAVY_2, width=.7)
        y = end + 15
    card_y = max(625, min(684, y + 12))
    lens_y = y + 4
    lens_h = min(118, card_y - lens_y - 14)
    if chapters and lens_h >= 78:
        page.draw_rect((40, lens_y, 555, lens_y + lens_h), color=accent, fill=NAVY_2,
                       width=.6, radius=.07, stroke_opacity=.65)
        page.insert_text((56, lens_y + 20), "PART LENS", fontname="DVB", fontsize=8.1, color=GOLD)
        draw_wrapped(page, PROFILES[chapters[0]["chapter"]]["principle"], 56, lens_y + 34,
                     483, "DVS", 8.7, rgb("DFE3E8"), 12.6)
    page.draw_rect((40, card_y, 555, 770), color=accent, fill=NAVY_2, width=.8, radius=.08)
    page.insert_text((56, card_y + 22), "PART REFLECTION", fontname="DVB", fontsize=8.3, color=GOLD)
    draw_wrapped(page, PART_REFLECTION, 56, card_y + 38, 483, "DVS", 8.8, rgb("DFE3E8"), 13)
    draw_footer(page, index + 1, accent, dark=True)


def chapter_source(page):
    blocks = [b for b in block_data(page) if b["y0"] > 55 and b["y1"] < 790]
    quote_index = None
    for i, block in enumerate(blocks):
        if block["y0"] > 115 and 11.8 <= block["size"] <= 13.2:
            quote_index = i
            break
    if quote_index is None:
        raise RuntimeError(f"Chapter quote not found: {page.number + 1}")
    return blocks[quote_index]["text"], blocks[quote_index + 1:]


def render_chapter(doc, index, chapter, quote, blocks):
    style = PART_STYLE[chapter["part"]]
    accent, pale = style["accent"], style["pale"]
    page = replace_page(doc, index, IVORY)
    page.draw_rect((0, 0, W, 250), color=None, fill=NAVY)
    page.draw_rect((0, 0, W, 7), color=None, fill=accent)
    page.insert_text((48, 43), f"CHAPTER {chapter['chapter']:02d}  /  PART {chapter['part']}", fontname="DVB", fontsize=8.5, color=GOLD)
    title_end = draw_wrapped(page, chapter["title"], 48, 72, 490, "PLAY", 24, IVORY, 31)
    quote_y = max(145, title_end + 10)
    draw_wrapped(page, quote, 48, quote_y, 492, "DVSER", 9.6, rgb("D7DDE5"), 14)
    y = 272.0
    for block in blocks:
        text = block["text"]
        if block["size"] >= 10.8 and len(text) < 100:
            y += 4
            y = draw_wrapped(page, text, 48, y, 499, "DVB", 10.1, accent, 14)
            y += 5
        elif text.startswith("-"):
            page.draw_circle((52, y + 6), 2, color=accent, fill=accent)
            y = draw_wrapped(page, text[1:].strip(), 62, y, 485, "DVS", 8.8, TEXT, 12.4)
            y += 4
        elif "Ethical red line" in text:
            lines = wrap_text(text, "DVS", 8.4, 467)
            height = len(lines) * 11.6 + 20
            page.draw_rect((40, y - 3, 555, y + height), color=accent, fill=pale, width=.5, radius=.06)
            y = draw_lines(page, lines, 54, y + 6, "DVS", 8.4, TEXT, 11.6) + 11
        else:
            y = draw_wrapped(page, text, 48, y, 499, "DVS", 8.9, TEXT, 12.7)
            y += 6
        if y > 654:
            raise RuntimeError(f"Chapter opener overflow p{index + 1}: y={y}")
    profile = PROFILES[chapter["chapter"]]
    extra_y = y + 8
    extra_h = min(130, 652 - extra_y)
    if extra_h >= 82:
        extra_body = profile["action"] if chapter["chapter"] % 2 else profile["example"]
        draw_card(page, (40, extra_y, 555, extra_y + extra_h), "TRY THIS", extra_body,
                  accent, pale, notes=extra_h >= 112)
    draw_card(page, (40, 666, 555, 776), "ROSHNI COMPASS",
              profile["principle"] + "\nReflect: " + profile["question"], accent, pale, notes=True)
    draw_footer(page, index + 1, accent)


def normalise_cmaps(path):
    """Normalise font CMaps for strict PDF readers.

    PyMuPDF can emit non-standard five-digit destination tokens for unused
    high Unicode glyphs. ToUnicode destinations must be UTF-16BE, so convert
    those values to surrogate pairs and pad any other odd-length hex token.
    """
    doc = pymupdf.open(path)
    fixed = 0
    for xref in range(1, doc.xref_length()):
        try:
            data = doc.xref_stream(xref)
        except Exception:
            continue
        if not data or b"begincmap" not in data:
            continue
        def pad(match):
            token = match.group(1)
            value = int(token, 16)
            if 0xFFFF < value <= 0x10FFFF:
                # ToUnicode destinations are UTF-16BE, not raw code-point hex.
                value -= 0x10000
                high = 0xD800 + (value >> 10)
                low = 0xDC00 + (value & 0x3FF)
                return f"<{high:04X}{low:04X}>".encode()
            return b"<" + (b"0" + token if len(token) % 2 else token) + b">"
        updated = re.sub(br"<([0-9A-Fa-f]+)>", pad, data)
        if updated != data:
            doc.update_stream(xref, updated)
            fixed += 1
    temp = path.with_name(path.stem + ".normalised.pdf")
    doc.save(temp, garbage=4, deflate=True)
    doc.close()
    temp.replace(path)
    return fixed


def build():
    if not INPUT.exists() or not COVER.exists():
        raise FileNotFoundError("Original PDF or premium cover missing")
    doc = pymupdf.open(INPUT)
    assert len(doc) == 850
    starts = chapter_starts(doc)
    start_pages = {c["page"]: c for c in starts}
    part_pages = {style["start"]: roman for roman, style in PART_STYLE.items()}
    placements = []
    added_pages = 0
    for index in range(850):
        page_number = index + 1
        if index == 0:
            render_cover(doc, index)
            continue
        if index == 1:
            render_title_page(doc, index)
            continue
        if page_number in part_pages:
            render_part(doc, index, part_pages[page_number], starts)
            continue
        if page_number in start_pages:
            original = doc[index]
            quote, blocks = chapter_source(original)
            render_chapter(doc, index, start_pages[page_number], quote, blocks)
            continue
        page = doc[index]
        bottom = original_bottom(page)
        title = page_title(page)
        chapter = chapter_for_page(page_number, starts)
        roman = part_for_page(page_number, starts)
        style = PART_STYLE[roman]
        recolor_page(doc, page, style["accent"], style["pale"])
        ensure_fonts(page)
        draw_frame(page, page_number, style["accent"])
        modules, flow = modules_for(page, page_number, title, chapter)
        before = len(placements)
        fill_free_space(page, page_number, bottom, modules, flow, style["accent"], style["pale"], placements)
        if len(placements) > before:
            added_pages += 1
    toc = [[1, "Premium Cover", 1], [1, "Title & Reader Guide", 2]]
    for roman, style in PART_STYLE.items():
        toc.append([1, f"Part {roman}: {style['title']}", style["start"]])
        for chapter in starts:
            if chapter["part"] == roman:
                toc.append([2, f"{chapter['chapter']:02d}. {chapter['title']}", chapter["page"]])
    toc.extend([
        [1, "Glossary", 775], [1, "Research Summaries", 787], [1, "Worksheets", 799],
        [1, "Safety Plans", 811], [1, "30-Day Practice Tracker", 817],
        [1, "Selected Bibliography", 823], [1, "Selected Index", 843],
    ])
    doc.set_toc(toc)
    metadata = doc.metadata
    metadata.update({
        "title": "Dark Psychology: Rishton Ka Andhera, Samajh Ki Roshni — Premium Workbook Edition",
        "author": "Ankit Mahato",
        "creator": "Ankit Mahato",
        "subject": "Premium research-informed workbook for recognition, consent, boundaries, emotional safety and recovery",
        "keywords": "dark psychology, consent, boundaries, manipulation recognition, recovery, Ankit Mahato, premium workbook",
        "producer": "PyMuPDF premium visual redesign",
    })
    doc.set_metadata(metadata)
    doc.save(OUTPUT, garbage=4, deflate=True, clean=True)
    doc.close()
    fixed_cmaps = normalise_cmaps(OUTPUT)
    print(f"WROTE {OUTPUT}")
    print(f"PAGES 850 | ENRICHED_CONTENT_PAGES {added_pages} | PLACED_MODULES {len(placements)}")
    print(f"NORMALISED_FONT_CMAPS {fixed_cmaps}")
    print(f"BYTES {OUTPUT.stat().st_size}")


if __name__ == "__main__":
    build()
