/**
 * Bundled (shipped-with-the-app) story content.
 * These JSON files live in /content and are compiled into the app binary.
 *
 * IMPORTANT: adding a NEW story through GitHub later does NOT require
 * touching this file — remote stories are downloaded as JSON at runtime
 * (see loader.ts). This registry only covers stories shipped in the APK.
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

import mlStory from '../../content/stories/midnight-local/story.json';
import mlCharacters from '../../content/stories/midnight-local/characters.json';
import mlWorld from '../../content/stories/midnight-local/world.json';
import mlScenes from '../../content/stories/midnight-local/scenes.json';
import mlMemory from '../../content/stories/midnight-local/memory.json';

import mqStory from '../../content/stories/cafe-queen-myra/story.json';
import mqCharacters from '../../content/stories/cafe-queen-myra/characters.json';
import mqWorld from '../../content/stories/cafe-queen-myra/world.json';
import mqScenes from '../../content/stories/cafe-queen-myra/scenes.json';
import mqMemory from '../../content/stories/cafe-queen-myra/memory.json';

import ayStory from '../../content/stories/aakhri-yodha/story.json';
import ayCharacters from '../../content/stories/aakhri-yodha/characters.json';
import ayWorld from '../../content/stories/aakhri-yodha/world.json';
import ayScenes from '../../content/stories/aakhri-yodha/scenes.json';
import ayMemory from '../../content/stories/aakhri-yodha/memory.json';

import cdStory from '../../content/stories/chai-dreams/story.json';
import cdCharacters from '../../content/stories/chai-dreams/characters.json';
import cdWorld from '../../content/stories/chai-dreams/world.json';
import cdScenes from '../../content/stories/chai-dreams/scenes.json';
import cdMemory from '../../content/stories/chai-dreams/memory.json';

import svStory from '../../content/stories/starship-vikrant/story.json';
import svCharacters from '../../content/stories/starship-vikrant/characters.json';
import svWorld from '../../content/stories/starship-vikrant/world.json';
import svScenes from '../../content/stories/starship-vikrant/scenes.json';
import svMemory from '../../content/stories/starship-vikrant/memory.json';

import ndStory from '../../content/stories/neo-delhi-2099/story.json';
import ndCharacters from '../../content/stories/neo-delhi-2099/characters.json';
import ndWorld from '../../content/stories/neo-delhi-2099/world.json';
import ndScenes from '../../content/stories/neo-delhi-2099/scenes.json';
import ndMemory from '../../content/stories/neo-delhi-2099/memory.json';

import phStory from '../../content/stories/pahadon-wali-haveli/story.json';
import phCharacters from '../../content/stories/pahadon-wali-haveli/characters.json';
import phWorld from '../../content/stories/pahadon-wali-haveli/world.json';
import phScenes from '../../content/stories/pahadon-wali-haveli/scenes.json';
import phMemory from '../../content/stories/pahadon-wali-haveli/memory.json';

import hdStory from '../../content/stories/hawa-band-dhaba/story.json';
import hdCharacters from '../../content/stories/hawa-band-dhaba/characters.json';
import hdWorld from '../../content/stories/hawa-band-dhaba/world.json';
import hdScenes from '../../content/stories/hawa-band-dhaba/scenes.json';
import hdMemory from '../../content/stories/hawa-band-dhaba/memory.json';

import crStory from '../../content/stories/crush-on-roof/story.json';
import crCharacters from '../../content/stories/crush-on-roof/characters.json';
import crWorld from '../../content/stories/crush-on-roof/world.json';
import crScenes from '../../content/stories/crush-on-roof/scenes.json';
import crMemory from '../../content/stories/crush-on-roof/memory.json';

import pnStory from '../../content/stories/pani-72/story.json';
import pnCharacters from '../../content/stories/pani-72/characters.json';
import pnWorld from '../../content/stories/pani-72/world.json';
import pnScenes from '../../content/stories/pani-72/scenes.json';
import pnMemory from '../../content/stories/pani-72/memory.json';

import gfStory from '../../content/stories/gully-final/story.json';
import gfCharacters from '../../content/stories/gully-final/characters.json';
import gfWorld from '../../content/stories/gully-final/world.json';
import gfScenes from '../../content/stories/gully-final/scenes.json';
import gfMemory from '../../content/stories/gully-final/memory.json';

import ncStory from '../../content/stories/night-courier/story.json';
import ncCharacters from '../../content/stories/night-courier/characters.json';
import ncWorld from '../../content/stories/night-courier/world.json';
import ncScenes from '../../content/stories/night-courier/scenes.json';
import ncMemory from '../../content/stories/night-courier/memory.json';

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

const REGISTRY: Record<string, BundledStoryFiles> = {
  'midnight-local': {
    story: mlStory as StoryFile,
    characters: mlCharacters as CharactersFile,
    world: mlWorld as WorldFile,
    scenes: mlScenes as ScenesFile,
    memory: mlMemory as MemoryFile,
  },
  'cafe-queen-myra': {
    story: mqStory as StoryFile,
    characters: mqCharacters as CharactersFile,
    world: mqWorld as WorldFile,
    scenes: mqScenes as ScenesFile,
    memory: mqMemory as MemoryFile,
  },
  'aakhri-yodha': {
    story: ayStory as StoryFile,
    characters: ayCharacters as CharactersFile,
    world: ayWorld as WorldFile,
    scenes: ayScenes as ScenesFile,
    memory: ayMemory as MemoryFile,
  },
  'chai-dreams': {
    story: cdStory as StoryFile,
    characters: cdCharacters as CharactersFile,
    world: cdWorld as WorldFile,
    scenes: cdScenes as ScenesFile,
    memory: cdMemory as MemoryFile,
  },
  'starship-vikrant': {
    story: svStory as StoryFile,
    characters: svCharacters as CharactersFile,
    world: svWorld as WorldFile,
    scenes: svScenes as ScenesFile,
    memory: svMemory as MemoryFile,
  },
  'neo-delhi-2099': {
    story: ndStory as StoryFile,
    characters: ndCharacters as CharactersFile,
    world: ndWorld as WorldFile,
    scenes: ndScenes as ScenesFile,
    memory: ndMemory as MemoryFile,
  },
  'pahadon-wali-haveli': {
    story: phStory as StoryFile,
    characters: phCharacters as CharactersFile,
    world: phWorld as WorldFile,
    scenes: phScenes as ScenesFile,
    memory: phMemory as MemoryFile,
  },
  'hawa-band-dhaba': {
    story: hdStory as StoryFile,
    characters: hdCharacters as CharactersFile,
    world: hdWorld as WorldFile,
    scenes: hdScenes as ScenesFile,
    memory: hdMemory as MemoryFile,
  },
  'crush-on-roof': {
    story: crStory as StoryFile,
    characters: crCharacters as CharactersFile,
    world: crWorld as WorldFile,
    scenes: crScenes as ScenesFile,
    memory: crMemory as MemoryFile,
  },
  'pani-72': {
    story: pnStory as StoryFile,
    characters: pnCharacters as CharactersFile,
    world: pnWorld as WorldFile,
    scenes: pnScenes as ScenesFile,
    memory: pnMemory as MemoryFile,
  },
  'gully-final': {
    story: gfStory as StoryFile,
    characters: gfCharacters as CharactersFile,
    world: gfWorld as WorldFile,
    scenes: gfScenes as ScenesFile,
    memory: gfMemory as MemoryFile,
  },
  'night-courier': {
    story: ncStory as StoryFile,
    characters: ncCharacters as CharactersFile,
    world: ncWorld as WorldFile,
    scenes: ncScenes as ScenesFile,
    memory: ncMemory as MemoryFile,
  },
};

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

export function getBundledStory(id: string): BundledStoryFiles | null {
  return REGISTRY[id] ?? null;
}

export function bundledStoryIds(): string[] {
  return Object.keys(REGISTRY);
}
