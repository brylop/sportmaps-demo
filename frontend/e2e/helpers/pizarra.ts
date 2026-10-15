// frontend/e2e/helpers/pizarra.ts
//
// Piezas comunes de los e2e de la pizarra táctica (docs/specs/pizarra-nivel-tacticalpad.md §6).
//
// La Supabase es UNA sola para todos los ambientes (docs/gotchas-tecnicos.md):
// estas pruebas NO escriben nada. Las lecturas van a la base y al BFF de dev de
// verdad; toda escritura (POST/PUT/PATCH/DELETE a Supabase o al BFF) se mockea
// con page.route. `writeGuard` es la red: lo que no tenga mock se ABORTA (no
// llega al servidor) y la prueba falla al final con la lista de lo que se escapó.

import { test as base, expect, type Page, type Request, type Route } from '@playwright/test';
import { loginAs } from './auth';

export const COACH = {
    email: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_EMAIL || 'qa-post-entreno-coach@sportmaps.test',
    password: process.env.PLAYWRIGHT_POST_ENTRENO_COACH_PASSWORD || 'TestPass123!',
};

/** Partido ficticio: los equipos demo no tienen partidos (solo se inyecta en la LECTURA). */
export const FAKE_MATCH_ID = '00000000-0000-4000-8000-0000000e2e01';

/** Carpeta de capturas de los pasos clave (fuera del repo). */
export const SHOTS_DIR = process.env.PIZARRA_E2E_SHOTS || 'C:/Users/Usuario/AppData/Local/Temp/claude/e2e-pizarra';

const SUPABASE_HOST = /\.supabase\.co$/;
const isBff = (url: URL) => url.pathname.startsWith('/api/v1/');
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** RPCs de solo LECTURA que la app llama por POST (PostgREST usa POST para toda RPC).
 *  Cualquier otra RPC sin mock se trata como escritura. */
const READ_ONLY_RPCS = new Set([
    'store_enabled',
    'user_school_ids',
    'user_staff_school_ids',
    'user_admin_school_ids',
    'is_school_admin',
    'is_super_admin',
    'get_my_schools',
    'school_shows_own_brand',
    'school_has_branding_feature',
]);

function describe(req: Request): string {
    const u = new URL(req.url());
    return `${req.method()} ${u.host}${u.pathname}`;
}

export interface WriteGuard {
    /** Escrituras que salieron sin mock (abortadas). */
    escaped: string[];
    /** Escrituras mockeadas (para afirmar sobre ellas si hace falta). */
    mocked: string[];
}

/**
 * Instala la red anti-escrituras. Debe ir ANTES de los mocks específicos:
 * Playwright evalúa las rutas de la última registrada a la primera, así que
 * los mocks registrados después la tapan y esta solo ve lo que nadie atendió.
 */
export async function installWriteGuard(page: Page): Promise<WriteGuard> {
    const guard: WriteGuard = { escaped: [], mocked: [] };
    await page.route(
        (url) => SUPABASE_HOST.test(url.hostname) || isBff(url),
        async (route: Route) => {
            const req = route.request();
            const url = new URL(req.url());
            if (!WRITE_METHODS.has(req.method())) return route.fallback();
            // Auth (login, refresh del token, logout): no toca datos de negocio.
            if (url.pathname.startsWith('/auth/v1/')) return route.fallback();
            const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([^/?]+)/);
            if (rpc && READ_ONLY_RPCS.has(rpc[1])) return route.fallback();
            guard.escaped.push(describe(req));
            return route.abort('blockedbyclient');
        },
    );
    return guard;
}

/** Mock de una escritura: registra la llamada y responde `json`. */
export async function mockWrite(
    page: Page,
    guard: WriteGuard,
    matcher: RegExp,
    json: unknown | ((req: Request) => unknown),
    status = 200,
): Promise<void> {
    await page.route(matcher, async (route) => {
        const req = route.request();
        if (!WRITE_METHODS.has(req.method())) return route.fallback();
        guard.mocked.push(describe(req));
        await route.fulfill({ status, json: typeof json === 'function' ? (json as (r: Request) => unknown)(req) : json });
    });
}

/** Escrituras "de fondo" que la app hace en cualquier pantalla y no son parte
 *  de lo que se prueba: se responden con un OK neutro. */
async function mockBackgroundWrites(page: Page, guard: WriteGuard): Promise<void> {
    // Registro del dispositivo para push (BFF).
    await mockWrite(page, guard, /\/api\/v1\/devices\/register/, { ok: true });
    // Métrica de uso de la pizarra (T0): RPC que inserta en tactical_board_events.
    await mockWrite(page, guard, /\/rest\/v1\/rpc\/log_tactical_board_event/, null, 200);
}

type Fixtures = { guard: WriteGuard };

/**
 * `test` con la red anti-escrituras puesta en cada prueba y verificada al final:
 * si algo se escapó, la prueba falla aunque todo lo demás haya pasado.
 */
export const test = base.extend<Fixtures>({
    guard: async ({ page }, use) => {
        const guard = await installWriteGuard(page);
        await mockBackgroundWrites(page, guard);
        // `use` es el callback de fixtures de Playwright, no el hook de React.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        await use(guard);
        expect(guard.escaped, `Escrituras sin mock (se abortaron): ${guard.escaped.join(', ')}`).toEqual([]);
    },
});
export { expect };

/** Inyecta un partido en la lectura de match_results (desde ahí se abre el tablero). */
export async function injectFakeMatch(page: Page): Promise<void> {
    await page.route(/\/rest\/v1\/match_results\?/, async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({
            json: [{
                id: FAKE_MATCH_ID, opponent: 'Rival QA', home_score: null, away_score: null,
                is_home: true, match_date: '2026-10-04', match_type: 'amistoso', notes: null,
            }],
        });
    });
}

/** Login del coach demo, /training-plans con el equipo THUNDER y la pestaña Fútbol. */
export async function openTrainingPlans(page: Page): Promise<void> {
    await loginAs(page, COACH);
    await page.goto('/training-plans');
    // Con dos workers y el dev server compilando en frío, el primer «Cargando...»
    // de la app pasó de 30 s (falla del 2026-10-14, sin relación con la prueba):
    // se espera a que la app termine de cargar con un tope holgado, sin reintentar.
    await expect(page.getByText('Cargando...', { exact: true })).toHaveCount(0, { timeout: 90_000 });
    await page.getByRole('combobox').first().click({ timeout: 60_000 });
    await page.getByRole('option', { name: /THUNDER/i }).first().click();
    await page.getByRole('button', { name: 'Fútbol', exact: true }).click();
}

/** La pizarra del partido inyectado, con la cancha cargada. */
export async function openBoardFromMatch(page: Page): Promise<void> {
    await injectFakeMatch(page);
    await openTrainingPlans(page);
    const entry = page.getByRole('button', { name: /Tablero táctico/ }).first();
    await expect(entry).toBeVisible({ timeout: 20_000 });
    await entry.click();
    await expect(page.getByRole('button', { name: 'Guardar jugada' })).toBeVisible({ timeout: 20_000 });
}

/** Firma de bytes de los archivos exportados. */
export const SIGNATURES = {
    png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
    webm: [0x1a, 0x45, 0xdf, 0xa3], // EBML
} as const;

export function startsWith(buf: Buffer, sig: readonly number[]): boolean {
    return buf.length >= sig.length && sig.every((b, i) => buf[i] === b);
}

/** MP4: la caja `ftyp` va en el byte 4. */
export function isMp4(buf: Buffer): boolean {
    return buf.length > 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp';
}
