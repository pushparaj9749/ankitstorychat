# Superstar Ki Chhutti — publication notes

Content-only OTA story (no APK / app update). Story id: `superstar-ki-chhutti`.

## Story

A glamorous, funny, slow-burn, open-ended Hinglish romance set in Cabo Sereno, a fictional fishing
village in South Goa, in late October. `{{playerName}}` (18–20) is working the off-season at Kokum
Shack when Naina Sehgal (20) — the year's biggest new (fictional) superstar, missing from Mumbai for
two days — runs in wearing a hoodie, cap and sunglasses and hides behind his counter from
paparazzi. Her cap falls off; her own film poster is on the shack wall. Her manager has called 47
times and her next film's mahurat is on 1 November. She begs for ten days as "Nikki".

- **Cast:** Naina Sehgal (lead), Rosy D'Souza (shack owner who doesn't recognise her), Joel Pinto
  (waiter and her biggest fan), Agostinho Fernandes (the village baker), Vicky Arora (her manager).
- **Threads:** the romance (earned slowly), the secret-identity comedy, the 1 November decision,
  and the secret reason she chose this village — her late mother's letters to "Gus". Hidden truths
  (Agostinho is her father; Vicky leaked her location and took an advance in her name) live in
  narrator-only lore and surface only through play.
- **Format:** one opening scene (`disguise_fail`), four open choices, no endings, tagged
  `dynamic-continuous` / `ongoing`.

## Package

```
content/stories/superstar-ki-chhutti/
  story.json characters.json world.json scenes.json memory.json
  assets/cover.jpg
  assets/gallery/image-01.jpg … image-07.jpg
```

All eight images are photorealistic, fully clothed solo images of Naina (the player never
appears), native 1376×768 JPEGs generated from one canonical reference portrait the user chose,
so her face stays consistent. Stray lettering on two fishing boats was removed (cover repainted,
image 06 softened) and image 03 was resized to the native size.

## Catalog

- Manifest entry inserted at index 1 (index 0 stays `arranged-marriage-wala-love` for the
  deploy smoke test); `contentVersion` 43 → 44. Accent colour `#1FA5A0` (Goa sea teal).
- Existing stories, including `pehli-barf`, are untouched.

## Checks

- `npm run content:validate`
- `npx jest __tests__/superstarKiChhutti.test.ts`
- `node scripts/verify-published-story.mjs --local-only superstar-ki-chhutti`
- Worker: `worker/__tests__/ota-catalog.test.ts` serves the real package (`NEW_STORY_IDS`).
- Deploy: `.github/workflows/deploy-api.yml` validates before deploy and verifies the published
  JSON and media byte-for-byte on both hostnames after deploy.

## Release

Merge to `main` → "Deploy story API" workflow → Cloudflare Worker. Installed apps pick the
story up on their next catalog refresh; no app update required.
