/**
 * v2.13.0 — stronger recall and story logic, without a new pre-reply AI call.
 *
 * Covers pronoun/context retrieval, first/last timeline intent, speaker-aware
 * raw evidence, causal memory, and conservative pre-display contradiction guards.
 */
const kv = new Map<string, string>();
jest.mock('../src/lib/db', () => ({
  kvGet: jest.fn(async (key: string) => kv.get(key) ?? null),
  kvSet: jest.fn(async (key: string, value: string) => void kv.set(key, value)),
  kvDelete: jest.fn(async (key: string) => void kv.delete(key)),
  getDb: jest.fn(async () => ({ runAsync: async () => undefined, getAllAsync: async () => [], getFirstAsync: async () => null })),
  insertMemory: jest.fn(async () => 'inserted'),
  reinforceMemories: jest.fn(async () => undefined),
  restoreMemory: jest.fn(async () => undefined),
}));

import type {
  Playthrough,
  RelationshipStateRecord,
  StoryBundle,
  StoryEventRecord,
  StoryEventType,
} from '../src/types';
import { createInitialState, KISSA_OWNER_CREATOR } from '../src/types';
import {
  buildQueryProfileV2,
  evidenceSpeakerForQuery,
  keywordSet,
  pairKeysFor,
  rankArchive,
  temporalIntentForQuery,
  type MemoryContextRef,
} from '../src/lib/storyMemoryCore';
import { createStoryMemoryEngine } from '../src/lib/storyMemory';
import { createInMemoryStoryMemoryStore } from '../src/lib/storyMemoryStore';
import {
  findObjectOwnerContradiction,
  findRelationshipReset,
  findRepeatedReply,
} from '../src/lib/storyLogic';
import {
  applyWorldStateUpdate,
  migrateWorldState,
  renderWorldStateForPrompt,
  validateWorldState,
  MAX_CAUSAL_BEATS,
  type WorldState,
} from '../src/lib/worldState';
import { toStateUpdate, validateExtraction } from '../src/lib/memoryEngine';
import {
  buildStateExtractionMessages,
  checkAssistantReply,
  rewriteInstructionFor,
  type ParsedAssistant,
} from '../src/lib/engine';

const NOW = '2026-11-01T10:00:00.000Z';

function event(
  id: string,
  summary: string,
  turnSeq: number,
  participants: string[],
  type: StoryEventType = 'conversation',
  importance = 2,
): StoryEventRecord {
  return {
    id,
    storyId: 'story',
    playthroughId: 'pt',
    seq: turnSeq,
    turnSeq,
    type,
    summary,
    detail: null,
    importance,
    importanceLabel: importance === 4 ? 'VERY_HIGH' : importance === 3 ? 'HIGH' : 'MEDIUM',
    confidence: 'high',
    source: 'narrator',
    sourceMessageIds: [`${id}-u`, `${id}-a`],
    sceneId: 'scene',
    location: 'Room',
    participants,
    pairKeys: pairKeysFor(participants, 'player'),
    objectNames: [],
    storyDay: turnSeq,
    occurredAt: new Date(Date.UTC(2026, 0, turnSeq)).toISOString(),
    createdAt: NOW,
    status: 'active',
    supersededBy: null,
    keywords: keywordSet(summary),
    archived: false,
  };
}

const ctx: MemoryContextRef = {
  playerId: 'player',
  playerName: 'Ankit',
  characters: [{ id: 'riya', name: 'Riya' }, { id: 'meher', name: 'Meher' }],
  locations: ['Room'],
};

function relationship(status = 'married', tier = 4, id = 'riya', name = 'Riya'): RelationshipStateRecord {
  return {
    id: `rel-${id}`,
    storyId: 'story',
    playthroughId: 'pt',
    pairKey: `player::${id}`,
    a: { id: 'player', name: 'Ankit' },
    b: { id, name },
    status,
    tier,
    trust: 90,
    affection: 90,
    tension: 5,
    respect: 90,
    confidence: 'high',
    history: [],
    sourceEventIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    lastConfirmedAt: NOW,
  };
}

function presence(id: string, name: string) {
  return {
    id, name, present: id === 'riya', activity: null, mood: null,
    lastSeenLocation: 'Room', lastSeenAt: NOW, arrivalConfidence: 'high' as const,
  };
}

