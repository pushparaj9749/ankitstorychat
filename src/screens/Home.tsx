/** Home: greeting, continue, featured, recommended, new & hot, categories, favorites. */
import React, { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { ContinueCard, GridCard, HeroCard } from '../components/StoryCard';
import { SectionHeader, SelectableChip } from '../components/bits';
import { EmptyState } from '../components/states';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE } from '../theme';
import { greetingForHour, timeAgo } from '../lib/utils';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

export function Home({ navigation }: Props) {
  const {
    theme,
    profile,
    stories,
    recentPlaythroughs,
    favoriteIds,
    updateAvailable,
  } = useApp();

  const byId = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);

  const activeRecent = useMemo(
    () =>
      recentPlaythroughs
        .filter((p) => p.status === 'active' && byId.has(p.storyId))
        .slice(0, 3),
    [recentPlaythroughs, byId],
  );

  const featured = useMemo(() => stories.find((s) => s.featured) ?? stories[0], [stories]);
  const recommended = useMemo(
    () => [...stories].sort((a, b) => b.popularity - a.popularity).slice(0, 8),
    [stories],
  );
  const newHot = useMemo(
    () => stories.filter((s) => s.isNew).slice(0, 8),
    [stories],
  );
  const favorites = useMemo(
    () => stories.filter((s) => favoriteIds.has(s.id)),
    [stories, favoriteIds],
  );
  const categories = useMemo(() => {
    const set = new Set<string>();
    stories.forEach((s) => s.genres.forEach((g) => set.add(g)));
    return [...set].sort();
  }, [stories]);

  const greeting = greetingForHour(new Date().getHours(), profile?.nickname ?? '');

  if (!stories.length) {
    return (
      <Screen>
        <EmptyState
          emoji="📚"
          title="No stories yet"
          subtitle="Pull fresh stories from Content Updates, or check your connection."
          action="Content Updates"
          onAction={() => (navigation as unknown as { navigate: (s: string) => void }).navigate('ContentUpdates')}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.pad}>
          <Text style={[styles.hello, { color: theme.textDim }]}>{greeting.split(',')[0]},</Text>
          <Text style={[styles.name, { color: theme.text }]}>
            {profile?.nickname ?? 'Traveller'} 👋
          </Text>

          <Pressable
            onPress={() => navigation.navigate('Discover')}
            accessibilityRole="search"
            accessibilityLabel="Search stories"
            style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={{ color: theme.textFaint }}>🔍 Search stories, genres, characters…</Text>
          </Pressable>

          {updateAvailable ? (
            <Pressable
              onPress={() => (navigation as unknown as { navigate: (s: string) => void }).navigate('ContentUpdates')}
              style={[styles.updateBanner, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
            >
              <Text style={[styles.updateText, { color: theme.accent }]}>
                ✨ Nayi stories available hain — tap to update
              </Text>
            </Pressable>
          ) : null}

          {activeRecent.length > 0 ? (
            <>
              <SectionHeader title="Continue Story" />
              {activeRecent.map((p) => {
                const meta = byId.get(p.storyId)!;
                return (
                  <View key={p.id} style={styles.gap}>
                    <ContinueCard
                      meta={meta}
                      progress={p.progress}
                      subtitle={`${p.label} • ${timeAgo(p.updatedAt)}`}
                      onPress={() =>
                        (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate(
                          'Chat',
                          { playthroughId: p.id },
                        )
                      }
                    />
                  </View>
                );
              })}
            </>
          ) : null}

          {featured ? (
            <>
              <SectionHeader title="Featured Story" />
              <HeroCard
                meta={featured}
                onPress={() =>
                  (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate(
                    'StoryDetail',
                    { storyId: featured.id },
                  )
                }
              />
            </>
          ) : null}
        </View>

        <View style={styles.pad}>
          <SectionHeader
            title="Recommended"
            action="See all"
            onAction={() => navigation.navigate('Discover')}
          />
        </View>
        <FlatList
          horizontal
          data={recommended}
          keyExtractor={(s) => s.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hlist}
          renderItem={({ item }) => (
            <View style={styles.hitem}>
              <GridCard
                meta={item}
                onPress={() =>
                  (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate(
                    'StoryDetail',
                    { storyId: item.id },
                  )
                }
              />
            </View>
          )}
        />

        {newHot.length > 0 ? (
          <>
            <View style={styles.pad}>
              <SectionHeader title="New & Hot 🔥" />
              {newHot.slice(0, 3).map((s) => (
                <View key={s.id} style={styles.gap}>
                  <ContinueCard
                    meta={s}
                    progress={0}
                    subtitle={s.tagline}
                    onPress={() =>
                      (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate(
                        'StoryDetail',
                        { storyId: s.id },
                      )
                    }
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.pad}>
          <SectionHeader title="Categories" />
          <View style={styles.cats}>
            {categories.map((c) => (
              <SelectableChip
                key={c}
                label={c}
                selected={false}
                onPress={() => navigation.navigate('Discover', { genre: c })}
              />
            ))}
          </View>

          {favorites.length > 0 ? (
            <>
              <SectionHeader title="Favorites ❤️" />
              {favorites.map((s) => (
                <View key={s.id} style={styles.gap}>
                  <ContinueCard
                    meta={s}
                    progress={0}
                    subtitle={s.genres.join(' • ')}
                    onPress={() =>
                      (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate(
                        'StoryDetail',
                        { storyId: s.id },
                      )
                    }
                  />
                </View>
              ))}
            </>
          ) : null}
          <View style={{ height: SPACING.xxl }} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 8 },
  pad: { paddingHorizontal: 16 },
  hello: { fontSize: FONTS.small, marginTop: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  name: { ...TYPE.display, marginBottom: 14 },
  searchBar: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 4,
    ...SHADOWS.card,
  },
  updateBanner: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 12,
    marginTop: 12,
  },
  updateText: { fontWeight: '700', fontSize: FONTS.small },
  gap: { marginBottom: 10 },
  hlist: { paddingHorizontal: 16 },
  hitem: { marginRight: 12 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
