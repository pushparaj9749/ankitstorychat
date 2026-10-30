/**
 * Owner's download counter: website/downloads.html (+ downloads.js) and the
 * Termux `kd` command. Both add up public GitHub APK download counts of every
 * release — no backend, no token, no user data.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { summarize } = require('../website/downloads.js') as {
  summarize: (r: unknown[]) => { total: number; versions: { tag: string; date: string; downloads: number }[] };
};
const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('summarize()', () => {
  const apk = (name: string, n: number) => ({ name, download_count: n });
  const releases = [
    { tag_name: 'v2.11.1', published_at: '2026-10-24T00:00:00Z', assets: [apk('kissa-v2.11.1.apk', 2)] },
    { tag_name: 'v2.12.0', published_at: '2026-10-27T00:00:00Z', assets: [apk('kissa-v2.12.0.apk', 4), apk('notes.txt', 50)] },
    { tag_name: 'v1.0.6', draft: true, published_at: null, assets: [apk('kissa-v1.0.6.apk', 9)] },
    { tag_name: 'diag-big-1', published_at: '2026-10-01T00:00:00Z', assets: [{ name: 'big.bin', download_count: 7 }] },
    { tag_name: 'v1.0.0', published_at: '2026-09-01T00:00:00Z', assets: [apk('Kissa-v1.0.0.APK', 7), apk('kissa-arm64.apk', 1)] },
  ];

  test('adds every APK of every published release, any version', () => {
    expect(summarize(releases).total).toBe(2 + 4 + 7 + 1);
  });

  test('ignores drafts, non-APK files and releases without an APK', () => {
    const tags = summarize(releases).versions.map((v) => v.tag);
    expect(tags).not.toContain('v1.0.6');
    expect(tags).not.toContain('diag-big-1');
  });

  test('lists versions newest first with their own counts', () => {
    expect(summarize(releases).versions).toEqual([
      { tag: 'v2.12.0', date: '2026-10-27T00:00:00Z', downloads: 4 },
      { tag: 'v2.11.1', date: '2026-10-24T00:00:00Z', downloads: 2 },
      { tag: 'v1.0.0', date: '2026-09-01T00:00:00Z', downloads: 8 },
    ]);
  });

  test('survives empty or broken input', () => {
    expect(summarize([])).toEqual({ total: 0, versions: [] });
    expect(summarize(undefined as unknown as unknown[])).toEqual({ total: 0, versions: [] });
  });
});

describe('downloads page', () => {
  const html = read('website/downloads.html');
  const js = read('website/downloads.js');

  test('is kept out of search engines and not linked from the site', () => {
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    expect(read('website/index.html')).not.toMatch(/downloads\.html/);
  });

  test('has every element the script fills in', () => {
    for (const id of ['total', 'latest', 'status', 'count', 'refresh', 'rows', 'updated']) {
      expect(js).toContain(`el('${id}')`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toMatch(/<script src="downloads\.js"><\/script>/);
  });

  test('reads only the public GitHub releases API, with no token', () => {
    expect(js).toContain('https://api.github.com/repos/pushparaj9749/ankitstorychat/releases?per_page=100');
    expect(js).not.toMatch(/Authorization|Bearer|ghp_|github_pat_/);
  });
});

describe('Termux kd command', () => {
  const sh = read('docs/admin/termux-setup.sh');

  test('is installed alongside kp, kacc and krej', () => {
    expect(sh).toContain('> "$BIN/kd"');
    expect(sh).toContain('chmod +x "$BIN/kp" "$BIN/kacc" "$BIN/krej" "$BIN/kd"');
    expect(sh).toMatch(/Commands ready: kp, kacc, krej, kd/);
  });

  test('kd needs no admin token and counts only APKs', () => {
    const kd = sh.slice(sh.indexOf('# ---------- kd'), sh.indexOf('> "$BIN/kd"'));
    expect(kd).not.toMatch(/kissa_token|Authorization/);
    expect(kd).toContain('api.github.com/repos/pushparaj9749/ankitstorychat/releases');
    expect(kd).toContain('test("\\\\.apk$"; "i")');
  });
});
