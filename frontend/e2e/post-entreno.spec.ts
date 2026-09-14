import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * E2E de Evaluación Post-Entrenamiento — docs/specs/evaluacion-post-entrenamiento.md
 *
 * Requiere el fixture de supabase/seed/post_entreno_test_users.sql aplicado
 * (parent + coach + hijo en "Escuela Demo SportMaps" / equipo Thunder) y una
 * sesión de HOY finalizada con el hijo presente — se crea a mano cada corrida
 * porque `attendance_sessions` tiene UNIQUE(team_id, session_date), así que no
 * puede vivir en un seed idempotente entre días distintos.
 *
 * Variables de entorno (adicionales a PLAYWRIGHT_SUPABASE_URL/ANON_KEY ya
 * usadas por branding-isolation.spec.ts):
 *   PLAYWRIGHT_POST_ENTRENO_SESSION_ID   — attendance_sessions.id de hoy, finalizada
 *   PLAYWRIGHT_POST_ENTRENO_CHILD_ID     — children.id de "QA Post Entreno Hijo"
 *   PLAYWRIGHT_POST_ENTRENO_TEAM_ID      — de320000-0000-4000-8000-000000000001 (Thunder) por default
 */

const PARENT = {
    email: process.env.PLAYWRIGHT_POST_ENTRENO_PARENT_EMAIL || 'qa-post-entreno-parent@sportmaps.test',
    password: process.env.PLAYWRIGHT_POST_ENTRENO_PARENT_PASSWORD || 'TestPass123!',
};
const COACH = {
    email: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_EMAIL || 'qa-post-entreno-coach@sportmaps.test',
    password: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_PASSWORD || 'TestPass123!',
};
const SESSION_ID = process.env.PLAYWRIGHT_POST_ENTRENO_SESSION_ID;
const CHILD_ID = process.env.PLAYWRIGHT_POST_ENTRENO_CHILD_ID;
const TEAM_ID = process.env.PLAYWRIGHT_POST_ENTRENO_TEAM_ID || 'de320000-0000-4000-8000-000000000001';

test.describe('Evaluación post-entrenamiento', () => {
    test.skip(!SESSION_ID || !CHILD_ID, 'Requiere PLAYWRIGHT_POST_ENTRENO_SESSION_ID y _CHILD_ID (sesión de hoy, finalizada).');

    test('el padre completa la autoevaluación de 5 pasos', async ({ page }) => {
        await loginAs(page, PARENT);
        await page.goto(`/post-entreno/${SESSION_ID}?child_id=${CHILD_ID}`);

        // Paso 0 — Entrada
        await expect(page.getByRole('heading', { name: /¡Hola/ })).toBeVisible({ timeout: 15_000 });
        await page.getByRole('button', { name: 'Empezar' }).click();

        // Paso 1 — BORG: elige 9
        await expect(page.getByText('¿Qué tan cansada terminaste?')).toBeVisible();
        await page.getByRole('button', { name: '9', exact: true }).click();
        await page.getByRole('button', { name: 'Siguiente' }).click();

        // Paso 2 — Comprensión: primera opción (avanza sola)
        await expect(page.getByText('¿Entendiste los ejercicios de hoy?')).toBeVisible();
        await page.getByRole('button', { name: 'Las comprendí y apliqué' }).click();

        // Paso 3 — Esfuerzo: 90% — EFFORT_STEPS = [50,60,70,80,90,100], 90 es el 5º botón.
        // (el "90" de la fila de etiquetas debajo es un <span>, no clickeable.)
        await expect(page.getByText('¿Cuánto te esforzaste hoy?')).toBeVisible();
        await page.locator('div.h-40 > button').nth(4).click();
        await page.getByRole('button', { name: 'Siguiente' }).click();

        // Paso 4 — Satisfacción: tercera opción (avanza sola)
        await expect(page.getByText('¿Cómo te sentiste al terminar?')).toBeVisible();
        await page.locator('button[title="Me siento alegre y satisfecha"]').click();

        // Paso 5 — Aspectos a mejorar: opcional, se salta con "Terminar"
        await expect(page.getByText('¿Qué quieres mejorar la próxima vez?')).toBeVisible();
        await page.getByRole('button', { name: 'Terminar' }).click();

        // Paso 6 — Cierre
        await expect(page.getByRole('heading', { name: '¡Listo!' })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText('Hoy terminaste en')).toBeVisible();
    });

    test('el coach ve el agregado del equipo en el informe grupal', async ({ page }) => {
        await loginAs(page, COACH);
        await page.goto('/coach-reports/entreno-equipo');

        await page.getByRole('combobox').first().click();
        await page.getByRole('option', { name: 'Thunder' }).click();

        await expect(page.getByText(/Thunder ·/)).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('Cansancio (BORG)')).toBeVisible();
    });
});
