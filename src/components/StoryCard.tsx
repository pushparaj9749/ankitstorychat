/**
 * KISSA v2.5.2 — Story Cards
 * Artwork-first, natural aspect ratio, editorial, minimal.
 *
 * Layout rule (unchanged): IMAGE RATIO = SOURCE IMAGE RATIO. Covers ship as
 * 16:9, 3:2, 4:3, 3:4, 2:3 and 9:16, so no cover is ever cropped or stretched.
 *
 * What changed in this pass:
 *  - Cards live in a fixed-height art frame and the artwork is contain-fitted
 *    inside it (letterbox space is filled with the story's own accent tint).
 *    Result: a mixed-ratio rail finally has one baseline and one rhythm.
 *  - Titles sit on the artwork (overlay + scrim), so a card reads as a poster
 *    instead of a picture with a separate text box underneath.
 *  - Type, spacing, radius and colour all come from the design tokens.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StoryMeta } from '../types';
import { useApp } from '../state/AppContext';
import { effectiveContentApiBaseUrl, getBundledCoverSource } from '../content/loader';
import { makePlayerTextFn } from '../lib/playerName';
import { RADIUS, SCALE, SHADOWS, SPACING, TOUCH, TYPE, withAlpha } from '../theme';
import { AgeBadge, GenreChip, ProgressBar } from './bits';
import { CoverImage } from './CoverImage';
import { Icon, ICON_SIZE } from './icons';

/* Fixed art frames — heights, never ratios (artwork keeps its own shape). */
const FRAME = { hero: 372, rail: 208, continue: 66, wide: 156 } as const;

function useCover(meta: StoryMeta) {
  const { settings } = useApp();
  return getBundledCoverSource(meta, effectiveContentApiBaseUrl(settings?.contentApiBaseUrl));
}

/**
 * The art frame: a fixed-height stage with the story's accent tint behind the
 * untouched artwork. `maxHeight` bounds tall covers — they letterbox, never crop.
 */
