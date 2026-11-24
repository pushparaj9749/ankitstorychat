# Kissa story content API (Cloudflare Worker)

Serves public story content for the Kissa app + website from static assets that
CI deploys together with this Worker. The private GitHub repository is read only
by the deployment pipeline — this Worker never contacts GitHub and holds no
credentials.

From v2.14 it also hosts the **account + submission** API (Cloudflare D1):

- `accounts` — username + password only. No email is ever collected, so
  recovery is a one-time code shown at signup, a same-device reset, or an
  admin-approved request. Passwords/recovery codes are PBKDF2-SHA256; session
  tokens are stored only as SHA-256.
- `submissions` — the durable record of every idea/story (status, title,
  creator) powering "My Submissions" and the admin account view. KV still holds
  the review pipeline and the published community packages.
- `notifications` — acceptance ("agli 3 ghante me live") and team messages for
  the Home bell; `recovery_requests` + `app_config` (minimum app version).

Chats, memories, saves, settings and AI keys are **device-only** and are never
sent to this Worker.

```
POST /api/auth/signup | /api/auth/login | /api/auth/logout
GET  /api/auth/me | /api/auth/username?u=… | /api/me
POST /api/auth/recovery | /api/auth/device-reset | /api/auth/recovery-rotate
PATCH/DELETE /api/me | POST /api/me/claim
GET  /api/me/submissions | /api/me/notifications
POST /api/me/notifications/<id> | /api/me/notifications/read
GET  /api/app/version                      (minimum supported version)
GET  /api/admin/accounts | /api/admin/accounts/<id>
POST /api/admin/accounts/<id>/notify
GET  /api/admin/recovery | POST /api/admin/recovery/<id>/(approve|reject)
POST /api/admin/version
```

Deploys create/migrate the D1 database (`scripts/ci-d1-setup.cjs`) and inject
its id into `wrangler.jsonc`, exactly like the KV namespace — no ids are
committed.

```
GET /api/health
GET /api/manifest                          Cache-Control: max-age=60, s-maxage=300
GET /api/stories/<dir>                     whole package in one JSON
GET /api/stories/<dir>/<file>              story.json | … | assets/cover.jpg|png
GET /api/covers/<name>.jpg                 APK cover art (website fallback)
```

Security model:

- Story dirs come from the deployed manifest (allowlist); file names are a fixed
  set — traversal/unknown paths can never reach the asset layer (`src/router.ts`).
- CORS restricted to `beyondredeye.site`, `www.beyondredeye.site`,
  `pushparaj9749.github.io` (+ localhost for dev). No Origin (native app) is fine.
- Per-IP rate limiting: Cloudflare rate-limit binding when configured, in-isolate
  fallback otherwise (120 req/min).
- Errors are clean JSON (`{"error":"not_found"}`) and never leak internals.
- Direct access to the raw `/content/*` and `/covers/*` asset dirs is blocked —
  content is served only through `/api/*`.
- Non-API paths serve the static website (for full-domain Cloudflare hosting).

Commands:

```bash
npm run build:assets   # assemble ../content + ../assets/covers + ../website → public/
npm test               # build + unit tests (routing, CORS, limits, errors)
npm run typecheck
npm run dev            # local worker on :8787
npm run deploy         # wrangler deploy (needs CLOUDFLARE_API_TOKEN/ACCOUNT_ID)
```

One-time Cloudflare/DNS setup and required GitHub secrets: see `docs/DEPLOYMENT.md`.


## Retrying a failed deploy

`Re-run all jobs` is disabled for runs created before a workflow-file change
(GitHub refuses with *"its workflow file may be broken"*). The workflow is
`workflow_dispatch`-enabled, so either run it manually from **Actions → Deploy
story API (Cloudflare Worker) → Run workflow**, or push any commit touching
`worker/**`, `content/**`, `scripts/**`, `website/**` or the workflow file
itself — a push always starts a fresh run.

If the D1 step fails with `Cloudflare API 401`, the token lacks **Account · D1 ·
Edit** (see `docs/DEPLOYMENT.md`); everything else in the pipeline is
idempotent, so a retry is always safe.
