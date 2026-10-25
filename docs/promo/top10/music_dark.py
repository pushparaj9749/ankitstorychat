"""Dark cinematic background score for "Kissa ki 10 Sabse Khatarnak Heroines".

92 BPM, D minor (Dm – Bb – Gm – A). Pulsing 16th-note string ostinato,
warm low pad / drone, 808-style sub bass, half-time hybrid drums with trap
hats, a sitar-like plucked motif (D Phrygian-dominant flavour) that plays in
the no-VO "dialogue" moments, and a riser + BOOM hit on every rank reveal.
Music is side-chain ducked under the narration.

make_music(total, sr, vo, quiet_spans, hits, end_start) -> (n, 2) float32
"""
import os
import sys

import numpy as np
from scipy.signal import lfilter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tutorial'))
from music import add, bp, hp, lp, mtof  # noqa: E402

BPM = 92
BEAT = 60 / BPM
BAR = BEAT * 4
S16 = BEAT / 4

# D minor: i – VI – iv – V   (root midi, chord tones for ostinato)
CHORDS = [
    {'root': 38, 'arp': [62, 65, 69, 74]},   # Dm
    {'root': 34, 'arp': [58, 62, 65, 70]},   # Bb
    {'root': 31, 'arp': [55, 58, 62, 67]},   # Gm
    {'root': 33, 'arp': [57, 61, 64, 69]},   # A  (C# = harmonic minor bite)
]
# D Phrygian dominant-ish scale for the pluck motif
RAAG = [62, 63, 66, 67, 69, 70, 72, 74, 75, 78]


def saw(f, tt, rng):
    ph = rng.uniform(0, 1)
    return 2 * ((f * tt + ph) % 1.0) - 1


def string_note(f, dur, sr, rng, vel):
    L = int(dur * sr)
    tt = np.arange(L) / sr
    sig = sum(saw(f * (1 + d / 1200), tt, rng) for d in (-7, 0, 6)) / 3
    env = np.clip(tt / 0.012, 0, 1) * np.exp(-tt * 7.0)
    return (sig * env * vel).astype(np.float32)


def pluck(f, dur, sr, rng, vel):
    """Karplus-Strong pluck with a little buzz -> sitar-ish."""
    L = int(dur * sr)
    p = max(2, int(sr / f))
    buf = rng.uniform(-1, 1, p)
    out = np.zeros(L, np.float32)
    for i in range(L):
        j = i % p
        v = buf[j]
        nxt = buf[(j + 1) % p]
        buf[j] = 0.996 * 0.5 * (v + nxt)
        out[i] = v
    out = np.tanh(out * 2.2) * 0.7 + out * 0.3   # jawari buzz
    tt = np.arange(L) / sr
    out *= np.exp(-tt * 1.6) * vel
    return out.astype(np.float32)


def kick808(sr, f0=58, f1=36, dur=0.9):
    L = int(dur * sr)
    tt = np.arange(L) / sr
    f = f1 + (f0 * 2.2 - f1) * np.exp(-tt * 30)
    ph = 2 * np.pi * np.cumsum(f) / sr
    env = np.exp(-tt * 3.2)
    click = np.exp(-tt * 300) * 0.6
    return np.tanh((np.sin(ph) * env + click) * 1.6).astype(np.float32)


def clap(sr, rng):
    L = int(0.35 * sr)
    tt = np.arange(L) / sr
    nz = rng.normal(0, 1, L)
    env = np.zeros(L)
    for k, off in enumerate((0.0, 0.011, 0.022)):
        env += np.exp(-np.clip(tt - off, 0, None) * 60) * (tt >= off) * (0.8 if k < 2 else 1.0)
    env += np.exp(-tt * 14) * 0.35
    return bp(nz * env, 900, 5000, sr).astype(np.float32)


def hat(sr, rng, dur=0.05):
    L = int(dur * sr)
    tt = np.arange(L) / sr
    return hp(rng.normal(0, 1, L) * np.exp(-tt * 90), 7000, sr).astype(np.float32)


def tom(sr, f=90, dur=0.8):
    L = int(dur * sr)
    tt = np.arange(L) / sr
    ff = f * (1 + 0.6 * np.exp(-tt * 20))
    ph = 2 * np.pi * np.cumsum(ff) / sr
    return (np.sin(ph) * np.exp(-tt * 5.5)).astype(np.float32)


