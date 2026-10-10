// scripts/pruebas-cobros-y-pagos-concurrencia.mjs
//
// Pruebas de CONCURRENCIA de «Cobros y pagos» F1 (docs/specs/cobros-multiples.md §13)
// con DOS conexiones reales a Postgres. Script de harness, no de UI.
//
// ── Alcance y seguridad ─────────────────────────────────────────────────────
//   · SOLO Club Campestre Demo (25a123f0-6d57-48a4-9800-7b1531d61cd2). Aborta si la
//     escuela no existe o no se llama así.
//   · Por defecto (modo ROLLBACK) cada conexión trabaja en su propia transacción y
//     termina en ROLLBACK: no persiste nada. En este modo se verifica la
//     SERIALIZACIÓN (la segunda transacción espera a la primera y nunca hay
//     deadlock ni duplicado); el resultado «visto por la segunda» de un commit se
//     cubre en los _smoke SQL (misma transacción).
//   · --commit (opt-in, exige además CYP_CONFIRMO=campestre en el entorno): la
//     primera conexión hace COMMIT y se verifica la semántica completa
//     (duplicated:true, PREVIEW_STALE, ATLETA_DUPLICADO). Deja filas en Campestre:
//     al final ANULA los lotes creados (annul_charge_batch), no borra nada
//     (los datos de prueba los borra el usuario).
//
// ── Conexión ────────────────────────────────────────────────────────────────
//   · --twin: gemelo local (QA_TWIN_DB_URL o postgresql://postgres:postgres@127.0.0.1:54322/postgres).
//   · si no: SUPABASE_DB_URL del entorno del shell (nunca de archivos), o la CLI
//     de Supabase logueada y linkeada (mismo mecanismo que scripts/qa-twin/lib.mjs).
//
// ── Casos (§13) ─────────────────────────────────────────────────────────────
//   C1  doble clic (mismo client_request_id)                    → 1 lote
//   C2  dos admins, mismo grupo y torneo, distinto request      → nunca 2 cobros sin decisión
//   C5  dos lotes con atletas solapados en orden inverso         → sin deadlock (40P01)
//   C8  anular con expected_count viejo                          → ANNUL_STALE
//   C12 dos admins descuentan el mismo cobro                     → el segundo PREVIEW_STALE
//   C16 dos admins crean el mismo atleta nuevo                   → el segundo ATLETA_DUPLICADO
//   Cubiertos en los _smoke SQL (una conexión): C6 (excedente ya facturado),
//   C9 (todo o nada), C14 (descuento bajo lo abonado), C15 (doble registro = C1).
//   Pendientes de prueba manual (dependen de jobs/pasarela): C3 (open_month a la
//   vez), C4 (alta a la vez: misma llave advisory, ver código), C7/C10 (webhook
//   Wompi), C11 (comprobante a la vez), C13 (apply_late_fees), C17.
//
// Uso:
//   node scripts/pruebas-cobros-y-pagos-concurrencia.mjs            # live, ROLLBACK
//   node scripts/pruebas-cobros-y-pagos-concurrencia.mjs --twin     # gemelo local
//   CYP_CONFIRMO=campestre node scripts/pruebas-cobros-y-pagos-concurrencia.mjs --commit
//
// Sale con código 1 si algún caso falla.

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(RAIZ, 'bff', 'package.json'));
const pg = require('pg');

const CAMPESTRE = '25a123f0-6d57-48a4-9800-7b1531d61cd2';
const TWIN = process.argv.includes('--twin');
const COMMIT = process.argv.includes('--commit');
if (COMMIT && process.env.CYP_CONFIRMO !== 'campestre') {
    console.error('--commit escribe en Club Campestre Demo. Exporta CYP_CONFIRMO=campestre para confirmarlo.');
    process.exit(1);
}

