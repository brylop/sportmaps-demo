// Capturas REALES + pruebas del Entrenador V2 (manual docs/manuales/v2/).
// Patrón: memoria feedback_pdf_manual_template (nunca mockups).
//
//   node docs/manuales/_src/manual-entrenador-v2/capture.mjs <seccion> [<seccion>…]
//   node docs/manuales/_src/manual-entrenador-v2/capture.mjs todo
//
// Secciones: perfil hoy equipos partidoA criterios partidoB partidoC calendario
//            sesiones asistencia planillas matricula mas
//
// Ambiente: BASE_URL (por defecto https://dev.sportmaps.co), que apunta a la Supabase
// compartida. Tenant: Club Campestre Demo (is_demo=true). Entrenador: Andrés Ríos
// (entrenador.futbol@demo.sportmaps.co, creado con scripts/demo-club-campestre/add-coach.mjs).
//
// Cada sección guarda:
//   shots/<nn>-<nombre>.png         captura (390×844 @3x, móvil; las de escritorio 1600×1000 @2x)
//   shots/_texto/<nn>-<nombre>.txt  texto visible de la pantalla (para revisar y para el reporte)
//   shots/_datos.json               ids de lo creado (partidos, eventos, listas…)
// Las secciones que CREAN datos miran primero si ya existen (por rival/fecha/título) y no duplican.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'https://dev.sportmaps.co';
const SHOTS = path.join(here, 'shots');
const TXT = path.join(SHOTS, '_texto');
fs.mkdirSync(TXT, { recursive: true });
const DATOS_F = path.join(SHOTS, '_datos.json');
const datos = fs.existsSync(DATOS_F) ? JSON.parse(fs.readFileSync(DATOS_F, 'utf8')) : {};
const guardarDatos = () => fs.writeFileSync(DATOS_F, JSON.stringify(datos, null, 2));

function readEnv(dir, files) {
  const env = {};
  for (const f of files) {
    const fp = path.join(repo, dir, f);
    if (!fs.existsSync(fp)) continue;
    for (const line of fs.readFileSync(fp, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#]*)"?\s*$/);
      if (m) env[m[1]] = m[2].trim();
    }
  }
  return env;
}
const FE = readEnv('frontend', ['.env', '.env.local']);
const SUPABASE_URL = FE.VITE_SUPABASE_URL;
const SUPABASE_KEY = FE.VITE_SUPABASE_PUBLISHABLE_KEY || FE.VITE_SUPABASE_ANON_KEY;
// Solo LECTURA con la service key (verificar qué existe antes de crear). Toda escritura
// pasa por la interfaz, con la sesión del entrenador o del owner.
const BFF = readEnv('bff', ['.env']);
const SR = BFF.SUPABASE_SERVICE_ROLE_KEY;

const PASSWORD = 'Demo2026!';
const COACH = 'entrenador.futbol@demo.sportmaps.co';
const OWNER = 'gerencia@demo.sportmaps.co';
const SCHOOL = '25a123f0-6d57-48a4-9800-7b1531d61cd2';
const SUB15 = '658d014e-26b9-44dd-bfde-8eed0a3a14ac';
const SUB12 = '92ee5e2a-5bcb-4850-974f-e3a2d52b74c2';

const hoyCO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const masDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function leer(q) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: { apikey: SR, Authorization: `Bearer ${SR}` } });
  if (!r.ok) throw new Error(`leer ${q}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function loginAs(context, email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login ${email}: ${res.status} ${await res.text()}`);
  const session = await res.json();
  const ref = new URL(SUPABASE_URL).host.split('.')[0];
  await context.addInitScript(([key, value]) => {
    try {
      window.localStorage.setItem(key, value);
      window.localStorage.setItem('sm_push_banner_dismissed', '1'); // banner «Activa las notificaciones»
    } catch {}
  }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
}

// El Playwright del repo puede pedir una versión de Chromium que no está descargada:
// se usa la más nueva que haya en la caché local.
function launch() {
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1]);
    for (const d of dirs) {
      const exe = path.join(base, d, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(exe)) return chromium.launch({ executablePath: exe });
    }
  }
  return chromium.launch();
}

const httpErrores = [];
async function sesion(browser, email, { desk = false } = {}) {
  const context = await browser.newContext(desk
    ? { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, locale: 'es-CO', timezoneId: 'America/Bogota' }
    : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'es-CO', timezoneId: 'America/Bogota' });
  await loginAs(context, email);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  page.on('response', (r) => {
    if (r.status() >= 400 && /supabase\.co|bff|onrender/.test(r.url())) {
      const linea = `${r.status()} ${r.request().method()} ${r.url().replace(/\?.*/, '')}`;
      httpErrores.push(linea);
      console.log('  [http]', linea);
    }
  });
  return { context, page };
}

