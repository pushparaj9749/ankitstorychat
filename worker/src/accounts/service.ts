/**
 * Kissa accounts — service layer (HTTP-facing helpers, no routing).
 *
 * Rules enforced here:
 *   - ONE account per person, created from username + password only. No email
 *     is ever collected, so password recovery works with a one-time recovery
 *     code (shown exactly once at signup), a same-device reset, or an
 *     admin-approved recovery request.
 *   - Sessions are bearer tokens; only their SHA-256 is stored.
 *   - Lockouts: 5 failed logins / 15 min per (IP, username), then 15 min.
 *   - Submissions can be claimed by the account that still knows their ids
 *     (pre-update users), and are listed back with their live status.
 */
import {
  type AccountRow,
  MAX_SESSIONS_PER_ACCOUNT,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PBKDF2_ITERATIONS,
  RECOVERY_ITERATIONS,
  SESSION_TTL_DAYS,
  USERNAME_RE,
  dbFor,
  hasRealDb,
  memD1,
  makeRecoveryCode,
  normalizeRecoveryCode,
  pbkdf2,
  publicAccount,
  randomBytes,
  randomToken,
  sha256Hex,
  timingSafeEqual,
  type PublicAccount,
} from './store';
import type { Env } from '../submissions';

/* ---------------- responses ---------------- */

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export function fail(status: number, code: string, message?: string): Response {
  const body: Record<string, unknown> = { error: code };
  if (message) body.message = message;
  return json(body, status, { 'Cache-Control': 'no-store' });
}

export function nowIso(now = Date.now()): string {
  return new Date(now).toISOString();
}

/* ---------------- validation ---------------- */

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string; message: string };

/** Names nobody may take (app/team impersonation, admin routes). */
export const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'kissa', 'support', 'help', 'official', 'team',
  'moderator', 'mod', 'staff', 'root', 'system', 'owner', 'beyondredeye',
  'null', 'undefined', 'api', 'me', 'auth',
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}

export function checkUsername(raw: unknown): Checked<string> {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return { ok: false, error: 'invalid_username', message: 'Username is required.' };
  if (!USERNAME_RE.test(v))
    return {
      ok: false,
      error: 'invalid_username',
      message: 'Username must be 3-20 characters: a-z, 0-9 or _ only.',
    };
  if (/^[0-9_]+$/.test(v))
    return { ok: false, error: 'invalid_username', message: 'Username cannot be only numbers or underscores.' };
  if (isReservedUsername(v))
    return { ok: false, error: 'username_reserved', message: 'That username is reserved. Pick another one.' };
  return { ok: true, value: v };
}

const WEAK_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwertyui', 'qwerty123', 'iloveyou', 'admin123', 'kissa123', 'letmein1',
  'welcome1', 'abcd1234', 'a1234567', '11111111', '00000000',
]);

export function checkPassword(raw: unknown, username?: string): Checked<string> {
  const v = typeof raw === 'string' ? raw : '';
  if (v.length < PASSWORD_MIN)
    return { ok: false, error: 'weak_password', message: `Password must be at least ${PASSWORD_MIN} characters.` };
  if (v.length > PASSWORD_MAX)
    return { ok: false, error: 'weak_password', message: `Password must be at most ${PASSWORD_MAX} characters.` };
  if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v))
    return {
      ok: false,
      error: 'weak_password',
      message: 'Password must contain at least one letter and one number.',
    };
  if (WEAK_PASSWORDS.has(v.toLowerCase()))
    return { ok: false, error: 'weak_password', message: 'That password is too common — pick another one.' };
  if (username && v.toLowerCase().includes(username.toLowerCase()))
    return { ok: false, error: 'weak_password', message: 'Password cannot contain your username.' };
  return { ok: true, value: v };
}

export function checkDisplayName(raw: unknown, fallback: string): Checked<string> {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return { ok: true, value: fallback };
  if (v.length > 60) return { ok: false, error: 'invalid_display_name', message: 'Display name is too long (max 60).' };
  if (/[<>]/.test(v)) return { ok: false, error: 'invalid_display_name', message: 'Display name cannot contain < or >.' };
  return { ok: true, value: v };
}

