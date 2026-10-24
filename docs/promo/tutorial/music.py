"""Background music for the Kissa tutorial — synthesised lo-fi / chill groove.

84 BPM, Am9 – Fmaj7 – Cmaj7 – G6sus. Rhodes-style FM electric piano, warm
pad, round bass, soft kick / snare / swung hats, vinyl crackle, and a bell
melody that only plays where there is no voice-over (title, chapter cards,
end card). Music is side-chain ducked under the VO so speech stays clear.

make_music(total, sr, vo, quiet_spans, card_times, end_start) -> (n, 2) float32
"""
import numpy as np
from scipy.signal import butter, lfilter, sosfilt

BPM = 84
BEAT = 60 / BPM
BAR = BEAT * 4


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, fc, sr, order=2):
    sos = butter(order, fc / (sr / 2), 'low', output='sos')
    return sosfilt(sos, x)


def hp(x, fc, sr, order=2):
    sos = butter(order, fc / (sr / 2), 'high', output='sos')
    return sosfilt(sos, x)


def bp(x, lo, hi, sr, order=2):
    sos = butter(order, [lo / (sr / 2), hi / (sr / 2)], 'band', output='sos')
    return sosfilt(sos, x)


# chord voicings (MIDI): Am9, Fmaj7, Cmaj7(add9), G6sus
CHORDS = [
    dict(root=45, notes=[57, 60, 64, 67, 71]),
    dict(root=41, notes=[57, 60, 64, 65, 69]),
    dict(root=48, notes=[55, 59, 62, 64, 67]),
    dict(root=43, notes=[55, 59, 62, 64, 69]),
]
PENTA = [69, 72, 74, 76, 79, 81, 84]  # A minor pentatonic-ish for bells


def rhodes(f, dur, sr, vel=1.0):
    n = int(dur * sr)
    t = np.arange(n) / sr
    I = 1.6 * np.exp(-t * 6.0) + 0.25
    mod = np.sin(2 * np.pi * f * t)
    car = np.sin(2 * np.pi * f * t + I * mod)
    tine = 0.18 * np.sin(2 * np.pi * f * 7.0 * t) * np.exp(-t * 28)
    env = np.exp(-t * 1.25) * np.clip(t / 0.004, 0, 1)
    rel = np.clip((dur - t) / 0.08, 0, 1)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.6 * t)
    return ((car + tine) * env * rel * trem * vel).astype(np.float32)


def bell(f, dur, sr, vel=1.0):
    n = int(dur * sr)
    t = np.arange(n) / sr
    s = (np.sin(2 * np.pi * f * t + 0.9 * np.exp(-t * 4) * np.sin(2 * np.pi * f * 3.5 * t))
         + 0.3 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 3))
    env = np.exp(-t * 2.2) * np.clip(t / 0.003, 0, 1)
    return (s * env * vel).astype(np.float32)


def kick(sr):
    n = int(0.42 * sr)
    t = np.arange(n) / sr
    f = 46 + 90 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / sr
    s = np.sin(ph) * np.exp(-t * 9.5)
    click = np.exp(-t * 400) * 0.25
    return np.tanh((s + click) * 1.4).astype(np.float32)


def snare(sr, rng):
    n = int(0.3 * sr)
    t = np.arange(n) / sr
    nz = bp(rng.normal(0, 1, n), 900, 6500, sr) * np.exp(-t * 16)
    body = 0.45 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 26)
    return (nz * 0.9 + body).astype(np.float32)


def hat(sr, rng, open_=False):
    n = int((0.22 if open_ else 0.06) * sr)
    t = np.arange(n) / sr
    nz = hp(rng.normal(0, 1, n), 7000, sr)
    return (nz * np.exp(-t * (14 if open_ else 70))).astype(np.float32)


def add(buf, at, sig, gain=1.0):
    s = int(at)
    if s >= len(buf) or s + len(sig) <= 0:
        return
    if s < 0:
        sig = sig[-s:]
        s = 0
    e = min(len(buf), s + len(sig))
    buf[s:e] += sig[:e - s] * gain


