import type { Page, Route } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test, expect, openBoardFromMatch, mockWrite, type WriteGuard } from './helpers/pizarra';
type Shapes = typeof import('../../bff/src/routes/school/tacticalAiShapes');
// El BFF es CommonJS (sin "type": "module"): con require lo transpila el hook de Playwright.
const shapes = createRequire(import.meta.url)('../../bff/src/routes/school/tacticalAiShapes.ts') as Shapes;
const { anonymizePlay, deanonymizeResult, parseAnalyzeInput, validateAiResult } = shapes;

/**
 * «Analizar jugada» (M3) + «Ver en 3D» (M4) — docs/specs/pizarra-multideporte-3d-ia.md.
 *
 *   (a) analizar → lectura humanizada (ningún «p5»/«r4») → ver contraataque en
 *       2D → «Ver en 3D» abre el visor con el contraataque en rojo → volver a 2D;
 *   (b) cupo agotado, dueño: «Comprar 50 análisis»;
 *   (c) cupo agotado, coach: «Pídele al administrador».
 *
 * El BFF de la IA va MOCKEADO con la respuesta REAL grabada del modelo
 * (bff/src/routes/school/__fixtures__/tacticalAi.recorded.json): el mock hace lo
 * mismo que el BFF (anonimiza la jugada que manda la pizarra, valida la salida
 * del modelo y la vuelve a las claves reales) con las MISMAS funciones del BFF
 * (tacticalAiShapes.ts). Nunca se llama al modelo ni se gasta cupo. Nada se
 * escribe: la red anti-escrituras de helpers/pizarra.ts aborta cualquier otra.
 *
 * 3D: Chromium con WebGL por software (SwiftShader) y el piso de fps apagado
 * (window.__TACTICAL3D_MIN_FPS__ = 0): con software va lento y caería a 2D.
 */

test.use({
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
});

const SHOTS = process.env.IA3D_E2E_SHOTS || 'C:/Users/Usuario/AppData/Local/Temp/claude/pizarra-ia-3d';
mkdirSync(SHOTS, { recursive: true });

const RECORDED = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../bff/src/routes/school/__fixtures__/tacticalAi.recorded.json', import.meta.url)),
    'utf8',
)) as Record<string, { texto: string }>;

const balance = (remaining: number) => ({
    ok: true, remaining, free_remaining: remaining, paid_remaining: 0, used: 15 - remaining,
    free_quota: 15, period: '2026-10', needs_purchase: remaining === 0,
});

/** GET del saldo (lectura). */
async function mockBalance(page: Page, remaining: number) {
    await page.route(/\/api\/v1\/school\/tactical\/ai-balance$/, async (route: Route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({ json: balance(remaining) });
    });
}

/** POST /tactical/analyze como lo respondería el BFF, con la salida grabada del modelo. */
async function mockAnalyze(page: Page, guard: WriteGuard, sent: { body: any }[]) {
    await mockWrite(page, guard, /\/api\/v1\/school\/tactical\/analyze$/, (req) => {
        const body = req.postDataJSON();
        sent.push({ body });
        const { input, errors } = parseAnalyzeInput(body);
        if (!input) throw new Error(`La pizarra mandó una jugada inválida: ${errors.join('; ')}`);
        const { keyMap } = anonymizePlay(input);
        const rec = RECORDED[input.sport] ?? RECORDED.futbol;
        const { result } = validateAiResult(rec.texto, { sport: input.sport, ownKeys: new Set(keyMap.keys()) });
        return { result: deanonymizeResult(result, keyMap), cached: false, balance: balance(11), keys: Object.fromEntries(keyMap) };
    });
}

/** 402 sin cupo (lo que responde el BFF sin llamar al modelo). */
async function mockAnalyzeNoQuota(page: Page, guard: WriteGuard) {
    await mockWrite(page, guard, /\/api\/v1\/school\/tactical\/analyze$/, {
        error: 'Se acabaron los análisis con IA de este mes.', balance: balance(0),
    }, 402);
}

