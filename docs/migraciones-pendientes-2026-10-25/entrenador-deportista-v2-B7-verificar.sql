-- =============================================================================
-- Verificación de 20261025013621_v2_b7_alcance_y_validaciones (DESPUÉS de aplicarla)
-- Escuela demo «Club Campestre Demo» 25a123f0-6d57-48a4-9800-7b1531d61cd2
--   coach  entrenador.tenis@demo.sportmaps.co  32224bb8-b647-45d9-8027-768574584a10
--          dirige Tenis (4 equipos) + 658d014e-26b9-44dd-bfde-8eed0a3a14ac (team_coaches)
--   dueña  6e1eaeec-daa6-4bd0-a12e-8b9de37a899a
--   equipo AJENO al coach: Golf — Adultos 0dab090e-e00a-4a6c-8eb8-9192feb208fb
--
-- Cada PRUEBA se pega y corre SOLA: todas terminan en ROLLBACK (no queda nada).
-- El editor de Supabase se detiene en el primer error: en las pruebas cuyo
-- resultado esperado ES un error, ese error es la última sentencia, y como la
-- RPC lanza ANTES de escribir, «no entra ni avisa» queda garantizado.
-- =============================================================================

-- ── PRUEBA 1 · A1: coach consulta un equipo que no dirige → ERROR 42501 ─────
begin;
select set_config('request.jwt.claims', json_build_object('sub','32224bb8-b647-45d9-8027-768574584a10','role','authenticated')::text, true);
set local role authenticated;
select * from public.team_payment_status('0dab090e-e00a-4a6c-8eb8-9192feb208fb');
-- ESPERADO: ERROR 42501  No diriges este equipo
rollback;

-- ── PRUEBA 2 · A1: su equipo sí; con coach_hide_financial_info → 0 filas; la dueña ve todo
begin;
update public.school_settings set coach_hide_financial_info = false
 where school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2';
select set_config('request.jwt.claims', json_build_object('sub','32224bb8-b647-45d9-8027-768574584a10','role','authenticated')::text, true);
set local role authenticated;
select 'coach, flag off' caso, count(*) filas from public.team_payment_status('658d014e-26b9-44dd-bfde-8eed0a3a14ac');  -- > 0
reset role;
update public.school_settings set coach_hide_financial_info = true
 where school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2';
set local role authenticated;
select 'coach, flag on' caso, count(*) filas from public.team_payment_status('658d014e-26b9-44dd-bfde-8eed0a3a14ac');   -- 0
select set_config('request.jwt.claims', json_build_object('sub','6e1eaeec-daa6-4bd0-a12e-8b9de37a899a','role','authenticated')::text, true);
select 'duena, flag on' caso, count(*) filas from public.team_payment_status('0dab090e-e00a-4a6c-8eb8-9192feb208fb');   -- > 0
rollback;

-- ── PRUEBA 3 · B2: coach pide callup_status de una convocatoria de Golf → ERROR 42501
begin;
insert into public.match_results (id, school_id, team_id, opponent, match_date, status)
values ('b7b7b7b7-0000-4000-8000-000000000001', '25a123f0-6d57-48a4-9800-7b1531d61cd2',
        '0dab090e-e00a-4a6c-8eb8-9192feb208fb', 'Prueba B7', current_date + 3, 'scheduled');
select set_config('request.jwt.claims', json_build_object('sub','6e1eaeec-daa6-4bd0-a12e-8b9de37a899a','role','authenticated')::text, true);
set local role authenticated;
select public.save_match_roster('b7b7b7b7-0000-4000-8000-000000000001',
  '[{"subject_type":"profile","subject_id":"1d2d4142-c02a-4d79-96ac-61fdabc1f16b"}]'::jsonb);   -- 1 (la dueña)
select count(*) as duena_ve from public.callup_status(
  (select id from public.match_lineups where source_type='team_match' and source_id='b7b7b7b7-0000-4000-8000-000000000001'));  -- 1
select set_config('request.jwt.claims', json_build_object('sub','32224bb8-b647-45d9-8027-768574584a10','role','authenticated')::text, true);
select * from public.callup_status(
  (select id from public.match_lineups where source_type='team_match' and source_id='b7b7b7b7-0000-4000-8000-000000000001'));
-- ESPERADO: ERROR 42501  No diriges este equipo
rollback;

-- ── PRUEBA 4 · B1: coach felicita a un deportista de Golf → ERROR 42501 ─────
begin;
select set_config('request.jwt.claims', json_build_object('sub','32224bb8-b647-45d9-8027-768574584a10','role','authenticated')::text, true);
set local role authenticated;
select public.give_kudos('25a123f0-6d57-48a4-9800-7b1531d61cd2', null,
                         '1d2d4142-c02a-4d79-96ac-61fdabc1f16b', 'Prueba B7');
-- ESPERADO: ERROR 42501  Este deportista no es de tus equipos
rollback;

-- ── PRUEBA 4b · B1: a uno de SU equipo sí (control) ─────────────────────────
begin;
select set_config('request.jwt.claims', json_build_object('sub','32224bb8-b647-45d9-8027-768574584a10','role','authenticated')::text, true);
set local role authenticated;
select public.give_kudos('25a123f0-6d57-48a4-9800-7b1531d61cd2', '7167931e-0798-43e8-a286-d4985b0965b6',
                         null, 'Prueba B7') is not null as ok;   -- true
rollback;

