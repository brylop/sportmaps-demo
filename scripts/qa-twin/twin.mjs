// scripts/qa-twin/twin.mjs — gemelo local de la base (Supabase en Docker).
//
//   npm run qa:twin:up      levanta el stack y, si la base esta vacia, carga volcado + seed
//   npm run qa:twin:reset   base en blanco (supabase db reset) + volcado + seed
//   npm run qa:twin:seed    vuelve a correr solo el seed (idempotente)
//   npm run qa:twin:status  URLs, llaves locales y que hay cargado
//   npm run qa:twin:down    apaga los contenedores (conserva el volumen)
//   npm run qa:twin:verify  compara la huella de esquema/permisos viva (solo lectura) vs gemelo
//
// El volcado sale de `npm run qa:dump-schema` (supabase/qa-twin/dump/, ignorado).
// Nada de aca toca la base viva: todo va contra el contenedor
// supabase_db_sportmaps-qa-twin. Ver docs/qa-gemelo-local.md.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
    DUMP_DIR, SEED_FILE, TWIN_WORKDIR, TWIN_DB_CONTAINER, run, dockerOk, twinClient,
} from './lib.mjs';

const EXCLUIR = 'edge-runtime,logflare,vector,imgproxy,supavisor';
const ARCHIVOS_VOLCADO = ['00_extensions.sql', '01_public.sql', '02_auth_storage.sql', '03_catalogos.sql'];
const cmd = process.argv[2] ?? 'up';

// La imagen local de Supabase trae DEFAULT PRIVILEGES que dan ALL (incluido
// TRUNCATE) a anon/authenticated/service_role sobre todo objeto nuevo en public.
// pg_dump solo emite los GRANT que la viva TIENE, no los REVOKE de lo que no
// tiene, asi que sin esto el gemelo quedaba MAS ABIERTO que la viva (anon con
// SELECT/TRUNCATE en las 261 tablas y EXECUTE en las 584 funciones). Se apagan
// antes de cargar; el propio volcado restablece al final los default privileges
// reales de la viva. No se toca el EXECUTE implicito de PUBLIC en funciones:
// la viva lo conserva en varias y pg_dump ya emite los REVOKE donde no.
// Verificable con `npm run qa:twin:verify`.
const PRE_PUBLIC = `
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
`;

// Huella de permisos: se compara viva vs gemelo en `verify`.
const HUELLA = `select
 (select count(*) from pg_class c where relnamespace='public'::regnamespace and relkind in ('r','v','m'))::int as relaciones,
 (select count(*) from pg_proc where pronamespace='public'::regnamespace)::int as funciones,
 (select count(*) from pg_policies where schemaname='public')::int as policies_public,
 (select count(*) from pg_policies where schemaname='storage')::int as policies_storage,
 (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relnamespace='public'::regnamespace and not tgisinternal)::int as triggers,
 (select count(*) from pg_class c where relnamespace='public'::regnamespace and relkind='r' and has_table_privilege('anon', c.oid, 'SELECT'))::int as anon_select_tablas,
 (select count(*) from pg_class c where relnamespace='public'::regnamespace and relkind='r' and has_table_privilege('anon', c.oid, 'TRUNCATE'))::int as anon_truncate_tablas,
 (select count(*) from pg_class c where relnamespace='public'::regnamespace and relkind='r' and has_table_privilege('authenticated', c.oid, 'UPDATE'))::int as auth_update_tablas,
 (select count(*) from pg_proc p where pronamespace='public'::regnamespace and has_function_privilege('anon', p.oid, 'EXECUTE'))::int as anon_execute_funciones,
 (select count(*) from pg_proc p where pronamespace='public'::regnamespace and has_function_privilege('authenticated', p.oid, 'EXECUTE'))::int as auth_execute_funciones,
 (select count(*) from pg_class c where relnamespace='public'::regnamespace and relkind='r' and relrowsecurity)::int as tablas_con_rls,
 has_column_privilege('anon','public.vendor_profiles','bank_data','SELECT') as anon_lee_bank_data`;
const t0 = Date.now();
const seg = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;
const sb = (args) => run('supabase', [...args, '--workdir', TWIN_WORKDIR]);

