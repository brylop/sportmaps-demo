// Capturas REALES para el manual «Cobros y pagos» (docs/manuales/README.md).
//
//   PHASE=A node docs/manuales/_src/cobros-y-pagos/capture.mjs     (A | B | C | D)
//
// Contra https://dev.sportmaps.co (BASE_URL), escuela de pruebas «Escuela Pruebas».
// Login sin contraseña: lib.mjs (generate_link + verify con la service key de
// bff/.env; nunca se imprime). La bandera del modal nuevo se enciende en
// localStorage de cada contexto. ESCRIBE datos reales en esa escuela:
//   A  Mateo Ensayo: paga en efectivo la mensualidad 08/2026 con 10 % de descuento
//      y crea+paga un uniforme de $10.000 (ref. MANUAL-A).
//   B  Sofía Ensayo (desde Deportistas): 2 cobros nuevos con descuento general 20 %, sin pago.
//   C  Sofía + Mateo (modo varios): 1 cobro de $10.000 a cada uno y luego «Anular lote».
//   D  Operaciones: «Quitar descuento» a un cobro del lote de B.
// «Avisar a las familias» queda SIEMPRE apagado.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, newSession, here, BASE_URL } from './lib.mjs';

const SHOTS = path.join(here, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const PHASE = (process.env.PHASE || 'A').toUpperCase();
const VP = { width: 1600, height: 1250 };
const settle = (page, ms = 1200) => page.waitForTimeout(ms);
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name) });
const modal = (page) => page.getByTestId('cobros-y-pagos-modal');
const dshot = async (page, name) => { await settle(page, 600); await modal(page).screenshot({ path: path.join(SHOTS, name) }); };

async function openFromPagos(page, tab) {
  await page.goto(`${BASE_URL}/payments-automation${tab ? `?tab=${tab}` : ''}`);
  await page.getByRole('heading', { name: /Gestión de Pagos/ }).waitFor({ timeout: 40_000 });
  await settle(page, 2500);
}
async function openModalFromPagos(page) {
  await page.getByRole('button', { name: /Cobros y pagos/ }).first().click();
  await modal(page).waitFor();
  await settle(page, 2500);
}
async function pickAthlete(page, name) {
  await modal(page).getByRole('combobox').first().click();
  await page.getByPlaceholder(/Nombre, acudiente/).fill(name);
  await settle(page, 500);
}
async function waitPreview(page) {
  await page.waitForFunction(() => !/Calculando|Cambiaste algo|Esperando la vista previa/.test(document.querySelector('[data-testid="cobros-y-pagos-modal"]')?.innerText || ''), null, { timeout: 30_000 }).catch(() => {});
  await settle(page, 800);
}
async function selectOption(page, trigger, optionName) {
  await trigger.click();
  await page.getByRole('option', { name: optionName }).first().click();
}

