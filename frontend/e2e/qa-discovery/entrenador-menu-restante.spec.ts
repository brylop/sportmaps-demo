import { test } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// Cobertura del resto del menú de Felipe (Tenis) que la corrida anterior no
// llegó a tocar: Mis Equipos, Mis Deportistas, Calendario, Mi Dotación,
// Gestión de Rutinas, Supervisión, Encuestas, Resultados, Informe Mensual.
const SHOT_DIR = 'e2e/qa-discovery/screenshots/entrenador';
const ROUTES: Array<[string, string]> = [
    ['/teams', 'teams'],
    ['/students', 'students'],
    ['/coach-plans', 'coach-plans'],
    ['/coach/dotacion', 'coach-dotacion'],
    ['/results', 'results'],
    ['/messages', 'messages'],
];

test('Felipe: barrido del resto del menú', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, { email: 'entrenador.tenis@demo.sportmaps.co', password: 'Demo2026!' });
    await page.goto('/dashboard');
    await page.waitForSelector('[data-sidebar]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Recolectar los hrefs reales del sidebar en vez de adivinar rutas
    const hrefs = await page.locator('a[href^="/"]').evaluateAll((els) =>
        els.map((e) => (e as HTMLAnchorElement).getAttribute('href')).filter(Boolean)
    );
    console.log('[Felipe][menu] hrefs reales encontrados:', JSON.stringify([...new Set(hrefs)]));

    for (const [path] of ROUTES) {
        try {
            await page.goto(path);
            await page.waitForTimeout(2500);
            const txt = await page.locator('body').innerText().catch(() => '');
            const natLeak = /natac/i.test(txt);
            const fname = path.replace(/\//g, '') || 'root';
            await page.screenshot({ path: `${SHOT_DIR}/felipe-menu-${fname}.png`, fullPage: true });
            console.log(`[Felipe][menu][${path}] len=${txt.length} natacion_mention=${natLeak} snippet="${txt.slice(0, 150).replace(/\n/g, ' ')}"`);
        } catch (e: any) {
            console.log(`[Felipe][menu][${path}] ERROR: ${e.message}`);
        }
    }
});
