-- =============================================================================
-- 20260901115207_invariante_i6_vistas_definer_expuestas.sql
-- Autor: brylop   Fecha: 2026-09-01   Versión anterior: 20260901114927
-- Objetivo: agregar I6 a invariantes_seguridad() — vista en public sin
-- security_invoker=true con GRANT SELECT a anon/authenticated.
--
-- POR QUÉ
--   school_athletes perdió `security_invoker=true` dos veces (drift de marzo,
--   regresión de un CREATE OR REPLACE de agosto) sin que NADA lo detectara
--   hasta que llegó el mail del linter de Supabase, 5 días después. Los
--   invariantes I1-I5 no lo habrían atrapado: I1 filtra por
--   `c.relkind = 'r'` (solo tablas) — una vista nunca tiene filas en
--   `pg_policies`, así que queda estructuralmente fuera de su alcance.
--
--   Al armar esta query se encontraron 4 vistas MÁS en el mismo estado,
--   exponiendo medical_info/emergency_contact/parent_email/parent_phone
--   (students) y payments completos (pending_payments,
--   payments_with_installments) y datos de pending_athletes — cerradas en
--   20260901114927_fix_security_invoker_students_payments_pending_views.sql.
--
--   Ver docs/auditoria-seguridad-2026-08-14.md §4 y §4.1 para el detalle
--   completo (qué se encontró, qué se cerró, qué queda pendiente de revisar).
--
-- QUÉ CUBRE Y QUÉ NO
--   Cubre: vistas en `public` sin security_invoker=true con SELECT para
--   anon o authenticated. No distingue "bypass accidental" de "curada a
--   propósito para exponer columnas públicas de una tabla con RLS estricta"
--   (v_school_staff_publico, v_school_settings_publico — ver SEG-2,
--   20260831095348) — esas dos se excluyen explícitamente, mismo patrón que
--   la lista de exclusión de I1.
--
--   Quedan 8 vistas reportadas por este invariante sin revisar una por una
--   todavía (school_public_profile, school_detail_view, school_ratings,
--   teams_full_view, team_capacity, class_capacity, poll_sessions_summary,
--   public_staff) — bajo riesgo estimado (varias ya tienen policy pública
--   propia en la tabla base, o son agregados sin PII), pero "estimado" no es
--   "verificado". Quedan como debt visible en el output del invariante hasta
--   que alguien los revise y decida excluir con COMMENT o corregir.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.invariantes_seguridad()
RETURNS TABLE(invariante text, gravedad text, objeto text, detalle text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
    UNION ALL
    -- I5 · TRUNCATE en manos de un usuario cualquiera.
    -- TRUNCATE **no pasa por RLS**: ninguna policy lo detiene. Con este privilegio
    -- cualquier sesion iniciada vacia la tabla de TODAS las escuelas. No lo dan las
    -- migraciones sino los default privileges del esquema, asi que reaparece solo
    -- con cada tabla nueva si nadie mira. Se sumo el 2026-08-17, al ver que la
    -- verificacion de `memberships` devolvia TRUNCATE para authenticated sin que la
    -- migracion lo concediera.
    SELECT
        'I5_truncate_a_usuario_comun'::text, 'CRITICA'::text, c.relname::text,
        ('el rol ' || r.rolname || ' puede TRUNCATE, y TRUNCATE no pasa por RLS')::text
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN (SELECT unnest(ARRAY['authenticated','anon']) AS rolname) r
     WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
       AND has_table_privilege(r.rolname, c.oid, 'TRUNCATE')
    UNION ALL
    -- I6 · Vista SECURITY DEFINER de facto expuesta a anon/authenticated.
    -- Un CREATE OR REPLACE VIEW no conserva `security_invoker` si la nueva
    -- definición no lo repite (así regresó school_athletes el 2026-08-27).
    -- I1-I5 no cubren esto: las vistas no tienen filas en pg_policies.
    -- Excluye las intencionales ya documentadas (SEG-2, 20260831095348):
    -- exponen columnas públicas de una tabla con RLS estricta a propósito.
    SELECT
        'I6_vista_definer_expuesta'::text, 'ALTA'::text, c.relname::text,
        ('vista sin security_invoker=true, SELECT para: ' ||
         array_to_string(ARRAY(
            SELECT r FROM unnest(ARRAY['anon','authenticated']) r
             WHERE has_table_privilege(r, c.oid, 'SELECT')
         ), ', '))::text
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'v'
       AND coalesce((SELECT option_value FROM pg_options_to_table(c.reloptions)
                      WHERE option_name = 'security_invoker'), 'false') <> 'true'
       AND (has_table_privilege('anon', c.oid, 'SELECT')
            OR has_table_privilege('authenticated', c.oid, 'SELECT'))
       AND c.relname NOT IN ('v_school_staff_publico', 'v_school_settings_publico')
$function$;

COMMENT ON FUNCTION public.invariantes_seguridad() IS
    'Afirma I1-I6 contra la base viva. I6 agregado 2026-09-01 tras la regresión '
    'de school_athletes — ver docs/auditoria-seguridad-2026-08-14.md §4.';

COMMIT;
