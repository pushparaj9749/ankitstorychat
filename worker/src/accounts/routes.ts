/**
 * Kissa accounts — HTTP routes.
 *
 * Every route is Bearer-token aware: the token identifies the account that
 * made a submission, owns a notification feed, or claims pre-update history.
 * No email is collected anywhere; recovery is the one-time code, the device
 * itself, or an admin-approved request.
 */
import {
  authenticate,
  checkDisplayName,
  checkUsername,
  claimSubmissions,
  deleteAccount,
  fail,
  json,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  mySubmissions,
  nowIso,
  resetOnThisDevice,
  resetWithRecoveryCode,
  rotateRecoveryCode,
  signup,
  login,
  unreadCount,
  usernameAvailable,
  logout,
  findAccountByUsername,
} from './service';
import { dbFor, publicAccount, randomToken } from './store';
import type { Env } from '../submissions';

/** Small helper: read a bounded JSON body. */
async function body(request: Request, maxBytes = 8_000): Promise<Record<string, unknown> | null> {
  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > maxBytes) return null;
    const parsed = JSON.parse(new TextDecoder().decode(buf));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function noStore(res: Response): Response {
  const h = new Headers(res.headers);
  h.set('Cache-Control', 'no-store');
  return new Response(res.body, { status: res.status, headers: h });
}

const ipOf = (request: Request): string => request.headers.get('CF-Connecting-IP') ?? 'unknown';

/* ---------------- /api/auth/* ---------------- */

export async function handleSignup(request: Request, env: Env): Promise<Response> {
  const b = await body(request);
  if (!b) return noStore(fail(400, 'invalid_json', 'Request body must be valid JSON.'));
  const res = await signup(env, { username: b.username, password: b.password, displayName: b.displayName });
  if (!res.ok) return noStore(fail(res.status, res.error, res.message));
  return noStore(
    json(
      {
        ok: true,
        token: res.value.token,
        account: res.value.account,
        // Shown exactly once — there is no email to send it to.
        recoveryCode: res.value.recoveryCode,
      },
      201,
    ),
  );
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const b = await body(request);
  if (!b) return noStore(fail(400, 'invalid_json', 'Request body must be valid JSON.'));
  const res = await login(env, { username: b.username, password: b.password }, { ip: ipOf(request) });
  if (!res.ok) return noStore(fail(res.status, res.error, res.message));
  return noStore(json({ ok: true, token: res.value.token, account: res.value.account }));
}

export async function handleCheckUsername(request: Request, env: Env, url: URL): Promise<Response> {
  const u = checkUsername(url.searchParams.get('u'));
  if (!u.ok) return noStore(json({ ok: true, valid: false, available: false, message: u.message }));
  const available = await usernameAvailable(env, u.value);
  return noStore(json({ ok: true, valid: true, available, username: u.value }));
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(env, request);
  if (!auth) return noStore(fail(401, 'unauthorized', 'Login required.'));
  return noStore(
    json({
      ok: true,
      account: publicAccount(auth.account),
      unread: await unreadCount(env, auth.account.id),
    }),
  );
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(env, request);
  if (!auth || !auth.token) return noStore(fail(401, 'unauthorized', 'Login required.'));
  await logout(env, auth.token);
  return noStore(json({ ok: true }));
}

export async function handleRecoveryReset(request: Request, env: Env): Promise<Response> {
  const b = await body(request);
  if (!b) return noStore(fail(400, 'invalid_json', 'Request body must be valid JSON.'));
  const res = await resetWithRecoveryCode(
    env,
    { username: b.username, recoveryCode: b.recoveryCode, newPassword: b.newPassword },
    { ip: ipOf(request) },
  );
  if (!res.ok) return noStore(fail(res.status, res.error, res.message));
  return noStore(
    json({ ok: true, token: res.value.token, recoveryCode: res.value.recoveryCode }, 200),
  );
}

export async function handleDeviceReset(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(env, request);
  if (!auth) return noStore(fail(401, 'unauthorized', 'Login required.'));
  const b = await body(request);
  if (!b) return noStore(fail(400, 'invalid_json', 'Request body must be valid JSON.'));
  const res = await resetOnThisDevice(env, auth.account.id, { newPassword: b.newPassword });
  if (!res.ok) return noStore(fail(res.status, res.error, res.message));
  return noStore(json({ ok: true, recoveryCode: res.value.recoveryCode }));
}

export async function handleRotateRecovery(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(env, request);
  if (!auth) return noStore(fail(401, 'unauthorized', 'Login required.'));
  const code = await rotateRecoveryCode(env, auth.account.id);
  return noStore(json({ ok: true, recoveryCode: code }));
}

