/**
 * KISSA CINEMATIC DESIGN SYSTEM — Premium Dark (v2.4.1)
 *
 * 100% Original Kissa visual language:
 *  - Obsidian / velvet-black canvas (#09080C), luminous pearl typography (#F6F4F8)
 *  - Signature Kissa jewel rose & coral glow (#E63964, #FF5C8A), sunset amber highlights (#F6A05A)
 *  - Artwork-first philosophy: natural aspect ratio preservation, distortion-free contain rendering
 *  - Direction-aware auto-hiding chrome: immersive reading space with instant effortless navigation
 *  - Stage-like interactive fiction: atmospheric narration, crisp character dialogue, distinct player voice
 */

export const COLORS = {
  midnight: {
    bg: '#09080C',
    bgSoft: '#121018',
    bgElevated: '#191622',
    surface: '#181522',
    surface2: '#221E30',
    surface3: '#2D283E',
    card: 'rgba(255, 255, 255, 0.04)',
    cardHover: 'rgba(255, 255, 255, 0.07)',
    border: 'rgba(246, 244, 248, 0.09)',
    borderSoft: 'rgba(246, 244, 248, 0.05)',
    borderGlow: 'rgba(230, 57, 100, 0.35)',
    text: '#F6F4F8',
    textDim: '#B8B1C6',
    textFaint: '#7C758F',
    textMuted: '#564F68',
    primary: '#E63964',
    primarySoft: 'rgba(230, 57, 100, 0.16)',
    primaryMuted: 'rgba(230, 57, 100, 0.08)',
    accent: '#FF5C8A',
    accentSoft: 'rgba(255, 92, 138, 0.15)',
    accentMuted: 'rgba(255, 92, 138, 0.08)',
    accentAmber: '#F6A05A',
    accentAmberSoft: 'rgba(246, 160, 90, 0.16)',
    success: '#4ADE80',
    danger: '#F87171',
    info: '#60A5FA',
    overlay: 'rgba(9, 8, 12, 0.84)',
    scrim: 'rgba(0, 0, 0, 0.65)',
  },
  amoled: {
    bg: '#000000',
    bgSoft: '#0A080E',
    bgElevated: '#120F1A',
    surface: '#120F1A',
    surface2: '#1C1828',
    surface3: '#262136',
    card: 'rgba(255, 255, 255, 0.035)',
    cardHover: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(246, 244, 248, 0.08)',
    borderSoft: 'rgba(246, 244, 248, 0.04)',
    borderGlow: 'rgba(230, 57, 100, 0.32)',
    text: '#F6F4F8',
    textDim: '#B8B1C6',
    textFaint: '#746D86',
    textMuted: '#4C465C',
    primary: '#E63964',
    primarySoft: 'rgba(230, 57, 100, 0.18)',
    primaryMuted: 'rgba(230, 57, 100, 0.10)',
    accent: '#FF5C8A',
    accentSoft: 'rgba(255, 92, 138, 0.16)',
    accentMuted: 'rgba(255, 92, 138, 0.09)',
    accentAmber: '#F6A05A',
    accentAmberSoft: 'rgba(246, 160, 90, 0.16)',
    success: '#4ADE80',
    danger: '#F87171',
    info: '#60A5FA',
    overlay: 'rgba(0, 0, 0, 0.88)',
    scrim: 'rgba(0, 0, 0, 0.72)',
  },
} as const;

export type ThemeName = keyof typeof COLORS;
export type Theme = (typeof COLORS)[ThemeName];

/** Crisp dark ink on bright button fills. */
export const INK = '#0E070B';

export const GRADIENTS = {
  hero: ['#FF5C8A', '#E63964', '#962058'] as const,
  primary: ['#FF5C8A', '#D82B57'] as const,
  gold: ['#F6A05A', '#E63964'] as const,
  amberRose: ['#FF7597', '#F6A05A'] as const,
  card: ['rgba(230, 57, 100, 0.14)', 'rgba(9, 8, 12, 0.0)'] as const,
  surfaceGrad: ['rgba(25, 21, 34, 0.90)', 'rgba(15, 13, 22, 0.96)'] as const,
  scrim: ['transparent', 'rgba(9, 8, 12, 0.94)'] as const,
  scrimSoft: ['transparent', 'rgba(9, 8, 12, 0.48)'] as const,
  shimmer: ['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.07)'] as const,
};

export const FONTS = {
  display: 28,
  title: 22,
  heading: 18,
  body: 15,
  small: 13,
  tiny: 11,
};

/**
 * How strongly *action* / narration text is faded in chat.
 */
export const FADED_TEXT_OPACITY = 0.64;

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
  large: 1.15,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const GENRE_COLORS: Record<string, string> = {
  Fantasy: '#C084FC',
  Mystery: '#60A5FA',
  Thriller: '#F87171',
  Adventure: '#34D399',
  'Sci-Fi': '#38BDF8',
  Drama: '#FB7185',
  Comedy: '#FBBF24',
  Horror: '#A78BFA',
  Historical: '#F59E0B',
  Mythology: '#F472B6',
  Superhero: '#FF6467',
  Anime: '#F43F5E',
  Magical: '#E879F9',
  Action: '#FB923C',
  Romance: '#F472B6',
  Crime: '#94A3B8',
};

export function genreColor(genre: string): string {
  return GENRE_COLORS[genre] ?? '#E63964';
}

/* ------------------------------------------------------------------ */
/* Cinematic Typography Tokens (v2.4.1)                                */
/* ------------------------------------------------------------------ */

export const TYPE = {
  displayXL: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.8, lineHeight: 40 },
  display: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, lineHeight: 34 },
  displaySmall: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.4, lineHeight: 30 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 28 },
  heading: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 24 },
  subheading: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.1, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '500' as const, letterSpacing: 0.1, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '700' as const, letterSpacing: 0.05, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0.15, lineHeight: 18 },
  smallStrong: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.2, lineHeight: 18 },
  tiny: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4, lineHeight: 14 },
  caption: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8, lineHeight: 12 },
  overline: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.8, lineHeight: 14 },
} as const;

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 5,
  },
  hero: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.44,
    shadowRadius: 24,
    elevation: 9,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.42,
    shadowRadius: 26,
    elevation: 12,
  },
  glowAccent: {
    shadowColor: '#E63964',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  glowRose: {
    shadowColor: '#FF5C8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 6,
  },
} as const;

export const GLASS = {
  bg: 'rgba(14, 12, 19, 0.74)',
  bgStrong: 'rgba(22, 18, 30, 0.88)',
  stroke: 'rgba(246, 244, 248, 0.12)',
  strokeSoft: 'rgba(246, 244, 248, 0.06)',
} as const;

export const MOTION = {
  instant: 120,
  quick: 180,
  base: 220,
  gentle: 320,
  slow: 460,
  spring: { damping: 20, stiffness: 280, mass: 0.8 } as const,
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
    ['#FF5C8A', '#962058'],
    ['#60A5FA', '#2563EB'],
    ['#34D399', '#059669'],
    ['#F472B6', '#BE185D'],
    ['#C084FC', '#7E22CE'],
    ['#F6A05A', '#C2410C'],
    ['#38BDF8', '#0284C7'],
    ['#FB7185', '#E11D48'],
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return pairs[h % pairs.length];
}

export const SHIMMER_DURATION = 1100;
