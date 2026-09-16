/** Story detail: cover, meta, characters, start/continue, saves, download. AI-only now. */
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Playthrough, RootStackParamList, StoryBundle } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { AgeBadge, Avatar, GenreChip, SectionHeader } from '../components/bits';
import { EmptyState, ErrorState, LoadingState, OfflineState } from '../components/states';
import {
  getBundledCoverSource,
  getBundle,
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
import { nowIso, uid } from '../lib/utils';

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
    refreshStories,
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
        <View style={styles.coverWrap}>
          {cover ? (
            <Image source={cover} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={[styles.cover, { backgroundColor: `${meta.accentColor}44` }]} />
          )}
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
          <View style={styles.metaRow}>
            {meta.genres.map((g) => (
              <GenreChip key={g} genre={g} />
            ))}
            <AgeBadge ageRating={meta.ageRating} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>{meta.title}</Text>
          <Text style={[styles.tagline, { color: theme.accent }]}>{forPlayer(meta.tagline)}</Text>
          <Text style={[styles.desc, { color: theme.textDim }]}>{forPlayer(meta.description)}</Text>

          <View style={[styles.infoBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <InfoRow label="🎭 You play" value={forPlayer(bundle.story.userRole ?? meta.userRole)} />
            <InfoRow label="📍 Setting" value={meta.setting} />
            <InfoRow label="⏱ Length" value={`~${meta.estimatedMinutes} min`} />
            <InfoRow
              label="💬 Mode"
              value={hasAI ? `AI • ${activeProvider!.model}` : 'AI Required'}
            />
          </View>

          {activeSave ? (
            <View style={styles.gap}>
              <GradientButton
                title={`▶ Continue — ${activeSave.label}`}
                onPress={() => navigation.navigate('Chat', { playthroughId: activeSave.id })}
              />
            </View>
          ) : null}
          <View style={styles.gap}>
            <GradientButton
              title={activeSave ? '✨ Start new journey' : '▶ Start story'}
              variant={activeSave ? 'ghost' : 'primary'}
              loading={starting}
              onPress={startNew}
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
              <Text style={[styles.aiHintText, { color: '#D9CFFF' }]}>
                🤖 AI provider setup karo to play. Offline mode hata diya gaya hai. Tap to add your own AI key.
              </Text>
            </Pressable>
          ) : null}

          <SectionHeader title="Characters" />
          {bundle.characters.characters.map((c) => (
            <View key={c.id} style={[styles.char, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Avatar id={c.id} name={c.name} size={46} />
              <View style={styles.charBody}>
                <Text style={[styles.charName, { color: theme.text }]}>{c.name}</Text>
                <Text style={[styles.charRole, { color: theme.accent }]}>{c.role}</Text>
                <Text style={[styles.charLine, { color: theme.textDim }]} numberOfLines={2}>
                  “{c.sampleLine}”
                </Text>
              </View>
            </View>
          ))}

          <SectionHeader title="Tags" />
          <View style={styles.tags}>
            {meta.tags.map((t) => (
              <View key={t} style={[styles.tag, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.tagText, { color: theme.textDim }]}>#{t}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: SPACING.xxl }} />
        </View>
      </ScrollView>
    </Screen>
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
  coverWrap: { height: 300 },
  cover: { width: '100%', height: 300 },
  coverShade: { position: 'absolute', left: 0, right: 0, top: 140, height: 160 },
  back: { position: 'absolute', top: 52, left: 16 },
  backText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  fav: { position: 'absolute', top: 48, right: 16 },
  favText: { fontSize: 26 },
  body: { paddingHorizontal: 16, marginTop: -30 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  dlBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  dlText: { fontSize: 11, fontWeight: '800' },
  step: { fontSize: FONTS.small, marginTop: 8, textAlign: 'center' },
  title: { ...TYPE.display, lineHeight: TYPE.display.fontSize + 6 },
  tagline: { fontSize: FONTS.body, fontWeight: '600', marginTop: 5, letterSpacing: 0.1 },
  desc: { fontSize: FONTS.body, lineHeight: 24, marginTop: 10 },
  infoBox: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, marginTop: 16, ...SHADOWS.card },
  gap: { marginTop: 12 },
  aiHint: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, marginTop: 12 },
  aiHintText: { fontSize: FONTS.small, lineHeight: 20 },
  char: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 10,
  },
  charBody: { flex: 1 },
  charName: { fontSize: FONTS.body, fontWeight: '800' },
  charRole: { fontSize: FONTS.tiny, fontWeight: '700', marginTop: 1 },
  charLine: { fontSize: FONTS.small, fontStyle: 'italic', marginTop: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: FONTS.small },
});
