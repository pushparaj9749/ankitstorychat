"""Kissa ad #4 — "Raat 3 Baje" (horror chat). 1080x1920, 30 fps.

Found-footage style: fogged highway at 3 AM, a dhaba that isn't on the map,
then a full-screen Kissa chat (AMOLED) with Meenu from *Hawa-Band Dhaba*,
lights flicker → jump cut → the viewer types / deletes / sends their own
answer → mood switcher (darr → pyaar → action → comedy) → CTA
(beyondredeye.site) → post-credit whisper.

Re-uses drawing / audio helpers of ../ad2/build_ad2.py (fonts live there).
Run:  python3 build_ad4.py [out.mp4]      PREVIEW=t1,t2 python3 build_ad4.py
"""
import math
import os
import subprocess
import sys
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'ad2'))
_argv, sys.argv = sys.argv, sys.argv[:1]
import build_ad2 as b  # noqa: E402
sys.argv = _argv

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter  # noqa: E402

from build_ad2 import (W, H, FPS, FF, BG, ROSE, ROSE_L, GOLD, TEXT, DIM, FAINT,  # noqa: E402
                       PF9, PFI, P4, P5, P6, P7, clamp, ease_out, ease_io, prog, cache, _C, paste, paste_c,
                       rounded, circle, radial, text_sprite, pill, wrap, vgrad, glyph, black,
                       cover, add, tone, noise, kick, boom, whoosh, pad, note, decode, dur_of, SR,
                       VIGNETTE, GRAIN)

OUT = sys.argv[1] if len(sys.argv) > 1 else f'{HERE}/kissa_ad4.mp4'
PREVIEW = os.environ.get('PREVIEW')
REPO = b.REPO
STORY = 'hawa-band-dhaba'
rng = np.random.default_rng(4)
FOGC = np.array([150, 170, 185], dtype=np.float32)
RED = (232, 72, 72)


def asset(p):
    return Image.open(f'{REPO}/content/stories/{STORY}/assets/{p}.jpg').convert('RGB')


IMG_MEENU, IMG_CHAIR, IMG_ROAD, IMG_DHABA = asset('gallery/image-01'), asset('gallery/image-02'), asset('gallery/image-04'), asset('cover')
M_FACE = IMG_MEENU.crop((300, 440, 550, 690))
STORY_THUMB = IMG_DHABA.crop((180, 420, 620, 860))

VO = {k: dur_of(f'{HERE}/vo/{k}.mp3') for k in ['n0', 'n1', 'h1', 'h2', 'n2', 'n3', 'n4', 'h3']}

SEG = {
    'n1': [('Saamne ek dhaba hai…', 0.18, 1.4), ('jiska naam,', 2.26, 3.0), ('map par hai hi nahi.', 3.46, 4.68)],
    'h1': [('Bus?', 0.0, 0.6), ('Main bhi intezaar kar rahi hoon…', 1.42, 2.72), ('pandrah saal se.', 3.3, 4.26)],
    'h2': [('Darro mat…', 0.0, 0.75), ('tumhare liye jagah rakhi hai.', 1.28, 2.75), ('Teesri kursi pe.', 3.07, 4.03)],
}


def word_times(key):
    out = []
    for txt, s, e in SEG[key]:
        ws = txt.split()
        out += [(w_, s + (e - s) * i / len(ws)) for i, w_ in enumerate(ws)]
    return out


class TimedReveal:
    def __init__(self, key, f, maxw=960, accent=()):
        wt = word_times(key)
        space = f.getlength(' ')
        lines = wrap([w_ for w_, _ in wt], f, maxw, space)
        asc, desc = f.getmetrics()
        self.lh = int((asc + desc) * 1.12)
        self.items = []
        k = 0
        for li, ln in enumerate(lines):
            lw = sum(f.getlength(w_) for w_ in ln) + space * (len(ln) - 1)
            x = (W - lw) / 2
            for w_ in ln:
                self.items.append((text_sprite([w_], f, ROSE_L if w_ in accent else TEXT), x - 34, li * self.lh - 34, wt[k][1]))
                x += f.getlength(w_) + space
                k += 1
        self.height = self.lh * len(lines)

    def draw(self, img, y, t, fade=1.0):
        for spr, x, yy, ws in self.items:
            a = ease_out(prog(t, ws, 0.28)) * fade
            paste(img, spr, x, y + yy + (1 - a) * 16, a)


# ------------------------------------------------------------------ look helpers
def grade(img, k=1.0, cold=True):
    a = np.asarray(img, dtype=np.float32)
    if cold:
        g = a.mean(axis=2, keepdims=True)
        a = a * 0.75 + g * 0.25
        a = a * np.array([0.86, 0.97, 1.07], dtype=np.float32)
    return Image.fromarray(np.clip(a * k, 0, 255).astype(np.uint8))


def fill_crop(src, t, d, z0, z1, cx=0.5, cy=0.5, box=(W, H)):
    bw, bh = box
    z = z0 + (z1 - z0) * ease_io(clamp(t / d))
    s = max(bw / src.width, bh / src.height) * z
    vw, vh = bw / s, bh / s
    x0 = clamp(src.width * cx - vw / 2, 0, src.width - vw)
    y0 = clamp(src.height * cy - vh / 2, 0, src.height - vh)
    return src.crop((int(x0), int(y0), int(x0 + vw), int(y0 + vh))).resize((bw, bh), Image.BILINEAR)


