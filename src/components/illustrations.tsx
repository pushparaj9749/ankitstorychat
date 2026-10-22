/**
 * KISSA v2.10 — "Kissa Noir" spot illustrations (hand-drawn SVG).
 *
 * Small cinematic scenes for empty / error / offline / no-results states, so
 * those screens feel designed instead of showing a lone icon in a box. Same
 * restrained palette as the rest of Noir: graphite shapes, hairline strokes,
 * ONE rose accent and a touch of champagne — on a soft rose glow.
 *
 * No app-state dependency: colours come in as props (see EmptyState).
 */
import React, { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export type IllustrationName = 'shelf' | 'search' | 'stories' | 'saves' | 'offline' | 'error' | 'key';

export interface IllustrationColors {
  /** Rose accent. */
  accent: string;
  /** Champagne highlight. */
  gold: string;
  /** Graphite surface for objects. */
  surface: string;
  /** Lighter graphite for object faces. */
  surface2: string;
  /** Hairline stroke colour. */
  line: string;
}

const W = 168;
const H = 128;

/** Shared backdrop: a soft rose glow, a floor shadow and two tiny sparkles. */
function Stage({ c, children }: { c: IllustrationColors; children: React.ReactNode }) {
  return (
    <>
      <Defs>
        <RadialGradient id="kGlow" cx="50%" cy="48%" r="50%">
          <Stop offset="0" stopColor={c.accent} stopOpacity={0.22} />
          <Stop offset="0.6" stopColor={c.accent} stopOpacity={0.06} />
          <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="kFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.surface2} stopOpacity={1} />
          <Stop offset="1" stopColor={c.surface} stopOpacity={1} />
        </LinearGradient>
        <LinearGradient id="kRose" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c.accent} stopOpacity={1} />
          <Stop offset="1" stopColor={c.accent} stopOpacity={0.62} />
        </LinearGradient>
        <LinearGradient id="kGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c.gold} stopOpacity={1} />
          <Stop offset="1" stopColor={c.gold} stopOpacity={0.55} />
        </LinearGradient>
      </Defs>
      <Ellipse cx={84} cy={62} rx={78} ry={60} fill="url(#kGlow)" />
      <Ellipse cx={84} cy={112} rx={50} ry={5} fill="#000" opacity={0.35} />
      {children}
      <Sparkle x={24} y={30} s={5} color={c.gold} />
      <Sparkle x={146} y={22} s={4} color={c.accent} />
      <Circle cx={140} cy={92} r={1.6} fill={c.gold} opacity={0.7} />
      <Circle cx={30} cy={84} r={1.3} fill={c.accent} opacity={0.6} />
    </>
  );
}

function Sparkle({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <Path
      d={`M${x} ${y - s}L${x + s * 0.28} ${y - s * 0.28}L${x + s} ${y}L${x + s * 0.28} ${y + s * 0.28}L${x} ${y + s}L${x - s * 0.28} ${y + s * 0.28}L${x - s} ${y}L${x - s * 0.28} ${y - s * 0.28}Z`}
      fill={color}
      opacity={0.9}
    />
  );
}

/** Library: an empty wooden-less shelf with three books, one leaning, and a floating heart. */
function ShelfArt({ c }: { c: IllustrationColors }) {
  return (
    <Stage c={c}>
      <Rect x={34} y={100} width={100} height={6} rx={3} fill={c.surface2} stroke={c.line} strokeWidth={1} />
      <Rect x={50} y={52} width={16} height={48} rx={3} fill="url(#kFace)" stroke={c.line} strokeWidth={1} />
      <Path d="M54 60h8M54 92h8" stroke={c.line} strokeWidth={1.2} strokeLinecap="round" />
      <Rect x={68} y={44} width={18} height={56} rx={3} fill="url(#kRose)" />
      <Path d="M72 54h10M72 90h10" stroke="#fff" strokeOpacity={0.45} strokeWidth={1.2} strokeLinecap="round" />
      <G transform="rotate(14 104 100)">
        <Rect x={92} y={56} width={15} height={44} rx={3} fill="url(#kFace)" stroke={c.line} strokeWidth={1} />
        <Path d="M96 64h7" stroke={c.gold} strokeOpacity={0.8} strokeWidth={1.4} strokeLinecap="round" />
      </G>
      <Path
        d="M118 30c-2.4-3.6-8-2.4-8 1.8 0 3.8 8 8.2 8 8.2s8-4.4 8-8.2c0-4.2-5.6-5.4-8-1.8z"
        fill="url(#kRose)"
      />
      <Path d="M108 46c3 3 6 4 10 4" stroke={c.accent} strokeOpacity={0.5} strokeWidth={1.2} strokeDasharray="2 3" strokeLinecap="round" />
    </Stage>
  );
}

