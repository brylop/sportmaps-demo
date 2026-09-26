import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Verificación en vivo del recorte de clics del acudiente (2026-09-25):
//  - banner del dashboard → Mis Pagos con el modal abierto solo (?pay=auto)
//  - modal de pago con método preseleccionado y UN solo botón de Wompi
//  - /register?role=parent sin "Confirmar contraseña" ni calendario, con la
//    casilla de mayoría de edad y el WhatsApp obligatorio
//  - /notifications navega al tocar una tarjeta con enlace
// Corre contra el dev server YA levantado en :3004 (playwright.qa-discovery.config.ts).
// NO toca el botón "Pagar online" ni envía el registro: no crea datos.

const BASE_URL = 'http://localhost:3004';
const SHOT_DIR = path.join(__dirname, 'screenshots', 'padre-flujo-corto');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('tu@correo.com').fill('mherrera@demo.sportmaps.co');
  await page.getByPlaceholder('••••••••').fill('Demo2026!');
  await page.getByRole('button', { name: /Entrar ahora/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
}

test.describe.configure({ mode: 'serial' });

test('A - banner del dashboard abre Mis Pagos (con modal si hay un solo cobro)', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

  // Sin pantalla de bienvenida: no debe existir el botón del splash.
  await expect(page.getByRole('button', { name: /vamos a empezar/i })).toHaveCount(0);

  const banner = page.getByRole('button', { name: /Tienes \d+ pagos? pendientes?/i });
  const bannerCount = await banner.count();
  console.log(`banner de pagos pendientes: ${bannerCount ? await banner.first().innerText() : '(no hay cobros pendientes)'}`);
  await shot(page, 'A1-dashboard');
  if (!bannerCount) return;

  const text = await banner.first().innerText();
  const n = Number((text.match(/Tienes (\d+)/) || [])[1] || 0);
  await banner.first().click();
  await page.waitForURL(/\/my-payments/, { timeout: 20000 });
  const landed = new URL(page.url());
  console.log(`aterrizó en ${landed.pathname}${landed.search} (cobros en el banner: ${n})`);
  if (n === 1) {
    // el atajo va con ?pay=auto y MyPaymentsPage lo limpia al procesarlo
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).searchParams.get('pay')).toBeNull();
  }
  await shot(page, 'A2-my-payments-tras-banner');
});

test('B - modal de pago: método preseleccionado y un solo botón de Wompi', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE_URL}/my-payments`);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const pagar = page.getByRole('button', { name: /^Pagar$/i });
  const count = await pagar.count();
  console.log(`botones PAGAR directos: ${count}`);
  test.skip(count === 0, 'el acudiente demo no tiene cobros pagables directamente');

  await pagar.first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15000 });
  // settings de la escuela cargan async; la preselección viene después
  await page.waitForTimeout(2500);
  await shot(page, 'B1-modal-abierto');

  const online = dialog.getByRole('button', { name: /Pagar online \$/ });
  const transfer = dialog.getByRole('button', { name: /^Pagar \$/ });
  const wompiListed = await dialog.getByText('Pagar online (Wompi)').count();
  console.log(`Wompi en la lista: ${wompiListed > 0}; botón online visible: ${await online.count()}; botón transferencia visible: ${await transfer.count()}`);

  if (wompiListed > 0) {
    // Preseleccionado Wompi → desglose + botón único, sin segundo modal.
    await expect(online).toBeVisible();
    await expect(dialog.getByText('Total a pagar')).toBeVisible();
    await expect(dialog.getByText(/Recargo por pago online/)).toBeVisible();
    await expect(page.getByText(/Confirmar y pagar/)).toHaveCount(0);
  } else {
    // Sin Wompi → transferencia preseleccionada: datos bancarios y botón Pagar.
    await expect(transfer).toBeVisible();
  }
  await shot(page, 'B2-metodo-preseleccionado');
});

test('C - registro de acudiente: sin confirmar contraseña ni calendario; casilla y WhatsApp', async ({ page }) => {
  await page.goto(`${BASE_URL}/register?role=parent`);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

  await expect(page.getByPlaceholder('Repetir')).toHaveCount(0);
  await expect(page.getByText('Selecciona una fecha')).toHaveCount(0);
  await expect(page.getByText(/Soy mayor de edad y acudiente/)).toBeVisible();
  await expect(page.getByText(/^WhatsApp/)).toBeVisible();
  await shot(page, 'C1-register-parent');

  // Enviar vacío: la validación es local (zod), no crea nada.
  await page.getByRole('button', { name: /Crear mi cuenta/i }).click();
  await expect(page.getByText(/Confirma que eres mayor de edad/)).toBeVisible();
  await expect(page.getByText(/Tu WhatsApp es obligatorio/)).toBeVisible();
  await shot(page, 'C2-register-parent-validacion');
});

test('D - registro de atleta conserva la fecha de nacimiento', async ({ page }) => {
  await page.goto(`${BASE_URL}/register?role=athlete`);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await expect(page.getByText('Selecciona una fecha')).toBeVisible();
  await expect(page.getByText(/Soy mayor de edad y acudiente/)).toHaveCount(0);
});

test('E - /notifications navega al tocar una tarjeta con enlace', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE_URL}/notifications`);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const ver = page.getByRole('button', { name: /^Ver$/ });
  const n = await ver.count();
  console.log(`notificaciones con enlace: ${n}`);
  await shot(page, 'E1-notifications');
  test.skip(n === 0, 'ninguna notificación del demo trae link');
  await ver.first().click();
  await page.waitForURL((url) => !url.pathname.includes('/notifications'), { timeout: 15000 });
  console.log(`navegó a ${new URL(page.url()).pathname}`);
  await shot(page, 'E2-tras-tocar-notificacion');
});

test('F - /my-payments?pay=<id> abre el modal de ese cobro y limpia el parámetro', async ({ page }) => {
  // Cobro vencido real del acudiente demo (Sofía Herrera, $210.000), leído por SQL el 2026-09-25.
  const PAYMENT_ID = '727d4ea7-b43b-4b68-935b-a6eb60c12d26';
  await login(page);
  await page.goto(`${BASE_URL}/my-payments?pay=${PAYMENT_ID}`);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 25000 });
  await expect(dialog.getByText(/Sofía Herrera/).first()).toBeVisible();
  await expect(dialog.getByText('$ 210.000').first()).toBeVisible();
  await page.waitForTimeout(500);
  expect(new URL(page.url()).searchParams.get('pay')).toBeNull();
  await shot(page, 'F1-pay-id-abre-modal');
  console.log('modal abierto directo por ?pay=<id>, sin tocar la lista');
});
