/**
 * Regenerate must really rewind memory: a discarded reply may not leave a
 * fact, digest change, chapter, world-state change or archive event behind.
 * Runs against a real SQLite (sql.js, the same adapter the web preview uses).
 */
jest.mock('expo-sqlite', () => require('../preview/web/expo-sqlite-web.js'));

import {
  getDb,
  getPlaythrough,
  insertMessage,
  insertPlaythrough,
  kvGet,
  kvSet,
  listJourneyMemories,
  listRecentMessagesAsc,
  updatePlaythrough,
} from '../src/lib/db';
import { putMemory, setSummary, getSummary } from '../src/lib/memory';
import { attachReplyIds, checkpointCovers, getTurnCheckpoint, rollbackTurn, saveTurnCheckpoint } from '../src/lib/turnCheckpoint';
import { createInitialState, type Playthrough } from '../src/types';

const PT = 'pt-regen';
const now = () => new Date().toISOString();

const pt: Playthrough = {
  id: PT,
  storyId: 's1',
  label: 'Journey',
  status: 'active',
  currentSceneId: 'scene-1',
  state: createInitialState(),
  progress: 0,
  messageCount: 3,
  endingId: null,
  mode: 'ai',
  providerId: null,
  createdAt: now(),
  updatedAt: now(),
} as Playthrough;

beforeAll(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined); // sql.js asm deprecation notice
  await getDb();
  await insertPlaythrough(pt);
  await putMemory(PT, 'story', 'Mahi ko mogra pasand hai', 6, { source: 'derived', confidence: 'high' });
  await setSummary(PT, 'Pehli mulaqat cafe mein hui.');
  await kvSet(`memchap:${PT}`, JSON.stringify({ chapters: [] }));
  await insertMessage({ id: 'u1', playthroughId: PT, role: 'user', speaker: 'Ankit', text: 'Payal de do', sceneId: 'scene-1', createdAt: now() });
});

test('rollback restores memory + state and drops only the discarded reply', async () => {
  await saveTurnCheckpoint(PT, { kind: 'message', prompt: 'Payal de do', primaryUserText: 'Payal de do' });

  // --- the turn that will be regenerated writes all kinds of memory ---
  await insertMessage({ id: 'a1', playthroughId: PT, role: 'assistant', speaker: 'Mahi', text: 'Mahi ne payal de di.', sceneId: 'scene-1', createdAt: new Date(Date.now() + 5).toISOString() });
  await attachReplyIds(PT, ['a1']);
  await putMemory(PT, 'story', 'Mahi ne apni payal Ankit ko de di', 8, { source: 'derived', confidence: 'high' });
  await setSummary(PT, 'Pehli mulaqat cafe mein hui. Phir payal Ankit ke paas aa gayi.');
  await kvSet(`memchap:${PT}`, JSON.stringify({ chapters: [{ title: 'X', text: 'y', atTurn: 4, sceneId: 'scene-1', createdAt: now() }] }));
  await updatePlaythrough({ ...pt, messageCount: 4, currentSceneId: 'scene-2' });

  const ck = await getTurnCheckpoint(PT);
  expect(checkpointCovers(ck, 'a1')).toBe(true);
  expect(checkpointCovers(ck, 'someone-else')).toBe(false);
  await rollbackTurn(PT, ck!);

  const mems = (await listJourneyMemories(PT)).map((m) => m.text);
  expect(mems).toContain('Mahi ko mogra pasand hai');
  expect(mems.some((t) => t.includes('payal'))).toBe(false);
  expect(await getSummary(PT)).toBe('Pehli mulaqat cafe mein hui.');
  expect(JSON.parse((await kvGet(`memchap:${PT}`))!).chapters).toHaveLength(0);
  const back = await getPlaythrough(PT);
  expect(back?.messageCount).toBe(3);
  expect(back?.currentSceneId).toBe('scene-1');
  const msgs = (await listRecentMessagesAsc(PT, 10)).map((m) => m.id);
  expect(msgs).toEqual(['u1']);
  // a rewind point is single-use
  expect(await getTurnCheckpoint(PT)).toBeNull();
});

test('a checkpoint without a saved reply never covers anything', async () => {
  await saveTurnCheckpoint(PT, { kind: 'continue', prompt: 'Continue karo.' });
  expect(checkpointCovers(await getTurnCheckpoint(PT), 'a1')).toBe(false);
});