def _fog_layer(seed, cell):
    r = np.random.default_rng(seed)
    lw, lh = (2 * W) // cell, H // cell
    n = r.random((lh, lw)).astype(np.float32)
    im = Image.fromarray((n * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2)).resize((2 * W, H), Image.BICUBIC)
    a = np.asarray(im, dtype=np.float32) / 255.0
    a = np.clip((a - 0.35) * 1.8, 0, 1)
    a[:, :W // 4] *= np.linspace(0, 1, W // 4)[None, :] * 0 + 1
    return a


FOG1 = _fog_layer(1, 60)
FOG2 = _fog_layer(2, 34)


def fog(img, t, strength=0.35):
    if strength <= 0:
        return img
    a = np.asarray(img, dtype=np.float32)
    o1 = int(t * 38) % W
    o2 = int(t * 70 + 300) % W
    f = FOG1[:, o1:o1 + W] * 0.65 + FOG2[:, o2:o2 + W] * 0.35
    f = (f * strength)[:, :, None]
    a = a + (FOGC - a) * f
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def brightness(img, k):
    if abs(k - 1) < 1e-3:
        return img
    return Image.fromarray(np.clip(np.asarray(img, dtype=np.float32) * k, 0, 255).astype(np.uint8))


def glitch(img, amt):
    if amt <= 0:
        return img
    arr = np.asarray(img, dtype=np.int16)
    out = arr.copy()
    sh = int(6 + 18 * amt)
    out[:, sh:, 0] = arr[:, :-sh, 0]
    out[:, :-sh, 2] = arr[:, sh:, 2]
    for _ in range(int(3 + 6 * amt)):
        y0 = int(rng.integers(0, H - 60))
        hh = int(rng.integers(10, 70))
        out[y0:y0 + hh] = np.roll(out[y0:y0 + hh], int(rng.integers(-70, 70) * amt), axis=1)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def flicker(t, t0, dur):
    """Tube-light flicker factor in [0.15, 1] during [t0, t0+dur]."""
    if t < t0 or t > t0 + dur:
        return 1.0
    x = (t - t0) / dur
    v = 0.5 + 0.5 * math.sin(x * 60) * math.sin(x * 23 + 1.3)
    return 0.15 + 0.85 * (1.0 if v > 0.45 else 0.25)


def caption(lines, f, color=TEXT):
    return text_sprite(lines, f, color)


# ------------------------------------------------------------------ S0 road
L0 = 0.4
N0_LINES = [('Raat ke 3 baje.', 0.0, TEXT, 70), ('Ghana kohra.', 1.96, TEXT, 70), ('Aur gaadi ka engine…', 3.33, TEXT, 70), ('band.', 5.54, RED, 130)]


def s_road(t, d):
    base = cache('road_g', lambda: grade(IMG_ROAD, 0.95))
    img = fill_crop(base, t, d, 1.0, 1.12, cx=0.55, cy=0.62)
    v = t - L0
    if v > 5.54:   # headlights die
        img = brightness(img, 0.62 + 0.38 * (1 - ease_out(prog(v, 5.54, 0.25))))
    img = fog(img, t, 0.3)
    # found-footage stamp
    rec = cache('rec', lambda: text_sprite(['03:07 AM'], P6(40), (235, 235, 240), spacing=4))
    loc = cache('loc', lambda: text_sprite(['NH-160  •  Nashik ke paas'], P5(30), DIM))
    a = ease_out(prog(t, 0.0, 0.5))
    if int(t * 2) % 2 == 0:
        ImageDraw.Draw(img).ellipse([60, 92, 86, 118], fill=RED)
    paste(img, rec, 70, 66, a)
    paste(img, loc, 70, 126, a * 0.9)
    y = 1180
    for i, (txt, at, col, sz) in enumerate(N0_LINES):
        spr = cache(('n0l', i), lambda txt=txt, col=col, sz=sz: text_sprite([txt], PF9(sz), col))
        p = ease_out(prog(v, at, 0.35))
        if i == 3:
            sc = 1.4 - 0.4 * p
            s = spr.resize((int(spr.width * sc), int(spr.height * sc)), Image.LANCZOS)
            paste_c(img, s, W / 2, y - (s.height - spr.height) / 2, p)
        else:
            paste_c(img, spr, W / 2, y + (1 - p) * 18, p)
        y += spr.height - 50
    return img


# ------------------------------------------------------------------ S1 dhaba + map search
L1 = 0.3


def map_card(typed, state, t):
    w, h = 940, 300
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, w - 1, h - 1], 40, fill=(250, 250, 252, 240))
    # search bar
    d.rounded_rectangle([28, 28, w - 28, 120], 46, fill=(236, 237, 242))
    d.ellipse([56, 54, 92, 90], outline=(90, 94, 110), width=5)
    d.line([(88, 86), (104, 102)], fill=(90, 94, 110), width=6)
    d.text((126, 50), typed, font=P5(40), fill=(30, 32, 40))
    if state == 0 and int(t * 4) % 2 == 0:
        cx = 126 + P5(40).getlength(typed) + 4
        d.line([(cx, 54), (cx, 98)], fill=(66, 133, 244), width=4)
    if state == 1:   # searching spinner
        for k in range(8):
            ang = t * 8 + k * math.pi / 4
            al = int(60 + 190 * (k / 7))
            d.ellipse([w / 2 + 34 * math.cos(ang) - 7, 205 + 34 * math.sin(ang) - 7,
                       w / 2 + 34 * math.cos(ang) + 7, 205 + 34 * math.sin(ang) + 7], fill=(120, 124, 140, al))
    if state == 2:
        # pin with ?
        d.ellipse([60, 160, 150, 250], fill=RED)
        d.text((92, 168), '?', font=P7(54), fill=(255, 255, 255))
        d.text((180, 160), 'Koi result nahi mila', font=P7(44), fill=(30, 32, 40))
        d.text((180, 220), '"Hawa-Band Dhaba" map par exist nahi karta.', font=P4(30), fill=(110, 114, 128))
    return img


def s_map(t, d):
    base = cache('dhaba_g', lambda: grade(IMG_DHABA, 0.78))
    img = fill_crop(base, t, d, 1.05, 1.15, cx=0.45, cy=0.42)
    img = fog(img, t + 8, 0.3)
    bot = cache('mgrad', lambda: vgrad(700, 0, 235))
    img.paste(bot, (0, H - 700), bot)
    v = t - L1
    q = 'Hawa-Band Dhaba'
    typed = q[:int(len(q) * clamp((v + 0.1) / 1.0))]
    state = 0 if v < 1.1 else (1 if v < 3.4 else 2)
    ca = ease_out(prog(t, 0.05, 0.4))
    card = map_card(typed, state, t)
    shake = math.sin(t * 70) * 10 * (1 - clamp((v - 3.4) / 0.3)) if 3.4 <= v < 3.7 else 0
    paste_c(img, card, W / 2 + shake, 230 + (1 - ca) * -60, ca)
    tr = cache('tr_n1', lambda: TimedReveal('n1', PFI(66), 960, accent=('map', 'par', 'hai', 'hi', 'nahi.')))
    tr.draw(img, 1530 - tr.height / 2, v)
    return img


