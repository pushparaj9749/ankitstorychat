/**
 * Story detail — the canonical page structure:
 *   1. Hero Cover
 *   2. Story Tags (genres, age badge, #tags)
 *   3. About Story (title, tagline, description, quick facts)
 *   4. Media Library (cover + character portraits + scene stills + more)
 *   5. Story Creator
 *   6. Similar Stories
 *   7. Fixed "Chat Now" bar
 *   8. Refer Kissa
 *
 * Deliberately NOT present: comments, rating statistics, chat statistics,
 * external Share buttons, Content Updates. Media is rendered from the story
 * package's `media` block (safe, allowlisted asset refs) via the existing
 * story API — no separate media architecture.
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
import { listPlaythroughsForStory, updateStats } from '../lib/db';
import { createPlaythrough, playthroughLabel } from '../lib/playthrough';
import { seedMemoriesIfEmpty } from '../lib/memory';
import { insertMessage } from '../lib/db';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE } from '../theme';
import { uid } from '../lib/utils';

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
  /** V2: playback streams from the API; when offline show the offline gate. */
  const [offline, setOffline] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const meta = stories.find((s) => s.id === storyId);
  const isFav = favoriteIds.has(storyId);
  const apiBase = effectiveContentApiBaseUrl(settings.contentApiBaseUrl);
  const cover = meta ? getBundledCoverSource(meta, apiBase) : null;
  /** Story text refers to the reader via {{playerName}} — show the real name. */
  const forPlayer = makePlayerTextFn(meta, profile?.nickname);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!profile) return;
      setOffline(false);
      setError(null);
      try {
        // V2: the package always streams from the story API. Offline, this
        // throws a 'network' StoryContentError and we show the offline gate.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, profile, reloadKey]);

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
      Alert.alert('AI Setup Required 🤖', 'Story khelne ke liye pehle AI provider add karo. Offline mode ab hataya gaya hai.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add AI', onPress: () => navigation.navigate('AIAddons') },
      ]);
      return;
    }

    setStarting(true);
    try {
      const existing = await listPlaythroughsForStory(storyId);
      const mode = 'ai' as const;
      const pt = await createPlaythrough(
        bundle,
        playthroughLabel(existing.length),
        mode,
        activeProvider!.id,
      );

      // Seed opening narration as messages + seed memories (from bundle directly, no offline engine).
      // The opening block is the pre-chat cinematic introduction — the reader's
      // own name must appear in it, never a hardcoded one.
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
      await seedMemoriesIfEmpty(
        pt,
        bundle.memory.seedMemories.map((m) => interpolatePlayerName(m, pn, pnOptions)),
      );
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
  // V2: playback streams from the story API. Without a connection we show a
  // clear offline gate with Retry — never a silent fallback to cached content.
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
  const hasAI = !!activeProvider && providersWithKeys.has(activeProvider.id);

  return (
    <Screen padded={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 1. Hero cover — rendered at the artwork's own aspect ratio. */}
        <View style={styles.coverWrap}>
          <CoverImage
            source={cover}
            accentColor={meta.accentColor}
            fallbackLetter={meta.title}
            style={styles.cover}
            placeholderMinHeight={300}
          />
          <LinearGradient
            colors={['transparent', theme.bg]}
            style={styles.coverShade}
          />
          <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Go back">
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
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
          {/* 2. Story tags */}
          <View style={styles.metaRow}>
            {meta.genres.map((g) => (
              <GenreChip key={g} genre={g} />
            ))}
            <AgeBadge ageRating={meta.ageRating} />
          </View>
          {meta.tags.length > 0 ? (
            <View style={[styles.tags, { marginBottom: 10 }]}>
              {meta.tags.slice(0, 8).map((t) => (
                <View key={t} style={[styles.tag, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.tagText, { color: theme.textDim }]}>#{t}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* 3. About story */}
          <Text style={[styles.title, { color: theme.text }]}>{meta.title}</Text>
          <Text style={[styles.tagline, { color: theme.accent }]}>{forPlayer(meta.tagline)}</Text>
          <Text style={[styles.desc, { color: theme.textDim }]}>{forPlayer(meta.description)}</Text>

          <View style={[styles.infoBox, { backgroundColor: theme.surface, borderColor: theme.border }]} >
            <InfoRow label="🎭 You play" value={forPlayer(bundle.story.userRole ?? meta.userRole)} />
            <InfoRow label="📍 Setting" value={meta.setting} />
            <InfoRow
              label="💬 Mode"
              value={hasAI ? `AI • ${activeProvider!.model}` : 'AI Required'}
            />
          </View>

          {saves.length > 0 ? (
            <View style={styles.gap}>
              <GradientButton
                title={`💾 Saves (${saves.length})`}
                variant="ghost"
                onPress={() => navigation.navigate('Saves', { storyId })}
              />
            </View>
          ) : null}
          {activeSave ? (
            <View style={styles.gap}>
              <GradientButton
                title="🧠 Kya yaad hai"
                variant="ghost"
                onPress={() =>
                  navigation.navigate('Memory', { playthroughId: activeSave.id, storyTitle: meta.title })
                }
              />
            </View>
          ) : null}
          {!hasAI ? (
            <Pressable
              onPress={() => navigation.navigate('AIAddons')}
              style={[styles.aiHint, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}
            >
              <Text style={[styles.aiHintText, { color: theme.text }]}>
                🤖 AI provider setup karo to play. Offline mode hata diya gaya hai. Tap to add your own AI key.
              </Text>
            </Pressable>
          ) : null}

          {/* 4. Media Library */}
          <MediaLibrary bundle={bundle} apiBase={apiBase} />

          {/* 5. Story Creator */}
          <CreatorBlock creator={bundle.creator} />

          {/* 6. Similar Stories */}
          <SimilarStoriesBlock storyId={storyId} navigation={navigation} />

          {/* 8. Refer Kissa (in-app invite only — no external share) */}
          <SectionHeader title="Refer Kissa" />
          <Pressable
            onPress={() => {
              Alert.alert(
                'Refer Kissa',
                'Share Kissa with a friend — download the free APK from the official site and send them your favorite story. No account, no limits, no tracking.',
              );
            }}
            style={[styles.referCard, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
          >
            <Text style={[styles.referTitle, { color: theme.accent }]}>🎁 Invite a friend</Text>
            <Text style={[styles.referSub, { color: theme.textDim }]}>
              Free forever. No coins, no sign-up, no tracking.
            </Text>
          </Pressable>

          <View style={{ height: SPACING.xxl + 80 }} />
        </View>
      </ScrollView>

      {/* 7. Fixed Chat Now button — always above the keyboard/bottom chrome. */}
      <View style={[styles.fixedBar, { backgroundColor: theme.bgSoft, borderTopColor: theme.border }]}>
        {activeSave ? (
          <GradientButton title={`▶ Continue — ${activeSave.label}`} onPress={() => navigation.navigate('Chat', { playthroughId: activeSave.id })} />
        ) : (
          <GradientButton title="Chat Now" onPress={startNew} loading={starting} disabled={starting} />
        )}
      </View>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Media Library                                                       */
/* ------------------------------------------------------------------ */

const KIND_BADGE: Record<StoryMediaItem['kind'], string> = {
  cover: 'COVER',
  'character-portrait': 'PORTRAIT',
  scene: 'SCENE',
  other: 'MEDIA',
};

function mediaLabel(item: StoryMediaItem, characterName?: string): string {
  if (item.kind === 'cover') return 'Cover';
  if (item.kind === 'character-portrait') return characterName ?? 'Character portrait';
  if (item.kind === 'scene') return 'Scene';
  return item.label || 'Story media';
}

function MediaLibrary({ bundle, apiBase }: { bundle: StoryBundle; apiBase: string }) {
  const { theme } = useApp();
  const [lightbox, setLightbox] = useState<number | null>(null);

  const media = bundle.story.media;
  if (!media || !Array.isArray(media.gallery) || media.gallery.length === 0) return null;
  const items = media.gallery;
  const characterName = (id?: string) =>
    id ? bundle.characters.characters.find((c) => c.id === id)?.name : undefined;
  const urlFor = (it: StoryMediaItem) =>
    mediaApiUrl(apiBase, bundle.meta.storyDir, it.file);

  return (
    <>
      <SectionHeader title={`Media Library (${items.length})`} />
      <View style={styles.mediaGrid}>
        {items.map((it, i) => (
          <MediaThumb
            key={`${it.id}-${i}`}
            item={it}
            index={i}
            url={urlFor(it)}
            label={mediaLabel(it, characterName(it.characterId))}
            onOpen={() => setLightbox(i)}
          />
        ))}
      </View>

      {/* Fullscreen lightbox with prev/next + loading + broken-image fallback. */}
      <Modal visible={lightbox !== null} animationType="fade" transparent onRequestClose={() => setLightbox(null)}>
        <View style={styles.lightbox}>
          {lightbox !== null ? (
            <LightboxImage
              key={`${items[lightbox].file}-${lightbox}`}
              url={urlFor(items[lightbox])}
              accent={theme.accent}
            />
          ) : null}
          {lightbox !== null ? (
            <Text style={styles.lightboxLabel} numberOfLines={1}>
              {mediaLabel(items[lightbox], characterName(items[lightbox].characterId))}
              {'  •  '}{lightbox + 1}/{items.length}
            </Text>
          ) : null}
          {items.length > 1 && lightbox !== null ? (
            <>
              <Pressable
                style={[styles.lightboxNav, { left: 10 }]}
                onPress={() => setLightbox((lightbox + items.length - 1) % items.length)}
                accessibilityLabel="Previous image"
              >
                <Text style={styles.lightboxNavText}>‹</Text>
              </Pressable>
              <Pressable
                style={[styles.lightboxNav, { right: 10 }]}
                onPress={() => setLightbox((lightbox + 1) % items.length)}
                accessibilityLabel="Next image"
              >
                <Text style={styles.lightboxNavText}>›</Text>
              </Pressable>
            </>
          ) : null}
          <Pressable
            style={styles.lightboxClose}
            onPress={() => setLightbox(null)}
            accessibilityLabel="Close preview"
          >
            <Text style={styles.lightboxCloseText}>✕</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function MediaThumb({
  item,
  index,
  url,
  label,
  onOpen,
}: {
  item: StoryMediaItem;
  index: number;
  url: string;
  label: string;
  onOpen: () => void;
}) {
  const { theme } = useApp();

  return (
    <Pressable
      onPress={onOpen}
      style={[styles.mediaTile, { backgroundColor: theme.bgSoft, borderColor: theme.border }]}
      accessibilityLabel={`Open ${label}`}
    >
      {/* Gallery tile at the image's OWN aspect ratio — tiles are not forced
          into one shape; the two-column wrap flows around each natural size. */}
      <NaturalImage
        source={{ uri: url }}
        style={styles.mediaImg}
        tint={theme.surface}
        placeholder={<ActivityIndicator size="small" color={theme.accent} />}
        fallback={
          <View style={styles.mediaFallback}>
            <Text style={styles.mediaFallbackEmoji}>🖼️</Text>
            <Text style={[styles.mediaFallbackText, { color: theme.textFaint }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        }
      />
      <View style={[styles.mediaBadge, { backgroundColor: 'rgba(0,0,0,0.62)' }]}>
        <Text style={[styles.mediaBadgeText, { color: theme.accent }]}>{KIND_BADGE[item.kind]}</Text>
      </View>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.72)']}
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
      {/* Fullscreen view: the image keeps its own ratio, bounded by contain —
          tall artwork letterboxes instead of being cropped or stretched. */}
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

/* ------------------------------------------------------------------ */
/* Creator / similar / info                                            */
/* ------------------------------------------------------------------ */

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
  // Pick up to 3 other stories deterministically as "similar" — avoids adding
  // a heavy recommendation engine while still showing the section.
  const others = stories.filter((s) => s.id !== storyId).slice(0, 3);
  if (others.length === 0) return null;
  return (
    <>
      <SectionHeader title="Similar Stories" />
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

function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useApp();
  return (
    <View style={infoStyles.row}>
      <Text style={[infoStyles.label, { color: theme.textDim }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 6, gap: 8 },
  label: { fontSize: FONTS.small, width: 86, fontWeight: '700' },
  value: { fontSize: FONTS.small, flex: 1 },
});

const styles = StyleSheet.create({
  // Hero cover: in-flow child rendered at the artwork's own aspect ratio —
  // the wrap and the gradient shade follow the cover's natural height.
  coverWrap: { width: '100%' },
  cover: { width: '100%' },
  coverShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 170 },
  back: { position: 'absolute', top: 52, left: 16 },
  backText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  fav: { position: 'absolute', top: 48, right: 16 },
  favText: { fontSize: 26 },
  body: { paddingHorizontal: 16, marginTop: -30 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  title: { ...TYPE.display, lineHeight: TYPE.display.fontSize + 6 },
  tagline: { fontSize: FONTS.body, fontWeight: '600', marginTop: 5, letterSpacing: 0.1 },
  desc: { fontSize: FONTS.body, lineHeight: 24, marginTop: 10 },
  infoBox: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, marginTop: 16, ...SHADOWS.card },
  gap: { marginTop: 12 },
  aiHint: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, marginTop: 12 },
  aiHintText: { fontSize: FONTS.small, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: FONTS.small },
  /* ---------------- media library ---------------- */
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  // Masonry-style tiles: fixed width, height follows each image's own ratio.
  mediaTile: {
    width: '47%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mediaImg: { width: '100%' },
  mediaBadge: { position: 'absolute', top: 8, left: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  mediaBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  mediaLabelShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44 },
  mediaLabel: { position: 'absolute', left: 10, right: 10, bottom: 8, fontSize: FONTS.small, fontWeight: '800' },
  mediaFallback: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10 },
  mediaFallbackEmoji: { fontSize: 26 },
  mediaFallbackText: { fontSize: 11, fontWeight: '700' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  lightboxImageWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  // Bounded fullscreen view: contain-sized, so the image keeps its own ratio.
  lightboxImage: { width: '100%', maxHeight: '100%' },
  lightboxLabel: { color: '#F5F1FF', fontSize: FONTS.body, fontWeight: '700', marginTop: 10, paddingHorizontal: 24 },
  lightboxNav: {
    position: 'absolute',
    top: '44%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxNavText: { color: '#fff', fontSize: 30, fontWeight: '300', lineHeight: 34 },
  lightboxClose: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxCloseText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  lightboxFallback: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  lightboxFallbackEmoji: { fontSize: 40 },
  lightboxFallbackText: { fontSize: FONTS.small, fontWeight: '700' },
  /* ---------------- creator / similar / refer ---------------- */
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginTop: 4,
    ...SHADOWS.card,
  },
  creatorAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  creatorInitial: { color: '#fff', fontSize: 20, fontWeight: '900' },
  creatorName: { fontSize: FONTS.body, fontWeight: '800' },
  creatorSub: { fontSize: FONTS.small, marginTop: 2 },
  similarRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  similarCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, padding: 12, minHeight: 90, justifyContent: 'center' },
  similarTitle: { fontSize: FONTS.small, fontWeight: '800' },
  similarGenre: { fontSize: FONTS.tiny, fontWeight: '700', marginTop: 4 },
  referCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, marginTop: 4, ...SHADOWS.card },
  referTitle: { fontSize: FONTS.heading, fontWeight: '900' },
  referSub: { fontSize: FONTS.small, marginTop: 6, lineHeight: 20 },
  fixedBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 12,
    paddingBottom: 16,
  },
});
