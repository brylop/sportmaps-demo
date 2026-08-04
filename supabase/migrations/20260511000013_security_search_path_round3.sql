-- ============================================================
-- SPORTMAPS — Linter Fase 1 ronda 3
-- Cierra el ultimo warning de function_search_path_mutable que
-- quedo despues de aplicar 20260511000011.
--
-- Origen:
--   - trg_release_on_delivered -> 20260511000005_vendor_payouts_pipeline
--     (untracked, ya tiene SET search_path en la definicion original).
--
-- Esta migracion aplica el fix a la BD que ya tiene la funcion
-- creada sin search_path. El archivo .sql original tambien se
-- parcho para que un `supabase db reset` futuro no reintroduzca
-- el warning.
-- ============================================================

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT n.nspname AS schema_name,
               p.proname AS fn_name,
               pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'trg_release_on_delivered'
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public, pg_temp',
            r.schema_name, r.fn_name, r.args
        );
        RAISE NOTICE 'search_path fijado en %.%(%)', r.schema_name, r.fn_name, r.args;
    END LOOP;
END $$;
