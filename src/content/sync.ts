/**
 * Catalog sync — fetch the remote manifest and tell the caller whether the
 * visible catalog changed, so the UI can refresh IMMEDIATELY.
 *
 * v2.10.1 fix: checkForUpdates() only wrote the fetched manifest to the
 * on-device cache; nothing re-read it, so a new OTA story appeared only on
 * the NEXT app launch. syncCatalog() compares the effective catalog before
 * and after the fetch; when it changed, the caller re-reads the story list.
 */
import type { AgeGroup, ContentManifest } from '../types';
import { filterForAge } from '../lib/ageGate';
import { checkForUpdates, getEffectiveManifest } from './loader';

export interface CatalogSyncResult {
  /** The effective catalog changed — re-read the story list now. */
  changed: boolean;
  /** Stories that are new (or got a newer version) since the previous check. */
  freshCount: number;
}

function signature(m: ContentManifest): string {
  return (
    m.stories
      .map((s) => `${s.id}@${s.version ?? 0}@${s.updatedAt ?? ''}`)
      .sort()
      .join('|') + `#${m.contentVersion}`
  );
}

export async function syncCatalog(apiBaseUrl: string, ageGroup: AgeGroup): Promise<CatalogSyncResult> {
  const before = await getEffectiveManifest();
  const res = await checkForUpdates(apiBaseUrl, ageGroup);
  const after = await getEffectiveManifest();
  const known = new Map(before.stories.map((s) => [s.id, s.version ?? 0]));
  let freshCount = 0;
  for (const s of filterForAge(res.remote.stories, ageGroup)) {
    const v = known.get(s.id);
    if (v === undefined || (s.version ?? 0) > v) freshCount++;
  }
  return { changed: signature(before) !== signature(after), freshCount };
}
