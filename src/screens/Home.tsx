/**
 * KISSA v2.5.2 — Home
 * One focal point, then everything else in support:
 *
 *   brand bar → greeting + one clear question → search → categories
 *   → TONIGHT'S LEAD (hero artwork) → continue playing → for you
 *   → because you liked X → new arrivals
 *
 * Layout rules of this pass:
 *  - every section is separated by real breathing room (SPACING tokens)
 *  - rails use fixed art frames so mixed cover ratios share one baseline
 *  - type comes from the canonical scale (no sub-11px labels)
 *  - content is capped at LAYOUT.contentMaxWidth and centred on tablets
 *  - copyright: artwork is never cropped (NaturalImage rules apply)
 */
import React, { useMemo, useState, useCallback } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, StoryMeta } from '../types';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { Screen } from '../components/Screen';
import { ContinueCard, GridCard, HeroCard } from '../components/StoryCard';
import { IconButton, SectionHeader, SelectableChip } from '../components/bits';
import { EmptyState } from '../components/states';
import { Icon, ICON_SIZE } from '../components/icons';
import { KISSA_LOGO } from '../components/brand';
import { KISSA, LAYOUT, RADIUS, SCALE, SPACING, TOUCH, TYPE, withAlpha } from '../theme';
import { greetingForHour, timeAgo } from '../lib/utils';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

const HOME_CATEGORIES = ['For you', 'New', 'Popular', 'Romance', 'Mystery', 'Drama', 'Fantasy', 'Horror', 'Sci-Fi'];

const RAIL_ITEM = 156 + 13; // card width + gap — snapped rail scrolling

