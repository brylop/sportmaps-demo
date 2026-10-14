// scripts/rls-pruebas-pizarra.mjs
//
// Prueba de COMPORTAMIENTO de los permisos de la pizarra TacticalPad contra la
// base viva (docs/specs/pizarra-nivel-tacticalpad.md §4):
//
//   · public.training_exercises (biblioteca + plantillas del sistema)
//   · public.tactical_board_events + vista v_tactical_board_usage_weekly
//   · RPCs log_tactical_board_event e insert_exercise_into_session_block
//   · columnas `frames` de match_lineups / team_tactical_presets
//
// ── Por qué existe ──────────────────────────────────────────────────────────
// Lo que creó la pizarra (migraciones 20261008155454, 20261008183744 y
// 20261008183746) nunca se probó actuando como cada rol. Un escaneo de forma
// (seguridad:invariantes) no distingue una RPC que valida la escuela de una
// que no; hay que llamarla como un coach ajeno y ver si rebota.
//
// ── Cómo simula usuarios ────────────────────────────────────────────────────
// A diferencia de rls-pruebas-negativas.mjs, acá NO se crea nada: se usan
// usuarios REALES de la base, elegidos al vuelo y validados con los propios
// helpers de RLS (user_staff_school_ids(), user_tactical_edit_school_ids(),
// user_admin_school_ids()…) para que cada actor sea exactamente lo que dice:
//
//   coach    coach de la escuela A (staff = {A}, táctico en A, no admin)
//   owner    dueño de A (admin de A)
//   nontac   admin/school_admin de A SIN rol táctico (opcional)
//   parent   padre de A (miembro, no staff de ninguna escuela)
//   athlete  atleta de A (miembro, no staff; opcional)
//   staff_b  coach de otra escuela B (staff = {B})
//   anon     sin sesión
//
// Se prefieren escuelas demo (is_demo). La sesión se simula como lo hace
// PostgREST: request.jwt.claims + role authenticated/anon.
//
// ── Por qué no puede dejar nada escrito ────────────────────────────────────
// La base es UNA SOLA, compartida con producción. Todo el lote —elegir
// actores, crear las filas de prueba y correr cada caso— va en UNA SOLA
// sentencia (un bloque DO): cada caso corre en su propio subbloque que
// termina SIEMPRE en una excepción (rollback del subbloque), y el bloque
// entero termina con RAISE EXCEPTION, que aborta la transacción completa.
// Los resultados salen en el texto de esa excepción. No hay COMMIT posible:
// ni siquiera si el cliente usara autocommit, porque es una sola sentencia
// que termina en error. Sin DDL.
//
// Se corre por la CLI de Supabase (`supabase db query --linked`, Management
// API, sin contraseña de la base) desde la raíz del repo, que debe estar
// enlazada (supabase/.temp/project-ref).
//
// Uso:
//   npm run seguridad:rls-pizarra
//   npm run seguridad:rls-pizarra -- --sql     # solo imprime el SQL generado
//
// Sale con código 1 si algún caso no se comportó como se esperaba. Los casos
// marcados «esperado tras <versión>» son huecos conocidos con su migración de
// corrección escrita pero NO aplicada: fallan hoy (⏳) y deben pasar a verde
// cuando se aplique esa migración. También hacen salir con 1: un hueco
// abierto no es verde.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Migraciones de corrección escritas y pendientes de aplicar.
const FIX_LECTURA_TACTICA = '20261005173002'; // pizarra_blindaje_datos_y_lectura (lectura solo staff)
const FIX_PIZARRA = '20261013200604';         // pizarra_rls_biblioteca_y_rpc_ejercicio (H1/H2/H3)

// ─────────────────────────────────────────────────────────────────────────────
// Casos. Cada `sql` corre como `actor` y devuelve UN entero n:
//   ACEPTAR  ⇔ sin error y n > 0
//   RECHAZAR ⇔ error (42501, CHECK, P0002…) o n = 0 (RLS filtra en silencio)
// Para escrituras: `with x as (<dml> returning 1) select count(*) from x`.
// `chk` (opcional) corre después como postgres, dentro del mismo subbloque, y
// su n reemplaza al del actor (para verificar el efecto real de una RPC).
// Marcadores {xxx} = ids elegidos por el descubrimiento (ver más abajo).
// ─────────────────────────────────────────────────────────────────────────────
const W = (dml) => `with x as (${dml} returning 1) select count(*)::int from x`;
const RPC_INS = (ex, ses, team = 'null') =>
    `select ((public.insert_exercise_into_session_block('${ex}'::uuid, ${ses}, gen_random_uuid(), ${team})) ->> 'lineup_id' is not null)::int`;
const RPC_LOG = (school, ev = 'open', team = 'null') =>
    `select public.log_tactical_board_event('${school}'::uuid, '${ev}', ${team}, 'test', 'football11')::int`;
const NUEVO_EJ = (school, autor, extra = '') =>
    W(`insert into public.training_exercises (school_id, created_by, name, sport${extra ? ', ' + extra.split('|')[0] : ''}) values (${school}, ${autor}, 'RLS pizarra prueba', 'futbol'${extra ? ', ' + extra.split('|')[1] : ''})`);