/** Reescribe el rol (solo en la LECTURA de school_members) para ver la pizarra como dueño. */
async function rewriteRole(page: Page, role: string) {
    await page.route(/\.supabase\.co\/rest\/v1\/school_members\?/, async (route: Route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const url = new URL(route.request().url());
        const res = await route.fetch();
        const body = await res.json().catch(() => null);
        // Solo la consulta de membresías del usuario (useSchoolContext).
        if (!Array.isArray(body) || !url.searchParams.get('profile_id')) return route.fulfill({ response: res, json: body });
        await route.fulfill({ response: res, json: body.map((m: any) => (m && m.role ? { ...m, role } : m)) });
    });
    // Como dueño el menú pregunta por la tienda de la escuela (RPC de LECTURA por POST).
    await page.route(/\/rest\/v1\/rpc\/my_school_store/, async (route: Route) => {
        await route.fulfill({ json: null });
    });
}

const panel = (page: Page) => page.getByRole('complementary', { name: 'Análisis de la jugada con IA' });

async function boardWithPlayers(page: Page) {
    await openBoardFromMatch(page);
    await page.getByRole('button', { name: /^Poner jugadores/ }).click();
    await expect(page.getByRole('button', { name: /^Quitar a .+ de la cancha$/ }).first()).toBeVisible();
}

async function openAiPanel(page: Page) {
    // El del toolbar (aria-pressed); el del pie del panel se llama igual.
    await page.locator('button[aria-pressed]').filter({ hasText: 'Analizar jugada' }).click();
    await expect(panel(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { (window as unknown as { __TACTICAL3D_MIN_FPS__: number }).__TACTICAL3D_MIN_FPS__ = 0; });
});

