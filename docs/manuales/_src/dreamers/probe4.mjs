import { chromium, newSession, BASE_URL, ACC, sleep } from './lib.mjs';
const browser = await chromium.launch();
const { page } = await newSession(browser, ACC.parent, { dpr: 1 });
await page.goto(BASE_URL + '/schools/57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe'); await sleep(9000);
await page.screenshot({ path: 'discover/s1.png', fullPage: true });
const btns = await page.getByRole('button', { name: /Inscribirme/ }).count(); console.log('inscribirme', btns);
console.log(await page.evaluate(() => document.body.innerText.slice(0, 2500)));
await browser.close();
