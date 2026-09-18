/**
 * KISSA v4.2 — Home Screen
 * Completely rebuilt from scratch, original identity.
 * - Editorial brand header (KISSA wordmark)
 * - Horizontally scrollable discovery categories (For You, New, Popular, genres)
 * - Large cinematic featured story (artwork dominates, title, hook, START CHAT)
 * - Continue Your Journey horizontal cards
 * - Discover grid/list with artwork-first cards
 * - Smart header + bottom nav auto-hide via NavScrollContext
 * - Natural image ratios preserved everywhere
 */
import React, { useMemo, useState, useCallback } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, StoryMeta } from '../types';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { Screen } from '../components/Screen';
import { ContinueCard, GridCard, HeroCard } from '../components/StoryCard';
import { SectionHeader, SelectableChip } from '../components/bits';
import { EmptyState } from '../components/states';
import { SPACING, TYPE, KISSA } from '../theme';
import { greetingForHour, timeAgo } from '../lib/utils';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

const HOME_CATEGORIES = ['For You', 'New', 'Popular', 'Fantasy', 'Mystery', 'Romance', 'Drama', 'Horror', 'Sci-Fi', 'Mythology'];

export function Home({ navigation }: Props) {
  const { theme, profile, stories, recentPlaythroughs, favoriteIds } = useApp();
  const { handleScroll } = useNavScroll();
  const [selectedCategory, setSelectedCategory] = useState('For You');

  const byId = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);

  const activeRecent = useMemo(
    () => recentPlaythroughs.filter((p) => p.status === 'active' && byId.has(p.storyId)).slice(0, 5),
    [recentPlaythroughs, byId],
  );

  const featured = useMemo(() => stories.find((s) => s.featured) ?? stories[0], [stories]);

  const filteredStories = useMemo(() => {
    if (selectedCategory === 'For You') return [...stories].sort((a, b) => b.popularity - a.popularity);
    if (selectedCategory === 'Popular') return [...stories].sort((a, b) => b.popularity - a.popularity);
    if (selectedCategory === 'New') return [...stories].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return stories.filter((s) => s.genres.includes(selectedCategory));
  }, [stories, selectedCategory]);

  const recommended = useMemo(() => [...stories].sort((a, b) => b.popularity - a.popularity).slice(0, 8), [stories]);
  const newStories = useMemo(() => stories.filter((s) => s.isNew).slice(0, 4), [stories]);

  const greeting = greetingForHour(new Date().getHours(), profile?.nickname ?? '');
  const firstName = profile?.nickname ?? 'there';

  const openStory = useCallback(
    (id: string) => {
      (navigation as any).navigate('StoryDetail', { storyId: id });
    },
    [navigation],
  );

  const openChat = useCallback(
    (playthroughId: string) => {
      (navigation as any).navigate('Chat', { playthroughId });
    },
    [navigation],
  );

  if (!stories.length) {
    return (
      <Screen>
        <EmptyState emoji="◐" title="No stories yet" subtitle="Stories arrive automatically. Check your connection." />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView onScroll={handleScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Brand Header */}
        <View style={styles.topHeader}>
          <View style={styles.brandRow}>
            <View style={[styles.brandMark, { backgroundColor: theme.text }]}>
              <Text style={[styles.brandMarkText, { color: theme.bg }]}>K</Text>
            </View>
            <View>
              <Text style={[styles.brandText, { color: theme.text }]}>{KISSA.wordmark}</Text>
              <Text style={[styles.brandTag, { color: theme.textFaint }]}>{KISSA.tagline}</Text>
            </View>
          </View>

          <View style={styles.greetingWrap}>
            <Text style={[styles.greetingSub, { color: theme.textFaint }]}>{greeting.toUpperCase()}</Text>
            <Text style={[styles.greetingName, { color: theme.text }]} numberOfLines={1}>
              {firstName}
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('Discover')}
            accessibilityRole="search"
            style={[styles.searchTrigger, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[styles.searchIcon, { color: theme.textFaint }]}>⌕</Text>
            <Text style={[styles.searchText, { color: theme.textFaint }]}>Search stories, characters…</Text>
          </Pressable>
        </View>

        {/* Categories */}
        <View style={styles.categoriesWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {HOME_CATEGORIES.map((cat) => (
              <SelectableChip key={cat} label={cat} selected={selectedCategory === cat} onPress={() => setSelectedCategory(cat)} />
            ))}
          </ScrollView>
        </View>

        {/* Continue Journey */}
        {activeRecent.length > 0 && selectedCategory === 'For You' ? (
          <View style={styles.sectionPad}>
            <SectionHeader title="Continue your journey" kicker={`${activeRecent.length} active`} action="Library" onAction={() => navigation.navigate('Library')} />
            {activeRecent.map((p) => {
              const meta = byId.get(p.storyId)!;
              return (
                <View key={p.id} style={styles.gap}>
                  <ContinueCard meta={meta} progress={p.progress} subtitle={`${p.label} • ${timeAgo(p.updatedAt)}`} onPress={() => openChat(p.id)} />
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Featured */}
        {featured && (selectedCategory === 'For You' || selectedCategory === 'Popular') ? (
          <View style={styles.sectionPad}>
            <SectionHeader title="Tonight's lead" kicker="Featured" />
            <HeroCard meta={featured} onPress={() => openStory(featured.id)} />
          </View>
        ) : null}

        {/* Rail */}
        <View style={styles.sectionPad}>
          <SectionHeader
            title={selectedCategory === 'For You' ? 'For you' : selectedCategory}
            kicker="Recommended"
            action="Explore"
            onAction={() => navigation.navigate('Discover', selectedCategory !== 'For You' ? { genre: selectedCategory } : undefined)}
          />
        </View>
        <FlatList
          horizontal
          data={selectedCategory === 'For You' ? recommended : filteredStories}
          keyExtractor={(s) => s.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railList}
          renderItem={({ item }) => (
            <View style={styles.railItem}>
              <GridCard meta={item} onPress={() => openStory(item.id)} />
            </View>
          )}
        />

        {/* New */}
        {newStories.length > 0 && selectedCategory === 'For You' ? (
          <View style={styles.sectionPad}>
            <SectionHeader title="New arrivals" kicker="Fresh" />
            {newStories.slice(0, 3).map((s) => (
              <View key={s.id} style={styles.gap}>
                <ContinueCard meta={s} progress={0} subtitle={s.tagline} onPress={() => openStory(s.id)} />
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ height: SPACING.xxxl + 40 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16 },
  topHeader: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    fontSize: 14,
    fontWeight: '900',
  },
  brandText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  brandTag: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  greetingWrap: {
    marginTop: 18,
    marginBottom: 12,
  },
  greetingSub: {
    ...TYPE.tiny,
    letterSpacing: 1.2,
    fontWeight: '700' as const,
  },
  greetingName: {
    ...TYPE.display,
    marginTop: 2,
  },
  searchTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  searchIcon: { fontSize: 16, fontWeight: '500' },
  searchText: { flex: 1, fontSize: 13, letterSpacing: 0.1 },
  categoriesWrap: { marginTop: 14, marginBottom: 4 },
  categoriesScroll: { paddingHorizontal: 18 },
  sectionPad: { paddingHorizontal: 18 },
  gap: { marginBottom: 10 },
  railList: { paddingHorizontal: 18 },
  railItem: { marginRight: 12 },
});