async function phaseA(page) {
  await openFromPagos(page);
  await shot(page, '01-pagos-boton.png');
  await openModalFromPagos(page);
  await dshot(page, '02-modal-vacio.png');
  await pickAthlete(page, 'Ensayo');
  await dshot(page, '03-selector.png');
  await page.getByText('[ENSAYO WA] Mateo Ensayo').first().click();
  await settle(page, 3000);
  await dshot(page, '04-pendientes.png');
  const m = modal(page);
  // marcar 08/2026 + descuento 10 % Convenio
  await m.getByRole('checkbox', { name: /Incluir Mensualidad 08\/2026/ }).click();
  await settle(page, 600);
  await m.getByRole('button', { name: 'Descuento' }).first().click();
  await m.getByLabel('Valor del descuento').first().fill('10');
  await selectOption(page, m.getByLabel('Motivo del descuento').first(), 'Convenio');
  await waitPreview(page);
  await dshot(page, '05-descuento-linea.png');
  // nuevo cobro: uniforme $10.000
  await m.getByRole('button', { name: /Agregar cobro/ }).click();
  await settle(page, 500);
  await selectOption(page, m.getByLabel('Tipo de cobro').first(), 'Artículos / uniformes');
  await m.getByLabel('Detalle del cobro').first().fill('Uniforme de entrenamiento');
  await m.getByLabel('Valor', { exact: true }).first().fill('10000');
  await settle(page, 400);
  await m.getByLabel('Tipo de cobro').first().click();
  await settle(page, 500);
  await page.screenshot({ path: path.join(SHOTS, '06-tipos-de-cobro.png') });
  await page.keyboard.press('Escape');
  await settle(page, 500);
  // pago por fuera: efectivo + referencia
  await m.locator('#cyp-pay-ref').fill('MANUAL-A');
  await waitPreview(page);
  await dshot(page, '07-listo-para-confirmar.png');
  await m.getByTestId('cyp-primary').click();
  await m.getByTestId('cyp-result').waitFor({ timeout: 40_000 });
  await settle(page, 800);
  await dshot(page, '08-resultado.png');
  await m.getByRole('button', { name: 'Cerrar' }).first().click();
  // Historial: el pago recién registrado
  await openFromPagos(page, 'history');
  await page.getByPlaceholder(/Buscar alumno, padre o concepto/).fill('Mateo Ensayo');
  await settle(page, 1800);
  await shot(page, '09-historial.png');
}

async function phaseB(page) {
  await page.goto(`${BASE_URL}/students`);
  await page.getByPlaceholder(/Buscar/).first().waitFor({ timeout: 40_000 });
  await page.getByPlaceholder(/Buscar/).first().fill('Sofía Ensayo');
  await settle(page, 2500);
  await shot(page, '10-deportistas.png');
  // En el listado (escritorio) el lápiz de la fila abre dos opciones.
  await page.getByRole('button', { name: /Editar a / }).first().click();
  await settle(page, 600);
  await shot(page, '11-deportistas-menu.png');
  await page.getByRole('menuitem', { name: /Editar estado de cuenta|Cobros y pagos/ }).click();
  await modal(page).waitFor();
  await settle(page, 3000);
  await dshot(page, '12-deportistas-modal.png');
  const m = modal(page);
  await m.getByRole('button', { name: /Agregar cobro/ }).click();
  await settle(page, 400);
  await m.getByLabel('Detalle del cobro').nth(0).fill('Torneo Relámpago');
  await m.getByLabel('Valor', { exact: true }).nth(0).fill('10000');
  await m.getByRole('button', { name: /Agregar cobro/ }).click();
  await settle(page, 400);
  await selectOption(page, m.getByLabel('Tipo de cobro').nth(1), 'Seguro');
  await m.getByLabel('Valor', { exact: true }).nth(1).fill('10000');
  // sin pago por fuera: se apaga «Ya lo pagaron»
  await m.locator('#cyp-paid').click();
  await settle(page, 500);
  // descuento general 20 % Beca
  await m.locator('#cyp-global-on').click();
  await settle(page, 400);
  await m.getByLabel('Valor del descuento').first().fill('20');
  await selectOption(page, m.getByLabel('Motivo del descuento').first(), 'Beca');
  await waitPreview(page);
  await dshot(page, '13-descuento-general.png');
  await m.getByTestId('cyp-primary').click();
  await m.getByTestId('cyp-result').waitFor({ timeout: 40_000 });
  await settle(page, 800);
  await dshot(page, '14-resultado-sin-pago.png');
  await m.getByRole('button', { name: 'Cerrar' }).first().click();
}

