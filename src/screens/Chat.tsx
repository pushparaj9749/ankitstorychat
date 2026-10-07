/**
 * KISSA v2.4.3 — Chat / Interactive Fiction Stage
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
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AIError, ChatMessage, ChoiceEffects, Playthrough, RootStackParamList, StoryBundle } from '../types';
import { useApp } from '../state/AppContext';
import { ChatBubble, TypingIndicator } from '../components/chat';
import { Avatar } from '../components/bits';
import { ErrorState, LoadingState, OfflineState } from '../components/states';
import { effectiveContentApiBaseUrl, getBundle, getBundledCoverSource, mediaApiUrl, StoryContentError, type CoverSource } from '../content/loader';
import { getApiKey } from '../lib/secureKeys';
import { aiErrorMessage, chatCompletion } from '../lib/ai';
import { applyEffects, buildContext, finalizeAssistantText, getScene, HISTORY_HEADROOM, parseAssistantResponse, progressEstimate, shortTermWindowOf } from '../lib/engine';
import { completeEpisode, consolidateMemories, putMemory, recallForTurn, rememberMany, rememberPreferences, episodeLine } from '../lib/memory';
import { ensureWorldState } from '../lib/worldState';
import { runMemoryWritePipeline, recallWithWorldState } from '../lib/memoryEngine';
import { listMemoryCandidates } from '../lib/db';
import { countMessages, getPlaythrough, insertMessage, listMessages, listRecentMessagesAsc, updatePlaythrough, updateStats } from '../lib/db';
import { consolidateStoryMemory, ensureStoryMemoryReady, indexStoryMemoryMessages, recallStoryMemoryForPrompt, rememberTurn } from '../lib/storyMemory';
import { completePlaythrough } from '../lib/playthrough';
import { interpolatePlayerName, makePlayerTextFn } from '../lib/playerName';
import { RADIUS, SCALE, TOUCH, withAlpha } from '../theme';
import { Icon, ICON_SIZE } from '../components/icons';
import { nowIso, uid } from '../lib/utils';
import { playReceive, playSend } from '../lib/sound';
import { lightBuzz, successBuzz } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;
type ChatTurnKind = 'message' | 'choices' | 'regenerate' | 'scene' | 'continue';
type ChatActionKind = Exclude<ChatTurnKind, 'message'>;
type ChatTurnRequest = {
  kind: ChatTurnKind;
  prompt: string;
  /** The latest actual free-text message; action prompts are never persisted. */
  primaryUserText?: string;
  instruction?: string;
  userMessage?: ChatMessage;
};
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
  const [actionsOpen, setActionsOpen] = useState(false);
  const [typingLabel, setTypingLabel] = useState('Continuing…');
  const [aiError, setAiError] = useState<AIError | null>(null);
  const retryRequestRef = useRef<ChatTurnRequest | null>(null);
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
        // Backfill older journeys' transcript and typed archive. This is
        // idempotent, local-only, and shared with the first-retrieval barrier.
        void ensureStoryMemoryReady({ playthrough: pt, bundle: b, playerName: profile.nickname }).catch(() => {
          /* migration is best effort — chat must never be blocked by it */
        });
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
  const latestUserMessage = messages.find((message) => message.role === 'user');
  const latestAssistantMessage = messages.find((message) => message.role === 'assistant');
  const canRegenerate = !!latestUserMessage && !!latestAssistantMessage &&
    Date.parse(latestAssistantMessage.createdAt) >= Date.parse(latestUserMessage.createdAt);
  const hasAlternateScene = !!bundle && bundle.scenes.scenes.some((candidate) => candidate.id !== playthrough?.currentSceneId);

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

  async function aiTurn(pt: Playthrough, b: StoryBundle, request: ChatTurnRequest) {
    if (!profile || !activeProvider) throw new Error('AI not configured.');
    const apiKey = await getApiKey(activeProvider.id);
    if (!apiKey) throw new Error('API key missing.');

    const isAuthoredMessage = request.kind === 'message';
    const writesStoryState = isAuthoredMessage || request.kind === 'scene' || request.kind === 'continue';
    const primaryUserText = request.primaryUserText ?? (isAuthoredMessage ? request.prompt : '');

    // The screen starts migration in the background; share/wait for it here so
    // the first answer cannot race an incomplete transcript index.
    await ensureStoryMemoryReady({ playthrough: pt, bundle: b, playerName: profile.nickname }).catch(() => undefined);
    const worldState = await ensureWorldState(pt, b).catch(() => null);
    const recent = await listRecentMessagesAsc(pt.id, shortTermWindowOf(b) + HISTORY_HEADROOM);
    const history = isAuthoredMessage
      ? recent.filter((m, i) => !(i === recent.length - 1 && m.role === 'user' && m.text === request.prompt))
      : recent;
    // Only actual reader-authored rows are linked to typed archive events.
    const userMessageId = isAuthoredMessage && recent.length && recent[recent.length - 1].role === 'user'
      ? recent[recent.length - 1].id
      : undefined;
    const query = [primaryUserText || request.prompt, ...history.slice(-2).map((m) => m.text)].join('\n');

    // Preferences and the pre-AI episode are written only for real free-text
    // turns. Menu controls must never masquerade as something the reader said.
    if (isAuthoredMessage) {
      await rememberPreferences(request.prompt).catch(() => 0);
      await putMemory(pt.id, 'episode', episodeLine(request.prompt, ''), 1, { source: 'episode', confidence: 'high' }).catch(() => 'skipped');
    }

    const pool = await listMemoryCandidates([pt.id, '*']).catch(() => [] as any[]);
    const summaryRaw = await recallForTurn(pt.id, query).then((r) => r.summary).catch(() => '');
    let relevant: any[] = [];
    let summary = summaryRaw;
    let immediateContext = '';
    let wsForPrompt = worldState;
    try {
      const read = await recallWithWorldState(pt, b, query, history, pool, summaryRaw);
      relevant = read.memories;
      summary = read.summary;
      immediateContext = read.immediateContext;
      wsForPrompt = read.worldState ?? worldState;
    } catch {
      const fb = await recallForTurn(pt.id, query).catch(() => ({ memories: [], summary: '' } as any));
      relevant = fb.memories;
      summary = fb.summary;
    }

    // v2.5.1 universal memory retrieval: search the LOCAL archive for what this
    // turn actually needs (events, relationship state, character knowledge,
    // verbatim evidence). Never the whole archive — a ranked, bounded slice.
    let storyMemoryBlock = '';
    try {
      const sceneCharacters = (wsForPrompt?.presentCharacters ?? []).slice(0, 6);
      const mentioned = b.characters.characters
        .filter((c) => query.toLowerCase().includes(c.name.toLowerCase()))
        .map((c) => c.id);
      const recall = await recallStoryMemoryForPrompt({
        playthrough: pt,
        bundle: b,
        query,
        primaryQuery: primaryUserText || request.prompt,
        playerName: profile.nickname,
        characters: [...new Set([...sceneCharacters, ...mentioned])],
        location: wsForPrompt?.currentLocation ?? null,
        currentSeq: Math.max(wsForPrompt?.episodeCount ?? 0, pt.messageCount),
        excludeMessageIds: userMessageId ? [userMessageId] : [],
      });
      storyMemoryBlock = recall.block;
    } catch {
      storyMemoryBlock = '';
    }

    const ctx = buildContext({
      bundle: b,
      profile,
      playthrough: pt,
      memories: relevant,
      history,
      summary,
      worldState: wsForPrompt,
      immediateContext,
      storyMemoryBlock,
      turnInstruction: request.instruction,
    }, profile.ageGroup);
    const raw = await chatCompletion(activeProvider, apiKey, [
      { role: 'system', content: ctx.system },
      ...ctx.messages,
      { role: 'user', content: request.prompt },
    ]);

    const parsed = parseAssistantResponse(raw);
    // displayText is already state-free; stripStateLeakage is the final net for
    // malformed/multiple/unterminated kissa-state blocks (never rendered).
    const displayText = finalizeAssistantText(parsed);

    if (writesStoryState) {
      try {
        await runMemoryWritePipeline({
          playthrough: pt,
          bundle: b,
          userText: isAuthoredMessage ? request.prompt : '',
          assistantText: displayText,
          parsedExtractionRaw: (parsed as any).worldStateRaw ?? (parsed as any).rawStateJson ?? null,
          worldState: wsForPrompt,
          skipEpisode: true,
        });
      } catch {}
    }

    // Menu-only answers are not story canon changes. Their hidden state blocks
    // are ignored; Continue and Scene badlo deliberately advance story state.
    if (isAuthoredMessage) void completeEpisode(pt.id, request.prompt, displayText).catch(() => undefined);
    if (writesStoryState && parsed.memoryNotes?.length) {
      void rememberMany(pt.id, parsed.memoryNotes, 'story', 3).catch(() => undefined);
    }

    const saved = await persistAssistantLines(pt, [{ role: 'assistant', speaker: parsed.speaker, text: displayText }], pt.currentSceneId);
    setMessages((prev) => [...saved.slice().reverse(), ...prev]);

    // Typed archive events are created only for reader-authored turns. Action
    // prompts never create a fabricated user row or user-linked memory event.
    if (isAuthoredMessage) {
      try {
        await rememberTurn({
          playthrough: pt,
          bundle: b,
          userText: request.prompt,
          assistantText: displayText,
          parsedState: (parsed as any).worldStateRaw ?? (parsed as any).rawStateJson ?? null,
          messageIds: [userMessageId, ...saved.map((m) => m.id)].filter((x): x is string => !!x),
          sceneId: pt.currentSceneId,
          location: wsForPrompt?.currentLocation ?? null,
          storyDay: wsForPrompt?.storyTime?.day ?? null,
          turnSeq: Math.max(wsForPrompt?.episodeCount ?? 0, pt.messageCount) + 1,
          playerName: profile.nickname,
        });
      } catch {
        /* the archive is additive: a failure must never break the chat */
      }
    }

    let updatedPt = pt;
    let sceneChanged = false;
    if (writesStoryState) {
      const applied = await applyTurnEffects(pt, b, parsed.effects, parsed.memoryNotes);
      updatedPt = applied.pt;
      sceneChanged = applied.sceneChanged;
      setPlaythrough(updatedPt);
    }

    const summarize = (prompt: string) => chatCompletion(activeProvider, apiKey, [{ role: 'user', content: prompt }], { timeoutMs: 30000 });

    if (sceneChanged) {
      const sc = getScene(b, updatedPt.currentSceneId);
      const title = interpolatePlayerName(sc.title, profile.nickname, { protectedNames: b.characters.characters.map((c) => c.name) });
      const extra = await persistAssistantLines(updatedPt, [{ role: 'narration', speaker: null, text: `✦ ${title}` }], updatedPt.currentSceneId);
      setMessages((prev) => [...extra.slice().reverse(), ...prev]);
      // L5 FIX: Less aggressive folding — keep ≥8 live, fold at most half
      void consolidateMemories(pt.id, summarize).catch(() => undefined);
      // v2.5.1: the typed archive folds old events into rollups on the same
      // cadence. Raw events and raw messages are kept — never deleted.
      void consolidateStoryMemory(pt.id, pt.storyId).catch(() => undefined);
    }

    if (writesStoryState && updatedPt.messageCount % 8 === 0) {
      void consolidateMemories(pt.id, summarize).catch(() => undefined);
      void consolidateStoryMemory(pt.id, pt.storyId).catch(() => undefined);
    }

    playReceive(settings.sound);
    if (settings.haptics) successBuzz();
  }

  function typingLabelFor(kind: ChatTurnKind): string {
    if (kind === 'choices') return 'Ideas soch raha hai…';
    if (kind === 'regenerate') return 'Ek naya take likh raha hai…';
    if (kind === 'scene') return 'Naya scene set ho raha hai…';
    return 'Kahani aage badh rahi hai…';
  }

  async function executeTurnRequest(request: ChatTurnRequest, pt: Playthrough, b: StoryBundle) {
    retryRequestRef.current = request;
    setActionsOpen(false);
    setSending(true);
    setTypingLabel(typingLabelFor(request.kind));
    setAiError(null);
    try {
      await aiTurn(pt, b, request);
      retryRequestRef.current = null;
    } catch (e: any) {
      // A failed typed turn remains searchable; action controls add no user row.
      if (request.userMessage) await indexStoryMemoryMessages(pt, [request.userMessage]).catch(() => 0);
      const err: AIError = e && typeof e === 'object' && 'code' in e
        ? (e as AIError)
        : { code: 'provider_error', message: e instanceof Error ? e.message : 'AI error', retryable: true };
      setAiError(err);
    } finally {
      setSending(false);
    }
  }

  async function send(textToSend: string) {
    const clean = textToSend.trim();
    if (!clean || !playthrough || !bundle || sending) return;
    lightBuzz();
    playSend(settings.sound);
    setSending(true);
    setAiError(null);
    setActionsOpen(false);
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
    const request: ChatTurnRequest = {
      kind: 'message',
      prompt: clean,
      primaryUserText: clean,
      userMessage: userMsg,
    };
    retryRequestRef.current = request;

    await insertMessage(userMsg);
    setMessages((prev) => [userMsg, ...prev]);
    await updateStats({ messagesSent: 1 });
    await executeTurnRequest(request, playthrough, bundle);
  }

  async function runChatAction(kind: ChatActionKind) {
    if (!playthrough || !bundle || sending || !aiReady) return;
    if (kind !== 'regenerate' && playthrough.status !== 'active') return;
    if (kind === 'regenerate' && !canRegenerate) return;
    if (kind === 'scene' && !hasAlternateScene) return;

    const previousUserText = latestUserMessage?.text ?? '';
    let prompt = '';
    let instruction = '';

    if (kind === 'choices') {
      prompt = 'Agle move ke kuch ideas batao.';
      instruction = [
        'The reader tapped “Choices dikhao”; this is a request for inspiration, not an in-story action.',
        'Suggest exactly three distinct things the reader could type next, in concise natural Hinglish prose. Keep them as plain text, not bullets, numbered items, buttons, or interactive chips.',
        'Do not choose for the reader, advance the plot, change the scene, or emit story-state changes. End by inviting the reader to write any move in their own words.',
      ].join(' ');
    } else if (kind === 'regenerate') {
      prompt = 'Pichhle AI reply ka ek alternate take do.';
      instruction = [
        'The reader tapped “Regenerate” for the immediately preceding assistant reply. Use the real conversation history for context.',
        `The latest actual reader message was: ${JSON.stringify(previousUserText.slice(0, 700))}.`,
        'Write a distinct alternate rendering while preserving the same established events, outcomes, scene, and relationship facts. Do not add a new plot event, advance time, decide anything for the reader, or change story state. Stay immersive and do not mention regeneration.',
      ].join(' ');
    } else if (kind === 'scene') {
      const otherScenes = bundle.scenes.scenes.filter((candidate) => candidate.id !== playthrough.currentSceneId);
      const sceneTargets = otherScenes.map((candidate) => `${candidate.title} (id: ${candidate.id})`).join('; ');
      prompt = 'Scene ko naturally badlo.';
      instruction = [
        'The reader tapped “Scene badlo”. Create a natural, continuity-safe transition to one suitable existing scene from the story bundle.',
        `Available scene targets: ${sceneTargets}. Use the exact id in the hidden scene state field.`,
        'Do not teleport without a believable bridge and never invent an action or dialogue for the reader. If none of these scenes fits the current events, let a character or the world create a plausible transition before changing location.',
      ].join(' ');
    } else {
      prompt = 'Continue karo.';
      instruction = [
        'The reader tapped “Continue” without typing a message. Advance the current story by one short, natural beat.',
        'Let the narrator, setting, or other characters move the moment forward, but never invent an action or spoken line for the reader. Respect all established continuity and end with an organic opening for the reader’s own free-text move.',
      ].join(' ');
    }

    lightBuzz();
    playSend(settings.sound);
    await executeTurnRequest({
      kind,
      prompt,
      primaryUserText: previousUserText || undefined,
      instruction,
    }, playthrough, bundle);
  }

  async function retry() {
    const request = retryRequestRef.current;
    if (!request || !playthrough || !bundle || sending) return;
    lightBuzz();
    playSend(settings.sound);
    await executeTurnRequest(request, playthrough, bundle);
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
  const cast = bundle.characters?.characters ?? [];
  const portrait = bundle.story.media?.gallery?.find((g) => g.kind === 'character-portrait');
  const faceSource: CoverSource | null = portrait ? { uri: mediaApiUrl(apiBase, bundle.meta.storyDir, portrait.file) } : getBundledCoverSource(bundle.meta, apiBase);

  function openStoryProfile() {
    navigation.navigate('StoryDetail', { storyId: playthrough!.storyId });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      {/* ------------------------------------------------------ stage head */}
      <View style={[styles.header, { borderColor: theme.borderSoft, backgroundColor: withAlpha(theme.bgSoft, 0.92) }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.backBtn,
            { borderColor: theme.border, backgroundColor: withAlpha(theme.surface2, 0.72), opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="chevron-back" size={20} color={theme.text} />
        </Pressable>

        <Pressable onPress={openStoryProfile} style={styles.headerIdentity} accessibilityRole="button" accessibilityLabel={bundle.meta.title}>
          <ChatStoryFace source={faceSource} letter={bundle.meta.title} accent={bundle.meta.accentColor} />
          <View style={styles.headerBody}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {bundle.meta.title}
            </Text>
            <Text style={[styles.headerScene, { color: theme.accent }]} numberOfLines={1}>
              {(scene?.title ?? playthrough.label).toUpperCase()}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerRight}>
          {cast.length > 0 ? (
            <View style={styles.presence}>
              {cast.slice(0, 3).map((c, i) => (
                <View key={c.id} style={[styles.presenceSlot, i > 0 && styles.presenceOverlap]}>
                  <Avatar id={c.id} name={c.name} size={22} />
                </View>
              ))}
            </View>
          ) : null}
          <View style={[styles.modeBtn, { backgroundColor: withAlpha(aiReady ? theme.success : theme.text, 0.10), borderColor: withAlpha(aiReady ? theme.success : theme.text, 0.22) }]}>
            <View style={[styles.modeDot, { backgroundColor: aiReady ? theme.success : theme.textFaint }]} />
            <Text style={[styles.modeText, { color: aiReady ? '#9BEFD0' : theme.textFaint }]}>{aiReady ? 'AI' : 'SETUP'}</Text>
          </View>
        </View>
      </View>

      {bundle.story.userRole ? (
        <View style={[styles.roleBanner, { backgroundColor: withAlpha(theme.primary, 0.07), borderColor: withAlpha(theme.primary, 0.16) }]}>
          <Text style={[styles.roleLabel, { color: theme.accent }]}>YOU ARE</Text>
          <Text style={[styles.roleText, { color: theme.textDim }]} numberOfLines={1}>
            {makePlayerTextFn(bundle.meta, profile?.nickname)(bundle.story.userRole)}
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {/* Scene atmosphere — the story's own accent, never a photo crop. */}
        <LinearGradient
          colors={[withAlpha(bundle.meta.accentColor, 0.14), 'transparent', withAlpha(bundle.meta.accentColor, 0.05)]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
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
          maxToRenderPerBatch={16}
          windowSize={9}
          removeClippedSubviews={false}
          ListHeaderComponent={
            <>
              {sending ? <TypingIndicator label={typingLabel} /> : null}
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

        <View style={[styles.inputBar, { borderColor: theme.borderSoft, backgroundColor: withAlpha(theme.bgSoft, 0.94) }]}>
          {playthrough.messageCount > 8 ? (
            <View style={styles.memoryRow}>
              <Icon name="sparkles-outline" size={12} color={theme.textFaint} />
              <Text style={[styles.memoryText, { color: theme.textFaint }]}>
                {playthrough.messageCount} moments remembered in this journey
              </Text>
            </View>
          ) : null}
          {actionsOpen ? (
            <View style={[styles.actionMenu, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
              <View style={styles.actionMenuHeader}>
                <View style={[styles.actionMenuBadge, { backgroundColor: withAlpha(theme.accent, 0.12) }]}>
                  <Icon name="bulb-outline" size={17} color={theme.accent} />
                </View>
                <View style={styles.actionMenuHeading}>
                  <Text style={[styles.actionMenuTitle, { color: theme.text }]}>Kahani ke actions</Text>
                  <Text style={[styles.actionMenuSubtitle, { color: theme.textFaint }]}>Hints text mein — apna move aap likho.</Text>
                </View>
                <Pressable
                  onPress={() => setActionsOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close story actions"
                  hitSlop={8}
                  style={styles.actionMenuClose}
                >
                  <Icon name="close" size={17} color={theme.textDim} />
                </Pressable>
              </View>
              <View style={styles.actionGrid}>
                {([
                  { kind: 'choices', label: 'Choices dikhao', hint: 'Agle move ke text ideas', icon: 'sparkles-outline' },
                  { kind: 'regenerate', label: 'Regenerate', hint: 'Last reply ka alternate', icon: 'refresh-outline' },
                  { kind: 'scene', label: 'Scene badlo', hint: 'Naya scene, same story', icon: 'map-outline' },
                  { kind: 'continue', label: 'Continue', hint: 'Bina message ke aage', icon: 'play-forward-outline' },
                ] as const).map((action) => {
                  const actionDisabled = sending || !aiReady ||
                    (action.kind !== 'regenerate' && playthrough.status !== 'active') ||
                    (action.kind === 'regenerate' && !canRegenerate) ||
                    (action.kind === 'scene' && !hasAlternateScene);
                  const hint = action.kind === 'regenerate' && !canRegenerate
                    ? 'Pehle AI reply aane do'
                    : action.kind === 'scene' && !hasAlternateScene
                      ? 'Abhi doosra scene nahi'
                      : action.hint;
                  return (
                    <Pressable
                      key={action.kind}
                      onPress={() => void runChatAction(action.kind)}
                      disabled={actionDisabled}
                      accessibilityRole="button"
                      accessibilityLabel={action.label}
                      accessibilityState={{ disabled: actionDisabled }}
                      style={({ pressed }) => [
                        styles.actionTile,
                        { backgroundColor: theme.surface, borderColor: theme.borderSoft, opacity: actionDisabled ? 0.45 : pressed ? 0.78 : 1 },
                      ]}
                    >
                      <View style={[styles.actionTileIcon, { backgroundColor: withAlpha(theme.accent, 0.10) }]}>
                        <Icon name={action.icon} size={17} color={theme.accent} />
                      </View>
                      <Text style={[styles.actionTileTitle, { color: theme.text }]} numberOfLines={1}>{action.label}</Text>
                      <Text style={[styles.actionTileHint, { color: theme.textFaint }]} numberOfLines={1}>{hint}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {!aiReady ? (
                <View style={[styles.setupHint, { borderTopColor: theme.borderSoft }]}>
                  <Text style={[styles.setupHintText, { color: theme.textDim }]}>AI setup ya connection check karein.</Text>
                  <Pressable onPress={() => navigation.navigate('AIAddons')} accessibilityRole="button">
                    <Text style={[styles.setupHintLink, { color: theme.accent }]}>AI setup</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.inputRow}>
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
              onPress={() => setActionsOpen((open) => !open)}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel="Story actions"
              accessibilityState={{ expanded: actionsOpen, disabled: sending }}
              style={({ pressed }) => [
                styles.ideasButton,
                {
                  backgroundColor: actionsOpen ? withAlpha(theme.accent, 0.14) : theme.surface,
                  borderColor: actionsOpen ? withAlpha(theme.accent, 0.42) : theme.border,
                  opacity: sending ? 0.45 : pressed ? 0.78 : 1,
                },
              ]}
            >
              <Icon name="bulb-outline" size={ICON_SIZE.md} color={actionsOpen ? theme.accent : theme.textDim} />
            </Pressable>
            <Pressable
              onPress={() => void send(input)}
              disabled={sending || !input.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={({ pressed }) => [
                styles.send,
                { opacity: sending || !input.trim() ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
            >
              <LinearGradient
                colors={['#FF6B7E', '#E9435E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Icon name="arrow-up" size={ICON_SIZE.md} color="#fff" />
            </Pressable>
          </View>
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
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: {
    width: TOUCH.sm,
    height: TOUCH.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  face: { width: 38, height: 38, borderRadius: RADIUS.sm, overflow: 'hidden', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  faceImg: { width: 38, height: 38 },
  faceLetter: { fontSize: 15, fontWeight: '900' },
  headerBody: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.2 },
  headerScene: { fontSize: SCALE.micro, letterSpacing: 0.9, marginTop: 2, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  presence: { flexDirection: 'row', alignItems: 'center' },
  presenceSlot: { alignItems: 'center', justifyContent: 'center' },
  presenceOverlap: { marginLeft: -9 },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  modeDot: { width: 5, height: 5, borderRadius: 2.5 },
  modeText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 },
  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roleLabel: { fontSize: SCALE.micro, fontWeight: '900', letterSpacing: 1.2 },
  roleText: { flex: 1, fontSize: SCALE.caption, fontWeight: '500' },
  list: { paddingHorizontal: 12, paddingVertical: 12, gap: 2 },
  more: { textAlign: 'center', fontSize: SCALE.micro, padding: 10 },
  inputBar: {
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  memoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 },
  memoryText: { fontSize: SCALE.micro, fontWeight: '600', fontStyle: 'italic' },
  actionMenu: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 11, marginBottom: 10 },
  actionMenuHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 },
  actionMenuBadge: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actionMenuHeading: { flex: 1, minWidth: 0 },
  actionMenuTitle: { fontSize: 13.5, fontWeight: '800' },
  actionMenuSubtitle: { fontSize: 10.5, marginTop: 2 },
  actionMenuClose: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  actionTile: { width: '48.5%', minHeight: 76, borderRadius: 13, borderWidth: 1, padding: 9, justifyContent: 'center' },
  actionTileIcon: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  actionTileTitle: { fontSize: 11.5, fontWeight: '800' },
  actionTileHint: { fontSize: 9.5, marginTop: 2 },
  setupHint: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  setupHintText: { fontSize: 10.5, flex: 1 },
  setupHintLink: { fontSize: 11, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14.5,
    lineHeight: 20,
    minHeight: 46,
    maxHeight: 130,
  },
  ideasButton: { width: 46, height: 46, borderRadius: RADIUS.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  send: { width: 46, height: 46, borderRadius: RADIUS.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  errCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, marginVertical: 10 },
  errTitle: { fontSize: 14.5, fontWeight: '800' },
  errSub: { fontSize: SCALE.small, marginTop: 6, lineHeight: 19 },
  errBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  errBtn: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: RADIUS.pill },
  errBtnText: { fontWeight: '800', fontSize: SCALE.small },
});
