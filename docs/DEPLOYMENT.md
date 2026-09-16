# Deployment — Kissa story API (beyondredeye.site)

Story delivery: **private repo → GitHub Actions → Cloudflare Worker → app/website**.
The app and website only ever talk to `https://beyondredeye.site/api/*`.
No GitHub credential reaches any client; the API is content-only (no user data).

## What is already in the repo

| Piece | Where |
|---|---|
| Worker code + tests | `worker/` (`npm test`, `npm run typecheck`, `npm run dev`) |
| Deploy bundle builder | `scripts/build-worker-assets.mjs` (content + covers + website → `worker/public/`) |
| CI: tests + content validation | `.github/workflows/ci.yml` |
| CI: build → validate → deploy | `.github/workflows/deploy-api.yml` |
| App-side API config | `KISSA_CONTENT_API_BASE_URL` in `app.json` → `src/content/api.ts` |

API endpoints (all GET, clean JSON errors, CORS limited to Kissa origins,
per-IP rate limiting):

```
/api/health
/api/manifest
/api/stories/<storyDir>                 → whole package as one JSON
/api/stories/<storyDir>/<file>          → story.json | characters.json | world.json
                                           scenes.json | memory.json | assets/cover.jpg|png
/api/covers/<name>.jpg                  → APK cover art (website fallback)
```

## Required GitHub secrets (Settings → Secrets and variables → Actions)

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare token with **Workers Scripts:Edit** (+ Account:Read). Create at dash.cloudflare.com/profile/api-tokens → "Edit Cloudflare Workers" template. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id (Workers & Pages overview, right sidebar). |

The deploy job **fails with these exact names** if they are missing — no insecure fallback.

## Manual Cloudflare steps (one-time; needs account access)

1. **Add the site**: Cloudflare dashboard → *Add a domain* → `beyondredeye.site`
   (Free plan is fine) → accept the nameservers it gives you.
2. **DNS**: keep the existing records so GitHub Pages keeps serving the site:
   `A @ → 185.199.108.153 / .109 / .110 / .111` and
   `CNAME www → pushparaj9749.github.io`. Set both to **Proxied (orange cloud)**.
   (In GitHub repo Settings → Pages → Custom domain, ensure `beyondredeye.site`
   is listed and "Enforce HTTPS" is on.)
3. **Deploy the Worker**: push to `main` (or run the *Deploy story API* workflow).
   With the two secrets above this creates/updates the `kissa-content-api` Worker
   and uploads the content+website assets.
4. **Route the API**: applied automatically — the `routes` in
   `worker/wrangler.jsonc` (`beyondredeye.site/api/*` and
   `www.beyondredeye.site/api/*`) are (re-)attached on every deploy by
   `wrangler` (the "Edit Cloudflare Workers" token template includes
   Zone → Workers Routes → Edit). Verify in Cloudflare → Workers & Pages →
   `kissa-content-api` → *Settings → Domains & Routes*. If the token lacks
   route permission, add the route there manually instead.
5. **Verify**: `curl https://beyondredeye.site/api/health` →
   `{"ok":true,"service":"kissa-content-api","contentVersion":5}`.
   The website at `https://beyondredeye.site/` keeps working (GitHub Pages via
   the proxied DNS records).
6. *(Optional, recommended)* **WAF rate-limit rule**: Security → WAF → Rate limiting
   rules → `http.request.uri.path contains "/api/"` → e.g. 300 requests / minute
   per IP → Block. Adds edge-wide abuse protection on top of the Worker limiter.

## Going fully private (phase 2)

The repository currently ships APK downloads + GitHub Pages via public releases,
so make it private **only after** the steps above are live:

- **Repository → private** (Settings → General → Danger Zone). Note:
  - GitHub Pages on a private repo needs a **paid plan**. Alternative: the Worker
    already deploys the website — flip DNS fully to Cloudflare by adding a second
    route `beyondredeye.site/*` for `kissa-content-api` (or a custom domain on
    the Worker) and the site serves from the Worker.
  - **APK downloads**: release assets of a private repo are not publicly
    downloadable and the website's latest-release button would break. Either
    keep releases public (separate public artifacts), host the APK elsewhere
    (e.g. Cloudflare R2), or link the releases page for signed-in users.
- The story pipeline itself needs **no change**: CI reads the private repo with
  the built-in `GITHUB_TOKEN` and deploys to the Worker — that is the whole point
  of this architecture.

## Local development

```bash
cd worker
npm install
npm run dev        # builds worker/public from the repo, serves at localhost:8787
curl localhost:8787/api/health
```

Point the app at a local worker via `app.json`
`extra.KISSA_CONTENT_API_BASE_URL` (e.g. `http://localhost:8787/api`) or the
`contentApiBaseUrl` setting.
