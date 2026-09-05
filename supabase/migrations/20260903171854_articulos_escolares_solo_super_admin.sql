-- =============================================================================
-- 20260903171854_articulos_escolares_solo_super_admin.sql
-- Autor: brylop   Fecha: 2026-09-03   Versión anterior: 20260903150628
-- Objetivo: corrige Fase 1 de docs/specs/articulos-escolares-catalogo.md — el
--   catálogo de artículos lo administra SOLO el super admin de SportMaps
--   (panel interno), NUNCA el admin de la escuela. La Fase 1 original dejó
--   dos huecos:
--   1. school_merchandise_items: policy de escritura usaba is_school_admin().
--   2. school_settings.merchandise_enabled: la tabla YA tenía dos policies
--      FOR ALL preexistentes (is_school_admin + owner_id) que permiten
--      escribir CUALQUIER columna de su fila — incluida esta, sin que
--      existiera todavía ninguna UI que la usara. Al ser RLS de FILA, no de
--      COLUMNA, no se puede excluir una sola columna con una policy — se
--      cierra con un trigger BEFORE UPDATE que revierte el cambio si quien
--      escribe no es super admin.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- ── 1. school_merchandise_items: escritura solo super admin ─────────────────

DROP POLICY IF EXISTS school_merchandise_items_write ON public.school_merchandise_items;
CREATE POLICY school_merchandise_items_write ON public.school_merchandise_items
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Lectura: se agrega is_super_admin() explícito (antes solo is_school_admin
-- veía inactivos; el panel interno también necesita verlos para poder
-- editarlos). Los miembros de la escuela (padres/atletas) siguen viendo solo
-- los activos, sin cambio.
DROP POLICY IF EXISTS school_merchandise_items_select ON public.school_merchandise_items;
CREATE POLICY school_merchandise_items_select ON public.school_merchandise_items
  FOR SELECT
  USING (
    (active = true AND school_id = ANY (public.user_school_ids()))
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

-- ── 2. school_settings.merchandise_enabled: columna blindada ────────────────
--
-- No se puede resolver con una policy (RLS es de fila, la tabla ya tiene dos
-- policies FOR ALL que dejan escribir cualquier columna al admin/owner de la
-- escuela). Un trigger BEFORE UPDATE revierte esta columna puntual si quien
-- escribe no es super admin — el resto de la fila (wompi_enabled, cuentas de
-- pago, etc.) sigue editable por la escuela exactamente igual que hoy.
CREATE OR REPLACE FUNCTION public.guard_merchandise_enabled_super_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.merchandise_enabled IS DISTINCT FROM OLD.merchandise_enabled
     AND NOT public.is_super_admin() THEN
    NEW.merchandise_enabled := OLD.merchandise_enabled;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_merchandise_enabled_super_admin_only() IS
  'Revierte school_settings.merchandise_enabled si quien actualiza la fila no es super admin — la escuela puede seguir editando el resto de sus settings (wompi, cuentas de pago, etc.) sin restricción, solo esta columna queda blindada. Catálogo de artículos es control exclusivo del panel interno (spec articulos-escolares-catalogo.md §9.5).';

DROP TRIGGER IF EXISTS trg_guard_merchandise_enabled ON public.school_settings;
CREATE TRIGGER trg_guard_merchandise_enabled
  BEFORE UPDATE ON public.school_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_merchandise_enabled_super_admin_only();

-- ── 3. RPC para que el panel interno prenda/apague el toggle ────────────────
--
-- Mismo patrón que admin_set_school_module (AdminSubscriptionsPage): el
-- frontend nunca hace UPDATE directo a school_settings para esta columna,
-- pasa por una RPC gateada por is_super_admin().
CREATE OR REPLACE FUNCTION public.admin_set_school_merchandise_enabled(
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
  SET merchandise_enabled = p_enabled
  WHERE school_id = p_school_id;

  IF NOT FOUND THEN
    INSERT INTO public.school_settings (school_id, merchandise_enabled)
    VALUES (p_school_id, p_enabled);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.admin_set_school_merchandise_enabled(uuid, boolean) IS
  'Prende/apaga el catálogo de artículos para una escuela. Solo super admin — el toggle no es un addon comercial (school_addons), es control operativo del panel interno.';

REVOKE ALL ON FUNCTION public.admin_set_school_merchandise_enabled(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_merchandise_enabled(uuid, boolean) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ──────────────────────────────────────────
--
-- 1) Un admin de escuela ya NO puede prender merchandise_enabled a mano:
--    BEGIN; SET LOCAL ROLE authenticated;
--    SELECT set_config('request.jwt.claims', json_build_object('sub','<uuid admin escuela>','role','authenticated')::text, true);
--    UPDATE public.school_settings SET merchandise_enabled = true WHERE school_id = '<su escuela>';
--    SELECT merchandise_enabled FROM public.school_settings WHERE school_id = '<su escuela>'; -- debe seguir false
--    ROLLBACK;
--
-- 2) El admin de escuela SIGUE pudiendo editar otras columnas de su fila
--    (ej. wompi_enabled) sin que el trigger las toque.
--
-- 3) Un admin de escuela ya NO puede insertar/editar school_merchandise_items
--    de su propia escuela (antes sí podía).
--
-- 4) Solo super admin (platform_admins.is_active=true) puede llamar
--    admin_set_school_merchandise_enabled() y escribir el catálogo.
--
-- Vuelta atrás: migración nueva que DROP el trigger + la función guard +
-- la RPC, y repone las policies de Fase 1 (is_school_admin) si hiciera falta.
