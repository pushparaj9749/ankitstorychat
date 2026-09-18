/**
 * Library / Chats Screen — Redesigned for Kissa v2.4.1.
 *
 * Features:
 *  - Active interactive fiction journeys prioritized
 *  - Story artwork (natural ratio), title, progress bar, last updated time
 *  - Saved / Favorited stories shelf
 *  - Zero technical memory UI
 *  - Elegant empty states
 *  - Direction-aware scroll handling
 */
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { Screen } from '../components/Screen';
import { GridCard, ContinueCard } from '../components/StoryCard';
import { SectionHeader, SelectableChip } from '../components/bits';
import { EmptyState } from '../components/states';
import { RADIUS, SPACING, TYPE, withAlpha } from '../theme';
import { timeAgo } from '../lib/utils';

type Props = BottomTabScreenProps<MainTabParamList, 'Library'>;
type FilterTab = 'All' | 'Active' | 'Completed' | 'Saved';

export function Library({ navigation }: Props) {
  const { theme, stories, favoriteIds, recentPlaythroughs } = useApp();
  const { handleScroll } = useNavScroll();
  const [filter, setFilter] = useState<FilterTab>('All');

  const byId = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);
  const favStories = useMemo(() => stories.filter((s) => favoriteIds.has(s.id)), [stories, favoriteIds]);

  const filteredPlaythroughs = useMemo(() => {
    const list = recentPlaythroughs.filter((p) => byId.has(p.storyId));
    if (filter === 'Active') return list.filter((p) => p.status === 'active');
    if (filter === 'Completed') return list.filter((p) => p.status === 'completed');
    return list;
  }, [recentPlaythroughs, byId, filter]);

  if (favStories.length === 0 && recentPlaythroughs.length === 0) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.accent }]}>YOUR SHELF</Text>
          <Text style={[styles.title, { color: theme.text }]}>Story Library</Text>
        </View>
        <EmptyState
          emoji="▣"
          title="Your library is empty"
          subtitle="Explore stories and enter interactive journeys — your active adventures and saved stories live here."
          action="Explore Stories"
          onAction={() => navigation.navigate('Discover')}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.accent }]}>YOUR SHELF</Text>
          <Text style={[styles.title, { color: theme.text }]}>Story Library</Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            {favStories.length} saved • {recentPlaythroughs.length} interactive journeys
          </Text>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {(['All', 'Active', 'Completed', 'Saved'] as FilterTab[]).map((tab) => (
              <SelectableChip
                key={tab}
                label={tab}
                selected={filter === tab}
                onPress={() => setFilter(tab)}
              />
            ))}
          </View>
        </View>

        {/* Active / In-Progress Journeys */}
        {filter !== 'Saved' && filteredPlaythroughs.length > 0 ? (
          <View style={styles.pad}>
            <SectionHeader
              title={filter === 'Completed' ? 'Completed Stories' : 'Interactive Journeys'}
              kicker={`${filteredPlaythroughs.length} journeys`}
            />
            {filteredPlaythroughs.map((p) => {
              const meta = byId.get(p.storyId);
              if (!meta) return null;
              return (
                <View key={p.id} style={styles.gap}>
                  <ContinueCard
                    meta={meta}
                    progress={p.progress}
                    subtitle={`${p.label} • ${p.status === 'completed' ? 'Completed' : timeAgo(p.updatedAt)}`}
                    onPress={() =>
                      (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate('Chat', {
                        playthroughId: p.id,
                      })
                    }
                  />
                </View>
              );
            })}
          </View>
        ) : filter !== 'Saved' && filteredPlaythroughs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: theme.textFaint }]}>
              No {filter.toLowerCase()} journeys found.
            </Text>
          </View>
        ) : null}

        {/* Saved Stories Rail */}
        {(filter === 'All' || filter === 'Saved') && favStories.length > 0 ? (
          <>
            <View style={styles.pad}>
              <SectionHeader title="Saved Stories" kicker={`${favStories.length} favorites`} />
            </View>
            <FlatList
              horizontal
              data={favStories}
              keyExtractor={(s) => s.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hlist}
              renderItem={({ item }) => (
                <View style={styles.hitem}>
                  <GridCard
                    meta={item}
                    onPress={() =>
                      (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate('StoryDetail', {
                        storyId: item.id,
                      })
                    }
                  />
                </View>
              )}
            />
          </>
        ) : null}

        <View style={{ height: SPACING.xxxl + 32 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16 },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 4 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.title, marginTop: 2 },
  sub: { fontSize: 13, marginTop: 4, letterSpacing: 0.1 },
  filterRow: { flexDirection: 'row', marginTop: 12, marginBottom: 4 },
  pad: { paddingHorizontal: 18 },
  gap: { marginBottom: 10 },
  hlist: { paddingHorizontal: 18, alignItems: 'flex-start' },
  hitem: { marginRight: 14 },
  emptyWrap: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, fontWeight: '600' },
});
