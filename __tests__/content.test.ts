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

  /**
   * Stories arrive over-the-air, so the manifest entry IS the store listing:
   * Home cards, Discover results and downloads all read these fields. A missing
   * tagline/popularity degrades the UI silently, so we assert it here instead.
   */
  test('every manifest entry is display-ready for OTA cards', () => {
    const manifest = readJson(join(CONTENT, 'manifest.json')) as {
      contentVersion: number;
      stories: Record<string, unknown>[];
    };
    const assert = (cond: unknown, msg: string) => {
      if (!cond) throw new Error(msg);
    };
    expect(typeof manifest.contentVersion).toBe('number');
    for (const s of manifest.stories) {
      const id = String(s.id);
      for (const key of ['tagline', 'description', 'accentColor', 'userRole', 'setting', 'storyDir', 'updatedAt'] as const) {
        assert(typeof s[key] === 'string', `${id}.${key} must be a string`);
        assert((s[key] as string).trim().length > 3, `${id}.${key} is empty`);
      }
      assert(Array.isArray(s.genres) && (s.genres as string[]).length > 0, `${id}.genres empty`);
      assert(Array.isArray(s.characters) && (s.characters as string[]).length > 0, `${id}.characters empty`);
      assert(typeof s.estimatedMinutes === 'number', `${id}.estimatedMinutes must be a number`);
      assert(typeof s.popularity === 'number', `${id}.popularity must be a number`);
      // a cover must resolve without an app update (bundled asset OR remote URL)
      assert(s.coverBundled || s.coverUrl, `${id} has no cover source`);
    }
  });

  /** The opening block is the first thing a user sees — it must always exist and,
   *  for stories that ship the current story format, follow it exactly (faded
   *  *action* lines + Name: "dialogue" bubbles). */
  test('every story opens with narration in the Kissa story format', () => {
    const assert = (cond: unknown, msg: string) => {
      if (!cond) throw new Error(msg);
    };
    const manifest = readJson(join(CONTENT, 'manifest.json')) as {
      stories: { id: string; storyDir: string }[];
    };
    for (const entry of manifest.stories) {
      const dir = join(CONTENT, 'stories', entry.storyDir);
      const story = readJson(join(dir, 'story.json')) as { openingSceneId: string };
      const scenes = readJson(join(dir, 'scenes.json')) as {
        scenes: {
          id: string;
          narration: string[];
          fallbackLines: string[];
          choices: { shortLabel?: string }[];
        }[];
      };
      const opening = scenes.scenes.find((s) => s.id === story.openingSceneId);
      assert(!!opening, `${entry.id}: opening scene missing`);
      // universal: a real hook — some narration and more than one choice
      assert(opening!.narration.length >= 2, `${entry.id}: opening too short`);
      assert(opening!.choices.length >= 2, `${entry.id}: opening has no choices`);

      const usesActionMarkup = scenes.scenes.some((sc) =>
        sc.narration.concat(sc.fallbackLines).some((l) => l.trim().startsWith('*')),
      );
      if (usesActionMarkup) {
        // stories on the current format: faded *action* + Name: "dialogue"
        assert(
          opening!.narration.some((l) => l.trim().startsWith('*')),
          `${entry.id}: opening has no *action* line`,
        );
        for (const ch of opening!.choices) {
          assert(!ch.shortLabel || ch.shortLabel.length <= 20, `${entry.id}: long chip label "${ch.shortLabel}"`);
        }
        for (const sc of scenes.scenes) {
          for (const l of sc.narration.concat(sc.fallbackLines)) {
            assert(l.split('"').length % 2 === 1, `${entry.id}.${sc.id}: unbalanced quotes -> ${l.slice(0, 40)}`);
            assert(
              l.split('*').length % 2 === 1,
              `${entry.id}.${sc.id}: unbalanced action markers -> ${l.slice(0, 40)}`,
            );
          }
        }
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
