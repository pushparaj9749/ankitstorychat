# Kissa Editor — Project Plan (v0)

> **Status:** planning only. No code yet.
> **Decision summary:** Android-only video editor, Kotlin + Jetpack Compose + AndroidX Media3,
> `minSdk 26` (Android 8.0), `targetSdk 36`, lives inside this monorepo as `editor/`,
> monetisation decided later (hooks left open), built phase by phase — not all at once.

---

## 1. What we are building

Ek **phone-only video editor** — CapCut-style intent, but built around a realistic
phone pipeline: 9:16-first (reels/shorts), fast trim-and-join, text/stickers,
music, filters, transitions, auto-captions, export at 720p/1080p/4K.

**Primary user (v1):** khud hum — Kissa promos/reels banane ke liye.
**Later:** public Play Store app (free/paid model TBD).

### Non-goals (v1)
- iOS app.
- Cloud sync / account / team collaboration.
- Multi-hour footage, broadcast formats, NLE-grade colour grading (nodes, scopes).
- 8K, HDR10+, ProRes, RAW.
- Green-screen perfection at hair level (a good shader key, yes; broadcast keying, no).

---

## 2. Scope and phases

Each phase ends with **something installable and usable**, not a half-feature.

| Phase | Scope | Effort | Acceptance (how we know it's done) |
|---|---|---|---|
| **0 — Skeleton** | Compose app, media picker (Photo Picker), project model, project list screen, Room persistence, preview player | ~1 week | App installs, project create/save/reopen works, one clip plays in preview |
| **1 — Timeline** | Multi-track UI, trim/split/delete/reorder, pinch-zoom, snapping, frame scrub, undo/redo, thumbnails | 3–4 weeks | 10 clips, 60s project, edit + undo 50 steps without lag; project survives app kill |
| **2 — Export** | Media3 Transformer, 1080p H.264, progress + cancel, background foreground-service export, share/save to Gallery | ~2 weeks | 60s project exports correctly in <2× realtime on your phone; export continues with screen off |
| **3 — Text & overlays** | Text clips (MSDF), **font import + variable axes + font manager (§6.9)**, stroke/shadow, animations, stickers, shapes, **universal layer model** | 5–6 weeks | Text runs through the same effect stack as video; imported fonts render identically in preview and export |
| **4 — Audio** | Music track, waveform, trim, fade in/out, per-clip volume, voiceover recording, mute | 2–3 weeks | Waveform matches audio; music + voiceover mix correctly in export |
| **5 — Speed & transitions** | Speed 0.1×–10×, ramps, **all 25 transitions**, freeze frame, **12 shake effects** (§6.5, §6.7) | 7 weeks | Transition renders frame-accurate; audio stays in sync at any speed; shake is deterministic |
| **6 — Looks** | LUT, adjustments, blend modes, overlays, chroma key, **glow / deep glow / bloom**, blur, stylise, distort, **18 glitch effects**, presets (§6.5–6.7) | 8–9 weeks | Glow, shake and glitch work on text, photos and video with every parameter keyframeable |
| **7 — Captions & smart tools** | Auto-captions (Whisper tiny), editable caption track, silence removal, beat markers | 3–5 weeks | 60s Hinglish clip → captions in <60s on device, 80%+ usable after edits |
| **8 — Keyframes & masks** | Full keyframe graph editor + 7 mask shapes with feather/keyframes (§6.5) | 6 weeks | Smooth interpolation, no preview/export mismatch |
| **9 — Launch polish** | Onboarding, templates, settings, crash reporting, Play Store assets, privacy, ASO | 2–3 weeks | Internal → closed → production track; ANR-free on 4 GB device |

**Realistic totals:** Phase 0–2 (real, usable editor) ≈ **6–8 weeks**. Phase 3–6 ≈ +12–16 weeks.
Full "all features" ≈ **9–12 months** of consistent work, with you testing on device every week.

> Recommendation: launch after Phase 4 with a smaller promise ("fast reels editor"),
> then ship Phase 5–6 as updates. Users forgive missing effects, not broken exports.

---

## 3. Tech stack (and why)

| Concern | Choice | Why |
|---|---|---|
| Language / UI | Kotlin 2.x + Jetpack Compose (Material 3) | Timeline needs custom canvas + gestures; Compose handles both |
| Playback | **Media3 ExoPlayer** | First-party, hardware decode, `CompositionPlayer` can preview the exact export composition |
| Editing / export | **Media3 Transformer + Effects** (Apache-2.0) | No FFmpeg licensing trap; GPU effects via `GlEffect` |
| Effects | Custom `GlShaderProgram` (GLSL ES 3.0) | LUT, chroma key, transitions, keyframes all become shaders |
| Persistence | Room (SQLite) + JSON project file | Fast queries for project list, JSON is debuggable/exportable |
| Background work | Foreground service, `foregroundServiceType="mediaProcessing"` | Export must survive screen-off / app switch (Android 14+ requirement) |
| Captions | **whisper.cpp** (tiny/base) via JNI, model downloaded on first use | On-device, offline, no per-minute server cost; ~75–150 MB model kept out of the APK |
| AI segmentation | **MediaPipe Image Segmenter** | Apache-2.0; saves 6–8 weeks over training a model |
| Dependencies | see **§6.8** | Full adopt/refuse catalogue with licences |
| Images | Coil | Thumbnails, stickers, project covers |
| DI / async | Hilt + Coroutines/Flow | Standard, testable |
| Crash / analytics | Firebase Crashlytics (opt-in, no personal data) | Needed before public release; can stay off during dev |

### Licensing — the one thing that can sink a Play Store app

- **Media3 = Apache-2.0** → safe to ship closed-source. This is the main reason we avoid an FFmpeg-first design.
- **FFmpeg** is *not* used in v1. If a feature later absolutely needs it (weird containers, HEVC edge cases),
  use an **LGPL** build only, linked dynamically, with licence notices and source offer.
  A **GPL** build would force the whole app to be open-source — that decision must be explicit, never accidental.
- Music, LUTs, stickers, fonts: every bundled asset needs a licence that allows commercial use.
  No "downloaded from Pinterest" packs, no film clips, no third-party trailers.

---

## 4. Architecture

```
editor/
  app/                  (Android application module)
  core/model/           Project, Track, Clip, Effect specs (pure Kotlin, unit-tested)
  core/timeline/        edit operations, undo/redo, snapping math
  core/media/           import, probe, thumbnails, waveforms, proxies
  core/render/          Composition builder, custom GlEffects, LUTs
  core/export/          Transformer wrapper, presets, foreground service
  feature/projects/     project list / create / delete
  feature/editor/       timeline UI, preview, inspector panels
  feature/export/       export sheet, progress, share
  docs/
    LICENCES.md         (generated: every dependency + licence + link)
  assets/ATTRIBUTION.md (source URL + licence per asset)
```

### Data model (source of truth)

```kotlin
@Immutable
data class Project(
  val id: String,
  val name: String,
  val schemaVersion: Int,          // migrations live here
  val canvas: CanvasSpec,          // 1080x1920, 30fps, sRGB
  val tracks: List<Track>,         // video / audio / text / sticker
  val durationUs: Long,
  val modifiedAt: Long,
)

@Immutable
data class Clip(
  val id: String,
  val kind: ClipKind,
  val sourceUri: String,           // content:// or app-private file
  val sourceInUs: Long,
  val sourceOutUs: Long,
  val timelineStartUs: Long,
  val speed: Float = 1f,
  val volume: Float = 1f,
  val transform: TransformSpec,
  val effects: List<EffectSpec>,   // ordered, serialisable
)
```

Everything is **immutable**; an edit produces a new `Project`. That gives us
undo/redo for free and makes preview/export deterministic.

### The single-renderer rule (most important design decision)

One function converts a `Project` → Media3 `Composition`.
**Preview** plays that composition (`CompositionPlayer`), **export** feeds the same
composition to `Transformer`. There is no second rendering path, so what you see is
what you get — the #1 source of bugs in phone editors ("preview looked fine, export
was black") disappears by construction.

```
Project ──buildComposition()──► Composition ──► CompositionPlayer  (preview)
                                        └─────► Transformer       (export MP4)
```

Custom effects implement Media3's `GlEffect`/`GlShaderProgram` once and work in both.

### Undo/redo
- Command + snapshot hybrid: store the previous immutable `Project` in a ring buffer (depth 50).
- Media stays referenced by URI (never duplicated), so 50 snapshots cost a few MB at most.
- Every destructive action is one command (delete 5 clips at once = one undo step).

### Storage
- Project + proxies + thumbnails: app-private storage (`filesDir/projects/<id>/`).
- Import: Android **Photo Picker** (no storage permission at all) + `MediaStore` for browsing.
- Export: `MediaStore.Video` into `Movies/Kissa Editor` — no `MANAGE_EXTERNAL_STORAGE`
  (Play rejects it for editors that don't strictly need it).

---

## 5. Performance budgets

| Metric | Target | Measured on |
|---|---|---|
| Cold start | < 2.0 s | SD 7-series, 8 GB |
| Timeline scroll (30 clips) | 60 fps | your 16 GB phone + 4 GB emulator |
| Preview | 30 fps @ 1080p | both |
| Export 60 s project @ 1080p30 | < 120 s | your phone |
| Export 4K30 | supported, ~2–4× slower | your phone only |
| Peak memory | < 400 MB (1080p project) | 4 GB device must not be killed |
| Project open | < 1 s | 100 clips |

**Proxy strategy:** for sources above 1080p (or HEVC that the device can't decode live),
generate a 540p H.264 proxy for the timeline. Export always reads the original file.
Proxies are deleted when the project closes/export finishes (or kept with a size cap).

**Quality guard:** golden-frame tests extract a frame at a fixed timestamp and compare
against a stored PNG (SSIM ≥ 0.98). This catches "effect silently stopped applying".

---

## 6. Audio, captions, and the honest limits

- **Music:** user imports their own audio; also ship a small royalty-free starter set with
  licence file per track. No copyrighted songs, no "trending audio" scraping.
- **Waveform:** decode a downsampled PCM pass once and cache peak arrays (not the full audio).
- **Voiceover:** record while previewing, store as a separate audio clip, always non-destructive.
- **Auto-captions:** whisper.cpp **tiny** (multilingual) downloaded on first use (~75 MB) —
  keeps APK small and works offline. Hindi/English both fine; **Hinglish code-switching is
  the weak spot** — expect ~80% usable, so captions land in the timeline as editable text
  clips, never burned in automatically.
  Alternative (Android 10+ `AudioPlaybackCapture` + `SpeechRecognizer`) is unreliable across
  OEMs — kept as a fallback only, not the main path.

---

## 6.5 Effects — full scope, no compromise

> **Decision (2026-11-18): scope par compromise nahi.** Har effect ship hoga.
> Compromise sirf **order** par hai (timeline + export pehle, effects baad me) aur
> **speed** par (4K + heavy effects = slow export, physics hai).
> Total ~110 effects. Nothing below is "optional" or "nice to have".

### A. Looks & colour (12)
LUT `.cube` import (unlimited) + 20 built-in looks · brightness · contrast · saturation ·
exposure · temperature · tint · highlights · shadows · sharpness · vignette · grain/fade.
All adjustment sliders merge into **one** shader pass; LUT is a second pass (2 max).

### B. Transitions (25+)
Crossfade · dip to black · dip to white · slide L/R/U/D · zoom in · zoom out · blur dissolve ·
whip pan · luma wipe ×6 (linear, radial, barn, iris, clock, split) · glitch · RGB split · spin ·
3D cube · page turn · film burn · light leak · flash · shake.

Each transition = deterministic `Transformation` over `presentationTimeUs` with an audio
crossfade of the same length. Rendered identically in preview and export (single-renderer rule).

### C. Motion & time (6)
Speed 0.1×–10× · speed ramps/curves · reverse · freeze frame ·
smooth slow-mo via optical flow (default **off**, warns on low-RAM devices) · speed keyframes.

### D. Keyframes (every parameter)
Position · scale · rotation · opacity · all colour/filter params · audio volume · mask shape.
Interpolation: linear, ease-in/out, custom bezier, with a graph editor.
Values live in the immutable `Project`, so undo/redo and preview/export parity are automatic.

### E. Masks (7 shapes)
Linear · mirror · circle · rectangle · polygon (free-draw) · heart · star.
Feather, invert, mask-position keyframes. Implemented as one shader pass with a mask texture.

### F. Compositing
Chroma key + spill suppression + edge feather · 8 blend modes (normal, screen, overlay,
multiply, add, soft light, hard light, difference) · 25 video overlays (dust, light leak,
particles, bokeh, rain, snow, fire, ink, film scratches…) · animated stickers · GIF.

### G. Text
Font family/size/weight · fill, stroke, shadow, background box · alignment · letter spacing ·
30+ animations (typewriter, bounce, pop, neon glow, shake, karaoke, slide, scale, rotate,
fade, blur-in…). Text is a timeline clip, so keyframes and masks apply to it too.

### H. AI / smart (the expensive five)
| Feature | Cost | Honest limitation |
|---|---|---|
| AI background removal | 3–4 weeks | ~50 MB on-device model, 40–80 ms/frame, **hair edges are average** |
| Motion tracking (point tracker) | 2–3 weeks | Drifts on fast motion; manual correction needed |
| Auto-reframe 16:9 → 9:16 | 2 weeks | Subject detection, not magic; user can override |
| Stabilisation (basic) | 1–2 weeks | Crops ~10–15% of frame; not gimbal-level |
| Auto-captions + silence removal | 3–4 weeks | whisper.cpp tiny; **Hinglish code-switching ~80% usable**, always editable |

### I. Audio effects
Fade in/out · volume keyframes · denoise · voice enhance · reverb · 8D rotation · pitch shift.

### Effect budget (why this is physically possible)
Each effect = one GPU shader pass. At 1080p30 a pass costs ~2–4 ms.
**Hard cap: 4 shader passes per clip.** Beyond that the editor merges passes where possible
and otherwise warns (“is clip par effect limit”). Preview uses a 540p proxy; export is full-res.
This cap is what keeps a 4 GB phone from dying — it is not a feature cut.

### Preview = export
One shader implementation per effect, used by both `CompositionPlayer` (preview) and
`Transformer` (export). Golden-frame tests (SSIM ≥ 0.98 at fixed timestamps) guard every effect,
because “the filter silently stopped applying” is the most common phone-editor regression.

### Delivery order (scope unchanged, only sequence)
| Stage | Effects | Cumulative |
|---|---|---|
| E1 | Looks + adjustments + blend modes | ~3 weeks |
| E2 | Text + stickers + audio effects | ~4 weeks |
| E3 | Speed + all 25 transitions + video overlays + 12 shake effects | ~7 weeks |
| E4 | Keyframes (graph editor) + masks | ~6 weeks |
| E5 | AI five (background removal, tracking, reframe, stabilise, captions) | ~10–14 weeks |
| E6 | 18 glitch effects + frame-history trail + preset system | ~6 weeks |

Effects alone ≈ **8–9 months** (see §6.7 for the shake/glitch addition); with the base editor
and launch work, the full "no compromise" product is **~14–16 months**. Any claim of less is not credible.

## 6.6 Universal effect stack — Alight Motion model

> **Decision (2026-11-18):** effects are **not** features of video clips. They are
> properties of **every layer**: video, photo, text, sticker, shape, group and
> adjustment layer. Every effect is fully parameterised (keyframeable, curve-able),
> and the inspector UI is generated from each effect's schema so nothing is hardcoded.
> No effect is "video-only". Glow / deep glow are first-class, not presets.

### A. The layer model (what makes this possible)

```
Composition
 └─ Layer (video | image | text | sticker | shape | group | adjustment)
     ├─ Source        → decoded video frame | bitmap | rasterised text | vector
     ├─ Transform     → position, scale, rotation, anchor, skew
     ├─ EffectStack   → ordered list of effects, each with typed params
     ├─ Mask          → 7 shapes, feather, invert, animated
     └─ Blend         → 8 blend modes + opacity
```

Render order per layer, identically in preview and export:

```
source → transform → EFFECT STACK (in order) → mask → blend into parent
```

Two consequences that matter:

1. **Text, stickers and shapes are rasterised to a texture first**, then pushed through the
   *same* shader stack as video. So glow, blur, chromatic aberration, distortion — everything —
   works on text exactly like on footage. This is the Alight Motion behaviour being copied.
2. **Group / adjustment layers** apply an effect stack to *everything below them*, so one
   colour grade can hit five layers at once.

### B. Text rendering (why text gets real effects, not fake ones)

- Text is rasterised on the GPU via a **distance-field (MSDF) atlas**: crisp at any scale,
  cheap to animate, no per-frame bitmap re-upload.
- Because it ends up as a texture, it inherits the full effect stack, masks, keyframes and
  blend modes — identical code path as video, zero special cases.
- Fonts embedded or user-imported (`.ttf`/`.otf`), subsetted at export resolution.

### C. Effect catalogue — additions on top of §6.5

| Group | Effects |
|---|---|
| **Glow family** | **Glow**, **Deep glow**, **Neon glow**, **Bloom**, **Outer glow**, **Inner glow**, **Light sweep**, **Halation** |
| **Blur family** | Gaussian, box, motion (directional), radial, zoom, tilt-shift, bokeh/disc, **variable blur** (mask-driven) |
| **Stylise** | Posterize, threshold, duotone, gradient map, halftone, dither, ASCII, pixelate/mosaic, emboss, edge detect, sketch, oil paint, cartoon, neon edge |
| **Distort** | Wave, ripple, twirl, bulge/pinch, kaleidoscope, mirror, displacement, glass, refraction |
| **Glitch / retro** | RGB split, scanlines, VHS, CRT, film burn, dust & scratches, datamosh (basic), glitch blocks |
| **Colour (pro)** | Curves (RGB + luma), levels, colour balance, hue/sat/light, selective colour, split toning, LUT |
| **Optical** | Chromatic aberration, lens distortion, vignette, lens flare, sharpen/unsharp, film grain |

That takes the catalogue from ~110 to **~155 effects**, still nothing removed from §6.5.

### D. "Everything is customisable" — how it is guaranteed

Every effect declares a **schema**, not UI code:

```kotlin
@Immutable
data class EffectSpec(
  val type: EffectType,                 // GLOW, DEEP_GLOW, LUT, BLUR…
  val params: Map<String, ParamValue>,  // typed: Float, Int, Bool, Color, Point, Curve
  val enabled: Boolean = true,
)

val DEEP_GLOW = EffectSchema(
  id = EffectType.DEEP_GLOW,
  params = listOf(
    Param.float("radius", 0f..200f, default = 40f, keyframeable = true),
    Param.float("intensity", 0f..3f, default = 1.2f, keyframeable = true),
    Param.color("tint", default = Color.White, keyframeable = true),
    Param.float("threshold", 0f..1f, default = 0.35f, keyframeable = true),
    Param.float("softness", 0f..1f, default = 0.5f, keyframeable = true),
    Param.float("spread", 0f..2f, default = 1f, keyframeable = true),
    Param.enum("quality", listOf("fast", "balanced", "high"), default = "balanced"),
  ),
)
```

- The **inspector is generated from the schema** → new effect = schema + shader, no UI work.
- Every `keyframeable` param gets a keyframe diamond and a bezier curve editor automatically.
- Effect order is drag-and-drop; each effect has enable/disable, copy, paste, remove, reset.
- Presets = saved `EffectSpec` lists, so any combination can be saved and reused on any layer.

### E. Shader pass budget (revised — no effect removed)

Free versions of blur/glow cost multiple GPU passes, so the budget is now **weighted passes**,
not a flat 4:

| Effect | Passes |
|---|---|
| LUT / adjustments (merged) | 1 |
| Glow (threshold + 2-pass blur + combine) | 3 |
| Deep glow (multi-scale, 3 blur levels) | 5 |
| Gaussian blur | 2 |
| Chroma key, masks, blend | 1 each |

**Device-adaptive cap:** 8 weighted passes on 8 GB+, 5 on 4–6 GB, 3 on low-end.
Exceeding it does **not** disable effects — the editor (a) downsamples preview to a 540p proxy,
(b) offers "render quality: fast" for that effect, and (c) warns only if preview drops below 24 fps.
Export always renders everything at full quality, however slow it takes.

### F. Cost of this architecture

| Item | Extra time |
|---|---|
| Universal layer/effect-stack architecture (vs. clip-only effects) | 3–4 weeks |
| MSDF text rasterisation + font pipeline | 2 weeks |
| Glow family (7 effects, multi-scale blurs) | 2–3 weeks |
| Blur + stylise + distort + glitch families | 4–5 weeks |
| Schema-driven inspector + keyframe/curve reuse | 2–3 weeks |

**Total effects work: ~6–7 months**, full product **~12–15 months**. The architecture is chosen
deliberately: it is the only way "every effect on everything, fully customisable" is true
instead of marketing copy.

## 6.7 Shake & glitch — complete family

> **Decision (2026-11-18):** every shake and every glitch effect ships, on every layer type,
> fully parameterised. Nothing here is a preset-only "effect card".

### A. Shake family (12 — procedural, not pre-baked)

Camera shake is **math, not footage**: a seeded noise function displaces the layer's transform
each frame. That is why it works identically on video, photos, text and stickers, and why it
costs almost nothing (no extra shader pass — it edits the transform matrix).

| Effect | What it does | Key params |
|---|---|---|
| **Shake** | classic random position jitter | amplitude, frequency, axis, decay |
| **Camera shake** | as above but on an adjustment layer → shakes the whole frame | amplitude, frequency, rotation |
| **Handheld** | low-amplitude organic drift, adds realism | strength, speed, drift |
| **Earthquake** | heavy low-frequency shake with vertical bias | magnitude, duration |
| **Punch / impact** | sharp scale + position hit on a beat | force, duration, direction |
| **Rumble** | continuous high-frequency micro-shake | intensity, roughness |
| **Rotate shake** | angular wobble around a pivot | angle, speed, pivot |
| **Zoom shake** | rhythmic in/out pulse | zoom amount, rate |
| **Wave shake** | sine-based sway (left-right / up-down) | amplitude, wavelength, phase |
| **Beat shake** | auto-syncs punches to the music's detected beats | sensitivity, strength |
| **Wiggle** | smooth path-based wiggle between random points | distance, speed |
| **Shake ramp** | intensity keyframed — builds from calm to violent | start, peak, curve |

**Determinism rule (critical):** the noise is seeded from `(layerId, clipId, effectIndex)` and
sampled by `presentationTimeUs` — *never* by `Random()` at render time. So the shake you see in
preview is bit-for-bit the shake in export, and re-exporting the same project gives the same video.

### B. Glitch family (18)

| Effect | What it does |
|---|---|
| **RGB split / chromatic aberration** | channel offsets, animated |
| **Glitch blocks** | macroblock displacement in random tiles |
| **Datamosh (basic)** | block-shift based frame smearing |
| **Digital glitch** | bit-crush + row displacement |
| **Scanlines** | animated CRT lines, adjustable gap/opacity |
| **CRT warp** | barrel distortion + scanlines + vignette |
| **VHS** | tracking noise, colour bleed, tape wobble |
| **Noise / static** | animated grain + snow |
| **TV turn-off** | horizontal collapse to a line |
| **Signal loss** | band dropout that scrolls |
| **Pixel sort** | brightness-thresholded streak sorting |
| **Displace glitch** | texture-driven UV displacement |
| **Slice glitch** | horizontal slices offset by keyframed amount |
| **Frame echo / trail** | previous frames blended in (motion trails) |
| **Strobe** | rapid exposure flashes |
| **Invert flicker** | keyframed negative flashes |
| **Posterize glitch** | stepped colour with jitter |
| **Chromatic pulse** | aberration that pulses (beat-syncable) |

All are single-pass shaders except **frame echo / trail**, which needs a 2-frame history buffer
(counted as 2 passes in the budget) — that is the only one that costs extra.

### C. Where they apply

Because of the universal layer model (§6.6):

- On a **video/photo clip** → that layer shakes or glitches.
- On a **text layer** → the title itself glitches (the classic "scary text" look), with the same
  sliders.
- On a **sticker/shape** → same.
- On an **adjustment layer** placed at the top → the *entire composition* shakes or glitches,
  which is how "camera shake" and "whole-screen glitch" work.
- **Beat sync**: `Beat shake` and `Chromatic pulse` can read the audio's detected beat markers
  (Phase 7), so punches land on the music instead of being hand-timed.

### D. Presets (on top of the sliders)

Every family ships named presets that are just saved `EffectSpec`s — e.g. **Impact**, **Boom**,
**Handheld walk**, **Earthquake**, **Trailer hit**, **VHS 90s**, **Cyber glitch**, **Broken TV**,
**Horror flicker**, **Data error**. Presets are editable, copyable between layers, and saveable
as user presets — so a preset is never a dead end.

### E. Cost

| Item | Time |
|---|---|
| Shake family (12, procedural + beat sync hook) | 2 weeks |
| Glitch family (18 shaders) | 4–5 weeks |
| Frame-history buffer (trail/echo) | 1 week |
| Preset system + user presets | 1 week |

**Adds ~2 months.** Effects total moves from ~6–7 to **~8–9 months**; full product **~14–16 months**.
This is the true cost of "sare shake aur glitch bhi, sab customisable" — stated once, honestly.

## 6.8 Open-source building blocks (what we reuse, what we refuse)

> **Decision (2026-11-18):** reuse open source wherever it is mature and licence-safe.
> Every candidate is listed with its licence and the risk it carries. **Rule: no GPL/AGPL in
> the app.** Apache-2.0 / MIT / BSD / ISC only — with LGPL allowed *only* as a dynamically
> linked native library, never statically compiled in.

### A. Adopt (Apache-2.0 / MIT / BSD — safe to ship closed-source)

| Area | Project | Licence | Use |
|---|---|---|---|
| Playback | **AndroidX Media3 / ExoPlayer** | Apache-2.0 | preview player |
| Edit + export | **Media3 Transformer + Effects** | Apache-2.0 | composition, GL effects, MP4 muxing |
| UI | **Jetpack Compose**, Material 3 | Apache-2.0 | whole app |
| Images | **Coil** | Apache-2.0 | thumbnails, stickers |
| Persistence | **Room** | Apache-2.0 | projects, undo snapshots |
| DI / async | **Hilt**, **Coroutines**, **Flow** | Apache-2.0 | plumbing |
| Logging | **Timber** | Apache-2.0 | debug logs |
| Leak hunting | **LeakCanary** | Apache-2.0 | debug-only |
| Benchmarks | **Macrobenchmark**, **Baseline Profiles** | Apache-2.0 | perf + startup |
| Glitch shaders | **gl-transitions** (GLSL collection) | MIT | transition/glitch shader math, adapted |
| Colour science | **OpenColorIO** (small subset) / **colour-science** tables | Apache-2.0 / BSD | LUT correctness |
| LUT toolbox | **lut-parser** style `.cube` readers | MIT | `.cube` import |
| Captions | **whisper.cpp** | MIT | on-device ASR (model separate) |
| ASR model | **Whisper tiny/base** weights | MIT | first-run download, not bundled |
| Segmentation | **MediaPipe Selfie/Image Segmenter** | Apache-2.0 | AI background removal (better than hand-rolled) |
| Tracking | **MediaPipe / OpenCV** (Apache-2.0 parts only) | Apache-2.0 | point tracker, stabilization |
| Audio DSP | **TarsosDSP** | GPL-3.0 ⚠️ **NO** — see §B | — |
| Audio DSP (alt) | **soundtouch** (LGPL) / own DSP | LGPL-2.1 | pitch/tempo, dynamic link only |
| Waveform | **waveform** renderers (MIT) | MIT | peak display |
| Fonts | **Google Fonts** (OFL) | OFL-1.1 | text tool |
| Icons | **Lucide / Material Symbols** | ISC / Apache-2.0 | UI icons |
| GIF | **android-gif-drawable** (Apache-2.0) or Coil GIF | Apache-2.0 | stickers |
| Video overlays | **CC0 / Pexels / Mixkit** packs | CC0 / custom licence | dust, light leaks, particles |

### B. Refuse (and why)

| Project | Licence | Problem |
|---|---|---|
| **FFmpeg** (default build) | **GPL-2.0/3.0** | would force the entire app to be open source |
| **FFmpeg-kit** | GPL/LGPL mix, **retired** | no longer maintained; licence trap |
| **TarsosDSP** | **GPL-3.0** | same trap — replace with own DSP or soundtouch (LGPL, dynamic) |
| **LAME / x264 CLI** | GPL | encoder licensing; Media3's hardware encoders avoid it |
| **CapCut / InShot assets** | proprietary | never copy UI assets, presets or sounds |
| **"Free" LUT packs from Pinterest/YouTube"** | unknown | unverifiable licence = legal risk; use CC0 or generate our own |
| **Trending songs / film audio** | copyrighted | instant takedown + Play strike |

### C. How reuse is managed (so it stays safe as the project grows)

1. **`editor/docs/LICENCES.md`** — every dependency, version, licence, link. Generated by a
   Gradle task (`./gradlew listLicences`) so it can never drift.
2. **CI licence gate** — `editor-ci.yml` fails if a new dependency resolves to GPL/AGPL.
   A human can override only by adding an explicit, dated waiver to `LICENCES.md`.
3. **NOTICE file** — Apache-2.0 requires attribution; the About screen shows the same list.
4. **Shaders adapted from MIT projects keep their header comment** (author + licence).
5. **Assets** live in `editor/assets/ATTRIBUTION.md` with source URL + licence per file.
6. **No copyleft in the APK** is a hard release gate, checked before every Play upload.

### D. Where open source genuinely saves weeks

| Saved work | How |
|---|---|
| Player + export pipeline | Media3 instead of writing muxer/decoder glue (~4–6 weeks) |
| AI background removal | MediaPipe segmenter instead of training a model (~6–8 weeks) |
| Transitions math | gl-transitions shader collection (~2 weeks) |
| Captions | whisper.cpp instead of building ASR (~8+ weeks) |
| Waveform maths | existing MIT peak algorithms (~1 week) |
| LUT parsing | MIT parser instead of the `.cube` spec edge cases (~1 week) |

**Roughly 20–25 weeks of work avoided** — that is the real value, not "free code".

### E. What open source does *not* solve

- **The editor itself** (timeline, undo, snapping, inspector, keyframes UI) — no drop-in
  library exists for a phone NLE. This is still the bulk of the work.
- **Preview = export parity** — our single-renderer rule remains the core discipline.
- **Performance tuning** on real devices — libraries ship generic defaults, not our budgets.
- **Design/UX** — must be ours; copying another app's UI is both bad and risky.

## 6.9 Fonts — user-imported, ours, and legally safe

> **Decision (2026-11-18):** the user can import their own fonts. Bundled fonts are OFL only.
> Imported fonts are the user's responsibility, and the app says so in one plain sentence.
> Fonts feed the MSDF text pipeline (§6.6), so they get the full effect stack.

### A. Import

- **Source:** Photo Picker can't pick fonts, so use `ACTION_OPEN_DOCUMENT` filtered to
  `font/ttf`, `font/otf`, `application/x-font-ttf`, `application/octet-stream` (some file
  managers report the last one). Multi-select supported. Also `.ttc`/`.otc` collections.
- **Validation on import:** parse with `android.graphics.Typeface` + a header sniff
  (`sfnt`/`OTTO`/`true`/`ttcf`). Corrupt or DRM-wrapped font → clear error, never a crash.
- **Preview before saving:** type the project name in three weights so the user sees the actual
  glyphs before committing.
- **Storage:** copied into app-private storage (`filesDir/fonts/<sha256>.ttf`), deduped by hash —
  the same font imported twice costs one file.
- **Font manager screen:** list (with preview line), rename display name, delete, "used in N
  projects" guard before deletion, import from file, restore bundled defaults.
- **Per-project or global:** importing adds to the library; each text layer picks from it. Font
  choice is stored in the `Project` as `fontId` + optional variation axes, so a project still
  renders correctly if the font is later deleted (falls back to the bundled default and marks the
  layer with a one-time warning, never a silent wrong font).

### B. Variable fonts (the part most editors get wrong)

- Detect `fvar` table → expose **weight** and **width** sliders plus any custom axis
  (e.g. optical size, slant) in the inspector.
- MSDF generation honours the chosen instance, so a 300-weight and an 800-weight of the same
  file don't share one blurry atlas.
- `.ttc` collections: show the faces inside and import the selected one.

### C. Rendering pipeline (why text stays sharp at any zoom)

```
.ttf/.otf → subset (used glyphs only) → MSDF atlas (per weight/size bucket)
          → texture → effect stack → mask → blend
```

- Atlases are generated **on first use** of a glyph set, cached on disk, keyed by
  `(fontHash, weight, axis, sizeBucket)`. No 50 MB prebake for a font nobody used.
- Emoji: system emoji font covered via fallback chain; a **colour emoji** layer type is planned
  in Phase 3 (COLR/CBDT support via bundled Noto Color Emoji, Apache-2.0/OFL).
- Right-to-left and Devanagari shaping come from the platform shaper (HarfBuzz inside Skia);
  **we test Hinglish, Hindi and English explicitly** — Hindi matras are the usual breakage point.
- Fallback chain: chosen font → project fallback → bundled default → system. Missing glyphs are
  never drawn as tofu boxes without a warning.

### D. Legal guardrails (this is where people get sued)

| Rule | Implementation |
|---|---|
| Bundled fonts must be OFL/Apache | Only Google Fonts (OFL-1.1), listed in `assets/ATTRIBUTION.md` |
| Imported fonts are the user's call | One-time in-app note: "Tum apni font import kar rahe ho — uska licence tumhari zimmedari hai." |
| **No redistribution** | Imported fonts stay on device; they are **never** uploaded, synced or shared inside exported presets |
| Presets exclude fonts | A shared preset stores `fontId` + a visual fallback (rendered sample), not the font file |
| Commercial fonts (e.g. paid foundry files) | Not bundled, not encouraged; if a user imports one, that is their licence to own — the app does not ship it |
| Play Store safety | No font files in the APK except OFL ones; the licence gate (§6.8) also checks `assets/fonts/` |

### E. What ships in the box

- **12 OFL families** covering the styles reels actually use: a bold display face, a clean
  geometric sans, a humanist sans, a condensed sans, a high-contrast serif, a slab, a rounded,
  a handwritten script, a brush, a monospace, a stencil/graffiti, and one Devanagari family.
  All with 4–6 weights each (subsetted to Latin + Devanagari) so APK growth stays ~4–6 MB.
- Font size/weight/letter-spacing/line-height/align + stroke, shadow, background box.

### F. Cost

| Item | Time |
|---|---|
| Import + validation + font manager screen | 1 week |
| Variable font axes + `.ttc` faces | 1 week |
| MSDF atlas per weight/axis + disk cache | 1.5 weeks |
| Devanagari/Hinglish shaping tests + fallback chain | 1 week |
| Bundled OFL set (12 families, subsetting, attribution) | 3 days |

**~4–5 weeks**, folded into Phase 3 (text & overlays). No other phase moves.

## 7. Play Store & compliance checklist

| Item | Status / note |
|---|---|
| Play Console account | $25 one-time — **you** must own it (I can't create accounts) |
| `targetSdk` | **36** (Android 16) — Play requires it for new apps/updates from Aug 2026 |
| `minSdk` | **26** (Android 8.0) — as decided |
| AAB + 64-bit | arm64-v8a (+ armeabi-v7a optional) |
| Foreground service | declare `mediaProcessing` + user-visible notification; Play asks for a justification video |
| Permissions | `READ_MEDIA_VIDEO`/`AUDIO` (33+), `POST_NOTIFICATIONS` (33+), `RECORD_AUDIO` only when recording voiceover. No `MANAGE_EXTERNAL_STORAGE` |
| Privacy policy | required (URL) — I can write it; hosting on the site is easy |
| Data safety form | state exactly what leaves the device (Crashlytics only, no media uploads) |
| Content rating | IARC questionnaire |
| Signing | dedicated upload keystore, secrets in GitHub Actions; **never** commit the keystore |
| Ads / IAP | not in v1 — but `ExportConfig.watermark` + a `ProGate` interface exist from Phase 2 so the model can be added without refactoring |

---

## 8. Repo layout & CI isolation

You chose: **same repo, separate folder**.

```
/                       (Kissa app — untouched)
editor/                 (new, standalone Gradle project)
  settings.gradle.kts
  gradle/libs.versions.toml
  app/ core/ feature/ ...
  PLAN.md               (this file)
```

Required guards so the two projects don't interfere:

1. `tsconfig.json` → add `"editor"` to `exclude` (keeps `npm run typecheck` away from it).
2. `.github/workflows/android.yml` → add `'editor/**'` to `paths-ignore`
   (otherwise every editor commit triggers an 11-minute Kissa APK build).
3. New `.github/workflows/editor-ci.yml` → runs only on `editor/**`:
   Gradle build + unit tests + lint. Instrumented tests on an emulator run nightly (not on every push).
4. When Play release gets close: move `editor/` to its **own repo**. Separate signing keys,
   separate release cadence, no chance of a story commit accidentally shipping an editor build.

Jest only looks in `__tests__/`, and Kotlin files aren't TypeScript, so the Kissa test suite
stays unaffected.

---

## 9. Testing strategy

| Layer | What | Tool |
|---|---|---|
| Unit | Timeline math (trim/split/snap/ripple), undo stack, project migrations | JUnit5 + Kotest |
| Golden frames | Effect output at fixed timestamps | Instrumented + SSIM compare |
| Export matrix | 720p/1080p/4K × 24/30/60 fps × H.264/H.265 | Instrumented, on device |
| Device smoke | Your 16 GB phone (real) + 4 GB emulator (low-end) | Manual checklist per phase |
| Performance | Startup, scroll, export time | Macrobenchmark |
| Stability | Memory leaks, 100-project list, app-kill mid-export | LeakCanary + manual |

Every phase gets a short “try this, tell me what breaks” checklist for you — that loop is
how the estimate stays honest.

---

## 10. Risks (and what we do about them)

| Risk | Impact | Mitigation |
|---|---|---|
| Scope creep ("all features") | Never ships | Phase gates; next phase starts only after current one is usable |
| OEM background-kill during export | Broken exports, angry reviews | Foreground service + WorkManager retry + "keep screen on" hint |
| Thermal throttle on long exports | 4K export slower than expected | Chunked export, progress honesty, low-priority threads |
| Preview ≠ export | Trust destroyed | Single-renderer rule + golden-frame tests |
| FFmpeg licence trap | App forced open-source | Media3-first; CI licence gate fails on any GPL/AGPL dependency (§6.8) |
| Codec/container edge cases | Some user videos won't import | Probe on import, transcode to proxy, clear error message |
| Play rejection (permissions/FGS) | Launch delay | Checklist above, no broad storage permission |
| Solo-maintainer bus factor | Project dies | Documented architecture, tests, and this plan kept current |

---

## 11. Milestones

| Milestone | What ships | When (from start) |
|---|---|---|
| **M1** | Skeleton: create project, import clip, play | Week 1 |
| **M2** | Timeline editing + undo, saved projects | Week 4–5 |
| **M3** | **First real export** (trim + join, 1080p) — usable daily | Week 6–7 |
| **M4** | Text (with font import), stickers, music, voiceover | Week 11–14 |
| **M5** | Speed, transitions, filters, chroma key, **shake family** | Week 18–24 |
| **M6** | Captions, silence removal, templates, **glitch family + trail** | Week 24–30 |
| **M7** | Keyframes, masks, Play Store launch | Week 31–38 |

Dates are effort-based, not calendar promises; any week without device testing pushes them.

---

## 12. Open questions (answer before Phase 2 ends)

1. **Name & branding** — "Kissa Editor" is a working name only.
2. **UI language** — Hinglish-first like Kissa, or English-first for wider reach?
3. **Monetisation** — free / ads / freemium; the `ProGate` hook exists either way.
4. **Templates** — should Kissa promo templates (9:16, repo's own dhun, caption styles) ship built-in?
   That would make M3 instantly useful for marketing.
5. **Cloud backup** — none planned; confirm users won't expect it.
6. **Minimum export** — is 1080p30 enough for v1, or is 4K needed at launch?
7. **Open-source policy** — comfortable with the §6.8 split (Apache/MIT/BSD only, no GPL/AGPL)?
   If the editor itself is ever open-sourced, GPL becomes possible — but that is a one-way door.
8. **Bundled font set** — happy with 12 OFL families (or do you want specific ones, e.g. a
   particular display face for Kissa promos)? Any font you supply must come with its licence.

---

## 13. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-11-18 | Android-only, phone-only | User decision |
| 2026-11-18 | `minSdk 26`, `targetSdk 36` | Android 8.0 floor; Play requirement from Aug 2026 |
| 2026-11-18 | Kotlin + Compose + Media3 (no FFmpeg in v1) | Fast UI + Apache-2.0 licensing safety |
| 2026-11-18 | Same repo, `editor/` folder for now | User decision; migrate to own repo before Play release |
| 2026-11-18 | Phase-gated delivery | "All features at once" would ship nothing usable |
| 2026-11-18 | Money model deferred | User decision; hooks left open |
| 2026-11-18 | **Effects: no compromise** — all ~110 ship | User decision; see §6.5. Only *order* and *export speed* differ |
| 2026-11-18 | 4-pass shader cap per clip | Physics: more passes kills 4 GB devices; merging keeps every effect available |
| 2026-11-18 | **Universal effect stack** — effects on video, photo, text, stickers, shapes, groups | User decision (§6.6); text is rasterised via MSDF so the same shaders apply |
| 2026-11-18 | **~155 effects, all fully parameterised** | User decision: glow/deep glow/bloom etc. included; schema-driven inspector, no effect video-only |
| 2026-11-18 | Weighted, device-adaptive pass budget (3–8) | Replaces the flat cap so heavy effects like deep glow stay available on every device |
| 2026-11-18 | **All 12 shake + 18 glitch effects ship** | User decision (§6.7). Shake is procedural transform noise, so it is nearly free and works on every layer |
| 2026-11-18 | Shake noise seeded by `(layerId, clipId, effectIndex, timeUs)` | Determinism: preview must equal export, and re-export must produce the same video |
| 2026-11-18 | **Reuse open source (Apache/MIT/BSD only)** | User decision (§6.8). Avoids ~20–25 weeks of work; no GPL/AGPL in the APK |
| 2026-11-18 | Licence gate in CI + `LICENCES.md` | A copyleft dependency must fail the build, not be discovered after launch |
| 2026-11-18 | **User font import** (ttf/otf/ttc), variable-font axes, per-layer fonts | User decision (§6.9). Bundled fonts OFL only; imported fonts stay on device and never ship |
