/**
 * Bundled (shipped-with-the-app) story CATALOG + cover art.
 *
 * The content manifest and cover art ship with the APK so every story appears
 * in Home / Discover without a network call. Playable story *packages*
 * (story/scenes/world/characters/memory JSON) download on first open from
 * the story API, are validated, then cached on-device. Cached packages open
 * immediately afterwards — including fully offline.
 *
 * The private story-source repository is only read by the deployment
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
 * No story package is compiled into the APK — packages download on first
 * open and then live in the on-device cache (see loader.ts). Signature kept
 * so the loader / tests can treat "bundled" as an optional source.
 */
export function getBundledStory(_id: string): BundledStoryFiles | null {
  return null;
}

/** Story ids whose packages ship inside the APK (currently none). */
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
