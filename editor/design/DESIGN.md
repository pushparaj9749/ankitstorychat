# AnkitCutz — UI design (v1, for approval)

Nine screens, one visual language. Reference used for **structure** only (Alight Motion's
dense pro layout); the look, colours and typography are ours. Screens are AI-generated
mockups — the real Compose implementation will be pixel-aligned, not traced from the images.

Images (portrait, 9:16): `ankitcutz-1-editor.jpg` … `ankitcutz-9-transitions.jpg`,
plus one contact sheet: `all-screens.png`.

---

## 1. Design tokens

| Token | Value | Use |
|---|---|---|
| `bg` | `#0B0C10` | app background |
| `surface` | `#12141A` | sheets, panels |
| `surface2` | `#191C24` | cards, inputs |
| `hairline` | `rgba(255,255,255,0.08)` | dividers, outlines |
| `text` | `#F2F4F8` | primary text |
| `textDim` | `#9AA1AE` | secondary text |
| `textFaint` | `#5F6674` | labels, meta |
| **`primary`** | **`#22D3EE`** (electric cyan) | active tab, playhead, selected outline, keyframe (keyed) |
| `primaryDim` | `rgba(34,211,238,0.14)` | selected background |
| `secondary` | **`#8B5CF6`** (violet) | text layers, secondary keyframes |
| `audio` | `#3B82F6` (blue) | waveform, audio track |
| **`action`** | **`#F0567E`** (rose) | Export / Apply / Done — the only "do it" colour |
| `warning` | `#E2BE7E` (champagne) | limits, estimates |

Type scale: `28/22/17/15/13/11` sp. Titles bold 700, labels 500. Font: Inter (OFL) bundled;
falls back to system sans. Numbers always tabular.

Shape: 14 dp cards, 10 dp chips, 999 dp pills. Spacing on a 4 dp grid (8/12/16/20).
Elevation: no shadows — surfaces separate by hairline + 1 shade lighter.

---

## 2. Screen inventory

| # | Screen | Purpose | Key elements |
|---|---|---|---|
| 01 | **Editor** | main workspace | preview + scrub bar, left layer rail (FX / T / V / ♫), timeline (V1 video, V2 text, A1 audio), keyframe diamonds + curve graph, zoom slider, bottom toolbar (Media · Layer · **FX** · Text · Audio) + Export |
| 02 | **Effects & properties** | apply + tune an effect | category tabs (Glow/Blur/Colour/Distort/Glitch/Stylise), effect cards with live thumbnails + on/off, parameter sliders each with a keyframe diamond, mini keyframe strip, Reset · Copy · Paste · Delete · Apply |
| 03 | **Fonts** | pick/import a font | live preview of the layer text, Weight + Size sliders, rows showing **`ABCabc` in that font**, selected row outlined, `+ Import font…` |
| 04 | **Projects / Home** | open or create work | wordmark, "New project" card with 9:16 / 16:9 / 1:1 chips, project grid (thumbnail, duration, name, "edited"), exporting state, Import media tile, bottom nav (Projects · Templates · Exports · Settings) |
| 05 | **Text editing** | type + style text | layer chips (V1 Video / V2 Text), text field, tabs Style/Font/Animation/Colour/Shadow, style presets, size/spacing/height/opacity sliders with keyframes, alignment, colour swatches, keyboard |
| 06 | **Export** | choose output | summary (thumbnail, name, duration, est. size), resolution 720p/1080p/4K, fps 24/30/60, quality slider, format MP4 (H.264), audio + hardware toggles, est. time, one big rose CTA |
| 07 | **Audio** | music / voice / effects | waveform with fade handles + playhead, tabs Music/Voice/Effects, volume/fade/pitch/speed rows with keyframes, library strip, Import from device, Record voiceover |
| 08 | **Keyframe curve editor** | animate anything | graph with grid, bezier curve + square handles, value tooltips, easing chips (Linear/Ease in/Ease out/Ease in-out/Custom), parameter strip (position, scale, rotation, opacity, glow radius) |
| 09 | **Transitions** | join two clips | preview with 0.6s badge, category chips, 12 preview cards with names, duration slider, Apply to all, Reverse, Apply |

Still to design (later phases): layer list (full), masks, stickers, templates,
settings, onboarding, export progress.

---

## 3. Rules that keep it usable (not just pretty)

1. **One action colour.** Only rose means "this commits something" (Export / Apply / Done).
   Cyan means "selected / playing / keyed". Never mix.
2. **Keyframe diamonds are always in the same place** — right edge of every parameter row.
   Filled = keyed, hollow = not keyed. Consistent across effects, text, audio, transforms.
3. **Timeline is the hero.** Preview + timeline together always ≥ 45% of the screen height;
   sheets slide over the lower half and can be dragged down.
4. **Thumb-friendly targets.** All primary controls ≥ 48 dp; trim handles 24 dp with a wider
   invisible hit area; nothing important within 24 dp of the bottom gesture bar.
5. **No hidden gestures for core actions.** Pinch = zoom (fine), but split/delete always have
   a visible button. Long-press only adds a shortcut.
6. **Numbers are honest.** Export shows a real estimate, not a fake progress bar; "estimated
   time" appears before starting, not during.
7. **Dark only for v1.** A light theme is a later decision, not a Week-1 one.

---

## 4. Open design decisions for you

1. **Cyan primary + violet + rose** — keep, or shift the primary to Kissa's rose and use cyan only
   for the playhead? (Keeps the family look, loses the "pro tool" feel.)
2. **Left layer rail** (screen 01) — keep it always visible, or collapse to a 24 dp strip that
   expands on tap? (Alight Motion keeps it; on a 6.1" phone it eats 44 dp.)
3. **Bottom toolbar order** — Media · Layer · FX · Text · Audio, or FX last (rightmost) because
   it is used most?
4. **Projects screen** — grid of 2 (bigger thumbnails) or 3 (more per screen)?
5. **Templates tab** — ship empty in v1 with "coming soon", or drop the tab until templates exist?

---

## 5. Name & web

- App name: **AnkitCutz** (from you).
- Download site: **`beyondredeye.site/ankitcutz`** — same Cloudflare site as Kissa, new page with
  hero, screenshots, features, version + APK size, download button wired to the release APK,
  and a privacy note. Build it in Phase 2 (when there is an APK to download).
