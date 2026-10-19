/**
 * v2.7.0 strong memory: 3 stages, private notes, silent record-keeper,
 * reply check, key-facts change log, chapters.
 */
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('../src/lib/db', () => ({ kvGet: jest.fn(async () => null), kvSet: jest.fn(async () => undefined), kvDelete: jest.fn(async () => undefined) }));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildContext,
  buildPrivateNotes,
  buildStateExtractionMessages,
  buildSystemPrompt,
  checkAssistantReply,
  parseAssistantResponse,
  parseExtractedState,
  PRIVATE_NOTES_CLOSE,
  PRIVATE_NOTES_OPEN,
} from '../src/lib/engine';
import { guardVisibleText } from '../src/lib/leakGuard';
import { fallbackChapterText } from '../src/lib/chapters';
import { applyWorldStateUpdate, createInitialWorldState, renderWorldStateForPrompt } from '../src/lib/worldState';
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


const input = (over: Partial<Parameters<typeof buildSystemPrompt>[0]> = {}) => ({
  bundle,
  profile,
  playthrough,
  memories: [],
  history: [],
  summary: 'Raj aur Meera pehli baar canteen mein mile.',
  chapters: [{ title: 'Pehli Mulaqat', text: 'Raj ne Meera ko chai offer ki aur dosti shuru hui.' }],
  ...over,
});

describe('v2.7.0 — 3-stage prompt with private notes', () => {
  test('separate mode never asks the story reply for state', () => {
    const sys = buildSystemPrompt({ ...input(), stateMode: 'separate' }, '18+');
    expect(sys).not.toContain('append a hidden state block');
    expect(sys).not.toContain('MEMORY DISCIPLINE');
    expect(sys).toContain('Write ONLY the visible story reply');
    expect(sys).toContain('SECRECY LAW');
  });

  test('inline mode (legacy) still documents the kissa-state block', () => {
    const sys = buildSystemPrompt(input(), '18+');
    expect(sys).toContain('kissa-state');
    expect(sys).toContain('MEMORY DISCIPLINE');
  });

  test('stage 1 + stage 3 live inside ONE fenced private block; stage 2 is the transcript', () => {
    const sys = buildSystemPrompt({ ...input(), stateMode: 'separate' }, '18+');
    const open = sys.indexOf(PRIVATE_NOTES_OPEN);
    const close = sys.indexOf(PRIVATE_NOTES_CLOSE);
    expect(open).toBeGreaterThan(0);
    expect(close).toBeGreaterThan(open);
    const notes = sys.slice(open, close);
    expect(notes).toContain('STAGE 1');
    expect(notes).toContain('STORY SO FAR');
    expect(notes).toContain('Pehli Mulaqat');
    expect(notes).toContain('STAGE 3');
    expect(sys).toContain('STAGE 2');
    expect(sys).toContain('last 20 chats');
  });

  test('character knowledge and lore are narrator-only (not in public cards)', () => {
    const sys = buildSystemPrompt({ ...input(), stateMode: 'separate' }, '18+');
    const open = sys.indexOf(PRIVATE_NOTES_OPEN);
    const close = sys.indexOf(PRIVATE_NOTES_CLOSE);
    const publicPart = sys.slice(0, open) + sys.slice(close);
    expect(publicPart).not.toMatch(/\bKnows:/);
    expect(publicPart).not.toMatch(/^LORE:/m);
    const withKnowledge = bundle.characters.characters.find((c) => c.knowledge?.length);
    if (withKnowledge) expect(sys.slice(open, close)).toContain(`${withKnowledge.name} knows:`);
  });

  test('buildContext hands back the same private notes for copy detection', () => {
    const ctx = buildContext({ ...input(), stateMode: 'separate' }, '18+');
    expect(ctx.system).toContain(ctx.privateNotes);
    expect(ctx.privateNotes).toBe(buildPrivateNotes({ ...input(), stateMode: 'separate' }));
  });

  test('history sent back to the model is cleaned of old leaks', () => {
    const history = [
      { id: 'u1', playthroughId: 'pt1', role: 'user' as const, speaker: null, text: 'hi', sceneId: null, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'a1', playthroughId: 'pt1', role: 'assistant' as const, speaker: 'Meera', text: '"Arre Raj!"\n\nImportant objects: chai glass (Meera)', sceneId: null, createdAt: '2026-01-01T00:00:01.000Z' },
    ];
    const ctx = buildContext({ ...input(), history }, '18+');
    const a = ctx.messages.find((x) => x.role === 'assistant')!;
    expect(a.content).toContain('Arre Raj!');
    expect(a.content).not.toContain('Important objects');
  });
});

