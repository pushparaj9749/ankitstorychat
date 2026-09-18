/** Story cards — cinematic premium. Poster-first, glass typography, quiet depth. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StoryMeta } from '../types';
import { useApp } from '../state/AppContext';
import { effectiveContentApiBaseUrl, getBundledCoverSource } from '../content/loader';
import { makePlayerTextFn } from '../lib/playerName';
import { FONTS, RADIUS, SHADOWS, TYPE, withAlpha } from '../theme';
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
          opacity: pressed ? 0.96 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        SHADOWS.hero,
      ]}
    >
      <Cover meta={meta} style={styles.heroCover} fallbackMinHeight={220} />
      {/* Multi-stop scrim for legible typography across any artwork */}
      <LinearGradient
        colors={['transparent', 'rgba(12,11,10,0.18)', 'rgba(12,11,10,0.82)', 'rgba(12,11,10,0.96)']}
        locations={[0, 0.45, 0.78, 1]}
        style={styles.heroShade}
      />
      {/* Top meta */}
      <View style={styles.heroTop}>
        <GenreChip genre={meta.genres[0] ?? 'Story'} />
        <AgeBadge ageRating={meta.ageRating} />
      </View>
      {/* Bottom copy */}
      <View style={styles.heroBody}>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {meta.title}
        </Text>
        <Text style={styles.heroTag} numberOfLines={2}>
          {forPlayer(meta.tagline)}
        </Text>
        <View style={styles.heroMetaRow}>
          <Text style={styles.heroMeta}>{meta.genres.slice(0, 2).join(' • ')}</Text>
          {meta.estimatedMinutes ? (
            <>
              <Text style={styles.heroDot}>•</Text>
              <Text style={styles.heroMeta}>{meta.estimatedMinutes} min</Text>
            </>
          ) : null}
        </View>
      </View>
      {meta.isNew ? (
        <View style={[styles.newBadge, { backgroundColor: theme.accent }]}>
          <Text style={styles.newText}>NEW</Text>
        </View>
      ) : null}
      {meta.featured ? (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredText}>✦ FEATURED</Text>
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
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        SHADOWS.card,
      ]}
    >
      <View style={styles.thumbWrap}>
        <Cover meta={meta} style={styles.thumb} fallbackMinHeight={64} />
        <View style={[styles.thumbGlow, { backgroundColor: withAlpha(meta.accentColor, 0.18) }]} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          {meta.title}
        </Text>
        <Text style={[styles.rowSub, { color: theme.textDim }]} numberOfLines={1}>
          {forPlayer(subtitle)}
        </Text>
        <ProgressBar value={progress} color={meta.accentColor} />
      </View>
      <View style={[styles.rowArrow, { backgroundColor: withAlpha(theme.accent, 0.12), borderColor: withAlpha(theme.accent, 0.18) }]}>
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
      <Cover meta={meta} style={styles.gridCover} fallbackMinHeight={122} />
      <LinearGradient
        colors={['transparent', 'rgba(12,11,10,0.72)']}
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
          opacity: pressed ? 0.96 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        SHADOWS.card,
      ]}
    >
      <View style={styles.wideCoverWrap}>
        <Cover meta={meta} style={styles.wideCover} fallbackMinHeight={140} />
        <LinearGradient colors={['transparent', 'rgba(12,11,10,0.46)']} style={styles.wideShade} />
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
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 200 },
  heroTop: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  heroBody: { position: 'absolute', left: 18, right: 18, bottom: 18, gap: 6 },
  heroTitle: {
    color: '#F4EDE4',
    fontSize: TYPE.display.fontSize,
    fontWeight: '800',
    letterSpacing: TYPE.display.letterSpacing,
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroTag: {
    color: '#C4B6A6',
    fontSize: FONTS.small,
    letterSpacing: 0.15,
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 6,
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  heroMeta: { color: 'rgba(244,237,228,0.78)', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  heroDot: { color: 'rgba(244,237,228,0.42)', fontSize: 10 },
  newBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  newText: { color: '#1A100C', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  featuredBadge: {
    position: 'absolute',
    bottom: 88,
    left: 18,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(244,237,228,0.14)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  featuredText: { color: '#F4EDE4', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  row: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 10,
    gap: 12,
    alignItems: 'center',
  },
  thumbWrap: { position: 'relative' },
  thumb: { width: 64, borderRadius: RADIUS.md },
  thumbGlow: {
    position: 'absolute',
    bottom: -6,
    left: 8,
    right: 8,
    height: 12,
    borderRadius: 6,
    opacity: 0.5,
  },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  rowSub: { fontSize: 12, letterSpacing: 0.1 },
  rowArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowArrowText: { fontSize: 16, fontWeight: '700', marginTop: -1 },
  grid: { width: 158, borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden' },
  gridCover: { width: 158 },
  gridShade: { position: 'absolute', left: 0, right: 0, bottom: 58, height: 40 },
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
