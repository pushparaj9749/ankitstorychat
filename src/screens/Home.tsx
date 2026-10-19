/**
 * KISSA v2.7 — Home ("Kissa Noir")
 *
 *   "Hi <name> 👋" header (search + profile) → story bubbles (in-progress,
 *   new, popular) → category chips → FEATURED carousel → continue (progress
 *   ring) → Top 10 on Kissa → for you → more like X → genre rails
 *   → more stories (2-col poster wall, paged) → explore-all card
 *
 * Picking a category swaps the rails for a full 2-column poster wall of that
 * category, so the page is always full of artwork — never a short list
 * followed by empty screen.
 *
 * Artwork is never cropped: every frame is filled by ArtBackdrop around the
 * contain-fitted cover (see StoryCard).
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, StoryMeta } from '../types';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { Screen } from '../components/Screen';
import { ContinueCard, GridCard, HeroCard, PosterGrid, RankCard, StoryBubble } from '../components/StoryCard';
import { IconButton, SectionHeader, SelectableChip } from '../components/bits';
import { EmptyState } from '../components/states';
import { Icon, ICON_SIZE } from '../components/icons';
import { LAYOUT, RADIUS, SCALE, SPACING, TOUCH, withAlpha } from '../theme';
import { timeAgo } from '../lib/utils';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

const HOME_CATEGORIES = ['For you', 'New', 'Popular', 'Romance', 'Mystery', 'Drama', 'Fantasy', 'Horror', 'Sci-Fi'];
const CONTENT_MAX = LAYOUT.contentMaxWidth + 120;
const SLIDE_GAP = 12;
const CONTINUE_W = 300;

/* ------------------------------------------------------------------ rails */
// Virtualised horizontal rails: only the cards near the viewport are mounted
// (they used to be plain ScrollViews that mounted every card on the page).
const storyKey = (s: StoryMeta) => s.id;
const RAIL_PERF = {
  initialNumToRender: 3,
  maxToRenderPerBatch: 3,
  windowSize: 5,
  removeClippedSubviews: Platform.OS === 'android',
  showsHorizontalScrollIndicator: false,
  decelerationRate: 'fast' as const,
};

const Rail = memo(function Rail({ data, onOpen }: { data: StoryMeta[]; onOpen: (id: string) => void }) {
  const renderItem = useCallback(({ item }: { item: StoryMeta }) => <GridCard meta={item} onPress={() => onOpen(item.id)} />, [onOpen]);
  return <FlatList horizontal data={data} keyExtractor={storyKey} renderItem={renderItem} contentContainerStyle={styles.railList} {...RAIL_PERF} />;
});

const RankRail = memo(function RankRail({ data, onOpen }: { data: StoryMeta[]; onOpen: (id: string) => void }) {
  const renderItem = useCallback(
    ({ item, index }: { item: StoryMeta; index: number }) => <RankCard meta={item} rank={index + 1} onPress={() => onOpen(item.id)} />,
    [onOpen],
  );
  return <FlatList horizontal data={data} keyExtractor={storyKey} renderItem={renderItem} contentContainerStyle={styles.rankList} {...RAIL_PERF} />;
});

/** Category grids render in pages as you scroll instead of all stories at once. */
const GRID_PAGE = 12;