async function ir(page, ruta, ms = 3500) {
  await page.goto(BASE_URL + ruta);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function shot(page, nombre, { full = false } = {}) {
  await page.screenshot({ path: path.join(SHOTS, `${nombre}.png`), fullPage: full });
  const texto = await page.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText);
  fs.writeFileSync(path.join(TXT, `${nombre}.txt`), `${page.url()}\n\n${texto}`);
  console.log(`  📸 ${nombre}`);
}
const espera = (page, ms = 1200) => page.waitForTimeout(ms);

// ─────────────────────────────────────────────────────────────────────────────
const SECCIONES = {};

// 1 · Primer ingreso: perfil profesional (se abre solo la primera vez en Hoy)
SECCIONES.perfil = async (browser) => {
  const { context, page } = await sesion(browser, COACH);
  await ir(page, '/dashboard', 5000);
  const dlg = page.getByRole('dialog').filter({ hasText: 'Perfil Profesional' });
  if (!(await dlg.count())) { console.log('  · el perfil profesional ya estaba completo'); await context.close(); return; }
  await shot(page, '01-perfil-vacio');
  const campo = (label) => dlg.locator(`xpath=.//label[contains(., "${label}")]/following::input[1]`);
  await campo('Nombre Completo').fill('Andrés Ríos');
  await campo('Número de Documento').fill('1020304050');
  await campo('WhatsApp').fill('3115550203');
  await dlg.locator('xpath=.//label[contains(., "Deporte Principal")]/following::button[@role="combobox"][1]').click();
  await page.getByRole('option', { name: /^Fútbol$/ }).first().click();
  await espera(page, 600);
  await shot(page, '02-perfil-lleno');
  await dlg.getByRole('button', { name: 'Siguiente' }).click();
  await espera(page, 1000);
  await shot(page, '03-perfil-certificados');
  await dlg.getByRole('button', { name: /Guardar Perfil/ }).last().click();
  await espera(page, 4000);
  await shot(page, '04-hoy-tras-perfil');
  await context.close();
};

// 2 · Hoy
SECCIONES.hoy = async (browser) => {
  const { context, page } = await sesion(browser, COACH);
  await ir(page, '/dashboard', 5000);
  await shot(page, '05-hoy');
  await shot(page, '05-hoy-full', { full: true });
  await context.close();
};

// 3 · Equipos: lista, deportistas, ficha, felicitar
SECCIONES.equipos = async (browser) => {
  const { context, page } = await sesion(browser, COACH);
  await ir(page, '/teams', 4000);
  await shot(page, '10-equipos');
  await ir(page, `/teams?equipo=${SUB15}&tab=deportistas`, 6000);
  await shot(page, '11-deportistas');
  await page.getByText('Tomás Herrera', { exact: true }).click();
  await espera(page, 1200);
  await shot(page, '12-deportista-acciones');
  await page.getByRole('button', { name: 'Felicitar' }).first().click().catch(() => page.getByText('Felicitar').first().click());
  await espera(page, 1500);
  await shot(page, '13-felicitar');
  await page.keyboard.press('Escape');
  await espera(page, 800);
  await page.getByText('Ver ficha').first().click();
  await espera(page, 5000);
  await shot(page, '14-ficha');
  await shot(page, '14-ficha-full', { full: true });
  await ir(page, `/teams?equipo=${SUB15}&tab=evaluar`, 6000);
  await shot(page, '15-equipo-evaluar');
  await context.close();
};

// ── Partidos ────────────────────────────────────────────────────────────────
async function partidoExistente(teamId, rival, fecha) {
  const r = await leer(`match_results?team_id=eq.${teamId}&opponent=eq.${encodeURIComponent(rival)}&match_date=eq.${fecha}&select=id,status,home_score,away_score`);
  return r[0] ?? null;
}

/** Programar un partido desde Equipos → Partidos → «+ Partido». Devuelve el id. */
async function programar(page, { teamId, rival, fecha, hora, lugar, tipo, nota, yaSeJugo, prefijo }) {
  await ir(page, `/teams?equipo=${teamId}&tab=partidos`, 5000);
  if (prefijo) await shot(page, `${prefijo}-tab-antes`);
  await page.getByRole('link', { name: /Partido$/ }).first().click();
  await espera(page, 3000);
  await page.locator('#pf-rival').fill(rival);
  await page.locator('#pf-fecha').fill(fecha);
  if (hora) await page.locator('#pf-hora').fill(hora);
  if (lugar) await page.locator('#pf-lugar').fill(lugar);
  if (tipo) await page.getByRole('button', { name: tipo, exact: true }).first().click().catch(() => page.getByText(tipo, { exact: true }).first().click());
  if (nota) await page.locator('#pf-notas').fill(nota);
  await espera(page, 500);
  if (prefijo) { await shot(page, `${prefijo}-programar`); await shot(page, `${prefijo}-programar-full`, { full: true }); }
  const boton = yaSeJugo ? /registrar el resultado/ : /Programar y convocar/;
  await page.getByRole('button', { name: boton }).first().click();
  await page.waitForURL(/\/partidos\/[0-9a-f-]{36}/, { timeout: 20000 });
  await espera(page, 3000);
  return page.url().match(/\/partidos\/([0-9a-f-]{36})/)[1];
}

