/**
 * LOCAL notifications only — no backend, no push tokens, no server.
 * - Daily story reminder (opt-in, user-chosen hour).
 * - New-content-available notice after a manifest check finds stories.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { kvGet, kvSet } from './db';

const K_REMINDER_ID = 'notif_reminder_id';

let handlerSet = false;

export function initNotificationHandler(): void {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('stories', {
      name: 'Story reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function permissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.status === 'denied' ? 'denied' : 'undetermined';
}

export async function requestPermission(): Promise<boolean> {
  const p = await Notifications.requestPermissionsAsync();
  return !!p.granted;
}

/** Schedule (or reschedule) the daily reminder at `hour` (0-23). */
export async function scheduleDailyReminder(hour: number, nickname: string): Promise<void> {
  await cancelDailyReminder();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Kissa 📖',
      body: `Hey ${nickname || 'traveller'}, tumhari kahani tumhara intezaar kar rahi hai. Continue karein?`,
      data: { kind: 'reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
    },
  });
  await kvSet(K_REMINDER_ID, id);
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    const id = await kvGet(K_REMINDER_ID);
    if (id) await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Nothing scheduled — fine.
  }
  await kvSet(K_REMINDER_ID, '');
}

/** One-shot local notice: new stories are available to download. */
export async function notifyContentUpdate(count: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Nayi kahaniyan aayi hain! ✨',
      body:
        count === 1
          ? 'Ek nayi story catalog mein aa gayi hai.'
          : `${count} nayi stories catalog mein aa gayi hain.`,
      data: { kind: 'content-update' },
    },
    trigger: null,
  });
}

/** One-shot local notice: a download finished. */
export async function notifyDownloadDone(title: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Download complete ✅',
      body: `"${title}" ab offline available hai.`,
      data: { kind: 'download-done' },
    },
    trigger: null,
  });
}
