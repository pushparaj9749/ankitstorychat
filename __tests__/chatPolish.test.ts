/**
 * Chat & shelf polish:
 *  - chat bubbles stay in the v2.9.2 style (user choice)
 *  - the opening's authored first-move suggestions are shown until the first message
 *  - no "completed / finished" anywhere in Library / You (stories never end)
 *  - cast roles on Story Detail are run through the player-name filter
 *  - the share card really shares
 */
import fs from 'fs';

import { shareStoryMessage } from '../src/lib/share';

const read = (p: string) => fs.readFileSync(p, 'utf8');

test('chat bubbles are back to the v2.9.2 style (name label + circle, one bubble)', () => {
  for (const p of ['src/components/chat.tsx', 'src/ui/classic/chat.tsx']) {
    const s = read(p);
    expect(s).toMatch(/<Avatar id=\{speaker\}/);
    expect(s).toMatch(/styles\.speakerRow/);
    expect(s).not.toMatch(/splitStoryBeats|withInlineSpeaker/);
  }
});

test('Chat shows the opening suggestions only before the first message', () => {
  const chat = read('src/screens/Chat.tsx');
  expect(chat).toMatch(/const starters = useMemo/);
  expect(chat).toMatch(/if \(!bundle \|\| latestUserMessage \|\| hasMore\) return \[\];/);
  expect(chat).toMatch(/testID="chat-starters"/);
  expect(chat).toMatch(/onPress=\{\(\) => void send\(st\.text\)\}/);
});

test('no "completed / finished" journeys: stories never end', () => {
  const lib = read('src/screens/Library.tsx');
  expect(lib).not.toMatch(/'Completed'|completedCount|'Active'/);
  expect(read('src/screens/Settings.tsx')).not.toMatch(/FINISHED/);
  expect(read('src/screens/Saves.tsx')).not.toMatch(/ending is saved/);
  // counts are real totals, not the first twelve journeys
  expect(read('src/state/AppContext.tsx')).not.toMatch(/listRecentPlaythroughs\(12\)/);
});

test('Story Detail cast roles never show a raw {{playerName}}', () => {
  for (const p of ['src/screens/StoryDetail.tsx', 'src/ui/classic/StoryDetail.tsx']) {
    const s = read(p);
    expect(s).toMatch(/\{forPlayer\(c\.role \?\? 'Character'\)\}/);
    expect(s).not.toMatch(/\{c\.role \?\? 'Character'\}/);
  }
});

test('the share card really shares (no dead "Refer Kissa" card)', () => {
  for (const p of ['src/screens/StoryDetail.tsx', 'src/ui/classic/StoryDetail.tsx']) {
    const s = read(p);
    expect(s).toMatch(/Share\.share\(\{ message: shareStoryMessage\(/);
    expect(s).not.toMatch(/Pass the story forward/);
  }
  const msg = shareStoryMessage('Madam Sarkar', 'Poora desh uske aage jhukta hai');
  expect(msg).toContain('"Madam Sarkar"');
  expect(msg).toContain('Poora desh uske aage jhukta hai');
  expect(msg).toContain('https://github.com/pushparaj9749/ankitstorychat/releases/latest');
  expect(shareStoryMessage('X', '')).not.toMatch(/""/);
});
