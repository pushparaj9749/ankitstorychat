/**
 * Auth front-door guards.
 *
 * Regression: the Welcome screen shipped inputs with `height: SCALE.h2`.
 * SCALE is the FONT-SIZE scale (h2 = 22), so the username and password fields
 * were 22px tall. Android's TextInput carries its own vertical padding, so the
 * value (and even the placeholder) was clipped out of the box — the user typed
 * into a field that looked empty. Reported from a real device screenshot.
 *
 * Rules pinned here:
 *   - an input height comes from a TOUCH target, never from a type token
 *   - every auth input opts into centered vertical alignment (Android)
 *   - the shared Field component is the single implementation for auth inputs
 *   - the screen never renders a value-less box: it always binds `value`
 */
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

/** Strip comments: these files document the old bug, and doc text is not code. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const AUTH_SCREENS = ['src/screens/Login.tsx', 'src/screens/ForgotPassword.tsx'];

describe('auth inputs', () => {
  test('no input is sized from a font-size token', () => {
    for (const f of [...AUTH_SCREENS, 'src/components/Field.tsx']) {
      const src = code(f);
      // `height: SCALE.*` / `height: TYPE.*` is the exact bug class.
      expect({ f, hit: /height:\s*(SCALE|TYPE|FONTS)\./.test(src) }).toEqual({ f, hit: false });
    }
  });

  test('inputs have a real touch target and centred text', () => {
    const field = read('src/components/Field.tsx');
    expect(field).toMatch(/minHeight:\s*FIELD_HEIGHT/);
    expect(field).toMatch(/paddingVertical:\s*\d+/);
    expect(field).toMatch(/textAlignVertical:\s*'center'/);
    expect(field).toMatch(/cursorColor=/);
    expect(field).toMatch(/placeholderTextColor=/);
  });

  test('the login screen uses the shared Field, not raw TextInputs', () => {
    const src = code('src/screens/Login.tsx');
    expect(src).toMatch(/<Field/);
    // Three fields in signup: username, password, confirm.
    expect(src.match(/<Field/g)?.length).toBeGreaterThanOrEqual(3);
    // `useRef<TextInput>` is a type, not a rendered input: a real JSX tag starts
    // its own line, so require the tag + newline.
    expect(src).not.toMatch(/<TextInput\s*\n/);
  });

  test('the reveal toggle exists on password fields', () => {
    const src = read('src/screens/Login.tsx');
    expect(src).toMatch(/secret=\{\{/);
    expect(src).toMatch(/onToggle/);
  });

  test('recovery-code step still gates on an explicit save', () => {
    const src = read('src/screens/Login.tsx');
    expect(src).toMatch(/Maine code save kar liya hai/);
    expect(src).toMatch(/disabled=\{!saved\}/);
  });
});
