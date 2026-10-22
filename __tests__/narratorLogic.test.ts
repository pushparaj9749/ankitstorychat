/**
 * v2.10.3 — narrator logic fixes (owner bug report):
 *  1. close characters were dragged into scenes ("present" just for being
 *     MENTIONED, and replies had to end on a hook → surprise arrivals);
 *  2. NPCs broke promises again and again and didn't know their own mistake
 *     (no promise ledger, no self-awareness rule);
 *  3. a loving girlfriend answered "main ja raha hoon" with "chale jao agar
 *     jana hai" (no proportionality rule, and every new relationship was
 *     printed as "affection 20").
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
  buildSystemPrompt,
  buildPrivateNotes,
  checkAssistantReply,
  EMOTIONAL_LOGIC_LAW,
  findUninvitedSpeakers,
  LOGIC_CHECK,
  PROMISE_LAW,
  REWRITE_INSTRUCTION,
  rewriteInstructionFor,
  SCENE_PRESENCE_LAW,
  sceneRosterLine,
  buildStateExtractionMessages,
  type ParsedAssistant,
} from '../src/lib/engine';
import { heuristicExtraction, runMemoryWritePipeline, toStateUpdate, validateExtraction } from '../src/lib/memoryEngine';
import { inferPresence, normalizeCharacterRefs, normalizePromiseParty } from '../src/lib/scenePresence';
import {
  applyPromiseChanges,
  applyWorldStateUpdate,
  createInitialWorldState,
  describeRelationship,
  renderWorldStateForPrompt,
  type WorldState,
} from '../src/lib/worldState';
import type { CharactersFile, LocalProfile, MemoryFile, Playthrough, ScenesFile, StoryBundle, StoryFile, StoryMeta, WorldFile } from '../src/types';
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
  id: 'p1', storyId: ID, label: 'Journey 1', status: 'active', currentSceneId: bundle.story.openingSceneId,
  state: createInitialState(), progress: 0, messageCount: 12, endingId: null, mode: 'ai', providerId: null,
  createdAt: '2026-10-23T00:00:00Z', updatedAt: '2026-10-23T00:00:00Z',
} as unknown as Playthrough;
const profile = { nickname: 'Ankit', ageGroup: '18+' } as unknown as LocalProfile;
const cast = bundle.characters.characters;
const castNames = cast.map((c) => c.name);

function worldWith(present: string[]): WorldState {
  const ws = createInitialWorldState(pt, bundle);
  return applyWorldStateUpdate(ws, { presentCharacters: present, confidence: 'high' });
}

const prompt = (ws: WorldState | null = null) =>
  buildSystemPrompt({ bundle, profile, playthrough: pt, memories: [], history: [], worldState: ws, stateMode: 'separate' } as any, '18+');

describe('replies no longer have to end on a hook', () => {
  const p = prompt();
  test('the hook requirement is gone', () => {
    expect(p).not.toMatch(/ending with a hook/i);
    expect(p).not.toMatch(/end with an organic opening/i);
    expect(p).toMatch(/A question, hook, cliffhanger, twist or new event is NOT required/);
  });
});

describe('the three laws are in every story prompt, before the logic check', () => {
  const p = prompt();
  test.each([
    ['scene presence', SCENE_PRESENCE_LAW],
    ['promises', PROMISE_LAW],
    ['emotional logic', EMOTIONAL_LOGIC_LAW],
  ])('%s law', (_n, law) => {
    expect(p).toContain(law);
    expect(p.indexOf(law)).toBeLessThan(p.indexOf(LOGIC_CHECK));
    expect(p.indexOf(law)).toBeGreaterThan(p.indexOf('=== END OF PRIVATE NARRATOR NOTES ==='));
  });
  test('the laws say what the owner asked for', () => {
    expect(SCENE_PRESENCE_LAW).toMatch(/Talking ABOUT someone does not bring them in/);
    expect(SCENE_PRESENCE_LAW).toMatch(/Private and romantic moments stay private/);
    expect(PROMISE_LAW).toMatch(/KNOWS it/);
    expect(PROMISE_LAW).toMatch(/never breaks the same promise again/);
    expect(EMOTIONAL_LOGIC_LAW).toMatch(/main ja raha hoon/);
    expect(EMOTIONAL_LOGIC_LAW).toMatch(/No cold ultimatums/);
    expect(EMOTIONAL_LOGIC_LAW).toMatch(/Never invent conflict/);
  });
  test('the logic check points at the laws', () => {
    expect(LOGIC_CHECK).toMatch(/SCENE PRESENCE LAW/);
    expect(LOGIC_CHECK).toMatch(/EMOTIONAL LOGIC LAW/);
    expect(LOGIC_CHECK).toMatch(/PROMISE & SELF-AWARENESS LAW/);
  });
});

describe('scene roster + relationship baseline in the private notes', () => {
  test('roster names who is here and who is elsewhere', () => {
    const line = sceneRosterLine(bundle, worldWith(['riya']));
    expect(line).toMatch(/WHO IS IN THE SCENE RIGHT NOW: Riya Chaturvedi/);
    expect(line).toMatch(/ELSEWHERE.*Ajay Chaturvedi/);
    expect(sceneRosterLine(bundle, null)).toBe('');
    expect(sceneRosterLine(bundle, createInitialWorldState(pt, bundle))).toBe('');
  });
  test('the private notes carry the roster and each bond from the character sheet', () => {
    const notes = buildPrivateNotes({ bundle, profile, playthrough: pt, memories: [], history: [], worldState: worldWith(['riya']) } as any);
    expect(notes).toMatch(/WHO IS IN THE SCENE RIGHT NOW/);
    expect(notes).toMatch(/RELATIONSHIP WITH THE READER/);
    expect(notes).toMatch(/Riya Chaturvedi: His bold, fearless girlfriend of two years/);
  });
});

describe('relationships are words, never misleading default numbers', () => {
  test('a brand-new relationship record says nothing (no "affection 20")', () => {
    const ws = applyWorldStateUpdate(worldWith(['riya']), { relationshipPatch: { riya: { deltaTrust: 0, confidence: 'high' } }, confidence: 'high' });
    const text = renderWorldStateForPrompt(ws);
    expect(text).not.toMatch(/affection \d|trust \d|tension \d/);
    expect(describeRelationship(ws.relationships.riya)).toBe('');
  });
  test('real changes are described', () => {
    const ws = applyWorldStateUpdate(worldWith(['riya']), {
      relationshipPatch: { riya: { deltaTrust: 20, tension: 65, confidence: 'high' } },
      confidence: 'high',
    });
    const text = renderWorldStateForPrompt(ws);
    expect(text).toMatch(/Riya Chaturvedi: trusts the reader much more than at the start; real tension right now/);
  });
});

describe('presence: a mention is not an arrival', () => {
  const ws = worldWith(['riya']);
  test('talking ABOUT Ajay does not put him in the scene', () => {
    const out = heuristicExtraction(
      'Main ja raha hoon',
      'Riya Chaturvedi: "Ajay bhaiya ko pata chala to woh tumhe zinda nahi chhodenge."',
      bundle,
      ws,
    );
    expect(out?.presentCharacters).toBeUndefined();
  });
  test('speaking or arriving does', () => {
    expect(inferPresence(cast, ['riya'], 'Ajay: "Riya! Ghar chalo."')).toEqual(['riya', 'ajay']);
    expect(inferPresence(cast, ['riya'], '*Tabhi Chutki darwaze se andar aa gayi.*')).toEqual(['riya', 'chutki']);
  });
  test('a departure removes someone', () => {
    expect(inferPresence(cast, ['riya', 'gappu'], '*Gappu muskurata hua wahan se chala gaya.*')).toEqual(['riya']);
  });
  test('nothing changed → null (no state write)', () => {
    expect(inferPresence(cast, ['riya'], 'Riya: "Itni jaldi? Kahan ja rahe ho?"')).toBeNull();
  });
  test('record-keeper names are mapped to ids and the reader is dropped', () => {
    expect(normalizeCharacterRefs(['Riya', 'Ankit', 'player', 'Gappu Nishad'], cast, 'Ankit')).toEqual(['riya', 'gappu']);
    expect(normalizePromiseParty('Ankit', cast, 'Ankit')).toBe('player');
    expect(normalizePromiseParty('Riya', cast, 'Ankit')).toBe('riya');
  });
});

describe('reply guard: nobody barges in', () => {
  const base = { castNames, presentNames: ['Riya Chaturvedi'] };
  test('an absent character who speaks is flagged', () => {
    expect(findUninvitedSpeakers({ ...base, text: 'Ajay: "Yahan kya ho raha hai?"', speaker: null })).toEqual(['Ajay Chaturvedi']);
  });
  test('a phone call is an interruption too', () => {
    expect(findUninvitedSpeakers({ ...base, text: 'Ajay (phone pe): "Riya kahan hai?"', speaker: null })).toEqual(['Ajay Chaturvedi']);
  });
  test('present characters, first names and the bubble speaker are fine', () => {
    expect(findUninvitedSpeakers({ ...base, text: '"Itni jaldi?"', speaker: 'Riya' })).toEqual([]);
  });
  test('called by the reader, or part of the recent conversation → allowed', () => {
    expect(findUninvitedSpeakers({ ...base, text: 'Gappu: "Aa gaya bhai!"', speaker: null, readerText: 'Gappu ko phone karo, bulao!' })).toEqual([]);
    expect(findUninvitedSpeakers({ ...base, text: 'Gappu: "Haan bhai."', speaker: null, recentSpeakers: ['Gappu Nishad'] })).toEqual([]);
  });
  test('unknown roster → no check', () => {
    expect(findUninvitedSpeakers({ ...base, presentNames: [], text: 'Ajay: "Hey"', speaker: null })).toEqual([]);
  });
  test('checkAssistantReply asks for one silent rewrite with a specific nudge', () => {
    const parsed = { displayText: '*Darwaza khulta hai.*\nAjay Chaturvedi: "Riya! Ghar chalo."', speaker: 'Riya Chaturvedi', memoryNotes: [] } as unknown as ParsedAssistant;
    const check = checkAssistantReply(parsed, { castNames, readerName: 'Ankit', presence: { presentNames: ['Riya Chaturvedi'], readerText: 'Main ja raha hoon' } });
    expect(check.needsRewrite).toBe(true);
    expect(check.reasons).toContain('uninvited:Ajay Chaturvedi');
    const nudge = rewriteInstructionFor(check.reasons);
    expect(nudge).toMatch(/Ajay Chaturvedi must not appear, speak, call, message or interrupt/);
    expect(nudge).toMatch(/Do not replace them with another interruption/);
    expect(nudge).not.toContain(REWRITE_INSTRUCTION);
  });
  test('without the presence option nothing changes for old callers', () => {
    const parsed = { displayText: 'Ajay Chaturvedi: "Riya!"', speaker: null, memoryNotes: [] } as unknown as ParsedAssistant;
    expect(checkAssistantReply(parsed, { castNames, readerName: 'Ankit' }).needsRewrite).toBe(false);
  });
});

describe('promise ledger', () => {
  test('promises are recorded, deduplicated, then kept or broken', () => {
    let list = applyPromiseChanges([], [{ by: 'gappu', to: 'player', text: 'Raat 12 baje ghat pe naav lekar milunga' }], [], 3);
    list = applyPromiseChanges(list, [{ by: 'gappu', to: 'player', text: 'raat 12 baje ghat pe naav lekar milunga!' }], [], 4);
    expect(list).toHaveLength(1);
    list = applyPromiseChanges(list, [], [{ text: 'Gappu ghat pe naav lekar milunga', status: 'broken' }], 6);
    expect(list[0]).toMatchObject({ status: 'broken', updatedAtTurn: 6 });
  });
  test('the narrator sees open and broken promises, and that the breaker knows', () => {
    let ws = worldWith(['riya']);
    ws = applyWorldStateUpdate(ws, {
      promisesAdd: [
        { by: 'riya', to: 'player', text: 'Kabhi tumse jhooth nahi bolungi' },
        { by: 'gappu', to: 'player', text: 'Raat 12 baje ghat pe naav lekar milunga' },
      ],
      confidence: 'high',
    });
    ws = applyWorldStateUpdate(ws, { promisesUpdate: [{ text: 'ghat pe naav lekar milunga', status: 'broken' }], confidence: 'high' });
    const text = renderWorldStateForPrompt(ws);
    expect(text).toMatch(/OPEN — Riya Chaturvedi promised the reader: "Kabhi tumse jhooth nahi bolungi" \(must be kept\)/);
    expect(text).toMatch(/BROKEN — Gappu Nishad broke the promise to the reader: .*\(Gappu Nishad knows it\)/);
  });
  test('the ledger is capped', () => {
    const words = ['chai', 'ghat', 'naav', 'station', 'mandir', 'gali', 'dukaan', 'guitar', 'mehendi', 'saree', 'bazaar', 'college', 'train', 'highway', 'phone', 'letter', 'ring', 'diya', 'baarish', 'raat'];
    const add = words.map((w, i) => ({ by: 'riya', to: 'player', text: `${w}${i} wala waada${i} pakka${i}` }));
    expect(applyPromiseChanges([], add, [], 1).filter((p) => p.status === 'active')).toHaveLength(12);
  });
  test('the record-keeper is asked for promises and extraction maps them into the update', () => {
    const sys = buildStateExtractionMessages({ bundle, playthrough: pt, worldState: null, userText: 'x', assistantText: 'y', assistantSpeaker: null, playerName: 'Ankit' })[0].content;
    expect(sys).toMatch(/"promises": \[\{"by"/);
    expect(sys).toMatch(/"promisesBroken"/);
    expect(sys).toMatch(/only talked about.*is NOT present/);
    const ex = validateExtraction({ promises: [{ by: 'riya', to: 'player', what: 'Kal subah 6 baje station pe milungi' }], promisesKept: ['kal subah station pe milungi'] })!;
    expect(ex).not.toBeNull();
    const up = toStateUpdate(ex, worldWith(['riya']), null);
    expect(up.promisesAdd).toEqual([{ by: 'riya', to: 'player', text: 'Kal subah 6 baje station pe milungi' }]);
    expect(up.promisesUpdate).toEqual([{ text: 'kal subah station pe milungi', status: 'kept' }]);
  });
  test('older saved world states (no promises field) still render', () => {
    const ws = worldWith(['riya']);
    delete (ws as any).promises;
    expect(() => renderWorldStateForPrompt(ws)).not.toThrow();
  });
});

describe('memory write pipeline (end to end)', () => {
  test('record-keeper names become ids, the speaker counts as present, promises land in the ledger', async () => {
    const ws = worldWith(['riya']);
    const res = await runMemoryWritePipeline({
      playthrough: pt,
      bundle,
      userText: 'Gappu ko bulao',
      assistantText: 'Gappu Nishad: "Aa gaya bhai! Raat 12 baje naav tayyar rahegi, waada."',
      parsedExtractionRaw: {
        presentCharacters: ['Riya', 'Ankit'],
        promises: [{ by: 'Gappu', to: 'Ankit', what: 'Raat 12 baje naav tayyar rahegi' }],
      },
      worldState: ws,
      skipEpisode: true,
      playerName: 'Ankit',
    });
    expect(res.worldState.presentCharacters.sort()).toEqual(['gappu', 'riya']);
    expect(res.worldState.promises).toEqual([
      expect.objectContaining({ by: 'gappu', to: 'player', text: 'Raat 12 baje naav tayyar rahegi', status: 'active' }),
    ]);
  });
  test('a reply that only MENTIONS Ajay leaves the roster alone', async () => {
    const ws = worldWith(['riya']);
    const res = await runMemoryWritePipeline({
      playthrough: pt,
      bundle,
      userText: 'Main ja raha hoon',
      assistantText: 'Riya Chaturvedi: "Itni jaldi? Ajay bhaiya ke aane se pehle ek chai toh pee lo."',
      parsedExtractionRaw: { activity: 'saying goodbye at the ghat' },
      worldState: ws,
      skipEpisode: true,
      playerName: 'Ankit',
    });
    expect(res.worldState.presentCharacters).toEqual(['riya']);
  });
});

describe('Chat wiring', () => {
  const src = fs.readFileSync(fsPath.join(ROOT, 'src/screens/Chat.tsx'), 'utf8');
  test('the reply check gets the scene roster and the rewrite is specific', () => {
    expect(src).toMatch(/presence: checkPresence/);
    expect(src).toMatch(/rewriteInstructionFor\(check\.reasons\)/);
    expect(src).toMatch(/request\.kind !== 'scene'/);
  });
  test('Continue only moves characters already in the scene and never invents conflict', () => {
    expect(src).toMatch(/characters ALREADY IN THE SCENE move the moment forward — nobody new arrives/);
    expect(src).toMatch(/never invent a conflict/);
    expect(src).not.toMatch(/end with an organic opening/);
  });
  test('the memory pipeline learns who actually spoke', () => {
    expect(src).toMatch(/assistantText: speaker \? `\$\{speaker\}: \$\{displayText\}` : displayText/);
    expect(src).toMatch(/playerName: profile\.nickname,/);
  });
});
