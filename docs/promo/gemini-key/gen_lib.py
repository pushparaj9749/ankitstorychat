"""Kissa — "Gemini API key kaise setup karein" tutorial (1080x1920, 30 fps, ~1:48).

Design: Kissa Noir (rose #F0567E, champagne #E2BE7E, midnight #0A0B10).
Structure: hook -> why -> 6 steps -> errors -> outro. Hinglish captions, no VO,
so the whole thing reads with the sound off (Shorts/Reels behaviour).

Kissa screens are drawn here in the app's own layout/typography (Poppins), because
the real screenshots on disk show a Groq provider. The Google AI Studio pages are
stylised illustrations of the public pages — the small "illustration" note on those
cards says so instead of pretending to be a screenshot.

    python3 build_gemini_tutorial.py                 # full render
    python3 build_gemini_tutorial.py --stills 3,18.5  # PNG stills
    python3 build_gemini_tutorial.py --preview        # contact sheet

Needs: pillow, numpy, imageio-ffmpeg, fonts from ../ad2/fonts.
"""
import math
import os
import subprocess
import sys

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1080, 1920, 30
HERE = os.path.dirname(os.path.abspath(__file__))
PROMO = os.path.abspath(os.path.join(HERE, '..'))
FONTS = os.path.join(PROMO, 'ad2', 'fonts')
OUT_DIR = os.path.join(PROMO, 'gemini-key')
OUT = os.path.join(OUT_DIR, 'kissa_gemini_api_key_9x16.mp4')

# ---------------------------------------------------------------- palette ----
BG = (9, 10, 15)
BG2 = (14, 15, 22)
SURFACE = (18, 20, 27)
SURFACE2 = (25, 27, 36)
SURFACE3 = (33, 36, 46)
BORDER = (44, 47, 58)
ROSE = (240, 86, 126)
ROSE_L = (245, 138, 165)
ROSE_DIM = (96, 36, 52)
GOLD = (226, 190, 126)
TEXT = (246, 246, 249)
DIM = (170, 172, 184)
FAINT = (112, 116, 128)
SUCCESS = (92, 201, 149)
GOOGLE_BLUE = (26, 115, 232)

FONT_CACHE = {}


def F(name, size):
    key = (name, size)
    if key not in FONT_CACHE:
        FONT_CACHE[key] = ImageFont.truetype(os.path.join(FONTS, name + '.ttf'), size)
    return FONT_CACHE[key]


P4 = lambda s: F('Poppins_400Regular', s)
P5 = lambda s: F('Poppins_500Medium', s)
P6 = lambda s: F('Poppins_600SemiBold', s)
P7 = lambda s: F('Poppins_700Bold', s)
P8 = lambda s: F('Poppins_800ExtraBold', s)
PLAY = lambda s: F('PlayfairDisplay_900Black', s)

