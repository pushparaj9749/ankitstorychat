/**
 * Over-the-air story delivery through the Kissa story API.
 *
 * New stories land in content/manifest.json + content/stories/<id>/ in the
 * private repository, are deployed to the story API (Cloudflare Worker,
 * https://beyondredeye.site/api) by CI, and are downloaded as JSON at
 * runtime — no app update, and the app never contacts GitHub. The manifest is
 * COMPILED INTO THE APK, so every story (bundled or not) shows up in Home /
 * Discover. Two things must therefore hold:
 *
 *  1. The catalog lists every story (bundled manifest + cached remote).
 *     Packages download automatically the first time a reader opens them.
 *  2. Opening a story that is not yet cached downloads, validates and
 *     installs it. A cached copy opens immediately, including offline.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StoryMeta } from '../src/types';

const API_BASE = 'https://example.test/api';

// Real repo content — the same payload the device fetches from the API.
const manifest = JSON.parse(
  readFileSync(join(__dirname, '..', 'content', 'manifest.json'), 'utf8'),
) as { contentVersion: number; stories: { id: string; version: number; storyDir: string }[] };

let fetchCalls: string[] = [];
/** Mocked API responses; special __-keys steer the fake transport. */
let fetchBody: Record<string, unknown> = {};

global.fetch = jest.fn(async (input: unknown) => {
  const url = String(input);
  fetchCalls.push(url);
  if (fetchBody.__networkDown) throw new TypeError('Network request failed');
  if (url === `${API_BASE}/manifest`) {
    const raw = fetchBody.__rawManifest ?? JSON.stringify(fetchBody.manifest ?? manifest);
    const status = (fetchBody.__manifestStatus as number) ?? 200;
    if (status !== 200) return { ok: false, status } as unknown as Response;
    return { ok: true, status: 200, text: async () => raw } as unknown as Response;
  }
  // Per-file story downloads.
  const m = url.match(/\/stories\/([a-z0-9-]+)\/([a-z.]+)$/);
  if (m && fetchBody[m[2]] !== undefined) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(fetchBody[m[2]]),
    } as unknown as Response;
  }
  // Cover fetches are best-effort; answer 404 so they are skipped.
  if (url.endsWith('/assets/cover.jpg') || url.endsWith('/assets/cover.png')) {
    return { ok: false, status: 404 } as unknown as Response;
  }
  throw new Error(`unexpected fetch: ${url}`);
}) as unknown as typeof fetch;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { KISSA_CONTENT_API_BASE_URL: 'https://example.test/api' } } },
}));

// Minimal in-memory "filesystem" so cached manifests / packages behave.
const mockFileStore = new Map<string, string>();

jest.mock('../src/lib/files', () => ({
  CONTENT_DIR: 'kissa-content/',
  STORIES_DIR: 'kissa-content/stories/',
  docPath: (...p: string[]) => p.join(''),
  exists: jest.fn(async (uri: string) => mockFileStore.has(uri)),
  readJson: jest.fn(async (uri: string) => {
    const t = mockFileStore.get(uri);
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }),
  readText: jest.fn(async (uri: string) => mockFileStore.get(uri) ?? null),
  writeText: jest.fn(async (uri: string, text: string) => {
    mockFileStore.set(uri, text);
  }),
  remove: jest.fn(async (uri: string) => {
    mockFileStore.delete(uri);
  }),
  ensureDir: jest.fn(async () => undefined),
}));

jest.mock('../src/lib/db', () => ({
  getDownloadRecord: jest.fn(async () => null),
  listDownloads: jest.fn(async () => []),
  recordDownload: jest.fn(async () => undefined),
  removeDownloadRecord: jest.fn(async () => undefined),
}));

import { bundledStoryIds } from '../src/content/bundled';
import {
  checkForUpdates,
  contentApiUrl,
  DEFAULT_CONTENT_API_BASE_URL,
  downloadStory,
  getBundle,
  isStoryOnDevice,
  listStories,
  manifestApiUrl,
  storyFileApiUrl,
  StoryContentError,
} from '../src/content/loader';
import { getDownloadRecord, recordDownload } from '../src/lib/db';
import { writeText } from '../src/lib/files';

const bundledIds = new Set(bundledStoryIds());
/** Stories listed in the APK manifest but whose files ship only via the API. */
const otaOnly = manifest.stories.filter((s) => !bundledIds.has(s.id)).map((s) => s.id);

