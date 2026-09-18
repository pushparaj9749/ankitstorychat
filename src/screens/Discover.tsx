/** Discover — cinematic browse with glass search + premium filters. */
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { WideCard } from '../components/StoryCard';
import { SelectableChip } from '../components/bits';
import { EmptyState } from '../components/states';
import { RADIUS, SPACING, TYPE, withAlpha } from '../theme';
import { searchStories } from '../lib/search';

type Props = BottomTabScreenProps<MainTabParamList, 'Discover'>;
type Sort = 'Recommended' | 'Newest' | 'Popular';

export function Discover({ navigation, route }: Props) {
  const { theme, stories } = useApp();
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<string>('All');
  const [sort, setSort] = useState<Sort>('Recommended');

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
      else if (sort === 'Newest') pool.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
      else pool.sort((a, b) => b.popularity - a.popularity);
    }
    return pool;
  }, [stories, genre, query, sort]);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: theme.accent }]}>EXPLORE</Text>
        <Text style={[styles.title, { color: theme.text }]}>Find your next story</Text>
        <View style={[styles.searchWrap, { backgroundColor: withAlpha(theme.surface, 0.94), borderColor: theme.border }]}>
          <Text style={[styles.searchIcon, { color: theme.textFaint }]}>◎</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search title, genre, tag, character…"
            placeholderTextColor={theme.textFaint}
            accessibilityLabel="Search stories"
            style={[styles.input, { color: theme.text }]}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} style={[styles.clearBtn, { backgroundColor: theme.surface2 }]}>
              <Text style={[styles.clearText, { color: theme.textDim }]}>✕</Text>
            </Pressable>
          ) : null}
        </View>
        <FlatList
          horizontal
          data={genres}
          keyExtractor={(g) => g}
          showsHorizontalScrollIndicator={false}
          style={styles.genres}
          contentContainerStyle={styles.genresContent}
          renderItem={({ item }) => (
            <SelectableChip label={item} selected={genre === item} onPress={() => setGenre(item)} />
          )}
        />
        <View style={styles.sorts}>
          {(['Recommended', 'Newest', 'Popular'] as Sort[]).map((s) => (
            <SelectableChip key={s} label={s} selected={sort === s} onPress={() => setSort(s)} />
          ))}
        </View>
        <View style={[styles.divider, { backgroundColor: withAlpha(theme.border, 0.6) }]} />
        <Text style={[styles.count, { color: theme.textFaint }]}>
          {results.length} {results.length === 1 ? 'story' : 'stories'}
          {genre !== 'All' ? ` • ${genre}` : ''} {query ? `• “${query}”` : ''}
        </Text>
      </View>
      {results.length === 0 ? (
        <EmptyState emoji="◎" title="No stories found" subtitle="Try another search — new stories arrive in the catalog automatically." />
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
                  (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate('StoryDetail', {
                    storyId: item.id,
                  })
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
  header: { paddingHorizontal: 18, paddingTop: 8, gap: 8 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.title, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginTop: 8,
  },
  searchIcon: { fontSize: 16 },
  input: { flex: 1, fontSize: 15, paddingVertical: 10 },
  clearBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 12, fontWeight: '800' },
  genres: { marginTop: 10, marginHorizontal: -4 },
  genresContent: { paddingRight: 18 },
  sorts: { flexDirection: 'row', marginTop: 10, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 14 },
  count: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2, marginTop: 10 },
  list: { padding: 18, gap: 12, paddingBottom: 24 },
  item: { marginBottom: 2 },
});
