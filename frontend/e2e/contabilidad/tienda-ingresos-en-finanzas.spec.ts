// Ventas de la tienda en los ingresos de la escuela (migración 20261013170548,
// docs/specs/tienda-cambio-gestion-a-tienda.md §4.1). El owner de QA Academia
// Andes tiene una venta de tienda COBRADA este mes y la ve:
//   · en el inicio: «Mensualidades $ 0 · Tienda $ 37.000» bajo «Ingresos del Mes»;
//   · en Contabilidad: el indicador de Ingresos con el mismo desglose;
//   · en el estado de resultados: la línea «Ventas de tienda» por mes.
//
// Corre SOLO contra el gemelo local (docs/qa-gemelo-local.md), con la migración
// 20261013170548 aplicada encima:
//
//   npm run qa:twin:up                                    (raíz)
//   cd frontend && npx playwright test -c playwright.gemelo.config.ts contabilidad/tienda-ingresos-en-finanzas --workers=1
//
// No necesita BFF para las lecturas de ingresos (RPC con el JWT). La venta se
// siembra en el gemelo con SQL (la tienda no se escribe desde el cliente) y se
// borra al final.
import { test, expect } from '@playwright/test';
import { contextoComo, prepararTiendaGemelo, sqlGemelo, TIENDA } from '../tienda/gemelo';

test.describe.configure({ mode: 'serial' });
test.setTimeout(420_000);  // Vite del gemelo compila cada ruta perezosa en frío

const ORDEN = '00000000-0000-4000-c000-0000000e2e13';
const MONTO = 37000;
/** formatCurrency es-CO: «$ 37.000» (con espacio duro entre el signo y el número). */
const TIENDA_37 = /Tienda\s*\$\s*37\.000/;

function sembrarVenta(): void {
    prepararTiendaGemelo();
    const out = sqlGemelo(`
        insert into public.orders (id, user_id, total_amount, status, vendor_profile_id, vendor_id, school_id,
                                   payment_method, provider_transaction_id, paid_at, reference)
        values ('${ORDEN}', '00000000-0000-4000-a000-000000000004', ${MONTO}, 'paid',
                '${TIENDA.vendorProfileId}', '00000000-0000-4000-a000-000000000001', '${TIENDA.escuelaA}',
                'wompi', 'tx-e2e-ingresos', now(), 'E2E-ING-TIENDA')
        on conflict (id) do update set status = 'paid', paid_at = now(), total_amount = ${MONTO};
        select 'venta-ok|' || (select count(*) from public.store_income_lines('${TIENDA.escuelaA}',
                 (now() at time zone 'America/Bogota')::date, (now() at time zone 'America/Bogota')::date)
                 where order_id = '${ORDEN}');
    `);
    if (!out.includes('venta-ok|1')) {
        throw new Error(`No se pudo sembrar la venta (¿falta la migración 20261013170548 en el gemelo?):\n${out}`);
    }
}

test.beforeAll(() => sembrarVenta());
test.afterAll(() => {
    sqlGemelo(`delete from public.orders where id = '${ORDEN}';`);
});

test('el owner ve las ventas de la tienda en el inicio, Contabilidad y el estado de resultados', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop-chrome', 'escenario de escritorio');
    const ctx = await contextoComo(browser, 'owner.a');
    const page = await ctx.newPage();

    // 1. Inicio: indicador de ingresos del mes con desglose.
    await page.goto('/dashboard');
    await expect(page.getByText(TIENDA_37).first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/Mensualidades\s*\$\s*[\d.]+\s*·\s*Tienda/).first()).toBeVisible();
    await page.screenshot({ path: info.outputPath('01-inicio-ingresos.png') });

    // 2. Contabilidad (mes en curso): Ingresos = cobros del mes + tienda, con desglose.
    await page.goto('/accounting');
    const desglose = page.getByTestId('accounting-income-breakdown');
    await expect(desglose).toBeVisible({ timeout: 120_000 });
    await expect(desglose).toContainText(TIENDA_37);
    await expect(page.getByTestId('accounting-income-total')).toContainText(/\$\s*[\d.]+/);
    await page.screenshot({ path: info.outputPath('02-contabilidad-ingresos.png') });

    // 3. Estado de resultados: línea «Ventas de tienda» con la venta en el mes.
    await page.goto('/accounting/reports');
    const fila = page.getByTestId('pnl-row-tienda');
    await expect(fila).toBeVisible({ timeout: 120_000 });
    await expect(fila).toContainText('Ventas de tienda');
    await expect(fila).toContainText(/\$\s*37\.000/);
    await expect(page.getByTestId('pnl-income-breakdown')).toContainText(TIENDA_37);
    await page.screenshot({ path: info.outputPath('03-estado-resultados.png'), fullPage: true });

    await ctx.close();
});

test('una escuela SIN tienda ve el indicador igual que antes (sin desglose)', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop-chrome', 'escenario de escritorio');
    // Sin tienda escolar verificada ni ventas, la escuela B no muestra «Tienda».
    const r = sqlGemelo(`select public.store_income_has_store('00000000-0000-4000-b000-000000000002');`).trim();
    expect(r).toBe('f');
    const ctx = await contextoComo(browser, 'owner.a');
    const page = await ctx.newPage();
    // Apagar la tienda de A solo para esta prueba: sin ventas y no verificada → sin desglose.
    sqlGemelo(`delete from public.orders where id = '${ORDEN}';
               update public.vendor_profiles set verification_status = 'pending' where id = '${TIENDA.vendorProfileId}';`);
    try {
        await page.goto('/dashboard');
        await expect(page.getByText('Cobrado este mes').first()).toBeVisible({ timeout: 120_000 });
        await expect(page.getByText(/Mensualidades\s*\$.*·\s*Tienda/)).toHaveCount(0);
    } finally {
        sembrarVenta();   // deja la tienda verificada y la venta como la espera el resto
        await ctx.close();
    }
});
