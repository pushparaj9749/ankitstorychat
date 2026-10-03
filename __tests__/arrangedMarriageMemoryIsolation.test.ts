const store: any[] = [];
const kv = new Map<string, string>();

jest.mock('../src/lib/db', () => ({
  insertMemory: jest.fn(async (entry: any) => {
    store.push({ ...entry });
    return 'inserted';
  }),
  listMemoryCandidates: jest.fn(async (playthroughIds: string[]) =>
    store.filter((entry) => playthroughIds.includes(entry.playthroughId) && !entry.archived),
  ),
  kvGet: jest.fn(async (key: string) => kv.get(key) ?? null),
  kvSet: jest.fn(async (key: string, value: string) => {
    kv.set(key, value);
  }),
}));

import { putMemory, recallForTurn, setSummary } from '../src/lib/memory';

beforeEach(() => {
  store.length = 0;
  kv.clear();
});

test('story facts and compressed history remain isolated by persistent playthrough id', async () => {
  const arrangedMarriageRun = 'pt_arranged_marriage';
  const otherStoryRun = 'pt_other_story';
  await putMemory(arrangedMarriageRun, 'story', 'Poonam ne Rampur veranda mein apni padhai ki pasand batayi.', 4);
  await putMemory(otherStoryRun, 'story', 'Doosri kahani ka alag raaz hai.', 4);
  await setSummary(arrangedMarriageRun, 'Poonam ki padhai par hui baat abhi yaad rakho.');
  await setSummary(otherStoryRun, 'Doosri kahani ka raaz apne playthrough tak simit hai.');

  const arranged = await recallForTurn(arrangedMarriageRun, 'Poonam ki padhai aur Rampur veranda');
  const other = await recallForTurn(otherStoryRun, 'doosri kahani ka raaz');
  expect(arranged.memories.map((entry) => entry.text)).toContain('Poonam ne Rampur veranda mein apni padhai ki pasand batayi.');
  expect(arranged.summary).toContain('Poonam ki padhai');
  expect(arranged.memories.some((entry) => entry.text.includes('Doosri kahani'))).toBe(false);
  expect(arranged.summary).not.toContain('Doosri kahani');
  expect(other.memories.map((entry) => entry.text)).toContain('Doosri kahani ka alag raaz hai.');
  expect(other.summary).toContain('Doosri kahani');
  expect(other.memories.some((entry) => entry.text.includes('Poonam ne Rampur'))).toBe(false);
  expect(other.summary).not.toContain('Poonam ki padhai');
});
