import { test, expect, Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';

/**
 * QA exploratorio — rol ENTRENADOR/COACH (2026-09-18).
 * Cuentas demo reales de "Club Campestre Demo":
 *   - Felipe Torres (Tenis, Juvenil Competitivo)
 *   - Laura Gómez (Natación, Infantil)
 *
 * Objetivo: descubrir bugs, NO arreglarlos. Todo lo que se crea va con
 * prefijo "QA-TEST-" y no se borra desde el spec.
 *
 * Corre contra STAGING real (luebjarufsiadojhvxgi + bffdev.sportmaps.co).
 * NO borra estudiantes/inscripciones/pagos reales.
 */

const FELIPE = {
    email: 'entrenador.tenis@demo.sportmaps.co',
    password: 'Demo2026!',
    label: 'Felipe (Tenis)',
};
const LAURA = {
    email: 'entrenadora.natacion@demo.sportmaps.co',
    password: 'Demo2026!',
    label: 'Laura (Natación)',
};

const SHOT_DIR = 'e2e/qa-discovery/screenshots/entrenador';

function wireLogging(page: Page, tag: string, findings: string[]) {
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            const text = msg.text();
            console.log(`[${tag}][console.error]`, text);
            findings.push(`[${tag}] console.error: ${text}`);
        }
    });
    page.on('response', (res) => {
        if (res.status() >= 400) {
            const line = `[${tag}] HTTP ${res.status()} ${res.request().method()} ${res.url()}`;
            console.log(line);
            findings.push(line);
        }
    });
    page.on('pageerror', (err) => {
        const line = `[${tag}] pageerror: ${err.message}`;
        console.log(line);
        findings.push(line);
    });
}

test.describe.configure({ mode: 'serial' });

