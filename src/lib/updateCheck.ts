/**
 * "Naya version aaya hai" — new-app-version check.
 *
 * Privacy: this only READS the public release list of the Kissa GitHub
 * repository (version numbers + APK links). Nothing about the user, the phone
 * or the stories is sent — it's a plain anonymous GET, the same as opening the
 * releases page in a browser.
 *
 * v2.13.1: the app no longer trusts `/releases/latest`. That endpoint returns
 * the newest *published* release of any kind, so an edit/clip-pack release
 * published after the last APK takes the slot — its tag is not a version, so
 * the banner silently never appeared. The list is read instead and the newest
 * published `vX.Y.Z` release that actually ships an APK wins.
 *
 * v2.9.5: the banner shows up ON ITS OWN. The answer used to be cached for
 * 6 hours, so a release published inside that window never surfaced until
 * the user pressed "Check now". Now a fresh check runs at most every 15
 * minutes (well inside GitHub's 60/hour anonymous limit), on launch and
 * whenever the app comes back to the foreground, and every result — auto or
 * manual — is broadcast to the Home banner straight away.
 */
import Constants from 'expo-constants';
import { installedAppVersion } from './appVersion';
import { kvGet, kvSet } from './db';

export const RELEASES_API =
  'https://api.github.com/repos/pushparaj9749/ankitstorychat/releases?per_page=40';
import { RELEASES_PAGE } from './links';
export { RELEASES_PAGE };

const CACHE_KEY = 'update.latest';
const DISMISS_KEY = 'update.dismissed';
/** Re-ask GitHub at most this often; between checks the last answer is reused. */
export const RECHECK_MS = 15 * 60 * 1000;
const TIMEOUT_MS = 8000;

export interface ReleaseInfo {
  /** "2.9.0" (no leading v). */
  version: string;
  tag: string;
  /** Direct .apk download, or the release page if no APK is attached. */
  downloadUrl: string;
  pageUrl: string;
  /** First few lines of the release notes (plain text). */
  notes: string;
}

export interface UpdateStatus {
  current: string;
  latest: ReleaseInfo | null;
  available: boolean;
}

/** Parse "v2.10.1" / "2.10" / "2.9.0-beta" → [2, 10, 1]; null when not a version. */
export function parseVersion(v: string | null | undefined): number[] | null {
  const m = String(v ?? '').trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/** -1 if a < b, 0 if equal, 1 if a > b (unparseable sorts lowest). */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return pa ? 1 : pb ? -1 : 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
  }
  return 0;
}

function cleanNotes(body: unknown): string {
  if (typeof body !== 'string') return '';
  return body
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/^\s*[-*]\s+/, '• ').trim())
    .filter(Boolean)
    .slice(0, 6)
    .join('\n')
    .slice(0, 400);
}

/** Pick the useful bits out of a GitHub "release" JSON object. */
export function parseRelease(json: unknown): ReleaseInfo | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as Record<string, unknown>;
  if (r.draft || r.prerelease) return null;
  const tag = typeof r.tag_name === 'string' ? r.tag_name : '';
  const parsed = parseVersion(tag);
  if (!parsed) return null;
  const pageUrl = typeof r.html_url === 'string' && r.html_url.startsWith('https://github.com/') ? r.html_url : RELEASES_PAGE;
  const assets = Array.isArray(r.assets) ? (r.assets as Record<string, unknown>[]) : [];
  const apk = assets.find(
    (a) =>
      typeof a?.name === 'string' &&
      a.name.toLowerCase().endsWith('.apk') &&
      typeof a.browser_download_url === 'string' &&
      a.browser_download_url.startsWith('https://github.com/'),
  );
  return {
    version: parsed.join('.'),
    tag,
    downloadUrl: apk ? String(apk.browser_download_url) : pageUrl,
    pageUrl,
    notes: cleanNotes(r.body),
  };
}

