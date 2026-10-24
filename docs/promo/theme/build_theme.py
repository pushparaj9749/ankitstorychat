#!/usr/bin/env python3
"""Kissa signature tune — instrumental brand theme (no vocals) for Instagram / YouTube.

Hook (D harmonic minor, 96 BPM):
  | A4 D5 F5~ E5 D5 | C#5~ E5 A4~ | D5 F5 A5~ G5 F5 | E5 C#5 D5~ |
     Dm               A             Bb                A

Instruments (all synthesised): sitar (Karplus-Strong + jawari buzz + tarab
shimmer), bansuri (continuous-phase flute with meend glides, breath and
vibrato), tabla (keherwa), tanpura drone, strings ostinato, pad, 808, kick,
clap, hats, FM bell, cinematic boom/riser. Convolution reverb, soft master.

Outputs (docs/promo/theme/):
  kissa_theme_full.mp3/.wav   ~45 s  full theme
  kissa_theme_short.mp3       ~18 s  reel / shorts cut
  kissa_logo.mp3/.wav         ~5 s   sonic logo (end-card sting)
"""
import os
import subprocess
import sys
import wave

import imageio_ffmpeg
import numpy as np
from scipy.signal import fftconvolve, resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'top10'))
sys.path.insert(0, os.path.join(HERE, '..', 'tutorial'))
from music import bp, hp, lp, mtof  # noqa: E402
from music_dark import boom, clap, hat, kick808, riser, saw, string_note  # noqa: E402

FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000
BPM = 96
BEAT = 60 / BPM
BAR = BEAT * 4
rng = np.random.default_rng(2026)

# (beat offset within 4-bar phrase, length in beats, midi)
HOOK = [
    (0.0, 0.5, 69), (0.5, 0.5, 74), (1.0, 1.5, 77), (2.5, 0.5, 76), (3.0, 1.0, 74),
    (4.0, 1.5, 73), (5.5, 0.5, 76), (6.0, 2.0, 69),
    (8.0, 0.5, 74), (8.5, 0.5, 77), (9.0, 1.5, 81), (10.5, 0.5, 79), (11.0, 1.0, 77),
    (12.0, 1.0, 76), (13.0, 1.0, 73), (14.0, 2.0, 74),
]
CHORDS = {  # bar index in phrase -> (bass root midi, triad midis)
    0: (38, [62, 65, 69]),   # Dm
    1: (33, [57, 61, 64]),   # A
    2: (34, [58, 62, 65]),   # Bb
    3: (33, [57, 61, 64]),   # A
}


# ----------------------------------------------------------------------------- utils
class Bus:
    def __init__(self, n):
        self.L = np.zeros(n, np.float32)
        self.R = np.zeros(n, np.float32)

    def add(self, t, sig, gain=1.0, pan=0.0):
        i = int(round(t * SR))
        if i >= len(self.L) or i + len(sig) <= 0:
            return
        s = sig
        if i < 0:
            s = s[-i:]
            i = 0
        s = s[:len(self.L) - i] * gain
        gl = np.cos((pan + 1) * np.pi / 4) * 1.414
        gr = np.sin((pan + 1) * np.pi / 4) * 1.414
        self.L[i:i + len(s)] += s * gl
        self.R[i:i + len(s)] += s * gr

    def st(self):
        return np.stack([self.L, self.R], 1)


def env_adsr(L, a, d, s, r, sus_len=None):
    tt = np.arange(L) / SR
    e = np.ones(L, np.float32)
    e = np.where(tt < a, tt / max(a, 1e-4), e)
    dmask = (tt >= a) & (tt < a + d)
    e = np.where(dmask, 1 - (1 - s) * (tt - a) / max(d, 1e-4), e)
    e = np.where(tt >= a + d, s, e)
    rl = int(r * SR)
    if rl and rl < L:
        e[-rl:] *= np.linspace(1, 0, rl)
    return e.astype(np.float32)


