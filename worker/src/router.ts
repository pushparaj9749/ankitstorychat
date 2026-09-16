/**
 * Kissa story content API — request handling & pure routing logic.
 *
 * Exported freely for unit tests; only src/index.ts is the workerd entry.
 *
 * Serves PUBLIC story content (manifest + story packages + cover art) from
 * static assets that are deployed together with this Worker by GitHub
 * Actions (see .github/workflows/deploy-api.yml). The private GitHub
 * repository is only ever read by that deployment pipeline — never by this
 * Worker at runtime and never by clients.
 *
 * This is a CONTENT-ONLY API:
 *   - no user accounts, no user data, no chats, no memories, no API keys;
 *   - it never receives anything personal from the app;
 *   - every response is public story content.
 *
 * Routes (all under /api):
 *   GET /api/health
 *   GET /api/manifest
 *   GET /api/stories/:storyDir            (whole package in one JSON)
 *   GET /api/stories/:storyDir/:file      (story.json | characters.json |
 *                                           world.json | scenes.json |
 *                                           memory.json | assets/cover.jpg|png)
 *   GET /api/covers/:name.jpg             (APK cover art, website fallback)
 *
 * Security properties:
 *   - story directories and file names are strictly allowlisted (the deployed
 *     manifest is the source of truth) — no path traversal, no arbitrary file
 *     access, no proxying of arbitrary URLs or repositories;
 *   - CORS is restricted to the Kissa app/site origins;
 *   - per-IP rate limiting (Cloudflare rate-limit binding when available,
 *     in-isolate fallback otherwise);
 *   - errors are clean JSON and never leak repository or deployment details.
 */

export interface Env {
  /** Workers static assets binding (deployed content + website). */
  ASSETS: Fetcher;
  /** Cloudflare rate limiting binding (optional; configured in wrangler). */
  RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
}

/* ---------------- configuration ---------------- */

const ASSETS_ORIGIN = 'https://kissa-assets.internal';

/** Sites allowed to call the API from a browser (CORS). */
const ALLOWED_ORIGINS = new Set([
  'https://beyondredeye.site',
  'https://www.beyondredeye.site',
  'https://pushparaj9749.github.io',
]);

/** Local development origins (wrangler dev / local static servers). */
const DEV_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Single story JSON files the API may serve. */
const STORY_FILES = new Set([
  'story.json',
  'characters.json',
  'world.json',
  'scenes.json',
  'memory.json',
]);

/** Story asset files (covers) the API may serve. */
const STORY_ASSET_FILES = new Set(['assets/cover.jpg', 'assets/cover.png']);

/** APK cover art names (/api/covers/<name>). */
const COVER_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}\.(jpg|png)$/;

/** Story directory ids: lowercase slugs only. */
const STORY_DIR_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Rate limiting (per IP). */
export const RATE_LIMIT = 120;
export const RATE_WINDOW_MS = 60_000;

/** Cache-Control policies. */
const CACHE_MANIFEST = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const CACHE_STORY = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
const CACHE_COVER = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800';

const JSON_TYPE = 'application/json; charset=utf-8';

/* ---------------- helpers ---------------- */

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': JSON_TYPE, ...headers },
  });
}

/** Clean, safe error body. Never includes internals. */
export function errorJson(
  status: number,
  code: string,
  message?: string,
  headers: Record<string, string> = {},
): Response {
  const body: Record<string, string> = { error: code };
  if (message) body.message = message;
  return json(body, status, headers);
}

