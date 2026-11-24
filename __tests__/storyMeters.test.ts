/**
 * Story meters (v2.15.1).
 *
 * The author of "She Hates Me First" asked for a Love Meter + Hate Meter
 * (❤️ 0/100, 💔 100/100). The first build accepted the story without them, which
 * is exactly what this file prevents from happening silently again.
 *
 * Two things are pinned:
 *   1. the maths — values come from the world-state ledger, and "hate" is a real
 *      inverse of the bond (never a copy of love);
 *   2. the content — the submitted story actually declares its meters, and the
 *      narrator is told that the reader can see them.
 */
import fs from 'fs';
import path from 'path';
import { meterPromptLine, meterValue, resolveMeters } from '../src/lib/storyMeters';

const ROOT = path.join(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');
const manifest = JSON.parse(read('content/manifest.json')) as {
  contentVersion: number;
  stories: { id: string; version: number; meters?: { characterId?: string; meters: { id: string; label: string; source: string; start?: number }[] } }[];
};

describe('meter maths', () => {
  test('affection and trust read straight from the ledger', () => {
    expect(meterValue({ id: 'l', label: 'Love', source: 'affection' }, { affection: 42, trust: 10 })).toBe(42);
    expect(meterValue({ id: 't', label: 'Trust', source: 'trust' }, { affection: 90, trust: 12 })).toBe(12);
    expect(meterValue({ id: 'x', label: 'Tension', source: 'tension' }, { tension: 77 })).toBe(77);
  });

  test('hate is the inverse of the bond, not a copy of it', () => {
    // Nothing recorded yet: full hate, zero love.
    expect(meterValue({ id: 'h', label: 'Hate', source: 'hate' }, { affection: 0, trust: 0 })).toBe(100);
    // Fully warmed: hate is gone.
    expect(meterValue({ id: 'h', label: 'Hate', source: 'hate' }, { affection: 100, trust: 100 })).toBe(0);
    // Halfway: they sum to 100, so the two bars can never both read 100.
    const mid = meterValue({ id: 'h', label: 'Hate', source: 'hate' }, { affection: 50, trust: 50 });
    expect(mid).toBe(50);
    expect(mid + meterValue({ id: 'l', label: 'Love', source: 'affection' }, { affection: 50 })).toBe(100);
  });

  test('hate and love move in opposite directions in one beat', () => {
    const before = { affection: 10, trust: 10 };
    const after = { affection: 30, trust: 30 };
    expect(meterValue({ id: 'l', label: 'Love', source: 'affection' }, after)).toBeGreaterThan(
      meterValue({ id: 'l', label: 'Love', source: 'affection' }, before),
    );
    expect(meterValue({ id: 'h', label: 'Hate', source: 'hate' }, after)).toBeLessThan(
      meterValue({ id: 'h', label: 'Hate', source: 'hate' }, before),
    );
  });

  test('missing or out-of-range ledger values are clamped, never NaN', () => {
    expect(meterValue({ id: 'l', label: 'Love', source: 'affection' }, undefined)).toBe(0);
    expect(meterValue({ id: 'l', label: 'Love', source: 'affection' }, { affection: 999 })).toBe(100);
    expect(meterValue({ id: 'l', label: 'Love', source: 'affection' }, { affection: -5 })).toBe(0);
  });
});

describe('resolveMeters', () => {
  const config = {
    characterId: 'isha',
    meters: [
      { id: 'love', label: 'Love', source: 'affection' as const, start: 0 },
      { id: 'hate', label: 'Hate', source: 'hate' as const, start: 100 },
    ],
  };

  test('before the story records anything, the authored start values show', () => {
    const m = resolveMeters(config, {});
    expect(m.map((x) => [x.label, x.value])).toEqual([
      ['Love', 0],
      ['Hate', 100],
    ]);
    expect(m.every((x) => x.isInitial)).toBe(true);
  });

  test('once the ledger has the character, real values replace the start', () => {
    const m = resolveMeters(config, { isha: { affection: 34, trust: 20 } });
    expect(m[0].value).toBe(34);
    // 100 - (34*0.6 + 20*0.4) = 100 - 28.4 = 71.6 -> 72
    expect(m[1].value).toBe(72);
    expect(m.every((x) => !x.isInitial)).toBe(true);
  });

  test('falls back to the lead character when the story names none', () => {
    const noId = { meters: [{ id: 'love', label: 'Love', source: 'affection' as const }] };
    expect(resolveMeters(noId, { isha: { affection: 61 } }, 'isha')[0].value).toBe(61);
  });

  test('stories without meters are untouched', () => {
    expect(resolveMeters(undefined, { isha: { affection: 90 } })).toEqual([]);
    expect(resolveMeters({ meters: [] }, {})).toEqual([]);
  });

  test('never renders more than two bars, and drops duplicate ids', () => {
    const many = {
      characterId: 'isha',
      meters: [
        { id: 'a', label: 'A', source: 'affection' as const },
        { id: 'a', label: 'A2', source: 'trust' as const },
        { id: 'b', label: 'B', source: 'tension' as const },
        { id: 'c', label: 'C', source: 'trust' as const },
      ],
    };
    const m = resolveMeters(many, {});
    expect(m.map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('the narrator is told the meters are visible', () => {
  test('a configured story gets the meter line, a plain story does not', () => {
    expect(meterPromptLine(undefined)).toBe('');
    const line = meterPromptLine({
      meters: [
        { id: 'love', label: 'Love', source: 'affection' },
        { id: 'hate', label: 'Hate', source: 'hate' },
      ],
    });
    expect(line).toContain('VISIBLE METERS');
    expect(line).toContain('Love');
    expect(line).toContain('Hate');
    // The record-keeper must be pushed to actually move the numbers.
    expect(line).toMatch(/-10\.\.\+10/);
  });

  test('the prompt builder includes that line for this story', () => {
    expect(read('src/lib/engine.ts')).toContain('meterPromptLine(bundle.meta?.meters)');
  });
});

describe('"She Hates Me First" actually declares its meters', () => {
  const story = manifest.stories.find((s) => s.id === 'she-hates-me-first')!;

  test('the story exists in the manifest', () => {
    expect(story).toBeTruthy();
  });

  test('Love starts at 0 and Hate at 100, exactly as the author asked', () => {
    expect(story.meters?.characterId).toBe('isha');
    const byLabel = Object.fromEntries((story.meters?.meters ?? []).map((m) => [m.label, m]));
    expect(byLabel.Love.source).toBe('affection');
    expect(byLabel.Love.start).toBe(0);
    expect(byLabel.Hate.source).toBe('hate');
    expect(byLabel.Hate.start).toBe(100);
  });

  test('the story version was bumped so clients re-fetch it', () => {
    expect(story.version).toBeGreaterThanOrEqual(2);
    expect(manifest.contentVersion).toBeGreaterThanOrEqual(75);
  });

  test('story.json is bumped too, not just the manifest entry', () => {
    // The package route serves the story file as-is. Shipping a manifest at v2
    // with a story file at v1 means a client that re-downloads the package sees
    // two different numbers for the same story.
    const file = JSON.parse(read('content/stories/she-hates-me-first/story.json')) as { version: number };
    expect(file.version).toBe(story.version);
  });

  test('the chat header renders meters and does not lie when none exist', () => {
    const chat = read('src/screens/Chat.tsx');
    expect(chat).toContain('resolveMeters(');
    expect(chat).toContain('accessibilityRole="progressbar"');
    // Old dead styles meant the bond was computed but never drawn.
    expect(chat).toContain('styles.metersRow');
  });
});

describe('opening-scene canon has no contradiction', () => {
  test('Isha does not "remember" a meeting that never happened', () => {
    // The old sheet said she had seen the reader before, while the world timeline
    // says the parking-lot collision was their first meeting. The narrator could
    // follow either, so it invented history on turn one.
    const chars = JSON.parse(read('content/stories/she-hates-me-first/characters.json')) as {
      characters: { id: string; relationshipWithUser: string }[];
    };
    const isha = chars.characters.find((c) => c.id === 'isha')!;
    expect(isha.relationshipWithUser).not.toMatch(/pehli baar dekha/i);
    expect(isha.relationshipWithUser).toMatch(/pehli mulaqat/i);
  });

  test('the world says plainly that they meet for the first time', () => {
    const world = JSON.parse(read('content/stories/she-hates-me-first/world.json')) as { rules: string[] };
    expect(world.rules.join(' ')).toMatch(/pehle din, parking lot ke takraav se jaante hain/);
  });
});
