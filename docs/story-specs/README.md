# Story specs (dangerous-heroine series: s1–s7, plus s8 Ring Ki Rani, s9 Dil Ki Wasooli, s10 Madam Sarkar, s11 Highway Ki Sherni)

Compact Python specs that generate the 5 JSON files + manifest entry of each
OTA story (free-form: opening moment only).

```bash
python3 docs/story-specs/build.py s1 s2   # run from repo root or anywhere
```

`covers/` holds covers generated ahead of their story's gallery; they move to
`content/stories/<id>/assets/cover.jpg` when the story is built.
