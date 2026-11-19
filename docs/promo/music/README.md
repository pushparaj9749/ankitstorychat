# Promo music (original, royalty-free)

| File | Kya hai |
| --- | --- |
| `kissa_lofi_romantic.wav` | 60 s slow lofi romantic bed — 68 BPM, A minor (Am7–Fmaj7–Cmaj7–G6), mono 32 kHz |
| `kissa_lofi_romantic_slow.wav` | Wahi bed, slowed + reverb ke baad — 69.8 s |

Ye **poora synthesised** hai — koi sample, koi existing song, koi label ka audio nahi.
Kissa promos, reels, shorts aur app beds me bina licensing ke use kar sakte hain.

Regenerate / make a different length or tempo:

```bash
node scripts/gen-lofi-bed.mjs            # 60 s, 68 BPM
node scripts/gen-lofi-bed.mjs 30 74      # 30 s, 74 BPM
node scripts/gen-lofi-bed.mjs 180 62     # 3 min, slower
```

Output always lands here as `kissa_lofi_romantic.wav`.

**Note:** copyrighted songs (jaise "Guzarish" — T-Series) rip karke repo/app me
nahi daal sakte. Inhe sirf legally (YouTube Premium download / label license)
le kar, apni machine par separate rakho.

## Slowed + reverb (lofi) version

`kissa_lofi_romantic_slow.wav` — the same bed, 0.86× speed, reverb 0.42, lowpass
3.2 kHz, vinyl + tape wobble. 69.8 s, mono 32 kHz.

Regenerate or apply the same chain to **any track you own**:

```bash
node scripts/lofi-ize.mjs docs/promo/music/kissa_lofi_romantic.wav \
  -o docs/promo/music/kissa_lofi_romantic_slow.wav \
  --speed=0.86 --reverb=0.42 --lowpass=3200
```

Options: `--speed` (0.8–0.95 typical), `--reverb` 0–1, `--size` reverb length,
`--lowpass` Hz, `--vinyl` 0–2, `--wobble` 0–2, `--fadein`, `--fadeout`,
`--bits=16|24`. WAV in, WAV out, no dependencies.

> **Only for audio you own** (your recordings, your AI generations, or tracks
> whose licence allows derivatives). Slowing down someone else's release does
> not make it yours — that is still a derivative work of their copyright.
