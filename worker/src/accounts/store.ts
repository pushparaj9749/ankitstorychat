/**
 * Kissa accounts — storage layer.
 *
 * Everything account-shaped lives here and is written against Cloudflare D1
 * (SQLite). The SAME code runs in two places:
 *
 *   - production: `env.KISSA_DB` is the D1 binding;
 *   - tests / `wrangler dev` without D1: a tiny in-memory SQL engine
 *     (`MemD1`) implements exactly the statements used below, so the whole
 *     account flow is unit-testable without a database.
 *
 * SCOPE: only accounts, sessions, submissions, notifications, recovery
 * requests and app switches are stored. Story chats, memories, saves, settings
 * and AI keys are device-only by design and must never be added here.
 *
 * Passwords and recovery codes are stored as PBKDF2-SHA256 (WebCrypto) with a
 * per-record random salt. Session tokens are stored only as their SHA-256.
 */
import type { Env } from '../submissions';

/* ---------------- limits & rules ---------------- */

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
/**
 * Cloudflare Workers (workerd) hard-caps a single WebCrypto PBKDF2 call at
 * 100,000 iterations — anything above throws
 *   NotSupportedError: Pbkdf2 failed: iteration counts above 100000 ...
 * The local Node test runtime does NOT enforce that cap, which is exactly how
 * 210,000 shipped and made every signup/login fail with a generic HTTP 500
 * ("Unexpected error") in production. 100k is the platform maximum.
 */
export const PBKDF2_MAX_ITERATIONS = 100_000;
/** PBKDF2 rounds for passwords — clamped to the Workers ceiling. */
export const PBKDF2_ITERATIONS = PBKDF2_MAX_ITERATIONS;
/** Recovery codes are high-entropy already; 100k rounds is plenty. */
export const RECOVERY_ITERATIONS = 100_000;
export const SESSION_TTL_DAYS = 90;
export const SESSION_ABSOLUTE_DAYS = 365;
export const MAX_SESSIONS_PER_ACCOUNT = 10;

/** Names nobody may take (impersonation of the app/team or admin routes). */
const RESERVED = new Set([
  'admin', 'administrator', 'kissa', 'support', 'help', 'official', 'team',
  'moderator', 'mod', 'staff', 'root', 'system', 'owner', 'beyondredeye',
  'ankit', 'ankitcutz', 'null', 'undefined', 'api', 'me', 'auth',
]);

/** Very common passwords are refused even when they satisfy the length rule. */
const WEAK = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwertyui', 'qwerty123', 'iloveyou', 'admin123', 'kissa123', 'letmein1',
  'welcome1', 'abcd1234', 'a1234567', '11111111', '00000000',
]);

export interface AccountRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  password_iter: number;
  recovery_hash: string;
  recovery_salt: string;
  recovery_iter: number;
  recovery_rotated_at: string;
  status: string;
  created_at: string;
  last_login_at: string | null;
}

/** What the app is allowed to see about an account. */
export interface PublicAccount {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string | null;
  status: string;
}

export function publicAccount(a: AccountRow): PublicAccount {
  return {
    id: a.id,
    username: a.username,
    displayName: a.display_name,
    createdAt: a.created_at,
    lastLoginAt: a.last_login_at ?? null,
    status: a.status,
  };
}

/* ---------------- in-memory D1 (tests / local dev) ---------------- */

type Row = Record<string, unknown>;
type KV = D1PreparedStatement;
interface Session {
  token_hash: string;
  account_id: string;
  created_at: string;
  expires_at: string;
  last_seen: string;
}
interface SubRow {
  id: string;
  account_id: string | null;
  type: string;
  status: string;
  title: string;
  genre: string | null;
  creator_name: string;
  payload: string;
  submitted_at: string;
  expires_at: string;
  decided_at: string | null;
  client: string | null;
}
interface NotifRow {
  id: string;
  account_id: string;
  kind: string;
  submission_id: string | null;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}
