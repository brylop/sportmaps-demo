// scripts/rls-pruebas-pizarra.mjs
//
// Prueba de COMPORTAMIENTO de los permisos de la pizarra TacticalPad contra la
// base viva (docs/specs/pizarra-nivel-tacticalpad.md §4):
//
//   · public.training_exercises (biblioteca + plantillas del sistema)
//   · public.tactical_board_events + vista v_tactical_board_usage_weekly
//   · RPCs log_tactical_board_event e insert_exercise_into_session_block
//   · columnas `frames` de match_lineups / team_tactical_presets
//   · paquetes de la biblioteca (M2): exercise_packs, school_exercise_packs,
//     training_exercises.pack_id y las RPCs activate_/deactivate_/import_exercise_pack
//   · notas y videos (M6c): columnas notes/videos con sus CHECK, board.notes/videos
//     de la biblioteca y la tabla tactical_saved_videos (esperado tras 20261014163705)
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
//   reporter staff de alguna escuela R que NO es admin ni táctico (opcional;
//            p. ej. rol reporter): lee, pero no gestiona paquetes
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
//
// Casos con `requiere` (los de paquetes, M2): dependen de objetos que crea una
// migración escrita y todavía SIN aplicar. Si el objeto no existe en la base
// se omiten (⏸️ «esperado tras <versión>») y NO hacen fallar la corrida; la
// lógica de esos casos se revisó leyendo la migración. Apenas se aplique,
// corren solos y tienen que dar verde.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Migraciones de corrección escritas y pendientes de aplicar.
const FIX_LECTURA_TACTICA = '20261005173002'; // pizarra_blindaje_datos_y_lectura (lectura solo staff)
const FIX_PIZARRA = '20261013200604';         // pizarra_rls_biblioteca_y_rpc_ejercicio (H1/H2/H3)
const MIG_PAQUETES = '20261014121142';        // pizarra_paquetes_biblioteca (M2: exercise_packs + RPCs)
const PAQ = { requiere: 'public.exercise_packs', tras: MIG_PAQUETES };
const MIG_CUPO = '20261014155445';           // pizarra_ia_cupo_por_entrenador_tokens (IA: cupo por costo real por usuario)
const CUPO = { requiere: 'public.tactical_ai_user_usage', tras: MIG_CUPO };
const MIG_MEDIOS = '20261014163705';          // pizarra_notas_y_videos (M6c: notes/videos + tactical_saved_videos)
const MED = { requiere: 'public.tactical_saved_videos', tras: MIG_MEDIOS };
// M6c: un video guardado mínimo (YouTube) de la escuela `school` a nombre de `autor`.
const NUEVO_VID = (school, autor, extra = {}) => {
    const v = { provider: 'youtube', video_id: 'dQw4w9WgXcQ', title: 'RLS video', start_s: 90, ...extra };
    const cols = Object.keys(v);
    const vals = cols.map((k) => (typeof v[k] === 'number' ? v[k] : v[k] === null ? 'null' : `'${String(v[k]).replace(/'/g, "''")}'`));
    return W(`insert into public.tactical_saved_videos (school_id, created_by, ${cols.join(', ')}) values (${school}, ${autor}, ${vals.join(', ')})`);
};
const NOTA_OK = `'{"text":"**Salida** por derecha","tags":["presión"]}'::jsonb`;
const VIDS_OK = `'[{"provider":"youtube","video_id":"dQw4w9WgXcQ","title":"Clip","start_s":90,"end_s":null,"is_private":false},{"provider":"veo","url":"https://app.veo.co/matches/abc-123/","title":"Partido","start_s":0,"is_private":true}]'::jsonb`;

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
const RPC_PAQ = (fn, school, pack) =>
    `select ((public.${fn}('${school}'::uuid, '${pack}'::uuid)) ->> 'pack_id' is not null)::int`;
// Archivo mínimo ya validado por el BFF (lo que le pasa a la RPC).
const PAYLOAD = (nombre, ejercicios) =>
    `'${JSON.stringify({ pack: { name: nombre, sport: 'futbol' }, exercises: ejercicios })}'::jsonb`;
const RPC_IMPORT = (school, nombre, ejercicios) =>
    `select ((public.import_exercise_pack('${school}'::uuid, ${PAYLOAD(nombre, ejercicios)})) ->> 'pack_id' is not null)::int`;