function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function asegurarDocker() {
    if (dockerOk()) return;
    if (process.platform === 'win32') {
        const exe = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
        if (existsSync(exe)) {
            console.log('Docker no responde: abriendo Docker Desktop y esperando hasta 3 min…');
            spawnSync('powershell', ['-NoProfile', '-Command', `Start-Process '${exe}'`]);
            for (let i = 0; i < 36; i++) { sleep(5000); if (dockerOk()) return; }
        }
    }
    console.error('Docker no esta corriendo. Abrir Docker Desktop (y aceptar sus avisos si los hay) y reintentar.');
    process.exit(1);
}

function corriendo() {
    const r = run('docker', ['inspect', '-f', '{{.State.Running}}', TWIN_DB_CONTAINER]);
    return r.code === 0 && r.stdout.trim() === 'true';
}

function start() {
    if (corriendo()) { console.log('El gemelo ya esta corriendo.'); return; }
    console.log(`Levantando Supabase local (excluye ${EXCLUIR})… la primera vez baja ~2 GB de imagenes.`);
    const r = sb(['start', '-x', EXCLUIR]);
    if (r.code !== 0) { console.error(r.stdout.slice(-2000) + r.stderr.slice(-2000)); process.exit(1); }
    console.log(`Stack arriba (${seg()}).`);
}

/** Corre un .sql con psql DENTRO del contenedor local. Devuelve las lineas de error. */
function psql(sql, { stopOnError = false, user = 'postgres' } = {}) {
    const r = spawnSync('docker', ['exec', '-i', TWIN_DB_CONTAINER, 'psql', '-U', user, '-d', 'postgres', '-q',
        '-v', `ON_ERROR_STOP=${stopOnError ? 1 : 0}`, '-f', '-'], {
        input: sql, encoding: 'utf8', maxBuffer: 1024 * 1024 * 256,
    });
    const errores = (r.stderr ?? '').split('\n').filter((l) => /ERROR:/.test(l));
    return { code: r.status ?? 1, errores, stderr: r.stderr ?? '' };
}

async function cargado() {
    const c = await twinClient();
    try {
        const r = await c.query(`select to_regclass('qa_twin.meta') is not null as hay`);
        if (!r.rows[0].hay) return null;
        return (await c.query('select * from qa_twin.meta order by loaded_at desc limit 1')).rows[0] ?? null;
    } finally { await c.end(); }
}

function cargarVolcado() {
    for (const f of ARCHIVOS_VOLCADO) {
        if (!existsSync(resolve(DUMP_DIR, f))) {
            console.error(`Falta supabase/qa-twin/dump/${f}. Correr antes: npm run qa:dump-schema`);
            process.exit(1);
        }
    }
    const log = [];
    let total = 0;
    for (const f of ARCHIVOS_VOLCADO) {
        let sql = readFileSync(resolve(DUMP_DIR, f), 'utf8');
        if (f === '00_extensions.sql') sql += '\nCREATE EXTENSION IF NOT EXISTS pg_net;\n' + PRE_PUBLIC;
        const r = psql(sql);
        total += r.errores.length;
        log.push(`== ${f}: ${r.errores.length} errores`, ...r.errores);
        console.log(`  ${f.padEnd(22)} ${r.errores.length} errores (${seg()})`);
    }
    writeFileSync(resolve(DUMP_DIR, 'load.log'), log.join('\n') + '\n');
    if (total) console.log(`  Detalle de errores de carga: supabase/qa-twin/dump/load.log`);
    return total;
}

function cargarSeed() {
    if (!existsSync(SEED_FILE)) { console.error('Falta supabase/seed/qa_twin_seed.sql'); process.exit(1); }
    const r = psql(readFileSync(SEED_FILE, 'utf8'), { stopOnError: true });
    if (r.code !== 0) {
        console.error('El seed fallo (ON_ERROR_STOP):\n' + r.stderr.split('\n').slice(-12).join('\n'));
        process.exit(1);
    }
    console.log(`  qa_twin_seed.sql      ok (${seg()})`);
}

function marcar(erroresCarga) {
    let generado = null;
    try { generado = JSON.parse(readFileSync(resolve(DUMP_DIR, 'manifest.json'), 'utf8')).generado; } catch { /* sin manifest */ }
    psql(`create schema if not exists qa_twin;
create table if not exists qa_twin.meta (loaded_at timestamptz default now(), dump_generado timestamptz, errores_carga int);
insert into qa_twin.meta (dump_generado, errores_carga) values (${generado ? `'${generado}'` : 'null'}, ${erroresCarga});`, { stopOnError: true });
}

