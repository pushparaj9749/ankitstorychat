/**
 * Screenshot harness for the Kissa tutorial video.
 *
 * - serves the Expo web export (dist dir from `expo export --platform web`)
 * - answers https://beyondredeye.site/api/* with the REAL worker router
 *   (worker/src/router.ts) reading worker/public (scripts/build-worker-assets.mjs)
 * - answers AI provider calls with scripted replies (no network, no key)
 * - drives headless Chromium (@sparticuz/chromium) at an Android-phone viewport
 *
 * Run with tsx from a dir that has puppeteer-core + @sparticuz/chromium.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { type Page, type Browser } from 'puppeteer-core';
// @ts-ignore — resolved by tsx at runtime
import { handleRequest } from '../../../../worker/src/router.ts';

export const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const WEB = process.env.WEB_DIR ?? '/tmp/webbuild';
const ASSETS_DIR = path.join(REPO, 'worker', 'public');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.svg': 'image/svg+xml', '.css': 'text/css', '.mp3': 'audio/mpeg',
};

export function startStatic(port = 8081): Promise<http.Server> {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let f = path.join(WEB, p);
    if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(WEB, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv)));
}

const env = {
  ASSETS: {
    async fetch(req: Request): Promise<Response> {
      const p = decodeURIComponent(new URL(req.url).pathname);
      const f = path.join(ASSETS_DIR, p);
      if (!f.startsWith(ASSETS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response('nf', { status: 404 });
      return new Response(fs.readFileSync(f), { status: 200, headers: { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' } });
    },
  },
};

/** Scripted AI: each story turn pops the next reply. */
export const ai = {
  replies: [] as string[],
  log: [] as string[],
  answer(body: any): string {
    const msgs = (body?.messages ?? []) as { role: string; content: string }[];
    const sys = msgs.find((m) => m.role === 'system')?.content ?? '';
    if (/^You are the silent record-keeper/.test(sys)) return '{}';
    if ((body?.max_tokens ?? body?.max_completion_tokens ?? 999) <= 16) return 'OK';
    if (/HOW TO RESPOND/.test(sys)) {
      const r = this.replies.shift();
      this.log.push('story');
      return r ?? '*Woh muskura deti hai.*';
    }
    this.log.push('other:' + sys.slice(0, 60));
    return 'Namaste! Main ready hoon.';
  },
};

const AI_HOSTS = /(api\.groq\.com|api\.openai\.com|openrouter\.ai|api\.together\.xyz)$/;

