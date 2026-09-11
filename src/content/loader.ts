/**
 * Story content system.
 * - Bundled stories ship with the app (offline-first).
 * - GitHub (raw.githubusercontent.com) is the public content source for
 *   NEW / UPDATED stories. The app fetches manifest.json, compares versions,
 *   and downloads story packages as JSON — no app rebuild needed.
 * - Downloaded stories are cached on-device and validated before use.
 * - Age gating is enforced here (logic level), not just in UI.
 */
import Constants from 'expo-constants';
import type {
  AgeGroup,
  CharactersFile,
  ContentManifest,
  MemoryFile,
  ScenesFile,
  StoryBundle,
  StoryFile,
  StoryMeta,
  WorldFile,
} from '../types';
import { assertCanOpen, filterForAge } from '../lib/ageGate';
import { validateBundle, validateManifest } from '../lib/validate';
import { joinUrl } from '../lib/utils';
import {
  BUNDLED_COVERS,
  BUNDLED_MANIFEST,
  getBundledStory,
} from './bundled';
import {
  STORIES_DIR,
  CONTENT_DIR,
  docPath,
  exists,
  readJson,
  remove,
  writeText,
} from '../lib/files';
import {
  getDownloadRecord,
  listDownloads,
  recordDownload,
  removeDownloadRecord,
} from '../lib/db';

export class StoryContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryContentError';
  }
}

const MANIFEST_CACHE = `${CONTENT_DIR}manifest-cache.json`;
const FETCH_TIMEOUT_MS = 15000;

export function defaultManifestUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as { contentManifestUrl?: string };
  return (
    extra.contentManifestUrl ??
    'https://raw.githubusercontent.com/pushparaj9749/ankitstorychat/main/content/manifest.json'
  );
}

/** Derive `.../content` base from a manifest URL ending in manifest.json. */
export function contentBaseFromManifestUrl(manifestUrl: string): string {
  return manifestUrl.replace(/\/manifest\.json(\?.*)?$/, '');
}

async function fetchJsonWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new StoryContentError(`Content request failed (${res.status})`);
    return (await res.json()) as unknown;
  } catch (e) {
    if (e instanceof StoryContentError) throw e;
    if ((e as Error).name === 'AbortError') throw new StoryContentError('Content request timed out.');
    throw new StoryContentError('No internet connection. Showing downloaded stories.');
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
  if (!meta) throw new StoryContentError('Story not found.');
  assertCanOpen(meta, ageGroup);
  return meta;
}

/* ---------------- bundle loading ---------------- */

function storyFilesDir(storyId: string): string {
  return `${STORIES_DIR}${storyId}/`;
}

export async function isDownloaded(storyId: string): Promise<boolean> {
  return exists(docPath(`${storyFilesDir(storyId)}story.json`));
}

async function loadDownloadedFiles(storyId: string): Promise<{
  story: StoryFile;
  characters: CharactersFile;
  world: WorldFile;
  scenes: ScenesFile;
  memory: MemoryFile;
} | null> {
  const dir = storyFilesDir(storyId);
  const [story, characters, world, scenes, memory] = await Promise.all([
    readJson<StoryFile>(docPath(`${dir}story.json`)),
    readJson<CharactersFile>(docPath(`${dir}characters.json`)),
    readJson<WorldFile>(docPath(`${dir}world.json`)),
    readJson<ScenesFile>(docPath(`${dir}scenes.json`)),
    readJson<MemoryFile>(docPath(`${dir}memory.json`)),
  ]);
  if (!story || !characters || !world || !scenes || !memory) return null;
  return { story, characters, world, scenes, memory };
}

/**
 * Load a full validated story bundle. Throws StoryContentError or
 * AgeRestrictedError (from assertCanOpen). Never returns malformed content.
 */
