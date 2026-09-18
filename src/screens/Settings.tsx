/**
 * Settings / Profile Screen — Redesigned for Kissa v2.4.1.
 * Clean, structured, cinematic navigation cards.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/bits';
import { RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Settings'>;

export function Settings({ navigation }: Props) {
  const { theme, profile, activeProvider } = useApp();
  const { handleScroll } = useNavScroll();
  const nav = navigation as unknown as { navigate: (s: string, o?: object) => void };

  function row(mark: string, title: string, sub: string, target: string, badge?: string, params?: object) {
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
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
          SHADOWS.card,
        ]}
      >
        <View
          style={[
            styles.mark,
            {
              backgroundColor: withAlpha(theme.primary, 0.14),
              borderColor: withAlpha(theme.primary, 0.24),
            },
          ]}
        >
          <Text style={[styles.markText, { color: theme.accent }]}>{mark}</Text>
        </View>

        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.rowSub, { color: theme.textDim }]} numberOfLines={1}>
            {sub}
          </Text>
        </View>

        {badge ? (
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <Text style={[styles.chev, { color: theme.textFaint }]}>›</Text>
      </Pressable>
    );
  }

  return (
    <Screen>
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.accent }]}>ACCOUNT & PREFERENCES</Text>
          <Text style={[styles.hello, { color: theme.text }]} numberOfLines={1}>
            {profile?.nickname ?? 'Explorer'}
          </Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            Manage your local identity, AI engine, and creator submissions.
          </Text>
        </View>

        <SectionHeader title="Profile" kicker="Identity" />
        {row('Aa', 'Nickname & Age', `${profile?.nickname} • ${profile?.ageGroup}`, 'SettingsProfile')}

        <SectionHeader title="AI Engine" kicker="Voice" />
        {row(
          'AI',
          'AI Setup',
          activeProvider ? `${activeProvider.name} • ${activeProvider.model}` : 'AI Required — tap to add API key',
          'AIAddons',
          !activeProvider ? 'Required' : undefined,
        )}

        <SectionHeader title="Creator Studio" kicker="Submit" />
        {row('+', 'Suggest an Idea', 'Ek kahani ka idea bhejo', 'SubmitStory', undefined, { mode: 'idea' })}
        {row('✎', 'Submit a Story', 'Apni poori kahani submit karo', 'SubmitStory', undefined, { mode: 'story' })}
        {row('☰', 'My Submissions', 'Apne bheje hue submissions dekho', 'MySubmissions')}
        {__DEV__ ? row('◆', 'Admin Panel', 'Dev only — review pending submissions', 'AdminPanel') : null}

        <SectionHeader title="Appearance" kicker="Display" />
        {row('◐', 'Theme & Typography', 'Dark, AMOLED, text size, motion', 'SettingsAppearance')}

        <SectionHeader title="Audio & Feel" kicker="Immersion" />
        {row('♪', 'Sound & Haptics', 'Sound effects, ambient music, vibrations', 'SettingsAudio')}

        <SectionHeader title="Notifications" kicker="Alerts" />
        {row('◑', 'Reminders & Updates', 'Daily reading reminders, content drops', 'SettingsNotifications')}

        <SectionHeader title="Data" kicker="Local-First" />
        {row('▢', 'Storage & Backup', 'Export, import, clear cache', 'SettingsStorage')}

        <SectionHeader title="About" kicker="Kissa" />
        {row('¶', 'Terms & Conditions', 'App ke niyam', 'Terms')}
        {row('○', 'Privacy Policy', 'Tumhara data kahan rehta hai (local-only)', 'Privacy')}
        {row('♡', 'Help the Developer', 'Coming Soon', 'About')}
        {row('i', 'About Kissa', 'Version 2.4.1 • Credits', 'About')}

        <View style={{ height: SPACING.xxxl + 36 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16 },
  header: { paddingTop: 6, paddingBottom: 4 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  hello: { ...TYPE.display, marginTop: 4, letterSpacing: -0.4 },
  sub: { fontSize: 13, marginTop: 6, lineHeight: 19, letterSpacing: 0.1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 14,
    marginBottom: 10,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { fontSize: 13, fontWeight: '800' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  rowSub: { fontSize: 12, marginTop: 1, letterSpacing: 0.1 },
  chev: { fontSize: 22, fontWeight: '300', marginLeft: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { color: '#0E070B', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
});
