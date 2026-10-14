import type { Page, Route } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { loginAs } from './helpers/auth';
import { test, expect, COACH, mockWrite } from './helpers/pizarra';

/**
 * Paquetes de la biblioteca — M2 de docs/specs/pizarra-multideporte-3d-ia.md (D4).
 *
 *   (a) activar un paquete → la lista de la biblioteca cambia;
 *   (b) exportar → el archivo descargado es un sportmaps-ejercicios v1 sin ids;
 *   (c) importar → vista previa → confirmar → resultado (escrituras mockeadas);
 *   (d) arreglo del «Empieza aquí»: «Poner jugadores» con la formación de vóley
 *       («Rotación zonas 1-6») en dos líneas, sin doble paréntesis ni desborde.
 *
 * La base es UNA sola: nada se escribe. El BFF de dev todavía no tiene
 * /exercise-packs (va en esta rama y no se despliega desde una prueba; la
 * lógica la prueban bff/src/routes/school/exercisePacks.test.ts y las RLS
 * scripts/rls-pruebas-pizarra.mjs): las LECTURAS de paquetes se responden como
 * las respondería el BFF nuevo, y la lista de ejercicios es la REAL del BFF de
 * dev filtrada por los paquetes activados (como hace exercises.ts). Toda
 * escritura va mockeada; la red anti-escrituras de helpers/pizarra.ts aborta y
 * hace fallar cualquier otra.
 */

test.use({ viewport: { width: 1440, height: 900 } });

const SHOTS = process.env.M2_E2E_SHOTS || 'C:/Users/Usuario/AppData/Local/Temp/claude/m2-paquetes';
mkdirSync(SHOTS, { recursive: true });

const P_FUT = '5b1c0000-0000-4000-8000-000000000001';
const P_F75 = '5b1c0000-0000-4000-8000-000000000002';
const P_GEN = '5b1c0000-0000-4000-8000-000000000007';
const SCHOOL_SPORTS = ['futbol', 'futbol7', 'futbol5', 'generico'];
/** Mismo reparto que la migración 20261014121142. */
const PACK_OF_SPORT: Record<string, string> = { futbol: P_FUT, futbol7: P_F75, futbol5: P_F75, generico: P_GEN };

const EXERCISES = /\/api\/v1\/school\/exercises(\?|$)/;
const PACKS = /\/api\/v1\/school\/exercise-packs$/;
const ACTIVATE = /\/api\/v1\/school\/exercise-packs\/([0-9a-f-]{36})\/activate$/;
const EXPORT = /\/api\/v1\/school\/exercise-packs\/([0-9a-f-]{36}|mine)\/export$/;
const IMPORT = /\/api\/v1\/school\/exercise-packs\/import(\?.*)?$/;
const UUID_ANY = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

interface State { activated: Set<string> }

const packsBody = (s: State, counts: Record<string, number>) => ({
  mode: s.activated.size > 0 ? 'seleccion' : 'todos',
  can_manage: true,
  loose_own_count: 0,
  packs: [
    { id: P_FUT, name: 'Fútbol: fundamentos y juego', sport: 'futbol', description: 'Rondos, posesión, salida de balón, presión, finalización, defensa y balón parado para fútbol 11.' },
    { id: P_F75, name: 'Fútbol 7 y fútbol 5', sport: 'futbol7', description: 'Juego de posición y tareas en cancha reducida para las categorías que juegan fútbol 7 y fútbol 5.' },
    { id: P_GEN, name: 'Preparación física', sport: 'generico', description: 'Calentamientos, reacción y coordinación que sirven para cualquier deporte.' },
  ].map((p) => ({
    ...p, version: 1, is_system: true, updated_at: '2026-10-14T00:00:00Z',
    activated: s.activated.has(p.id),
    visible: s.activated.size === 0 || s.activated.has(p.id),
    exercise_count: counts[p.id] ?? 0,
  })),
});