def make_music(total, sr, vo, quiet_spans, card_times, end_start, seed=11):
    rng = np.random.default_rng(seed)
    n = int((total + 1.0) * sr)
    keys = np.zeros(n, np.float32)
    keysR = np.zeros(n, np.float32)
    pad = np.zeros(n, np.float32)
    bass = np.zeros(n, np.float32)
    drums = np.zeros(n, np.float32)
    hats = np.zeros(n, np.float32)
    bells = np.zeros(n, np.float32)

    K = kick(sr)
    S = snare(sr, rng)
    HC = [hat(sr, rng) for _ in range(4)]
    HO = hat(sr, rng, True)
    swing = BEAT / 2 * 0.16

    def quiet(tsec):
        return any(a <= tsec < b for a, b in quiet_spans)

    nbars = int(total / BAR) + 2
    # 2-bar per chord
    for bar in range(nbars):
        t0 = bar * BAR
        if t0 > total + 1:
            break
        ch = CHORDS[(bar // 2) % 4]
        intro = t0 < 4.6  # title: keys + bells only
        outro = t0 >= end_start
        # electric piano: hit on 1 and the "and" of 2, light ghost on 4
        hits = [(0.0, 1.0, BEAT * 1.5), (BEAT * 1.5 + swing, 0.65, BEAT * 1.4), (BEAT * 3 + swing, 0.4, BEAT * 0.9)]
        if bar % 2 == 1:
            hits = [(0.0, 0.8, BEAT * 2.2), (BEAT * 2.5 + swing, 0.55, BEAT * 1.4)]
        for off, vel, dur in hits:
            for j, m in enumerate(ch['notes']):
                strum = j * 0.012
                sig = rhodes(mtof(m), dur, sr, vel * 0.16)
                pan = 0.35 + 0.3 * (j / 4)
                add(keys, (t0 + off + strum) * sr, sig, 1 - pan)
                add(keysR, (t0 + off + strum) * sr, sig, pan)
        # pad (once per chord, 2 bars)
        if bar % 2 == 0:
            L = int(BAR * 2 * sr + 0.6 * sr)
            tt = np.arange(L) / sr
            sig = np.zeros(L, np.float32)
            for m in ch['notes'][:4]:
                f = mtof(m - 12)
                for det in (-0.12, 0.0, 0.11):
                    ph = rng.uniform(0, 2 * np.pi)
                    sig += np.sign(np.sin(2 * np.pi * f * (1 + det / 100) * tt + ph)) * 0.25 + np.sin(2 * np.pi * f * tt + ph)
            env = np.clip(tt / 0.9, 0, 1) * np.clip((BAR * 2 + 0.6 - tt) / 0.9, 0, 1)
            add(pad, t0 * sr, (sig * env).astype(np.float32), 0.02)
        if intro:
            continue
        # bass: root on 1, fifth/octave pickup
        r = ch['root']
        pattern = [(0.0, r, BEAT * 1.4), (BEAT * 1.5 + swing, r, BEAT * 0.45), (BEAT * 2.5 + swing, r + 7, BEAT * 0.9), (BEAT * 3.5 + swing, r + 12, BEAT * 0.4)]
        for off, m, dur in pattern:
            L = int(dur * sr)
            tt = np.arange(L) / sr
            f = mtof(m)
            sig = np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt)
            env = np.clip(tt / 0.01, 0, 1) * np.exp(-tt * 2.0) * np.clip((dur - tt) / 0.05, 0, 1)
            add(bass, (t0 + off) * sr, np.tanh(sig * env * 1.3).astype(np.float32), 0.30)
        if outro and t0 > end_start + BAR * 2:
            continue
        # drums
        add(drums, t0 * sr, K, 0.55)
        add(drums, (t0 + BEAT * 2.5 + swing) * sr, K, 0.35)
        add(drums, (t0 + BEAT) * sr, S, 0.22)
        add(drums, (t0 + BEAT * 3) * sr, S, 0.24)
        for e in range(8):
            off = e * BEAT / 2 + (swing if e % 2 else 0)
            v = 0.07 if e % 2 else 0.11
            if e == 7 and bar % 4 == 3:
                add(hats, (t0 + off) * sr, HO, 0.06)
            else:
                add(hats, (t0 + off) * sr, HC[rng.integers(0, 4)], v * rng.uniform(0.8, 1.1))

    # bells only in quiet spans (title, cards, end)
    step = BEAT / 2
    k = 0
    tt = 0.0
    while tt < total:
        if quiet(tt) and rng.random() < 0.55:
            m = PENTA[(k * 3 + rng.integers(0, 3)) % len(PENTA)]
            add(bells, tt * sr, bell(mtof(m), 1.6, sr, 0.11))
            k += 1
        tt += step

    # vinyl crackle + hiss
    crackle = np.zeros(n, np.float32)
    pops = rng.random(n) < (14 / sr)
    crackle[pops] = rng.normal(0, 0.35, pops.sum())
    crackle = hp(crackle, 1500, sr) + hp(rng.normal(0, 0.004, n), 4000, sr)

    # card whoosh / riser into each card
    fx = np.zeros(n, np.float32)
    for c in card_times:
        L = int(1.1 * sr)
        nz = rng.normal(0, 1, L)
        t = np.arange(L) / sr
        sw = np.zeros(L)
        # swept band-pass approximation: blend of LP noises
        sw = lp(nz, 700, sr) * (1 - t / 1.1) + bp(nz, 1200, 4500, sr) * (t / 1.1) * 0.6
        env = np.sin(np.pi * np.clip(t / 1.1, 0, 1)) ** 2
        add(fx, (c - 0.7) * sr, (sw * env).astype(np.float32), 0.045)
        add(fx, c * sr, kick(sr), 0.35)

    keys = lp(keys, 4200, sr)
    keysR = lp(keysR, 4200, sr)
    pad = lp(pad, 1400, sr)
    bass = lp(bass, 600, sr)

    # simple stereo reverb-ish tail on keys/bells (multi-tap delay)
    def verb(x, taps):
        y = x.copy()
        for d, g in taps:
            s = int(d * sr)
            y[s:] += x[:-s] * g
        return lp(y, 3500, sr)

    keysL = verb(keys + bells * 0.8, [(0.031, 0.35), (0.067, 0.25), (0.113, 0.18), (0.181, 0.12)])
    keysR = verb(keysR + bells * 1.0, [(0.037, 0.35), (0.071, 0.25), (0.127, 0.18), (0.197, 0.12)])

    hats_l = hats * 0.8
    hats_r = hats * 1.1
    L = keysL + pad + bass + drums + hats_l + crackle * 0.5 + fx
    R = keysR + pad + bass + drums + hats_r + crackle * 0.5 + fx
    mus = np.stack([L, R], 1).astype(np.float32)

    # side-chain ducking from VO envelope
    env = np.abs(vo)
    a = np.exp(-1 / (0.02 * sr))
    env = lfilter([1 - a], [1, -a], env)
    win = int(0.35 * sr)
    env = np.convolve(env, np.ones(win) / win, mode='same')
    env = np.clip(env / (np.percentile(env[env > 1e-4], 70) + 1e-9), 0, 1)
    duck = 1.0 - 0.45 * env
    # louder where no VO is planned at all (title/cards/end)
    base = np.full(n, 0.70, np.float32)
    for a_, b_ in quiet_spans:
        base[int(a_ * sr):int(b_ * sr)] = 0.95
    k2 = int(0.5 * sr)
    base = np.convolve(base, np.ones(k2) / k2, mode='same')
    g = (duck * base)[:, None]
    mus *= g
    # fades
    fi = int(1.2 * sr)
    mus[:fi] *= np.linspace(0, 1, fi)[:, None]
    end = int(total * sr)
    fo = int(3.0 * sr)
    mus[end - fo:end] *= np.linspace(1, 0, fo)[:, None]
    mus[end:] = 0
    # normalise music bus to a fixed peak
    pk = np.percentile(np.abs(mus), 99.9) + 1e-9
    mus *= 0.42 / pk
    return mus
