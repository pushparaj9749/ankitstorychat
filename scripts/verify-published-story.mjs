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
const expectedDynamicMediaDimensions = { width: 1376, height: 768 };
// A full catalog verification makes more requests than the Worker’s 120/min
// per-IP limit. Pace every remote call below the limit so the verifier cannot
// rate-limit itself while checking all ten packages and their media.
const remoteRequestIntervalMs = 600;
let nextRemoteRequestAt = 0;

async function waitForRemoteRequestSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextRemoteRequestAt);
  nextRemoteRequestAt = slot + remoteRequestIntervalMs;
  if (slot > now) await delay(slot - now);
}

function jpegDimensions(bytes, label) {
  assert(bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8, `${label}: not a JPEG`);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset++; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      assert(width > 0 && height > 0, `${label}: invalid native dimensions`);
      return { width, height, aspectRatio: Number((width / height).toFixed(6)) };
    }
    offset += length + 2;
  }
  throw new Error(`${label}: JPEG dimensions not found`);
}
const manifest = readJson(join(ROOT, 'content/manifest.json'));

function entriesFor(ids = []) {
  const requested = ids.length ? ids : [manifest.stories.at(-1)?.id];
  return requested.map((id) => {
    const entry = manifest.stories.find((story) => story.id === id || story.storyDir === id);
    assert(entry, `story ${id} is missing from the local manifest`);
    return entry;
  });
}

function validateLocalEntry(entry) {
  const dir = join(ROOT, 'content/stories', entry.storyDir);
  const expected = Object.fromEntries(files.map((file) => [file, readJson(join(dir, `${file}.json`))]));
  const media = expected.story.media;
  assert(media && Array.isArray(media.gallery), `${entry.id}: missing Media Library metadata`);
  const refs = media.gallery.map((item) => item.file);
  assert.equal(new Set(refs).size, refs.length, `${entry.id}: duplicate media references`);
  assert(refs.includes(media.cover), `${entry.id}: cover not registered in gallery`);
  if (entry.tags?.includes('dynamic-continuous')) {
    assert.equal(refs.length, 8, `${entry.id}: expected one cover plus seven gallery images`);
    assert.equal(media.gallery.filter((item) => item.kind === 'cover' && item.file === media.cover).length, 1, `${entry.id}: expected exactly one cover metadata item`);
    assert.equal(refs.filter((file) => file !== media.cover).length, 7, `${entry.id}: expected exactly seven gallery assets`);
  }
  const assets = refs.map((file) => {
    const localBytes = readFileSync(join(dir, file));
    const dimensions = jpegDimensions(localBytes, `${entry.id}/${file}`);
    if (entry.tags?.includes('dynamic-continuous')) {
      assert.equal(dimensions.width, expectedDynamicMediaDimensions.width, `${entry.id}/${file}: expected 1376-pixel native width`);
      assert.equal(dimensions.height, expectedDynamicMediaDimensions.height, `${entry.id}/${file}: expected 768-pixel native height`);
    }
    return { file, localBytes, dimensions };
  });
  return { dir, expected, assets };
}

/** Verify one manifest entry and every byte served for that story's media. */
export async function verify(base, transport = fetch, entry = entriesFor()[0]) {
  const { dir, expected, assets } = validateLocalEntry(entry);

  async function get(path, type) {
    const url = `${base}/${path}`;
    await waitForRemoteRequestSlot();
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
  assert.deepEqual(remote.stories.find((story) => story.id === entry.id), entry, 'remote listing differs');
  const pkg = await (await get(`stories/${entry.storyDir}`, 'application/json')).json();
  for (const file of files) {
    assert.deepEqual(pkg[file], expected[file], `package ${file} differs`);
    const body = await (await get(`stories/${entry.storyDir}/${file}.json`, 'application/json')).json();
    assert.deepEqual(body, expected[file], `${file}.json differs`);
  }
  const hashes = [];
  for (const { file, localBytes, dimensions } of assets) {
    const res = await get(`stories/${entry.storyDir}/${file}`, 'image/jpeg');
    const bytes = Buffer.from(await res.arrayBuffer());
    const hash = sha(bytes);
    assert.equal(hash, sha(localBytes), `${file}: deployed bytes differ`);
    hashes.push({ file, sha256: hash, bytes: bytes.length, ...dimensions });
  }

  // Canonical visual references are separate from the gallery, but remain in
  // the same story package and use the same Worker allowlist.
  const referenceFiles = Array.from(new Set([
    expected.characters.playerVisualReference?.file,
    ...expected.characters.characters.map((character) => character.visualReference?.file),
  ].filter((file) => typeof file === 'string')));
  const referenceHashes = [];
  for (const file of referenceFiles) {
    assert.match(file, /^assets\/references\/[a-z0-9][a-z0-9-]{0,63}\.jpg$/);
    const res = await get(`stories/${entry.storyDir}/${file}`, 'image/jpeg');
    const bytes = Buffer.from(await res.arrayBuffer());
    const hash = sha(bytes);
    assert.equal(hash, sha(readFileSync(join(dir, file))), `${file}: deployed bytes differ`);
    referenceHashes.push({ file, sha256: hash, bytes: bytes.length });
  }
  return {
    base, story: entry.id, contentVersion: remote.contentVersion,
    jsonFiles: files.length, images: hashes, references: referenceHashes,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const localOnly = args.includes('--local-only');
  const ids = args.filter((arg) => arg !== '--local-only');
  const entries = entriesFor(ids);
  if (localOnly) {
    let imageCount = 0;
    for (const entry of entries) {
      const { assets } = validateLocalEntry(entry);
      imageCount += assets.length;
      console.log(JSON.stringify({ story: entry.id, images: assets.map(({ file, localBytes, dimensions }) => ({ file, bytes: localBytes.length, ...dimensions })) }));
    }
    console.log(`::notice title=Local story media validated::${entries.length} stories and ${imageCount} native-size JPEG media files validated.`);
    return;
  }
  // New packages and the manifest can propagate separately. Require two
  // consecutive complete passes for every requested story on both hosts.
  const bases = ['https://beyondredeye.site/api', 'https://www.beyondredeye.site/api'];
  for (const base of bases) {
    let consecutive = 0;
    for (let attempt = 1; attempt <= 18; attempt++) {
      try {
        const results = [];
        for (const entry of entries) results.push(await verify(base, fetch, entry));
        consecutive++;
        for (const result of results) console.log(JSON.stringify(result));
        if (consecutive === 2) {
          const imageCount = results.reduce((total, result) => total + result.images.length, 0);
          console.log(`::notice title=Published stories verified::${base}: ${entries.length} stories, contentVersion ${manifest.contentVersion}; all packages and ${imageCount} byte-identical cover/gallery images passed twice.`);
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
