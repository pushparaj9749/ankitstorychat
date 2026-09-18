/**
 * KISSA v4.2 — Story Detail
 * Structure: Hero Cover (natural ratio), Title, Tags, About, Media Library, Creator, Similar, Fixed Chat Now
 * No comments, ratings, chat stats, external share.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Playthrough, RootStackParamList, StoryBundle, StoryCreator, StoryMediaItem } from '../types';
import { KISSA_OWNER_CREATOR } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { CoverImage } from '../components/CoverImage';
import { NaturalImage } from '../components/NaturalImage';
import { AgeBadge, GenreChip, SectionHeader } from '../components/bits';
import { ErrorState, LoadingState, OfflineState } from '../components/states';
import { getBundledCoverSource, getBundle, mediaApiUrl, effectiveContentApiBaseUrl, StoryContentError } from '../content/loader';
import { interpolatePlayerName, makePlayerTextFn } from '../lib/playerName';
import { AgeRestrictedError } from '../lib/ageGate';
import { listPlaythroughsForStory, updateStats, insertMessage } from '../lib/db';
import { createPlaythrough, playthroughLabel } from '../lib/playthrough';
import { seedMemoriesIfEmpty } from '../lib/memory';
import { ensureWorldState } from '../lib/worldState';
import { RADIUS, SHADOWS, TYPE, withAlpha, GRADIENTS } from '../theme';
import { uid } from '../lib/utils';
import { mediumBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'StoryDetail'>;

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

  return (
    <Screen padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.coverWrap}>
          <CoverImage source={cover} accentColor={meta.accentColor} fallbackLetter={meta.title} style={styles.cover} placeholderMinHeight={320} />
          <LinearGradient colors={['transparent', 'rgba(6,6,10,0.55)', theme.bg]} locations={[0, 0.5, 1]} style={styles.coverShade} />
          <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Go back">
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Pressable onPress={() => void toggleFavorite(storyId)} style={styles.fav} accessibilityLabel={isFav ? 'Remove favorite' : 'Add favorite'}>
            <Text style={styles.favText}>{isFav ? '♥' : '♡'}</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: theme.text }]}>{meta.title}</Text>
          <Text style={[styles.tagline, { color: theme.textDim }]}>{forPlayer(meta.tagline)}</Text>

          <View style={styles.metaRow}>
            {meta.genres.map((g) => (
              <GenreChip key={g} genre={g} />
            ))}
            <AgeBadge ageRating={meta.ageRating} />
          </View>

          {meta.tags.length > 0 ? (
            <View style={styles.tags}>
              {meta.tags.slice(0, 8).map((t) => (
                <View key={t} style={[styles.tag, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.tagText, { color: theme.textFaint }]}>#{t}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={[styles.desc, { color: theme.textDim }]}>{forPlayer(meta.description)}</Text>

          {bundle.story.userRole ? (
            <View style={[styles.roleCard, { backgroundColor: theme.surface, borderColor: theme.border }, SHADOWS.card]}>
              <Text style={[styles.roleKicker, { color: theme.textFaint }]}>YOU ARE</Text>
              <Text style={[styles.roleDesc, { color: theme.text }]}>{forPlayer(bundle.story.userRole)}</Text>
            </View>
          ) : null}

          {gallery.length > 0 ? (
            <>
              <SectionHeader title={`Media Library (${gallery.length})`} kicker="Artworks" />
              <View style={styles.mediaGrid}>
                {gallery.map((item, index) => (
                  <MediaTile key={item.id} item={item} index={index} storyDir={bundle.meta.storyDir} bundle={bundle} onPress={() => setLightboxIndex(index)} />
                ))}
              </View>
            </>
          ) : null}

          <CreatorBlock creator={bundle.creator} />
          <SimilarStoriesBlock storyId={storyId} navigation={navigation} />

          <SectionHeader title="Refer Kissa" kicker="Share" />
          <View style={[styles.referCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.referTitle, { color: theme.text }]}>Pass the story forward</Text>
            <Text style={[styles.referSub, { color: theme.textDim }]}>Invite friends to interactive stories. Local-first, private, no ads.</Text>
          </View>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      <View style={[styles.fixedBar, { backgroundColor: withAlpha(theme.bgSoft, 0.96), borderTopColor: theme.borderSoft }]}>
        <View style={styles.fixedBarInner}>
          <View style={{ flex: 1 }}>
            <GradientButton
              title={activeSave ? 'Resume Journey' : 'Chat Now'}
              loading={starting}
              onPress={() => {
                if (activeSave) navigation.navigate('Chat', { playthroughId: activeSave.id });
                else void startNew();
              }}
            />
          </View>
          {saves.length > 0 ? (
            <View style={styles.savedBtnWrap}>
              <GradientButton title={`Saves (${saves.length})`} variant="ghost" onPress={() => navigation.navigate('Saves', { storyId })} />
            </View>
          ) : null}
        </View>
      </View>

      {lightboxIndex !== null && gallery[lightboxIndex] ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLightboxIndex(null)}>
          <View style={styles.lightbox}>
            <Pressable style={styles.lightboxClose} onPress={() => setLightboxIndex(null)} accessibilityLabel="Close">
              <Text style={styles.lightboxCloseText}>✕</Text>
            </Pressable>
            {lightboxIndex > 0 ? (
              <Pressable style={[styles.lightboxNav, { left: 16 }]} onPress={() => setLightboxIndex(lightboxIndex - 1)}>
                <Text style={styles.lightboxNavText}>‹</Text>
              </Pressable>
            ) : null}
            {lightboxIndex < gallery.length - 1 ? (
              <Pressable style={[styles.lightboxNav, { right: 16 }]} onPress={() => setLightboxIndex(lightboxIndex + 1)}>
                <Text style={styles.lightboxNavText}>›</Text>
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
  scene: 'SCENE',
  other: 'ART',
};

function MediaTile({
  item,
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
  const character = item.characterId ? bundle.characters?.characters?.find((c) => c.id === item.characterId) : null;
  const label = item.label || character?.name || (item.kind === 'cover' ? 'Cover' : 'Artwork');

  return (
    <Pressable onPress={onPress} accessibilityLabel={`View ${label}`} style={[styles.mediaTile, { borderColor: theme.border }]}>
      <NaturalImage
        source={{ uri: url }}
        style={styles.mediaImg}
        fallback={
          <View style={styles.mediaFallback}>
            <Text style={styles.mediaFallbackEmoji}>◐</Text>
            <Text style={[styles.mediaFallbackText, { color: theme.textDim }]}>{label}</Text>
          </View>
        }
      />
      <View style={[styles.mediaBadge, { backgroundColor: 'rgba(0,0,0,0.60)' }]}>
        <Text style={[styles.mediaBadgeText, { color: '#F2F0EB' }]}>{KIND_BADGE[item.kind]}</Text>
      </View>
      <LinearGradient colors={['transparent', 'rgba(6,6,10,0.82)']} style={styles.mediaLabelShade} />
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
            <Text style={styles.lightboxFallbackEmoji}>◐</Text>
            <Text style={[styles.lightboxFallbackText, { color: '#A09CA8' }]}>Image unavailable.</Text>
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
        <View style={[styles.creatorAvatar, { backgroundColor: theme.surface2 }]}>
          <Text style={[styles.creatorInitial, { color: theme.text }]}>{display.name[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.creatorName, { color: theme.text }]}>
            {display.name}
            {display.verified ? <Text style={{ color: theme.textFaint, fontWeight: '600' }}> · Verified</Text> : null}
          </Text>
          <Text style={[styles.creatorSub, { color: theme.textDim }]}>
            {display.name === KISSA_OWNER_CREATOR.name ? 'Kissa creator' : 'Community storyteller'}
          </Text>
        </View>
      </View>
    </>
  );
}

function SimilarStoriesBlock({ storyId, navigation }: { storyId: string; navigation: Props['navigation'] }) {
  const { theme, stories } = useApp();
  const others = stories.filter((s) => s.id !== storyId).slice(0, 3);
  if (others.length === 0) return null;
  return (
    <>
      <SectionHeader title="Similar" kicker="More" />
      <View style={styles.similarRow}>
        {others.map((s) => (
          <Pressable key={s.id} style={[styles.similarCard, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => navigation.push('StoryDetail', { storyId: s.id })}>
            <Text style={[styles.similarTitle, { color: theme.text }]} numberOfLines={2}>
              {s.title}
            </Text>
            <Text style={[styles.similarGenre, { color: theme.textFaint }]} numberOfLines={1}>
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
  coverShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 200 },
  back: {
    position: 'absolute',
    top: 50,
    left: 16,
    backgroundColor: 'rgba(6,6,10,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(242,240,235,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  backText: { color: '#F2F0EB', fontSize: 13, fontWeight: '600' },
  fav: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(6,6,10,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(242,240,235,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favText: { fontSize: 16, color: '#F2F0EB' },
  body: { paddingHorizontal: 18, marginTop: -12 },
  title: { ...TYPE.displaySmall, lineHeight: 30 },
  tagline: { fontSize: 14, fontWeight: '500', marginTop: 6, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, marginTop: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  tag: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 11, fontWeight: '500' },
  desc: { fontSize: 14.5, lineHeight: 22, marginTop: 4 },
  roleCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, marginTop: 16, gap: 4 },
  roleKicker: { ...TYPE.tiny, letterSpacing: 1.2 },
  roleDesc: { fontSize: 13.5, lineHeight: 20, fontWeight: '500' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  mediaTile: { width: '48%', borderRadius: RADIUS.md, borderWidth: 1, overflow: 'hidden', backgroundColor: '#0E0E14' },
  mediaImg: { width: '100%' },
  mediaBadge: { position: 'absolute', top: 8, left: 8, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3 },
  mediaBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
  mediaLabelShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44 },
  mediaLabel: { position: 'absolute', left: 8, right: 8, bottom: 6, fontSize: 11, fontWeight: '600' },
  mediaFallback: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, minHeight: 110 },
  mediaFallbackEmoji: { fontSize: 20 },
  mediaFallbackText: { fontSize: 11, fontWeight: '500' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  lightboxImageWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  lightboxImage: { width: '100%', maxHeight: '86%' },
  lightboxLabel: { color: '#F2F0EB', fontSize: 12, fontWeight: '600', marginTop: 12, letterSpacing: 0.2 },
  lightboxNav: {
    position: 'absolute',
    top: '46%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    zIndex: 10,
  },
  lightboxNavText: { color: '#fff', fontSize: 22, fontWeight: '300' },
  lightboxClose: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    zIndex: 10,
  },
  lightboxCloseText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  lightboxFallback: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  lightboxFallbackEmoji: { fontSize: 28 },
  lightboxFallbackText: { fontSize: 12, fontWeight: '600' },
  creatorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, marginTop: 6 },
  creatorAvatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  creatorInitial: { fontSize: 16, fontWeight: '800' },
  creatorName: { fontSize: 14, fontWeight: '700' },
  creatorSub: { fontSize: 11.5, marginTop: 2 },
  similarRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  similarCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, padding: 12, minHeight: 86, justifyContent: 'center' },
  similarTitle: { fontSize: 12.5, fontWeight: '700', lineHeight: 16 },
  similarGenre: { fontSize: 10, fontWeight: '600', marginTop: 5, letterSpacing: 0.4, textTransform: 'uppercase' },
  referCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, marginTop: 6, borderStyle: 'dashed' },
  referTitle: { fontSize: 14, fontWeight: '700' },
  referSub: { fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  fixedBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, padding: 14, paddingBottom: 20 },
  fixedBarInner: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  savedBtnWrap: { minWidth: 100 },
});