/* ---------------- lockout (in-isolate) ---------------- */

interface Attempt {
  count: number;
  until: number;
}
const attempts = new Map<string, Attempt>();
export const LOGIN_MAX_FAILS = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

function attemptKey(ip: string, username: string): string {
  return `login:${ip}:${username}`;
}

/** Returns the remaining lock seconds (0 = not locked). */
export function lockRemaining(ip: string, username: string, now = Date.now()): number {
  const a = attempts.get(attemptKey(ip, username));
  if (!a || a.until <= now) return 0;
  return Math.ceil((a.until - now) / 1000);
}

export function noteFailure(ip: string, username: string, now = Date.now()): void {
  const key = attemptKey(ip, username);
  const a = attempts.get(key) ?? { count: 0, until: 0 };
  a.count += 1;
  if (a.count >= LOGIN_MAX_FAILS) {
    a.until = now + LOGIN_LOCK_MS;
    a.count = 0;
  }
  attempts.set(key, a);
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
  }
}

export function noteSuccess(ip: string, username: string): void {
  attempts.delete(attemptKey(ip, username));
}

export function resetLockoutsForTests(): void {
  attempts.clear();
}

/* ---------------- sessions ---------------- */

export interface AuthResult {
  account: AccountRow;
  token?: string;
}

