"""Render: Kissa — "Gemini API key kaise setup karein" (1080x1920, 30 fps, 1:48).

    python3 build_gemini_tutorial.py                 # full MP4
    python3 build_gemini_tutorial.py --stills 3,18.5  # stills at those seconds
    python3 build_gemini_tutorial.py --preview        # contact sheet

Everything is generated: no screen recording, no stock footage, no sampled music.
Kissa screens are drawn in the app's own layout; the Google pages are stylised
illustrations of the public pages and say so on screen.
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audio  # noqa: E402
import gen_lib as L  # noqa: E402
from gen_lib import (BG, DIM, FAINT, FPS, GOLD, H, ROSE, ROSE_L, SUCCESS, TEXT, W,  # noqa: E402
                     F, P4, P5, P6, P7, P8, appear, background, caption, camera, chrome,
                     clamp, draw_runs, ease_io, ease_out, FONTS, ghost_button, headline,
                     lerp, mock_google_home, mock_google_keys, mock_kissa_ai_setup,
                     mock_kissa_chat, mock_kissa_editor, mock_kissa_you, pill, primary_button,
                     rect, tap, tw)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(OUT_DIR, 'kissa_gemini_api_key_9x16.mp4')

# card geometry (the "screen" window on the canvas)
CX, CY, CW, CH = 64, 204, 952, 1150
CARD_AR = CW / CH
CAP_Y = 1480


def focus(cx, cy, cw, pad_top=0):
    """Crop rectangle centred on (cx, cy) with width cw, clamped to the mock."""
    cw = min(max(cw, 240), 1080)
    ch = cw / CARD_AR
    x = L.clamp(cx - cw / 2, 0, 1080 - cw)
    y = L.clamp(cy - ch / 2, 0, 2340 - ch)
    return (x, y, x + cw, y + ch)


def wide(cx, cy, ch=2340):
    return focus(cx, cy, 1080, 0)


CROPS_FULL = (0, 0, 1080, 2340)


def paste_card(img, mock, box, label=None, badge=None, note=None):
    """Draw a screen card: hairline frame, soft shadow, optional label chip."""
    card = camera(mock, box, (CW, CH), radius=26)
    # shadow
    sh = Image.new('RGBA', (CW + 80, CH + 80), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([40, 46, 40 + CW, 46 + CH], radius=26, fill=(0, 0, 0, 170))
    sh = sh.filter(L.ImageFilter.GaussianBlur(18))
    img.paste(sh, (CX - 40, CY - 34), sh)
    img.paste(card, (CX, CY), card)

    d = ImageDraw.Draw(img)
    # Chips sit BELOW the card so they never cover the screen being explained.
    y = CY + CH + 14
    if label:
        f = P5(15)
        d.ellipse([CX, y + 7, CX + 9, y + 16], fill=ROSE)
        d.text((CX + 18, y), label, font=f, fill=(150, 154, 166))
    if badge:
        f = P6(13)
        w = tw(d, badge, f) + 24
        rect(d, [CX + CW - w, y - 3, CX + CW, y + 27], 15, (34, 20, 27), ROSE, 1)
        d.text((CX + CW - w + 12, y + 4), badge, font=f, fill=ROSE_L)
    if note:
        d.text((CX, y + 30), note, font=P4(13), fill=(96, 100, 112))
    return img


def blend(a, b, k):
    return Image.blend(a, b, clamp(k)) if k < 1 else b


def wordmark(img, y, size=34):
    d = ImageDraw.Draw(img)
    d.text((64, y), 'KISSA', font=P7(size), fill=(238, 238, 244))
    dx = 64 + tw(d, 'KISSA', P7(size)) + 16
    dy = y + size * 0.42
    r = size * 0.13
    d.polygon([(dx, dy - r), (dx + r, dy), (dx, dy + r), (dx - r, dy)], fill=ROSE)


# =============================================================== scenes =====

def s_hook(img, lt, t):
    d = ImageDraw.Draw(img)
    k = appear(lt, 0.15, 0.5)
    f = P6(16)
    d.text((64, 400 + (1 - k) * 20), 'KISSA · AI SETUP TUTORIAL', font=f, fill=ROSE_L)

    a = appear(lt, 0.35, 0.55)
    headline(img, 460 + int((1 - a) * 26), ['Gemini API key', 'kaise lagayein?'], size=76,
             accent='Gemini', accent_color=ROSE_L)

    b = appear(lt, 0.9, 0.5)
    d.text((64, 712 + (1 - b) * 18), '2 minute · free · sirf phone se',
           font=P5(32), fill=DIM)

    # three facts
    facts = [('Free tier', 'card nahi lagta'), ('Key encrypted', 'sirf tumhare phone pe'),
             ('Koi login nahi', 'Kissa account nahi maangta')]
    y = 800
    for i, (t1, t2) in enumerate(facts):
        kk = appear(lt, 1.25 + i * 0.16, 0.45)
        yy = y + i * 96 + int((1 - kk) * 24)
        rect(d, [64, yy, W - 64, yy + 78], 18, (20, 21, 29), (44, 46, 58), 1)
        d.ellipse([88, yy + 28, 112, yy + 52], fill=ROSE)
        d.text((130, yy + 20), t1, font=P6(25), fill=TEXT)
        d.text((130, yy + 46), t2, font=P4(21), fill=DIM)

    # key card illustration
    ky = 1080
    kk = appear(lt, 2.1, 0.6)
    if kk > 0:
        rect(d, [64, ky, W - 64, ky + 150], 22, (26, 22, 30), (70, 50, 60), 1)
        d.ellipse([96, ky + 44, 156, ky + 104], outline=ROSE, width=7)
        d.line([(150, ky + 74), (232, ky + 74)], fill=ROSE, width=7)
        d.line([(206, ky + 74), (206, ky + 98)], fill=ROSE, width=7)
        d.text((262, ky + 44), 'AIzaSyD…•3Qk', font=P5(28), fill=TEXT)
        d.text((262, ky + 84), 'key sirf ek baar dikhti hai', font=P4(20), fill=FAINT)

    caption(img, CAP_Y, [
        [('Gemini ki key 5 minute mein ', DIM), ('set up', TEXT)],
        [('karo — bilkul ', DIM), ('free', GOLD), (', bina card.', DIM)],
    ], size=34, kicker_text='SHURU KARNE SE PEHLE', kicker_color=ROSE_L)
    return img


def s_why(img, lt, t):
    d = ImageDraw.Draw(img)
    d.text((64, 250), 'PEHLE YE SAMJHO', font=P6(16), fill=ROSE_L)
    headline(img, 300, ['API key =', 'tumhare AI ka paas'], size=64,
             accent='paas', accent_color=GOLD)

    k = appear(lt, 0.55, 0.5)
    body = [
        [('Kissa khud kahani nahi likhta. Har reply tumhare ', DIM), ('API provider', TEXT), (' se aati hai.', DIM)],
        [('Key tumhari — isliye control bhi tumhara. Koi server beech mein nahi.', DIM)],
    ]
    for i, runs in enumerate(body):
        a = appear(lt, 0.55 + i * 0.18, 0.5)
        draw_runs(d, (64, 520 + i * 62 + int((1 - a) * 16)), [runs], P5(28), 62)

    # flow diagram: Kissa -> Gemini -> jawab
    fy = 700
    aa = appear(lt, 1.1, 0.5)
    if aa > 0:
        cy = fy + int((1 - aa) * 24)
        boxes = [('KISSA', 'app', ROSE), ('GEMINI', 'Google ka AI', (140, 170, 230)), ('JAWAB', 'story mein', SUCCESS)]
        bw, bh, gap = 250, 96, 74
        x0 = (W - (bw * 3 + gap * 2)) / 2
        for i, (t1, t2, col) in enumerate(boxes):
            bx = x0 + i * (bw + gap)
            rect(d, [bx, cy, bx + bw, cy + bh], 20, (22, 23, 31), (52, 55, 68), 1)
            d.text((bx + (bw - tw(d, t1, P7(22))) / 2, cy + 22), t1, font=P7(22), fill=col)
            d.text((bx + (bw - tw(d, t2, P4(16))) / 2, cy + 56), t2, font=P4(16), fill=FAINT)
            if i < 2:
                ax = bx + bw + 14
                d.line([(ax, cy + bh / 2), (ax + gap - 28, cy + bh / 2)], fill=(90, 94, 110), width=3)
                d.polygon([(ax + gap - 28, cy + bh / 2 - 7), (ax + gap - 16, cy + bh / 2),
                           (ax + gap - 28, cy + bh / 2 + 7)], fill=(90, 94, 110))

    # three notes
    notes = [('Tumhari key', 'kisi server pe save nahi hoti'),
             ('Free tier', 'roz thoda free quota milta hai'),
             ('Kabhi bhi badlo', 'model ya provider, ek tap mein')]
    for i, (t1, t2) in enumerate(notes):
        a = appear(lt, 1.8 + i * 0.2, 0.5)
        y = 900 + i * 108 + int((1 - a) * 26)
        rect(d, [64, y, W - 64, y + 88], 18, (19, 20, 27), (42, 44, 56), 1)
        d.text((96, y + 18), t1, font=P6(24), fill=TEXT)
        d.text((96, y + 50), t2, font=P4(20), fill=DIM)
        d.line([(W - 118, y + 44), (W - 92, y + 44)], fill=ROSE_L, width=2)
        d.polygon([(W - 92, y + 44), (W - 102, y + 38), (W - 102, y + 50)], fill=ROSE_L)

    caption(img, CAP_Y, [
        [('Ye key ', DIM), ('tumhare phone se Google', TEXT), (' jaati hai,', DIM)],
        [('Kissa ke server se nahi.', DIM)],
    ], size=34, kicker_text='KEY KYA KARTI HAI', kicker_color=ROSE_L)
    return img


def s_step1(img, lt, t):
    d = ImageDraw.Draw(img)
    d.text((64, 100), 'STEP 1 · BROWSER', font=P6(15), fill=ROSE_L)
    d.text((64, 130), 'aistudio.google.com kholo', font=P7(36), fill=TEXT)

    mock, anchors = mock_google_home(url_typed='ais' if lt < 0.8 else ('aistudio.google.com' if lt < 1.4 else 'aistudio.google.com'))
    gk = anchors['getkey']
    crops = [
        (0.0, focus(540, 617, 1080)),
        (2.6, wide(540, 760)),
        (5.2, focus(540, gk[1] + 120, 1080)),
    ]
    box = L.camera_anim(crops, lt)
    paste_card(img, mock, box, label='Chrome · aistudio.google.com', note='Illustration of the public page')

    # highlight ring around the button, then a tap
    if lt > 3.4:
        sx = CX + CW * (gk[0] - box[0]) / (box[2] - box[0])
        sy = CY + CH * (gk[1] - box[1]) / (box[3] - box[1])
        pulse = 0.5 + 0.5 * np.sin((lt - 3.4) * 4.2)
        ring = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(ring).rounded_rectangle(
            [sx - 150, sy - 46, sx + 150, sy + 46], radius=30,
            outline=(255, 255, 255, int(90 + 80 * pulse)), width=3)
        img.paste(ring, (0, 0), ring)
        tap(img, sx, sy, lt, 6.2)

    cap1 = [
        [('Phone ke Chrome mein ', DIM), ('aistudio.google.com', TEXT)],
        [('kholo, aur Google account se ', DIM), ('sign in', TEXT), (' karo.', DIM)],
    ]
    cap2 = [
        [('Top par ', DIM), ('"Get API key"', TEXT), (' dabao.', DIM)],
        [('Ye Google ka free key page hai.', DIM)],
    ]
    caption(img, CAP_Y, cap1 if lt < 5.4 else cap2, size=34,
            kicker_text='STEP 1 / 6 · AI STUDIO', kicker_color=ROSE_L)
    return img


def s_step2(img, lt, t):
    d = ImageDraw.Draw(img)
    d.text((64, 100), 'STEP 2 · KEY BANAO', font=P6(15), fill=ROSE_L)
    d.text((64, 130), 'Create API key, phir copy', font=P7(36), fill=TEXT)

    plain, a1 = mock_google_keys()
    dialog_img, a2 = mock_google_keys(key_revealed=True, dialog=True)
    create = a1['create']

    dialog_center = a2['dialog']
    crops = [
        (0.0, focus(540, 617, 1080)),
        (2.0, focus(540, create[1] + 60, 1080)),
        (4.3, focus(540, create[1] + 60, 1080)),
        (5.1, focus(540, dialog_center[1], 1080)),
    ]
    box = L.camera_anim(crops, lt)
    mock = blend(plain, dialog_img, ease_out((lt - 4.4) / 0.35)) if lt > 4.4 else plain
    paste_card(img, mock, box, label='Chrome · API keys', badge='free tier', note='Illustration of the public page')

    if lt < 4.4:
        sx = CX + CW * (create[0] - box[0]) / (box[2] - box[0])
        sy = CY + CH * (create[1] - box[1]) / (box[3] - box[1])
        pulse = 0.5 + 0.5 * np.sin(lt * 4.2)
        ring = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(ring).rounded_rectangle([sx - 170, sy - 42, sx + 170, sy + 42], radius=28,
                                               outline=(255, 255, 255, int(90 + 80 * pulse)), width=3)
        img.paste(ring, (0, 0), ring)
        tap(img, sx, sy, lt, 3.6)

    # after the dialog: point at Copy
    if lt > 6.4:
        dc = a2['dialog_copy']
        sx = CX + CW * (dc[0] - box[0]) / (box[2] - box[0])
        sy = CY + CH * (dc[1] - box[1]) / (box[3] - box[1])
        tap(img, sx, sy, lt, 7.0)

    cap1 = [
        [('"Get API key" ke baad ', DIM), ('Create API key', TEXT), (' dabao.', DIM)],
        [('Naya project chuno — 10 second ka kaam.', DIM)],
    ]
    cap2 = [
        [('Key ban gayi — ', DIM), ('turant Copy', TEXT), (' karo.', DIM)],
        [('Ye poora sirf ek baar dikhti hai. Kisi ko mat bhejo.', GOLD)],
    ]
    cap3 = [
        [('Copy ki hui key ', DIM), ('clipboard', TEXT), (' mein hai.', DIM)],
        [('Ab Kissa mein paste karenge.', DIM)],
    ]
    cap = cap1 if lt < 4.4 else (cap2 if lt < 8.0 else cap3)
    caption(img, CAP_Y, cap, size=34, kicker_text='STEP 2 / 6 · API KEY', kicker_color=ROSE_L)
    return img


def s_step3(img, lt, t):
    d = ImageDraw.Draw(img)
    d.text((64, 100), 'STEP 3 · KISSA', font=P6(15), fill=ROSE_L)
    d.text((64, 130), 'You > AI Setup', font=P7(36), fill=TEXT)

    you, ay = mock_kissa_you('needed')
    setup, asu = mock_kissa_ai_setup()
    card = ay['ai_card']

    crops = [
        (0.0, focus(540, 560, 1080)),
        (1.6, focus(540, card[1] + 24, 1080)),
        (5.4, focus(540, 700, 1080)),
        (7.2, focus(540, 980, 1080)),
    ]
    box = L.camera_anim(crops, lt)
    mock = blend(you, setup, ease_out((lt - 4.2) / 0.4)) if lt > 4.2 else you
    paste_card(img, mock, box, label='Kissa · You')

    # tap the AI card
    if lt < 4.2:
        sx = CX + CW * (card[0] - box[0]) / (box[2] - box[0])
        sy = CY + CH * (card[1] - box[1]) / (box[3] - box[1])
        pulse = 0.5 + 0.5 * np.sin(lt * 4.4)
        ring = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(ring).rounded_rectangle([CX + 20, sy - 120, CX + CW - 20, sy + 120], radius=26,
                                               outline=(255, 255, 255, int(70 + 70 * pulse)), width=3)
        img.paste(ring, (0, 0), ring)
        tap(img, sx, sy, lt, 3.0)
    else:
        add = asu['add']
        sx = CX + CW * (add[0] - box[0]) / (box[2] - box[0])
        sy = CY + CH * (add[1] - box[1]) / (box[3] - box[1])
        if lt > 6.0:
            tap(img, sx, sy, lt, 8.6)

    cap1 = [
        [('Kissa kholo, neeche ', DIM), ('You', TEXT), (' tab.', DIM)],
        [('Upar "AI SETUP NEEDED" card par tap karo.', DIM)],
    ]
    cap2 = [
        [('"', DIM), ('+ Add AI Provider', TEXT), ('" dabao.', DIM)],
        [('Provider list khulegi — yahi se Gemini add hoga.', DIM)],
    ]
    caption(img, CAP_Y, cap1 if lt < 4.2 else cap2, size=34,
            kicker_text='STEP 3 / 6 · SETTINGS', kicker_color=ROSE_L)
    return img


def typed(full, lt, start, speed=22):
    if lt <= start:
        return ''
    n = int((lt - start) * speed)
    return full[:max(0, min(len(full), n))]


BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
MODEL = 'gemini-3.8-flash'


def s_step4(img, lt, t):
    d = ImageDraw.Draw(img)
    d.text((64, 100), 'STEP 4 · DETAILS', font=P6(15), fill=ROSE_L)
    d.text((64, 130), 'Gemini ka address + model', font=P7(36), fill=TEXT)

    name = typed('Gemini', lt, 1.1, 12)
    url = typed(BASE_URL, lt, 3.0, 34)
    model = typed(MODEL, lt, 7.0, 14)
    preset_hot = 'Custom (OpenAI-compatible)' if lt > 0.4 else None
    mock, a = mock_kissa_editor(name=name, url=url, model=model, preset_hot=preset_hot)

    crops = [
        (0.0, focus(540, 560, 1080)),
        (0.8, focus(540, a['presets'][1] + 120, 1080)),
        (2.3, focus(540, a['name'][1] + 80, 1080)),
        (3.2, focus(540, a['url'][1] + 60, 1080)),
        (9.6, focus(540, a['model'][1] + 40, 1080)),
    ]
    box = L.camera_anim(crops, lt)
    paste_card(img, mock, box, label='Kissa · Add AI Provider')

    # cursor in the field currently being typed
    cursor_field = None
    if 1.1 < lt < 2.6:
        cursor_field = a['name']
    elif 3.0 < lt < 6.9:
        cursor_field = a['url']
    elif 7.0 < lt < 9.2:
        cursor_field = a['model']
    if cursor_field and int(lt * 3) % 2 == 0:
        cx = CX + CW * (cursor_field[0] + 380 - box[0]) / (box[2] - box[0])
        cy = CY + CH * (cursor_field[1] - box[1]) / (box[3] - box[1])
        dd = ImageDraw.Draw(img)
        dd.rectangle([cx, cy - 26, cx + 3, cy + 22], fill=(255, 255, 255, 220))

    cap1 = [
        [('Preset mein ', DIM), ('Custom (OpenAI-compatible)', TEXT), (' chuno.', DIM)],
        [('Gemini ka apna OpenAI-compatible endpoint hai.', DIM)],
    ]
    cap2 = [
        [('Base URL', DIM), (' exactly ye hai:', DIM)],
        [('/v1beta/openai', GOLD), (' — ', DIM), ('/v1 nahi.', ROSE_L)],
    ]
    cap3 = [
        [('Model likho: ', DIM), ('gemini-3.8-flash', TEXT)],
        [('Fast + free tier. Halka chahiye to ', DIM), ('gemini-3.5-flash-lite', GOLD), ('.', DIM)],
    ]
    if lt < 2.9:
        cap = cap1
    elif lt < 6.9:
        cap = cap2
    else:
        cap = cap3

    caption(img, CAP_Y, cap, size=34, kicker_text='STEP 4 / 6 · FIELDS', kicker_color=ROSE_L)
    return img


def s_step5(img, lt, t):
    d = ImageDraw.Draw(img)
    d.text((64, 100), 'STEP 5 · KEY PASTE', font=P6(15), fill=ROSE_L)
    d.text((64, 130), 'Test karo, phir save', font=P7(36), fill=TEXT)

    dots = int(clamp((lt - 0.6) / 0.9) * 26) if lt > 0.6 else 0
    test_state = 'ok' if lt > 3.9 else None
    mock, a = mock_kissa_editor(name='Gemini', url=BASE_URL, model=MODEL, dots=dots,
                                preset_hot='Custom (OpenAI-compatible)', test=test_state)

    crops = [
        (0.0, focus(540, a['key'][1] + 60, 1080)),
        (2.8, focus(540, a['test'][1] - 180, 1080)),
        (5.4, focus(540, a['save'][1] - 300, 1080)),
    ]
    box = L.camera_anim(crops, lt)
    paste_card(img, mock, box, label='Kissa · Add AI Provider')

    def sx_of(anchor):
        return (CX + CW * (anchor[0] - box[0]) / (box[2] - box[0]),
                CY + CH * (anchor[1] - box[1]) / (box[3] - box[1]))

    tx, ty = sx_of(a['test'])
    if lt > 2.4:
        pulse = 0.5 + 0.5 * np.sin(lt * 4.6)
        ring = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(ring).rounded_rectangle([tx - 160, ty - 44, tx + 160, ty + 44], radius=26,
                                               outline=(255, 255, 255, int(80 + 70 * pulse)), width=3)
        img.paste(ring, (0, 0), ring)
        tap(img, tx, ty, lt, 3.4)
    if lt > 6.2:
        gx, gy = sx_of(a['save'])
        tap(img, gx, gy, lt, 7.0)

    cap1 = [
        [('API Key box mein ', DIM), ('paste', TEXT), (' karo.', DIM)],
        [('Field dots dikhayega — key chhupi rehti hai.', DIM)],
    ]
    cap2 = [
        [('Ab ', DIM), ('Test Connection', TEXT), (' dabao.', DIM)],
        [('Green "Connected" = key sahi hai.', SUCCESS)],
    ]
    cap3 = [
        [('Sab theek? ', DIM), ('Save Provider', TEXT), (' dabao.', DIM)],
        [('Key phone ke secure keystore mein chali jaati hai.', DIM)],
    ]
    cap = cap1 if lt < 3.2 else (cap2 if lt < 6.2 else cap3)
    caption(img, CAP_Y, cap, size=34, kicker_text='STEP 5 / 6 · TEST', kicker_color=ROSE_L)
    return img


def s_step6(img, lt, t):
    d = ImageDraw.Draw(img)
    d.text((64, 100), 'STEP 6 · CHECK', font=P6(15), fill=ROSE_L)
    d.text((64, 130), 'Ab kahani chalao', font=P7(36), fill=TEXT)

    setup, asu = mock_kissa_ai_setup(provider='gemini', saved=True)
    you, ay = mock_kissa_you('ready')
    chat, ac = mock_kissa_chat()

    crops = [
        (0.0, focus(540, asu['provider'][1], 1080)),
        (3.4, focus(540, ay['ai_card'][1], 1080)),
        (5.6, focus(540, 520, 1080)),
        (7.6, focus(540, 900, 1080)),
    ]
    box = L.camera_anim(crops, lt)
    if lt < 3.2:
        mock = setup
        label = 'Kissa · providers'
    elif lt < 5.3:
        mock = you
        label = 'Kissa · You'
    else:
        mock = chat
        label = 'Kissa · story'
    paste_card(img, mock, box, label=label, badge='AI READY' if lt > 1.2 else None)

    cap1 = [
        [('Provider list mein ', DIM), ('Gemini · ACTIVE', TEXT), (' dikhe.', DIM)],
        [('Matlab key save ho gayi.', DIM)],
    ]
    cap2 = [
        [('You tab par card ', DIM), ('green "AI READY"', SUCCESS), (' ho gaya.', DIM)],
        [('Yahi final confirmation hai.', DIM)],
    ]
    cap3 = [
        [('Ab koi bhi kahani kholo — ', DIM), ('characters', TEXT)],
        [('tumhare Gemini se jawab denge.', DIM)],
    ]
    cap = cap1 if lt < 3.2 else (cap2 if lt < 5.4 else cap3)
    caption(img, CAP_Y, cap, size=34, kicker_text='STEP 6 / 6 · VERIFY', kicker_color=ROSE_L)
    return img


def s_errors(img, lt, t):
    d = ImageDraw.Draw(img)
    d.text((64, 250), 'AGAR KUCH GALAT HO', font=P6(16), fill=ROSE_L)
    headline(img, 296, ['Error aaye', 'to ye dekho'], size=60, accent='ye', accent_color=GOLD)

    rows = [
        ('401', 'Invalid API key', 'Key dobara copy karo — extra space bhi error deta hai', (236, 110, 120)),
        ('403', 'Key blocked / region', 'Naya project banao, ya doosra Google account', (236, 160, 110)),
        ('404', 'Base URL galat', 'Address /v1beta/openai par khatam hona chahiye', GOLD),
        ('429', 'Free limit khatam', '1 min ruko, ya gemini-3.5-flash-lite try karo', SUCCESS),
    ]
    y0 = 520
    for i, (code, title, fix, col) in enumerate(rows):
        k = appear(lt, 0.5 + i * 0.22, 0.5)
        y = y0 + i * 152 + int((1 - k) * 26)
        rect(d, [64, y, W - 64, y + 128], 20, (20, 21, 28), (44, 46, 58), 1)
        rect(d, [64, y, 78, y + 128], 7, col)
        d.text((104, y + 22), code, font=P7(30), fill=col)
        d.text((104 + 92, y + 24), title, font=P6(25), fill=TEXT)
        d.text((104, y + 74), fix, font=P4(20), fill=DIM)

    caption(img, CAP_Y, [
        [('Sabse common galti: ', DIM), ('base URL', TEXT), (' mein /v1 lagana.', DIM)],
        [('Sahi: ', DIM), ('…/v1beta/openai', GOLD)],
    ], size=34, kicker_text='TROUBLESHOOTING', kicker_color=ROSE_L)
    return img


def s_outro(img, lt, t):
    d = ImageDraw.Draw(img)
    k = appear(lt, 0.1, 0.5)
    d.text((64, 430), 'HO GAYA', font=P6(16), fill=ROSE_L)

    headline(img, 476, ['Key lag gayi.', 'Ab kahani shuru.'], size=72, accent='kahani', accent_color=ROSE_L)

    a = appear(lt, 0.7, 0.5)
    rect(d, [64, 720, W - 64, 940], 24, (22, 23, 31), (58, 60, 74), 1)
    d.text((100, 748), 'Yaad rakho', font=P6(24), fill=GOLD)
    pts = ['Key kisi ko mat bhejo — chat, screenshot, kuch bhi nahi.',
           'Key sirf tumhare phone mein encrypted rehti hai.',
           'Model kabhi bhi badal sakte ho: Settings > AI Setup > Edit.']
    for i, p in enumerate(pts):
        d.text((100, 790 + i * 44), '·  ' + p, font=P4(21), fill=DIM)

    b = appear(lt, 1.6, 0.6)
    if b > 0:
        rect(d, [64, 1000, W - 64, 1180], 24, (30, 18, 24), (110, 56, 70), 1)
        d.text((100, 1028), 'Kissa download karo', font=P6(24), fill=TEXT)
        d.text((100, 1068), 'beyondredeye.site', font=P7(34), fill=ROSE_L)
        d.text((100, 1122), 'Android 8+ · free · no account', font=P4(19), fill=FAINT)

    c = appear(lt, 2.6, 0.6)
    if c > 0:
        d.text((64, 1290), 'Save karo — key setup baad mein kaam aayega.', font=P5(24), fill=DIM)

    wordmark(img, 1720, 40)
    d.text((W - 64 - tw(d, 'Gemini API key · 2026', P4(18)), 1734),
           'Gemini API key · 2026', font=P4(18), fill=FAINT)
    return img


SCENES = [
    ('hook', 7.0, s_hook, None),
    ('why', 8.5, s_why, None),
    ('step1', 11.5, s_step1, 1),
    ('step2', 11.5, s_step2, 2),
    ('step3', 11.0, s_step3, 3),
    ('step4', 16.5, s_step4, 4),
    ('step5', 11.5, s_step5, 5),
    ('step6', 10.5, s_step6, 6),
    ('errors', 12.0, s_errors, None),
    ('outro', 8.0, s_outro, None),
]
TOTAL = sum(s[1] for s in SCENES)

# tap moments for the click sound (absolute seconds)
TAPS = []
_x = 0.0
for name, dur, fn, step in SCENES:
    if name == 'step1':
        TAPS.append(_x + 6.2)
    elif name == 'step2':
        TAPS += [_x + 3.6, _x + 7.0]
    elif name == 'step3':
        TAPS += [_x + 3.0, _x + 8.6]
    elif name == 'step5':
        TAPS += [_x + 3.4, _x + 7.0]
    _x += dur


def footer(img, scene_index):
    """Six step dots + site line, so the empty bottom band earns its space."""
    d = ImageDraw.Draw(img)
    y = 1722
    if 2 <= scene_index <= 7:
        step = scene_index - 1
        total, gap, r = 6, 30, 6
        x0 = (W - (total - 1) * gap) / 2
        for i in range(total):
            cx = x0 + i * gap
            if i + 1 < step:
                d.ellipse([cx - r, y - r, cx + r, y + r], fill=(120, 60, 76))
            elif i + 1 == step:
                d.ellipse([cx - r - 3, y - r - 3, cx + r + 3, y + r + 3], fill=ROSE)
            else:
                d.ellipse([cx - r, y - r, cx + r, y + r], outline=(70, 73, 86), width=2)
        d.text((64, y + 34), 'step ' + str(step) + ' / 6', font=P5(15), fill=FAINT)
        d.text((W - 64 - tw(d, 'beyondredeye.site', P5(15)), y + 34),
               'beyondredeye.site', font=P5(15), fill=FAINT)
    else:
        d.text((64, y + 26), 'beyondredeye.site', font=P5(16), fill=FAINT)
        tag = 'no account · no coins · no limits'
        d.text((W - 64 - tw(d, tag, P5(16)), y + 26), tag, font=P5(16), fill=(78, 82, 96))


def frame_at(t):
    img = background()
    acc = 0.0
    for name, dur, fn, step in SCENES:
        if t < acc + dur or name == SCENES[-1][0]:
            lt = t - acc
            img = fn(img, lt, t)
            chrome(img, t, step)
            footer(img, SCENES.index((name, dur, fn, step)))
            return img, name
        acc += dur
    return img, SCENES[-1][0]


def stills(times):
    import contact_sheet
    for t in times:
        img, _ = frame_at(t)
        path = os.path.join(OUT_DIR, f'still_{t:05.1f}.jpg')
        img.convert('RGB').save(path, quality=92)
        print('wrote', path)
    contact_sheet.build([os.path.join(OUT_DIR, f'still_{t:05.1f}.jpg') for t in times],
                        os.path.join(OUT_DIR, 'preview_sheet.jpg'))


def render():
    os.makedirs(OUT_DIR, exist_ok=True)
    wav = os.path.join(OUT_DIR, 'bed.wav')
    print('synthesising audio…', flush=True)
    audio.build(wav, TOTAL)
    # soft click at each tap moment
    import wave
    with wave.open(wav, 'rb') as f:
        params = f.getparams()
        data = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16).astype(np.float32).reshape(-1, 2)
    sr = params.framerate
    for t in TAPS:
        n = int(0.06 * sr)
        idx = int(t * sr)
        if idx + n >= len(data):
            continue
        tt = np.arange(n) / sr
        click = (np.sin(2 * np.pi * 1500 * tt) * np.exp(-tt * 60) * 900).astype(np.float32)
        data[idx:idx + n, 0] += click
        data[idx:idx + n, 1] += click
    data = np.clip(data, -32767, 32767).astype(np.int16)
    with wave.open(wav, 'wb') as f:
        f.setparams(params)
        f.writeframes(data.tobytes())

    cmd = [
        L.FF, '-y',
        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
        '-i', wav,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
        '-profile:v', 'high', '-level', '4.1', '-g', str(FPS * 2),
        '-c:a', 'aac', '-b:a', '160k', '-shortest',
        '-movflags', '+faststart',
        OUT,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    total = int(TOTAL * FPS)
    for i in range(total):
        t = i / FPS
        img, _ = frame_at(t)
        proc.stdin.write(img.tobytes())
        if i % 60 == 0:
            print(f'  frame {i}/{total} ({i / total * 100:4.1f}%)', flush=True)
    proc.stdin.close()
    err = proc.stderr.read().decode('utf-8', 'ignore')
    code = proc.wait()
    if code != 0:
        print(err[-4000:])
        raise SystemExit(f'ffmpeg failed ({code})')
    print('done', OUT, os.path.getsize(OUT) // 1024 // 1024, 'MB')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--stills':
        stills([float(x) for x in sys.argv[2].split(',')])
    elif len(sys.argv) > 1 and sys.argv[1] == '--preview':
        stills([1.5, 9.0, 19.0, 30.0, 41.0, 60.0, 70.0, 82.0, 94.0, 104.0])
    else:
        render()
