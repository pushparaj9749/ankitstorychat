#!/usr/bin/env python3
"""Render: Kissa — "Gemini API key kaise setup karein" (1920x1080, 30 fps, ~2:00).

A proper 16:9 cut: voice-over (Hinglish) + the Kissa theme under it, a landscape
layout with the app screen on the left, a live 6-step rail on the right, and
burned-in subtitles that follow the narration word for word.

    python3 build_gemini_16x9.py                 # full MP4 (video + audio)
    python3 build_gemini_16x9.py --stills 4,22    # PNG stills, no audio needed
    python3 build_gemini_16x9.py --audio          # rebuild the mix only

Everything is generated: Kissa screens are drawn in the app's own layout, the
Google AI Studio pages are stylised illustrations of the public pages (and the
card says so), the music is our own synthesised theme, and the voice is TTS.
"""
import glob
import os
import subprocess
import sys
import wave

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_lib as L  # noqa: E402
from gen_lib import (BG, DIM, FAINT, GOLD, ROSE, ROSE_L, SUCCESS, TEXT,  # noqa: E402
                     P4, P5, P6, P7, P8, appear, clamp, draw_runs, ease_io, ease_out,
                     lerp, mock_google_home, mock_google_keys, mock_kissa_ai_setup,
                     mock_kissa_chat, mock_kissa_editor, mock_kissa_you, rect, tap, tw)

FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1920, 1080, 30
VO_DIR = os.path.join(HERE, 'vo16')
OUT = os.path.join(HERE, 'kissa_gemini_api_key_16x9.mp4')
THEME = os.path.abspath(os.path.join(HERE, '..', 'theme'))
LOGO_STING = os.path.join(THEME, 'kissa_logo.mp3')
THEME_FULL = os.path.join(THEME, 'kissa_theme_full.mp3')

# ------------------------------------------------------------------ layout ---
PX0, PY0, PX1, PY1 = 80, 168, 1240, 922
PW, PH = PX1 - PX0, PY1 - PY0            # 1160 x 754
PANEL_AR = PW / PH

RX0, RX1 = 1290, 1850                     # right rail
SUB_Y = 946                               # subtitle band top
PROG_Y = 1052

BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
MODEL = 'gemini-3.8-flash'

SCENE_KEYS = ['v01_hook', 'v02_why', 'v03_step1', 'v04_step2', 'v05_step3',
              'v06_step4', 'v07_step5', 'v08_step6', 'v09_errors', 'v10_outro']
TITLES = ['Setup kya hai?', 'Key kya karti hai', 'aistudio.google.com', 'Key banao',
          'Kissa > You', 'Details bharo', 'Test + Save', 'AI READY', 'Errors', 'Ho gaya']
KICKERS = ['KISSA · AI SETUP', 'PEHLE YE SAMJHO', 'STEP 1 / 6 · BROWSER',
           'STEP 2 / 6 · API KEY', 'STEP 3 / 6 · KISSA', 'STEP 4 / 6 · FIELDS',
           'STEP 5 / 6 · TEST', 'STEP 6 / 6 · VERIFY', 'TROUBLESHOOTING', 'AB TUMHARI BAARI']


# --------------------------------------------------------------- background --
_BG = None


