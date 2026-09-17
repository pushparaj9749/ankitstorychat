/**
 * The Kissa story format, end to end:
 *   *action*        -> narration line (rendered FADED in the chat UI)
 *   Myra: "text"    -> dialogue line spoken by Myra
 *
 * Runs the REAL bundled story content through the offline storyteller, so the
 * shipped scenes are what is being asserted — not a fixture.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { offlineChoose, offlineOpening, offlineStep, toOfflineLines } from '../src/lib/offlineEngine';
import type { OfflineStep } from '../src/lib/offlineEngine';
import { freshStateFor, getScene } from '../src/lib/engine';
import type { Playthrough, StoryBundle, StoryCreator } from '../src/types';
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

function freshPlaythrough(): Playthrough {
  return {
    id: 'pt_test',
    storyId: bundle.story.id,
    label: 'Journey 1',
    mode: 'offline',
    providerId: null,
    status: 'active',
    currentSceneId: bundle.story.openingSceneId,
    state: freshStateFor(bundle),
    messageCount: 0,
    progress: 0,
    endingId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('cafe-queen-myra opening block', () => {
  const { lines, sceneId } = offlineOpening(bundle);

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

describe('toOfflineLines', () => {
  test('unknown names are not promoted to speakers', () => {
    const lines = toOfflineLines(bundle, ['Problem: sab kuch bigad gaya']);
    expect(lines[0].speaker).toBeNull();
    expect(lines[0].role).toBe('assistant');
  });

  test('plain narration stays a plain dialogue-free line', () => {
    const lines = toOfflineLines(bundle, ['Café mein music baj raha hai.']);
    expect(lines).toEqual([{ role: 'assistant', speaker: null, text: 'Café mein music baj raha hai.' }]);
  });

  test('blank lines are dropped', () => {
    expect(toOfflineLines(bundle, ['', '   '])).toEqual([]);
  });
});

describe('cafe-queen-myra branch walk (offline engine)', () => {
  function play(choiceIds: string[]) {
    let pt = freshPlaythrough();
    const seen: string[] = [pt.currentSceneId];
    let lastStep: OfflineStep | null = null;
    for (const id of choiceIds) {
      const res = offlineChoose(bundle, pt, id);
      expect(res).not.toBeNull();
      const { step, state } = res!;
      pt = { ...pt, currentSceneId: step.newSceneId, state, messageCount: pt.messageCount + 1 };
      seen.push(step.newSceneId);
      lastStep = step;
    }
    return { pt, seen, lastStep: lastStep! };
  }

  test('loyal path ends on the happy ending', () => {
    const { seen, pt, lastStep } = play(['c_naam', 'c_bill', 'c_loyal', 'c_hisaab']);
    expect(seen).toEqual(['s1_coffee', 's2_naam', 's3_beena', 's5_car_deal', 'e_end_queen']);
    expect(getScene(bundle, pt.currentSceneId).isEnding).toBe(true);
    expect(lastStep.ended).toBe(true);
    expect(lastStep.endingId).toBe('end_queen');
  });

  test('lying to Beena ends dark', () => {
    const { seen, lastStep } = play(['c_naam', 'c_bill', 'c_kholo', 'c_jhooth_beena']);
    expect(seen).toEqual(['s1_coffee', 's2_naam', 's3_beena', 's5_betray', 'e_end_dark']);
    expect(lastStep.endingId).toBe('end_dark');
  });

  test('walking away ends bittersweet', () => {
    const { seen, lastStep } = play(['c_wapas', 'c_chal', 'c_inkaar']);
    expect(seen).toEqual(['s1_coffee', 's2_cold', 's4_guard', 'e_end_normal']);
    expect(lastStep.endingId).toBe('end_normal');
  });

  test('scene lines keep the format: faded action + named dialogue', () => {
    const res = offlineChoose(bundle, freshPlaythrough(), 'c_naam');
    const lines = res!.step.lines;
    expect(lines.some((l) => l.role === 'narration' && !l.text.includes('*'))).toBe(true);
    expect(lines.some((l) => l.speaker === 'Myra')).toBe(true);
  });

  test('free text matching still lands on a choice', () => {
    const pt = freshPlaythrough();
    const { step } = offlineStep(bundle, pt, 'Mera naam Ankit hai');
    expect(step.newSceneId).toBe('s2_naam');
  });
});