const FUTURO = () => masDias(hoyCO(), 5);

// Partido A: por jugar (convocatoria, calendario, pizarra)
SECCIONES.partidoA = async (browser) => {
  const { context, page } = await sesion(browser, COACH);
  const fecha = FUTURO();
  const rival = 'Halcones FC';
  let ex = await partidoExistente(SUB15, rival, fecha);
  let id = ex?.id;
  if (!id) {
    id = await programar(page, { teamId: SUB15, rival, fecha, hora: '09:00', lugar: 'Cancha fútbol 11, Club Campestre', tipo: 'Liga', nota: 'Llegar 8:15 a.m. con uniforme blanco.', prefijo: '20' });
    console.log('  ✓ partido A creado', id);
  } else { await ir(page, `/partidos/${id}?paso=convocar`, 5000); }
  datos.partidoA = { id, rival, fecha, equipo: 'Fútbol — Sub-15' };
  await shot(page, '21-convocar');
  await shot(page, '21-convocar-full', { full: true });
  const conv = page.getByRole('button', { name: /^Convocar/ });
  if (await conv.count()) {
    await conv.first().click();
    await espera(page, 3500);
    await shot(page, '22-convocados');
  }
  // La pestaña Partidos con el próximo partido
  await ir(page, `/teams?equipo=${SUB15}&tab=partidos`, 6000);
  await shot(page, '23-tab-proximo');
  await shot(page, '23-tab-proximo-full', { full: true });
  await page.getByRole('button', { name: /alineación en la pizarra/ }).click();
  await espera(page, 5000);
  await shot(page, '24-pizarra');
  await context.close();
  // El evento de calendario que crea create_match
  datos.partidoA.eventos = await leer(`calendar_events?school_id=eq.${SCHOOL}&title=ilike.*Halcones*&select=id,title,event_type,start_time,team_id`);
  console.log('  · eventos ligados:', JSON.stringify(datos.partidoA.eventos));
};

// Partido B: se jugó hoy → convocar, resultado con gol/asistencia/tarjeta, evaluar, reporte
SECCIONES.partidoB1 = async (browser) => {
  const { context, page } = await sesion(browser, COACH);
  const fecha = hoyCO();
  const rival = 'Atlético Sabana';
  let id = (await partidoExistente(SUB15, rival, fecha))?.id;
  if (!id) {
    id = await programar(page, { teamId: SUB15, rival, fecha, hora: '08:00', lugar: 'Cancha fútbol 11', tipo: 'Amistoso', yaSeJugo: true, prefijo: '30' });
    console.log('  ✓ partido B creado', id);
  }
  datos.partidoB = { id, rival, fecha, equipo: 'Fútbol — Sub-15' };
  // Convocar a 3 de 4 (Julieta no fue)
  await ir(page, `/partidos/${id}?paso=convocar`, 5000);
  const julieta = page.getByRole('checkbox', { name: /Julieta/ }).or(page.locator('[aria-checked]').filter({ hasText: 'Julieta' }));
  if (await page.getByRole('button', { name: /^Convocar/ }).count()) {
    if ((await julieta.first().getAttribute('aria-checked')) === 'true') await julieta.first().click();
    await espera(page, 500);
    await shot(page, '31-convocar-3');
    await page.getByRole('button', { name: /^Convocar/ }).first().click();
    await espera(page, 3500);
  }
  await shot(page, '32-convocados');
  await page.getByRole('button', { name: /Siguiente: resultado/ }).click();
  await espera(page, 3000);
  await shot(page, '33-resultado-vacio');
  const yaHay = await leer(`match_results?id=eq.${id}&select=status`);
  if (yaHay[0]?.status !== 'played') {
    const anotar = async (nombre, accion) => {
      const [n1, n2] = nombre.split(' ');
      const fila = page.locator('button[aria-expanded]').filter({ hasText: `${n1} ${n2[0]}.` }).first();
      if ((await fila.getAttribute('aria-expanded')) !== 'true') await fila.click();
      await espera(page, 500);
      await page.getByRole('button', { name: new RegExp(`Sumar ${accion} a ${nombre}`) }).click();
      await espera(page, 2500);
    };
    await anotar('Tomás Herrera', 'gol');
    await shot(page, '34-gol-anotado');
    await anotar('Renata Cárdenas', 'asistencia');
    await anotar('Tomás Duarte', 'amarilla');
    await page.getByRole('button', { name: `Sumar un gol a ${rival}` }).click().catch(() => {});
    await espera(page, 800);
    await page.getByRole('button', { name: `Restar un gol a ${rival}` }).click().catch(() => {});
    await espera(page, 800);
    await shot(page, '35-resultado-lleno');
    await shot(page, '35-resultado-lleno-full', { full: true });
    await page.getByRole('button', { name: /Guardar resultado/ }).click();
    await espera(page, 4000);
  }
  await ir(page, `/partidos/${id}?paso=evaluar`, 5000);
  await shot(page, '36-evaluar-sin-criterios');
  await context.close();
};

