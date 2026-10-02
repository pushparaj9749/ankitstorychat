/** Content-only acceptance tests for the remote, player-led Rajmahal romance. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Playthrough, StoryBundle, StoryMeta } from '../src/types';
import { createInitialState } from '../src/types';
import { buildSystemPrompt } from '../src/lib/engine';
import { validateBundle, validateMedia } from '../src/lib/validate';

const id = 'rajmahal-me-ishq';
const root = join(__dirname, '..', 'content');
const dir = join(root, 'stories', id);
const read = (file: string) => JSON.parse(readFileSync(join(dir, file), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const meta = manifest.stories.find((s: StoryMeta) => s.id === id);
const bundle: StoryBundle = {
  meta,
  story: read('story.json'),
  characters: read('characters.json'),
  world: read('world.json'),
  scenes: read('scenes.json'),
  memory: read('memory.json'),
  creator: meta?.creator,
  source: 'remote',
};
const playthrough: Playthrough = {
  id: 'rajmahal-test', storyId: id, label: 'Test', status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState('The palace garden'), progress: 0,
  messageCount: 0, endingId: null, mode: 'ai', providerId: null,
  createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z',
};

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('Rajmahal me ishq publication', () => {
  test('is a unique, display-ready remote package in the existing schema', () => {
    expect(manifest.stories.filter((s: StoryMeta) => s.id === id)).toHaveLength(1);
    expect(meta.title).toBe('Rajmahal me ishq');
    expect(validateBundle(bundle).issues).toEqual([]);
    expect(meta.coverUrl).toBe(`stories/${id}/assets/cover.jpg`);
    expect(meta.userRole).toContain('{{playerName}}');
    expect(meta.genres).toEqual(['Pure Romance', 'Royal Romance', 'Emotional Drama']);
    expect(meta.tags).toContain('ongoing');
  });

  test('keeps the MC name player-selected and registers Devyani and Chandrika as the only NPCs', () => {
    expect(bundle.story.userRole).toContain('{{playerName}}');
    expect(bundle.story.userRole).toMatch(/ordinary palace servant/i);
    expect(bundle.characters.characters.map((character) => character.name)).toEqual(['Devyani', 'Chandrika']);
    expect(bundle.characters.characters.every((character) => character.name !== '{{playerName}}')).toBe(true);
    const storyWithoutCreator = { ...bundle.story, creator: undefined };
    const contentText = strings([
      storyWithoutCreator, bundle.characters, bundle.world, bundle.scenes, bundle.memory,
    ]).join('\n');
    expect(contentText).toContain('{{playerName}}');
    expect(contentText).not.toMatch(/\b(?:Devraj|Ankit)\b/i);
    expect(contentText).not.toMatch(/{{playerName}}\s*:/i);
  });

  test('uses one cover and exactly seven uniquely registered gallery scenes', () => {
    const media = bundle.story.media!;
    expect(validateMedia(media)).toEqual([]);
    expect(media.gallery).toHaveLength(8); // the existing Kissa gallery includes the cover
    expect(media.gallery.filter((item) => item.kind === 'cover')).toHaveLength(1);
    expect(media.gallery.filter((item) => item.kind === 'scene')).toHaveLength(7);
    const refs = media.gallery.map((item) => item.file);
    expect(refs[0]).toBe(media.cover);
    expect(new Set(refs).size).toBe(8);
    expect(readdirSync(join(dir, 'assets')).sort()).toEqual(['cover.jpg', 'gallery']);
    expect(readdirSync(join(dir, 'assets', 'gallery')).sort()).toEqual(
      Array.from({ length: 7 }, (_, i) => `image-${String(i + 1).padStart(2, '0')}.jpg`),
    );
    for (const file of refs) {
      expect(existsSync(join(dir, file))).toBe(true);
      const bytes = readFileSync(join(dir, file));
      expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(bytes.length).toBeGreaterThan(10_000);
    }
  });

  test('opens with the requested garden interruption and leaves the MC response open', () => {
    const [scene] = bundle.scenes.scenes;
    expect(bundle.scenes.scenes).toHaveLength(1);
    expect(scene.id).toBe(bundle.story.openingSceneId);
    const opening = scene.narration.join('\n');
    expect(opening).toContain('Raat ko rajmahal ka bagicha shaant hai');
    expect(opening).toContain('Devyani: "{{playerName}}… tum aa gaye. Mujhe tumse akele mein kuch kehna tha."');
    expect(opening).toContain('Chandrika: "Tum dono yahan kya kar rahe ho?"');
    expect(opening).toContain('Devyani aur Chandrika dono ab {{playerName}} ki taraf dekh rahi hain');
    expect(scene.choices.length).toBeGreaterThanOrEqual(3);
    for (const choice of scene.choices) {
      expect(choice.next).toBeNull();
      expect(choice.effects?.endStory).toBeUndefined();
      expect(choice.effects?.scene).toBeUndefined();
      expect(choice.effects?.relationships).toBeUndefined();
      expect(choice.effects?.memory?.length).toBeGreaterThan(0);
    }
  });

  test('is endless, romance-first, free of fixed divisions or predetermined outcomes', () => {
    expect(bundle.scenes.endings).toEqual([]);
    for (const scene of bundle.scenes.scenes) {
      expect(scene.isEnding).not.toBe(true);
      for (const choice of scene.choices) expect(choice.effects?.endStory).toBeUndefined();
      for (const line of scene.narration.concat(scene.fallbackLines)) {
        expect(line).not.toMatch(/\b(?:arc|act|chapter|stage)\s*\d+|the end|kahani khatam/i);
        expect(line).not.toMatch(/{{playerName}}:|tum (muskurate|kehte|sochte|chunte|haath pakad)/i);
      }
    }
    expect(bundle.world.rules.join('\n')).toMatch(/romance|love/i);
    expect(bundle.world.rules.join('\n')).toMatch(/no predetermined partner|no predetermined partner/i);
    expect(bundle.memory.extractionHints.join('\n')).toMatch(/promises.*boundaries|boundaries.*consent/i);
    expect(bundle.memory.extractionHints.join('\n')).toMatch(/gallery poses/i);
  });

  test('the existing Kissa narrator and memory prompt receive the story canon', () => {
    const prompt = buildSystemPrompt({
      bundle,
      playthrough,
      profile: { nickname: 'Reader', ageGroup: '18+', createdAt: playthrough.createdAt },
      memories: [], history: [],
    }, '18+');
    expect(prompt).toContain('Only the player controls Reader');
    expect(prompt).toContain('Princess Devyani');
    expect(prompt).toContain('Chandrika');
    expect(prompt).toContain('This is an endless dynamic story');
    expect(prompt).toContain('Never reset trust');
    expect(prompt).not.toContain('{{playerName}}');
  });
});
