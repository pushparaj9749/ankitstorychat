// usage: tsx step.mts '<json actions>'  actions: ["tap","x"] ["type","ph","text"] ["shot","name"] ["wait",ms] ["texts"] ["key","Enter"] ["scroll",dy] ["go","/"]
import { startStatic, launch, sleep, shot, texts, tap, typeInto, go } from './harness.mts';
const acts = JSON.parse(process.argv[2]);
const srv = await startStatic();
const { browser, page } = await launch();
await go(page, '/');
for (const a of acts) {
  const [k, x, y] = a;
  if (k === 'tap') { const ok = await tap(page, x.startsWith('/') ? new RegExp(x.slice(1, -1)) : x, { exact: y === 'exact' }); console.log('tap', x, ok); await sleep(1200); }
  else if (k === 'type') console.log('type', await typeInto(page, x, y));
  else if (k === 'shot') await shot(page, x, process.env.OUT ?? '/tmp/shots');
  else if (k === 'wait') await sleep(x);
  else if (k === 'texts') console.log('TEXTS:', await texts(page));
  else if (k === 'key') { await page.keyboard.press(x); await sleep(800); }
  else if (k === 'scroll') { await page.mouse.move(206, 500); await page.mouse.wheel({ deltaY: x }); await sleep(900); }
  else if (k === 'go') await go(page, x);
}
await browser.close(); srv.close();