const UPD_EJ = (id, set = `name = 'RLS editado'`) => W(`update public.training_exercises set ${set} where id = '${id}'`);
const DEL_EJ = (id) => W(`delete from public.training_exercises where id = '${id}'`);
const LEER = (tabla, where) => `select count(*)::int from public.${tabla} where ${where}`;

const CASOS = [
    // ── 1. Biblioteca: lectura ───────────────────────────────────────────────
    ['coach', 'coach de A lee las plantillas del sistema', 'ACEPTAR', LEER('training_exercises', `id = '{ex_tpl}'`)],
    ['owner', 'owner de A lee las plantillas del sistema', 'ACEPTAR', LEER('training_exercises', `id = '{ex_tpl}'`)],
    ['parent', 'padre de A lee las plantillas del sistema (spec: solo staff)', 'RECHAZAR', LEER('training_exercises', `id = '{ex_tpl}'`), { tras: FIX_PIZARRA }],
    ['athlete', 'atleta de A lee las plantillas del sistema (spec: solo staff)', 'RECHAZAR', LEER('training_exercises', `id = '{ex_tpl}'`), { tras: FIX_PIZARRA }],
    ['coach', 'coach de A lee un ejercicio de su escuela', 'ACEPTAR', LEER('training_exercises', `id = '{ex_a_owner}'`)],
    ['coach', 'coach de A lee un ejercicio de la escuela B', 'RECHAZAR', LEER('training_exercises', `id = '{ex_b}'`)],
    ['staff_b', 'coach de B lee un ejercicio de la escuela A', 'RECHAZAR', LEER('training_exercises', `id = '{ex_a_coach}'`)],
    ['parent', 'padre de A lee los ejercicios de su escuela', 'RECHAZAR', LEER('training_exercises', `school_id = '{sch_a}'`)],
    ['athlete', 'atleta de A lee los ejercicios de su escuela', 'RECHAZAR', LEER('training_exercises', `school_id = '{sch_a}'`)],
    ['anon', 'anon lee training_exercises', 'RECHAZAR', LEER('training_exercises', 'true')],

    // ── 2. Biblioteca: alta ──────────────────────────────────────────────────
    ['coach', 'coach de A crea un ejercicio en A', 'ACEPTAR', NUEVO_EJ(`'{sch_a}'`, `'{coach}'`)],
    ['owner', 'owner de A crea un ejercicio en A', 'ACEPTAR', NUEVO_EJ(`'{sch_a}'`, `'{owner}'`)],
    ['nontac', 'admin (no táctico) de A crea un ejercicio en A (spec: escribe staff)', 'ACEPTAR', NUEVO_EJ(`'{sch_a}'`, `'{nontac}'`)],
    ['parent', 'padre de A crea un ejercicio en A', 'RECHAZAR', NUEVO_EJ(`'{sch_a}'`, `'{parent}'`)],
    ['athlete', 'atleta de A crea un ejercicio en A', 'RECHAZAR', NUEVO_EJ(`'{sch_a}'`, `'{athlete}'`)],
    ['staff_b', 'coach de B crea un ejercicio en la escuela A', 'RECHAZAR', NUEVO_EJ(`'{sch_a}'`, `'{staff_b}'`)],
    ['anon', 'anon crea un ejercicio en A', 'RECHAZAR', NUEVO_EJ(`'{sch_a}'`, 'null')],
    ['coach', 'coach de A crea un ejercicio firmado como el owner', 'RECHAZAR', NUEVO_EJ(`'{sch_a}'`, `'{owner}'`)],
    ['coach', 'coach de A crea una plantilla del sistema (school_id NULL)', 'RECHAZAR', NUEVO_EJ('null', `'{coach}'`, 'is_template|true')],
    ['owner', 'owner de A crea una plantilla del sistema (school_id NULL)', 'RECHAZAR', NUEVO_EJ('null', `'{owner}'`, 'is_template|true')],
    ['coach', 'coach de A crea un ejercicio de A marcado is_template', 'RECHAZAR', NUEVO_EJ(`'{sch_a}'`, `'{coach}'`, 'is_template|true')],

    // ── 3. Biblioteca: plantillas del sistema son de solo lectura ────────────
    ['coach', 'coach de A edita una plantilla del sistema', 'RECHAZAR', UPD_EJ('{ex_tpl}')],
    ['owner', 'owner de A edita una plantilla del sistema', 'RECHAZAR', UPD_EJ('{ex_tpl}')],
    ['owner', 'owner de A se apropia de una plantilla (le pone su escuela)', 'RECHAZAR', UPD_EJ('{ex_tpl}', `school_id = '{sch_a}', is_template = false`)],
    ['coach', 'coach de A borra una plantilla del sistema', 'RECHAZAR', DEL_EJ('{ex_tpl}')],
    ['owner', 'owner de A borra una plantilla del sistema', 'RECHAZAR', DEL_EJ('{ex_tpl}')],

    // ── 4. Biblioteca: edición y borrado (autor o admin) ─────────────────────
    ['coach', 'coach de A edita su propio ejercicio', 'ACEPTAR', UPD_EJ('{ex_a_coach}')],
    ['coach', 'coach de A edita el ejercicio del owner', 'RECHAZAR', UPD_EJ('{ex_a_owner}')],
    ['owner', 'owner (admin) de A edita el ejercicio del coach', 'ACEPTAR', UPD_EJ('{ex_a_coach}')],
    ['coach', 'coach de A muda su ejercicio a la escuela B', 'RECHAZAR', UPD_EJ('{ex_a_coach}', `school_id = '{sch_b}'`)],
    ['coach', 'coach de A vuelve su ejercicio plantilla global', 'RECHAZAR', UPD_EJ('{ex_a_coach}', 'school_id = null, is_template = true')],
    ['coach', 'coach de A le cambia el autor a su ejercicio (lo firma el owner)', 'RECHAZAR', UPD_EJ('{ex_a_coach}', `created_by = '{owner}'`), { tras: FIX_PIZARRA }],
    ['staff_b', 'coach de B edita un ejercicio de A', 'RECHAZAR', UPD_EJ('{ex_a_coach}')],
    ['parent', 'padre de A edita un ejercicio de A', 'RECHAZAR', UPD_EJ('{ex_a_coach}')],
    ['coach', 'coach de A borra el ejercicio del owner', 'RECHAZAR', DEL_EJ('{ex_a_owner}')],
    ['coach', 'coach de A borra su propio ejercicio', 'ACEPTAR', DEL_EJ('{ex_a_coach}')],
    ['owner', 'owner (admin) de A borra el ejercicio del coach', 'ACEPTAR', DEL_EJ('{ex_a_coach}')],
    ['nontac', 'admin de A borra el ejercicio del coach', 'ACEPTAR', DEL_EJ('{ex_a_coach}')],
    ['parent', 'padre de A borra un ejercicio de A', 'RECHAZAR', DEL_EJ('{ex_a_coach}')],
    ['staff_b', 'coach de B borra un ejercicio de A', 'RECHAZAR', DEL_EJ('{ex_a_coach}')],
    ['anon', 'anon borra un ejercicio de A', 'RECHAZAR', DEL_EJ('{ex_a_coach}')],

    // ── 5. Métrica: tactical_board_events + RPC + vista ──────────────────────
    ['coach', 'coach de A inserta DIRECTO en tactical_board_events', 'RECHAZAR', W(`insert into public.tactical_board_events (school_id, user_id, event) values ('{sch_a}', '{coach}', 'open')`)],
    ['owner', 'owner de A inserta DIRECTO en tactical_board_events', 'RECHAZAR', W(`insert into public.tactical_board_events (school_id, user_id, event) values ('{sch_a}', '{owner}', 'open')`)],
    ['owner', 'owner de A edita un evento (UPDATE directo)', 'RECHAZAR', W(`update public.tactical_board_events set event = 'save' where id = '{ev_a}'`)],
    ['owner', 'owner de A borra un evento (DELETE directo)', 'RECHAZAR', W(`delete from public.tactical_board_events where id = '{ev_a}'`)],
    ['anon', 'anon inserta DIRECTO en tactical_board_events', 'RECHAZAR', W(`insert into public.tactical_board_events (school_id, event) values ('{sch_a}', 'open')`)],
    ['coach', 'coach de A registra un evento de su escuela (RPC)', 'ACEPTAR', RPC_LOG('{sch_a}', 'open', `'{team_a}'::uuid`),
        { chk: `select count(*)::int from public.tactical_board_events where user_id = '{coach}' and school_id = '{sch_a}' and team_id = '{team_a}' and event = 'open' and created_at = now()` }],
    ['coach', 'coach de A registra un evento con school_id de B (RPC)', 'RECHAZAR', RPC_LOG('{sch_b}'),
        { chk: `select count(*)::int from public.tactical_board_events where school_id = '{sch_b}' and created_at = now()` }],
    ['coach', 'coach de A registra con team_id de B: se guarda SIN equipo', 'ACEPTAR', RPC_LOG('{sch_a}', 'save', `'{team_b}'::uuid`),
        { chk: `select (count(*) filter (where team_id is null) = 1 and count(*) filter (where team_id is not null) = 0)::int from public.tactical_board_events where user_id = '{coach}' and event = 'save' and created_at = now()` }],
    ['coach', 'coach de A registra un evento fuera del CHECK (RPC)', 'RECHAZAR', RPC_LOG('{sch_a}', 'hack')],
    ['parent', 'padre de A registra un evento (RPC)', 'RECHAZAR', RPC_LOG('{sch_a}')],
    ['athlete', 'atleta de A registra un evento (RPC)', 'RECHAZAR', RPC_LOG('{sch_a}')],
    ['staff_b', 'coach de B registra un evento en la escuela A (RPC)', 'RECHAZAR', RPC_LOG('{sch_a}')],
    ['anon', 'anon ejecuta log_tactical_board_event', 'RECHAZAR', RPC_LOG('{sch_a}')],
    ['coach', 'coach de A lee los eventos de su escuela', 'RECHAZAR', LEER('tactical_board_events', `school_id = '{sch_a}'`)],
    ['parent', 'padre de A lee los eventos de su escuela', 'RECHAZAR', LEER('tactical_board_events', `school_id = '{sch_a}'`)],
    ['staff_b', 'coach de B lee los eventos de A', 'RECHAZAR', LEER('tactical_board_events', `school_id = '{sch_a}'`)],
    ['owner', 'owner (admin) de A lee los eventos de su escuela', 'ACEPTAR', LEER('tactical_board_events', `school_id = '{sch_a}'`)],
    ['anon', 'anon lee tactical_board_events', 'RECHAZAR', LEER('tactical_board_events', 'true')],
    ['owner', 'owner (admin) de A lee la vista semanal', 'ACEPTAR', `select coalesce(sum(opens), 0)::int from public.v_tactical_board_usage_weekly`],
    ['coach', 'coach de A lee la vista semanal (sin filas)', 'RECHAZAR', `select coalesce(sum(opens), 0)::int from public.v_tactical_board_usage_weekly`],
    ['parent', 'padre de A lee la vista semanal (sin filas)', 'RECHAZAR', `select coalesce(sum(opens), 0)::int from public.v_tactical_board_usage_weekly`],
    ['anon', 'anon lee la vista semanal', 'RECHAZAR', `select count(*)::int from public.v_tactical_board_usage_weekly`],

    // ── 6. insert_exercise_into_session_block ────────────────────────────────
    ['coach', 'coach de A: plantilla → sesión de A (bloque nuevo)', 'ACEPTAR', RPC_INS('{ex_tpl}', `'{ses_a}'::uuid`),
        { chk: `select count(*)::int from public.match_lineups where school_id = '{sch_a}' and created_by = '{coach}' and frames is not null and created_at = now()` }],
    ['coach', 'coach de A: ejercicio de A → equipo de A sin sesión', 'ACEPTAR', RPC_INS('{ex_a_coach}', 'null', `'{team_a}'::uuid`)],
    ['coach', 'coach de A: plantilla → sesión de la escuela B', 'RECHAZAR', RPC_INS('{ex_tpl}', `'{ses_b}'::uuid`)],
    ['coach', 'coach de A: plantilla → equipo de B sin sesión', 'RECHAZAR', RPC_INS('{ex_tpl}', 'null', `'{team_b}'::uuid`)],
    ['coach', 'coach de A: sesión de A con p_team_id de B', 'RECHAZAR', RPC_INS('{ex_tpl}', `'{ses_a}'::uuid`, `'{team_b}'::uuid`)],
    ['coach', 'coach de A: ejercicio de la escuela B → sesión de A', 'RECHAZAR', RPC_INS('{ex_b}', `'{ses_a}'::uuid`)],
    ['coach', 'coach de A: bloque cuya jugada es de B (pisar match_lineups ajeno)', 'RECHAZAR',
        `select ((public.insert_exercise_into_session_block('{ex_tpl}'::uuid, '{ses_a}'::uuid, '{ml_b_block}'::uuid, null)) ->> 'lineup_id' is not null)::int`],
    ['staff_b', 'coach de B: ejercicio de B → sesión de A', 'RECHAZAR', RPC_INS('{ex_b}', `'{ses_a}'::uuid`)],
    ['parent', 'padre de A: plantilla → sesión de A', 'RECHAZAR', RPC_INS('{ex_tpl}', `'{ses_a}'::uuid`)],
    ['athlete', 'atleta de A: plantilla → sesión de A', 'RECHAZAR', RPC_INS('{ex_tpl}', `'{ses_a}'::uuid`)],
    ['nontac', 'admin NO táctico de A: plantilla → sesión de A (escribe match_lineups que por tabla no puede)', 'RECHAZAR', RPC_INS('{ex_tpl}', `'{ses_a}'::uuid`), { tras: FIX_PIZARRA }],
    ['nontac', '…y por la tabla ese mismo admin NO puede crear la jugada (control)', 'RECHAZAR',
        W(`insert into public.match_lineups (school_id, team_id, source_type, source_id, created_by) values ('{sch_a}', '{team_a}', 'training_session', gen_random_uuid(), '{nontac}')`)],
    ['anon', 'anon ejecuta insert_exercise_into_session_block', 'RECHAZAR', RPC_INS('{ex_tpl}', `'{ses_a}'::uuid`)],

    // ── 7. frames en match_lineups / team_tactical_presets ───────────────────
    ['coach', 'coach de A guarda frames en una plantilla táctica de A', 'ACEPTAR',
        W(`update public.team_tactical_presets set frames = '[{"id":"f1","duration_ms":1200,"players":[],"ball":null,"arrows":[]}]'::jsonb where id = '{preset_a}'`)],
    ['coach', 'coach de A guarda frames en una jugada de A', 'ACEPTAR',
        W(`update public.match_lineups set frames = '[{"id":"f1","duration_ms":1200,"players":[],"ball":null,"arrows":[]}]'::jsonb where id = '{ml_a}'`)],
    ['coach', 'coach de A guarda 31 cuadros (CHECK tope 30)', 'RECHAZAR',
        W(`update public.match_lineups set frames = (select jsonb_agg(jsonb_build_object('id', 'f' || g)) from generate_series(1, 31) g) where id = '{ml_a}'`)],
    ['coach', 'coach de A guarda frames que no son lista (CHECK)', 'RECHAZAR',
        W(`update public.team_tactical_presets set frames = '{"id":"f1"}'::jsonb where id = '{preset_a}'`)],
    ['coach', 'coach de A guarda frames de >512 KB (CHECK)', 'RECHAZAR',
        W(`update public.match_lineups set frames = jsonb_build_array(jsonb_build_object('id', 'f1', 'pad', (select string_agg(md5(g::text), '') from generate_series(1, 20000) g))) where id = '{ml_a}'`)],
    ['parent', 'padre de A edita frames de una jugada de A', 'RECHAZAR',
        W(`update public.match_lineups set frames = '[{"id":"x"}]'::jsonb where id = '{ml_a}'`)],
    ['staff_b', 'coach de B edita frames de una plantilla de A', 'RECHAZAR',
        W(`update public.team_tactical_presets set frames = '[{"id":"x"}]'::jsonb where id = '{preset_a}'`)],
    ['staff_b', 'coach de B lee una plantilla táctica de A', 'RECHAZAR', LEER('team_tactical_presets', `id = '{preset_a}'`)],
    ['staff_b', 'coach de B lee una jugada de A', 'RECHAZAR', LEER('match_lineups', `id = '{ml_a}'`)],
    ['coach', 'coach de A lee la plantilla táctica (con frames) de A', 'ACEPTAR', LEER('team_tactical_presets', `id = '{preset_a}'`)],
    ['parent', 'padre de A lee la plantilla táctica (con frames) de A', 'RECHAZAR', LEER('team_tactical_presets', `id = '{preset_a}'`), { tras: FIX_LECTURA_TACTICA }],
    ['parent', 'padre de A lee una jugada de A donde su hijo no juega', 'RECHAZAR', LEER('match_lineups', `id = '{ml_a}'`), { tras: FIX_LECTURA_TACTICA }],
    ['athlete', 'atleta de A lee la plantilla táctica (con frames) de A', 'RECHAZAR', LEER('team_tactical_presets', `id = '{preset_a}'`), { tras: FIX_LECTURA_TACTICA }],
    ['anon', 'anon lee match_lineups', 'RECHAZAR', LEER('match_lineups', 'true')],

    // ── 8. Invariantes estáticos (como postgres; n = 1 si se cumple) ─────────
    ...[
        ['log_tactical_board_event', 'public.log_tactical_board_event(uuid,text,uuid,text,text)'],
        ['insert_exercise_into_session_block', 'public.insert_exercise_into_session_block(uuid,uuid,uuid,uuid)'],
    ].flatMap(([nombre, firma]) => [
        ['postgres', `${nombre}: SECURITY DEFINER con search_path fijo (incluye pg_temp)`, 'ACEPTAR',
            `select (p.prosecdef and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%pg_temp%'))::int from pg_proc p where p.oid = '${firma}'::regprocedure`],
        ['postgres', `${nombre}: sin EXECUTE para anon ni PUBLIC`, 'ACEPTAR',
            `select (not has_function_privilege('anon', '${firma}', 'EXECUTE') and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = '${firma}'::regprocedure and a.grantee = 0))::int`],
        ['postgres', `${nombre}: EXECUTE explícito para authenticated`, 'ACEPTAR',
            `select has_function_privilege('authenticated', '${firma}', 'EXECUTE')::int`],
    ]),
    ['postgres', 'I3: ninguna policy FOR ALL sin WITH CHECK en las tablas de la pizarra', 'ACEPTAR',
        `select (count(*) = 0)::int from pg_policies where schemaname = 'public' and tablename in ('training_exercises','tactical_board_events','match_lineups','match_lineup_players','team_tactical_presets') and cmd = 'ALL' and with_check is null`],
    ['postgres', 'I2: ninguna policy de escritura usa user_school_ids() en las tablas de la pizarra', 'ACEPTAR',
        `select (count(*) = 0)::int from pg_policies where schemaname = 'public' and tablename in ('training_exercises','tactical_board_events','match_lineups','match_lineup_players','team_tactical_presets') and cmd in ('INSERT','UPDATE','DELETE','ALL') and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'user_school_ids\\('`],
    ['postgres', 'tactical_board_events: sin policies de escritura y authenticated sin INSERT/UPDATE/DELETE', 'ACEPTAR',
        `select ((select count(*) from pg_policies where schemaname = 'public' and tablename = 'tactical_board_events' and cmd <> 'SELECT') = 0 and not has_table_privilege('authenticated', 'public.tactical_board_events', 'INSERT') and not has_table_privilege('authenticated', 'public.tactical_board_events', 'UPDATE') and not has_table_privilege('authenticated', 'public.tactical_board_events', 'DELETE'))::int`],
    ['postgres', 'anon sin ningún privilegio en training_exercises / tactical_board_events / vista', 'ACEPTAR',
        `select (not exists (select 1 from unnest(array['public.training_exercises','public.tactical_board_events','public.v_tactical_board_usage_weekly']) t, unnest(array['SELECT','INSERT','UPDATE','DELETE']) p where has_table_privilege('anon', t, p)))::int`],
    ['postgres', 'RLS activa en training_exercises y tactical_board_events', 'ACEPTAR',
        `select (count(*) = 2)::int from pg_class where oid in ('public.training_exercises'::regclass, 'public.tactical_board_events'::regclass) and relrowsecurity`],
    ['postgres', 'v_tactical_board_usage_weekly es security_invoker', 'ACEPTAR',
        `select coalesce('security_invoker=true' = any (reloptions), false)::int from pg_class where oid = 'public.v_tactical_board_usage_weekly'::regclass`],
    ['postgres', 'CHECK de forma/tamaño de frames en match_lineups y team_tactical_presets', 'ACEPTAR',
        `select (count(*) = 2)::int from pg_constraint where contype = 'c' and conname in ('match_lineups_frames_shape_check', 'team_tactical_presets_frames_shape_check')`],
];

