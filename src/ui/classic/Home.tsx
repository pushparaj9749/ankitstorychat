/* KISSA classic template ("Kissa Night", pre-v2.7 UI) — kept so users can switch back in Settings → Appearance. */
/**
 * KISSA v2.6 — Home ("Kissa Night")
 *
 *   brand bar → greeting → search → category pills
 *   → HERO CAROUSEL (swipeable featured posters + page dots)
 *   → continue → Top 10 on Kissa (ranked posters) → for you
 *   → more like X → genre rails → new arrivals (2-col poster wall)
 *   → explore-all banner
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
  Image,
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
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, StoryMeta } from '../../types';
import { useApp } from '../../state/AppContext';
import { useNavScroll } from '../../navigation/NavScrollContext';
import { Screen } from '../../components/Screen';
import { ContinueCard, GridCard, HeroCard, PosterGrid, RankCard } from './StoryCard';
import { IconButton, SectionHeader, SelectableChip } from '../../components/bits';
import { EmptyState } from '../../components/states';
import { Icon, ICON_SIZE } from '../../components/icons';
import { KISSA_LOGO } from '../../components/brand';
import { GRADIENTS, KISSA, LAYOUT, RADIUS, SCALE, SHADOWS, SPACING, TOUCH, TYPE, withAlpha } from './theme';
import { greetingForHour, timeAgo } from '../../lib/utils';

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

  const newStories = useMemo(() => {
    const flagged = stories.filter((s) => s.isNew);
    const pool = flagged.length >= 2 ? flagged : [...stories].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return pool.slice(0, 4);
  }, [stories]);

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

  const onSlideScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / (slideW + SLIDE_GAP));
      if (i !== slide) setSlide(Math.max(0, Math.min(slides.length - 1, i)));
    },
    [slideW, slide, slides.length],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScroll(e);
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      if (contentOffset.y + layoutMeasurement.height > contentSize.height - 700) {
        setGridLimit((n) => (n < filteredStories.length ? n + GRID_PAGE : n));
      }
    },
    [handleScroll, filteredStories.length],
  );
  const gridStories = useMemo(() => filteredStories.slice(0, gridLimit), [filteredStories, gridLimit]);

  if (!stories.length) {
    return (
      <Screen>
        <EmptyState icon="book-outline" title="No stories yet" subtitle="Stories arrive automatically. Check your connection." />
      </Screen>
    );
  }

  const forYou = selectedCategory === 'For you';
  const initial = profile?.nickname?.trim()?.[0]?.toUpperCase() ?? 'K';

  const rail = (data: StoryMeta[]) => <Rail data={data} onOpen={openStory} />;

  return (
    <Screen padded={false}>
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Brand bar */}
          <View style={styles.topBar}>
            <Image source={KISSA_LOGO} style={styles.brandLogo} resizeMode="contain" accessibilityLabel="Kissa" />
            <View>
              <Text style={[styles.brandText, { color: theme.text }]}>{KISSA.wordmark}</Text>
              <Text style={[styles.brandTag, { color: theme.textFaint }]}>{KISSA.tagline}</Text>
            </View>
            <View style={styles.headerActions}>
              <IconButton name="bookmark-outline" accessibilityLabel="Your library" onPress={() => navigation.navigate('Library')} />
              <Pressable
                onPress={() => navigation.navigate('Settings')}
                accessibilityRole="button"
                accessibilityLabel="Your profile"
                style={({ pressed }) => [styles.avatarRing, { opacity: pressed ? 0.75 : 1 }]}
              >
                <LinearGradient colors={[...GRADIENTS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarGrad}>
                  <View style={[styles.avatarInner, { backgroundColor: theme.bg }]}>
                    <Text style={[styles.avatarLetter, { color: theme.text }]}>{initial}</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          {/* Greeting */}
          <View style={styles.greetingWrap}>
            <Text style={[styles.greetingSub, { color: theme.gold }]}>{greeting.toUpperCase()}</Text>
            <Text style={[styles.greetingQuestion, { color: theme.text }]}>
              {activeRecent.length > 0 ? 'Continue your story,' : 'Which world today?'}
            </Text>
          </View>

          {/* Search */}
          <View style={styles.searchRow}>
            <Pressable
              onPress={() => navigation.navigate('Discover')}
              accessibilityRole="search"
              style={({ pressed }) => [
                styles.searchTrigger,
                { backgroundColor: withAlpha(theme.surface2, 0.8), borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Icon name="search" size={ICON_SIZE.md} color={theme.textDim} />
              <Text style={[styles.searchText, { color: theme.textFaint }]}>Story, character or mood</Text>
              <View style={[styles.searchKbd, { backgroundColor: withAlpha(theme.primary, 0.16) }]}>
                <Icon name="options-outline" size={ICON_SIZE.sm} color={theme.accent} />
              </View>
            </Pressable>
          </View>

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
                        kicker={i === 0 ? "TONIGHT'S LEAD" : 'TRENDING NOW'}
                        onPress={() => openStory(s.id)}
                      />
                    ))}
                  </ScrollView>
                  {slides.length > 1 ? (
                    <View style={styles.dots}>
                      {slides.map((s, i) =>
                        i === slide ? (
                          <LinearGradient
                            key={s.id}
                            colors={[...GRADIENTS.primary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.dot, styles.dotOn]}
                          />
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

              {/* New arrivals wall */}
              {newStories.length > 0 ? (
                <View style={styles.sectionPad}>
                  <SectionHeader title="New arrivals" kicker="Fresh" />
                  <PosterGrid stories={newStories} onOpen={openStory} />
                </View>
              ) : null}

              {/* Explore all */}
              <View style={styles.sectionPad}>
                <Pressable
                  onPress={() => navigation.navigate('Discover')}
                  accessibilityRole="button"
                  accessibilityLabel={`Explore all ${stories.length} stories`}
                  style={({ pressed }) => [styles.exploreCard, SHADOWS.glowRose, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}
                >
                  <LinearGradient colors={[...GRADIENTS.hero]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <View style={styles.exploreIcon}>
                    <Icon name="compass" size={ICON_SIZE.lg} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exploreTitle}>Explore all {stories.length} stories</Text>
                    <Text style={styles.exploreSub}>Romance, mystery, drama aur bahut kuch.</Text>
                  </View>
                  <Icon name="chevron-forward" size={ICON_SIZE.md} color="#fff" />
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
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.page, paddingTop: 8 },
  brandLogo: { width: 36, height: 36, borderRadius: 11 },
  brandText: { fontSize: 15, fontWeight: '900', letterSpacing: 3 },
  brandTag: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, marginTop: 1 },
  headerActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarRing: { width: TOUCH.sm + 2, height: TOUCH.sm + 2 },
  avatarGrad: { flex: 1, borderRadius: (TOUCH.sm + 2) / 2, padding: 2 },
  avatarInner: { flex: 1, borderRadius: TOUCH.sm / 2, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 14, fontWeight: '900' },
  greetingWrap: { paddingHorizontal: SPACING.page, marginTop: SPACING.xl },
  greetingSub: { fontSize: SCALE.micro, fontWeight: '900', letterSpacing: 1.6 },
  greetingQuestion: { ...TYPE.display, fontSize: 29, lineHeight: 35, letterSpacing: -0.8, marginTop: 6 },
  searchRow: { paddingHorizontal: SPACING.page, marginTop: SPACING.lg },
  searchTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingLeft: 16,
    paddingRight: 6,
    minHeight: 50,
  },
  searchText: { flex: 1, fontSize: SCALE.body - 0.5, letterSpacing: 0.1 },
  searchKbd: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  categoriesWrap: { marginTop: SPACING.lg },
  categoriesScroll: { paddingHorizontal: SPACING.page },
  sectionPad: { paddingHorizontal: SPACING.page },
  heroWrap: { marginTop: SPACING.xl },
  heroScroll: { paddingHorizontal: SPACING.page, gap: SLIDE_GAP },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 22 },
  stripScroll: { paddingHorizontal: SPACING.page, gap: 12 },
  railList: { paddingHorizontal: SPACING.page, gap: 12, paddingBottom: 6 },
  rankList: { paddingHorizontal: SPACING.page + 6, gap: 18, paddingBottom: 6 },
  exploreCard: {
    marginTop: SPACING.xxl,
    borderRadius: RADIUS.xl,
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreTitle: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  exploreSub: { fontSize: SCALE.caption, color: 'rgba(255,255,255,0.82)', marginTop: 3 },
});
