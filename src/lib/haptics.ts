/** Haptic feedback wrapper (Settings -> Audio -> Haptics). Guarded. */
import * as Haptics from 'expo-haptics';

export async function tapTick(enabled: boolean): Promise<void> {
  if (!enabled) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // No haptics on this device — fine.
  }
}

export async function successBuzz(enabled: boolean): Promise<void> {
  if (!enabled) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // No haptics — fine.
  }
}