/**
 * BUG (ver pruebas-entrenador-v2.md): en el celular la barra fija de «Guardar resultado» /
 * «Guardar evaluación» (PartidoFlujo.tsx:622 y :850, z-20) queda DEBAJO de la barra inferior
 * de la app (MobileBottomNav, z-30). Un usuario no la puede tocar. Para seguir probando el
 * resto del flujo, se dispara el clic por código y se deja anotado.
 */
async function clicTapado(page, nombre) {
  const b = page.getByRole('button', { name: nombre }).first();
  const tapado = await b.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !(top === el || el.contains(top));
  });
  if (tapado) console.log(`  ⚠ «${nombre}» está tapado por otra capa: clic forzado por código`);
  datos.tapados = [...new Set([...(datos.tapados ?? []), String(nombre)])];
  await b.dispatchEvent('click');
}

SECCIONES.partidoB2 = async (browser) => {
  const id = datos.partidoB.id;
  const { context, page } = await sesion(browser, COACH);
  const st = (await leer(`match_results?id=eq.${id}&select=status`))[0]?.status;
  if (st !== 'played') {
    await ir(page, `/partidos/${id}?paso=cerrar`, 5000);
    await shot(page, '35b-resultado-boton-tapado');
    await clicTapado(page, /Guardar resultado/);
    await espera(page, 4000);
  }
  await ir(page, `/partidos/${id}?paso=evaluar`, 5000);
  await shot(page, '40-evaluar-lista');
  const ev = await leer(`performance_entries?source_id=eq.${id}&select=id&limit=1`).catch(() => []);
  await page.getByRole('button', { name: /Tomás H\./ }).first().click();
  await espera(page, 1200);
  if (!ev.length) {
    const notas = [4, 5, 4, 3, 4, 5];
    const radios = page.locator('main button[role="radio"]');
    for (let i = 0; i < notas.length; i++) { await radios.nth(i * 5 + notas[i] - 1).click(); await espera(page, 150); }
    await page.locator('main textarea').first().fill('Gran partido: abrió el marcador y presionó la salida rival. A mejorar: el perfil para recibir.');
    await espera(page, 500);
  }
  await shot(page, '41-evaluar-tomas');
  await shot(page, '41-evaluar-tomas-full', { full: true });
  if (!ev.length) { await clicTapado(page, /^Guardar evaluación$/); await espera(page, 4000); }
  await shot(page, '42-evaluacion-guardada');
  await shot(page, '42-evaluacion-guardada-full', { full: true });
  await ir(page, `/partidos/${id}?paso=reporte`, 5000);
  await shot(page, '43-reporte');
  await page.getByRole('button', { name: /Escribir el reporte|Ver o editar el reporte/ }).click();
  await espera(page, 1500);
  const dlg = page.getByRole('dialog').last();
  if (!(await dlg.locator('textarea').first().inputValue())) {
    const t = dlg.locator('textarea');
    await t.nth(0).fill('Ganamos 1–0 un partido parejo. Buen orden defensivo.');
    await t.nth(1).fill('Arrancamos presionando alto; el gol llegó al minuto 18 tras una recuperación de Renata. En el segundo tiempo cuidamos la pelota.');
    await t.nth(2).fill('Salida desde el fondo bajo presión y finalización.');
    await dlg.locator('#mr-publish').click().catch(() => {});
  }
  await espera(page, 600);
  await shot(page, '44-reporte-dialogo');
  await dlg.getByRole('button', { name: /Guardar|Publicar/ }).last().click();
  await espera(page, 3500);
  await shot(page, '45-reporte-guardado');
  // La lista de partidos del equipo con el resultado nuevo
  await ir(page, `/teams?equipo=${SUB15}&tab=partidos`, 6000);
  await shot(page, '46-tab-resultados-full', { full: true });
  await context.close();
  // En escritorio la misma pantalla sí muestra el botón (md:static)
  const d = await sesion(browser, COACH, { desk: true });
  await ir(d.page, `/partidos/${id}?paso=cerrar`, 5000);
  await shot(d.page, '47-escritorio-resultado');
  await d.context.close();
};

