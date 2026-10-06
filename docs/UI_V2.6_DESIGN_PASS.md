# Kissa UI v2.6 — design pass

Status: **implemented** (Wave 1 + Wave 2 of the audit). Everything below is in
`src/`; the app's 455 tests and `tsc --noEmit` are green.

Visual proof: **[`docs/ui-preview/live.html`](ui-preview/live.html)** — a page
rendered from the real components via react-native-web (`npm run`-able through
`preview/`, see `preview/README.md`). Compare with the earlier static mockup in
`docs/ui-preview/index.html`.

---

## 1. Foundation (Wave 1)

| Token | Before | Now |
| --- | --- | --- |
| Font sizes | 24 distinct values (8 → 52) | `SCALE`: 11 / 12 / 13 / 15 / 17 / 22 / 26 — nothing below 11px |
| Radius | 20 distinct values | `RADIUS` tokens only |
| Colours | 35 hex + 32 rgba literals inside screens | theme tokens (`withAlpha(theme.x, a)`) |
| Touch targets | ad-hoc | `TOUCH.min = 44`, `TOUCH.sm = 36` |
| Spacing | ad-hoc 14/16/18 | `SPACING` tokens, `SPACING.page` gutter |
| Layout width | `LAYOUT.contentMaxWidth` unused | content is centred and capped on large screens |

`src/theme.ts` gained `SCALE`, `TOUCH`, `TYPE.cardTitle` and a `TYPE.caption`
that is no longer 10px.

## 2. Screens (Wave 2)

### Home — one focal point
* Brand bar → greeting + one question → search + filter → categories.
* **Hero** (`HeroCard`): artwork bounded (`minHeight 340 / maxHeight 372`),
  accent-tinted letterbox, scrim, "TONIGHT'S LEAD", age badge, favourite,
  title/tagline/meta chips and a `Start chat` CTA. Never cropped.
* **Continue** strip: compact cards with thumbnail, progress bar **and %**.
* **For you** rail: fixed 156×208 art frames with overlay titles, so covers of
  different ratios finally share one baseline.
* **Because you liked X**: a rail derived from what the reader actually did
  (favourites first, then the most recent journey) — the first place the memory
  engine becomes visible in the UI. It also picks the first genre that has ≥2
  peers, instead of only looking at `genres[0]`.
* **New arrivals**, then breathing room before the floating nav.

### Story Detail — "should I start this?"
* Immersive hero with floating glass back/favourite buttons.
* **Stats row**: scenes / cast / endings (∞ for endless stories).
* **Collapsible description** (3 lines, `Read more`).
* **Cast** row built from the story's own character references (player first).
* Media Library, Story Creator (velvet-gradient avatar + VERIFIED pill),
  Refer Kissa, Similar, sticky CTA (`Chat Now` / `Resume Journey`) with
  safe-area padding and save/favourite actions.
* Internal metadata (`#ongoing`, `#slow-burn`) is no longer shown as UI chips.
* Section order is unchanged — `__tests__/otaStoryDetail.test.tsx` asserts it.

### Chat — cinematic stage
* ChatBubble keeps **one shared layout shape** for narration and dialogue (that
  is asserted by `__tests__/chatRender.test.tsx`); the difference is now carried
  by treatment: narration whispers (faded italic on a quiet surface, no name),
  character dialogue is named with a **rose reading edge**, the player speaks in
  a rose-gradient bubble.
* Scene header with scene title in the accent, **present-characters avatars**,
  AI/offline status pill with a state dot.
* Accent atmosphere behind the transcript (no photo, no crop — cheap on GPU).
* **Choices are full-width cards** with a rose marker and chevron (were pills
  that truncated at two lines).
* Composer: rounded input + rose gradient send button + a memory line
  (`N moments remembered in this journey`) once the journey has history.
* Error card, typing indicator and scene dividers re-tokenised.

### Navigation, Discover, Library
* `KissaBottomTabBar` is now a **floating glass bar** (radius 24, blur-style
  surface, 46×28 active pill in rose) instead of a full-width band; the
  direction-aware auto-hide behaviour is unchanged.
* Discover and Library got the same header voice (accent micro-kicker, 26px
  display title, 44px search field, tokenised spacing) and centred content.

## 3. Still open (Wave 3 / 4, untouched)

* Motion: `MOTION` tokens exist but are still unused — message entry, shared
  element hero transition, skeleton shimmer, hero parallax.
* `expo-image` (caching + blurhash), Reanimated/gesture-handler (sheet drag,
  swipe), custom display font, light theme, dedicated tablet layout.
* Remaining secondary screens (Settings hub, SubmitStory, AdminPanel, About and
  the legal screens) still carry ad-hoc values; the tokens are ready for them.

## 4. Guardrails respected

* `IMAGE RATIO = SOURCE IMAGE RATIO` — no `aspectRatio` outside
  `NaturalImage.tsx`, no `resizeMode: 'cover'`, frames letterbox with the
  story's accent tint instead of cropping (`__tests__/naturalImage.test.tsx`).
* `ChatBubble` narration/dialogue shape parity and faded-narration colour
  (`__tests__/chatRender.test.tsx`).
* Story Detail section order and required strings
  (`__tests__/otaStoryDetail.test.tsx`).
* No new runtime dependencies.
