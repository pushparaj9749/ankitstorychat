/**
 * "Naya version aaya hai" — new-app-version check.
 *
 * Privacy: this only READS the public "latest release" page of the Kissa
 * GitHub repository (version number + APK link). Nothing about the user, the
 * phone or the stories is sent — it's a plain anonymous GET, the same as
 * opening the releases page in a browser. Result is cached for 6 hours.
 */
import Constants from 'expo-constants';
import { kvGet, kvSet } from './db';

export const RELEASES_API = 'https://api.github.com/repos/pushparaj9749/ankitstorychat/releases/latest';
export const RELEASES_PAGE = 'https://github.com/pushparaj9749/ankitstorychat/releases/latest';

const CACHE_KEY = 'update.latest';
const DISMISS_KEY = 'update.dismissed';
const CACHE_MS = 6 * 60 * 60 * 1000;
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

export function currentAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
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
    return { ok: true, info: parseRelease(await res.json()) };
  } catch {
    return { ok: false, info: null }; // offline / timeout
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Is a newer Kissa APK out? Uses the 6-hour cache unless `force`.
 * Never throws — offline / rate-limited simply means "no news".
 */
export async function checkForUpdate(opts: { force?: boolean; fetchImpl?: typeof fetch; now?: number } = {}): Promise<UpdateStatus> {
  const current = currentAppVersion();
  const now = opts.now ?? Date.now();
  let latest: ReleaseInfo | null = null;
  try {
    const raw = await kvGet(CACHE_KEY);
    const cached = raw ? (JSON.parse(raw) as { at: number; info: ReleaseInfo | null }) : null;
    if (!opts.force && cached && now - cached.at < CACHE_MS) {
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
  return { current, latest, available: !!latest && compareVersions(latest.version, current) > 0 };
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
