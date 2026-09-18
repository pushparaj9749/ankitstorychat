/**
 * Empty, Error, Loading, and Offline States for Kissa (v2.4.1).
 * Minimal, cinematic, and clear.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { FONTS, RADIUS, SPACING, TYPE, withAlpha } from '../theme';
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
      <View style={[styles.iconCircle, { backgroundColor: withAlpha(theme.surface2, 0.7), borderColor: theme.border }]}>
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
      <View style={[styles.iconCircle, { backgroundColor: withAlpha(theme.danger, 0.12), borderColor: withAlpha(theme.danger, 0.25) }]}>
        <Text style={styles.emoji}>⚠️</Text>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sub, { color: theme.textDim }]}>{subtitle}</Text> : null}
      <View style={styles.btnRow}>
        {retry && onRetry ? <GradientButton title={retry} onPress={onRetry} /> : null}
        {secondary && onSecondary ? (
          <GradientButton title={secondary} onPress={onSecondary} variant="ghost" />
        ) : null}
      </View>
    </View>
  );
}

export function LoadingState({ label = 'Loading story universe…' }: { label?: string }) {
  const { theme } = useApp();
  return (
    <View style={styles.wrap}>
      <View style={[styles.loadingCircle, { borderColor: withAlpha(theme.primary, 0.25) }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
      <Text style={[styles.sub, { color: theme.textDim, marginTop: SPACING.md }]}>{label}</Text>
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
      <View style={[styles.offlineIcon, { backgroundColor: theme.primarySoft, borderColor: withAlpha(theme.primary, 0.3) }]}>
        <Text style={styles.offlineIconText}>📡</Text>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Internet connection required</Text>
      <Text style={[styles.sub, { color: theme.textDim }]}>
        {subtitle ?? 'Connect to the internet to continue this story.'}
      </Text>
      <View style={styles.btnRow}>
        {retry && onRetry ? <GradientButton title={retry} onPress={onRetry} /> : null}
        {secondary && onSecondary ? (
          <GradientButton title={secondary} onPress={onSecondary} variant="ghost" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 10 },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  loadingCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 32 },
  offlineIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  offlineIconText: { fontSize: 34 },
  title: { fontSize: FONTS.heading, fontWeight: '800', textAlign: 'center', letterSpacing: -0.2 },
  sub: { fontSize: FONTS.small, textAlign: 'center', lineHeight: 21, maxWidth: 320 },
  btn: { marginTop: SPACING.md, minWidth: 190 },
  btnRow: { marginTop: SPACING.md, gap: 10, minWidth: 230 },
});
