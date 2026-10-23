/**
 * v2.11.0 — "memory system extreme level" (owner request).
 *
 *  1. The record-keeper now classifies what HAPPENED (typed events with
 *     participants + importance), relationship changes, who-learned-what,
 *     decisions, secrets and each character's heart — and the archive stores
 *     all of it (before, only a regex detector fed the typed archive).
 *  2. v2.10.3 promise objects {by,to,what} reach the archive with participants.
 *  3. Character hearts: feeling / wants / unforgettable moments, rendered for
 *     the narrator.
 *  4. Saga: chapters are never dropped — older ones fold into "the book so
 *     far" and an archive that "yaad hai…?" turns can search.
 *  5. Bigger verbatim window (30 chats) and deeper recall on recall turns.
 */
import fs from 'node:fs';
import fsPath from 'node:path';

const kv = new Map<string, string>();
jest.mock('../src/lib/db', () => ({
  kvGet: jest.fn(async (k: string) => kv.get(k) ?? null),
  kvSet: jest.fn(async (k: string, v: string) => void kv.set(k, v)),
  kvDelete: jest.fn(async (k: string) => void kv.delete(k)),
  getDb: jest.fn(async () => ({ runAsync: async () => undefined, getAllAsync: async () => [], getFirstAsync: async () => null })),
  insertMemory: jest.fn(async () => 'inserted'),
  reinforceMemories: jest.fn(async () => undefined),
  restoreMemory: jest.fn(async () => undefined),
}));

import {
  buildPrivateNotes,
  buildStateExtractionMessages,
  isRecallQuery,
  MAX_SHORT_TERM_WINDOW,
  PROMPT_CHAPTERS_SHOWN,
  RECENT_CHAT_TURNS,
  shortTermWindowOf,
} from '../src/lib/engine';
import { toStateUpdate, validateExtraction } from '../src/lib/memoryEngine';
import {
  applyHeartChanges,
  applyWorldStateUpdate,
  createInitialWorldState,
  MAX_HEART_MOMENTS,
  renderWorldStateForPrompt,
  type WorldState,
} from '../src/lib/worldState';
import { contextFromBundle, createStoryMemoryEngine } from '../src/lib/storyMemory';
import { createInMemoryStoryMemoryStore } from '../src/lib/storyMemoryStore';
import { parseProposedState, RECORD_KEEPER_EVENT_TYPES } from '../src/lib/storyMemoryCore';
import {
  closeChapter,
  fallbackSagaText,
  getChapterBook,
  getChapters,
  PROMPT_CHAPTERS,
  SAGA_FOLD_AT,
  SAGA_MAX_CHARS,
  searchChapterArchive,
  searchChapters,
  type Chapter,
} from '../src/lib/chapters';
import type { CharactersFile, ChatMessage, MemoryFile, Playthrough, ScenesFile, StoryBundle, StoryFile, StoryMeta, WorldFile } from '../src/types';
import { KISSA_OWNER_CREATOR, createInitialState } from '../src/types';

const ROOT = fsPath.join(__dirname, '..');
const ID = 'dulhan-bhagi-shadi-se';
const pack = <T,>(f: string): T => JSON.parse(fs.readFileSync(fsPath.join(ROOT, 'content/stories', ID, f), 'utf8')) as T;
const manifest = JSON.parse(fs.readFileSync(fsPath.join(ROOT, 'content/manifest.json'), 'utf8')) as { stories: StoryMeta[] };
const bundle: StoryBundle = {
  meta: manifest.stories.find((s) => s.id === ID)!,
  story: pack<StoryFile>('story.json'),
  characters: pack<CharactersFile>('characters.json'),
  world: pack<WorldFile>('world.json'),
  scenes: pack<ScenesFile>('scenes.json'),
  memory: pack<MemoryFile>('memory.json'),
  source: 'bundled',
  creator: KISSA_OWNER_CREATOR,
} as StoryBundle;
const pt = {
  id: 'px1', storyId: ID, label: 'Journey 1', status: 'active', currentSceneId: bundle.story.openingSceneId,
  state: createInitialState(), progress: 0, messageCount: 12, endingId: null, mode: 'ai', providerId: null,
  createdAt: '2026-10-23T00:00:00Z', updatedAt: '2026-10-23T00:00:00Z',
} as unknown as Playthrough;

const ctx = contextFromBundle(bundle, { playerName: 'Ankit' });

/* ------------------------------------------------------------------ */

