-- ============================================================================
-- 20260812180437_cerrar_a_anon_las_funciones_de_service_role.sql
-- Fecha: 2026-08-12   ·   SEG-8 (ampliado)
--
-- SEG-8 decia que `auto_approve_payment` tenia EXECUTE para anon y authenticated
-- sin ningun chequeo de autorizacion. Verificado contra la base viva: cierto,
-- `anon` la ejecuta (HTTP 200). Pero la causa NO es la que parecia, y el alcance
-- es mayor.
--
-- LA CAUSA: su migracion (20260721000001 y 20260722000004) YA hace
--   REVOKE ALL ON FUNCTION ... FROM PUBLIC;
--   GRANT EXECUTE ON FUNCTION ... TO service_role;
-- y aun asi `anon` la ejecuta. Es porque el permiso de `anon` NO viene de
-- PUBLIC: Supabase concede EXECUTE a `anon` y `authenticated` DIRECTAMENTE, por
-- privilegios por defecto del esquema `public`, al crear cada funcion. Un
-- `REVOKE ... FROM PUBLIC` no toca esos grants directos.
--
-- ⚠️ Esto corrige la nota que se dejo en SEG-3 el 2026-08-12, que decia que
-- revocar a `anon` sin revocar a PUBLIC no servia. La verdad es que hacen falta
-- LOS TRES: PUBLIC, anon y authenticated. `auto_approve_payment` es la prueba —
-- le revocaron PUBLIC y `anon` siguio entrando.
--
-- EL ALCANCE: no es una funcion, son 41. Todas declaran en su propia
-- migracion `GRANT ... TO service_role` y ninguna concede a anon/authenticated en
-- ningun lado, o sea que la intencion siempre fue que fueran internas. Entre
-- ellas hay dinero y credenciales:
--   · complete_refund, apply_late_fees, generate_monthly_charges
--   · save_payment_token, consume_card_save_intent, count_active_payment_tokens
--   · upsert_school_provider  (escribe los secretos de pasarela por escuela)
--   · wa_verify_otp           (verificacion OTP de WhatsApp)
--   · el ciclo completo de glosas
--
-- COMPROBADO EN VIVO (solo dos, a proposito):
--   auto_approve_payment  -> HTTP 200 con la anon key
--   _notify_school_staff  -> HTTP 204: se EJECUTO e inserta en `notifications`.
--                            Con un school_id real —y `schools` es legible por
--                            anon, 364 filas— un anonimo puede inyectar
--                            notificaciones con titulo, mensaje y LINK
--                            arbitrarios al staff de cualquier escuela. Es un
--                            vector de phishing dentro de la propia app.
-- Las otras 39 NO se probaron a proposito: ejecutar `complete_refund` o
-- `apply_late_fees` como anonimo para "ver si responden" seria causar el dano que
-- esto viene a evitar. Se cierran por declaracion, que ademas es idempotente.
--
-- SEGURIDAD DEL CAMBIO: se verifico que el frontend no invoca NINGUNA de las 41
-- (cero coincidencias de `rpc('<nombre>')` en frontend/src). El BFF usa
-- `service_role`, que conserva el permiso. No se rompe ningun flujo.
--
-- Convencion del repo: `SECURITY DEFINER` NO exime al caller de tener EXECUTE,
-- por eso el GRANT a service_role se re-declara despues de cada REVOKE.
-- ============================================================================

BEGIN;

