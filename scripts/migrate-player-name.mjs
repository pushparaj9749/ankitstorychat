/**
 * One-time content migration: hardcoded player names -> {{playerName}}.
 *
 * Kissa stories used to hardcode the reader's name ("Ankit", "Kabir", …) in
 * story text. The app now interpolates {{playerName}} at render time (see
 * src/lib/playerName.ts), so content must use the placeholder.
 *
 * Safety rules (a reference is only replaced when it is THE PLAYER):
 *   - The per-story player name is detected from story.json `userRole`
 *     ("Name — description of the reader").
 *   - If that name is ALSO a character name in the story, the story is
 *     SKIPPED (ambiguous) and reported for manual review.
 *   - Only whole-word, case-sensitive matches are replaced, and never inside
 *     id-like fields.
 *
 * Also rewrites manifest `coverUrl` values from raw GitHub URLs to relative
 * API paths (served by the Kissa story API), and bumps content/story versions
 * so devices re-download the migrated packages.
 *
 * Usage: node scripts/migrate-player-name.mjs [--dry-run]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');
const DRY_RUN = process.argv.includes('--dry-run');

/** Keys whose VALUES must never be rewritten (ids/slugs, not prose). */
const ID_KEY_RE = /^(id|storyId|sceneId|endingId|choiceId|.*Id)$/i;

const PLACEHOLDER = '{{playerName}}';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  if (DRY_RUN) return;
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/** Replace whole-word, case-sensitive occurrences of `name` in a string. */
function replaceWord(text, name, replacement) {
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'g');
  return text.replace(re, replacement);
}

/** Recursively rewrite strings in an object, skipping id-like keys. */
function rewrite(value, name, stats) {
  if (typeof value === 'string') {
    const next = replaceWord(value, name, PLACEHOLDER);
    if (next !== value) stats.replacements += 1;
    return next;
  }
  if (Array.isArray(value)) return value.map((v) => rewrite(v, name, stats));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = ID_KEY_RE.test(k) ? v : rewrite(v, name, stats);
    }
    return out;
  }
  return value;
}

/** Detect the hardcoded player name from `userRole` ("Name — role"). */
function detectPlayerName(userRole, characterNames) {
  if (typeof userRole !== 'string') return null;
  const m = userRole.match(/^([A-Z][a-zA-Z]{1,24})\s+—/);
  if (!m) return null;
  const name = m[1];
  if (characterNames.includes(name)) return null; // a character — not the player
  return name;
}

const manifest = readJson(join(CONTENT, 'manifest.json'));
const skipped = [];
const migrated = [];

for (const entry of manifest.stories) {
  const dir = join(CONTENT, 'stories', entry.storyDir);
  if (!existsSync(dir)) {
    skipped.push(`${entry.id}: missing story directory`);
    continue;
  }
  const files = {
    story: readJson(join(dir, 'story.json')),
    characters: readJson(join(dir, 'characters.json')),
    world: readJson(join(dir, 'world.json')),
    scenes: readJson(join(dir, 'scenes.json')),
    memory: readJson(join(dir, 'memory.json')),
  };

  const characterNames = files.characters.characters.map((c) => c.name);
  const playerName = detectPlayerName(entry.userRole, characterNames);

  if (!playerName) {
    skipped.push(`${entry.id}: no distinct hardcoded player name (userRole: "${String(entry.userRole).slice(0, 40)}…")`);
  } else {
    const stats = { replacements: 0 };
    for (const key of Object.keys(files)) files[key] = rewrite(files[key], playerName, stats);

    // Manifest entry text (description/tagline/userRole) refers to the player too.
    const entryStats = { replacements: 0 };
    const nextEntry = rewrite(entry, playerName, entryStats);
    Object.assign(entry, nextEntry);

    if (stats.replacements > 0 || entryStats.replacements > 0) {
      migrated.push(`${entry.id}: ${stats.replacements + entryStats.replacements} "${playerName}" -> ${PLACEHOLDER}`);
      // Bump versions so devices re-download the migrated package.
      files.story.version = (files.story.version ?? 1) + 1;
      entry.version = (entry.version ?? 1) + 1;
      entry.updatedAt = new Date().toISOString();
    }
    writeJson(join(dir, 'story.json'), files.story);
    writeJson(join(dir, 'characters.json'), files.characters);
    writeJson(join(dir, 'world.json'), files.world);
    writeJson(join(dir, 'scenes.json'), files.scenes);
    writeJson(join(dir, 'memory.json'), files.memory);
  }

  // coverUrl: raw GitHub URL -> relative path served by the story API.
  const hasCover = (ext) => existsSync(join(dir, 'assets', `cover.${ext}`));
  const ext = hasCover('jpg') ? 'jpg' : hasCover('png') ? 'png' : 'jpg';
  const apiCoverUrl = `stories/${entry.storyDir}/assets/cover.${ext}`;
  if (entry.coverUrl && entry.coverUrl !== apiCoverUrl) {
    entry.coverUrl = apiCoverUrl;
  }
}

manifest.contentVersion = (manifest.contentVersion ?? 1) + 1;
manifest.updatedAt = new Date().toISOString();
writeJson(join(CONTENT, 'manifest.json'), manifest);

console.log(`Migrated ${migrated.length} stories (contentVersion -> ${manifest.contentVersion}):`);
migrated.forEach((line) => console.log(`  ✔ ${line}`));
if (skipped.length) {
  console.log('\nSkipped (needs manual review if it should have migrated):');
  skipped.forEach((line) => console.log(`  • ${line}`));
}
if (DRY_RUN) console.log('\n(dry run — nothing written)');