# ----------------------------------------------------------------------------- instruments
def ks(f, dur, decay=0.9965, bright=0.6, pick=0.13, os_=4):
    """Karplus-Strong at os_x oversampling (accurate pitch), block-vectorised."""
    sr = SR * os_
    p = int(round(sr / f))
    N = int(dur * sr)
    exc = rng.uniform(-1, 1, p)
    # brightness: one-pole smoothing of excitation
    a = 1 - bright
    for i in range(1, p):
        exc[i] = exc[i] * (1 - a) + exc[i - 1] * a
    # pluck position comb
    k = max(1, int(pick * p))
    exc = exc - np.roll(exc, k)
    yy = np.zeros(N + p + 3)          # yy[i + 1] == y[i]  (one leading zero)
    yy[1:p + 1] = exc
    g = decay ** (1 / os_)
    for s0 in range(p, N, p):
        e = min(s0 + p, N)
        L = e - s0
        yy[s0 + 1:e + 1] = 0.5 * g * (yy[s0 - p + 1:s0 - p + 1 + L] + yy[s0 - p:s0 - p + L])
    y = yy[1:N + 1]
    y = resample_poly(y, 1, os_)
    return y.astype(np.float32)


def sitar(m, dur, vel=1.0):
    f = mtof(m)
    y = ks(f, dur + 0.8, decay=0.9978, bright=0.85, pick=0.07)
    # jawari: asymmetric soft clip adds the buzzy "zing"
    z = y / (np.max(np.abs(y)) + 1e-9)
    buzz = np.tanh(z * 3.5 + 0.25) - np.tanh(0.25)
    out = 0.55 * z + 0.45 * buzz
    out = hp(out, 180, SR)
    tt = np.arange(len(out)) / SR
    out *= np.clip((dur + 0.8 - tt) / 0.8, 0, 1)
    return (out * vel).astype(np.float32)


TARAB_CACHE = {}


def tarab(m):
    if m not in TARAB_CACHE:
        y = ks(mtof(m), 3.0, decay=0.9993, bright=0.9, pick=0.2)
        TARAB_CACHE[m] = (hp(y / (np.max(np.abs(y)) + 1e-9), 600, SR) * 0.08).astype(np.float32)
    return TARAB_CACHE[m]


def tanpura(m, dur=2.6):
    y = ks(mtof(m), dur, decay=0.9992, bright=0.75, pick=0.25)
    z = y / (np.max(np.abs(y)) + 1e-9)
    out = 0.6 * z + 0.4 * (np.tanh(z * 2.5 + 0.2) - np.tanh(0.2))
    tt = np.arange(len(out)) / SR
    out *= np.clip(tt / 0.01, 0, 1) * np.clip((dur - tt) / 0.6, 0, 1)
    return lp(out, 3500, SR).astype(np.float32)


def bansuri(notes, t_total, glide=0.07, vib=0.20):
    """notes: list of (start_s, dur_s, midi). Returns mono line, continuous phase with meend."""
    n = int(t_total * SR)
    tt = np.arange(n) / SR
    f = np.full(n, mtof(notes[0][2]), np.float64)
    amp = np.zeros(n, np.float64)
    vibd = np.zeros(n, np.float64)
    for i, (s, d, m) in enumerate(notes):
        a = int(s * SR)
        b = min(n, int((s + d) * SR))
        fm = mtof(m)
        f[a:b] = fm
        nxt = notes[i + 1] if i + 1 < len(notes) else None
        legato = nxt is not None and nxt[0] - (s + d) < 0.02
        # amplitude
        L = b - a
        lt = np.arange(L) / SR
        att = np.clip(lt / 0.05, 0, 1)
        rel = np.ones(L) if legato else np.clip((d - lt) / 0.12, 0, 1)
        swell = 0.85 + 0.15 * np.clip(lt / 0.4, 0, 1)
        amp[a:b] = np.maximum(amp[a:b], att * rel * swell)
        vibd[a:b] = np.clip((lt - 0.22) / 0.35, 0, 1) * (1 if d > 0.4 else 0.3)
    # glides: smooth frequency in log domain where notes are legato
    lf = np.log(f)
    k = int(glide * SR)
    lf = np.convolve(np.pad(lf, (k, k), mode='edge'), np.ones(k) / k, mode='same')[k:-k]
    f = np.exp(lf)
    f *= 2 ** (vib / 12 * vibd * np.sin(2 * np.pi * 5.3 * tt))
    k2 = int(0.012 * SR)
    amp = np.convolve(amp, np.ones(k2) / k2, mode='same')
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.22 * np.sin(2 * ph + 0.3) + 0.07 * np.sin(3 * ph) + 0.03 * np.sin(4 * ph)
    breath = bp(rng.normal(0, 1, n), 1200, 5200, SR) * (0.5 + 0.5 * np.sin(ph))
    chiff = np.zeros(n)
    for s, d, m in notes:
        a = int(s * SR)
        L = int(0.05 * SR)
        if a + L < n:
            chiff[a:a + L] += np.exp(-np.arange(L) / SR * 60) * 0.6
    breath = breath * (0.07 + chiff)
    out = (tone * 0.9 + breath) * amp
    return lp(out, 6500, SR).astype(np.float32)


