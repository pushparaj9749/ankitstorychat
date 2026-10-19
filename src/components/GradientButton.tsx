/**
 * KISSA v2.4.2 — Buttons
 * Primary: Kissa Rose gradient pill (white text), quiet surface when disabled.
 * Ghost: subtle surface, border.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS, RADIUS, SHADOWS, SPACING, TOUCH, withAlpha } from '../theme';
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

  // Primary — Kissa Rose gradient with a soft glow. Disabled is a quiet
  // surface (not a grey slab), so the button still reads as "the next step".
  const inactive = disabled && !loading;
  const gradient = variant === 'gold' ? GRADIENTS.gold : GRADIENTS.primary;
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.primaryWrap,
        inactive
          ? { backgroundColor: withAlpha(theme.surface2, 0.95), borderColor: theme.border }
          : [{ borderColor: 'rgba(255,255,255,0.14)' }, SHADOWS.glowAccent],
        { transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.94 : 1 },
      ]}
    >
      {!inactive ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.primaryFill]}
          pointerEvents="none"
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <View style={styles.primaryInner}>
          {icon ? <Text style={[styles.primaryIcon, { color: inactive ? theme.textFaint : '#fff' }]}>{icon}</Text> : null}
          <Text style={[styles.primaryText, { color: inactive ? theme.textFaint : '#fff' }]}>{title}</Text>
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
    borderWidth: 1,
    minHeight: TOUCH.min + 6,
    paddingVertical: 13,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryFill: { borderRadius: RADIUS.pill },
  primaryInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryIcon: { fontSize: 14, fontWeight: '700' },
  primaryText: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
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