describe('record-keeper asks for the full archive', () => {
  const sys = buildStateExtractionMessages({ bundle, playthrough: pt, userText: 'x', assistantText: 'y', playerName: 'Ankit' })[0].content;
  test.each(['"events"', '"relationshipStatus"', '"characterKnowledge"', '"decisions"', '"secrets"', '"hearts"', '"promises"'])('schema has %s', (k) => {
    expect(sys).toContain(k);
  });
  test('event types and statuses come from the archive vocabulary', () => {
    for (const t of RECORD_KEEPER_EVENT_TYPES) expect(sys).toContain(t);
    expect(sys).toContain('broken_up');
    expect(sys).toContain('ARCHIVE RULES');
    expect(sys).toMatch(/Never guess/);
  });
});

describe('parseProposedState reads the new keys', () => {
  test('typed events: type validated, names → ids, importance clamped', () => {
    const p = parseProposedState(
      {
        events: [
          { type: 'emotional', summary: 'Riya ne Ankit ko pehli baar gale lagaya station par', who: ['Riya', 'player'], importance: 3 },
          { type: 'kiss-ish nonsense', summary: 'Gappu ne Ankit ko apni nayi bike dikhai', who: ['gappu'], importance: 9 },
          { type: 'conflict', summary: 'short', who: [] },
        ],
      },
      ctx,
    );
    expect(p.events).toHaveLength(2);
    expect(p.events[0]).toMatchObject({ type: 'emotional', importance: 3 });
    expect(p.events[0].participants).toEqual(expect.arrayContaining(['riya', ctx.playerId]));
    expect(p.events[1]).toMatchObject({ type: 'other', importance: 4, participants: ['gappu'] });
  });

  test('promise objects become readable archive promises with participants', () => {
    const p = parseProposedState({ promises: [{ by: 'riya', to: 'player', what: 'kal subah mandir saath chalegi' }] }, ctx);
    expect(p.promises[0]).toMatch(/Riya Chaturvedi → Ankit: kal subah mandir saath chalegi/);
    expect(p.promiseParticipants[0]).toEqual(expect.arrayContaining(['riya', ctx.playerId]));
  });

  test('knowledge keeps its source', () => {
    const p = parseProposedState({ characterKnowledge: [{ characterId: 'ajay', fact: 'Ajay ko pata chal gaya ki Riya Ankit ke ghar ruki thi', source: 'told' }] }, ctx);
    expect(p.knowledge[0]).toMatchObject({ characterId: 'ajay', source: 'told' });
  });
});

describe('archive stores the record-keeper events', () => {
  test('LLM events land in story_events with participants, pair keys and high confidence — and are recallable', async () => {
    const store = createInMemoryStoryMemoryStore();
    const engine = createStoryMemoryEngine(store);
    await engine.writeTurn({
      playthrough: pt,
      bundle,
      userText: 'Riya, tum theek ho? Main hoon na.',
      assistantText: '*Riya ki aankhen bhar aati hain.* Riya Chaturvedi: "Tum ho toh sab theek hai."',
      parsedState: {
        events: [{ type: 'emotional', summary: 'Riya ne station par Ankit ke kandhe par sar rakh ke roya aur kaha tum ho toh sab theek hai', who: ['riya', 'player'], importance: 3 }],
        decisions: ['Riya ne decide kiya ki woh ghar wapas nahi jayegi'],
        promises: [{ by: 'player', to: 'riya', what: 'Ankit kabhi Riya ko akela nahi chhodega' }],
      },
      messageIds: ['u1', 'a1'],
      location: 'Railway station',
      storyDay: 1,
      playerName: 'Ankit',
    });
    const events = await store.listEvents(pt.id);
    const emo = events.find((e) => e.type === 'emotional' && /kandhe/.test(e.summary));
    expect(emo).toBeDefined();
    expect(emo!.confidence).toBe('high');
    expect(emo!.importance).toBe(3);
    expect(emo!.participants).toEqual(expect.arrayContaining(['riya']));
    expect(emo!.pairKeys.length).toBeGreaterThan(0);
    const promise = events.find((e) => e.type === 'promise');
    expect(promise?.participants).toEqual(expect.arrayContaining(['riya']));
    expect(events.some((e) => e.type === 'decision' && /ghar wapas/.test(e.summary))).toBe(true);

    const found = await engine.memorySearch({
      storyId: pt.storyId, playthroughId: pt.id, query: 'yaad hai station par Riya kyun royi thi?', characters: ['riya'],
      relationshipPair: null, sceneId: null, limit: 10, currentSeq: 30,
    } as any);
    expect(found.events.some((e) => /kandhe/.test(e.summary))).toBe(true);
  });

  test('the same event is not stored twice when the detector already caught it', async () => {
    const store = createInMemoryStoryMemoryStore();
    const engine = createStoryMemoryEngine(store);
    const turn = (s: unknown) =>
      engine.writeTurn({ playthrough: pt, bundle, userText: 'ok', assistantText: 'Riya Chaturvedi: "Haan."', parsedState: s, messageIds: ['u', 'a'], playerName: 'Ankit' });
    const ev = { type: 'conflict', summary: 'Ajay ne Ankit ka gala pakda aur dhamki di ki Riya se door rahe', who: ['ajay'], importance: 3 };
    await turn({ events: [ev, ev] });
    const events = await store.listEvents(pt.id);
    expect(events.filter((e) => /gala pakda/.test(e.summary))).toHaveLength(1);
  });
});

