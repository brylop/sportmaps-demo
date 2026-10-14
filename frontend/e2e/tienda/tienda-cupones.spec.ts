// Tienda v2 F3b — cupones por tienda (mig. 20261013170543), de punta a punta:
//   1. La escuela (admin.a, no dueño) crea un código del 10 % en «Tu tienda → Cupones».
//   2. Un padre lo escribe en el checkout: ve el descuento y el total que cobra
//      la BASE (quote_cart), paga por transferencia y ve el descuento en su pedido.
//   3. La escuela ve el uso del código y el descuento en el detalle del pedido.
//   4. Un código vencido → mensaje claro y el botón de pagar se apaga.
//
// Corre SOLO contra el gemelo local (docs/qa-gemelo-local.md), con la migración
// 20261013170543 aplicada encima y un BFF del gemelo (crear/listar cupones y
// crear la orden van por el BFF):
//
//   npm run qa:twin:up                                    (raíz)
//   BFF local con las variables del gemelo en un puerto propio (p. ej. 3207)
//   cd frontend && QA_TWIN_BFF_URL=http://127.0.0.1:3207 \
//     npx playwright test -c playwright.gemelo.config.ts tienda/tienda-cupones --workers=1
//
// Escribe en el gemelo (cupones con código único por corrida, una orden).
// Capturas: docs/capturas/tienda-v2-checkout/.
import { test, expect, type Page } from '@playwright/test';
import { TIENDA, assertBffEsGemelo, captura, contextoComo, prepararTiendaGemelo, sqlGemelo } from './gemelo';

test.describe.configure({ mode: 'serial' });
test.setTimeout(420_000); // gemelo + Vite en frío en una máquina compartida

// Código único por corrida: el gemelo guarda las corridas anteriores y el código es único por tienda.
const SUFIJO = Date.now().toString(36).toUpperCase().slice(-6);
const CODIGO = `SOCIOS${SUFIJO}`;
const VENCIDO = `VENCIDO${SUFIJO}`;

test.beforeAll(async () => {
    prepararTiendaGemelo();
    await assertBffEsGemelo();
    // El vencido se siembra directo (la pantalla no deja crear un cupón ya vencido).
    sqlGemelo(`
        insert into public.store_coupons (vendor_profile_id, code, kind, value, starts_at, ends_at, max_per_buyer)
        values ('${TIENDA.vendorProfileId}', '${VENCIDO}', 'percent', 15, now() - interval '10 days', now() - interval '1 day', 1);
        -- Sin restos de intentos fallidos de corridas anteriores (límite anti fuerza bruta).
        delete from public.store_coupon_attempts
         where buyer_id = (select user_id from qa_twin.actores where alias = 'padre.a');
    `);
});

function card(page: Page, nombre: string) {
    return page.locator(`[data-testid="store-product-card"][data-product-name="${nombre}"]`);
}

async function alCheckoutConTermo(page: Page) {
    await page.goto(`/tienda/${TIENDA.slug}`);
    const termo = card(page, TIENDA.termo);
    await expect(termo).toBeVisible({ timeout: 30_000 });
    await termo.getByRole('button', { name: `Agregar ${TIENDA.termo}` }).click();
    await page.getByTestId('cart-bar').click();
    const pagar = page.getByRole('button', { name: `Pagar en ${TIENDA.nombre}` });
    await expect(pagar).toBeEnabled({ timeout: 20_000 });
    await pagar.click();
    await expect(page).toHaveURL(new RegExp(`/checkout/tienda/${TIENDA.vendorProfileId}`));
    // Termo 38.000 sin código.
    await expect(page.getByTestId('checkout-total')).toHaveText(/38\.000/, { timeout: 20_000 });
}

async function aplicarCodigo(page: Page, codigo: string) {
    await page.getByTestId('coupon-toggle').click();
    await page.locator('#coupon').fill(codigo.toLowerCase()); // el comprador lo escribe como sea
    await page.getByTestId('coupon-apply').click();
}

