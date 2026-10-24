"""Kissa — full setup tutorial. 1920x1080, 30 fps, ~7.5 min.

Real app screenshots (shots/raw, captured from the real app build + real
worker by shots/capture.mts) inside a phone frame; right panel shows the
chapter, a step list and Roman-Hinglish subtitles synced to the Hindi VO
(vo/*.mp3) via ffmpeg silencedetect. Website shots are real too; Android
install dialogs and the Groq console are drawn here as mockups.

    python3 build_tutorial.py [out.mp4]
    PREVIEW=1 python3 build_tutorial.py      -> contact sheet of every beat
    STILLS=12.5,80 python3 build_tutorial.py -> stills at those seconds
Needs: pillow numpy imageio-ffmpeg; fonts from ../ad2/fonts.
"""
import json
import math
import os
import re
import subprocess
import sys
import wave

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1920, 1080, 30
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
RAW = f'{HERE}/shots/raw'
FONTS = f'{HERE}/../ad2/fonts'
OUT = sys.argv[1] if len(sys.argv) > 1 else f'{HERE}/../kissa_tutorial_16x9.mp4'

BG = (7, 7, 11)
ROSE = (240, 86, 126)
ROSE_L = (245, 138, 165)
GOLD = (226, 190, 126)
TEXT = (246, 246, 249)
DIM = (170, 172, 184)
FAINT = (110, 114, 128)


def font(name, size):
    return ImageFont.truetype(f'{FONTS}/{name}.ttf', size)


PF9 = lambda s: font('PlayfairDisplay_900Black', s)
P4 = lambda s: font('Poppins_400Regular', s)
P5 = lambda s: font('Poppins_500Medium', s)
P6 = lambda s: font('Poppins_600SemiBold', s)
P7 = lambda s: font('Poppins_700Bold', s)
P8 = lambda s: font('Poppins_800ExtraBold', s)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_io(x):
    x = clamp(x)
    return 3 * x * x - 2 * x * x * x


def wrap(text, f, maxw):
    words, lines, cur = text.split(), [], ''
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def radial(size, center, radius, color, strength):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt((xx - center[0]) ** 2 + (yy - center[1]) ** 2) / radius
    a = np.clip(1 - d, 0, 1) ** 2.2 * strength
    return a[..., None] * np.array(color, np.float32)[None, None, :]


# ---------------------------------------------------------------- background
def make_bg():
    base = np.zeros((H, W, 3), np.float32) + np.array(BG, np.float32)
    base += radial((W, H), (480, 560), 760, (120, 30, 60), 0.55)
    base += radial((W, H), (1650, 80), 900, (70, 52, 26), 0.35)
    base += radial((W, H), (1300, 1100), 800, (30, 30, 60), 0.35)
    rng = np.random.default_rng(3)
    base += rng.normal(0, 1.6, (H, W, 1))
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))


BGI = make_bg()
ICON = Image.open(f'{REPO}/assets/icon.png').convert('RGB')


def rounded_mask(size, r):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), r, fill=255)
    return m


def icon(d):
    im = ICON.resize((d, d), Image.LANCZOS)
    out = Image.new('RGBA', (d, d), (0, 0, 0, 0))
    out.paste(im, (0, 0), rounded_mask((d, d), int(d * 0.23)))
    return out


# ---------------------------------------------------------------- phone frame
SW, SH = 434, 940
K = SW / 1030
PCX = 480
FW, FH = SW + 28, SH + 28
PX0, PY0 = PCX - FW // 2, (H - FH) // 2
SX, SY = PX0 + 14, PY0 + 14
SCREEN_MASK = rounded_mask((SW, SH), 40)


def make_phone_layer():
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((PX0 + 10, PY0 + 30, PX0 + FW + 10, PY0 + FH + 26), 60, fill=(0, 0, 0, 200))
    sh = sh.filter(ImageFilter.GaussianBlur(28))
    lay.alpha_composite(sh)
    d = ImageDraw.Draw(lay)
    d.rounded_rectangle((PX0, PY0, PX0 + FW, PY0 + FH), 56, fill=(20, 20, 26, 255), outline=(70, 70, 82, 255), width=2)
    d.rounded_rectangle((PX0 + 5, PY0 + 5, PX0 + FW - 5, PY0 + FH - 5), 52, outline=(36, 36, 44, 255), width=2)
    d.rounded_rectangle((PX0 + FW, PY0 + 190, PX0 + FW + 5, PY0 + 290), 2, fill=(46, 46, 56, 255))
    return lay


PHONE = make_phone_layer()

# ---------------------------------------------------------------- rects
RECTS = {}
if os.path.exists(f'{RAW}/_rects.json'):
    RECTS = json.load(open(f'{RAW}/_rects.json'))


def find_rect(shot, spec):
    """spec: str (exact text / '@aria' / '#placeholder'; trailing * = prefix),
    (str, idx) to choose among matches, list -> union, tuple of 4 ints -> raw."""
    if spec is None:
        return None
    if isinstance(spec, tuple) and len(spec) == 4 and all(isinstance(v, (int, float)) for v in spec):
        return spec
    if isinstance(spec, list):
        rs = [find_rect(shot, s) for s in spec]
        rs = [r for r in rs if r]
        if not rs:
            return None
        x0 = min(r[0] for r in rs); y0 = min(r[1] for r in rs)
        x1 = max(r[0] + r[2] for r in rs); y1 = max(r[1] + r[3] for r in rs)
        return (x0, y0, x1 - x0, y1 - y0)
    idx = 0
    if isinstance(spec, tuple):
        spec, idx = spec
    ents = RECTS.get(shot, [])
    if spec.endswith('*'):
        m = [e for e in ents if e['t'].startswith(spec[:-1])]
    else:
        m = [e for e in ents if e['t'] == spec]
        if not m:
            m = [e for e in ents if e['t'].startswith(spec)]
    if not m:
        print(f'  ! rect not found: {shot} :: {spec}')
        return None
    return tuple(m[idx]['r'])


# ---------------------------------------------------------------- mockups (1030x2230)
MW, MH = 1030, 2230


def status_bar(d, dark=True):
    c = (230, 230, 235) if dark else (30, 30, 30)
    d.text((56, 30), '9:41', font=P6(40), fill=c)
    x = MW - 70
    d.rounded_rectangle((x - 20, 40, x + 30, 66), 6, outline=c, width=3)
    d.rectangle((x - 16, 44, x + 18, 62), fill=c)
    for i in range(4):
        d.rectangle((x - 110 + i * 14, 66 - (i + 1) * 7, x - 102 + i * 14, 66), fill=c)
    d.pieslice((x - 190, 30, x - 130, 90), 225, 315, fill=c)


def chrome_bar(img, url):
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, MW, 250), fill=(32, 33, 36))
    status_bar(d)
    d.rounded_rectangle((40, 120, MW - 160, 220), 50, fill=(60, 64, 67))
    d.rounded_rectangle((78, 152, 104, 186), 4, outline=(200, 200, 205), width=4)
    d.arc((82, 134, 100, 162), 180, 360, fill=(200, 200, 205), width=4)
    d.text((130, 140), url, font=P5(44), fill=(232, 234, 237))
    d.rounded_rectangle((MW - 130, 140, MW - 74, 196), 10, outline=(232, 234, 237), width=4)
    d.text((MW - 112, 142), '2', font=P6(36), fill=(232, 234, 237))
    for i in range(3):
        d.ellipse((MW - 40, 146 + i * 18, MW - 30, 156 + i * 18), fill=(232, 234, 237))
    return (40, 120, MW - 200, 100)


