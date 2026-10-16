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
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ChatMessage } from '../types';
import { useApp } from '../state/AppContext';
import { FADED_TEXT_OPACITY, GRADIENTS, RADIUS, SCALE, SHADOWS, SPACING, TOUCH, withAlpha, FONTS, TEXT_SIZE_MULTIPLIER } from '../theme';
import { parseStoryMarkup, stripStoryMarkup } from '../lib/markup';
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
      style={[styles.narratorMark, { backgroundColor: withAlpha(theme.violet, 0.16), borderColor: withAlpha(theme.violet, 0.34) }]}
      accessibilityLabel="Narrator"
    >
      <Icon name="sparkles" size={14} color={theme.gold} />
    </View>
  );
}

export function ChatBubble({ message }: { message: ChatMessage }) {
  const { theme, settings } = useApp();
  const scale = TEXT_SIZE_MULTIPLIER[settings.textSize];
  const bodySize = FONTS.body * scale;
  const smallBody = 14.5 * scale;

  if (message.role === 'narration') {
    if (isSceneMarker(message.text)) {
      return (
        <View style={styles.sceneWrap}>
          <View style={[styles.sceneLine, { backgroundColor: withAlpha(theme.primary, 0.28) }]} />
          <View style={[styles.scenePill, { backgroundColor: theme.surface2, borderColor: withAlpha(theme.primary, 0.22) }]}>
            <Text style={[styles.sceneText, { color: theme.textDim, fontSize: 11 * scale }]}>{message.text}</Text>
          </View>
          <View style={[styles.sceneLine, { backgroundColor: withAlpha(theme.primary, 0.28) }]} />
        </View>
      );
    }

    // Narration — same layout shape as dialogue (see file header).
    return (
      <View style={[styles.row, styles.rowLeft]}>
        {message.speaker ? <Avatar id={message.speaker} name={message.speaker} size={30} /> : <NarratorMark />}
        <View
          style={[
            styles.bubble,
            styles.bubbleNarration,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <LinearGradient colors={['rgba(255,79,139,0.05)', 'transparent']} style={styles.bubbleGlow} pointerEvents="none" />
          <View style={[styles.accentEdge, { backgroundColor: 'transparent' }]} pointerEvents="none" />
          <StoryText
            text={message.text}
            color={theme.textDim}
            fadedColor={withAlpha(theme.textDim, FADED_TEXT_OPACITY)}
            fontSize={smallBody}
            lineHeight={22 * scale}
            faded
          />
        </View>
      </View>
    );
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
  const text = inferred ? inferred.rest : message.text;
  return (
    <View style={[styles.row, styles.rowLeft]}>
      {speaker ? <Avatar id={speaker} name={speaker} size={30} /> : <NarratorMark />}
      <View
        style={[
          styles.bubble,
          styles.bubbleDialogue,
          { backgroundColor: withAlpha(theme.surface2, 0.94), borderColor: withAlpha(theme.primary, 0.24) },
        ]}
      >
        <LinearGradient colors={['rgba(255,122,176,0.10)', 'transparent']} style={styles.bubbleGlow} pointerEvents="none" />
        <View style={[styles.accentEdge, { backgroundColor: theme.primary }]} pointerEvents="none" />
        {speaker ? (
          <View style={styles.speakerRow}>
            <Text style={[styles.speaker, { color: theme.accent, fontSize: 11 * scale }]}>{speaker}</Text>
            <View style={[styles.speakerDot, { backgroundColor: withAlpha(theme.accent, 0.5) }]} />
          </View>
        ) : null}
        <StoryText text={text} color={'#fff'} fadedColor={withAlpha(theme.textDim, FADED_TEXT_OPACITY)} fontSize={bodySize} lineHeight={23 * scale} />
      </View>
    </View>
  );
}

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
          { backgroundColor: withAlpha(theme.surface2, 0.9), borderColor: withAlpha(theme.primary, 0.18) },
          dotAnim,
        ]}
      >
        <View style={styles.typingDots}>
          <View style={[styles.dot, { backgroundColor: withAlpha(theme.accent, 0.45) }]} />
          <View style={[styles.dot, { backgroundColor: withAlpha(theme.accent, 0.7) }]} />
          <View style={[styles.dot, { backgroundColor: theme.accent }]} />
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
              backgroundColor: withAlpha(theme.surface2, pressed ? 0.72 : 0.9),
              borderColor: pressed ? withAlpha(theme.primary, 0.4) : theme.border,
              opacity: disabled ? 0.45 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
        >
          <View style={styles.chipIndex}>
            <LinearGradient colors={[...GRADIENTS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Icon name="play" size={10} color="#fff" style={styles.chipIndexIcon} />
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
  sceneText: { fontWeight: '800', letterSpacing: 0.9, textAlign: 'center' },
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
    borderRadius: 22,
    overflow: 'hidden',
  },
  bubbleNarration: { borderBottomLeftRadius: 7 },
  bubbleDialogue: { borderBottomLeftRadius: 7, borderWidth: 1 },
  bubbleUser: {
    borderBottomRightRadius: 7,
    paddingHorizontal: 16,
    paddingVertical: 13,
    ...SHADOWS.soft,
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
  speaker: { fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
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
    borderRadius: RADIUS.xl,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: TOUCH.min,
  },
  chipIndex: { width: 24, height: 24, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  chipIndexIcon: { marginLeft: 1 },
  chipText: { flex: 1, fontSize: 13.5, fontWeight: '600', letterSpacing: 0.05, lineHeight: 18 },
});
