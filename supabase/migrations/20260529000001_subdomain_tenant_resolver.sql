-- ============================================================
-- SPORTMAPS — Subdominios multi-tenant (Fase 4)
--
-- Permite que cada escuela Pro+ tenga su propio subdominio
-- <slug>.sportmaps.co (ej. acruxgym.sportmaps.co).
--
-- Cambios:
--   1. RPC get_school_by_slug(p_slug) — resuelve school basics + branding
--      solo si la escuela tiene feature whitelabel (tier pro+).
--   2. RPC get_school_id_by_slug(p_slug) — version ligera solo para BFF
--      middleware (resuelve uuid sin payload pesado).
--   3. (Opcional, no incluido) tabla schools_subdomain_log para audit
--      de accesos por subdomain — se puede agregar en proximas fases.
--
-- Politica de la casa: search_path = pg_catalog, public, pg_temp.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. get_school_id_by_slug — version ligera para BFF middleware
-- ============================================================
--
-- Resuelve solo el school_id desde el slug. Se llama por cada request HTTP
-- que viene de un subdominio. Se diseña para ser MUY rapido y no devolver
-- datos sensibles.
--
-- Devuelve NULL si:
--   - no existe escuela con ese slug
--   - la escuela no tiene tier pro+ (subdomain feature gate)

CREATE OR REPLACE FUNCTION public.get_school_id_by_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT s.id
      FROM public.schools s
     WHERE s.slug = p_slug
       AND public.school_has_branding_feature(s.id)
     LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_school_id_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_school_id_by_slug(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_school_id_by_slug IS
    'Resuelve schoolId desde slug del subdominio. Solo devuelve si tier pro+ '
    '(subdomain es addon whitelabel). Anon-accesible — no expone datos sensibles.';


-- ============================================================
-- 2. get_school_by_slug — version completa para el frontend
-- ============================================================
--
-- Devuelve nombre + branding completo + slug. Anon-accesible. Solo Pro+.
-- El frontend lo usa al cargar la app para pintar el header con el
-- branding correcto incluso antes del login.

CREATE OR REPLACE FUNCTION public.get_school_by_slug(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school record;
BEGIN
    SELECT s.id, s.name, s.slug, s.logo_url, s.branding_settings
      INTO v_school
      FROM public.schools s
     WHERE s.slug = p_slug
       AND public.school_has_branding_feature(s.id)
     LIMIT 1;

    IF v_school.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'school', jsonb_build_object(
            'id',                v_school.id,
            'name',              v_school.name,
            'slug',              v_school.slug,
            'logo_url',          v_school.logo_url,
            'branding_settings', v_school.branding_settings
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_school_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_school_by_slug(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_school_by_slug IS
    'Resuelve datos publicos de la escuela (name + branding) desde slug del '
    'subdominio. Para pintar el header pre-login. Solo escuelas tier pro+.';


COMMIT;
