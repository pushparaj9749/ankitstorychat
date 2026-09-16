/**
 * Player-name interpolation — the reader's name must come from the local
 * profile, never from hardcoded story text.
 *
 * Required behaviour:
 *   - user "Rahul"  -> "Rahul" appears wherever the player is referenced
 *   - user "Aman"   -> "Ankit" does NOT appear as the player name
 *   - a CHARACTER named "Ankit" keeps the name "Ankit"
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LocalProfile, Playthrough, StoryBundle, StoryMeta } from '../src/types';
import {
  interpolatePlayerName,
  makePlayerTextFn,
  LEGACY_PLAYER_NAMES,
  PLAYER_NAME_PLACEHOLDER,
} from '../src/lib/playerName';
import { buildSystemPrompt } from '../src/lib/engine';
import { offlineOpening, offlineStep, toOfflineLines } from '../src/lib/offlineEngine';

const ROOT = join(__dirname, '..');

function loadBundle(id: string): StoryBundle {
  const dir = join(ROOT, 'content', 'stories', id);
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(ROOT, 'content', 'manifest.json'), 'utf8')) as {
    stories: StoryMeta[];
  };
  const meta = manifest.stories.find((s) => s.id === id)!;
  return {
    meta,
    story: read('story.json'),
    characters: read('characters.json'),
    world: read('world.json'),
    scenes: read('scenes.json'),
    memory: read('memory.json'),
    source: 'bundled',
  };
}

/** A story whose player used to be hardcoded as "Ankit". */
const ankitStory = loadBundle('goddess-who-chose-me');
/** A story with a genuine CHARACTER called "Kabir" (not the player). */
const kabirCharacterStory = loadBundle('chai-dreams');

