# Remote story publication — Tumhe Kabhi Pata Hi Nahi Chala + Jo Usne Bataya Nahi

Two **content-only** story additions delivered entirely through Kissa's existing
remote pipeline. No app change, no Android build, no APK, no version change:
the installed **v2.5.1** app discovers and opens both stories because the
catalog (`content/manifest.json` → `contentVersion`) and the packages are
streamed from `https://beyondredeye.site/api`, exactly like every previous OTA
story.

```
story creation → existing schema → validation → private story source (this repo)
             → existing GitHub Actions pipeline → existing Cloudflare Worker/API
             → existing manifest/catalog → production deploy
             → current installed v2.5.1 app fetches the stories remotely
```

Nothing new was introduced: no second pipeline, no second backend, no second
story delivery mechanism, no story content hard-coded in the app.

## Catalog

| | Story 1 | Story 2 |
|---|---|---|
| `id` / `storyDir` | `tumhe-kabhi-pata-hi-nahi-chala` | `jo-usne-bataya-nahi` |
| Title | **Tumhe Kabhi Pata Hi Nahi Chala** | **Jo Usne Bataya Nahi** |
| Genres | Slice of Life · Slow-Burn Romance · Youth · Emotional Romance | Romance · Married Life · Family Drama · Emotional Relationship · Slice of Life |
| Player | `{{playerName}}`, 18–19, adult, exclusively player-controlled | `{{playerName}}`, 18–19, adult, exclusively player-controlled |
| Characters | Aanya (18–19), Shanti Didi | Aarohi Malhotra (20), Vinayak Malhotra, Sarita Malhotra, Karan Mehta (22), Vikram (20) |
| Age rating | 18+ (mature) | 18+ (mature) |
| Tags | `ongoing`, `slow-burn`, `slice-of-life`, … | `ongoing`, `married-life`, `trust`, … |
| `contentVersion` | 34 → **35** (both stories added in one OTA content release) | same release |
| App version | **unchanged: v2.5.1** | **unchanged: v2.5.1** |

The established leading manifest entry (`arranged-marriage-wala-love`) stays
first, so the existing deploy verifier and API smoke test keep selecting the
same story; the two new entries sit immediately after it.

## Story 1 — Tumhe Kabhi Pata Hi Nahi Chala

- **Canon (enforced in content + tests):** `{{playerName}}` and Aanya are
  unrelated childhood friends who grew up together in the same orphanage
  (Aashray Bal Griha) after losing their families. They are **NOT** siblings,
  **NOT** step-siblings, **NOT** cousins, **NOT** blood relatives and **NOT**
  family; the only bond is their shared childhood and friendship. Sibling,
  `bhai/behen` or family framing is explicitly forbidden in-world, in characters,
  in the story's safety notes, in `memory.neverRemember` and validated by the
  acceptance suite (every sibling-related sentence must be a negation or a rule).
- **Slow burn:** Aanya's romantic feelings already exist but are unspoken;
  `{{playerName}}` still sees his oldest friend, and the opening (rain, two
  cutting chai, a sentence she starts and abandons) gives the player an open
  decision with no verdict. Behaviour-only cues (attention, tiny remembered
  details, light jealousy, teasing, sudden quiet, half-finished sentences) are
  mandated by the world rules.
- **Endless:** one opening scene, no scenes/endings graph, no arcs, chapters,
  phases or stages, no predetermined confession or ending; the story continues
  after any romantic development.
- **Memory:** the childhood memory bank (peeling blue gate, gulmohar tree,
  monsoon paper boats, the repaired wristwatch, the lantern night, the
  half-serious promise on the chhat) plus promises, jealousies and silences are
  carried by the existing universal memory architecture
  (`seedMemories`, `extractionHints`, `neverRemember`) with scene-change
  persistence and strict story isolation.

## Story 2 — Jo Usne Bataya Nahi

- **Premise:** `{{playerName}}` (18–19, orphan, ordinary background) is already
  married to Aarohi Malhotra (20) of an extremely wealthy Delhi family. This is
  **not** a poor-husband-versus-rich-family story: Vinayak and Sarita Malhotra
  genuinely love and accept him as a son, and the rules forbid contempt,
  humiliation, inheritance conspiracies and evil-rich-family tropes.
- **Aarohi** genuinely loves `{{playerName}}` and he is the most important
  person in her life; she is not an automatic villain, and neither her
  explanation nor the marriage's outcome is predetermined.
