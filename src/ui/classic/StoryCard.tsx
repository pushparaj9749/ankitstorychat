/* KISSA classic template ("Kissa Night", pre-v2.7 UI) — kept so users can switch back in Settings → Appearance. */
/**
 * KISSA v2.6 — Story cards ("Kissa Night").
 *
 * Every card is a poster: artwork fills the whole card, text sits on the art.
 *
 * Artwork rule (unchanged): IMAGE RATIO = SOURCE IMAGE RATIO. Covers ship as
 * 16:9, 3:2, 4:3, 3:4, 2:3 and 9:16 and are never cropped or stretched. What
 * is new: the frame around a contain-fitted cover is filled by ArtBackdrop —
 * a blurred ambient wash of the same art — so there are no empty bands above,
 * below or beside a cover any more.
 */
import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StoryMeta } from '../../types';
import { useApp } from '../../state/AppContext';
import { effectiveContentApiBaseUrl, getBundledCoverSource } from '../../content/loader';
import { makePlayerTextFn } from '../../lib/playerName';
import { sameRenderProps } from '../../lib/memoProps';
import { GRADIENTS, RADIUS, SCALE, SHADOWS, SPACING, TOUCH, genreColor, withAlpha } from './theme';
import { AgeBadge, GenreChip } from '../../components/bits';
import { CoverImage } from '../../components/CoverImage';
import { ArtBackdrop } from '../../components/ArtBackdrop';
import { Icon, ICON_SIZE } from '../../components/icons';

/* Fixed art frames — heights, never ratios (artwork keeps its own shape). */
export const FRAME = { hero: 468, poster: 226, grid: 252, rank: 176, continue: 92, wide: 138 } as const;

const ON_ART = '#FFFFFF';
const ON_ART_DIM = 'rgba(247,243,255,0.78)';

function useCover(meta: StoryMeta) {
  const { settings } = useApp();
  const base = effectiveContentApiBaseUrl(settings?.contentApiBaseUrl);
  // Stable source object: a fresh `{ uri }` each render made native Image
  // views treat the cover as a new source and re-request it.
  return useMemo(() => getBundledCoverSource(meta, base), [meta, base]);
}

/**
 * The art stage: a fixed-height frame. The untouched artwork is contain-fitted
 * in the middle; ArtBackdrop fills the rest with the art's own blurred colours.
 */
function StoryArtImpl({
  meta,
  height,
  radius = 0,
  style,
  children,
}: {
  meta: StoryMeta;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const source = useCover(meta);
  return (
    <View
      style={[
        styles.frame,
        { height, borderRadius: radius, backgroundColor: withAlpha(meta.accentColor, 0.16) },
        style,
      ]}
    >
      <ArtBackdrop source={source} accentColor={meta.accentColor} />
      <CoverImage
        source={source}
        accentColor={meta.accentColor}
        fallbackLetter={meta.title}
        style={styles.frameArt}
        maxHeight={height}
        placeholderMinHeight={Math.round(height * 0.62)}
        tint="transparent"
      />
      {children}
    </View>
  );
}

function FavoriteButton({ storyId, size = TOUCH.sm }: { storyId: string; size?: number }) {
  const { theme, favoriteIds, toggleFavorite } = useApp();
  const isFav = favoriteIds?.has(storyId);
  return (
    <Pressable
      onPress={() => void toggleFavorite(storyId)}
      accessibilityRole="button"
      accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
      hitSlop={8}
      style={({ pressed }) => [
        styles.favBtn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isFav ? withAlpha(theme.primary, 0.28) : 'rgba(11,8,20,0.46)',
          borderColor: isFav ? withAlpha(theme.primary, 0.6) : 'rgba(255,255,255,0.18)',
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        },
      ]}
    >
      <Icon name={isFav ? 'heart' : 'heart-outline'} size={Math.round(size * 0.5)} color={isFav ? theme.accent : ON_ART} />
    </Pressable>
  );
}