def site_shot(name):
    im = Image.open(f'{RAW}/{name}.jpg').convert('RGB')
    out = Image.new('RGB', (MW, MH), (10, 8, 22))
    out.paste(im.crop((0, 0, MW, MH - 250)), (0, 250))
    url = chrome_bar(out, 'beyondredeye.site')
    return out, url


def dim(img, a=0.62):
    return Image.blend(img, Image.new('RGB', img.size, (0, 0, 0)), a)


def m_site():
    img, url = site_shot('00_site_top')
    # site shot rects are CSS*2.5 already; shift by the chrome bar
    btn = (50, 1384 + 250, 544, 148)
    RECTS['m_site'] = [{'t': 'url', 'r': list(url)}, {'t': 'download', 'r': list(btn)}]
    return img


def m_dl():
    img, url = site_shot('00_site_top')
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((30, MH - 330, MW - 30, MH - 60), 36, fill=(48, 50, 56))
    d.ellipse((70, MH - 270, 170, MH - 170), fill=(90, 160, 255))
    d.polygon([(120, MH - 190), (98, MH - 222), (142, MH - 222)], fill=(255, 255, 255))
    d.rectangle((113, MH - 252, 127, MH - 222), fill=(255, 255, 255))
    d.text((200, MH - 285), 'kissa-v2.11.1.apk', font=P6(44), fill=(240, 240, 245))
    d.text((200, MH - 222), 'Download complete · 98 MB', font=P4(36), fill=(190, 192, 200))
    d.text((MW - 220, MH - 260), 'Open', font=P7(48), fill=(138, 180, 248))
    RECTS['m_dl'] = [{'t': 'open', 'r': [MW - 250, MH - 290, 180, 110]}, {'t': 'bar', 'r': [30, MH - 330, MW - 60, 270]}]
    return img


def dialog(img, title, body, buttons, accent=(208, 188, 255)):
    img = dim(img, 0.6)
    d = ImageDraw.Draw(img)
    lines = wrap(body, P4(40), 760)
    h = 200 + len(lines) * 58 + 170
    y0 = (MH - h) // 2
    d.rounded_rectangle((90, y0, MW - 90, y0 + h), 56, fill=(43, 41, 48))
    d.text((150, y0 + 70), title, font=P6(52), fill=(236, 230, 240))
    for i, l in enumerate(lines):
        d.text((150, y0 + 170 + i * 58), l, font=P4(40), fill=(202, 196, 208))
    bx = MW - 150
    rects = {}
    for b in reversed(buttons):
        tw = d.textlength(b, font=P6(44))
        d.text((bx - tw, y0 + h - 120), b, font=P6(44), fill=accent)
        rects[b] = [int(bx - tw - 30), y0 + h - 140, int(tw + 60), 100]
        bx -= tw + 90
    return img, rects


def m_unknown():
    img, _ = site_shot('00_site_top')
    img, r = dialog(img, 'Install blocked', 'For your security, your phone currently isn\'t allowed to install unknown apps from this source. You can change this in Settings.', ['Cancel', 'Settings'])
    RECTS['m_unknown'] = [{'t': k, 'r': v} for k, v in r.items()]
    return img


def m_allow():
    img = Image.new('RGB', (MW, MH), (18, 18, 22))
    d = ImageDraw.Draw(img)
    status_bar(d)
    d.line((70, 200, 110, 160), fill=(230, 230, 235), width=6)
    d.line((70, 200, 110, 240), fill=(230, 230, 235), width=6)
    d.text((70, 300), 'Install unknown apps', font=P5(76), fill=(236, 236, 240))
    d.ellipse((70, 520, 200, 650), fill=(255, 255, 255))
    for i, c in enumerate([(219, 68, 55), (244, 180, 0), (15, 157, 88)]):
        d.pieslice((82, 532, 188, 638), 90 + i * 120, 210 + i * 120, fill=c)
    d.ellipse((112, 562, 158, 608), fill=(66, 133, 244), outline=(255, 255, 255), width=6)
    d.text((240, 535), 'Chrome', font=P6(54), fill=(236, 236, 240))
    d.text((240, 605), '131.0.6778', font=P4(38), fill=(160, 160, 170))
    d.rounded_rectangle((50, 760, MW - 50, 940), 40, fill=(34, 34, 40))
    d.text((100, 818), 'Allow from this source', font=P5(48), fill=(236, 236, 240))
    d.rounded_rectangle((MW - 250, 805, MW - 100, 895), 45, fill=(208, 188, 255))
    d.ellipse((MW - 182, 813, MW - 108, 887), fill=(56, 30, 114))
    d.text((70, 1010), 'Your phone and personal data are more vulnerable to attack by unknown apps.', font=P4(36), fill=(150, 150, 160))
    lines = wrap('Your phone and personal data are more vulnerable to attack by unknown apps. By installing apps from this source, you agree that you are responsible for any damage.', P4(38), 880)
    d.rectangle((60, 1000, MW, 1080), fill=(18, 18, 22))
    for i, l in enumerate(lines):
        d.text((70, 1010 + i * 56), l, font=P4(38), fill=(150, 150, 160))
    RECTS['m_allow'] = [{'t': 'toggle', 'r': [50, 760, MW - 100, 180]}]
    return img


def m_install():
    img, _ = site_shot('00_site_top')
    img = dim(img, 0.6)
    d = ImageDraw.Draw(img)
    y0 = MH - 760
    d.rounded_rectangle((0, y0, MW, MH + 80), 64, fill=(43, 41, 48))
    d.rounded_rectangle((MW // 2 - 60, y0 + 30, MW // 2 + 60, y0 + 42), 6, fill=(110, 106, 118))
    img.paste(icon(170).convert('RGB'), (90, y0 + 120), icon(170))
    d.text((300, y0 + 150), 'Kissa', font=P6(64), fill=(236, 230, 240))
    d.text((300, y0 + 236), 'v2.11.1', font=P4(40), fill=(180, 176, 188))
    d.text((90, y0 + 360), 'Do you want to install this app?', font=P4(46), fill=(220, 214, 226))
    d.rounded_rectangle((90, y0 + 520, 480, y0 + 640), 60, outline=(147, 143, 153), width=3)
    d.text((222, y0 + 548), 'Cancel', font=P6(46), fill=(208, 188, 255))
    d.rounded_rectangle((540, y0 + 520, MW - 90, y0 + 640), 60, fill=(208, 188, 255))
    d.text((672, y0 + 548), 'Install', font=P6(46), fill=(56, 30, 114))
    RECTS['m_install'] = [{'t': 'install', 'r': [540, y0 + 520, MW - 630, 120]}]
    return img


def m_done():
    img, _ = site_shot('00_site_top')
    img = dim(img, 0.6)
    d = ImageDraw.Draw(img)
    y0 = MH - 760
    d.rounded_rectangle((0, y0, MW, MH + 80), 64, fill=(43, 41, 48))
    img.paste(icon(170).convert('RGB'), (90, y0 + 120), icon(170))
    d.text((300, y0 + 150), 'Kissa', font=P6(64), fill=(236, 230, 240))
    d.ellipse((90, y0 + 380, 150, y0 + 440), fill=(120, 220, 150))
    d.line((105, y0 + 412, 117, y0 + 425), fill=(20, 60, 30), width=7)
    d.line((117, y0 + 425, 138, y0 + 396), fill=(20, 60, 30), width=7)
    d.text((180, y0 + 380), 'App installed.', font=P5(48), fill=(220, 214, 226))
    d.rounded_rectangle((90, y0 + 520, 480, y0 + 640), 60, outline=(147, 143, 153), width=3)
    d.text((228, y0 + 548), 'Done', font=P6(46), fill=(208, 188, 255))
    d.rounded_rectangle((540, y0 + 520, MW - 90, y0 + 640), 60, fill=(208, 188, 255))
    d.text((690, y0 + 548), 'Open', font=P6(46), fill=(56, 30, 114))
    RECTS['m_done'] = [{'t': 'open', 'r': [540, y0 + 520, MW - 630, 120]}]
    return img


GQ = (245, 80, 54)


def groq_page(url='console.groq.com'):
    img = Image.new('RGB', (MW, MH), (250, 250, 249))
    u = chrome_bar(img, url)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 250, MW, 400), fill=(255, 255, 255))
    d.line((0, 400, MW, 400), fill=(228, 228, 226), width=3)
    d.rounded_rectangle((60, 290, 130, 360), 18, fill=GQ)
    d.text((80, 286), 'g', font=P8(56), fill=(255, 255, 255))
    d.text((150, 292), 'GroqCloud', font=P7(52), fill=(20, 20, 20))
    for i in range(3):
        d.rectangle((MW - 120, 300 + i * 22, MW - 60, 308 + i * 22), fill=(40, 40, 40))
    return img, d, u


