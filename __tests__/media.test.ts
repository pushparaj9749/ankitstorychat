/**
 * App-side tests for the submission MEDIA system:
 *   - isSafeMediaRef: the exact allowlist for media references
 *   - validateMedia:   story `media` block structure (cover + gallery)
 *   - validateStorySubmission: complete stories must carry uploaded media
 *   - mediaApiUrl:     how a safe ref resolves to a public API URL
 */
import {
  isSafeMediaRef,
  validateMedia,
  validateStorySubmission,
  MAX_GALLERY_IMAGES,
} from '../src/lib/validate';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

import { mediaApiUrl } from '../src/content/api';

describe('isSafeMediaRef', () => {
  test('accepts published asset shapes', () => {
    for (const ref of [
      'assets/cover.jpg',
      'assets/cover.png',
      'assets/cover.webp',
      'assets/gallery/image-01.jpg',
      'assets/gallery/image-07.png',
      'assets/gallery/image-99.webp',
    ]) {
      expect(isSafeMediaRef(ref)).toBe(true);
    }
  });

  test('accepts server-issued pending refs', () => {
    expect(isSafeMediaRef('media/media_abc123_abc12345')).toBe(true);
  });

  test('rejects path traversal', () => {
    for (const ref of [
      '../../etc/passwd',
      'assets/cover.jpg/../../secret',
      '../outside.jpg',
      'assets/../outside.jpg',
      './assets/cover.jpg',
    ]) {
      expect(isSafeMediaRef(ref)).toBe(false);
    }
  });

  test('rejects absolute / URL / data references', () => {
    for (const ref of [
      '/etc/passwd',
      'http://evil.example/cover.jpg',
      'https://evil.example/cover.jpg',
      '//evil.example/cover.jpg',
      'data:image/png;base64,AAAA',
      'javascript:alert(1)',
    ]) {
      expect(isSafeMediaRef(ref)).toBe(false);
    }
  });

  test('rejects wrong extensions / shapes', () => {
    for (const ref of [
      'assets/cover.gif',
      'assets/cover.jpeg',
      'assets/cover.jpg.bak',
      'assets/cover',
      'assets/gallery/image-1.jpg', // needs 2 digits
      'assets/gallery/image-001.jpg',
      'assets/gallery/x-01.jpg',
      'cover.jpg',
      'assets\\cover.jpg',
    ]) {
      expect(isSafeMediaRef(ref)).toBe(false);
    }
  });

  test('rejects non-strings, empty, oversized, padded values', () => {
    expect(isSafeMediaRef(null)).toBe(false);
    expect(isSafeMediaRef(42)).toBe(false);
    expect(isSafeMediaRef('')).toBe(false);
    expect(isSafeMediaRef('assets/cover.jpg ')).toBe(false);
    expect(isSafeMediaRef(`assets/gallery/image-01-${'a'.repeat(100)}.jpg`)).toBe(false);
  });
});

function validMedia() {
  return {
    cover: 'media/media_abc123_abc12345',
    gallery: [
      { id: 'cover', file: 'media/media_abc123_abc12345', kind: 'cover', label: 'Cover' },
      { id: 'img-1', file: 'media/media_def456_def45678', kind: 'character-portrait', characterId: 'aria' },
    ],
  };
}

