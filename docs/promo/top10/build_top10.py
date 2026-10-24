#!/usr/bin/env python3
"""Kissa — "10 Sabse Khatarnak Heroines" countdown video (16:9, 1920x1080, 30 fps).

Usage:
  python3 build_top10.py [out.mp4]
  PREVIEW=1      -> render at 1/3 fps-ish (every 6th frame) for a fast look
  STILLS=t1,t2   -> only write PNG stills at those times to /tmp/top10_stills
  CRF / MAXRATE  -> encoder overrides
"""
import json
import math
import os
import subprocess
import sys

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from music_dark import make_music  # noqa: E402

FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS, SR = 1920, 1080, 30, 48000
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
STORIES = f'{REPO}/content/stories'
FONTS = f'{HERE}/../ad2/fonts'
VO = f'{HERE}/vo'
OUT = sys.argv[1] if len(sys.argv) > 1 else f'{HERE}/../kissa_top10_heroines.mp4'
PREVIEW = os.environ.get('PREVIEW')
STILLS = os.environ.get('STILLS')

ROSE = (240, 86, 126)
ROSE_L = (245, 138, 165)
GOLD = (226, 190, 126)
TEXT = (246, 246, 249)
DIM = (186, 188, 200)
FAINT = (120, 124, 138)


def font(name, size):
    return ImageFont.truetype(f'{FONTS}/{name}.ttf', size)


P4 = lambda s: font('Poppins_400Regular', s)
P5 = lambda s: font('Poppins_500Medium', s)
P6 = lambda s: font('Poppins_600SemiBold', s)
P7 = lambda s: font('Poppins_700Bold', s)
P8 = lambda s: font('Poppins_800ExtraBold', s)
PF = lambda s: font('PlayfairDisplay_900Black', s)
PFI = lambda s: font('PlayfairDisplay_700Bold_Italic', s)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_io(x):
    x = clamp(x)
    return 3 * x * x - 2 * x * x * x


def back_out(x):
    x = clamp(x)
    c = 1.9
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


