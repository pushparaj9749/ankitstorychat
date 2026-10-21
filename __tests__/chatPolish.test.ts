/**
 * Chat & shelf polish:
 *  - one AI reply with narration + several speakers renders as separate beats
 *  - the opening's authored first-move suggestions are shown until the first message
 *  - no "completed / finished" anywhere in Library / You (stories never end)
 *  - cast roles on Story Detail are run through the player-name filter
 *  - the share card really shares
 */
import fs from 'fs';

jest.mock('react-native', () => ({ StyleSheet: { create: (s: unknown) => s }, Animated: {}, Pressable: 'Pressable', Text: 'Text', View: 'View' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('../src/state/AppContext', () => ({ useApp: () => ({}) }));
jest.mock('../src/components/bits', () => ({ Avatar: 'Avatar' }));
jest.mock('../src/components/icons', () => ({ Icon: 'Icon', ICON_SIZE: {} }));
jest.mock('../src/lib/leakGuard', () => ({ sanitizeStoredText: (t: string) => t }));

import { avatarKey, splitStoryBeats } from '../src/components/chat';
import { shareStoryMessage } from '../src/lib/share';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('splitStoryBeats', () => {
  test('narration and each speaker get their own beat', () => {
    const beats = splitStoryBeats(
      '*Vedika muskurati hai.*\nVedika: "Chai?"\n*Laila ghadi dekhti hai.*\nLaila: "Bees minute, Sarkar."',
    );
    expect(beats).toEqual([
      { kind: 'narration', speaker: null, text: '*Vedika muskurati hai.*' },
      { kind: 'dialogue', speaker: 'Vedika', text: '"Chai?"' },
      { kind: 'narration', speaker: null, text: '*Laila ghadi dekhti hai.*' },
      { kind: 'dialogue', speaker: 'Laila', text: '"Bees minute, Sarkar."' },
    ]);
  });

  test('the speaker the engine lifted out goes back on the first line', () => {
    const beats = splitStoryBeats('*Woh paas aati hai.*\n"Teen saal, Rahul."\nVedika: "Andar bulaoge?"', 'Vedika');
    expect(beats.map((b) => [b.kind, b.speaker])).toEqual([
      ['narration', null],
      ['dialogue', 'Vedika'],
      ['dialogue', 'Vedika'],
    ]);
  });

  test('consecutive narration merges; plain text after narration is never faded', () => {
    const beats = splitStoryBeats('*Baarish.*\n*Bijli gayi.*\n"Koi hai?"');
    expect(beats).toEqual([
      { kind: 'narration', speaker: null, text: '*Baarish.*\n*Bijli gayi.*' },
      { kind: 'dialogue', speaker: null, text: '"Koi hai?"' },
    ]);
  });

  test('a single-line reply stays one bubble', () => {
    expect(splitStoryBeats('Vedika: "Haan."')).toHaveLength(1);
    expect(splitStoryBeats('"Haan." *Woh hansti hai.*')).toHaveLength(1);
  });

  test('avatars use one colour key per character', () => {
    expect(avatarKey('Vedika Rajvanshi')).toBe(avatarKey('Vedika'));
    expect(avatarKey('  Laila ')).toBe('laila');
  });
});

test('both chat templates render replies beat by beat', () => {
  for (const p of ['src/components/chat.tsx', 'src/ui/classic/chat.tsx']) {
    expect(read(p)).toMatch(/splitStoryBeats\(message\.text, message\.speaker \?\? null\)/);
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
