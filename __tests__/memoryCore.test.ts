/**
 * Memory recall tests — the point of these is that a fact learned on turn 3 must
 * still reach the prompt on turn 500. Pure core (no SQLite) so it runs in node.
 */
import {
  buildDigestFallback,
  episodeLine,
  extractPreferenceNotes,
  hashText,
  looksTooPrivate,
  MEMORY_CHAR_BUDGET,
  renderMemoryLine,
  overlapScore,
  scoreMemory,
  selectRelevant,
  tokenize,
} from '../src/lib/memoryCore';
import type { MemoryEntry, MemoryKind } from '../src/types';

const NOW = Date.parse('2026-09-13T10:00:00.000Z');

function mem(over: Partial<MemoryEntry> & { text: string }): MemoryEntry {
  return {
    id: over.id ?? `mem_${Math.random().toString(36).slice(2, 8)}`,
    playthroughId: 'pt1',
    kind: (over.kind ?? 'story') as MemoryKind,
    text: over.text,
    importance: over.importance ?? 2,
    createdAt: over.createdAt ?? new Date(NOW).toISOString(),
    hits: over.hits ?? 0,
    archived: over.archived ?? false,
  };
}

describe('tokenize', () => {
  test('keeps Devanagari words and drops fillers', () => {
    const t = tokenize('मेरी कॉफी ठंडी हो गई। My coffee went cold hai na');
    expect(t).toContain('कॉफी');
    expect(t).toContain('coffee');
    expect(t).toContain('cold');
    expect(t).not.toContain('hai');
    expect(t).not.toContain('meri');
  });

  test('generic verb soup scores below a real name match', () => {
    const noise = new Set(tokenize('aur main kya kar raha tha bas'));
    const filler = mem({ text: 'aur woh kya kar raha tha bas' });
    const named = mem({ text: 'aarav ne chai ka waada toda' });
    expect(overlapScore(filler.text, noise)).toBe(0);
    expect(overlapScore(named.text, new Set(tokenize('aarav chai waada')))).toBeGreaterThan(3);
  });

  test('long Hinglish sentence does not score on stopwords alone', () => {
    const a = mem({ text: 'Aur woh kya kar raha tha bas' });
    const q = new Set(tokenize('Aur main kya kar raha tha bas'));
    expect(scoreMemory(a, q, NOW)).toBeLessThan(scoreMemory(mem({ text: 'Aarav ne chai todo' }), new Set(tokenize('aarav chai')), NOW));
  });
});

describe('hashText', () => {
  test('same fact in different casing/punctuation dedupes', () => {
    expect(hashText('Myra ne  Aarav  ko chai di!')).toBe(hashText('myra ne aarav ko CHAI di.'));
  });
  test('different facts do not collide', () => {
    expect(hashText('Myra ne Aarav ko chai di')).not.toBe(hashText('Myra ne Aarav ko coffee di'));
  });

  test('numbers and short words are part of the identity', () => {
    expect(hashText('Teesra chapter 1')).not.toBe(hashText('Teesra chapter 2'));
    expect(hashText('raat 3 baje')).not.toBe(hashText('raat 4 baje'));
  });
});

