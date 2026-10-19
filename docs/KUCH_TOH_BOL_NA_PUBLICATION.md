# Kuch Toh Bol Na — publication notes

Content-only OTA story (no APK / app update). Story id: `kuch-toh-bol-na`.

## Story

A flirty, funny, slow-burn, open-ended Hinglish college romance set in Pune in late October.
`{{playerName}}` (19–20) starts as the quietest boy in his second-year class at the fictional
Sahyadri College of Engineering — an introvert who barely says "present". On a Monday morning
Mahi Khurana (20), a cheeky, very beautiful transfer student from Delhi, walks in late, sits
beside him on the last bench, steals his earbud, gets paired with him for a documentary that must
be narrated in his own voice, and leaves a note in his notebook: she lives in the flat whose
balcony faces his. "Kuch toh bol na. — M."

- **Cast:** Mahi Khurana (lead), Shakuntala Bhatia (her Nani), Sameer Oberoi (class "cool guy",
  rival), Ira Deshpande (Mahi's dry Puneri friend), Medha Kulkarni (the professor).
- **Introvert agency:** whatever the player writes is exactly what he says or does — silence, a
  nod, a note or a text are honoured and matter as much as words. The opening's four choices
  include non-verbal answers.
- **Hidden truths** (narrator-only, surface through play): the dare Mahi accepted from Sameer's
  group before she knew him, and her parents' separation in Delhi.
- **Format:** one opening scene (`last_bench_wali_ladki`), four open choices, no endings, tagged
  `dynamic-continuous` / `ongoing`.

## Artwork

At the user's request this story shows the player too. Both reference portraits — Mahi and the
hero — were approved by the user before any other image was generated. The hero has one fixed
look recorded in `characters.json → playerVisualDesign`; the images never decide his words,
feelings or actions.

```
content/stories/kuch-toh-bol-na/
  story.json characters.json world.json scenes.json memory.json
  assets/cover.jpg                      both of them (campus steps, stolen earbud)
  assets/gallery/image-01.jpg           scene — sharing earbuds on the last bench
  assets/gallery/image-02.jpg           other — the hero (his approved reference)
  assets/gallery/image-03.jpg           Mahi — café smirk (her approved reference)
  assets/gallery/image-04.jpg           scene — one umbrella in the Pune rain
  assets/gallery/image-05.jpg           Mahi — waving across the balcony
  assets/gallery/image-06.jpg           scene — scooty ride on the hill road
  assets/gallery/image-07.jpg           Mahi — dandiya night wink (her favourite photo)
```

All are photorealistic, fully clothed, native 1376×768 JPEGs (the two references were
centre-cropped from 1672×941).

## Catalog

- Manifest entry inserted at index 1 (index 0 stays `arranged-marriage-wala-love` for the
  deploy smoke test); `contentVersion` 44 → 45. Accent colour `#5B8DEF` (denim blue).
- Existing stories are untouched.

## Checks

- `npm run content:validate`
- `npx jest __tests__/kuchTohBolNa.test.ts`
- `node scripts/verify-published-story.mjs --local-only kuch-toh-bol-na`
- Worker: `worker/__tests__/ota-catalog.test.ts` serves the real package (`NEW_STORY_IDS`).
- Deploy: `.github/workflows/deploy-api.yml` validates before deploy and verifies the published
  JSON and media byte-for-byte on both hostnames after deploy.

## Release

Merge to `main` → "Deploy story API" workflow → Cloudflare Worker. Installed apps pick the
story up on their next catalog refresh; no app update required.
