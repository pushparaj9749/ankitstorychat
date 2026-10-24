import { startStatic, launch, sleep, shot, texts } from './harness.mts';
const srv = await startStatic();
const { browser, page } = await launch();
await page.goto('http://127.0.0.1:8081/', { waitUntil: 'networkidle0', timeout: 60000 }).catch(e=>console.log('goto',e.message));
for (const t of [3000, 6000]) { await sleep(t); await shot(page, 'boot_'+t, '/tmp/shots'); console.log(await texts(page)); }
await browser.close(); srv.close();
