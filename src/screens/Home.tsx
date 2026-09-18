/** Home — cinematic premium. Wordmark, greeting, glass search, continue, featured, rail, genres. */
import React, { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { ContinueCard, GridCard, HeroCard } from '../components/StoryCard';
import { SectionHeader, SelectableChip } from '../components/bits';
import { EmptyState } from '../components/states';
import { RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import { greetingForHour, timeAgo } from '../lib/utils';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

export function Home({ navigation }: Props) {
  const { theme, profile, stories, recentPlaythroughs, favoriteIds } = useApp();

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
    () => [...stories].sort((a, b) => b.popularity - a.popularity).slice(0, 10),
    [stories],
  );
  const newHot = useMemo(() => stories.filter((s) => s.isNew).slice(0, 6), [stories]);
  const favorites = useMemo(() => stories.filter((s) => favoriteIds.has(s.id)), [stories, favoriteIds]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    stories.forEach((s) => s.genres.forEach((g) => set.add(g)));
    return [...set].sort();
  }, [stories]);

  const greeting = greetingForHour(new Date().getHours(), profile?.nickname ?? '');
  const firstName = profile?.nickname ?? 'Traveller';

  if (!stories.length) {
    return (
      <Screen>
        <EmptyState
          emoji="▣"
          title="No stories yet"
          subtitle="Fresh stories arrive over the air automatically — check your connection and open Shows."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header: wordmark + greeting + search */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={[styles.brand, { color: theme.accent }]}>KISSA</Text>
            <View style={[styles.brandDot, { backgroundColor: withAlpha(theme.accent, 0.22) }]} />
            <Text style={[styles.brandSub, { color: theme.textFaint }]}>Stories that remember</Text>
          </View>
          <Text style={[styles.hello, { color: theme.textDim }]}>{greeting.split(',')[0].toUpperCase()}</Text>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {firstName}
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Discover')}
            accessibilityRole="search"
            accessibilityLabel="Search stories"
            style={({ pressed }) => [
              styles.searchBar,
              {
                backgroundColor: withAlpha(theme.surface, 0.92),
                borderColor: theme.border,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              },
              SHADOWS.card,
            ]}
          >
            <Text style={[styles.searchIcon]}>◎</Text>
            <Text style={[styles.searchText, { color: theme.textFaint }]}>Search shows, genres, characters</Text>
            <View style={[styles.searchCta, { backgroundColor: withAlpha(theme.accent, 0.14), borderColor: withAlpha(theme.accent, 0.18) }]}>
              <Text style={[styles.searchCtaText, { color: theme.accent }]}>⌕</Text>
            </View>
          </Pressable>
        </View>

        {/* Continue */}
        {activeRecent.length > 0 ? (
          <View style={styles.pad}>
            <SectionHeader title="Continue" kicker={`${activeRecent.length} active`} />
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

        {/* Featured */}
        {featured ? (
          <View style={styles.pad}>
            <SectionHeader title="Tonight’s lead" kicker="Editor’s pick" />
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

        {/* Recommended rail */}
        <View style={styles.pad}>
          <SectionHeader title="Shows for you" action="See all" onAction={() => navigation.navigate('Discover')} />
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
                  (navigation as unknown as { navigate: (s: string, o: object) => void }).navigate('StoryDetail', {
                    storyId: item.id,
                  })
                }
              />
            </View>
          )}
        />

        {/* New this week — elegant list with art + tagline */}
        {newHot.length > 0 ? (
          <View style={styles.pad}>
            <SectionHeader title="New this week" kicker="Fresh" />
            {newHot.slice(0, 3).map((s) => (
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

        {/* Genres */}
        <View style={styles.pad}>
          <SectionHeader title="Genres" kicker="Browse" />
          <View style={styles.cats}>
            {categories.map((c) => (
              <SelectableChip key={c} label={c} selected={false} onPress={() => navigation.navigate('Discover', { genre: c })} />
            ))}
          </View>

          {favorites.length > 0 ? (
            <>
              <SectionHeader title="Saved" kicker={`${favorites.length}`} />
              {favorites.map((s) => (
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
            </>
          ) : null}
          <View style={{ height: SPACING.xxl + 12 }} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 8 },
  pad: { paddingHorizontal: 20 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  brand: { fontSize: 11, fontWeight: '800', letterSpacing: 3.2 },
  brandDot: { width: 4, height: 4, borderRadius: 2 },
  brandSub: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  hello: { fontSize: 11, marginTop: 16, letterSpacing: 0.8, fontWeight: '700', textTransform: 'uppercase' },
  name: { ...TYPE.display, marginBottom: 16, marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    marginBottom: 4,
  },
  searchIcon: { fontSize: 14, opacity: 0.6 },
  searchText: { flex: 1, letterSpacing: 0.2, fontSize: 13 },
  searchCta: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCtaText: { fontSize: 14, fontWeight: '800' },
  gap: { marginBottom: 10 },
  hlist: { paddingHorizontal: 20, alignItems: 'flex-start' },
  hitem: { marginRight: 14 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
