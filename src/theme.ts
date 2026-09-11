/**
 * Kissa design system — cinematic dark theme.
 * Original palette: deep-space violet + neon amber accents.
 */

export const COLORS = {
  midnight: {
    bg: '#0B0620',
    bgSoft: '#120B2E',
    surface: '#181036',
    surface2: '#1F1545',
    card: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.10)',
    text: '#F5F1FF',
    textDim: '#B9AEE0',
    textFaint: '#7C72A3',
    primary: '#8B5CF6',
    primarySoft: 'rgba(139,92,246,0.16)',
    accent: '#F5B841',
    accentSoft: 'rgba(245,184,65,0.14)',
    success: '#34D399',
    danger: '#F87171',
    info: '#60A5FA',
  },
  amoled: {
    bg: '#000000',
    bgSoft: '#050505',
    surface: '#0D0D12',
    surface2: '#14141B',
    card: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.09)',
    text: '#F5F1FF',
    textDim: '#B9AEE0',
    textFaint: '#6E6591',
    primary: '#8B5CF6',
    primarySoft: 'rgba(139,92,246,0.18)',
    accent: '#F5B841',
    accentSoft: 'rgba(245,184,65,0.14)',
    success: '#34D399',
    danger: '#F87171',
    info: '#60A5FA',
  },
} as const;

export type ThemeName = keyof typeof COLORS;
export type Theme = (typeof COLORS)[ThemeName];

export const GRADIENTS = {
  hero: ['#8B5CF6', '#EC4899', '#F5B841'] as const,
  primary: ['#8B5CF6', '#6D28D9'] as const,
  gold: ['#F5B841', '#EA7C28'] as const,
  card: ['rgba(139,92,246,0.28)', 'rgba(11,6,32,0.0)'] as const,
};

export const FONTS = {
  display: 28,
  title: 22,
  heading: 18,
  body: 15,
  small: 13,
  tiny: 11,
};

export const TEXT_SIZE_MULTIPLIER: Record<'small' | 'medium' | 'large', number> = {
  small: 0.9,
  medium: 1,
  large: 1.15,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

/** Genre -> accent color mapping for chips and cards. */
export const GENRE_COLORS: Record<string, string> = {
  Fantasy: '#8B5CF6',
  Mystery: '#60A5FA',
  Thriller: '#F87171',
  Adventure: '#34D399',
  'Sci-Fi': '#22D3EE',
  Drama: '#F472B6',
  Comedy: '#F5B841',
  Horror: '#A855F7',
  Historical: '#D4A373',
  Mythology: '#FB923C',
  Superhero: '#EF4444',
  Anime: '#F0ABFC',
  Magical: '#C084FC',
  Action: '#F97316',
  Romance: '#FB7185',
  Crime: '#94A3B8',
};

export function genreColor(genre: string): string {
  return GENRE_COLORS[genre] ?? '#8B5CF6';
}

/** Deterministic gradient avatar colors from any string id. */
export function avatarColors(id: string): [string, string] {
  const pairs: [string, string][] = [
    ['#8B5CF6', '#EC4899'],
    ['#22D3EE', '#3B82F6'],
    ['#F5B841', '#EA7C28'],
    ['#34D399', '#0EA5E9'],
    ['#F472B6', '#8B5CF6'],
    ['#A3E635', '#10B981'],
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return pairs[h % pairs.length];
}
