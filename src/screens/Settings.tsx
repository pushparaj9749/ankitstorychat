/** Settings hub: profile, AI, appearance, audio, notifications, data, about. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/bits';
import { FONTS, RADIUS, SPACING } from '../theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Settings'>;

export function Settings({ navigation }: Props) {
  const { theme, profile, activeProvider, updateAvailable } = useApp();
  const nav = navigation as unknown as { navigate: (s: string, o?: object) => void };

  function row(emoji: string, title: string, sub: string, target: string, badge?: string) {
    return (
      <Pressable
        key={target + title}
        onPress={() => nav.navigate(target)}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Text style={styles.emoji}>{emoji}</Text>
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
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.hello, { color: theme.text }]}>Hey, {profile?.nickname ?? 'traveller'} 👋</Text>

        <SectionHeader title="Profile" />
        {row('🙋', 'Nickname & Age', `${profile?.nickname} • ${profile?.ageGroup}`, 'SettingsProfile')}

        <SectionHeader title="AI" />
        {row(
          '🤖',
          'AI Add-ons',
          activeProvider ? `${activeProvider.name} • ${activeProvider.model}` : 'Offline Story Mode — tap to add AI',
          'AIAddons',
        )}

        <SectionHeader title="Stories" />
        {row('📚', 'Content Updates', 'Nayi stories GitHub se lao', 'ContentUpdates', updateAvailable ? 'NEW' : undefined)}

        <SectionHeader title="Appearance" />
        {row('🎨', 'Theme & Text', 'Dark, AMOLED, text size, motion', 'SettingsAppearance')}

        <SectionHeader title="Audio" />
        {row('🔊', 'Sound & Haptics', 'Sound, music, vibrations', 'SettingsAudio')}

        <SectionHeader title="Notifications" />
        {row('🔔', 'Reminders', 'Story reminders, update alerts', 'SettingsNotifications')}

        <SectionHeader title="Data" />
        {row('💾', 'Storage & Backup', 'Export, import, clear data', 'SettingsStorage')}

        <SectionHeader title="About" />
        {row('📄', 'Terms & Conditions', 'App ke niyam', 'Terms')}
        {row('🔒', 'Privacy Policy', 'Tumhara data kahan rehta hai', 'Privacy')}
        {row('❤️', 'Help the Developer', 'Coming Soon', 'About')}
        {row('ℹ️', 'About Kissa', 'Version, GitHub, credits', 'About')}
        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 14,
    gap: 12,
    marginBottom: 10,
  },
  emoji: { fontSize: 24 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: FONTS.body, fontWeight: '700' },
  rowSub: { fontSize: FONTS.small, marginTop: 2 },
  chev: { fontSize: 22 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#1A0B2E', fontSize: 10, fontWeight: '900' },
});
