// Tienda — la entrada del COMPRADOR depende de la tienda de SU escuela, no
// solo del flag global (piloto GYM RM: store_enabled prendido con allowlist).
//
// Con el flag prendido y allowlist SOLO de la tienda de la escuela A:
//   · padre.a (escuela A, su tienda vende)      → ve «Tienda» (menú lateral y barra móvil)
//   · padre.b (escuela B, tienda que NO vende)  → NO ve «Tienda» en ningún lado
//
// Corre SOLO contra el gemelo local (docs/qa-gemelo-local.md):
//   npm run qa:twin:up                                    (raíz)
//   BFF local con las variables del gemelo en un puerto propio (p. ej. 3199)
//   cd frontend && QA_TWIN_BFF_URL=http://127.0.0.1:3199 \
//     npx playwright test -c playwright.gemelo.config.ts tienda/tienda-entrada-por-escuela --workers=1
//
// Estado: guarda platform_config.store_enabled antes y lo restaura al final;
// la tienda (no vendedora) de la escuela B se crea acá y se borra al final.
import { test, expect, devices, type Page } from '@playwright/test';
import { TIENDA, TWIN_BFF_URL, assertBffEsGemelo, contextoComo, prepararTiendaGemelo, sqlGemelo } from './gemelo';

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

const ESCUELA_B = '00000000-0000-4000-b000-000000000002';
const OWNER_B = '00000000-0000-4000-a000-000000000007';
const TIENDA_B = '00000000-0000-4000-c000-0000000000b1';

let flagOriginal: string | null = null;

test.beforeAll(async () => {
    test.setTimeout(120_000); // incluye la espera del caché de 60 s del BFF
    flagOriginal = sqlGemelo(`select value::text from public.platform_config where key = 'store_enabled';`).trim() || null;
    prepararTiendaGemelo();
    // Allowlist SOLO de la tienda de A (sin el vendedor externo del piloto).
    sqlGemelo(`update public.platform_config
                  set value = jsonb_build_object('enabled', true, 'allowlist', jsonb_build_array('${TIENDA.vendorProfileId}'))
                where key = 'store_enabled';`);
    // La escuela B TIENE tienda (activa y verificada) pero no está en la allowlist:
    // el menú no puede decidir por «existe tienda», sino por «la tienda vende».
    sqlGemelo(`begin;
      select set_config('sportmaps.trusted_rpc', 'on', true);
      insert into public.vendor_profiles (id, user_id, vendor_type, school_id, display_name, slug, city,
                                          verification_status, is_active, capabilities)
      values ('${TIENDA_B}', '${OWNER_B}', 'school', '${ESCUELA_B}', 'Tienda QA Club Llanos', 'tienda-qa-llanos', 'Bogota',
              'verified', true, '{"can_sell_products": true, "can_sell_services": false}'::jsonb)
      on conflict (id) do update set is_active = true, verification_status = 'verified', school_id = excluded.school_id;
      commit;`);
    const check = sqlGemelo(`select public.store_enabled(),
        public.store_seller_allowed('${TIENDA.vendorProfileId}'),
        public.store_seller_allowed('${TIENDA_B}');`).trim();
    expect(check, 'flag on · A vende · B no vende').toBe('t|t|f');
    // El BFF cachea store_enabled() 60 s: si estaba apagado, esperar a que lo vea.
    for (let i = 0; ; i++) {
        try { await assertBffEsGemelo(); break; } catch (e) {
            if (i >= 14) throw e;
            await new Promise((r) => setTimeout(r, 5_000));
        }
    }
});

test.afterAll(() => {
    sqlGemelo(`begin;
      select set_config('sportmaps.trusted_rpc', 'on', true);
      delete from public.vendor_profiles where id = '${TIENDA_B}';
      commit;`);
    if (flagOriginal) {
        sqlGemelo(`update public.platform_config set value = '${flagOriginal.replace(/'/g, "''")}'::jsonb where key = 'store_enabled';`);
    }
});

/** Abre el menú lateral (drawer en móvil) y despliega el grupo del comprador. */
async function abrirMenu(page: Page, movil: boolean) {
    if (movil) await page.locator('[data-sidebar="trigger"]').first().click();
    const sidebar = page.locator('[data-sidebar="sidebar"]').filter({ visible: true }).first();
    await expect(sidebar).toBeVisible({ timeout: 30_000 });
    const grupo = sidebar.getByRole('button', { name: 'Seguimiento' });
    await expect(grupo).toBeVisible({ timeout: 30_000 });
    await grupo.click();
    // Un ítem siempre presente del mismo grupo: confirma que el grupo se abrió.
    await expect(sidebar.locator('a[href="/my-payments"]')).toBeVisible();
    return sidebar;
}

for (const caso of [
    { alias: 'padre.a' as const, escuela: 'A', vende: true },
    { alias: 'padre.b' as const, escuela: 'B', vende: false },
]) {
    test(`${caso.alias} (escuela ${caso.escuela}) ${caso.vende ? 'VE' : 'NO ve'} «Tienda» — menú lateral y barra móvil`, async ({ browser }, info) => {
        const movil = info.project.name === 'pixel-7';
        const ctx = await contextoComo(browser, caso.alias, movil ? devices['Pixel 7'] : {});
        const page = await ctx.newPage();

        // Lo que la UI pregunta: la respuesta del BFF del gemelo para su escuela.
        const resp = page.waitForResponse((r) => r.url().startsWith(TWIN_BFF_URL) && r.url().includes('/marketplace/school-store/'), { timeout: 45_000 });
        await page.goto('/dashboard');
        const body = await (await resp).json();
        expect(body?.data?.selling, `selling de la escuela ${caso.escuela}`).toBe(caso.vende);
        // padre.b no tiene pedidos en el gemelo: tampoco «Mis compras».
        if (!caso.vende) expect(body?.data?.has_orders).toBe(false);

        // Barra inferior (solo móvil).
        if (movil) {
            const barra = page.getByTestId('mobile-bottom-nav');
            await expect(barra).toBeVisible({ timeout: 30_000 });
            await expect(barra.locator('a[href="/children"]')).toBeVisible();
            await expect(barra.locator('a[href="/mi-tienda"]')).toHaveCount(caso.vende ? 1 : 0);
            if (caso.vende) await expect(barra.getByText('Tienda', { exact: true })).toBeVisible();
        } else {
            await expect(page.getByTestId('mobile-bottom-nav')).toBeHidden();
        }

        // Menú lateral (drawer en móvil).
        const sidebar = await abrirMenu(page, movil);
        await expect(sidebar.locator('a[href="/mi-tienda"]')).toHaveCount(caso.vende ? 1 : 0);
        await expect(sidebar.locator('a[href="/mis-compras"]')).toHaveCount(caso.vende ? 1 : 0);

        if (caso.vende) {
            // Entrar por el menú lleva a la vitrina de SU escuela.
            await sidebar.locator('a[href="/mi-tienda"]').click();
            await expect(page).toHaveURL(new RegExp(`/tienda/${TIENDA.slug}`), { timeout: 30_000 });
        } else {
            // Con el enlace directo, aviso claro (no error ni vitrina vacía).
            await page.goto('/mi-tienda');
            await expect(page.getByTestId('mi-tienda-unavailable')).toBeVisible({ timeout: 30_000 });
            await expect(page.getByRole('heading', { name: 'La tienda aún no está disponible' })).toBeVisible();
        }
        await page.screenshot({ path: info.outputPath(`${caso.alias}-${info.project.name}.png`) });
        await ctx.close();
    });
}