/** Reads `Authorization: Bearer <token>` and resolves the account (or null). */
export async function authenticate(env: Env, request: Request): Promise<AuthResult | null> {
  const auth = request.headers.get('Authorization') ?? '';
  const m = auth.match(/^Bearer\s+([A-Za-z0-9_-]{20,200})$/);
  if (!m) return null;
  const db = dbFor(env);
  const tokenHash = await sha256Hex(m[1]);
  const now = nowIso();
  const row = await db
    .prepare(
      `SELECT s.account_id AS account_id, a.* FROM sessions s
       JOIN accounts a ON a.id = s.account_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(tokenHash, now)
    .first<AccountRow & { account_id: string }>();
  if (!row || row.status !== 'active') return null;
  // Cheap last_seen refresh (fire and forget, no await on the hot path).
  void db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').bind(now, tokenHash).run();
  return { account: row, token: m[1] };
}

export async function createSession(env: Env, accountId: string, now = Date.now()): Promise<string> {
  const db = dbFor(env);
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const created = nowIso(now);
  const expires = nowIso(now + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  // Keep at most N live sessions per account (drop the oldest).
  const cnt = await db
    .prepare('SELECT COUNT(*) AS n FROM sessions WHERE account_id = ?')
    .bind(accountId)
    .first<{ n: number }>();
  if ((cnt?.n ?? 0) >= MAX_SESSIONS_PER_ACCOUNT) {
    await db
      .prepare(
        `DELETE FROM sessions WHERE token_hash IN (
           SELECT token_hash FROM sessions WHERE account_id = ? ORDER BY created_at ASC LIMIT ?
         )`,
      )
      .bind(accountId, Math.max(1, (cnt?.n ?? 0) - MAX_SESSIONS_PER_ACCOUNT + 1))
      .run();
  }
  await db
    .prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at, last_seen) VALUES (?, ?, ?, ?, ?)')
    .bind(tokenHash, accountId, created, expires, created)
    .run();
  return token;
}

/* ---------------- account operations ---------------- */

async function hashPassword(password: string, saltB64: string, iter: number): Promise<string> {
  return pbkdf2(password, saltB64, iter);
}

export interface CreatedAccount {
  account: PublicAccount;
  token: string;
  recoveryCode: string;
}

export async function findAccountByUsername(env: Env, username: string): Promise<AccountRow | null> {
  const db = dbFor(env);
  const row = await db
    .prepare('SELECT * FROM accounts WHERE username = ?')
    .bind(username.toLowerCase())
    .first<AccountRow>();
  return row ?? null;
}

export async function usernameAvailable(env: Env, username: string): Promise<boolean> {
  const db = dbFor(env);
  const row = await db
    .prepare('SELECT id FROM accounts WHERE username = ?')
    .bind(username.toLowerCase())
    .first<{ id: string }>();
  return !row;
}

export async function signup(
  env: Env,
  input: { username?: unknown; password?: unknown; displayName?: unknown },
  now = Date.now(),
): Promise<{ ok: true; value: CreatedAccount } | { ok: false; status: number; error: string; message: string }> {
  const u = checkUsername(input.username);
  if (!u.ok) return { ok: false, status: 400, error: u.error, message: u.message };
  const p = checkPassword(input.password, u.value);
  if (!p.ok) return { ok: false, status: 400, error: p.error, message: p.message };
  const d = checkDisplayName(input.displayName, u.value);
  if (!d.ok) return { ok: false, status: 400, error: d.error, message: d.message };

  if (!(await usernameAvailable(env, u.value)))
    return { ok: false, status: 409, error: 'username_taken', message: 'That username is already taken.' };

  const db = dbFor(env);
  const id = `acc_${randomToken(12)}`;
  const salt = btoa(String.fromCharCode(...randomBytes(16)));
  const passwordHash = await hashPassword(p.value, salt, PBKDF2_ITERATIONS);
  const recoveryCode = makeRecoveryCode();
  const rSalt = btoa(String.fromCharCode(...randomBytes(16)));
  const rHash = await pbkdf2(normalizeRecoveryCode(recoveryCode), rSalt, RECOVERY_ITERATIONS);

  try {
    await db
      .prepare(
        `INSERT INTO accounts
         (id, username, display_name, password_hash, password_salt, password_iter,
          recovery_hash, recovery_salt, recovery_iter, recovery_rotated_at, status, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      )
      .bind(
        id,
        u.value,
        d.value,
        passwordHash,
        salt,
        PBKDF2_ITERATIONS,
        rHash,
        rSalt,
        RECOVERY_ITERATIONS,
        nowIso(now),
        nowIso(now),
        nowIso(now),
      )
      .run();
  } catch (e) {
    if (hasRealDb(env)) {
      // Real D1: the only expected failure here is the unique index (two
      // devices picked the same name at once).
      return { ok: false, status: 409, error: 'username_taken', message: 'That username is already taken.' };
    }
    if (!memD1.usernameTaken) {
      console.error('signup failed (local shim)', e);
      return { ok: false, status: 500, error: 'signup_failed', message: 'Account could not be created.' };
    }
    return { ok: false, status: 409, error: 'username_taken', message: 'That username is already taken.' };
  }

  const account = await findAccountByUsername(env, u.value);
  if (!account) return { ok: false, status: 500, error: 'signup_failed', message: 'Account could not be created.' };
  const token = await createSession(env, id, now);
  return { ok: true, value: { account: publicAccount(account), token, recoveryCode } };
}

export async function login(
  env: Env,
  input: { username?: unknown; password?: unknown },
  ctx: { ip?: string } = {},
  now = Date.now(),
): Promise<{ ok: true; value: { account: PublicAccount; token: string } } | { ok: false; status: number; error: string; message: string }> {
  const u = checkUsername(input.username);
  if (!u.ok) return { ok: false, status: 400, error: u.error, message: u.message };
  const password = typeof input.password === 'string' ? input.password : '';
  if (!password) return { ok: false, status: 400, error: 'invalid_password', message: 'Password is required.' };
  const ip = ctx.ip ?? 'unknown';
  const locked = lockRemaining(ip, u.value, now);
  if (locked > 0)
    return {
      ok: false,
      status: 429,
      error: 'locked',
      message: `Too many attempts. Try again in ${Math.ceil(locked / 60)} minute(s).`,
    };

  const account = await findAccountByUsername(env, u.value).catch(() => null);
  const generic = {
    ok: false as const,
    status: 401,
    error: 'invalid_credentials',
    message: 'Username or password is incorrect.',
  };
  if (!account) {
    noteFailure(ip, u.value, now);
    return generic;
  }
  const hash = await hashPassword(password, account.password_salt, account.password_iter);
  if (!timingSafeEqual(hash, account.password_hash)) {
    noteFailure(ip, u.value, now);
    return generic;
  }
  if (account.status !== 'active')
    return { ok: false, status: 403, error: 'account_disabled', message: 'This account is disabled.' };

  noteSuccess(ip, u.value);
  const db = dbFor(env);
  await db.prepare('UPDATE accounts SET last_login_at = ? WHERE id = ?').bind(nowIso(now), account.id).run();
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(nowIso(now)).run();
  const token = await createSession(env, account.id, now);
  return { ok: true, value: { account: publicAccount(account), token } };
}