def m_groq_login():
    img, d, u = groq_page('console.groq.com/login')
    d.text((80, 560), 'Welcome to', font=P5(56), fill=(90, 90, 90))
    d.text((80, 640), 'GroqCloud', font=P8(110), fill=(20, 20, 20))
    d.text((80, 800), 'Fast AI inference. Free tier ke saath.', font=P4(42), fill=(110, 110, 110))
    d.rounded_rectangle((80, 980, MW - 80, 1120), 70, fill=(255, 255, 255), outline=(210, 210, 208), width=3)
    for i, c in enumerate([(66, 133, 244), (52, 168, 83), (251, 188, 5), (234, 67, 53)]):
        d.pieslice((180, 1010, 260, 1090), i * 90, i * 90 + 90, fill=c)
    d.ellipse((200, 1030, 240, 1070), fill=(255, 255, 255))
    d.text((300, 1022), 'Continue with Google', font=P6(48), fill=(30, 30, 30))
    d.rounded_rectangle((80, 1160, MW - 80, 1300), 70, fill=(255, 255, 255), outline=(210, 210, 208), width=3)
    d.text((340, 1202), 'Continue with GitHub', font=P5(46), fill=(60, 60, 60))
    d.text((80, 1400), 'Email', font=P5(40), fill=(110, 110, 110))
    d.rounded_rectangle((80, 1460, MW - 80, 1580), 26, fill=(255, 255, 255), outline=(210, 210, 208), width=3)
    RECTS['m_groq_login'] = [{'t': 'url', 'r': list(u)}, {'t': 'google', 'r': [80, 980, MW - 160, 140]}]
    return img


def keys_page(d):
    d.text((80, 470), 'API Keys', font=P7(80), fill=(20, 20, 20))
    lines = wrap('Manage your project API keys. Keys aapke account se jude hote hain — inhe secret rakhein.', P4(40), 870)
    for i, l in enumerate(lines):
        d.text((80, 590 + i * 56), l, font=P4(40), fill=(110, 110, 110))
    d.rounded_rectangle((80, 780, 600, 900), 24, fill=GQ)
    d.text((140, 808), '+  Create API Key', font=P6(46), fill=(255, 255, 255))
    d.rounded_rectangle((80, 980, MW - 80, 1400), 30, fill=(255, 255, 255), outline=(228, 228, 226), width=3)
    d.text((130, 1150), 'Abhi koi API key nahi hai.', font=P4(42), fill=(140, 140, 140))


def m_groq_keys():
    img, d, u = groq_page('console.groq.com/keys')
    keys_page(d)
    RECTS['m_groq_keys'] = [{'t': 'create', 'r': [80, 780, 520, 120]}, {'t': 'url', 'r': list(u)}]
    return img


def m_groq_create():
    img, d, u = groq_page('console.groq.com/keys')
    keys_page(d)
    img = dim(img, 0.45)
    d = ImageDraw.Draw(img)
    y0 = 760
    d.rounded_rectangle((60, y0, MW - 60, y0 + 700), 36, fill=(255, 255, 255))
    d.text((120, y0 + 70), 'Create API Key', font=P7(60), fill=(20, 20, 20))
    d.text((120, y0 + 200), 'Display name', font=P5(40), fill=(90, 90, 90))
    d.rounded_rectangle((120, y0 + 260, MW - 120, y0 + 380), 22, fill=(255, 255, 255), outline=GQ, width=4)
    d.text((160, y0 + 290), 'kissa', font=P5(46), fill=(20, 20, 20))
    d.rounded_rectangle((MW - 420, y0 + 520, MW - 120, y0 + 630), 22, fill=GQ)
    d.text((MW - 340, y0 + 544), 'Submit', font=P6(46), fill=(255, 255, 255))
    d.text((150, y0 + 545), 'Cancel', font=P5(46), fill=(90, 90, 90))
    RECTS['m_groq_create'] = [{'t': 'name', 'r': [120, y0 + 260, MW - 240, 120]}, {'t': 'submit', 'r': [MW - 420, y0 + 520, 300, 110]}]
    return img


def m_groq_key():
    img, d, u = groq_page('console.groq.com/keys')
    keys_page(d)
    img = dim(img, 0.45)
    d = ImageDraw.Draw(img)
    y0 = 700
    d.rounded_rectangle((60, y0, MW - 60, y0 + 860), 36, fill=(255, 255, 255))
    d.text((120, y0 + 70), 'Your new API key', font=P7(60), fill=(20, 20, 20))
    lines = wrap('Is key ko abhi copy kar lijiye — ye dobara poori nahi dikhegi. Kisi ke saath share na karein.', P4(40), 790)
    for i, l in enumerate(lines):
        d.text((120, y0 + 180 + i * 56), l, font=P4(40), fill=(120, 60, 40))
    ky = y0 + 200 + len(lines) * 56 + 40
    d.rounded_rectangle((120, ky, MW - 120, ky + 130), 22, fill=(245, 245, 243), outline=(220, 220, 218), width=3)
    d.text((160, ky + 36), 'gsk_7fQ2xLm9RtVb4KpZ8nWc3…', font=P5(44), fill=(30, 30, 30))
    d.rounded_rectangle((MW - 420, ky + 200, MW - 120, ky + 310), 22, fill=GQ)
    d.rounded_rectangle((MW - 380, ky + 228, MW - 340, ky + 276), 6, outline=(255, 255, 255), width=4)
    d.rounded_rectangle((MW - 366, ky + 240, MW - 326, ky + 288), 6, outline=(255, 255, 255), width=4, fill=GQ)
    d.text((MW - 300, ky + 224), 'Copy', font=P6(46), fill=(255, 255, 255))
    d.text((150, ky + 225), 'Done', font=P5(46), fill=(90, 90, 90))
    RECTS['m_groq_key'] = [{'t': 'key', 'r': [120, ky, MW - 240, 130]}, {'t': 'copy', 'r': [MW - 420, ky + 200, 300, 110]},
                           {'t': 'warn', 'r': [110, y0 + 170, MW - 220, len(lines) * 56 + 20]}]
    return img


