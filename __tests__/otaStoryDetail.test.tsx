/**
 * StoryDetail for a story that ships on GitHub only.
 *
 * Such a story is listed in the APK's manifest, so the user CAN tap it. When
 * its files are not on the device the screen must offer the in-place download
 * — the old render order showed the generic "Couldn't open story" error first,
 * which made the download branch unreachable and the story un-openable.
 */
import React from 'react';
import renderer from 'react-test-renderer';
import { COLORS } from '../src/theme';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => {
  const R = require('react');
  const el = (tag: string) => (props: any) => R.createElement(tag, props, props.children);
  return {
    StyleSheet: { create: (s: any) => s, flatten: (s: any) => s },
    View: el('View'),
    Text: el('Text'),
    Pressable: el('Pressable'),
    ScrollView: el('ScrollView'),
    Image: el('Image'),
    ActivityIndicator: el('ActivityIndicator'),
    StatusBar: el('StatusBar'),
    Alert: { alert: jest.fn() },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const R = require('react');
  return { SafeAreaView: (p: any) => R.createElement('SafeAreaView', p, p.children) };
});

jest.mock('expo-linear-gradient', () => {
  const R = require('react');
  return { LinearGradient: (p: any) => R.createElement('LinearGradient', p, p.children) };
});

/** Hoisted fixture: the AppContext mock factory runs before `const` init. */
function makeStory() {
  return {
    id: 'goddess-who-chose-me',
    title: 'The Goddess Who Chose Me',
    tagline: 'Ek devi jo sab kuch pa sakti hai...',
    description: 'Tum Ankit ho.',
    genres: ['Fantasy'],
    tags: ['goddess'],
    characters: ['Aria'],
    ageRating: '12-17' as const,
    contentLevel: 'teen' as const,
    language: 'hinglish' as const,
    version: 1,
    coverUrl: 'https://example.test/cover.jpg',
    accentColor: '#F5C542',
    userRole: 'Ankit',
    setting: 'Mumbai',
    estimatedMinutes: 45,
    popularity: 99,
    storyDir: 'goddess-who-chose-me',
    updatedAt: '2026-09-12T00:00:00.000Z',
  };
}

const STORY = makeStory();


const getBundle = jest.fn();
const downloadStory = jest.fn(async () => undefined);
const isStoryOnDevice = jest.fn(async () => true);

jest.mock('../src/content/loader', () => ({
  getBundledCoverSource: () => ({ uri: 'https://example.test/cover.jpg' }),
  effectiveContentApiBaseUrl: () => 'https://example.test/api',
  getBundle: (...a: unknown[]) => getBundle(...(a as [])),
  downloadStory: (...a: unknown[]) => downloadStory(...(a as [])),
  isStoryOnDevice: (...a: unknown[]) => isStoryOnDevice(...(a as [])),
  storyErrorMessage: (e: { code?: string }) =>
    e?.code === 'notfound' ? "This story isn't available." : "Couldn't prepare this story. Try again.",
  StoryContentError: class StoryContentError extends Error {
    code: string;
    constructor(message: string, code = 'missing') {
      super(message);
      this.name = 'StoryContentError';
      this.code = code;
    }
  },
}));

jest.mock('../src/state/AppContext', () => {
  const { COLORS: C } = require('../src/theme');
  // Built ONCE: a fresh object per call would change `profile` identity on
  // every render and spin StoryDetail's effect into an infinite loop.
  const value = {
    theme: C.midnight,
    profile: { nickname: 'Rahul', ageGroup: '18+' },
    settings: { contentApiBaseUrl: '' },
    stories: [makeStory()],
    favoriteIds: new Set<string>(),
    toggleFavorite: jest.fn(),
    activeProvider: null,
    providersWithKeys: new Set<string>(),
    refreshRecent: jest.fn(async () => undefined),
    refreshStories: jest.fn(async () => undefined),
  };
  return { useApp: () => value };
});

jest.mock('../src/lib/db', () => ({
  listPlaythroughsForStory: jest.fn(async () => []),
  updateStats: jest.fn(async () => undefined),
  insertMessage: jest.fn(async () => undefined),
}));

jest.mock('../src/lib/playthrough', () => ({
  createPlaythrough: jest.fn(async () => ({ id: 'pt1' })),
  playthroughLabel: (n: number) => `Journey ${n}`,
}));

jest.mock('../src/lib/memory', () => ({
  seedMemoriesIfEmpty: jest.fn(async () => undefined),
}));

import { StoryDetail } from '../src/screens/StoryDetail';
import { StoryContentError } from '../src/content/loader';