export async function logout(env: Env, token: string): Promise<void> {
  const db = dbFor(env);
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
}

/** Rotate the recovery code. Returns the new plain code (shown once). */
export async function rotateRecoveryCode(env: Env, accountId: string): Promise<string> {
  const db = dbFor(env);
  const code = makeRecoveryCode();
  const salt = btoa(String.fromCharCode(...randomBytes(16)));
  const hash = await pbkdf2(normalizeRecoveryCode(code), salt, RECOVERY_ITERATIONS);
  await db
    .prepare('UPDATE accounts SET recovery_hash = ?, recovery_salt = ?, recovery_iter = ? WHERE id = ?')
    .bind(hash, salt, RECOVERY_ITERATIONS, accountId)
    .run();
  return code;
}

/**
 * Reset the password with the recovery code. The code is single-use: it is
 * rotated in the same call, and every existing session is dropped.
 */
export async function resetWithRecoveryCode(
  env: Env,
  input: { username?: unknown; recoveryCode?: unknown; newPassword?: unknown },
  ctx: { ip?: string } = {},
  now = Date.now(),
): Promise<
  | { ok: true; value: { token: string; recoveryCode: string } }
  | { ok: false; status: number; error: string; message: string }
> {
  const u = checkUsername(input.username);
  if (!u.ok) return { ok: false, status: 400, error: u.error, message: u.message };
  const p = checkPassword(input.newPassword, u.value);
  if (!p.ok) return { ok: false, status: 400, error: p.error, message: p.message };
  const code = normalizeRecoveryCode(String(input.recoveryCode ?? ''));
  if (code.length !== 16)
    return { ok: false, status: 400, error: 'invalid_recovery', message: 'That recovery code is not valid.' };

  const ip = ctx.ip ?? 'unknown';
  if (lockRemaining(ip, `recover:${u.value}`, now) > 0)
    return { ok: false, status: 429, error: 'locked', message: 'Too many attempts. Try again later.' };

  const account = await findAccountByUsername(env, u.value);
  const bad = {
    ok: false as const,
    status: 401,
    error: 'invalid_recovery',
    message: 'Username or recovery code is incorrect.',
  };
  if (!account) {
    noteFailure(ip, `recover:${u.value}`, now);
    return bad;
  }
  let ok = timingSafeEqual(await pbkdf2(code, account.recovery_salt, account.recovery_iter), account.recovery_hash);
  let usedRequestId: string | null = null;
  if (!ok) {
    // An admin-approved one-time code (24h) is accepted exactly once.
    const db0 = dbFor(env);
    const req = await db0
      .prepare('SELECT * FROM recovery_requests WHERE username = ? AND status = ?')
      .bind(account.username, 'approved')
      .first<{
        id: string;
        code_hash: string | null;
        code_salt: string | null;
        code_iter: number | null;
        code_expires_at: string | null;
      }>();
    if (req?.code_hash && req.code_salt && req.code_expires_at && req.code_expires_at > nowIso(now)) {
      ok = timingSafeEqual(await pbkdf2(code, req.code_salt, Number(req.code_iter ?? RECOVERY_ITERATIONS)), req.code_hash);
      if (ok) usedRequestId = req.id;
    }
  }
  if (!ok) {
    noteFailure(ip, `recover:${u.value}`, now);
    return bad;
  }

  const db = dbFor(env);
  const salt = btoa(String.fromCharCode(...randomBytes(16)));
  const newHash = await hashPassword(p.value, salt, PBKDF2_ITERATIONS);
  const nextCode = makeRecoveryCode();
  const rSalt = btoa(String.fromCharCode(...randomBytes(16)));
  const rHash = await pbkdf2(normalizeRecoveryCode(nextCode), rSalt, RECOVERY_ITERATIONS);

  await db
    .prepare(
      `UPDATE accounts SET password_hash = ?, password_salt = ?, password_iter = ?,
                           recovery_hash = ?, recovery_salt = ?, recovery_iter = ? WHERE id = ?`,
    )
    .bind(newHash, salt, PBKDF2_ITERATIONS, rHash, rSalt, RECOVERY_ITERATIONS, account.id)
    .run();
  // Every old device is logged out — a stolen session cannot survive a reset.
  await db.prepare('DELETE FROM sessions WHERE account_id = ?').bind(account.id).run();
  if (usedRequestId) {
    // The admin code is spent and can never be replayed.
    await db
      .prepare(
        'UPDATE recovery_requests SET status = ?, code_hash = NULL, code_salt = NULL, code_iter = NULL, decided_at = ? WHERE id = ?',
      )
      .bind('used', nowIso(now), usedRequestId)
      .run();
  }
  noteSuccess(ip, `recover:${u.value}`);
  const token = await createSession(env, account.id, now);
  return { ok: true, value: { token, recoveryCode: nextCode } };
}

