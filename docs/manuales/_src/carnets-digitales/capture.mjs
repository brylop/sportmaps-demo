// Capturas REALES para el manual "Carnets digitales: cómo generarlos y cómo les
// llegan a los padres" (docs/manuales/README.md, memoria feedback_pdf_manual_template:
// nunca mockups).
//
//   BASE_URL=https://dev.sportmaps.co node docs/manuales/_src/carnets-digitales/capture.mjs
//
// Tenant: Club Campestre Demo (is_demo=true). Cuentas y contraseña en
// scripts/demo-club-campestre/README.md. Deja en esa escuela demo: una plantilla
// de carnet y carnets emitidos (Tomás Herrera + la categoría Natación — Infantil).
// No toca ninguna escuela real. Reanudable: cada bloque que crea datos se salta
// si su captura ya existe.

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

const SCHOOL_ID = '25a123f0-6d57-48a4-9800-7b1531d61cd2'; // Club Campestre Demo
const PASSWORD = 'Demo2026!';
const ACCOUNTS = {
  owner:  'gerencia@demo.sportmaps.co',              // Ricardo Mendoza
  parent: 'mherrera@demo.sportmaps.co',              // Mauricio Herrera · Tomás (Fútbol Sub-15) + Sofía (Natación Infantil)
  coach:  'entrenadora.natacion@demo.sportmaps.co',  // Laura Gómez · Natación — Infantil
};
const BULK_TEAM = 'Fútbol — Sub-15';
const SINGLE = 'Tomás Herrera';
const TEMPLATE_NAME = 'Carnet 2026';

async function token(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login ${email}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function loginAs(context, email) {
  const session = await token(email);
  const ref = new URL(SUPABASE_URL).host.split('.')[0];
  await context.addInitScript(([key, value]) => {
    try { window.localStorage.setItem(key, value); } catch {}
  }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  return session;
}

const DESKTOP = { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 };
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function newSession(browser, email, device = DESKTOP) {
  const context = await browser.newContext({ ...device, locale: 'es-CO', acceptDownloads: true });
  if (email) await loginAs(context, email);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  return { context, page };
}

const has = (name) => fs.existsSync(path.join(SHOTS, name));
const snap = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, name), fullPage: false, ...opts });
const settle = (page, ms = 1200) => page.waitForTimeout(ms);

