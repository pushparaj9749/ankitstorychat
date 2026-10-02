/** Content acceptance checks for the remote Zara crime-romance publication. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Playthrough, StoryBundle, StoryMeta } from '../src/types';
import { createInitialState } from '../src/types';
import { buildSystemPrompt } from '../src/lib/engine';
import { offlineOpening } from '../src/lib/offlineEngine';
import { validateBundle, validateMedia } from '../src/lib/validate';

const id = 'zara-mumbai-mafia-queen';
const root = join(__dirname, '..', 'content');
const dir = join(root, 'stories', id);
const read = (file: string) => JSON.parse(readFileSync(join(dir, file), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')) as {
  contentVersion: number;
  stories: StoryMeta[];
};
const meta = manifest.stories.find((s) => s.id === id)!;
const bundle: StoryBundle = {
  meta,
  story: read('story.json'),
  characters: read('characters.json'),
  world: read('world.json'),
  scenes: read('scenes.json'),
  memory: read('memory.json'),
  creator: meta.creator!,
  source: 'remote',
};
const playthrough: Playthrough = {
  id: 'zara-test',
  storyId: id,
  label: 'Test',
  status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState("Zara and {{playerName}}'s Mumbai home"),
  progress: 0,
  messageCount: 0,
  endingId: null,
  mode: 'ai',
  providerId: null,
  createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
};

describe('Zara: Mumbai\'s Mafia Queen publication', () => {
  test('is registered once in the existing remote catalog and validates against the Kissa schema', () => {
    expect(manifest.stories.filter((entry) => entry.id === id)).toHaveLength(1);
    expect(manifest.stories[0].id).toBe(id); // deploy verifier publishes the leading manifest entry
    expect(meta.title).toBe("Zara: Mumbai's Mafia Queen");
    expect(bundle.story.title).toBe(meta.title);
    expect(meta.coverUrl).toBe(`stories/${id}/assets/cover.jpg`);
    expect(meta.tags).toContain('ongoing');
    expect(meta.genres).toEqual(['Crime', 'Romance', 'Mafia Drama', 'Emotional Relationship Story']);
    expect(meta.userRole).toContain('{{playerName}}');
    expect(validateBundle(bundle).issues).toEqual([]);
  });

  test('keeps the player name dynamic and gives Zara and Faraz the intended roles', () => {
    const characters = bundle.characters.characters;
    expect(characters.map((character) => character.name)).toEqual(['Zara Mirza', 'Faraz']);
    const [zara, faraz] = characters;
    expect(zara.role).toMatch(/Mumbai's Mafia Queen/i);
    expect(zara.role).toContain('{{playerName}}');
    expect(zara.personality).toMatch(/one whole, nuanced person/i);
    expect(zara.personality).toMatch(/playful/i);
    expect(zara.personality).toMatch(/commanding/i);
    expect(zara.relationshipWithUser).toMatch(/married/i);
    expect(faraz.role).toMatch(/bodyguard/i);
    expect(faraz.personality).toMatch(/loyal/i);
    expect(faraz.knowledge.join('\n')).toContain('{{playerName}}');

    const playerContent = [
      bundle.story,
      bundle.characters,
      bundle.world,
      bundle.scenes,
      bundle.memory,
    ].map((value) => JSON.stringify(value)).join('\n');
    expect(playerContent).toContain('{{playerName}}');
    expect(playerContent).not.toMatch(/\b(?:Ankit|Devraj)\b/i);
    expect(playerContent).not.toMatch(/{{playerName}}:\s*["*]/i);
    expect(bundle.story.userRole).toMatch(/exclusively controls/i);
  });

  test('registers exactly one cover and seven unique gallery scenes as eight accessible JPEG assets', () => {
    const media = bundle.story.media!;
    expect(validateMedia(media)).toEqual([]);
    expect(media.cover).toBe('assets/cover.jpg');
    expect(media.gallery).toHaveLength(8);
    expect(media.gallery.filter((item) => item.kind === 'cover')).toHaveLength(1);
    expect(media.gallery.filter((item) => item.kind === 'scene')).toHaveLength(7);
    const refs = media.gallery.map((item) => item.file);
    expect(refs[0]).toBe(media.cover);
    expect(new Set(refs).size).toBe(8);
    expect(readdirSync(join(dir, 'assets')).sort()).toEqual(['cover.jpg', 'gallery']);
    expect(readdirSync(join(dir, 'assets', 'gallery')).sort()).toEqual(
      Array.from({ length: 7 }, (_, index) => `image-${String(index + 1).padStart(2, '0')}.jpg`),
    );
    for (const file of refs) {
      expect(existsSync(join(dir, file))).toBe(true);
      const bytes = readFileSync(join(dir, file));
      expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(bytes.length).toBeGreaterThan(10_000);
    }
  });

  test('opens with the requested home attack, exact clue and open player decision', () => {
    expect(bundle.scenes.scenes).toHaveLength(1);
    expect(bundle.scenes.endings).toEqual([]);
    const [scene] = bundle.scenes.scenes;
    expect(scene.id).toBe(bundle.story.openingSceneId);
    expect(scene.isEnding).not.toBe(true);
    const opening = scene.narration.join('\n');
    expect(opening).toContain('living-room ki khidki');
    expect(opening).toContain('Zara: "Mere peeche raho."');
    expect(opening).toContain('Zara: "Maine promise kiya tha meri duniya tum tak kabhi nahi aayegi."');
    expect(opening).toContain('Faraz');
    expect(opening).toContain("'Kill the husband. Break the Queen.'");
    expect(opening).toContain('Zara: "Woh mujhe maarne nahi aaye the… woh tumhare liye aaye the."');
    expect(opening).toContain('Zara: "Ab bolo… mere saath safe house chaloge, ya yahin rukoge?"');
    expect(scene.choices).toHaveLength(3);
    for (const choice of scene.choices) {
      expect(choice.next).toBeNull();
      expect(choice.shortLabel!.length).toBeLessThanOrEqual(20);
      expect(choice.effects?.endStory).toBeUndefined();
      expect(choice.effects?.scene).toBeUndefined();
      expect(choice.effects?.relationships).toBeUndefined();
      expect(choice.effects?.memory?.length).toBeGreaterThan(0);
    }

    const rendered = offlineOpening(bundle, 'Mira').lines.map((line) => line.text).join('\n');
    expect(rendered).toContain('Mira');
    expect(rendered).not.toContain('{{playerName}}');
    expect(rendered).not.toContain('Ankit');
  });

  test('is endless, romance remains central, and no route forces a player action', () => {
    const serialized = [bundle.story, bundle.characters, bundle.world, bundle.scenes, bundle.memory]
      .map((value) => JSON.stringify(value))
      .join('\n');
    expect(serialized).not.toMatch(/\b(?:arc|act|chapter|stage)\s*\d+/i);
    expect(bundle.scenes.endings).toEqual([]);
    for (const scene of bundle.scenes.scenes) {
      expect(scene.isEnding).not.toBe(true);
      for (const choice of scene.choices) {
        expect(choice.next).toBeNull();
        expect(choice.effects?.endStory).toBeUndefined();
      }
      for (const line of scene.narration.concat(scene.fallbackLines)) {
        expect(line).not.toMatch(/{{playerName}}\s*:/i);
        expect(line).not.toMatch(/\byou (feel|decide|choose|trust|fear)\b/i);
      }
    }
    expect(bundle.world.rules.join('\n')).toMatch(/romance.*major pillar/i);
    expect(bundle.world.rules.join('\n')).toMatch(/never force.*criminal|never force.*fight/i);
    expect(bundle.memory.extractionHints.join('\n')).toMatch(/promises and vows/i);
    expect(bundle.memory.extractionHints.join('\n')).toMatch(/who-knows-what/i);
  });

  test('the existing narrator and memory architecture receive player name and continuity rules', () => {
    const prompt = buildSystemPrompt(
      {
        bundle,
        playthrough,
        profile: { nickname: 'Reader', ageGroup: '18+', createdAt: playthrough.createdAt },
        memories: [],
        history: [],
      },
      '18+',
    );
    expect(prompt).toContain('Only the player controls Reader');
    expect(prompt).toContain('Zara Mirza');
    expect(prompt).toContain('Faraz');
    expect(prompt).toMatch(/endless, dynamic story/i);
    expect(prompt).toContain('Use Kissa\'s existing story memory and conversation context');
    expect(prompt).toContain('Reader is exclusively player-controlled');
    expect(prompt).toContain('who-knows-what record');
    expect(prompt).not.toContain('{{playerName}}');
  });
});
