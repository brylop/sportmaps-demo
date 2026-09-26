// Capturas REALES + video para el manual "Pizarra táctica" (material, tamaño y giro,
// siluetas, balón en juego, modo arqueros, plantillas). Ver docs/manuales/README.md y
// la memoria feedback_pdf_manual_template: nunca mockups.
//
//   BASE_URL=https://stg.sportmaps.co node docs/manuales/_src/pizarra-tactica/capture.mjs
//
// Requiere:
//   * un frontend desplegado con la pizarra F1 (commit 2b1dc946) — stg y prod la tienen;
//   * frontend/.env con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY;
//   * en el tenant demo, una sesión de "Fútbol — Sub-10" con bloques (se sembró el
//     2026-09-25, id 817c0183-…; si no existe, crearla desde la app con "Crear Sesión").
//
// Tenant: Club Campestre Demo (is_demo=true), cuenta owner. Deja guardadas UNA
// alineación del bloque y UNA plantilla "Arqueros 1v1" del equipo demo: sirven
// para demos. No toca ninguna escuela real.
//
// El video sale del mismo recorrido (Playwright recordVideo): subtítulos y cursor
// se inyectan en la página y se esconden en el instante de cada captura fija.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'https://stg.sportmaps.co';
const SHOTS = path.join(here, 'shots');
const VIDEO = path.join(here, 'video-raw');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(VIDEO, { recursive: true });

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
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ENV.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ENV.VITE_SUPABASE_PUBLISHABLE_KEY || ENV.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY en frontend/.env');

const PASSWORD = 'Demo2026!';
const OWNER = 'gerencia@demo.sportmaps.co'; // Ricardo Mendoza · ve todos los equipos
// Sub-10: sin mesociclo. Con mesociclo activo la lista plana de sesiones se
// oculta y una sesión no enganchada a un día no muestra su "Tablero táctico".
const TEAM = /Fútbol — Sub-10/;

