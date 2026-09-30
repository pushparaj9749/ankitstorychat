# Two Hearts, One Honest Choice — remote publication

- Story ID: `two-hearts-one-honest-choice`
^- Catalog contentVersion: 30 (artwork regeneration); minimum app version remains 1.0.0.
- Player: `{{playerName}}`, adult, exclusively player-controlled. The existing schema represents the player in `userRole`, not as an NPC with a placeholder name.
- NPCs: Aira (26) and Elena (28), adult Indian women who love only the player. Canon forbids prior/other romantic interests, cheating, replacement partners, villainization and ranking.
- Existing five-file package, one opening conversation seed, no terminal effects or predefined future route graph. Choices store factual flags and memories, not affection scores.
- The Play Guide is in the remotely delivered description and narrator tone; no new UI field or screen is introduced.
- Existing narrator receives world rules; existing memory receives extraction hints for promises, boundaries, who knows what, decisions and emotional continuity.
- Dynamic endless continuation requires the existing AI mode. The existing offline engine remains a scripted fallback, not generative; it is not redesigned here.

## Media

Exactly eight generated JPEGs: one cover and seven scene images. The existing `media.gallery` includes the cover, so it contains eight entries, not seven. All references are in-package and unique. Gallery moments are illustrative possibilities, not established player actions or future outcomes.

### Regenerated premium artwork (v2, contentVersion 30, story version 2)

The first artwork set was fully replaced with a new premium photorealistic live-action Indian romance-movie set — the previous images are no longer registered anywhere: the same eight allowlisted paths (`assets/cover.jpg`, `assets/gallery/image-01..07.jpg`) now carry entirely new bytes, and the `media` block was not edited, so there is no second story, no duplicate registration and no orphan asset.

- All eight images regenerated from scratch as new compositions (no minor edits of the old frames), each 848×1264 (2:3), shipped un-resized and un-re-encoded.
- The new cover is the identity anchor: face-reference crops cut from it steered every gallery image, keeping Aira (26 — peach chikankari kurti, wavy half-up hair, gold jhumkas), Elena (28 — sage silk kurti, ivory dupatta, low bun) and the male lead (28 — trimmed beard, olive overshirt over charcoal henley) visually consistent across all eight frames.
- Style bar: realistic Indian facial features, expressive eyes, natural skin texture and asymmetry, believable adult proportions, elegant modern Indian styling, high-end cinematic photography and lighting. Both women are equally attractive and cute; no ranking, no chosen winner in any frame.
- Visual review repeated on the new set: adult Indian appearance, distinct consistent faces, modest outfits, sympathetic portrayal, absence of a chosen winner.
- OTA signals bumped: catalog `contentVersion` 29 → 30 and the story's `version` 1 → 2 (manifest meta + `story.json`). Installed apps stream this story's JSON from the API at play time and resolve every media reference against the same package paths, so the new artwork reaches already-installed Kissa apps with no APK update.

## Checks before publication

- Content validation: 43 tests passed.
- App TypeScript: passed; app tests: 21 suites, 320 tests passed, including new story acceptance checks and existing OTA/memory/media tests.
- Worker TypeScript: passed; Worker tests: 3 suites, 61 tests passed.
- Existing Worker assets build and Wrangler dry-run: passed, all eight files included.
- No app/runtime/UI/version modifications or APK command. Android workflow has a narrowly scoped exclusion for this content publication and its acceptance test/documentation, retaining builds for app changes, tags and manual dispatch.

## Release workflow

Commit and push only the Arena working branch, open a PR to main and merge via GitHub. Main then runs the existing Deploy story API workflow. Verify `/api/health`, `/api/manifest`, the whole package, each JSON file, and all eight media URLs against repository bytes on both production hostnames. Production verification and merge/deploy identifiers are reported in the task completion message rather than claiming an unperformed release in this document.

Discovery is verified through the unchanged remote catalog architecture and existing OTA tests. A physical already-installed device is not available in this workspace; do not confuse API compatibility verification with a device-observed test.

## Deployment readiness follow-up

The initial release uploaded successfully but its immediate smoke check saw transient 404s for the package, story JSON and cover; all seven gallery images already served successfully. A bounded readiness gate now verifies the newest story before the existing smoke checks: both production hosts, manifest equality, all five JSON files, package equality, and SHA-256 equality for every image. It requires two consecutive passes, retries at ten-second intervals, and fails on persistent errors. No app or Worker runtime behavior changes.
