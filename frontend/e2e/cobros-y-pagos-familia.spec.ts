// frontend/e2e/cobros-y-pagos-familia.spec.ts
//
// «Cobros y pagos» desde fuera de la administración (docs/specs/cobros-multiples.md §14):
//   T28 — el coach no ve el modal ni la pestaña «Operaciones».
//   T21 — el acudiente ve su cobro con descuento («antes $X · Pronto pago») y no ve quién.
// Solo Club Campestre Demo; se salta sin credenciales o si guard-no-prod ve produccion.

import { test, expect } from '@playwright/test';
import { COACH, PARENT, openAsCampestre, skipUnlessReady } from './helpers/cobros-y-pagos';

test.describe('Cobros y pagos — coach (T28)', () => {
    test.beforeEach(async ({ page }) => {
        skipUnlessReady(COACH, 'COACH');
        await openAsCampestre(page, COACH!);
    });

    test('en Deportistas no aparece «Cobros y pagos» ni «Registrar pago»', async ({ page }) => {
        await page.goto('/students');
        const more = page.getByRole('button', { name: /^Más acciones para / }).first();
        await expect(more).toBeVisible({ timeout: 15_000 });
        await more.click();
        await expect(page.getByRole('menuitem', { name: /Cobros y pagos|Registrar pago/ })).toHaveCount(0);
    });

    test('en Pagos no hay botón ni pestaña «Operaciones»', async ({ page }) => {
        await page.goto('/payments-automation');
        await expect(page.getByTestId('open-register-payment')).toHaveCount(0);
        await expect(page.getByRole('tab', { name: 'Operaciones' })).toHaveCount(0);
        await expect(page.getByTestId('cobros-y-pagos-modal')).toHaveCount(0);
    });
});

test.describe('Cobros y pagos — acudiente (T21)', () => {
    test.beforeEach(async ({ page }) => {
        skipUnlessReady(PARENT, 'PARENT');
        await openAsCampestre(page, PARENT!);
    });

    // Depende de F1 (payment_adjustments + vista para la familia) y de los rótulos
    // de MyPaymentsPage (I30), que llegan con el backend desplegado.
    test.fixme('ve «antes $X · Pronto pago» en su cobro con descuento y no ve quién lo aplicó', async ({ page }) => {
        await page.goto('/my-payments');
        await expect(page.getByText(/antes \$[\d.]+ · Pronto pago/)).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText(/qa-cobros-admin/)).toHaveCount(0);
    });
});