-- ── PRUEBA 5 · M2: jugador de OTRA escuela en save_match_roster → ERROR 22023
begin;
insert into public.match_results (id, school_id, team_id, opponent, match_date, status)
values ('b7b7b7b7-0000-4000-8000-000000000002', '25a123f0-6d57-48a4-9800-7b1531d61cd2',
        '0dab090e-e00a-4a6c-8eb8-9192feb208fb', 'Prueba B7', current_date + 3, 'scheduled');
select set_config('request.jwt.claims', json_build_object('sub','6e1eaeec-daa6-4bd0-a12e-8b9de37a899a','role','authenticated')::text, true);
set local role authenticated;
select public.save_match_roster('b7b7b7b7-0000-4000-8000-000000000002',
  '[{"subject_type":"profile","subject_id":"1d2d4142-c02a-4d79-96ac-61fdabc1f16b"},
    {"subject_type":"child","subject_id":"33052f11-2fa9-4ae0-ab0a-09f7f29a0347"}]'::jsonb);
-- ESPERADO: ERROR 22023  1 deportista(s) de la lista no pertenecen a esta escuela
-- (lanza antes de crear la convocatoria, insertar jugadores o avisar).
rollback;

-- ── PRUEBA 5b · M2: misma lista sin el ajeno → entra y avisa solo a los de casa
begin;
insert into public.match_results (id, school_id, team_id, opponent, match_date, status)
values ('b7b7b7b7-0000-4000-8000-000000000002', '25a123f0-6d57-48a4-9800-7b1531d61cd2',
        '0dab090e-e00a-4a6c-8eb8-9192feb208fb', 'Prueba B7', current_date + 3, 'scheduled');
select set_config('request.jwt.claims', json_build_object('sub','6e1eaeec-daa6-4bd0-a12e-8b9de37a899a','role','authenticated')::text, true);
set local role authenticated;
select public.save_match_roster('b7b7b7b7-0000-4000-8000-000000000002',
  '[{"subject_type":"profile","subject_id":"1d2d4142-c02a-4d79-96ac-61fdabc1f16b"}]'::jsonb) as jugadores;  -- 1
reset role;
select count(*) as avisos_al_ajeno from public.notifications
 where user_id = (select parent_id from public.children where id = '33052f11-2fa9-4ae0-ab0a-09f7f29a0347')
   and category = 'match' and created_at >= now();                                                          -- 0
select count(*) as avisos_al_convocado from public.notifications
 where user_id = '1d2d4142-c02a-4d79-96ac-61fdabc1f16b' and category = 'match' and created_at >= now();    -- 1
rollback;

-- ── PRUEBA 6 · M1: deportista con cuenta MENOR → has_account=false y no puede responder
-- 86ad270d (1998) se vuelve menor SOLO dentro de esta transacción.
begin;
update public.profiles set date_of_birth = current_date - interval '15 years'
 where id = '86ad270d-593e-431a-9efb-6dd95eb611a9';
insert into public.match_results (id, school_id, team_id, opponent, match_date, status)
values ('b7b7b7b7-0000-4000-8000-000000000003', '25a123f0-6d57-48a4-9800-7b1531d61cd2',
        '237af3bc-9ede-4a70-9981-67a7563e3152', 'Prueba B7', current_date + 3, 'scheduled');
select set_config('request.jwt.claims', json_build_object('sub','6e1eaeec-daa6-4bd0-a12e-8b9de37a899a','role','authenticated')::text, true);
set local role authenticated;
select public.save_match_roster('b7b7b7b7-0000-4000-8000-000000000003',
  '[{"subject_type":"profile","subject_id":"86ad270d-593e-431a-9efb-6dd95eb611a9"}]'::jsonb);   -- 1
select subject_type, has_account from public.callup_status(
  (select id from public.match_lineups where source_type='team_match' and source_id='b7b7b7b7-0000-4000-8000-000000000003'));
-- ESPERADO: profile | false
select set_config('request.jwt.claims', json_build_object('sub','86ad270d-593e-431a-9efb-6dd95eb611a9','role','authenticated')::text, true);
select public.respond_callup(
  (select id from public.match_lineups where source_type='team_match' and source_id='b7b7b7b7-0000-4000-8000-000000000003'),
  null, '86ad270d-593e-431a-9efb-6dd95eb611a9', 'va');
-- ESPERADO: ERROR 42501  Eres menor de edad: la convocatoria la responde tu acudiente…
rollback;

-- ── PRUEBA 7 · b9: tipos del aviso de calendario (sin datos) ────────────────
select public._calendar_event_kind('training', 'Juegos predeportivos')       as entrenamiento_1,
       public._calendar_event_kind('training', 'Pruebas físicas y técnicas') as entrenamiento_2,
       public._calendar_event_kind('training', 'PARTIDO LIGA PREJUVENIL')    as partido_1,
       public._calendar_event_kind('training', 'Final copa Ciudad')          as partido_2,
       public._calendar_event_kind('training', 'Copa Ciudad')                as competencia,
       public._calendar_event_kind('training', 'Evaluación trimestral')      as evaluacion;

-- ── Catálogo (sin sesión) ───────────────────────────────────────────────────
select proname, pg_get_function_identity_arguments(oid) args, prosecdef, proconfig, proacl
  from pg_proc
 where proname in ('team_payment_status','callup_status','give_kudos','respond_callup','save_match_roster',
                   '_calendar_event_kind','_v2_alcance_entrenador','_v2_sujeto_en_equipos',
                   '_v2_sujeto_en_escuela','_v2_perfil_menor')
 order by 1;
-- ESPERADO: las 5 RPC con authenticated=X y sin anon; los 4 _v2_* y
-- _calendar_event_kind solo postgres/service_role.
