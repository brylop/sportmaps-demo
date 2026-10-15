import { chromium, newSession, BASE_URL, ACC, sleep } from './lib.mjs';
const browser = await chromium.launch();
const { page } = await newSession(browser, ACC[process.argv[2]], { dpr: 1 });
await page.goto(BASE_URL + '/dashboard'); await sleep(8000);
console.log(await page.evaluate(() => { const a = document.querySelector('aside') || document.querySelector('[data-sidebar]'); return a ? a.outerHTML.slice(0, 3000) : 'NO ASIDE ' + document.body.innerHTML.slice(0, 1500); }));
await browser.close();
