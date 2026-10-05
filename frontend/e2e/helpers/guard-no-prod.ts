// frontend/e2e/helpers/guard-no-prod.ts
//
// Guarda anti-produccion para Playwright (y cualquier script de prueba en TS).
// Aborta si algo apunta a la base viva o a llaves de cobro reales:
//   - cualquier URL/cadena de conexion que contenga el ref de produccion
//     `luebjarufsiadojhvxgi` (una sola Supabase para todo: ver docs/gotchas-tecnicos.md)
//   - una llave publica de Wompi de produccion (`pub_prod_…`)
//
// Uso:
//   1) Como globalSetup (ya cableado en frontend/playwright.gemelo.config.ts):
//        globalSetup: './e2e/helpers/guard-no-prod.ts'
//   2) Directo en un spec o helper:
//        import { assertNotProduction } from './helpers/guard-no-prod';
//        assertNotProduction();
//
// Mira process.env y, para las variables que no esten ahi, el frontend/.env que
// Vite cargaria (process.env gana, igual que en Vite). Ver docs/qa-gemelo-local.md.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const PROD_SUPABASE_REF = 'luebjarufsiadojhvxgi';

/** Variables con URLs/cadenas de conexion que no pueden apuntar a produccion. */
const URL_VARS = [
    'SUPABASE_URL', 'VITE_SUPABASE_URL', 'PLAYWRIGHT_SUPABASE_URL',
    'SUPABASE_DB_URL', 'DATABASE_URL', 'QA_TWIN_DB_URL', 'PLAYWRIGHT_BASE_URL',
];
/** Llaves de Wompi que no pueden ser de produccion. */
const WOMPI_VARS = ['WOMPI_PUBLIC_KEY', 'VITE_WOMPI_PUBLIC_KEY'];

function parseDotenv(file: string): Record<string, string> {
    if (!existsSync(file)) return {};
    const out: Record<string, string> = {};
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
    return out;
}

export interface GuardOptions {
    /** Entorno a revisar (default: process.env). */
    env?: Record<string, string | undefined>;
    /** Archivos .env que la app cargaria si la variable no esta en env. */
    dotenvFiles?: string[];
}

/** Devuelve la lista de problemas (vacia = seguro). No lanza. */
export function findProductionTargets(opts: GuardOptions = {}): string[] {
    const env = opts.env ?? process.env;
    const files = opts.dotenvFiles ??
        ['.env', '.env.local', '.env.development', '.env.development.local'].map((f) => resolve(HERE, '..', '..', f));
    const fromFiles = Object.assign({}, ...files.map(parseDotenv)) as Record<string, string>;
    const valor = (k: string) => env[k] ?? fromFiles[k];

    const problemas: string[] = [];
    for (const k of URL_VARS) {
        const v = valor(k);
        if (v && v.includes(PROD_SUPABASE_REF)) problemas.push(`${k} apunta a la base de produccion (${PROD_SUPABASE_REF})`);
    }
    for (const k of WOMPI_VARS) {
        const v = valor(k);
        if (v && v.trim().startsWith('pub_prod_')) problemas.push(`${k} es una llave de Wompi de PRODUCCION (pub_prod_…)`);
    }
    return problemas;
}

/** Lanza (y corta la corrida) si algo apunta a produccion. */
export function assertNotProduction(opts: GuardOptions = {}): void {
    const problemas = findProductionTargets(opts);
    if (problemas.length) {
        throw new Error(
            'ABORTADO por guard-no-prod — estas pruebas nunca corren contra produccion:\n' +
            problemas.map((p) => `  - ${p}`).join('\n') +
            '\nUsar el gemelo local: npm run qa:twin:up (docs/qa-gemelo-local.md).',
        );
    }
}

/** Export por defecto: firma de globalSetup de Playwright. */
export default async function globalSetup(): Promise<void> {
    assertNotProduction();
}
