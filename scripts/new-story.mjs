/**
 * Scaffold a new story package (no app code changes needed).
 * Usage:
 *   node scripts/new-story.mjs --id my-story --title "My Story" --age 12-17 --genre Mystery
 *
 * Creates content/stories/<id>/{story,characters,world,scenes,memory}.json
 * + assets/ + manifest.json entry. Then run `npm run content:validate`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(root, 'content');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const id = arg('id');
const title = arg('title', 'Untitled Story');
const age = arg('age', '12-17');
const genre = arg('genre', 'Adventure');

if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Usage: node scripts/new-story.mjs --id my-story-id [--title "..."] [--age 12-17|18+] [--genre ...]');
  process.exit(1);
}
if (!['12-17', '18+'].includes(age)) {
  console.error('--age must be 12-17 or 18+');
  process.exit(1);
}
const contentLevel = age === '18+' ? 'mature' : 'teen';
const dir = join(CONTENT, 'stories', id);
if (existsSync(dir)) {
  console.error(`Story dir already exists: ${dir}`);
  process.exit(1);
}
mkdirSync(join(dir, 'assets'), { recursive: true });

const story = {
  id,
  title,
  description: `${title} — replace with a 2-line hook.`,
  version: 1,
  language: 'hinglish',
  ageRating: age,
  contentLevel,
  genres: [genre],
  tags: ['new'],
  userRole: 'TODO: who the reader plays',
  setting: 'TODO: where/when',
  openingSceneId: 's1_start',
  tone: 'TODO: tone guidance for the narrator',
  safetyNotes: age === '12-17' ? ['Teen-safe: no gore, hopeful overall.'] : ['Mature themes handled with gravity.'],
};

const characters = {
  storyId: id,
  version: 1,
  characters: [
    {
      id: 'guide',
      name: 'TODO Guide',
      role: 'TODO role',
      personality: 'TODO',
      background: 'TODO',
      goals: ['TODO'],
      fears: ['TODO'],
      likes: ['TODO'],
      dislikes: ['TODO'],
      speakingStyle: 'TODO distinct voice',
      sampleLine: 'TODO ek Hinglish sample line',
      relationshipWithUser: 'TODO',
      knowledge: ['TODO'],
    },
  ],
};

const world = {
  storyId: id,
  version: 1,
  premise: 'TODO: 3-5 line premise with the twist.',
  locations: [{ id: 'start', name: 'TODO place', description: 'TODO' }],
  factions: [],
  lore: ['TODO lore 1'],
  rules: ['TODO: hard rule the AI must never break.'],
  importantObjects: [],
  timeline: [],
};

const scenes = {
  storyId: id,
  version: 1,
  scenes: [
    {
      id: 's1_start',
      title: 'Shuruaat',
      narration: ['TODO: opening narration line 1.', 'TODO: opening narration line 2.'],
      fallbackLines: ['TODO: fallback line for unmatched free text.'],
      choices: [
        {
          id: 'c_left',
          text: 'TODO: pehla choice',
          shortLabel: 'Choice 1',
          keywords: ['TODO', 'keywords'],
          next: 'end_demo',
          effects: { memory: ['TODO: what to remember'] },
        },
      ],
    },
    {
      id: 'end_demo',
      title: 'Demo Ending',
      narration: ['TODO: ending narration.'],
      fallbackLines: ['Kahani poori ho gayi.'],
      choices: [],
      isEnding: true,
      endingId: 'demo',
    },
  ],
  endings: [{ id: 'demo', title: 'Demo', description: 'TODO', tone: 'happy' }],
};

const memory = {
  storyId: id,
  version: 1,
  shortTermWindow: 14,
  seedMemories: ['TODO: seed fact 1'],
  extractionHints: ['TODO: what to remember'],
  neverRemember: ['Real-world personal data'],
};

for (const [file, obj] of [
  ['story.json', story],
  ['characters.json', characters],
  ['world.json', world],
  ['scenes.json', scenes],
  ['memory.json', memory],
]) {
  writeFileSync(join(dir, file), JSON.stringify(obj, null, 2) + '\n');
}
writeFileSync(
  join(dir, 'assets', 'README.txt'),
  'Put cover.png here (900x1200 recommended); the manifest coverUrl already points at it (relative API path).\n',
);

// Manifest entry
const manifestPath = join(CONTENT, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.stories.some((s) => s.id === id)) {
  console.error('Manifest already contains this id.');
  process.exit(1);
}
manifest.contentVersion += 1;
manifest.updatedAt = new Date().toISOString();
manifest.stories.push({
  id,
  title,
  tagline: 'TODO: one-line hook',
  description: story.description,
  genres: [genre],
  tags: ['new'],
  characters: ['TODO Guide'],
  ageRating: age,
  contentLevel,
  language: 'hinglish',
  version: 1,
  coverUrl: `stories/${id}/assets/cover.png`,
  accentColor: '#8B5CF6',
  userRole: story.userRole,
  setting: story.setting,
  estimatedMinutes: 15,
  featured: false,
  isNew: true,
  popularity: 50,
  storyDir: id,
  updatedAt: new Date().toISOString(),
});
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Created ${dir}`);
console.log('Next: edit the TODOs, add assets/cover.png, run npm run content:validate');
