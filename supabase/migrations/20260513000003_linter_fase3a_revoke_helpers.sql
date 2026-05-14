-- ============================================================
-- SPORTMAPS — Linter Fase 3a (Grupo A: helpers RLS + trigger fns)
--
-- REVOKE EXECUTE FROM anon, authenticated, public de funciones
-- que no deberian ser callable via /rest/v1/rpc/*:
--
--   1. Helpers de RLS (is_school_admin, coach_team_ids, etc.):
--      las usan policies en USING/WITH CHECK. PostgREST no las
--      necesita expuestas. service_role las sigue ejecutando
--      cuando RLS lo requiere — REVOKE solo afecta anon/auth.
--
--   2. Trigger functions (handle_new_user, audit_*, auto_*,
--      fn_*): el motor de triggers las invoca internamente con
--      el rol del owner de la funcion, no del caller. REVOKE
--      no las apaga, solo cierra el endpoint REST.
--
--   3. Utilities one-off (fix_invitation_school_id).
--
-- POR QUE REVOCAR A PUBLIC TAMBIEN
--   El default de Postgres al crear una funcion es
--   GRANT EXECUTE ... TO PUBLIC. Revocar solo a anon/auth deja
--   el grant a PUBLIC vigente y otras roles podrian llamarlas.
--   Revocar a PUBLIC quita ese default.
--
-- RIESGO
--   Si alguna funcion de este grupo es llamada por el frontend
--   (que la auditoria no detecto), va a fallar con 42501.
--   Mitigation: aplicar primero en QA, monitorear 24h.
-- ============================================================

DO $$
DECLARE
    r record;
    v_targets text[] := ARRAY[
        -- ============ Helpers de RLS / auth checks ============
        'is_school_admin',
        'is_school_coach',
        'is_school_owner',
        'is_school_member',
        'is_school_general_admin',
        'is_school_open_now',
        'is_branch_admin',
        'is_personal_trainer',
        'is_platform_admin',
        'is_admin',
        'is_super_admin',
        'is_parent_of_child',
        'is_parent_of',
        'is_demo_user',
        'check_is_branch_admin',
        'check_is_school_admin',
        'check_is_school_admin_safe',
        'check_is_school_member',
        'check_is_school_member_safe',
        'coach_school_ids',
        'coach_team_ids',
        'school_member_profile_ids',
        'get_user_admin_school_ids',
        'get_user_school_ids',
        'get_my_administered_school_ids',
        'fn_is_admin_of_school',
        'get_single_branch_id',
        'get_personal_trainer_school_id',
        'get_trainer_athlete_ids',
        'get_distance_km',
        'has_role',
        'has_school_role',

        -- ============ Trigger functions (AFTER/BEFORE) =========
        'handle_new_user',
        'handle_new_school',
        'handle_updated_at',
        'handle_school_referral_on_create',
        'audit_trigger_func',
        'audit_health_data_access',
        'audit_school_settings_changes',
        'auto_add_parent_to_school',
        'auto_create_vendor_balance',
        'auto_create_vendor_profile',
        'fn_auto_create_main_branch',
        'fn_auto_generate_sessions_on_availability',
        'fn_log_payment_status_change',
        'fn_notify_on_payment_created',
        'fn_decrement_bookings_on_cancel',
        'fn_deduct_sessions_on_finalize',
        'fn_sync_coach_auth_id',
        'fn_sync_school_member_on_enrollment_status',
        'set_review_verified_purchase',
        'enforce_product_publish_gate',

        -- ============ Utilities / one-off ======================
        'expire_school_referrals',
        'fix_invitation_school_id'
    ];
    v_count integer := 0;
BEGIN
    FOR r IN
        SELECT n.nspname AS schema_name,
               p.proname AS fn_name,
               pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = ANY (v_targets)
           AND p.prosecdef = true
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, authenticated, public',
            r.schema_name, r.fn_name, r.args
        );
        v_count := v_count + 1;
        RAISE NOTICE 'REVOKE % de %.%(%)', 'anon/auth/public', r.schema_name, r.fn_name, r.args;
    END LOOP;
    RAISE NOTICE 'Total REVOKE aplicados: %', v_count;
END $$;


-- Refresh PostgREST schema cache para que las funciones revocadas
-- desaparezcan de /rest/v1/rpc/* immediately.
NOTIFY pgrst, 'reload config';
