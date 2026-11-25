/**
 * Account client — username + password only (no email anywhere).
 *
 * The session token lives in SecureStore (Android Keystore / iOS Keychain) and
 * is attached to every account call as `Authorization: Bearer …`. Story chats,
 * memories, saves, settings and AI keys stay on the device — the server only
 * ever stores the account, its submissions and its notifications.
 *
 * Every request carries `X-Kissa-Version`, so an install that is older than
 * the server's minimum version is blocked (`update_required`) instead of
 * silently misbehaving.
 */
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { contentApiUrl, effectiveContentApiBaseUrl } from '../content/api';
import { kvGet, kvSet } from './db';
import { installedAppVersion } from './appVersion';

const TOKEN_KEY = 'kissa_account_token';
const ACCOUNT_KEY = 'kissa_account';
const CLAIMED_KEY = 'kissa_account_claimed';

const JSON_TYPE = 'application/json; charset=utf-8';

/** Support contact shown in the app (no email is collected from users). */
export const SUPPORT_EMAIL = 'ytdjbhai34@gmail.com';

export interface AccountInfo {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string | null;
  status: string;
}

export interface NotificationItem {
  id: string;
  kind: 'story_accepted' | 'story_rejected' | 'system' | string;
  submissionId: string | null;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

/** The installed APK version (sent to the API for the version gate). */
export function appVersion(): string {
  return installedAppVersion();
}

export class AccountError extends Error {
  readonly status: number;
  readonly code?: string;
  /** 426 from the server: this install must be updated. */
  readonly updateRequired: boolean;
  constructor(init: { message: string; status: number; code?: string; updateRequired?: boolean }) {
    super(init.message);
    this.status = init.status;
    this.code = init.code;
    this.updateRequired = init.updateRequired ?? false;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  opts: { apiBase?: string | null; auth?: boolean } = {},
): Promise<T> {
  const base = effectiveContentApiBaseUrl(opts.apiBase);
  const url = contentApiUrl(base, path);
  const headers = new Headers(init.headers ?? {});
  headers.set('Accept', JSON_TYPE);
  headers.set('X-Kissa-Client', 'kissa-app');
  headers.set('X-Kissa-Version', appVersion());
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', JSON_TYPE);
  if (opts.auth !== false) {
    const token = await getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new AccountError({ message: 'Internet nahi hai. Connection check karke dobara try karo.', status: 0 });
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON (Cloudflare page etc.)
  }
  if (!res.ok) {
    const code = typeof body?.error === 'string' ? body.error : undefined;
    if (res.status === 426 || code === 'update_required') {
      await kvSet('update.required', '1');
      throw new AccountError({
        message: typeof body?.message === 'string' ? body.message : 'Kissa ka naya version update karo.',
        status: 426,
        code: 'update_required',
        updateRequired: true,
      });
    }
    throw new AccountError({
      message:
        typeof body?.message === 'string'
          ? body.message
          : res.status === 401
            ? 'Login dobara karo.'
            : 'Kuch galat ho gaya. Dobara try karo.',
      status: res.status,
      code,
    });
  }
  return (body ?? {}) as T;
}

/* ---------------- token & cached account ---------------- */

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // already gone
  }
  await kvSet(ACCOUNT_KEY, '');
}

export async function cachedAccount(): Promise<AccountInfo | null> {
  const raw = await kvGet(ACCOUNT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AccountInfo;
  } catch {
    return null;
  }
}

async function rememberAccount(a: AccountInfo): Promise<void> {
  await kvSet(ACCOUNT_KEY, JSON.stringify(a));
}

/* ---------------- auth ---------------- */

export interface SignupResult {
  account: AccountInfo;
  token: string;
  /** Shown exactly once at signup — there is no email to send it to. */
  recoveryCode: string;
}

export function validateUsername(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return 'Username likho.';
  if (!/^[a-z0-9_]{3,20}$/.test(v)) return '3-20 characters: a-z, 0-9 ya _';
  if (/^[0-9_]+$/.test(v)) return 'Sirf numbers/underscore nahi chalega.';
  return null;
}

export function validatePassword(raw: string, username?: string): string | null {
  if (raw.length < 8) return 'Kam se kam 8 characters.';
  if (raw.length > 128) return 'Bahut lamba password.';
  if (!/[A-Za-z]/.test(raw) || !/[0-9]/.test(raw)) return 'Ek letter aur ek number zaroori hai.';
  if (username && raw.toLowerCase().includes(username.toLowerCase()))
    return 'Password me username nahi hona chahiye.';
  return null;
}

/** True when the username is free (server truth; the app also pre-checks). */
export async function checkUsername(
  username: string,
  apiBase?: string | null,
): Promise<{ valid: boolean; available: boolean; message?: string }> {
  const q = encodeURIComponent(username.trim().toLowerCase());
  const res = await request<{ valid: boolean; available: boolean; message?: string }>(
    `auth/username?u=${q}`,
    {},
    { apiBase, auth: false },
  );
  return { valid: !!res.valid, available: !!res.available, message: res.message };
}

