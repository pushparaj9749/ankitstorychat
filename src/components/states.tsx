/** Empty / error / loading states used across screens. */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { FONTS, SPACING } from '../theme';
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
      <Text style={styles.emoji}>{emoji}</Text>
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
      <Text style={styles.emoji}>⚠️</Text>
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

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { theme } = useApp();
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.sub, { color: theme.textDim, marginTop: SPACING.md }]}>{label}</Text>
    </View>
  );
}

/** In-story download / open — same visual language, no technical copy. */
export function PreparingState({ label = 'Preparing your story…' }: { label?: string }) {
  return <LoadingState label={label} />;
}

/**
 * Friendly retry when a remote story package could not be prepared.
 * Cached stories never reach this — they open from disk.
 */
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
      <View style={[styles.offlineIcon, { backgroundColor: theme.primarySoft }]}>
        <Text style={styles.offlineIconText}>📡</Text>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Couldn't prepare this story</Text>
      <Text style={[styles.sub, { color: theme.textDim }]}>
        {subtitle ?? 'Try again. Stories you already opened still work without internet.'}
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
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 8 },
  emoji: { fontSize: 52 },
  offlineIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  offlineIconText: { fontSize: 34 },
  title: { fontSize: FONTS.heading, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: FONTS.small, textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: SPACING.md, minWidth: 200 },
  btnRow: { marginTop: SPACING.md, gap: 10, minWidth: 240 },
});
