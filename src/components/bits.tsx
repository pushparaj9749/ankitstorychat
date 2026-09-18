/** Cinematic bits: badges, chips, headers, progress, avatar — premium & consistent. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../state/AppContext';
import { FONTS, RADIUS, SPACING, TYPE, avatarColors, genreColor, withAlpha } from '../theme';
import { ratingLabel } from '../lib/ageGate';

export function AgeBadge({ ageRating }: { ageRating: string }) {
  const mature = ageRating === '18+';
  return (
    <View
      style={[
        styles.ageBadge,
        {
          backgroundColor: mature ? 'rgba(248,113,113,0.16)' : 'rgba(52,211,153,0.14)',
          borderColor: mature ? 'rgba(248,113,113,0.28)' : 'rgba(52,211,153,0.28)',
        },
      ]}
    >
      <View
        style={[
          styles.ageDot,
          { backgroundColor: mature ? '#F87171' : '#34D399' },
        ]}
      />
      <Text style={[styles.ageText, { color: mature ? '#FEB4B4' : '#6EE7B7' }]}>
        {ratingLabel({ ageRating: ageRating as '12-17' | '18+' })}
      </Text>
    </View>
  );
}

export function GenreChip({ genre }: { genre: string }) {
  const c = genreColor(genre);
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(c, 0.14), borderColor: withAlpha(c, 0.24) }]}>
      <View style={[styles.chipDot, { backgroundColor: c }]} />
      <Text style={[styles.chipText, { color: c }]}>{genre}</Text>
    </View>
  );
}

export function SelectableChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useApp();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.selectChip,
        {
          backgroundColor: selected ? theme.accent : withAlpha(theme.surface, 0.9),
          borderColor: selected ? theme.accent : theme.border,
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Text
        style={[
          styles.selectChipText,
          { color: selected ? '#1A100C' : theme.textDim },
          selected && { fontWeight: '800' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  kicker,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  kicker?: string;
}) {
  const { theme } = useApp();
  return (
    <View style={styles.section}>
      <View style={styles.sectionLeft}>
        {kicker ? <Text style={[styles.kicker, { color: theme.accent }]}>{kicker}</Text> : null}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      </View>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [
            styles.sectionActionWrap,
            {
              backgroundColor: withAlpha(theme.accent, 0.12),
              borderColor: withAlpha(theme.accent, 0.18),
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <Text style={[styles.sectionAction, { color: theme.accent }]}>{action}</Text>
          <Text style={[styles.sectionArrow, { color: theme.accent }]}>›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const { theme } = useApp();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const fill = color ?? theme.accent;
  return (
    <View style={[styles.progressTrack, { backgroundColor: withAlpha(theme.text, 0.08) }]}>
      <View style={[styles.progressFillWrap, { width: `${pct}%` }]}>
        <LinearGradient
          colors={[fill, withAlpha(fill, 0.82)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.progressFill}
        />
        <View style={[styles.progressGlow, { backgroundColor: fill }]} />
      </View>
    </View>
  );
}

export function Avatar({ id, name, size = 44 }: { id: string; name: string; size?: number }) {
  const [a, b] = avatarColors(id);
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View
      style={[
        styles.avatarWrap,
        {
          width: size + 4,
          height: size + 4,
          borderRadius: (size + 4) / 2,
        },
      ]}
    >
      <LinearGradient
        colors={[a, b]}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{initial}</Text>
      </LinearGradient>
    </View>
  );
}

export function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  ageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  ageDot: { width: 6, height: 6, borderRadius: 3 },
  ageText: { fontSize: FONTS.tiny, fontWeight: '800', letterSpacing: 0.4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.9 },
  chipText: { fontSize: FONTS.tiny, fontWeight: '700', letterSpacing: 0.2 },
  selectChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    marginRight: 8,
  },
  selectChipText: { fontSize: FONTS.small, fontWeight: '600', letterSpacing: 0.1 },
  section: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
    gap: 12,
  },
  sectionLeft: { flex: 1, gap: 2 },
  kicker: { ...TYPE.overline, opacity: 0.9 },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, lineHeight: 22 },
  sectionActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  sectionAction: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  sectionArrow: { fontSize: 14, fontWeight: '700', marginTop: -1 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  progressFillWrap: { height: 4, borderRadius: 2, overflow: 'visible' },
  progressFill: { flex: 1, borderRadius: 2 },
  progressGlow: {
    position: 'absolute',
    right: -6,
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.45,
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,237,228,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244,237,228,0.10)',
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