function ArtFrame({
  meta,
  height,
  minHeight,
  maxHeight,
  radius = 0,
  borderless = false,
  style,
  children,
}: {
  meta: StoryMeta;
  /** Fixed frame height (rails: one baseline for every ratio). */
  height?: number;
  /** Bounded frame (hero): grows with the artwork up to `maxHeight`. */
  minHeight?: number;
  maxHeight?: number;
  radius?: number;
  borderless?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const source = useCover(meta);
  const artBound = height ?? maxHeight ?? minHeight ?? FRAME.rail;
  return (
    <View
      style={[
        styles.frame,
        {
          height,
          minHeight,
          borderRadius: radius,
          backgroundColor: withAlpha(meta.accentColor, 0.10),
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[withAlpha(meta.accentColor, 0.26), withAlpha(meta.accentColor, 0.02)]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <CoverImage
        source={source}
        accentColor={meta.accentColor}
        fallbackLetter={meta.title}
        style={styles.frameArt}
        maxHeight={artBound}
        placeholderMinHeight={Math.round(artBound * 0.62)}
      />
      {!borderless && radius > 0 ? (
        <View
          style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1, borderColor: 'rgba(242,240,235,0.08)' }]}
          pointerEvents="none"
        />
      ) : null}
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
          borderRadius: size / 2.6,
          backgroundColor: 'rgba(6,6,10,0.52)',
          borderColor: 'rgba(242,240,235,0.14)',
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon name={isFav ? 'heart' : 'heart-outline'} size={size >= TOUCH.sm ? 17 : 15} color={isFav ? theme.accent : '#F2F0EB'} />
    </Pressable>
  );
}

/* ---------------------------------------------------------------- Hero card */
export function HeroCard({ meta, onPress }: { meta: StoryMeta; onPress: () => void }) {
  const { theme, profile } = useApp();
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}. ${forPlayer(meta.tagline)}`}
      style={({ pressed }) => [
        styles.heroCard,
        { borderColor: theme.border, opacity: pressed ? 0.97 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
        SHADOWS.hero,
      ]}
    >
      <ArtFrame meta={meta} minHeight={340} maxHeight={FRAME.hero}>
        <LinearGradient
          colors={['rgba(6,6,10,0.30)', 'transparent', 'rgba(6,6,10,0.72)', 'rgba(6,6,10,0.97)']}
          locations={[0, 0.24, 0.62, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.heroTop}>
          <View style={[styles.featuredPill]}>
            <LinearGradient
              colors={['#FF6B7E', '#E9435E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.featuredText}>TONIGHT'S LEAD</Text>
          </View>
          <View style={styles.heroTopRight}>
            <AgeBadge ageRating={meta.ageRating} />
            <FavoriteButton storyId={meta.id} />
          </View>
        </View>

        <View style={styles.heroBody}>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {meta.title}
          </Text>
          <Text style={styles.heroTagline} numberOfLines={2}>
            {forPlayer(meta.tagline)}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{meta.genres[0] ?? 'Story'}</Text>
            </View>
            {meta.estimatedMinutes ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{meta.estimatedMinutes} min</Text>
              </View>
            ) : null}
            {meta.characters && meta.characters.length > 0 ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {meta.characters.length} {meta.characters.length === 1 ? 'character' : 'characters'}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.heroCta}>
            <LinearGradient
              colors={['#FF6B7E', '#E9435E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Icon name="play" size={ICON_SIZE.sm} color="#fff" />
            <Text style={styles.heroCtaText}>Start chat</Text>
            <Icon name="chevron-forward" size={ICON_SIZE.sm} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
      </ArtFrame>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- Rail card */
export function GridCard({ meta, onPress }: { meta: StoryMeta; onPress: () => void }) {
  const { theme } = useApp();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={meta.title}
      style={({ pressed }) => [
        styles.railCard,
        { borderColor: theme.border, opacity: pressed ? 0.94 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        SHADOWS.card,
      ]}
    >
      <ArtFrame meta={meta} height={FRAME.rail}>
        <LinearGradient
          colors={['rgba(6,6,10,0.34)', 'transparent', 'rgba(6,6,10,0.55)', 'rgba(6,6,10,0.95)']}
          locations={[0, 0.3, 0.68, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.railTop}>
          <View style={styles.railBadge}>
            <Text style={styles.railBadgeText}>{meta.ageRating}</Text>
          </View>
          <FavoriteButton storyId={meta.id} size={30} />
        </View>
        <View style={styles.railBody}>
          <Text style={styles.railTitle} numberOfLines={2}>
            {meta.title}
          </Text>
          <View style={styles.railGenres}>
            <View style={[styles.genreDot, { backgroundColor: meta.accentColor }]} />
            <Text style={styles.railGenre} numberOfLines={1}>
              {(meta.genres[0] ?? 'Story').toUpperCase()}
            </Text>
          </View>
        </View>
      </ArtFrame>
    </Pressable>
  );
}

/* ------------------------------------------------------------ Continue card */
export function ContinueCard({
  meta,
  progress,
  subtitle,
  onPress,
}: {
  meta: StoryMeta;
  progress: number;
  subtitle?: string;
  onPress: () => void;
}) {
  const { theme } = useApp();
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Continue ${meta.title}`}
      style={({ pressed }) => [
        styles.continueCard,
        { borderColor: theme.border, opacity: pressed ? 0.94 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
        SHADOWS.card,
      ]}
    >
      <View style={[styles.continueThumb, { backgroundColor: withAlpha(meta.accentColor, 0.12) }]}>
        <ArtFrame meta={meta} height={FRAME.continue} borderless style={styles.continueArt} />
      </View>

      <View style={styles.continueBody}>
        <Text style={[styles.continueTitle, { color: theme.text }]} numberOfLines={1}>
          {meta.title}
        </Text>
        {subtitle ? (
          <Text style={[styles.continueSub, { color: theme.textFaint }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.continueProgressRow}>
          <View style={styles.continueProgress}>
            <ProgressBar value={progress} color={meta.accentColor} />
          </View>
          <Text style={[styles.continuePct, { color: theme.accent }]}>{pct}%</Text>
        </View>
      </View>

      <View style={[styles.continueArrow, { borderColor: theme.border, backgroundColor: withAlpha(theme.surface2, 0.9) }]}>
        <Icon name="chevron-forward" size={ICON_SIZE.sm} color={theme.textDim} />
      </View>
    </Pressable>
  );
}

/* --------------------------------------------------------------- Wide card */
export function WideCard({ meta, onPress }: { meta: StoryMeta; onPress: () => void }) {
  const { theme, profile } = useApp();
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={meta.title}
      style={({ pressed }) => [
        styles.wideCard,
        { borderColor: theme.border, opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
        SHADOWS.card,
      ]}
    >
      <ArtFrame meta={meta} height={FRAME.wide} style={styles.wideArt} />
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

/* FeaturedStory alias */
export const FeaturedStory = HeroCard;

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameArt: { width: '100%' },
  favBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  heroCard: { borderRadius: RADIUS.xl, borderWidth: 1, overflow: 'hidden' },
  heroTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  featuredPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  featuredText: { fontSize: SCALE.micro, fontWeight: '900', letterSpacing: 1.1, color: '#fff' },
  heroTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroBody: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  heroTitle: { ...TYPE.heroTitle, color: '#fff' },
  heroTagline: { fontSize: SCALE.small, lineHeight: 19, color: 'rgba(242,240,235,0.78)', marginTop: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 },
  metaChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,251,245,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(242,240,235,0.12)',
  },
  metaChipText: { fontSize: SCALE.micro, fontWeight: '700', color: '#E7E3DC' },
  heroCta: {
    marginTop: 14,
    height: 46,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroCtaText: { fontSize: 14.5, fontWeight: '800', letterSpacing: 0.2, color: '#fff' },

  railCard: { width: 156, borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden' },
  railTop: {
    position: 'absolute',
    top: 9,
    left: 9,
    right: 9,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  railBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(6,6,10,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(242,240,235,0.14)',
  },
  railBadgeText: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 0.4, color: '#EFEDE8' },
  railBody: { position: 'absolute', left: 11, right: 11, bottom: 10 },
  railTitle: { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.25, lineHeight: 18, color: '#fff' },
  railGenres: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  genreDot: { width: 5, height: 5, borderRadius: 2.5 },
  railGenre: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 0.6, color: 'rgba(242,240,235,0.66)' },

  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    backgroundColor: 'rgba(20,20,29,0.86)',
  },
  continueThumb: { width: 48, height: FRAME.continue, borderRadius: RADIUS.sm, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  continueArt: { width: '100%' },
  continueBody: { flex: 1, minWidth: 0 },
  continueTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  continueSub: { fontSize: SCALE.caption, fontWeight: '600', marginTop: 3 },
  continueProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  continueProgress: { flex: 1 },
  continuePct: { fontSize: SCALE.micro, fontWeight: '800', marginTop: 8 },
  continueArrow: {
    width: TOUCH.sm,
    height: TOUCH.sm,
    borderRadius: TOUCH.sm / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  wideCard: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden', flexDirection: 'row' },
  wideArt: { width: 116 },
  wideBody: { flex: 1, padding: SPACING.md, gap: 7, justifyContent: 'center' },
  wideTop: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  wideTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.25, lineHeight: 21 },
  wideDesc: { fontSize: SCALE.caption, lineHeight: 17 },
});
