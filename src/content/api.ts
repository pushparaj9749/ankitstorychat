/**
 * Kissa story content API — the ONE place that knows where stories come from.
 *
 * All story delivery goes through the Cloudflare Worker at
 * https://beyondredeye.site/api (see worker/). The app never talks to GitHub:
 * the repository is the private story SOURCE and is only read by the
 * deployment pipeline (GitHub Actions), never by clients.
 *
 * The base URL is configurable in exactly one place:
 *   - `extra.KISSA_CONTENT_API_BASE_URL` in app.json (Expo config), or
 *   - a user override in local settings (contentApiBaseUrl).
 * Relative paths inside the manifest (e.g. coverUrl) resolve against this base.
 */
import Constants from 'expo-constants';
import { joinUrl } from '../lib/utils';

/** Production story API. */
export const DEFAULT_CONTENT_API_BASE_URL = 'https://beyondredeye.site/api';

/** app.json `extra` key that can override the API base (build-time config). */
export const CONTENT_API_BASE_URL_ENV_KEY = 'KISSA_CONTENT_API_BASE_URL';

/** Default base from the Expo config (app.json extra), with prod fallback. */
export function defaultContentApiBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const v = extra[CONTENT_API_BASE_URL_ENV_KEY];
  return typeof v === 'string' && v.trim() ? v.trim().replace(/\/+$/, '') : DEFAULT_CONTENT_API_BASE_URL;
}

/** Settings override (if set) or the default base. */
export function effectiveContentApiBaseUrl(override?: string | null): string {
  const v = (override ?? '').trim();
  return v ? v.replace(/\/+$/, '') : defaultContentApiBaseUrl();
}

/**
 * Resolve a content path against the API base. Absolute URLs (legacy
 * manifests) pass through untouched, so old cached manifests keep working.
 */
export function contentApiUrl(base: string, path: string): string {
  const p = (path ?? '').trim();
  if (/^https?:\/\//i.test(p)) return p;
  return joinUrl(base, p);
}

/** GET <base>/manifest */
export function manifestApiUrl(base: string): string {
  return contentApiUrl(base, 'manifest');
}

/** GET <base>/stories/<storyDir>/<file> */
export function storyFileApiUrl(base: string, storyDir: string, file: string): string {
  return contentApiUrl(base, `stories/${storyDir}/${file}`);
}

/** Resolve a manifest coverUrl (may be a relative API path) for display/fetch. */
export function coverApiUrl(base: string, coverUrl: string): string {
  return contentApiUrl(base, coverUrl);
}
