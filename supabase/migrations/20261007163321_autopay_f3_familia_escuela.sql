-- =============================================================================
-- 20261007163321_autopay_f3_familia_escuela.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-07   Versión anterior: 20261007134859
-- Objetivo: F3 del débito automático (docs/specs/debito-automatico.md §11). Las dos
--   escrituras que la familia y la escuela necesitan y que F1 no trae:
--     1. autopay_update_subscription: el pagador cambia el tope o el medio. Si la
--        suscripción estaba suspendida por tope, medio o rechazos (D12), cambiarla la
--        reactiva; y el ciclo del mes que se omitió por esa causa, si el cobro sigue
--        pending y no vencido, vuelve a planificarse (sale un aviso nuevo).
--        La suspensión por cobro doble NO la levanta la familia: la cierra la escuela.
--     2. autopay_resolve_incident: el admin de la escuela marca un incidente
--        (devolución pedida / hecha / saldo a favor / descartado). Al cerrar el último
--        cobro doble abierto de una suscripción suspendida por eso, se reactiva.
--   Solo service_role (el BFF), con actor explícito (B1).
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

CREATE FUNCTION public.autopay_update_subscription(
  p_user_id          uuid,
  p_subscription_id  uuid,
  p_max_amount       numeric DEFAULT NULL,
  p_token_id         uuid    DEFAULT NULL,
  p_today            date    DEFAULT (now() AT TIME ZONE 'America/Bogota')::date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_sub   public.recurring_subscriptions;
  v_tok   public.payment_tokens;
  v_react boolean := false;
BEGIN
  IF p_max_amount IS NULL AND p_token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nothing_to_change');
  END IF;

  SELECT * INTO v_sub FROM public.recurring_subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_sub.payer_user_id <> p_user_id THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF v_sub.status = 'cancelled' THEN RETURN jsonb_build_object('ok', false, 'error', 'cancelled'); END IF;
  IF v_sub.status = 'suspended' AND v_sub.suspend_reason = 'duplicate_charge' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'suspended_duplicate_charge');
  END IF;

  IF p_max_amount IS NOT NULL AND p_max_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_max_amount');
  END IF;

  IF p_token_id IS NOT NULL THEN
    SELECT * INTO v_tok FROM public.payment_tokens WHERE id = p_token_id;
    IF NOT FOUND OR v_tok.user_id <> p_user_id OR v_tok.school_id IS DISTINCT FROM v_sub.school_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'token_not_owned');
    END IF;
    IF v_tok.status IS DISTINCT FROM 'available' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'token_not_available');
    END IF;
  END IF;

  v_react := v_sub.status = 'suspended';

  UPDATE public.recurring_subscriptions
     SET max_amount           = COALESCE(p_max_amount, max_amount),
         payment_token_id     = COALESCE(p_token_id, payment_token_id),
         status               = 'active',
         suspend_reason       = NULL,
         suspended_at         = NULL,
         cycles_without_debit = CASE WHEN v_react THEN 0 ELSE cycles_without_debit END,
         updated_at           = now()
   WHERE id = p_subscription_id;

  -- El mes que se omitió por tope o por medio vuelve a planificarse si todavía se
  -- puede debitar: cobro pending y no vencido. Sale un aviso nuevo (D4).
  UPDATE public.autopay_cycles c
     SET state = 'scheduled', skip_reason = NULL, notice_sent_at = NULL, announced_total = NULL,
         first_attempt_on = NULL, next_attempt_on = NULL, updated_at = now()
    FROM public.payments p
   WHERE c.subscription_id = p_subscription_id
     AND c.state = 'skipped' AND c.skip_reason IN ('over_max_amount', 'token_not_available')
     AND p.id = c.payment_id AND p.status = 'pending' AND p.due_date >= p_today;

  RETURN jsonb_build_object('ok', true, 'reactivated', v_react);
END;
$$;

CREATE FUNCTION public.autopay_resolve_incident(
  p_actor_id    uuid,
  p_incident_id uuid,
  p_state       text,
  p_note        text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_inc public.autopay_incidents;
BEGIN
  IF p_state NOT IN ('refund_requested', 'refunded', 'credited', 'dismissed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  SELECT * INTO v_inc FROM public.autopay_incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF p_actor_id IS NULL OR v_inc.school_id IS NULL
     OR NOT (v_inc.school_id = ANY (public.autopay_admin_school_ids_for(p_actor_id))) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF v_inc.state IN ('refunded', 'credited', 'dismissed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_closed', 'state', v_inc.state);
  END IF;

  UPDATE public.autopay_incidents
     SET state = p_state,
         resolution_note = COALESCE(left(p_note, 500), resolution_note),
         resolved_by = CASE WHEN p_state = 'refund_requested' THEN resolved_by ELSE p_actor_id END,
         resolved_at = CASE WHEN p_state = 'refund_requested' THEN resolved_at ELSE now() END
   WHERE id = p_incident_id;

  -- Cobro doble cerrado: si era el último abierto, la suscripción vuelve a activa.
  IF v_inc.kind = 'duplicate_charge' AND p_state <> 'refund_requested' AND v_inc.subscription_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.autopay_incidents i
                      WHERE i.subscription_id = v_inc.subscription_id AND i.kind = 'duplicate_charge'
                        AND i.state IN ('open', 'refund_requested') AND i.id <> p_incident_id) THEN
    UPDATE public.recurring_subscriptions
       SET status = 'active', suspend_reason = NULL, suspended_at = NULL, updated_at = now()
     WHERE id = v_inc.subscription_id AND status = 'suspended' AND suspend_reason = 'duplicate_charge';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.autopay_update_subscription(uuid, uuid, numeric, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autopay_resolve_incident(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.autopay_update_subscription(uuid, uuid, numeric, uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.autopay_resolve_incident(uuid, uuid, text, text) TO service_role;

COMMIT;