# ----------------------------------------------------------------------------- data
HEROINES = [
    dict(rank=10, id='meri-hacker-girlfriend', name='Inaaya', alias='PHANTOM', role='Hacker  ·  Bengaluru', level=6,
         gal=[2, 1, 4, 6], dlg=7, vo='r10',
         line='Hi, player one. Photo se zyada cute ho tum... aur haan, main hi Phantom hoon.',
         chunks=['Number das — Inaaya, yaani Phantom.', 'Bengaluru ki woh hacker, jiske ek click par',
                 'poore sheher ke CCTV, bank aur satellite jhuk jaate hain.', 'Chaar mahine se woh tumhari online girlfriend hai,',
                 'aur aaj pehli baar milne aayi hai.', 'Tumhare manager ne tumhara kaam churaya?',
                 'Inaaya ko uska password tak pata hai.', 'Kahani — Meri Hacker Girlfriend.']),
    dict(rank=9, id='don-ki-beti-mera-dil', name='Sitara Ghosh', alias=None, role='Don ki beti  ·  Kolkata', level=6,
         gal=[2, 1, 3, 5], dlg=7, vo='r09',
         line='Pen wapas nahi milega. Aur tum bhi nahi... tum mere ho.',
         chunks=['Number nau — Sitara Ghosh.', 'Kolkata ke sabse bade don, Shankar Dada ki iklauti beti.',
                 'Exam hall mein tumne bas ek pen udhaar diya tha...', 'aur usi din usne ailaan kar diya — ye mera hai.',
                 'Ab uske bodyguards tumhare peechhe saaye ki tarah chalte hain,', 'woh din mein bees baar call karti hai,',
                 'aur jis senior ne tumhein dhakka diya tha,', 'woh agle din college hi nahi aaya.', 'Kahani — Don Ki Beti, Mera Dil.']),
    dict(rank=8, id='thakurain', name='Rudrani Bundela', alias='THAKURAIN', role='Thakurain  ·  Chambal', level=7,
         gal=[2, 4, 1, 6], dlg=5, vo='r08',
         line='Poora Chambal mujhse darta hai... aur main? Main bas tumse sharmaati hoon.',
         chunks=['Number aath — Thakurain Rudrani Bundela.', 'Kandhe par dunaali, haath mein jeep ki steering,',
                 'aur aankhon mein aisi aag ki Chambal ke daaku bhi raasta badal lein.',
                 'Ek mele mein usne tumhein, gaon ke sharmeele master ji ko,', 'bas ek baar dekha —',
                 'aur tay kar liya ki shaadi karegi toh sirf tumse.', 'Aaj suhaagraat hai...',
                 'aur poore ilaake ki Thakurain ghunghat mein sharma rahi hai.', 'Kahani — Thakurain.']),
    dict(rank=7, id='commando-wife', name='Major Aditi Rana', alias=None, role='Special Forces  ·  Indian Army', level=7,
         gal=[2, 1, 3, 5], dlg=6, vo='r07',
         line='Major ka order hai, jaan — agle tees din, mujhse do foot bhi door nahi.',
         chunks=['Number saat — Major Aditi Rana.', 'Indian Army ki Special Forces commando,',
                 'jiske naam se seema paar ke dushman kaanpte hain.', 'Shaadi ke teen din baad woh mission par chali gayi thi.',
                 'Aaj chhe mahine baad ghar lauti hai —', 'aur Major sahiba ka order saaf hai:',
                 'agle tees din tum usse do foot se zyada door nahi jaoge.', 'Duniya ke liye faulaadi sherni,',
                 'tumhare liye ek chipku, romantic biwi.', 'Kahani — Commando Wife.']),
    dict(rank=6, id='chudail-nahi-biwi-hai', name='Mohini', alias='300 SAAL', role='Haveli ki rooh  ·  Shekhawati', level=8,
         gal=[2, 5, 3, 1], dlg=7, vo='r06',
         line='Pati dev, itni der kahan the? Teen sau saal se raah dekh rahi thi.',
         chunks=['Number chhe — Mohini.', 'Shekhawati ki veeraan haveli mein teen sau saal se bhatakti ek rooh.',
                 'Tum bas tasveerein kheenchne gaye the...', 'aur galti se tumhare haath se sindoor gira,',
                 'seedha uski painting ki maang mein.', 'Theek aadhi raat ko, sheeshe se ek meethi aawaaz aayi —',
                 '"Pati dev, itni der kahan the?"', 'Jo bhi us haveli mein raat guzaarta hai, subah bhaag jaata hai...',
                 'par ab tumhein chhoone ki himmat kisi mein nahi.', 'Kahani — Chudail Nahi, Biwi Hai.']),
    dict(rank=5, id='dil-ki-wasooli', name='Kesar Dahiya', alias=None, role='Recovery agent  ·  Dilli', level=8,
         gal=[2, 3, 1, 6], dlg=4, vo='r05',
         line='Aaj ki kist baaki hai, mister — ek chai, ek sher, aur tum.',
         chunks=['Number paanch — Kesar Dahiya.', 'Dilli ki sabse khatarnak recovery agent.',
                 'Uski kaali Thar gali mein ghuste hi saare shutter gir jaate hain.',
                 'Woh tumhari kitaabon ki dukaan seal karne aayi thi...',
                 'par tumhari adrak waali chai aur ek sher ne saara hisaab ulat diya.', 'Ab loan woh khud dekhegi —',
                 'bas kist roz bharni hogi.', 'Shaam saat baje: ek chai, ek sher, aur tum.', 'Kahani — Dil Ki Wasooli.']),
    dict(rank=4, id='meri-wali-ips', name='Durga Shekhawat', alias='SP, IPS', role='Police Superintendent  ·  Kesarganj', level=9,
         gal=[2, 1, 3, 7], dlg=4, vo='r04',
         line='Chhe ghante se phone band? Poora area seal karwa doon kya... suno na.',
         chunks=['Number chaar — SP Durga Shekhawat, IPS.', 'Uske aate hi sheher ke gunde sheher chhod kar bhaagne lage.',
                 'Aur yahi Durga... tumhari girlfriend hai.',
                 'Ek baarish waali shaam tumne bina jaane use apni chhatri de di thi —', 'bas, usi din faisla ho gaya.',
                 'Ab tumhara phone chhe ghante band rahe,', 'toh poora thaana hil jaata hai.', 'Thaane mein sherni...',
                 'aur tumhare saamne — "suno na."', 'Kahani — Meri Wali IPS.']),
    dict(rank=3, id='highway-ki-sherni', name='Naina Shekhawat', alias='SHERNI', role='Kaali Aandhi gang  ·  NH-48', level=9,
         gal=[2, 3, 1, 4], dlg=6, vo='r03',
         line='Sorry... aaj keel nahi laayi. Seedha poori bike tod ke le aayi.',
         chunks=['Number teen — Naina Shekhawat, yaani Sherni.', 'Teen mahine se har Mangalvaar woh ek seedhi-saadi ladki bankar',
                 'tumhare garage par scooty ka puncture banwane aati thi —', 'aur har baar tyre mein wahi ek chhoti si keel.',
                 'Aaj raat do baje, ek matte-black bike garage mein ghusti hai,', 'peechhe teen gaadiyon ki headlights.',
                 'Wahi Naina — highway ke sabse khatarnak gang,', 'Kaali Aandhi ki leader.', 'Kahani — Highway Ki Sherni.']),
    dict(rank=2, id='madam-sarkar', name='Vedika Rajvanshi', alias='SARKAR', role='Poore desh ki Sarkar', level=10,
         gal=[2, 4, 3, 5], dlg=6, vo='r02',
         line='Poora desh mere aage jhukta hai... aur main sirf tumhare aage.',
         chunks=['Number do — Vedika Rajvanshi, yaani Sarkar.', 'Jiske ishaare par ports, paisa aur kursiyaan chalti hain,',
                 'aur jiske darwaaze ke baahar mantri intezaar karte hain.', 'Teen saal pehle ek toofaani raat,',
                 'woh zakhmi haalat mein tumhare darwaaze aayi thi —', 'tumne use chhupaya, aur apni denim jacket de di.',
                 'Aaj woh chaudah kaali gaadiyon ke saath lauti hai... wahi jacket lekar.', 'Poora desh uske aage jhukta hai,',
                 'aur woh sirf tumhare aage.', 'Kahani — Madam Sarkar.']),
    dict(rank=1, id='biwi-ek-supari-killer', name='Kaashvi', alias='CHHAYA', role='Contract killer  ·  Mumbai', level=10,
         gal=[1, 7, 2, 4], dlg=5, vo='r01',
         line='Jaanu, khana kha lo. Baaki duniya ko... main sambhaal loongi.',
         chunks=['Aur number ek — Kaashvi.', 'Tumhari ek mahine purani biwi.', 'Ghar par apne haath se khaana khilaati hai,',
                 'raat ko tumhari baanh pakad kar soti hai,', 'aur din mein das baar "miss you" bhejti hai.',
                 'Par Mumbai ka underworld jis Chhaya ke naam se kaanpta hai —',
                 'woh contract killer koi aur nahi, tumhari Kaashvi hai.', 'Aur jis din koi tumhein chhoo bhi le...',
                 'agle din woh tumhein "sir" bulaata hai.', 'Kahani — Biwi Ek Supari Killer.']),
]
INTRO_CHUNKS = ['Duniya inse darti hai...', 'aur ye darti hain sirf ek cheez se —', 'tumhein khone se.',
                'Aaj dekhte hain Kissa ki das sabse khatarnak heroines.']
OUTRO_CHUNKS = ['Toh ye thi Kissa ki das sabse khatarnak heroines.', 'Inmein se tumhari favourite kaun hai?',
                'Har kahani mein faisla sirf tumhara.', 'Abhi beyondredeye.site se Kissa download karo —',
                'aur inmein se kisi ek ka dil jeet kar dikhao.']
SPLIT_R10 = 11.30   # end of intro sentence inside r10
SPLIT_R01 = 28.50   # start of outro inside r01

REV = 2.6      # rank reveal length
XF = 0.45      # reveal -> segment crossfade
DIALOG = 6.2   # chat-bubble moment after each narration


# ----------------------------------------------------------------------------- audio helpers
def load_audio(path):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def silences(x, thr_db=-35, min_d=0.28):
    """Return list of (start, end) silences in seconds."""
    hop = int(0.01 * SR)
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, 1) + 1e-12)
    db = 20 * np.log10(rms)
    quiet = db < thr_db
    out = []
    i = 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            if (j - i) * 0.01 >= min_d:
                out.append((i * 0.01, j * 0.01))
            i = j
        else:
            i += 1
    return out


def speech_bounds(x):
    a = np.abs(x)
    idx = np.where(a > 0.02)[0]
    return idx[0] / SR, idx[-1] / SR


