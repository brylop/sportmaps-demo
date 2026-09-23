import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// QA exploratorio — rol PADRE/ACUDIENTE (Mauricio Herrera, Club Campestre Demo)
// Frontend local apuntando a Supabase STAGING + BFF dev. Solo lectura/observación,
// nada destructivo. Ver docs/CLAUDE.md para reglas del repo.

const BASE_URL = 'http://localhost:3004';
const SHOT_DIR = path.join(__dirname, 'screenshots', 'padre');
const LOG_PATH = path.join(__dirname, 'screenshots', 'padre', 'network-console-log.txt');

if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const logLines: string[] = [];
function log(line: string) {
  const ts = new Date().toISOString();
  logLines.push(`[${ts}] ${line}`);
}

async function shot(page: Page, name: string) {
  const file = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch((e) => log(`SCREENSHOT FAIL ${name}: ${e}`));
  log(`SCREENSHOT ${name} -> ${file}`);
}

function wireObservers(page: Page, tag: string) {
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      log(`[${tag}] CONSOLE ${msg.type().toUpperCase()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    log(`[${tag}] PAGEERROR: ${err.message}`);
  });
  page.on('response', (res) => {
    const status = res.status();
    if (status >= 400) {
      log(`[${tag}] HTTP ${status} ${res.request().method()} ${res.url()}`);
    }
  });
  page.on('requestfailed', (req) => {
    log(`[${tag}] REQUEST FAILED: ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('tu@correo.com').fill('mherrera@demo.sportmaps.co');
  await page.getByPlaceholder('••••••••').fill('Demo2026!');
  await page.getByRole('button', { name: /Entrar ahora/i }).click();
  // Esperar a salir de /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 }).catch(() => {
    log('LOGIN: no salió de /login en 20s — posible fallo de auth o loader infinito');
  });
  await page.waitForTimeout(1500);
}

test.describe.configure({ mode: 'serial' });

test('01 - Login y dashboard principal del padre', async ({ page }) => {
  wireObservers(page, 'dashboard');
  await login(page);
  await shot(page, '01-post-login');
  log(`URL tras login: ${page.url()}`);
  const bodyText = await page.textContent('body').catch(() => '');
  if (!bodyText || bodyText.trim().length < 20) {
    log('HALLAZGO: dashboard parece vacío/en blanco tras login');
  }
});

test('02 - Mis hijos (MyChildrenPage)', async ({ page }) => {
  wireObservers(page, 'children');
  await login(page);
  await page.goto(`${BASE_URL}/children`);
  await page.waitForTimeout(1500);
  await shot(page, '02-children-list');
  const text = await page.textContent('body').catch(() => '') || '';
  log(`children page contiene "Sofía": ${text.includes('Sofía') || text.includes('Sofia')}, "Tomás": ${text.includes('Tomás') || text.includes('Tomas')}`);
});

test('03 - Perfil/progreso de cada hijo', async ({ page }) => {
  wireObservers(page, 'child-profile');
  await login(page);
  await page.goto(`${BASE_URL}/children`);
  await page.waitForTimeout(1500);
  // Intentar extraer IDs de hijos desde links en la página
  const links = await page.locator('a[href*="/children/"]').evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).getAttribute('href'))
  );
  log(`Links de hijos encontrados: ${JSON.stringify(links)}`);
  const ids = Array.from(new Set(links.map((l) => l?.match(/\/children\/([^/]+)/)?.[1]).filter(Boolean)));
  log(`IDs de hijos detectados: ${JSON.stringify(ids)}`);

  for (const id of ids) {
    for (const sub of ['progress', 'attendance', 'reports']) {
      const url = `${BASE_URL}/children/${id}/${sub}`;
      await page.goto(url);
      await page.waitForTimeout(1200);
      await shot(page, `03-child-${id}-${sub}`);
      const t = await page.textContent('body').catch(() => '') || '';
      log(`child ${id} /${sub}: len=${t.length} snippet="${t.slice(0, 120).replace(/\s+/g, ' ')}"`);
    }
  }
  if (ids.length === 0) {
    log('HALLAZGO: no se pudieron extraer IDs de hijos desde /children — navegación por click en su lugar');
    await page.goto(`${BASE_URL}/children`);
    await page.waitForTimeout(1000);
    const cards = page.locator('a, button').filter({ hasText: /Sofía|Sofia|Tomás|Tomas/i });
    const count = await cards.count();
    log(`Elementos clicables con nombre de hijo: ${count}`);
  }
});

