// Capturas REALES + prueba de punta a punta del modal «Inscribir atleta» (torneos internos).
//
//   node docs/manuales/_src/torneos-inscribir-atleta/capture.mjs
//
// Contra https://dev.sportmaps.co, tenant «Club Campestre Demo» (nunca Besser: inscribir
// avisa a la familia). ESCRIBE datos en el demo: 2 torneos internos (uno gratis, uno con
// costo) y 3 inscripciones. Imprime un JSON con lo que verificó.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, newSession, here, BASE_URL, rest, SCHOOL_ID } from './lib.mjs';

const SHOTS = path.join(here, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const settle = (p, ms = 1200) => p.waitForTimeout(ms);
const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, name) });
const dialog = (p) => p.getByRole('dialog');
const dshot = async (p, name) => { await settle(p, 500); await dialog(p).screenshot({ path: path.join(SHOTS, name) }); };
const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '');
const out = { checks: [] };
const check = (name, ok, extra) => { out.checks.push({ name, ok: !!ok, ...(extra ? { extra } : {}) }); console.log(ok ? 'OK  ' : 'FAIL', name, extra ?? ''); };

async function crearTorneo(page, { titulo, conCosto, prefijo }) {
  await page.goto(`${BASE_URL}/school/tournaments`);
  await page.getByRole('heading', { name: 'Mis Torneos' }).waitFor({ timeout: 40_000 });
  await settle(page, 1500);
  if (prefijo) await shot(page, `${prefijo}-01-lista.png`);
  await page.getByRole('button', { name: /Crear torneo|Crear mi primer torneo/ }).first().click();
  await page.getByRole('heading', { name: 'Crear Torneo' }).waitFor();
  await page.locator('select').first().selectOption('internal');
  await settle(page, 500);
  if (conCosto) {
    await page.locator('#price').fill('50000');
    // medios: efectivo siempre existe
    await page.getByText('Efectivo en la escuela').click();
  } else {
    await page.locator('#is_paid').click();
  }
  await page.locator('#title').fill(titulo);
  await page.locator('#sport').fill('Fútbol');
  await page.locator('#event_date').fill('2026-11-21');
  await page.locator('#registration_deadline').fill('2026-11-14');
  await page.locator('#address').fill('Cancha principal del club');
  await page.locator('#city').fill('Bogotá');
  await settle(page, 500);
  if (prefijo) await page.screenshot({ path: path.join(SHOTS, `${prefijo}-02-crear.png`), fullPage: true });
  await page.getByRole('button', { name: 'Crear torneo' }).click();
  await page.getByRole('heading', { name: 'Mis Torneos' }).waitFor({ timeout: 30_000 });
  await settle(page, 1500);
  const ev = await rest(`events?select=id,title,status,is_paid,payment_methods,tournament_scope&school_id=eq.${SCHOOL_ID}&title=eq.${encodeURIComponent(titulo)}`);
  return ev[0];
}

async function prepararYPublicar(page, ev, { prefijo }) {
  await page.goto(`${BASE_URL}/school/tournaments/${ev.id}`);
  await page.getByRole('heading', { name: ev.title }).waitFor({ timeout: 40_000 });
  await settle(page, 1500);
  if (prefijo) await shot(page, `${prefijo}-03-borrador.png`);
  await page.getByRole('tab', { name: /Categorías/ }).click();
  await settle(page, 600);
  await page.getByRole('button', { name: /Agregar/ }).first().click();
  await page.getByPlaceholder('Categoría').first().fill('Sub 12');
  await settle(page, 400);
  if (prefijo) await shot(page, `${prefijo}-04-categorias.png`);
  await page.getByRole('button', { name: /Guardar categorías y precios/ }).click();
  await settle(page, 2500);
  await page.getByRole('button', { name: 'Publicar' }).click();
  await page.getByText('Publicado').first().waitFor({ timeout: 20_000 });
  await settle(page, 1200);
}

async function abrirModal(page, ev) {
  await page.getByRole('tab', { name: 'Inscritos' }).click();
  await settle(page, 1500);
  await page.getByRole('button', { name: 'Inscribir atleta' }).click();
  await dialog(page).waitFor();
  await page.waitForFunction(() => !document.querySelector('[role=dialog] .animate-pulse'), null, { timeout: 20_000 }).catch(() => {});
  await settle(page, 800);
}

async function inscribir(page, nombre) {
  await dialog(page).getByPlaceholder('Nombre del deportista').fill(nombre);
  await settle(page, 500);
  const fila = dialog(page).locator('div.flex.items-center.justify-between', { hasText: nombre }).first();
  await fila.getByRole('button', { name: 'Inscribir' }).click();
}