def time_chunks(chunks, x):
    """Assign (start, end) to each subtitle chunk, snapping boundaries to pauses."""
    s0, s1 = speech_bounds(x)
    sil = [(a, b) for a, b in silences(x) if s0 + 0.2 < a and b < s1 - 0.1]
    mids = [(a + b) / 2 for a, b in sil]
    wts = np.array([len(c) + 6 for c in chunks], float)
    cum = np.cumsum(wts) / wts.sum()
    est = [s0 + (s1 - s0) * c for c in cum[:-1]]
    bounds = []
    prev = s0
    used = set()
    for e in est:
        cand = [(abs(m - e), k) for k, m in enumerate(mids) if m > prev + 0.6 and k not in used and abs(m - e) < 1.6]
        if cand:
            _, k = min(cand)
            used.add(k)
            b = mids[k]
        else:
            b = max(e, prev + 0.6)
        bounds.append(b)
        prev = b
    edges = [s0] + bounds + [s1 + 0.25]
    return [(edges[i], edges[i + 1]) for i in range(len(chunks))]


# ----------------------------------------------------------------------------- timeline
def build_timeline():
    clips = {h['vo']: load_audio(f'{VO}/{h["vo"]}.mp3') for h in HEROINES}
    r10 = clips['r10']
    r01 = clips['r01']
    cut10 = int(SPLIT_R10 * SR)
    cut01 = int(SPLIT_R01 * SR)
    clips['r10a'], clips['r10'] = r10[:cut10], r10[cut10:]
    clips['r01'], clips['r01b'] = r01[:cut01], r01[cut01:]

    tl = dict(vo=[], subs=[], segs=[], hits=[], quiet=[], pops=[])
    t = 0.0
    a0 = 1.0
    tl['vo'].append((a0, clips['r10a']))
    for (s, e), c in zip(time_chunks(INTRO_CHUNKS, clips['r10a']), INTRO_CHUNKS):
        tl['subs'].append((a0 + s, a0 + e, c))
    intro_title = a0 + time_chunks(INTRO_CHUNKS, clips['r10a'])[3][0] - 0.25
    t = a0 + len(clips['r10a']) / SR + 0.35
    tl['intro'] = (0.0, t, intro_title)
    tl['quiet'].append((0.0, a0))
    for h in HEROINES:
        rv = t
        seg = rv + REV
        vo_at = seg + 0.05
        x = clips[h['vo']]
        if h['rank'] == 10:
            x = x[int(0.05 * SR):]
        tl['vo'].append((vo_at, x))
        ch = time_chunks(h['chunks'], x)
        for (s, e), c in zip(ch, h['chunks']):
            tl['subs'].append((vo_at + s, vo_at + e, c))
        vo_end = vo_at + speech_bounds(x)[1]
        dlg = vo_end + 0.45
        end = dlg + DIALOG
        tl['segs'].append(dict(h=h, rv=rv, seg=seg, dlg=dlg, end=end, vo_end=vo_end))
        tl['hits'].append(rv + 0.42)
        tl['quiet'].append((rv - 0.2, seg + 0.1))
        tl['quiet'].append((dlg, end))
        tl['pops'].append(dlg + 0.95)
        t = end
    end_start = t
    o_at = end_start + 0.7
    xb = clips['r01b']
    tl['vo'].append((o_at, xb))
    for (s, e), c in zip(time_chunks(OUTRO_CHUNKS, xb), OUTRO_CHUNKS):
        tl['subs'].append((o_at + s, o_at + e, c))
    total = o_at + speech_bounds(xb)[1] + 5.0
    tl['quiet'].append((o_at + speech_bounds(xb)[1] + 0.3, total))
    tl['end'] = (end_start, total)
    tl['total'] = total
    tl['hits'].append(end_start + 0.4)
    return tl


# ----------------------------------------------------------------------------- image helpers
def gallery(sid, n):
    return Image.open(f'{STORIES}/{sid}/assets/gallery/image-{n:02d}.jpg').convert('RGB')


def cover(sid):
    return Image.open(f'{STORIES}/{sid}/assets/cover.jpg').convert('RGB')


def rounded_mask(size, r):
    m = Image.new('L', (size[0] * 2, size[1] * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] * 2 - 1, size[1] * 2 - 1), r * 2, fill=255)
    return m.resize(size, Image.LANCZOS)


def rounded(img, r):
    out = img.convert('RGBA')
    out.putalpha(rounded_mask(img.size, r))
    return out


