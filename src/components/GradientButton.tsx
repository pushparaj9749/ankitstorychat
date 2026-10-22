/**
 * KISSA v2.10 — Buttons
 * Primary: Kissa Rose gradient pill (white text), quiet surface when disabled.
 * Ghost: subtle surface, border.
 *
 * v2.10 (Noir): a springy press (native driver), a soft glass sheen on the
 * upper half of the primary pill, and optional SVG icons (`iconName`).
 * Classic keeps its flat look; only the press feel is shared.
 */
import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from './icons';
import { useApp } from '../state/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS, RADIUS, SHADOWS, SPACING, TOUCH, withAlpha } from '../theme';
import { GRADIENTS as CLASSIC_GRADIENTS } from '../ui/classic/theme';
import { lightBuzz } from '../lib/haptics';

export function GradientButton({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  accessibilityLabel,
  icon,
  iconName,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'gold' | 'ghost' | 'secondary';
  accessibilityLabel?: string;
  icon?: string;
  /** SVG icon shown before the title. */
  iconName?: IconName;
}) {
  const { theme, uiTemplate } = useApp();
  const classic = uiTemplate === 'classic';
  const G = classic ? CLASSIC_GRADIENTS : GRADIENTS;
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: v === 1 ? 8 : 0 }).start();
  const pressIn = () => springTo(0.96);
  const pressOut = () => springTo(1);

  const handlePress = () => {
    lightBuzz();
    onPress();
  };

  if (variant === 'ghost' || variant === 'secondary') {
    return (
      <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={({ pressed }) => [
          styles.ghost,
          {
            borderColor: classic ? theme.border : withAlpha(theme.text, pressed ? 0.2 : 0.12),
            backgroundColor: withAlpha(theme.surface2, pressed ? 0.95 : 0.88),
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={theme.text} size="small" />
        ) : (
          <View style={styles.ghostInner}>
            {iconName ? <Icon name={iconName} size={16} color={theme.textDim} /> : null}
            {icon ? <Text style={[styles.ghostIcon, { color: theme.textDim }]}>{icon}</Text> : null}
            <Text style={[styles.ghostText, { color: theme.text }]}>{title}</Text>
          </View>
        )}
      </Pressable>
      </Animated.View>
    );
  }

  // Primary — Kissa Rose gradient with a soft glow. Disabled is a quiet
  // surface (not a grey slab), so the button still reads as "the next step".
  const inactive = disabled && !loading;
  const gradient = variant === 'gold' ? G.gold : G.primary;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
    <Pressable
      onPress={handlePress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.primaryWrap,
        inactive
          ? { backgroundColor: withAlpha(theme.surface2, 0.95), borderColor: theme.border }
          : [{ borderColor: 'rgba(255,255,255,0.14)' }, SHADOWS.glowAccent],
        { opacity: pressed ? 0.94 : 1 },
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
      {!inactive && !classic ? (
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <View style={styles.primaryInner}>
          {iconName ? <Icon name={iconName} size={17} color={inactive ? theme.textFaint : '#fff'} /> : null}
          {icon ? <Text style={[styles.primaryIcon, { color: inactive ? theme.textFaint : '#fff' }]}>{icon}</Text> : null}
          <Text style={[styles.primaryText, { color: inactive ? theme.textFaint : '#fff' }]}>{title}</Text>
        </View>
      )}
    </Pressable>
    </Animated.View>
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
  sheen: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: 0,
    height: '55%',
    borderTopLeftRadius: RADIUS.pill,
    borderTopRightRadius: RADIUS.pill,
  },
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
