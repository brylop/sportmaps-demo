// frontend/e2e/cobros-y-pagos.spec.ts
//
// E2E de «Cobros y pagos» (docs/specs/cobros-multiples.md F3, §10 y §14).
// Solo Club Campestre Demo; se salta sin credenciales o si guard-no-prod ve
// produccion. Sin PLAYWRIGHT_COBROS_WRITE=1 no confirma nada: llega a la vista
// previa (que no escribe) y cancela.
//
// Variables:
//   PLAYWRIGHT_SUPABASE_URL / PLAYWRIGHT_SUPABASE_ANON_KEY
//   PLAYWRIGHT_COBROS_ADMIN_EMAIL / _PASSWORD      (qa-cobros-admin, admin de Campestre)
//   PLAYWRIGHT_COBROS_ATHLETE_NAME                 (default «QA Cobros Hijo»)
//   PLAYWRIGHT_COBROS_TEAM_NAME                    (equipo de Campestre para modo varios)
//   PLAYWRIGHT_COBROS_WRITE=1                      (confirma y luego anula el lote)

import { test, expect, type Page } from '@playwright/test';
import { ADMIN, ATHLETE_NAME, TEAM_NAME, WRITE, openAsCampestre, skipUnlessReady } from './helpers/cobros-y-pagos';

async function openModal(page: Page) {
    await page.goto('/payments-automation');
    await page.getByTestId('open-register-payment').click();
    const modal = page.getByTestId('cobros-y-pagos-modal');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    return modal;
}

async function pickAthlete(page: Page) {
    await page.getByTestId('cyp-athlete-picker').click();
    await page.getByLabel('Buscar atleta').fill(ATHLETE_NAME);
    await page.getByRole('option', { name: new RegExp(ATHLETE_NAME) }).first().click();
}

