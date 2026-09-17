# Kissa Content Worker — Deployment Guide

## One-time setup (first deploy)

The Worker lives under `worker/` and is deployed to Cloudflare via
[wrangler](https://developers.cloudflare.com/workers/wrangler/). Two pieces of
infrastructure are required for the Submission + Creator system to work:

### 1. Create the KV namespace

```bash
npx wrangler kv:namespace create KISSA_SUBMISSIONS
```

Copy the printed `id` into `worker/wrangler.jsonc` under
`kv_namespaces[0].id` (there is already a placeholder entry).
Also run the `preview` form for local/dev:

```bash
npx wrangler kv:namespace create KISSA_SUBMISSIONS --preview
```

…and paste that id as `preview_id`.

### 2. Set the admin token (secret)

```bash
npx wrangler secret put ADMIN_TOKEN
```

Paste a strong random value (≥ 32 chars). Anyone who holds this token can accept
or reject submissions. The Worker rejects any non-empty wrong token with 401
and uses a constant-time comparison to prevent timing attacks.

Do **not** commit this value to the repo. It lives only in Cloudflare.

### 3. Confirm the wrangler config

`worker/wrangler.jsonc` should already contain (IDs filled in by you):

```jsonc
{
  "name": "kissa-content-api",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-05",
  "kv_namespaces": [
    { "binding": "KISSA_SUBMISSIONS", "id": "<prod-id>", "preview_id": "<preview-id>" }
  ]
}
```

The deploy pipeline (`.github/workflows/deploy-api.yml`) runs
`npm run build` (which assembles `public/` from the `content/` directory) and
then `wrangler deploy` for you on every push to `main`.

## Local development

```bash
cd worker
npm install
npm run dev   # wrangler dev — serves API on localhost:8787
```

Without a KV binding, submissions fall back to an in-memory shim that is wiped
on cold start — fine for dev, not acceptable for production. When
`ADMIN_TOKEN` is unset all admin routes return 401 (safe default).

## Accepting submissions into the catalog

1. Open the app → Settings → **Admin Panel** (visible only in `__DEV__` builds
   by default; for production admin access, deploy a dev build or call the API
   directly).
2. Enter the admin token you set as `ADMIN_TOKEN` (saved in SecureStore on that
   device only).
3. For each pending complete story, tap **Accept & Publish**. The Worker:
   - Runs server-side pre-publish validation (age/content consistency, markup
     and JS-injection scanning, required scenes/chars) — invalid stories are
     rejected with a structured error, never published.
   - Stores the bundle in KV under `acc:<id>` (permanent, no TTL) and adds the
     id to `idx:acc_stories`.
   - Merges it into the live manifest within ≤15 seconds (manifest TTL) and
     serves the package via `/api/stories/community/<storyId>`.
4. Accepted **ideas** are recorded permanently in KV for the owner to write up;
   they never auto-publish.
5. **Rejected** submissions are deleted immediately and are never publicly
   visible.

Pending submissions auto-expire after 24 hours via KV TTL — no cron job needed.

## Security properties enforced server-side

- Global 50 submissions / 24h (UTC-aligned rolling window), enforced by an
  atomic KV counter — no client-side trust, no per-user accounting.
- Per-IP rate limiting (120 req/min via Cloudflare's `RATE_LIMITER` binding,
  in-isolate fallback).
- Creator-name sanitisation (≤60 chars, no markup/scripts).
- Client-supplied `creator.verified` is always stripped to `false` server-side;
  only "Ankit" (owner) carries `verified: true`, which is set at publish time
  from bundled data, never from input.
- Deep recursive walk of submitted JSON rejects executable hooks
  (`<script>`, `<iframe>`, `javascript:` URLs, any function values).
- Story directory slugs are allowlisted by regex; `..`, NUL, backslash, and
  encoded traversal are rejected before any filesystem/KV access.
- CORS restricted to known origins + localhost in dev.
- Error bodies never leak repo/deployment details.
- Pending and rejected submissions are **never** exposed via public endpoints;
  they live in separate KV keys (`sub:` vs `acc:`) and only the accepted index
  is merged into the public manifest.

## Acceptance checklist for prod

- [ ] KV namespace created and IDs populated in `wrangler.jsonc`.
- [ ] `ADMIN_TOKEN` secret set in Cloudflare.
- [ ] `npm run typecheck` and `npm test` green in both root and `worker/`.
- [ ] `npm run content:validate` green (all bundled stories pass schema).
- [ ] `wrangler deploy` succeeds; `GET /api/health` returns JSON with
      `submissions.remaining: 50`.
- [ ] Submit a test story from a dev build → accept via Admin Panel → confirm
      it appears in `GET /api/manifest` within 15 seconds and
      `GET /api/stories/community/<id>` returns the bundle with
      `source: "community"` and `creator.verified: false`.
