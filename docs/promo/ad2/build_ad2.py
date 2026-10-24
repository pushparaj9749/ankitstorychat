"""Kissa ad #2 — cinematic trailer. 1080x1920, 30 fps, ~58 s.

Cold open (Riya's message) → five heroines, each with her own line (female
voice) over a panning scene from her story's gallery → chat demo → three
punch cards → CTA (beyondredeye.site). Music and sound design are
synthesised with numpy; ffmpeg muxes. Run:  python3 build_ad2.py [out.mp4]
Needs: pillow numpy imageio-ffmpeg, fonts/ and vo/ next to this file.
"""
import math
import os
import subprocess
import sys
import wave

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1080, 1920, 30
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
STORIES = f'{REPO}/content/stories'
OUT = sys.argv[1] if len(sys.argv) > 1 else f'{HERE}/kissa_ad2.mp4'
PREVIEW = os.environ.get('PREVIEW')

BG = (6, 6, 9)
ROSE = (240, 86, 126)
ROSE_L = (245, 138, 165)
GOLD = (226, 190, 126)
TEXT = (246, 246, 249)
DIM = (170, 172, 184)
FAINT = (116, 120, 135)


def font(name, size):
    return ImageFont.truetype(f'{HERE}/fonts/{name}.ttf', size)


PF9 = lambda s: font('PlayfairDisplay_900Black', s)
PFI = lambda s: font('PlayfairDisplay_700Bold_Italic', s)
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


def prog(t, s, d):
    return clamp((t - s) / d)


_C = {}


def cache(key, fn):
    if key not in _C:
        _C[key] = fn()
    return _C[key]


def with_alpha(img, a):
    if a >= 0.999:
        return img
    out = img.copy()
    al = np.asarray(out.getchannel('A'), dtype=np.float32) * a
    out.putalpha(Image.fromarray(al.astype(np.uint8)))
    return out


def paste(base, spr, x, y, a=1.0):
    if a <= 0.003:
        return
    s = with_alpha(spr, a)
    base.paste(s, (int(round(x)), int(round(y))), s)


def paste_c(base, spr, cx, y, a=1.0):
    paste(base, spr, cx - spr.width / 2, y, a)


def rounded(img, r):
    out = img.convert('RGBA')
    m = Image.new('L', out.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, out.width - 1, out.height - 1], r, fill=255)
    out.putalpha(m)
    return out


def circle(img, d):
    img = img.convert('RGB').resize((d, d), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', (d * 4, d * 4), 0)
    ImageDraw.Draw(m).ellipse([0, 0, d * 4 - 1, d * 4 - 1], fill=255)
    img.putalpha(m.resize((d, d), Image.LANCZOS))
    return img


def radial(size, color, strength=1.0, power=2.2):
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    r = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2) / (size / 2)
    a = np.clip(1 - r, 0, 1) ** power * 255 * strength
    img = Image.new('RGBA', (size, size), color + (0,))
    img.putalpha(Image.fromarray(a.astype(np.uint8)))
    return img


def text_sprite(lines, f, color=TEXT, spacing=0, gap=1.18, shadow=True, align='center'):
    norm = [[(ln, color)] if isinstance(ln, str) else ln for ln in lines]
    asc, desc = f.getmetrics()
    lh = int((asc + desc) * gap)

    def seglen(s):
        return sum(f.getlength(c) for c in s) + spacing * max(0, len(s) - 1) if spacing else f.getlength(s)

    widths = [sum(seglen(s) for s, _ in segs) for segs in norm]
    pad = 34
    w, h = int(max(widths)) + pad * 2, lh * len(norm) + pad * 2
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i, segs in enumerate(norm):
        x = pad + ((w - 2 * pad - widths[i]) / 2 if align == 'center' else 0)
        y = pad + i * lh
        for s, col in segs:
            if spacing:
                for c in s:
                    d.text((x, y), c, font=f, fill=col)
                    x += f.getlength(c) + spacing
            else:
                d.text((x, y), s, font=f, fill=col)
                x += f.getlength(s)
    if not shadow:
        return layer
    sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    sh.putalpha(layer.getchannel('A').filter(ImageFilter.GaussianBlur(12)).point(lambda v: int(v * 0.85)))
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.alpha_composite(sh, (0, 6))
    out.alpha_composite(layer)
    return out


def pill(txt, f, fg, bg, padx=34, pady=16):
    asc, desc = f.getmetrics()
    h = asc + desc + pady * 2
    w = int(f.getlength(txt) + padx * 2)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=h // 2, fill=bg)
    d.text((padx, pady), txt, font=f, fill=fg)
    return img


