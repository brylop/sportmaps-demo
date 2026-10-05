-- =============================================================================
-- invariantes_seguridad(): fix de I6 + nuevo I7 (RPC SECURITY DEFINER sin gate)
-- =============================================================================
-- I6 · Falso positivo: comparaba la opción de la vista con el literal 'true',
--      pero Postgres la guarda como se escribió ('on' en 8 vistas que SÍ son
--      security_invoker). Reportaba 8 ALTA inexistentes y tapaba las reales.
--
-- I7 · Nuevo. Los 5 huecos del cruce linter × auditorías (2026-10-05) eran RPC
--      SECURITY DEFINER ejecutables por anon/authenticated cuyo cuerpo no
--      verifica identidad ni escuela. I1-I6 no miran funciones: nadie los vio.
--      I7 lista las que (a) son SECURITY DEFINER en public, (b) anon o
--      authenticated tienen EXECUTE, (c) el cuerpo no menciona ningún gate
--      conocido, (d) no están en la allowlist documentada abajo.
--      Gravedad: anon + escribe = CRITICA (sale con código 1);
--                anon lee, o authenticated escribe = ALTA; authenticated lee = MEDIA.
--
-- Allowlist: SOLO se agrega una función con su motivo en el comentario de su
-- grupo. Si entra algo nuevo que no pasa I7, se le pone gate; no se lo excluye.
-- =============================================================================

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
    -- I5 · TRUNCATE en manos de un usuario cualquiera (TRUNCATE no pasa por RLS).
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
    -- 2026-10-05: se acepta 'on'/'yes'/'1' además de 'true' (antes daba 8 falsos positivos).
    SELECT
        'I6_vista_definer_expuesta'::text, 'ALTA'::text, c.relname::text,
        ('vista sin security_invoker, SELECT para: ' ||
         array_to_string(ARRAY(
            SELECT r FROM unnest(ARRAY['anon','authenticated']) r
             WHERE has_table_privilege(r, c.oid, 'SELECT')
         ), ', '))::text
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'v'
       AND lower(coalesce((SELECT option_value FROM pg_options_to_table(c.reloptions)
                            WHERE option_name = 'security_invoker'), 'false'))
           NOT IN ('true', 'on', 'yes', '1')
       AND (has_table_privilege('anon', c.oid, 'SELECT')
            OR has_table_privilege('authenticated', c.oid, 'SELECT'))
       AND c.relname NOT IN ('v_school_staff_publico', 'v_school_settings_publico')
    UNION ALL
    -- I7 · RPC SECURITY DEFINER ejecutable por anon/authenticated sin gate en el cuerpo.
    SELECT
        'I7_rpc_definer_sin_gate'::text,
        CASE WHEN f.anon_x AND f.escribe THEN 'CRITICA'
             WHEN f.anon_x OR f.escribe THEN 'ALTA'
             ELSE 'MEDIA' END::text,
        (f.proname || '(' || f.args || ')')::text,
        ('SECURITY DEFINER sin chequeo de identidad/escuela; EXECUTE para: ' ||
         CASE WHEN f.anon_x THEN 'anon, ' ELSE '' END || 'authenticated' ||
         CASE WHEN f.escribe THEN ' — ESCRIBE' ELSE '' END)::text
      FROM (
        SELECT p.proname,
               pg_get_function_identity_arguments(p.oid) AS args,
               has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_x,
               has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_x,
               p.prosrc ~* '\m(insert|update|delete)\M' AS escribe,
               p.prosrc
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.prosecdef
           AND p.prorettype <> 'trigger'::regtype
      ) f
     WHERE (f.anon_x OR f.auth_x)
       AND f.prosrc !~* ('auth\.(uid|role|jwt|email)|is_super_admin|is_platform_admin|is_admin\(|'
                       || 'is_school_admin|is_school_staff|user_(admin_|staff_)?school_ids|can_manage|'
                       || '_store_actor|coach_can|current_staff|is_support_agent|_glosa_actor|'
                       || 'has_school_role|check_is_|_puede_ver_|_es_llamada_de_servidor')
       AND f.proname NOT IN (
            -- Públicas por diseño (landing, búsqueda, QR, enlaces con token):
            -- devuelven datos que la escuela publica o exigen un token secreto.
            'search_schools','search_marketplace','search_explore_map','schools_near_location',
            'get_distance_km','get_school_by_slug','get_school_id_by_slug','get_school_id_by_custom_domain',
            'get_school_lead_landing_public','list_open_trial_slots_public','submit_school_lead',
            'get_public_program_slots','get_plan_join_info','get_team_join_info','get_join_qr_public',
            'validate_child_for_team_join','validate_doc_for_plan_join','validate_athlete_age',
            'buscar_menor_por_documento_publico',          -- acotada por escuela + contacto enmascarado
            'verify_athlete_certificate_public','verify_athlete_id_card_public',
            'get_tournament_invitation_public','get_school_branding_by_invitation',
            'get_invitation_details','accept_invitation','access_demo_link',
            'get_school_services','is_school_open_now','get_shipping_quote_mock',
            'get_school_payment_info',                      -- decisión de producto abierta (perfil público)
            -- Flags de producto/tier: devuelven booleanos sobre la escuela, sin datos personales.
            'has_entitlement','school_has_addon','school_has_branding_feature',
            'school_has_custom_domain_feature','school_has_native_app','school_is_operational',
            'school_shows_own_brand','is_gov_entity','is_non_saas_entity','get_single_branch_id',
            'store_enabled','store_pilot_allowlist','store_seller_allowed','store_payment_methods',
            'get_available_slots',
            -- Helpers que usan las POLICIES: sin EXECUTE la policy da 403 a todos (CLAUDE.md).
            -- Residual aceptado: devuelven UUIDs/booleanos, no PII.
            'get_trainer_athlete_ids','is_school_member','is_coach_parent_messaging_blocked',
            'calendar_team_in_school','match_evaluation_visible_to_family','order_belongs_to_store',
            'can_manage_finances',
            -- Envoltorios cuyo gate vive en la función que llaman.
            'create_invitation','invite_parent_to_school','get_athlete_payments_v2'
       )
$function$;

REVOKE ALL ON FUNCTION public.invariantes_seguridad() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invariantes_seguridad() TO service_role;