// ─────────────────────────────────────────────────────────────────────────────
// Bloque DO: descubrimiento de actores + fixtures + casos, todo abortado al final.
// ─────────────────────────────────────────────────────────────────────────────
function construirSql() {
    const casos = CASOS.map(([actor, nombre, esperado, sql, extra = {}], i) => {
        const texto = `${sql} ${extra.chk ?? ''} {${actor}}`;
        const needs = [...new Set([...texto.matchAll(/\{([a-z_0-9]+)\}/g)].map((m) => m[1]))]
            .filter((k) => !['postgres', 'anon'].includes(k));
        return { i, actor, sql, chk: extra.chk ?? null, needs };
    });
    const json = JSON.stringify(casos);
    if (json.includes('$casos$')) throw new Error('delimitador $casos$ dentro de un caso');

    return `
DO $pz$
DECLARE
  ids   jsonb := '{}'::jsonb;
  res   jsonb := '[]'::jsonb;
  c     record;
  s     record;
  m     record;
  q     text;
  qc    text;
  n     int;
  k     text;
  v     text;
  falta text;
  v_sch uuid; v_coach uuid; v_owner uuid; v_parent uuid; v_athlete uuid; v_nontac uuid; v_nontac_rol text;
  v_schb uuid; v_staffb uuid; v_id uuid; pasada int;
BEGIN
  -- ── Actores: usuarios reales validados con los helpers de RLS ─────────────
  -- Pasada 1: escuela A con TODOS los actores (incluidos atleta y admin no
  -- táctico, que prueban H1). Pasada 2: basta coach + owner + padre.
  FOR pasada IN 1..2 LOOP
  FOR s IN
    SELECT sc.id, sc.owner_id
      FROM public.schools sc
     WHERE EXISTS (SELECT 1 FROM public.training_sessions ts WHERE ts.school_id = sc.id AND ts.team_id IS NOT NULL)
     ORDER BY sc.is_demo DESC NULLS LAST, sc.name
  LOOP
    v_coach := NULL; v_owner := NULL; v_parent := NULL; v_athlete := NULL; v_nontac := NULL; v_nontac_rol := NULL;

    FOR m IN SELECT sm.profile_id, sm.role FROM public.school_members sm
              WHERE sm.school_id = s.id AND sm.status = 'active'
                AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = sm.profile_id)
              ORDER BY sm.role, sm.profile_id
    LOOP
      PERFORM set_config('request.jwt.claims', json_build_object('sub', m.profile_id, 'role', 'authenticated')::text, true);
      CONTINUE WHEN public.is_super_admin();
      IF v_coach IS NULL AND m.role = 'coach'
         AND public.user_staff_school_ids() = ARRAY[s.id]
         AND s.id = ANY (public.user_tactical_edit_school_ids())
         AND cardinality(public.user_admin_school_ids()) = 0 THEN
        v_coach := m.profile_id;
      ELSIF v_parent IS NULL AND m.role = 'parent'
         AND cardinality(public.user_staff_school_ids()) = 0 AND s.id = ANY (public.user_school_ids()) THEN
        v_parent := m.profile_id;
      ELSIF v_athlete IS NULL AND m.role = 'athlete'
         AND cardinality(public.user_staff_school_ids()) = 0 AND s.id = ANY (public.user_school_ids()) THEN
        v_athlete := m.profile_id;
      ELSIF v_nontac IS NULL AND m.role IN ('admin', 'school_admin')
         AND s.id = ANY (public.user_staff_school_ids())
         AND s.id = ANY (public.user_admin_school_ids())
         AND NOT (s.id = ANY (public.user_tactical_edit_school_ids())) THEN
        v_nontac := m.profile_id; v_nontac_rol := m.role;
      END IF;
    END LOOP;

    IF s.owner_id IS NOT NULL THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', s.owner_id, 'role', 'authenticated')::text, true);
      IF NOT public.is_super_admin() AND s.id = ANY (public.user_admin_school_ids())
         AND s.id = ANY (public.user_tactical_edit_school_ids()) THEN
        v_owner := s.owner_id;
      END IF;
    END IF;

    IF v_coach IS NOT NULL AND v_owner IS NOT NULL AND v_parent IS NOT NULL
       AND (pasada = 2 OR (v_athlete IS NOT NULL AND v_nontac IS NOT NULL)) THEN
      v_sch := s.id;
      EXIT;
    END IF;
  END LOOP;
  EXIT WHEN v_sch IS NOT NULL;
  END LOOP;

  IF v_sch IS NULL THEN
    RAISE EXCEPTION 'PZERR no se encontró una escuela A con coach, owner y padre válidos';
  END IF;

  -- Escuela B: otra escuela con sesión y un coach cuyo staff es SOLO B.
  FOR s IN
    SELECT sc.id FROM public.schools sc
     WHERE sc.id <> v_sch
       AND EXISTS (SELECT 1 FROM public.training_sessions ts WHERE ts.school_id = sc.id AND ts.team_id IS NOT NULL)
     ORDER BY sc.is_demo DESC NULLS LAST, sc.name
  LOOP
    FOR m IN SELECT sm.profile_id FROM public.school_members sm
              WHERE sm.school_id = s.id AND sm.status = 'active' AND sm.role = 'coach'
                AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = sm.profile_id)
              ORDER BY sm.profile_id
    LOOP
      PERFORM set_config('request.jwt.claims', json_build_object('sub', m.profile_id, 'role', 'authenticated')::text, true);
      IF NOT public.is_super_admin() AND public.user_staff_school_ids() = ARRAY[s.id]
         AND NOT (v_sch = ANY (public.user_school_ids())) THEN
        v_staffb := m.profile_id; v_schb := s.id; EXIT;
      END IF;
    END LOOP;
    EXIT WHEN v_staffb IS NOT NULL;
  END LOOP;

  IF v_schb IS NULL THEN
    RAISE EXCEPTION 'PZERR no se encontró una escuela B con un coach válido';
  END IF;
  PERFORM set_config('request.jwt.claims', '', true);

  ids := jsonb_strip_nulls(jsonb_build_object(
    'sch_a', v_sch, 'sch_b', v_schb, 'coach', v_coach, 'owner', v_owner, 'parent', v_parent,
    'athlete', v_athlete, 'nontac', v_nontac, 'staff_b', v_staffb));

  SELECT ts.id, ts.team_id INTO s FROM public.training_sessions ts
   WHERE ts.school_id = v_sch AND ts.team_id IS NOT NULL ORDER BY ts.created_at DESC LIMIT 1;
  ids := ids || jsonb_build_object('ses_a', s.id, 'team_a', s.team_id);
  SELECT ts.id, ts.team_id INTO s FROM public.training_sessions ts
   WHERE ts.school_id = v_schb AND ts.team_id IS NOT NULL ORDER BY ts.created_at DESC LIMIT 1;
  ids := ids || jsonb_build_object('ses_b', s.id, 'team_b', s.team_id);


  -- ── Fixtures (como postgres; mueren con el RAISE final) ───────────────────
  ids := ids || jsonb_build_object('ex_tpl',
    (SELECT e.id FROM public.training_exercises e WHERE e.school_id IS NULL AND e.is_template AND e.is_active ORDER BY e.name LIMIT 1));

  INSERT INTO public.training_exercises (school_id, created_by, name, board)
  VALUES (v_sch, v_coach, 'RLS pizarra · del coach', '{"players":[{"key":"slot#0","slot_label":"Pivote","x":50,"y":50}]}')
  RETURNING id INTO v_id;
  ids := ids || jsonb_build_object('ex_a_coach', v_id);
  INSERT INTO public.training_exercises (school_id, created_by, name)
  VALUES (v_sch, v_owner, 'RLS pizarra · del owner') RETURNING id INTO v_id;
  ids := ids || jsonb_build_object('ex_a_owner', v_id);
  INSERT INTO public.training_exercises (school_id, created_by, name)
  VALUES (v_schb, v_staffb, 'RLS pizarra · de B') RETURNING id INTO v_id;
  ids := ids || jsonb_build_object('ex_b', v_id);

  INSERT INTO public.tactical_board_events (school_id, user_id, team_id, event, created_at)
  VALUES (v_sch, v_coach, (ids->>'team_a')::uuid, 'open', now() - interval '1 day') RETURNING id INTO v_id;
  ids := ids || jsonb_build_object('ev_a', v_id);

  INSERT INTO public.match_lineups (school_id, team_id, source_type, source_id, created_by)
  VALUES (v_schb, (ids->>'team_b')::uuid, 'training_session', gen_random_uuid(), v_staffb) RETURNING source_id INTO v_id;
  ids := ids || jsonb_build_object('ml_b_block', v_id);
  INSERT INTO public.match_lineups (school_id, team_id, source_type, source_id, created_by)
  VALUES (v_sch, (ids->>'team_a')::uuid, 'training_session', gen_random_uuid(), v_coach) RETURNING id INTO v_id;
  ids := ids || jsonb_build_object('ml_a', v_id);
  INSERT INTO public.team_tactical_presets (school_id, team_id, name, situation, slots, created_by)
  VALUES (v_sch, (ids->>'team_a')::uuid, 'RLS pizarra ' || left(gen_random_uuid()::text, 8), 'ataque',
          '[{"slot_label":"Medio","x":50,"y":50}]'::jsonb, v_coach) RETURNING id INTO v_id;
  ids := ids || jsonb_build_object('preset_a', v_id);

  -- ── Casos: cada uno en su subbloque, que SIEMPRE termina en excepción ─────
  FOR c IN SELECT * FROM jsonb_to_recordset($casos$${json}$casos$::jsonb)
                    AS x(i int, actor text, sql text, chk text, needs text[])
  LOOP
    falta := (SELECT string_agg(x, ',') FROM unnest(c.needs) AS x WHERE NOT ids ? x);
    IF falta IS NOT NULL THEN
      res := res || jsonb_build_array(jsonb_build_object('i', c.i, 'skip', falta));
      CONTINUE;
    END IF;
    q := c.sql; qc := c.chk;
    FOR k, v IN SELECT key, value FROM jsonb_each_text(ids) LOOP
      q := replace(q, '{' || k || '}', v);
      IF qc IS NOT NULL THEN qc := replace(qc, '{' || k || '}', v); END IF;
    END LOOP;
    BEGIN
      IF c.actor = 'anon' THEN
        PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
        PERFORM set_config('role', 'anon', true);
      ELSIF c.actor <> 'postgres' THEN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', ids->>c.actor, 'role', 'authenticated')::text, true);
        PERFORM set_config('role', 'authenticated', true);
      END IF;
      EXECUTE q INTO n;
      IF qc IS NOT NULL THEN
        PERFORM set_config('role', 'postgres', true);
        EXECUTE qc INTO n;
      END IF;
      RAISE EXCEPTION USING ERRCODE = 'PZ001', MESSAGE = coalesce(n, 0)::text;
    EXCEPTION
      WHEN SQLSTATE 'PZ001' THEN
        res := res || jsonb_build_array(jsonb_build_object('i', c.i, 'ok', true, 'n', SQLERRM::int));
      WHEN OTHERS THEN
        res := res || jsonb_build_array(jsonb_build_object('i', c.i, 'ok', false, 'state', SQLSTATE, 'msg', left(SQLERRM, 200)));
    END;
  END LOOP;

  -- Aborta TODO: nada de lo anterior se confirma. Los resultados viajan acá.
  RAISE EXCEPTION 'PZRES%', jsonb_build_object('ids', ids, 'nontac_rol', v_nontac_rol, 'res', res)::text;
END $pz$;
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ejecución por la CLI de Supabase y reporte
// ─────────────────────────────────────────────────────────────────────────────
const sql = construirSql();
if (process.argv.includes('--sql')) {
    console.log(sql);
    process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'rls-pizarra-'));
const archivo = join(dir, 'pizarra.sql');
writeFileSync(archivo, sql, 'utf8');

console.log('Corriendo los casos contra la base viva (una sola sentencia, abortada al final)…');
let salida = '';
try {
    // La CLI a veces falla ANTES de correr nada («Failed to create login role:
    // connection timeout»): eso se reintenta; cualquier otra salida, no.
    for (let intento = 1; intento <= 3; intento++) {
        try {
            salida = execFileSync('npx', ['supabase', 'db', 'query', '--linked', '-f', archivo, '-o', 'json'], {
                cwd: RAIZ, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        } catch (e) {
            salida = `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
        }
        if (!/login role status/.test(salida)) break;
        console.log(`  (la CLI no pudo abrir la conexión, reintento ${intento}/3)`);
    }
} finally {
    rmSync(dir, { recursive: true, force: true });
}