/** Collect every rendered string so assertions read like what a user sees. */
function renderText(): string {
  return JSON.stringify(tree.toJSON());
}

let tree: renderer.ReactTestRenderer;

const navigation = {
  addListener: () => () => undefined,
  navigate: jest.fn(),
  goBack: jest.fn(),
} as unknown as never;

const route = { params: { storyId: STORY.id } } as unknown as never;

async function render() {
  let local: renderer.ReactTestRenderer | undefined;
  await renderer.act(async () => {
    local = renderer.create(<StoryDetail navigation={navigation} route={route} />);
  });
  tree = local as unknown as renderer.ReactTestRenderer;
}

beforeEach(() => {
  getBundle.mockReset();
  downloadStory.mockClear();
  // Default: the package is on the device, so StoryDetail loads it normally.
  isStoryOnDevice.mockResolvedValue(true);
});

/** A minimal-but-valid streamed bundle for rendering the loaded screen. */
function validBundle() {
  return {
    meta: STORY,
    story: { ...STORY, openingSceneId: 's1' },
    characters: {
      characters: [
        {
          id: 'aria',
          name: 'Aria',
          role: 'Devi',
          personality: '',
          background: '',
          goals: [],
          fears: [],
          likes: [],
          dislikes: [],
          speakingStyle: '',
          sampleLine: 'Main tumhare saath rahungi.',
          relationshipWithUser: '',
          knowledge: [],
        },
      ],
    },
    world: { premise: '' },
    scenes: { scenes: [{ id: 's1', title: 'Start', narration: ['hi'], choices: [] }], endings: [] },
    memory: { seedMemories: [] },
    source: 'remote',
  };
}

describe('StoryDetail (auto-download, cache-first, friendly retry)', () => {
  test('without a cached package and no network shows retry, not a dead end', async () => {
    getBundle.mockRejectedValue(new StoryContentError('No internet connection.', 'network'));

    await render();
    const text = renderText();

    expect(text).not.toContain("Couldn't open story");
    expect(text).toContain("Couldn't prepare this story");
    expect(text).toContain('Try again');
  });

  test('Try again re-attempts the load (which auto-downloads if needed)', async () => {
    getBundle
      .mockRejectedValueOnce(new StoryContentError('No internet connection.', 'network'))
      .mockResolvedValueOnce(validBundle());

    await render();
    expect(renderText()).toContain("Couldn't prepare this story");

    const button = tree.root.findAll(
      (n) => typeof n.type === 'function' && n.props.title?.includes('Try again'),
    )[0];
    expect(button).toBeTruthy();

    await renderer.act(async () => {
      button.props.onPress();
    });

    expect(getBundle).toHaveBeenCalledTimes(2);
  });

  test('shows the PLAYER name in the story introduction, not the hardcoded one', async () => {
    getBundle.mockResolvedValue({
      meta: STORY,
      story: { ...STORY, userRole: 'Tum Ankit ho — café ka regular customer', openingSceneId: 's1' },
      characters: { characters: [{ id: 'myra', name: 'Myra' }] },
      world: { premise: '' },
      scenes: { scenes: [{ id: 's1', title: 'Start', narration: ['hi'], choices: [] }], endings: [] },
      memory: { seedMemories: [] },
      source: 'bundled',
    });

    await render();
    const text = renderText();
    // The reader is Rahul — that is what the intro must say.
    expect(text).toContain('Tum Rahul ho');
    expect(text).not.toContain('Tum Ankit ho');
    expect(text).not.toContain('{{playerName}}');
  });

  test('still reports genuine (non-recoverable) content errors', async () => {
    getBundle.mockRejectedValue(new StoryContentError('Story data is invalid (story.id: required).', 'invalid'));

    await render();
    expect(renderText()).toContain("Couldn't prepare this story");
  });

  test('renders normally once the story is on the device', async () => {
    getBundle.mockResolvedValue({
      meta: STORY,
      story: { ...STORY, openingSceneId: 's1' },
      characters: {
        characters: [
          {
            id: 'aria',
            name: 'Aria',
            role: 'Devi',
            personality: '',
            background: '',
            goals: [],
            fears: [],
            likes: [],
            dislikes: [],
            speakingStyle: '',
            sampleLine: 'Main tumhare saath rahungi.',
            relationshipWithUser: '',
            knowledge: [],
          },
        ],
      },
      world: { premise: '' },
      scenes: { scenes: [{ id: 's1', title: 'Start', narration: ['hi'], choices: [] }], endings: [] },
      memory: { seedMemories: [] },
      source: 'bundled',
    });

    await render();
    const text = renderText();
    expect(text).toContain('Start story');
    expect(text).not.toContain("Couldn't open story");
  });
});
