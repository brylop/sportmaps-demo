// Capturas REALES para el manual de Contabilidad (docs/manuales/README.md,
// memoria feedback_pdf_manual_template: nunca mockups).
//
//   node docs/manuales/_src/manual-contabilidad/capture.mjs            # todo
//   ONLY=04,05 node docs/manuales/_src/manual-contabilidad/capture.mjs # solo esas
//
// Ambiente: https://dev.sportmaps.co (BASE_URL para cambiarlo). Tenant demo
// Club Campestre Demo (25a123f0-…), con el addon 'accounting' prendido SOLO
// para esta escuela. Crea datos de ejemplo por la interfaz (un gasto con
// comprobante, un proveedor, una factura con un abono, un empleado, una nómina
// en BORRADOR y un presupuesto). Es reanudable: si ya existe la captura de un
// paso que escribe, NO se repite la escritura (si no, duplica filas).
// Nunca paga la nómina, nunca aprueba cobros, nunca toca facturación electrónica.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'https://dev.sportmaps.co';
const SHOTS = path.join(here, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const want = (id) => !ONLY || ONLY.has(id);
const has = (name) => fs.existsSync(path.join(SHOTS, name));

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
const ACCOUNTS = {
  owner: 'gerencia@demo.sportmaps.co',          // Ricardo Mendoza
  coach: 'entrenador.tenis@demo.sportmaps.co',  // Felipe Torres
};

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

async function newSession(browser, email) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, locale: 'es-CO', acceptDownloads: true });
  await loginAs(context, email);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  return { context, page };
}

