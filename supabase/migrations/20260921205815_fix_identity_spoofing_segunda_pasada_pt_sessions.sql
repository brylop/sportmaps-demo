-- =============================================================================
-- 20260921205815_fix_identity_spoofing_segunda_pasada_pt_sessions.sql
-- Autor: brylop   Fecha: 2026-09-22   Versión anterior: 20260921205037
-- Objetivo: segunda pasada sobre get_advisors buscando el MISMO patrón ya
-- encontrado 2 veces (identidad como parámetro sin contrastar auth.uid()),
-- vía SQL directo sobre pg_proc en vez de revisar función por función:
-- SECURITY DEFINER + EXECUTE a authenticated + un parámetro tipo identidad
-- + CERO referencias a auth.uid() en el cuerpo.
--
-- 1) fn_cancel_pt_session, fn_complete_session_plan: mismo bug que
--    fn_delete_self_assigned_session/fn_unassign_gym_session/
--    fn_create_plan_from_routine (fix de la migración 20260919194528),
--    mismo fix: auth.role() para distinguir service_role (BFF, confía en el
--    parámetro) de authenticated directo por REST (ancla a auth.uid()).
--
-- 2) Regresión de GRANT descubierta de paso: provision_personal_trainer_workspace
--    y release_settlements_for_vendor ya habían sido revocadas de
--    anon/authenticated en 20260513000005_linter_fase3bcd_revoke_rpcs.sql,
--    pero el linter las vuelve a ver abiertas hoy. Es el mismo patrón de
--    regresión silenciosa que ya afectó a school_athletes (vistas, agosto):
--    en Postgres, CREATE FUNCTION otorga EXECUTE a PUBLIC por defecto, así
--    que cualquier CREATE OR REPLACE FUNCTION posterior sin repetir el
--    REVOKE reabre el acceso (CLAUDE.md ya lo documenta como regla general).
--    No hay ningún caller real en frontend/ ni bff/ para ninguna de las dos
--    (grep confirmado) — provision_personal_trainer_workspace es huérfana
--    hoy, y release_settlements_for_vendor solo se llama desde DENTRO de
--    release_settlements_all() (llamada anidada de función a función: corre
--    con los privilegios del dueño de la función exterior, no necesita
--    EXECUTE explícito del rol original). Se revoca de nuevo.
--
-- 3) Blindaje contra que esto vuelva a pasar: las 5 funciones tocadas en
--    20260919194236/20260919194528 (fn_delete_self_assigned_session,
--    fn_unassign_gym_session, fn_create_plan_from_routine, unblock_payment,
--    is_school_admin_of) quedaron con EXECUTE abierto a `anon` (nunca hace
--    falta: las 5 exigen identidad). Se revoca `anon` en las 5, dejando
--    `authenticated` (uso real, directo o vía BFF) intacto.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

-- ── 1a) fn_cancel_pt_session ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_cancel_pt_session(p_plan_id uuid, p_caller_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_plan RECORD;
  v_role TEXT := auth.role();
BEGIN
  IF v_role = 'authenticated' THEN
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No autenticado.');
    END IF;
    p_caller_id := auth.uid();
  ELSIF v_role <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado.');
  END IF;

  SELECT * INTO v_plan
  FROM trainer_session_plans
  WHERE id = p_plan_id
    AND status = 'assigned';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión no encontrada o ya completada/cancelada.');
  END IF;

  IF v_plan.trainer_id != p_caller_id
     AND v_plan.booked_by != p_caller_id
     AND v_plan.client_id != p_caller_id
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin permisos para cancelar esta sesión.');
  END IF;

  UPDATE trainer_session_plans
  SET status     = 'cancelled',
      updated_at = now()
  WHERE id = p_plan_id;

  IF v_plan.enrollment_id IS NOT NULL THEN
    UPDATE enrollments
    SET sessions_used = GREATEST(0, COALESCE(sessions_used, 0) - 1),
        updated_at    = now()
    WHERE id = v_plan.enrollment_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'plan_id', p_plan_id);
END;
$function$;