def background():
    global _BG
    if _BG is not None:
        return _BG.copy()
    base = L.vgrad((W, H), (7, 7, 11), (13, 13, 20)).convert('RGB')
    for color, center, radius, strength, k in (
        (ROSE, (250, 240), 780, 0.30, 0.5),
        ((120, 90, 200), (1650, 980), 700, 0.16, 0.45),
        (GOLD, (1500, 60), 520, 0.12, 0.4),
    ):
        layer, mask = L.radial_glow((W, H), center, radius, color, strength)
        base = Image.composite(layer, base, mask.point(lambda v: int(v * k)))
    # vignette
    vig = Image.new('L', (W // 8, H // 8), 0)
    dv = ImageDraw.Draw(vig)
    dv.ellipse([-W // 24, -H // 24, W // 8 + W // 24, H // 8 + H // 24], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(14)).resize((W, H), Image.BILINEAR)
    base = Image.composite(base, Image.new('RGB', (W, H), (3, 3, 6)), vig)
    # grain
    n = np.random.default_rng(7).normal(0, 2.4, (H, W, 1)).repeat(3, axis=2)
    base = Image.fromarray(np.clip(np.asarray(base, float) + n, 0, 255).astype('uint8'))
    _BG = base
    return base.copy()


# ------------------------------------------------------------------- text ----
def fit(text, f_max, maxw, draw, size_max, size_min=18):
    size = size_max
    while size > size_min and draw.textlength(text, font=draw._image and P7(size)) > maxw:
        size -= 1
    return P7(size)


def head(img, kicker, title, accent=None, accent_color=ROSE_L, y_k=38, y_t=66):
    d = ImageDraw.Draw(img)
    d.text((PX0, y_k), kicker, font=P6(18), fill=ROSE_L)
    size = 54
    f = P8(size)
    while size > 30 and d.textlength(title, font=f) > (W - 2 * PX0):
        size -= 2
        f = P8(size)
    if accent and accent in title:
        pre, _, post = title.partition(accent)
        x = PX0
        d.text((x, y_t), pre, font=f, fill=TEXT)
        x += d.textlength(pre, font=f)
        d.text((x, y_t), accent, font=f, fill=accent_color)
        x += d.textlength(accent, font=f)
        d.text((x, y_t), post, font=f, fill=TEXT)
    else:
        d.text((PX0, y_t), title, font=f, fill=TEXT)
    return img


def kicker_only(img, text, color=ROSE_L, x=PX0, y=38, size=17):
    ImageDraw.Draw(img).text((x, y), text, font=P6(size), fill=color)


# ------------------------------------------------------------------ panel ----
def panel_frame(img, title_chip=None, note=None):
    """Shadow + hairline for the screen window, before content is pasted."""
    sh = Image.new('RGBA', (PW + 120, PH + 120), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([60, 66, 60 + PW, 66 + PH], radius=24,
                                         fill=(0, 0, 0, 190))
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    img.paste(sh, (PX0 - 60, PY0 - 54), sh)


MOCK_ZOOM = 0.90        # read the app at ~1.1x instead of pixel-for-pixel


def crop_focus(cx, cy, pad_top=0, zoom=None):
    """Crop window centred on (cx, cy) in a 1080x2340 mock, at MOCK_ZOOM."""
    cw = 1080.0 * (MOCK_ZOOM if zoom is None else zoom)
    ch = cw / PANEL_AR
    x = 0.0
    y = L.clamp(cy - ch / 2 + pad_top, 0, 2340 - ch)
    return (x, y, x + cw, y + ch)


def map_pt(box, pt):
    sx = PX0 + (pt[0] - box[0]) * PW / (box[2] - box[0])
    sy = PY0 + (pt[1] - box[1]) * PH / (box[3] - box[1])
    return sx, sy


def paste_mock(img, mock, box, radius=22):
    card = L.camera(mock, tuple(int(round(v)) for v in box), (PW, PH), radius=radius)
    img.paste(card, (PX0, PY0), card)
    return img


def ring_at(img, xy, t, pulse_speed=4.2, rx=150, ry=44, color=(255, 255, 255)):
    """Pulsing highlight ring. Keep the colour dark on the white Google pages —
    a white ring on a white button is invisible."""
    pulse = 0.5 + 0.5 * np.sin(t * pulse_speed)
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        [xy[0] - rx, xy[1] - ry, xy[0] + rx, xy[1] + ry], radius=26,
        outline=color + (int(90 + 80 * pulse),), width=4)
    img.paste(layer, (0, 0), layer)


def tap_at(img, cx, cy, t, start, dur=0.6, color=(255, 255, 255)):
    """Same gesture as gen_lib.tap, with a colour that shows on light screens."""
    for offset, alpha in ((0.0, 200), (0.12, 130)):
        k = (t - start - offset) / dur
        if 0 <= k <= 1:
            r = lerp(14, 96, ease_out(k))
            layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r],
                                          outline=color + (int(alpha * (1 - k)),), width=6)
            img.paste(layer, (0, 0), layer)
    k = (t - start) / 0.25
    if 0 <= k <= 1:
        layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([cx - 17, cy - 17, cx + 17, cy + 17],
                                      fill=color + (int(170 * (1 - k)),))
        img.paste(layer, (0, 0), layer)


# ------------------------------------------------------------------- rail ----
STEP_SHORT = ['AI Studio kholo', 'Key banao + copy', 'Kissa > You tab', 'Details bharo',
              'Test + Save', 'AI READY check']


def rail_steps(img, active, done_upto=None, lt=0.0):
    d = ImageDraw.Draw(img)
    d.text((RX0, 168), 'STEPS', font=P6(15), fill=FAINT)
    y0 = 200
    rowh = 74
    done_upto = active - 1 if done_upto is None else done_upto
    for i, label in enumerate(STEP_SHORT):
        y = y0 + i * rowh
        if i == active:
            a = appear(lt, 0.05, 0.35)
            rect(d, [RX0 - 14, y + int((1 - a) * 10) - 14, RX1, y + rowh - 20 + int((1 - a) * 10)],
                 14, (34, 20, 27), (120, 56, 70), 1)
            col_num, col_txt, f = ROSE, TEXT, P6(21)
        elif i <= done_upto:
            col_num, col_txt, f = SUCCESS, (188, 192, 202), P5(21)
        else:
            col_num, col_txt, f = (72, 75, 88), (108, 112, 124), P4(21)
        cxx, cyy = RX0 + 12, y + 12
        if i <= done_upto:
            d.ellipse([cxx - 15, cyy - 15, cxx + 15, cyy + 15], outline=SUCCESS, width=3)
            d.line([(cxx - 7, cyy + 1), (cxx - 1, cyy + 8)], fill=SUCCESS, width=3)
            d.line([(cxx - 1, cyy + 8), (cxx + 9, cyy - 7)], fill=SUCCESS, width=3)
        elif i == active:
            d.ellipse([cxx - 15, cyy - 15, cxx + 15, cyy + 15], fill=ROSE)
            d.text((cxx - 6, cyy - 13), str(i + 1), font=P7(19), fill=(16, 7, 11))
        else:
            d.ellipse([cxx - 15, cyy - 15, cxx + 15, cyy + 15], outline=(70, 74, 86), width=2)
            d.text((cxx - 6, cyy - 12), str(i + 1), font=P5(18), fill=(96, 100, 112))
        d.text((RX0 + 44, y - 2), label, font=f, fill=col_txt)
    return img


def rail_card(img, y0, y1, title, lines, accent=GOLD, title_color=None):
    """Small card in the rail: title + value lines (each a str or [(txt, col), ...])."""
    d = ImageDraw.Draw(img)
    rect(d, [RX0, y0, RX1, y1], 18, (19, 20, 28), (46, 48, 60), 1)
    d.text((RX0 + 24, y0 + 18), title, font=P6(14), fill=title_color or accent)
    yy = y0 + 46
    for ln in lines:
        runs = [(ln, TEXT)] if isinstance(ln, str) else ln
        f = P5(20)
        x = RX0 + 24
        for txt, col in runs:
            d.text((x, yy), txt, font=f, fill=col)
            x += d.textlength(txt, font=f)
        yy += 32
    return img


def rail_meta(img, text, note=None):
    d = ImageDraw.Draw(img)
    y = PY1 - 58
    d.text((RX0, y), 'ABHI DEKH RAHE HO', font=P6(13), fill=FAINT)
    d.text((RX0, y + 22), text, font=P5(20), fill=DIM)
    if note:
        d.text((RX0, y + 50), note, font=P4(15), fill=(96, 100, 112))
    return img


# -------------------------------------------------------------- subtitles ----
def subtitles(img, lines, lt=0.0, vo=0.0):
    """Bottom subtitle band. With `vo`, the second line comes in later, so the
    captions move with the narration instead of sitting there for 12 seconds."""
    d = ImageDraw.Draw(img)
    band = Image.new('RGBA', (W, 104), (0, 0, 0, 0))
    ImageDraw.Draw(band).rounded_rectangle([0, 0, W - 1, 103], radius=16,
                                           fill=(10, 11, 16, 232))
    img.paste(band, (PX0 - 4, SUB_Y - 6), band)
    d.rectangle([PX0 - 4, SUB_Y + 4, PX0 + 3, SUB_Y + 90], fill=ROSE)
    f = P5(35)
    yy = SUB_Y + (4 if len(lines) == 2 else 20)
    gap = max(1.2, (vo - 1.6) * 0.5) if vo else 0.0
    for i, runs in enumerate(lines):
        start = 0.02 + i * gap
        k = appear(lt, start, 0.32)
        x = PX0 + 26
        for txt, col in runs:
            d.text((x, yy + int((1 - k) * 8)), txt, font=f,
                   fill=col if k > 0.35 else (58, 60, 70))
            x += d.textlength(txt, font=f)
        yy += 48
    return img


def progress(img, k):
    d = ImageDraw.Draw(img)
    d.rectangle([PX0, PROG_Y, W - PX0, PROG_Y + 3], fill=(30, 32, 40))
    d.rectangle([PX0, PROG_Y, PX0 + (W - 2 * PX0) * clamp(k), PROG_Y + 3], fill=ROSE)


def badge(img, xy, text, col=SUCCESS, size=15):
    d = ImageDraw.Draw(img)
    f = P6(size)
    w = d.textlength(text, font=f) + 34
    x, y = xy
    rect(d, [x, y, x + w, y + 34], 17, (14, 34, 26), (48, 104, 82), 1)
    d.ellipse([x + 12, y + 12, x + 22, y + 22], fill=col)
    d.text((x + 28, y + 7), text, font=f, fill=col)
    return img


def wrap_text(d, text, f, maxw):
    words, lines, cur = text.split(' '), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) <= maxw:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# =============================================================== scenes ======

def s_hook(img, lt, dur):
    head(img, KICKERS[0], 'Gemini API key ka 2-minute setup', accent='2-minute')
    chat, ac = mock_kissa_chat()
    crops = [(0.0, crop_focus(540, 470)), (dur * 0.55, crop_focus(540, 760))]
    box = L.camera_anim(crops, lt)
    panel_frame(img)
    paste_mock(img, chat, box)

    # small caption chip inside the panel (top-left) — never covers a bubble
    a = appear(lt, 0.35, 0.5)
    d = ImageDraw.Draw(img)
    chip = 'AI story chat · Kissa'
    f = P6(17)
    w = d.textlength(chip, font=f) + 58
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    dl = ImageDraw.Draw(layer)
    dl.rounded_rectangle([PX0 + 24, PY0 + 24, PX0 + 24 + w, PY0 + 62], radius=19,
                         fill=(10, 11, 16, int(225 * a)))
    dl.ellipse([PX0 + 40, PY0 + 37, PX0 + 50, PY0 + 47], fill=ROSE)
    img.paste(layer, (0, 0), layer)
    d.text((PX0 + 62, PY0 + 30), chip, font=f, fill=(228, 230, 238))

    rail_steps(img, -1, done_upto=-2, lt=lt)  # dim rail, no active step
    facts = [('Free tier', 'Card nahi lagta', GOLD), ('Key phone pe', 'Encrypted, server pe nahi', SUCCESS),
             ('Koi login nahi', 'Kissa account nahi maangta', ROSE_L)]
    for i, (t1, t2, col) in enumerate(facts):
        a = appear(lt, 0.5 + i * 0.2, 0.4)
        y = 200 + i * 118 + int((1 - a) * 18)
        rect(d, [RX0, y, RX1, y + 98], 18, (20, 21, 29), (46, 48, 60), 1)
        d.rectangle([RX0, y + 20, RX0 + 4, y + 78], fill=col)
        d.text((RX0 + 26, y + 22), t1, font=P6(23), fill=TEXT)
        d.text((RX0 + 26, y + 56), t2, font=P4(18), fill=DIM)
    rail_meta(img, 'Chrome + Kissa app', 'Koi PC ki zarurat nahi')
    subtitles(img, [
        [('Kissa mein AI characters chalane ke liye ', DIM), ('ek chhota setup', TEXT), (' chahiye:', DIM)],
        [('apni ', DIM), ('Gemini API key', ROSE_L), (' — do minute, free, sirf phone se.', DIM)],
    ], lt, vo=dur)
    return img


def s_why(img, lt, dur):
    head(img, KICKERS[1], 'Key kya karti hai', accent='kya karti')
    d = ImageDraw.Draw(img)
    panel_frame(img)
    rect(d, [PX0, PY0, PX1, PY1], 22, (14, 15, 21), (44, 46, 58), 1)

    # flow: KISSA -> GEMINI -> JAWAB
    boxes = [('KISSA', 'app + kahani', ROSE), ('GEMINI', 'Google ka AI', (140, 170, 230)),
             ('JAWAB', 'story mein', SUCCESS)]
    bw, bh, gap = 268, 132, 92
    x0 = PX0 + (PW - (bw * 3 + gap * 2)) / 2
    cy = PY0 + 120
    for i, (t1, t2, col) in enumerate(boxes):
        a = appear(lt, 0.2 + i * 0.25, 0.4)
        yy = cy + int((1 - a) * 20)
        x = x0 + i * (bw + gap)
        rect(d, [x, yy, x + bw, yy + bh], 20, (23, 24, 33), (54, 57, 70), 1)
        d.text((x + (bw - d.textlength(t1, font=P7(26))) / 2, yy + 30), t1, font=P7(26), fill=col)
        d.text((x + (bw - d.textlength(t2, font=P4(17))) / 2, yy + 74), t2, font=P4(17), fill=FAINT)
        if i < 2:
            ax = x + bw + 16
            d.line([(ax, yy + bh / 2), (ax + gap - 30, yy + bh / 2)], fill=(92, 96, 112), width=3)
            d.polygon([(ax + gap - 30, yy + bh / 2 - 8), (ax + gap - 16, yy + bh / 2),
                       (ax + gap - 30, yy + bh / 2 + 8)], fill=(92, 96, 112))
            # a key "travelling" from Kissa to Gemini to the reply, looping
            for j in range(2):
                ph = ((lt * 0.45) + j * 0.5 + i * 0.25) % 1.0
                if a < 0.9:
                    continue
                dot_x = ax + ph * (gap - 34)
                dot_a = int(230 * (1 - abs(ph - 0.5) * 1.2))
                d.ellipse([dot_x - 5, yy + bh / 2 - 5, dot_x + 5, yy + bh / 2 + 5],
                          fill=(ROSE[0], ROSE[1], ROSE[2], max(30, dot_a)))

    # key chip
    ky = PY0 + 330
    a = appear(lt, 1.1, 0.5)
    rect(d, [PX0 + 80, ky + int((1 - a) * 18), PX1 - 80, ky + 126 + int((1 - a) * 18)],
         20, (26, 22, 30), (74, 52, 62), 1)
    d.ellipse([PX0 + 116, ky + 58, PX0 + 176, ky + 118], outline=ROSE, width=7)
    d.line([(PX0 + 170, ky + 88), (PX0 + 252, ky + 88)], fill=ROSE, width=7)
    d.line([(PX0 + 226, ky + 88), (PX0 + 226, ky + 112)], fill=ROSE, width=7)
    d.text((PX0 + 286, ky + 52), 'AIzaSyD…•3Qk', font=P5(28), fill=TEXT)
    d.text((PX0 + 286, ky + 92), 'tumhari key · tumhara control', font=P4(19), fill=FAINT)

    notes = [('Kissa khud kahani nahi likhta', 'har reply provider se aati hai'),
             ('Key sirf tumhare phone pe', 'encrypted, hamare server pe nahi'),
             ('Model kabhi bhi badlo', 'Settings > AI Setup > Edit')]
    for i, (t1, t2) in enumerate(notes):
        a = appear(lt, 1.4 + i * 0.22, 0.45)
        y = PY0 + 380 + i * 112 + int((1 - a) * 22)
        rect(d, [PX0 + 40, y, PX1 - 40, y + 96], 16, (19, 20, 27), (42, 44, 56), 1)
        d.text((PX0 + 72, y + 20), t1, font=P6(23), fill=TEXT)
        d.text((PX0 + 72, y + 56), t2, font=P4(18), fill=DIM)
        d.line([(PX1 - 96, y + 48), (PX1 - 70, y + 48)], fill=ROSE_L, width=2)
        d.polygon([(PX1 - 70, y + 48), (PX1 - 80, y + 42), (PX1 - 80, y + 54)], fill=ROSE_L)

    # rail: the three notes list is on the panel, so the rail holds the promise
    kicker_only(img, 'KEY = PAAS', ROSE_L, RX0, 168)
    rail_card(img, 200, 470, 'YAAD RAKHO', [
        [('Key = AI ka paas.', TEXT)],
        [('Sirf phone pe', DIM)],
        [('encrypted.', DIM)],
        [('Reply seedha', DIM)],
        [('Google se.', DIM)],
    ], accent=ROSE_L)
    rail_card(img, 490, 700, 'LAGEGA KITNA?', ['~2 minute', '₹0 · card nahi', 'sirf phone'],
              accent=GOLD)
    rail_meta(img, 'Phone + Chrome', 'Koi PC nahi chahiye')
    subtitles(img, [
        [('Har reply tumhare ', DIM), ('AI provider', TEXT), (' se aati hai —', DIM)],
        [('key tumhari, control bhi tumhara, koi server beech mein nahi.', DIM)],
    ], lt, vo=dur)
    return img


def s_step1(img, lt, dur):
    head(img, KICKERS[2], 'aistudio.google.com kholo', accent='aistudio')
    mock, anchors = mock_google_home(url_typed='ais' if lt < 0.7 else 'aistudio.google.com')
    gk = anchors['getkey']
    crops = [(0.0, crop_focus(540, 690)),
             (dur * 0.32, crop_focus(540, 780)),
             (dur * 0.60, crop_focus(540, gk[1] + 40))]
    box = L.camera_anim(crops, lt)
    panel_frame(img)
    paste_mock(img, mock, box)

    sx, sy = map_pt(box, gk)
    if lt > dur * 0.56:
        ring_at(img, (sx, sy), lt, rx=150, ry=40, color=ROSE)
    if lt > dur * 0.66:
        tap_at(img, sx, sy, lt, dur * 0.70, color=ROSE)

    rail_steps(img, 0, lt=lt)
    rail_card(img, 700, PY1 - 74, 'AAGE KYA', ['Sign in > Get API key', 'Koi card nahi lagta'], accent=GOLD)
    rail_meta(img, 'Chrome · aistudio.google.com', 'Illustration of the public page')
    subtitles(img, [
        [('Phone ke browser mein ', DIM), ('aistudio.google.com', TEXT), (' kholo,', DIM)],
        [('Google account se ', DIM), ('sign in', TEXT), (' karke "Get API key" dabao.', DIM)],
    ], lt, vo=dur)
    return img


def s_step2(img, lt, dur):
    head(img, KICKERS[3], 'Create API key, phir copy', accent='copy')
    plain, a1 = mock_google_keys()
    dialog_img, a2 = mock_google_keys(key_revealed=True, dialog=True)
    create = a1['create']
    dialog_center = a2['dialog']

    t_dialog = dur * 0.56
    crops = [(0.0, crop_focus(540, 640)),
             (dur * 0.26, crop_focus(540, create[1] + 40)),
             (max(0.1, t_dialog - 1.2), crop_focus(540, create[1] + 40)),
             (t_dialog, crop_focus(540, dialog_center[1] + 30))]
    box = L.camera_anim(crops, lt)
    mock = plain
    if lt > t_dialog - 0.4:
        mock = Image.blend(plain, dialog_img, ease_out((lt - (t_dialog - 0.4)) / 0.4))
    panel_frame(img)
    paste_mock(img, mock, box)

    if lt < t_dialog - 0.3:
        sx, sy = map_pt(box, create)
        ring_at(img, (sx, sy), lt, rx=180, ry=42, color=ROSE)
        tap_at(img, sx, sy, lt, dur * 0.34, color=ROSE)
    elif lt > t_dialog + 1.3:
        cx, cy = map_pt(box, a2['dialog_copy'])
        tap_at(img, cx, cy, lt, t_dialog + 1.9, color=ROSE)

    rail_steps(img, 1, lt=lt)
    rail_card(img, 700, PY1 - 74, 'KEY MILTE HI', ['Turant Copy dabao', 'Dobara poori nahi dikhegi'],
              accent=ROSE_L)
    rail_meta(img, 'Chrome · API keys', 'Illustration of the public page')
    subtitles(img, [
        [('"Get API key" ke baad ', DIM), ('Create API key', TEXT), (' dabao,', DIM)],
        [('aur jo key banegi use ', DIM), ('turant copy', TEXT), (' kar lo.', DIM)],
    ], lt, vo=dur)
    return img


def s_step3(img, lt, dur):
    head(img, KICKERS[4], 'Kissa > You tab', accent='You tab')
    you, ay = mock_kissa_you('needed')
    setup, asu = mock_kissa_ai_setup()
    card = ay['ai_card']
    t_switch = dur * 0.55
    crops = [(0.0, crop_focus(540, 600)),
             (dur * 0.20, crop_focus(540, card[1])),
             (t_switch, crop_focus(540, card[1])),
             (t_switch + 1.2, crop_focus(540, asu['add'][1] - 250))]
    box = L.camera_anim(crops, lt)
    mock = you
    if lt > t_switch - 0.4:
        mock = Image.blend(you, setup, ease_out((lt - (t_switch - 0.4)) / 0.4))
    panel_frame(img)
    paste_mock(img, mock, box)

    if lt < t_switch - 0.3:
        sx, sy = map_pt(box, card)
        ring_at(img, (sx, sy), lt, rx=PW * 0.42, ry=120)
        tap_at(img, sx, sy, lt, dur * 0.36)
    else:
        add = asu['add']
        ax, ay_ = map_pt(box, add)
        ring_at(img, (ax, ay_), lt, rx=150, ry=40)
        tap(img, ax, ay_, lt, t_switch + 1.4)

    rail_steps(img, 2, lt=lt)
    rail_card(img, 700, PY1 - 74, 'KAHAN MILEGA', ['You tab > AI Setup >', '+ Add AI Provider'],
              accent=GOLD)
    rail_meta(img, 'Kissa · You', 'AI SETUP NEEDED card')
    subtitles(img, [
        [('Ab ', DIM), ('Kissa', TEXT), (' kholo > neeche ', DIM), ('You', TEXT), (' tab >', DIM)],
        [('AI Setup mein ', DIM), ('+ Add AI Provider', TEXT), (' dabao.', DIM)],
    ], lt, vo=dur)
    return img


def typed(full, lt, start, speed=22):
    if lt <= start:
        return ''
    return full[:max(0, min(len(full), int((lt - start) * speed)))]


def s_step4(img, lt, dur):
    head(img, KICKERS[5], 'Gemini ka address + model', accent='address + model')
    name = typed('Gemini', lt, 0.9, 12)
    url = typed(BASE_URL, lt, dur * 0.20, 34)
    model = typed(MODEL, lt, dur * 0.52, 14)
    preset_hot = 'Custom (OpenAI-compatible)' if lt > 0.35 else None
    mock, a = mock_kissa_editor(name=name, url=url, model=model, preset_hot=preset_hot)

    # zoom=1.0 here: the base-URL field runs the full width, and clipping it would
    # hide the part people get wrong (/v1beta/openai).
    Z = 1.0
    crops = [(0.0, crop_focus(540, 560, zoom=Z)),
             (0.7, crop_focus(540, a['presets'][1] + 130, zoom=Z)),
             (dur * 0.16, crop_focus(540, a['name'][1] + 80, zoom=Z)),
             (dur * 0.26, crop_focus(540, a['url'][1] + 60, zoom=Z)),
             (dur * 0.62, crop_focus(540, a['model'][1] + 40, zoom=Z))]
    box = L.camera_anim(crops, lt)
    panel_frame(img)
    paste_mock(img, mock, box)

    # (the mock already lights the Custom chip in rose — no extra ring needed)

    # caret in the field being typed
    field = None
    if dur * 0.07 < lt < dur * 0.17:
        field = a['name']
    elif dur * 0.18 < lt < dur * 0.50:
        field = a['url']
    elif dur * 0.52 < lt < dur * 0.62:
        field = a['model']
    if field and int(lt * 3) % 2 == 0:
        cx, cy = map_pt(box, (field[0] + 380, field[1]))
        d = ImageDraw.Draw(img)
        d.rectangle([cx, cy - 26, cx + 3, cy + 22], fill=(255, 255, 255, 225))

    rail_steps(img, 3, lt=lt)
    rail_card(img, 690, PY1 - 74, 'EXACT VALUES', [
        [('Base URL', FAINT)],
        [('/v1beta/openai', GOLD)],
        [('Model: ', FAINT), ('gemini-3.8-flash', TEXT)],
    ], accent=ROSE_L)
    rail_meta(img, 'Kissa · Add AI Provider', 'Custom (OpenAI-compatible)')
    subtitles(img, [
        [('Preset: ', DIM), ('Custom (OpenAI-compatible)', TEXT), (' · Base URL:', DIM)],
        [('…googleapis.com', DIM), ('/v1beta/openai', GOLD), (' · Model: ', DIM), ('gemini-3.8-flash', TEXT)],
    ], lt, vo=dur)
    return img


def s_step5(img, lt, dur):
    head(img, KICKERS[6], 'Test karo, phir save', accent='Test')
    dots = int(clamp((lt - 0.4) / 0.9) * 26) if lt > 0.4 else 0
    test_state = 'ok' if lt > dur * 0.40 else None
    mock, a = mock_kissa_editor(name='Gemini', url=BASE_URL, model=MODEL, dots=dots,
                                preset_hot='Custom (OpenAI-compatible)', test=test_state)
    btn_y = a['test'][1] - 150
    crops = [(0.0, crop_focus(540, a['key'][1] + 40)),
             (dur * 0.28, crop_focus(540, btn_y)),
             (dur * 0.70, crop_focus(540, btn_y + 40))]
    box = L.camera_anim(crops, lt)
    panel_frame(img)
    paste_mock(img, mock, box)

    tx, ty = map_pt(box, a['test'])
    gx, gy = map_pt(box, a['save'])
    if lt > dur * 0.26:
        ring_at(img, (tx, ty), lt, rx=170, ry=44)
        tap(img, tx, ty, lt, dur * 0.38)
    if lt > dur * 0.60:
        tap(img, gx, gy, lt, dur * 0.72)

    rail_steps(img, 4, lt=lt)
    rail_card(img, 700, PY1 - 74, 'SAFE HAI?', [
        [('Connected', SUCCESS), (' = key sahi', DIM)],
        [('Store', GOLD), (' = phone ke keystore mein', DIM)],
    ], accent=ROSE_L)
    rail_meta(img, 'Kissa · Add AI Provider', 'Test Connection > Save Provider')
    subtitles(img, [
        [('Key paste karo > ', DIM), ('Test Connection', TEXT), (' dabao >', DIM)],
        [('green ', DIM), ('Connected', SUCCESS), (' aaya? Ab ', DIM), ('Save Provider', TEXT), ('.', DIM)],
    ], lt, vo=dur)
    return img


def s_step6(img, lt, dur):
    head(img, KICKERS[7], 'Ab kahani chalao', accent='kahani')
    setup, asu = mock_kissa_ai_setup(provider='gemini', saved=True)
    you, ay = mock_kissa_you('ready')
    chat, ac = mock_kissa_chat()
    crops = [(0.0, crop_focus(540, asu['provider'][1])),
             (dur * 0.26, crop_focus(540, ay['ai_card'][1] + 24)),
             (dur * 0.50, crop_focus(540, ay['ai_card'][1] + 24)),
             (dur * 0.64, crop_focus(540, 560)),
             (dur * 0.82, crop_focus(540, 940))]
    box = L.camera_anim(crops, lt)
    if lt < dur * 0.26:
        mock, label = setup, 'Kissa · providers'
    elif lt < dur * 0.50:
        mock, label = you, 'Kissa · You'
    else:
        mock, label = chat, 'Kissa · story'
    panel_frame(img)
    paste_mock(img, mock, box)

    rail_steps(img, 5, lt=lt)
    rail_card(img, 700, PY1 - 74, 'FINAL CHECK', [
        [('Providers: ', FAINT), ('Gemini · ACTIVE', TEXT)],
        [('You tab: ', FAINT), ('AI READY', SUCCESS)],
    ], accent=ROSE_L)
    rail_meta(img, 'Kissa · story chat', 'Characters Gemini se jawab denge')
    subtitles(img, [
        [('Provider list mein ', DIM), ('Gemini · ACTIVE', TEXT), (', You tab par ', DIM), ('AI READY', SUCCESS)],
        [('Ab kahani kholo — characters jawab denge.', DIM)],
    ], lt, vo=dur)
    return img


def s_errors(img, lt, dur):
    head(img, KICKERS[8], 'Error aaye to ye dekho', accent='ye dekho', accent_color=GOLD)
    d = ImageDraw.Draw(img)
    panel_frame(img)
    rect(d, [PX0, PY0, PX1, PY1], 22, (14, 15, 21), (44, 46, 58), 1)
    rows = [('401', 'Invalid API key', 'Key dobara copy karo — extra space bhi error deta hai',
             (236, 110, 120)),
            ('403', 'Key blocked / region', 'Naya project banao ya doosra Google account try karo',
             (236, 160, 110)),
            ('404', 'Base URL galat', 'Address /v1beta/openai par khatam hona chahiye', GOLD),
            ('429', 'Free limit khatam', '1 min ruko, ya gemini-3.5-flash-lite try karo', SUCCESS)]
    cw = (PW - 96) / 2
    chh = 208
    for i, (code, title, fix, col) in enumerate(rows):
        a = appear(lt, 0.2 + i * 0.14, 0.4)
        cx = PX0 + 32 + (i % 2) * (cw + 32)
        cy = PY0 + 30 + (i // 2) * (chh + 26) + int((1 - a) * 18)
        rect(d, [cx, cy, cx + cw, cy + chh], 18, (21, 22, 30), (48, 50, 62), 1)
        rect(d, [cx, cy, cx + 6, cy + chh], 3, col)
        d.text((cx + 30, cy + 26), code, font=P7(30), fill=col)
        d.text((cx + 118, cy + 30), title, font=P6(23), fill=TEXT)
        yy = cy + 92
        for ln in wrap_text(d, fix, P4(18), cw - 60):
            d.text((cx + 30, yy), ln, font=P4(18), fill=DIM)
            yy += 27

    # bottom strip: the one mistake that causes most 404s
    a = appear(lt, 0.9, 0.5)
    sy = PY0 + 30 + 2 * chh + 26 + 22 + int((1 - a) * 14)
    rect(d, [PX0 + 32, sy, PX1 - 32, sy + 96], 16, (30, 24, 18), (92, 74, 44), 1)
    d.text((PX0 + 62, sy + 20), 'SABSE COMMON GALTI', font=P6(14), fill=GOLD)
    d.text((PX0 + 62, sy + 46), 'Base URL mein  /v1  ya  /chat/completions  lagana — '
           'sirf  /v1beta/openai  tak.', font=P4(21), fill=(220, 214, 200))

    kicker_only(img, 'QUICK FIX', GOLD, RX0, 168)
    rail_card(img, 200, 400, 'BASE URL MEIN /v1 NAHI', [
        [('sahi: ', FAINT)],
        [('/v1beta/openai', GOLD)],
    ], accent=ROSE_L)
    rail_card(img, 420, 640, 'AB BHI NA CHALE?', ['Key delete karke', 'nayi banao, phir', 'Test Connection'],
              accent=ROSE_L)
    rail_meta(img, 'Kissa · AI Setup', 'Error message padho, phir fix karo')
    subtitles(img, [
        [('401', (236, 110, 120)), (' key galat · ', DIM), ('403', (236, 160, 110)),
         (' blocked · ', DIM), ('404', GOLD), (' base URL', DIM)],
        [('429', SUCCESS), (' free limit khatam — 1 min ruko ya lighter model.', DIM)],
    ], lt, vo=dur)
    return img


def s_outro(img, lt, dur):
    d = ImageDraw.Draw(img)
    d.text((PX0, 96), KICKERS[9], font=P6(18), fill=ROSE_L)
    size = 92
    f = P8(size)
    d.text((PX0, 132), 'Key lag gayi.', font=f, fill=TEXT)
    d.text((PX0, 132 + int(size * 1.16)), 'Ab kahani shuru.', font=f, fill=ROSE_L)

    y = 392
    rect(d, [PX0, y, PX1 - 40, y + 300], 22, (20, 21, 29), (52, 54, 68), 1)
    d.text((PX0 + 40, y + 28), 'YAAD RAKHO', font=P6(15), fill=GOLD)
    pts = ['Key kisi ko mat bhejo — chat, screenshot, kuch bhi nahi.',
           'Key sirf tumhare phone mein encrypted rehti hai.',
           'Model kabhi bhi badlo: Settings > AI Setup > Edit.',
           'Free quota khatam? Kal reset hota hai.']
    for i, p in enumerate(pts):
        a = appear(lt, 0.4 + i * 0.16, 0.4)
        d.ellipse([PX0 + 44, y + 72 + i * 50, PX0 + 52, y + 80 + i * 50], fill=ROSE)
        d.text((PX0 + 68, y + 62 + i * 50 + int((1 - a) * 8)), p, font=P4(21), fill=DIM)

    b = appear(lt, 1.5, 0.5)
    yy = 736 + int((1 - b) * 20)
    rect(d, [PX0, yy, PX0 + 760, yy + 190], 22, (32, 19, 26), (112, 58, 72), 1)
    d.text((PX0 + 36, yy + 26), 'Kissa download karo', font=P6(22), fill=DIM)
    d.text((PX0 + 36, yy + 60), 'beyondredeye.site', font=P7(44), fill=ROSE_L)
    d.text((PX0 + 36, yy + 126), 'Android 8+ · free · no account · no coins',
           font=P4(19), fill=FAINT)

    # rail: end card
    a = appear(lt, 0.3, 0.5)
    rect(d, [RX0, 200, RX1, 640], 22, (18, 19, 26), (48, 50, 64), 1)
    d.text((RX0 + 34, 230), 'KISSA', font=P8(40), fill=(238, 238, 244))
    d.text((RX0 + 34, 288), 'AI story chat', font=P4(20), fill=FAINT)
    d.line([(RX0 + 34, 330), (RX1 - 34, 330)], fill=(44, 46, 58), width=1)
    for i, (t1, t2) in enumerate((('Gemini', 'free tier'), ('har kahani', 'naya modh'),
                                  ('no account', 'koi login nahi'))):
        d.text((RX0 + 34, 352 + i * 74), t1, font=P6(22), fill=TEXT)
        d.text((RX0 + 34, 382 + i * 74), t2, font=P4(17), fill=FAINT)
    d.text((RX0 + 34, 588), '#Kissa #Gemini', font=P6(18), fill=ROSE_L)
    rail_meta(img, 'Save karo · share karo', 'Setup baad mein kaam aayega')
    subtitles(img, [
        [('Bas itna hi — key kabhi ', DIM), ('share mat karo', ROSE_L), (', phone pe encrypted.', DIM)],
        [('Download: ', DIM), ('beyondredeye.site', GOLD), (' · ab apni kahani shuru karo.', DIM)],
    ], lt, vo=dur)
    return img


SCENE_FNS = [s_hook, s_why, s_step1, s_step2, s_step3, s_step4, s_step5, s_step6,
             s_errors, s_outro]


# ================================================================ timing =====

def vo_path(key):
    return os.path.join(VO_DIR, key + '.mp3')


def probe_dur(path):
    o = subprocess.run([FF, '-i', path], capture_output=True, text=True).stderr
    for line in o.splitlines():
        if 'Duration' in line:
            hms = line.split('Duration: ')[1].split(',')[0]
            hh, mm, ss = hms.split(':')
            return float(hh) * 3600 + float(mm) * 60 + float(ss)
    return 0.0


def timeline():
    """Scene durations derived from the actual VO lengths."""
    vo = {k: probe_dur(vo_path(k)) for k in SCENE_KEYS}
    out = []
    for k in SCENE_KEYS:
        tail = 1.5 if k not in ('v01_hook', 'v10_outro') else 2.0
        d = max(7.6, vo[k] + tail)
        out.append((k, round(d, 2), vo[k]))
    return out


# ================================================================ render =====

def frame_at(t, tl):
    img = background()
    acc = 0.0
    for i, (key, dur, _vo) in enumerate(tl):
        if t < acc + dur or i == len(tl) - 1:
            lt = max(0.0, t - acc)
            img = SCENE_FNS[i](img, lt, dur)
            d = ImageDraw.Draw(img)
            # brand mark, bottom-right above the progress line
            d.text((W - PX0 - 88, PY0 - 40), 'KISSA', font=P7(20), fill=(150, 152, 162))
            d.polygon([(W - PX0 - 70, PY0 - 30), (W - PX0 - 62, PY0 - 22),
                       (W - PX0 - 70, PY0 - 14), (W - PX0 - 78, PY0 - 22)], fill=ROSE)
            progress(img, t / total_dur(tl))
            return img
        acc += dur
    return img


def total_dur(tl):
    return sum(d for _, d, _ in tl)


def render(tl):
    total = total_dur(tl)
    n = int(total * FPS)
    silent = os.path.join(HERE, '_silent_16x9.mp4')
    cmd = [FF, '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
           '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium',
           '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL)
    for i in range(n):
        img = frame_at(i / FPS, tl)
        p.stdin.write(img.tobytes())
        if i % 120 == 0:
            print(f'  frame {i}/{n} ({100 * i / n:.1f}%)', flush=True)
    p.stdin.close()
    p.wait()
    print('  video done', silent, flush=True)
    return silent, total


# ================================================================= audio =====

def decode(path, sr=48000):
    """MP3/WAV -> (n, 2) float32 at `sr`."""
    cmd = [FF, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(sr), '-']
    raw = subprocess.run(cmd, capture_output=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()
    return a


def rms(a):
    return float(np.sqrt(np.mean(a ** 2) + 1e-12))


def loop_to(a, n, xfade=1.2, sr=48000):
    """Loop `a` to exactly n samples with an equal-power crossfade at the seam."""
    x = int(xfade * sr)
    out = a.copy()
    while len(out) < n + x:
        tail = out[-x:]
        head = a[:x]
        k = np.linspace(0, 1, x)[:, None]
        seam = tail * np.cos(k * np.pi / 2) + head * np.sin(k * np.pi / 2)
        out = np.concatenate([out[:-x], seam, a[x:]])
    return out[:n]


def audio_mix(tl, total, out_wav):
    sr = 48000
    n = int(total * sr)
    music = decode(THEME_FULL, sr)
    music = loop_to(music, n)
    # music level: sit under the voice
    music *= (0.085 / max(rms(music), 1e-9))
    # gentle fade in/out
    fi, fo = int(1.2 * sr), int(2.4 * sr)
    music[:fi] *= np.linspace(0, 1, fi)[:, None]
    music[-fo:] *= np.linspace(1, 0, fo)[:, None]

    voice = np.zeros((n, 2), np.float32)
    marks = []
    acc = 0.0
    for key, dur, vo in tl:
        clip = decode(vo_path(key), sr)
        # even out clip loudness
        clip *= (0.16 / max(rms(clip), 1e-9))
        start = int((acc + 0.8) * sr)
        end = min(n, start + len(clip))
        voice[start:end] += clip[:end - start]
        marks.append((start, end))
        acc += dur

    # ducking envelope
    env = np.ones(n, np.float32)
    at, rel = int(0.18 * sr), int(0.55 * sr)
    for s, e in marks:
        env[max(0, s - at):e + rel] = 0.42
    # smooth
    ker = np.ones(int(0.25 * sr), np.float32) / int(0.25 * sr)
    env = np.convolve(env, ker, mode='same').astype(np.float32)
    env = np.clip(env, 0.42, 1.0)

    mix = voice + music * env[:, None]

    # logo sting on the end card
    if os.path.exists(LOGO_STING):
        sting = decode(LOGO_STING, sr)
        sting *= (0.12 / max(rms(sting), 1e-9))
        st = n - len(sting) - int(0.2 * sr)
        if st > 0:
            mix[st:st + len(sting)] += sting

    # soft-knee limiter, then peak-normalise
    peak = np.max(np.abs(mix)) + 1e-9
    mix = np.tanh(mix / (peak * 0.85)) * 0.85
    mix *= 0.92 / max(np.max(np.abs(mix)), 1e-9)
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    with wave.open(out_wav, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    print(f'  audio -> {out_wav}  ({total:.2f}s, speech {sum(v for *_, v in tl):.1f}s)', flush=True)


def mux(silent, wav, out):
    subprocess.run([FF, '-y', '-i', silent, '-i', wav, '-c:v', 'copy',
                    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                    '-shortest', '-movflags', '+faststart', out], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(silent)
    print('  done', out, flush=True)


def stills(times, tl):
    os.makedirs('/tmp/wide', exist_ok=True)
    for s in times:
        img = frame_at(float(s), tl)
        p = f'/tmp/wide/t{s:06.2f}.png'
        img.save(p)
        print(p)
    return tl


def sheet(tl, out):
    total = total_dur(tl)
    times = [total * k / 8 for k in range(8)]
    thumbs = []
    for s in times:
        thumbs.append((s, frame_at(s, tl).resize((480, 270), Image.LANCZOS)))
    sh = Image.new('RGB', (2 * 490 + 8, 4 * 292 + 8), (8, 8, 12))
    d = ImageDraw.Draw(sh)
    for i, (s, im) in enumerate(thumbs):
        x = 8 + (i % 2) * 490
        y = 8 + (i // 2) * 292
        d.text((x, y), f'{s:.1f}s', font=P6(16), fill=(200, 202, 212))
        sh.paste(im, (x, y + 22))
    sh.save(out, quality=90)
    print(out)


def main():
    args = sys.argv[1:]
    tl = timeline()
    total = total_dur(tl)
    for k, d, v in tl:
        print(f'  {k:12s} scene {d:5.1f}s  vo {v:5.1f}s')
    print(f'  total {total:.2f}s ({int(total // 60)}:{total % 60:04.1f})')

    if '--stills' in args:
        i = args.index('--stills')
        times = [float(x) for x in args[i + 1].split(',')]
        stills(times, tl)
        return
    if '--preview' in args:
        sheet(tl, os.path.join(HERE, 'preview_16x9.jpg'))
        return
    if '--audio' in args:
        audio_mix(tl, total, os.path.join(HERE, '_mix16.wav'))
        return

    silent, total = render(tl)
    wav = os.path.join(HERE, '_mix16.wav')
    audio_mix(tl, total, wav)
    mux(silent, wav, OUT)
    os.remove(wav)


if __name__ == '__main__':
    main()
