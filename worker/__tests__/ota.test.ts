/**
 * OTA (Expo Updates) endpoint — self-hosted in the Worker.
 *
 * Covers: route parsing, "no update" 204, the manifest expo-updates expects,
 * the expo-signature header proving the body was signed by our key (verified
 * here the way the Android app verifies it), runtime isolation (a 2.14 bundle
 * is never served to a 2.15 build), base64url asset hashes, artifact bytes,
 * unsigned-manifest refusal, and rollback.
 */
import { handleRequest } from '../src/router';
import { memKv, resetMemKvForTests, type Env } from '../src/submissions';

/** A throwaway RSA keypair per run — no key material lives in the repo. */
let signingKeyB64 = '';
let verifyKey: CryptoKey;

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  verifyKey = pair.publicKey;
  const pk8 = (await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer;
  const bytes = new Uint8Array(pk8);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  signingKeyB64 = btoa(bin);
});

function makeEnv(withKey = true): Env {
  resetMemKvForTests();
  const assets = { fetch: async () => new Response('nope', { status: 404 }) };
  return {
    ASSETS: assets as unknown as Env['ASSETS'],
    ADMIN_TOKEN: 'test-admin',
    KISSA_SUBMISSIONS: memKv as unknown as KVNamespace,
    OTA_SIGNING_KEY: withKey ? signingKeyB64 : undefined,
  } as Env;
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
    headers: { ...admin, 'X-Kissa-OTA-Notes': 'Copy fix', 'Content-Type': 'application/javascript' },
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
      launchAsset: { url: string; hash: string; contentType: string };
      assets: unknown[];
      extra: { sequence: number; keyid: string; signatureFormat: string };
    };
    expect(m.runtimeVersion).toBe('2.14.0');
    // The id in the path is a UUID now — expo-updates requires it (see the
    // "manifest id is a real UUID" test for why).
    expect(m.launchAsset.url).toMatch(
      /^https:\/\/beyondredeye\.site\/api\/ota\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/bundle$/i,
    );
    expect(m.launchAsset.contentType).toBe('application/javascript');
    // The app runs these bytes as JS, so the hash it checks must be base64url.
    expect(m.launchAsset.hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(m.assets).toEqual([]);
    expect(m.extra.keyid).toBe('root');
    expect(m.extra.sequence).toBe(1);
    // The signature is a response HEADER over the body, never a body field.
    expect(res.headers.get('expo-signature')).toMatch(/^sig="[^"]+", ?keyid="root", ?alg="rsa-v1_5-sha256"$/);
    expect(res.headers.get('Expo-Protocol-Version')).toBe('1');
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain('expo-signature');
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  test('the signature verifies over the exact served body (what the app does)', async () => {
    await publish();
    const res = await call('GET', '/api/ota/manifest?platform=android&runtime-version=2.14.0');
    const body = await res.text();
    const header = res.headers.get('expo-signature') ?? '';
    const sig = /sig="([^"]+)"/.exec(header)?.[1] ?? '';
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      verifyKey,
      Buffer.from(sig, 'base64'),
      new TextEncoder().encode(body),
    );
    expect(valid).toBe(true);

    // Any edit to the manifest invalidates it — that is the whole point.
    const tampered = body.replace('"sequence":1', '"sequence":99');
    expect(tampered).not.toBe(body);
    const tamperedOk = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      verifyKey,
      Buffer.from(sig, 'base64'),
      new TextEncoder().encode(tampered),
    );
    expect(tamperedOk).toBe(false);
  });

  test('refuses to serve a manifest when signing is not configured', async () => {
    // Better an explicit 503 than an update the app must reject.
    const noKey = makeEnv(false);
    expect((await publish('BUNDLE', 'platform=android&runtime=2.14.0')).status).toBe(201);
    const res = await call('GET', '/api/ota/manifest?platform=android&runtime-version=2.14.0', {}, noKey);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toBe('ota_signing_key_missing');
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
      body: 'x',
    });
    expect(res.status).toBe(401);
  });

  test('records the base64url hash of the uploaded bytes', async () => {
    const res = await publish('hello-bundle');
    const { release } = (await res.json()) as { release: { bundleHash: string; launchAssetSize: number } };
    const expected = Buffer.from(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hello-bundle')),
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(release.bundleHash).toBe(expected);
    expect(release.launchAssetSize).toBe('hello-bundle'.length);
  });

  test('rejects an empty bundle', async () => {
    const res = await publish('');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('empty_bundle');
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

  // expo-updates (Android) does `UUID.fromString(manifest.getID())` — see
  // ExpoUpdatesUpdate.kt. Anything that is not 8-4-4-4-12 throws, the whole
  // manifest is discarded, and the app silently reports "already up to date".
  // That is exactly what shipped twice (ota_FCR4NmqEqoCK0A / ota_agtgeXcMzQlI3Q).
  test('the manifest id is a real UUID', async () => {
    const created = (await (await publish()).json()) as { release: { id: string } };
    expect(created.release.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  test('a UUID id still serves its bundle (dashes must not break the path)', async () => {
    const created = (await (await publish('UUID-BYTES')).json()) as { release: { id: string } };
    const m = (await (await call('GET', '/api/ota/manifest?platform=android&runtime-version=2.14.0')).json()) as {
      launchAsset: { url: string };
    };
    const path = new URL(m.launchAsset.url).pathname;
    const res = await call('GET', path);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('UUID-BYTES');
    expect(path).toContain(created.release.id);
  });

  test('legacy ota_ ids already in KV keep serving after the switch', async () => {
    // Release records published before this fix must not 404 mid-flight.
    const { otaKeyFor } = await import('../src/ota');
    await (env.KISSA_SUBMISSIONS as unknown as KVNamespace).put(otaKeyFor('ota_legacy123', 'bundle'), 'OLD-BYTES');
    const res = await call('GET', '/api/ota/assets/ota_legacy123/bundle');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OLD-BYTES');
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

describe('signing contract', () => {
  // The committed certificate is checked app-side (__tests__/ota.test.ts) where
  // node types are available; here we prove the Worker's signing is real.
  test('the header it produces is what the device parser expects, and verifies', async () => {
    const { signManifest } = await import('../src/ota');
    const body = JSON.stringify({ hello: 'kissa' });
    const header = await signManifest(body, signingKeyB64);
    expect(header).toMatch(/^sig="[A-Za-z0-9+/=]+", keyid="root", alg="rsa-v1_5-sha256"$/);

    const sig = /sig="([^"]+)"/.exec(header)?.[1] ?? '';
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      verifyKey,
      Buffer.from(sig, 'base64'),
      new TextEncoder().encode(body),
    );
    expect(ok).toBe(true);
  });
});