test('(a) analizar → lectura sin «p5» → contraataque en 2D → «Ver en 3D» → volver a 2D', async ({ page, guard }) => {
    test.setTimeout(240_000);
    const sent: { body: any }[] = [];
    const events: string[] = [];
    await mockBalance(page, 12);
    await mockAnalyze(page, guard, sent);
    page.on('request', (r) => {
        if (/\/rpc\/log_tactical_board_event/.test(r.url())) events.push(String(r.postDataJSON()?.p_event));
    });
    await boardWithPlayers(page);
    await openAiPanel(page);
    await expect(panel(page).getByTestId('ai-balance')).toHaveText('Te quedan 12 análisis este mes');

    await panel(page).getByRole('button', { name: 'Analizar jugada' }).click();
    await expect(panel(page).getByText('Lectura de la jugada')).toBeVisible({ timeout: 30_000 });
    await expect(panel(page).getByTestId('ai-balance')).toHaveText('Te quedan 11 análisis este mes');

    // Lo que salió: jugada con claves reales, sin texto libre ni nombres.
    expect(sent).toHaveLength(1);
    expect(sent[0].body.sport).toBe('futbol');
    expect(sent[0].body.frames[0].players.length).toBeGreaterThan(0);

    // Ningún «p5» / «r4» / «(p5)» a la pantalla (la respuesta grabada sí los trae).
    const text = (await panel(page).innerText()).replace(/\s+/g, ' ');
    expect(RECORDED.futbol.texto).toMatch(/\bp\d{1,2}\b/);
    expect(text).not.toMatch(/\b[pr]\d{1,2}\b/);
    expect(text).toMatch(/Riesgos/i);
    expect(text).toMatch(/Contraataques del rival/i);
    await page.screenshot({ path: `${SHOTS}/a1-lectura.png` });

    // Contraataque en 2D: capa encima de la cancha con los rivales.
    const card = panel(page).locator('[data-testid="ai-card-c0"]');
    await card.getByRole('button', { name: 'Ver contraataque' }).click();
    const overlay = page.getByTestId('tactical-ai-overlay');
    await expect(overlay).toBeVisible();
    await expect.poll(() => overlay.locator('[data-ai-rival="true"]').count()).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS}/a2-contraataque-2d.png` });

    // «Ver en 3D» de la MISMA tarjeta: visor con el contraataque en rojo.
    const title = (await card.locator('h4').innerText()).trim();
    await card.getByRole('button', { name: `Ver en 3D: ${title}` }).click();
    const viewer = page.getByTestId('tactical-3d-viewer');
    await expect(viewer).toBeVisible({ timeout: 60_000 });
    await expect(viewer.locator('canvas')).toBeVisible();
    await expect(viewer.getByText('Contraataque del rival')).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Transmisión TV' })).toHaveAttribute('aria-pressed', 'true');
    // Al abrir, la capa 2D se apaga (no quedan las dos animaciones a la vez).
    await expect(overlay).toHaveCount(0);
    // Pasado el arranque (2 s de medición de fps) sigue en 3D: no cayó a 2D.
    await page.waitForTimeout(3_000);
    await expect(viewer).toBeVisible();
    await expect(page.getByText('Tu celular no soporta bien el 3D; seguimos en 2D')).toHaveCount(0);
    const gl = await viewer.locator('canvas').evaluate((c: HTMLCanvasElement) => {
        const ctx = c.getContext('webgl2');
        return ctx ? { w: ctx.drawingBufferWidth, h: ctx.drawingBufferHeight } : null;
    });
    expect(gl, 'contexto WebGL2 del visor').not.toBeNull();
    expect(gl!.w).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS}/a3-3d-tribuna.png` });

    // Volver a 2D: el visor se cierra y la pizarra + el análisis siguen ahí.
    await viewer.getByRole('button', { name: 'Volver a 2D' }).click();
    await expect(viewer).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Guardar jugada' })).toBeVisible();
    await expect(panel(page).getByText('Lectura de la jugada')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/a4-vuelta-2d.png` });

    // Métrica de uso (mockeada por la red de helpers/pizarra.ts): uno por acción.
    await expect.poll(() => events).toEqual(expect.arrayContaining(['ai_analyze', 'ai_view_counter', 'view_3d']));
});

test('(b) cupo agotado, dueño: «Comprar 50 análisis»', async ({ page, guard }) => {
    test.setTimeout(180_000);
    await rewriteRole(page, 'owner');
    await mockBalance(page, 0);
    await mockAnalyzeNoQuota(page, guard);
    await boardWithPlayers(page);
    await openAiPanel(page);
    await expect(panel(page).getByTestId('ai-balance')).toHaveText('No te quedan análisis este mes');
    await expect(panel(page).getByText('Se acabaron los análisis con IA de este mes.')).toBeVisible();
    const buy = panel(page).getByRole('button', { name: 'Comprar 50 análisis' });
    await expect(buy).toBeVisible();
    await expect(panel(page).getByText(/Pídele al administrador/)).toHaveCount(0);
    // Analizar igual responde 402 sin llamar al modelo y el aviso sigue.
    await panel(page).getByRole('button', { name: 'Analizar jugada' }).click();
    await expect(buy).toBeVisible();
    expect(guard.mocked.filter((m) => /tactical\/analyze$/.test(m))).toHaveLength(1);
    await page.screenshot({ path: `${SHOTS}/b1-sin-cupo-dueno.png` });
});

test('(c) cupo agotado, coach: «Pídele al administrador»', async ({ page, guard }) => {
    test.setTimeout(180_000);
    await mockBalance(page, 0);
    await mockAnalyzeNoQuota(page, guard);
    await boardWithPlayers(page);
    await openAiPanel(page);
    await expect(panel(page).getByText('Se acabaron los análisis con IA de este mes.')).toBeVisible();
    await expect(panel(page).getByText('Pídele al administrador de la escuela que compre 50 análisis más.')).toBeVisible();
    await expect(panel(page).getByRole('button', { name: 'Comprar 50 análisis' })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/c1-sin-cupo-coach.png` });
});
