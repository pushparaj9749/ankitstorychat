/** Notifications: local-only reminders + update alerts. Opt-in. */
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
import { FONTS, RADIUS, SPACING } from '../theme';

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
          'Permission chahiye',
          'Reminders ke liye notification permission do — phone Settings mein allow karo.',
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
        title: 'Kissa 📖 (test)',
        body: 'Reminders kaam kar rahe hain! Ab kahani continue karo. 😉',
        data: { kind: 'test' },
      },
      trigger: null,
    });
  }

  const n = settings.notifications;

  return (
    <Screen>
      <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
      <Text style={[styles.perm, { color: theme.textDim }]}>
        System permission: <Text style={{ color: theme.accent, fontWeight: '700' }}>{perm}</Text>
        {'\n'}100% local — koi server nahi, koi tracking nahi. 🔒
      </Text>

      <SectionHeader title="General" />
      <ToggleRow
        label="Enable notifications"
        desc="Master switch for all Kissa reminders"
        value={n.enabled}
        onChange={(v) => void setEnabled(v)}
      />
      <ToggleRow
        label="Story reminders"
        desc="Daily nudge to continue your story"
        value={n.storyReminders}
        onChange={(v) => void setReminders(v)}
      />
      <ToggleRow
        label="Content update alerts"
        desc="Tell me when new stories arrive"
        value={n.contentUpdates}
        onChange={(v) =>
          void updateSettings({ notifications: { ...n, contentUpdates: v } })
        }
      />

      <SectionHeader title="Reminder time" />
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
      <GradientButton title="Send test reminder" variant="ghost" onPress={() => void sendTest()} />
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
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.body}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.desc, { color: theme.textDim }]}>{desc}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  perm: { fontSize: FONTS.small, marginTop: 6, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
  },
  body: { flex: 1 },
  label: { fontSize: FONTS.body, fontWeight: '700' },
  desc: { fontSize: FONTS.small, marginTop: 2 },
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
