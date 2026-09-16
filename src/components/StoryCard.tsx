/** Story cards: hero (featured), wide (continue), grid (browse). */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StoryMeta } from '../types';
import { useApp } from '../state/AppContext';
import { effectiveContentApiBaseUrl, getBundledCoverSource } from '../content/loader';
import { makePlayerTextFn } from '../lib/playerName';
import { FONTS, RADIUS, SPACING } from '../theme';
import { AgeBadge, GenreChip, ProgressBar } from './bits';

function Cover({ meta, style }: { meta: StoryMeta; style?: object }) {
  const { settings } = useApp();
  const src = getBundledCoverSource(meta, effectiveContentApiBaseUrl(settings?.contentApiBaseUrl));
  return (
    <View style={[styles.coverWrap, style, { backgroundColor: `${meta.accentColor}33` }]}>
      {src ? (
        <Image source={src} style={styles.coverImg} resizeMode="cover" />
      ) : (
        <Text style={[styles.coverFallback, { color: meta.accentColor }]}>
          {(meta.title[0] ?? '?').toUpperCase()}
        </Text>
      )}
    </View>
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
      <Cover meta={meta} style={styles.heroCover} />
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
      <Cover meta={meta} style={styles.thumb} />
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
      <Cover meta={meta} style={styles.gridCover} />
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
      <Cover meta={meta} style={styles.wideCover} />
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
  coverWrap: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverImg: { width: '100%', height: '100%' },
  coverFallback: { fontSize: 52, fontWeight: '900' },
  hero: { height: 220, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1 },
  heroCover: { ...StyleSheet.absoluteFill, borderRadius: RADIUS.lg },
  heroShade: { ...StyleSheet.absoluteFill },
  heroBody: { position: 'absolute', left: SPACING.lg, right: SPACING.lg, bottom: SPACING.lg },
  heroTop: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  heroTag: { color: '#DDD6FE', fontSize: FONTS.small, marginTop: 4 },
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
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 10,
    gap: 12,
    alignItems: 'center',
  },
  thumb: { width: 64, height: 64, borderRadius: RADIUS.sm },
  rowBody: { flex: 1, gap: 6 },
  rowTitle: { fontSize: FONTS.body, fontWeight: '800' },
  rowSub: { fontSize: FONTS.small },
  grid: { width: 156, borderRadius: RADIUS.md, borderWidth: 1, overflow: 'hidden' },
  gridCover: { width: 156, height: 120 },
  gridBody: { padding: 10, gap: 4 },
  gridTitle: { fontSize: FONTS.body, fontWeight: '800' },
  gridSub: { fontSize: FONTS.tiny },
  gridMeta: { marginTop: 4 },
  wide: { borderRadius: RADIUS.md, borderWidth: 1, overflow: 'hidden' },
  wideCover: { width: '100%', height: 130 },
  wideBody: { padding: 12, gap: 8 },
  wideTitle: { fontSize: FONTS.heading, fontWeight: '800' },
  wideDesc: { fontSize: FONTS.small },
  wideMeta: { flexDirection: 'row', gap: 8 },
});
