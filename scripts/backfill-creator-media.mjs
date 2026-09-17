/**
 * Migration / backfill for ALL bundled Kissa stories (safe, idempotent):
 *
 *   1. Creator backfill — every owner-created story gets
 *        "creator": { "name": "Ankit", "avatar": null, "verified": true }
 *      in BOTH story.json and the manifest entry (runtime fallback
 *      KISSA_OWNER_CREATOR in the app remains as defense-in-depth).
 *
 *   2. Media Library backfill — every story's story.json gets a `media`
 *      block wired to the assets the story ALREADY has:
 *        - cover  -> the story's existing cover (assets/cover.jpg)
 *        - gallery-> [cover entry] (character portraits / scene stills are
 *                    added per-story when the artwork exists — never
 *                    fabricated, never copied from another story)
 *      Existing cover files are REUSED by reference — nothing is duplicated.
 *
 *   3. Audit — verifies for every story:
 *        ✓ cover file exists (package assets/ or assets/covers/, which the
 *          deploy pipeline copies into the package before publish)
 *        ✓ creator metadata present (Ankit)
 *        ✓ gallery refs point at real, story-local assets
 *        ✓ no cross-story asset contamination
 *      Fails (exit 1) if anything is broken.
 *
 * Usage:  node scripts/backfill-creator-media.mjs [--check]
 *   --check  audit only, write nothing
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(root, 'content');
const REPO_COVERS = join(root, 'assets', 'covers');
const CHECK_ONLY = process.argv.includes('--check');

const OWNER_CREATOR = { name: 'Ankit', avatar: null, verified: true };

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}
function writeJson(p, obj) {
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

const manifestPath = join(CONTENT, 'manifest.json');
const manifest = readJson(manifestPath);

const problems = [];
const rows = [];

// Map of storyDir -> where its cover physically lives (for the audit).
// The deploy pipeline (scripts/build-worker-assets.mjs) copies the bundled
// cover (assets/covers/<coverBundled|storyDir>.jpg) into the package as
// assets/cover.jpg, so "assets/covers" counts as a valid location.
function coverLocation(entry) {
  const pkgJpg = join(CONTENT, 'stories', entry.storyDir, 'assets', 'cover.jpg');
  const pkgPng = join(CONTENT, 'stories', entry.storyDir, 'assets', 'cover.png');
  if (existsSync(pkgJpg) || existsSync(pkgPng)) return 'package';
  for (const name of [entry.coverBundled, entry.storyDir]) {
    if (name && existsSync(join(REPO_COVERS, `${name}.jpg`))) return 'assets/covers';
  }
  return null;
}

let changed = 0;

for (const entry of manifest.stories) {
  const dir = join(CONTENT, 'stories', entry.storyDir);
  const storyPath = join(dir, 'story.json');
  if (!existsSync(storyPath)) {
    problems.push(`${entry.id}: story.json missing`);
    continue;
  }
  const story = readJson(storyPath);
  const edits = [];

  /* ---------- 1. creator backfill ---------- */
  if (JSON.stringify(story.creator) !== JSON.stringify(OWNER_CREATOR)) {
    story.creator = { ...OWNER_CREATOR };
    edits.push('story.creator');
  }
  if (JSON.stringify(entry.creator) !== JSON.stringify(OWNER_CREATOR)) {
    entry.creator = { ...OWNER_CREATOR };
    edits.push('manifest.creator');
  }

  /* ---------- 2. media backfill (reuse existing assets only) ---------- */
  // Which cover does this story actually ship? (package file wins, then the
  // extension declared by the manifest coverUrl — the deploy pipeline always
  // names the filled copy cover.jpg, so .jpg is the safe default.)
  const pkgCoverPng = join(dir, 'assets', 'cover.png');
  const coverFile = existsSync(pkgCoverPng)
    ? 'cover.png'
    : typeof entry.coverUrl === 'string' && entry.coverUrl.endsWith('.png')
      ? 'cover.png'
      : 'cover.jpg';
  const coverRef = `assets/${coverFile}`;

  // Existing media block (if any) is respected — we only fix what is missing
  // or wrong; we never invent new artwork references.
  const existing = story.media;
  const existingFiles = new Set(
    Array.isArray(existing?.gallery)
      ? existing.gallery.map((g) => (g && typeof g.file === 'string' ? g.file : null))
      : [],
  );
  // Cross-story contamination guard: a bundled story may only reference its
  // own package assets (cover or its own gallery folder).
  for (const f of existingFiles) {
    if (!f || !f.startsWith('assets/')) {
      problems.push(`${entry.id}: media ref "${f}" is not a safe asset path`);
      continue;
    }
    if (f !== coverRef && !f.startsWith('assets/gallery/')) {
      problems.push(`${entry.id}: media ref "${f}" is outside the allowed shapes`);
    }
    if (f.startsWith('assets/gallery/')) {
      const gpath = join(dir, f);
      if (!existsSync(gpath)) problems.push(`${entry.id}: gallery file missing: ${f}`);
    }
  }

  const coverInGallery = existingFiles.has(coverRef);
  const needsMedia =
    !existing ||
    typeof existing !== 'object' ||
    existing.cover !== coverRef ||
    !Array.isArray(existing.gallery) ||
    existing.gallery.length === 0 ||
    !coverInGallery;

  if (needsMedia) {
    // Keep any story-local gallery images that already exist on disk;
    // prepend/ensure the cover entry.
    const keepGallery = Array.isArray(existing?.gallery)
      ? existing.gallery.filter((g) => g && g.file !== coverRef && existsSync(join(dir, g.file)))
      : [];
    story.media = {
      cover: coverRef,
      gallery: [
        { id: 'cover', file: coverRef, kind: 'cover', label: 'Cover' },
        ...keepGallery,
      ],
    };
    edits.push('story.media');
  }

  /* ---------- 3. audit ---------- */
  const where = coverLocation(entry);
  if (!where) {
    problems.push(`${entry.id}: cover NOT found (no package assets/${coverFile}, no assets/covers/${entry.storyDir}.jpg)`);
  }
  if (story.media) {
    for (const g of story.media.gallery ?? []) {
      if (g.file === coverRef) continue; // cover existence checked above
      if (!existsSync(join(dir, g.file))) problems.push(`${entry.id}: gallery file missing: ${g.file}`);
    }
  }

  rows.push({
    id: entry.id,
    creator: story.creator?.name ?? 'MISSING',
    verified: story.creator?.verified === true,
    cover: where ?? 'MISSING',
    gallery: story.media?.gallery?.length ?? 0,
    edits: edits.length ? edits.join(', ') : '—',
  });

  if (edits.length && !CHECK_ONLY) {
    writeJson(storyPath, story);
    changed++;
  }
}

