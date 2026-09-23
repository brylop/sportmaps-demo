import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// QA exploratorio: cómo se ve el PROCESO DE PAGO desde el acudiente.
// Se detiene ANTES de confirmar cualquier pago: solo captura pantallas.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3004';
const SHOT_DIR = path.join(__dirname, 'screenshots', 'proceso-pago');
const LOG_PATH = path.join(SHOT_DIR, 'padre-log.txt');
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
  await page.getByPlaceholder('tu@correo.com').fill('mherrera@demo.sportmaps.co');
  await page.getByPlaceholder('••••••••').fill('Demo2026!');
  await page.getByRole('button', { name: /Entrar ahora/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 }).catch(() => log('LOGIN no salió de /login'));
  await settle(page, 3000);
}

test.use({ viewport: { width: 1280, height: 900 } });

test('Padre: ver el proceso de pago sin completarlo', async ({ page }) => {
  test.setTimeout(240_000);
  page.on('pageerror', (e) => log(`PAGEERROR ${e.message}`));
  await login(page);

  // 1. Mis pagos → pestaña Pendientes
  await page.goto(`${BASE_URL}/my-payments`);
  await settle(page, 4000);
  await shot(page, 'p01-mis-pagos');
  await page.getByRole('tab', { name: /Pendientes/i }).click().catch(() => log('sin tab Pendientes'));
  await page.waitForTimeout(1500);
  await shot(page, 'p02-mis-pagos-pendientes', true);

  // 2. Abrir el modal de pago: botón "Pagar" de la tarjeta, o tarjeta + "Pagar Ahora"
  let opened = false;
  const payBtn = page.getByRole('button', { name: /^Pagar( ahora)?$/i }).first();
  if (await payBtn.isVisible().catch(() => false)) {
    await payBtn.click();
    opened = true;
    log('abrí con botón Pagar de la tarjeta');
  } else {
    const card = page.getByText(/Mensualidad/i).first();
    await card.click();
    await page.waitForTimeout(1200);
    await shot(page, 'p02b-tarjeta-seleccionada-barra-flotante');
    const bar = page.getByRole('button', { name: /Pagar Ahora/i }).first();
    if (await bar.isVisible().catch(() => false)) {
      await bar.click();
      opened = true;
      log('abrí con barra flotante Pagar Ahora');
    }
  }
  if (!opened) {
    log('No pude abrir el modal de pago');
    fs.writeFileSync(LOG_PATH, lines.join('\n'));
    return;
  }
  await page.waitForTimeout(3500);
  const dialog = page.getByRole('dialog').first();
  await shot(page, 'p03-modal-metodos');
  log('--- TEXTO DEL MODAL (métodos) ---');
  log((await dialog.innerText().catch(() => '')).slice(0, 4000));

  // 3. Transferencia / Nequi / Daviplata
  const transfer = dialog.getByText(/Transferencia \/ Nequi/i).first();
  if (await transfer.isVisible().catch(() => false)) {
    await transfer.click();
    await page.waitForTimeout(2500);
    await shot(page, 'p04-transferencia-datos');
    await dialog.evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, 'p05-transferencia-comprobante');
    log('--- TEXTO DEL MODAL (transferencia) ---');
    log((await dialog.innerText().catch(() => '')).slice(0, 6000));
  } else {
    log('No apareció la opción Transferencia');
  }

  // 4. Pago en línea (Wompi) — hasta el diálogo de confirmación, NO confirmar
  const online = dialog.getByText(/Pago en línea|Pagar en línea|Wompi|PSE/i).first();
  if (await online.isVisible().catch(() => false)) {
    await online.click();
    await page.waitForTimeout(2000);
    await dialog.evaluate((el) => { el.scrollTop = 0; }).catch(() => {});
    await shot(page, 'p06-pago-en-linea');
    await dialog.evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, 'p07-pago-en-linea-boton');
    log('--- TEXTO DEL MODAL (online) ---');
    log((await dialog.innerText().catch(() => '')).slice(0, 4000));
    const goOnline = dialog.getByRole('button', { name: /Pagar|Continuar|Ir a pagar/i }).last();
    if (await goOnline.isVisible().catch(() => false)) {
      await goOnline.click();
      await page.waitForTimeout(2000);
      await shot(page, 'p08-confirmacion-online');
      const confirm = page.getByRole('alertdialog').first();
      log('--- CONFIRMACIÓN ONLINE ---');
      log((await confirm.innerText().catch(() => '(sin alertdialog)')).slice(0, 2000));
      const cancel = page.getByRole('button', { name: /Cancelar|Volver|Atrás/i }).first();
      if (await cancel.isVisible().catch(() => false)) await cancel.click();
    }
  } else {
    log('No apareció la opción de pago en línea');
  }

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(800);

  // 5. Estado de cuenta de un hijo
  await page.getByRole('tab', { name: /Todas/i }).click().catch(() => {});
  await page.getByText(/Estado de cuenta — Sofía/i).first().click().catch(() => log('sin botón estado de cuenta'));
  await settle(page, 4000);
  await shot(page, 'p09-estado-de-cuenta', true);
  log(`URL estado de cuenta: ${page.url()}`);

  fs.writeFileSync(LOG_PATH, lines.join('\n'));
});
