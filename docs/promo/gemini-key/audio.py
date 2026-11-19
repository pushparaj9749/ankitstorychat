"""Background bed for the Gemini-key tutorial.

Original synthesis (no sampled/copyrighted audio): a slow Am–F–C–G pad, a soft
pluck on the beat, a felt kick on 1 and 3, and a tape-ish noise floor. Written
as data, so it can be regenerated or re-timed with the video.
"""
import wave

import numpy as np

SR = 44100
BPM = 72
BEAT = 60.0 / BPM

# A minor 9 / F major 9 / C major 9 / G major — root, fifth, third, seventh (Hz)
CHORDS = [
    [220.00, 329.63, 261.63, 493.88],
    [174.61, 261.63, 220.00, 392.00],
    [130.81, 196.00, 164.81, 293.66],
    [196.00, 293.66, 246.94, 440.00],
]


def env(n, attack, release, sustain=1.0):
    a = max(1, int(attack * SR))
    r = max(1, int(release * SR))
    e = np.full(n, sustain, dtype=np.float32)
    a = min(a, n)
    e[:a] = np.linspace(0, sustain, a, dtype=np.float32)
    r = min(r, n)
    if r:
        e[-r:] *= np.linspace(1, 0, r, dtype=np.float32)
    return e


def sine(freq, n, phase=0.0):
    t = np.arange(n, dtype=np.float32) / SR
    return np.sin(2 * np.pi * freq * t + phase).astype(np.float32)


def pad_chord(freqs, seconds):
    n = int(seconds * SR)
    out = np.zeros(n, dtype=np.float32)
    for i, f in enumerate(freqs):
        # two detuned oscillators per note, plus one octave of air
        out += 0.30 * sine(f, n, phase=i * 0.7) * (1 + 0.02 * np.sin(2 * np.pi * 0.13 * np.arange(n) / SR))
        out += 0.16 * sine(f * 1.004, n, phase=i) 
        out += 0.06 * sine(f * 2, n)
    out *= env(n, attack=1.6, release=1.8, sustain=1.0)
    # gentle low-pass: moving average
    k = 24
    kernel = np.ones(k, dtype=np.float32) / k
    return np.convolve(out, kernel, mode='same').astype(np.float32)


def pluck(freq, seconds=1.1, gain=0.16):
    n = int(seconds * SR)
    t = np.arange(n, dtype=np.float32) / SR
    tri = 2 * np.abs(2 * (t * freq - np.floor(t * freq + 0.5))) - 1
    body = (0.7 * tri + 0.3 * np.sin(2 * np.pi * freq * 2 * t)).astype(np.float32)
    decay = np.exp(-t * 4.2).astype(np.float32)
    return gain * body * decay


def kick(seconds=0.5, gain=0.13):
    n = int(seconds * SR)
    t = np.arange(n, dtype=np.float32) / SR
    f = 52 + 34 * np.exp(-t * 22)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR).astype(np.float32)
    return gain * tone * np.exp(-t * 7.5).astype(np.float32)


def build(path, seconds):
    n = int(seconds * SR)
    mix = np.zeros(n, dtype=np.float32)

    seg = 8.0  # chord length
    i = 0
    pos = 0.0
    while pos < seconds:
        chord = CHORDS[i % len(CHORDS)]
        length = min(seg, seconds - pos)
        pad = pad_chord(chord, length)
        start = int(pos * SR)
        mix[start:start + len(pad)] += pad
        pos += seg
        i += 1

    # plucks on every beat, walking the chord tones
    step = 0
    t = 4.0
    while t < seconds - 3:
        chord = CHORDS[int(t // seg) % len(CHORDS)]
        note = chord[step % 4] * (2 if step % 8 in (5, 7) else 1)
        p = pluck(note)
        start = int(t * SR)
        end = min(n, start + len(p))
        mix[start:end] += p[:end - start]
        step += 1
        t += BEAT

    # felt kick on 1 and 3 of each bar
    t = 2.0
    while t < seconds - 3:
        k = kick()
        start = int(t * SR)
        end = min(n, start + len(k))
        mix[start:end] += k[:end - start]
        t += BEAT * 2

    # noise floor (very low) + fades
    rng = np.random.default_rng(3)
    floor = rng.normal(0, 0.004, n).astype(np.float32)
    k = 400
    floor = np.convolve(floor, np.ones(k, dtype=np.float32) / k, mode='same').astype(np.float32)
    mix += floor

    fade_in = int(1.0 * SR)
    mix[:fade_in] *= np.linspace(0, 1, fade_in, dtype=np.float32)
    fade_out = int(3.0 * SR)
    mix[-fade_out:] *= np.linspace(1, 0, fade_out, dtype=np.float32)

    # soft-knee limit, then headroom
    mix = np.tanh(mix * 1.1).astype(np.float32) * 0.32

    stereo = np.stack([mix, np.roll(mix, 220)], axis=1)
    peak = float(np.max(np.abs(stereo))) or 1.0
    stereo = (stereo / peak * 0.72 * 32767).astype(np.int16)

    with wave.open(path, 'wb') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(stereo.tobytes())
    return path


if __name__ == '__main__':
    import sys
    build(sys.argv[1] if len(sys.argv) > 1 else 'bed.wav', float(sys.argv[2]) if len(sys.argv) > 2 else 108)
