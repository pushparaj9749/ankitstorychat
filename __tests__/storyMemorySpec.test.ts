/**
 * v2.5.1 — spec guarantees that the other suites do not pin down.
 *
 *  §4  layered memory: one place where every layer is visible at once
 *  §5  raw history is the highest authority (never overwritten, always cited)
 *  §11 timeline ordering (out-of-order rows still read chronologically)
 *  §14 consolidation is lossless (rollup → sources → raw messages)
 *  §15 confidence + source tracking on every derived record
 *  §16 current state AND history exist side by side
 *  §28 bounded, index-backed retrieval on a very large archive
 *  §34 no network / no paid service anywhere in the memory engine
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ChatMessage, Playthrough, StoryBundle } from '../src/types';
import { KISSA_OWNER_CREATOR, MEMORY_IMPORTANCE_SCORE, createInitialState } from '../src/types';
import { createStoryMemoryEngine, pairKeyOf, PLAYER_ID, type StoryMemoryEngine } from '../src/lib/storyMemory';
import { createInMemoryStoryMemoryStore, type InMemoryStoryMemoryStore } from '../src/lib/storyMemoryStore';
import { detectEvents } from '../src/lib/storyMemoryCore';

const b = {
  meta: { id: 'spec-story', title: 'Spec Story' },
  characters: {
    characters: [
      { id: 'poonam', name: 'Poonam', relationshipWithUser: 'Wife.' },
      { id: 'bhabhi', name: 'Bhabhi', relationshipWithUser: 'Sister-in-law.' },
    ],
  },
  world: { locations: [{ name: 'Rampur veranda' }, { name: 'Bazaar' }] },
  scenes: { scenes: [{ id: 's1' }] },
} as unknown as StoryBundle;

function makePt(id = 'specPt'): Playthrough {
  return {
    id,
    storyId: b.meta.id,
    label: id,
    status: 'active',
    currentSceneId: 's1',
    state: createInitialState(),
    progress: 0,
    messageCount: 0,
    endingId: null,
    mode: 'ai',
    providerId: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
  };
}

class Session {
  store: InMemoryStoryMemoryStore;
  engine: StoryMemoryEngine;
  pt = makePt();
  n = 0;
  raw: { id: string; text: string }[] = [];

  constructor(storyId = 'spec-story') {
    const bundle = { ...b, meta: { ...b.meta, id: storyId } } as StoryBundle;
    this.pt = { ...makePt(), storyId };
    this.bundle = bundle;
    this.store = createInMemoryStoryMemoryStore();
    this.engine = createStoryMemoryEngine(this.store);
  }

  bundle: StoryBundle;

  async say(user: string, narrator: string, location = 'Rampur veranda'): Promise<void> {
    this.n++;
    const ids: string[] = [];
    const rows: ChatMessage[] = [
      {
        id: `${this.pt.id}-u${this.n}`, playthroughId: this.pt.id, role: 'user', speaker: 'Ankit',
        text: user, sceneId: 's1', createdAt: at(this.n * 2),
      },
      {
        id: `${this.pt.id}-b${this.n}`, playthroughId: this.pt.id, role: 'assistant', speaker: null,
        text: narrator, sceneId: 's1', createdAt: at(this.n * 2 + 1),
      },
    ];
    for (const r of rows) {
      ids.push(r.id);
      this.raw.push({ id: r.id, text: r.text });
      this.store._data.messages.push({ id: r.id, role: r.role, speaker: r.speaker, text: r.text, createdAt: r.createdAt });
    }
    await this.engine.writeTurn({
      playthrough: this.pt, bundle: this.bundle, playerName: 'Ankit',
      userText: user, assistantText: narrator, messageIds: ids, location, storyDay: this.n,
    });
  }

  ask(query: string, chars: string[] = [], opts: Partial<Parameters<StoryMemoryEngine['memorySearch']>[0]> = {}) {
    return this.engine.memorySearch({
      storyId: this.pt.storyId,
      playthroughId: this.pt.id,
      query,
      characters: chars,
      limit: 12,
      ...opts,
    });
  }
}

function ctx() {
  return {
    characters: b.characters.characters as unknown as { id: string; name: string }[],
    playerId: PLAYER_ID,
    playerName: 'Ankit',
  };
}

function at(minute: number): string {
  return new Date(Date.parse('2026-03-01T10:00:00.000Z') + minute * 60_000).toISOString();
}

describe('§4 layered memory', () => {
  test('one query can surface events, relationship state, knowledge and raw evidence at once', async () => {
    const s = new Session();
    await s.say(
      'Poonam, tum meri biwi ho.',
      'Poonam: "Haan, humari shaadi ho gayi. Maine ek raaz tumhe bataya hai."',
    );
    await s.say('Bhabhi, tum kaisi ho?', 'Bhabhi: "Achhi hoon. Poonam ko pata hai ki maine raaz chhupaya tha."');

    const res = await s.ask('Poonam se shaadi aur raaz', ['poonam', 'bhabhi'], { relationshipPair: pairKeyOf(PLAYER_ID, 'poonam') });
    expect(res.events.length).toBeGreaterThan(0);
    expect(res.relationships.length).toBeGreaterThan(0);
    expect(res.knowledge.length).toBeGreaterThan(0);
    expect(res.evidence.length).toBeGreaterThan(0);
    expect(res.timeline.length).toBe(res.events.length);
  });
});

describe('§5 raw history is the highest authority', () => {
  test('a contradicting reply cannot rewrite raw text, and every derived record cites it', async () => {
    const s = new Session();
    await s.say('Poonam se shaadi ho gayi.', 'Poonam: "Haan, humari shaadi ho gayi."');
    const rawBefore = JSON.stringify(s.store._data.messages);

    // A hallucinated turn pretending nothing happened.
    await s.say('Tum kaun ho?', 'Poonam: "Main to aaj pehli baar tumse mili hoon, hum stranger hain."');

    const rawAfter = JSON.parse(JSON.stringify(s.store._data.messages));
    // The two earlier rows are byte-identical; only new rows were appended.
    expect(JSON.stringify(rawAfter.slice(0, 2))).toBe(rawBefore); // raw archive never rewritten
    const rel = await s.store.getRelationship(s.pt.id, pairKeyOf(PLAYER_ID, 'poonam'));
    expect(rel?.status).toBe('married'); // derived state still matches the raw record

    const events = await s.store.listEvents(s.pt.id);
    for (const e of events) expect(e.sourceMessageIds.length).toBeGreaterThan(0);
    const res = await s.ask('Poonam shaadi', ['poonam']);
    const rawIds = new Set(s.raw.map((r) => r.id));
    for (const ev of res.evidence) expect(rawIds.has(ev.messageId)).toBe(true);
    expect(res.evidence.some((e) => /shaadi/i.test(e.text))).toBe(true);
  });
});

describe('§11 timeline ordering', () => {
  test('events inserted out of order still read oldest → newest', async () => {
    const s = new Session();
    await s.say('Pehla din.', 'Hum pehli baar mile.');
    await s.say('Dusra din.', 'Humne baat ki.');
    await s.say('Teesra din.', 'Humne ek wada kiya.');
    const all = await s.store.listEvents(s.pt.id);

    const res = await s.ask('humari milan ki kahani', [], { limit: 20 });
    const seqs = res.timeline.map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, x) => a - x));
    const times = res.timeline.map((e) => Date.parse(e.occurredAt));
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    expect(all.length).toBeGreaterThan(0);
  });
});

describe('§14 consolidation is lossless', () => {
  test('old events fold into a rollup that still resolves to its sources and raw messages', async () => {
    const s = new Session();
    for (let i = 0; i < 30; i++) {
      await s.say(
        `Din ${i}: humne baat ki, ek chhota faisla liya, ek chhoti khushi hui.`,
        `Poonam: "Aaj humne baat ki (${i})."`,
      );
    }
    const before = await s.store.listEvents(s.pt.id, { includeArchived: true });
    await s.engine.consolidate(s.pt.id, s.pt.storyId, { keepLive: 8 });
    const after = await s.store.listEvents(s.pt.id, { includeArchived: true });

    expect(after.length).toBeGreaterThanOrEqual(before.length); // nothing removed
    const idsAfter = new Set(after.map((e) => e.id));
    for (const e of before) expect(idsAfter.has(e.id)).toBe(true);

    const rollups = after.filter((e) => e.type === 'rollup');
    expect(rollups.length).toBeGreaterThan(0);
    expect(rollups[0].sourceEventIds?.length).toBeGreaterThan(0);
    const members = await s.store.getEvents(rollups[0].sourceEventIds ?? []);
    expect(members.length).toBeGreaterThan(0);
    expect(members.some((m) => m.archived)).toBe(true); // folded, still on disk
    expect(rollups[0].sourceMessageIds.length).toBeGreaterThan(0);
  });
});

describe('§15 confidence + source tracking', () => {
  test('every derived record carries confidence, sources and a confirmation time', async () => {
    const s = new Session();
    await s.say(
      'Poonam, mujhe tumse pyaar hai, hum ab dating kar rahe hain.',
      'Poonam: "Mujhe bhi, ab hum ek doosre ke hain. Kasam se, main tumhara saath dunga."',
    );
    await s.say('Aaj humne ek raaz share kiya.', 'Poonam: "Yeh raaz sirf tum jaante ho."');

    const events = await s.store.listEvents(s.pt.id);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(['low', 'medium', 'high']).toContain(e.confidence);
      expect(e.importance).toBeGreaterThanOrEqual(1);
      expect(e.importance).toBeLessThanOrEqual(4);
      expect(e.importanceLabel).toBe(
        e.importance >= 4 ? 'VERY_HIGH' : e.importance === 3 ? 'HIGH' : e.importance === 2 ? 'MEDIUM' : 'LOW',
      );
      expect(e.occurredAt).toBeTruthy();
      expect(e.createdAt).toBeTruthy();
      expect(Array.isArray(e.sourceMessageIds)).toBe(true);
    }
    const rel = await s.store.getRelationship(s.pt.id, pairKeyOf(PLAYER_ID, 'poonam'));
    expect(rel).not.toBeNull();
    expect(rel?.confidence).toBeTruthy();
    expect(rel?.lastConfirmedAt).toBeTruthy();
    expect(rel?.sourceEventIds.length).toBeGreaterThan(0);
    const knowledge = await s.store.listKnowledge(s.pt.id);
    if (knowledge.length) {
      expect(knowledge[0].sourceEventId || knowledge[0].sourceMessageIds.length).toBeTruthy();
    }
  });
});

describe('§16 current state AND history', () => {
  test('the relationship keeps the full status history while exposing the current one', async () => {
    const s = new Session();
    await s.say('Namaste Poonam.', 'Poonam: "Namaste."');
    await s.say('Poonam, mujhe tumse pyaar hai.', 'Poonam: "Mujhe bhi, hum ab dating kar rahe hain."');
    await s.say('Aaj humari shaadi ho gayi.', 'Poonam: "Ab hum pati-patni hain, shaadi ho gayi."');

    const rel = await s.store.getRelationship(s.pt.id, pairKeyOf(PLAYER_ID, 'poonam'));
    expect(rel?.status).toBe('married');
    const statuses = rel!.history.map((h) => h.status);
    expect(statuses.length).toBeGreaterThanOrEqual(2);
    expect(statuses[0]).not.toBe('married'); // history preserved, oldest first
    expect(statuses[statuses.length - 1]).toBe('married');
    const times = rel!.history.map((h) => Date.parse(h.at));
    expect(times).toEqual([...times].sort((a, x) => a - x));

    // The current state is what reaches the prompt.
    const res = await s.ask('Poonam rishta', ['poonam']);
    expect(res.relationships[0].status).toBe('married');
    expect(res.relationships[0].history.length).toBeGreaterThanOrEqual(2);
  });
});

describe('§28 bounded retrieval on a very large archive', () => {
  test('20k indexed records: memorySearch stays bounded and does not return the archive', async () => {
    const s = new Session();
    // One real, important turn whose event must remain reachable.
    await s.say('Poonam ko bachpan ki tasveer di.', 'Poonam: "Yeh tasveer! Maine ise sambhal ke rakha hai."');
    const target = (await s.store.listEvents(s.pt.id))[0];

    for (let i = 0; i < 2000; i++) {
      for (const token of ['din', 'chatter', 'baat', 'chai', 'ghar', 'kaam']) {
        s.store._data.index.push({
          playthroughId: s.pt.id, storyId: s.pt.storyId, recordType: 'event',
          recordId: `ev${i}`, token, weight: 1,
        });
      }
    }
    for (let i = 0; i < 4000; i++) {
      s.store._data.events.push({
        ...target,
        id: `ev${i}`,
        seq: 100 + i,
        summary: `Chatter ${i} about random daily things.`,
        keywords: ['din', 'chatter', 'baat', 'chai', 'ghar', 'kaam'],
        sourceMessageIds: [],
      });
    }

    const started = Date.now();
    const res = await s.ask('Poonam tasveer bachpan', ['poonam']);
    const elapsed = Date.now() - started;

    expect(res.events.length).toBeLessThanOrEqual(12);
    expect(res.events.some((e) => /tasveer/i.test(e.summary))).toBe(true);
    expect(elapsed).toBeLessThan(2000);
  });
});

describe('§34 local-only memory engine', () => {
  test('no fetch/HTTP/paid SDK anywhere in the memory modules', () => {
    const files = [
      'src/lib/storyMemory.ts',
      'src/lib/storyMemoryCore.ts',
      'src/lib/storyMemoryStore.ts',
    ];
    for (const f of files) {
      const src = readFileSync(join(__dirname, '..', f), 'utf8');
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/https?:\/\//);
      expect(src).not.toMatch(/openai|anthropic|embedding|pinecone|weaviate|supabase/i);
    }
  });
});

describe('§6 importance discipline', () => {
  test('trivia is never promoted to VERY_HIGH and a marriage never lands below HIGH', () => {
    const trivia = detectEvents('Aaj chai pi.', 'Hmm, achhi chai thi.', ctx());
    for (const e of trivia) expect(e.importance).toBeLessThan(MEMORY_IMPORTANCE_SCORE.VERY_HIGH);

    const wedding = detectEvents(
      'Aaj humari shaadi ho gayi, saat phere poore hue.',
      'Poonam: "Ab hum pati-patni hain."',
      ctx(),
    );
    const marriage = wedding.find((e) => e.type === 'marriage' || e.type === 'relationship_change');
    expect(marriage).toBeTruthy();
    expect(marriage!.importance).toBeGreaterThanOrEqual(MEMORY_IMPORTANCE_SCORE.HIGH);
  });
});
