/**
 * KISSA v2.5.2 — Settings / You
 *
 * Layout pass: the flat list of twelve separate cards is now a profile header
 * plus grouped cards (rows inside one surface, hairline-separated). That keeps
 * the whole screen scannable in one glance instead of six section headers.
 *
 * Everything here is local-only: no account, no monetization, no memory UI.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types';
import { useApp } from '../state/AppContext';
import { useNavScroll } from '../navigation/NavScrollContext';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/bits';
import { Icon, ICON_SIZE, type IconName } from '../components/icons';
import { LAYOUT, RADIUS, SCALE, SHADOWS, SPACING, TOUCH, TYPE, withAlpha, KISSA } from '../theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Settings'>;
type Target = { screen: string; params?: object };

export function Settings({ navigation }: Props) {
  const { theme, profile, activeProvider } = useApp();
  const { handleScroll } = useNavScroll();
  const nav = navigation as unknown as { navigate: (s: string, o?: object) => void };
  const version = Constants.expoConfig?.version ?? '2.5.2';

  /* One row inside a grouped card. */
  function row(icon: IconName, title: string, sub: string, target: string, opts?: { badge?: string; params?: object; first?: boolean }) {
    return (
      <Pressable
        key={target + title}
        onPress={() => nav.navigate(target, opts?.params ?? {})}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${sub}`}
        style={({ pressed }) => [
          styles.row,
          !opts?.first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.borderSoft },
          pressed && { backgroundColor: withAlpha(theme.text, 0.04) },
        ]}
      >
        <View style={[styles.mark, { backgroundColor: withAlpha(theme.primary, 0.10), borderColor: withAlpha(theme.primary, 0.18) }]}>
          <Icon name={icon} size={17} color={theme.accent} />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.rowSub, { color: theme.textDim }]} numberOfLines={1}>
            {sub}
          </Text>
        </View>
        {opts?.badge ? (
          <View style={[styles.badge, { backgroundColor: withAlpha(theme.primary, 0.16), borderColor: withAlpha(theme.primary, 0.34) }]}>
            <Text style={[styles.badgeText, { color: theme.accent }]}>{opts.badge}</Text>
          </View>
        ) : null}
        <Icon name="chevron-forward" size={ICON_SIZE.sm} color={theme.textFaint} />
      </Pressable>
    );
  }

  function group(children: React.ReactNode) {
    return (
      <View style={[styles.group, { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border }, SHADOWS.soft]}>
        {children}
      </View>
    );
  }

  const aiReady = !!activeProvider;

  return (
    <Screen padded={false}>
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, styles.page]}
      >
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: theme.accent }]}>ACCOUNT</Text>
          <Text style={[styles.hello, { color: theme.text }]} numberOfLines={1}>
            You
          </Text>
        </View>

        {/* Profile header — the person, not a settings list */}
        <Pressable
          onPress={() => nav.navigate('SettingsProfile')}
          accessibilityRole="button"
          accessibilityLabel={`Edit profile. ${profile?.nickname ?? 'Explorer'}, ${profile?.ageGroup ?? ''}`}
          style={({ pressed }) => [
            styles.profileCard,
            { borderColor: theme.border, opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
            SHADOWS.card,
          ]}
        >
          <LinearGradient
            colors={['#FF8A9B', '#E9435E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileAvatar}
          >
            <Text style={styles.profileInitial}>{(profile?.nickname?.trim()?.[0] ?? 'K').toUpperCase()}</Text>
          </LinearGradient>
          <View style={styles.profileBody}>
            <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>
              {profile?.nickname ?? 'Explorer'}
            </Text>
            <View style={styles.profileMeta}>
              <View style={[styles.metaPill, { backgroundColor: withAlpha(theme.text, 0.07), borderColor: theme.border }]}>
                <Text style={[styles.metaPillText, { color: theme.textDim }]}>{profile?.ageGroup ?? '12-17'}</Text>
              </View>
              <Text style={[styles.profileHint, { color: theme.textFaint }]}>Stored on this device only</Text>
            </View>
          </View>
          <View style={[styles.profileEdit, { borderColor: theme.border, backgroundColor: withAlpha(theme.surface2, 0.9) }]}>
            <Icon name="create-outline" size={ICON_SIZE.sm} color={theme.textDim} />
          </View>
        </Pressable>

        {/* AI engine — the one thing that gates playing */}
        <Pressable
          onPress={() => nav.navigate('AIAddons')}
          accessibilityRole="button"
          accessibilityLabel={aiReady ? `AI ready. ${activeProvider?.name}` : 'Set up AI'}
          style={({ pressed }) => [
            styles.aiCard,
            {
              borderColor: withAlpha(aiReady ? theme.success : theme.primary, 0.32),
              backgroundColor: withAlpha(aiReady ? theme.success : theme.primary, 0.10),
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            },
          ]}
        >
          <View style={styles.aiTop}>
            <View style={styles.aiStatusRow}>
              <View style={[styles.aiDot, { backgroundColor: aiReady ? theme.success : theme.primary }]} />
              <Text style={[styles.aiKicker, { color: aiReady ? '#9BEFD0' : theme.accent }]}>
                {aiReady ? 'AI READY' : 'AI SETUP NEEDED'}
              </Text>
            </View>
            <Icon name="chevron-forward" size={ICON_SIZE.sm} color={theme.textFaint} />
          </View>
          <Text style={[styles.aiTitle, { color: theme.text }]} numberOfLines={1}>
            {aiReady ? `${activeProvider?.name} · ${activeProvider?.model}` : 'Connect your own AI provider'}
          </Text>
          <Text style={[styles.aiSub, { color: theme.textDim }]}>
            {aiReady
              ? 'Offline Story Mode always works without a key.'
              : 'Bring your own key — OpenAI, OpenRouter, Groq, Together or a custom endpoint.'}
          </Text>
        </Pressable>

        <SectionHeader title="Creator Studio" kicker="Create" />
        {group(
          <>
            {row('bulb-outline', 'Suggest an Idea', 'Share a story concept', 'SubmitStory', { params: { mode: 'idea' }, first: true })}
            {row('create-outline', 'Submit a Story', 'Submit your complete story', 'SubmitStory', { params: { mode: 'story' } })}
            {row('list-outline', 'My Submissions', 'Review status and history', 'MySubmissions')}
            {__DEV__ ? row('shield-outline', 'Admin Panel', 'Dev build only', 'AdminPanel') : null}
          </>,
        )}

        <SectionHeader title="App & Feel" kicker="Display" />
        {group(
          <>
            {row('color-palette-outline', 'Theme & Typography', 'Dark, AMOLED, text size', 'SettingsAppearance', { first: true })}
            {row('musical-notes-outline', 'Sound & Haptics', 'Effects, ambience, vibrations', 'SettingsAudio')}
            {row('notifications-outline', 'Reminders & Updates', 'Daily reminders, content drops', 'SettingsNotifications')}
          </>,
        )}

        <SectionHeader title="Data" kicker="Local" />
        {group(row('server-outline', 'Storage & Backup', 'Export, import, clear cache', 'SettingsStorage', { first: true }))}

        <SectionHeader title="About" kicker="Kissa" />
        {group(
          <>
            {row('information-circle-outline', 'About Kissa', `Version ${version} · ${KISSA.tagline}`, 'About', { first: true })}
            {row('document-text-outline', 'Terms', 'App rules', 'Terms')}
            {row('lock-closed-outline', 'Privacy', 'Local-only data', 'Privacy')}
          </>,
        )}

        <Text style={[styles.footer, { color: theme.textFaint }]}>
          {KISSA.wordmark} v{version} · {KISSA.tagline} · no account, no coins, no message limits
        </Text>

        <View style={{ height: SPACING.xxxl + 40 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16 },
  page: { width: '100%', maxWidth: LAYOUT.contentMaxWidth + 120, alignSelf: 'center' },
  header: { paddingTop: 6, paddingBottom: 14 },
  kicker: { fontSize: SCALE.micro, letterSpacing: 1.4, fontWeight: '900', marginTop: 4 },
  hello: { ...TYPE.display, marginTop: 4, letterSpacing: -0.5 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: 14,
    backgroundColor: 'rgba(20,20,29,0.86)',
  },
  profileAvatar: { width: 54, height: 54, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  profileInitial: { fontSize: 22, fontWeight: '900', color: '#2A0A11' },
  profileBody: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 19, fontWeight: '800', letterSpacing: -0.35 },
  profileMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  metaPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  metaPillText: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 0.4 },
  profileHint: { fontSize: SCALE.caption, fontWeight: '500' },
  profileEdit: {
    width: TOUCH.sm,
    height: TOUCH.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  aiCard: { borderWidth: 1, borderRadius: RADIUS.xl, padding: 15, marginTop: 12 },
  aiTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  aiDot: { width: 6, height: 6, borderRadius: 3 },
  aiKicker: { fontSize: SCALE.micro, fontWeight: '900', letterSpacing: 1.2 },
  aiTitle: { fontSize: 16.5, fontWeight: '800', letterSpacing: -0.25, marginTop: 9 },
  aiSub: { fontSize: SCALE.small, lineHeight: 18, marginTop: 5 },

  group: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 12,
    gap: 12,
    minHeight: TOUCH.min + 8,
  },
  mark: { width: 34, height: 34, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.15 },
  rowSub: { fontSize: SCALE.caption, fontWeight: '500' },
  badge: { borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1 },
  badgeText: { fontSize: SCALE.micro, fontWeight: '900', letterSpacing: 0.5 },
  footer: { fontSize: SCALE.micro, textAlign: 'center', marginTop: SPACING.xxl, lineHeight: 16 },
});