def bell(m, dur=2.2, vel=1.0):
    f = mtof(m)
    L = int(dur * SR)
    tt = np.arange(L) / SR
    mod = np.sin(2 * np.pi * f * 3.5 * tt) * 2.2 * np.exp(-tt * 2.5)
    s = np.sin(2 * np.pi * f * tt + mod) * np.exp(-tt * 1.9)
    s += 0.3 * np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt * 3.0)
    s *= np.clip(tt / 0.002, 0, 1)
    return (s * vel * 0.5).astype(np.float32)


def lead(m, dur, vel=1.0):
    f = mtof(m)
    L = int((dur + 0.25) * SR)
    tt = np.arange(L) / SR
    s = sum(saw(f * (1 + d / 1200), tt, rng) for d in (-9, 0, 8)) / 3
    s = s + 0.5 * np.sin(2 * np.pi * f / 2 * tt)
    e = env_adsr(L, 0.01, 0.25, 0.7, 0.22)
    return (lp(s * e, 2600, SR) * vel * 0.5).astype(np.float32)


def pad(chord, dur):
    L = int((dur + 0.8) * SR)
    tt = np.arange(L) / SR
    s = np.zeros(L)
    for m in chord:
        for det in (-0.13, 0.0, 0.12):
            s += saw(mtof(m) * (1 + det / 100), tt, rng)
    e = np.clip(tt / 0.7, 0, 1) * np.clip((dur + 0.8 - tt) / 0.8, 0, 1)
    return (lp(s * e, 1500, SR) * 0.06).astype(np.float32)


def sub808(m, dur):
    L = int(dur * SR)
    tt = np.arange(L) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt)
    e = np.clip(tt / 0.005, 0, 1) * np.clip((dur - tt) / 0.05, 0, 1) * np.exp(-tt * 0.9)
    return (np.tanh(s * e * 1.6) * 0.55).astype(np.float32)


# --- tabla (tuned to D)
SA = mtof(62)


def _dayan(decays, amps, length=0.9, f0=SA, click=0.5):
    L = int(length * SR)
    tt = np.arange(L) / SR
    s = np.zeros(L)
    for k, (a, d) in enumerate(zip(amps, decays)):
        s += a * np.sin(2 * np.pi * f0 * (k + 1) * tt * (1 + 0.004 * np.exp(-tt * 30))) * np.exp(-tt * d)
    s += click * hp(rng.normal(0, 1, L), 2500, SR) * np.exp(-tt * 180)
    return (s * 0.35).astype(np.float32)


def _bayan(bend=0.9, length=0.8, f0=78):
    L = int(length * SR)
    tt = np.arange(L) / SR
    f = f0 * (1 + bend * np.exp(-tt * 10))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 4.5)
    s += 0.2 * lp(rng.normal(0, 1, L), 500, SR) * np.exp(-tt * 40)
    return (s * 0.5).astype(np.float32)


TABLA = {
    'na': _dayan([7, 9, 12, 16, 20], [1, 0.55, 0.35, 0.2, 0.1]),
    'tin': _dayan([18, 14, 16, 20, 24], [0.4, 0.8, 0.5, 0.25, 0.1], 0.5),
    'te': _dayan([45, 50, 60], [0.5, 0.4, 0.3], 0.2, click=1.2),
    'ge': _bayan(),
    'ka': (lp(rng.normal(0, 1, int(0.12 * SR)), 700, SR) * np.exp(-np.arange(int(0.12 * SR)) / SR * 45) * 0.35).astype(np.float32),
}
TABLA['dha'] = None
TABLA['dhin'] = None


