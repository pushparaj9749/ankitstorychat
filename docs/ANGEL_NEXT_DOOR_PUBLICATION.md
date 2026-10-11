# Remote story publication — The Angel Next Door Spoils Me Rotten

A **content-only** story addition delivered entirely through Kissa's existing
remote pipeline. No app change, no Android build, no APK, no version change: the
installed app discovers and opens the story because the catalog
(`content/manifest.json` → `contentVersion`) and the package are streamed from
`https://beyondredeye.site/api`, exactly like every previous OTA story.

```
story creation → existing schema → validation → private story source (this repo)
             → existing GitHub Actions pipeline → existing Cloudflare Worker/API
             → existing manifest/catalog → production deploy
             → installed app fetches the story remotely
```

Nothing new was introduced: no second pipeline, no second backend, no second
story delivery mechanism, no hard-coded story list and no app-side change.

## Catalog

| | Value |
|---|---|
| `id` / `storyDir` | `the-angel-next-door-spoils-me-rotten` |
| Title | **The Angel Next Door Spoils Me Rotten** |
| Genres | Romance · Slice of Life · Slow Burn · Neighbourhood Romance · Daily Life |
| Player | `{{playerName}}`, adult man aged 18–20, exclusively player-controlled |
| Lead | Hina Tachibana (adult woman, 18–20), the neighbour in the flat next door |
| Age rating | 18+ (mature) |
| Tags | `romance`, `slice-of-life`, `slow-burn`, `neighbourhood-romance`, `daily-life`, `cozy-romance`, `player-agency`, `dynamic-continuous`, `ongoing`, `hinglish` |
| `contentVersion` | 37 → **38** |
| Media | 1 cover + 7 gallery images, all native 1376×768 JPEG |
| App version | **unchanged** (no app version was bumped, mentioned or introduced) |

The leading manifest entry (`arranged-marriage-wala-love`) stays first, so the
existing deploy verifier and API smoke test keep selecting the same story; the
new entry sits immediately after it at index 1 and no other entry, package or
media file was touched.

## Story design

- **Opening (as specified):** a rainy evening, `{{playerName}}` alone all day and
  barely fed, a knock on the door, Hina Tachibana outside with a container of
  freshly cooked food, her three specified lines verbatim, the warm cheeks and
  the look away, and the rain continuing outside as they share a quiet dinner.
- **Player agency:** the opening ends on the player's decision (invite her in,
  take the container, ask how she knew, or call out the "I do not care" line).
  The narration never speaks, feels or decides for `{{playerName}}`, and that is
  enforced as a world rule, a safety note, a seed memory and a test.
- **Slow burn:** they begin as neighbours, not as a couple and not as people with
  a shared past. Ishq starts at 0; Hina must not confess love or become
  unconditionally attached after one interaction, and her attachment is shown
  through behaviour (remembered details, extra portions, teasing, going quiet)
  rather than declarations.
- **Public vs private:** her composed, elegant public self and her warm,
  playful, observant private self are both required by the rules and belong to
  the same person.
- **Endless:** one opening scene, no scenes graph, no endings, no arcs, chapters,
  phases or stages, and no artificial conclusion after a fixed number of turns.
- **Continuity:** the rules, seed memories and extraction hints require earlier
  conversations, meals, promises, borrowed objects, teasing, misunderstandings
  and apologies to survive location, day and scene changes, and every fact stays
  isolated to this `storyId`.

## Artwork

A written visual identity for both characters was created **before** any image
was generated and is reused for all eight images (it lives in
`characters.json` → `background` and in the seed memories, so the narrator keeps
it stable too):

- **Hina Tachibana** — very long straight jet-black hair with a satin sheen past
  the mid-back, a slender navy ribbon tied loosely at the nape, a few strands
  loose around the face; fair luminous skin with a warm undertone and visible
  natural texture; dark-brown almond eyes with softly lifted outer corners, long
  lashes, gently arched brows; small refined nose; soft pink lips; delicate oval
  face with a subtly tapered jaw; slender graceful build. Signature wardrobe:
  cream ribbed knit cardigan over a pale-blue blouse, dark trousers, small dark
  shoulder bag, one thin gold chain.
- **`{{playerName}}`** — handsome, youthful adult man aged 18–20: thick tousled
  jet-black hair with a soft middle part and grown-out fringe, warm light-olive
  skin with natural texture and faint stubble, large expressive dark-brown eyes,
  soft-edged jawline, lean build; oversized charcoal-grey fleece hoodie over a
  plain white tee at home.

Every image is realistic, cinematic, live-action photography in a premium
romantic-television-series look (anime, manga, cartoon, illustration and
game-render aesthetics are prohibited by the story's own rules). The cover and
all seven gallery images were generated at the pipeline's native 1376×768 and
were **not cropped or resized** — the app renders every artwork at its source
aspect ratio.

| Slot | File | Moment |
|---|---|---|
| Cover | `assets/cover.jpg` | Doorway in the rain — food container, warm light |
| 1 | `assets/gallery/image-01.jpg` | Hina bringing freshly cooked food to the door |
| 2 | `assets/gallery/image-02.jpg` | The two sharing dinner in the warm kitchen |
| 3 | `assets/gallery/image-03.jpg` | Talking on the balcony during a rainy evening |
| 4 | `assets/gallery/image-04.jpg` | A relaxed everyday moment of playful teasing |
| 5 | `assets/gallery/image-05.jpg` | Walking together through the neighbourhood at dusk |
| 6 | `assets/gallery/image-06.jpg` | Hina noticing he is tired, with gentle concern |
| 7 | `assets/gallery/image-07.jpg` | A wholesome, non-sexualised moment of growing affection |

## Checks run before publication

- `npm run content:validate` — schema validation of the manifest and all 55
  packages.
- Full app test suite + typecheck, including the new acceptance suite
  `__tests__/angelNextDoorSpoilsMeRotten.test.ts` (catalog registration, the
  verbatim opening beats, player agency, slow-burn rules, endlessness, media
  integrity at native size, remote-only delivery through the existing URL
  helpers, narrator prompt wiring and universal-memory persistence/isolation).
- Worker typecheck + tests, including `worker/__tests__/ota-catalog.test.ts`,
  which now also feeds **this** story's real package through the real Worker
  handler and asserts the exact URLs an installed app fetches (manifest entry,
  package, five JSON files, cover, all seven gallery images) plus the allowlist
  denials.
- `scripts/verify-published-story.mjs --local-only
  the-angel-next-door-spoils-me-rotten` — 8 native-size JPEGs confirmed.
- `scripts/build-worker-assets.mjs` — deploy bundle assembles with 55 stories.
- **No APK build and no app version change:** the Android workflow's existing
  `paths-ignore` list covers this publication's content, its acceptance suite
  and this document, so a content-only release does not rebuild the app. Tags
  and manual dispatch still build.

## Release flow

Commit and push only the Arena working branch, open a PR to `main` and merge.
`main` then runs the existing *Deploy story API* workflow: content validation →
worker tests → bundle build → `wrangler deploy` → published-story integrity
verification (byte-identical JSON + images on both production hostnames, now
including this story) → the full API smoke test.

Production verification results are reported in the task completion message
rather than claimed in advance here. A physical already-installed device is not
available in this workspace, so discovery and playback are verified through the
unchanged remote catalog architecture (`/api/manifest` + package URLs) and not
presented as a device-observed test.