function makeWorld(): WorldState {
  return {
    version: 2,
    playthroughId: 'pt',
    storyId: 'story',
    currentLocation: 'Room',
    previousLocation: null,
    currentActivity: null,
    currentScene: null,
    currentArc: null,
    storyTime: { day: 1, timeOfDay: 'night', clockTime: null, elapsedMinutes: 0, lastUpdated: NOW },
    presentCharacters: ['riya'],
    absentCharacters: ['meher'],
    characterStates: { riya: presence('riya', 'Riya'), meher: presence('meher', 'Meher') },
    playerState: { action: null, mood: null, location: 'Room' },
    relationships: {},
    legacyRelationships: {},
    importantObjects: {},
    activeEvents: [],
    completedEvents: [],
    unresolvedThreads: [],
    resolvedThreads: [],
    locationMemory: {},
    promises: [],
    hearts: {},
    episodeCount: 0,
    lastTurnAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 2,
  };
}

function makeBundle(): StoryBundle {
  return {
    meta: { id: 'story', title: 'Test Story', accentColor: '#fff', cover: 'c.png', storyDir: 'story' },
    story: { storyId: 'story', title: 'Test Story', premise: 'A test.', tone: 'warm', userRole: 'MC', setting: 'Room', openingSceneId: 's1', tags: [], safetyNotes: [] },
    characters: {
      storyId: 'story', version: 1,
      characters: [{ id: 'riya', name: 'Riya', role: 'Partner.', personality: 'Warm.', background: '', goals: [], fears: [], likes: [], dislikes: [], speakingStyle: 'Soft.', sampleLine: 'Hi.', relationshipWithUser: 'Partner.', knowledge: [] }],
    },
    world: { storyId: 'story', version: 1, premise: 'Room', locations: [{ name: 'Room', description: '' }], rules: [], lore: [], importantObjects: [] },
    scenes: { storyId: 'story', version: 1, scenes: [{ id: 's1', title: 'Room', narration: ['Raat hai.'], fallbackLines: [], choices: [] }], endings: [] },
    memory: { storyId: 'story', version: 1, shortTermWindow: 16, seedMemories: [], extractionHints: [], neverRemember: [] },
    source: 'bundled',
    creator: KISSA_OWNER_CREATOR,
  } as unknown as StoryBundle;
}

function makePlaythrough(messageCount = 0): Playthrough {
  return {
    id: 'pt', storyId: 'story', label: 'Journey', status: 'active', currentSceneId: 's1',
    state: createInitialState(), progress: 0, messageCount, endingId: null, mode: 'ai', providerId: null,
    createdAt: NOW, updatedAt: NOW,
  };
}

function parsed(displayText: string): ParsedAssistant {
  return { displayText, memoryNotes: [], speaker: 'Riya', effects: {} };
}

describe('v2.13 query understanding', () => {
  test('recognises opposite temporal intents and the requested speaker', () => {
    expect(temporalIntentForQuery('hum pehli baar kab mile the?')).toBe('earliest');
    expect(temporalIntentForQuery('pichli baar tumne kya kaha?')).toBe('latest');
    expect(temporalIntentForQuery('kal kya hua?')).toBeNull();
    expect(evidenceSpeakerForQuery('maine kya kaha tha?')).toBe('user');
    expect(evidenceSpeakerForQuery('tumne kya kaha tha?')).toBe('assistant');
    expect(evidenceSpeakerForQuery('usne kya bola?')).toBe('assistant');
    expect(evidenceSpeakerForQuery('tumne meri baat sun lo')).toBeNull();
  });

  test('present characters become soft context, not explicit mentions', () => {
    const profile = buildQueryProfileV2('tumne woh waada kya tha?', ctx, { contextCharacters: ['riya', 'player'] });
    expect(profile.characters).toEqual([]);
    expect(profile.contextCharacters).toEqual(['riya']);
    expect(profile.focusCharacter).toBe('riya');
    expect(profile.wantsUnresolved).toBe(true);
    const explicit = buildQueryProfileV2('Meher ka waada kya tha?', ctx, { contextCharacters: ['riya', 'meher'] });
    expect(explicit.characters).toEqual(['meher']);
    expect(explicit.contextCharacters).toEqual(['riya']);
  });
});