const DOS_EJ = [{ name: 'RLS paq 1', minutes: 10 }, { name: 'RLS paq 2', sport: 'generico' }];

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

    // ── 8. Paquetes (M2): lectura ────────────────────────────────────────────
    ['coach', 'coach de A lee un paquete del sistema', 'ACEPTAR', LEER('exercise_packs', `id = '{pk_sys}'`), PAQ],
    ['coach', 'coach de A lee un paquete de su escuela', 'ACEPTAR', LEER('exercise_packs', `id = '{pk_a}'`), PAQ],
    ['owner', 'owner de A lee un paquete de su escuela', 'ACEPTAR', LEER('exercise_packs', `id = '{pk_a}'`), PAQ],
    ['reporter', 'staff no gestor de R lee los paquetes del sistema (leer = staff)', 'ACEPTAR', LEER('exercise_packs', `id = '{pk_sys}'`), PAQ],
    ['coach', 'coach de A lee un paquete de la escuela B', 'RECHAZAR', LEER('exercise_packs', `id = '{pk_b}'`), PAQ],
    ['staff_b', 'coach de B lee un paquete de la escuela A', 'RECHAZAR', LEER('exercise_packs', `id = '{pk_a}'`), PAQ],
    ['parent', 'padre de A lee los paquetes del sistema', 'RECHAZAR', LEER('exercise_packs', `id = '{pk_sys}'`), PAQ],
    ['parent', 'padre de A lee los paquetes de su escuela', 'RECHAZAR', LEER('exercise_packs', `school_id = '{sch_a}'`), PAQ],
    ['athlete', 'atleta de A lee paquetes', 'RECHAZAR', LEER('exercise_packs', 'true'), PAQ],
    ['anon', 'anon lee exercise_packs', 'RECHAZAR', LEER('exercise_packs', 'true'), PAQ],
    ['coach', 'coach de A lee las activaciones de su escuela', 'ACEPTAR', LEER('school_exercise_packs', `school_id = '{sch_a}'`), PAQ],
    ['parent', 'padre de A lee las activaciones de su escuela', 'RECHAZAR', LEER('school_exercise_packs', `school_id = '{sch_a}'`), PAQ],
    ['staff_b', 'coach de B lee las activaciones de A', 'RECHAZAR', LEER('school_exercise_packs', `school_id = '{sch_a}'`), PAQ],
    ['anon', 'anon lee school_exercise_packs', 'RECHAZAR', LEER('school_exercise_packs', 'true'), PAQ],

    // ── 9. Paquetes: nadie escribe por la tabla; los del sistema son de solo lectura
    ['coach', 'coach de A crea un paquete DIRECTO en A (solo por RPC)', 'RECHAZAR', W(`insert into public.exercise_packs (school_id, sport, name) values ('{sch_a}', 'futbol', 'RLS directo')`), PAQ],
    ['owner', 'owner de A crea un paquete del sistema DIRECTO', 'RECHAZAR', W(`insert into public.exercise_packs (school_id, sport, name) values (null, 'futbol', 'RLS sistema')`), PAQ],
    ['owner', 'owner de A edita un paquete del sistema', 'RECHAZAR', W(`update public.exercise_packs set name = 'RLS editado' where id = '{pk_sys}'`), PAQ],
    ['owner', 'owner de A se apropia de un paquete del sistema', 'RECHAZAR', W(`update public.exercise_packs set school_id = '{sch_a}' where id = '{pk_sys}'`), PAQ],
    ['owner', 'owner de A borra un paquete del sistema', 'RECHAZAR', W(`delete from public.exercise_packs where id = '{pk_sys}'`), PAQ],
    ['owner', 'owner de A edita su propio paquete DIRECTO (solo por RPC)', 'RECHAZAR', W(`update public.exercise_packs set is_active = false where id = '{pk_a}'`), PAQ],
    ['coach', 'coach de A se activa un paquete DIRECTO (insert en school_exercise_packs)', 'RECHAZAR', W(`insert into public.school_exercise_packs (school_id, pack_id) values ('{sch_a}', '{pk_sys2}')`), PAQ],
    ['owner', 'owner de A borra activaciones DIRECTO', 'RECHAZAR', W(`delete from public.school_exercise_packs where school_id = '{sch_a}'`), PAQ],
    ['coach', 'coach de A cuelga un ejercicio de A de un paquete del SISTEMA (trigger)', 'RECHAZAR', NUEVO_EJ(`'{sch_a}'`, `'{coach}'`, `pack_id|'{pk_sys}'`), PAQ],
    ['coach', 'coach de A cuelga un ejercicio de A de un paquete de B (trigger)', 'RECHAZAR', NUEVO_EJ(`'{sch_a}'`, `'{coach}'`, `pack_id|'{pk_b}'`), PAQ],
    ['coach', 'coach de A crea un ejercicio dentro de un paquete de A', 'ACEPTAR', NUEVO_EJ(`'{sch_a}'`, `'{coach}'`, `pack_id|'{pk_a}'`), PAQ],
    ['coach', 'coach de A mueve un ejercicio de A al paquete del sistema (trigger)', 'RECHAZAR', UPD_EJ('{ex_a_coach}', `pack_id = '{pk_sys}'`), PAQ],

    // ── 10. Paquetes: activar / desactivar (RPC, gate admin ∪ táctico) ───────
    ['coach', 'coach de A activa un paquete del sistema en A', 'ACEPTAR', RPC_PAQ('activate_exercise_pack', '{sch_a}', '{pk_sys2}'),
        { ...PAQ, chk: `select count(*)::int from public.school_exercise_packs where school_id = '{sch_a}' and pack_id = '{pk_sys2}' and activated_by = '{coach}'` }],
    ['owner', 'owner de A desactiva un paquete del sistema en A', 'ACEPTAR', RPC_PAQ('deactivate_exercise_pack', '{sch_a}', '{pk_sys}'),
        { ...PAQ, chk: `select (count(*) = 0)::int from public.school_exercise_packs where school_id = '{sch_a}' and pack_id = '{pk_sys}'` }],
    ['nontac', 'admin (no táctico) de A activa un paquete (spec: admin ∪ táctico)', 'ACEPTAR', RPC_PAQ('activate_exercise_pack', '{sch_a}', '{pk_sys2}'), PAQ],
    ['coach', 'coach de A desactiva (oculta) un paquete propio de A', 'ACEPTAR', RPC_PAQ('deactivate_exercise_pack', '{sch_a}', '{pk_a}'),
        { ...PAQ, chk: `select (not is_active)::int from public.exercise_packs where id = '{pk_a}'` }],
    ['reporter', 'staff NO gestor (ni admin ni táctico) activa un paquete en su escuela', 'RECHAZAR', RPC_PAQ('activate_exercise_pack', '{sch_r}', '{pk_sys2}'), PAQ],
    ['reporter', 'staff NO gestor desactiva un paquete en su escuela', 'RECHAZAR', RPC_PAQ('deactivate_exercise_pack', '{sch_r}', '{pk_sys}'), PAQ],
    ['coach', 'coach de A activa un paquete para la escuela B', 'RECHAZAR', RPC_PAQ('activate_exercise_pack', '{sch_b}', '{pk_sys2}'),
        { ...PAQ, chk: `select count(*)::int from public.school_exercise_packs where school_id = '{sch_b}' and pack_id = '{pk_sys2}' and activated_by = '{coach}'` }],
    ['staff_b', 'coach de B activa un paquete en la escuela A', 'RECHAZAR', RPC_PAQ('activate_exercise_pack', '{sch_a}', '{pk_sys2}'), PAQ],
    ['coach', 'coach de A activa en A un paquete de la escuela B', 'RECHAZAR', RPC_PAQ('activate_exercise_pack', '{sch_a}', '{pk_b}'), PAQ],
    ['coach', 'coach de A desactiva en A un paquete de la escuela B', 'RECHAZAR', RPC_PAQ('deactivate_exercise_pack', '{sch_a}', '{pk_b}'),
        { ...PAQ, chk: `select count(*)::int from public.exercise_packs where id = '{pk_b}' and is_active = false` }],
    ['parent', 'padre de A activa un paquete en A', 'RECHAZAR', RPC_PAQ('activate_exercise_pack', '{sch_a}', '{pk_sys2}'), PAQ],
    ['athlete', 'atleta de A activa un paquete en A', 'RECHAZAR', RPC_PAQ('activate_exercise_pack', '{sch_a}', '{pk_sys2}'), PAQ],
    ['anon', 'anon ejecuta activate_exercise_pack', 'RECHAZAR', RPC_PAQ('activate_exercise_pack', '{sch_a}', '{pk_sys2}'), PAQ],

    // ── 11. Paquetes: importar (RPC transaccional) ───────────────────────────
    ['coach', 'coach de A importa un paquete en A (paquete + 2 ejercicios, una transacción)', 'ACEPTAR', RPC_IMPORT('{sch_a}', 'RLS importado', DOS_EJ),
        { ...PAQ, chk: `select (count(*) = 2)::int from public.training_exercises e join public.exercise_packs p on p.id = e.pack_id where p.school_id = '{sch_a}' and p.name = 'RLS importado' and p.created_by = '{coach}' and e.school_id = '{sch_a}' and e.created_by = '{coach}' and not e.is_template` }],
    ['coach', 'coach de A importa con ids/escuela/autor inyectados: se ignoran', 'ACEPTAR',
        RPC_IMPORT('{sch_a}', 'RLS inyectado', [{ name: 'RLS trampa', id: '{ex_b}', school_id: '{sch_b}', created_by: '{owner}', pack_id: '{pk_b}', is_template: true, times_used: 999 }]),
        { ...PAQ, chk: `select (count(*) filter (where e.school_id = '{sch_a}' and e.created_by = '{coach}' and not e.is_template and e.times_used = 0 and e.id <> '{ex_b}') = 1 and count(*) filter (where e.id = '{ex_b}') = 0)::int from public.training_exercises e join public.exercise_packs p on p.id = e.pack_id where p.name = 'RLS inyectado'` }],
    ['owner', 'owner de A importa en A', 'ACEPTAR', RPC_IMPORT('{sch_a}', 'RLS owner', DOS_EJ), PAQ],
    ['coach', 'coach de A importa en la escuela B', 'RECHAZAR', RPC_IMPORT('{sch_b}', 'RLS ajeno', DOS_EJ),
        { ...PAQ, chk: `select count(*)::int from public.exercise_packs where school_id = '{sch_b}' and name = 'RLS ajeno'` }],
    ['staff_b', 'coach de B importa en la escuela A', 'RECHAZAR', RPC_IMPORT('{sch_a}', 'RLS ajeno', DOS_EJ), PAQ],
    ['reporter', 'staff NO gestor importa en su escuela', 'RECHAZAR', RPC_IMPORT('{sch_r}', 'RLS reporter', DOS_EJ), PAQ],
    ['parent', 'padre de A importa en A', 'RECHAZAR', RPC_IMPORT('{sch_a}', 'RLS padre', DOS_EJ), PAQ],
    ['anon', 'anon ejecuta import_exercise_pack', 'RECHAZAR', RPC_IMPORT('{sch_a}', 'RLS anon', DOS_EJ), PAQ],
    ['coach', 'coach de A importa 201 ejercicios (tope 200)', 'RECHAZAR',
        RPC_IMPORT('{sch_a}', 'RLS gigante', Array.from({ length: 201 }, (_, i) => ({ name: `E${i}` }))), PAQ],
    ['coach', 'coach de A importa con un ejercicio inválido al final: se rechaza TODO (sin paquete a medias)', 'RECHAZAR',
        RPC_IMPORT('{sch_a}', 'RLS atomico', [{ name: 'Bien' }, { name: 'Mal', sport: 'quidditch' }]), PAQ],
    ['coach', 'coach de A importa un paquete sin nombre', 'RECHAZAR',
        `select ((public.import_exercise_pack('{sch_a}'::uuid, '{"pack":{"sport":"futbol"},"exercises":[{"name":"x"}]}'::jsonb)) ->> 'pack_id' is not null)::int`, PAQ],

    // ── 12. Paquetes: invariantes estáticos ──────────────────────────────────
    ...[
        ['activate_exercise_pack', 'public.activate_exercise_pack(uuid,uuid)'],
        ['deactivate_exercise_pack', 'public.deactivate_exercise_pack(uuid,uuid)'],
        ['import_exercise_pack', 'public.import_exercise_pack(uuid,jsonb)'],
    ].flatMap(([nombre, firma]) => [
        ['postgres', `${nombre}: SECURITY DEFINER con search_path fijo (incluye pg_temp)`, 'ACEPTAR',
            `select (p.prosecdef and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%pg_temp%'))::int from pg_proc p where p.oid = '${firma}'::regprocedure`, PAQ],
        ['postgres', `${nombre}: sin EXECUTE para anon ni PUBLIC`, 'ACEPTAR',
            `select (not has_function_privilege('anon', '${firma}', 'EXECUTE') and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = '${firma}'::regprocedure and a.grantee = 0))::int`, PAQ],
        ['postgres', `${nombre}: EXECUTE explícito para authenticated`, 'ACEPTAR',
            `select has_function_privilege('authenticated', '${firma}', 'EXECUTE')::int`, PAQ],
    ]),
    ['postgres', 'exercise_packs / school_exercise_packs: solo policies SELECT y authenticated sin INSERT/UPDATE/DELETE', 'ACEPTAR',
        `select ((select count(*) from pg_policies where schemaname = 'public' and tablename in ('exercise_packs', 'school_exercise_packs') and cmd <> 'SELECT') = 0 and not exists (select 1 from unnest(array['public.exercise_packs','public.school_exercise_packs']) t, unnest(array['INSERT','UPDATE','DELETE']) p where has_table_privilege('authenticated', t, p)))::int`, PAQ],
    ['postgres', 'anon sin ningún privilegio en exercise_packs / school_exercise_packs', 'ACEPTAR',
        `select (not exists (select 1 from unnest(array['public.exercise_packs','public.school_exercise_packs']) t, unnest(array['SELECT','INSERT','UPDATE','DELETE']) p where has_table_privilege('anon', t, p)))::int`, PAQ],
    ['postgres', 'RLS activa en exercise_packs y school_exercise_packs', 'ACEPTAR',
        `select (count(*) = 2)::int from pg_class where oid in ('public.exercise_packs'::regclass, 'public.school_exercise_packs'::regclass) and relrowsecurity`, PAQ],
    ['postgres', 'paquetes del sistema: ninguna plantilla SportMaps sin paquete', 'ACEPTAR',
        `select (count(*) = 0)::int from public.training_exercises where school_id is null and is_template and pack_id is null`, PAQ],

    // ── 14. IA: cupo por costo real por usuario (20261014155445) ─────────────
    // Esperado tras 20261014155445 (sobre 20261014111442): se omiten (⏸️) hasta
    // que se aplique. Fixtures en el bloque DO (solo si la tabla existe):
    // filas del mes para coach y owner de A y para staff_b en B, un run del
    // coach y un grant de A. El padre de A NO tiene fila (para las reservas).
    ['coach', 'IA: coach de A lee su propio consumo', 'ACEPTAR', LEER('tactical_ai_user_usage', `user_id = '{coach}'`), CUPO],
    ['coach', 'IA: coach de A lee el consumo de OTRO usuario de A (el owner)', 'RECHAZAR', LEER('tactical_ai_user_usage', `user_id = '{owner}'`), CUPO],
    ['owner', 'IA: admin de A lee el consumo de sus coaches', 'ACEPTAR', LEER('tactical_ai_user_usage', `school_id = '{sch_a}' and user_id = '{coach}'`), CUPO],
    ['owner', 'IA: admin de A lee el consumo de la escuela B', 'RECHAZAR', LEER('tactical_ai_user_usage', `school_id = '{sch_b}'`), CUPO],
    ['staff_b', 'IA: coach de B lee el consumo de A', 'RECHAZAR', LEER('tactical_ai_user_usage', `school_id = '{sch_a}'`), CUPO],
    ['parent', 'IA: padre de A lee el consumo de A', 'RECHAZAR', LEER('tactical_ai_user_usage', `school_id = '{sch_a}'`), CUPO],
    ['athlete', 'IA: atleta de A lee el consumo de A', 'RECHAZAR', LEER('tactical_ai_user_usage', `school_id = '{sch_a}'`), CUPO],
    ['anon', 'IA: anon lee tactical_ai_user_usage', 'RECHAZAR', LEER('tactical_ai_user_usage', 'true'), CUPO],
    ['coach', 'IA: coach de A lee el total/techo de la escuela (solo admin)', 'RECHAZAR', LEER('tactical_ai_school_usage', `school_id = '{sch_a}'`), CUPO],
    ['owner', 'IA: admin de A lee el total/techo de su escuela', 'ACEPTAR', LEER('tactical_ai_school_usage', `school_id = '{sch_a}'`), CUPO],
    ['staff_b', 'IA: coach de B lee el total de A', 'RECHAZAR', LEER('tactical_ai_school_usage', `school_id = '{sch_a}'`), CUPO],
    ['coach', 'IA: coach de A lee sus propios intentos (runs)', 'ACEPTAR', LEER('tactical_ai_runs', `user_id = '{coach}'`), CUPO],
    ['owner', 'IA: admin de A lee los intentos de su escuela', 'ACEPTAR', LEER('tactical_ai_runs', `school_id = '{sch_a}'`), CUPO],
    ['staff_b', 'IA: coach de B lee los intentos de A', 'RECHAZAR', LEER('tactical_ai_runs', `school_id = '{sch_a}'`), CUPO],
    ['anon', 'IA: anon lee tactical_ai_runs', 'RECHAZAR', LEER('tactical_ai_runs', 'true'), CUPO],
    ['coach', 'IA: coach de A lee los cupos regalados de A (solo admin)', 'RECHAZAR', LEER('tactical_ai_grants', `school_id = '{sch_a}'`), CUPO],
    ['owner', 'IA: admin de A lee los cupos regalados de A', 'ACEPTAR', LEER('tactical_ai_grants', `school_id = '{sch_a}'`), CUPO],
    ['anon', 'IA: anon lee tactical_ai_grants', 'RECHAZAR', LEER('tactical_ai_grants', 'true'), CUPO],
    // Nadie escribe directo.
    ['coach', 'IA: coach de A se pone su consumo en cero (UPDATE directo)', 'RECHAZAR', W(`update public.tactical_ai_user_usage set used_micro_usd = 0 where user_id = '{coach}'`), CUPO],
    ['coach', 'IA: coach de A se sube el presupuesto (UPDATE directo)', 'RECHAZAR', W(`update public.tactical_ai_user_usage set extra_micro_usd = 100000000 where user_id = '{coach}'`), CUPO],
    ['owner', 'IA: admin de A sube el techo de su escuela (UPDATE directo)', 'RECHAZAR', W(`update public.tactical_ai_school_usage set extra_micro_usd = 100000000 where school_id = '{sch_a}'`), CUPO],
    ['owner', 'IA: admin de A borra el consumo de un coach', 'RECHAZAR', W(`delete from public.tactical_ai_user_usage where school_id = '{sch_a}'`), CUPO],
    ['coach', 'IA: coach de A inserta su fila de consumo', 'RECHAZAR', W(`insert into public.tactical_ai_user_usage (school_id, user_id, period, budget_micro_usd) values ('{sch_a}', '{coach}', '2099-01', 99000000)`), CUPO],
    ['coach', 'IA: coach de A inserta un intento', 'RECHAZAR', W(`insert into public.tactical_ai_runs (school_id, user_id, period, sport, status) values ('{sch_a}', '{coach}', '2099-01', 'futbol', 'settled')`), CUPO],
    // RPC del BFF: solo service_role.
    ['coach', 'IA: coach de A ejecuta tactical_ai_reserve', 'RECHAZAR', `select ((public.tactical_ai_reserve('{sch_a}'::uuid, '{coach}'::uuid, 'futbol', 80000)) ->> 'ok')::boolean::int`, CUPO],
    ['coach', 'IA: coach de A ejecuta tactical_ai_release', 'RECHAZAR', `select ((public.tactical_ai_release(gen_random_uuid())) ->> 'ok')::boolean::int`, CUPO],
    ['coach', 'IA: coach de A ejecuta tactical_ai_settle', 'RECHAZAR', `select ((public.tactical_ai_settle(gen_random_uuid(), 0, 'x', 'x', 0, 0, 0, 0)) ->> 'ok')::boolean::int`, CUPO],
    ['owner', 'IA: admin de A ejecuta tactical_ai_user_balance', 'RECHAZAR', `select ((public.tactical_ai_user_balance('{sch_a}'::uuid, '{coach}'::uuid)) ->> 'ok')::boolean::int`, CUPO],
    ['owner', 'IA: admin de A (no super admin) se regala cupo en USD', 'RECHAZAR', `select ((public.grant_tactical_ai_credits('{sch_a}'::uuid, 5.0::numeric, '{coach}'::uuid, 'rls')) ->> 'ok')::boolean::int`, CUPO],
    ['coach', 'IA: coach de A usa la firma vieja (N análisis) para regalarse cupo', 'RECHAZAR', `select ((public.grant_tactical_ai_credits('{sch_a}'::uuid, 50)) ->> 'ok')::boolean::int`, CUPO],
    ['anon', 'IA: anon ejecuta grant_tactical_ai_credits', 'RECHAZAR', `select ((public.grant_tactical_ai_credits('{sch_a}'::uuid, 5.0::numeric)) ->> 'ok')::boolean::int`, CUPO],
    // Comportamiento de las RPC (como postgres, que es quien las ejecuta en el BFF vía service_role).
    ['postgres', 'IA: 20 reservas de US$ 0,08 con presupuesto de US$ 1 → exactamente 12 (FOR UPDATE)', 'ACEPTAR',
        `select count(*)::int from generate_series(1, 20) g where (public.tactical_ai_reserve('{sch_a}'::uuid, '{parent}'::uuid, 'futbol', 80000) ->> 'ok')::boolean`,
        { ...CUPO, chk: `select ((select count(*) from public.tactical_ai_runs where user_id = '{parent}' and status = 'reserved') = 12 and (select count(*) from public.tactical_ai_runs where user_id = '{parent}' and status = 'denied' and denied_scope = 'user') = 8 and (select reserved_micro_usd from public.tactical_ai_user_usage where user_id = '{parent}' and school_id = '{sch_a}' and period = public.tactical_ai_current_period()) = 960000)::int` }],
    ['postgres', 'IA: reservar y liberar deja lo reservado en cero y sin cobrar', 'ACEPTAR',
        `select (public.tactical_ai_release(((public.tactical_ai_reserve('{sch_a}'::uuid, '{parent}'::uuid, 'voleibol', 80000)) ->> 'reservation_id')::uuid) ->> 'ok')::boolean::int`,
        { ...CUPO, chk: `select (reserved_micro_usd = 0 and used_micro_usd = 0)::int from public.tactical_ai_user_usage where user_id = '{parent}' and school_id = '{sch_a}' and period = public.tactical_ai_current_period()` }],
    ['postgres', 'IA: reservar y cobrar el costo real (US$ 0,064) — y cobrar dos veces no duplica', 'ACEPTAR',
        `with r as (select (public.tactical_ai_reserve('{sch_a}'::uuid, '{parent}'::uuid, 'futbol', 80000) ->> 'reservation_id')::uuid id), s1 as (select public.tactical_ai_settle(id, 64000, 'claude', 'claude-sonnet-5-5', 1400, 5900, 0, 3600) j from r), s2 as (select public.tactical_ai_settle(id, 64000, 'claude', 'claude-sonnet-5-5', 1400, 5900, 0, 3600) j from r, s1) select (s2.j ? 'already')::int from s2`,
        { ...CUPO, chk: `select (u.used_micro_usd = 64000 and u.reserved_micro_usd = 0 and u.analyses = 1 and u.output_tokens = 5900)::int from public.tactical_ai_user_usage u where u.user_id = '{parent}' and u.school_id = '{sch_a}' and u.period = public.tactical_ai_current_period()` }],
    ['postgres', 'IA: acierto de caché cuesta US$ 0', 'ACEPTAR',
        `select (public.tactical_ai_record_cache_hit('{sch_a}'::uuid, '{parent}'::uuid, 'futbol') ->> 'ok')::boolean::int`,
        { ...CUPO, chk: `select (used_micro_usd = 0 and reserved_micro_usd = 0 and cache_hits = 1)::int from public.tactical_ai_user_usage where user_id = '{parent}' and school_id = '{sch_a}' and period = public.tactical_ai_current_period()` }],
    ['postgres', 'IA: techo de la escuela B agotado (fixture) → denied_scope school aunque el coach tenga saldo', 'ACEPTAR',
        `select ((public.tactical_ai_reserve('{sch_b}'::uuid, '{staff_b}'::uuid, 'futbol', 80000) ->> 'denied_scope') = 'school')::int`,
        { ...CUPO, chk: `select (count(*) = 1)::int from public.tactical_ai_runs where user_id = '{staff_b}' and school_id = '{sch_b}' and status = 'denied' and denied_scope = 'school'` }],
    // Invariantes estáticos.
    ...[
        'public.tactical_ai_reserve(uuid,uuid,text,bigint)',
        'public.tactical_ai_settle(uuid,bigint,text,text,integer,integer,integer,integer)',
        'public.tactical_ai_release(uuid)',
        'public.tactical_ai_record_cache_hit(uuid,uuid,text)',
        'public.tactical_ai_user_balance(uuid,uuid)',
    ].map((firma) => ['postgres', `IA: ${firma.split('(')[0]} SECURITY DEFINER + search_path, EXECUTE solo service_role`, 'ACEPTAR',
        `select (p.prosecdef and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%pg_temp%') and not has_function_privilege('anon', '${firma}', 'EXECUTE') and not has_function_privilege('authenticated', '${firma}', 'EXECUTE') and has_function_privilege('service_role', '${firma}', 'EXECUTE'))::int from pg_proc p where p.oid = '${firma}'::regprocedure`, CUPO]),
    ['postgres', 'IA: tablas del cupo con RLS, solo policies SELECT, authenticated sin escritura y anon sin nada', 'ACEPTAR',
        `select ((select count(*) from pg_class where oid in ('public.tactical_ai_user_usage'::regclass, 'public.tactical_ai_school_usage'::regclass, 'public.tactical_ai_runs'::regclass, 'public.tactical_ai_grants'::regclass) and relrowsecurity) = 4 and (select count(*) from pg_policies where schemaname = 'public' and tablename in ('tactical_ai_user_usage','tactical_ai_school_usage','tactical_ai_runs','tactical_ai_grants') and cmd <> 'SELECT') = 0 and not exists (select 1 from unnest(array['public.tactical_ai_user_usage','public.tactical_ai_school_usage','public.tactical_ai_runs','public.tactical_ai_grants']) t, unnest(array['INSERT','UPDATE','DELETE']) p where has_table_privilege('authenticated', t, p) or has_table_privilege('anon', t, p)) and not exists (select 1 from unnest(array['public.tactical_ai_user_usage','public.tactical_ai_school_usage','public.tactical_ai_runs','public.tactical_ai_grants']) t where has_table_privilege('anon', t, 'SELECT')))::int`, CUPO],
    ['postgres', 'IA: lo obsoleto de 20261014111442 queda congelado (service_role sin consume/refund)', 'ACEPTAR',
        `select (not has_function_privilege('service_role', 'public.consume_tactical_ai_credit(uuid)', 'EXECUTE') and not has_function_privilege('service_role', 'public.refund_tactical_ai_credit(uuid)', 'EXECUTE'))::int`, CUPO],

    // ── 13. Invariantes estáticos (como postgres; n = 1 si se cumple) ────────
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
        `select (count(*) = 0)::int from pg_policies where schemaname = 'public' and tablename in ('training_exercises','tactical_board_events','match_lineups','match_lineup_players','team_tactical_presets','exercise_packs','school_exercise_packs') and cmd = 'ALL' and with_check is null`],
    ['postgres', 'I2: ninguna policy de escritura usa user_school_ids() en las tablas de la pizarra', 'ACEPTAR',
        `select (count(*) = 0)::int from pg_policies where schemaname = 'public' and tablename in ('training_exercises','tactical_board_events','match_lineups','match_lineup_players','team_tactical_presets','exercise_packs','school_exercise_packs') and cmd in ('INSERT','UPDATE','DELETE','ALL') and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'user_school_ids\\('`],
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

    // ── 14. Notas y videos (M6c) — esperado tras 20261014163705 ──────────────
    // «Videos guardados»: leen staff, escriben los que editan la pizarra.
    ['coach', 'coach de A lee los videos guardados de A', 'ACEPTAR', LEER('tactical_saved_videos', `id = '{vid_a}'`), MED],
    ['owner', 'owner de A lee los videos guardados de A', 'ACEPTAR', LEER('tactical_saved_videos', `id = '{vid_a}'`), MED],
    ['nontac', 'admin NO táctico de A lee los videos guardados (es staff)', 'ACEPTAR', LEER('tactical_saved_videos', `id = '{vid_a}'`), MED],
    ['reporter', 'staff NO gestor lee los videos guardados de su escuela', 'ACEPTAR', LEER('tactical_saved_videos', `id = '{vid_r}'`), MED],
    ['parent', 'padre de A lee los videos guardados de A', 'RECHAZAR', LEER('tactical_saved_videos', `school_id = '{sch_a}'`), MED],
    ['athlete', 'atleta de A lee los videos guardados de A', 'RECHAZAR', LEER('tactical_saved_videos', `school_id = '{sch_a}'`), MED],
    ['staff_b', 'coach de B lee los videos guardados de A', 'RECHAZAR', LEER('tactical_saved_videos', `id = '{vid_a}'`), MED],
    ['coach', 'coach de A lee los videos guardados de B', 'RECHAZAR', LEER('tactical_saved_videos', `id = '{vid_b}'`), MED],
    ['anon', 'anon lee videos guardados', 'RECHAZAR', LEER('tactical_saved_videos', 'true'), MED],
    ['coach', 'coach de A guarda un video en A a su nombre', 'ACEPTAR', NUEVO_VID(`'{sch_a}'`, `'{coach}'`, { start_s: 120 }), MED],
    ['coach', 'coach de A guarda un video en A a nombre del owner', 'RECHAZAR', NUEVO_VID(`'{sch_a}'`, `'{owner}'`, { start_s: 121 }), MED],
    ['coach', 'coach de A guarda un video en la escuela B', 'RECHAZAR', NUEVO_VID(`'{sch_b}'`, `'{coach}'`, { start_s: 122 }), MED],
    ['owner', 'owner de A guarda un enlace de Veo en A', 'ACEPTAR',
        NUEVO_VID(`'{sch_a}'`, `'{owner}'`, { provider: 'veo', video_id: null, url: 'https://app.veo.co/matches/rls-1/', start_s: 0 }), MED],
    ['nontac', 'admin NO táctico de A guarda un video', 'RECHAZAR', NUEVO_VID(`'{sch_a}'`, `'{nontac}'`, { start_s: 123 }), MED],
    ['reporter', 'staff NO gestor guarda un video en su escuela', 'RECHAZAR', NUEVO_VID(`'{sch_r}'`, `'{reporter}'`, { start_s: 124 }), MED],
    ['parent', 'padre de A guarda un video en A', 'RECHAZAR', NUEVO_VID(`'{sch_a}'`, `'{parent}'`, { start_s: 125 }), MED],
    ['anon', 'anon guarda un video', 'RECHAZAR', NUEVO_VID(`'{sch_a}'`, 'null', { start_s: 126 }), MED],
    ['coach', 'CHECK: proveedor fuera de la lista (dailymotion)', 'RECHAZAR', NUEVO_VID(`'{sch_a}'`, `'{coach}'`, { provider: 'dailymotion', start_s: 127 }), MED],
    ['coach', 'CHECK: id de YouTube con caracteres raros', 'RECHAZAR', NUEVO_VID(`'{sch_a}'`, `'{coach}'`, { video_id: 'abc<script>x', start_s: 128 }), MED],
    ['coach', 'CHECK: enlace javascript: como Veo', 'RECHAZAR',
        NUEVO_VID(`'{sch_a}'`, `'{coach}'`, { provider: 'veo', video_id: null, url: 'javascript:alert(1)', start_s: 129 }), MED],
    ['coach', 'CHECK: dominio parecido (veo.co.evil.com)', 'RECHAZAR',
        NUEVO_VID(`'{sch_a}'`, `'{coach}'`, { provider: 'veo', video_id: null, url: 'https://veo.co.evil.com/x', start_s: 130 }), MED],
    ['coach', 'CHECK: fin antes del inicio', 'RECHAZAR', NUEVO_VID(`'{sch_a}'`, `'{coach}'`, { start_s: 200, end_s: 100 }), MED],
    ['coach', 'coach de A edita el título de un video de A', 'ACEPTAR', W(`update public.tactical_saved_videos set title = 'RLS editado' where id = '{vid_a}'`), MED],
    ['coach', 'coach de A mueve un video de A a la escuela B', 'RECHAZAR', W(`update public.tactical_saved_videos set school_id = '{sch_b}' where id = '{vid_a}'`), MED],
    ['staff_b', 'coach de B borra un video de A', 'RECHAZAR', W(`delete from public.tactical_saved_videos where id = '{vid_a}'`), MED],
    ['nontac', 'admin NO táctico de A borra un video de A', 'RECHAZAR', W(`delete from public.tactical_saved_videos where id = '{vid_a}'`), MED],
    ['coach', 'coach de A borra un video de A', 'ACEPTAR', W(`delete from public.tactical_saved_videos where id = '{vid_a}'`), MED],
    // Columnas notes/videos de la jugada: bajo las policies de siempre + CHECK de forma.
    ['coach', 'coach de A guarda nota y videos válidos en una jugada de A', 'ACEPTAR',
        W(`update public.match_lineups set notes = ${NOTA_OK}, videos = ${VIDS_OK} where id = '{ml_a}'`), MED],
    ['coach', 'CHECK: nota de más de 2000 caracteres', 'RECHAZAR',
        W(`update public.match_lineups set notes = jsonb_build_object('text', repeat('a', 2001)) where id = '{ml_a}'`), MED],
    ['coach', 'CHECK: nota con un campo de más', 'RECHAZAR',
        W(`update public.match_lineups set notes = '{"text":"x","html":"<b>"}'::jsonb where id = '{ml_a}'`), MED],
    ['coach', 'CHECK: 11 videos en una jugada (tope 10)', 'RECHAZAR',
        W(`update public.team_tactical_presets set videos = (select jsonb_agg(jsonb_build_object('provider','youtube','video_id','dQw4w9WgXcQ','title','v','start_s',g)) from generate_series(1, 11) g) where id = '{preset_a}'`), MED],
    ['coach', 'CHECK: video de la jugada con proveedor desconocido', 'RECHAZAR',
        W(`update public.team_tactical_presets set videos = '[{"provider":"tiktok","url":"https://tiktok.com/x","title":"t","start_s":0}]'::jsonb where id = '{preset_a}'`), MED],
    ['coach', "CHECK: provider 'sportmaps' sin asset_id (reservado M6h)", 'RECHAZAR',
        W(`update public.team_tactical_presets set videos = '[{"provider":"sportmaps","title":"t","start_s":0}]'::jsonb where id = '{preset_a}'`), MED],
    ['parent', 'padre de A escribe notas en una jugada de A', 'RECHAZAR',
        W(`update public.match_lineups set notes = ${NOTA_OK} where id = '{ml_a}'`), MED],
    ['coach', 'CHECK: ejercicio con board.notes inválido', 'RECHAZAR',
        UPD_EJ('{ex_a_coach}', `board = board || '{"notes":{"text":7}}'::jsonb`), MED],
    ['coach', 'insert_exercise_into_session_block copia board.notes/videos a la jugada del bloque', 'ACEPTAR',
        RPC_INS('{ex_a_media}', 'null', `'{team_a}'::uuid`),
        { ...MED, chk: `select (count(*) = 1)::int from public.match_lineups where school_id = '{sch_a}' and notes ->> 'text' = '**Salida** por derecha' and jsonb_array_length(videos) = 2 and updated_at >= now() - interval '1 minute'` }],
    // Invariantes estáticos de la tabla nueva.
    ['postgres', 'tactical_saved_videos: RLS activa, sin FOR ALL y ninguna policy de escritura con user_school_ids()', 'ACEPTAR',
        `select ((select relrowsecurity from pg_class where oid = 'public.tactical_saved_videos'::regclass) and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tactical_saved_videos' and (cmd = 'ALL' or (cmd <> 'SELECT' and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'user_school_ids\\(')) ))::int`, MED],
    ['postgres', 'tactical_saved_videos: INSERT/UPDATE con WITH CHECK táctico', 'ACEPTAR',
        `select (count(*) = 2)::int from pg_policies where schemaname = 'public' and tablename = 'tactical_saved_videos' and cmd in ('INSERT', 'UPDATE') and with_check ~ 'user_tactical_edit_school_ids'`, MED],
    ['postgres', 'anon sin ningún privilegio en tactical_saved_videos', 'ACEPTAR',
        `select (not exists (select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p where has_table_privilege('anon', 'public.tactical_saved_videos', p)))::int`, MED],
    ['postgres', 'CHECK de forma de notes/videos en las tres tablas de jugadas', 'ACEPTAR',
        `select (count(*) = 3)::int from pg_constraint where contype = 'c' and conname in ('match_lineups_media_shape_check', 'team_tactical_presets_media_shape_check', 'training_exercises_board_media_check')`, MED],
    ...['public.tactical_video_url_ok(text,text)', 'public.tactical_video_ok(text,text,text,text,text,text,integer,integer)',
        'public.tactical_play_notes_ok(jsonb)', 'public.tactical_play_videos_ok(jsonb)'].map((firma) =>
        ['postgres', `${firma.split('(')[0]}: search_path fijo y sin EXECUTE para anon`, 'ACEPTAR',
            `select ((select exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%pg_temp%') from pg_proc p where p.oid = '${firma}'::regprocedure) and not has_function_privilege('anon', '${firma}', 'EXECUTE'))::int`, MED]),
];

