#!/usr/bin/env python3
"""Kissa — epic trailer-style 9:16 promo (Ramayana-trailer energy, original footage).

Vertical 2160x3840 (4K UHD portrait), 30 fps, ~38.6 s, cut on the beat of the
in-repo Kissa signature theme (docs/promo/theme/kissa_theme_full.mp3, 96 BPM).
No third-party footage or audio is used: every plate is an original generated
still, every note comes from the repo's own synthesised brand theme.

Usage:
  python3 build_short.py                 -> full 4K master (2160x3840)
  SCALE=0.5 python3 build_short.py       -> 1080x1920 review render
  STILLS=1.0,12.5,33 python3 build_short.py
                                          -> PNG stills in /tmp/ramayan_stills

Structure (96 BPM, bar = 2.5 s; the theme is entered at its sitar hook, 5.0 s):
  0.0-10.0   sitar hook        slow-motion establishing cuts
 10.0-20.0   groove            faster cuts, story teasers
 20.0-22.5   break             one held breath + cast line
 22.5-32.5   drop              hard cuts, impacts, flash frames
 32.5-38.6   end card          logo, tagline, link
"""
import math
import os
import subprocess
import sys

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
PLATES = os.path.join(REPO, 'work', 'ramayan-promo', 'plates')
FONTS = os.path.join(REPO, 'docs', 'promo', 'ad2', 'fonts')
THEME = os.path.join(REPO, 'docs', 'promo', 'theme', 'kissa_theme_full.mp3')
FF = imageio_ffmpeg.get_ffmpeg_exe()

SCALE = float(os.environ.get('SCALE', '1'))
W = int(2160 * SCALE) // 2 * 2
H = int(3840 * SCALE) // 2 * 2
FPS = 30
MUSIC_IN = 5.0           # theme second where the sitar hook starts
DUR = 38.6               # tight YouTube-Shorts length, ends on the logo tail
OUT = os.environ.get('OUT') or os.path.join(
    HERE, f'kissa_promo_ramayana_vibe_9x16_{H}p.mp4')
STILLS = os.environ.get('STILLS')
CRF = os.environ.get('CRF', '17')
PRESET = os.environ.get('PRESET', 'medium')

GOLD = (226, 190, 126)
GOLD_HI = (248, 226, 178)
TEXT = (247, 246, 243)
DIM = (188, 190, 199)


def font(name, size):
    return ImageFont.truetype(f'{FONTS}/{name}.ttf', size)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def ease_out(x):
    return 1 - (1 - clamp(x)) ** 3