describe('v2.13 ranked recall', () => {
  const events = [
    event('first', 'Riya aur Ankit pehli baar library me mile.', 1, ['player', 'riya'], 'meeting', 3),
    event('promise', 'Riya ne Ankit se milne ka waada kiya.', 12, ['player', 'riya'], 'promise', 3),
    event('middle', 'Riya ne chai ke baare me baat ki.', 25, ['player', 'riya']),
    event('other', 'Meher aur Ankit ki shaadi ho gayi.', 39, ['player', 'meher'], 'marriage', 4),
    event('latest', 'Riya ne kal ki planning confirm ki.', 40, ['player', 'riya']),
  ];
  const archive = { events, relationships: [], knowledge: [] };

  test('“pehli baar” retrieves the first meeting, not a newer milestone', () => {
    const ranked = rankArchive(archive, 'tumse pehli baar milne par kya hua tha?', ctx, {
      contextCharacters: ['riya'], currentSeq: 50, limit: 1,
    });
    expect(ranked.events.map((e) => e.id)).toEqual(['first']);
  });

  test('“pichli baar” retrieves the latest relevant turn', () => {
    const ranked = rankArchive(archive, 'tumne pichli baar kya kaha tha?', ctx, {
      contextCharacters: ['riya'], currentSeq: 50, limit: 1,
    });
    expect(ranked.events.map((e) => e.id)).toEqual(['latest']);
  });

  test('an unnamed “tumne” question follows the current character', () => {
    const ranked = rankArchive(archive, 'tumne woh waada kya tha?', ctx, {
      contextCharacters: ['riya'], currentSeq: 50, limit: 1,
    });
    expect(ranked.events.map((e) => e.id)).toEqual(['promise']);
  });

  test('an explicitly named character overrides the scene pronoun context', () => {
    const ranked = rankArchive(archive, 'Meher ki shaadi kab hui?', ctx, {
      contextCharacters: ['riya'], currentSeq: 50, limit: 1,
    });
    expect(ranked.events.map((e) => e.id)).toEqual(['other']);
  });

  test('a name in OLD context cannot hijack the CURRENT pronoun or temporal intent', () => {
    const ranked = rankArchive(archive, 'Meher se kal milna. tumne pichli baar kya kaha tha?', ctx, {
      primaryQuery: 'tumne pichli baar kya kaha tha?',
      contextCharacters: ['riya'], currentSeq: 50, limit: 1,
    });
    expect(ranked.events.map((e) => e.id)).toEqual(['latest']);
  });
});

