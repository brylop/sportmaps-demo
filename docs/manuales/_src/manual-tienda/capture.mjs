// Capturas REALES del manual de la tienda escolar — contra el GEMELO LOCAL, nunca la viva.
// (la tienda está apagada en la base real: store_enabled=false).
//
// Requiere, en este orden (ver docs/qa-gemelo-local.md):
//   1. npm run qa:twin:up
//   2. BFF con las variables del gemelo en 3199 (SUPABASE_URL=http://127.0.0.1:54321, llaves
//      de `npm run qa:twin:status`, WOMPI_*/MP_* vacías) — así lo levantó frontend/e2e/tienda.
//   3. Vite en 3101 con VITE_SUPABASE_URL=http://127.0.0.1:54321 y VITE_BFF_URL/VITE_API_URL=http://127.0.0.1:3199
//      (las variables de proceso le ganan a frontend/.env, que apunta a la viva).
//   4. node docs/manuales/_src/manual-tienda/imagenes.mjs   (fotos ilustradas del catálogo)
//
//   node docs/manuales/_src/manual-tienda/capture.mjs
//   node docs/manuales/_src/manual-tienda/restaurar-gemelo.sql   ← NO: se corre con psql, ver abajo
//
// Al terminar, devolver los nombres del seed para que los specs e2e sigan pasando:
//   docker exec -i supabase_db_sportmaps-qa-twin psql -U postgres < docs/manuales/_src/manual-tienda/restaurar-gemelo.sql
//
// Escribe en el gemelo: un producto ("Uniforme de juego", solo la primera vez) y dos o tres
// pedidos por corrida. Cualquier pedido a algo que no sea 127.0.0.1/localhost se aborta.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium, devices } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:3101';
const BFF = process.env.QA_TWIN_BFF_URL || 'http://127.0.0.1:3199';
const TWIN = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SCHOOL_A = '00000000-0000-4000-b000-000000000001';
const SLUG = 'club-voleibol-condores';
const STORE = 'Tienda Club Voleibol Cóndores';
const SHOTS = path.join(here, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;

for (const u of [BASE, BFF, TWIN]) {
  const h = new URL(u).hostname;
  if (!['127.0.0.1', 'localhost'].includes(h)) throw new Error(`ABORTADO: ${u} no es local`);
}

function psql(sql) {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_sportmaps-qa-twin', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: sql, encoding: 'utf8' });
}

// ── Preparación del gemelo ─────────────────────────────────────────────────
function prepararGemelo() {
  const out1 = psql(fs.readFileSync(path.join(repo, 'frontend/e2e/tienda/gemelo-tienda.sql'), 'utf8'));
  if (!out1.includes('tienda-gemelo-ok|t|t')) throw new Error('gemelo-tienda.sql falló:\n' + out1);
  const out2 = psql(fs.readFileSync(path.join(here, 'gemelo-manual.sql'), 'utf8'));
  if (!out2.includes('manual-tienda-ok')) throw new Error('gemelo-manual.sql falló:\n' + out2);
  // El uniforme (si ya existe de una corrida anterior) vuelve a 4 por variante.
  psql(`update public.product_variants set stock = 4, reserved = 0 where product_id in
          (select id from public.products where vendor_profile_id = '00000000-0000-4000-c000-0000000000a1' and name = 'Uniforme de juego');`);
}

// ── Sesiones ───────────────────────────────────────────────────────────────
async function token(alias) {
  const r = await fetch(`${TWIN}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email: `${alias}@qa.sportmaps.test`, password: 'QaGemelo2026!' }),
  });
  if (!r.ok) throw new Error(`login ${alias}: ${r.status}`);
  return r.json();
}

async function sesion(browser, alias, { mobile = false, school = SCHOOL_A } = {}) {
  const opts = mobile
    ? { ...devices['Pixel 7'], locale: 'es-CO' }
    : { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, locale: 'es-CO' };
  const ctx = await browser.newContext(opts);
  // Guarda dura: nada sale del equipo.
  await ctx.route((url) => !['127.0.0.1', 'localhost'].includes(url.hostname) && !/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname),
    (route) => route.abort());
  const t = await token(alias);
  await ctx.addInitScript(([k, v, s]) => {
    if (!localStorage.getItem(k)) localStorage.setItem(k, v);
    if (s && !localStorage.getItem('sportmaps_active_school_id')) localStorage.setItem('sportmaps_active_school_id', s);
    // Sin el letrero "AMBIENTE DE QA-GEMELO" en las capturas.
    const css = document.createElement('style');
    css.textContent = '.sticky-safe.tracking-widest.uppercase{display:none!important}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(css));
  }, ['sb-127-auth-token', JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, expires_in: t.expires_in,
    expires_at: t.expires_at, token_type: 'bearer', user: t.user }), school]);
  ctx.setDefaultTimeout(30_000);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[pageerror ${alias}]`, e.message));
  return { ctx, page };
}

