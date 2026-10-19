/**
 * KISSA v2.7 — "KISSA NOIR" DESIGN SYSTEM
 *
 * Clean and professional, not rang-birangi: a neutral midnight base
 * (#0A0B10, no purple cast), graphite surfaces separated by hairlines, ONE
 * soft rose accent (#F0567E) for the things you act on, and a muted champagne
 * (#E2BE7E) used sparingly for ratings/ranks. No neon, no glow, no rainbow.
 *
 * Artwork-first: covers are never cropped. Frames around artwork are filled
 * with a blurred ambient copy of the same art (see ArtBackdrop), so there are
 * no empty bands next to a cover.
 */

/** True black for OLED screens (pixels fully off). Used by the Chat stage. */
export const AMOLED = '#000000';

const ROSE = '#F0567E';
const ROSE_LIGHT = '#F58AA5';

export const COLORS = {
  midnight: {
    bg: '#0A0B10',
    bgSoft: '#0E1016',
    bgElevated: '#14161E',
    surface: '#111319',
    surface2: '#171A22',
    surface3: '#21242E',
    card: 'rgba(255, 255, 255, 0.035)',
    cardHover: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderSoft: 'rgba(255, 255, 255, 0.05)',
    borderGlow: 'rgba(240, 86, 126, 0.34)',
    text: '#F4F5F8',
    textDim: '#A8ACB9',
    textFaint: '#747887',
    textMuted: '#4A4E5B',
    primary: ROSE,
    primarySoft: 'rgba(240, 86, 126, 0.14)',
    primaryMuted: 'rgba(240, 86, 126, 0.07)',
    accent: ROSE_LIGHT,
    accentSoft: 'rgba(245, 138, 165, 0.14)',
    accentMuted: 'rgba(245, 138, 165, 0.07)',
    violet: '#9A9CC4',
    violetSoft: 'rgba(154, 156, 196, 0.14)',
    gold: '#E2BE7E',
    goldSoft: 'rgba(226, 190, 126, 0.13)',
    accentAmber: '#E2BE7E',
    accentAmberSoft: 'rgba(226, 190, 126, 0.13)',
    champagne: '#EBD3A6',
    champagneSoft: 'rgba(235, 211, 166, 0.10)',
    success: '#5CC995',
    danger: '#F0616F',
    info: '#8FA6E0',
    overlay: 'rgba(10, 11, 16, 0.90)',
    scrim: 'rgba(5, 6, 9, 0.66)',
  },
  amoled: {
    bg: '#000000',
    bgSoft: '#06070A',
    bgElevated: '#0D0E13',
    surface: '#0C0D12',
    surface2: '#14161C',
    surface3: '#1E2028',
    card: 'rgba(255, 255, 255, 0.03)',
    cardHover: 'rgba(255, 255, 255, 0.055)',
    border: 'rgba(255, 255, 255, 0.075)',
    borderSoft: 'rgba(255, 255, 255, 0.045)',
    borderGlow: 'rgba(240, 86, 126, 0.30)',
    text: '#F4F5F8',
    textDim: '#A8ACB9',
    textFaint: '#6F7381',
    textMuted: '#454955',
    primary: ROSE,
    primarySoft: 'rgba(240, 86, 126, 0.15)',
    primaryMuted: 'rgba(240, 86, 126, 0.08)',
    accent: ROSE_LIGHT,
    accentSoft: 'rgba(245, 138, 165, 0.14)',
    accentMuted: 'rgba(245, 138, 165, 0.07)',
    violet: '#9A9CC4',
    violetSoft: 'rgba(154, 156, 196, 0.14)',
    gold: '#E2BE7E',
    goldSoft: 'rgba(226, 190, 126, 0.13)',
    accentAmber: '#E2BE7E',
    accentAmberSoft: 'rgba(226, 190, 126, 0.13)',
    champagne: '#EBD3A6',
    champagneSoft: 'rgba(235, 211, 166, 0.10)',
    success: '#5CC995',
    danger: '#F0616F',
    info: '#8FA6E0',
    overlay: 'rgba(0, 0, 0, 0.90)',
    scrim: 'rgba(0, 0, 0, 0.70)',
  },
} as const;

