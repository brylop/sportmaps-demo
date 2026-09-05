-- =============================================================================
-- 20260904131122_articulos_escolares_admin_read_rpc.sql
-- Autor: brylop   Fecha: 2026-09-04   Versión anterior: 20260904131122 (self)
-- Objetivo: corrige un bug real encontrado al capturar el panel interno para el
--   manual — school_settings NO tiene ninguna policy de SELECT para
--   is_super_admin() (solo is_school_admin()/owner_id), así que
--   AdminSubscriptionsPage.tsx leía merchandise_enabled y siempre recibía NULL
--   (0 filas por RLS, sin error) → el toggle se veía apagado aunque en la base
--   estuviera en true. NO se toca la RLS de school_settings (blast radius
--   grande, muchas policies ya conviven ahí) — se resuelve con una RPC de
--   lectura acotada, mismo patrón que admin_set_school_merchandise_enabled.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_get_school_merchandise_enabled(p_school_id uuid)
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

  SELECT merchandise_enabled INTO v_enabled
  FROM public.school_settings WHERE school_id = p_school_id;

  RETURN COALESCE(v_enabled, false);
END;
$$;

COMMENT ON FUNCTION public.admin_get_school_merchandise_enabled(uuid) IS
  'Lee merchandise_enabled para el panel interno. school_settings no tiene policy de SELECT para is_super_admin(), solo is_school_admin()/owner — sin esta RPC el panel leía NULL siempre.';

REVOKE ALL ON FUNCTION public.admin_get_school_merchandise_enabled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_school_merchandise_enabled(uuid) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
