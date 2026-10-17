import type { Page, Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { loginAs } from './helpers/auth';
import { test, expect, COACH } from './helpers/pizarra';

/**
 * Pizarra por deporte — M1 de docs/specs/pizarra-multideporte-3d-ia.md (D1-D3).
 *
 *   (a) equipo de VOLEIBOL: «Tablero táctico» en el bloque y la pizarra abre con
 *       la cancha de voleibol;
 *   (b) equipo de NATACIÓN: ni «Tablero táctico» ni «Desde la biblioteca»;
 *   (c) escuela de FÚTBOL: la biblioteca no muestra plantillas ni chip de voleibol.
 *
 * Los equipos demo del coach QA son de fútbol (THUNDER). Como en los specs de
 * la pizarra que inyectan el partido, aquí se reescribe SOLO EN LA LECTURA el
 * deporte del equipo (teams.sport) y se inyecta una sesión con un bloque. Nada
 * se escribe: la red anti-escrituras de helpers/pizarra.ts aborta y hace fallar
 * cualquier escritura sin mock.
 *
 * (c): el BFF de dev todavía no tiene GET /exercises/sports ni el filtro por
 * deportes de la escuela (van en esta rama y no se despliegan desde una prueba;
 * el filtro del BFF lo prueba bff/src/routes/school/exercises.sports.test.ts).
 * Se responde la LECTURA como respondería el BFF nuevo: deportes ['futbol',
 * 'generico'] y la lista real del BFF de dev sin las plantillas de otros deportes.
 */

test.use({ viewport: { width: 1440, height: 900 } });

const SHOTS = process.env.M1_E2E_SHOTS || 'C:/Users/Usuario/AppData/Local/Temp/claude/m1-deportes';
mkdirSync(SHOTS, { recursive: true });

const FAKE_SESSION_ID = '00000000-0000-4000-8000-0000000e2e41';
const FAKE_BLOCK_ID = '00000000-0000-4000-8000-0000000e2e42';

/** Reescribe teams.sport (solo lectura) de los equipos THUNDER. */
async function rewriteTeamSport(page: Page, sport: string): Promise<void> {
  await page.route(/\.supabase\.co\/rest\/v1\/teams\?/, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    const fix = (t: any) => (t && typeof t === 'object' && /THUNDER/i.test(String(t.name ?? '')) ? { ...t, sport } : t);
    const json = Array.isArray(body) ? body.map(fix) : fix(body);
    await route.fulfill({ response: res, json });
  });
}

/** Sin mesociclo (así se ve la lista suelta de sesiones) y una sesión con un bloque. */
async function injectSessionWithBlock(page: Page): Promise<void> {
  await page.route(/\.supabase\.co\/rest\/v1\/training_mesocycles\?/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: [] });
  });
  await page.route(/\.supabase\.co\/rest\/v1\/training_sessions\?/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const teamFilter = url.searchParams.get('team_id') ?? '';
    const res = await route.fetch();
    const body = await res.json().catch(() => []);
    const teamId = teamFilter.replace(/^eq\./, '');
    const fake = {
      id: FAKE_SESSION_ID, team_id: teamId, school_id: null, session_date: '2026-10-14',
      objectives: 'Sesión e2e por deporte', warmup: null, materials: null, notes: null, game_principles: null,
      drills: null, evaluation: null,
      session_blocks: [{ id: FAKE_BLOCK_ID, name: 'Bloque e2e', minutes: '20', activity: 'Ataque por zona 4', objective: '', description: '' }],
      created_at: '2026-10-14T12:00:00Z', updated_at: '2026-10-14T12:00:00Z',
    };
    await route.fulfill({ response: res, json: Array.isArray(body) && teamId ? [fake, ...body] : body });
  });
}

async function openThunder(page: Page): Promise<void> {
  await loginAs(page, COACH);
  await page.goto('/training-plans');
  await page.getByRole('combobox').first().click({ timeout: 30_000 });
  await page.getByRole('option', { name: /THUNDER/i }).first().click();
}