MOCKS = {f.__name__: f for f in [m_site, m_dl, m_unknown, m_allow, m_install, m_done, m_groq_login, m_groq_keys, m_groq_create, m_groq_key]}
_SHOT = {}


def shot_img(name):
    if name not in _SHOT:
        if name in MOCKS:
            im = MOCKS[name]()
        else:
            im = Image.open(f'{RAW}/{name}.jpg').convert('RGB')
        _SHOT[name] = im
    return _SHOT[name]


def screen_img(name):
    key = ('scr', name)
    if key not in _SHOT:
        _SHOT[key] = shot_img(name).resize((SW, SH), Image.LANCZOS)
    return _SHOT[key]


# ---------------------------------------------------------------- script
# beat = dict(s=subtitle, shot=..., hl=spec, step=label, tap=bool, gap=sec)
def B(s, shot, hl=None, step=None, tap=False, gap=None, end=False):
    return dict(s=s, shot=shot, hl=hl, step=step, tap=tap, gap=gap, end=end)


CHAPTERS = [
    dict(id='c01_intro', title='Kissa · Poora Setup Guide', kind='intro', beats=[
        B('Namaste dosto! Aaj ke is video mein hum Kissa app ko shuru se aakhir tak setup karna seekhenge.', '05_home'),
        B('Kissa ek interactive story app hai — jahan kahani aap sirf padhte nahi, jeete hain.', '23_detail_top'),
        B('Har mod par faisla aapka hota hai, aur kahani ke kirdaar seedhe aapse baat karte hain.', '32_chat_reply1'),
        B('Na koi login, na coins, na message limit.', '32_chat_reply1'),
        B('Toh chaliye, download se lekar pehli kahani tak — sab kuch step by step dekhte hain.', '05_home', gap=0.6),
    ]),
    dict(id='c02_download', title='Download & Install', sub='beyondredeye.site se APK', beats=[
        B('Sabse pehle apne phone ke browser mein kholiye — beyondredeye.site.', 'm_site', 'url', 'beyondredeye.site kholo', gap=0.5),
        B('Yahan Download ka button dabaiye, aur Kissa ki APK file download ho jaayegi.', 'm_site', 'download', 'DOWNLOAD APK dabao', tap=True, gap=0.5),
        B('File kholte hi agar Android permission maange,', 'm_dl', 'open', 'APK file kholo', tap=True),
        B('toh Settings mein jaakar "Allow from this source" chaalu kar dijiye.', 'm_unknown', 'Settings', None, tap=True),
        B('"Allow from this source" — ON.', 'm_allow', 'toggle', 'Allow from this source: ON', gap=0.7),
        B('Phir Install dabaiye.', 'm_install', 'install', 'Install dabao', tap=True, gap=0.8),
        B('Bas — kuch hi second mein Kissa aapke phone mein aa jaayega.', 'm_done', 'open', 'Open'),
        B('App bilkul free hai, aur naya version aane par app khud bata dega.', '01_name_empty', gap=0.4),
    ]),
    dict(id='c03_onboarding', title='Pehli baar kholna', sub='Naam + umar — bas do sawaal', beats=[
        B('App kholte hi Kissa aapse bas do cheezein poochta hai.', '01_name_empty'),
        B('Pehla — aapka naam.', '01_name_empty', '#Nickname — e.g. Rahul', 'Apna naam likho'),
        B('Yahi naam kahani ke kirdaar aapko bulaane mein istemaal karenge,', '02_name_typed', '#Nickname — e.g. Rahul'),
        B('toh jo naam pasand ho wahi likhiye, aur Continue dabaiye.', '02_name_typed', '@Continue', 'Continue', tap=True, gap=0.5),
        B('Doosra — aapki umar.', '03_age', ['@12–17', '@18+'], 'Umar chuno'),
        B('Baarah se satrah saal waalon ko sirf teen-safe kahaniyan dikhti hain,', '03_age', '@12–17'),
        B('aur atharah plus waalon ko poora catalog.', '04_age_selected', '@18+'),
        B('Get Started dabaiye — aur aap seedhe Home screen par hain.', '04_age_selected', '@Get Started', 'Get Started', tap=True, gap=0.6),
        B('Ye saari jaankari sirf aapke phone mein rehti hai.', '05_home', None, 'Home ready', gap=0.5),
    ]),
    dict(id='c04_groq', title='AI key banana', sub='Groq — free API key', beats=[
        B('Ab sabse zaroori step — AI setup.', '10_settings_top', 'Connect your own AI provider'),
        B('Kissa mein kahani ke kirdaar AI ki madad se baat karte hain, aur iske liye aapko apni ek API key chahiye.', '10_settings_top', 'Connect your own AI provider', 'Apni API key chahiye'),
        B('Sabse aasaan aur free tareeka hai Groq.', 'm_groq_login', None, 'Groq — free'),
        B('Browser mein console.groq.com kholiye, aur Google se sign in kijiye.', 'm_groq_login', 'google', 'console.groq.com par sign in', tap=True, gap=0.6),
        B('Phir API Keys waale section mein jaakar Create API Key dabaiye.', 'm_groq_keys', 'create', 'Create API Key', tap=True, gap=0.5),
        B('Key ko koi bhi naam dijiye, Submit kijiye,', 'm_groq_create', 'submit', 'Naam do, Submit', tap=True, gap=0.4),
        B('aur jo lambi key dikhe use copy kar lijiye.', 'm_groq_key', 'copy', 'Key copy karo', tap=True, gap=0.6),
        B('Dhyaan rahe — ye key kisi ke saath share mat kijiye.', 'm_groq_key', 'warn', 'Key secret rakho', gap=0.5),
    ]),
    dict(id='c05_provider', title='Key ko app mein lagana', sub='You › AI Setup › Groq', beats=[
        B('Ab Kissa mein wapas aaiye.', '05_home', '@Profile and Settings', None, tap=True),
        B('Neeche You waala tab kholiye, aur "Connect your own AI provider" waale card par tap kijiye.', '10_settings_top', 'Connect your own AI provider', 'You › AI card', tap=True, gap=0.4),
        B('Phir Add AI Provider dabaiye.', '11_ai_setup_empty', ('@+ Add AI Provider', -1), 'Add AI Provider', tap=True, gap=0.5),
        B('Upar presets mein Groq chuniye —', '12_editor_blank', ('Groq', 0), 'Groq preset', tap=True),
        B('Base URL aur Model apne aap bhar jaayenge.', '13_editor_groq', ['@Base URL', '@Model'], None, gap=0.4),
        B('Neeche API Key waale box mein apni copy ki hui key paste kijiye.', '14_editor_key', '@API Key', 'Key paste karo', gap=0.5),
        B('Ab Test Connection dabaiye —', '14_editor_key', '@Test Connection', 'Test Connection', tap=True),
        B('hara Connected dikhe, matlab sab sahi hai.', '15_test_ok', 'Connected!*', None, gap=0.6),
        B('Phir Save Provider dabaiye.', '15_test_ok', '@Save Provider', 'Save Provider', tap=True, gap=0.5),
        B('Aapki key encrypted hokar sirf aapke phone mein rehti hai, hamare server par kabhi nahi jaati.', '16_provider_saved', ['Groq', 'https://api.groq.com/openai/v1'], 'AI ready', gap=0.6),
    ]),
    dict(id='c06_discover', title='Kahani chunna', sub='Home · Explore · Story page', beats=[
        B('Ab kahani chunte hain.', '05_home'),
        B('Home par sabse upar featured kahaniyan hain,', '05_home', '@Arranged Marriage Wala Love. Ek chai*', 'Featured'),
        B('neeche is hafte ka Top 10,', '06_home_top10', None, 'Top 10'),
        B('aur genre ke hisaab se alag-alag rows.', '07_home_more', None, 'Genre rows'),
        B('Explore tab mein poora catalog hai —', '20_explore', '@Explore shows', 'Explore', tap=True),
        B('genre waale chips se filter kijiye, ya search kijiye.', '22_explore_genre', ('Action', 0), 'Filter / search'),
        B('Kisi bhi kahani par tap karte hi uska poora page khulta hai —', '20_explore', '@Biwi Ek Supari Killer', 'Story page', tap=True),
        B('kahani ka premise, aap kaun hain,', '23_detail_top'),
        B('kahani ke kirdaar,', '24_detail_cast', 'Cast'),
        B('tasveeron ki gallery,', '25_detail_media', ['@View Chhaya at the Docks', '@View Cutting Chai on the Balcony']),
        B('aur ye kahani kisne banayi.', '26_detail_creator', ['Story Creator', 'Kissa creator']),
        B('Pasand aaye, toh Start Story dabaiye.', '23_detail_top', '@Start Story', 'Start Story', tap=True, gap=0.6),
    ]),
    dict(id='c07_chat', title='Kahani khelna', sub='Chat · chips · apna move', beats=[
        B('Aur yahi hai Kissa ka asli mazaa.', '30_chat_open'),
        B('Kahani ek chat ki tarah chalti hai — har kirdaar ka apna bubble, upar uska naam, aur halke italic mein narration.', '30_chat_open', None, 'Chat bubbles'),
        B('Shuruaat mein neeche kuch chips milte hain —', '30_chat_open', ['@Promise poora karo', '@Phone ka sawaal'], 'Chips'),
        B('kisi par bhi tap kijiye,', '30_chat_open', '@Promise poora karo', None, tap=True),
        B('...', '31_chat_thinking', None, None, gap=0.3),
        B('ya khud apna move likhiye, jo mann kare.', '33_chat_typing', '#Write your next move…', 'Apna move likho'),
        B('Send dabaate hi kahani aage badhti hai,', '33_chat_typing', '@Send', 'Send', tap=True),
        B('aur kirdaar aapki baat ka jawaab dete hain.', '34_chat_reply2', None, None, gap=0.5),
        B('Koi tay script nahi hai —', '32_chat_reply1', None, 'Koi fixed script nahi'),
        B('kahani kahan jaayegi, ye sirf aur sirf aapke faisle tay karte hain.', '34_chat_reply2', None, None, gap=0.6),
    ]),
    dict(id='c08_actions', title='Story actions, Library & Saves', sub='Regenerate · naya mod · resume', beats=[
        B('Send ke bagal waala button story actions kholta hai.', '34_chat_reply2', '@Story actions', 'Story actions', tap=True),
        B('Choices dikhao — agle move ke ideas deta hai.', '35_chat_actions', '@Choices dikhao', 'Choices dikhao'),
        B('Regenerate — pichhle jawaab ka doosra version.', '35_chat_actions', '@Regenerate', 'Regenerate'),
        B('Naya mod — kahani mein naya twist.', '35_chat_actions', '@Naya mod', 'Naya mod'),
        B('Aur Continue — bina kuch likhe kahani aage badhata hai.', '35_chat_actions', '@Continue', 'Continue', gap=0.4),
        B('Kahani beech mein chhod di? Koi baat nahi.', '40_library'),
        B('Library tab mein aapki saari chal rahi kahaniyan milengi — ek tap mein wahin se aage padhiye.', '40_library', '@Continue Biwi Ek Supari Killer', 'Library se resume'),
        B('Aur story page par Saves mein aapki har journey alag se save rehti hai.', '42_saves', '@First journey, in progress', 'Saves', gap=0.6),
    ]),
    dict(id='c09_submit', title='Apna idea bhejna', sub='24 ghante mein review · creator credit', beats=[
        B('Agar aapke dimaag mein bhi koi kahani hai, toh neeche beech waala plus button dabaiye.', '05_home', '@Create a story', '+ button', tap=True),
        B('Suggest an Idea mein', '54_idea_blank', None, None),
        B('kahani ka naam, genre, aur concept likhiye,', '55_idea_filled', ['#Title of your story concept', '#What is the story premise? What role does the player have?'], 'Naam, genre, concept'),
        B('aur Send Idea dabaiye.', '56_idea_bottom', '@Send Idea', 'Send Idea', tap=True, gap=0.5),
        B('Hamari team chaubees ghante ke andar use review karti hai.', '57_idea_success', ['Review Window', 'Expires in*'], '24h review'),
        B('Aur agar aapke idea se kahani banti hai, toh app mein creator ke taur par aapka naam dikhega.', '57_idea_success', ['Creator', ('Rahul', 0)], 'Creator credit: aapka naam'),
        B('Poori kahani likhi hai, toh Full Story waale tab se bhejiye,', '52_story_form', 'Full Story', 'Full Story'),
        B('aur My Submissions mein apna status dekhte rahiye.', '59_my_submissions_pending', 'Recent Submissions', 'My Submissions', gap=0.6),
    ]),
    dict(id='c10_settings', title='Settings', sub='Look · sound · lock · backup', beats=[
        B('Ab Settings ki ek jhalak.', '17_settings_after'),
        B('Theme and Typography mein do UI templates hain — naya Kissa Noir,', '60_appearance', '@Kissa Noir template', '2 UI templates'),
        B('aur purana Kissa Night —', '70_appearance_night', '@Kissa Night template'),
        B('jo pasand ho chuniye,', '71_home_night'),
        B('saath mein text ka size bhi.', '61_appearance_more', 'Typography Scale*', 'Text size'),
        B('Sound and Haptics mein message sounds aur ambient music.', '62_sound', None, 'Sound & Haptics'),
        B('Reminders mein roz ka reminder aur nayi kahaniyon ki khabar.', '63_reminders', None, 'Reminders'),
        B('App Lock se PIN lagaiye, taaki aapki kahaniyan koi aur na padhe.', '64_applock', '@App Lock', 'App Lock'),
        B('Storage and Backup se apna poora data encrypted backup mein export kijiye.', '65_storage', '@Export Encrypted Backup', 'Backup'),
        B('Aur naya version aate hi Home par apne aap update banner dikhega.', '66_about', '@Update banner on Home', 'Update banner', gap=0.5),
        B('Bas dosto, itna hi!', None, end=True),
        B('Nayi kahaniyan bina app update ke apne aap aati rehti hain.', None, end=True),
        B('Toh abhi beyondredeye.site se Kissa download kijiye, aur apni pehli kahani shuru kijiye.', None, end=True),
        B('Milte hain agli kahani mein!', None, end=True, gap=4.0),
    ]),
]
AGENDA = ['Download & install', 'Pehli baar kholna', 'AI key banana (Groq)', 'Key app mein lagana', 'Kahani chunna',
          'Chat mein kahani khelna', 'Actions, Library & Saves', 'Apna idea bhejna', 'Settings']


