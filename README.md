# Kissa 📖 — Tumhari kahani, tumhare words

**Local-first AI interactive story chat.** No backend. No accounts. No coins. No message limits.

Kissa is an original interactive-fiction app: you play the main character in cinematic
Hinglish stories, chatting freely or picking choices while AI (or the offline storyteller)
moves the tale forward — with memory, relationships, branching, and multiple endings.

> **Original work.** Kissa has its own branding, UI, stories, characters, art, and sounds.
> It is not affiliated with, and copies nothing from, any other story-chat app.

---

## ✨ Highlights

- **100% local-first** — profile, chats, memories, saves, favorites, settings on-device (SQLite + SecureStore). No login, no cloud user DB.
- **22 original Hinglish stories** (19 teen-safe, 3 mature) with scenes, choices, branching, endings — including 10 ongoing "endless" romance-fantasy sagas.
- **New stories arrive without an app update** — `content/manifest.json` v3 added 5 full story packs
  (Hawa-Band Dhaba, Crush on the Roof, Pani @ 72, Gully Final, Night Courier); existing installs get them
  from **Settings → Content Updates**, or straight from the story page ("Download" button).
- **BYO AI** — configure your own OpenAI-compatible provider (OpenAI, OpenRouter, Groq, Together, custom). Key stays in device keystore.
- **APP LIMIT = NONE** — the app never caps chat. Provider quotas are your provider's.
- **Offline Story Mode** — fully playable scripted stories with zero network and zero key.
- **Age-safe catalog** — 12–17 users get a restricted catalog enforced in app logic (home, search, recommendations, downloads, direct opens).
- **GitHub content system** — new stories arrive as JSON packages, no app rebuild.
  `contentVersion` **3** ships 5 fresh packs: *Hawa-Band Dhaba*, *Crush on the Roof*,
  *Pani @ 72*, *Gully Final*, *Night Courier* — download them from **Settings → Content
  Updates**, or straight from a story's page (an in-place **Download** button appears for
  not-yet-installed stories).
- **Memory engine** — sliding short-term window + per-turn episodic log + curated story/character/world
  facts + cross-story preferences + a rolling "story so far" digest, all ranked into the prompt per turn.
- **Backup/restore, local notifications, storage manager, AMOLED theme, sounds, haptics.**

---

## 🏗 Architecture

```
┌──────────────────────────────┐
│  React Native + Expo (TS)    │  UI: screens, components, navigation
│  src/screens  src/components │
├──────────────────────────────┤
│  Story engine                │  prompt builder, context selection,
│  src/lib/engine.ts           │  kissa-state parsing, effects
├──────────────────────────────┤
│  AI layer (OpenAI-compat)    │  user key from SecureStore,
│  src/lib/ai.ts               │  typed errors, retry/test
├──────────────────────────────┤
│  Offline storyteller         │  scripted scenes walk, keyword
│  src/lib/offlineEngine.ts    │  matching, fallbacks, endings
├──────────────────────────────┤
│  Content system              │  bundled JSON + GitHub manifest,
│  src/content/loader.ts       │  version compare, download cache
├──────────────────────────────┤
│  Local data                  │  SQLite (chats/state/memory/saves),
│  src/lib/db.ts               │  SecureStore (API keys), files (cache)
└──────────────────────────────┘
            NO backend. NO cloud DB. NO accounts.
```

### No-backend philosophy

- User data **never leaves the device** except in two user-initiated cases:
  1. Downloading **public** story files from GitHub (plain file fetch, no personal data).
  2. Chat requests to **your own configured AI provider** (required for it to reply).
- There is no Kissa server, no analytics SDK, no push service, no tracking.

### Local storage map

| Data | Where |
|---|---|
| Profile, settings, stats, KV | SQLite `kv` |
| Playthroughs, messages, memories | SQLite tables (`memories`: hash/hits/archived, schema v4) |
| Favorites, downloads, provider *metadata* | SQLite tables |
| API keys | SecureStore (Keystore/Keychain) |
| Downloaded story JSON | `documentDirectory/kissa-content/` |
| Export files (temp) | cache dir, shared via OS sheet |

