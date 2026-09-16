/**
 * Chat — interactive-fiction experience.
 * AI mode (BYO provider) + Offline Story Mode. Cached stories open offline.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
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
import { ChatBubble, ChoiceChips, TypingIndicator } from '../components/chat';
import { ErrorState, PreparingState } from '../components/states';
import { getBundle, StoryContentError, storyErrorMessage } from '../content/loader';
import { getApiKey } from '../lib/secureKeys';
import { aiErrorMessage, chatCompletion } from '../lib/ai';
import {
  applyEffects,
  availableChoices,
  buildContext,
  endingIdForTurn,
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
import { interpolatePlayerName } from '../lib/playerName';
import { offlineChoose, offlineStep } from '../lib/offlineEngine';
import { FONTS, RADIUS } from '../theme';
import { nowIso, uid } from '../lib/utils';
import { playReceive } from '../lib/sound';
import { successBuzz, tapTick } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const PAGE = 40;

export function Chat({ navigation, route }: Props) {
  const { playthroughId } = route.params;
  const { theme, profile, activeProvider, providersWithKeys, refreshRecent, settings } = useApp();

  const [playthrough, setPlaythrough] = useState<Playthrough | null>(null);
  const [bundle, setBundle] = useState<StoryBundle | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [aiError, setAiError] = useState<AIError | null>(null);
  const [lastUserText, setLastUserText] = useState<string | null>(null);

  const aiReady = !!playthrough && !!activeProvider && providersWithKeys.has(activeProvider.id);
  const offline = playthrough?.mode === 'offline';

  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const pt = await getPlaythrough(playthroughId);
        if (!pt) throw new Error('Journey not found. It may have been deleted.');
        if (!profile) throw new Error('Profile missing.');
        const b = await getBundle(pt.storyId, profile.ageGroup, settings.contentApiBaseUrl);
        const first = await listMessages(pt.id, PAGE);
        const total = await countMessages(pt.id);
        if (!alive) return;
        setPlaythrough(pt);
        setBundle(b);
        setMessages(first);
        setHasMore(total > first.length);
      } catch (e) {
        if (!alive) return;
        if (e instanceof StoryContentError) setLoadError(storyErrorMessage(e));
        else setLoadError(e instanceof Error ? e.message : 'Could not load chat.');
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

  const choiceChips = useMemo(() => {
    if (!offline || !scene || !playthrough || playthrough.status === 'completed') return [];
    return availableChoices(scene, playthrough.state).map((c) => ({
      id: c.id,
      label: c.shortLabel || c.text,
    }));
  }, [offline, scene, playthrough]);

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

    const sceneObj = getScene(b, newSceneId);
    const endId = endingIdForTurn(b, sceneObj, effects);
    if (endId) {
      next = await completePlaythrough(next, endId);
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

    const recent = await listRecentMessagesAsc(pt.id, shortTermWindowOf(b) + HISTORY_HEADROOM);
    const history = recent.filter(
      (m, i) => !(i === recent.length - 1 && m.role === 'user' && m.text === userText),
    );
    const query = [...history.slice(-2).map((m) => m.text), userText].join('\n');
    const { memories: relevant, summary } = await recallForTurn(pt.id, query);
    const ctx = buildContext(
      { bundle: b, profile, playthrough: pt, memories: relevant, history, summary },
      profile.ageGroup,
    );
    const raw = await chatCompletion(activeProvider, apiKey, [
      { role: 'system', content: ctx.system },
      ...ctx.messages,
      { role: 'user', content: userText },
    ]);
    const parsed = parseAssistantResponse(raw);
    const displayText = parsed.displayText || '...';

    void logEpisode(pt.id, userText, displayText).catch(() => undefined);

    const saved = await persistAssistantLines(
      pt,
      [{ role: 'assistant', speaker: parsed.speaker, text: displayText }],
      pt.currentSceneId,
    );
    const { pt: next, sceneChanged } = await applyTurnEffects(pt, b, parsed.effects, parsed.memoryNotes);
    const summarize = (prompt: string) =>
      chatCompletion(activeProvider, apiKey, [{ role: 'user', content: prompt }], { timeoutMs: 30000 });

    let extra: ChatMessage[] = [];
    if (sceneChanged) {
      const sc = getScene(b, next.currentSceneId);
      const title = interpolatePlayerName(sc.title, profile?.nickname ?? '', {
        protectedNames: b.characters.characters.map((c) => c.name),
      });
      extra = await persistAssistantLines(
        next,
        [{ role: 'narration', speaker: null, text: `✦ ${title}` }],
        next.currentSceneId,
      );
      void consolidateMemories(pt.id, summarize, { minLiveEpisodes: 12, keepLiveEpisodes: 4 }).catch(
        () => undefined,
      );
    }

    if (next.messageCount % 8 === 0) {
      void consolidateMemories(pt.id, summarize).catch(() => undefined);
    }
    return { saved: [...extra, ...saved], next };
  }

  async function offlineTurn(pt: Playthrough, b: StoryBundle, userText: string, choiceId?: string) {
    const result = choiceId
      ? offlineChoose(b, pt, choiceId, profile?.nickname)
      : offlineStep(b, pt, userText, profile?.nickname);
    if (!result) throw new Error('That choice is no longer available.');
    const { step, state } = result;

    const saved = await persistAssistantLines(pt, step.lines, step.newSceneId);
    let extra: ChatMessage[] = [];
    if (step.sceneChanged) {
      const sc = getScene(b, step.newSceneId);
      const title = interpolatePlayerName(sc.title, profile?.nickname ?? '', {
        protectedNames: b.characters.characters.map((c) => c.name),
      });
      extra = await persistAssistantLines(
        pt,
        [{ role: 'narration', speaker: null, text: `✦ ${title}` }],
        step.newSceneId,
      );
    }

    let next: Playthrough = {
      ...pt,
      currentSceneId: step.newSceneId,
      state,
      messageCount: pt.messageCount + 1,
      updatedAt: nowIso(),
    };
    next = { ...next, progress: progressEstimate(b, next) };
    if (step.ended) {
      next = await completePlaythrough(next, step.endingId);
      await updateStats({ storiesCompleted: 1 });
    } else {
      await updatePlaythrough(next);
    }
    return { saved: [...extra, ...saved], next };
  }

  async function send(userText: string, choiceId?: string) {
    const text = userText.trim();
    if (!text || !playthrough || !bundle || sending) return;
    if (playthrough.status === 'completed') return;
    setSending(true);
    setAiError(null);
    setLastUserText(text);
    try {
      const userMsg: ChatMessage = {
        id: uid('m'),
        playthroughId: playthrough.id,
        role: 'user',
        speaker: null,
        text,
        sceneId: playthrough.currentSceneId,
        createdAt: nowIso(),
      };
      await insertMessage(userMsg);
      setMessages((prev) => [userMsg, ...prev]);
      setInput('');
      await updateStats({ messagesSent: 1 });
      await rememberPreferences(text);

      const result =
        playthrough.mode === 'offline'
          ? await offlineTurn(playthrough, bundle, text, choiceId)
          : await aiTurn(playthrough, bundle, text);
      setPlaythrough(result.next);
      setMessages((prev) => [...result.saved, ...prev]);
      playReceive(settings.sound);
      if (result.next.status === 'completed') void successBuzz(settings.haptics);
      await refreshRecent();
    } catch (e) {
      const err = (e as { code?: string })?.code
        ? (e as AIError)
        : {
            code: 'provider_error' as const,
            message: e instanceof Error ? e.message : 'Something went wrong.',
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

  async function goOffline() {
    if (!playthrough) return;
    const next = { ...playthrough, mode: 'offline' as const, providerId: null, updatedAt: nowIso() };
    await updatePlaythrough(next);
    setPlaythrough(next);
    setAiError(null);
  }

  async function toggleMode() {
    if (!playthrough) return;
    void tapTick(settings.haptics);
    if (playthrough.mode === 'ai') {
      await goOffline();
      return;
    }
    if (!aiReady) {
      navigation.navigate('AIAddons');
      return;
    }
    const next = {
      ...playthrough,
      mode: 'ai' as const,
      providerId: activeProvider!.id,
      updatedAt: nowIso(),
    };
    await updatePlaythrough(next);
    setPlaythrough(next);
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <PreparingState label="Opening your journey…" />
      </SafeAreaView>
    );
  }
  if (loadError || !playthrough || !bundle) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <ErrorState
          title="Couldn't open chat"
          subtitle={loadError ?? 'Journey missing.'}
          retry="Try again"
          onRetry={() => setReloadKey((k) => k + 1)}
          secondary="Go back"
          onSecondary={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.header, { borderColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Go back">
          <Text style={[styles.back, { color: theme.text }]}>‹</Text>
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {bundle.meta.title}
          </Text>
          <Text style={[styles.headerSub, { color: theme.textDim }]} numberOfLines={1}>
            {scene?.title ?? playthrough.label} • {playthrough.label}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() =>
              navigation.navigate('Memory', { playthroughId: playthrough.id, storyTitle: bundle.meta.title })
            }
            hitSlop={8}
            style={[styles.modeBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Kya yaad hai"
          >
            <Text style={[styles.modeText, { color: theme.textDim }]}>🧠</Text>
          </Pressable>
          <Pressable
            onPress={() => void toggleMode()}
            style={[
              styles.modeBtn,
              {
                backgroundColor: playthrough.mode === 'ai' ? theme.primarySoft : theme.surface,
                borderColor: playthrough.mode === 'ai' ? theme.primary : theme.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={playthrough.mode === 'ai' ? 'Switch to Offline Story Mode' : 'Switch to AI'}
          >
            <Text style={[styles.modeText, { color: playthrough.mode === 'ai' ? '#D9CFFF' : theme.textDim }]}>
              {playthrough.mode === 'ai' ? '🤖 AI' : '📖 Offline'}
            </Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
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
              {sending ? (
                <TypingIndicator label={offline ? 'Kahani chalti hai…' : 'AI soch raha hai…'} />
              ) : null}
              {choiceChips.length > 0 && !sending ? (
                <ChoiceChips
                  choices={choiceChips}
                  disabled={sending}
                  onPick={(id) => {
                    const c = availableChoices(scene!, playthrough.state).find((x) => x.id === id);
                    if (c) void send(c.text, c.id);
                  }}
                />
              ) : null}
              {aiError ? (
                <View style={[styles.errCard, { backgroundColor: theme.surface, borderColor: theme.danger }]}>
                  <Text style={[styles.errTitle, { color: theme.text }]}>Couldn't generate a response.</Text>
                  <Text style={[styles.errSub, { color: theme.textDim }]}>{aiErrorMessage(aiError)}</Text>
                  <View style={styles.errBtns}>
                    {aiError.retryable ? (
                      <Pressable onPress={retry} style={[styles.errBtn, { backgroundColor: theme.primary }]}>
                        <Text style={styles.errBtnText}>Retry</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => navigation.navigate('AIAddons')}
                      style={[styles.errBtn, { backgroundColor: theme.surface2 }]}
                    >
                      <Text style={[styles.errBtnText, { color: theme.text }]}>Settings</Text>
                    </Pressable>
                    {playthrough.mode !== 'offline' ? (
                      <Pressable onPress={() => void goOffline()} style={[styles.errBtn, { backgroundColor: theme.surface2 }]}>
                        <Text style={[styles.errBtnText, { color: theme.text }]}>Go Offline</Text>
                      </Pressable>
                    ) : null}
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

        <View style={[styles.inputBar, { borderColor: theme.border, backgroundColor: theme.bgSoft }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={
              playthrough.status === 'completed'
                ? 'Journey complete — replay for new paths…'
                : 'Type karo… kuch bhi!'
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
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: theme.primary, opacity: sending || !input.trim() ? 0.5 : pressed ? 0.85 : 1 },
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  back: { fontSize: 30, fontWeight: '400', marginTop: -4 },
  headerBody: { flex: 1 },
  headerTitle: { fontSize: FONTS.body, fontWeight: '800' },
  headerSub: { fontSize: FONTS.tiny },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeBtn: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 7 },
  modeText: { fontSize: FONTS.small, fontWeight: '700' },
  list: { paddingHorizontal: 12, paddingVertical: 8 },
  more: { textAlign: 'center', fontSize: FONTS.tiny, padding: 8 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  errCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: 12, marginVertical: 8 },
  errTitle: { fontSize: FONTS.body, fontWeight: '800' },
  errSub: { fontSize: FONTS.small, marginTop: 4, lineHeight: 19 },
  errBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  errBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.sm },
  errBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.small },
});
