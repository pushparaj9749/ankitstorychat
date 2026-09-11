/**
 * Absolute-path convenience wrappers over files.ts (which uses relative segments).
 * Kept separate to avoid circulars; storage.ts combines both.
 */
import { cacheDirectory } from 'expo-file-system/legacy';
import { CONTENT_DIR as REL_CONTENT, STORIES_DIR as REL_STORIES, dirSize as relDirSize, docPath, listDir as relListDir, remove as relRemove } from './files';

export const CONTENT_DIR = docPath(REL_CONTENT);
export const STORIES_DIR = docPath(REL_STORIES);

export function cacheDirectorySafe(): string {
  return cacheDirectory ?? '';
}

export async function dirSize(absUri: string): Promise<number> {
  return relDirSize(absUri);
}

export async function listDir(absUri: string): Promise<string[]> {
  return relListDir(absUri);
}

export async function remove(absUri: string): Promise<void> {
  return relRemove(absUri);
}