export function Home({ navigation }: Props) {
  const { theme, profile, stories, recentPlaythroughs, favoriteIds } = useApp();
  const { handleScroll } = useNavScroll();
  const [selectedCategory, setSelectedCategory] = useState('For you');

  const byId = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);

  const activeRecent = useMemo(
    () => recentPlaythroughs.filter((p) => p.status === 'active' && byId.has(p.storyId)).slice(0, 5),
    [recentPlaythroughs, byId],
  );

  const featured = useMemo(() => stories.find((s) => s.featured) ?? stories[0], [stories]);

  const filteredStories = useMemo(() => {
    if (selectedCategory === 'For you') return [...stories].sort((a, b) => b.popularity - a.popularity);
    if (selectedCategory === 'Popular') return [...stories].sort((a, b) => b.popularity - a.popularity);
    if (selectedCategory === 'New') return [...stories].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return stories.filter((s) => s.genres.includes(selectedCategory));
  }, [stories, selectedCategory]);

  const recommended = useMemo(() => [...stories].sort((a, b) => b.popularity - a.popularity).slice(0, 10), [stories]);
  const newStories = useMemo(() => stories.filter((s) => s.isNew).slice(0, 4), [stories]);

  /**
   * "Because you liked X" — derived from what the reader actually did
   * (favourites first, then the most recently opened journey). No invented data.
   */
  const becauseOf = useMemo(() => {
    const favId = [...(favoriteIds ?? [])].find((id) => byId.has(id));
    const recentId = activeRecent[0]?.storyId;
    const seed = (favId && byId.get(favId)) || (recentId ? byId.get(recentId) : undefined);
    if (!seed) return null;
    // Pick the first genre of the seed that actually has peers to recommend.
    for (const genre of seed.genres) {
      const peers = stories.filter((s) => s.id !== seed.id && s.genres.includes(genre)).slice(0, 8);
      if (peers.length >= 2) return { seed, genre, peers };
    }
    return null;
  }, [favoriteIds, activeRecent, byId, stories]);

  const greeting = greetingForHour(new Date().getHours(), profile?.nickname ?? '');

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
        <EmptyState icon="book-outline" title="No stories yet" subtitle="Stories arrive automatically. Check your connection." />
      </Screen>
    );
  }

  const railData = selectedCategory === 'For you' ? recommended : filteredStories;

  return (
    <Screen padded={false}>
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Brand bar */}
          <View style={styles.topHeader}>
            <View style={styles.brandRow}>
              <Image source={KISSA_LOGO} style={styles.brandLogo} resizeMode="contain" accessibilityLabel="Kissa" />
              <View>
                <Text style={[styles.brandText, { color: theme.text }]}>{KISSA.wordmark}</Text>
                <Text style={[styles.brandTag, { color: theme.textFaint }]}>{KISSA.tagline}</Text>
              </View>
              <View style={styles.headerActions}>
                <IconButton
                  name="bookmark-outline"
                  accessibilityLabel="Your library"
                  onPress={() => navigation.navigate('Library')}
                />
                <Pressable
                  onPress={() => navigation.navigate('Settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Your profile"
                  style={({ pressed }) => [
                    styles.avatarBubble,
                    { opacity: pressed ? 0.75 : 1, borderColor: withAlpha(theme.primary, 0.4) },
                  ]}
                >
                  <Text style={styles.avatarLetter}>{profile?.nickname?.trim()?.[0]?.toUpperCase() ?? 'K'}</Text>
                </Pressable>
              </View>
            </View>

            {/* Greeting + one clear question */}
            <View style={styles.greetingWrap}>
              <Text style={[styles.greetingSub, { color: theme.accent }]}>{greeting.toUpperCase()}</Text>
              <Text style={[styles.greetingQuestion, { color: theme.text }]}>
                {activeRecent.length > 0 ? 'Continue your story,' : 'Which world today?'}
              </Text>
              <Text style={[styles.greetingHint, { color: theme.textDim }]}>
                {activeRecent.length > 0
                  ? `${activeRecent.length} ${activeRecent.length === 1 ? 'journey is' : 'journeys are'} waiting for you.`
                  : 'Hinglish stories where you decide every turn.'}
              </Text>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
              <Pressable
                onPress={() => navigation.navigate('Discover')}
                accessibilityRole="search"
                style={({ pressed }) => [
                  styles.searchTrigger,
                  {
                    backgroundColor: withAlpha(theme.surface2, 0.72),
                    borderColor: theme.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Icon name="search" size={ICON_SIZE.sm} color={theme.textFaint} />
                <Text style={[styles.searchText, { color: theme.textFaint }]}>Story, character or mood</Text>
              </Pressable>
              <IconButton
                name="options-outline"
                size={TOUCH.min}
                accessibilityLabel="Browse by genre"
                onPress={() => navigation.navigate('Discover')}
                tint={withAlpha(theme.primary, 0.14)}
                iconColor={theme.accent}
              />
            </View>
          </View>

          {/* Categories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
            style={styles.categoriesWrap}
          >
            {HOME_CATEGORIES.map((cat) => (
              <SelectableChip key={cat} label={cat} selected={selectedCategory === cat} onPress={() => setSelectedCategory(cat)} />
            ))}
          </ScrollView>

          {/* Tonight's lead — the one focal point of the screen */}
          {featured && (selectedCategory === 'For you' || selectedCategory === 'Popular') ? (
            <View style={styles.sectionPad}>
              <SectionHeader title="Tonight's lead" kicker="Featured" action="Explore" onAction={() => navigation.navigate('Discover')} />
              <HeroCard meta={featured} onPress={() => openStory(featured.id)} />
            </View>
          ) : null}

          {/* Continue — horizontal strip keeps the whole journey list reachable */}
          {activeRecent.length > 0 && selectedCategory === 'For you' ? (
            <View>
              <View style={styles.sectionPad}>
                <SectionHeader
                  title="Continue"
                  kicker={`${activeRecent.length} active`}
                  action="Library"
                  onAction={() => navigation.navigate('Library')}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stripScroll}
                snapToInterval={252 + 12}
                decelerationRate="fast"
              >
                {activeRecent.map((p) => {
                  const meta = byId.get(p.storyId)!;
                  return (
                    <View key={p.id} style={styles.stripItem}>
                      <ContinueCard
                        meta={meta}
                        progress={p.progress}
                        subtitle={`${p.label} • ${timeAgo(p.updatedAt)}`}
                        onPress={() => openChat(p.id)}
                      />
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* For you rail */}
          <View style={styles.sectionPad}>
            <SectionHeader
              title={selectedCategory === 'For you' ? 'For you' : selectedCategory}
              kicker="Recommended"
              action="See all"
              onAction={() =>
                navigation.navigate('Discover', selectedCategory !== 'For you' ? { genre: selectedCategory } : undefined)
              }
            />
          </View>
          <FlatList
            horizontal
            data={railData}
            keyExtractor={(s) => s.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.railList}
            snapToInterval={RAIL_ITEM}
            decelerationRate="fast"
            initialNumToRender={4}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews
            renderItem={({ item }) => (
              <View style={styles.railItem}>
                <GridCard meta={item} onPress={() => openStory(item.id)} />
              </View>
            )}
          />

          {/* Because you liked X — memory made visible */}
          {becauseOf && selectedCategory === 'For you' ? (
            <>
              <View style={styles.sectionPad}>
                <SectionHeader title={`Because you liked ${becauseOf.seed.title}`} kicker={becauseOf.genre} />
              </View>
              <FlatList
                horizontal
                data={becauseOf.peers}
                keyExtractor={(s) => s.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.railList}
                snapToInterval={RAIL_ITEM}
                decelerationRate="fast"
                initialNumToRender={4}
                maxToRenderPerBatch={6}
                windowSize={5}
                removeClippedSubviews
                renderItem={({ item }) => (
                  <View style={styles.railItem}>
                    <GridCard meta={item} onPress={() => openStory(item.id)} />
                  </View>
                )}
              />
            </>
          ) : null}

          {/* New arrivals */}
          {newStories.length > 0 && selectedCategory === 'For you' ? (
            <View style={styles.sectionPad}>
              <SectionHeader title="New arrivals" kicker="Fresh" />
              {newStories.slice(0, 3).map((s: StoryMeta) => (
                <View key={s.id} style={styles.gap}>
                  <ContinueCard meta={s} progress={0} subtitle={s.tagline} onPress={() => openStory(s.id)} />
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ height: SPACING.xxxl + 64 }} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16 },
  content: { width: '100%', maxWidth: LAYOUT.contentMaxWidth + 120, alignSelf: 'center' },
  topHeader: { paddingHorizontal: SPACING.page, paddingTop: 6 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 32, height: 32, borderRadius: RADIUS.sm },
  brandText: { fontSize: 14, fontWeight: '900', letterSpacing: 2.4 },
  brandTag: { fontSize: SCALE.micro, fontWeight: '700', letterSpacing: 1.1, marginTop: 1 },
  headerActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatarBubble: {
    width: TOUCH.sm,
    height: TOUCH.sm,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,251,245,0.06)',
  },
  avatarLetter: { fontSize: 14, fontWeight: '900', color: '#FFC2CC' },
  greetingWrap: { marginTop: SPACING.xl, marginBottom: SPACING.lg },
  greetingSub: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 1.4 },
  greetingQuestion: { ...TYPE.display, marginTop: 4 },
  greetingHint: { fontSize: SCALE.small, fontWeight: '500', marginTop: 5, lineHeight: 18 },
  searchRow: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  searchTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    minHeight: TOUCH.min,
  },
  searchText: { flex: 1, fontSize: SCALE.small, letterSpacing: 0.1 },
  categoriesWrap: { marginTop: SPACING.lg },
  categoriesScroll: { paddingHorizontal: SPACING.page },
  sectionPad: { paddingHorizontal: SPACING.page },
  gap: { marginBottom: 10 },
  stripScroll: { paddingHorizontal: SPACING.page, gap: 12 },
  stripItem: { width: 252 },
  railList: { paddingHorizontal: SPACING.page, gap: 13, paddingBottom: 4 },
  railItem: { marginRight: 0 },
});
