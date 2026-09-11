/** Small reusable UI bits: badges, chips, section headers, progress, avatar. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../state/AppContext';
import { FONTS, RADIUS, SPACING, avatarColors, genreColor } from '../theme';
import { ratingLabel } from '../lib/ageGate';

export function AgeBadge({ ageRating }: { ageRating: string }) {
  const mature = ageRating === '18+';
  return (
    <View style={[styles.ageBadge, { backgroundColor: mature ? 'rgba(248,113,113,0.18)' : 'rgba(52,211,153,0.16)' }]}>
      <Text style={[styles.ageText, { color: mature ? '#F87171' : '#34D399' }]}>
        {ratingLabel({ ageRating: ageRating as '12-17' | '18+' })}
      </Text>
    </View>
  );
}

export function GenreChip({ genre }: { genre: string }) {
  const c = genreColor(genre);
  return (
    <View style={[styles.chip, { backgroundColor: `${c}22`, borderColor: `${c}55` }]}>
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
      style={[
        styles.selectChip,
        {
          backgroundColor: selected ? theme.primary : 'transparent',
          borderColor: selected ? theme.primary : theme.border,
        },
      ]}
    >
      <Text style={[styles.selectChipText, { color: selected ? '#fff' : theme.textDim }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const { theme } = useApp();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: theme.accent }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const { theme } = useApp();
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: color ?? theme.accent },
        ]}
      />
    </View>
  );
}

export function Avatar({ id, name, size = 44 }: { id: string; name: string; size?: number }) {
  const [a, b] = avatarColors(id);
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <LinearGradient
      colors={[a, b]}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{initial}</Text>
    </LinearGradient>
  );
}

export function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  ageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  ageText: { fontSize: FONTS.tiny, fontWeight: '800' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipText: { fontSize: FONTS.tiny, fontWeight: '700' },
  selectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    marginRight: 8,
  },
  selectChipText: { fontSize: FONTS.small, fontWeight: '600' },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: FONTS.heading, fontWeight: '800' },
  sectionAction: { fontSize: FONTS.small, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
