/**
 * Memory <-> prompt wiring. Uses a real bundled story pack so the memory.json
 * hints actually exercised are the shipped ones.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContext, buildSystemPrompt, parseAssistantResponse, shortTermWindowOf } from '../src/lib/engine';
import { selectRelevant, renderMemoryLine } from '../src/lib/memoryCore';
import type {
  CharactersFile,
  LocalProfile,
  MemoryEntry,
  MemoryFile,
  Playthrough,
  ScenesFile,
  StoryBundle,
  StoryCreator,
  StoryFile,
  StoryMeta,
  WorldFile,
} from '../src/types';
import { KISSA_OWNER_CREATOR, createInitialState } from '../src/types';

// Read the shipped pack straight off disk (same fixture style as content.test.ts)
// so this covers the real memory.json hints without pulling in image imports.
const ROOT = join(__dirname, '..', 'content');
const pack = <T>(file: string): T =>
  JSON.parse(readFileSync(join(ROOT, 'stories', 'chai-dreams', file), 'utf8')) as T;
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as { stories: StoryMeta[] };

const storyFile = pack<StoryFile>('story.json');
const metaChai = manifest.stories.find((s) => s.id === 'chai-dreams')!;
const creator: StoryCreator = metaChai.creator ?? storyFile.creator ?? KISSA_OWNER_CREATOR;

const bundle: StoryBundle = {
  meta: metaChai,
  story: storyFile,
  characters: pack<CharactersFile>('characters.json'),
  world: pack<WorldFile>('world.json'),
  scenes: pack<ScenesFile>('scenes.json'),
  memory: pack<MemoryFile>('memory.json'),
  source: 'bundled',
  creator,
};

const profile = { nickname: 'Raj', ageGroup: '18+' } as unknown as LocalProfile;
const playthrough: Playthrough = {
  id: 'pt1',
  storyId: 'chai-dreams',
  label: 'Run 1',
  status: 'active',
  currentSceneId: bundle.story.openingSceneId,
  state: createInitialState(),
  progress: 0.2,
  messageCount: 40,
  endingId: null,
  mode: 'ai',
  providerId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function m(over: Partial<MemoryEntry> & { text: string }): MemoryEntry {
  return {
    id: over.id ?? `x${Math.random().toString(36).slice(2, 7)}`,
    playthroughId: 'pt1',
    kind: over.kind ?? 'story',
    importance: over.importance ?? 2,
    createdAt: over.createdAt ?? new Date().toISOString(),
    hits: 0,
    archived: false,
    ...over,
  };
}

function system(memories: MemoryEntry[], summary = ''): string {
  return buildSystemPrompt({ bundle, profile, playthrough, memories, history: [], summary }, '18+');
}

describe('shortTermWindowOf', () => {
  test('honours the story pack value', () => {
    expect(shortTermWindowOf(bundle)).toBe(bundle.memory.shortTermWindow);
  });

  test('clamps wild values into range', () => {
    expect(shortTermWindowOf({ ...bundle, memory: { ...bundle.memory, shortTermWindow: 900 } })).toBe(48);
    expect(shortTermWindowOf({ ...bundle, memory: { ...bundle.memory, shortTermWindow: 1 } })).toBe(4);
    expect(shortTermWindowOf({ ...bundle, memory: { ...bundle.memory, shortTermWindow: 0 } })).toBe(16);
  });

  test('context window is sliced to the same size (no silent 30-message cap)', () => {
    const history = Array.from({ length: 120 }, (_, i) => ({
      id: `h${i}`,
      playthroughId: 'pt1',
      role: i % 2 ? ('assistant' as const) : ('user' as const),
      speaker: null,
      text: `line ${i}`,
      sceneId: null,
      createdAt: `2026-01-01T00:00:0${i % 10}.000Z`,
    }));
    const ctx = buildContext({ bundle, profile, playthrough, memories: [], history, summary: '' }, '18+');
    expect(ctx.messages.length).toBe(shortTermWindowOf(bundle));
  });
});

describe('system prompt memory wiring', () => {
  const memories = [
    m({ id: 'a', kind: 'story', text: 'Kabir ne audition ke baad maafi maangi', importance: 4 }),
    m({ id: 'b', kind: 'episode', text: 'U: main play karunga | Narrator ne clue diya', importance: 1 }),
    m({ id: 'c', kind: 'preference', text: 'User likes chai.', importance: 3, playthroughId: '*' }),
  ];

  test('ranked memories are injected with kind tags', () => {
    const s = system(memories);
    expect(s).toContain('- [story] Kabir ne audition ke baad maafi maangi');
    expect(s).toContain('- [log] U: main play karunga');
    expect(s).toContain('- [preference] User likes chai.');
  });

  test('episodic logs render as [log] not [episode]', () => {
    expect(renderMemoryLine(memories[1])).toBe('- [log] U: main play karunga | Narrator ne clue diya');
    expect(system(memories)).not.toContain('[episode]');
  });

  test('rolling digest gets its own pinned section', () => {
    const s = system([], 'Raj narrator bana.\nPlay ka climax missing hai.');
    expect(s).toContain('STORY SO FAR (compressed memory');
    expect(s).toContain('Raj narrator bana.');
  });

  test('no digest section when there is nothing folded yet', () => {
    expect(system(memories)).not.toContain('STORY SO FAR');
  });

  test('story pack extractionHints and neverRemember reach the model', () => {
    const s = system(memories);
    expect(s).toContain('MEMORY DISCIPLINE');
    for (const hint of bundle.memory.extractionHints) expect(s).toContain(hint);
    for (const never of bundle.memory.neverRemember) expect(s).toContain(never);
  });

  test('the narrator is told to save reader facts, and that memory stays hidden', () => {
    const s = system(memories);
    expect(s).toContain('outlive this story');
    expect(s).toContain('Nothing you write in "memory" is shown to the reader');
  });

  test('seed memories still fill an empty DB', () => {
    const s = system([]);
    expect(s).toContain(bundle.memory.seedMemories[0].slice(0, 24));
  });
});

describe('narrator-emitted memory', () => {
  test('up to 8 notes per reply survive parsing (was capped at 5)', () => {
    const notes = Array.from({ length: 12 }, (_, i) => `fact ${i} about myra`);
    const raw = ['Myra: "Chal."', '```kissa-state', `{"memory":[${notes.map((n) => JSON.stringify(n)).join(',')}]}`, '```'].join(
      '\n',
    );
    const parsed = parseAssistantResponse(raw);
    expect(parsed.memoryNotes).toHaveLength(8);
    expect(parsed.memoryNotes[0]).toBe('fact 0 about myra');
  });

  test('memory notes are stripped from the visible reply', () => {
    const parsed = parseAssistantResponse(
      `*Woh muskurayi.*\nMyra: "Haan."\n\`\`\`kissa-state\n{"memory":["Myra ne haan kaha"]}\n\`\`\``,
    );
    expect(parsed.displayText).not.toContain('kissa-state');
    expect(parsed.memoryNotes).toEqual(['Myra ne haan kaha']);
  });
});

describe('prompt budget stays bounded as memory grows', () => {
  test('a 600-fact journey does not blow up the prompt', () => {
    const many: MemoryEntry[] = Array.from({ length: 600 }, (_, i) =>
      m({ id: `f${i}`, text: `Detail ${i}: Myra ne chapter ${i} mein chai ka cup todo`, importance: i % 9 }),
    );
    const picked = selectRelevant(many, 'Myra ne kaunsa cup toda tha', { maxItems: 28 });
    const s = system(picked, 'digest text');
    expect(picked.length).toBeLessThanOrEqual(28);
    expect(s.length).toBeLessThan(14_000);
  });
});
