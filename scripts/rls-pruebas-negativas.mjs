// scripts/rls-pruebas-negativas.mjs
//
// Prueba de COMPORTAMIENTO de RLS contra la base viva — no de forma.
//
// ── Por qué existe ──────────────────────────────────────────────────────────
// `seguridad:invariantes` (RPC `invariantes_seguridad()`) escanea la FORMA de
// las policies (pg_policies) y detecta patrones prohibidos. Pero nunca se
// sienta a actuar como un padre, un coach ajeno, o un reporter, y probar si
// un INSERT/UPDATE/DELETE real pasa o rebota. Esta es esa prueba.
//
// Nace del track PER (fase 5 del plan de periodización): el fix de
// `match_lineups`/`team_tactical_presets`/`football_match_events` del
// 2026-09-23..25 (migración `20260925170001`) cerró un bypass real
// (`OR created_by = auth.uid()`, trivialmente satisfacible) que un escaneo de
// forma sola no distingue de una policy sana — hay que probarlo actuando.
//
// ── Cómo simula usuarios ────────────────────────────────────────────────────
// Este proyecto NO tiene `SUPABASE_JWT_SECRET` configurado (confirmado
// 2026-09-29 — ver comentario en bff/src/utils/authCache.ts), así que no se
// pueden auto-firmar JWTs de sesión. En su lugar se crean usuarios de auth
// REALES y DESECHABLES vía Admin API (service_role), se hace login real con
// password para obtener un access_token legítimo, y se prueba contra
// PostgREST con ese token — el camino real de punta a punta, no un atajo.
// Todo (usuarios, escuelas, equipos, filas de prueba) se borra al final,
// pase lo que pase, incluso si el proceso se corta a mitad de camino
// (el bloque `finally` corre siempre que no sea SIGKILL).
//
// Uso:
//   npm run seguridad:rls-negativas
//
// Sale con código 1 si algún caso no se comportó como se esperaba.

import { createClient } from '../bff/node_modules/@supabase/supabase-js/dist/index.mjs';
import { config } from '../bff/node_modules/dotenv/lib/main.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(RAIZ, 'bff/.env') });

const URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
    console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en bff/.env');
    process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
const marca = Date.now();

// ── Inventario de todo lo desechable, para poder borrarlo en el finally ────
const inventario = { authUserIds: [], schoolIds: [], teamIds: [], schoolMemberIds: [], filas: [] };

async function crearUsuario(etiqueta) {
    const email = `rls-prueba-${etiqueta}-${marca}-${randomUUID()}@rls-pruebas-negativas.invalid`;
    const password = `Prueba-${randomUUID()}!A1`;
    const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'parent' }, // solo para que el trigger de signup no aborte; el rol real vive en school_members
    });
    if (error) throw new Error(`No se pudo crear usuario desechable "${etiqueta}": ${error.message}`);
    inventario.authUserIds.push(data.user.id);

    const cliente = createClient(URL, ANON_KEY, { auth: { persistSession: false } });
    const { error: loginError } = await cliente.auth.signInWithPassword({ email, password });
    if (loginError) throw new Error(`No se pudo iniciar sesión con "${etiqueta}": ${loginError.message}`);

    return { id: data.user.id, cliente };
}

async function crearEscuela(nombre) {
    const { data, error } = await admin
        .from('schools')
        .insert({ name: nombre, is_demo: true })
        .select('id')
        .single();
    if (error) throw new Error(`No se pudo crear escuela desechable: ${error.message}`);
    inventario.schoolIds.push(data.id);
    return data.id;
}

async function crearEquipo(schoolId, nombre) {
    const { data, error } = await admin
        .from('teams')
        .insert({ school_id: schoolId, name: nombre, sport: 'futbol', is_demo: true })
        .select('id')
        .single();
    if (error) throw new Error(`No se pudo crear equipo desechable: ${error.message}`);
    inventario.teamIds.push(data.id);
    return data.id;
}

async function agregarMiembro(profileId, schoolId, role) {
    const { data, error } = await admin
        .from('school_members')
        .insert({ profile_id: profileId, school_id: schoolId, role, status: 'active' })
        .select('id')
        .single();
    if (error) throw new Error(`No se pudo agregar miembro (role=${role}): ${error.message}`);
    inventario.schoolMemberIds.push(data.id);
}

// ── Runner de casos ─────────────────────────────────────────────────────────
const resultados = [];

// Nota clave (el mismo gotcha que encontró MOD-29): un UPDATE/DELETE que la
// policy USING no deja ver no lanza error — PostgREST devuelve 0 filas
// afectadas, silencioso. `fn` NUNCA usa `.single()`: siempre pide `.select('id')`
// como arreglo, y acá "sin filas" cuenta como rechazo tanto como un error.
async function caso(nombre, esperado, fn) {
    let paso = false;
    let detalle = '';
    let filaId = null;
    try {
        const { data, error } = await fn();
        const huboError = !!error;
        const filas = Array.isArray(data) ? data : (data ? [data] : []);
        const seAplico = !huboError && filas.length > 0;
        if (esperado === 'RECHAZAR') {
            paso = !seAplico;
            detalle = huboError
                ? error.message
                : (seAplico ? 'no rebotó — la operación pasó (o la lectura devolvió filas) cuando debía rechazarse' : '0 filas afectadas (bloqueado por RLS en silencio, sin error — igual de válido que un 42501)');
        } else {
            paso = seAplico;
            detalle = huboError ? error.message : (seAplico ? 'ok' : '0 filas afectadas cuando debía aceptarse');
            if (filas[0]?.id) filaId = filas[0].id;
        }
    } catch (e) {
        paso = false;
        detalle = `excepción: ${e.message}`;
    }
    resultados.push({ nombre, esperado, paso, detalle });
    return filaId;
}

