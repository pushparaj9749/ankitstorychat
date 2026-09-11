/**
 * Storage management: usage stats, clear cache, delete downloads.
 */
import { CONTENT_DIR, STORIES_DIR, cacheDirectorySafe, dirSize, listDir, remove } from './filesSafe';
import { dbUsage, listDownloads } from './db';

export interface StorageUsage {
  downloadedStories: number;
  contentBytes: number;
  dbMessages: number;
  dbMemories: number;
  dbPlaythroughs: number;
}

export async function getStorageUsage(): Promise<StorageUsage> {
  const [downloads, contentBytes, db] = await Promise.all([
    listDownloads(),
    dirSize(`${CONTENT_DIR}stories/`),
    dbUsage(),
  ]);
  void STORIES_DIR;
  return {
    downloadedStories: downloads.length,
    contentBytes,
    dbMessages: db.messages,
    dbMemories: db.memories,
    dbPlaythroughs: db.playthroughs,
  };
}

/**
 * Clear throwaway cache only: remote-manifest cache + cached covers.
 * Downloaded story JSON is KEPT (that's "Delete downloaded story" instead).
 */
export async function clearCache(): Promise<void> {
  await remove(`${CONTENT_DIR}manifest-cache.json`);
  const storyDirs = await listDir(`${CONTENT_DIR}stories/`);
  for (const d of storyDirs) {
    await remove(`${CONTENT_DIR}stories/${d}/cover.b64`);
  }
  // Temp export files in cache dir.
  const tmp = await listDir(cacheDirectorySafe());
  for (const f of tmp) {
    if (f.startsWith('kissa-backup-')) await remove(`${cacheDirectorySafe()}${f}`);
  }
}
