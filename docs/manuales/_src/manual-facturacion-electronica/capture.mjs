// Capturas REALES para el manual "Facturación electrónica" (docs/manuales/README.md,
// memoria feedback_pdf_manual_template: nunca mockups).
//
//   BASE_URL=https://dev.sportmaps.co node docs/manuales/_src/manual-facturacion-electronica/capture.mjs
//   ONLY=03,04 …   → rehace solo esas capturas
//
// Tenant: Club Campestre Demo (is_demo=true), owner gerencia@demo.sportmaps.co.
// La demo NO tiene facturador configurado ni configuración sandbox de Factus, así
// que este script es de SOLO LECTURA: abre pantallas y diálogos, llena el
// formulario del facturador con valores de EJEMPLO para la captura y CANCELA.
// Nunca pulsa Guardar ni Emitir. Para que la página exista hay que prender el
// addon 'invoicing' de la demo durante la corrida (y apagarlo al terminar).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'https://dev.sportmaps.co';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (id) => !ONLY || ONLY.includes(id);
const SHOTS = path.join(here, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

function readEnv() {
  const env = {};
  for (const f of ['.env', '.env.local']) {
    const fp = path.join(repo, 'frontend', f);
    if (!fs.existsSync(fp)) continue;
    for (const line of fs.readFileSync(fp, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#]*)"?\s*$/);
      if (m) env[m[1]] = m[2].trim();
    }
  }
  return env;
}
const ENV = readEnv();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ENV.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ENV.VITE_SUPABASE_PUBLISHABLE_KEY || ENV.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY en frontend/.env');

const PASSWORD = 'Demo2026!';
const OWNER = 'gerencia@demo.sportmaps.co';

async function loginAs(context, email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login ${email}: ${res.status} ${await res.text()}`);
  const session = await res.json();
  const ref = new URL(SUPABASE_URL).host.split('.')[0];
  await context.addInitScript(([key, value]) => {
    try { window.localStorage.setItem(key, value); } catch {}
  }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
}

const snap = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, name), fullPage: false, ...opts });
const settle = (page, ms = 1500) => page.waitForTimeout(ms);

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, locale: 'es-CO' });
  await loginAs(context, OWNER);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  try {
    await page.goto(`${BASE_URL}/facturacion-electronica`);
    await page.getByText('Facturador electrónico').first().waitFor({ timeout: 45_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await settle(page, 2500);

    if (want('01')) await snap(page, '01-pagina.png');
    if (want('02')) await snap(page, '02-pagina-full.png', { fullPage: true });

    // 03-04 · Diálogo de configuración: vacío y con valores de EJEMPLO. Se cancela.
    if (want('03') || want('04')) {
      await page.getByRole('button', { name: /^Configurar$/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByText('Configurar facturador electrónico').waitFor();
      await settle(page, 600);
      if (want('03')) await snap(page, '03-config-vacio.png');
      const inputs = dlg.locator('input');
      // Orden del formulario: client id, secret, usuario, contraseña, rango, rango NC, municipio.
      await inputs.nth(0).fill('ejemplo-client-id');
      await inputs.nth(1).fill('xxxxxxxxxxxx');
      await inputs.nth(2).fill('facturacion@miescuela.co');
      await inputs.nth(3).fill('xxxxxxxxxx');
      await inputs.nth(4).fill('8');
      await inputs.nth(5).fill('9');
      await inputs.nth(6).fill('11001');
      await settle(page, 500);
      if (want('04')) await snap(page, '04-config-lleno.png');
      await dlg.getByRole('button', { name: 'Cancelar' }).click();
      await settle(page, 600);
    }

    // 05-06 · Pestaña "Datos fiscales faltantes" y el diálogo para completar.
    if (want('05') || want('06')) {
      await page.getByRole('tab', { name: /Datos fiscales faltantes/ }).click();
      await settle(page, 3000);
      if (want('05')) await snap(page, '05-faltantes.png');
      if (want('05')) await snap(page, '05-faltantes-full.png', { fullPage: true });
      if (want('06')) {
        const btn = page.getByRole('button', { name: /Completar|Editar datos|Llenar/ }).first();
        if (await btn.count()) {
          await btn.click();
          await page.getByRole('dialog').waitFor({ timeout: 10_000 });
          await settle(page, 1200);
          await snap(page, '06-completar-datos.png');
          await page.keyboard.press('Escape');
        } else {
          console.log('06: no hay botón para completar datos');
        }
      }
    }
    // 07 · Tabla de pagadores con datos faltantes (scroll hasta la tabla).
    if (want('07')) {
      await page.getByRole('tab', { name: /Datos fiscales faltantes/ }).click();
      await settle(page, 2500);
      await page.getByText('Pagador', { exact: true }).first().scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 200);
      await settle(page, 800);
      await snap(page, '07-faltantes-tabla.png');
    }

    // 08 · Facturas emitidas (estado vacío), al final de la pestaña.
    if (want('08')) {
      await page.getByRole('tab', { name: /Facturas emitidas/ }).click();
      await settle(page, 1500);
      await page.getByText('Aún no hay facturas emitidas.').scrollIntoViewIfNeeded();
      await settle(page, 800);
      await snap(page, '08-emitidas-vacio.png');
    }

    // 09 · Menú Finanzas desplegado (dónde vive Facturación electrónica).
    if (want('09')) {
      await page.goto(`${BASE_URL}/facturacion-electronica`);
      await page.getByText('Facturador electrónico').first().waitFor({ timeout: 45_000 });
      await settle(page, 1500);
      await page.getByText(/^Finanzas$/i).first().click();
      await settle(page, 1000);
      await page.getByText(/^Contabilidad$/).first().click();
      await settle(page, 1000);
      await snap(page, '09-menu-finanzas.png');
    }

    // 10-11 · Pagos → registrar pago manual: el interruptor "¿Desea factura
    // electrónica?". Se abre el modal y se CIERRA sin registrar nada.
    if (want('10') || want('11')) {
      await page.goto(`${BASE_URL}/payments-automation`);
      await page.waitForLoadState('networkidle').catch(() => {});
      await settle(page, 3000);
      if (want('10')) await snap(page, '10-pagos.png');
      if (want('11')) {
        const btn = page.getByRole('button', { name: /Registrar pago|Registrar Pago|Pago manual|Registrar/ }).first();
        await btn.click();
        const dlg = page.getByRole('dialog');
        await dlg.waitFor({ timeout: 10_000 });
        await settle(page, 1500);
        await snap(page, '11a-modal.png');
        // Elegir el primer deportista del selector para que aparezca el bloque DIAN.
        const combo = dlg.locator('[role="combobox"]').first();
        if (await combo.count()) {
          await combo.click();
          await settle(page, 800);
          await page.getByRole('option').first().click().catch(() => {});
          await settle(page, 2500);
        }
        if (await page.getByPlaceholder('Buscar deportista...').count()) {
          await page.getByText('Padre: Óscar Moreno').first().click();
          await settle(page, 2500);
        }
        await page.getByText(/factura electrónica|código DANE/i).first().scrollIntoViewIfNeeded().catch(() => {});
        await settle(page, 600);
        await snap(page, '11-modal-factura.png');
        await page.keyboard.press('Escape');
      }
    }

    // 12 · Escuela CON Contabilidad: la misma pantalla vive como pestaña en
    // Contabilidad (el ítem suelto del menú se oculta, hideIfAddon).
    if (want('12')) {
      await page.goto(`${BASE_URL}/accounting`);
      await page.getByRole('tab', { name: /Facturación electrónica/ }).waitFor({ timeout: 45_000 });
      await settle(page, 1500);
      await page.getByRole('tab', { name: /Facturación electrónica/ }).click();
      await page.getByText('Facturador electrónico').first().waitFor({ timeout: 20_000 });
      await settle(page, 2000);
      await snap(page, '12-contabilidad-tab.png');
    }

    console.log('✅ Capturas en', SHOTS, fs.readdirSync(SHOTS));
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
