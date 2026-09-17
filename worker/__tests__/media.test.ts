/**
 * Tests for the submission MEDIA system (cover + gallery).
 *
 * Covers: image validation (signature/size/dimensions), the upload endpoint,
 * cover-required story submission, private-pending media, admin preview
 * authorization, publish-time media rewrite + public serving, and cleanup of
 * rejected/expired uploads. Uses the in-memory KV shim.
 */
import worker from '../src/index';
import {
  memKv,
  resetMemKvForTests,
  GLOBAL_DAILY_LIMIT,
  type Env,
} from '../src/submissions';
import { resetContentIndexForTests } from '../src/router';
import {
  MAX_IMAGE_BYTES,
  MAX_GALLERY_IMAGES,
  validateUploadedImage,
} from '../src/media';

/* ---------------- fixtures ---------------- */

/** Real 1x1 JPEG. */
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
/** Real 1x1 PNG. */
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Craft a WebP (VP8X) with a given canvas size. */
function makeWebP(width: number, height: number): string {
  const b = new Uint8Array(30);
  // RIFF
  b[0] = 0x52; b[1] = 0x49; b[2] = 0x46; b[3] = 0x46; // RIFF
  // size (28 payload bytes)
  b[4] = 28; b[5] = 0; b[6] = 0; b[7] = 0;
  // WEBP
  b[8] = 0x57; b[9] = 0x45; b[10] = 0x42; b[11] = 0x50;
  // VP8X
  b[12] = 0x56; b[13] = 0x50; b[14] = 0x38; b[15] = 0x58;
  // flags=0, reserved=0,0,0
  // width-1 / height-1 (24-bit LE)
  const w = width - 1, h = height - 1;
  b[20] = w & 0xff; b[21] = (w >> 8) & 0xff; b[22] = (w >> 16) & 0xff;
  b[23] = h & 0xff; b[24] = (h >> 8) & 0xff; b[25] = (h >> 16) & 0xff;
  return btoa(String.fromCharCode(...b));
}

