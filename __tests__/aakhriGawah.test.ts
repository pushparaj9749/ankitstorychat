import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CharactersFile, StoryBundle, StoryMeta, WorldFile } from '../src/types';
import { validateBundle } from '../src/lib/validate';

const ID = 'aakhri-gawah';
const ROOT = join(__dirname, '..', 'content');
const DIR = join(ROOT, 'stories', ID);
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as {
  contentVersion: number;
  stories: StoryMeta[];
};
const meta = manifest.stories.find((story) => story.id === ID)!;
const read = (file: string) => JSON.parse(readFileSync(join(DIR, file), 'utf8'));
const story = read('story.json');
const characters = read('characters.json') as CharactersFile & {
  characters: Array<CharactersFile['characters'][number] & { visualDesign: string }>;
};
const world = read('world.json') as WorldFile;
const scenes = read('scenes.json');
const memory = read('memory.json');
const meera = characters.characters.find((character) => character.id === 'meera')!;
const bundle: StoryBundle = {
  meta,
  story,
  characters,
  world,
  scenes,
  memory,
  creator: meta.creator!,
  source: 'remote',
};

test('Aakhri Gawah is a valid OTA package at content version 69', () => {
  expect(manifest.contentVersion).toBe(69);
  expect(meta).toBeDefined();
  expect(meta.version).toBe(1);
  expect(meta.storyDir).toBe(ID);
  expect(meta.coverUrl).toBe(`stories/${ID}/assets/cover.jpg`);
  expect(validateBundle(bundle).issues).toEqual([]);
  for (const file of [story, characters, world, scenes, memory]) expect(file.version).toBe(1);
});

test('the story ships one exact-title portrait cover and nothing else yet', () => {
  expect(story.media.cover).toBe('assets/cover.jpg');
  expect(story.media.gallery).toHaveLength(1);
  expect(story.media.gallery[0]).toMatchObject({ id: 'cover', file: 'assets/cover.jpg', kind: 'cover' });
  expect(story.media.gallery[0].label).toBe('Aakhri Gawah');
  expect(meta.tags).toEqual(expect.arrayContaining(['media-expanding', 'expandable-cast']));
});

test('the opening is a small two-dialogue moment with no predetermined path', () => {
  const opening = scenes.scenes.find((scene: { id: string }) => scene.id === story.openingSceneId)!;
  expect(opening).toBeDefined();
  expect(scenes.scenes).toHaveLength(1);
  const dialogue = opening.narration.filter((line: string) => /^[A-Z][\w .'-]+: "/.test(line));
  expect(dialogue.length).toBeGreaterThanOrEqual(2);
  expect(dialogue.length).toBeLessThanOrEqual(3);
  for (const line of dialogue) expect(line).toMatch(/^Meera: |^Nadeem: /);
  expect(opening.choices.length).toBeGreaterThanOrEqual(3);
  for (const choice of opening.choices) expect(choice.next).toBeNull();
  expect(opening.fallbackLines.length).toBeGreaterThan(0);
  expect(story.endings).toEqual([]);
  expect(scenes.endings).toEqual([]);
});

test('the cast is expandable, never a fixed roster', () => {
  const rules = world.rules.join('\n');
  expect(rules).toMatch(/EXPANDABLE CAST: characters\.json contains only the initial named cast, never a fixed roster or maximum/);
  expect(rules).toMatch(/explicit story-specific exception to any generic initial-list-only speaker instruction/);
  expect(story.safetyNotes.join('\n')).toMatch(/never cap the story at its starting cast/);
  expect(world.premise).toMatch(/only the starting cast/);
  expect(characters.characters).toHaveLength(2);
  for (const character of characters.characters) expect(character.visualDesign.length).toBeGreaterThan(40);
  expect(memory.extractionHints.join('\n')).toMatch(/EXPANDABLE CAST MEMORY/);
});

test('the player keeps full agency and the mystery stays unsolved', () => {
  expect(story.userRole).toMatch(/exclusively controls his dialogue, thoughts, actions, consent and decisions/);
  expect(meera.relationshipWithUser).toMatch(/no prior personal relationship or romance is fixed/);
  expect(world.rules.join('\n')).toMatch(/Never conclude the story or force a canonical culprit, verdict/);
  expect(memory.seedMemories.join('\n')).toMatch(/No culprit, verdict, partner, revelation or ending is predetermined/);
  expect(memory.neverRemember.join('\n')).toMatch(/Never store a predetermined culprit, verdict/);
  expect(world.rules.join('\n')).toMatch(/never provide real-world legal, forensic or investigative instructions/);
  expect(JSON.stringify(story)).not.toMatch(/\d+%/);
});
