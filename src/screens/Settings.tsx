/**
 * KISSA v4.2 — Settings / Profile
 * Clean, editorial, no monetization, no memory UI.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/bits';
import { RADIUS, SHADOWS, SPACING, TYPE, withAlpha, KISSA } from '../theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Settings'>;

export function Settings({ navigation }: Props) {
  const { theme, profile, activeProvider } = useApp();
  const { handleScroll } = useNavScroll();
  const nav = navigation as unknown as { navigate: (s: string, o?: object) => void };

  function row(icon: string, title: string, sub: string, target: string, badge?: string, params?: object) {
    return (
      <Pressable
        key={target + title}
        onPress={() => nav.navigate(target, params ?? {})}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: withAlpha(theme.surface, pressed ? 0.94 : 0.88),
            borderColor: theme.border,
            opacity: pressed ? 0.96 : 1,
            transform: [{ scale: pressed ? 0.988 : 1 }],
          },
          SHADOWS.card,
        ]}
      >
        <View style={[styles.mark, { backgroundColor: theme.surface2, borderColor: theme.borderSoft }]}>
          <Text style={[styles.markText, { color: theme.textDim }]}>{icon}</Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.rowSub, { color: theme.textDim }]} numberOfLines={1}>
            {sub}
          </Text>
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: theme.text }]}>
            <Text style={[styles.badgeText, { color: theme.bg }]}>{badge}</Text>
          </View>
        ) : null}
        <Text style={[styles.chev, { color: theme.textFaint }]}>›</Text>
      </Pressable>
    );
  }

  return (
    <Screen>
      <ScrollView onScroll={handleScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.textFaint }]}>ACCOUNT</Text>
          <Text style={[styles.hello, { color: theme.text }]} numberOfLines={1}>
            {profile?.nickname ?? 'Explorer'}
          </Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>Local-first identity, AI engine, creator tools.</Text>
        </View>

        <SectionHeader title="Profile" kicker="Identity" />
        {row('Aa', 'Nickname & Age', `${profile?.nickname} · ${profile?.ageGroup}`, 'SettingsProfile')}

        <SectionHeader title="AI Engine" kicker="Voice" />
        {row(
          'Ai',
          'AI Setup',
          activeProvider ? `${activeProvider.name} · ${activeProvider.model}` : 'Configure your AI provider',
          'AIAddons',
          !activeProvider ? 'Needed' : undefined,
        )}

        <SectionHeader title="Creator Studio" kicker="Create" />
        {row('+', 'Suggest an Idea', 'Share a story concept', 'SubmitStory', undefined, { mode: 'idea' })}
        {row('✎', 'Submit a Story', 'Submit your complete story', 'SubmitStory', undefined, { mode: 'story' })}
        {row('☰', 'My Submissions', 'View your submissions', 'MySubmissions')}
        {__DEV__ ? row('◆', 'Admin Panel', 'Dev only', 'AdminPanel') : null}

        <SectionHeader title="Appearance" kicker="Display" />
        {row('◐', 'Theme & Typography', 'Dark, AMOLED, text size', 'SettingsAppearance')}

        <SectionHeader title="Audio & Feel" kicker="Immersion" />
        {row('♪', 'Sound & Haptics', 'Effects, music, vibrations', 'SettingsAudio')}

        <SectionHeader title="Notifications" kicker="Alerts" />
        {row('◑', 'Reminders & Updates', 'Daily reminders, content drops', 'SettingsNotifications')}

        <SectionHeader title="Data" kicker="Local" />
        {row('▢', 'Storage & Backup', 'Export, import, clear', 'SettingsStorage')}

        <SectionHeader title="About" kicker="Kissa" />
        {row('¶', 'Terms', 'App rules', 'Terms')}
        {row('○', 'Privacy', 'Local-only data', 'Privacy')}
        {row('♡', 'About Kissa', `Version 4.2 · ${KISSA.tagline}`, 'About')}

        <View style={{ height: SPACING.xxxl + 36 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16 },
  header: { paddingTop: 6, paddingBottom: 4 },
  kicker: { ...TYPE.tiny, letterSpacing: 1.2, fontWeight: '700' as const, marginTop: 4 },
  hello: { ...TYPE.display, marginTop: 4, letterSpacing: -0.4 },
  sub: { fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 13,
    gap: 12,
    marginBottom: 10,
  },
  mark: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 12, fontWeight: '700' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600', letterSpacing: -0.1 },
  rowSub: { fontSize: 11.5, marginTop: 1 },
  chev: { fontSize: 18, fontWeight: '300', marginLeft: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
});
