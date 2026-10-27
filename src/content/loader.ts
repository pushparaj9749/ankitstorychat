/**
 * Story content system.
 * - The story catalog (manifest) and cover art ship with the app; story
 *   packages are always streamed from the story API when a story is opened.
 * - The Kissa story API (https://beyondredeye.site/api, a Cloudflare Worker)
 *   is the content source for NEW / UPDATED stories. The app fetches the
 *   manifest, compares versions, and downloads story packages as JSON — no
 *   app rebuild needed. The private GitHub repository behind the API is never
 *   contacted by the app.
 * - Downloaded stories are cached on-device and validated before use.
 * - Age gating is enforced here (logic level), not just in UI.
 */
import type {
  AgeGroup,
  CharactersFile,
  ContentManifest,
  MemoryFile,
  ScenesFile,
  StoryBundle,
  StoryCreator,
  StoryFile,
  StoryMeta,
  WorldFile,
} from '../types';
import { KISSA_OWNER_CREATOR } from '../types';
import { assertCanOpen, filterForAge } from '../lib/ageGate';
import { validateBundle, validateManifest } from '../lib/validate';
import {
  BUNDLED_COVERS,
  BUNDLED_MANIFEST,
  getBundledStory,
} from './bundled';
import {
  coverApiUrl,
  effectiveContentApiBaseUrl,
  manifestApiUrl,
  storyFileApiUrl,
  storyPackageApiUrl,
  withFullGallery,
} from './api';
import {
  STORIES_DIR,
  CONTENT_DIR,
  docPath,
  readJson,
  remove,
  writeText,
} from '../lib/files';
import {
  getDownloadRecord,
  listDownloads,
  removeDownloadRecord,
} from '../lib/db';

// Re-exported for convenience — screens import content config from here.
export {
  contentApiUrl,
  coverApiUrl,
  DEFAULT_CONTENT_API_BASE_URL,
  defaultContentApiBaseUrl,
  effectiveContentApiBaseUrl,
  manifestApiUrl,
  mediaApiUrl,
  storyFileApiUrl,
  storyPackageApiUrl,
} from './api';

/**
 * Why a story could not be used. Callers branch on this:
 * - `missing`  → files are simply not on this device; a download will fix it.
 * - `invalid`  → files exist but are corrupt; downloading again will not help
 *                until the content source is fixed.
 * - `network`  → could not reach the content source (offline / timeout / 4xx).
 */
export type StoryContentErrorCode = 'missing' | 'invalid' | 'network' | 'notfound';

export class StoryContentError extends Error {
  readonly code: StoryContentErrorCode;

  constructor(message: string, code: StoryContentErrorCode = 'invalid') {
    super(message);
    this.name = 'StoryContentError';
    this.code = code;
  }
}

const MANIFEST_CACHE = `${CONTENT_DIR}manifest-cache.json`;
const FETCH_TIMEOUT_MS = 15000;

async function fetchJsonWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      // The API answers with clean JSON errors; map them to recoverable codes
      // so the UI can tell "try later" apart from "this story is broken".
      if (res.status === 404)
        throw new StoryContentError('Content not found (404).', 'notfound');
      if (res.status === 429 || res.status === 408 || res.status >= 500)
        throw new StoryContentError('Story service is busy. Try again in a moment.', 'network');
      throw new StoryContentError(`Content request failed (${res.status}).`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new StoryContentError('Story service returned malformed data.');
    }
  } catch (e) {
    if (e instanceof StoryContentError) throw e;
    if ((e as Error).name === 'AbortError') throw new StoryContentError('Content request timed out.');
    throw new StoryContentError('No internet connection.', 'network');
  } finally {
    clearTimeout(t);
  }
}

/* ---------------- manifest merging ---------------- */

/** Remote manifest cache (last successfully fetched). */
export async function getCachedRemoteManifest(): Promise<ContentManifest | null> {
  return readJson<ContentManifest>(docPath(MANIFEST_CACHE));
}

async function setCachedRemoteManifest(m: ContentManifest): Promise<void> {
  await writeText(docPath(MANIFEST_CACHE), JSON.stringify(m));
}

/**
 * Effective manifest = bundled stories overlaid with newer remote metadata.
 * Remote-only stories appear once their metadata is known (after a check).
 */
export async function getEffectiveManifest(): Promise<ContentManifest> {
  const cached = await getCachedRemoteManifest();
  if (!cached || !Array.isArray(cached.stories)) return BUNDLED_MANIFEST;
  const byId = new Map(BUNDLED_MANIFEST.stories.map((s) => [s.id, s]));
  for (const remote of cached.stories) {
    const local = byId.get(remote.id);
    // Remote wins only when its per-story version is newer (or story is new).
    if (!local || (remote.version ?? 0) >= (local.version ?? 0)) byId.set(remote.id, remote);
  }
  return {
    contentVersion: Math.max(BUNDLED_MANIFEST.contentVersion, cached.contentVersion ?? 0),
    minAppVersion: cached.minAppVersion ?? BUNDLED_MANIFEST.minAppVersion,
    updatedAt: cached.updatedAt ?? BUNDLED_MANIFEST.updatedAt,
    stories: [...byId.values()],
  };
}