/** No results: a magnifier hovering over an open book. */
function SearchArt({ c }: { c: IllustrationColors }) {
  return (
    <Stage c={c}>
      <Path d="M40 96c14-7 28-7 42 0V58c-14-7-28-7-42 0z" fill="url(#kFace)" stroke={c.line} strokeWidth={1} />
      <Path d="M128 96c-14-7-28-7-46 0V58c18-7 32-7 46 0z" fill="url(#kFace)" stroke={c.line} strokeWidth={1} />
      <Path d="M48 66c8-3 16-3 26 0M48 74c8-3 16-3 26 0M48 82c8-3 16-3 22 0" stroke={c.line} strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M90 66c9-3 18-3 30 0M90 74c9-3 18-3 30 0" stroke={c.line} strokeWidth={1.3} strokeLinecap="round" />
      <Circle cx={104} cy={50} r={17} fill={c.surface} fillOpacity={0.55} stroke="url(#kRose)" strokeWidth={4} />
      <Path d="M96 44a10 10 0 0 1 9-6" stroke="#fff" strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" />
      <Path d="M116 63l12 12" stroke="url(#kRose)" strokeWidth={6} strokeLinecap="round" />
    </Stage>
  );
}

/** No stories yet: a film clapperboard with a play mark. */
function StoriesArt({ c }: { c: IllustrationColors }) {
  return (
    <Stage c={c}>
      <Rect x={46} y={56} width={76} height={50} rx={6} fill="url(#kFace)" stroke={c.line} strokeWidth={1} />
      <G transform="rotate(-12 46 56)">
        <Rect x={46} y={40} width={76} height={14} rx={3} fill={c.surface2} stroke={c.line} strokeWidth={1} />
        <Path d="M56 40l-6 14M72 40l-6 14M88 40l-6 14M104 40l-6 14M120 40l-6 14" stroke={c.gold} strokeOpacity={0.75} strokeWidth={3} />
      </G>
      <Circle cx={84} cy={81} r={14} fill="url(#kRose)" />
      <Path d="M80 74.5v13l10-6.5z" fill="#fff" />
    </Stage>
  );
}

/** Saves: two stacked story cards with a bookmark ribbon. */
function SavesArt({ c }: { c: IllustrationColors }) {
  return (
    <Stage c={c}>
      <G transform="rotate(-8 84 76)">
        <Rect x={50} y={40} width={58} height={70} rx={8} fill={c.surface} stroke={c.line} strokeWidth={1} />
      </G>
      <Rect x={62} y={36} width={58} height={72} rx={8} fill="url(#kFace)" stroke={c.line} strokeWidth={1} />
      <Path d="M70 86h34M70 94h24" stroke={c.line} strokeWidth={1.4} strokeLinecap="round" />
      <Rect x={70} y={46} width={42} height={30} rx={5} fill={c.accent} fillOpacity={0.14} />
      <Path d="M80 68l8-10 7 7 4-4 9 7" stroke={c.gold} strokeOpacity={0.8} strokeWidth={1.4} strokeLinejoin="round" fill="none" />
      <Path d="M106 30h12v26l-6-4.5-6 4.5z" fill="url(#kRose)" />
    </Stage>
  );
}

