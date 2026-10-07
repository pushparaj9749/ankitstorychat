/**
 * KISSA v2.5.1 — Universal Extreme Memory Architecture tests.
 *
 * These exercise the REAL engine (src/lib/storyMemory.ts) against the real
 * pure core (src/lib/storyMemoryCore.ts) and the shipped in-memory store — no
 * story-specific rules and no mocks of the logic under test. Every scenario in
 * the v2.5.1 spec has a test here:
 *
 *  - scene-change persistence (MC + Bhabhi → Poonam scene → Bhabhi returns)
 *  - app restart persistence (a brand new engine over the same store)
 *  - relationship + marriage persistence, no silent reversion
 *  - character-pair memory, character knowledge, perspective
 *  - semantic retrieval (Hinglish/English paraphrase) + long-distance retrieval
 *  - timeline ordering, contradiction detection, validated transitions
 *  - story isolation, consolidation (raw rows kept), source tracking
 *  - migration of pre-v2.5.1 journeys, performance + bounded context
 */
import type {
  ChatMessage,
  Playthrough,
  StoryBundle,
} from '../src/types';
import { KISSA_OWNER_CREATOR, createInitialState } from '../src/types';
import {
  createStoryMemoryEngine,
  contextFromBundle,
  PLAYER_ID,
  STORY_MEMORY_VERSION,
  type StoryMemoryEngine,
} from '../src/lib/storyMemory';
import {
  createInMemoryStoryMemoryStore,
  type InMemoryStoryMemoryStore,
} from '../src/lib/storyMemoryStore';
import { detectEvents, validateTransition, pairKeyOf } from '../src/lib/storyMemoryCore';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function makeBundle(storyId = 'arranged-marriage-wala-love'): StoryBundle {
  return {
    meta: {
      id: storyId,
      title: 'Arranged Marriage Wala Love',
      accentColor: '#f0a',
      cover: 'cover.png',
      storyDir: storyId,
    },
    story: {
      storyId,
      title: 'Arranged Marriage Wala Love',
      premise: 'An arranged-marriage introduction in Rampur.',
      tone: 'warm',
      userRole: 'The adult MC.',
      setting: 'Rampur',
      openingSceneId: 's1',
      tags: [],
      safetyNotes: [],
    },
    characters: {
      storyId,
      version: 1,
      characters: [
        {
          id: 'poonam',
          name: 'Poonam',
          role: 'The young woman MC meets.',
          personality: 'Thoughtful.',
          background: 'Raised by her Chachaji.',
          goals: [],
          fears: [],
          likes: [],
          dislikes: [],
          speakingStyle: 'Gentle Hinglish.',
          sampleLine: 'Ji, aap chai lenge?',
          relationshipWithUser: 'Poonam is courteous but no romantic feeling is established.',
          knowledge: ['Poonam knows Krishnakant is her Chachaji.'],
        },
        {
          id: 'bhabhi',
          name: 'Bhabhi',
          role: "Rahul's wife.",
          personality: 'Warm and nosy.',
          background: 'Married into the family.',
          goals: [],
          fears: [],
          likes: [],
          dislikes: [],
          speakingStyle: 'Chatty Hinglish.',
          sampleLine: 'Arre, sab theek hai?',
          relationshipWithUser: 'Bhabhi is friendly with the family.',
          knowledge: 'Bhabhi knows the household routine.'.length ? ['Bhabhi knows the household routine.'] : [],
        },
      ],
    },
    world: {
      storyId,
      version: 1,
      premise: 'Rampur',
      locations: [
        { name: 'Rampur veranda', description: 'Cozy family veranda.' },
        { name: 'Bazaar', description: 'Busy market.' },
      ],
      rules: [],
      lore: [],
    },
    scenes: {
      storyId,
      version: 1,
      scenes: [{ id: 's1', title: 'Chai Aur Nazar', narration: ['Veranda.'], fallbackLines: [], choices: [] }],
      endings: [],
    },
    memory: {
      storyId,
      version: 1,
      shortTermWindow: 24,
      seedMemories: [],
      extractionHints: [],
      neverRemember: [],
    },
    source: 'bundled',
    creator: KISSA_OWNER_CREATOR,
  } as unknown as StoryBundle;
}

