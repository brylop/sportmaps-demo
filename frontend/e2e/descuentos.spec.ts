// frontend/e2e/descuentos.spec.ts
//
// E2E de docs/specs/descuentos-hermanos-primos-referidos.md.
//
// Cubre lo que se puede validar desde el navegador sin correr open_month de
// verdad (el cálculo del % de hermanos ya se probó con preview_open_month
// contra Club Campestre Demo al construir F1 — ver la conversación del
// módulo, no hace falta repetirlo acá):
//   1. El admin prende/apaga el descuento por hermanos en Ajustes > Config
//      y el % persiste tras recargar.
//   2. El admin marca "Primos" en el modal de atleta (badge en la lista) y
//      lo reemplaza por "Referido" — uno solo a la vez.
//   3. El padre ve "Incluye descuento por hermanos: $20.000" en Mis Pagos
//      para un cobro que ya lo trae poblado (payments.sibling_discount_applied).
//
// Pre-requisito: supabase/seed/descuentos_test_users.sql aplicado (Escuela
// Demo SportMaps, is_demo=true) — ver ese archivo para el detalle de qué crea.

import { test, expect, type Locator } from '@playwright/test';
import { loginAs, type TestUser } from './helpers/auth';

const ADMIN: TestUser = {
    email: process.env.PLAYWRIGHT_DESCUENTOS_ADMIN_EMAIL || 'qa-descuentos-admin@sportmaps.test',
    password: process.env.PLAYWRIGHT_DESCUENTOS_ADMIN_PASSWORD || 'TestPass123!',
};
const PARENT: TestUser = {
    email: process.env.PLAYWRIGHT_DESCUENTOS_PARENT_EMAIL || 'qa-descuentos-parent@sportmaps.test',
    password: process.env.PLAYWRIGHT_DESCUENTOS_PARENT_PASSWORD || 'TestPass123!',
};

