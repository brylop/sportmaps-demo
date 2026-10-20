// Solo captura la tarjeta «Cobros sueltos» (no escribe nada).
import path from 'node:path';
import { chromium, newSession, here } from './lib.mjs';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const browser = await chromium.launch({ args: ['--disable-web-security'] });
try {
  const { page } = await newSession(browser, { viewport: { width: 1400, height: 1100 } });
  await page.goto(`${BASE}/payments-automation`);
  await page.getByRole('tab', { name: 'Config' }).waitFor({ timeout: 60_000 });
  await page.getByRole('tab', { name: 'Config' }).click();
  await page.waitForTimeout(2500);
  const t = page.getByText('Cobros sueltos', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
  await t.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await t.screenshot({ path: path.join(here, 'shots', 'v-05-catalogo-ajustado.png') });
  console.log('ok');
} catch (e) { console.log('ERROR', e.message); } finally { await browser.close(); }