export async function launch(): Promise<{ browser: Browser; page: Page }> {
  const browser = await puppeteer.launch({
    executablePath: '/tmp/chromium',
    headless: true,
    userDataDir: process.env.PROFILE ?? '/tmp/chromeprof',
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--disable-dev-shm-usage', '--font-render-hinting=none', '--lang=en-IN'],
    env: { ...process.env, LD_LIBRARY_PATH: '/tmp/al2023/lib:/tmp', FONTCONFIG_PATH: '/tmp/fonts' },
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 892, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0 Mobile Safari/537.36');
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const url = new URL(req.url());
    try {
      if (url.hostname === 'beyondredeye.site') {
        if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-max-age': '600' } });
        const r: Response = await handleRequest(new Request(req.url(), {
          method: req.method(), headers: req.headers(), body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData(),
        }), env as any, { waitUntil() {}, passThroughOnException() {} } as any);
        const buf = Buffer.from(await r.arrayBuffer());
        if (process.env.DEBUG_API && !url.pathname.includes('/stories/')) console.log('API', req.method(), url.pathname, r.status, buf.toString().slice(0, 200));
        const headers: Record<string, string> = {};
        r.headers.forEach((v, k) => (headers[k] = v));
        headers['access-control-allow-origin'] = '*';
        return req.respond({ status: r.status, headers, body: buf });
      }
      if (AI_HOSTS.test(url.hostname)) {
        if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } });
        let body: any = {};
        try { body = JSON.parse(req.postData() ?? '{}'); } catch {}
        const text = ai.answer(body);
        await new Promise((r) => setTimeout(r, 400));
        return req.respond({
          status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
          body: JSON.stringify({ id: 'x', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }] }),
        });
      }
      if (url.hostname === '127.0.0.1' || url.protocol === 'data:' || url.protocol === 'blob:') return req.continue();
      if (url.hostname === 'api.github.com') {
        return req.respond({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: '[]' });
      }
      return req.respond({ status: 404, body: '' });
    } catch (e) {
      console.error('intercept error', req.url(), e);
      return req.respond({ status: 500, body: '' });
    }
  });
  await page.evaluateOnNewDocument('globalThis.__name = function (f) { return f; };');
  await page.evaluateOnNewDocument(() => {
    const add = () => { const st = document.createElement('style'); st.textContent = '*:focus,*:focus-visible{outline:none!important;box-shadow:none}::-webkit-scrollbar{display:none}'; document.head.appendChild(st); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  });
  page.on('pageerror', (e) => console.error('pageerror', String(e).slice(0, 300)));
  return { browser, page };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function go(page: Page, p = '/'): Promise<void> {
  await page.goto('http://127.0.0.1:8081' + p, { waitUntil: 'networkidle0', timeout: 60000 }).catch((e) => console.log('goto', e.message));
  await sleep(2500);
}

export async function shot(page: Page, name: string, dir: string): Promise<void> {
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
  console.log('shot', name);
}

/** Click the first element whose aria-label or visible text matches. Visible elements only. */
export async function tap(page: Page, match: string | RegExp, opts: { exact?: boolean } = {}): Promise<boolean> {
  const src = match instanceof RegExp ? { re: match.source, flags: match.flags } : { s: match, exact: !!opts.exact };
  const ok = await page.evaluate((m: any) => {
    const vis = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
      let e: Element | null = el;
      while (e) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
        e = e.parentElement;
      }
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
      const h = document.elementFromPoint(cx, cy);
      return !!h && (el.contains(h) || h.contains(el));
    };
    const test = (t: string | null) => {
      if (!t) return false;
      t = t.trim();
      if (m.re) return new RegExp(m.re, m.flags).test(t);
      return m.exact ? t === m.s : t.includes(m.s);
    };
    const all = Array.from(document.querySelectorAll('[aria-label],[role=button],[role=tab],[role=link],[role=switch],[role=checkbox],[tabindex],a,button,div'));
    const byLabel = all.filter((el) => test(el.getAttribute('aria-label')) && vis(el));
    let target: Element | undefined = byLabel[byLabel.length - 1];
    if (!target) {
      const texts = Array.from(document.querySelectorAll('div,span')).filter((el) => el.children.length === 0 && test(el.textContent) && vis(el));
      const t = texts[texts.length - 1];
      if (t) {
        let e: Element | null = t;
        while (e && !(e.getAttribute('role') === 'button' || e.getAttribute('tabindex') !== null || e.tagName === 'A' || e.tagName === 'BUTTON')) e = e.parentElement;
        target = (e ?? t) as Element;
      }
    }
    if (!target) return false;
    const r = (target as HTMLElement).getBoundingClientRect();
    (window as any).__tapXY = [r.left + r.width / 2, r.top + r.height / 2];
    return true;
  }, src);
  if (!ok) return false;
  const [x, y] = (await page.evaluate(() => (window as any).__tapXY)) as [number, number];
  await page.mouse.click(x, y);
  return true;
}

export async function typeInto(page: Page, placeholder: RegExp | string, text: string, delay = 25): Promise<boolean> {
  const sel = await page.evaluate((p: any) => {
    const re = p.re ? new RegExp(p.re, p.flags) : null;
    const els = Array.from(document.querySelectorAll('input,textarea')) as HTMLInputElement[];
    const el = els.find((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 2) return false;
      const ph = e.getAttribute('placeholder') ?? e.getAttribute('aria-label') ?? '';
      return re ? re.test(ph) : ph.includes(p.s);
    });
    if (!el) return null;
    el.setAttribute('data-shot-target', '1');
    return true;
  }, placeholder instanceof RegExp ? { re: placeholder.source, flags: placeholder.flags } : { s: placeholder });
  if (!sel) return false;
  await page.click('[data-shot-target="1"]');
  await page.type('[data-shot-target="1"]', text, { delay });
  await page.evaluate(() => document.querySelector('[data-shot-target="1"]')?.removeAttribute('data-shot-target'));
  return true;
}

export async function texts(page: Page): Promise<string> {
  return page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll('[aria-label]').forEach((e) => {
      const r = (e as HTMLElement).getBoundingClientRect();
      if (!(r.width > 1 && r.bottom > 0 && r.top < innerHeight)) return;
      const h = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1));
      if (h && (e.contains(h) || h.contains(e))) out.push('@' + e.getAttribute('aria-label'));
    });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = n.textContent?.trim();
      const el = n.parentElement;
      if (!t || !el) continue;
      const r = el.getBoundingClientRect();
      if (!(r.width > 1 && r.bottom > 0 && r.top < innerHeight)) continue;
      const h = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1));
      if (h && (el.contains(h) || h.contains(el))) out.push(t);
    }
    return Array.from(new Set(out)).join(' | ').slice(0, 2500);
  });
}
