/**
 * OTA wiring (v2.15): small JS fixes ship without an APK, native changes do not.
 *
 * These tests pin the CONTRACT rather than the network: the app points at our
 * own Worker, every update is code-signed, the runtime is the app version, and
 * the publish script refuses to ship a JS bundle when native files changed.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), 'utf8');
const appJson = JSON.parse(read('app.json')) as {
  expo: {
    version: string;
    runtimeVersion: { policy: string };
    updates: {
      enabled: boolean;
      url: string;
      codeSigningCertificate?: string;
      fallbackToCacheTimeout: number;
    };
    plugins: unknown[];
  };
};

describe('app.json OTA configuration', () => {
  test('updates are served by the Kissa Worker, not a third party', () => {
    expect(appJson.expo.updates.enabled).toBe(true);
    expect(appJson.expo.updates.url).toBe('https://beyondredeye.site/api/ota/manifest');
  });

  test('the runtime is pinned to the app version', () => {
    // A 2.15 build must never receive a 2.14 bundle.
    expect(appJson.expo.runtimeVersion.policy).toBe('appVersion');
  });

  test('every update is code-signed with a committed certificate', () => {
    const cert = appJson.expo.updates.codeSigningCertificate ?? '';
    expect(cert).toBe('./assets/certificate.pem');
    expect(read('assets/certificate.pem')).toContain('BEGIN CERTIFICATE');
  });

  test('the first launch is not held hostage by a slow update server', () => {
    expect(appJson.expo.updates.fallbackToCacheTimeout).toBe(0);
  });

  test('expo-updates is a declared dependency and plugin', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['expo-updates']).toBeTruthy();
    expect(JSON.stringify(appJson.expo.plugins)).toContain('expo-updates');
  });
});

describe('the small-change / big-change split is enforced', () => {
  const script = read('scripts/ota-publish.mjs');

  test('native paths abort the publish', () => {
    expect(script).toMatch(/\^android\\\//);
    expect(script).toMatch(/\^package\(-lock\)\?\\\.json\$/);
    expect(script).toMatch(/needs a new APK, not an OTA/);
  });

  test('an unsigned bundle is never published', () => {
    expect(script).toMatch(/RSA-SHA256/);
    expect(script).toMatch(/OTA_SIGNING_KEY is not set/);
  });

  test('the worker refuses unsigned publishes too', () => {
    expect(read('worker/src/otaAdmin.ts')).toMatch(/signature_required/);
  });
});

describe('the app surfaces OTA instead of pretending', () => {
  test('About offers an OTA check + restart, wired to lib/ota', () => {
    const about = read('src/screens/About.tsx');
    expect(about).toMatch(/checkForOtaUpdate/);
    expect(about).toMatch(/restartToApply/);
    expect(about).toMatch(/native change/i);
  });

  test('the update wall and the OTA manifest stay reachable for old installs', () => {
    const router = read('worker/src/router.ts');
    expect(router).toMatch(/!route\.kind\.startsWith\('ota-'\)/);
  });
});
