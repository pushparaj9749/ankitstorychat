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
  test('CI runs the verifier on the built bundle', () => {
    const wf = read('.github/workflows/android.yml');
    expect(wf).toContain('Verify OTA wiring inside the APK');
    expect(wf).toMatch(/node scripts\/verify-apk-ota\.mjs/);
    // it must run BEFORE the artifact is uploaded, or a broken APK ships
    expect(wf.indexOf('verify-apk-ota.mjs')).toBeLessThan(wf.indexOf('Upload APK artifact'));
  });

  test('the verifier fails when the OTA url is missing from the bundle', () => {
    const tmp = path.join(__dirname, '.tmp-bundle.js');
    fs.writeFileSync(tmp, 'var x = 1; // nothing about OTA here');
    let failed = false;
    try {
      execFileSync('node', ['scripts/verify-apk-ota.mjs', tmp], { stdio: 'pipe' });
    } catch {
      failed = true;
    }
    fs.unlinkSync(tmp);
    expect(failed).toBe(true);
  });

  test('the verifier passes for a bundle that carries the app.json wiring', () => {
    const appJson = JSON.parse(read('app.json')).expo;
    const tmp = path.join(__dirname, '.tmp-bundle-ok.js');
    fs.writeFileSync(
      tmp,
      `var cfg = ${JSON.stringify({ updates: { url: appJson.updates.url, codeSigningCertificate: true } })};` +
        ` var v = "${appJson.version}";`,
    );
    expect(() =>
      execFileSync('node', ['scripts/verify-apk-ota.mjs', tmp], { stdio: 'pipe' }),
    ).not.toThrow();
    fs.unlinkSync(tmp);
  });
});

describe('a downloaded update is visible and one tap away', () => {
  test('Home shows a restart banner', () => {
    const home = code('src/screens/Home.tsx');
    expect(home).toMatch(/otaReady \?/);
    expect(home).toMatch(/applyOtaUpdate/);
    expect(home).toMatch(/otaBanner/);
  });

  test('context exposes otaReady + applyOtaUpdate and mirrors the launch check', () => {
    const ctx = code('src/state/AppContext.tsx');
    expect(ctx).toMatch(/otaReady/);
    expect(ctx).toMatch(/applyOtaUpdate/);
    expect(ctx).toMatch(/lastOtaCheck\(\)/);
    expect(ctx).toMatch(/restartToApply/);
  });

  test('the launch check no longer waits 20s', () => {
    const ota = code('src/lib/ota.ts');
    expect(ota).toMatch(/scheduleOtaCheck\(delayMs = 2_000\)/);
    expect(ota).not.toMatch(/20_000/);
  });
});
