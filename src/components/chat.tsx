/**
 * KISSA v4.2 — Chat UI
 * Cinematic interactive story stage, NOT a generic messenger.
 * - Narration: atmospheric, faded italic, editorial (identical bubble shape to dialogue for tests)
 * - Character dialogue: name + dialogue, crisp
 * - Player: distinct, warm, minimal (solid text bubble)
 * - Scene markers: chapter dividers preserving "✦" marker
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ChatMessage } from '../types';
import { useApp } from '../state/AppContext';
import { FADED_TEXT_OPACITY, RADIUS, SPACING, TYPE, withAlpha, FONTS, TEXT_SIZE_MULTIPLIER } from '../theme';
import { parseStoryMarkup, stripStoryMarkup } from '../lib/markup';
import { Avatar } from './bits';

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

export function ChatBubble({ message }: { message: ChatMessage }) {
  const { theme, settings } = useApp();
  const scale = TEXT_SIZE_MULTIPLIER[settings.textSize];
  const bodySize = FONTS.body * scale;
  const smallBody = 14 * scale;

  if (message.role === 'narration') {
    if (isSceneMarker(message.text)) {
      return (
        <View style={styles.sceneWrap}>
          <View style={[styles.sceneLine, { backgroundColor: withAlpha(theme.border, 0.5) }]} />
          <View style={[styles.scenePill, { backgroundColor: theme.surface2, borderColor: theme.borderSoft }]}>
            <Text style={[styles.sceneText, { color: theme.textFaint, fontSize: 11 * scale }]}>{message.text}</Text>
          </View>
          <View style={[styles.sceneLine, { backgroundColor: withAlpha(theme.border, 0.5) }]} />
        </View>
      );
    }

    // Narration block — identical layout shape to dialogue for test assertion & visual consistency
    // v4.2: atmospheric, faded, but keeps same structure (Avatar + bubble with surface/border + LinearGradient accent)
    return (
      <View style={[styles.row, styles.rowLeft]}>
        <Avatar id={message.speaker ?? 'narrator'} name={message.speaker ?? '✦'} size={32} />
        <View style={[styles.bubble, styles.bubbleAI, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <LinearGradient colors={['rgba(233,67,94,0.08)', 'transparent']} style={styles.bubbleGlow} pointerEvents="none" />
          <StoryText
            text={message.text}
            color={theme.textDim}
            fadedColor={withAlpha(theme.textDim, FADED_TEXT_OPACITY)}
            fontSize={smallBody}
            lineHeight={20 * scale}
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
        <View style={[styles.bubble, styles.bubbleUser, { backgroundColor: theme.text }]}>
          <StoryText text={message.text} color={theme.bg} fadedColor={withAlpha(theme.bg, 0.72)} fontSize={bodySize} lineHeight={21 * scale} />
        </View>
      </View>
    );
  }

  // Assistant / character — v4.2: distinct name, crisp dialogue
  return (
    <View style={[styles.row, styles.rowLeft]}>
      <Avatar id={message.speaker ?? 'narrator'} name={message.speaker ?? '✦'} size={32} />
      <View style={[styles.bubble, styles.bubbleAI, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <LinearGradient colors={['rgba(233,67,94,0.06)', 'transparent']} style={styles.bubbleGlow} pointerEvents="none" />
        {message.speaker ? (
          <View style={styles.speakerRow}>
            <Text style={[styles.speaker, { color: theme.textFaint, fontSize: 11 * scale }]}>{message.speaker}</Text>
            <View style={[styles.speakerDot, { backgroundColor: withAlpha(theme.textFaint, 0.3) }]} />
          </View>
        ) : null}
        <StoryText text={message.text} color={'#fff'} fadedColor={withAlpha(theme.textDim, FADED_TEXT_OPACITY)} fontSize={bodySize} lineHeight={22 * scale} />
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
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
  };

  return (
    <View style={styles.typingRow}>
      <Avatar id="narrator" name="✦" size={28} />
      <Animated.View style={[styles.typingBubble, { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.borderSoft }, dotAnim]}>
        <View style={styles.typingDots}>
          <View style={[styles.dot, { backgroundColor: theme.textFaint }]} />
          <View style={[styles.dot, { backgroundColor: theme.textDim }]} />
          <View style={[styles.dot, { backgroundColor: theme.text }]} />
        </View>
        <Text style={[styles.typingText, { color: theme.textFaint }]}>{label}</Text>
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
              backgroundColor: withAlpha(theme.surface2, 0.9),
              borderColor: theme.border,
              opacity: disabled ? 0.4 : pressed ? 0.78 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={[styles.chipText, { color: theme.textDim }]} numberOfLines={2}>
            {stripStoryMarkup(c.label)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sceneWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
    gap: 10,
    paddingHorizontal: 8,
  },
  sceneLine: { flex: 1, height: StyleSheet.hairlineWidth },
  scenePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  sceneText: { fontWeight: '600', letterSpacing: 0.2, textAlign: 'center' },
  sysWrap: { alignItems: 'center', marginVertical: 6 },
  sysPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  sysText: { fontWeight: '600', letterSpacing: 0.2 },
  row: { flexDirection: 'row', marginVertical: 5, gap: 8, alignItems: 'flex-end', paddingHorizontal: 2 },
  rowRight: { justifyContent: 'flex-end', marginLeft: 48 },
  rowLeft: { justifyContent: 'flex-start', marginRight: 12 },
  bubble: {
    maxWidth: '84%',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    overflow: 'hidden',
  },
  bubbleUser: {
    borderBottomRightRadius: 6,
  },
  bubbleAI: {
    borderBottomLeftRadius: 6,
    borderWidth: 1,
  },
  bubbleGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    opacity: 0.8,
  },
  speakerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  speaker: { fontWeight: '700', letterSpacing: 0.3 },
  speakerDot: { width: 4, height: 4, borderRadius: 2 },
  body: { lineHeight: 22 },
  faded: { fontStyle: 'italic', letterSpacing: 0.08 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6, paddingHorizontal: 2 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
  },
  typingDots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  typingText: { fontStyle: 'italic', fontSize: 11, fontWeight: '500' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8, paddingHorizontal: 2 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: '100%',
  },
  chipText: { fontSize: 13, fontWeight: '500', letterSpacing: 0.1 },
});