describe('validateMedia', () => {
  test('accepts a valid block', () => {
    const issues = validateMedia(validMedia(), { characterIds: new Set(['aria']) });
    expect(issues).toEqual([]);
  });

  test('requires a cover', () => {
    const issues = validateMedia({ gallery: [{ id: 'cover', file: 'media/media_abc123_abc12345', kind: 'cover' }] });
    expect(issues.some((i) => i.path === 'media.cover')).toBe(true);
  });

  test('requires a non-empty gallery containing the cover', () => {
    expect(validateMedia({ cover: 'media/media_abc123_abc12345', gallery: [] }).some((i) => i.path === 'media.gallery')).toBe(true);
    const noCoverInGallery = validateMedia({
      cover: 'media/media_abc123_abc12345',
      gallery: [{ id: 'img-1', file: 'media/media_def456_def45678', kind: 'other' }],
    });
    expect(noCoverInGallery.some((i) => i.path === 'media.gallery' && i.message.includes('cover'))).toBe(true);
  });

  test('rejects duplicate files and ids', () => {
    const dup = validateMedia({
      cover: 'media/media_abc123_abc12345',
      gallery: [
        { id: 'cover', file: 'media/media_abc123_abc12345', kind: 'cover' },
        { id: 'img-1', file: 'media/media_abc123_abc12345', kind: 'other' },
      ],
    });
    expect(dup.some((i) => i.message.includes('duplicate file'))).toBe(true);
    const dupId = validateMedia({
      cover: 'media/media_abc123_abc12345',
      gallery: [
        { id: 'cover', file: 'media/media_abc123_abc12345', kind: 'cover' },
        { id: 'cover', file: 'media/media_def456_def45678', kind: 'other' },
      ],
    });
    expect(dupId.some((i) => i.message.includes('duplicate id'))).toBe(true);
  });

  test('enforces max gallery count', () => {
    const gallery: { id: string; file: string; kind: string }[] = Array.from(
      { length: MAX_GALLERY_IMAGES + 1 },
      (_, i) => ({
        id: `img-${i + 1}`,
        file: `media/media_${i.toString().padStart(6, '0')}_${i.toString().padStart(6, '0')}`,
        kind: 'other',
      }),
    );
    gallery[0] = { id: 'cover', file: 'media/media_abc123_abc12345', kind: 'cover' };
    const issues = validateMedia({ cover: 'media/media_abc123_abc12345', gallery });
    expect(issues.some((i) => i.path === 'media.gallery' && i.message.includes('too many'))).toBe(true);
  });

  test('rejects unknown character links and unsafe labels', () => {
    const unknown = validateMedia(validMedia(), { characterIds: new Set(['someone-else']) });
    expect(unknown.some((i) => i.path === 'media.gallery[1].characterId')).toBe(true);
    const unsafe = validateMedia({
      cover: 'media/media_abc123_abc12345',
      gallery: [{ id: 'cover', file: 'media/media_abc123_abc12345', kind: 'cover', label: '<script>alert(1)</script>' }],
    });
    expect(unsafe.some((i) => i.path === 'media.gallery[0].label')).toBe(true);
  });
});

function storyBody(over: Record<string, unknown> = {}) {
  return {
    creator: { name: 'Test', avatar: null, verified: false },
    story: {
      id: 'app-media-tale',
      title: 'App Media Tale',
      description: 'A tale with a media library.',
      ageRating: '12-17',
      contentLevel: 'teen',
      userRole: '{{playerName}}',
      setting: 'A test town',
      tone: 'Playful',
      openingSceneId: 's1',
      media: validMedia(),
      ...over,
    },
    characters: {
      storyId: 'app-media-tale',
      characters: [
        {
          id: 'aria',
          name: 'Aria',
          role: 'Guide',
          personality: 'Warm',
          background: 'Local legend.',
          speakingStyle: 'Casual',
          sampleLine: 'Chalo chalo.',
        },
      ],
    },
    world: { storyId: 'app-media-tale', premise: 'A small world.', locations: [{ id: 'town', name: 'Town' }], rules: ['Time moves slowly.'] },
    scenes: {
      storyId: 'app-media-tale',
      scenes: [
        {
          id: 's1',
          title: 'Start',
          narration: ['hi'],
          fallbackLines: ['…'],
          choices: [{ id: 'c1', text: 'Continue', next: 's1' }],
        },
      ],
      endings: [],
    },
    memory: { storyId: 'app-media-tale', shortTermWindow: 3, seedMemories: [] },
  };
}

describe('validateStorySubmission (media rules)', () => {
  test('accepts a complete story with uploaded media', () => {
    const res = validateStorySubmission(storyBody());
    expect(res.ok).toBe(true);
    expect(res.cleaned?.bundle.story.media?.cover).toBe('media/media_abc123_abc12345');
  });

  test('rejects a complete story without media', () => {
    const res = validateStorySubmission(storyBody({ media: undefined }));
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.path === 'story.media')).toBe(true);
  });

  test('rejects published-form refs in a submission (must be fresh uploads)', () => {
    const res = validateStorySubmission(
      storyBody({
        media: {
          cover: 'assets/cover.jpg',
          gallery: [{ id: 'cover', file: 'assets/cover.jpg', kind: 'cover' }],
        },
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.path === 'story.media.cover')).toBe(true);
  });

  test('rejects arbitrary paths in the media block', () => {
    const res = validateStorySubmission(
      storyBody({
        media: {
          cover: '../../etc/passwd',
          gallery: [{ id: 'cover', file: '../../etc/passwd', kind: 'cover' }],
        },
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.path.startsWith('media.cover') || i.path.startsWith('story.media'))).toBe(true);
  });
});

describe('mediaApiUrl', () => {
  test('resolves a safe ref against the story API base', () => {
    expect(mediaApiUrl('https://example.test/api', 'my-story', 'assets/cover.jpg')).toBe(
      'https://example.test/api/stories/my-story/assets/cover.jpg',
    );
    expect(mediaApiUrl('https://example.test/api/', 'my-story', 'assets/gallery/image-01.png')).toBe(
      'https://example.test/api/stories/my-story/assets/gallery/image-01.png',
    );
  });
});
