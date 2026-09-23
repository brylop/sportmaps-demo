import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Continuación del QA exploratorio — rol PADRE. Corrige el problema del run anterior
// (esperas de 1-1.5s eran insuficientes: Vite + fetch a Supabase/BFF remoto tardan
// varios segundos reales, así que ese run reportó falsos "blank/error"). Acá se usa
// espera real (networkidle + timeout de respaldo) y se cubren las rutas que faltaban:
// perfil individual de cada hijo (progreso/asistencia/informes), notificaciones,
// mensajes, mi-tienda, carnets/certificados con espera correcta, y estado de cuenta.

const BASE_URL = 'http://localhost:3004';
const SHOT_DIR = path.join(__dirname, 'screenshots', 'padre-completo');
const LOG_PATH = path.join(SHOT_DIR, 'log.txt');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const logLines: string[] = [];
function log(line: string) {
  const ts = new Date().toISOString();
  logLines.push(`[${ts}] ${line}`);
  console.log(line);
}

async function shot(page: Page, name: string) {
  const file = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch((e) => log(`SCREENSHOT FAIL ${name}: ${e}`));
  log(`SCREENSHOT ${name} -> ${file}`);
}

function wireObservers(page: Page, tag: string) {
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') log(`[${tag}] CONSOLE ERROR: ${msg.text()}`);
  });
  page.on('pageerror', (err) => log(`[${tag}] PAGEERROR: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) log(`[${tag}] HTTP ${res.status()} ${res.request().method()} ${res.url()}`);
  });
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('tu@correo.com').fill('mherrera@demo.sportmaps.co');
  await page.getByPlaceholder('••••••••').fill('Demo2026!');
  await page.getByRole('button', { name: /Entrar ahora/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

async function settle(page: Page, extra = 4000) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(extra);
}

test.describe.configure({ mode: 'serial' });

test('A - Estado de cuenta (retest con espera real)', async ({ page }) => {
  wireObservers(page, 'estado-cuenta');
  await login(page);
  await page.goto(`${BASE_URL}/estado-cuenta`);
  await settle(page);
  await shot(page, 'A-estado-cuenta');
  const t = (await page.textContent('body').catch(() => '')) || '';
  log(`estado-cuenta len=${t.length} contiene-error="${t.includes('No se pudo cargar')}"`);
});

test('B - Notificaciones / Mensajes / Mi tienda / Carnets (retest)', async ({ page }) => {
  wireObservers(page, 'b');
  await login(page);
  for (const route of ['notifications', 'messages', 'mi-tienda', 'my-cards', 'my-certificates']) {
    await page.goto(`${BASE_URL}/${route}`);
    await settle(page);
    await shot(page, `B-${route}`);
    const t = (await page.textContent('body').catch(() => '')) || '';
    log(`${route} len=${t.length} snippet="${t.slice(0, 150).replace(/\s+/g, ' ')}"`);
  }
});

test('C - Perfil individual de cada hijo: progreso, asistencia, informes', async ({ page }) => {
  wireObservers(page, 'child-detail');
  await login(page);
  await page.goto(`${BASE_URL}/children`);
  await settle(page);

  const hrefs = await page.locator('a[href*="childId="], a[href*="/children/"]').evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).getAttribute('href'))
  );
  log(`Links encontrados en /children: ${JSON.stringify(hrefs)}`);

  const uniq = Array.from(new Set(hrefs.filter(Boolean))) as string[];
  for (const href of uniq) {
    const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    await page.goto(url);
    await settle(page, 3000);
    const safe = href.replace(/[^a-zA-Z0-9]/g, '_');
    await shot(page, `C-${safe}`);
    const t = (await page.textContent('body').catch(() => '')) || '';
    log(`${href} len=${t.length} snippet="${t.slice(0, 150).replace(/\s+/g, ' ')}"`);
  }

  if (uniq.length === 0) {
    log('HALLAZGO: seguimos sin poder extraer links de /children — revisar selector');
  }
});

test('D - Calendario familiar y Mis Citas (si existen en el menú)', async ({ page }) => {
  wireObservers(page, 'calendar');
  await login(page);
  for (const route of ['calendario-familiar', 'family-calendar']) {
    await page.goto(`${BASE_URL}/${route}`);
    await settle(page, 2000);
    const t = (await page.textContent('body').catch(() => '')) || '';
    log(`${route} len=${t.length} url-final=${page.url()}`);
    await shot(page, `D-${route}`);
  }
});

test('E - Torneos / eventos abiertos desde el dashboard del padre', async ({ page }) => {
  wireObservers(page, 'events');
  await login(page);
  await page.goto(`${BASE_URL}/dashboard`);
  await settle(page);
  await shot(page, 'E-dashboard');
  const t = (await page.textContent('body').catch(() => '')) || '';
  log(`dashboard len=${t.length} snippet="${t.slice(0, 300).replace(/\s+/g, ' ')}"`);

  await page.goto(`${BASE_URL}/my-event-registrations`);
  await settle(page, 2000);
  await shot(page, 'E-my-event-registrations');
  const t2 = (await page.textContent('body').catch(() => '')) || '';
  log(`my-event-registrations len=${t2.length} url-final=${page.url()}`);
});

test.afterAll(async () => {
  fs.writeFileSync(LOG_PATH, logLines.join('\n'), 'utf-8');
});