function conexion() {
    if (TWIN) {
        const url = process.env.QA_TWIN_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
        if (!/@(127\.0\.0\.1|localhost):/.test(url)) throw new Error('--twin solo contra localhost');
        return { connectionString: url };
    }
    if (process.env.SUPABASE_DB_URL) {
        return { connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } };
    }
    const r = spawnSync('supabase', ['db', 'dump', '--linked', '--dry-run', '-s', 'public'], { encoding: 'utf8', shell: false });
    if (r.status !== 0) throw new Error('Sin SUPABASE_DB_URL y la CLI de Supabase no dio credenciales (supabase login + link).');
    const env = {};
    for (const m of r.stdout.matchAll(/^export (PG[A-Z]+)="([^"]*)"/gm)) env[m[1]] = m[2];
    return {
        host: env.PGHOST, port: Number(env.PGPORT || 5432), user: env.PGUSER, password: env.PGPASSWORD,
        database: env.PGDATABASE || 'postgres', ssl: { rejectUnauthorized: false }, setRole: 'postgres',
    };
}

async function abrir(nombre) {
    const { setRole, ...cfg } = conexion();
    const c = new pg.Client({ ...cfg, application_name: `cyp-concurrencia-${nombre}` });
    await c.connect();
    if (setRole) await c.query(`SET ROLE ${setRole}`);
    await c.query("SET statement_timeout = '60s'");
    await c.query("SET lock_timeout = '20s'");
    return c;
}

const resultados = [];
const lotesCreados = [];
function ok(caso, msg) { resultados.push({ caso, ok: true, msg }); console.log(`✅ ${caso}: ${msg}`); }
function falla(caso, msg) { resultados.push({ caso, ok: false, msg }); console.error(`❌ ${caso}: ${msg}`); }

/** ¿la promesa sigue pendiente después de ms? (la segunda conexión está esperando un lock) */
async function sigueEsperando(promesa, ms) {
    let listo = false;
    promesa.then(() => { listo = true; }, () => { listo = true; });
    await new Promise(r => setTimeout(r, ms));
    return !listo;
}
async function fin(c) { await c.query(COMMIT ? 'COMMIT' : 'ROLLBACK'); }
async function rollback(c) { try { await c.query('ROLLBACK'); } catch { /* sin transacción */ } }

const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10); // Bogotá ≈ UTC−5
const sql = {
    preview: 'SELECT public.preview_charge_batch($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, NULL, NULL, $6::jsonb, \'[]\'::jsonb, $7) AS r',
    create: `SELECT public.create_charge_batch($1, $2, $3, $4, '{}'::jsonb, $5::jsonb, $6::jsonb, '[]'::jsonb, false, $7,
             $8::jsonb, NULL, NULL, $9::jsonb) AS r`,
};
async function preview(c, actor, athletes, lines, mode, pending = [], nuevo = null) {
    const { rows } = await c.query(sql.preview, [CAMPESTRE, actor, JSON.stringify(athletes), JSON.stringify(lines),
        JSON.stringify(pending), nuevo ? JSON.stringify(nuevo) : null, mode]);
    return rows[0].r;
}
function crear(c, actor, req, mode, athletes, lines, hash, pending = [], nuevo = null) {
    return c.query(sql.create, [CAMPESTRE, actor, req, mode, JSON.stringify(athletes), JSON.stringify(lines), hash,
        JSON.stringify(pending), nuevo ? JSON.stringify(nuevo) : null]).then(r => r.rows[0].r);
}

