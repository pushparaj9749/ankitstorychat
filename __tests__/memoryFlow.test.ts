/**
 * Memory flow tests with an in-memory fake of the SQLite layer: write path,
 * retrieval, reinforcement and the consolidation/fold step.
 */
const store: any[] = [];
const kv = new Map<string, string>();
let reinforceCalls: string[][] = [];

jest.mock('../src/lib/db', () => ({
  insertMemory: jest.fn(async (m: any, hash?: string) => {
    const dup = hash ? store.find((r) => r.playthroughId === m.playthroughId && r.hash === hash) : undefined;
    if (dup) {
      dup.importance = Math.min(9, dup.importance + 1);
      dup.hits += 1;
      dup.archived = false;
      return 'reinforced';
    }
    store.push({ ...m, hash });
    return 'inserted';
  }),
  listMemoryCandidates: jest.fn(async (ids: string[]) =>
    store.filter((r) => ids.includes(r.playthroughId) && !r.archived),
  ),
  countMemories: jest.fn(async (ids: string[], kinds: string[] = []) =>
    store.filter(
      (r) => ids.includes(r.playthroughId) && !r.archived && (!kinds.length || kinds.includes(r.kind)),
    ).length,
  ),
  listOldestMemories: jest.fn(async (ids: string[], kinds: string[], limit: number) =>
    store
      .filter((r) => ids.includes(r.playthroughId) && !r.archived && kinds.includes(r.kind))
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .slice(0, limit),
  ),
  archiveMemories: jest.fn(async (ids: string[]) => {
    for (const r of store) if (ids.includes(r.id)) r.archived = true;
  }),
  reinforceMemories: jest.fn(async (ids: string[]) => {
    reinforceCalls = [ids];
    for (const r of store) if (ids.includes(r.id) && r.kind !== 'episode') r.hits += 1;
  }),
  listMemories: jest.fn(async (id: string, limit = 200) =>
    store.filter((r) => r.playthroughId === id && !r.archived).slice(0, limit),
  ),
  kvGet: jest.fn(async (key: string) => kv.get(key) ?? null),
  kvSet: jest.fn(async (key: string, value: string) => {
    kv.set(key, value);
  }),
}));

import {
  consolidateMemories,
  FOLD_AT_EPISODES,
  logEpisode,
  putMemory,
  recallForTurn,
  rememberMany,
  rememberPreferences,
} from '../src/lib/memory';

beforeEach(() => {
  store.length = 0;
  kv.clear();
  reinforceCalls = [];
});

describe('write path', () => {
  test('story facts land, junk and PII are refused', async () => {
    expect(await putMemory('pt1', 'story', 'Myra ne Aarav se dosti ki', 3)).toBe('inserted');
    expect(await putMemory('pt1', 'story', 'ok', 3)).toBe('skipped');
    expect(await putMemory('pt1', 'story', 'mera number +91 98765 43210 hai', 3)).toBe('skipped');
    expect(await putMemory('pt1', 'story', 'call 9876543210', 3)).toBe('skipped');
    expect(await putMemory('pt1', 'story', 'Subah 7 baje, chapter 4 ka scene', 3)).toBe('inserted');
    expect(store).toHaveLength(2);
    expect(store[0].importance).toBe(3);
  });

  test('a repeated fact reinforces instead of duplicating', async () => {
    expect(await rememberMany('pt1', ['Kabir late aaya', 'kabir  late aaya.'], 'story', 3)).toBe(2);
    expect(store).toHaveLength(1);
    expect(store[0].importance).toBe(4);
  });

  test('per-turn notes are capped at 8', async () => {
    const notes = Array.from({ length: 20 }, (_, i) => `fact ${i} about the fest`);
    expect(await rememberMany('pt1', notes, 'story', 3)).toBe(8);
  });

  test('preferences are stored under the global scope', async () => {
    await rememberPreferences('mujhe chai pasand hai');
    expect(store.every((r) => r.playthroughId === '*')).toBe(true);
    expect(store[0].kind).toBe('preference');
  });

  test('every turn leaves an episodic line', async () => {
    await logEpisode('pt1', 'Main stage par chala gaya', 'Myra: "Pagal hai kya?"');
    expect(store).toHaveLength(1);
    expect(store[0].kind).toBe('episode');
    expect(store[0].text).toContain('Main stage par chala gaya');
    expect(store[0].importance).toBe(1);
  });
});

