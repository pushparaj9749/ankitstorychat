# Uski Mohabbat Se Bachna Namumkin Tha — remote publication

- Story ID: `uski-mohabbat-se-bachna-namumkin-tha`
- Catalog contentVersion: 35 → 36; minimum app version remains 1.0.0. No app/APK
  update, no new app version — existing installs discover the story through the
  unchanged remote manifest.
- Player: `{{playerName}}`, an adult Indian man aged 18–20, exclusively
  player-controlled. Youthful, handsome, natural-looking; the package forbids
  depicting him as middle-aged, older or uncle-like. The existing schema
  represents the player in `userRole`, not as an NPC with a placeholder name.
- NPCs: Aarohi (19) — the player's established girlfriend, cute and deeply
  loving in public while secretly leading a vast hidden organization (narrator
  truth, unknown to the player at the start, never confessed immediately);
  Riya Sharma (19) — an ordinary friendly classmate whose friendliness
  unknowingly triggers Aarohi's jealousy; Vikram Rathore (mid-40s) — a composed
  older associate whose deference toward Aarohi is a clue, not an explanation.
- Canon: the couple are already boyfriend and girlfriend; Aarohi genuinely loves
  the player and is never a cartoon villain; her obsession destroys her sense of
  healthy boundaries, which the story examines without glorifying. A disturbing
  pattern (girls close to the player mysteriously fading from his life) may
  emerge only through played events, handled individually and non-graphically.
- Existing five-file package, one opening scene (a normal lakeside-cafe evening
  ending on Aarohi asking the player to stay — no reveal of the secret), three
  open choices with factual flags/memories only, no terminal effects and no
  predefined route, confession or ending. Continuous and endless: no arcs, acts,
  chapters, phases or stages.
- Existing narrator receives world rules (player agency, confirmed-vs-suspicion
  discipline, who-knows-what, non-graphic suspense, no harm instructions);
  existing universal memory receives seed memories plus extraction hints for
  affection, obsession behaviours, clues, the pattern, promises, confrontations
  and decisions — all isolated to this storyId.
- Dynamic endless continuation requires the existing AI mode. The existing
  offline engine remains a scripted fallback, not generative; it is not
  redesigned here.

## Media

Exactly eight generated JPEGs: one cover and seven gallery scene images. The
existing `media.gallery` includes the cover, so it contains eight entries. All
references are in-package and unique; no `assets/references/` folder exists, so
the package carries exactly eight images. Gallery moments are illustrative
possibilities, not established player actions or future outcomes.

- Cover (canonical identity anchor for every image): Aarohi and the player
  together at the lakeside cafe at dusk — romantic surface, subtle possessive
  undertone, no violence.
- Gallery: 01 normal couple moment; 02 Aarohi's subtle jealousy as the player
  talks to Riya; 03 Aarohi's mysterious call in a luxurious private study;
  04 wholesome fully-clothed daytime bed conversation; 05 wholesome
  fully-clothed nighttime rest; 06 Aarohi composed and powerful among her
  associates (player absent, nothing graphic); 07 the player discovering a
  non-graphic clue while Aarohi watches from a doorway.
- Style: realistic cinematic Indian live-action aesthetic, natural skin texture,
  no anime, no cartoon. Aarohi (long straight black hair, middle parting, gold
  jhumkas, pink kurta) and the youthful clean-shaven player (short black
  side-swept hair, navy shirt) keep the same faces, hair, age and identity in
  all eight frames; Riya and Vikram are visually distinct.
- All eight shipped at their native generated size (768×1376), un-resized and
  un-re-encoded — no forced 16:9 / 4:3 / 3:4 / 1:1. Rendered through the
  existing NaturalImage/media system.

SHA-256 (repository bytes; the post-deploy gate compares these remotely):

- cover.jpg: `62e8e8c76ac12688484ba1e73286dc0b2bcea3d501b1bf2b8f9791dd289f7a77`
- image-01.jpg: `088dacd638333adbc2513d80ed51cee5eb9df4a5e583a04353e69cc926da57a4`
- image-02.jpg: `9e7e4bc2ce8b2939dfddd54229c435ef2c6b66220a34e9cf0293506342612486`
- image-03.jpg: `2cc84bee4134b6244bcfe383b4e3ea1d55d092b85feedb7e133c1dea01543009`
- image-04.jpg: `b749c3792fa021eb16f555163bed4464fbf34f73352032f90e11edbf85493e27`
- image-05.jpg: `eeee6f736d05d630407f06b34f20ac2f6b3f46d189882ecb2b952cca2ee2ed15`
- image-06.jpg: `19b176eefaa5e28c9b1b59b9cb2a19a71f02db4b3da932486b800d0d25a39f4a`
- image-07.jpg: `e27e75b4bb2b070785923958da0cb120b8ee96afd6727bbb40fdb9f7488fecc5`

## Checks before publication

- Content validation (`content.test.ts`): 50 tests passed (44 stories validate).
- New story acceptance suite (`uskiMohabbatSeBachna.test.ts`): 13 tests passed —
  catalog registration, dynamic player name, Aarohi/Riya/Vikram roles,
  normal-first opening with no reveal, endless continuity, non-graphic and
  wholesome guardrails, exactly-8 media assets, memory guidance, storyId
  isolation, narrator prompt wiring, and universal-memory write/recall across a
  scene change with cross-story isolation.
- App TypeScript: passed; app tests: 33 suites, 445 tests passed.
- Worker TypeScript: passed; Worker tests: 4 suites, 66 tests passed.
- Worker assets build: passed — 44 stories assembled, new package contains all
  five JSON files plus the cover and seven gallery images; manifest carries the
  new entry at contentVersion 36.
- No app/runtime/UI/version modifications and no APK command. The Android
  workflow has a narrowly scoped exclusion for this content publication and its
  acceptance test, retaining builds for app changes, tags and manual dispatch.

## Release workflow

Commit and push only the Arena working branch, open a PR to main and merge via
GitHub. Main then runs the existing Deploy story API workflow. Verify
`/api/health`, `/api/manifest` (contentVersion 36, new entry present), the whole
package, each JSON file, and all eight media URLs against the repository bytes
above on both production hostnames. Production verification and merge/deploy
identifiers are reported in the task completion message rather than claiming an
unperformed release in this document.

Discovery is verified through the unchanged remote catalog architecture and
existing OTA tests. A physical already-installed device is not available in this
workspace; do not confuse API compatibility verification with a
device-observed test.
