import { chromium, newSession, BASE_URL, ACC, sleep } from './lib.mjs';
const browser = await chromium.launch();
const { page } = await newSession(browser, ACC[process.argv[2]], { dpr: 1 });
page.on('console', m => { console.log('[console]', m.text().slice(0, 300)); });
page.on('response', async r => { if (r.status() >= 400) console.log('[resp]', r.status(), r.url().slice(0, 200), (await r.text().catch(()=>'')).slice(0, 300)); });
await page.goto(BASE_URL + process.argv[3]); await sleep(8000);
await browser.close();
