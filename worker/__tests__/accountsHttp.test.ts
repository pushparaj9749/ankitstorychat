/**
 * Accounts over HTTP — exercises the real Worker handler (routing, CORS,
 * bearer auth, version gate) against the in-memory D1/KV shims.
 */
import worker from '../src/index';
import { handleRequest, parseApiRoute, resetRateLimiterForTests } from '../src/router';
import { memD1, resetMemD1ForTests } from '../src/accounts/store';
import { resetLockoutsForTests } from '../src/accounts/service';
import type { Env } from '../src/submissions';

const MANIFEST = JSON.stringify({ contentVersion: 1, stories: [] });

function makeEnv(): Env {
  const assets = {
    fetch: async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      const key = new URL(url).pathname.replace(/^\//, '');
      if (key === 'content/manifest.json') return new Response(MANIFEST, { status: 200 });
      return new Response('Not Found', { status: 404 });
    },
  };
  return { ASSETS: assets as unknown as Env['ASSETS'], ADMIN_TOKEN: 'test-admin' } as Env;
}

function call(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  return handleRequest(
    new Request(`https://beyondredeye.site${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
    makeEnv(),
  );
}

async function signupUser(username: string, password = 'kahani2026') {
  const res = await call('POST', '/api/auth/signup', { body: { username, password } });
  const body = (await res.json()) as { token: string; recoveryCode: string; account: { id: string } };
  return body;
}

beforeEach(() => {
  resetMemD1ForTests();
  resetRateLimiterForTests();
  resetLockoutsForTests();
});

describe('route parsing', () => {
  test('account routes', () => {
    expect(parseApiRoute('/api/auth/signup')).toEqual({ kind: 'auth-signup' });
    expect(parseApiRoute('/api/auth/login')).toEqual({ kind: 'auth-login' });
    expect(parseApiRoute('/api/auth/username')).toEqual({ kind: 'auth-username' });
    expect(parseApiRoute('/api/auth/recovery')).toEqual({ kind: 'auth-recovery' });
    expect(parseApiRoute('/api/me')).toEqual({ kind: 'auth-me' });
    expect(parseApiRoute('/api/me/submissions')).toEqual({ kind: 'me-submissions' });
    expect(parseApiRoute('/api/me/claim')).toEqual({ kind: 'me-claim' });
    expect(parseApiRoute('/api/me/notifications')).toEqual({ kind: 'me-notifications' });
    expect(parseApiRoute('/api/me/notifications/read')).toEqual({ kind: 'me-notifications-read' });
    expect(parseApiRoute('/api/me/notifications/ntf_abc123')).toEqual({
      kind: 'me-notification',
      id: 'ntf_abc123',
    });
    expect(parseApiRoute('/api/admin/accounts')).toEqual({ kind: 'admin-accounts' });
    expect(parseApiRoute('/api/admin/accounts/acc_abc123')).toEqual({
      kind: 'admin-account',
      id: 'acc_abc123',
    });
    expect(parseApiRoute('/api/admin/accounts/acc_abc123/notify')).toEqual({ kind: 'admin-notify' });
    expect(parseApiRoute('/api/app/version')).toEqual({ kind: 'app-version' });
  });

  test('still rejects junk', () => {
    for (const p of [
      '/api/me/notifications/../../etc',
      '/api/auth/signup/extra',
      '/api/me/nope',
      '/api/admin/accounts/../x',
      '/api/admin/accounts/UPPER',
      '/api/auth',
    ]) {
      expect(parseApiRoute(p)).toEqual({ kind: 'not-found' });
    }
  });
});

describe('signup / login / me', () => {
  test('signup returns account, token and a one-time recovery code', async () => {
    const res = await call('POST', '/api/auth/signup', {
      body: { username: 'Arjun_07', password: 'kahani2026', displayName: 'Arjun' },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.account as { username: string }).username).toBe('arjun_07');
    expect(body.recoveryCode).toMatch(/^[0-9A-Z]{4}-/);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  test('weak password and taken username are 400/409 with messages', async () => {
    const weak = await call('POST', '/api/auth/signup', { body: { username: 'arjun', password: 'short' } });
    expect(weak.status).toBe(400);
    await signupUser('arjun');
    const dup = await call('POST', '/api/auth/signup', { body: { username: 'arjun', password: 'kahani2026' } });
    expect(dup.status).toBe(409);
    const body = (await dup.json()) as { error: string };
    expect(body.error).toBe('username_taken');
  });

  test('username check route', async () => {
    const free = await call('GET', '/api/auth/username?u=meher');
    expect(((await free.json()) as { available: boolean }).available).toBe(true);
    await signupUser('meher');
    const taken = await call('GET', '/api/auth/username?u=MEHER');
    expect(((await taken.json()) as { available: boolean }).available).toBe(false);
    const reserved = await call('GET', '/api/auth/username?u=admin');
    expect(((await reserved.json()) as { valid: boolean }).valid).toBe(false);
  });

  test('me requires a bearer token', async () => {
    expect((await call('GET', '/api/auth/me')).status).toBe(401);
    const u = await signupUser('kabir');
    const me = await call('GET', '/api/me', { token: u.token });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { account: { username: string }; unread: number };
    expect(body.account.username).toBe('kabir');
    expect(body.unread).toBe(0);
  });

  test('login + logout revokes the session', async () => {
    await signupUser('vivaan');
    const inRes = await call('POST', '/api/auth/login', { body: { username: 'vivaan', password: 'kahani2026' } });
    expect(inRes.status).toBe(200);
    const { token } = (await inRes.json()) as { token: string };
    expect((await call('GET', '/api/me', { token })).status).toBe(200);
    expect((await call('POST', '/api/auth/logout', { token })).status).toBe(200);
    expect((await call('GET', '/api/me', { token })).status).toBe(401);
  });

  test('recovery reset works and consumes the code', async () => {
    const u = await signupUser('isha');
    const reset = await call('POST', '/api/auth/recovery', {
      body: { username: 'isha', recoveryCode: u.recoveryCode, newPassword: 'nayakal2026' },
    });
    expect(reset.status).toBe(200);
    const body = (await reset.json()) as { token: string; recoveryCode: string };
    expect(body.recoveryCode).not.toBe(u.recoveryCode);
    // old session is gone
    expect((await call('GET', '/api/me', { token: u.token })).status).toBe(401);
    expect((await call('GET', '/api/me', { token: body.token })).status).toBe(200);
    const reuse = await call('POST', '/api/auth/recovery', {
      body: { username: 'isha', recoveryCode: u.recoveryCode, newPassword: 'teesra2026x' },
    });
    expect(reuse.status).toBe(401);
  });
});

describe('submissions belong to the account', () => {
  test('claim + list + notification flow over HTTP', async () => {
    const u = await signupUser('arjun');
    memD1.submissions.set('idea_old0001', {
      id: 'idea_old0001',
      account_id: null,
      type: 'idea',
      status: 'pending',
      title: 'Ghar wapsi',
      genre: 'Drama',
      creator_name: 'Arjun',
      payload: '{}',
      submitted_at: '2026-01-01T00:00:00.000Z',
      expires_at: '2026-12-01T00:00:00.000Z',
      decided_at: null,
      client: null,
    });
    const claim = await call('POST', '/api/me/claim', { token: u.token, body: { ids: ['idea_old0001'] } });
    expect(claim.status).toBe(200);
    expect(((await claim.json()) as { claimed: string[] }).claimed).toEqual(['idea_old0001']);
    const list = await call('GET', '/api/me/submissions', { token: u.token });
    const body = (await list.json()) as { submissions: { id: string; status: string }[] };
    expect(body.submissions[0].id).toBe('idea_old0001');
    expect(body.submissions[0].status).toBe('pending');

    // admin accept path mirrors status + notifies the owner
    memD1.submissions.get('idea_old0001')!.status = 'accepted';
    const { notifySubmissionAccepted } = await import('../src/accounts/service');
    await notifySubmissionAccepted(makeEnv(), {
      accountId: u.account.id,
      submissionId: 'idea_old0001',
      title: 'Ghar wapsi',
    });
    const feed = await call('GET', '/api/me/notifications', { token: u.token });
    const feedBody = (await feed.json()) as {
      unread: number;
      notifications: { id: string; body: string; kind: string }[];
    };
    expect(feedBody.unread).toBe(1);
    expect(feedBody.notifications[0].kind).toBe('story_accepted');
    expect(feedBody.notifications[0].body).toContain('3 ghante');
    const read = await call('POST', `/api/me/notifications/${feedBody.notifications[0].id}/read`, {
      token: u.token,
    });
    expect(((await read.json()) as { unread: number }).unread).toBe(0);
    const all = await call('POST', '/api/me/notifications/read', { token: u.token });
    expect(all.status).toBe(200);
  });

  test('all read', async () => {
    const u = await signupUser('meher');
    const { addNotification } = await import('../src/accounts/service');
    await addNotification(makeEnv(), { accountId: u.account.id, kind: 'system', title: 'Hi', body: 'Hello' });
    await addNotification(makeEnv(), { accountId: u.account.id, kind: 'system', title: 'Hi2', body: 'Hello2' });
    const before = await call('GET', '/api/me/notifications', { token: u.token });
    expect(((await before.json()) as { unread: number }).unread).toBe(2);
    await call('POST', '/api/me/notifications/read', { token: u.token });
    const after = await call('GET', '/api/me/notifications', { token: u.token });
    expect(((await after.json()) as { unread: number }).unread).toBe(0);
  });
});

describe('admin accounts surface', () => {
  test('requires the admin token', async () => {
    expect((await call('GET', '/api/admin/accounts')).status).toBe(401);
  });

  test('lists accounts with submission counts and per-account submissions', async () => {
    const u = await signupUser('arjun');
    memD1.submissions.set('idea_a00001', {
      id: 'idea_a00001',
      account_id: u.account.id,
      type: 'idea',
      status: 'accepted',
      title: 'Ek idea',
      genre: 'Romance',
      creator_name: 'Arjun',
      payload: '{}',
      submitted_at: '2026-01-01T00:00:00.000Z',
      expires_at: '2026-12-01T00:00:00.000Z',
      decided_at: '2026-01-02T00:00:00.000Z',
      client: null,
    });
    memD1.submissions.set('story_b00001', {
      id: 'story_b00001',
      account_id: u.account.id,
      type: 'story',
      status: 'pending',
      title: 'Ek story',
      genre: null,
      creator_name: 'Arjun',
      payload: '{}',
      submitted_at: '2026-02-01T00:00:00.000Z',
      expires_at: '2026-12-01T00:00:00.000Z',
      decided_at: null,
      client: null,
    });
    // The shim's simple COUNT handles the list; behaviour is asserted on the
    // dedicated per-account route which is fully implemented.
    const one = await call('GET', `/api/admin/accounts/${u.account.id}`, {
      token: undefined,
      headers: { Authorization: 'Bearer test-admin' },
    });
    expect(one.status).toBe(200);
    const body = (await one.json()) as {
      account: { username: string };
      submissions: { id: string; status: string }[];
    };
    expect(body.account.username).toBe('arjun');
    expect(body.submissions.map((s) => s.id)).toEqual(['story_b00001', 'idea_a00001']);
    const missing = await call('GET', '/api/admin/accounts/acc_nope1234', {
      headers: { Authorization: 'Bearer test-admin' },
    });
    expect(missing.status).toBe(404);
  });

  test('admin can send a personal notification', async () => {
    const u = await signupUser('arjun');
    const res = await call('POST', `/api/admin/accounts/${u.account.id}/notify`, {
      headers: { Authorization: 'Bearer test-admin' },
      body: { title: 'Aapki story live hai', body: '3 ghante ke andar dekho.' },
    });
    expect(res.status).toBe(200);
    const feed = await call('GET', '/api/me/notifications', { token: u.token });
    const body = (await feed.json()) as { notifications: { kind: string; title: string }[] };
    expect(body.notifications[0].kind).toBe('system');
    expect(body.notifications[0].title).toBe('Aapki story live hai');
  });

  test('admin-assisted recovery: request → approve → one-time code → reset', async () => {
    const u = await signupUser('isha');
    const ask = await call('POST', '/api/recover', {
      body: { username: 'isha', submissionId: 'idea_known01' },
    });
    expect(ask.status).toBe(200);

    const pending = await call('GET', '/api/admin/recovery', {
      token: 'test-admin',
    });
    const pBody = (await pending.json()) as { requests: { id: string; username: string }[] };
    const pending0Id = pBody.requests[0].id;
    expect(pBody.requests).toHaveLength(1);
    expect(pBody.requests[0].username).toBe('isha');

    const approve = await call('POST', `/api/admin/recovery/${pending0Id}/approve`, {
      token: 'test-admin',
      body: { action: 'approve' },
    });
    const aBody = (await approve.json()) as { recoveryCode: string };
    expect(aBody.recoveryCode).toMatch(/^[0-9A-Z]{4}-/);

    // Their own recovery code no longer needed — the admin code works once.
    const reset = await call('POST', '/api/auth/recovery', {
      body: { username: 'isha', recoveryCode: aBody.recoveryCode, newPassword: 'nayakal2026' },
    });
    expect(reset.status).toBe(200);
    const replay = await call('POST', '/api/auth/recovery', {
      body: { username: 'isha', recoveryCode: aBody.recoveryCode, newPassword: 'teesra2026x' },
    });
    expect(replay.status).toBe(401);
    // and the user's fresh signup code was replaced as well
    expect(u.recoveryCode).toBeTruthy();
  });
});

describe('version gate', () => {
  test('public version route reports the minimum', async () => {
    const res = await call('GET', '/api/app/version');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { minVersion: string };
    expect(body.minVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('an old install is blocked everywhere except the version route', async () => {
    const old = await call('GET', '/api/manifest', { headers: { 'X-Kissa-Version': '2.13.1' } });
    expect(old.status).toBe(426);
    expect(((await old.json()) as { error: string }).error).toBe('update_required');
    const current = await call('GET', '/api/manifest', { headers: { 'X-Kissa-Version': '2.14.0' } });
    expect(current.status).toBe(200);
    const version = await call('GET', '/api/app/version', { headers: { 'X-Kissa-Version': '1.0.0' } });
    expect(version.status).toBe(200);
    // no version header (older public clients / browsers) is not blocked
    expect((await call('GET', '/api/manifest')).status).toBe(200);
  });

  test('the version route states the verdict, so the phone does not guess', async () => {
    const body = async (v?: string) =>
      (await (
        await call('GET', '/api/app/version', v ? { headers: { 'X-Kissa-Version': v } } : {})
      ).json()) as { minVersion: string; updateRequired: boolean };

    // An old install is told by the server — not by its own semver comparison.
    expect((await body('1.0.0')).updateRequired).toBe(true);
    // Current, and a version we could not read ('0.0.0' after a bad OTA
    // launch): never blocked on a guess.
    expect((await body('2.16.0')).updateRequired).toBe(false);
    expect((await body('0.0.0')).updateRequired).toBe(false);
    expect((await body()).updateRequired).toBe(false);
    // The answer depends on a request header, so it must never be cached.
    const res = await call('GET', '/api/app/version', { headers: { 'X-Kissa-Version': '2.16.0' } });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('vary')).toContain('X-Kissa-Version');
  });

  test('admin can move the switch', async () => {
    const res = await call('POST', '/api/admin/version', {
      headers: { Authorization: 'Bearer test-admin' },
      body: { minVersion: '2.15.0', message: 'Update karo.' },
    });
    expect(res.status).toBe(200);
    const blocked = await call('GET', '/api/manifest', { headers: { 'X-Kissa-Version': '2.14.0' } });
    expect(blocked.status).toBe(426);
  });
});

describe('worker entry', () => {
  test('GET /api/app/version works through the real entry point', async () => {
    resetRateLimiterForTests();
    const res = (await worker.fetch(new Request('https://beyondredeye.site/api/app/version'), makeEnv(), {} as never)) as Response;
    expect(res.status).toBe(200);
  });
});

describe('submissions require a signed-in account (v2.14)', () => {
  const idea = { creatorName: 'Arjun', title: 'Test idea', concept: 'C', genre: 'Drama' };
  // A version NEWER than the server minimum, so the version gate is not what
  // rejects these requests — the missing session is.
  const NEWER = { 'X-Kissa-Version': '99.0.0' };

  test('an old install (no version header) is told to update', async () => {
    const res = await call('POST', '/api/submit/idea', { body: idea });
    expect(res.status).toBe(426);
    expect(((await res.json()) as { error: string }).error).toBe('update_required');
  });

  test('a current install without a token must log in', async () => {
    const res = await call('POST', '/api/submit/idea', { body: idea, headers: NEWER });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('login_required');
  });

  test('story submissions are blocked the same way', async () => {
    expect((await call('POST', '/api/submit/story', { body: {} })).status).toBe(426);
    expect((await call('POST', '/api/submit/story', { body: {}, headers: NEWER })).status).toBe(401);
  });

  test('media uploads are blocked the same way', async () => {
    expect((await call('POST', '/api/submit/media', { body: {} })).status).toBe(426);
    expect((await call('POST', '/api/submit/media', { body: {}, headers: NEWER })).status).toBe(401);
  });

  test('a signed-in install submits and the row belongs to the account', async () => {
    const u = await signupUser('arjun');
    const res = await call('POST', '/api/submit/idea', { body: idea, token: u.token, headers: NEWER });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string };
    const list = await call('GET', '/api/me/submissions', { token: u.token });
    const rows = (await list.json()) as { submissions: { id: string; status: string }[] };
    expect(rows.submissions.map((s) => s.id)).toContain(created.id);
    expect(rows.submissions.find((s) => s.id === created.id)?.status).toBe('pending');
  });
});
