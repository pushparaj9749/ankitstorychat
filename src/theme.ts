/**
 * KISSA v2.6 — "KISSA NIGHT" DESIGN SYSTEM
 *
 * Built from the logo: midnight plum stage (#0B0814), a magenta → violet
 * signature gradient (#FF4F8B → #A855F7) for anything you act on, and a warm
 * gold (#FFC46B) for highlights (ranks, ratings, "new").
 *
 * Artwork-first: covers are never cropped. Frames around artwork are filled
 * with a blurred ambient copy of the same art (see ArtBackdrop), so there are
 * no empty bands next to a cover.
 */

/** True black for OLED screens (pixels fully off). Used by the Chat stage. */
export const AMOLED = '#000000';

export const COLORS = {
  midnight: {
    bg: '#0B0814',
    bgSoft: '#120D20',
    bgElevated: '#1A1430',
    surface: '#151027',
    surface2: '#1F1838',
    surface3: '#2C2350',
    card: 'rgba(250, 244, 255, 0.05)',
    cardHover: 'rgba(250, 244, 255, 0.08)',
    border: 'rgba(235, 222, 255, 0.09)',
    borderSoft: 'rgba(235, 222, 255, 0.05)',
    borderGlow: 'rgba(255, 79, 139, 0.36)',
    text: '#F7F3FF',
    textDim: '#B8AFCC',
    textFaint: '#857B9E',
    textMuted: '#564D70',
    primary: '#FF4F8B',
    primarySoft: 'rgba(255, 79, 139, 0.15)',
    primaryMuted: 'rgba(255, 79, 139, 0.08)',
    accent: '#FF7AB0',
    accentSoft: 'rgba(255, 122, 176, 0.15)',
    accentMuted: 'rgba(255, 122, 176, 0.08)',
    violet: '#A855F7',
    violetSoft: 'rgba(168, 85, 247, 0.16)',
    gold: '#FFC46B',
    goldSoft: 'rgba(255, 196, 107, 0.15)',
    accentAmber: '#FFC46B',
    accentAmberSoft: 'rgba(255, 196, 107, 0.15)',
    champagne: '#FFD79A',
    champagneSoft: 'rgba(255, 215, 154, 0.12)',
    success: '#4ADE9B',
    danger: '#FF6B7A',
    info: '#8EA8FF',
    overlay: 'rgba(11, 8, 20, 0.88)',
    scrim: 'rgba(5, 3, 12, 0.64)',
  },
  amoled: {
    bg: '#000000',
    bgSoft: '#07050D',
    bgElevated: '#100C1C',
    surface: '#0E0A19',
    surface2: '#181229',
    surface3: '#241C3D',
    card: 'rgba(250, 244, 255, 0.04)',
    cardHover: 'rgba(250, 244, 255, 0.07)',
    border: 'rgba(235, 222, 255, 0.08)',
    borderSoft: 'rgba(235, 222, 255, 0.045)',
    borderGlow: 'rgba(255, 79, 139, 0.32)',
    text: '#F7F3FF',
    textDim: '#B8AFCC',
    textFaint: '#7F7598',
    textMuted: '#4E4566',
    primary: '#FF4F8B',
    primarySoft: 'rgba(255, 79, 139, 0.16)',
    primaryMuted: 'rgba(255, 79, 139, 0.09)',
    accent: '#FF7AB0',
    accentSoft: 'rgba(255, 122, 176, 0.15)',
    accentMuted: 'rgba(255, 122, 176, 0.08)',
    violet: '#A855F7',
    violetSoft: 'rgba(168, 85, 247, 0.16)',
    gold: '#FFC46B',
    goldSoft: 'rgba(255, 196, 107, 0.15)',
    accentAmber: '#FFC46B',
    accentAmberSoft: 'rgba(255, 196, 107, 0.15)',
    champagne: '#FFD79A',
    champagneSoft: 'rgba(255, 215, 154, 0.12)',
    success: '#4ADE9B',
    danger: '#FF6B7A',
    info: '#8EA8FF',
    overlay: 'rgba(0, 0, 0, 0.90)',
    scrim: 'rgba(0, 0, 0, 0.70)',
  },
} as const;

