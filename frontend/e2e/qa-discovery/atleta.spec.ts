import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * QA exploratorio — rol ATLETA (SportMaps)
 * NO modifica datos. Solo lectura / navegación. Cualquier flujo de pago se
 * cancela antes de confirmar.
 */

const BASE = 'http://localhost:3004';
const SHOT_DIR = path.join(__dirname, 'screenshots', 'atleta');
const LOG_FILE = path.join(__dirname, 'screenshots', 'atleta', '_findings-log.txt');

const VALENTINA = { email: 'vcruz@demo.sportmaps.co', password: 'Demo2026!', label: 'valentina-al-dia' };
const DANIEL = { email: 'dospina@demo.sportmaps.co', password: 'Demo2026!', label: 'daniel-mora' };

if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.writeFileSync(LOG_FILE, `QA discovery atleta — ${new Date().toISOString()}\n\n`);

function logLine(line: string) {
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function wireDiagnostics(page: Page, tag: string) {
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      logLine(`[${tag}] CONSOLE ERROR on ${page.url()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    logLine(`[${tag}] PAGE ERROR on ${page.url()}: ${err.message}`);
  });
  page.on('response', (res) => {
    const status = res.status();
    if (status >= 400) {
      logLine(`[${tag}] HTTP ${status} → ${res.request().method()} ${res.url()}`);
    }
  });
}

async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.getByRole('button', { name: /entrar ahora/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true });
}

async function visit(page: Page, tag: string, route: string, shotName: string) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 12000 });
  } catch {
    await page.goto(`${BASE}${route}`, { timeout: 12000 }).catch((e) => {
      logLine(`[${tag}] FAILED to navigate to ${route}: ${e.message}`);
    });
  }
  await page.waitForTimeout(1000);
  await shot(page, shotName);
  logLine(`[${tag}] visited ${route} -> title="${await page.title().catch(() => '?')}" finalUrl=${page.url()}`);
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test('Valentina (al día) — recorrido completo de módulos atleta', async ({ page }) => {
  wireDiagnostics(page, 'valentina');
  await login(page, VALENTINA);
  await shot(page, '01-valentina-dashboard');
  logLine(`[valentina] post-login url: ${page.url()}`);

  const routes: [string, string][] = [
    ['/dashboard', '02-valentina-dashboard'],
    ['/profile', '03-valentina-profile'],
    ['/athlete-payments', '04-valentina-payments'],
    ['/estado-cuenta', '05-valentina-estado-cuenta'],
    ['/calendar', '06-valentina-calendar'],
    ['/stats', '07-valentina-stats'],
    ['/goals', '08-valentina-goals'],
    ['/training', '09-valentina-training'],
    ['/enrollments', '10-valentina-enrollments'],
    ['/my-event-registrations', '11-valentina-event-registrations'],
    ['/wellness', '12-valentina-wellness'],
    ['/wellness/appointments', '13-valentina-wellness-appointments'],
    ['/shop', '14-valentina-shop'],
    ['/my-cards', '15-valentina-my-cards'],
    ['/my-certificates', '16-valentina-my-certificates'],
    ['/notifications', '17-valentina-notifications'],
    ['/messages', '18-valentina-messages'],
    ['/settings', '19-valentina-settings'],
    ['/attendance-history', '20-valentina-attendance-history'],
    ['/results', '21-valentina-results'],
    ['/results-overview', '22-valentina-results-overview'],
  ];

  for (const [route, shotName] of routes) {
    await visit(page, 'valentina', route, shotName);
  }

  // Caso límite: recargar a mitad de un flujo (training) y ver si sobrevive
  await page.goto(`${BASE}/training`);
  await page.reload();
  await page.waitForTimeout(1000);
  await shot(page, '23-valentina-training-reload');

  // Intentar acceder a rutas que NO deberían ser de atleta (privilege check)
  const forbiddenRoutes = ['/students', '/admin', '/finances', '/staff', '/payments-automation', '/school-config'];
  for (const route of forbiddenRoutes) {
    await page.goto(`${BASE}${route}`).catch(() => {});
    await page.waitForTimeout(800);
    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const blocked = /unauthorized|no autorizado|acceso denegado|403/i.test(bodyText) || url.includes('/unauthorized') || url.includes('/dashboard');
    logLine(`[valentina] privilege-check ${route} -> finalUrl=${url} blocked=${blocked}`);
    await shot(page, `24-valentina-forbidden-${route.replace(/\//g, '_')}`);
  }
});

test('Daniel (en mora) — recorrido + verificación de bloqueos por mora', async ({ page }) => {
  wireDiagnostics(page, 'daniel');
  await login(page, DANIEL);
  await shot(page, '30-daniel-dashboard');
  logLine(`[daniel] post-login url: ${page.url()}`);

  const routes: [string, string][] = [
    ['/dashboard', '31-daniel-dashboard'],
    ['/profile', '32-daniel-profile'],
    ['/athlete-payments', '33-daniel-payments'],
    ['/estado-cuenta', '34-daniel-estado-cuenta'],
    ['/calendar', '35-daniel-calendar'],
    ['/enrollments', '36-daniel-enrollments'],
    ['/my-event-registrations', '37-daniel-event-registrations'],
    ['/training', '38-daniel-training'],
    ['/stats', '39-daniel-stats'],
    ['/goals', '40-daniel-goals'],
    ['/shop', '41-daniel-shop'],
    ['/my-cards', '42-daniel-my-cards'],
    ['/notifications', '43-daniel-notifications'],
  ];

  for (const [route, shotName] of routes) {
    await visit(page, 'daniel', route, shotName);
  }

  // Buscar indicios de mora visibles en dashboard / payments / estado de cuenta
  await page.goto(`${BASE}/athlete-payments`);
  await page.waitForTimeout(1200);
  const paymentsText = await page.locator('body').innerText().catch(() => '');
  const mentionsMora = /mora|vencid|atras|overdue|pendiente/i.test(paymentsText);
  logLine(`[daniel] /athlete-payments mentions mora/vencido/pendiente: ${mentionsMora}`);
  await shot(page, '44-daniel-payments-mora-text');

  // Intentar inscribirse a un torneo/evento estando en mora
  await page.goto(`${BASE}/my-event-registrations`);
  await page.waitForTimeout(1200);
  await shot(page, '45-daniel-event-registrations-list');
  // Buscar link "Explorar eventos" o similar
  const exploreLink = page.getByRole('link', { name: /explorar|ver eventos|inscrib/i }).first();
  if (await exploreLink.count().catch(() => 0)) {
    await exploreLink.click().catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, '46-daniel-explore-events-from-mora');
    logLine(`[daniel] followed explore/inscribir link from event registrations -> ${page.url()}`);
  } else {
    logLine('[daniel] no explore/inscribir link found on /my-event-registrations');
  }

  // Comparar: intentar tomar/ver asistencia
  await page.goto(`${BASE}/attendance-history`).catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, '47-daniel-attendance-history');

  // Caso límite: recargar a mitad del flujo de pagos
  await page.goto(`${BASE}/athlete-payments`);
  await page.reload();
  await page.waitForTimeout(1000);
  await shot(page, '48-daniel-payments-reload');
});