test('04 - Pagos: MyPaymentsPage', async ({ page }) => {
  wireObservers(page, 'payments');
  await login(page);
  await page.goto(`${BASE_URL}/my-payments`);
  await page.waitForTimeout(2000);
  await shot(page, '04-my-payments');
  const t = await page.textContent('body').catch(() => '') || '';
  log(`my-payments len=${t.length}`);

  // Intentar iniciar un pago sin completarlo (camino feliz truncado antes del cobro final)
  const payBtn = page.getByRole('button', { name: /pagar|realizar pago|pagar ahora/i }).first();
  if (await payBtn.count()) {
    await payBtn.click().catch((e) => log(`click pagar falló: ${e}`));
    await page.waitForTimeout(2000);
    await shot(page, '04b-payment-flow-started');
    log(`URL tras click pagar: ${page.url()}`);
    // NO completar el pago. Si hay campos de tarjeta, no llenar número real.
  } else {
    log('No se encontró botón de pago visible en my-payments (puede que no haya pendientes)');
  }
});

test('05 - Estado de cuenta', async ({ page }) => {
  wireObservers(page, 'estado-cuenta');
  await login(page);
  await page.goto(`${BASE_URL}/estado-cuenta`);
  await page.waitForTimeout(1500);
  await shot(page, '05-estado-cuenta');
  const t = await page.textContent('body').catch(() => '') || '';
  log(`estado-cuenta len=${t.length}`);
});

test('06 - Inscripciones (MyEnrollmentsPage)', async ({ page }) => {
  wireObservers(page, 'enrollments');
  await login(page);
  await page.goto(`${BASE_URL}/enrollments`);
  await page.waitForTimeout(1500);
  await shot(page, '06-enrollments');
  const t = await page.textContent('body').catch(() => '') || '';
  log(`enrollments len=${t.length}`);
});

test('07 - Notificaciones', async ({ page }) => {
  wireObservers(page, 'notifications');
  await login(page);
  await page.goto(`${BASE_URL}/notifications`);
  await page.waitForTimeout(1500);
  await shot(page, '07-notifications');
});

test('08 - Mensajes', async ({ page }) => {
  wireObservers(page, 'messages');
  await login(page);
  await page.goto(`${BASE_URL}/messages`);
  await page.waitForTimeout(1500);
  await shot(page, '08-messages');
});

test('09 - Mi tienda', async ({ page }) => {
  wireObservers(page, 'mi-tienda');
  await login(page);
  await page.goto(`${BASE_URL}/mi-tienda`);
  await page.waitForTimeout(1500);
  await shot(page, '09-mi-tienda');
});

test('10 - Carnets y certificados', async ({ page }) => {
  wireObservers(page, 'cards-certs');
  await login(page);
  await page.goto(`${BASE_URL}/my-cards`);
  await page.waitForTimeout(1500);
  await shot(page, '10-my-cards');
  await page.goto(`${BASE_URL}/my-certificates`);
  await page.waitForTimeout(1500);
  await shot(page, '10b-my-certificates');
});

test('11 - Rutas bloqueadas para padre (intento directo de escalar rol)', async ({ page }) => {
  wireObservers(page, 'blocked-routes');
  await login(page);
  const blocked = ['/finances', '/students', '/mi-plan', '/staff', '/accounting', '/attendance-supervision'];
  for (const route of blocked) {
    await page.goto(`${BASE_URL}${route}`);
    await page.waitForTimeout(1000);
    const url = page.url();
    const t = (await page.textContent('body').catch(() => '')) || '';
    log(`Ruta bloqueada ${route}: URL final=${url}, contiene datos sensibles?=${t.length > 50 ? 'revisar' : 'no'}`);
    await shot(page, `11-blocked${route.replace(/\//g, '_')}`);
  }
});

test('12 - Recarga a mitad de flujo de pago / doble submit', async ({ page }) => {
  wireObservers(page, 'reload-midflow');
  await login(page);
  await page.goto(`${BASE_URL}/my-payments`);
  await page.waitForTimeout(1500);
  const payBtn = page.getByRole('button', { name: /pagar|realizar pago|pagar ahora/i }).first();
  if (await payBtn.count()) {
    await payBtn.click().catch(() => {});
    await page.waitForTimeout(1500);
    log(`URL antes de reload: ${page.url()}`);
    await page.reload();
    await page.waitForTimeout(2000);
    await shot(page, '12-reload-midflow');
    log(`URL tras reload: ${page.url()}`);
  } else {
    log('12: no había flujo de pago disponible para probar reload a mitad de camino');
  }
});

test.afterAll(async () => {
  fs.writeFileSync(LOG_PATH, logLines.join('\n'), 'utf-8');
   
  console.log(`\n=== LOG COMPLETO ESCRITO EN: ${LOG_PATH} ===\n`);
});