async function phaseC(page) {
  await openFromPagos(page);
  await openModalFromPagos(page);
  const m = modal(page);
  await m.getByTestId('cyp-mode-multi').click();
  await settle(page, 1500);
  await dshot(page, '15-multi-vacio.png');
  // Por equipo (solo se mira: no se confirma)
  await m.getByText('Equipo', { exact: true }).click();
  await selectOption(page, m.getByLabel('Grupo'), 'f');
  await settle(page, 2500);
  await dshot(page, '15b-multi-equipo.png');
  // Confirmado: dos deportistas elegidos a mano, con inscripción activa
  await m.getByText('A mano', { exact: true }).click();
  await settle(page, 600);
  await m.getByLabel('Buscar atleta').fill('Emilio Torres');
  await settle(page, 600);
  await m.getByLabel(/Emilio Torres/).click();
  await m.getByLabel('Buscar atleta').fill('Valentina Salcedo');
  await settle(page, 600);
  await m.getByLabel(/Valentina Salcedo/).click();
  await m.getByLabel('Buscar atleta').fill('Emilio');
  await settle(page, 600);
  const line = m.getByTestId('cyp-line-0');
  await line.getByLabel('Detalle del cobro').fill('Cuadrangular Ensayo');
  await line.getByLabel('Valor', { exact: true }).fill('10000');
  await page.waitForFunction(() => { const b = document.querySelector('[data-testid="cyp-primary"]'); return b && !b.disabled; }, null, { timeout: 60_000 });
  await settle(page, 600);
  await dshot(page, '16-multi-vista-previa.png');
  if (process.env.STOP_BEFORE_SUBMIT) return; // solo recapturar la vista previa, sin confirmar
  await m.getByTestId('cyp-primary').click();
  await m.getByTestId('cyp-result').waitFor({ timeout: 40_000 });
  await settle(page, 800);
  await dshot(page, '17-multi-resultado.png');
  await m.getByRole('button', { name: 'Anular lote' }).click();
  await settle(page, 2000);
  const d = page.getByRole('dialog').filter({ hasText: 'Solo se anula lo que nadie ha pagado' }).last();
  await d.getByLabel(/Motivo/).fill('Ensayo del manual: cobro de prueba');
  await settle(page, 400);
  await d.screenshot({ path: path.join(SHOTS, '18-anular-lote.png') });
  await d.getByRole('button', { name: /^Anular \d/ }).click();
  await settle(page, 2500);
}

async function phaseD(page) {
  await openFromPagos(page, 'operaciones');
  await page.getByTestId('operaciones-tab').waitFor();
  await settle(page, 2500);
  await shot(page, '19-operaciones.png');
  const card = page.locator('[data-testid^="op-"]').filter({ hasText: '$16.000' }).first();
  await card.getByRole('button', { name: /Ver detalle/ }).click();
  await settle(page, 3000);
  await card.screenshot({ path: path.join(SHOTS, '20-operaciones-detalle.png') });
  await card.getByRole('button', { name: /Quitar descuento/ }).first().click();
  await settle(page, 800);
  const d = page.getByRole('dialog').filter({ hasText: 'Solo se puede si nadie ha pagado' }).last();
  await d.getByLabel(/Motivo/).fill('Ensayo del manual');
  await d.screenshot({ path: path.join(SHOTS, '21-quitar-descuento.png') });
  await d.getByRole('button', { name: 'Quitar descuento' }).click();
  await settle(page, 3000);
  // recarga la pestaña para ver el estado ya guardado
  await openFromPagos(page, 'operaciones');
  await page.getByTestId('operaciones-tab').waitFor();
  await settle(page, 2000);
  const card2 = page.locator('[data-testid^="op-"]').filter({ hasText: '$16.000' }).first();
  await card2.getByRole('button', { name: /Ver detalle/ }).click();
  await settle(page, 3500);
  await card2.screenshot({ path: path.join(SHOTS, '22-descuento-quitado.png') });
}

const b = await chromium.launch();
let pg = null;
try {
  const { page } = await newSession(b, { viewport: VP });
  pg = page;
  await ({ A: phaseA, B: phaseB, C: phaseC, D: phaseD }[PHASE])(page);
  console.log('fase', PHASE, 'ok');
} catch (e) {
  console.error(e.message);
  if (pg) await pg.screenshot({ path: path.join(SHOTS, `_error-${PHASE}.png`) }).catch(() => {});
  process.exitCode = 1;
} finally {
  await b.close();
}
