# AnkitCutz — Android video editor

Phone-only video editor. Kotlin + Jetpack Compose, `minSdk 26`, portrait, no network.

```
editor/
  PLAN.md            product plan, effects catalogue, budget rules
  design/            DESIGN.md + 21 approved screens (JPG/PNG)
  app/               the Android app
    src/main/java/site/beyondredeye/ankitcutz/
      MainActivity.kt         single activity, edge-to-edge
      ui/App.kt               shell <-> effects stack
      ui/editor/              editor shell, effect stack, add-effect sheet, editor state
      ui/theme/               tokens, dark Material3 scheme, type scale
      model/                  Layer, Effect schema, EffectStack (pure, unit-tested)
    src/test/java/.../model/  EffectStackTest
```

## Build

Needs **JDK 17** and the **Android SDK** (`ANDROID_HOME`), plus Gradle wrapper
(committed). Nothing else — no secrets, no backend, no keys.

```bash
cd editor
./gradlew testDebugUnitTest     # effects stack, no emulator needed
./gradlew assembleDebug         # app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug          # to a connected phone
```

The debug APK installs and runs standalone; it does not need a dev server.

### CI

`.github/workflows/editor-apk.yml` runs the tests, builds the debug APK and uploads
`ankitcutz-debug-apk` on every push that touches `editor/`, on pull requests, and by
manual dispatch. This is the canonical build — download the artifact and sideload it.

The Expo app in this repo (Kissa) ignores `editor/**`; the two never ship together.

## Week 1 scope (done)

- Design tokens, dark-only Material3 theme, type scale — DESIGN.md §1.
- Editor shell — top bar, preview, scrub, transport, ruler, fixed panel band, five
  bottom tabs (screen 16–18). Panel switching never resizes the preview.
- Effects stack — expandable rows, power toggle, drag handle, long-press menu
  (reset / duplicate / move / remove), `N passes` budget chip (screen 19).
- Add-effect sheet — search across name *and* category, category chips, recently used,
  add-with-defaults then auto-expand (screen 20).
- Schema-generated inspector — slider + numeric pill + keyframe diamond per numeric
  param, choice rows for enums/colours, preset chips, one undo entry per drag
  (screen 21).
- Model — immutable `Layer`, `EffectSchema` with typed params and pass cost,
  pure `EffectStack` (add/remove/duplicate/move/toggle/param/keyframe/preset/pass
  budget) with 20 JUnit tests.
- Undo/redo with slider-drag coalescing.

## Not yet (honest list)

- No decoder and no renderer: the preview is a placeholder, so effects are data and UI
  only. GLES pipeline lands in Week 2–4 (`PLAN.md` §6.6).
- 12 of the ~185 planned effects have schemas; each shader is added with its schema so
  nothing in the picker is decorative.
- Media import, timeline gestures, text/fonts, export, projects — later weeks.

## Rules we do not break

1. Effects are universal: video, photo, text, sticker, shape, group, adjustment.
2. Every parameter is customisable; the inspector is generated from the schema.
3. Effects are never silently dropped — over budget, the preview proxy drops resolution,
   not effects.
4. Order is render order, and the stack is saved in the project file.
5. Permissive licences only (Apache-2.0 / MIT / BSD). No GPL/AGPL in the APK.