const snap = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, name), fullPage: false, ...opts });
// La app scrollea dentro de <main>, así que fullPage no sirve: se agranda el
// viewport para las pantallas largas y se vuelve a 1600×1000.
async function snapTall(page, name, h = 2200) {
  await page.setViewportSize({ width: 1600, height: h });
  await settle(page, 1500);
  await snap(page, name);
  await page.setViewportSize({ width: 1600, height: 1000 });
}
const settle = (page, ms = 1200) => page.waitForTimeout(ms);
async function go(page, route, heading) {
  await page.goto(`${BASE_URL}${route}`);
  if (heading) await page.getByRole('heading', { name: heading }).first().waitFor({ timeout: 40_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await settle(page, 1500);
}
// Radix Select dentro de un diálogo: el combobox n-ésimo y la opción por texto.
async function pick(page, scope, index, optionName) {
  await scope.getByRole('combobox').nth(index).click();
  await page.getByRole('option', { name: optionName }).first().click();
  await settle(page, 250);
}
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// Comprobante de ejemplo (una imagen real, generada aquí).
async function makeReceipt(browser) {
  const fp = path.join(SHOTS, 'comprobante-ejemplo.png');
  if (fs.existsSync(fp)) return fp;
  const p = await browser.newPage({ viewport: { width: 600, height: 420 } });
  await p.setContent(`<div style="font-family:Arial;padding:28px;border:2px solid #333;margin:10px">
    <h2 style="margin:0">Inmobiliaria Los Robles S.A.S.</h2><p>NIT 900.555.123-4</p>
    <p><b>Cuenta de cobro N.º 2210</b></p><p>Arriendo octubre 2026 — cancha de tenis 3</p>
    <p style="font-size:22px"><b>Total: $1.900.000</b></p><p>Pagado por transferencia · ref. TRF-88231</p></div>`);
  await p.screenshot({ path: fp });
  await p.close();
  return fp;
}

async function run() {
  const browser = await chromium.launch();
  try {
    const receipt = await makeReceipt(browser);
    const { context, page } = await newSession(browser, ACCOUNTS.owner);

    // ── 01 · Menú + panel (Ingresos del mes) ───────────────────────────
    if (want('01')) {
      await go(page, '/dashboard');
      await settle(page, 2500);
      // Abrir el submenú Contabilidad si está colapsado.
      await page.getByRole('button', { name: /^Contabilidad$/ }).first().click({ timeout: 5000 }).catch(() => {});
      await settle(page, 600);
      await snap(page, '01-panel-owner.png');
    }

    // ── 02 · Libro de caja del mes en curso (antes del gasto) ───────────
    if (want('02')) {
      await go(page, '/accounting', /Contabilidad/);
      await snap(page, '02-libro-mes.png');
    }

    // ── 03/04 · Registrar gasto con comprobante ────────────────────────
    if (want('03') && !has('04-libro-con-gasto.png')) {
      await go(page, '/accounting', /Contabilidad/);
      await page.getByRole('button', { name: /Registrar gasto/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.waitFor();
      await pick(page, dlg, 0, 'Arriendo de sede');
      await dlg.getByPlaceholder(/Arriendo julio/).fill('Arriendo octubre — cancha de tenis 3');
      await dlg.locator('input[type="number"]').fill('1900000');
      await dlg.getByPlaceholder('# comprobante').fill('TRF-88231');
      await dlg.locator('textarea').fill('Cuenta de cobro 2210 de Inmobiliaria Los Robles.');
      await dlg.locator('input[type="file"]').setInputFiles(receipt);
      await settle(page, 500);
      await snap(page, '03-dialogo-gasto.png');
      await dlg.getByRole('button', { name: /Guardar gasto/ }).click();
      await page.getByText('Gasto registrado').first().waitFor({ timeout: 20_000 }).catch(() => {});
      await settle(page, 2500);
      await snap(page, '04-libro-con-gasto.png');
    }

    // ── 05 · Un mes con más de 50 movimientos: "Cargar más" ────────────
    if (want('05')) {
      await go(page, '/accounting', /Contabilidad/);
      await page.locator('#ledger-month').fill('2026-06');
      await settle(page, 3000);
      await snap(page, '05-libro-junio-top.png');
      const more = page.getByRole('button', { name: /Cargar más/ });
      await more.scrollIntoViewIfNeeded();
      await settle(page, 800);
      await snap(page, '05-cargar-mas.png');
      await more.click();
      await settle(page, 2500);
      await page.getByText(/52 de 52/).scrollIntoViewIfNeeded().catch(() => {});
      await settle(page, 800);
      await snap(page, '05-cargar-mas-despues.png');
    }

    // ── 06 · Pestaña facturación electrónica (sin addon) ───────────────
    if (want('06')) {
      await go(page, '/accounting', /Contabilidad/);
      await page.getByRole('tab', { name: /Facturación electrónica/ }).click();
      await settle(page, 1200);
      await snap(page, '06-tab-facturacion.png');
    }

    // ── 07-11 · Proveedores, factura y abono ───────────────────────────
    if (want('07')) {
      await go(page, '/accounting/suppliers', /Proveedores/);
      await snap(page, '07-proveedores-vacio.png');
    }
    if (want('08') && !has('08-dialogo-proveedor.png')) {
      await go(page, '/accounting/suppliers', /Proveedores/);
      await page.getByRole('button', { name: /^Proveedor$/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.waitFor();
      const inputs = dlg.locator('input');
      await inputs.nth(0).fill('Deportes El Campeón S.A.S.');
      await inputs.nth(1).fill('900123456');
      await inputs.nth(2).fill('3104567890');
      await inputs.nth(3).fill('Luis Pardo');
      await inputs.nth(4).fill('ventas@elcampeon.example.com');
      await settle(page, 400);
      await snap(page, '08-dialogo-proveedor.png');
      await dlg.getByRole('button', { name: /Guardar/ }).click();
      await page.getByText('Proveedor agregado').first().waitFor({ timeout: 20_000 }).catch(() => {});
      await settle(page, 1500);
    }
    if (want('09') && !has('09-dialogo-factura.png')) {
      await go(page, '/accounting/suppliers', /Proveedores/);
      await page.getByRole('button', { name: /^Factura$/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.waitFor();
      await pick(page, dlg, 0, 'Deportes El Campeón S.A.S.');
      const inputs = dlg.locator('input');
      await inputs.nth(0).fill('FE-1043');
      await dlg.locator('input[type="number"]').fill('1850000');
      await pick(page, dlg, 1, 'Insumos deportivos');
      await dlg.locator('input[type="date"]').nth(1).fill(addDays(30));
      await settle(page, 400);
      await snap(page, '09-dialogo-factura.png');
      await dlg.getByRole('button', { name: /Guardar/ }).click();
      await page.getByText('Factura registrada').first().waitFor({ timeout: 20_000 }).catch(() => {});
      await settle(page, 1500);
    }
    if (want('10') && !has('10-dialogo-abono.png')) {
      await go(page, '/accounting/suppliers', /Proveedores/);
      await page.getByRole('row', { name: /FE-1043/ }).getByRole('button', { name: /Pagar/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.waitFor();
      await dlg.locator('input[type="number"]').fill('800000');
      await dlg.getByText('Referencia', { exact: true }).locator('..').locator('input').fill('TRF-2210');
      await settle(page, 400);
      await snap(page, '10-dialogo-abono.png');
      await dlg.getByRole('button', { name: /^Pagar$/ }).click();
      await page.getByText('Pago registrado').first().waitFor({ timeout: 20_000 }).catch(() => {});
      await settle(page, 1500);
    }
    if (want('11')) {
      await go(page, '/accounting/suppliers', /Proveedores/);
      await snap(page, '11-proveedores-con-factura.png');
    }

    // ── 12-15 · Nómina ─────────────────────────────────────────────────
    if (want('12') && !has('12-dialogo-empleado.png')) {
      await go(page, '/accounting/payroll', /Nómina/);
      await page.getByRole('tab', { name: 'Empleados' }).click();
      await settle(page, 800);
      await page.getByRole('button', { name: /^Empleado$/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.waitFor();
      const inputs = dlg.locator('input');
      await inputs.nth(0).fill('Andrea Molina Ruiz');
      await inputs.nth(1).fill('1020456789');
      await dlg.locator('input[type="number"]').fill('2100000');
      await dlg.getByText('EPS (opcional)').locator('..').locator('input').fill('Sura');
      await dlg.getByText('AFP (opcional)').locator('..').locator('input').fill('Porvenir');
      await settle(page, 400);
      await snap(page, '12-dialogo-empleado.png');
      await dlg.getByRole('button', { name: /Guardar/ }).click();
      await page.getByText('Empleado agregado').first().waitFor({ timeout: 20_000 }).catch(() => {});
      await settle(page, 1500);
    }
    if (want('13')) {
      await go(page, '/accounting/payroll', /Nómina/);
      await page.getByRole('tab', { name: 'Empleados' }).click();
      await settle(page, 1200);
      await snap(page, '13-empleados.png');
    }
    if (want('14') && !has('14-nomina-borrador.png')) {
      await go(page, '/accounting/payroll', /Nómina/);
      // Mes y año por defecto = el actual. Calcula y deja BORRADOR (no se paga).
      await page.getByRole('button', { name: /Calcular nómina/ }).click();
      await page.getByText('Nómina calculada').first().waitFor({ timeout: 25_000 }).catch(() => {});
      await settle(page, 2500);
      await snap(page, '14-nomina-borrador.png');
      await snapTall(page, '14-nomina-borrador-full.png', 1700);
    }

    // ── 15/16 · Presupuesto ────────────────────────────────────────────
    if (want('15') && !has('16-presupuesto-guardado.png')) {
      await go(page, '/accounting/budget', /Presupuesto/);
      const setBudget = async (cat, val) => {
        await page.getByRole('row', { name: new RegExp('^' + cat) }).locator('input').fill(val);
      };
      await setBudget('Arriendo de sede', '28800000');
      await setBudget('Servicios públicos', '10800000');
      await setBudget('Insumos deportivos', '4000000');
      await setBudget('Marketing', '3000000');
      await settle(page, 600);
      await snap(page, '15-presupuesto-editando.png');
      await page.getByRole('button', { name: /Guardar/ }).click();
      await page.getByText('Presupuesto guardado').first().waitFor({ timeout: 20_000 }).catch(() => {});
      await settle(page, 2000);
      await snapTall(page, '16-presupuesto-guardado.png', 1700);
    }

    // ── 17 · Estado de resultados + export CSV ─────────────────────────
    if (want('17')) {
      await go(page, '/accounting/reports', /Estado de resultados/);
      await settle(page, 2000);
      await snapTall(page, '17-estado-resultados.png', 1900);
      const dl = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
      await page.getByRole('button', { name: /Exportar CSV/ }).click();
      const d = await dl;
      if (d) await d.saveAs(path.join(SHOTS, 'estado-resultados.csv'));
    }

    // ── 18 · Invitar al contador (solo se llena; NO se envía) ──────────
    if (want('18')) {
      await go(page, '/invitations');
      await page.getByRole('button', { name: /Nueva Invitación/ }).first().click();
      const dlg = page.getByRole('dialog');
      await dlg.waitFor();
      await dlg.getByRole('button', { name: /Contador/ }).click();
      await settle(page, 800);
      await snap(page, '18-invitar-contador.png');
      await page.keyboard.press('Escape');
    }

    // ── 19 · Gestión de pagos: KPIs (misma fórmula) ────────────────────
    if (want('19')) {
      await go(page, '/payments-automation');
      await settle(page, 2500);
      await snap(page, '19-gestion-pagos.png');
    }
    // ── 22 · Libro del mes al final: gasto + abono al proveedor ───────
    if (want('22')) {
      await go(page, '/accounting', /Contabilidad/);
      await snap(page, '22-libro-octubre-final.png');
    }
    await context.close();

    // ── 20/21 · Coach: sin dinero ──────────────────────────────────────
    if (want('20')) {
      const c = await newSession(browser, ACCOUNTS.coach);
      await go(c.page, '/dashboard');
      await settle(c.page, 2500);
      // El coach demo tiene el perfil profesional sin completar: cerrar el modal.
      await c.page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click({ timeout: 5000 }).catch(() => {});
      await c.page.waitForFunction(() => !document.body.innerText.includes('Cargando datos'), null, { timeout: 45_000 }).catch(() => {});
      await settle(c.page, 1500);
      await snap(c.page, '20-coach-panel.png');
      await c.page.goto(`${BASE_URL}/accounting`);
      await settle(c.page, 4000);
      await snap(c.page, '21-coach-accounting.png');
      await c.context.close();
    }

    console.log('Capturas en', SHOTS, fs.readdirSync(SHOTS));
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
