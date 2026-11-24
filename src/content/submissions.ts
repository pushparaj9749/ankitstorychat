/**
 * Client for the Kissa submission API (Cloudflare Worker).
 *
 * Endpoints (v2.14+ require a signed-in account):
 *   POST /api/submit/idea
 *   POST /api/submit/story
 *   POST /api/submit/media
 *   GET  /api/submit/limit
 *
 * The session token from `lib/account` is attached automatically, along with
 * `X-Kissa-Version`, so the server can tell an out-of-date install (426) from
 * a signed-out one (401).
 *
 * Admin endpoints (Bearer ADMIN_TOKEN):
 *   GET  /api/admin/pending
 *   GET  /api/admin/media/:mediaId
 *   POST /api/admin/idea/:id/(accept|reject)
 *   POST /api/admin/story/:id/(accept|reject)
 *
 * Admin token is stored on-device in SecureStore just like AI API keys. It
 * is never exposed to other users and is only sent to the Kissa API over
 * HTTPS. Users who don't configure a token simply cannot access admin
 * screens; the server enforces the same check.
 */
import * as SecureStore from 'expo-secure-store';
import { contentApiUrl, effectiveContentApiBaseUrl } from './api';
import { appVersion, getToken } from '../lib/account';
import type {
  PendingListResponse,
  StorySubmission,
  SubmitResponse,
} from '../types';

const ADMIN_TOKEN_KEY = 'kissa_admin_token';

const JSON_TYPE = 'application/json; charset=utf-8';
const MAX_CLIENT_PAYLOAD = 480_000; // stay below the server's 500KB cap

class SubmissionApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly issues?: { path: string; message: string }[];
  readonly limitReached?: boolean;
  readonly resetsAt?: number;
  /** The server refused with 426: this install must be updated. */
  readonly updateRequired?: boolean;

  constructor(init: {
    message: string;
    status: number;
    code?: string;
    issues?: { path: string; message: string }[];
    limitReached?: boolean;
    resetsAt?: number;
    updateRequired?: boolean;
  }) {
    super(init.message);
    this.status = init.status;
    this.code = init.code;
    this.issues = init.issues;
    this.limitReached = init.limitReached;
    this.resetsAt = init.resetsAt;
    this.updateRequired = init.updateRequired;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  opts: { apiBase?: string; admin?: boolean } = {},
): Promise<T> {
  const base = effectiveContentApiBaseUrl(opts.apiBase);
  const url = contentApiUrl(base, path);
  const headers = new Headers(init.headers ?? {});
  headers.set('Accept', JSON_TYPE);
  headers.set('X-Kissa-Client', 'kissa-app');
  headers.set('X-Kissa-Version', appVersion());
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', JSON_TYPE);
  if (!opts.admin) {
    const token = await getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  if (opts.admin) {
    const token = await getAdminToken();
    if (!token) throw new SubmissionApiError({ message: 'Admin token not configured.', status: 401 });
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(url, { ...init, headers });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body (e.g. Cloudflare rate-limit page)
  }
  if (!res.ok) {
    const b = body as Record<string, unknown> | null;
    const msg =
      (b && typeof b.message === 'string' && b.message) ||
      (res.status === 426 ? 'Kissa ka naya version chahiye. Update karke login karo.' :
       res.status === 401 ? 'Login dobara karo.' :
       res.status === 429 ? "Today's submission limit has been reached. Please try again after the submission window resets." :
       res.status === 413 ? 'Submission is too large.' :
       res.status === 401 ? 'Admin authorization required.' :
       res.status === 0 ? 'Network error.' : `Request failed (${res.status}).`);
    throw new SubmissionApiError({
      message: msg,
      status: res.status,
      code: b && typeof b.error === 'string' ? b.error : undefined,
      issues: b && Array.isArray(b.issues) ? (b.issues as { path: string; message: string }[]) : undefined,
      updateRequired: res.status === 426 && !!b && b.error === 'update_required',
      limitReached: !!(b && b.limitReached),
      resetsAt: b && typeof b.resetsAt === 'number' ? b.resetsAt : undefined,
    });
  }
  return body as T;
}

/* ---------------- admin token ---------------- */

export async function saveAdminToken(token: string): Promise<void> {
  const v = token.trim();
  if (!v) {
    await SecureStore.deleteItemAsync(ADMIN_TOKEN_KEY);
    return;
  }
  await SecureStore.setItemAsync(ADMIN_TOKEN_KEY, v);
}

export async function getAdminToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function hasAdminToken(): Promise<boolean> {
  return !!(await getAdminToken());
}

export async function clearAdminToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ADMIN_TOKEN_KEY);
  } catch {
    /* not set */
  }
}