### GitHub = content/source repo, NOT a user database

- `content/manifest.json` — content index (`contentVersion` + story metas).
- `content/stories/<id>/` — story packages (`story|characters|world|scenes|memory.json` + `assets/`).
- The app fetches the manifest, compares versions, downloads newer packages, validates them, caches them.
- **Private user data is NEVER written to GitHub.** Only public story content lives here.

---

## 🧠 Memory: how the narrator keeps track

Memory is **local SQLite rows + retrieval scoring** — no vector store, no server, no embeddings.

| Layer | What | Lives in | Prompt budget |
|---|---|---|---|
| Short-term | last `shortTermWindow` messages (clamped 4–48, default 16) | `messages` | verbatim |
| Episodic | one auto-logged line **every turn** (`U: … \| …`) | `memories` kind=`episode`, importance 1 | ranked |
| Curated | facts the narrator volunteered in the hidden state block (`"memory"` array) | `memories` kind=`story`, importance 3 | ranked + pinned |
| Preferences | what the reader reveals about themselves (regex, works offline) | `memories` kind=`preference`, scope `*` | pinned |
| Digest | rolling "story so far", folded from the oldest lines | SQLite `kv` → `memsum:<playthroughId>` | pinned section |

Flow per send (`src/screens/Chat.tsx` → `src/lib/memory.ts`):

1. `listRecentMessagesAsc(shortTermWindow + 8)` — headroom so the declared window is honoured in full.
2. `listMemoryCandidates()` — UNION of three buckets (160 newest / 160 highest-importance / all pinned),
   so a fact from turn 3 is still reachable at turn 900. Never `LIMIT newest-N`.
3. `selectRelevant()` (pure, in `src/lib/memoryCore.ts`) scores every candidate as
   `importance*2 + weighted keyword overlap with the last 3 turns + recency decay (12-day half-life) + hits`,
   then fills a **3800-char** budget (max 28 entries). The digest and preferences always ride along.
4. Selected rows are **reinforced** (`hits+1`, `importance+1` every 3rd hit, capped at 9) — what gets used, sticks.
   Matching is vowel-folded + 4-char stemmed, so "waada"/"wada" and "Myraa"/"myra" hit the same fact.
5. `putMemory()` refuses anything that looks like real-world PII and dedupes on the `UNIQUE(playthrough_id, hash)` index, so a repeated fact strengthens the existing row instead of duplicating it.
6. Every 8th turn — and on every scene change (12-line threshold) — `consolidateMemories()` folds the oldest 30 log lines (and, past 240 curated facts, the
   oldest ones too) into the digest — via a small AI call, with a deterministic no-AI fallback. Folded rows are
   only `archived = 1`: **nothing is ever deleted**, so recall can be re-expanded later.

Story packs steer this: `memory.json`'s `extractionHints` and `neverRemember` are injected as a
**MEMORY DISCIPLINE** block, so each pack decides what is worth remembering (and privacy stays enforced in code too).

### 👁 Viewing and editing memory (`src/screens/Memory.tsx`)

Reachable from the chat header (🧠), Story Detail ("Kya yaad hai") and each row in Saves. It shows the
digest, live facts (with strength + how often they were reused), the turn log and the reader-level
preferences, plus the folded rows. Per row: 📌 pin (importance 9), 🗑 forget just that fact, ↩︎ bring a
folded fact back. "Forget everything" clears memory but keeps the chat — the reader can always correct
the narrator without losing progress.

---

## 🤖 AI add-on system

`Settings → AI Add-ons` → add provider: **name, base URL, model, API key** (+ Test connection).

- Provider abstraction is OpenAI-compatible (`POST {baseUrl}/chat/completions`), so many providers work unchanged. Presets included.
- Keys are read from SecureStore **at call time** and never logged or persisted elsewhere.
- Errors are typed (`invalid_key`, `rate_limit`, `timeout`, …) with **Retry / Settings / Go Offline** UI. The app never crashes on provider failure.
- Per-chat mode toggle: 🤖 AI ↔ 📖 Offline.

