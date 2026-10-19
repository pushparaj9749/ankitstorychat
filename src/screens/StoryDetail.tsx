/**
 * KISSA v2.5.2 — Story Detail
 *
 * Question this screen answers: "should I start this story, and how big is it?"
 *
 * Layout order (unchanged contract — asserted by __tests__/otaStoryDetail):
 *   hero → title → chips → stats → about → YOU ARE → Cast → Media Library
 *   → Story Creator → Refer Kissa → Similar → sticky CTA
 *
 * What this pass changed:
 *  - immersive hero: the artwork is bounded (never cropped), the story's own
 *    accent tint fills the letterbox, nav chrome floats on the art
 *  - a stats row (scenes / cast / endings) answers "how big is it" instantly
 *  - the long description collapses to two lines with a Read-more toggle
 *  - internal metadata tags (#ongoing …) are no longer shown as UI chips
 *  - cast portraits come from the story's own character references
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Playthrough, RootStackParamList, StoryBundle, StoryCreator, StoryMediaItem } from '../types';
import { KISSA_OWNER_CREATOR } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { CoverImage } from '../components/CoverImage';
import { ArtBackdrop } from '../components/ArtBackdrop';
import { GridCard } from '../components/StoryCard';
import { NaturalImage } from '../components/NaturalImage';
import { AgeBadge, GenreChip, SectionHeader } from '../components/bits';
import { ErrorState, LoadingState, OfflineState } from '../components/states';
import { getBundledCoverSource, getBundle, mediaApiUrl, effectiveContentApiBaseUrl, StoryContentError } from '../content/loader';
import { interpolatePlayerName, makePlayerTextFn, readerRoleText } from '../lib/playerName';
import { AgeRestrictedError } from '../lib/ageGate';
import { listPlaythroughsForStory, updateStats, insertMessage } from '../lib/db';
import { createPlaythrough, playthroughLabel } from '../lib/playthrough';
import { seedMemoriesIfEmpty } from '../lib/memory';
import { ensureWorldState } from '../lib/worldState';
import { GLASS, RADIUS, SCALE, SHADOWS, SPACING, TOUCH, TYPE, withAlpha } from '../theme';
import { Icon, ICON_SIZE } from '../components/icons';
import { uid } from '../lib/utils';
import { mediumBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'StoryDetail'>;

const HERO = 540;

export function StoryDetail({ navigation, route }: Props) {
  const { storyId } = route.params;
  const { theme, profile, settings, stories, favoriteIds, toggleFavorite, activeProvider, providersWithKeys, refreshRecent } = useApp();

  const [bundle, setBundle] = useState<StoryBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [saves, setSaves] = useState<Playthrough[]>([]);
  const [starting, setStarting] = useState(false);
  const [offline, setOffline] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [descOpen, setDescOpen] = useState(false);

  const meta = stories.find((s) => s.id === storyId);
  const isFav = favoriteIds.has(storyId);
  const apiBase = effectiveContentApiBaseUrl(settings.contentApiBaseUrl);
  const cover = meta ? getBundledCoverSource(meta, apiBase) : null;
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!profile) return;
      setOffline(false);
      setError(null);
      try {
        const b = await getBundle(storyId, profile.ageGroup, apiBase);
        if (!alive) return;
        setBundle(b);
        setSaves(await listPlaythroughsForStory(storyId));
      } catch (e) {
        if (!alive) return;
        if (e instanceof AgeRestrictedError) setRestricted(true);
        else if (e instanceof StoryContentError && e.code === 'network') setOffline(true);
        else setError(e instanceof Error ? e.message : 'Could not open story.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [storyId, profile, reloadKey, apiBase]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      void listPlaythroughsForStory(storyId).then(setSaves).catch(() => undefined);
    });
    return unsub;
  }, [navigation, storyId]);

  async function startNew() {
    if (!bundle || !profile || starting) return;
    const canUseAI = !!activeProvider && providersWithKeys.has(activeProvider.id);
    if (!canUseAI) {
      Alert.alert('AI Setup Required', 'Configure AI provider to start.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add AI Provider', onPress: () => navigation.navigate('AIAddons') },
      ]);
      return;
    }
    setStarting(true);
    mediumBuzz();
    try {
      const existing = await listPlaythroughsForStory(storyId);
      const pt = await createPlaythrough(bundle, playthroughLabel(existing.length), 'ai', activeProvider!.id);
      const openingScene = bundle.scenes.scenes.find((s) => s.id === bundle.story.openingSceneId) ?? bundle.scenes.scenes[0];
      const pn = profile.nickname;
      const pnOptions = { protectedNames: bundle.characters.characters.map((c) => c.name) };
      let i = 0;
      for (const rawLine of openingScene.narration) {
        await insertMessage({
          id: uid('m'),
          playthroughId: pt.id,
          role: i === 0 ? 'narration' : 'assistant',
          speaker: null,
          text: interpolatePlayerName(rawLine, pn, pnOptions),
          sceneId: openingScene.id,
          createdAt: new Date(Date.now() + i).toISOString(),
        });
        i++;
      }
      await seedMemoriesIfEmpty(pt, bundle.memory.seedMemories.map((m) => interpolatePlayerName(m, pn, pnOptions)));
      void ensureWorldState(pt, bundle).catch(() => undefined);
      await updateStats({ storiesStarted: 1 });
      await refreshRecent();
      navigation.navigate('Chat', { playthroughId: pt.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start story.');
    } finally {
      setStarting(false);
    }
  }

  if (restricted) {
    return (
      <Screen>
        <ErrorState title="Restricted story" subtitle="Not available for your age group." retry="Go back" onRetry={() => navigation.goBack()} />
      </Screen>
    );
  }

  if (offline) {
    return (
      <Screen>
        <OfflineState
          subtitle={`Connect to play "${meta?.title ?? 'this story'}".`}
          retry="Retry"
          onRetry={() => setReloadKey((k) => k + 1)}
          secondary="Go back"
          onSecondary={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  if (error || !meta) {
    return (
      <Screen>
        <ErrorState title="Couldn't open story" subtitle={error ?? 'Story not found.'} retry="Go back" onRetry={() => navigation.goBack()} />
      </Screen>
    );
  }

  if (!bundle) {
    return (
      <Screen>
        <LoadingState label="Loading story…" />
      </Screen>
    );
  }

  const activeSave = saves.find((s) => s.status === 'active');
  const gallery = bundle.story.media?.gallery ?? [];
  const cast = bundle.characters?.characters ?? [];
  const portraitOf = (characterId?: string | null) => {
    const item = gallery.find((g) => g.kind === 'character-portrait' && (!characterId || g.characterId === characterId));
    return item ? mediaApiUrl(apiBase, bundle.meta.storyDir, item.file) : null;
  };

  const ongoing = meta.tags?.includes('ongoing') ?? false;

  return (
    <Screen padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ------------------------------------------------ immersive hero */}
        <View style={[styles.hero, { height: HERO, backgroundColor: withAlpha(meta.accentColor, 0.16) }]}>
          <ArtBackdrop source={cover} accentColor={meta.accentColor} />
          <CoverImage
            source={cover}
            accentColor={meta.accentColor}
            fallbackLetter={meta.title}
            style={styles.heroArt}
            maxHeight={HERO}
            placeholderMinHeight={HERO * 0.7}
            tint="transparent"
          />
          <LinearGradient
            colors={['rgba(10,11,16,0.55)', 'transparent', withAlpha(theme.bg, 0.55), withAlpha(theme.bg, 0.97), theme.bg]}
            locations={[0, 0.2, 0.52, 0.84, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* title block sits on the artwork (cinematic, full-bleed) */}
          <View style={styles.heroFoot}>
            <View style={styles.heroBadges}>
              <AgeBadge ageRating={meta.ageRating} />
              {meta.isNew ? (
                <View style={[styles.newBadge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              ) : null}
              {ongoing ? (
                <View style={[styles.ongoingPill, { borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(10,11,16,0.45)' }]}>
                  <Icon name="sparkles" size={11} color={theme.gold} />
                  <Text style={[styles.ongoingText, { color: '#F4F5F8' }]}>ENDLESS</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.title, { color: '#FFFFFF' }]}>{meta.title}</Text>
            <Text style={[styles.tagline, { color: theme.textDim }]} numberOfLines={3}>
              {forPlayer(meta.tagline)}
            </Text>
            <View style={styles.metaRow}>
              {meta.genres.slice(0, 3).map((g) => (
                <View key={g} style={[styles.genrePill, { borderColor: theme.border, backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                  <Text style={[styles.genrePillText, { color: theme.text }]}>{g}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.heroNav}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              style={({ pressed }) => [styles.glassBtn, { borderColor: GLASS.stroke, backgroundColor: GLASS.bg, opacity: pressed ? 0.72 : 1 }]}
            >
              <Icon name="chevron-back" size={ICON_SIZE.md} color="#F4F5F8" />
            </Pressable>
            <View style={styles.heroNavRight}>
              <Pressable
                onPress={() => void toggleFavorite(storyId)}
                accessibilityRole="button"
                accessibilityLabel={isFav ? 'Remove favorite' : 'Add favorite'}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.glassBtn,
                  {
                    borderColor: isFav ? withAlpha(theme.primary, 0.6) : GLASS.stroke,
                    backgroundColor: isFav ? withAlpha(theme.primary, 0.28) : GLASS.bg,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Icon name={isFav ? 'heart' : 'heart-outline'} size={ICON_SIZE.md} color={isFav ? theme.accent : '#F4F5F8'} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ------------------------------------------------ overlapping sheet */}
        <View style={[styles.sheet, { backgroundColor: theme.bg, borderColor: theme.borderSoft }]}>
          {/* at a glance — never a length, duration or count of endings */}
          <View style={[styles.statRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            {[
              { icon: 'people-outline' as const, value: String(cast.length || '—'), label: 'Characters' },
              { icon: 'sparkles-outline' as const, value: meta.genres[0] ?? 'Story', label: 'Genre' },
              { icon: 'shield-outline' as const, value: String(meta.ageRating), label: 'Rated' },
            ].map((st, i) => (
              <View key={st.label} style={[styles.stat, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.border }]}>
                <Icon name={st.icon} size={16} color={theme.textDim} />
                <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>{st.value}</Text>
                <Text style={[styles.statLabel, { color: theme.textFaint }]}>{st.label}</Text>
              </View>
            ))}
          </View>

          {/* about — collapsed by default so the decision stays above the fold */}
          <Text style={[styles.desc, { color: theme.textDim }]} numberOfLines={descOpen ? undefined : 3}>
            {forPlayer(meta.description)}
          </Text>
          <Pressable onPress={() => setDescOpen((v) => !v)} hitSlop={8} style={styles.readMore}>
            <Text style={[styles.readMoreText, { color: theme.accent }]}>{descOpen ? 'Show less' : 'Read more'}</Text>
            <Icon name={descOpen ? 'chevron-up' : 'chevron-down'} size={13} color={theme.accent} />
          </Pressable>

          {bundle.story.userRole ? (
            <View style={[styles.roleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.roleHead}>
                <View style={[styles.roleIcon, { backgroundColor: withAlpha(theme.primary, 0.18) }]}>
                  <Icon name="person" size={14} color={theme.accent} />
                </View>
                <Text style={[styles.roleKicker, { color: theme.accent }]}>YOU ARE</Text>
              </View>
              <Text style={[styles.roleDesc, { color: theme.text }]}>{forPlayer(readerRoleText(bundle.story.userRole))}</Text>
            </View>
          ) : null}

          {/* cast — the people this story is about */}
          {cast.length > 0 ? (
            <>
              <SectionHeader title="Cast" kicker={`${cast.length} in this story`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.castRow}>
                <View style={styles.castCard}>
                  <View style={[styles.castPortrait, { borderColor: theme.primary, borderWidth: 2, backgroundColor: theme.primarySoft }]}>
                    <Text style={[styles.castInitial, { color: theme.text }]}>
                      {(profile?.nickname?.trim()?.[0] ?? 'Y').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.castName, { color: theme.text }]} numberOfLines={1}>
                    {profile?.nickname?.trim() || 'You'}
                  </Text>
                  <Text style={[styles.castRole, { color: theme.primary }]} numberOfLines={1}>
                    You
                  </Text>
                </View>
                {cast.map((c) => {
                  const uri = portraitOf(c.id);
                  return (
                    <View key={c.id} style={styles.castCard}>
                      <View style={[styles.castPortrait, { borderColor: theme.border, backgroundColor: withAlpha(meta.accentColor, 0.16) }]}>
                        {uri ? <ArtBackdrop source={{ uri }} accentColor={meta.accentColor} blur={12} dim={0.2} /> : null}
                        {uri ? (
                          <NaturalImage source={{ uri }} style={styles.castPortraitImg} fallback={<Text style={[styles.castInitial, { color: theme.text }]}>{c.name[0]}</Text>} />
                        ) : (
                          <Text style={[styles.castInitial, { color: theme.text }]}>{(c.name?.[0] ?? '?').toUpperCase()}</Text>
                        )}
                      </View>
                      <Text style={[styles.castName, { color: theme.text }]} numberOfLines={1}>
                        {c.name}
                      </Text>
                      <Text style={[styles.castRole, { color: theme.textFaint }]} numberOfLines={2}>
                        {c.role ?? 'Character'}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {gallery.length > 0 ? (
            <>
              <SectionHeader title={`Media Library (${gallery.length})`} />
              {/* Even 2-column wall of fixed-height frames: each artwork is shown
                  whole (contain) on its own blurred backdrop, so rows line up and
                  no column ends early with an empty gap underneath. A lone last
                  tile spans the full width. */}
              <View style={styles.mediaGrid}>
                {gallery.map((item, index) => {
                  const spanFull = index === gallery.length - 1 && gallery.length % 2 === 1;
                  return (
                    <View key={item.id} style={spanFull ? styles.mediaCellFull : styles.mediaCell}>
                      <MediaTile
                        item={item}
                        index={index}
                        storyDir={bundle.meta.storyDir}
                        bundle={bundle}
                        height={spanFull ? MEDIA_H + 40 : MEDIA_H}
                        onPress={() => setLightboxIndex(index)}
                      />
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          <CreatorBlock creator={bundle.creator} />
          <SimilarStoriesBlock storyId={storyId} navigation={navigation} />

          <SectionHeader title="Refer Kissa" />
          <View style={[styles.referCard, { backgroundColor: withAlpha(theme.text, 0.04), borderColor: theme.border }]}>
            <Text style={[styles.referTitle, { color: theme.text }]}>Pass the story forward</Text>
            <Text style={[styles.referSub, { color: theme.textDim }]}>Invite friends to interactive stories. Local-first, private, no ads.</Text>
          </View>

          <View style={{ height: 132 }} />
        </View>
      </ScrollView>

      <SafeAreaView
        edges={['bottom']}
        style={[styles.fixedBar, { backgroundColor: GLASS.bgStrong, borderTopColor: theme.borderSoft }]}
      >
        <View style={styles.fixedBarInner}>
          <View style={{ flex: 1 }}>
            <GradientButton
              title={activeSave ? 'Resume Journey' : 'Start Story'}
              loading={starting}
              onPress={() => {
                if (activeSave) navigation.navigate('Chat', { playthroughId: activeSave.id });
                else void startNew();
              }}
            />
          </View>
          {saves.length > 0 ? (
            <Pressable
              onPress={() => navigation.navigate('Saves', { storyId })}
              accessibilityRole="button"
              accessibilityLabel={`Saves, ${saves.length}`}
              hitSlop={6}
              style={({ pressed }) => [
                styles.secondaryAction,
                { borderColor: theme.border, backgroundColor: withAlpha(theme.surface2, 0.9), opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Icon name="albums-outline" size={ICON_SIZE.md} color={theme.textDim} />
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>

      {lightboxIndex !== null && gallery[lightboxIndex] ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLightboxIndex(null)}>
          <View style={styles.lightbox}>
            <Pressable style={styles.lightboxClose} onPress={() => setLightboxIndex(null)} accessibilityLabel="Close">
              <Icon name="close" size={ICON_SIZE.sm} color="#fff" />
            </Pressable>
            {lightboxIndex > 0 ? (
              <Pressable style={[styles.lightboxNav, { left: 16 }]} onPress={() => setLightboxIndex(lightboxIndex - 1)}>
                <Icon name="chevron-back" size={22} color="#fff" />
              </Pressable>
            ) : null}
            {lightboxIndex < gallery.length - 1 ? (
              <Pressable style={[styles.lightboxNav, { right: 16 }]} onPress={() => setLightboxIndex(lightboxIndex + 1)}>
                <Icon name="chevron-forward" size={22} color="#fff" />
              </Pressable>
            ) : null}
            <LightboxImage url={mediaApiUrl(apiBase, bundle.meta.storyDir, gallery[lightboxIndex].file)} accent={meta.accentColor} />
            <Text style={styles.lightboxLabel}>
              {lightboxIndex + 1} / {gallery.length}
            </Text>
          </View>
        </Modal>
      ) : null}
    </Screen>
  );
}

const KIND_BADGE: Record<StoryMediaItem['kind'], string> = {
  cover: 'COVER',
  'character-portrait': 'PORTRAIT',
  scene: 'MOMENT',
  other: 'ART',
};

const MEDIA_H = 176;

function MediaTile({
  item,
  storyDir,
  bundle,
  height,
  onPress,
}: {
  item: StoryMediaItem;
  index: number;
  storyDir: string;
  bundle: StoryBundle;
  height: number;
  onPress: () => void;
}) {
  const { theme, settings } = useApp();
  const apiBase = effectiveContentApiBaseUrl(settings.contentApiBaseUrl);
  const url = mediaApiUrl(apiBase, storyDir, item.file);
  const character = item.characterId ? bundle.characters?.characters?.find((c) => c.id === item.characterId) : null;
  const label = item.label || character?.name || (item.kind === 'cover' ? 'Cover' : 'Artwork');

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`View ${label}`}
      style={({ pressed }) => [
        styles.mediaTile,
        { height, borderColor: theme.border, backgroundColor: withAlpha(theme.text, 0.04), opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <ArtBackdrop source={{ uri: url }} accentColor={bundle.meta.accentColor} />
      <NaturalImage
        source={{ uri: url }}
        style={styles.mediaImg}
        maxHeight={height}
        placeholderMinHeight={height * 0.6}
        fallback={
          <View style={styles.mediaFallback}>
            <Icon name="image-outline" size={ICON_SIZE.md} color={theme.textDim} />
            <Text style={[styles.mediaFallbackText, { color: theme.textDim }]}>{label}</Text>
          </View>
        }
      />
      <View style={[styles.mediaBadge, { backgroundColor: GLASS.bg }]}>
        <Text style={[styles.mediaBadgeText, { color: '#F4F5F8' }]}>{KIND_BADGE[item.kind]}</Text>
      </View>
      <LinearGradient colors={['transparent', 'rgba(10,11,16,0.86)']} style={styles.mediaLabelShade} pointerEvents="none" />
      <Text style={[styles.mediaLabel, { color: '#fff' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function LightboxImage({ url, accent }: { url: string; accent: string }) {
  return (
    <View style={styles.lightboxImageWrap}>
      <NaturalImage
        source={{ uri: url }}
        style={styles.lightboxImage}
        placeholder={<ActivityIndicator size="small" color={accent} />}
        fallback={
          <View style={styles.lightboxFallback}>
            <Icon name="image-outline" size={ICON_SIZE.lg} color="#A8ACB9" />
            <Text style={[styles.lightboxFallbackText, { color: '#A8ACB9' }]}>Image unavailable.</Text>
          </View>
        }
      />
    </View>
  );
}

function CreatorBlock({ creator }: { creator: StoryCreator }) {
  const { theme } = useApp();
  const display: StoryCreator = {
    name: (creator?.name && creator.name.trim()) || KISSA_OWNER_CREATOR.name,
    avatar: creator?.avatar ?? null,
    verified: creator?.verified === true,
  };
  return (
    <>
      <SectionHeader title="Story Creator" />
      <View style={[styles.creatorCard, { backgroundColor: withAlpha(theme.text, 0.04), borderColor: theme.border }]}>
        <LinearGradient
          colors={['#F0567E', '#9A9CC4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.creatorAvatar}
        >
          <Text style={styles.creatorInitial}>{display.name[0]?.toUpperCase() ?? '?'}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <View style={styles.creatorNameRow}>
            <Text style={[styles.creatorName, { color: theme.text }]}>{display.name}</Text>
            {display.verified ? (
              <View style={[styles.verifiedPill, { backgroundColor: withAlpha(theme.info, 0.16), borderColor: withAlpha(theme.info, 0.34) }]}>
                <Icon name="checkmark-circle" size={11} color="#BBD2FF" />
                <Text style={styles.verifiedText}>VERIFIED</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.creatorSub, { color: theme.textDim }]}>
            {display.name === KISSA_OWNER_CREATOR.name ? 'Kissa creator' : 'Community storyteller'}
          </Text>
        </View>
      </View>
    </>
  );
}

const SIMILAR_ART_H = 212;

function SimilarStoriesBlock({ storyId, navigation }: { storyId: string; navigation: Props['navigation'] }) {
  const { theme, stories, settings } = useApp();
  const apiBase = effectiveContentApiBaseUrl(settings?.contentApiBaseUrl);
  // Prefer stories that share a genre with this one; fill up with the rest.
  const others = useMemo(() => {
    const self = stories.find((s) => s.id === storyId);
    const pool = stories.filter((s) => s.id !== storyId);
    const peers = self ? pool.filter((s) => s.genres.some((g) => self.genres.includes(g))) : [];
    const rest = pool.filter((s) => !peers.includes(s));
    return [...peers, ...rest].slice(0, 8);
  }, [stories, storyId]);
  if (others.length === 0) return null;
  return (
    <>
      <SectionHeader title="You may also like" kicker={others[0]?.genres[0]} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
        {others.map((s) => (
          <GridCard key={s.id} meta={s} width={142} height={SIMILAR_ART_H} onPress={() => navigation.push('StoryDetail', { storyId: s.id })} />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16 },
  hero: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sheet: {
    paddingHorizontal: SPACING.page,
    paddingTop: 4,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  heroArt: { width: '100%' },
  heroNav: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', alignItems: 'center' },
  heroNavRight: { marginLeft: 'auto', flexDirection: 'row', gap: 9 },
  glassBtn: {
    width: TOUCH.min - 2,
    height: TOUCH.min - 2,
    borderRadius: (TOUCH.min - 2) / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFoot: { position: 'absolute', left: SPACING.page, right: SPACING.page, bottom: 8 },
  newBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  newBadgeText: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 1, color: '#fff' },
  genrePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1 },
  genrePillText: { fontSize: SCALE.caption, fontWeight: '600' },
  heroBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  ongoingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1 },
  ongoingText: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 1.1 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -1.1, lineHeight: 39 },
  tagline: { fontSize: SCALE.body - 0.5, fontWeight: '500', marginTop: 8, lineHeight: 21 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACING.md },
  statRow: { flexDirection: 'row', marginTop: SPACING.md, borderWidth: 1, borderRadius: RADIUS.lg, paddingVertical: 12 },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 6, gap: 3 },
  statIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  statValue: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginTop: 4 },
  statLabel: { fontSize: SCALE.micro, fontWeight: '500', letterSpacing: 0.2 },
  desc: { fontSize: 14.5, lineHeight: 22, marginTop: SPACING.lg },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8, alignSelf: 'flex-start' },
  readMoreText: { fontSize: SCALE.small, fontWeight: '700' },
  roleCard: { borderWidth: 1, borderRadius: RADIUS.xl, padding: 16, marginTop: SPACING.lg, gap: 8 },
  roleHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  roleKicker: { fontSize: SCALE.micro, letterSpacing: 1.3, fontWeight: '800' },
  roleDesc: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
  castRow: { gap: 10, paddingRight: SPACING.page },
  castCard: { width: 84, paddingVertical: 4, alignItems: 'center' },
  castPortrait: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  castPortraitImg: { width: 68, height: 68 },
  castInitial: { fontSize: 20, fontWeight: '800' },
  castName: { fontSize: SCALE.small, fontWeight: '700', marginTop: 9 },
  castRole: { fontSize: SCALE.micro, fontWeight: '500', marginTop: 2, textAlign: 'center', lineHeight: 14 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginTop: 4 },
  mediaCell: { width: '48.5%' },
  mediaCellFull: { width: '100%' },
  mediaTile: { width: '100%', borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  mediaImg: { width: '100%' },
  mediaBadge: { position: 'absolute', top: 8, left: 8, borderRadius: RADIUS.xs, paddingHorizontal: 7, paddingVertical: 3 },
  mediaBadgeText: { fontSize: SCALE.micro, fontWeight: '700', letterSpacing: 0.6 },
  mediaLabelShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 52 },
  mediaLabel: { position: 'absolute', left: 9, right: 9, bottom: 8, fontSize: SCALE.caption, fontWeight: '700' },
  mediaFallback: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, minHeight: 110 },
  mediaFallbackText: { fontSize: SCALE.micro, fontWeight: '600' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  lightboxImageWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  lightboxImage: { width: '100%', maxHeight: '86%' },
  lightboxLabel: { color: '#F4F5F8', fontSize: SCALE.caption, fontWeight: '700', marginTop: 12, letterSpacing: 0.2 },
  lightboxNav: {
    position: 'absolute',
    top: '46%',
    width: TOUCH.min,
    height: TOUCH.min,
    borderRadius: TOUCH.min / 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    zIndex: 10,
  },
  lightboxClose: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: TOUCH.sm,
    height: TOUCH.sm,
    borderRadius: TOUCH.sm / 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    zIndex: 10,
  },
  lightboxFallback: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  lightboxFallbackText: { fontSize: SCALE.caption, fontWeight: '600' },
  creatorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, marginTop: 4 },
  creatorAvatar: { width: 46, height: 46, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  creatorInitial: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  creatorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  creatorName: { fontSize: 15, fontWeight: '700' },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.xs, borderWidth: 1 },
  verifiedText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6, color: '#BBD2FF' },
  creatorSub: { fontSize: SCALE.caption, marginTop: 3 },
  similarRow: { gap: 12, paddingRight: SPACING.page, paddingBottom: 4 },
  similarCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, overflow: 'hidden', minWidth: 0 },
  similarArt: { height: SIMILAR_ART_H, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  similarImg: { width: '100%' },
  similarBody: { position: 'absolute', left: 9, right: 9, bottom: 9 },
  similarGenreRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  similarDot: { width: 5, height: 5, borderRadius: 2.5 },
  similarTitle: { fontSize: SCALE.small, fontWeight: '700', lineHeight: 16, color: '#fff' },
  similarGenre: { fontSize: SCALE.micro, fontWeight: '700', letterSpacing: 0.5, color: 'rgba(244,245,248,0.7)', flexShrink: 1 },
  referCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, marginTop: 4, borderStyle: 'dashed' },
  referTitle: { fontSize: 15, fontWeight: '700' },
  referSub: { fontSize: SCALE.small, marginTop: 5, lineHeight: 19 },
  fixedBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.page,
    paddingTop: 12,
    paddingBottom: 14,
  },
  fixedBarInner: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  secondaryAction: {
    width: TOUCH.min,
    height: TOUCH.min,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
