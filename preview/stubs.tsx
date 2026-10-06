/**
 * UI preview stubs — used only by preview/build.mjs (react-native-web SSR).
 * They replace the device-only modules (SQLite, keystore, haptics, network
 * content loader) so the REAL screen/component code can be rendered in a
 * browser for design review. Nothing here ships in the app bundle.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { COLORS, GRADIENTS } from '../src/theme';

/* ------------------------------------------------------- expo-linear-gradient */
export function LinearGradient({ colors = [], style, children, ...rest }: any) {
  const list = (colors as string[]) ?? [];
  const stops = list.length > 0 ? list : (GRADIENTS.surfaceGrad as unknown as string[]);
  const css = `linear-gradient(180deg, ${stops.join(', ')})`;
  return (
    <View style={[style, { backgroundImage: css } as any]} {...rest}>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------ @expo/vector-icons */
const GLYPH: Record<string, string> = {
  home: '⌂',
  compass: '✥',
  library: '▤',
  person: '☺',
  search: '⌕',
  close: '✕',
  'chevron-back': '‹',
  'chevron-forward': '›',
  'chevron-up': '⌃',
  'chevron-down': '⌄',
  'arrow-back': '←',
  'arrow-up': '↑',
  heart: '♥',
  'heart-outline': '♡',
  'bookmark-outline': '🔖',
  'options-outline': '☰',
  'image-outline': '🖼',
  'book-outline': '📖',
  'library-outline': '▤',
  'alert-circle-outline': '!',
  'sparkles-outline': '✦',
  'albums-outline': '⧉',
  'checkmark-circle': '✓',
  play: '▶',
  ellipse: '●',
};

export const Ionicons = ({ name, size = 18, color = '#F2F0EB' }: any) => (
  <Text style={{ fontSize: size, color, lineHeight: size + 4, fontWeight: '700' }}>{GLYPH[name] ?? '•'}</Text>
);

/* ------------------------------------------------------------------ haptics/sound */
export const lightBuzz = () => undefined;
export const mediumBuzz = () => undefined;
export const successBuzz = () => undefined;
export const warningBuzz = () => undefined;
export const selectionBuzz = () => undefined;
export const playSend = () => undefined;
export const playReceive = () => undefined;
export const setAmbientPlaying = () => undefined;

/* ------------------------------------------------------------------ content loader */
export type CoverSource = { uri: string } | number;
export const effectiveContentApiBaseUrl = () => '';
export const mediaApiUrl = (_base: string, dir: string, file: string) => `/__covers/${dir}__${file}`;
export const getBundledCoverSource = (meta: any): CoverSource => ({ uri: `/__covers/${meta?.coverAsset ?? meta?.id}.jpg` });
export const getBundle = async () => {
  throw new Error('preview stub');
};
export const isStoryOnDevice = async () => true;
export const downloadStory = async () => undefined;
export class StoryContentError extends Error {
  code: string;
  constructor(message: string, code = 'missing') {
    super(message);
    this.code = code;
  }
}

/* --------------------------------------------------------------------- app state */
const THEME = COLORS.midnight;

const STORY = (over: Record<string, any> = {}) => ({
  id: 'arranged-marriage-wala-love',
  title: 'Arranged Marriage Wala Love',
  tagline: 'Ek chai ke sawaal se shuru — iske baad har mod tumhare haath mein.',
  description:
    'Rampur mein Ankit apne parivaar ke saath Poonam ko milne aata hai. Pehli mulaqat chai ke ek sawaal par rukti hai — uske baad har mod tumhare haath mein hai.',
  genres: ['Romance', 'Family Drama', 'Slice of Life'],
  tags: ['slow-burn', 'ongoing'],
  characters: ['Poonam', 'Bhabhi'],
  ageRating: '18+',
  accentColor: '#E9435E',
  popularity: 98,
  estimatedMinutes: 45,
  updatedAt: '2026-10-05T10:00:00.000Z',
  isNew: false,
  featured: true,
  coverAsset: 'chai-dreams',
  ...over,
});

const STORIES = [
  STORY(),
  STORY({ id: 'midnight-local', title: 'Midnight Local', tagline: 'Aakhri local pakdi — aur usme ek ajnabi.', genres: ['Horror', 'Thriller'], ageRating: '18+', coverAsset: 'midnight-local', featured: false, accentColor: '#A99CFF' }),
  STORY({ id: 'campus-queen', title: 'Campus Queen', tagline: 'College ki sabse badi star, aur tum uska raaz.', genres: ['Drama', 'Romance'], coverAsset: 'campus-queen', featured: false, accentColor: '#FF8A9B', isNew: true }),
  STORY({ id: 'pahadon-wali-haveli', title: 'Pahadon Wali Haveli', tagline: 'Haveli ke darwaze band hain… andar koi hai.', genres: ['Mystery', 'Horror'], coverAsset: 'pahadon-wali-haveli', featured: false, accentColor: '#7AA5FF', isNew: true }),
  STORY({ id: 'hawa-band-dhaba', title: 'Hawa Band Dhaba', tagline: 'Highway ka wo dhaba jahan time rukta hai.', genres: ['Comedy', 'Slice of Life'], ageRating: '12-17', coverAsset: 'hawa-band-dhaba', featured: false, accentColor: '#FFD66E' }),
  STORY({ id: 'goddess-of-underworld-loves-me', title: 'Goddess Of Underworld Loves Me', tagline: 'Pataal ki rani ko tumse pyaar ho gaya.', genres: ['Mythology', 'Romance'], coverAsset: 'goddess-of-underworld-loves-me', featured: false, accentColor: '#FF8ACF', isNew: true }),
];

const PLAYS = [
  {
    id: 'pt_1',
    storyId: 'midnight-local',
    label: 'Journey 1',
    status: 'active',
    progress: 0.38,
    messageCount: 42,
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'pt_2',
    storyId: 'campus-queen',
    label: 'Journey 2',
    status: 'active',
    progress: 0.64,
    messageCount: 88,
    updatedAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
  },
];

export function useApp(): any {
  return {
    theme: THEME,
    profile: { nickname: 'Ankit', ageGroup: '18+' },
    settings: { textSize: 'medium', sound: false, haptics: true, contentApiBaseUrl: '' },
    stories: STORIES,
    favoriteIds: new Set(['midnight-local']),
    recentPlaythroughs: PLAYS,
    toggleFavorite: async () => true,
    refreshRecent: async () => undefined,
    refreshStories: async () => undefined,
    activeProvider: { id: 'openai' },
    providersWithKeys: new Set(['openai']),
  };
}

export const AppProvider = ({ children }: any) => children ?? null;
