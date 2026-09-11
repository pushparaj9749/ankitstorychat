/**
 * Validates EVERY story package under content/stories + the manifest.
 * This is the same gate used by CI and the app's download path.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateBundle, validateManifest } from '../src/lib/validate';

const CONTENT = join(__dirname, '..', 'content');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('content manifest', () => {
  test('manifest.json is valid', () => {
    const manifest = readJson(join(CONTENT, 'manifest.json'));
    const res = validateManifest(manifest);
    expect(res.issues).toEqual([]);
    expect(res.ok).toBe(true);
  });

  test('every manifest entry has a story directory with all files', () => {
    const manifest = readJson(join(CONTENT, 'manifest.json')) as {
      stories: { id: string; storyDir: string }[];
    };
    expect(manifest.stories.length).toBeGreaterThan(0);
    for (const s of manifest.stories) {
      const dir = join(CONTENT, 'stories', s.storyDir);
      expect(existsSync(dir)).toBe(true);
      for (const f of ['story.json', 'characters.json', 'world.json', 'scenes.json', 'memory.json']) {
        expect(existsSync(join(dir, f))).toBe(true);
      }
    }
  });

  test('at least one story is rated 12-17', () => {
    const manifest = readJson(join(CONTENT, 'manifest.json')) as {
      stories: { ageRating: string }[];
    };
    expect(manifest.stories.some((s) => s.ageRating === '12-17')).toBe(true);
  });
});

describe('story bundles', () => {
  const manifest = readJson(join(CONTENT, 'manifest.json')) as {
    stories: { id: string; storyDir: string }[];
  };
  for (const entry of manifest.stories) {
    test(`${entry.id} validates`, () => {
      const dir = join(CONTENT, 'stories', entry.storyDir);
      const res = validateBundle({
        meta: entry as never,
        story: readJson(join(dir, 'story.json')),
        characters: readJson(join(dir, 'characters.json')),
        world: readJson(join(dir, 'world.json')),
        scenes: readJson(join(dir, 'scenes.json')),
        memory: readJson(join(dir, 'memory.json')),
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res.issues, null, 2));
      }
      expect(res.ok).toBe(true);
    });
  }
});

describe('no orphan story dirs', () => {
  test('every directory is listed in the manifest', () => {
    const manifest = readJson(join(CONTENT, 'manifest.json')) as {
      stories: { storyDir: string }[];
    };
    const listed = new Set(manifest.stories.map((s) => s.storyDir));
    const dirs = readdirSync(join(CONTENT, 'stories'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const d of dirs) expect(listed.has(d)).toBe(true);
  });
});
