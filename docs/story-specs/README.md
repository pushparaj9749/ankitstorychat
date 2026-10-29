# Story specs (dangerous-heroine series: s1–s7, plus s8 Ring Ki Rani, s9 Dil Ki Wasooli, s10 Madam Sarkar, s11 Highway Ki Sherni, s12 Dulhan Bhagi Shadi Se, s13 Jungle Ki Rani, s14 Hero's Party — from Ankit 2.0's idea, s15 Sharmili Shooter — shy + dangerous heroine, open hero)

Compact Python specs that generate the 5 JSON files + manifest entry of each
OTA story (free-form: opening moment only).

```bash
python3 docs/story-specs/build.py s1 s2   # run from repo root or anywhere
```

`covers/` holds covers generated ahead of their story's gallery; they move to
`content/stories/<id>/assets/cover.jpg` when the story is built.

## Creator credit (stories from user ideas)

By default every story is credited to the Kissa owner (`Ankit`, verified; avatar bundled in the app).
When a story is built from a user's **accepted idea**, credit that user in the SPEC:

```python
"creator": {"name": "<their creator name>", "avatar": "assets/creator.jpg", "verified": False},
```

`avatar` is optional; when set, put a square (512×512) JPEG at `content/stories/<id>/assets/creator.jpg`.
No other avatar path or URL is accepted by the app or the story API. If the story is already published,
bump its `version` too so devices pick up the change.

