import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const id = 'island-survival-hidden-system';
const dir = join(__dirname, '..', 'content', 'stories', id);
const load = (file: string) => JSON.parse(readFileSync(join(dir, `${file}.json`), 'utf8'));

test('Aaditya is credited in both the package and catalogue', () => {
  const story = load('story');
  const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'content', 'manifest.json'), 'utf8'));
  const entry = manifest.stories.find((s: any) => s.id === id);
  expect(story.creator.name).toBe('Aaditya');
  expect(entry.creator).toEqual(story.creator);
  expect(entry.title).toBe(story.title);
});

test('the submitted island setup, characters and hidden system stay present', () => {
  const story = load('story');
  const characters = load('characters').characters;
  const world = load('world');
  expect(characters.map((c: any) => c.name)).toEqual(['Ananya (Anaya)', 'Mayra', 'Ritika']);
  expect(story.userRole).toContain('{{playerName}}');
  expect(world.rules.join(' ')).toMatch(/Only \{\{playerName\}\} initially sees the System/);
  expect(world.rules.join(' ')).toMatch(/consent/);
  const opening = load('scenes').scenes[0];
  expect(opening.id).toBe(story.openingSceneId);
  expect(opening.narration.join(' ')).toMatch(/plane|aircraft/i);
  expect(opening.narration.join(' ')).toContain('System:');
});

test('opening suggestions leave the story open and referenced artwork exists', () => {
  const story = load('story');
  const scenes = load('scenes');
  expect(scenes.scenes).toHaveLength(1);
  expect(scenes.endings).toEqual([]);
  expect(scenes.scenes[0].choices.length).toBeGreaterThanOrEqual(3);
  for (const choice of scenes.scenes[0].choices) expect(choice.next).toBeNull();
  for (const media of story.media.gallery) expect(existsSync(join(dir, media.file))).toBe(true);
});