# ------------------------------------------------------------------ shot list
# (t0, t1, plate, look, z0, z1, pan_x, pan_y, rot_deg, punch)
SHOTS = [
    (0.000, 1.875, 'p01_temple', 'dawn', 1.00, 1.15, 0.015, -0.02, 0.3, 1.0),
    (1.875, 3.750, 'p06_train', 'teal', 1.14, 1.00, -0.02, 0.015, -0.4, 0.0),
    (3.750, 5.625, 'p02_haveli', 'warm', 1.00, 1.12, 0.02, -0.01, 0.2, 0.0),
    (5.625, 7.500, 'p10_clocks', 'amber', 1.10, 1.00, 0.00, -0.02, 0.0, 0.0),
    (7.500, 8.750, 'p05_cyber', 'neon', 1.00, 1.12, -0.01, 0.02, 0.5, 0.6),
    (8.750, 10.000, 'p04_desert', 'warm', 1.12, 1.00, 0.02, 0.00, -0.3, 0.0),
    (10.000, 11.250, 'p09_stage', 'indigo', 1.00, 1.14, 0.00, 0.01, 0.0, 0.5),
    (11.250, 12.500, 'p03_rain', 'teal', 1.13, 1.00, -0.02, -0.01, 0.4, 0.0),
    (12.500, 13.750, 'p07_fire', 'fire', 1.00, 1.18, 0.00, -0.02, -0.5, 0.8),
    (13.750, 15.000, 'p08_kitchen', 'warm', 1.12, 1.00, 0.01, 0.02, 0.3, 0.0),
    (15.000, 16.250, 'p06_train', 'teal', 1.00, 1.15, 0.02, 0.00, 0.0, 0.6),
    (16.250, 17.500, 'p05_cyber', 'neon', 1.15, 1.00, -0.02, 0.01, -0.4, 0.0),
    (17.500, 18.750, 'p04_desert', 'warm', 1.00, 1.13, 0.01, -0.02, 0.3, 0.5),
    (18.750, 20.000, 'p09_stage', 'indigo', 1.13, 1.00, 0.00, 0.02, 0.0, 0.0),
    (20.000, 22.500, 'p01_temple', 'dusk', 1.02, 1.18, 0.00, -0.01, 0.2, 0.0),
    (22.500, 23.750, 'p07_fire', 'fire', 1.06, 1.20, -0.01, 0.00, -0.6, 1.4),
    (23.750, 25.000, 'p04_desert', 'warm', 1.18, 1.02, 0.02, -0.01, 0.5, 0.0),
    (25.000, 26.250, 'p05_cyber', 'neon', 1.02, 1.18, -0.02, 0.01, -0.5, 0.8),
    (26.250, 27.500, 'p02_haveli', 'warm', 1.16, 1.00, 0.01, 0.02, 0.4, 0.0),
    (27.500, 28.750, 'p10_clocks', 'amber', 1.00, 1.16, 0.00, -0.02, 0.0, 1.2),
    (28.750, 30.000, 'p09_stage', 'indigo', 1.16, 1.00, 0.02, 0.00, -0.4, 0.0),
    (30.000, 31.250, 'p08_kitchen', 'warm', 1.00, 1.14, 0.01, 0.01, 0.3, 0.7),
    (31.250, 32.500, 'p01_temple', 'dawn', 1.10, 1.24, 0.00, -0.02, 0.0, 0.0),
]
END_T0 = 32.5

# frame impacts: (time, strength)
IMPACTS = [(0.00, 0.55), (12.50, 0.35), (20.00, 0.30), (22.50, 0.95),
           (25.00, 0.45), (27.50, 0.70), (31.25, 0.35)]

TEXTS = [
    (0.35, 2.60, 'HAR RAAT EK NAYI KAHANI', 'small'),
    (6.00, 8.30, 'EK RAAZ. EK SAFAR.', 'small'),
    (11.30, 13.40, 'TUM CHUNO — KYA HOGA?', 'small'),
    (15.30, 17.40, 'PYAAR. SAZAA. AAG.', 'small'),
    (20.20, 22.40, 'NAYE LOG. NAYE RASTE.', 'small'),
    (26.40, 28.60, '94 KAHANIYAN — 0 THE END', 'small'),
    (31.40, 33.20, 'KISSA', 'big'),
]


# ------------------------------------------------------------------- grading
def luts():
    """Per-look tone curves: (gamma, gain rgb, lift rgb, saturation, contrast)."""
    return {
        'dawn':   (1.02, (1.06, 1.00, 0.94), (6, 2, -2), 1.06, 1.10),
        'dusk':   (1.16, (0.94, 0.92, 1.06), (-4, -6, 4), 0.94, 1.16),
        'warm':   (1.00, (1.07, 1.00, 0.90), (5, 1, -3), 1.05, 1.06),
        'amber':  (1.04, (1.06, 0.99, 0.88), (4, 0, -4), 1.02, 1.08),
        'teal':   (1.08, (0.92, 1.00, 1.07), (-4, 0, 6), 1.03, 1.12),
        'neon':   (1.00, (1.03, 0.97, 1.08), (2, 0, 7), 1.12, 1.06),
        'indigo': (1.08, (0.94, 0.96, 1.09), (-3, -2, 7), 1.02, 1.10),
        'fire':   (0.98, (1.10, 0.98, 0.86), (7, 1, -4), 1.10, 1.14),
    }


