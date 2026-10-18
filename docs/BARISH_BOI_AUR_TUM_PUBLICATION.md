# Barish, Boi Aur Tum — publication notes

Content-only OTA story (no APK / app update). Story id: `barish-boi-aur-tum`.

## Story

A slow-burn, open-ended Hinglish romance set in present-day Kolkata during the monsoon
weeks before Durga Puja. On his first night in the city, `{{playerName}}` (18–20) arrives
at Mitra Boi Ghar — a 70-year-old College Street bookshop — during a flood and power cut.
Ishani Mitra (20), who runs the shop, mistakes him for a developer's agent; then a hidden
tin box of unsent 1971 love letters ("Mili ke liye — S.") falls out of a soaked crate.

- **Cast:** Ishani Mitra (lead), Haren Mitra (Dadu, keeper of the letters' secret),
  Subrata Mitra (Kakai, wants to sell on Bijoya Dashami), Rimjhim Dutta (best friend),
  Bablu Das (tea stall).
- **Threads:** the romance (earned slowly), saving the shop before the Dashami deadline,
  and the 1971 letters mystery. The hidden truth lives in narrator-only lore and must
  surface only through play.
- **Format:** one opening scene (`pehli_barish`), four open choices, no endings, tagged
  `dynamic-continuous` / `ongoing`.

## Package

```
content/stories/barish-boi-aur-tum/
  story.json characters.json world.json scenes.json memory.json
  assets/cover.jpg
  assets/gallery/image-01.jpg … image-07.jpg
```

All eight images are photorealistic solo images of Ishani (the player never appears), native
1376×768 JPEGs generated from one canonical reference portrait so her face stays consistent.

## Catalog

- Manifest entry inserted at index 1 (index 0 stays `arranged-marriage-wala-love` for the
  deploy smoke test); `contentVersion` 39 → 40.

## Checks

- `npm run content:validate`
- `npx jest __tests__/barishBoiAurTum.test.ts`
- `node scripts/verify-published-story.mjs --local-only barish-boi-aur-tum`
- Worker: `worker/__tests__/ota-catalog.test.ts` serves the real package (`NEW_STORY_IDS`).
- Deploy: `.github/workflows/deploy-api.yml` validates locally before deploy and verifies the
  published JSON and media byte-for-byte on both hostnames after deploy.

## Release

Merge to `main` → "Deploy story API" workflow → Cloudflare Worker. Installed apps pick the
story up on their next catalog refresh; no app update required.