/** Carnets vigentes de la escuela demo, vía la RPC con el JWT del owner. */
async function listCards() {
  const s = await token(ACCOUNTS.owner);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/list_athlete_id_cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` },
    body: JSON.stringify({ p_school_id: SCHOOL_ID, p_status: 'active', p_search: null, p_limit: 200, p_offset: 0 }),
  });
  const d = await res.json();
  return d?.rows ?? [];
}

async function gotoCards(page, tab = '') {
  await page.goto(`${BASE_URL}/cards${tab ? `?tab=${tab}` : ''}`);
  await page.getByRole('heading', { name: /Carnets digitales/ }).waitFor({ timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  await settle(page);
}

async function run() {
  const browser = await chromium.launch();
  try {
    // ═══ OWNER ═══════════════════════════════════════════════════════════
    {
      const { context, page } = await newSession(browser, ACCOUNTS.owner);

      // 00 · Menú lateral con el grupo Carnets abierto
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
      await settle(page, 2000);
      const carnetsMenu = page.locator('nav, aside').getByText('Carnets', { exact: true }).first();
      await carnetsMenu.scrollIntoViewIfNeeded().catch(() => {});
      await carnetsMenu.click().catch(() => console.log('no se pudo abrir el menú Carnets'));
      await settle(page, 700);
      await snap(page, '00-owner-menu.png');

      // 01-03 · Plantillas: vacío, editor lleno, reverso, lista
      if (!has('02b-plantilla-reverso.png')) {
        await gotoCards(page, 'templates');
        await page.getByText('Plantillas de la escuela').waitFor();
        await settle(page, 800);
        await snap(page, '01-plantillas-vacio.png');

        await page.getByRole('button', { name: 'Federación' }).click();
        await page.getByPlaceholder('Carnet 2026').fill(TEMPLATE_NAME);
        await page.getByPlaceholder('Carnet deportivo').fill('Carnet deportivo 2026');
        // Color del club
        await page.getByPlaceholder('#0ea5e9').fill('#1c5c34');
        await page.getByPlaceholder('Automático (tono oscuro del principal)').fill('#0c1f10');
        for (const lbl of ['RH (tipo de sangre)', 'EPS', 'Contacto de emergencia']) {
          const box = page.locator('label', { hasText: lbl }).locator('input[type="checkbox"]');
          if (!(await box.isChecked())) await box.check();
        }
        const def = page.locator('label', { hasText: 'Predeterminada' }).locator('input[type="checkbox"]');
        if (!(await def.isChecked())) await def.check();
        await settle(page, 800);
        await snap(page, '02-plantilla-editor.png', { fullPage: true });
        await page.getByRole('button', { name: /Ver reverso/ }).click();
        await settle(page, 600);
        await snap(page, '02b-plantilla-reverso.png', { fullPage: true });
        await page.getByRole('button', { name: /Ver frente/ }).click();
        await page.getByRole('button', { name: /Crear plantilla/ }).click();
        await settle(page, 3000);
      }
      if (!has('03-plantilla-creada.png')) {
        await gotoCards(page, 'templates');
        await page.getByText('Plantillas de la escuela').waitFor();
        await page.getByText('Predeterminada').first().waitFor({ timeout: 15_000 });
        await settle(page, 1200);
        await snap(page, '03-plantilla-creada.png');
      }

      // 04 · Emitir nuevo: lista y cobertura (antes de emitir)
      await gotoCards(page);
      if (!has('04-emitir-lista.png')) await snap(page, '04-emitir-lista.png');

      // 05 · Filtro por equipo abierto
      if (!has('05-filtro-equipo.png')) {
        await page.getByRole('combobox').filter({ hasText: 'Todos los equipos' }).first().click();
        await settle(page, 500);
        await snap(page, '05-filtro-equipo.png');
        await page.keyboard.press('Escape');
        await settle(page, 300);
      }

      // 06-08 · Emisión individual + vista previa frente/reverso
      if (!has('08-preview-reverso.png')) {
        await page.getByPlaceholder('Buscar por nombre o documento…').fill(SINGLE);
        await page.getByRole('row', { name: new RegExp(SINGLE) }).first().waitFor({ timeout: 15_000 });
        await settle(page, 800);
        await page.getByRole('row', { name: new RegExp(SINGLE) }).first().getByRole('button', { name: /Emitir|Renovar|Reemitir/ }).click();
        const dlg = page.getByRole('dialog');
        await dlg.getByText('Emitir carnet').waitFor();
        await settle(page, 600);
        if (!has('06-dialogo-emitir.png')) await snap(page, '06-dialogo-emitir.png');
        // Elegir la plantilla A MANO: con "Predeterminada de la escuela" el carnet
        // sale sin plantilla (la RPC no resuelve la predeterminada).
        await dlg.getByRole('combobox').first().click();
        await settle(page, 400);
        await snap(page, '06b-plantilla-select.png');
        await page.getByRole('option', { name: new RegExp(TEMPLATE_NAME) }).click();
        await settle(page, 400);
        await snap(page, '06c-dialogo-reemitir.png');
        await dlg.getByRole('button', { name: 'Emitir', exact: true }).click();
        await page.getByRole('dialog').getByText('Vista previa del carnet').waitFor({ timeout: 20_000 });
        await page.getByRole('button', { name: /Ver reverso/ }).waitFor({ timeout: 20_000 });
        await settle(page, 2000);
        await snap(page, '07-preview-frente.png');
        await page.getByRole('button', { name: /Ver reverso/ }).click();
        await settle(page, 800);
        await snap(page, '08-preview-reverso.png');
        await page.keyboard.press('Escape');
        await settle(page, 500);
        await page.getByPlaceholder('Buscar por nombre o documento…').fill('');
        await settle(page, 1200);
      }

      // 09-10 · Emisión en lote: filtro de equipo + "Sin carnet" + seleccionar + emitir
      if (!has('09-lote-seleccion.png')) {
        await gotoCards(page);
        await page.getByRole('combobox').filter({ hasText: 'Todos los equipos' }).first().click();
        await page.getByRole('option', { name: BULK_TEAM }).click();
        await settle(page, 1500);
        await page.getByText('Sin carnet', { exact: true }).first().click();
        await settle(page, 1500);
        await page.getByRole('button', { name: /Seleccionar esta página/ }).click();
        await settle(page, 600);
        await snap(page, '09-lote-seleccion.png');
        await page.getByRole('button', { name: /Emitir seleccionados/ }).click();
        await page.getByText(/Emitidos \d+ carnet/).first().waitFor({ timeout: 60_000 });
        await settle(page, 400);
        await snap(page, '10-lote-emitido.png');
      }
      // Cobertura del equipo después del lote (se puede repetir sin emitir nada).
      if (!has('10b-lote-cobertura.png')) {
        await gotoCards(page);
        await page.getByRole('combobox').filter({ hasText: 'Todos los equipos' }).first().click();
        await page.getByRole('option', { name: BULK_TEAM }).click();
        await settle(page, 2000);
        await snap(page, '10b-lote-cobertura.png');
      }

      // 11-12 · Carnets emitidos + descarga PDF por equipo
      if (!has('12-pdf-equipo.png')) {
        // Se entra por "Emitir nuevo" y se cambia de pestaña: la lista de equipos del
        // PDF sale de la carga de atletas (entrando directo a ?tab=cards queda vacía).
        await gotoCards(page);
        await page.getByRole('tab', { name: 'Carnets emitidos' }).click();
        await page.getByRole('button', { name: 'Ver' }).first().waitFor({ timeout: 20_000 });
        await settle(page, 1000);
        await snap(page, '11-carnets-emitidos.png');
        await page.getByRole('combobox').filter({ hasText: 'Todos los equipos' }).first().click();
        await page.getByRole('option', { name: BULK_TEAM }).click();
        await settle(page, 500);
        const dl = page.waitForEvent('download', { timeout: 120_000 });
        await page.getByRole('button', { name: /Descargar PDF/ }).click();
        await settle(page, 700);
        await snap(page, '11b-pdf-generando.png');
        const d = await dl;
        await d.saveAs(path.join(SHOTS, 'carnets-equipo.pdf'));
        await settle(page, 800);
        await snap(page, '12-pdf-equipo.png');
      }

      // 13-14 · "Enviar al padre": sin Web Share (como en un computador), abre wa.me
      if (!has('14-whatsapp-compartir.png')) {
        await gotoCards(page, 'cards');
        await page.getByPlaceholder('Buscar atleta…').fill(SINGLE);
        await settle(page, 1500);
        await page.getByRole('button', { name: 'Ver' }).first().click();
        await page.getByRole('button', { name: /Enviar al padre/ }).waitFor();
        await page.getByRole('button', { name: /Ver reverso/ }).waitFor({ timeout: 20_000 });
        await settle(page, 1500);
        await page.getByRole('button', { name: /Enviar al padre/ }).hover();
        await settle(page, 300);
        await snap(page, '13-enviar-al-padre.png');
        await page.evaluate(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch {} });
        const popupP = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null);
        await page.getByRole('button', { name: /Enviar al padre/ }).click();
        const popup = await popupP;
        if (popup) {
          console.log('popup url', popup.url());
          await popup.waitForLoadState('domcontentloaded').catch(() => {});
          await popup.waitForTimeout(4000);
          console.log('popup final url', popup.url());
          fs.writeFileSync(path.join(SHOTS, 'share-url.txt'), popup.url());
          await popup.screenshot({ path: path.join(SHOTS, '14-whatsapp-compartir.png') });
          await popup.close();
        }
      }
      await context.close();
    }

    const cards = await listCards();
    const tomas = cards.find((c) => c.athlete_name === SINGLE);
    if (!tomas) throw new Error('No encontré el carnet de ' + SINGLE);
    fs.writeFileSync(path.join(SHOTS, 'token.txt'), tomas.qr_token);
    const publicUrl = `${BASE_URL}/c/${tomas.qr_token}`;

    // ═══ PADRE ═══════════════════════════════════════════════════════════
    {
      const { context, page } = await newSession(browser, ACCOUNTS.parent);
      await page.goto(`${BASE_URL}/my-cards`);
      await page.getByRole('heading', { name: /Mis carnets/ }).waitFor({ timeout: 30_000 });
      await page.waitForLoadState('networkidle');
      await page.getByText(SINGLE).first().waitFor({ timeout: 20_000 });
      await settle(page, 1500);
      await snap(page, '20-padre-mis-carnets.png');
      // La tarjeta VIGENTE (la lista también muestra la versión revocada).
      await page.locator('div.cursor-pointer', { hasText: SINGLE }).filter({ hasText: 'Vigente' }).first().click();
      await page.getByRole('button', { name: /Abrir público/ }).waitFor();
      await settle(page, 2500);
      await snap(page, '21-padre-preview.png');
      await context.close();
    }
    {
      const { context, page } = await newSession(browser, ACCOUNTS.parent, MOBILE);
      await page.goto(`${BASE_URL}/my-cards`);
      await page.getByText(SINGLE).first().waitFor({ timeout: 30_000 });
      await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalHeight > 0), null, { timeout: 20_000 }).catch(() => {});
      await settle(page, 2500);
      await snap(page, '22-padre-movil-carnets.png');
      // menú del celular: el botón de la esquina superior izquierda abre el lateral
      const burger = page.locator('header button').first();
      if (await burger.count()) {
        await burger.click().catch(() => {});
        await settle(page, 800);
        await page.getByText('Carnets de mis hijos').first().scrollIntoViewIfNeeded().catch(() => {});
        await settle(page, 400);
        await snap(page, '23-padre-movil-menu.png');
      }
      await context.close();
    }

    // ═══ PÁGINA PÚBLICA (sin sesión, como la abre quien recibe el link) ════
    {
      const { context, page } = await newSession(browser, null, MOBILE);
      await page.goto(publicUrl);
      await page.getByText('Carnet verificado').waitFor({ timeout: 30_000 });
      await settle(page, 2500);
      await snap(page, '30-publico-movil.png', { fullPage: true });
      await context.close();
    }

    // ═══ COACH ═══════════════════════════════════════════════════════════
    {
      const { context, page } = await newSession(browser, ACCOUNTS.coach);
      await page.goto(`${BASE_URL}/coach-attendance`);
      await page.getByRole('button', { name: /Escanear carnet/ }).waitFor({ timeout: 30_000 });
      await settle(page, 1500);
      await snap(page, '40-coach-asistencias.png');
      await page.goto(`${BASE_URL}/coach-attendance/scan`);
      await page.getByText('Check-in por carnet').waitFor({ timeout: 30_000 });
      await settle(page, 1000);
      await snap(page, '41-coach-scan.png');
      await context.close();
    }
    {
      // Alto extra: el panel de staff queda debajo de la barra inferior fija.
      const { context, page } = await newSession(browser, ACCOUNTS.coach, { ...MOBILE, viewport: { width: 390, height: 1240 } });
      await page.goto(publicUrl);
      await page.getByText('Panel de staff').waitFor({ timeout: 30_000 });
      await settle(page, 2000);
      await page.getByRole('button', { name: /Marcar asistencia/ }).scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, 120));
      await settle(page, 500);
      await snap(page, '42-coach-publico-staff.png');
      await context.close();
    }

    console.log('✅ Capturas en', SHOTS, fs.readdirSync(SHOTS));
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
