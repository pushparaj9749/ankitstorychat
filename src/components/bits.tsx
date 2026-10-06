/**
 * KISSA v2.5.2 — Core UI Bits
 * Original, cinematic, minimal, editorial.
 *
 * Design pass notes:
 *  - one canonical type scale (SCALE / TYPE) — no more 8.5px labels
 *  - every colour comes from the theme (no stray hex literals in screens)
 *  - touch targets follow TOUCH tokens
 * Components: AgeBadge, GenreChip, CategoryChip, SectionHeader, ProgressBar,
 * Avatar, Dot, KissaHeader
 */
import React from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { KISSA_LOGO } from './brand';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import {
  RADIUS,
  SCALE,
  SPACING,
  TOUCH,
  TYPE,
  avatarColors,
  genreColor,
  withAlpha,
  LAYOUT,
  KISSA,
} from '../theme';
import { ratingLabel } from '../lib/ageGate';
import { Icon, type IconName } from './icons';

export function AgeBadge({ ageRating }: { ageRating: string }) {
  const { theme } = useApp();
  const mature = ageRating === '18+';
  const tint = mature ? theme.danger : theme.success;
  return (
    <View
      style={[
        styles.ageBadge,
        { backgroundColor: withAlpha(tint, 0.12), borderColor: withAlpha(tint, 0.26) },
      ]}
    >
      <View style={[styles.ageDot, { backgroundColor: tint }]} />
      <Text style={[styles.ageText, { color: mature ? '#FFC0C0' : '#9BEFD0' }]}>
        {ratingLabel({ ageRating: ageRating as '12-17' | '18+' })}
      </Text>
    </View>
  );
}

export function GenreChip({ genre }: { genre: string }) {
  const c = genreColor(genre);
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(c, 0.11), borderColor: withAlpha(c, 0.24) }]}>
      <View style={[styles.chipDot, { backgroundColor: c }]} />
      <Text style={[styles.chipText, { color: c }]}>{genre}</Text>
    </View>
  );
}

/* Selectable category chip — selected state is rose, not a white block, so the
   accent stays reserved for "where you are" and the artwork keeps the stage. */
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
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.selectChip,
        {
          backgroundColor: selected ? withAlpha(theme.primary, 0.16) : withAlpha(theme.surface2, 0.7),
          borderColor: selected ? withAlpha(theme.primary, 0.46) : theme.border,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      {selected ? <View style={[styles.selectDot, { backgroundColor: theme.accent }]} /> : null}
      <Text
        style={[
          styles.selectChipText,
          { color: selected ? theme.text : theme.textDim },
          selected ? styles.selectChipTextActive : null,
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
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          {kicker ? (
            <View style={[styles.kickerPill, { backgroundColor: withAlpha(theme.text, 0.06) }]}>
              <Text style={[styles.kicker, { color: theme.textFaint }]}>{kicker.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={10}
          accessibilityRole="button"
          style={({ pressed }) => [styles.sectionActionWrap, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.sectionAction, { color: theme.accent }]}>{action}</Text>
          <Icon name="chevron-forward" size={12} color={theme.accent} />
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
    <View style={[styles.progressTrack, { backgroundColor: withAlpha(theme.text, 0.08) }]}>
      <View style={[styles.progressFillWrap, { width: `${pct}%` }]}>
        <LinearGradient
          colors={[withAlpha(fill, 0.95), fill]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.progressFill}
        />
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

/* KissaHeader — v2.4.2: editorial wordmark, minimal, auto-hide aware */
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
            <Image source={KISSA_LOGO} style={styles.brandLogo} resizeMode="contain" accessibilityLabel="Kissa" />
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

/** Round glass icon button — the app's standard piece of icon chrome. */
export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  size = TOUCH.sm,
  tint,
  iconColor,
  badge,
}: {
  name: IconName;
  onPress?: () => void;
  accessibilityLabel?: string;
  size?: number;
  tint?: string;
  iconColor?: string;
  badge?: boolean;
}) {
  const { theme } = useApp();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size >= TOUCH.min ? 16 : 12,
          backgroundColor: tint ?? withAlpha(theme.surface2, 0.72),
          borderColor: theme.border,
          opacity: pressed ? 0.72 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
      ]}
    >
      <Icon name={name} size={size >= TOUCH.min ? 20 : 17} color={iconColor ?? theme.textDim} />
      {badge ? <View style={[styles.iconBadge, { backgroundColor: theme.primary, borderColor: theme.bg }]} /> : null}
    </Pressable>
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
  ageText: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 0.5 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipDot: { width: 5, height: 5, borderRadius: 2.5, opacity: 0.9 },
  chipText: { fontSize: SCALE.micro, fontWeight: '700', letterSpacing: 0.25 },
  selectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    marginRight: 8,
    minHeight: TOUCH.sm,
  },
  selectDot: { width: 5, height: 5, borderRadius: 2.5 },
  selectChipText: { fontSize: SCALE.small, fontWeight: '600', letterSpacing: 0.1 },
  selectChipTextActive: { fontWeight: '800' },
  section: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: SPACING.xxl,
    marginBottom: SPACING.md,
    gap: 12,
  },
  sectionLeft: { flex: 1, minWidth: 0 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kickerPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.xs },
  kicker: { fontSize: SCALE.micro, letterSpacing: 1.1, fontWeight: '800' },
  sectionTitle: { ...TYPE.cardTitle },
  sectionActionWrap: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  sectionAction: { fontSize: SCALE.small, fontWeight: '800', letterSpacing: 0.1 },
  progressTrack: { height: 5, borderRadius: RADIUS.pill, overflow: 'hidden', marginTop: 8 },
  progressFillWrap: { height: 5, borderRadius: RADIUS.pill, overflow: 'hidden' },
  progressFill: { flex: 1, borderRadius: RADIUS.pill },
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
  brandLogo: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  brandWordmark: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  brandTagline: {
    fontSize: SCALE.micro,
    fontWeight: '700',
    letterSpacing: 1.1,
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
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});
