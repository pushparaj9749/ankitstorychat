/**
 * Story Cards — 100% Original Kissa Cinematic Visual Language.
 *
 * Requirements:
 *  - Artwork-first presentation preserving natural aspect ratio (NaturalImage/CoverImage)
 *  - No forced cropping (no resizeMode: cover)
 *  - No fixed dimension ratio constants outside NaturalImage
 *  - Atmospheric multi-stop scrim overlays for crystal-clear readability
 *  - Player-name interpolation in taglines & descriptions
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StoryMeta } from '../types';
import { useApp } from '../state/AppContext';
import { effectiveContentApiBaseUrl, getBundledCoverSource } from '../content/loader';
import { makePlayerTextFn } from '../lib/playerName';
import { FONTS, GRADIENTS, RADIUS, SHADOWS, TYPE, withAlpha } from '../theme';
import { AgeBadge, GenreChip, ProgressBar } from './bits';
import { CoverImage } from './CoverImage';

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

export function HeroCard({ meta, onPress }: { meta: StoryMeta; onPress: () => void }) {
  const { theme, profile } = useApp();
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}. ${forPlayer(meta.tagline)}`}
      style={({ pressed }) => [
        styles.hero,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        SHADOWS.hero,
      ]}
    >
      <Cover meta={meta} style={styles.heroCover} fallbackMinHeight={260} />
      {/* Multi-stop atmospheric scrim for effortless reading */}
      <LinearGradient
        colors={['transparent', 'rgba(9,8,12,0.22)', 'rgba(9,8,12,0.85)', 'rgba(9,8,12,0.98)']}
        locations={[0, 0.40, 0.72, 1]}
        style={styles.heroShade}
      />

      {/* Top badges */}
      <View style={styles.heroTop}>
        <GenreChip genre={meta.genres[0] ?? 'Story'} />
        <AgeBadge ageRating={meta.ageRating} />
      </View>

      {/* Featured / New Badge */}
      {meta.featured ? (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredText}>✦ FEATURED STORY</Text>
        </View>
      ) : meta.isNew ? (
        <View style={[styles.newBadge, { backgroundColor: theme.accent }]}>
          <Text style={styles.newText}>NEW</Text>
        </View>
      ) : null}

      {/* Hero content */}
      <View style={styles.heroBody}>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {meta.title}
        </Text>
        <Text style={styles.heroTag} numberOfLines={2}>
          {forPlayer(meta.tagline)}
        </Text>

        <View style={styles.heroFooter}>
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMeta}>{meta.genres.slice(0, 2).join(' • ')}</Text>
            {meta.estimatedMinutes ? (
              <>
                <Text style={styles.heroDot}>•</Text>
                <Text style={styles.heroMeta}>{meta.estimatedMinutes} min</Text>
              </>
            ) : null}
          </View>

          {/* Primary Call to Action Button */}
          <View style={styles.heroCtaWrap}>
            <LinearGradient
              colors={[...GRADIENTS.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroCta}
            >
              <Text style={styles.heroCtaIcon}>▶</Text>
              <Text style={styles.heroCtaText}>START CHAT</Text>
            </LinearGradient>
          </View>
        </View>
      </View>
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
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        SHADOWS.card,
      ]}
    >
      <View style={styles.thumbWrap}>
        <Cover meta={meta} style={styles.thumb} fallbackMinHeight={72} />
        <View style={[styles.thumbGlow, { backgroundColor: withAlpha(meta.accentColor, 0.22) }]} />
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTopLine}>
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
            {meta.title}
          </Text>
          <View style={styles.rowTag}>
            <Text style={[styles.rowTagText, { color: theme.accent }]}>{meta.genres[0] ?? 'Story'}</Text>
          </View>
        </View>
        <Text style={[styles.rowSub, { color: theme.textDim }]} numberOfLines={1}>
          {forPlayer(subtitle)}
        </Text>
        <ProgressBar value={progress} color={meta.accentColor} />
      </View>

      <View
        style={[
          styles.rowArrow,
          {
            backgroundColor: withAlpha(theme.primary, 0.14),
            borderColor: withAlpha(theme.primary, 0.24),
          },
        ]}
      >
        <Text style={[styles.rowArrowText, { color: theme.accent }]}>›</Text>
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
      style={({ pressed }) => [
        styles.grid,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.94 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        SHADOWS.card,
      ]}
    >
      <Cover meta={meta} style={styles.gridCover} fallbackMinHeight={130} />
      <LinearGradient
        colors={['transparent', 'rgba(9,8,12,0.85)']}
        style={styles.gridShade}
        pointerEvents="none"
      />
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
      style={({ pressed }) => [
        styles.wide,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        SHADOWS.card,
      ]}
    >
      <View style={styles.wideCoverWrap}>
        <Cover meta={meta} style={styles.wideCover} fallbackMinHeight={150} />
        <LinearGradient colors={['transparent', 'rgba(9,8,12,0.52)']} style={styles.wideShade} />
        <View style={styles.wideTop}>
          <GenreChip genre={meta.genres[0] ?? 'Story'} />
        </View>
      </View>
      <View style={styles.wideBody}>
        <Text style={[styles.wideTitle, { color: theme.text }]} numberOfLines={1}>
          {meta.title}
        </Text>
        <Text style={[styles.wideDesc, { color: theme.textDim }]} numberOfLines={2}>
          {forPlayer(meta.description)}
        </Text>
        <View style={styles.wideMeta}>
          <AgeBadge ageRating={meta.ageRating} />
          <Text style={[styles.wideMin, { color: theme.textFaint }]}>{meta.estimatedMinutes} min</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  heroCover: { width: '100%' },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 220 },
  heroTop: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  heroBody: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 5 },
  heroTitle: {
    color: '#F6F4F8',
    fontSize: TYPE.displaySmall.fontSize,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 29,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroTag: {
    color: '#B8B1C6',
    fontSize: FONTS.small,
    letterSpacing: 0.15,
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 10,
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  heroMeta: { color: 'rgba(246,244,248,0.76)', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  heroDot: { color: 'rgba(246,244,248,0.40)', fontSize: 10 },
  heroCtaWrap: { borderRadius: RADIUS.pill, overflow: 'hidden' },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
  },
  heroCtaIcon: { color: '#0E070B', fontSize: 11, fontWeight: '900' },
  heroCtaText: { color: '#0E070B', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  newBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  newText: { color: '#0E070B', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  featuredBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(9,8,12,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,138,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  featuredText: { color: '#FF5C8A', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  row: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  thumbWrap: { position: 'relative' },
  thumb: { width: 68, borderRadius: RADIUS.md },
  thumbGlow: {
    position: 'absolute',
    bottom: -4,
    left: 6,
    right: 6,
    height: 10,
    borderRadius: 5,
    opacity: 0.6,
  },
  rowBody: { flex: 1, gap: 4 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  rowTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, flex: 1 },
  rowTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    backgroundColor: 'rgba(255,92,138,0.12)',
  },
  rowTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  rowSub: { fontSize: 12, letterSpacing: 0.1 },
  rowArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowArrowText: { fontSize: 18, fontWeight: '700', marginTop: -2 },
  grid: { width: 160, borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden' },
  gridCover: { width: 160 },
  gridShade: { position: 'absolute', left: 0, right: 0, bottom: 58, height: 44 },
  gridBody: { padding: 11, gap: 4 },
  gridTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  gridSub: { fontSize: 11, letterSpacing: 0.1 },
  gridMeta: { marginTop: 4 },
  wide: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden' },
  wideCoverWrap: { position: 'relative' },
  wideCover: { width: '100%' },
  wideShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 },
  wideTop: { position: 'absolute', top: 12, left: 12 },
  wideBody: { padding: 14, gap: 8 },
  wideTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  wideDesc: { fontSize: 13, lineHeight: 19 },
  wideMeta: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 },
  wideMin: { fontSize: 11, fontWeight: '600' },
});
