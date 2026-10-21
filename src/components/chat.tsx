/**
 * KISSA v2.5.2 — Chat UI
 * Cinematic interactive story stage, NOT a generic messenger.
 *
 * Reading model (unchanged structure, sharper treatment):
 *  - Narration: atmospheric, faded italic, editorial — same bubble shape as
 *    dialogue (one shared layout) but a whisper-quiet surface and no name.
 *  - Character dialogue: named, crisp, rose-edged bubble.
 *  - Player: distinct warm gradient bubble, right aligned.
 *  - Scene markers: chapter dividers preserving the "✦" marker.
 *
 * Layout note: narration and dialogue intentionally share ONE layout shape —
 * the difference is carried by colour, weight and an accent edge, so a reader
 * always knows who is talking without the screen turning into a chat log.
 */
import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ChatMessage } from '../types';
import { useApp } from '../state/AppContext';
import { FADED_TEXT_OPACITY, GRADIENTS, RADIUS, SCALE, SPACING, TOUCH, withAlpha, FONTS, TEXT_SIZE_MULTIPLIER } from '../theme';
import { parseStoryMarkup, stripStoryMarkup } from '../lib/markup';
import { sanitizeStoredText } from '../lib/leakGuard';
import { Avatar } from './bits';
import { Icon, ICON_SIZE } from './icons';

/**
 * `Driver Balwant: "Ruk-na."` → { name: 'Driver Balwant', rest: '"Ruk-na."' }.
 * Only fires for a short capitalised name followed by a colon and an opening
 * quote or *action*, so ordinary narration with a colon is left alone.
 */