describe('recall', () => {
  test('digest + preferences are pinned, used rows get reinforced', async () => {
    await putMemory('pt1', 'story', 'Haveli ka raaz: teeja kamora band hai', 4);
    await rememberPreferences('mujhe andhera pasand nahi');
    kv.set('memsum:pt1', 'Raj haveli mein fasa hai.');
    for (let i = 0; i < 40; i++) await logEpisode('pt1', `baat ${i}`, `jawab ${i} about tea and lights`);

    const r = await recallForTurn('pt1', 'teeja kamore ka raaz kya tha?');
    expect(r.summary).toBe('Raj haveli mein fasa hai.');
    expect(r.memories.some((m) => m.kind === 'preference')).toBe(true);
    expect(r.memories.some((m) => m.text.includes('teeja kamora'))).toBe(true);
    expect(reinforceCalls[0]).toHaveLength(r.memories.length);
  });

  test('archived rows never resurface', async () => {
    const e = await putMemory('pt1', 'story', 'Myra ne chai pilayi', 3);
    expect(e).toBe('inserted');
    store[0].archived = true;
    const r = await recallForTurn('pt1', 'Myra chai');
    expect(r.memories).toHaveLength(0);
  });
});

describe('consolidation', () => {
  async function seedEpisodes(n: number) {
    for (let i = 0; i < n; i++) {
      await logEpisode('pt1', `Raj ne chapter ${i} mein cup toda`, `Myra: "Case ${i} ab khatam."`);
    }
  }

  test('nothing folds before the threshold', async () => {
    await seedEpisodes(10);
    const out = await consolidateMemories('pt1');
    expect(out.folded).toBe(0);
    expect(kv.size).toBe(0);
  });

  test('folds the oldest lines into a digest, keeping the newest live', async () => {
    await seedEpisodes(FOLD_AT_EPISODES);
    const out = await consolidateMemories('pt1');
    expect(out.folded).toBeGreaterThan(0);
    expect(out.usedAI).toBe(false);
    const digest = kv.get('memsum:pt1') ?? '';
    expect(digest).toContain('chapter 0');
    const live = store.filter((r) => r.kind === 'episode' && !r.archived).length;
    expect(live).toBeLessThan(FOLD_AT_EPISODES);
    expect(store.every((r) => r.text.length > 0)).toBe(true); // never deleted, only archived
  });

  test('an AI digest is preferred when it comes back', async () => {
    await seedEpisodes(FOLD_AT_EPISODES);
    const out = await consolidateMemories('pt1', async () => `- merged digest line one\n- Raj ne maafi maangi`);
    expect(out.usedAI).toBe(true);
    expect(kv.get('memsum:pt1')).toContain('merged digest line one');
  });

  test('a failing summariser falls back without losing the fold', async () => {
    await seedEpisodes(FOLD_AT_EPISODES);
    const out = await consolidateMemories('pt1', async () => {
      throw new Error('rate_limit');
    });
    expect(out.folded).toBeGreaterThan(0);
    expect(out.usedAI).toBe(false);
    expect((kv.get('memsum:pt1') ?? '').length).toBeGreaterThan(0);
  });

  test('digest keeps merging instead of overwriting, and stays inside budget', async () => {
    await seedEpisodes(FOLD_AT_EPISODES);
    await consolidateMemories('pt1');
    const first = kv.get('memsum:pt1') ?? '';
    await seedEpisodes(FOLD_AT_EPISODES);
    await consolidateMemories('pt1');
    const second = kv.get('memsum:pt1') ?? '';
    expect(second.length).toBeGreaterThan(first.length);
    expect(second.length).toBeLessThanOrEqual(1800);
  });

  test('curated facts fold only once they overflow the pool', async () => {
    for (let i = 0; i < 300; i++) await putMemory('pt1', 'story', `old fact ${i} about the fest night`, 3);
    await seedEpisodes(FOLD_AT_EPISODES);
    const out = await consolidateMemories('pt1');
    expect(out.folded).toBeGreaterThan(30);
    const liveFacts = store.filter((r) => r.kind === 'story' && !r.archived).length;
    expect(liveFacts).toBeLessThan(300);
  });
});