/** Offline: a cloud with a soft slash and fading signal arcs. */
function OfflineArt({ c }: { c: IllustrationColors }) {
  return (
    <Stage c={c}>
      <Path
        d="M58 98h56a18 18 0 0 0 2-36 24 24 0 0 0-46-4 17 17 0 0 0-12 40z"
        fill="url(#kFace)"
        stroke={c.line}
        strokeWidth={1}
      />
      <Path d="M70 70a20 20 0 0 1 28 0M76 78a11 11 0 0 1 16 0" stroke={c.line} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Circle cx={84} cy={86} r={2.6} fill={c.gold} />
      <Path d="M56 44l58 58" stroke="url(#kRose)" strokeWidth={4.5} strokeLinecap="round" />
    </Stage>
  );
}

/** Error: a torn film strip with a rose warning mark. */
function ErrorArt({ c }: { c: IllustrationColors }) {
  return (
    <Stage c={c}>
      <G transform="rotate(-10 70 76)">
        <Path d="M30 60h44l-5 8 6 8-6 8 5 8H30z" fill="url(#kFace)" stroke={c.line} strokeWidth={1} />
        <Path d="M36 64h4M46 64h4M56 64h4M36 88h4M46 88h4M56 88h4" stroke={c.line} strokeWidth={2.4} strokeLinecap="round" />
      </G>
      <G transform="rotate(12 104 76)">
        <Path d="M138 60H94l5 8-6 8 6 8-5 8h44z" fill="url(#kFace)" stroke={c.line} strokeWidth={1} />
        <Path d="M108 64h4M118 64h4M128 64h4M108 88h4M118 88h4M128 88h4" stroke={c.line} strokeWidth={2.4} strokeLinecap="round" />
      </G>
      <Circle cx={84} cy={50} r={15} fill="url(#kRose)" />
      <Path d="M84 42v9" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
      <Circle cx={84} cy={57} r={1.9} fill="#fff" />
    </Stage>
  );
}

/** AI key: a key resting against a glowing spark chip. */
function KeyArt({ c }: { c: IllustrationColors }) {
  return (
    <Stage c={c}>
      <Rect x={70} y={40} width={44} height={44} rx={12} fill="url(#kFace)" stroke={c.line} strokeWidth={1} />
      <Path d="M70 52h-6M70 62h-6M70 72h-6M114 52h6M114 62h6M114 72h6M82 40v-6M92 40v-6M102 40v-6M82 84v6M92 84v6M102 84v6" stroke={c.line} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M92 50l2.6 7.4 7.4 2.6-7.4 2.6L92 70l-2.6-7.4L82 60l7.4-2.6z" fill="url(#kGold)" />
      <G transform="rotate(-32 60 96)">
        <Circle cx={46} cy={96} r={10} fill="none" stroke="url(#kRose)" strokeWidth={5} />
        <Path d="M56 96h34M80 96v7M86 96v5" stroke="url(#kRose)" strokeWidth={5} strokeLinecap="round" />
      </G>
    </Stage>
  );
}

const ART: Record<IllustrationName, (p: { c: IllustrationColors }) => React.ReactElement> = {
  shelf: ShelfArt,
  search: SearchArt,
  stories: StoriesArt,
  saves: SavesArt,
  offline: OfflineArt,
  error: ErrorArt,
  key: KeyArt,
};

function IllustrationImpl({ name, colors, width = W }: { name: IllustrationName; colors: IllustrationColors; width?: number }) {
  const Art = ART[name] ?? StoriesArt;
  return (
    <Svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Art c={colors} />
    </Svg>
  );
}

export const Illustration = memo(IllustrationImpl);

/** Which illustration an EmptyState shows for a given icon, when none is set explicitly. */
export function illustrationForIcon(icon: string): IllustrationName {
  if (icon.startsWith('search')) return 'search';
  if (icon.startsWith('library')) return 'shelf';
  if (icon.startsWith('bookmark') || icon.startsWith('heart')) return 'saves';
  if (icon.startsWith('key')) return 'key';
  if (icon.startsWith('cloud')) return 'offline';
  if (icon.startsWith('alert')) return 'error';
  return 'stories';
}