// Manifest-level audit: every entry must now carry Ankit creator metadata.
for (const entry of manifest.stories) {
  if (entry.creator?.name !== 'Ankit' || entry.creator?.verified !== true) {
    problems.push(`${entry.id}: manifest creator is not Ankit/verified`);
  }
}

// Cross-story contamination: gallery files are per-story directories by
// construction; the only shared asset is assets/covers (APK cover registry),
// which is addressed by coverUrl, not by media refs.

if (!CHECK_ONLY && changed > 0) {
  manifest.contentVersion = (manifest.contentVersion ?? 0) + 1;
  manifest.updatedAt = new Date().toISOString();
  writeJson(manifestPath, manifest);
}

/* ---------------- report ---------------- */
const W = 22;
console.log('STORY MEDIA + CREATOR BACKFILL');
console.log(CHECK_ONLY ? '(check-only — no writes)\n' : '\n');
console.log(
  [
    `${'story'.padEnd(W)}`,
    `${'creator'.padEnd(10)}`,
    `${'cover'.padEnd(16)}`,
    `${'gallery'.padEnd(8)}`,
    'edits',
  ].join(''),
);
for (const r of rows) {
  console.log(
    [
      r.id.padEnd(W),
      `${r.creator}${r.verified ? '✓' : ''}`.padEnd(10),
      r.cover.padEnd(16),
      String(r.gallery).padEnd(8),
      r.edits,
    ].join(''),
  );
}

console.log('');
if (problems.length > 0) {
  console.error(`✗ ${problems.length} problem(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(
  `✓ ${rows.length} stories audited — ${changed} updated, all covers + creators + gallery refs valid.` +
    (CHECK_ONLY ? '' : ' manifest contentVersion bumped.'),
);
