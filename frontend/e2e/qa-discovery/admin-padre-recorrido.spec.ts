import { test, devices, Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';

/**
 * Recorrido de descubrimiento (no afirma nada): captura las pantallas del
 * admin de escuela (escritorio + celular) y del acudiente (celular) para
 * revisar usabilidad. Cuentas del fixture demo.
 */

const ADMIN = {
    email: process.env.PLAYWRIGHT_DESCUENTOS_ADMIN_EMAIL || 'qa-descuentos-admin@sportmaps.test',
    password: process.env.PLAYWRIGHT_DESCUENTOS_ADMIN_PASSWORD || 'TestPass123!',
};
const PARENT = {
    email: process.env.PLAYWRIGHT_POST_ENTRENO_PARENT_EMAIL || 'qa-post-entreno-parent@sportmaps.test',
    password: process.env.PLAYWRIGHT_POST_ENTRENO_PARENT_PASSWORD || 'TestPass123!',
};

async function recorrer(page: Page, prefijo: string, rutas: string[]) {
    const errores: string[] = [];
    page.on('response', (r) => { if (r.status() >= 400) errores.push(`${r.status()} ${r.url().split('?')[0]}`); });
    for (const ruta of rutas) {
        await page.goto(`/${ruta}`);
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const nombre = ruta.replace(/[/?=]/g, '_');
        await page.screenshot({ path: `e2e/screenshots/${prefijo}-${nombre}.png`, fullPage: true });
    }
    console.log(`[errores ${prefijo}]`, [...new Set(errores)].join('\n'));
}

const ADMIN_RUTAS = [
    'dashboard', 'students', 'teams', 'payments-automation', 'school/enrollment-intake',
    'recepcion', 'finances', 'invitations', 'qr-signup', 'staff',
];

test.describe('admin escritorio', () => {
    test.use({ viewport: { width: 1366, height: 800 } });
    test('recorrido admin', async ({ page }) => {
        test.setTimeout(300_000);
        await loginAs(page, ADMIN);
        await recorrer(page, 'admin-desk', ADMIN_RUTAS);
    });
});

test.describe('admin celular', () => {
    test.use({ viewport: devices['Pixel 7'].viewport, userAgent: devices['Pixel 7'].userAgent, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, isMobile: true, hasTouch: true });
    test('recorrido admin celular', async ({ page }) => {
        test.setTimeout(300_000);
        await loginAs(page, ADMIN);
        await recorrer(page, 'admin-movil', ['dashboard', 'students', 'payments-automation']);
    });
});

test.describe('acudiente celular', () => {
    test.use({ viewport: devices['Pixel 7'].viewport, userAgent: devices['Pixel 7'].userAgent, deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor, isMobile: true, hasTouch: true });
    test('recorrido acudiente', async ({ page }) => {
        test.setTimeout(300_000);
        await loginAs(page, PARENT);
        await recorrer(page, 'padre', [
            'dashboard', 'children', 'my-payments', 'calendar', 'parent-attendance',
            'enrollments', 'my-cards', 'academic-progress', 'messages',
        ]);
    });
});