export async function handleUpdateProfile(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(env, request);
  if (!auth) return noStore(fail(401, 'unauthorized', 'Login required.'));
  const b = await body(request);
  if (!b) return noStore(fail(400, 'invalid_json', 'Request body must be valid JSON.'));
  const d = checkDisplayName(b.displayName, auth.account.display_name);
  if (!d.ok) return noStore(fail(400, d.error, d.message));
  await (env.KISSA_DB as D1Database)
    .prepare('UPDATE accounts SET display_name = ? WHERE id = ?')
    .bind(d.value, auth.account.id)
    .run();
  return noStore(json({ ok: true, account: { ...publicAccount(auth.account), displayName: d.value } }));
}

export async function handleDeleteMe(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(env, request);
  if (!auth) return noStore(fail(401, 'unauthorized', 'Login required.'));
  await deleteAccount(env, auth.account.id);
  return noStore(json({ ok: true }));
}

/* ---------------- /api/me/* ---------------- */

export async function handleMySubmissions(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(env, request);
  if (!auth) return noStore(fail(401, 'unauthorized', 'Login required.'));
  const submissions = await mySubmissions(env, auth.account.id);
  return noStore(json({ ok: true, submissions }));
}

export async function handleClaim(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(env, request);
  if (!auth) return noStore(fail(401, 'unauthorized', 'Login required.'));
  const b = await body(request, 16_000);
  if (!b) return noStore(fail(400, 'invalid_json', 'Request body must be valid JSON.'));
  const res = await claimSubmissions(env, auth.account.id, b.ids);
  return noStore(json({ ok: true, ...res }));
}

export async function handleNotifications(request: Request, env: Env, url: URL): Promise<Response> {
  const auth = await authenticate(env, request);
  if (!auth) return noStore(fail(401, 'unauthorized', 'Login required.'));
  const limit = Number(url.searchParams.get('limit') ?? 50) || 50;
  const items = await listNotifications(env, auth.account.id, limit);
  return noStore(
    json({
      ok: true,
      unread: await unreadCount(env, auth.account.id),
      notifications: items,
    }),
  );
}

export async function handleNotificationRead(request: Request, env: Env, id: string): Promise<Response> {
  // Accepts POST /api/me/notifications/<id> and POST /api/me/notifications/<id>/read.
  const auth = await authenticate(env, request);
  if (!auth) return noStore(fail(401, 'unauthorized', 'Login required.'));
  await markNotificationRead(env, auth.account.id, id);
  return noStore(json({ ok: true, unread: await unreadCount(env, auth.account.id) }));
}

export async function handleNotificationsReadAll(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(env, request);
  if (!auth) return noStore(fail(401, 'unauthorized', 'Login required.'));
  await markAllNotificationsRead(env, auth.account.id);
  return noStore(json({ ok: true, unread: 0 }));
}

/** Used by the submission routes to attach the caller's account, if any. */
export async function optionalAccountId(env: Env, request: Request): Promise<string | null> {
  const auth = await authenticate(env, request);
  return auth?.account.id ?? null;
}

void nowIso;
void randomToken;

/* ---------------- public: ask for admin-assisted recovery ---------------- */

export const RECOVERY_REQUESTS_PER_DAY = 3;

/**
 * POST /api/recover — no email anywhere, so a locked-out user asks here.
 * The request is verifiable because it names a submission id they made; an
 * admin approves it and hands over a one-time code (24h).
 */
export async function handleRecoveryRequest(request: Request, env: Env): Promise<Response> {
  const b = await body(request);
  if (!b) return noStore(fail(400, 'invalid_json', 'Request body must be valid JSON.'));
  const u = checkUsername(b.username);
  if (!u.ok) return noStore(fail(400, u.error, u.message));
  const proof = String(b.submissionId ?? '').trim();
  if (!/^(idea|story)_[a-z0-9_]{4,60}$/.test(proof))
    return noStore(fail(400, 'invalid_proof', 'Aapki submission ka ID daalein (idea_… / story_…).'));

  const account = await findAccountByUsername(env, u.value);
  // Same answer whether or not the account exists — no username probing.
  if (!account) return noStore(json({ ok: true, received: true }));

  const db = dbFor(env);
  const since = nowIso(Date.now() - 24 * 3600 * 1000);
  const recent = await db
    .prepare('SELECT COUNT(*) AS n FROM recovery_requests WHERE username = ? AND created_at >= ?')
    .bind(u.value, since)
    .first<{ n: number }>();
  if (Number(recent?.n ?? 0) >= RECOVERY_REQUESTS_PER_DAY)
    return noStore(fail(429, 'too_many_requests', 'Aaj ke liye bahut zyada requests ho gayi. Kal try karein.'));

  const id = `rec_${randomToken(9)}`;
  await db
    .prepare(
      `INSERT INTO recovery_requests (id, username, proof_id, status, code_hash, code_salt, code_iter, code_expires_at, created_at, decided_at)
       VALUES (?, ?, ?, 'pending', NULL, NULL, NULL, NULL, ?, NULL)`,
    )
    .bind(id, u.value, proof, nowIso())
    .run();
  return noStore(json({ ok: true, received: true, id }));
}