/**
 * Same-device reset: the caller already holds a valid session token, so the
 * device itself is proof of identity. Old password is not required (it is
 * forgotten) — the code is rotated too.
 */
export async function resetOnThisDevice(
  env: Env,
  accountId: string,
  input: { newPassword?: unknown },
  now = Date.now(),
): Promise<
  | { ok: true; value: { recoveryCode: string } }
  | { ok: false; status: number; error: string; message: string }
> {
  const account = await dbFor(env)
    .prepare('SELECT * FROM accounts WHERE id = ?')
    .bind(accountId)
    .first<AccountRow>();
  if (!account) return { ok: false, status: 404, error: 'not_found', message: 'Account not found.' };
  const p = checkPassword(input.newPassword, account.username);
  if (!p.ok) return { ok: false, status: 400, error: p.error, message: p.message };
  const db = dbFor(env);
  const salt = btoa(String.fromCharCode(...randomBytes(16)));
  const newHash = await hashPassword(p.value, salt, PBKDF2_ITERATIONS);
  const code = makeRecoveryCode();
  const rSalt = btoa(String.fromCharCode(...randomBytes(16)));
  const rHash = await pbkdf2(normalizeRecoveryCode(code), rSalt, RECOVERY_ITERATIONS);
  await db
    .prepare(
      `UPDATE accounts SET password_hash = ?, password_salt = ?, password_iter = ?,
                           recovery_hash = ?, recovery_salt = ?, recovery_iter = ? WHERE id = ?`,
    )
    .bind(newHash, salt, PBKDF2_ITERATIONS, rHash, rSalt, RECOVERY_ITERATIONS, accountId)
    .run();
  // Keep the current device signed in, drop the others.
  await db
    .prepare(
      `DELETE FROM sessions WHERE account_id = ? AND token_hash NOT IN (
         SELECT token_hash FROM sessions WHERE account_id = ? ORDER BY created_at DESC LIMIT 1
       )`,
    )
    .bind(accountId, accountId)
    .run();
  void now;
  return { ok: true, value: { recoveryCode: code } };
}

export async function deleteAccount(env: Env, accountId: string): Promise<void> {
  const db = dbFor(env);
  // Submissions are kept as anonymous history (publishing already happened);
  // the account, its sessions, notifications and recovery requests are removed.
  await db.prepare('DELETE FROM sessions WHERE account_id = ?').bind(accountId).run();
  await db.prepare('DELETE FROM notifications WHERE account_id = ?').bind(accountId).run();
  await db.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run();
}

/* ---------------- submissions & notifications ---------------- */

export interface MySubmission {
  id: string;
  type: string;
  title: string;
  genre: string | null;
  status: string;
  submittedAt: string;
  decidedAt: string | null;
}

