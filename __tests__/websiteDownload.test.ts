/**
 * Regression: the website's DOWNLOAD APK button must never resolve to a
 * non-app release.
 *
 * Bug it locks down: the button used GitHub's `/releases/latest`, which is the
 * newest *published* release of any kind. An edit/clip-pack release published
 * after the last APK (e.g. a Melatonin edits pack) took that slot, so pressing
 * "Download APK" opened a page of video ZIPs instead of the app.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const app = read('website/app.js');
// code only — the comments explain the bug and may mention the old endpoint
const appCode = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const html = read('website/index.html');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pickApkRelease } = require('../website/app.js') as {
  pickApkRelease: (list: unknown) => { release: { tag_name: string }; apk: { browser_download_url: string } } | null;
};

const apk = (tag: string, size = 102_933_519) => ({
  name: `kissa-${tag}.apk`,
  size,
  browser_download_url: `https://github.com/pushparaj9749/ankitstorychat/releases/download/${tag}/kissa-${tag}.apk`,
});

const rel = (tag: string, assets: unknown[], extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  assets,
  ...extra,
});

const mediaRelease = (tag: string) =>
  rel(tag, [
    { name: 'Jomm_Melatonin_7_Anime_Clip_Pack.zip', size: 157_808_250, browser_download_url: 'https://github.com/x/y/a.zip' },
    { name: 'MOLOB_ZIP_SHA256.txt', size: 108, browser_download_url: 'https://github.com/x/y/a.txt' },
  ]);

describe('website download resolution', () => {
  test('never resolves the button from GitHub /releases/latest', () => {
    expect(appCode).not.toMatch(/releases\/latest/);
    expect(appCode).toMatch(/\/releases\?per_page=40/);
    // static fallback is the full releases list, never "latest"
    expect(html).not.toMatch(/releases\/latest/);
    for (const id of ['heroDownload', 'navDownload', 'bottomDownload']) {
      const at = html.indexOf(`id="${id}"`);
      expect(at).toBeGreaterThan(-1);
      const tag = html.slice(at, html.indexOf('>', at));
      expect(tag).toContain('href="https://github.com/pushparaj9749/ankitstorychat/releases"');
    }
  });

  test('ignores a newer clip/edit release that has no APK', () => {
    const hit = pickApkRelease([mediaRelease('jomm-melatonin-2026-11-04'), rel('v2.13.0', [apk('v2.13.0')])]);
    expect(hit!.release.tag_name).toBe('v2.13.0');
    expect(hit!.apk.browser_download_url).toMatch(/kissa-v2\.13\.0\.apk$/);
  });

  test('picks the newest APK release regardless of list order', () => {
    const hit = pickApkRelease([
      rel('v2.11.0', [apk('v2.11.0')]),
      mediaRelease('clip-packs-2026-11-02'),
      rel('v2.13.0', [apk('v2.13.0')]),
      rel('v2.12.0', [apk('v2.12.0')]),
    ]);
    expect(hit!.release.tag_name).toBe('v2.13.0');
  });

  test('skips drafts, prereleases and non-app tags', () => {
    expect(
      pickApkRelease([
        rel('v2.14.0', [apk('v2.14.0')], { draft: true }),
        rel('v2.15.0', [apk('v2.15.0')], { prerelease: true }),
        mediaRelease('jomm-melatonin-2026-11-04'),
        rel('v2.13.0', [apk('v2.13.0')]),
      ])!.release.tag_name,
    ).toBe('v2.13.0');
  });

  test('requires a real github-hosted .apk asset', () => {
    expect(pickApkRelease([rel('v2.14.0', [])])).toBeNull();
    expect(pickApkRelease([rel('v2.14.0', [{ name: 'notes.txt', browser_download_url: 'https://github.com/x/y/n.txt' }])])).toBeNull();
    expect(
      pickApkRelease([rel('v2.14.0', [{ name: 'evil.apk', browser_download_url: 'https://evil.example/evil.apk' }])]),
    ).toBeNull();
    expect(pickApkRelease([])).toBeNull();
    expect(pickApkRelease(null)).toBeNull();
    expect(pickApkRelease({ message: 'API rate limit exceeded' })).toBeNull();
  });

  test('is safe to load in Node (no DOM) so it stays unit-testable', () => {
    expect(app).toMatch(/typeof document === 'undefined'/);
    expect(app).toMatch(/module\.exports = \{ pickApkRelease/);
  });
});
