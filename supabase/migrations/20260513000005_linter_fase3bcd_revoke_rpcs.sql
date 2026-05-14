-- ============================================================
-- SPORTMAPS — Linter Fase 3b + 3c + 3d (consolidada)
--
-- 3b: admin_* y create_demo_link
--     REVOKE EXECUTE FROM anon, public
--     Mantienen EXECUTE para authenticated. La funcion valida
--     is_platform_admin() internamente.
--
-- 3c: BFF-only / service_role-only
--     REVOKE EXECUTE FROM anon, authenticated, public
--     Solo el BFF las debe llamar (con service_role nunca afectado
--     por REVOKE). Webhooks de pago, cron jobs, recalc internos,
--     middleware vendor capability, seeds admin manuales,
--     gestion de platform admins.
--
-- 3d: RPCs de usuario autenticado
--     REVOKE EXECUTE FROM anon, public
--     Mantienen EXECUTE para authenticated. Internamente cada
--     funcion valida auth.uid() / ownership.
--
-- GRUPO B (publicos legitimos via token / search publica)
--     NO se tocan en esta migracion. Se mantienen para anon:
--       access_demo_link, accept_invitation*, claim_*,
--       get_invitation_details, get_join_qr_public,
--       get_school_branding_by_invitation, get_team_join_info,
--       get_plan_join_info, get_public_program_slots,
--       get_school_payment_info, search_schools, search_marketplace,
--       search_explore_map, schools_near_location,
--       verify_athlete_certificate_public, verify_athlete_id_card_public,
--       submit_qr_signup.
--
-- DEFENSIVO
--   Iteramos pg_proc filtrando por nombre + prosecdef=true. Si la
--   funcion no existe o no es SECURITY DEFINER, no se aplica. Si
--   tiene sobrecargas, cubre todas.
--
-- RIESGO
--   3c es el de mayor riesgo: si alguna funcion supuestamente
--   "solo BFF" la llama el frontend autenticado, va a fallar con
--   42501. Mitigar aplicando primero en QA, monitorear logs 24h.
-- ============================================================

DO $$
DECLARE
    r record;
    v_targets text[];
    v_roles text;
    v_count integer;
