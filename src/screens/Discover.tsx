/** Discover: search + genre filters + sorts. Fully age-filtered upstream. */
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { WideCard } from '../components/StoryCard';
import { SelectableChip } from '../components/bits';
import { EmptyState } from '../components/states';
import { RADIUS, SPACING } from '../theme';
import { searchStories } from '../lib/search';

type Props = BottomTabScreenProps<MainTabParamList, 'Discover'>;
type Sort = 'Recommended' | 'Newest' | 'Popular';

export function Discover({ navigation, route }: Props) {
  const { theme, stories } = useApp();
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<string>('All');
  const [sort, setSort] = useState<Sort>('Recommended');

  // Deep-linked genre from Home categories.
  React.useEffect(() => {
    const g = route.params?.genre;
    if (g) setGenre(g);
  }, [route.params?.genre]);

  const genres = useMemo(() => {
    const set = new Set<string>();
    stories.forEach((s) => s.genres.forEach((g) => set.add(g)));
    return ['All', ...[...set].sort()];
  }, [stories]);

  const results = useMemo(() => {
    let pool = genre === 'All' ? stories : stories.filter((s) => s.genres.includes(genre));
    if (query.trim()) {
      pool = searchStories(pool, query).map((h) => h.meta);
    } else {
      pool = [...pool];
      if (sort === 'Popular') pool.sort((a, b) => b.popularity - a.popularity);
      else if (sort === 'Newest')
        pool.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
      else pool.sort((a, b) => b.popularity - a.popularity);
    }
    return pool;
  }, [stories, genre, query, sort]);

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="🔍 Search title, genre, tag, character…"
          placeholderTextColor={theme.textFaint}
          accessibilityLabel="Search stories"
          style={[
            styles.input,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
          ]}
        />
        <FlatList
          horizontal
          data={genres}
          keyExtractor={(g) => g}
          showsHorizontalScrollIndicator={false}
          style={styles.genres}
          renderItem={({ item }) => (
            <SelectableChip label={item} selected={genre === item} onPress={() => setGenre(item)} />
          )}
        />
        <View style={styles.sorts}>
          {(['Recommended', 'Newest', 'Popular'] as Sort[]).map((s) => (
            <SelectableChip key={s} label={s} selected={sort === s} onPress={() => setSort(s)} />
          ))}
        </View>
      </View>
      {results.length === 0 ? (
        <EmptyState
          emoji="🔎"
          title="No stories found"
          subtitle="Try another search — new stories arrive in the catalog automatically."
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <WideCard
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
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  genres: { marginTop: 12 },
  sorts: { flexDirection: 'row', marginTop: 12, marginBottom: 4 },
  list: { padding: 16, gap: 12 },
  item: { marginBottom: 12 },
});
