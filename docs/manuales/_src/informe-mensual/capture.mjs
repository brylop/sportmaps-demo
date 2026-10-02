// Capturas REALES para el manual "Informe Mensual — entrenador" (docs/manuales/README.md,
// memoria feedback_pdf_manual_template: nunca mockups).
//
//   BASE_URL=http://localhost:3001 node docs/manuales/_src/informe-mensual/capture.mjs
//
// Tenant: Club Campestre Demo (is_demo=true), entrenador Felipe Torres con
// Fútbol — Sub-15 asignado y la escuela en «Cada entrenador, lo suyo»
// (school_settings.reports_release_by='coach'). Datos de septiembre sembrados
// con notes='seed-manual-informe'. PUBLICA los informes del Sub-15 del demo;
// NUNCA pulsa «Enviar» (mandaría correos a las familias demo).

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
const SUPABASE_URL = ENV.VITE_SUPABASE_URL;
const SUPABASE_KEY = ENV.VITE_SUPABASE_PUBLISHABLE_KEY || ENV.VITE_SUPABASE_ANON_KEY;
const BFF_URL = process.env.BFF_URL || ENV.VITE_BFF_URL;

const COACH = 'entrenador.tenis@demo.sportmaps.co'; // Felipe Torres
const TEAM = 'Fútbol — Sub-15';
const NOTA = 'Septiembre fue un mes de mucho trabajo en salida con balón y presión tras pérdida. ' +
  'El grupo respondió muy bien en los entrenamientos y en el torneo; en octubre vamos a reforzar la definición.';

let session;
async function login() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email: COACH, password: 'Demo2026!' }),
  });
  if (!res.ok) throw new Error(`Login: ${res.status} ${await res.text()}`);
  session = await res.json();
}

async function newPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, locale: 'es-CO' });
  const ref = new URL(SUPABASE_URL).host.split('.')[0];
  await context.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  return { context, page };
}

const snap = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, name), ...opts });
const settle = (page, ms = 1200) => page.waitForTimeout(ms);

async function pickSelect(page, card, labelText, option) {
  const trigger = card.locator(`div:has(> label:has-text("${labelText}")) [role="combobox"]`).first();
  await trigger.click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await settle(page, 600);
}

async function run() {
  await login();
  const browser = await chromium.launch();
  try {
    const { page } = await newPage(browser);

    // ── 01 · Informe Mensual, septiembre ─────────────────────────────────
    await page.goto(`${BASE_URL}/informe-mensual`);
    await page.getByRole('heading', { name: /Informe Mensual/ }).waitFor({ timeout: 40_000 });
    await page.waitForLoadState('networkidle');
    const periodo = page.locator('div.rounded-lg, div[class*="card"]').filter({ has: page.getByText('Mes', { exact: true }) }).first();
    await pickSelect(page, periodo, 'Mes', 'Septiembre');
    await page.waitForLoadState('networkidle');
    await settle(page, 2000);
    await snap(page, '01-informe-mensual-septiembre.png');

    // ── 02 · Nota del equipo ─────────────────────────────────────────────
    const notaCard = page.locator('div[class*="card"]', { hasText: 'Nota del equipo' }).first();
    await notaCard.scrollIntoViewIfNeeded();
    await pickSelect(page, notaCard, 'Equipo', TEAM);
    await notaCard.locator('textarea').fill(NOTA);
    await settle(page, 500);
    await snap(page, '02-nota-equipo.png', { fullPage: true });

    await notaCard.getByRole('button', { name: /Guardar nota/ }).click();
    await page.getByText(/Nota del equipo guardada/).first().waitFor({ timeout: 20_000 }).catch(() => console.log('sin toast nota'));
    await settle(page, 1500);

    // ── 03 · Publicar el lote del equipo ─────────────────────────────────
    const publicar = notaCard.getByRole('button', { name: /^Publicar/ });
    if (await publicar.isEnabled()) {
      await publicar.click();
      await page.getByText(/informes publicados/).first().waitFor({ timeout: 40_000 }).catch(() => console.log('sin toast publicar'));
      await settle(page, 1200);
      await snap(page, '03-publicados-toast.png');
    }
    await page.waitForLoadState('networkidle');
    await settle(page, 2500);

    // ── 04 · Lista con «Ver PDF» y «Enviar» (NO se pulsa Enviar) ─────────
    const lista = page.locator('div[class*="card"]', { hasText: /Informes de Septiembre/ }).first();
    await lista.scrollIntoViewIfNeeded();
    await settle(page, 800);
    await snap(page, '04-lista-ver-pdf-enviar.png', { fullPage: true });

    // ── 05 · Enviar (tarjeta, sin pulsar) ────────────────────────────────
    await snap(page, '05-pagina-completa.png', { fullPage: true });

    // ── 06 · Reportes del equipo ─────────────────────────────────────────
    await page.goto(`${BASE_URL}/coach-reports`);
    await page.getByRole('heading', { name: /Reportes del Equipo/ }).waitFor({ timeout: 40_000 });
    await page.waitForLoadState('networkidle');
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole('option', { name: TEAM }).click();
    await page.waitForLoadState('networkidle');
    await settle(page, 2500);
    await snap(page, '06-reportes-equipo.png');
    await page.getByRole('tab', { name: /Resultados/ }).click();
    await settle(page, 1000);
    await snap(page, '07-reportes-resultados.png');
    await page.getByRole('tab', { name: /Goleadores/ }).click();
    await settle(page, 1000);
    await snap(page, '08-reportes-goleadores.png');

    // ── 10 · Informe grupal del mes (desde el botón de Reportes) ─────────
    await page.getByRole('link', { name: /Informe grupal del mes/ }).click();
    await page.waitForLoadState('networkidle');
    await settle(page, 3000);
    await snap(page, '10-informe-grupal.png');

    // ── 09 · PDF de un informe publicado (mismo endpoint que «Ver PDF») ──
    const { data } = await (await fetch(
      `${SUPABASE_URL}/rest/v1/athlete_reports?select=id&team_id=eq.658d014e-26b9-44dd-bfde-8eed0a3a14ac&period_year=eq.2026&period_month=eq.9&status=eq.publicado&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` } },
    ).then(async (r) => ({ data: await r.json() })));
    if (Array.isArray(data) && data[0]) {
      const pdf = await fetch(`${BFF_URL}/api/v1/athlete-reports/${data[0].id}/pdf`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      console.log('PDF', pdf.status);
      if (pdf.ok) fs.writeFileSync(path.join(SHOTS, '09-informe-individual.pdf'), Buffer.from(await pdf.arrayBuffer()));
    } else {
      console.log('sin informe publicado para el PDF', data);
    }

    console.log('✅ Capturas en', SHOTS, fs.readdirSync(SHOTS));
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
