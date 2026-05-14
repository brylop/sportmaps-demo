-- ============================================================
-- SPORTMAPS — Linter Fase 1 ronda 2
-- Cierra los 7 warnings restantes de function_search_path_mutable
-- que quedaron despues de aplicar 20260511000010.
--
-- Origen de cada funcion:
--   - validate_product_vendor_capability  -> 20260416000001_marketplace_core_tables (commiteada, no se edita)
--   - validate_service_vendor_capability  -> idem
--   - validate_appointment_no_overlap     -> idem
--   - generate_vendor_slug                -> idem
--   - trg_recalc_product_review_aggregates -> 20260511000004_reviews_and_qa (untracked, ya tiene SET search_path)
--   - trg_recalc_vendor_review_aggregates  -> idem
--   - trg_recalc_review_votes              -> idem
--
-- Las 3 trg_recalc_* tambien estan parchadas en su archivo de
-- origen para que un `supabase db reset` futuro no reintroduzca
-- el warning. Esta migracion aplica el fix a la BD que ya las
-- tiene creadas sin search_path.
-- ============================================================

DO $$
DECLARE
    r record;
    v_targets text[] := ARRAY[
        'trg_recalc_product_review_aggregates',
        'trg_recalc_vendor_review_aggregates',
        'trg_recalc_review_votes',
        'validate_product_vendor_capability',
        'validate_service_vendor_capability',
        'validate_appointment_no_overlap',
        'generate_vendor_slug'
    ];
BEGIN
    FOR r IN
        SELECT n.nspname AS schema_name,
               p.proname AS fn_name,
               pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = ANY (v_targets)
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public, pg_temp',
            r.schema_name, r.fn_name, r.args
        );
        RAISE NOTICE 'search_path fijado en %.%(%)', r.schema_name, r.fn_name, r.args;
    END LOOP;
END $$;