test('Comparación cruzada Valentina vs Daniel — fuga de datos entre atletas', async ({ browser }) => {
  const ctxV = await browser.newContext();
  const ctxD = await browser.newContext();
  const pageV = await ctxV.newPage();
  const pageD = await ctxD.newPage();
  wireDiagnostics(pageV, 'cross-valentina');
  wireDiagnostics(pageD, 'cross-daniel');

  await login(pageV, VALENTINA);
  await login(pageD, DANIEL);

  await pageV.goto(`${BASE}/my-cards`);
  await pageV.waitForTimeout(1000);
  const cardsTextV = await pageV.locator('body').innerText().catch(() => '');
  await shot(pageV, '50-cross-valentina-cards');

  await pageD.goto(`${BASE}/my-cards`);
  await pageD.waitForTimeout(1000);
  const cardsTextD = await pageD.locator('body').innerText().catch(() => '');
  await shot(pageD, '51-cross-daniel-cards');

  // Chequeo simple: el nombre del otro atleta no debería aparecer en la pantalla propia
  if (cardsTextV.includes('Daniel Ospina') || cardsTextV.includes('Ospina')) {
    logLine('[cross] POSIBLE FUGA: /my-cards de Valentina menciona a Daniel Ospina');
  }
  if (cardsTextD.includes('Valentina Cruz') || cardsTextD.includes('Cruz')) {
    logLine('[cross] POSIBLE FUGA: /my-cards de Daniel menciona a Valentina Cruz');
  }

  await pageV.goto(`${BASE}/estado-cuenta`);
  await pageV.waitForTimeout(1000);
  const estadoV = await pageV.locator('body').innerText().catch(() => '');
  await shot(pageV, '52-cross-valentina-estado-cuenta');
  if (estadoV.includes('Ospina')) {
    logLine('[cross] POSIBLE FUGA: /estado-cuenta de Valentina menciona a Daniel Ospina');
  }

  await pageD.goto(`${BASE}/estado-cuenta`);
  await pageD.waitForTimeout(1000);
  const estadoD = await pageD.locator('body').innerText().catch(() => '');
  await shot(pageD, '53-cross-daniel-estado-cuenta');
  if (estadoD.includes('Cruz')) {
    logLine('[cross] POSIBLE FUGA: /estado-cuenta de Daniel menciona a Valentina Cruz');
  }

  await ctxV.close();
  await ctxD.close();
});
