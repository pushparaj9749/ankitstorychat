/**
 * KISSA Settings / You
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
import { GRADIENTS, LAYOUT, RADIUS, SCALE, SHADOWS, SPACING, TOUCH, TYPE, withAlpha, KISSA } from '../theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Settings'>;
type Target = { screen: string; params?: object };

export function Settings({ navigation }: Props) {
  const { theme, settings, profile, activeProvider, favoriteIds, recentPlaythroughs } = useApp();
  const { handleScroll } = useNavScroll();
  const nav = navigation as unknown as { navigate: (s: string, o?: object) => void };
  const version = Constants.expoConfig?.version ?? '2.10.0';

  /* One row inside a grouped card. */
  function row(
    icon: IconName,
    title: string,
    sub: string,
    target: string,
    opts?: { badge?: string; params?: object; first?: boolean; tint?: string },
  ) {
    const tint = opts?.tint ?? theme.accent;
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
        <View style={[styles.mark, { borderColor: withAlpha(tint, 0.3) }]}>
          <LinearGradient
            colors={[withAlpha(tint, 0.3), withAlpha(tint, 0.06)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.markGlint, { backgroundColor: withAlpha('#FFFFFF', 0.22) }]} />
          <Icon name={icon} size={18} color={tint} />
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
          <Text style={[styles.kicker, { color: theme.gold }]}>ACCOUNT</Text>
          <Text style={[styles.hello, { color: theme.text }]} numberOfLines={1}>
            You
          </Text>
        </View>

        {/* Profile hero — the person, not a settings list */}
        <Pressable
          onPress={() => nav.navigate('SettingsProfile')}
          accessibilityRole="button"
          accessibilityLabel={`Edit profile. ${profile?.nickname ?? 'Explorer'}, ${profile?.ageGroup ?? ''}`}
          style={({ pressed }) => [styles.profileCard, SHADOWS.glowRose, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
        >
          <LinearGradient colors={[...GRADIENTS.hero]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.profileTop}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>{(profile?.nickname?.trim()?.[0] ?? 'K').toUpperCase()}</Text>
            </View>
            <View style={styles.profileBody}>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile?.nickname ?? 'Explorer'}
              </Text>
              <View style={styles.profileMeta}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{profile?.ageGroup ?? '12-17'}</Text>
                </View>
                <Icon name="lock-closed-outline" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.profileHint}>Stored on this device only</Text>
              </View>
            </View>
            <View style={styles.profileEdit}>
              <Icon name="create-outline" size={ICON_SIZE.sm} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.profileStats}>
            <View style={styles.profileStat}>
              <Text style={styles.profileStatValue}>{favoriteIds?.size ?? 0}</Text>
              <Text style={styles.profileStatLabel}>SAVED</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}>
              <Text style={styles.profileStatValue}>{recentPlaythroughs?.length ?? 0}</Text>
              <Text style={styles.profileStatLabel}>JOURNEYS</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}>
              <Text style={styles.profileStatValue}>{new Set((recentPlaythroughs ?? []).map((p) => p.storyId)).size}</Text>
              <Text style={styles.profileStatLabel}>STORIES</Text>
            </View>
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
              <Text style={[styles.aiKicker, { color: aiReady ? '#A7F3CF' : theme.accent }]}>
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
              ? 'Your key stays on this device — sent only to your provider.'
              : 'Bring your own key — OpenAI, OpenRouter, Groq, Together or a custom endpoint.'}
          </Text>
        </Pressable>

        <SectionHeader title="Creator Studio" kicker="Create" />
        {group(
          <>
            {row('bulb-outline', 'Suggest an Idea', 'Share a story concept', 'SubmitStory', { params: { mode: 'idea' }, first: true, tint: theme.gold })}
            {row('create-outline', 'Submit a Story', 'Submit your complete story', 'SubmitStory', { params: { mode: 'story' }, tint: theme.accent })}
            {row('list-outline', 'My Submissions', 'Review status and history', 'MySubmissions', { tint: theme.violet })}
            {__DEV__ ? row('shield-outline', 'Admin Panel', 'Dev build only', 'AdminPanel', { tint: theme.info }) : null}
          </>,
        )}

        <SectionHeader title="App & Feel" kicker="Display" />
        {group(
          <>
            {row('color-palette-outline', 'Theme & Typography', 'Dark, AMOLED, text size', 'SettingsAppearance', { first: true, tint: theme.violet })}
            {row('musical-notes-outline', 'Sound & Haptics', 'Effects, ambience, vibrations', 'SettingsAudio', { tint: theme.accent })}
            {row('notifications-outline', 'Reminders & Updates', 'Daily reminders, content drops', 'SettingsNotifications', { tint: theme.gold })}
          </>,
        )}

        <SectionHeader title="Privacy & Data" kicker="Local" />
        {group(
          <>
            {row('lock-closed-outline', 'App Lock', settings.appLockEnabled ? 'PIN / fingerprint lock is on' : 'Fingerprint or PIN to open Kissa', 'SettingsSecurity', {
              first: true,
              tint: theme.success,
              badge: settings.appLockEnabled ? 'ON' : undefined,
            })}
            {row('server-outline', 'Storage & Backup', 'Export, import, clear cache', 'SettingsStorage', { tint: theme.info })}
          </>,
        )}

        <SectionHeader title="About" kicker="Kissa" />
        {group(
          <>
            {row('information-circle-outline', 'About Kissa', `Version ${version} · ${KISSA.tagline}`, 'About', { first: true, tint: theme.violet })}
            {row('document-text-outline', 'Terms', 'App rules', 'Terms', { tint: theme.textDim })}
            {row('lock-closed-outline', 'Privacy', 'Local-only data', 'Privacy', { tint: theme.success })}
          </>,
        )}

        <Text style={[styles.footer, { color: theme.textFaint }]}>
          {KISSA.wordmark} v{version} · {KISSA.tagline} · no account, no coins, no message limits
        </Text>

        <View style={{ height: LAYOUT.navClearance }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16 },
  // Screen is unpadded (so the scroll can run edge to edge); the page gutter
  // lives here — without it every card touched the screen edge.
  page: { width: '100%', maxWidth: LAYOUT.contentMaxWidth + 120, alignSelf: 'center', paddingHorizontal: SPACING.page },
  header: { paddingTop: 6, paddingBottom: 14 },
  kicker: { fontSize: SCALE.micro, letterSpacing: 1.4, fontWeight: '800', marginTop: 4 },
  hello: { ...TYPE.display, marginTop: 4, letterSpacing: -0.5 },

  profileCard: { borderRadius: RADIUS.xxl, overflow: 'hidden', padding: 18 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  profileInitial: { fontSize: 25, fontWeight: '800', color: '#FFFFFF' },
  profileBody: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 23, fontWeight: '800', letterSpacing: -0.5, color: '#FFFFFF' },
  profileMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  metaPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: 'rgba(0,0,0,0.22)' },
  metaPillText: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 0.4, color: '#FFFFFF' },
  profileHint: { fontSize: SCALE.caption, fontWeight: '600', color: 'rgba(255,255,255,0.82)', flexShrink: 1 },
  profileEdit: {
    width: TOUCH.sm,
    height: TOUCH.sm,
    borderRadius: TOUCH.sm / 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(10,11,16,0.26)',
  },
  profileStat: { flex: 1, alignItems: 'center' },
  profileStatValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  profileStatLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  profileStatDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.2)' },

  aiCard: { borderWidth: 1, borderRadius: RADIUS.xl, padding: 15, marginTop: 12 },
  aiTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  aiDot: { width: 6, height: 6, borderRadius: 3 },
  aiKicker: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 1.2 },
  aiTitle: { fontSize: 16.5, fontWeight: '700', letterSpacing: -0.25, marginTop: 9 },
  aiSub: { fontSize: SCALE.small, lineHeight: 18, marginTop: 5 },

  group: { borderWidth: 1, borderRadius: RADIUS.xl, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 12,
    gap: 12,
    minHeight: TOUCH.min + 8,
  },
  mark: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  markGlint: { position: 'absolute', top: 0, left: 8, right: 8, height: 1 },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.15 },
  rowSub: { fontSize: SCALE.caption, fontWeight: '500' },
  badge: { borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1 },
  badgeText: { fontSize: SCALE.micro, fontWeight: '800', letterSpacing: 0.5 },
  footer: { fontSize: SCALE.micro, textAlign: 'center', marginTop: SPACING.xxl, lineHeight: 16 },
});
