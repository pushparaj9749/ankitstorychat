# Arranged Marriage Wala Love — remote publication

- Story ID / directory: `arranged-marriage-wala-love` (stable).
- Exact listing title: `Arranged Marriage Wala Love`.
- Catalog delivery: `content/manifest.json` → existing GitHub Actions deploy workflow → existing Kissa Cloudflare Worker API. No story or artwork is bundled into the APK.
- Story content is one open, ongoing story seed. `scenes.json` contains exactly one opening context, no endings, and only optional first-reply examples with no scene transitions or relationship effects. The opening ends at Poonam asking `Ji, aap chai lenge?`; it does not generate an MC response.
- {{playerName}} remains a runtime placeholder. Character ages are adults; Poonam does not love the player automatically; marriage is optional, mutual and never terminal.
- Krishnakant and Chachi raised Poonam. Their home is compact, cozy, clean and comfortable, and the family is explicitly well-settled.

## Identity references and artwork

The two supplied reference sources were cropped into three separate story-local identity assets under `assets/references/`. `characters.json` locks the player reference and the distinct Poonam and Bhabhi references to their respective files; the Worker serves those three paths under its story-asset allowlist. The cover and seven gallery images were generated using the corresponding canonical reference(s). Gallery artwork is illustrative, not a record of events. The cover and gallery preserve their generated source dimensions and use mixed portrait/landscape ratios.

## Persistent memory

The story uses the existing Kissa memory pipeline without a story-specific temporary store. Its `memory.json` seeds only opening facts, identifies what to keep, and forbids invented player actions. On-device long-term memories and rolling summaries remain keyed by the playthrough ID; the existing database also persists the playthrough and messages across app restarts. Scene/location changes do not create a new memory namespace or erase prior facts. Reader-wide preferences remain the existing global preference category, not story-event history.

## Verification and deployment

The existing deploy workflow builds `worker/public` from `content/`, runs content validation and Worker tests, deploys the Worker, then compares the production manifest/package/artwork against this checkout. The publication gate also verifies the three referenced identity assets byte-for-byte. The app already fetches remote manifests and story packages at runtime, so a newly published listing can be discovered without an APK update.

The GitHub repository currently reports itself as public; do not change its visibility as part of this additive story publication. The Cloudflare content API is designed to serve catalog content publicly. If the story source must be private, repository visibility and the existing release/Pages setup need a separate owner-approved migration.
