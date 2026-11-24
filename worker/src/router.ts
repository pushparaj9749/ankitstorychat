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
 * It also hosts the user SUBMISSION system (ideas + complete stories).
 * Submissions are stored in Cloudflare KV with a 24h TTL; admin review is
 * required before anything becomes public.
 *
 * Routes (all under /api):
 *   GET  /api/health
 *   GET  /api/manifest
 *   GET  /api/stories/:storyDir            (whole package in one JSON)
 *   GET  /api/stories/:storyDir/:file      (story.json | characters.json |
 *                                           world.json | scenes.json |
 *                                           memory.json | assets/cover.* |
 *                                           assets/gallery/image-NN.* |
 *                                           assets/references/<canonical-id>.jpg |
 *                                           assets/creator.*)
 *   GET  /api/covers/:name.jpg             (APK cover art, website fallback)
 *   POST /api/submit/idea                  (public — submit a story idea)
 *   POST /api/submit/story                 (public — submit a complete story)
 *   POST /api/submit/media                 (public — upload cover/gallery image)
 *   GET  /api/submit/limit                 (public — check remaining slots)
 *   GET  /api/submit/status?ids=a,b        (public — status words only for
 *                                           the submitter's own ids)
 *   POST /api/stats/hit                    (site beacon — {"e":"visit"|"download"};
 *                                           anonymous daily counts, no ids/IPs)
 *   GET  /api/stats?days=30                (public — daily visitor/download counts)
 *   GET  /api/admin/pending                (admin — Bearer token required)
 *   GET  /api/admin/media/:mediaId         (admin — preview uploaded image)
 *   POST /api/admin/idea/:id/accept        (admin)
 *   POST /api/admin/idea/:id/reject        (admin)
 *   POST /api/admin/story/:id/accept       (admin — "Accept & Publish")
 *   POST /api/admin/story/:id/reject       (admin)
 *
 * Security properties:
 *   - story directories and file names are strictly allowlisted (the deployed
 *     manifest is the source of truth) — no path traversal, no arbitrary file
 *     access, no proxying of arbitrary URLs or repositories;
 *   - CORS is restricted to the Kissa app/site origins;
 *   - per-IP rate limiting (Cloudflare rate-limit binding when available,
 *     in-isolate fallback otherwise);
 *   - global 50 submissions / 24h limit, enforced server-side in KV;
 *   - admin endpoints are gated by a constant-time Bearer-token check;
 *   - errors are clean JSON and never leak repository or deployment details.
 */

import {
  acceptAndPublishStory,
  acceptIdea,
  getCommunityMediaFile,
  getLimitStatus,
  getPendingMedia,
  getSubmissionStatuses,
  MAX_STATUS_IDS,
  getAcceptedStoryPackage,
  isAdmin,
  kvFor,
  listAcceptedStories,
  listPending,
  rejectSubmission,
  submitIdea,
  submitStory,
  uploadMedia,
} from './submissions';
import { MEDIA_ID_RE } from './media';
import {
  handleCheckUsername,
  handleClaim,
  handleDeleteMe,
  handleDeviceReset,
  handleLogin,
  handleLogout,
  handleMe,
  handleMySubmissions,
  handleNotificationRead,
  handleNotifications,
  handleNotificationsReadAll,
  handleRecoveryReset,
  handleRotateRecovery,
  handleSignup,
  handleUpdateProfile,
  handleRecoveryRequest,
  optionalAccountId,
} from './accounts/routes';
import { getMinVersion, isOlderVersion } from './accounts/service';
import {
  adminNotify as adminNotifyRoute,
  adminSetVersion,
  decideRecoveryRequest,
  getAdminAccount,
  listAdminAccounts,
  listRecoveryRequests,
} from './accounts/admin';
import { getStats, looksLikeBot, parseHit, recordHit } from './stats';
import type { Env } from './submissions';
export type { Env } from './submissions';

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

/**
 * Story asset files the API may serve — the cover plus the Media Library
 * gallery. Everything is an exact allowlisted shape; nothing else (no
 * traversal, no arbitrary names) can reach the asset layer.
 */
const STORY_ASSET_RE =
  /^assets\/(cover\.(?:jpg|jpeg|png|webp)|gallery\/image-\d{2}\.(?:jpg|jpeg|png|webp))$/;
/** Canonical visual references are story-local but not Media Library gallery entries. */
const STORY_REFERENCE_RE = /^assets\/references\/[a-z0-9][a-z0-9-]{0,63}\.jpg$/;
/** Story-creator avatar set by the Kissa team at publish time (v2.10.2). */
const STORY_CREATOR_AVATAR_RE = /^assets\/creator\.(?:jpg|jpeg|png|webp)$/;
function isStoryAssetFile(file: string): boolean {
  return STORY_ASSET_RE.test(file) || STORY_REFERENCE_RE.test(file) || STORY_CREATOR_AVATAR_RE.test(file);
}

/** APK cover art names (/api/covers/<name>). */
const COVER_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}\.(jpg|png)$/;

