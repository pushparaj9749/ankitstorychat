/**
 * The version of the APK that is actually installed on this device.
 *
 * WHY THIS IS ITS OWN MODULE: it is read from places that must stay light
 * (the OTA check, the update check, the account client). Pulling all of
 * account.ts into those would drag SecureStore and the DB along for one string.
 *
 * WHY IT DOES NOT TRUST `Constants.expoConfig.version`:
 * expo-constants resolves `expoConfig` from the manifest that is CURRENTLY
 * RUNNING. After an OTA update that manifest is the one the Worker served, so
 * `expoConfig.version` becomes the JS bundle's version — not the APK's.
 *
 * That one wrong value brought the "ye update purana ho gaya hai" wall back
 * after almost every OTA: an update arrived, the reader pressed Restart, the
 * app sent the bundle's version as `X-Kissa-Version`, the server compared it
 * with minVersion, answered 426, and a perfectly current install was locked
 * behind the full-screen wall.
 *
 * The APK version is a native fact, so it is read from the native module
 * (`expo-application` → PackageInfo.versionName). `expoConfig` stays only as a
 * fallback for jest / web / Expo Go, where the native module is missing.
 * `Constants.executionEnvironment` is deliberately not used: it reports `bare`
 * in all of those.
 */
import Constants from 'expo-constants';

export function installedAppVersion(): string {
  try {
    // require() keeps the native module optional: a bundle running where the
    // module is missing must not crash the launch check.
    const app = require('expo-application') as { nativeApplicationVersion?: string | null };
    const native = String(app?.nativeApplicationVersion ?? '').trim();
    if (native) return native;
  } catch {
    /* fall through to the config value */
  }
  const fromConfig = String(Constants.expoConfig?.version ?? '').trim();
  return fromConfig || '0.0.0';
}

/**
 * Human-readable build stamp, e.g. `v2.16.2 (51)`.
 *
 * WHY: on 2026-11-27 a redesigned screen was reported as "still the same" four
 * times. Every reply was a guess, because the screenshot did not say WHICH
 * build produced it — the APK could have been 2.16.1 while the OTA was 2.16.2,
 * or an old APK that never had the fix at all. This stamp exists so a
 * screenshot answers that question immediately, without any guessing.
 *
 * `installedAppVersion()` is the APK's own version (native fact), so the stamp
 * keeps telling the truth even after an OTA replaced the JS bundle.
 */
export function buildStamp(): string {
  const version = installedAppVersion();
  let code = '';
  try {
    // Same native module, no new dependency.
    const app = require('expo-application') as { nativeBuildVersion?: string | null };
    code = String(app?.nativeBuildVersion ?? '').trim();
  } catch {
    /* jest / web / Expo Go: version alone is still useful */
  }
  return code ? `v${version} (${code})` : `v${version}`;
}