describe('character hearts', () => {
  const base = createInitialWorldState(pt, bundle);

  test('validate → update → apply → render', () => {
    const raw = validateExtraction({
      hearts: { riya: { feeling: 'pehli baar safe mehsoos kar rahi hai', wants: 'Ankit uska haath na chhode', moment: 'station par Ankit ne apni jacket odhaai' } },
    });
    expect(raw?.hearts?.riya?.feeling).toMatch(/safe/);
    const update = toStateUpdate(raw!, base, null);
    expect(update.heartsPatch).toBeDefined();
    const ws = applyWorldStateUpdate(applyWorldStateUpdate(base, { presentCharacters: ['riya'], confidence: 'high' }), update);
    expect(ws.hearts?.riya?.moments).toEqual(['station par Ankit ne apni jacket odhaai']);
    const text = renderWorldStateForPrompt(ws);
    expect(text).toContain('Inside their hearts');
    expect(text).toMatch(/Riya Chaturvedi — feels: pehli baar safe/);
    expect(text).toMatch(/never forgets: "station par Ankit ne apni jacket odhaai"/);
  });

  test('names resolve to ids, the reader never owns a heart, moments dedupe + cap keeping the first', () => {
    let h = applyHeartChanges({}, { Riya: { moment: 'pehli mulaqat shaadi ke mandap se bhaagte hue' }, player: { feeling: 'x' } }, 1, base.characterStates);
    expect(Object.keys(h)).toEqual(['riya']);
    h = applyHeartChanges(h, { riya: { moment: 'pehli mulaqat shaadi ke mandap se bhaagte hue' } }, 2, base.characterStates);
    expect(h.riya.moments).toHaveLength(1);
    const distinct = [
      'station par jacket odhaai', 'dhaba par pehla paratha khilaya', 'truck mein uske kandhe par soyi', 'mandir mein chhupkar haath pakda',
      'Ajay ke saamne usko bachaya', 'baarish mein naachti rahi', 'raat bhar taare ginte rahe', 'nadi kinare pehla kiss',
      'chudiyan wapas pehnaayi', 'dadi ki kahani sunaayi',
    ];
    for (let i = 0; i < distinct.length; i++) h = applyHeartChanges(h, { riya: { moment: distinct[i] } }, 3 + i, base.characterStates);
    expect(h.riya.moments.length).toBe(MAX_HEART_MOMENTS);
    expect(h.riya.moments[0]).toMatch(/pehli mulaqat/);
  });

  test('older saved world states without hearts still render', () => {
    const old = { ...base } as WorldState;
    delete (old as any).hearts;
    expect(() => renderWorldStateForPrompt(old)).not.toThrow();
  });
});