-- ── 1b) fn_complete_session_plan ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_complete_session_plan(p_plan_id uuid, p_trainer_id uuid, p_results jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_plan               RECORD;
  v_block              JSONB;
  v_block_result       JSONB;
  v_stat_count         INTEGER := 0;
  v_i                  INTEGER;
  v_is_child           BOOLEAN := false;
  v_block_type         TEXT;
  v_block_name         TEXT;
  v_duration           NUMERIC;
  v_rpe                NUMERIC;
  v_weight             NUMERIC;
  v_weight_str         TEXT;
  v_client_in_profiles BOOLEAN := false;
  v_client_in_children BOOLEAN := false;
  v_school_id          UUID;
  v_role               TEXT := auth.role();
BEGIN
  IF v_role = 'authenticated' THEN
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No autenticado.');
    END IF;
    p_trainer_id := auth.uid();
  ELSIF v_role <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado.');
  END IF;

  SELECT * INTO v_plan
  FROM trainer_session_plans
  WHERE id = p_plan_id AND trainer_id = p_trainer_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan no encontrado o sin permisos');
  END IF;

  IF v_plan.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'El plan ya fue completado');
  END IF;

  v_school_id := v_plan.school_id;

  UPDATE trainer_session_plans
  SET status = 'completed', results = p_results, completed_at = now(), updated_at = now()
  WHERE id = p_plan_id;

  IF v_plan.routine_id IS NOT NULL THEN
    UPDATE trainer_routines SET times_used = times_used + 1, updated_at = now()
    WHERE id = v_plan.routine_id;
  END IF;

  IF v_plan.enrollment_id IS NOT NULL AND v_plan.booked_by IS NULL THEN
    UPDATE enrollments e
    SET sessions_used = COALESCE(e.sessions_used, 0) + 1,
        updated_at    = now()
    FROM offering_plans op
    WHERE e.id = v_plan.enrollment_id
      AND op.id = e.offering_plan_id
      AND op.max_sessions IS NOT NULL;
  END IF;

  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = v_plan.client_id) INTO v_client_in_profiles;
  SELECT EXISTS (SELECT 1 FROM children WHERE id = v_plan.client_id) INTO v_client_in_children;
  v_is_child := v_client_in_children AND NOT v_client_in_profiles;

  IF NOT v_client_in_profiles AND NOT v_client_in_children THEN
    RETURN jsonb_build_object('success', true, 'stats_created', 0, 'plan_id', p_plan_id,
      'note', 'Cliente no encontrado — estadísticas no generadas');
  END IF;

  IF p_results ? 'blocks_results' THEN
    FOR v_i IN 0..jsonb_array_length(p_results->'blocks_results') - 1 LOOP
      v_block_result := (p_results->'blocks_results')->v_i;
      v_block        := (v_plan.blocks)->(v_block_result->>'block_index')::int;
      v_block_type   := COALESCE(NULLIF(v_block_result->>'block_type',''), NULLIF(v_block->>'type',''), 'strength');
      v_block_name   := LOWER(REPLACE(COALESCE(v_block->>'name', 'ejercicio'), ' ', '_'));

      CASE v_block_type
        WHEN 'strength' THEN
          v_weight_str := regexp_replace(COALESCE(v_block_result->>'actual_weight',''), '[^0-9.]','','g');
          IF v_weight_str <> '' THEN
            v_weight := v_weight_str::numeric;
            IF v_weight > 0 AND v_weight < 1000 THEN
              IF v_is_child THEN
                INSERT INTO children_stats (child_id, school_id, stat_type, value, unit, notes, stat_date)
                VALUES (v_plan.client_id, v_school_id, 'fuerza_'||v_block_name, v_weight, 'kg', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
              ELSE
                INSERT INTO athlete_stats (athlete_id, school_id, stat_type, value, unit, notes, stat_date)
                VALUES (v_plan.client_id, v_school_id, 'fuerza_'||v_block_name, v_weight, 'kg', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
              END IF;
              v_stat_count := v_stat_count + 1;
            END IF;
          END IF;
          IF (v_block_result->>'actual_rpe') IS NOT NULL AND (v_block_result->>'actual_rpe') <> '' THEN
            v_rpe := (v_block_result->>'actual_rpe')::numeric;
            IF v_rpe >= 1 AND v_rpe <= 10 THEN
              IF v_is_child THEN
                INSERT INTO children_stats (child_id, school_id, stat_type, value, unit, notes, stat_date)
                VALUES (v_plan.client_id, v_school_id, 'rpe_fuerza_'||v_block_name, v_rpe, 'rpe', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
              ELSE
                INSERT INTO athlete_stats (athlete_id, school_id, stat_type, value, unit, notes, stat_date)
                VALUES (v_plan.client_id, v_school_id, 'rpe_fuerza_'||v_block_name, v_rpe, 'rpe', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
              END IF;
              v_stat_count := v_stat_count + 1;
            END IF;
          END IF;

        WHEN 'cardio' THEN
          v_duration := COALESCE(NULLIF(v_block_result->>'duration_minutes','')::numeric, NULLIF(v_block->>'duration_minutes','')::numeric);
          IF v_duration IS NOT NULL AND v_duration > 0 AND v_duration < 600 THEN
            IF v_is_child THEN
              INSERT INTO children_stats (child_id, school_id, stat_type, value, unit, notes, stat_date)
              VALUES (v_plan.client_id, v_school_id, 'cardio_'||v_block_name, v_duration, 'min', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
            ELSE
              INSERT INTO athlete_stats (athlete_id, school_id, stat_type, value, unit, notes, stat_date)
              VALUES (v_plan.client_id, v_school_id, 'cardio_'||v_block_name, v_duration, 'min', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
            END IF;
            v_stat_count := v_stat_count + 1;
          END IF;

        WHEN 'hiit' THEN
          IF (v_block_result->>'actual_rpe') IS NOT NULL AND (v_block_result->>'actual_rpe') <> '' THEN
            v_rpe := (v_block_result->>'actual_rpe')::numeric;
            IF v_rpe >= 1 AND v_rpe <= 10 THEN
              IF v_is_child THEN
                INSERT INTO children_stats (child_id, school_id, stat_type, value, unit, notes, stat_date)
                VALUES (v_plan.client_id, v_school_id, 'hiit_'||v_block_name, v_rpe, 'rpe', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
              ELSE
                INSERT INTO athlete_stats (athlete_id, school_id, stat_type, value, unit, notes, stat_date)
                VALUES (v_plan.client_id, v_school_id, 'hiit_'||v_block_name, v_rpe, 'rpe', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
              END IF;
              v_stat_count := v_stat_count + 1;
            END IF;
          END IF;

        WHEN 'flexibility' THEN
          v_duration := COALESCE(NULLIF(v_block_result->>'duration_minutes','')::numeric, NULLIF(v_block->>'duration_minutes','')::numeric);
          IF v_duration IS NOT NULL AND v_duration > 0 THEN
            IF v_is_child THEN
              INSERT INTO children_stats (child_id, school_id, stat_type, value, unit, notes, stat_date)
              VALUES (v_plan.client_id, v_school_id, 'flexibilidad_'||v_block_name, v_duration, 'min', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
            ELSE
              INSERT INTO athlete_stats (athlete_id, school_id, stat_type, value, unit, notes, stat_date)
              VALUES (v_plan.client_id, v_school_id, 'flexibilidad_'||v_block_name, v_duration, 'min', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
            END IF;
            v_stat_count := v_stat_count + 1;
          END IF;

        WHEN 'warmup' THEN
          v_duration := COALESCE(NULLIF(v_block_result->>'duration_minutes','')::numeric, NULLIF(v_block->>'duration_minutes','')::numeric);
          IF v_duration IS NOT NULL AND v_duration > 0 AND v_duration < 60 THEN
            IF v_is_child THEN
              INSERT INTO children_stats (child_id, school_id, stat_type, value, unit, notes, stat_date)
              VALUES (v_plan.client_id, v_school_id, 'calentamiento_'||v_block_name, v_duration, 'min', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
            ELSE
              INSERT INTO athlete_stats (athlete_id, school_id, stat_type, value, unit, notes, stat_date)
              VALUES (v_plan.client_id, v_school_id, 'calentamiento_'||v_block_name, v_duration, 'min', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
            END IF;
            v_stat_count := v_stat_count + 1;
          END IF;

        WHEN 'cooldown' THEN NULL;

        ELSE
          v_weight_str := regexp_replace(COALESCE(v_block_result->>'actual_weight',''), '[^0-9.]','','g');
          IF v_weight_str <> '' THEN
            v_weight := v_weight_str::numeric;
            IF v_weight > 0 AND v_weight < 1000 THEN
              IF v_is_child THEN
                INSERT INTO children_stats (child_id, school_id, stat_type, value, unit, notes, stat_date)
                VALUES (v_plan.client_id, v_school_id, 'fuerza_'||v_block_name, v_weight, 'kg', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
              ELSE
                INSERT INTO athlete_stats (athlete_id, school_id, stat_type, value, unit, notes, stat_date)
                VALUES (v_plan.client_id, v_school_id, 'fuerza_'||v_block_name, v_weight, 'kg', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
              END IF;
              v_stat_count := v_stat_count + 1;
            END IF;
          END IF;
      END CASE;
    END LOOP;
  END IF;

  IF p_results ? 'actual_duration_minutes'
     AND (p_results->>'actual_duration_minutes') IS NOT NULL
     AND (p_results->>'actual_duration_minutes') <> '' THEN
    IF v_is_child THEN
      INSERT INTO children_stats (child_id, school_id, stat_type, value, unit, notes, stat_date)
      VALUES (v_plan.client_id, v_school_id, 'duracion_sesion', (p_results->>'actual_duration_minutes')::numeric, 'min', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
    ELSE
      INSERT INTO athlete_stats (athlete_id, school_id, stat_type, value, unit, notes, stat_date)
      VALUES (v_plan.client_id, v_school_id, 'duracion_sesion', (p_results->>'actual_duration_minutes')::numeric, 'min', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
    END IF;
    v_stat_count := v_stat_count + 1;
  END IF;

  IF p_results ? 'actual_calories'
     AND (p_results->>'actual_calories') IS NOT NULL
     AND (p_results->>'actual_calories') <> ''
     AND (p_results->>'actual_calories')::numeric > 0 THEN
    IF v_is_child THEN
      INSERT INTO children_stats (child_id, school_id, stat_type, value, unit, notes, stat_date)
      VALUES (v_plan.client_id, v_school_id, 'calorias_sesion', (p_results->>'actual_calories')::numeric, 'kcal', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
    ELSE
      INSERT INTO athlete_stats (athlete_id, school_id, stat_type, value, unit, notes, stat_date)
      VALUES (v_plan.client_id, v_school_id, 'calorias_sesion', (p_results->>'actual_calories')::numeric, 'kcal', 'Sesión: '||COALESCE(v_plan.name, v_plan.session_date::text), v_plan.session_date);
    END IF;
    v_stat_count := v_stat_count + 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'stats_created', v_stat_count,
    'plan_id', p_plan_id,
    'client_type', CASE WHEN v_is_child THEN 'child' ELSE 'athlete' END
  );
END;
$function$;

-- ── 2) Regresión de GRANT: cerrar de nuevo lo que 20260513000005 ya cerró ──
REVOKE EXECUTE ON FUNCTION public.provision_personal_trainer_workspace(uuid, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_settlements_for_vendor(uuid)                          FROM anon, authenticated;

-- ── 3) Las 5 de esta sesión: nunca hace falta anon, todas exigen identidad ──
REVOKE EXECUTE ON FUNCTION public.fn_delete_self_assigned_session(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_unassign_gym_session(uuid, uuid)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_create_plan_from_routine(uuid, uuid, text, date, uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unblock_payment(text, uuid)                FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_school_admin_of(uuid, uuid)             FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_cancel_pt_session(uuid, uuid)           FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_complete_session_plan(uuid, uuid, jsonb) FROM anon;

COMMIT;