def boom(sr, rng):
    """Cinematic impact: sub drop + noise body + metallic ring."""
    L = int(3.2 * sr)
    tt = np.arange(L) / sr
    f = 30 + 70 * np.exp(-tt * 6)
    sub = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-tt * 1.1)
    body = lp(rng.normal(0, 1, L), 400, sr) * np.exp(-tt * 4) * 0.8
    ring = sum(np.sin(2 * np.pi * fr * tt) * np.exp(-tt * dc) for fr, dc in ((147, 1.6), (220, 2.2), (311, 2.8))) * 0.12
    return np.tanh((sub * 1.2 + body + ring) * 1.3).astype(np.float32)


def riser(sr, rng, dur=1.8):
    L = int(dur * sr)
    tt = np.arange(L) / sr
    x = tt / dur
    nz = rng.normal(0, 1, L)
    sig = lp(nz, 900, sr) * (1 - x) * 0.5 + bp(nz, 1500, 6000, sr) * x * 0.55
    tone = np.sin(2 * np.pi * np.cumsum(220 + 660 * x ** 2) / sr) * 0.12
    env = x ** 2.2
    return ((sig + tone) * env).astype(np.float32)


def make_music(total, sr, vo, quiet_spans, hits, end_start, seed=7):
    rng = np.random.default_rng(seed)
    n = int((total + 1.0) * sr)
    strL = np.zeros(n, np.float32)
    strR = np.zeros(n, np.float32)
    pad = np.zeros(n, np.float32)
    bass = np.zeros(n, np.float32)
    drums = np.zeros(n, np.float32)
    hats = np.zeros(n, np.float32)
    plk = np.zeros(n, np.float32)
    fx = np.zeros(n, np.float32)

    K = kick808(sr)
    C = clap(sr, rng)
    HH = [hat(sr, rng) for _ in range(4)]
    T1, T2 = tom(sr, 85), tom(sr, 120)

    def quiet(tsec):
        return any(a <= tsec < b for a, b in quiet_spans)

    # cache string notes
    cache = {}

    def snote(m, vel):
        key = (m, round(vel, 2))
        if key not in cache:
            cache[key] = string_note(mtof(m), S16 * 2.2, sr, rng, vel)
        return cache[key]

    nbars = int(total / BAR) + 2
    for bar in range(nbars):
        t0 = bar * BAR
        if t0 > total + 1:
            break
        ch = CHORDS[bar % 4]
        intro = t0 < 4.0
        outro = t0 >= end_start + BAR * 2
        # string ostinato (16ths), up-down arpeggio, accented on beats
        order = [0, 1, 2, 3, 2, 1, 2, 3]
        for s in range(16):
            m = ch['arp'][order[s % 8]]
            vel = 0.20 if s % 4 == 0 else 0.12
            if intro:
                vel *= 0.6
            sig = snote(m, vel)
            pan = 0.5 + 0.35 * np.sin(s * 0.7)
            add(strL, (t0 + s * S16) * sr, sig, 1 - pan)
            add(strR, (t0 + s * S16) * sr, sig, pan)
        # pad / drone, one per bar
        L = int(BAR * sr + 0.5 * sr)
        tt = np.arange(L) / sr
        sig = np.zeros(L)
        for m in (ch['root'] + 12, ch['arp'][0] - 12, ch['arp'][2] - 12, 50):
            f = mtof(m)
            for det in (-0.15, 0.0, 0.14):
                sig += saw(f * (1 + det / 100), tt, rng)
        env = np.clip(tt / 0.4, 0, 1) * np.clip((BAR + 0.5 - tt) / 0.5, 0, 1)
        add(pad, t0 * sr, (sig * env).astype(np.float32), 0.018)
        if intro or outro:
            continue
        # 808 sub: root on 1, syncopated pickups
        r = ch['root'] + 12
        for off, m, dur in ((0.0, r, BEAT * 1.6), (BEAT * 1.75, r, BEAT * 0.5), (BEAT * 2.5, r, BEAT * 0.9), (BEAT * 3.5, r + 12 if bar % 2 else r + 7, BEAT * 0.45)):
            L = int(dur * sr)
            tt = np.arange(L) / sr
            f = mtof(m)
            s_ = np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)
            e_ = np.clip(tt / 0.006, 0, 1) * np.clip((dur - tt) / 0.04, 0, 1) * np.exp(-tt * 1.2)
            add(bass, (t0 + off) * sr, np.tanh(s_ * e_ * 1.5).astype(np.float32), 0.30)
        # half-time drums: kick 1 + "a" of 2, clap on 3
        add(drums, t0 * sr, K, 0.55)
        add(drums, (t0 + BEAT * 1.75) * sr, K, 0.32)
        if bar % 2 == 1:
            add(drums, (t0 + BEAT * 3.5) * sr, K, 0.28)
        add(drums, (t0 + BEAT * 2) * sr, C, 0.30)
        # trap hats: 8ths, with 1/32 rolls on bar 4
        for e in range(8):
            off = e * BEAT / 2
            if bar % 4 == 3 and e == 6:
                for k in range(6):
                    add(hats, (t0 + off + k * BEAT / 12) * sr, HH[k % 4], 0.05 + 0.012 * k)
                break
            add(hats, (t0 + off) * sr, HH[rng.integers(0, 4)], (0.09 if e % 2 == 0 else 0.06) * rng.uniform(0.85, 1.1))
        # war toms where nobody speaks
        if quiet(t0 + BEAT):
            add(drums, (t0 + BEAT * 0.5) * sr, T1, 0.22)
            add(drums, (t0 + BEAT * 3.0) * sr, T2, 0.18)
            add(drums, (t0 + BEAT * 3.25) * sr, T2, 0.14)

    # sitar-ish pluck motif in quiet spans (dialogue moments / title / end)
    motif = [0, 2, 3, 4, 3, 2, 1, 0, 4, 5, 4, 3, 2, 3, 1, 0]
    pc = {}
    t = 0.0
    k = 0
    while t < total:
        if quiet(t) and (k % 2 == 0 or rng.random() < 0.35):
            m = RAAG[motif[k % len(motif)]]
            if m not in pc:
                pc[m] = pluck(mtof(m), 1.6, sr, rng, 0.22)
            add(plk, t * sr, pc[m])
        t += BEAT / 2
        k += 1

    # rank reveals: riser into BOOM
    B = boom(sr, rng)
    RZ = riser(sr, rng)
    for h in hits:
        add(fx, (h - len(RZ) / sr) * sr, RZ, 0.30)
        add(fx, h * sr, B, 0.55)

    strL = lp(strL, 3200, sr)
    strR = lp(strR, 3200, sr)
    pad = lp(pad, 900, sr)
    bass = lp(bass, 400, sr)

    def verb(x, taps):
        y = x.copy()
        for d, g in taps:
            s = int(d * sr)
            y[s:] += x[:-s] * g
        return lp(y, 3800, sr)

    plL = verb(plk, [(0.043, 0.35), (0.091, 0.25), (0.157, 0.18), (0.233, 0.12)])
    plR = verb(plk, [(0.051, 0.35), (0.097, 0.25), (0.171, 0.18), (0.251, 0.12)])
    fxL = verb(fx, [(0.061, 0.3), (0.137, 0.2)])
    fxR = verb(fx, [(0.073, 0.3), (0.149, 0.2)])

    Lc = strL + pad + bass + drums + hats * 0.85 + plL * 0.9 + fxL
    Rc = strR + pad + bass + drums + hats * 1.1 + plR * 1.1 + fxR
    mus = np.stack([Lc, Rc], 1).astype(np.float32)

    # side-chain duck under narration
    env = np.abs(vo)
    a = np.exp(-1 / (0.02 * sr))
    env = lfilter([1 - a], [1, -a], env)
    win = int(0.35 * sr)
    env = np.convolve(env, np.ones(win) / win, mode='same')
    env = np.clip(env / (np.percentile(env[env > 1e-4], 70) + 1e-9), 0, 1)
    duck = 1.0 - 0.45 * env
    base = np.full(n, 0.68, np.float32)
    for a_, b_ in quiet_spans:
        base[int(a_ * sr):int(b_ * sr)] = 1.0
    k2 = int(0.4 * sr)
    base = np.convolve(base, np.ones(k2) / k2, mode='same')
    mus *= (duck * base)[:, None]
    fi = int(1.0 * sr)
    mus[:fi] *= np.linspace(0, 1, fi)[:, None]
    end = int(total * sr)
    fo = int(3.0 * sr)
    mus[end - fo:end] *= np.linspace(1, 0, fo)[:, None]
    mus[end:] = 0
    pk = np.percentile(np.abs(mus), 99.9) + 1e-9
    mus *= 0.45 / pk
    return mus