function makePlaythrough(id: string, storyId = 'arranged-marriage-wala-love'): Playthrough {
  return {
    id,
    storyId,
    label: id,
    status: 'active',
    currentSceneId: 's1',
    state: createInitialState(),
    progress: 0,
    messageCount: 0,
    endingId: null,
    mode: 'ai',
    providerId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

interface Harness {
  store: InMemoryStoryMemoryStore;
  engine: StoryMemoryEngine;
  pt: Playthrough;
  bundle: StoryBundle;
}

function harness(id = 'ptA', storyId = 'arranged-marriage-wala-love'): Harness {
  const store = createInMemoryStoryMemoryStore();
  const engine = createStoryMemoryEngine(store);
  return { store, engine, pt: makePlaythrough(id, storyId), bundle: makeBundle(storyId) };
}

let messageSeq = 0;
function rawMessage(playthroughId: string, role: ChatMessage['role'], text: string, speaker: string | null = null): ChatMessage {
  messageSeq++;
  return {
    id: `m${messageSeq}`,
    playthroughId,
    role,
    speaker,
    text,
    sceneId: 's1',
    createdAt: new Date(Date.now() + messageSeq).toISOString(),
  };
}

interface TurnOpts {
  messageIds?: string[];
  parsedState?: unknown;
  location?: string | null;
  sceneId?: string;
  storyDay?: number;
}

async function turn(h: Harness, userText: string, assistantText: string, opts: TurnOpts = {}) {
  const userMsg = rawMessage(h.pt.id, 'user', userText);
  const botMsg = rawMessage(h.pt.id, 'assistant', assistantText);
  // The raw archive rows exist in the messages table in production.
  h.store._data.messages.push(
    { id: userMsg.id, playthroughId: h.pt.id, role: userMsg.role, speaker: userMsg.speaker, text: userMsg.text, createdAt: userMsg.createdAt },
    { id: botMsg.id, playthroughId: h.pt.id, role: botMsg.role, speaker: botMsg.speaker, text: botMsg.text, createdAt: botMsg.createdAt },
  );
  return h.engine.writeTurn({
    playthrough: h.pt,
    bundle: h.bundle,
    userText,
    assistantText,
    parsedState: opts.parsedState,
    messageIds: opts.messageIds ?? [userMsg.id, botMsg.id],
    sceneId: opts.sceneId ?? h.pt.currentSceneId,
    location: opts.location ?? 'Rampur veranda',
    storyDay: opts.storyDay ?? 1,
    playerName: 'Ankit',
  });
}

/* ------------------------------------------------------------------ */
/* 1. Scene change + character pair (the MC ↔ Bhabhi scenario)         */
/* ------------------------------------------------------------------ */

describe('scene-change persistence + character-pair memory', () => {
  test('an important MC–Bhabhi conversation survives a Poonam scene and is retrievable later', async () => {
    const h = harness();

    // Scene 1: MC meets Poonam.
    await turn(h, 'Namaste, main Ankit hoon.', 'Poonam: "Ji namaste. Aap chai lenge?"');

    // Scene 2: an important conversation with Bhabhi (different wording than
    // the later query — retrieval must be meaning-based, not keyword-exact).
    await turn(
      h,
      'Bhabhi, aap batao sab theek hai na?',
      '*Bhabhi ne dheere se bataya ki usse ek bada raaz pata hai jo poori family se chhupaya gaya hai.*\nBhabhi: "Ye baat sirf tumhe bata rahi hoon, kisi ko mat batana."',
    );

    // Scene 3: completely different location/character.
    await turn(h, 'Chalo bazaar chalte hain.', 'Poonam: "Theek hai, main saath chalungi."', { location: 'Bazaar' });

    // Scene 4: Bhabhi returns much later at another location.
    await turn(h, 'Wapas veranda aa gaye.', 'Bhabhi: "Arre tum aa gaye! Baat yaad hai meri?"', { location: 'Rampur veranda' });

    const result = await h.engine.memorySearch({
      storyId: h.bundle.meta.id,
      playthroughId: h.pt.id,
      query: 'Bhabhi ke saath pehle kya hua tha?',
      characters: ['bhabhi'],
      relationshipPair: pairKeyOf(PLAYER_ID, 'bhabhi'),
      limit: 8,
    });

    const texts = result.events.map((e) => e.summary.toLowerCase()).join(' | ');
    expect(texts).toContain('bhabhi');
    expect(texts).toMatch(/raaz|chhupaya|secret/);
    // The MC–Bhabhi event is tagged with their pair, not only with Poonam.
    const bhabhiEvent = result.events.find((e) => e.summary.toLowerCase().includes('bhabhi'));
    expect(bhabhiEvent?.pairKeys).toContain(pairKeyOf(PLAYER_ID, 'bhabhi'));
    expect(result.relationships.every((r) => r.playthroughId === h.pt.id)).toBe(true);
  });

  test('a scene change never resets memory (episode count grows, archive intact)', async () => {
    const h = harness();
    await turn(h, 'Poonam se pehli baat.', 'Poonam: "Ji?"');
    const before = await h.engine.loadArchive(h.pt.id);
    await turn(h, 'Doosre sheher chale gaye.', 'Poonam: "Aap wapas kab aayenge?"', { location: 'Bazaar' });
    const after = await h.engine.loadArchive(h.pt.id);
    expect(after.events.length).toBeGreaterThanOrEqual(before.events.length);
    expect(after.knowledge.length).toBeGreaterThanOrEqual(before.knowledge.length);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Relationship state + marriage persistence                        */
/* ------------------------------------------------------------------ */

describe('relationship state persistence', () => {
  test('marriage is stored, survives later scenes and is never silently reverted', async () => {
    const h = harness();
    await turn(
      h,
      'Aaj humari shaadi ho gayi, Poonam ab meri biwi hai.',
      '*Mandir mein saat phere poore hue.*\nPoonam: "Ab hum ek ho gaye."',
    );

    let rel = await h.store.getRelationship(h.pt.id, pairKeyOf(PLAYER_ID, 'poonam'));
    expect(rel?.status).toBe('married');
    expect(rel?.tier).toBeGreaterThanOrEqual(7);

    // Ten scenes later, a narratively lazy reply implies they are strangers.
    await turn(h, 'Kaun ho tum?', 'Poonam: "Hum to sirf ek doosre ki pehchaan hain, aur kuch nahi."');

    rel = await h.store.getRelationship(h.pt.id, pairKeyOf(PLAYER_ID, 'poonam'));
    expect(rel?.status).toBe('married'); // NOT reverted
    expect(rel?.history.map((x) => x.status)).toContain('married');

    const contradictions = await h.store.listContradictions(h.pt.id);
    expect(contradictions.length).toBeGreaterThan(0);
    expect(contradictions[0].expected).toContain('married');
    expect(contradictions[0].reason.length).toBeGreaterThan(10);
  });

  test('an explicit break IS accepted (downgrades are possible, not blocked forever)', async () => {
    const h = harness();
    await turn(h, 'Humari shaadi ho gayi. Poonam meri biwi hai.', 'Poonam: "Haan."');
    await turn(
      h,
      'Poonam ne talaq maang liya.',
      '*Court ke bahar Poonam ne kaha ki ab rishta khatam ho gaya hai.*\nPoonam: "Ab hum alag ho gaye hain."',
    );
    const rel = await h.store.getRelationship(h.pt.id, pairKeyOf(PLAYER_ID, 'poonam'));
    expect(['divorced', 'separated', 'broken_up']).toContain(rel?.status);
    expect(rel?.history.map((x) => x.status)).toContain('married');
  });

  test('structured kissa-state relationshipStatus is validated the same way', async () => {
    const h = harness();
    await turn(h, 'Poonam se baat hui.', 'Poonam: "Achha laga aapse baat karke."', {
      parsedState: { relationshipStatus: { poonam: 'happy' } },
    });
    // Custom story-defined label is stored (the engine is not limited to a fixed enum).
    let rel = await h.store.getRelationship(h.pt.id, pairKeyOf(PLAYER_ID, 'poonam'));
    expect(rel?.status).toBe('happy');

    // …but it cannot be overwritten with a nonsensical jump, and a downgrade to
    // an unknown label is rejected, not applied.
    await turn(h, 'Sab theek hai.', 'Poonam: "Hmm."', {
      parsedState: { relationshipStatus: { poonam: 'stranger' } },
    });
    rel = await h.store.getRelationship(h.pt.id, pairKeyOf(PLAYER_ID, 'poonam'));
    expect(rel?.status).toBe('happy');
  });

  test('validateTransition unit rules', () => {
    expect(validateTransition(null, { status: 'friend', tier: 2 }, 'dost bane', 'high', true).accepted).toBe(true);
    expect(validateTransition({ status: 'friend', tier: 2 }, { status: 'close_friend', tier: 3 }, '', 'medium', false).accepted).toBe(true);
    const downgrade = validateTransition({ status: 'married', tier: 7 }, { status: 'stranger', tier: 0 }, 'sab bhool gaye', 'medium', false);
    expect(downgrade.accepted).toBe(false);
    expect(downgrade.contradiction?.expected).toContain('married');
    const breakup = validateTransition({ status: 'married', tier: 7 }, { status: 'divorced', tier: -2 }, 'talaq ho gayi, ab alag hain', 'high', true);
    expect(breakup.accepted).toBe(true);
    const weak = validateTransition({ status: 'dating', tier: 5 }, { status: 'married', tier: 7 }, 'shayad shaadi ho gayi', 'low', false);
    expect(weak.flagged).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 3. App restart / reload                                             */
/* ------------------------------------------------------------------ */

describe('app restart persistence', () => {
  test('a new engine over the same store sees every memory, relationship and knowledge record', async () => {
    const store = createInMemoryStoryMemoryStore();
    const engine1 = createStoryMemoryEngine(store);
    const pt = makePlaythrough('ptRestart');
    const bundle = makeBundle();
    const h: Harness = { store, engine: engine1, pt, bundle };

    await turn(h, 'Poonam se pehli mulaqat hui.', 'Poonam: "Ji, aap chai lenge?"');
    await turn(h, 'Humari sagai ho gayi.', 'Poonam: "Ab hum engaged hain."');
    await turn(h, 'Poonam ko pata hai ki chitthi Chachi ne likhi thi.', 'Poonam: "Mujhe sab pata hai."');

    // Simulate closing and reopening the app: brand new engine, same on-device store.
    const engine2 = createStoryMemoryEngine(store);

    const rel = await engine2.memorySearch({
      storyId: bundle.meta.id,
      playthroughId: pt.id,
      query: 'Poonam ke saath rishta kya hai?',
      characters: ['poonam'],
    });
    expect(rel.relationships.map((r) => r.status)).toContain('engaged');
    expect(rel.events.some((e) => /mulaqat|sagai|engaged|chitthi/i.test(e.summary))).toBe(true);

    const knowledge = await engine2.memorySearch({
      storyId: bundle.meta.id,
      playthroughId: pt.id,
      query: 'Poonam ko chitthi ke baare mein kya pata hai?',
      characters: ['poonam'],
    });
    expect(knowledge.knowledge.some((k) => k.characterId === 'poonam' && /chitthi/i.test(k.fact))).toBe(true);

    const stats = await engine2.stats(pt.id);
    expect(stats.events).toBeGreaterThan(0);
    expect(stats.relationships).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Character knowledge / perspective                                */
/* ------------------------------------------------------------------ */

describe('character knowledge and perspective', () => {
  test('knowledge belongs to the character who learned it — nobody magically knows it', async () => {
    const h = harness();
    await turn(
      h,
      'Poonam ko pata hai ki uski chachi ne usse ek chitthi likhi thi.',
      'Poonam: "Haan, mujhe pata hai."',
    );

    const all = await h.store.listKnowledge(h.pt.id);
    const poonamKnowledge = all.filter((k) => k.characterId === 'poonam');
    const bhabhiKnowledge = all.filter((k) => k.characterId === 'bhabhi');
    expect(poonamKnowledge.some((k) => /chitthi/i.test(k.fact))).toBe(true);
    expect(bhabhiKnowledge.some((k) => /chitthi/i.test(k.fact))).toBe(false);

    // The retrieval for a Bhabhi-focused question surfaces Bhabhi's own records,
    // not Poonam's private knowledge.
    const res = await h.engine.memorySearch({
      storyId: h.bundle.meta.id,
      playthroughId: h.pt.id,
      query: 'Bhabhi ko kya pata hai?',
      characters: ['bhabhi'],
      perspective: 'bhabhi',
    });
    expect(res.knowledge.every((k) => k.characterId !== 'poonam' || !/chitthi/i.test(k.fact))).toBe(true);
  });

  test('knowledge is traceable to the event and the raw messages that produced it', async () => {
    const h = harness();
    await turn(h, 'Poonam ko pata hai ki chabi Bhabhi ke paas hai.', 'Poonam: "Mujhe pata chal gaya."');
    const [knowledge] = await h.store.listKnowledge(h.pt.id);
    expect(knowledge.sourceEventId).toBeTruthy();
    expect(knowledge.sourceMessageIds.length).toBeGreaterThan(0);
    const event = await h.store.getEvent(knowledge.sourceEventId!);
    expect(event?.id).toBe(knowledge.sourceEventId);
    expect(event?.sourceMessageIds.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 5. Semantic + long-distance retrieval                               */
/* ------------------------------------------------------------------ */

describe('semantic and long-distance retrieval', () => {
  test('meaning-based retrieval across languages (tasveer ↔ photograph)', async () => {
    const h = harness();
    await turn(h, 'Poonam ne purani tasveer almari mein chhupayi thi.', 'Poonam: "Kisi ko mat batana."');
    const res = await h.engine.memorySearch({
      storyId: h.bundle.meta.id,
      playthroughId: h.pt.id,
      query: 'Where is the old photograph hidden?',
      characters: ['poonam'],
    });
    expect(res.events.some((e) => /tasveer|photograph/i.test(e.summary))).toBe(true);
  });

  test('a detail missed by event extraction is still retrievable from the raw transcript index', async () => {
    const h = harness();
    const longLeadIn = Array.from({ length: 180 }, (_, i) => `fillerword${i}`).join(' ');
    await turn(h, 'Poonam ka pasandida rang neela hai.', `${longLeadIn} Poonam: "Mera pasandida rang neela hai."`);

    // This detail is intentionally ordinary conversation, so it creates no
    // typed story event. It is also late in a long message and is then followed
    // by many turns, exercising both full-message indexing and long-distance recall.
    for (let i = 0; i < 120; i++) {
      await turn(h, `Chai break ${i}.`, 'Poonam: "Theek hai."');
    }

    const res = await h.engine.memorySearch({
      storyId: h.bundle.meta.id,
      playthroughId: h.pt.id,
      query: 'Poonam ka favorite color blue kya tha?',
      characters: ['poonam'],
      limit: 8,
    });
    expect(res.events).toHaveLength(0);
    expect(res.hops).toContain('raw-message');
    expect(res.evidence.some((m) => /pasandida rang neela/i.test(m.text))).toBe(true);
    expect(res.evidence.some((m) => /pasandida rang neela/i.test(m.excerpt ?? ''))).toBe(true);
    const promptBlock = h.engine.buildContextBlock(res, { currentSeq: 0 });
    expect(promptBlock).toContain('pasandida rang neela');
  });

  test('an event hundreds of messages old is still retrieved, without enlarging context', async () => {
    const h = harness();
    // Message 1-2: the important promise.
    await turn(
      h,
      'Poonam, main wada karta hoon ki main tumhe Rampur wapas launga.',
      'Poonam: "Kasam?"\nAnkit: "Kasam."',
    );
    const firstEventId = (await h.engine.loadArchive(h.pt.id)).events.find((e) => e.type === 'promise')?.id;
    expect(firstEventId).toBeTruthy();

    // 300 further exchanges: a real transcript grows (600+ raw rows) while only
    // a sparse, importance-ranked set becomes typed memory — by design.
    for (let i = 0; i < 300; i++) {
      await turn(
        h,
        `Chal aaj bazaar chalte hain (${i}).`,
        i % 10 === 0
          ? `Poonam: "Mujhe aaj ek purani diary mili, isme kuch likha hai (${i})."`
          : `Poonam: "Aaj mausam achha hai, baatein karte hain (${i})."`,
      );
    }

    // The RAW archive really grew to hundreds of messages…
    const rawCount = h.store._data.messages.length;
    expect(rawCount).toBeGreaterThan(500);
    // …and the typed archive grew too, but sparsely (importance filtering).
    const archive = await h.engine.loadArchive(h.pt.id, { limit: 5000 });
    expect(archive.events.length).toBeGreaterThan(15);
    const old = archive.events.find((e) => e.id === firstEventId)!;
    expect(old).toBeTruthy();

    const res = await h.engine.memorySearch({
      storyId: h.bundle.meta.id,
      playthroughId: h.pt.id,
      query: 'Poonam ko diya gaya wada kya tha?',
      characters: ['poonam'],
      limit: 12,
    });
    expect(res.events.some((e) => e.id === firstEventId)).toBe(true);
    // Bounded: retrieval never returns the whole archive, and the short-term
    // window is untouched — the retrieval architecture did the work.
    expect(res.events.length).toBeLessThanOrEqual(16);
  });

  test('retrieval stays fast and bounded on a large archive', async () => {
    const h = harness();
    for (let i = 0; i < 200; i++) {
      await turn(h, `Scene ${i} mein Poonam se baat hui.`, `Poonam: "Baat ${i} yaad rahegi."`);
    }
    const started = Date.now();
    const res = await h.engine.memorySearch({
      storyId: h.bundle.meta.id,
      playthroughId: h.pt.id,
      query: 'Poonam se hui baat',
      characters: ['poonam'],
      limit: 14,
    });
    const elapsed = Date.now() - started;
    expect(res.events.length).toBeLessThanOrEqual(14);
    expect(elapsed).toBeLessThan(500);
  });
});

/* ------------------------------------------------------------------ */
/* 6. Timeline + source tracking                                       */
/* ------------------------------------------------------------------ */

describe('timeline and source tracking', () => {
  test('timeline is chronological and source ids point at the raw archive', async () => {
    const h = harness();
    const t1 = await turn(h, 'Pehli mulaqat hui Poonam se aur humne ek wada kiya.', 'Poonam: "Namaste."');
    const t2 = await turn(h, 'Poonam ne maafi maangi.', 'Poonam: "Sorry, maafi chahiye thi."');
    expect(t1.seqStart).toBeLessThan(t2.seqStart);

    const res = await h.engine.memorySearch({
      storyId: h.bundle.meta.id,
      playthroughId: h.pt.id,
      query: 'Poonam ke saath kya kya hua?',
      characters: ['poonam'],
    });
    const seqs = res.timeline.map((e) => e.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    for (const e of res.events) expect(e.sourceMessageIds.length).toBeGreaterThan(0);
    expect(res.evidence.length).toBeGreaterThan(0);
    expect(res.evidence[0].text.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 7. Story isolation                                                  */
/* ------------------------------------------------------------------ */

describe('story isolation', () => {
  test('memory never crosses from one story (or run) into another', async () => {
    const store = createInMemoryStoryMemoryStore();
    const engine = createStoryMemoryEngine(store);
    const bundleA = makeBundle('arranged-marriage-wala-love');
    const bundleB = makeBundle('zara-mumbai-mafia-queen');
    bundleB.characters = {
      storyId: 'zara-mumbai-mafia-queen',
      version: 1,
      characters: [
        {
          id: 'zara', name: 'Zara', role: 'Mafia queen.', personality: 'Sharp.', background: 'Mumbai.',
          goals: [], fears: [], likes: [], dislikes: [], speakingStyle: 'Clipped Hinglish.',
          sampleLine: 'Yahan se chale jao.', relationshipWithUser: 'Zara is a stranger to MC.',
          knowledge: [],
        },
      ],
    };
    const ptA = makePlaythrough('ptA', 'arranged-marriage-wala-love');
    const ptB = makePlaythrough('ptB', 'zara-mumbai-mafia-queen');

    await engine.writeTurn({
      playthrough: ptA, bundle: bundleA, playerName: 'Ankit',
      userText: 'Poonam se sagai ho gayi.',
      assistantText: 'Poonam: "Ab hum engaged hain."',
      messageIds: [], location: 'Rampur veranda',
    });
    await engine.writeTurn({
      playthrough: ptB, bundle: bundleB, playerName: 'Ankit',
      userText: 'Zara ne mujhe dhokha diya hai aur bandook nikali.',
      assistantText: 'Zara: "Dhokha toh maine bhi khaaya hai."',
      messageIds: [], location: 'Dock',
    });

    const resA = await engine.memorySearch({
      storyId: ptA.storyId, playthroughId: ptA.id, query: 'sagai Poonam', characters: ['poonam'],
    });
    const resB = await engine.memorySearch({
      storyId: ptB.storyId, playthroughId: ptB.id, query: 'Zara bandook', characters: ['zara'],
    });

    expect(resA.events.every((e) => e.playthroughId === ptA.id)).toBe(true);
    expect(resB.events.every((e) => e.playthroughId === ptB.id)).toBe(true);
    expect(resA.events.some((e) => /Zara|bandook/i.test(e.summary))).toBe(false);
    expect(resB.events.some((e) => /Poonam|sagai/i.test(e.summary))).toBe(false);
    expect(resA.relationships.every((r) => r.storyId === ptA.storyId)).toBe(true);

    // Deleting one journey removes only that journey's archive.
    await engine.deleteForPlaythrough(ptA.id);
    const left = await engine.stats(ptA.id);
    expect(left.events).toBe(0);
    expect((await engine.stats(ptB.id)).events).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 8. Consolidation (lossless folding)                                 */
/* ------------------------------------------------------------------ */

describe('memory consolidation', () => {
  test('old events fold into rollups while every raw event stays on disk', async () => {
    const h = harness();
    for (let i = 0; i < 90; i++) {
      await turn(
        h,
        `Turn ${i}: Poonam, main wada karta hoon ki baat ${i} yaad rakhunga.`,
        `Poonam: "Wada yaad rakhna, baat ${i}."`,
      );
    }
    const before = await h.engine.loadArchive(h.pt.id, { limit: 5000 });
    const rawIds = before.events.filter((e) => e.type === 'promise').map((e) => e.id);
    expect(rawIds.length).toBeGreaterThan(50);

    const out = await h.engine.consolidate(h.pt.id, h.bundle.meta.id, { keepLive: 60 });
    expect(out.rollups).toBeGreaterThan(0);
    expect(out.folded).toBeGreaterThan(0);

    const after = await h.engine.loadArchive(h.pt.id, { limit: 5000 });
    const rollups = after.events.filter((e) => e.type === 'rollup');
    expect(rollups.length).toBeGreaterThan(0);
    // Raw events are archived, never deleted.
    const stillThere = after.events.filter((e) => rawIds.includes(e.id));
    expect(stillThere.length).toBe(rawIds.length);
    expect(rollups[0].sourceEventIds?.length).toBeGreaterThan(0);

    // A folded fact is still reachable: the rollup matches the query and
    // resolves back to its concrete source events.
    const res = await h.engine.memorySearch({
      storyId: h.bundle.meta.id,
      playthroughId: h.pt.id,
      query: 'wada baat 3',
      limit: 10,
    });
    expect(res.events.length).toBeGreaterThan(0);
    expect(res.events.some((e) => e.sourceEventIds?.length || e.type !== 'rollup')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 9. Migration of pre-v2.5.1 journeys                                 */
/* ------------------------------------------------------------------ */

describe('backward compatibility', () => {
  test('an existing journey gains a typed archive from its raw messages (idempotent)', async () => {
    const store = createInMemoryStoryMemoryStore();
    const engine = createStoryMemoryEngine(store);
    const pt = makePlaythrough('ptLegacy');
    pt.state.relationships = { poonam: 88 }; // legacy numeric relationship
    const bundle = makeBundle();

    const messages: ChatMessage[] = [
      { id: 'lm1', playthroughId: pt.id, role: 'user', speaker: 'Ankit', text: 'Poonam se pehli baar milkar achha laga.', sceneId: 's1', createdAt: '2026-01-01T10:00:00.000Z' },
      { id: 'lm2', playthroughId: pt.id, role: 'assistant', speaker: 'Poonam', text: 'Poonam: "Mujhe bhi achha laga."', sceneId: 's1', createdAt: '2026-01-01T10:00:05.000Z' },
      { id: 'lm3', playthroughId: pt.id, role: 'user', speaker: 'Ankit', text: 'Main wada karta hoon ki tumhe Rampur wapas launga.', sceneId: 's1', createdAt: '2026-01-01T10:01:00.000Z' },
      { id: 'lm4', playthroughId: pt.id, role: 'assistant', speaker: 'Poonam', text: '*Poonam ne aankhein nam karke haan kaha.*\nPoonam: "Wada yaad rakhna."', sceneId: 's1', createdAt: '2026-01-01T10:01:05.000Z' },
      // An uncategorized detail from a legacy transcript must be recovered by backfill.
      { id: 'lm5', playthroughId: pt.id, role: 'user', speaker: 'Ankit', text: 'Poonam ka lucky number 17 hai.', sceneId: 's1', createdAt: '2026-01-01T10:02:00.000Z' },
    ];
    // The legacy messages also exist in the raw archive store.
    store._data.messages.push(...messages.map((m) => ({ id: m.id, playthroughId: m.playthroughId, role: m.role, speaker: m.speaker, text: m.text, createdAt: m.createdAt })));

    const first = await engine.migrate({ playthrough: pt, bundle, messages, playerName: 'Ankit' });
    expect(first.migrated).toBe(true);
    expect(first.events).toBeGreaterThan(0);
    expect(first.knowledge).toBeGreaterThan(0); // seeded from characters.json
    expect(first.relationships).toBe(1); // legacy score → starting status

    const rel = await store.getRelationship(pt.id, pairKeyOf(PLAYER_ID, 'poonam'));
    expect(rel?.status).toBe('close_friend'); // 88/100 maps to a warm starting state
    expect(await store.getMeta(pt.id, 'migrated')).toBe(String(STORY_MEMORY_VERSION));

    const second = await engine.migrate({ playthrough: pt, bundle, messages, playerName: 'Ankit' });
    expect(second.migrated).toBe(false); // idempotent

    const res = await engine.memorySearch({
      storyId: pt.storyId, playthroughId: pt.id, query: 'Poonam se mulaqat aur wada', characters: ['poonam'],
    });
    expect(res.events.length).toBeGreaterThan(0);

    const rawOnly = await engine.memorySearch({
      storyId: pt.storyId,
      playthroughId: pt.id,
      query: 'Poonam ka lucky number 17 kya tha?',
      characters: ['poonam'],
    });
    expect(rawOnly.evidence.some((m) => /lucky number 17/i.test(m.text))).toBe(true);
  });

  test('the v3 migration repairs turnSeq on typed events already written by v1', async () => {
    const store = createInMemoryStoryMemoryStore();
    const engine = createStoryMemoryEngine(store);
    const pt = makePlaythrough('ptTurnSeqMigration');
    const bundle = makeBundle();
    const messages: ChatMessage[] = [
      { id: 'opening-assistant-1', playthroughId: pt.id, role: 'assistant', speaker: 'Poonam', text: 'Subah ki roshni purani haveli par padi.', sceneId: 's1', createdAt: '2026-01-01T09:59:40.000Z' },
      { id: 'opening-assistant-2', playthroughId: pt.id, role: 'assistant', speaker: 'Poonam', text: 'Door se ghanti ki awaaz aayi.', sceneId: 's1', createdAt: '2026-01-01T09:59:45.000Z' },
      { id: 'turnseq-user', playthroughId: pt.id, role: 'user', speaker: 'Ankit', text: 'Main wada karta hoon ki tumhe Rampur wapas launga.', sceneId: 's1', createdAt: '2026-01-01T10:00:00.000Z' },
      { id: 'turnseq-assistant', playthroughId: pt.id, role: 'assistant', speaker: 'Poonam', text: 'Poonam: "Wada yaad rakhna."', sceneId: 's1', createdAt: '2026-01-01T10:00:05.000Z' },
    ];
    store._data.messages.push(...messages.map((m) => ({
      id: m.id, playthroughId: m.playthroughId, role: m.role, speaker: m.speaker, text: m.text, createdAt: m.createdAt,
    })));

    await engine.writeTurn({
      playthrough: pt,
      bundle,
      userText: messages[2].text,
      assistantText: messages[3].text,
      messageIds: [messages[2].id, messages[3].id],
      playerName: 'Ankit',
    });
    const legacy = store._data.events.find((event) => event.sourceMessageIds.includes('turnseq-assistant'));
    expect(legacy).toBeDefined();
    expect(legacy?.turnSeq).toBeUndefined();
    await store.setMeta(pt.id, 'migrated', '2');

    await engine.migrate({ playthrough: pt, bundle, messages, playerName: 'Ankit' });
    const upgraded = store._data.events.find((event) => event.sourceMessageIds.includes('turnseq-assistant'));
    expect(upgraded?.turnSeq).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* 10. Event extraction quality                                        */
/* ------------------------------------------------------------------ */

describe('event extraction', () => {
  test('importance levels: marriage/promise are VERY_HIGH, chatter is ignored', async () => {
    const h = harness();
    const detections = detectEvents(
      'Main kasam khaata hoon ki sach bataunga.',
      '*Poonam ki shaadi ki baat chali.*\nPoonam: "Hmm."',
      contextFromBundle(h.bundle, { playerName: 'Ankit' }),
      { maxEvents: 6, minImportance: 2 },
    );
    expect(detections.length).toBeGreaterThan(0);
    expect(detections.some((d) => d.importance === 4)).toBe(true);
    expect(detections.some((d) => d.type === 'promise' || d.type === 'marriage')).toBe(true);
    expect(detections.every((d) => d.importanceLabel !== 'LOW')).toBe(true);
  });

  test('trivial chatter produces no events at all (raw archive still keeps it)', async () => {
    const h = harness();
    const out = await turn(h, 'ok', 'Poonam: "Hmm."');
    expect(out.events).toBe(0);
    expect((await h.engine.stats(h.pt.id)).events).toBe(0);
  });

  test('PII is never persisted into the memory archive', async () => {
    const h = harness();
    await turn(h, 'Mera number 9876543210 hai, mujhe call karna.', 'Poonam: "Theek hai."');
    const archive = await h.engine.loadArchive(h.pt.id);
    expect(archive.events.every((e) => !/\d{10}/.test(e.summary))).toBe(true);
    expect(archive.knowledge.every((k) => !/\d{10}/.test(k.fact))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 11. Index-backed retrieval beyond the structural slice              */
/* ------------------------------------------------------------------ */

describe('index-backed retrieval', () => {
  test('an event far older than the recent slice is still found through the index', async () => {
    const h = harness();
    const first = await turn(
      h,
      'Poonam ne pehli mulaqat par purani diary dikhayi jisme ek raaz chhupa tha.',
      'Poonam: "Ye raaz kisi ko mat batana, sirf tumhe pata hai."',
    );
    const oldEvent = (await h.engine.loadArchive(h.pt.id)).events.find((e) => /diary|raaz/i.test(e.summary));
    expect(oldEvent).toBeTruthy();

    // A very long saga: 1100 further events pushed the old record far outside
    // any "recent N records" slice (the structural lane keeps the newest 900).
    for (let i = 0; i < 1100; i++) {
      const seq = 1000 + i;
      const record = {
        id: `bulk_${i}`,
        storyId: h.bundle.meta.id,
        playthroughId: h.pt.id,
        seq,
        type: 'conversation' as const,
        summary: `Lambe safar ka hissa ${i}: mausam aur khana.`,
        importance: 2,
        importanceLabel: 'MEDIUM' as const,
        confidence: 'medium' as const,
        source: 'narrator' as const,
        sourceMessageIds: [],
        sceneId: 's1',
        location: 'Bazaar',
        participants: ['bhabhi'],
        pairKeys: [pairKeyOf(PLAYER_ID, 'bhabhi')],
        objectNames: [],
        storyDay: seq,
        occurredAt: new Date(Date.now() + seq * 1000).toISOString(),
        createdAt: new Date(Date.now() + seq * 1000).toISOString(),
        status: 'active' as const,
        supersededBy: null,
        keywords: ['mausam', 'khana', `part${i}`],
        archived: false,
      };
      await h.store.insertEvent(record);
      await h.store.indexRecord(record.storyId, record.playthroughId, 'event', record.id, record.keywords);
    }
    expect(first.seqStart).toBeLessThan(100);

    const res = await h.engine.memorySearch({
      storyId: h.bundle.meta.id,
      playthroughId: h.pt.id,
      query: 'Poonam ne kaunsi diary dikhayi thi jisme raaz tha?',
      characters: ['poonam'],
      limit: 10,
    });
    expect(res.events.some((e) => e.id === oldEvent!.id)).toBe(true);
    // The candidate set stays bounded even though the archive holds 1100+ events.
    const stats = await h.engine.stats(h.pt.id);
    expect(stats.events).toBeGreaterThan(1100);
    expect(res.candidates).toBeLessThan(600);
  });
});

/* ------------------------------------------------------------------ */
/* 12. Knowledge validity                                              */
/* ------------------------------------------------------------------ */

describe('knowledge validity', () => {
  test('a revelation marks the affected belief as no longer valid (record kept)', async () => {
    const h = harness();
    await turn(h, 'Poonam ko pata hai ki chitthi Chachi ne likhi thi.', 'Poonam: "Haan mujhe pata hai."');
    const before = await h.store.listKnowledge(h.pt.id);
    expect(before.some((k) => k.status === 'believed')).toBe(true);

    await turn(
      h,
      'Sach pata chal gaya: chitthi Chachi ne nahi, Bhabhi ne likhi thi.',
      'Poonam: "Toh chitthi ka sach kuch aur tha?"',
    );

    const after = await h.store.listKnowledge(h.pt.id, { includeInvalidated: true });
    const invalidated = after.filter((k) => k.status === 'invalidated');
    expect(invalidated.length).toBeGreaterThan(0);
    expect(invalidated[0].invalidatedBy).toBeTruthy(); // traceable to the revelation

    // Default retrieval ignores invalidated knowledge…
    const live = await h.store.listKnowledge(h.pt.id);
    expect(live.every((k) => k.status !== 'invalidated')).toBe(true);
    // …but the record itself is still on disk.
    expect(after.length).toBeGreaterThan(live.length);
  });
});
