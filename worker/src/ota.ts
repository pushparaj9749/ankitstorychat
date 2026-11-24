/**
 * OTA updates — self-hosted Expo Updates endpoint served by this Worker.
 *
 * WHY SELF-HOSTED: the Worker already owns https://beyondredeye.site/api/*, so
 * shipping the update bundles through it needs no third-party account, no
 * EXPO_TOKEN and no separate server. The app points at
 * `https://beyondredeye.site/api/ota/manifest` (app.json → expo.updates.url).
 *
 * SCOPE OF OTA (deliberate):
 *   - OTA ships JS/UI/logic only ("chhote chhote changes": text, screens, copy,
 *     bug fixes, API usage). Anything native (new permission, new native
 *     dependency, SDK bump) still needs a real APK — the APK is the source of
 *     truth, OTA rides on top of the SAME runtimeVersion (app version).
 *   - `runtimeVersion.policy = "appVersion"`, so a 2.14.x update can never be
 *     handed to a 2.15 build. New APK → new runtime → old updates ignored.
 *
 * STORAGE: releases live in KV (env.KISSA_SUBMISSIONS). The newest row for a
 * platform is served; artifacts (the zipped JS bundle + its assets) are stored
 * under one prefix per update id. Nothing is generated at request time, so a
 * read is a couple of KV gets.
 *
 * SECURITY: every manifest is signed with the CodePush/Expo code-signing
 * certificate (assets/certificate.pem in the repo, private key only in CI
 * secrets). A tampered bundle or manifest is rejected by the app itself.
 */
import type { Env } from './submissions';

/** One published OTA update, as stored by CI. */
export interface OtaRelease {
  id: string;
  /** "android" | "ios" */
  platform: string;
  /** app version / runtimeVersion this update is valid for. */
  runtimeVersion: string;
  /** ISO timestamp the update was created. */
  createdAt: string;
  /** monotonic-ish counter the app uses to compare updates. */
  sequence: number;
  /**
   * base64url(SHA-256(bytes of the served launch asset)). expo-updates verifies
   * every downloaded asset against this, so it MUST be base64url — a hex digest
   * silently fails on device with "Asset hash mismatch".
   */
  bundleHash: string;
  /** Size in bytes of the whole launch asset (zipped bundle). */
  launchAssetSize: number;
  /** Extra assets shipped with this update. */
  assets: { path: string; hash: string; size: number }[];
  /**
   * expo-signature header value covering the EXACT bytes of the manifest body
   * served to the app (see `signManifest`). The app verifies the manifest, not
   * the bundle: that is what makes an OTA safe to install.
   */
  signature: string;
  /** Human note shown in the app's "what's new" list. */
  notes?: string;
}

const KV_KEY = (platform: string) => `ota:latest:${platform}`;
export const OTA_ASSET_PREFIX = 'ota:asset:';

export function otaKeyFor(id: string, path: string): string {
  return `${OTA_ASSET_PREFIX}${id}:${path}`;
}

function kvFor(env: Env): KVNamespace | null {
  return (env as unknown as { KISSA_SUBMISSIONS?: KVNamespace }).KISSA_SUBMISSIONS ?? null;
}

/** Newest published update for a platform + runtime, or null. */
export async function getOtaRelease(
  env: Env,
  platform: string,
  runtimeVersion: string,
): Promise<OtaRelease | null> {
  const kv = kvFor(env);
  if (!kv) return null;
  const raw = await kv.get(KV_KEY(platform));
  if (!raw) return null;
  try {
    const rel = JSON.parse(raw) as OtaRelease;
    if (!rel || rel.platform !== platform) return null;
    // An update is only ever served to the runtime it was built for.
    if (rel.runtimeVersion !== runtimeVersion) return null;
    return rel;
  } catch {
    return null;
  }
}

/** Any published update for a platform (ignoring runtime) — for diagnostics. */
export async function getLatestAnyRuntime(env: Env, platform: string): Promise<OtaRelease | null> {
  const kv = kvFor(env);
  if (!kv) return null;
  const raw = await kv.get(KV_KEY(platform));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OtaRelease;
  } catch {
    return null;
  }
}

