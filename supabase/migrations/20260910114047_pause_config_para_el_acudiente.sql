-- =============================================================================
-- 20260910114047_pause_config_para_el_acudiente.sql
-- Autor: brylop   Fecha: 2026-09-10   Versión anterior: 20260910082720
-- Objetivo: Fase 3 de docs/specs/pausa-vacaciones-enrollments.md.
--
-- APLICADA EN LA BASE 2026-09-10 vía `apply_migration`.
-- =============================================================================
--
-- POR QUÉ ESTA RPC EXISTE
--
-- La UI del acudiente tiene que saber dos cosas antes de mostrar el botón
-- «Solicitar pausa»: `school_settings.pause_enabled` y
-- `pause_parent_can_request`.
--
-- Leerlas directo desde el frontend depende de la RLS de `school_settings`,
-- cuya policy de lectura es `school_id = ANY(user_school_ids())`. Y
-- `user_school_ids()` **NO contempla al acudiente**: solo `school_members` y
-- `school_staff`.
--
-- Hoy funcionaría por accidente —379 de 379 pares (acudiente, escuela) tienen
-- fila en `school_members`, 378 de ellas activa— pero al que no la tenga activa
-- el botón le desaparecería sin explicación y nadie se enteraría. Es exactamente
-- el modo de falla silenciosa que ya costó caro en este repo.
--
-- Con esta RPC la autorización es explícita: el acudiente del menor, el atleta
-- adulto dueño de la inscripción, o un admin de la escuela. Sin membresías de
-- por medio.
--
-- Devuelve `enabled=false` en vez de fallar cuando la escuela no tiene fila en
-- `school_settings` (hay escuelas sin ella): sin config no hay pausa, y eso es
-- lo correcto — fail-closed.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito (SECURITY DEFINER no exime al caller).
--   · REVOKE incluye PUBLIC.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.pause_config_for_enrollment(p_enrollment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_e      record;
  v_cfg    record;
  v_caller uuid := auth.uid();
BEGIN
  SELECT e.school_id, e.child_id, e.user_id, e.status
    INTO v_e
  FROM public.enrollments e WHERE e.id = p_enrollment_id;

  IF v_e.school_id IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'parent_can_request', false, 'max_months', 0);
  END IF;

  -- Autorización explícita, sin pasar por user_school_ids().
  IF v_caller IS NOT NULL
     AND NOT COALESCE(public.is_super_admin(), false)
     AND NOT COALESCE(public.is_school_admin(v_e.school_id), false)
     AND NOT (v_e.child_id IS NOT NULL AND COALESCE(public.is_parent_of_child(v_e.child_id), false))
     AND NOT (v_e.user_id IS NOT NULL AND v_e.user_id = v_caller) THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT COALESCE(ss.pause_enabled, false)            AS enabled,
         COALESCE(ss.pause_parent_can_request, true)  AS parent_can_request,
         COALESCE(ss.pause_max_months_per_year, 2)    AS max_months
    INTO v_cfg
  FROM public.school_settings ss WHERE ss.school_id = v_e.school_id;

  RETURN jsonb_build_object(
    'enabled',            COALESCE(v_cfg.enabled, false),
    'parent_can_request', COALESCE(v_cfg.parent_can_request, false),
    'max_months',         COALESCE(v_cfg.max_months, 0),
    -- Solo tiene sentido pausar una inscripción activa; que lo diga la base y
    -- no que la UI lo adivine.
    'enrollment_active',  (v_e.status = 'active')
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.pause_config_for_enrollment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pause_config_for_enrollment(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.pause_config_for_enrollment(uuid) IS
  'Config de pausa (enabled / parent_can_request / max_months / enrollment_active) de la escuela de una inscripcion, para que la UI del acudiente decida si muestra el boton "Solicitar pausa". Existe porque la policy de lectura de school_settings usa user_school_ids(), que NO contempla al acudiente. Autoriza al acudiente del menor, al atleta adulto dueno, o a un admin. Fail-closed: sin fila de settings devuelve enabled=false.';

COMMIT;