export function Home({ navigation }: Props) {
  const { theme, profile, stories, recentPlaythroughs, favoriteIds } = useApp();
  const { handleScroll } = useNavScroll();
  const { width: windowW } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState('For you');
  const [slide, setSlide] = useState(0);
  const [gridLimit, setGridLimit] = useState(GRID_PAGE);
  useEffect(() => setGridLimit(GRID_PAGE), [selectedCategory]);

  const contentW = Math.min(windowW, CONTENT_MAX);
  const slideW = contentW - SPACING.page * 2;

  const byId = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);
  const popular = useMemo(() => [...stories].sort((a, b) => b.popularity - a.popularity), [stories]);

  const activeRecent = useMemo(
    () => recentPlaythroughs.filter((p) => p.status === 'active' && byId.has(p.storyId)).slice(0, 5),
    [recentPlaythroughs, byId],
  );

  /** Carousel: tonight's lead first, then the most-played stories. */
  const slides = useMemo(() => {
    const lead = stories.find((s) => s.featured) ?? popular[0];
    if (!lead) return [];
    return [lead, ...popular.filter((s) => s.id !== lead.id)].slice(0, 5);
  }, [stories, popular]);

  const topTen = useMemo(() => popular.slice(0, 10), [popular]);
  const recommended = useMemo(() => {
    const shown = new Set(slides.map((s) => s.id));
    const rest = popular.filter((s) => !shown.has(s.id));
    return (rest.length >= 4 ? rest : popular).slice(0, 10);
  }, [popular, slides]);

  const filteredStories = useMemo(() => {
    if (selectedCategory === 'Popular') return popular;
    if (selectedCategory === 'New') return [...stories].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return stories.filter((s) => s.genres.includes(selectedCategory));
  }, [stories, popular, selectedCategory]);

  /** "Because you liked X" — from favourites, then the latest journey. No invented data. */
  const becauseOf = useMemo(() => {
    const favId = [...(favoriteIds ?? [])].find((id) => byId.has(id));
    const recentId = activeRecent[0]?.storyId;
    const seed = (favId && byId.get(favId)) || (recentId ? byId.get(recentId) : undefined);
    if (!seed) return null;
    for (const genre of seed.genres) {
      const peers = stories.filter((s) => s.id !== seed.id && s.genres.includes(genre)).slice(0, 8);
      if (peers.length >= 2) return { seed, genre, peers };
    }
    return null;
  }, [favoriteIds, activeRecent, byId, stories]);

  /** Genre rails: the biggest genres in the catalogue, each with ≥3 stories. */
  const genreRails = useMemo(() => {
    const counts = new Map<string, StoryMeta[]>();
    stories.forEach((s) => s.genres.forEach((g) => counts.set(g, [...(counts.get(g) ?? []), s])));
    return [...counts.entries()]
      .filter(([g, list]) => list.length >= 3 && g !== becauseOf?.genre)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
      .map(([genre, list]) => ({ genre, list: [...list].sort((a, b) => b.popularity - a.popularity).slice(0, 10) }));
  }, [stories, becauseOf]);

  const firstName = (profile?.nickname ?? '').trim().split(/\s+/)[0] ?? '';
  const subline = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 23 || h < 5) return 'Still awake? Ek kahani ho jaaye.';
    if (h < 12) return 'Good morning. Aaj kaunsi kahani?';
    if (h < 17) return 'Thoda break, thodi kahani?';
    return 'Aaj shaam kaunsi kahani?';
  }, []);

  /** Story bubbles: journeys in progress first (rose ring), then new, then popular. */
  const bubbles = useMemo(() => {
    const seen = new Set<string>();
    const out: { meta: StoryMeta; active: boolean }[] = [];
    const push = (m: StoryMeta | undefined, active: boolean) => {
      if (!m || seen.has(m.id)) return;
      seen.add(m.id);
      out.push({ meta: m, active });
    };
    activeRecent.forEach((p) => push(byId.get(p.storyId), true));
    stories.filter((s) => s.isNew).forEach((s, i) => push(s, i < 2));
    popular.forEach((s) => push(s, false));
    return out.slice(0, 12);
  }, [activeRecent, byId, stories, popular]);

  /** "More stories" wall under the rails: everything, most-played first, paged. */
  const moreStories = popular;

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

  const onSlideScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / (slideW + SLIDE_GAP));
      if (i !== slide) setSlide(Math.max(0, Math.min(slides.length - 1, i)));
    },
    [slideW, slide, slides.length],
  );

  const pagedSource = selectedCategory === 'For you' ? moreStories : filteredStories;
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScroll(e);
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      if (contentOffset.y + layoutMeasurement.height > contentSize.height - 700) {
        setGridLimit((n) => (n < pagedSource.length ? n + GRID_PAGE : n));
      }
    },
    [handleScroll, pagedSource.length],
  );
  const gridStories = useMemo(() => pagedSource.slice(0, gridLimit), [pagedSource, gridLimit]);

  if (!stories.length) {
    return (
      <Screen>
        <EmptyState icon="book-outline" title="No stories yet" subtitle="Stories arrive automatically. Check your connection." />
      </Screen>
    );
  }

  const forYou = selectedCategory === 'For you';
  const initial = firstName?.[0]?.toUpperCase() ?? 'K';

  const rail = (data: StoryMeta[]) => <Rail data={data} onOpen={openStory} />;

  return (
    <Screen padded={false}>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.topBar}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.hello, { color: theme.text }]} numberOfLines={1}>
                {firstName ? `Hi ${firstName} 👋` : 'Hi 👋'}
              </Text>
              <Text style={[styles.subline, { color: theme.textFaint }]} numberOfLines={1}>
                {subline}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <IconButton name="search" accessibilityLabel="Search stories" onPress={() => navigation.navigate('Discover')} />
              <Pressable
                onPress={() => navigation.navigate('Settings')}
                accessibilityRole="button"
                accessibilityLabel="Your profile"
                style={({ pressed }) => [
                  styles.avatar,
                  { backgroundColor: theme.surface3, borderColor: theme.border, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.avatarLetter, { color: theme.text }]}>{initial}</Text>
              </Pressable>
            </View>
          </View>

          {/* Story bubbles */}
          {bubbles.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bubbles} style={styles.bubblesWrap}>
              {bubbles.map(({ meta, active }) => (
                <StoryBubble
                  key={meta.id}
                  meta={meta}
                  active={active}
                  label={(meta.characters?.[0] ?? meta.title).split(/\s+/)[0]}
                  onPress={() => openStory(meta.id)}
                />
              ))}
            </ScrollView>
          ) : null}

          {/* Categories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll} style={styles.categoriesWrap}>
            {HOME_CATEGORIES.map((cat) => (
              <SelectableChip key={cat} label={cat} selected={selectedCategory === cat} onPress={() => setSelectedCategory(cat)} />
            ))}
          </ScrollView>

          {forYou ? (
            <>
              {/* Hero carousel */}
              {slides.length > 0 ? (
                <View style={styles.heroWrap}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={slideW + SLIDE_GAP}
                    decelerationRate="fast"
                    disableIntervalMomentum
                    onScroll={onSlideScroll}
                    scrollEventThrottle={32}
                    contentContainerStyle={styles.heroScroll}
                  >
                    {slides.map((s, i) => (
                      <HeroCard
                        key={s.id}
                        meta={s}
                        width={slideW}
                        kicker={i === 0 ? 'FEATURED' : 'TRENDING'}
                        onPress={() => openStory(s.id)}
                      />
                    ))}
                  </ScrollView>
                  {slides.length > 1 ? (
                    <View style={styles.dots}>
                      {slides.map((s, i) =>
                        i === slide ? (
                          <View key={s.id} style={[styles.dot, styles.dotOn, { backgroundColor: theme.text }]} />
                        ) : (
                          <View key={s.id} style={[styles.dot, { backgroundColor: withAlpha(theme.text, 0.2) }]} />
                        ),
                      )}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Continue */}
              {activeRecent.length > 0 ? (
                <View>
                  <View style={styles.sectionPad}>
                    <SectionHeader title="Continue" kicker={`${activeRecent.length} active`} action="Library" onAction={() => navigation.navigate('Library')} />
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.stripScroll}
                    snapToInterval={CONTINUE_W + 12}
                    decelerationRate="fast"
                  >
                    {activeRecent.map((p) => {
                      const meta = byId.get(p.storyId)!;
                      return (
                        <View key={p.id} style={{ width: activeRecent.length === 1 ? slideW : CONTINUE_W }}>
                          <ContinueCard meta={meta} progress={p.progress} subtitle={`${p.label} • ${timeAgo(p.updatedAt)}`} onPress={() => openChat(p.id)} />
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* Top 10 */}
              {topTen.length >= 3 ? (
                <>
                  <View style={styles.sectionPad}>
                    <SectionHeader title="Top 10 on Kissa" kicker="This week" />
                  </View>
                  <RankRail data={topTen} onOpen={openStory} />
                </>
              ) : null}

              {/* For you */}
              <View style={styles.sectionPad}>
                <SectionHeader title="For you" kicker="Recommended" action="See all" onAction={() => navigation.navigate('Discover')} />
              </View>
              {rail(recommended)}

              {/* Because you liked X */}
              {becauseOf ? (
                <>
                  <View style={styles.sectionPad}>
                    <SectionHeader title={`More like ${becauseOf.seed.title}`} kicker={becauseOf.genre} />
                  </View>
                  {rail(becauseOf.peers)}
                </>
              ) : null}

              {/* Genre rails */}
              {genreRails.map(({ genre, list }) => (
                <View key={genre}>
                  <View style={styles.sectionPad}>
                    <SectionHeader
                      title={genre}
                      kicker={`${list.length} stories`}
                      action="See all"
                      onAction={() => navigation.navigate('Discover', { genre })}
                    />
                  </View>
                  {rail(list)}
                </View>
              ))}

              {/* More stories wall */}
              <View style={styles.sectionPad}>
                <SectionHeader title="More stories" kicker={`${stories.length} stories`} action="Explore" onAction={() => navigation.navigate('Discover')} />
                <PosterGrid stories={gridStories} onOpen={openStory} />
              </View>

              {/* Explore all */}
              <View style={styles.sectionPad}>
                <Pressable
                  onPress={() => navigation.navigate('Discover')}
                  accessibilityRole="button"
                  accessibilityLabel={`Explore all ${stories.length} stories`}
                  style={({ pressed }) => [
                    styles.exploreCard,
                    { backgroundColor: theme.surface, borderColor: theme.border, transform: [{ scale: pressed ? 0.985 : 1 }] },
                  ]}
                >
                  <View style={[styles.exploreIcon, { backgroundColor: theme.primarySoft }]}>
                    <Icon name="compass" size={ICON_SIZE.lg} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exploreTitle, { color: theme.text }]}>Explore all {stories.length} stories</Text>
                    <Text style={[styles.exploreSub, { color: theme.textFaint }]}>Romance, mystery, drama aur bahut kuch.</Text>
                  </View>
                  <Icon name="chevron-forward" size={ICON_SIZE.md} color={theme.textDim} />
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.sectionPad}>
              <SectionHeader
                title={selectedCategory}
                kicker={`${filteredStories.length} ${filteredStories.length === 1 ? 'story' : 'stories'}`}
                action="Explore"
                onAction={() =>
                  navigation.navigate(
                    'Discover',
                    selectedCategory === 'New' || selectedCategory === 'Popular' ? undefined : { genre: selectedCategory },
                  )
                }
              />
              {filteredStories.length > 0 ? (
                <PosterGrid stories={gridStories} onOpen={openStory} />
              ) : (
                <EmptyState icon="search" title={`No ${selectedCategory} stories yet`} subtitle="New stories arrive automatically." />
              )}
            </View>
          )}

          <View style={{ height: LAYOUT.navClearance }} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 8 },
  content: { width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.page, paddingTop: 10 },
  hello: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.6 },
  subline: { fontSize: SCALE.small, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: TOUCH.sm + 2,
    height: TOUCH.sm + 2,
    borderRadius: (TOUCH.sm + 2) / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 15, fontWeight: '700' },
  bubblesWrap: { marginTop: SPACING.lg },
  bubbles: { paddingHorizontal: SPACING.page - 4, gap: 6 },
  categoriesWrap: { marginTop: SPACING.lg },
  categoriesScroll: { paddingHorizontal: SPACING.page },
  sectionPad: { paddingHorizontal: SPACING.page },
  heroWrap: { marginTop: SPACING.lg },
  heroScroll: { paddingHorizontal: SPACING.page, gap: SLIDE_GAP },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 18 },
  stripScroll: { paddingHorizontal: SPACING.page, gap: 12 },
  railList: { paddingHorizontal: SPACING.page, gap: 12, paddingBottom: 6 },
  rankList: { paddingHorizontal: SPACING.page + 6, gap: 18, paddingBottom: 6 },
  exploreCard: {
    marginTop: SPACING.xxl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  exploreIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  exploreSub: { fontSize: SCALE.caption, marginTop: 3 },
});
