/**
 * KISSA v2.4.2 — Discover / Search
 * Editorial search, genre filters, natural-ratio cards.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { Screen } from '../components/Screen';
import { WideCard } from '../components/StoryCard';
import { SelectableChip } from '../components/bits';
import { EmptyState } from '../components/states';
import { Icon, ICON_SIZE } from '../components/icons';
import { LAYOUT, RADIUS, SCALE, SPACING, TOUCH, TYPE, withAlpha } from '../theme';
import { searchStories } from '../lib/search';

type Props = BottomTabScreenProps<MainTabParamList, 'Discover'>;
type Sort = 'Recommended' | 'Newest' | 'Popular';

export function Discover({ navigation, route }: Props) {
  const { theme, stories } = useApp();
  const { handleScroll } = useNavScroll();
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<string>('All');
  const [sort, setSort] = useState<Sort>('Recommended');

  useEffect(() => {
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
      <View style={[styles.header, styles.container]}>
        <Text style={[styles.kicker, { color: theme.accent }]}>EXPLORE</Text>
        <Text style={[styles.title, { color: theme.text }]}>Find your next story</Text>

        <View style={[styles.searchWrap, { backgroundColor: withAlpha(theme.surface2, 0.72), borderColor: theme.border }]}>
          <Icon name="search" size={ICON_SIZE.sm} color={theme.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Story, character or mood"
            placeholderTextColor={theme.textFaint}
            style={[styles.input, { color: theme.text }]}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} style={[styles.clearBtn, { backgroundColor: theme.surface2 }]}>
              <Icon name="close" size={12} color={theme.textDim} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genres} contentContainerStyle={styles.genresContent}>
          {genres.map((item) => (
            <SelectableChip key={item} label={item} selected={genre === item} onPress={() => setGenre(item)} />
          ))}
        </ScrollView>

        <View style={styles.sorts}>
          {(['Recommended', 'Newest', 'Popular'] as Sort[]).map((s) => (
            <SelectableChip key={s} label={s} selected={sort === s} onPress={() => setSort(s)} />
          ))}
        </View>

        <View style={[styles.divider, { backgroundColor: withAlpha(theme.border, 0.6) }]} />
        <Text style={[styles.count, { color: theme.textDim }]}>
          {results.length} {results.length === 1 ? 'story' : 'stories'}
          {genre !== 'All' ? ` · ${genre}` : ''} {query ? `· “${query}”` : ''}
        </Text>
      </View>

      {results.length === 0 ? (
        <EmptyState icon="search" title="No stories found" subtitle="Try another term or genre." />
      ) : (
        <FlatList
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.container}
          data={results}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <WideCard meta={item} onPress={() => (navigation as any).navigate('StoryDetail', { storyId: item.id })} />
            </View>
          )}
          ListFooterComponent={<View style={{ height: SPACING.xxxl + 32 }} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: LAYOUT.contentMaxWidth + 120, alignSelf: 'center' },
  header: { paddingHorizontal: SPACING.page, paddingTop: 8, gap: 6 },
  kicker: { fontSize: SCALE.micro, letterSpacing: 1.4, fontWeight: '900' as const, marginTop: 4 },
  title: { ...TYPE.displaySmall, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    minHeight: TOUCH.min,
    marginTop: 10,
  },
  input: { flex: 1, fontSize: 14.5, paddingVertical: 10 },
  clearBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  genres: { marginTop: 14, marginHorizontal: -4 },
  genresContent: { paddingRight: SPACING.page },
  sorts: { flexDirection: 'row', marginTop: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 16 },
  count: { fontSize: SCALE.caption, fontWeight: '700', letterSpacing: 0.2, marginTop: 9 },
  list: { paddingHorizontal: SPACING.page, paddingTop: 12, gap: 12 },
  item: { marginBottom: 2 },
});