/** Hace scroll hasta un texto y toma la pantalla (la app hace scroll en un contenedor interno). */
async function shotEn(page, nombre, texto, { bloque = 'start' } = {}) {
  const el = typeof texto === 'string' ? page.getByText(texto, { exact: false }).first() : texto;
  await el.evaluate((e, b) => e.scrollIntoView({ block: b }), bloque).catch(() => {});
  await espera(page, 700);
  await shot(page, nombre);
}

// Partido C: ya se jugó y nadie registró el marcador → «Falta el resultado»
SECCIONES.partidoC = async (browser) => {
  const { context, page } = await sesion(browser, COACH);
  const fecha = masDias(hoyCO(), -3);
  const rival = 'Deportivo Chía';
  let id = (await partidoExistente(SUB15, rival, fecha))?.id;
  if (!id) {
    id = await programar(page, { teamId: SUB15, rival, fecha, tipo: 'Liga', yaSeJugo: true, prefijo: '50' });
    console.log('  ✓ partido C creado (sin resultado)', id);
    await shot(page, '51-ya-se-jugo-resultado');
  }
  datos.partidoC = { id, rival, fecha, equipo: 'Fútbol — Sub-15' };
  await ir(page, `/teams?equipo=${SUB15}&tab=partidos`, 6000);
  await shotEn(page, '52-falta-el-resultado', 'Falta el resultado');
  await shotEn(page, '53-resultados', 'Resultados', { bloque: 'center' });
  await context.close();
};

