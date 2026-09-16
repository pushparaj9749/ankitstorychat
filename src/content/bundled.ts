/**
 * Bundled (shipped-with-the-app) story CATALOG + cover art.
 *
 * V2 change: the story *packages* (story/scenes/world/characters/memory JSON)
 * are NO LONGER compiled into the APK. Only the content manifest (so the app
 * can list every story) and the cover art ship with the binary. All playable
 * story content is streamed from the story API at play time (see loader.ts),
 * which is what removes offline story playback while keeping the catalog and
 * OTA content updates working without a new APK.
 *
 * The private story-source repository is still only read by the deployment
 * pipeline (GitHub Actions) — clients never contact GitHub.
 */
import type {
  CharactersFile,
  ContentManifest,
  MemoryFile,
  ScenesFile,
  StoryFile,
  WorldFile,
} from '../types';

import manifestJson from '../../content/manifest.json';

import coverMidnight from '../../assets/covers/midnight-local.jpg';
import coverCafeQueen from '../../assets/covers/cafe-queen-myra.jpg';
import coverYodha from '../../assets/covers/aakhri-yodha.jpg';
import coverChai from '../../assets/covers/chai-dreams.jpg';
import coverVikrant from '../../assets/covers/starship-vikrant.jpg';
import coverNeo from '../../assets/covers/neo-delhi-2099.jpg';
import coverHaveli from '../../assets/covers/pahadon-wali-haveli.jpg';
import coverDhaba from '../../assets/covers/hawa-band-dhaba.jpg';
import coverCrush from '../../assets/covers/crush-on-roof.jpg';
import coverPani from '../../assets/covers/pani-72.jpg';
import coverGully from '../../assets/covers/gully-final.jpg';
import coverNight from '../../assets/covers/night-courier.jpg';

export const BUNDLED_MANIFEST = manifestJson as ContentManifest;

export interface BundledStoryFiles {
  story: StoryFile;
  characters: CharactersFile;
  world: WorldFile;
  scenes: ScenesFile;
  memory: MemoryFile;
}

/**
 * V2: no story package ships inside the APK any more, so this always returns
 * null. The signature is kept for API compatibility with the loader and tests;
 * playback content now always comes from the story API (remote).
 */
export function getBundledStory(_id: string): BundledStoryFiles | null {
  return null;
}

/** V2: the APK no longer embeds any story packages. */
export function bundledStoryIds(): string[] {
  return [];
}

/** Bundled cover art registry: manifest `coverBundled` key -> image. */
export const BUNDLED_COVERS: Record<string, number> = {
  'midnight-local': coverMidnight,
  'cafe-queen-myra': coverCafeQueen,
  'aakhri-yodha': coverYodha,
  'chai-dreams': coverChai,
  'starship-vikrant': coverVikrant,
  'neo-delhi-2099': coverNeo,
  'pahadon-wali-haveli': coverHaveli,
  'hawa-band-dhaba': coverDhaba,
  'crush-on-roof': coverCrush,
  'pani-72': coverPani,
  'gully-final': coverGully,
  'night-courier': coverNight,
};
