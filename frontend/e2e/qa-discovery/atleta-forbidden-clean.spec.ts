import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3004';
const VALENTINA = { email: 'vcruz@demo.sportmaps.co', password: 'Demo2026!' };

async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.getByRole('button', { name: /entrar ahora/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

test.setTimeout(120_000);

for (const route of ['/students', '/admin', '/staff']) {
  test(`clean privilege-check ${route}`, async ({ page }) => {
    await login(page, VALENTINA);
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(async (e) => {
      console.log(`nav error for ${route}: ${e.message}`);
    });
    await page.waitForTimeout(2500);
    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log(`ROUTE=${route} finalUrl=${url} bodyTextLen=${bodyText.length} bodyPreview="${bodyText.slice(0,300).replace(/\n/g,' | ')}"`);
    await page.screenshot({ path: `e2e/qa-discovery/screenshots/atleta/clean-forbidden-${route.replace(/\//g,'_')}.png`, fullPage: true });
  });
}
