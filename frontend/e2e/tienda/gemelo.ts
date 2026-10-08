// Helpers de la tienda v2 contra el GEMELO LOCAL (nunca la viva).
//
//  - prepararTiendaGemelo(): corre gemelo-tienda.sql en el contenedor Postgres
//    del gemelo (prende la tienda SOLO ahí, con allowlist del piloto).
//  - loginGemelo(): sesión real del seed (contraseña QaGemelo2026!) plantada en
//    localStorage, en el formato que espera supabase-js.
//  - assertBffEsGemelo(): el BFF de QA_TWIN_BFF_URL tiene que conocer la tienda
//    que solo existe en el gemelo; si no, se aborta (no se escribe en otro lado).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { assertNotProduction, PROD_SUPABASE_REF } from '../helpers/guard-no-prod';

const HERE = dirname(fileURLToPath(import.meta.url));

export const TWIN_SUPABASE_URL = process.env.QA_TWIN_SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const TWIN_ANON_KEY = process.env.QA_TWIN_ANON_KEY
    ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
export const TWIN_BFF_URL = process.env.QA_TWIN_BFF_URL ?? 'http://127.0.0.1:3000';
/** El Vite propio de playwright.gemelo.config.ts. */
export const BASE_URL = `http://localhost:${process.env.QA_TWIN_VITE_PORT ?? 3101}`;
const TWIN_DB_CONTAINER = 'supabase_db_sportmaps-qa-twin';
const PASSWORD = 'QaGemelo2026!';

export const TIENDA = {
    slug: 'tienda-qa-andes',
    vendorProfileId: '00000000-0000-4000-c000-0000000000a1',
    nombre: 'Tienda QA Academia Andes',
    camiseta: 'QA Camiseta oficial Academia Andes',
    gorra: 'QA Gorra Academia Andes',
    termo: 'QA Termo Academia Andes',
    cuenta: '000-QA-ANDES-01',
    escuelaA: '00000000-0000-4000-b000-000000000001',
};

export type Alias = 'padre.a' | 'padre.b' | 'admin.a' | 'owner.a' | 'atleta.a';

function assertLocal(url: string, what: string) {
    const u = new URL(url);
    if (!['127.0.0.1', 'localhost'].includes(u.hostname) || url.includes(PROD_SUPABASE_REF)) {
        throw new Error(`ABORTADO: ${what} no es local (${url}). Estas pruebas solo corren contra el gemelo.`);
    }
}

/** SQL contra el Postgres del gemelo (contenedor Docker local). */
export function sqlGemelo(sql: string): string {
    assertNotProduction();
    return execFileSync('docker', ['exec', '-i', TWIN_DB_CONTAINER, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], {
        input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
}

export function prepararTiendaGemelo(): void {
    assertLocal(TWIN_SUPABASE_URL, 'SUPABASE del gemelo');
    assertLocal(TWIN_BFF_URL, 'BFF del gemelo');
    const out = sqlGemelo(readFileSync(resolve(HERE, 'gemelo-tienda.sql'), 'utf8'));
    if (!out.includes('tienda-gemelo-ok|t|t')) throw new Error(`No se pudo preparar la tienda en el gemelo:\n${out}`);
}

/** Prende/apaga la tienda (solo gemelo) conservando la allowlist del piloto. */
export function tiendaEncendida(on: boolean): void {
    sqlGemelo(`update public.platform_config set value = jsonb_set(value, '{enabled}', '${on ? 'true' : 'false'}'::jsonb) where key = 'store_enabled';`);
}

export async function assertBffEsGemelo(): Promise<void> {
    assertLocal(TWIN_BFF_URL, 'BFF del gemelo');
    const res = await fetch(`${TWIN_BFF_URL}/api/v1/marketplace/vendor/${TIENDA.slug}`);
    const body = await res.json().catch(() => null) as { data?: { vendor?: { id?: string } } } | null;
    if (body?.data?.vendor?.id !== TIENDA.vendorProfileId) {
        throw new Error(`ABORTADO: el BFF ${TWIN_BFF_URL} no responde con la tienda del gemelo. ¿Está levantado con SUPABASE_URL=${TWIN_SUPABASE_URL}?`);
    }
}

async function token(alias: Alias) {
    const res = await fetch(`${TWIN_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: TWIN_ANON_KEY },
        body: JSON.stringify({ email: `${alias}@qa.sportmaps.test`, password: PASSWORD }),
    });
    if (!res.ok) throw new Error(`Login ${alias} falló: ${res.status} ${await res.text()}`);
    return res.json();
}

/** Contexto nuevo del navegador con la sesión de `alias` (y su escuela activa). */
export async function contextoComo(browser: Browser, alias: Alias, opts: Parameters<Browser['newContext']>[0] = {}): Promise<BrowserContext> {
    // Los contextos nuevos no heredan el baseURL ni el dispositivo del proyecto.
    const { defaultBrowserType: _ignored, ...rest } = (opts ?? {}) as Record<string, unknown>;
    const ctx = await browser.newContext({ baseURL: BASE_URL, ...(rest as Parameters<Browser['newContext']>[0]) });
    const t = await token(alias);
    const storageKey = `sb-${new URL(TWIN_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
    await ctx.addInitScript(([key, value, school]) => {
        if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
        if (school && !window.localStorage.getItem('sportmaps_active_school_id')) {
            window.localStorage.setItem('sportmaps_active_school_id', school);
        }
    }, [storageKey, JSON.stringify({
        access_token: t.access_token, refresh_token: t.refresh_token, expires_in: t.expires_in,
        expires_at: t.expires_at, token_type: 'bearer', user: t.user,
    }), alias === 'padre.b' ? '' : TIENDA.escuelaA] as const);
    return ctx;
}

const CAPTURAS = resolve(HERE, '..', '..', '..', 'docs', 'capturas', 'tienda-v2-checkout');

export async function captura(page: Page, nombre: string, fullPage = false): Promise<void> {
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(CAPTURAS, `${nombre}.png`), fullPage });
}

/** PNG de 1×1 para el comprobante (no es un comprobante real). */
export const COMPROBANTE_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