test('la escuela crea un código del 10 %, el padre lo aplica, ve y paga el total con descuento', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop-chrome', 'escenario de escritorio');

    // 1. La escuela crea el código.
    const adminCtx = await contextoComo(browser, 'admin.a');
    const admin = await adminCtx.newPage();
    await admin.goto('/tienda-escuela/cupones');
    await expect(admin.getByRole('heading', { name: 'Cupones de descuento' })).toBeVisible({ timeout: 90_000 }); // Vite en frío
    await admin.getByTestId('coupon-new').click();
    await admin.locator('#c-code').fill(CODIGO);
    await admin.locator('#c-desc').fill('Para los socios del club');
    await expect(admin.locator('#c-value')).toHaveValue('10');
    await captura(admin, 'c01-escuela-nuevo-cupon');
    await admin.getByTestId('coupon-save').click();
    const fila = admin.locator(`[data-testid="coupon-row"][data-code="${CODIGO}"]`);
    await expect(fila).toBeVisible({ timeout: 20_000 });
    await expect(fila.getByTestId('coupon-state')).toHaveText('Activo');
    await expect(fila).toContainText('10 %');
    await expect(fila.getByTestId('coupon-usage')).toContainText('0 usos');
    await captura(admin, 'c02-escuela-lista-cupones', true);

    // 2. El padre lo aplica en el checkout.
    const padreCtx = await contextoComo(browser, 'padre.a');
    const padre = await padreCtx.newPage();
    await alCheckoutConTermo(padre);
    await aplicarCodigo(padre, CODIGO);
    await expect(padre.getByTestId('coupon-applied')).toContainText(CODIGO, { timeout: 20_000 });
    await expect(padre.getByTestId('checkout-discount')).toContainText('3.800');
    await expect(padre.getByTestId('checkout-total')).toHaveText(/34\.200/);
    await expect(padre.locator('[data-testid="pay-button"]:visible')).toContainText('34.200');
    await captura(padre, 'c03-checkout-con-codigo', true);

    await padre.getByRole('radio', { name: /Transferencia bancaria/ }).click();
    await padre.locator('[data-testid="pay-button"]:visible').click();
    await expect(padre).toHaveURL(/\/mis-compras\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(padre.getByTestId('order-discount')).toContainText(CODIGO, { timeout: 30_000 });
    await expect(padre.getByTestId('order-discount')).toContainText('3.800');
    await expect(padre.getByTestId('order-total')).toHaveText(/34\.200/);
    const referencia = (await padre.getByRole('heading', { level: 1 }).innerText()).trim();
    await captura(padre, 'c04-pedido-con-descuento', true);

    // La base cobró lo mismo que mostró la pantalla (nunca el cliente).
    const enBase = sqlGemelo(`select subtotal::int || '|' || discount_total::int || '|' || total_amount::int || '|' || coupon_code
                                from public.orders where reference = '${referencia}';`).trim();
    expect(enBase).toBe(`38000|3800|34200|${CODIGO}`);

    // 3. La escuela ve el uso y el descuento en el pedido.
    await admin.goto('/tienda-escuela/cupones');
    await expect(fila.getByTestId('coupon-usage')).toContainText('1 uso', { timeout: 20_000 });
    await fila.getByRole('button', { name: `Ver usos de ${CODIGO}` }).click();
    await expect(admin.getByTestId('coupon-uses')).toContainText(referencia);
    await expect(admin.getByTestId('coupon-uses')).toContainText('Pedido sin pagar');
    await captura(admin, 'c05-escuela-usos-del-codigo');
    await admin.keyboard.press('Escape');

    await admin.goto('/orders');
    const pedido = admin.locator(`[data-testid="seller-order-row"][data-ref="${referencia}"]`);
    await expect(pedido).toBeVisible({ timeout: 30_000 });
    await pedido.getByRole('button', { name: `Ver pedido ${referencia}` }).click();
    await expect(admin.getByTestId('detail-discount')).toContainText(CODIGO);
    await expect(admin.getByTestId('detail-discount')).toContainText('3.800');
    await captura(admin, 'c06-escuela-pedido-con-descuento');

    await Promise.all([adminCtx.close(), padreCtx.close()]);
});

test('código vencido → mensaje claro y no deja pagar hasta quitarlo', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop-chrome', 'escenario de escritorio');
    const ctx = await contextoComo(browser, 'padre.a');
    const page = await ctx.newPage();
    await alCheckoutConTermo(page);
    await aplicarCodigo(page, VENCIDO);
    await expect(page.getByTestId('coupon-error')).toContainText('Ese código ya venció.', { timeout: 20_000 });
    await expect(page.getByTestId('checkout-discount')).toHaveCount(0);
    await expect(page.getByTestId('checkout-total')).toHaveText(/38\.000/);
    await expect(page.locator('[data-testid="pay-button"]:visible')).toBeDisabled();
    await captura(page, 'c07-codigo-vencido', true);

    // Quitar el código vuelve a dejar pagar el precio lleno.
    await page.getByTestId('coupon-error').getByRole('button', { name: 'Quitar' }).click();
    await expect(page.getByTestId('coupon-error')).toHaveCount(0);
    await page.getByRole('radio', { name: /Transferencia bancaria/ }).click();
    await expect(page.locator('[data-testid="pay-button"]:visible')).toBeEnabled({ timeout: 20_000 });
    await ctx.close();
});
