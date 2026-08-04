-- ============================================================
-- SPORTMAPS — Correctivas sobre 20260512000001_recurring_subscriptions.sql
--
-- 1. Hardening de search_path en las 6 funciones del RPC family.
--    Politica de la casa: SET search_path = pg_catalog, public, pg_temp
--    (la migracion original las dejo con solo `public`).
--
-- 2. Guard de provider en create_recurring_subscription:
--    Wompi autopay no esta soportado hasta que SportMaps tenga la API de
--    `payment_sources` (token reusable) habilitada via contrato "operador
--    tecnologico" / Pagos a Terceros. El token que captura hoy el webhook
--    es el efimero del Widget (~15 min TTL), insuficiente para cobros
--    recurrentes. Mientras tanto, solo MercadoPago (customer_id + card_id
--    permanentes) puede correr autopay.
-- ============================================================


-- ============================================================
-- 1. ALTER FUNCTION SET search_path en las 5 funciones que no cambian de cuerpo
-- ============================================================

ALTER FUNCTION public.pause_recurring_subscription(uuid)
    SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.resume_recurring_subscription(uuid)
    SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.cancel_recurring_subscription(uuid, text)
    SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.claim_due_recurring_subscriptions(integer)
    SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.record_recurring_attempt(
    uuid, text, numeric, public.payment_provider, text, text, text, text, jsonb, uuid
)
    SET search_path = pg_catalog, public, pg_temp;


-- ============================================================
-- 2. CREATE OR REPLACE create_recurring_subscription con guard Wompi
--    + search_path correcto. Misma firma para mantener GRANTs vigentes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_recurring_subscription(
    p_school_id        uuid,
    p_child_id         uuid,
    p_payment_token_id uuid,
    p_amount           numeric,
    p_billing_day      smallint DEFAULT 1,
    p_concept          text     DEFAULT 'Mensualidad',
    p_program_id       uuid     DEFAULT NULL,
    p_team_id          uuid     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id        uuid := auth.uid();
    v_token_owner    uuid;
    v_token_provider public.payment_provider;
    v_sub_id         uuid;
    v_next           timestamptz;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    -- El token tiene que pertenecer al mismo user que crea la sub.
    SELECT user_id, payment_provider INTO v_token_owner, v_token_provider
      FROM public.payment_tokens
     WHERE id = p_payment_token_id;

    IF v_token_owner IS NULL OR v_token_owner <> v_user_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'token_not_owned');
    END IF;

    -- Wompi autopay aun no esta soportado: requiere convertir el token efimero
    -- del Widget en un payment_source_id permanente via POST /v1/payment_sources,
    -- y eso depende del contrato "operador tecnologico" / Pagos a Terceros con
    -- Wompi (pendiente, ver project_payments_roadmap Fase 3). Hasta entonces
    -- solo MercadoPago.
    IF v_token_provider <> 'mercadopago' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'autopay_provider_not_supported',
            'message', 'Por ahora el pago automatico solo esta disponible con MercadoPago.'
        );
    END IF;

    -- Si hay child, debe ser hijo del padre.
    IF p_child_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.id = p_child_id AND c.parent_id = v_user_id
        ) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'child_not_owned');
        END IF;
    END IF;

    -- Calcular siguiente cobro: el dia billing_day del MES SIGUIENTE.
    -- Asi le damos al padre un mes "gratis" desde la suscripcion.
    v_next := date_trunc('month', now()) + interval '1 month'
            + ((p_billing_day - 1) || ' days')::interval;

    INSERT INTO public.recurring_subscriptions (
        school_id, user_id, child_id, program_id, team_id,
        payment_token_id, amount, concept, billing_day, next_charge_at
    ) VALUES (
        p_school_id, v_user_id, p_child_id, p_program_id, p_team_id,
        p_payment_token_id, p_amount, COALESCE(p_concept, 'Mensualidad'),
        COALESCE(p_billing_day, 1), v_next
    )
    RETURNING id INTO v_sub_id;

    RETURN jsonb_build_object('ok', true, 'subscription_id', v_sub_id, 'next_charge_at', v_next);
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_subscribed');
END;
$$;
