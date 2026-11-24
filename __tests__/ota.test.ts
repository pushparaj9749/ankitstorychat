/**
 * OTA wiring (v2.15): small JS fixes ship without an APK, native changes do not.
 *
 * These tests pin the CONTRACT rather than the network: the app points at our
 * own Worker, every MANIFEST is code-signed (the signature the app actually
 * verifies — see expo-updates CodeSigningConfiguration), the runtime is the app
 * version, asset hashes are base64url, and the publish script refuses to ship a
 * JS bundle when native files changed.
 *
 * The v2.15.0 build shipped a certificate that was really a bare public key, a
 * signature over the bundle instead of the manifest body, and a .tgz as the
 * launch asset — all three would have made expo-updates reject or fail every
 * update. The last describe() block re-checks each of those facts directly.
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

  test('the signing metadata the Worker stamps matches app.json', () => {
    // Mismatch => "Key with keyid=… not found in client configuration".
    const meta = (appJson.expo.updates as { codeSigningMetadata?: { keyid: string; alg: string } })
      .codeSigningMetadata;
    expect(meta).toEqual({ keyid: 'root', alg: 'rsa-v1_5-sha256' });
    const worker = read('worker/src/ota.ts');
    expect(worker).toContain(`export const OTA_SIGNING_KEY_ID = '${meta!.keyid}'`);
    expect(worker).toContain(`export const OTA_SIGNING_ALG = '${meta!.alg}'`);
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

  test('the launch asset is the JS file, never a tarball or bytecode', () => {
    // expo-updates writes these exact bytes to disk and runs them as the bundle.
    expect(script).not.toMatch(/tar'?,\s*\['-czf'/);
    // Bytecode can never be delivered over the air.
    expect(script).toContain('--no-bytecode');
    expect(script).toMatch(/OTA can only ship JavaScript/);
    // The bundle path is read from expo's metadata.json, not guessed.
    expect(script).toContain("meta?.fileMetadata?.android");
    expect(script).toContain("endsWith('.js')");
  });

  test('CI never handles the private key — the Worker signs, not the script', () => {
    // Keeping the key out of CI means a compromised runner cannot mint updates.
    expect(script).not.toMatch(/createSign/);
    expect(read('worker/src/ota.ts')).toMatch(/export async function signManifest/);
  });

  test('the worker refuses to serve a manifest it cannot sign', () => {
    const router = read('worker/src/router.ts');
    expect(router).toMatch(/ota_signing_key_missing/);
    expect(router).toMatch(/'expo-signature': signature/);
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

describe('what expo-updates actually requires (regressions from v2.15.0)', () => {
  test('the committed certificate is a real X.509 code-signing cert', () => {
    // The old file was a raw PUBLIC KEY wrapped in CERTIFICATE headers; the app
    // failed with "ASN.1 object is not an X509v3 Certificate". Parsing it with a
    // real X.509 parser is the only honest check.
    const pem = read('assets/certificate.pem');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { X509Certificate } = require('node:crypto') as typeof import('node:crypto');
    const cert = new X509Certificate(pem);
    expect(cert.subject).toContain('Kissa OTA Code Signing');
    // Not expired — an expired pin bricks OTA for every install.
    expect(new Date(cert.validTo).getTime()).toBeGreaterThan(Date.now());
    // Code-signing extensions the app enforces (Java throws without them).
    const der = Buffer.from(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64');
    expect(der.includes(Buffer.from('2b06010505070303', 'hex'))).toBe(true); // Code Signing EKU
    expect(der.includes(Buffer.from('551d0f', 'hex'))).toBe(true); // Key Usage
  });

  test('the manifest carries no launchAsset.hash it cannot honour', () => {
    // Serving a hash that is not base64url(sha256(bundle)) makes the device
    // abort with "Asset hash mismatch".
    const worker = read('worker/src/ota.ts');
    expect(worker).toMatch(/hash: rel\.bundleHash/);
    expect(read('worker/src/otaAdmin.ts')).toMatch(/await assetHash\(buf\)/);
  });

  test('the signature is over the manifest body, with the app-readable header', () => {
    const router = read('worker/src/router.ts');
    expect(router).toMatch(/const body = JSON\.stringify\(buildManifest/);
    expect(router).toMatch(/signManifest\(body, key\)/);
    expect(router).toMatch(/Access-Control-Expose-Headers/);
  });

  test('OTA stays exempt from the version gate so a fix can reach old installs', () => {
    expect(read('worker/src/router.ts')).toMatch(/!route\.kind\.startsWith\('ota-'\)/);
  });
});
