/**
 * The build stamp is the anti-guesswork device.
 *
 * A redesigned screen was reported "still the same" repeatedly because a
 * screenshot cannot say which build drew it. The stamp puts the APK version on
 * screen, so the next report is verifiable instead of anecdotal.
 */
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('build stamp', () => {
  test('appVersion exports a stamp built from the native app version', () => {
    const src = code('src/lib/appVersion.ts');
    expect(src).toMatch(/export function buildStamp\(\)/);
    expect(src).toMatch(/nativeBuildVersion/);
  });

  test('the login screen shows it, so a screenshot identifies the build', () => {
    const login = code('src/screens/Login.tsx');
    expect(login).toMatch(/buildStamp/);
    expect(login).toMatch(/\{stamp\}/);
  });

  test('Settings and About show the same stamp', () => {
    for (const f of ['src/screens/Settings.tsx', 'src/screens/About.tsx']) {
      const src = code(f);
      expect({ f, hit: /buildStamp/.test(src) }).toEqual({ f, hit: true });
    }
  });
});
