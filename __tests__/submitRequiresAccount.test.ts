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

  it('remembers a 426 and re-checks it on launch', () => {
    expect(account).toMatch(/export async function cachedUpdateRequired/);
    expect(context).toMatch(/isUpdateRequired\(apiBase\)\) \|\| \(await cachedUpdateRequired\(\)\)/);
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
