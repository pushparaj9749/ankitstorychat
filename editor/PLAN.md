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
| **3 — Text & overlays** | Text clips, fonts, colours, stroke/shadow, in/out animation, stickers (PNG/SVG), emoji | 3–4 weeks | Animated title renders identically in preview and export |
| **4 — Audio** | Music track, waveform, trim, fade in/out, per-clip volume, voiceover recording, mute | 2–3 weeks | Waveform matches audio; music + voiceover mix correctly in export |
| **5 — Speed & transitions** | Speed 0.1×–10×, ramps, **all 25 transitions**, freeze frame (§6.5) | 6 weeks | Transition renders frame-accurate; audio stays in sync at any speed |
| **6 — Looks** | LUT filters, adjustments, blend modes, overlays, chroma key (full list in §6.5) | 3–4 weeks | LUT applied in preview = export; chroma key works on a clean background |
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
| E3 | Speed + all 25 transitions + video overlays | ~6 weeks |
| E4 | Keyframes (graph editor) + masks | ~6 weeks |
| E5 | AI five (background removal, tracking, reframe, stabilise, captions) | ~10–14 weeks |

Effects alone ≈ **5–6 months**; with the base editor and launch work, the full "no compromise"
product is **~10–14 months**. Any claim of less is not credible.

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
| FFmpeg licence trap | App forced open-source | Media3-first; LGPL-only if ever needed |
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
| **M4** | Text, stickers, music, voiceover | Week 11–13 |
| **M5** | Speed, transitions, filters, chroma key | Week 17–22 |
| **M6** | Captions, silence removal, templates | Week 23–26 |
| **M7** | Keyframes, masks, Play Store launch | Week 30–36 |

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
