# Meethi Dushmani — publication notes

Content-only OTA story (no APK / app update). Story id: `meethi-dushmani`.

## Story

A warm, slow-burn, open-ended Hinglish romantic family drama set in old Jaipur in the two weeks
before Diwali. `{{playerName}}` (18–20), home from Delhi, must run his family's sweet shop,
Laxmi Mishthan Bhandar, while Papa is laid up. Directly opposite is Agarwal Sweets — the rival
family of a twelve-year feud — and Mishri Agarwal (20), his childhood rooftop best friend, whose
arranged rishta with a London boy is to be fixed after Diwali. On the first morning a monkey
steals her ghewar box and drops it on his counter.

- **Cast:** Mishri Agarwal (lead), Kamla Devi (his Dadi), Sushila Agarwal (her Dadi), Rajendra
  Agarwal (her father), Rishabh Malhotra (the London match), Pinky Agarwal (her cousin).
- **Threads:** the romance (earned slowly), the feud, the rishta (handled with respect and her
  agency), the Mithai Mahotsav on Dhanteras, and the family secret. Hidden truths (the dadis'
  Thursday meetings and torn recipe halves, the fire report, Rishabh's girlfriend) live in
  narrator-only lore and surface only through play.
- **Keepsake:** a blue glass marble ("neela raja") — deliberately not a thread/rakhi.
- **Format:** one opening scene (`bandar_aur_ghewar`), four open choices, no endings, tagged
  `dynamic-continuous` / `ongoing`.

## Package

```
content/stories/meethi-dushmani/
  story.json characters.json world.json scenes.json memory.json
  assets/cover.jpg
  assets/gallery/image-01.jpg … image-07.jpg
```

All eight images are photorealistic solo images of Mishri (the player never appears), native
1376×768 JPEGs generated from one canonical reference portrait so her face stays consistent.

## Catalog

- Manifest entry inserted at index 1 (index 0 stays `arranged-marriage-wala-love` for the
  deploy smoke test); `contentVersion` 41 → 42.

## Checks

- `npm run content:validate`
- `npx jest __tests__/meethiDushmani.test.ts`
- `node scripts/verify-published-story.mjs --local-only meethi-dushmani`
- Worker: `worker/__tests__/ota-catalog.test.ts` serves the real package (`NEW_STORY_IDS`).
- Deploy: `.github/workflows/deploy-api.yml` validates before deploy and verifies the published
  JSON and media byte-for-byte on both hostnames after deploy.

## Release

Merge to `main` → "Deploy story API" workflow → Cloudflare Worker. Installed apps pick the
story up on their next catalog refresh; no app update required.
