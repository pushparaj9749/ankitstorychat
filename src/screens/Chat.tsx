/**
 * Chat — the core interactive-fiction experience.
 * - AI mode: free chat with the user's own provider (OpenAI-compatible).
 * - Offline mode: scripted storyteller walking the story's scenes.
 * - Choices double as smart replies; free text always allowed.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { ErrorState, LoadingState } from '../components/states';
import { getBundle } from '../content/loader';
import { getApiKey } from '../lib/secureKeys';
import { aiErrorMessage, chatCompletion } from '../lib/ai';
import {
  applyEffects,
  availableChoices,
  buildContext,
  getScene,
  parseAssistantResponse,
  progressEstimate,
} from '../lib/engine';
import { offlineChoose, offlineStep } from '../lib/offlineEngine';
import {
  extractPreferenceNotes,
  rememberMany,
  selectMemories,
} from '../lib/memory';
import {
  countMessages,
  getPlaythrough,
  insertMessage,
  listMemories,
  listMessages,
  listRecentMessagesAsc,
  updatePlaythrough,
  updateStats,
} from '../lib/db';
import { completePlaythrough } from '../lib/playthrough';
import { FONTS, RADIUS, SPACING } from '../theme';
import { nowIso, uid } from '../lib/utils';
import { playReceive, playSend } from '../lib/sound';
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [aiError, setAiError] = useState<AIError | null>(null);
  const [lastUserText, setLastUserText] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const aiReady =
    !!playthrough &&
    playthrough.mode === 'ai' &&
    !!activeProvider &&
    providersWithKeys.has(activeProvider.id);

  /* ---------------- load ---------------- */

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pt = await getPlaythrough(playthroughId);
        if (!pt) throw new Error('Journey not found. It may have been deleted.');
        if (!profile) throw new Error('Profile missing.');
        const b = await getBundle(pt.storyId, profile.ageGroup);
        const first = await listMessages(pt.id, PAGE);
        const total = await countMessages(pt.id);
        if (!alive) return;
        setPlaythrough(pt);
        setBundle(b);
        setMessages(first);
        setHasMore(total > first.length);
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : 'Could not load chat.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [playthroughId, profile]);

  const scene = useMemo(
    () => (bundle && playthrough ? getScene(bundle, playthrough.currentSceneId) : null),
    [bundle, playthrough],
  );
  const choices = useMemo(
    () =>
      scene && playthrough && playthrough.status === 'active'
        ? availableChoices(scene, playthrough.state)
        : [],
    [scene, playthrough],
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

  /* ---------------- persistence helpers ---------------- */

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

  /** Apply effects + scene moves + endings; returns updated playthrough. */
  async function applyTurnEffects(
    pt: Playthrough,
    b: StoryBundle,
    effects: ChoiceEffects | undefined,
    memoryNotes: string[],
    explicitSceneId?: string,
  ): Promise<{ pt: Playthrough; sceneChanged: boolean }> {
    let state = applyEffects(pt.state, effects);
    let newSceneId = explicitSceneId ?? effects?.scene ?? pt.currentSceneId;
    // Validate scene id — never jump to a scene that doesn't exist.
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
    if (memoryNotes.length) await rememberMany(pt.id, memoryNotes, 'story', 2);
    return { pt: next, sceneChanged };
  }

  /* ---------------- AI turn ---------------- */

  async function aiTurn(pt: Playthrough, b: StoryBundle, userText: string, deterministic?: ChoiceEffects) {
    if (!profile || !activeProvider) throw new Error('AI not configured.');
    const apiKey = await getApiKey(activeProvider.id);
    if (!apiKey) throw new Error('API key missing. Re-enter it in AI Add-ons.');

    const [allMemories, history] = await Promise.all([
      listMemories(pt.id, 60),
      listRecentMessagesAsc(pt.id, 30),
    ]);
    const relevant = selectMemories(allMemories, userText, 12);
    const ctx = buildContext(
      { bundle: b, profile, playthrough: pt, memories: relevant, history },
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

    // Deterministic choice effects take precedence over AI-suggested ones.
    const merged: ChoiceEffects = { ...(parsed.effects ?? {}) };
    if (deterministic) {
      if (deterministic.relationships) {
        merged.relationships = { ...(merged.relationships ?? {}) };
        for (const [k, v] of Object.entries(deterministic.relationships)) {
          merged.relationships[k] = (merged.relationships[k] ?? 0) + v;
        }
      }
      if (deterministic.flags) merged.flags = { ...(merged.flags ?? {}), ...deterministic.flags };
      if (deterministic.choicesRecord) {
        merged.choicesRecord = { ...(merged.choicesRecord ?? {}), ...deterministic.choicesRecord };
      }
      if (deterministic.inventoryAdd) merged.inventoryAdd = [...(merged.inventoryAdd ?? []), ...deterministic.inventoryAdd];
      if (deterministic.inventoryRemove) {
        merged.inventoryRemove = [...(merged.inventoryRemove ?? []), ...deterministic.inventoryRemove];
      }
      if (deterministic.location) merged.location = deterministic.location;
      if (deterministic.scene) merged.scene = deterministic.scene;
      if (deterministic.endStory) merged.endStory = deterministic.endStory;
      if (deterministic.memory) parsed.memoryNotes.push(...deterministic.memory);
    }

    const saved = await persistAssistantLines(
      pt,
      [{ role: 'assistant', speaker: parsed.speaker, text: displayText }],
      pt.currentSceneId,
    );
    const { pt: next, sceneChanged } = await applyTurnEffects(
      pt,
      b,
      Object.keys(merged).length ? merged : undefined,
      parsed.memoryNotes,
    );
    let extra: ChatMessage[] = [];
    if (sceneChanged) {
      const sc = getScene(b, next.currentSceneId);
      extra = await persistAssistantLines(
        next,
        [{ role: 'narration', speaker: null, text: `✦ ${sc.title}` }],
        next.currentSceneId,
      );
    }
    return { saved: [...extra, ...saved], next };
  }

  /* ---------------- offline turn ---------------- */

  async function offlineTurn(pt: Playthrough, b: StoryBundle, userText: string, choiceId?: string) {
    const res = choiceId ? offlineChoose(b, pt, choiceId) : offlineStep(b, pt, userText);
    if (!res && choiceId) {
      // Stale chip — fall back to free-text handling.
      return offlineTurn(pt, b, userText, undefined);
    }
    if (!res) throw new Error('Offline engine hiccup. Try again.');
    const { step, state } = res;
    const saved = await persistAssistantLines(pt, step.lines, step.newSceneId);
    let next: Playthrough = {
      ...pt,
      currentSceneId: step.newSceneId,
      state,
      messageCount: pt.messageCount + 1,
      updatedAt: nowIso(),
    };
    next = { ...next, progress: progressEstimate(b, next) };
    let extra: ChatMessage[] = [];
    if (step.sceneChanged && !step.ended) {
      const sc = getScene(b, step.newSceneId);
      extra = await persistAssistantLines(
        next,
        [{ role: 'narration', speaker: null, text: `✦ ${sc.title}` }],
        step.newSceneId,
      );
    }
    if (step.ended) {
      next = await completePlaythrough(next, step.endingId);
      await updateStats({ storiesCompleted: 1 });
    } else {
      await updatePlaythrough(next);
    }
    if (step.matchedChoiceId) await updateStats({ choicesMade: 1 });
    return { saved: [...extra, ...saved], next };
  }

  /* ---------------- send ---------------- */

  async function send(userText: string, choiceId?: string) {
    const text = userText.trim();
    if (!text || !playthrough || !bundle || sending) return;
    if (playthrough.status === 'completed' && playthrough.mode === 'offline' && !choiceId) {
      // Completed offline journeys stay completed — gentle nudge.
      Alert.alert('Journey complete ✨', 'Replay karke doosri endings try karo!', [
        { text: 'OK' },
        {
          text: 'View saves',
          onPress: () => navigation.navigate('Saves', { storyId: playthrough.storyId }),
        },
      ]);
      return;
    }
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

      // Heuristic preference memory (runs offline too).
      const prefs = extractPreferenceNotes(text);
      if (prefs.length) await rememberMany(playthrough.id, prefs, 'preference', 2);
      if (choiceId) {
        const ch = choices.find((c) => c.id === choiceId);
        if (ch) await rememberMany(playthrough.id, [`Chose: "${ch.text}"`], 'story', 1);
      }

      const useAI =
        playthrough.mode === 'ai' && activeProvider && providersWithKeys.has(activeProvider.id);
      let result: { saved: ChatMessage[]; next: Playthrough };
      if (useAI) {
        const ch = choiceId ? choices.find((c) => c.id === choiceId) : undefined;
        result = await aiTurn(playthrough, bundle, text, ch?.effects);
      } else {
        result = await offlineTurn(playthrough, bundle, text, choiceId);
      }
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
      // AI errors show the inline error card; offline/unknown errors show alert text.
      if (playthrough.mode === 'ai') setAiError(err);
      else {
        Alert.alert('Oops', err.message);
      }
    } finally {
      setSending(false);
    }
  }

  function retry() {
    if (lastUserText) void send(lastUserText);
  }

  async function toggleMode() {
    if (!playthrough || !bundle) return;
    if (playthrough.mode === 'ai') {
      const next = { ...playthrough, mode: 'offline' as const, updatedAt: nowIso() };
      await updatePlaythrough(next);
      setPlaythrough(next);
      return;
    }
    // Switch to AI — needs a configured provider.
    if (activeProvider && providersWithKeys.has(activeProvider.id)) {
      const next = {
        ...playthrough,
        mode: 'ai' as const,
        providerId: activeProvider.id,
        updatedAt: nowIso(),
      };
      await updatePlaythrough(next);
      setPlaythrough(next);
    } else {
      navigation.navigate('AIAddons');
    }
  }

  /* ---------------- render ---------------- */

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <LoadingState label="Opening your journey…" />
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      {/* Header */}
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
        <Pressable
          onPress={toggleMode}
          accessibilityRole="button"
          accessibilityLabel={playthrough.mode === 'ai' ? 'Switch to offline mode' : 'Switch to AI mode'}
          style={[
            styles.modeBtn,
            {
              backgroundColor: aiReady ? theme.primarySoft : theme.surface,
              borderColor: aiReady ? theme.primary : theme.border,
            },
          ]}
        >
          <Text style={[styles.modeText, { color: aiReady ? '#D9CFFF' : theme.textDim }]}>
            {aiReady ? '🤖 AI' : '📖 Offline'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
          ListHeaderComponent={
            <>
              {sending ? <TypingIndicator label={aiReady ? 'AI soch raha hai…' : '…'} /> : null}
              {aiError ? (
                <View style={[styles.errCard, { backgroundColor: theme.surface, borderColor: theme.danger }]}>
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
                      <Text style={[styles.errBtnText, { color: theme.text }]}>Settings</Text>
                    </Pressable>
                    <Pressable
                      onPress={toggleMode}
                      style={[styles.errBtn, { backgroundColor: theme.surface2 }]}
                    >
                      <Text style={[styles.errBtnText, { color: theme.text }]}>Go Offline</Text>
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

        {/* Choices / smart replies */}
        {choices.length > 0 && !sending ? (
          <View style={styles.chipsBar}>
            <ChoiceChips
              choices={choices.map((c) => ({ id: c.id, label: c.shortLabel || c.text }))}
              onPick={(id) => {
                const ch = choices.find((x) => x.id === id);
                if (ch) void send(ch.text, ch.id);
              }}
            />
          </View>
        ) : null}

        {/* Input */}
        <View style={[styles.inputBar, { borderColor: theme.border, backgroundColor: theme.bgSoft }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={
              playthrough.status === 'completed'
                ? 'Journey complete — replay for new endings…'
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
            style={[
              styles.send,
              { backgroundColor: theme.primary, opacity: sending || !input.trim() ? 0.5 : 1 },
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
  modeBtn: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 7 },
  modeText: { fontSize: FONTS.small, fontWeight: '700' },
  list: { paddingHorizontal: 12, paddingVertical: 8 },
  more: { textAlign: 'center', fontSize: FONTS.tiny, padding: 8 },
  chipsBar: { paddingHorizontal: 12 },
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
  errBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  errBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.sm },
  errBtnText: { color: '#fff', fontWeight: '700', fontSize: FONTS.small },
});
