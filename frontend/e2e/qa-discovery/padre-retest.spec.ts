import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = 'http://localhost:3004';
const SHOT_DIR = path.join(__dirname, 'screenshots', 'padre-retest');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('tu@correo.com').fill('mherrera@demo.sportmaps.co');
  await page.getByPlaceholder('••••••••').fill('Demo2026!');
  await page.getByRole('button', { name: /Entrar ahora/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 }).catch(() => {});
}

const routes = ['children', 'my-payments', 'enrollments', 'mi-tienda', 'estado-cuenta', 'notifications'];

for (const route of routes) {
  test(`retest-${route}`, async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/${route}`);
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SHOT_DIR, `${route}-8s.png`), fullPage: true });
    const text = (await page.textContent('body').catch(() => '')) || '';
    console.log(`ROUTE ${route} after 8s: len=${text.length} snippet="${text.slice(0,200).replace(/\s+/g,' ')}"`);
  });
}
