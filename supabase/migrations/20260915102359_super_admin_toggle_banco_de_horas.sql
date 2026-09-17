-- =============================================================================
-- 20260915102359_super_admin_toggle_banco_de_horas.sql
-- Autor: brylop   Fecha: 2026-09-15   Versión anterior: 20260915101557
-- Objetivo: hasta la migración anterior, activar el banco de horas para una
-- escuela nueva era un UPDATE a mano de school_settings.hours_plan_enabled —
-- nada trazable ni accesible desde el panel. Mismo patrón que
-- admin_get/set_school_merchandise_enabled (20260903171854 / 20260904131122):
-- school_settings no tiene policy de SELECT para is_super_admin() (solo
-- is_school_admin()/owner), así que hace falta una RPC de lectura además de
-- la de escritura — un SELECT directo desde el panel devuelve NULL siempre,
-- no es un error, es RLS silenciosa.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_get_hours_plan_enabled(p_school_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT hours_plan_enabled INTO v_enabled
  FROM public.school_settings WHERE school_id = p_school_id;

  RETURN COALESCE(v_enabled, false);
END;
$$;

COMMENT ON FUNCTION public.admin_get_hours_plan_enabled(uuid) IS
  'Lee hours_plan_enabled para el panel interno. school_settings no tiene policy de SELECT para is_super_admin(), solo is_school_admin()/owner — sin esta RPC el panel leería NULL siempre.';

REVOKE ALL ON FUNCTION public.admin_get_hours_plan_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_hours_plan_enabled(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_hours_plan_enabled(
  p_school_id uuid,
  p_enabled   boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  UPDATE public.school_settings
  SET hours_plan_enabled = p_enabled
  WHERE school_id = p_school_id;

  IF NOT FOUND THEN
    INSERT INTO public.school_settings (school_id, hours_plan_enabled)
    VALUES (p_school_id, p_enabled);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.admin_set_hours_plan_enabled(uuid, boolean) IS
  'Prende/apaga el banco de horas (docs/specs/dreamers-banco-de-horas-torniquete.md) para una escuela. Solo super admin — get_or_open_hour_bank_period() (mig 20260915101557) usa este flag como gate real, un plan con included_minutes_per_period ya no alcanza solo.';

REVOKE ALL ON FUNCTION public.admin_set_hours_plan_enabled(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_hours_plan_enabled(uuid, boolean) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