describe('saga — chapters are never lost', () => {
  const msgs = (n: number, tag: string): ChatMessage[] =>
    Array.from({ length: 4 }, (_, i) => ({
      id: `${tag}${i}`, playthroughId: 'saga1', role: i % 2 ? 'assistant' : 'user', speaker: i % 2 ? 'Riya Chaturvedi' : null,
      text: `${tag} beat ${i} ${n}`, sceneId: null, createdAt: new Date(2026, 9, 1, 0, n, i).toISOString(),
    })) as ChatMessage[];

  test('older chapters fold into the saga + archive; the prompt keeps the newest ones', async () => {
    kv.clear();
    const summarize = jest.fn(async (p: string) =>
      p.startsWith('You keep "the book so far"')
        ? 'Ankit aur Riya mandap se bhaage, station par ruke, Riya ne pehli baar uska haath pakda, Ajay unke peeche pada hai, sab kuch kram se yaad hai.'
        : 'Chapter summary: kuch hua jo yaad rakhna zaroori hai aur aage kaam aayega.',
    );
    const topics = ['Mandap se bhaagna', 'Station par raat', 'Dhaba wala nashta', 'Ajay ka peecha', 'Mandir mein chhupna', 'Riya ka sach'];
    for (let i = 0; i < topics.length; i++) {
      await closeChapter({ playthroughId: 'saga1', title: topics[i], sceneId: null, messageCount: (i + 1) * 24, messages: msgs(i, `c${i}`), summarize });
    }
    const book = await getChapterBook('saga1');
    expect(book.chapters).toHaveLength(PROMPT_CHAPTERS);
    expect(book.chapters[0].title).toBe(topics[2]);
    expect(book.total).toBe(6);
    expect(book.saga?.text).toMatch(/mandap se bhaage/);
    expect(book.saga?.chapterCount).toBe(2);
    expect(book.saga?.coversThroughAtTurn).toBe(48);
    expect(await getChapters('saga1')).toHaveLength(PROMPT_CHAPTERS);
    const raw = JSON.parse(kv.get('memchap:saga1')!);
    expect(raw.archive.map((c: Chapter) => c.title)).toEqual(['Mandap se bhaagna', 'Station par raat']);
  });

  test('every closed chapter is either shown in full or inside the saga (no gap)', () => {
    expect(PROMPT_CHAPTERS_SHOWN).toBe(PROMPT_CHAPTERS);
    expect(SAGA_FOLD_AT).toBe(PROMPT_CHAPTERS + 1);
  });

  test('without an AI the saga is built deterministically and stays bounded', async () => {
    for (let i = 0; i < 12; i++) {
      await closeChapter({ playthroughId: 'saga2', title: `Chapter ${i + 1}`, sceneId: null, messageCount: (i + 1) * 24, messages: msgs(i, `d${i}`) });
    }
    const book = await getChapterBook('saga2');
    expect(book.saga?.text.length).toBeGreaterThan(20);
    expect(book.saga!.text.length).toBeLessThanOrEqual(SAGA_MAX_CHARS);
    expect(book.saga?.text).toMatch(/Chapter 1:/); // the beginning survives
    expect(book.total).toBe(12);
    const long = fallbackSagaText('x'.repeat(2000), [{ title: 'T', text: 'y. z', atTurn: 1, sceneId: null, createdAt: '' }]);
    expect(long.length).toBeLessThanOrEqual(SAGA_MAX_CHARS);
  });

  test('deep recall finds an archived chapter by meaning', async () => {
    const chapters: Chapter[] = [
      { title: 'Station par raat', text: 'Riya ne thand mein Ankit ki jacket pehni aur pehli baar hasi.', atTurn: 24, sceneId: null, createdAt: '' },
      { title: 'Dhaba', text: 'Gappu ne paratha khilaya aur truck ka intezaam kiya.', atTurn: 48, sceneId: null, createdAt: '' },
    ];
    expect(searchChapters(chapters, 'yaad hai station par jacket wali raat?')[0].title).toBe('Station par raat');
    expect(searchChapters(chapters, 'hello')).toEqual([]);
    expect(await searchChapterArchive('saga1', 'mandap se bhaagna yaad hai', 2)).toHaveLength(1);
  });

  test('saga, recalled chapters and the recall rule reach the private notes', () => {
    const notes = buildPrivateNotes({
      bundle, playthrough: pt, memories: [], history: [], profile: { nickname: 'Ankit', ageGroup: '18+' },
      saga: 'Ankit aur Riya mandap se bhaage.', recalledChapters: [{ title: 'Station par raat', text: 'Jacket wali raat.' }], recallIntent: true,
    } as any);
    expect(notes).toContain('THE BOOK SO FAR');
    expect(notes).toContain('Ankit aur Riya mandap se bhaage.');
    expect(notes).toContain('OLD CHAPTERS THIS TURN IS ABOUT');
    expect(notes).toContain('RECALL TURN');
    const plain = buildPrivateNotes({ bundle, playthrough: pt, memories: [], history: [], profile: { nickname: 'Ankit', ageGroup: '18+' } } as any);
    expect(plain).not.toContain('RECALL TURN');
    expect(plain).not.toContain('THE BOOK SO FAR');
  });
});

describe('bigger windows + recall intent', () => {
  test('30 chats verbatim by default, window up to 72 rows', () => {
    expect(RECENT_CHAT_TURNS).toBe(30);
    expect(shortTermWindowOf(bundle)).toBeGreaterThanOrEqual(60);
    expect(MAX_SHORT_TERM_WINDOW).toBe(72);
  });
  test.each([
    'yaad hai hum pehli baar kahan mile the?',
    'Tumne kya kaha tha us raat?',
    'remember the ring?',
    'pichli baar kya hua tha',
    'bhool gayi kya',
    'tumne waada kiya tha',
  ])('recall: %s', (q) => expect(isRecallQuery(q)).toBe(true));
  test.each(['chalo chai peete hain', 'Riya ka haath pakad ke chalta hoon', 'kitna sundar mausam hai'])('not recall: %s', (q) =>
    expect(isRecallQuery(q)).toBe(false),
  );
});