interface RecoveryRow {
  id: string;
  username: string;
  proof_id: string;
  status: string;
  code_hash: string | null;
  code_salt: string | null;
  code_iter: number | null;
  code_expires_at: string | null;
  created_at: string;
  decided_at: string | null;
}

/**
 * Minimal in-memory stand-in for D1. It is NOT a SQL engine — it implements
 * the handful of statements used by this module, so behaviour (uniqueness,
 * ordering, NULL handling) matches the real schema.
 */
export class MemD1 {
  /** Has this shim seen an INSERT that lost the username race? */
  accounts = new Map<string, AccountRow>();
  sessions = new Map<string, Session>();
  submissions = new Map<string, SubRow>();
  notifications = new Map<string, NotifRow>();
  recoveries = new Map<string, RecoveryRow>();
  config = new Map<string, string>([
    ['minVersion', '2.14.0'],
    ['minVersionMessage', 'Kissa ka naya version zaroori hai. Update kar lo.'],
  ]);
  /** optional artificial failure to test fallbacks */
  failNext = false;
  /** set by the last INSERT INTO accounts that hit the unique index */
  usernameTaken = false;

  reset(): void {
    this.accounts.clear();
    this.sessions.clear();
    this.submissions.clear();
    this.notifications.clear();
    this.recoveries.clear();
  }

  prepare(sql: string): D1PreparedStatement {
    const self: MemD1 = this;
    const norm = sql.replace(/\s+/g, ' ').trim();
    let params: unknown[] = [];
    const exec = async (): Promise<{ results?: Row[] }> => {
      if (self.failNext) {
        self.failNext = false;
        throw new Error('d1_unavailable');
      }
      return self.run(norm, params);
    };
    const stmt = {
      bind(...values: unknown[]) {
        params = values;
        return stmt;
      },
      first<T = Row>(col?: string): Promise<T | null> {
        return exec().then((r) => {
          const row = (r.results ?? [])[0] as Row | undefined;
          if (!row) return null;
          return (col ? (row[col] as T) : (row as unknown as T)) as T;
        });
      },
      run: async () => {
        const r = await exec();
        return { success: true, meta: { changes: r.results?.length ?? 1 }, results: r.results ?? [] } as unknown as D1Result;
      },
      all: async <T = Row>() => {
        const r = await exec();
        return { success: true, results: (r.results ?? []) as T[], meta: {} } as unknown as D1Result<T>;
      },
    } as unknown as D1PreparedStatement;
    return stmt;
  }