# ------------------------------------------------------------------ chat screen
HDR_Y, CONTENT_Y = 90, 280
COMP_Y = 1730
NARR = 'Andar tube-light jal rahi hai. Chai garam hai. Kone mein peeli raincoat wali ek ladki baithi hai… aur tumhe hi dekh rahi hai.'
U1 = 'Hello? Yahan koi bus milegi?'
U2 = 'Pandrah… saal?'
U3 = 'Meenu… tumhe kya hua tha?'
BF = P4(48)


def status_bar(d):
    d.text((60, 26), '3:07', font=P6(36), fill=TEXT)
    x = W - 300
    for k in range(4):
        hh = 12 + k * 8
        d.rounded_rectangle([x + k * 16, 62 - hh, x + k * 16 + 10, 62], 2, fill=TEXT if k == 0 else (70, 72, 80))
    d.text((W - 210, 26), '12%', font=P6(32), fill=RED)
    d.rounded_rectangle([W - 128, 32, W - 72, 62], 7, outline=(200, 200, 206), width=3)
    d.rectangle([W - 70, 40, W - 64, 54], fill=(200, 200, 206))
    d.rectangle([W - 123, 37, W - 116, 57], fill=RED)


def chat_base():
    img = Image.new('RGB', (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    status_bar(d)
    d.line([(64, 160), (84, 140)], fill=TEXT, width=5)
    d.line([(64, 160), (84, 180)], fill=TEXT, width=5)
    th = circle(STORY_THUMB, 96)
    img.paste(th, (112, 112), th)
    d.text((232, 112), 'Hawa-Band Dhaba', font=P6(40), fill=TEXT)
    d.text((232, 164), 'Horror  •  Mystery', font=P4(28), fill=FAINT)
    d.line([(0, 238), (W, 238)], fill=(28, 29, 35), width=2)
    return img


def text_bubble(txt, user, n_words=None):
    words = txt.split()
    lines = wrap(words, BF, 780, BF.getlength(' '))
    asc, desc = BF.getmetrics()
    lh = int((asc + desc) * 1.14)
    tw = max(BF.getlength(' '.join(l)) for l in lines)
    padx, pady = 34, 24
    w, h = int(tw + padx * 2), lh * len(lines) + pady * 2
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fill = ROSE if user else (30, 32, 40)
    d.rounded_rectangle([0, 0, w - 1, h - 1], 34, fill=fill)
    d.rectangle(([w - 34, h - 34, w - 1, h - 1] if user else [0, 0, 34, 34]), fill=fill)
    k = 0
    for i, l in enumerate(lines):
        x = padx
        for w_ in l:
            if n_words is None or k < n_words:
                d.text((x, pady + i * lh), w_, font=BF, fill=(255, 255, 255) if user else TEXT)
            x += BF.getlength(w_ + ' ')
            k += 1
    return img


def narr_block():
    f = PFI(50)
    lines = [' '.join(l) for l in wrap(NARR.split(), f, 940, f.getlength(' '))]
    return text_sprite(lines, f, (150, 154, 168), gap=1.25, shadow=False)


def meenu_msg(key, txt, v):
    """Meenu bubble whose words stream in sync with her VO (v = time since VO start)."""
    wt = word_times(key)
    n = sum(1 for _, ts in wt if v >= ts)
    return text_bubble(txt, False, max(1, n))


def typing_dots(img, x, y, t, a=1.0):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x, y, x + 150, y + 80], 34, fill=tuple(int(c * a) for c in (30, 32, 40)))
    for i in range(3):
        o = (0.4 + 0.6 * (0.5 + 0.5 * math.sin(t * 10 - i * 0.9))) * a
        d.ellipse([x + 32 + i * 34, y + 30, x + 52 + i * 34, y + 50], fill=tuple(int(c * o) for c in DIM))


def composer(img, txt, t, strike=0.0, focus=False):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([40, COMP_Y, W - 170, COMP_Y + 110], 55, fill=(22, 23, 29), outline=(60, 62, 72) if focus else None, width=2)
    f = P4(40)
    if txt:
        d.text((86, COMP_Y + 30), txt, font=f, fill=TEXT)
        tw = f.getlength(txt)
        if strike > 0:
            d.line([(80, COMP_Y + 57), (80 + (tw + 12) * strike, COMP_Y + 57)], fill=RED, width=5)
        if int(t * 4) % 2 == 0:
            d.line([(90 + tw, COMP_Y + 28), (90 + tw, COMP_Y + 82)], fill=ROSE, width=3)
    else:
        d.text((86, COMP_Y + 30), 'Kuch likho…', font=f, fill=FAINT)
    d.ellipse([W - 150, COMP_Y, W - 40, COMP_Y + 110], fill=ROSE)
    d.polygon([(W - 112, COMP_Y + 32), (W - 112, COMP_Y + 78), (W - 72, COMP_Y + 55)], fill=(255, 255, 255))


def typed(txt, t, t0, t1):
    return txt[:int(len(txt) * clamp((t - t0) / (t1 - t0)))]


# chat timeline (seconds inside S2)
C_NARR = 0.35
C_U1 = (2.4, 4.0, 4.25)        # type start, type end, send
C_M1 = 5.2                     # Meenu 1 + h1 start
C_U2 = (C_M1 + VO['h1'] + 0.15, C_M1 + VO['h1'] + 0.95, C_M1 + VO['h1'] + 1.15)
C_FLK = C_U2[2] + 0.2
C_M2 = C_FLK + 0.75            # Meenu 2 + h2 start
C_OUT = C_M2 + VO['h2'] + 0.35  # power cut
CHAT_D = C_OUT + 0.55


def chat_layout():
    """Return list of (kind, sprite_fn, x, y) positions for all messages (fixed layout)."""
    nb = cache('narr', narr_block)
    y = CONTENT_Y
    pos = {'narr': (W / 2 - nb.width / 2, y - 20)}
    y += nb.height + 10
    u1 = cache('u1', lambda: text_bubble(U1, True))
    pos['u1'] = (W - 50 - u1.width, y)
    y += u1.height + 100
    pos['m1'] = (132, y)
    m1 = cache('m1full', lambda: text_bubble('Bus? Main bhi intezaar kar rahi hoon… pandrah saal se.', False))
    y += m1.height + 40
    u2 = cache('u2', lambda: text_bubble(U2, True))
    pos['u2'] = (W - 50 - u2.width, y)
    y += u2.height + 100
    pos['m2'] = (132, y)
    m2 = cache('m2full', lambda: text_bubble('Darro mat… tumhare liye jagah rakhi hai. Teesri kursi pe.', False))
    y += m2.height + 40
    pos['u3'] = (None, y)
    return pos


