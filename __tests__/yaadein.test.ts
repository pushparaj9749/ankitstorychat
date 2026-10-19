/**
 * Yaadein helpers: reader edits / pins / additions on journey memory.
 */
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
const db = {
  kvGet: jest.fn(async () => null),
  kvSet: jest.fn(async () => undefined),
  kvDelete: jest.fn(async () => undefined),
  updateMemoryText: jest.fn(async () => undefined),
  deleteMemory: jest.fn(async () => undefined),
  unpinMemory: jest.fn(async () => undefined),
  insertMemory: jest.fn(async () => true),
  countMemories: jest.fn(async () => 0),
  listJourneyMemories: jest.fn(async () => []),
  listGlobalMemories: jest.fn(async () => []),
};
jest.mock('../src/lib/db', () => db);

import { editMemory, isReaderVisibleMemory } from '../src/lib/memory';
import type { MemoryEntry } from '../src/types';

const mem = (p: Partial<MemoryEntry>): MemoryEntry =>
  ({ id: 'm1', playthroughId: 'p1', kind: 'story', text: 'x', importance: 5, createdAt: '2026-01-01', source: 'model', ...p }) as MemoryEntry;

beforeEach(() => jest.clearAllMocks());

test('editMemory saves a trimmed, hashed correction', async () => {
  await expect(editMemory('m1', '  Mahi ko mogra pasand hai  ')).resolves.toBe('saved');
  expect(db.updateMemoryText).toHaveBeenCalledTimes(1);
  const [id, text, hash] = db.updateMemoryText.mock.calls[0] as unknown as [string, string, string];
  expect(id).toBe('m1');
  expect(text).toBe('Mahi ko mogra pasand hai');
  expect(typeof hash).toBe('string');
});

test('editMemory merges into an existing duplicate instead of failing', async () => {
  db.updateMemoryText.mockRejectedValueOnce(new Error('UNIQUE constraint failed'));
  await expect(editMemory('m1', 'Mahi ko mogra pasand hai')).resolves.toBe('merged');
  expect(db.deleteMemory).toHaveBeenCalledWith('m1');
});

test('editMemory ignores near-empty text', async () => {
  await expect(editMemory('m1', ' a ')).resolves.toBe('skipped');
  expect(db.updateMemoryText).not.toHaveBeenCalled();
});

test('author seed notes and summaries are hidden from the reader', () => {
  expect(isReaderVisibleMemory(mem({ source: 'seed' }))).toBe(false);
  expect(isReaderVisibleMemory(mem({ kind: 'summary' }))).toBe(false);
  expect(isReaderVisibleMemory(mem({ source: 'manual' }))).toBe(true);
  expect(isReaderVisibleMemory(mem({}))).toBe(true);
});