BEGIN

    -- ============================================================
    -- 3b: admin_* RPCs — REVOKE anon, public
    -- ============================================================
    v_targets := ARRAY[
        'admin_activity_summary',
        'admin_create_staff_direct',
        'admin_generate_pending_payouts',
        'admin_global_counts',
        'admin_list_analytics_events',
        'admin_list_audit_logs',
        'admin_list_billing_events',
        'admin_list_event_telemetry',
        'admin_list_payments',
        'admin_list_schools_for_filter',
        'admin_list_schools_global',
        'admin_list_users',
        'create_demo_link'
    ];
    v_roles := 'anon, public';
    v_count := 0;
    FOR r IN
        SELECT n.nspname AS schema_name, p.proname AS fn_name,
               pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = ANY (v_targets)
           AND p.prosecdef = true
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public',
            r.schema_name, r.fn_name, r.args
        );
        v_count := v_count + 1;
    END LOOP;
    RAISE NOTICE '3b admin_* REVOKE aplicados: %', v_count;


    -- ============================================================
    -- 3c: BFF-only / service_role-only — REVOKE anon, authenticated, public
    -- ============================================================
    v_targets := ARRAY[
        -- Webhooks de pago
        'save_payment_token',
        'flag_payment_for_review',
        'confirm_marketplace_payment',
        'confirm_order_payment',
        'confirm_session_booking_payment',
        'split_order_payment',
        -- Refunds (admin tooling via BFF)
        'approve_refund',
        'complete_refund',
        -- Cron jobs BFF
        'auto_finalize_stale_sessions',
        'refresh_session_health',
        'refresh_school_price_range',
        -- Triggers / recalc internos
        'recalc_product_review_aggregates',
        'recalc_vendor_review_aggregates',
        -- Middleware vendor capability (service_role)
        'has_vendor_capability',
        -- Settlements internos
        'compute_settlements_for_order',
        -- Migracion interna desde accept_invitation_pro
        'migrate_unregistered_athlete_to_profile',
        'link_unregistered_to_profile',
        -- Payment block check (BFF)
        'is_user_payment_blocked',
        -- Reservation payment desde BFF
        'add_reservation_payment',
        -- Seeds admin manuales
        'seed_abierto26_price_phases',
        'seed_cheer_allstar_categories',
        -- Platform admin management
        'add_platform_admin',
        'revoke_platform_admin'
    ];
    v_roles := 'anon, authenticated, public';
    v_count := 0;
    FOR r IN
        SELECT n.nspname AS schema_name, p.proname AS fn_name,
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
    END LOOP;
    RAISE NOTICE '3c BFF-only REVOKE aplicados: %', v_count;


    -- ============================================================
    -- 3d: RPCs de usuario autenticado — REVOKE anon, public
    -- ============================================================
    v_targets := ARRAY[
        -- Certificados (internos)
        '_build_certificate_snapshot',
        '_next_certificate_folio',
        -- Delegations
        'calculate_delegation_balance',
        'lock_delegation_price_phase',
        'prorate_delegation_payment',
        -- Reviews
        'can_review_product',
        -- Cash sessions
        'close_cash_session',
        'get_cash_session_summary',
        -- Invitations
        'create_invitation',
        'invite_parent_to_school',
        'get_my_invitations',
        -- School join QRs
        'create_school_join_qr',
        'list_school_join_qrs',
        -- Referrals
        'create_school_referral',
        'get_school_referrals',
        'process_referral_registration',
        'register_qr_paid_conversion',
        -- Sessions / training
        'decrement_session_bookings',
        'increment_session_bookings',
        'fn_book_pt_session',
        'fn_cancel_pt_session',
        'fn_complete_session_plan',
        'fn_create_plan_from_routine',
        'fn_generate_pt_sessions',
        'fn_generate_sessions_for_offering',
        'fn_generate_sessions_from_offering_schedule',
        'fn_sync_all_offering_sessions',
        'get_pt_client_summary',
        'get_facility_availability',
        'get_available_slots',
        'provision_personal_trainer_workspace',
        -- Vendor
        'enable_vendor_profile',
        'disable_vendor_profile',
        'request_payout',
        'vendor_payout_summary',
        'release_settlements_all',
        'release_settlements_for_vendor',
        'validate_product_quality',
        'get_payment_providers_for_school',
        'get_payment_providers_for_vendor',
        -- Enrollment / checkout
        'enroll_student',
        'process_enrollment_checkout',
        'submit_enrollment',
        'submit_enrollment_v2',
        'submit_facility_booking',
        'submit_facility_booking_v2',
        -- Athlete dashboard
        'get_athlete_dashboard_stats',
        'get_athlete_enrollments',
        'get_athlete_exercise_stats',
        'get_athlete_payments',
        'get_athlete_payments_v2',
        'get_athlete_stats',
        'get_child_exercise_stats',
        'submit_athlete_installment',
        'my_athlete_certificates',
        'my_athlete_id_cards',
        -- School admin
        'get_athletes_without_payment',
        'get_my_schools',
        'get_my_administered_school_ids',
        'get_school_athletes',
        'get_school_dashboard_stats',
        'get_school_services',
        'list_school_athletes_for_card_issue',
        'list_athlete_certificates',
        'list_athlete_id_cards',
        'issue_athlete_certificate',
        'revoke_athlete_certificate',
        'issue_athlete_id_card',
        'revoke_athlete_id_card',
        'request_athlete_certificate',
        'set_certificate_pdf_url',
        'mark_overdue_payments',
        'send_payment_reminders',
        'next_unpaid_period',
        'period_payment_status',
        -- Settings / profile
        'get_my_settings',
        'save_profile_settings',
        'save_school_branding',
        'save_school_info',
        'save_notification_preferences',
        'save_privacy_preferences',
        'get_onboarding_status',
        -- Favoritos
        'get_my_favorites',
        'toggle_favorite',
        'migrate_local_favorites',
        'migrate_device_favorites',
        -- Notifications
        'notify_user',
        'send_notification',
        -- Refunds (frontend authenticated puede pedir)
        'request_refund'
    ];
    v_roles := 'anon, public';
    v_count := 0;
    FOR r IN
        SELECT n.nspname AS schema_name, p.proname AS fn_name,
               pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = ANY (v_targets)
           AND p.prosecdef = true
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public',
            r.schema_name, r.fn_name, r.args
        );
        v_count := v_count + 1;
    END LOOP;
    RAISE NOTICE '3d user-auth REVOKE aplicados: %', v_count;

END $$;


-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload config';
