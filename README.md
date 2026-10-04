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
- **32 original Hinglish stories** (23 teen-safe, 9 mature) with scenes, choices, branching, endings — including 20 ongoing "endless" romance-fantasy sagas.
- **New stories arrive without an app update** — new packs land in `content/manifest.json`
  (`contentVersion`), and existing installs pick them up automatically from the live story API
  (or straight from a story's page via its in-place **Download** button).
- **BYO AI** — configure your own OpenAI-compatible provider (OpenAI, OpenRouter, Groq, Together, custom). Key stays in device keystore.
- **APP LIMIT = NONE** — the app never caps chat. Provider quotas are your provider's.
- **Offline Story Mode** — fully playable scripted stories with zero network and zero key.
- **Age-safe catalog** — 12–17 users get a restricted catalog enforced in app logic (home, search, recommendations, downloads, direct opens).
- **Story API content system** — new stories arrive as JSON packages from
  `https://beyondredeye.site/api` (Cloudflare Worker), no app rebuild and no GitHub
  access from the app. The app auto-discovers newer packs on launch (Settings
  "New story alerts"), and each story page shows an in-place **Download** button
  for packs not yet on the device.
- **Story submissions + Media Gallery** — readers can **💡 Suggest an Idea** or **📖
  Submit a Complete Story** (form or JSON) from Settings, with a polished cover/gallery
  uploader. Every submission is **admin-reviewed and never auto-published**, gated by a
  global 50-submissions/24h limit and a 24h expiry. Complete stories must ship a **Media
  Library** (cover + gallery, character portraits, scenes); the story detail page renders
  it as a responsive, lazy-loading gallery with a full-screen lightbox. All 32 shipped
  stories are credited to **Ankit (verified)** with their real artwork in the gallery.
- **Player-name interpolation** — story text uses `{{playerName}}`, resolved at
  runtime to the locally stored nickname in narration, the pre-chat introduction,
  offline mode and AI prompts. Character names are never replaced (e.g. *Kabir* in
  *Chai, Dreams & Backbenchers* is a character, not the player).
- **Endless stories** — stories tagged `ongoing` never get final endings; the
  content validator rejects endings/`isEnding`/`endStory` for them. Legacy bundled
  stories keep their classic ending mechanics.
- **Universal memory engine (v2.5.1)** — a local story archive (raw messages, typed events,
  persistent relationship state per pair, character knowledge, contradictions, inverted index) with
  validated state transitions and meaning-based retrieval, on top of the sliding short-term window,
  episodic log, curated facts, cross-story preferences and rolling digest.
- **Backup/restore, local notifications, storage manager, AMOLED theme, sounds, haptics.**

---

## 🆕 Release notes

### v2.5.1 — Universal extreme memory architecture

- **Story memory that does not forget.** New local archive tables (`story_events`,
  `relationship_states`, `character_knowledge`, `memory_index`, `memory_contradictions`, schema v7)
  record *what happened*, *what is true now*, and *who knows what* — for every story, with no
  per-story rules.
- **Relationships persist and are validated.** `MC + Poonam = married` survives scene changes;
  a contradicting reply is rejected and flagged instead of silently rewriting story state.
- **Character-pair memory.** An important MC ↔ Bhabhi conversation stays retrievable through their
  pair even after other characters and locations take over.
- **Meaning-based local retrieval.** Concept lexicon + Hinglish aliases + stems + trigram fallback,
  an inverted index, multi-hop expansion (knowledge → event → raw messages) and chronological
  timeline output. No external/paid service.
- **Character perspective.** Knowledge is tracked per character with source and time, and injected as
  a map so nobody remembers what they never learned.
- **Lossless consolidation.** Old events fold into rollups; raw events and raw messages stay on disk.
- **Backward compatible.** Existing journeys are migrated once from their raw history; old backups
  import cleanly; the UI is unchanged.
- **State-leak fix hardened.** The `kissa-state` block (fenced, unfenced, multiple, malformed,
  unterminated or marker-less) is stripped in the response pipeline and can never reach the story text.

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
│  Content system              │  bundled JSON + story API manifest,
│  src/content/loader.ts       │  version compare, download cache
├──────────────────────────────┤
│  Local data                  │  SQLite (chats/state/memory/saves),
│  src/lib/db.ts               │  SecureStore (API keys), files (cache)
└──────────────────────────────┘
            NO backend. NO cloud DB. NO accounts.
```

### No-backend philosophy

- User data **never leaves the device** except in two user-initiated cases:
  1. Downloading **public** story files from the Kissa story API (`https://beyondredeye.site/api`, plain file fetch, no personal data).
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

### Story delivery: private repo → CI → story API → app (NO user database)

```
Kissa app / website
        │  HTTPS, public story content only
        ▼
https://beyondredeye.site/api/*        (Cloudflare Worker — worker/)
        │  serves CI-deployed assets
        ▼
GitHub Actions (deploy-api.yml)  ←— push to main (this private repo)
```

- `content/manifest.json` — content index (`contentVersion` + story metas).
- `content/stories/<id>/` — story packages (`story|characters|world|scenes|memory.json` + `assets/`).
- The Worker serves the manifest + packages + covers from its deployed static
  assets (built by `scripts/build-worker-assets.mjs`). The app fetches the
  manifest, compares versions, downloads newer packages, validates them,
  caches them — new stories still arrive **without an app update**.
- **No GitHub credentials ever reach the app, the website or the Worker
  bundle.** The repo is only read by CI (encrypted secrets, server-side).
- **Private user data is NEVER sent to the API or written to GitHub.** The
  API is content-only: no accounts, no chats, no memories, no keys.
- The API base is configured in exactly one place: `KISSA_CONTENT_API_BASE_URL`
  (app.json `extra`, default `https://beyondredeye.site/api`) — optionally
  overridden per-device via the `contentApiBaseUrl` setting.
- Deployment details & one-time Cloudflare setup: **docs/DEPLOYMENT.md**.

---

## 🧠 Memory: how the narrator keeps track

Memory is **local SQLite rows + local retrieval** — no vector store, no server, no embeddings,
no external service. Since **v2.5.1** it is a *layered story archive* rather than a newest-N
transcript: scene changes, app restarts and context trimming never erase it.

```
story ── messages        (raw archive, immutable — the highest-authority record)
       ├── events         (typed, importance-ranked, timeline-ordered)
       ├── relationships  (CURRENT state + full history, per character pair)
       ├── knowledge      (what each character knows, how and when they learned it)
       ├── contradictions (rejected state changes, kept for traceability)
       └── memoryIndex    (local inverted index → fast, meaning-based search)
```

| Layer | What | Lives in | Prompt budget |
|---|---|---|---|
| Short-term | last `shortTermWindow` messages (clamped 4–48, default 16) | `messages` | verbatim |
| Raw archive | every user/assistant turn, never overwritten | `messages` | on-demand (multi-hop evidence) |
| Events | marriage/promise/secret/discovery/conflict/decision/object/location… with importance + sources | `story_events` | ranked slice |
| Relationship state | persistent current status per pair (`married`, `dating`, or a story's own label) + history | `relationship_states` | always when relevant |
| Character knowledge | `Bhabhi knows X (told by Y, scene Z)` — characters can only act on what they know | `character_knowledge` | perspective-filtered |
| Episodic + curated | one durable trace per turn + narrator facts | `memories` | ranked + pinned |
| Preferences | what the reader reveals about themselves, shared across stories | `memories` scope `*` | pinned |
| World state | location, time, presence, numeric relationships, objects, threads | KV + SQLite mirror | compact state block |
| Digest / rollups | "story so far" + consolidated event clusters — accelerators, never replacements | `kv` + `story_events` rollups | pinned section |

Flow per send (`src/screens/Chat.tsx` → `src/lib/storyMemory.ts`):

1. **Write** — reader preferences and a user-only episode are persisted *before* the provider call
   (a timeout can never lose the turn). After the reply: `detectEvents()` classifies what actually
   happened, relationships go through `validateTransition()`, knowledge is attributed to whoever
   learned it, and everything is linked back to the raw message ids of that turn.
2. **Validate** — a proposed state change is compared with stored state. An established
   relationship cannot silently revert (e.g. `married → stranger` is rejected and recorded as a
   contradiction); a large jump with weak evidence is accepted but flagged. Only explicit,
   in-story break evidence (talaq/divorce/breakup/death) moves a relationship down.
3. **Retrieve** — the inverted index returns candidates for the current turn's tokens and
   concepts (Hinglish↔English lexicon, e.g. `tasveer` ↔ `photograph`), multi-hop expansion
   follows knowledge → source event → related pair interactions, and a bounded structural lane
   always carries open promises/decisions/secrets plus recent + high-importance events.
4. **Rank & inject** — relevance combines semantic overlap, character and pair relevance, location,
   scene, event type, importance, recency (history questions decay slower), unresolved status and
   confidence. The narrator receives a compact, source-tagged block (≤ ~4.2k chars) with a
   **CONTINUITY LAW** and a **CHARACTER KNOWLEDGE** map.
5. **Consolidate** — every 8th turn and on scene changes, old events fold into rollups (raw rows and
   raw messages stay; rollups resolve back to their source events on retrieval). Digest folding for
   the episodic log happens on the same cadence.

Isolation & privacy: every table is namespaced by `playthrough_id` **and** `story_id`, so a Poonam
story can never bleed into a Zara story. The archive is local-only; it is included in the user's own
export/import backup file and never uploaded anywhere. Stories played before v2.5.1 are migrated
once, in the background, from their existing raw messages and character packs (idempotent).

Flow per send (`src/screens/Chat.tsx` → `src/lib/memory.ts`):

1. The current reader preference is extracted and persisted **before** the provider call, while a user-only episodic row protects the turn from timeouts and rate limits.
2. `listRecentMessagesAsc(shortTermWindow + 8)` supplies headroom so the declared window is honoured in full.
3. `listMemoryCandidates()` unions newest, important, pinned **and archived** rows. Archived rows are eligible for strong-match resurrection, so a fact from turn 3 can still be reached at turn 900. The real SQLite query binds every scope parameter safely.
4. `selectRelevant()` (pure, in `src/lib/memoryCore.ts`) combines importance, weighted keyword overlap, Hinglish aliases/stems, recency, usefulness hits, provenance and confidence, then fills a **4600-character** budget (max 32 entries). Expiring temporary facts are ignored, and verbatim episodic copies already in the short-term window are not re-injected.
5. Selected rows are reinforced (`hits+1`, `importance+1 every 3rd hit`, capped at 9) — what gets used, sticks. Reader-authored facts receive a small trust edge without overpowering exact story matches.
6. After a successful response the pending episode is upgraded in place, avoiding duplicate user-only + complete-turn rows. Repeated or corrected facts dedupe through `UNIQUE(playthrough_id, hash)` and carry source/confidence metadata through backup/restore.
7. Every 8th turn — and on every scene change — `consolidateMemories()` folds the oldest log lines (and, past 240 curated facts, the oldest facts too) into the digest via a small AI call, with a deterministic no-AI fallback. Folded rows are only `archived = 1`: **nothing is ever deleted**, so recall can be re-expanded later.

Story packs steer this: `memory.json`'s `extractionHints` and `neverRemember` are injected as a
**MEMORY DISCIPLINE** block, while code-level PII protection remains active even if a provider
ignores instructions. Nothing in the engine is hard-coded per story — the same universal vocabulary,
relationship ladder, transition rules and ranker serve every pack.

Full architecture, guarantees and the v2.5.1 test/QA matrix: **docs/V2.5.1_MEMORY_ARCHITECTURE.md**.

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
  story.json        # title, role, setting, tone, ageRating, openingSceneId, safetyNotes,
                    #                  creator{name,avatar,verified}, media{cover,gallery[]}
  characters.json   # personality, voice, goals, sampleLine, knowledge…
  world.json        # premise, locations, factions, lore, RULES, objects
  scenes.json       # scenes: narration, choices{next,effects,requiresFlag}, endings
  memory.json       # shortTermWindow, seedMemories, extractionHints, neverRemember (all enforced)
  assets/           # cover.jpg + gallery/image-NN.jpg (referenced by story.media)
```

**Creator + Media** (added for the submission system): every story carries
`creator { name, avatar, verified }` — shipped stories are credited to
**Ankit (verified)** — and a `media` block: `cover` (a safe asset ref) plus an
ordered `gallery` of `{ id, file, kind, label }` entries (`kind` = `cover |
character-portrait | scene | other`; portraits can link a `characterId`).
References are **allowlisted** (`assets/cover.*`, `assets/gallery/image-NN.*`) —
no arbitrary paths — and validated by `content:validate`.

Key mechanics: `requiresFlag` (`"flag"` / `"!flag"`) gates choices; `effects` mutate
`relationships/inventory/location/flags/choices`; the AI reports changes via a hidden
` ```kissa-state {...} ` block that is parsed, validated, and stripped from display text.

**Player name**: write `{{playerName}}` wherever the story addresses the reader —
it resolves to the user's local nickname at render/prompt time (`src/lib/playerName.ts`).
Never hardcode a player name; character names are protected automatically.

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
# edit the TODOs in content/stories/my-story/, add assets/cover.jpg
npm run content:validate
```

`scaffold` pre-fills `creator { name: "Ankit", verified: true }` and a `media`
block pointing at `assets/cover.jpg`, so new stories validate out of the box.
Then commit `content/` → the shipped `contentVersion` in `manifest.json` auto-increments
→ users pick the pack up automatically from the live story API. The app validates every
download and discards malformed packages.

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

- `npm test` — unit tests (engine parsing/effects/matching, age-gate incl. fail-closed unknowns,
  search, and the full universal-memory suite: scene-change persistence, restarts, relationship and
  marriage persistence, character-pair memory, semantic + long-distance retrieval, timeline ordering,
  character knowledge, contradiction detection, state-transition validation, story isolation,
  consolidation, source tracking, migration and kissa-state stripping).
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
