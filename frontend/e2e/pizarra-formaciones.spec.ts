import type { Page, Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { loginAs } from './helpers/auth';
import { test, expect, COACH, openBoardFromMatch } from './helpers/pizarra';

/**
 * Galería de formaciones — M6a de docs/specs/pizarra-m6-paridad-tacticalpad.md.
 *
 *   (a) fútbol: galería → 4-2-3-1 para mi equipo → 11 en la cancha (fichas +
 *       marcadores de posición libre si el plantel no alcanza);
 *   (b) rival 4-4-2 → 11 fichas rojas «R» en espejo (arquero rival arriba);
 *   (c) voleibol: la galería muestra las rotaciones 5-1 / 4-2 / 6-2;
 *   (d) baloncesto: la galería muestra zonas y presiones;
 *   (e) celular (390×844): galería en 2 columnas y cancha con los dos equipos.
 *
 * Nada se escribe: la red anti-escrituras de helpers/pizarra.ts aborta y hace
 * fallar cualquier escritura sin mock. Para voleibol y baloncesto se reescribe
 * SOLO EN LA LECTURA el deporte del equipo THUNDER (como pizarra-por-deporte).
 */

const SHOTS = process.env.M6A_E2E_SHOTS || 'C:/Users/Usuario/AppData/Local/Temp/claude/m6a';
mkdirSync(SHOTS, { recursive: true });

const FAKE_SESSION_ID = '00000000-0000-4000-8000-0000000e2e61';
const FAKE_BLOCK_ID = '00000000-0000-4000-8000-0000000e2e62';

const pins = (page: Page) => page.getByRole('button', { name: /^Quitar a .+ de la cancha$/ });
const emptyMarkers = (page: Page) => page.getByRole('button', { name: 'Quitar marcador' });
const gallery = (page: Page) => page.getByRole('dialog', { name: 'Formaciones' });

async function openGallery(page: Page) {
  await page.getByTitle(/Galería de formaciones/).click();
  await expect(gallery(page)).toBeVisible();
}

/** Centros (en px de pantalla) de las fichas rojas «R» del rival. */
async function rivalCenters(page: Page): Promise<{ x: number; y: number }[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('svg text'))
      .filter((t) => t.textContent === 'R')
      .map((t) => {
        const b = t.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      })
      .filter((p) => p.x > 0 && p.y > 0),
  );
}

async function rewriteTeamSport(page: Page, sport: string): Promise<void> {
  await page.route(/\.supabase\.co\/rest\/v1\/teams\?/, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    const fix = (t: unknown) => (t && typeof t === 'object' && /THUNDER/i.test(String((t as { name?: unknown }).name ?? '')) ? { ...t, sport } : t);
    await route.fulfill({ response: res, json: Array.isArray(body) ? body.map(fix) : fix(body) });
  });
}

async function injectSessionWithBlock(page: Page): Promise<void> {
  await page.route(/\.supabase\.co\/rest\/v1\/training_mesocycles\?/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: [] });
  });
  await page.route(/\.supabase\.co\/rest\/v1\/training_sessions\?/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const teamId = (url.searchParams.get('team_id') ?? '').replace(/^eq\./, '');
    const res = await route.fetch();
    const body = await res.json().catch(() => []);
    const fake = {
      id: FAKE_SESSION_ID, team_id: teamId, school_id: null, session_date: '2026-10-14',
      objectives: 'Sesión e2e formaciones', warmup: null, materials: null, notes: null, game_principles: null,
      drills: null, evaluation: null,
      session_blocks: [{ id: FAKE_BLOCK_ID, name: 'Bloque formaciones', minutes: '20', activity: 'Sistema', objective: '', description: '' }],
      created_at: '2026-10-14T12:00:00Z', updated_at: '2026-10-14T12:00:00Z',
    };
    await route.fulfill({ response: res, json: Array.isArray(body) && teamId ? [fake, ...body] : body });
  });
}

