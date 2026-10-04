/**
 * v2.5.1 — manual QA, automated.
 *
 * The spec's §32 asks for two hand-played stories: STORY A (MC + Poonam) and
 * STORY B (MC + Bhabhi), each checked for scene changes, app reload, returning
 * characters, old events, relationship state, important conversations,
 * long-distance retrieval and cross-story isolation. This file is that session,
 * replayed through the real engine so it can be re-run on every release.
 */
import type { ChatMessage, Playthrough, StoryBundle } from '../src/types';
import { KISSA_OWNER_CREATOR, createInitialState } from '../src/types';
import { createStoryMemoryEngine, pairKeyOf, PLAYER_ID, type StoryMemoryEngine } from '../src/lib/storyMemory';
import { createInMemoryStoryMemoryStore, type InMemoryStoryMemoryStore } from '../src/lib/storyMemoryStore';

function bundle(storyId: string, chars: { id: string; name: string }[]): StoryBundle {
  return {
    meta: { id: storyId, title: storyId, accentColor: '#f0a', cover: 'c.png', storyDir: storyId },
    story: {
      storyId, title: storyId, premise: 'QA scenario.', tone: 'warm', userRole: 'MC',
      setting: 'Rampur', openingSceneId: 's1', tags: [], safetyNotes: [],
    },
    characters: {
      storyId, version: 1,
      characters: chars.map((c) => ({
        id: c.id, name: c.name, role: 'QA character.', personality: 'Grounded.', background: '',
        goals: [], fears: [], likes: [], dislikes: [], speakingStyle: 'Hinglish.',
        sampleLine: 'Hmm.', relationshipWithUser: 'Newly met.', knowledge: [],
      })),
    },
    world: {
      storyId, version: 1, premise: 'Rampur',
      locations: [{ name: 'Rampur veranda', description: '' }, { name: 'Bazaar', description: '' }],
      rules: [], lore: [],
    },
    scenes: { storyId, version: 1, scenes: [{ id: 's1', title: 'Veranda', narration: ['Chai.'], fallbackLines: [], choices: [] }], endings: [] },
    memory: { storyId, version: 1, shortTermWindow: 24, seedMemories: [], extractionHints: [], neverRemember: [] },
    source: 'bundled',
    creator: KISSA_OWNER_CREATOR,
  } as unknown as StoryBundle;
}

class Session {
  store: InMemoryStoryMemoryStore;
  engine: StoryMemoryEngine;
  pt: Playthrough;
  bundle: StoryBundle;
  private n = 0;

  constructor(id: string, b: StoryBundle) {
    this.store = createInMemoryStoryMemoryStore();
    this.engine = createStoryMemoryEngine(this.store);
    this.bundle = b;
    this.pt = {
      id, storyId: b.meta.id, label: id, status: 'active', currentSceneId: 's1',
      state: createInitialState(), progress: 0, messageCount: 0, endingId: null,
      mode: 'ai', providerId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }

  async say(user: string, narrator: string, location = 'Rampur veranda'): Promise<void> {
    this.n++;
    const userMsg: ChatMessage = {
      id: `${this.pt.id}-u${this.n}`, playthroughId: this.pt.id, role: 'user', speaker: 'Ankit',
      text: user, sceneId: 's1', createdAt: new Date(s1(2026, this.n * 2)).toISOString(),
    };
    const botMsg: ChatMessage = {
      id: `${this.pt.id}-b${this.n}`, playthroughId: this.pt.id, role: 'assistant', speaker: null,
      text: narrator, sceneId: 's1', createdAt: new Date(s1(2026, this.n * 2 + 1)).toISOString(),
    };
    this.store._data.messages.push(
      { id: userMsg.id, role: 'user', speaker: userMsg.speaker, text: user, createdAt: userMsg.createdAt },
      { id: botMsg.id, role: 'assistant', speaker: botMsg.speaker, text: narrator, createdAt: botMsg.createdAt },
    );
    await this.engine.writeTurn({
      playthrough: this.pt, bundle: this.bundle, playerName: 'Ankit',
      userText: user, assistantText: narrator, messageIds: [userMsg.id, botMsg.id],
      location, storyDay: Math.ceil(this.n / 3),
    });
  }

  ask(query: string, characters: string[] = [], pair?: string) {
    return this.engine.memorySearch({
      storyId: this.pt.storyId, playthroughId: this.pt.id, query, characters,
      relationshipPair: pair ?? null, limit: 12,
    });
  }
}

/** Deterministic timestamps: minute `m` of a fixed hour. */
function s1(_y: number, m: number): number {
  return Date.parse('2026-03-01T10:00:00.000Z') + m * 60_000;
}

describe('manual QA — Story A: MC + Poonam (arranged marriage wala love)', () => {
  const b = bundle('arranged-marriage-wala-love', [
    { id: 'poonam', name: 'Poonam' },
    { id: 'bhabhi', name: 'Bhabhi' },
  ]);
  let s: Session;

  beforeAll(async () => {
    s = new Session('qaPoonam', b);
    // Scene 1 — first meeting on the veranda.
    await s.say('Namaste, main Ankit hoon.', 'Poonam: "Ji namaste. Aap chai lenge?"');
    // Scene 2 — a serious conversation, then a promise.
    await s.say(
      'Poonam, main tumhari padhai ka khayal rakhunga.',
      'Poonam: "Mujhe apni padhai pasand hai."\nAnkit: "Wada, main tumhara saath dunga."',
    );
    await s.say('Kasam se, main wada nibhaunga.', 'Poonam: "Mujhe tumpe bharosa hai."');
    // Scene 3 — bazaar, different location.
    await s.say('Chalo bazaar chalte hain.', 'Poonam: "Theek hai, saath chalungi."', 'Bazaar');
    // Scene 4 — the wedding.
    await s.say(
      'Aaj humari shaadi ho gayi, Poonam meri biwi hai.',
      '*Saat phere poore hue.*\nPoonam: "Ab hum ek ho gaye."',
      'Rampur veranda',
    );
    // Scene 5 onwards — a long married life.
    for (let i = 0; i < 40; i++) {
      await s.say(
        `Aaj humne ghar ki nayi baat discuss ki (${i}).`,
        `Poonam: "Shaadi ke baad sab kuch badal gaya (${i})."`,
      );
    }
    // Scene 46 — a lazy reply that pretends they just met.
    await s.say('Kaun ho tum?', 'Poonam: "Hum to abhi abhi mile hain, sirf pehchaan hai."');
  });

  test('after 45+ scenes the marriage is still the current state', async () => {
    const rel = await s.store.getRelationship(s.pt.id, pairKeyOf(PLAYER_ID, 'poonam'));
    expect(rel?.status).toBe('married');
    const history = rel!.history;
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1].status).toBe('married');
    // Closeness never goes backwards on a lie: a late "we just met" cannot
    // demote an established marriage.
    const tiers = history.map((h) => h.tier);
    expect(tiers).toEqual([...tiers].sort((a, x) => a - x));
    // The wrong "we just met" reply was rejected, not applied.
    expect((await s.store.listContradictions(s.pt.id)).length).toBeGreaterThan(0);
  });