# ---------------------------------------------------------------- audio timing
def dur_of(path):
    o = subprocess.run([FF, '-i', path], capture_output=True, text=True).stderr
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', o)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])


def silences(path):
    o = subprocess.run([FF, '-i', path, '-af', 'silencedetect=noise=-34dB:d=0.16', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', o)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', o)]
    return [((a + b) / 2, b - a) for a, b in zip(st, en)]


def plan_chapter(ch):
    path = f'{HERE}/vo/{ch["id"]}.mp3'
    D = dur_of(path)
    sil = silences(path)
    mids = [m for m, w in sil if 0.15 < m < D - 0.15]
    # speech start/end
    head = sil[0][0] + sil[0][1] / 2 if sil and sil[0][0] < 0.2 else 0.0
    tail = D
    if sil and sil[-1][0] + sil[-1][1] / 2 > D - 0.25:
        tail = sil[-1][0] - sil[-1][1] / 2
        mids = [m for m in mids if m < tail - 0.1]
    spoken = [b for b in ch['beats'] if not b['s'].startswith('...')]
    weights = [max(len(b['s']), 6) for b in spoken]
    tot = sum(weights)
    bounds = [head]
    acc = 0
    used = set()
    for w in weights[:-1]:
        acc += w
        est = head + (tail - head) * acc / tot
        cands = [m for m in mids if m > bounds[-1] + 0.4 and m not in used]
        best = min(cands, key=lambda m: abs(m - est)) if cands else None
        if best is not None and abs(best - est) < 1.8:
            used.add(best)
            bounds.append(best)
        else:
            bounds.append(max(est, bounds[-1] + 0.4))
    bounds.append(D)
    segs = list(zip(bounds[:-1], bounds[1:]))
    out, i = [], 0
    for b in ch['beats']:
        if b['s'].startswith('...'):
            out.append(None)
        else:
            out.append(segs[i])
            i += 1
    return path, out


