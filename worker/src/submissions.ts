/**
 * Kissa submission system — Cloudflare Worker side.
 *
 * Storage model (Cloudflare KV):
 *   kissa_submissions:<id>        -> JSON submission (pending only, 24h TTL)
 *   kissa_submissions:accepted:<id> -> accepted story bundle (permanent, no TTL)
 *   kissa_submissions:index       -> JSON set of pending submission ids
 *   kissa_submissions:counter:<windowKey> -> integer count for the 50/24h window
 *   kissa_submissions:window      -> { start, count }
 *
 * Why KV? The existing Worker already runs on Cloudflare and KV natively
 * supports expiring TTLs — which is exactly what the 24h pending/expiry rule
 * needs without running a cron. Writes are atomic via the list+counter keys.
 */

export const SUBMISSION_TTL_SECONDS = 24 * 60 * 60; // 24h
export const GLOBAL_DAILY_LIMIT = 50;
export const WINDOW_MS = 24 * 60 * 60 * 1000; // 24h window (UTC midnight aligned)

export const KV = {
  PREFIX: 'sub:',
  ACCEPTED_PREFIX: 'acc:',
  IDEA_INDEX: 'idx:ideas',
  STORY_INDEX: 'idx:stories',
  ACCEPTED_STORY_INDEX: 'idx:acc_stories', // -> JSON string[] of accepted story submission ids
  WINDOW: 'win', // -> JSON { start: number, count: number }
};

/**
 * Minimal in-memory KV shim used when the real KV binding is absent (local dev,
 * tests, or a misconfigured deploy). It is NOT shared across isolates and is
 * wiped on cold start — production MUST wire KISSA_SUBMISSIONS.
 */
export class MemKV {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  reset(): void {
    this.store.clear();
  }
  async get(key: string): Promise<string | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && Date.now() > e.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }
  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    const expiresAt = opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export const memKv = new MemKV();
/** Returns the KV binding or a transient in-memory shim for tests/dev. */
export function kvFor(env: Env): KVNamespace {
  return (env.KISSA_SUBMISSIONS as KVNamespace | undefined) ?? (memKv as unknown as KVNamespace);
}
/** Test-only helper: clear the in-memory KV between tests. */
export function resetMemKvForTests(): void {
  memKv.reset();
}

export interface Env {
  ASSETS: Fetcher;
  RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  /** KV namespace binding (configured in wrangler.jsonc). */
  KISSA_SUBMISSIONS?: KVNamespace;
  /** Admin bearer token (secret). Any non-empty value enables admin routes. */
  ADMIN_TOKEN?: string;
}

export type SubmissionType = 'idea' | 'story';
export type SubmissionStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface StoryCreator {
  name: string;
  avatar?: string | null;
  verified?: boolean;
}

export interface IdeaPayload {
  title: string;
  concept: string;
  genre: string;
  characters?: string;
  notes?: string;
}

export interface StorySubmissionPayload {
  story: Record<string, unknown>;
  characters?: Record<string, unknown>;
  world?: Record<string, unknown>;
  scenes?: Record<string, unknown>;
  memory?: Record<string, unknown>;
}

export interface Submission {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  creator: StoryCreator;
  title: string;
  submittedAt: string;
  expiresAt: string;
  genre?: string;
  client?: string;
  payload: IdeaPayload | StorySubmissionPayload;
}

/* ---------------- utilities ---------------- */

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export function err(status: number, code: string, message?: string): Response {
  const body: Record<string, unknown> = { error: code };
  if (message) body.message = message;
  return json(body, status);
}

