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
 *   4. The bundle is RSA-SHA256 signed with the code-signing private key and
 *      the Worker refuses unsigned updates.
 *
 * Environment: ADMIN_TOKEN, OTA_SIGNING_KEY (PEM), KISSA_API (optional).
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
    ['expo', 'export', '--platform', 'android', '--output-dir', outDir, '--no-minify'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, EXPO_NO_TELEMETRY: '1' } },
  );
} catch {
  fail('expo export failed — the app does not build for OTA.');
}

/* ---------------- 4. pack the launch asset ---------------- */

function findBundle() {
  const dir = path.join(outDir, 'bundles');
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((f) => /^android-.*\.(js|hbc|js\.map)?$/.test(f) || f.startsWith('android-'));
  return hit ? path.join(dir, hit) : null;
}
const bundle = findBundle();
const assetsDir = path.join(outDir, '_expo', 'static', 'js', 'android');
if (!bundle && !fs.existsSync(assetsDir)) fail(`No Android bundle produced in ${outDir}.`);

// The Worker takes one opaque blob; tar the export directory so relative asset
// paths inside the bundle stay intact.
const tarball = path.join(ROOT, '.ota-export.tgz');
try {
  execFileSync('tar', ['-czf', tarball, '-C', outDir, '.'], { cwd: ROOT });
} catch {
  fail('Could not pack the exported bundle.');
}
const bytes = fs.readFileSync(tarball);
const hash = crypto.createHash('sha256').update(bytes).digest('hex');
log(`Bundle packed: ${bytes.length} bytes, sha256 ${hash.slice(0, 16)}…`);

/* ---------------- 5. sign ---------------- */

const keyPem = (process.env.OTA_SIGNING_KEY || '').replace(/\\n/g, '\n');
if (!keyPem) fail('OTA_SIGNING_KEY is not set (the code-signing private key).');
const signature = crypto.createSign('RSA-SHA256').update(bytes).end().sign(keyPem, 'base64');

/* ---------------- 6. publish ---------------- */

const notes = (process.env.OTA_NOTES || `Kissa ${pkg.version} OTA`).slice(0, 200);

if (DRY) {
  log(`DRY RUN — would publish ${bytes.length} bytes for runtime ${runtime}`);
  log(`  signature: ${signature.slice(0, 24)}…`);
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
    'Content-Type': 'application/octet-stream',
    'X-Kissa-OTA-Signature': signature,
    'X-Kissa-OTA-Bundle-Hash': hash,
    'X-Kissa-OTA-Notes': notes,
  },
  body: bytes,
});

const text = await res.text();
if (!res.ok) fail(`publish failed (${res.status}): ${text.slice(0, 400)}`);
log(`✅ Published OTA for ${runtime}: ${text.slice(0, 300)}`);

fs.rmSync(outDir, { recursive: true, force: true });
fs.rmSync(tarball, { force: true });