def wrap(words, f, maxw, space):
    lines, cur, cw = [], [], 0
    for wd in words:
        wl = f.getlength(wd)
        if cur and cw + space + wl > maxw:
            lines.append(cur)
            cur, cw = [], 0
        cw = cw + (space if cur else 0) + wl
        cur.append(wd)
    if cur:
        lines.append(cur)
    return lines


class WordReveal:
    """Subtitle that appears word by word across [start, start+dur]."""

    def __init__(self, text, f, maxw=940, accent_from=None, color=TEXT, accent=ROSE_L):
        self.f = f
        words = text.split()
        space = f.getlength(' ')
        self.lines = wrap(words, f, maxw, space)
        asc, desc = f.getmetrics()
        self.lh = int((asc + desc) * 1.12)
        self.items = []
        k = 0
        for li, ln in enumerate(self.lines):
            lw = sum(f.getlength(w_) for w_ in ln) + space * (len(ln) - 1)
            x = (W - lw) / 2
            for w_ in ln:
                col = accent if accent_from is not None and k >= accent_from else color
                spr = text_sprite([w_], f, col)
                self.items.append((spr, x - 34, li * self.lh - 34))
                x += f.getlength(w_) + space
                k += 1
        self.height = self.lh * len(self.lines)

    def draw(self, img, y, t, start, dur, fade=1.0):
        n = len(self.items)
        for i, (spr, x, yy) in enumerate(self.items):
            ws = start + dur * i / max(1, n)
            a = ease_out(prog(t, ws, 0.35)) * fade
            paste(img, spr, x, y + yy + (1 - a) * 18, a)


# ------------------------------------------------------------------ assets
def gallery(story, n):
    return Image.open(f'{STORIES}/{story}/assets/gallery/image-0{n}.jpg').convert('RGB')


def cover(story):
    return Image.open(f'{STORIES}/{story}/assets/cover.jpg').convert('RGB')


ICON = Image.open(f'{REPO}/assets/icon.png').convert('RGB')
RIYA_COVER = cover('dulhan-bhagi-shadi-se')
RIYA_FACE = RIYA_COVER.crop((500, 365, 665, 530))

SHOTS = [
    # story, gallery, heroine, title, line, accent word index, pan (cx0 → cx1)
    ('dulhan-bhagi-shadi-se', 2, 'RIYA', 'Dulhan Bhagi Shadi Se', 'Mandap chhod diya… sirf tumhare liye.', 3, (0.50, 0.63)),
    ('highway-ki-sherni', 4, 'NAINA', 'Highway Ki Sherni', 'Poora highway mere naam se kaanpta hai… par mera dil sirf tumhare naam se.', 8, (0.44, 0.55)),
    ('madam-sarkar', 2, 'VEDIKA', 'Madam Sarkar', 'Poora shehar meri sunta hai… aur main sirf tumhari.', 5, (0.56, 0.40)),
    ('ring-ki-rani', 3, 'MEHTAB', 'Ring Ki Rani', 'Ring mein sabko girati hoon… tumhare saamne khud haar jaati hoon.', 5, (0.30, 0.43)),
    ('chudail-nahi-biwi-hai', 2, 'MOHINI', 'Chudail Nahi, Biwi Hai', 'Log kehte hain main chudail hoon… tum kehte ho, biwi.', 6, (0.58, 0.45)),
]
SHOT_IMG = [gallery(s[0], s[1]) for s in SHOTS]

WALL_IDS = ['dulhan-bhagi-shadi-se', 'highway-ki-sherni', 'madam-sarkar', 'ring-ki-rani', 'dil-ki-wasooli', 'meri-wali-ips',
            'commando-wife', 'biwi-ek-supari-killer', 'thakurain', 'chudail-nahi-biwi-hai', 'meri-hacker-girlfriend', 'don-ki-beti-mera-dil']
WALL = [cover(c) for c in WALL_IDS if os.path.exists(f'{STORIES}/{c}/assets/cover.jpg')]

