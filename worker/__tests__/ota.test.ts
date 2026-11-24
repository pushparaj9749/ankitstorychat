/**
 * OTA (Expo Updates) endpoint — self-hosted in the Worker.
 *
 * Covers: route parsing, "no update" 204, the manifest shape expo-updates
 * expects, publishing only with the admin token + a signature, runtime
 * isolation (a 2.14 bundle is never served to a 2.15 build), artifact bytes,
 * and rollback.
 */
import { handleRequest } from '../src/router';
import { memKv, resetMemKvForTests, type Env } from '../src/submissions';

function makeEnv(): Env {
  resetMemKvForTests();
  const assets = { fetch: async () => new Response('nope', { status: 404 }) };
  return { ASSETS: assets as unknown as Env['ASSETS'], ADMIN_TOKEN: 'test-admin', KISSA_SUBMISSIONS: memKv as unknown as KVNamespace } as Env;
}

let env: Env;
beforeEach(() => {
  env = makeEnv();
});

const call = (method: string, path: string, init: RequestInit = {}, e: Env = env) =>
  handleRequest(new Request(`https://beyondredeye.site${path}`, { method, ...init }), e);

const admin = { Authorization: 'Bearer test-admin' };

async function publish(body = 'BUNDLE-BYTES', query = 'platform=android&runtime=2.14.0'): Promise<Response> {
  return call('POST', `/api/ota/publish?${query}`, {
    method: 'POST',
    headers: { ...admin, 'X-Kissa-OTA-Signature': 'c2ln', 'X-Kissa-OTA-Notes': 'Copy fix', 'Content-Type': 'application/octet-stream' },
    body,
  });
}

describe('GET /api/ota/manifest', () => {
  test('204 when nothing is published (app stays on its bundle)', async () => {
    const res = await call('GET', '/api/ota/manifest?platform=android&runtime-version=2.14.0');
    expect(res.status).toBe(204);
  });

  test('serves the Expo manifest for the exact runtime', async () => {
    expect((await publish()).status).toBe(201);
    const res = await call('GET', '/api/ota/manifest?platform=android&runtime-version=2.14.0');
    expect(res.status).toBe(200);
    const m = (await res.json()) as {
      id: string;
      runtimeVersion: string;
      launchAsset: { url: string; hash: string };
      extra: { signature: string; sequence: number };
    };
    expect(m.runtimeVersion).toBe('2.14.0');
    expect(m.launchAsset.url).toMatch(/^https:\/\/beyondredeye\.site\/api\/ota\/assets\/ota_/);
    expect(m.extra.signature).toBe('c2ln');
    expect(m.extra.sequence).toBe(1);
  });

  test('never serves a bundle built for a different runtime', async () => {
    await publish();
    const res = await call('GET', '/api/ota/manifest?platform=android&runtime-version=2.15.0');
    expect(res.status).toBe(204);
  });

  test('is reachable even when the version gate would block the install', async () => {
    await publish();
    // An outdated install is exactly the client a JS fix must be able to reach.
    const res = await call('GET', '/api/ota/manifest?platform=android&runtime-version=2.14.0', {
      headers: { 'X-Kissa-Version': '2.13.1' },
    });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/ota/publish', () => {
  test('requires the admin token', async () => {
    const res = await call('POST', '/api/ota/publish?platform=android&runtime=2.14.0', {
      method: 'POST',
      headers: { 'X-Kissa-OTA-Signature': 'c2ln' },
      body: 'x',
    });
    expect(res.status).toBe(401);
  });

  test('refuses an unsigned bundle', async () => {
    const res = await call('POST', '/api/ota/publish?platform=android&runtime=2.14.0', {
      method: 'POST',
      headers: admin,
      body: 'x',
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('signature_required');
  });

  test('refuses a bad runtime or platform', async () => {
    expect((await publish('x', 'platform=android&runtime=next')).status).toBe(400);
    expect((await publish('x', 'platform=windows&runtime=2.14.0')).status).toBe(400);
  });

  test('increments the sequence for the same runtime', async () => {
    await publish();
    const second = await publish();
    const body = (await second.json()) as { release: { sequence: number } };
    expect(body.release.sequence).toBe(2);
  });
});

describe('artifacts + rollback', () => {
  test('serves the published bytes by update id', async () => {
    const created = (await (await publish('HELLO-OTA')).json()) as { release: { id: string } };
    const res = await call('GET', `/api/ota/assets/${created.release.id}/bundle`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('HELLO-OTA');
  });

  test('unknown asset ids are 404', async () => {
    expect((await call('GET', '/api/ota/assets/ota_missing/bundle')).status).toBe(404);
  });

  test('rollback stops serving the update but keeps the artifact', async () => {
    const created = (await (await publish('KEEP-ME')).json()) as { release: { id: string } };
    const rb = await call('POST', '/api/ota/rollback?platform=android', { method: 'POST', headers: admin });
    expect(rb.status).toBe(200);
    expect((await call('GET', '/api/ota/manifest?platform=android&runtime-version=2.14.0')).status).toBe(204);
    expect((await call('GET', `/api/ota/assets/${created.release.id}/bundle`)).status).toBe(200);
  });
});