/* ---------------- public ---------------- */

export interface IdeaInput {
  creatorName: string;
  title: string;
  concept: string;
  genre: string;
  characters?: string;
  notes?: string;
}

export interface StoryInput {
  creatorName: string;
  bundle: {
    story: Record<string, unknown>;
    characters?: Record<string, unknown>;
    world?: Record<string, unknown>;
    scenes?: Record<string, unknown>;
    memory?: Record<string, unknown>;
  };
}

export async function getLimitStatus(apiBase?: string): Promise<{
  count: number;
  remaining: number;
  resetsAt: number;
}> {
  return request<{ ok: boolean; count: number; remaining: number; resetsAt: number }>(
    'submit/limit',
    {},
    { apiBase },
  );
}

export type SubmissionStatusWord = 'pending' | 'accepted' | 'rejected' | 'expired';

/**
 * Status of this device's own submissions (GET /api/submit/status?ids=…).
 * The server answers with status words only — no titles, names or content.
 */
export async function fetchSubmissionStatuses(
  ids: string[],
  apiBase?: string,
): Promise<Record<string, SubmissionStatusWord>> {
  const clean = [...new Set(ids.filter((id) => /^(idea|story)_[a-z0-9_]+$/.test(id)))].slice(0, 50);
  if (clean.length === 0) return {};
  const res = await request<{ ok: boolean; statuses?: Record<string, string> }>(
    `submit/status?ids=${clean.map(encodeURIComponent).join(',')}`,
    {},
    { apiBase },
  );
  const out: Record<string, SubmissionStatusWord> = {};
  for (const [id, st] of Object.entries(res.statuses ?? {})) {
    if (st === 'pending' || st === 'accepted' || st === 'rejected' || st === 'expired') out[id] = st;
  }
  return out;
}

export async function submitIdea(input: IdeaInput, apiBase?: string): Promise<SubmitResponse> {
  const body: Record<string, unknown> = {
    creatorName: input.creatorName.trim(),
    title: input.title.trim(),
    concept: input.concept.trim(),
    genre: input.genre.trim(),
  };
  if (input.characters?.trim()) body.characters = input.characters.trim();
  if (input.notes?.trim()) body.notes = input.notes.trim();
  const serialized = JSON.stringify(body);
  if (serialized.length > MAX_CLIENT_PAYLOAD) throw new SubmissionApiError({ message: 'Submission is too large.', status: 413 });
  return request<SubmitResponse>('submit/idea', { method: 'POST', body: serialized }, { apiBase });
}

export async function submitStory(input: StoryInput, apiBase?: string): Promise<SubmitResponse> {
  const payload = {
    creatorName: input.creatorName.trim(),
    creator: { name: input.creatorName.trim(), avatar: null, verified: false },
    ...input.bundle,
  };
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_CLIENT_PAYLOAD) throw new SubmissionApiError({ message: 'Submission is too large (max 500KB).', status: 413 });
  return request<SubmitResponse>('submit/story', { method: 'POST', body: serialized }, { apiBase });
}

/** Result of a server-validated image upload. */
export interface UploadedMedia {
  mediaId: string;
  /** Safe reference to embed in the story's media block: `media/<mediaId>`. */
  ref: string;
  mime: string;
  width: number;
  height: number;
}

/**
 * Upload a cover / gallery image (base64). The server validates the file
 * signature, size and dimensions and returns a safe `media/<id>` reference.
 * Uploads are free (they do not consume the 50/24h submission limit) and
 * self-expire after 48h if never used in a submission.
 */
export async function uploadMedia(
  kind: 'cover' | 'gallery',
  base64: string,
  apiBase?: string,
): Promise<UploadedMedia> {
  const body = JSON.stringify({ kind, image: base64 });
  const res = await request<UploadedMedia & { ok: boolean }>('submit/media', {
    method: 'POST',
    body,
  }, { apiBase });
  return res;
}

/* ---------------- admin ---------------- */

export async function listPendingAdmin(apiBase?: string): Promise<PendingListResponse> {
  return request<PendingListResponse>('admin/pending', {}, { apiBase, admin: true });
}