// ─────────────────────────────────────────────────────────────────────────────
// Bloque DO: descubrimiento de actores + fixtures + casos, todo abortado al final.
// ─────────────────────────────────────────────────────────────────────────────
function construirSql() {
    const casos = CASOS.map(([actor, nombre, esperado, sql, extra = {}], i) => {
        const texto = `${sql} ${extra.chk ?? ''} {${actor}}`;
        const needs = [...new Set([...texto.matchAll(/\{([a-z_0-9]+)\}/g)].map((m) => m[1]))]
            .filter((k) => !['postgres', 'anon'].includes(k));
        return { i, actor, sql, chk: extra.chk ?? null, needs, requiere: extra.requiere ?? null };
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
  v_schb uuid; v_staffb uuid; v_id uuid; pasada int; v_rep uuid; v_schr uuid;
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

  -- Staff que NO gestiona (ni admin ni táctico: p. ej. reporter), en cualquier
  -- escuela R. Opcional: si no hay, sus casos se omiten.
  FOR m IN SELECT sm.profile_id, sm.school_id FROM public.school_members sm
            WHERE sm.status = 'active'
              AND sm.role NOT IN ('parent', 'athlete', 'accountant', 'owner', 'admin', 'school_admin', 'super_admin', 'coach')
              AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = sm.profile_id)
            ORDER BY sm.role, sm.profile_id
  LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', m.profile_id, 'role', 'authenticated')::text, true);
    IF NOT public.is_super_admin()
       AND m.school_id = ANY (public.user_staff_school_ids())
       AND NOT (m.school_id = ANY (public.user_admin_school_ids()))
       AND NOT (m.school_id = ANY (public.user_tactical_edit_school_ids())) THEN
      v_rep := m.profile_id; v_schr := m.school_id; EXIT;
    END IF;
  END LOOP;
  PERFORM set_config('request.jwt.claims', '', true);

  ids := jsonb_strip_nulls(jsonb_build_object(
    'sch_a', v_sch, 'sch_b', v_schb, 'coach', v_coach, 'owner', v_owner, 'parent', v_parent,
    'athlete', v_athlete, 'nontac', v_nontac, 'staff_b', v_staffb, 'reporter', v_rep, 'sch_r', v_schr));

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

  -- Paquetes (M2): solo si la migración está aplicada. SQL dinámico para que
  -- el bloque compile aunque las tablas no existan.
  IF to_regclass('public.exercise_packs') IS NOT NULL THEN
    EXECUTE 'SELECT id FROM public.exercise_packs WHERE school_id IS NULL AND is_active ORDER BY id LIMIT 1' INTO v_id;
    ids := ids || jsonb_strip_nulls(jsonb_build_object('pk_sys', v_id));
    EXECUTE 'SELECT id FROM public.exercise_packs WHERE school_id IS NULL AND is_active ORDER BY id OFFSET 1 LIMIT 1' INTO v_id;
    ids := ids || jsonb_strip_nulls(jsonb_build_object('pk_sys2', v_id));
    EXECUTE 'INSERT INTO public.exercise_packs (school_id, sport, name, created_by) VALUES ($1, ''futbol'', ''RLS paquete de A'', $2) RETURNING id'
      INTO v_id USING v_sch, v_coach;
    ids := ids || jsonb_build_object('pk_a', v_id);
    EXECUTE 'INSERT INTO public.exercise_packs (school_id, sport, name, created_by) VALUES ($1, ''futbol'', ''RLS paquete de B'', $2) RETURNING id'
      INTO v_id USING v_schb, v_staffb;
    ids := ids || jsonb_build_object('pk_b', v_id);
    IF ids ? 'pk_sys' THEN
      -- A tiene activado pk_sys (y pk_sys2 no): para leer y desactivar.
      EXECUTE 'DELETE FROM public.school_exercise_packs WHERE school_id = $1' USING v_sch;
      EXECUTE 'INSERT INTO public.school_exercise_packs (school_id, pack_id, activated_by) VALUES ($1, $2, $3)'
        USING v_sch, (ids->>'pk_sys')::uuid, v_owner;
      IF v_schr IS NOT NULL THEN
        EXECUTE 'INSERT INTO public.school_exercise_packs (school_id, pack_id, activated_by) VALUES ($1, $2, NULL) ON CONFLICT DO NOTHING'
          USING v_schr, (ids->>'pk_sys')::uuid;
      END IF;
    END IF;
  END IF;

  -- IA, cupo por costo real (20261014155445): solo si está aplicada.
  IF to_regclass('public.tactical_ai_user_usage') IS NOT NULL THEN
    EXECUTE $f$
      INSERT INTO public.tactical_ai_school_usage (school_id, period, ceiling_micro_usd, used_micro_usd)
      VALUES ($1, public.tactical_ai_current_period(), 10000000, 300000),
             ($2, public.tactical_ai_current_period(), 10000000, 10000000)
      ON CONFLICT (school_id, period) DO UPDATE SET used_micro_usd = EXCLUDED.used_micro_usd, reserved_micro_usd = 0, extra_micro_usd = 0$f$
      USING v_sch, v_schb;
    EXECUTE $f$
      INSERT INTO public.tactical_ai_user_usage (school_id, user_id, period, budget_micro_usd, used_micro_usd, analyses)
      VALUES ($1, $2, public.tactical_ai_current_period(), 1000000, 200000, 3),
             ($1, $3, public.tactical_ai_current_period(), 1000000, 100000, 1),
             ($4, $5, public.tactical_ai_current_period(), 1000000, 0, 0)
      ON CONFLICT (school_id, user_id, period) DO NOTHING$f$
      USING v_sch, v_coach, v_owner, v_schb, v_staffb;
    EXECUTE $f$DELETE FROM public.tactical_ai_user_usage WHERE school_id = $1 AND user_id = $2$f$ USING v_sch, v_parent;
    EXECUTE $f$
      INSERT INTO public.tactical_ai_runs (school_id, user_id, period, sport, status, cost_micro_usd, finished_at)
      VALUES ($1, $2, public.tactical_ai_current_period(), 'futbol', 'settled', 64000, now())$f$
      USING v_sch, v_coach;
    EXECUTE $f$
      INSERT INTO public.tactical_ai_grants (school_id, user_id, period, amount_micro_usd, note)
      VALUES ($1, $2, public.tactical_ai_current_period(), 500000, 'RLS pizarra')$f$
      USING v_sch, v_coach;
  END IF;

  -- Videos guardados (M6c): solo si la migración está aplicada (SQL dinámico).
  IF to_regclass('public.tactical_saved_videos') IS NOT NULL THEN
    EXECUTE 'INSERT INTO public.tactical_saved_videos (school_id, provider, video_id, title, start_s, created_by) VALUES ($1, ''youtube'', ''dQw4w9WgXcQ'', ''RLS A'', 1, $2) RETURNING id'
      INTO v_id USING v_sch, v_coach;
    ids := ids || jsonb_build_object('vid_a', v_id);
    EXECUTE 'INSERT INTO public.tactical_saved_videos (school_id, provider, video_id, title, start_s, created_by) VALUES ($1, ''youtube'', ''dQw4w9WgXcQ'', ''RLS B'', 1, $2) RETURNING id'
      INTO v_id USING v_schb, v_staffb;
    ids := ids || jsonb_build_object('vid_b', v_id);
    -- Ejercicio de A con nota y videos en board (para la copia de la RPC).
    INSERT INTO public.training_exercises (school_id, created_by, name, board)
    VALUES (v_sch, v_coach, 'RLS pizarra · con notas',
            '{"players":[{"key":"slot#0","slot_label":"Pivote","x":50,"y":50}],"notes":{"text":"**Salida** por derecha","tags":["presión"]},"videos":[{"provider":"youtube","video_id":"dQw4w9WgXcQ","title":"Clip","start_s":90,"end_s":null,"is_private":false},{"provider":"veo","url":"https://app.veo.co/matches/abc-123/","title":"Partido","start_s":0,"is_private":true}]}')
    RETURNING id INTO v_id;
    ids := ids || jsonb_build_object('ex_a_media', v_id);
    IF v_schr IS NOT NULL THEN
      EXECUTE 'INSERT INTO public.tactical_saved_videos (school_id, provider, video_id, title, start_s) VALUES ($1, ''youtube'', ''dQw4w9WgXcQ'', ''RLS R'', 2) RETURNING id'
        INTO v_id USING v_schr;
      ids := ids || jsonb_build_object('vid_r', v_id);
    END IF;
  END IF;

  -- ── Casos: cada uno en su subbloque, que SIEMPRE termina en excepción ─────
  FOR c IN SELECT * FROM jsonb_to_recordset($casos$${json}$casos$::jsonb)
                    AS x(i int, actor text, sql text, chk text, needs text[], requiere text)
  LOOP
    IF c.requiere IS NOT NULL AND to_regclass(c.requiere) IS NULL THEN
      res := res || jsonb_build_array(jsonb_build_object('i', c.i, 'pendiente', c.requiere));
      CONTINUE;
    END IF;
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
for (const k of ['sch_a', 'coach', 'owner', 'nontac', 'parent', 'athlete', 'sch_b', 'staff_b', 'reporter', 'sch_r', 'ses_a', 'ses_b']) {
    const extra = k === 'nontac' && nontacRol ? `  (rol ${nontacRol})` : '';
    console.log(`  ${k.padEnd(8)} ${ids[k] ?? '— (no hay; sus casos se omiten)'}${extra}`);
}
console.log('');

let fallas = 0;
let pendientes = 0;
let omitidos = 0;
let sinAplicar = 0;
const porIndice = new Map(res.map((r) => [r.i, r]));
CASOS.forEach(([actor, nombre, esperado, , extra = {}], i) => {
    const r = porIndice.get(i);
    if (r?.pendiente) {
        sinAplicar++;
        console.log(`⏸️  [${esperado}] (${actor}) ${nombre}  [esperado tras ${extra.tras}]  →  omitido: ${r.pendiente} no existe (migración sin aplicar)`);
        return;
    }
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
console.log(`${total - fallas - pendientes - omitidos - sinAplicar} de ${total} casos como se esperaba · ${pendientes} hueco(s) conocido(s) pendiente(s) de migración · ${fallas} falla(s) nueva(s) · ${omitidos} omitido(s) · ${sinAplicar} a la espera de ${MIG_PAQUETES} sin aplicar (no cuentan como falla).`);
console.log('Nada quedó escrito: el lote corrió en una sola sentencia que terminó en RAISE EXCEPTION.');
process.exit(fallas + pendientes > 0 ? 1 : 0);