async function loginAs(context, email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login ${email}: ${res.status} ${await res.text()}`);
  const session = await res.json();
  const ref = new URL(SUPABASE_URL).host.split('.')[0];
  await context.addInitScript(([key, value]) => {
    try { window.localStorage.setItem(key, value); } catch {}
  }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
}

// ── Overlay para el video: subtítulo + cursor. Se esconde en cada captura fija.
const OVERLAY_JS = `
(() => {
  if (document.getElementById('__cap')) return;
  const cap = document.createElement('div');
  cap.id = '__cap';
  Object.assign(cap.style, {
    position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)',
    maxWidth: '78vw', padding: '12px 20px', borderRadius: '14px',
    background: 'rgba(10,20,14,0.88)', color: '#fff', font: '600 20px/1.35 Inter, system-ui, sans-serif',
    boxShadow: '0 8px 30px rgba(0,0,0,.45)', border: '1px solid rgba(79,209,122,.55)',
    zIndex: '2147483647', pointerEvents: 'none', display: 'none', textAlign: 'center',
  });
  document.body.appendChild(cap);
  const cur = document.createElement('div');
  cur.id = '__cur';
  Object.assign(cur.style, {
    position: 'fixed', left: '0px', top: '0px', width: '22px', height: '22px', borderRadius: '50%',
    background: 'rgba(255,136,51,.85)', border: '3px solid #fff', boxShadow: '0 0 0 4px rgba(255,136,51,.35)',
    transform: 'translate(-50%,-50%)', zIndex: '2147483647', pointerEvents: 'none', display: 'none',
  });
  document.body.appendChild(cur);
  window.addEventListener('pointermove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
  window.addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
  window.addEventListener('pointerdown', () => { cur.style.transform = 'translate(-50%,-50%) scale(0.7)'; }, true);
  window.addEventListener('pointerup', () => { cur.style.transform = 'translate(-50%,-50%) scale(1)'; }, true);
})();`;

let page; // se asigna en run()
const settle = (ms = 900) => page.waitForTimeout(ms);
async function overlay(show) {
  await page.evaluate((show) => {
    const c = document.getElementById('__cap'); const k = document.getElementById('__cur');
    if (c) c.style.display = show && c.textContent ? 'block' : 'none';
    if (k) k.style.display = show ? 'block' : 'none';
  }, show).catch(() => {});
}
async function caption(text, ms = 1400) {
  await page.evaluate(OVERLAY_JS);
  await page.evaluate((t) => { const c = document.getElementById('__cap'); if (c) { c.textContent = t; c.style.display = 'block'; } const k = document.getElementById('__cur'); if (k) k.style.display = 'block'; }, text);
  await settle(ms);
}
async function snap(name) {
  await overlay(false);
  await settle(250);
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: false });
  await overlay(true);
}
async function glide(x, y, steps = 24) { await page.mouse.move(x, y, { steps }); }
async function drag(from, to, steps = 30) {
  await glide(from.x, from.y, 16);
  await page.mouse.down();
  await settle(120);
  await page.mouse.move(to.x, to.y, { steps });
  await settle(120);
  await page.mouse.up();
}

/** Rect del SVG más grande del diálogo = la cancha. */
async function pitchRect(dialog) {
  const svgs = dialog.locator('svg');
  const n = await svgs.count();
  let best = null;
  for (let i = 0; i < n; i++) {
    const b = await svgs.nth(i).boundingBox().catch(() => null);
    if (b && (!best || b.width * b.height > best.width * best.height)) best = b;
  }
  if (!best) throw new Error('No encontré la cancha (svg) en el tablero');
  return best;
}
const at = (rect, px, py) => ({ x: rect.x + (px / 100) * rect.width, y: rect.y + (py / 100) * rect.height });

async function setRange(locator, value) {
  await locator.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, locale: 'es-CO',
    recordVideo: { dir: VIDEO, size: { width: 1600, height: 1000 } },
  });
  await loginAs(context, OWNER);
  page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  let videoPath = null;
  try {
    // 1 · Métricas y Rendimiento → equipo → sesión → "Tablero táctico"
    await page.goto(`${BASE_URL}/training-plans`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.getByRole('heading', { name: /Métricas y Rendimiento|Sesiones/ }).first().waitFor({ timeout: 30_000 }).catch(() => {});
    await settle(1200);
    await caption('1 · Métricas y Rendimiento: elige el equipo', 1500);
    const combo = page.getByRole('combobox').first();
    await combo.click();
    await page.getByRole('option', { name: TEAM }).first().click();
    await settle(2200);
    await caption('En la sesión, cada bloque tiene su botón "Tablero táctico"', 1400);
    const boardBtn = page.getByRole('button', { name: /Tablero táctico/ }).first();
    await boardBtn.scrollIntoViewIfNeeded();
    await settle(400);
    await snap('01-abrir-desde-sesion.png');
    await boardBtn.click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ timeout: 30_000 });
    await dialog.getByRole('button', { name: /^Pizarra/ }).waitFor({ timeout: 30_000 });
    await settle(2000);
    await caption('2 · El tablero abre a pantalla completa con la cancha y la plantilla', 1500);
    // Asegurar plantilla abierta y pizarra abierta
    const rosterBtn = dialog.getByRole('button', { name: /^Plantilla \(/ });
    if (!(await dialog.locator('.cursor-grab').count())) { await rosterBtn.click(); await settle(600); }
    await snap('02-tablero.png');

    // 3 · Jugadores: arrastrar desde la plantilla
    let rect = await pitchRect(dialog);
    await caption('3 · Arrastra cada jugador desde la plantilla a su posición', 1200);
    const cards = dialog.locator('.cursor-grab');
    const targets = [[50, 88], [30, 68], [70, 68], [50, 45]];
    const nCards = Math.min(await cards.count(), targets.length);
    for (let i = 0; i < nCards; i++) {
      // La lista se encoge al colocar: siempre se toma la primera tarjeta que quede.
      // Si un arrastre no "cae" (dnd-kit necesita recorrido antes de soltar), se reintenta una vez.
      for (let attempt = 0; attempt < 2; attempt++) {
        const before = await cards.count();
        if (before === 0) break;
        const b = await cards.first().boundingBox();
        if (!b) break;
        await drag({ x: b.x + b.width / 2, y: b.y + b.height / 2 }, at(rect, targets[i][0], targets[i][1]), 44);
        await settle(900);
        if ((await cards.count()) < before) break;
      }
    }
    await settle(600);
    await snap('03-jugadores.png');

    // 4 · Siluetas
    await caption('Discos o siluetas: el arquero sale en amarillo', 1200);
    await dialog.locator('[title^="Ver jugadores como siluetas"]').click();
    await settle(1000);
    await snap('04-siluetas.png');

    // 5 · Material
    await caption('4 · Pizarra → Material: 11 objetos, un toque en la cancha los coloca', 1600);
    const pizBtn = dialog.getByRole('button', { name: /^Pizarra/ });
    if (!(await dialog.locator('[title="Cono"]').count())) { await pizBtn.click(); await settle(700); }
    rect = await pitchRect(dialog);
    const material = [
      ['Cono', 12, 20], ['Plato', 22, 20], ['Balón', 32, 20], ['Arco', 50, 8], ['Arco chico', 82, 20],
      ['Vallita', 12, 34], ['Aro', 24, 34], ['Escalera', 40, 34], ['Estaca', 60, 34], ['Maniquí', 74, 34], ['Rival', 88, 34],
    ];
    for (const [label, px, py] of material) {
      await dialog.locator(`[title="${label}"]`).first().click();
      await settle(250);
      const pt = at(rect, px, py);
      await glide(pt.x, pt.y, 14);
      await page.mouse.down(); await page.mouse.up();
      await settle(350);
    }
    await settle(500);
    await snap('05-material.png');

    // 6 · Seleccionar, tamaño, giro, duplicar
    await caption('5 · Toca un objeto para seleccionarlo: tamaño, giro, duplicar o quitar', 1500);
    const cone = at(rect, 12, 20);
    await glide(cone.x, cone.y, 14);
    await page.mouse.down(); await page.mouse.up();
    await settle(600);
    await setRange(dialog.getByLabel('Tamaño del objeto'), 2.2);
    await settle(700);
    await dialog.getByRole('button', { name: /\+90°/ }).click();
    await settle(700);
    await snap('06-seleccion-tamano-giro.png');
    await caption('Duplicar copia el objeto con su tamaño y giro', 1000);
    await dialog.getByRole('button', { name: /Duplicar/ }).click();
    await settle(900);
    await snap('07-duplicar.png');

    // 7 · Colores
    await caption('6 · Nueve colores para líneas, zonas y material', 1200);
    await dialog.getByRole('button', { name: 'Color Rojo' }).click();
    await settle(300);
    await dialog.locator('[title="Cono"]').first().click();
    for (const [px, py] of [[30, 52], [40, 52], [50, 52]]) {
      const pt = at(rect, px, py); await glide(pt.x, pt.y, 10); await page.mouse.down(); await page.mouse.up(); await settle(250);
    }
    await dialog.getByRole('button', { name: 'Color Azul' }).click();
    await settle(300);
    await snap('08-colores.png');

    // 8 · Líneas: flecha, curva, zona
    await caption('7 · Líneas: flecha, curva y zona. Arrastra sobre la cancha', 1300);
    await dialog.getByRole('button', { name: 'Flecha', exact: true }).click();
    await drag(at(rect, 30, 68), at(rect, 36, 40), 26);
    await settle(400);
    await dialog.getByRole('button', { name: 'Curva', exact: true }).click();
    await drag(at(rect, 70, 68), at(rect, 60, 42), 26);
    await settle(400);
    await dialog.getByRole('button', { name: 'Color Amarillo' }).click();
    await dialog.getByRole('button', { name: 'Zona', exact: true }).click();
    await drag(at(rect, 40, 56), at(rect, 64, 66), 26);
    await settle(600);
    await snap('09-lineas.png');

    // 9 · Balón en juego: pase y remate; reproducir
    await caption('8 · Balón en juego: pase, remate o penal. "Reproducir jugada" lo anima', 1500);
    await dialog.getByRole('button', { name: 'Color Blanco' }).click();
    await dialog.locator('[title="Balón"]').first().click();
    const ballPt = at(rect, 50, 88);
    await glide(ballPt.x, ballPt.y, 10); await page.mouse.down(); await page.mouse.up();
    await settle(300);
    await dialog.getByRole('button', { name: 'Pase', exact: true }).click();
    await drag(at(rect, 50, 86), at(rect, 30, 67), 26);
    await settle(300);
    await dialog.getByRole('button', { name: 'Remate', exact: true }).click();
    await drag(at(rect, 30, 66), at(rect, 50, 10), 26);
    await settle(600);
    await snap('10-balon-en-juego.png');
    await caption('Reproducir jugada: jugadores y balón recorren sus líneas y vuelven', 800);
    await dialog.getByRole('button', { name: /Reproducir jugada/ }).click();
    await settle(900);
    await snap('11-reproduciendo.png');
    await settle(4500);

    // 10 · Modo arqueros: situación + zoom al área (cambiar de situación vacía las figuras)
    await caption('9 · Situación "Arqueros": la cancha hace zoom al área', 1400);
    const situation = dialog.getByRole('combobox').first();
    await situation.click();
    await page.getByRole('option', { name: 'Arqueros' }).click();
    await settle(1500);
    rect = await pitchRect(dialog);
    await snap('13-modo-arqueros.png');
    await caption('Arco, maniquíes, balones y conos para el trabajo del arquero', 1300);
    await dialog.getByRole('button', { name: 'Color Blanco' }).click();
    for (const [label, px, py] of [['Arco', 50, 2], ['Maniquí', 40, 22], ['Maniquí', 60, 22], ['Balón', 50, 40], ['Balón', 36, 44], ['Cono', 28, 30], ['Cono', 72, 30]]) {
      await dialog.locator(`[title="${label}"]`).first().click();
      await settle(200);
      const pt = at(rect, px, py); await glide(pt.x, pt.y, 10); await page.mouse.down(); await page.mouse.up(); await settle(300);
    }
    await dialog.getByRole('button', { name: 'Remate', exact: true }).click();
    await drag(at(rect, 50, 40), at(rect, 44, 4), 24);
    await settle(700);
    await snap('14-arqueros-material.png');

    // 11 · Guardar como plantilla
    await caption('10 · Guardar como plantilla para reusarla en otra sesión', 1200);
    await dialog.locator('[title="Guardar como plantilla"]').first().click();
    await dialog.getByPlaceholder('Nombre').fill('Arqueros 1v1');
    await settle(500);
    await snap('15-plantilla-nombre.png');
    await dialog.getByRole('button', { name: /^OK$/ }).click();
    await page.getByText(/Plantilla guardada/).first().waitFor({ timeout: 15_000 }).catch(() => {});
    await settle(900);
    await snap('16-plantilla-guardada.png');

    // 12 · Volver a cancha completa
    await caption('El botón de zoom vuelve a la cancha completa sin perder nada', 1100);
    await dialog.locator('[title="Ver la cancha completa"]').click();
    await settle(1200);
    await snap('17-cancha-completa.png');

    // 13 · Guardar la alineación del bloque (cierra el tablero al terminar)
    await caption('11 · Guardar: jugadores y figuras quedan en este bloque de la sesión', 1300);
    await dialog.getByRole('button', { name: /^Guardar$/ }).click();
    await page.getByText(/guardad/i).first().waitFor({ timeout: 15_000 }).catch(() => {});
    await settle(700);
    await snap('12-guardado.png');
    await caption('Listo. Todo se guarda con la sesión o como plantilla del equipo', 1800);
    await overlay(false);
    await settle(500);
  } finally {
    videoPath = await page.video()?.path().catch(() => null);
    await context.close();
    await browser.close();
  }
  console.log('✅ Capturas en', SHOTS, fs.readdirSync(SHOTS));
  console.log('🎬 Video crudo:', videoPath);
}

run().catch((e) => { console.error(e); process.exit(1); });
