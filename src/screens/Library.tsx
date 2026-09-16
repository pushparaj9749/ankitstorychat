/** Library: active journeys + favorites + completed. */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { ContinueCard } from '../components/StoryCard';
import { SectionHeader } from '../components/bits';
import { EmptyState } from '../components/states';
import { SPACING } from '../theme';
import { timeAgo } from '../lib/utils';

type Props = BottomTabScreenProps<MainTabParamList, 'Library'>;

export function Library({ navigation }: Props) {
  const { stories, recentPlaythroughs, favoriteIds, refreshRecent } = useApp();
  const byId = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);

  const active = recentPlaythroughs.filter((p) => p.status === 'active' && byId.has(p.storyId));
  const done = recentPlaythroughs.filter((p) => p.status !== 'active' && byId.has(p.storyId));
  const favorites = stories.filter((s) => favoriteIds.has(s.id));

  React.useEffect(() => {
    const unsub = navigation.addListener('focus', () => void refreshRecent());
    return unsub;
  }, [navigation, refreshRecent]);

  const nav = navigation as unknown as { navigate: (s: string, o?: object) => void };

  if (!active.length && !done.length && !favorites.length) {
    return (
      <Screen>
        <EmptyState
          emoji="📖"
          title="Library khaali hai"
          subtitle="Koi story shuru karo — tumhari journeys yahan dikhengi."
          action="Browse stories"
          onAction={() => nav.navigate('Discover' as never)}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        {active.length > 0 ? (
          <>
            <SectionHeader title="Continue Journeys" />
            {active.map((p) => (
              <View key={p.id} style={styles.gap}>
                <ContinueCard
                  meta={byId.get(p.storyId)!}
                  progress={p.progress}
                  subtitle={`${p.label} • ${timeAgo(p.updatedAt)} • ${p.mode === 'offline' ? 'Offline' : 'AI'}`}
                  onPress={() => nav.navigate('Chat', { playthroughId: p.id })}
                />
              </View>
            ))}
          </>
        ) : null}
        {favorites.length > 0 ? (
          <>
            <SectionHeader title="Favorites ❤️" />
            {favorites.map((s) => (
              <View key={s.id} style={styles.gap}>
                <ContinueCard
                  meta={s}
                  progress={0}
                  subtitle={s.genres.join(' • ')}
                  onPress={() => nav.navigate('StoryDetail', { storyId: s.id })}
                />
              </View>
            ))}
          </>
        ) : null}
        {done.length > 0 ? (
          <>
            <SectionHeader title="Completed" />
            {done.map((p) => (
              <View key={p.id} style={styles.gap}>
                <ContinueCard
                  meta={byId.get(p.storyId)!}
                  progress={1}
                  subtitle={`${p.label} • Completed ${timeAgo(p.updatedAt)}`}
                  onPress={() => nav.navigate('Chat', { playthroughId: p.id })}
                />
              </View>
            ))}
          </>
        ) : null}
        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { marginBottom: 10 },
});