const browser = await chromium.launch();
try {
  const { page } = await newSession(browser, { viewport: { width: 1400, height: 1000 } });

  // ───── A · Torneo GRATIS ─────
  const SKIP_A = process.env.SKIP_A;
  const tituloA = `Copa Interna Demo ${stamp}`;
  const evA = SKIP_A ? (await rest(`events?select=id,title,status,is_paid,payment_methods,tournament_scope&id=eq.${SKIP_A}`))[0] : await crearTorneo(page, { titulo: tituloA, conCosto: false, prefijo: 'a' });
  check('A: torneo gratis creado como borrador interno', evA && evA.is_paid === false && evA.status === 'draft' && evA.tournament_scope === 'internal', evA && { is_paid: evA.is_paid, status: evA.status });
  if (!SKIP_A) {
  await prepararYPublicar(page, evA, { prefijo: 'a' });
    const evA2 = (await rest(`events?select=status&id=eq.${evA.id}`))[0];
    check('A: publicado', evA2?.status === 'active', evA2);
  
    await page.getByRole('tab', { name: 'Inscritos' }).click();
    await settle(page, 1500);
    await shot(page, 'a-05-inscritos-vacio.png');
    await abrirModal(page, evA);
    await dshot(page, 'a-06-modal.png');
    const descA = await dialog(page).innerText();
    check('A: el modal dice «torneo es gratis»', /gratis: no se cobra/.test(descA));
  
    await inscribir(page, 'Alejandro Peña');
    await page.getByText('Atleta inscrito').first().waitFor({ timeout: 20_000 });
    await settle(page, 600);
    await page.screenshot({ path: path.join(SHOTS, 'a-07-inscrito-aviso.png') });
    const regA = await rest(`event_registrations?select=id,status,child_id,payment_id&event_id=eq.${evA.id}`);
    check('A: 1 inscripción aprobada y SIN cobro', regA.length === 1 && regA[0].status === 'approved' && !regA[0].payment_id, regA);
  
    // repetir → «Ya estaba inscrito»
    await settle(page, 3500);
    await inscribir(page, 'Alejandro Peña');
    await page.getByText('Ya estaba inscrito').first().waitFor({ timeout: 20_000 });
    await page.screenshot({ path: path.join(SHOTS, 'a-08-ya-inscrito.png') });
    const regA2 = await rest(`event_registrations?select=id&event_id=eq.${evA.id}`);
    check('A: repetir NO duplica', regA2.length === 1, regA2.length);
  
    // buscar uno que no existe
    await dialog(page).getByPlaceholder('Nombre del deportista').fill('zzzz');
    await settle(page, 500);
    check('A: búsqueda sin resultados muestra el mensaje', /No hay atletas que coincidan/.test(await dialog(page).innerText()));
    await dshot(page, 'a-09-sin-resultados.png');
    await dialog(page).getByPlaceholder('Nombre del deportista').fill('');
    await dialog(page).getByRole('button', { name: /Close|Cerrar/i }).click();
    await settle(page, 1500);
    await page.getByRole('tab', { name: 'Inscritos' }).click();
    await settle(page, 800);
    await shot(page, 'a-10-inscritos-lista.png');
    check('A: la lista de inscritos muestra al atleta', /Alejandro Peña/.test(await page.locator('body').innerText()));
  
  
  } else {
    await page.goto(`${BASE_URL}/school/tournaments/${evA.id}`);
    await page.getByRole('heading', { name: evA.title }).waitFor({ timeout: 40_000 });
    await settle(page, 1500);
    await page.getByRole('tab', { name: 'Inscritos' }).click();
    await settle(page, 1500);
    await shot(page, 'a-10-inscritos-lista.png');
    check('A: la lista de inscritos muestra al atleta', /Alejandro Peña/.test(await page.locator('body').innerText()));
  }

  // ───── B · Torneo CON COSTO ─────
  const tituloB = `Copa Con Costo Demo ${stamp}`;
  const evB = await crearTorneo(page, { titulo: tituloB, conCosto: true, prefijo: 'b' });
  check('B: torneo con costo creado', evB && evB.is_paid === true && (evB.payment_methods || []).includes('efectivo'), evB && { is_paid: evB.is_paid, medios: evB.payment_methods });
  await prepararYPublicar(page, evB, { prefijo: 'b' });
  await abrirModal(page, evB);
  await dshot(page, 'b-05-modal.png');
  check('B: el modal dice «Se crea el cobro al acudiente»', /Se crea el cobro al acudiente/.test(await dialog(page).innerText()));
  await inscribir(page, 'Antonia Quintero');
  await page.getByText('Atleta inscrito').first().waitFor({ timeout: 20_000 });
  await settle(page, 400);
  await page.screenshot({ path: path.join(SHOTS, 'b-06-inscrito-con-cobro.png') });
  const regB = await rest(`event_registrations?select=id,status,payment_id,child_id&event_id=eq.${evB.id}`);
  let pago = null;
  if (regB[0]?.payment_id) pago = (await rest(`payments?select=id,amount,status,payer_id,payment_category,payment_method&id=eq.${regB[0].payment_id}`))[0];
  check('B: inscripción aprobada con cobro de $50.000 pendiente', regB.length === 1 && regB[0].status === 'approved' && pago && Number(pago.amount) === 50000, { reg: regB[0]?.status, pago });
  await dialog(page).getByRole('button', { name: /Close|Cerrar/i }).click();
  await settle(page, 1200);
  await page.getByRole('tab', { name: 'Inscritos' }).click();
  await settle(page, 800);
  await shot(page, 'b-07-inscritos-lista.png');

  // ───── C · Edición de Info (interruptor de costo) ─────
  await page.getByRole('tab', { name: 'Info' }).click();
  await settle(page, 800);
  await page.screenshot({ path: path.join(SHOTS, 'b-08-info-cobro.png'), fullPage: true });

  out.ids = { gratis: evA.id, conCosto: evB.id, titulos: [tituloA, tituloB] };
} catch (e) {
  console.log('ERROR', e.message);
  out.error = e.message;
  try { const pg = browser.contexts()[0]?.pages()[0]; if (pg) await pg.screenshot({ path: path.join(SHOTS, 'error.png') }); } catch {}
} finally {
  await browser.close();
  fs.writeFileSync(path.join(here, 'resultado.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}
