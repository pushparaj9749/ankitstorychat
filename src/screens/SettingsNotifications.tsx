/**
 * Notifications Settings: Local reminders & content alerts.
 * Kissa v2.4.2.
 */
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { SectionHeader, SelectableChip } from '../components/bits';
import {
  cancelDailyReminder,
  permissionStatus,
  requestPermission,
  scheduleDailyReminder,
} from '../lib/notifications';
import { FONTS, RADIUS, SHADOWS, SPACING, TYPE, withAlpha } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsNotifications'>;

const HOURS = [18, 19, 20, 21, 22];

export function SettingsNotifications(_props: Props) {
  const { theme, settings, profile, updateSettings } = useApp();
  const [perm, setPerm] = useState<string>('…');

  useEffect(() => {
    void permissionStatus().then(setPerm);
  }, []);

  async function setEnabled(v: boolean) {
    if (v) {
      const ok = await requestPermission();
      if (!ok) {
        Alert.alert(
          'Permission Required',
          'Please allow notifications in your phone system settings to receive story reminders.',
        );
        setPerm(await permissionStatus());
        return;
      }
    }
    await updateSettings({ notifications: { ...settings.notifications, enabled: v } });
    if (v && settings.notifications.storyReminders) {
      await scheduleDailyReminder(settings.notifications.reminderHour, profile?.nickname ?? '');
    } else {
      await cancelDailyReminder();
    }
    setPerm(await permissionStatus());
  }

  async function setReminders(v: boolean) {
    await updateSettings({ notifications: { ...settings.notifications, storyReminders: v } });
    if (settings.notifications.enabled && v) {
      await scheduleDailyReminder(settings.notifications.reminderHour, profile?.nickname ?? '');
    } else {
      await cancelDailyReminder();
    }
  }

  async function setHour(h: number) {
    await updateSettings({ notifications: { ...settings.notifications, reminderHour: h } });
    if (settings.notifications.enabled && settings.notifications.storyReminders) {
      await scheduleDailyReminder(h, profile?.nickname ?? '');
    }
  }

  async function sendTest() {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Kissa (test)',
        body: 'Story reminders are active! Your interactive stories await.',
        data: { kind: 'test' },
      },
      trigger: null,
    });
  }

  const n = settings.notifications;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: theme.accent }]}>ALERTS & NUDGES</Text>
        <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
      </View>

      <Text style={[styles.perm, { color: theme.textDim }]}>
        System Status: <Text style={{ color: theme.accent, fontWeight: '800' }}>{perm}</Text>
        {'\n'}100% local reminders — no tracking, no ad notifications.
      </Text>

      <SectionHeader title="Preferences" kicker="Toggle" />
      <ToggleRow
        label="Enable Notifications"
        desc="Master switch for all Kissa reminders"
        value={n.enabled}
        onChange={(v) => void setEnabled(v)}
      />
      <ToggleRow
        label="Daily Story Nudges"
        desc="Gentle evening reminder to continue your journey"
        value={n.storyReminders}
        onChange={(v) => void setReminders(v)}
      />
      <ToggleRow
        label="New Story Drops"
        desc="Alerts when new stories arrive in the catalog"
        value={n.contentUpdates}
        onChange={(v) =>
          void updateSettings({ notifications: { ...n, contentUpdates: v } })
        }
      />

      <SectionHeader title="Reminder Hour" kicker="Schedule" />
      <View style={styles.hours}>
        {HOURS.map((h) => (
          <SelectableChip
            key={h}
            label={`${h}:00`}
            selected={n.reminderHour === h}
            onPress={() => void setHour(h)}
          />
        ))}
      </View>

      <View style={{ height: SPACING.xl }} />
      <GradientButton title="Send Test Reminder" variant="ghost" onPress={() => void sendTest()} />
      <View style={{ height: SPACING.xxl }} />
    </Screen>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { theme } = useApp();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border },
        SHADOWS.card,
      ]}
    >
      <View style={styles.body}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.desc, { color: theme.textDim }]}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.surface2, true: theme.primary }}
        thumbColor={value ? theme.accent : theme.textFaint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 6, paddingBottom: 4 },
  kicker: { ...TYPE.overline, marginTop: 4 },
  title: { ...TYPE.title, marginTop: 2 },
  perm: { fontSize: FONTS.small, marginTop: 6, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 10,
  },
  body: { flex: 1 },
  label: { fontSize: FONTS.body, fontWeight: '700' },
  desc: { fontSize: FONTS.small, marginTop: 2 },
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
