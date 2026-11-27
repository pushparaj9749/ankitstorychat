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
import { installedAppVersion } from './appVersion';

/** Shape shared with the About screen. */
export type OtaCheckResult = {
  state: 'idle' | 'applied' | 'downloaded' | 'current' | 'blocked' | 'error';
  notes?: string;
  /** Update id the server served (UUID), when it served one. Shown in About. */
  id?: string;
  /** Runtime this install asks for — matches app.json version. */
  runtime?: string;
};

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

/** Last check result, so UI can react without asking the server again. */
let lastCheck: OtaCheckResult | null = null;

export function lastOtaCheck(): OtaCheckResult | null {
  return lastCheck;
}

export function otaEnabled(): boolean {
  // Synchronous best-effort flag for UI copy.
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  return typeof extra.KISSA_OTA_BASE_URL === 'string';
}

/** Check for a JS update and download it. Safe to call on launch. */
export async function checkForOtaUpdate(): Promise<OtaCheckResult> {
  const result = await runOtaCheck();
  lastCheck = result;
  return result;
}

async function runOtaCheck(): Promise<OtaCheckResult> {
  const u = await updates();
  if (!u) return { state: 'blocked' };
  // The runtime a build belongs to is its NATIVE version (app.json version at
  // build time). After an OTA, expoConfig.version is the served manifest's
  // version, so reading it here would drift. See appVersion() in account.ts.
  const runtime = installedAppVersion();
  try {
    const res = await u.checkForUpdateAsync();
    if (!res.isAvailable) return { state: 'current', runtime };
    const fetched = await u.fetchUpdateAsync();
    // `metadata` carries the one-line note CI published with the update.
    const notes =
      res.manifest && typeof res.manifest === 'object' && 'metadata' in res.manifest
        ? ((res.manifest.metadata as { notes?: string } | undefined)?.notes ?? undefined)
        : undefined;
    const id =
      res.manifest && typeof res.manifest === 'object' && 'id' in res.manifest
        ? String((res.manifest as { id?: unknown }).id ?? '') || undefined
        : undefined;
    return { state: fetched.isNew ? 'downloaded' : 'current', notes, id, runtime };
  } catch (err) {
    // NEVER report "you are current" from a failure. A throw here means the
    // update was rejected (signature, a malformed manifest, a network fault) —
    // the app is still on the old bundle, and saying "sab latest hai" hides the
    // bug. That is exactly how two broken OTA releases looked fine for hours.
    const msg = err instanceof Error ? err.message : String(err);
    if (/signature|certificate|code signing/i.test(msg)) {
      return { state: 'blocked', runtime, notes: 'Update ka signature verify nahi hua — skip kar diya.' };
    }
    return { state: 'error', runtime, notes: msg.slice(0, 160) };
  }
}

/**
 * Is a downloaded update waiting for the next launch?
 *
 * `checkForOtaUpdate()` downloads but does not apply (the app must never reload
 * while the user is mid-story), so the About card needs to know whether a
 * restart is worth offering.
 */
export async function hasPendingOtaUpdate(): Promise<boolean> {
  const u = await updates();
  if (!u) return false;
  try {
    const res = await u.checkForUpdateAsync();
    return res.isAvailable === true;
  } catch {
    return false;
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
 * Quiet launch-time check. Never blocks the first paint: with
 * `fallbackToCacheTimeout: 0` the app boots from the bundle it already has and
 * the new one is applied on the next cold start.
 *
 * The delay used to be 20s, which — on top of expo-updates' own launch check —
 * meant a fix could take three opens to appear, indistinguishable from "the
 * OTA never arrived". It is now 2s: long enough for the first screen to be
 * painted, short enough that a reader who opens the app and closes it still
 * downloads in the same session.
 */
export function scheduleOtaCheck(delayMs = 2_000): void {
  if (!otaEnabled()) return;
  setTimeout(() => {
    void checkForOtaUpdate();
  }, delayMs);
}