---

## 📚 Story format

```
content/stories/<id>/
  story.json        # title, role, setting, tone, ageRating, openingSceneId, safetyNotes
  characters.json   # personality, voice, goals, sampleLine, knowledge…
  world.json        # premise, locations, factions, lore, RULES, objects
  scenes.json       # scenes: narration, choices{next,effects,requiresFlag}, endings
  memory.json       # shortTermWindow, seedMemories, extractionHints, neverRemember (all enforced)
  assets/           # cover.png etc.
```

Key mechanics: `requiresFlag` (`"flag"` / `"!flag"`) gates choices; `effects` mutate
`relationships/inventory/location/flags/choices`; the AI reports changes via a hidden
` ```kissa-state {...} ` block that is parsed, validated, and stripped from display text.

### Story text format (how lines are written *and* rendered)

Every narration line in `scenes.json` — and everything the AI is asked to reply with —
uses one format:

```
*Beena ke honton par halki si muskaan ubharti hai. Raja darwaaze ke paas khamosh khada hai.*   <- action
Beena: "Achchha. Zubaan mein dum toh hai tumhare."                                            <- dialogue
```

- `*asterisked*` text is **action / scene-setting**: the chat UI renders it **faded + italic**
  (`FADED_TEXT_OPACITY` in `src/theme.ts`), the markers are never shown.
- `Name: "dialogue"` becomes a bubble with the character's name as its speaker label
  (offline mode matches the prefix against that story's real character list, so
  `Problem: sab kuch bigad gaya` never invents a character called *Problem*).
- Opening narration is rendered in the **same bubble** as the dialogue below it, so the top of
  a new story reads exactly like the rest of the conversation. `✦ Scene Title` stays a chapter
  divider.
- Pure logic lives in `src/lib/markup.ts` (`parseStoryMarkup`, `stripStoryMarkup`,
  `splitSpeakerLine`) — covered by `__tests__/markup.test.ts`, `__tests__/storyFormat.test.ts`
  and `__tests__/chatRender.test.tsx` (renders the real `ChatBubble`).

### Adding a new story (no app rebuild)

```bash
node scripts/new-story.mjs --id my-story --title "My Story" --age 12-17 --genre Mystery
# edit the TODOs in content/stories/my-story/, add assets/cover.png
npm run content:validate
```

Then commit `content/` → bump shipped in `manifest.json` (`contentVersion` auto-increments) → users get it via **Content Updates**. The app validates every download and discards malformed packages.

---

## 🚀 Development setup

Requires Node 22. Android builds need Java 17 + Android SDK (handled in CI).

```bash
npm ci
npm run typecheck   # tsc --noEmit
npm test            # jest (engine, age-gate, search, markup, story format, chat UI, ALL story content)
npm run content:validate
npx expo start      # scan with Expo Go, or press `a` for emulator
```

Project layout: `src/{screens,components,navigation,state,lib,content,legal,theme,types}` ·
`content/` · `assets/` · `scripts/` · `website/` · `.github/workflows/` · `__tests__/`.

---

## 📦 APK build

**Automated, zero secrets** (`.github/workflows/android.yml`):

```
push to main / tag v*  →  npm ci  →  expo prebuild  →  Gradle assembleRelease
→ verify assets/index.android.bundle  →  APK artifact  →  (tags only) GitHub Release with APK attached
```

- Every `main` push produces a downloadable `kissa-apk` artifact (30-day retention).
- Every `v*` tag (e.g. `v1.0.0`) creates a **Release** with `kissa-vX.Y.Z.apk`.
- The website's **DOWNLOAD APK** button auto-points at the latest release APK.

### Why `assembleRelease` and not `assembleDebug`

React Native's Gradle plugin **skips JS bundling for debuggable variants**
(`debuggableVariants` defaults to `["debug"]`). A `./gradlew assembleDebug` APK
therefore ships with **no `assets/index.android.bundle`** — install it on a phone
and it only works while a Metro dev server is reachable, otherwise it dies at
startup with:

```
Unable to load script. Make sure you're running Metro or that your bundle
'index.android.bundle' is packaged correctly for release.
```

The CI pipeline builds the **release** variant instead, which embeds the JS
bundle, and signs it with the auto-generated debug keystore — so the artifact is
a standalone, installable APK that needs no PC, no Metro and no secrets. The
workflow also has a **"Verify JS bundle is packaged"** step that fails the build
if the bundle is ever missing again (regression guard for exactly this crash).

### APK build & signing (important)

- The pipeline builds a **release-configured APK signed with the debug keystore**: installable on any Android 8.0+ device, perfect for beta distribution. No secrets required.
- Running from source during development is different: `npm start` (Metro) + `a` in the Expo CLI, or `npm run android` — a **debug** build on your device loads JS from Metro on your machine, so keep it running and keep the phone on the same Wi-Fi (or `adb reverse tcp:8081 tcp:8081` over USB).
- For Play Store / production: add real release signing with encrypted secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) and never print secrets in logs. See `android.yml` comments.

### Build the installable APK locally

```bash
npm ci
npx expo prebuild --platform android --no-install   # generates ./android (gitignored)
cd android && ./gradlew assembleRelease && cd ..
# → android/app/build/outputs/apk/release/app-release.apk  (install this one)
```

### Required secrets

| Secret | Required? | Purpose |
|---|---|---|
| _(none)_ | — | APK pipeline needs zero secrets (signed with the debug keystore) |
| `GITHUB_TOKEN` | Auto-provided | Release publishing (built-in) |
| `ANDROID_KEYSTORE_*` | Only for future signed releases | Play Store signing (not yet configured) |

### Release process

1. Bump `version` in `package.json` + `app.json` (+ `android.versionCode`).
2. Merge to `main` (CI + APK must be green).
3. `git tag v1.x.y && git push origin v1.x.y` → Release appears with APK.
4. Website button updates automatically (no deploy needed).

---

## 🌐 GitHub Pages website

Static site in `website/` (no backend): branding, live story list (fetched from
`content/manifest.json`), features, privacy, terms summary, AI explainer, **DOWNLOAD APK**
(resolves the latest release's `.apk` via the GitHub API, falls back to the releases page).

Deploys via `.github/workflows/pages.yml` on pushes to `main` touching `website/`.
Enable Pages once in repo settings (Settings → Pages → Source: **GitHub Actions**).
The workflow self-enables Pages if a `PAGES_ADMIN_TOKEN` secret (PAT with repo
scope or Pages write) is configured; otherwise it fails fast with a link to the
settings page.

---

## 🧪 Testing

- `npm test` — unit tests (engine parsing/effects/matching, age-gate incl. fail-closed unknowns, search).
- `npm run content:validate` — validates manifest + **every** story package (fields, ratings, scene graph, reachability, choice targets, cross-file consistency).
- `npm run typecheck` — strict TS.
- Manual QA checklist (first launch → onboarding → teen filter → story → chat → choices → branching → memory → saves/replay → favorites → search → AI config + bad key + offline → updates → notifications → export/import → terms/privacy → APK → site) — see CI + this README; all flows implemented and wired.

---

## 🔧 Troubleshooting

| Symptom | Fix |
|---|---|
| `API key rejected` | Re-paste key in AI Add-ons → Test. Keys are never exported in backups. |
| `Model not found` | Check model name/base URL (404 = wrong model or endpoint). |
| `Rate limited` | Provider quota — wait/retry, or switch to Offline Mode (free forever). |
| Stories won't update | Needs internet to fetch manifest; downloaded stories still work offline. |
| `expo-notifications` in Expo Go | Local notifications work on device; permission must be granted. |
| Gradle build fails locally | Use CI (Java 17 + SDK + NDK preconfigured). Locally: `npx expo prebuild`, then open `android/` in Android Studio. |

---

## 📄 License

MIT — see [LICENSE](LICENSE). Stories, art, and sounds are original works created for Kissa.
