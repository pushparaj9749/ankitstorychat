/**
 * Verify that the APK we just built can actually RECEIVE an OTA.
 *
 * WHY THIS EXISTS (2026-11-27):
 * A redesigned screen shipped over OTA twice. The server side was verified both
 * times (bundle published, manifest signed, UUID + hash + signature checked by
 * `scripts/ota-publish.mjs`), and both times the reporter's phone kept showing
 * the OLD screen. Nothing in the pipeline looked at the APK itself, so the one
 * thing that could not be checked — "does the installed build even know where
 * to look for updates?" — was the one thing that was broken.
 *
 * WHERE THE CONFIG LIVES (this is the part that is easy to get wrong):
 * expo-updates reads its settings from the generated config that
 * `expo prebuild` bakes into the **binary AndroidManifest.xml** as
 * `expo.modules.updates.*` meta-data — NOT from the JS bundle. A first version
 * of this script looked inside `assets/index.android.bundle`, failed on the
 * real APK, and that failure is exactly the gate doing its job. It now reads
 * the manifest, in both encodings the AXML string pool can use.
 *
 * Usage: node scripts/verify-apk-ota.mjs <path-to-AndroidManifest.xml>
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Turn a binary AndroidManifest.xml (or any blob) into something searchable.
 *
 * AXML keeps its string pool as UTF-16LE (sometimes UTF-8) blobs with length
 * prefixes, so a plain ASCII search finds nothing even when the value is there.
 * Decoding both ways and joining keeps this dependency-free.
 */
export function decodable(buf) {
  const utf16 = buf.toString('utf16le');
  const utf8 = buf.toString('utf8');
  return `${utf16}\n${utf8}`;
}

/**
 * Pure check, so the rules are testable without a 100 MB APK.
 * @returns {string[]} problems (empty = the build can receive an OTA)
 */
export function wiringProblems(text, appJson) {
  const updates = appJson?.updates ?? {};
  const runtime = String(appJson?.version ?? '');
  const url = String(updates.url ?? '');
  const problems = [];

  if (updates.enabled === false) {
    problems.push('expo.updates.enabled is false — the app will never look for an update.');
    return problems;
  }

  // The module itself must be in the build.
  if (!/expo\.modules\.updates|EXUpdates/.test(text)) {
    problems.push(
      'the manifest carries no expo.modules.updates configuration — expo-updates is not wired into this APK at all.',
    );
    return problems;
  }

  if (!url) {
    problems.push('app.json has no expo.updates.url — this build can never receive an OTA.');
  } else if (!text.includes(url)) {
    problems.push(
      `the APK manifest does not contain the OTA url "${url}" — ` +
        'the installed app would never check for updates even though the server publishes them.',
    );
  }

  if (!runtime) {
    problems.push('app.json has no version — cannot pin a runtime.');
  } else if (!text.includes(runtime)) {
    problems.push(
      `the APK manifest does not carry runtime "${runtime}" — ` +
        'devices would request a runtime the Worker never serves (policy is appVersion).',
    );
  }

  // Code signing: expo-updates rejects every manifest when the certificate is
  // configured in JS but absent from the native config.
  // expo prebuild writes `...EXUpdatesCodeSigningCertificate`, so match case-insensitively.
  if (updates.codeSigningCertificate && !/code.?signing.?certificate/i.test(text)) {
    problems.push(
      'code signing is enabled in app.json but the APK manifest carries no signing config — ' +
        'expo-updates would reject every signed manifest.',
    );
  }

  return problems;
}

/* ---------------- CLI ---------------- */

const isMain = process.argv[1] && /verify-apk-ota\.mjs$/.test(process.argv[1]);
if (isMain) {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    console.error('usage: node scripts/verify-apk-ota.mjs <AndroidManifest.xml>');
    process.exit(2);
  }

  const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  let buf;
  try {
    buf = readFileSync(manifestPath);
  } catch (err) {
    console.error(`::error title=APK manifest unreadable::${manifestPath}: ${err.message}`);
    process.exit(1);
  }

  const text = decodable(buf);
  const problems = wiringProblems(text, appJson);

  if (problems.length > 0) {
    for (const p of problems) console.error(`::error title=OTA wiring broken::${p}`);
    console.error('\nThe APK would be installable but could never receive an OTA. Refusing to ship it.');
    process.exit(1);
  }

  console.log('OTA wiring verified — the installed APK can receive updates.');
  console.log(`  url      ${appJson.updates.url}`);
  console.log(`  runtime  ${appJson.version}`);
  console.log(`  signing  ${appJson.updates.codeSigningCertificate ? 'enabled' : 'off'}`);
}
