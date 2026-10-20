/**
 * Regression: the seven dangerous-heroine stories shipped supporting
 * characters without goals/fears/likes/dislikes/knowledge lists, and the
 * narrator prompt called `c.goals.join()` — the chat could not start.
 *
 * Every story in the catalog must (a) validate with the stricter character
 * check and (b) build a narrator prompt without throwing.
 */
import fs from 'node:fs';
import { join } from 'node:path';
import { buildSystemPrompt } from '../src/lib/engine';
import { CHARACTER_LIST_FIELDS, validateBundle, validateCharactersFile } from '../src/lib/validate';
import type { CharactersFile, LocalProfile, MemoryFile, Playthrough, ScenesFile, StoryBundle, StoryFile, StoryMeta, WorldFile } from '../src/types';
import { KISSA_OWNER_CREATOR, createInitialState } from '../src/types';

const ROOT = join(__dirname, '..', 'content');
const manifest = JSON.parse(fs.readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as { stories: StoryMeta[] };
const ids = manifest.stories
  .map((s) => s.storyDir ?? s.id)
  .filter((dir) => fs.existsSync(join(ROOT, 'stories', dir, 'characters.json')));

const load = (dir: string): StoryBundle => {
  const pack = <T,>(f: string): T => JSON.parse(fs.readFileSync(join(ROOT, 'stories', dir, f), 'utf8')) as T;
  return {
    meta: manifest.stories.find((s) => (s.storyDir ?? s.id) === dir)!,
    story: pack<StoryFile>('story.json'),
    characters: pack<CharactersFile>('characters.json'),
    world: pack<WorldFile>('world.json'),
    scenes: pack<ScenesFile>('scenes.json'),
    memory: pack<MemoryFile>('memory.json'),
    source: 'bundled',
    creator: KISSA_OWNER_CREATOR,
  };
};

test('the catalog has stories to check', () => {
  expect(ids.length).toBeGreaterThan(50);
});

describe.each(ids)('%s', (dir) => {
  const bundle = load(dir);

  test('every character carries its list fields', () => {
    for (const c of bundle.characters.characters) {
      for (const k of CHARACTER_LIST_FIELDS) {
        expect({ character: c.id, field: k, isList: Array.isArray((c as any)[k]) }).toEqual({ character: c.id, field: k, isList: true });
      }
    }
    expect(validateCharactersFile(bundle.story.id, bundle.characters).issues).toEqual([]);
    expect(validateBundle(bundle as any).issues).toEqual([]);
  });

  test('the narrator prompt builds', () => {
    const pt = {
      id: 'p', storyId: bundle.story.id, label: 'Journey 1', status: 'active', currentSceneId: bundle.story.openingSceneId,
      state: createInitialState(), progress: 0, messageCount: 3, endingId: null, mode: 'ai', providerId: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as Playthrough;
    const run = () =>
      buildSystemPrompt(
        { bundle, profile: { nickname: 'Ankit', ageGroup: '18+' } as unknown as LocalProfile, playthrough: pt, memories: [], history: [], stateMode: 'separate' } as any,
        '18+',
      );
    expect(run).not.toThrow();
    expect(run()).not.toMatch(/Goals: \./);
  });
});

test('a character missing its lists no longer crashes the prompt; a wrong type is rejected', () => {
  const bundle = load('meri-hacker-girlfriend');
  const broken = JSON.parse(JSON.stringify(bundle.characters)) as CharactersFile;
  const c = broken.characters[1] as unknown as Record<string, unknown>;
  delete c.goals;
  delete c.knowledge;
  expect(validateCharactersFile(bundle.story.id, broken).issues).toEqual([]);
  const wrong = JSON.parse(JSON.stringify(bundle.characters)) as CharactersFile;
  (wrong.characters[1] as unknown as Record<string, unknown>).goals = 'not a list';
  expect(validateCharactersFile(bundle.story.id, wrong).issues.map((i) => i.path)).toContain('characters[1].goals');
  const pt = { id: 'p', storyId: bundle.story.id, state: createInitialState(), messageCount: 3, currentSceneId: bundle.story.openingSceneId } as unknown as Playthrough;
  expect(() =>
    buildSystemPrompt(
      { bundle: { ...bundle, characters: broken }, profile: { nickname: 'Ankit', ageGroup: '18+' } as unknown as LocalProfile, playthrough: pt, memories: [], history: [], stateMode: 'separate' } as any,
      '18+',
    ),
  ).not.toThrow();
});