DEFAULT_GAP = float(os.environ.get('GAP', '0.55'))
CARD_D = 3.2
TITLE_D = 4.6
LEAD = 0.35
XF_BEAT, XF_CH = 0.3, 0.5

TL = []          # timeline items
VO_PLACE = []    # (path, a, b, at)
TAPS = []        # times for click sfx
CARDS_AT = []
t = 0.0
TL.append(dict(kind='title', start=t, dur=TITLE_D))
t += TITLE_D
for ci, ch in enumerate(CHAPTERS):
    if ch.get('kind') != 'intro':
        TL.append(dict(kind='card', ch=ci, start=t, dur=CARD_D))
        CARDS_AT.append(t)
        t += CARD_D
    path, segs = plan_chapter(ch)
    for bi, (b, seg) in enumerate(zip(ch['beats'], segs)):
        lead = LEAD if bi == 0 else 0.0
        gap = b['gap'] if b['gap'] is not None else DEFAULT_GAP
        if seg is None:
            d = 1.3 + gap
        else:
            d = lead + (seg[1] - seg[0]) + gap
            VO_PLACE.append((path, seg[0], seg[1], t + lead))
        TL.append(dict(kind='beat', ch=ci, bi=bi, start=t, dur=d))
        if b['tap']:
            TAPS.append(t + d - 0.5)
        t += d
TOTAL = t
print(f'TOTAL {TOTAL:.1f}s = {TOTAL / 60:.2f} min, {len(TL)} items')


# ---------------------------------------------------------------- drawing
def screen_rect_to_frame(r):
    x, y, w, h = r
    return (SX + x * K, SY + y * K, SX + (x + w) * K, SY + (y + h) * K)


def draw_text(d, xy, txt, f, fill, anchor='la'):
    d.text(xy, txt, font=f, fill=fill, anchor=anchor)


def steps_of(ch, upto):
    seen = []
    for b in ch['beats'][:upto + 1]:
        if b['step'] and b['step'] not in seen:
            seen.append(b['step'])
    cur = None
    for b in ch['beats'][:upto + 1]:
        if b['step']:
            cur = b['step']
    return seen, cur


def chapter_num(ci):
    return ci  # intro is 0


def panel(img, ci, bi, beat):
    ch = CHAPTERS[ci]
    d = ImageDraw.Draw(img)
    x0 = 930
    if ch.get('kind') == 'intro':
        draw_text(d, (x0, 118), 'KISSA TUTORIAL', P6(26), GOLD)
        draw_text(d, (x0, 160), 'Aaj kya seekhenge?', P7(60), TEXT)
        d.rounded_rectangle((x0, 250, x0 + 90, 256), 3, fill=ROSE)
        return
    draw_text(d, (x0, 118), f'CHAPTER {chapter_num(ci)} / {len(CHAPTERS) - 1}', P6(26), GOLD)
    lines = wrap(ch['title'], P7(60), 900)
    y = 160
    for l in lines:
        draw_text(d, (x0, y), l, P7(60), TEXT)
        y += 74
    d.rounded_rectangle((x0, y + 16, x0 + 90, y + 22), 3, fill=ROSE)
    seen, cur = steps_of(ch, bi)
    seen = seen[-6:]
    sy = y + 62
    for i, s in enumerate(seen):
        n = (len(steps_of(ch, bi)[0]) - len(seen)) + i + 1
        active = s == cur
        ry = sy + i * 76
        if active:
            d.rounded_rectangle((x0 - 18, ry - 12, x0 + 880, ry + 58), 20, fill=(40, 22, 32), outline=(110, 40, 66), width=2)
            d.ellipse((x0, ry, x0 + 46, ry + 46), fill=ROSE)
            draw_text(d, (x0 + 23, ry + 23), str(n), P7(24), (255, 255, 255), 'mm')
            draw_text(d, (x0 + 70, ry + 23), s, P6(32), TEXT, 'lm')
        else:
            d.ellipse((x0, ry, x0 + 46, ry + 46), outline=(80, 82, 96), width=3)
            draw_text(d, (x0 + 23, ry + 23), str(n), P6(22), DIM, 'mm')
            draw_text(d, (x0 + 70, ry + 23), s, P5(30), DIM, 'lm')


