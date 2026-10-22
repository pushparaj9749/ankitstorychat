/**
 * "Naya version aaya hai" (v2.9.0): version compare, GitHub release parsing,
 * caching, dismissal — and that the request carries no user data.
 */
const kv = new Map<string, string>();
jest.mock('../src/lib/db', () => ({
  kvGet: jest.fn(async (k: string) => kv.get(k) ?? null),
  kvSet: jest.fn(async (k: string, v: string) => void kv.set(k, v)),
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '2.9.0' } } }));

import {
  RELEASES_API,
  checkForUpdate,
  compareVersions,
  dismissUpdate,
  isUpdateDismissed,
  onUpdateStatus,
  parseRelease,
  parseVersion,
} from '../src/lib/updateCheck';

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  html_url: `https://github.com/pushparaj9749/ankitstorychat/releases/tag/${tag}`,
  draft: false,
  prerelease: false,
  body: '## What\'s new\n- **App Lock**\n- Update banner',
  assets: [
    { name: 'checksums.txt', browser_download_url: 'https://github.com/x/checksums.txt' },
    { name: `kissa-${tag}.apk`, browser_download_url: `https://github.com/pushparaj9749/ankitstorychat/releases/download/${tag}/kissa-${tag}.apk` },
  ],
  ...extra,
});

const okFetch = (json: unknown) =>
  jest.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => json }) as unknown as Response);

beforeEach(() => kv.clear());

describe('versions', () => {
  it('parses tags', () => {
    expect(parseVersion('v2.10.1')).toEqual([2, 10, 1]);
    expect(parseVersion('2.9')).toEqual([2, 9, 0]);
    expect(parseVersion('v3.0.0-beta.1')).toEqual([3, 0, 0]);
    expect(parseVersion('latest')).toBeNull();
  });

  it('compares numerically, not as text', () => {
    expect(compareVersions('2.10.0', '2.9.0')).toBe(1);
    expect(compareVersions('v2.9.0', '2.9.0')).toBe(0);
    expect(compareVersions('2.8.9', '2.9.0')).toBe(-1);
    expect(compareVersions('3.0', '2.99.99')).toBe(1);
  });
});

