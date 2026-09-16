# Kissa story content API (Cloudflare Worker)

Serves public story content for the Kissa app + website from static assets that
CI deploys together with this Worker. The private GitHub repository is read only
by the deployment pipeline — this Worker never contacts GitHub and holds no
credentials. It is a **content-only** API: no users, no chats, no memories,
no keys, nothing personalized ever reaches it.

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
