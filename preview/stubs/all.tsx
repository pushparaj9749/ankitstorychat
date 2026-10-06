/**
 * Preview stubs for device-only modules.
 * Only used by preview/jest.preview.config.js — never bundled into the app.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '../../src/theme';

/* ------------------------------------------------------ expo-linear-gradient */
export function LinearGradient({ colors = [], style, children, ...rest }: any) {
  const stops = (colors as string[]).length ? (colors as string[]) : ['transparent', 'transparent'];
  const css = `linear-gradient(180deg, ${stops.join(', ')})`;
  return (
    <View style={[style, { backgroundImage: css } as any]} {...rest}>
      {children}
    </View>
  );
}

/* -------------------------------------------------------- @expo/vector-icons */
const GLYPH: Record<string, string> = {
  home: '⌂', compass: '✥', library: '▤', person: '☺', search: '⌕', close: '✕',
  'chevron-back': '‹', 'chevron-forward': '›', 'chevron-up': '⌃', 'chevron-down': '⌄',
  'arrow-back': '←', 'arrow-up': '↑', heart: '♥', 'heart-outline': '♡',
  'bookmark-outline': '🔖', 'options-outline': '☰', 'image-outline': '🖼',
  'book-outline': '📖', 'library-outline': '▤', 'alert-circle-outline': '!',
  'sparkles-outline': '✦', 'albums-outline': '⧉', 'checkmark-circle': '✓',
  play: '▶', ellipse: '●',
};

export const Ionicons = ({ name, size = 18, color = '#F2F0EB' }: any) => (
  <Text style={{ fontSize: size, color, lineHeight: size + 3, fontWeight: '700' }}>{GLYPH[name] ?? '•'}</Text>
);

/* -------------------------------------------------------------- expo no-ops */
/* ------------------------------------------------------- safe-area-context */
/** Preview insets: a typical phone (26px status bar / 22px home indicator). */
const INSETS = { top: 26, bottom: 22, left: 0, right: 0 };

export const SafeAreaProvider = ({ children }: any) => <>{children}</>;
export const SafeAreaView = ({ children, style, edges = ['top', 'left', 'right', 'bottom'], ...rest }: any) => (
  <View
    style={[
      style,
      edges.includes('top') ? { paddingTop: INSETS.top } : null,
      edges.includes('bottom') ? { paddingBottom: INSETS.bottom } : null,
    ]}
    {...rest}
  >
    {children}
  </View>
);
export const useSafeAreaInsets = () => INSETS;
export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 340, height: 700 });
export const initialWindowMetrics = { frame: { x: 0, y: 0, width: 340, height: 700 }, insets: INSETS };
export const withSafeAreaInsets = (C: any) => C;

const noop = () => undefined;
export const lightBuzz = noop;
export const mediumBuzz = noop;
export const successBuzz = noop;
export const warningBuzz = noop;
export const selectionBuzz = noop;
export const playSend = noop;
export const playReceive = noop;
export const setAmbientPlaying = noop;
export const getApiKey = async () => 'preview-key';
export const setApiKey = async () => undefined;
export const deleteApiKey = async () => undefined;
export const aiErrorMessage = () => 'Preview: AI disabled.';
export const chatCompletion = async () => ({ text: '' });
export const notifyContentUpdate = async () => undefined;
export const requestNotificationPermission = async () => false;

