/**
 * v2.10.2 — Story Creator avatars.
 * Owner stories show Ankit's bundled anime avatar; a story built from a user's
 * accepted idea credits that user and may carry a story-local avatar file.
 */
import fs from 'fs';
import path from 'path';
import { resolveCreatorAvatar, isOwnerCreator, CREATOR_AVATAR_FILE_RE } from '../src/lib/creatorAvatar';

const API = 'https://beyondredeye.site/api';
const ROOT = path.join(__dirname, '..');

describe('resolveCreatorAvatar', () => {
  it('owner (Ankit, verified) gets the bundled avatar', () => {
    expect(resolveCreatorAvatar({ name: 'Ankit', avatar: null, verified: true }, 'ring-ki-rani', API)).toEqual({ kind: 'owner' });
  });

  it('a missing creator falls back to the owner avatar', () => {
    expect(resolveCreatorAvatar(undefined, 'ring-ki-rani', API)).toEqual({ kind: 'owner' });
  });

  it('an unverified "Ankit" does NOT get the owner avatar', () => {
    expect(isOwnerCreator({ name: 'Ankit', verified: false })).toBe(false);
    expect(resolveCreatorAvatar({ name: 'Ankit', avatar: null, verified: false }, 'x', API)).toEqual({ kind: 'initial', letter: 'A' });
  });

  it('a story-local avatar resolves to the story API URL', () => {
    expect(
      resolveCreatorAvatar({ name: 'Ankit 2.0', avatar: 'assets/creator.jpg', verified: false }, 'dulhan-bhagi-shadi-se', API),
    ).toEqual({ kind: 'remote', uri: `${API}/stories/dulhan-bhagi-shadi-se/assets/creator.jpg` });
  });

  it('rejects arbitrary URLs, other paths and community stories', () => {
    for (const avatar of ['https://evil.example/pixel.jpg', 'assets/cover.jpg', '../creator.jpg', 'assets/creator.gif']) {
      expect(resolveCreatorAvatar({ name: 'Zed', avatar, verified: false }, 'x', API)).toEqual({ kind: 'initial', letter: 'Z' });
    }
    expect(
      resolveCreatorAvatar({ name: 'Zed', avatar: 'assets/creator.jpg', verified: false }, 'community/x', API),
    ).toEqual({ kind: 'initial', letter: 'Z' });
  });
});

describe('content wiring', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/manifest.json'), 'utf8'));

  it('bundles the owner avatar in the APK', () => {
    expect(fs.existsSync(path.join(ROOT, 'assets/creators/ankit.jpg'))).toBe(true);
  });

  it('every story-local creator avatar exists and has the allowed shape', () => {
    for (const s of manifest.stories) {
      const av = s.creator?.avatar;
      if (!av) continue;
      expect(av).toMatch(CREATOR_AVATAR_FILE_RE);
      expect(fs.existsSync(path.join(ROOT, 'content/stories', s.storyDir, av))).toBe(true);
    }
  });

  it('Dulhan Bhagi Shadi Se credits the user whose idea it was', () => {
    const e = manifest.stories.find((s: any) => s.id === 'dulhan-bhagi-shadi-se');
    expect(e.creator).toEqual({ name: 'Ankit 2.0', avatar: 'assets/creator.jpg', verified: false });
    const story = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/stories/dulhan-bhagi-shadi-se/story.json'), 'utf8'));
    expect(story.creator).toEqual(e.creator);
    expect(story.version).toBe(e.version);
    expect(e.version).toBeGreaterThanOrEqual(2);
  });

  it('both Story Detail templates render the shared CreatorAvatar', () => {
    for (const f of ['src/screens/StoryDetail.tsx', 'src/ui/classic/StoryDetail.tsx']) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      expect(src).toMatch(/<CreatorAvatar /);
      expect(src).toMatch(/storyDir=\{bundle\.meta\.storyDir\}/);
    }
  });
});
