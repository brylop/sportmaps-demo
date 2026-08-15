-- =============================================================================
-- 20260814195349_invariantes_de_seguridad.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814194235
-- Objetivo: afirmar contra la BASE VIVA las reglas de seguridad que no se
--           pueden romper, y fallar si alguna se rompió.
--
-- ── Por qué no alcanza con revisar migraciones ──────────────────────────────
-- El 2026-08-14 se encontraron cinco fugas hacia internet abierto (datos
-- bancarios de 305 escuelas, tokens de pago, correos y teléfonos del staff) y
-- dos escaladas de privilegios. Ninguna se detectó revisando el repo: aparecieron
-- consultando pg_policies.
--
-- Y el registro de migraciones NO sirve como fuente de verdad: lo que se corre
-- desde el SQL editor cambia la base sin dejar rastro en schema_migrations, así
-- que hay 82 migraciones que figuran "sin registro" y en su mayoría SÍ están
-- aplicadas. Preguntarle al repo qué está vivo es preguntarle a quien no sabe.
--
-- Esto pregunta directamente a la base. Sobrevive al SQL editor, a la deriva de
-- esquema y a los cambios hechos a mano un domingo.
--
-- Se ejecuta con:  npm run seguridad:invariantes
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
RETURNS TABLE (
    invariante text,
    gravedad   text,
    objeto     text,
    detalle    text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    -- ── I1 · Datos privados legibles sin autenticación ───────────────────────
    -- Una policy USING(true) sobre una tabla donde `anon` tiene SELECT hace ese
    -- contenido público en internet: la llave anónima viaja en el bundle del
    -- frontend. Así estaban expuestos payment_links (tokens de pago),
    -- school_staff (correos y teléfonos), facility_reservations,
    -- school_settings (datos bancarios) y demo_links (leads).
    --
    -- La allowlist son tablas cuyo contenido ES público por diseño: el
    -- directorio de escuelas, catálogos de deportes y productos, etc. Agregar
    -- algo acá es una decisión de producto, no un atajo para silenciar la alerta.
    SELECT
        'I1_tabla_privada_publica'::text,
        'CRITICA'::text,
        p.tablename::text,
        ('policy "' || p.policyname || '" es USING(true) y anon tiene SELECT')::text
      FROM pg_policies p
      JOIN pg_class c   ON c.relname = p.tablename
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE p.schemaname = 'public'
       AND c.relkind = 'r'
       AND p.cmd IN ('SELECT','ALL')
       AND p.permissive = 'PERMISSIVE'
       AND btrim(coalesce(p.qual,'')) IN ('true','(true)')
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
            'attendance_polls','roles'
       )

    UNION ALL

    -- ── I2 · Familias con permiso de escritura ───────────────────────────────
    -- user_school_ids() devuelve la escuela de CUALQUIER miembro activo, padres
    -- y atletas incluidos. Usarla en una policy de escritura sin mirar el rol es
    -- lo que permitía que un padre creara invitaciones de admin y se volviera
    -- administrador. Para escribir van user_staff_school_ids() (operativo) o
    -- user_admin_school_ids() (lo que otorga permisos).
    SELECT
        'I2_familia_puede_escribir'::text,
        'CRITICA'::text,
        (p.tablename || '.' || p.policyname)::text,
        ('policy ' || p.cmd || ' usa user_school_ids() sin chequeo de rol')::text
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND p.cmd IN ('ALL','INSERT','UPDATE','DELETE')
       AND (coalesce(p.qual,'') LIKE '%user_school_ids%' OR coalesce(p.with_check,'') LIKE '%user_school_ids%')
       AND coalesce(p.qual,'') || coalesce(p.with_check,'') NOT LIKE '%role%'
       -- El coach editando su propia ficha: acotado por email + escuela propia.
       AND NOT (p.tablename = 'school_staff' AND p.policyname = 'Staff manage themselves')

    UNION ALL

    -- ── I3 · FOR ALL sin WITH CHECK ──────────────────────────────────────────
    -- En una policy FOR ALL, omitir WITH CHECK hace que PostgreSQL valide los
    -- INSERT con la expresión de USING. Si esa expresión describe "mi fila"
    -- (email = auth.email()) pero no acota la escuela, cualquiera puede
    -- insertarse en la escuela que quiera. Así se podía entrar como staff a
    -- CUALQUIER escuela de la plataforma.
    SELECT
        'I3_for_all_sin_with_check'::text,
        'ALTA'::text,
        (p.tablename || '.' || p.policyname)::text,
        'FOR ALL sin WITH CHECK: el USING valida los INSERT'::text
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND p.cmd = 'ALL'
       AND p.permissive = 'PERMISSIVE'
       AND p.with_check IS NULL
       AND p.qual IS NOT NULL

    UNION ALL

    -- ── I4 · SECURITY DEFINER sin search_path ────────────────────────────────
    -- Convención del repo. Sin search_path fijo, quien controle el search_path
    -- de la sesión puede hacer que la función resuelva a SUS objetos, y como
    -- corre con los permisos del dueño, eso es ejecución con privilegios.
    SELECT
        'I4_definer_sin_search_path'::text,
        'MEDIA'::text,
        p.proname::text,
        'SECURITY DEFINER sin SET search_path'::text
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
       ))
$$;

COMMENT ON FUNCTION public.invariantes_seguridad() IS
    'Afirma contra la base viva las reglas de seguridad que no se pueden romper. '
    'Existe porque el registro de migraciones no dice que esta aplicado (el SQL '
    'editor no deja rastro) y las fugas del 2026-08-14 se encontraron mirando '
    'pg_policies, no el repo. Devuelve una fila por violacion; vacio = todo bien.';

REVOKE ALL ON FUNCTION public.invariantes_seguridad() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invariantes_seguridad() FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.invariantes_seguridad() TO service_role;

COMMIT;