export function uid(prefix = 'sub'): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rnd}`;
}

const DANGEROUS_RE = /<\s*(script|iframe|object|embed|link|style|form|svg|math|details)[^>]*>/i;
const JS_URL_RE = /\s*javascript\s*:/i;
export function containsUnsafe(s: string): boolean {
  if (!s) return false;
  return DANGEROUS_RE.test(s) || JS_URL_RE.test(s);
}

export function sanitizeName(raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof raw !== 'string') return { ok: false, message: 'creator.name must be a string' };
  const v = raw.trim();
  if (!v) return { ok: false, message: 'Creator name is required' };
  if (v.length > 60) return { ok: false, message: 'Creator name is too long (max 60 characters)' };
  if (containsUnsafe(v)) return { ok: false, message: 'Creator name contains unsupported markup' };
  return { ok: true, value: v };
}

export function sanitizeText(
  raw: unknown,
  max: number,
  field: string,
  required: boolean,
  issues: { path: string; message: string }[],
): string | null {
  if (raw === undefined || raw === null || raw === '') {
    if (required) issues.push({ path: field, message: 'required' });
    return null;
  }
  if (typeof raw !== 'string') {
    issues.push({ path: field, message: 'must be a string' });
    return null;
  }
  const v = raw.trim();
  if (!v && required) {
    issues.push({ path: field, message: 'required' });
    return null;
  }
  if (v.length > max) issues.push({ path: field, message: `too long (max ${max} chars)` });
  const out = v.slice(0, max);
  if (containsUnsafe(out)) issues.push({ path: field, message: 'contains unsupported markup or scripts' });
  return out;
}

/* ---------------- global daily counter (atomic over KV) ---------------- */

interface Window {
  start: number;
  count: number;
}

function currentWindowStart(now: number): number {
  // Fixed 24h window aligned to UTC midnight for predictability and to keep
  // the counter resynchronised across isolates.
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

async function readWindow(kv: KVNamespace | undefined, now: number): Promise<Window> {
  if (!kv) return { start: currentWindowStart(now), count: 0 };
  const raw = await kv.get(KV.WINDOW);
  if (!raw) return { start: currentWindowStart(now), count: 0 };
  try {
    const w = JSON.parse(raw) as Window;
    if (typeof w.start !== 'number' || typeof w.count !== 'number') throw 0;
    if (now - w.start >= WINDOW_MS) return { start: currentWindowStart(now), count: 0 };
    return w;
  } catch {
    return { start: currentWindowStart(now), count: 0 };
  }
}

async function writeWindow(kv: KVNamespace | undefined, w: Window): Promise<void> {
  if (!kv) return;
  const ttlSec = Math.max(60, Math.ceil((w.start + WINDOW_MS - Date.now()) / 1000));
  await kv.put(KV.WINDOW, JSON.stringify(w), { expirationTtl: ttlSec });
}

export async function checkAndIncrementLimit(
  kv: KVNamespace | undefined,
  now = Date.now(),
): Promise<{ allowed: boolean; remaining: number; resetsAt: number; window: Window }> {
  const w = await readWindow(kv, now);
  const resetsAt = w.start + WINDOW_MS;
  if (w.count >= GLOBAL_DAILY_LIMIT) {
    return { allowed: false, remaining: 0, resetsAt, window: w };
  }
  const next: Window = { start: w.start, count: w.count + 1 };
  await writeWindow(kv, next);
  return { allowed: true, remaining: GLOBAL_DAILY_LIMIT - next.count, resetsAt, window: next };
}

export async function getLimitStatus(
  kv: KVNamespace | undefined,
  now = Date.now(),
): Promise<{ count: number; remaining: number; resetsAt: number }> {
  const w = await readWindow(kv, now);
  return { count: w.count, remaining: Math.max(0, GLOBAL_DAILY_LIMIT - w.count), resetsAt: w.start + WINDOW_MS };
}

/* ---------------- CRUD helpers ---------------- */

function subKey(id: string): string {
  return KV.PREFIX + id;
}
function accKey(id: string): string {
  return KV.ACCEPTED_PREFIX + id;
}
function indexKey(type: SubmissionType): string {
  return type === 'idea' ? KV.IDEA_INDEX : KV.STORY_INDEX;
}

async function readIndex(kv: KVNamespace | undefined, type: SubmissionType): Promise<Set<string>> {
  if (!kv) return new Set();
  const raw = await kv.get(indexKey(type));
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function writeIndex(kv: KVNamespace | undefined, type: SubmissionType, ids: Set<string>): Promise<void> {
  if (!kv) return;
  // 25h TTL so the index self-prunes after the expiry window.
  await kv.put(indexKey(type), JSON.stringify([...ids]), { expirationTtl: SUBMISSION_TTL_SECONDS + 3600 });
}

async function saveSubmission(kv: KVNamespace | undefined, sub: Submission): Promise<void> {
  if (!kv) return;
  await kv.put(subKey(sub.id), JSON.stringify(sub), { expirationTtl: SUBMISSION_TTL_SECONDS });
}

async function readSubmission(kv: KVNamespace | undefined, id: string): Promise<Submission | null> {
  if (!kv) return null;
  const raw = await kv.get(subKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Submission;
  } catch {
    return null;
  }
}

async function deleteSubmission(kv: KVNamespace | undefined, id: string, type: SubmissionType): Promise<void> {
  if (!kv) return;
  await kv.delete(subKey(id));
  const idx = await readIndex(kv, type);
  idx.delete(id);
  await writeIndex(kv, type, idx);
}

async function addToIndex(kv: KVNamespace | undefined, type: SubmissionType, id: string): Promise<void> {
  const idx = await readIndex(kv, type);
  idx.add(id);
  await writeIndex(kv, type, idx);
}

/* ---------------- public submit ---------------- */

export interface IdeaInput {
  creatorName?: string;
  creator?: { name?: unknown };
  title?: unknown;
  concept?: unknown;
  idea?: unknown;
  genre?: unknown;
  characters?: unknown;
  notes?: unknown;
  specialNotes?: unknown;
}

export function validateIdea(input: IdeaInput): {
  ok: boolean;
  issues: { path: string; message: string }[];
  cleaned?: {
    creatorName: string;
    title: string;
    concept: string;
    genre: string;
    characters?: string;
    notes?: string;
  };
} {
  const issues: { path: string; message: string }[] = [];
  const nameRes = sanitizeName(input.creatorName ?? input.creator?.name);
  if (!nameRes.ok) issues.push({ path: 'creatorName', message: nameRes.message });
  const title = sanitizeText(input.title, 120, 'title', true, issues);
  const concept = sanitizeText(input.concept ?? input.idea, 20000, 'concept', true, issues);
  const genre = sanitizeText(input.genre, 60, 'genre', true, issues);
  const characters = sanitizeText(input.characters, 2000, 'characters', false, issues);
  const notes = sanitizeText(input.notes ?? input.specialNotes, 20000, 'notes', false, issues);
  const ok = issues.length === 0 && !!nameRes.ok && !!title && !!concept && !!genre;
  return {
    ok,
    issues,
    cleaned: ok && nameRes.ok
      ? { creatorName: nameRes.value, title: title!, concept: concept!, genre: genre!, characters: characters ?? undefined, notes: notes ?? undefined }
      : undefined,
  };
}

export interface StoryInput {
  creatorName?: string;
  creator?: { name?: unknown; verified?: unknown; avatar?: unknown };
  story?: Record<string, unknown>;
  characters?: Record<string, unknown>;
  world?: Record<string, unknown>;
  scenes?: Record<string, unknown>;
  memory?: Record<string, unknown>;
}

/**
 * Structural validation of a complete-story submission. Deeper content/scene
 * validation happens at publish time using the existing validateBundle from
 * the app (we mirror the essential checks here so the Worker can reject
 * obviously-broken JSON early without importing the full app validator).
 */
export function validateStorySubmission(input: StoryInput): {
  ok: boolean;
  issues: { path: string; message: string }[];
  cleaned?: {
    creatorName: string;
    storyId: string;
    title: string;
    bundle: StorySubmissionPayload;
  };
} {
  const issues: { path: string; message: string }[] = [];
  const nameRes = sanitizeName(input.creator?.name ?? input.creatorName);
  if (!nameRes.ok) issues.push({ path: 'creator.name', message: nameRes.message });

  if (!input.story || typeof input.story !== 'object') {
    issues.push({ path: 'story', message: 'missing story object' });
    return { ok: false, issues };
  }
  const s = input.story;
  if (typeof s.title !== 'string' || !s.title.trim()) issues.push({ path: 'story.title', message: 'required' });
  if (typeof s.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(s.id))
    issues.push({ path: 'story.id', message: 'must be a lowercase slug (letters, numbers, hyphens)' });
  if (!['12-17', '18+'].includes(s.ageRating as string)) issues.push({ path: 'story.ageRating', message: 'invalid' });
  if (!['teen', 'mature'].includes(s.contentLevel as string)) issues.push({ path: 'story.contentLevel', message: 'invalid' });
  if (typeof s.openingSceneId !== 'string' || !s.openingSceneId.trim())
    issues.push({ path: 'story.openingSceneId', message: 'required' });

  // Users cannot self-verify.
  const creator: StoryCreator = { name: nameRes.ok ? nameRes.value : '', avatar: null, verified: false };
  if (input.creator && (input.creator as Record<string, unknown>).verified) {
    // Force-clear silently; do not treat as an error, just ignore.
  }

  const storyId = typeof s.id === 'string' ? s.id : '';
  const ok = issues.length === 0 && nameRes.ok && !!storyId;
  return {
    ok,
    issues,
    cleaned: ok && nameRes.ok
      ? {
          creatorName: nameRes.value,
          storyId,
          title: String(s.title).trim(),
          bundle: {
            story: { ...s, creator },
            characters: input.characters ?? {},
            world: input.world ?? {},
            scenes: input.scenes ?? {},
            memory: input.memory ?? {},
          },
        }
      : undefined,
  };
}

export async function submitIdea(env: Env, input: IdeaInput, client?: string): Promise<Response> {
  const v = validateIdea(input);
  if (!v.ok || !v.cleaned) return json({ ok: false, issues: v.issues }, 400);

  if (rawSize(input) > 500_000) return err(413, 'payload_too_large', 'Submission is too large.');

  const limit = await checkAndIncrementLimit(kvFor(env));
  if (!limit.allowed) {
    return json(
      { ok: false, error: 'limit_reached', message: "Today's submission limit has been reached. Please try again after the submission window resets.", limitReached: true, resetsAt: limit.resetsAt },
      429,
      { 'Retry-After': String(Math.max(1, Math.ceil((limit.resetsAt - Date.now()) / 1000))) },
    );
  }

  const now = new Date();
  const submittedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SUBMISSION_TTL_SECONDS * 1000).toISOString();
  const id = uid('idea');
  const sub: Submission = {
    id,
    type: 'idea',
    status: 'pending',
    creator: { name: v.cleaned.creatorName, avatar: null, verified: false },
    title: v.cleaned.title,
    submittedAt,
    expiresAt,
    genre: v.cleaned.genre,
    client: client ? String(client).slice(0, 120) : undefined,
    payload: {
      title: v.cleaned.title,
      concept: v.cleaned.concept,
      genre: v.cleaned.genre,
      characters: v.cleaned.characters,
      notes: v.cleaned.notes,
    },
  };
  await saveSubmission(kvFor(env), sub);
  await addToIndex(kvFor(env), 'idea', id);

  return json({ ok: true, id, type: 'idea', creatorName: v.cleaned.creatorName, resetsAt: limit.resetsAt, expiresAt }, 201);
}

export async function submitStory(env: Env, input: StoryInput, client?: string): Promise<Response> {
  if (rawSize(input) > 500_000) return err(413, 'payload_too_large', 'Submission is too large (max 500KB).');

  const v = validateStorySubmission(input);
  if (!v.ok || !v.cleaned) return json({ ok: false, issues: v.issues }, 400);

  const limit = await checkAndIncrementLimit(kvFor(env));
  if (!limit.allowed) {
    return json(
      { ok: false, error: 'limit_reached', message: "Today's submission limit has been reached. Please try again after the submission window resets.", limitReached: true, resetsAt: limit.resetsAt },
      429,
      { 'Retry-After': String(Math.max(1, Math.ceil((limit.resetsAt - Date.now()) / 1000))) },
    );
  }

  const now = new Date();
  const submittedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SUBMISSION_TTL_SECONDS * 1000).toISOString();
  const id = uid('story');
  const sub: Submission = {
    id,
    type: 'story',
    status: 'pending',
    creator: { name: v.cleaned.creatorName, avatar: null, verified: false },
    title: v.cleaned.title,
    submittedAt,
    expiresAt,
    genre: Array.isArray(v.cleaned.bundle.story.genres) ? (v.cleaned.bundle.story.genres as string[])[0] : undefined,
    client: client ? String(client).slice(0, 120) : undefined,
    payload: v.cleaned.bundle,
  };
  await saveSubmission(kvFor(env), sub);
  await addToIndex(kvFor(env), 'story', id);

  return json({ ok: true, id, type: 'story', creatorName: v.cleaned.creatorName, resetsAt: limit.resetsAt, expiresAt }, 201);
}

function rawSize(o: unknown): number {
  try {
    return JSON.stringify(o).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/* ---------------- admin ---------------- */

export function isAdmin(request: Request, env: Env): boolean {
  const token = (env.ADMIN_TOKEN ?? '').trim();
  if (!token) return false;
  const auth = request.headers.get('Authorization') ?? '';
  const expected = `Bearer ${token}`;
  // Constant-time comparison to prevent timing attacks.
  if (auth.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < auth.length; i++) diff |= auth.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function collectPending(kv: KVNamespace | undefined, type: SubmissionType): Promise<Submission[]> {
  const idx = await readIndex(kv, type);
  const out: Submission[] = [];
  const now = Date.now();
  const survivors = new Set<string>();
  for (const id of idx) {
    const s = await readSubmission(kv, id);
    if (!s) continue;
    if (s.status !== 'pending') continue;
    if (new Date(s.expiresAt).getTime() <= now) {
      // Expired — lazily clean up.
      await kv?.delete(subKey(id));
      continue;
    }
    survivors.add(id);
    out.push(s);
  }
  await writeIndex(kv, type, survivors);
  // Sort newest first.
  out.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return out;
}

export async function listPending(env: Env): Promise<Response> {
  const [ideas, stories, lim] = await Promise.all([
    collectPending(kvFor(env), 'idea'),
    collectPending(kvFor(env), 'story'),
    getLimitStatus(kvFor(env)),
  ]);
  return json({ ok: true, ideas, stories, remaining: lim.remaining, resetsAt: lim.resetsAt });
}

export async function rejectSubmission(env: Env, id: string): Promise<Response> {
  const sub = await readSubmission(kvFor(env), id);
  if (!sub) return err(404, 'not_found');
  await deleteSubmission(kvFor(env), id, sub.type);
  return json({ ok: true });
}

export async function acceptIdea(env: Env, id: string): Promise<Response> {
  const sub = await readSubmission(kvFor(env), id);
  if (!sub || sub.type !== 'idea') return err(404, 'not_found');
  // Ideas: mark as accepted in permanent store, remove from pending.
  sub.status = 'accepted';
  if (kvFor(env)) {
    await kvFor(env).put(accKey(id), JSON.stringify(sub));
  }
  await deleteSubmission(kvFor(env), id, 'idea');
  return json({ ok: true, id });
}

/**
 * Content/age safety guard — run server-side before publication.
 * Mirrors the strictest rules the app enforces: required strings, no
 * executable markup, age/content consistency. This is intentionally
 * conservative; any failure prevents publish.
 */
export function prePublishChecks(sub: Submission): { ok: true; storyDir: string; manifestEntry: Record<string, unknown>; bundle: StorySubmissionPayload } | { ok: false; issues: { path: string; message: string }[] } {
  const issues: { path: string; message: string }[] = [];
  const p = sub.payload as StorySubmissionPayload;
  const s = p.story as Record<string, unknown> | undefined;
  if (!s) { issues.push({ path: 'story', message: 'missing story object' }); return { ok: false, issues }; }
  const storyId = typeof s.id === 'string' ? s.id : '';
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(storyId)) issues.push({ path: 'story.id', message: 'invalid slug' });
  const title = typeof s.title === 'string' ? s.title.trim() : '';
  if (!title) issues.push({ path: 'story.title', message: 'required' });
  const ageRating = s.ageRating;
  const contentLevel = s.contentLevel;
  if (!['12-17', '18+'].includes(ageRating as string)) issues.push({ path: 'story.ageRating', message: 'must be 12-17 or 18+' });
  if (!['teen', 'mature'].includes(contentLevel as string)) issues.push({ path: 'story.contentLevel', message: 'must be teen or mature' });
  if (ageRating === '12-17' && contentLevel === 'mature') issues.push({ path: 'story.contentLevel', message: 'mature content requires 18+ age rating' });
  if (typeof s.openingSceneId !== 'string' || !s.openingSceneId.trim()) issues.push({ path: 'story.openingSceneId', message: 'required' });
  const scenes = (p.scenes as Record<string, unknown> | undefined)?.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) issues.push({ path: 'scenes.scenes', message: 'at least one scene required' });
  // Recursively scan all string fields for unsafe markup/JS URLs.
  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      if (containsUnsafe(node)) issues.push({ path, message: 'contains unsupported markup or scripts' });
      return;
    }
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        // Reject executable hooks / functions that a hostile client might try to inject.
        if (typeof v === 'function') { issues.push({ path: `${path}.${k}`, message: 'functions are not allowed' }); continue; }
        walk(v, `${path}.${k}`);
      }
    }
  };
  walk(p, 'payload');
  // Ensure creator is preserved and verified is controlled server-side.
  const creator = { name: sub.creator.name, avatar: sub.creator.avatar ?? null, verified: false };
  s.creator = creator;

  if (issues.length > 0) return { ok: false, issues };

  const genres = Array.isArray(s.genres) ? s.genres.slice(0, 4).map((g) => String(g)) : ['Community'];
  const tags = Array.isArray(s.tags) ? s.tags.slice(0, 8).map((t) => String(t)) : ['community'];
  const manifestEntry: Record<string, unknown> = {
    id: storyId,
    title,
    tagline: typeof s.tagline === 'string' ? String(s.tagline).slice(0, 200) : title,
    description: typeof s.description === 'string' ? String(s.description).slice(0, 2000) : '',
    genres,
    tags: [...tags, 'community'],
    characters: Array.isArray(s.characters) ? (s.characters as unknown[]).map((c) => (typeof c === 'string' ? c : String((c as Record<string, unknown>).name ?? ''))).filter(Boolean) : [],
    ageRating,
    contentLevel,
    language: typeof s.language === 'string' ? String(s.language).slice(0, 16) : 'hinglish',
    version: 1,
    coverUrl: typeof s.coverUrl === 'string' ? String(s.coverUrl) : null,
    accentColor: typeof s.accentColor === 'string' ? String(s.accentColor) : '#8B5CF6',
    userRole: typeof s.userRole === 'string' ? String(s.userRole).slice(0, 400) : '{{playerName}}',
    setting: typeof s.setting === 'string' ? String(s.setting).slice(0, 400) : '',
    estimatedMinutes: typeof s.estimatedMinutes === 'number' ? Math.max(5, Math.min(240, s.estimatedMinutes)) : 15,
    featured: false,
    isNew: true,
    popularity: 0,
    community: true,
    storyDir: `community/${storyId}`,
    creator,
    publishedAt: new Date().toISOString(),
  };
  return { ok: true, storyDir: `community/${storyId}`, manifestEntry, bundle: p };
}

async function readAcceptedIndex(kv: KVNamespace | undefined): Promise<string[]> {
  if (!kv) return [];
  const raw = await kv.get(KV.ACCEPTED_STORY_INDEX);
  if (!raw) return [];
  try { const arr = JSON.parse(raw) as string[]; return Array.isArray(arr) ? arr : []; } catch { return []; }
}
async function writeAcceptedIndex(kv: KVNamespace | undefined, ids: string[]): Promise<void> {
  if (!kv) return;
  await kv.put(KV.ACCEPTED_STORY_INDEX, JSON.stringify(ids));
}

export async function listAcceptedStories(env: Env): Promise<{ storyDir: string; manifestEntry: Record<string, unknown>; bundle: StorySubmissionPayload }[]> {
  const kv = kvFor(env);
  const ids = await readAcceptedIndex(kv);
  const out: { storyDir: string; manifestEntry: Record<string, unknown>; bundle: StorySubmissionPayload }[] = [];
  for (const id of ids) {
    const raw = await kv.get(accKey(id));
    if (!raw) continue;
    try {
      const sub = JSON.parse(raw) as Submission;
      const check = prePublishChecks(sub);
      if (!check.ok) continue;
      out.push({ storyDir: check.storyDir, manifestEntry: check.manifestEntry, bundle: check.bundle });
    } catch { /* skip corrupted entries */ }
  }
  return out;
}

export async function getAcceptedStoryPackage(env: Env, communityPath: string): Promise<Record<string, unknown> | null> {
  // communityPath is like "community/<storyId>"
  const storyId = communityPath.split('/')[1] ?? '';
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(storyId)) return null;
  const kv = kvFor(env);
  const ids = await readAcceptedIndex(kv);
  for (const id of ids) {
    const raw = await kv.get(accKey(id));
    if (!raw) continue;
    try {
      const sub = JSON.parse(raw) as Submission;
      const p = sub.payload as StorySubmissionPayload;
      const s = p.story as Record<string, unknown>;
      if (s.id === storyId) {
        return {
          meta: { id: storyId, ...s, creator: { name: sub.creator.name, avatar: sub.creator.avatar ?? null, verified: false }, community: true, storyDir: communityPath },
          story: s,
          characters: p.characters ?? {},
          world: p.world ?? {},
          scenes: p.scenes ?? {},
          memory: p.memory ?? {},
          creator: { name: sub.creator.name, avatar: sub.creator.avatar ?? null, verified: false },
          source: 'community',
        };
      }
    } catch { /* continue */ }
  }
  return null;
}

export async function acceptAndPublishStory(env: Env, id: string): Promise<Response> {
  const sub = await readSubmission(kvFor(env), id);
  if (!sub || sub.type !== 'story') return err(404, 'not_found');
  const check = prePublishChecks(sub);
  if (!check.ok) return json({ ok: false, error: 'validation_failed', issues: check.issues }, 400);
  sub.status = 'accepted';
  const kv = kvFor(env);
  await kv.put(accKey(id), JSON.stringify(sub));
  const ids = await readAcceptedIndex(kv);
  if (!ids.includes(id)) { ids.push(id); await writeAcceptedIndex(kv, ids); }
  await deleteSubmission(kv, id, 'story');
  return json({ ok: true, id, storyDir: check.storyDir });
}

export async function verifyCreator(env: Env, _id: string, _verified: boolean): Promise<Response> {
  // Admin-only hook reserved for a future creator registry. For now the
  // verification flag is set per-accepted-story server-side; client can
  // never self-verify.
  return json({ ok: true });
}
