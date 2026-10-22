/**
 * KISSA v2.6 — Library
 * Stat tiles → filter pills → journeys (continue cards) → saved poster wall.
 * An empty shelf still shows popular picks, so the screen is never blank.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { Screen } from '../components/Screen';
import { ContinueCard, PosterGrid } from '../components/StoryCard';
import { SectionHeader, SelectableChip } from '../components/bits';
import { GradientButton } from '../components/GradientButton';
import { Icon, type IconName } from '../components/icons';
import { Illustration } from '../components/illustrations';
import { LAYOUT, RADIUS, SCALE, SPACING, TYPE, withAlpha } from '../theme';
import { timeAgo } from '../lib/utils';

type Props = BottomTabScreenProps<MainTabParamList, 'Library'>;
type FilterTab = 'All' | 'Journeys' | 'Saved';

export function Library({ navigation }: Props) {
  const { theme, uiTemplate, stories, favoriteIds, recentPlaythroughs } = useApp();
  const { handleScroll } = useNavScroll();
  const [filter, setFilter] = useState<FilterTab>('All');

  const byId = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);
  const favStories = useMemo(() => stories.filter((s) => favoriteIds.has(s.id)), [stories, favoriteIds]);
  /** Stories never end, so instead of "completed": how many different stories you've played. */
  const storiesPlayed = useMemo(() => new Set(recentPlaythroughs.map((p) => p.storyId)).size, [recentPlaythroughs]);
  const popular = useMemo(() => [...stories].sort((a, b) => b.popularity - a.popularity).slice(0, 4), [stories]);
  /** Stories not on the shelf yet — keeps a short shelf from ending in blank screen. */
  const picks = useMemo(() => {
    const onShelf = new Set([...favoriteIds, ...recentPlaythroughs.map((p) => p.storyId)]);
    return [...stories]
      .filter((s) => !onShelf.has(s.id))
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 6);
  }, [stories, favoriteIds, recentPlaythroughs]);

  const filteredPlaythroughs = useMemo(() => {
    return recentPlaythroughs.filter((p) => byId.has(p.storyId));
  }, [recentPlaythroughs, byId, filter]);

  const openStory = (id: string) => (navigation as any).navigate('StoryDetail', { storyId: id });
  const empty = favStories.length === 0 && recentPlaythroughs.length === 0;

  const stat = (icon: IconName, value: number, label: string, tint: string) => (
    <View style={[styles.stat, { borderColor: theme.border, backgroundColor: withAlpha(theme.surface2, 0.7) }]}>
      <View style={[styles.statIcon, { backgroundColor: withAlpha(tint, 0.16) }]}>
        <Icon name={icon} size={17} color={tint} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textFaint }]}>{label}</Text>
    </View>
  );

  return (
    <Screen padded={false}>
      <ScrollView onScroll={handleScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, styles.container]}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.gold }]}>YOUR SHELF</Text>
          <Text style={[styles.title, { color: theme.text }]}>Library</Text>
          <View style={styles.statRow}>
            {stat('bookmark', favStories.length, 'Saved', theme.accent)}
            {stat('chatbubble', recentPlaythroughs.length, 'Journeys', theme.violet)}
            {stat('book', storiesPlayed, 'Stories', theme.gold)}
          </View>
        </View>

        {empty ? (
          <View style={styles.pad}>
            <View style={[styles.emptyCard, { borderColor: theme.border }]}>
              <LinearGradient
                colors={[withAlpha(theme.violet, 0.22), withAlpha(theme.primary, 0.08)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {uiTemplate === 'classic' ? (
                <View style={[styles.emptyIcon, { backgroundColor: withAlpha(theme.primary, 0.18) }]}>
                  <Icon name="library" size={26} color={theme.accent} />
                </View>
              ) : (
                <Illustration
                  name="shelf"
                  width={188}
                  colors={{ accent: theme.primary, gold: theme.gold, surface: theme.surface, surface2: theme.surface3, line: withAlpha(theme.text, 0.16) }}
                />
              )}
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Your shelf is waiting</Text>
              <Text style={[styles.emptySub, { color: theme.textDim }]}>
                Tap the heart on any story to save it, or start a journey — it lives here.
              </Text>
              <View style={styles.emptyCta}>
                <GradientButton title="Explore stories" onPress={() => navigation.navigate('Discover')} />
              </View>
            </View>
            {popular.length > 0 ? (
              <>
                <SectionHeader title="Start with these" kicker="Popular" />
                <PosterGrid stories={popular} onOpen={openStory} />
              </>
            ) : null}
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {(['All', 'Journeys', 'Saved'] as FilterTab[]).map((tab) => (
                <SelectableChip key={tab} label={tab} selected={filter === tab} onPress={() => setFilter(tab)} />
              ))}
            </ScrollView>

            {filter !== 'Saved' && filteredPlaythroughs.length > 0 ? (
              <View style={styles.pad}>
                <SectionHeader title="Journeys" kicker={`${filteredPlaythroughs.length}`} />
                {filteredPlaythroughs.map((p) => {
                  const meta = byId.get(p.storyId);
                  if (!meta) return null;
                  return (
                    <View key={p.id} style={styles.gap}>
                      <ContinueCard
                        meta={meta}
                        progress={p.progress}
                        subtitle={`${p.label} · ${timeAgo(p.updatedAt)}`}
                        onPress={() => (navigation as any).navigate('Chat', { playthroughId: p.id })}
                      />
                    </View>
                  );
                })}
              </View>
            ) : filter !== 'Saved' ? (
              <View style={styles.emptyWrap}>
                <Icon name="chatbubble-outline" size={22} color={theme.textFaint} />
                <Text style={[styles.emptyText, { color: theme.textFaint }]}>No journeys yet.</Text>
              </View>
            ) : null}

            {(filter === 'All' || filter === 'Saved') && favStories.length > 0 ? (
              <View style={styles.pad}>
                <SectionHeader title="Saved" kicker={`${favStories.length}`} />
                <PosterGrid stories={favStories} onOpen={openStory} />
              </View>
            ) : filter === 'Saved' ? (
              <View style={styles.emptyWrap}>
                <Icon name="heart-outline" size={22} color={theme.textFaint} />
                <Text style={[styles.emptyText, { color: theme.textFaint }]}>Nothing saved yet — tap a heart on any story.</Text>
              </View>
            ) : null}

            {favStories.length < 4 && picks.length > 0 ? (
              <View style={styles.pad}>
                <SectionHeader title="Try next" kicker="For you" action="Explore" onAction={() => navigation.navigate('Discover')} />
                <PosterGrid stories={picks} onOpen={openStory} />
              </View>
            ) : null}
          </>
        )}

        <View style={{ height: LAYOUT.navClearance }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 8 },
  container: { width: '100%', maxWidth: LAYOUT.contentMaxWidth + 120, alignSelf: 'center' },
  header: { paddingHorizontal: SPACING.page, paddingTop: 8, paddingBottom: 4 },
  kicker: { fontSize: SCALE.micro, letterSpacing: 1.6, fontWeight: '800' as const, marginTop: 4 },
  title: { ...TYPE.display, letterSpacing: -0.8, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: SPACING.lg },
  stat: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: 12, gap: 4 },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: SCALE.micro, fontWeight: '700', letterSpacing: 0.6 },
  filterRow: { paddingHorizontal: SPACING.page, marginTop: SPACING.lg },
  pad: { paddingHorizontal: SPACING.page },
  gap: { marginBottom: 10 },
  emptyCard: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 22,
    alignItems: 'center',
  },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 19, fontWeight: '800', marginTop: 14, letterSpacing: -0.3 },
  emptySub: { fontSize: SCALE.small, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  emptyCta: { alignSelf: 'stretch', marginTop: 16 },
  emptyWrap: { padding: 28, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: SCALE.small, fontWeight: '600' },
});
