/**
 * Tests for the Kissa submission system.
 *
 * Covers: validation, the global 50/24h limit, expiry semantics, admin
 * accept/reject gating, and basic CORS behaviour. The in-memory KV shim is
 * used automatically when no KV binding is passed.
 */
import worker from '../src/index';
import {
  GLOBAL_DAILY_LIMIT,
  validateIdea,
  validateStorySubmission,
  sanitizeName,
  containsUnsafe,
  resetMemKvForTests,
  memKv,
} from '../src/submissions';
import { resetContentIndexForTests } from '../src/router';
import type { Env } from '../src/submissions';

let currentEnv: Env | null = null;

function makeEnv(adminToken?: string): Env {
  // Create one env per test case so all calls share the same memKv shim.
  resetMemKvForTests();
  const files = {
    'content/manifest.json': JSON.stringify({ contentVersion: 99, stories: [] }),
  };
  const assets = {
    fetch: async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      const key = new URL(url).pathname.replace(/^\//, '');
      const body = (files as Record<string, string>)[key];
      if (body === undefined) return new Response('Not Found', { status: 404 });
      return new Response(body, { status: 200 });
    },
  };
  const env: Env = { ASSETS: assets as unknown as Env['ASSETS'], ADMIN_TOKEN: adminToken };
  currentEnv = env;
  return env;
}

/** Issue a request against the CURRENT env (set by the most recent makeEnv). */
function fetchWith(path: string, init: RequestInit): Promise<Response> {
  if (!currentEnv) throw new Error('call makeEnv first');
  return worker.fetch(
    new Request(`https://beyondredeye.site${path}`, init),
    currentEnv,
    {} as never,
  ) as Promise<Response>;
}

beforeEach(() => {
  resetContentIndexForTests();
  makeEnv();
});

