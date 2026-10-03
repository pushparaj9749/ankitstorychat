/** Read-only post-deploy gate. Checks actual app URLs, not just Worker health. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = ['story', 'characters', 'world', 'scenes', 'memory'];
const manifest = readJson(join(ROOT, 'content/manifest.json'));
const entry = manifest.stories[0];
const dir = join(ROOT, 'content/stories', entry.storyDir);
const expected = Object.fromEntries(files.map((f) => [f, readJson(join(dir, `${f}.json`))]));

export async function verify(base, transport = fetch) {
  async function get(path, type) {
    const url = `${base}/${path}`;
    const res = await transport(url, { signal: AbortSignal.timeout(30_000) });
    assert.equal(res.status, 200, `${url}: HTTP ${res.status}`);
    assert.equal(res.headers.get('content-type')?.split(';')[0], type, `${url}: wrong content type`);
    return res;
  }
  const health = await (await get('health', 'application/json')).json();
  assert.equal(health.service, 'kissa-content-api');
  assert.equal(health.contentVersion, manifest.contentVersion);
  const remote = await (await get('manifest', 'application/json')).json();
  assert.equal(remote.contentVersion, manifest.contentVersion, 'manifest version not propagated');
  assert.equal(remote.minAppVersion, manifest.minAppVersion);
  assert.deepEqual(remote.stories.find((s) => s.id === entry.id), entry, 'remote listing differs');
  const pkg = await (await get(`stories/${entry.storyDir}`, 'application/json')).json();
  for (const f of files) {
    assert.deepEqual(pkg[f], expected[f], `package ${f} differs`);
    const body = await (await get(`stories/${entry.storyDir}/${f}.json`, 'application/json')).json();
    assert.deepEqual(body, expected[f], `${f}.json differs`);
  }
  const refs = expected.story.media.gallery.map((g) => g.file);
  assert.equal(new Set(refs).size, refs.length, 'duplicate media references');
  assert(refs.includes(expected.story.media.cover), 'cover not registered');
  const hashes = [];
  for (const file of refs) {
    const res = await get(`stories/${entry.storyDir}/${file}`, 'image/jpeg');
    const bytes = Buffer.from(await res.arrayBuffer());
    const hash = sha(bytes);
    assert.equal(hash, sha(readFileSync(join(dir, file))), `${file}: deployed bytes differ`);
    hashes.push({ file, sha256: hash, bytes: bytes.length });
  }

  // Canonical identity references are stored separately from gallery media,
  // but remain part of the same remote story package and must be served by the
  // same Worker allowlist with byte-for-byte integrity.
  const referenceFiles = Array.from(new Set([
    expected.characters.playerVisualReference?.file,
    ...expected.characters.characters.map((character) => character.visualReference?.file),
  ].filter((file) => typeof file === 'string')));
  const referenceHashes = [];
  for (const file of referenceFiles) {
    assert.match(file, /^assets\/references\/[a-z0-9][a-z0-9-]{0,63}\.jpg$/);
    const contentType = 'image/jpeg';
    const res = await get(`stories/${entry.storyDir}/${file}`, contentType);
    const bytes = Buffer.from(await res.arrayBuffer());
    const hash = sha(bytes);
    assert.equal(hash, sha(readFileSync(join(dir, file))), `${file}: deployed reference bytes differ`);
    referenceHashes.push({ file, sha256: hash, bytes: bytes.length });
  }
  return { base, story: entry.id, contentVersion: remote.contentVersion, jsonFiles: files.length, images: hashes, references: referenceHashes };
}

async function main() {
  // New static assets and the manifest index can briefly propagate separately.
  // Retry content equality, not just health. Never suppress a persistent failure.
  const bases = ['https://beyondredeye.site/api', 'https://www.beyondredeye.site/api'];
  for (const base of bases) {
    let consecutive = 0;
    for (let attempt = 1; attempt <= 18; attempt++) {
      try {
        const result = await verify(base);
        consecutive++;
        console.log(JSON.stringify(result));
        if (consecutive === 2) {
          console.log(`::notice title=Published story verified::${base}: ${entry.id}, contentVersion ${manifest.contentVersion}; manifest, package, 5 JSON files, ${result.images.length} byte-identical cover/gallery images and ${result.references.length} canonical identity references; two consecutive passes.`);
          break;
        }
      } catch (error) {
        consecutive = 0;
        console.error(`Readiness ${base}, attempt ${attempt}/18: ${error.message}`);
      }
      if (attempt === 18) throw new Error(`Content failed to stabilize at ${base}`);
      await delay(10_000);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