export async function getBundle(storyId: string, ageGroup: AgeGroup): Promise<StoryBundle> {
  const meta = await getStoryMeta(storyId, ageGroup);

  // Prefer downloaded copy when it is at least as new as bundled.
  const downloaded = await loadDownloadedFiles(storyId);
  const bundled = getBundledStory(storyId);

  const candidates: { files: typeof downloaded; source: 'downloaded' | 'bundled' }[] = [];
  if (downloaded) candidates.push({ files: downloaded, source: 'downloaded' });
  if (bundled) candidates.push({ files: bundled, source: 'bundled' });

  let lastError = 'Story files are missing. Try downloading it again.';
  for (const c of candidates) {
    if (!c.files) continue;
    const result = validateBundle({ meta, ...c.files });
    if (result.ok) {
      return { meta, ...c.files, source: c.source };
    }
    lastError = `Story data is invalid (${result.issues[0]?.path}: ${result.issues[0]?.message}).`;
    // A corrupt download should not poison future loads — drop it.
    if (c.source === 'downloaded') {
      await removeDownloadedStory(storyId);
    }
  }
  throw new StoryContentError(lastError);
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

async function localVersionFor(storyId: string): Promise<number> {
  const dl = await getDownloadRecord(storyId);
  if (dl) return dl.version;
  const bundledMeta = BUNDLED_MANIFEST.stories.find((s) => s.id === storyId);
  return bundledMeta?.version ?? -1;
}

/**
 * Fetch the remote manifest and compare with local content.
 * Caches the remote manifest so new-story metadata survives offline.
 */
export async function checkForUpdates(
  manifestUrl: string,
  ageGroup: AgeGroup,
): Promise<UpdateCheckResult> {
  const raw = await fetchJsonWithTimeout(manifestUrl);
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

/** Download (or re-download) a story package from the content source. */
export async function downloadStory(
  meta: StoryMeta,
  manifestUrl: string,
  ageGroup: AgeGroup,
  onProgress?: (file: string, done: number, total: number) => void,
): Promise<void> {
  // Age gate enforced at the download layer too — restricted stories can
  // never be fetched, whatever the UI shows.
  assertCanOpen(meta, ageGroup);
  const base = contentBaseFromManifestUrl(manifestUrl);
  const dir = `${base}/stories/${meta.storyDir}`;
  const files = ['story.json', 'characters.json', 'world.json', 'scenes.json', 'memory.json'] as const;

  const fetched: Record<string, unknown> = {};
  let done = 0;
  for (const f of files) {
    onProgress?.(f, done, files.length);
    fetched[f] = await fetchJsonWithTimeout(joinUrl(dir, f));
    done++;
  }
  onProgress?.('done', files.length, files.length);

  const result = validateBundle({
    meta,
    story: fetched['story.json'],
    characters: fetched['characters.json'],
    world: fetched['world.json'],
    scenes: fetched['scenes.json'],
    memory: fetched['memory.json'],
  });
  if (!result.ok) {
    throw new StoryContentError(
      `Downloaded story is invalid (${result.issues[0]?.path}). The download was discarded.`,
    );
  }

  const targetDir = storyFilesDir(meta.id);
  for (const f of files) {
    await writeText(docPath(`${targetDir}${f}`), JSON.stringify(fetched[f]));
  }
  // Best-effort cover download for remote-only stories.
  if (meta.coverUrl) {
    try {
      const res = await fetch(meta.coverUrl);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        // Store as base64 alongside JSON for offline covers.
        await writeText(docPath(`${targetDir}cover.b64`), btoa(binary));
      }
    } catch {
      // Cover is optional — story works without it.
    }
  }
  await recordDownload(meta.id, meta.version, new Date().toISOString());
}

export async function removeDownloadedStory(storyId: string): Promise<void> {
  await remove(docPath(storyFilesDir(storyId)));
  await removeDownloadRecord(storyId);
}

/** True when a downloaded copy exists (used for "Downloaded" badges). */
export async function downloadedStoryIds(): Promise<Set<string>> {
  const list = await listDownloads();
  return new Set(list.map((d) => d.storyId));
}

/* ---------------- covers ---------------- */

export type CoverSource = number | { uri: string };

/** Resolve a story cover: bundled art -> downloaded art -> remote URL -> null. */
export async function getCoverSource(meta: StoryMeta): Promise<CoverSource | null> {
  if (meta.coverBundled && BUNDLED_COVERS[meta.coverBundled]) {
    return BUNDLED_COVERS[meta.coverBundled];
  }
  const b64 = await readJson<string>(docPath(`${storyFilesDir(meta.id)}cover.b64`)).catch(() => null);
  void b64;
  // cover.b64 is raw text, not JSON — read via text path:
  const { readText } = await import('../lib/files');
  const raw = await readText(docPath(`${storyFilesDir(meta.id)}cover.b64`));
  if (raw) return { uri: `data:image/png;base64,${raw}` };
  if (meta.coverUrl) return { uri: meta.coverUrl };
  return null;
}

/** Synchronous cover for bundled stories (used in lists for speed). */
export function getBundledCoverSource(meta: StoryMeta): CoverSource | null {
  if (meta.coverBundled && BUNDLED_COVERS[meta.coverBundled]) {
    return BUNDLED_COVERS[meta.coverBundled];
  }
  if (meta.coverUrl) return { uri: meta.coverUrl };
  return null;
}
