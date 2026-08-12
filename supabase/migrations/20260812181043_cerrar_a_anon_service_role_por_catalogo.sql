-- ============================================================================
-- 20260812181043_cerrar_a_anon_service_role_por_catalogo.sql
-- Fecha: 2026-08-12   ·   SEG-8 (ampliado) — reemplaza a 20260812180437
--
-- POR QUE ESTA MIGRACION EXISTE: 20260812180437 hacia lo mismo pero con las
-- firmas copiadas de las migraciones, y ABORTO al aplicarse:
--
--   ERROR 42883: function public.claim_single_due_recurring_subscription(uuid)
--                does not exist
--
-- El repo declara esa firma y la base tiene otra: es la misma deriva de esquema
-- de INF-1. Como iba dentro de BEGIN/COMMIT, el rollback dejo todo intacto — no
-- se aplico nada. Las migraciones son inmutables, asi que el fix va aca y
-- 20260812180437 queda superseded: NO CORRERLA.
--
-- QUE CAMBIA: en vez de escribir las firmas a mano, se resuelven contra
-- `pg_catalog.pg_proc` en tiempo de ejecucion. Asi:
--   · no importa que el repo y la base tengan firmas distintas;
--   · cubre TODAS las sobrecargas de un mismo nombre, no solo la del repo;
--   · una funcion que no exista simplemente no aparece, en vez de abortar;
--   · es idempotente: re-ejecutarla no hace nada nuevo.
--
-- ----------------------------------------------------------------------------
-- EL HALLAZGO (SEG-8, ampliado)
--
-- `auto_approve_payment` tiene EXECUTE para `anon` sin ningun chequeo de
-- autorizacion. Verificado en vivo: HTTP 200 con la anon key.
--
-- LA CAUSA no es la que parecia: su migracion YA hace `REVOKE ALL ... FROM
-- PUBLIC` y aun asi `anon` entra. El permiso de `anon` NO viene de PUBLIC —
-- Supabase concede EXECUTE a `anon` y `authenticated` DIRECTAMENTE, por
-- privilegios por defecto del esquema `public`, al crear cada funcion. Son
-- grants independientes: revocar uno deja vivos los otros. Por eso aca se
-- revoca a los TRES.
--
-- EL ALCANCE: 41 funciones que su propia migracion declara solo para
-- `service_role` y que nunca se conceden a anon/authenticated en ningun lado.
-- Entre ellas hay dinero y credenciales: complete_refund, apply_late_fees,
-- generate_monthly_charges, save_payment_token, upsert_school_provider (escribe
-- los secretos de pasarela por escuela) y wa_verify_otp (verificacion OTP).
--
-- COMPROBADO EN VIVO, solo dos a proposito:
--   auto_approve_payment  -> HTTP 200 con la anon key
--   _notify_school_staff  -> HTTP 204: se EJECUTO e inserta en `notifications`.
--                            Con un school_id real —y `schools` es legible por
--                            anon, 364 filas— un anonimo puede inyectar
--                            notificaciones con titulo, mensaje y LINK
--                            arbitrarios al staff de cualquier escuela:
--                            phishing dentro de la propia app.
-- Las otras NO se probaron a proposito: ejecutar `complete_refund` o
-- `apply_late_fees` como anonimo para "ver si responden" seria causar el dano
-- que esto viene a evitar.
--
-- SEGURIDAD DEL CAMBIO: verificado que el frontend no invoca ninguna (cero
-- coincidencias de `rpc('<nombre>')` en frontend/src). El BFF usa `service_role`,
-- que conserva el permiso. No se rompe ningun flujo.
--
-- Convencion del repo: `SECURITY DEFINER` NO exime al caller de tener EXECUTE,
-- por eso el GRANT a service_role se re-declara despues del REVOKE.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_fn      text;
    v_sig     text;
    v_tocadas int := 0;
    v_ausentes text[] := ARRAY[]::text[];
    -- Los nombres son la fuente; las firmas las resuelve pg_proc.
    v_nombres text[] := ARRAY[
        '_glosa_actor_is_admin',
        '_glosa_notify',
        '_notify_school_staff',
        '_payment_notif_data',
        'apply_late_fees',
        'auto_approve_payment',
        'claim_due_recurring_subscriptions',
        'claim_single_due_recurring_subscription',
        'cleanup_expired_card_save_intents',
        'cleanup_old_inactive_payment_tokens',
        'complete_refund',
        'conciliate_glosa',
        'confirm_session_booking_payment',
        'consume_card_save_intent',
        'count_active_payment_tokens',
        'create_glosa',
        'detect_payment_anomalies',
        'expire_trials',
        'flag_payment_for_review',
        'fn_expire_overdue_payments',
        'generate_monthly_charges',
        'notify_school_payment_paid',
        'qr_first_charge_due_date',
        'ratify_expired_glosas',
        'reconcile_statement',
        'record_recurring_attempt',
        'register_card_save_intent',
        'reopen_glosa',
        'resolve_glosa',
        'respond_glosa',
        'save_payment_token',
        'school_due_date',
        'send_payment_reminders',
        'split_order_payment',
        'upsert_school_provider',
        'wa_get_payment_status',
        'wa_ingest_inbound_message',
        'wa_is_blocked',
        'wa_record_outbound_message',
        'wa_start_identification',
        'wa_verify_otp'
    ];