test.describe('Descuentos — hermanos, primos y referidos', () => {
    test('el admin prende el descuento por hermanos y el % persiste', async ({ page }) => {
        await loginAs(page, ADMIN);
        await page.goto('/payments-automation');

        await page.getByRole('tab', { name: 'Config' }).click();

        const toggleRow = page.getByTestId('sibling-discount-toggle-row');
        const siblingSwitch = toggleRow.getByRole('switch');
        await expect(siblingSwitch).toBeVisible({ timeout: 15_000 });

        const wasChecked = (await siblingSwitch.getAttribute('aria-checked')) === 'true';
        if (!wasChecked) {
            await siblingSwitch.click();
        }

        const pctBlock = page.getByTestId('sibling-discount-percentage-block');
        await expect(pctBlock).toBeVisible();
        const pctInput = pctBlock.locator('input');
        await pctInput.fill('15');

        await page.getByRole('button', { name: 'Guardar Cambios' }).click();
        // getByText matchea también el <span role="status"> del anuncio para
        // lectores de pantalla del toast (mismo texto, dos nodos) — .first() alcanza.
        await expect(page.getByText('✅ Configuración de pagos guardada').first()).toBeVisible({ timeout: 10_000 });

        await page.reload();
        await page.getByRole('tab', { name: 'Config' }).click();
        await expect(page.getByTestId('sibling-discount-percentage-block').locator('input')).toHaveValue('15', { timeout: 10_000 });

        // Deja el toggle como lo encontró (la mayoría de escuelas lo tiene
        // apagado) para no dejar la escuela demo con el descuento activo.
        if (!wasChecked) {
            await page.getByTestId('sibling-discount-toggle-row').getByRole('switch').click();
            await page.getByRole('button', { name: 'Guardar Cambios' }).click();
            await expect(page.getByText('✅ Configuración de pagos guardada').first()).toBeVisible({ timeout: 10_000 });
        }
    });

    test('el admin marca "Primos" y luego lo reemplaza por "Referido" en el modal de atleta', async ({ page }) => {
        // Hace hasta 3 reloads completos (uno por guardado, para leer el
        // estado ya persistido sin depender del timing del refetch de
        // react-query) — el timeout default de 30s no alcanza.
        test.setTimeout(90_000);
        // Layout móvil: usa el dropdown de acciones con texto "Editar" en vez
        // del ícono sin label del layout de escritorio.
        await page.setViewportSize({ width: 390, height: 844 });
        await loginAs(page, ADMIN);
        await page.goto('/students');

        // El viewport móvil oculta la tabla de escritorio con CSS (`lg:block`),
        // no la desmonta: getByText igual la ve y viola el modo estricto (2
        // matches, uno por layout). Se acota a la lista móvil (`lg:hidden`).
        const mobileList = page.locator('div.lg\\:hidden');
        const openEditModal = async () => {
            await page.getByRole('button', { name: /Más acciones para QA Descuento Primos Hijo/ }).click();
            await page.getByRole('menuitem', { name: 'Editar' }).click();
            const dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible();
            return dialog;
        };
        const saveAndClose = async (dialog: Locator) => {
            await dialog.getByRole('button', { name: 'Guardar Cambios' }).click();
            await expect(page.getByText('✅ Atleta actualizado').first()).toBeVisible({ timeout: 10_000 });
            await expect(dialog).toBeHidden({ timeout: 10_000 });
            // La lista se invalida via react-query, pero reabrir el modal
            // inmediatamente después puede leer el student todavía sin
            // refetchear (carrera observada en corridas reales) — un reload
            // fuerza a leer el estado ya persistido antes de la siguiente acción.
            await page.reload();
            await expect(mobileList.getByText('QA Descuento Primos Hijo')).toBeVisible({ timeout: 15_000 });
        };

        await expect(mobileList.getByText('QA Descuento Primos Hijo')).toBeVisible({ timeout: 15_000 });

        // Corridas anteriores pueden haber dejado el atleta con un tipo ya
        // marcado (el test es idempotente: siempre arranca desde "sin becado").
        let dialog = await openEditModal();
        const becadoCheckbox = dialog.locator('#fee_is_manual');
        if (await becadoCheckbox.isChecked()) {
            await becadoCheckbox.click();
            await saveAndClose(dialog);
            dialog = await openEditModal();
        }

        // Marca "Becado" + tipo "Primos".
        await becadoCheckbox.click();
        await expect(dialog.getByText('Tipo (opcional')).toBeVisible();
        await dialog.getByRole('button', { name: /Primos \/ familia extendida/ }).click();
        await saveAndClose(dialog);

        await expect(mobileList.getByText('👨‍👩‍👧 Primos')).toBeVisible({ timeout: 10_000 });

        // Reabre y reemplaza por "Referido" — uno solo a la vez.
        dialog = await openEditModal();
        await expect(dialog.getByRole('button', { name: /Quitar Primos/ })).toBeVisible();
        await dialog.getByRole('button', { name: '🤝 Referido' }).click();
        await saveAndClose(dialog);

        await expect(mobileList.getByText('🤝 Referido')).toBeVisible({ timeout: 10_000 });

        // Deja el atleta como lo encontró (sin becado) para que la corrida
        // siguiente arranque del mismo estado.
        dialog = await openEditModal();
        await dialog.locator('#fee_is_manual').click();
        await saveAndClose(dialog);
    });

    test('el padre ve el descuento por hermanos en el detalle del cobro', async ({ page }) => {
        await loginAs(page, PARENT);
        await page.goto('/my-payments');

        await expect(page.getByText('QA Descuento Hermano Uno').first()).toBeVisible({ timeout: 15_000 });
        // Intl.NumberFormat('es-CO') pone un espacio entre el símbolo y el monto: "$ 20.000".
        await expect(page.getByText(/Incluye descuento por hermanos: \$\s?20[.,]?000/)).toBeVisible();
    });
});