export async function mySubmissions(env: Env, accountId: string): Promise<MySubmission[]> {
  const db = dbFor(env);
  const res = await db
    .prepare(
      `SELECT id, type, title, genre, status, submitted_at, decided_at
       FROM submissions WHERE account_id = ? ORDER BY submitted_at DESC LIMIT 200`,
    )
    .bind(accountId)
    .all<{
      id: string;
      type: string;
      title: string;
      genre: string | null;
      status: string;
      submitted_at: string;
      decided_at: string | null;
    }>();
  return (res.results ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    genre: r.genre ?? null,
    status: r.status,
    submittedAt: r.submitted_at,
    decidedAt: r.decided_at ?? null,
  }));
}

/**
 * Claim submissions made before the account existed (or from another install).
 * Only ids that are still anonymous can be claimed; someone else's attached
 * submission is never reassigned.
 */
export async function claimSubmissions(
  env: Env,
  accountId: string,
  ids: unknown,
): Promise<{ claimed: string[]; ignored: string[] }> {
  const db = dbFor(env);
  const list = Array.isArray(ids)
    ? ids.filter((x): x is string => typeof x === 'string' && /^(idea|story)_[a-z0-9_]{4,60}$/.test(x)).slice(0, 100)
    : [];
  const claimed: string[] = [];
  const ignored: string[] = [];
  for (const id of [...new Set(list)]) {
    const row = await db
      .prepare('SELECT id, status, account_id FROM submissions WHERE id = ?')
      .bind(id)
      .first<{ id: string; status: string; account_id: string | null }>();
    // Unknown ids, or a submission already attached to another account, are
    // never reassigned — only anonymous history can be claimed.
    if (!row || row.account_id) {
      ignored.push(id);
      continue;
    }
    await db.prepare('UPDATE submissions SET account_id = ? WHERE id = ? AND account_id IS NULL').bind(accountId, id).run();
    claimed.push(id);
  }
  return { claimed, ignored };
}

export interface NotificationRow {
  id: string;
  kind: string;
  submissionId: string | null;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export async function listNotifications(
  env: Env,
  accountId: string,
  limit = 50,
): Promise<NotificationRow[]> {
  const db = dbFor(env);
  const res = await db
    .prepare('SELECT * FROM notifications WHERE account_id = ? ORDER BY created_at DESC LIMIT ?')
    .bind(accountId, Math.min(100, Math.max(1, limit)))
    .all<{
      id: string;
      kind: string;
      submission_id: string | null;
      title: string;
      body: string;
      created_at: string;
      read_at: string | null;
    }>();
  return (res.results ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    submissionId: r.submission_id ?? null,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    readAt: r.read_at ?? null,
  }));
}

