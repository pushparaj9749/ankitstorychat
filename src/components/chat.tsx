/** Chat UI: bubbles, narration dividers, typing indicator, choice chips. */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../types';
import { useApp } from '../state/AppContext';
import { FONTS, RADIUS, SPACING, TEXT_SIZE_MULTIPLIER } from '../theme';
import { Avatar } from './bits';

export function ChatBubble({ message }: { message: ChatMessage }) {
  const { theme, settings } = useApp();
  const scale = TEXT_SIZE_MULTIPLIER[settings.textSize];

  if (message.role === 'narration') {
    return (
      <View style={styles.narrWrap}>
        <View style={[styles.narrLine, { backgroundColor: theme.border }]} />
        <Text style={[styles.narrText, { color: theme.textFaint, fontSize: FONTS.small * scale }]}>
          {message.text}
        </Text>
        <View style={[styles.narrLine, { backgroundColor: theme.border }]} />
      </View>
    );
  }

  if (message.role === 'system') {
    return (
      <View style={styles.sysWrap}>
        <Text style={[styles.sysText, { color: theme.textFaint }]}>{message.text}</Text>
      </View>
    );
  }

  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      {!isUser ? (
        <Avatar id={message.speaker ?? 'narrator'} name={message.speaker ?? '✦'} size={32} />
      ) : null}
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: theme.primary }]
            : [styles.bubbleAI, { backgroundColor: theme.surface, borderColor: theme.border }],
        ]}
      >
        {!isUser && message.speaker ? (
          <Text style={[styles.speaker, { color: theme.accent, fontSize: FONTS.tiny * scale }]}>
            {message.speaker}
          </Text>
        ) : null}
        <Text style={[styles.body, { color: '#fff', fontSize: FONTS.body * scale }]}>{message.text}</Text>
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
        Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <View style={styles.typingRow}>
      <Avatar id="narrator" name="✦" size={32} />
      <Animated.View
        style={[
          styles.typingBubble,
          { backgroundColor: theme.surface, borderColor: theme.border, opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
        ]}
      >
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
          accessibilityLabel={c.label}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: theme.primarySoft,
              borderColor: theme.primary,
              opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.chipText, { color: '#D9CFFF' }]} numberOfLines={2}>
            {c.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  narrWrap: { alignItems: 'center', marginVertical: SPACING.sm, gap: 6, paddingHorizontal: 24 },
  narrLine: { height: 1, width: 48, opacity: 0.6 },
  narrText: { textAlign: 'center', fontStyle: 'italic' },
  sysWrap: { alignItems: 'center', marginVertical: 4 },
  sysText: { fontSize: FONTS.tiny },
  row: { flexDirection: 'row', marginVertical: 4, gap: 8, alignItems: 'flex-end' },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI: { borderBottomLeftRadius: 4, borderWidth: 1 },
  speaker: { fontWeight: '800', marginBottom: 2 },
  body: { lineHeight: 21 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  typingBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1 },
  typingText: { fontStyle: 'italic', fontSize: FONTS.small },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: '100%',
  },
  chipText: { fontSize: FONTS.small, fontWeight: '600' },
});
