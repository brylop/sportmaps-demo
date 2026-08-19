-- =============================================================================
-- 20260814195535_invariantes_i1_mira_el_rol_de_la_policy.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814195349
-- Objetivo: quitarle los falsos positivos a I1.
--
-- ── Qué falló ───────────────────────────────────────────────────────────────
-- I1 marcaba como críticas payroll_config, tournament_matches y
-- tournament_match_events. Las tres son USING(true) y `anon` tiene el privilegio
-- de tabla, pero sus policies son `TO authenticated`: un anónimo no las alcanza.
-- Verificado ejecutando como anon → 0 filas en las tres.
--
-- Faltaba mirar el ROL de la policy. Que anon tenga el GRANT de tabla no
-- significa nada si ninguna policy lo habilita: en RLS hacen falta las dos cosas.
--
-- Se corrige rápido y a propósito: un detector de seguridad que da falsos
-- positivos se desactiva mentalmente a la semana, y entonces no sirve para nada
-- el día que acierta. Es preferible que no avise a que avise de más.
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

CREATE OR REPLACE FUNCTION public.invariantes_seguridad()
RETURNS TABLE (invariante text, gravedad text, objeto text, detalle text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    -- I1 · Datos privados legibles SIN autenticación.
    -- Hacen falta las DOS cosas: que la policy alcance a anon/public Y que anon
    -- tenga el GRANT de tabla. Con una sola, no se lee nada.
    SELECT
        'I1_tabla_privada_publica'::text, 'CRITICA'::text, p.tablename::text,
        ('policy "' || p.policyname || '" es USING(true), alcanza a ' || p.roles::text ||
         ' y anon tiene SELECT')::text
      FROM pg_policies p
      JOIN pg_class c ON c.relname = p.tablename
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE p.schemaname = 'public' AND c.relkind = 'r'
       AND p.cmd IN ('SELECT','ALL') AND p.permissive = 'PERMISSIVE'
       AND btrim(coalesce(p.qual,'')) IN ('true','(true)')
       AND (p.roles::text[] && ARRAY['public','anon'])
       AND has_table_privilege('anon', c.oid, 'SELECT')
       AND p.tablename NOT IN (
            'schools','school_branches','teams','classes','facilities',
            'events','event_categories_config','event_price_phases',
            'products','product_images','product_variants','product_brands',
            'product_brand_categories','product_categories','product_questions',
            'product_reviews','product_review_media','product_review_votes',
            'reviews','vendor_reviews','vendor_profiles',
            'service_listings','service_variations','service_availability',
            'offerings','offering_plans','subscription_plans',
            'sports_categories','sports_equipment','sport_configs',
            'sport_category_templates','sport_metric_definitions','sport_metric_thresholds',
            'exercise_analyzers','exercise_analyzer_mappings',
            'marketplace_shipping_zones','marketplace_shipping_rates','shipping_zones',
            'platform_config','school_availability','coach_availability',
            'school_onboarding_configs','trainer_profiles','template_variables',
            'attendance_polls','roles')
    UNION ALL
    SELECT
        'I2_familia_puede_escribir'::text, 'CRITICA'::text,
        (p.tablename || '.' || p.policyname)::text,
        ('policy ' || p.cmd || ' usa user_school_ids() sin chequeo de rol')::text
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND p.cmd IN ('ALL','INSERT','UPDATE','DELETE')
       AND (coalesce(p.qual,'') LIKE '%user_school_ids%' OR coalesce(p.with_check,'') LIKE '%user_school_ids%')
       AND coalesce(p.qual,'') || coalesce(p.with_check,'') NOT LIKE '%role%'
       AND NOT (p.tablename = 'school_staff' AND p.policyname = 'Staff manage themselves')
    UNION ALL
    SELECT
        'I3_for_all_sin_with_check'::text, 'ALTA'::text,
        (p.tablename || '.' || p.policyname)::text,
        'FOR ALL sin WITH CHECK: el USING valida los INSERT'::text
      FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.cmd = 'ALL'
       AND p.permissive = 'PERMISSIVE' AND p.with_check IS NULL AND p.qual IS NOT NULL
    UNION ALL
    SELECT
        'I4_definer_sin_search_path'::text, 'MEDIA'::text, p.proname::text,
        'SECURITY DEFINER sin SET search_path'::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
       AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'))
$$;

COMMENT ON FUNCTION public.invariantes_seguridad() IS
    'Afirma contra la base viva las reglas de seguridad que no se pueden romper. '
    'I1 exige que la policy alcance a anon/public Y que anon tenga el GRANT: con '
    'una sola de las dos no se lee nada (ver 20260814195535).';

COMMIT;