/** Craft a PNG header claiming huge dimensions (rest is junk). */
function makeHugePng(width: number, height: number): string {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // 8-byte magic
  b[8] = 0; b[9] = 0; b[10] = 0; b[11] = 13; // IHDR length 13
  b.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  b[16] = (width >> 24) & 0xff; b[17] = (width >> 16) & 0xff;
  b[18] = (width >> 8) & 0xff; b[19] = width & 0xff;
  b[20] = (height >> 24) & 0xff; b[21] = (height >> 16) & 0xff;
  b[22] = (height >> 8) & 0xff; b[23] = height & 0xff;
  return btoa(String.fromCharCode(...b));
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/* ---------------- env helpers ---------------- */

let currentEnv: Env | null = null;

function makeEnv(adminToken?: string): Env {
  resetMemKvForTests();
  const files: Record<string, string> = {
    'content/manifest.json': JSON.stringify({ contentVersion: 99, stories: [] }),
  };
  const assets = {
    fetch: async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      const key = new URL(url).pathname.replace(/^\//, '');
      const body = files[key];
      if (body === undefined) return new Response('Not Found', { status: 404 });
      return new Response(body, { status: 200 });
    },
  };
  const env: Env = { ASSETS: assets as unknown as Env['ASSETS'], ADMIN_TOKEN: adminToken };
  currentEnv = env;
  return env;
}

function fetchWith(path: string, init: RequestInit): Promise<Response> {
  if (!currentEnv) throw new Error('call makeEnv first');
  return worker.fetch(new Request(`https://beyondredeye.site${path}`, init), currentEnv, {} as never) as Promise<Response>;
}
function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetchWith(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
function get(path: string): Promise<Response> {
  return fetchWith(path, { method: 'GET' });
}
function adminGet(path: string, token = 'secret'): Promise<Response> {
  return fetchWith(path, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
}
function adminPost(path: string, body: unknown, token = 'secret'): Promise<Response> {
  return fetchWith(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
}

async function uploadImage(image: string, kind: 'cover' | 'gallery' = 'cover'): Promise<{ ref: string; status: number }> {
  const res = await post('/api/submit/media', { kind, image });
  const status = res.status;
  if (status === 201) {
    const body = (await res.json()) as { ref: string };
    return { ref: body.ref, status };
  }
  return { ref: '', status };
}

/** Build a valid complete-story payload referencing the given media refs. */
async function storyPayload(coverRef: string, galleryRefs: string[] = [], storyOver: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const gallery = [
    { id: 'cover', file: coverRef, kind: 'cover', label: 'Cover' },
    ...galleryRefs.map((r, i) => ({ id: `img-${i + 1}`, file: r, kind: 'other' })),
  ];
  return {
    creatorName: 'Test',
    story: {
      id: 'media-tale',
      title: 'Media Tale',
      ageRating: '12-17',
      contentLevel: 'teen',
      openingSceneId: 's1',
      media: { cover: coverRef, gallery },
      ...storyOver,
    },
    scenes: { scenes: [{ id: 's1', title: 'Start', narration: ['hi'], choices: [] }], endings: [] },
  };
}

beforeEach(() => {
  resetContentIndexForTests();
  makeEnv('secret');
});

/* ---------------- pure image validation ---------------- */

describe('validateUploadedImage', () => {
  test('accepts a real JPEG with dimensions', () => {
    const v = validateUploadedImage(TINY_JPEG_B64);
    expect(v.ok).toBe(true);
    expect(v.image?.mime).toBe('image/jpeg');
    expect(v.image?.width).toBe(1);
    expect(v.image?.height).toBe(1);
  });

  test('accepts a real PNG', () => {
    const v = validateUploadedImage(TINY_PNG_B64);
    expect(v.ok).toBe(true);
    expect(v.image?.mime).toBe('image/png');
    expect(v.image?.ext).toBe('png');
  });

  test('accepts a WebP (VP8X) and reads its canvas size', () => {
    const v = validateUploadedImage(makeWebP(120, 160));
    expect(v.ok).toBe(true);
    expect(v.image?.mime).toBe('image/webp');
    expect(v.image?.width).toBe(120);
    expect(v.image?.height).toBe(160);
  });

  test('rejects non-image content (HTML / text)', () => {
    const html = btoa('<html><body>hi</body></html>');
    expect(validateUploadedImage(html).ok).toBe(false);
    const text = btoa('plain text, not an image');
    expect(validateUploadedImage(text).ok).toBe(false);
  });

  test('rejects GIF (unsupported signature)', () => {
    // GIF89a magic.
    const gif = bytesToB64(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 1, 0, 0, 0]));
    expect(validateUploadedImage(gif).ok).toBe(false);
  });

  test('rejects malformed base64', () => {
    expect(validateUploadedImage('!!!not-base64!!!').ok).toBe(false);
    expect(validateUploadedImage(123).ok).toBe(false);
  });

  test('rejects oversize images (over MAX_IMAGE_BYTES)', () => {
    // Valid JPEG magic + padding to exceed the limit.
    const header = atob(TINY_JPEG_B64.slice(0, 24));
    const pad = new Uint8Array(MAX_IMAGE_BYTES - header.length + 1);
    const big = new Uint8Array(header.length + pad.length);
    for (let i = 0; i < header.length; i++) big[i] = header.charCodeAt(i);
    big.set(pad, header.length);
    const v = validateUploadedImage(bytesToB64(big));
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.message.includes('too large'))).toBe(true);
  });

  test('rejects oversized dimensions', () => {
    const v = validateUploadedImage(makeHugePng(5000, 5000));
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.message.toLowerCase().includes('dimension'))).toBe(true);
  });

  test('tolerates a data-URI prefix', () => {
    const v = validateUploadedImage(`data:image/jpeg;base64,${TINY_JPEG_B64}`);
    expect(v.ok).toBe(true);
    expect(v.image?.mime).toBe('image/jpeg');
  });
});

/* ---------------- upload endpoint ---------------- */

describe('POST /api/submit/media', () => {
  test('returns a safe server-issued ref', async () => {
    const { ref, status } = await uploadImage(TINY_JPEG_B64);
    expect(status).toBe(201);
    expect(ref).toMatch(/^media\/media_[a-z0-9]{6,16}_[a-z0-9]{6,16}$/);
  });

  test('rejects an invalid kind', async () => {
    const { status } = await uploadImage(TINY_JPEG_B64);
    void status;
    const res = await post('/api/submit/media', { kind: 'evil', image: TINY_JPEG_B64 });
    expect(res.status).toBe(400);
  });

  test('rejects a non-image upload', async () => {
    const res = await post('/api/submit/media', { kind: 'cover', image: btoa('hello world') });
    expect(res.status).toBe(400);
  });

  test('does NOT consume the 50/24h submission limit', async () => {
    for (let i = 0; i < 3; i++) {
      await uploadImage(TINY_JPEG_B64, i % 2 ? 'gallery' : 'cover');
    }
    const lim = await (await get('/api/submit/limit')).json() as { count: number };
    expect(lim.count).toBe(0); // uploads are free
  });
});

/* ---------------- cover-required story submission ---------------- */