// Calendario: evento tipo Partido para un equipo → crea el partido (create_match) y ofrece «Abrir partido»
SECCIONES.calendario = async (browser) => {
  const { context, page } = await sesion(browser, COACH);
  await ir(page, '/calendar', 5000);
  await shot(page, '60-calendario');
  const titulo = 'Partido vs Club Los Andes';
  const ya = await leer(`calendar_events?school_id=eq.${SCHOOL}&title=eq.${encodeURIComponent(titulo)}&select=id,team_id,start_time`);
  {
    await page.getByRole('button', { name: /Nuevo Evento|Nuevo evento/ }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.waitFor();
    await espera(page, 800);
    await shot(page, '61-nuevo-evento');
    await dlg.getByPlaceholder(/Campeonato/).fill(titulo);
    const paraQuien = dlg.locator('div.space-y-2:has(label:has-text("Para quién")) [role="combobox"]');
    await paraQuien.click();
    await page.getByRole('option', { name: /Sub-12/ }).click();
    const tipo = dlg.locator('div.space-y-2:has(label:has-text("Tipo de Evento")) [role="combobox"]');
    await tipo.click();
    await page.getByRole('option', { name: /Partido/ }).first().click();
    await espera(page, 600);
    await dlg.getByRole('button', { name: /Seleccionar fecha/ }).first().click();
    const dia = String(Number(masDias(hoyCO(), 4).slice(8)));
    // Los días de relleno del mes anterior también dicen «30»: se excluyen por su clase.
    await page.locator('button[name="day"]:not(.day-outside)').filter({ hasText: new RegExp(`^${dia}$`) }).first().click();
    await espera(page, 600);
    await dlg.getByPlaceholder('Ej: Halcones FC').fill('Club Los Andes');
    await espera(page, 600);
    await shot(page, '62-evento-partido-lleno');
    fs.writeFileSync(path.join(TXT, '62-dialogo.txt'), await dlg.innerText());
    if (ya.length) { await dlg.getByRole('button', { name: 'Cancelar' }).click(); }
    else {
    await dlg.getByRole('button', { name: /Crear|Guardar/ }).last().click();
    await espera(page, 4000);
    await shot(page, '63-evento-creado');
    }
    fs.writeFileSync(path.join(TXT, '63-toast-y-dialogo.txt'), await page.evaluate(() => document.body.innerText));
  }
  const ev = await leer(`calendar_events?school_id=eq.${SCHOOL}&title=eq.${encodeURIComponent(titulo)}&select=id,team_id,start_time,event_type`);
  const mt = await leer(`match_results?team_id=eq.${SUB12}&select=id,opponent,match_date,status&order=created_at.desc&limit=3`);
  datos.calendario = { eventos: ev, partidosSub12: mt };
  console.log('  · evento:', JSON.stringify(ev), '\n  · partidos Sub-12:', JSON.stringify(mt));
  await ir(page, '/calendar', 5000);
  await shotEn(page, '64-calendario-con-partido', 'Los Andes', { bloque: 'center' });
  // El día en la cuadrícula: el primer «30» es el de relleno de septiembre.
  const dia30 = String(Number(masDias(hoyCO(), 4).slice(8)));
  const celdas = page.getByText(dia30, { exact: true });
  await celdas.nth((await celdas.count()) > 1 && Number(dia30) > 20 ? 1 : 0).click();
  await espera(page, 1500);
  await shotEn(page, '65-evento-detalle', 'Eventos del', { bloque: 'start' });
  fs.writeFileSync(path.join(TXT, '65-detalle.txt'), await page.evaluate(() => document.body.innerText));
  await ir(page, `/teams?equipo=${SUB12}&tab=partidos`, 6000);
  await shot(page, '66-sub12-partidos');
  await context.close();
};

// Sesiones: Hoy · Semana · Plan del mes (móvil) + planificación completa (escritorio)
SECCIONES.sesiones = async (browser) => {
  const manana = masDias(hoyCO(), 1);
  // 1. Lo que ve el coach antes de planear
  {
    const { context, page } = await sesion(browser, COACH);
    await ir(page, '/training-plans', 8000);
    await shot(page, '70-sesiones-hoy');
    await page.getByRole('tab', { name: 'Semana' }).click(); await espera(page, 2500);
    await shot(page, '71-sesiones-semana');
    await page.getByRole('tab', { name: 'Plan del mes' }).click(); await espera(page, 2500);
    await shot(page, '72-sesiones-plan');
    await context.close();
  }
  // 2. Planificación completa: plan del mes (mesociclo) + sesión de mañana
  {
    const { context, page } = await sesion(browser, COACH, { desk: true });
    await ir(page, '/training-plans/planificar', 3000);
    await page.getByRole('combobox').first().click(); await espera(page, 800);
    await page.getByRole('option', { name: /Sub-15/ }).first().click(); await espera(page, 4000);
    await shot(page, '73-planificar');
    const meso = await leer(`training_mesocycles?team_id=eq.${SUB15}&starts_on=eq.${hoyCO()}&select=id`);
    if (!meso.length) {
      await page.locator('button:right-of(:text("Exportar PDF"))').first().click(); await espera(page, 800);
      await page.getByRole('menuitem', { name: 'Nuevo mesociclo' }).click(); await espera(page, 1500);
      const d = page.getByRole('dialog').last();
      await d.locator('textarea').first().fill('Presión tras pérdida y transiciones rápidas a campo contrario.');
      await d.locator('textarea').nth(1).fill('Presionar en bloque alto; atacar el espacio a la espalda.').catch(() => {});
      await espera(page, 500);
      await shot(page, '74-nuevo-mesociclo');
      await d.getByRole('button', { name: 'Crear Mesociclo' }).click();
      await espera(page, 4000);
      datos.mesociclo = (await leer(`training_mesocycles?team_id=eq.${SUB15}&starts_on=eq.${hoyCO()}&select=id,starts_on,ends_on`))[0];
    }
    await ir(page, '/training-plans/planificar', 3000);
    await page.getByRole('combobox').first().click(); await espera(page, 800);
    await page.getByRole('option', { name: /Sub-15/ }).first().click(); await espera(page, 4000);
    await shot(page, '75-mesociclo-creado');
    const ses = await leer(`training_sessions?team_id=eq.${SUB15}&session_date=eq.${manana}&select=id`).catch(() => []);
    if (!ses.length) {
      await page.getByRole('button', { name: /Agregar sesión/ }).first().click(); await espera(page, 1200);
      const dd = new Date(`${manana}T12:00:00Z`);
      const etiqueta = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][dd.getUTCDay()] + ' ' + dd.getUTCDate();
      await page.getByRole('button', { name: new RegExp(`^${etiqueta}`) }).first().click(); await espera(page, 2500);
      const d = page.getByRole('dialog').last();
      await d.locator('#materials').fill('Conos, 10 balones, petos de dos colores, 4 miniarcos');
      await d.locator('#objectives').fill('Recuperar la pelota en menos de 6 segundos tras perderla.');
      await d.locator('#game_principles').fill('Presión tras pérdida, coberturas, salida rápida.');
      const bloques = [
        ['Calentamiento', '15', 'Rondo 5 contra 2 con transición'],
        ['Parte principal', '40', 'Juego de posición 6 contra 6 + 2 comodines'],
        ['Partido condicionado', '25', 'Gol vale doble si se recupera en campo rival'],
      ];
      for (let i = 0; i < bloques.length; i++) {
        await d.getByPlaceholder('Nombre del bloque (ej: Calentamiento)').nth(i).fill(bloques[i][0]);
        await d.getByPlaceholder('Min').nth(i).fill(bloques[i][1]);
        await d.getByPlaceholder('Actividad / ejercicio').nth(i).fill(bloques[i][2]);
      }
      await espera(page, 500);
      await shot(page, '76-form-sesion');
      await d.getByRole('button', { name: 'Crear Sesión' }).click();
      await espera(page, 4000);
      await shot(page, '77-sesion-creada');
    }
    datos.sesionManana = await leer(`training_sessions?team_id=eq.${SUB15}&session_date=eq.${manana}&select=id,session_date,objectives`).catch((e) => e.message);
    await context.close();
  }
  // 3. Ya planeada: Semana, Ver sesión, modo cancha, Plan del mes
  {
    const { context, page } = await sesion(browser, COACH);
    await ir(page, '/training-plans', 5000);
    await page.getByRole('tab', { name: 'Semana' }).click(); await espera(page, 2500);
    await shot(page, '78-semana-con-plan');
    const abrirDia = async () => { await page.getByText('Recuperar la pelota').first().click(); await espera(page, 1200); };
    await abrirDia();
    await shot(page, '78b-dia-abierto');
    await page.getByRole('button', { name: /Abrir en la cancha/ }).first().click(); await espera(page, 2500);
    await shot(page, '80-modo-cancha');
    fs.writeFileSync(path.join(TXT, '80-body.txt'), await page.evaluate(() => document.body.innerText));
    await page.getByRole('button', { name: /Salir|Cerrar/ }).first().click().catch(() => page.keyboard.press('Escape'));
    await espera(page, 1500);
    await ir(page, '/training-plans', 4000);
    await page.getByRole('tab', { name: 'Semana' }).click(); await espera(page, 2500);
    await abrirDia();
    await page.getByRole('button', { name: 'Ver sesión' }).first().click(); await espera(page, 2500);
    await shot(page, '79-ver-sesion');
    fs.writeFileSync(path.join(TXT, '79-body.txt'), await page.evaluate(() => document.body.innerText));
    await ir(page, '/training-plans', 4000);
    await page.getByRole('tab', { name: 'Plan del mes' }).click(); await espera(page, 2500);
    await page.getByText('Fútbol — Sub-15', { exact: true }).first().click(); await espera(page, 2500);
    await shot(page, '81-plan-del-mes');
    fs.writeFileSync(path.join(TXT, '81-body.txt'), await page.evaluate(() => document.querySelector('main')?.innerText || ''));
    await context.close();
  }
};