// ── Setup ────────────────────────────────────────────────────────────────
let uParentA, uReporterA, uCoachA, uCoachB, escuelaA, escuelaB, equipoA, equipoB;

try {
    [uParentA, uReporterA, uCoachA, uCoachB] = await Promise.all([
        crearUsuario('parent-a'),
        crearUsuario('reporter-a'),
        crearUsuario('coach-a'),
        crearUsuario('coach-b'),
    ]);

    escuelaA = await crearEscuela(`__RLS_TEST_A_${marca}__`);
    escuelaB = await crearEscuela(`__RLS_TEST_B_${marca}__`);
    equipoA = await crearEquipo(escuelaA, `__RLS_TEST_TEAM_A_${marca}__`);
    equipoB = await crearEquipo(escuelaB, `__RLS_TEST_TEAM_B_${marca}__`);

    await agregarMiembro(uParentA.id, escuelaA, 'parent');
    await agregarMiembro(uReporterA.id, escuelaA, 'reporter');
    await agregarMiembro(uCoachA.id, escuelaA, 'coach');
    await agregarMiembro(uCoachB.id, escuelaB, 'coach');

    // ─── match_lineups: solo owner/coach/super_admin (user_tactical_edit_school_ids) ───
    // `created_by` es NOT NULL: cada actor manda el suyo, para que el único
    // motivo posible de rechazo sea RLS y no una constraint que golpee a todos por igual.
    await caso(
        'padre de la escuela intenta crear una alineación táctica',
        'RECHAZAR',
        () => uParentA.cliente.from('match_lineups').insert({
            school_id: escuelaA, team_id: equipoA, source_type: 'training_session', source_id: randomUUID(), formation: '4-4-2', created_by: uParentA.id,
        }).select('id'),
    );

    await caso(
        'staff no-táctico (reporter) intenta crear una alineación táctica',
        'RECHAZAR',
        () => uReporterA.cliente.from('match_lineups').insert({
            school_id: escuelaA, team_id: equipoA, source_type: 'training_session', source_id: randomUUID(), formation: '4-4-2', created_by: uReporterA.id,
        }).select('id'),
    );

    await caso(
        'coach de otra escuela intenta crear una alineación para un equipo ajeno',
        'RECHAZAR',
        () => uCoachB.cliente.from('match_lineups').insert({
            school_id: escuelaA, team_id: equipoA, source_type: 'training_session', source_id: randomUUID(), formation: '4-4-2', created_by: uCoachB.id,
        }).select('id'),
    );

    const lineupId = await caso(
        'coach del equipo crea su propia alineación táctica',
        'ACEPTAR',
        () => uCoachA.cliente.from('match_lineups').insert({
            school_id: escuelaA, team_id: equipoA, source_type: 'training_session', source_id: randomUUID(), formation: '4-4-2', created_by: uCoachA.id,
        }).select('id'),
    );
    if (lineupId) inventario.filas.push({ tabla: 'match_lineups', id: lineupId });

    if (lineupId) {
        await caso(
            'coach del equipo edita su propia alineación',
            'ACEPTAR',
            () => uCoachA.cliente.from('match_lineups').update({ formation: '4-3-3' }).eq('id', lineupId).select('id'),
        );

        await caso(
            'coach del equipo borra su propia alineación',
            'ACEPTAR',
            () => uCoachA.cliente.from('match_lineups').delete().eq('id', lineupId).select('id'),
        );
    }

    // ─── training_sessions: owner/admin/staff/coach/super_admin/school_admin escriben, delete sin coach ───
    // `objectives` es NOT NULL: mismo motivo que created_by arriba.
    await caso(
        'padre intenta crear una sesión de entrenamiento',
        'RECHAZAR',
        () => uParentA.cliente.from('training_sessions').insert({
            school_id: escuelaA, team_id: equipoA, session_date: new Date().toISOString().slice(0, 10), objectives: 'prueba RLS',
        }).select('id'),
    );

    await caso(
        'coach de otra escuela intenta crear una sesión para un equipo ajeno',
        'RECHAZAR',
        () => uCoachB.cliente.from('training_sessions').insert({
            school_id: escuelaA, team_id: equipoA, session_date: new Date().toISOString().slice(0, 10), objectives: 'prueba RLS',
        }).select('id'),
    );

    const sesionId = await caso(
        'coach del equipo crea una sesión de entrenamiento propia',
        'ACEPTAR',
        () => uCoachA.cliente.from('training_sessions').insert({
            school_id: escuelaA, team_id: equipoA, session_date: new Date().toISOString().slice(0, 10), objectives: 'prueba RLS',
        }).select('id'),
    );
    if (sesionId) inventario.filas.push({ tabla: 'training_sessions', id: sesionId });

    if (sesionId) {
        await caso(
            'coach del equipo edita su propia sesión',
            'ACEPTAR',
            () => uCoachA.cliente.from('training_sessions').update({ notes: 'editado por prueba RLS' }).eq('id', sesionId).select('id'),
        );

        await caso(
            'coach intenta borrar una sesión (rol excluido del delete)',
            'RECHAZAR',
            () => uCoachA.cliente.from('training_sessions').delete().eq('id', sesionId).select('id'),
        );
    }

    // ─── LECTURA de la táctica (auditoría de la pizarra 2026-10-05, migración
    // 20261005173002): plantillas y alineaciones son del cuerpo técnico, no de
    // cualquier miembro. Un padre con su JWT NO debe poder listarlas por REST.
    // Estos casos FALLAN mientras esa migración no esté aplicada en la base viva:
    // es justo lo que tienen que detectar.
    const { data: presetFila, error: presetErr } = await admin.from('team_tactical_presets').insert({
        school_id: escuelaA, team_id: equipoA, name: `__RLS_TEST_${marca}__`, situation: 'ataque',
        slots: [{ slot_label: 'Medio', x: 50, y: 50 }], created_by: uCoachA.id,
    }).select('id').single();
    if (presetErr) throw new Error(`No se pudo crear plantilla desechable: ${presetErr.message}`);
    inventario.filas.push({ tabla: 'team_tactical_presets', id: presetFila.id });

    const { data: lineupFila, error: lineupErr } = await admin.from('match_lineups').insert({
        school_id: escuelaA, team_id: equipoA, source_type: 'training_session', source_id: randomUUID(),
        formation: '4-4-2', created_by: uCoachA.id,
    }).select('id').single();
    if (lineupErr) throw new Error(`No se pudo crear alineación desechable: ${lineupErr.message}`);
    inventario.filas.push({ tabla: 'match_lineups', id: lineupFila.id });

    const leer = (cliente, tabla, id) => () => cliente.cliente.from(tabla).select('id').eq('id', id);

    await caso('padre de la escuela lista las plantillas tácticas por REST', 'RECHAZAR', leer(uParentA, 'team_tactical_presets', presetFila.id));
    await caso('coach de otra escuela lista las plantillas tácticas de la escuela A', 'RECHAZAR', leer(uCoachB, 'team_tactical_presets', presetFila.id));
    await caso('staff (reporter) lee las plantillas de su escuela', 'ACEPTAR', leer(uReporterA, 'team_tactical_presets', presetFila.id));
    await caso('coach lee las plantillas de su escuela', 'ACEPTAR', leer(uCoachA, 'team_tactical_presets', presetFila.id));

    await caso('padre de la escuela lee una alineación en la que su hijo no juega', 'RECHAZAR', leer(uParentA, 'match_lineups', lineupFila.id));
    await caso('coach de otra escuela lee una alineación ajena', 'RECHAZAR', leer(uCoachB, 'match_lineups', lineupFila.id));
    await caso('coach lee las alineaciones de su escuela', 'ACEPTAR', leer(uCoachA, 'match_lineups', lineupFila.id));
} finally {
    // ── Limpieza: en orden inverso de dependencias, ignorando errores individuales ──
    for (const { tabla, id } of inventario.filas) {
        await admin.from(tabla).delete().eq('id', id);
    }
    for (const id of inventario.schoolMemberIds) {
        await admin.from('school_members').delete().eq('id', id);
    }
    for (const id of inventario.teamIds) {
        await admin.from('teams').delete().eq('id', id);
    }
    for (const id of inventario.schoolIds) {
        await admin.from('schools').delete().eq('id', id);
    }
    for (const id of inventario.authUserIds) {
        await admin.from('profiles').delete().eq('id', id);
        await admin.auth.admin.deleteUser(id);
    }
}

// ── Reporte ──────────────────────────────────────────────────────────────
console.log('');
let fallas = 0;
for (const r of resultados) {
    const icono = r.paso ? '✅' : '❌';
    if (!r.paso) fallas++;
    // El detalle de un RECHAZAR exitoso se muestra siempre: es la prueba de
    // que el rebote fue por RLS (42501) y no por otra constraint que golpee
    // a cualquiera por igual, lo cual daría un falso positivo de seguridad.
    const mostrarDetalle = !r.paso || r.esperado === 'RECHAZAR';
    console.log(`${icono} [${r.esperado}] ${r.nombre}${mostrarDetalle ? `  →  ${r.detalle}` : ''}`);
}

console.log('');
console.log('─'.repeat(77));
if (fallas > 0) {
    console.log(`${fallas} de ${resultados.length} caso(s) NO se comportaron como se esperaba.`);
    process.exit(1);
}
console.log(`Los ${resultados.length} casos se comportaron como se esperaba.`);
process.exit(0);
