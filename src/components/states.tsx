/**
 * KISSA v4.2 — Empty, Error, Loading, Offline States
 * Minimal, editorial, calm. No excessive emoji, no neon.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { RADIUS, SPACING, TYPE, withAlpha } from '../theme';
import { GradientButton } from './GradientButton';

export function EmptyState({
  emoji,
  title,
  subtitle,
  action,
  onAction,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  const { theme } = useApp();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sub, { color: theme.textDim }]}>{subtitle}</Text> : null}
      {action && onAction ? (
        <View style={styles.btn}>
          <GradientButton title={action} onPress={onAction} variant="ghost" />
        </View>
      ) : null}
    </View>
  );
}

export function ErrorState({
  title,
  subtitle,
  retry,
  onRetry,
  secondary,
  onSecondary,
}: {
  title: string;
  subtitle?: string;
  retry?: string;
  onRetry?: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  const { theme } = useApp();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: withAlpha(theme.danger, 0.08), borderColor: withAlpha(theme.danger, 0.18) }]}>
        <Text style={styles.emoji}>!</Text>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sub, { color: theme.textDim }]}>{subtitle}</Text> : null}
      <View style={styles.btnRow}>
        {retry && onRetry ? <GradientButton title={retry} onPress={onRetry} /> : null}
        {secondary && onSecondary ? <GradientButton title={secondary} onPress={onSecondary} variant="ghost" /> : null}
      </View>
    </View>
  );
}

export function LoadingState({ label = 'Opening story…' }: { label?: string }) {
  const { theme } = useApp();
  return (
    <View style={styles.wrap}>
      <View style={[styles.loadingCircle, { borderColor: theme.border }]}>
        <ActivityIndicator size="small" color={theme.textDim} />
      </View>
      <Text style={[styles.sub, { color: theme.textFaint, marginTop: SPACING.md }]}>{label}</Text>
    </View>
  );
}

export function OfflineState({
  subtitle,
  retry,
  onRetry,
  secondary,
  onSecondary,
}: {
  subtitle?: string;
  retry?: string;
  onRetry?: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  const { theme } = useApp();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={styles.emoji}>↯</Text>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Internet connection required</Text>
      <Text style={[styles.sub, { color: theme.textDim }]}>{subtitle ?? 'Connect to the internet to continue.'}</Text>
      <View style={styles.btnRow}>
        {retry && onRetry ? <GradientButton title={retry} onPress={onRetry} /> : null}
        {secondary && onSecondary ? <GradientButton title={secondary} onPress={onSecondary} variant="ghost" /> : null}
      </View>
    </View>
  );
}

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  const { theme } = useApp();
  return (
    <View style={{ gap: 10, paddingVertical: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 14,
            borderRadius: 7,
            backgroundColor: withAlpha(theme.surface2, 0.9),
            width: `${92 - i * 12}%`,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 10 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  loadingCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 20, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2 },
  sub: { fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 300 },
  btn: { marginTop: SPACING.md, minWidth: 180 },
  btnRow: { marginTop: SPACING.md, gap: 10, minWidth: 220 },
});