export async function signup(
  input: { username: string; password: string; displayName?: string },
  apiBase?: string | null,
): Promise<SignupResult> {
  const res = await request<SignupResult>(
    'auth/signup',
    { method: 'POST', body: JSON.stringify(input) },
    { apiBase, auth: false },
  );
  await setToken(res.token);
  await rememberAccount(res.account);
  return res;
}

export async function login(
  input: { username: string; password: string },
  apiBase?: string | null,
): Promise<{ account: AccountInfo; token: string }> {
  const res = await request<{ account: AccountInfo; token: string }>(
    'auth/login',
    { method: 'POST', body: JSON.stringify(input) },
    { apiBase, auth: false },
  );
  await setToken(res.token);
  await rememberAccount(res.account);
  return res;
}

export async function logout(apiBase?: string | null): Promise<void> {
  try {
    await request('auth/logout', { method: 'POST', body: '{}' }, { apiBase });
  } catch {
    // Even offline, the local session goes away.
  }
  await clearToken();
}

/** Server-truth session check on launch (never trust the cached copy alone). */
export async function refreshAccount(
  apiBase?: string | null,
): Promise<{ account: AccountInfo; unread: number } | null> {
  if (!(await getToken())) return null;
  try {
    const res = await request<{ account: AccountInfo; unread: number }>('me', {}, { apiBase });
    await rememberAccount(res.account);
    return res;
  } catch (e) {
    if (e instanceof AccountError && (e.status === 401 || e.status === 403)) {
      await clearToken();
      return null;
    }
    throw e;
  }
}

export async function updateDisplayName(displayName: string, apiBase?: string | null): Promise<AccountInfo> {
  const res = await request<{ account: AccountInfo }>(
    'me/profile',
    { method: 'PATCH', body: JSON.stringify({ displayName }) },
    { apiBase },
  );
  await rememberAccount(res.account);
  return res.account;
}

export async function deleteAccount(apiBase?: string | null): Promise<void> {
  await request('me', { method: 'DELETE' }, { apiBase });
  await clearToken();
}

/* ---------------- recovery (no email) ---------------- */

/** Reset with the one-time recovery code from signup (or an admin-issued one). */
export async function resetWithRecoveryCode(
  input: { username: string; recoveryCode: string; newPassword: string },
  apiBase?: string | null,
): Promise<{ token: string; recoveryCode: string }> {
  const res = await request<{ token: string; recoveryCode: string }>(
    'auth/recovery',
    { method: 'POST', body: JSON.stringify(input) },
    { apiBase, auth: false },
  );
  await setToken(res.token);
  return res;
}

/** Same-device reset: this device is already signed in, so it is proof enough. */
export async function resetOnThisDevice(
  newPassword: string,
  apiBase?: string | null,
): Promise<{ recoveryCode: string }> {
  return request<{ recoveryCode: string }>(
    'auth/device-reset',
    { method: 'POST', body: JSON.stringify({ newPassword }) },
    { apiBase },
  );
}

export async function rotateRecoveryCode(apiBase?: string | null): Promise<{ recoveryCode: string }> {
  return request<{ recoveryCode: string }>('auth/recovery-rotate', { method: 'POST', body: '{}' }, { apiBase });
}

/** Ask the team for help when the code and the device are both gone. */
export async function requestRecovery(
  input: { username: string; submissionId: string },
  apiBase?: string | null,
): Promise<{ received: boolean }> {
  return request<{ received: boolean }>(
    'recover',
    { method: 'POST', body: JSON.stringify(input) },
    { apiBase, auth: false },
  );
}

/* ---------------- submissions & notifications ---------------- */

export interface AccountSubmission {
  id: string;
  type: 'idea' | 'story';
  title: string;
  genre: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  submittedAt: string;
  decidedAt: string | null;
}

export async function mySubmissions(apiBase?: string | null): Promise<AccountSubmission[]> {
  const res = await request<{ submissions: AccountSubmission[] }>('me/submissions', {}, { apiBase });
  return res.submissions ?? [];
}

/** Attach submissions made before the account existed (or from another install). */
export async function claimSubmissions(ids: string[], apiBase?: string | null): Promise<{ claimed: string[] }> {
  if (ids.length === 0) return { claimed: [] };
  return request<{ claimed: string[] }>(
    'me/claim',
    { method: 'POST', body: JSON.stringify({ ids }) },
    { apiBase },
  );
}

export async function listNotifications(
  apiBase?: string | null,
): Promise<{ unread: number; notifications: NotificationItem[] }> {
  return request<{ unread: number; notifications: NotificationItem[] }>('me/notifications', {}, { apiBase });
}

export async function markNotificationRead(id: string, apiBase?: string | null): Promise<number> {
  const res = await request<{ unread: number }>(
    `me/notifications/${encodeURIComponent(id)}`,
    { method: 'POST', body: '{}' },
    { apiBase },
  );
  return res.unread ?? 0;
}

