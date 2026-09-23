import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// QA exploratorio: el PROCESO DE PAGO visto desde la ESCUELA (owner demo).
// Solo lectura: abre modales y pestañas, no aprueba, no rechaza, no registra.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3004';
const SHOT_DIR = path.join(__dirname, 'screenshots', 'proceso-pago');
const LOG_PATH = path.join(SHOT_DIR, 'escuela-log.txt');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const lines: string[] = [];
const log = (s: string) => { lines.push(s); console.log(s); };
const shot = async (page: Page, name: string, full = false) => {
  const file = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: full }).catch((e) => log(`SHOT FAIL ${name}: ${e}`));
  log(`SHOT ${name}`);
};
const settle = async (page: Page, ms = 2500) => {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
};

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder(/tu@correo\.com|tu@email\.com/i).fill('gerencia@demo.sportmaps.co');
  await page.getByPlaceholder('••••••••').fill('Demo2026!');
  await page.getByRole('button', { name: /Entrar ahora/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 }).catch(() => log('LOGIN no salió de /login'));
  await settle(page, 3000);
}

test.use({ viewport: { width: 1280, height: 900 } });

test('Escuela: cobros por aprobar, registrar pago y datos de transferencia', async ({ page }) => {
  test.setTimeout(240_000);
  page.on('pageerror', (e) => log(`PAGEERROR ${e.message}`));
  await login(page);

  // 1. Módulo de cobros
  await page.goto(`${BASE_URL}/payments-automation`);
  await settle(page, 5000);
  await shot(page, 'e01-cobros-por-aprobar', true);

  // 2. Registrar pago manual (solo abrir, elegir método, cerrar)
  const reg = page.getByRole('button', { name: /Registrar pago/i }).first();
  if (await reg.isVisible().catch(() => false)) {
    await reg.click();
    await page.waitForTimeout(2500);
    const dlg = page.getByRole('dialog').first();
    await shot(page, 'e02-registrar-pago-efectivo');
    log('--- TEXTO Registrar pago ---');
    log((await dlg.innerText().catch(() => '')).slice(0, 4000));
    const trf = dlg.getByText(/Transferencia/i).first();
    if (await trf.isVisible().catch(() => false)) {
      await trf.click();
      await page.waitForTimeout(1200);
      await dlg.evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
      await shot(page, 'e03-registrar-pago-transferencia');
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  } else {
    log('No vi el botón Registrar pago');
  }

  // 3. Historial de transacciones
  await page.getByRole('tab', { name: /Historial/i }).click().catch(() => log('sin tab Historial'));
  await settle(page, 3000);
  await shot(page, 'e04-historial-transacciones', true);

  // 4. Config: datos de pago para transferencia + validación automática
  await page.getByRole('tab', { name: /Config/i }).click().catch(() => log('sin tab Config'));
  await settle(page, 3000);
  const datos = page.getByText(/Datos de Pago para Transferencia/i).first();
  if (await datos.isVisible().catch(() => false)) await datos.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot(page, 'e05-config-datos-transferencia');
  const valid = page.getByText(/Validación automática de comprobantes/i).first();
  if (await valid.isVisible().catch(() => false)) await valid.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot(page, 'e06-config-validacion-automatica');

  // 5. Lista de deportistas (desde donde la escuela abre la ficha y el estado de cuenta)
  await page.goto(`${BASE_URL}/students`);
  await settle(page, 4000);
  await shot(page, 'e07-deportistas');

  fs.writeFileSync(LOG_PATH, lines.join('\n'));
});
