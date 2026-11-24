/**
 * OTA publishing (admin-only, Bearer ADMIN_TOKEN).
 *
 * CI builds the JS bundle, signs nothing locally, and POSTs it here:
 *
 *   POST /api/ota/publish?platform=android&runtime=2.14.0
 *   Content-Type: application/octet-stream
 *   Authorization: Bearer <ADMIN_TOKEN>
 *   X-Kissa-OTA-Signature: <base64 rsa-sha256 over the bundle bytes>
 *   X-Kissa-OTA-Bundle-Hash: <sha256 hex>
 *   X-Kissa-OTA-Notes: <optional one-liner shown in the app>
 *   <raw zip bytes>
 *
 * The Worker stores the bytes under the update id and publishes a small JSON
 * record. Reads are then two KV gets (record + artifact).
 *
 * ROLLBACK: POST /api/ota/rollback?platform=android removes the published
 * record, so the app keeps running whatever it already has (and the next
 * launch sees "no update"). Artifacts are left in place for in-flight
 * downloads and are removed by the KV TTL/lifecycle cleanup.
 */
import type { Env } from './submissions';
import { otaKeyFor, type OtaRelease } from './ota';
import { randomToken, sha256Hex } from './accounts/store';

const KV_KEY = (platform: string) => `ota:latest:${platform}`;
const MAX_BUNDLE_BYTES = 24 * 1024 * 1024; // a JS bundle + assets, zipped
const PLATFORMS = new Set(['android', 'ios']);

function kvFor(env: Env): KVNamespace | null {
  return (env as unknown as { KISSA_SUBMISSIONS?: KVNamespace }).KISSA_SUBMISSIONS ?? null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function handleOtaAdmin(
  env: Env,
  request: Request,
  kind: 'ota-publish' | 'ota-rollback',
): Promise<Response> {
  const kv = kvFor(env);
  if (!kv) return json({ error: 'ota_unavailable', message: 'KV binding is missing.' }, 503);

  const url = new URL(request.url);
  const platform = (url.searchParams.get('platform') || 'android').toLowerCase();
  if (!PLATFORMS.has(platform)) return json({ error: 'invalid_platform' }, 400);

  if (kind === 'ota-rollback') {
    await kv.delete(KV_KEY(platform));
    return json({ ok: true, rolledBack: platform });
  }

  const runtime = (url.searchParams.get('runtime') || '').trim();
  if (!/^\d+\.\d+\.\d+(-[A-Za-z0-9.]+)?$/.test(runtime)) {
    return json({ error: 'invalid_runtime', message: 'runtime must look like 2.14.0.' }, 400);
  }
  const signature = (request.headers.get('X-Kissa-OTA-Signature') || '').trim();
  if (!signature) {
    return json({ error: 'signature_required', message: 'The update must be code-signed.' }, 400);
  }

  const buf = await request.arrayBuffer();
  if (buf.byteLength === 0) return json({ error: 'empty_bundle' }, 400);
  if (buf.byteLength > MAX_BUNDLE_BYTES) {
    return json({ error: 'bundle_too_large', message: `Max ${MAX_BUNDLE_BYTES} bytes.` }, 413);
  }

  const bundleHash = (request.headers.get('X-Kissa-OTA-Bundle-Hash') || '').trim() || (await sha256HexBytes(buf));
  const notes = (request.headers.get('X-Kissa-OTA-Notes') || '').slice(0, 200) || undefined;

  const previous = await kv.get(KV_KEY(platform));
  let sequence = 1;
  if (previous) {
    try {
      const prev = JSON.parse(previous) as OtaRelease;
      if (prev.runtimeVersion === runtime) sequence = (prev.sequence || 0) + 1;
    } catch {
      /* corrupt record: start over */
    }
  }

  const id = `ota_${randomToken(10)}`;
  await kv.put(otaKeyFor(id, 'bundle'), buf);

  const release: OtaRelease = {
    id,
    platform,
    runtimeVersion: runtime,
    createdAt: new Date().toISOString(),
    sequence,
    bundleHash,
    launchAssetSize: buf.byteLength,
    assets: [],
    signature,
    notes,
  };
  await kv.put(KV_KEY(platform), JSON.stringify(release));
  return json({ ok: true, release }, 201);
}

async function sha256HexBytes(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
