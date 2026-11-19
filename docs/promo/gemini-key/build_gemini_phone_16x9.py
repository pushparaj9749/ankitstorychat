#!/usr/bin/env python3
"""Render: Kissa — "Gemini API key kaise setup karein" (1920x1080, 30 fps, 16:9).

Same format as the earlier Kissa setup tutorial: a real phone (bezel, side keys,
dynamic island) on the left showing the actual screen and the tap, and on the right
"KYA KARNA HAI" — three short instructions, the exact values, a 6-step marker and
subtitles that follow the voice-over.

    python3 build_gemini_phone_16x9.py                  # full MP4
    python3 build_gemini_phone_16x9.py --stills 6,46    # PNG stills
    python3 build_gemini_phone_16x9.py --preview        # contact sheet

Audio (voice-over + Kissa theme) is mixed by build_gemini_16x9.audio_mix, so both
16:9 cuts share one voice track and one music bed.
"""
import os
import sys

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_lib as L  # noqa: E402
from gen_lib import (DIM, FAINT, GOLD, ROSE, ROSE_L, SUCCESS, TEXT,  # noqa: E402
                     P4, P5, P6, P7, P8, appear, clamp, lerp, mock_google_home,
                     mock_google_keys, mock_kissa_ai_setup, mock_kissa_chat,
                     mock_kissa_editor, mock_kissa_you, rect, tw)
import build_gemini_16x9 as V  # noqa: E402  (background, timeline, audio)

FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1920, 1080, 30
OUT = os.path.join(HERE, 'kissa_gemini_api_key_16x9_phone.mp4')

BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
MODEL = 'gemini-3.8-flash'

# ------------------------------------------------------------------ layout ---
SW, SH = 432, 936            # screen
BEZ = 14                     # bezel
BW, BH = SW + 2 * BEZ, SH + 2 * BEZ
PX0, PY0 = 92, 62            # phone body
SCX = PX0 + BEZ              # screen origin
SCY = PY0 + BEZ

RX0, RX1 = 636, 1858         # right column
SUB_Y = 892                  # subtitles (right column only)
PROG_Y = 1052

MOCK_W, MOCK_H = 1080, 2340


# --------------------------------------------------------------- background --
def background():
    return V.background()


# ------------------------------------------------------------------- phone ---
def crop_phone(cy=1170.0, zoom=1.0):
    """Portrait crop of a 1080x2340 mock that fits the phone screen exactly."""
    ch = MOCK_H * 1.0
    cw = ch * SW / SH
    if zoom > 1.0:
        cw = MOCK_W / zoom
        ch = cw * SH / SW
    x = (MOCK_W - cw) / 2
    y = clamp(cy - ch / 2, 0, MOCK_H - ch)
    return (x, y, x + cw, y + ch)


def screen_bitmap(mock, box):
    crop = mock.crop(tuple(int(round(v)) for v in box)).convert('RGB')
    crop = crop.resize((SW, SH), Image.LANCZOS)
    m = Image.new('L', (SW, SH), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, SW - 1, SH - 1], radius=46, fill=255)
    out = Image.new('RGBA', (SW, SH), (0, 0, 0, 0))
    out.paste(crop, (0, 0))
    out.putalpha(m)
    return out