  run(sql: string, p: unknown[]): { results?: Row[] } {
    const now = new Date().toISOString();
    // ---- accounts
    if (sql.startsWith('SELECT * FROM accounts WHERE username')) {
      const row = [...this.accounts.values()].find((a) => a.username === String(p[0]).toLowerCase());
      return { results: row ? [row as unknown as Row] : [] };
    }
    if (sql.startsWith('SELECT id, username, display_name, status, created_at, last_login_at FROM accounts WHERE id')) {
      const a = this.accounts.get(String(p[0]));
      return {
        results: a
          ? [
              {
                id: a.id,
                username: a.username,
                display_name: a.display_name,
                status: a.status,
                created_at: a.created_at,
                last_login_at: a.last_login_at,
              },
            ]
          : [],
      };
    }
    if (sql.startsWith('SELECT COUNT(*) AS n FROM submissions WHERE account_id IS NULL')) {
      return { results: [{ n: [...this.submissions.values()].filter((s) => s.account_id === null).length }] };
    }
    if (sql.startsWith('SELECT COUNT(*) AS n FROM submissions WHERE id IS NOT NULL')) {
      return { results: [{ n: this.submissions.size }] };
    }
    if (sql.startsWith('SELECT value FROM app_config WHERE key')) {
      const v = this.config.get(String(p[0]));
      return { results: v === undefined ? [] : [{ value: v }] };
    }
    if (sql.startsWith('SELECT id FROM accounts WHERE id')) {
      const a = this.accounts.get(String(p[0]));
      return { results: a ? [{ id: a.id }] : [] };
    }
    if (sql.startsWith('SELECT * FROM accounts WHERE id')) {
      const row = this.accounts.get(String(p[0]));
      return { results: row ? [row as unknown as Row] : [] };
    }
    if (sql.startsWith('SELECT id FROM accounts WHERE username')) {
      const row = [...this.accounts.values()].find((a) => a.username === String(p[0]).toLowerCase());
      return { results: row ? [{ id: row.id }] : [] };
    }
    if (sql.startsWith('INSERT INTO accounts')) {
      const [id, username, display_name, password_hash, password_salt, password_iter, recovery_hash, recovery_salt, recovery_iter] = p;
      const uname = String(username).toLowerCase();
      if ([...this.accounts.values()].some((a) => a.username === uname)) {
        this.usernameTaken = true;
        throw new Error('UNIQUE constraint failed: accounts.username');
      }
      this.usernameTaken = false;
      const row: AccountRow = {
        id: String(id),
        username: uname,
        display_name: String(display_name),
        password_hash: String(password_hash),
        password_salt: String(password_salt),
        password_iter: Number(password_iter),
        recovery_hash: String(recovery_hash),
        recovery_salt: String(recovery_salt),
        recovery_iter: Number(recovery_iter),
        recovery_rotated_at: now,
        status: 'active',
        created_at: now,
        last_login_at: null,
      };
      this.accounts.set(row.id, row);
      return { results: [] };
    }
    if (sql.startsWith('UPDATE accounts SET last_login_at')) {
      const a = this.accounts.get(String(p[0]));
      if (a) a.last_login_at = String(p[1]);
      return { results: [] };
    }
    if (sql.startsWith('UPDATE accounts SET password_hash')) {
      // password_hash, password_salt, password_iter, recovery_hash, recovery_salt, recovery_iter, id
      const a = this.accounts.get(String(p[6]));
      if (a) {
        a.password_hash = String(p[0]);
        a.password_salt = String(p[1]);
        a.password_iter = Number(p[2]);
        a.recovery_hash = String(p[3]);
        a.recovery_salt = String(p[4]);
        a.recovery_iter = Number(p[5]);
        a.recovery_rotated_at = now;
      }
      return { results: [] };
    }
    if (sql.startsWith('UPDATE accounts SET display_name')) {
      const a = this.accounts.get(String(p[1]));
      if (a) a.display_name = String(p[0]);
      return { results: [] };
    }
    if (sql.startsWith('UPDATE accounts SET recovery_hash')) {
      const a = this.accounts.get(String(p[3]));
      if (a) {
        a.recovery_hash = String(p[0]);
        a.recovery_salt = String(p[1]);
        a.recovery_iter = Number(p[2]);
        a.recovery_rotated_at = now;
      }
      return { results: [] };
    }
    if (sql.startsWith('DELETE FROM accounts WHERE id')) {
      const id = String(p[0]);
      this.accounts.delete(id);
      for (const [k, s] of [...this.sessions]) if (s.account_id === id) this.sessions.delete(k);
      for (const [k, n] of [...this.notifications]) if (n.account_id === id) this.notifications.delete(k);
      for (const s of this.submissions.values()) if (s.account_id === id) s.account_id = null;
      return { results: [] };
    }
    if (sql.startsWith('SELECT COUNT(*) AS n FROM submissions')) {
      const rows = [...this.submissions.values()].filter((s) => s.account_id === String(p[0]));
      return { results: [{ n: rows.length }] };
    }
    // ---- sessions
    if (sql.startsWith('INSERT INTO sessions')) {
      const [token_hash, account_id, created_at, expires_at] = p;
      this.sessions.set(String(token_hash), {
        token_hash: String(token_hash),
        account_id: String(account_id),
        created_at: String(created_at),
        expires_at: String(expires_at),
        last_seen: String(created_at),
      });
      return { results: [] };
    }
    if (sql.startsWith('SELECT s.account_id AS account_id, a.* FROM sessions s')) {
      // token hash + now
      const s = this.sessions.get(String(p[0]));
      if (!s || s.expires_at <= String(p[1])) return { results: [] };
      const a = this.accounts.get(s.account_id);
      return { results: a ? [{ ...(a as unknown as Row), account_id: a.id }] : [] };
    }
    if (sql.startsWith('SELECT account_id FROM sessions')) {
      const s = this.sessions.get(String(p[0]));
      if (!s || s.expires_at <= String(p[1])) return { results: [] };
      return { results: [{ account_id: s.account_id }] };
    }
    if (sql.startsWith('UPDATE sessions SET last_seen')) {
      const s = this.sessions.get(String(p[0]));
      if (s) s.last_seen = String(p[1]);
      return { results: [] };
    }
    if (sql.startsWith('DELETE FROM sessions WHERE token_hash')) {
      this.sessions.delete(String(p[0]));
      return { results: [] };
    }
    if (sql.startsWith('DELETE FROM sessions WHERE account_id = ? AND token_hash NOT IN')) {
      // keep only the newest session of this account
      const [acc, same] = [String(p[0]), String(p[1])];
      const own = [...this.sessions.values()]
        .filter((s) => s.account_id === acc)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const keep = own[0]?.token_hash;
      for (const [k, s] of [...this.sessions]) if (s.account_id === acc && s.token_hash !== keep) this.sessions.delete(k);
      void same;
      return { results: [] };
    }
    if (sql.startsWith('DELETE FROM sessions WHERE token_hash IN')) {
      const acc = String(p[0]);
      const lim = Number(p[1]);
      const own = [...this.sessions.values()]
        .filter((s) => s.account_id === acc)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      const drop = own.slice(0, lim);
      for (const s of drop) this.sessions.delete(s.token_hash);
      return { results: [] };
    }
    if (sql.startsWith('DELETE FROM sessions WHERE account_id')) {
      for (const [k, s] of [...this.sessions]) if (s.account_id === String(p[0])) this.sessions.delete(k);
      return { results: [] };
    }
    if (sql.startsWith('DELETE FROM sessions WHERE expires_at')) {
      for (const [k, s] of [...this.sessions]) if (s.expires_at <= String(p[0])) this.sessions.delete(k);
      return { results: [] };
    }
    if (sql.startsWith('SELECT COUNT(*) AS n FROM sessions WHERE account_id')) {
      const n = [...this.sessions.values()].filter((s) => s.account_id === String(p[0])).length;
      return { results: [{ n }] };
    }
    // ---- submissions
    if (sql.startsWith('INSERT INTO submissions')) {
      const [id, account_id, type, status, title, genre, creator_name, payload, submitted_at, expires_at, client] = p;
      if (this.submissions.has(String(id))) return { results: [] };
      this.submissions.set(String(id), {
        id: String(id),
        account_id: account_id == null ? null : String(account_id),
        type: String(type),
        status: String(status),
        title: String(title),
        genre: genre == null ? null : String(genre),
        creator_name: String(creator_name),
        payload: String(payload),
        submitted_at: String(submitted_at),
        expires_at: String(expires_at),
        decided_at: null,
        client: client == null ? null : String(client),
      });
      return { results: [] };
    }
    if (sql.startsWith('SELECT * FROM submissions WHERE id')) {
      const s = this.submissions.get(String(p[0]));
      return { results: s ? [s as unknown as Row] : [] };
    }
    if (sql.startsWith('UPDATE submissions SET status')) {
      // status, decided_at, id
      const s = this.submissions.get(String(p[2]));
      if (s) {
        s.status = String(p[0]);
        s.decided_at = p[1] == null ? null : String(p[1]);
      }
      return { results: [] };
    }
    if (sql.startsWith('UPDATE submissions SET account_id')) {
      // account_id, id, current account_id
      const s = this.submissions.get(String(p[1]));
      if (s && s.account_id === null) s.account_id = String(p[0]);
      return { results: [] };
    }
    if (sql.startsWith('SELECT id, status, account_id FROM submissions WHERE id = ?')) {
      const s = this.submissions.get(String(p[0]));
      return { results: s ? [{ id: s.id, status: s.status, account_id: s.account_id }] : [] };
    }
    if (sql.startsWith('SELECT id, status FROM submissions WHERE id IN')) {
      const ids = (p[0] as string[]) ?? [];
      const rows = ids.map((id) => this.submissions.get(id)).filter(Boolean) as SubRow[];
      return { results: rows.map((r) => ({ id: r.id, status: r.status })) };
    }
    if (sql.startsWith('SELECT id, type, title, genre, status, submitted_at, decided_at')) {
      const acc = String(p[0]);
      const rows = [...this.submissions.values()]
        .filter((s) => s.account_id === acc)
        .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
      return {
        results: rows.map((r) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          genre: r.genre,
          status: r.status,
          submitted_at: r.submitted_at,
          decided_at: r.decided_at,
        })),
      };
    }
    // ---- notifications
    if (sql.startsWith('INSERT INTO notifications')) {
      const [id, account_id, kind, submission_id, title, body] = p;
      this.notifications.set(String(id), {
        id: String(id),
        account_id: String(account_id),
        kind: String(kind),
        submission_id: submission_id == null ? null : String(submission_id),
        title: String(title),
        body: String(body),
        created_at: now,
        read_at: null,
      });
      return { results: [] };
    }
    if (sql.startsWith('SELECT * FROM notifications WHERE account_id')) {
      const rows = [...this.notifications.values()]
        .filter((n) => n.account_id === String(p[0]))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, Number(p[1] ?? 50));
      return { results: rows.map((r) => ({ ...(r as unknown as Row) })) };
    }
    if (sql.startsWith('SELECT COUNT(*) AS n FROM notifications WHERE account_id')) {
      const n = [...this.notifications.values()].filter(
        (x) => x.account_id === String(p[0]) && x.read_at === null,
      ).length;
      return { results: [{ n }] };
    }
    // mark-all-read
    if (sql.startsWith('UPDATE notifications SET read_at = ? WHERE account_id = ? AND read_at IS NULL')) {
      const acc = String(p[1]);
      for (const n of this.notifications.values())
        if (n.account_id === acc && n.read_at === null) n.read_at = String(p[0]);
      return { results: [] };
    }
    // single notification read: (read_at, id, account_id)
    if (sql.startsWith('UPDATE notifications SET read_at')) {
      const n = this.notifications.get(String(p[1]));
      if (n && n.account_id === String(p[2]) && n.read_at === null) n.read_at = String(p[0]);
      return { results: [] };
    }
    if (sql.startsWith('DELETE FROM notifications WHERE account_id')) {
      for (const [k, n] of [...this.notifications]) if (n.account_id === String(p[0])) this.notifications.delete(k);
      return { results: [] };
    }
    if (sql.startsWith('SELECT * FROM notifications WHERE id')) {
      const n = this.notifications.get(String(p[0]));
      return { results: n ? [n as unknown as Row] : [] };
    }
    // ---- recovery requests
    if (sql.startsWith('INSERT INTO recovery_requests')) {
      // (id, username, proof_id, created_at) — status is the literal 'pending'
      const [id, username, proof_id, created_at] = p;
      this.recoveries.set(String(id), {
        id: String(id),
        username: String(username).toLowerCase(),
        proof_id: String(proof_id),
        status: 'pending',
        code_hash: null,
        code_salt: null,
        code_iter: null,
        code_expires_at: null,
        created_at: String(created_at),
        decided_at: null,
      });
      return { results: [] };
    }
    if (sql.startsWith('SELECT COUNT(*) AS n FROM recovery_requests WHERE username')) {
      const n = [...this.recoveries.values()].filter(
        (r) => r.username === String(p[0]).toLowerCase() && r.created_at >= String(p[1]),
      ).length;
      return { results: [{ n }] };
    }
    if (sql.startsWith('SELECT * FROM recovery_requests WHERE id')) {
      const r = this.recoveries.get(String(p[0]));
      return { results: r ? [r as unknown as Row] : [] };
    }
    if (sql.startsWith('SELECT * FROM recovery_requests WHERE username')) {
      // (username, status)
      const rows = [...this.recoveries.values()]
        .filter((r) => r.username === String(p[0]).toLowerCase() && r.status === String(p[1]))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return { results: rows.map((r) => ({ ...(r as unknown as Row) })) };
    }
    if (sql.startsWith('SELECT * FROM recovery_requests WHERE status')) {
      const rows = [...this.recoveries.values()]
        .filter((r) => r.status === String(p[0]))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return { results: rows.map((r) => ({ ...(r as unknown as Row) })) };
    }
    if (sql.startsWith('UPDATE recovery_requests SET status = ?, code_hash = NULL')) {
      // (status, decided_at, id) — reject / spent
      const r = this.recoveries.get(String(p[2]));
      if (r) {
        r.status = String(p[0]);
        r.code_hash = null;
        r.code_salt = null;
        r.code_iter = null;
        r.code_expires_at = null;
        r.decided_at = p[1] == null ? null : String(p[1]);
      }
      return { results: [] };
    }
    if (sql.startsWith('UPDATE recovery_requests SET status')) {
      // approve: (status, code_hash, code_salt, code_iter, code_expires_at, decided_at, id)
      const r = this.recoveries.get(String(p[6]));
      if (r) {
        r.status = String(p[0]);
        r.code_hash = p[1] == null ? null : String(p[1]);
        r.code_salt = p[2] == null ? null : String(p[2]);
        r.code_iter = p[3] == null ? null : Number(p[3]);
        r.code_expires_at = p[4] == null ? null : String(p[4]);
        r.decided_at = p[5] == null ? null : String(p[5]);
      }
      return { results: [] };
    }
    // ---- app_config
    if (sql.startsWith('SELECT value FROM app_config WHERE key')) {
      const v = this.config.get(String(p[0]));
      return { results: v === undefined ? [] : [{ value: v }] };
    }
    if (sql.startsWith('INSERT OR REPLACE INTO app_config')) {
      this.config.set(String(p[0]), String(p[1]));
      return { results: [] };
    }
    if (sql.startsWith('INSERT INTO app_config')) {
      this.config.set(String(p[0]), String(p[1]));
      return { results: [] };
    }
    if (sql.startsWith('UPDATE app_config')) {
      this.config.set(String(p[1]), String(p[0]));
      return { results: [] };
    }
    throw new Error(`MemD1: unsupported statement: ${sql.slice(0, 80)}`);
  }
}

