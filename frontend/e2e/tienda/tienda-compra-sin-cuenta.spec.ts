// Tienda — compra SIN cuenta (mig. 20261013170553). Primer cliente: GYM RM, 205
// socios y 2 con cuenta. Corre SOLO contra el gemelo local (docs/qa-gemelo-local.md):
//
//   npm run qa:twin:up                                       (raíz)
//   BFF local con las variables del gemelo en un puerto propio (p. ej. 3197)
//   cd frontend && QA_TWIN_BFF_URL=http://127.0.0.1:3197 \
//     npx playwright test -c playwright.gemelo.config.ts tienda/tienda-compra-sin-cuenta --project=pixel-7 --workers=1
//
// Cubre (en Pixel 7):
//   1. Socio SIN sesión: vitrina → carrito → «Pagar» ofrece «Continuar sin cuenta»
//      o «Iniciar sesión»; sin cuenta pide nombre y correo (celular opcional).
//   2. Transferencia: el pedido se crea y abre /pedido/:token con las cuentas
//      REALES de la tienda; sube el comprobante desde el enlace.
//   3. La escuela (admin.a) ve el pedido «Sin cuenta» y aprueba el comprobante.
//   4. El socio ve «Pagado» con el mismo enlace y genera su código de retiro.
//   5. La base: orden sin user_id, correo guardado, token solo como hash.
//   6. Un enlace inventado no abre nada.
//
// Escribe en el gemelo (un pedido por corrida). El BFF del gemelo simula el
// correo (STORE_GUEST_EMAIL_MODE=simulate / SUPABASE_URL local): nunca sale uno real.
import { test, expect, type Page } from '@playwright/test';
import { BASE_URL, TIENDA, assertBffEsGemelo, contextoComo, prepararTiendaGemelo, sqlGemelo, COMPROBANTE_PNG } from './gemelo';

test.describe.configure({ mode: 'serial' });
test.setTimeout(480_000);

let configOriginal: string | null = null;

test.beforeAll(async () => {
    prepararTiendaGemelo();
    await assertBffEsGemelo();
    const parcheada = sqlGemelo(`select position('sportmaps.guest_checkout' in pg_get_functiondef(
        'public.create_cart_order(jsonb,text,uuid,jsonb,jsonb,text,text,uuid,uuid)'::regprocedure)) > 0
        and to_regprocedure('public.create_guest_cart_order(jsonb,text,uuid,jsonb,jsonb,text,text,uuid,text)') is not null;`).trim();
    if (parcheada !== 't') {
        throw new Error('El gemelo no tiene la compra sin cuenta (mig. 20261013170553 sin aplicar o create_cart_order reemplazada después).');
    }
    configOriginal = sqlGemelo(`select value::text from public.platform_config where key = 'store_guest_checkout';`).trim() || null;
    // Todas las corridas salen de 127.0.0.1: el límite por IP del gemelo se sube para que no se acumule.
    sqlGemelo(`update public.platform_config
                  set value = value || '{"enabled": true, "max_orders_per_ip_hour": 1000, "max_order_amount": 1000000}'::jsonb
                where key = 'store_guest_checkout';`);
});

test.afterAll(() => {
    if (configOriginal) {
        sqlGemelo(`update public.platform_config set value = '${configOriginal.replace(/'/g, "''")}'::jsonb where key = 'store_guest_checkout';`);
    }
});

async function sinScrollHorizontal(page: Page) {
    const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(w).toBeLessThanOrEqual(0);
}

async function foto(page: Page, nombre: string) {
    await page.screenshot({ path: test.info().outputPath(`${nombre}.png`), fullPage: true });
}