export const PREVIEW_STORIES = [
  {
    id: 'arranged-marriage-wala-love',
    title: 'Arranged Marriage Wala Love',
    tagline: 'Ek chai ke sawaal se shuru — iske baad har mod tumhare haath mein.',
    description:
      'Rampur mein Ankit apne parivaar ke saath Poonam ko milne aata hai. Chhota, saaf-suthra ghar aur apnapan se bhari drawing room — pehli mulaqat chai ke ek sawaal par rukti hai, uske baad har mod tumhare haath mein hai.',
    genres: ['Romance', 'Family Drama', 'Slice of Life'],
    tags: ['slow-burn', 'ongoing'],
    characters: ['Poonam', 'Bhabhi'],
    storyDir: 'arranged-marriage-wala-love',
    ageRating: '18+',
    accentColor: '#E9435E',
    popularity: 98,
    estimatedMinutes: 45,
    updatedAt: '2026-10-05T10:00:00.000Z',
    featured: true,
  },
  {
    id: 'midnight-local',
    title: 'Midnight Local',
    tagline: 'Aakhri local pakdi — aur usme ek ajnabi.',
    description: 'Raat ki aakhri local, ek khaali dabba aur ek ajnabi jo tumhara naam jaanta hai.',
    genres: ['Horror', 'Thriller'],
    tags: ['ongoing'],
    characters: ['Ajnabi'],
    ageRating: '18+',
    accentColor: '#A99CFF',
    popularity: 92,
    estimatedMinutes: 40,
    updatedAt: '2026-10-04T10:00:00.000Z',
  },
  {
    id: 'campus-queen',
    title: 'Campus Queen',
    tagline: 'College ki sabse badi star, aur tum uska raaz.',
    description: 'Campus ki queen tumse ek raaz share karti hai — aur usse tumhari zindagi badal jaati hai.',
    genres: ['Drama', 'Romance'],
    tags: ['ongoing'],
    characters: ['Ishita'],
    ageRating: '12-17',
    accentColor: '#FF8A9B',
    popularity: 88,
    estimatedMinutes: 35,
    updatedAt: '2026-09-30T10:00:00.000Z',
    isNew: true,
  },
  {
    id: 'pahadon-wali-haveli',
    title: 'Pahadon Wali Haveli',
    tagline: 'Haveli ke darwaze band hain… andar koi hai.',
    description: 'Pahadon mein ek purani haveli, aur wo aawaz jo sirf tumhe sunai deti hai.',
    genres: ['Mystery', 'Horror'],
    tags: ['ongoing'],
    characters: ['Caretaker'],
    ageRating: '18+',
    accentColor: '#7AA5FF',
    popularity: 85,
    estimatedMinutes: 50,
    updatedAt: '2026-09-28T10:00:00.000Z',
    isNew: true,
  },
  {
    id: 'hawa-band-dhaba',
    title: 'Hawa Band Dhaba',
    tagline: 'Highway ka wo dhaba jahan time rukta hai.',
    description: 'Ek dhaba jahan har raat wahi log aate hain — aur har raat thodi si badalti hai.',
    genres: ['Comedy', 'Slice of Life'],
    tags: ['ongoing'],
    characters: ['Dhaba wala'],
    ageRating: '12-17',
    accentColor: '#FFD66E',
    popularity: 80,
    estimatedMinutes: 30,
    updatedAt: '2026-09-20T10:00:00.000Z',
  },
  {
    id: 'goddess-of-underworld-loves-me',
    title: 'Goddess Of Underworld Loves Me',
    tagline: 'Pataal ki rani ko tumse pyaar ho gaya.',
    description: 'Pataal ki rani tumhe chun leti hai — aur duniya ke niyam badalne lagte hain.',
    genres: ['Mythology', 'Romance'],
    tags: ['ongoing'],
    characters: ['Rani'],
    ageRating: '18+',
    accentColor: '#FF8ACF',
    popularity: 78,
    estimatedMinutes: 55,
    updatedAt: '2026-09-18T10:00:00.000Z',
  },
];
export const PREVIEW_PLAYTHROUGHS = [
  {
    id: 'pt_1',
    storyId: 'midnight-local',
    label: 'Journey 1',
    status: 'active',
    progress: 0.38,
    messageCount: 42,
    currentSceneId: 's1',
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'pt_2',
    storyId: 'campus-queen',
    label: 'Journey 2',
    status: 'active',
    progress: 0.64,
    messageCount: 88,
    currentSceneId: 's1',
    updatedAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
  },
];
export const PREVIEW_MESSAGES = [
  {
    id: 'm3',
    playthroughId: 'pt_1',
    role: 'assistant',
    speaker: 'Poonam',
    text: '“Aap aaram se baat kijiye. Main cup rakh deti hoon — chai thandi na ho jaaye.”',
    sceneId: 's1',
    createdAt: '2026-10-05T10:02:00.000Z',
  },
  {
    id: 'm2',
    playthroughId: 'pt_1',
    role: 'user',
    speaker: 'Ankit',
    text: '“Ji, shukriya. Chai le lunga.”',
    sceneId: 's1',
    createdAt: '2026-10-05T10:01:00.000Z',
  },
  {
    id: 'm1',
    playthroughId: 'pt_1',
    role: 'assistant',
    speaker: 'Poonam',
    text: '“Ji, aap chai lenge?”',
    sceneId: 's1',
    createdAt: '2026-10-05T10:00:00.000Z',
  },
  {
    id: 'm0',
    playthroughId: 'pt_1',
    role: 'narration',
    speaker: null,
    text: 'Yellow suit mein Poonam chai ki tray lekar andar aati hai. Nazar jhuki hui, chehre par halki si nervous smile.',
    sceneId: 's1',
    createdAt: '2026-10-05T09:59:00.000Z',
  },
];
export const PREVIEW_BUNDLE = {
  meta: PREVIEW_STORIES[0],
  story: {
    ...PREVIEW_STORIES[0],
    openingSceneId: 's1',
    userRole:
      'Ankit — ek 18–19 saal ka aadmi, poori tarah player ke control mein. Personality, decisions aur rishte sirf player tay karta hai.',
    media: {
      cover: 'assets/cover.jpg',
      gallery: [
        { id: 'cover', file: 'assets/cover.jpg', kind: 'cover', label: 'Cover' },
        { id: 'p1', file: 'assets/gallery/image-01.jpg', kind: 'character-portrait', characterId: 'poonam' },
        { id: 'p2', file: 'assets/gallery/image-02.jpg', kind: 'scene' },
        { id: 'p3', file: 'assets/gallery/image-03.jpg', kind: 'scene' },
      ],
    },
  },
  characters: {
    characters: [
      { id: 'poonam', name: 'Poonam', role: 'Rampur wali ladki', personality: '', background: '', goals: [], fears: [], likes: [], dislikes: [], speakingStyle: '', sampleLine: '', relationshipWithUser: '', knowledge: [] },
      { id: 'bhabhi', name: 'Bhabhi', role: 'Poonam ki maa jaisi', personality: '', background: '', goals: [], fears: [], likes: [], dislikes: [], speakingStyle: '', sampleLine: '', relationshipWithUser: '', knowledge: [] },
    ],
  },
  world: { premise: '' },
  scenes: {
    scenes: [
      {
        id: 's1',
        title: 'Rampur, Drawing Room',
        narration: ['*Ankit, tum aaj apne parivaar ke saath Rampur aaye ho.*'],
        fallbackLines: [],
        choices: [
          { id: 'a', label: '“Ji, shukriya. Chai le lunga.”', text: '“Ji, shukriya. Chai le lunga.”', shortLabel: 'Chai le lo', keywords: [], next: null },
          { id: 'b', label: 'Poonam se pehla sawaal poochho', text: '“Poonam, tum bhi baitho na.”', shortLabel: 'Poonam se baat karo', keywords: [], next: null },
          { id: 'c', label: 'Family ki taraf dekh kar unki raay lo', text: 'Family ki taraf dekhta hoon.', shortLabel: 'Family', keywords: [], next: null },
        ],
      },
    ],
    endings: [],
  },
  memory: { seedMemories: [] },
  source: 'bundled',
  creator: { name: 'Ankit', avatar: null, verified: true },
};