describe('v2.13 raw transcript evidence', () => {
  test('“maine kya kaha” and “tumne kya kaha” prefer different speakers', async () => {
    const store = createInMemoryStoryMemoryStore();
    const engine = createStoryMemoryEngine(store);
    const bundle = makeBundle();
    const playthrough = makePlaythrough();
    store._data.messages.push(
      { id: 'u1', playthroughId: 'pt', role: 'user', speaker: 'Ankit', text: 'Riya, maine kaha ki main kal aaunga.', createdAt: '2026-01-01T10:00:00.000Z' },
      { id: 'a1', playthroughId: 'pt', role: 'assistant', speaker: 'Riya', text: 'Riya: "Main tumhara intezaar karungi."', createdAt: '2026-01-01T10:00:01.000Z' },
      { id: 'u2', playthroughId: 'pt', role: 'user', speaker: 'Ankit', text: 'Aaj chai kaisi hai?', createdAt: '2026-01-02T10:00:00.000Z' },
      { id: 'a2', playthroughId: 'pt', role: 'assistant', speaker: 'Riya', text: 'Riya: "Maine kaha ki chai thandi ho gayi."', createdAt: '2026-01-02T10:00:01.000Z' },
    );
    await engine.writeTurn({
      playthrough, bundle, playerName: 'Ankit', turnSeq: 1,
      userText: 'Riya, maine kaha ki main kal aaunga.',
      assistantText: 'Riya: "Main tumhara intezaar karungi."',
      messageIds: ['u1', 'a1'], at: '2026-01-01T10:00:00.000Z',
    });
    await engine.writeTurn({
      playthrough, bundle, playerName: 'Ankit', turnSeq: 2,
      userText: 'Aaj chai kaisi hai?',
      assistantText: 'Riya: "Maine kaha ki chai thandi ho gayi."',
      messageIds: ['u2', 'a2'], at: '2026-01-02T10:00:00.000Z',
    });
    const base = { storyId: 'story', playthroughId: 'pt', characters: ['riya'], currentSeq: 3, limit: 4 };
    const mine = await engine.memorySearch({ ...base, query: 'maine kya kaha tha?', primaryQuery: 'maine kya kaha tha?' });
    const yours = await engine.memorySearch({ ...base, query: 'tumne kya kaha tha?', primaryQuery: 'tumne kya kaha tha?' });
    expect(mine.evidence[0]?.role).toBe('user');
    expect(yours.evidence[0]?.role).toBe('assistant');

    const first = await engine.memorySearch({ ...base, query: 'tumne pehli baar kya kaha?', primaryQuery: 'tumne pehli baar kya kaha?' });
    const last = await engine.memorySearch({ ...base, query: 'tumne pichli baar kya kaha?', primaryQuery: 'tumne pichli baar kya kaha?' });
    expect(first.evidence[0]?.messageId).toBe('a1');
    expect(last.evidence[0]?.messageId).toBe('a2');
    expect(last.hops).toContain('speaker-timeline');
  });

  test('speaker fallback is bounded, ordered and isolated to one playthrough', async () => {
    const store = createInMemoryStoryMemoryStore();
    for (let i = 1; i <= 5; i++) {
      store._data.messages.push({ id: `a${i}`, playthroughId: 'pt', role: 'assistant', speaker: 'Riya', text: `Reply ${i}`, createdAt: `2026-01-0${i}T10:00:00.000Z` });
    }
    store._data.messages.push({ id: 'other', playthroughId: 'other', role: 'assistant', speaker: 'Zara', text: 'Other story', createdAt: '2026-02-01T10:00:00.000Z' });
    const latest = await store.listRawMessages('pt', { role: 'assistant', limit: 3, order: 'desc' });
    const earliest = await store.listRawMessages('pt', { role: 'assistant', limit: 2, order: 'asc' });
    expect(latest.map((message) => message.id)).toEqual(['a5', 'a4', 'a3']);
    expect(earliest.map((message) => message.id)).toEqual(['a1', 'a2']);
    expect([...latest, ...earliest].some((message) => message.id === 'other')).toBe(false);
  });
});

describe('v2.13 causal memory', () => {
  test('record-keeper schema requires a real cause and forbids future plotting', () => {
    const messages = buildStateExtractionMessages({
      bundle: makeBundle(), playthrough: makePlaythrough(), worldState: makeWorld(),
      userText: 'Main gussa hoon.', assistantText: 'Riya: "Mujhe maaf kar do."', playerName: 'Ankit',
    });
    expect(messages[0].content).toContain('"logic"');
    expect(messages[0].content).toContain('CAUSAL LOGIC RULES');
    expect(messages[0].content).toContain('Never guess a cause');
    expect(messages[0].content).toContain('Omit "logic" for small talk');
  });

  test('validates, stores and renders one direct cause → event → consequence', () => {
    const raw = validateExtraction({
      logic: {
        cause: 'Riya ne Ankit ki baat galat samajh li thi',
        event: 'Ankit ne apna matlab shant swar me samjhaya',
        consequence: 'Riya ko ab Ankit ka asli matlab pata hai',
      },
    });
    expect(raw?.logic?.event).toMatch(/samjhaya/);
    const world = makeWorld();
    const next = applyWorldStateUpdate(world, toStateUpdate(raw!, world, 'evidence'));
    expect(next.logic?.causalBeats).toHaveLength(1);
    expect(next.logic?.causalBeats[0]).toMatchObject({ turn: 1, cause: raw!.logic!.cause, consequence: raw!.logic!.consequence });
    const rendered = renderWorldStateForPrompt(next);
    expect(rendered).toContain('Established cause → effect chain');
    expect(rendered).toContain('not a future script');
    expect(rendered).toContain('asli matlab pata hai');
  });

  test('caps the chain, dedupes a repeated beat and keeps old saves valid', () => {
    let world = makeWorld();
    for (let i = 1; i <= 14; i++) {
      world = applyWorldStateUpdate(world, {
        confidence: 'high',
        logicBeat: { cause: `Turn ${i} ka karan`, event: `Turn ${i} ki clear ghatna`, consequence: `Turn ${i} ka parinaam` },
      });
    }
    expect(world.logic?.causalBeats).toHaveLength(MAX_CAUSAL_BEATS);
    expect(world.logic?.causalBeats[0].turn).toBe(5);
    const count = world.logic!.causalBeats.length;
    world = applyWorldStateUpdate(world, {
      confidence: 'high',
      logicBeat: { cause: 'Turn 14 ka karan', event: 'Turn 14 ki clear ghatna', consequence: 'Turn 14 ka parinaam' },
    });
    expect(world.logic?.causalBeats).toHaveLength(count);
    const old = makeWorld() as WorldState & { logic?: unknown };
    delete old.logic;
    expect(validateWorldState(old)).toBe(true);
    expect(migrateWorldState(old).logic).toBeUndefined();
  });

  test('malformed or private causal output is discarded', () => {
    expect(validateExtraction({ logic: { cause: 'something', event: 'no' } })).toBeNull();
    expect(validateExtraction({ logic: { event: 'Call me at 9876543210 immediately' } })?.logic).toBeUndefined();
  });
});

