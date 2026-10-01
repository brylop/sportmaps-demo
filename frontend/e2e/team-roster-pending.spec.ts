import { test, expect, devices } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * Lista "Gestiona los integrantes" del equipo con una inscripción 'pending'
 * (alta por QR sin pagar). Besser, 2026-09-30: la deportista no aparecía y el
 * club creía que no existía.
 *
 * No crea datos: intercepta la lectura de enrollments del equipo y marca una
 * fila activa como 'pending'. Usa el coach del fixture demo.
 */

const COACH = {
    email: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_EMAIL || 'qa-post-entreno-coach@sportmaps.test',
    password: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_PASSWORD || 'TestPass123!',
};

test.use({ ...devices['Pixel 7'] });

test('una inscripción pendiente se ve como "Pendiente de pago" y no suma al cupo', async ({ page }) => {
    test.setTimeout(90_000);

    await page.route(/\/rest\/v1\/enrollments\?.*team_id=eq\./, async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        const res = await route.fetch();
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0 && 'status' in rows[0]) {
            rows[0].status = 'pending';
        }
        await route.fulfill({ response: res, json: rows });
    });

    await loginAs(page, COACH);
    await page.goto('/teams');
    await page.getByTitle('Gestionar Deportistas').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Gestiona los integrantes de este equipo.')).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText('Pendiente de pago', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText('Entra al aprobar su primer pago')).toBeVisible();
    await expect(dialog.getByText(/1 pendiente de pago/)).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/roster-pending-01.png', fullPage: false });
    await dialog.getByText('Pendiente de pago', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'e2e/screenshots/roster-pending-02.png', fullPage: false });
});
