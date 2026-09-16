/**
 * Kissa story content API — Worker tests.
 *
 * Exercises the real Worker fetch handler against a mocked static-assets
 * binding, covering: routing, allowlists, path-traversal rejection, CORS,
 * caching headers, rate limiting and clean error bodies.
 */
import worker from '../src/index';
import {
  parseApiRoute,
  inMemoryRateLimit,
  resetRateLimiterForTests,
  RATE_LIMIT,
  type Env,
} from '../src/router';

const STORIES = {
  'content/manifest.json': JSON.stringify({
    contentVersion: 5,
    minAppVersion: '1.0.0',
    stories: [
      { id: 'goddess-who-chose-me', storyDir: 'goddess-who-chose-me' },
      { id: 'cafe-queen-myra', storyDir: 'cafe-queen-myra' },
    ],
  }),
  'content/stories/goddess-who-chose-me/story.json': JSON.stringify({ id: 'goddess-who-chose-me' }),
  'content/stories/goddess-who-chose-me/characters.json': JSON.stringify({ storyId: 'goddess-who-chose-me' }),
  'content/stories/goddess-who-chose-me/world.json': JSON.stringify({ storyId: 'goddess-who-chose-me' }),
  'content/stories/goddess-who-chose-me/scenes.json': JSON.stringify({ storyId: 'goddess-who-chose-me' }),
  'content/stories/goddess-who-chose-me/memory.json': JSON.stringify({ storyId: 'goddess-who-chose-me' }),
  'content/stories/goddess-who-chose-me/assets/cover.jpg': 'JPEGBYTES',
  'covers/cafe-queen-myra.jpg': 'JPEGBYTES2',
};

function makeEnv(files: Record<string, string> = STORIES): Env {
  const assets = {
    fetch: async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      const key = new URL(url).pathname.replace(/^\//, '');
      const body = files[key];
      if (body === undefined) return new Response('Not Found', { status: 404 });
      return new Response(body, { status: 200 });
    },
  };
  return { ASSETS: assets as unknown as Env['ASSETS'] };
}

function get(path: string, headers: Record<string, string> = {}): Promise<Response> {
  return worker.fetch(
    new Request(`https://beyondredeye.site${path}`, { method: 'GET', headers }),
    makeEnv(),
    {} as never,
  ) as Promise<Response>;
}

beforeEach(() => {
  resetRateLimiterForTests();
});

describe('routing (parseApiRoute)', () => {
  test('known routes parse', () => {
    expect(parseApiRoute('/api/health')).toEqual({ kind: 'health' });
    expect(parseApiRoute('/api/manifest')).toEqual({ kind: 'manifest' });
    expect(parseApiRoute('/api/stories/x')).toEqual({ kind: 'story-package', storyDir: 'x' });
    expect(parseApiRoute('/api/stories/x/story.json')).toEqual({
      kind: 'story-file',
      storyDir: 'x',
      file: 'story.json',
    });
    expect(parseApiRoute('/api/stories/x/assets/cover.jpg')).toEqual({
      kind: 'story-file',
      storyDir: 'x',
      file: 'assets/cover.jpg',
    });
    expect(parseApiRoute('/api/covers/x.jpg')).toEqual({ kind: 'cover', name: 'x.jpg' });
  });

  test('path traversal is rejected', () => {
    for (const p of [
      '/api/stories/../../etc/passwd',
      '/api/stories/x/../../../worker/src/index.ts',
      '/api/stories/x/%2e%2e/secret',
      '/api/stories/x/%2E%2E%2Fsecret',
      '/api/stories/..%2f..%2f/package.json',
      '/api/covers/..%2F..%2Fcontent%2Fmanifest.json',
      '/api/stories/x/assets/../../../../../etc/passwd',
    ]) {
      expect(parseApiRoute(p)).toEqual({ kind: 'not-found' });
    }
  });

  test('non-allowlisted files and malformed ids are rejected', () => {
    for (const p of [
      '/api/stories/x/README.txt',
      '/api/stories/x/secrets.json',
      '/api/stories/x/package.json',
      '/api/stories/x/assets/secret.key',
      '/api/stories/X/story.json', // uppercase dir
      '/api/stories/x./story.json', // dot in dir
      '/api/stories/x/story.json/extra',
      '/api/stories',
      '/api/unknown',
      '/api/stories/x/assets/', // trailing slash, no file
      '/api/covers/x.jpg/extra',
      '/api/covers/UPPER.jpg',
    ]) {
      expect(parseApiRoute(p)).toEqual({ kind: 'not-found' });
    }
  });
});

