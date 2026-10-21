/**
 * Owner rule: there is NO offline story mode. Every story reply comes from
 * the reader's own AI provider, and story content is always streamed from the
 * story API. This guards against the old scripted "Offline Story Mode"
 * (and its story downloader) creeping back into the app or its texts.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx|js)$/.test(name)) out.push(p);
  }
  return out;
}

const APP = [...files(join(ROOT, 'src')), join(ROOT, 'App.tsx')].map((p) => ({
  path: p.replace(ROOT + '/', ''),
  text: readFileSync(p, 'utf8'),
}));

const BANNED: RegExp[] = [
  /offline\s*story\s*mode/i,
  /offline\s*(story\s*)?play(back)?\s*(works|available|mode)/i,
  /offlineEngine|offlineStep|offlineOpening|offlineChoose|toOfflineLines/,
  /mode:\s*'offline'/,
  /'ai'\s*\|\s*'offline'/,
  /offline available/i,
  /keep working offline/i,
  /downloadStory\s*\(/,
];

test('the offline storyteller is gone', () => {
  expect(existsSync(join(ROOT, 'src', 'lib', 'offlineEngine.ts'))).toBe(false);
});

test('no offline story mode in app code, UI text or legal text', () => {
  const hits: string[] = [];
  for (const f of APP) {
    for (const re of BANNED) if (re.test(f.text)) hits.push(`${f.path}: ${re}`);
  }
  expect(hits).toEqual([]);
});

test('a journey is always AI', () => {
  const types = readFileSync(join(ROOT, 'src', 'types.ts'), 'utf8');
  expect(types).toMatch(/mode: 'ai';/);
});

test('starting a story without AI asks for AI setup (no scripted fallback)', () => {
  for (const p of ['src/screens/StoryDetail.tsx', 'src/ui/classic/StoryDetail.tsx']) {
    const src = readFileSync(join(ROOT, p), 'utf8');
    expect(src).toMatch(/if \(!canUseAI\) \{[\s\S]*?AIAddons[\s\S]*?return;/);
    expect(src).toContain('openingMessages(bundle, pn)');
  }
});