export type ThemeName = keyof typeof COLORS;
export type Theme = { [K in keyof (typeof COLORS)['midnight']]: string };

/** UI template: 'noir' = v2.7 "Kissa Noir" (default), 'classic' = pre-v2.7 "Kissa Night". */
export type UiTemplate = 'noir' | 'classic';

export const INK = '#06070A';

export const GRADIENTS = {
  /** The one action gradient — a barely-there rose sheen, not a rainbow. */
  primary: ['#F2618A', '#E04A72'] as const,
  hero: ['#2A1A22', '#14161E', '#0A0B10'] as const,
  rose: ['#F58AA5', '#F0567E'] as const,
  violet: ['#3A3D52', '#22242F'] as const,
  gold: ['#EBD3A6', '#D9AE66'] as const,
  champagneRose: ['#F58AA5', '#EBD3A6'] as const,
  card: ['rgba(240, 86, 126, 0.08)', 'rgba(10, 11, 16, 0.0)'] as const,
  surfaceGrad: ['rgba(26, 28, 36, 0.94)', 'rgba(16, 18, 24, 0.98)'] as const,
  scrim: ['transparent', 'rgba(10, 11, 16, 0.96)'] as const,
  scrimSoft: ['transparent', 'rgba(10, 11, 16, 0.44)'] as const,
  shimmer: ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.05)'] as const,
  heroShade: ['transparent', 'rgba(10,11,16,0.18)', 'rgba(10,11,16,0.78)', 'rgba(10,11,16,1)'] as const,
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

/** Genre dots: quiet, desaturated tones that sit together (no rainbow). */
export const GENRE_COLORS: Record<string, string> = {
  Fantasy: '#A99BD6',
  Mystery: '#8DA2CC',
  Thriller: '#D98A8A',
  Adventure: '#86BFA6',
  'Sci-Fi': '#8DB8CC',
  Drama: '#D9A0A8',
  Comedy: '#D9C08A',
  Horror: '#9B95B8',
  Historical: '#CCA683',
  Mythology: '#C99BB8',
  Superhero: '#D08C94',
  Anime: '#D9909E',
  Magical: '#B9A3D1',
  Action: '#CF9F82',
  Romance: '#E59AAE',
  Crime: '#9EA4B0',
};

export function genreColor(genre: string): string {
  return GENRE_COLORS[genre] ?? '#E59AAE';
}

/* Typography — editorial, cinematic, consistent */
export const TYPE = {
  displayXL: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.9, lineHeight: 40 },
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.7, lineHeight: 34 },
  displaySmall: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.5, lineHeight: 30 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.35, lineHeight: 28 },
  heading: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.25, lineHeight: 24 },
  subheading: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.15, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '500' as const, letterSpacing: 0.08, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '700' as const, letterSpacing: 0.02, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0.12, lineHeight: 18 },
  smallStrong: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.15, lineHeight: 18 },
  tiny: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.35, lineHeight: 14 },
  caption: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5, lineHeight: 15 },
  overline: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4, lineHeight: 14 },
  brand: { fontSize: 15, fontWeight: '800' as const, letterSpacing: 2.6, lineHeight: 18 },
  heroTitle: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.7, lineHeight: 32 },
  cardTitle: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.25, lineHeight: 21 },
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
    shadowColor: '#F0567E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  glowRose: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
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
  bg: 'rgba(16, 18, 24, 0.74)',
  bgStrong: 'rgba(20, 22, 30, 0.92)',
  stroke: 'rgba(255, 255, 255, 0.10)',
  strokeSoft: 'rgba(255, 255, 255, 0.05)',
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
    ['#E58AA2', '#4A2230'],
    ['#93A5CF', '#232C45'],
    ['#8CC2AA', '#1E3A30'],
    ['#D7A3BC', '#40263A'],
    ['#ABA2D3', '#2C2747'],
    ['#DDBF93', '#45321E'],
    ['#93BFCF', '#1F3540'],
    ['#DE9AA2', '#47232A'],
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
  accent: '#F0567E',
  accentLight: '#F58AA5',
  violet: '#9A9CC4',
  champagne: '#E2BE7E',
} as const;
