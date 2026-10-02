// Capturas REALES para el manual "Mesociclo del mes siguiente y sesiones por día"
// (Club Carmel / Besser, 2026-10-02). Nunca mockups: memoria feedback_pdf_manual_template.
//
//   BASE_URL=https://stg.sportmaps.co node docs/manuales/_src/mesociclo-mes-siguiente/capture.mjs
//
// Tenant demo "Club Campestre Demo" (is_demo=true), coach de tenis, equipo
// "Tenis — Adultos": tiene el mesociclo de septiembre (31 ago → 28 sep), igual
// que la categoría de Carmel que no podía crear octubre.
//
// ESCRIBE en el demo (a propósito, es el recorrido real): crea el mesociclo
// de octubre, una sesión el domingo 4 y engancha la sesión suelta del sábado 3
// ("Técnica de saque y devolución", sembrada por SQL antes de correr, sin día,
// como la del entrenador de arqueros). Reanudable: si octubre ya existe, no
// lo vuelve a crear.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'https://stg.sportmaps.co';
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
const COACH = 'entrenador.tenis@demo.sportmaps.co';
const TEAM = 'Tenis — Adultos';

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
const settle = (page, ms = 1200) => page.waitForTimeout(ms);

async function openTeam(page) {
  await page.goto(`${BASE_URL}/training-plans`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByRole('combobox').first().click({ timeout: 30_000 });
  await page.getByRole('option', { name: TEAM }).first().click();
  await page.getByText(/Mesociclo —|Sin mesociclo activo/).first().waitFor({ timeout: 30_000 });
  await settle(page, 1800);
}

/** Lleva un elemento a ~120px del borde superior del viewport (para la foto). */
async function bringTo(page, locator, top = 120) {
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(([y]) => window.scrollBy(0, -y), [top]);
  await settle(page, 500);
}

// 08 · En celular: la semana 1 con sus días. La página scrollea dentro de un
// contenedor (no window), así que se fotografía la región de la semana.
async function mobileShot(browser) {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'es-CO', timezoneId: 'America/Bogota' });
  await loginAs(mobile, COACH);
  const m = await mobile.newPage();
  await openTeam(m);
  const week = m.getByRole('region').filter({ hasText: /dom 4/i }).first();
  await week.scrollIntoViewIfNeeded();
  await settle(m, 600);
  // Solo los primeros días: sáb 3 (enganchada) y dom 4 (creada) son los que importan.
  const box = await week.boundingBox();
  await week.screenshot({ path: path.join(SHOTS, '08-celular-semana.png'), clip: undefined });
  console.log('[08] región', box);
  await mobile.close();
}

async function run() {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, locale: 'es-CO', timezoneId: 'America/Bogota' });
    await loginAs(context, COACH);
    const page = await context.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));

    // ONLY=01,08 → rehacer solo esas capturas (con octubre ya creado).
    const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
    if (ONLY.length) {
      if (ONLY.includes('01')) {
        await openTeam(page);
        await page.getByRole('combobox', { name: 'Ver otro mesociclo' }).click();
        await page.getByRole('option', { name: /31 de ago/ }).click();
        await settle(page, 1500);
        await bringTo(page, page.getByText(/Mesociclo —/).first(), 140);
        await snap(page, '01-septiembre-con-nuevo.png');
      }
      await context.close();
      if (ONLY.includes('08')) await mobileShot(browser);
      return;
    }

    await openTeam(page);
    const header = page.getByText(/Mesociclo —/).first();
    const hasOctober = /oct/.test((await header.textContent()) || '') && !/sept?/.test((await header.textContent()) || '');

    if (!hasOctober) {
      // 01 · El de septiembre con el botón nuevo
      await bringTo(page, header, 140);
      await snap(page, '01-septiembre-con-nuevo.png');

      // 02 · Nuevo mesociclo: fechas sugeridas y modelo heredado
      await page.getByRole('button', { name: 'Nuevo mesociclo' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('heading', { name: /Crear Mesociclo/ }).waitFor();
      await dlg.locator('#general_objective').fill('Consolidar el saque y el juego en la red.');
      await settle(page, 600);
      await snap(page, '02-nuevo-mesociclo.png');
      await dlg.getByRole('button', { name: 'Crear Mesociclo' }).click();
      await page.getByText(/Mesociclo creado/).first().waitFor({ timeout: 20_000 }).catch(() => {});
      await settle(page, 2500);
    } else {
      console.log('[01-02] octubre ya existe: se reutilizan las capturas 01 y 02');
    }

    // 03 · Octubre con el selector
    await openTeam(page);
    await bringTo(page, page.getByText(/Mesociclo —/).first(), 140);
    await snap(page, '03-octubre-selector.png');

    // 04 · Semana 1 con todos sus días y la sesión suelta del sábado
    const sat = page.getByText('Técnica de saque y devolución').first();
    await bringTo(page, page.getByText(/^Semana 1$/).first(), 100);
    await snap(page, '04-semana-dias-y-suelta.png');

    // 05 · Crear sesión el domingo
    const sunRow = page.locator('div.rounded-md', { hasText: /^Dom 4/i }).filter({ has: page.getByRole('button', { name: 'Crear sesión' }) }).first();
    if (await sunRow.count()) {
      await sunRow.getByRole('button', { name: 'Crear sesión' }).click();
      const sdlg = page.getByRole('dialog');
      await sdlg.getByText(/Crear Sesión de Entrenamiento/).waitFor({ timeout: 20_000 });
      await sdlg.locator('#objectives').fill('Partido de práctica: dobles y juego en la red');
      await settle(page, 700);
      await snap(page, '05-crear-sesion-domingo.png');
      await sdlg.getByRole('button', { name: 'Crear Sesión' }).click();
      await page.getByText(/Sesión creada/).first().waitFor({ timeout: 20_000 }).catch(() => {});
      await settle(page, 2000);
    } else {
      console.log('[05] el domingo ya tiene sesión: se reutiliza la captura 05');
    }

    // 06 · Enganchar la suelta del sábado
    if (await sat.count()) {
      const link = page.getByRole('button', { name: /Enganchar/ }).first();
      if (await link.count()) {
        await link.click();
        await page.getByText(/enganchada/).first().waitFor({ timeout: 20_000 }).catch(() => {});
        await settle(page, 2000);
      }
    }
    await bringTo(page, page.getByText(/^Semana 1$/).first(), 100);
    await snap(page, '06-semana-con-sesiones.png');

    // 07 · Selector abierto: los dos meses
    await bringTo(page, page.getByText(/Mesociclo —/).first(), 140);
    await page.getByRole('combobox', { name: 'Ver otro mesociclo' }).click();
    await settle(page, 600);
    await snap(page, '07-selector-abierto.png');
    await page.keyboard.press('Escape');
    await context.close();

    await mobileShot(browser);

    console.log('✅ Capturas en', SHOTS, fs.readdirSync(SHOTS));
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
