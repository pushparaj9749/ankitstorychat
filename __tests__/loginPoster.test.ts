/**
 * v2.17.0 — the poster front door.
 *
 * The form used to float on an empty dark screen. It now sits on a bundled
 * poster, which is a layout change with real risks: a remote image would not
 * paint offline, the form could become unreadable over bright artwork, and the
 * 22px-input regression must not sneak back in through a rewrite.
 */
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('poster front door', () => {
  test('the poster is a bundled asset, not a URL', () => {
    const brand = code('src/components/brand.ts');
    expect(brand).toMatch(/LOGIN_POSTER = require\('\.\.\/\.\.\/assets\/login-poster\.jpg'\)/);
    expect(brand).not.toMatch(/LOGIN_POSTER[\s\S]{0,80}https?:\/\//);
    const bytes = fs.statSync(path.join(__dirname, '..', 'assets', 'login-poster.jpg')).size;
    // A full-bleed poster that bloats the APK is a bad trade; keep it lean.
    expect(bytes).toBeGreaterThan(80_000);
    expect(bytes).toBeLessThan(900_000);
  });

  test('the form is on a scrimmed panel so text stays readable over artwork', () => {
    const login = code('src/screens/Login.tsx');
    expect(login).toMatch(/ImageBackground/);
    expect(login).toMatch(/scrimTop/);
    expect(login).toMatch(/scrimBottom/);
    expect(login).toMatch(/panel:/);
    // the panel must be a real surface, not transparent over a bright photo
    expect(login).toMatch(/rgba\(10, 11, 16, 0\.82\)/);
  });

  test('the input fix survives the rebuild', () => {
    const login = code('src/screens/Login.tsx');
    // still the shared Field, never a raw TextInput with a guessed height
    expect(login).not.toMatch(/<TextInput\s*\n/);
    expect(login.match(/<Field/g)?.length).toBeGreaterThanOrEqual(3);
    expect(login).not.toMatch(/height:\s*(SCALE|TYPE|FONTS)\./);
  });

  test('signup keeps all three fields and the reveal toggle', () => {
    const login = code('src/screens/Login.tsx');
    expect(login).toMatch(/label="Username"/);
    expect(login).toMatch(/label="Password"/);
    expect(login).toMatch(/label="Password dobara"/);
    expect(login).toMatch(/secret=\{\{/);
  });

  test('the form is NOT inside a ScrollView (keyboard regression)', () => {
    // v2.17.0 wrapped the Fields in an inner ScrollView (formScroll,
    // maxHeight 320). On Android a ScrollView intercepts the touch, the
    // TextInput never focuses, and the keyboard never opens — new users
    // could not type their username at all. The form must be a plain View.
    const login = code('src/screens/Login.tsx');
    expect(login).not.toMatch(/formScroll/);
    // exactly one ScrollView in the front door (the hero), none around Fields
    const frontDoor = login.slice(login.indexOf('<ImageBackground'));
    expect(frontDoor.length).toBeGreaterThan(100);
    expect(frontDoor.length).toBeGreaterThan(100);
    expect(frontDoor.match(/<ScrollView/g)?.length).toBe(1);
    expect(frontDoor).toMatch(/<View style=\{styles\.form\}>/);
    // and the panel lifts above the keyboard on Android too
    expect(frontDoor).toMatch(/behavior="padding"/);
  });

  test('the build stamp is still printed for screenshot evidence', () => {
    const login = code('src/screens/Login.tsx');
    expect(login).toMatch(/buildStamp/);
    expect(login).toMatch(/\{stamp\}/);
  });
});
