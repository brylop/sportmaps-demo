-- =============================================================================
-- 20260919194528_hotfix_trainer_plans_service_role_broke.sql
-- Autor: brylop   Fecha: 2026-09-20   Versión anterior: 20260919194236
-- Objetivo: HOTFIX de la migración anterior (20260919194236), aplicada hace
-- minutos en la misma sesión. Esa migración ancló p_caller_id/p_trainer_id a
-- auth.uid() para cerrar el spoofing de identidad, pero las 3 funciones de
-- trainer_session_plans se llaman desde el BFF con el cliente de
-- SERVICE_ROLE (bff/src/config/supabase.ts) — ahí auth.uid() es SIEMPRE NULL
-- porque no hay un JWT de usuario en el request. El fix anterior devolvía
-- "No autenticado" para TODO llamado legítimo vía BFF, no solo para el
-- ataque. Nadie alcanzó a notarlo en producción/staging real (verificado acá
-- mismo, en la misma sesión que aplicó el bug).
--
-- Fix correcto: usar auth.role() (lee el claim `role` del JWT) para
-- distinguir los 3 casos reales:
--   - 'service_role' → es el BFF, que YA validó la identidad del usuario con
--     su propio middleware (requireAuth) antes de llamar al RPC. Se confía
--     en el parámetro, exactamente como se confiaba antes de 20260919194236.
--   - 'authenticated' → un usuario real llamando el RPC DIRECTO por REST
--     (`/rest/v1/rpc/...`), sin pasar por el BFF — este es el vector real
--     del hallazgo del linter (anon_security_definer_function_executable).
--     Acá SÍ se ancla a auth.uid(), ignorando el parámetro.
--   - cualquier otro caso (anon, o rol desconocido) → rechazado.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_delete_self_assigned_session(p_plan_id uuid, p_caller_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_plan RECORD;
  v_authorized BOOLEAN := false;
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
  -- service_role (el BFF): confía en p_caller_id, ya validado por su middleware.

  SELECT * INTO v_plan
  FROM trainer_session_plans
  WHERE id = p_plan_id
    AND assignment_source = 'self'
    AND status IN ('assigned', 'in_progress');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión no encontrada, no auto-asignada, o ya finalizada.');
  END IF;

  IF v_plan.client_type = 'child' THEN
    SELECT EXISTS (
      SELECT 1 FROM children c WHERE c.id = v_plan.client_id AND c.parent_id = p_caller_id
    ) INTO v_authorized;
  ELSE
    v_authorized := (v_plan.client_id = p_caller_id);
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin permisos para eliminar esta sesión.');
  END IF;

  UPDATE trainer_session_plans
  SET status = 'cancelled', updated_at = now()
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

CREATE OR REPLACE FUNCTION public.fn_unassign_gym_session(p_plan_id uuid, p_caller_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_plan RECORD;
  v_authorized BOOLEAN := false;
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
    AND assignment_source = 'gym_staff'
    AND status IN ('assigned', 'in_progress');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión no encontrada, no asignada por el gimnasio, o ya finalizada.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM school_members sm
    WHERE sm.profile_id = p_caller_id
      AND sm.school_id = v_plan.school_id
      AND sm.status = 'active'
      AND sm.role IN ('owner','admin','coach','staff')
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin permisos para desasociar esta sesión.');
  END IF;

  UPDATE trainer_session_plans
  SET status = 'cancelled', updated_at = now()
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

CREATE OR REPLACE FUNCTION public.fn_create_plan_from_routine(p_routine_id uuid, p_client_id uuid, p_client_type text, p_session_date date, p_trainer_id uuid, p_school_id uuid, p_enrollment_id uuid DEFAULT NULL::uuid, p_assignment_source text DEFAULT 'pt'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_routine RECORD;
  v_plan_id UUID;
  v_resolved_enrollment_id UUID := p_enrollment_id;
  v_authorized BOOLEAN := false;
  v_role TEXT := auth.role();
BEGIN
  IF v_role = 'authenticated' THEN
    IF auth.uid() IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No autenticado.');
    END IF;
    p_trainer_id := auth.uid();
  ELSIF v_role <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado.');
  END IF;

  IF p_assignment_source NOT IN ('pt','gym_staff','self') THEN
    RETURN jsonb_build_object('success', false, 'error', 'assignment_source inválido');
  END IF;

  SELECT * INTO v_routine
  FROM public.trainer_routines
  WHERE id = p_routine_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rutina no encontrada');
  END IF;

  IF v_routine.trainer_id = p_trainer_id THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized AND v_routine.scope = 'global' THEN
    IF p_assignment_source = 'self' THEN
      v_authorized := (
        (p_client_type = 'child' AND EXISTS (
          SELECT 1 FROM public.children c WHERE c.id = p_client_id AND c.parent_id = p_trainer_id
        ))
        OR (p_client_type <> 'child' AND p_client_id = p_trainer_id)
      );
    ELSE
      v_authorized := true;
    END IF;
  END IF;

  IF NOT v_authorized AND v_routine.scope = 'school' AND v_routine.school_id = p_school_id
     AND p_assignment_source = 'gym_staff' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.school_members sm
      WHERE sm.profile_id = p_trainer_id
        AND sm.school_id = p_school_id
        AND sm.status = 'active'
        AND sm.role IN ('owner','admin','coach','staff')
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized AND v_routine.scope = 'school' AND v_routine.school_id = p_school_id
     AND p_assignment_source = 'self' AND v_routine.visible_to_athletes = true THEN
    IF p_client_type = 'child' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = p_client_id AND c.parent_id = p_trainer_id
      ) INTO v_authorized;
    ELSE
      v_authorized := (p_client_id = p_trainer_id);
    END IF;

    IF v_authorized THEN
      SELECT EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.school_id = p_school_id AND e.status = 'active'
          AND (
            (p_client_type = 'child' AND e.child_id = p_client_id)
            OR (p_client_type <> 'child' AND e.user_id = p_client_id)
          )
      ) INTO v_authorized;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rutina no encontrada');
  END IF;

  IF v_resolved_enrollment_id IS NULL THEN
    SELECT e.id INTO v_resolved_enrollment_id
    FROM enrollments e
    JOIN offering_plans op ON op.id = e.offering_plan_id
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND (
        (p_client_type = 'child'        AND e.child_id = p_client_id)
        OR (p_client_type = 'unregistered' AND e.unregistered_athlete_id = p_client_id)
        OR (p_client_type NOT IN ('child', 'unregistered')
            AND e.user_id = p_client_id AND e.child_id IS NULL)
      )
    ORDER BY e.created_at DESC
    LIMIT 1;
  END IF;

  INSERT INTO public.trainer_session_plans (
    school_id, trainer_id, client_id, client_type,
    routine_id, session_date, status, name, blocks,
    enrollment_id, assignment_source
  ) VALUES (
    p_school_id, p_trainer_id, p_client_id, p_client_type,
    p_routine_id, p_session_date, 'assigned',
    v_routine.name, v_routine.blocks,
    v_resolved_enrollment_id, p_assignment_source
  )
  RETURNING id INTO v_plan_id;

  RETURN jsonb_build_object(
    'success',       true,
    'plan_id',       v_plan_id,
    'name',          v_routine.name,
    'enrollment_id', v_resolved_enrollment_id
  );
END;
$function$;

COMMIT;
