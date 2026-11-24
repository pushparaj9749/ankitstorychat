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
  /** sha256 of the JS bundle, for logging/diagnostics. */
  bundleHash: string;
  /** Size in bytes of the whole launch asset (zipped bundle). */
  launchAssetSize: number;
  /** Extra assets shipped with this update. */
  assets: { path: string; hash: string; size: number }[];
  /** Signature over the manifest fields (base64). */
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
    // Ordered newest-last; the app picks the last one it can apply.
    metadata: rel.notes ? { notes: rel.notes } : {},
    extra: {
      // Signed payload the app verifies with the pinned certificate.
      signature: rel.signature,
      signatureFormat: 'rsa-sha256',
      sequence: rel.sequence,
      bundleHash: rel.bundleHash,
    },
    launchAsset: {
      hash: rel.bundleHash,
      key: 'bundle',
      contentType: 'application/javascript',
      url: assetUrl('bundle'),
      fileExtension: '.bundle',
    },
    assets: rel.assets.map((a) => ({
      hash: a.hash,
      key: a.path,
      contentType: 'application/octet-stream',
      url: assetUrl(a.path),
      fileExtension: a.path.includes('.') ? `.${a.path.split('.').pop()}` : undefined,
    })),
  };
}
