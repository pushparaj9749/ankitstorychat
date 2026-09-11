/**
 * Device file helpers for downloaded-story cache (expo-file-system legacy API).
 * All paths stay inside the app sandbox (documentDirectory).
 */
import {
  cacheDirectory,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  readDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

export const CONTENT_DIR = 'kissa-content/';
export const STORIES_DIR = `${CONTENT_DIR}stories/`;

function join(...parts: string[]): string {
  return parts.join('').replace(/([^:])\/\/+/g, '$1/');
}

export function docPath(...parts: string[]): string {
  return join(documentDirectory ?? '', ...parts);
}

export function cachePath(...parts: string[]): string {
  return join(cacheDirectory ?? '', ...parts);
}

export async function exists(uri: string): Promise<boolean> {
  try {
    const info = await getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

export async function ensureDir(uri: string): Promise<void> {
  try {
    await makeDirectoryAsync(uri, { intermediates: true });
  } catch {
    // Already exists — fine.
  }
}

export async function writeText(uri: string, text: string): Promise<void> {
  const parent = uri.slice(0, uri.lastIndexOf('/') + 1);
  await ensureDir(parent);
  await writeAsStringAsync(uri, text, { encoding: 'utf8' });
}

export async function readText(uri: string): Promise<string | null> {
  try {
    return await readAsStringAsync(uri, { encoding: 'utf8' });
  } catch {
    return null;
  }
}

export async function readJson<T>(uri: string): Promise<T | null> {
  const raw = await readText(uri);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function remove(uri: string): Promise<void> {
  try {
    await deleteAsync(uri, { idempotent: true });
  } catch {
    // Already gone — fine.
  }
}

/** Recursively compute directory size in bytes. */
export async function dirSize(uri: string): Promise<number> {
  try {
    const info = await getInfoAsync(uri);
    if (!info.exists) return 0;
    if (!info.isDirectory) return info.size ?? 0;
    const children = await readDirectoryAsync(uri);
    let total = 0;
    for (const child of children) {
      total += await dirSize(join(uri.endsWith('/') ? uri : `${uri}/`, child));
    }
    return total;
  } catch {
    return 0;
  }
}

export async function fileSize(uri: string): Promise<number> {
  try {
    const info = await getInfoAsync(uri);
    return info.exists && !info.isDirectory ? info.size ?? 0 : 0;
  } catch {
    return 0;
  }
}

export async function listDir(uri: string): Promise<string[]> {
  try {
    return await readDirectoryAsync(uri);
  } catch {
    return [];
  }
}