def draw_meenu(img, key, txt, xy, v, a):
    x, y = xy
    nm = cache('mnm', lambda: text_sprite(['Meenu'], P6(32), ROSE_L, shadow=False))
    av = cache('mav', lambda: circle(M_FACE, 80))
    bub = meenu_msg(key, txt, v)
    paste(img, nm, x - 30, y - 84 + (1 - a) * 30, a)
    paste(img, av, x - 104, y + 4 + (1 - a) * 30, a)
    paste(img, bub, x, y + (1 - a) * 30, a)


def chat_frame(t, history_dim=1.0, show_all=False, scroll=0):
    img = cache('chatbase', chat_base).copy()
    pos = {k: (x, y - scroll) for k, (x, y) in chat_layout().items()}
    hd = history_dim
    a = ease_out(prog(t, C_NARR, 0.6)) if not show_all else 1
    paste(img, cache('narr', narr_block), *pos['narr'], a * hd)
    # user 1
    if show_all or t >= C_U1[2]:
        ua = 1 if show_all else ease_out(prog(t, C_U1[2], 0.3))
        paste(img, cache('u1', lambda: text_bubble(U1, True)), pos['u1'][0], pos['u1'][1] + (1 - ua) * 40, ua * hd)
    # typing dots → Meenu 1
    if not show_all and C_U1[2] + 0.3 < t < C_M1:
        typing_dots(img, pos['m1'][0], pos['m1'][1], t)
    if show_all or t >= C_M1:
        ma = 1 if show_all else ease_out(prog(t, C_M1, 0.35))
        draw_meenu(img, 'h1', 'Bus? Main bhi intezaar kar rahi hoon… pandrah saal se.', pos['m1'], 99 if show_all else t - C_M1, ma * hd)
    if show_all or t >= C_U2[2]:
        ua = 1 if show_all else ease_out(prog(t, C_U2[2], 0.3))
        paste(img, cache('u2', lambda: text_bubble(U2, True)), pos['u2'][0], pos['u2'][1] + (1 - ua) * 40, ua * hd)
    if not show_all and C_U2[2] + 0.3 < t < C_M2:
        typing_dots(img, pos['m2'][0], pos['m2'][1], t)
    if show_all or t >= C_M2:
        ma = 1 if show_all else ease_out(prog(t, C_M2, 0.35))
        draw_meenu(img, 'h2', 'Darro mat… tumhare liye jagah rakhi hai. Teesri kursi pe.', pos['m2'], 99 if show_all else t - C_M2, ma * hd)
    if scroll:
        img.paste(cache('chatbase', chat_base).crop((0, 0, W, 240)), (0, 0))
    return img, pos


def s_chat(t, d):
    img, pos = chat_frame(t)
    # composer typing
    if C_U1[0] <= t < C_U1[2]:
        composer(img, typed(U1, t, *C_U1[:2]), t, focus=True)
    elif C_U2[0] <= t < C_U2[2]:
        composer(img, typed(U2, t, *C_U2[:2]), t, focus=True)
    else:
        composer(img, '', t)
    # tube-light flicker + glitch
    k = min(flicker(t, C_FLK, 0.7), flicker(t, C_M2 + 2.9, 0.45))
    img = brightness(img, k)
    if C_FLK <= t < C_FLK + 0.7 or C_M2 + 2.9 <= t < C_M2 + 3.35:
        img = glitch(img, 0.5)
    sa = ease_out(prog(t, 0.0, 0.4))
    if sa < 1:
        img = brightness(img, sa)
    if t >= C_OUT:   # power cut
        img = brightness(img, max(0.0, 1 - (t - C_OUT) / 0.08))
    return img


# ------------------------------------------------------------------ S3 jump
def s_jump(t, d):
    base = cache('meenu_g', lambda: grade(IMG_MEENU, 0.9))
    z = 1.55 - 0.30 * ease_out(clamp(t / 0.35)) - 0.05 * clamp((t - 0.35) / 2)
    img = fill_crop(base, 1, 1, z, z, cx=0.5, cy=0.42)
    img = fog(img, t + 3, 0.18)
    if t < 0.5:
        img = glitch(img, 1.0 - t / 0.5)
    if t < 0.12:
        img = Image.blend(img, Image.new('RGB', (W, H), (255, 255, 255)), 0.8 * (1 - t / 0.12))
    if t > 0.9:
        img = brightness(img, 1 - 0.55 * ease_out(prog(t, 0.9, 0.5)))
        q = cache('jq', lambda: text_sprite([[('Ab… ', TEXT), ('aap kya karoge?', RED)]], PF9(92)))
        a = ease_out(prog(t, 1.0, 0.4))
        paste_c(img, q, W / 2, 1460 + (1 - a) * 24, a)
    return img


# ------------------------------------------------------------------ S4 type / delete / send
L4 = 0.3
ATTEMPTS = [('Bhaag jaata hoon!', -0.05, 0.75, 0.95, 1.2),     # (text, type start, type end, strike, delete end)
            ('Chai pee leta hoon…', 1.25, 1.95, 2.1, 2.35)]
U3_T = (2.45, 3.45, 3.7)