test('socio sin cuenta: compra con transferencia, sube el comprobante desde el enlace, la escuela aprueba y ve "Pagado"', async ({ browser }, info) => {
    test.skip(info.project.name !== 'pixel-7', 'El flujo del socio se prueba en Pixel 7.');
    const correo = `socio.sin.cuenta+${Date.now()}@qa.sportmaps.test`;

    // ── Socio SIN sesión, en su celular ────────────────────────────────────────
    const socioCtx = await browser.newContext({ ...info.project.use, baseURL: BASE_URL });
    const socio = await socioCtx.newPage();
    await socio.goto(`/tienda/${TIENDA.slug}`);
    await expect(socio.getByTestId('store-name')).toHaveText(TIENDA.nombre, { timeout: 120_000 });
    await socio.getByRole('button', { name: `Agregar ${TIENDA.termo}` }).click();
    await socio.getByTestId('cart-bar').click();
    const pagarTienda = socio.getByRole('button', { name: `Pagar en ${TIENDA.nombre}` });
    await expect(pagarTienda).toBeEnabled({ timeout: 20_000 });
    await pagarTienda.click();
    await expect(socio).toHaveURL(new RegExp(`/checkout/tienda/${TIENDA.vendorProfileId}`));

    // Elegir: iniciar sesión o continuar sin cuenta (ya no lo manda al login).
    await expect(socio.getByTestId('guest-choice')).toBeVisible({ timeout: 90_000 });
    await expect(socio.getByTestId('guest-login')).toBeVisible();
    await sinScrollHorizontal(socio);
    await foto(socio, '01-elegir-sin-cuenta-o-sesion');
    await socio.getByTestId('guest-continue').click();

    // Datos: nombre y correo; el celular es opcional.
    await expect(socio.getByText('Celular (opcional)')).toBeVisible({ timeout: 20_000 });
    await expect(socio.getByTestId('guest-email-hint')).toBeVisible();
    await socio.locator('#b-name').fill('Socio Gimnasio Sin Cuenta');
    await socio.getByRole('radio', { name: /Transferencia bancaria/ }).click();
    const pagar = socio.locator('[data-testid="pay-button"]:visible');
    await expect(pagar).toBeDisabled(); // falta el correo
    await socio.locator('#b-email').fill(correo);
    await expect(pagar).toBeEnabled({ timeout: 20_000 });
    await sinScrollHorizontal(socio);
    await foto(socio, '02-checkout-sin-cuenta');
    await pagar.click();

    // ── El enlace del pedido ────────────────────────────────────────────────────
    await expect(socio).toHaveURL(/\/pedido\/[0-9a-f]{64}$/, { timeout: 90_000 });
    const token = socio.url().match(/\/pedido\/([0-9a-f]{64})$/)![1];
    await expect(socio.getByTestId('order-created-banner')).toBeVisible({ timeout: 20_000 });
    await expect(socio.getByTestId('order-created-banner')).toContainText('so•••@qa.sportmaps.test');
    await expect(socio.getByTestId('order-status').first()).toHaveText('Pendiente de pago');
    await expect(socio.getByTestId('transfer-account').first()).toContainText(TIENDA.cuenta);
    await expect(socio.getByTestId('guest-create-account')).toContainText('Crear mi cuenta');
    const referencia = (await socio.getByRole('heading', { level: 1 }).innerText()).trim();
    await sinScrollHorizontal(socio);
    await foto(socio, '03-pedido-creado-enlace');

    // La base: sin cuenta, con su correo, el token solo como hash.
    const fila = sqlGemelo(`select id || '|' || coalesce(user_id::text, 'null') || '|' || guest_email || '|' ||
            (guest_token_hash = encode(sha256(convert_to('${token}', 'UTF8')), 'hex')) || '|' ||
            (position('${token}' in row_to_json(o)::text) = 0)
        from public.orders o where guest_token_hash = encode(sha256(convert_to('${token}', 'UTF8')), 'hex');`).trim();
    const [orderId, userId, guardado, hashOk, sinClaro] = fila.split('|');
    expect(orderId).toMatch(/^[0-9a-f-]{36}$/);
    expect(userId).toBe('null');
    expect(guardado).toBe(correo.toLowerCase());
    expect(hashOk).toBe('true');
    expect(sinClaro).toBe('true');

    // Comprobante desde el enlace.
    await socio.getByTestId('receipt-input').setInputFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: COMPROBANTE_PNG });
    await expect(socio.getByTestId('awaiting-approval')).toBeVisible({ timeout: 60_000 });
    await expect(socio.getByTestId('order-status').first()).toHaveText('Esperando aprobación');
    await foto(socio, '04-comprobante-enviado');

    // ── La escuela aprueba (UI de pedidos de la tienda) ───────────────────────
    const adminCtx = await contextoComo(browser, 'admin.a');
    const admin = await adminCtx.newPage();
    await admin.goto('/orders');
    const filaAdmin = admin.locator(`[data-testid="seller-order-row"][data-ref="${referencia}"]`);
    await expect(filaAdmin).toBeVisible({ timeout: 90_000 });
    await expect(filaAdmin).toContainText('Socio Gimnasio Sin Cuenta');
    await expect(filaAdmin.getByTestId('seller-order-guest')).toHaveText('Sin cuenta');
    await filaAdmin.getByRole('button', { name: `Ver pedido ${referencia}` }).click();
    const detalle = admin.getByTestId('seller-order-detail');
    await expect(detalle.getByTestId('detail-customer')).toHaveText('Socio Gimnasio Sin Cuenta');
    await expect(detalle.getByRole('button', { name: 'Ver comprobante' })).toBeVisible();
    await foto(admin, '05-escuela-ve-pedido-sin-cuenta');
    await detalle.getByRole('button', { name: 'Aprobar pago' }).click();
    await expect(detalle.getByTestId('order-status')).toHaveText('Pagado', { timeout: 20_000 });

    // ── El socio ve "Pagado" con el mismo enlace y genera su código ───────────
    await socio.reload();
    await expect(socio.getByTestId('order-status').first()).toHaveText('Pagado', { timeout: 20_000 });
    await expect(socio.getByTestId('buyer-status-message')).toContainText('Pago confirmado');
    await expect(socio.getByTestId('order-created-banner')).toHaveCount(0);
    await expect(socio.getByTestId('transfer-box')).toHaveCount(0);
    // El código de la compra quedó guardado en ESTE celular y sigue sirviendo.
    const codigo = socio.getByTestId('pickup-code');
    await expect(codigo).toHaveText(/^\d{6}$/, { timeout: 20_000 });
    const inicial = (await codigo.innerText()).trim();
    expect(sqlGemelo(`select pickup_code_hash = encode(sha256(convert_to('${inicial}' || ':' || id::text, 'UTF8')), 'hex')
        from public.orders where id = '${orderId}';`).trim()).toBe('t');
    // Uno nuevo desde el enlace (p. ej. si lo perdió): el anterior deja de servir.
    await socio.getByTestId('pickup-code-generate').click();
    await socio.getByTestId('pickup-code-confirm').click();
    await expect(socio.getByTestId('pickup-code-left')).toContainText('Puedes generar 2 códigos más', { timeout: 30_000 });
    const valor = (await codigo.innerText()).trim();
    expect(valor).toMatch(/^\d{6}$/);
    expect(sqlGemelo(`select pickup_code_hash = encode(sha256(convert_to('${valor}' || ':' || id::text, 'UTF8')), 'hex')
        from public.orders where id = '${orderId}';`).trim()).toBe('t');
    await sinScrollHorizontal(socio);
    await foto(socio, '06-socio-ve-pagado-y-codigo');

    // ── Un enlace inventado no abre nada ──────────────────────────────────────
    const otro = await socioCtx.newPage();
    await otro.goto(`/pedido/${'0'.repeat(64)}`);
    await expect(otro.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible({ timeout: 20_000 });
    await foto(otro, '07-enlace-inventado');

    await Promise.all([socioCtx.close(), adminCtx.close()]);
});
