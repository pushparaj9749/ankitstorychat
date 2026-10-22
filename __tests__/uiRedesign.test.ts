/**
 * v2.10 UI element redesign guards (Noir template).
 * Chat bubbles / chat screen are intentionally out of scope and untouched.
 */
import fs from 'fs';
import path from 'path';
import { illustrationForIcon } from '../src/components/illustrations';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('v2.10 UI redesign', () => {
  it('maps empty-state icons to SVG illustrations', () => {
    expect(illustrationForIcon('search')).toBe('search');
    expect(illustrationForIcon('library')).toBe('shelf');
    expect(illustrationForIcon('key-outline')).toBe('key');
    expect(illustrationForIcon('cloud-offline-outline')).toBe('offline');
    expect(illustrationForIcon('alert-circle-outline')).toBe('error');
    expect(illustrationForIcon('book-outline')).toBe('stories');
  });

  it('states keep the Classic icon tile and use SVG art only in Noir', () => {
    const src = read('src/components/states.tsx');
    expect(src).toMatch(/uiTemplate === 'classic'/);
    expect(src).toMatch(/<Illustration/);
  });

  it('tab bar slides a highlight pill on the native driver', () => {
    const src = read('src/components/BottomNavigation.tsx');
    expect(src).toMatch(/testID="tab-pill"/);
    expect(src).toMatch(/Animated\.spring\(pillX, \{[^}]*useNativeDriver: true/);
  });

  it('Top-10 numerals are outlined SVG text, not a filled Text', () => {
    const src = read('src/components/StoryCard.tsx');
    expect(src).toMatch(/<RankNumeral/);
    expect(src).not.toMatch(/styles\.rankNum\b/);
  });

  it('does not touch the chat bubble components', () => {
    for (const f of ['src/components/chat.tsx', 'src/ui/classic/chat.tsx']) {
      expect(read(f)).not.toMatch(/v2\.10/);
    }
  });
});
