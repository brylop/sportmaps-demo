// Capturas REALES para el manual "Funciones del entrenador" (Club Carmel), ver
// docs/manuales/README.md y la memoria feedback_pdf_manual_template: nunca mockups.
//
//   BASE_URL=https://stg.sportmaps.co node docs/manuales/_src/entrenador-carmel/capture.mjs
//
// Requiere:
//   * un frontend desplegado con el código del 2026-09-24 (diálogo "ya tiene
//     equipo", segundo equipo) — stg lo tiene;
//   * frontend/.env con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY;
//   * en la escuela demo, los tres flags que Carmel tiene prendidos
//     (coach_can_create_teams, coach_can_create_athletes,
//     allow_secondary_team_enrollment) — se prenden para capturar y se apagan
//     al terminar; el script no los toca.
//
// Tenant: Club Campestre Demo (is_demo=true). Cuenta: coach de tenis. NO crea
// ni modifica datos: abre diálogos y los cancela.

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
const COACH = 'entrenador.tenis@demo.sportmaps.co'; // Felipe Torres · 4 categorías de tenis
// Equipo donde se abre "Inscribir": uno en el que Tomás (Juvenil Competitivo) NO está,
// para que al pulsar "Inscribir" salga el diálogo "ya tiene equipo".
const TEAM_ENROLL = 'Tenis — Escuela Formativa';
const TEAM_MAIN = 'Tenis — Juvenil Competitivo';
const STUDENT_OTHER_TEAM = /Tom[aá]s/;

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

async function goto(page, route, waitFor) {
  await page.goto(`${BASE_URL}${route}`);
  await page.waitForLoadState('networkidle').catch(() => {});
  if (waitFor) await waitFor.waitFor({ timeout: 30_000 }).catch((e) => console.log(`[wait] ${route}: ${e.message.split('\n')[0]}`));
  await settle(page, 1500);
}

async function pickTeam(page, name) {
  // Selectores de equipo de la app: un combobox de shadcn (role=combobox) y luego role=option.
  const combo = page.getByRole('combobox').first();
  if (await combo.count()) {
    await combo.click().catch(() => {});
    const opt = page.getByRole('option', { name });
    if (await opt.count()) { await opt.first().click(); await settle(page, 1500); return true; }
    await page.keyboard.press('Escape').catch(() => {});
  }
  return false;
}

async function run() {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, locale: 'es-CO' });
    await loginAs(context, COACH);
    const page = await context.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));

    // ONLY=07 → solo la captura del alta de deportista (reanudable).
    if (process.env.ONLY !== '07') {
    // 01 · Panel del entrenador
    await goto(page, '/dashboard');
    await snap(page, '01-dashboard.png');

    // 02 · Mis Equipos (+ botón Nuevo Equipo, que solo sale con coach_can_create_teams)
    await goto(page, '/teams', page.getByText(TEAM_MAIN).first());
    await snap(page, '02-equipos.png');

    // 03 · Nuevo Equipo: abrir el diálogo y cancelar
    const nuevo = page.getByRole('button', { name: /Nuevo Equipo/ });
    if (await nuevo.count()) {
      await nuevo.first().click();
      await page.getByRole('dialog').waitFor({ timeout: 15_000 }).catch(() => {});
      await settle(page, 800);
      await snap(page, '03-nuevo-equipo.png');
      await page.keyboard.press('Escape');
      await settle(page, 600);
    } else {
      console.log('[03] no hay botón Nuevo Equipo (¿flag coach_can_create_teams apagado?)');
    }

    // 04 · Inscribir Deportistas en un equipo (icono "Gestionar Deportistas" de la fila)
    const row = page.locator('tr, [class*="card"]', { hasText: TEAM_ENROLL }).first();
    const gestionar = row.locator('[title="Gestionar Deportistas"]').first();
    if (await gestionar.count()) {
      await gestionar.click();
    } else {
      await page.locator('[title="Gestionar Deportistas"]').first().click();
    }
    const modal = page.getByRole('dialog');
    await modal.waitFor({ timeout: 15_000 });
    await modal.getByText(/Inscribir Deportistas/).waitFor({ timeout: 15_000 }).catch(() => {});
    await settle(page, 1500);
    await snap(page, '04-inscribir-modal.png');

    // 05 · Diálogo "ya tiene equipo": buscar a un deportista de otra categoría
    await modal.getByPlaceholder(/Buscar deportista/).fill('Tom');
    await settle(page, 800);
    const card = modal.locator('[class*="card"], div', { hasText: STUDENT_OTHER_TEAM }).filter({ has: page.getByRole('button', { name: /Inscribir/ }) }).first();
    const inscribir = (await card.count())
      ? card.getByRole('button', { name: /Inscribir/ }).first()
      : modal.getByRole('button', { name: /Inscribir/ }).first();
    await inscribir.click();
    await page.getByText(/ya tiene equipo/).waitFor({ timeout: 15_000 }).catch((e) => console.log('[05]', e.message.split('\n')[0]));
    await settle(page, 800);
    await snap(page, '05-dialogo-ya-tiene-equipo.png');
    await page.getByRole('button', { name: /^Cancelar$/ }).first().click().catch(() => page.keyboard.press('Escape'));
    await settle(page, 500);
    await page.keyboard.press('Escape');
    await settle(page, 500);
    } // fin ONLY

    // 06 · Mis Deportistas (+ alta, que solo sale con coach_can_create_athletes)
    await goto(page, '/students', page.getByRole('heading').first());
    if (process.env.ONLY !== '07') await snap(page, '06-deportistas.png');
    const alta = page.getByRole('button', { name: /Agregar Atleta|Agregar Deportista|Nuevo Deportista/ });
    if (await alta.count()) {
      await alta.first().click();
      await page.getByRole('dialog').waitFor({ timeout: 15_000 }).catch(() => {});
      await settle(page, 1000);
      await snap(page, '07-nuevo-deportista.png');
      await page.keyboard.press('Escape');
      await settle(page, 500);
    } else {
      console.log('[07] no hay botón de alta de deportista');
    }
    if (process.env.ONLY === '07') { await context.close(); return; }

    // 08 · Asistencia
    await goto(page, '/coach-attendance');
    await pickTeam(page, TEAM_MAIN);
    await snap(page, '08-asistencia.png');

    // 09 · Sesiones de entrenamiento (Métricas y Rendimiento) con el equipo elegido
    await goto(page, '/training-plans');
    await pickTeam(page, TEAM_MAIN);
    await snap(page, '09-sesiones.png');

    // 10 · Reportes → Asistencia por deportista
    await goto(page, '/coach-reports');
    await pickTeam(page, TEAM_MAIN);
    await page.getByRole('tab', { name: /Asistencia/ }).first().click().catch(() => {});
    await settle(page, 1200);
    await snap(page, '10-reportes-asistencia.png');

    await context.close();
    console.log('✅ Capturas en', SHOTS, fs.readdirSync(SHOTS));
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
