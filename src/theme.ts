/**
 * KISSA CINEMATIC DESIGN SYSTEM — Premium Dark (v2.4)
 *
 * God-level redesign: obsidian canvas, warm terracotta accent, cream type,
 * glass + glow, art-first posters, stage-like chat.
 *
 * Foundations:
 *  - Obsidian / warm-black canvas (#0C0B0A), cream type (#F4EDE4) — not neon
 *  - One terracotta primary + warm amber accent, used sparingly
 *  - Poster cards: quiet borders, soft radius, art-first, readable labels
 *  - Chat as cinematic stage: narration vs dialogue, character identity, atmosphere
 *  - Motion: tasteful, 180-260ms, spring for hero, ease for chrome
 *  - Glass: frosted overlays with subtle stroke, not heavy blur (perf)
 */

export const COLORS = {
  midnight: {
    bg: '#0C0B0A',
    bgSoft: '#141210',
    bgElevated: '#1A1816',
    surface: '#1C1916',
    surface2: '#26221E',
    surface3: '#2E2A26',
    card: 'rgba(255,244,230,0.05)',
    border: 'rgba(244,237,228,0.10)',
    borderSoft: 'rgba(244,237,228,0.06)',
    text: '#F4EDE4',
    textDim: '#C4B6A6',
    textFaint: '#8A7D70',
    textMuted: '#6B5E52',
    primary: '#C45C4A',
    primarySoft: 'rgba(196,92,74,0.18)',
    primaryMuted: 'rgba(196,92,74,0.10)',
    accent: '#E8A070',
    accentSoft: 'rgba(232,160,112,0.16)',
    accentMuted: 'rgba(232,160,112,0.08)',
    success: '#6FBF9A',
    danger: '#E07A7A',
    info: '#7BA3C9',
    overlay: 'rgba(12,11,10,0.72)',
    scrim: 'rgba(0,0,0,0.56)',
  },
  amoled: {
    bg: '#000000',
    bgSoft: '#070706',
    bgElevated: '#12110F',
    surface: '#12110F',
    surface2: '#1A1816',
    surface3: '#23201E',
    card: 'rgba(255,244,230,0.04)',
    border: 'rgba(244,237,228,0.08)',
    borderSoft: 'rgba(244,237,228,0.05)',
    text: '#F4EDE4',
    textDim: '#C4B6A6',
    textFaint: '#7A7066',
    textMuted: '#5A524C',
    primary: '#C45C4A',
    primarySoft: 'rgba(196,92,74,0.20)',
    primaryMuted: 'rgba(196,92,74,0.12)',
    accent: '#E8A070',
    accentSoft: 'rgba(232,160,112,0.16)',
    accentMuted: 'rgba(232,160,112,0.10)',
    success: '#6FBF9A',
    danger: '#E07A7A',
    info: '#7BA3C9',
    overlay: 'rgba(0,0,0,0.78)',
    scrim: 'rgba(0,0,0,0.64)',
  },
} as const;

export type ThemeName = keyof typeof COLORS;
export type Theme = (typeof COLORS)[ThemeName];

/** Ink on terracotta CTAs. */
export const INK = '#1A100C';

export const GRADIENTS = {
  hero: ['#C45C4A', '#E8A070'] as const,
  primary: ['#C45C4A', '#9E3F32'] as const,
  gold: ['#E8A070', '#C45C4A'] as const,
  card: ['rgba(196,92,74,0.18)', 'rgba(12,11,10,0.0)'] as const,
  scrim: ['transparent', 'rgba(12,11,10,0.92)'] as const,
  scrimSoft: ['transparent', 'rgba(12,11,10,0.42)'] as const,
  shimmer: ['rgba(244,237,228,0.06)', 'rgba(244,237,228,0.02)', 'rgba(244,237,228,0.06)'] as const,
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
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const GENRE_COLORS: Record<string, string> = {
  Fantasy: '#C9A27A',
  Mystery: '#7BA3C9',
  Thriller: '#E07A7A',
  Adventure: '#6FBF9A',
  'Sci-Fi': '#7BB8C4',
  Drama: '#D4788A',
  Comedy: '#E8A070',
  Horror: '#A878C4',
  Historical: '#D4A373',
  Mythology: '#E08A4A',
  Superhero: '#E07A5A',
  Anime: '#D9A0C4',
  Magical: '#C4A0D9',
  Action: '#E08A4A',
  Romance: '#E08A9A',
  Crime: '#A8A09A',
};

export function genreColor(genre: string): string {
  return GENRE_COLORS[genre] ?? '#C45C4A';
}

/* ------------------------------------------------------------------ */
/* Cinematic tokens (v2.4)                                             */
/* ------------------------------------------------------------------ */

export const TYPE = {
  displayXL: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.8, lineHeight: 38 },
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
  overline: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.6, lineHeight: 14 },
} as const;

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 5,
  },
  hero: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 8,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.36,
    shadowRadius: 24,
    elevation: 10,
  },
  glowAccent: {
    shadowColor: '#E8A070',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export const GLASS = {
  bg: 'rgba(12,11,10,0.62)',
  bgStrong: 'rgba(18,16,14,0.76)',
  stroke: 'rgba(244,237,228,0.12)',
  strokeSoft: 'rgba(244,237,228,0.08)',
} as const;

export const MOTION = {
  instant: 120,
  quick: 180,
  base: 240,
  gentle: 340,
  slow: 480,
  spring: { damping: 18, stiffness: 260, mass: 0.8 } as const,
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
    ['#C45C4A', '#E8A070'],
    ['#7BA3C9', '#4A6FA5'],
    ['#6FBF9A', '#3D8A6A'],
    ['#D4788A', '#C45C4A'],
    ['#C9A27A', '#8A6A48'],
    ['#A878C4', '#6A4A8A'],
    ['#E08A4A', '#B65A2A'],
    ['#5AA9A0', '#2F6F68'],
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return pairs[h % pairs.length];
}

// Subtle shimmer key for skeleton
export const SHIMMER_DURATION = 1100;
