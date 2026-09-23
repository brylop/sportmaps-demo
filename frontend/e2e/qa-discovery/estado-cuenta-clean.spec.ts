import { test, Page } from '@playwright/test';

const BASE = 'http://localhost:3004';
const USERS = [
  { email: 'vcruz@demo.sportmaps.co', password: 'Demo2026!', tag: 'valentina' },
  { email: 'dospina@demo.sportmaps.co', password: 'Demo2026!', tag: 'daniel' },
];

async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.getByRole('button', { name: /entrar ahora/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

test.setTimeout(60_000);

for (const u of USERS) {
  test(`estado-cuenta clean retry ${u.tag}`, async ({ page }) => {
    page.on('response', (res) => {
      if (res.status() >= 400) console.log(`[${u.tag}] HTTP ${res.status()} ${res.url()}`);
    });
    await login(page, u);
    await page.goto(`${BASE}/estado-cuenta`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log(`[${u.tag}] estado-cuenta bodyPreview="${bodyText.slice(0,200).replace(/\n/g,' | ')}"`);
    await page.screenshot({ path: `e2e/qa-discovery/screenshots/atleta/clean-estado-cuenta-${u.tag}.png`, fullPage: true });
    // retry once more (second load) to see if transient
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    const bodyText2 = await page.locator('body').innerText().catch(() => '');
    console.log(`[${u.tag}] estado-cuenta RELOAD bodyPreview="${bodyText2.slice(0,200).replace(/\n/g,' | ')}"`);
    await page.screenshot({ path: `e2e/qa-discovery/screenshots/atleta/clean-estado-cuenta-${u.tag}-reload.png`, fullPage: true });
  });
}