/** CORS headers for an allowed origin (empty when no Origin was sent). */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  if (!ALLOWED_ORIGINS.has(origin) && !DEV_ORIGIN_RE.test(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/* ---------------- rate limiting ---------------- */

/** Best-effort in-isolate fallback limiter (per worker isolate). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function inMemoryRateLimit(key: string, now = Date.now()): boolean {
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  b.count += 1;
  return b.count <= RATE_LIMIT;
}

/** Test-only: clear the in-isolate buckets. */
export function resetRateLimiterForTests(): void {
  buckets.clear();
}

async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
  const rl = env.RATE_LIMITER;
  if (rl) {
    try {
      return (await rl.limit({ key: ip })).success;
    } catch {
      // Binding misconfigured — fall back rather than fail closed on content.
    }
  }
  return inMemoryRateLimit(ip);
}

/* ---------------- routing ---------------- */

export type ApiRoute =
  | { kind: 'health' }
  | { kind: 'manifest' }
  | { kind: 'story-package'; storyDir: string }
  | { kind: 'story-file'; storyDir: string; file: string }
  | { kind: 'cover'; name: string }
  | { kind: 'not-found' };

/**
 * Parse an /api pathname into a validated route. Everything is allowlisted:
 * a path that is not exactly a known, well-formed route is `not-found`, so
 * traversal (`..`, encoded or not), unknown files and arbitrary paths can
 * never reach the asset layer.
 */
export function parseApiRoute(pathname: string): ApiRoute {
  // Defense in depth: reject suspicious raw input before decoding.
  if (/[\0\\]/.test(pathname) || pathname.includes('..')) return { kind: 'not-found' };

  let segments: string[];
  try {
    segments = pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  } catch {
    return { kind: 'not-found' };
  }
  // Re-check after decoding: decoded traversal must not survive either.
  if (segments.some((s) => s.includes('..') || s.includes('\\') || s.includes('\0')))
    return { kind: 'not-found' };

  const [api, first, second] = segments;
  if (api !== 'api' || !first) return { kind: 'not-found' };

  if (first === 'health' && !second && segments.length === 2) return { kind: 'health' };
  if (first === 'manifest' && !second && segments.length === 2) return { kind: 'manifest' };

  if (first === 'covers') {
    const name = segments[2];
    if (!name || segments.length > 3 || !COVER_NAME_RE.test(name))
      return { kind: 'not-found' };
    return { kind: 'cover', name };
  }

  if (first === 'stories') {
    const storyDir = second;
    if (!storyDir || !STORY_DIR_RE.test(storyDir)) return { kind: 'not-found' };
    const file = segments.slice(3).join('/');
    if (!file) return { kind: 'story-package', storyDir };
    if (!STORY_FILES.has(file) && !STORY_ASSET_FILES.has(file)) return { kind: 'not-found' };
    return { kind: 'story-file', storyDir, file };
  }

  return { kind: 'not-found' };
}

/* ---------------- content index ---------------- */

interface ContentIndex {
  storyDirs: Set<string>;
  contentVersion: number | null;
}

let cachedIndex: ContentIndex | null = null;

/** Allowed story dirs = exactly the stories in the deployed manifest. */
export async function getContentIndex(env: Env): Promise<ContentIndex> {
  if (cachedIndex) return cachedIndex;
  const res = await env.ASSETS.fetch(new Request(`${ASSETS_ORIGIN}/content/manifest.json`));
  if (!res.ok) return { storyDirs: new Set(), contentVersion: null };
  try {
    const manifest = (await res.json()) as {
      contentVersion?: number;
      stories?: { storyDir?: string }[];
    };
    const storyDirs = new Set<string>();
    for (const s of manifest.stories ?? []) {
      if (s?.storyDir && STORY_DIR_RE.test(s.storyDir)) storyDirs.add(s.storyDir);
    }
    cachedIndex = { storyDirs, contentVersion: manifest.contentVersion ?? null };
    return cachedIndex;
  } catch {
    return { storyDirs: new Set(), contentVersion: null };
  }
}

/* ---------------- asset serving ---------------- */

async function serveAsset(
  env: Env,
  key: string,
  contentType: string,
  cacheControl: string,
  cors: Record<string, string>,
  method: string,
): Promise<Response> {
  const res = await env.ASSETS.fetch(new Request(`${ASSETS_ORIGIN}/${key}`));
  if (!res.ok) return errorJson(404, 'not_found');
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...cors,
  };
  if (method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(res.body, { status: 200, headers });
}

function guessContentType(file: string): string {
  if (file.endsWith('.json')) return JSON_TYPE;
  if (file.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

/** Whole story package as one JSON response. */
async function serveStoryPackage(
  env: Env,
  storyDir: string,
  cors: Record<string, string>,
): Promise<Response> {
  const files = ['story.json', 'characters.json', 'world.json', 'scenes.json', 'memory.json'];
  const results = await Promise.all(
    files.map((f) => env.ASSETS.fetch(new Request(`${ASSETS_ORIGIN}/content/stories/${storyDir}/${f}`))),
  );
  if (results.some((r) => !r.ok)) return errorJson(404, 'not_found');
  try {
    const pkg: Record<string, unknown> = {};
    await Promise.all(results.map(async (r, i) => (pkg[files[i].replace('.json', '')] = await r.json())));
    return json(pkg, 200, {
      'Cache-Control': CACHE_STORY,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...cors,
    });
  } catch {
    return errorJson(500, 'invalid_content', 'Story package could not be read.');
  }
}

/* ---------------- request handling ---------------- */

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin')) });
  }
  if (method !== 'GET' && method !== 'HEAD') {
    return errorJson(405, 'method_not_allowed', 'Only GET requests are supported.');
  }

  // CORS: browser calls must come from the Kissa app/site origins. Native app
  // calls (no Origin header) are always fine.
  const origin = request.headers.get('Origin');
  const cors = corsHeaders(origin);
  if (origin && Object.keys(cors).length === 0) {
    return errorJson(403, 'origin_not_allowed');
  }

  // Abuse protection.
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await checkRateLimit(env, ip))) {
    return errorJson(429, 'rate_limited', 'Too many requests — slow down.', {
      'Retry-After': '30',
      'Cache-Control': 'no-store',
    });
  }

  const route = parseApiRoute(url.pathname);
  switch (route.kind) {
    case 'health': {
      const index = await getContentIndex(env);
      return json(
        { ok: true, service: 'kissa-content-api', contentVersion: index.contentVersion },
        200,
        { 'Cache-Control': 'no-store', ...cors },
      );
    }
    case 'manifest':
      return serveAsset(env, 'content/manifest.json', JSON_TYPE, CACHE_MANIFEST, cors, method);
    case 'story-package': {
      const index = await getContentIndex(env);
      if (!index.storyDirs.has(route.storyDir)) return errorJson(404, 'not_found');
      return serveStoryPackage(env, route.storyDir, cors);
    }
    case 'story-file': {
      const index = await getContentIndex(env);
      if (!index.storyDirs.has(route.storyDir)) return errorJson(404, 'not_found');
      const key = `content/stories/${route.storyDir}/${route.file}`;
      const cache = route.file.startsWith('assets/') ? CACHE_COVER : CACHE_STORY;
      return serveAsset(env, key, guessContentType(route.file), cache, cors, method);
    }
    case 'cover':
      return serveAsset(
        env,
        `covers/${route.name}`,
        guessContentType(route.name),
        CACHE_COVER,
        cors,
        method,
      );
    default:
      return errorJson(404, 'not_found');
  }
}

/** Worker fetch handler (invoked by src/index.ts). */
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);

    // API surface.
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return await handleApi(request, env, url);
    }

    // Raw content/cover assets are ONLY served through /api routes — block
    // direct access to the deployed asset directories.
    if (url.pathname.startsWith('/content/') || url.pathname.startsWith('/covers/')) {
      return errorJson(404, 'not_found');
    }

    // Everything else: the static website deployed with this Worker
    // (used when the whole domain is served by Cloudflare).
    return env.ASSETS.fetch(request);
  } catch {
    return errorJson(500, 'internal_error', 'Unexpected error.');
  }
}
