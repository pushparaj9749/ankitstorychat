# Kissa — 9:16 epic promo ("Ramayana-trailer vibe")

A **38.6 s vertical Short** cut in the visual language of a mythological-epic trailer:
monumental scale, god-rays, embers, hard impacts, a held breath before the drop, and a
product end card that shows real story covers.

Everything in it is **original or owned by this repo** — no third-party footage, no
third-party music:

- **Visuals:** 10 generated cinematic plates (`work/ramayan-promo/plates/`, local only) —
  temple dawn, haveli dusk, rain street, desert storm, cyberpunk alley, sleeper-train
  corridor, firefighter, kitchen, stage, clock shop. Only the finished video is published.
- **Music:** the Kissa signature theme, `docs/promo/theme/kissa_theme_full.mp3`
  (D harmonic minor, 96 BPM, sitar/bansuri/tabla/808). Entered at its sitar hook (5.0 s)
  and loudness-normalised to −14 LUFS / −1.5 dBTP.
- **Covers:** five real `content/stories/*/assets/cover.jpg` portraits in the end card.

## Specs

| | |
|---|---|
| Resolution | 2160×3840 master, published **1440×2560** (YouTube requires ≥1440 px on the short side for the 4K badge) |
| Duration | 38.60 s (Shorts-safe, < 60 s) |
| Frame rate | 30 fps |
| Video | H.264 High, yuv420p, 12.4 Mbps |
| Audio | AAC-LC 48 kHz stereo, 256 kbps, −12.7 LUFS integrated |
| Loudness | normalised, no clipping |

## Cut structure (96 BPM, bar = 2.5 s)

```
 0.0 – 10.0   sitar hook        slow establishing cuts
10.0 – 20.0   groove            faster cuts, genre teasers
20.0 – 22.5   break             one held breath
22.5 – 32.5   drop              hard cuts, impacts, flash frames
32.5 – 38.6   end card          wordmark, tagline, link, cover shelf
```

Impacts on the downbeats (0.0, 12.5, 20.0, 22.5, 25.0, 27.5, 31.25) drive a decaying
camera shake + flash, and copy sits in the lower third with a cinematic scrim so it
survives Shorts UI.

## Rebuild

```bash
pip install --break-system-packages imageio-ffmpeg pillow numpy

cd docs/promo/ramayan-shorts
python3 build_short.py                     # full 2160x3840 master
SCALE=0.6667 python3 build_short.py        # 1440x2560 publish render
SCALE=0.34 STILLS=1.0,22.6,36.0 python3 build_short.py   # review stills
```

Env knobs: `SCALE`, `CRF`, `PRESET`, `GRAIN`, `OUT`. Plates are read from
`work/ramayan-promo/plates/` (kept out of git — regenerate any 9:16 stills into that
folder to rebuild).

`*.mp4` is gitignored here on purpose: the rendered file ships as a **GitHub Release
asset**, so the repo stays light and the download link is stable.