/** A full, valid package fixture (real repo files for one story). */
function packageFixture(storyId: string): Record<string, unknown> {
  const dir = join(__dirname, '..', 'content', 'stories', storyId);
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
  return {
    'story.json': read('story.json'),
    'characters.json': read('characters.json'),
    'world.json': read('world.json'),
    'scenes.json': read('scenes.json'),
    'memory.json': read('memory.json'),
  };
}

beforeEach(() => {
  fetchCalls = [];
  fetchBody = {};
  mockFileStore.clear();
  jest.clearAllMocks();
  (getDownloadRecord as jest.Mock).mockResolvedValue(null);
});

describe('OTA story availability', () => {
  test('the APK catalog lists every story; packages download on first open', () => {
    expect(bundledIds.size).toBe(0);
    expect(otaOnly.length).toBe(manifest.stories.length);
  });

  test('API-only stories are offered as NEW downloads', async () => {
    const res = await checkForUpdates(API_BASE, '18+');
    const offered = res.newStories.map((s) => s.id);

    expect(res.hasUpdate).toBe(true);
    for (const id of otaOnly) {
      expect(offered).toContain(id);
    }
  });

  test('an API-only story is not reported as being on the device', async () => {
    for (const id of otaOnly) {
      await expect(isStoryOnDevice(id)).resolves.toBe(false);
    }
  });

  test('stories compiled into the APK are never offered as new', async () => {
    const res = await checkForUpdates(API_BASE, '18+');
    const offered = [...res.newStories, ...res.updatedStories].map((s) => s.id);
    for (const id of bundledIds) {
      expect(offered).not.toContain(id);
    }
  });

  test('an already-downloaded story (current version) is not offered again', async () => {
    const meta = manifest.stories.find((s) => s.id === otaOnly[0])!;
    (getDownloadRecord as jest.Mock).mockImplementation(async (id: string) =>
      id === otaOnly[0]
        ? { storyId: id, version: meta.version, downloadedAt: '2026-01-01T00:00:00.000Z' }
        : null,
    );
    const res = await checkForUpdates(API_BASE, '18+');
    expect(res.newStories.map((s) => s.id)).not.toContain(otaOnly[0]);
    expect(res.updatedStories.map((s) => s.id)).not.toContain(otaOnly[0]);
  });

  test('a newer API version of a downloaded story is offered as an UPDATE', async () => {
    (getDownloadRecord as jest.Mock).mockImplementation(async (id: string) =>
      id === otaOnly[0]
        ? { storyId: id, version: 0, downloadedAt: '2026-01-01T00:00:00.000Z' }
        : null,
    );
    const res = await checkForUpdates(API_BASE, '18+');
    expect(res.updatedStories.map((s) => s.id)).toContain(otaOnly[0]);
    expect(res.newStories.map((s) => s.id)).not.toContain(otaOnly[0]);
  });

  test('remote contentVersion is reported for the settings screen', async () => {
    const res = await checkForUpdates(API_BASE, '18+');
    expect(res.remoteContentVersion).toBe(manifest.contentVersion);
  });
});

describe('opening a story (cache-first, auto-download)', () => {
  test('with network, an uncached story is downloaded, validated, cached, then opened', async () => {
    Object.assign(fetchBody, packageFixture(otaOnly[0]));
    const bundle = await getBundle(otaOnly[0], '18+');
    expect(bundle.source).toBe('downloaded');
    expect(bundle.story.id).toBe(otaOnly[0]);
    for (const f of ['story.json', 'characters.json', 'world.json', 'scenes.json', 'memory.json']) {
      expect(fetchCalls).toContain(`${API_BASE}/stories/${otaOnly[0]}/${f}`);
      expect(mockFileStore.has(`kissa-content/stories/${otaOnly[0]}/${f}`)).toBe(true);
    }
  });

  test('without network and without a cache, opening fails with a retryable network code', async () => {
    fetchBody.__networkDown = true;
    const err = (await getBundle(otaOnly[0], '18+').catch((e: unknown) => e)) as StoryContentError;
    expect(err).toBeInstanceOf(StoryContentError);
    expect(err.code).toBe('network');
  });

  test('a cached story opens immediately without hitting the network', async () => {
    Object.assign(fetchBody, packageFixture(otaOnly[0]));
    await downloadStory(
      manifest.stories.find((s) => s.id === otaOnly[0]) as unknown as StoryMeta,
      API_BASE,
      '18+',
    );
    (getDownloadRecord as jest.Mock).mockResolvedValue({
      storyId: otaOnly[0],
      version: manifest.stories.find((s) => s.id === otaOnly[0])!.version,
      downloadedAt: '2026-01-01T00:00:00.000Z',
    });
    fetchCalls = [];
    fetchBody.__networkDown = true;
    const bundle = await getBundle(otaOnly[0], '18+');
    expect(bundle.source).toBe('downloaded');
    expect(bundle.story.id).toBe(otaOnly[0]);
    expect(fetchCalls).toEqual([]);
  });

  test('a corrupted remote package is rejected and never installed', async () => {
    const bad = packageFixture(otaOnly[0]);
    (bad['story.json'] as { id: string }).id = 'wrong-id'; // fails validation
    Object.assign(fetchBody, bad);
    await expect(getBundle(otaOnly[0], '18+')).rejects.toThrow(StoryContentError);
    expect(mockFileStore.has(`kissa-content/stories/${otaOnly[0]}/story.json`)).toBe(false);
  });

  test('an invalid story id is rejected', async () => {
    const err = (await getBundle('not-a-real-story', '18+').catch((e: unknown) => e)) as StoryContentError;
    expect(err).toBeInstanceOf(StoryContentError);
    expect(err.code).toBe('notfound');
  });
});