export async function unreadCount(env: Env, accountId: string): Promise<number> {
  const db = dbFor(env);
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM notifications WHERE account_id = ? AND read_at IS NULL')
    .bind(accountId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/** Create a notification. Used by the admin accept/reject flow and by admins. */
export async function addNotification(
  env: Env,
  input: { accountId: string; kind: string; submissionId?: string | null; title: string; body: string },
): Promise<string> {
  const db = dbFor(env);
  const id = `ntf_${randomToken(9)}`;
  await db
    .prepare(
      `INSERT INTO notifications (id, account_id, kind, submission_id, title, body, created_at, read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .bind(id, input.accountId, input.kind, input.submissionId ?? null, input.title, input.body, nowIso())
    .run();
  return id;
}

/** Accept/reject notification wording ("live within 3 hours"). */
export async function notifySubmissionAccepted(
  env: Env,
  input: { accountId: string; submissionId: string; title: string },
): Promise<string> {
  return addNotification(env, {
    accountId: input.accountId,
    kind: 'story_accepted',
    submissionId: input.submissionId,
    title: 'Tumhari story accept ho gayi!',
    body: `"${input.title}" accept ho chuki hai — agli 3 ghante me app me live ho jayegi. Neeche tap karke dekho.`,
  });
}

export async function notifySubmissionRejected(
  env: Env,
  input: { accountId: string; submissionId: string; title: string },
): Promise<string> {
  return addNotification(env, {
    accountId: input.accountId,
    kind: 'story_rejected',
    submissionId: input.submissionId,
    title: 'Tumhari submission review ho gayi',
    body: `"${input.title}" is baar accept nahi ho payi. Aap phir se naya idea bhej sakte ho — hum padh rahe hain.`,
  });
}

export async function markNotificationRead(env: Env, accountId: string, id: string): Promise<boolean> {
  const db = dbFor(env);
  await db
    .prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND account_id = ? AND read_at IS NULL')
    .bind(nowIso(), id, accountId)
    .run();
  return true;
}

export async function markAllNotificationsRead(env: Env, accountId: string): Promise<void> {
  const db = dbFor(env);
  await db
    .prepare('UPDATE notifications SET read_at = ? WHERE account_id = ? AND read_at IS NULL')
    .bind(nowIso(), accountId)
    .run();
}

/* ---------------- app version switch ---------------- */

export async function getMinVersion(env: Env): Promise<{ minVersion: string; message: string }> {
  const db = dbFor(env);
  const v = await db.prepare('SELECT value FROM app_config WHERE key = ?').bind('minVersion').first<{ value: string }>();
  const m = await db
    .prepare('SELECT value FROM app_config WHERE key = ?')
    .bind('minVersionMessage')
    .first<{ value: string }>();
  return {
    // Minimum supported install. Bump this when a new APK must be forced;
    // OTA (JS-only) updates do NOT raise it, so a small fix reaches everyone
    // without locking anyone out.
    minVersion: v?.value ?? '2.14.0',
    message: m?.value ?? 'Kissa ka naya version zaroori hai. Update kar lo.',
  };
}

export async function setMinVersion(env: Env, minVersion: string, message?: string): Promise<void> {
  const db = dbFor(env);
  await db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').bind('minVersion', minVersion).run();
  if (message) {
    await db
      .prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)')
      .bind('minVersionMessage', message)
      .run();
  }
}

/** "2.13.10" vs "2.14.0" — true when `installed` is older than `min`. */
/**
 * Server-side safety net for the version gate.
 *
 * THE BUG THIS PREVENTS: on a bare (non-managed) build, `Constants.expoConfig`
 * comes from the manifest that is currently RUNNING. After an OTA update that is
 * the Worker's manifest, so the app reported the JS bundle's version as
 * `X-Kissa-Version` — and the gate 426'd an install whose APK was perfectly
 * current. That is why "update purana ho gaya" came back after almost every OTA.
 *
 * The client now sends the native APK version, but old bundles still send the
 * OTA one, and a bad value must never block a reader:
 *   - an OTA-manifest version looks like "<apk>-ota" (see scripts/ota-publish.mjs
 *     and the version file check) — the APK part is the truth, so compare that;
 *   - anything else that is not a plain x.y.z is refused for the comparison,
 *     because `isOlderVersion` already treats unparseable versions as "never
 *     block by accident".
 */
export function versionForGate(header: string | null | undefined): string | null {
  const raw = String(header ?? '').trim();
  if (!raw) return null;
  // 2.16.0-ota / 2.16.0-ota.2 -> 2.16.0
  const ota = raw.match(/^v?(\d+\.\d+\.\d+)-ota(?:[.\-].*)?$/i);
  if (ota) return ota[1];
  /**
   * 0.0.0 / 0.0 / 0 are the app's "I could not read my own version" placeholder
   * (see src/lib/appVersion.ts). That is UNKNOWN, not ancient: it happens after
   * an OTA launch whose manifest carried no expoClient. Treating it as ancient
   * is precisely what locked readers out of a current build, so it is treated
   * like a missing header — no verdict, and the real 426 on API calls still
   * protects genuinely old installs.
   */
  if (/^v?0\.0(?:\.0)?$/.test(raw)) return null;
  return raw;
}

export function isOlderVersion(installed: string | null | undefined, min: string): boolean {
  const parse = (v: string | null | undefined): number[] | null => {
    const m = String(v ?? '').trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!m) return null;
    return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
  };
  const a = parse(installed);
  const b = parse(min);
  if (!a || !b) return false; // unknown client → never block by accident
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}
