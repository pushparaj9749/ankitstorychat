"""Kissa ad #3 — "Ek Sawaal. Do Jawab." 1080x1920, 30 fps.

One moment from *Biwi Ek Supari Killer*, played twice: the viewer taps answer
A, sees Kaashvi's reply, REWINDS, taps answer B and gets a completely
different story. Then split-screen ("kahani pehle se likhi nahi hoti"),
memory callback, genre montage and the CTA (beyondredeye.site).

Re-uses the drawing / audio helpers of ../ad2/build_ad2.py (fonts live there).
Run:  python3 build_ad3.py [out.mp4]      PREVIEW=t1,t2 python3 build_ad3.py
Needs: pillow numpy imageio-ffmpeg.
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
                       rounded, circle, radial, text_sprite, pill, wrap, vgrad, glyph, black, bubble,
                       cover, add, tone, noise, kick, boom, whoosh, pad, note, decode, dur_of, SR,
                       VIGNETTE, GRAIN)

OUT = sys.argv[1] if len(sys.argv) > 1 else f'{HERE}/kissa_ad3.mp4'
PREVIEW = os.environ.get('PREVIEW')
REPO = b.REPO
STORY = 'biwi-ek-supari-killer'
rng = np.random.default_rng(7)


def gal(n):
    return Image.open(f'{REPO}/content/stories/{STORY}/assets/gallery/image-0{n}.jpg').convert('RGB')


IMG_BOX, IMG_CHHAYA, IMG_FEED, IMG_CORN, IMG_CHAI = gal(6), gal(2), gal(1), gal(5), gal(7)
KCOVER = cover(STORY)
K_FACE = KCOVER.crop((300, 455, 460, 615))

VO = {k: dur_of(f'{HERE}/vo/{k}.mp3') for k in ['n0', 'h0', 'hA', 'hB', 'hM', 'n1', 'n2', 'n3']}

# phrase timings inside each clip (from ffmpeg silencedetect)
SEG = {
    'h0': [('Tumne "shaadi ke bartan" wala baksa khol hi liya na…?', 0.0, 2.5), ('Toh ab bolo,', 3.4, 4.05),
           ('jaan.', 4.6, 4.95), ('Sach sunoge…', 5.45, 6.15), ('ya bhaag jaoge?', 6.65, 7.45)],
    'hA': [('Duniya mujhse darti hai…', 0.0, 1.6), ('aur tum?', 2.5, 3.0), ('Darr ke bhi ruk gaye.', 3.7, 4.85),
           ('Aaj se tum meri sabse badi kamzori ho.', 5.95, 8.6)],
    'hB': [('Mummy ka address bhi mujhe pata hai,', 0.2, 1.85), ('jaan.', 2.1, 2.5), ('Baitho na…', 3.2, 3.7),
           ('khana thanda ho raha hai.', 4.4, 5.45)],
    'hM': [('Us raat tumne kaha tha na…', 0.2, 1.6), ('"Main kahin nahi jaaunga."', 2.4, 3.6),
           ('Mujhe har lafz yaad hai.', 4.5, 6.05)],
}
ACCENT = {'h0': ('Sach', 'sunoge…', 'ya', 'bhaag', 'jaoge?'),
          'hA': ('kamzori', 'ho.'),
          'hB': ('khana', 'thanda', 'ho', 'raha', 'hai.'),
          'hM': ('"Main', 'kahin', 'nahi', 'jaaunga."')}


class TimedReveal:
    """Subtitle whose words appear in sync with the phrase timings of a VO clip."""

    def __init__(self, key, f, maxw=960):
        self.f = f
        words, times = [], []
        for txt, s, e in SEG[key]:
            ws = txt.split()
            for i, w_ in enumerate(ws):
                words.append(w_)
                times.append(s + (e - s) * i / len(ws))
        space = f.getlength(' ')
        lines = wrap(words, f, maxw, space)
        asc, desc = f.getmetrics()
        self.lh = int((asc + desc) * 1.12)
        self.items = []
        k = 0
        acc = ACCENT.get(key, ())
        for li, ln in enumerate(lines):
            lw = sum(f.getlength(w_) for w_ in ln) + space * (len(ln) - 1)
            x = (W - lw) / 2
            for w_ in ln:
                col = ROSE_L if w_ in acc else TEXT
                self.items.append((text_sprite([w_], f, col), x - 34, li * self.lh - 34, times[k]))
                x += f.getlength(w_) + space
                k += 1
        self.height = self.lh * len(lines)

    def draw(self, img, y, t, fade=1.0):
        for spr, x, yy, ws in self.items:
            a = ease_out(prog(t, ws, 0.28)) * fade
            paste(img, spr, x, y + yy + (1 - a) * 16, a)


# ------------------------------------------------------------------ image helpers
def pan_crop(src, box_h, t, d, c0, c1, z0=1.0, z1=1.08, cy=0.5):
    """Crop a W x box_h window that pans horizontally from c0 to c1 (fractions of width)."""
    pz = clamp(t / d)
    zoom = z0 + (z1 - z0) * pz
    scale = box_h / src.height * zoom
    sw = src.width * scale
    cx = (c0 + (c1 - c0) * ease_io(pz)) * sw
    x0 = clamp(cx - W / 2, 0, sw - W)
    sh_ = box_h / scale
    sy0 = clamp((src.height - sh_) * cy, 0, src.height - sh_)
    return src.crop((int(x0 / scale), int(sy0), int(math.ceil((x0 + W) / scale)), int(sy0 + sh_))).resize((W, box_h), Image.BILINEAR)


def ambient(key, src, dim=0.35):
    return cache(('amb3', key), lambda: Image.fromarray((np.asarray(
        src.resize((W // 8, H // 8)).filter(ImageFilter.GaussianBlur(6)).resize((W, H), Image.BILINEAR),
        dtype=np.float32) * dim).astype(np.uint8)))


def darken(img, k):
    return Image.fromarray((np.asarray(img, dtype=np.float32) * k).astype(np.uint8))


TOP, BOX_H = 230, 1460          # image band used in the story scenes
GT = vgrad(300, 255, 0)
GB = vgrad(560, 0, 255)


def story_band(img, src, key, t, d, c0, c1, cy=0.5):
    img.paste(ambient(key, src), (0, 0))
    img.paste(pan_crop(src, BOX_H, t, d, c0, c1, cy=cy), (0, TOP))
    img.paste(GT, (0, TOP), GT)
    img.paste(GB, (0, TOP + BOX_H - 560), GB)
    img.paste(Image.new('RGB', (W, TOP), BG), (0, 0))
    img.paste(Image.new('RGB', (W, H - TOP - BOX_H), BG), (0, TOP + BOX_H))


def watermark(img):
    wm = cache('wm3', lambda: text_sprite(['KISSA'], PF9(40), (200, 200, 208), spacing=12, shadow=False))
    paste_c(img, wm, W / 2, 1800, 0.6)


# ------------------------------------------------------------------ S0 hook: "Ek sawaal. Do jawab. Do kahaniyan."
L0 = 0.35


def s_hook(t, d):
    img = darken(pan_crop(IMG_BOX, H, t, d, 0.42, 0.47, 1.0, 1.12, cy=0.5), 0.42)
    v = t - L0
    lines = [('Ek sawaal.', 0.0, TEXT, 560), ('Do jawab.', 1.45, TEXT, 760),
             ('Do kahaniyan.', 2.85, ROSE, 960)]
    for i, (txt, at, col, y) in enumerate(lines):
        spr = cache(('hk', i), lambda txt=txt, col=col: text_sprite([txt], PF9(130), col))
        p = ease_out(prog(v, at, 0.35))
        sc = 1.18 - 0.18 * p
        s = spr.resize((int(spr.width * sc), int(spr.height * sc)), Image.LANCZOS)
        paste_c(img, s, W / 2, y - (s.height - spr.height) / 2, p)
    sub = cache('hk_sub', lambda: text_sprite(['Ek kahani. Aapke faisle.'], P5(40), DIM))
    paste_c(img, sub, W / 2, 1220, ease_out(prog(v, 3.6, 0.5)))
    return img


# ------------------------------------------------------------------ S1 Kaashvi's question
L1 = 0.45


def s_question(t, d):
    img = black()
    story_band(img, IMG_CHHAYA, 'chhaya', t, d, 0.49, 0.53, cy=0.45)
    tag = cache('k_tag', lambda: text_sprite([[('KAASHVI', GOLD), ('   urf ', DIM), ('CHHAYA', ROSE)]], P7(40), spacing=10))
    ttl = cache('k_ttl', lambda: text_sprite(['Biwi Ek Supari Killer'], PF9(66)))
    a = ease_out(prog(t, 0.1, 0.5))
    paste_c(img, tag, W / 2, 70 + (1 - a) * 20, a)
    paste_c(img, ttl, W / 2, 125 + (1 - a) * 20, a)
    tr = cache('tr_h0', lambda: TimedReveal('h0', PFI(62), 960))
    tr.draw(img, TOP + BOX_H - 120 - tr.height, t - L1)
    watermark(img)
    return img


# ------------------------------------------------------------------ choice screen (phone with A/B chips)
PH_X, PH_Y, PH_W, PH_H = 120, 340, 840, 1180
Q_MSG = 'Sach sunoge… ya bhaag jaoge?'
ANS = {'A': 'Sach batao. Main kahin nahi jaaunga.', 'B': 'Main… mummy ke ghar ja raha hoon!'}


def phone3():
    ph = Image.new('RGBA', (PH_W, PH_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ph)
    d.rounded_rectangle([0, 0, PH_W - 1, PH_H - 1], 84, fill=(28, 29, 35))
    d.rounded_rectangle([12, 12, PH_W - 13, PH_H - 13], 74, fill=(0, 0, 0))
    d.rounded_rectangle([PH_W / 2 - 72, 30, PH_W / 2 + 72, 62], 16, fill=(18, 18, 22))
    av = circle(K_FACE, 84)
    ph.paste(av, (40, 92), av)
    d.text((142, 96), 'Kaashvi', font=P6(36), fill=TEXT)
    d.text((142, 140), 'online', font=P4(26), fill=(92, 201, 149))
    d.line([(30, 200), (PH_W - 30, 200)], fill=(34, 36, 44), width=2)
    return ph


def chip(letter, txt, state):
    """state 0 idle, 1 pressed/selected."""
    f = P5(33)
    w = int(f.getlength(txt) + 140)
    h = 100
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if state:
        d.rounded_rectangle([0, 0, w - 1, h - 1], h // 2, fill=ROSE)
    else:
        d.rounded_rectangle([0, 0, w - 1, h - 1], h // 2, fill=(22, 23, 29), outline=ROSE, width=3)
    d.ellipse([14, 14, 86, 86], fill=(255, 255, 255) if state else ROSE)
    lf = P7(38)
    d.text((50 - lf.getlength(letter) / 2, 20), letter, font=lf, fill=ROSE if state else (255, 255, 255))
    d.text((104, 28), txt, font=f, fill=(255, 255, 255))
    return img


def choice_frame(t, d, pick, quick):
    """quick=False: first time (bubble + chips animate in, tap A late).  quick=True: replay, tap B early."""
    img = black()
    glow = cache('chglow', lambda: radial(1500, ROSE, 0.18))
    img.paste(glow, (W // 2 - 750, 260 - 750), glow)
    hdr = cache('ch_hdr', lambda: text_sprite([[('Aap ', TEXT), ('kya bologe?', ROSE)]], PF9(96)))
    ha = 1.0 if quick else ease_out(prog(t, 0.0, 0.4))
    paste_c(img, hdr, W / 2, 120 + (1 - ha) * 20, ha)
    ph = cache('phone3', phone3).copy()
    # Kaashvi's question
    qb = cache('qb', lambda: bubble(Q_MSG, False, P4(40), 560))
    nm = cache('qnm', lambda: text_sprite(['Kaashvi'], P6(26), ROSE_L, shadow=False))
    av = cache('kav56', lambda: circle(K_FACE, 58))
    qa = 1.0 if quick else ease_out(prog(t, 0.15, 0.4))
    y = 250
    paste(ph, nm, 72, y - 30 + (1 - qa) * 30, qa)
    paste(ph, av, 28, y + 46 + (1 - qa) * 30, qa)
    paste(ph, qb, 100, y + 40 + (1 - qa) * 30, qa)
    # chips, bottom of the phone
    tap = 0.75 if quick else 1.9
    for i, L in enumerate('AB'):
        sel = (L == pick and t >= tap)
        c = cache(('chip', L, sel), lambda L=L, sel=sel: chip(L, ANS[L], sel))
        ca = 1.0 if quick else ease_out(prog(t, 0.55 + i * 0.18, 0.4))
        dim_other = 0.35 if (t >= tap + 0.15 and L != pick) else 1.0
        cy = PH_H - 330 + i * 128
        paste(ph, c, PH_W / 2 - c.width / 2, cy + (1 - ca) * 60, ca * dim_other)
    img.paste(ph, (PH_X, PH_Y), ph)
    # finger tap ripple
    if t >= tap - 0.25:
        cyc = PH_Y + PH_H - 330 + (0 if pick == 'A' else 128) + 50
        cxc = W / 2 + 120
        r = 30 + 160 * ease_out(clamp((t - tap) / 0.5))
        al = int(200 * (1 - clamp((t - tap) / 0.5))) if t >= tap else 160
        rr = Image.new('RGBA', (440, 440), (0, 0, 0, 0))
        dd = ImageDraw.Draw(rr)
        if t >= tap:
            dd.ellipse([220 - r, 220 - r, 220 + r, 220 + r], outline=(255, 255, 255, al), width=6)
        dot = 44 if t < tap else 44 * (1 - 0.3 * clamp((t - tap) / 0.2))
        dd.ellipse([220 - dot, 220 - dot, 220 + dot, 220 + dot], fill=(255, 255, 255, 150 if t < tap + 0.35 else 0))
        img.paste(rr, (int(cxc - 220), int(cyc - 220)), rr)
    tick = cache('ch_tick', lambda: text_sprite(['Kahani aapke jawab ka intezaar kar rahi hai…'], P5(34), FAINT))
    paste_c(img, tick, W / 2, 1600, 0.0 if quick else ease_out(prog(t, 0.9, 0.4)))
    return img


def s_choiceA(t, d):
    return choice_frame(t, d, 'A', False)


def s_choiceB(t, d):
    return choice_frame(t, d, 'B', True)


# ------------------------------------------------------------------ answer scenes
LP = 1.05   # user bubble shows first, then her VO


def answer_frame(t, d, which, src, key, c0, c1, vo, cy=0.5):
    img = black()
    story_band(img, src, key, t, d, c0, c1, cy=cy)
    lab = cache(('lab', which), lambda: pill(f'JAWAB {which}', P7(40), (255, 255, 255), ROSE, padx=40, pady=14))
    a = ease_out(prog(t, 0.0, 0.35))
    paste_c(img, lab, W / 2, 70 + (1 - a) * 20, a)
    ub = cache(('ans_ub', which), lambda: bubble(ANS[which], True, P5(42), 700))
    ua = ease_out(prog(t, 0.15, 0.4))
    paste(img, ub, W - 60 - ub.width, TOP + 40 + (1 - ua) * 40, ua)
    tr = cache(('tr', vo), lambda: TimedReveal(vo, PFI(62), 960))
    tr.draw(img, TOP + BOX_H - 120 - tr.height, t - LP)
    watermark(img)
    return img


def s_ansA(t, d):
    return answer_frame(t, d, 'A', IMG_CORN, 'corn', 0.36, 0.44, 'hA', cy=0.6)


def s_ansB(t, d):
    return answer_frame(t, d, 'B', IMG_FEED, 'feed', 0.30, 0.40, 'hB', cy=0.55)


# ------------------------------------------------------------------ rewind
def s_rewind(t, d):
    p = clamp(t / d)
    # run answer A backwards fast, then the choice screen backwards
    if p < 0.7:
        tt = DURS[IDX['ansA']] * (1 - p / 0.7) ** 1.6
        base = s_ansA(tt, DURS[IDX['ansA']])
    else:
        tt = DURS[IDX['choiceA']] * (1 - (p - 0.7) / 0.3) * 0.9 + 0.6
        base = s_choiceA(tt, DURS[IDX['choiceA']])
    arr = np.asarray(base, dtype=np.int16)
    # VHS: chroma split + rolling jitter bands + scanlines + desat
    out = arr.copy()
    sh = 14
    out[:, sh:, 0] = arr[:, :-sh, 0]
    out[:, :-sh, 2] = arr[:, sh:, 2]
    for _ in range(5):
        y0 = int(rng.integers(0, H - 80))
        hh = int(rng.integers(20, 90))
        dx = int(rng.integers(-60, 60))
        out[y0:y0 + hh] = np.roll(out[y0:y0 + hh], dx, axis=1)
    out[::4] = (out[::4] * 0.55).astype(np.int16)
    g = out.mean(axis=2, keepdims=True)
    out = (out * 0.6 + g * 0.4)
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    rw = cache('rw', lambda: text_sprite(['REWIND'], P7(64), (255, 255, 255)))
    if int(t * 6) % 2 == 0:
        dd = ImageDraw.Draw(img)
        for k in range(2):
            x = 70 + k * 46
            dd.polygon([(x + 46, 108), (x + 46, 168), (x, 138)], fill=(255, 255, 255))
        paste(img, rw, 160, 70, 1.0)
    return img


# ------------------------------------------------------------------ split screen
SPLIT_T, BAND = 830, 260


def s_split(t, d):
    img = black()
    hA_ = 830
    top = pan_crop(IMG_CORN, hA_, t, d, 0.38, 0.44, 1.0, 1.06, cy=0.55)
    bot = pan_crop(IMG_FEED, hA_, t, d, 0.36, 0.30, 1.0, 1.06, cy=0.5)
    pa = ease_out(prog(t, 0.0, 0.45))
    pb = ease_out(prog(t, 0.15, 0.45))
    img.paste(top, (int(-(1 - pa) * W), 0))
    img.paste(bot, (int((1 - pb) * W), H - hA_))
    g1 = cache('sg1', lambda: vgrad(220, 0, 255))
    g2 = cache('sg2', lambda: vgrad(220, 255, 0))
    img.paste(g1, (0, hA_ - 220), g1)
    img.paste(g2, (0, H - hA_), g2)
    for L, y in (('A', 60), ('B', H - hA_ + 60)):
        bd = cache(('badge', L), lambda L=L: pill(f'JAWAB {L}', P7(34), (255, 255, 255), ROSE, padx=30, pady=10))
        paste(img, bd, 50, y, pa if L == 'A' else pb)
    v = t - 0.3
    l1 = cache('sp1', lambda: text_sprite(['Kahani pehle se', 'likhi nahi hoti.'], PF9(74), TEXT, gap=1.08))
    l2 = cache('sp2', lambda: text_sprite([[('Aap jo bologe,', TEXT)], [('kahani wahi banegi.', ROSE)]], PF9(74), gap=1.08))
    a1 = ease_out(prog(v, 0.0, 0.4)) * (1 - ease_out(prog(v, 2.55, 0.25)))
    a2 = ease_out(prog(v, 2.85, 0.4))
    cyy = H / 2
    paste_c(img, l1, W / 2, cyy - l1.height / 2 + (1 - a1) * 20, a1)
    paste_c(img, l2, W / 2, cyy - l2.height / 2 + (1 - a2) * 20, a2)
    return img


# ------------------------------------------------------------------ memory callback
LM = 0.75


def s_memory(t, d):
    img = black()
    story_band(img, IMG_CHAI, 'chai', t, d, 0.47, 0.52, cy=0.55)
    txt = 'EK MAHINA BAAD'
    n = int(len(txt) * clamp(t / 0.6))
    if n:
        spr = text_sprite([txt[:n]], P7(44), GOLD, spacing=14)
        paste(img, spr, W / 2 - text_sprite([txt], P7(44), GOLD, spacing=14).width / 2, 80, 1.0)
    tr = cache('tr_hM', lambda: TimedReveal('hM', PFI(64), 960))
    tr.draw(img, TOP + BOX_H - 120 - tr.height, t - LM)
    mem = cache('mem_pill', lambda: pill('Kissa har baat yaad rakhta hai', P6(38), (255, 255, 255), (36, 37, 46), padx=40, pady=16))
    ic = cache('mem_ic', lambda: glyph('seal', 46, ROSE))
    m = ease_out(prog(t, LM + 5.0, 0.45))
    x = W / 2 - (mem.width + 60) / 2
    paste(img, ic, x, 1745 + 18, m)
    paste(img, mem, x + 60, 1745, m)
    return img


# ------------------------------------------------------------------ genre montage + "sirf aapke phone mein" + "nayi kahaniyan"
GENRES = [('ROMANCE', 'crush-on-roof', 0.18), ('ACTION', 'commando-wife', 1.19),
          ('HORROR', 'pahadon-wali-haveli', 2.14), ('COMEDY', 'don-ki-beti-mera-dil', 2.98)]
LG = 0.2
WALL3 = ['biwi-ek-supari-killer', 'dulhan-bhagi-shadi-se', 'madam-sarkar', 'thakurain', 'meri-hacker-girlfriend',
         'zara-mumbai-mafia-queen', 'ring-ki-rani', 'chudail-nahi-biwi-hai', 'dil-ki-wasooli', 'highway-ki-sherni',
         'contract-wali-shaadi', 'arranged-marriage-wala-love', 'meri-wali-ips', 'commando-wife', 'crush-on-roof',
         'don-ki-beti-mera-dil', 'goddess-who-chose-me', 'witch-who-loves-a-human']
WALL3 = [c for c in WALL3 if os.path.exists(f'{REPO}/content/stories/{c}/assets/cover.jpg')]


def full_cover(cid):
    def mk():
        c = cover(cid)
        s = max(W / c.width, H / c.height) * 1.08
        return c.resize((int(c.width * s) + 1, int(c.height * s) + 1), Image.LANCZOS)
    return cache(('fc', cid), mk)


def s_montage(t, d):
    v = t - LG
    gi = max([i for i, g in enumerate(GENRES) if v >= g[2] - 0.12] or [0])
    if v < 3.75:
        name, cid, at = GENRES[gi]
        big = full_cover(cid)
        lt = max(0.0, v - (at - 0.12))
        z = 1.0 - 0.06 * clamp(lt / 1.2)
        sw, sh = int(W / z * 0.926), int(H / z * 0.926)
        x0, y0 = (big.width - sw) // 2, (big.height - sh) // 2
        img = big.crop((x0, y0, x0 + sw, y0 + sh)).resize((W, H), Image.BILINEAR)
        g = cache('mgb', lambda: vgrad(900, 0, 235))
        img.paste(g, (0, H - 900), g)
        word = cache(('gw', name), lambda name=name: text_sprite([name], PF9(170), TEXT, spacing=10))
        p = ease_out(prog(lt, 0.0, 0.25))
        sc = 1.35 - 0.35 * p
        ws = word.resize((int(word.width * sc), int(word.height * sc)), Image.LANCZOS)
        paste_c(img, ws, W / 2, 1380 - (ws.height - word.height) / 2, p)
        dd = ImageDraw.Draw(img)
        for k in range(4):
            x = W / 2 - 4 * 64 / 2 + k * 64 + 6
            dd.rounded_rectangle([x, 1640, x + 52, 1647], 4, fill=ROSE if k == gi else (70, 72, 82))
        if lt < 0.16:   # flash on each genre hit
            img = Image.blend(img, Image.new('RGB', (W, H), (255, 255, 255)), (1 - lt / 0.16) * 0.7)
        return img
    # wall phase
    if 'wall3' not in _C:
        cw, chh, gap = 330, 492, 20
        tile = Image.new('RGB', (3 * (cw + gap), 2 * len(WALL3) // 3 * (chh + gap) + 2 * (chh + gap)), BG)
        k = 0
        rows = tile.height // (chh + gap)
        for c_ in range(3):
            for r in range(rows):
                tile.paste(cover(WALL3[(r * 3 + c_ * 7) % len(WALL3)]).resize((cw, chh), Image.BILINEAR), (c_ * (cw + gap), r * (chh + gap)))
                k += 1
        _C['wall3'] = (tile, cw, chh, gap)
    tile, cw, chh, gap = _C['wall3']
    img = black()
    wt = v - 3.75
    period = tile.height - H - 10
    for c_ in range(3):
        sp = (120, -95, 140)[c_]
        off = int((600 + wt * sp + c_ * 333) % period)
        col = tile.crop((c_ * (cw + gap), off, c_ * (cw + gap) + cw, off + H))
        img.paste(darken(col, 0.33), (int(W / 2 - 1.5 * cw - gap + c_ * (cw + gap)), 0))
    wa = ease_out(prog(wt, 0.0, 0.3))
    if wa < 1:
        img = darken(img, wa)
    glow = cache('mglow', lambda: radial(1200, ROSE, 0.30))
    img.paste(glow, (W // 2 - 600, H // 2 - 600), glow)
    phase2 = v >= 7.7
    if not phase2:
        ic = cache('m_lock', lambda: glyph('lock', 150, ROSE))
        t1 = cache('m_t1', lambda: text_sprite([[('Saari kahaniyan,', TEXT)], [('sirf aapke phone mein.', ROSE)]], PF9(84), gap=1.08))
        a = ease_out(prog(v, 4.2, 0.4)) * (1 - ease_out(prog(v, 7.45, 0.25)))
        paste(img, ic, W / 2 - 75, 700 + (1 - a) * 20, a)
        paste_c(img, t1, W / 2, 880 + (1 - a) * 20, a)
    else:
        ic = cache('m_spark', lambda: glyph('spark', 150, ROSE))
        t2 = cache('m_t2', lambda: text_sprite([[('Nayi kahaniyan', TEXT)], [('aati rehti hain.', ROSE)]], PF9(90), gap=1.08))
        a = ease_out(prog(v, 7.75, 0.4))
        paste(img, ic, W / 2 - 75, 700 + (1 - a) * 20, a)
        paste_c(img, t2, W / 2, 880 + (1 - a) * 20, a)
        nb = cache('nayi', lambda: pill('NAYI', P7(30), (255, 255, 255), ROSE, padx=22, pady=8))
        for k, (x, y, at) in enumerate([(120, 330, 8.0), (760, 520, 8.3), (180, 1420, 8.6), (720, 1560, 8.9)]):
            p = ease_out(prog(v, at, 0.3))
            if p > 0:
                s = nb.resize((max(1, int(nb.width * (0.6 + 0.4 * p))), max(1, int(nb.height * (0.6 + 0.4 * p)))), Image.LANCZOS)
                paste(img, s, x, y, p)
    return img


# ------------------------------------------------------------------ CTA (re-uses ad #2's, new tagline)
def s_cta(t, d):
    _C['tag8'] = cache('tag8_ad3', lambda: text_sprite([[('Agla jawab… ', TEXT), ('aapka.', ROSE)]], PFI(70)))
    return b.s8(t, d)


# ------------------------------------------------------------------ timeline
SCN = [
    ('hook', s_hook, L0 + VO['n0'] + 0.35, 'fade'),
    ('question', s_question, L1 + VO['h0'] + 0.45, 'flash'),
    ('choiceA', s_choiceA, 2.9, 'fade'),
    ('ansA', s_ansA, LP + VO['hA'] + 0.35, 'flash'),
    ('rewind', s_rewind, 1.25, 'cut'),
    ('choiceB', s_choiceB, 1.55, 'cut'),
    ('ansB', s_ansB, LP + VO['hB'] + 0.55, 'flash'),
    ('split', s_split, 0.3 + VO['n1'] + 0.55, 'flash'),
    ('memory', s_memory, LM + VO['hM'] + 0.9, 'fade'),
    ('montage', s_montage, LG + VO['n2'] + 0.35, 'flash'),
    ('cta', s_cta, 0.4 + VO['n3'] + 2.3, 'fade'),
]
IDX = {k: i for i, (k, *_r) in enumerate(SCN)}
SCENES = [s[1] for s in SCN]
DURS = [s[2] for s in SCN]
CUT = [s[3] for s in SCN]
STARTS = np.cumsum([0] + DURS[:-1]).tolist()
TOTAL = float(sum(DURS))
VO_AT = [('n0', STARTS[IDX['hook']] + L0), ('h0', STARTS[IDX['question']] + L1),
         ('hA', STARTS[IDX['ansA']] + LP), ('hB', STARTS[IDX['ansB']] + LP),
         ('n1', STARTS[IDX['split']] + 0.3), ('hM', STARTS[IDX['memory']] + LM),
         ('n2', STARTS[IDX['montage']] + LG), ('n3', STARTS[IDX['cta']] + 0.4)]
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
def tick(amp=0.12):
    return noise(0.03, amp, 120) + tone(2400, 0.03, amp * 0.4, decay=150)


def pluck(f, dur, amp):
    t = np.arange(int(dur * SR)) / SR
    s = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 9)
    return (s * amp * np.minimum(t / 0.004, 1)).astype(np.float32)


def rewind_sfx(dur):
    t = np.arange(int(dur * SR)) / SR
    f = 900 + 2600 * (t / dur) + 300 * np.sin(2 * np.pi * 23 * t)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.06
    s += noise(dur, 0.05, 0.0)[: len(s)] * 0.6
    return (s * np.minimum(t / 0.05, 1) * np.minimum((dur - t) / 0.08, 1)).astype(np.float32)


def music():
    n = int((TOTAL + 1) * SR)
    m = np.zeros(n, dtype=np.float32)
    S = lambda k: STARTS[IDX[k]]
    D = lambda k: DURS[IDX[k]]
    # hook: low tension drone + hits on each line
    add(m, 0.0, pad([40, 47, 52], D('hook') + 0.5, 0.20))
    for at in (0.0, 1.45, 2.85):
        add(m, L0 + at, boom(0.35)[: int(1.3 * SR)])
    # question: dark pulse 80 bpm (heartbeat-ish)
    q0 = S('question')
    add(m, q0, boom(0.8))
    add(m, q0, pad([40, 43, 47], D('question') + 0.3, 0.17))
    k = 0
    while q0 + 0.6 + k * 0.75 < S('choiceA'):
        add(m, q0 + 0.6 + k * 0.75, kick(0.32))
        add(m, q0 + 0.82 + k * 0.75, kick(0.2))
        k += 1
    # choice A: clock ticks + rising tension, tap blip
    for k in range(int(D('choiceA') / 0.5)):
        add(m, S('choiceA') + k * 0.5, tick(0.10 + 0.02 * k))
    add(m, S('choiceA'), tone(note(64), D('choiceA'), 0.03, attack=1.5))
    add(m, S('choiceA') + 1.9, tone(1568, 0.25, 0.07, decay=14))
    # answer A: warm romantic arpeggio (major)
    a0 = S('ansA')
    add(m, a0, pad([48, 55, 60, 64], D('ansA') + 0.2, 0.17))
    arp = [60, 64, 67, 72, 67, 64]
    for k in range(int(D('ansA') / 0.32)):
        ch_shift = [0, 0, -3, -3, 5, 5, 2, 2][(k // 12) % 8]
        add(m, a0 + k * 0.32, pluck(note(arp[k % 6] + ch_shift), 0.6, 0.05))
    # rewind
    add(m, S('rewind'), rewind_sfx(D('rewind')))
    # choice B: quick ticks + tap
    for k in range(3):
        add(m, S('choiceB') + k * 0.4, tick(0.12))
    add(m, S('choiceB') + 0.75, tone(1568, 0.25, 0.07, decay=14))
    # answer B: playful pizzicato bounce (comedic-dangerous)
    b0 = S('ansB')
    seq = [57, 64, 60, 64, 57, 64, 62, 65, 55, 62, 59, 62, 56, 64, 59, 64]
    for k in range(int(D('ansB') / 0.25)):
        add(m, b0 + k * 0.25, pluck(note(seq[k % 16]), 0.22, 0.07))
        if k % 4 == 0:
            add(m, b0 + k * 0.25, pluck(note(seq[k % 16] - 24), 0.3, 0.08))
    add(m, b0 + LP + 2.1, tone(note(45), 0.5, 0.10, decay=5))  # the "jaan." sting
    # split: build
    s0_ = S('split')
    add(m, s0_, pad([45, 52, 57, 60], D('split') + 0.3, 0.17))
    for k in range(int(D('split') / 0.6)):
        add(m, s0_ + k * 0.6, kick(0.3 if k % 2 == 0 else 0.18))
        add(m, s0_ + k * 0.6 + 0.3, noise(0.05, 0.03, 60))
    # memory: soft
    add(m, S('memory'), pad([53, 57, 60, 64], D('memory') + 0.3, 0.15))
    for k in range(int(D('memory') / 0.45)):
        add(m, S('memory') + k * 0.45, pluck(note([72, 69, 65, 69][k % 4]), 0.8, 0.03))
    # montage: groove 110 bpm with hits on genres
    g0 = S('montage')
    beat = 60 / 110
    chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
    j = 0
    tb = g0
    while tb < S('cta') - 0.05:
        add(m, tb, kick(0.42) if j % 2 == 0 else noise(0.18, 0.10, 22))
        add(m, tb + beat / 2, noise(0.05, 0.035, 60))
        if j % 8 == 0:
            ch = chords[(j // 8) % 4]
            add(m, tb, pad(ch, beat * 8 + 0.3, 0.15))
            add(m, tb, tone(note(ch[0] - 24), beat * 8, 0.11, attack=0.05))
        tb += beat
        j += 1
    for _, _, at in GENRES:
        add(m, g0 + LG + at - 0.1, boom(0.4)[: int(0.9 * SR)])
        add(m, g0 + LG + at - 0.1, noise(0.2, 0.07, 16))
    # CTA
    c0 = S('cta')
    add(m, c0 - 0.4, whoosh(0.6, 0.2))
    add(m, c0, boom(0.7))
    add(m, c0, pad([45, 52, 57, 60, 64], D('cta') + 0.5, 0.2))
    add(m, c0 + 2.6, tone(note(81), 2.5, 0.06, decay=1.2) + tone(note(88), 2.5, 0.04, decay=1.4))
    # whooshes into flash cuts
    for i, c in enumerate(CUT):
        if c == 'flash':
            add(m, STARTS[i] - 0.4, whoosh(0.45, 0.13))
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
    print('scenes', [(k, round(DURS[IDX[k]], 2), round(STARTS[IDX[k]], 2)) for k in IDX], 'total', round(TOTAL, 2))
    if PREVIEW:
        for ts in PREVIEW.split(','):
            frame_at(float(ts)).resize((540, 960)).save(f'/tmp/ad3_prev_{float(ts):05.1f}.jpg', quality=85)
        sys.exit(0)
    wav = '/tmp/ad3_audio.wav'
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