/** All stories visible to an age group (logic-level enforcement). */
export async function listStories(ageGroup: AgeGroup): Promise<StoryMeta[]> {
  const manifest = await getEffectiveManifest();
  return filterForAge(manifest.stories, ageGroup);
}

export async function getStoryMeta(
  storyId: string,
  ageGroup: AgeGroup,
): Promise<StoryMeta> {
  const manifest = await getEffectiveManifest();
  const meta = manifest.stories.find((s) => s.id === storyId);
  if (!meta) throw new StoryContentError('Story not found.', 'notfound');
  assertCanOpen(meta, ageGroup);
  return meta;
}

/* ---------------- bundle loading ---------------- */

function storyFilesDir(storyId: string): string {
  return `${STORIES_DIR}${storyId}/`;
}

/** Resolve the effective creator for a story package. */
export function resolveCreator(meta: StoryMeta, story?: Partial<StoryFile>): StoryCreator {
  // Prefer meta.creator (manifest-level), then story.creator (package-level),
  // then fall back to the Kissa owner (Ankit). A missing creator field on
  // owner-produced stories still correctly attributes Ankit.
  const fromMeta = meta.creator;
  const fromStory = story?.creator;
  const picked: StoryCreator = fromMeta ?? fromStory ?? KISSA_OWNER_CREATOR;
  return {
    name: (picked.name && picked.name.trim()) || KISSA_OWNER_CREATOR.name,
    avatar: picked.avatar ?? null,
    verified: picked.verified === true,
  };
}

/**
 * Load a full validated story bundle — always streamed from the story API
 * (there is no offline story play). Without network `fetchJsonWithTimeout`
 * throws a `StoryContentError` with code `'network'` and the screen shows the
 * "Internet connection required" state with Retry.
 *
 * Throws `StoryContentError` (network / invalid / notfound) or
 * `AgeRestrictedError` (from assertCanOpen). Never returns malformed content.
 *
 * @param apiBaseUrl optional story API base; defaults to the app's configured
 *        base (production https://beyondredeye.site/api).
 */
export async function getBundle(
  storyId: string,
  ageGroup: AgeGroup,
  apiBaseUrl?: string,
): Promise<StoryBundle> {
  const meta = await getStoryMeta(storyId, ageGroup);

  const base = effectiveContentApiBaseUrl(apiBaseUrl);

  let story: StoryFile;
  let characters: CharactersFile;
  let world: WorldFile;
  let scenes: ScenesFile;
  let memory: MemoryFile;

  // Community stories (published from user submissions) are served as a single
  // bundle from KV; bundled/owner stories remain fetched file-by-file so we
  // keep CDN cache granularity for the large existing catalog.
  const isCommunity = meta.storyDir.startsWith('community/') || (meta as { community?: boolean }).community === true;
  if (isCommunity) {
    const pkg = (await fetchJsonWithTimeout(storyPackageApiUrl(base, meta.storyDir))) as {
      story?: unknown; characters?: unknown; world?: unknown; scenes?: unknown; memory?: unknown;
    };
    story = pkg.story as StoryFile;
    characters = (pkg.characters as CharactersFile) ?? { characters: [] };
    world = (pkg.world as WorldFile) ?? { premise: '' };
    scenes = (pkg.scenes as ScenesFile) ?? { scenes: [], endings: [] };
    memory = (pkg.memory as MemoryFile) ?? { seedMemories: [] };
  } else {
    const files = ['story.json', 'characters.json', 'world.json', 'scenes.json', 'memory.json'] as const;
    const fetched: Record<string, unknown> = {};
    for (const f of files) {
      const url = storyFileApiUrl(base, meta.storyDir, f);
      fetched[f] = await fetchJsonWithTimeout(f === 'story.json' ? withFullGallery(url) : url);
    }
    story = fetched['story.json'] as StoryFile;
    characters = fetched['characters.json'] as CharactersFile;
    world = fetched['world.json'] as WorldFile;
    scenes = fetched['scenes.json'] as ScenesFile;
    memory = fetched['memory.json'] as MemoryFile;
  }

  const result = validateBundle({ meta, story, characters, world, scenes, memory });
  if (!result.ok) {
    throw new StoryContentError(
      `Story data is invalid (${result.issues[0]?.path}: ${result.issues[0]?.message}). Try again.`,
      'invalid',
    );
  }

  return { meta, story, characters, world, scenes, memory, source: isCommunity ? 'community' : 'remote', creator: resolveCreator(meta, story) };
}

