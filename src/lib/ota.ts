/**
 * OTA updates (expo-updates) — the app side.
 *
 * Small fixes (copy, layout, a broken screen, a bug in a flow) ship as a JS
 * bundle over the air; anything native (new permission, dependency, SDK bump)
 * still needs a new APK. The split is enforced twice: CI refuses to publish an
 * OTA when native files changed, and `runtimeVersion.policy = "appVersion"`
 * means a bundle can only ever reach the build version it was made for.
 *
 * The update server is our own Worker (`app.json → expo.updates.url`), and every
 * bundle is code-signed (assets/certificate.pem), so a tampered download is
 * rejected by expo-updates itself before it can run.
 *
 * This module never throws: OTA is an optimisation, not a requirement.
 */
import Constants from 'expo-constants';

/** Shape shared with the About screen. */
export type OtaCheckResult = { state: 'idle' | 'applied' | 'downloaded' | 'current' | 'blocked'; notes?: string };

/**
 * expo-updates is loaded lazily: in Expo Go / a dev client the native module is
 * absent, and the app must keep working (that is what `enabled` in app.json is
 * for as well).
 */
async function updates(): Promise<typeof import('expo-updates') | null> {
  try {
    // Non-literal specifier: expo-updates is an optional native module, and a
    // static import would break jest / Expo Go where it is not installed.
    const name = 'expo-updates';
    const mod = (await import(name)) as typeof import('expo-updates');
    if (!mod.isEnabled) return null;
    return mod;
  } catch {
    return null;
  }
}

export function otaEnabled(): boolean {
  // Synchronous best-effort flag for UI copy.
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  return typeof extra.KISSA_OTA_BASE_URL === 'string';
}

/** Check for a JS update and download it. Safe to call on launch. */
export async function checkForOtaUpdate(): Promise<OtaCheckResult> {
  const u = await updates();
  if (!u) return { state: 'blocked' };
  try {
    const res = await u.checkForUpdateAsync();
    if (!res.isAvailable) return { state: 'current' };
    const fetched = await u.fetchUpdateAsync();
    // `metadata` carries the one-line note CI published with the update.
    const notes =
      res.manifest && typeof res.manifest === 'object' && 'metadata' in res.manifest
        ? ((res.manifest.metadata as { notes?: string } | undefined)?.notes ?? undefined)
        : undefined;
    return { state: fetched.isNew ? 'downloaded' : 'current', notes };
  } catch {
    return { state: 'current' };
  }
}

/** Apply a downloaded update. Call it from a user action (it reloads the app). */
export async function restartToApply(): Promise<void> {
  const u = await updates();
  if (!u) return;
  try {
    await u.reloadAsync();
  } catch {
    /* nothing to reload */
  }
}

/**
 * Quiet launch-time check. Never blocks the first paint and never surfaces an
 * error: with `fallbackToCacheTimeout: 0` the app boots from the bundle it
 * already has and the new one is applied on the next cold start.
 */
export function scheduleOtaCheck(delayMs = 20_000): void {
  if (!otaEnabled()) return;
  setTimeout(() => {
    void checkForOtaUpdate();
  }, delayMs);
}
