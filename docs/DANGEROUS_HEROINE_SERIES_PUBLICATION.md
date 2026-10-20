# Remote story publication — the dangerous-heroine series (7 stories)

A **content-only** release of seven new 18+ stories, delivered entirely through
Kissa's existing remote pipeline. There is no app change, no Android build and
no APK release. The installed app discovers the stories because the catalog
(`content/manifest.json` → `contentVersion` **46**) and the packages are
streamed from `https://beyondredeye.site/api`, exactly like every earlier OTA
story.

```
story spec (docs/story-specs/sN.py) → build.py → existing schema → validation
  → private story source (this repo) → existing GitHub Actions pipeline
  → existing Cloudflare Worker/API → existing manifest/catalog → production
  → installed app fetches the stories remotely
```

Nothing new was introduced: no second pipeline, no new endpoint, no hard-coded
story list and no app-side change.

## Catalog

All seven stories share one idea: the player's character (the MC) is a shy,
soft-spoken young man, and the heroine is dangerous to the world but deeply
romantic with him.

| # | id | Title | Heroine | Setting | Accent |
|---|---|---|---|---|---|
| 1 | `biwi-ek-supari-killer` | Biwi Ek Supari Killer | Kaashvi, secretly the contract killer "Chhaya" | Mumbai | — |
| 2 | `meri-wali-ips` | Meri Wali IPS | SP Durga Shekhawat | Uttar Pradesh | — |
| 3 | `don-ki-beti-mera-dil` | Don Ki Beti, Mera Dil | Sitara Ghosh, daughter of the Kolkata don Shankar Dada | Kolkata, Durga Puja | `#A3253A` |
| 4 | `commando-wife` | Commando Wife | Major Aditi Rana, Special Forces | Dehradun | `#4F6B3A` |
| 5 | `meri-hacker-girlfriend` | Meri Hacker Girlfriend | Inaaya, the hacker "Phantom" | Bengaluru | `#2E8B8B` |
| 6 | `thakurain` | Thakurain | Thakurain Rudrani Bundela | Bundelkhand / Chambal | `#8B5A2B` |
| 7 | `chudail-nahi-biwi-hai` | Chudail Nahi, Biwi Hai | Mohini, a 300-year-old haveli spirit | Shekhawati, Rajasthan | `#6E2C4F` |

## Story design

Every story follows the project's standing free-form rules:

- **One opening moment only.** Each story has a single opening scene with at
  least two suggested choices (`shortLabel` ≤ 20 characters).
- **Nothing predefined after the opening.** There are no scenes, acts, arcs,
  chapters or endings (`endings: []`), and every story is tagged `ongoing`.
- **No length and no percentages anywhere.**
- **The player controls the MC completely.** The narrator never writes his
  words, actions, thoughts or feelings. The player supplies his name at
  runtime.

Each story also carries its own safety rules:

- Romance is consensual and **non-explicit**, and all heroines are adults.
- The heroine's danger is aimed at the world. She never harms, threatens or
  controls the MC. Any boundary he sets, she **respects at once**.
- Action and horror stay brief and non-graphic. Hacking is cinematic and never
  instructional, and occult content contains no real rituals.

The specs live in `docs/story-specs/s1.py`–`s7.py`. The canonical generator is
`docs/story-specs/build.py`, which writes the five package JSON files and the
manifest entry for each story.

## Artwork

Every story has eight images:

- **Cover.** It follows `docs/COVER_GUIDE.md`: a 2:3 portrait (848×1264), a
  photographic scene, and the exact story title written on it.
- **Gallery.** Seven 1376×768 images, including one solo character portrait of
  the heroine.

Every image keeps the same locked looks:

- **Heroine.** A glamorous Bollywood-heroine face and long wavy hair. Sindoor
  appears only for the married heroines.
- **MC.** Handsome, shy and clean-shaven, in a T-shirt and jacket.

Problems found by viewing each image, and fixed by editing or regenerating:

- stubble on the MC;
- duplicated MCs in group scenes;
- sindoor on an unmarried heroine;
- garbled sign text;
- letterbox bars;
- a malformed rifle.

## Checks before publication

- Full app suite: **827/827** tests and `tsc` clean. This includes
  `__tests__/dangerousHeroineStories.test.ts`, which now requires:
  - all seven ids are present;
  - `contentVersion > 45`;
  - every story validates;
  - the free-form rules hold;
  - the safety wording is present;
  - a portrait cover;
  - exactly seven 1376×768 gallery images per story.
- `__tests__/content.test.ts` and `__tests__/coverGuide.test.ts` also pass.
- Worker tests: **66/66**. `worker/__tests__/ota-catalog.test.ts` now serves all
  seven packages and their 56 images through the real Worker handler.
  - Because that single test fetches every asset of every new story from one
    test IP, it now resets the per-IP rate limiter for each story.
  - Production rate limits are unchanged.
- `scripts/verify-published-story.mjs --local-only --native-size=1376x768,848x1264`
  validates the seven stories and **56** native-size JPEGs.
- **No APK build.** The Android workflow's `paths-ignore` already covered
  `content/**`, `docs/**`, both workflow files, the verifier and the series
  test. This release also adds `__tests__/coverGuide.test.ts` and
  `scripts/new-story.mjs`, so this content-only release does not rebuild or
  release the app.

## Release flow

Commit and push the Arena working branch, open a PR to `main`, and merge.
`main` then runs the existing *Deploy story API* workflow, which now has two
series steps:

1. **Before deploying:** local media validation of the seven stories at their
   native sizes.
2. **After `wrangler deploy`:** published-integrity verification. On both
   production hostnames, for two consecutive passes, the manifest entry and all
   five JSON files must match exactly, and all eight images must be
   byte-identical.

The API smoke test then runs as usual.

Live URLs (base `https://beyondredeye.site/api`), for each `<id>` above:
- package: `/stories/<id>`;
- cover: `/stories/<id>/assets/cover.jpg`;
- gallery: `/stories/<id>/assets/gallery/image-01.jpg` through `image-07.jpg`.

## Limitations

- **No device test.** No physical device with the app already installed is
  available in this workspace. Discovery is therefore verified through the
  unchanged remote catalog architecture, not a device-observed test.
- **Production checks run in CI only.** The sandbox cannot reach the live API,
  so the production verification happens in the CI deploy workflow.
