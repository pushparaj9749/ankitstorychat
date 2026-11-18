#!/usr/bin/env node
/**
 * Guard: the site's Download button target must be a real, downloadable APK.
 *
 * Fetches the repo's release list, picks the newest published `v*.*.*` release
 * that actually carries a GitHub-hosted `.apk` (same rule as
 * `website/app.js` → pickApkRelease), then HEAD-checks that download URL and
 * asserts it resolves to a file rather than an HTML page.
 *
 * Why it exists: an edit/clip-pack release published after the app took the
 * `/releases/latest` slot once, so "Download APK" opened a page of video ZIPs.
 *
 * Usage: node scripts/check-live-apk.mjs [--repo owner/name] [--json]
 * Exit codes: 0 ok · 1 no usable APK / bad link
 */
const args = process.argv.slice(2);
const argVal = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const REPO = argVal('--repo', 'pushparaj9749/ankitstorychat');
const AS_JSON = args.includes('--json');

const semver = (tag) => {
  const m = String(tag || '').match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const newer = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

function pick(list) {
  let best = null;
  for (const rel of Array.isArray(list) ? list : []) {
    if (!rel || rel.draft || rel.prerelease) continue;
    const key = semver(rel.tag_name);
    if (!key) continue;
    const apk = (rel.assets || []).find(
      (a) =>
        a &&
        /\.apk$/i.test(a.name || '') &&
        typeof a.browser_download_url === 'string' &&
        a.browser_download_url.startsWith('https://github.com/'),
    );
    if (!apk) continue;
    if (!best || newer(key, best.key)) best = { key, tag: rel.tag_name, apk };
  }
  return best;
}

const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=40`, {
  headers: {
    Accept: 'application/vnd.github+json',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  },
});

if (!res.ok) {
  console.error(`::error title=Release list unavailable::HTTP ${res.status} from GitHub`);
  process.exit(1);
}

const hit = pick(await res.json());
if (!hit) {
  console.error('::error title=No APK release::No published v*.*.* release has a .apk asset');
  process.exit(1);
}

const head = await fetch(hit.apk.browser_download_url, { method: 'HEAD', redirect: 'follow' });
const type = head.headers.get('content-type') || '';
const len = Number(head.headers.get('content-length') || hit.apk.size || 0);
const ok = head.ok && len > 1_000_000 && !/text\/html/i.test(type);

const report = {
  repo: REPO,
  tag: hit.tag,
  asset: hit.apk.name,
  url: hit.apk.browser_download_url,
  httpStatus: head.status,
  contentType: type,
  bytes: len,
  ok,
};

if (AS_JSON) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`APK release : ${report.tag} (${report.asset})`);
  console.log(`Download    : ${report.url}`);
  console.log(`HEAD        : HTTP ${report.httpStatus} · ${type || 'no content-type'} · ${(len / 1048576).toFixed(1)} MB`);
}

if (!ok) {
  console.error('::error title=Download link is not an APK::The picked release asset did not resolve to a binary download');
  process.exit(1);
}
console.log('::notice title=Download APK verified::Newest app release resolves to a real APK download');