export async function acceptIdeaAdmin(id: string, apiBase?: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`admin/idea/${encodeURIComponent(id)}/accept`, { method: 'POST' }, { apiBase, admin: true });
}

export async function rejectIdeaAdmin(id: string, apiBase?: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`admin/idea/${encodeURIComponent(id)}/reject`, { method: 'POST' }, { apiBase, admin: true });
}

export async function acceptStoryAdmin(id: string, apiBase?: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`admin/story/${encodeURIComponent(id)}/accept`, { method: 'POST' }, { apiBase, admin: true });
}

export async function rejectStoryAdmin(id: string, apiBase?: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`admin/story/${encodeURIComponent(id)}/reject`, { method: 'POST' }, { apiBase, admin: true });
}

/**
 * Fetch a PENDING submission's uploaded image as a `data:` URI for the admin
 * preview. Uses the admin token (the image is private until accepted).
 * Returns null when the media no longer exists (expired).
 */
export async function fetchAdminMediaAsDataUri(
  mediaId: string,
  apiBase?: string,
): Promise<string | null> {
  const base = effectiveContentApiBaseUrl(apiBase);
  const url = contentApiUrl(base, `admin/media/${encodeURIComponent(mediaId)}`);
  const token = await getAdminToken();
  if (!token) return null;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'image/*' } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = res.headers.get('Content-Type') ?? 'image/jpeg';
    const bytes = new Uint8Array(buf);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return `data:${mime};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

export { SubmissionApiError };

/** Utility: format remaining time until a UTC epoch timestamp. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ---------------- admin: accounts, personal notifications, recovery ---------------- */

export interface AdminAccountRow {
  id: string;
  username: string;
  displayName: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  counts: { total: number; pending: number; accepted: number; rejected: number };
}

export interface AdminAccountSubmission {
  id: string;
  type: 'idea' | 'story';
  title: string;
  genre: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  submittedAt: string;
  decidedAt: string | null;
}

/** Every account with how many (and which) submissions it made. */
export async function listAdminAccounts(
  apiBase?: string,
): Promise<{ accounts: AdminAccountRow[]; unclaimed: number }> {
  return request<{ accounts: AdminAccountRow[]; unclaimed: number }>('admin/accounts', {}, { apiBase, admin: true });
}

export async function getAdminAccount(
  id: string,
  apiBase?: string,
): Promise<{ account: Omit<AdminAccountRow, 'counts'>; submissions: AdminAccountSubmission[] }> {
  return request<{ account: Omit<AdminAccountRow, 'counts'>; submissions: AdminAccountSubmission[] }>(
    `admin/accounts/${encodeURIComponent(id)}`,
    {},
    { apiBase, admin: true },
  );
}

/** Send one account a personal message (shows up under the Home bell). */
export async function notifyAccountAdmin(
  id: string,
  title: string,
  body: string,
  apiBase?: string,
): Promise<{ ok: boolean; id: string }> {
  return request<{ ok: boolean; id: string }>(
    `admin/accounts/${encodeURIComponent(id)}/notify`,
    { method: 'POST', body: JSON.stringify({ title, body }) },
    { apiBase, admin: true },
  );
}

export interface AdminRecoveryRequest {
  id: string;
  username: string;
  proofId: string;
  createdAt: string;
}

export async function listRecoveryRequestsAdmin(apiBase?: string): Promise<AdminRecoveryRequest[]> {
  const res = await request<{ requests: AdminRecoveryRequest[] }>('admin/recovery', {}, { apiBase, admin: true });
  return res.requests ?? [];
}

/** Approving returns the one-time code the admin hands to the user. */
export async function decideRecoveryAdmin(
  id: string,
  action: 'approve' | 'reject',
  apiBase?: string,
): Promise<{ status: string; recoveryCode?: string }> {
  return request<{ status: string; recoveryCode?: string }>(
    `admin/recovery/${encodeURIComponent(id)}/${action}`,
    { method: 'POST', body: '{}' },
    { apiBase, admin: true },
  );
}

/** Move the "minimum app version" switch that blocks older installs. */
export async function setMinVersionAdmin(
  minVersion: string,
  message: string,
  apiBase?: string,
): Promise<{ ok: boolean; minVersion: string }> {
  return request<{ ok: boolean; minVersion: string }>(
    'admin/version',
    { method: 'POST', body: JSON.stringify({ minVersion, message }) },
    { apiBase, admin: true },
  );
}