def s_type(t, d):
    v = t - L4
    img, pos = chat_frame(99, history_dim=0.35, show_all=True, scroll=200)
    txt, strike = '', 0.0
    for a_txt, s, e, st, de in ATTEMPTS:
        if s <= v < st:
            txt = typed(a_txt, v, s, e)
        elif st <= v < de:
            txt = a_txt[:int(len(a_txt) * (1 - clamp((v - st - 0.1) / (de - st - 0.1))))] if v > st + 0.1 else a_txt
            strike = clamp((v - st) / 0.1)
    if U3_T[0] <= v < U3_T[2]:
        txt = typed(U3, v, U3_T[0], U3_T[1])
    composer(img, txt, t, strike=strike, focus=True)
    # labels for what the viewer is trying (big, readable)
    tags = [('BHAAGO?', 0.0, 1.2), ('RUKO?', 1.13, 2.35), ('YA SACH POOCHHO.', 1.99, 3.7)]
    for i, (tg, s, e) in enumerate(tags):
        spr = cache(('tg', i), lambda tg=tg, i=i: text_sprite([tg], PF9(72), RED if i < 2 else ROSE))
        a = ease_out(prog(v, s, 0.2)) * (1 - ease_out(prog(v, e - 0.1, 0.2)))
        paste_c(img, spr, W / 2, 1585 + (1 - a) * 20, a)
    if v >= U3_T[2]:
        ub = cache('u3', lambda: text_bubble(U3, True))
        ua = ease_out(prog(v, U3_T[2], 0.3))
        y3 = pos['u3'][1]
        paste(img, ub, W - 50 - ub.width, y3 + (1 - ua) * 40, ua)
        if v > U3_T[2] + 0.4 and y3 + ub.height + 130 < COMP_Y:
            typing_dots(img, 132, y3 + ub.height + 40, t)
        # punch line
        dk = ease_out(prog(v, 3.85, 0.35))
        if dk > 0:
            img = brightness(img, 1 - 0.78 * dk)
            l1 = cache('pl1', lambda: text_sprite(['Kahani wahi banegi…'], PF9(88), TEXT))
            l2 = cache('pl2', lambda: text_sprite(['jo aap likhoge.'], PF9(100), ROSE))
            paste_c(img, l1, W / 2, 760 + (1 - dk) * 20, dk)
            a2 = ease_out(prog(v, 5.35, 0.35))
            paste_c(img, l2, W / 2, 880 + (1 - a2) * 20, a2)
    return img


# ------------------------------------------------------------------ S5 mood switcher
L5 = 0.25
MOODS = [('DARR', STORY, 0.0), ('PYAAR', 'biwi-ek-supari-killer', 1.69), ('ACTION', 'highway-ki-sherni', 2.67),
         ('COMEDY', 'don-ki-beti-mera-dil', 3.57)]
GRID_T, KISSA_T = 4.47, 6.09
GRID_IDS = ['dulhan-bhagi-shadi-se', 'madam-sarkar', 'thakurain', 'ring-ki-rani', 'don-ki-beti-mera-dil',
            'meri-hacker-girlfriend', 'chudail-nahi-biwi-hai', 'commando-wife', 'biwi-ek-supari-killer']


