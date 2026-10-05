// scripts/qa-twin/lib.mjs — utilidades compartidas del gemelo local.
//
// Ver docs/qa-gemelo-local.md. Nada de aca escribe en la base viva.

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TWIN_WORKDIR = resolve(RAIZ, 'supabase', 'qa-twin');
export const DUMP_DIR = resolve(TWIN_WORKDIR, 'dump'); // ignorado por git
export const SEED_FILE = resolve(RAIZ, 'supabase', 'seed', 'qa_twin_seed.sql');
export const PROD_REF = 'luebjarufsiadojhvxgi';
export const TWIN_PROJECT_ID = 'sportmaps-qa-twin';
export const TWIN_DB_CONTAINER = `supabase_db_${TWIN_PROJECT_ID}`;
export const TWIN_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// `pg` vive en bff/node_modules (la raiz no lo declara).
const require = createRequire(resolve(RAIZ, 'bff', 'package.json'));
export const pg = require('pg');

export function run(cmd, args, opts = {}) {
    const r = spawnSync(cmd, args, {
        cwd: opts.cwd ?? RAIZ,
        encoding: 'utf8',
        input: opts.input,
        maxBuffer: 1024 * 1024 * 512,
        shell: false, // sin shell: la cadena de conexion nunca pasa por cmd.exe
        env: { ...process.env, ...(opts.env ?? {}) },
    });
    return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error };
}

export function dockerOk() {
    const r = run('docker', ['info', '--format', '{{.ServerVersion}}']);
    return r.code === 0 && r.stdout.trim().length > 0;
}

/**
 * Credenciales de SOLO LECTURA de esquema contra la viva.
 *
 * Orden:
 *  1. SUPABASE_DB_URL en el entorno del shell (nunca en archivos).
 *  2. La CLI de Supabase ya logueada y linkeada: `supabase db dump --dry-run`
 *     imprime el script de pg_dump con un rol temporal (cli_login_postgres,
 *     lo crea la Management API de Supabase y expira solo). Se parsea en
 *     memoria; NUNCA se imprime ni se escribe a disco.
 *
 * Devuelve un objeto de config para `pg.Client`.
 */
export function liveConnConfig() {
    if (process.env.SUPABASE_DB_URL) {
        return { connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } };
    }
    const r = run('supabase', ['db', 'dump', '--linked', '--dry-run', '-s', 'public']);
    if (r.code !== 0) {
        throw new Error('No se pudo obtener acceso de lectura a la viva via la CLI (¿`supabase login` y `supabase link` hechos?). ' +
            'Alternativa: exportar SUPABASE_DB_URL en el shell.\n' + r.stderr.split('\n').filter(l => !/PGPASSWORD/i.test(l)).slice(-5).join('\n'));
    }
    const env = {};
    for (const m of r.stdout.matchAll(/^export (PG[A-Z]+)="([^"]*)"/gm)) env[m[1]] = m[2];
    if (!env.PGHOST || !env.PGUSER || !env.PGPASSWORD) throw new Error('La CLI no devolvio credenciales parseables.');
    return {
        host: env.PGHOST, port: Number(env.PGPORT || 5432), user: env.PGUSER,
        password: env.PGPASSWORD, database: env.PGDATABASE || 'postgres',
        ssl: { rejectUnauthorized: false },
        setRole: 'postgres', // igual que el pg_dump de la CLI (--role postgres)
    };
}

/** Abre un cliente contra la viva en modo READ ONLY (cualquier escritura falla con 25006). */
export async function liveReadOnlyClient() {
    const cfg = liveConnConfig();
    const host = cfg.host ?? cfg.connectionString ?? '';
    if (!host.includes('supabase')) throw new Error('Destino inesperado para la viva.');
    const { setRole, ...pgCfg } = cfg;
    const c = new pg.Client({ ...pgCfg, application_name: 'qa-twin-dump (read only)' });
    await c.connect();
    if (setRole) await c.query(`SET ROLE ${setRole}`);
    await c.query('SET default_transaction_read_only = on');
    await c.query("SET statement_timeout = '60s'");
    return c;
}

/** Cliente contra el gemelo local. Aborta si por algun motivo apunta a otra cosa. */
export async function twinClient(url = process.env.QA_TWIN_DB_URL ?? TWIN_DB_URL) {
    assertNotProd(url);
    if (!/@(127\.0\.0\.1|localhost):/.test(url)) {
        throw new Error(`El runner del gemelo solo corre contra localhost. URL recibida: ${url.replace(/:[^:@/]*@/, ':***@')}`);
    }
    const c = new pg.Client({ connectionString: url, application_name: 'qa-twin' });
    await c.connect();
    return c;
}

export function assertNotProd(...valores) {
    for (const v of valores) {
        if (v && String(v).includes(PROD_REF)) {
            throw new Error(`ABORTADO: el destino apunta a la base de produccion (${PROD_REF}).`);
        }
    }
}