/** Story directory ids: lowercase slugs, or community/<slug>. */
const STORY_DIR_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const COMMUNITY_DIR_RE = /^community\/[a-z0-9][a-z0-9-]{0,63}$/;
const STORY_PATH_RE = /^(community\/)?[a-z0-9][a-z0-9-]{0,63}$/;

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
export function corsHeaders(origin: string | null, allowPost = false): Record<string, string> {
  if (!origin) return {};
  if (!ALLOWED_ORIGINS.has(origin) && !DEV_ORIGIN_RE.test(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': `GET, HEAD, OPTIONS${allowPost ? ', POST' : ''}`,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

/** Submission id format — same rules as storyDir slugs, prefixed with idea_/story_. */
const SUBMISSION_ID_RE = /^(idea|story)_[a-z0-9_]+$/;

export type ApiRoute =
  | { kind: 'health' }
  | { kind: 'manifest' }
  | { kind: 'story-package'; storyDir: string }
  | { kind: 'story-file'; storyDir: string; file: string }
  | { kind: 'cover'; name: string }
  | { kind: 'submit-idea' }
  | { kind: 'submit-story' }
  | { kind: 'submit-limit' }
  | { kind: 'submit-status' }
  | { kind: 'submit-media' }
  | { kind: 'admin-pending' }
  | { kind: 'admin-media'; id: string }
  | { kind: 'admin-idea-accept'; id: string }
  | { kind: 'admin-idea-reject'; id: string }
  | { kind: 'admin-story-accept'; id: string }
  | { kind: 'admin-story-reject'; id: string }
  | { kind: 'stats' }
  | { kind: 'stats-hit' }
  | { kind: 'app-version' }
  | { kind: 'auth-signup' }
  | { kind: 'auth-login' }
  | { kind: 'auth-logout' }
  | { kind: 'auth-me' }
  | { kind: 'auth-username' }
  | { kind: 'auth-recovery' }
  | { kind: 'auth-device-reset' }
  | { kind: 'auth-recovery-rotate' }
  | { kind: 'auth-recover-request' }
  | { kind: 'me-profile' }
  | { kind: 'me-delete' }
  | { kind: 'me-submissions' }
  | { kind: 'me-claim' }
  | { kind: 'me-notifications' }
  | { kind: 'me-notification'; id: string }
  | { kind: 'me-notifications-read' }
  | { kind: 'admin-accounts' }
  | { kind: 'admin-account'; id: string }
  | { kind: 'admin-notify' }
  | { kind: 'admin-recovery' }
  | { kind: 'admin-recovery-decide'; id: string }
  | { kind: 'admin-set-version' }
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
  if (first === 'stats' && !second && segments.length === 2) return { kind: 'stats' };
  if (first === 'stats' && second === 'hit' && segments.length === 3) return { kind: 'stats-hit' };

  if (first === 'covers') {
    const name = segments[2];
    if (!name || segments.length > 3 || !COVER_NAME_RE.test(name))
      return { kind: 'not-found' };
    return { kind: 'cover', name };
  }

  if (first === 'stories') {
    // Accept both <slug> and community/<slug>
    let storyDir: string;
    if (second === 'community' && segments[3]) {
      storyDir = `community/${segments[3]}`;
      if (!COMMUNITY_DIR_RE.test(storyDir)) return { kind: 'not-found' };
      const file = segments.slice(4).join('/');
      if (!file) return { kind: 'story-package', storyDir };
      if (!STORY_FILES.has(file) && !isStoryAssetFile(file)) return { kind: 'not-found' };
      return { kind: 'story-file', storyDir, file };
    }
    storyDir = second;
    if (!storyDir || !STORY_DIR_RE.test(storyDir)) return { kind: 'not-found' };
    const file = segments.slice(3).join('/');
    if (!file) return { kind: 'story-package', storyDir };
    if (!STORY_FILES.has(file) && !isStoryAssetFile(file)) return { kind: 'not-found' };
    return { kind: 'story-file', storyDir, file };
  }

  if (first === 'submit') {
    if (second === 'idea' && segments.length === 3) return { kind: 'submit-idea' };
    if (second === 'story' && segments.length === 3) return { kind: 'submit-story' };
    if (second === 'limit' && segments.length === 3) return { kind: 'submit-limit' };
    if (second === 'status' && segments.length === 3) return { kind: 'submit-status' };
    // Public image upload (cover / gallery) — base64 JSON, validated server-side.
    if (second === 'media' && segments.length === 3) return { kind: 'submit-media' };
    return { kind: 'not-found' };
  }

  if (first === 'app') {
    if (second === 'version' && segments.length === 3) return { kind: 'app-version' };
    return { kind: 'not-found' };
  }

  if (first === 'auth') {
    if (second === 'signup' && segments.length === 3) return { kind: 'auth-signup' };
    if (second === 'login' && segments.length === 3) return { kind: 'auth-login' };
    if (second === 'logout' && segments.length === 3) return { kind: 'auth-logout' };
    if (second === 'me' && segments.length === 3) return { kind: 'auth-me' };
    if (second === 'username' && segments.length === 3) return { kind: 'auth-username' };
    if (second === 'recovery' && segments.length === 3) return { kind: 'auth-recovery' };
    if (second === 'recovery-rotate' && segments.length === 3) return { kind: 'auth-recovery-rotate' };
    if (second === 'device-reset' && segments.length === 3) return { kind: 'auth-device-reset' };
    return { kind: 'not-found' };
  }

  if (first === 'recover' && segments.length === 2) return { kind: 'auth-recover-request' };
  if (first === 'me') {
    if (segments.length === 2) return { kind: 'auth-me' };
    if (second === 'profile' && segments.length === 3) return { kind: 'me-profile' };
    if (second === 'submissions' && segments.length === 3) return { kind: 'me-submissions' };
    if (second === 'claim' && segments.length === 3) return { kind: 'me-claim' };
    if (second === 'notifications' && segments.length === 3) return { kind: 'me-notifications' };
    if (second === 'notifications' && segments[3] === 'read' && segments.length === 4)
      return { kind: 'me-notifications-read' };
    // POST /api/me/notifications/<id> (and /read for symmetry)
    if (
      second === 'notifications' &&
      segments[3] &&
      (segments.length === 4 || (segments.length === 5 && segments[4] === 'read'))
    ) {
      if (!/^ntf_[A-Za-z0-9_-]{4,40}$/.test(segments[3])) return { kind: 'not-found' };
      return { kind: 'me-notification', id: segments[3] };
    }
    return { kind: 'not-found' };
  }

  if (first === 'admin') {
    if (second === 'pending' && segments.length === 3) return { kind: 'admin-pending' };
    if (second === 'accounts' && segments.length === 3) return { kind: 'admin-accounts' };
    if (second === 'accounts' && segments[3] && segments.length === 4) {
      if (!/^acc_[A-Za-z0-9_-]{4,40}$/.test(segments[3])) return { kind: 'not-found' };
      return { kind: 'admin-account', id: segments[3] };
    }
    if (second === 'accounts' && segments[3] && segments[4] === 'notify' && segments.length === 5) {
      if (!/^acc_[A-Za-z0-9_-]{4,40}$/.test(segments[3])) return { kind: 'not-found' };
      return { kind: 'admin-notify' };
    }
    if (second === 'recovery' && segments.length === 3) return { kind: 'admin-recovery' };
    if (second === 'recovery' && segments[3] && segments.length === 5) {
      if (!/^rec_[A-Za-z0-9_-]{4,40}$/.test(segments[3])) return { kind: 'not-found' };
      if (segments[4] !== 'approve' && segments[4] !== 'reject') return { kind: 'not-found' };
      return { kind: 'admin-recovery-decide', id: segments[3] };
    }
    if (second === 'version' && segments.length === 3) return { kind: 'admin-set-version' };
    // Admin media preview for pending submissions (Bearer-gated).
    if (second === 'media' && segments[3] && MEDIA_ID_RE.test(segments[3]) && segments.length === 4) {
      return { kind: 'admin-media', id: segments[3] };
    }
    const scope = segments[2];
    const id = segments[3];
    const action = segments[4];
    if (id && SUBMISSION_ID_RE.test(id) && segments.length === 5) {
      if (scope === 'idea') {
        if (action === 'accept') return { kind: 'admin-idea-accept', id };
        if (action === 'reject') return { kind: 'admin-idea-reject', id };
      }
      if (scope === 'story') {
        if (action === 'accept') return { kind: 'admin-story-accept', id };
        if (action === 'reject') return { kind: 'admin-story-reject', id };
      }
    }
    return { kind: 'not-found' };
  }

  return { kind: 'not-found' };
}

/* ---------------- content index ---------------- */

interface ContentIndex {
  storyDirs: Set<string>;
  contentVersion: number | null;
  bundledStories: { storyDir?: string; [k: string]: unknown }[];
  /** Bumped when community accepted set changes; used for cache invalidation. */
  communityVersion: number;
}

let cachedIndex: ContentIndex | null = null;
let cachedIndexAt = 0;

/** Allowed story dirs = deployed manifest + accepted community stories in KV. */
export async function getContentIndex(env: Env): Promise<ContentIndex> {
  // Don't let community additions get stuck behind a long CDN/edge cache.
  const now = Date.now();
  if (cachedIndex && now - cachedIndexAt < 15_000) return cachedIndex;

  let bundledStories: { storyDir?: string; [k: string]: unknown }[] = [];
  let contentVersion: number | null = null;
  const storyDirs = new Set<string>();

  const res = await env.ASSETS.fetch(new Request(`${ASSETS_ORIGIN}/content/manifest.json`));
  if (res.ok) {
    try {
      const manifest = (await res.json()) as {
        contentVersion?: number;
        stories?: { storyDir?: string }[];
      };
      contentVersion = manifest.contentVersion ?? null;
      bundledStories = Array.isArray(manifest.stories) ? manifest.stories : [];
      for (const s of bundledStories) {
        if (s?.storyDir && STORY_DIR_RE.test(s.storyDir)) storyDirs.add(s.storyDir);
      }
    } catch { /* fall through */ }
  }

  // Merge accepted community stories from KV.
  const accepted = await listAcceptedStories(env);
  for (const a of accepted) {
    storyDirs.add(a.storyDir);
  }

  cachedIndex = { storyDirs, contentVersion, bundledStories, communityVersion: now };
  cachedIndexAt = now;
  return cachedIndex;
}

/** Test-only helper: drop in-memory index so community/KV state is re-read. */
export function resetContentIndexForTests(): void {
  cachedIndex = null;
  cachedIndexAt = 0;
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
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

/* ---------------- legacy gallery compatibility (v2.12) ---------------- */

/**
 * Apps before v2.12 reject a story whose gallery has more than 8 entries
 * ("Story data is invalid"). v2.12+ allows up to 50 and asks for the whole
 * gallery with `?gallery=full`. Requests without it get the first 8 entries
 * (cover kept), so a long gallery never breaks an old install. Stories with
 * 8 or fewer images are served byte-for-byte unchanged.
 */
export const LEGACY_GALLERY_MAX = 8;

export function wantsFullGallery(url: URL): boolean {
  return url.searchParams.get('gallery') === 'full';
}

type GalleryItem = { kind?: unknown; file?: unknown };

/** Story JSON trimmed for an old app, or null when no trim is needed. */
export function trimGalleryForLegacy(story: unknown): Record<string, unknown> | null {
  if (!story || typeof story !== 'object') return null;
  const s = story as Record<string, unknown>;
  const media = s.media as { cover?: unknown; gallery?: unknown } | undefined;
  if (!media || typeof media !== 'object' || !Array.isArray(media.gallery)) return null;
  const gallery = media.gallery as GalleryItem[];
  if (gallery.length <= LEGACY_GALLERY_MAX) return null;
  let keep = gallery.slice(0, LEGACY_GALLERY_MAX);
  const cover = gallery.find((g) => g && (g.kind === 'cover' || g.file === media.cover));
  if (cover && !keep.includes(cover)) keep = [cover, ...keep.slice(0, LEGACY_GALLERY_MAX - 1)];
  return { ...s, media: { ...media, gallery: keep } };
}

/** story.json for a bundled story: full for v2.12+, trimmed gallery otherwise. */
async function serveStoryJson(
  env: Env,
  key: string,
  method: string,
  full: boolean,
): Promise<Response> {
  if (full || method === 'HEAD') return serveAsset(env, key, JSON_TYPE, CACHE_STORY, {}, method);
  const res = await env.ASSETS.fetch(new Request(`${ASSETS_ORIGIN}/${key}`));
  if (!res.ok) return errorJson(404, 'not_found');
  const text = await res.text();
  const headers: Record<string, string> = {
    'Content-Type': JSON_TYPE,
    'Cache-Control': CACHE_STORY,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
  let trimmed: Record<string, unknown> | null = null;
  try {
    trimmed = trimGalleryForLegacy(JSON.parse(text));
  } catch {
    trimmed = null;
  }
  return new Response(trimmed ? JSON.stringify(trimmed, null, 2) + '\n' : text, { status: 200, headers });
}

/** Whole story package as one JSON response. */
async function serveStoryPackage(
  env: Env,
  storyDir: string,
  cors: Record<string, string>,
  full = true,
): Promise<Response> {
  const files = ['story.json', 'characters.json', 'world.json', 'scenes.json', 'memory.json'];
  const results = await Promise.all(
    files.map((f) => env.ASSETS.fetch(new Request(`${ASSETS_ORIGIN}/content/stories/${storyDir}/${f}`))),
  );
  if (results.some((r) => !r.ok)) return errorJson(404, 'not_found');
  try {
    const pkg: Record<string, unknown> = {};
    await Promise.all(results.map(async (r, i) => (pkg[files[i].replace('.json', '')] = await r.json())));
    if (!full) {
      const trimmed = trimGalleryForLegacy(pkg.story);
      if (trimmed) pkg.story = trimmed;
    }
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

/** Routes that accept POST (submissions + admin actions). */
const POST_ROUTES = new Set([
  'stats-hit',
  'submit-idea',
  'submit-story',
  'submit-media',
  'auth-signup',
  'auth-login',
  'auth-logout',
  'auth-recovery',
  'auth-device-reset',
  'auth-recovery-rotate',
  'me-profile',
  'me-claim',
  'me-notifications-read',
  'me-notification',
  'admin-notify',
  'admin-recovery-decide',
  'admin-set-version',
  'auth-recover-request',
  'admin-idea-accept',
  'admin-idea-reject',
  'admin-story-accept',
  'admin-story-reject',
]);

/** Analytics beacons are tiny ({"e":"visit","n":true}). */
const STATS_HIT_MAX = 200;

/** Base64 image uploads are larger than JSON submissions (3 MB image ≈ 4 MB). */
const MEDIA_UPLOAD_MAX = 5_500_000;

async function readJsonBody(request: Request, maxBytes = 600_000): Promise<unknown> {
  // Enforce the cap on the ACTUAL body bytes (a missing Content-Length must
  // not allow an oversized chunked payload through).
  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) throw new Error('payload_too_large');
  try {
    return JSON.parse(new TextDecoder('utf-8').decode(buf)) as unknown;
  } catch {
    throw new Error('invalid_json');
  }
}

function withCors(res: Response, cors: Record<string, string>): Response {
  if (Object.keys(cors).length === 0) return res;
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

/** /api/admin/recovery/<id>/(approve|reject) → the action. */
export function recoveryAction(pathname: string): 'approve' | 'reject' {
  const seg = pathname.split('/').filter(Boolean);
  return seg[4] === 'reject' ? 'reject' : 'approve';
}

/** /api/admin/accounts/<id>/notify → <id> */
export function notificationAccountId(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean);
  return seg[3] ?? '';
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const method = request.method;
  const origin = request.headers.get('Origin');

  const route = parseApiRoute(url.pathname);
  const isPostRoute = POST_ROUTES.has(route.kind);
  const cors = corsHeaders(origin, isPostRoute);

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (origin && Object.keys(cors).length === 0) {
    return withCors(errorJson(403, 'origin_not_allowed'), cors);
  }

  if (method === 'DELETE' && route.kind === 'me-delete') {
    return withCors(await handleDeleteMe(request, env), cors);
  }
  if (method === 'PATCH' && route.kind === 'me-profile') {
    return withCors(await handleUpdateProfile(request, env), cors);
  }


  if (method === 'POST' && !isPostRoute) {
    return withCors(errorJson(405, 'method_not_allowed', 'Only GET/HEAD are supported here.'), cors);
  }
  if ((method === 'GET' || method === 'HEAD') && isPostRoute) {
    return withCors(errorJson(405, 'method_not_allowed', 'Use POST.'), cors);
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await checkRateLimit(env, ip))) {
    return withCors(
      errorJson(429, 'rate_limited', 'Too many requests — slow down.', {
        'Retry-After': '30',
        'Cache-Control': 'no-store',
      }),
      cors,
    );
  }

  const isAdminRoute =
    route.kind === 'admin-pending' || route.kind.startsWith('admin-');
  if (isAdminRoute && !isAdmin(request, env)) {
    return withCors(
      errorJson(401, 'unauthorized', 'Admin authorization required.', { 'Cache-Control': 'no-store' }),
      cors,
    );
  }

  // Version gate: an outdated install may not use the app at all. The public
  // version route and the admin surface stay reachable.
  if (
    route.kind !== 'app-version' &&
    route.kind !== 'health' &&
    !route.kind.startsWith('admin-')
  ) {
    const clientVersion = request.headers.get('X-Kissa-Version');
    const { minVersion, message } = await getMinVersion(env);
    if (isOlderVersion(clientVersion, minVersion)) {
      return withCors(
        json(
          { error: 'update_required', minVersion, message },
          426,
          { 'Cache-Control': 'no-store' },
        ),
        cors,
      );
    }
  }

  switch (route.kind) {
    case 'app-version': {
      const { minVersion, message } = await getMinVersion(env);
      return withCors(
        json(
          { ok: true, minVersion, message, updatedAt: new Date().toISOString() },
          200,
          { 'Cache-Control': 'public, max-age=60, s-maxage=120' },
        ),
        cors,
      );
    }
    case 'auth-signup':
      return withCors(await handleSignup(request, env), cors);
    case 'auth-login':
      return withCors(await handleLogin(request, env), cors);
    case 'auth-logout':
      return withCors(await handleLogout(request, env), cors);
    case 'auth-me':
    case 'me-profile':
      return withCors(await handleMe(request, env), cors);
    case 'auth-username':
      return withCors(await handleCheckUsername(request, env, url), cors);
    case 'auth-recovery':
      return withCors(await handleRecoveryReset(request, env), cors);
    case 'auth-device-reset':
      return withCors(await handleDeviceReset(request, env), cors);
    case 'auth-recovery-rotate':
      return withCors(await handleRotateRecovery(request, env), cors);
    case 'auth-recover-request':
      return withCors(await handleRecoveryRequest(request, env), cors);
    case 'me-delete':
      return withCors(await handleDeleteMe(request, env), cors);
    case 'me-submissions':
      return withCors(await handleMySubmissions(request, env), cors);
    case 'me-claim':
      return withCors(await handleClaim(request, env), cors);
    case 'me-notifications':
      return withCors(await handleNotifications(request, env, url), cors);
    case 'me-notification':
      return withCors(await handleNotificationRead(request, env, route.id), cors);
    case 'me-notifications-read':
      return withCors(await handleNotificationsReadAll(request, env), cors);
    case 'admin-accounts':
      return withCors(await listAdminAccounts(env), cors);
    case 'admin-account':
      return withCors(await getAdminAccount(env, route.id), cors);
    case 'admin-notify':
      return withCors(await adminNotifyRoute(env, request, notificationAccountId(url.pathname)), cors);
    case 'admin-recovery':
      return withCors(await listRecoveryRequests(env), cors);
    case 'admin-recovery-decide':
      return withCors(
        await decideRecoveryRequest(env, route.id, request, recoveryAction(url.pathname)),
        cors,
      );
    case 'admin-set-version':
      return withCors(await adminSetVersion(env, request), cors);
    case 'health': {
      const index = await getContentIndex(env);
      const lim = await getLimitStatus(kvFor(env));
      return withCors(
        json(
          {
            ok: true,
            service: 'kissa-content-api',
            contentVersion: index.contentVersion,
            submissions: { remaining: lim.remaining, resetsAt: lim.resetsAt },
          },
          200,
          { 'Cache-Control': 'no-store' },
        ),
        cors,
      );
    }
    case 'manifest': {
      // Merge bundled manifest + accepted community stories from KV.
      const index = await getContentIndex(env);
      const accepted = await listAcceptedStories(env);
      const stories = [...index.bundledStories];
      for (const a of accepted) stories.push(a.manifestEntry);
      const body = {
        contentVersion: index.contentVersion,
        minAppVersion: '1.0.0',
        updatedAt: new Date().toISOString(),
        stories,
        communityVersion: index.communityVersion,
      };
      // Short TTL so newly accepted stories propagate quickly.
      return withCors(json(body, 200, { 'Cache-Control': 'public, max-age=15, s-maxage=30', 'X-Content-Type-Options': 'nosniff' }), cors);
    }
    case 'story-package': {
      const index = await getContentIndex(env);
      if (!index.storyDirs.has(route.storyDir)) return withCors(errorJson(404, 'not_found'), cors);
      if (route.storyDir.startsWith('community/')) {
        const pkg = await getAcceptedStoryPackage(env, route.storyDir);
        if (!pkg) return withCors(errorJson(404, 'not_found'), cors);
        return withCors(json(pkg, 200, { 'Cache-Control': CACHE_STORY, 'X-Content-Type-Options': 'nosniff' }), cors);
      }
      const r = await serveStoryPackage(env, route.storyDir, {}, wantsFullGallery(url));
      return withCors(r, cors);
    }
    case 'story-file': {
      const index = await getContentIndex(env);
      if (!index.storyDirs.has(route.storyDir)) return withCors(errorJson(404, 'not_found'), cors);
      if (route.storyDir.startsWith('community/')) {
        // Community story JSON lives in one package; the ALLOWLISTED media
        // files (cover + gallery) are served from permanent KV storage.
        if (!route.file.startsWith('assets/')) return withCors(errorJson(404, 'not_found'), cors);
        const media = await getCommunityMediaFile(env, route.storyDir, route.file);
        if (!media) return withCors(errorJson(404, 'not_found'), cors);
        if (method === 'HEAD') {
          return withCors(
            new Response(null, {
              status: 200,
              headers: {
                'Content-Type': media.mime,
                'Cache-Control': CACHE_COVER,
                'X-Content-Type-Options': 'nosniff',
                'Referrer-Policy': 'no-referrer',
              },
            }),
            cors,
          );
        }
        return withCors(
          new Response(media.bytes as unknown as BodyInit, {
            status: 200,
            headers: {
              'Content-Type': media.mime,
              'Cache-Control': CACHE_COVER,
              'X-Content-Type-Options': 'nosniff',
              'Referrer-Policy': 'no-referrer',
            },
          }),
          cors,
        );
      }
      const key = `content/stories/${route.storyDir}/${route.file}`;
      if (route.file === 'story.json') {
        return withCors(await serveStoryJson(env, key, method, wantsFullGallery(url)), cors);
      }
      const cache = route.file.startsWith('assets/') ? CACHE_COVER : CACHE_STORY;
      const r = await serveAsset(env, key, guessContentType(route.file), cache, {}, method);
      return withCors(r, cors);
    }
    case 'cover': {
      const r = await serveAsset(env, `covers/${route.name}`, guessContentType(route.name), CACHE_COVER, {}, method);
      return withCors(r, cors);
    }

    case 'stats-hit': {
      // Anonymous visit / download-click counter. Only real browsers on our
      // own site count: an allowed Origin is required and bots are skipped.
      // Always 204 — the beacon must never surface errors to visitors.
      const done = () => withCors(new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } }), cors);
      if (!origin) return withCors(errorJson(403, 'origin_required'), cors);
      let body: unknown;
      try {
        body = await readJsonBody(request, STATS_HIT_MAX);
      } catch {
        return withCors(errorJson(400, 'invalid_body'), cors);
      }
      const hit = parseHit(body);
      if (!hit) return withCors(errorJson(400, 'invalid_body'), cors);
      if (looksLikeBot(request.headers.get('User-Agent'))) return done();
      const colo = (request as Request & { cf?: { colo?: unknown } }).cf?.colo;
      await recordHit(env, hit, colo);
      return done();
    }
    case 'stats': {
      const days = Number(url.searchParams.get('days') ?? '30');
      try {
        const summary = await getStats(env, Number.isFinite(days) ? days : 30);
        return withCors(json(summary, 200, { 'Cache-Control': 'public, max-age=60' }), cors);
      } catch {
        return withCors(errorJson(503, 'stats_unavailable', 'Stats are unavailable right now.', { 'Cache-Control': 'no-store' }), cors);
      }
    }

    case 'submit-limit': {
      const lim = await getLimitStatus(kvFor(env));
      return withCors(json({ ok: true, ...lim }, 200, { 'Cache-Control': 'no-store' }), cors);
    }
    case 'submit-status': {
      const raw = (url.searchParams.get('ids') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      const ids = [...new Set(raw)];
      if (ids.length === 0 || ids.length > MAX_STATUS_IDS || !ids.every((id) => SUBMISSION_ID_RE.test(id) && id.length <= 80)) {
        return withCors(errorJson(400, 'invalid_ids', `Pass 1–${MAX_STATUS_IDS} submission ids.`, { 'Cache-Control': 'no-store' }), cors);
      }
      const statuses = await getSubmissionStatuses(env, ids);
      return withCors(json({ ok: true, statuses }, 200, { 'Cache-Control': 'no-store' }), cors);
    }
    case 'submit-media': {
      let body: unknown;
      try {
        body = await readJsonBody(request, MEDIA_UPLOAD_MAX);
      } catch (e) {
        const msg = (e as Error).message;
        if (msg === 'payload_too_large')
          return withCors(errorJson(413, 'payload_too_large', 'Image is too large (max 3 MB).'), cors);
        return withCors(errorJson(400, 'invalid_json', 'Request body must be valid JSON.'), cors);
      }
      const res = await uploadMedia(env, body as { kind?: unknown; image?: unknown });
      return withCors(res, cors);
    }
    case 'submit-idea':
    case 'submit-story': {
      let body: unknown;
      try {
        body = await readJsonBody(request);
      } catch (e) {
        const msg = (e as Error).message;
        if (msg === 'payload_too_large')
          return withCors(errorJson(413, 'payload_too_large', 'Submission is too large (max 500KB).'), cors);
        return withCors(errorJson(400, 'invalid_json', 'Request body must be valid JSON.'), cors);
      }
      const client = request.headers.get('X-Kissa-Client') ?? undefined;
      const accountId = await optionalAccountId(env, request);
      const res =
        route.kind === 'submit-idea'
          ? await submitIdea(env, body as Record<string, unknown>, client, accountId)
          : await submitStory(env, body as Record<string, unknown>, client, accountId);
      return withCors(res, cors);
    }

    case 'admin-pending': {
      const r = await listPending(env);
      return withCors(r, cors);
    }
    case 'admin-media': {
      // Preview of a PENDING submission's uploaded image (already Bearer-gated).
      const media = await getPendingMedia(env, route.id);
      if (!media) return withCors(errorJson(404, 'not_found', undefined, { 'Cache-Control': 'no-store' }), cors);
      return withCors(
        new Response(media.bytes as unknown as BodyInit, {
          status: 200,
          headers: {
            'Content-Type': media.mime,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        }),
        cors,
      );
    }
    case 'admin-idea-accept': {
      const r = await acceptIdea(env, route.id);
      return withCors(r, cors);
    }
    case 'admin-idea-reject': {
      const r = await rejectSubmission(env, route.id);
      return withCors(r, cors);
    }
    case 'admin-story-accept': {
      const r = await acceptAndPublishStory(env, route.id);
      cachedIndex = null; cachedIndexAt = 0;
      return withCors(r, cors);
    }
    case 'admin-story-reject': {
      const r = await rejectSubmission(env, route.id);
      return withCors(r, cors);
    }

    default:
      return withCors(errorJson(404, 'not_found'), cors);
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
  } catch (e) {
    console.error('handleRequest failed', e);
    return errorJson(500, 'internal_error', 'Unexpected error.');
  }
}
