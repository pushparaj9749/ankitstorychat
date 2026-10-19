/**
 * Product rule (owner): stories have NO length and NOTHING is shown as a
 * percentage — no "N min", no Duration, no progress ring/bar, no bond %.
 * Guards every UI file (both templates) so it can't creep back in.
 */
import fs from 'fs';
import path from 'path';

const UI_DIRS = ['src/screens', 'src/components', 'src/ui'];

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const all = UI_DIRS.flatMap(files).map((f) => ({ f, src: fs.readFileSync(f, 'utf8') }));

test('no story length / duration anywhere in the UI', () => {
  for (const { f, src } of all) {
    expect({ f, hit: /estimatedMinutes|['"`>]\s*Duration\b|\d\s*MIN\b|\} min\b/.test(src) }).toEqual({ f, hit: false });
  }
});

test('no percentage shown to the reader', () => {
  for (const { f, src } of all) {
    // `}%` right after a JSX/template expression = a number rendered with %
    const shown = /\}%<\/Text>|\}%\s*<\/Text>|\}% complete|\}%`\}/.test(src) || /\{\w+\}%</.test(src);
    expect({ f, shown }).toEqual({ f, shown: false });
  }
});

test('progress widgets are gone', () => {
  expect(fs.existsSync('src/components/ProgressRing.tsx')).toBe(false);
  for (const { f, src } of all) expect({ f, hit: /ProgressRing|ProgressBar/.test(src) }).toEqual({ f, hit: false });
});
