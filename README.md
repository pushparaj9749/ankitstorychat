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
- **6 original Hinglish stories** (4 teen-safe, 2 mature) with scenes, choices, branching, endings.
- **BYO AI** — configure your own OpenAI-compatible provider (OpenAI, OpenRouter, Groq, Together, custom). Key stays in device keystore.
- **APP LIMIT = NONE** — the app never caps chat. Provider quotas are your provider's.
- **Offline Story Mode** — fully playable scripted stories with zero network and zero key.
- **Age-safe catalog** — 12–17 users get a restricted catalog enforced in app logic (home, search, recommendations, downloads, direct opens).
- **GitHub content system** — new stories arrive as JSON packages, no app rebuild.
- **Memory engine** — short-term window + story/character/world/preference memories + state effects.
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
| Playthroughs, messages, memories | SQLite tables |
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
  memory.json       # shortTermWindow, seedMemories, extractionHints, neverRemember
  assets/           # cover.png etc.
```

Key mechanics: `requiresFlag` (`"flag"` / `"!flag"`) gates choices; `effects` mutate
`relationships/inventory/location/flags/choices`; the AI reports changes via a hidden
` ```kissa-state {...} ` block that is parsed, validated, and stripped from display text.

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
npm test            # jest (29 tests: engine, age-gate, search, ALL story content)
npm run content:validate
npx expo start      # scan with Expo Go, or press `a` for emulator
```

Project layout: `src/{screens,components,navigation,state,lib,content,legal,theme,types}` ·
`content/` · `assets/` · `scripts/` · `website/` · `.github/workflows/` · `__tests__/`.

---

## 📦 APK build

**Automated, zero secrets** (`.github/workflows/android.yml`):

```
push to main / tag v*  →  npm ci  →  expo prebuild  →  Gradle assembleDebug
→ APK artifact  →  (tags only) GitHub Release with APK attached
```

- Every `main` push produces a downloadable `kissa-apk` artifact (30-day retention).
- Every `v*` tag (e.g. `v1.0.0`) creates a **Release** with `kissa-vX.Y.Z.apk`.
- The website's **DOWNLOAD APK** button auto-points at the latest release APK.

### APK build & signing (important)

- The pipeline builds a **debug-signed APK**: installable on any Android 8.0+ device, perfect for beta distribution. No secrets required.
- For Play Store / production: add release signing with encrypted secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`), switch the workflow to `assembleRelease`, and never print secrets in logs. See `android.yml` comments.

### Required secrets

| Secret | Required? | Purpose |
|---|---|---|
| _(none)_ | — | Debug APK pipeline needs zero secrets |
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
