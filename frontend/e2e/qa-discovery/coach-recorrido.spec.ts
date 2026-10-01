import { test, devices } from '@playwright/test';
import { loginAs } from '../helpers/auth';

/**
 * Recorrido de descubrimiento (no afirma nada): captura en celular las
 * pantallas del menú del entrenador para revisar usabilidad. Coach demo.
 */

const COACH = {
    email: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_EMAIL || 'qa-post-entreno-coach@sportmaps.test',
    password: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_PASSWORD || 'TestPass123!',
};

const RUTAS = [
    'dashboard', 'teams', 'training-plans', 'students', 'calendar',
    'coach-attendance', 'results', 'coach-reports', 'messages', 'announcements',
];

test.use({ ...devices['Pixel 7'] });

test('recorrido del entrenador en celular', async ({ page }) => {
    test.setTimeout(240_000);
    const errores: string[] = [];
    page.on('response', (r) => { if (r.status() >= 400) errores.push(`${r.status()} ${r.url().split('?')[0]}`); });

    await loginAs(page, COACH);
    for (const ruta of RUTAS) {
        await page.goto(`/${ruta}`);
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `e2e/screenshots/coach-${ruta}.png`, fullPage: true });
    }
    // Menú lateral abierto
    await page.goto('/dashboard');
    await page.waitForTimeout(1500);
    const menu = page.getByRole('button', { name: /menú|menu|abrir/i }).first();
    if (await menu.isVisible().catch(() => false)) {
        await menu.click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'e2e/screenshots/coach-menu.png', fullPage: false });
    }
    console.log('[errores]', [...new Set(errores)].join('\n'));
});
