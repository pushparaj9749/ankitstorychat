import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');
const STORIES_DIR = join(CONTENT, 'stories');

// Helper to assert balanced quotes and asterisks
function checkLineMarkup(line, loc) {
  if (line.split('"').length % 2 !== 1) {
    throw new Error(`Unbalanced quotes in ${loc}: ${line}`);
  }
  if (line.split('*').length % 2 !== 1) {
    throw new Error(`Unbalanced asterisks in ${loc}: ${line}`);
  }
}

// Helper to assert shortLabel length
function checkChoices(choices, loc) {
  for (const ch of choices) {
    if (ch.shortLabel && ch.shortLabel.length > 20) {
      throw new Error(`shortLabel too long in ${loc} (${ch.shortLabel.length} chars): "${ch.shortLabel}"`);
    }
  }
}

function validateStoryData(storyData) {
  const { story, characters, world, scenes, memory, meta } = storyData;
  // Check scene lines
  for (const sc of scenes.scenes) {
    for (const line of sc.narration) {
      checkLineMarkup(line, `${story.id}.${sc.id}.narration`);
    }
    for (const line of sc.fallbackLines) {
      checkLineMarkup(line, `${story.id}.${sc.id}.fallbackLines`);
    }
    checkChoices(sc.choices, `${story.id}.${sc.id}.choices`);
  }
}

export { checkLineMarkup, checkChoices, validateStoryData, ROOT, CONTENT, STORIES_DIR };
