/**
 * Chat / Interactive Fiction Stage — Redesigned for Kissa v2.4.1.
 *
 * Immersive Stage Philosophy:
 *  - Atmospheric character & narration bubbles with crisp distinctions
 *  - Player messages with luminous accent styling
 *  - Scene markers as chapter dividers
 *  - Pinned keyboard-safe composer with smooth touch feedback
 *  - Zero technical memory UI exposed
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  AIError,
  ChatMessage,
  ChoiceEffects,
  Playthrough,
  RootStackParamList,
  StoryBundle,
} from '../types';
import { useApp } from '../state/AppContext';
import { ChatBubble, TypingIndicator } from '../components/chat';
import { ErrorState, LoadingState, OfflineState } from '../components/states';
import {
  effectiveContentApiBaseUrl,
  getBundle,
  getBundledCoverSource,
  mediaApiUrl,
  StoryContentError,
  type CoverSource,
} from '../content/loader';
import { getApiKey } from '../lib/secureKeys';
import { aiErrorMessage, chatCompletion } from '../lib/ai';
import {
  applyEffects,
  buildContext,
  getScene,
  HISTORY_HEADROOM,
  parseAssistantResponse,
  progressEstimate,
  shortTermWindowOf,
} from '../lib/engine';
import {
  consolidateMemories,
  logEpisode,
  recallForTurn,
  rememberMany,
  rememberPreferences,
} from '../lib/memory';
import { ensureWorldState, getWorldState, renderWorldStateForPrompt } from '../lib/worldState';
import { runMemoryWritePipeline, recallWithWorldState } from '../lib/memoryEngine';
import { listMemoryCandidates } from '../lib/db';
import {
  countMessages,
  getPlaythrough,
  insertMessage,
  listMessages,
  listRecentMessagesAsc,
  updatePlaythrough,
  updateStats,
} from '../lib/db';
import { completePlaythrough } from '../lib/playthrough';
import { interpolatePlayerName, makePlayerTextFn } from '../lib/playerName';
import { FONTS, RADIUS, SHADOWS, TYPE, withAlpha } from '../theme';
import { nowIso, uid } from '../lib/utils';
import { playReceive, playSend } from '../lib/sound';
import { lightBuzz, successBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const PAGE = 40;

function ChatStoryFace({
  source,
  letter,
  accent,
}: {
  source: CoverSource | null;
  letter: string;
  accent: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (letter?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View style={[styles.face, { backgroundColor: `${accent}2A`, borderColor: 'rgba(246,244,248,0.18)' }]}>
      {source && !failed ? (
        <Image
          source={source}
          style={styles.faceImg}
          resizeMode="contain"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={[styles.faceLetter, { color: accent }]}>{initial}</Text>
      )}
    </View>
  );
}

export function Chat({ navigation, route }: Props) {
  const { playthroughId } = route.params;
  const { theme, profile, activeProvider, providersWithKeys, refreshRecent, settings } = useApp();

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

  const aiReady =
    !!playthrough &&
    !!activeProvider &&
    providersWithKeys.has(activeProvider.id);

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
        if (!pt) throw new Error('Journey not found. It may have been deleted.');
        if (!profile) throw new Error('Profile missing.');

        const b = await getBundle(pt.storyId, profile.ageGroup, settings.contentApiBaseUrl);
        const first = await listMessages(pt.id, PAGE);
        const total = await countMessages(pt.id);
        if (!alive) return;
        if (pt.mode !== 'ai') {
          pt.mode = 'ai';
        }
        setPlaythrough(pt);
        setBundle(b);
        setMessages(first);
        setHasMore(total > first.length);
        void ensureWorldState(pt, b).catch(() => undefined);
      } catch (e) {
        if (!alive) return;
        if (e instanceof StoryContentError && e.code === 'network') {
          setOffline(true);
        } else {
          setLoadError(e instanceof Error ? e.message : 'Could not load chat.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [playthroughId, profile, reloadKey, settings.contentApiBaseUrl]);

  const scene = useMemo(
    () => (bundle && playthrough ? getScene(bundle, playthrough.currentSceneId) : null),
    [bundle, playthrough],
  );

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

  async function persistAssistantLines(
    pt: Playthrough,
    lines: { role: 'assistant' | 'narration'; speaker: string | null; text: string }[],
    sceneId: string,
  ): Promise<ChatMessage[]> {
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

  async function applyTurnEffects(
    pt: Playthrough,
    b: StoryBundle,
    effects: ChoiceEffects | undefined,
    memoryNotes: string[],
    explicitSceneId?: string,
  ): Promise<{ pt: Playthrough; sceneChanged: boolean }> {
    let state = applyEffects(pt.state, effects);
    let newSceneId = explicitSceneId ?? effects?.scene ?? pt.currentSceneId;
    if (!b.scenes.scenes.some((s) => s.id === newSceneId)) newSceneId = pt.currentSceneId;
    const sceneChanged = newSceneId !== pt.currentSceneId;
    if (sceneChanged) {
      state = { ...state, visits: { ...state.visits, [newSceneId]: (state.visits[newSceneId] ?? 0) + 1 } };
    }
    let next: Playthrough = {
      ...pt,
      currentSceneId: newSceneId,
      state,
      messageCount: pt.messageCount + 1,
      updatedAt: nowIso(),
    };
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
    if (!profile || !activeProvider) throw new Error('AI not configured. Please add API key in AI Add-ons.');
    const apiKey = await getApiKey(activeProvider.id);
    if (!apiKey) throw new Error('API key missing. Re-enter it in AI Add-ons.');

    // Ensure world state initialized
    const worldState = await ensureWorldState(pt, b).catch(() => null);

    // Load one window-sized slab plus headroom, so `shortTermWindow` is honoured in full.
    const recent = await listRecentMessagesAsc(pt.id, shortTermWindowOf(b) + HISTORY_HEADROOM);
    // `send()` already stored this turn's user line — don't feed it twice.
    const history = recent.filter(
      (m, i) => !(i === recent.length - 1 && m.role === 'user' && m.text === userText),
    );
    // Rank memories against the whole recent exchange, not just this one line.
    const query = [...history.slice(-2).map((m) => m.text), userText].join('\n');

    // Recall with world-state aware relevance
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

    const ctx = buildContext(
      { bundle: b, profile, playthrough: pt, memories: relevant, history, summary, worldState: wsForPrompt },
      profile.ageGroup,
    );
    const raw = await chatCompletion(
      activeProvider,
      apiKey,
      [
        { role: 'system', content: ctx.system },
        ...ctx.messages,
        { role: 'user', content: userText },
      ],
    );

    const parsed = parseAssistantResponse(raw);
    const displayText = parsed.displayText || '...';

    // Memory write pipeline
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
    if (parsed.memoryNotes?.length) {
      void rememberMany(pt.id, parsed.memoryNotes, 'story', 3).catch(() => undefined);
    }
    void rememberPreferences(userText).catch(() => undefined);

    const saved = await persistAssistantLines(
      pt,
      [{ role: 'assistant', speaker: parsed.speaker, text: displayText }],
      pt.currentSceneId,
    );
    setMessages((prev) => [...saved.reverse(), ...prev]);

    const { pt: updatedPt, sceneChanged } = await applyTurnEffects(
      pt,
      b,
      parsed.effects,
      parsed.memoryNotes,
    );
    setPlaythrough(updatedPt);

    const summarize = (prompt: string) =>
      chatCompletion(activeProvider, apiKey, [{ role: 'user', content: prompt }], { timeoutMs: 30000 });

    if (sceneChanged) {
      const sc = getScene(b, updatedPt.currentSceneId);
      const title = interpolatePlayerName(sc.title, profile?.nickname ?? '', {
        protectedNames: b.characters.characters.map((c) => c.name),
      });
      const extra = await persistAssistantLines(
        updatedPt,
        [{ role: 'narration', speaker: null, text: `✦ ${title}` }],
        updatedPt.currentSceneId,
      );
      setMessages((prev) => [...extra.reverse(), ...prev]);
      void consolidateMemories(pt.id, summarize, { minLiveEpisodes: 12, keepLiveEpisodes: 4 }).catch(
        () => undefined,
      );
    }

    if (updatedPt.messageCount % 8 === 0) {
      void consolidateMemories(pt.id, summarize).catch(() => undefined);
    }

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
      const err: AIError = e && typeof e === 'object' && 'code' in e
        ? (e as AIError)
        : {
            code: 'provider_error',
            message: e instanceof Error ? e.message : 'AI error occurred',
            retryable: true,
          };
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
        <LoadingState label="Entering story realm…" />
      </SafeAreaView>
    );
  }

  if (offline) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <OfflineState
          retry="↻ Retry"
          onRetry={() => setReloadKey((k) => k + 1)}
          secondary="Go back"
          onSecondary={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  if (loadError || !playthrough || !bundle) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <ErrorState
          title="Couldn't open chat"
          subtitle={loadError ?? 'Journey missing.'}
          retry="Go back"
          onRetry={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const apiBase = effectiveContentApiBaseUrl(settings.contentApiBaseUrl);
  const portrait = bundle.story.media?.gallery?.find((g) => g.kind === 'character-portrait');
  const faceSource: CoverSource | null = portrait
    ? { uri: mediaApiUrl(apiBase, bundle.meta.storyDir, portrait.file) }
    : getBundledCoverSource(bundle.meta, apiBase);

  const storyId = playthrough.storyId;
  function openStoryProfile() {
    navigation.navigate('StoryDetail', { storyId });
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.bg }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      {/* Cinematic Chat Header */}
      <View style={[styles.header, { borderColor: theme.border, backgroundColor: theme.bgSoft }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityLabel="Go back"
          style={styles.backBtn}
        >
          <Text style={[styles.back, { color: theme.text }]}>‹</Text>
        </Pressable>

        <Pressable
          onPress={openStoryProfile}
          style={styles.headerIdentity}
          accessibilityRole="button"
          accessibilityLabel={`Open ${bundle.meta.title} profile`}
        >
          <ChatStoryFace source={faceSource} letter={bundle.meta.title} accent={bundle.meta.accentColor} />
          <View style={styles.headerBody}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {bundle.meta.title}
            </Text>
            <Text style={[styles.headerSub, { color: theme.textDim }]} numberOfLines={1}>
              {scene?.title ?? playthrough.label} • {playthrough.label}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerRight}>
          <View
            style={[
              styles.modeBtn,
              {
                backgroundColor: aiReady ? theme.primarySoft : theme.surface,
                borderColor: aiReady ? theme.accent : theme.border,
              },
            ]}
          >
            <Text style={[styles.modeText, { color: aiReady ? theme.accent : theme.textDim }]}>
              ✦ AI
            </Text>
          </View>
        </View>
      </View>

      {/* Role Banner */}
      {bundle.story.userRole ? (
        <View
          style={[
            styles.roleBanner,
            { backgroundColor: withAlpha(theme.surface, 0.95), borderColor: theme.border },
          ]}
        >
          <Text style={[styles.roleLabel, { color: theme.accent }]}>YOU ARE</Text>
          <Text style={[styles.roleText, { color: theme.text }]} numberOfLines={1}>
            {makePlayerTextFn(bundle.meta, profile?.nickname)(bundle.story.userRole)}
          </Text>
        </View>
      ) : null}

      {/* Keyboard-Safe Interactive Chat View */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
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
              {sending ? <TypingIndicator label="AI is shaping the story…" /> : null}
              {aiError ? (
                <View
                  style={[
                    styles.errCard,
                    { backgroundColor: theme.surface, borderColor: theme.danger },
                  ]}
                >
                  <Text style={[styles.errTitle, { color: theme.text }]}>
                    Couldn't generate a response.
                  </Text>
                  <Text style={[styles.errSub, { color: theme.textDim }]}>
                    {aiErrorMessage(aiError)}
                  </Text>
                  <View style={styles.errBtns}>
                    {aiError.retryable ? (
                      <Pressable
                        onPress={retry}
                        style={[styles.errBtn, { backgroundColor: theme.primary }]}
                      >
                        <Text style={styles.errBtnText}>Retry</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => navigation.navigate('AIAddons')}
                      style={[styles.errBtn, { backgroundColor: theme.surface2 }]}
                    >
                      <Text style={[styles.errBtnText, { color: theme.text }]}>AI Settings</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </>
          }
          ListFooterComponent={
            loadingMore ? (
              <Text style={[styles.more, { color: theme.textFaint }]}>Loading older messages…</Text>
            ) : null
          }
          renderItem={({ item }) => <ChatBubble message={item} />}
        />

        {/* Pinned Minimal Chat Composer */}
        <View
          style={[
            styles.inputBar,
            { borderColor: theme.border, backgroundColor: theme.bgSoft },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={
              playthrough.status === 'completed'
                ? 'Journey completed — replay for new endings…'
                : 'Apni line likho…'
            }
            placeholderTextColor={theme.textFaint}
            multiline
            maxLength={2000}
            editable={!sending}
            accessibilityLabel="Message input"
            style={[
              styles.input,
              { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
            ]}
          />
          <Pressable
            onPress={() => void send(input)}
            disabled={sending || !input.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[
              styles.send,
              {
                backgroundColor: theme.accent,
                opacity: sending || !input.trim() ? 0.45 : 1,
              },
              SHADOWS.glowAccent,
            ]}
          >
            <Text style={styles.sendText}>➤</Text>
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
    ...SHADOWS.card,
  },
  backBtn: {
    paddingRight: 4,
  },
  back: { fontSize: 32, fontWeight: '300', marginTop: -4 },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  face: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  faceImg: { width: 40, height: 40 },
  faceLetter: { fontSize: 16, fontWeight: '900' },
  headerBody: { flex: 1, minWidth: 0 },
  headerTitle: { ...TYPE.subheading, letterSpacing: -0.2 },
  headerSub: { ...TYPE.tiny, letterSpacing: 0.2, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  modeText: { fontSize: FONTS.tiny, fontWeight: '800', letterSpacing: 0.4 },
  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roleLabel: { ...TYPE.caption, letterSpacing: 1.4, fontWeight: '900' },
  roleText: { flex: 1, fontSize: FONTS.small, fontWeight: '700', letterSpacing: 0.1 },
  list: { paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  more: { textAlign: 'center', fontSize: FONTS.tiny, padding: 10, letterSpacing: 0.2 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...SHADOWS.floating,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 120,
    letterSpacing: 0.1,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#0E070B', fontSize: 16, fontWeight: '900', marginLeft: 2 },
  errCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, marginVertical: 10, ...SHADOWS.card },
  errTitle: { ...TYPE.subheading },
  errSub: { fontSize: FONTS.small, marginTop: 6, lineHeight: 19, opacity: 0.9 },
  errBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  errBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  errBtnText: { color: '#fff', fontWeight: '800', fontSize: FONTS.small, letterSpacing: 0.2 },
});