// El BFF limita las operaciones de pago a 20/min por IP (paymentLimiter) y TODO sale de
// la misma IP: entre tandas se espera a que la ventana se vacíe.
const respiro = async (why) => { console.log('… esperando 62 s (limitador del BFF):', why); await new Promise((r) => setTimeout(r, 62_000)); };
const want = (n) => !ONLY || ONLY.has(n);
const settle = (p, ms = 1200) => p.waitForTimeout(ms);
async function go(page, url) {
  console.log('→', url);
  await page.goto(BASE + url, { timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await settle(page, 1500);
}
async function shot(page, name, opts = {}) {
  for (let i = 0; ; i++) {
    try { return await page.screenshot({ path: path.join(SHOTS, `${name}.png`), ...opts }); }
    catch (e) { if (i >= 3) throw e; await page.bringToFront().catch(() => {}); await page.waitForTimeout(1000); }
  }
}
const shotEl = async (loc, name) => { await loc.scrollIntoViewIfNeeded().catch(() => {}); await settle(loc.page(), 300); await loc.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
// Sidebar / encabezado de la app fuera de cuadro: el área principal de la app de escritorio.
const main = (page) => page.locator('main').first();

// Comprobante de EJEMPLO (dibujado; marcado como ejemplo) para subir en el pedido.
async function comprobantePng(browser, monto, ref) {
  const p = await browser.newPage({ viewport: { width: 520, height: 760 } });
  await p.setContent(`<html><body style="margin:0;font-family:Arial;background:#f3f5f8">
    <div style="margin:24px;background:#fff;border-radius:18px;padding:28px;box-shadow:0 4px 16px rgba(0,0,0,.08);position:relative;overflow:hidden">
      <div style="position:absolute;top:150px;left:-40px;transform:rotate(-24deg);font-size:64px;font-weight:900;color:rgba(242,107,29,.12)">EJEMPLO</div>
      <div style="width:56px;height:56px;border-radius:50%;background:#22a05a;color:#fff;font-size:34px;text-align:center;line-height:56px">✓</div>
      <h2 style="margin:14px 0 4px">¡Transferencia exitosa!</h2><div style="color:#667">5 oct 2026 · 10:42 a. m.</div>
      <div style="font-size:34px;font-weight:800;margin:22px 0">$ ${monto}</div>
      <table style="width:100%;font-size:15px;line-height:2">
        <tr><td style="color:#667">Para</td><td style="text-align:right">Club Voleibol Cóndores</td></tr>
        <tr><td style="color:#667">Cuenta</td><td style="text-align:right">Ahorros ***712-09</td></tr>
        <tr><td style="color:#667">Descripción</td><td style="text-align:right;font-size:12px">${ref}</td></tr>
        <tr><td style="color:#667">Comprobante</td><td style="text-align:right">0004521873</td></tr></table></div></body></html>`);
  const buf = await p.screenshot();
  await p.close();
  return buf;
}

async function run() {
  prepararGemelo();
  const browser = await chromium.launch();
  const ctxs = [];
  try {
    // ════════════ A. LA ESCUELA ════════════
    // 01 · CTA de activación (escuela B: todavía sin tienda).
    if (want('01')) {
      const { ctx, page } = await sesion(browser, 'owner.b', { school: '00000000-0000-4000-b000-000000000002' }); ctxs.push(ctx);
      await go(page, '/dashboard');
      const btn = page.getByRole('button', { name: 'Activar tienda escolar' });
      await btn.waitFor({ timeout: 30_000 });
      await shotEl(page.locator('div.rounded-xl, div[class*="Card"], .border').filter({ has: btn }).last(), '01-cta-activar');
      await ctx.close();
    }

    const owner = await sesion(browser, 'owner.a'); ctxs.push(owner.ctx);
    const op = owner.page;

    // 02 · Menú "Mi Tienda" + panel.
    if (want('02')) {
      await go(op, '/vendor/dashboard');
      await shot(op, '02-panel-tienda');
      const grupo = op.getByText('MI TIENDA', { exact: false }).last();
      await grupo.scrollIntoViewIfNeeded().catch(() => {});
      await op.getByRole('link', { name: 'Promociones' }).scrollIntoViewIfNeeded().catch(() => {});
      await settle(op, 400);
      await shot(op, '02b-menu-mi-tienda');
    }

    // 03-04 · Medios de pago de la escuela (cuentas de transferencia + pasarela propia).
    if (want('03')) {
      await go(op, '/payments-automation?tab=config');
      const transf = op.locator('div.rounded-lg, div.rounded-xl').filter({ has: op.getByText('Datos de Pago para Transferencia') }).last();
      await shotEl(transf, '03-cuentas-transferencia');
      const wompi = op.locator('div.rounded-lg, div.rounded-xl').filter({ has: op.getByText(/a través de Wompi/) }).last();
      await shotEl(wompi, '04-pasarela-propia').catch((e) => console.log('04 sin captura:', e.message));
    }

    // 05-10 · Productos: lista, asistente "Uniforme de juego" (tallas × colores), publicado.
    if (want('05')) {
      await go(op, '/vendor/products');
      await shot(op, '05-mis-productos');
      const yaExiste = psql(`select count(*) from public.products where vendor_profile_id='00000000-0000-4000-c000-0000000000a1' and name='Uniforme de juego' and status='active';`).trim() !== '0';
      if (!yaExiste) {
        await op.getByRole('button', { name: /Nuevo Producto/ }).click();
        await op.getByText('¿Qué vas a vender?').waitFor();
        await op.getByRole('button', { name: /Ropa Deportiva/ }).click();
        await settle(op, 400);
        await shot(op, '06-asistente-categoria');
        await op.getByRole('button', { name: /Siguiente/ }).click();

        await op.getByPlaceholder(/Tenis Nike/).fill('Uniforme de juego');
        await op.getByPlaceholder(/especial este producto/).fill('Uniforme oficial de partido: camiseta con número y pantaloneta. Tela liviana de secado rápido, escudo bordado.');
        await op.getByPlaceholder('120000').fill('120000');
        await op.getByPlaceholder('19').fill('19');
        await op.locator('input[type="file"]').first().setInputFiles(path.join(here, 'img', 'uniforme.png'));
        await op.locator('img[src*="product-images"]').first().waitFor({ timeout: 30_000 });
        // Género (obligatorio)
        await op.getByRole('combobox').filter({ hasText: /Selecciona género/i }).click();
        await op.getByRole('option', { name: 'unisex' }).click();
        await op.getByRole('combobox').filter({ hasText: /Selecciona deporte/i }).click();
        await op.getByRole('option', { name: 'otro' }).click();
        await settle(op, 500);
        await shotEl(op.locator('div.rounded-lg, div.rounded-xl').filter({ has: op.getByText('Información básica') }).last(), '07-asistente-info');
        await op.getByRole('button', { name: /Siguiente/ }).click();

        await op.getByText('Variantes y stock').waitFor();
        await op.getByRole('switch').first().click();
        for (const t of ['S', 'M', 'L', 'XL']) await op.getByRole('button', { name: t, exact: true }).click();
        const colorInput = op.getByPlaceholder(/Agregar color/);
        for (const c of ['Blanco', 'Azul']) { await colorInput.fill(c); await colorInput.press('Enter'); }
        const stockDefault = op.getByText('Stock por variante (default)').locator('xpath=following-sibling::input[1]');
        await stockDefault.fill('4');
        await settle(op, 400);
        await shotEl(op.locator('div.rounded-lg, div.rounded-xl').filter({ has: op.getByText('Variantes y stock') }).last(), '08-asistente-variantes');
        await op.getByRole('button', { name: /Siguiente/ }).click();

        await op.getByText('Listo para publicar').waitFor();
        await op.getByRole('combobox').last().click();
        await op.getByRole('option', { name: /Solo mi escuela/ }).click();
        await settle(op, 400);
        await shotEl(op.locator('div.rounded-lg, div.rounded-xl').filter({ has: op.getByText('Listo para publicar') }).last(), '09-asistente-publicar');
        await op.getByRole('button', { name: /Publicar/ }).last().click();
        await op.waitForURL(/\/vendor\/products$/, { timeout: 30_000 });
        await settle(op, 2000);
        await shot(op, '10-producto-publicado');
      }
    }

    // 11-12 · Inventario: editar producto (paso de variantes) y la pantalla Inventario.
    if (want('11')) {
      const uniId = psql(`select id from public.products where vendor_profile_id='00000000-0000-4000-c000-0000000000a1' and name='Uniforme de juego' and status='active' limit 1;`).trim();
      await go(op, `/vendor/products/${uniId}/edit`);
      await op.getByText('¿Qué vas a vender?').waitFor();
      await op.getByRole('button', { name: /Siguiente/ }).click();
      // 07 (paso 2 completo) se toma acá, en edición: la tarjeta es más alta que 1000 px.
      await op.setViewportSize({ width: 1600, height: 2300 });
      await op.getByText('Información básica').waitFor();
      await settle(op, 2500);
      await shotEl(op.locator('div.rounded-lg, div.rounded-xl').filter({ has: op.getByText('Información básica') }).last(), '07-asistente-info');
      await op.setViewportSize({ width: 1600, height: 1000 });
      await op.getByRole('button', { name: /Siguiente/ }).click();
      await op.getByText('Variantes y stock').waitFor();
      await settle(op, 600);
      await shotEl(op.locator('div.rounded-lg, div.rounded-xl').filter({ has: op.getByText('Variantes y stock') }).last(), '11-editar-variantes');
      await go(op, '/inventory');
      await shot(op, '12-inventario');
    }

    // ════════════ B. EL PADRE (Pixel 7) + gestión del pedido por la escuela ════════════
    const padre = await sesion(browser, 'padre.a', { mobile: true }); ctxs.push(padre.ctx);
    const pp = padre.page;
    const shotM = (name, full = false) => shot(pp, name, { fullPage: full });
    // Las pantallas dentro del layout de la app scrollean en un contenedor interno: fullPage no
    // sirve. Se toman "pantallazos" sucesivos bajando ese contenedor: name-1.png, name-2.png…
    const tall = async (name, max = 3) => {
      const info = await pp.evaluate(() => {
        const els = [...document.querySelectorAll('*')].filter((e) => {
          const st = getComputedStyle(e);
          return /(auto|scroll)/.test(st.overflowY) && e.scrollHeight > e.clientHeight + 40;
        }).sort((a, b) => b.clientHeight - a.clientHeight);
        const el = els[0] || document.scrollingElement;
        el.setAttribute('data-scroller', '1');
        return { sh: el.scrollHeight, ch: el.clientHeight };
      });
      const stepPx = Math.max(200, info.ch - 160);
      for (let i = 0, y = 0; i < max; i++, y += stepPx) {
        await pp.evaluate((y) => { const el = document.querySelector('[data-scroller]'); el.scrollTop = y; }, y);
        await settle(pp, 400);
        await shot(pp, `${name}-${i + 1}`);
        if (y + info.ch >= info.sh) break;
      }
      await pp.evaluate(() => { const el = document.querySelector('[data-scroller]'); el.scrollTop = 0; el.removeAttribute('data-scroller'); });
    };

    if (want('20')) {
      // Menú del padre
      await go(pp, '/dashboard');
      await pp.getByRole('navigation').first().waitFor({ timeout: 30_000 }).catch(() => {});
      await settle(pp, 3000);
      const toggle = pp.getByRole('button', { name: /Toggle Sidebar|Abrir menú|Menú/i }).first();
      if (await toggle.isVisible().catch(() => false)) { await toggle.click(); await settle(pp, 700); }
      await pp.getByText(/^Seguimiento$/i).first().click({ timeout: 8_000 }).catch((e) => console.log('sin grupo Seguimiento', String(e.message).slice(0, 80)));
      await settle(pp, 600);
      await pp.getByRole('link', { name: 'Mis compras', exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
      await shotM('20-menu-padre');
    }

    if (ONLY && !ONLY.has('B')) return; // ONLY=…,B corre también el flujo completo del padre
    // Vitrina → ficha → carrito → checkout (transferencia)
    await go(pp, '/mi-tienda');
    await pp.waitForURL(new RegExp(`/tienda/${SLUG}`), { timeout: 30_000 });
    await pp.locator('[data-testid="store-product-card"]').first().waitFor({ timeout: 30_000 });
    await settle(pp, 1000);
    await shotM('21-vitrina');
    await shotM('21b-vitrina-completa', true);

    const camiseta = pp.locator('[data-testid="store-product-card"][data-product-name="Camiseta de entrenamiento"]');
    await camiseta.getByRole('link', { name: /Ver Camiseta de entrenamiento/ }).click();
    await pp.getByRole('heading', { name: 'Camiseta de entrenamiento' }).waitFor();
    await pp.getByRole('button', { name: 'Talla M', exact: true }).click();
    await settle(pp, 600);
    await shotM('22-ficha-talla');
    await shotM('22b-ficha-completa', true);
    await pp.getByRole('button', { name: 'Agregar al carrito' }).click();
    await settle(pp, 800);

    await go(pp, `/tienda/${SLUG}`);
    const termo = pp.locator('[data-testid="store-product-card"][data-product-name="Termo del club 750 ml"]');
    await termo.getByRole('button', { name: /Agregar Termo/ }).click();
    await settle(pp, 800);
    await shotM('23-barra-carrito');
    await go(pp, '/carrito');
    const pagar = pp.getByRole('button', { name: `Pagar en ${STORE}` });
    await pagar.waitFor({ timeout: 20_000 });
    await settle(pp, 800);
    await shotM('24-carrito', true);
    await pagar.click();

    await pp.waitForURL(/\/checkout\/tienda\//, { timeout: 30_000 });
    await pp.getByRole('radio', { name: /Transferencia bancaria/ }).click();
    await settle(pp, 800);
    await shotM('25-checkout');
    await shotM('25b-checkout-completo', true);
    await pp.locator('[data-testid="pay-button"]:visible').click();

    await pp.waitForURL(/\/mis-compras\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await pp.getByTestId('pickup-code').waitFor({ timeout: 20_000 });
    await settle(pp, 1000);
    const codigoT = (await pp.getByTestId('pickup-code').innerText()).trim();
    const refT = (await pp.getByRole('heading', { level: 1 }).innerText()).trim();
    await shotM('26-pedido-transferencia');
    await tall('26-pedido');

    // Comprobante
    const comp = await comprobantePng(browser, '103.000', refT);
    await pp.getByTestId('receipt-input').setInputFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: comp });
    await pp.getByTestId('awaiting-approval').waitFor({ timeout: 20_000 });
    await settle(pp, 800);
    await tall('27-esperando');

    await respiro('antes de la escuela');
    // La escuela: lista, detalle con comprobante, rechazar con motivo.
    await go(op, '/orders');
    const fila = op.locator(`[data-testid="seller-order-row"][data-ref="${refT}"]`);
    await fila.waitFor({ timeout: 30_000 });
    await shot(op, '30-pedidos-lista');
    await fila.getByRole('button', { name: `Ver pedido ${refT}` }).click();
    const det = op.getByTestId('seller-order-detail');
    await det.waitFor();
    await settle(op, 800);
    await shot(op, '31-pedido-detalle-comprobante');
    // El comprobante se abre en otra pestaña (URL firmada de 5 min).
    const [tab] = await Promise.all([op.context().waitForEvent('page'), det.getByRole('button', { name: 'Ver comprobante' }).click()]);
    await tab.waitForLoadState().catch(() => {}); await settle(tab, 800);
    await tab.screenshot({ path: path.join(SHOTS, '31b-comprobante-abierto.png') }); await tab.close();

    await det.getByRole('button', { name: 'Rechazar comprobante' }).click();
    await op.locator('#reason').fill('El valor transferido no coincide con el total del pedido.');
    await settle(op, 300);
    await shotEl(op.getByRole('dialog').last(), '32-rechazar-dialogo');
    await op.getByRole('button', { name: 'Confirmar' }).click();
    await settle(op, 2000);

    // El padre ve el rechazo y sube otro.
    await pp.reload(); await pp.waitForLoadState('networkidle').catch(() => {}); await settle(pp, 1500);
    await tall('28-rechazado');
    await pp.getByTestId('receipt-input').setInputFiles({ name: 'comprobante-2.png', mimeType: 'image/png', buffer: comp });
    await pp.getByTestId('awaiting-approval').waitFor({ timeout: 20_000 });

    await respiro('antes de aprobar');
    // La escuela aprueba, prepara, deja listo y entrega con el código.
    await go(op, '/orders');
    await fila.getByRole('button', { name: `Ver pedido ${refT}` }).click();
    await det.waitFor();
    await det.getByRole('button', { name: 'Aprobar pago' }).waitFor({ timeout: 20_000 });
    await det.getByRole('button', { name: 'Aprobar pago' }).click();
    await det.getByTestId('order-status').filter({ hasText: 'Pagado' }).waitFor({ timeout: 20_000 });
    await settle(op, 800);
    await shot(op, '33-pagado-preparar');
    await det.getByRole('button', { name: 'Preparar pedido' }).click();
    await det.getByTestId('order-status').filter({ hasText: 'En preparación' }).waitFor({ timeout: 20_000 });
    await det.getByRole('button', { name: 'Listo para retirar' }).click();
    await det.getByTestId('order-status').filter({ hasText: 'Listo para retirar' }).waitFor({ timeout: 20_000 });
    await settle(op, 800);
    await shot(op, '34-listo-para-retirar');

    await pp.reload(); await pp.waitForLoadState('networkidle').catch(() => {}); await settle(pp, 1500);
    await tall('29-listo');

    await respiro('antes de entregar');
    await det.getByRole('button', { name: 'Entregar con código' }).click();
    await op.locator('#pcode').fill(codigoT);
    await settle(op, 300);
    await shotEl(op.getByRole('dialog').last(), '35-entregar-codigo');
    await op.getByRole('button', { name: 'Confirmar' }).click();
    await det.getByTestId('order-status').filter({ hasText: 'Entregado' }).waitFor({ timeout: 20_000 });
    await settle(op, 800);
    await shot(op, '36-entregado-historial');
    await op.keyboard.press('Escape');

    await respiro('antes del efectivo');
    // Efectivo: rodilleras (último ítem) con código de retiro.
    await go(pp, `/tienda/${SLUG}`);
    const rod = pp.locator('[data-testid="store-product-card"][data-product-name="Rodilleras de voleibol (par)"]');
    await rod.getByRole('button', { name: /Agregar Rodilleras/ }).click();
    await settle(pp, 600);
    await go(pp, '/carrito');
    await pp.getByRole('button', { name: `Pagar en ${STORE}` }).click();
    await pp.waitForURL(/\/checkout\/tienda\//, { timeout: 30_000 });
    await pp.getByRole('radio', { name: /Efectivo al retirar/ }).click();
    await settle(pp, 600);
    await pp.locator('[data-testid="pay-button"]:visible').click();
    await pp.waitForURL(/\/mis-compras\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await pp.getByTestId('pickup-code').waitFor({ timeout: 20_000 });
    await settle(pp, 1000);
    const codigoE = (await pp.getByTestId('pickup-code').innerText()).trim();
    const refE = (await pp.getByRole('heading', { level: 1 }).innerText()).trim();
    await shotM('40-efectivo-codigo');
    await tall('40-efectivo');

    await respiro('antes de cobrar');
    await go(op, '/orders');
    const filaE = op.locator(`[data-testid="seller-order-row"][data-ref="${refE}"]`);
    await filaE.waitFor({ timeout: 30_000 });
    await filaE.getByRole('button', { name: 'Cobrar y entregar' }).click();
    await op.locator('#pcode').fill(codigoE);
    await settle(op, 300);
    await shotEl(op.getByRole('dialog').last(), '41-cobrar-efectivo');
    await op.getByRole('button', { name: 'Confirmar' }).click();
    await filaE.getByTestId('order-status').filter({ hasText: 'Entregado' }).waitFor({ timeout: 20_000 });

    // Cancelar: el pedido sin pagar más viejo de la lista (dato de corridas anteriores).
    const filaPend = op.locator('[data-testid="seller-order-row"]').filter({ hasText: 'Pendiente de pago' }).first();
    if (await filaPend.count()) {
      await filaPend.getByRole('button', { name: /^Ver pedido/ }).click();
      const det2 = op.getByTestId('seller-order-detail');
      await det2.getByRole('button', { name: 'Cancelar pedido' }).click();
      await op.locator('#reason').fill('La familia pidió cancelar: compró la talla equivocada.');
      await settle(op, 300);
      await shotEl(op.getByRole('dialog').last(), '42-cancelar-dialogo');
      await op.getByRole('button', { name: 'Confirmar' }).click();
      await settle(op, 1500);
      await op.keyboard.press('Escape');
    }
    await go(op, '/orders');
    await shot(op, '43-pedidos-al-final');

    await respiro('antes de Mis compras');
    // Mis compras (padre)
    await go(pp, `/mis-compras`);
    await pp.getByTestId('my-order-row').first().waitFor({ timeout: 20_000 });
    await settle(pp, 800);
    await shotM('44-mis-compras');
    await go(pp, `/mis-compras`);
    await pp.getByTestId('my-order-row').filter({ hasText: refT.slice(0, 12) }).first().click().catch(() => {});
    await settle(pp, 1500);
    await tall('45-entregada');

    console.log('✅ Capturas en', SHOTS, '\n', fs.readdirSync(SHOTS).filter((f) => f.endsWith('.png')).join('\n '));
  } finally {
    for (const c of ctxs) await c.close().catch(() => {});
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