/** ¿El botón está tapado por otra capa en el punto donde se tocaría? */
async function estaTapado(loc) {
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !(top === el || el.contains(top));
  }).catch(() => null);
}

// Asistencia: tomar lista (4 estados), guardar, evaluar al equipo, historial, escanear carnet
SECCIONES.asistencia = async (browser) => {
  const { context, page } = await sesion(browser, COACH);
  await ir(page, '/coach-attendance', 6000);
  await shot(page, '90-asistencia-elegir');
  await page.getByRole('button', { name: /Fútbol — Sub-15/ }).first().click();
  await espera(page, 4000);
  await shot(page, '91-lista-todos-vinieron');
  fs.writeFileSync(path.join(TXT, '91-body.txt'), await page.evaluate(() => document.body.innerText));
  {
    // Fija el estado leyendo el aria-label («Nombre: Vino. Toca para cambiar.») y tocando hasta llegar.
    const fijar = async (nombre, objetivo) => {
      for (let k = 0; k < 5; k++) {
        const b = page.getByRole('button', { name: new RegExp(`^${nombre}:`) });
        const lab = (await b.getAttribute('aria-label')) || '';
        if (lab.startsWith(`${nombre}: ${objetivo}.`)) return;
        await b.click(); await espera(page, 350);
      }
    };
    await fijar('Julieta Duarte', 'Faltó');
    await fijar('Renata Cárdenas', 'Excusa');
    await fijar('Tomás Duarte', 'Tarde');
    await fijar('Tomás Herrera', 'Vino');
    await espera(page, 600);
    await shot(page, '92-lista-marcada');
    await page.getByRole('button', { name: 'Más opciones' }).click().catch(() => {});
    await espera(page, 1000);
    await shot(page, '93-mas-opciones');
    fs.writeFileSync(path.join(TXT, '93-body.txt'), await page.evaluate(() => document.body.innerText));
    await page.getByRole('button', { name: 'Más opciones' }).click().catch(() => {});
    await espera(page, 600);
    const guardar = page.getByRole('button', { name: 'Guardar lista' });
    const tap = await estaTapado(guardar);
    console.log('  · «Guardar lista» tapado:', tap);
    datos.guardarListaTapado = tap;
    if (tap) await guardar.dispatchEvent('click'); else await guardar.click();
    await espera(page, 1500);
    await shot(page, '94-lista-guardada');
    fs.writeFileSync(path.join(TXT, '94-body.txt'), await page.evaluate(() => document.body.innerText));
    // «Deshacer · N»: la lista sube unos segundos después.
    await page.getByTestId('aviso-guardada').waitFor({ timeout: 45000 }).catch(() => console.log('  · la lista no terminó de subir en 45 s'));
    await espera(page, 800);
    await shot(page, '94b-lista-subida');
    fs.writeFileSync(path.join(TXT, '94b-body.txt'), await page.evaluate(() => document.body.innerText));
    datos.sesionAsistenciaHref = await page.getByRole('link', { name: 'Evaluar al equipo' }).getAttribute('href').catch(() => null);
    const cerrar = page.getByRole('button', { name: 'Cerrar la lista' });
    if (await cerrar.count()) {
      await cerrar.click(); await espera(page, 1000);
      await shot(page, '94c-cerrar-confirmar');
      await page.getByRole('button', { name: 'Sí, cerrar' }).click(); await espera(page, 4000);
      await shot(page, '94d-lista-cerrada');
      fs.writeFileSync(path.join(TXT, '94d-body.txt'), await page.evaluate(() => document.body.innerText));
    } else console.log('  · no apareció «Cerrar la lista»');
  }
  // Evaluar al equipo (post-entreno)
  if (datos.sesionAsistenciaHref) {
    await ir(page, datos.sesionAsistenciaHref, 6000);
    await shot(page, '95-evaluar-equipo');
    fs.writeFileSync(path.join(TXT, '95-body.txt'), await page.evaluate(() => document.body.innerText));
    const g = page.getByRole('radiogroup', { name: /Tomás Herrera/ });
    if (await g.count()) {
      await g.getByRole('button', { name: /Bien/ }).first().click().catch(() => g.locator('button').first().click());
      await page.locator('#nota-familias').fill('Buen entreno de presión tras pérdida. El jueves seguimos con salida desde el fondo.').catch(() => {});
      await espera(page, 600);
      await shot(page, '96-evaluar-equipo-lleno');
      const b = page.getByRole('button', { name: 'Guardar evaluación' });
      const tap = await estaTapado(b);
      datos.guardarEvalEntrenoTapado = tap;
      console.log('  · «Guardar evaluación» (entreno) tapado:', tap);
      if (tap) await b.dispatchEvent('click'); else await b.click();
      await espera(page, 4000);
      await shot(page, '97-evaluacion-entreno-guardada');
      datos.sesionAsistencia = page.url();
    }
  } else console.log('  · no apareció «Evaluar al equipo»');
  // Historial
  await ir(page, '/coach-attendance', 5000);
  await page.getByRole('tab', { name: 'Historial' }).or(page.getByRole('button', { name: 'Historial' })).first().click();
  await espera(page, 8000);
  await shot(page, '98-historial');
  fs.writeFileSync(path.join(TXT, '98-body.txt'), await page.evaluate(() => document.querySelector('main')?.innerText || ''));
  // Escanear carnets (sin cámara: el navegador de prueba no la tiene; no se captura la cámara)
  await ir(page, '/coach-attendance/scan', 5000);
  await shot(page, '99-escanear');
  fs.writeFileSync(path.join(TXT, '99-body.txt'), await page.evaluate(() => document.body.innerText));
  await context.close();
};

