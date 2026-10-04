/**
 * v2.5.1 — the retrieval → prompt wiring.
 *
 * Proves the read pipeline end to end: archived events, persistent relationship
 * state and character knowledge are selected for the CURRENT turn and injected
 * into the narrator prompt as a bounded, source-tagged block — never as a dump
 * of the whole archive, and never against a different story.
 */
import type { LocalProfile, Playthrough, StoryBundle } from '../src/types';
import { KISSA_OWNER_CREATOR, createInitialState } from '../src/types';
import { buildContext, buildSystemPrompt } from '../src/lib/engine';
import {
  createStoryMemoryEngine,
  recallStoryMemoryForPrompt,
  type StoryMemoryEngine,
} from '../src/lib/storyMemory';
import { createInMemoryStoryMemoryStore } from '../src/lib/storyMemoryStore';

function makeBundle(storyId = 'arranged-marriage-wala-love'): StoryBundle {
  return {
    meta: { id: storyId, title: 'Arrange Wali Love', accentColor: '#f0a', cover: 'c.png', storyDir: storyId },
    story: {
      storyId, title: 'Arrange Wali Love', premise: 'Rampur intro.', tone: 'warm',
      userRole: 'MC', setting: 'Rampur', openingSceneId: 's1', tags: [], safetyNotes: [],
    },
    characters: {
      storyId, version: 1,
      characters: [
        {
          id: 'poonam', name: 'Poonam', role: 'The young woman.', personality: 'Thoughtful.',
          background: '', goals: [], fears: [], likes: [], dislikes: [], speakingStyle: 'Gentle.',
          sampleLine: 'Ji?', relationshipWithUser: 'Courteous at first.', knowledge: [],
        },
        {
          id: 'bhabhi', name: 'Bhabhi', role: "Elder brother's wife.", personality: 'Chatty.',
          background: '', goals: [], fears: [], likes: [], dislikes: [], speakingStyle: 'Chatty.',
          sampleLine: 'Arre!', relationshipWithUser: 'Friendly.', knowledge: [],
        },
      ],
    },
    world: {
      storyId, version: 1, premise: 'Rampur',
      locations: [{ name: 'Rampur veranda', description: '' }], rules: [], lore: [],
    },
    scenes: {
      storyId, version: 1,
      scenes: [{ id: 's1', title: 'Chai', narration: ['Veranda me chai.'], fallbackLines: [], choices: [] }],
      endings: [],
    },
    memory: { storyId, version: 1, shortTermWindow: 16, seedMemories: ['Seed fact.'], extractionHints: [], neverRemember: [] },
    source: 'bundled',
    creator: KISSA_OWNER_CREATOR,
  } as unknown as StoryBundle;
}

const profile = { nickname: 'Ankit', ageGroup: '18+' } as unknown as LocalProfile;