BEGIN
    FOREACH v_fn IN ARRAY v_nombres LOOP
        FOR v_sig IN
            SELECT p.oid::regprocedure::text
              FROM pg_catalog.pg_proc p
              JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND p.proname = v_fn
        LOOP
            EXECUTE format(
                'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
            EXECUTE format(
                'GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
            v_tocadas := v_tocadas + 1;
        END LOOP;

        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_proc p
              JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = v_fn
        ) THEN
            v_ausentes := v_ausentes || v_fn;
        END IF;
    END LOOP;

    -- Las ausentes NO abortan: son deriva (el repo las declara, la base no las
    -- tiene). Se registran para que queden a la vista de INF-1.
    RAISE NOTICE 'SEG-8: % firma(s) cerrada(s). Ausentes en la base: %',
        v_tocadas, COALESCE(array_to_string(v_ausentes, ', '), 'ninguna');
END $$;

COMMIT;


-- ── Verificacion (correr despues) ───────────────────────────────────────────
-- 1. Ninguna debe listar `=X/postgres` (PUBLIC), `anon=X` ni `authenticated=X`.
--    Solo postgres y service_role. Si `permisos` sale NULL, la funcion tiene los
--    permisos por defecto y hay que mirarla aparte.
--
-- SELECT p.proname,
--        p.oid::regprocedure AS firma,
--        array_to_string(p.proacl, E'\n') AS permisos
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname = ANY(ARRAY[
--        '_glosa_actor_is_admin',
--        '_glosa_notify',
--        '_notify_school_staff',
--        '_payment_notif_data',
--        'apply_late_fees',
--        'auto_approve_payment',
--        'claim_due_recurring_subscriptions',
--        'claim_single_due_recurring_subscription',
--        'cleanup_expired_card_save_intents',
--        'cleanup_old_inactive_payment_tokens',
--        'complete_refund',
--        'conciliate_glosa',
--        'confirm_session_booking_payment',
--        'consume_card_save_intent',
--        'count_active_payment_tokens',
--        'create_glosa',
--        'detect_payment_anomalies',
--        'expire_trials',
--        'flag_payment_for_review',
--        'fn_expire_overdue_payments',
--        'generate_monthly_charges',
--        'notify_school_payment_paid',
--        'qr_first_charge_due_date',
--        'ratify_expired_glosas',
--        'reconcile_statement',
--        'record_recurring_attempt',
--        'register_card_save_intent',
--        'reopen_glosa',
--        'resolve_glosa',
--        'respond_glosa',
--        'save_payment_token',
--        'school_due_date',
--        'send_payment_reminders',
--        'split_order_payment',
--        'upsert_school_provider',
--        'wa_get_payment_status',
--        'wa_ingest_inbound_message',
--        'wa_is_blocked',
--        'wa_record_outbound_message',
--        'wa_start_identification',
--        'wa_verify_otp'
--    ])
--  ORDER BY p.proname;
--
-- 2. Prueba de humo, fuera del SQL editor: con la ANON key
--    POST /rest/v1/rpc/auto_approve_payment {"p_payment_id":"<uuid inexistente>"}
--    debe responder 401/403, no 200.
--
-- 3. Leer el NOTICE del DO: dice cuantas firmas se cerraron y cuales nombres no
--    existen en la base. Esos ultimos son deriva y van a INF-1.
