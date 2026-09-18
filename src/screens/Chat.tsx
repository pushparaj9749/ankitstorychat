/**
 * KISSA v2.4.2 — Chat / Interactive Fiction Stage
 * Completely rebuilt: cinematic story experience, NOT WhatsApp/Telegram clone.
 * - Narration: atmospheric, editorial, faded italic
 * - Character dialogue: name + dialogue, distinct
 * - Player: distinct, warm, minimal (solid text bubble)
 * - Scene transitions: subtle chapter dividers
 * - Composer: minimal cinematic, keyboard-safe, always accessible
 * - Bottom navigation hides, composer remains
 * - kissa-state leak fixed at parsing layer (engine.ts)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AIError, ChatMessage, ChoiceEffects, Playthrough, RootStackParamList, StoryBundle } from '../types';
import { useApp } from '../state/AppContext';
import { ChatBubble, TypingIndicator } from '../components/chat';
import { ErrorState, LoadingState, OfflineState } from '../components/states';
import { effectiveContentApiBaseUrl, getBundle, getBundledCoverSource, mediaApiUrl, StoryContentError, type CoverSource } from '../content/loader';
import { getApiKey } from '../lib/secureKeys';
import { aiErrorMessage, chatCompletion } from '../lib/ai';
import { applyEffects, buildContext, getScene, HISTORY_HEADROOM, parseAssistantResponse, progressEstimate, shortTermWindowOf } from '../lib/engine';
import { consolidateMemories, logEpisode, recallForTurn, rememberMany, rememberPreferences } from '../lib/memory';
import { ensureWorldState } from '../lib/worldState';
import { runMemoryWritePipeline, recallWithWorldState } from '../lib/memoryEngine';
import { listMemoryCandidates } from '../lib/db';
import { countMessages, getPlaythrough, insertMessage, listMessages, listRecentMessagesAsc, updatePlaythrough, updateStats } from '../lib/db';
import { completePlaythrough } from '../lib/playthrough';
import { interpolatePlayerName, makePlayerTextFn } from '../lib/playerName';
import { RADIUS, SHADOWS, TYPE, withAlpha, LAYOUT } from '../theme';
import { Icon, ICON_SIZE } from '../components/icons';
import { nowIso, uid } from '../lib/utils';
import { playReceive, playSend } from '../lib/sound';
import { lightBuzz, successBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;
const PAGE = 40;

function ChatStoryFace({ source, letter, accent }: { source: CoverSource | null; letter: string; accent: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (letter?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View style={[styles.face, { backgroundColor: `${accent}18`, borderColor: 'rgba(242,240,235,0.12)' }]}>
      {source && !failed ? (
        <Image source={source} style={styles.faceImg} resizeMode="contain" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      ) : (
        <Text style={[styles.faceLetter, { color: accent }]}>{initial}</Text>
      )}
    </View>
  );
}

export function Chat({ navigation, route }: Props) {
  const { playthroughId } = route.params;
  const { theme, profile, activeProvider, providersWithKeys, settings } = useApp();

  const [playthrough, setPlaythrough] = useState<Playthrough | null>(null);
  const [bundle, setBundle] = useState<StoryBundle | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [aiError, setAiError] = useState<AIError | null>(null);
  const [lastUserText, setLastUserText] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const aiReady = !!playthrough && !!activeProvider && providersWithKeys.has(activeProvider.id);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) {
        setLoading(true);
        setLoadError(null);
        setOffline(false);
      }
      try {
        const pt = await getPlaythrough(playthroughId);
        if (!pt) throw new Error('Journey not found.');
        if (!profile) throw new Error('Profile missing.');
        const b = await getBundle(pt.storyId, profile.ageGroup, settings.contentApiBaseUrl);
        const first = await listMessages(pt.id, PAGE);
        const total = await countMessages(pt.id);
        if (!alive) return;
        if (pt.mode !== 'ai') pt.mode = 'ai';
        setPlaythrough(pt);
        setBundle(b);
        setMessages(first);
        setHasMore(total > first.length);
        void ensureWorldState(pt, b).catch(() => undefined);
      } catch (e) {
        if (!alive) return;
        if (e instanceof StoryContentError && e.code === 'network') setOffline(true);
        else setLoadError(e instanceof Error ? e.message : 'Could not load chat.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [playthroughId, profile, reloadKey, settings.contentApiBaseUrl]);

  const scene = useMemo(() => (bundle && playthrough ? getScene(bundle, playthrough.currentSceneId) : null), [bundle, playthrough]);

  async function loadMore() {
    if (!playthrough || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const oldest = messages[messages.length - 1];
      const next = await listMessages(playthrough.id, PAGE, oldest?.createdAt);
      if (next.length === 0) setHasMore(false);
      else {
        setMessages((prev) => [...prev, ...next]);
        setHasMore(next.length === PAGE);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  async function persistAssistantLines(pt: Playthrough, lines: { role: 'assistant' | 'narration'; speaker: string | null; text: string }[], sceneId: string): Promise<ChatMessage[]> {
    const saved: ChatMessage[] = [];
    for (const line of lines) {
      if (!line.text.trim()) continue;
      const m: ChatMessage = {
        id: uid('m'),
        playthroughId: pt.id,
        role: line.role,
        speaker: line.speaker,
        text: line.text.trim(),
        sceneId,
        createdAt: new Date(Date.now() + saved.length).toISOString(),
      };
      await insertMessage(m);
      saved.push(m);
    }
    return saved;
  }

  async function applyTurnEffects(pt: Playthrough, b: StoryBundle, effects: ChoiceEffects | undefined, memoryNotes: string[]): Promise<{ pt: Playthrough; sceneChanged: boolean }> {
    let state = applyEffects(pt.state, effects);
    let newSceneId = effects?.scene ?? pt.currentSceneId;
    if (!b.scenes.scenes.some((s) => s.id === newSceneId)) newSceneId = pt.currentSceneId;
    const sceneChanged = newSceneId !== pt.currentSceneId;
    if (sceneChanged) state = { ...state, visits: { ...state.visits, [newSceneId]: (state.visits[newSceneId] ?? 0) + 1 } };
    let next: Playthrough = { ...pt, currentSceneId: newSceneId, state, messageCount: pt.messageCount + 1, updatedAt: nowIso() };
    next = { ...next, progress: progressEstimate(b, next) };
    const endId = effects?.endStory ?? null;
    const sceneObj = getScene(b, newSceneId);
    const ended = !!endId || !!sceneObj.isEnding;
    if (ended) {
      const ending = endId ?? sceneObj.endingId ?? null;
      next = await completePlaythrough(next, ending);
      await updateStats({ storiesCompleted: 1 });
    } else {
      await updatePlaythrough(next);
    }
    if (memoryNotes.length) await rememberMany(pt.id, memoryNotes, 'story', 3);
    return { pt: next, sceneChanged };
  }

  async function aiTurn(pt: Playthrough, b: StoryBundle, userText: string) {
    if (!profile || !activeProvider) throw new Error('AI not configured.');
    const apiKey = await getApiKey(activeProvider.id);
    if (!apiKey) throw new Error('API key missing.');

    const worldState = await ensureWorldState(pt, b).catch(() => null);
    const recent = await listRecentMessagesAsc(pt.id, shortTermWindowOf(b) + HISTORY_HEADROOM);
    const history = recent.filter((m, i) => !(i === recent.length - 1 && m.role === 'user' && m.text === userText));
    const query = [...history.slice(-2).map((m) => m.text), userText].join('\n');

    const pool = await listMemoryCandidates([pt.id, '*']).catch(() => [] as any[]);
    const summaryRaw = await recallForTurn(pt.id, query).then((r) => r.summary).catch(() => '');
    let relevant: any[] = [];
    let summary = summaryRaw;
    let wsForPrompt = worldState;
    try {
      const read = await recallWithWorldState(pt, b, query, history, pool, summaryRaw);
      relevant = read.memories;
      summary = read.summary;
      wsForPrompt = read.worldState ?? worldState;
    } catch {
      const fb = await recallForTurn(pt.id, query).catch(() => ({ memories: [], summary: '' } as any));
      relevant = fb.memories;
      summary = fb.summary;
    }

    const ctx = buildContext({ bundle: b, profile, playthrough: pt, memories: relevant, history, summary, worldState: wsForPrompt }, profile.ageGroup);
    const raw = await chatCompletion(activeProvider, apiKey, [{ role: 'system', content: ctx.system }, ...ctx.messages, { role: 'user', content: userText }]);

    const parsed = parseAssistantResponse(raw);
    const displayText = parsed.displayText || '...';

    try {
      await runMemoryWritePipeline({
        playthrough: pt,
        bundle: b,
        userText,
        assistantText: displayText,
        parsedExtractionRaw: (parsed as any).worldStateRaw ?? (parsed as any).rawStateJson ?? null,
        worldState: wsForPrompt,
      });
    } catch {}

    void logEpisode(pt.id, userText, displayText).catch(() => undefined);
    if (parsed.memoryNotes?.length) void rememberMany(pt.id, parsed.memoryNotes, 'story', 3).catch(() => undefined);
    void rememberPreferences(userText).catch(() => undefined);

    const saved = await persistAssistantLines(pt, [{ role: 'assistant', speaker: parsed.speaker, text: displayText }], pt.currentSceneId);
    setMessages((prev) => [...saved.reverse(), ...prev]);

    const { pt: updatedPt, sceneChanged } = await applyTurnEffects(pt, b, parsed.effects, parsed.memoryNotes);
    setPlaythrough(updatedPt);

    const summarize = (prompt: string) => chatCompletion(activeProvider, apiKey, [{ role: 'user', content: prompt }], { timeoutMs: 30000 });

    if (sceneChanged) {
      const sc = getScene(b, updatedPt.currentSceneId);
      const title = interpolatePlayerName(sc.title, profile?.nickname ?? '', { protectedNames: b.characters.characters.map((c) => c.name) });
      const extra = await persistAssistantLines(updatedPt, [{ role: 'narration', speaker: null, text: `✦ ${title}` }], updatedPt.currentSceneId);
      setMessages((prev) => [...extra.reverse(), ...prev]);
      void consolidateMemories(pt.id, summarize, { minLiveEpisodes: 12, keepLiveEpisodes: 4 }).catch(() => undefined);
    }

    if (updatedPt.messageCount % 8 === 0) void consolidateMemories(pt.id, summarize).catch(() => undefined);

    playReceive(settings.sound);
    if (settings.haptics) successBuzz();
  }

  async function send(textToSend: string) {
    const clean = textToSend.trim();
    if (!clean || !playthrough || !bundle || sending) return;
    lightBuzz();
    playSend(settings.sound);
    setSending(true);
    setAiError(null);
    setLastUserText(clean);
    setInput('');

    const userMsg: ChatMessage = {
      id: uid('m'),
      playthroughId: playthrough.id,
      role: 'user',
      speaker: profile?.nickname ?? null,
      text: clean,
      sceneId: playthrough.currentSceneId,
      createdAt: nowIso(),
    };

    await insertMessage(userMsg);
    setMessages((prev) => [userMsg, ...prev]);
    await updateStats({ messagesSent: 1 });

    try {
      await aiTurn(playthrough, bundle, clean);
    } catch (e: any) {
      const err: AIError = e && typeof e === 'object' && 'code' in e ? (e as AIError) : { code: 'provider_error', message: e instanceof Error ? e.message : 'AI error', retryable: true };
      setAiError(err);
    } finally {
      setSending(false);
    }
  }

  function retry() {
    if (lastUserText) void send(lastUserText);
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <LoadingState label="Entering story…" />
      </SafeAreaView>
    );
  }

  if (offline) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <OfflineState retry="Retry" onRetry={() => setReloadKey((k) => k + 1)} secondary="Go back" onSecondary={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  if (loadError || !playthrough || !bundle) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <ErrorState title="Couldn't open chat" subtitle={loadError ?? 'Journey missing.'} retry="Go back" onRetry={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const apiBase = effectiveContentApiBaseUrl(settings.contentApiBaseUrl);
  const portrait = bundle.story.media?.gallery?.find((g) => g.kind === 'character-portrait');
  const faceSource: CoverSource | null = portrait ? { uri: mediaApiUrl(apiBase, bundle.meta.storyDir, portrait.file) } : getBundledCoverSource(bundle.meta, apiBase);

  function openStoryProfile() {
    navigation.navigate('StoryDetail', { storyId: playthrough!.storyId });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.header, { borderColor: theme.borderSoft, backgroundColor: theme.bgSoft }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={theme.text} />
        </Pressable>

        <Pressable onPress={openStoryProfile} style={styles.headerIdentity} accessibilityRole="button">
          <ChatStoryFace source={faceSource} letter={bundle.meta.title} accent={bundle.meta.accentColor} />
          <View style={styles.headerBody}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {bundle.meta.title}
            </Text>
            <Text style={[styles.headerSub, { color: theme.textFaint }]} numberOfLines={1}>
              {scene?.title ?? playthrough.label}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerRight}>
          <View style={[styles.modeBtn, { backgroundColor: aiReady ? withAlpha(theme.text, 0.08) : theme.surface, borderColor: theme.borderSoft }]}>
            <Text style={[styles.modeText, { color: aiReady ? theme.textDim : theme.textFaint }]}>{aiReady ? 'AI' : 'Offline'}</Text>
          </View>
        </View>
      </View>

      {bundle.story.userRole ? (
        <View style={[styles.roleBanner, { backgroundColor: theme.bgSoft, borderColor: theme.borderSoft }]}>
          <Text style={[styles.roleLabel, { color: theme.textFaint }]}>YOU ARE</Text>
          <Text style={[styles.roleText, { color: theme.textDim }]} numberOfLines={1}>
            {makePlayerTextFn(bundle.meta, profile?.nickname)(bundle.story.userRole)}
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          inverted
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews={false}
          ListHeaderComponent={
            <>
              {sending ? <TypingIndicator label="Continuing…" /> : null}
              {aiError ? (
                <View style={[styles.errCard, { backgroundColor: theme.surface, borderColor: withAlpha(theme.danger, 0.3) }]}>
                  <Text style={[styles.errTitle, { color: theme.text }]}>Couldn't generate response.</Text>
                  <Text style={[styles.errSub, { color: theme.textDim }]}>{aiErrorMessage(aiError)}</Text>
                  <View style={styles.errBtns}>
                    {aiError.retryable ? (
                      <Pressable onPress={retry} style={[styles.errBtn, { backgroundColor: theme.text }]}>
                        <Text style={[styles.errBtnText, { color: theme.bg }]}>Retry</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => navigation.navigate('AIAddons')} style={[styles.errBtn, { backgroundColor: theme.surface2 }]}>
                      <Text style={[styles.errBtnText, { color: theme.text }]}>AI Settings</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </>
          }
          ListFooterComponent={loadingMore ? <Text style={[styles.more, { color: theme.textFaint }]}>Loading older…</Text> : null}
          renderItem={({ item }) => <ChatBubble message={item} />}
        />

        <View style={[styles.inputBar, { borderColor: theme.borderSoft, backgroundColor: theme.bgSoft }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={playthrough.status === 'completed' ? 'Journey ended — start new?' : 'Write your next move…'}
            placeholderTextColor={theme.textFaint}
            multiline
            maxLength={2000}
            editable={!sending}
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          />
          <Pressable
            onPress={() => void send(input)}
            disabled={sending || !input.trim()}
            style={[styles.send, { backgroundColor: theme.text, opacity: sending || !input.trim() ? 0.4 : 1 }]}
          >
            <Icon name="arrow-up" size={ICON_SIZE.md} color={theme.bg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { paddingRight: 4, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  face: { width: 36, height: 36, borderRadius: 12, overflow: 'hidden', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  faceImg: { width: 36, height: 36 },
  faceLetter: { fontSize: 14, fontWeight: '800' },
  headerBody: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 14.5, fontWeight: '700', letterSpacing: -0.2 },
  headerSub: { fontSize: 11, letterSpacing: 0.2, marginTop: 1, fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  modeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  roleBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  roleLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  roleText: { flex: 1, fontSize: 12, fontWeight: '500' },
  list: { paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  more: { textAlign: 'center', fontSize: 11, padding: 10 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14.5, lineHeight: 20, maxHeight: 120 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  errCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, marginVertical: 10 },
  errTitle: { fontSize: 14, fontWeight: '700' },
  errSub: { fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  errBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  errBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  errBtnText: { fontWeight: '700', fontSize: 12.5 },
});
