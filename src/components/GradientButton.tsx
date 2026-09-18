import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../state/AppContext';
import { GRADIENTS, INK, RADIUS, SPACING } from '../theme';

export function GradientButton({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'gold' | 'ghost';
  accessibilityLabel?: string;
}) {
  const { theme } = useApp();
  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={({ pressed }) => [
          styles.ghost,
          { borderColor: theme.border, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={theme.text} />
        ) : (
          <Text style={[styles.ghostText, { color: theme.text }]}>{title}</Text>
        )}
      </Pressable>
    );
  }
  const colors = variant === 'gold' ? GRADIENTS.gold : GRADIENTS.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.wrap,
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.grad}>
        {loading ? (
          <ActivityIndicator color={INK} />
        ) : (
          <Text style={styles.text}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: { borderRadius: RADIUS.md, overflow: 'hidden' },
  grad: {
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    borderRadius: RADIUS.md,
  },
  text: { color: INK, fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
  ghost: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ghostText: { fontWeight: '600', fontSize: 15 },
  row: { flexDirection: 'row', gap: 10 },
});