def bol(name):
    if name == 'dha':
        a, b = TABLA['na'], TABLA['ge']
    elif name == 'dhin':
        a, b = TABLA['tin'], TABLA['ge']
    else:
        return TABLA[name]
    L = max(len(a), len(b))
    out = np.zeros(L, np.float32)
    out[:len(a)] += a
    out[:len(b)] += b * 0.85
    return out


def _cym(dur, dec, lo):
    L = int(dur * SR)
    tt = np.arange(L) / SR
    return (hp(rng.normal(0, 1, L), lo, SR) * np.exp(-tt * dec) * np.clip(tt / 0.002, 0, 1)).astype(np.float32)


CRASH = lp(_cym(2.5, 1.6, 4500), 12000, SR).astype(np.float32)
OHAT = lp(_cym(0.35, 9, 6500), 13000, SR).astype(np.float32)

KEHERWA = ['dha', 'ge', 'na', 'tin', 'na', 'ka', 'dhin', 'na']   # 8 eighth-notes per bar


# ----------------------------------------------------------------------------- reverb
def make_ir(dur=2.4, rt=0.42, seed=5):
    r = np.random.default_rng(seed)
    L = int(dur * SR)
    tt = np.arange(L) / SR
    irs = []
    for ch in range(2):
        nz = r.normal(0, 1, L) * np.exp(-tt / rt)
        nz = lp(nz, 5200, SR) * 0.6 + lp(nz, 1800, SR) * 0.4
        for d, g in ((0.011, 0.6), (0.019, 0.5), (0.027 + ch * 0.004, 0.45), (0.041, 0.35)):
            nz[int(d * SR)] += g * 3
        nz[:int(0.008 * SR)] = 0
        irs.append(nz / np.sqrt(np.sum(nz ** 2)))
    return irs


IR = make_ir()


def reverb(st, wet):
    out = np.zeros_like(st)
    for c in range(2):
        out[:, c] = fftconvolve(st[:, c], IR[c])[:len(st)]
    return out * wet


# ----------------------------------------------------------------------------- arrangement
def hook_events(t0, beat=BEAT, transpose=0):
    return [(t0 + o * beat, d * beat, m + transpose) for o, d, m in HOOK]