/** Lecturas como las respondería el BFF nuevo (deportes, paquetes y la lista filtrada). */
async function mockPackReads(page: Page, s: State) {
  await page.route(/\/api\/v1\/school\/exercises\/sports$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: { sports: SCHOOL_SPORTS } });
  });
  await page.route(EXERCISES, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await route.fetch();
    const body = await res.json().catch(() => []);
    if (!Array.isArray(body)) return route.fulfill({ response: res, json: body });
    const ofSchool = body.filter((e: any) => !e.is_template || SCHOOL_SPORTS.includes(e.sport));
    const visible = s.activated.size === 0
      ? ofSchool
      : ofSchool.filter((e: any) => !e.is_template || s.activated.has(PACK_OF_SPORT[e.sport]));
    await route.fulfill({ response: res, json: visible });
  });
  await page.route(PACKS, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    // Número de ejercicios por paquete: de las plantillas REALES del BFF de dev.
    // (try: el refresco tras importar puede llegar cuando la prueba ya cerró la página)
    let rows: any[] = [];
    try {
      const real = await page.request.get(route.request().url().replace(/exercise-packs$/, 'exercises?templates=true&limit=200'), {
        headers: route.request().headers(),
      });
      rows = await real.json().catch(() => []);
    } catch {
      return route.abort().catch(() => undefined);
    }
    const counts: Record<string, number> = {};
    for (const e of Array.isArray(rows) ? rows : []) {
      const p = PACK_OF_SPORT[e.sport];
      if (e.is_template && p) counts[p] = (counts[p] ?? 0) + 1;
    }
    await route.fulfill({ json: packsBody(s, counts) });
  });
}

async function openLibrary(page: Page) {
  await loginAs(page, COACH);
  await page.goto('/training-plans');
  await page.getByRole('combobox').first().click({ timeout: 30_000 });
  await page.getByRole('option', { name: /THUNDER/i }).first().click();
  await page.getByRole('button', { name: /^Crear (Primera )?Sesión$/ }).first().click();
  const session = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Crear Sesión' }) });
  await expect(session).toBeVisible();
  await session.getByRole('button', { name: /Desde la biblioteca/ }).first().click();
  const lib = page.getByRole('dialog', { name: 'Biblioteca de ejercicios' });
  await expect(lib).toBeVisible();
  await expect(lib.getByRole('button', { name: 'Usar en esta sesión' }).first()).toBeVisible({ timeout: 30_000 });
  return { lib, session };
}

const cardNames = (lib: ReturnType<Page['getByRole']>) =>
  lib.getByRole('button', { name: /^Ver / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.slice(4)));

