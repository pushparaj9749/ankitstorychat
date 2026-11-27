/**
 * Verify that the APK we just built can actually RECEIVE an OTA.
 *
 * WHY THIS EXISTS (2026-11-27):
 * A redesigned screen shipped over OTA twice. The server side was verified both
 * times (bundle published, manifest signed, UUID + hash + signature checked by
 * `scripts/ota-publish.mjs`), and both times the reporter's phone kept showing
 * the OLD screen. Nothing in the pipeline looked at the APK itself, so the one
 * thing that could not be checked — "does the installed build even know where
 * to look for updates?" — was the one thing that was broken. Every reply in
 * that thread was a guess because nobody could say which build was on screen.
 *
 * So the APK is now a gate. expo-updates reads its config from the embedded
 * ExpoConfig, which `expo prebuild` writes into the JS bundle from app.json.
 * This script unpacks the bundle and proves, before the artifact is uploaded:
 *
 *   1. the OTA url from app.json is baked in,
 *   2. the runtime version (= app.json version, policy "appVersion") is baked in,
 *   3. if code signing is enabled, the signing config is present too.
 *
 * A build that fails here could never receive the OTA we would publish for it,
 * so shipping it is pointless. Fail the build instead of the user.
 *
 * Usage: node scripts/verify-apk-ota.mjs <path-to-index.android.bundle>
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundlePath = process.argv[2];

if (!bundlePath) {
  console.error('usage: node scripts/verify-apk-ota.mjs <assets/index.android.bundle>');
  process.exit(2);
}

const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
const updates = appJson.updates ?? {};
const runtime = appJson.version;
const url = String(updates.url ?? '');

let src;
try {
  src = readFileSync(bundlePath, 'utf8');
} catch (err) {
  console.error(`::error title=APK bundle unreadable::${bundlePath}: ${err.message}`);
  process.exit(1);
}

/** Collect every failure instead of stopping at the first one. */
const problems = [];

if (!url) {
  problems.push('app.json has no expo.updates.url — this build can never receive an OTA.');
} else if (!src.includes(url)) {
  problems.push(
    `the installed bundle does not contain the OTA url "${url}" — ` +
      'the app would never check for updates even though the server publishes them.',
  );
}

if (!src.includes(runtime)) {
  problems.push(
    `the installed bundle does not carry runtime "${runtime}" — ` +
      'devices would request a runtime the Worker never serves (policy is appVersion).',
  );
}

if (updates.codeSigningCertificate && !src.includes('codeSigningCertificate')) {
  problems.push(
    'code signing is enabled in app.json but the bundle carries no signing config — ' +
      'expo-updates would reject every signed manifest.',
  );
}

// Updates must be ON: a disabled build ignores the whole channel.
if (updates.enabled === false) {
  problems.push('expo.updates.enabled is false — the app will never look for an update.');
}

if (problems.length > 0) {
  for (const p of problems) console.error(`::error title=OTA wiring broken::${p}`);
  console.error('\nThe APK would be installable but could never receive an OTA. Refusing to ship it.');
  process.exit(1);
}

console.log(`OTA wiring verified: url + runtime ${runtime} are baked into the APK.`);
console.log(`  url      ${url}`);
console.log(`  runtime  ${runtime}`);
console.log(`  signing  ${updates.codeSigningCertificate ? 'enabled' : 'off'}`);
