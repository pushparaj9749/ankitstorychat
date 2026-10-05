/**
 * OTA catalog delivery through the REAL Worker.
 *
 * The two new stories are content-only additions: they must be discoverable
 * and playable by the already-installed v2.5.1 app, purely through the
 * existing remote pipeline (repo content → CI assets → Cloudflare Worker →
 * app). This suite therefore feeds the Worker the ACTUAL repository content
 * (manifest + both published packages + every registered image) and asserts
 * the exact URLs an installed app fetches:
 *
 *   GET /api/manifest                                  → both new stories listed
 *   GET /api/stories/<dir>                             → whole package
 *   GET /api/stories/<dir>/{story,characters,...}.json → per-file JSON
 *   GET /api/stories/<dir>/assets/cover.jpg            → image/jpeg
 *   GET /api/stories/<dir>/assets/gallery/image-NN.jpg → image/jpeg (every one)
 *   GET /api/stories/<dir>/assets/references/<id>.jpg  → canonical identity ref
 *
 * Nothing here is story-specific logic: it only proves the shipped content
 * travels over the existing allowlist.
 */
import worker from '../src/index';
import { resetRateLimiterForTests, type Env } from '../src/router';

/**
 * This suite reads the real repository content, so it needs filesystem access.
 * The Worker project typechecks against Cloudflare Workers types only (no
 * @types/node), so the two Node globals are declared locally — at runtime
 * jest provides the real implementations.
 */
declare const require: (id: string) => { readFileSync: (path: string) => Uint8Array };
declare const __dirname: string;

const fs = require('fs');
const path = require('path') as unknown as { join: (...parts: string[]) => string };
const REPO = path.join(__dirname, '..', '..');
const readFileSync = (file: string): Uint8Array => fs.readFileSync(file);
const readJson = (file: string) => JSON.parse(new TextDecoder().decode(readFileSync(file)));

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}
const manifest = readJson(path.join(REPO, 'content', 'manifest.json')) as {
  contentVersion: number;
  stories: { id: string; storyDir: string }[];
};

const NEW_STORY_IDS = ['tumhe-kabhi-pata-hi-nahi-chala', 'jo-usne-bataya-nahi'];

/** Build the assets binding from the real repo content (what CI deploys). */
function realAssets(): { files: Map<string, Uint8Array>; assets: Env['ASSETS'] } {
  const files = new Map<string, Uint8Array>();
  const add = (key: string, file: string) => files.set(key, readFileSync(file));
  add('content/manifest.json', path.join(REPO, 'content', 'manifest.json'));
  for (const entry of manifest.stories) {
    const dir = path.join(REPO, 'content', 'stories', entry.storyDir);
    for (const file of ['story', 'characters', 'world', 'scenes', 'memory']) {
      try {
        add(`content/stories/${entry.storyDir}/${file}.json`, path.join(dir, `${file}.json`));
      } catch {
        /* the test only needs the two new packages plus the manifest */
      }
    }
  }
  for (const id of NEW_STORY_IDS) {
    const dir = path.join(REPO, 'content', 'stories', id);
    const story = readJson(path.join(dir, 'story.json'));
    for (const item of story.media.gallery as { file: string }[]) {
      add(`content/stories/${id}/${item.file}`, path.join(dir, item.file));
    }
    const characters = readJson(path.join(dir, 'characters.json')) as {
      playerVisualReference?: { file: string };
      characters: { visualReference?: { file: string } }[];
    };
    const refs = [
      characters.playerVisualReference?.file,
      ...characters.characters.map((c) => c.visualReference?.file),
    ].filter((f): f is string => typeof f === 'string');
    for (const ref of new Set(refs)) add(`content/stories/${id}/${ref}`, path.join(dir, ref));
  }
  const assets = {
    fetch: async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      const key = new URL(url).pathname.replace(/^\//, '');
      const body = files.get(key);
      if (!body) return new Response('Not Found', { status: 404 });
      return new Response(body as unknown as BodyInit, { status: 200 });
    },
  };
  return { files, assets: assets as unknown as Env['ASSETS'] };
}