function GlassTag({ label, icon, color }: { label: string; icon?: React.ReactNode; color?: string }) {
  return (
    <View style={styles.glassTag}>
      {icon}
      <Text style={[styles.glassTagText, color ? { color } : null]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* --------------------------------------------------------------- Hero slide */
function HeroCardImpl({
  meta,
  onPress,
  height = FRAME.hero,
  kicker = "TONIGHT'S LEAD",
  width,
}: {
  meta: StoryMeta;
  onPress: () => void;
  height?: number;
  kicker?: string;
  width?: DimensionValue;
}) {
  const { theme, profile } = useApp();
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);
  const facts = [
    meta.genres[0] ?? 'Story',
    meta.characters?.length ? `${meta.characters.length} ${meta.characters.length === 1 ? 'character' : 'characters'}` : null,
  ].filter(Boolean) as string[];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}. ${forPlayer(meta.tagline)}`}
      style={({ pressed }) => [
        styles.heroCard,
        { width, transform: [{ scale: pressed ? 0.988 : 1 }] },
        SHADOWS.hero,
      ]}
    >
      <StoryArt meta={meta} height={height} radius={RADIUS.xxl}>
        <LinearGradient
          colors={['rgba(11,8,20,0.55)', 'transparent']}
          locations={[0, 1]}
          style={styles.heroTopShade}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(11,8,20,0.62)', 'rgba(11,8,20,0.97)']}
          locations={[0, 0.45, 1]}
          style={styles.heroBottomShade}
          pointerEvents="none"
        />

        <View style={styles.heroTop}>
          <GlassTag label={kicker} icon={<Icon name="sparkles" size={13} color={theme.gold} />} />
          <GlassTag
            label={meta.ageRating}
            icon={<View style={[styles.genreDot, { backgroundColor: meta.ageRating === '18+' ? theme.danger : theme.success }]} />}
          />
        </View>

        <View style={styles.heroBody}>
          <Text style={[styles.heroFacts, { color: theme.gold }]} numberOfLines={1}>
            {facts.join('  ·  ').toUpperCase()}
          </Text>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {meta.title}
          </Text>
          <Text style={styles.heroTagline} numberOfLines={2}>
            {forPlayer(meta.tagline)}
          </Text>

          <View style={styles.heroActions}>
            <View style={[styles.heroCta, SHADOWS.glowAccent]}>
              <LinearGradient colors={[...GRADIENTS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Icon name="play" size={ICON_SIZE.sm} color={ON_ART} />
              <Text style={styles.heroCtaText}>Start chat</Text>
            </View>
            <FavoriteButton storyId={meta.id} size={50} />
          </View>
        </View>
      </StoryArt>
    </Pressable>
  );
}

/* ------------------------------------------------------------- Poster card */
function GridCardImpl({
  meta,
  onPress,
  width = 150,
  height = FRAME.poster,
}: {
  meta: StoryMeta;
  onPress: () => void;
  width?: DimensionValue;
  height?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={meta.title}
      style={({ pressed }) => [styles.poster, { width, transform: [{ scale: pressed ? 0.975 : 1 }] }, SHADOWS.card]}
    >
      <StoryArt meta={meta} height={height} radius={RADIUS.lg + 2}>
        <LinearGradient
          colors={['transparent', 'rgba(11,8,20,0.6)', 'rgba(11,8,20,0.96)']}
          locations={[0.4, 0.7, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.posterTop}>
          <GlassTag label={meta.ageRating} />
          <FavoriteButton storyId={meta.id} size={30} />
        </View>
        <View style={styles.posterBody}>
          <Text style={styles.posterTitle} numberOfLines={2}>
            {meta.title}
          </Text>
          <View style={styles.posterGenreRow}>
            <View style={[styles.genreDot, { backgroundColor: genreColor(meta.genres[0] ?? '') }]} />
            <Text style={styles.posterGenre} numberOfLines={1}>
              {meta.genres.slice(0, 2).join(' · ') || 'Story'}
            </Text>
          </View>
        </View>
        <View style={styles.posterStroke} pointerEvents="none" />
      </StoryArt>
    </Pressable>
  );
}

/* ---------------------------------------------------------- Top-10 rank card */
function RankCardImpl({ meta, rank, onPress }: { meta: StoryMeta; rank: number; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Number ${rank}: ${meta.title}`}
      style={({ pressed }) => [styles.rankCard, { transform: [{ scale: pressed ? 0.975 : 1 }] }]}
    >
      <Text
        style={[
          styles.rankNum,
          { color: theme.gold, textShadowColor: 'rgba(0,0,0,0.55)' },
          rank >= 10 ? styles.rankNumWide : null,
        ]}
      >
        {rank}
      </Text>
      <View style={[styles.rankPoster, SHADOWS.card]}>
        <StoryArt meta={meta} height={FRAME.rank} radius={RADIUS.lg}>
          <LinearGradient
            colors={['transparent', 'rgba(11,8,20,0.92)']}
            locations={[0.55, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Text style={styles.rankTitle} numberOfLines={2}>
            {meta.title}
          </Text>
          <View style={styles.posterStroke} pointerEvents="none" />
        </StoryArt>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------ Continue card */
function ContinueCardImpl({
  meta,
  progress,
  subtitle,
  onPress,
}: {
  meta: StoryMeta;
  /** Journey progress 0–1. `null` = not started (e.g. New arrivals): no bar, genre + rating instead. */
  progress: number | null;
  subtitle?: string;
  onPress: () => void;
}) {
  const { theme } = useApp();
  const started = progress !== null && progress !== undefined;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={started ? `Continue ${meta.title}` : meta.title}
      style={({ pressed }) => [
        styles.continueCard,
        {
          borderColor: theme.border,
          backgroundColor: withAlpha(theme.surface2, 0.78),
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <LinearGradient
        colors={[withAlpha(meta.accentColor, 0.2), 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <StoryArt meta={meta} height={FRAME.continue} radius={RADIUS.md} style={styles.continueArt} />

      <View style={styles.continueBody}>
        <Text style={[styles.continueTitle, { color: theme.text }]} numberOfLines={1}>
          {meta.title}
        </Text>
        {subtitle ? (
          <Text style={[styles.continueSub, { color: theme.textFaint }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.continueTags}>
          <GenreChip genre={meta.genres[0] ?? 'Story'} />
          <AgeBadge ageRating={meta.ageRating} />
        </View>
      </View>

      <View style={[styles.playDisc, SHADOWS.glowAccent]}>
        <LinearGradient colors={[...GRADIENTS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Icon name={started ? 'play' : 'chevron-forward'} size={started ? 15 : 16} color={ON_ART} />
      </View>
    </Pressable>
  );
}

/* --------------------------------------------------------------- Wide card */
function WideCardImpl({ meta, onPress }: { meta: StoryMeta; onPress: () => void }) {
  const { theme, profile } = useApp();
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={meta.title}
      style={({ pressed }) => [
        styles.wideCard,
        { borderColor: theme.border, backgroundColor: withAlpha(theme.surface2, 0.7), transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      <StoryArt meta={meta} height={FRAME.wide} radius={RADIUS.md} style={styles.wideArt} />
      <View style={styles.wideBody}>
        <View style={styles.wideTop}>
          <GenreChip genre={meta.genres[0] ?? 'Story'} />
          <AgeBadge ageRating={meta.ageRating} />
        </View>
        <Text style={[styles.wideTitle, { color: theme.text }]} numberOfLines={2}>
          {meta.title}
        </Text>
        <Text style={[styles.wideDesc, { color: theme.textDim }]} numberOfLines={2}>
          {forPlayer(meta.tagline || meta.description)}
        </Text>
      </View>
    </Pressable>
  );
}

/* --------------------------------------------------------------- Poster grid */
/** Two-column poster wall — every slot filled, no ragged gaps. */
function PosterGridImpl({
  stories,
  onOpen,
  columns = 2,
  height = FRAME.grid,
}: {
  stories: StoryMeta[];
  onOpen: (id: string) => void;
  columns?: number;
  height?: number;
}) {
  const rows: StoryMeta[][] = [];
  for (let i = 0; i < stories.length; i += columns) rows.push(stories.slice(i, i + columns));
  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.gridRow}>
          {row.map((s) => (
            <View key={s.id} style={styles.gridCell}>
              <GridCard meta={s} width="100%" height={height} onPress={() => onOpen(s.id)} />
            </View>
          ))}
          {Array.from({ length: columns - row.length }).map((_, i) => (
            <View key={`pad${i}`} style={styles.gridCell} />
          ))}
        </View>
      ))}
    </View>
  );
}

/* FeaturedStory alias */
/* Memoised: screens re-render often (carousel page, filters); cards only when their data changes. */
export const StoryArt = memo(StoryArtImpl, sameRenderProps);
export const HeroCard = memo(HeroCardImpl, sameRenderProps);
export const GridCard = memo(GridCardImpl, sameRenderProps);
export const RankCard = memo(RankCardImpl, sameRenderProps);
export const ContinueCard = memo(ContinueCardImpl, sameRenderProps);
export const WideCard = memo(WideCardImpl, sameRenderProps);
export const PosterGrid = memo(PosterGridImpl, sameRenderProps);

export const FeaturedStory = HeroCard;

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameArt: { width: '100%' },
  favBtn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  glassTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(11,8,20,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignSelf: 'flex-start',
  },
  glassTagText: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 0.7, color: ON_ART },

  heroCard: { borderRadius: RADIUS.xxl, overflow: 'hidden' },
  heroTopShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 110 },
  heroBottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  heroTop: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroBody: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  heroFacts: { fontSize: SCALE.micro, fontWeight: '900', letterSpacing: 1.3 },
  heroTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -0.8, lineHeight: 34, color: ON_ART, marginTop: 8 },
  heroTagline: { fontSize: SCALE.small, lineHeight: 19, color: ON_ART_DIM, marginTop: 7 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  heroCta: {
    flex: 1,
    height: 50,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  heroCtaText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.2, color: ON_ART },

  poster: { borderRadius: RADIUS.lg + 2, overflow: 'hidden' },
  posterTop: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  posterBody: { position: 'absolute', left: 11, right: 11, bottom: 11 },
  posterTitle: { fontSize: 15, fontWeight: '900', letterSpacing: -0.3, lineHeight: 19, color: ON_ART },
  posterGenreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  genreDot: { width: 6, height: 6, borderRadius: 3 },
  posterGenre: { fontSize: SCALE.micro, fontWeight: '700', letterSpacing: 0.3, color: ON_ART_DIM, flexShrink: 1 },
  posterStroke: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: RADIUS.lg + 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },

  rankCard: { flexDirection: 'row', alignItems: 'flex-end', height: FRAME.rank + 6 },
  rankNum: {
    fontSize: 112,
    lineHeight: 112,
    fontWeight: '900',
    letterSpacing: -6,
    marginRight: -26,
    marginBottom: -12,
    textShadowOffset: { width: 4, height: 0 },
    textShadowRadius: 12,
    zIndex: 0,
  },
  rankNumWide: { letterSpacing: -12, fontSize: 100 },
  rankPoster: { width: 120, borderRadius: RADIUS.lg, overflow: 'hidden', zIndex: 1 },
  rankTitle: {
    position: 'absolute',
    left: 9,
    right: 9,
    bottom: 9,
    fontSize: SCALE.small,
    fontWeight: '900',
    lineHeight: 16,
    color: ON_ART,
  },

  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 9,
    paddingRight: 13,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  continueArt: { width: 72 },
  continueBody: { flex: 1, minWidth: 0 },
  continueTitle: { fontSize: 15.5, fontWeight: '900', letterSpacing: -0.25 },
  continueSub: { fontSize: SCALE.caption, fontWeight: '600', marginTop: 4 },
  continueProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  continueProgress: { flex: 1 },
  continuePct: { fontSize: SCALE.micro, fontWeight: '900', marginTop: 8 },
  continueTags: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
  playDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  wideCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    padding: 9,
    gap: 13,
  },
  wideArt: { width: 104 },
  wideBody: { flex: 1, paddingVertical: 4, paddingRight: 4, gap: 7, justifyContent: 'center' },
  wideTop: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  wideTitle: { fontSize: 16.5, fontWeight: '900', letterSpacing: -0.3, lineHeight: 21 },
  wideDesc: { fontSize: SCALE.caption, lineHeight: 17 },
  wideMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  wideMetaText: { fontSize: SCALE.micro, fontWeight: '700' },

  grid: { gap: SPACING.md },
  gridRow: { flexDirection: 'row', gap: SPACING.md },
  gridCell: { flex: 1, minWidth: 0 },
});
