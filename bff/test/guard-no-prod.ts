// bff/test/guard-no-prod.ts
//
// Guarda anti-produccion para vitest de INTEGRACION del BFF (las que tocan una
// base real). Aborta la corrida si:
//   - SUPABASE_URL (o cualquier cadena de conexion) contiene el ref de produccion
//     `luebjarufsiadojhvxgi` — hay una sola Supabase para dev/stg/prod
//   - WOMPI_PUBLIC_KEY empieza por `pub_prod_`
//
// Revisa process.env y, para lo que falte, bff/.env (lo que dotenv cargaria al
// importar src/config: dotenv no pisa process.env, asi que se respeta ese orden).
// Por eso, para correr contra el gemelo, exportar en el shell las variables del
// gemelo (`npm run qa:twin:status` las imprime) antes de vitest.
//
// Cableado como globalSetup en bff/vitest.integration.config.ts. Tambien se
// puede importar `assertNotProduction()` desde un test. NO esta en
// vitest.config.ts: las unitarias no tocan base y no deben depender de esto.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const PROD_SUPABASE_REF = 'luebjarufsiadojhvxgi';

const URL_VARS = ['SUPABASE_URL', 'SUPABASE_DB_URL', 'DATABASE_URL', 'QA_TWIN_DB_URL', 'PUBLIC_API_URL'];
const WOMPI_VARS = ['WOMPI_PUBLIC_KEY'];

function parseDotenv(file: string): Record<string, string> {
    if (!existsSync(file)) return {};
    const out: Record<string, string> = {};
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
    return out;
}

export function findProductionTargets(
    env: Record<string, string | undefined> = process.env,
    dotenvFile: string | null = resolve(__dirname, '..', '.env'),
): string[] {
    const fromFile = dotenvFile ? parseDotenv(dotenvFile) : {};
    const valor = (k: string) => env[k] ?? fromFile[k];
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

export function assertNotProduction(
    env: Record<string, string | undefined> = process.env,
    dotenvFile: string | null = resolve(__dirname, '..', '.env'),
): void {
    const problemas = findProductionTargets(env, dotenvFile);
    if (problemas.length) {
        throw new Error(
            'ABORTADO por guard-no-prod — las pruebas de integracion nunca corren contra produccion:\n' +
            problemas.map((p) => `  - ${p}`).join('\n') +
            '\nExportar las variables del gemelo local (npm run qa:twin:status) — docs/qa-gemelo-local.md.',
        );
    }
}

/** Firma de globalSetup de vitest. */
export default function setup(): void {
    assertNotProduction();
}