LOOKS = luts()


def vignette_mask(w, h, strength=0.55):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w / 2, h / 2
    r = np.sqrt(((xx - cx) / (w * 0.62)) ** 2 + ((yy - cy) / (h * 0.58)) ** 2)
    v = np.clip(1.0 - strength * np.clip(r - 0.35, 0, None) ** 1.5, 0.20, 1.0)
    # gentle top/bottom falloff for a trailer frame feel
    ys = np.linspace(0, 1, h, dtype=np.float32)
    band = 0.82 + 0.18 * np.clip(1 - np.abs(ys - 0.5) * 1.5, 0, 1)
    return (v * band[:, None]).astype(np.float32)[:, :, None]


def grade(img, look):
    gamma, gain, lift, sat, con = LOOKS[look]
    a = np.asarray(img, np.float32) / 255.0
    if abs(gamma - 1.0) > 1e-3:
        a = np.clip(a, 0, 1) ** gamma
    a *= np.array(gain, np.float32)
    a += np.array(lift, np.float32) / 255.0
    g = a @ np.array([0.299, 0.587, 0.114], np.float32)
    a = g[..., None] + (a - g[..., None]) * sat
    a = (a - 0.5) * con + 0.5
    a = np.clip(a, 0, 1)
    # filmic shoulder + slight lifted blacks
    a = a * 0.96 + 0.02
    return np.clip(a * 255.0, 0, 255).astype(np.uint8)


_CACHE = {}
_CACHE_ORDER = []


def source(plate, look):
    key = (plate, look)
    if key in _CACHE:
        return _CACHE[key]
    img = Image.open(f'{PLATES}/{plate}.jpg').convert('RGB')
    tw, th = int(W * 1.06), int(H * 1.06)
    img = img.resize((tw, th), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=2.2, percent=118, threshold=2))
    arr = grade(img, look)
    arr = (arr.astype(np.float32) * vignette_mask(tw, th)).astype(np.uint8)
    out = Image.fromarray(arr)
    _CACHE[key] = out
    _CACHE_ORDER.append(key)
    if len(_CACHE_ORDER) > 4:
        _CACHE.pop(_CACHE_ORDER.pop(0), None)
    return out


# ------------------------------------------------------------------ textures
GRAIN_AMP = float(os.environ.get('GRAIN', '3.6'))


def grain_tiles():
    rng = np.random.default_rng(11)
    tiles = []
    for _ in range(6):
        h, w = max(2, int(560 * SCALE)), max(2, int(990 * SCALE))
        g = rng.normal(0, GRAIN_AMP, (h, w)).astype(np.float32)
        # clump the noise so it behaves like film grain instead of sensor hash
        g = Image.fromarray(np.clip(g + 128, 0, 255).astype(np.uint8))
        g = g.filter(ImageFilter.GaussianBlur(0.6)).resize(
            (int(w * 1.35), int(h * 1.35)), Image.BILINEAR)
        g = (np.asarray(g, np.float32) - 128.0) * (GRAIN_AMP / 3.4)
        tiles.append(np.clip(g, -14, 14).astype(np.int16))
    return tiles


GRAIN = grain_tiles()
_rng = np.random.default_rng(2026)


def shake_offset(t):
    x = y = 0.0
    for ti, amp in IMPACTS:
        d = t - ti
        if 0 <= d < 0.55:
            k = amp * math.exp(-d * 9.0)
            x += k * math.sin(d * 91.0) * 26 * SCALE
            y += k * math.cos(d * 77.0) * 20 * SCALE
    return x, y


