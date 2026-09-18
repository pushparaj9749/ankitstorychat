/**
 * KISSA v4.2 — CINEMATIC DESIGN SYSTEM
 *
 * 100% Original Kissa Visual Identity (v4.2)
 * -------------------------------------------------
 * Foundation: very dark near-black ink (#06060A), charcoal depth (#0E0E14)
 * Surfaces: deep charcoal #13131B, elevated #1C1C27, soft elevated #262636
 * Typography: warm pearl #F2F0EB primary, muted stone #A09CA8 secondary
 * Accent: Kissa Rose #E9435E (warm rose/coral) + Champagne highlight #F3D5A6
 *         Used sparingly: CTA, active nav, progress, selected category
 * Philosophy: artwork-first, stage-like, minimal chrome, editorial typography
 *             Natural image ratios preserved everywhere, no cropping
 *             Direction-aware auto-hiding header + bottom nav for max content
 *             Cinematic chat: narration faded italic, dialogue crisp, player distinct
 */

export const COLORS = {
  midnight: {
    bg: '#06060A',
    bgSoft: '#0E0E14',
    bgElevated: '#17171F',
    surface: '#14141D',
    surface2: '#1E1E2B',
    surface3: '#2A2A3A',
    card: 'rgba(255, 251, 245, 0.045)',
    cardHover: 'rgba(255, 251, 245, 0.075)',
    border: 'rgba(242, 240, 235, 0.085)',
    borderSoft: 'rgba(242, 240, 235, 0.05)',
    borderGlow: 'rgba(233, 67, 94, 0.32)',
    text: '#F2F0EB',
    textDim: '#A09CA8',
    textFaint: '#6F6B78',
    textMuted: '#4A4752',
    primary: '#E9435E',
    primarySoft: 'rgba(233, 67, 94, 0.14)',
    primaryMuted: 'rgba(233, 67, 94, 0.07)',
    accent: '#FF6B7E',
    accentSoft: 'rgba(255, 107, 126, 0.14)',
    accentMuted: 'rgba(255, 107, 126, 0.07)',
    accentAmber: '#F3D5A6',
    accentAmberSoft: 'rgba(243, 213, 166, 0.14)',
    champagne: '#F3D5A6',
    champagneSoft: 'rgba(243, 213, 166, 0.12)',
    success: '#4ADE80',
    danger: '#F87171',
    info: '#7AA5FF',
    overlay: 'rgba(6, 6, 10, 0.86)',
    scrim: 'rgba(0, 0, 0, 0.62)',
  },
  amoled: {
    bg: '#000000',
    bgSoft: '#08080C',
    bgElevated: '#111118',
    surface: '#101018',
    surface2: '#1A1A26',
    surface3: '#242438',
    card: 'rgba(255, 251, 245, 0.04)',
    cardHover: 'rgba(255, 251, 245, 0.065)',
    border: 'rgba(242, 240, 235, 0.075)',
    borderSoft: 'rgba(242, 240, 235, 0.04)',
    borderGlow: 'rgba(233, 67, 94, 0.28)',
    text: '#F2F0EB',
    textDim: '#A09CA8',
    textFaint: '#6A6674',
    textMuted: '#44404E',
    primary: '#E9435E',
    primarySoft: 'rgba(233, 67, 94, 0.16)',
    primaryMuted: 'rgba(233, 67, 94, 0.09)',
    accent: '#FF6B7E',
    accentSoft: 'rgba(255, 107, 126, 0.15)',
    accentMuted: 'rgba(255, 107, 126, 0.08)',
    accentAmber: '#F3D5A6',
    accentAmberSoft: 'rgba(243, 213, 166, 0.14)',
    champagne: '#F3D5A6',
    champagneSoft: 'rgba(243, 213, 166, 0.12)',
    success: '#4ADE80',
    danger: '#F87171',
    info: '#7AA5FF',
    overlay: 'rgba(0, 0, 0, 0.90)',
    scrim: 'rgba(0, 0, 0, 0.70)',
  },
} as const;

export type ThemeName = keyof typeof COLORS;
export type Theme = (typeof COLORS)[ThemeName];

export const INK = '#0A0608';

export const GRADIENTS = {
  hero: ['#FF6B7E', '#E9435E', '#7A1E2F'] as const,
  primary: ['#FF6B7E', '#E9435E'] as const,
  rose: ['#FF8A9B', '#E9435E'] as const,
  gold: ['#F3D5A6', '#E9435E'] as const,
  champagneRose: ['#FF8A9B', '#F3D5A6'] as const,
  card: ['rgba(233, 67, 94, 0.12)', 'rgba(6, 6, 10, 0.0)'] as const,
  surfaceGrad: ['rgba(23, 23, 31, 0.92)', 'rgba(12, 12, 18, 0.98)'] as const,
  scrim: ['transparent', 'rgba(6, 6, 10, 0.96)'] as const,
  scrimSoft: ['transparent', 'rgba(6, 6, 10, 0.44)'] as const,
  shimmer: ['rgba(255, 251, 245, 0.06)', 'rgba(255, 251, 245, 0.02)', 'rgba(255, 251, 245, 0.06)'] as const,
  heroShade: ['transparent', 'rgba(6,6,10,0.18)', 'rgba(6,6,10,0.78)', 'rgba(6,6,10,0.98)'] as const,
};

