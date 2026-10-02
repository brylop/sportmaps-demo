import { test, expect, devices, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * Mesociclos — el mes siguiente y los días de cada semana (Carmel y Besser,
 * 2026-10-02):
 *  1. Un equipo con el mesociclo de septiembre no podía crear octubre (solo se
 *     mostraba el último y no había "Nuevo").
 *  2. El entrenador de arqueros no encontraba cómo cargar el domingo: la
 *     semana solo mostraba los días ya cargados, y su sesión del sábado, creada
 *     antes del mesociclo, quedó guardada pero invisible.
 *  3. Las fechas se mostraban un día antes (semana del 3 al 10 → "2 oct").
 *
 * No escribe nada: intercepta las lecturas de mesociclos, semanas, días y
 * sesiones del equipo con un caso igual al de Carmel. Coach del fixture demo.
 */

const COACH = {
    email: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_EMAIL || 'qa-post-entreno-coach@sportmaps.test',
    password: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_PASSWORD || 'TestPass123!',
};

const SEP = { id: '00000000-0000-4000-8000-00000000a001', starts_on: '2026-09-05', ends_on: '2026-09-27' };
const OCT = { id: '00000000-0000-4000-8000-00000000a002', starts_on: '2026-10-03', ends_on: '2026-10-31' };
const meso = (m: typeof SEP) => ({
    ...m, school_id: null, team_id: null, n_sessions_planned: 12, session_duration_minutes: 90,
    general_objective: 'Objetivo QA', game_model: 'Modelo QA', evaluation_mode: 'team', closing_review: {},
    created_by: null, created_at: '2026-09-30T00:00:00Z', updated_at: '2026-09-30T00:00:00Z',
});
const WEEKS = [
    ['2026-10-03', '2026-10-10'], ['2026-10-11', '2026-10-17'], ['2026-10-18', '2026-10-24'], ['2026-10-25', '2026-10-31'],
].map(([s, e], i) => ({
    id: `00000000-0000-4000-8000-00000000b00${i + 1}`, mesocycle_id: OCT.id, number: i + 1, starts_on: s, ends_on: e,
    school_id: null, team_id: null, objective: null, objective_compliance: null, collective_performance: null, improvement_notes: null,
}));
const SESSIONS = [
    // Sábado 3 suelto (creado antes del mesociclo): tiene que aparecer en su día con "Enganchar".
    { id: '00000000-0000-4000-8000-00000000c001', session_date: '2026-10-03', objectives: 'Sesión del sábado QA', microcycle_day_id: null },
    // Fuera del mes: va a "Sesiones sin semana".
    { id: '00000000-0000-4000-8000-00000000c002', session_date: '2026-09-19', objectives: 'Sesión vieja QA', microcycle_day_id: null },
].map((s) => ({ ...s, team_id: null, school_id: null, warmup: null, drills: [], notes: null, materials: null, session_blocks: [], game_principles: null, evaluation: null, created_at: '2026-09-30T00:00:00Z', updated_at: '2026-09-30T00:00:00Z' }));

async function mockPlanning(page: Page) {
    await page.route(/\/rest\/v1\/training_mesocycles\?/, (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        const list = [meso(OCT), meso(SEP)];
        // La consulta "mesocycle-current" de TrainingPlansPage pide limit=1.
        return route.fulfill({ json: route.request().url().includes('limit=1') ? [list[0]] : list });
    });
    await page.route(/\/rest\/v1\/training_microcycles\?/, (route) =>
        route.request().method() !== 'GET' ? route.continue()
            : route.fulfill({ json: route.request().url().includes(OCT.id) ? WEEKS : [] }));
    await page.route(/\/rest\/v1\/training_microcycle_days\?/, (route) =>
        route.request().method() !== 'GET' ? route.continue() : route.fulfill({ json: [] }));
    await page.route(/\/rest\/v1\/training_sessions\?/, (route) =>
        route.request().method() !== 'GET' ? route.continue() : route.fulfill({ json: SESSIONS }));
}

async function openTeam(page: Page) {
    await mockPlanning(page);
    await loginAs(page, COACH);
    await page.goto('/training-plans');
    await page.getByRole('combobox').first().click({ timeout: 20_000 });
    await page.getByRole('option', { name: /THUNDER/i }).first().click();
}

test.describe('mesociclos: mes siguiente y días de la semana', () => {
    test('abre octubre, deja crear el siguiente y muestra los 8 días de la semana 1', async ({ page }) => {
        test.setTimeout(90_000);
        await openTeam(page);

        // 1. Entre meses (hoy 2 oct) abre el PRÓXIMO, con fechas correctas (no "2 oct").
        await expect(page.getByText(/Mesociclo — 3 (de )?oct\.? → 31 (de )?oct/)).toBeVisible({ timeout: 20_000 });
        // Selector para volver a septiembre.
        await expect(page.getByRole('combobox', { name: 'Ver otro mesociclo' })).toBeVisible();

        // 2. Semana 1 = sáb 3 a sáb 10: 8 filas, el domingo con su "Crear sesión".
        await expect(page.getByText(/Semana 1/)).toBeVisible();
        await expect(page.getByText(/3 (de )?oct\.? – 10 (de )?oct/)).toBeVisible();
        const week1 = page.getByRole('region').filter({ hasText: 'Sesión del sábado QA' }).first();
        await expect(week1.getByRole('button', { name: 'Crear sesión' })).toHaveCount(8); // los 8 días sin planear (el sábado, además, con la suelta para enganchar)
        await expect(week1.getByText(/dom\.? 4/i)).toBeVisible();

        // 3. La sesión suelta del sábado aparece con "Enganchar" (no se toca: escribiría).
        await expect(week1.getByRole('button', { name: /Enganchar/ })).toHaveCount(1);
        // La de septiembre, en "Sesiones sin semana".
        await expect(page.getByText(/Sesiones sin semana \(1\)/)).toBeVisible();
        await expect(page.getByText('Sesión vieja QA')).toBeVisible();
        await week1.screenshot({ path: 'e2e/screenshots/mesociclo-01-semana1.png' });
        await page.screenshot({ path: 'e2e/screenshots/mesociclo-01-octubre.png', fullPage: true });

        // 4. "Nuevo mesociclo" arranca el día después del último (1 nov) y hereda el modelo de juego.
        await page.getByRole('button', { name: 'Nuevo mesociclo' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: /Crear Mesociclo/ })).toBeVisible();
        await expect(dialog.getByText(/1 de noviembre de 2026|1 nov/i).first()).toBeVisible();
        await expect.poll(() => dialog.locator('textarea, input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toContain('Modelo QA');
        await page.screenshot({ path: 'e2e/screenshots/mesociclo-02-nuevo.png' });
        await dialog.getByRole('button', { name: /Cancelar/ }).click();

        // 5. El selector deja abrir septiembre.
        await page.getByRole('combobox', { name: 'Ver otro mesociclo' }).click();
        await page.getByRole('option', { name: /5 (de )?sept?\.? → 27 (de )?sept?/ }).click();
        await expect(page.getByText(/Mesociclo — 5 (de )?sept?\.? → 27 (de )?sept?/)).toBeVisible();
    });

    test.describe('en celular', () => {
        const { defaultBrowserType: _b, ...pixel } = devices['Pixel 7'];
        test.use(pixel);
        test('la semana con sus días y botones entra en pantalla', async ({ page }) => {
            test.setTimeout(90_000);
            await openTeam(page);
            await expect(page.getByText(/Mesociclo — 3 (de )?oct/)).toBeVisible({ timeout: 20_000 });
            // Las acciones del mesociclo entran a lo ancho (antes "Editar" quedaba cortado y "Eliminar" afuera).
            for (const name of ['Nuevo mesociclo', 'Exportar PDF', 'Editar', 'Eliminar']) {
                const b = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
                expect(b.x + b.width, name).toBeLessThanOrEqual(page.viewportSize()!.width);
            }
            const crear = page.getByRole('button', { name: 'Crear sesión' }).first();
            await crear.scrollIntoViewIfNeeded();
            await expect(crear).toBeInViewport({ ratio: 1 });
            await page.screenshot({ path: 'e2e/screenshots/mesociclo-03-celular.png', fullPage: true });
        });
    });
});
