# AnkitCutz — Android video editor

Phone-only video editor. Kotlin + Jetpack Compose + Media3, `minSdk 26`, portrait,
**no permissions at all** (media comes in through the system Photo Picker, exports are
shared explicitly).

```
editor/
  PLAN.md            product plan, effect catalogue, budget rules, licensing
  design/            DESIGN.md + 21 approved screens (JPG/PNG)
  ci/                CI-only helpers (error annotations)
  app/src/main/java/site/beyondredeye/ankitcutz/
    MainActivity.kt        single activity, edge-to-edge
    ui/App.kt              projects -> editor -> effects -> export
    ui/projects/           project list
    ui/editor/             shell, timeline, preview, effect stack, add-effect, export
    ui/theme/              tokens, dark Material3 scheme, type scale
    data/                  project store (JSON), media probing, Media3 exporter
    model/                 Project, Layer, Clip, Effect schema, EffectStack, Timeline
  app/src/test/java/...    effects stack (20), timeline (11), project store (10)
```

## Build

Needs **JDK 17** and the **Android SDK** (`ANDROID_HOME`). Nothing else — no secrets.

```bash
cd editor
./gradlew testReleaseUnitTest   # 41 JVM tests, no emulator
./gradlew assembleRelease       # app/build/outputs/apk/release/app-release.apk
./gradlew installRelease        # to a connected phone
```

The release variant is signed with AGP's debug key, so it installs standalone. Play
upload needs a real key (PLAN.md §8) — never store it in this repo.

### CI

| Workflow | When | What |
|---|---|---|
| `editor-apk.yml` | push/PR touching `editor/**`, manual | unit tests + release APK artifact |
| `editor-release.yml` | tag `ankitcutz-v*` | unit tests, signed APK, GitHub Release with the APK |

The Expo app (Kissa) ignores `editor/**`; the two never ship together.

## Status — v0.2.0 (M1 + M2 partial + first export)

**Works on a phone**

- Projects: create, open, delete, duplicate-safe storage. Autosaves after every edit.
- Import: system Photo Picker → video or photo. Duration probed once and stored, so a
  trim can be reverted without touching the file again.
- Preview: real ExoPlayer playback mapped to the clip's in/out points; stills decoded.
  Playhead follows playback; seeking pauses nowhere it shouldn't.
- Timeline: proportional blocks, drag to scrub, split at playhead, delete clip, reorder.
- Undo/redo across every edit; slider drags collapse into one undo step.
- Effects stack: add (search + categories + recent), reorder, toggle, duplicate, reset,
  remove, presets, per-parameter slider + numeric pill + keyframe diamond.
- Export: selected clip trimmed and transcoded to H.264/AAC MP4, progress, Share sheet.

**Tests** — 41 JVM tests: stack ops, timeline math (no gaps, min length, split edges),
project round-trip, corrupt-file safety, newer-field tolerance, sort order.

## Honest gaps (next milestones)

1. **No GPU effect renderer yet.** The stack is data + UI; export currently trims the
   source. The export sheet says this in the UI instead of pretending. This is the next
   and biggest piece (PLAN.md §6.6).
2. **Single video layer.** Audio lanes, text, shapes, groups exist in the model; their
   renderers do not.
3. **12 of ~185 effects** have schemas; each ships with its shader, never as a placeholder.
4. **No project settings UI** (aspect, fps, resolution) — model fields exist, screen does not.
5. **R8 off, debug key** — deliberate until an instrumented smoke test exists.
6. **Photos export as 3 s video** only when the renderer lands; for now export needs a video.

## Rules we do not break

1. Effects are universal: video, photo, text, sticker, shape, group, adjustment.
2. Every parameter is customisable; the inspector is generated from the schema.
3. Effects are never silently dropped — over budget, the preview proxy drops resolution.
4. Order is render order, and the stack is saved in the project file.
5. Permissive licences only (Apache-2.0 / MIT / BSD). No GPL/AGPL in the APK.
6. Nothing leaves the phone unless the user taps Share.
