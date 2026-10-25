// Capturas REALES para el manual "Pizarra táctica" v2 (M0–M6: multideporte, formaciones,
// herramientas, cuadros, equipos, notas/videos, biblioteca, exportar, 3D, IA).
// Reanudable por secciones:  ONLY=base,dibujar node capture-v2.mjs   (sin ONLY corre todo)
//
//   BASE_URL=https://dev.sportmaps.co node docs/manuales/_src/pizarra-tactica/capture-v2.mjs
//
// Tenant Club Campestre Demo, owner, equipo «Fútbol — Sub-10» (sesión sembrada con 2 bloques).
// NUNCA pulsa «Guardar jugada» ni «Analizar» (no gasta cupo de IA ni deja datos): todo
// lo que se arma en la cancha se descarta con «Cancelar».
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'https://dev.sportmaps.co';
const SHOTS = path.join(here, 'shots-v2');
fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);

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
const PASSWORD = 'Demo2026!';
const OWNER = 'gerencia@demo.sportmaps.co';
const TEAM = /Fútbol — Sub-10/;

async function loginAs(context, email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login ${email}: ${res.status}`);
  const session = await res.json();
  const ref = new URL(SUPABASE_URL).host.split('.')[0];
  await context.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
}

let browser;
const wait = (page, ms = 800) => page.waitForTimeout(ms);
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, name), timeout: 120_000, ...opts });

/** Abre el tablero del bloque idx de la sesión de Sub-10. Devuelve {ctx,page,d}. */
async function openBoard({ idx = 0, vp = { width: 1600, height: 1000 }, mobile = false, noFpsGate = false, dsf = 2 } = {}) {
  const ctx = await browser.newContext({
    viewport: vp, deviceScaleFactor: dsf, locale: 'es-CO',
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  await loginAs(ctx, OWNER);
  if (noFpsGate) await ctx.addInitScript(() => { window.__TACTICAL3D_MIN_FPS__ = 0; }); // WebGL por software: sin el piso de 20 fps
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 160)));
  await page.goto(BASE + '/training-plans');
  await page.waitForLoadState('networkidle').catch(() => {});
  const combo = mobile ? page.getByRole('combobox').filter({ hasText: /Selecciona un equipo/ }).first() : page.getByRole('combobox').nth(1);
  await combo.waitFor({ timeout: 60_000 }).catch(async () => { await page.screenshot({ path: path.join(SHOTS, '_debug-combo.png') }); throw new Error('sin selector de equipo'); });
  await wait(page, 1500);
  await combo.click();
  await page.getByRole('option', { name: TEAM }).click();
  await wait(page, 3500);
  const btn = page.getByRole('button', { name: /Tablero táctico/ }).nth(idx);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  const d = page.getByRole('dialog');
  await d.waitFor({ timeout: 40_000 });
  await d.getByRole('button', { name: /^Ajustes/ }).first().waitFor({ timeout: 40_000 }).catch(() => {});
  await wait(page, 3000);
  return { ctx, page, d };
}
const tb = (d, n) => d.getByRole('button', { name: new RegExp('^' + n) }).first();

async function clearBoard(page, d) {
  await tb(d, 'Dibujar').click(); await wait(page, 600);
  const bt = d.getByRole('button', { name: 'Borrar todo' }).first();
  if (await bt.isEnabled().catch(() => false)) {
    await bt.click(); await wait(page, 500);
    await page.getByRole('button', { name: 'Borrar todo' }).last().click(); await wait(page, 600);
  }
  await tb(d, 'Dibujar').click(); await wait(page, 500);
  for (let i = 0; i < 6; i++) {
    const x = d.getByRole('button', { name: /^Quitar a .* de la cancha/ }).first();
    if (!(await x.count())) break;
    await x.click(); await wait(page, 400);
  }
}

async function pitchRect(d) {
  const svgs = d.locator('svg'); const n = await svgs.count(); let best = null;
  for (let i = 0; i < n; i++) {
    const b = await svgs.nth(i).boundingBox().catch(() => null);
    if (b && (!best || b.width * b.height > best.width * best.height)) best = b;
  }
  if (!best) throw new Error('sin cancha');
  return best;
}
const at = (r, px, py) => ({ x: r.x + (px / 100) * r.width, y: r.y + (py / 100) * r.height });
async function drag(page, a, b, steps = 28) {
  await page.mouse.move(a.x, a.y, { steps: 10 }); await page.mouse.down(); await wait(page, 100);
  await page.mouse.move(b.x, b.y, { steps }); await wait(page, 100); await page.mouse.up();
}
async function tap(page, p) { await page.mouse.move(p.x, p.y, { steps: 8 }); await page.mouse.down(); await page.mouse.up(); await wait(page, 300); }

const sections = {};
const section = (name, fn) => { sections[name] = fn; };

// ── 1 · la sesión con el botón «Tablero táctico» ───────────────────────────
section('sesion', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, locale: 'es-CO' });
  await loginAs(ctx, OWNER);
  const page = await ctx.newPage();
  await page.goto(BASE + '/training-plans'); await page.waitForLoadState('networkidle').catch(() => {});
  const combo = page.getByRole('combobox').nth(1); await combo.waitFor({ timeout: 60_000 }); await wait(page, 1500);
  await combo.click(); await page.getByRole('option', { name: TEAM }).click(); await wait(page, 3500);
  const btn = page.getByRole('button', { name: /Tablero táctico/ }).first();
  await btn.scrollIntoViewIfNeeded(); await wait(page, 500);
  await shot(page, '01-sesion.png');
  await ctx.close();
});

// ── 2 · tablero con formaciones propia y rival ─────────────────────────────
section('base', async () => {
  const { ctx, page, d } = await openBoard();
  await clearBoard(page, d);
  await tb(d, 'Formación').click(); await wait(page, 900);
  await shot(page, '03-galeria.png');
  await page.getByRole('button', { name: /^4-3-3/ }).first().click(); await wait(page, 1200);
  await tb(d, '4-3-3').click(); await wait(page, 800);
  await page.getByRole('tab', { name: 'Rival' }).click(); await wait(page, 800);
  await shot(page, '04-galeria-rival.png');
  await page.getByRole('button', { name: /^4-4-2/ }).first().click(); await wait(page, 1500);
  await shot(page, '05-formaciones-aplicadas.png');
  await tb(d, 'Jugadores').click(); await wait(page, 1000);
  await shot(page, '06-jugadores.png');
  await ctx.close();
});

/** Tablero listo: limpio, 4-3-3 propio con los 2 deportistas del demo. */
async function readyBoard(opts) {
  const o = await openBoard(opts);
  await clearBoard(o.page, o.d);
  await tb(o.d, 'Formación').click(); await wait(o.page, 800);
  await o.page.getByRole('button', { name: /^4-3-3/ }).first().click(); await wait(o.page, 1200);
  return o;
}

// ── 3 · panel Dibujar completo (viewport alto) + líneas dibujadas ──────────
section('dibujar', async () => {
  const { ctx, page, d } = await readyBoard({ vp: { width: 1600, height: 1500 } });
  await tb(d, 'Dibujar').click(); await wait(page, 900);
  await shot(page, '07-panel-dibujar.png');
  // dibujo: modo dibujo + tipos de línea
  await d.getByRole('button', { name: 'Modo dibujo' }).click(); await wait(page, 400);
  const r = await pitchRect(d);
  const setLine = async (title) => { await d.locator(`button[title^="${title}"]`).first().click(); await wait(page, 250); };
  await d.getByRole('button', { name: 'Numerar' }).click(); await wait(page, 200);
  await d.getByRole('button', { name: 'Flecha', exact: true }).click();
  await setLine('Discontinua'); await drag(page, at(r, 20, 70), at(r, 40, 58));
  await setLine('Ondulada'); await drag(page, at(r, 45, 72), at(r, 48, 48));
  await setLine('Continua'); await drag(page, at(r, 80, 72), at(r, 82, 42));
  await setLine('Doble'); await drag(page, at(r, 30, 52), at(r, 38, 14));
  await d.getByRole('button', { name: 'Zona', exact: true }).click(); await d.getByRole('button', { name: 'Elipse' }).click();
  await drag(page, at(r, 55, 26), at(r, 75, 38));
  await wait(page, 500);
  await shot(page, '08-lineas.png');
  await ctx.close();
});

// ── 4 · objeto seleccionado ────────────────────────────────────────────────
section('objeto', async () => {
  const { ctx, page, d } = await readyBoard({ vp: { width: 1600, height: 1500 } });
  await tb(d, 'Material').click(); await wait(page, 900);
  const r = await pitchRect(d);
  await d.locator('[title="Cono"]').first().click();
  await tap(page, at(r, 30, 50)); await tap(page, at(r, 42, 50));
  await tap(page, at(r, 30, 50)); await wait(page, 500);
  await shot(page, '09-material-objeto.png');
  await ctx.close();
});

// ── 5 · Campo ──────────────────────────────────────────────────────────────
section('campo', async () => {
  const { ctx, page, d } = await readyBoard({ vp: { width: 1600, height: 1000 } });
  await tb(d, 'Más').click(); await wait(page, 500);
  await page.getByRole('menuitem', { name: /Campo/ }).click(); await wait(page, 1000);
  await shot(page, '10-campo.png');
  await page.getByRole('button', { name: '5 carriles' }).first().click(); await wait(page, 300);
  await page.getByRole('button', { name: 'Césped liso' }).click(); await wait(page, 300);
  await page.getByRole('button', { name: 'Listo' }).click(); await wait(page, 1000);
  await shot(page, '11-campo-aplicado.png');
  await ctx.close();
});

// ── 6 · cuadros y reproducción ─────────────────────────────────────────────
section('cuadros', async () => {
  const { ctx, page, d } = await readyBoard();
  await d.getByRole('button', { name: /^Cuadro$/ }).click(); await wait(page, 700);
  const r = await pitchRect(d);
  // mover un jugador en el cuadro 2
  const pin = d.locator('text=AQ').first();
  const pb = await pin.boundingBox();
  if (pb) await drag(page, { x: pb.x + pb.width / 2, y: pb.y + pb.height / 2 }, at(r, 60, 40));
  await wait(page, 500);
  await d.getByRole('button', { name: /^Cuadro$/ }).click(); await wait(page, 700);
  await shot(page, '12-cuadros.png');
  await d.getByRole('button', { name: 'Reproducir cuadros' }).click(); await wait(page, 1200);
  await shot(page, '13-reproduciendo.png');
  await ctx.close();
});

// ── 7 · Equipos, Notas, Videos, Más, Ajustes ───────────────────────────────
section('dialogos', async () => {
  const { ctx, page, d } = await readyBoard({ vp: { width: 1600, height: 1250 } });
  await tb(d, 'Equipos').click(); await wait(page, 1200);
  await shot(page, '14-equipos.png');
  await page.getByRole('button', { name: 'Equipos almacenados' }).click(); await wait(page, 1000);
  await shot(page, '15-equipos-almacenados.png');
  await page.keyboard.press('Escape').catch(() => {}); await wait(page, 500);
  if (!(await d.isVisible().catch(() => false))) throw new Error('Escape cerró el tablero');
  await ctx.close();
});
section('notas', async () => {
  const { ctx, page, d } = await readyBoard();
  await tb(d, 'Notas').click(); await wait(page, 800);
  await page.getByLabel('Nota de la jugada').fill('Salida por la banda derecha.\n- **Lateral** se proyecta\n- Volante da apoyo por dentro');
  await page.getByRole('button', { name: 'salida de balón' }).click();
  await page.getByRole('button', { name: 'presión' }).click();
  await page.getByRole('button', { name: 'ataque organizado' }).click();
  await wait(page, 500);
  await shot(page, '16-notas.png');
  await page.getByRole('button', { name: 'Cancelar' }).last().click(); await wait(page, 500);
  await tb(d, 'Videos').click(); await wait(page, 800);
  await page.getByLabel('Enlace del video').fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await page.getByLabel('Título del video').fill('Salida vs. presión alta');
  await wait(page, 3500);
  await shot(page, '17-videos-youtube.png');
  await page.getByRole('tab', { name: 'Subir' }).click(); await wait(page, 1500);
  await shot(page, '18-videos-subir.png');
  await ctx.close();
});
section('mas', async () => {
  const { ctx, page, d } = await readyBoard();
  await tb(d, 'Más').click(); await wait(page, 700);
  await shot(page, '19-mas.png');
  await ctx.close();
});
section('ajustes', async () => {
  const { ctx, page, d } = await readyBoard();
  await tb(d, 'Ajustes').click(); await wait(page, 1000);
  await shot(page, '20-ajustes.png');
  await ctx.close();
});

// ── 8 · exportar (PNG y PDF reales; se guardan para el manual) ─────────────
section('exportar', async () => {
  const { ctx, page, d } = await readyBoard();
  await tb(d, '4-3-3').click(); await wait(page, 700);
  await page.getByRole('tab', { name: 'Rival' }).click(); await wait(page, 500);
  await page.getByRole('button', { name: /^4-4-2/ }).first().click(); await wait(page, 1200);
  await d.getByRole('button', { name: /^Cuadro$/ }).click(); await wait(page, 600);
  await tb(d, 'Exportar').click(); await wait(page, 700);
  await shot(page, '21-exportar-menu.png');
  const dl = async (label, file) => {
    if (!(await page.getByRole('menuitem', { name: label }).isVisible().catch(() => false))) { await tb(d, 'Exportar').click(); await wait(page, 500); }
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByRole('menuitem', { name: label }).click()]);
    await download.saveAs(path.join(SHOTS, file));
  };
  await dl(/Imagen \(PNG\)/, 'export-jugada.png');
  await dl(/Ficha del ejercicio/, 'export-ficha.pdf');
  await ctx.close();
});

// ── 9 · IA: solo abrir el panel (NO se analiza: gasta cupo real) ───────────
section('ia', async () => {
  const { ctx, page, d } = await readyBoard();
  await tb(d, 'Analizar jugada').click(); await wait(page, 2500);
  await shot(page, '22-ia-panel.png');
  await ctx.close();
});

// ── 10 · 3D desde la pizarra real ──────────────────────────────────────────
section('tres_d', async () => {
  const { ctx, page, d } = await readyBoard({ noFpsGate: true, dsf: 1 });
  await d.getByRole('button', { name: /^Cuadro$/ }).click(); await wait(page, 600);
  const r = await pitchRect(d);
  const pin = d.locator('text=AQ').first(); const pb = await pin.boundingBox();
  if (pb) await drag(page, { x: pb.x + pb.width / 2, y: pb.y + pb.height / 2 }, at(r, 60, 40));
  await wait(page, 500);
  await tb(d, 'Ver en 3D').click();
  const back = page.getByRole('button', { name: /Volver a 2D/ });
  await back.waitFor({ timeout: 90_000 }).catch(async () => { await shot(page, '_debug-3d.png'); console.log('TEXTO:', (await page.locator('body').innerText()).slice(0, 400)); throw new Error('el visor 3D no abrió'); });
  await wait(page, 6000);
  await shot(page, '23-3d-tv.png');
  for (const [name, file] of [['Cenital', '24-3d-cenital.png'], ['Isométrica', '25-3d-iso.png'], ['Spider-cam', '26-3d-spider.png']]) {
    await page.getByRole('button', { name, exact: true }).click(); await wait(page, 3500); await shot(page, file);
  }
  await page.getByRole('button', { name: 'Cámara automática' }).click(); await wait(page, 2500);
  await shot(page, '27-3d-director.png');
  await page.getByRole('button', { name: /Volver a 2D/ }).click(); await wait(page, 1500);
  await shot(page, '28-volver-2d.png');
  await ctx.close();
});

// ── 11 · celular ───────────────────────────────────────────────────────────
section('movil', async () => {
  const { ctx, page, d } = await readyBoard({ vp: { width: 390, height: 844 }, mobile: true });
  await shot(page, '29-movil-tablero.png');
  await d.getByRole('button', { name: /^Más/ }).first().click(); await wait(page, 800);
  await shot(page, '30-movil-mas.png');
  await ctx.close();
});


// ── 12 · biblioteca de ejercicios (desde «Editar» la sesión) y guardar en biblioteca ──
section('biblioteca', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2, locale: 'es-CO' });
  await loginAs(ctx, OWNER);
  const page = await ctx.newPage();
  await page.goto(BASE + '/training-plans'); await page.waitForLoadState('networkidle').catch(() => {});
  const combo = page.getByRole('combobox').nth(1); await combo.waitFor({ timeout: 60_000 }); await wait(page, 1500);
  await combo.click(); await page.getByRole('option', { name: TEAM }).click(); await wait(page, 3500);
  await page.getByRole('button', { name: 'Editar' }).first().click(); await wait(page, 2500);
  await shot(page, '35-editar-sesion.png');
  await page.getByRole('button', { name: /Desde la biblioteca/ }).first().click(); await wait(page, 3000);
  await shot(page, '36-biblioteca-plantillas.png');
  await page.getByRole('tab', { name: 'De mi escuela' }).click(); await wait(page, 1500);
  await shot(page, '37-biblioteca-escuela.png');
  await page.getByRole('tab', { name: 'Paquetes' }).click(); await wait(page, 3000);
  await shot(page, '38-biblioteca-paquetes.png');
  await ctx.close();
});
section('guardar_biblioteca', async () => {
  const { ctx, page, d } = await readyBoard({ vp: { width: 1600, height: 1250 } });
  await tb(d, 'Más').click(); await wait(page, 600);
  await page.getByRole('menuitem', { name: /Guardar en biblioteca/ }).click(); await wait(page, 1500);
  await page.getByLabel('Nombre').first().fill('Salida 4+1 contra presión'); await wait(page, 400);
  await shot(page, '39-guardar-biblioteca.png');
  await ctx.close();
});

(async () => {
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const [name, fn] of Object.entries(sections)) {
      if (ONLY.length && !ONLY.includes(name)) continue;
      console.log('>', name);
      try { await fn(); console.log('ok', name); } catch (e) { console.log('FALLO', name, e.message.split('\n')[0]); }
    }
  } finally { await browser.close(); }
})();