rng = np.random.default_rng(11)
GRAIN = [rng.normal(0, 3.2, (H // 2, W // 2)).astype(np.float32) for _ in range(6)]
GRAIN = [np.asarray(Image.fromarray(np.clip(g + 128, 0, 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), dtype=np.int16) - 128 for g in GRAIN]


def vignette(strength=210, inner=0.55):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    a = np.clip((r - inner) / 0.8, 0, 1) * strength
    v = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    v.putalpha(Image.fromarray(a.astype(np.uint8)))
    return v


VIGNETTE = vignette()


def vgrad(h, top_alpha, bottom_alpha, color=BG):
    a = np.linspace(top_alpha, bottom_alpha, h, dtype=np.float32)[:, None].repeat(W, 1)
    g = Image.new('RGBA', (W, h), color + (0,))
    g.putalpha(Image.fromarray(a.astype(np.uint8)))
    return g


# ------------------------------------------------------------------ icons
def glyph(kind, size, color):
    s = size * 4
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = color + (255,)
    lw = int(s * 0.07)
    if kind == 'seal':
        d.ellipse([s * 0.06, s * 0.25, s * 0.56, s * 0.75], outline=c, width=lw)
        d.ellipse([s * 0.44, s * 0.25, s * 0.94, s * 0.75], outline=c, width=lw)
    elif kind == 'spark':
        for ang in range(0, 360, 45):
            r1, r2 = (s * 0.12, s * 0.46) if ang % 90 == 0 else (s * 0.12, s * 0.3)
            a_ = math.radians(ang)
            d.line([(s / 2 + r1 * math.cos(a_), s / 2 + r1 * math.sin(a_)), (s / 2 + r2 * math.cos(a_), s / 2 + r2 * math.sin(a_))], fill=c, width=lw)
    elif kind == 'lock':
        d.rounded_rectangle([s * 0.2, s * 0.45, s * 0.8, s * 0.88], radius=s * 0.08, fill=c)
        d.arc([s * 0.3, s * 0.14, s * 0.7, s * 0.62], 180, 360, fill=c, width=lw)
        d.line([(s * 0.3, s * 0.38), (s * 0.3, s * 0.47)], fill=c, width=lw)
        d.line([(s * 0.7, s * 0.38), (s * 0.7, s * 0.47)], fill=c, width=lw)
        d.ellipse([s * 0.45, s * 0.58, s * 0.55, s * 0.68], fill=BG + (255,))
    return img.resize((size, size), Image.LANCZOS)


# ------------------------------------------------------------------ scenes
def black():
    return Image.new('RGB', (W, H), BG)


# S0 — cold open: Riya's message
def notif_card():
    w, h = 940, 250
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, w - 1, h - 1], 46, fill=(30, 31, 38))
    av = circle(RIYA_FACE, 110)
    img.paste(av, (34, 40), av)
    d.text((170, 36), 'Riya', font=P7(40), fill=TEXT)
    d.text((w - 150, 44), 'abhi', font=P5(28), fill=FAINT)
    d.text((170, 98), 'Main shaadi chhod ke bhaag', font=P5(36), fill=(220, 222, 230))
    d.text((170, 148), 'rahi hoon… tum aaoge na?', font=P5(36), fill=(220, 222, 230))
    d.ellipse([w - 70, 108, w - 44, 134], fill=ROSE)
    return img


def s0(t, d):
    img = black()
    glow = cache('s0glow', lambda: radial(1300, ROSE, 0.22))
    a = ease_out(prog(t, 0.2, 0.6))
    paste(img, glow, W / 2 - 650, 760 - 650, a * (0.75 + 0.25 * math.sin(t * 2.2)))
    clock = cache('clock', lambda: text_sprite(['2:47'], P4(150), (232, 232, 238)))
    date = cache('date', lambda: text_sprite(['Shaadi ki raat'], P5(38), DIM))
    ca = ease_out(prog(t, 0.0, 0.8))
    paste_c(img, clock, W / 2, 300, ca * 0.9)
    paste_c(img, date, W / 2, 480, ca * 0.9)
    card = cache('notif', notif_card)
    p = ease_out(prog(t, 0.35, 0.5))
    shake = math.sin(t * 60) * 6 * (1 - prog(t, 0.35, 0.4)) if t > 0.35 else 0
    paste_c(img, card, W / 2 + shake, 720 - (1 - p) * 120, p)
    # "Jawab… aap doge."
    j1 = cache('j1', lambda: text_sprite(['Jawab…'], PFI(110), DIM))
    j2 = cache('j2', lambda: text_sprite([[('aap ', TEXT), ('doge.', ROSE)]], PF9(150)))
    q = ease_out(prog(t, 4.0, 0.6))
    paste_c(img, j1, W / 2, 1180 + (1 - q) * 30, q)
    q2 = ease_out(prog(t, 5.0, 0.5))
    sc = 1.25 - 0.25 * q2
    j2s = j2.resize((int(j2.width * sc), int(j2.height * sc)), Image.LANCZOS)
    paste_c(img, j2s, W / 2, 1330 - (j2s.height - j2.height) / 2, q2)
    return img


# S1..S5 — heroine shots
IMG_TOP, IMG_H = 300, 1290


def shot_frame(idx, t, d):
    story, _, name, title, line, accent, (c0, c1) = SHOTS[idx]
    src = SHOT_IMG[idx]
    pz = t / d
    zoom = 1.0 + 0.07 * pz
    scale = IMG_H / src.height * zoom
    sw = src.width * scale
    cx = (c0 + (c1 - c0) * ease_io(pz)) * sw
    x0 = clamp(cx - W / 2, 0, sw - W)
    # crop in source coordinates (fast) then resize
    sx0, sx1 = x0 / scale, (x0 + W) / scale
    sh_ = IMG_H / scale
    sy0 = (src.height - sh_) / 2
    crop = src.crop((int(sx0), int(sy0), int(math.ceil(sx1)), int(sy0 + sh_))).resize((W, IMG_H), Image.BILINEAR)
    img = black()
    # ambient: blurred copy fills the frame
    amb = cache(('amb', idx), lambda: Image.fromarray((np.asarray(src.resize((W // 8, H // 8)).filter(ImageFilter.GaussianBlur(6)).resize((W, H), Image.BILINEAR), dtype=np.float32) * 0.35).astype(np.uint8)))
    img.paste(amb, (0, 0))
    img.paste(crop, (0, IMG_TOP))
    top = cache('gtop', lambda: vgrad(260, 255, 0))
    bot = cache('gbot', lambda: vgrad(420, 0, 255))
    img.paste(top, (0, IMG_TOP), top)
    img.paste(bot, (0, IMG_TOP + IMG_H - 420), bot)
    img.paste(Image.new('RGB', (W, IMG_TOP), BG), (0, 0))
    img.paste(Image.new('RGB', (W, H - IMG_TOP - IMG_H), BG), (0, IMG_TOP + IMG_H))
    # heroine tag + title
    tag = cache(('tag', idx), lambda: text_sprite([name], P7(40), GOLD, spacing=14))
    ttl = cache(('ttl', idx), lambda: text_sprite([title], PF9(64)))
    a = ease_out(prog(t, 0.1, 0.5))
    paste_c(img, tag, W / 2, 120 + (1 - a) * 20, a)
    paste_c(img, ttl, W / 2, 175 + (1 - a) * 20, a)
    # line
    wr = cache(('wr', idx), lambda: WordReveal(line, PFI(64), 960, accent_from=accent))
    vo = VO_D[f'h{idx + 1}']
    y = IMG_TOP + IMG_H - 150 - wr.height / 2
    wr.draw(img, y, t, LEAD_SHOT, vo * 0.85)
    # heroine progress + watermark
    dd = ImageDraw.Draw(img)
    for k in range(5):
        x = W / 2 - 5 * 70 / 2 + k * 70 + 6
        dd.rounded_rectangle([x, 1700, x + 58, 1707], 4, fill=ROSE if k == idx else ((90, 92, 104) if k < idx else (44, 46, 54)))
    wm = cache('wm', lambda: text_sprite(['KISSA'], PF9(44), (200, 200, 208), spacing=12, shadow=False))
    paste_c(img, wm, W / 2, 1745, 0.75)
    return img


def make_shot(idx):
    return lambda t, d: shot_frame(idx, t, d)


# S6 — brand + chat demo
PH_X, PH_Y, PH_W, PH_H = 150, 560, 780, 1240


def bubble(txt, user, f=None, maxw=540):
    f = f or P4(40)
    words = txt.split()
    lines = [' '.join(l) for l in wrap(words, f, maxw, f.getlength(' '))]
    asc, desc = f.getmetrics()
    lh = int((asc + desc) * 1.12)
    tw = max(f.getlength(l) for l in lines)
    padx, pady = 30, 22
    w, h = int(tw + padx * 2), lh * len(lines) + pady * 2
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fill = ROSE if user else (30, 32, 40)
    d.rounded_rectangle([0, 0, w - 1, h - 1], 32, fill=fill)
    if user:
        d.rectangle([w - 32, h - 32, w - 1, h - 1], fill=fill)
    else:
        d.rectangle([0, 0, 32, 32], fill=fill)
    for i, l in enumerate(lines):
        d.text((padx, pady + i * lh), l, font=f, fill=(255, 255, 255) if user else TEXT)
    return img


def phone_base():
    ph = Image.new('RGBA', (PH_W, PH_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ph)
    d.rounded_rectangle([0, 0, PH_W - 1, PH_H - 1], 80, fill=(28, 29, 35))
    d.rounded_rectangle([12, 12, PH_W - 13, PH_H - 13], 70, fill=(0, 0, 0))
    d.rounded_rectangle([PH_W / 2 - 70, 30, PH_W / 2 + 70, 62], 16, fill=(18, 18, 22))
    av = circle(RIYA_FACE, 80)
    ph.paste(av, (40, 92), av)
    d.text((138, 96), 'Riya Chaturvedi', font=P6(34), fill=TEXT)
    d.text((138, 138), 'online', font=P4(26), fill=(92, 201, 149))
    d.line([(30, 196), (PH_W - 30, 196)], fill=(34, 36, 44), width=2)
    return ph


USER_MSG = 'Main aa raha hoon. Ghaat pe ruko.'
RIYA_MSG = 'Jaldi aao… diye bujhne se pehle.'


def s6(t, d):
    img = black()
    glow = cache('s6glow', lambda: radial(1400, ROSE, 0.20))
    img.paste(glow, (W // 2 - 700, 300 - 700), glow)
    # brand line at top
    k = cache('kissa', lambda: text_sprite(['KISSA'], PF9(120), TEXT, spacing=22))
    a = ease_out(prog(t, 0.0, 0.5))
    paste_c(img, k, W / 2, 120 + (1 - a) * 20, a)
    sub = cache('s6sub', lambda: text_sprite([[('Aap jo bologe, ', TEXT), ('kahani wahi banegi.', ROSE_L)]], P6(46)))
    b = ease_out(prog(t, 2.2, 0.5))
    paste_c(img, sub, W / 2, 320 + (1 - b) * 20, b)
    ph = cache('phone', phone_base).copy()
    pd = ImageDraw.Draw(ph)
    pp = ease_out(prog(t, 0.3, 0.6))
    # composer with typing
    typed_n = int(len(USER_MSG) * clamp((t - 0.9) / 1.6))
    sent = t > 2.75
    pd.rounded_rectangle([34, PH_H - 124, PH_W - 124, PH_H - 50], 37, fill=(20, 21, 27))
    if not sent:
        txt = USER_MSG[:typed_n] if typed_n else 'Kuch likho…'
        col = TEXT if typed_n else FAINT
        pd.text((64, PH_H - 107), txt, font=P4(30), fill=col)
        if typed_n and int(t * 4) % 2 == 0:
            cx = 64 + P4(30).getlength(txt) + 4
            pd.line([(cx, PH_H - 104), (cx, PH_H - 70)], fill=ROSE, width=3)
    else:
        pd.text((64, PH_H - 107), 'Kuch likho…', font=P4(30), fill=FAINT)
    pd.ellipse([PH_W - 110, PH_H - 126, PH_W - 34, PH_H - 50], fill=ROSE)
    pd.polygon([(PH_W - 84, PH_H - 104), (PH_W - 84, PH_H - 72), (PH_W - 56, PH_H - 88)], fill=(255, 255, 255))
    y = 240
    if sent:
        ub = cache('ub', lambda: bubble(USER_MSG, True))
        ua = ease_out(prog(t, 2.75, 0.35))
        paste(ph, ub, PH_W - 34 - ub.width, y + (1 - ua) * 40, ua)
        y += ub.height + 40
        # typing dots → reply
        if 3.2 < t < 4.1:
            for i in range(3):
                o = 0.4 + 0.6 * (0.5 + 0.5 * math.sin(t * 10 - i * 0.9))
                pd.ellipse([110 + i * 28, y + 30, 128 + i * 28, y + 48], fill=tuple(int(v * o) for v in DIM))
        if t >= 4.1:
            ra = ease_out(prog(t, 4.1, 0.4))
            nm = cache('nm', lambda: text_sprite(['Riya Chaturvedi'], P6(26), ROSE_L, shadow=False))
            av = cache('av56', lambda: circle(RIYA_FACE, 56))
            rb = cache('rb', lambda: bubble(RIYA_MSG, False))
            paste(ph, nm, 70, y - 30 + (1 - ra) * 30, ra)
            paste(ph, av, 30, y + 46 + (1 - ra) * 30, ra)
            paste(ph, rb, 100, y + 40 + (1 - ra) * 30, ra)
    paste(img, ph, PH_X, PH_Y + (1 - pp) * 100, pp)
    return img


# S7 — punch cards
CARDS = [
    ('seal', 'Har waada', 'yaad.', 'biwi-ek-supari-killer'),
    ('spark', 'Nayi kahaniyan,', 'aati rehti hain.', 'ring-ki-rani'),
    ('lock', 'Sab kuch sirf', 'aapke phone mein.', 'madam-sarkar'),
]


def s7(t, d):
    seg = d / 3
    i = min(2, int(t // seg))
    tl = t - i * seg
    kind, l1, l2, cid = CARDS[i]
    bgk = ('cardbg', i)
    if bgk not in _C:
        c = cover(cid)
        s = max(W / c.width, H / c.height)
        c = c.resize((int(c.width * s) + 1, int(c.height * s) + 1), Image.LANCZOS)
        c = c.crop(((c.width - W) // 2, (c.height - H) // 2, (c.width - W) // 2 + W, (c.height - H) // 2 + H))
        c = c.filter(ImageFilter.GaussianBlur(18))
        _C[bgk] = Image.fromarray((np.asarray(c, dtype=np.float32) * 0.28).astype(np.uint8))
    img = _C[bgk].copy()
    zoom_in = ease_out(prog(tl, 0, 0.35))
    ic = cache(('cic', i), lambda: glyph(kind, 190, ROSE))
    sc = 0.5 + 0.5 * zoom_in
    ics = ic.resize((int(190 * sc),) * 2, Image.LANCZOS)
    paste(img, ics, W / 2 - ics.width / 2, 640 - ics.height / 2, zoom_in)
    a1 = cache(('c1', i), lambda: text_sprite([l1], PF9(108), TEXT))
    a2 = cache(('c2', i), lambda: text_sprite([l2], PF9(108), ROSE))
    p1 = ease_out(prog(tl, 0.05, 0.35))
    p2 = ease_out(prog(tl, 0.25, 0.35))
    paste_c(img, a1, W / 2 - (1 - p1) * 160, 820, p1)
    paste_c(img, a2, W / 2 + (1 - p2) * 160, 960, p2)
    # progress ticks
    dd = ImageDraw.Draw(img)
    for k in range(3):
        x = W / 2 - 120 + k * 90
        dd.rounded_rectangle([x, 1260, x + 60, 1268], 4, fill=ROSE if k <= i else (60, 62, 72))
    return img


# S8 — CTA
def s8(t, d):
    if 'wall' not in _C:
        cw, chh, gap = 300, 447, 18
        cols = 4
        tile = Image.new('RGB', (cols * (cw + gap), 3 * 6 * (chh + gap)), BG)
        k = 0
        for c_ in range(cols):
            for r in range(18):
                cv = WALL[k % len(WALL)].resize((cw, chh), Image.BILINEAR)
                tile.paste(cv, (c_ * (cw + gap), r * (chh + gap)))
                k += 1
        _C['wall'] = tile
    tile = _C['wall']
    img = black()
    for c_ in range(4):
        speed = (70, 110, 85, 125)[c_]
        off = int(200 + t * speed + c_ * 120) % (6 * 465)
        col = tile.crop((c_ * 318, off, c_ * 318 + 300, off + H))
        col = Image.fromarray((np.asarray(col, dtype=np.float32) * 0.30).astype(np.uint8))
        img.paste(col, (int(-60 + c_ * 318), 0))
    glow = cache('ctaglow', lambda: radial(1100, ROSE, 0.45))
    img.paste(glow, (W // 2 - 550, 560 - 550), glow)
    ic = cache('icon', lambda: rounded(ICON.resize((330, 330), Image.LANCZOS), 76))
    p = ease_out(prog(t, 0.0, 0.7))
    s = ic.resize((int(330 * (0.75 + 0.25 * p)),) * 2, Image.LANCZOS)
    paste(img, s, W / 2 - s.width / 2, 560 - s.height / 2, p)
    k = cache('kissa_big', lambda: text_sprite(['KISSA'], PF9(190), TEXT, spacing=26))
    q = ease_out(prog(t, 0.3, 0.6))
    paste_c(img, k, W / 2, 760 + (1 - q) * 30, q)
    tg = cache('tag8', lambda: text_sprite([[('Aapki kahani. ', TEXT), ('Aapki marzi.', ROSE)]], PFI(64)))
    a = ease_out(prog(t, 1.0, 0.6))
    paste_c(img, tg, W / 2, 1000 + (1 - a) * 30, a)
    btn = cache('btn', lambda: pill('Abhi download karo', P7(54), (255, 255, 255), ROSE, padx=70, pady=30))
    b = ease_out(prog(t, 2.6, 0.6))
    pulse = 1 + 0.035 * math.sin(max(0, t - 3.2) * 5)
    bb = btn.resize((int(btn.width * pulse), int(btn.height * pulse)), Image.LANCZOS)
    bg_ = cache('btnglow', lambda: radial(760, ROSE, 0.35))
    paste(img, bg_, W / 2 - 380, 1250 - 380, b)
    paste(img, bb, W / 2 - bb.width / 2, 1250 - bb.height / 2 + (1 - b) * 30, b)
    andr = cache('andr', lambda: text_sprite(['Android  •  Free APK'], P6(36), GOLD))
    url = cache('url', lambda: text_sprite(['beyondredeye.site'], P7(64), TEXT))
    c = ease_out(prog(t, 3.3, 0.6))
    paste_c(img, andr, W / 2, 1385, c)
    paste_c(img, url, W / 2, 1445, c)
    return img


# ------------------------------------------------------------------ timeline
def dur_of(path):
    out = subprocess.run([FF, '-i', path], capture_output=True, text=True).stderr
    hh, mm, ss = out.split('Duration: ')[1].split(',')[0].split(':')
    return int(hh) * 3600 + int(mm) * 60 + float(ss)


VO_D = {k: dur_of(f'{HERE}/vo/{k}.mp3') for k in ['h0', 'n0', 'h1', 'h2', 'h3', 'h4', 'h5', 'n1', 'n2', 'n3']}
LEAD_SHOT = 0.45
SCENES = [s0] + [make_shot(i) for i in range(5)] + [s6, s7, s8]
DURS = [7.0] + [VO_D[f'h{i + 1}'] + LEAD_SHOT + 0.55 for i in range(5)] + [VO_D['n1'] + 0.9, VO_D['n2'] + 0.7, VO_D['n3'] + 0.4 + 2.6]
STARTS = np.cumsum([0] + DURS[:-1]).tolist()
TOTAL = float(sum(DURS))
# voice placements (key, absolute start)
VO_AT = [('h0', 0.55), ('n0', 4.15)]
VO_AT += [(f'h{i + 1}', STARTS[1 + i] + LEAD_SHOT) for i in range(5)]
VO_AT += [('n1', STARTS[6] + 0.35), ('n2', STARTS[7] + 0.25), ('n3', STARTS[8] + 0.4)]
# cut style into each scene: 'flash' (hard cut + white flash) or 'fade'
CUT = ['fade', 'flash', 'flash', 'flash', 'flash', 'flash', 'fade', 'flash', 'fade']
XF = 0.45


def frame_at(T, fi=0):
    i = max(k for k in range(len(SCENES)) if STARTS[k] <= T)
    t = T - STARTS[i]
    img = SCENES[i](t, DURS[i])
    if i > 0 and CUT[i] == 'fade' and t < XF:
        prev = SCENES[i - 1](T - STARTS[i - 1], DURS[i - 1])
        img = Image.blend(prev, img, ease_io(t / XF))
    img.paste(VIGNETTE, (0, 0), VIGNETTE)
    arr = np.asarray(img, dtype=np.int16) + GRAIN[fi % len(GRAIN)][:, :, None]
    if i > 0 and CUT[i] == 'flash' and t < 0.22:
        f = (1 - t / 0.22) ** 2 * 0.85
        arr = arr + (255 - arr) * f
    fade = min(clamp(T / 0.4), clamp((TOTAL - T) / 0.8))
    if fade < 1:
        arr = arr * fade
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


# ------------------------------------------------------------------ audio
SR = 44100


def decode(path):
    raw = subprocess.run([FF, '-v', 'quiet', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def note(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def add(buf, at, sig):
    s0 = int(at * SR)
    if s0 >= len(buf):
        return
    e = min(len(buf), s0 + len(sig))
    buf[s0:e] += sig[: e - s0]


def tone(f, dur, amp, decay=0.0, attack=0.01):
    t = np.arange(int(dur * SR)) / SR
    env = np.minimum(t / attack, 1) * (np.exp(-t * decay) if decay else 1)
    return (np.sin(2 * np.pi * f * t) * env * amp).astype(np.float32)


def noise(dur, amp, decay, hp=True):
    n = rng.normal(0, 1, int(dur * SR)).astype(np.float32)
    if hp:
        n = np.diff(n, prepend=0)
    t = np.arange(len(n)) / SR
    return n * np.exp(-t * decay) * amp


def kick(amp=0.5):
    t = np.arange(int(0.35 * SR)) / SR
    f = 48 + 90 * np.exp(-t * 28)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * amp).astype(np.float32)


def boom(amp=0.8):
    t = np.arange(int(2.5 * SR)) / SR
    f = 36 + 60 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) * amp
    s += noise(2.5, 0.05, 2.5, hp=False)[: len(s)]
    return s.astype(np.float32)


def whoosh(dur=0.6, amp=0.18):
    n = rng.normal(0, 1, int(dur * SR)).astype(np.float32)
    # moving one-pole low-pass for a rising sweep
    out = np.zeros_like(n)
    y = 0.0
    for i in range(len(n)):
        a = 0.02 + 0.5 * (i / len(n)) ** 2
        y += a * (n[i] - y)
        out[i] = y
    t = np.arange(len(n)) / SR
    env = np.sin(np.pi * t / dur) ** 2
    return out * env * amp * 3


def pad(chord, dur, amp):
    t = np.arange(int(dur * SR)) / SR
    env = np.minimum(t / 1.2, 1) * np.minimum((dur - t) / 0.8, 1)
    s = np.zeros_like(t)
    for m in chord:
        for det in (-0.15, 0.15):
            s += np.sin(2 * np.pi * note(m) * (1 + det / 100) * t)
    return (s / (len(chord) * 2) * env * amp).astype(np.float32)


def music():
    n = int((TOTAL + 1) * SR)
    m = np.zeros(n, dtype=np.float32)
    # cold open: low drone + heartbeat
    add(m, 0.0, pad([45, 52, 57], 7.2, 0.20))
    for k in range(6):
        tb = 0.8 + k * 1.0
        add(m, tb, kick(0.32))
        add(m, tb + 0.22, kick(0.22))
    add(m, 0.35, tone(1318.5, 0.5, 0.10, decay=7) + tone(1975.5, 0.5, 0.05, decay=9))  # notification ping
    # build into the drop
    add(m, 6.2, whoosh(0.8, 0.22))
    drop = STARTS[1]
    add(m, drop, boom(0.9))
    # montage: driving minor groove, 100 bpm
    beat = 0.6
    chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
    end_m = STARTS[6]
    tb = drop
    j = 0
    while tb < end_m - 0.05:
        if j % 2 == 0:
            add(m, tb, kick(0.42))
        else:
            add(m, tb, noise(0.18, 0.10, 22))  # clap/snare
        add(m, tb + beat / 2, noise(0.05, 0.035, 60))  # hat
        if j % 8 == 0:
            ch = chords[(j // 8) % 4]
            add(m, tb, pad(ch, beat * 8 + 0.3, 0.16))
            add(m, tb, tone(note(ch[0] - 24), beat * 8, 0.12, attack=0.05))
        # pulsing arp
        ch = chords[(j // 8) % 4]
        add(m, tb, tone(note(ch[j % 3] + 12), 0.28, 0.035, decay=10))
        tb += beat
        j += 1
    for i in range(2, 6):  # whoosh into every heroine cut
        add(m, STARTS[i] - 0.45, whoosh(0.5, 0.14))
        add(m, STARTS[i], kick(0.35))
    # brand + chat: lighter, warm major
    add(m, STARTS[6] - 0.5, whoosh(0.7, 0.16))
    add(m, STARTS[6], pad([48, 55, 60, 64], DURS[6] + 0.4, 0.17))
    for k in range(int(DURS[6] / 0.3)):
        add(m, STARTS[6] + k * 0.3, tone(note([72, 76, 79, 76][k % 4]), 0.4, 0.03, decay=8))
    add(m, STARTS[6] + 2.75, tone(1567.98, 0.25, 0.06, decay=14))  # send blip
    add(m, STARTS[6] + 4.1, tone(1318.5, 0.3, 0.06, decay=12))  # reply blip
    # punch cards: hits on each card
    for k in range(3):
        at = STARTS[7] + k * DURS[7] / 3
        add(m, at, boom(0.45)[: int(1.2 * SR)])
        add(m, at, noise(0.25, 0.08, 14))
    add(m, STARTS[7], pad([53, 57, 60, 65], DURS[7], 0.14))
    # CTA: final swell + ring-out
    add(m, STARTS[8] - 0.4, whoosh(0.6, 0.2))
    add(m, STARTS[8], boom(0.7))
    add(m, STARTS[8], pad([45, 52, 57, 60, 64], DURS[8] + 0.5, 0.2))
    add(m, STARTS[8] + 2.6, tone(note(81), 2.5, 0.06, decay=1.2) + tone(note(88), 2.5, 0.04, decay=1.4))
    return m


def build_audio(path):
    n = int((TOTAL + 1) * SR)
    voice = np.zeros(n, dtype=np.float32)
    for k, at in VO_AT:
        add(voice, at, decode(f'{HERE}/vo/{k}.mp3') * 1.05)
    mus = music()
    env = np.convolve(np.abs(voice), np.ones(int(0.2 * SR)) / int(0.2 * SR), mode='same')
    duck = 1 - 0.5 * np.clip(env / 0.03, 0, 1)
    t = np.arange(n) / SR
    fade = np.clip((TOTAL - t) / 1.2, 0, 1)
    mix = voice + mus * 0.75 * duck * fade
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix = mix / max(1.0, np.max(np.abs(mix)) / 0.95)
    mix = mix[: int(TOTAL * SR)]
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes())


if __name__ == '__main__':
    print('scenes', [round(x, 2) for x in DURS], 'total', round(TOTAL, 2))
    if PREVIEW:
        for ts in PREVIEW.split(','):
            frame_at(float(ts)).resize((540, 960)).save(f'/tmp/ad2_prev_{float(ts):05.1f}.jpg', quality=85)
        sys.exit(0)
    wav = '/tmp/ad2_audio.wav'
    build_audio(wav)
    nframes = int(TOTAL * FPS)
    proc = subprocess.Popen(
        [FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
         '-i', wav, '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-maxrate', '5M', '-bufsize', '10M', '-pix_fmt', 'yuv420p',
         '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', OUT],
        stdin=subprocess.PIPE,
    )
    for fi in range(nframes):
        proc.stdin.write(frame_at(fi / FPS, fi).tobytes())
        if fi % 300 == 0:
            print(f'frame {fi}/{nframes}', flush=True)
    proc.stdin.close()
    proc.wait()
    print('done', OUT)
