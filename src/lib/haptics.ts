/** Haptic feedback wrapper (Settings -> Audio -> Haptics). Guarded. */
let Haptics: typeof import('expo-haptics') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Haptics = require('expo-haptics');
} catch {
  // Headless / jest test environment fallback
}

export async function tapTick(enabled = true): Promise<void> {
  if (!enabled || !Haptics) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // No haptics on this device — fine.
  }
}

export async function lightBuzz(enabled = true): Promise<void> {
  if (!enabled || !Haptics) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // No haptics — fine.
  }
}

export async function mediumBuzz(enabled = true): Promise<void> {
  if (!enabled || !Haptics) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // No haptics — fine.
  }
}

export async function successBuzz(enabled = true): Promise<void> {
  if (!enabled || !Haptics) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // No haptics — fine.
  }
}