def frame_for(t):
    if t >= END_T0:
        return end_card(t - END_T0)

    for (t0, t1, plate, look, z0, z1, px, py, rot, punch) in SHOTS:
        if t0 <= t < t1:
            break
    p = (t - t0) / (t1 - t0)
    e = smooth(p)
    z = z0 + (z1 - z0) * e
    if punch:
        z += punch * 0.035 * (1 - ease_out(p * 2.4))
    src = source(plate, look)
    sw, sh = src.size
    base = sw / W                      # source px per output px at z = 1
    s = base / z
    th = math.radians(rot * (0.35 + 0.65 * e))
    ca, sa = math.cos(th), math.sin(th)
    # slow pan, normalised to source size
    ox = px * sw * (e - 0.5) * 0.5
    oy = py * sh * (e - 0.5) * 0.5
    shx, shy = shake_offset(t)
    cx = sw / 2 + ox + shx
    cy = sh / 2 + oy + shy
    a = s * ca
    b = -s * sa
    d = s * sa
    ee = s * ca
    c = cx - a * (W / 2) - b * (H / 2)
    f = cy - d * (W / 2) - ee * (H / 2)
    out = src.transform((W, H), Image.AFFINE, (a, b, c, d, ee, f),
                        resample=Image.BILINEAR)
    arr = np.asarray(out)

    # grain
    tile = GRAIN[_rng.integers(0, len(GRAIN))]
    th_, tw_ = tile.shape
    y0 = int(_rng.integers(0, max(1, th_ - 1)))
    x0 = int(_rng.integers(0, max(1, tw_ - 1)))
    ty = np.tile(tile, (H // th_ + 2, W // tw_ + 2))[y0:y0 + H, x0:x0 + W]
    arr = np.clip(arr.astype(np.int16) + ty[..., None], 0, 255).astype(np.uint8)

    # impact flash + cut-in kick
    fl = 0.0
    for ti, amp in IMPACTS:
        dd = t - ti
        if 0 <= dd < 0.22:
            fl += amp * (1 - dd / 0.22) ** 2.2
    if fl > 0:
        a32 = arr.astype(np.float32)
        a32 += (255.0 - a32) * min(0.55, fl * 0.55)
        a32[..., 0] = np.minimum(255, a32[..., 0] * (1 + fl * 0.05))
        arr = a32.astype(np.uint8)

    img = Image.fromarray(arr)
    img = draw_texts(img, t)
    return img


# --------------------------------------------------------------- typography
def track(draw, xy, text, f, fill, spacing):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + spacing
    return x


def text_sprite(txt, style):
    if style == 'small':
        f = font('Poppins_600SemiBold', int(84 * SCALE))
        sp = 13 * SCALE
    else:
        f = font('PlayfairDisplay_900Black', int(300 * SCALE))
        sp = 8 * SCALE
    pad = int(40 * SCALE)
    tmp = Image.new('RGBA', (10, 10))
    d = ImageDraw.Draw(tmp)
    total = 0
    for ch in txt:
        total += d.textlength(ch, font=f) + sp
    wpx = int(total + pad * 2)
    hpx = int(f.size * 1.9)
    spr = Image.new('RGBA', (wpx, hpx), (0, 0, 0, 0))
    dd = ImageDraw.Draw(spr)
    # soft shadow for legibility over busy plates
    sh = Image.new('RGBA', (wpx, hpx), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    track(ds, (pad + 2 * SCALE, f.size * 0.42 + 3 * SCALE), txt, f, (0, 0, 0, 190), sp)
    spr.alpha_composite(sh.filter(ImageFilter.GaussianBlur(9 * SCALE)))
    track(dd, (pad, f.size * 0.42), txt, f, GOLD_HI if style == 'big' else TEXT, sp)
    return spr


SPRITES = {txt: text_sprite(txt, st) for (_a, _b, txt, st) in TEXTS}

_BAND = None


def bottom_band(img, amount):
    """Soft cinematic scrim behind lower-third copy, so type always reads."""
    global _BAND
    if _BAND is None:
        ys = np.clip((np.linspace(0, 1, H, dtype=np.float32) - 0.55) / 0.45, 0, 1)
        _BAND = (ys ** 1.7 * 0.62).astype(np.float32)[:, None, None]
    a = np.asarray(img, np.float32)
    a *= (1.0 - _BAND * amount)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def draw_texts(img, t):
    for (a, b, txt, style) in TEXTS:
        if not (a <= t <= b):
            continue
        spr = SPRITES[txt]
        r = smooth(clamp((t - a) / 0.45)) * smooth(clamp((b - t) / 0.40))
        if r <= 0.01:
            continue
        s = 1.0 + 0.06 * (1 - smooth(clamp((t - a) / 0.7)))
        w, h = int(spr.width * s), int(spr.height * s)
        sp = spr.resize((w, h), Image.LANCZOS)
        al = sp.split()[3].point(lambda v: int(v * r))
        sp.putalpha(al)
        x = (W - w) // 2
        y = int(H * (0.50 if style == 'big' else 0.785)) - h // 2
        if style == 'small':
            img = bottom_band(img, r)
        img.paste(sp, (x, y), sp)
    return img


# ------------------------------------------------------------------- end card
_END_BG = None
COVER_IDS = ['raat-ki-last-local', 'neon-raani', 'meri-dragon-rani',
             'haveli-ka-chhaya-raaz', 'time-ki-dukaan']
_COVERS = []


def cover_strip():
    """Sideways shelf of real story covers, so the end card shows product."""
    global _COVERS
    if _COVERS:
        return _COVERS
    cw, ch = int(430 * SCALE), int(640 * SCALE)
    rad = int(34 * SCALE)
    for sid in COVER_IDS:
        path = f'{REPO}/content/stories/{sid}/assets/cover.jpg'
        im = Image.open(path).convert('RGB')
        sc = max(cw / im.width, ch / im.height)
        im = im.resize((int(im.width * sc) + 1, int(im.height * sc) + 1), Image.LANCZOS)
        im = im.crop(((im.width - cw) // 2, (im.height - ch) // 2,
                      (im.width - cw) // 2 + cw, (im.height - ch) // 2 + ch))
        mask = Image.new('L', (cw, ch), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, cw - 1, ch - 1], radius=rad, fill=255)
        spr = Image.new('RGBA', (cw + int(60 * SCALE), ch + int(60 * SCALE)), (0, 0, 0, 0))
        cx = (spr.width - cw) // 2
        cy = (spr.height - ch) // 2
        shadow = Image.new('RGBA', spr.size, (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle(
            [cx, cy + int(10 * SCALE), cx + cw, cy + ch + int(10 * SCALE)],
            radius=rad, fill=(0, 0, 0, 190))
        spr.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(22 * SCALE)))
        plate = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        plate.paste(im, (0, 0))
        plate.putalpha(mask)
        spr.alpha_composite(plate, (cx, cy))
        # hairline gold edge
        ImageDraw.Draw(spr).rounded_rectangle(
            [cx, cy, cx + cw - 1, cy + ch - 1], radius=rad,
            outline=(226, 190, 126, 120), width=max(1, int(2 * SCALE)))
        _COVERS.append(spr)
    return _COVERS


def end_backdrop():
    global _END_BG
    if _END_BG is None:
        im = Image.open(f'{PLATES}/p01_temple.jpg').convert('RGB')
        s = max(W / im.width, H / im.height) * 1.12
        im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
        im = im.crop(((im.width - W) // 2, (im.height - H) // 2,
                      (im.width - W) // 2 + W, (im.height - H) // 2 + H))
        im = im.filter(ImageFilter.GaussianBlur(26 * SCALE))
        a = np.asarray(im, np.float32) * 0.20
        # push it down so the middle stays clean for the logo
        ys = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
        a *= (0.35 + 0.9 * np.clip((ys - 0.30) * 1.7, 0, 1))
        _END_BG = Image.fromarray(np.clip(a + 7, 0, 255).astype(np.uint8))
    return _END_BG


def end_card(lt):
    img = end_backdrop().copy()
    d = ImageDraw.Draw(img)
    cy = int(H * 0.36)

    # warm key light behind the wordmark
    glow = Image.new('RGB', (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W * 0.02, cy - H * 0.11, W * 0.98, cy + H * 0.11],
               fill=(58, 38, 17))
    img = Image.fromarray(np.clip(
        np.asarray(img, np.float32)
        + np.asarray(glow.filter(ImageFilter.GaussianBlur(150 * SCALE)), np.float32) * 0.9,
        0, 255).astype(np.uint8))

    f_logo = font('PlayfairDisplay_900Black', int(300 * SCALE))
    f_tag = font('Poppins_400Regular', int(92 * SCALE))
    f_url = font('Poppins_600SemiBold', int(78 * SCALE))
    f_sm = font('Poppins_500Medium', int(54 * SCALE))

    r = ease_out((lt - 0.12) / 0.85)
    if r > 0:
        spr = Image.new('RGBA', (W, int(f_logo.size * 1.7)), (0, 0, 0, 0))
        dd = ImageDraw.Draw(spr)
        wpx = 0
        for ch in 'KISSA':
            wpx += dd.textlength(ch, font=f_logo) + 16 * SCALE
        track(dd, ((W - wpx + 16 * SCALE) // 2, 0), 'KISSA', f_logo,
              GOLD_HI, 16 * SCALE)
        s = 1.09 - 0.09 * r
        spr = spr.resize((int(spr.width * s), int(spr.height * s)), Image.LANCZOS)
        spr.putalpha(spr.split()[3].point(lambda v: int(v * r)))
        x = (W - spr.width) // 2
        img.paste(spr, (x, cy - spr.height // 2), spr)
        # light sweep across the wordmark while it settles
        sweep = smooth(clamp((lt - 0.9) / 1.5))
        if 0 < sweep < 1:
            sx = int(-W * 0.4 + sweep * W * 1.8)
            band = Image.new('L', (W, H), 0)
            ImageDraw.Draw(band).polygon(
                [(sx, 0), (sx + int(90 * SCALE), 0),
                 (sx - int(60 * SCALE), H), (sx - int(150 * SCALE), H)], fill=70)
            band = band.filter(ImageFilter.GaussianBlur(30 * SCALE))
            m = np.asarray(band, np.float32)[..., None] / 255.0
            img = Image.fromarray(np.clip(
                np.asarray(img, np.float32) + m * np.array([210, 180, 130]), 0, 255
            ).astype(np.uint8))

    hr = smooth(clamp((lt - 0.85) / 0.8))
    if hr > 0:
        d = ImageDraw.Draw(img)
        wpx = int(W * 0.30 * hr)
        d.line([(W // 2 - wpx, H * 0.455), (W // 2 + wpx, H * 0.455)],
               fill=GOLD, width=max(1, int(3 * SCALE)))

    if lt > 1.15:
        d = ImageDraw.Draw(img)
        txt = 'Tumhari kahani. Tumhara faisla.'
        d.text(((W - d.textlength(txt, font=f_tag)) // 2, int(H * 0.470)),
               txt, font=f_tag, fill=TEXT)
        txt2 = 'HINDI  ·  94 KAHANIYAN  ·  FREE'
        d.text(((W - d.textlength(txt2, font=f_sm)) // 2, int(H * 0.528)),
               txt2, font=f_sm, fill=DIM)
        pwid = d.textlength('beyondredeye.site', font=f_url)
        padx, pady = 74 * SCALE, 36 * SCALE
        x0 = (W - pwid - padx * 2) / 2
        y0 = H * 0.578
        d.rounded_rectangle([x0, y0, x0 + pwid + padx * 2, y0 + f_url.size + pady * 2],
                            radius=(f_url.size + pady * 2) / 2,
                            outline=GOLD, width=max(2, int(3 * SCALE)))
        d.text((x0 + padx, y0 + pady - 2 * SCALE), 'beyondredeye.site',
               font=f_url, fill=GOLD_HI)

    # cover shelf
    if lt > 1.55:
        covs = cover_strip()
        n = len(covs)
        step = int(covs[0].width * 0.72)
        total = step * (n - 1) + covs[0].width
        x0 = (W - total) // 2
        base_y = int(H * 0.688)
        for i, cv in enumerate(covs):
            a = smooth(clamp((lt - 1.55 - i * 0.14) / 0.55))
            if a <= 0.01:
                continue
            dx = (i - (n - 1) / 2)
            rot = dx * 4.0
            dy = int(28 * SCALE * abs(dx)) - int(34 * SCALE * a)
            spr = cv.rotate(rot, resample=Image.BICUBIC, expand=True)
            spr.putalpha(spr.split()[3].point(lambda v: int(v * a)))
            img.paste(spr, (x0 + i * step - (spr.width - cv.width) // 2,
                            base_y + dy - (spr.height - cv.height) // 2), spr)
        d = ImageDraw.Draw(img)
        y = base_y + int(covs[0].height * 1.02)
        f_cta = font('Poppins_500Medium', int(50 * SCALE))
        txt = 'Naya update — ab 94 kahaniyan'
        d.text(((W - d.textlength(txt, font=f_cta)) // 2, y), txt,
               font=f_cta, fill=GOLD_HI)

    k = smooth(clamp((DUR - END_T0 - 0.55 - lt) / 0.65))
    if k < 1:
        img = Image.fromarray((np.asarray(img, np.float32) * k).astype(np.uint8))
    return img


# --------------------------------------------------------------------- audio
def build_audio(path):
    dur = DUR
    af = (f'loudnorm=I=-14:TP=-1.5:LRA=11,'
          f'afade=t=in:st=0:d=0.35,afade=t=out:st={dur - 2.0:.2f}:d=2.0')
    subprocess.run([FF, '-y', '-v', 'error', '-ss', str(MUSIC_IN), '-i', THEME,
                    '-t', f'{dur}', '-af', af, '-c:a', 'aac', '-b:a', '256k',
                    '-ar', '48000', path], check=True)


# ---------------------------------------------------------------------- main
def render_stills(times):
    os.makedirs('/tmp/ramayan_stills', exist_ok=True)
    for t in times:
        img = frame_for(t)
        p = f'/tmp/ramayan_stills/t{t:05.2f}.png'
        img.save(p)
        print(p)


def main():
    if STILLS:
        render_stills([float(x) for x in STILLS.split(',')])
        return
    aud = '/tmp/ramayan_promo_audio.m4a'
    build_audio(aud)
    n = int(DUR * FPS)
    cmd = [FF, '-y', '-v', 'warning', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
           '-s', f'{W}x{H}', '-r', str(FPS), '-i', 'pipe:0', '-i', aud,
           '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF,
           '-profile:v', 'high', '-level', '5.1', '-pix_fmt', 'yuv420p',
           '-x264-params', 'keyint=60:min-keyint=30',
           '-c:a', 'copy', '-shortest', '-movflags', '+faststart',
           '-metadata', 'title=Kissa — 94 Kahaniyan (9:16 promo)',
           OUT]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        img = frame_for(i / FPS)
        p.stdin.write(img.tobytes())
        if i % 60 == 0:
            print(f'{i}/{n}  {i / FPS:5.1f}s', flush=True)
    p.stdin.close()
    if p.wait() != 0:
        sys.exit('ffmpeg failed')
    print('wrote', OUT, os.path.getsize(OUT) // 1024 // 1024, 'MB')


if __name__ == '__main__':
    main()