describe('parseRelease', () => {
  it('picks the .apk asset and cleans the notes', () => {
    const r = parseRelease(release('v2.10.0'))!;
    expect(r.version).toBe('2.10.0');
    expect(r.downloadUrl).toBe('https://github.com/pushparaj9749/ankitstorychat/releases/download/v2.10.0/kissa-v2.10.0.apk');
    expect(r.notes).toContain('• App Lock');
    expect(r.notes).not.toContain('**');
  });

  it('falls back to the release page without an APK and ignores drafts / pre-releases / junk', () => {
    expect(parseRelease(release('v2.10.0', { assets: [] }))!.downloadUrl).toContain('/releases/tag/v2.10.0');
    expect(parseRelease(release('v2.10.0', { prerelease: true }))).toBeNull();
    expect(parseRelease(release('v2.10.0', { draft: true }))).toBeNull();
    expect(parseRelease({ message: 'API rate limit exceeded' })).toBeNull();
    expect(parseRelease(null)).toBeNull();
  });

  it('only trusts github.com download links', () => {
    const evil = release('v2.10.0', { assets: [{ name: 'kissa.apk', browser_download_url: 'https://evil.example/kissa.apk' }] });
    expect(parseRelease(evil)!.downloadUrl).toMatch(/^https:\/\/github\.com\//);
  });
});

describe('checkForUpdate', () => {
  it('reports a newer release', async () => {
    const f = okFetch(release('v2.10.0'));
    const s = await checkForUpdate({ fetchImpl: f as unknown as typeof fetch, now: 1 });
    expect(s).toMatchObject({ current: '2.9.0', available: true, latest: { version: '2.10.0' } });
  });

  it('is quiet when up to date or older', async () => {
    const same = await checkForUpdate({ fetchImpl: okFetch(release('v2.9.0')) as unknown as typeof fetch, now: 1, force: true });
    expect(same.available).toBe(false);
    const older = await checkForUpdate({ fetchImpl: okFetch(release('v2.8.0')) as unknown as typeof fetch, now: 2, force: true });
    expect(older.available).toBe(false);
  });

  it('sends a plain anonymous GET to the public releases API only', async () => {
    const f = okFetch(release('v2.10.0'));
    await checkForUpdate({ fetchImpl: f as unknown as typeof fetch, now: 1 });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(RELEASES_API);
    expect(url).toBe('https://api.github.com/repos/pushparaj9749/ankitstorychat/releases/latest');
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(Object.keys((init?.headers ?? {}) as object)).toEqual(['Accept']);
  });

  it('re-asks GitHub after 15 minutes, not 6 hours (banner shows by itself)', async () => {
    const f = okFetch(release('v2.10.0'));
    const impl = f as unknown as typeof fetch;
    await checkForUpdate({ fetchImpl: impl, now: 0 });
    await checkForUpdate({ fetchImpl: impl, now: 14 * 60_000 });
    expect(f).toHaveBeenCalledTimes(1);
    await checkForUpdate({ fetchImpl: impl, now: 15 * 60_000 + 1 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('a release published after an "up to date" answer is picked up within 15 minutes', async () => {
    const old = await checkForUpdate({ fetchImpl: okFetch(release('v2.9.0')) as unknown as typeof fetch, now: 0 });
    expect(old.available).toBe(false);
    const fresh = await checkForUpdate({ fetchImpl: okFetch(release('v2.9.1')) as unknown as typeof fetch, now: 16 * 60_000 });
    expect(fresh).toMatchObject({ available: true, latest: { version: '2.9.1' } });
  });

  it('broadcasts every result (auto or manual) to listeners', async () => {
    const seen: string[] = [];
    const off = onUpdateStatus((s) => seen.push(`${s.latest?.version}:${s.available}`));
    await checkForUpdate({ fetchImpl: okFetch(release('v2.10.0')) as unknown as typeof fetch, now: 0, force: true });
    off();
    await checkForUpdate({ fetchImpl: okFetch(release('v2.11.0')) as unknown as typeof fetch, now: 1, force: true });
    expect(seen).toEqual(['2.10.0:true']);
  });

  it('never throws offline and keeps the last good answer', async () => {
    await checkForUpdate({ fetchImpl: okFetch(release('v2.10.0')) as unknown as typeof fetch, now: 0 });
    const offline = jest.fn(async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    const s = await checkForUpdate({ fetchImpl: offline, now: 7 * 3600_000 });
    expect(s).toMatchObject({ available: true, latest: { version: '2.10.0' } });
    kv.clear();
    expect(await checkForUpdate({ fetchImpl: offline, now: 1 })).toMatchObject({ available: false, latest: null });
  });

  it('a failed check is not cached — the next launch tries again', async () => {
    const offline = jest.fn(async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    await checkForUpdate({ fetchImpl: offline, now: 1 });
    expect(kv.has('update.latest')).toBe(false);
    const f = okFetch(release('v2.10.0'));
    const s = await checkForUpdate({ fetchImpl: f as unknown as typeof fetch, now: 2 });
    expect(f).toHaveBeenCalledTimes(1);
    expect(s.available).toBe(true);
  });

  it('treats a rate-limited response as "no news"', async () => {
    const f = jest.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await checkForUpdate({ fetchImpl: f, now: 1 })).toMatchObject({ available: false });
  });
});

describe('dismiss ("Baad mein")', () => {
  it('hides only that version', async () => {
    await dismissUpdate('2.10.0');
    expect(await isUpdateDismissed('2.10.0')).toBe(true);
    expect(await isUpdateDismissed('2.11.0')).toBe(false);
  });
});

describe('banner shows by itself (v2.9.5)', () => {
  const fs = require('fs') as typeof import('fs');
  const read = (p: string) => fs.readFileSync(p, 'utf8');

  it('re-checks on foreground and listens for manual checks', () => {
    const b = read('src/components/UpdateBanner.tsx');
    expect(b).toMatch(/AppState\.addEventListener\('change'/);
    expect(b).toMatch(/onUpdateStatus\(/);
    expect(b).toMatch(/setInterval\(/);
    expect(read('src/lib/updateCheck.ts')).not.toMatch(/6 \* 60 \* 60 \* 1000/);
  });

  it('is on Home in both templates', () => {
    expect(read('src/screens/Home.tsx')).toMatch(/<UpdateBanner \/>/);
    expect(read('src/ui/classic/Home.tsx')).toMatch(/<UpdateBanner \/>/);
  });
});
