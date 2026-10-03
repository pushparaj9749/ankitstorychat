import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateBundle } from '../src/lib/validate';
import type { CharactersFile, MemoryFile, ScenesFile, StoryFile, StoryMeta, WorldFile } from '../src/types';
import { buildContext } from '../src/lib/engine';
import { createInitialState } from '../src/types';

const STORY_ID = 'arranged-marriage-wala-love';
const ROOT = join(__dirname, '..', 'content');
const DIR = join(ROOT, 'stories', STORY_ID);
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const manifest = readJson<{ contentVersion: number; stories: StoryMeta[] }>(join(ROOT, 'manifest.json'));
const meta = manifest.stories.find((entry) => entry.id === STORY_ID)!;
const story = readJson<StoryFile>(join(DIR, 'story.json'));
type VisualReference = { file: string; source: string; canonical: boolean; identityLock: string };
type CharactersWithVisualReferences = Omit<CharactersFile, 'characters'> & {
  playerVisualReference?: VisualReference;
  characters: (CharactersFile['characters'][number] & { visualReference?: VisualReference })[];
};
const characters = readJson<CharactersWithVisualReferences>(join(DIR, 'characters.json'));

function jpegSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Not a JPEG: ${path}`);
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || offset + 2 > bytes.length) break;
    const segmentLength = bytes.readUInt16BE(offset);
    if (sof.has(marker)) {
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    if (segmentLength < 2) break;
    offset += segmentLength;
  }
  throw new Error(`JPEG dimensions not found: ${path}`);
}
const world = readJson<WorldFile>(join(DIR, 'world.json'));
const scenes = readJson<ScenesFile>(join(DIR, 'scenes.json'));
const memory = readJson<MemoryFile>(join(DIR, 'memory.json'));

const bundle = {
  meta,
  story,
  characters,
  world,
  scenes,
  memory,
  source: 'remote' as const,
  creator: meta.creator!,
};

describe('Arranged Marriage Wala Love remote package', () => {
  test('has a stable id and exact title in both manifest and package', () => {
    expect(meta.id).toBe(STORY_ID);
    expect(meta.storyDir).toBe(STORY_ID);
    expect(meta.title).toBe('Arranged Marriage Wala Love');
    expect(story.title).toBe('Arranged Marriage Wala Love');
    expect(manifest.stories[0]?.id).toBe(STORY_ID); // existing deploy verifier selects the leading entry
    expect(manifest.contentVersion).toBeGreaterThan(33);
  });

  test('the canonical opening ends exactly at Poonam asking about chai', () => {
    expect(story.openingSceneId).toBe('rampur_opening');
    const opening = scenes.scenes.find((scene) => scene.id === story.openingSceneId)!;
    expect(opening.narration[0]).toContain('{{playerName}}, tum aaj apne parivaar ke saath Rampur aaye ho, arranged marriage ke liye ek ladki dekhne. Poonam ka ghar chhota sa hai, par har kone mein apnapan hai. Drawing room mein sab baithte hi halki si shaadi wali awkwardness chha jaati hai.');
    expect(opening.narration).toContain('Harish: "Humein bas achhe sanskaar aur achha dil chahiye. Baaki sab toh zindagi ke saath ban jaata hai."');
    expect(opening.narration[opening.narration.length - 1]).toBe('Poonam: "Ji, aap chai lenge?"');
    expect(opening.narration.join(' ')).toContain('{{playerName}}');
    expect(opening.narration.join('\n')).not.toMatch(/(?:\{\{playerName\}\}|Player Alias)\s*:/);
    expect(opening.choices.length).toBeGreaterThanOrEqual(2);
    expect(opening.choices.every((choice) => choice.next === null && !choice.effects)).toBe(true);
  });

  test('is continuous with no authored stages, scene route, or endings', () => {
    expect(meta.tags).toContain('ongoing');
    expect(meta.tags).toContain('dynamic-continuous');
    expect(scenes.scenes).toHaveLength(1);
    expect(scenes.endings).toEqual([]);
    expect(scenes.scenes.every((scene) => !scene.isEnding)).toBe(true);
    expect(scenes.scenes.flatMap((scene) => scene.choices).every((choice) => choice.next === null)).toBe(true);
    expect(JSON.stringify(scenes)).not.toMatch(/"endStory"|"endingId"|"isEnding"\s*:\s*true/);
    expect(story.userRole).toContain('{{playerName}}');
    expect(story.userRole).not.toMatch(/\b(?:Aarav|Raj|Rahul)\s*[—:-]/);
  });

  test('Poonam and Bhabhi have separate canonical references and assets', () => {
    const poonam = characters.characters.find((character) => character.id === 'poonam')!;
    const bhabhi = characters.characters.find((character) => character.id === 'bhabhi')!;
    expect(characters.playerVisualReference?.file).toBe('assets/references/mc.jpg');
    expect(poonam.visualReference?.file).toBe('assets/references/poonam.jpg');
    expect(bhabhi.visualReference?.file).toBe('assets/references/bhabhi.jpg');
    expect(poonam.visualReference?.file).not.toBe(bhabhi.visualReference?.file);
    for (const ref of [characters.playerVisualReference, poonam.visualReference, bhabhi.visualReference]) {
      expect(ref?.canonical).toBe(true);
      expect(existsSync(join(DIR, ref!.file))).toBe(true);
      expect(ref?.identityLock.length).toBeGreaterThan(60);
    }
  });

  test('contains one cover and exactly seven unique gallery images with preserved mixed ratios', () => {
    const gallery = story.media!.gallery;
    expect(gallery).toHaveLength(8);
    expect(gallery[0]).toMatchObject({ id: 'cover', file: 'assets/cover.jpg', kind: 'cover' });
    expect(gallery.slice(1)).toHaveLength(7);
    expect(new Set(gallery.map((item) => item.file)).size).toBe(8);
    for (const item of gallery) expect(existsSync(join(DIR, item.file))).toBe(true);
    const sizes = gallery.map((item) => jpegSize(join(DIR, item.file)));
    const ratios = new Set(sizes.map(({ width, height }) => Math.round((width / height) * 1000)));
    expect(ratios.size).toBeGreaterThan(1);
    expect(sizes.some(({ width, height }) => width > height)).toBe(true);
    expect(sizes.some(({ width, height }) => height > width)).toBe(true);
  });

  test('memory guidance preserves the opening, relationships, family knowledge and scene continuity', () => {
    expect(memory.storyId).toBe(STORY_ID);
    expect(memory.seedMemories.join('\n')).toContain('No answer or relationship choice exists yet');
    expect(memory.extractionHints.join('\n')).toMatch(/location or scene changes/);
    expect(memory.extractionHints.join('\n')).toMatch(/who witnessed each event/);
    expect(memory.neverRemember.join('\n')).toMatch(/Unselected suggested replies/);
  });

  test('real bundle validates and its prompt keeps the canonical handoff and optional replies', () => {
    expect(validateBundle({ meta, story, characters, world, scenes, memory }).issues).toEqual([]);
    const profile = { nickname: 'Player Alias', ageGroup: '18+' } as never;
    const playthrough = {
      id: 'test-playthrough',
      storyId: STORY_ID,
      label: 'First journey',
      status: 'active',
      currentSceneId: story.openingSceneId,
      state: createInitialState(),
      progress: 0,
      messageCount: 0,
      endingId: null,
      mode: 'ai',
      providerId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never;
    const context = buildContext({ bundle: bundle as never, profile, playthrough, memories: [], history: [], summary: '' }, '18+');
    expect(context.system).toContain('Arranged Marriage Wala Love');
    expect(context.system).toContain('Ji, aap chai lenge?');
    expect(context.system).toContain('optional examples for that first reply only');
    expect(context.system).toContain('never replay the opening');
  });
});
