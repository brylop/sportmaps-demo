import { test, expect, Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// Follow-up dirigido: confirmar que un coach puede abrir el card de
// "Mis Planes" de UNA DISCIPLINA QUE NO ES LA SUYA desde /coach-attendance,
// y ver datos reales (nombres/atletas) de esa disciplina.
const SHOT_DIR = 'e2e/qa-discovery/screenshots/entrenador';

function wireNet(page: Page, tag: string) {
    page.on('response', (res) => {
        const url = res.url();
        if (url.includes('/rest/v1/') || url.includes('/functions/v1/') || url.includes('bffdev.sportmaps.co') || url.includes('supabase.co')) {
            console.log(`[${tag}][NET] ${res.status()} ${res.request().method()} ${url}`);
        }
    });
    page.on('console', (msg) => {
        if (msg.type() === 'error') console.log(`[${tag}][console.error]`, msg.text());
    });
    page.on('pageerror', (err) => console.log(`[${tag}][pageerror]`, err.message));
}

test('Felipe (Tenis) abre el plan de NATACION desde Asistencias', async ({ page }) => {
    test.setTimeout(60_000);
    wireNet(page, 'Felipe->Natacion');
    await loginAs(page, { email: 'entrenador.tenis@demo.sportmaps.co', password: 'Demo2026!' });
    await page.goto('/coach-attendance');
    await page.waitForTimeout(2000);
    const natacionCard = page.getByText(/natac/i).first();
    await expect(natacionCard).toBeVisible({ timeout: 10_000 });
    await natacionCard.click();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${SHOT_DIR}/felipe-14-abre-plan-natacion.png`, fullPage: true });
    console.log('[Felipe->Natacion] URL tras click:', page.url());
    console.log('[Felipe->Natacion] body:', (await page.locator('body').innerText()).slice(0, 1500));
});

test('Laura (Natacion) abre el plan de TENIS desde Asistencias', async ({ page }) => {
    test.setTimeout(60_000);
    wireNet(page, 'Laura->Tenis');
    await loginAs(page, { email: 'entrenadora.natacion@demo.sportmaps.co', password: 'Demo2026!' });
    await page.goto('/coach-attendance');
    await page.waitForTimeout(2000);
    const tenisCard = page.getByText(/^tenis$/i).first();
    await expect(tenisCard).toBeVisible({ timeout: 10_000 });
    await tenisCard.click();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${SHOT_DIR}/laura-06-abre-plan-tenis.png`, fullPage: true });
    console.log('[Laura->Tenis] URL tras click:', page.url());
    console.log('[Laura->Tenis] body:', (await page.locator('body').innerText()).slice(0, 1500));
});
