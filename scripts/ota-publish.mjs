#!/usr/bin/env node
/**
 * Publish an OTA (JS-only) update to the Kissa Worker.
 *
 *   node scripts/ota-publish.mjs            # publish for the current version
 *   node scripts/ota-publish.mjs --dry-run  # build + sign, print the plan
 *
 * WHAT OTA CAN AND CANNOT DO (the rule the user asked for):
 *   - small changes  -> OTA: JS/TS, screens, copy, styles, API usage, bug fixes
 *   - big changes    -> new APK: any native change (new dependency with native
 *                       code, permission, SDK bump, app.json native fields)
 *
 * Safety rules enforced here, in order:
 *   1. `expo export` must produce the bundles (no native build needed).
 *   2. The app.json `runtimeVersion` (appVersion policy) is read from the
 *      EXACT app.json in the commit, so a bundle can only ever be served to the
 *      build that shares its version.
 *   3. If anything that affects native code changed since the last APK tag,
 *      the publish ABORTS: that change needs an APK, not an OTA.
 *   4. The Worker signs the manifest at serve time with OTA_SIGNING_KEY. CI
 *      never needs the private key: expo-updates verifies the MANIFEST body
 *      (expo-signature header), not the bundle.
 *
 * Environment: ADMIN_TOKEN, KISSA_API (optional).
 * No secrets are ever written to the repo.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const API = (process.env.KISSA_API || 'https://beyondredeye.site/api').replace(/\/+$/, '');
const DRY = process.argv.includes('--dry-run');

const log = (m) => console.log(m);
const fail = (m) => {
  console.error(m);
  console.log(`::error title=OTA publish blocked::${String(m).replace(/\r?\n/g, ' ').slice(0, 900)}`);
  process.exit(1);
};

/* ---------------- 1. native-change guard ---------------- */

/**
 * Files that only change JS/UI — OTA-safe.
 * Everything else in the app (android/, ios/, app.json native keys, package
 * dependencies) needs a real APK.
 */
const NATIVE_PATHS = [
  /^android\//,
  /^ios\//,
  /^assets\/.*\.(png|jpg|jpeg|ttf|otf)$/, // bundled native assets need a rebuild
  /^package(-lock)?\.json$/,
  /^eas\.json$/,
  /^app\.config\.(js|ts)$/,
];

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function lastApkTag() {
  try {
    const tags = git(['tag', '--list', 'v2.*', '--sort=-v:refname']).split('\n').filter(Boolean);
    return tags[0] || null;
  } catch {
    return null;
  }
}

function changedSince(tag) {
  try {
    return git(['diff', '--name-only', `${tag}..HEAD`]).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

const tag = lastApkTag();
const changed = tag ? changedSince(tag) : [];
const nativeHits = changed.filter((f) => NATIVE_PATHS.some((re) => re.test(f)));

if (tag && nativeHits.length > 0) {
  fail(
    `Native change detected since ${tag} — this needs a new APK, not an OTA:\n` +
      nativeHits.slice(0, 15).map((f) => `  - ${f}`).join('\n') +
      '\n\nBump app.json version + versionCode, tag vX.Y.Z, then OTA for the next small fix.',
  );
}

/* ---------------- 2. which update is this? ---------------- */

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const runtime = appJson.expo.version;
if (pkg.version !== runtime && pkg.version !== `${runtime}-ota`) {
  // package.json may be "2.14.0-ota" for an OTA-only release; otherwise the
  // version files must agree (the APK guard enforces the same rule).
  fail(`package.json (${pkg.version}) and app.json (${runtime}) disagree.`);
}
log(`OTA for runtime ${runtime} (package ${pkg.version})`);

/* ---------------- 3. build the JS bundle ---------------- */

const outDir = path.join(ROOT, '.ota-export');
fs.rmSync(outDir, { recursive: true, force: true });
log('Exporting the JS bundle…');
try {
  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    // --no-bytecode is REQUIRED: OTA can only ship JavaScript. Hermes bytecode
    // needs a matching native engine and can never be delivered over the air.
    ['expo', 'export', '--platform', 'android', '--output-dir', outDir, '--no-minify', '--no-bytecode'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, EXPO_NO_TELEMETRY: '1' } },
  );
} catch {
  fail('expo export failed — the app does not build for OTA.');
}

/* ---------------- 4. pick the launch asset ---------------- */