export function inferSpeaker(text: string): { name: string; rest: string } | null {
  const m = /^\s*([A-Z][A-Za-z.'-]*(?: [A-Z][A-Za-z.'-]*){0,2})\s*:\s*(?=["\u201C*])/.exec(text ?? '');
  if (!m) return null;
  return { name: m[1], rest: text.slice(m[0].length) };
}

/**
 * One AI reply often mixes narration and several speakers:
 *   *Vedika muskurati hai.*\nVedika: "Chai?"\n*Laila ghadi dekhti hai.*\nLaila: "Bees minute."
 * Rendered as one bubble it showed every line under the FIRST speaker's name
 * (raw "Laila:" prefixes inside "Vedika"'s bubble). This splits it into beats
 * — narration lines and one beat per speaker line — so each gets its own
 * bubble, exactly like the opening. Display only; the stored text is untouched.
 */
export type StoryBeat = { kind: 'narration' | 'dialogue'; speaker: string | null; text: string };
export function splitStoryBeats(text: string, leadSpeaker: string | null = null): StoryBeat[] {
  const beats: StoryBeat[] = [];
  const lines = (text ?? '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const who = inferSpeaker(line);
    const last = beats[beats.length - 1];
    if (who) {
      beats.push({ kind: 'dialogue', speaker: who.name, text: who.rest });
    } else if (/^\*[^*]+\*$/.test(line)) {
      if (last && last.kind === 'narration') last.text += `\n${line}`;
      else beats.push({ kind: 'narration', speaker: null, text: line });
    } else if (last && last.kind === 'dialogue') {
      last.text += `\n${line}`;
    } else {
      // Plain text after narration is speech/prose, never faded narration.
      beats.push({ kind: 'dialogue', speaker: null, text: line });
    }
  }
  // The engine lifts the first speaker's "Name:" prefix into the message's
  // speaker field — give that unlabelled first line its name back.
  if (leadSpeaker) {
    const first = beats.find((b) => b.kind === 'dialogue');
    if (first && !first.speaker) first.speaker = leadSpeaker;
  }
  return beats;
}

/** Same colour for "Vedika" and "Vedika Rajvanshi": avatars key on the first name. */
export function avatarKey(name: string): string {
  return (name ?? '').trim().split(/\s+/)[0].toLowerCase() || '?';
}

function isSceneMarker(text: string): boolean {
  return (text ?? '').trimStart().startsWith('✦');
}

export function StoryText({
  text,
  color,
  fadedColor,
  fontSize,
  lineHeight,
  faded = false,
}: {
  text: string;
  color: string;
  fadedColor: string;
  fontSize: number;
  lineHeight?: number;
  faded?: boolean;
}) {
  const spans = useMemo(() => parseStoryMarkup(text), [text]);
  return (
    <Text style={[styles.body, { color, fontSize }, lineHeight ? { lineHeight } : null]}>
      {spans.map((s, i) => (
        <Text key={`${i}-${s.faded ? 'f' : 'p'}`} style={s.faded || faded ? [styles.faded, { color: fadedColor }] : undefined}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

/** The storyteller's mark — a quiet ✦ instead of a loud gradient avatar on every line. */
function NarratorMark() {
  const { theme } = useApp();
  return (
    <View
      style={[styles.narratorMark, { backgroundColor: theme.surface2, borderColor: theme.border }]}
      accessibilityLabel="Narrator"
    >
      <Icon name="sparkles" size={13} color={theme.textDim} />
    </View>
  );
}

function ChatBubbleImpl({ message: stored }: { message: ChatMessage }) {
  const { theme, settings } = useApp();
  // v2.7.0: messages saved by older versions may carry leaked notes — clean
  // them on render (reader text is never touched).
  const message = useMemo(() => {
    if (stored.role === 'user' || stored.role === 'system' || isSceneMarker(stored.text)) return stored;
    const clean = sanitizeStoredText(stored.text);
    return clean && clean !== stored.text ? { ...stored, text: clean } : stored;
  }, [stored]);
  const scale = TEXT_SIZE_MULTIPLIER[settings.textSize];
  const bodySize = FONTS.body * scale;
  const smallBody = 14.5 * scale;

  const narrationBubble = (text: string, speaker: string | null, key?: string) => (
      <View key={key} style={[styles.row, styles.rowLeft]}>
        {speaker ? <Avatar id={avatarKey(speaker)} name={speaker} size={30} /> : <NarratorMark />}
        <View
          style={[
            styles.bubble,
            styles.bubbleNarration,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <LinearGradient colors={['rgba(255,255,255,0.025)', 'transparent']} style={styles.bubbleGlow} pointerEvents="none" />
          <View style={[styles.accentEdge, { backgroundColor: 'transparent' }]} pointerEvents="none" />
          <StoryText
            text={text}
            color={theme.textDim}
            fadedColor={withAlpha(theme.textDim, FADED_TEXT_OPACITY)}
            fontSize={smallBody}
            lineHeight={22 * scale}
            faded
          />
        </View>
      </View>
  );
  const dialogueBubble = (text: string, speaker: string | null, key?: string) => (
    <View key={key} style={[styles.row, styles.rowLeft]}>
      {speaker ? <Avatar id={avatarKey(speaker)} name={speaker} size={30} /> : <NarratorMark />}
      <View
        style={[
          styles.bubble,
          styles.bubbleDialogue,
          { backgroundColor: theme.surface2, borderColor: theme.border },
        ]}
      >
        <LinearGradient colors={['rgba(255,255,255,0.04)', 'transparent']} style={styles.bubbleGlow} pointerEvents="none" />
        <View style={[styles.accentEdge, { backgroundColor: 'transparent' }]} pointerEvents="none" />
        {speaker ? (
          <View style={styles.speakerRow}>
            <Text style={[styles.speaker, { color: theme.accent, fontSize: 12 * scale }]}>{speaker}</Text>
          </View>
        ) : null}
        <StoryText text={text} color={'#fff'} fadedColor={withAlpha(theme.textDim, FADED_TEXT_OPACITY)} fontSize={bodySize} lineHeight={23 * scale} />
      </View>
    </View>
  );

  if (message.role === 'narration') {
    if (isSceneMarker(message.text)) {
      return (
        <View style={styles.sceneWrap}>
          <View style={[styles.sceneLine, { backgroundColor: theme.border }]} />
          <View style={[styles.scenePill, { backgroundColor: 'transparent', borderColor: theme.border }]}>
            <Text style={[styles.sceneText, { color: theme.textDim, fontSize: 11 * scale }]}>{message.text}</Text>
          </View>
          <View style={[styles.sceneLine, { backgroundColor: theme.border }]} />
        </View>
      );
    }

    // Narration — same layout shape as dialogue (see file header).
    return narrationBubble(message.text, message.speaker ?? null);
  }

  if (message.role === 'system') {
    return (
      <View style={styles.sysWrap}>
        <View style={[styles.sysPill, { backgroundColor: withAlpha(theme.surface2, 0.8), borderColor: theme.borderSoft }]}>
          <Text style={[styles.sysText, { color: theme.textFaint, fontSize: 11 * scale }]}>{stripStoryMarkup(message.text)}</Text>
        </View>
      </View>
    );
  }

  const isUser = message.role === 'user';
  if (isUser) {
    return (
      <View style={[styles.row, styles.rowRight]}>
        <View style={[styles.bubble, styles.bubbleUser, { backgroundColor: theme.primary }]}>
          <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <StoryText text={message.text} color="#fff" fadedColor="rgba(255,255,255,0.78)" fontSize={bodySize} lineHeight={22 * scale} />
        </View>
      </View>
    );
  }

  // Assistant / character — named, crisp dialogue with a rose edge.
  // Story packs often write dialogue as `Name: "line"` without a speaker
  // field; lift that name into the label/avatar instead of repeating it inline.
  const inferred = message.speaker ? null : inferSpeaker(message.text);
  const speaker = message.speaker ?? inferred?.name ?? null;
  // Several beats in one reply → one bubble per beat (see splitStoryBeats).
  const beats = message.role === 'assistant' ? splitStoryBeats(message.text, message.speaker ?? null) : null;
  if (beats && beats.length > 1) {
    return (
      <View>
        {beats.map((bt, i) =>
          bt.kind === 'narration' ? narrationBubble(bt.text, null, `b${i}`) : dialogueBubble(bt.text, bt.speaker, `b${i}`),
        )}
      </View>
    );
  }
  const text = inferred ? inferred.rest : message.text;
  return dialogueBubble(text, speaker);
}

/**
 * Memoised: typing in the composer re-renders the Chat screen on every key;
 * bubbles (text parsing + gradients) only re-render when their message changes.
 */
export const ChatBubble = memo(
  ChatBubbleImpl,
  (a, b) =>
    a.message === b.message ||
    (a.message.id === b.message.id &&
      a.message.text === b.message.text &&
      a.message.speaker === b.message.speaker &&
      a.message.role === b.message.role),
);

export function TypingIndicator({ label = 'Story continues…' }: { label?: string }) {
  const { theme } = useApp();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const dotAnim = {
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
  };

  return (
    <View style={styles.typingRow}>
      <Avatar id="narrator" name="✦" size={26} />
      <Animated.View
        style={[
          styles.typingBubble,
          { backgroundColor: theme.surface2, borderColor: theme.border },
          dotAnim,
        ]}
      >
        <View style={styles.typingDots}>
          <View style={[styles.dot, { backgroundColor: withAlpha(theme.text, 0.35) }]} />
          <View style={[styles.dot, { backgroundColor: withAlpha(theme.text, 0.6) }]} />
          <View style={[styles.dot, { backgroundColor: theme.text }]} />
        </View>
        <Text style={[styles.typingText, { color: theme.textDim }]}>{label}</Text>
      </Animated.View>
    </View>
  );
}

export function ChoiceChips({
  choices,
  onPick,
  disabled,
}: {
  choices: { id: string; label: string }[];
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const { theme } = useApp();
  if (!choices.length) return null;

  return (
    <View style={styles.chipsWrap}>
      {choices.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => onPick(c.id)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={stripStoryMarkup(c.label)}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: pressed ? theme.surface3 : theme.surface,
              borderColor: pressed ? withAlpha(theme.primary, 0.45) : theme.border,
              opacity: disabled ? 0.45 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
        >
          <View style={[styles.chipIndex, { backgroundColor: theme.primarySoft }]}>
            <Icon name="play" size={10} color={theme.primary} style={styles.chipIndexIcon} />
          </View>
          <Text style={[styles.chipText, { color: theme.text }]}>{stripStoryMarkup(c.label)}</Text>
          <Icon name="chevron-forward" size={ICON_SIZE.sm} color={theme.textFaint} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sceneWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
    gap: 10,
    paddingHorizontal: 8,
  },
  sceneLine: { flex: 1, height: 1 },
  scenePill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  sceneText: { fontWeight: '600', letterSpacing: 0.6, textAlign: 'center' },
  sysWrap: { alignItems: 'center', marginVertical: 8 },
  sysPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1 },
  sysText: { fontWeight: '600', letterSpacing: 0.2 },
  narratorMark: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', marginVertical: 6, gap: 8, alignItems: 'flex-end', paddingHorizontal: 2 },
  rowRight: { justifyContent: 'flex-end', marginLeft: 48 },
  rowLeft: { justifyContent: 'flex-start', marginRight: 10 },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  bubbleNarration: { borderBottomLeftRadius: 6, borderWidth: 1 },
  bubbleDialogue: { borderBottomLeftRadius: 6, borderWidth: 1 },
  bubbleUser: {
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 46,
    opacity: 0.9,
  },
  /* Rose reading edge on dialogue only — same node, style-only difference so
     narration and dialogue keep an identical layout shape. */
  accentEdge: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  speakerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  speaker: { fontWeight: '700', letterSpacing: 0.1 },
  speakerDot: { width: 4, height: 4, borderRadius: 2 },
  body: { lineHeight: 23 },
  faded: { fontStyle: 'italic', letterSpacing: 0.12 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8, paddingHorizontal: 2 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  typingDots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  typingText: { fontStyle: 'italic', fontSize: SCALE.micro, fontWeight: '600' },
  chipsWrap: { flexDirection: 'column', gap: 8, marginVertical: 10, paddingHorizontal: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: TOUCH.min,
  },
  chipIndex: { width: 24, height: 24, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  chipIndexIcon: { marginLeft: 1 },
  chipText: { flex: 1, fontSize: 14, fontWeight: '500', letterSpacing: 0.05, lineHeight: 19 },
});
