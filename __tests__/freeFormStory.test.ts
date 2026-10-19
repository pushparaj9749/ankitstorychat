/**
 * Product rules (owner):
 *  - No predefined scene or arc: the narrator never gets a scene list, scene
 *    directions, arcs or endings — only the opening moment, early on.
 *  - The reader only sees who they are, never the author's narrator rules.
 */
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('../src/lib/db', () => ({ kvGet: jest.fn(async () => null), kvSet: jest.fn(async () => undefined), kvDelete: jest.fn(async () => undefined) }));

import fs from 'node:fs';
import { join } from 'node:path';
import { buildStateExtractionMessages, buildSystemPrompt, FREE_STORY_LAW, OPENING_ONLY_TURNS } from '../src/lib/engine';
import { createInitialWorldState, renderWorldStateForPrompt } from '../src/lib/worldState';
import { readerRoleText } from '../src/lib/playerName';
import type { CharactersFile, LocalProfile, MemoryFile, Playthrough, ScenesFile, StoryBundle, StoryFile, StoryMeta, WorldFile } from '../src/types';
import { KISSA_OWNER_CREATOR, createInitialState } from '../src/types';

const ROOT = join(__dirname, '..', 'content');
const ID = 'arranged-marriage-wala-love';
const pack = <T>(f: string): T => JSON.parse(fs.readFileSync(join(ROOT, 'stories', ID, f), 'utf8')) as T;
const manifest = JSON.parse(fs.readFileSync(join(ROOT, 'manifest.json'), 'utf8')) as { stories: StoryMeta[] };

const bundle: StoryBundle = {
  meta: manifest.stories.find((s) => s.id === ID)!,
  story: pack<StoryFile>('story.json'),
  characters: pack<CharactersFile>('characters.json'),
  world: pack<WorldFile>('world.json'),
  scenes: pack<ScenesFile>('scenes.json'),
  memory: pack<MemoryFile>('memory.json'),
  source: 'bundled',
  creator: KISSA_OWNER_CREATOR,
};
const profile = { nickname: 'Ankit', ageGroup: '18+' } as unknown as LocalProfile;
const pt = (messageCount: number): Playthrough => ({
  id: 'p', storyId: ID, label: 'Journey 1', status: 'active', currentSceneId: bundle.story.openingSceneId,
  state: createInitialState(), progress: 0, messageCount, endingId: null, mode: 'ai', providerId: null,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});
const prompt = (n: number) =>
  buildSystemPrompt({ bundle, profile, playthrough: pt(n), memories: [], history: [], stateMode: 'separate' } as any, '18+');

test('narrator prompt carries the free-story law and no scene list / directions / endings', () => {
  for (const n of [0, 40]) {
    const p = prompt(n);
    expect(p).toContain(FREE_STORY_LAW);
    expect(p).not.toMatch(/Current scene:|Available directions|ENDING scene|steer back toward the scene/);
    for (const sc of bundle.scenes.scenes.slice(1)) expect(p).not.toContain(`(id: ${sc.id})`);
  }
});

test('the opening moment is given only at the start, never as a plan', () => {
  expect(prompt(0)).toContain('HOW THE STORY BEGAN');
  expect(prompt(OPENING_ONLY_TURNS)).not.toContain('HOW THE STORY BEGAN');
});

test('record-keeper never offers scenes or endings', () => {
  const [sys] = buildStateExtractionMessages({ bundle, playthrough: pt(10), userText: 'hi', assistantText: 'hello', playerName: 'Ankit' });
  expect(sys.content).not.toMatch(/ALL SCENES|CURRENT SCENE|ENDING IDS|"scene":|"endStory":/);
});

test('world state starts with no authored scene or arc', () => {
  const ws = createInitialWorldState(pt(0), bundle);
  expect(ws.currentScene).toBeNull();
  expect(ws.currentArc).toBeNull();
  expect(renderWorldStateForPrompt(ws)).not.toMatch(/- (Scene|Arc):/);
});

test('reader role text never shows narrator rules (all shipped stories)', () => {
  for (const d of fs.readdirSync(join(ROOT, 'stories'))) {
    const role = JSON.parse(fs.readFileSync(join(ROOT, 'stories', d, 'story.json'), 'utf8')).userRole ?? '';
    const shown = readerRoleText(role);
    expect({ d, bad: /\b(player|narrator|runtime|never assign|controlled (exclusively|only))\b/i.test(shown) }).toEqual({ d, bad: false });
    if (role.trim()) expect(shown.length).toBeGreaterThan(5);
  }
  expect(readerRoleText('{{playerName}} — an adult Indian man aged 18–19, controlled exclusively by the player. The player supplies his display name at runtime; never assign him another name.'))
    .toBe('{{playerName}} — an adult Indian man aged 18–19.');
});

test('Chat never jumps to an authored scene, ends a story or shows a scene title', () => {
  const chat = fs.readFileSync('src/screens/Chat.tsx', 'utf8');
  expect(chat).not.toMatch(/completePlaythrough|isEnding|hasAlternateScene|scene\?\.title|Scene badlo/);
});