export const memD1 = new MemD1();
/** Test helper: clear the in-memory DB between tests. */
export function resetMemD1ForTests(): void {
  memD1.reset();
}

/** Resolve the database: the real D1 binding, else the in-memory shim. */
export function dbFor(env: Env): D1Database {
  return (env.KISSA_DB as D1Database | undefined) ?? (memD1 as unknown as D1Database);
}

/** True when a real D1 binding is configured (production). */
export function hasRealDb(env: Env): boolean {
  return !!env.KISSA_DB;
}

/* ---------------- crypto helpers ---------------- */

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const unb64 = (s: string): Uint8Array => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** URL-safe random string of n bytes of entropy. */
export function randomToken(n = 32): string {
  return b64(randomBytes(n)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A 4-group recovery code, e.g. K7QM-3XPD-9RTV-2HWB. */
export function makeRecoveryCode(): string {
  // Crockford-ish alphabet: no I/L/O/U to avoid typing mistakes.
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i % 4 === 3 && i !== 15) out += '-';
  }
  return out;
}

/** Normalise a typed recovery code: uppercase, strip anything but A-Z0-9. */
export function normalizeRecoveryCode(raw: string): string {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function pbkdf2(
  secret: string,
  saltB64: string,
  iterations: number,
): Promise<string> {
  // Never hand workerd more than its ceiling: an over-cap call throws before a
  // single byte is derived, which is a 500 on every password path. Clamping
  // keeps old records verifiable instead of bricking the account.
  const rounds = Math.min(Math.max(1, Math.floor(iterations) || 1), PBKDF2_MAX_ITERATIONS);
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: rounds, hash: 'SHA-256' },
    key,
    256,
  );
  return b64(new Uint8Array(bits));
}

export async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare (no early exit). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