describe('story API URL construction', () => {
  test('all content URLs derive from the single API base', () => {
    expect(manifestApiUrl(API_BASE)).toBe(`${API_BASE}/manifest`);
    expect(storyFileApiUrl(API_BASE, 'midnight-local', 'story.json')).toBe(
      `${API_BASE}/stories/midnight-local/story.json`,
    );
    expect(storyFileApiUrl(API_BASE, 'x', 'assets/cover.jpg')).toBe(
      `${API_BASE}/stories/x/assets/cover.jpg`,
    );
  });

  test('trailing slashes in the base are tolerated', () => {
    expect(manifestApiUrl('https://example.test/api/')).toBe(`${API_BASE}/manifest`);
    expect(manifestApiUrl('https://example.test/api//')).toBe(`${API_BASE}/manifest`);
  });

  test('relative manifest cover paths resolve against the base', () => {
    expect(contentApiUrl(API_BASE, 'stories/x/assets/cover.jpg')).toBe(
      `${API_BASE}/stories/x/assets/cover.jpg`,
    );
  });

  test('absolute (legacy) URLs pass through untouched', () => {
    expect(contentApiUrl(API_BASE, 'https://old.example/cover.jpg')).toBe(
      'https://old.example/cover.jpg',
    );
  });

  test('production default base is https://beyondredeye.site/api', () => {
    expect(DEFAULT_CONTENT_API_BASE_URL).toBe('https://beyondredeye.site/api');
  });

  test('the app never constructs raw GitHub content URLs', async () => {
    await checkForUpdates(API_BASE, '18+');
    for (const url of fetchCalls) {
      expect(url).not.toMatch(/github\.com|githubusercontent\.com/);
    }
  });
});

