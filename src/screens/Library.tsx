/** Library — favourites + recent + continue in cinematic layout. */
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GridCard, ContinueCard } from '../components/StoryCard';
import { SectionHeader } from '../components/bits';
import { EmptyState } from '../components/states';
import { SPACING, TYPE, withAlpha } from '../theme';
import { timeAgo } from '../lib/utils';

type Props = BottomTabScreenProps<MainTabParamList, 'Library'>;

export function Library({ navigation }: Props) {
  const { theme, stories, favoriteIds, recentPlaythroughs } = useApp();

  const byId = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);
  const favStories = useMemo(() => stories.filter((s) => favoriteIds.has(s.id)), [stories, favoriteIds]);
  const recent = useMemo(
    () => recentPlaythroughs.filter((p) => byId.has(p.storyId)).slice(0, 6),
    [recentPlaythroughs, byId],
  );

  if (favStories.length === 0 && recent.length === 0) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.accent }]}>LIBRARY</Text>
          <Text style={[styles.title, { color: theme.text }]}>Your shelf</Text>
        </View>
        <EmptyState
          emoji="▣"
          title="Your library is empty"
          subtitle="Heart a story or start a journey — it will live here, beautifully."
          action="Browse shows"
          onAction={() => navigation.navigate('Discover')}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: theme.accent }]}>LIBRARY</Text>
        <Text style={[styles.title, { color: theme.text }]}>Your shelf</Text>
        <Text style={[styles.sub, { color: theme.textDim }]}>
          {favStories.length} saved • {recent.length} recent
        </Text>
      </View>

      {recent.length > 0 ? (
        <View style={styles.pad}>
          <SectionHeader title="Recent journeys" kicker="Continue" />
          {recent.slice(0, 3).map((p) => {
            const meta = byId.get(p.storyId);
            if (!meta) return null;
            return (
              <View key={p.id} style={styles.gap}>
                <ContinueCard
                  meta={meta}
                  progress={p.progress}
                  subtitle={`${p.label} • ${timeAgo(p.updatedAt)}`}
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
      ) : null}

      {favStories.length > 0 ? (
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

      {recent.length > 3 ? (
        <View style={styles.pad}>
          <SectionHeader title="More journeys" />
          {recent.slice(3).map((p) => {
            const meta = byId.get(p.storyId);
            if (!meta) return null;
            return (
              <View key={p.id} style={styles.gap}>
                <ContinueCard
                  meta={meta}
                  progress={p.progress}
                  subtitle={`${p.label} • ${p.status}`}
                  onPress={() =>
                    (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate('Chat', {
                      playthroughId: p.id,
                    })
                  }
                />
              </View>
            );
          })}
          <View style={{ height: SPACING.xxl }} />
        </View>
      ) : (
        <View style={{ height: SPACING.xxl }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.title, marginTop: 2 },
  sub: { fontSize: 13, marginTop: 4, letterSpacing: 0.1 },
  pad: { paddingHorizontal: 20 },
  gap: { marginBottom: 10 },
  hlist: { paddingHorizontal: 20, alignItems: 'flex-start' },
  hitem: { marginRight: 14 },
});
