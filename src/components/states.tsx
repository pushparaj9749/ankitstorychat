/**
 * KISSA — Empty, Error, Loading, No-internet States
 * Minimal, editorial, calm. No excessive emoji, no neon.
 *
 * v2.10 (Noir template): each state leads with a small hand-drawn SVG scene
 * (see ./illustrations) instead of a lone icon in a box. The Classic template
 * keeps the icon tile.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { RADIUS, SPACING, TYPE, withAlpha } from '../theme';
import { GradientButton } from './GradientButton';
import { Icon, ICON_SIZE, type IconName } from './icons';
import { Illustration, illustrationForIcon, type IllustrationName } from './illustrations';

/** Noir: the SVG scene. Classic: the original icon tile. */
function StateArt({ art, icon, danger }: { art: IllustrationName; icon: IconName; danger?: boolean }) {
  const { theme, uiTemplate } = useApp();
  if (uiTemplate === 'classic') {
    const tint = danger ? theme.danger : null;
    return (
      <View
        style={[
          styles.iconCircle,
          tint
            ? { backgroundColor: withAlpha(tint, 0.08), borderColor: withAlpha(tint, 0.18) }
            : { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Icon name={icon} size={ICON_SIZE.lg} color={tint ?? theme.textDim} />
      </View>
    );
  }
  return (
    <View style={styles.art} testID={`state-art-${art}`}>
      <Illustration
        name={art}
        width={176}
        colors={{ accent: theme.primary, gold: theme.gold, surface: theme.surface, surface2: theme.surface3, line: withAlpha(theme.text, 0.16) }}
      />
    </View>
  );
}

export function EmptyState({
  icon,
  art,
  title,
  subtitle,
  action,
  onAction,
}: {
  icon: IconName;
  /** Noir illustration; defaults to one matching the icon. */
  art?: IllustrationName;
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  const { theme } = useApp();
  return (
    <View style={styles.wrap}>
      <StateArt art={art ?? illustrationForIcon(icon)} icon={icon} />
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
      <StateArt art="error" icon="alert-circle-outline" danger />
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
      <StateArt art="offline" icon="cloud-offline-outline" />
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
  art: { marginBottom: 2 },
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
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2 },
  sub: { fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 300 },
  btn: { marginTop: SPACING.md, minWidth: 180 },
  btnRow: { marginTop: SPACING.md, gap: 10, minWidth: 220 },
});
