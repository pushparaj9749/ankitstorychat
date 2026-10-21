/**
 * KISSA v2.6 — Custom SVG icon set ("Kissa Line").
 *
 * Every icon in the app is drawn here on a 24×24 grid with rounded caps and
 * joins — no icon font, no third-party glyphs. Two variants per glyph:
 *
 *   - `<name>-outline` → line icon (inactive / secondary chrome)
 *   - `<name>`         → duotone: same lines + a soft tinted body
 *                        (active tab, selected states). A few glyphs such as
 *                        `heart` and `play` are fully solid when filled.
 *
 * This module has NO app-state dependency (safe in isolated components such as
 * NaturalImage). The theme-aware `Icon` lives in ./icons.
 */
import React, { memo } from 'react';
import { sameRenderProps } from '../lib/memoProps';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface Glyph {
  /** Shapes that are stroked, and filled (tinted) in the filled variant. */
  body?: string[];
  /** Detail strokes, always drawn as lines on top of the body. */
  lines?: string[];
  /** Small solid dots: [cx, cy, r]. */
  dots?: [number, number, number][];
  /** Filled variant is fully solid instead of duotone. */
  solid?: boolean;
}

const CIRCLE = 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z';

const GLYPHS = {
  home: {
    body: ['M3.5 10.2 12 3.6l8.5 6.6v8.6a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z'],
    lines: ['M9.5 20.4v-4.9a2.5 2.5 0 0 1 5 0v4.9'],
  },
  compass: {
    body: [CIRCLE],
    lines: ['M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3z'],
    dots: [[12, 12, 0.9]],
  },
  library: {
    body: ['M4 4.5h3.6v15H4z', 'M9.6 4.5h3.6v15H9.6z', 'M15.3 5.7l3.4-.9 3 14.4-3.4.9z'],
    lines: ['M4 8.5h3.6', 'M9.6 8.5h3.6'],
  },
  person: {
    body: ['M12 3.8a3.9 3.9 0 1 1 0 7.8 3.9 3.9 0 0 1 0-7.8z', 'M4.5 20.2c.6-3.9 3.7-6.2 7.5-6.2s6.9 2.3 7.5 6.2z'],
  },
  search: {
    lines: ['M10.8 4a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6z', 'M16 16l4.5 4.5'],
  },
  bookmark: {
    body: ['M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.5L12 16.3l-6.5 4.2V5A1.5 1.5 0 0 1 7 3.5z'],
  },
  heart: {
    body: [
      'M12 20s-7.5-4.4-7.5-10.1C4.5 7.2 6.5 5 9 5c1.4 0 2.4.7 3 1.7C12.6 5.7 13.6 5 15 5c2.5 0 4.5 2.2 4.5 4.9C19.5 15.6 12 20 12 20z',
    ],
    solid: true,
  },
  play: {
    body: ['M8 5.6v12.8a1 1 0 0 0 1.5.86l10.2-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z'],
    solid: true,
  },
  'play-forward': {
    body: ['M3.5 6.6v10.8a.9.9 0 0 0 1.4.75L12 13.2V10.8L4.9 5.85a.9.9 0 0 0-1.4.75z', 'M12 6.6v10.8a.9.9 0 0 0 1.4.75l7.6-5.4a.9.9 0 0 0 0-1.5l-7.6-5.4a.9.9 0 0 0-1.4.75z'],
  },
  refresh: {
    lines: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.6 4.2v4.3h-4.3'],
  },
  map: {
    body: ['M3.5 6.2 9 4l6 2.2 5.5-2.2v13.8L15 20l-6-2.2-5.5 2.2z'],
    lines: ['M9 4v13.8', 'M15 6.2V20'],
  },
  'chevron-back': { lines: ['M15 5l-7 7 7 7'] },
  'chevron-forward': { lines: ['M9 5l7 7-7 7'] },
  'chevron-up': { lines: ['M5 15l7-7 7 7'] },
  'chevron-down': { lines: ['M5 9l7 7 7-7'] },
  close: { lines: ['M6 6l12 12', 'M18 6 6 18'] },
  'close-circle': {
    body: [CIRCLE],
    lines: ['M9.2 9.2l5.6 5.6', 'M14.8 9.2l-5.6 5.6'],
  },
  checkmark: { lines: ['M5 12.5l4.5 4.5L19 7.5'] },
  'checkmark-circle': { body: [CIRCLE], lines: ['M8 12.3l2.7 2.7L16 9.6'] },
  'arrow-up': { lines: ['M12 19V5', 'M6 11l6-6 6 6'] },
  add: { lines: ['M12 5v14', 'M5 12h14'] },
  options: {
    body: ['M15 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z', 'M9 15a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'],
    lines: ['M4 7h9', 'M17 7h3', 'M4 17h3', 'M11 17h9'],
  },
  sparkles: {
    body: [
      'M10 3.5l1.6 4.6 4.6 1.6-4.6 1.6L10 15.9l-1.6-4.6-4.6-1.6 4.6-1.6z',
      'M17.5 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
    ],
  },
  book: {
    body: ['M3.8 5.6c2.8-1.3 5.5-1.1 8.2.6v13.6c-2.7-1.7-5.4-1.9-8.2-.6z', 'M20.2 5.6c-2.8-1.3-5.5-1.1-8.2.6v13.6c2.7-1.7 5.4-1.9 8.2-.6z'],
  },
  albums: {
    body: ['M6 8.5h12a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2z'],
    lines: ['M6.5 5.5h11', 'M9 3h6'],
  },
  image: {
    body: ['M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5z'],
    lines: ['M3.8 16.5l4.7-4.7 4 4 2.5-2.5 5.2 5.2'],
    dots: [[15.5, 9, 1.4]],
  },
  'alert-circle': {
    body: [CIRCLE],
    lines: ['M12 7.5v5.3'],
    dots: [[12, 16.2, 1.1]],
  },
  'information-circle': {
    body: [CIRCLE],
    lines: ['M12 11v5.3'],
    dots: [[12, 7.9, 1.1]],
  },
  warning: {
    body: ['M10.3 4.5a2 2 0 0 1 3.4 0l7.2 12.5a2 2 0 0 1-1.7 3H4.8a2 2 0 0 1-1.7-3z'],
    lines: ['M12 9.5v4'],
    dots: [[12, 16.6, 1.1]],
  },
  bulb: {
    body: ['M12 3.5a6 6 0 0 1 3.6 10.8c-.7.5-1.1 1.3-1.1 2.2v.5h-5v-.5c0-.9-.4-1.7-1.1-2.2A6 6 0 0 1 12 3.5z'],
    lines: ['M9.8 20.5h4.4'],
  },
  'cloud-offline': {
    lines: ['M7 18.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.3 9.6 4.5 4.5 0 0 0 7 18.5z', 'M4 4l16 16'],
  },
  code: { lines: ['M8.5 7 3.5 12l5 5', 'M15.5 7l5 5-5 5'] },
  'color-palette': {
    body: [
      'M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.9.7-1.5 1.6-1.5H16a4.5 4.5 0 0 0 4.5-4.5c0-3.7-3.8-6.7-8.5-6.7z',
    ],
    dots: [
      [7.8, 11.4, 1.2],
      [10.2, 7.8, 1.2],
      [14.6, 8, 1.2],
    ],
  },
  create: {
    body: ['M15.8 4.7a2.1 2.1 0 0 1 3 3L8.5 18 4 19.5 5.5 15z'],
    lines: ['M13.5 7l3 3'],
  },
  'document-text': {
    body: ['M7 3.5h6.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z'],
    lines: ['M13.5 3.5V9H19', 'M8.5 13h7', 'M8.5 16.5h5'],
  },
  ellipse: { body: ['M12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12z'], solid: true },
  key: {
    body: ['M7.5 12.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z'],
    lines: ['M10.4 13.6 20 4', 'M17 7l2.5 2.5', 'M14.5 9.5l2 2'],
  },
  list: {
    lines: ['M9 6.5h11', 'M9 12h11', 'M9 17.5h11'],
    dots: [
      [4.8, 6.5, 1.3],
      [4.8, 12, 1.3],
      [4.8, 17.5, 1.3],
    ],
  },
  'lock-closed': {
    body: ['M6.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5z'],
    lines: ['M8 10.5V8a4 4 0 0 1 8 0v2.5'],
    dots: [[12, 15.3, 1.2]],
  },
  moon: { body: ['M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z'] },
  'musical-notes': {
    body: ['M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z', 'M20 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z'],
    lines: ['M9 17.5V6l11-2.5v12'],
  },
  notifications: {
    body: ['M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z'],
    lines: ['M10 21h4'],
  },
  school: {
    body: ['M2.5 9 12 4.5 21.5 9 12 13.5z'],
    lines: ['M6.5 11v5c1.5 1.5 3.5 2.3 5.5 2.3s4-.8 5.5-2.3v-5', 'M21.5 9v5'],
  },
  server: {
    body: [
      'M5 4h14a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 19 10H5a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 5 4z',
      'M5 14h14a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 5 14z',
    ],
    dots: [
      [7.5, 7, 1.1],
      [7.5, 17, 1.1],
    ],
  },
  settings: {
    body: ['M12 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z'],
    lines: [
      'M12 2.8v2.4',
      'M12 18.8v2.4',
      'M2.8 12h2.4',
      'M18.8 12h2.4',
      'M5.5 5.5l1.7 1.7',
      'M16.8 16.8l1.7 1.7',
      'M5.5 18.5l1.7-1.7',
      'M16.8 7.2l1.7-1.7',
      'M12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    ],
  },
  shield: {
    body: ['M12 3l7 3v5.5c0 4.3-3 7.8-7 9.5-4-1.7-7-5.2-7-9.5V6z'],
    lines: ['M9 12l2.2 2.2L15.5 10'],
  },
  flag: { body: ['M5.5 4h12l-2.2 4 2.2 4h-12z'], lines: ['M5.5 3v18'] },
  happy: {
    body: [CIRCLE],
    lines: ['M8.5 14c.9 1.4 2.1 2 3.5 2s2.6-.6 3.5-2'],
    dots: [
      [9, 10, 1.1],
      [15, 10, 1.1],
    ],
  },
  location: {
    body: ['M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z'],
    lines: ['M12 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z'],
  },
  move: {
    lines: ['M12 3v18', 'M3 12h18', 'M9 6l3-3 3 3', 'M9 18l3 3 3-3', 'M6 9l-3 3 3 3', 'M18 9l3 3-3 3'],
  },
  radio: { body: [CIRCLE], dots: [[12, 12, 3.6]] },
  text: { lines: ['M5 7V5h14v2', 'M12 5v14', 'M9 19h6'] },
  chatbubble: {
    body: ['M5.5 4.5h13a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H11l-4.5 3.5V17h-1a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z'],
    dots: [
      [8.5, 10.8, 1.1],
      [12, 10.8, 1.1],
      [15.5, 10.8, 1.1],
    ],
  },
  flame: {
    body: [
      'M12 21a6.5 6.5 0 0 1-6.5-6.5c0-3.8 3.4-5.7 4.2-10.5 2.8 1.6 4.3 4.3 4.3 6.5 1-.6 1.6-1.6 1.9-2.8 1.6 1.6 2.6 4 2.6 6.8A6.5 6.5 0 0 1 12 21z',
    ],
    lines: ['M12 21a2.6 2.6 0 0 1-2.6-2.6c0-1.6 1.3-2.4 2.6-4 1.3 1.6 2.6 2.4 2.6 4A2.6 2.6 0 0 1 12 21z'],
  },
  time: { body: [CIRCLE], lines: ['M12 7.5V12l3 2'] },
  star: {
    body: ['M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z'],
  },
  grid: {
    body: [
      'M5 4h4.5a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
      'M14.5 4H19a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1h-4.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
      'M5 13.5h4.5a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4.5a1 1 0 0 1 1-1z',
      'M14.5 13.5H19a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-4.5a1 1 0 0 1-1-1v-4.5a1 1 0 0 1 1-1z',
    ],
  },
  people: {
    body: ['M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z', 'M2.5 19.5c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5z'],
    lines: ['M15.5 4.8a3.3 3.3 0 0 1 0 6.4', 'M17.5 14.3c2.2.6 3.6 2.4 4 5.2'],
  },
  trash: {
    body: ['M6.5 7h11l-.9 12.1a1.5 1.5 0 0 1-1.5 1.4H8.9a1.5 1.5 0 0 1-1.5-1.4z'],
    lines: ['M4 7h16', 'M9.5 7V4.5h5V7', 'M10.3 11v6', 'M13.7 11v6'],
  },
  'finger-print': {
    lines: [
      'M6.2 6.4A8 8 0 0 1 19.6 10',
      'M4.3 10.5A8 8 0 0 1 5 8.6',
      'M7.6 19.4c1-1.7 1.6-3.7 1.6-5.9a2.8 2.8 0 0 1 5.6 0c0 .8 0 1.6-.1 2.4',
      'M5.2 16.8c.6-1 .9-2.1.9-3.3a5.9 5.9 0 0 1 11.8 0c0 2.4-.4 4.6-1.1 6.6',
      'M12 13.5c0 3-.9 5.8-2.4 8',
      'M14.3 18.6c-.3 1.1-.7 2.1-1.2 3',
    ],
  },
  backspace: {
    body: ['M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z'],
    lines: ['M11.5 9.5l5 5', 'M16.5 9.5l-5 5'],
  },
  download: {
    lines: ['M12 3.8v11', 'M7.5 10.6 12 15l4.5-4.4', 'M4.5 16.5v1.8a1.7 1.7 0 0 0 1.7 1.7h11.6a1.7 1.7 0 0 0 1.7-1.7v-1.8'],
  },
} satisfies Record<string, Glyph>;

type GlyphKey = keyof typeof GLYPHS;
/** Every drawable icon: `<glyph>` (duotone/solid) or `<glyph>-outline` (line). */
export type IconName = GlyphKey | `${GlyphKey}-outline`;

export const ICON_SIZE = { xs: 14, sm: 16, md: 20, lg: 24, xl: 30 } as const;

/** Resolve a name to its glyph and variant (exported for tests). */
export function resolveIcon(name: IconName): { glyph: Glyph; filled: boolean } | null {
  const outline = name.endsWith('-outline');
  const key = (outline ? name.slice(0, -'-outline'.length) : name) as GlyphKey;
  const glyph: Glyph | undefined = GLYPHS[key];
  if (!glyph) return null;
  return { glyph, filled: !outline };
}

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Override line weight (24-unit grid). Defaults scale with size for crispness. */
  strokeWidth?: number;
}