const profileOf = (nickname: string): LocalProfile => ({
  nickname,
  ageGroup: '18+',
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('interpolatePlayerName basics', () => {
  test('resolves {{playerName}} (incl. whitespace variants)', () => {
    expect(interpolatePlayerName('{{playerName}}', 'Rahul')).toBe('Rahul');
    expect(interpolatePlayerName('{{ playerName }}', 'Rahul')).toBe('Rahul');
    expect(interpolatePlayerName('{{  playerName  }}', 'Rahul')).toBe('Rahul');
    expect(interpolatePlayerName('*{{playerName}} ka phone bajaata hai*', 'Rahul')).toBe(
      '*Rahul ka phone bajaata hai*',
    );
  });

  test('handles multiple occurrences and keeps surrounding text', () => {
    expect(interpolatePlayerName('{{playerName}}, tum yahan? Main {{playerName}} hoon.', 'Aman')).toBe(
      'Aman, tum yahan? Main Aman hoon.',
    );
  });

  test('legacy hardcoded player names are replaced for the reader', () => {
    expect(interpolatePlayerName('Tum Ankit ho.', 'Rahul')).toBe('Tum Rahul ho.');
    expect(interpolatePlayerName('Ankit ka phone', 'Rahul')).toBe('Rahul ka phone');
  });

  test('word boundaries: similar names are not mangled', () => {
    expect(interpolatePlayerName('Ankita di keh rahi thi', 'Rahul')).toBe('Ankita di keh rahi thi');
    expect(interpolatePlayerName('Ankits', 'Rahul')).toBe('Ankits');
  });

  test('an empty player name falls back instead of blanking text', () => {
    expect(interpolatePlayerName('Tum {{playerName}} ho', '')).toBe('Tum Traveller ho');
  });
});

describe('character names are preserved', () => {
  test('a CHARACTER named "Ankit" keeps the name', () => {
    const out = interpolatePlayerName('Ankit ne Ankit se haath milaya.', 'Rahul', {
      protectedNames: ['Ankit'],
    });
    // The character "Ankit" (protected) stays; nothing is renamed to Rahul.
    expect(out).toBe('Ankit ne Ankit se haath milaya.');
  });

  test('player references are still replaced around a protected character', () => {
    const out = interpolatePlayerName('Ankit (character) {{playerName}} se mila.', 'Rahul', {
      protectedNames: ['Ankit'],
    });
    expect(out).toBe('Ankit (character) Rahul se mila.');
  });

  test('chai-dreams keeps its CHARACTER Kabir (player is someone else)', () => {
    const lines = offlineOpening(kabirCharacterStory, 'Rahul');
    const allText = lines.lines.map((l) => l.text).join('\n');
    // Kabir is a real character in this story — must survive interpolation.
    expect(allText).toContain('Kabir');
    expect(allText).not.toContain('{{');
  });

  test('hawa-band-dhaba (legacy player Kabir) now uses the placeholder', () => {
    const b = loadBundle('hawa-band-dhaba');
    const lines = offlineOpening(b, 'Meera');
    const allText = lines.lines.map((l) => l.text).join('\n');
    expect(allText).not.toContain('{{');
    expect(allText).not.toContain('Kabir');
  });
});

describe('the whole content pack is player-name clean', () => {
  test('no story text ships raw {{playerName}}-adjacent legacy names as the PLAYER', () => {
    // After migration, the only remaining literal legacy names must belong to
    // actual characters (chai-dreams' Kabir, witch-who-loves-a-human's Arjun).
    const manifest = JSON.parse(readFileSync(join(ROOT, 'content', 'manifest.json'), 'utf8')) as {
      stories: { id: string; storyDir: string }[];
    };
    for (const entry of manifest.stories) {
      const dir = join(ROOT, 'content', 'stories', entry.storyDir);
      const chars = JSON.parse(readFileSync(join(dir, 'characters.json'), 'utf8')) as {
        characters: { name: string }[];
      };
      const charNames = new Set(chars.characters.map((c) => c.name));
      const scenes = JSON.parse(readFileSync(join(dir, 'scenes.json'), 'utf8')) as {
        scenes: { narration: string[] }[];
      };
      for (const scene of scenes.scenes) {
        for (const line of scene.narration) {
          for (const legacy of LEGACY_PLAYER_NAMES) {
            if (charNames.has(legacy)) continue; // a character — allowed
            expect(line).not.toMatch(new RegExp(`\\b${legacy}\\b`));
          }
        }
      }
    }
  });
});

describe('user "Rahul" sees Rahul everywhere the player is referenced', () => {
  test('opening narration (pre-chat cinematic introduction)', () => {
    const { lines } = offlineOpening(ankitStory, 'Rahul');
    const text = lines.map((l) => l.text).join('\n');
    expect(text).not.toContain(PLAYER_NAME_PLACEHOLDER);
    expect(text).not.toContain('Ankit');
    expect(text).toContain('Rahul');
  });

  test('offline scripted narration on every choice path', () => {
    const pt = {
      id: 'pt',
      storyId: ankitStory.story.id,
      label: 'Journey 1',
      mode: 'offline' as const,
      providerId: null,
      status: 'active' as const,
      currentSceneId: ankitStory.story.openingSceneId,
      state: { relationships: {}, inventory: [], location: '', flags: {}, choices: {}, visits: {} },
      messageCount: 0,
      progress: 0,
      endingId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as Playthrough;
    const scene = ankitStory.scenes.scenes[0];
    for (const choice of scene.choices ?? []) {
      const { step } = offlineStep(ankitStory, pt, choice.text, 'Rahul');
      const text = step.lines.map((l) => l.text).join('\n');
      expect(text).not.toContain('{{');
      expect(text).not.toContain('Ankit');
    }
  });

  test('AI prompt/context uses the reader name, not Ankit', () => {
    const prompt = buildSystemPrompt(
      {
        bundle: ankitStory,
        profile: profileOf('Rahul'),
        playthrough: {
          id: 'pt',
          storyId: ankitStory.story.id,
          label: 'J1',
          mode: 'ai',
          providerId: 'p',
          status: 'active',
          currentSceneId: ankitStory.story.openingSceneId,
          state: { relationships: {}, inventory: [], location: '', flags: {}, choices: {}, visits: {} },
          messageCount: 0,
          progress: 0,
          endingId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as unknown as Playthrough,
        memories: [],
        history: [],
      },
      '18+',
    );
    expect(prompt).toContain('Rahul');
    expect(prompt).not.toContain('Ankit');
    expect(prompt).not.toContain('{{');
  });

  test('memory seed/context resolves the placeholder', () => {
    const seeds = ankitStory.memory.seedMemories;
    const fn = makePlayerTextFn(ankitStory, 'Rahul');
    for (const seed of seeds) {
      expect(fn(seed)).not.toContain('{{');
    }
    expect(seeds.some((s) => s.includes('{{playerName}}'))).toBe(true);
  });
});

describe('user "Aman" never sees Ankit as the player name', () => {
  test('narration and AI prompt drop Ankit entirely', () => {
    const { lines } = offlineOpening(ankitStory, 'Aman');
    const text = lines.map((l) => l.text).join('\n');
    expect(text).not.toContain('Ankit');
    expect(text).toContain('Aman');

    const prompt = buildSystemPrompt(
      {
        bundle: ankitStory,
        profile: profileOf('Aman'),
        playthrough: {
          id: 'pt',
          storyId: ankitStory.story.id,
          label: 'J1',
          mode: 'ai',
          providerId: 'p',
          status: 'active',
          currentSceneId: ankitStory.story.openingSceneId,
          state: { relationships: {}, inventory: [], location: '', flags: {}, choices: {}, visits: {} },
          messageCount: 0,
          progress: 0,
          endingId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as unknown as Playthrough,
        memories: [],
        history: [],
      },
      '18+',
    );
    expect(prompt).not.toContain('Ankit');
    expect(prompt).toContain('Aman');
  });
});

describe('toOfflineLines (raw line interpolation)', () => {
  test('placeholder text becomes the player before speaker parsing', () => {
    const lines = toOfflineLines(
      ankitStory,
      ['Aria: "{{playerName}}, tum yahan kaise?"', '*{{playerName}} madhosh ho jaata hai.*'],
      'Rahul',
    );
    expect(lines[0]).toEqual({
      role: 'assistant',
      speaker: 'Aria',
      text: '"Rahul, tum yahan kaise?"',
    });
    expect(lines[1]).toEqual({ role: 'narration', speaker: null, text: 'Rahul madhosh ho jaata hai.' });
  });
});
