/**
 * KISSA v2.4.2 — Story Cards
 * Artwork-first, natural aspect ratio, editorial, minimal.
 * No cropping, no forced ratios, no neon.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StoryMeta } from '../types';
import { useApp } from '../state/AppContext';
import { effectiveContentApiBaseUrl, getBundledCoverSource } from '../content/loader';
import { makePlayerTextFn } from '../lib/playerName';
import { RADIUS, SHADOWS, TYPE, withAlpha, GRADIENTS } from '../theme';
import { AgeBadge, GenreChip, ProgressBar } from './bits';
import { CoverImage } from './CoverImage';
import { Icon, ICON_SIZE } from './icons';

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

/* Featured — large cinematic hero */
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
          transform: [{ scale: pressed ? 0.988 : 1 }],
        },
        SHADOWS.hero,
      ]}
    >
      <Cover meta={meta} style={styles.heroCover} fallbackMinHeight={280} />
      <LinearGradient
        colors={[...GRADIENTS.heroShade] as any}
        locations={[0, 0.42, 0.76, 1]}
        style={styles.heroShade}
      />

      <View style={styles.heroTop}>
        <View style={styles.heroTopLeft}>
          <GenreChip genre={meta.genres[0] ?? 'Story'} />
        </View>
        {meta.featured ? (
          <View style={[styles.featuredBadge, { backgroundColor: theme.text }]}>
            <Text style={[styles.featuredText, { color: theme.bg }]}>FEATURED</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.heroBody}>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {meta.title}
        </Text>
        <Text style={styles.heroTag} numberOfLines={2}>
          {forPlayer(meta.tagline)}
        </Text>
        <View style={styles.heroFooter}>
          <Text style={styles.heroMeta} numberOfLines={1}>
            {meta.genres.slice(0, 2).join(' • ')} {meta.estimatedMinutes ? `· ${meta.estimatedMinutes}m` : ''}
          </Text>
          <View style={[styles.heroCta, { backgroundColor: theme.text }]}>
            <Text style={[styles.heroCtaText, { color: theme.bg }]}>ENTER</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* Continue — horizontal row with progress */
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
          transform: [{ scale: pressed ? 0.988 : 1 }],
        },
        SHADOWS.card,
      ]}
    >
      <View style={styles.thumbWrap}>
        <Cover meta={meta} style={styles.thumb} fallbackMinHeight={72} />
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

      <View style={[styles.rowArrow, { borderColor: theme.border, backgroundColor: withAlpha(theme.surface2, 0.9) }]}>
        <Icon name="chevron-forward" size={ICON_SIZE.sm} color={theme.textFaint} />
      </View>
    </Pressable>
  );
}

/* Grid — small vertical card */
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
      <Cover meta={meta} style={styles.gridCover} fallbackMinHeight={132} />
      <View style={styles.gridBody}>
        <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={2}>
          {meta.title}
        </Text>
        <Text style={[styles.gridSub, { color: theme.textFaint }]} numberOfLines={1}>
          {meta.genres[0] ?? 'Story'}
        </Text>
      </View>
    </Pressable>
  );
}

/* Wide — horizontal discovery */
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
          transform: [{ scale: pressed ? 0.987 : 1 }],
        },
        SHADOWS.card,
      ]}
    >
      <View style={styles.wideCoverWrap}>
        <Cover meta={meta} style={styles.wideCover} fallbackMinHeight={140} />
      </View>
      <View style={styles.wideBody}>
        <View style={styles.wideTop}>
          <GenreChip genre={meta.genres[0] ?? 'Story'} />
          <AgeBadge ageRating={meta.ageRating} />
        </View>
        <Text style={[styles.wideTitle, { color: theme.text }]} numberOfLines={1}>
          {meta.title}
        </Text>
        <Text style={[styles.wideDesc, { color: theme.textDim }]} numberOfLines={2}>
          {forPlayer(meta.description)}
        </Text>
      </View>
    </Pressable>
  );
}

/* FeaturedStory alias */
export const FeaturedStory = HeroCard;

const styles = StyleSheet.create({
  hero: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  heroCover: { width: '100%' },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 260 },
  heroTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTopLeft: { flexDirection: 'row', gap: 8 },
  featuredBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  featuredText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  heroBody: { position: 'absolute', left: 16, right: 16, bottom: 14, gap: 4 },
  heroTitle: {
    color: '#F2F0EB',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  heroTag: {
    color: 'rgba(242,240,235,0.72)',
    fontSize: 13,
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 10,
  },
  heroMeta: { color: 'rgba(242,240,235,0.55)', fontSize: 11, fontWeight: '600', flex: 1 },
  heroCta: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
  },
  heroCtaText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  row: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 10,
    gap: 12,
    alignItems: 'center',
  },
  thumbWrap: { width: 64 },
  thumb: { width: 64, borderRadius: RADIUS.md },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14.5, fontWeight: '700', letterSpacing: -0.2 },
  rowSub: { fontSize: 12, letterSpacing: 0.1 },
  rowArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { width: 148, borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden' },
  gridCover: { width: 148 },
  gridBody: { padding: 10, gap: 3 },
  gridTitle: { fontSize: 13, fontWeight: '700', letterSpacing: -0.15, lineHeight: 17 },
  gridSub: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  wide: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden', flexDirection: 'row' },
  wideCoverWrap: { width: 110 },
  wideCover: { width: 110 },
  wideBody: { flex: 1, padding: 12, gap: 6, justifyContent: 'center' },
  wideTop: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  wideTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  wideDesc: { fontSize: 12.5, lineHeight: 17.5 },
});
