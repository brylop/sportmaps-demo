-- ============================================================
-- SPORTMAPS — Fix H-06 (auditoria de duplicacion de pagos)
--
-- Problema: record_recurring_attempt hacia
--     INSERT ... ON CONFLICT (idempotency_key) DO NOTHING
-- pero luego avanzaba next_charge_at / incrementaba failed_attempts
-- SIEMPRE, aunque el intento fuera duplicado. Si el mismo cobro se
-- registraba dos veces (re-run del cron, segundo worker), el 2do
-- registro saltaba el INSERT pero IGUAL avanzaba next_charge_at un mes
-- mas -> la sub se "saltaba" un mes de cobro (sub-cobro silencioso).
--
-- Fix: detectar si el INSERT realmente inserto (RETURNING + FOUND). Si
-- fue duplicado (misma idempotency_key) NO se avanza ni se incrementa:
-- se retorna idempotente con el estado actual intacto.
--
-- No se altera la firma ni los grants; es CREATE OR REPLACE puro.
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_recurring_attempt(
    p_subscription_id    uuid,
    p_status             text,
    p_amount             numeric,
    p_payment_provider   public.payment_provider,
    p_provider_payment_id text DEFAULT NULL,
    p_error_code         text DEFAULT NULL,
    p_error_message      text DEFAULT NULL,
    p_idempotency_key    text DEFAULT NULL,
    p_raw_response       jsonb DEFAULT NULL,
    p_payment_id         uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_sub          RECORD;
    v_new_next     timestamptz;
    v_new_status   text;
    v_new_failed   integer;
    v_inserted_id  uuid;
BEGIN
    SELECT * INTO v_sub FROM public.recurring_subscriptions WHERE id = p_subscription_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'subscription_not_found');
    END IF;

    -- Registrar el intento (idempotente por idempotency_key). RETURNING nos
    -- dice si REALMENTE se inserto: si hubo conflicto, v_inserted_id queda NULL
    -- y FOUND = false.
    INSERT INTO public.recurring_charge_attempts (
        subscription_id, amount, currency, payment_provider, status,
        provider_payment_id, error_code, error_message,
        idempotency_key, raw_response, payment_id
    ) VALUES (
        p_subscription_id, p_amount, v_sub.currency, p_payment_provider,
        CASE WHEN p_status = 'success' THEN 'success' ELSE 'failed' END,
        p_provider_payment_id, p_error_code, p_error_message,
        p_idempotency_key, p_raw_response, p_payment_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_inserted_id;

    -- Intento DUPLICADO (misma idempotency_key ya registrada): NO avanzar ni
    -- incrementar nada. Devolver el estado actual intacto. Solo aplica cuando
    -- hubo una key real; con key NULL el INSERT siempre entra (FOUND = true).
    IF v_inserted_id IS NULL AND p_idempotency_key IS NOT NULL THEN
        RETURN jsonb_build_object(
            'ok', true,
            'idempotent', true,
            'next_charge_at', v_sub.next_charge_at,
            'status', v_sub.status
        );
    END IF;

    IF p_status = 'success' THEN
        -- Avanzar al siguiente mes (alineado al billing_day)
        v_new_next := (
            date_trunc('month', v_sub.next_charge_at) + interval '1 month'
            + ((v_sub.billing_day - 1) || ' days')::interval
        );
        UPDATE public.recurring_subscriptions
           SET next_charge_at  = v_new_next,
               last_charge_at  = now(),
               last_payment_id = p_payment_id,
               failed_attempts = 0,
               updated_at      = now()
         WHERE id = p_subscription_id;
    ELSE
        -- Fallo: ¿retry o suspend?
        v_new_failed := v_sub.failed_attempts + 1;
        IF v_new_failed >= v_sub.max_attempts THEN
            v_new_status := 'suspended';
            v_new_next   := v_sub.next_charge_at;          -- no avanzar
        ELSE
            v_new_status := 'active';
            v_new_next   := now() + (v_sub.retry_backoff_hours || ' hours')::interval;
        END IF;
        UPDATE public.recurring_subscriptions
           SET status          = v_new_status,
               next_charge_at  = v_new_next,
               failed_attempts = v_new_failed,
               updated_at      = now()
         WHERE id = p_subscription_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'next_charge_at', v_new_next, 'status', COALESCE(v_new_status, v_sub.status));
END;
$$;

-- Re-afirmar privilegios (CREATE OR REPLACE los conserva, pero lo dejamos
-- explicito para que la migracion sea autocontenida).
REVOKE ALL ON FUNCTION public.record_recurring_attempt(uuid, text, numeric, public.payment_provider, text, text, text, text, jsonb, uuid)
    FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_recurring_attempt(uuid, text, numeric, public.payment_provider, text, text, text, text, jsonb, uuid)
    TO service_role;
