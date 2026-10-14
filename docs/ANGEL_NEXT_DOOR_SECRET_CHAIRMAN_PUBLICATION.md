# Remote story publication — The Angel Next Door Spoils Me Rotten (secret chairperson)

A **content-only** story addition delivered entirely through Kissa's existing
remote pipeline. No app change, no Android build, no APK release: the installed
app discovers and opens the story because the catalog (`content/manifest.json`
→ `contentVersion`) and the package are streamed from
`https://beyondredeye.site/api`, exactly like every previous OTA story.

```
story creation → existing schema → validation → private story source (this repo)
             → existing GitHub Actions pipeline → existing Cloudflare Worker/API
             → existing manifest/catalog → production deploy
             → installed app fetches the story remotely
```

Nothing new was introduced: no second pipeline, no second backend, no new
endpoint, no hard-coded story list and no app-side change.

This is a **new catalog entry**. Its title is intentionally the same as the
earlier neighbour-romance story `the-angel-next-door-spoils-me-rotten`; the two
are separate stories with separate ids, directories, casts and media, and the
earlier story's manifest entry, package and images are untouched.

## Catalog

| | Value |
|---|---|
| `id` / `storyDir` | `angel-next-door-secret-chairman` |
| Title | **The Angel Next Door Spoils Me Rotten** |
| Genres | Romance · Slow Burn · Office Drama · Secret Identity · Slice of Life · Interactive Romance |
| Player | `{{playerName}}`, adult man aged 18–20, exclusively player-controlled; a brand-new junior associate |
| Female lead | **Anahita Vardhan** (23) — Chairperson and owner of Vardhan Group, and his text-only online girlfriend |
| Supporting cast | Nitin Bhalla (his manager), Tanmay Joshi (batchmate), Meera Kulkarni (Chief of Staff) |
| Age rating | 18+ (mature) |
| Tags | `romance`, `slow-burn`, `office-drama`, `office-romance`, `secret-identity`, `slice-of-life`, `interactive-romance`, `online-relationship`, `dramatic-irony`, `player-agency`, `dynamic-continuous`, `ongoing`, `hinglish` |
| Catalog `contentVersion` | 38 → **39** |
| Media | 1 cover + 7 gallery images (the app's per-story maximum), native JPEG: seven at 1408×768, one at 1376×768 |

The leading manifest entry (`arranged-marriage-wala-love`) stays first, so the
existing deploy verifier and API smoke test keep selecting the same story. The
new entry sits immediately after it at index 1. No other entry, package or
media file was modified.

## Story design

- **Premise:** `{{playerName}}` has spent about nine months in a text-only
  relationship with Anahita, who met him in a 2 AM chai-vs-coffee argument on
  the (fictional) Kalam writing app. She sends him selfies and replies to every
  message instantly. She has never seen his face, any photo of him, or heard his
  voice. He recognises her the moment she walks onto his floor.
- **Opening (as specified):** his third day at the company; her good-morning
  selfie text and a lunch-photo request; the manager's inspection announcement
  and a tense clean-up; the Chairperson arriving with her Chief of Staff and
  assistants; his instant recognition (her eyes, the beauty mark, the moon
  pendant). She walks past him without a glance, asks for the inspection
  report, catches a 91-vs-88 retention mismatch, walks the department and
  questions the new joiners professionally. The opening stops on the player's
  decision: answer, stay silent, secretly text her, or whisper to Tanmay.
  Nothing is confessed or revealed, and no photo is exchanged.
- **Two real personas:** online she is extremely affectionate, cute, playful,
  caring and attentive. She uses pet names, sends her own selfies, remembers
  every chat, promise and joke, and agrees to reasonable requests. In public
  she is a confident, commanding, disciplined and genuinely professional
  chairperson. Neither persona is an act, and she never brings her chat
  softness into the office.
- **She does not recognise him:** at work there is no staring, attraction,
  curiosity, suspicion or special attention. She treats him strictly by his
  role.
- **Two worlds, one timeline:** the office world (real hierarchy, believable
  work consequences only, no favouritism or punishment caused by the secret)
  and the private chat world run on one chronology. Transitions are believable
  and time and place are always explicit.
- **Instant, text-only replies:** she always replies immediately, with no
  delays and no busy excuses. There are no calls, voice notes or video. She
  never sees him unless the player chooses it.
- **Knowledge separation:** she knows only what he tells her, what she
  personally witnesses, and what reaches her through a believable channel. She
  never magically knows his company, desk or schedule. Colleagues know only the
  office world.
- **Slow burn, open-ended:** no chapters, acts, arcs, phases or stages, no fixed
  reveal date and no ending. The truth can surface through several believable
  routes:
  - he tells her;
  - an office detail she witnessed;
  - his phone buzzing in front of her;
  - a photo showing a VG cafeteria tray or his ID lanyard;
  - his voice;
  - gossip;
  - an HR record.

  One weak coincidence is never enough. Her reaction to a reveal depends on
  feelings, circumstances, trust and her own concealment. She does not
  automatically forgive, and her chairperson identity does not collapse.
- **Memory:** Kissa's existing universal memory only. Seeded knowledge keeps her
  private-chat knowledge separate from the office cast's. A believable
  discovery invalidates her stale "no idea he works here" knowledge through the
  existing revelation handling (covered by the acceptance suite). No
  story-specific memory mechanism was added.

## Artwork

A written visual identity for Anahita was locked **before** any image was
generated. It lives in `characters.json` → `background` and in the seed
memories, so the narrator keeps it stable:
- a youthful, cute, expressive heart-shaped face;
- light hazel-amber eyes with golden flecks;
- a small beauty mark just below the outer corner of her left eye;
- a right-cheek dimple;
- long espresso-brown waves with a deep left part;
- a naturally curvy figure with a defined slim waist and realistic
  proportions;
- pearl studs and a tiny gold crescent-moon pendant.

A single canonical identity portrait was then used as the reference input for
every generation. That portrait is a working file only and is not shipped in
the package.

Every image is photorealistic, cinematic live-action photography. Anime, manga,
cartoon and illustration looks are prohibited. Every file ships at the exact
native size its generator produced and was **not cropped or resized**:
- seven files at **1408×768**;
- the Diwali full-length at **1376×768** (that model's native landscape
  canvas).

The app renders each image at its own source aspect ratio. Every gallery image
shows **Anahita alone**: no `{{playerName}}`, no other people, no reflections
of people, and no text on the cover.

| Slot | File | Shot |
|---|---|---|
| Cover | `assets/cover.jpg` | Chairperson in a navy suit, penthouse office at dusk over the city and sea |
| 1 | `assets/gallery/image-01.jpg` | Cute good-morning selfie: oversized cream hoodie, peace sign, chai. This is the selfie the opening describes. |
| 2 | `assets/gallery/image-02.jpg` | Casual home look: sage lounge set, laughing with chai on the sofa |
| 3 | `assets/gallery/image-03.jpg` | Playful teasing pose from a new angle: perched on the kitchen counter with strawberry ice cream, a cheeky wink |
| 4 | `assets/gallery/image-04.jpg` | Elegant full-length portrait: maroon silk saree on a diya-lit terrace on Diwali evening, sea and city behind |
| 5 | `assets/gallery/image-05.jpg` | Chairman look in her luxury office: the charcoal suit from the inspection, perched on her black marble desk |
| 6 | `assets/gallery/image-06.jpg` | Executive portrait, different pose and outfit: striding down a sunlit top-floor corridor in a camel coat |
| 7 | `assets/gallery/image-07.jpg` | Her personal favourite photo for him: night window seat, chai, the crescent moon over the sea |

The installed app accepts at most eight media entries per story (cover
included); a ninth makes every device reject the package. To give the gallery
six newly generated shots, four stronger images were swapped in for four
earlier candidates instead of being added on top. The replaced candidates are
archived outside the package and are never deployed.

## Verifier: native size for this story

`scripts/verify-published-story.mjs` hard-codes 1376×768 for every
`dynamic-continuous` story it is asked to verify. The script now takes an
opt-in flag, `--native-size=WIDTHxHEIGHT[,WIDTHxHEIGHT...]`; with it, every
media file must be exactly one of the listed sizes.

Every existing invocation passes no flag and keeps exactly the previous
single-size check. The default still rejects a 1408-wide image, and a
single-size flag still rejects the 1376-wide file.

This story's steps pass `--native-size=1408x768,1376x768`, so it gets the same
strict checks at its own native sizes:
- exactly one cover plus seven gallery JPEGs;
- unique files;
- native dimensions;
- byte-identical deployment.

The acceptance suite is stricter still: it pins the exact native size of each
individual file.

## Checks before publication

- `npm run content:validate` — schema validation of the manifest and all 56
  packages.
- Full app test suite and typecheck, including the new acceptance suite
  `__tests__/angelNextDoorSecretChairman.test.ts`. It checks:
  - catalog registration alongside the same-title story;
  - the mandated opening beats;
  - player agency;
  - two-persona and two-world rules;
  - instant text-only replies;
  - knowledge separation and the discovery routes;
  - endlessness and originality;
  - media integrity at native size, with every gallery image a solo portrait
    of her;
  - remote-only delivery;
  - narrator prompt wiring;
  - universal-memory seeding, persistence, isolation and discovery-driven
    knowledge updates.
- Worker typecheck and tests, including `worker/__tests__/ota-catalog.test.ts`,
  which now also serves **this** story's real package and media through the real
  Worker handler.
- `scripts/verify-published-story.mjs --local-only
  --native-size=1408x768,1376x768 angel-next-door-secret-chairman`.
- **No APK build:** the Android workflow's existing `paths-ignore` list covers
  `content/**`, `docs/**`, the verifier and both workflow files. This
  publication adds only its acceptance suite to that list, so the content-only
  release does not rebuild or release the app.

## Release flow

Commit and push only the Arena working branch, open a PR to `main` and merge.
`main` then runs the existing *Deploy story API* workflow:
1. content validation;
2. local media validation, including this story;
3. worker tests;
4. bundle build;
5. `wrangler deploy`;
6. published-story integrity verification (byte-identical JSON and all eight
   images on both production hostnames, now including this story);
7. the full API smoke test.

The on-demand *Verify story on production API* workflow then confirms the
manifest entry, the package and every media URL.

## Production verification

_Pending._ This section is replaced with the actual CI results (workflow runs
and per-check outcomes) after the merge to `main` has deployed the story. No
result is recorded here before it has actually been observed.