  test('the first-meeting promise from scene 2 is still retrievable', async () => {
    const res = await s.ask('Poonam se pehle kya waada hua tha?', ['poonam']);
    const text = res.events.map((e) => e.summary.toLowerCase()).join(' | ');
    expect(text).toMatch(/wada|kasam|bharosa/);
    expect(res.relationships.map((r) => r.status)).toContain('married');
  });

  test('after a reload (new engine, same store) everything is still there', async () => {
    const reloaded = createStoryMemoryEngine(s.store);
    const rel = await reloaded.memorySearch({
      storyId: s.pt.storyId, playthroughId: s.pt.id, query: 'Poonam rishta', characters: ['poonam'],
    });
    expect(rel.relationships.map((r) => r.status)).toContain('married');
    expect(rel.events.length).toBeGreaterThan(0);
  });
});

describe('manual QA — Story B: MC + Bhabhi', () => {
  const b = bundle('bhabi-ka-ladla-devar', [
    { id: 'bhabhi', name: 'Bhabhi' },
    { id: 'poonam', name: 'Poonam' },
  ]);
  let s: Session;

  beforeAll(async () => {
    s = new Session('qaBhabhi', b);
    await s.say('Bhabhi, aaj kya pakaya?', 'Bhabhi: "Arre, tumhare liye kuch khaas."');
    // The important conversation.
    await s.say(
      'Bhabhi, mujhe sach batao.',
      'Bhabhi: "Maine ek raaz chhupaya hai, sirf tumhe bata rahi hoon. Kisi ko mat batana."',
    );
    await s.say('Waada, kisi ko nahi bataunga.', 'Bhabhi: "Kasam se? Achha."');
    // Poonam scenes take over.
    for (let i = 0; i < 30; i++) {
      await s.say(`Poonam, aaj padhai kaisi rahi (${i})?`, 'Poonam: "Achhi rahi, tum sunao."');
    }
    // Bhabhi returns much later.
    await s.say('Bhabhi, main wapas aa gaya.', 'Bhabhi: "Arre! Woh baat yaad hai mujhe."');
  });

  test('the MC–Bhabhi secret conversation survives 30+ intervening scenes', async () => {
    const res = await s.ask('Bhabhi ke saath pehle kya hua tha?', ['bhabhi'], pairKeyOf(PLAYER_ID, 'bhabhi'));
    expect(res.events.length).toBeGreaterThan(0);
    expect(res.events.some((e) => /raaz|chhupaya|secret/i.test(e.summary))).toBe(true);
    expect(res.events.some((e) => e.pairKeys.includes(pairKeyOf(PLAYER_ID, 'bhabhi')))).toBe(true);
  });

  test('Story A memory never appears in Story B', async () => {
    const res = await s.ask('Poonam ki shaadi hui thi?', ['poonam']);
    expect(res.events.every((e) => e.storyId === b.meta.id)).toBe(true);
    expect(res.events.some((e) => /shaadi ho gayi.*biwi/i.test(e.summary))).toBe(false);
  });

  test('knowledge is attributed: only Bhabhi knows her secret, not Poonam', async () => {
    const knowledge = await s.store.listKnowledge(s.pt.id);
    const bhabhiKnows = knowledge.filter((k) => k.characterId === 'bhabhi' && /raaz|chhupaya/i.test(k.fact));
    const poonamKnows = knowledge.filter((k) => k.characterId === 'poonam' && /raaz|chhupaya/i.test(k.fact));
    expect(bhabhiKnows.length).toBeGreaterThan(0);
    expect(poonamKnows.length).toBe(0);
  });
});