/** Provider-free icon — needs an explicit colour. Safe outside AppProvider. */
function IconGlyphImpl({ name, size = ICON_SIZE.md, color, style, testID, strokeWidth }: IconProps) {
  const tint = color ?? '#B4ABC8';
  const resolved = resolveIcon(name) ?? resolveIcon('ellipse-outline')!;
  const { glyph, filled } = resolved;
  // Small icons get a slightly heavier line so they stay legible.
  const sw = strokeWidth ?? (size <= 14 ? 2.3 : size <= 18 ? 2.05 : 1.85);
  const bodyFill = filled ? tint : 'none';
  const bodyFillOpacity = filled ? (glyph.solid ? 1 : 0.26) : 0;

  return (
    // Wrapped in a View so the icon stacks like every other RN view (on web a
    // bare <svg> would paint underneath absolutely-positioned gradient fills).
    <View style={[{ width: size, height: size }, style]} testID={testID} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {(glyph.body ?? []).map((d, i) => (
          <Path
            key={`b${i}`}
            d={d}
            fill={bodyFill}
            fillOpacity={bodyFillOpacity}
            stroke={tint}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {(glyph.lines ?? []).map((d, i) => (
          <Path key={`l${i}`} d={d} fill="none" stroke={tint} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {(glyph.dots ?? []).map(([cx, cy, r], i) => (
          <Circle key={`d${i}`} cx={cx} cy={cy} r={r} fill={tint} />
        ))}
      </Svg>
    </View>
  );
}

/** Memoised: an SVG tree only re-renders when its own props change. */
export const IconGlyph = memo(IconGlyphImpl, sameRenderProps);
