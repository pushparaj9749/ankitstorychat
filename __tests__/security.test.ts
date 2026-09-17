/**
 * Security audit (client-side): no privileged credential may ever reach the
 * app bundle, the website, or the story content.
 *
 * The story API (Cloudflare Worker) is deployed from the private repository
 * by CI using GitHub encrypted secrets; the repository URL and any token stay
 * server-side. Clients only ever see https://beyondredeye.site/api.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name.startsWith('.wrangler')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function readTexts(dirs: string[], exts: string[]): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = [];
  for (const d of dirs) {
    for (const p of walk(join(ROOT, d))) {
      if (!exts.some((e) => p.endsWith(e))) continue;
      files.push({ path: p.replace(ROOT + '/', ''), text: readFileSync(p, 'utf8') });
    }
  }
  return files;
}

/** Client source: app code + config + website + shipped content. */
const CLIENT = readTexts(
  ['src', 'website', 'content', 'assets'],
  ['.ts', '.tsx', '.js', '.json', 'html', '.css', '.txt'],
).concat([
  { path: 'app.json', text: readFileSync(join(ROOT, 'app.json'), 'utf8') },
  { path: 'index.ts', text: readFileSync(join(ROOT, 'index.ts'), 'utf8') },
  { path: 'App.tsx', text: readFileSync(join(ROOT, 'App.tsx'), 'utf8') },
]);

describe('no credentials are committed or shipped to clients', () => {
  test('no GitHub tokens (classic PAT / fine-grained / OAuth)', () => {
    for (const f of CLIENT) {
      expect(f.text).not.toMatch(/ghp_[A-Za-z0-9]{20,}/);
      expect(f.text).not.toMatch(/github_pat_[A-Za-z0-9_]{20,}/);
      expect(f.text).not.toMatch(/gho_[A-Za-z0-9]{20,}/);
      expect(f.text).not.toMatch(/ghs_[A-Za-z0-9]{20,}/);
    }
  });

  test('no Cloudflare / AWS / generic API keys', () => {
    for (const f of CLIENT) {
      expect(f.text).not.toMatch(/CLOUDFLARE_API_TOKEN\s*[:=]\s*['"][^'"]+/i);
      expect(f.text).not.toMatch(/AKIA[0-9A-Z]{16}/);
      expect(f.text).not.toMatch(/sk-[A-Za-z0-9]{20,}/);
      expect(f.text).not.toMatch(/x-goog-api-key/i);
    }
  });

  test('no secrets in the worker config either (only binding names)', () => {
    // Strip comments first — the config documents the required secret NAMES.
    const wrangler = readFileSync(join(ROOT, 'worker', 'wrangler.jsonc'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    expect(wrangler).not.toMatch(/['"][A-Za-z0-9_-]{30,}['"]/);
    expect(wrangler).not.toMatch(/(token|secret|password)\s*[:=]\s*['"][^'"]+/i);
  });
});

describe('the app never talks to GitHub for content', () => {
  test('no raw.githubusercontent.com URLs in app source or config', () => {
    for (const f of CLIENT) {
      if (f.path.startsWith('website/')) continue; // site has a documented transitional fallback
      expect(f.text).not.toContain('raw.githubusercontent.com');
    }
  });

  test('no GitHub API content URLs in app source', () => {
    for (const f of CLIENT) {
      if (f.path.startsWith('website/')) continue;
      expect(f.text).not.toMatch(/api\.github\.com\/repos/);
    }
  });

  test('the single content API base is the Cloudflare Worker', () => {
    const appJson = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'));
    expect(appJson.expo.extra.KISSA_CONTENT_API_BASE_URL).toBe('https://beyondredeye.site/api');
    expect(appJson.expo.extra.contentManifestUrl).toBeUndefined();
    // The retired raw-GitHub manifest setting must not be declared anywhere
    // (db.ts only DROPS old stored values during migration).
    const types = readFileSync(join(ROOT, 'src', 'types.ts'), 'utf8');
    expect(types).not.toContain('contentManifestUrl:');
    expect(types).toContain("contentApiBaseUrl: ''");
  });

  test('manifest cover URLs are relative API paths (no repo URLs leak)', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'content', 'manifest.json'), 'utf8'));
    for (const s of manifest.stories) {
      if (s.coverUrl) {
        expect(s.coverUrl).toMatch(/^stories\/[a-z0-9-]+\/assets\/cover\.(jpg|png)$/);
        expect(s.coverUrl).not.toMatch(/github|https?:/);
      }
    }
  });

  test('website carries no credentials (public repo link is not a secret)', () => {
    for (const f of CLIENT) {
      if (!f.path.startsWith('website/')) continue;
      expect(f.text).not.toMatch(/ghp_[A-Za-z0-9]{20,}/);
      expect(f.text).not.toMatch(/github_pat_[A-Za-z0-9_]{20,}/);
      expect(f.text).not.toMatch(/Authorization\s*[:=]|Bearer\s+[A-Za-z0-9]/i);
      expect(f.text).not.toMatch(/(api[-_]?token|secret)\s*[:=]\s*['"][^'"]+/i);
    }
  });
});

describe('the story API never receives user data (by construction)', () => {
  test('no user/chat/memory/profile fields are sent in content requests', () => {
    const loader = readFileSync(join(ROOT, 'src', 'content', 'loader.ts'), 'utf8');
    // Content requests are plain GETs of public files.
    expect(loader).toMatch(/fetchJsonWithTimeout\(/);
    expect(loader).not.toMatch(/nickname|profile\.|chats|(^|[^a-zA-Z])memories([^a-zA-Z]|$)/im); // "memories" standalone only (seedMemories is story content schema)
  });
});