test('(a) equipo de voleibol: «Tablero táctico» en el bloque y la pizarra con cancha de voleibol', async ({ page, guard }) => {
  test.setTimeout(180_000);
  void guard;
  await rewriteTeamSport(page, 'Voleibol');
  await injectSessionWithBlock(page);
  await openThunder(page);

  await expect(page.getByText('Bloque e2e')).toBeVisible({ timeout: 30_000 });
  // Lo futbolero no aparece: no hay botón «Fútbol» (panorama de partidos).
  await expect(page.getByRole('button', { name: 'Fútbol', exact: true })).toHaveCount(0);
  const entry = page.getByRole('button', { name: /Tablero táctico/ }).first();
  await expect(entry).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/a1-voleibol-sesion-con-tablero.png` });

  await entry.click();
  await expect(page.getByRole('button', { name: 'Guardar jugada' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-court="voleibol"]').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-court="futbol"], [data-court="generico"]')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/a2-voleibol-pizarra.png` });
  await page.getByRole('button', { name: 'Cancelar' }).first().click();
  await expect(page.getByRole('button', { name: 'Guardar jugada' })).toBeHidden();

  // Sesión nueva de voleibol: bloques con pizarra y biblioteca, sin lo futbolero.
  await page.getByRole('button', { name: /^Crear (Primera )?Sesión$/ }).first().click();
  const session = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Crear Sesión' }) });
  await expect(session).toBeVisible();
  await expect(session.getByText('Bloques de la Sesión')).toBeVisible();
  await expect(session.getByRole('button', { name: /Desde la biblioteca/ }).first()).toBeVisible();
  await expect(session.getByRole('button', { name: 'Tablero táctico' }).first()).toBeVisible();
  await expect(session.getByLabel('Principios de Juego a Trabajar')).toHaveCount(0);
  await expect(session.getByText('Evaluación de la Sesión')).toHaveCount(0);
  await expect(session.getByLabel('Calentamiento')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/a3-voleibol-crear-sesion.png` });
  await session.getByRole('button', { name: 'Cancelar' }).click();
});

test('(b) equipo de natación: sin «Tablero táctico» ni biblioteca', async ({ page, guard }) => {
  test.setTimeout(180_000);
  void guard;
  await rewriteTeamSport(page, 'Natación');
  await injectSessionWithBlock(page);
  await openThunder(page);

  await expect(page.getByText('Bloque e2e')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Tablero táctico/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Fútbol', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/b1-natacion-sesion-sin-tablero.png` });

  // Sesión nueva: ejercicios sueltos y calentamiento, como siempre; nada de pizarra.
  await page.getByRole('button', { name: /^Crear (Primera )?Sesión$/ }).first().click();
  const session = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Crear Sesión' }) });
  await expect(session).toBeVisible();
  await expect(session.getByText('Ejercicios', { exact: true })).toBeVisible();
  await expect(session.getByLabel('Calentamiento')).toBeVisible();
  await expect(session.getByRole('button', { name: /Desde la biblioteca/ })).toHaveCount(0);
  await expect(session.getByRole('button', { name: 'Tablero táctico' })).toHaveCount(0);
  await expect(session.getByText('Bloques de la Sesión')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/b2-natacion-crear-sesion.png` });
  await session.getByRole('button', { name: 'Cancelar' }).click();
});

test('(c) escuela de fútbol: la biblioteca no muestra plantillas ni chip de voleibol', async ({ page, guard }) => {
  test.setTimeout(180_000);
  void guard;
  const ALLOWED = ['futbol', 'generico'];
  let realHadOtherSports = false;
  await page.route(/\/api\/v1\/school\/exercises\/sports$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: { sports: ALLOWED } });
  });
  await page.route(/\/api\/v1\/school\/exercises(\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await route.fetch();
    const body = await res.json().catch(() => []);
    if (!Array.isArray(body)) return route.fulfill({ response: res, json: body });
    if (body.some((e: any) => e.is_template && !ALLOWED.includes(e.sport))) realHadOtherSports = true;
    await route.fulfill({ response: res, json: body.filter((e: any) => !e.is_template || ALLOWED.includes(e.sport)) });
  });
  await rewriteTeamSport(page, 'Fútbol');
  await openThunder(page);

  await page.getByRole('button', { name: /^Crear (Primera )?Sesión$/ }).first().click();
  const session = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Crear Sesión' }) });
  await expect(session).toBeVisible();
  // Fútbol: lo de siempre (principios de juego + bloques con pizarra y biblioteca).
  await expect(session.getByLabel('Principios de Juego a Trabajar')).toBeVisible();
  await session.getByRole('button', { name: /Desde la biblioteca/ }).first().click();

  const lib = page.getByRole('dialog', { name: 'Biblioteca de ejercicios' });
  await expect(lib).toBeVisible();
  await expect(lib.getByRole('button', { name: 'Usar en esta sesión' }).first()).toBeVisible({ timeout: 30_000 });
  // Un solo deporte (fútbol 11) → sin fila de chips de deporte; nunca un chip de voleibol.
  await expect(lib.getByRole('button', { name: 'Voleibol', exact: true })).toHaveCount(0);
  await expect(lib.getByText('Deporte', { exact: true })).toHaveCount(0);
  // Ninguna tarjeta es de voleibol (ni de baloncesto, balonmano, futsal…).
  for (const label of ['Voleibol', 'Baloncesto', 'Balonmano', 'Fútbol sala']) {
    await expect(lib.getByText(label, { exact: true })).toHaveCount(0);
  }
  await expect(lib.getByText('Fútbol 11', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/c1-futbol-biblioteca.png`, fullPage: true });
  // Control: la lista REAL del BFF de dev sí traía plantillas de otros deportes
  // (las mismas que el BFF nuevo ya no manda).
  expect(realHadOtherSports).toBe(true);
});