const A = await abrir('A');
const B = await abrir('B');
let codigoSalida = 0;
try {
    // ── Contexto: solo Campestre ────────────────────────────────────────────
    const { rows: [esc] } = await A.query('SELECT owner_id FROM public.schools WHERE id = $1 AND name = $2',
        [CAMPESTRE, 'Club Campestre Demo']);
    if (!esc?.owner_id) throw new Error('ABORTADO: Club Campestre Demo no existe o no tiene owner.');
    const owner = esc.owner_id;
    const { rows: [f1] } = await A.query("SELECT to_regprocedure('public.create_charge_batch(uuid,uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,boolean,text,jsonb,jsonb,jsonb,jsonb)') AS f");
    if (!f1.f) throw new Error('ABORTADO: las migraciones cobros_f1_* no están aplicadas (falta create_charge_batch).');
    const { rows: atletas } = await A.query(`
        SELECT DISTINCT e.child_id AS id FROM public.enrollments e
         WHERE e.school_id = $1 AND e.status = 'active' AND e.child_id IS NOT NULL
         ORDER BY 1 LIMIT 2`, [CAMPESTRE]);
    if (atletas.length < 2) throw new Error('SETUP: Campestre necesita 2 atletas menores con inscripción activa.');
    const [x, y] = atletas.map(a => ({ type: 'child', id: a.id }));
    const marca = `CONC ${Date.now().toString(36)}`;
    const torneo = (n) => [{ idx: 0, category: 'torneo', amount: 80000, due_date: hoy, concept: `Torneo ${marca} ${n}` }];

    // ── C1 doble clic ──────────────────────────────────────────────────────
    {
        const req = randomUUID();
        const lines = torneo('c1');
        await A.query('BEGIN'); await B.query('BEGIN');
        const p = await preview(A, owner, [x], lines, 'single');
        const rA = await crear(A, owner, req, 'single', [x], lines, p.preview_hash);
        const promB = crear(B, owner, req, 'single', [x], lines, p.preview_hash);
        const espera = await sigueEsperando(promB, 1500);
        await fin(A);
        const rB = await promB;
        await rollback(B);
        if (COMMIT) lotesCreados.push(rA.batch_id);
        if (!espera) falla('C1', 'la segunda llamada no esperó el lock del client_request_id');
        else if (COMMIT && !(rB.duplicated && rB.batch_id === rA.batch_id)) falla('C1', `esperaba duplicated:true, llegó ${JSON.stringify(rB)}`);
        else ok('C1', COMMIT ? '1 lote; la segunda devolvió duplicated:true' : 'la segunda esperó y siguió tras el ROLLBACK de la primera');
    }

    // ── C2 dos admins, mismo torneo, distinto request ───────────────────────
    {
        const lines = torneo('c2');
        const pA = await preview(A, owner, [x, y], lines, 'multi');
        const pB = await preview(B, owner, [x, y], lines, 'multi');
        await A.query('BEGIN'); await B.query('BEGIN');
        const rA = await crear(A, owner, randomUUID(), 'multi', [x, y], lines, pA.preview_hash);
        const promB = crear(B, owner, randomUUID(), 'multi', [x, y], lines, pB.preview_hash).then(v => ({ v }), e => ({ e }));
        const espera = await sigueEsperando(promB, 1500);
        await fin(A);
        const rB = await promB;
        await rollback(B);
        if (COMMIT) lotesCreados.push(rA.batch_id);
        if (!espera) falla('C2', 'el segundo lote no esperó al primero (locks por atleta)');
        else if (COMMIT && !(rB.e && /PREVIEW_STALE/.test(rB.e.message))) falla('C2', `esperaba PREVIEW_STALE, llegó ${rB.e?.message ?? JSON.stringify(rB.v)}`);
        else if (!COMMIT && rB.e) falla('C2', `tras el ROLLBACK de A, B debía crear: ${rB.e.message}`);
        else ok('C2', COMMIT ? 'el segundo recibió PREVIEW_STALE (misma_linea_hoy)' : 'serializados por la llave enrollment_fees:<atleta>');
    }

    // ── C5 orden inverso, sin deadlock ──────────────────────────────────────
    {
        const l1 = torneo('c5a'); const l2 = torneo('c5b');
        const pA = await preview(A, owner, [x, y], l1, 'multi');
        const pB = await preview(B, owner, [y, x], l2, 'multi');
        await A.query('BEGIN'); await B.query('BEGIN');
        const prA = crear(A, owner, randomUUID(), 'multi', [x, y], l1, pA.preview_hash).then(v => ({ v }), e => ({ e }));
        const prB = crear(B, owner, randomUUID(), 'multi', [y, x], l2, pB.preview_hash).then(v => ({ v }), e => ({ e }));
        // El que consiga los locks primero termina primero; el otro espera.
        const primero = await Promise.race([prA.then(() => 'A'), prB.then(() => 'B')]);
        await fin(primero === 'A' ? A : B);
        const rA = await prA;
        const rB = await prB;
        await fin(primero === 'A' ? B : A);
        if (COMMIT) { if (rA.v) lotesCreados.push(rA.v.batch_id); if (rB.v) lotesCreados.push(rB.v.batch_id); }
        const dead = [rA, rB].some(r => r.e && (r.e.code === '40P01' || /deadlock/i.test(r.e.message)));
        if (dead) falla('C5', 'deadlock entre lotes con atletas en orden inverso');
        else if (rA.e || rB.e) falla('C5', `error inesperado: ${(rA.e ?? rB.e).message}`);
        else ok('C5', 'locks en orden estable por id: sin deadlock');
    }

    // ── C8 anular con expected_count viejo ──────────────────────────────────
    {
        await A.query('BEGIN');
        const lines = torneo('c8');
        const p = await preview(A, owner, [x, y], lines, 'multi');
        const r = await crear(A, owner, randomUUID(), 'multi', [x, y], lines, p.preview_hash);
        let msg = '';
        await A.query('SAVEPOINT s');
        try {
            await A.query('SELECT public.annul_charge_batch($1, $2, $3, $4, $5)', [CAMPESTRE, owner, r.batch_id, 'prueba concurrencia', 99]);
        } catch (e) { msg = e.message; }
        await A.query('ROLLBACK TO SAVEPOINT s');
        const { rows: [b] } = await A.query('SELECT status FROM public.charge_batches WHERE id = $1', [r.batch_id]);
        await rollback(A);
        if (!/ANNUL_STALE/.test(msg) || b.status !== 'created') falla('C8', `esperaba ANNUL_STALE y nada cambiado; llegó "${msg}", estado ${b.status}`);
        else ok('C8', 'ANNUL_STALE y el lote sigue intacto');
    }

    // ── C12 dos admins descuentan el mismo cobro ────────────────────────────
    {
        // Cobro abierto de Campestre del atleta x (en --commit se crea uno propio).
        let pago;
        if (COMMIT) {
            const lines = torneo('c12');
            const p = await preview(A, owner, [x], lines, 'single');
            const r = await crear(A, owner, randomUUID(), 'single', [x], lines, p.preview_hash);
            lotesCreados.push(r.batch_id);
            pago = r.payment_ids[0];
        } else {
            const { rows } = await A.query(`SELECT p.id FROM public.payments p WHERE p.school_id = $1 AND p.child_id = $2
                AND p.status IN ('pending','overdue') AND COALESCE(p.amount_paid,0) = 0
                AND NOT EXISTS (SELECT 1 FROM public.payment_links l WHERE l.payment_id = p.id AND l.status='pending' AND l.expires_at > now())
                LIMIT 1`, [CAMPESTRE, x.id]);
            pago = rows[0]?.id;
        }
        if (!pago) {
            ok('C12', 'OMITIDO: el atleta no tiene cobro abierto para probar (correr con --commit)');
        } else {
            const { rows: [pp] } = await A.query('SELECT amount, COALESCE(amount_paid,0) AS paid FROM public.payments WHERE id = $1', [pago]);
            const pend = [{ payment_id: pago, seen: { amount: Number(pp.amount), amount_paid: Number(pp.paid) },
                            discount: { basis: 'porcentaje', value: 5, reason_code: 'convenio' } }];
            const pA = await preview(A, owner, [x], [], 'single', pend);
            const pB = await preview(B, owner, [x], [], 'single', pend);
            await A.query('BEGIN'); await B.query('BEGIN');
            await crear(A, owner, randomUUID(), 'single', [x], [], pA.preview_hash, pend);
            const prB = crear(B, owner, randomUUID(), 'single', [x], [], pB.preview_hash, pend).then(v => ({ v }), e => ({ e }));
            const espera = await sigueEsperando(prB, 1500);
            await fin(A);
            const rB = await prB;
            await rollback(B);
            if (!espera) falla('C12', 'el segundo descuento no esperó el FOR UPDATE del cobro');
            else if (COMMIT && !(rB.e && /PREVIEW_STALE/.test(rB.e.message))) falla('C12', `esperaba PREVIEW_STALE, llegó ${rB.e?.message ?? 'éxito'}`);
            else if (!COMMIT && rB.e) falla('C12', `tras el ROLLBACK de A, B debía aplicar: ${rB.e.message}`);
            else ok('C12', COMMIT ? 'el segundo recibió PREVIEW_STALE: nunca dos descuentos sin verlos' : 'serializados por FOR UPDATE del cobro');
        }
    }

    // ── C16 dos admins crean el mismo atleta nuevo ──────────────────────────
    {
        const nuevo = { kind: 'menor', full_name: `Concurrencia ${marca}`, guardian_phone: '3001234567' };
        const lines = [{ idx: 0, category: 'clase_extra', amount: 30000, due_date: hoy, concept: 'Clase suelta' }];
        const pA = await preview(A, owner, [], lines, 'single', [], nuevo);
        const pB = await preview(B, owner, [], lines, 'single', [], nuevo);
        await A.query('BEGIN'); await B.query('BEGIN');
        const rA = await crear(A, owner, randomUUID(), 'single', [], lines, pA.preview_hash, [], nuevo);
        const prB = crear(B, owner, randomUUID(), 'single', [], lines, pB.preview_hash, [], nuevo).then(v => ({ v }), e => ({ e }));
        const espera = await sigueEsperando(prB, 1500);
        await fin(A);
        const rB = await prB;
        await rollback(B);
        if (COMMIT) lotesCreados.push(rA.batch_id);
        if (!espera) falla('C16', 'el segundo alta no esperó el lock athlete_new');
        else if (COMMIT && !(rB.e && /ATLETA_DUPLICADO/.test(rB.e.message))) falla('C16', `esperaba ATLETA_DUPLICADO, llegó ${rB.e?.message ?? 'éxito'}`);
        else if (!COMMIT && rB.e) falla('C16', `tras el ROLLBACK de A, B debía crear: ${rB.e.message}`);
        else ok('C16', COMMIT ? 'el segundo recibió ATLETA_DUPLICADO' : 'serializados por athlete_new:<escuela>:<nombre>');
    }

    // ── Limpieza del modo --commit: anular (no borrar) lo creado ────────────
    for (const id of lotesCreados) {
        const { rows: [n] } = await A.query(`SELECT count(*)::int AS n FROM public.payments
            WHERE charge_batch_id = $1 AND status IN ('pending','overdue','rejected','failed') AND COALESCE(amount_paid,0) = 0`, [id]);
        if (n.n > 0) {
            await A.query('SELECT public.annul_charge_batch($1, $2, $3, $4, $5)', [CAMPESTRE, owner, id, 'limpieza pruebas de concurrencia', n.n]);
        }
    }
} catch (e) {
    console.error(e.message);
    codigoSalida = 1;
} finally {
    await rollback(A); await rollback(B);
    await A.end(); await B.end();
}

const fallas = resultados.filter(r => !r.ok).length;
console.log(`\n${resultados.length - fallas}/${resultados.length} casos OK · modo ${COMMIT ? 'COMMIT' : 'ROLLBACK'}${TWIN ? ' · gemelo' : ''}`);
process.exit(fallas > 0 || codigoSalida ? 1 : 0);