describe('downloading a story package from the API', () => {
  test('downloads the five files from the API, validates and installs them', async () => {
    const meta = manifest.stories.find((s) => s.id === 'midnight-local') as unknown as StoryMeta;
    Object.assign(fetchBody, packageFixture('midnight-local'));

    await downloadStory(meta, API_BASE, '18+', () => undefined);

    const files = ['story.json', 'characters.json', 'world.json', 'scenes.json', 'memory.json'];
    // Exactly the package files were fetched from the API (midnight-local
    // relies on its bundled cover, so no cover fetch happens).
    expect(fetchCalls).toEqual(files.map((f) => `${API_BASE}/stories/midnight-local/${f}`));
    // Installed into the local cache…
    for (const f of files) {
      expect(writeText).toHaveBeenCalledWith(
        `kissa-content/stories/midnight-local/${f}`,
        expect.any(String),
      );
      expect(mockFileStore.has(`kissa-content/stories/midnight-local/${f}`)).toBe(true);
    }
    // …and recorded so it is never re-offered.
    expect(recordDownload).toHaveBeenCalledWith('midnight-local', meta.version, expect.any(String));
  });

  test('a malformed package is rejected and nothing is installed', async () => {
    const meta = manifest.stories.find((s) => s.id === 'midnight-local') as unknown as StoryMeta;
    const bad = packageFixture('midnight-local');
    (bad['story.json'] as { id: string }).id = 'not-midnight-local'; // fails validation
    Object.assign(fetchBody, bad);

    await expect(downloadStory(meta, API_BASE, '18+', () => undefined)).rejects.toThrow(
      StoryContentError,
    );
    expect(writeText).not.toHaveBeenCalled();
    expect(recordDownload).not.toHaveBeenCalled();
  });

  test('progress is reported per file', async () => {
    const meta = manifest.stories.find((s) => s.id === 'midnight-local') as unknown as StoryMeta;
    Object.assign(fetchBody, packageFixture('midnight-local'));
    const seen: string[] = [];
    await downloadStory(meta, API_BASE, '18+', (file) => seen.push(file));
    expect(seen).toEqual([
      'story.json',
      'characters.json',
      'world.json',
      'scenes.json',
      'memory.json',
      'done',
    ]);
  });

  test('relative manifest cover URLs are fetched from the API (not GitHub)', async () => {
    const meta = manifest.stories.find(
      (s) => s.id === 'goddess-who-chose-me',
    ) as unknown as StoryMeta;
    expect(meta.coverUrl).toMatch(/^stories\//); // relative API path
    Object.assign(fetchBody, packageFixture('goddess-who-chose-me'));
    await downloadStory(meta, API_BASE, '18+', () => undefined);
    expect(fetchCalls).toContain(`${API_BASE}/stories/goddess-who-chose-me/assets/cover.jpg`);
  });

  test('a downloaded copy keeps working fully offline', async () => {
    const meta = manifest.stories.find(
      (s) => s.id === 'goddess-who-chose-me',
    ) as unknown as StoryMeta;
    Object.assign(fetchBody, packageFixture('goddess-who-chose-me'));
    await downloadStory(meta, API_BASE, '18+', () => undefined);
    await expect(isStoryOnDevice('goddess-who-chose-me')).resolves.toBe(true);

    (getDownloadRecord as jest.Mock).mockResolvedValue({
      storyId: 'goddess-who-chose-me',
      version: meta.version,
      downloadedAt: '2026-01-01T00:00:00.000Z',
    });
    fetchBody.__networkDown = true;
    fetchCalls = [];
    const bundle = await getBundle('goddess-who-chose-me', '18+');
    expect(bundle.source).toBe('downloaded');
    expect(bundle.story.id).toBe('goddess-who-chose-me');
    expect(fetchCalls).toEqual([]);
  });
});

describe('API failure modes', () => {
  test('a malformed manifest payload is rejected, not installed', async () => {
    fetchBody.__rawManifest = '{"contentVersion": "not-a-number"';
    await expect(checkForUpdates(API_BASE, '18+')).rejects.toThrow(/malformed/i);
  });

  test('an invalid manifest is rejected with a clear error', async () => {
    fetchBody.manifest = { contentVersion: 'x', stories: 'nope' };
    await expect(checkForUpdates(API_BASE, '18+')).rejects.toThrow(/invalid/i);
  });

  test('server errors surface as a retryable network error', async () => {
    fetchBody.__manifestStatus = 503;
    const err = (await checkForUpdates(API_BASE, '18+').catch((e: unknown) => e)) as StoryContentError;
    expect(err).toBeInstanceOf(StoryContentError);
    expect(err.code).toBe('network');
  });

  test('rate limiting (429) surfaces as a retryable network error', async () => {
    fetchBody.__manifestStatus = 429;
    const err = (await checkForUpdates(API_BASE, '18+').catch((e: unknown) => e)) as StoryContentError;
    expect(err.code).toBe('network');
  });

  test('network failure does not break offline usage', async () => {
    fetchBody.__networkDown = true;
    await expect(checkForUpdates(API_BASE, '18+')).rejects.toMatchObject({
      code: 'network',
    });
    // Nothing was installed and nothing crashes — the app keeps working.
  });

  test('a previously cached manifest keeps OTA stories visible offline', async () => {
    // First (online) check caches the remote manifest.
    await checkForUpdates(API_BASE, '18+');
    expect(mockFileStore.has('kissa-content/manifest-cache.json')).toBe(true);

    // Offline: the check fails…
    fetchBody.__networkDown = true;
    await expect(checkForUpdates(API_BASE, '18+')).rejects.toMatchObject({ code: 'network' });

    // …but the effective catalog still contains the OTA stories.
    const stories = await listStories('18+');
    for (const id of otaOnly) {
      expect(stories.map((s) => s.id)).toContain(id);
    }
  });
});
