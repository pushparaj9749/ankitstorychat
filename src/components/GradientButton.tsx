/**
 * Premium Kissa Buttons: Primary Luminous Gradient, Sunset Gold, Ghost Glass.
 * Kissa v2.4.1.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../state/AppContext';
import { GRADIENTS, INK, RADIUS, SHADOWS, SPACING, withAlpha } from '../theme';
import { lightBuzz } from '../lib/haptics';

export function GradientButton({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  accessibilityLabel,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'gold' | 'ghost';
  accessibilityLabel?: string;
  icon?: string;
}) {
  const { theme } = useApp();

  const handlePress = () => {
    lightBuzz();
    onPress();
  };

  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={({ pressed }) => [
          styles.ghost,
          {
            borderColor: theme.border,
            backgroundColor: withAlpha(theme.surface, pressed ? 0.94 : 0.82),
            opacity: disabled ? 0.45 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={theme.text} size="small" />
        ) : (
          <View style={styles.ghostInner}>
            {icon ? <Text style={[styles.ghostIcon, { color: theme.textDim }]}>{icon}</Text> : null}
            <Text style={[styles.ghostText, { color: theme.text }]}>{title}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  const colors = variant === 'gold' ? GRADIENTS.gold : GRADIENTS.primary;
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.wrap,
        { opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        SHADOWS.glowAccent,
      ]}
    >
      <LinearGradient
        colors={[...colors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.grad}
      >
        {loading ? (
          <ActivityIndicator color={INK} size="small" />
        ) : (
          <View style={styles.primaryInner}>
            {icon ? <Text style={styles.primaryIcon}>{icon}</Text> : null}
            <Text style={styles.text}>{title}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: { borderRadius: RADIUS.pill, overflow: 'hidden' },
  grad: {
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
  },
  primaryInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryIcon: { fontSize: 16 },
  text: { color: INK, fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },
  ghost: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingVertical: 13,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ghostIcon: { fontSize: 15 },
  ghostText: { fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },
  row: { flexDirection: 'row', gap: 10 },
});