def shadowed(spr, blur=22, off=(0, 14), alpha=170, pad=50):
    w, h = spr.size
    out = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    sh = Image.new('RGBA', out.size, (0, 0, 0, 0))
    a = spr.split()[3].point(lambda v: v * alpha // 255)
    blk = Image.new('RGBA', spr.size, (0, 0, 0, 255))
    blk.putalpha(a)
    sh.paste(blk, (pad + off[0], pad + off[1]), blk)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.alpha_composite(out, sh)
    out.alpha_composite(spr, (pad, pad))
    return out


def text_spr(txt, f, color=TEXT, shadow=True, spacing=0):
    if spacing:
        w = sum(f.getbbox(ch)[2] - f.getbbox(ch)[0] if ch != ' ' else f.getlength(' ') for ch in txt) + spacing * (len(txt) - 1)
        w = int(sum(f.getlength(ch) for ch in txt) + spacing * (len(txt) - 1))
    else:
        w = int(f.getlength(txt))
    asc, desc = f.getmetrics()
    pad = 16
    img = Image.new('RGBA', (w + pad * 2, asc + desc + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def draw(dd, fill, ox=0, oy=0):
        x = pad + ox
        if spacing:
            for ch in txt:
                dd.text((x, pad + oy), ch, font=f, fill=fill)
                x += f.getlength(ch) + spacing
        else:
            dd.text((x, pad + oy), txt, font=f, fill=fill)

    if shadow:
        sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
        draw(ImageDraw.Draw(sh), (0, 0, 0, 200), 0, 3)
        sh = sh.filter(ImageFilter.GaussianBlur(5))
        img = Image.alpha_composite(img, sh)
        d = ImageDraw.Draw(img)
    draw(d, color)
    return img


def wrap(text, f, maxw):
    words = text.split()
    lines, cur = [], ''
    for w_ in words:
        t = (cur + ' ' + w_).strip()
        if f.getlength(t) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


def pill(txt, f, fg, bg, padx=26, pady=10, r=None):
    tw = int(f.getlength(txt))
    asc, desc = f.getmetrics()
    h = asc + desc + pady * 2 - 8
    img = Image.new('RGBA', (tw + padx * 2, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, img.width - 1, h - 1), r if r is not None else h // 2, fill=bg)
    d.text((padx, pady - 4), txt, font=f, fill=fg)
    return img


def with_alpha(spr, a):
    if a >= 0.999:
        return spr
    s = spr.copy()
    al = s.split()[3].point(lambda v: int(v * a))
    s.putalpha(al)
    return s


def paste(base, spr, x, y, a=1.0):
    if a <= 0.004:
        return
    s = with_alpha(spr, a)
    base.paste(s, (int(round(x)), int(round(y))), s)


def grad_text(txt, f, c1, c2):
    """Vertical gradient filled text sprite with soft glow."""
    asc, desc = f.getmetrics()
    w = int(f.getlength(txt))
    pad = 40
    size = (w + pad * 2, asc + desc + pad * 2)
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).text((pad, pad), txt, font=f, fill=255)
    g = np.zeros((size[1], size[0], 3), np.float32)
    ys = np.linspace(0, 1, size[1])[:, None]
    for k in range(3):
        g[..., k] = c1[k] * (1 - ys) + c2[k] * ys
    fill = Image.fromarray(g.astype(np.uint8)).convert('RGBA')
    fill.putalpha(mask)
    glow = Image.new('RGBA', size, (*ROSE, 0))
    glow.putalpha(mask.filter(ImageFilter.GaussianBlur(26)).point(lambda v: int(v * 0.55)))
    sh = Image.new('RGBA', size, (0, 0, 0, 0))
    shm = mask.filter(ImageFilter.GaussianBlur(8)).point(lambda v: int(v * 0.7))
    sh.putalpha(shm)
    out = Image.alpha_composite(glow, sh)
    out = Image.alpha_composite(out, fill)
    return out


def scale_spr(spr, s):
    if abs(s - 1) < 0.003:
        return spr
    return spr.resize((max(1, int(spr.width * s)), max(1, int(spr.height * s))), Image.BILINEAR)


# ----------------------------------------------------------------------------- static assets
ICON = Image.open(f'{REPO}/assets/icon.png').convert('RGB')


def shade_mask(left=0.78, bottom=0.70, top=0.35, vig=0.35):
    xs = np.linspace(0, 1, W)[None, :]
    ys = np.linspace(0, 1, H)[:, None]
    m = np.ones((H, W), np.float32)
    m *= 1 - left * np.clip((0.62 - xs) / 0.62, 0, 1) ** 1.4
    m *= 1 - bottom * np.clip((ys - 0.62) / 0.38, 0, 1) ** 1.6
    m *= 1 - top * np.clip((0.22 - ys) / 0.22, 0, 1) ** 1.5
    r = np.sqrt(((xs - 0.5) / 0.75) ** 2 + ((ys - 0.5) / 0.75) ** 2)
    m *= 1 - vig * np.clip(r - 0.45, 0, 1) ** 1.5
    return (np.clip(m, 0, 1) * 256).astype(np.uint16)[..., None]


SHADE = shade_mask()
SHADE_DLG = (SHADE.astype(np.float32) * 0.62).astype(np.uint16)
VIG = shade_mask(left=0, bottom=0.45, top=0.3, vig=0.8)


def apply_mask(img, m):
    a = np.asarray(img, dtype=np.uint16)
    return Image.fromarray(((a * m) >> 8).astype(np.uint8))


WM = None


def watermark():
    global WM
    if WM is None:
        ic = rounded(ICON.resize((52, 52), Image.LANCZOS), 13)
        t = text_spr('Kissa', P7(34))
        img = Image.new('RGBA', (52 + 10 + t.width, max(52, t.height)), (0, 0, 0, 0))
        img.paste(ic, (0, (img.height - 52) // 2), ic)
        img.alpha_composite(t, (52 + 10 - 16, (img.height - t.height) // 2 + 1))
        WM = img
    return WM


# covers wall for intro / end
WALL_ROWS = []


def make_wall():
    cw, chh, gap = 300, 447, 26
    covs = [cover(h['id']).resize((cw, chh), Image.LANCZOS) for h in HEROINES]
    for row in range(2):
        order = covs if row == 0 else covs[5:] + covs[:5]
        strip = Image.new('RGB', ((cw + gap) * len(order) * 2, chh), (6, 6, 9))
        for k, c in enumerate(order * 2):
            strip.paste(c, (k * (cw + gap), 0))
        WALL_ROWS.append(np.asarray(strip))


def wall_frame(t, dim=0.42):
    if not WALL_ROWS:
        make_wall()
    frame = np.full((H, W, 3), 6, np.uint8)
    for row, arr in enumerate(WALL_ROWS):
        L = arr.shape[1] // 2
        off = int((t * 38 * (1 if row == 0 else -1)) % L)
        if row == 1:
            off = (L - off + 700) % L
        seg = arr[:, off:off + W]
        y = 70 + row * (arr.shape[0] + 26)
        frame[y:y + arr.shape[0]] = seg
    img = Image.fromarray(frame)
    m = (VIG.astype(np.float32) * dim).astype(np.uint16)
    return apply_mask(img, m)


# ----------------------------------------------------------------------------- per-heroine assets
class Assets:
    def __init__(self, h):
        self.h = h
        self.imgs = [gallery(h['id'], n) for n in h['gal']]
        self.dlg_img = gallery(h['id'], h['dlg'])
        cv = cover(h['id'])
        self.cover = cv
        bg = self.imgs[0].resize((W // 2, H // 2), Image.BILINEAR).filter(ImageFilter.GaussianBlur(14))
        self.rev_bg = apply_mask(bg.resize((W + 120, H + 68), Image.BILINEAR), np.uint16(256 * 0.36))
        # reveal pieces
        self.num_big = grad_text(str(h['rank']), PF(520), (255, 255, 255), ROSE_L)
        self.num_lbl = text_spr('NUMBER', P6(34), GOLD, spacing=14)
        self.rev_name = text_spr(h['name'], P8(62))
        self.rev_role = text_spr(h['role'], P5(32), DIM)
        ph = 780
        pw = int(cv.width * ph / cv.height)
        self.poster = shadowed(rounded(cv.resize((pw, ph), Image.LANCZOS), 26), blur=30, off=(0, 20), alpha=200, pad=60)
        # segment info block
        self.rank_spr = grad_text(f'#{h["rank"]}', PF(150), (255, 255, 255), ROSE)
        self.kh_lbl = text_spr('KHATARNAK HEROINE', P6(24), GOLD, spacing=6)
        self.name_spr = text_spr(h['name'], P8(66))
        self.alias_spr = pill(h['alias'], P7(24), (255, 255, 255), (*ROSE, 235), padx=18, pady=10) if h['alias'] else None
        self.role_spr = text_spr(h['role'], P5(32), DIM)
        self.meter_lbl = text_spr('KHATRA LEVEL', P6(22), (220, 220, 228), spacing=5)
        cw = 250
        chh = int(cv.height * cw / cv.width)
        self.card = shadowed(rounded(cv.resize((cw, chh), Image.LANCZOS), 18), blur=18, off=(0, 10), alpha=190, pad=40)
        self.card_pill = pill('KISSA PAR KHELO', P7(22), (255, 255, 255), (*ROSE, 245), padx=22, pady=11)
        # dialogue bubble pieces
        self.av = self.avatar(84)
        self.bub_name = text_spr(h['name'].split()[0] if not h['name'].startswith('Major') else 'Aditi', P6(30), ROSE_L)
        self.bub_font = P5(42)
        self.bub_maxw = 860
        self.bub_lines = wrap(h['line'], self.bub_font, self.bub_maxw)
        self.caption = text_spr(f'—  {story_title(h["id"])}', PFI(36), (230, 230, 236))

    def avatar(self, d):
        # face-free monogram avatar on a rose gradient (Kissa chat style)
        s = d * 3
        img = Image.new('RGB', (s, s))
        g = np.zeros((s, s, 3), np.float32)
        yy, xx = np.mgrid[0:s, 0:s] / s
        k = (xx + yy) / 2
        for c in range(3):
            g[..., c] = ROSE[c] * (1 - k) + (150, 60, 160)[c] * k
        img = Image.fromarray(g.astype(np.uint8))
        dd = ImageDraw.Draw(img)
        ini = self.h['name'].replace('Major ', '')[0]
        f = P7(int(s * 0.5))
        dd.text((s / 2, s / 2), ini, font=f, fill=(255, 255, 255), anchor='mm')
        img = img.resize((d, d), Image.LANCZOS).convert('RGBA')
        m = Image.new('L', (s, s), 0)
        ImageDraw.Draw(m).ellipse((0, 0, s - 1, s - 1), fill=255)
        img.putalpha(m.resize((d, d), Image.LANCZOS))
        ring = Image.new('RGBA', (d + 8, d + 8), (0, 0, 0, 0))
        ImageDraw.Draw(ring).ellipse((0, 0, d + 7, d + 7), outline=(255, 255, 255, 230), width=3)
        ring.alpha_composite(img, (4, 4))
        return ring


TITLES = {}


def story_title(sid):
    if sid not in TITLES:
        TITLES[sid] = json.load(open(f'{STORIES}/{sid}/story.json')).get('title', sid)
    return TITLES[sid]


# ----------------------------------------------------------------------------- ken burns
def kb(img, t, dur, k):
    """Ken Burns: cover-fit + slow zoom/pan; direction depends on k."""
    sw, sh = img.size
    base = max(W / sw, H / sh)
    p = clamp(t / max(dur, 0.01))
    p = ease_io(p) * 0.85 + p * 0.15
    z0, z1 = (1.04, 1.15) if k % 2 == 0 else (1.15, 1.04)
    z = z0 + (z1 - z0) * p
    s = base * z
    vw, vh = W / s, H / s
    dirs = [(-1, 0.3), (1, -0.3), (0.6, 1), (-0.6, -1)]
    dx, dy = dirs[k % 4]
    cx = sw / 2 + dx * (sw - vw) / 2 * (p - 0.5) * 0.9
    cy = sh / 2 + dy * (sh - vh) / 2 * (p - 0.5) * 0.9
    x0 = cx - vw / 2
    y0 = cy - vh / 2
    return img.transform((W, H), Image.AFFINE, (1 / s, 0, x0, 0, 1 / s, y0), resample=Image.BILINEAR)


# ----------------------------------------------------------------------------- subtitles
SUB_CACHE = {}


def sub_sprite(txt):
    if txt not in SUB_CACHE:
        f = P6(44)
        lines = wrap(txt, f, 1180)
        asc, desc = f.getmetrics()
        lh = asc + desc + 2
        sprs = [text_spr(l, f) for l in lines]
        w = max(s.width for s in sprs) + 36
        h = lh * len(lines) + 40
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(img).rounded_rectangle((0, 0, w - 1, h - 1), 22, fill=(8, 8, 12, 150))
        for i, s in enumerate(sprs):
            img.alpha_composite(s, ((w - s.width) // 2, 20 - 16 + i * lh))
        SUB_CACHE[txt] = img
    return SUB_CACHE[txt]


def draw_subs(frame, t, subs, y_bottom=1030):
    for s, e, txt in subs:
        if s - 0.05 <= t < e:
            a = clamp((t - s + 0.05) / 0.16) * clamp((e - t) / 0.12)
            spr = sub_sprite(txt)
            lift = (1 - ease_out(clamp((t - s + 0.05) / 0.2))) * 10
            paste(frame, spr, (W - spr.width) / 2, y_bottom - spr.height + lift, a)
            break


# ----------------------------------------------------------------------------- countdown strip
STRIP = {}


def countdown_strip(frame, cur, a=1.0):
    gap = 58
    xs0 = W / 2 - gap * 4.5
    ImageDraw.Draw(frame, 'RGBA').rounded_rectangle((xs0 - 40, 22, xs0 + gap * 9 + 40, 98), 38,
                                                    fill=(6, 6, 10, int(130 * a)))
    for i, r in enumerate(range(10, 0, -1)):
        key = (r, r == cur, r > cur)
        if key not in STRIP:
            if r == cur:
                STRIP[key] = text_spr(str(r), P8(40), ROSE)
            else:
                STRIP[key] = text_spr(str(r), P6(26), (150, 152, 165) if r > cur else (235, 235, 240))
        s = STRIP[key]
        x = xs0 + i * gap - s.width / 2
        y = 52 - s.height / 2
        paste(frame, s, x, y, a * (0.55 if r > cur else 1.0))
    # underline current
    i = 10 - cur
    d = ImageDraw.Draw(frame, 'RGBA')
    cx = xs0 + i * gap
    d.rounded_rectangle((cx - 16, 80, cx + 16, 85), 3, fill=(*ROSE, int(255 * a)))


# ----------------------------------------------------------------------------- scenes
def draw_meter(frame, x, y, level, p, a):
    bw, bh, gp = 30, 14, 7
    d = ImageDraw.Draw(frame, 'RGBA')
    fillto = level * ease_out(p)
    for i in range(10):
        x0 = x + i * (bw + gp)
        on = clamp(fillto - i)
        d.rounded_rectangle((x0, y, x0 + bw, y + bh), 5, fill=(255, 255, 255, int(46 * a)))
        if on > 0:
            c = tuple(int(ROSE[k] * (1 - i / 12) + (255, 70, 60)[k] * (i / 12)) for k in range(3))
            d.rounded_rectangle((x0, y, x0 + bw * on, y + bh), 5, fill=(*c, int(255 * a)))


def reveal_frame(A, tt):
    """tt: seconds since reveal start (can exceed REV during crossfade)."""
    h = A.h
    z = 1 + 0.04 * tt / REV
    bg = A.rev_bg
    bw, bh = int(W * z), int(H * z)
    ox = (bg.width - W) // 2
    oy = (bg.height - H) // 2
    frame = bg.crop((ox, oy, ox + W, oy + H)).copy()
    hit = 0.42
    # shake
    sh = 0.0
    if tt > hit:
        sh = 10 * math.exp(-(tt - hit) * 7) * math.sin((tt - hit) * 70)
    # number slam
    p = clamp(tt / hit)
    sc = 1.9 - 0.9 * ease_out(p) if tt < hit else 1.0 + 0.05 * math.exp(-(tt - hit) * 8) * math.cos((tt - hit) * 20)
    a = ease_out(p * 1.4)
    spr = scale_spr(A.num_big, sc * (0.98 + 0.03 * clamp((tt - hit) / 2.0)))
    cx, cy = 600, 520
    paste(frame, spr, cx - spr.width / 2 + sh, cy - spr.height / 2 + sh * 0.5, a)
    paste(frame, A.num_lbl, cx - A.num_lbl.width / 2, 150, ease_out((tt - 0.1) / 0.4))
    an = ease_out((tt - 0.75) / 0.45)
    paste(frame, A.rev_name, cx - A.rev_name.width / 2, 800 + (1 - an) * 24, an)
    ar = ease_out((tt - 0.95) / 0.45)
    paste(frame, A.rev_role, cx - A.rev_role.width / 2, 880 + (1 - ar) * 18, ar)
    # poster slide in
    pp = ease_out((tt - hit + 0.05) / 0.7)
    px = 1330 - A.poster.width / 2 + (1 - pp) * 260 + sh * 0.6
    py = (H - A.poster.height) / 2 + 10
    paste(frame, A.poster, px, py, pp)
    # flash
    if hit <= tt < hit + 0.35:
        fl = (1 - (tt - hit) / 0.35) ** 2 * 0.55
        frame = Image.blend(frame, Image.new('RGB', (W, H), (255, 236, 242)), fl)
    countdown_strip(frame, h['rank'], ease_out(tt / 0.4))
    paste(frame, watermark(), W - watermark().width - 60, 34)
    return frame


def segment_frame(A, S, t, subs):
    h = A.h
    ls = t - S['seg']
    vo_span = S['dlg'] - S['seg']
    n = len(A.imgs)
    slot = vo_span / n
    in_dlg = t >= S['dlg']
    XFI = 0.7
    if not in_dlg:
        k = min(n - 1, int(ls / slot))
        lt = ls - k * slot
        img = kb(A.imgs[k], lt + 0.0, slot + XFI, k)
        if k > 0 and lt < XFI:
            prev = kb(A.imgs[k - 1], slot + lt, slot + XFI, k - 1)
            img = Image.blend(prev, img, ease_io(lt / XFI))
        frame = apply_mask(img, SHADE)
    else:
        dt = t - S['dlg']
        img = kb(A.dlg_img, dt, DIALOG + 0.5, 1)
        frame_d = apply_mask(img, SHADE_DLG)
        if dt < XFI:
            last = kb(A.imgs[-1], slot + dt, slot + XFI, n - 1)
            frame = Image.blend(apply_mask(last, SHADE), frame_d, ease_io(dt / XFI))
        else:
            frame = frame_d
    # info block
    x0, y0 = 84, 104
    a1 = ease_out((ls - 0.1) / 0.5)
    paste(frame, A.rank_spr, x0 - 40 - (1 - a1) * 40, y0 - 40, a1)
    a2 = ease_out((ls - 0.3) / 0.5)
    paste(frame, A.kh_lbl, x0 - 16 + (1 - a2) * 30, y0 + 196 - 16, a2)
    a3 = ease_out((ls - 0.45) / 0.5)
    paste(frame, A.name_spr, x0 - 16 + (1 - a3) * 30, y0 + 228 - 16, a3)
    if A.alias_spr:
        paste(frame, A.alias_spr, x0 + A.name_spr.width - 32 + 18 + (1 - a3) * 30, y0 + 252, a3)
    a4 = ease_out((ls - 0.6) / 0.5)
    paste(frame, A.role_spr, x0 - 16 + (1 - a4) * 30, y0 + 318 - 16, a4)
    a5 = ease_out((ls - 0.8) / 0.5)
    paste(frame, A.meter_lbl, x0 - 16, y0 + 380 - 16, a5)
    draw_meter(frame, x0, y0 + 418, h['level'], (ls - 0.9) / 1.4, a5)
    # poster card bottom-right
    ac = ease_out((ls - 1.2) / 0.6)
    cx = W - 70 - A.card.width + 40 + (1 - ac) * 80
    cy = H - 70 - A.card.height + 40 - 40
    paste(frame, A.card, cx, cy, ac)
    paste(frame, A.card_pill, cx + 40 + (250 - A.card_pill.width) / 2, cy + A.card.height - 40 - 6, ac)
    countdown_strip(frame, h['rank'])
    paste(frame, watermark(), W - watermark().width - 60, 34)
    if in_dlg:
        dialog_overlay(frame, A, t - S['dlg'])
    else:
        draw_subs(frame, t, subs)
    return frame


def dialog_overlay(frame, A, dt):
    f = A.bub_font
    asc, desc = f.getmetrics()
    lh = asc + desc + 4
    full = A.h['line']
    lines = A.bub_lines
    bw = max(int(f.getlength(l)) for l in lines) + 64
    bh = lh * len(lines) + 46
    bx = 230
    by = 640 - bh // 2 + 40
    a = ease_out(dt / 0.35)
    pop = back_out(dt / 0.45)
    # avatar + name
    paste(frame, A.av, bx - 120 + (1 - a) * -20, by - 26, a)
    paste(frame, A.bub_name, bx + 6, by - 62, a)
    typing_end = 0.95
    d = ImageDraw.Draw(frame, 'RGBA')
    if dt < typing_end:
        w2, h2 = 150, 84
        sc = 0.6 + 0.4 * pop
        ww, hh = w2 * sc, h2 * sc
        d.rounded_rectangle((bx, by, bx + ww, by + hh), 30 * sc, fill=(26, 26, 32, int(235 * a)))
        d.rounded_rectangle((bx, by, bx + 30, by + hh), 8, fill=(26, 26, 32, int(235 * a)))
        for i in range(3):
            ph = (dt * 3.2 - i * 0.22) % 1.0
            yy = by + hh / 2 - 6 * math.sin(math.pi * clamp(ph * 2))
            al = int(255 * a * (0.45 + 0.55 * math.sin(math.pi * clamp(ph * 2))))
            xx = bx + ww / 2 + (i - 1) * 26 * sc
            d.ellipse((xx - 7 * sc, yy - 7 * sc, xx + 7 * sc, yy + 7 * sc), fill=(235, 235, 240, al))
        return
    tp = dt - typing_end
    nch = int(tp * 34)
    d.rounded_rectangle((bx, by, bx + bw, by + bh), 30, fill=(26, 26, 32, 238))
    d.rounded_rectangle((bx, by, bx + 30, by + bh), 8, fill=(26, 26, 32, 238))
    d.rounded_rectangle((bx, by, bx + 6, by + bh), 3, fill=(*ROSE, 255))
    shown = full[:nch]
    pos = 0
    for i, l in enumerate(lines):
        seg = shown[pos:pos + len(l)]
        pos += len(l) + 1
        if not seg:
            break
        d.text((bx + 34, by + 20 + i * lh), seg, font=f, fill=(244, 244, 248))
    if nch < len(full) and int(dt * 3) % 2 == 0:
        # caret
        li = 0
        p2 = 0
        for i, l in enumerate(lines):
            if nch <= p2 + len(l):
                li = i
                break
            p2 += len(l) + 1
        seg = full[p2:nch]
        cxp = bx + 34 + f.getlength(seg) + 4
        d.rectangle((cxp, by + 26 + li * lh, cxp + 3, by + 20 + li * lh + asc), fill=(*ROSE_L, 255))
    ac = ease_out((tp - len(full) / 34 - 0.2) / 0.5)
    paste(frame, A.caption, bx + 20, by + bh + 22 + (1 - ac) * 12, ac)


INTRO_SPR = {}


def intro_frame(t, tl, subs):
    s0, e0, tt = tl['intro']
    frame = wall_frame(t, dim=0.30 + 0.12 * clamp(t / 1.5))
    if not INTRO_SPR:
        INTRO_SPR['k'] = text_spr('KISSA KI', P6(44), GOLD, spacing=16)
        INTRO_SPR['l1'] = text_spr('10 SABSE KHATARNAK', PF(118))
        INTRO_SPR['l2'] = grad_text('HEROINES', PF(170), (255, 214, 226), ROSE)
        INTRO_SPR['sub'] = text_spr('Duniya inse darti hai. Ye darti hain sirf tumhein khone se.', PFI(36), (232, 232, 238))
    # dark band behind title
    p = ease_out((t - tt) / 0.6)
    if p > 0:
        arr = np.asarray(frame, dtype=np.float32)
        ys = np.linspace(0, 1, H)[:, None, None]
        band = 1 - 0.55 * p * np.exp(-((ys - 0.47) / 0.22) ** 2)
        frame = Image.fromarray((arr * band).astype(np.uint8))
    k = INTRO_SPR
    paste(frame, k['k'], (W - k['k'].width) / 2, 250 + (1 - p) * 20, p)
    p1 = ease_out((t - tt - 0.15) / 0.6)
    s1 = scale_spr(k['l1'], 1.12 - 0.12 * p1)
    paste(frame, s1, (W - s1.width) / 2, 318 - (s1.height - k['l1'].height) / 2, p1)
    p2 = clamp((t - tt - 0.5) / 0.35)
    s2 = scale_spr(k['l2'], 1.6 - 0.6 * ease_out(p2))
    paste(frame, s2, (W - s2.width) / 2, 470 - (s2.height - k['l2'].height) / 2, ease_out(p2 * 1.5))
    if t < tt:
        # pre-title: big logo glow
        pl = ease_out((t - 0.2) / 0.8)
        ic = rounded(ICON.resize((170, 170), Image.LANCZOS), 40)
        paste(frame, shadowed(ic, blur=26, alpha=200), (W - 270) / 2, 330 - (1 - pl) * 20, pl * clamp((tt - t) / 0.4))
    paste(frame, watermark(), W - watermark().width - 60, 34, ease_out((t - 1) / 0.6))
    draw_subs(frame, t, subs)
    return frame


END_SPR = {}


def end_frame(t, tl, subs):
    s0, e0 = tl['end']
    lt = t - s0
    frame = wall_frame(t, dim=0.26)
    k = END_SPR
    if not k:
        k['icon'] = shadowed(rounded(ICON.resize((150, 150), Image.LANCZOS), 36), blur=26, alpha=200)
        k['q'] = text_spr('Tumhari favourite kaun hai?', P8(70))
        k['s'] = text_spr('Har kahani mein faisla sirf tumhara.', PFI(40), (232, 232, 238))
        k['dl'] = text_spr('ABHI DOWNLOAD KARO', P6(30), GOLD, spacing=8)
        k['url'] = shadowed(pill('beyondredeye.site', P7(64), (255, 255, 255), (*ROSE, 255), padx=56, pady=24), blur=24, alpha=170)
        k['free'] = text_spr('Android  ·  Free  ·  Apni AI key se', P5(30), DIM)
    a = ease_out(lt / 0.6)
    paste(frame, k['icon'], (W - k['icon'].width) / 2, 92 + (1 - a) * 20, a)
    a = ease_out((lt - 0.3) / 0.6)
    paste(frame, k['q'], (W - k['q'].width) / 2, 300 + (1 - a) * 20, a)
    a = ease_out((lt - 0.6) / 0.6)
    paste(frame, k['s'], (W - k['s'].width) / 2, 400 + (1 - a) * 16, a)
    a = ease_out((lt - 1.2) / 0.6)
    paste(frame, k['dl'], (W - k['dl'].width) / 2, 500, a)
    pb = back_out((lt - 1.4) / 0.6)
    pulse = 1 + 0.025 * math.sin(max(0, lt - 2.2) * 4)
    u = scale_spr(k['url'], max(0.01, (0.7 + 0.3 * pb) * pulse))
    paste(frame, u, (W - u.width) / 2, 640 - u.height / 2, clamp((lt - 1.4) / 0.3))
    a = ease_out((lt - 2.0) / 0.6)
    paste(frame, k['free'], (W - k['free'].width) / 2, 740, a)
    paste(frame, watermark(), W - watermark().width - 60, 34)
    draw_subs(frame, t, subs)
    # final fade
    tot = tl['total']
    if t > tot - 1.2:
        frame = Image.blend(frame, Image.new('RGB', (W, H), (0, 0, 0)), clamp((t - (tot - 1.2)) / 1.2))
    return frame


# ----------------------------------------------------------------------------- composition
def make_frame(t, tl, assets):
    subs = tl['subs']
    if t < tl['intro'][1]:
        f = intro_frame(t, tl, subs)
        # crossfade into first reveal
        return f
    if t >= tl['end'][0]:
        S = tl['segs'][-1]
        if t < tl['end'][0] + 0.5:
            a = segment_frame(assets[S['h']['rank']], S, t, subs)
            b = end_frame(t, tl, subs)
            return Image.blend(a, b, ease_io((t - tl['end'][0]) / 0.5))
        return end_frame(t, tl, subs)
    for S in tl['segs']:
        if S['rv'] <= t < S['end']:
            A = assets[S['h']['rank']]
            if t < S['seg']:
                fr = reveal_frame(A, t - S['rv'])
                if t < S['rv'] + 0.25:
                    # quick dip from previous segment/intro
                    prev = black = Image.new('RGB', (W, H), (0, 0, 0))
                    fr = Image.blend(black, fr, ease_io((t - S['rv']) / 0.25))
                return fr
            if t < S['seg'] + XF:
                a = reveal_frame(A, t - S['rv'])
                b = segment_frame(A, S, t, subs)
                return Image.blend(a, b, ease_io((t - S['seg']) / XF))
            fr = segment_frame(A, S, t, subs)
            if t > S['end'] - 0.25 and S['h']['rank'] != 1:
                fr = Image.blend(fr, Image.new('RGB', (W, H), (0, 0, 0)), ease_io((t - (S['end'] - 0.25)) / 0.25))
            return fr
    return Image.new('RGB', (W, H), (0, 0, 0))


# ----------------------------------------------------------------------------- audio
def build_audio(tl, path):
    total = tl['total']
    n = int((total + 1.0) * SR)
    vo = np.zeros(n, np.float32)
    for at, x in tl['vo']:
        i = int(at * SR)
        vo[i:i + len(x)] += x[:max(0, n - i)]
    pk = np.max(np.abs(vo)) + 1e-9
    vo *= 0.89 / pk
    mus = make_music(total, SR, vo, tl['quiet'], tl['hits'], tl['end'][0])
    mix = mus[:n].copy()
    mix += vo[:, None]
    # message pop on each bubble
    L = int(0.12 * SR)
    tt = np.arange(L) / SR
    pop = (np.sin(2 * np.pi * (900 + 900 * tt / 0.12) * tt) * np.exp(-tt * 38) * np.clip(tt / 0.004, 0, 1)).astype(np.float32)
    pop = (np.convolve(pop, np.ones(6) / 6, mode='same') * 0.16).astype(np.float32)
    for p in tl['pops']:
        i = int(p * SR)
        mix[i:i + L] += pop[:, None]
    mix = np.tanh(mix * 1.05) / np.tanh(1.05)
    mix = np.clip(mix, -0.99, 0.99)
    mix = mix[:int(total * SR)]
    pcm = (mix * 32767).astype(np.int16)
    import wave
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# ----------------------------------------------------------------------------- main
def main():
    tl = build_timeline()
    total = tl['total']
    print(f'total {total:.2f}s  ({total / 60:.2f} min)')
    for S in tl['segs']:
        print(f"  #{S['h']['rank']:>2} rv {S['rv']:7.2f} seg {S['seg']:7.2f} dlg {S['dlg']:7.2f} end {S['end']:7.2f}")
    assets = {h['rank']: Assets(h) for h in HEROINES}
    if STILLS:
        os.makedirs('/tmp/top10_stills', exist_ok=True)
        for ts in STILLS.split(','):
            t = float(ts)
            make_frame(t, tl, assets).save(f'/tmp/top10_stills/s_{t:07.2f}.jpg', quality=88)
        print('stills done')
        return
    wav = '/tmp/top10_audio.wav'
    build_audio(tl, wav)
    print('audio done')
    if os.environ.get('AUDIO_ONLY'):
        subprocess.run([FF, '-y', '-v', 'error', '-i', os.environ['AUDIO_ONLY'], '-i', wav, '-map', '0:v', '-map', '1:a',
                        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', OUT], check=True)
        print('remuxed', OUT, os.path.getsize(OUT) / 1e6, 'MB')
        return
    step = 6 if PREVIEW else 1
    fps_out = FPS / step
    nframes = int(total * FPS)
    vtmp = '/tmp/top10_video.mp4'
    crf = os.environ.get('CRF', '23')
    maxrate = os.environ.get('MAXRATE', '1500k')
    cmd = [FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', f'{fps_out}', '-i', '-',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-maxrate', maxrate, '-bufsize', '3000k',
           '-pix_fmt', 'yuv420p', '-r', f'{fps_out}', vtmp]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    import time
    t0 = time.time()
    for i in range(0, nframes, step):
        t = i / FPS
        fr = make_frame(t, tl, assets)
        pr.stdin.write(fr.tobytes())
        if (i // step) % 300 == 0:
            el = time.time() - t0
            done = (i + 1) / nframes
            print(f'frame {i}/{nframes}  {el:.0f}s elapsed  eta {el / done - el:.0f}s', flush=True)
    pr.stdin.close()
    pr.wait()
    subprocess.run([FF, '-y', '-v', 'error', '-i', vtmp, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                    '-movflags', '+faststart', '-shortest', OUT], check=True)
    print('wrote', OUT, os.path.getsize(OUT) / 1e6, 'MB')


if __name__ == '__main__':
    main()
