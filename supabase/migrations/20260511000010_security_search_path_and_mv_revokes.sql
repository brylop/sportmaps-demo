-- ============================================================
-- SPORTMAPS — Linter Fase 1
-- Cierra dos clases de warnings del Supabase linter:
--   1) function_search_path_mutable  (~35 funciones)
--   2) materialized_view_in_api      (2 MVs)
--
-- Por que pg_catalog, public, pg_temp:
--   Varias funciones referencian objetos de `public` sin schema
--   qualifier (tablas, otras funciones, tipos custom). Setear
--   search_path = '' las romperia. Este search_path explicito
--   es seguro y suficiente para silenciar el linter.
--
-- Defensivo: itera sobre pg_proc por NOMBRE, asi cubre sobrecargas
-- automaticamente y no falla si una funcion fue renombrada/borrada.
-- ============================================================


-- ============================================================
-- 1. function_search_path_mutable
-- ============================================================

DO $$
DECLARE
    r record;
    v_targets text[] := ARRAY[
        'update_body_metrics_updated_at',
        'is_parent_of',
        'is_parent_of_child',
        'get_single_branch_id',
        'update_athlete_training_plans_updated_at',
        'sync_session_capacity',
        'mark_overdue_payments',
        'fn_sync_enrollment_offering_id',
        'accept_invitation_pro',
        'on_availability_deleted',
        'on_availability_schedule_changed',
        'sync_capacity_from_availability',
        'sync_enrollment_participant_count',
        'fn_generate_bookable_sessions',
        'fn_extend_session_horizon',
        'set_updated_at',
        'get_athlete_stats',
        'provision_personal_trainer_workspace',
        'fn_cancel_pt_session',
        'get_pt_client_summary',
        'fn_book_pt_session',
        'fn_generate_offering_sessions',
        'generate_school_slug',
        'migrate_unregistered_athlete_to_profile',
        'process_enrollment_checkout',
        'tg_athlete_id_cards_touch',
        'fn_complete_session_plan',
        'create_invitation',
        'fn_create_plan_from_routine',
        'format_period_label',
        'vendor_payment_providers_enforce_single_default',
        'school_payment_providers_enforce_single_default',
        'resolve_payment_provider',
        'get_school_athletes'
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


-- ============================================================
-- 2. materialized_view_in_api
--    Verificado contra repo (2026-05-11):
--      - mv_session_health: solo refrescada por cron del BFF via
--        RPC refresh_session_health (service_role, no afectado).
--      - school_price_range: ningun consumidor en frontend/BFF
--        hace .from() directo. Solo aparece como referencia en
--        types.ts autogenerado.
--    Revocar SELECT a anon/authenticated es seguro.
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_matviews
         WHERE schemaname = 'public' AND matviewname = 'mv_session_health'
    ) THEN
        EXECUTE 'REVOKE SELECT ON public.mv_session_health FROM anon, authenticated';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_matviews
         WHERE schemaname = 'public' AND matviewname = 'school_price_range'
    ) THEN
        EXECUTE 'REVOKE SELECT ON public.school_price_range FROM anon, authenticated';
    END IF;
END $$;