export async function markAllNotificationsRead(apiBase?: string | null): Promise<void> {
  await request('me/notifications/read', { method: 'POST', body: '{}' }, { apiBase });
}

/** Public version switch (does not need a session). */
export async function fetchMinVersion(
  apiBase?: string | null,
): Promise<{ minVersion: string; message: string; updateRequired?: boolean }> {
  return request<{ minVersion: string; message: string; updateRequired?: boolean }>(
    'app/version',
    {},
    { apiBase, auth: false },
  );
}

/* ---------------- one-time migration of pre-account history ---------------- */

/**
 * After the first successful signup, every submission id still stored on this
 * device is attached to the new account. Runs once; safe to repeat (the server
 * only ever claims anonymous ids).
 */
export async function claimLocalHistory(apiBase?: string | null): Promise<void> {
  if ((await kvGet(CLAIMED_KEY)) === '1') return;
  const raw = await kvGet('my_submissions_v1');
  if (!raw) {
    await kvSet(CLAIMED_KEY, '1');
    return;
  }
  let ids: string[] = [];
  try {
    const list = JSON.parse(raw) as { id?: string }[];
    ids = Array.isArray(list) ? list.map((x) => x.id).filter((x): x is string => !!x) : [];
  } catch {
    ids = [];
  }
  if (ids.length > 0) {
    try {
      await claimSubmissions(ids, apiBase);
    } catch {
      return; // retry on the next launch
    }
  }
  await kvSet(CLAIMED_KEY, '1');
}

/** Refresh just the unread badge (bell icon in the Home header). */
export async function refreshUnread(apiBase?: string | null): Promise<number> {
  try {
    const res = await listNotifications(apiBase);
    return res.unread ?? 0;
  } catch {
    return 0;
  }
}

/** Notifications feed for the Notifications screen. */
export async function notificationsFeed(
  apiBase?: string | null,
): Promise<{ unread: number; items: NotificationItem[] }> {
  const res = await listNotifications(apiBase);
  return { unread: res.unread ?? 0, items: res.notifications ?? [] };
}

/** Was a 426 seen at some point? Survives a relaunch until an update lands. */
export async function cachedUpdateRequired(): Promise<boolean> {
  return (await kvGet('update.required')) === '1';
}

/**
 * Forget the remembered 426.
 *
 * The cached flag is a FALLBACK for "we could not reach the server", never a
 * verdict. It used to be write-only: one 426 (from any build, any day) pinned
 * the update wall forever, even after the server's minimum went back below the
 * installed version — users stayed locked out of a perfectly current app.
 */
export async function clearUpdateRequired(): Promise<void> {
  await kvSet('update.required', '');
}

/**
 * Launch check: is this install older than the server's minimum?
 *
 * THE RULE (v2.16.1): the SERVER is the only authority that can block the app.
 *
 * Why the local comparison had to go: the client used to compare its own
 * version with the server's minimum and show the full-screen wall itself. Any
 * glitch in that version — and there were two (a remembered 426, then
 * `expoConfig` being null after an OTA, which read as '0.0.0') — compared
 * against `minVersion: 2.14.0`, so `0.0.0 < 2.14.0` was true, the wall went up
 * BEFORE the app mounted, OTA could never run, and the reader was locked out of
 * a build that was perfectly current. That is the deadlock that produced a full
 * day of support mails.
 *
 * So this function no longer decides. It asks the server version route, and:
 *   - server says { updateRequired: true }  -> wall (explicit verdict)
 *   - server says anything else             -> NO wall, and the remembered
 *                                              426 is cleared
 *   - server unreachable                    -> remembered 426 may still block,
 *                                              so a genuinely outdated install
 *                                              does not slip through offline
 *
 * A truly outdated install still gets blocked: every account / submission call
 * answers 426 from the server, and the app shows the wall on that error
 * (`markUpdateRequired`). The difference is that the block now comes with the
 * server's verdict instead of a guess made on the phone.
 */
export async function isUpdateRequired(
  apiBase?: string | null,
): Promise<{ required: boolean; minVersion: string | null; currentVersion: string }> {
  const currentVersion = appVersion();
  try {
    const answer = await fetchMinVersion(apiBase);
    const minVersion = answer.minVersion ?? null;
    // The server may state the verdict outright. That wins over everything.
    if (answer.updateRequired === true) {
      await kvSet('update.required', '1');
      return { required: true, minVersion, currentVersion };
    }
    // A known-bad version string can never be the reason to lock someone out:
    // '0.0.0' and '' mean "we could not read the install", not "it is ancient".
    // The server's 426 on real calls still protects genuinely old builds.
    await clearUpdateRequired();
    return { required: false, minVersion, currentVersion };
  } catch {
    // Offline / server unreachable: this is the only case where the remembered
    // flag may still block, so a known-outdated install does not sneak in.
    return {
      required: await cachedUpdateRequired().catch(() => false),
      minVersion: null,
      currentVersion,
    };
  }
}
