/**
 * Accounts (D1) — unit tests against the in-memory SQL shim.
 *
 * The shim implements the same statements the D1 binding receives, so these
 * cover the real code paths: validation, unique usernames, PBKDF2 hashing,
 * session tokens, recovery-code rotation, claiming old submissions and the
 * notification feed.
 */
import {
  checkPassword,
  checkUsername,
  claimSubmissions,
  deleteAccount,
  isOlderVersion,
  listNotifications,
  login,
  markAllNotificationsRead,
  mySubmissions,
  notifySubmissionAccepted,
  resetLockoutsForTests,
  resetOnThisDevice,
  resetWithRecoveryCode,
  authenticate,
  rotateRecoveryCode,
  signup,
  unreadCount,
  usernameAvailable,
  markNotificationRead,
} from '../src/accounts/service';
import {
  memD1,
  PBKDF2_ITERATIONS,
  PBKDF2_MAX_ITERATIONS,
  RECOVERY_ITERATIONS,
  pbkdf2,
  resetMemD1ForTests,
  sha256Hex,
} from '../src/accounts/store';
import type { Env } from '../src/submissions';

function env(): Env {
  return { ASSETS: {} as never } as Env;
}

beforeEach(() => {
  resetMemD1ForTests();
  resetLockoutsForTests();
});

describe('validation', () => {
  test('usernames', () => {
    expect(checkUsername('arjun_07').ok).toBe(true);
    expect(checkUsername('  Arjun_07 ')).toEqual({ ok: true, value: 'arjun_07' });
    for (const bad of ['ab', 'a'.repeat(21), 'arjun 07', 'arjun-07', 'arjun@x', '12345', '___', 'admin', 'kissa']) {
      expect(checkUsername(bad).ok).toBe(false);
    }
  });

  test('passwords', () => {
    expect(checkPassword('kahani2026').ok).toBe(true);
    expect(checkPassword('short1').ok).toBe(false);
    expect(checkPassword('onlyletters').ok).toBe(false);
    expect(checkPassword('12345678').ok).toBe(false);
    expect(checkPassword('password123').ok).toBe(false);
    expect(checkPassword('isha2026roy', 'isha').ok).toBe(false); // contains username
    expect(checkPassword('x'.repeat(200)).ok).toBe(false);
  });
});

