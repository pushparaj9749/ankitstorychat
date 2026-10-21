/**
 * PIN dots + numeric keypad for App Lock (lock screen and Settings → Security).
 * Provider-free: pass the theme colours in.
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { IconGlyph, type IconName } from './iconGlyph';
import { PIN_LENGTH } from '../lib/appLock';
import { withAlpha } from '../theme';

export interface PinColors {
  text: string;
  dim: string;
  faint: string;
  accent: string;
  danger: string;
  key: string;
  border: string;
}

export const PinDots = memo(function PinDots({
  filled,
  colors,
  error,
  shakeKey,
}: {
  filled: number;
  colors: PinColors;
  error?: boolean;
  /** Change this number to play the "wrong PIN" shake. */
  shakeKey?: number;
}) {
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!shakeKey) return;
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map((v) =>
        Animated.timing(shake, { toValue: v, duration: 45, useNativeDriver: true }),
      ),
    ).start();
  }, [shakeKey, shake]);

  return (
    <Animated.View
      style={[styles.dots, { transform: [{ translateX: shake }] }]}
      accessible
      accessibilityLabel={`${filled} of ${PIN_LENGTH} digits entered`}
    >
      {Array.from({ length: PIN_LENGTH }, (_, i) => {
        const on = i < filled;
        const c = error ? colors.danger : colors.accent;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              { borderColor: on ? c : withAlpha(colors.text, 0.28), backgroundColor: on ? c : 'transparent' },
            ]}
          />
        );
      })}
    </Animated.View>
  );
});

type KeyAction = { icon: IconName; label: string; onPress: () => void } | null;

export const PinKeypad = memo(function PinKeypad({
  onDigit,
  onBackspace,
  leftAction,
  colors,
  disabled,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  /** Bottom-left key, e.g. fingerprint. */
  leftAction?: KeyAction;
  colors: PinColors;
  disabled?: boolean;
}) {
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];
  const keyStyle = ({ pressed }: { pressed: boolean }) => [
    styles.key,
    { backgroundColor: pressed ? withAlpha(colors.accent, 0.22) : colors.key, borderColor: colors.border },
    disabled && { opacity: 0.4 },
  ];
  const digit = (d: string) => (
    <Pressable
      key={d}
      style={keyStyle}
      onPress={() => onDigit(d)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={d}
      testID={`pin-key-${d}`}
    >
      <Text style={[styles.keyText, { color: colors.text }]}>{d}</Text>
    </Pressable>
  );
  return (
    <View style={styles.pad}>
      {rows.map((r, i) => (
        <View key={i} style={styles.row}>
          {r.map(digit)}
        </View>
      ))}
      <View style={styles.row}>
        {leftAction ? (
          <Pressable
            style={({ pressed }) => [styles.key, styles.keyGhost, pressed && { backgroundColor: withAlpha(colors.accent, 0.16) }]}
            onPress={leftAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={leftAction.label}
            testID="pin-key-left"
          >
            <IconGlyph name={leftAction.icon} size={30} color={colors.accent} />
          </Pressable>
        ) : (
          <View style={[styles.key, styles.keyGhost]} />
        )}
        {digit('0')}
        <Pressable
          style={({ pressed }) => [styles.key, styles.keyGhost, pressed && { backgroundColor: withAlpha(colors.text, 0.08) }]}
          onPress={onBackspace}
          accessibilityRole="button"
          accessibilityLabel="Delete"
          testID="pin-key-back"
        >
          <IconGlyph name="backspace-outline" size={26} color={colors.dim} />
        </Pressable>
      </View>
    </View>
  );
});

const KEY = 72;
const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginVertical: 22 },
  dot: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.6 },
  pad: { alignSelf: 'center', gap: 14 },
  row: { flexDirection: 'row', gap: 22 },
  key: {
    width: KEY,
    height: KEY,
    borderRadius: KEY / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyGhost: { borderWidth: 0, backgroundColor: 'transparent' },
  keyText: { fontSize: 28, fontWeight: '500', letterSpacing: 0.5 },
});

export function pinColorsFor(theme: {
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  danger: string;
  surface2: string;
  border: string;
}): PinColors {
  return {
    text: theme.text,
    dim: theme.textDim,
    faint: theme.textFaint,
    accent: theme.accent,
    danger: theme.danger,
    key: withAlpha(theme.surface2, 0.9),
    border: theme.border,
  };
}
