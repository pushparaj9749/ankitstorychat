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
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import {
  getBundledCoverSource,
  getBundle,
  downloadStory,
  defaultManifestUrl,
  isStoryOnDevice,
  StoryContentError,
} from '../content/loader';
import { AgeRestrictedError } from '../lib/ageGate';
import { listPlaythroughsForStory, updateStats } from '../lib/db';
import { createPlaythrough, playthroughLabel } from '../lib/playthrough';
import { seedMemoriesIfEmpty } from '../lib/memory';
import { insertMessage } from '../lib/db';
import { FONTS, RADIUS, SPACING } from '../theme';
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
  /** Story exists in the catalog but its files are not on this device yet
   *  (new GitHub-only release) — offer an in-place download, no app update. */
  const [needsDownload, setNeedsDownload] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadStep, setDownloadStep] = useState<string | null>(null);

  const meta = stories.find((s) => s.id === storyId);
  const isFav = favoriteIds.has(storyId);
  const cover = meta ? getBundledCoverSource(meta) : null;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!profile) return;
      setNeedsDownload(false);
      setError(null);
      try {
        // A story listed in the manifest but never downloaded goes straight to
        // the download offer — no failed load, no "Couldn't open story" flash.
        if (!(await isStoryOnDevice(storyId))) {
          if (!alive) return;
          setNeedsDownload(true);
          return;
        }
        const b = await getBundle(storyId, profile.ageGroup);
        if (!alive) return;
        setBundle(b);
        setSaves(await listPlaythroughsForStory(storyId));
      } catch (e) {
        if (!alive) return;
        if (e instanceof AgeRestrictedError) setRestricted(true);
        else {
          // Only "the package is not on this device" is recoverable by
          // downloading. Corrupt data / no network are real errors — showing a
          // Download button for those would just fail again.
          const missing = e instanceof StoryContentError && e.code === 'missing';
          setError(missing ? null : e instanceof Error ? e.message : 'Could not open story.');
          setNeedsDownload(missing && !!meta && !!profile);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, profile]);

  async function downloadNow() {
    if (!profile || !meta || downloading) return;
    setDownloading(true);
    setDownloadStep('Files laam ho rahi hain…');
    try {
      await downloadStory(meta, settings.contentManifestUrl || defaultManifestUrl(), profile.ageGroup, (file) =>
        setDownloadStep(file === 'done' ? 'Verify ho rahi hai…' : `${file} download…`),
      );
      const b = await getBundle(meta.id, profile.ageGroup);
      await refreshStories();
      setBundle(b);
      setError(null);
      setNeedsDownload(false);
      setSaves(await listPlaythroughsForStory(meta.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      setDownloading(false);
      setDownloadStep(null);
    }
  }

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
      const openingScene = bundle.scenes.scenes.find((s) => s.id === bundle.story.openingSceneId) ?? bundle.scenes.scenes[0];
      let i = 0;
      for (const line of openingScene.narration) {
        await insertMessage({
          id: uid('m'),
          playthroughId: pt.id,
          role: i === 0 ? 'narration' : 'assistant',
          speaker: null,
          text: line,
          sceneId: openingScene.id,
          createdAt: new Date(Date.now() + i).toISOString(),
        });
        i++;
      }
      await seedMemoriesIfEmpty(pt, bundle.memory.seedMemories);
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
  // Checked BEFORE the generic error branch: a story whose package is simply
  // absent is recoverable by downloading. Rendering the error first made this
  // branch unreachable — OTA stories dead-ended on "Couldn't open story".
  if (!bundle && needsDownload && meta) {
    return (
      <Screen padded={false}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.coverWrap}>
            {cover ? (
              <Image source={cover} style={styles.cover} resizeMode="cover" />
            ) : (
              <View style={[styles.cover, { backgroundColor: `${meta.accentColor}44` }]} />
            )}
            <LinearGradient colors={['transparent', theme.bg]} style={styles.coverShade} />
            <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Go back">
              <Text style={styles.backText}>‹ Back</Text>
            </Pressable>
          </View>
          <View style={styles.body}>
            <Text style={[styles.title, { color: theme.text }]}>{meta.title}</Text>
            <Text style={[styles.tagline, { color: theme.accent }]}>Ye nayi story abhi download nahi hui</Text>
            <Text style={[styles.desc, { color: theme.textDim }]}>
              Naye stories app update ke bina GitHub se aati hain. Neeche download karo — 5 second, aur
              kahani hamesha ke liye offline ready.{' '}
              {error ? `(Detail: ${error})` : ''}
            </Text>
            <View style={styles.gap}>
              <GradientButton
                title={`⬇ Download "${meta.title}" (~${meta.estimatedMinutes} min)`}
                loading={downloading}
                onPress={() => void downloadNow()}
              />
            </View>
            {downloadStep ? (
              <Text style={[styles.step, { color: theme.textDim }]}>{downloadStep}</Text>
            ) : null}
          </View>
        </ScrollView>
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
            {bundle.source === 'downloaded' ? (
              <View style={[styles.dlBadge, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.dlText, { color: theme.primary }]}>⬇ Downloaded</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.title, { color: theme.text }]}>{meta.title}</Text>
          <Text style={[styles.tagline, { color: theme.accent }]}>{meta.tagline}</Text>
          <Text style={[styles.desc, { color: theme.textDim }]}>{meta.description}</Text>

          <View style={[styles.infoBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <InfoRow label="🎭 You play" value={meta.userRole} />
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
  coverWrap: { height: 260 },
  cover: { width: '100%', height: 260 },
  coverShade: { position: 'absolute', left: 0, right: 0, top: 120, height: 140 },
  back: { position: 'absolute', top: 52, left: 16 },
  backText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  fav: { position: 'absolute', top: 48, right: 16 },
  favText: { fontSize: 26 },
  body: { paddingHorizontal: 16, marginTop: -30 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  dlBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  dlText: { fontSize: 11, fontWeight: '800' },
  step: { fontSize: FONTS.small, marginTop: 8, textAlign: 'center' },
  title: { fontSize: 30, fontWeight: '900' },
  tagline: { fontSize: FONTS.body, fontWeight: '600', marginTop: 4 },
  desc: { fontSize: FONTS.body, lineHeight: 23, marginTop: 10 },
  infoBox: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, marginTop: 16 },
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
