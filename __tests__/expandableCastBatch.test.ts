import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CharactersFile, MemoryFile, ScenesFile, StoryBundle, StoryMeta, WorldFile } from '../src/types';
import { validateBundle } from '../src/lib/validate';

const IDS = [
  'raat-ki-last-local',
  'chef-ki-jung',
  'neon-raani',
  'haveli-ka-chhaya-raaz',
  'meri-dragon-rani',
  'penalty-wala-pyaar',
  'dhuan-fireline',
  'sitara-falls',
  'time-ki-dukaan',
  'rann-ki-sherni',
] as const;

const ROOT = join(__dirname, '..', 'content');
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as {
  contentVersion: number;
  stories: StoryMeta[];
};

function jpegSize(buffer: Buffer): { w: number; h: number } {
  let index = 2;
  while (index < buffer.length) {
    const marker = buffer[index + 1];
    const length = buffer.readUInt16BE(index + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { h: buffer.readUInt16BE(index + 5), w: buffer.readUInt16BE(index + 7) };
    }
    index += 2 + length;
  }
  throw new Error('No JPEG SOF marker');
}

const packages = IDS.map((id) => {
  const dir = join(ROOT, 'stories', id);
  const read = (file: string) => JSON.parse(readFileSync(join(dir, `${file}.json`), 'utf8'));
  const meta = manifest.stories.find((story) => story.id === id)!;
  const story = read('story');
  const characters = read('characters') as Omit<CharactersFile, 'characters'> & {
    playerVisualDesign: string;
    characters: Array<CharactersFile['characters'][number] & { visualDesign: string }>;
  };
  const world = read('world') as WorldFile;
  const scenes = read('scenes') as ScenesFile;
  const memory = read('memory') as MemoryFile;
  const bundle: StoryBundle = { meta, story, characters, world, scenes, memory, creator: meta.creator!, source: 'remote' };
  return { id, dir, meta, story, characters, world, scenes, memory, bundle };
});

test('exactly ten varied stories are registered as OTA content version 68', () => {
  expect(manifest.contentVersion).toBe(68);
  expect(manifest.stories).toHaveLength(94);
  expect(new Set(manifest.stories.map((story) => story.id)).size).toBe(94);
  expect(packages).toHaveLength(10);
  expect(new Set(packages.map(({ story }) => story.title)).size).toBe(10);
  expect(new Set(packages.map(({ story }) => story.openingSceneId)).size).toBe(10);
  expect(new Set(packages.map(({ story }) => story.genres.join('/'))).size).toBe(10);
  expect(new Set(packages.map(({ story }) => story.description)).size).toBe(10);
  for (const pkg of packages) {
    expect(pkg.meta).toBeDefined();
    expect(pkg.meta.storyDir).toBe(pkg.id);
    expect(pkg.meta.version).toBe(1);
    expect(pkg.meta.tags).toEqual(expect.arrayContaining(['expandable-cast', 'media-expanding', 'dynamic-continuous', 'ongoing']));
    expect(validateBundle(pkg.bundle).issues).toEqual([]);
  }
});

test('each story ships exactly one exact-title portrait cover and no premature gallery', () => {
  for (const { dir, story, meta } of packages) {
    expect(story.media.cover).toBe('assets/cover.jpg');
    expect(story.media.gallery).toHaveLength(1);
    expect(story.media.gallery[0]).toEqual({ id: 'cover', file: 'assets/cover.jpg', kind: 'cover', label: story.title });
    expect(meta.coverUrl).toContain('/assets/cover.jpg');
    const bytes = readFileSync(join(dir, 'assets', 'cover.jpg'));
    expect(bytes.length).toBeGreaterThan(100_000);
    expect(jpegSize(bytes)).toEqual({ w: 848, h: 1264 });
  }
});

test('starting cast is expandable and established newcomers remain valid persistent characters', () => {
  for (const { story, characters, world, memory } of packages) {
    const rules = world.rules.join('\n');
    const hints = memory.extractionHints.join('\n');
    const seeds = memory.seedMemories.join('\n');
    const safety = story.safetyNotes.join('\n');
    expect(rules).toMatch(/EXPANDABLE CAST/);
    expect(rules).toMatch(/initial named cast, never a fixed roster or maximum/);
    expect(rules).toMatch(/New adult characters may enter naturally/);
    expect(rules).toMatch(/their name is a valid dialogue speaker even if they were absent from the initial characters\.json/);
    expect(rules).toMatch(/explicit story-specific exception to any generic initial-list-only speaker instruction/);
    expect(rules).toMatch(/what they witnessed, were told, promised and want/);
    expect(hints).toMatch(/EXPANDABLE CAST MEMORY/);
    expect(hints).toMatch(/record their name, adult age, role, personality, visual identity, first appearance, goals, knowledge and relationships/);
    expect(hints).toMatch(/initial characters\.json is not a cap/);
    expect(seeds).toMatch(/initial cast only, not a fixed total/);
    expect(safety).toMatch(/initial named cast is not a fixed roster/);
    expect(characters.characters.length).toBeGreaterThanOrEqual(2);
    for (const character of characters.characters) {
      expect(character.role).toMatch(/(?:[2-9][0-9]|1[8-9])-year-old/);
      expect(character.personality.length).toBeGreaterThan(80);
      expect(character.visualDesign.length).toBeGreaterThan(80);
      expect(character.knowledge.length).toBeGreaterThanOrEqual(2);
    }
  }
});

test('every opening is one small two-dialogue player-led moment with no fixed route', () => {
  for (const { story, scenes } of packages) {
    expect(scenes.scenes).toHaveLength(1);
    expect(scenes.endings).toEqual([]);
    expect(story.endings).toEqual([]);
    const opening = scenes.scenes[0];
    expect(opening.id).toBe(story.openingSceneId);
    expect(opening.narration.length).toBeGreaterThanOrEqual(6);
    expect(opening.narration.length).toBeLessThanOrEqual(8);
    const dialogue = opening.narration.filter((line) => /^[^*:]{2,80}: "/.test(line));
    expect(dialogue).toHaveLength(2);
    expect(opening.narration.filter((line) => line.startsWith('*') && line.endsWith('*')).length).toBe(opening.narration.length - 2);
    expect(opening.choices).toHaveLength(3);
    for (const choice of opening.choices) {
      expect(choice.next ?? null).toBeNull();
      expect(choice.effects?.scene).toBeUndefined();
      expect(choice.effects?.endStory).toBeUndefined();
    }
    const visible = opening.narration.concat(opening.fallbackLines).join('\n');
    expect(visible).not.toMatch(/%|\[Bond|Love:|Ishq:|progress|chapter|episode/i);
    expect(visible).not.toMatch(/The End|years later|saal baad/i);
  }
});

test('the player is never assigned a fixed personality, answer or relationship', () => {
  for (const { story, world, memory } of packages) {
    expect(story.userRole).toMatch(/Nothing about his personality, courage, past, opinions or feelings is predefined/);
    expect(story.userRole).toMatch(/exclusively controls his dialogue, thoughts, actions, consent and decisions/);
    expect(world.rules.join('\n')).toMatch(/never invent his speech, actions, thoughts, feelings, memories, attraction, consent, promises or decisions/);
    expect(memory.neverRemember.join('\n')).toMatch(/Never store invented thoughts, feelings, words, actions, attraction, memories, consent or decisions/);
    expect(memory.seedMemories.join('\n')).toMatch(/No answer, action, feeling, attraction, consent or decision from \{\{playerName\}\}/);
  }
});
