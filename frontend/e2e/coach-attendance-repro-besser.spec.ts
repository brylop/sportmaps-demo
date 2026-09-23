import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * Repro del reporte de Besser (2026-09-18): coach con 3 categorías asignadas
 * (Duvan Daza), atletas sin cuenta que no aparecían al evaluar, y un
 * "mensaje en rojo" tras reabrir/finalizar que el usuario no pudo capturar.
 *
 * Usa el fixture demo (Escuela Demo SportMaps, is_demo=true) — NO toca Besser.
 * El coach de prueba (qa-post-entreno-coach@sportmaps.test) fue asignado a
 * los 3 equipos demo (Thunder/Lightning/Halcones) y Lightning tiene una
 * atleta sin cuenta ("QA Repro Sin Cuenta") para replicar el escenario.
 */

const COACH = {
    email: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_EMAIL || 'qa-post-entreno-coach@sportmaps.test',
    password: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_PASSWORD || 'TestPass123!',
};

test('coach con 3 categorías: tomar asistencia, finalizar, evaluar y reabrir en Lightning', async ({ page }) => {
    test.setTimeout(90_000);
    page.on('console', (msg) => console.log('[browser]', msg.type(), msg.text()));
    page.on('requestfailed', (req) => {
        console.log('[FAILED]', req.method(), req.url(), req.failure()?.errorText);
    });
    page.on('response', async (res) => {
        if (res.url().includes('/attendance/') || res.url().includes('/roster') || res.status() >= 400) {
            console.log('[resp]', res.status(), res.url());
        }
    });

    await loginAs(page, COACH);
    await page.goto('/coach-attendance');

    await expect(page.getByRole('heading', { name: 'Asistencias' })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'e2e/screenshots/01-landing-equipos.png', fullPage: true });

    // Selecciona el equipo Lightning (tiene la atleta sin cuenta).
    await page.getByText('LIGHTNING', { exact: false }).first().click();

    await expect(page.getByText(/^\d+ Atletas$/)).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e/screenshots/02-roster-lightning.png', fullPage: true });

    // Confirma que la atleta sin cuenta aparece con su nombre real en la
    // lista de TOMAR asistencia (esto ya funcionaba antes del fix).
    await expect(page.getByText('QA Repro Sin Cuenta')).toBeVisible({ timeout: 10_000 });

    // Marca todos presentes y guarda.
    const markAllBtn = page.getByRole('button', { name: '✅ Todos presentes' });
    if (await markAllBtn.isVisible().catch(() => false)) {
        await markAllBtn.click();
    }
    const saveBtn = page.getByRole('button', { name: /Guardar asistencia/ });
    if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: 'e2e/screenshots/03-despues-de-guardar.png', fullPage: true });

    console.log('[buttons]', await page.getByRole('button').allTextContents());

    // Finaliza la sesión (dispara el diálogo de rating post-entreno).
    const finalizeBtn = page.getByRole('button', { name: /Finalizar sesión/ });
    await finalizeBtn.scrollIntoViewIfNeeded().catch(() => {});
    if (await finalizeBtn.isVisible().catch(() => false)) {
        await finalizeBtn.click();
        const confirmBtn = page.getByRole('button', { name: /Sí, finalizar/ });
        await confirmBtn.click();
        await page.waitForTimeout(3000);
    } else {
        console.log('[warn] botón Finalizar sesión no visible');
    }
    await page.screenshot({ path: 'e2e/screenshots/04-despues-de-finalizar.png', fullPage: true });

    // El diálogo de rating debería haberse abierto solo. Si sigue abierto,
    // esta es la captura clave: ¿aparece "QA Repro Sin Cuenta" con su nombre
    // real, o colapsada como "Deportista"?
    const ratingDialog = page.getByRole('dialog').filter({ hasText: 'Califica el entreno de hoy' });
    if (await ratingDialog.isVisible().catch(() => false)) {
        await page.screenshot({ path: 'e2e/screenshots/05-dialogo-evaluar.png', fullPage: true });
        await expect(ratingDialog.getByText('QA Repro Sin Cuenta')).toBeVisible();
        await expect(ratingDialog.getByText(/Sin cuenta registrada/)).toBeVisible();
        await page.getByRole('button', { name: 'Después' }).click();
    }

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/06-sesion-finalizada-banner.png', fullPage: true });

    // Reabre la sesión — esta es la captura que buscamos: ¿qué mensaje
    // (rojo o no) aparece exactamente?
    const reopenBtn = page.getByRole('button', { name: /Reabrir para corregir/ });
    if (await reopenBtn.isVisible().catch(() => false)) {
        await reopenBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'e2e/screenshots/07-despues-de-reabrir.png', fullPage: true });
    }
});
