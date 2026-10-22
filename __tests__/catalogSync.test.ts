/**
 * v2.10.1 — new OTA stories must show up on the FIRST launch after they go
 * live, not only on the second. syncCatalog reports `changed` so the app
 * re-reads its story list right after the manifest fetch.
 */
import fs from 'fs';
import path from 'path';

const mockState: { before: any; after: any; remote: any } = { before: null, after: null, remote: null };
let effectiveCalls = 0;

jest.mock('../src/content/loader', () => ({
  getEffectiveManifest: jest.fn(async () => (effectiveCalls++ === 0 ? mockState.before : mockState.after)),
  checkForUpdates: jest.fn(async () => ({ remote: mockState.remote })),
}));

import { syncCatalog } from '../src/content/sync';

const story = (id: string, version = 1, ageRating = '18+') => ({
  id,
  version,
  ageRating,
  contentLevel: ageRating === '18+' ? 'mature' : 'teen',
  updatedAt: '2026-10-20T00:00:00Z',
});
const manifest = (contentVersion: number, stories: any[]) => ({ contentVersion, stories });

beforeEach(() => {
  effectiveCalls = 0;
});

describe('syncCatalog', () => {
  it('reports a change and one fresh story when a new story goes live', async () => {
    const old = manifest(51, [story('a'), story('b')]);
    const next = manifest(52, [story('a'), story('b'), story('dulhan-bhagi-shadi-se')]);
    Object.assign(mockState, { before: old, after: next, remote: next });
    await expect(syncCatalog('https://x/api', '18+')).resolves.toEqual({ changed: true, freshCount: 1 });
  });

  it('reports no change (and nothing to notify) when the catalog is the same', async () => {
    const same = manifest(52, [story('a'), story('b')]);
    Object.assign(mockState, { before: same, after: same, remote: same });
    await expect(syncCatalog('https://x/api', '18+')).resolves.toEqual({ changed: false, freshCount: 0 });
  });

  it('counts a story whose version went up as fresh', async () => {
    const old = manifest(51, [story('a', 1)]);
    const next = manifest(52, [story('a', 2)]);
    Object.assign(mockState, { before: old, after: next, remote: next });
    await expect(syncCatalog('https://x/api', '18+')).resolves.toEqual({ changed: true, freshCount: 1 });
  });

  it('does not count stories hidden for the age group', async () => {
    const old = manifest(51, [story('a', 1, '12-17')]);
    const next = manifest(52, [story('a', 1, '12-17'), story('adult-only', 1, '18+')]);
    Object.assign(mockState, { before: old, after: next, remote: next });
    const res = await syncCatalog('https://x/api', '12-17');
    expect(res.freshCount).toBe(0);
  });
});

describe('RootNavigator wiring', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/navigation/RootNavigator.tsx'), 'utf8');
  it('refreshes the story list right after a changed sync', () => {
    expect(src).toMatch(/syncCatalog\(/);
    expect(src).toMatch(/if \(res\.changed[^)]*\) await latest\.current\.refreshStories\(\)/);
  });
  it('re-checks when the app returns to the foreground', () => {
    expect(src).toMatch(/AppState\.addEventListener\('change'/);
  });
  it('no longer calls checkForUpdates directly (the cache-only path)', () => {
    expect(src).not.toMatch(/checkForUpdates/);
  });
});
