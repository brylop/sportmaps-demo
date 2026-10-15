import fs from 'node:fs';
import path from 'node:path';
import { chromium, newSession, BASE_URL, ACC, here, sleep } from './lib.mjs';
const role = process.argv[2] || 'parent';
const out = path.join(here, 'discover', role); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const { page } = await newSession(browser, ACC[role], { dpr: 1 });
await page.goto(BASE_URL + '/dashboard'); await sleep(8000);
// abrir cada grupo (acordeón) y juntar sus enlaces
const set = new Set();
const grab = async () => (await page.evaluate(() => [...document.querySelectorAll('[data-sidebar="sidebar"] a[href]')].map(a => a.getAttribute('href') + '|' + a.innerText.trim().replace(/\s+/g, ' ')))).forEach(x => set.add(x));
await grab();
const nb = await page.locator('[data-sidebar="sidebar"] button').count();
for (let j = 0; j < nb; j++) { await page.locator('[data-sidebar="sidebar"] button').nth(j).click().catch(() => {}); await sleep(400); await grab(); }
await page.screenshot({ path: path.join(out, '00-dashboard.png'), fullPage: true });
const links = [...set];
console.log(links.join('\n'));
let i = 1;
for (const l of links) {
  const [href] = l.split('|'); if (!href.startsWith('/') || href === '/dashboard') continue;
  try { await page.goto(BASE_URL + href); await sleep(5000);
    await page.screenshot({ path: path.join(out, String(i++).padStart(2, '0') + href.replace(/[\/:?=&]/g, '_') + '.png'), fullPage: true }); } catch (e) { console.log('ERR', href, e.message); }
}
await browser.close();
