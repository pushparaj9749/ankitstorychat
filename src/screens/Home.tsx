/**
 * Home Screen — Completely Redesigned from Zero (Kissa v2.4.1).
 *
 * 100% Original Kissa Cinematic Visual Language:
 *  - Luminous branding & personalized greeting
 *  - Dynamic category selector carousel with instant filtering
 *  - Large cinematic featured story hero with "START CHAT" CTA
 *  - "Continue Journey" shelf for in-progress stories
 *  - "Shows for You" horizontal rail & curated story cards
 *  - Genre discovery shelf
 *  - Direction-aware auto-hide header & bottom navigation
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
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { Screen } from '../components/Screen';
import { ContinueCard, GridCard, HeroCard } from '../components/StoryCard';
import { SectionHeader, SelectableChip } from '../components/bits';
import { EmptyState } from '../components/states';
import { FONTS, GRADIENTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import { greetingForHour, timeAgo } from '../lib/utils';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

const HOME_CATEGORIES = [
  'For You',
  'Popular',
  'New',
  'Fantasy',
  'Mystery',
  'Romance',
  'Thriller',
  'Horror',
  'Drama',
  'Sci-Fi',
  'Mythology',
];

export function Home({ navigation }: Props) {
  const { theme, profile, stories, recentPlaythroughs, favoriteIds } = useApp();
  const { handleScroll } = useNavScroll();
  const [selectedCategory, setSelectedCategory] = useState('For You');

  const byId = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);

  const activeRecent = useMemo(
    () =>
      recentPlaythroughs
        .filter((p) => p.status === 'active' && byId.has(p.storyId))
        .slice(0, 4),
    [recentPlaythroughs, byId],
  );

  const featured = useMemo(
    () => stories.find((s) => s.featured) ?? stories[0],
    [stories],
  );

  const filteredStories = useMemo(() => {
    if (selectedCategory === 'For You') {
      return [...stories].sort((a, b) => b.popularity - a.popularity);
    }
    if (selectedCategory === 'Popular') {
      return [...stories].sort((a, b) => b.popularity - a.popularity);
    }
    if (selectedCategory === 'New') {
      return [...stories].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    }
    return stories.filter((s) => s.genres.includes(selectedCategory));
  }, [stories, selectedCategory]);

  const recommended = useMemo(
    () => [...stories].sort((a, b) => b.popularity - a.popularity).slice(0, 8),
    [stories],
  );

  const newStories = useMemo(
    () => stories.filter((s) => s.isNew).slice(0, 4),
    [stories],
  );

  const favorites = useMemo(
    () => stories.filter((s) => favoriteIds.has(s.id)),
    [stories, favoriteIds],
  );

  const greeting = greetingForHour(new Date().getHours(), profile?.nickname ?? '');
  const firstName = profile?.nickname ?? 'Explorer';

  if (!stories.length) {
    return (
      <Screen>
        <EmptyState
          emoji="✦"
          title="No stories yet"
          subtitle="Fresh stories arrive over the air automatically — check your connection and browse shows."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header: Kissa Wordmark + Greeting + Search Bar */}
        <View style={styles.topHeader}>
          <View style={styles.brandRow}>
            <LinearGradient colors={[...GRADIENTS.hero]} style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>✦</Text>
            </LinearGradient>
            <View>
              <Text style={[styles.brandText, { color: theme.text }]}>KISSA</Text>
              <Text style={[styles.brandTag, { color: theme.textFaint }]}>INTERACTIVE CINEMA</Text>
            </View>
          </View>

          <View style={styles.greetingWrap}>
            <Text style={[styles.greetingSub, { color: theme.accent }]}>
              {greeting.split(',')[0].toUpperCase()}
            </Text>
            <Text style={[styles.greetingName, { color: theme.text }]} numberOfLines={1}>
              {firstName}
            </Text>
          </View>

          {/* Glass Search Trigger */}
          <Pressable
            onPress={() => navigation.navigate('Discover')}
            accessibilityRole="search"
            accessibilityLabel="Search stories"
            style={({ pressed }) => [
              styles.searchBar,
              {
                backgroundColor: withAlpha(theme.surface, 0.94),
                borderColor: theme.border,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              },
              SHADOWS.card,
            ]}
          >
            <Text style={[styles.searchIcon, { color: theme.accent }]}>⌕</Text>
            <Text style={[styles.searchText, { color: theme.textFaint }]}>
              Search stories, genres, characters…
            </Text>
            <View
              style={[
                styles.searchCta,
                {
                  backgroundColor: withAlpha(theme.primary, 0.14),
                  borderColor: withAlpha(theme.primary, 0.22),
                },
              ]}
            >
              <Text style={[styles.searchCtaText, { color: theme.accent }]}>Explore</Text>
            </View>
          </Pressable>
        </View>

        {/* Discovery Categories Carousel */}
        <View style={styles.categoriesWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {HOME_CATEGORIES.map((cat) => (
              <SelectableChip
                key={cat}
                label={cat}
                selected={selectedCategory === cat}
                onPress={() => setSelectedCategory(cat)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Continue Journey Shelf */}
        {activeRecent.length > 0 && selectedCategory === 'For You' ? (
          <View style={styles.sectionPad}>
            <SectionHeader
              title="Continue Journey"
              kicker={`${activeRecent.length} active`}
              action="View all"
              onAction={() => navigation.navigate('Library')}
            />
            {activeRecent.map((p) => {
              const meta = byId.get(p.storyId)!;
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

        {/* Featured Story Hero Card */}
        {featured && (selectedCategory === 'For You' || selectedCategory === 'Popular') ? (
          <View style={styles.sectionPad}>
            <SectionHeader title="Tonight’s Lead" kicker="Featured Story" />
            <HeroCard
              meta={featured}
              onPress={() =>
                (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate('StoryDetail', {
                  storyId: featured.id,
                })
              }
            />
          </View>
        ) : null}

        {/* Filtered Stories / Shows for You Rail */}
        <View style={styles.sectionPad}>
          <SectionHeader
            title={selectedCategory === 'For You' ? 'Shows for You' : `${selectedCategory} Stories`}
            kicker="Recommended"
            action="See all"
            onAction={() =>
              navigation.navigate('Discover', selectedCategory !== 'For You' ? { genre: selectedCategory } : undefined)
            }
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

        {/* New Releases */}
        {newStories.length > 0 && selectedCategory === 'For You' ? (
          <View style={styles.sectionPad}>
            <SectionHeader title="New Releases" kicker="Fresh" />
            {newStories.slice(0, 3).map((s) => (
              <View key={s.id} style={styles.gap}>
                <ContinueCard
                  meta={s}
                  progress={0}
                  subtitle={s.tagline}
                  onPress={() =>
                    (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate('StoryDetail', {
                      storyId: s.id,
                    })
                  }
                />
              </View>
            ))}
          </View>
        ) : null}

        {/* Saved Stories */}
        {favorites.length > 0 && selectedCategory === 'For You' ? (
          <View style={styles.sectionPad}>
            <SectionHeader title="Saved in Library" kicker={`${favorites.length}`} />
            {favorites.slice(0, 3).map((s) => (
              <View key={s.id} style={styles.gap}>
                <ContinueCard
                  meta={s}
                  progress={0}
                  subtitle={s.genres.join(' • ')}
                  onPress={() =>
                    (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate('StoryDetail', {
                      storyId: s.id,
                    })
                  }
                />
              </View>
            ))}
          </View>
        ) : null}

        {/* Bottom padding for tab bar */}
        <View style={{ height: SPACING.xxxl + 32 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16 },
  topHeader: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  brandBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeText: {
    color: '#0E070B',
    fontSize: 15,
    fontWeight: '900',
  },
  brandText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2.8,
  },
  brandTag: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  greetingWrap: {
    marginTop: 14,
    marginBottom: 12,
  },
  greetingSub: {
    ...TYPE.overline,
    letterSpacing: 1.4,
  },
  greetingName: {
    ...TYPE.display,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 4,
  },
  searchIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchText: {
    flex: 1,
    fontSize: 13,
    letterSpacing: 0.1,
  },
  searchCta: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  searchCtaText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  categoriesWrap: {
    marginTop: 12,
    marginBottom: 4,
  },
  categoriesScroll: {
    paddingHorizontal: 18,
    gap: 0,
  },
  sectionPad: {
    paddingHorizontal: 18,
  },
  gap: {
    marginBottom: 10,
  },
  railList: {
    paddingHorizontal: 18,
    alignItems: 'flex-start',
  },
  railItem: {
    marginRight: 14,
  },
});