/**
 * Pick the release the update banner should talk about.
 *
 * Rules (same as the website's download button):
 *  - published only: no drafts, no prereleases
 *  - app tags only: `vX.Y.Z` (clip/edit packs use names like
 *    `jomm-melatonin-2026-11-04`, which are not versions)
 *  - prefer the newest one that actually carries a `.apk` asset; if none has
 *    one, still report the newest version so the banner can link the page
 *  - a `.apk` URL must point at github.com
 */
export function pickLatestRelease(list: unknown): ReleaseInfo | null {
  if (!Array.isArray(list)) return null;
  let bestWithApk: { info: ReleaseInfo; key: number[] } | null = null;
  let bestAny: { info: ReleaseInfo; key: number[] } | null = null;
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (r.draft || r.prerelease) continue;
    const tag = typeof r.tag_name === 'string' ? r.tag_name : '';
    if (!/^v?\d+\.\d+\.\d+$/.test(tag)) continue;
    const info = parseRelease(raw);
    if (!info) continue;
    const key = parseVersion(info.version);
    if (!key) continue;
    if (!bestAny || compareVersions(info.version, bestAny.info.version) > 0) {
      bestAny = { info, key };
    }
    const apk = info.downloadUrl.toLowerCase().endsWith('.apk');
    if (apk && (!bestWithApk || compareVersions(info.version, bestWithApk.info.version) > 0)) {
      bestWithApk = { info, key };
    }
  }
  return bestWithApk?.info ?? bestAny?.info ?? null;
}

export function currentAppVersion(): string {
  // Native APK version, not the running OTA manifest's version.
  return installedAppVersion();
}

/** `ok: false` = GitHub unreachable / rate-limited (don't cache that). */
async function fetchLatest(fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; info: ReleaseInfo | null }> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(RELEASES_API, {
      method: 'GET',
      headers: { Accept: 'application/vnd.github+json' },
      signal: ctrl?.signal,
    });
    if (!res.ok) return { ok: false, info: null };
    const json: unknown = await res.json();
    // A list when the request succeeded; parseRelease keeps single-release
    // callers (older caches, tests) working.
    return { ok: true, info: Array.isArray(json) ? pickLatestRelease(json) : parseRelease(json) };
  } catch {
    return { ok: false, info: null }; // offline / timeout
  } finally {
    clearTimeout(timer);
  }
}

type Listener = (s: UpdateStatus) => void;
const listeners = new Set<Listener>();

/** Hear every update-check result (used by the Home banner). Returns unsubscribe. */
export function onUpdateStatus(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Is a newer Kissa APK out? Reuses the last answer for 15 minutes unless `force`.
 * Never throws — offline / rate-limited simply means "no news".
 */
export async function checkForUpdate(opts: { force?: boolean; fetchImpl?: typeof fetch; now?: number } = {}): Promise<UpdateStatus> {
  const current = currentAppVersion();
  const now = opts.now ?? Date.now();
  let latest: ReleaseInfo | null = null;
  try {
    const raw = await kvGet(CACHE_KEY);
    const cached = raw ? (JSON.parse(raw) as { at: number; info: ReleaseInfo | null }) : null;
    if (!opts.force && cached && now - cached.at < RECHECK_MS) {
      latest = cached.info;
    } else {
      const r = await fetchLatest(opts.fetchImpl);
      if (r.ok) {
        latest = r.info;
        await kvSet(CACHE_KEY, JSON.stringify({ at: now, info: latest }));
      } else {
        // GitHub unreachable: keep the last good answer, and try again next time.
        latest = cached?.info ?? null;
      }
    }
  } catch {
    latest = null;
  }
  const status = { current, latest, available: !!latest && compareVersions(latest.version, current) > 0 };
  listeners.forEach((fn) => {
    try {
      fn(status);
    } catch {
      /* a listener must never break the check */
    }
  });
  return status;
}

/** "Baad mein" — hide the banner for this version only. */
export async function dismissUpdate(version: string): Promise<void> {
  await kvSet(DISMISS_KEY, version).catch(() => undefined);
}

export async function isUpdateDismissed(version: string): Promise<boolean> {
  try {
    return (await kvGet(DISMISS_KEY)) === version;
  } catch {
    return false;
  }
}
