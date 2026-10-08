// Tienda — lado COMPRADOR para un socio adulto (primer cliente: GYM RM; compra
// un socio del gimnasio, no un acudiente). Corre SOLO contra el gemelo local
// (docs/qa-gemelo-local.md), en escritorio y en Pixel 7:
//
//   npm run qa:twin:up                                       (raíz)
//   BFF local con las variables del gemelo en un puerto propio (p. ej. 3197)
//   cd frontend && QA_TWIN_BFF_URL=http://127.0.0.1:3197 \
//     npx playwright test -c playwright.gemelo.config.ts tienda/tienda-socio-solo-retiro --workers=1
//
// Cubre:
//   1. Tienda «solo retiro en sede» (store_payment_settings.allow_shipping = false,
//      mig. 20261008163336): el checkout NO ofrece envío a domicilio.
//   2. Vitrina: el nombre de la tienda no queda tapado por la portada.
//   3. "¡Pedido creado!" solo al llegar del checkout: ni al recargar ni pagado.
//   4. Código de retiro regenerable (mig. 20261008163338) desde OTRO navegador;
//      el del primer navegador queda marcado como reemplazado.
//   5. Un 429 al leer el pedido dice "Demasiadas solicitudes…", no "Pedido no encontrado".
//   6. Copy neutral: el socio adulto no lee "hijo".
//
// Escribe en el gemelo (un pedido por dispositivo). La tienda vuelve a su
// configuración de entrega al terminar.
import { test, expect, type Page } from '@playwright/test';
import { TIENDA, assertBffEsGemelo, contextoComo, prepararTiendaGemelo, sqlGemelo, COMPROBANTE_PNG } from './gemelo';

test.describe.configure({ mode: 'serial' });
test.setTimeout(150_000);

let envioOriginal: string | null = null;

test.beforeAll(async () => {
    prepararTiendaGemelo();
    await assertBffEsGemelo();
    const col = sqlGemelo(`select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'store_payment_settings' and column_name = 'allow_shipping';`).trim();
    test.skip(col !== '1', 'El gemelo no tiene store_payment_settings.allow_shipping (mig. 20261008163336 sin aplicar).');
    envioOriginal = sqlGemelo(`select allow_shipping from public.store_payment_settings where vendor_profile_id = '${TIENDA.vendorProfileId}';`).trim();
});

test.beforeEach(() => {
    prepararTiendaGemelo();
    // «Solo retiro en sede» (como GYM RM).
    sqlGemelo(`update public.store_payment_settings set allow_shipping = false where vendor_profile_id = '${TIENDA.vendorProfileId}';`);
});

test.afterAll(() => {
    if (envioOriginal === 't' || envioOriginal === 'f') {
        sqlGemelo(`update public.store_payment_settings set allow_shipping = ${envioOriginal === 't'} where vendor_profile_id = '${TIENDA.vendorProfileId}';`);
    }
});

async function sinScrollHorizontal(page: Page) {
    const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(w).toBeLessThanOrEqual(0);
}

async function foto(page: Page, nombre: string) {
    await page.screenshot({ path: test.info().outputPath(`${nombre}.png`), fullPage: true });
}

/** La tienda aprueba el comprobante (admin.a, por la RPC con su JWT, como la UI). */
function aprobarComoTienda(orderId: string) {
    const out = sqlGemelo(`begin;
        select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'admin.a'), 'role', 'authenticated')::text, true);
        set local role authenticated;
        select 'aprobado:' || (public.approve_order_receipt('${orderId}'::uuid, null) ->> 'ok');
        commit;`);
    expect(out).toContain('aprobado:true');
}

function codigoVigente(orderId: string, code: string): boolean {
    return sqlGemelo(`select pickup_code_hash = encode(sha256(convert_to('${code}' || ':' || id::text, 'UTF8')), 'hex')
        from public.orders where id = '${orderId}';`).trim() === 't';
}

