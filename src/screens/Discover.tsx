/**
 * Discover / Search Screen — Redesigned for Kissa v2.4.1.
 *
 * Features:
 *  - Large rounded frosted search bar
 *  - Genre & Category filters carousel
 *  - Sort options (Recommended, Newest, Popular)
 *  - Natural-ratio story cards (WideCard)
 *  - Clean empty state & clear actions
 *  - Direction-aware scroll handling
 */
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
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
  const { handleScroll } = useNavScroll();
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
        <Text style={[styles.kicker, { color: theme.accent }]}>EXPLORE UNIVERSE</Text>
        <Text style={[styles.title, { color: theme.text }]}>Find your next story</Text>

        {/* Large Rounded Search Bar */}
        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: withAlpha(theme.surface, 0.94),
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.searchIcon, { color: theme.accent }]}>⌕</Text>
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
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              style={[styles.clearBtn, { backgroundColor: theme.surface2 }]}
            >
              <Text style={[styles.clearText, { color: theme.textDim }]}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Genre filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.genres}
          contentContainerStyle={styles.genresContent}
        >
          {genres.map((item) => (
            <SelectableChip
              key={item}
              label={item}
              selected={genre === item}
              onPress={() => setGenre(item)}
            />
          ))}
        </ScrollView>

        {/* Sort filters */}
        <View style={styles.sorts}>
          {(['Recommended', 'Newest', 'Popular'] as Sort[]).map((s) => (
            <SelectableChip
              key={s}
              label={s}
              selected={sort === s}
              onPress={() => setSort(s)}
            />
          ))}
        </View>

        <View style={[styles.divider, { backgroundColor: withAlpha(theme.border, 0.6) }]} />
        <Text style={[styles.count, { color: theme.textFaint }]}>
          {results.length} {results.length === 1 ? 'story' : 'stories'}
          {genre !== 'All' ? ` • ${genre}` : ''} {query ? `• “${query}”` : ''}
        </Text>
      </View>

      {results.length === 0 ? (
        <EmptyState
          emoji="⌕"
          title="No stories found"
          subtitle="Try another search term or select a different genre category."
        />
      ) : (
        <FlatList
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
          ListFooterComponent={<View style={{ height: SPACING.xxxl + 32 }} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 6,
  },
  kicker: {
    ...TYPE.overline,
    marginTop: 4,
  },
  title: {
    ...TYPE.title,
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginTop: 6,
  },
  searchIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  clearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontSize: 11,
    fontWeight: '800',
  },
  genres: {
    marginTop: 10,
    marginHorizontal: -4,
  },
  genresContent: {
    paddingRight: 18,
  },
  sorts: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 12,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 8,
  },
  list: {
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 14,
  },
  item: {
    marginBottom: 2,
  },
});