/** Pizarra de un bloque de sesión con el deporte reescrito. */
async function openBoardForSport(page: Page, sport: string, court: string) {
  await rewriteTeamSport(page, sport);
  await injectSessionWithBlock(page);
  await loginAs(page, COACH);
  await page.goto('/training-plans');
  await page.getByRole('combobox').first().click({ timeout: 30_000 });
  await page.getByRole('option', { name: /THUNDER/i }).first().click();
  await expect(page.getByText('Bloque formaciones')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Tablero táctico/ }).first().click();
  await expect(page.getByRole('button', { name: 'Guardar jugada' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(`[data-court="${court}"]`).first()).toBeVisible({ timeout: 20_000 });
}

/** (a) + (b): equipo propio 4-2-3-1 y rival 4-4-2 en espejo. */
async function bothTeams(page: Page, prefix: string) {
  await openGallery(page);
  const g = gallery(page);
  await expect(g.getByRole('region', { name: 'Clásicas' })).toBeVisible();
  await expect(g.getByRole('region', { name: 'Históricas' })).toBeVisible();
  expect(await g.locator('[data-formation-key]').count()).toBeGreaterThanOrEqual(35);
  await page.screenshot({ path: `${SHOTS}/${prefix}-01-galeria.png` });

  // Buscar y elegir 4-2-3-1 para mi equipo.
  await g.getByLabel('Buscar formación').fill('4231');
  await expect(g.getByRole('button', { name: '4-2-3-1', exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${prefix}-02-busqueda.png` });
  await g.getByRole('button', { name: '4-2-3-1', exact: true }).click();
  await expect(gallery(page)).toBeHidden();
  await expect.poll(async () => (await pins(page).count()) + (await emptyMarkers(page).count())).toBe(11);
  await expect(page.getByTitle(/Galería de formaciones/)).toHaveText(/4-2-3-1/);

  // Rival 4-4-2 en espejo.
  await openGallery(page);
  await gallery(page).getByRole('tab', { name: 'Rival' }).click();
  await expect(gallery(page).getByText(/El rival se pone en espejo/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${prefix}-03-galeria-rival.png` });
  await gallery(page).getByRole('button', { name: '4-4-2', exact: true }).click();
  await expect(gallery(page)).toBeHidden();
  await expect.poll(async () => (await rivalCenters(page)).length).toBe(11);

  // Espejo: el arquero rival (el más alto) queda arriba de todos los propios.
  const rivals = await rivalCenters(page);
  const ownTop = Math.min(...(await Promise.all((await pins(page).all()).map(async (p) => (await p.locator('..').boundingBox())!.y))));
  const rivalTop = Math.min(...rivals.map((r) => r.y));
  expect(rivalTop).toBeLessThan(ownTop);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${prefix}-04-cancha-dos-equipos.png` });

  // Cambiar la formación del rival reemplaza (siguen siendo 11, no 22).
  await openGallery(page);
  await gallery(page).getByRole('tab', { name: 'Rival' }).click();
  await expect(gallery(page).getByText(/Hoy hay 11 en la cancha/)).toBeVisible();
  await gallery(page).getByRole('button', { name: '5-3-2', exact: true }).click();
  await expect.poll(async () => (await rivalCenters(page)).length).toBe(11);
}

test.describe('escritorio', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('(a)(b) fútbol: 4-2-3-1 propio con 11 en la cancha y rival 4-4-2 en espejo', async ({ page, guard }) => {
    test.setTimeout(240_000);
    void guard;
    await openBoardFromMatch(page);
    await bothTeams(page, 'desktop');
  });

  test('(c) voleibol: la galería muestra las rotaciones', async ({ page, guard }) => {
    test.setTimeout(240_000);
    void guard;
    await openBoardForSport(page, 'Voleibol', 'voleibol');
    await openGallery(page);
    const g = gallery(page);
    for (const fam of ['Rotaciones 5-1', 'Rotaciones 4-2', 'Rotaciones 6-2', 'Defensivas']) {
      await expect(g.getByRole('region', { name: fam })).toBeVisible();
    }
    await expect(g.getByRole('button', { name: '5-1 · R1 recepción', exact: true })).toBeVisible();
    await g.getByRole('button', { name: 'Rotaciones 5-1', exact: true }).click();
    await expect(g.locator('[data-formation-key]')).toHaveCount(12);
    await page.screenshot({ path: `${SHOTS}/desktop-05-voleibol-rotaciones.png` });
    await g.getByRole('button', { name: '5-1 · R1 recepción', exact: true }).click();
    await expect.poll(async () => (await pins(page).count()) + (await emptyMarkers(page).count())).toBe(6);
    await page.screenshot({ path: `${SHOTS}/desktop-06-voleibol-cancha.png` });
  });

  test('(d) baloncesto: la galería muestra zonas y presiones', async ({ page, guard }) => {
    test.setTimeout(240_000);
    void guard;
    await openBoardForSport(page, 'Baloncesto', 'baloncesto');
    await openGallery(page);
    const g = gallery(page);
    await expect(g.getByRole('region', { name: 'Zonas' })).toBeVisible();
    await expect(g.getByRole('region', { name: 'Presiones' })).toBeVisible();
    await expect(g.getByRole('button', { name: 'Zona 2-3', exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/desktop-07-baloncesto-zonas.png` });
    // Equipo propio en 5 abierto contra el rival en zona 2-3 (espejo: defiende su canasta, arriba).
    await g.getByRole('button', { name: '5 abierto', exact: true }).click();
    await openGallery(page);
    await gallery(page).getByRole('tab', { name: 'Rival' }).click();
    await gallery(page).getByRole('button', { name: 'Zona 2-3', exact: true }).click();
    await expect.poll(async () => (await rivalCenters(page)).length).toBe(5);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/desktop-08-baloncesto-cancha.png` });
  });
});

test.describe('celular', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  test('(e) iPhone: galería en 2 columnas, tarjetas de 44 px o más, y los dos equipos', async ({ page, guard }) => {
    test.setTimeout(240_000);
    void guard;
    await openBoardFromMatch(page);
    await openGallery(page);
    const cards = gallery(page).locator('[data-formation-key]');
    // El diálogo entra con zoom (95 % → 100 %): medir cuando terminó de abrir.
    await expect.poll(async () => {
      const [p, q] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
      return p && q ? Math.abs(p.y - q.y) : 99;
    }, { timeout: 10_000 }).toBeLessThan(2);
    const b0 = (await cards.nth(0).boundingBox())!;
    const b1 = (await cards.nth(1).boundingBox())!;
    const b2 = (await cards.nth(2).boundingBox())!;
    expect(Math.abs(b0.y - b1.y)).toBeLessThan(2); // misma fila
    expect(b2.y).toBeGreaterThan(b0.y + b0.height - 2); // la tercera baja: 2 columnas
    expect(b0.height).toBeGreaterThanOrEqual(44);
    expect(b0.x + b0.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: `${SHOTS}/iphone-01-galeria.png` });
    await gallery(page).getByRole('button', { name: 'Cerrar' }).or(gallery(page).getByRole('button', { name: 'Close' })).first().click();
    await bothTeams(page, 'iphone');
  });
});