function makePlaythrough(id: string, storyId: string): Playthrough {
  return {
    id, storyId, label: id, status: 'active', currentSceneId: 's1', state: createInitialState(),
    progress: 0, messageCount: 0, endingId: null, mode: 'ai', providerId: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

describe('memory retrieval → narrator prompt', () => {
  let engine: StoryMemoryEngine;
  let bundle: StoryBundle;
  let playthrough: Playthrough;

  beforeEach(async () => {
    const store = createInMemoryStoryMemoryStore();
    engine = createStoryMemoryEngine(store);
    bundle = makeBundle();
    playthrough = makePlaythrough('ptPrompt', bundle.meta.id);
    await engine.writeTurn({
      playthrough, bundle, playerName: 'Ankit',
      userText: 'Bhabhi, ye raaz kisi ko mat batana. Waada?',
      assistantText: 'Bhabhi: "Waada, main kisi ko nahi bataungi."\n*Bhabhi ne chup rehne ka waada kiya.*',
      messageIds: ['m1', 'm2'], location: 'Rampur veranda', storyDay: 1,
    });
    await engine.writeTurn({
      playthrough, bundle, playerName: 'Ankit',
      userText: 'Aaj humari shaadi ho gayi, Poonam meri biwi hai.',
      assistantText: 'Poonam: "Ab hum ek ho gaye."',
      messageIds: ['m3', 'm4'], location: 'Rampur veranda', storyDay: 9,
    });
    await engine.writeTurn({
      playthrough, bundle, playerName: 'Ankit',
      userText: 'Poonam ko pata hai ki Bhabhi ne ek raaz chhupaya hai.',
      assistantText: 'Poonam: "Mujhe pata hai."',
      messageIds: ['m5', 'm6'], location: 'Bazaar', storyDay: 12,
    });
  });

  test('the retrieved block contains relationship state, the promise and knowledge', async () => {
    const { block, result } = await recallStoryMemoryForPrompt({
      playthrough, bundle, engine,
      query: 'Poonam aur Bhabhi ke saath kya kya hua tha? Kya waada hua tha?',
      characters: ['poonam', 'bhabhi'],
      location: 'Rampur veranda',
      currentSeq: 3,
    });
    expect(result.events.length).toBeGreaterThan(0);
    expect(block).toContain('CURRENT RELATIONSHIP STATE');
    expect(block).toMatch(/Poonam.*MARRIED/s);
    expect(block).toMatch(/waada|promise/i);
    expect(block).toContain('CHARACTER KNOWLEDGE');
    expect(block).toMatch(/Poonam knows/);
  });

  test('the injected block reaches the system prompt with the continuity law', async () => {
    const { block } = await recallStoryMemoryForPrompt({
      playthrough, bundle, engine,
      query: 'Bhabhi ko diya waada yaad hai?',
      characters: ['bhabhi'],
      currentSeq: 3,
    });
    const system = buildSystemPrompt(
      { bundle, profile, playthrough, memories: [], history: [], summary: '', storyMemoryBlock: block },
      '18+',
    );
    expect(system).toContain('LONG-TERM STORY ARCHIVE');
    expect(system).toContain('CONTINUITY LAW');
    expect(system).toContain('never reset a relationship');
    expect(system).toContain('act ONLY on what THEY know');
    // The block is retrieval-driven, so a Bhabhi question still carries the
    // married state of the Poonam pair (current state is always in view) …
    expect(system).toMatch(/Poonam.*MARRIED/s);
    // … while the prompt stays bounded.
    expect(system.length).toBeLessThan(16000);
  });

  test('a long archive does not inflate the prompt (retrieval, not dumping)', async () => {
    for (let i = 0; i < 120; i++) {
      await engine.writeTurn({
        playthrough, bundle, playerName: 'Ankit',
        userText: `Poonam ne aaj mujhe purani diary dikhayi aur usme likhi ek baat batayi (${i}).`,
        assistantText: `Poonam: "Ye diary mere liye bahut khaas hai (${i})."`,
        messageIds: [`x${i}a`, `x${i}b`], location: 'Rampur veranda', storyDay: 20 + i,
      });
    }
    const statsBefore = await engine.stats(playthrough.id);
    const { block } = await recallStoryMemoryForPrompt({
      playthrough, bundle, engine, query: 'Poonam ke saath kya hua?', characters: ['poonam'], currentSeq: 200,
    });
    const system = buildSystemPrompt(
      { bundle, profile, playthrough, memories: [], history: [], summary: '', storyMemoryBlock: block },
      '18+',
    );
    // Archive grew, prompt did not scale with it.
    expect(statsBefore.events).toBeGreaterThan(10);
    expect(system.length).toBeLessThan(16000);
    expect(block.length).toBeLessThanOrEqual(4300);
  });

  test('a different story never contributes to this prompt', async () => {
    const other = makePlaythrough('ptOther', 'zara-mumbai-mafia-queen');
    const otherBundle = makeBundle('zara-mumbai-mafia-queen');
    await engine.writeTurn({
      playthrough: other, bundle: otherBundle, playerName: 'Ankit',
      userText: 'Zara ne mujhe dhokha diya.',
      assistantText: 'Zara: "Dhokha toh maine bhi khaaya."',
      messageIds: ['z1', 'z2'], location: 'Dock', storyDay: 1,
    });
    const { block } = await recallStoryMemoryForPrompt({
      playthrough, bundle, engine, query: 'Zara dhokha kya tha?', characters: [], currentSeq: 4,
    });
    expect(block).not.toContain('Zara');
    expect(block).not.toContain('Dhokha toh maine bhi');
  });

  test('buildContext passes the block through to the model messages', async () => {
    const { block } = await recallStoryMemoryForPrompt({
      playthrough, bundle, engine, query: 'shaadi kab hui?', characters: ['poonam'], currentSeq: 3,
    });
    const ctx = buildContext(
      { bundle, profile, playthrough, memories: [], history: [], summary: '', storyMemoryBlock: block },
      '18+',
    );
    expect(ctx.system).toContain('LONG-TERM STORY ARCHIVE');
    expect(ctx.messages).toEqual([]);
  });
});
