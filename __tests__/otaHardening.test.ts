/**
 * OTA hardening after 2026-11-27.
 *
 * The server side of OTA was verified twice while the reporter's phone kept
 * showing the old screen: nothing checked that the INSTALLED APK knows where to
 * look, and a downloaded update was invisible until a second cold start. These
 * guards make both impossible to regress silently.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('the APK is checked for OTA wiring before it ships', () => {
  test('CI runs the verifier on the APK manifest, before the artifact uploads', () => {
    const wf = read('.github/workflows/android.yml');
    expect(wf).toContain('Verify OTA wiring inside the APK');
    // The config is native meta-data, NOT in assets/index.android.bundle — a
    // first version of this gate looked in the bundle and failed the real APK.
    expect(wf).toMatch(/unzip -o -q "\$apk" 'AndroidManifest\.xml'/);
    expect(wf).toMatch(/node scripts\/verify-apk-ota\.mjs/);
    expect(wf.indexOf('verify-apk-ota.mjs')).toBeLessThan(wf.indexOf('Upload APK artifact'));
  });

  /** Write bytes the way a binary AXML string pool stores them (UTF-16LE). */
  const writeManifest = (body: string) => {
    const tmp = path.join(__dirname, `.tmp-manifest-${Math.random().toString(36).slice(2)}.xml`);
    fs.writeFileSync(tmp, Buffer.from(body, 'utf16le'));
    return tmp;
  };

  test('fails when the OTA config is absent', () => {
    const tmp = writeManifest('<manifest><application/></manifest>');
    let failed = false;
    try {
      execFileSync('node', ['scripts/verify-apk-ota.mjs', tmp], { stdio: 'pipe' });
    } catch {
      failed = true;
    }
    fs.unlinkSync(tmp);
    expect(failed).toBe(true);
  });

  test('fails when the url is missing even though the module is wired', () => {
    const appJson = JSON.parse(read('app.json')).expo;
    const tmp = writeManifest(
      `<meta-data android:name="expo.modules.updates.EXUpdatesUrlAndHeaders" android:value="other"/>` +
        `<meta-data android:name="expo.modules.updates.EXUpdatesRuntimeVersion" android:value="${appJson.version}"/>`,
    );
    let failed = false;
    try {
      execFileSync('node', ['scripts/verify-apk-ota.mjs', tmp], { stdio: 'pipe' });
    } catch {
      failed = true;
    }
    fs.unlinkSync(tmp);
    expect(failed).toBe(true);
  });

  test('passes for a manifest that matches app.json', () => {
    const appJson = JSON.parse(read('app.json')).expo;
    const tmp = writeManifest(
      `<meta-data android:name="expo.modules.updates.EXUpdatesUrlAndHeaders" android:value="${appJson.updates.url}"/>` +
        `<meta-data android:name="expo.modules.updates.EXUpdatesRuntimeVersion" android:value="${appJson.version}"/>` +
        `<meta-data android:name="expo.modules.updates.EXUpdatesCodeSigningCertificate" android:value="asset://certificate.pem"/>`,
    );
    expect(() =>
      execFileSync('node', ['scripts/verify-apk-ota.mjs', tmp], { stdio: 'pipe' }),
    ).not.toThrow();
    fs.unlinkSync(tmp);
  });
});

describe('a downloaded update is visible and one tap away', () => {
  // Chhote (JS) updates OTA se aate hain aur in-app Restart se lagte hain.
  // Bade VERSION updates (naya APK) website par jaate hain — ye alag raaste
  // hain aur dono kaam karte rehte hain (user ka instruction, v2.17.1).
  test('Home shows a restart banner for small OTA updates', () => {
    const home = code('src/screens/Home.tsx');
    expect(home).toMatch(/otaReady \?/);
    expect(home).toMatch(/applyOtaUpdate/);
    expect(home).toMatch(/otaBanner/);
    expect(home).toMatch(/Restart/);
  });

  test('context exposes otaReady + applyOtaUpdate and mirrors the launch check', () => {
    const ctx = code('src/state/AppContext.tsx');
    expect(ctx).toMatch(/otaReady/);
    expect(ctx).toMatch(/applyOtaUpdate/);
    expect(ctx).toMatch(/lastOtaCheck\(\)/);
    expect(ctx).toMatch(/restartToApply/);
  });

  test('version (APK) updates point at the website, not GitHub', () => {
    const links = code('src/lib/links.ts');
    expect(links).toMatch(/RELEASES_PAGE = 'https:\/\/beyondredeye\.site'/);
    const about = code('src/screens/About.tsx');
    expect(about).toMatch(/Linking\.openURL\(RELEASES_PAGE\)/);
    expect(about).not.toMatch(/downloadUrl/);
  });

  test('the launch check no longer waits 20s', () => {
    const ota = code('src/lib/ota.ts');
    expect(ota).toMatch(/scheduleOtaCheck\(delayMs = 2_000\)/);
    expect(ota).not.toMatch(/20_000/);
  });
});