/* ---------------- updates ---------------- */

export interface UpdateCheckResult {
  /** Remote manifest that was fetched. */
  remote: ContentManifest;
  hasUpdate: boolean;
  /** Stories the device has never seen (any version). */
  newStories: StoryMeta[];
  /** Stories with a newer per-story version than local. */
  updatedStories: StoryMeta[];
  remoteContentVersion: number;
}

/**
 * Version of the story this device actually holds, or -1 when it holds none.
 *
 * Must NOT read the manifest: the manifest is compiled into the APK and lists
 * every story including the API-only ones, so consulting it reported OTA
 * stories as already installed — they never showed up as downloadable and,
 * because their files are absent, they failed to open.
 */
async function localVersionFor(storyId: string): Promise<number> {
  const dl = await getDownloadRecord(storyId);
  if (dl) return dl.version;
  if (!getBundledStory(storyId)) return -1;
  return BUNDLED_MANIFEST.stories.find((s) => s.id === storyId)?.version ?? 1;
}

/**
 * Fetch the remote manifest and compare with local content.
 * Caches the remote manifest so new-story metadata survives offline.
 *
 * @param apiBaseUrl story API base (e.g. https://beyondredeye.site/api) —
 *        see src/content/api.ts. GitHub is never contacted directly.
 */
export async function checkForUpdates(
  apiBaseUrl: string,
  ageGroup: AgeGroup,
): Promise<UpdateCheckResult> {
  const raw = await fetchJsonWithTimeout(manifestApiUrl(effectiveContentApiBaseUrl(apiBaseUrl)));
  const validation = validateManifest(raw);
  if (!validation.ok) {
    throw new StoryContentError(
      `Content index is invalid (${validation.issues[0]?.path}). Try again later.`,
    );
  }
  const remote = raw as ContentManifest;
  await setCachedRemoteManifest(remote);

  const visible = filterForAge(remote.stories, ageGroup);
  const newStories: StoryMeta[] = [];
  const updatedStories: StoryMeta[] = [];
  for (const meta of visible) {
    const local = await localVersionFor(meta.id);
    if (local < 0) newStories.push(meta);
    else if (meta.version > local) updatedStories.push(meta);
  }
  return {
    remote,
    hasUpdate: newStories.length > 0 || updatedStories.length > 0,
    newStories,
    updatedStories,
    remoteContentVersion: remote.contentVersion,
  };
}

/** Delete leftover package files an older app version downloaded. */
export async function removeDownloadedStory(storyId: string): Promise<void> {
  await remove(docPath(storyFilesDir(storyId)));
  await removeDownloadRecord(storyId);
}

/** Story ids with leftover package files from older app versions (Storage cleanup). */
export async function downloadedStoryIds(): Promise<Set<string>> {
  const list = await listDownloads();
  return new Set(list.map((d) => d.storyId));
}

/* ---------------- covers ---------------- */

export type CoverSource = number | { uri: string };

/**
 * Resolve a story cover: bundled art -> downloaded art -> API URL -> null.
 * @param apiBaseUrl base for relative manifest coverUrl paths (default: prod).
 */
export async function getCoverSource(
  meta: StoryMeta,
  apiBaseUrl?: string,
): Promise<CoverSource | null> {
  if (meta.coverBundled && BUNDLED_COVERS[meta.coverBundled]) {
    return BUNDLED_COVERS[meta.coverBundled];
  }
  const b64 = await readJson<string>(docPath(`${storyFilesDir(meta.id)}cover.b64`)).catch(() => null);
  void b64;
  // cover.b64 is raw text, not JSON — read via text path:
  const { readText } = await import('../lib/files');
  const raw = await readText(docPath(`${storyFilesDir(meta.id)}cover.b64`));
  if (raw) return { uri: `data:image/png;base64,${raw}` };
  if (meta.coverUrl) {
    return { uri: coverApiUrl(effectiveContentApiBaseUrl(apiBaseUrl), meta.coverUrl) };
  }
  return null;
}

/**
 * Synchronous cover for bundled stories (used in lists for speed).
 * @param apiBaseUrl base for relative manifest coverUrl paths (default: prod).
 */
export function getBundledCoverSource(meta: StoryMeta, apiBaseUrl?: string): CoverSource | null {
  if (meta.coverBundled && BUNDLED_COVERS[meta.coverBundled]) {
    return BUNDLED_COVERS[meta.coverBundled];
  }
  if (meta.coverUrl) {
    return { uri: coverApiUrl(effectiveContentApiBaseUrl(apiBaseUrl), meta.coverUrl) };
  }
  return null;
}