describe('v2.7.0 — silent record-keeper', () => {
  test('extraction prompt lists scene ids, character ids and the exchange', () => {
    const msgs = buildStateExtractionMessages({
      bundle,
      playthrough,
      userText: 'Main tumhe ye earbud deta hoon',
      assistantText: '*Meera muskurayi.*',
      assistantSpeaker: 'Meera',
      playerName: 'Raj',
    });
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain(bundle.scenes.scenes[0].id);
    expect(msgs[0].content).toContain(bundle.characters.characters[0].id);
    expect(msgs[0].content).toContain('ONLY one JSON object');
    expect(msgs[1].content).toContain('earbud');
    expect(msgs[1].content).toContain('Meera: *Meera muskurayi.*');
  });

  test('parseExtractedState accepts bare, fenced and chatty JSON', () => {
    const bare = parseExtractedState('{"memory":["Raj ne Meera ko earbud diya"],"relationships":{"meera":3}}');
    expect(bare?.memoryNotes).toContain('Raj ne Meera ko earbud diya');
    expect(bare?.effects?.relationships).toBeDefined();
    const fenced = parseExtractedState('```json\n{"location":"Library"}\n```');
    expect(fenced?.effects?.location).toBe('Library');
    const chatty = parseExtractedState('Here you go: {"importantObjects":[{"name":"earbud","holder":"meera"}]} done');
    expect(chatty?.rawStateJson).toBeDefined();
    expect(parseExtractedState('nothing changed')).toBeNull();
  });
});

describe('v2.7.0 — reply check before the reader sees it', () => {
  const opts = { castNames: bundle.characters.characters.map((c) => c.name), readerName: 'Raj' };

  test('a clean reply passes untouched', () => {
    const r = checkAssistantReply(parseAssistantResponse('*Meera hasti hai.*\nMeera: "Chai piyoge?"'), opts);
    expect(r.needsRewrite).toBe(false);
    expect(r.text).toContain('Chai piyoge?');
  });

  test('a leaky reply is cleaned AND flagged for one silent rewrite', () => {
    const r = checkAssistantReply(parseAssistantResponse('*Meera hasti hai.*\n\nMemory: Raj ne promise kiya'), opts);
    expect(r.needsRewrite).toBe(true);
    expect(r.text).not.toContain('Memory');
  });

  test('speaking for the reader is flagged', () => {
    const r = checkAssistantReply(parseAssistantResponse('Raj: "Haan main chalunga."\n*Meera khush hui.*'), opts);
    expect(r.needsRewrite).toBe(true);
    expect(r.speaker).toBeNull();
    expect(r.text).not.toContain('main chalunga');
  });

  test('copied private notes are caught', () => {
    const notes = buildPrivateNotes(input());
    const r = checkAssistantReply(
      parseAssistantResponse('*Meera hasti hai.*\nRaj ne Meera ko chai offer ki aur dosti shuru hui.'),
      { ...opts, privateNotes: notes },
    );
    expect(r.needsRewrite).toBe(true);
    expect(r.text).not.toContain('dosti shuru hui');
  });
});

describe('v2.7.0 — key facts change log + chapters', () => {
  test('object holder changes are logged and rendered', () => {
    let ws = createInitialWorldState(playthrough, bundle);
    ws = applyWorldStateUpdate(ws, { importantObjectsPatch: { earbud: { name: 'earbud', holder: 'meera' } } } as any);
    ws = applyWorldStateUpdate(ws, { importantObjectsPatch: { earbud: { name: 'earbud', holder: 'player' } } } as any);
    const obj = Object.values(ws.importantObjects)[0];
    expect(obj.holder).toBe('player');
    expect(obj.holderLog?.[0]).toMatch(/meera → player \(turn \d+\)/);
    expect(renderWorldStateForPrompt(ws)).toContain('history: meera → player');
  });

  test('fallback chapter text is leak-free and bounded', () => {
    const msgs = Array.from({ length: 12 }, (_, i) => ({
      id: `m${i}`,
      playthroughId: 'pt1',
      role: (i % 2 ? 'assistant' : 'user') as 'assistant' | 'user',
      speaker: i % 2 ? 'Meera' : null,
      text: i === 3 ? '"Haan."\nImportant objects: earbud (Meera)' : `beat ${i} ${'x'.repeat(30)}`,
      sceneId: null,
      createdAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`,
    }));
    const text = fallbackChapterText(msgs, ['Meera']);
    expect(text.length).toBeLessThanOrEqual(520);
    expect(text).not.toContain('Important objects');
    expect(text).toContain('beat 0');
  });
});

describe('v2.7.0 — no shipped character name is ever eaten by the leak guard', () => {
  const fs = require('fs');
  const dirs: string[] = fs.readdirSync(join(ROOT, 'stories'));
  const names = new Set<string>();
  for (const d of dirs) {
    try {
      const c = JSON.parse(readFileSync(join(ROOT, 'stories', d, 'characters.json'), 'utf8'));
      for (const ch of c.characters) {
        names.add(ch.name);
        names.add(String(ch.name).split(' ')[0]);
      }
    } catch {
      /* not a story dir */
    }
  }
  test(`${names.size} names survive render-time sanitising (no cast list available there)`, () => {
    const eaten = [...names].filter((n) => {
      const line = `${n}: "Main yahin hoon."`;
      return guardVisibleText(`*Hawa chal rahi thi.*\n${line}`).text.indexOf(line) === -1;
    });
    expect(eaten).toEqual([]);
  });
});