function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetchWith(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function adminPost(path: string, body: unknown, token = 'secret'): Promise<Response> {
  // Ensure the env knows the admin token.
  if (currentEnv) (currentEnv as { ADMIN_TOKEN?: string }).ADMIN_TOKEN = token;
  return fetchWith(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

function adminGet(path: string, token = 'secret'): Promise<Response> {
  if (currentEnv) (currentEnv as { ADMIN_TOKEN?: string }).ADMIN_TOKEN = token;
  return fetchWith(path, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function get(path: string): Promise<Response> {
  return fetchWith(path, { method: 'GET' });
}

/** A real, valid 1x1 JPEG (base64) for media upload tests. */
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

/** Upload a small valid image and return its server-issued safe ref. */
async function uploadCover(): Promise<string> {
  const res = await post('/api/submit/media', { kind: 'cover', image: TINY_JPEG_B64 });
  if (res.status !== 201) throw new Error(`media upload failed: ${res.status}`);
  const body = (await res.json()) as { ref: string };
  return body.ref;
}

/** A minimal VALID complete-story payload (with a real uploaded cover). */
async function storyPayload(over: {
  creatorName?: string;
  creator?: Record<string, unknown>;
  story?: Record<string, unknown>;
  scenes?: Record<string, unknown>;
  extra?: Record<string, unknown>;
} = {}): Promise<Record<string, unknown>> {
  const ref = await uploadCover();
  return {
    creatorName: over.creatorName ?? 'Test',
    ...(over.creator ? { creator: over.creator } : {}),
    story: {
      id: 'test-story',
      title: 'Test Story',
      ageRating: '12-17',
      contentLevel: 'teen',
      openingSceneId: 's1',
      media: {
        cover: ref,
        gallery: [{ id: 'cover', file: ref, kind: 'cover', label: 'Cover' }],
      },
      ...(over.story ?? {}),
    },
    scenes:
      over.scenes ?? { scenes: [{ id: 's1', title: 'Start', narration: ['hi'], choices: [] }], endings: [] },
    ...(over.extra ?? {}),
  };
}

describe('submission validation helpers', () => {
  test('sanitizeName trims and rejects empty / scripted / long', () => {
    expect(sanitizeName('  Ankit  ')).toEqual({ ok: true, value: 'Ankit' });
    expect(sanitizeName('').ok).toBe(false);
    expect(sanitizeName('   ').ok).toBe(false);
    expect(sanitizeName('<script>x</script>').ok).toBe(false);
    expect(sanitizeName('x'.repeat(80)).ok).toBe(false);
  });
  test('containsUnsafe blocks script / iframe / javascript:', () => {
    expect(containsUnsafe('hello world')).toBe(false);
    expect(containsUnsafe('<script>alert(1)</script>')).toBe(true);
    expect(containsUnsafe('<iframe src="x"></iframe>')).toBe(true);
    expect(containsUnsafe('javascript:alert(1)')).toBe(true);
  });
  test('idea requires creatorName, title, concept, genre', () => {
    expect(validateIdea({}).ok).toBe(false);
    expect(validateIdea({ creatorName: 'A', title: 'T', concept: 'C', genre: 'G' }).ok).toBe(true);
    // creator name via creator object
    expect(validateIdea({ creator: { name: 'A' }, title: 'T', concept: 'C', genre: 'G' }).ok).toBe(true);
  });
  test('story submission requires a valid story.id + creator', () => {
    const bad = validateStorySubmission({});
    expect(bad.ok).toBe(false);
    const good = validateStorySubmission({
      creatorName: 'Ankit',
      story: {
        id: 'my-story',
        title: 'My Story',
        ageRating: '12-17',
        contentLevel: 'teen',
        openingSceneId: 's1',
        media: {
          cover: 'media/media_abc123_abc12345',
          gallery: [{ id: 'cover', file: 'media/media_abc123_abc12345', kind: 'cover', label: 'Cover' }],
        },
      },
    });
    expect(good.ok).toBe(true);
    // A complete story without a Media Library (cover) is rejected.
    const noMedia = validateStorySubmission({
      creatorName: 'Ankit',
      story: { id: 'my-story-3', title: 'T', ageRating: '12-17', contentLevel: 'teen', openingSceneId: 's1' },
    });
    expect(noMedia.ok).toBe(false);
    expect(noMedia.issues.some((i) => i.path === 'story.media')).toBe(true);
    // Media refs must be the server-issued pending form — never arbitrary paths.
    const badRef = validateStorySubmission({
      creatorName: 'Ankit',
      story: {
        id: 'my-story-4',
        title: 'T',
        ageRating: '12-17',
        contentLevel: 'teen',
        openingSceneId: 's1',
        media: {
          cover: '../../etc/passwd',
          gallery: [{ id: 'cover', file: '../../etc/passwd', kind: 'cover' }],
        },
      },
    });
    expect(badRef.ok).toBe(false);
    // Self-verification is silently dropped: cleaned bundle.story.creator.verified = false.
    const selfVerify = validateStorySubmission({
      creator: { name: 'Ankit', verified: true },
      story: {
        id: 'my-story-2',
        title: 'T',
        ageRating: '12-17',
        contentLevel: 'teen',
        openingSceneId: 's1',
        media: {
          cover: 'media/media_abc123_abc12345',
          gallery: [{ id: 'cover', file: 'media/media_abc123_abc12345', kind: 'cover' }],
        },
      },
    });
    expect(selfVerify.ok).toBe(true);
    const cleanedStory = selfVerify.cleaned?.bundle.story as Record<string, unknown> | undefined;
    expect((cleanedStory?.creator as Record<string, unknown> | undefined)?.verified).toBe(false);
    // Bad slug.
    expect(validateStorySubmission({ creatorName: 'A', story: { id: 'BAD_slug!', title: 'T', ageRating: '12-17', contentLevel: 'teen', openingSceneId: 's1' } }).ok).toBe(false);
  });
});

describe('POST /api/submit/idea', () => {
  test('accepts a valid idea', async () => {
    const res = await post('/api/submit/idea', {
      creatorName: 'Priya',
      title: 'Idea 1',
      concept: 'A love-hate story in Delhi metro.',
      genre: 'Romance',
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: boolean; id: string; creatorName: string };
    expect(body.ok).toBe(true);
    expect(body.creatorName).toBe('Priya');
    expect(body.id).toMatch(/^idea_/);
  });

  test('rejects missing creator name', async () => {
    const res = await post('/api/submit/idea', { title: 'T', concept: 'C', genre: 'G' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { issues: { path: string }[] };
    expect(body.issues.some((i) => i.path === 'creatorName')).toBe(true);
  });

  test('rejects invalid JSON', async () => {
    const res = await worker.fetch(
      new Request('https://beyondredeye.site/api/submit/idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-json',
      }),
      makeEnv(),
      {} as never,
    ) as Response;
    expect(res.status).toBe(400);
  });
});

describe('global daily limit (50)', () => {
  test('the 51st submission is blocked across types', async () => {
    makeEnv();
    async function submitOne(i: number): Promise<Response> {
      return post('/api/submit/idea', { creatorName: `U${i}`, title: `T${i}`, concept: `C${i}`, genre: 'G' });
    }
    for (let i = 0; i < GLOBAL_DAILY_LIMIT; i++) {
      const r = await submitOne(i);
      expect(r.status).toBe(201);
    }
    const blocked = await submitOne(99);
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { limitReached: boolean };
    expect(body.limitReached).toBe(true);

    // Cross-type: complete story submissions also count against the same limit.
    const blockedStory = await post('/api/submit/story', await storyPayload({ creatorName: 'X' }));
    expect(blockedStory.status).toBe(429);
  });
});

describe('admin routes', () => {
  test('admin routes require Authorization header', async () => {
    makeEnv('secret');
    const res = await get('/api/admin/pending');
    expect(res.status).toBe(401);
  });

  test('admin can list pending ideas and accept/reject them', async () => {
    makeEnv('secret');
    const created = await post('/api/submit/idea', { creatorName: 'N', title: 'TT', concept: 'CC', genre: 'G' });
    const { id } = (await created.json()) as { id: string };

    const list1 = await adminGet('/api/admin/pending');
    const list1Body = (await list1.json()) as { ideas: { id: string }[] };
    expect(list1Body.ideas.some((i) => i.id === id)).toBe(true);

    const rejected = await adminPost(`/api/admin/idea/${id}/reject`, {});
    expect(rejected.status).toBe(200);

    const list2 = await adminGet('/api/admin/pending');
    const list2Body = (await list2.json()) as { ideas: { id: string }[] };
    expect(list2Body.ideas.some((i) => i.id === id)).toBe(false);
  });

  test('admin can accept a complete story submission', async () => {
    makeEnv('secret');
    const submitted = await post(
      '/api/submit/story',
      await storyPayload({
        creatorName: 'Mira',
        story: { id: 'mira-tale', title: 'Mira Tale' },
        scenes: { scenes: [{ id: 's1', title: 'Start', narration: ['Hello'], choices: [] }], endings: [] },
      }),
    );
    const { id } = (await submitted.json()) as { id: string };
    const accepted = await adminPost(`/api/admin/story/${id}/accept`, {});
    expect(accepted.status).toBe(200);
    const list = await adminGet('/api/admin/pending');
    const body = (await list.json()) as { stories: { id: string }[] };
    expect(body.stories.some((s) => s.id === id)).toBe(false);
  });
});

describe('end-to-end publish flow', () => {
  test('accepted story appears in public manifest and is fetchable; pending never leaks', async () => {
    makeEnv('secret');
    const sub = await post(
      '/api/submit/story',
      await storyPayload({
        creatorName: 'Priya',
        story: { id: 'priya-forest', title: 'Priya Forest Tale', tagline: 'A short tale', genres: ['Fantasy'] },
        scenes: { scenes: [{ id: 's1', title: 'Start', narration: ['Once upon a time'], choices: [] }], endings: [] },
      }),
    );
    expect(sub.status).toBe(201);
    const { id } = (await sub.json()) as { id: string };

    resetContentIndexForTests();
    const manifestBefore = await (await get('/api/manifest')).json() as { stories: { storyDir: string }[] };
    expect(manifestBefore.stories.some((s) => s.storyDir === 'community/priya-forest')).toBe(false);
    const miss = await get('/api/stories/community/priya-forest');
    expect(miss.status).toBe(404);

    const acc = await adminPost(`/api/admin/story/${id}/accept`, {});
    expect(acc.status).toBe(200);

    resetContentIndexForTests();
    const manifestAfter = await (await get('/api/manifest')).json() as { stories: Record<string, unknown>[] };
    const published = manifestAfter.stories.find((s) => s.storyDir === 'community/priya-forest');
    expect(published).toBeTruthy();
    expect(published?.community).toBe(true);
    expect((published?.creator as { name: string })?.name).toBe('Priya');
    expect((published?.creator as { verified: boolean })?.verified).toBe(false);

    const pkgRes = await get('/api/stories/community/priya-forest');
    expect(pkgRes.status).toBe(200);
    const pkg = (await pkgRes.json()) as {
      source: string;
      creator: { name: string; verified: boolean };
      story: { media?: { cover?: string; gallery?: { file?: string }[] } };
    };
    expect(pkg.source).toBe('community');
    expect(pkg.creator.name).toBe('Priya');
    expect(pkg.creator.verified).toBe(false);
    // Pending media refs are rewritten to allowlisted published asset paths.
    expect(pkg.story?.media?.cover).toMatch(/^assets\/cover\.(jpg|png|webp)$/);
    expect(pkg.story?.media?.gallery?.[0]?.file).toBe(pkg.story?.media?.cover);
    const publishedCover = String(pkg.story?.media?.cover ?? '');
    expect((published as Record<string, unknown> | undefined)?.coverUrl).toBe(
      `stories/community/priya-forest/${publishedCover}`,
    );

    // The published cover is publicly served (and only the allowlisted paths).
    const coverRes = await get(`/api/stories/community/priya-forest/${publishedCover}`);
    expect(coverRes.status).toBe(200);
    expect(coverRes.headers.get('Content-Type')).toBe('image/jpeg');
    const raw = await coverRes.arrayBuffer();
    expect(new Uint8Array(raw)[0]).toBe(0xff); // JPEG magic byte
    // Arbitrary paths are still refused.
    expect((await get('/api/stories/community/priya-forest/assets/../../etc/passwd')).status).toBe(404);
  });

  test('self-supplied verified flag is ignored', async () => {
    makeEnv('secret');
    const sub = await post(
      '/api/submit/story',
      await storyPayload({
        creatorName: 'Hacker',
        creator: { name: 'Hacker', verified: true },
        story: { id: 'hack-tale', title: 'Hack' },
        scenes: { scenes: [{ id: 's1', title: 'Start', narration: ['nope'], choices: [] }], endings: [] },
      }),
    );
    const { id } = (await sub.json()) as { id: string };
    const acc = await adminPost(`/api/admin/story/${id}/accept`, {});
    expect(acc.status).toBe(200);
    resetContentIndexForTests();
    const man = await (await get('/api/manifest')).json() as { stories: Record<string, unknown>[] };
    const entry = man.stories.find((s) => s.storyDir === 'community/hack-tale');
    expect((entry?.creator as { verified: boolean })?.verified).toBe(false);
  });

  test('stories with unsafe markup are rejected at publish', async () => {
    makeEnv('secret');
    const sub = await post(
      '/api/submit/story',
      await storyPayload({
        creatorName: 'XSS',
        story: { id: 'xss-tale', title: '<script>alert(1)</script>' },
        scenes: { scenes: [{ id: 's1', title: 'Start', narration: ['hi'], choices: [] }], endings: [] },
      }),
    );
    const { id } = (await sub.json()) as { id: string };
    const acc = await adminPost(`/api/admin/story/${id}/accept`, {});
    expect(acc.status).toBe(400);
  });

  test('age/content mismatch rejected at publish', async () => {
    makeEnv('secret');
    const sub = await post(
      '/api/submit/story',
      await storyPayload({
        creatorName: 'Teen',
        story: { id: 'mismatch', title: 'Mismatch', ageRating: '12-17', contentLevel: 'mature' },
        scenes: { scenes: [{ id: 's1', title: 'Start', narration: ['x'], choices: [] }], endings: [] },
      }),
    );
    const { id } = (await sub.json()) as { id: string };
    const acc = await adminPost(`/api/admin/story/${id}/accept`, {});
    expect(acc.status).toBe(400);
  });
});
