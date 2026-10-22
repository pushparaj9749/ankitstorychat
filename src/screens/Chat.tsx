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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AIError, ChatMessage, ChoiceEffects, Playthrough, RootStackParamList, StoryBundle } from '../types';
import { useApp } from '../state/AppContext';
import { useChatParts } from '../ui/templates';
import { GRADIENTS as CLASSIC_GRADIENTS } from '../ui/classic/theme';
import { Avatar } from '../components/bits';
import { ErrorState, LoadingState, OfflineState } from '../components/states';
import { effectiveContentApiBaseUrl, getBundle, getBundledCoverSource, mediaApiUrl, StoryContentError, type CoverSource } from '../content/loader';
import { getApiKey } from '../lib/secureKeys';
import { aiErrorMessage, chatCompletion } from '../lib/ai';
import { applyEffects, buildContext, buildStateExtractionMessages, castSpeakersIn, checkAssistantReply, HISTORY_HEADROOM, parseAssistantResponse, parseExtractedState, rewriteInstructionFor, shortTermWindowOf, type ParsedAssistant, type ReplyCheck } from '../lib/engine';
import { chapterDue, closeChapter, getChapters } from '../lib/chapters';
import { completeEpisode, consolidateMemories, putMemory, recallForTurn, rememberMany, rememberPreferences, episodeLine } from '../lib/memory';
import { ensureWorldState, getWorldState } from '../lib/worldState';
import { runMemoryWritePipeline, recallWithWorldState } from '../lib/memoryEngine';
import { listMemoryCandidates } from '../lib/db';
import { attachReplyIds, checkpointCovers, getTurnCheckpoint, rollbackTurn, saveTurnCheckpoint } from '../lib/turnCheckpoint';
import { countMessages, getPlaythrough, insertMessage, listMessages, listRecentMessagesAsc, updatePlaythrough, updateStats } from '../lib/db';
import { consolidateStoryMemory, ensureStoryMemoryReady, indexStoryMemoryMessages, recallStoryMemoryForPrompt, rememberTurn } from '../lib/storyMemory';
import { interpolatePlayerName, makePlayerTextFn, readerRoleText } from '../lib/playerName';
import { AMOLED, GRADIENTS, RADIUS, SCALE, TOUCH, withAlpha } from '../theme';
import { Icon, ICON_SIZE } from '../components/icons';
import { ArtBackdrop } from '../components/ArtBackdrop';
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
  /** Regenerate-after-rewind: one-off note appended to the instruction (never checkpointed). */
  retakeNote?: string;
};
const PAGE = 40;

/* Stable list callbacks: inline ones made the FlatList re-render every visible bubble on each keystroke. */
const bubbleKey = (m: ChatMessage) => m.id;