describe('selectRelevant', () => {
  const old = mem({
    id: 'old',
    text: 'Aarav ne stage ke peeche Myra se maafi maangi',
    importance: 2,
    createdAt: new Date(NOW - 400 * 86_400_000).toISOString(),
  });

  test('a 400-day-old fact still wins when it matches the question', () => {
    const noise: MemoryEntry[] = Array.from({ length: 500 }, (_, i) =>
      mem({ id: `n${i}`, text: `Chai ki pyaali number ${i} table par thi`, importance: 2 }),
    );
    const picked = selectRelevant([old, ...noise], 'Myra se maafi ka scene yaad hai?', { nowMs: NOW });
    expect(picked.map((m) => m.id)).toContain('old');
  });

  test('importance pinning still runs when a pinned preference is the top row', () => {
    const pref = mem({ id: 'pref', kind: 'preference', text: 'User likes chai.', importance: 3 });
    const facts = [
      mem({ id: 'f1', text: 'Drama club mein galti se select hua', importance: 4 }),
      mem({ id: 'f2', text: 'Climax comedy gaya, sabko pasand aaya', importance: 5 }),
      mem({ id: 'f3', text: 'Udaan fest teen din door hai', importance: 3 }),
    ];
    const picked = selectRelevant([pref, ...facts], 'kuch aur baat', { nowMs: NOW });
    expect(picked.map((m) => m.id).sort()).toEqual(['f1', 'f2', 'f3', 'pref']);
  });

  test('importance-pinned core facts survive with zero overlap', () => {
    const core = mem({ id: 'core', text: 'Kabir ka audition fest se clash hai', importance: 5 });
    const picked = selectRelevant([core], 'hello there', { nowMs: NOW });
    expect(picked.map((m) => m.id)).toContain('core');
  });

  test('the rolling summary is always injected', () => {
    const s = mem({ id: 'sum', kind: 'summary', text: 'Raj narrator bana, play adhoora hai', importance: 3 });
    const picked = selectRelevant([s, ...Array.from({ length: 40 }, (_, i) => mem({ id: `x${i}`, text: `random fact ${i} zebra` }))], 'unrelated', {
      nowMs: NOW,
    });
    expect(picked[0].id).toBe('sum');
  });

  test('respects the character budget and item cap', () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      mem({ id: `b${i}`, text: `${'word'.repeat(60)} ${i}`, importance: 2 }),
    );
    const picked = selectRelevant(many, 'word', { nowMs: NOW, maxItems: 12 });
    expect(picked.length).toBeLessThanOrEqual(12);
    expect(picked.reduce((n, m) => n + m.text.length, 0)).toBeLessThanOrEqual(MEMORY_CHAR_BUDGET * 1.0001);
  });

  test('archived rows never reach the prompt', () => {
    const a = mem({ id: 'arch', text: 'aarav chai', archived: true });
    expect(selectRelevant([a], 'aarav chai', { nowMs: NOW })).toHaveLength(0);
  });

  test('reinforced memories outrank equal fresh ones', () => {
    const hit = mem({ id: 'used', text: 'myra promise chai', hits: 6, createdAt: new Date(NOW - 30 * 86_400_000).toISOString() });
    const fresh = mem({ id: 'new', text: 'myra promise chai', hits: 0, importance: 1 });
    expect(scoreMemory(hit, new Set(tokenize('myra chai')), NOW)).toBeGreaterThan(
      scoreMemory(fresh, new Set(tokenize('myra chai')), NOW),
    );
  });
});

describe('digest + episodes', () => {
  test('fallback digest respects its budget', () => {
    const facts = Array.from({ length: 80 }, (_, i) => mem({ text: `${'filler '.repeat(30)}${i}` }));
    const d = buildDigestFallback(facts, 600);
    expect(d.length).toBeLessThanOrEqual(600);
    expect(d.split('\n').length).toBeGreaterThan(1);
  });

  test('episode line keeps both sides and stays short', () => {
    const line = episodeLine('Main stage par jaake bola ki play nahi karunga', 'Myra: "Tum pagli ho kya?" ' + '*Woh hans padi.*'.repeat(20));
    expect(line.startsWith('U: ')).toBe(true);
    expect(line).toContain('Myra');
    expect(line.length).toBeLessThanOrEqual(260);
  });

  test('renderMemoryLine tags episodic logs as log', () => {
    expect(renderMemoryLine(mem({ kind: 'episode', text: 'U: hi' }))).toBe('- [log] U: hi');
  });
});

describe('privacy guard (neverRemember)', () => {
  test.each([
    'mera email rahul@gmail.com hai',
    'call me on +91 9876543210',
    'aadhaar 1234 5678 9012',
    'card 4111111111111111',
  ])('refuses to store %s', (t) => {
    expect(looksTooPrivate(t)).toBe(true);
  });

  test('story facts pass through', () => {
    expect(looksTooPrivate('Aarav ne Myra ka scarf wapas rakha')).toBe(false);
  });
});

describe('extractPreferenceNotes', () => {
  test('catches likes, nicknames and dislikes in Hinglish', () => {
    expect(extractPreferenceNotes('mujhe chai pasand hai')).toEqual(['User likes chai.']);
    expect(extractPreferenceNotes('mujhe Ananya kaho')).toEqual(['User asked to be called "Ananya".']);
    expect(extractPreferenceNotes('mera naam Raj hai')).toContain("User's name is Raj.");
    expect(extractPreferenceNotes('mujhe coffee pasand nahi').join(' ')).toContain('dislikes');
  });

  test('chit-chat produces no notes', () => {
    expect(extractPreferenceNotes('aage kya hoga?')).toEqual([]);
  });
});
