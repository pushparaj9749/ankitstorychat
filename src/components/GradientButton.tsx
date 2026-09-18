/**
 * KISSA v4.2 — Buttons
 * Primary: solid text on rose, minimal, editorial.
 * Ghost: subtle surface, border.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { RADIUS, SPACING, withAlpha, INK } from '../theme';
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
  variant?: 'primary' | 'gold' | 'ghost' | 'secondary';
  accessibilityLabel?: string;
  icon?: string;
}) {
  const { theme } = useApp();

  const handlePress = () => {
    lightBuzz();
    onPress();
  };

  if (variant === 'ghost' || variant === 'secondary') {
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
            backgroundColor: withAlpha(theme.surface2, pressed ? 0.95 : 0.88),
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

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.primaryWrap,
        {
          backgroundColor: theme.text,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.bg} size="small" />
      ) : (
        <View style={styles.primaryInner}>
          {icon ? <Text style={[styles.primaryIcon, { color: theme.bg }]}>{icon}</Text> : null}
          <Text style={[styles.primaryText, { color: theme.bg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export const PrimaryButton = GradientButton;
export const SecondaryButton = (props: any) => <GradientButton {...props} variant="ghost" />;

export function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  primaryWrap: {
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryIcon: { fontSize: 14, fontWeight: '800' },
  primaryText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.4 },
  ghost: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingVertical: 13,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ghostIcon: { fontSize: 14 },
  ghostText: { fontWeight: '600', fontSize: 13.5, letterSpacing: 0.2 },
  row: { flexDirection: 'row', gap: 10 },
});
