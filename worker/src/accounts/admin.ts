/**
 * Admin surface for accounts: who submitted what, personal notifications,
 * and the no-email recovery flow.
 *
 * All of these routes sit behind the same constant-time ADMIN_TOKEN check the
 * existing admin routes use (see router.ts). They never return password or
 * recovery hashes.
 */
import { addNotification, fail, json, nowIso, setMinVersion, checkPassword } from './service';
import {
  RECOVERY_ITERATIONS,
  dbFor,
  makeRecoveryCode,
  normalizeRecoveryCode,
  pbkdf2,
  randomBytes,
  randomToken,
} from './store';
import type { Env } from '../submissions';

const noStore = (res: Response): Response => {
  const h = new Headers(res.headers);
  h.set('Cache-Control', 'no-store');
  return new Response(res.body, { status: res.status, headers: h });
};

async function body(request: Request, max = 8_000): Promise<Record<string, unknown> | null> {
  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > max) return null;
    const parsed = JSON.parse(new TextDecoder().decode(buf));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface AccountListRow {
  id: string;
  username: string;
  display_name: string;
  status: string;
  created_at: string;
  last_login_at: string | null;
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
}

/** GET /api/admin/accounts — every account with its submission counts. */
export async function listAdminAccounts(env: Env): Promise<Response> {
  const db = dbFor(env);
  const res = await db
    .prepare(
      `SELECT a.id, a.username, a.display_name, a.status, a.created_at, a.last_login_at,
              COUNT(s.id) AS total,
              SUM(CASE WHEN s.status = 'pending'  THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN s.status = 'accepted' THEN 1 ELSE 0 END) AS accepted,
              SUM(CASE WHEN s.status = 'rejected' THEN 1 ELSE 0 END) AS rejected
       FROM accounts a LEFT JOIN submissions s ON s.account_id = a.id
       GROUP BY a.id ORDER BY a.created_at DESC LIMIT 500`,
    )
    .all<AccountListRow>();
  const accounts = (res.results ?? []).map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    status: r.status,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at ?? null,
    counts: {
      total: Number(r.total ?? 0),
      pending: Number(r.pending ?? 0),
      accepted: Number(r.accepted ?? 0),
      rejected: Number(r.rejected ?? 0),
    },
  }));
  // Unclaimed (pre-account) history stays visible to the admin.
  const anon = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM submissions WHERE account_id IS NULL`,
    )
    .first<{ n: number }>();
  return noStore(json({ ok: true, accounts, unclaimed: Number(anon?.n ?? 0) }));
}

/** GET /api/admin/accounts/:id — one account + every submission it made. */
export async function getAdminAccount(env: Env, id: string): Promise<Response> {
  const db = dbFor(env);
  const account = await db
    .prepare('SELECT id, username, display_name, status, created_at, last_login_at FROM accounts WHERE id = ?')
    .bind(id)
    .first<{
      id: string;
      username: string;
      display_name: string;
      status: string;
      created_at: string;
      last_login_at: string | null;
    }>();
  if (!account) return noStore(fail(404, 'not_found', 'Account not found.'));
  const subs = await db
    .prepare(
      `SELECT id, type, title, genre, status, submitted_at, decided_at
       FROM submissions WHERE account_id = ? ORDER BY submitted_at DESC LIMIT 500`,
    )
    .bind(id)
    .all<{
      id: string;
      type: string;
      title: string;
      genre: string | null;
      status: string;
      submitted_at: string;
      decided_at: string | null;
    }>();
  return noStore(
    json({
      ok: true,
      account: {
        id: account.id,
        username: account.username,
        displayName: account.display_name,
        status: account.status,
        createdAt: account.created_at,
        lastLoginAt: account.last_login_at ?? null,
      },
      submissions: (subs.results ?? []).map((s) => ({
        id: s.id,
        type: s.type,
        title: s.title,
        genre: s.genre ?? null,
        status: s.status,
        submittedAt: s.submitted_at,
        decidedAt: s.decided_at ?? null,
      })),
    }),
  );
}

/** POST /api/admin/accounts/:id/notify — a personal message from the team. */
export async function adminNotify(env: Env, request: Request, accountIdFromPath: string): Promise<Response> {
  const b = await body(request);
  if (!b) return noStore(fail(400, 'invalid_json', 'Request body must be valid JSON.'));
  const title = String(b.title ?? '').trim();
  const message = String(b.body ?? '').trim();
  if (!title || title.length > 80) return noStore(fail(400, 'invalid_title', 'Title is required (max 80).'));
  if (!message || message.length > 500)
    return noStore(fail(400, 'invalid_body', 'Message is required (max 500).'));
  const account = await dbFor(env)
    .prepare('SELECT id FROM accounts WHERE id = ?')
    .bind(accountIdFromPath)
    .first<{ id: string }>();
  if (!account) return noStore(fail(404, 'not_found', 'Account not found.'));
  const id = await addNotification(env, {
    accountId: account.id,
    kind: 'system',
    title,
    body: message,
  });
  return noStore(json({ ok: true, id }));
}

/* ---------------- admin-assisted recovery ---------------- */

/**
 * Recovery with no email:
 *   1. user asks in the app (username + a submission id they own);
 *   2. the admin sees the request here and approves it;
 *   3. an approval produces a ONE-TIME code (24h) that the admin hands over;
 *   4. the user resets the password with that code — it is then spent.
 */
const RECOVERY_CODE_TTL_MS = 24 * 3600 * 1000;

export async function listRecoveryRequests(env: Env): Promise<Response> {
  const db = dbFor(env);
  const res = await db
    .prepare('SELECT * FROM recovery_requests WHERE status = ? ORDER BY created_at DESC LIMIT 200')
    .bind('pending')
    .all<{
      id: string;
      username: string;
      proof_id: string;
      status: string;
      created_at: string;
    }>();
  const pending = (res.results ?? []).map((r) => ({
    id: r.id,
    username: r.username,
    proofId: r.proof_id,
    createdAt: r.created_at,
  }));
  return noStore(json({ ok: true, requests: pending }));
}

export async function decideRecoveryRequest(
  env: Env,
  id: string,
  request: Request,
  pathAction?: 'approve' | 'reject',
): Promise<Response> {
  const b = (await body(request)) ?? {};
  const action = pathAction ?? String(b.action ?? '');
  if (action !== 'approve' && action !== 'reject')
    return noStore(fail(400, 'invalid_action', 'action must be approve or reject.'));
  const db = dbFor(env);
  const req = await db
    .prepare('SELECT * FROM recovery_requests WHERE id = ?')
    .bind(id)
    .first<{ id: string; username: string; status: string }>();
  if (!req) return noStore(fail(404, 'not_found', 'Recovery request not found.'));
  if (req.status !== 'pending') return noStore(fail(409, 'already_decided', 'This request was already decided.'));

  if (action === 'reject') {
    await db
      .prepare('UPDATE recovery_requests SET status = ?, code_hash = NULL, code_salt = NULL, code_iter = NULL, code_expires_at = NULL, decided_at = ? WHERE id = ?')
      .bind('rejected', nowIso(), id)
      .run();
    return noStore(json({ ok: true, status: 'rejected' }));
  }

  const account = await db
    .prepare('SELECT id FROM accounts WHERE username = ?')
    .bind(req.username)
    .first<{ id: string }>();
  if (!account) return noStore(fail(404, 'not_found', 'That username no longer exists.'));

  const code = makeRecoveryCode();
  const salt = btoa(String.fromCharCode(...randomBytes(16)));
  const hash = await pbkdf2(normalizeRecoveryCode(code), salt, RECOVERY_ITERATIONS);
  await db
    .prepare(
      `UPDATE recovery_requests SET status = ?, code_hash = ?, code_salt = ?, code_iter = ?,
                                   code_expires_at = ?, decided_at = ? WHERE id = ?`,
    )
    .bind('approved', hash, salt, RECOVERY_ITERATIONS, new Date(Date.now() + RECOVERY_CODE_TTL_MS).toISOString(), nowIso(), id)
    .run();
  return noStore(json({ ok: true, status: 'approved', recoveryCode: code, expiresInHours: 24 }));
}

/* ---------------- version switch ---------------- */

export async function adminSetVersion(env: Env, request: Request): Promise<Response> {
  const b = await body(request);
  if (!b) return noStore(fail(400, 'invalid_json', 'Request body must be valid JSON.'));
  const v = String(b.minVersion ?? '').trim();
  if (!/^\d+\.\d+(\.\d+)?$/.test(v)) return noStore(fail(400, 'invalid_version', 'minVersion must look like 2.14.0.'));
  const message = typeof b.message === 'string' ? b.message.slice(0, 200) : undefined;
  await setMinVersion(env, v, message);
  return noStore(json({ ok: true, minVersion: v }));
}

void checkPassword;
void randomToken;