const { files, assets } = realAssets();
const env = { ASSETS: assets } as unknown as Env;

function get(path: string): Promise<Response> {
  return worker.fetch(
    new Request(`https://beyondredeye.site${path}`, { method: 'GET' }),
    env,
    {} as never,
  ) as Promise<Response>;
}

beforeEach(() => resetRateLimiterForTests());

describe('OTA catalog: the new stories travel through the existing Worker', () => {
  test('the deployed manifest lists both new stories with their remote covers', async () => {
    const res = await get('/api/manifest');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      contentVersion: number;
      stories: { id: string; title: string; coverUrl: string; tags: string[] }[];
    };
    expect(body.contentVersion).toBe(manifest.contentVersion);
    const ids = body.stories.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(NEW_STORY_IDS));
    for (const id of NEW_STORY_IDS) {
      const entry = body.stories.find((s) => s.id === id)!;
      expect(entry.coverUrl).toBe(`stories/${id}/assets/cover.jpg`);
      expect(entry.tags).toContain('ongoing');
    }
  });

  test('every JSON file of both new packages is served and byte-identical', async () => {
    for (const id of NEW_STORY_IDS) {
      const pkg = await get(`/api/stories/${id}`);
      expect(pkg.status).toBe(200);
      expect(pkg.headers.get('content-type')?.split(';')[0]).toBe('application/json');
      const body = (await pkg.json()) as Record<string, unknown>;
      for (const file of ['story', 'characters', 'world', 'scenes', 'memory']) {
        const disk = readJson(path.join(REPO, 'content', 'stories', id, `${file}.json`));
        expect(body[file]).toEqual(disk);
        const single = await get(`/api/stories/${id}/${file}.json`);
        expect(single.status).toBe(200);
        expect(await single.json()).toEqual(disk);
      }
    }
  });

  test('cover, every gallery image and every canonical reference is served as image/jpeg', async () => {
    for (const id of NEW_STORY_IDS) {
      const story = readJson(path.join(REPO, 'content', 'stories', id, 'story.json'));
      const mediaFiles = (story.media.gallery as { file: string }[]).map((g) => g.file);
      expect(new Set(mediaFiles).size).toBe(mediaFiles.length);
      expect(mediaFiles).toContain(story.media.cover);
      const characters = readJson(path.join(REPO, 'content', 'stories', id, 'characters.json'));
      const referenceFiles = [
        characters.playerVisualReference?.file,
        ...(characters.characters as { visualReference?: { file: string } }[]).map(
          (c) => c.visualReference?.file,
        ),
      ].filter((f): f is string => typeof f === 'string');

      for (const file of [...mediaFiles, ...referenceFiles]) {
        const res = await get(`/api/stories/${id}/${file}`);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')?.split(';')[0]).toBe('image/jpeg');
        const bytes = new Uint8Array(await res.arrayBuffer());
        const disk = readFileSync(path.join(REPO, 'content', 'stories', id, file));
        expect(sameBytes(bytes, disk)).toBe(true);
        expect(sameBytes(files.get(`content/stories/${id}/${file}`)!, bytes)).toBe(true);
      }
    }
  });

  test('the OTA allowlist still rejects anything the SDK must not fetch', async () => {
    const id = NEW_STORY_IDS[0];
    for (const path of [
      `/api/stories/${id}/secrets.json`,
      `/api/stories/${id}/assets/references/../mc.jpg`,
      `/api/stories/${id}/assets/references/mc.png`,
      `/api/stories/${id}/assets/gallery/image-99.jpg`,
      `/api/stories/not-a-story/story.json`,
    ]) {
      const res = await get(path);
      expect(res.status).toBe(404);
    }
  });
});
