/** Settings — clean cinematic list with soft cards and premium hierarchy. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/bits';
import { RADIUS, SPACING, TYPE, withAlpha } from '../theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Settings'>;

export function Settings({ navigation }: Props) {
  const { theme, profile, activeProvider } = useApp();
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
            backgroundColor: withAlpha(theme.surface, pressed ? 0.86 : 0.92),
            borderColor: theme.border,
            opacity: pressed ? 0.96 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View style={[styles.mark, { backgroundColor: withAlpha(theme.accent, 0.14), borderColor: withAlpha(theme.accent, 0.18) }]}>
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.accent }]}>YOU</Text>
          <Text style={[styles.hello, { color: theme.text }]} numberOfLines={1}>
            {profile?.nickname ?? 'traveller'}
          </Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>Manage your stories, voice and data — all local.</Text>
        </View>

        <SectionHeader title="Profile" kicker="Identity" />
        {row('Aa', 'Nickname & Age', `${profile?.nickname} • ${profile?.ageGroup}`, 'SettingsProfile')}

        <SectionHeader title="AI" kicker="Voice" />
        {row(
          'AI',
          'AI Setup',
          activeProvider ? `${activeProvider.name} • ${activeProvider.model}` : 'AI Required — tap to add API key',
          'AIAddons',
        )}

        <SectionHeader title="Stories" kicker="Create" />
        {row('+', 'Suggest an Idea', 'Ek kahani ka idea bhejo', 'SubmitStory', undefined, { mode: 'idea' })}
        {row('✎', 'Submit a Story', 'Apni poori kahani submit karo', 'SubmitStory', undefined, { mode: 'story' })}
        {row('☰', 'My Submissions', 'Apne bheje hue submissions dekho', 'MySubmissions')}
        {__DEV__ ? row('◆', 'Admin Panel', 'Dev only — review pending submissions', 'AdminPanel') : null}

        <SectionHeader title="Appearance" kicker="Look" />
        {row('◐', 'Theme & Text', 'Dark, AMOLED, text size, motion', 'SettingsAppearance')}

        <SectionHeader title="Audio" kicker="Feel" />
        {row('♪', 'Sound & Haptics', 'Sound, music, vibrations', 'SettingsAudio')}

        <SectionHeader title="Notifications" kicker="Reminders" />
        {row('◑', 'Reminders', 'Story reminders, update alerts', 'SettingsNotifications')}

        <SectionHeader title="Data" kicker="Local-first" />
        {row('▢', 'Storage & Backup', 'Export, import, clear data', 'SettingsStorage')}

        <SectionHeader title="About" kicker="Kissa" />
        {row('¶', 'Terms & Conditions', 'App ke niyam', 'Terms')}
        {row('○', 'Privacy Policy', 'Tumhara data kahan rehta hai', 'Privacy')}
        {row('♡', 'Help the Developer', 'Coming Soon', 'About')}
        {row('i', 'About Kissa', 'Version, GitHub, credits', 'About')}
        <View style={{ height: SPACING.xxl + 12 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 8 },
  header: { paddingTop: 8, paddingBottom: 4 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  hello: { ...TYPE.display, marginTop: 4, letterSpacing: -0.4 },
  sub: { fontSize: 13, marginTop: 6, lineHeight: 18, letterSpacing: 0.1 },
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
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { fontSize: 12, fontWeight: '800' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  rowSub: { fontSize: 12, marginTop: 1, letterSpacing: 0.1 },
  chev: { fontSize: 22, fontWeight: '300', marginLeft: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { color: '#1A100C', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
});
