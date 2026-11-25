/**
 * v2.14 hard block: submissions (and media uploads) belong to an account, so
 * the client must send the session token + version header, and both the
 * out-of-date install (426) and the signed-out install (401) must reach the
 * UI instead of looking like a generic failure.
 */
import fs from 'fs';
import path from 'path';

const read = (p: string): string => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('submission client requires an account', () => {
  const client = read('src/content/submissions.ts');

  it('sends the session token and the app version on every submission call', () => {
    expect(client).toMatch(/import \{[^}]*getToken[^}]*\} from '\.\.\/lib\/account'/);
    expect(client).toMatch(/headers\.set\('X-Kissa-Version', appVersion\(\)\)/);
    expect(client).toMatch(/headers\.set\('Authorization', `Bearer \$\{token\}`\)/);
  });

  it('marks a 426 as "update required" and explains the login requirement', () => {
    expect(client).toMatch(/updateRequired: res\.status === 426/);
    expect(client).toMatch(/426 \? 'Kissa ka naya version chahiye/);
    expect(client).toMatch(/401 \? 'Login dobara karo\.'/);
  });
});

describe('update wall survives a relaunch', () => {
  const account = read('src/lib/account.ts');
  const context = read('src/state/AppContext.tsx');

  it('remembers a 426 as an OFFLINE fallback only', () => {
    expect(account).toMatch(/export async function cachedUpdateRequired/);
    // The old launch check OR-ed the cache into the verdict, which pinned the
    // wall forever after a single stale 426 — users locked out of a current app.
    expect(context).not.toMatch(/\|\| \(await cachedUpdateRequired\(\)\)/);
    expect(context).toMatch(/const gate = await isUpdateRequired\(apiBase\);/);
    expect(context).toMatch(/setUpdateRequired\(gate\.required\)/);
  });

  it('a fresh server answer CLEARS a stale 426', () => {
    // "you are current" must win over a remembered block.
    expect(account).toMatch(/export async function clearUpdateRequired/);
    expect(account).toMatch(/if \(required\) await kvSet\('update\.required', '1'\);/);
    expect(account).toMatch(/else await clearUpdateRequired\(\);/);
    // Offline is the only path that may fall back to the cache.
    expect(account).toMatch(/required: await cachedUpdateRequired\(\)\.catch\(\(\) => false\)/);
  });

  it('the wall offers a re-check instead of trapping the user', () => {
    const wall = read('src/screens/UpdateRequired.tsx');
    expect(wall).toMatch(/recheckUpdateGate/);
    expect(wall).toMatch(/Dobara check karo/);
    // And it says which versions are being compared.
    expect(wall).toMatch(/server ko \$\{minVersion\} chahiye/);
  });

  it('a 426 on submit opens the wall immediately', () => {
    expect(read('src/screens/SubmitStory.tsx')).toMatch(/if \(err\.updateRequired\) \{\s*markUpdateRequired\(\);/);
  });
});

describe('worker blocks submissions without an account', () => {
  const router = read('worker/src/router.ts');
  const submitBlock = router.slice(router.indexOf("case 'submit-idea'"), router.indexOf("case 'admin-pending'"));
  const mediaBlock = router.slice(router.indexOf("case 'submit-media'"), router.indexOf("case 'submit-idea'"));

  it('idea and story submissions require an account', () => {
    expect(submitBlock).toMatch(/optionalAccountId\(env, request\)/);
    expect(submitBlock).toMatch(/426,\s*'update_required'/);
    expect(submitBlock).toMatch(/401,\s*'login_required'/);
  });

  it('media uploads require an account too', () => {
    expect(mediaBlock).toMatch(/optionalAccountId\(env, request\)/);
    expect(mediaBlock).toMatch(/login_required/);
  });

  it('the account id is forwarded to the submission store', () => {
    expect(submitBlock).toMatch(/submitIdea\(env, body as Record<string, unknown>, client, submitAccountId\)/);
    expect(submitBlock).toMatch(/submitStory\(env, body as Record<string, unknown>, client, submitAccountId\)/);
  });
});

describe('release identity', () => {
  it('package.json and app.json agree, so the APK is not published under an old version', () => {
    const pkg = JSON.parse(read('package.json')) as { version: string };
    const app = JSON.parse(read('app.json')) as { expo: { version: string; android: { versionCode: number } } };
    // The Android workflow names the APK from package.json but the install's
    // on-device version (sent as X-Kissa-Version) comes from app.json. If the
    // two drift, the release ships labelled with the previous version and the
    // version gate can never recognise the new build.
    expect(pkg.version).toBe(app.expo.version);
    expect(app.expo.version).toMatch(/^\d+\.\d+\.\d+$/);
    // versionCode must move with the version, or Android refuses the upgrade.
    expect(app.expo.android.versionCode).toBeGreaterThanOrEqual(46);
  });
});

describe('the version sent to the server is the APK, not the OTA bundle', () => {
  const account = read('src/lib/appVersion.ts');

  it('reads the native app version first and only falls back to expoConfig', () => {
    // expo-constants resolves expoConfig from the RUNNING manifest. After an OTA
    // that is the served bundle, so trusting it made every fresh OTA look like
    // an outdated install ("ye update purana ho gaya hai") on the next launch.
    expect(account).toContain('expo-application');
    expect(account).toContain('nativeApplicationVersion');
    const nativeAt = account.indexOf('nativeApplicationVersion');
    const configAt = account.indexOf('Constants.expoConfig?.version', nativeAt);
    expect(nativeAt).toBeGreaterThan(0);
    expect(configAt).toBeGreaterThan(nativeAt); // fallback comes second
  });

  it('the native read is not skipped by an early return', () => {
    const body = account.slice(account.indexOf('export function installedAppVersion'));
    const fn = body.slice(0, body.indexOf('\n}\n') + 3);
    expect(fn).not.toContain('executionEnvironment');
    expect(fn.indexOf('nativeApplicationVersion')).toBeLessThan(fn.indexOf('return fromConfig'));
  });

  it('account.ts uses that single source, not its own copy', () => {
    const src = read('src/lib/account.ts');
    expect(src).toContain('installedAppVersion');
    expect(src).not.toContain('nativeApplicationVersion');
  });

  it('OTA + update-check do not read the version from the running manifest', () => {
    const ota = read('src/lib/ota.ts');
    const check = read('src/lib/updateCheck.ts');
    // ota.ts used to do: (Constants.expoConfig?.version) ?? undefined
    expect(ota).not.toContain('Constants.expoConfig?.version');
    expect(ota).toContain('installedAppVersion');
    expect(check).toContain('installedAppVersion');
    expect(check).not.toContain("return Constants.expoConfig?.version");
  });
});

describe('the update wall is never a dead end', () => {
  const wall = read('src/screens/UpdateRequired.tsx');

  it('re-asks the server on its own: mount, foreground, and every minute', () => {
    // A stale 426 must not require the reader to find a button — the wall
    // retries and closes itself as soon as the server says the install is fine.
    expect(wall).toContain('AppState.addEventListener');
    expect(wall).toContain("state === 'active'");
    expect(wall).toContain('setInterval');
    expect(wall).toContain('recheckUpdateGate');
  });

  it('still offers the manual recheck and the version line', () => {
    expect(wall).toContain('Dobara check karo');
    expect(wall).toContain('server ko ${minVersion} chahiye');
  });
});