/* ------------------------------------------------------------- content loader */
export type CoverSource = { uri: string } | number;
export const effectiveContentApiBaseUrl = () => '';
export const mediaApiUrl = (_base: string, dir: string, file: string) => `covers/${dir}__${file.replace(/\//g, '_')}`;
export const getBundledCoverSource = (meta: any): CoverSource => ({ uri: `covers/${meta?.id}.jpg` });
export const listDeviceStories = async () => [];
export const isStoryOnDevice = async () => true;
export const downloadStory = async () => undefined;
export const checkForUpdates = async () => ({ hasUpdate: false, newStories: [], updatedStories: [] });
export const getBundle = async () => PREVIEW_BUNDLE;
export const getScene = (bundle: any, sceneId: string) =>
  bundle?.scenes?.scenes?.find((s: any) => s.id === sceneId) ?? bundle?.scenes?.scenes?.[0] ?? null;
export class StoryContentError extends Error {
  code: string;
  constructor(message: string, code = 'missing') {
    super(message);
    this.code = code;
  }
}

/* ------------------------------------------------------------------ engine/ai */
export const applyEffects = (s: any) => s;
export const buildContext = () => ({ messages: [] });
export const finalizeAssistantText = (t: string) => t;
export const HISTORY_HEADROOM = 8;
export const parseAssistantResponse = (t: string) => ({ text: t, effects: null });
export const progressEstimate = () => 0.4;
export const shortTermWindowOf = () => [];
export const completeEpisode = async () => undefined;
export const consolidateMemories = async () => undefined;
export const putMemory = async () => undefined;
export const recallForTurn = async () => [];
export const rememberMany = async () => undefined;
export const rememberPreferences = async () => undefined;
export const episodeLine = () => '';
export const seedMemoriesIfEmpty = async () => undefined;
export const runMemoryWritePipeline = async () => undefined;
export const recallWithWorldState = async () => [];
export const ensureWorldState = async () => undefined;
export const consolidateStoryMemory = async () => undefined;
export const migrateStoryMemory = async () => undefined;
export const recallStoryMemoryForPrompt = async () => '';
export const rememberTurn = async () => undefined;
export const completePlaythrough = async () => undefined;
export const playthroughLabel = (n: number) => `Journey ${n}`;
export const createPlaythrough = async () => ({ id: 'pt_preview' });
export const listMemoryCandidates = async () => [];
export const getPlaythrough = async (id: string) =>
  PREVIEW_PLAYTHROUGHS.find((p) => p.id === id) ?? PREVIEW_PLAYTHROUGHS[0];
