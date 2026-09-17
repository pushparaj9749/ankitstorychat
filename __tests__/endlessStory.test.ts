/**
 * PRODUCT RULE — endless stories.
 *
 * Kissa's ongoing stories must NEVER have final endings: no "The End", no
 * terminal story states. Chapter/arc milestones are fine. Legacy stories that
 * predate this rule keep their existing ending mechanics (branching must not
 * break), but nothing tagged `ongoing` may end — and the validator enforces
 * that for every future package too.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScenesFile, StoryBundle, StoryMeta } from '../src/types';
import { validateBundle } from '../src/lib/validate';

const ROOT = join(__dirname, '..');

interface Manifest {
  contentVersion: number;
  stories: (StoryMeta & { storyDir: string })[];
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const manifest = readJson(join(ROOT, 'content', 'manifest.json')) as Manifest;

function loadBundle(id: string): StoryBundle {
  const meta = manifest.stories.find((s) => s.id === id)!;
  const dir = join(ROOT, 'content', 'stories', meta.storyDir);
  return {
    meta,
    story: readJson(join(dir, 'story.json')),
    characters: readJson(join(dir, 'characters.json')),
    world: readJson(join(dir, 'world.json')),
    scenes: readJson(join(dir, 'scenes.json')),
    memory: readJson(join(dir, 'memory.json')),
    source: 'bundled',
  } as unknown as StoryBundle;
}

const ongoingStories = manifest.stories.filter((s) => (s.tags ?? []).includes('ongoing'));
const legacyStories = manifest.stories.filter((s) => !(s.tags ?? []).includes('ongoing'));

describe('ongoing stories never end (content audit)', () => {
  test('the catalog has ongoing stories (fixture sanity)', () => {
    expect(ongoingStories.length).toBeGreaterThan(0);
  });

  test('no ongoing story defines endings, ending scenes or endStory choices', () => {
    expect(ongoingStories.length).toBeGreaterThan(0);
    for (const entry of ongoingStories) {
      const scenes = readJson(
        join(ROOT, 'content', 'stories', entry.storyDir, 'scenes.json'),
      ) as ScenesFile;
      expect(scenes.endings ?? []).toEqual([]);
      for (const scene of scenes.scenes) {
        expect(scene.isEnding).not.toBe(true);
        for (const choice of scene.choices ?? []) {
          expect(choice.effects?.endStory).toBeUndefined();
        }
      }
    }
  });

  test('no ongoing story narration says the story is over', () => {
    for (const entry of ongoingStories) {
      const scenes = readJson(
        join(ROOT, 'content', 'stories', entry.storyDir, 'scenes.json'),
      ) as ScenesFile;
      for (const scene of scenes.scenes) {
        for (const line of scene.narration) {
          expect(line).not.toMatch(/kahani yahin (poori|khatam)|the end/i);
        }
      }
    }
  });

  test('every ongoing package still passes full validation (endings rule included)', () => {
    for (const entry of ongoingStories) {
      const res = validateBundle(loadBundle(entry.id) as never);
      expect(res.issues.filter((i) => i.path.includes('ongoing'))).toEqual([]);
      expect(res.ok).toBe(true);
    }
  });
});

describe('legacy stories keep their existing branching mechanics', () => {
  test('legacy stories with endings still validate (no mechanics broken)', () => {
    let withEndings = 0;
    for (const entry of legacyStories) {
      const scenes = readJson(
        join(ROOT, 'content', 'stories', entry.storyDir, 'scenes.json'),
      ) as ScenesFile;
      if ((scenes.endings ?? []).length > 0) withEndings++;
      const res = validateBundle(loadBundle(entry.id) as never);
      expect(res.ok).toBe(true);
    }
    // The legacy catalogue really does contain ending-driven stories.
    expect(withEndings).toBeGreaterThan(0);
  });
});

describe('validator enforces the endless-story rule', () => {
  const base = {
    meta: {
      id: 'test-ongoing',
      title: 'T',
      description: 'D',
      tagline: 't',
      genres: ['G'],
      tags: ['ongoing'],
      ageRating: '12-17',
      contentLevel: 'teen',
      version: 1,
      storyDir: 'test-ongoing',
      userRole: 'you',
      setting: 'S',
    } as unknown as StoryMeta,
    story: {
      id: 'test-ongoing',
      title: 'T',
      description: 'D',
      userRole: 'you',
      setting: 'S',
      openingSceneId: 's1',
      tone: 'x',
      ageRating: '12-17',
      contentLevel: 'teen',
    },
    characters: { storyId: 'test-ongoing', characters: [] },
    world: { storyId: 'test-ongoing', premise: 'p', locations: [{ name: 'L' }], rules: ['r'] },
    memory: { storyId: 'test-ongoing', shortTermWindow: 4, seedMemories: [] },
  };

  const scenesOk = {
    storyId: 'test-ongoing',
    scenes: [
      {
        id: 's1',
        title: 'Start',
        narration: ['*n*'],
        fallbackLines: ['f'],
        choices: [{ id: 'c1', text: 'go', next: null }],
      },
    ],
    endings: [],
  };

  test('an ongoing story with an endings array is rejected', () => {
    const res = validateBundle({
      ...base,
      scenes: { ...scenesOk, endings: [{ id: 'end', title: 'The End', description: 'd' }] },
    } as never);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => /ongoing stories must not define endings/.test(i.message))).toBe(true);
  });

  test('an ongoing story with an ending scene is rejected', () => {
    const res = validateBundle({
      ...base,
      scenes: {
        ...scenesOk,
        scenes: [
          scenesOk.scenes[0],
          { id: 'e1', title: 'End', narration: ['*n*'], fallbackLines: ['f'], choices: [], isEnding: true, endingId: 'end' },
        ],
        endings: [{ id: 'end', title: 'The End', description: 'd' }],
      },
    } as never);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => /ongoing stories must not have ending scenes/.test(i.message))).toBe(true);
  });

  test('an ongoing story with an endStory choice is rejected', () => {
    const res = validateBundle({
      ...base,
      scenes: {
        ...scenesOk,
        scenes: [
          {
            id: 's1',
            title: 'Start',
            narration: ['*n*'],
            fallbackLines: ['f'],
            choices: [{ id: 'c1', text: 'go', next: null, effects: { endStory: 'end' } }],
          },
        ],
        endings: [{ id: 'end', title: 'The End', description: 'd' }],
      },
    } as never);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => /ongoing stories must not have endStory choices/.test(i.message))).toBe(true);
  });

  test('the same story WITHOUT the ongoing tag may keep endings (legacy mechanics intact)', () => {
    const legacy = {
      ...base,
      meta: { ...base.meta, tags: ['legacy'] },
    };
    const res = validateBundle({
      ...legacy,
      scenes: { ...scenesOk, endings: [{ id: 'end', title: 'The End', description: 'd' }] },
    } as never);
    expect(res.issues.some((i) => /ongoing/.test(i.message))).toBe(false);
  });

  test('a character NAME may not contain a {{placeholder}}', () => {
    const res = validateBundle({
      ...base,
      characters: {
        storyId: 'test-ongoing',
        characters: [
          {
            id: 'c1',
            name: '{{playerName}}',
            role: 'r',
            personality: 'p',
            background: 'b',
            speakingStyle: 's',
            sampleLine: 'l',
            goals: [],
            fears: [],
            likes: [],
            dislikes: [],
            relationshipWithUser: '',
            knowledge: [],
          },
        ],
      },
      scenes: scenesOk,
    } as never);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => /placeholders/.test(i.message))).toBe(true);
  });
});
