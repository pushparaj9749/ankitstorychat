import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'work/lhm/inventory');
await mkdir(out, { recursive: true });
const chrome = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .find((candidate) => existsSync(candidate));
if (!chrome) throw new Error('No system Chrome/Chromium found');

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  acceptDownloads: true,
});
const responses = [];
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('response', (response) => {
  const url = response.url();
  const contentType = response.headers()['content-type'] || '';
  if (!/graphql|api\.frame|share|asset/i.test(url) && !contentType.includes('json')) return;
  response.text().then((body) => {
    if (body.length <= 12_000_000) {
      responses.push({ url, status: response.status(), contentType, body });
    }
  }).catch((error) => errors.push(`response ${url}: ${error.message}`));
});

const shareUrl = 'https://next.frame.io/share/b0022fd0-2654-487c-8a5e-cfb20a7f755d/';
await page.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForTimeout(18_000);
await page.mouse.wheel(0, 1800);
await page.waitForTimeout(5_000);

const bodyText = await page.locator('body').innerText();
const links = await page.locator('a').evaluateAll((nodes) => nodes.map((node) => ({
  text: (node.innerText || node.textContent || '').trim(),
  href: node.href,
})));
const buttons = await page.locator('button').evaluateAll((nodes) => nodes.map((node) => ({
  text: (node.innerText || node.textContent || '').trim(),
  testId: node.getAttribute('data-testid'),
  ariaLabel: node.getAttribute('aria-label'),
})));
await page.screenshot({ path: path.join(out, 'frameio-loaded.png'), fullPage: true });
await writeFile(path.join(out, 'frameio-body.txt'), bodyText);
await writeFile(path.join(out, 'frameio-links.json'), JSON.stringify(links, null, 2));
await writeFile(path.join(out, 'frameio-buttons.json'), JSON.stringify(buttons, null, 2));
await writeFile(path.join(out, 'frameio-responses.json'), JSON.stringify(responses, null, 2));
await writeFile(path.join(out, 'frameio-browser-errors.log'), errors.join('\n') + '\n');
console.log(JSON.stringify({ bodyCharacters: bodyText.length, links: links.length, buttons: buttons.length, responses: responses.length, errors: errors.length }, null, 2));
await browser.close();