- **The other boy:** for ~10 months Aarohi chatted with Karan Mehta (22) from an
  online classic-cinema community. They had **never met in person** before
  today's **first** meeting: an afternoon movie, a shopping trip while he chose
  a birthday gift for his mother, and coffee.
- **Canon lock:** they did **not** hold hands, did not touch and there was no
  kiss, romance or physical intimacy of any kind. The lock sits in
  `world.lore`, `world.rules`, every relevant `characters[].knowledge`,
  `memory.seedMemories` and `memory.neverRemember`, and the acceptance suite
  rejects any field in the package that mentions intimacy without a negation.
- **Discovery:** `{{playerName}}` learns about the meeting the **same day** —
  he was in the mall collecting Aarohi's repaired watch and later receives
  Vikram's photograph. The discovery proves a meeting, not intimacy, and it is
  stated that way inside the opening narration itself.
- **Player agency:** the player decides everything next — ask calmly, confront,
  examine the chats, investigate further, stay silent, ask about the other boy
  or ask why she hid it. No forced reconciliation, separation, divorce, crime,
  blackmail or melodrama.
- **Memory:** the marriage, the chats, the exact limits of the meeting, the
  discovery, Aarohi's explanations, `{{playerName}}`'s reactions and the
  family's responses are all persistent across scene changes.

## Media

Character reference images were **not** available for either story, so the
canonical visual identities were created for this publication and stored as
`assets/references/<id>.jpg` inside each package (the existing canonical-
reference convention, allowlisted by the Worker as
`assets/references/[a-z0-9-]{0,63}\.jpg`):

| Story | Player | Lead | Supporting |
|---|---|---|---|
| 1 | `assets/references/mc.jpg` | `assets/references/aanya.jpg` | `assets/references/childhood-photo.jpg` (childhood snapshot) |
| 2 | `assets/references/mc.jpg` | `assets/references/aarohi.jpg` | `assets/references/karan.jpg` |

Every portrait carries a `canonical: true` identity lock (face shape, eyes,
brows, nose, lips, jawline, skin tone, hair identity, apparent age) that is
reproduced in the character's `background`, and both player identities are
explicitly 18–19 and never aged up. The two stories use **different** young men,
so the packs remain visually distinct from each other and from existing Kissa
stories.

Registered Media Library entries (`media.gallery`, schema maximum 8 including
the cover) reference only in-package, allowlisted paths; every registered file
exists on disk, is a JPEG and keeps its native generated aspect ratio (the
pipeline never resizes or crops). Further scene artwork is appended through
this same content pipeline — it needs no app update.

## Checks before publication

- `npm run content:validate` — content suite green (manifest + every story
  package).
- App typecheck + full jest suite green, including the two new acceptance
  suites (`__tests__/tumheKabhiPataHiNahiChala.test.ts`,
  `__tests__/joUsneBatayaNahi.test.ts`) and the OTA/memory suites that prove
  `{{playerName}}` interpolation, catalog visibility, scene-change persistence
  and story isolation.
- Worker typecheck + tests green, including
  `worker/__tests__/ota-catalog.test.ts`, which feeds the **real repository
  content** through the real Worker handler and asserts the exact URLs an
  installed app fetches (`/api/manifest`, package, five JSON files, cover,
  every gallery image, every canonical reference) plus the allowlist denials.
- `scripts/build-worker-assets.mjs` assembles the deploy bundle with 43
  stories.
- **No APK was built and no app version changed** (package.json /
  app.json stay at 2.5.1). The Android workflow has a narrowly scoped
  `paths-ignore` for this content publication, its acceptance suites and this
  document; tags and manual dispatch still build.

## Release workflow

Commit and push only the Arena working branch, open a PR to `main` and merge.
`main` then runs the existing *Deploy story API* workflow: content validation →
worker tests → bundle build → `wrangler deploy` → published-story integrity
verification (byte-identical JSON + images on both production hostnames) →
the full API smoke test. Production verification results are reported in the
task completion message rather than claimed in advance here.

Discovery and playback are verified through the unchanged remote catalog
architecture (the installed app fetches the manifest from
`https://beyondredeye.site/api/manifest`, sees the two new entries and streams
their packages at play time). A physical already-installed device is not
available in this workspace; API/architecture compatibility must not be
presented as a device-observed test.
