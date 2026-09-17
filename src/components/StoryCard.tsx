/** Story cards: hero (featured), wide (continue), grid (browse). */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StoryMeta } from '../types';
import { useApp } from '../state/AppContext';
import { effectiveContentApiBaseUrl, getBundledCoverSource } from '../content/loader';
import { makePlayerTextFn } from '../lib/playerName';
import { FONTS, RADIUS, SPACING } from '../theme';
import { AgeBadge, GenreChip, ProgressBar } from './bits';
import { SHADOWS, TYPE } from '../theme';
import { CoverImage } from './CoverImage';

/**
 * Story cover at the artwork's OWN aspect ratio (no fixed shape, no cropping).
 * `fallbackMinHeight` only sizes the letter placeholder when a story has no
 * artwork at all — it never applies to rendered covers.
 */
function Cover({
  meta,
  style,
  fallbackMinHeight,
}: {
  meta: StoryMeta;
  style?: object;
  fallbackMinHeight?: number;
}) {
  const { settings } = useApp();
  const src = getBundledCoverSource(meta, effectiveContentApiBaseUrl(settings?.contentApiBaseUrl));
  return (
    <CoverImage
      source={src}
      accentColor={meta.accentColor}
      fallbackLetter={meta.title}
      style={style}
      placeholderMinHeight={fallbackMinHeight}
    />
  );
}

export function HeroCard({
  meta,
  onPress,
}: {
  meta: StoryMeta;
  onPress: () => void;
}) {
  const { theme, profile } = useApp();
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}. ${forPlayer(meta.tagline)}`}
      style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Cover meta={meta} style={styles.heroCover} fallbackMinHeight={200} />
      <LinearGradient
        colors={['transparent', 'rgba(5,2,15,0.92)']}
        style={styles.heroShade}
      />
      <View style={styles.heroBody}>
        <View style={styles.heroTop}>
          <GenreChip genre={meta.genres[0] ?? 'Story'} />
          <AgeBadge ageRating={meta.ageRating} />
        </View>
        <Text style={styles.heroTitle}>{meta.title}</Text>
        <Text style={styles.heroTag} numberOfLines={2}>
          {meta.tagline}
        </Text>
      </View>
      {meta.isNew ? (
        <View style={[styles.newBadge, { backgroundColor: theme.accent }]}>
          <Text style={styles.newText}>NEW</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ContinueCard({
  meta,
  progress,
  subtitle,
  onPress,
}: {
  meta: StoryMeta;
  progress: number;
  subtitle: string;
  onPress: () => void;
}) {
  const { theme, profile } = useApp();
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Continue ${meta.title}`}
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Cover meta={meta} style={styles.thumb} fallbackMinHeight={64} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          {meta.title}
        </Text>
        <Text style={[styles.rowSub, { color: theme.textDim }]} numberOfLines={1}>
          {forPlayer(subtitle)}
        </Text>
        <ProgressBar value={progress} color={meta.accentColor} />
      </View>
    </Pressable>
  );
}

export function GridCard({ meta, onPress }: { meta: StoryMeta; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={meta.title}
      style={[styles.grid, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Cover meta={meta} style={styles.gridCover} fallbackMinHeight={122} />
      <View style={styles.gridBody}>
        <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={1}>
          {meta.title}
        </Text>
        <Text style={[styles.gridSub, { color: theme.textDim }]} numberOfLines={1}>
          {meta.genres.slice(0, 2).join(' • ')}
        </Text>
        <View style={styles.gridMeta}>
          <AgeBadge ageRating={meta.ageRating} />
        </View>
      </View>
    </Pressable>
  );
}

export function WideCard({ meta, onPress }: { meta: StoryMeta; onPress: () => void }) {
  const { theme, profile } = useApp();
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={meta.title}
      style={[styles.wide, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Cover meta={meta} style={styles.wideCover} fallbackMinHeight={140} />
      <View style={styles.wideBody}>
        <Text style={[styles.wideTitle, { color: theme.text }]} numberOfLines={1}>
          {meta.title}
        </Text>
        <Text style={[styles.wideDesc, { color: theme.textDim }]} numberOfLines={2}>
          {forPlayer(meta.description)}
        </Text>
        <View style={styles.wideMeta}>
          <GenreChip genre={meta.genres[0] ?? 'Story'} />
          <AgeBadge ageRating={meta.ageRating} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The hero card adapts to the featured cover's own aspect ratio: the cover
  // is an in-flow child (width 100%, natural height) and the gradient + text
  // overlay its bottom edge. No fixed card height, no cropping, no stretching.
  hero: { borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 1, ...SHADOWS.hero },
  heroCover: { width: '100%' },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  heroBody: { position: 'absolute', left: SPACING.lg, right: SPACING.lg, bottom: SPACING.lg },
  heroTop: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: TYPE.display.fontSize, fontWeight: '900', letterSpacing: TYPE.display.letterSpacing },
  heroTag: { color: '#E4DDFB', fontSize: FONTS.small, marginTop: 5, letterSpacing: 0.1 },
  newBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  newText: { color: '#1A0B2E', fontSize: FONTS.tiny, fontWeight: '900' },
  row: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 10,
    gap: 12,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  // Continue-row thumbnail: fixed width, height follows the cover's own ratio.
  thumb: { width: 64, borderRadius: RADIUS.md },
  rowBody: { flex: 1, gap: 6 },
  rowTitle: { fontSize: FONTS.body, fontWeight: '800', letterSpacing: -0.2 },
  rowSub: { fontSize: FONTS.small },
  grid: { width: 158, borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden', ...SHADOWS.card },
  gridCover: { width: 158 },
  gridBody: { padding: 10, gap: 4 },
  gridTitle: { fontSize: FONTS.body, fontWeight: '800', letterSpacing: -0.2 },
  gridSub: { fontSize: FONTS.tiny },
  gridMeta: { marginTop: 4 },
  wide: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden', ...SHADOWS.card },
  wideCover: { width: '100%' },
  wideBody: { padding: 12, gap: 8 },
  wideTitle: { fontSize: FONTS.heading, fontWeight: '800', letterSpacing: -0.2 },
  wideDesc: { fontSize: FONTS.small },
  wideMeta: { flexDirection: 'row', gap: 8 },
});
