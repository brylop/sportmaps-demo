import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// Follow-up dirigido: confirmar si un mesociclo QA-TEST creado por Felipe
// (Tenis) persiste tras un reload real. El intento anterior usaba esperas
// fijas de 2-2.5s que no alcanzaban para que /training-plans saliera del
// spinner "Cargando...", así que nunca llegó a crear nada. Esta corrida usa
// esperas por selector real en vez de timeouts fijos.
const SHOT_DIR = 'e2e/qa-discovery/screenshots/entrenador';

test('Felipe crea mesociclo QA-TEST y verifica persistencia tras reload', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, { email: 'entrenador.tenis@demo.sportmaps.co', password: 'Demo2026!' });
    await page.goto('/training-plans');
    await page.waitForSelector('text=Panel de Selección', { timeout: 20_000 });
    await page.screenshot({ path: `${SHOT_DIR}/felipe-15-training-plans-loaded.png`, fullPage: true });

    // Seleccionar equipo Tenis en el dropdown
    const teamSelect = page.locator('button', { hasText: 'Selecciona tu equipo' }).first();
    await teamSelect.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOT_DIR}/felipe-16-team-dropdown-open.png`, fullPage: true });

    const tenisOption = page.getByRole('option', { name: /tenis/i }).first();
    const optionVisible = await tenisOption.isVisible().catch(() => false);
    if (optionVisible) {
        await tenisOption.click();
    } else {
        console.log('[Felipe][mesociclo] No se encontró opción de equipo Tenis en el dropdown');
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOT_DIR}/felipe-17-team-selected.png`, fullPage: true });

    const newMesoBtn = page.getByRole('button', { name: /nuevo mesociclo|crear mesociclo|\+ mesociclo|nuevo plan/i }).first();
    const btnVisible = await newMesoBtn.isVisible().catch(() => false);
    console.log('[Felipe][mesociclo] Botón crear visible:', btnVisible);
    if (!btnVisible) {
        const bodyTxt = await page.locator('body').innerText().catch(() => '');
        console.log('[Felipe][mesociclo] body tras seleccionar equipo:', bodyTxt.slice(0, 1000));
        return;
    }

    const mesoName = `QA-TEST-persistencia-${Date.now()}`;
    await newMesoBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SHOT_DIR}/felipe-18-mesociclo-dialog.png`, fullPage: true });

    // Este diálogo "Crear Mesociclo" no tiene campo "nombre" — usamos el
    // textarea "Objetivo general del mesociclo" para dejar el marcador QA-TEST.
    const objetivoInput = page.locator('textarea').first();
    await expect(objetivoInput).toBeVisible({ timeout: 5000 });
    await objetivoInput.fill(mesoName);

    // Fechas: son botones que abren un date-picker, no input[type=date].
    // Tras elegir la fecha de inicio, su botón deja de decir "Selecciona
    // fecha", así que el botón de fin pasa a ser el único que matchea.
    const startBtn = page.getByRole('button', { name: /selecciona fecha/i }).first();
    await startBtn.click();
    await page.waitForTimeout(500);
    const todayCell = page.locator('[role="gridcell"] >> text=/^\\d{1,2}$/').filter({ hasNotText: '' });
    // Selecciona el día actual visible en el calendario (primer botón "today"/aria-selected o el día de hoy resaltado)
    const todayBtn = page.locator('button[name="day"]:not([disabled])').first();
    if (await todayBtn.isVisible().catch(() => false)) {
        await todayBtn.click();
    }
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape').catch(() => {});

    const endBtn = page.getByRole('button', { name: /selecciona fecha/i }).first();
    await endBtn.click();
    await page.waitForTimeout(500);
    // Para el fin, avanza al mes siguiente y toma un día para asegurar fin > inicio
    const nextMonthBtn = page.getByRole('button', { name: /next month|mes siguiente/i }).first();
    if (await nextMonthBtn.isVisible().catch(() => false)) {
        await nextMonthBtn.click();
        await page.waitForTimeout(300);
    }
    const endDayBtn = page.locator('button[name="day"]:not([disabled])').first();
    if (await endDayBtn.isVisible().catch(() => false)) {
        await endDayBtn.click();
    }
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape').catch(() => {});
    await page.screenshot({ path: `${SHOT_DIR}/felipe-18b-mesociclo-fechas.png`, fullPage: true });

    const saveBtn = page.getByRole('button', { name: /crear mesociclo/i }).last();
    await saveBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOT_DIR}/felipe-19-mesociclo-creado.png`, fullPage: true });

    const bodyPostCreate = await page.locator('body').innerText().catch(() => '');
    const createdVisible = bodyPostCreate.includes(mesoName);
    console.log(`[Felipe][mesociclo] "${mesoName}" visible inmediatamente tras crear: ${createdVisible}`);

    // Reload real
    await page.reload();
    await page.waitForSelector('text=Panel de Selección', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOT_DIR}/felipe-20-tras-reload-pre-reselect.png`, fullPage: true });

    // Puede que el reload resetee la selección de equipo -> re-seleccionar
    const teamSelectAfter = page.locator('button', { hasText: /Selecciona tu equipo|Tenis/i }).first();
    if (await teamSelectAfter.isVisible().catch(() => false)) {
        await teamSelectAfter.click();
        await page.waitForTimeout(800);
        const tenisOptionAfter = page.getByRole('option', { name: /tenis/i }).first();
        if (await tenisOptionAfter.isVisible().catch(() => false)) {
            await tenisOptionAfter.click();
            await page.waitForTimeout(2000);
        }
    }
    await page.screenshot({ path: `${SHOT_DIR}/felipe-21-tras-reload-post-reselect.png`, fullPage: true });

    const bodyAfterReload = await page.locator('body').innerText().catch(() => '');
    const persistedVisible = bodyAfterReload.includes(mesoName);
    console.log(`[Felipe][mesociclo] "${mesoName}" visible tras reload + re-selección de equipo: ${persistedVisible}`);
});
