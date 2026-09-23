// Capturas REALES para el manual "Calendario por equipos" (docs/manuales/README.md,
// memoria feedback_pdf_manual_template: nunca mockups).
//
//   BASE_URL=http://localhost:3001 node docs/manuales/_src/calendario-equipos-familias/capture.mjs
//
// Requiere:
//   * el frontend corriendo en BASE_URL con el código nuevo del calendario
//     (selector "Para quién"), apuntando a la Supabase compartida;
//   * la migración 20260923113401 aplicada en esa base (sin school_id la
//     consulta del calendario falla);
//   * frontend/.env con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY (o ANON).
//
// Tenant: Club Campestre Demo (is_demo=true). Cuentas y contraseña únicas en
// scripts/demo-club-campestre/README.md. Deja UN evento creado en el calendario
// del coach de tenis (sirve para demos); no toca ninguna escuela real.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const SHOTS = path.join(here, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

// ── Supabase creds desde frontend/.env ────────────────────────────────────
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
  owner:  'gerencia@demo.sportmaps.co',           // Ricardo Mendoza
  coach:  'entrenador.tenis@demo.sportmaps.co',   // Felipe Torres · 4 categorías de tenis
  parent: 'mherrera@demo.sportmaps.co',           // Mauricio Herrera · Tomás en Tenis — Juvenil Competitivo
};
const TEAM = 'Tenis — Juvenil Competitivo';

// Login programático: mismo truco que frontend/e2e/helpers/auth.ts — se pide el
// JWT al endpoint de Supabase y se planta la sesión en localStorage con la llave
// que usa supabase-js v2, así la primera navegación ya entra logueada.
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
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, locale: 'es-CO' });
  await loginAs(context, email);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  return { context, page };
}

const snap = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, name), fullPage: false, ...opts });
const settle = (page, ms = 1200) => page.waitForTimeout(ms);

// Día para el evento: dentro de este mes, unos días adelante, para que quede
// visible en la cuadrícula del mes actual sin cambiar de página.
function pickDay() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.min(d.getDate() + 3, last);
}

async function run() {
  const browser = await chromium.launch();
  try {
    // ── 01 · Owner: Mis Equipos ─────────────────────────────────────────
    {
      const { context, page } = await newSession(browser, ACCOUNTS.owner);
      await page.goto(`${BASE_URL}/teams`);
      await page.waitForLoadState('networkidle');
      await settle(page, 1500);
      await snap(page, '01-equipos-owner.png');
      await context.close();
    }

    // ── 02-06 · Coach: crear, ver y editar ──────────────────────────────
    {
      const { context, page } = await newSession(browser, ACCOUNTS.coach);
      await page.goto(`${BASE_URL}/calendar`);
      await page.getByRole('heading', { name: /Calendario/ }).waitFor({ timeout: 30_000 });
      await page.waitForLoadState('networkidle');
      await settle(page);
      await snap(page, '02-coach-calendario.png');

      // Reanudable: si ya está la captura 05, el evento ya existe y se salta la creación.
      const day = String(pickDay());
      if (!fs.existsSync(path.join(SHOTS, '05-coach-evento-creado.png'))) {
      await page.getByRole('button', { name: /Nuevo Evento/ }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await dialog.getByPlaceholder('Ej: Campeonato Nacional').fill('Partido de liga vs. Club Los Lagos');

      // "Para quién": el primer combobox del formulario.
      const paraQuien = dialog.locator('div.space-y-2:has(label:has-text("Para quién")) [role="combobox"]');
      await paraQuien.click();
      await page.getByRole('option', { name: TEAM }).waitFor();
      await settle(page, 400);
      await snap(page, '03-coach-nuevo-evento-para-quien.png');
      await page.getByRole('option', { name: TEAM }).click();

      // Tipo de evento → Partido
      const tipo = dialog.locator('div.space-y-2:has(label:has-text("Tipo de Evento")) [role="combobox"]');
      await tipo.click();
      await page.getByRole('option', { name: /Partido/ }).first().click();
      await dialog.getByPlaceholder(/Ej: Liga Municipal|Ej: Competencia/).fill('Liga Municipal Sub-15');

      // Fecha de inicio (la de fin se copia sola)
      await dialog.getByRole('button', { name: /Seleccionar fecha/ }).first().click();
      // react-day-picker: los días son <button name="day"> con aria-label largo; se busca por texto.
      await page.locator('button[name="day"]').filter({ hasText: new RegExp(`^${day}$`) }).first().click();
      await settle(page, 300);
      await dialog.locator('input[type="time"]').nth(0).fill('09:00');
      await dialog.locator('input[type="time"]').nth(1).fill('11:00');
      await dialog.getByPlaceholder('Detalles adicionales...').fill('Citación 8:15 a.m. en la sede. Uniforme blanco.');
      await settle(page, 400);
      await snap(page, '04-coach-nuevo-evento-lleno.png');

      await dialog.getByRole('button', { name: /Crear Evento/ }).click();
      await page.getByText(/Evento creado/).waitFor({ timeout: 15_000 }).catch(() => {});
      await settle(page, 1500);
      // Seleccionar el día para que salga el detalle con la etiqueta del equipo.
      await page.getByRole('button').filter({ hasText: new RegExp('^' + day + '(\\+\\d+)?$') }).first().click().catch(() => {});
      await settle(page, 800);
      await snap(page, '05-coach-evento-creado.png');
      } // fin creación

      // Editar: el lápiz aparece al hover sobre la tarjeta de "Próximos Eventos".
      await page.getByText('Partido de liga vs. Club Los Lagos').first().waitFor({ timeout: 20_000 });
      const card = page.locator('.group', { hasText: 'Partido de liga vs. Club Los Lagos' }).first();
      await card.hover();
      await settle(page, 400);
      const pencil = card.getByRole('button').first();
      await pencil.click({ force: true });
      await page.getByRole('dialog').getByText('Editar Evento').waitFor({ timeout: 15_000 });
      await settle(page, 400);
      await snap(page, '06-coach-editar-evento.png');
      await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
      await context.close();
    }

    // ── 07-08 · Padre: Calendario Familiar ──────────────────────────────
    {
      const { context, page } = await newSession(browser, ACCOUNTS.parent);
      await page.goto(`${BASE_URL}/calendar`);
      await page.getByRole('heading', { name: /Calendario/ }).waitFor({ timeout: 30_000 });
      await page.waitForLoadState('networkidle');
      await page.getByText('Partido de liga vs. Club Los Lagos').first().waitFor({ timeout: 20_000 });
      await settle(page);
      await snap(page, '07-padre-calendario-familiar.png');
      await page.getByRole('button').filter({ hasText: new RegExp('^' + pickDay() + '(\\+\\d+)?$') }).first().click().catch(() => {});
      await settle(page, 800);
      await snap(page, '08-padre-detalle-evento.png');
      await context.close();
    }

    console.log('✅ Capturas en', SHOTS, fs.readdirSync(SHOTS));
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
