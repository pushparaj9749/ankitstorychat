/** Content-only acceptance checks: use the shipped schema, narrator and state pipeline. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Playthrough, StoryBundle, StoryMeta } from '../src/types';
import { createInitialState } from '../src/types';
import { applyEffects, buildSystemPrompt } from '../src/lib/engine';
import { offlineStep } from '../src/lib/offlineEngine';
import { validateBundle, validateMedia } from '../src/lib/validate';

const id = 'two-hearts-one-honest-choice';
const root = join(__dirname, '..', 'content');
const dir = join(root, 'stories', id);
const read = (file: string) => JSON.parse(readFileSync(join(dir, file), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const meta = manifest.stories.find((s: StoryMeta) => s.id === id);
const bundle: StoryBundle = {
  meta, story: read('story.json'), characters: read('characters.json'),
  world: read('world.json'), scenes: read('scenes.json'), memory: read('memory.json'),
  creator: meta.creator, source: 'downloaded',
};
const playthrough: Playthrough = {
  id: 'romance-test', storyId: id, label: 'Test', status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState('Neem Courtyard cafe'), progress: 0,
  messageCount: 0, endingId: null, mode: 'ai', providerId: null,
  createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z',
};

describe('Two Hearts content publication', () => {
  test('is a unique display-ready remote package in the existing schema', () => {
    expect(manifest.stories.filter((s: StoryMeta) => s.id === id)).toHaveLength(1);
    expect(validateBundle(bundle).issues).toEqual([]);
    expect(meta.coverUrl).toBe(`stories/${id}/assets/cover.jpg`);
    expect(meta.userRole).toContain('{{playerName}}');
    expect(meta.description).toContain("Choose one of them, but try not to unnecessarily break the other's heart.");
    expect(meta.tags).toContain('ongoing');
  });

  test('registers exactly one cover and seven gallery images with no missing or orphan assets', () => {
    const media = bundle.story.media!;
    expect(validateMedia(media)).toEqual([]);
    expect(media.gallery).toHaveLength(8); // existing Kissa gallery includes its cover
    expect(media.gallery.filter((g) => g.kind === 'cover')).toHaveLength(1);
    expect(media.gallery.filter((g) => g.kind === 'scene')).toHaveLength(7);
    const refs = media.gallery.map((g) => g.file);
    expect(new Set(refs).size).toBe(8);
    expect(readdirSync(join(dir, 'assets')).sort()).toEqual(['cover.jpg', 'gallery']);
    expect(readdirSync(join(dir, 'assets', 'gallery')).sort()).toEqual(
      Array.from({ length: 7 }, (_, i) => `image-${String(i + 1).padStart(2, '0')}.jpg`),
    );
    for (const file of refs) {
      const bytes = readFileSync(join(dir, file));
      expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(bytes.length).toBeGreaterThan(10_000);
    }
  });

  test('only Aira and Elena are NPCs; adults with exclusive love and equal dignity', () => {
    expect(bundle.characters.characters.map((c) => c.name)).toEqual(['Aira', 'Elena']);
    for (const c of bundle.characters.characters) {
      expect(c.background).toMatch(/adult Indian woman/i);
      expect(c.background).toContain('Has only ever loved {{playerName}}');
      expect(c.background).toContain('no boyfriend, ex, previous love interest, secret relationship or future replacement partner');
      expect(c.relationshipWithUser).toContain('remain unset until the player expresses them');
    }
    expect(bundle.characters.characters[0].background).toContain('(26)');
    expect(bundle.characters.characters[1].background).toContain('(28)');
    expect(bundle.world.rules.join('\n')).toContain('Never rank them');
    expect(bundle.world.rules.join('\n')).toContain('Aira and Elena are not enemies');
  });

  test('has a single conversation seed, no future route graph, score thresholds or terminal effects', () => {
    expect(bundle.scenes.scenes).toHaveLength(1);
    expect(bundle.scenes.endings).toEqual([]);
    const scene = bundle.scenes.scenes[0];
    expect(scene.isEnding).not.toBe(true);
    for (const ch of scene.choices) {
      expect(ch.next).toBeNull();
      expect(ch.effects?.endStory).toBeUndefined();
      expect(ch.effects?.scene).toBeUndefined();
      expect(ch.effects?.relationships).toBeUndefined();
      expect(ch.requiresFlag).toBeUndefined();
      expect(ch.effects?.memory?.length).toBeGreaterThan(0);
    }
    for (const line of scene.narration.concat(scene.fallbackLines)) {
      expect(line).not.toMatch(/\b(?:arc|act|chapter|stage)\s*\d|the end|kahani khatam/i);
      expect(line).not.toMatch(/\{\{playerName\}\}:|tum (muskurate|kehte|sochte|chunte|haath pakad)/i);
    }
  });

  test('existing prompt receives canon, player name, endless rules and continuity guidance', () => {
    const prompt = buildSystemPrompt({
      bundle, playthrough, profile: { nickname: 'Dev', ageGroup: '18+', createdAt: playthrough.createdAt },
      memories: [], history: [],
    }, '18+');
    expect(prompt).toContain('Only the player controls Dev');
    expect(prompt).toContain('Aira is a clearly adult Indian woman aged 26');
    expect(prompt).toContain('Elena is a clearly adult Indian woman aged 28');
    expect(prompt).toContain('both genuinely love ONLY Dev');
    expect(prompt).toContain('This is an endless dynamic story');
    expect(prompt).toContain('Never replay the opening confessions');
    expect(prompt).toContain('chooses Aira');
    expect(prompt).toContain('chooses Elena');
    expect(prompt).toContain('Never reset trust');
    expect(prompt).toContain('Promises: exact terms');
    expect(prompt).not.toContain('{{playerName}}');
  });

  test('choice effects preserve existing continuity without choosing a woman', () => {
    const previous = applyEffects(playthrough.state, {
      flags: { privatePromise: 'keep conversation private', chosenPartner: 'unset' },
      relationships: { aira: 7, elena: 4 },
    });
    const choice = bundle.scenes.scenes[0].choices.find((c) => c.id === 'request_time')!;
    const next = applyEffects(previous, choice.effects);
    expect(next.flags.privatePromise).toBe(previous.flags.privatePromise);
    expect(next.flags.chosenPartner).toBe('unset');
    expect(next.flags.requestedTime).toBe(true);
    expect(next.relationships).toEqual(previous.relationships);
    expect(choice.effects!.memory![0]).toContain('none agreed yet');
    expect(previous.flags.requestedTime).toBeUndefined();
  });

  test('offline fallback remains non-terminal and does not fabricate an action from unexpected text', () => {
    const result = offlineStep(bundle, playthrough, 'I want to discuss something completely unexpected', 'Dev');
    expect(result.step.ended).toBe(false);
    expect(result.step.endingId).toBeNull();
    expect(result.step.matchedChoiceId).toBeNull();
    expect(result.state).toEqual(playthrough.state);
  });
});
