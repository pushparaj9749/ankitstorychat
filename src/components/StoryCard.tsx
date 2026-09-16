/** Story cards: hero (featured, wide), 3:4 portrait cards everywhere else. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StoryMeta } from '../types';
import { useApp } from '../state/AppContext';
import { effectiveContentApiBaseUrl, getBundledCoverSource } from '../content/loader';
import { makePlayerTextFn } from '../lib/playerName';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE } from '../theme';
import { AgeBadge, GenreChip, ProgressBar } from './bits';
import { CoverImage } from './CoverImage';
import { tapTick } from '../lib/haptics';

function useCover(meta: StoryMeta) {
  const { settings } = useApp();
  return getBundledCoverSource(meta, effectiveContentApiBaseUrl(settings?.contentApiBaseUrl));
}

function usePressStyle() {
  const { settings } = useApp();
  const reduce = !settings?.animations || !!settings?.reducedMotion;
  return ({ pressed }: { pressed: boolean }) =>
    reduce
      ? { opacity: pressed ? 0.85 : 1 }
      : { opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] };
}

export function HeroCard({
  meta,
  onPress,
}: {
  meta: StoryMeta;
  onPress: () => void;
}) {
  const { theme, profile, settings } = useApp();
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);
  const src = useCover(meta);
  const press = usePressStyle();
  return (
    <Pressable
      onPress={() => {
        void tapTick(settings.haptics);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}. ${forPlayer(meta.tagline)}`}
      style={(s) => [styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }, press(s)]}
    >
      <CoverImage
        source={src}
        accentColor={meta.accentColor}
        fallbackLetter={meta.title}
        wide
        style={styles.heroCover}
      />
      <LinearGradient colors={['transparent', 'rgba(5,2,15,0.92)']} style={styles.heroShade} />
      <View style={styles.heroBody}>
        <View style={styles.heroTop}>
          <GenreChip genre={meta.genres[0] ?? 'Story'} />
          <AgeBadge ageRating={meta.ageRating} />
        </View>
        <Text style={styles.heroTitle}>{meta.title}</Text>
        <Text style={styles.heroTag} numberOfLines={2}>
          {forPlayer(meta.tagline)}
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
  const { theme, profile, settings } = useApp();
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);
  const src = useCover(meta);
  const press = usePressStyle();
  return (
    <Pressable
      onPress={() => {
        void tapTick(settings.haptics);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Continue ${meta.title}`}
      style={(s) => [styles.row, { backgroundColor: theme.surface, borderColor: theme.border }, press(s)]}
    >
      <CoverImage
        source={src}
        accentColor={meta.accentColor}
        fallbackLetter={meta.title}
        style={styles.thumb}
      />
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          {meta.title}
        </Text>
        <Text style={[styles.rowSub, { color: theme.textDim }]} numberOfLines={2}>
          {forPlayer(subtitle)}
        </Text>
        <ProgressBar value={progress} color={meta.accentColor} />
      </View>
    </Pressable>
  );
}

export function GridCard({ meta, onPress }: { meta: StoryMeta; onPress: () => void }) {
  const { theme, profile, settings } = useApp();
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);
  const src = useCover(meta);
  const press = usePressStyle();
  return (
    <Pressable
      onPress={() => {
        void tapTick(settings.haptics);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}. ${forPlayer(meta.tagline)}`}
      style={(s) => [styles.grid, { backgroundColor: theme.surface, borderColor: theme.border }, press(s)]}
    >
      <CoverImage
        source={src}
        accentColor={meta.accentColor}
        fallbackLetter={meta.title}
        style={styles.gridCover}
      />
      <View style={styles.gridBody}>
        <Text style={[styles.gridTitle, { color: theme.text }]} numberOfLines={2}>
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
  const { theme, profile, settings } = useApp();
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);
  const src = useCover(meta);
  const press = usePressStyle();
  return (
    <Pressable
      onPress={() => {
        void tapTick(settings.haptics);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={meta.title}
      style={(s) => [styles.wide, { backgroundColor: theme.surface, borderColor: theme.border }, press(s)]}
    >
      <CoverImage
        source={src}
        accentColor={meta.accentColor}
        fallbackLetter={meta.title}
        style={styles.wideCover}
      />
      <View style={styles.wideBody}>
        <Text style={[styles.wideTitle, { color: theme.text }]} numberOfLines={2}>
          {meta.title}
        </Text>
        <Text style={[styles.wideDesc, { color: theme.textDim }]} numberOfLines={3}>
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
  hero: { height: 252, borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 1, ...SHADOWS.hero },
  heroCover: { ...StyleSheet.absoluteFill, borderRadius: RADIUS.xl },
  heroShade: { ...StyleSheet.absoluteFill },
  heroBody: { position: 'absolute', left: SPACING.lg, right: SPACING.lg, bottom: SPACING.lg },
  heroTop: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  heroTitle: {
    color: '#fff',
    fontSize: TYPE.display.fontSize,
    fontWeight: '900',
    letterSpacing: TYPE.display.letterSpacing,
  },
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
  thumb: { width: 72, borderRadius: RADIUS.md },
  rowBody: { flex: 1, gap: 6, minWidth: 0 },
  rowTitle: { fontSize: FONTS.body, fontWeight: '800', letterSpacing: -0.2 },
  rowSub: { fontSize: FONTS.small },
  grid: { width: 158, borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden', ...SHADOWS.card },
  gridCover: { width: 158, borderRadius: 0 },
  gridBody: { padding: 10, gap: 4 },
  gridTitle: { fontSize: FONTS.body, fontWeight: '800', letterSpacing: -0.2 },
  gridSub: { fontSize: FONTS.tiny },
  gridMeta: { marginTop: 4 },
  wide: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.card,
    alignItems: 'stretch',
  },
  wideCover: { width: 118, borderRadius: 0 },
  wideBody: { flex: 1, padding: 12, gap: 8, minWidth: 0, justifyContent: 'center' },
  wideTitle: { fontSize: FONTS.heading, fontWeight: '800', letterSpacing: -0.2 },
  wideDesc: { fontSize: FONTS.small, lineHeight: 18 },
  wideMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
