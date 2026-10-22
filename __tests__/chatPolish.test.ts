/**
 * Chat & shelf polish:
 *  - one AI reply = one bubble, speakers' names inline, no label/circle
 *  - the opening's authored first-move suggestions are shown until the first message
 *  - no "completed / finished" anywhere in Library / You (stories never end)
 *  - cast roles on Story Detail are run through the player-name filter
 *  - the share card really shares
 */
import fs from 'fs';

jest.mock('react-native', () => ({ StyleSheet: { create: (s: unknown) => s }, Animated: {}, Pressable: 'Pressable', Text: 'Text', View: 'View' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('../src/state/AppContext', () => ({ useApp: () => ({}) }));
jest.mock('../src/components/icons', () => ({ Icon: 'Icon', ICON_SIZE: {} }));
jest.mock('../src/lib/leakGuard', () => ({ sanitizeStoredText: (t: string) => t }));

import { withInlineSpeaker } from '../src/components/chat';
import { shareStoryMessage } from '../src/lib/share';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('one bubble per reply, names inline (user choice)', () => {
  test('the speaker the engine lifted out goes back on its line', () => {
    expect(withInlineSpeaker('*Woh paas aati hai.*\n"Teen saal, Rahul."\n*Laila ghadi dekhti hai.*\nLaila: "Bees minute."', 'Vedika')).toBe(
      '*Woh paas aati hai.*\nVedika: "Teen saal, Rahul."\n*Laila ghadi dekhti hai.*\nLaila: "Bees minute."',
    );
  });

  test('no speaker, or name already there → text untouched', () => {
    expect(withInlineSpeaker('Vedika Rajvanshi: "Haan."', null)).toBe('Vedika Rajvanshi: "Haan."');
    expect(withInlineSpeaker('Vedika: "Haan."', 'Vedika')).toBe('Vedika: "Haan."');
  });

  test('both templates: no name label above, no circle beside, never split', () => {
    for (const p of ['src/components/chat.tsx', 'src/ui/classic/chat.tsx']) {
      const s = read(p);
      expect(s).toMatch(/return dialogueBubble\(withInlineSpeaker\(message\.text, message\.speaker \?\? null\)\);/);
      expect(s).not.toMatch(/<Avatar|NarratorMark|styles\.speakerRow\}|splitStoryBeats/);
    }
  });
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
