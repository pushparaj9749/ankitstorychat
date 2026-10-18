# 11 Mahine Ka Agreement — publication notes

Content-only OTA story (no APK / app update). Story id: `gyarah-mahine-ka-agreement`.

## Story

A modern, slow-burn, open-ended Hinglish flatmate romcom set in present-day Koramangala,
Bangalore. At 11:47 PM on his first night in the city, `{{playerName}}` (18–20) walks into
Flat 302, Shetty Residency, and finds Tanvi Rao (22), founder of the mental-wellness app
Saans, rehearsing her investor pitch. The flat-sharing broker took both deposits and vanished;
the rent agreement binds them as co-tenants for 11 months with a six-month lock-in.

- **Cast:** Tanvi Rao (lead), Ramesh Shetty (landlord), Ayesha D'Souza (best friend,
  stand-up comic), Kunal Bhatia (ex-cofounder, now at rival ZenGrid), Biscuit (the secret
  balcony dog).
- **Threads:** forced-proximity romance (earned slowly), the fridge rule board, Demo Day in
  three weeks, and the broker scam. The scam's hidden truth lives in narrator-only lore and
  must surface only through play and legal means.
- **Format:** one opening scene (`raat_11_47`), four open choices, no endings, tagged
  `dynamic-continuous` / `ongoing`.

## Package

```
content/stories/gyarah-mahine-ka-agreement/
  story.json characters.json world.json scenes.json memory.json
  assets/cover.jpg
  assets/gallery/image-01.jpg … image-07.jpg
```

All eight images are photorealistic solo images of Tanvi (the player never appears; Biscuit
appears in two), native 1376×768 JPEGs generated from one canonical reference portrait.

## Catalog

- Manifest entry inserted at index 1 (index 0 stays `arranged-marriage-wala-love` for the
  deploy smoke test); `contentVersion` 40 → 41.

## Checks

- `npm run content:validate`
- `npx jest __tests__/gyarahMahineKaAgreement.test.ts`
- `node scripts/verify-published-story.mjs --local-only gyarah-mahine-ka-agreement`
- Worker: `worker/__tests__/ota-catalog.test.ts` serves the real package (`NEW_STORY_IDS`).
- Deploy: `.github/workflows/deploy-api.yml` validates before deploy and verifies the published
  JSON and media byte-for-byte on both hostnames after deploy.

## Release

Merge to `main` → "Deploy story API" workflow → Cloudflare Worker. Installed apps pick the
story up on their next catalog refresh; no app update required.
