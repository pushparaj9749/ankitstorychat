/**
 * The Kissa story format, end to end:
 *   *action*        -> narration line (rendered FADED in the chat UI)
 *   Myra: "text"    -> dialogue line spoken by Myra
 *
 * Runs the REAL story content through the opening a new journey saves
 * (src/lib/opening.ts), so the shipped scenes are what is being asserted.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderOpening } from './helpers/opening';
import { getScene, matchChoice } from '../src/lib/engine';
import { splitSpeakerLine } from '../src/lib/markup';
import type { StoryBundle, StoryCreator } from '../src/types';
import { KISSA_OWNER_CREATOR } from '../src/types';

const ROOT = join(__dirname, '..');

function loadBundle(id: string): StoryBundle {
  const dir = join(ROOT, 'content', 'stories', id);
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(ROOT, 'content', 'manifest.json'), 'utf8')) as {
    stories: { id: string }[];
  };
  const meta = manifest.stories.find((s) => s.id === id)! as StoryBundle['meta'];
  const story = read('story.json');
  const creator: StoryCreator = meta.creator ?? story.creator ?? KISSA_OWNER_CREATOR;
  return {
    meta,
    story,
    characters: read('characters.json'),
    world: read('world.json'),
    scenes: read('scenes.json'),
    memory: read('memory.json'),
    source: 'bundled',
    creator,
  };
}

const bundle = loadBundle('cafe-queen-myra');

describe('cafe-queen-myra opening block', () => {
  const { lines, sceneId } = renderOpening(bundle);

  test('opens in the café scene', () => {
    expect(sceneId).toBe('s1_coffee');
    expect(lines.length).toBe(8);
  });

  test('*action* lines become narration, dialogue keeps its speaker', () => {
    expect(lines.map((l) => l.role)).toEqual([
      'narration',
      'narration',
      'narration',
      'assistant',
      'narration',
      'assistant',
      'narration',
      'assistant',
    ]);
    expect(lines.filter((l) => l.speaker === 'Myra')).toHaveLength(3);
  });

  test('asterisks are stripped before the text is stored', () => {
    for (const l of lines) expect(l.text).not.toContain('*');
  });

  test('the opening line the user wrote is intact', () => {
    expect(lines[0].text).toContain(
      'Myra secretly shehar ki sabse dangerous Mafia Queen hai, jo apni asli identity chhupa rahi hai.',
    );
    expect(lines[3].text).toBe('"Umm... lagta hai ye coffee meri nahi hai."');
    expect(lines[7].text).toBe('"Vaise... tumhara naam kya hai?"');
  });

  test('every opening line is either faded narration or named dialogue', () => {
    for (const l of lines) {
      const fadedLine = l.role === 'narration' && l.speaker === null;
      const dialogue = l.role === 'assistant' && l.speaker === 'Myra';
      expect(fadedLine || dialogue).toBe(true);
    }
  });
});

describe('line format', () => {
  const names = bundle.characters.characters.map((c) => c.name);

  test('unknown names are not promoted to speakers', () => {
    expect(splitSpeakerLine('Problem: sab kuch bigad gaya', names).speaker).toBeNull();
  });

  test('a cast name before the colon becomes the speaker', () => {
    expect(splitSpeakerLine('Myra: "Hello"', names)).toMatchObject({ speaker: 'Myra', text: '"Hello"' });
  });
});

describe('smart-reply matching', () => {
  test('free text still matches the closest suggestion', () => {
    const scene = getScene(bundle, bundle.story.openingSceneId);
    expect(matchChoice('Mera naam Ankit hai', scene.choices)?.id).toBe('c_naam');
  });
});