-- flag_payment_for_review
REVOKE ALL ON FUNCTION public.flag_payment_for_review(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flag_payment_for_review(TEXT, UUID, TEXT) TO service_role;

-- complete_refund
REVOKE ALL ON FUNCTION public.complete_refund(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_refund(UUID, TEXT, TEXT) TO service_role;

-- confirm_session_booking_payment
REVOKE ALL ON FUNCTION public.confirm_session_booking_payment(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_session_booking_payment(UUID, TEXT, TEXT, TEXT) TO service_role;

-- split_order_payment
REVOKE ALL ON FUNCTION public.split_order_payment(UUID, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.split_order_payment(UUID, NUMERIC, NUMERIC, TEXT) TO service_role;

-- save_payment_token
REVOKE ALL ON FUNCTION public.save_payment_token( uuid, public.payment_provider, text, text, text, bigint, text, text, text, text, date, boolean ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_payment_token( uuid, public.payment_provider, text, text, text, bigint, text, text, text, text, date, boolean ) TO service_role;

-- claim_due_recurring_subscriptions
REVOKE ALL ON FUNCTION public.claim_due_recurring_subscriptions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_recurring_subscriptions(integer) TO service_role;

-- record_recurring_attempt
REVOKE ALL ON FUNCTION public.record_recurring_attempt(uuid, text, numeric, public.payment_provider, text, text, text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_recurring_attempt(uuid, text, numeric, public.payment_provider, text, text, text, text, jsonb, uuid) TO service_role;

-- register_card_save_intent
REVOKE ALL ON FUNCTION public.register_card_save_intent( text, uuid, public.payment_provider, text, text, text, text, inet, text ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_card_save_intent( text, uuid, public.payment_provider, text, text, text, text, inet, text ) TO service_role;

-- consume_card_save_intent
REVOKE ALL ON FUNCTION public.consume_card_save_intent(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_card_save_intent(text) TO service_role;

-- cleanup_expired_card_save_intents
REVOKE ALL ON FUNCTION public.cleanup_expired_card_save_intents() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_card_save_intents() TO service_role;

-- claim_single_due_recurring_subscription
REVOKE ALL ON FUNCTION public.claim_single_due_recurring_subscription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_single_due_recurring_subscription(uuid) TO service_role;

-- count_active_payment_tokens
REVOKE ALL ON FUNCTION public.count_active_payment_tokens(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_active_payment_tokens(uuid) TO service_role;

-- cleanup_old_inactive_payment_tokens
REVOKE ALL ON FUNCTION public.cleanup_old_inactive_payment_tokens() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_inactive_payment_tokens() TO service_role;

-- wa_ingest_inbound_message
REVOKE ALL ON FUNCTION public.wa_ingest_inbound_message(uuid, uuid, text, text, text, text, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_ingest_inbound_message(uuid, uuid, text, text, text, text, text, jsonb, timestamptz) TO service_role;

-- wa_record_outbound_message
REVOKE ALL ON FUNCTION public.wa_record_outbound_message(uuid, uuid, text, text, text, jsonb, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_record_outbound_message(uuid, uuid, text, text, text, jsonb, boolean, text) TO service_role;

-- wa_is_blocked
REVOKE ALL ON FUNCTION public.wa_is_blocked(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_is_blocked(uuid, text) TO service_role;

-- wa_start_identification
REVOKE ALL ON FUNCTION public.wa_start_identification(uuid, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_start_identification(uuid, text, text, text, timestamptz) TO service_role;

-- wa_verify_otp
REVOKE ALL ON FUNCTION public.wa_verify_otp(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_verify_otp(uuid, text, text) TO service_role;

-- wa_get_payment_status
REVOKE ALL ON FUNCTION public.wa_get_payment_status(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_get_payment_status(uuid, uuid) TO service_role;

-- detect_payment_anomalies
REVOKE ALL ON FUNCTION public.detect_payment_anomalies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_payment_anomalies() TO service_role;

-- apply_late_fees
REVOKE ALL ON FUNCTION public.apply_late_fees() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_late_fees() TO service_role;

-- generate_monthly_charges
REVOKE ALL ON FUNCTION public.generate_monthly_charges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_monthly_charges() TO service_role;

-- send_payment_reminders
REVOKE ALL ON FUNCTION public.send_payment_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_payment_reminders() TO service_role;

-- _glosa_actor_is_admin
REVOKE ALL ON FUNCTION public._glosa_actor_is_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._glosa_actor_is_admin(uuid, uuid) TO service_role;

-- _glosa_notify
REVOKE ALL ON FUNCTION public._glosa_notify(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._glosa_notify(uuid, uuid, text, text, text) TO service_role;

-- create_glosa
REVOKE ALL ON FUNCTION public.create_glosa(uuid, uuid, text, jsonb, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_glosa(uuid, uuid, text, jsonb, date) TO service_role;

-- respond_glosa
REVOKE ALL ON FUNCTION public.respond_glosa(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_glosa(uuid, uuid, text, jsonb) TO service_role;

-- conciliate_glosa
REVOKE ALL ON FUNCTION public.conciliate_glosa(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conciliate_glosa(uuid, uuid) TO service_role;

-- resolve_glosa
REVOKE ALL ON FUNCTION public.resolve_glosa(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_glosa(uuid, uuid, text, text) TO service_role;

-- reopen_glosa
REVOKE ALL ON FUNCTION public.reopen_glosa(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_glosa(uuid, uuid, text) TO service_role;

-- ratify_expired_glosas
REVOKE ALL ON FUNCTION public.ratify_expired_glosas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ratify_expired_glosas() TO service_role;

-- auto_approve_payment
REVOKE ALL ON FUNCTION public.auto_approve_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_approve_payment(uuid) TO service_role;

-- _payment_notif_data
REVOKE ALL ON FUNCTION public._payment_notif_data(uuid, uuid, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._payment_notif_data(uuid, uuid, uuid, uuid, numeric) TO service_role;

-- _notify_school_staff
REVOKE ALL ON FUNCTION public._notify_school_staff(uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._notify_school_staff(uuid, text, text, text, text, text, jsonb) TO service_role;

-- reconcile_statement
REVOKE ALL ON FUNCTION public.reconcile_statement(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_statement(uuid, uuid) TO service_role;

-- notify_school_payment_paid
REVOKE ALL ON FUNCTION public.notify_school_payment_paid(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_school_payment_paid(uuid) TO service_role;

-- upsert_school_provider
REVOKE ALL ON FUNCTION public.upsert_school_provider( uuid, public.payment_provider, text, jsonb, boolean, boolean, boolean, text, text, uuid, text, timestamptz ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_school_provider( uuid, public.payment_provider, text, jsonb, boolean, boolean, boolean, text, text, uuid, text, timestamptz ) TO service_role;

-- school_due_date
REVOKE ALL ON FUNCTION public.school_due_date(uuid, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.school_due_date(uuid, int, int) TO service_role;

-- qr_first_charge_due_date
REVOKE ALL ON FUNCTION public.qr_first_charge_due_date(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qr_first_charge_due_date(uuid, date) TO service_role;

-- fn_expire_overdue_payments
REVOKE ALL ON FUNCTION public.fn_expire_overdue_payments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_expire_overdue_payments() TO service_role;

-- expire_trials
REVOKE ALL ON FUNCTION public.expire_trials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_trials() TO service_role;

COMMIT;


-- ── Verificacion (correr despues) ───────────────────────────────────────────
-- 1. Ninguna debe listar `=X/postgres` (PUBLIC), `anon=X` ni `authenticated=X`.
--    Solo postgres y service_role.
--
-- SELECT p.proname, array_to_string(p.proacl, E'\n') AS permisos
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('flag_payment_for_review', 'complete_refund', 'confirm_session_booking_payment', 'split_order_payment', 'save_payment_token', 'claim_due_recurring_subscriptions', 'record_recurring_attempt', 'register_card_save_intent', 'consume_card_save_intent', 'cleanup_expired_card_save_intents', 'claim_single_due_recurring_subscription', 'count_active_payment_tokens', 'cleanup_old_inactive_payment_tokens', 'wa_ingest_inbound_message', 'wa_record_outbound_message', 'wa_is_blocked', 'wa_start_identification', 'wa_verify_otp', 'wa_get_payment_status', 'detect_payment_anomalies', 'apply_late_fees', 'generate_monthly_charges', 'send_payment_reminders', '_glosa_actor_is_admin', '_glosa_notify', 'create_glosa', 'respond_glosa', 'conciliate_glosa', 'resolve_glosa', 'reopen_glosa', 'ratify_expired_glosas', 'auto_approve_payment', '_payment_notif_data', '_notify_school_staff', 'reconcile_statement', 'notify_school_payment_paid', 'upsert_school_provider', 'school_due_date', 'qr_first_charge_due_date', 'fn_expire_overdue_payments', 'expire_trials')
--  ORDER BY p.proname;
--
-- 2. Y la prueba de humo, fuera del SQL editor: con la ANON key
--    POST /rest/v1/rpc/auto_approve_payment {"p_payment_id":"<uuid inexistente>"}
--    debe responder 401/403, no 200.