export const listMessages = async () => PREVIEW_MESSAGES;
export const listMessagesAsc = async () => [...PREVIEW_MESSAGES].reverse();
export const listRecentMessagesAsc = async () => [...PREVIEW_MESSAGES].reverse();
export const countMessages = async () => PREVIEW_MESSAGES.length;
export const insertMessage = async () => undefined;
export const updatePlaythrough = async () => undefined;
export const updateStats = async () => undefined;
export const deletePlaythrough = async () => undefined;
export const listPlaythroughsForStory = async () => [];
export const kvGet = async () => null;
export const kvSet = async () => undefined;
export const kvDelete = async () => undefined;

/* ----------------------------------------------------------------- app state */
const THEME = COLORS.midnight;





/**
 * Built ONCE: a fresh object per call would change `profile`/`settings`
 * identity on every render and spin screen effects into an infinite loop
 * (same reason the app's own test suite builds its mock once).
 */
const APP_VALUE = {
  theme: THEME,
  profile: { nickname: 'Ankit', ageGroup: '18+' },
  settings: { textSize: 'medium', sound: false, haptics: true, contentApiBaseUrl: '' },
  stories: PREVIEW_STORIES,
  favoriteIds: new Set(['campus-queen', 'midnight-local']),
  recentPlaythroughs: PREVIEW_PLAYTHROUGHS,
  toggleFavorite: async () => true,
  refreshRecent: async () => undefined,
  refreshStories: async () => undefined,
  activeProvider: { id: 'openai', name: 'OpenAI' },
  providersWithKeys: new Set(['openai']),
  aiAddons: [],
};

export function useApp(): any {
  return APP_VALUE;
}

export const AppProvider = ({ children }: any) => children ?? null;
export const useNavScrollSafe = () => null;
