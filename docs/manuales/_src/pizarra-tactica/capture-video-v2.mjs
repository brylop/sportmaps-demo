// VIDEO de la pizarra táctica v2 (multideporte, formaciones con rival, herramientas, cuadros,
// equipos, notas/videos, Ajustes, 3D, IA, exportar y biblioteca). Un solo recorrido continuo
// con subtítulos y cursor inyectados (misma receta que capture.mjs).
//
//   BASE_URL=https://dev.sportmaps.co node docs/manuales/_src/pizarra-tactica/capture-video-v2.mjs
//
// Tenant Club Campestre Demo, owner, «Fútbol — Sub-10». NUNCA pulsa «Guardar jugada»,
// «Analizar» (gasta cupo de IA) ni «Guardar» en biblioteca: todo se descarta con «Cancelar»,
// así que no deja datos en el demo. Cada sección falla de forma aislada (se omite y se anota).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'https://dev.sportmaps.co';
const VIDEO = path.join(here, 'video-raw-v2');
fs.rmSync(VIDEO, { recursive: true, force: true });
fs.mkdirSync(VIDEO, { recursive: true });
const DEBUG = path.join(here, 'shots-v2');
fs.mkdirSync(DEBUG, { recursive: true });

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

const OVERLAY_JS = `
(() => {
  if (document.getElementById('__cap')) return;
  const cap = document.createElement('div'); cap.id = '__cap';
  Object.assign(cap.style, { position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', maxWidth: '78vw', padding: '12px 20px', borderRadius: '14px', background: 'rgba(10,20,14,0.88)', color: '#fff', font: '600 20px/1.35 Inter, system-ui, sans-serif', boxShadow: '0 8px 30px rgba(0,0,0,.45)', border: '1px solid rgba(79,209,122,.55)', zIndex: '2147483647', pointerEvents: 'none', display: 'none', textAlign: 'center' });
  document.body.appendChild(cap);
  const cur = document.createElement('div'); cur.id = '__cur';
  Object.assign(cur.style, { position: 'fixed', left: '0px', top: '0px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(255,136,51,.85)', border: '3px solid #fff', boxShadow: '0 0 0 4px rgba(255,136,51,.35)', transform: 'translate(-50%,-50%)', zIndex: '2147483647', pointerEvents: 'none', display: 'none' });
  document.body.appendChild(cur);
  const mv = (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; };
  window.addEventListener('pointermove', mv, true); window.addEventListener('mousemove', mv, true);
  window.addEventListener('pointerdown', () => { cur.style.transform = 'translate(-50%,-50%) scale(0.7)'; }, true);
  window.addEventListener('pointerup', () => { cur.style.transform = 'translate(-50%,-50%) scale(1)'; }, true);
})();`;

let page;
const wait = (ms = 900) => page.waitForTimeout(ms);
async function caption(text, ms = 2200) {
  await page.evaluate(OVERLAY_JS).catch(() => {});
  await page.evaluate((t) => { const c = document.getElementById('__cap'); if (c) { c.textContent = t; c.style.display = 'block'; } const k = document.getElementById('__cur'); if (k) k.style.display = 'block'; }, text).catch(() => {});
  await wait(ms);
}
async function glide(x, y, steps = 24) { await page.mouse.move(x, y, { steps }); }
/** Lleva el cursor al elemento y hace clic (se ve el recorrido en el video). */
async function click(loc, { pause = 350 } = {}) {
  const el = loc.first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const b = await el.boundingBox();
  if (b) { await glide(b.x + b.width / 2, b.y + b.height / 2, 22); await wait(pause); }
  await el.click();
}
async function drag(a, b, steps = 30) {
  await glide(a.x, a.y, 16); await page.mouse.down(); await wait(120);
  await page.mouse.move(b.x, b.y, { steps }); await wait(120); await page.mouse.up();
}
async function tap(p) { await glide(p.x, p.y, 10); await page.mouse.down(); await page.mouse.up(); await wait(300); }
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
const tb = (d, n) => d.getByRole('button', { name: new RegExp('^' + n) }).first();