/**
 * The Worker serves ONE blob as the launch asset and expo-updates hands those
 * exact bytes to AssetManager as the JS bundle. So the blob must be the
 * exported .js file itself — never a tarball, never Hermes .hbc (bytecode needs
 * a matching native engine and cannot be delivered over the air).
 *
 * The layout is read from expo's own metadata.json instead of assuming a path:
 * `expo export` has moved its output around between SDKs, and a wrong guess
 * silently published "no bundle".
 */
const metaPath = path.join(outDir, 'metadata.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const androidFiles = meta?.fileMetadata?.android;
if (!androidFiles) fail('expo export produced no android bundle in metadata.json.');
const bundleRel = Array.isArray(androidFiles) ? androidFiles[0]?.bundle : androidFiles.bundle;
if (!bundleRel) fail('metadata.json has no android bundle entry.');
if (!bundleRel.endsWith('.js')) {
  fail(`expo export produced ${bundleRel} — OTA can only ship JavaScript, not bytecode.`);
}
const bundle = path.join(outDir, bundleRel);
if (!fs.existsSync(bundle)) fail(`metadata.json points at ${bundleRel}, which does not exist.`);
const bytes = fs.readFileSync(bundle);
const hash = crypto.createHash('sha256').update(bytes).digest('base64url');
log(`Bundle: ${bundleRel} (${(bytes.length / 1e6).toFixed(1)} MB), sha256(base64url) ${hash.slice(0, 16)}…`);

/* ---------------- 5. publish ---------------- */

const notes = (process.env.OTA_NOTES || `Kissa ${pkg.version} OTA`).slice(0, 200);

if (DRY) {
  log(`DRY RUN — would publish ${bytes.length} bytes for runtime ${runtime}`);
  log(`  notes: ${notes}`);
  process.exit(0);
}

const admin = process.env.ADMIN_TOKEN;
if (!admin) fail('ADMIN_TOKEN is not set.');

const url = `${API}/ota/publish?platform=android&runtime=${encodeURIComponent(runtime)}`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${admin}`,
    'Content-Type': 'application/javascript',
    'X-Kissa-OTA-Notes': notes,
  },
  body: bytes,
});

const text = await res.text();
if (!res.ok) fail(`publish failed (${res.status}): ${text.slice(0, 400)}`);
log(`✅ Published OTA for ${runtime}: ${text.slice(0, 300)}`);

// Prove the app will accept it — by asking EXACTLY the way the app asks.
//
// expo-updates does not append query params: it GETs the update url unchanged
// and sends the runtime as a header (FileDownloader.createRequestForRemoteUpdate):
//   GET  <app.json expo.updates.url>
//   Expo-Platform: android
//   Expo-Runtime-Version: <runtime>
//
// This check used to use ?runtime-version=…, which the app never sends — so it
// passed while every real device got 204 ("already up to date"). Never again:
// the header request below is the one that gates the publish.
const manifestRes = await fetch(`${API}/ota/manifest`, {
  headers: {
    Accept: 'multipart/mixed,application/expo+json,application/json',
    'Expo-Protocol-Version': '1',
    'Expo-Platform': 'android',
    'Expo-Runtime-Version': runtime,
    'Expo-Updates-Environment': 'BARE',
  },
});
const manifestBody = await manifestRes.text();
const sig = manifestRes.headers.get('expo-signature') || '';
if (manifestRes.status !== 200 || !sig) {
  fail(
    `the app's own request (headers, no query params) got ${manifestRes.status} instead of 200 — ` +
      'the update would never reach a device.',
  );
}
const parsed = JSON.parse(manifestBody);
if (parsed.id !== JSON.parse(text).release.id) fail('served manifest is not the update just published.');
if (parsed.launchAsset.hash !== hash) fail('served manifest hash does not match the uploaded bundle.');
// expo-updates (Android) parses the manifest id with UUID.fromString(). A
// non-UUID throws, the app silently discards the update and keeps reporting
// "already up to date" — two releases shipped dead exactly like that
// (ota_FCR4NmqEqoCK0A, ota_agtgeXcMzQlI3Q). Signature + hash checks below do
// NOT catch it, so assert the shape here: this is the only place that sees a
// real served manifest before users do.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (typeof parsed.id !== 'string' || !UUID_RE.test(parsed.id)) {
  fail(`manifest id is not a UUID ("${parsed.id}") — expo-updates would reject this update silently.`);
}
if (!parsed.launchAsset?.url?.includes(parsed.id)) {
  fail('launchAsset url does not contain the manifest id — the app could not fetch the bundle.');
}
log(`✅ Manifest is signed, id is a UUID, and matches the upload (${sig.slice(0, 40)}…)`);

fs.rmSync(outDir, { recursive: true, force: true });