export const FONTS = {
  display: 30,
  title: 22,
  heading: 18,
  body: 15,
  small: 13,
  tiny: 11,
};

export const FADED_TEXT_OPACITY = 0.62;

export function withAlpha(color: string, alpha: number): string {
  const hex = (color ?? '').trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) return color;
  const body = m[1];
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export const TEXT_SIZE_MULTIPLIER: Record<'small' | 'medium' | 'large', number> = {
  small: 0.9,
  medium: 1,
  large: 1.16,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
  page: 18,
} as const;

export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 30,
  pill: 999,
} as const;

export const GENRE_COLORS: Record<string, string> = {
  Fantasy: '#C4A6FF',
  Mystery: '#7AA5FF',
  Thriller: '#FF7A7A',
  Adventure: '#5EE9B5',
  'Sci-Fi': '#6EDCFF',
  Drama: '#FF8A9B',
  Comedy: '#FFD66E',
  Horror: '#A99CFF',
  Historical: '#FFB86E',
  Mythology: '#FF8ACF',
  Superhero: '#FF6B7E',
  Anime: '#FF5A7A',
  Magical: '#E9A6FF',
  Action: '#FF9A5C',
  Romance: '#FF7EB8',
  Crime: '#A0A8B8',
};

export function genreColor(genre: string): string {
  return GENRE_COLORS[genre] ?? '#E9435E';
}

/* Typography — editorial, cinematic, consistent */
export const TYPE = {
  displayXL: { fontSize: 36, fontWeight: '800' as const, letterSpacing: -0.9, lineHeight: 42 },
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.6, lineHeight: 36 },
  displaySmall: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5, lineHeight: 32 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.35, lineHeight: 28 },
  heading: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.25, lineHeight: 24 },
  subheading: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.15, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '500' as const, letterSpacing: 0.08, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '700' as const, letterSpacing: 0.02, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0.12, lineHeight: 18 },
  smallStrong: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.15, lineHeight: 18 },
  tiny: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.35, lineHeight: 14 },
  caption: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.7, lineHeight: 12 },
  overline: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.6, lineHeight: 14 },
  brand: { fontSize: 15, fontWeight: '900' as const, letterSpacing: 2.6, lineHeight: 18 },
  heroTitle: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.6, lineHeight: 32 },
  chatNarration: { fontSize: 14, fontWeight: '500' as const, letterSpacing: 0.15, lineHeight: 21 },
  chatDialogue: { fontSize: 15, fontWeight: '600' as const, letterSpacing: 0.05, lineHeight: 22 },
} as const;

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
  },
  hero: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.40,
    shadowRadius: 22,
    elevation: 8,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 10,
  },
  glowAccent: {
    shadowColor: '#E9435E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  glowRose: {
    shadowColor: '#FF6B7E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 5,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;

export const GLASS = {
  bg: 'rgba(12, 12, 18, 0.72)',
  bgStrong: 'rgba(20, 20, 29, 0.86)',
  stroke: 'rgba(242, 240, 235, 0.10)',
  strokeSoft: 'rgba(242, 240, 235, 0.05)',
} as const;

export const MOTION = {
  instant: 100,
  quick: 160,
  base: 200,
  gentle: 300,
  slow: 420,
  spring: { damping: 22, stiffness: 300, mass: 0.85 } as const,
  ease: 'easeOut' as const,
  easeInOut: 'easeInOut' as const,
} as const;

export const ELEVATION = {
  surface: 1,
  card: 2,
  overlay: 4,
  modal: 8,
} as const;

export function avatarColors(id: string): [string, string] {
  const pairs: [string, string][] = [
    ['#FF6B7E', '#7A1E2F'],
    ['#7AA5FF', '#1E3A8A'],
    ['#5EE9B5', '#065F46'],
    ['#FF8ACF', '#9D174D'],
    ['#C4A6FF', '#5B21B6'],
    ['#F3D5A6', '#9A3412'],
    ['#6EDCFF', '#0C4A6E'],
    ['#FF8A9B', '#9F1239'],
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return pairs[h % pairs.length];
}

export const SHIMMER_DURATION = 1000;

/* Layout constants */
export const LAYOUT = {
  headerHeight: 62,
  tabBarHeight: 64,
  composerMinHeight: 52,
  contentMaxWidth: 560,
} as const;

/* Kissa brand tokens */
export const KISSA = {
  wordmark: 'KISSA',
  tagline: 'INTERACTIVE CINEMA',
  accent: '#E9435E',
  accentLight: '#FF6B7E',
  champagne: '#F3D5A6',
} as const;