test('(a) activar un paquete: la biblioteca pasa a mostrar solo ese paquete', async ({ page, guard }) => {
  test.setTimeout(180_000);
  const s: State = { activated: new Set() };
  await mockPackReads(page, s);
  let activatedUrl = '';
  await mockWrite(page, guard, ACTIVATE, (req) => {
    activatedUrl = req.url();
    const id = req.url().match(ACTIVATE)![1];
    s.activated.add(id);
    return { pack_id: id, is_system: true, activated: true };
  });

  const { lib } = await openLibrary(page);
  // Fútbol trae 11, 7 y 5 (D1): fila de chips de deporte. «Todos» para ver
  // todas las plantillas de la escuela, no solo las del deporte del equipo.
  await expect(lib.getByRole('button', { name: 'Fútbol 5', exact: true })).toBeVisible();
  const all = page.waitForResponse((r) => EXERCISES.test(r.url()) && r.request().method() === 'GET' && !new URL(r.url()).searchParams.get('sport'));
  await lib.getByRole('button', { name: 'Todos', exact: true }).first().click();
  await all;
  await expect(lib.getByRole('button', { name: 'Usar en esta sesión' }).first()).toBeVisible();
  const before = await cardNames(lib);
  expect(before.length).toBeGreaterThan(1);
  await page.screenshot({ path: `${SHOTS}/a1-biblioteca-antes.png` });

  await lib.getByRole('tab', { name: 'Paquetes' }).click();
  const tab = lib.getByTestId('exercise-packs-tab');
  await expect(tab.getByText('Fútbol 7 y fútbol 5', { exact: true })).toBeVisible();
  await expect(tab.getByText(/Hoy ves todos los paquetes de tus deportes/)).toBeVisible();
  // Nada de otros deportes.
  await expect(tab.getByText('Voleibol formativo')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/a2-paquetes-modo-todos.png` });

  const req = page.waitForRequest((r) => r.method() === 'POST' && ACTIVATE.test(r.url()));
  await tab.getByRole('button', { name: 'Activar Fútbol 7 y fútbol 5' }).click();
  await req;
  expect(activatedUrl).toMatch(P_F75);
  await expect(tab.getByText('Tu biblioteca muestra solo los paquetes activados y los de tu escuela.')).toBeVisible();
  await expect(tab.getByRole('button', { name: 'Desactivar Fútbol 7 y fútbol 5' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/a3-paquete-activado.png` });

  // De vuelta en las plantillas: solo las del paquete activado (fútbol 7 / 5).
  const refreshed = page.waitForResponse((r) => EXERCISES.test(r.url()) && r.request().method() === 'GET');
  await lib.getByRole('tab', { name: 'Plantillas SportMaps' }).click();
  const list: any[] = await (await refreshed).json();
  expect(list.length).toBeGreaterThan(0);
  expect(list.length).toBeLessThan(before.length);
  for (const e of list) expect(['futbol7', 'futbol5']).toContain(e.sport);
  await expect(lib.getByRole('button', { name: 'Usar en esta sesión' }).first()).toBeVisible();
  expect((await cardNames(lib)).sort()).toEqual(list.map((e) => e.name).sort());
  await page.screenshot({ path: `${SHOTS}/a4-biblioteca-despues.png` });
});