describe('GET endpoints', () => {
  test('health returns ok JSON with contentVersion', async () => {
    const res = await get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as { ok: boolean; contentVersion: number };
    expect(body.ok).toBe(true);
    expect(body.contentVersion).toBe(5);
  });

  test('manifest is served as JSON with a short cache TTL', async () => {
    const res = await get('/api/manifest');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const cc = res.headers.get('Cache-Control') ?? '';
    expect(cc).toContain('max-age=60');
    const body = (await res.json()) as { contentVersion: number };
    expect(body.contentVersion).toBe(5);
  });

  test('story file is served as JSON with cache headers', async () => {
    const res = await get('/api/stories/goddess-who-chose-me/story.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Cache-Control')).toContain('public');
    expect(await res.json()).toEqual({ id: 'goddess-who-chose-me' });
  });

  test('story cover is served as image/jpeg with long cache', async () => {
    const res = await get('/api/stories/goddess-who-chose-me/assets/cover.jpg');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toContain('max-age=86400');
  });

  test('whole story package is served in one JSON response', async () => {
    const res = await get('/api/stories/goddess-who-chose-me');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ['characters', 'memory', 'scenes', 'story', 'world'].sort(),
    );
  });

  test('APK cover art is served via /api/covers', async () => {
    const res = await get('/api/covers/cafe-queen-myra.jpg');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
  });

  test('unknown story dir returns 404 JSON', async () => {
    const res = await get('/api/stories/not-in-manifest/story.json');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('not_found');
  });

  test('raw /content assets are not directly accessible', async () => {
    for (const p of ['/content/manifest.json', '/content/stories/goddess-who-chose-me/story.json', '/covers/cafe-queen-myra.jpg']) {
      const res = await get(p);
      expect(res.status).toBe(404);
    }
  });
});

describe('CORS', () => {
  test('allowed origins get CORS headers', async () => {
    const res = await get('/api/manifest', { Origin: 'https://beyondredeye.site' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://beyondredeye.site');
  });

  test('non-allowed origins are refused', async () => {
    const res = await get('/api/manifest', { Origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('origin_not_allowed');
  });

  test('requests without Origin (native app) are served', async () => {
    const res = await get('/api/manifest');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  test('OPTIONS preflight from allowed origin succeeds', async () => {
    const res = (await worker.fetch(
      new Request('https://beyondredeye.site/api/manifest', {
        method: 'OPTIONS',
        headers: { Origin: 'https://beyondredeye.site' },
      }),
      makeEnv(),
      {} as never,
    )) as Response;
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://beyondredeye.site');
  });
});

describe('methods and errors', () => {
  test('POST is rejected with 405', async () => {
    const res = (await worker.fetch(
      new Request('https://beyondredeye.site/api/manifest', { method: 'POST' }),
      makeEnv(),
      {} as never,
    )) as Response;
    expect(res.status).toBe(405);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('method_not_allowed');
  });

  test('error bodies never leak repository or deployment internals', async () => {
    for (const p of ['/api/nope', '/api/stories/..%2f..%2f/etc/passwd', '/api/stories/x/y.json']) {
      const res = await get(p);
      const text = await res.text();
      expect(text).not.toMatch(/github|cloudflare|repository|token|secret|\/worker\//i);
      expect((JSON.parse(text) as { error: string }).error).toBeTruthy();
    }
  });
});

describe('rate limiting', () => {
  test('in-memory limiter lets normal traffic through and blocks floods', () => {
    const key = 'test-ip-1';
    let last = true;
    for (let i = 0; i < RATE_LIMIT; i++) last = inMemoryRateLimit(key);
    expect(last).toBe(true);
    expect(inMemoryRateLimit(key)).toBe(false);
  });

  test('excessive requests get 429 with clean JSON', async () => {
    // Drain the bucket for a stable IP through the full request path.
    const ip = '203.0.113.9';
    let res: Response | null = null;
    for (let i = 0; i < RATE_LIMIT + 5; i++) {
      res = (await worker.fetch(
        new Request('https://beyondredeye.site/api/health', {
          headers: { 'CF-Connecting-IP': ip },
        }),
        makeEnv(),
        {} as never,
      )) as Response;
    }
    expect(res!.status).toBe(429);
    const body = (await res!.json()) as { error: string };
    expect(body.error).toBe('rate_limited');
    expect(res!.headers.get('Retry-After')).toBeTruthy();
  });

  test('a native rate-limit binding is used when present', async () => {
    const env: Env = {
      ASSETS: makeEnv().ASSETS,
      RATE_LIMITER: { limit: async () => ({ success: false }) },
    };
    const res = (await worker.fetch(
      new Request('https://beyondredeye.site/api/health'),
      env,
      {} as never,
    )) as Response;
    expect(res.status).toBe(429);
  });
});