/** Read one artifact byte range (null when the update/asset id is unknown). */
export async function getOtaAsset(
  env: Env,
  id: string,
  path: string,
): Promise<{ bytes: ArrayBuffer; size: number; contentType: string } | null> {
  const kv = kvFor(env);
  if (!kv) return null;
  const buf = await kv.get(otaKeyFor(id, path), 'arrayBuffer');
  if (!buf) return null;
  return {
    bytes: buf,
    size: buf.byteLength,
    contentType: path.endsWith('.json') ? 'application/json' : 'application/octet-stream',
  };
}

/**
 * The Expo Updates manifest the app actually consumes (protocol v1).
 *
 * `launchAsset.url` must be ABSOLUTE and the app appends `?platform=…&runtime-version=…`
 * so our asset handler can validate it against the published release.
 */
export function buildManifest(rel: OtaRelease, base: string): Record<string, unknown> {
  const assetUrl = (path: string) =>
    `${base}/ota/assets/${encodeURIComponent(rel.id)}/${path.split('/').map(encodeURIComponent).join('/')}`;
  return {
    id: rel.id,
    createdAt: rel.createdAt,
    runtimeVersion: rel.runtimeVersion,
    // `metadata.notes` is what the About screen shows after a download.
    metadata: rel.notes ? { notes: rel.notes } : {},
    extra: {
      // Informational only — the signature that matters is the expo-signature
      // header on the response body (the app never trusts fields inside the
      // body it is supposed to be verifying).
      signatureFormat: 'rsa-v1_5-sha256',
      keyid: OTA_SIGNING_KEY_ID,
      sequence: rel.sequence,
      bundleHash: rel.bundleHash,
    },
    launchAsset: {
      // expo-updates hands the served bytes to android.content.res.AssetManager
      // directly. A .tgz (what CI used to upload) is NOT a JS bundle, so the app
      // could never boot it — the artifact must be the exported JS file.
      hash: rel.bundleHash,
      key: 'bundle',
      contentType: 'application/javascript',
      url: assetUrl('bundle'),
    },
    assets: rel.assets.map((a) => ({
      hash: a.hash,
      key: a.path,
      contentType: 'application/octet-stream',
      url: assetUrl(a.path),
    })),
  };
}

/**
 * Defaults that must match app.json's `updates.codeSigningMetadata`, otherwise
 * the app rejects every manifest with "Key with keyid=… not found".
 */
export const OTA_SIGNING_KEY_ID = 'root';
export const OTA_SIGNING_ALG = 'rsa-v1_5-sha256';

/**
 * Build the `expo-signature` header for a manifest body.
 *
 * The app verifies SHA256withRSA over the exact bytes of the body it received,
 * so signing arbitrary `extra` fields is useless: the signature has to be over
 * the serialized manifest itself. Any later change to the body invalidates it,
 * which is exactly the point.
 */
export async function signManifest(body: string, privateKeyPkcs8Base64: string): Promise<string> {
  const sig = await rsaSha256Sign(body, privateKeyPkcs8Base64);
  return `sig="${sig}", keyid="${OTA_SIGNING_KEY_ID}", alg="${OTA_SIGNING_ALG}"`;
}

/** base64url(SHA-256(bytes)) — the only digest format expo-updates accepts. */
export async function assetHash(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToB64(new Uint8Array(digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * RSA-SHA256 signature over `body`, base64 (standard alphabet — what the app's
 * Base64.decode expects).
 *
 * WebCrypto cannot import a bare PEM, so the PKCS#8 DER is unwrapped here and
 * imported as an `RSASSA-PKCS1-v1_5` key. The private key lives in a Worker
 * secret / CI secret, never in the repo.
 */
async function rsaSha256Sign(body: string, privateKeyBase64: string): Promise<string> {
  const der = b64ToBytes(
    privateKeyBase64
      .replace(/-----[^-]+-----/g, '')
      .replace(/\s+/g, ''),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der as unknown as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body));
  return bytesToB64(new Uint8Array(sig));
}
