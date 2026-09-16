import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { story01, story02, story03 } from './stories-part1.mjs';
import { story04, story05 } from './stories-part2.mjs';
import { story06, story07, story08 } from './stories-part3.mjs';
import { story09, story10 } from './stories-part4.mjs';

const allStories = [
  story01,
  story02,
  story03,
  story04,
  story05,
  story06,
  story07,
  story08,
  story09,
  story10
];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');
const STORIES_DIR = join(CONTENT, 'stories');

const LEGACY_NAMES = ['Ankit', 'Kabir', 'Aarav', 'Arjun'];

function checkLineMarkup(line, loc) {
  if (line.split('"').length % 2 !== 1) {
    throw new Error(`Unbalanced quotes in ${loc}: ${line}`);
  }
  if (line.split('*').length % 2 !== 1) {
    throw new Error(`Unbalanced asterisks in ${loc}: ${line}`);
  }
}

function validateAndWrite() {
  const manifestPath = join(CONTENT, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  for (const s of allStories) {
    console.log(`Processing story: ${s.id} - ${s.title}`);

    // Check character names
    const charNames = s.characters.map((c) => c.name);
    for (const c of s.characters) {
      if (c.name.includes('{{')) {
        throw new Error(`Character name contains placeholder in ${s.id}: ${c.name}`);
      }
    }

    // Check scenes
    const sceneIds = new Set(s.scenes.map((sc) => sc.id));
    if (!sceneIds.has(s.openingSceneId)) {
      throw new Error(`Opening scene ${s.openingSceneId} not found in ${s.id}`);
    }

    for (const sc of s.scenes) {
      if (sc.isEnding) {
        throw new Error(`Ongoing story has isEnding in ${s.id}.${sc.id}`);
      }
      for (const line of sc.narration) {
        checkLineMarkup(line, `${s.id}.${sc.id}.narration`);
        for (const legacy of LEGACY_NAMES) {
          if (!charNames.includes(legacy) && new RegExp(`\\b${legacy}\\b`).test(line)) {
            throw new Error(`Legacy name "${legacy}" found in narration in ${s.id}.${sc.id}: ${line}`);
          }
        }
      }
      for (const line of sc.fallbackLines) {
        checkLineMarkup(line, `${s.id}.${sc.id}.fallbackLines`);
      }
      for (const ch of sc.choices) {
        if (ch.shortLabel && ch.shortLabel.length > 20) {
          throw new Error(`shortLabel too long in ${s.id}.${sc.id} (${ch.shortLabel.length} chars): "${ch.shortLabel}"`);
        }
        if (ch.next && !sceneIds.has(ch.next)) {
          throw new Error(`Unknown next scene "${ch.next}" in ${s.id}.${sc.id}`);
        }
        if (ch.effects?.scene && !sceneIds.has(ch.effects.scene)) {
          throw new Error(`Unknown effects.scene "${ch.effects.scene}" in ${s.id}.${sc.id}`);
        }
        if (ch.effects?.endStory) {
          throw new Error(`Ongoing story has endStory in ${s.id}.${sc.id}`);
        }
      }
    }

    // Check reachability
    const reachable = new Set([s.openingSceneId]);
    const queue = [s.openingSceneId];
    const byId = new Map(s.scenes.map((sc) => [sc.id, sc]));
    while (queue.length) {
      const cur = byId.get(queue.pop());
      if (!cur) continue;
      for (const ch of cur.choices ?? []) {
        const targets = [ch.next, ch.effects?.scene].filter(Boolean);
        for (const t of targets) {
          if (sceneIds.has(t) && !reachable.has(t)) {
            reachable.add(t);
            queue.push(t);
          }
        }
      }
    }
    for (const id of sceneIds) {
      if (!reachable.has(id)) {
        throw new Error(`Unreachable scene "${id}" in ${s.id}`);
      }
    }

    // Prepare files
    const dir = join(STORIES_DIR, s.id);
    mkdirSync(join(dir, 'assets'), { recursive: true });

    const storyJson = {
      id: s.id,
      title: s.title,
      description: s.description,
      version: 1,
      language: 'hinglish',
      ageRating: s.ageRating,
      contentLevel: s.contentLevel,
      genres: s.genres,
      tags: s.tags,
      userRole: s.userRole,
      setting: s.setting,
      openingSceneId: s.openingSceneId,
      tone: s.tone,
      safetyNotes: s.safetyNotes
    };

    const charactersJson = {
      storyId: s.id,
      version: 1,
      characters: s.characters
    };

    const worldJson = {
      storyId: s.id,
      version: 1,
      premise: s.world.premise,
      locations: s.world.locations,
      factions: s.world.factions,
      lore: s.world.lore,
      rules: s.world.rules,
      importantObjects: s.world.importantObjects,
      timeline: s.world.timeline
    };

    const scenesJson = {
      storyId: s.id,
      version: 1,
      scenes: s.scenes,
      endings: []
    };

    const memoryJson = {
      storyId: s.id,
      version: 1,
      shortTermWindow: s.memory.shortTermWindow,
      seedMemories: s.memory.seedMemories,
      extractionHints: s.memory.extractionHints,
      neverRemember: s.memory.neverRemember
    };

    writeFileSync(join(dir, 'story.json'), JSON.stringify(storyJson, null, 2) + '\n');
    writeFileSync(join(dir, 'characters.json'), JSON.stringify(charactersJson, null, 2) + '\n');
    writeFileSync(join(dir, 'world.json'), JSON.stringify(worldJson, null, 2) + '\n');
    writeFileSync(join(dir, 'scenes.json'), JSON.stringify(scenesJson, null, 2) + '\n');
    writeFileSync(join(dir, 'memory.json'), JSON.stringify(memoryJson, null, 2) + '\n');

    // Update manifest entry
    const existingIdx = manifest.stories.findIndex((entry) => entry.id === s.id);
    const meta = {
      id: s.id,
      title: s.title,
      tagline: s.tagline,
      description: s.description,
      genres: s.genres,
      tags: s.tags,
      characters: charNames,
      ageRating: s.ageRating,
      contentLevel: s.contentLevel,
      language: 'hinglish',
      version: 1,
      coverUrl: `stories/${s.id}/assets/cover.jpg`,
      accentColor: s.accentColor,
      userRole: s.userRole,
      setting: s.setting,
      estimatedMinutes: 30,
      featured: false,
      isNew: true,
      popularity: 85,
      storyDir: s.id,
      updatedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      manifest.stories[existingIdx] = meta;
    } else {
      manifest.stories.push(meta);
    }
  }

  manifest.contentVersion += 1;
  manifest.updatedAt = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Successfully generated and wrote all 10 stories! Manifest updated to version ${manifest.contentVersion}.`);
}

validateAndWrite();
