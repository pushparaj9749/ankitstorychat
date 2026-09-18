/**
 * KISSA v2.4.2 — Library / Chats
 * Active journeys prioritized, saved shelf, no memory UI.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { Screen } from '../components/Screen';
import { GridCard, ContinueCard } from '../components/StoryCard';
import { SectionHeader, SelectableChip } from '../components/bits';
import { EmptyState } from '../components/states';
import { SPACING, TYPE } from '../theme';
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
          <Text style={[styles.kicker, { color: theme.textFaint }]}>YOUR SHELF</Text>
          <Text style={[styles.title, { color: theme.text }]}>Library</Text>
        </View>
        <EmptyState icon="library-outline" title="Your library is empty" subtitle="Explore stories and start journeys — they live here." action="Explore" onAction={() => navigation.navigate('Discover')} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView onScroll={handleScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.textFaint }]}>YOUR SHELF</Text>
          <Text style={[styles.title, { color: theme.text }]}>Library</Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>{favStories.length} saved · {recentPlaythroughs.length} journeys</Text>
          <View style={styles.filterRow}>
            {(['All', 'Active', 'Completed', 'Saved'] as FilterTab[]).map((tab) => (
              <SelectableChip key={tab} label={tab} selected={filter === tab} onPress={() => setFilter(tab)} />
            ))}
          </View>
        </View>

        {filter !== 'Saved' && filteredPlaythroughs.length > 0 ? (
          <View style={styles.pad}>
            <SectionHeader title={filter === 'Completed' ? 'Completed' : 'Journeys'} kicker={`${filteredPlaythroughs.length}`} />
            {filteredPlaythroughs.map((p) => {
              const meta = byId.get(p.storyId);
              if (!meta) return null;
              return (
                <View key={p.id} style={styles.gap}>
                  <ContinueCard
                    meta={meta}
                    progress={p.progress}
                    subtitle={`${p.label} · ${p.status === 'completed' ? 'Completed' : timeAgo(p.updatedAt)}`}
                    onPress={() => (navigation as any).navigate('Chat', { playthroughId: p.id })}
                  />
                </View>
              );
            })}
          </View>
        ) : filter !== 'Saved' ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: theme.textFaint }]}>No {filter.toLowerCase()} journeys.</Text>
          </View>
        ) : null}

        {(filter === 'All' || filter === 'Saved') && favStories.length > 0 ? (
          <>
            <View style={styles.pad}>
              <SectionHeader title="Saved" kicker={`${favStories.length}`} />
            </View>
            <FlatList
              horizontal
              data={favStories}
              keyExtractor={(s) => s.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hlist}
              renderItem={({ item }) => (
                <View style={styles.hitem}>
                  <GridCard meta={item} onPress={() => (navigation as any).navigate('StoryDetail', { storyId: item.id })} />
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
  kicker: { ...TYPE.tiny, letterSpacing: 1.2, fontWeight: '700' as const, marginTop: 4 },
  title: { ...TYPE.title, marginTop: 2 },
  sub: { fontSize: 12.5, marginTop: 4, letterSpacing: 0.1 },
  filterRow: { flexDirection: 'row', marginTop: 14, marginBottom: 4 },
  pad: { paddingHorizontal: 18 },
  gap: { marginBottom: 10 },
  hlist: { paddingHorizontal: 18 },
  hitem: { marginRight: 12 },
  emptyWrap: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 12.5, fontWeight: '500' },
});
