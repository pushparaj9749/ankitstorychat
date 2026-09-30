# Two Hearts, One Honest Choice — remote publication

- Story ID: `two-hearts-one-honest-choice`
- Catalog contentVersion: 29; minimum app version remains 1.0.0.
- Player: `{{playerName}}`, adult, exclusively player-controlled. The existing schema represents the player in `userRole`, not as an NPC with a placeholder name.
- NPCs: Aira (26) and Elena (28), adult Indian women who love only the player. Canon forbids prior/other romantic interests, cheating, replacement partners, villainization and ranking.
- Existing five-file package, one opening conversation seed, no terminal effects or predefined future route graph. Choices store factual flags and memories, not affection scores.
- The Play Guide is in the remotely delivered description and narrator tone; no new UI field or screen is introduced.
- Existing narrator receives world rules; existing memory receives extraction hints for promises, boundaries, who knows what, decisions and emotional continuity.
- Dynamic endless continuation requires the existing AI mode. The existing offline engine remains a scripted fallback, not generative; it is not redesigned here.

## Media

Exactly eight generated JPEGs: one cover and seven scene images. The existing `media.gallery` includes the cover, so it contains eight entries, not seven. All references are in-package and unique. Gallery moments are illustrative possibilities, not established player actions or future outcomes.

The cover was used as the identity reference for every generated gallery image. Visual review checked adult Indian appearance, distinct faces, modest outfits, sympathetic portrayal and absence of a chosen winner. Source images were not cropped, resized or re-encoded: cover and images 01, 02, 04–07 are 848×1264; image 03 is 1408×768. Existing natural-image rendering handles their native ratios.

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
