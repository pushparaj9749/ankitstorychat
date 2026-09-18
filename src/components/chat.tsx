/** Chat UI — cinematic immersive story chat. Not a generic messenger. */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../types';
import { useApp } from '../state/AppContext';
import { FADED_TEXT_OPACITY, FONTS, RADIUS, SPACING, TEXT_SIZE_MULTIPLIER, TYPE, withAlpha } from '../theme';
import { parseStoryMarkup, stripStoryMarkup } from '../lib/markup';
import { Avatar } from './bits';

function isSceneMarker(text: string): boolean {
  return (text ?? '').trimStart().startsWith('✦');
}

/**
 * Story text renderer — faded *action* vs crisp dialogue.
 */
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
        <Text
          key={`${i}-${s.faded ? 'f' : 'p'}`}
          style={s.faded || faded ? [styles.faded, { color: fadedColor }] : undefined}
        >
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
          <View style={[styles.sceneLine, { backgroundColor: withAlpha(theme.border, 0.6) }]} />
          <View style={[styles.scenePill, { backgroundColor: withAlpha(theme.surface, 0.92), borderColor: theme.border }]}>
            <Text style={[styles.sceneText, { color: theme.textDim, fontSize: 12 * scale }]}>
              {message.text.replace(/^✦\s*/, '✦ ')}
            </Text>
          </View>
          <View style={[styles.sceneLine, { backgroundColor: withAlpha(theme.border, 0.6) }]} />
        </View>
      );
    }
    // Narration block — same bubble chrome as dialogue, only text is faded (so opening block reads like rest)
    return (
      <View style={[styles.row, styles.rowLeft]}>
        <Avatar id={message.speaker ?? 'narrator'} name={message.speaker ?? '✦'} size={34} />
        <View style={[styles.bubble, styles.bubbleAI, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <StoryText
            text={message.text}
            color={theme.textDim}
            fadedColor={withAlpha(theme.textDim, FADED_TEXT_OPACITY)}
            fontSize={smallBody}
            lineHeight={21 * scale}
            faded
          />
        </View>
      </View>
    );
  }

  if (message.role === 'system') {
    return (
      <View style={styles.sysWrap}>
        <View style={[styles.sysPill, { backgroundColor: withAlpha(theme.surface, 0.8), borderColor: theme.border }]}>
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
          <StoryText
            text={message.text}
            color={'#FFF8F0'}
            fadedColor={withAlpha('#FFF8F0', 0.78)}
            fontSize={bodySize}
            lineHeight={22 * scale}
          />
        </View>
      </View>
    );
  }

  // Assistant / character dialogue — identity forward
  return (
    <View style={[styles.row, styles.rowLeft]}>
      <Avatar id={message.speaker ?? 'narrator'} name={message.speaker ?? '✦'} size={34} />
      <View style={[styles.bubble, styles.bubbleAI, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {message.speaker ? (
          <View style={styles.speakerRow}>
            <Text style={[styles.speaker, { color: theme.accent, fontSize: 11 * scale }]}>{message.speaker}</Text>
            <View style={[styles.speakerDot, { backgroundColor: withAlpha(theme.accent, 0.18) }]} />
          </View>
        ) : null}
        <StoryText
          text={message.text}
          color={theme.text}
          fadedColor={withAlpha(theme.text, FADED_TEXT_OPACITY)}
          fontSize={bodySize}
          lineHeight={22 * scale}
        />
      </View>
    </View>
  );
}

export function TypingIndicator({ label = 'typing…' }: { label?: string }) {
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
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.42, 1] }),
    transform: [
      {
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }),
      },
    ],
  };

  return (
    <View style={styles.typingRow}>
      <Avatar id="narrator" name="✦" size={30} />
      <Animated.View
        style={[
          styles.typingBubble,
          { backgroundColor: withAlpha(theme.surface, 0.96), borderColor: theme.border },
          dotAnim,
        ]}
      >
        <View style={styles.typingDots}>
          <View style={[styles.dot, { backgroundColor: withAlpha(theme.text, 0.42) }]} />
          <View style={[styles.dot, { backgroundColor: withAlpha(theme.text, 0.62) }]} />
          <View style={[styles.dot, { backgroundColor: withAlpha(theme.text, 0.84) }]} />
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
              backgroundColor: withAlpha(theme.primary, 0.14),
              borderColor: withAlpha(theme.primary, 0.32),
              opacity: disabled ? 0.4 : pressed ? 0.78 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={2}>
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
    paddingHorizontal: 12,
  },
  sceneLine: { flex: 1, height: StyleSheet.hairlineWidth, opacity: 0.9 },
  scenePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  sceneText: { fontStyle: 'italic', fontWeight: '700', letterSpacing: 0.2, textAlign: 'center' },

  sysWrap: { alignItems: 'center', marginVertical: 6 },
  sysPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  sysText: { fontWeight: '600', letterSpacing: 0.2 },

  row: { flexDirection: 'row', marginVertical: 5, gap: 9, alignItems: 'flex-end', paddingHorizontal: 2 },
  rowRight: { justifyContent: 'flex-end', marginLeft: 52 },
  rowLeft: { justifyContent: 'flex-start', marginRight: 16 },

  bubble: {
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
  },
  bubbleUser: {
    borderBottomRightRadius: 6,
    // subtle inner glow via shadow
    shadowColor: '#C45C4A',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  bubbleAI: {
    borderBottomLeftRadius: 6,
    borderWidth: 1,
  },
  bubbleNarration: {
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(232,160,112,0.42)',
    paddingVertical: 10,
  },
  narrAccent: { width: 2, borderRadius: 1, alignSelf: 'stretch', marginVertical: 2 },

  speakerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  speaker: { fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  speakerDot: { width: 5, height: 5, borderRadius: 2.5 },

  body: { lineHeight: 22 },
  faded: { fontStyle: 'italic', letterSpacing: 0.05 },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 6, paddingHorizontal: 2 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
  },
  typingDots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  typingText: { fontStyle: 'italic', fontSize: 12, fontWeight: '600' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8, paddingHorizontal: 2 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  chipText: { fontSize: FONTS.small, fontWeight: '600', letterSpacing: 0.1 },
});
