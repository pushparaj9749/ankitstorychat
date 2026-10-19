# Pehli Barf — publication notes

Content-only OTA story (no APK / app update). Story id: `pehli-barf`.

## Story

A soft, cosy, slow-burn, open-ended Hinglish romance set in Neelgaon, a fictional Himalayan
hamlet above Manali, in late October. `{{playerName}}` (18–20) arrives at the Negi family's Seb
Bagicha Homestay for a winter stay just as the season's first snow falls three weeks early and
a landslide closes the only road for at least two weeks. Gauri Negi (20) — soft-spoken, shy,
gentle and very beautiful, a secret watercolour painter — opens the door with a lantern while
her puppy Bholu escapes into the snow. That first evening her sketchbook falls and he sees the
secret she has told no one: a scholarship seat at a Delhi art school, to be accepted by
15 November. "Please... Papa ko mat batana."

- **Cast:** Gauri Negi (lead), Prem Singh Negi (her gruff ex-army father), Sunita Negi (her
  chatty mother), Kartik Thakur (the guide everyone assumes she'll marry), Tashi Dolma (Kesar
  Café, Old Manali), Bholu (the puppy).
- **Threads:** the romance (earned slowly), the art-school decision (handled with love and her
  agency), snowed-in homestay life, the wishing tree Dadi ka Seb, and Neelgaon Jatra. Hidden
  truths (Papa is the anonymous buyer of her paintings and has been saving for her fees;
  Kartik's Austria plan) live in narrator-only lore and surface only through play.
- **Format:** one opening scene (`pehli_barf_ki_shaam`), four open choices, no endings, tagged
  `dynamic-continuous` / `ongoing`.

## Package

```
content/stories/pehli-barf/
  story.json characters.json world.json scenes.json memory.json
  assets/cover.jpg
  assets/gallery/image-01.jpg … image-07.jpg
```

All eight images are photorealistic, fully clothed images of Gauri (sometimes with Bholu; the
player never appears), native 1376×768 JPEGs generated from one canonical reference portrait so
her face stays consistent. Image 03 was edited so that full-length woollen pyjamas cover her
legs.

## Catalog

- Manifest entry inserted at index 1 (index 0 stays `arranged-marriage-wala-love` for the
  deploy smoke test); `contentVersion` 42 → 43. Accent colour `#D98CA6` (soft rose).
- `__tests__/meethiDushmani.test.ts` now asserts only that its story follows index 0
  (`findIndex > 0`) instead of pinning index 1.

## Checks

- `npm run content:validate`
- `npx jest __tests__/pehliBarf.test.ts`
- `node scripts/verify-published-story.mjs --local-only pehli-barf`
- Worker: `worker/__tests__/ota-catalog.test.ts` serves the real package (`NEW_STORY_IDS`).
- Deploy: `.github/workflows/deploy-api.yml` validates before deploy and verifies the published
  JSON and media byte-for-byte on both hostnames after deploy.

## Release

Merge to `main` → "Deploy story API" workflow → Cloudflare Worker. Installed apps pick the
story up on their next catalog refresh; no app update required.
