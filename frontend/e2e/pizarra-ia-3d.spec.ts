import type { Page, Route } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test, expect, openBoardFromMatch, mockWrite, COACH, type WriteGuard } from './helpers/pizarra';
import { loginAs } from './helpers/auth';
type Shapes = typeof import('../../bff/src/routes/school/tacticalAiShapes');
// El BFF es CommonJS (sin "type": "module"): con require lo transpila el hook de Playwright.
const shapes = createRequire(import.meta.url)('../../bff/src/routes/school/tacticalAiShapes.ts') as Shapes;
const { anonymizePlay, deanonymizeResult, parseAnalyzeInput, validateAiResult } = shapes;

/**
 * «Analizar jugada» (M3) + «Ver en 3D» (M4) — docs/specs/pizarra-multideporte-3d-ia.md.
 *
 *   (a) analizar → lectura humanizada (ningún «p5»/«r4») → ver contraataque en
 *       2D → «Ver en 3D» abre el visor con el contraataque en rojo → volver a 2D;
 *   (b) cupo agotado, coach: «Usaste tu IA de este mes» + «Quiero más» → wa.me
 *       del comercial con el mensaje pre-llenado (sin atletas);
 *   (c) cupo agotado, dueño: lo mismo (cualquier rol con la pizarra);
 *   (d) super admin: «Uso de IA de pizarra» y «Dar más cupo».
 *
 * Cupo por costo real por usuario (spec §6, decisión 2026-10-14, migración
 * 20261014155445). Capturas del panel y del admin en IA_CUPO_SHOTS.
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

const CUPO_SHOTS = process.env.IA_CUPO_SHOTS || 'C:/Users/Usuario/AppData/Local/Temp/claude/ia-cupo-entrenador';
mkdirSync(CUPO_SHOTS, { recursive: true });

/** Saldo como lo devuelve el BFF (services/tactical-ai-budget.ts → toPublicBalance). */
const balance = (pctLeft: number, futbol: number) => ({
    period: '2026-10', used_usd: (100 - pctLeft) / 100, budget_usd: 1, remaining_usd: pctLeft / 100,
    pct: 100 - pctLeft, remaining_pct: pctLeft, exhausted: pctLeft < 8, limited_by: pctLeft < 8 ? 'user' : null,
    approx_remaining: { futbol, futbol7: futbol + 2, futbol5: futbol + 2, futsal: futbol + 1, voleibol: futbol + 4, baloncesto: futbol + 3, balonmano: futbol },
    analyses: Math.round((100 - pctLeft) / 6.4), cache_hits: 0,
});
const MORE_MSG = 'Hola, soy Profe QA de Club Demo. Usé mi IA de la pizarra de octubre 2026 (analizo jugadas de fútbol 11): 15 análisis, US$ 0,96 de US$ 1,00. Quiero más cupo de IA.';

/** GET del saldo (lectura; la pizarra manda ?sport=). */
async function mockBalance(page: Page, pctLeft: number, futbol: number) {
    await page.route(/\/api\/v1\/school\/tactical\/ai-balance(\?.*)?$/, async (route: Route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const b = balance(pctLeft, futbol);
        await route.fulfill({ json: b.exhausted ? { ...b, request_more_message: MORE_MSG } : b });
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
        return { result: deanonymizeResult(result, keyMap), cached: false, balance: balance(54, 8), keys: Object.fromEntries(keyMap) };
    });
}

