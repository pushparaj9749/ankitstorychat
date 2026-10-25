// Screenshots of the real website (website/ via worker/public) at a phone viewport.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { REPO, sleep } from './harness.mts';
// @ts-ignore
import { handleRequest } from '../../../../worker/src/router.ts';
const PUB = path.join(REPO, 'worker/public');
const OUT = process.env.OUT ?? path.join(REPO, 'docs/promo/tutorial/shots/raw');
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain' };
const env = { ASSETS: { async fetch(req: Request) { const f = path.join(PUB, decodeURIComponent(new URL(req.url).pathname)); return fs.existsSync(f) && fs.statSync(f).isFile() ? new Response(fs.readFileSync(f), { headers: { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' } }) : new Response('nf', { status: 404 }); } } };
const browser = await puppeteer.launch({ executablePath: '/tmp/chromium', headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib:/tmp' } });
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 892, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
await page.setRequestInterception(true);
page.on('request', async (req) => {
  const u = new URL(req.url());
  if (u.hostname === 'api.github.com') return req.respond({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ tag_name: 'v2.11.1', assets: [{ name: 'kissa-v2.11.1.apk', size: 102766231, browser_download_url: 'https://beyondredeye.site/kissa.apk' }] }) });
  if (u.hostname === 'beyondredeye.site') {
    if (u.pathname.startsWith('/api/')) {
      const r: Response = await handleRequest(new Request(req.url()), env as any, { waitUntil() {}, passThroughOnException() {} } as any);
      const h: Record<string, string> = {}; r.headers.forEach((v, k) => (h[k] = v));
      return req.respond({ status: r.status, headers: h, body: Buffer.from(await r.arrayBuffer()) });
    }
    let p = u.pathname === '/' ? '/index.html' : u.pathname;
    const f = path.join(PUB, p);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return req.respond({ status: 200, headers: { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' }, body: fs.readFileSync(f) });
    return req.respond({ status: 404, body: '' });
  }
  return req.respond({ status: 404, body: '' });
});
await page.goto('https://beyondredeye.site/', { waitUntil: 'networkidle0', timeout: 60000 });
await sleep(2500);
await page.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; const re = /[\p{Extended_Pictographic}\uFE0F\u200D]\s?/gu; while ((n = w.nextNode())) { if (re.test(n.textContent || '')) n.textContent = (n.textContent || '').replace(re, ''); } });
await sleep(300);
await page.screenshot({ path: path.join(OUT, '00_site_top.png') });
const r = await page.evaluate(() => { const b = document.getElementById('heroDownload')!.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
console.log('heroDownload css rect', r);
await page.evaluate(() => document.getElementById('download')?.scrollIntoView());
await sleep(800);
await page.screenshot({ path: path.join(OUT, '00_site_download.png') });
const r2 = await page.evaluate(() => { const b = document.getElementById('bottomDownload')!.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
console.log('bottomDownload css rect', r2);
await browser.close();
