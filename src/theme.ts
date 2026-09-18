/**
 * Kissa design system — Kavana-inspired premium dark.
 *
 * Rules we took from Kavana (feel, not a clone):
 *  1. Obsidian / warm-black canvas, cream type — not neon-violet glow.
 *  2. One warm terracotta accent, used sparingly on tabs, CTAs, progress.
 *  3. Poster cards: quiet borders, soft radius, art-first, readable labels.
 *  4. Chat chrome is a stage: sticky role line, cream bubbles, warm send.
 */

export const COLORS = {
  midnight: {
    bg: '#0C0B0A',
    bgSoft: '#141210',
    surface: '#1C1916',
    surface2: '#26221E',
    card: 'rgba(255,244,230,0.05)',
    border: 'rgba(244,237,228,0.10)',
    text: '#F4EDE4',
    textDim: '#C4B6A6',
    textFaint: '#8A7D70',
    primary: '#C45C4A',
    primarySoft: 'rgba(196,92,74,0.18)',
    accent: '#E8A070',
    accentSoft: 'rgba(232,160,112,0.16)',
    success: '#6FBF9A',
    danger: '#E07A7A',
    info: '#7BA3C9',
  },
  amoled: {
    bg: '#000000',
    bgSoft: '#070706',
    surface: '#12110F',
    surface2: '#1A1816',
    card: 'rgba(255,244,230,0.04)',
    border: 'rgba(244,237,228,0.08)',
    text: '#F4EDE4',
    textDim: '#C4B6A6',
    textFaint: '#7A7066',
    primary: '#C45C4A',
    primarySoft: 'rgba(196,92,74,0.20)',
    accent: '#E8A070',
    accentSoft: 'rgba(232,160,112,0.16)',
    success: '#6FBF9A',
    danger: '#E07A7A',
    info: '#7BA3C9',
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
 * 1 = full strength (dialogue), lower = more faded background text.
 */
export const FADED_TEXT_OPACITY = 0.62;

/**
 * "#RRGGBB" / "#RGB" -> "rgba(r, g, b, alpha)".
 * Colours we don't understand are passed through untouched, so a themed
 * rgba() value still works.
 */
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
};

export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

/** Genre -> accent color mapping for chips and cards. */
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
/* V2 design tokens                                                     */
/* ------------------------------------------------------------------ */

/** Elevated, premium type ramp with tightened tracking for display text. */
export const TYPE = {
  displayXL: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.8 },
  display: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '500' as const, letterSpacing: 0.1 },
  small: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0.15 },
  tiny: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4 },
} as const;

/** Soft depth so cards and hero art float above the background. */
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
} as const;

/** Glassmorphism values for frosted overlays (hero badges, sheets). */
export const GLASS = {
  bg: 'rgba(12,11,10,0.62)',
  stroke: 'rgba(244,237,228,0.12)',
} as const;

/** Deterministic gradient avatar colors from any string id. */
export function avatarColors(id: string): [string, string] {
  const pairs: [string, string][] = [
    ['#C45C4A', '#E8A070'],
    ['#7BA3C9', '#4A6FA5'],
    ['#6FBF9A', '#3D8A6A'],
    ['#D4788A', '#C45C4A'],
    ['#C9A27A', '#8A6A48'],
    ['#A878C4', '#6A4A8A'],
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return pairs[h % pairs.length];
}
