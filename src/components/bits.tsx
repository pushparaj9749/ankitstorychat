/**
 * KISSA v4.2 — Core UI Bits
 * Original, cinematic, minimal, editorial.
 * Components: AgeBadge, GenreChip, CategoryChip, SectionHeader, ProgressBar, Avatar, KissaHeader
 */
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { FONTS, GRADIENTS, RADIUS, SPACING, TYPE, avatarColors, genreColor, withAlpha, LAYOUT, KISSA } from '../theme';
import { ratingLabel } from '../lib/ageGate';

export function AgeBadge({ ageRating }: { ageRating: string }) {
  const mature = ageRating === '18+';
  return (
    <View
      style={[
        styles.ageBadge,
        {
          backgroundColor: mature ? 'rgba(248,113,113,0.12)' : 'rgba(94,233,181,0.10)',
          borderColor: mature ? 'rgba(248,113,113,0.22)' : 'rgba(94,233,181,0.20)',
        },
      ]}
    >
      <View style={[styles.ageDot, { backgroundColor: mature ? '#FF7A7A' : '#5EE9B5' }]} />
      <Text style={[styles.ageText, { color: mature ? '#FFB4B4' : '#8CECC7' }]}>
        {ratingLabel({ ageRating: ageRating as '12-17' | '18+' })}
      </Text>
    </View>
  );
}

export function GenreChip({ genre }: { genre: string }) {
  const c = genreColor(genre);
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(c, 0.11), borderColor: withAlpha(c, 0.22) }]}>
      <View style={[styles.chipDot, { backgroundColor: c }]} />
      <Text style={[styles.chipText, { color: c }]}>{genre}</Text>
    </View>
  );
}

/* Selectable category chip — v4.2: subtle, editorial, not neon */
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
          backgroundColor: selected ? theme.text : withAlpha(theme.surface2, 0.9),
          borderColor: selected ? theme.text : theme.border,
          opacity: pressed ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Text
        style={[
          styles.selectChipText,
          { color: selected ? theme.bg : theme.textDim },
          selected && { fontWeight: '800' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* CategoryChip alias for new design system */
export const CategoryChip = SelectableChip;

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
        {kicker ? <Text style={[styles.kicker, { color: theme.textFaint }]}>{kicker.toUpperCase()}</Text> : null}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      </View>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [
            styles.sectionActionWrap,
            {
              backgroundColor: withAlpha(theme.surface2, 0.9),
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.sectionAction, { color: theme.textDim }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const { theme } = useApp();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const fill = color ?? theme.primary;
  return (
    <View style={[styles.progressTrack, { backgroundColor: withAlpha(theme.text, 0.07) }]}>
      <View style={[styles.progressFillWrap, { width: `${pct}%` }]}>
        <View style={[styles.progressFill, { backgroundColor: fill }]} />
      </View>
    </View>
  );
}

export function Avatar({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  const [a, b] = avatarColors(id);
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View
      style={[
        styles.avatarWrap,
        {
          width: size + 2,
          height: size + 2,
          borderRadius: (size + 2) / 2,
        },
      ]}
    >
      <LinearGradient colors={[a, b]} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initial}</Text>
      </LinearGradient>
    </View>
  );
}

export function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

/* KissaHeader — v4.2: editorial wordmark, minimal, auto-hide aware */
export function KissaHeader({
  title,
  subtitle,
  rightAction,
  showLogo = false,
}: {
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  showLogo?: boolean;
}) {
  const { theme } = useApp();
  const { headerTranslateY, headerOpacity } = useNavScroll();

  return (
    <Animated.View
      style={[
        styles.headerContainer,
        {
          transform: [{ translateY: headerTranslateY }],
          opacity: headerOpacity,
          backgroundColor: withAlpha(theme.bg, 0.92),
          borderBottomColor: theme.borderSoft,
        },
      ]}
    >
      <View style={styles.headerContent}>
        {showLogo ? (
          <View style={styles.brandRow}>
            <View style={[styles.brandMark, { backgroundColor: theme.text }]}>
              <Text style={[styles.brandMarkText, { color: theme.bg }]}>K</Text>
            </View>
            <View>
              <Text style={[styles.brandWordmark, { color: theme.text }]}>{KISSA.wordmark}</Text>
              <Text style={[styles.brandTagline, { color: theme.textFaint }]}>{KISSA.tagline}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.headerTitleWrap}>
            {subtitle ? <Text style={[styles.headerSubtitle, { color: theme.textFaint }]}>{subtitle.toUpperCase()}</Text> : null}
            {title ? <Text style={[styles.headerMainTitle, { color: theme.text }]}>{title}</Text> : null}
          </View>
        )}
        {rightAction ? <View style={styles.headerRight}>{rightAction}</View> : null}
      </View>
    </Animated.View>
  );
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
  ageDot: { width: 5, height: 5, borderRadius: 2.5 },
  ageText: { fontSize: FONTS.tiny, fontWeight: '700', letterSpacing: 0.4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipDot: { width: 5, height: 5, borderRadius: 2.5, opacity: 0.9 },
  chipText: { fontSize: FONTS.tiny, fontWeight: '600', letterSpacing: 0.2 },
  selectChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    marginRight: 8,
  },
  selectChipText: { fontSize: 13, fontWeight: '600', letterSpacing: 0.15 },
  section: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
    gap: 12,
  },
  sectionLeft: { flex: 1, gap: 3 },
  kicker: { ...TYPE.tiny, letterSpacing: 1.2, fontWeight: '700' as const },
  sectionTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3, lineHeight: 24 },
  sectionActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  sectionAction: { fontSize: 12, fontWeight: '600', letterSpacing: 0.15 },
  progressTrack: { height: 3, borderRadius: 1.5, overflow: 'hidden', marginTop: 8 },
  progressFillWrap: { height: 3, borderRadius: 1.5, overflow: 'visible' },
  progressFill: { flex: 1, borderRadius: 1.5 },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    height: LAYOUT.headerHeight,
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  brandWordmark: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  brandTagline: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerSubtitle: {
    ...TYPE.tiny,
    marginBottom: 2,
    letterSpacing: 1.2,
  },
  headerMainTitle: {
    ...TYPE.title,
    lineHeight: 26,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