async function cargarTodo() {
    console.log('Cargando volcado de la viva en el gemelo…');
    // Notificar a PostgREST al final, no por archivo.
    const errores = cargarVolcado();
    cargarSeed();
    marcar(errores);
    psql("NOTIFY pgrst, 'reload schema';");
}

function status() {
    const r = sb(['status', '-o', 'env']);
    if (r.code !== 0) { console.log('El gemelo no esta corriendo. `npm run qa:twin:up`'); return false; }
    const env = Object.fromEntries([...r.stdout.matchAll(/^([A-Z_]+)="?([^"\n]*)"?$/gm)].map((m) => [m[1], m[2]]));
    console.log([
        `SUPABASE_URL=${env.API_URL}`,
        `SUPABASE_ANON_KEY=${env.ANON_KEY}`,
        `SUPABASE_SERVICE_ROLE_KEY=${env.SERVICE_ROLE_KEY}`,
        `QA_TWIN_DB_URL=${env.DB_URL}`,
        `Studio: ${env.STUDIO_URL}   Correos (Mailpit): ${env.INBUCKET_URL ?? env.MAILPIT_URL ?? 'http://127.0.0.1:54324'}`,
        '(llaves de demo de la CLI local; no son secretas ni sirven fuera de esta maquina)',
    ].join('\n'));
    return true;
}

asegurarDocker();
switch (cmd) {
    case 'up': {
        start();
        const meta = await cargado();
        if (meta && !process.argv.includes('--force')) {
            console.log(`Ya cargado (${meta.loaded_at.toISOString()}, volcado del ${meta.dump_generado?.toISOString?.() ?? '?'}). ` +
                'Para recargar: npm run qa:twin:reset');
        } else {
            await cargarTodo();
        }
        status();
        console.log(`Listo en ${seg()}.`);
        break;
    }
    case 'reset': {
        start();
        console.log('Reseteando la base local (supabase db reset; sin migraciones del repo)…');
        const r = sb(['db', 'reset', '--no-seed']);
        if (r.code !== 0) { console.error(r.stdout.slice(-1500) + r.stderr.slice(-1500)); process.exit(1); }
        console.log(`  base en blanco (${seg()})`);
        await cargarTodo();
        status();
        console.log(`Listo en ${seg()}.`);
        break;
    }
    case 'seed': cargarSeed(); break;
    case 'verify': {
        // Compara la huella de esquema y permisos viva (solo lectura) vs gemelo.
        const { liveReadOnlyClient } = await import('./lib.mjs');
        const l = await liveReadOnlyClient();
        const viva = (await l.query(HUELLA)).rows[0];
        await l.end();
        const t = await twinClient();
        const gem = (await t.query(HUELLA)).rows[0];
        await t.end();
        let dif = 0;
        console.log('metrica'.padEnd(26), 'viva'.padStart(8), 'gemelo'.padStart(8));
        for (const k of Object.keys(viva)) {
            const igual = String(viva[k]) === String(gem[k]);
            if (!igual) dif++;
            console.log(k.padEnd(26), String(viva[k]).padStart(8), String(gem[k]).padStart(8), igual ? '' : '  <- DIFIERE');
        }
        console.log(dif ? `${dif} diferencias (si la viva cambio, regenerar: npm run qa:dump-schema && npm run qa:twin:reset)` : 'Gemelo fiel a la viva en todas las metricas.');
        process.exitCode = dif ? 1 : 0;
        break;
    }
    case 'status': {
        if (status()) {
            const meta = await cargado();
            console.log(meta ? `Cargado: ${meta.loaded_at.toISOString()} · errores de carga del volcado: ${meta.errores_carga}` : 'Base sin cargar.');
        }
        break;
    }
    case 'down': {
        const r = sb(['stop']);
        console.log(r.code === 0 ? 'Gemelo apagado (los datos quedan en el volumen de Docker).' : r.stderr);
        break;
    }
    default:
        console.error(`Comando desconocido: ${cmd}. Usar up | reset | seed | status | down`);
        process.exit(1);
}