test('(b) exportar un paquete: descarga un sportmaps-ejercicios v1 sin ids ni datos de la escuela', async ({ page, guard }) => {
  test.setTimeout(180_000);
  void guard;
  const s: State = { activated: new Set() };
  await mockPackReads(page, s);
  // El archivo, armado con las plantillas REALES de fútbol 11 del BFF de dev,
  // exactamente como lo arma buildPackFile (lista blanca de campos).
  await page.route(EXPORT, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const real = await page.request.get(route.request().url().replace(/exercise-packs\/.+$/, 'exercises?templates=true&sport=futbol'), {
      headers: route.request().headers(),
    });
    const rows: any[] = await real.json();
    await route.fulfill({
      json: {
        format: 'sportmaps-ejercicios', version: 1, exported_at: new Date().toISOString(),
        pack: { name: 'Fútbol: fundamentos y juego', description: null, sport: 'futbol', version: 1 },
        exercises: rows.map((r) => ({
          name: r.name, objective: r.objective, minutes: r.minutes, age_group: r.age_group, materials: r.materials,
          tags: r.tags, sport: r.sport, description: r.description, board: r.board,
        })),
      },
    });
  });

  const { lib } = await openLibrary(page);
  await lib.getByRole('tab', { name: 'Paquetes' }).click();
  const tab = lib.getByTestId('exercise-packs-tab');
  const download = page.waitForEvent('download');
  await tab.getByRole('button', { name: 'Exportar Fútbol: fundamentos y juego' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('paquete-futbol-fundamentos-y-juego.json');
  const path = `${SHOTS}/b-exportado.json`;
  await file.saveAs(path);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  expect(json).toMatchObject({ format: 'sportmaps-ejercicios', version: 1, pack: { sport: 'futbol' } });
  expect(json.exercises.length).toBeGreaterThan(0);
  const text = JSON.stringify(json);
  for (const k of ['school_id', 'created_by', 'pack_id', 'is_template', 'times_used']) expect(text).not.toContain(k);
  expect(text).not.toMatch(UUID_ANY);
  await expect(tab.getByRole('status')).toContainText('Descargado: paquete-futbol-fundamentos-y-juego.json');
  await page.screenshot({ path: `${SHOTS}/b1-exportado.png` });
});

test('(c) importar: elegir archivo → vista previa → confirmar → resultado', async ({ page, guard }) => {
  test.setTimeout(180_000);
  const s: State = { activated: new Set() };
  await mockPackReads(page, s);
  const FILE = {
    format: 'sportmaps-ejercicios', version: 1,
    pack: { name: 'Arqueros (e2e)', sport: 'futbol' },
    exercises: [
      { name: 'Blocaje alto', minutes: 10, tags: ['arqueros'] },
      { name: 'Caídas laterales', minutes: 12 },
      { name: 'Reacción con pelotas de tenis', sport: 'generico', minutes: 8 },
    ],
  };
  const bodies: any[] = [];
  await mockWrite(page, guard, IMPORT, (req) => {
    const dry = new URL(req.url()).searchParams.get('dry_run') === 'true';
    bodies.push({ dry, body: req.postDataJSON() });
    const summary = { name: 'Arqueros (e2e)', sport: 'futbol', exercises: 3, sports: ['futbol', 'generico'] };
    return dry ? { valid: true, errors: [], summary } : { pack_id: '00000000-0000-4000-8000-0000000e2e60', school_id: 'x', exercises: 3, summary };
  });

  const { lib } = await openLibrary(page);
  await lib.getByRole('tab', { name: 'Paquetes' }).click();
  const tab = lib.getByTestId('exercise-packs-tab');
  await expect(tab.getByRole('button', { name: /Importar paquete/ })).toBeVisible();
  await tab.getByTestId('pack-file-input').setInputFiles({
    name: 'arqueros.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(FILE)),
  });

  const preview = tab.getByTestId('pack-import-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Paquete «Arqueros (e2e)»');
  await expect(preview).toContainText('3 ejercicios · Fútbol 11, Preparación física');
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toEqual({ dry: true, body: FILE });
  await page.screenshot({ path: `${SHOTS}/c1-vista-previa.png` });

  await preview.getByRole('button', { name: 'Importar 3 ejercicios' }).click();
  const done = tab.getByTestId('pack-import-done');
  await expect(done).toContainText('Listo: se importaron 3 ejercicios en «Arqueros (e2e)».');
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual({ dry: false, body: FILE });
  await page.screenshot({ path: `${SHOTS}/c2-importado.png` });
});

test('(c2) importar un archivo inválido: lista de errores y nada que confirmar', async ({ page, guard }) => {
  test.setTimeout(180_000);
  const s: State = { activated: new Set() };
  await mockPackReads(page, s);
  await mockWrite(page, guard, IMPORT, () => ({
    valid: false,
    errors: [
      'Ejercicio 1 («Remate»): es de Voleibol, un deporte que tu escuela no tiene.',
      'Ejercicio 2 («<script>»): el nombre trae HTML o código: no se permite.',
      'Ejercicio 3 («Fuera»): jugada: cuadro 1: jugador inválido (key + x/y entre 0 y 100).',
    ],
    summary: { name: 'Malicioso', sport: 'futbol', exercises: 3, sports: ['futbol'] },
  }));
  const { lib } = await openLibrary(page);
  await lib.getByRole('tab', { name: 'Paquetes' }).click();
  const tab = lib.getByTestId('exercise-packs-tab');
  await tab.getByTestId('pack-file-input').setInputFiles({
    name: 'malicioso.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'sportmaps-ejercicios', version: 1, pack: { name: 'Malicioso', sport: 'futbol' }, exercises: [{}, {}, {}] })),
  });
  const preview = tab.getByTestId('pack-import-preview');
  await expect(preview).toContainText('No se puede importar: el archivo tiene 3 errores. No se guardó nada.');
  await expect(preview.getByRole('button', { name: /^Importar/ })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/c3-archivo-invalido.png` });
});

// ── (d) «Empieza aquí» con la formación de vóley ───────────────────────────
const FAKE_SESSION_ID = '00000000-0000-4000-8000-0000000e2e61';
const FAKE_BLOCK_ID = '00000000-0000-4000-8000-0000000e2e62';

async function voleibolBoard(page: Page) {
  // Igual que pizarra-por-deporte.spec.ts: teams.sport → Voleibol y una sesión
  // con un bloque, solo en la LECTURA.
  await page.route(/\.supabase\.co\/rest\/v1\/teams\?/, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    const fix = (t: any) => (t && typeof t === 'object' && /THUNDER/i.test(String(t.name ?? '')) ? { ...t, sport: 'Voleibol' } : t);
    await route.fulfill({ response: res, json: Array.isArray(body) ? body.map(fix) : fix(body) });
  });
  await page.route(/\.supabase\.co\/rest\/v1\/training_mesocycles\?/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: [] });
  });
  await page.route(/\.supabase\.co\/rest\/v1\/training_sessions\?/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const teamId = (new URL(route.request().url()).searchParams.get('team_id') ?? '').replace(/^eq\./, '');
    const res = await route.fetch();
    const body = await res.json().catch(() => []);
    const fake = {
      id: FAKE_SESSION_ID, team_id: teamId, school_id: null, session_date: '2026-10-14',
      objectives: 'Sesión e2e vóley', warmup: null, materials: null, notes: null, game_principles: null,
      drills: null, evaluation: null,
      session_blocks: [{ id: FAKE_BLOCK_ID, name: 'Bloque e2e', minutes: '20', activity: 'Rotación', objective: '', description: '' }],
      created_at: '2026-10-14T12:00:00Z', updated_at: '2026-10-14T12:00:00Z',
    };
    await route.fulfill({ response: res, json: Array.isArray(body) && teamId ? [fake, ...body] : body });
  });
  await loginAs(page, COACH);
  await page.goto('/training-plans');
  await page.getByRole('combobox').first().click({ timeout: 30_000 });
  await page.getByRole('option', { name: /THUNDER/i }).first().click();
  await expect(page.getByText('Bloque e2e')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Tablero táctico/ }).first().click();
  await expect(page.getByRole('button', { name: 'Guardar jugada' })).toBeVisible({ timeout: 30_000 });
}

for (const vp of [{ name: 'escritorio', width: 1440, height: 900 }, { name: 'celular', width: 390, height: 844 }]) {
  test(`(d) «Empieza aquí» en vóley (${vp.name}): «Poner jugadores» + «Rotación zonas 1-6», sin desbordar`, async ({ page, guard }) => {
    test.setTimeout(180_000);
    void guard;
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await voleibolBoard(page);
    const hint = page.getByRole('region', { name: 'Empieza aquí' });
    await expect(hint).toBeVisible({ timeout: 20_000 });
    const btn = hint.getByRole('button', { name: /^Poner jugadores/ });
    await expect(btn).toContainText('Poner jugadores');
    await expect(btn).toContainText('Rotación zonas 1-6');
    await expect(btn).not.toContainText('((');
    await expect(btn).not.toContainText('(');
    // Nada se sale del botón: el contenido cabe en su ancho.
    const overflow = await btn.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const b = (await btn.boundingBox())!;
    const h = (await hint.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(h.x);
    expect(b.x + b.width).toBeLessThanOrEqual(h.x + h.width + 0.5);
    await hint.screenshot({ path: `${SHOTS}/d-empieza-aqui-voleibol-${vp.name}.png` });
    await page.screenshot({ path: `${SHOTS}/d-pizarra-voleibol-${vp.name}.png` });
  });
}