/** 402 sin cupo (lo que responde el BFF sin llamar al modelo). */
async function mockAnalyzeNoQuota(page: Page, guard: WriteGuard) {
    await mockWrite(page, guard, /\/api\/v1\/school\/tactical\/analyze$/, {
        error: 'Usaste tu IA de este mes.', needs_more: true, limited_by: 'user', balance: balance(4, 0), request_more_message: MORE_MSG,
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
    // WebGL por software + arranque en frío: con la máquina cargada pasó de 4 min.
    test.setTimeout(420_000);
    const sent: { body: any }[] = [];
    const events: string[] = [];
    await mockBalance(page, 60, 9);
    await mockAnalyze(page, guard, sent);
    page.on('request', (r) => {
        if (/\/rpc\/log_tactical_board_event/.test(r.url())) events.push(String(r.postDataJSON()?.p_event));
    });
    await boardWithPlayers(page);
    await openAiPanel(page);
    await expect(panel(page).getByTestId('ai-balance')).toHaveText('Te queda el 60 % de tu IA este mes · unos 9 análisis de fútbol 11');
    await expect(panel(page).getByRole('progressbar', { name: 'IA que te queda este mes' })).toHaveAttribute('aria-valuenow', '60');
    await page.screenshot({ path: `${CUPO_SHOTS}/1-panel-con-barra.png` });

    await panel(page).getByRole('button', { name: 'Analizar jugada' }).click();
    await expect(panel(page).getByText('Lectura de la jugada')).toBeVisible({ timeout: 30_000 });
    await expect(panel(page).getByTestId('ai-balance')).toHaveText('Te queda el 54 % de tu IA este mes · unos 8 análisis de fútbol 11');

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
    // El visor y three.js llegan con import() al tocar «Ver en 3D»: con el dev server
    // en frío y la máquina cargada, transformarlos pasó de 60 s (2026-10-15).
    await expect(viewer).toBeVisible({ timeout: 180_000 });
    await expect(viewer.locator('canvas')).toBeVisible();
    await expect(viewer.getByText('Contraataque del rival')).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Transmisión TV' })).toHaveAttribute('aria-pressed', 'true');
    // Al abrir, la capa 2D se apaga (no quedan las dos animaciones a la vez).
    await expect(overlay).toHaveCount(0);
    // Pasado el arranque (2 s de medición de fps) sigue en 3D: no cayó a 2D.
    await page.waitForTimeout(3_000);
    await expect(viewer).toBeVisible();
    await expect(page.getByText('Tu dispositivo no soporta bien el 3D; seguimos en 2D')).toHaveCount(0);
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

const WA_HREF = `https://wa.me/573202683539?text=${encodeURIComponent(MORE_MSG)}`;

async function expectExhausted(page: Page, guard: WriteGuard, shot: string) {
    await boardWithPlayers(page);
    await openAiPanel(page);
    await expect(panel(page).getByTestId('ai-balance')).toHaveText('Usaste tu IA de este mes');
    const more = panel(page).getByRole('link', { name: 'Quiero más' });
    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute('href', WA_HREF);
    await expect(more).toHaveAttribute('target', '_blank');
    // El flujo de compra en la app (no construido) ya no existe.
    await expect(panel(page).getByText(/Comprar|Pídele al administrador/)).toHaveCount(0);
    await page.screenshot({ path: `${CUPO_SHOTS}/${shot}` });
    // Analizar igual responde 402 sin llamar al modelo y el aviso sigue.
    await panel(page).getByRole('button', { name: 'Analizar jugada' }).click();
    await expect(panel(page).getByText('Usaste tu IA de este mes.')).toBeVisible();
    await expect(more).toHaveAttribute('href', WA_HREF);
    expect(guard.mocked.filter((m) => /tactical\/analyze$/.test(m))).toHaveLength(1);
    // El mensaje no lleva nada de atletas (ni nombres del plantel ni ids).
    const text = decodeURIComponent(WA_HREF.split('?text=')[1]);
    expect(text).not.toMatch(/athlete:|child:|[0-9a-f]{8}-[0-9a-f]{4}-/);
}

test('(b) cupo agotado, coach: «Usaste tu IA de este mes» + «Quiero más» por WhatsApp', async ({ page, guard }) => {
    test.setTimeout(180_000);
    await mockBalance(page, 4, 0);
    await mockAnalyzeNoQuota(page, guard);
    await expectExhausted(page, guard, '2-panel-agotado-coach.png');
});

test('(c) cupo agotado, dueño: el mismo «Quiero más» (cualquier rol con la pizarra)', async ({ page, guard }) => {
    test.setTimeout(180_000);
    await rewriteRole(page, 'owner');
    await mockBalance(page, 4, 0);
    await mockAnalyzeNoQuota(page, guard);
    await expectExhausted(page, guard, '3-panel-agotado-dueno.png');
});

test('(d) super admin: «Uso de IA de pizarra» por escuela y coach, y «Dar más cupo»', async ({ page, guard }) => {
    test.setTimeout(180_000);
    // Solo en la LECTURA del perfil propio: la ruta exige profile.role = super_admin.
    await page.route(/\.supabase\.co\/rest\/v1\/profiles\?/, async (route: Route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const res = await route.fetch();
        const body = await res.json().catch(() => null);
        const fix = (m: any) => (m && typeof m === 'object' && 'role' in m ? { ...m, role: 'super_admin' } : m);
        await route.fulfill({ response: res, json: Array.isArray(body) ? body.map(fix) : fix(body) });
    });
    const S1 = '11111111-1111-4111-8111-111111111111';
    const S2 = '33333333-3333-4333-8333-333333333333';
    const coach = (id: string, name: string, analyses: number, cost: number, hit = false) => ({
        user_id: id, name, analyses, cache_hits: Math.floor(analyses / 4), tokens_in: analyses * 5000, tokens_out: analyses * 5900,
        cost_usd: cost, budget_usd: 1, pct: Math.round(cost * 1000) / 10, hit_limit: hit, needs_more_count: hit ? 3 : 0,
    });
    const report = {
        period: '2026-10',
        totals: { analyses: 41, cache_hits: 9, tokens_in: 205000, tokens_out: 241900, cost_usd: 2.52, schools: 2, coaches: 4, coaches_at_limit: 1 },
        by_sport: [
            { sport: 'futbol', label: 'fútbol 11', analyses: 22, cache_hits: 6, cost_usd: 1.41, avg_cost_usd: 0.064 },
            { sport: 'futbol7', label: 'fútbol 7', analyses: 6, cache_hits: 1, cost_usd: 0.31, avg_cost_usd: 0.052 },
            { sport: 'futbol5', label: 'fútbol 5', analyses: 0, cache_hits: 0, cost_usd: 0, avg_cost_usd: null },
            { sport: 'futsal', label: 'futsal', analyses: 4, cache_hits: 1, cost_usd: 0.22, avg_cost_usd: 0.056 },
            { sport: 'voleibol', label: 'voleibol', analyses: 9, cache_hits: 1, cost_usd: 0.39, avg_cost_usd: 0.043 },
            { sport: 'baloncesto', label: 'baloncesto', analyses: 0, cache_hits: 0, cost_usd: 0, avg_cost_usd: null },
            { sport: 'balonmano', label: 'balonmano', analyses: 0, cache_hits: 0, cost_usd: 0, avg_cost_usd: null },
        ],
        schools: [
            {
                school_id: S1, name: 'Club Demo Fútbol', analyses: 28, cache_hits: 7, tokens_in: 140000, tokens_out: 165200, cost_usd: 1.72,
                ceiling_usd: 10, pct: 17.2, hit_limit: false, coaches_at_limit: 1,
                coaches: [coach('u1', 'Profe Andrés', 16, 1.0, true), coach('u2', 'Profe Camila', 12, 0.72)],
            },
            {
                school_id: S2, name: 'Voley Norte', analyses: 13, cache_hits: 2, tokens_in: 65000, tokens_out: 76700, cost_usd: 0.8,
                ceiling_usd: 10, pct: 8, hit_limit: false, coaches_at_limit: 0,
                coaches: [coach('u3', 'Profe Diana', 9, 0.39), coach('u4', 'Profe Esteban', 4, 0.41)],
            },
        ],
    };
    await page.route(/\/api\/v1\/admin\/tactical-ai\/usage(\?.*)?$/, async (route: Route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({ json: report });
    });
    const grants: any[] = [];
    await mockWrite(page, guard, /\/api\/v1\/admin\/tactical-ai\/grant$/, (req) => { grants.push(req.postDataJSON()); return { ok: true }; });

    await loginAs(page, COACH);
    await page.goto('/admin/ia-pizarra');
    await expect(page.getByRole('heading', { name: 'Uso de IA de pizarra' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('ai-coach-u1')).toContainText('Topó (3)');
    await expect(page.getByTestId('ai-sport-futbol')).toContainText('0,064');
    await page.screenshot({ path: `${CUPO_SHOTS}/4-admin-uso-ia.png` });
    await page.getByTestId(`ai-school-${S2}`).scrollIntoViewIfNeeded();
    await expect(page.getByTestId(`ai-school-${S1}`)).toContainText('17,2 % de US$ 10');
    await page.screenshot({ path: `${CUPO_SHOTS}/4b-admin-por-escuela-y-coach.png` });

    await page.getByTestId('ai-coach-u1').getByRole('button', { name: /Dar más cupo/ }).click();
    await page.getByLabel('Monto (USD)').fill('2');
    await page.screenshot({ path: `${CUPO_SHOTS}/5-admin-dar-cupo.png` });
    await page.getByRole('button', { name: 'Dar cupo' }).click();
    await expect.poll(() => grants).toEqual([{ school_id: S1, user_id: 'u1', amount_usd: 2 }]);
});
