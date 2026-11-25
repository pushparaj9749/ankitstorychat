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
import { formatMeterLine, meterPromptLine, meterValue, meterViewsForReply, parseMeterLine, resolveMeters } from '../src/lib/storyMeters';

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

  test('meters are ONE line above the reply bubble — no bars, no card', () => {
    // v2.16.1: the reader asked for the numbers as a line of text above each
    // reply ("har jawab me upar ❤️ 0/100 aur 💔 100/100"), not a bar card and
    // not a second meter UI anywhere.
    const chat = read('src/screens/Chat.tsx');
    const intro = read('src/components/StoryIntro.tsx');
    const bubble = read('src/components/chat.tsx');

    // the bubble owns the line, the intro owns nothing meter-shaped
    expect(bubble).toContain('testID="story-meter-line"');
    expect(bubble).toContain('meterLabels');
    expect(intro).not.toContain('story-meters');
    expect(intro).not.toContain('accessibilityRole="progressbar"');
    expect(intro).not.toContain('meterTrack');

    // the chat screen feeds the bubble, and keeps the ledger fallback
    expect(chat).toContain('resolveMeters(');
    expect(chat).toContain('<StoryIntro');
    expect(chat).toContain('meterLabels={meterLabels}');
    expect(chat).toContain('meterValues={');
  });

  test('the meter line is above the bubble, in the story text itself', () => {
    // The line is written by the narrator as the first line of the reply, then
    // lifted out of the body so it renders as its own row above the bubble.
    const bubble = read('src/components/chat.tsx');
    const lineAt = bubble.indexOf('<MeterLine');
    const bodyAt = bubble.indexOf('<StoryText');
    expect(lineAt).toBeGreaterThan(0);
    expect(bodyAt).toBeGreaterThan(lineAt);
  });

  test('the narrator is told to write the line on every reply — only here', () => {
    const prompt = meterPromptLine({
      characterId: 'isha',
      meters: [
        { id: 'love', label: 'Love', source: 'affection', start: 0 },
        { id: 'hate', label: 'Hate', source: 'hate', start: 100 },
      ],
    });
    expect(prompt).toContain('❤️ {value}/100');
    expect(prompt).toContain('💔 {value}/100');
    expect(prompt).toContain('Line 1 of the reply');
    // A story without meters must get nothing at all.
    expect(meterPromptLine(undefined)).toBe('');
    expect(meterPromptLine({ meters: [] })).toBe('');
  });

  test('the intro block also carries media, play guide and the intro text', () => {
    const intro = read('src/components/StoryIntro.tsx');
    const detail = read('src/screens/StoryDetail.tsx');
    // chat-side intro
    expect(intro).toContain('testID="story-media"');
    expect(intro).toContain('testID="story-guide"');
    expect(intro).toContain('testID="story-intro-text"');
    expect(intro).toContain('horizontal');
    // story-detail side: carousel -> thumbnails -> play -> intro
    expect(detail).toContain('testID="story-carousel"');
    expect(detail).toContain('testID="story-thumbs"');
    expect(detail).toContain('testID="story-play-block"');
    expect(detail).toContain('testID="story-intro"');
    const playCta = detail.indexOf('testID="story-play-block"');
    const introText = detail.indexOf('testID="story-intro"');
    expect(playCta).toBeGreaterThan(0);
    expect(introText).toBeGreaterThan(playCta);
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

describe('the meter line the narrator writes (v2.16.1)', () => {
  test('parses the line and hands back the story body untouched', () => {
    const raw = '❤️ 12/100 · 💔 88/100\n\n*Isha nazar chura leti hai.*\nIsha: "Kya dekh rahe ho?"';
    const parsed = parseMeterLine(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.values).toEqual([12, 88]);
    expect(parsed!.icons).toEqual(['❤️', '💔']);
    expect(parsed!.rest.startsWith('*Isha nazar chura leti hai.*')).toBe(true);
    expect(parsed!.rest).not.toContain('100');
  });

  test('accepts a single meter and tolerates spaces the model adds', () => {
    const parsed = parseMeterLine('❤️ 0 / 100\nIsha: "Chalo."');
    expect(parsed!.values).toEqual([0]);
    expect(parsed!.rest).toBe('Isha: "Chalo."');
  });

  test('leaves prose alone when the numbers are not a standalone line', () => {
    // A story sentence that happens to mention the numbers must never be eaten.
    expect(parseMeterLine('*Uska mood 100/100 par tha.*')).toBeNull();
    expect(parseMeterLine('Isha: "Main 0/100 wali feeling me hoon."')).toBeNull();
    expect(parseMeterLine('❤️ 12/100 par woh phir bhi hasi.')).toBeNull();
  });

  test('clamps impossible numbers instead of rendering them', () => {
    const parsed = parseMeterLine('❤️ 250/100 · 💔 -5/100\nHi');
    expect(parsed!.values).toEqual([100, 0]);
  });

  test('formatMeterLine is the exact shape the prompt asks for', () => {
    expect(formatMeterLine([{ source: 'affection', label: 'Love' }, { source: 'hate', label: 'Hate' }], [0, 100]))
      .toBe('❤️ 0/100 · 💔 100/100');
  });

  test('a parsed line wins over the ledger, and the ledger covers old turns', () => {
    const config = { characterId: 'isha', meters: [{ id: 'love', label: 'Love', source: 'affection' as const }, { id: 'hate', label: 'Hate', source: 'hate' as const }] };
    const rels = { isha: { affection: 30, trust: 20 } };
    // old turn: no line in the text -> ledger wins (hate = 100 - (30*.6 + 20*.4) = 74)
    const fromLedger = resolveMeters(config, rels, 'isha').map((m) => m.value);
    expect(fromLedger).toEqual([30, 74]);
    // new turn: the narrator's line is authoritative
    const parsed = parseMeterLine('❤️ 41/100 · 💔 59/100\n*beat*');
    const merged = meterViewsForReply(config, rels, 'isha', parsed!.values).map((m) => m.value);
    expect(merged).toEqual([41, 59]);
  });

  test('stories without meters render nothing, even if a reply has numbers', () => {
    expect(meterViewsForReply(undefined, undefined, 'isha', [10, 90])).toEqual([]);
    expect(meterViewsForReply({ meters: [] }, undefined, 'isha', [10, 90])).toEqual([]);
  });
});