// La administración siembra los criterios de partido (el coach no puede)
SECCIONES.criterios = async (browser) => {
  const ya = await leer(`school_metric_definitions?school_id=eq.${SCHOOL}&select=id&limit=1`);
  const { context, page } = await sesion(browser, OWNER);
  await ir(page, `/partidos/${datos.partidoB.id}?paso=evaluar`, 6000);
  await shot(page, '37-owner-evaluar');
  if (!ya.length) {
    await page.getByRole('button', { name: /criterios sugeridos para partidos/ }).click();
    await espera(page, 5000);
    await shot(page, '38-owner-criterios-creados');
  }
  await context.close();
};

const SECC = process.argv.slice(2);
const orden = SECC.includes('todo') ? Object.keys(SECCIONES) : SECC;
if (!orden.length) { console.log('Uso: capture.mjs <seccion…>|todo. Secciones:', Object.keys(SECCIONES).join(' ')); process.exit(1); }

const browser = await launch();
try {
  for (const s of orden) {
    if (!SECCIONES[s]) throw new Error(`Sección desconocida: ${s}`);
    console.log(`▶ ${s}`);
    await SECCIONES[s](browser).catch(async (e) => {
      console.log(`  ✗ ${s}: ${e.message.split(/\r?\n/).slice(0, 3).join(' | ')}`);
      process.exitCode = 1;
      for (const c of browser.contexts()) {
        for (const pg of c.pages()) await pg.screenshot({ path: path.join(SHOTS, `_error-${s}.png`) }).catch(() => {});
        await c.close().catch(() => {});
      }
    });
  }
} finally {
  await browser.close();
  guardarDatos();
  if (httpErrores.length) fs.appendFileSync(path.join(TXT, '_http-errores.log'), httpErrores.map((l) => `${new Date().toISOString()} ${l}`).join('\n') + '\n');
}
export { leer, hoyCO, masDias };
