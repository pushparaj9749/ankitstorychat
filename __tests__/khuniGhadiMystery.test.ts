/** Content acceptance checks for Khuni Ghadi Ka Raaz crime-mystery publication. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Playthrough, StoryBundle, StoryMeta } from '../src/types';
import { createInitialState } from '../src/types';
import { applyEffects, buildSystemPrompt } from '../src/lib/engine';
import { offlineOpening, offlineStep } from '../src/lib/offlineEngine';
import { validateBundle, validateMedia } from '../src/lib/validate';

const id = 'khuni-ghadi-ka-raaz';
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
  creator: meta.creator,
  source: 'downloaded',
};
const playthrough: Playthrough = {
  id: 'khuni-ghadi-test',
  storyId: id,
  label: 'Test',
  status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState('Police Interrogation Room'),
  progress: 0,
  messageCount: 0,
  endingId: null,
  mode: 'ai',
  providerId: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('Khuni Ghadi Ka Raaz content publication', () => {
  test('is registered uniquely in manifest.json with exact title and genres', () => {
    expect(manifest.stories.filter((s: StoryMeta) => s.id === id)).toHaveLength(1);
    expect(manifest.stories[0].id).toBe(id);
    expect(meta.title).toBe('Khuni Ghadi Ka Raaz');
    expect(bundle.story.title).toBe('Khuni Ghadi Ka Raaz');
    expect(validateBundle(bundle).issues).toEqual([]);
    expect(meta.coverUrl).toBe(`stories/${id}/assets/cover.jpg`);
    expect(meta.genres).toEqual([
      'Crime Mystery',
      'Psychological Thriller',
      'Investigation',
      'Interactive Mystery',
    ]);
    expect(meta.userRole).toContain('{{playerName}}');
    expect(meta.userRole).toMatch(/Forensic Photographer/i);
    expect(meta.tags).toContain('ongoing');
  });

  test('registers exactly 1 cover and 7 gallery images (8 media assets total) with valid JPEGs', () => {
    const media = bundle.story.media!;
    expect(validateMedia(media)).toEqual([]);
    expect(media.cover).toBe('assets/cover.jpg');
    expect(media.gallery).toHaveLength(8);
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

  test('establishes DCP Maaya as lead investigator and evidence-driven officer', () => {
    expect(bundle.characters.characters).toHaveLength(1);
    const maaya = bundle.characters.characters[0];
    expect(maaya.id).toBe('maaya');
    expect(maaya.name).toBe('Maaya');
    expect(maaya.role).toMatch(/DCP/);
    expect(maaya.role).toMatch(/Lead Investigator/i);
    expect(maaya.personality).toMatch(/intelligent/i);
    expect(maaya.personality).toMatch(/evidence-driven/i);
    expect(maaya.knowledge.join('\n')).toMatch(/serial killings/i);
    expect(maaya.knowledge.join('\n')).toMatch(/limited-edition watch/i);
    expect(maaya.knowledge.join('\n')).toContain('{{playerName}}');
    expect(maaya.knowledge.join('\n')).toMatch(/prime suspect/i);
  });

  test('opens in the interrogation room with the exact required dialogue and dynamic {{playerName}}', () => {
    expect(bundle.scenes.scenes).toHaveLength(1);
    expect(bundle.scenes.endings).toEqual([]);
    const scene = bundle.scenes.scenes[0];
    expect(scene.id).toBe('interrogation_room');
    expect(scene.isEnding).not.toBe(true);
    const fullNarration = scene.narration.join('\n');
    expect(fullNarration).toContain('Maaya: "Serial number jhooth nahi ho sakta."');
    expect(fullNarration).toContain('Maaya: "Bahut achha game khela tumne, {{playerName}}."');
    expect(fullNarration).toContain('Maaya: "Lekin ab tum is serial killing case ke prime suspect ho."');
    expect(fullNarration).toContain('Maaya: "Ab sach sach batao."');
    expect(fullNarration).toContain('Maaya: "Ye watch waqai chori hui thi."');
    expect(fullNarration).toContain('Maaya: "Ya tum mujhe bewakoof bana rahe ho?"');
    expect(fullNarration).not.toContain('Ankit');

    const { lines } = offlineOpening(bundle, 'Rohan');
    const rendered = lines.map((l) => l.text).join('\n');
    expect(rendered).toContain('"Bahut achha game khela tumne, Rohan."');
    expect(rendered).not.toContain('{{playerName}}');
    expect(rendered).not.toContain('Ankit');
  });

  test('is endless with no arcs, acts, chapters, stages, or predetermined endings', () => {
    const rawFiles = ['story.json', 'characters.json', 'world.json', 'scenes.json', 'memory.json'].map((f) =>
      readFileSync(join(dir, f), 'utf8'),
    );
    for (const raw of rawFiles) {
      expect(raw).not.toMatch(/\b(?:arc|act|chapter|stage)\s*\d/i);
    }
    const scene = bundle.scenes.scenes[0];
    for (const ch of scene.choices) {
      expect(ch.next).toBeNull();
      expect(ch.effects?.endStory).toBeUndefined();
      expect(ch.effects?.scene).toBeUndefined();
      expect(ch.effects?.memory?.length).toBeGreaterThan(0);
    }
  });

  test('system prompt enforces player agency, investigation logic, and memory continuity', () => {
    const prompt = buildSystemPrompt(
      {
        bundle,
        playthrough,
        profile: { nickname: 'Vikram', ageGroup: '18+', createdAt: playthrough.createdAt },
        memories: [],
        history: [],
      },
      '18+',
    );
    expect(prompt).toContain('Vikram');
    expect(prompt).toContain('Forensic Photographer');
    expect(prompt).toContain('CONFIRMED FACTS');
    expect(prompt).toContain('SUSPICIONS');
    expect(prompt).toContain('THEORIES');
    expect(prompt).toContain('UNKNOWN INFORMATION');
    expect(prompt).toContain('Never convert a suspicion into a fact without evidence');
    expect(prompt).not.toContain('{{playerName}}');
  });

  test('choice effects and offline fallback remain non-terminal and preserve state', () => {
    const choice = bundle.scenes.scenes[0].choices.find((c) => c.id === 'explain_missing_watch')!;
    const next = applyEffects(playthrough.state, choice.effects);
    expect(next.flags.claimedWatchMissing).toBe(true);
    const result = offlineStep(bundle, playthrough, 'Main pehle apna camera log check karwana chahta hoon', 'Vikram');
    expect(result.step.ended).toBe(false);
    expect(result.step.endingId).toBeNull();
  });
});
