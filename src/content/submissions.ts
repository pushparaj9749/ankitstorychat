/**
 * Client for the Kissa submission API (Cloudflare Worker).
 *
 * Public endpoints (no auth):
 *   POST /api/submit/idea
 *   POST /api/submit/story
 *   GET  /api/submit/limit
 *
 * Admin endpoints (Bearer ADMIN_TOKEN):
 *   GET  /api/admin/pending
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

  constructor(init: {
    message: string;
    status: number;
    code?: string;
    issues?: { path: string; message: string }[];
    limitReached?: boolean;
    resetsAt?: number;
  }) {
    super(init.message);
    this.status = init.status;
    this.code = init.code;
    this.issues = init.issues;
    this.limitReached = init.limitReached;
    this.resetsAt = init.resetsAt;
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
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', JSON_TYPE);
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
      (res.status === 429 ? "Today's submission limit has been reached. Please try again after the submission window resets." :
       res.status === 413 ? 'Submission is too large.' :
       res.status === 401 ? 'Admin authorization required.' :
       res.status === 0 ? 'Network error.' : `Request failed (${res.status}).`);
    throw new SubmissionApiError({
      message: msg,
      status: res.status,
      code: b && typeof b.error === 'string' ? b.error : undefined,
      issues: b && Array.isArray(b.issues) ? (b.issues as { path: string; message: string }[]) : undefined,
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