// La CLI devuelve el error de la Management API:
//   unexpected status 400: {"message":"Failed to run sql query: ERROR:  P0001: PZRES{...}\nCONTEXT: ..."}
function extraerMensaje(texto) {
    const i = texto.indexOf('{"message"');
    if (i >= 0) {
        const linea = texto.slice(i).split(/\r?\n/)[0];
        try { return JSON.parse(linea).message; } catch { /* sigue abajo */ }
    }
    return texto;
}
const mensaje = extraerMensaje(salida);
const m = /PZRES([\s\S]*?)\nCONTEXT:/.exec(mensaje) ?? /PZRES([\s\S]*)$/.exec(mensaje);
if (!m) {
    console.error('No llegaron resultados. Salida de la CLI:\n');
    console.error(salida.slice(0, 4000));
    if (/PZERR/.test(mensaje)) console.error('\n(El descubrimiento de actores falló: ver el mensaje PZERR.)');
    process.exit(2);
}
const { ids, nontac_rol: nontacRol, res } = JSON.parse(m[1]);

console.log('');
console.log('Actores y datos elegidos (UUIDs):');
for (const k of ['sch_a', 'coach', 'owner', 'nontac', 'parent', 'athlete', 'sch_b', 'staff_b', 'ses_a', 'ses_b']) {
    const extra = k === 'nontac' && nontacRol ? `  (rol ${nontacRol})` : '';
    console.log(`  ${k.padEnd(8)} ${ids[k] ?? '— (no hay; sus casos se omiten)'}${extra}`);
}
console.log('');