def phone(img, mock, box, glow=0.35):
    """Shadow, rose glow, body, buttons, screen, dynamic island."""
    sh = Image.new('RGBA', (BW + 220, BH + 220), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([110, 126, 110 + BW, 126 + BH], radius=64,
                                         fill=(0, 0, 0, 215))
    sh = sh.filter(ImageFilter.GaussianBlur(30))
    img.paste(sh, (PX0 - 110, PY0 - 110), sh)

    if glow:
        gl = Image.new('RGBA', (BW + 200, BH + 200), (0, 0, 0, 0))
        ImageDraw.Draw(gl).rounded_rectangle([100, 100, 100 + BW, 100 + BH], radius=70,
                                             outline=ROSE + (int(120 * glow),), width=16)
        gl = gl.filter(ImageFilter.GaussianBlur(42))
        img.paste(gl, (PX0 - 100, PY0 - 100), gl)

    d = ImageDraw.Draw(img)
    d.rounded_rectangle([PX0, PY0, PX0 + BW, PY0 + BH], radius=58, fill=(17, 18, 24),
                        outline=(84, 86, 102), width=2)
    d.rounded_rectangle([PX0 + 4, PY0 + 4, PX0 + BW - 4, PY0 + BH - 4], radius=54,
                        outline=(33, 34, 43), width=2)
    # side keys
    d.rounded_rectangle([PX0 - 5, PY0 + 176, PX0 - 1, PY0 + 258], 3, fill=(56, 58, 72))
    d.rounded_rectangle([PX0 + BW + 1, PY0 + 150, PX0 + BW + 5, PY0 + 216], 3, fill=(56, 58, 72))
    d.rounded_rectangle([PX0 + BW + 1, PY0 + 238, PX0 + BW + 5, PY0 + 312], 3, fill=(56, 58, 72))

    img.paste(screen_bitmap(mock, box), (SCX, SCY), screen_bitmap(mock, box))
    # dynamic island
    d.rounded_rectangle([SCX + SW // 2 - 48, SCY + 12, SCX + SW // 2 + 48, SCY + 36],
                        radius=12, fill=(6, 6, 9))
    d.ellipse([SCX + SW // 2 + 26, SCY + 19, SCX + SW // 2 + 32, SCY + 25], fill=(22, 26, 36))
    return img


def map_pt(box, pt):
    return (SCX + (pt[0] - box[0]) * SW / (box[2] - box[0]),
            SCY + (pt[1] - box[1]) * SH / (box[3] - box[1]))


def ring(img, xy, t, rx=90, ry=26, color=ROSE, speed=4.2):
    pulse = 0.5 + 0.5 * np.sin(t * speed)
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        [xy[0] - rx, xy[1] - ry, xy[0] + rx, xy[1] + ry], radius=18,
        outline=color + (int(110 + 90 * pulse),), width=3)
    img.paste(layer, (0, 0), layer)


def tap_at(img, cx, cy, t, start, dur=0.6, color=(255, 255, 255)):
    for offset, alpha in ((0.0, 210), (0.12, 130)):
        k = (t - start - offset) / dur
        if 0 <= k <= 1:
            r = lerp(9, 54, L.ease_out(k))
            layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r],
                                          outline=color + (int(alpha * (1 - k)),), width=4)
            img.paste(layer, (0, 0), layer)
    k = (t - start) / 0.22
    if 0 <= k <= 1:
        layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([cx - 8, cy - 8, cx + 8, cy + 8],
                                      fill=color + (int(190 * (1 - k)),))
        img.paste(layer, (0, 0), layer)


# ---------------------------------------------------------- right column -----
def kicker(img, text, y=104, color=ROSE_L):
    ImageDraw.Draw(img).text((RX0, y), text, font=P6(17), fill=color)


def title(img, lines, y=136, size=58, accent=None, accent_color=ROSE_L):
    d = ImageDraw.Draw(img)
    f = P8(size)
    longest = max(lines, key=lambda s: d.textlength(s, font=f))
    while size > 34 and d.textlength(longest, font=f) > (RX1 - RX0):
        size -= 2
        f = P8(size)
    for i, line in enumerate(lines):
        yy = y + i * int(size * 1.16)
        if accent and accent in line:
            pre, _, post = line.partition(accent)
            x = RX0
            d.text((x, yy), pre, font=f, fill=TEXT)
            x += d.textlength(pre, font=f)
            d.text((x, yy), accent, font=f, fill=accent_color)
            x += d.textlength(accent, font=f)
            d.text((x, yy), post, font=f, fill=TEXT)
        else:
            d.text((RX0, yy), line, font=f, fill=TEXT)


def bullets(img, items, lt, y=300, pitch=78, start=0.35):
    d = ImageDraw.Draw(img)
    d.text((RX0, y - 40), 'KYA KARNA HAI', font=P6(15), fill=FAINT)
    for i, item in enumerate(items):
        a = appear(lt, start + i * 0.22, 0.4)
        yy = y + i * pitch + int((1 - a) * 10)
        # numbered coin, so the list reads as a sequence
        cxx, cyy = RX0 + 17, yy + 17
        d.ellipse([cxx - 17, cyy - 17, cxx + 17, cyy + 17], fill=(38, 22, 30),
                  outline=(96, 48, 60), width=1)
        num = str(i + 1)
        d.text((cxx - d.textlength(num, font=P7(18)) / 2, cyy - 12), num, font=P7(18),
               fill=ROSE_L)
        runs = [(item, TEXT)] if isinstance(item, str) else item
        x = RX0 + 50
        f = P5(28)
        for txt, col in runs:
            d.text((x + int((1 - a) * 8), yy), txt, font=f, fill=col)
            x += d.textlength(txt, font=f)


def panel_box(img, y0, y1, fill=(19, 20, 28), border=(46, 48, 60)):
    rect(ImageDraw.Draw(img), [RX0, y0, RX1, y1], 18, fill, border, 1)


def detail_values(img, y0, y1, rows, lt=0.0):
    d = ImageDraw.Draw(img)
    panel_box(img, y0, y1)
    d.text((RX0 + 26, y0 + 18), 'EXACT VALUES', font=P6(13), fill=GOLD)
    yy = y0 + 46
    for label, value, col in rows:
        d.text((RX0 + 26, yy), label, font=P4(17), fill=FAINT)
        d.text((RX0 + 26, yy + 22), value, font=P5(23), fill=col)
        yy += 66


def detail_flow(img, y0, y1, lt):
    d = ImageDraw.Draw(img)
    panel_box(img, y0, y1)
    boxes = [('KISSA', 'app + kahani', ROSE), ('GEMINI', 'Google ka AI', (140, 170, 230)),
             ('JAWAB', 'story mein', SUCCESS)]
    bw = 300
    gap = (RX1 - RX0 - 52 - bw * 3) / 2
    top = y0 + 74
    for i, (t1, t2, col) in enumerate(boxes):
        a = appear(lt, 0.5 + i * 0.2, 0.4)
        bx = RX0 + 26 + i * (bw + gap)
        yy = top + int((1 - a) * 12)
        rect(d, [bx, yy, bx + bw, yy + 96], 16, (24, 25, 34), (54, 56, 70), 1)
        d.text((bx + (bw - d.textlength(t1, font=P7(21))) / 2, yy + 16), t1, font=P7(21), fill=col)
        d.text((bx + (bw - d.textlength(t2, font=P4(14))) / 2, yy + 50), t2, font=P4(14), fill=FAINT)
        if i < 2:
            ax = bx + bw + 8
            d.line([(ax, yy + 48), (ax + gap - 18, yy + 48)], fill=(92, 96, 112), width=2)
            d.polygon([(ax + gap - 18, yy + 42), (ax + gap - 8, yy + 48),
                       (ax + gap - 18, yy + 54)], fill=(92, 96, 112))
    d.text((RX0 + 26, y0 + 26), 'REPLY KA RASTA', font=P6(13), fill=GOLD)


def detail_errors(img, rows, y0, y1, lt):
    d = ImageDraw.Draw(img)
    panel_box(img, y0, y1)
    d.text((RX0 + 26, y0 + 16), 'ERROR MATLB', font=P6(13), fill=GOLD)
    yy = y0 + 44
    for i, (code, head, fix, col) in enumerate(rows):
        a = appear(lt, 0.3 + i * 0.14, 0.4)
        rowh = 100
        rect(d, [RX0 + 20, yy, RX1 - 20, yy + rowh - 8], 12, (23, 24, 32), (46, 48, 60), 1)
        d.rectangle([RX0 + 20, yy + 10, RX0 + 24, yy + rowh - 18], fill=col)
        d.text((RX0 + 38, yy + 12), code, font=P7(24), fill=col)
        d.text((RX0 + 106, yy + 14), head, font=P6(20), fill=TEXT)
        d.text((RX0 + 106, yy + 46), fix, font=P4(17), fill=DIM)
        yy += rowh + int((1 - a) * 4)


def detail_ok(img, y0, y1, lt):
    """Connected ke baad kya hua — repeat na karo, aage ka matlab batao."""
    d = ImageDraw.Draw(img)
    rect(d, [RX0, y0, RX1, y1], 18, (17, 28, 24), (52, 96, 80), 1)
    d.text((RX0 + 26, y0 + 18), 'GREEN "CONNECTED" KA MATLAB', font=P6(13), fill=SUCCESS)
    d.ellipse([RX0 + 28, y0 + 50, RX0 + 56, y0 + 78], outline=SUCCESS, width=2)
    d.line([(RX0 + 36, y0 + 64), (RX0 + 42, y0 + 71)], fill=SUCCESS, width=3)
    d.line([(RX0 + 42, y0 + 71), (RX0 + 51, y0 + 58)], fill=SUCCESS, width=3)
    d.text((RX0 + 70, y0 + 50), 'Key valid hai — Google se reply aaya.', font=P5(21), fill=SUCCESS)
    d.text((RX0 + 28, y0 + 92), 'Save karte hi key phone ke secure keystore mein chali jaati hai.',
           font=P4(17), fill=DIM)
    d.text((RX0 + 28, y0 + 118), 'Kissa ke server par key kabhi save nahi hoti.', font=P4(17), fill=DIM)


def detail_note(img, y0, y1, head, lines):
    d = ImageDraw.Draw(img)
    panel_box(img, y0, y1)
    rect(d, [RX0, y0 + 16, RX0 + 4, y1 - 16], 2, GOLD)
    d.text((RX0 + 30, y0 + 22), head, font=P6(14), fill=GOLD)
    for i, ln in enumerate(lines):
        d.text((RX0 + 30, y0 + 56 + i * 36), ln, font=P4(21), fill=DIM)


def detail_download(img, y0, y1, lt):
    d = ImageDraw.Draw(img)
    rect(d, [RX0, y0, RX1, y1], 18, (31, 19, 26), (108, 56, 70), 1)
    d.text((RX0 + 26, y0 + 20), 'KISSA DOWNLOAD KARO', font=P6(13), fill=ROSE_L)
    d.text((RX0 + 26, y0 + 44), 'beyondredeye.site', font=P7(38), fill=ROSE_L)
    d.text((RX0 + 26, y0 + 96), 'Android 8+ · free · no account · no coins',
           font=P4(17), fill=FAINT)


STEP_LABELS = ['AI Studio', 'Key banao', 'Kissa > You', 'Details', 'Test + Save', 'AI READY']


def stepper(img, active, y=826):
    d = ImageDraw.Draw(img)
    d.text((RX0, y - 26), 'STEPS', font=P6(13), fill=FAINT)
    x = RX0
    for i, label in enumerate(STEP_LABELS):
        done = i < active
        cur = i == active
        col = ROSE if cur else (SUCCESS if done else (78, 81, 94))
        w = d.textlength(label, font=P5(16)) + 30
        if cur:
            rect(d, [x, y, x + w, y + 32], 16, (34, 20, 27), (120, 56, 70), 1)
        d.ellipse([x + 10, y + 11, x + 20, y + 21], fill=col)
        d.text((x + 26, y + 6), label, font=P5(16) if cur else P4(16),
               fill=TEXT if cur else (SUCCESS if done else (108, 112, 124)))
        x += w + 6


def subtitles(img, lines, lt, vo):
    d = ImageDraw.Draw(img)
    band_w = RX1 - RX0
    band = Image.new('RGBA', (band_w, 84), (0, 0, 0, 0))
    ImageDraw.Draw(band).rounded_rectangle([0, 0, band_w - 1, 83], radius=15,
                                           fill=(10, 11, 16, 225))
    img.paste(band, (RX0 - 2, SUB_Y - 4), band)
    d.rectangle([RX0 - 2, SUB_Y + 4, RX0 + 4, SUB_Y + 74], fill=ROSE)
    f = P5(26)
    gap = max(1.2, (vo - 1.6) * 0.5)
    for i, runs in enumerate(lines):
        k = appear(lt, 0.02 + i * gap, 0.3)
        x = RX0 + 20
        yy = SUB_Y + (0 if len(lines) == 2 else 12) + i * 38
        for txt, col in runs:
            d.text((x, yy), txt, font=f, fill=col if k > 0.3 else (62, 64, 74))
            x += d.textlength(txt, font=f)


def progress(img, k):
    d = ImageDraw.Draw(img)
    d.rectangle([RX0, PROG_Y, RX1, PROG_Y + 3], fill=(30, 32, 40))
    d.rectangle([RX0, PROG_Y, RX0 + (RX1 - RX0) * clamp(k), PROG_Y + 3], fill=ROSE)


# ================================================================ scenes =====

def s_hook(img, lt, dur):
    kicker(img, 'KISSA · AI SETUP')
    title(img, ['Gemini API key,', '2 minute mein'], size=62, accent='2 minute')
    bullets(img, ['Free tier — koi card nahi', 'Key sirf tumhare phone pe',
                  'Koi login ya account nahi'], lt, y=316)
    chat, _ = mock_kissa_chat()
    box = crop_phone(1400)
    phone(img, chat, box)
    detail_note(img, 566, 766, 'YE VIDEO MEIN', ['Chrome + Kissa app chahiye.',
                                                 'Koi PC ki zarurat nahi.'])
    stepper(img, -1)
    subtitles(img, [
        [('Kissa mein AI characters chalane ke liye ', DIM), ('ek chhota setup', TEXT), (' chahiye:', DIM)],
        [('apni ', DIM), ('Gemini API key', ROSE_L), (' — do minute, free, sirf phone se.', DIM)],
    ], lt, dur)
    return img


def s_why(img, lt, dur):
    kicker(img, 'PEHLE YE SAMJHO')
    title(img, ['Key kya karti hai'], size=62, accent='kya karti')
    bullets(img, ['Kissa khud kahani nahi likhta', 'har reply AI provider se aati hai',
                  'Key tumhari — control bhi tumhara'], lt, y=302)
    you, _ = mock_kissa_you('needed')
    box = crop_phone(1120)
    phone(img, you, box)
    detail_flow(img, 556, 772, lt)
    stepper(img, -1)
    subtitles(img, [
        [('Har reply tumhare ', DIM), ('AI provider', TEXT), (' se aati hai —', DIM)],
        [('key tumhari, control bhi tumhara, koi server beech mein nahi.', DIM)],
    ], lt, dur)
    return img


def s_step1(img, lt, dur):
    kicker(img, 'STEP 1 / 6 · BROWSER')
    title(img, ['aistudio.google.com', 'kholo'], size=56, accent='aistudio')
    bullets(img, ['Phone ke Chrome mein site kholo', 'Google account se sign in karo',
                  '"Get API key" par tap karo'], lt, y=316)
    mock, a = mock_google_home(url_typed='ais' if lt < 0.7 else 'aistudio.google.com')
    gk = a['getkey']
    box = crop_phone(lerp(760, 1180, L.ease_io(clamp(lt / max(dur * 0.6, 0.1)))), zoom=1.0)
    phone(img, mock, box)
    sx, sy = map_pt(box, gk)
    if lt > dur * 0.55:
        ring(img, (sx, sy), lt, rx=104, ry=26)
        tap_at(img, sx, sy, lt, dur * 0.66, color=ROSE)
    detail_note(img, 566, 766, 'IS PAGE PAR', ['AI Studio free hai — card nahi lagta.',
                                                'Bina sign in key nahi milegi.'])
    stepper(img, 0)
    subtitles(img, [
        [('Phone ke browser mein ', DIM), ('aistudio.google.com', TEXT), (' kholo,', DIM)],
        [('Google account se ', DIM), ('sign in', TEXT), (' karke "Get API key" dabao.', DIM)],
    ], lt, dur)
    return img


def s_step2(img, lt, dur):
    kicker(img, 'STEP 2 / 6 · API KEY')
    title(img, ['Create API key,', 'phir copy'], size=58, accent='copy')
    bullets(img, ['"Create API key" dabao', 'Project chuno (default chalega)',
                  'Key turant copy — dobara nahi dikhegi'], lt, y=316)
    plain, a1 = mock_google_keys()
    dialog, a2 = mock_google_keys(key_revealed=True, dialog=True)
    create = a1['create']
    t_dialog = dur * 0.55
    cy = lerp(820, create[1] + 120, L.ease_io(clamp(lt / max(dur * 0.25, 0.1))))
    if lt > t_dialog - 0.4:
        cy = lerp(cy, a2['dialog'][1] + 60, L.ease_io(clamp((lt - (t_dialog - 0.4)) / 0.5)))
    box = crop_phone(cy)
    mock = plain
    if lt > t_dialog - 0.4:
        mock = Image.blend(plain, dialog, L.ease_out((lt - (t_dialog - 0.4)) / 0.4))
    phone(img, mock, box)
    if lt < t_dialog - 0.3:
        sx, sy = map_pt(box, create)
        ring(img, (sx, sy), lt, rx=112, ry=26)
        tap_at(img, sx, sy, lt, dur * 0.34, color=ROSE)
    elif lt > t_dialog + 1.2:
        cx, cyy = map_pt(box, a2['dialog_copy'])
        tap_at(img, cx, cyy, lt, t_dialog + 1.8, color=ROSE)
    detail_note(img, 566, 766, 'KEY KAHAN HAI', ['Banti hi clipboard mein copy karo.',
                                                 'Poori key sirf ek baar dikhti hai.'])
    stepper(img, 1)
    subtitles(img, [
        [('"Get API key" ke baad ', DIM), ('Create API key', TEXT), (' dabao,', DIM)],
        [('aur jo key banegi use ', DIM), ('turant copy', TEXT), (' kar lo.', DIM)],
    ], lt, dur)
    return img


def s_step3(img, lt, dur):
    kicker(img, 'STEP 3 / 6 · KISSA')
    title(img, ['Kissa > You tab'], size=62, accent='You tab')
    bullets(img, ['Kissa kholo, neeche You tab', '"AI SETUP NEEDED" card par tap',
                  '+ Add AI Provider dabao'], lt, y=302)
    you, ay = mock_kissa_you('needed')
    setup, asu = mock_kissa_ai_setup()
    card = ay['ai_card']
    t_sw = dur * 0.56
    cy = lerp(920, card[1] + 40, L.ease_io(clamp(lt / max(dur * 0.2, 0.1))))
    if lt > t_sw - 0.4:
        cy = lerp(cy, asu['add'][1] - 260, L.ease_io(clamp((lt - (t_sw - 0.4)) / 0.6)))
    box = crop_phone(cy)
    mock = you
    if lt > t_sw - 0.4:
        mock = Image.blend(you, setup, L.ease_out((lt - (t_sw - 0.4)) / 0.4))
    phone(img, mock, box)
    if lt < t_sw - 0.3:
        sx, sy = map_pt(box, card)
        ring(img, (sx, sy), lt, rx=150, ry=40)
        tap_at(img, sx, sy, lt, dur * 0.36)
    else:
        ax, ayy = map_pt(box, asu['add'])
        ring(img, (ax, ayy), lt, rx=126, ry=28)
        tap_at(img, ax, ayy, lt, t_sw + 1.3)
    detail_note(img, 566, 766, 'KAHAN MILEGA', ['You tab > AI Setup > Add AI Provider.',
                                                 'Yahin sara AI setup rehta hai.'])
    stepper(img, 2)
    subtitles(img, [
        [('Ab ', DIM), ('Kissa', TEXT), (' kholo > neeche ', DIM), ('You', TEXT), (' tab >', DIM)],
        [('AI Setup mein ', DIM), ('+ Add AI Provider', TEXT), (' dabao.', DIM)],
    ], lt, dur)
    return img


def typed(full, lt, start, speed=22):
    if lt <= start:
        return ''
    return full[:max(0, min(len(full), int((lt - start) * speed)))]


def s_step4(img, lt, dur):
    kicker(img, 'STEP 4 / 6 · FIELDS')
    title(img, ['Base URL + model'], size=62, accent='model')
    bullets(img, ['Preset: Custom (OpenAI-compatible)', 'Base URL: /v1beta/openai tak',
                  'Model: gemini-3.8-flash'], lt, y=302)
    name = typed('Gemini', lt, 0.8, 12)
    url = typed(BASE_URL, lt, dur * 0.22, 34)
    model = typed(MODEL, lt, dur * 0.52, 14)
    hot = 'Custom (OpenAI-compatible)' if lt > 0.35 else None
    mock, a = mock_kissa_editor(name=name, url=url, model=model, preset_hot=hot)
    # stay at zoom 1 so the long base-URL field is never clipped
    if lt < dur * 0.20:
        cy = 720
    elif lt < dur * 0.30:
        cy = a['name'][1]
    elif lt < dur * 0.55:
        cy = a['url'][1] + 20
    else:
        cy = a['model'][1] + 60
    box = crop_phone(cy)
    phone(img, mock, box)
    detail_values(img, 556, 786, [
        ('BASE URL', BASE_URL, GOLD),
        ('MODEL', MODEL, TEXT),
    ])
    stepper(img, 3)
    subtitles(img, [
        [('Preset ', DIM), ('Custom (OpenAI-compatible)', TEXT), (' · Model ', DIM), ('gemini-3.8-flash', TEXT)],
        [('Base URL: …googleapis.com', DIM), ('/v1beta/openai', GOLD), (' — /v1 nahi.', DIM)],
    ], lt, dur)
    return img


def s_step5(img, lt, dur):
    kicker(img, 'STEP 5 / 6 · TEST')
    title(img, ['Test karo, phir save'], size=60, accent='Test')
    bullets(img, ['API key paste karo (dots dikhenge)', 'Test Connection dabao',
                  'Connected? Save Provider dabao'], lt, y=302)
    dots = int(clamp((lt - 0.4) / 0.9) * 26) if lt > 0.4 else 0
    ok = 'ok' if lt > dur * 0.42 else None
    mock, a = mock_kissa_editor(name='Gemini', url=BASE_URL, model=MODEL, dots=dots,
                                preset_hot='Custom (OpenAI-compatible)', test=ok)
    btn_y = a['test'][1] - 150
    cy = a['key'][1] + 60 if lt < dur * 0.22 else btn_y + 30
    box = crop_phone(cy)
    phone(img, mock, box)
    tx, ty = map_pt(box, a['test'])
    gx, gy = map_pt(box, a['save'])
    if lt > dur * 0.26:
        ring(img, (tx, ty), lt, rx=110, ry=26)
        tap_at(img, tx, ty, lt, dur * 0.38)
    if lt > dur * 0.62:
        tap_at(img, gx, gy, lt, dur * 0.74)
    detail_ok(img, 556, 776, lt)
    stepper(img, 4)
    subtitles(img, [
        [('Key paste karo > ', DIM), ('Test Connection', TEXT), (' dabao >', DIM)],
        [('green ', DIM), ('Connected', SUCCESS), (' aaya? Ab ', DIM), ('Save Provider', TEXT), ('.', DIM)],
    ], lt, dur)
    return img


def s_step6(img, lt, dur):
    kicker(img, 'STEP 6 / 6 · VERIFY')
    title(img, ['AI READY check'], size=62, accent='READY')
    bullets(img, ['Providers mein Gemini · ACTIVE', 'You tab par green AI READY',
                  'Ab koi bhi kahani chalao'], lt, y=302)
    setup, asu = mock_kissa_ai_setup(provider='gemini', saved=True)
    you, ay = mock_kissa_you('ready')
    chat, _ = mock_kissa_chat()
    if lt < dur * 0.30:
        mock, cy = setup, asu['provider'][1] + 60
    elif lt < dur * 0.58:
        mock, cy = you, ay['ai_card'][1] + 40
    else:
        mock, cy = chat, 900
    box = crop_phone(cy)
    phone(img, mock, box)
    detail_note(img, 566, 766, 'FINAL CONFIRMATION', [
        'Providers: Gemini · ACTIVE',
        'You tab: green AI READY',
        'Iske baad story chat chalega.'])
    stepper(img, 5)
    subtitles(img, [
        [('Provider list mein ', DIM), ('Gemini · ACTIVE', TEXT), (', You tab par ', DIM), ('AI READY', SUCCESS)],
        [('Ab kahani kholo — characters Gemini se jawab denge.', DIM)],
    ], lt, dur)
    return img


def s_errors(img, lt, dur):
    kicker(img, 'TROUBLESHOOTING')
    title(img, ['Error aaye? Ye dekho'], size=52, accent='Ye dekho')
    mock, a = mock_kissa_editor(name='Gemini', url=BASE_URL, model=MODEL, dots=26,
                                preset_hot='Custom (OpenAI-compatible)', test='bad')
    box = crop_phone(a['test'][1] - 170)
    phone(img, mock, box)
    rows = [('401', 'Invalid API key', 'Key dobara copy karo', (236, 110, 120)),
            ('403', 'Key blocked / region', 'Naya project ya doosra account', (236, 160, 110)),
            ('404', 'Base URL galat', '/v1beta/openai par khatam hona chahiye', GOLD),
            ('429', 'Free limit khatam', '1 min ruko ya lighter model', SUCCESS)]
    detail_errors(img, rows, 250, 790, lt)
    stepper(img, 4)
    subtitles(img, [
        [('Sabse common galti: ', DIM), ('base URL', TEXT), (' mein /v1 lagana —', DIM)],
        [('sahi hai ', DIM), ('…/v1beta/openai', GOLD), ('. 429 par 1 min ruko.', DIM)],
    ], lt, dur)
    return img


def s_outro(img, lt, dur):
    kicker(img, 'AB TUMHARI BAARI')
    title(img, ['Key lag gayi.', 'Ab kahani shuru.'], size=64, accent='kahani')
    bullets(img, ['Key kisi ko mat bhejo', 'Phone pe encrypted rehti hai',
                  'Model: Settings > AI Setup > Edit'], lt, y=302)
    you, ay = mock_kissa_you('ready')
    box = crop_phone(ay['ai_card'][1] + 40)
    phone(img, you, box)
    detail_download(img, 560, 720, lt)
    stepper(img, 5)
    subtitles(img, [
        [('Bas itna hi — key kabhi ', DIM), ('share mat karo', ROSE_L), (', phone pe encrypted.', DIM)],
        [('Download: ', DIM), ('beyondredeye.site', GOLD), (' · apni kahani shuru karo.', DIM)],
    ], lt, dur)
    return img


SCENE_FNS = [s_hook, s_why, s_step1, s_step2, s_step3, s_step4, s_step5, s_step6,
             s_errors, s_outro]


# ================================================================ render =====

def frame_at(t, tl):
    img = background()
    acc = 0.0
    for i, (key, dur, _vo) in enumerate(tl):
        if t < acc + dur or i == len(tl) - 1:
            lt = max(0.0, t - acc)
            img = SCENE_FNS[i](img, lt, dur)
            d = ImageDraw.Draw(img)
            d.text((W - 96 - 74, 40), 'KISSA', font=P7(19), fill=(150, 152, 162))
            d.polygon([(W - 96 - 58, 50), (W - 96 - 50, 58), (W - 96 - 58, 66),
                       (W - 96 - 66, 58)], fill=ROSE)
            progress(img, t / sum(x[1] for x in tl))
            return img
        acc += dur
    return img


def render(tl):
    total = sum(d for _, d, _ in tl)
    n = int(total * FPS)
    silent = os.path.join(HERE, '_silent_phone.mp4')
    cmd = [FF, '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
           '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent]
    import subprocess
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL)
    for i in range(n):
        p.stdin.write(frame_at(i / FPS, tl).tobytes())
        if i % 120 == 0:
            print(f'  frame {i}/{n} ({100 * i / n:.1f}%)', flush=True)
    p.stdin.close()
    p.wait()
    print('  video done', silent, flush=True)
    return silent, total


def main():
    args = sys.argv[1:]
    tl = V.timeline()
    total = sum(d for _, d, _ in tl)
    for k, d, v in tl:
        print(f'  {k:12s} scene {d:5.1f}s  vo {v:5.1f}s')
    print(f'  total {total:.2f}s')

    if '--stills' in args:
        i = args.index('--stills')
        os.makedirs('/tmp/phone', exist_ok=True)
        for s in [float(x) for x in args[i + 1].split(',')]:
            p = f'/tmp/phone/t{s:06.2f}.png'
            frame_at(s, tl).save(p)
            print(p)
        return
    if '--preview' in args:
        from PIL import Image as I
        thumbs = [(s, frame_at(s, tl).resize((480, 270), I.LANCZOS))
                  for s in [total * k / 8 for k in range(8)]]
        sh = I.new('RGB', (2 * 490 + 8, 4 * 292 + 8), (8, 8, 12))
        d = ImageDraw.Draw(sh)
        for i, (s, im) in enumerate(thumbs):
            x, y = 8 + (i % 2) * 490, 8 + (i // 2) * 292
            d.text((x, y), f'{s:.1f}s', font=P6(16), fill=(200, 202, 212))
            sh.paste(im, (x, y + 22))
        sh.save(os.path.join(HERE, 'preview_16x9_phone.jpg'), quality=90)
        print('preview_16x9_phone.jpg')
        return

    import subprocess
    silent, total = render(tl)
    wav = os.path.join(HERE, '_mix_phone.wav')
    V.audio_mix(tl, total, wav)
    subprocess.run([FF, '-y', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac',
                    '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart',
                    OUT], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(silent)
    os.remove(wav)
    print('  done', OUT, flush=True)


if __name__ == '__main__':
    main()