export type ThemeName = keyof typeof COLORS;
export type Theme = (typeof COLORS)[ThemeName];

export const INK = '#07050D';

export const GRADIENTS = {
  /** Signature Kissa gradient — magenta → violet, straight from the logo. */
  primary: ['#FF4F8B', '#A855F7'] as const,
  hero: ['#FF4F8B', '#A855F7', '#3B1670'] as const,
  rose: ['#FF7AB0', '#FF4F8B'] as const,
  violet: ['#C084FC', '#7C3AED'] as const,
  gold: ['#FFD79A', '#FF8A5C'] as const,
  champagneRose: ['#FF7AB0', '#FFD79A'] as const,
  card: ['rgba(255, 79, 139, 0.12)', 'rgba(11, 8, 20, 0.0)'] as const,
  surfaceGrad: ['rgba(31, 24, 56, 0.92)', 'rgba(18, 13, 32, 0.98)'] as const,
  scrim: ['transparent', 'rgba(11, 8, 20, 0.96)'] as const,
  scrimSoft: ['transparent', 'rgba(11, 8, 20, 0.44)'] as const,
  shimmer: ['rgba(250, 244, 255, 0.06)', 'rgba(250, 244, 255, 0.02)', 'rgba(250, 244, 255, 0.06)'] as const,
  heroShade: ['transparent', 'rgba(11,8,20,0.18)', 'rgba(11,8,20,0.78)', 'rgba(11,8,20,1)'] as const,
};

export const FONTS = {
  display: 30,
  title: 22,
  heading: 18,
  body: 15,
  small: 13,
  tiny: 11,
};

/**
 * CANONICAL TYPE SCALE — every piece of text in the app uses one of these.
 *
 * Screens used to ship 24 different font sizes (8 → 52), which flattened the
 * hierarchy: an 8.5px tagline read as loudly as a 15px description. Six steps
 * keep the rhythm readable and give every screen the same vertical voice.
 */
export const SCALE = {
  /** Uppercase, wide-tracked micro labels (kickers, badge text). */
  micro: 11,
  /** Metadata, timestamps, secondary chips. */
  caption: 12,
  /** Secondary labels inside cards. */
  small: 13,
  /** Primary body copy — never smaller than this. */
  body: 15,
  /** Section titles and card titles. */
  title: 17,
  /** Screen headlines. */
  h2: 22,
  /** Editorial display (hero titles, greetings). */
  display: 26,
} as const;

/** Minimum comfortable touch target (Material/iOS guidance). */
export const TOUCH = {
  min: 44,
  sm: 36,
} as const;

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
  return GENRE_COLORS[genre] ?? '#FF4F8B';
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
  caption: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5, lineHeight: 15 },
  overline: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.4, lineHeight: 14 },
  brand: { fontSize: 15, fontWeight: '900' as const, letterSpacing: 2.6, lineHeight: 18 },
  heroTitle: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.6, lineHeight: 31 },
  cardTitle: { fontSize: 17, fontWeight: '800' as const, letterSpacing: -0.3, lineHeight: 22 },
  chatNarration: { fontSize: 15, fontWeight: '500' as const, letterSpacing: 0.15, lineHeight: 23 },
  chatDialogue: { fontSize: 15.5, fontWeight: '600' as const, letterSpacing: 0.05, lineHeight: 23 },
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
    shadowColor: '#FF4F8B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  glowRose: {
    shadowColor: '#A855F7',
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
  bg: 'rgba(18, 13, 32, 0.72)',
  bgStrong: 'rgba(24, 18, 42, 0.90)',
  stroke: 'rgba(235, 222, 255, 0.11)',
  strokeSoft: 'rgba(235, 222, 255, 0.05)',
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
    ['#FF4F8B', '#7A1E52'],
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
  /** Bottom padding so the floating nav never covers the last row. */
  navClearance: 110,
} as const;

/* Kissa brand tokens */
export const KISSA = {
  wordmark: 'KISSA',
  tagline: 'INTERACTIVE CINEMA',
  accent: '#FF4F8B',
  accentLight: '#FF7AB0',
  violet: '#A855F7',
  champagne: '#FFC46B',
} as const;