def render(sections, tail=4.5):
    total = sum(b for _, b in sections) * BAR + tail
    n = int(total * SR) + SR
    B = {k: Bus(n) for k in ('sitar', 'flute', 'bell', 'lead', 'pad', 'str', 'bass', 'tabla', 'drums', 'drone', 'fx')}
    flute_notes = []
    t = 0.0
    for name, bars in sections:
        for bi in range(bars):
            tb = t + bi * BAR
            root, tri = CHORDS[bi % 4]
            phrase_start = bi % 4 == 0
            # ---------------- common harmonic bed
            if name in ('intro', 'sitar', 'groove', 'drop', 'short_intro'):
                B['pad'].add(tb, pad([x - 12 for x in tri] + [root + 12], BAR), 1.0 if name != 'drop' else 1.3)
            if name in ('intro', 'sitar', 'groove', 'break', 'short_intro'):
                for k, m in enumerate((45, 50, 50, 38)):
                    B['drone'].add(tb + k * BEAT, tanpura(m), 0.22, pan=-0.4 + 0.25 * k)
            # ---------------- intro: bell states the hook gently, high octave
            if name in ('intro', 'short_intro') and phrase_start:
                for s, d, m in hook_events(tb):
                    if s < tb + bars * BAR - 0.1:
                        B['bell'].add(s, bell(m + 12, 2.4, 0.55), pan=0.25)
            # ---------------- sitar statement
            if name == 'sitar' and phrase_start:
                for s, d, m in hook_events(tb):
                    B['sitar'].add(s, sitar(m, d), 0.5, pan=-0.15)
                    B['sitar'].add(s + 0.02, tarab(m - 12 if m > 70 else m), 1.0, pan=0.5)
            if name in ('sitar', 'groove', 'drop'):
                B['bass'].add(tb, sub808(root + 12, BEAT * 1.6), 0.55 if name == 'sitar' else 1.0)
                B['bass'].add(tb + BEAT * 2.5, sub808(root + 12, BEAT * 1.4), 0.42 if name == 'sitar' else 0.85)
            # ---------------- tabla keherwa
            if name in ('sitar', 'groove', 'drop'):
                for k, b_ in enumerate(KEHERWA):
                    v = 0.55 if name == 'sitar' else 0.42
                    acc = 1.15 if k in (0, 6) else 1.0
                    B['tabla'].add(tb + k * BEAT / 2, bol(b_), v * acc * rng.uniform(0.92, 1.05), pan=0.15)
                if name != 'sitar':
                    for k in range(8):
                        if rng.random() < 0.45:
                            B['tabla'].add(tb + k * BEAT / 2 + BEAT / 4, bol('te'), 0.22, pan=0.25)
            # ---------------- groove / drop: drums, strings ostinato, flute
            if name in ('groove', 'drop'):
                kv = 0.6 if name == 'groove' else 0.85
                B['drums'].add(tb, kick808(SR), kv)
                B['drums'].add(tb + BEAT * 1.75, kick808(SR), kv * 0.55)
                B['drums'].add(tb + BEAT * 2.5, kick808(SR), kv * 0.6)
                cv = 0.28 if name == 'groove' else 0.40
                B['drums'].add(tb + BEAT * 1, clap(SR, rng), cv)
                B['drums'].add(tb + BEAT * 3, clap(SR, rng), cv * 1.08)
                if name == 'drop':
                    for e in range(4):
                        B['drums'].add(tb + e * BEAT + BEAT / 2, OHAT, 0.05, pan=-0.3)
                for e in range(8):
                    B['drums'].add(tb + e * BEAT / 2, hat(SR, rng), (0.10 if e % 2 == 0 else 0.065), pan=0.35)
                order = [0, 1, 2, 1, 0, 1, 2, 1]
                for s16 in range(16):
                    m = tri[order[s16 % 8]] + 12
                    v = 0.16 if s16 % 4 == 0 else 0.10
                    B['str'].add(tb + s16 * BEAT / 4, string_note(mtof(m), BEAT / 2.2, SR, rng, v), pan=0.5 * np.sin(s16))
            if name == 'groove' and phrase_start:
                flute_notes += hook_events(tb)
                # sitar answers at phrase ends
                for o, m in ((7.0, 74), (7.5, 76), (15.0, 77), (15.5, 81)):
                    B['sitar'].add(tb + o * BEAT, sitar(m, BEAT * 0.5), 0.35, pan=-0.35)
            if name == 'drop' and phrase_start:
                ev = hook_events(tb)
                flute_notes += [(s, d, m + 12) for s, d, m in ev]
                for s, d, m in ev:
                    B['sitar'].add(s, sitar(m, d), 0.42, pan=-0.2)
                    B['lead'].add(s, lead(m, d), 0.35, pan=0.2)
                    B['bell'].add(s, bell(m + 12, 1.4, 0.3), pan=0.35)
            # ---------------- break: riser + tabla tirakita roll
            if name == 'break':
                B['pad'].add(tb, pad([57, 61, 64, 45], BAR), 1.0)
                flute_notes.append((tb, BAR - 0.15, 69))
                for k in range(16):
                    tk = tb + BAR * 0.5 + (k / 16) ** 0.8 * BAR * 0.5
                    B['tabla'].add(tk, bol('te' if k % 2 else 'na'), 0.18 + 0.02 * k, pan=0.1)
        if name == 'drop':
            B['fx'].add(t, boom(SR, rng), 0.5)
            B['drums'].add(t, CRASH, 0.16, pan=0.2)
        if name in ('break',):
            RZ = riser(SR, rng, dur=bars * BAR * 0.9)
            B['fx'].add(t + bars * BAR - len(RZ) / SR, RZ, 0.35)
        if name == 'logo':
            render_logo(B, t)
        t += bars * BAR
    if flute_notes:
        fl = bansuri(flute_notes, total)
        B['flute'].add(0, fl, 0.42, pan=0.1)
    return mixdown(B, total)