let fallas = 0;
let pendientes = 0;
let omitidos = 0;
const porIndice = new Map(res.map((r) => [r.i, r]));
CASOS.forEach(([actor, nombre, esperado, , extra = {}], i) => {
    const r = porIndice.get(i);
    if (!r || r.skip) {
        omitidos++;
        console.log(`⏭️  [${esperado}] (${actor}) ${nombre}  →  omitido: falta ${r?.skip ?? 'resultado'}`);
        return;
    }
    const acepto = r.ok && r.n > 0;
    const paso = esperado === 'ACEPTAR' ? acepto : !acepto;
    const detalle = r.ok
        ? (acepto ? `pasó (n=${r.n})` : '0 filas (RLS filtra en silencio / la RPC devolvió false)')
        : `${r.state}: ${r.msg}`;
    let icono = '✅';
    if (!paso && extra.tras) { icono = '⏳'; pendientes++; }
    else if (!paso) { icono = '❌'; fallas++; }
    const tras = extra.tras ? `  [esperado tras ${extra.tras}]` : '';
    const mostrar = !paso || esperado === 'RECHAZAR';
    console.log(`${icono} [${esperado}] (${actor}) ${nombre}${tras}${mostrar ? `  →  ${detalle}` : ''}`);
});

console.log('');
console.log('─'.repeat(77));
const total = CASOS.length;
console.log(`${total - fallas - pendientes - omitidos} de ${total} casos como se esperaba · ${pendientes} hueco(s) conocido(s) pendiente(s) de migración · ${fallas} falla(s) nueva(s) · ${omitidos} omitido(s).`);
console.log('Nada quedó escrito: el lote corrió en una sola sentencia que terminó en RAISE EXCEPTION.');
process.exit(fallas + pendientes > 0 ? 1 : 0);
