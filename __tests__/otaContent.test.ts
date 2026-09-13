/**
 * Over-the-air story delivery.
 *
 * New stories land in content/manifest.json + content/stories/<id>/ on GitHub
 * and are downloaded as JSON at runtime — no app update. The manifest is
 * COMPILED INTO THE APK, so every story (bundled or not) shows up in Home /
 * Discover. Two things must therefore hold, and both were broken:
 *
 *  1. "Check for new stories" must list the stories whose files are NOT in the
 *     APK. The old code asked the *manifest* whether a story was installed,
 *     and the manifest lists all of them, so OTA stories looked already
 *     installed and no download button ever appeared.
 *  2. Opening an OTA story that is not yet downloaded must fail with a
 *     recoverable "missing" error, so StoryDetail can offer the download
 *     instead of dead-ending on "Couldn't open story".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MANIFEST_URL = 'https://example.test/content/manifest.json';

// Real repo content — the same payload the device fetches from GitHub.
const manifest = JSON.parse(
  readFileSync(join(__dirname, '..', 'content', 'manifest.json'), 'utf8'),
) as { contentVersion: number; stories: { id: string; version: number }[] };

let fetchCalls: string[] = [];

global.fetch = jest.fn(async (input: unknown) => {
  const url = String(input);
  fetchCalls.push(url);
  if (url.endsWith('manifest.json')) {
    return { ok: true, status: 200, json: async () => manifest } as unknown as Response;
  }
  throw new Error(`unexpected fetch: ${url}`);
}) as unknown as typeof fetch;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { contentManifestUrl: 'https://example.test/content/manifest.json' } } },
}));

// No downloaded story packages on this device.
jest.mock('../src/lib/files', () => ({
  CONTENT_DIR: 'kissa-content/',
  STORIES_DIR: 'kissa-content/stories/',
  docPath: (...p: string[]) => p.join(''),
  exists: jest.fn(async () => false),
  readJson: jest.fn(async () => null),
  readText: jest.fn(async () => null),
  writeText: jest.fn(async () => undefined),
  remove: jest.fn(async () => undefined),
  ensureDir: jest.fn(async () => undefined),
}));

jest.mock('../src/lib/db', () => ({
  getDownloadRecord: jest.fn(async () => null),
  listDownloads: jest.fn(async () => []),
  recordDownload: jest.fn(async () => undefined),
  removeDownloadRecord: jest.fn(async () => undefined),
}));

import { bundledStoryIds } from '../src/content/bundled';
import { checkForUpdates, getBundle, isStoryOnDevice, StoryContentError } from '../src/content/loader';
import { getDownloadRecord } from '../src/lib/db';

const bundledIds = new Set(bundledStoryIds());
/** Stories listed in the APK manifest but whose files ship only on GitHub. */
const otaOnly = manifest.stories.filter((s) => !bundledIds.has(s.id)).map((s) => s.id);

beforeEach(() => {
  fetchCalls = [];
  (getDownloadRecord as jest.Mock).mockResolvedValue(null);
});

describe('OTA story availability', () => {
  test('the repo ships stories that are GitHub-only (fixture sanity)', () => {
    // If this ever fails, every other assertion here is vacuous.
    expect(bundledIds.size).toBeGreaterThan(0);
    expect(otaOnly.length).toBeGreaterThan(0);
  });

  test('GitHub-only stories are offered as NEW downloads', async () => {
    const res = await checkForUpdates(MANIFEST_URL, '18+');
    const offered = res.newStories.map((s) => s.id);

    expect(res.hasUpdate).toBe(true);
    for (const id of otaOnly) {
      expect(offered).toContain(id);
    }
  });

  test('a GitHub-only story is not reported as being on the device', async () => {
    for (const id of otaOnly) {
      await expect(isStoryOnDevice(id)).resolves.toBe(false);
    }
  });

  test('stories compiled into the APK are never offered as new', async () => {
    const res = await checkForUpdates(MANIFEST_URL, '18+');
    const offered = [...res.newStories, ...res.updatedStories].map((s) => s.id);
    for (const id of bundledIds) {
      expect(offered).not.toContain(id);
    }
  });

  test('an already-downloaded story is not offered again', async () => {
    (getDownloadRecord as jest.Mock).mockImplementation(async (id: string) =>
      id === otaOnly[0] ? { storyId: id, version: 1, downloadedAt: '2026-01-01T00:00:00.000Z' } : null,
    );
    const res = await checkForUpdates(MANIFEST_URL, '18+');
    expect(res.newStories.map((s) => s.id)).not.toContain(otaOnly[0]);
  });

  test('a newer GitHub version of a downloaded story is offered as an UPDATE', async () => {
    (getDownloadRecord as jest.Mock).mockImplementation(async (id: string) =>
      id === otaOnly[0] ? { storyId: id, version: 0, downloadedAt: '2026-01-01T00:00:00.000Z' } : null,
    );
    const res = await checkForUpdates(MANIFEST_URL, '18+');
    expect(res.updatedStories.map((s) => s.id)).toContain(otaOnly[0]);
    expect(res.newStories.map((s) => s.id)).not.toContain(otaOnly[0]);
  });
});

describe('opening a story that is not on the device', () => {
  test('fails with a recoverable "missing" code instead of a dead end', async () => {
    const err = await getBundle(otaOnly[0], '18+').then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(StoryContentError);
    expect(err).toMatchObject({ code: 'missing' });
  });

  test('does not pretend the device is offline', async () => {
    // Regression guard: a missing package must not be reported as a network
    // failure, or the UI tells the user to "check your internet" forever.
    const err = (await getBundle(otaOnly[0], '18+').catch((e: unknown) => e)) as StoryContentError;
    expect(err.message).not.toMatch(/internet/i);
    expect(fetchCalls).toEqual([]);
  });
});
