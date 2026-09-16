/**
 * Assemble the Cloudflare Worker deploy bundle (worker/public) from the
 * private repository — run by CI before `wrangler deploy` and by
 * `npm run dev` locally. No credentials needed: it only reads this checkout.
 *
 * Layout produced:
 *   public/content/manifest.json        story catalog (served at /api/manifest)
 *   public/content/stories/<id>/...     story packages (served via /api/stories/*)
 *   public/covers/<id>.jpg              APK cover art (served via /api/covers/*)
 *   public/...                          the static website (phase-2 domain serving)
 *
 * Every story gets assets/cover.jpg inside its package (the manifest's
 * relative coverUrl points there), so the app and website can always fetch
 * covers from the API.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'worker', 'public');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// 1) Story content: manifest + packages.
cpSync(join(ROOT, 'content'), join(OUT, 'content'), { recursive: true });

const manifest = JSON.parse(readFileSync(join(ROOT, 'content', 'manifest.json'), 'utf8'));
const repoCovers = join(ROOT, 'assets', 'covers');

let filled = 0;
for (const entry of manifest.stories ?? []) {
  const pkgAssets = join(OUT, 'content', 'stories', entry.storyDir, 'assets');
  const hasOwnCover = ['cover.jpg', 'cover.png'].some((f) => existsSync(join(pkgAssets, f)));
  if (hasOwnCover) continue;
  // Bundled stories keep their cover in assets/covers/<coverBundled|storyDir>.jpg
  const src = [entry.coverBundled, entry.storyDir]
    .map((id) => join(repoCovers, `${id}.jpg`))
    .find((p) => existsSync(p));
  if (!src) {
    console.warn(`⚠ ${entry.id}: no cover found (content assets or assets/covers)`);
    continue;
  }
  mkdirSync(pkgAssets, { recursive: true });
  cpSync(src, join(pkgAssets, 'cover.jpg'));
  filled += 1;
}

// 2) APK cover art for the website (/api/covers/<name>.jpg).
mkdirSync(join(OUT, 'covers'), { recursive: true });
cpSync(repoCovers, join(OUT, 'covers'), { recursive: true });

// 3) Static website (for full-domain serving through Cloudflare, if enabled).
cpSync(join(ROOT, 'website'), join(OUT), { recursive: true });

// 4) Site icons (referenced locally by the website).
cpSync(join(ROOT, 'assets', 'icon.png'), join(OUT, 'icon.png'));
cpSync(join(ROOT, 'assets', 'favicon.png'), join(OUT, 'favicon.png'));

// 5) Marker so `wrangler dev` has a file even if content is empty.
writeFileSync(join(OUT, 'robots.txt'), 'User-agent: *\nAllow: /\n');

console.log(
  `worker/public assembled: ${(manifest.stories ?? []).length} stories` +
    ` (${filled} covers filled from assets/covers), website + covers included.`,
);