test('socio adulto: solo retiro sin envío, nombre visible, banner solo al crear, código regenerado desde otro navegador', async ({ browser }, info) => {
    const dispositivo = { ...info.project.use };
    const ctx = await contextoComo(browser, 'atleta.a', dispositivo);
    const page = await ctx.newPage();

    // ── Vitrina: el nombre se ve completo, no queda debajo de la portada ──────
    await page.goto(`/tienda/${TIENDA.slug}`);
    const nombre = page.getByTestId('store-name');
    await expect(nombre).toHaveText(TIENDA.nombre, { timeout: 30_000 });
    const portada = await page.getByTestId('store-cover').boundingBox();
    const caja = await nombre.boundingBox();
    expect(portada && caja).toBeTruthy();
    expect(caja!.y).toBeGreaterThanOrEqual(portada!.y + portada!.height);
    const tapado = await nombre.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + Math.min(r.width / 2, 24), r.top + r.height / 2);
        return !(hit && (hit === el || el.contains(hit)));
    });
    expect(tapado).toBe(false);
    await expect(page.getByText('Solo tu escuela')).toHaveCount(0);
    await sinScrollHorizontal(page);
    await foto(page, '01-vitrina-nombre-visible');

    // ── Checkout: solo retiro, sin opción de envío ───────────────────────────
    await page.getByRole('button', { name: `Agregar ${TIENDA.termo}` }).click();
    await page.getByTestId('cart-bar').click();
    const pagarTienda = page.getByRole('button', { name: `Pagar en ${TIENDA.nombre}` });
    await expect(pagarTienda).toBeEnabled({ timeout: 20_000 });
    await pagarTienda.click();
    await expect(page).toHaveURL(new RegExp(`/checkout/tienda/${TIENDA.vendorProfileId}`));
    await expect(page.getByTestId('pickup-only')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('radio', { name: /Envío a domicilio/ })).toHaveCount(0);
    await expect(page.getByText('Envío a domicilio')).toHaveCount(0);
    await expect(page.locator('#dep')).toHaveCount(0);
    // Copy neutral: un socio adulto no lee "hijo".
    expect(await page.locator('#b-notes').getAttribute('placeholder')).not.toMatch(/hij[oa]|acudiente/i);
    await page.getByRole('radio', { name: /Transferencia bancaria/ }).click();
    await sinScrollHorizontal(page);
    await foto(page, '02-checkout-solo-retiro');
    await page.locator('[data-testid="pay-button"]:visible').click();

    // ── Pedido creado: banner solo en la llegada ─────────────────────────────
    await expect(page).toHaveURL(/\/mis-compras\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const orderId = page.url().match(/mis-compras\/([0-9a-f-]{36})/)![1];
    await expect(page.getByTestId('order-created-banner')).toBeVisible();
    const codigo0 = (await page.getByTestId('pickup-code').innerText()).trim();
    expect(codigo0).toMatch(/^\d{6}$/);
    expect(codigoVigente(orderId, codigo0)).toBe(true);
    await foto(page, '03-pedido-creado');

    await page.reload();
    await expect(page.getByTestId('order-status').first()).toHaveText('Pendiente de pago', { timeout: 20_000 });
    await expect(page.getByTestId('order-created-banner')).toHaveCount(0);

    // Comprobante → la tienda aprueba → pagado: tampoco hay banner.
    await page.getByTestId('receipt-input').setInputFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: COMPROBANTE_PNG });
    await expect(page.getByTestId('awaiting-approval')).toBeVisible({ timeout: 20_000 });
    aprobarComoTienda(orderId);
    await page.reload();
    await expect(page.getByTestId('order-status').first()).toHaveText('Pagado', { timeout: 20_000 });
    await expect(page.getByTestId('order-created-banner')).toHaveCount(0);
    await expect(page.getByTestId('pickup-code')).toHaveText(codigo0);

    // ── Otro navegador (sin el código guardado): Mis compras → generar ───────
    const ctx2 = await contextoComo(browser, 'atleta.a', dispositivo);
    const otro = await ctx2.newPage();
    await otro.goto('/mis-compras');
    const ref = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
    const fila = otro.locator('li', { has: otro.getByText(ref, { exact: true }) });
    await expect(fila.getByTestId('my-order-pickup-code')).toHaveText(/Generar código de retiro/, { timeout: 20_000 });
    await sinScrollHorizontal(otro);
    await foto(otro, '04-mis-compras-otro-navegador');
    await fila.getByTestId('my-order-pickup-code').click();
    await expect(otro.getByTestId('pickup-code-missing')).toBeVisible({ timeout: 20_000 });
    await expect(otro.getByTestId('pickup-code')).toHaveCount(0);
    await otro.getByTestId('pickup-code-generate').click();
    await otro.getByTestId('pickup-code-confirm').click();
    const nuevo = otro.getByTestId('pickup-code');
    await expect(nuevo).toHaveText(/^\d{6}$/, { timeout: 20_000 });
    const codigo1 = (await nuevo.innerText()).trim();
    await expect(otro.getByTestId('pickup-code-left')).toContainText('Puedes generar 2 códigos más');
    await expect(otro.getByTestId('order-created-banner')).toHaveCount(0);
    await foto(otro, '05-codigo-regenerado');
    expect(codigoVigente(orderId, codigo1)).toBe(true);
    if (codigo1 !== codigo0) expect(codigoVigente(orderId, codigo0)).toBe(false);
    const auditoria = sqlGemelo(`select actor_role || '|' || note from public.order_status_history
        where order_id = '${orderId}' and note like 'Código de retiro regenerado%';`).trim();
    expect(auditoria).toMatch(/^buyer\|Código de retiro regenerado por el comprador \(1 de 3\)/);
    expect(auditoria).not.toContain(codigo1);

    // Desde Mis compras del segundo navegador ya se ofrece "Ver".
    await otro.goto('/mis-compras');
    await expect(fila.getByTestId('my-order-pickup-code')).toHaveText(/Ver código de retiro/, { timeout: 20_000 });

    // El primer navegador ya no muestra el código viejo como si sirviera.
    await page.reload();
    await expect(page.getByTestId('pickup-code-missing')).toContainText('otro dispositivo', { timeout: 20_000 });
    await expect(page.getByTestId('pickup-code')).toHaveCount(0);
    await foto(page, '06-primer-navegador-codigo-reemplazado');

    await ctx2.close();
    await ctx.close();
});

test('leer el pedido con el límite agotado (429) dice "intenta en un minuto", no "Pedido no encontrado"', async ({ browser }, info) => {
    const ctx = await contextoComo(browser, 'atleta.a', { ...info.project.use });
    const page = await ctx.newPage();
    // El 429 lo da el limitador del BFF; aquí se simula para no gastar el cupo real.
    await page.route('**/api/v1/marketplace/orders/*', (route) => route.fulfill({
        status: 429, contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'RATE_LIMITED', message: 'Demasiadas solicitudes, intenta en un minuto.' }),
    }));
    await page.goto('/mis-compras/00000000-0000-4000-8000-000000000999');
    await expect(page.getByText('Demasiadas solicitudes, intenta en un minuto.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Pedido no encontrado')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Reintentar/ })).toBeVisible();
    await foto(page, '07-429-no-es-404');
    await page.unroute('**/api/v1/marketplace/orders/*');
    // Y un 404 real sí es "no encontrado".
    await page.reload();
    await expect(page.getByText('Pedido no encontrado')).toBeVisible({ timeout: 20_000 });
    await ctx.close();
});