def render_logo(B, t0):
    """Sonic logo: A D F E . D(C#) + Dm hit. Slightly broader tempo."""
    beat = BEAT * 1.08
    ev = [(0.0, 0.5, 69), (0.5, 0.5, 74), (1.0, 1.0, 77), (2.0, 0.5, 76)]
    for o, d, m in ev:
        s = t0 + 0.25 + o * beat
        B['sitar'].add(s, sitar(m, d * beat + 0.3), 0.5, pan=-0.15)
        B['bell'].add(s, bell(m + 12, 2.5, 0.45), pan=0.3)
    flute = [(t0 + 0.25 + o * beat, d * beat, m) for o, d, m in ev]
    hit = t0 + 0.25 + 2.5 * beat + 0.08
    flute.append((hit - 0.09, 0.07, 73))           # C# grace (meend into Sa)
    flute.append((hit - 0.02, 3.0, 74))
    B['flute'].add(0, bansuri(flute, hit + 3.5, glide=0.05), 0.38, pan=0.1)
    RZ = riser(SR, rng, dur=hit - t0)
    B['fx'].add(hit - len(RZ) / SR, RZ, 0.22)
    B['fx'].add(hit, boom(SR, rng), 0.55)
    for k, m in enumerate((50, 57, 62, 65, 69, 74)):
        B['sitar'].add(hit + k * 0.018, sitar(m, 2.8), 0.28, pan=-0.3 + 0.12 * k)
    for m in (74, 81, 86):
        B['bell'].add(hit, bell(m, 3.5, 0.4), pan=0.2)
    B['pad'].add(hit, pad([50, 57, 62, 65], 2.8), 1.3)
    B['bass'].add(hit, sub808(38, 2.4), 1.0)
    B['drone'].add(hit, tanpura(38, 3.5), 0.3)
    B['tabla'].add(hit, bol('dha'), 0.6)


def mixdown(B, total):
    sends = {'sitar': 0.32, 'flute': 0.45, 'bell': 0.55, 'lead': 0.25, 'pad': 0.30, 'str': 0.22,
             'bass': 0.0, 'tabla': 0.14, 'drums': 0.06, 'drone': 0.35, 'fx': 0.20}
    gains = {'sitar': 1.0, 'flute': 1.0, 'bell': 0.55, 'lead': 0.6, 'pad': 0.9, 'str': 1.8,
             'bass': 0.9, 'tabla': 0.9, 'drums': 0.85, 'drone': 0.7, 'fx': 0.8}
    filt = {'str': 3200, 'pad': 2200, 'lead': 3000, 'drone': 4000}
    dry = None
    wet_in = None
    for k, bus in B.items():
        st = bus.st() * gains[k]
        if k in filt:
            st = np.stack([lp(st[:, 0], filt[k], SR, 4), lp(st[:, 1], filt[k], SR, 4)], 1)
        dry = st if dry is None else dry + st
        w = st * sends[k]
        wet_in = w if wet_in is None else wet_in + w
    mix = dry + reverb(wet_in, 1.0)
    mix[:, 0] = hp(mix[:, 0], 28, SR)
    mix[:, 1] = hp(mix[:, 1], 28, SR)
    end = int(total * SR)
    mix = mix[:end]
    fo = int(1.5 * SR)
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
    # master: normalise -> gentle saturation -> -1 dBFS peak
    mix /= np.percentile(np.abs(mix), 99.95) + 1e-9
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    mix *= 0.89 / (np.max(np.abs(mix)) + 1e-9)
    return mix.astype(np.float32)


def write(mix, base, mp3=True, wav=False):
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    wpath = f'{HERE}/{base}.wav'
    with wave.open(wpath, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    if mp3:
        subprocess.run([FF, '-y', '-v', 'error', '-i', wpath, '-c:a', 'libmp3lame', '-b:a', '320k',
                        '-metadata', 'title=Kissa Theme', '-metadata', 'artist=Kissa', f'{HERE}/{base}.mp3'], check=True)
    if not wav:
        os.remove(wpath)
    print(base, f'{len(mix) / SR:.1f}s')


if __name__ == '__main__':
    only = os.environ.get('ONLY')
    if not only or only == 'logo':
        write(render([('logo', 1)], tail=3.6), 'kissa_logo', wav=True)
    if not only or only == 'full':
        write(render([('intro', 2), ('sitar', 4), ('groove', 4), ('break', 1), ('drop', 4), ('logo', 1)], tail=3.6),
              'kissa_theme_full', wav=True)
    if not only or only == 'short':
        write(render([('short_intro', 1), ('drop', 4), ('logo', 1)], tail=3.6), 'kissa_theme_short')
