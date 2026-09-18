/**
 * Story Detail — Redesigned for Kissa v2.4.1.
 *
 * Canonical Information Hierarchy:
 *   1. Hero Cover (large cinematic artwork preserving natural aspect ratio)
 *   2. Story Title & Tagline
 *   3. Story Tags (genre chips, age rating badge, #tags)
 *   4. About Story (description, player role)
 *   5. Media Library (cover + character portraits + scene stills + fullscreen lightbox)
 *   6. Story Creator (creator card, verified status)
 *   7. Similar Stories (recommended discovery cards)
 *   8. Refer Kissa (invitation card)
 *   9. Fixed Floating Action Bar ("Chat Now" / "Resume Journey")
 *
 * Deliberately NOT present: comments, ratings, chat statistics, external share.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  Playthrough,
  RootStackParamList,
  StoryBundle,
  StoryCreator,
  StoryMediaItem,
} from '../types';
import { KISSA_OWNER_CREATOR } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { CoverImage } from '../components/CoverImage';
import { NaturalImage } from '../components/NaturalImage';
import { AgeBadge, GenreChip, SectionHeader } from '../components/bits';
import { ErrorState, LoadingState, OfflineState } from '../components/states';
import {
  getBundledCoverSource,
  getBundle,
  mediaApiUrl,
  effectiveContentApiBaseUrl,
  StoryContentError,
} from '../content/loader';
import { interpolatePlayerName, makePlayerTextFn } from '../lib/playerName';
import { AgeRestrictedError } from '../lib/ageGate';
import { listPlaythroughsForStory, updateStats, insertMessage } from '../lib/db';
import { createPlaythrough, playthroughLabel } from '../lib/playthrough';
import { seedMemoriesIfEmpty } from '../lib/memory';
import { ensureWorldState } from '../lib/worldState';
import { FONTS, GRADIENTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';
import { uid } from '../lib/utils';
import { mediumBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'StoryDetail'>;

export function StoryDetail({ navigation, route }: Props) {
  const { storyId } = route.params;
  const {
    theme,
    profile,
    settings,
    stories,
    favoriteIds,
    toggleFavorite,
    activeProvider,
    providersWithKeys,
    refreshRecent,
  } = useApp();

  const [bundle, setBundle] = useState<StoryBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [saves, setSaves] = useState<Playthrough[]>([]);
  const [starting, setStarting] = useState(false);
  const [offline, setOffline] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Fullscreen Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
      Alert.alert(
        'AI Setup Required 🤖',
        'Story shuru karne ke liye pehle AI provider configure karo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add AI Provider', onPress: () => navigation.navigate('AIAddons') },
        ],
      );
      return;
    }

    setStarting(true);
    mediumBuzz();
    try {
      const existing = await listPlaythroughsForStory(storyId);
      const mode = 'ai' as const;
      const pt = await createPlaythrough(
        bundle,
        playthroughLabel(existing.length),
        mode,
        activeProvider!.id,
      );

      // Seed opening narration as messages with player name
      const openingScene =
        bundle.scenes.scenes.find((s) => s.id === bundle.story.openingSceneId) ??
        bundle.scenes.scenes[0];
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

      await seedMemoriesIfEmpty(
        pt,
        bundle.memory.seedMemories.map((m) => interpolatePlayerName(m, pn, pnOptions)),
      );

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
        <ErrorState
          title="🔞 Restricted story"
          subtitle="Ye story tumhare age group ke liye available nahi hai."
          retry="Go back"
          onRetry={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  if (offline) {
    return (
      <Screen>
        <OfflineState
          subtitle={`Connect to the internet to play "${meta?.title ?? 'this story'}". Your progress and history stay safe on this device.`}
          retry="↻ Retry"
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
        <ErrorState
          title="Couldn't open story"
          subtitle={error ?? 'Story not found.'}
          retry="Go back"
          onRetry={() => navigation.goBack()}
        />
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

  return (
    <Screen padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* 1. Hero Cover — rendered at the artwork's own intrinsic aspect ratio */}
        <View style={styles.coverWrap}>
          <CoverImage
            source={cover}
            accentColor={meta.accentColor}
            fallbackLetter={meta.title}
            style={styles.cover}
            placeholderMinHeight={300}
          />
          <LinearGradient
            colors={['transparent', 'rgba(9,8,12,0.60)', theme.bg]}
            locations={[0, 0.55, 1]}
            style={styles.coverShade}
          />

          {/* Floating Back Button */}
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.back}
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>

          {/* Floating Favorite Button */}
          <Pressable
            onPress={() => void toggleFavorite(storyId)}
            style={styles.fav}
            accessibilityRole="button"
            accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Text style={styles.favText}>{isFav ? '❤️' : '🤍'}</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {/* 2. Story Title & Tagline */}
          <Text style={[styles.title, { color: theme.text }]}>{meta.title}</Text>
          <Text style={[styles.tagline, { color: theme.accent }]}>{forPlayer(meta.tagline)}</Text>

          {/* 3. Story Tags */}
          <View style={styles.metaRow}>
            {meta.genres.map((g) => (
              <GenreChip key={g} genre={g} />
            ))}
            <AgeBadge ageRating={meta.ageRating} />
          </View>

          {meta.tags.length > 0 ? (
            <View style={styles.tags}>
              {meta.tags.slice(0, 8).map((t) => (
                <View
                  key={t}
                  style={[styles.tag, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Text style={[styles.tagText, { color: theme.textDim }]}>#{t}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* 4. About Story */}
          <Text style={[styles.desc, { color: theme.textDim }]}>{forPlayer(meta.description)}</Text>

          {bundle.story.userRole ? (
            <View
              style={[
                styles.roleCard,
                {
                  backgroundColor: withAlpha(theme.surface, 0.9),
                  borderColor: theme.border,
                },
                SHADOWS.card,
              ]}
            >
              <Text style={[styles.roleKicker, { color: theme.accent }]}>YOUR CHARACTER</Text>
              <Text style={[styles.roleDesc, { color: theme.text }]}>
                {forPlayer(bundle.story.userRole)}
              </Text>
            </View>
          ) : null}

          {/* 5. Media Library (if media block present) */}
          {gallery.length > 0 ? (
            <>
              <SectionHeader title={`Media Library (${gallery.length})`} kicker="Artworks" />
              <View style={styles.mediaGrid}>
                {gallery.map((item, index) => (
                  <MediaTile
                    key={item.id}
                    item={item}
                    index={index}
                    storyDir={bundle.meta.storyDir}
                    bundle={bundle}
                    onPress={() => setLightboxIndex(index)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {/* 6. Story Creator */}
          <CreatorBlock creator={bundle.creator} />

          {/* 7. Similar Stories */}
          <SimilarStoriesBlock storyId={storyId} navigation={navigation} />

          {/* 8. Refer Kissa */}
          <SectionHeader title="Refer Kissa" kicker="Share" />
          <View
            style={[
              styles.referCard,
              {
                backgroundColor: withAlpha(theme.surface, 0.85),
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.referTitle, { color: theme.text }]}>Pass the Story Forward ✦</Text>
            <Text style={[styles.referSub, { color: theme.textDim }]}>
              Invite fellow story lovers to immerse themselves in interactive storytelling. No accounts, no ads, 100% private.
            </Text>
          </View>

          {/* Bottom spacer for floating bar */}
          <View style={{ height: 110 }} />
        </View>
      </ScrollView>

      {/* 9. Fixed Floating Action Bar: Chat Now */}
      <View
        style={[
          styles.fixedBar,
          {
            backgroundColor: withAlpha(theme.bgSoft, 0.96),
            borderTopColor: theme.border,
          },
        ]}
      >
        <View style={styles.fixedBarInner}>
          {saves.length > 0 ? (
            <View style={{ flex: 1 }}>
              <GradientButton
                title={activeSave ? 'Resume Journey' : 'Chat Now'}
                loading={starting}
                onPress={() => {
                  if (activeSave) {
                    navigation.navigate('Chat', { playthroughId: activeSave.id });
                  } else {
                    void startNew();
                  }
                }}
              />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <GradientButton
                title="Chat Now"
                loading={starting}
                onPress={() => void startNew()}
              />
            </View>
          )}

          {saves.length > 0 ? (
            <View style={styles.savedBtnWrap}>
              <GradientButton
                title={`Saves (${saves.length})`}
                variant="ghost"
                onPress={() => navigation.navigate('Saves', { storyId })}
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* Fullscreen Lightbox Modal */}
      {lightboxIndex !== null && gallery[lightboxIndex] ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setLightboxIndex(null)}
        >
          <View style={styles.lightbox}>
            <Pressable
              style={styles.lightboxClose}
              onPress={() => setLightboxIndex(null)}
              accessibilityLabel="Close image preview"
            >
              <Text style={styles.lightboxCloseText}>✕</Text>
            </Pressable>

            {/* Previous button */}
            {lightboxIndex > 0 ? (
              <Pressable
                style={[styles.lightboxNav, { left: 16 }]}
                onPress={() => setLightboxIndex(lightboxIndex - 1)}
                accessibilityLabel="Previous image"
              >
                <Text style={styles.lightboxNavText}>‹</Text>
              </Pressable>
            ) : null}

            {/* Next button */}
            {lightboxIndex < gallery.length - 1 ? (
              <Pressable
                style={[styles.lightboxNav, { right: 16 }]}
                onPress={() => setLightboxIndex(lightboxIndex + 1)}
                accessibilityLabel="Next image"
              >
                <Text style={styles.lightboxNavText}>›</Text>
              </Pressable>
            ) : null}

            <LightboxImage
              url={mediaApiUrl(apiBase, bundle.meta.storyDir, gallery[lightboxIndex].file)}
              accent={meta.accentColor}
            />

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
  scene: 'SCENE',
  other: 'ART',
};

function MediaTile({
  item,
  index,
  storyDir,
  bundle,
  onPress,
}: {
  item: StoryMediaItem;
  index: number;
  storyDir: string;
  bundle: StoryBundle;
  onPress: () => void;
}) {
  const { theme, settings } = useApp();
  const apiBase = effectiveContentApiBaseUrl(settings.contentApiBaseUrl);
  const url = mediaApiUrl(apiBase, storyDir, item.file);

  const character = item.characterId
    ? bundle.characters?.characters?.find((c) => c.id === item.characterId)
    : null;
  const label = item.label || character?.name || (item.kind === 'cover' ? 'Cover' : 'Artwork');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${label}`}
      style={[
        styles.mediaTile,
        {
          borderColor: theme.border,
        },
      ]}
    >
      <NaturalImage
        source={{ uri: url }}
        style={styles.mediaImg}
        fallback={
          <View style={styles.mediaFallback}>
            <Text style={styles.mediaFallbackEmoji}>🖼️</Text>
            <Text style={[styles.mediaFallbackText, { color: theme.textDim }]}>{label}</Text>
          </View>
        }
      />
      <View style={[styles.mediaBadge, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
        <Text style={[styles.mediaBadgeText, { color: theme.accent }]}>{KIND_BADGE[item.kind]}</Text>
      </View>
      <LinearGradient
        colors={['transparent', 'rgba(9,8,12,0.85)']}
        style={styles.mediaLabelShade}
      />
      <Text style={[styles.mediaLabel, { color: '#fff' }]} numberOfLines={1}>
        {label}
        {item.kind === 'character-portrait' ? '' : ` • ${index + 1}`}
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
        placeholder={<ActivityIndicator size="large" color={accent} />}
        fallback={
          <View style={styles.lightboxFallback}>
            <Text style={styles.lightboxFallbackEmoji}>🖼️</Text>
            <Text style={[styles.lightboxFallbackText, { color: '#B9AEE0' }]}>
              Image could not be loaded.
            </Text>
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
      <SectionHeader title="Story Creator" kicker="Author" />
      <View style={[styles.creatorCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.creatorAvatar, { backgroundColor: theme.primarySoft }]}>
          <Text style={styles.creatorInitial}>{display.name[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.creatorName, { color: theme.text }]}>
            {display.name}
            {display.verified ? (
              <Text style={{ color: theme.info, fontWeight: '900' }}> ✓ Verified</Text>
            ) : null}
          </Text>
          <Text style={[styles.creatorSub, { color: theme.textDim }]}>
            {display.name === KISSA_OWNER_CREATOR.name ? 'Kissa creator & curator' : 'Community storyteller'}
          </Text>
        </View>
      </View>
    </>
  );
}

function SimilarStoriesBlock({
  storyId,
  navigation,
}: {
  storyId: string;
  navigation: Props['navigation'];
}) {
  const { theme, stories } = useApp();
  const others = stories.filter((s) => s.id !== storyId).slice(0, 3);
  if (others.length === 0) return null;

  return (
    <>
      <SectionHeader title="Similar Stories" kicker="More to Explore" />
      <View style={styles.similarRow}>
        {others.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.similarCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => navigation.push('StoryDetail', { storyId: s.id })}
          >
            <Text style={[styles.similarTitle, { color: theme.text }]} numberOfLines={2}>
              {s.title}
            </Text>
            <Text style={[styles.similarGenre, { color: theme.accent }]} numberOfLines={1}>
              {s.genres[0]}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16 },
  coverWrap: { width: '100%', position: 'relative' },
  cover: { width: '100%' },
  coverShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 220 },
  back: {
    position: 'absolute',
    top: 50,
    left: 16,
    backgroundColor: 'rgba(9,8,12,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(246,244,248,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
  },
  backText: { color: '#F6F4F8', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  fav: {
    position: 'absolute',
    top: 46,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(9,8,12,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(246,244,248,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favText: { fontSize: 20 },
  body: { paddingHorizontal: 18, marginTop: -24 },
  title: { ...TYPE.display, lineHeight: 34, letterSpacing: -0.5 },
  tagline: { fontSize: 15, fontWeight: '700', marginTop: 6, letterSpacing: 0.15, lineHeight: 22 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, marginTop: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  tag: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: 12, fontWeight: '600' },
  desc: { fontSize: 15, lineHeight: 24, marginTop: 4, letterSpacing: 0.1 },
  roleCard: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginTop: 18,
    gap: 6,
  },
  roleKicker: { ...TYPE.overline, letterSpacing: 1.4 },
  roleDesc: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  mediaTile: {
    width: '48%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#121018',
  },
  mediaImg: { width: '100%' },
  mediaBadge: { position: 'absolute', top: 8, left: 8, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 4 },
  mediaBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  mediaLabelShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 48 },
  mediaLabel: { position: 'absolute', left: 10, right: 10, bottom: 8, fontSize: 11, fontWeight: '800', letterSpacing: 0.1 },
  mediaFallback: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, minHeight: 120 },
  mediaFallbackEmoji: { fontSize: 28 },
  mediaFallbackText: { fontSize: 11, fontWeight: '700' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  lightboxImageWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  lightboxImage: { width: '100%', maxHeight: '88%' },
  lightboxLabel: { color: '#F6F4F8', fontSize: 14, fontWeight: '700', marginTop: 14, paddingHorizontal: 24, letterSpacing: 0.2 },
  lightboxNav: {
    position: 'absolute',
    top: '46%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    zIndex: 10,
  },
  lightboxNavText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  lightboxClose: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 10,
  },
  lightboxCloseText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  lightboxFallback: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  lightboxFallbackEmoji: { fontSize: 40 },
  lightboxFallbackText: { fontSize: FONTS.small, fontWeight: '700' },
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginTop: 6,
    ...SHADOWS.card,
  },
  creatorAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  creatorInitial: { color: '#fff', fontSize: 20, fontWeight: '900' },
  creatorName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  creatorSub: { fontSize: 12, marginTop: 3, opacity: 0.9 },
  similarRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  similarCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, padding: 14, minHeight: 96, justifyContent: 'center', ...SHADOWS.card },
  similarTitle: { fontSize: 13, fontWeight: '800', lineHeight: 18, letterSpacing: -0.1 },
  similarGenre: { fontSize: 10, fontWeight: '700', marginTop: 6, letterSpacing: 0.4, textTransform: 'uppercase' },
  referCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 18, marginTop: 6, ...SHADOWS.card, borderStyle: 'dashed' },
  referTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  referSub: { fontSize: 13, marginTop: 6, lineHeight: 20, opacity: 0.9 },
  fixedBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 14,
    paddingBottom: 22,
    ...SHADOWS.floating,
  },
  fixedBarInner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  savedBtnWrap: {
    minWidth: 110,
  },
});