test.describe('QA exploratorio — Entrenador/Coach', () => {
    const findings: string[] = [];

    test.afterAll(() => {
        console.log('\n===== RESUMEN DE ERRORES CAPTURADOS =====');
        findings.forEach((f) => console.log(f));
        console.log(`Total: ${findings.length}`);
    });

    test('Felipe (Tenis): dashboard, atletas, asistencia, evaluación, periodización', async ({ page }) => {
        test.setTimeout(180_000);
        wireLogging(page, 'Felipe', findings);

        await loginAs(page, FELIPE);
        await page.goto('/dashboard');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SHOT_DIR}/felipe-01-dashboard.png`, fullPage: true });

        // ---- Sidebar / menú disponible ----
        const menuItems = await page.locator('a[href], button').allTextContents();
        console.log('[Felipe] menú visible (muestra):', menuItems.filter(Boolean).slice(0, 60));

        // ---- Lista de atletas (via asistencia, que lista roster) ----
        await page.goto('/coach-attendance');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SHOT_DIR}/felipe-02-coach-attendance.png`, fullPage: true });
        const bodyTextAttendance = await page.locator('body').innerText();
        if (/natac/i.test(bodyTextAttendance)) {
            findings.push('[Felipe][SCOPE-LEAK][coach-attendance] La palabra "Natación" aparece en la pantalla de asistencia de un coach de Tenis');
        }

        // Intenta entrar al primer equipo/categoría listado
        const teamCandidates = page.locator('text=/tenis/i').first();
        if (await teamCandidates.isVisible().catch(() => false)) {
            await teamCandidates.click();
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SHOT_DIR}/felipe-03-roster.png`, fullPage: true });
        } else {
            findings.push('[Felipe][coach-attendance] No se encontró ningún equipo/categoría de Tenis para seleccionar');
        }

        // ---- Evaluaciones (post-entrenamiento / calificación) ----
        await page.goto('/evaluations');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SHOT_DIR}/felipe-04-evaluations.png`, fullPage: true });
        const evalBody = await page.locator('body').innerText().catch(() => '');
        if (/natac/i.test(evalBody)) {
            findings.push('[Felipe][SCOPE-LEAK][evaluations] La palabra "Natación" aparece en /evaluations de un coach de Tenis');
        }
        if (evalBody.trim().length < 20) {
            findings.push('[Felipe][evaluations] Página aparenta estar en blanco (menos de 20 caracteres de texto)');
        }

        // ---- Informes del coach ----
        await page.goto('/coach-reports');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SHOT_DIR}/felipe-05-coach-reports.png`, fullPage: true });

        await page.goto('/coach-reports/entreno-equipo');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SHOT_DIR}/felipe-06-coach-reports-entreno-equipo.png`, fullPage: true });

        // ---- Planes de entrenamiento / Periodización (mesociclos) ----
        await page.goto('/training-plans');
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${SHOT_DIR}/felipe-07-training-plans.png`, fullPage: true });
        const trainingPlansBody = await page.locator('body').innerText().catch(() => '');
        if (/natac/i.test(trainingPlansBody)) {
            findings.push('[Felipe][SCOPE-LEAK][training-plans] La palabra "Natación" aparece en /training-plans de un coach de Tenis');
        }

        // Intentar crear un mesociclo de prueba marcado QA-TEST
        const newMesoBtn = page.getByRole('button', { name: /nuevo mesociclo|crear mesociclo|\+ mesociclo/i }).first();
        const mesoName = `QA-TEST-borrar-${Date.now()}`;
        let mesoCreated = false;
        if (await newMesoBtn.isVisible().catch(() => false)) {
            await newMesoBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: `${SHOT_DIR}/felipe-08-mesociclo-dialog.png`, fullPage: true });

            const nameInput = page.locator('input[name="name"], input[placeholder*="nombre" i], input#name').first();
            if (await nameInput.isVisible().catch(() => false)) {
                await nameInput.fill(mesoName);

                // Fechas: intento de caso límite -> fecha fin antes de fecha inicio
                const startInput = page.locator('input[type="date"]').first();
                const endInput = page.locator('input[type="date"]').nth(1);
                const today = new Date();
                const startStr = today.toISOString().slice(0, 10);
                const past = new Date(today.getTime() - 5 * 86400000).toISOString().slice(0, 10);
                if (await startInput.isVisible().catch(() => false)) {
                    await startInput.fill(startStr);
                }
                if (await endInput.isVisible().catch(() => false)) {
                    await endInput.fill(past); // fecha fin ANTES que inicio -> caso límite
                }
                await page.screenshot({ path: `${SHOT_DIR}/felipe-09-mesociclo-fechas-invalidas.png`, fullPage: true });

                const saveBtn = page.getByRole('button', { name: /guardar|crear/i }).last();
                if (await saveBtn.isVisible().catch(() => false)) {
                    await saveBtn.click();
                    await page.waitForTimeout(1500);
                    await page.screenshot({ path: `${SHOT_DIR}/felipe-10-mesociclo-submit-fechas-invalidas.png`, fullPage: true });

                    // Si no hubo validación visible y el diálogo cerró, es un hallazgo.
                    const dialogStillOpen = await page.getByRole('dialog').isVisible().catch(() => false);
                    if (!dialogStillOpen) {
                        findings.push('[Felipe][training-plans] El formulario de mesociclo aceptó fecha fin < fecha inicio sin bloquear/avisar (o el diálogo cerró igual)');
                    }

                    // Corrige la fecha fin y reintenta con nombre QA-TEST para dejar evidencia real
                    if (await endInput.isVisible().catch(() => false)) {
                        const future = new Date(today.getTime() + 21 * 86400000).toISOString().slice(0, 10);
                        await endInput.fill(future);
                        await saveBtn.click().catch(() => {});
                        await page.waitForTimeout(1500);
                        mesoCreated = true;
                    }
                } else {
                    findings.push('[Felipe][training-plans] No se encontró botón Guardar/Crear en el diálogo de mesociclo');
                }
            } else {
                findings.push('[Felipe][training-plans] Diálogo de nuevo mesociclo no expone un input de nombre reconocible');
            }
        } else {
            findings.push('[Felipe][training-plans] No se encontró botón para crear un nuevo mesociclo (puede requerir seleccionar equipo primero)');
        }

        await page.screenshot({ path: `${SHOT_DIR}/felipe-11-training-plans-post-crear.png`, fullPage: true });

        // Recarga y confirma persistencia (bug histórico: mesociclo se crea, semanas/sesiones no)
        await page.reload();
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${SHOT_DIR}/felipe-12-training-plans-tras-reload.png`, fullPage: true });
        const bodyAfterReload = await page.locator('body').innerText().catch(() => '');
        if (mesoCreated && !bodyAfterReload.includes(mesoName)) {
            findings.push(`[Felipe][CRITICO][training-plans] El mesociclo "${mesoName}" NO aparece tras recargar la página — posible regresión del bug de persistencia`);
        } else if (mesoCreated) {
            findings.push(`[Felipe][OK][training-plans] El mesociclo "${mesoName}" persiste tras recargar`);
        }

        // ---- Intento de acción fuera de alcance: URLs de admin de escuela ----
        for (const adminPath of ['/school-sports', '/offerings', '/memberships']) {
            await page.goto(adminPath);
            await page.waitForTimeout(1200);
            const txt = await page.locator('body').innerText().catch(() => '');
            const blocked = /no autorizado|no tienes permiso|acceso denegado|403/i.test(txt) || page.url().includes('/dashboard') || page.url().includes('/login');
            await page.screenshot({ path: `${SHOT_DIR}/felipe-13-adminpath-${adminPath.replace(/\//g, '')}.png`, fullPage: true });
            if (!blocked) {
                findings.push(`[Felipe][REVISAR][${adminPath}] Un coach pudo cargar una ruta pensada para admin de escuela sin redirección/bloqueo visible (revisar screenshot; puede estar vacía por RLS, no necesariamente una fuga)`);
            }
        }
    });

    test('Laura (Natación): dashboard, atletas, evaluaciones — confirmar aislamiento de Felipe', async ({ page }) => {
        test.setTimeout(120_000);
        wireLogging(page, 'Laura', findings);

        await loginAs(page, LAURA);
        await page.goto('/dashboard');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SHOT_DIR}/laura-01-dashboard.png`, fullPage: true });

        await page.goto('/coach-attendance');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SHOT_DIR}/laura-02-coach-attendance.png`, fullPage: true });
        const bodyAttendanceLaura = await page.locator('body').innerText().catch(() => '');
        if (/tenis/i.test(bodyAttendanceLaura)) {
            findings.push('[Laura][SCOPE-LEAK][coach-attendance] La palabra "Tenis" aparece en la pantalla de asistencia de una coach de Natación');
        }

        await page.goto('/training-plans');
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${SHOT_DIR}/laura-03-training-plans.png`, fullPage: true });
        const trainingPlansBodyLaura = await page.locator('body').innerText().catch(() => '');
        if (/tenis/i.test(trainingPlansBodyLaura)) {
            findings.push('[Laura][SCOPE-LEAK][training-plans] La palabra "Tenis" aparece en /training-plans de una coach de Natación');
        }
        // Si el mesociclo QA-TEST de Felipe (Tenis) aparece acá, es fuga de datos cross-discipline.
        if (/QA-TEST-borrar-/.test(trainingPlansBodyLaura)) {
            findings.push('[Laura][CRITICO][SCOPE-LEAK][training-plans] El mesociclo QA-TEST creado por Felipe (Tenis) es visible para Laura (Natación)');
        }

        await page.goto('/evaluations');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SHOT_DIR}/laura-04-evaluations.png`, fullPage: true });
        const evalBodyLaura = await page.locator('body').innerText().catch(() => '');
        if (/tenis/i.test(evalBodyLaura)) {
            findings.push('[Laura][SCOPE-LEAK][evaluations] La palabra "Tenis" aparece en /evaluations de una coach de Natación');
        }

        await page.goto('/coach-reports');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SHOT_DIR}/laura-05-coach-reports.png`, fullPage: true });
    });
});