def mood_bg(i, t):
    cid = MOODS[i][1]
    def mk():
        c = cover(cid)
        s_ = W / c.width
        c = c.resize((W, int(c.height * s_)), Image.LANCZOS)
        out = Image.fromarray((np.asarray(c.resize((W // 10, H // 10)).filter(ImageFilter.GaussianBlur(4)).resize((W, H), Image.BILINEAR), dtype=np.float32) * 0.4).astype(np.uint8))
        out.paste(c, (0, 0))
        g = vgrad(260, 0, 255)
        out.paste(g, (0, c.height - 260), g)
        return out
    src = cache(('mbg', cid), mk)
    if cid == STORY:
        return fill_crop(cover(cid), t, 3.0, 1.0, 1.08, cx=0.5, cy=0.45)
    z = 1.0 + 0.04 * clamp(t / 3.0)
    return fill_crop(src, 1, 1, z, z, cx=0.5, cy=0.4)


def seg_control(img, active, slide, struck):
    labels = [m[0] for m in MOODS]
    f = P7(38)
    widths = [f.getlength(l_) + 64 for l_ in labels]
    total = sum(widths) + 14 * 3
    x0 = W / 2 - total / 2
    xs = []
    x = x0
    for w_ in widths:
        xs.append(x)
        x += w_ + 14
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x0 - 16, 1560, x0 + total + 16, 1680], 60, fill=(12, 12, 16))
    # sliding highlight
    i0, i1 = int(math.floor(slide)), min(3, int(math.floor(slide)) + 1)
    fr = slide - i0
    hx = xs[i0] + (xs[i1] - xs[i0]) * fr
    hw = widths[i0] + (widths[i1] - widths[i0]) * fr
    d.rounded_rectangle([hx, 1574, hx + hw, 1666], 46, fill=ROSE)
    for k, l_ in enumerate(labels):
        col = (255, 255, 255) if k == active else (150, 152, 164)
        d.text((xs[k] + 32, 1594), l_, font=f, fill=col)
    if struck > 0:
        d.line([(xs[0] + 20, 1620), (xs[0] + 20 + (widths[0] - 40) * struck, 1620)], fill=(255, 255, 255), width=6)


def s_mood(t, d):
    v = t - L5
    if v < GRID_T:
        idx = max(i for i, m in enumerate(MOODS) if v >= m[2] - 0.3 or i == 0)
        nxt_t = MOODS[idx][2]
        p = clamp((v - (nxt_t - 0.3)) / 0.3) if idx > 0 else 1.0
        cur = mood_bg(idx, v)
        if idx == 0:
            cur = fog(grade(cur, 0.8), t, 0.3)
        if p < 1:
            prev = mood_bg(idx - 1, v)
            if idx - 1 == 0:
                prev = fog(grade(prev, 0.8), t, 0.3)
            pe = ease_io(p)
            img = black()
            img.paste(prev, (int(-pe * W), 0))
            img.paste(cur, (int((1 - pe) * W), 0))
            bl = math.sin(math.pi * p)
            if bl > 0.05:
                img = Image.blend(img, img.resize((W // 16, H)).resize((W, H), Image.BILINEAR), min(1, bl * 0.9))
        else:
            img = cur
        g = cache('mood_grad', lambda: vgrad(820, 0, 240))
        img.paste(g, (0, H - 820), g)
        slide = idx - 1 + ease_io(p) if idx > 0 else 0
        seg_control(img, idx if p > 0.5 else max(0, idx - 1), slide, clamp((v - 0.9) / 0.25) if idx == 0 else 1.0)
        q = cache('mq', lambda: text_sprite(['Darr nahi chahiye?'], PF9(84), TEXT))
        qa = ease_out(prog(v, 0.0, 0.3)) * (1 - ease_out(prog(v, 1.45, 0.25)))
        paste_c(img, q, W / 2, 1360, qa)
        big = cache(('mword', idx), lambda: text_sprite([MOODS[idx][0]], PF9(150), TEXT, spacing=8))
        ba = ease_out(prog(v, MOODS[idx][2], 0.25)) if idx > 0 else 0
        paste_c(img, big, W / 2, 1330 + (1 - ba) * 20, ba)
        return img
    # grid zoom-out
    if 'grid9' not in _C:
        cw, ch, gap = 330, 492, 16
        gw, gh = 3 * cw + 2 * gap, 3 * ch + 2 * gap
        gimg = Image.new('RGB', (gw, gh), BG)
        for k, cid in enumerate(GRID_IDS):
            gimg.paste(cover(cid).resize((cw, ch), Image.LANCZOS), ((k % 3) * (cw + gap), (k // 3) * (ch + gap)))
        _C['grid9'] = gimg
    gimg = _C['grid9']
    zp = ease_out(clamp((v - GRID_T) / 0.7))
    s = (W / (gimg.width / 3)) * (1 - zp) + (W * 1.0 / gimg.width) * zp
    s *= 1.0 + 0.04 * clamp((v - GRID_T - 0.7) / 2.5)
    vw, vh = W / s, H / s
    cx, cy = gimg.width / 2, gimg.height / 2
    crop = Image.new('RGB', (int(vw), int(vh)), BG)
    crop.paste(gimg, (int(vw / 2 - cx), int(vh / 2 - cy)))
    img = crop.resize((W, H), Image.BILINEAR)
    img = brightness(img, 1 - 0.45 * ease_out(prog(v, GRID_T + 0.6, 0.4)))
    l1 = cache('hm1', lambda: text_sprite(['Har mood ki kahani,'], PF9(86), TEXT))
    a1 = ease_out(prog(v, GRID_T + 0.4, 0.35))
    paste_c(img, l1, W / 2, 780 + (1 - a1) * 20, a1)
    l2 = cache('hm2', lambda: text_sprite([[('Kissa ', ROSE), ('mein.', TEXT)]], PF9(110)))
    a2 = ease_out(prog(v, KISSA_T, 0.35))
    paste_c(img, l2, W / 2, 900 + (1 - a2) * 20, a2)
    return img


# ------------------------------------------------------------------ S6 CTA
L6 = 0.4


def s_cta(t, d):
    base = cache('cta_bg', lambda: grade(IMG_ROAD, 0.42))
    img = fill_crop(base, t, d, 1.08, 1.0, cx=0.5, cy=0.6)
    img = fog(img, t + 20, 0.32)
    glow = cache('cglow', lambda: radial(1100, ROSE, 0.40))
    img.paste(glow, (W // 2 - 550, 560 - 550), glow)
    v = t - L6
    ic = cache('icon4', lambda: rounded(b.ICON.resize((330, 330), Image.LANCZOS), 76))
    p = ease_out(prog(v, 0.0, 0.6))
    s = ic.resize((int(330 * (0.75 + 0.25 * p)),) * 2, Image.LANCZOS)
    paste(img, s, W / 2 - s.width / 2, 560 - s.height / 2, p)
    k = cache('kissa4', lambda: text_sprite(['KISSA'], PF9(190), TEXT, spacing=26))
    q = ease_out(prog(v, 0.15, 0.5))
    paste_c(img, k, W / 2, 760 + (1 - q) * 30, q)
    t1 = cache('ct1', lambda: text_sprite(['Agar himmat hai…'], PFI(70), TEXT))
    t2 = cache('ct2', lambda: text_sprite(['toh kahani shuru karo.'], PFI(70), ROSE))
    a1 = ease_out(prog(v, 1.16, 0.45))
    a2 = ease_out(prog(v, 2.45, 0.45))
    paste_c(img, t1, W / 2, 1000 + (1 - a1) * 24, a1)
    paste_c(img, t2, W / 2, 1090 + (1 - a2) * 24, a2)
    btn = cache('btn4', lambda: pill('Abhi download karo', P7(54), (255, 255, 255), ROSE, padx=70, pady=30))
    bb_a = ease_out(prog(v, 3.9, 0.5))
    pulse = 1 + 0.035 * math.sin(max(0, v - 4.4) * 5)
    bb = btn.resize((int(btn.width * pulse), int(btn.height * pulse)), Image.LANCZOS)
    paste(img, cache('bglow4', lambda: radial(760, ROSE, 0.35)), W / 2 - 380, 1320 - 380, bb_a)
    paste(img, bb, W / 2 - bb.width / 2, 1320 - bb.height / 2 + (1 - bb_a) * 30, bb_a)
    andr = cache('andr4', lambda: text_sprite(['Android  •  Free APK'], P6(36), GOLD))
    url = cache('url4', lambda: text_sprite(['beyondredeye.site'], P7(64), TEXT))
    c = ease_out(prog(v, 4.3, 0.5))
    paste_c(img, andr, W / 2, 1455, c)
    paste_c(img, url, W / 2, 1515, c)
    return img


# ------------------------------------------------------------------ S7 post-credit whisper
L7 = 0.5


def s_tease(t, d):
    base = cache('chair_g', lambda: grade(IMG_CHAIR, 0.42))
    img = fill_crop(base, t, d, 1.05, 1.12, cx=0.62, cy=0.55)
    a = ease_out(prog(t, 0.0, 0.5))
    k = a * flicker(t, d - 1.0, 0.6)
    if t > d - 0.4:
        k = 0
    img = brightness(img, k)
    w1 = cache('wh', lambda: text_sprite(['…main intezaar karungi.'], PFI(62), (220, 222, 230)))
    wa = ease_out(prog(t, L7 + 0.9, 0.4)) * (1 if t < d - 0.4 else 0)
    paste_c(img, w1, W / 2, 1480, wa)
    w2 = cache('wh2', lambda: text_sprite(['Hawa-Band Dhaba  •  sirf Kissa par'], P5(34), DIM))
    paste_c(img, w2, W / 2, 1580, wa * 0.9)
    return img


# ------------------------------------------------------------------ timeline
SCN = [
    ('road', s_road, L0 + VO['n0'] + 0.25, 'fade'),
    ('map', s_map, L1 + VO['n1'] + 0.45, 'fade'),
    ('chat', s_chat, CHAT_D, 'cut'),
    ('jump', s_jump, 2.5, 'cut'),
    ('type', s_type, L4 + VO['n2'] + 0.55, 'flash'),
    ('mood', s_mood, L5 + VO['n3'] + 0.45, 'flash'),
    ('cta', s_cta, L6 + VO['n4'] + 1.9, 'fade'),
    ('tease', s_tease, L7 + VO['h3'] + 1.3, 'cut'),
]
IDX = {k: i for i, (k, *_r) in enumerate(SCN)}
SCENES = [s[1] for s in SCN]
DURS = [s[2] for s in SCN]
CUT = [s[3] for s in SCN]
STARTS = np.cumsum([0] + DURS[:-1]).tolist()
TOTAL = float(sum(DURS))
S = lambda k: STARTS[IDX[k]]
VO_AT = [('n0', S('road') + L0), ('n1', S('map') + L1), ('h1', S('chat') + C_M1), ('h2', S('chat') + C_M2),
         ('n2', S('type') + L4), ('n3', S('mood') + L5), ('n4', S('cta') + L6), ('h3', S('tease') + L7)]
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
    fade = min(clamp(T / 0.6), 1.0)
    if fade < 1:
        arr = arr * fade
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


# ------------------------------------------------------------------ audio
def wind(dur, amp):
    # generate at low rate then upsample (fast) — rumbling, slowly gusting wind
    lo = 2205
    n = rng.normal(0, 1, int(dur * lo)).astype(np.float32)
    k = np.ones(9) / 9
    n = np.convolve(n, k, mode='same')
    t = np.arange(len(n)) / lo
    gust = 0.55 + 0.45 * np.sin(2 * np.pi * 0.13 * t) * np.sin(2 * np.pi * 0.071 * t + 1)
    n = n * gust
    x = np.interp(np.arange(int(dur * SR)) / SR, t, n).astype(np.float32)
    hiss = rng.normal(0, 1, len(x)).astype(np.float32) * 0.08
    hiss = np.convolve(hiss, np.ones(6) / 6, mode='same')
    gf = np.interp(np.arange(len(x)) / SR, t, gust).astype(np.float32)
    return (x + hiss * gf) * amp


def key_click(amp=0.09):
    n = noise(0.025, amp, 160)
    tt = tone(3200, 0.012, amp * 0.3, decay=300)
    n[: len(tt)] += tt
    return n


def hum(dur, amp):
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * 100 * t) * 0.6 + np.sin(2 * np.pi * 200 * t) * 0.3 + np.sin(2 * np.pi * 300 * t) * 0.1
    return (s * amp).astype(np.float32)


def buzz(dur, amp):
    t = np.arange(int(dur * SR)) / SR
    gate = (np.sin(2 * np.pi * 17 * t) > 0).astype(np.float32)
    s = np.sign(np.sin(2 * np.pi * 100 * t)) * 0.5 + rng.normal(0, 0.3, len(t))
    return (s * gate * amp).astype(np.float32)


def cluster(dur, amp, base=45):
    t = np.arange(int(dur * SR)) / SR
    s = np.zeros_like(t)
    for m in (base, base + 1, base + 6, base + 7):
        s += np.sin(2 * np.pi * note(m) * t + 0.3 * np.sin(2 * np.pi * 0.2 * t))
    env = np.minimum(t / 2.0, 1) * np.minimum((dur - t) / 1.0, 1)
    return (s / 4 * env * amp).astype(np.float32)


def screech(dur=0.9, amp=0.12):
    t = np.arange(int(dur * SR)) / SR
    s = np.zeros_like(t)
    for f0 in (1760, 1864, 2489):
        s += np.sin(2 * np.pi * f0 * t + 8 * np.sin(2 * np.pi * 7 * t))
    env = np.minimum(t / 0.02, 1) * np.exp(-t * 3.2)
    return (s / 3 * env * amp + noise(dur, amp * 0.6, 4)[: len(t)]).astype(np.float32)


def crank(dur=1.6, amp=0.22):
    t = np.arange(int(dur * SR)) / SR
    rate = 9 - 4 * (t / dur)
    ph = np.cumsum(rate) / SR
    puls = (np.sin(2 * np.pi * ph) > 0.2).astype(np.float32)
    n = rng.normal(0, 1, len(t)).astype(np.float32)
    n = np.convolve(n, np.ones(25) / 25, mode='same')
    s = n * puls * (1 - 0.7 * t / dur) + np.sin(2 * np.pi * 55 * t) * puls * 0.3
    return (s * amp).astype(np.float32)


def bell(f=220, dur=4.0, amp=0.12):
    t = np.arange(int(dur * SR)) / SR
    s = np.zeros_like(t)
    for r, a, dcy in ((1, 1, 0.9), (2.76, 0.5, 1.6), (5.4, 0.25, 2.6), (8.9, 0.12, 3.5)):
        s += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dcy)
    return (s * amp * np.minimum(t / 0.005, 1)).astype(np.float32)


def pluck(f, dur, amp):
    t = np.arange(int(dur * SR)) / SR
    s = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 9)
    return (s * amp * np.minimum(t / 0.004, 1)).astype(np.float32)


def music():
    n = int((TOTAL + 1) * SR)
    m = np.zeros(n, dtype=np.float32)
    # wind under everything until the mood switch
    add(m, 0.0, wind(S('mood') + 0.5, 0.35))
    add(m, 0.0, cluster(S('chat') + 0.5, 0.14, 33))
    # heartbeat-y low pulses on road
    for k in range(5):
        add(m, 0.9 + k * 1.1, kick(0.22))
    # engine crank and die on "engine… band"
    add(m, S('road') + L0 + 3.4, crank(1.7, 0.22))
    add(m, S('road') + L0 + 5.54, tone(60, 0.25, 0.25, decay=14))
    # map: blips, then error buzz
    for k in range(12):
        add(m, S('map') + L1 - 0.05 + k * 0.085, key_click(0.05))
    add(m, S('map') + L1 + 3.4, tone(220, 0.18, 0.09, decay=6) + tone(207.6, 0.18, 0.09, decay=6))
    add(m, S('map') + L1 + 3.6, tone(196, 0.3, 0.09, decay=5))
    # chat: tube-light hum, key clicks, send / receive blips, heartbeat
    c0 = S('chat')
    add(m, c0, hum(CHAT_D, 0.018))
    add(m, c0, cluster(CHAT_D, 0.12, 38))
    for (s0_, e0_, snd), txt in ((C_U1, U1), (C_U2, U2)):
        for k in range(len(txt)):
            if txt[k] != ' ':
                add(m, c0 + s0_ + (e0_ - s0_) * k / len(txt), key_click())
        add(m, c0 + snd, tone(1567.98, 0.2, 0.06, decay=14))
    add(m, c0 + C_M1, tone(659.3, 0.35, 0.06, decay=8) + tone(622.3, 0.35, 0.04, decay=8))
    add(m, c0 + C_M2, tone(659.3, 0.35, 0.06, decay=8) + tone(622.3, 0.35, 0.04, decay=8))
    add(m, c0 + C_FLK, buzz(0.7, 0.05))
    add(m, c0 + C_M2 + 2.9, buzz(0.45, 0.05))
    for k in range(int((C_OUT - C_M2) / 0.8) + 1):
        tb = c0 + C_M2 + k * 0.8
        add(m, tb, kick(0.3))
        add(m, tb + 0.2, kick(0.2))
    add(m, c0 + C_OUT, tone(48, 0.4, 0.3, decay=10))   # power cut thunk
    # jump scare
    j0 = S('jump')
    add(m, j0, boom(0.9))
    add(m, j0, screech(1.0, 0.13))
    add(m, j0 + 0.9, cluster(1.8, 0.16, 50))
    # type: ticking clock + clicks + backspace + send
    y0 = S('type') + L4
    add(m, S('type'), cluster(DURS[IDX['type']], 0.12, 40))
    for k in range(int(DURS[IDX['type']] / 0.5)):
        add(m, S('type') + k * 0.5, noise(0.03, 0.08, 120))
    for a_txt, s, e, st, de in ATTEMPTS:
        for k in range(len(a_txt)):
            add(m, y0 + s + (e - s) * k / len(a_txt), key_click(0.08))
        add(m, y0 + st, tone(180, 0.15, 0.08, decay=10))
        for k in range(6):
            add(m, y0 + st + 0.1 + k * 0.025, key_click(0.07))
    for k in range(len(U3)):
        add(m, y0 + U3_T[0] + (U3_T[1] - U3_T[0]) * k / len(U3), key_click(0.08))
    add(m, y0 + U3_T[2], tone(1567.98, 0.2, 0.07, decay=14))
    add(m, y0 + 3.85, boom(0.5)[: int(1.5 * SR)])
    # mood switch: genre flavours
    m0 = S('mood') + L5
    add(m, m0 - 0.2, cluster(1.9, 0.12, 36))
    for _, _, at in MOODS[1:]:
        add(m, m0 + at - 0.3, whoosh(0.35, 0.16))
    add(m, m0 + 1.69, pad([60, 64, 67, 71], 1.0, 0.16))                      # pyaar
    for k in range(4):
        add(m, m0 + 2.67 + k * 0.22, kick(0.4))                                 # action
    add(m, m0 + 2.67, noise(0.2, 0.08, 14))
    for k, nn in enumerate([67, 72, 69, 74, 71]):
        add(m, m0 + 3.57 + k * 0.16, pluck(note(nn), 0.2, 0.08))                # comedy
    add(m, m0 + GRID_T, boom(0.55)[: int(1.4 * SR)])
    beat = 60 / 112
    tb, j = m0 + GRID_T, 0
    while tb < S('cta') - 0.05:
        add(m, tb, kick(0.36) if j % 2 == 0 else noise(0.16, 0.08, 22))
        add(m, tb + beat / 2, noise(0.05, 0.03, 60))
        tb += beat
        j += 1
    add(m, m0 + GRID_T, pad([57, 60, 64], S('cta') - (m0 + GRID_T) + 0.3, 0.15))
    # CTA: boom, eerie pad, bell
    c6 = S('cta')
    add(m, c6 - 0.4, whoosh(0.6, 0.2))
    add(m, c6, boom(0.75))
    add(m, c6, pad([45, 52, 57, 60], DURS[IDX['cta']] + 0.3, 0.17))
    add(m, c6, wind(DURS[IDX['cta']], 0.18))
    add(m, c6 + L6 + 1.16, bell(220, 4.0, 0.10))
    add(m, c6 + L6 + 3.9, bell(330, 3.0, 0.07))
    # tease: wind + music box
    t7 = S('tease')
    add(m, t7, wind(DURS[IDX['tease']], 0.25))
    for k, nn in enumerate([76, 72, 69, 71, 64]):
        add(m, t7 + 0.2 + k * 0.55, pluck(note(nn), 0.9, 0.035))
    add(m, t7 + DURS[IDX['tease']] - 1.0, buzz(0.6, 0.04))
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
    fade = np.clip((TOTAL - t) / 0.6, 0, 1)
    mix = voice + mus * 0.8 * duck * fade
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix = mix / max(1.0, np.max(np.abs(mix)) / 0.95)
    mix = mix[: int(TOTAL * SR)]
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes())


if __name__ == '__main__':
    print('scenes', [(k, round(DURS[IDX[k]], 2), round(STARTS[IDX[k]], 2)) for k in IDX], 'total', round(TOTAL, 2))
    if PREVIEW:
        for ts in PREVIEW.split(','):
            frame_at(float(ts)).resize((540, 960)).save(f'/tmp/ad4_prev_{float(ts):05.1f}.jpg', quality=85)
        sys.exit(0)
    wav = '/tmp/ad4_audio.wav'
    build_audio(wav)
    nframes = int(TOTAL * FPS)
    proc = subprocess.Popen(
        [FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
         '-i', wav, '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-maxrate', '5M', '-bufsize', '10M',
         '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', OUT],
        stdin=subprocess.PIPE,
    )
    for fi in range(nframes):
        proc.stdin.write(frame_at(fi / FPS, fi).tobytes())
        if fi % 300 == 0:
            print(f'frame {fi}/{nframes}', flush=True)
    proc.stdin.close()
    proc.wait()
    print('done', OUT)