describe('v2.13 pre-display logic guards', () => {
  test('an established marriage cannot reset to “we just met”', () => {
    const rel = relationship();
    const reset = findRelationshipReset('Riya: "Hum to abhi-abhi mile hain."', [rel]);
    expect(reset?.status).toBe('married');
    const check = checkAssistantReply(parsed('Riya: "Hum to abhi-abhi mile hain."'), {
      castNames: ['Riya'], readerName: 'Ankit', logic: { relationships: [rel] },
    });
    expect(check.needsRewrite).toBe(true);
    expect(check.reasons).toContain('relationship-reset:married');
    expect(rewriteInstructionFor(check.reasons)).toContain('shared history intact');
    expect(findRelationshipReset('Riya: "Yaad hai jab hum pehli baar mile the?"', [rel])).toBeNull();
  });

  test('ambiguous multi-person reset and a stranger introduction stay free', () => {
    const rels = [relationship(), relationship('dating', 3, 'meher', 'Meher')];
    expect(findRelationshipReset('"Hum abhi mile."', rels)).toBeNull();
    expect(findRelationshipReset('Meher: "Hum abhi-abhi mile."', [relationship()])).toBeNull();
  });

  test('near-duplicate long replies are rewritten, short natural echoes are not', () => {
    const previous = 'Riya ne dheere se muskurate hue kaha ki woh kal library ke bahar tumhara intezaar karegi.';
    expect(findRepeatedReply(previous, [previous])).toBe(true);
    expect(findRepeatedReply('Riya: "Theek hai."', ['Riya: "Theek hai."'])).toBe(false);
    const check = checkAssistantReply(parsed(previous), {
      castNames: ['Riya'], logic: { recentAssistant: [previous] },
    });
    expect(check.reasons).toContain('repeat-reply');
    expect(rewriteInstructionFor(check.reasons)).toContain('fresh, direct response');
  });

  test('clear object-owner mismatch is caught without blocking a real hand-over', () => {
    const world = makeWorld();
    world.importantObjects.ring = {
      id: 'ring', name: 'silver ring', holder: 'riya', location: 'Room',
      discoveredAt: NOW, lastSeenAt: NOW, significance: 'Promise ring',
    };
    expect(findObjectOwnerContradiction('Meher ke paas silver ring hai.', world, 'Ankit')).toEqual({
      objectName: 'silver ring', expectedHolder: 'Riya', claimedHolder: 'Meher',
    });
    expect(findObjectOwnerContradiction('Riya ke paas silver ring hai.', world, 'Ankit')).toBeNull();
    expect(findObjectOwnerContradiction('Meher ke paas silver ring hai?', world, 'Ankit')).toBeNull();
    expect(findObjectOwnerContradiction('Meher ke paas silver ring nahi hai.', world, 'Ankit')).toBeNull();
    expect(findObjectOwnerContradiction('Meher ke paas silver ring hai.', world, 'Ankit', 'Main Meher ko silver ring de deta hoon.')).toBeNull();
    expect(findObjectOwnerContradiction('Riya ne Meher ko silver ring de di.\nMeher ke paas silver ring hai.', world, 'Ankit')).toBeNull();
    const check = checkAssistantReply(parsed('Meher ke paas silver ring hai.'), {
      castNames: ['Riya', 'Meher'], logic: { worldState: world, readerName: 'Ankit' },
    });
    expect(check.needsRewrite).toBe(true);
    expect(rewriteInstructionFor(check.reasons)).toContain('current holder is Riya');
  });
});