describe('story submission media rules', () => {
  test('rejects a story without media', async () => {
    const res = await post('/api/submit/story', {
      creatorName: 'T',
      story: { id: 'no-cover', title: 'T', ageRating: '12-17', contentLevel: 'teen', openingSceneId: 's1' },
      scenes: { scenes: [{ id: 's1', title: 'S', narration: ['x'], choices: [] }], endings: [] },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { issues: { path: string }[] };
    expect(body.issues.some((i) => i.path === 'story.media')).toBe(true);
  });

  test('rejects arbitrary / unsafe media paths', async () => {
    const res = await post('/api/submit/story', await storyPayload('../../etc/passwd'));
    expect(res.status).toBe(400);
  });

  test('rejects a media ref that was never uploaded / expired', async () => {
    const res = await post('/api/submit/story', await storyPayload('media/media_deadbe_deadbeef'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { issues: { path: string }[] };
    expect(body.issues.some((i) => i.path === 'story.media')).toBe(true);
  });

  test('accepts a valid story with cover + gallery', async () => {
    const cover = (await uploadImage(TINY_JPEG_B64)).ref;
    const g1 = (await uploadImage(TINY_PNG_B64, 'gallery')).ref;
    const res = await post('/api/submit/story', await storyPayload(cover, [g1]));
    expect(res.status).toBe(201);
  });

  test('rejects a gallery over the max count', async () => {
    const cover = (await uploadImage(TINY_JPEG_B64)).ref;
    const refs: string[] = [];
    for (let i = 0; i < MAX_GALLERY_IMAGES; i++) {
      refs.push((await uploadImage(TINY_PNG_B64, 'gallery')).ref);
    }
    // cover + MAX more = one over the limit
    const res = await post('/api/submit/story', await storyPayload(cover, refs));
    expect(res.status).toBe(400);
  });
});

/* ---------------- privacy: pending media is never public ---------------- */

describe('pending media privacy', () => {
  test('pending media is not served by any public route', async () => {
    const { ref } = await uploadImage(TINY_JPEG_B64);
    // There is no public GET that resolves a `media/<id>` ref.
    const asStoryFile = await get(`/api/stories/community/whatever/${ref}`);
    expect(asStoryFile.status).toBe(404);
    const asCover = await get(`/api/covers/${ref}.jpg`);
    expect(asCover.status).toBe(404);
    const raw = await get(`/api/submit/${ref}`);
    expect(raw.status).toBe(404);
  });

  test('admin media preview requires the admin token', async () => {
    const { ref } = await uploadImage(TINY_JPEG_B64);
    const id = ref.replace('media/', '');
    // No token -> 401
    const noAuth = await fetchWith(`/api/admin/media/${id}`, { method: 'GET' });
    expect(noAuth.status).toBe(401);
    // Wrong token -> 401
    const wrong = await adminGet(`/api/admin/media/${id}`, 'wrong-token');
    expect(wrong.status).toBe(401);
    // Correct token -> image bytes
    const ok = await adminGet(`/api/admin/media/${id}`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Content-Type')).toBe('image/jpeg');
    const bytes = new Uint8Array(await ok.arrayBuffer());
    expect(bytes[0]).toBe(0xff);
  });
});

/* ---------------- publish: media rewrite + public serving ---------------- */

describe('publish media flow', () => {
  test('accept & publish rewrites refs and serves media publicly', async () => {
    const cover = (await uploadImage(TINY_JPEG_B64)).ref;
    const g1 = (await uploadImage(TINY_PNG_B64, 'gallery')).ref;
    const sub = await post('/api/submit/story', await storyPayload(cover, [g1]));
    expect(sub.status).toBe(201);
    const { id } = (await sub.json()) as { id: string };

    const acc = await adminPost(`/api/admin/story/${id}/accept`, {});
    expect(acc.status).toBe(200);

    // Pending media is copied to permanent storage; original upload dropped.
    expect(await memKv.get(`m:${cover.replace('media/', '')}`)).toBeNull();

    // Package exposes rewritten, allowlisted asset paths.
    resetContentIndexForTests();
    const pkg = (await (await get('/api/stories/community/media-tale')).json()) as {
      story: { media: { cover: string; gallery: { file: string }[] } };
    };
    expect(pkg.story.media.cover).toBe('assets/cover.jpg');
    expect(pkg.story.media.gallery).toHaveLength(2);
    const g1File = pkg.story.media.gallery[1].file;
    expect(g1File).toMatch(/^assets\/gallery\/image-01\.png$/);

    // Public serving of the rewritten cover + gallery.
    const coverRes = await get('/api/stories/community/media-tale/assets/cover.jpg');
    expect(coverRes.status).toBe(200);
    expect(coverRes.headers.get('Content-Type')).toBe('image/jpeg');
    const g1Res = await get(`/api/stories/community/media-tale/${g1File}`);
    expect(g1Res.status).toBe(200);
    expect(g1Res.headers.get('Content-Type')).toBe('image/png');

    // Manifest lists the community story with a resolvable coverUrl.
    const man = (await (await get('/api/manifest')).json()) as { stories: { storyDir: string; coverUrl: string }[] };
    const entry = man.stories.find((s) => s.storyDir === 'community/media-tale');
    expect(entry?.coverUrl).toBe('stories/community/media-tale/assets/cover.jpg');
  });

  test('pending story is hidden before acceptance', async () => {
    const cover = (await uploadImage(TINY_JPEG_B64)).ref;
    const sub = await post('/api/submit/story', await storyPayload(cover));
    expect(sub.status).toBe(201);
    resetContentIndexForTests();
    const man = (await (await get('/api/manifest')).json()) as { stories: { storyDir: string }[] };
    expect(man.stories.some((s) => s.storyDir === 'community/media-tale')).toBe(false);
    expect((await get('/api/stories/community/media-tale')).status).toBe(404);
  });
});

/* ---------------- cleanup: rejected + expired media ---------------- */

describe('media cleanup', () => {
  test('rejecting a story deletes its uploaded media', async () => {
    const cover = (await uploadImage(TINY_JPEG_B64)).ref;
    const coverId = cover.replace('media/', '');
    expect(await memKv.get(`m:${coverId}`)).toBeTruthy();

    const sub = await post('/api/submit/story', await storyPayload(cover));
    const { id } = (await sub.json()) as { id: string };
    const rej = await adminPost(`/api/admin/story/${id}/reject`, {});
    expect(rej.status).toBe(200);
    // Media cleaned up after rejection.
    expect(await memKv.get(`m:${coverId}`)).toBeNull();
  });

  test('media shared with another pending submission is kept on reject', async () => {
    const shared = (await uploadImage(TINY_JPEG_B64)).ref;
    const sharedId = shared.replace('media/', '');
    // Two submissions reference the same media.
    const s1 = await post('/api/submit/story', await storyPayload(shared, [], { id: 'story-a' }));
    const s2 = await post('/api/submit/story', await storyPayload(shared, [], { id: 'story-b' }));
    expect(s1.status).toBe(201);
    expect(s2.status).toBe(201);
    const id1 = (await s1.json()) as { id: string };
    await adminPost(`/api/admin/story/${id1.id}/reject`, {});
    // Still referenced by the other pending submission -> kept.
    expect(await memKv.get(`m:${sharedId}`)).toBeTruthy();
  });

  test('expired pending submission has its media cleaned up', async () => {
    const cover = (await uploadImage(TINY_JPEG_B64)).ref;
    const coverId = cover.replace('media/', '');
    const sub = await post('/api/submit/story', await storyPayload(cover));
    const { id } = (await sub.json()) as { id: string };
    expect(await memKv.get(`m:${coverId}`)).toBeTruthy();

    // Backdate the submission past its 24h expiry.
    const raw = await memKv.get(`sub:${id}`);
    const parsed = JSON.parse(raw as string) as { expiresAt: string };
    parsed.expiresAt = new Date(Date.now() - 1000).toISOString();
    await memKv.put(`sub:${id}`, JSON.stringify(parsed));

    // A pending list triggers lazy expiry + media cleanup.
    const list = await adminGet('/api/admin/pending');
    expect(list.status).toBe(200);
    const body = (await list.json()) as { stories: { id: string }[] };
    expect(body.stories.some((s) => s.id === id)).toBe(false);
    expect(await memKv.get(`m:${coverId}`)).toBeNull();
  });
});

/* ---------------- global limit still enforced ---------------- */

describe('limit with media', () => {
  test('the 50/24h global limit still applies to story submissions', async () => {
    const cover = (await uploadImage(TINY_JPEG_B64)).ref;
    let ok = 0;
    for (let i = 0; i < GLOBAL_DAILY_LIMIT; i++) {
      const r = await post('/api/submit/story', await storyPayload(cover, [], { id: `s${i}` }));
      if (r.status === 201) ok++;
    }
    expect(ok).toBe(GLOBAL_DAILY_LIMIT);
    const blocked = await post('/api/submit/story', await storyPayload(cover, [], { id: 'blocked' }));
    expect(blocked.status).toBe(429);
  });
});