# ------------------------------------------------------------------ utils ----


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def lerp(a, b, t):
    return a + (b - a) * t


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_io(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def appear(t, start, dur=0.45):
    return ease_out((t - start) / dur) if dur > 0 else 1.0


def lerp_rgb(c1, c2, t):
    return tuple(int(round(lerp(c1[i], c2[i], t))) for i in range(3))


def tw(d, s, f):
    return d.textlength(s, font=f)


def rect(d, box, r=0, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def vgrad(size, top, bottom):
    w, h = size
    col = Image.new('RGB', (1, h))
    px = col.load()
    for y in range(h):
        px[0, y] = lerp_rgb(top, bottom, y / max(1, h - 1))
    return col.resize((w, h), Image.BILINEAR)


def radial_glow(size, center, radius, color, strength=1.0):
    w, h = size
    small = (max(8, w // 8), max(8, h // 8))
    img = Image.new('L', small, 0)
    d = ImageDraw.Draw(img)
    cx, cy = center[0] * small[0] / w, center[1] * small[1] / h
    r = radius * small[0] / w
    steps = 22
    for i in range(steps, 0, -1):
        a = int(255 * strength * (i / steps) ** 2.4)
        rr = r * (i / steps)
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=a)
    img = img.filter(ImageFilter.GaussianBlur(radius=6)).resize((w, h), Image.BILINEAR)
    layer = Image.new('RGB', (w, h), color)
    return layer, img


def make_background():
    """Static Kissa Noir backdrop: midnight gradient, two soft glows, vignette, grain."""
    base = vgrad((W, H), (7, 7, 11), (13, 13, 19)).convert('RGB')

    for color, center, radius, strength in (
        (ROSE, (120, 210), 720, 0.30),
        ((120, 90, 200), (980, 1180), 620, 0.16),
        (GOLD, (900, 1820), 520, 0.12),
    ):
        layer, mask = radial_glow((W, H), center, radius, color, strength)
        base = Image.composite(layer, base, mask.point(lambda v: int(v * 0.55)))

    # vignette
    v, vmask = radial_glow((W, H), (W // 2, H // 2), 1180, (0, 0, 0), 1.0)
    base = Image.composite(v, base, vmask.point(lambda x: int(x * 0.55)))

    # grain (static: avoids per-frame cost and banding on gradients)
    rng = np.random.default_rng(7)
    noise = rng.normal(0, 3.0, (H // 2, W // 2)).astype(np.float32)
    noise = np.repeat(np.repeat(noise, 2, axis=0), 2, axis=1)[:H, :W]
    arr = np.asarray(base).astype(np.float32) + noise[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


BG_IMG = None


def background():
    global BG_IMG
    if BG_IMG is None:
        BG_IMG = make_background()
    return BG_IMG.copy()


def paste_alpha(base, img, xy):
    base.paste(img, xy, img if img.mode == 'RGBA' else None)


def shadowed_card(size, radius, fill, border=(255, 255, 255, 26), glow=None):
    """RGBA card with 1px hairline border and an optional soft drop shadow."""
    w, h = size
    pad = 40
    canvas = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    if glow:
        d.rounded_rectangle([pad, pad + 10, pad + w, pad + h + 14], radius=radius, fill=glow)
        canvas = canvas.filter(ImageFilter.GaussianBlur(12))
        d = ImageDraw.Draw(canvas)
    d.rounded_rectangle([pad, pad + 6, pad + w, pad + h + 10], radius=radius, fill=(0, 0, 0, 150))
    canvas = canvas.filter(ImageFilter.GaussianBlur(10))
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle([pad, pad, pad + w, pad + h], radius=radius, fill=fill, outline=border, width=1)
    return canvas, pad


# ------------------------------------------------------- Kissa UI (3x dp) ----
S = 3.0  # design scale: the app is 360x780 dp, drawn at 1080x2340 px


def u(v):
    """dp -> mock pixels."""
    return int(round(v * S))


MOCK_W, MOCK_H = 1080, 2340

# app colours (mirror src/theme.ts midnight)
A_BG = (10, 11, 16)
A_SURF = (17, 19, 25)
A_SURF2 = (23, 26, 34)
A_SURF3 = (33, 36, 46)
A_BORDER = (38, 41, 51)
A_TEXT = (244, 245, 248)
A_DIM = (168, 172, 185)
A_FAINT = (116, 120, 135)


def mock_base():
    img = Image.new('RGB', (MOCK_W, MOCK_H), A_BG)
    # very subtle top glow, like the app's screen gradients
    layer, mask = radial_glow((MOCK_W, MOCK_H), (200, 120), 900, ROSE, 0.16)
    img = Image.composite(layer, img, mask.point(lambda v: int(v * 0.5)))
    return img


def status_bar(d, dark=True):
    fg = (235, 236, 240) if dark else (40, 42, 48)
    d.text((u(28), u(14)), '9:41', font=P6(u(14)), fill=fg)
    # signal / wifi / battery, drawn simply
    x = MOCK_W - u(96)
    for i in range(4):
        hgt = u(4 + i * 2.4)
        d.rectangle([x + i * u(6), u(26) - hgt, x + i * u(6) + u(4), u(26)], fill=fg)
    x2 = MOCK_W - u(56)
    d.arc([x2, u(14), x2 + u(20), u(30)], 300, 240, fill=fg, width=u(1.6))
    d.arc([x2 + u(5), u(19), x2 + u(15), u(27)], 300, 240, fill=fg, width=u(1.6))
    bx = MOCK_W - u(30)
    d.rounded_rectangle([bx, u(16), bx + u(18), u(26)], radius=u(3), outline=fg, width=u(1.4))
    d.rectangle([bx + u(3), u(19), bx + u(13), u(24)], fill=fg)


def pill(d, xy, text, f, fg, bg=None, outline=None, padx=None, h=None, radius=None):
    x, y = xy
    padx = padx if padx is not None else u(11)
    h = h if h is not None else f.size + u(10)
    w = tw(d, text, f) + padx * 2
    box = [x, y, x + w, y + h]
    rect(d, box, radius if radius is not None else h // 2, bg, outline, max(1, u(0.8)))
    d.text((x + padx, y + (h - f.size) / 2 - u(1)), text, font=f, fill=fg)
    return w


def fit_size(d, text, maxw, start, minimum=8):
    size = start
    while size > minimum and d.textlength(text, font=F('Poppins_400Regular', size)) > maxw:
        size -= 1
    return size


def field(d, x, y, w, label, value, placeholder='', focus=False, dots=0, mono=False):
    f_lab = P5(u(11))
    d.text((x, y), label, font=f_lab, fill=A_DIM)
    top = y + u(20)
    h = u(44)
    rect(d, [x, top, x + w, top + h], u(13), A_SURF2, ROSE if focus else A_BORDER, u(1))
    inner = x + u(14)
    fs = P4(u(14))
    if dots:
        s = '•' * dots
        d.text((inner, top + u(14)), s, font=fs, fill=A_TEXT)
    elif value:
        size = fit_size(d, value, w - u(28), u(14), 8)
        d.text((inner, top + u(12) + (u(14) - size) // 2), value,
               font=F('Poppins_400Regular', size), fill=A_TEXT)
    elif placeholder:
        d.text((inner, top + u(12)), placeholder, font=fs, fill=A_FAINT)
    return top + h


def primary_button(d, x, y, w, h, label, fg=(14, 7, 11), fill=ROSE, fs=u(15)):
    rect(d, [x, y, x + w, y + h], h // 2, fill)
    f = P7(fs)
    d.text((x + (w - tw(d, label, f)) / 2, y + (h - fs) / 2 - u(1)), label, font=f, fill=fg)


def ghost_button(d, x, y, w, h, label, fs=u(14)):
    rect(d, [x, y, x + w, y + h], h // 2, None, A_BORDER, u(1.4))
    f = P6(fs)
    d.text((x + (w - tw(d, label, f)) / 2, y + (h - fs) / 2 - u(1)), label, font=f, fill=A_TEXT)


def kicker(d, x, y, text, color=ROSE_L):
    f = P6(u(10))
    d.text((x, y), text, font=f, fill=color)


def section_head(d, x, y, kick, title):
    # small rose dash then kicker, like the app's SectionHeader
    d.rounded_rectangle([x, y + u(6), x + u(16), y + u(8)], radius=u(1), fill=ROSE)
    kicker(d, x + u(24), y, kick)
    d.text((x, y + u(20)), title, font=P8(u(24)), fill=A_TEXT)


def tab_bar(d, active='You'):
    y = MOCK_H - u(74)
    rect(d, [u(16), y, MOCK_W - u(16), y + u(60)], u(30), (20, 22, 29), (44, 47, 58), u(1))
    items = ['Home', 'Explore', None, 'Library', 'You']
    slot = (MOCK_W - u(32)) / len(items)
    for i, name in enumerate(items):
        cx = u(16) + slot * (i + 0.5)
        if name is None:
            d.ellipse([cx - u(24), y + u(4), cx + u(24), y + u(52)], fill=ROSE)
            d.text((cx - u(6), y + u(14)), '+', font=P4(u(24)), fill=(14, 7, 11))
            continue
        col = ROSE_L if name == active else A_FAINT
        d.rounded_rectangle([cx - u(9), y + u(16), cx + u(9), y + u(30)], radius=u(3), outline=col, width=u(1.6))
        f = P4(u(9))
        d.text((cx - tw(d, name, f) / 2, y + u(36)), name, font=f, fill=col)


def mock_kissa_you(ai='needed'):
    """Settings / You tab. ai: 'needed' | 'ready'."""
    img = mock_base()
    d = ImageDraw.Draw(img)
    status_bar(d)

    kicker(d, u(24), u(62), 'ACCOUNT')
    d.text((u(24), u(78)), 'You', font=P8(u(30)), fill=A_TEXT)

    # profile card
    card = [u(20), u(126), MOCK_W - u(20), u(320)]
    rect(d, card, u(20), (22, 16, 21), (58, 40, 48), u(1.2))
    d.ellipse([u(40), u(150), u(104), u(214)], fill=(40, 34, 42), outline=(90, 84, 96), width=u(1.5))
    d.text((u(58), u(166)), 'A', font=P7(u(28)), fill=A_TEXT)
    d.text((u(122), u(150)), 'Ankit', font=P8(u(22)), fill=A_TEXT)
    pill(d, (u(122), u(184)), '18+', P7(u(9)), (14, 7, 11), (44, 40, 48))
    d.text((u(176), u(186)), 'Stored on this device only', font=P4(u(10)), fill=A_DIM)
    # stats
    d.line([(u(46), u(246)), (MOCK_W - u(46), u(246))], fill=(52, 42, 48), width=u(1))
    for i, (v, k) in enumerate(((0, 'SAVED'), (0, 'JOURNEYS'), (0, 'STORIES'))):
        cx = u(24) + (MOCK_W - u(48)) * (i + 0.5) / 3
        fv, fk = P8(u(18)), P6(u(9))
        d.text((cx - tw(d, str(v), fv) / 2, u(262)), str(v), font=fv, fill=A_TEXT)
        d.text((cx - tw(d, k, fk) / 2, u(292)), k, font=fk, fill=A_DIM)

    # AI card
    y = u(344)
    ready = ai == 'ready'
    fill = (18, 34, 28) if ready else (26, 22, 16)
    edge = (46, 92, 74) if ready else (86, 70, 40)
    rect(d, [u(20), y, MOCK_W - u(20), y + u(96)], u(18), fill, edge, u(1.4))
    dot = SUCCESS if ready else GOLD
    d.ellipse([u(38), y + u(18), u(50), y + u(30)], fill=dot)
    d.text((u(60), y + u(16)), 'AI READY' if ready else 'AI SETUP NEEDED', font=P6(u(10)),
           fill=(150, 230, 190) if ready else GOLD)
    d.text((u(38), y + u(38)), 'Gemini · gemini-3.8-flash' if ready else 'Connect your own AI provider',
           font=P7(u(16)), fill=A_TEXT)
    d.text((u(38), y + u(64)),
           'Your key stays on this device — sent only to Google.' if ready
           else 'Add your own API key to start a story',
           font=P4(u(10)), fill=A_DIM)
    d.text((MOCK_W - u(48), y + u(34)), '›', font=P4(u(22)), fill=A_FAINT)

    section_head(d, u(24), u(476), 'CREATE', 'Creator Studio')
    rows = [('Suggest an Idea', 'Share a story concept'), ('Submit a Story', 'Submit your complete story'),
            ('My Submissions', 'Review status and history')]
    y0 = u(536)
    rect(d, [u(20), y0, MOCK_W - u(20), y0 + u(64) * 3], u(18), (20, 22, 29), A_BORDER, u(1))
    for i, (t1, t2) in enumerate(rows):
        yy = y0 + u(64) * i
        if i:
            d.line([(u(20), yy), (MOCK_W - u(20), yy)], fill=(36, 39, 48), width=u(1))
        rect(d, [u(34), yy + u(14), u(70), yy + u(50)], u(10), (34, 30, 40))
        d.text((u(86), yy + u(14)), t1, font=P7(u(14)), fill=A_TEXT)
        d.text((u(86), yy + u(34)), t2, font=P4(u(10)), fill=A_DIM)
        d.text((MOCK_W - u(46), yy + u(20)), '›', font=P4(u(18)), fill=A_FAINT)

    section_head(d, u(24), u(744), 'DISPLAY', 'App & Feel')
    rect(d, [u(20), u(804), MOCK_W - u(20), u(884)], u(18), (20, 22, 29), A_BORDER, u(1))
    d.text((u(86), u(818)), 'Theme & Typography', font=P7(u(14)), fill=A_TEXT)
    d.text((u(86), u(838)), 'Dark, AMOLED, text size', font=P4(u(10)), fill=A_DIM)
    rect(d, [u(34), u(824), u(70), u(860)], u(10), (34, 30, 40))

    tab_bar(d, 'You')
    return img, {'ai_card': (MOCK_W / 2, u(344) + u(48))}


def mock_kissa_ai_setup(provider=None, saved=False):
    """AI Setup screen. provider: None | 'gemini'. saved: show ACTIVE card."""
    img = mock_base()
    d = ImageDraw.Draw(img)
    status_bar(d)

    kicker(d, u(24), u(62), 'INTELLIGENCE ENGINE')
    d.text((u(24), u(78)), 'AI Setup', font=P8(u(30)), fill=A_TEXT)

    # info card
    rect(d, [u(20), u(136), MOCK_W - u(20), u(272)], u(18), A_SURF, A_BORDER, u(1))
    f = P4(u(11.5))
    d.text((u(38), u(156)), 'AI STORY CHAT:', font=P7(u(11.5)), fill=ROSE_L)
    d.text((u(38) + tw(d, 'AI STORY CHAT: ', P7(u(11.5))), u(156)),
           'Kissa brings characters to life with an', font=f, fill=A_DIM)
    d.text((u(38), u(178)), 'OpenAI-compatible LLM.', font=f, fill=A_DIM)
    d.text((u(38), u(212)), 'PRIVATE API KEY:', font=P7(u(11.5)), fill=GOLD)
    d.text((u(38) + tw(d, 'PRIVATE API KEY: ', P7(u(11.5))), u(212)),
           'Your key stays encrypted on your', font=f, fill=A_DIM)
    d.text((u(38), u(234)), 'device and is never sent to our servers.', font=f, fill=A_DIM)

    section_head(d, u(24), u(300), 'CONFIGURED', 'Your Providers')

    if saved and provider:
        rect(d, [u(20), u(372), MOCK_W - u(20), u(486)], u(18), (30, 20, 26), ROSE, u(1.4))
        d.text((u(38), u(390)), 'Gemini', font=P7(u(16)), fill=A_TEXT)
        pill(d, (u(38) + tw(d, 'Gemini', P7(u(16))) + u(12), u(390)), 'ACTIVE', P7(u(9)), (14, 7, 11), ROSE_L)
        d.text((u(38), u(420)), 'gemini-3.8-flash • Key Encrypted', font=P4(u(10.5)), fill=A_DIM)
        d.text((u(38), u(442)), 'generativelanguage.googleapis.com/v1beta/openai',
               font=P4(u(9)), fill=A_FAINT)
        ghost_button(d, MOCK_W - u(112), u(410), u(74), u(30), 'Edit', fs=u(11))
    else:
        # empty state
        cy = u(560)
        d.ellipse([MOCK_W / 2 - u(52), cy - u(52), MOCK_W / 2 + u(52), cy + u(52)], fill=(26, 18, 24))
        # key glyph
        d.ellipse([MOCK_W / 2 - u(30), cy - u(22), MOCK_W / 2 + u(2), cy + u(10)], outline=ROSE, width=u(4))
        d.line([(MOCK_W / 2 + u(0), cy - u(6)), (MOCK_W / 2 + u(34), cy - u(6))], fill=ROSE, width=u(4))
        d.line([(MOCK_W / 2 + u(26), cy - u(6)), (MOCK_W / 2 + u(26), cy + u(8))], fill=ROSE, width=u(4))
        # sparkles
        for (sx, sy, r) in ((-u(46), -u(46), 4), (u(40), -u(40), 3), (-u(30), u(30), 2)):
            d.ellipse([MOCK_W / 2 + sx - u(r), cy + sy - u(r), MOCK_W / 2 + sx + u(r), cy + sy + u(r)],
                      fill=GOLD if r > 3 else ROSE_L)
        t1, t2 = 'No AI provider added', 'Add an API key to bring story characters and'
        d.text((MOCK_W / 2 - tw(d, t1, P7(u(18))) / 2, cy + u(84)), t1, font=P7(u(18)), fill=A_TEXT)
        f2 = P4(u(11.5))
        d.text((MOCK_W / 2 - tw(d, t2, f2) / 2, cy + u(118)), t2, font=f2, fill=A_DIM)
        t3 = 'worlds to life.'
        d.text((MOCK_W / 2 - tw(d, t3, f2) / 2, cy + u(140)), t3, font=f2, fill=A_DIM)

    primary_button(d, u(24), MOCK_H - u(140), MOCK_W - u(48), u(50), '+ Add AI Provider')
    return img, {
        'add': (MOCK_W / 2, MOCK_H - u(140) + u(25)),
        'provider': (MOCK_W / 2, u(372) + u(57)),
        'empty': (MOCK_W / 2, u(560)),
    }


PRESETS = ['OpenAI', 'OpenRouter', 'Groq', 'Together AI']


def mock_kissa_editor(name='', url='', model='', dots=0, preset_hot=None, test=None,
                      scrolled=False, key_visible=None):
    """Provider editor. Values are typed progressively by the caller."""
    img = mock_base()
    d = ImageDraw.Draw(img)
    status_bar(d)

    kicker(d, u(24), u(62), 'AI ENGINE')
    d.text((u(24), u(78)), 'Add AI Provider', font=P8(u(30)), fill=A_TEXT)

    y = u(122)
    d.text((u(24), y), 'Popular Presets', font=P5(u(11)), fill=A_DIM)
    y += u(22)
    x = u(24)
    row_h = u(32)
    for p in PRESETS + ['Custom (OpenAI-compatible)']:
        f = P6(u(11))
        w = tw(d, p, f) + u(24)
        if x + w > MOCK_W - u(24):
            x = u(24)
            y += row_h + u(7)
        hot = p == preset_hot
        rect(d, [x, y, x + w, y + row_h], row_h // 2, (30, 22, 28) if hot else A_SURF,
             ROSE if hot else A_BORDER, u(1.2))
        d.text((x + u(12), y + u(8)), p, font=f, fill=A_TEXT)
        x += w + u(8)

    y += row_h + u(28)
    name_top = y + u(26)
    y = field(d, u(24), y, MOCK_W - u(48), 'Display Name', name, 'e.g. OpenAI', focus=False) + u(16)
    url_top = y + u(30)
    y = field(d, u(24), y, MOCK_W - u(48), 'Base URL', url, 'https://api.openai.com/v1') + u(16)
    model_top = y + u(30)
    y = field(d, u(24), y, MOCK_W - u(48), 'Model', model, 'e.g. gpt-4o-mini') + u(16)
    # key field
    d.text((u(24), y), 'API Key', font=P5(u(11)), fill=A_DIM)
    top = y + u(20)
    key_top = top
    rect(d, [u(24), top, MOCK_W - u(24), top + u(44)], u(13), A_SURF2, ROSE if dots else A_BORDER, u(1))
    if dots:
        d.text((u(38), top + u(14)), '•' * dots, font=P4(u(14)), fill=A_TEXT)
        if key_visible:
            d.text((u(38), top + u(14)), key_visible, font=P4(u(12)), fill=A_FAINT)
    else:
        d.text((u(38), top + u(12)), 'sk-…', font=P4(u(14)), fill=A_FAINT)

    y = top + u(50)
    d.text((u(24), y), "Your key is stored encrypted on this device only.",
           font=P4(u(9.5)), fill=A_FAINT)

    y += u(30)
    if test == 'ok':
        rect(d, [u(24), y, MOCK_W - u(24), y + u(72)], u(14), (18, 30, 25), SUCCESS, u(1.2))
        # check mark drawn, not typed: no icon font is available here
        ccx, ccy, cr = u(52), y + u(30), u(13)
        d.ellipse([ccx - cr, ccy - cr, ccx + cr, ccy + cr], outline=SUCCESS, width=u(2))
        d.line([(ccx - u(6), ccy), (ccx - u(1), ccy + u(5))], fill=SUCCESS, width=u(2.4))
        d.line([(ccx - u(1), ccy + u(5)), (ccx + u(7), ccy - u(5))], fill=SUCCESS, width=u(2.4))
        f = P4(u(11))
        d.text((u(76), y + u(12)), 'Connected! Provider replied:', font=f, fill=SUCCESS)
        d.text((u(76), y + u(36)), '"Namaste! Main ready hoon."', font=f, fill=SUCCESS)
        y += u(88)
    elif test == 'bad':
        rect(d, [u(24), y, MOCK_W - u(24), y + u(56)], u(14), (32, 20, 22), (200, 80, 90), u(1.2))
        d.text((u(40), y + u(16)), 'Invalid API key (401). Check the key and try again.',
               font=P4(u(10.5)), fill=(240, 120, 130))
        y += u(72)

    btn_y = y + u(6)
    ghost_button(d, u(24), btn_y, u(152), u(50), 'Test Connection', fs=u(12))
    primary_button(d, u(184), btn_y, u(152), u(50), 'Save Provider', fs=u(12))
    anchors = {
        'presets': (MOCK_W / 2, u(166) + u(17)),
        'name': (MOCK_W / 2, name_top),
        'url': (MOCK_W / 2, url_top),
        'model': (MOCK_W / 2, model_top),
        'key': (MOCK_W / 2, key_top),
        'test': (u(24) + u(76), btn_y + u(25)),
        'save': (u(184) + u(76), btn_y + u(25)),
    }
    return img, anchors


def browser_frame(d, url):
    status_bar(d, dark=False)
    rect(d, [0, u(46), MOCK_W, u(46) + u(34)], 0, (236, 238, 242))
    rect(d, [u(16), u(54), MOCK_W - u(16), u(54) + u(30)], u(15), (255, 255, 255), (208, 211, 218), u(1))
    lx, ly = u(30), u(64)
    d.rounded_rectangle([lx, ly + u(4), lx + u(9), ly + u(12)], radius=u(1.5), outline=(120, 124, 132), width=u(1.2))
    d.arc([lx + u(1.5), ly - u(1), lx + u(7.5), ly + u(6)], 180, 360, fill=(120, 124, 132), width=u(1.2))
    d.text((u(48), u(62)), url, font=P4(u(12)), fill=(60, 64, 67))


def mock_google_home(url_typed='', t=0.0):
    """Stylised Google AI Studio home, mobile browser. Returns (image, anchors)."""
    img = Image.new('RGB', (MOCK_W, MOCK_H), (250, 250, 251))
    d = ImageDraw.Draw(img)
    browser_frame(d, url_typed or 'aistudio.google.com')

    y = u(108)
    d.text((u(20), y), 'Google', font=P7(u(20)), fill=(60, 64, 67))
    d.text((u(20) + tw(d, 'Google ', P7(u(20))), y), 'AI Studio', font=P4(u(20)), fill=(95, 99, 104))
    d.ellipse([MOCK_W - u(56), y, MOCK_W - u(24), y + u(32)], fill=(234, 236, 240))
    d.text((MOCK_W - u(45), y + u(7)), 'A', font=P7(u(12)), fill=(70, 74, 80))

    y += u(70)
    d.text((u(20), y), 'Build with', font=P6(u(28)), fill=(32, 33, 36))
    d.text((u(20), y + u(38)), 'Gemini', font=P6(u(28)), fill=GOOGLE_BLUE)
    d.text((u(20), y + u(84)), 'Prototype, test and ship with the Gemini API.',
           font=P4(u(12)), fill=(95, 99, 104))

    # two actions, stacked so both labels fit at 360dp
    by = y + u(118)
    rect(d, [u(20), by, MOCK_W - u(20), by + u(46)], u(23), GOOGLE_BLUE)
    d.text(((MOCK_W - tw(d, 'Create prompt', P6(u(13)))) / 2, by + u(13)),
           'Create prompt', font=P6(u(13)), fill=(255, 255, 255))

    get_y = by + u(58)
    rect(d, [u(20), get_y, MOCK_W - u(20), get_y + u(46)], u(23), (255, 255, 255), (200, 204, 212), u(1.4))
    d.text(((MOCK_W - tw(d, 'Get API key', P6(u(13)))) / 2, get_y + u(13)),
           'Get API key', font=P6(u(13)), fill=(32, 100, 200))

    # feature cards
    cy = get_y + u(76)
    for t1, t2 in (('Start a chat', 'Ask Gemini anything'),
                   ('Image generation', 'Nano Banana'),
                   ('API keys', 'Create and manage keys')):
        rect(d, [u(20), cy, MOCK_W - u(20), cy + u(64)], u(14), (255, 255, 255), (226, 229, 234), u(1))
        rect(d, [u(32), cy + u(12), u(72), cy + u(52)], u(11), (240, 244, 255))
        d.text((u(84), cy + u(12)), t1, font=P6(u(13)), fill=(32, 33, 36))
        d.text((u(84), cy + u(34)), t2, font=P4(u(10)), fill=(110, 114, 120))
        cy += u(74)

    anchors = {
        'getkey': (MOCK_W / 2, get_y + u(23)),
        'keys_card': (MOCK_W / 2, get_y + u(76) + u(148) + u(32)),
        'hero': (MOCK_W / 2, u(250)),
    }
    return img, anchors


def mock_google_keys(key_revealed=False, dialog=False, t=0.0):
    """Stylised AI Studio API-keys page. Returns (image, anchors)."""
    img = Image.new('RGB', (MOCK_W, MOCK_H), (250, 250, 251))
    d = ImageDraw.Draw(img)
    browser_frame(d, 'aistudio.google.com/api-keys')

    y = u(106)
    d.text((u(20), y), 'API keys', font=P6(u(24)), fill=(32, 33, 36))
    d.text((u(20), y + u(34)), 'Create and manage keys for the Gemini API.',
           font=P4(u(11)), fill=(95, 99, 104))

    y += u(74)
    rect(d, [u(20), y, MOCK_W - u(20), y + u(54)], u(11), (255, 255, 255), (222, 226, 232), u(1))
    d.text((u(34), y + u(9)), 'Project', font=P4(u(9)), fill=(120, 124, 132))
    d.text((u(34), y + u(25)), 'My First Project', font=P6(u(12.5)), fill=(32, 33, 36))
    ax, ay = MOCK_W - u(48), y + u(24)
    d.polygon([(ax - u(5), ay - u(2)), (ax + u(5), ay - u(2)), (ax, ay + u(4))], fill=(110, 114, 120))

    create_y = y + u(70)
    rect(d, [u(20), create_y, u(20) + u(210), create_y + u(44)], u(22), GOOGLE_BLUE)
    d.text((u(20) + u(22), create_y + u(12)), '+  Create API key', font=P6(u(12.5)), fill=(255, 255, 255))

    list_y = create_y + u(66)
    d.text((u(20), list_y), 'Your keys', font=P6(u(12)), fill=(60, 64, 67))
    ly = list_y + u(22)
    rect(d, [u(20), ly, MOCK_W - u(20), ly + u(84)], u(11), (255, 255, 255), (226, 229, 234), u(1))
    if key_revealed:
        d.text((u(34), ly + u(12)), 'Kissa', font=P6(u(12.5)), fill=(32, 33, 36))
        d.text((u(34), ly + u(34)), 'AIza•••••••••••••••••3Qk', font=P5(u(10.5)), fill=(95, 99, 104))
        d.text((u(34), ly + u(56)), 'Created just now', font=P4(u(9)), fill=(140, 144, 150))
        d.text((MOCK_W - u(80), ly + u(30)), 'Copy', font=P6(u(10.5)), fill=GOOGLE_BLUE)
    else:
        d.text((u(34), ly + u(34)), 'No keys yet', font=P4(u(11)), fill=(140, 144, 150))

    anchors = {'create': (u(20) + u(105), create_y + u(22)), 'list': (MOCK_W / 2, ly + u(40))}

    if dialog:
        overlay = Image.new('RGBA', (MOCK_W, MOCK_H), (0, 0, 0, 120))
        img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
        d = ImageDraw.Draw(img)
        x0, y0 = u(28), u(196)
        x1, y1 = MOCK_W - u(28), y0 + u(300)
        rect(d, [x0, y0, x1, y1], u(18), (255, 255, 255))

        d.text((x0 + u(24), y0 + u(24)), 'API key created', font=P6(u(17)), fill=(32, 33, 36))
        d.text((x0 + u(24), y0 + u(54)),
               'Copy it now — you will not see it again.', font=P4(u(10)), fill=(95, 99, 104))

        rect(d, [x0 + u(24), y0 + u(80), x1 - u(24), y0 + u(124)], u(9), (244, 246, 250))
        d.text((x0 + u(34), y0 + u(92)), 'AIzaSyD••••••••••••••••',
               font=P5(u(11.5)), fill=(60, 64, 67))

        bx, by, bh = x0 + u(24), y0 + u(140), u(40)
        rect(d, [bx, by, bx + u(140), by + bh], bh // 2, (255, 255, 255), (205, 209, 216), u(1.2))
        f = P6(u(11))
        d.text((bx + (u(140) - tw(d, 'Copy key', f)) / 2, by + u(11)), 'Copy key', font=f,
               fill=(32, 100, 200))
        dx = x1 - u(24) - u(150)
        rect(d, [dx, by, dx + u(150), by + bh], bh // 2, GOOGLE_BLUE)
        d.text((dx + (u(150) - tw(d, 'Done', f)) / 2, by + u(11)), 'Done', font=f,
               fill=(255, 255, 255))

        d.text((x0 + u(24), y0 + u(200)),
               'Anyone with this key can use your quota.', font=P4(u(9.5)), fill=(170, 55, 65))
        d.text((x0 + u(24), y0 + u(222)),
               'Paste it in Kissa, never in a group chat.', font=P4(u(9.5)), fill=(170, 55, 65))

        anchors['dialog_copy'] = (bx + u(70), by + bh / 2)
        anchors['dialog_done'] = (dx + u(75), by + bh / 2)
        anchors['dialog'] = ((x0 + x1) / 2, (y0 + y1) / 2)
    return img, anchors


def mock_kissa_chat():
    img = mock_base()
    d = ImageDraw.Draw(img)
    status_bar(d)
    bx, by = u(22), u(68)
    d.line([(bx + u(6), by - u(7)), (bx, by), (bx + u(6), by + u(7))], fill=A_TEXT, width=u(2))
    d.text((u(48), u(60)), 'Barish Boi Aur Tum', font=P7(u(14)), fill=A_TEXT)
    d.text((u(48), u(82)), 'Chapter 3 · Café', font=P4(u(9.5)), fill=A_FAINT)
    d.line([(0, u(104)), (MOCK_W, u(104))], fill=A_BORDER, width=u(1))

    def bubble(y, text, ai=True, name=None):
        f = P4(u(11))
        maxw = MOCK_W - u(150)
        lines, cur = [], ''
        for word in text.split():
            t = (cur + ' ' + word).strip()
            if tw(d, t, f) <= maxw:
                cur = t
            else:
                lines.append(cur)
                cur = word
        if cur:
            lines.append(cur)
        h = u(18) + len(lines) * u(19)
        if name:
            h += u(14)
        if ai:
            box = [u(20), y, u(20) + maxw + u(30), y + h]
            rect(d, box, u(13), (24, 26, 34), (44, 47, 58), u(1))
        else:
            box = [MOCK_W - u(20) - maxw - u(30), y, MOCK_W - u(20), y + h]
            rect(d, box, u(13), (44, 22, 32), (86, 44, 58), u(1))
        ty = y + u(9)
        if name:
            d.text((box[0] + u(14), y + u(7)), name, font=P6(u(9)), fill=ROSE_L)
            ty = y + u(22)
        for ln in lines:
            d.text((box[0] + u(14), ty), ln, font=f, fill=A_TEXT)
            ty += u(19)
        return y + h + u(12)

    y = u(130)
    narr = 'Shaam ki halki baarish. Café mein sirf tum ho.'
    d.text((u(44), y), narr, font=P4(u(10)), fill=A_FAINT)
    y += u(30)
    y = bubble(y, 'Tum aa gaye? Mujhe laga aaj koi nahi aayega.', ai=True, name='Myra')
    y = bubble(y, 'Main wahi hoon jo har baar aata hai.', ai=False)
    y = bubble(y, 'Phir aaj kuch naya karein — batao, kahani kahan chale?', ai=True, name='Myra')

    y += u(4)
    f = P5(u(10))
    for i, label in enumerate(('Café mein hi ruko', 'Baahar chalo')):
        w = tw(d, label, f) + u(24)
        x = u(20) + i * (w + u(8))
        rect(d, [x, y, x + w, y + u(32)], u(16), A_SURF2, A_BORDER, u(1))
        d.text((x + u(12), y + u(7)), label, font=f, fill=A_DIM)

    rect(d, [u(14), MOCK_H - u(116), MOCK_W - u(14), MOCK_H - u(58)], u(26), A_SURF2, A_BORDER, u(1))
    d.text((u(32), MOCK_H - u(99)), 'Apna move likho…', font=P4(u(11)), fill=A_FAINT)
    d.ellipse([MOCK_W - u(84), MOCK_H - u(108), MOCK_W - u(30), MOCK_H - u(66)], fill=ROSE)
    sx_, sy_ = MOCK_W - u(78), MOCK_H - u(87)
    d.polygon([(sx_, sy_ - u(6)), (sx_ + u(11), sy_), (sx_, sy_ + u(6))], fill=(14, 7, 11))
    return img, {'bubbles': (MOCK_W / 2, y - u(160))}


# --------------------------------------------------------------- camera ------


def camera(img, box, size, radius=28, border=(255, 255, 255, 34)):
    """Crop `box` (source px) and fit it into `size` (w, h), rounded + hairline."""
    crop = img.crop(box).convert('RGB')
    target_w, target_h = size
    scale = max(target_w / crop.width, target_h / crop.height)
    crop = crop.resize((int(crop.width * scale) + 1, int(crop.height * scale) + 1), Image.LANCZOS)
    left = (crop.width - target_w) // 2
    top = (crop.height - target_h) // 2
    crop = crop.crop((left, top, left + target_w, top + target_h))

    mask = Image.new('L', (target_w, target_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, target_w - 1, target_h - 1], radius=radius, fill=255)
    out = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    out.paste(crop, (0, 0))
    out.putalpha(mask)

    frame = ImageDraw.Draw(out)
    frame.rounded_rectangle([0, 0, target_w - 1, target_h - 1], radius=radius, outline=border, width=2)
    return out


def camera_anim(crops, t):
    """crops: [(time, (x, y, w, h))] — smoothstep between keyframes."""
    if t <= crops[0][0]:
        return crops[0][1]
    for i in range(len(crops) - 1):
        t0, b0 = crops[i]
        t1, b1 = crops[i + 1]
        if t0 <= t <= t1:
            k = ease_io((t - t0) / max(1e-6, t1 - t0))
            return tuple(lerp(b0[j], b1[j], k) for j in range(4))
    return crops[-1][1]


def tap(img, cx, cy, t, start, dur=0.6):
    """Two rings + a solid dot, fading out — reads as a finger tap at any scale."""
    for offset, alpha in ((0.0, 190), (0.12, 120)):
        k = (t - start - offset) / dur
        if 0 <= k <= 1:
            r = lerp(14, 96, ease_out(k))
            layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
            ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r],
                                          outline=(255, 255, 255, int(alpha * (1 - k))), width=6)
            img.paste(layer, (0, 0), layer)
    k = (t - start) / 0.25
    if 0 <= k <= 1:
        layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([cx - 16, cy - 16, cx + 16, cy + 16],
                                      fill=(255, 255, 255, int(150 * (1 - k))))
        img.paste(layer, (0, 0), layer)


# --------------------------------------------------------- text helpers ------


def wrap_runs(d, runs, f, maxw):
    """[(text, color)] -> lines of [(text, color)], wrapping on words."""
    words = []
    for text, color in runs:
        for i, w in enumerate(text.split(' ')):
            if w == '':
                continue
            words.append((w, color))
    lines, cur, cur_w = [], [], 0.0
    space = d.textlength(' ', font=f)
    for w, c in words:
        ww = d.textlength(w, font=f)
        if cur and cur_w + space + ww > maxw:
            lines.append(cur)
            cur, cur_w = [(w, c)], ww
        else:
            cur_w += (space if cur else 0) + ww
            cur.append((w, c))
    if cur:
        lines.append(cur)
    return lines


def draw_runs(d, xy, lines, f, line_h, align='left', maxw=None):
    x0, y0 = xy
    x, y = x0, y0
    for line in lines:
        text = ' '.join(w for w, _ in line)
        w = d.textlength(text, font=f)
        if align == 'center':
            x = x0 + (maxw - w) / 2
        else:
            x = x0
        for word, color in line:
            d.text((x, y), word, font=f, fill=color)
            x += d.textlength(word, font=f) + d.textlength(' ', font=f)
        y += line_h
    return y


# ----------------------------------------------------------------- chrome ----
TOTAL = 108.0


def chrome(img, t, step=None, brand='KISSA'):
    d = ImageDraw.Draw(img)
    # progress line
    w = int(W * clamp(t / TOTAL))
    d.rectangle([0, 0, W, 5], fill=(28, 30, 38))
    if w:
        d.rectangle([0, 0, w, 5], fill=ROSE)

    # wordmark
    d.text((56, 46), 'KISSA', font=P7(19), fill=(226, 226, 232))
    d.text((56 + tw(d, 'KISSA', P7(19)) + 10, 52), '·', font=P7(19), fill=ROSE)
    label = 'GEMINI API KEY'
    d.text((56 + tw(d, 'KISSA', P7(19)) + 26, 50), label, font=P5(12), fill=FAINT)

    if step:
        f = P6(12)
        txt = f'STEP {step}/6'
        ww = tw(d, txt, f) + 26
        rect(d, [W - 56 - ww, 42, W - 56, 74], 16, (30, 22, 27), (86, 48, 60), 1)
        d.text((W - 56 - ww + 13, 50), txt, font=f, fill=ROSE_L)
    else:
        f = P5(12)
        txt = 'TUTORIAL'
        ww = tw(d, txt, f) + 24
        rect(d, [W - 56 - ww, 42, W - 56, 74], 16, (26, 28, 36), (46, 49, 60), 1)
        d.text((W - 56 - ww + 12, 51), txt, font=f, fill=DIM)
    return img


def headline(img, y, lines, size=64, align='left', color=TEXT, x=64, accent=None, accent_color=ROSE_L):
    """Big statement text; `accent` is a substring of a line to colour."""
    d = ImageDraw.Draw(img)
    f = P8(size)
    for i, line in enumerate(lines):
        yy = y + i * int(size * 1.18)
        if accent and accent in line:
            pre, _, post = line.partition(accent)
            wpre = tw(d, pre, f)
            d.text((x, yy), pre, font=f, fill=color)
            d.text((x + wpre, yy), accent, font=f, fill=accent_color)
            d.text((x + wpre + tw(d, accent, f), yy), post, font=f, fill=color)
        else:
            d.text((x, yy), line, font=f, fill=color)
    return y + len(lines) * int(size * 1.18)


def caption(img, y, lines, size=38, x=64, maxw=W - 128, kicker_text=None, kicker_color=ROSE_L):
    """Bottom caption: manual lines with emphasis runs. lines = [[(text, color), ...], ...]"""
    d = ImageDraw.Draw(img)
    if kicker_text:
        kf = P6(15)
        d.text((x, y - 40), kicker_text, font=kf, fill=kicker_color)
    f = P5(size)
    for i, runs in enumerate(lines):
        draw_runs(d, (x, y + i * int(size * 1.36)), [runs], f, int(size * 1.36), maxw=maxw)


def footnote(img, y, text, color=FAINT, size=22, x=64):
    d = ImageDraw.Draw(img)
    d.text((x, y), text, font=P4(size), fill=color)