test.describe('Cobros y pagos — administración (Campestre)', () => {
    test.beforeEach(async ({ page }) => {
        skipUnlessReady(ADMIN, 'ADMIN');
        await openAsCampestre(page, ADMIN!);
    });

    test('T19/T1 — un atleta: pendientes, línea nueva y texto del botón', async ({ page }) => {
        const modal = await openModal(page);
        await expect(modal.getByRole('heading', { name: 'Cobros y pagos' })).toBeVisible();
        await pickAthlete(page);
        await expect(modal.getByTestId('cyp-pending').or(modal.getByText('No tiene cobros pendientes.'))).toBeVisible({ timeout: 15_000 });

        // Sin nada marcado no se puede confirmar, con el motivo debajo
        for (const box of await modal.getByRole('checkbox', { name: /^Incluir / }).all()) {
            if (await box.isChecked()) await box.click();
        }
        await expect(page.getByTestId('cyp-primary')).toBeDisabled();
        await expect(page.getByTestId('cyp-button-reason')).toBeVisible();

        // Torneo nuevo con «Ya lo pagaron» → «Generar 1 · Pagar 1»
        await page.getByTestId('cyp-add-line').click();
        const line = page.getByTestId('cyp-line-0');
        await line.getByLabel('Detalle del cobro').fill('QA Copa Pony 2026');
        await line.getByLabel('Valor', { exact: true }).fill('80000');
        await expect(page.getByTestId('cyp-primary')).toHaveText(/Generar 1 · Pagar 1/, { timeout: 10_000 });

        // Sin «Ya lo pagaron» → «Generar 1»
        await page.getByRole('switch', { name: 'Ya lo pagaron' }).click();
        await expect(page.getByTestId('cyp-primary')).toHaveText(/^Generar 1$/);

        // Espera la vista previa del servidor (no escribe)
        await expect(page.getByTestId('cyp-preview')).toContainText(/Se crea 1 cobro/, { timeout: 20_000 });
        await expect(page.getByTestId('cyp-primary')).toBeEnabled({ timeout: 20_000 });

        if (!WRITE) {
            await page.getByRole('button', { name: 'Cancelar' }).click();
            return;
        }
        await page.getByTestId('cyp-primary').click();
        await expect(page.getByTestId('cyp-result')).toContainText('1 cobro creado', { timeout: 20_000 });
        // Deja Campestre como estaba: anula el lote recién creado (Q12)
        await page.getByRole('button', { name: 'Anular lote' }).click();
        await page.getByLabel('Motivo *').fill('Prueba automática E2E');
        await page.getByRole('button', { name: /^Anular 1$/ }).click();
        await expect(page.getByText('Lote anulado').first()).toBeVisible({ timeout: 15_000 });
    });

    test('T30 — descuento de más del 50 %: aviso amarillo, no bloquea', async ({ page }) => {
        const modal = await openModal(page);
        await pickAthlete(page);
        await page.getByTestId('cyp-add-line').click();
        const line = page.getByTestId('cyp-line-0');
        await line.getByLabel('Detalle del cobro').fill('QA Torneo con beca');
        await line.getByLabel('Valor', { exact: true }).fill('100000');
        await line.getByRole('button', { name: 'Descuento' }).click();
        await line.getByLabel('Valor del descuento').fill('55');
        await line.getByLabel('Motivo del descuento').click();
        await page.getByRole('option', { name: 'Beca' }).click();
        await expect(line.getByText(/Descuento total 55 %: revisa/)).toBeVisible();
        await expect(line.getByText('Beca −55 %')).toBeVisible();
        await expect(modal.getByRole('alert')).toHaveCount(0);
        await page.getByRole('button', { name: 'Cancelar' }).click();
    });

    test('T27 — varios atletas: solo genera y exige vista previa', async ({ page }) => {
        test.skip(!TEAM_NAME, 'Falta PLAYWRIGHT_COBROS_TEAM_NAME (equipo de Campestre)');
        const modal = await openModal(page);
        await page.getByTestId('cyp-mode-multi').click();
        await expect(modal.getByTestId('cyp-payment-block')).toHaveCount(0);
        await page.getByLabel('Grupo').click();
        await page.getByRole('option', { name: TEAM_NAME }).click();
        const line = page.getByTestId('cyp-line-0');
        await line.getByLabel('Detalle del cobro').fill(`QA Copa Pony — ${TEAM_NAME}`);
        await line.getByLabel('Valor', { exact: true }).fill('80000');
        await line.getByRole('button', { name: 'Descuento' }).click();
        await line.getByLabel('Valor del descuento').fill('10');
        await line.getByLabel('Motivo del descuento').click();
        await page.getByRole('option', { name: 'Convenio' }).click();
        await expect(line.getByText(/Neto \$72\.000 por atleta/)).toBeVisible();
        await expect(page.getByTestId('cyp-preview')).toContainText(/Se van a crear \d+ cobros/, { timeout: 20_000 });
        await expect(page.getByTestId('cyp-primary')).toHaveText(/^Generar \d+$/);
        if (!WRITE) {
            await page.getByRole('button', { name: 'Cancelar' }).click();
            return;
        }
        await page.getByTestId('cyp-primary').click();
        await expect(page.getByTestId('cyp-result')).toBeVisible({ timeout: 30_000 });
        await page.getByRole('button', { name: 'Anular lote' }).click();
        await page.getByLabel('Motivo *').fill('Prueba automática E2E');
        await page.getByRole('button', { name: /^Anular \d+$/ }).click();
        await expect(page.getByText('Lote anulado').first()).toBeVisible({ timeout: 15_000 });
    });

    test('pestaña «Operaciones» visible para la administración', async ({ page }) => {
        await page.goto('/payments-automation?tab=operaciones');
        await expect(page.getByTestId('operaciones-tab')).toBeVisible({ timeout: 15_000 });
    });

    test('celular: el botón principal queda fijo abajo y visible', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openModal(page);
        await pickAthlete(page);
        const btn = page.getByTestId('cyp-primary');
        await expect(btn).toBeInViewport();
        await page.getByTestId('cyp-add-line').click();
        await expect(btn).toBeInViewport();
        await page.getByRole('button', { name: 'Cancelar' }).click();
    });
});
