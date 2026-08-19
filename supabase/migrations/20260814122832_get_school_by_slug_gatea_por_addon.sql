-- =============================================================================
-- 20260814122832_get_school_by_slug_gatea_por_addon.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814122449
-- Objetivo: que la marca de la escuela se pueda resolver ANTES del login.
--
-- get_school_by_slug es la RPC (anon puede ejecutarla) que devuelve nombre, logo
-- y colores a partir del slug. Es la única vía para pintar el login con la marca
-- de la escuela, porque ahí todavía no hay sesión ni school_id.
--
-- Problema: gateaba por TIER (school_has_branding_feature = pro/enterprise). La
-- escuela de pruebas está en tier `free` con el addon comprado, así que devolvía
-- not_found y el login seguía verde de SportMaps.
--
-- Son dos preguntas distintas y hasta ahora se respondían con el mismo gate:
--   · ¿puede EDITAR su marca?  → por tier. update_school_branding. NO se toca.
--   · ¿se le MUESTRA su marca? → por addon. Es lo que se vendió.
--
-- Blast radius medido antes de aplicar: pasar de tier a addon deja fuera a UNA
-- sola escuela (28 quedan cubiertas por `whitelabel`, 1 tenía tier alto sin
-- ningún addon de marca).
--
-- AISLACIÓN — requisito explícito del usuario: esto NO puede filtrar marca entre
-- escuelas ni a otros roles. Esta RPC responde por UN slug y solo devuelve datos
-- públicos de esa escuela (nombre, logo, colores); no expone atletas, pagos ni
-- miembros. El aislamiento del lado del cliente lo sigue haciendo BrandingScope
-- con su allowlist de rutas, blocklist, filtro de rol y CSS vars en contenedor
-- local (nunca en :root).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- Helper reutilizable: "¿a esta escuela se le muestra su marca?".
-- Se separa de school_has_branding_feature (que responde "¿puede editarla?")
-- para que la próxima vez no se vuelvan a confundir las dos preguntas.
CREATE OR REPLACE FUNCTION public.school_shows_own_brand(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS(
        SELECT 1
          FROM public.school_addons a
         WHERE a.school_id = p_school_id
           AND a.addon_key IN ('pwa_branding', 'whitelabel')
           AND a.enabled
    );
$$;

COMMENT ON FUNCTION public.school_shows_own_brand(uuid) IS
    '¿A esta escuela se le MUESTRA su marca? (addon pwa_branding o whitelabel). '
    'NO confundir con school_has_branding_feature, que responde si puede EDITARLA '
    '(eso sigue siendo por tier).';

REVOKE ALL ON FUNCTION public.school_shows_own_brand(uuid) FROM PUBLIC;
-- anon la necesita: el login se pinta antes de que exista sesión.
GRANT EXECUTE ON FUNCTION public.school_shows_own_brand(uuid) TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_school_by_slug pasa a usar el gate nuevo
-- ─────────────────────────────────────────────────────────────────────────────
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
       AND public.school_shows_own_brand(s.id)
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

COMMENT ON FUNCTION public.get_school_by_slug(text) IS
    'Datos públicos de marca de una escuela por slug, para pintar el login antes '
    'de que exista sesión. Gatea por ADDON (school_shows_own_brand), no por tier: '
    'una escuela puede tener comprada la marca sin estar en tier alto.';

REVOKE ALL ON FUNCTION public.get_school_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_school_by_slug(text) TO anon, authenticated, service_role;

COMMIT;