describe('signup & login', () => {
  test('creates an account with a usable session and a recovery code', async () => {
    const r = await signup(env(), { username: 'Arjun_07', password: 'kahani2026', displayName: 'Arjun' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.account.username).toBe('arjun_07');
    expect(r.value.account.displayName).toBe('Arjun');
    expect(r.value.recoveryCode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    // only the hash is stored
    const row = memD1.accounts.get(r.value.account.id)!;
    expect(row.password_hash).not.toContain('kahani2026');
    expect(row.recovery_hash).not.toContain(r.value.recoveryCode.replace(/-/g, ''));

    const req = new Request('https://x/api/auth/me', {
      headers: { Authorization: `Bearer ${r.value.token}` },
    });
    const auth = await authenticate(env(), req);
    expect(auth?.account.username).toBe('arjun_07');
  });

  test('duplicate username is refused, case-insensitively', async () => {
    await signup(env(), { username: 'arjun', password: 'kahani2026' });
    const again = await signup(env(), { username: 'ARJUN', password: 'doosra2026' });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.status).toBe(409);
      expect(again.error).toBe('username_taken');
    }
  });

  test('username availability', async () => {
    expect(await usernameAvailable(env(), 'meher_9')).toBe(true);
    await signup(env(), { username: 'meher_9', password: 'kahani2026' });
    expect(await usernameAvailable(env(), 'meher_9')).toBe(false);
  });

  test('login succeeds with the right password and stores only a token hash', async () => {
    await signup(env(), { username: 'kabir', password: 'kahani2026' });
    const res = await login(env(), { username: 'kabir', password: 'kahani2026' }, { ip: '1.2.3.4' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.account.username).toBe('kabir');
    const hashes = [...memD1.sessions.keys()];
    expect(hashes).toContain(await sha256Hex(res.value.token));
    expect(hashes).not.toContain(res.value.token);
  });

  test('wrong password is generic and locks after 5 tries', async () => {
    await signup(env(), { username: 'vivaan', password: 'kahani2026' });
    for (let i = 0; i < 5; i++) {
      const r = await login(env(), { username: 'vivaan', password: 'galat2026' }, { ip: '9.9.9.9' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('invalid_credentials');
    }
    const locked = await login(env(), { username: 'vivaan', password: 'kahani2026' }, { ip: '9.9.9.9' });
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.status).toBe(429);
    // another IP is unaffected
    const other = await login(env(), { username: 'vivaan', password: 'kahani2026' }, { ip: '8.8.8.8' });
    expect(other.ok).toBe(true);
  });
});

describe('recovery', () => {
  test('recovery code resets the password, is single-use and logs old devices out', async () => {
    const created = await signup(env(), { username: 'isha', password: 'kahani2026' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const oldToken = created.value.token;

    const reset = await resetWithRecoveryCode(
      env(),
      { username: 'isha', recoveryCode: created.value.recoveryCode, newPassword: 'nayakal2026' },
      { ip: '5.5.5.5' },
    );
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.value.recoveryCode).not.toBe(created.value.recoveryCode);
    expect(reset.value.recoveryCode).toMatch(/^[0-9A-Z]{4}-/);

    // old session is dead, new one works
    expect(await authenticate(env(), new Request('https://x', { headers: { Authorization: `Bearer ${oldToken}` } }))).toBeNull();
    expect(
      await authenticate(env(), new Request('https://x', { headers: { Authorization: `Bearer ${reset.value.token}` } })),
    ).not.toBeNull();

    // old code no longer works, new code does
    const reuse = await resetWithRecoveryCode(
      env(),
      { username: 'isha', recoveryCode: created.value.recoveryCode, newPassword: 'teesrakal2026' },
      { ip: '5.5.5.6' },
    );
    expect(reuse.ok).toBe(false);

    const withNew = await login(env(), { username: 'isha', password: 'nayakal2026' }, { ip: '5.5.5.7' });
    expect(withNew.ok).toBe(true);

    const second = await resetWithRecoveryCode(
      env(),
      { username: 'isha', recoveryCode: reset.value.recoveryCode, newPassword: 'teesrakal2026' },
      { ip: '5.5.5.8' },
    );
    expect(second.ok).toBe(true);
  });

  test('same-device reset keeps this device signed in and rotates the code', async () => {
    const created = await signup(env(), { username: 'meher', password: 'kahani2026' });
    if (!created.ok) throw new Error('signup failed');
    const res = await resetOnThisDevice(env(), created.value.account.id, { newPassword: 'nayasab2026' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.recoveryCode).toMatch(/^[0-9A-Z]{4}-/);
    const ok = await login(env(), { username: 'meher', password: 'nayasab2026' }, { ip: '1.1.1.1' });
    expect(ok.ok).toBe(true);
    const old = await login(env(), { username: 'meher', password: 'kahani2026' }, { ip: '1.1.1.2' });
    expect(old.ok).toBe(false);
  });

  test('rotating the recovery code invalidates the previous one', async () => {
    const created = await signup(env(), { username: 'naina', password: 'kahani2026' });
    if (!created.ok) throw new Error('signup failed');
    const fresh = await rotateRecoveryCode(env(), created.value.account.id);
    const bad = await resetWithRecoveryCode(
      env(),
      { username: 'naina', recoveryCode: created.value.recoveryCode, newPassword: 'kuchaur2026' },
      { ip: '2.2.2.2' },
    );
    expect(bad.ok).toBe(false);
    const good = await resetWithRecoveryCode(
      env(),
      { username: 'naina', recoveryCode: fresh, newPassword: 'kuchaur2026' },
      { ip: '2.2.2.3' },
    );
    expect(good.ok).toBe(true);
  });
});

describe('submissions & notifications', () => {
  async function seedSubmission(id: string, accountId: string | null, title: string) {
    memD1.submissions.set(id, {
      id,
      account_id: accountId,
      type: 'idea',
      status: 'pending',
      title,
      genre: 'Romance',
      creator_name: 'Arjun',
      payload: '{}',
      submitted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      decided_at: null,
      client: null,
    });
  }

  test('claiming attaches anonymous submissions only', async () => {
    const created = await signup(env(), { username: 'arjun', password: 'kahani2026' });
    if (!created.ok) throw new Error('signup failed');
    await seedSubmission('idea_abc123', null, 'Meri pehli idea');
    await seedSubmission('idea_other1', 'acc_someone', 'Kisi aur ki');
    const res = await claimSubmissions(env(), created.value.account.id, [
      'idea_abc123',
      'idea_other1',
      'idea_missing',
      'not-an-id',
    ]);
    expect(res.claimed).toEqual(['idea_abc123']);
    expect(res.ignored).toEqual(['idea_other1', 'idea_missing']);
    expect(memD1.submissions.get('idea_other1')!.account_id).toBe('acc_someone');
  });

  test('my submissions lists newest first with status', async () => {
    const created = await signup(env(), { username: 'arjun', password: 'kahani2026' });
    if (!created.ok) throw new Error('signup failed');
    await seedSubmission('idea_old001', created.value.account.id, 'Purani');
    await seedSubmission('idea_new001', created.value.account.id, 'Nayi');
    memD1.submissions.get('idea_old001')!.submitted_at = '2026-01-01T00:00:00.000Z';
    memD1.submissions.get('idea_new001')!.submitted_at = '2026-02-01T00:00:00.000Z';
    memD1.submissions.get('idea_new001')!.status = 'accepted';
    const list = await mySubmissions(env(), created.value.account.id);
    expect(list.map((s) => s.title)).toEqual(['Nayi', 'Purani']);
    expect(list[0].status).toBe('accepted');
  });

  test('accepted notification carries the 3-hour message and counts as unread', async () => {
    const created = await signup(env(), { username: 'arjun', password: 'kahani2026' });
    if (!created.ok) throw new Error('signup failed');
    await seedSubmission('idea_abc999', created.value.account.id, 'Hawa Mahal');
    await notifySubmissionAccepted(env(), {
      accountId: created.value.account.id,
      submissionId: 'idea_abc999',
      title: 'Hawa Mahal',
    });
    expect(await unreadCount(env(), created.value.account.id)).toBe(1);
    const list = await listNotifications(env(), created.value.account.id);
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('story_accepted');
    expect(list[0].body).toContain('3 ghante');
    expect(list[0].body).toContain('Hawa Mahal');
    await markNotificationRead(env(), created.value.account.id, list[0].id);
    expect(await unreadCount(env(), created.value.account.id)).toBe(0);
    await notifySubmissionAccepted(env(), {
      accountId: created.value.account.id,
      submissionId: 'idea_abc999',
      title: 'Hawa Mahal',
    });
    await markAllNotificationsRead(env(), created.value.account.id);
    expect(await unreadCount(env(), created.value.account.id)).toBe(0);
  });

  test('deleting an account removes sessions/notifications and anonymises submissions', async () => {
    const created = await signup(env(), { username: 'arjun', password: 'kahani2026' });
    if (!created.ok) throw new Error('signup failed');
    await seedSubmission('idea_del001', created.value.account.id, 'Delete me');
    await notifySubmissionAccepted(env(), {
      accountId: created.value.account.id,
      submissionId: 'idea_del001',
      title: 'Delete me',
    });
    await deleteAccount(env(), created.value.account.id);
    expect(memD1.accounts.size).toBe(0);
    expect(memD1.sessions.size).toBe(0);
    expect(memD1.notifications.size).toBe(0);
    expect(memD1.submissions.get('idea_del001')!.account_id).toBeNull();
  });
});

describe('version gate', () => {
  test('compares versions numerically', () => {
    expect(isOlderVersion('2.13.1', '2.14.0')).toBe(true);
    expect(isOlderVersion('2.13.10', '2.14.0')).toBe(true);
    expect(isOlderVersion('2.14.0', '2.14.0')).toBe(false);
    expect(isOlderVersion('2.15.0', '2.14.0')).toBe(false);
    expect(isOlderVersion('3.0', '2.14.0')).toBe(false);
    expect(isOlderVersion(null, '2.14.0')).toBe(false);
    expect(isOlderVersion('garbage', '2.14.0')).toBe(false);
  });
});

/**
 * Cloudflare Workers (workerd) refuses a single WebCrypto PBKDF2 call above
 * 100,000 iterations, throwing `NotSupportedError: Pbkdf2 failed: iteration
 * counts above 100000 are not supported`. Node's WebCrypto has no such
 * ceiling, so a plain hash test cannot catch a regression here — these tests
 * assert the REQUESTED iteration counts and simulate the platform cap.
 */
describe('PBKDF2 stays inside the Cloudflare runtime cap', () => {
  test('the password work factor is at most 100k', () => {
    expect(PBKDF2_ITERATIONS).toBeLessThanOrEqual(PBKDF2_MAX_ITERATIONS);
    expect(PBKDF2_MAX_ITERATIONS).toBe(100_000);
    expect(RECOVERY_ITERATIONS).toBeLessThanOrEqual(PBKDF2_MAX_ITERATIONS);
  });

  test('signup + login both derive with <= 100k iterations', async () => {
    const seen: number[] = [];
    const real = crypto.subtle.deriveBits.bind(crypto.subtle);
    const spy = jest
      .spyOn(crypto.subtle, 'deriveBits')
      .mockImplementation(((algo: { name: string; iterations?: number }, ...rest: unknown[]) => {
        if (algo && algo.name === 'PBKDF2') seen.push(Number(algo.iterations ?? 0));
        // Emulate the production ceiling.
        if (algo && Number(algo.iterations ?? 0) > 100_000) {
          const err = new Error(
            `Pbkdf2 failed: iteration counts above 100000 are not supported (requested ${algo.iterations}).`,
          );
          err.name = 'NotSupportedError';
          return Promise.reject(err);
        }
        return (real as unknown as (...a: unknown[]) => Promise<ArrayBuffer>)(algo, ...rest);
      }) as typeof crypto.subtle.deriveBits);

    try {
      const created = await signup(env(), { username: 'cap_user', password: 'kahani2026' });
      expect(created.ok).toBe(true);
      const signed = await login(env(), { username: 'cap_user', password: 'kahani2026' }, { ip: '7.7.7.7' });
      expect(signed.ok).toBe(true);
    } finally {
      spy.mockRestore();
    }

    expect(seen.length).toBeGreaterThanOrEqual(3); // password hash + recovery + login verify
    expect(Math.max(...seen)).toBeLessThanOrEqual(100_000);
  });

  test('pbkdf2() clamps an over-cap request instead of throwing', async () => {
    // A record written by the broken 210k build must still verify one password
    // later (as a 100k derivation), not explode with a 500.
    const hash = await pbkdf2('kahani2026', 'c2FsdHNhbHRzYWx0c2E=', 210_000);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(20);
  });
});