function ChatStoryFace({ source, letter, accent, ring = '#F0567E' }: { source: CoverSource | null; letter: string; accent: string; ring?: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (letter?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View style={[styles.face, { backgroundColor: `${accent}18`, borderColor: ring }]}>
      {source && !failed ? <ArtBackdrop source={source} accentColor={accent} blur={10} dim={0.15} /> : null}
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
  const { theme, profile, activeProvider, providersWithKeys, settings, uiTemplate } = useApp();
  const classic = uiTemplate === 'classic';
  const { ChatBubble, TypingIndicator } = useChatParts();
  const renderBubble = useCallback(({ item }: { item: ChatMessage }) => <ChatBubble message={item} />, [ChatBubble]);

  const [playthrough, setPlaythrough] = useState<Playthrough | null>(null);
  const [bundle, setBundle] = useState<StoryBundle | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // Uncontrolled composer: the text lives in a ref, so a keystroke doesn't
  // re-render this whole screen — only the empty/non-empty flip does.
  const inputRef = useRef<TextInput>(null);
  const textRef = useRef('');
  const [hasText, setHasText] = useState(false);
  const onChangeText = useCallback((t: string) => {
    textRef.current = t;
    const next = t.trim().length > 0;
    setHasText((prev) => (prev === next ? prev : next));
  }, []);
  const clearInput = useCallback(() => {
    textRef.current = '';
    inputRef.current?.clear();
    setHasText(false);
  }, []);
  const [sending, setSending] = useState(false);
  /** Lead character's bond (0–100) + mood, read from the stage-3 ledger (worldState). */
  const [bond, setBond] = useState<{ name: string; value: number | null; mood: string | null } | null>(null);
  const messageCount = messages.length;
  useEffect(() => {
    const lead = bundle?.characters?.characters?.[0];
    if (!playthrough?.id || !lead || sending) return;
    let alive = true;
    getWorldState(playthrough.id)
      .then((ws) => {
        if (!alive || !ws) return;
        const rel = ws.relationships?.[lead.id];
        const mood = ws.characterStates?.[lead.id]?.mood ?? null;
        const value = rel ? Math.round(rel.affection * 0.6 + rel.trust * 0.4) : null;
        setBond(value !== null || mood ? { name: lead.name.split(/\s+/)[0], value, mood } : null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [playthrough?.id, bundle, sending, messageCount]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [typingLabel, setTypingLabel] = useState('Continuing…');
  const [aiError, setAiError] = useState<AIError | null>(null);
  const retryRequestRef = useRef<ChatTurnRequest | null>(null);
  /**
   * v2.7.0: the record-keeper call runs AFTER the reply is on screen. The next
   * turn waits for it, so memory is always complete before the story moves on.
   */
  const pendingStateRef = useRef<Promise<void> | null>(null);
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
        // Stories never end: a journey an older version marked "completed"
        // simply continues from where it stopped.
        if (pt.status === 'completed') {
          pt.status = 'active';
          pt.endingId = null;
          void updatePlaythrough(pt).catch(() => undefined);
        }
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

  // No predefined scenes: the header shows where the story is right now.
  const placeLabel = playthrough?.state.location || bundle?.world.locations?.[0]?.name || playthrough?.label || '';
  const latestUserMessage = messages.find((message) => message.role === 'user');
  const latestAssistantMessage = messages.find((message) => message.role === 'assistant');
  const canRegenerate = !!latestUserMessage && !!latestAssistantMessage &&
    Date.parse(latestAssistantMessage.createdAt) >= Date.parse(latestUserMessage.createdAt);

  /**
   * First-move starters: the opening scene's 2–4 authored suggestions, shown
   * as tappable chips ONLY until the reader's first message. After that the
   * story is fully free-form. (They were authored for every story but never
   * shown, so a new reader faced an empty box.)
   */
  const starters = useMemo(() => {
    if (!bundle || latestUserMessage || hasMore) return [];
    const scene = bundle.scenes.scenes.find((sc) => sc.id === bundle.story.openingSceneId) ?? bundle.scenes.scenes[0];
    const opts = { protectedNames: bundle.characters.characters.map((c) => c.name) };
    return (scene?.choices ?? [])
      .filter((c) => (c.text ?? '').trim() && (c.shortLabel ?? '').trim())
      .slice(0, 4)
      .map((c) => ({
        id: c.id,
        label: interpolatePlayerName(c.shortLabel!.trim(), profile?.nickname, opts),
        text: interpolatePlayerName(c.text.trim(), profile?.nickname, opts),
      }));
  }, [bundle, latestUserMessage, hasMore, profile?.nickname]);

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

  /**
   * Free-form stories: no predefined scenes, arcs or endings. A turn can move
   * the place, time, people and relationships, but never jumps to an authored
   * scene and never "ends" the story — so scene/ending keys are ignored.
   */
  async function applyTurnEffects(pt: Playthrough, effects: ChoiceEffects | undefined, memoryNotes: string[]): Promise<{ pt: Playthrough }> {
    const free = effects ? { ...effects, scene: undefined, endStory: undefined } : undefined;
    const state = applyEffects(pt.state, free);
    const next: Playthrough = { ...pt, state, messageCount: pt.messageCount + 1, updatedAt: nowIso() };
    await updatePlaythrough(next);
    if (memoryNotes.length) await rememberMany(pt.id, memoryNotes, 'story', 3);
    return { pt: next };
  }

  async function aiTurn(ptIn: Playthrough, b: StoryBundle, request: ChatTurnRequest) {
    if (!profile || !activeProvider) throw new Error('AI not configured.');
    const apiKey = await getApiKey(activeProvider.id);
    if (!apiKey) throw new Error('API key missing.');

    // The previous turn's record-keeper must finish first: this turn's prompt
    // has to see the state it wrote. Then re-read the journey from disk.
    if (pendingStateRef.current) await pendingStateRef.current.catch(() => undefined);
    const pt = (await getPlaythrough(ptIn.id).catch(() => null)) ?? ptIn;

    const isAuthoredMessage = request.kind === 'message';
    const writesStoryState = isAuthoredMessage || request.kind === 'scene' || request.kind === 'continue';
    const primaryUserText = request.primaryUserText ?? (isAuthoredMessage ? request.prompt : '');
    const castNames = b.characters.characters.map((c) => c.name);

    // The screen starts migration in the background; share/wait for it here so
    // the first answer cannot race an incomplete transcript index.
    await ensureStoryMemoryReady({ playthrough: pt, bundle: b, playerName: profile.nickname }).catch(() => undefined);
    const worldState = await ensureWorldState(pt, b).catch(() => null);
    // Rewind point: Regenerate on this turn's reply restores everything below.
    if (writesStoryState) {
      await saveTurnCheckpoint(pt.id, {
        kind: request.kind as 'message' | 'scene' | 'continue',
        prompt: request.prompt,
        primaryUserText: request.primaryUserText,
        instruction: request.instruction,
      }).catch(() => undefined);
    }
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

    const chapters = await getChapters(pt.id).catch(() => []);
    const ctx = buildContext({
      bundle: b,
      profile,
      playthrough: pt,
      memories: relevant,
      history,
      summary,
      chapters,
      worldState: wsForPrompt,
      immediateContext,
      storyMemoryBlock,
      turnInstruction: [request.instruction, request.retakeNote].filter(Boolean).join(' ') || undefined,
      stateMode: 'separate',
    }, profile.ageGroup);
    const transcript = [...ctx.messages, { role: 'user' as const, content: request.prompt }];

    // ---- STORY REPLY + check before the reader sees it -------------------
    // v2.10.3 scene-presence guard: a cast member who is not in the scene,
    // was not called by the reader and has not been part of the recent
    // conversation must not barge in. "Naya mod" may bring someone in on
    // purpose, and "Choices" is not story text — both skip the check.
    const presentNames = (wsForPrompt?.presentCharacters ?? []).map(
      (id) => b.characters.characters.find((c) => c.id === id)?.name ?? wsForPrompt?.characterStates?.[id]?.name ?? id,
    );
    const recentAssistant = history.filter((m) => m.role === 'assistant').slice(-6);
    const recentSpeakers = [...new Set(recentAssistant.flatMap((m) => castSpeakersIn(m.text, m.speaker ?? null, castNames)))];
    const recentReaderText = history.filter((m) => m.role === 'user').slice(-2).map((m) => m.text);
    const checkPresence = request.kind !== 'scene' && request.kind !== 'choices';
    const checkOpts = {
      castNames,
      readerName: profile.nickname,
      privateNotes: ctx.privateNotes,
      presence: checkPresence
        ? { presentNames, recentSpeakers, readerText: [...recentReaderText, isAuthoredMessage ? request.prompt : ''].join(' ') }
        : undefined,
    };
    const raw = await chatCompletion(activeProvider, apiKey, [{ role: 'system', content: ctx.system }, ...transcript]);
    let parsed: ParsedAssistant = parseAssistantResponse(raw);
    let check: ReplyCheck = checkAssistantReply(parsed, checkOpts);
    if (check.needsRewrite) {
      // One silent rewrite. If it is not better, the cleaned first draft stays.
      try {
        const raw2 = await chatCompletion(activeProvider, apiKey, [
          { role: 'system', content: `${ctx.system}\n\n${rewriteInstructionFor(check.reasons)}` },
          ...transcript,
        ]);
        const parsed2 = parseAssistantResponse(raw2);
        const check2 = checkAssistantReply(parsed2, checkOpts);
        if (!check2.needsRewrite || check2.reasons.length < check.reasons.length) {
          // Keep any state the first draft carried as a fallback for the record-keeper.
          parsed = { ...parsed2, effects: parsed2.effects ?? parsed.effects, memoryNotes: parsed2.memoryNotes.length ? parsed2.memoryNotes : parsed.memoryNotes, worldStateRaw: parsed2.worldStateRaw ?? parsed.worldStateRaw, rawStateJson: parsed2.rawStateJson ?? parsed.rawStateJson };
          check = check2;
        }
      } catch {
        /* the cleaned first draft is still safe to show */
      }
    }
    const displayText = check.text;
    const speaker = check.speaker;

    const saved = await persistAssistantLines(pt, [{ role: 'assistant', speaker, text: displayText }], pt.currentSceneId);
    if (writesStoryState) await attachReplyIds(pt.id, saved.map((m) => m.id)).catch(() => undefined);
    setMessages((prev) => [...saved.slice().reverse(), ...prev]);
    playReceive(settings.sound);
    if (settings.haptics) successBuzz();

    if (!writesStoryState) return;

    // ---- SILENT RECORD-KEEPER (after the reply is visible) ---------------
    const summarize = (prompt: string) => chatCompletion(activeProvider, apiKey, [{ role: 'user', content: prompt }], { timeoutMs: 30000 });
    const userText = isAuthoredMessage ? request.prompt : '';
    const task = (async () => {
      let stateParsed: ParsedAssistant | null = null;
      try {
        const rawState = await chatCompletion(
          activeProvider,
          apiKey,
          buildStateExtractionMessages({
            bundle: b,
            playthrough: pt,
            worldState: wsForPrompt,
            userText,
            assistantText: displayText,
            assistantSpeaker: speaker,
            playerName: profile.nickname,
          }),
          { timeoutMs: 45000 },
        );
        stateParsed = parseExtractedState(rawState);
      } catch {
        stateParsed = null;
      }
      // Fallback: a state block the story model still emitted (already hidden).
      const source = stateParsed ?? (parsed.effects || parsed.rawStateJson ? parsed : null);
      const rawStateJson = (source?.worldStateRaw ?? source?.rawStateJson ?? null) as any;
      const memoryNotes = source?.memoryNotes ?? [];

      try {
        await runMemoryWritePipeline({
          playthrough: pt,
          bundle: b,
          userText,
          // The first speaker was split off for the bubble; the pipeline needs
          // it to know who actually spoke (= who is in the scene).
          assistantText: speaker ? `${speaker}: ${displayText}` : displayText,
          parsedExtractionRaw: rawStateJson,
          worldState: wsForPrompt,
          skipEpisode: true,
          playerName: profile.nickname,
        });
      } catch {}

      if (isAuthoredMessage) {
        await completeEpisode(pt.id, request.prompt, displayText).catch(() => undefined);
        // Typed archive events are created only for reader-authored turns.
        try {
          await rememberTurn({
            playthrough: pt,
            bundle: b,
            userText: request.prompt,
            assistantText: displayText,
            parsedState: rawStateJson,
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

      const applied = await applyTurnEffects(pt, source?.effects, memoryNotes);
      const updatedPt = applied.pt;
      setPlaythrough(updatedPt);

      // STAGE 1 chapters: memory recaps closed every CHAPTER_EVERY_TURNS turns.
      // They summarise what HAPPENED — nothing is planned ahead.
      if (await chapterDue(pt.id, updatedPt.messageCount).catch(() => false)) {
        const prevChapters = await getChapters(pt.id).catch(() => []);
        const since = prevChapters.length ? prevChapters[prevChapters.length - 1].createdAt : '';
        const pool2 = await listRecentMessagesAsc(pt.id, 240).catch(() => [] as ChatMessage[]);
        const chapterMessages = pool2.filter((m) => !since || m.createdAt > since);
        const place = updatedPt.state.location || wsForPrompt?.currentLocation || '';
        void closeChapter({
          playthroughId: pt.id,
          title: place ? interpolatePlayerName(place, profile.nickname, { protectedNames: castNames }) : `Chapter ${prevChapters.length + 1}`,
          sceneId: null,
          messageCount: updatedPt.messageCount,
          messages: chapterMessages,
          castNames,
          readerName: profile.nickname,
          summarize,
        });
      }

      // Gap-free STAGE 1: fold episodes as soon as they leave the 20-chat window.
      if (updatedPt.messageCount % 4 === 0) {
        void consolidateMemories(pt.id, summarize).catch(() => undefined);
        // The typed archive folds old events into rollups on the same cadence.
        // Raw events and raw messages are kept — never deleted.
        void consolidateStoryMemory(pt.id, pt.storyId).catch(() => undefined);
      }
    })();
    const tracked: Promise<void> = task
      .catch(() => undefined)
      .finally(() => {
        if (pendingStateRef.current === tracked) pendingStateRef.current = null;
      });
    pendingStateRef.current = tracked;
  }

  function typingLabelFor(kind: ChatTurnKind): string {
    if (kind === 'choices') return 'Ideas soch raha hai…';
    if (kind === 'regenerate') return 'Ek naya take likh raha hai…';
    if (kind === 'scene') return 'Kahani naya mod le rahi hai…';
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
    clearInput();

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

  /**
   * Real Regenerate: rewind the journey's memory to just before the last
   * story turn, drop its reply, and run that same turn again. Returns false
   * when the last reply has no rewind point (older reply / non-story action),
   * in which case the caller falls back to a state-free alternate take.
   */
  async function regenerateWithRewind(pt: Playthrough, b: StoryBundle): Promise<boolean> {
    const old = latestAssistantMessage;
    let rewound = false;
    setSending(true);
    try {
      if (pendingStateRef.current) await pendingStateRef.current.catch(() => undefined);
      const ck = await getTurnCheckpoint(pt.id).catch(() => null);
      if (!checkpointCovers(ck, old?.id)) return false;
      await rollbackTurn(pt.id, ck);
      rewound = true;
      const drop = new Set(ck.replyIds);
      setMessages((prev) => prev.filter((m) => !drop.has(m.id)));
      const restored = (await getPlaythrough(pt.id).catch(() => null)) ?? pt;
      setPlaythrough(restored);
      lightBuzz();
      playSend(settings.sound);
      await executeTurnRequest(
        {
          ...ck.request,
          retakeNote: [
            'The reader asked for a fresh take on this turn. Write it differently from the discarded attempt below — new wording and a different natural beat — while staying fully continuity-safe.',
            old ? `Discarded attempt (do not repeat it): ${JSON.stringify(old.text.slice(0, 500))}.` : '',
          ].filter(Boolean).join(' '),
        },
        restored,
        b,
      );
      return true;
    } catch {
      // Once rewound, never fall through to a second take on top of it.
      return rewound;
    } finally {
      setSending(false);
    }
  }

  async function runChatAction(kind: ChatActionKind) {
    if (!playthrough || !bundle || sending || !aiReady) return;
    if (kind !== 'regenerate' && playthrough.status !== 'active') return;
    if (kind === 'regenerate' && !canRegenerate) return;

    if (kind === 'regenerate' && (await regenerateWithRewind(playthrough, bundle))) return;

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
      prompt = 'Kahani mein naya mod lao.';
      instruction = [
        'The reader tapped “Naya mod”. There are no predefined scenes — invent a fresh, natural turn that grows out of what has already happened: a new moment, place or development (a time skip, someone arriving, a call, a surprise).',
        'Bridge it believably, keep every established fact, keep every character in character (no invented fights or mood swings), and never invent an action or spoken line for the reader. Do not wrap anything up; leave room for the reader’s own move.',
      ].join(' ');
    } else {
      prompt = 'Continue karo.';
      instruction = [
        'The reader tapped “Continue” without typing a message. Advance the current story by one short, natural beat.',
        'Let the narrator, the setting or the characters ALREADY IN THE SCENE move the moment forward — nobody new arrives, calls or interrupts. Never invent an action or spoken line for the reader, and never invent a conflict. Respect all established continuity and leave room for the reader’s own free-text move.',
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
      <SafeAreaView style={[styles.safe, { backgroundColor: AMOLED }]}>
        <LoadingState label="Entering story…" />
      </SafeAreaView>
    );
  }

  if (offline) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: AMOLED }]}>
        <OfflineState retry="Retry" onRetry={() => setReloadKey((k) => k + 1)} secondary="Go back" onSecondary={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  if (loadError || !playthrough || !bundle) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: AMOLED }]}>
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
    <SafeAreaView style={[styles.safe, { backgroundColor: AMOLED }]} edges={['top', 'left', 'right', 'bottom']}>
      {/* ------------------------------------------------------ stage head */}
      <View style={[styles.header, { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: AMOLED }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.backBtn,
            { borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.06)', opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="chevron-back" size={20} color={theme.text} />
        </Pressable>

        <Pressable onPress={openStoryProfile} style={styles.headerIdentity} accessibilityRole="button" accessibilityLabel={bundle.meta.title}>
          <ChatStoryFace source={faceSource} letter={bundle.meta.title} accent={bundle.meta.accentColor} ring={classic ? 'rgba(255,255,255,0.55)' : theme.primary} />
          <View style={styles.headerBody}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {bundle.meta.title}
            </Text>
            <View style={styles.headerSubRow}>
              {bond?.mood ? (
                <View style={[styles.moodChip, { backgroundColor: theme.primarySoft }]}>
                  <Text style={[styles.moodText, { color: theme.accent }]} numberOfLines={1}>
                    {bond.mood.charAt(0).toUpperCase() + bond.mood.slice(1)}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.headerScene, { color: classic ? theme.gold : theme.textFaint }]} numberOfLines={1}>
                {placeLabel}
              </Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Yaadein', { playthroughId: playthrough.id })}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Yaadein"
          style={({ pressed }) => [
            styles.backBtn,
            styles.memBtn,
            { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="sparkles-outline" size={17} color={theme.textDim} />
        </Pressable>

        <View
          style={[
            styles.modeBtn,
            classic
              ? { backgroundColor: withAlpha(aiReady ? theme.success : theme.text, 0.08), borderColor: withAlpha(aiReady ? theme.success : theme.text, 0.18) }
              : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)' },
          ]}
        >
          <View style={[styles.modeDot, { backgroundColor: aiReady ? theme.success : theme.textFaint }]} />
          <Text style={[styles.modeText, { color: classic && aiReady ? '#A7F3CF' : theme.textDim }]}>{aiReady ? 'AI' : 'No AI'}</Text>
        </View>
      </View>

      {bundle.story.userRole ? (
        <View style={[styles.roleBanner, { backgroundColor: AMOLED, borderColor: 'rgba(255,255,255,0.08)' }]}>
          <Icon name="person" size={13} color={classic ? theme.accent : theme.textFaint} />
          <Text style={[styles.roleLabel, { color: classic ? theme.accent : theme.textFaint }]}>YOU ARE</Text>
          <Text style={[styles.roleText, { color: theme.textDim }]} numberOfLines={1}>
            {makePlayerTextFn(bundle.meta, profile?.nickname)(readerRoleText(bundle.story.userRole))}
          </Text>
          {cast.length > 0 ? (
            <View style={styles.presence} accessibilityLabel={`In this story: ${cast.map((c) => c.name).join(', ')}`}>
              {cast.slice(0, 3).map((c, i) => (
                <View key={c.id} style={[styles.presenceSlot, i > 0 && styles.presenceOverlap]}>
                  <Avatar id={c.id} name={c.name} size={20} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {/* AMOLED stage: true-black canvas (pixels off on OLED) so the bubbles carry the colour. */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={bubbleKey}
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
          renderItem={renderBubble}
        />

        <View style={[styles.inputBar, { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: AMOLED }]}>
          {playthrough.messageCount > 8 ? (
            <Pressable
              onPress={() => navigation.navigate('Yaadein', { playthroughId: playthrough.id })}
              accessibilityRole="button"
              accessibilityLabel="Open Yaadein"
              style={styles.memoryRow}
            >
              <Icon name="sparkles-outline" size={12} color={theme.textFaint} />
              <Text style={[styles.memoryText, { color: theme.textFaint }]}>
                {playthrough.messageCount} moments remembered in this journey
              </Text>
              <Text style={[styles.memoryText, { color: theme.textDim, fontWeight: '600' }]}>· Yaadein dekho</Text>
            </Pressable>
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
                  { kind: 'scene', label: 'Naya mod', hint: 'Kahani mein naya twist', icon: 'map-outline' },
                  { kind: 'continue', label: 'Continue', hint: 'Bina message ke aage', icon: 'play-forward-outline' },
                ] as const).map((action) => {
                  const actionDisabled = sending || !aiReady ||
                    (action.kind !== 'regenerate' && playthrough.status !== 'active') ||
                    (action.kind === 'regenerate' && !canRegenerate);
                  const hint = action.kind === 'regenerate' && !canRegenerate
                    ? 'Pehle AI reply aane do'
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
          {starters.length > 0 && aiReady && !sending && !actionsOpen ? (
            <View style={styles.starterWrap} testID="chat-starters">
              <Text style={[styles.starterLabel, { color: theme.textFaint }]}>Pehla move chuno — ya apna likho</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.starterRow} keyboardShouldPersistTaps="handled">
                {starters.map((st) => (
                  <Pressable
                    key={st.id}
                    onPress={() => void send(st.text)}
                    accessibilityRole="button"
                    accessibilityLabel={st.label}
                    style={({ pressed }) => [
                      styles.starterChip,
                      { backgroundColor: withAlpha(theme.accent, pressed ? 0.2 : 0.1), borderColor: withAlpha(theme.accent, 0.38) },
                    ]}
                  >
                    <Text style={[styles.starterText, { color: theme.text }]} numberOfLines={1}>{st.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              onChangeText={onChangeText}
              placeholder="Write your next move…"
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
              onPress={() => void send(textRef.current)}
              disabled={sending || !hasText}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={({ pressed }) => [
                styles.send,
                classic
                  ? { opacity: sending || !hasText ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }
                  : { backgroundColor: hasText ? theme.primary : theme.surface3, opacity: sending ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
            >
              {classic ? (
                <LinearGradient colors={[...CLASSIC_GRADIENTS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              ) : null}
              <Icon name="arrow-up" size={ICON_SIZE.md} color="#fff" strokeWidth={2.4} />
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
    overflow: 'hidden',
  },
  backBtn: {
    width: TOUCH.sm + 2,
    height: TOUCH.sm + 2,
    borderRadius: (TOUCH.sm + 2) / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  face: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  faceImg: { width: 42, height: 42 },
  faceLetter: { fontSize: 15, fontWeight: '800' },
  headerBody: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3, color: '#fff' },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, minWidth: 0 },
  headerScene: { fontSize: SCALE.caption, letterSpacing: 0.1, fontWeight: '500', flexShrink: 1 },
  moodChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, maxWidth: 110 },
  moodText: { fontSize: 11, fontWeight: '600' },
  bond: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bondTrack: { width: 52, height: 4, borderRadius: 2, overflow: 'hidden' },
  bondFill: { height: 4, borderRadius: 2 },
  bondText: { fontSize: 11, fontWeight: '700', minWidth: 28 },
  presence: { flexDirection: 'row', alignItems: 'center' },
  presenceSlot: { alignItems: 'center', justifyContent: 'center' },
  presenceOverlap: { marginLeft: -7 },
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
  modeText: { fontSize: SCALE.micro, fontWeight: '600', letterSpacing: 0.3 },
  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roleLabel: { fontSize: SCALE.micro, fontWeight: '700', letterSpacing: 1.1 },
  roleText: { flex: 1, fontSize: SCALE.caption, fontWeight: '500' },
  list: { paddingHorizontal: 12, paddingVertical: 12, gap: 2 },
  more: { textAlign: 'center', fontSize: SCALE.micro, padding: 10 },
  starterWrap: { marginBottom: 9 },
  starterLabel: { fontSize: SCALE.micro, fontWeight: '600', letterSpacing: 0.3, marginBottom: 7, marginLeft: 2 },
  starterRow: { gap: 8, paddingRight: 8 },
  starterChip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 8, maxWidth: 240 },
  starterText: { fontSize: 13.5, fontWeight: '600' },
  inputBar: {
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  memBtn: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
  memoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 },
  memoryText: { fontSize: SCALE.micro, fontWeight: '600', fontStyle: 'italic' },
  actionMenu: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 11, marginBottom: 10 },
  actionMenuHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 },
  actionMenuBadge: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actionMenuHeading: { flex: 1, minWidth: 0 },
  actionMenuTitle: { fontSize: 13.5, fontWeight: '700' },
  actionMenuSubtitle: { fontSize: 10.5, marginTop: 2 },
  actionMenuClose: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  actionTile: { width: '48.5%', minHeight: 76, borderRadius: 13, borderWidth: 1, padding: 9, justifyContent: 'center' },
  actionTileIcon: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  actionTileTitle: { fontSize: 11.5, fontWeight: '700' },
  actionTileHint: { fontSize: 9.5, marginTop: 2 },
  setupHint: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  setupHintText: { fontSize: 10.5, flex: 1 },
  setupHintLink: { fontSize: 11, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 13,
    fontSize: 14.5,
    lineHeight: 20,
    minHeight: 48,
    maxHeight: 130,
  },
  ideasButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  send: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  errCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, marginVertical: 10 },
  errTitle: { fontSize: 14.5, fontWeight: '700' },
  errSub: { fontSize: SCALE.small, marginTop: 6, lineHeight: 19 },
  errBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  errBtn: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: RADIUS.pill },
  errBtnText: { fontWeight: '700', fontSize: SCALE.small },
});
