// Capturas REALES para el manual de Dreamers Gymnastics (familias + escuela).
// SIEMPRE contra el gemelo Docker local (copia anonimizada de Dreamers, nombres
// ficticios), nunca contra la viva. Ver README del manual y lib.mjs.
//
//   ONLY=p01,p02 node capture.mjs      (reanudable: solo esos pasos)
import fs from 'node:fs';
import path from 'node:path';
import { chromium, newSession, BASE_URL, ACC, here, sleep } from './lib.mjs';

const SHOTS = path.join(here, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (id) => !ONLY.length || ONLY.includes(id);

async function clean(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body *')) {
      if (el.childElementCount === 0 && /AMBIENTE DE QA/i.test(el.textContent || '')) { (el.closest('div[class*="fixed"],div[class*="sticky"]') || el.parentElement || el).remove(); }
    }
    const fab = [...document.querySelectorAll('button')].find(b => /soporte|ayuda/i.test(b.getAttribute('aria-label') || ''));
    if (fab) fab.style.display = 'none';
  }).catch(() => {});
  await sleep(300);
}
async function go(page, url, waitText) {
  await page.goto(BASE_URL + url);
  if (waitText) await page.getByText(waitText, { exact: false }).first().waitFor({ timeout: 30000 }).catch(() => console.log('  (no apareció)', waitText));
  await sleep(2500); await clean(page);
}
async function shot(page, id, target) {
  const file = path.join(SHOTS, id + '.png');
  if (!target) await page.screenshot({ path: file });
  else if (target === 'full') await page.screenshot({ path: file, fullPage: true });
  else await target.screenshot({ path: file });
  console.log('✓', id);
}
const dialog = (page) => page.locator('[role="dialog"]').last();

const browser = await chromium.launch();
const steps = (await import('./steps.mjs')).default;
for (const [role, list] of Object.entries(steps)) {
  const todo = list.filter(([id]) => want(id)); if (!todo.length) continue;
  const { page, context } = await newSession(browser, ACC[role]);
  for (const [id, fn] of todo) {
    try { await fn({ page, go, shot: (t) => shot(page, id, t), dialog: () => dialog(page), clean: () => clean(page), sleep }); }
    catch (e) { console.log('✗', id, e.message.split('\n')[0]); await page.screenshot({ path: path.join(SHOTS, '_err-' + id + '.png') }); }
  }
  await context.close();
}
await browser.close();