async function clearBoard(d) {
  await click(tb(d, 'Dibujar')); await wait(600);
  const bt = d.getByRole('button', { name: 'Borrar todo' }).first();
  if (await bt.isEnabled().catch(() => false)) {
    await bt.click(); await wait(500);
    await page.getByRole('button', { name: 'Borrar todo' }).last().click(); await wait(600);
  }
  await tb(d, 'Dibujar').click(); await wait(500);
  for (let i = 0; i < 6; i++) {
    const x = d.getByRole('button', { name: /^Quitar a .* de la cancha/ }).first();
    if (!(await x.count())) break;
    await x.click(); await wait(400);
  }
}

/** Cierra el diálogo de encima SIN tocar el «Cancelar» de la barra del tablero (cerraría la pizarra). */
async function closeTop() {
  const n0 = await page.getByRole('dialog').count();
  const top = page.getByRole('dialog').last();
  const btn = top.getByRole('button', { name: /^(Cancelar|Cerrar|Listo)$/ }).last();
  if (n0 > 1 && await btn.count()) { await btn.click(); await wait(800); return; }
  await page.keyboard.press('Escape'); await wait(800);
  if ((await page.getByRole('dialog').count()) < 1) throw new Error('se cerró el tablero al cerrar un diálogo');
}
const skipped = [];
const done = [];
async function step(name, fn) {
  try { await fn(); done.push(name); console.log('ok', name, 'dialogos:', await page.getByRole('dialog').count()); }
  catch (e) {
    skipped.push(`${name}: ${e.message.split('\n')[0]}`); console.log('OMITIDO', name, e.message.split('\n')[0]);
    await page.screenshot({ path: path.join(DEBUG, `_video-fallo-${name}.png`) }).catch(() => {});
    await page.evaluate(() => { const c = document.getElementById('__cap'); if (c) c.style.display = 'none'; }).catch(() => {});
    if ((await page.getByRole('dialog').count().catch(() => 0)) > 1) { await page.keyboard.press('Escape').catch(() => {}); await wait(600); }
  }
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, locale: 'es-CO',
    recordVideo: { dir: VIDEO, size: { width: 1600, height: 1000 } },
  });
  await loginAs(ctx, OWNER);
  await ctx.addInitScript(() => { window.__TACTICAL3D_MIN_FPS__ = 0; }); // WebGL por software: sin el piso de fps
  page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 160)));
  let d;
  try {
    // 1 · sesión y tablero
    await page.goto(BASE + '/training-plans');
    await page.waitForLoadState('networkidle').catch(() => {});
    const combo = page.getByRole('combobox').nth(1);
    await combo.waitFor({ timeout: 60_000 }); await wait(1200);
    await caption('Pizarra táctica · nueva versión', 2600);
    await caption('Entra a Métricas y Rendimiento y elige el equipo', 1800);
    await click(combo); await click(page.getByRole('option', { name: TEAM })); await wait(3500);
    await caption('Cada bloque de la sesión tiene su botón «Tablero táctico»', 2400);
    const btn = page.getByRole('button', { name: /Tablero táctico/ }).first();
    await btn.scrollIntoViewIfNeeded(); await click(btn);
    d = page.getByRole('dialog').first(); await d.waitFor({ timeout: 40_000 });
    await d.getByRole('button', { name: /^Ajustes/ }).first().waitFor({ timeout: 40_000 }).catch(() => {});
    await wait(2500);
    await caption('El tablero abre a pantalla completa. La cancha cambia según el deporte del equipo', 3000);
    await clearBoard(d);

    // 2 · galería de formaciones con rival
    await step('formaciones', async () => {
      await caption('Formaciones: elige una de la galería para tu equipo', 2200);
      await click(tb(d, 'Formación')); await wait(1200);
      await click(page.getByRole('button', { name: /^4-3-3/ })); await wait(1500);
      await caption('Tu equipo queda ubicado en la cancha con esa formación', 2200);
      await click(tb(d, '4-3-3')); await wait(900);
      await caption('También puedes poner al rival, con su formación en espejo', 2600);
      await click(page.getByRole('tab', { name: 'Rival' })); await wait(900);
      await click(page.getByRole('button', { name: /^4-4-2/ })); await wait(1800);
    });

    // 3 · jugadores, líneas, material, campo
    await step('jugadores', async () => {
      await caption('Jugadores: tu plantilla está a un lado; arrástralos o quítalos de la cancha', 2800);
      await click(tb(d, 'Jugadores')); await wait(1800);
    });
    await step('lineas', async () => {
      await caption('Dibujar: flechas, líneas de varios estilos y zonas', 2400);
      await click(tb(d, 'Dibujar')); await wait(900);
      await click(d.getByRole('button', { name: 'Modo dibujo' })); await wait(400);
      const r = await pitchRect(d);
      const setLine = async (t) => { await click(d.locator(`button[title^="${t}"]`), { pause: 150 }); await wait(250); };
      await click(d.getByRole('button', { name: 'Numerar' }), { pause: 150 });
      await click(d.getByRole('button', { name: 'Flecha', exact: true }), { pause: 150 });
      await setLine('Discontinua'); await drag(at(r, 20, 70), at(r, 40, 58));
      await setLine('Ondulada'); await drag(at(r, 45, 72), at(r, 48, 48));
      await setLine('Continua'); await drag(at(r, 80, 72), at(r, 82, 42));
      await setLine('Doble'); await drag(at(r, 30, 52), at(r, 38, 14));
      await click(d.getByRole('button', { name: 'Zona', exact: true }), { pause: 150 });
      await click(d.getByRole('button', { name: 'Elipse' }), { pause: 150 });
      await drag(at(r, 55, 26), at(r, 75, 38));
      await wait(1800);
    });
    await step('material', async () => {
      await caption('Material: conos, balones y más; tócalos para moverlos o girarlos', 2600);
      await click(tb(d, 'Material')); await wait(900);
      const r = await pitchRect(d);
      await click(d.locator('[title="Cono"]'));
      await tap(at(r, 30, 50)); await tap(at(r, 42, 50)); await tap(at(r, 30, 50));
      await wait(1800);
    });
    await step('campo', async () => {
      await caption('Campo: elige carriles, césped y marcas para esta jugada', 2400);
      await click(tb(d, 'Más')); await wait(500);
      await click(page.getByRole('menuitem', { name: /Campo/ })); await wait(1200);
      await click(page.getByRole('button', { name: '5 carriles' })); await wait(500);
      await click(page.getByRole('button', { name: 'Césped liso' })); await wait(500);
      await click(page.getByRole('button', { name: 'Listo' })); await wait(1500);
    });

    // 4 · cuadros y animación
    await step('cuadros', async () => {
      await caption('Cuadros: cada cuadro es un momento de la jugada', 2400);
      await click(d.getByRole('button', { name: /^Cuadro$/ })); await wait(800);
      const r = await pitchRect(d);
      const pin = d.locator('text=AQ').first(); const pb = await pin.boundingBox();
      if (pb) await drag({ x: pb.x + pb.width / 2, y: pb.y + pb.height / 2 }, at(r, 60, 40));
      await wait(800);
      await caption('Mueve las fichas en cada cuadro y reprodúcelo como animación', 2600);
      await click(d.getByRole('button', { name: /^Cuadro$/ })); await wait(700);
      await click(d.getByRole('button', { name: 'Reproducir cuadros' })); await wait(5500);
    });

    // 5 · equipos, notas, videos
    await step('equipos', async () => {
      await caption('Equipos: configura camisetas y guarda tus equipos y rivales', 2600);
      await click(tb(d, 'Equipos')); await wait(1800);
      await click(page.getByRole('button', { name: 'Equipos almacenados' })); await wait(2200);
      await closeTop();
    });
    await step('notas', async () => {
      await caption('Notas: escribe la idea de la jugada y márcala con etiquetas', 2400);
      await click(tb(d, 'Notas')); await wait(900);
      await page.getByLabel('Nota de la jugada').fill('Salida por la banda derecha.\n- **Lateral** se proyecta\n- Volante da apoyo por dentro');
      await click(page.getByRole('button', { name: 'salida de balón' }), { pause: 150 });
      await click(page.getByRole('button', { name: 'presión' }), { pause: 150 });
      await wait(2200);
      await click(page.getByRole('button', { name: 'Cancelar' }).last()); await wait(600);
    });
    await step('videos', async () => {
      await caption('Videos: agrega un enlace de YouTube o sube uno desde el celular', 2600);
      await click(tb(d, 'Videos')); await wait(900);
      await page.getByLabel('Enlace del video').fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
      await page.getByLabel('Título del video').fill('Salida vs. presión alta');
      await wait(3500);
      await click(page.getByRole('tab', { name: 'Subir' })); await wait(2200);
      await closeTop();
    });

    // 6 · Ajustes
    await step('ajustes', async () => {
      await caption('Ajustes: velocidad de la animación, rastros, nombres y tema', 2600);
      await click(tb(d, 'Ajustes')); await wait(2800);
      await closeTop();
    });

    // 7 · 3D
    await step('tres_d', async () => {
      await caption('Ver en 3D: la misma jugada con cámaras de TV, cenital, isométrica y más', 2800);
      await click(tb(d, 'Ver en 3D'));
      const back = page.getByRole('button', { name: /Volver a 2D/ });
      await back.waitFor({ timeout: 90_000 });
      await wait(6000);
      for (const name of ['Cenital', 'Isométrica', 'Spider-cam']) {
        await click(page.getByRole('button', { name, exact: true })); await wait(3500);
      }
      await caption('La cámara automática sigue la acción como un director', 2400);
      await click(page.getByRole('button', { name: 'Cámara automática' })); await wait(4000);
      await caption('Vuelve a 2D cuando quieras', 1800);
      await click(page.getByRole('button', { name: /Volver a 2D/ })); await wait(1800);
    });

    // 8 · IA: solo se abre el panel (no se analiza: gasta cupo real)
    await step('ia', async () => {
      await caption('Analizar con IA: sugiere contraataques y variantes de tu jugada', 2800);
      await click(tb(d, 'Analizar jugada')); await wait(3500);
      // el panel de IA no es un diálogo: Escape cerraría la pizarra. Se cierra con su botón o con el mismo botón de la barra.
      const cerrar = d.getByRole('button', { name: /^(Cerrar|Cerrar panel|Ocultar)/ }).first();
      if (await cerrar.count()) await cerrar.click(); else await tb(d, 'Analizar jugada').click();
      await wait(1000);
    });

    // 9 · exportar y guardar en biblioteca
    await step('exportar', async () => {
      await caption('Exportar: imagen, ficha del ejercicio en PDF y más', 2400);
      await click(tb(d, 'Exportar')); await wait(2500);
      await page.keyboard.press('Escape').catch(() => {}); await wait(700);
    });
    await step('guardar_biblioteca', async () => {
      await caption('Guardar en biblioteca: reutiliza la jugada en otras sesiones', 2600);
      await click(tb(d, 'Más')); await wait(600);
      await click(page.getByRole('menuitem', { name: /Guardar en biblioteca/ })); await wait(1500);
      await page.getByLabel('Nombre').first().fill('Salida 4+1 contra presión'); await wait(2500);
      await click(page.getByRole('button', { name: 'Cancelar' }).last()); await wait(800);
    });
    await caption('Pizarra táctica · SportMaps', 3000);
  } finally {
    const v = page.video();
    await ctx.close();
    const p = v ? await v.path() : null;
    if (p) fs.copyFileSync(p, path.join(VIDEO, 'pizarra-tactica-v2.webm'));
    await browser.close();
    console.log('HECHAS:', done.join(', '));
    console.log('OMITIDAS:', skipped.length ? skipped.join(' | ') : 'ninguna');
  }
})();