def subtitle(img, txt, center=False):
    if not txt or txt.startswith('...'):
        return
    d = ImageDraw.Draw(img, 'RGBA')
    f = P5(32)
    if center:
        lines = wrap(txt, f, 1400)
        y0 = 940 - (len(lines) - 1) * 46
        for i, l in enumerate(lines):
            draw_text(d, (W // 2, y0 + i * 46), l, f, TEXT, 'mm')
        return
    x0, y0, x1, y1 = 912, 836, 1856, 1010
    lines = wrap(txt, f, x1 - x0 - 80)[:3]
    d.rounded_rectangle((x0, y0, x1, y1), 26, fill=(255, 255, 255, 10), outline=(255, 255, 255, 26), width=2)
    d.rounded_rectangle((x0 + 26, y0 + 30, x0 + 32, y1 - 30), 3, fill=ROSE + (255,))
    th = len(lines) * 46
    ty = (y0 + y1) // 2 - th // 2 + 23
    for i, l in enumerate(lines):
        draw_text(d, (x0 + 56, ty + i * 46), l, f, TEXT, 'lm')


def phone_with(img, shot, hl_rect):
    scr = screen_img(shot).copy()
    if hl_rect:
        x, y, w, h = hl_rect
        pad = 14
        bx = (x * K - pad / 2, y * K - pad / 2, (x + w) * K + pad / 2, (y + h) * K + pad / 2)
        m = Image.new('L', (SW, SH), 120)
        ImageDraw.Draw(m).rounded_rectangle(bx, 16, fill=0)
        m = m.filter(ImageFilter.GaussianBlur(3))
        scr.paste((0, 0, 0), (0, 0), m)
    base = img.convert('RGBA')
    base.alpha_composite(PHONE)
    base = base.convert('RGB')
    base.paste(scr, (SX, SY), SCREEN_MASK)
    # camera pill
    ImageDraw.Draw(base).ellipse((SX + SW // 2 - 9, SY + 12, SX + SW // 2 + 9, SY + 30), fill=(8, 8, 10))
    return base


def glow_layer(hl_rect):
    x0, y0, x1, y1 = screen_rect_to_frame(hl_rect)
    pad = 7
    box = (x0 - pad, y0 - pad, x1 + pad, y1 + pad)
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(lay).rounded_rectangle(box, 16, outline=ROSE + (255,), width=10)
    glow = lay.filter(ImageFilter.GaussianBlur(10))
    sharp = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sharp).rounded_rectangle(box, 16, outline=(255, 160, 185, 255), width=4)
    bb = (int(max(0, box[0] - 40)), int(max(0, box[1] - 40)), int(min(W, box[2] + 40)), int(min(H, box[3] + 40)))
    return glow.crop(bb), sharp.crop(bb), bb


def card_frame(ci, lt):
    key = ('cardbg', ci)
    ch = CHAPTERS[ci]
    if key not in _SHOT:
        first = next(b['shot'] for b in ch['beats'] if b['shot'])
        im = shot_img(first).resize((W, int(W * 2230 / 1030)), Image.LANCZOS)
        y = (im.height - H) // 3
        im = im.crop((0, y, W, y + H)).filter(ImageFilter.GaussianBlur(28))
        im = Image.blend(im, Image.new('RGB', (W, H), BG), 0.78)
        _SHOT[key] = im
    img = _SHOT[key].copy()
    d = ImageDraw.Draw(img, 'RGBA')
    p = ease_out(lt / 0.8)
    num = f'{chapter_num(ci):02d}'
    a = int(255 * p)
    d.text((300 - 60 * (1 - p), H // 2), num, font=PF9(300), fill=ROSE + (a,), anchor='lm')
    p2 = ease_out((lt - 0.25) / 0.7)
    d.text((760, H // 2 - 70 + 30 * (1 - p2)), 'CHAPTER ' + str(chapter_num(ci)), font=P6(32), fill=GOLD + (int(255 * p2),), anchor='lm')
    fs = 80
    while fs > 44 and d.textlength(ch['title'], font=P8(fs)) > W - 760 - 90:
        fs -= 2
    d.text((760, H // 2 + 10 + 30 * (1 - p2)), ch['title'], font=P8(fs), fill=TEXT + (int(255 * p2),), anchor='lm')
    p3 = ease_out((lt - 0.5) / 0.7)
    d.text((762, H // 2 + 100 + 20 * (1 - p3)), ch.get('sub', ''), font=P5(36), fill=DIM + (int(255 * p3),), anchor='lm')
    d.rounded_rectangle((760, H // 2 + 150, 760 + int(160 * p3), H // 2 + 156), 3, fill=ROSE + (255,))
    return img


def title_frame(lt):
    img = BGI.copy()
    d = ImageDraw.Draw(img, 'RGBA')
    p = ease_out(lt / 0.9)
    ic = icon(220)
    img.paste(ic.convert('RGB'), (W // 2 - 110, int(250 - 30 * (1 - p))), ic.split()[3].point(lambda v: int(v * p)))
    p2 = ease_out((lt - 0.3) / 0.8)
    d.text((W // 2, 590 + 20 * (1 - p2)), 'Kissa — Poora Setup Guide', font=P8(92), fill=TEXT + (int(255 * p2),), anchor='mm')
    p3 = ease_out((lt - 0.7) / 0.8)
    d.text((W // 2, 690), 'Download se pehli kahani tak · step by step', font=P5(42), fill=DIM + (int(255 * p3),), anchor='mm')
    p4 = ease_out((lt - 1.1) / 0.8)
    d.rounded_rectangle((W // 2 - 60, 760, W // 2 - 60 + int(120 * p4), 766), 3, fill=ROSE + (255,))
    return img


def end_frame(lt, sub):
    key = 'endbase'
    if key not in _SHOT:
        img = BGI.copy()
        d = ImageDraw.Draw(img, 'RGBA')
        ic = icon(200)
        img.paste(ic.convert('RGB'), (W // 2 - 100, 150), ic)
        d.text((W // 2, 430), 'Abhi download karo', font=P5(44), fill=DIM, anchor='mm')
        d.text((W // 2, 540), 'beyondredeye.site', font=P8(120), fill=ROSE, anchor='mm')
        pills = ['Free', 'No login', 'No coins', 'No message limits']
        f = P6(34)
        widths = [d.textlength(p, font=f) + 70 for p in pills]
        x = W // 2 - (sum(widths) + 24 * (len(pills) - 1)) / 2
        for p, w in zip(pills, widths):
            d.rounded_rectangle((x, 650, x + w, 720), 35, fill=(255, 255, 255, 14), outline=(255, 255, 255, 40), width=2)
            d.text((x + w / 2, 685), p, font=f, fill=TEXT, anchor='mm')
            x += w + 24
        _SHOT[key] = img
    img = _SHOT[key].copy()
    subtitle(img, sub, center=True)
    return img


def intro_agenda(img, lt_chapter):
    d = ImageDraw.Draw(img)
    x0, y0 = 930, 300
    for i, a in enumerate(AGENDA):
        p = ease_out((lt_chapter - 3.0 - i * 1.15) / 0.5)
        if p <= 0:
            continue
        y = y0 + i * 58
        col = tuple(int(c * p + b * (1 - p)) for c, b in zip(TEXT, BG))
        colr = tuple(int(c * p + b * (1 - p)) for c, b in zip(ROSE, BG))
        d.text((x0 + 20 * (1 - p), y), f'{i + 1:02d}', font=P7(28), fill=colr)
        d.text((x0 + 70 + 20 * (1 - p), y), a, font=P5(30), fill=col)


_BASE = {}


def beat_base(item, lt=None):
    ci, bi = item['ch'], item['bi']
    ch = CHAPTERS[ci]
    b = ch['beats'][bi]
    if b['end']:
        return end_frame(0, b['s']), None
    key = (ci, bi)
    if key not in _BASE:
        shot = b['shot'] or next(x['shot'] for x in reversed(ch['beats'][:bi]) if x['shot'])
        shot_img(shot)
        hr = find_rect(shot, b['hl']) if b['hl'] else None
        img = phone_with(BGI.copy(), shot, hr)
        panel(img, ci, bi, b)
        subtitle(img, b['s'])
        wm = icon(44)
        img.paste(wm.convert('RGB'), (W - 84, 34), wm)
        ImageDraw.Draw(img).text((W - 100, 56), 'Kissa Tutorial', font=P6(26), fill=DIM, anchor='rm')
        _BASE[key] = (img, glow_layer(hr) if hr else None, hr)
    return _BASE[key][0], _BASE[key]


def item_frame(item, T):
    lt = T - item['start']
    if item['kind'] == 'title':
        return title_frame(lt)
    if item['kind'] == 'card':
        return card_frame(item['ch'], lt)
    base, info = beat_base(item)
    ch = CHAPTERS[item['ch']]
    b = ch['beats'][item['bi']]
    if b['end']:
        return base
    img = base.copy()
    if ch.get('kind') == 'intro':
        chs = next(x['start'] for x in TL if x['kind'] == 'beat' and x['ch'] == item['ch'])
        intro_agenda(img, T - chs)
    if info and info[1]:
        glow, sharp, bb = info[1]
        pulse = 0.55 + 0.45 * (0.5 + 0.5 * math.sin(lt * 5.0))
        appear = ease_out(lt / 0.35)
        g = glow.copy()
        g.putalpha(g.split()[3].point(lambda v: int(v * pulse * appear)))
        s = sharp.copy()
        s.putalpha(s.split()[3].point(lambda v: int(v * appear)))
        reg = img.crop(bb).convert('RGBA')
        reg.alpha_composite(g)
        reg.alpha_composite(s)
        img.paste(reg.convert('RGB'), bb[:2])
    if b['tap'] and info and info[2]:
        tt = lt - (item['dur'] - 0.5)
        if 0 <= tt <= 0.5:
            x0, y0, x1, y1 = screen_rect_to_frame(info[2])
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            dd = ImageDraw.Draw(lay)
            r = 14 + 46 * ease_out(tt / 0.5)
            a = int(230 * (1 - tt / 0.5))
            dd.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(255, 255, 255, a), width=5)
            dd.ellipse((cx - 16, cy - 16, cx + 16, cy + 16), fill=(255, 255, 255, int(200 * (1 - tt / 0.6))))
            im2 = img.convert('RGBA')
            im2.alpha_composite(lay)
            img = im2.convert('RGB')
    return img


ITEM_STARTS = [it['start'] for it in TL]


def item_at(T):
    import bisect
    i = bisect.bisect_right(ITEM_STARTS, T) - 1
    return max(0, min(i, len(TL) - 1))


def frame_at(T):
    i = item_at(T)
    it = TL[i]
    img = item_frame(it, T)
    lt = T - it['start']
    if i > 0:
        prev = TL[i - 1]
        xf = XF_CH if (it['kind'] != 'beat' or prev['kind'] != 'beat' or prev['ch'] != it['ch']) else XF_BEAT
        same = (it['kind'] == 'beat' and prev['kind'] == 'beat' and prev['ch'] == it['ch']
                and CHAPTERS[it['ch']]['beats'][it['bi']]['shot'] == CHAPTERS[prev['ch']]['beats'][prev['bi']]['shot']
                and not CHAPTERS[it['ch']]['beats'][it['bi']]['end'])
        if lt < xf and not same:
            pimg = item_frame(prev, prev['start'] + prev['dur'] - 1e-3)
            img = Image.blend(pimg, img, ease_io(lt / xf))
    # global fade in/out
    if T < 0.5:
        img = Image.blend(Image.new('RGB', (W, H), (0, 0, 0)), img, T / 0.5)
    if T > TOTAL - 1.2:
        img = Image.blend(img, Image.new('RGB', (W, H), (0, 0, 0)), clamp((T - (TOTAL - 1.2)) / 1.2))
    return img


# ---------------------------------------------------------------- audio
SR = 44100


def decode(path):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def build_audio(path_wav):
    n = int((TOTAL + 1) * SR)
    vo = np.zeros(n, np.float32)
    cache_ = {}
    for p, a, b, at in VO_PLACE:
        if p not in cache_:
            cache_[p] = decode(p)
        x = cache_[p][int(a * SR):int(b * SR)].copy()
        f = min(len(x), int(0.012 * SR))
        if f > 1:
            x[:f] *= np.linspace(0, 1, f)
            x[-f:] *= np.linspace(1, 0, f)
        s = int(at * SR)
        vo[s:s + len(x)] += x[:max(0, n - s)]
    sys.path.insert(0, HERE)
    from music import make_music
    quiet = [(it['start'], it['start'] + it['dur']) for it in TL if it['kind'] in ('title', 'card')]
    end_start = next(it['start'] for it in TL if it['kind'] == 'beat' and CHAPTERS[it['ch']]['beats'][it['bi']]['end'])
    quiet.append((end_start + 9.0, TOTAL + 1))
    mus = make_music(TOTAL, SR, vo, quiet, CARDS_AT, end_start)[:n]
    # tap ticks
    for tp in TAPS:
        s = int(tp * SR)
        L = int(0.05 * SR)
        if s + L > n:
            continue
        lt = np.arange(L) / SR
        mus[s:s + L] += (0.10 * np.sin(2 * np.pi * 1800 * lt) * np.exp(-lt * 90))[:, None]
    mix = vo[:, None] * 0.95 + mus
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    with wave.open(path_wav, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# ---------------------------------------------------------------- main
def main():
    if os.environ.get('PREVIEW'):
        mids = [it['start'] + min(it['dur'] * 0.6, it['dur'] - 0.2) for it in TL]
        thumbs = [frame_at(T).resize((480, 270)) for T in mids]
        cols = 6
        rows = (len(thumbs) + cols - 1) // cols
        for part in range(0, rows, 8):
            sub = thumbs[part * cols:(part + 8) * cols]
            r = (len(sub) + cols - 1) // cols
            sheet = Image.new('RGB', (cols * 480, r * 270), 'white')
            for i, im in enumerate(sub):
                sheet.paste(im, ((i % cols) * 480, (i // cols) * 270))
            sheet.save(f'/tmp/tut_sheet_{part // 8}.jpg', quality=82)
            print('sheet', f'/tmp/tut_sheet_{part // 8}.jpg')
        return
    if os.environ.get('STILLS'):
        for s in os.environ['STILLS'].split(','):
            frame_at(float(s)).save(f'/tmp/tut_{s}.jpg', quality=90)
            print('still', s)
        return
    wav = '/tmp/tut_audio.wav'
    build_audio(wav)
    if os.environ.get('AUDIO_ONLY'):
        src = os.environ['AUDIO_ONLY']
        subprocess.run([FF, '-y', '-v', 'error', '-i', src, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                        '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], check=True)
        print('remuxed', OUT, os.path.getsize(OUT) / 1e6, 'MB')
        return
    nframes = int(TOTAL * FPS)
    cmd = [FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-i', wav, '-c:v', 'libx264', '-preset', 'medium', '-crf', os.environ.get('CRF', '23'), '-maxrate', '3M', '-bufsize', '6M',
           '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', OUT]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fi in range(nframes):
        pr.stdin.write(frame_at(fi / FPS).tobytes())
        if fi % 900 == 0:
            print(f'frame {fi}/{nframes}', flush=True)
    pr.stdin.close()
    pr.wait()
    print('done', OUT, os.path.getsize(OUT) / 1e6, 'MB')


if __name__ == '__main__':
    main()
