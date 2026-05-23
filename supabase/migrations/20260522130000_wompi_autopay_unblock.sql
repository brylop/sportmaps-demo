-- ============================================================
-- SPORTMAPS — Wompi autopay unblock (Tanda 2)
--
-- Habilita el cobro recurrente con Wompi usando POST /v1/payment_sources
-- (token permanente) en lugar del token efimero del Widget (~15 min TTL).
--
-- Cambios:
--   1. payment_tokens.provider_payment_source_id BIGINT
--      Donde guardamos el ID entero permanente que devuelve Wompi al
--      crear el payment_source. Distinto de provider_token (efimero).
--   2. pending_card_saves: tabla temporal con el consent del padre.
--      Cuando el padre opta por "guardar tarjeta" + acepta Habeas Data
--      en el modal de checkout, el BFF inserta aqui los JWT que vio.
--      Despues el webhook (al recibir APPROVED) lee por reference y
--      llama POST /v1/payment_sources con esos JWT.
--   3. save_payment_token: nuevo parametro p_provider_payment_source_id.
--   4. create_recurring_subscription: levanta el guard de Wompi cuando
--      el token tiene provider_payment_source_id IS NOT NULL.
--   5. claim_due_recurring_subscriptions: devuelve provider_payment_source_id
--      ademas + FILTRA tarjetas expiradas (no intenta cobrar tarjetas con
--      expires_at < hoy — evita errores predecibles).
-- ============================================================


-- ============================================================
-- 1. payment_tokens — nuevo campo provider_payment_source_id
-- ============================================================

ALTER TABLE public.payment_tokens
    ADD COLUMN IF NOT EXISTS provider_payment_source_id bigint;

-- Unique partial: dos tokens no pueden compartir el mismo payment_source_id
-- en el mismo provider (Wompi). Permitimos NULL para tokens MP y tokens
-- Wompi viejos (pre-payment_source).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_tokens_payment_source
    ON public.payment_tokens (payment_provider, provider_payment_source_id)
    WHERE provider_payment_source_id IS NOT NULL;

COMMENT ON COLUMN public.payment_tokens.provider_payment_source_id IS
    'ID entero del payment_source en Wompi (POST /v1/payment_sources). '
    'Usado para cobros recurrentes MIT. NULL para tokens MP y tokens Wompi '
    'one-shot (efimeros del Widget).';


-- ============================================================
-- 2. pending_card_saves — consent + acceptance tokens en transit
-- ============================================================
--
-- Vida: desde que el padre confirma "guardar tarjeta" en el modal hasta
-- que el webhook lo consume tras APPROVED. TTL natural ~30 min (el Widget
-- expira el token efimero en 15 min; nos da margen).
--
-- Por que tabla separada (no columna en payments/orders/etc.):
--   - El consent vive cross-cutting de cualquier tipo de checkout.
--   - Si el pago se cae (DECLINED), el consent expira y no se usa.
--   - Tiene PII (ip, ua, JWT) que prefiero aislar en una tabla con
--     politica de RLS clara, no esparcida en tablas de negocio.

CREATE TABLE IF NOT EXISTS public.pending_card_saves (
    id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    reference                text        NOT NULL UNIQUE,    -- mismo reference que la tx
    user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_provider         public.payment_provider NOT NULL,

    -- JWT que vio el usuario y que el BFF mandara al provider
    acceptance_token         text        NOT NULL,
    personal_data_auth_token text        NOT NULL,
    acceptance_permalink     text,
    personal_data_permalink  text,

    -- Trazabilidad legal
    accepted_at              timestamptz NOT NULL DEFAULT now(),
    ip_address               inet,
    user_agent               text,

    -- Estado
    consumed_at              timestamptz,                    -- cuando el webhook lo uso
    expires_at               timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),

    created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_card_saves_user
    ON public.pending_card_saves(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_card_saves_unconsumed
    ON public.pending_card_saves(reference)
    WHERE consumed_at IS NULL;

ALTER TABLE public.pending_card_saves ENABLE ROW LEVEL SECURITY;

-- Titular puede leer SUS pendientes (debug en frontend). No INSERT ni UPDATE
-- desde authenticated: solo el BFF via service_role los maneja.
DROP POLICY IF EXISTS "pending_card_saves_owner_select" ON public.pending_card_saves;
CREATE POLICY "pending_card_saves_owner_select" ON public.pending_card_saves
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

COMMENT ON TABLE public.pending_card_saves IS
    'Consent + acceptance tokens del padre, vive entre el checkout y el webhook. '
    'TTL 30 min. El BFF consume al recibir APPROVED y crea payment_source.';


-- ============================================================
-- 3. save_payment_token — agregar parametro provider_payment_source_id
--
-- IMPORTANTE: cambia la firma. Hay que hacer DROP + CREATE porque
-- CREATE OR REPLACE con parametros distintos falla. Re-emitimos GRANT.
-- ============================================================

DROP FUNCTION IF EXISTS public.save_payment_token(uuid, text, public.payment_provider, text, text, text, text, text, text, text, date, boolean);
DROP FUNCTION IF EXISTS public.save_payment_token(uuid, text, public.payment_provider, text, text, text, text, text, text, date, boolean);
DROP FUNCTION IF EXISTS public.save_payment_token(uuid, text, text, text, text, text, date, boolean);

CREATE OR REPLACE FUNCTION public.save_payment_token(
    p_user_id                     uuid,
    p_payment_provider            public.payment_provider,
    p_provider_token              text     DEFAULT NULL,
    p_provider_customer_id        text     DEFAULT NULL,
    p_provider_card_id            text     DEFAULT NULL,
    p_provider_payment_source_id  bigint   DEFAULT NULL,
    p_payment_method_type         text     DEFAULT 'CARD',
    p_last_four                   text     DEFAULT NULL,
    p_brand                       text     DEFAULT NULL,
    p_holder_name                 text     DEFAULT NULL,
    p_expires_at                  date     DEFAULT NULL,
    p_set_default                 boolean  DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_token_id uuid;
BEGIN
    -- Resolver UPSERT por (provider, identificador). Para Wompi con payment_source
    -- el identificador es provider_payment_source_id; sino provider_token o
    -- (customer_id, card_id) en MP.
    IF p_provider_payment_source_id IS NOT NULL THEN
        SELECT id INTO v_token_id
          FROM public.payment_tokens
         WHERE payment_provider = p_payment_provider
           AND provider_payment_source_id = p_provider_payment_source_id
         LIMIT 1;
    ELSIF p_provider_token IS NOT NULL THEN
        SELECT id INTO v_token_id
          FROM public.payment_tokens
         WHERE payment_provider = p_payment_provider
           AND provider_token = p_provider_token
         LIMIT 1;
    ELSIF p_provider_customer_id IS NOT NULL AND p_provider_card_id IS NOT NULL THEN
        SELECT id INTO v_token_id
          FROM public.payment_tokens
         WHERE payment_provider = p_payment_provider
           AND provider_customer_id = p_provider_customer_id
           AND provider_card_id = p_provider_card_id
         LIMIT 1;
    END IF;

    IF v_token_id IS NULL THEN
        INSERT INTO public.payment_tokens (
            user_id, payment_provider, provider_token, provider_customer_id,
            provider_card_id, provider_payment_source_id,
            payment_method_type, last_four, brand, holder_name, expires_at,
            is_default, is_active
        ) VALUES (
            p_user_id, p_payment_provider, p_provider_token, p_provider_customer_id,
            p_provider_card_id, p_provider_payment_source_id,
            p_payment_method_type, p_last_four, p_brand, p_holder_name, p_expires_at,
            p_set_default, true
        )
        RETURNING id INTO v_token_id;
    ELSE
        -- Existe: solo actualizamos metadatos no sensibles + reactivamos si estaba
        -- soft-deleted (el provider acepto la misma tarjeta de nuevo).
        UPDATE public.payment_tokens
           SET payment_method_type = COALESCE(p_payment_method_type, payment_method_type),
               last_four           = COALESCE(p_last_four, last_four),
               brand               = COALESCE(p_brand, brand),
               holder_name         = COALESCE(p_holder_name, holder_name),
               expires_at          = COALESCE(p_expires_at, expires_at),
               is_active           = true,
               updated_at          = now()
         WHERE id = v_token_id;
    END IF;

    IF p_set_default THEN
        UPDATE public.payment_tokens
           SET is_default = (id = v_token_id),
               updated_at = CASE WHEN is_default <> (id = v_token_id) THEN now() ELSE updated_at END
         WHERE user_id = p_user_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'token_id', v_token_id);
END;
$$;

REVOKE ALL ON FUNCTION public.save_payment_token(
    uuid, public.payment_provider, text, text, text, bigint, text, text, text, text, date, boolean
) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_payment_token(
    uuid, public.payment_provider, text, text, text, bigint, text, text, text, text, date, boolean
) TO service_role;


-- ============================================================
-- 4. create_recurring_subscription — permitir Wompi con payment_source
--
-- Misma firma que la migracion P0 (20260522120000); reemplaza el bloque
-- guard de provider:
--   ANTES: rechaza si provider <> mercadopago
--   AHORA: rechaza solo si Wompi sin provider_payment_source_id
--          (token aun no convertido a payment_source permanente).
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
    v_user_id                  uuid := auth.uid();
    v_token_owner              uuid;
    v_token_provider           public.payment_provider;
    v_token_payment_source_id  bigint;
    v_canonical_price          numeric;
    v_max_allowed              numeric;
    v_sub_id                   uuid;
    v_next                     timestamptz;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
    END IF;

    SELECT user_id, payment_provider, provider_payment_source_id
      INTO v_token_owner, v_token_provider, v_token_payment_source_id
      FROM public.payment_tokens
     WHERE id = p_payment_token_id AND is_active = true;

    IF v_token_owner IS NULL OR v_token_owner <> v_user_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'token_not_owned');
    END IF;

    -- Guard provider:
    --   MP: ok (usa customer_id + card_id, ya implementado)
    --   Wompi: requiere provider_payment_source_id (POST /v1/payment_sources
    --          ya completado). Tokens Wompi viejos sin payment_source ya no
    --          sirven para recurrente — el padre debe re-tokenizar.
    IF v_token_provider = 'wompi' AND v_token_payment_source_id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'wompi_payment_source_missing',
            'message', 'Esta tarjeta Wompi no esta lista para cobros automaticos. Por favor agrega la tarjeta de nuevo desde el modal de pago.'
        );
    END IF;

    -- Child debe ser hijo del padre
    IF p_child_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.id = p_child_id AND c.parent_id = v_user_id
        ) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'child_not_owned');
        END IF;
    END IF;

    -- Validacion de monto canonico (heredado de migracion P0)
    IF p_program_id IS NOT NULL THEN
        SELECT NULLIF(price_monthly, 0) INTO v_canonical_price
          FROM public.programs
         WHERE id = p_program_id AND school_id = p_school_id;
    END IF;

    IF v_canonical_price IS NULL AND p_child_id IS NOT NULL THEN
        SELECT NULLIF(monthly_fee, 0) INTO v_canonical_price
          FROM public.children
         WHERE id = p_child_id;
    END IF;

    IF v_canonical_price IS NOT NULL THEN
        v_max_allowed := v_canonical_price * 1.10;
        IF p_amount > v_max_allowed THEN
            RETURN jsonb_build_object(
                'ok', false, 'error', 'amount_above_canonical',
                'message', format('El monto %s excede el precio configurado %s (+10%% tolerancia).', p_amount, v_canonical_price),
                'canonical_price', v_canonical_price, 'max_allowed', v_max_allowed
            );
        END IF;
        IF p_amount < v_canonical_price * 0.90 THEN
            RETURN jsonb_build_object(
                'ok', false, 'error', 'amount_below_canonical',
                'message', format('El monto %s esta muy por debajo del precio configurado %s (-10%% tolerancia). Posible error de unidades.', p_amount, v_canonical_price),
                'canonical_price', v_canonical_price
            );
        END IF;
    END IF;

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


-- ============================================================
-- 5. claim_due_recurring_subscriptions — agregar provider_payment_source_id
--    + filtrar tarjetas expiradas
--
-- DROP + CREATE: cambia el RETURN TABLE (nueva columna), Postgres no
-- permite ALTER de tipo de retorno con CREATE OR REPLACE.
-- ============================================================

DROP FUNCTION IF EXISTS public.claim_due_recurring_subscriptions(integer);

CREATE OR REPLACE FUNCTION public.claim_due_recurring_subscriptions(p_limit integer DEFAULT 50)
RETURNS TABLE (
    subscription_id            uuid,
    school_id                  uuid,
    user_id                    uuid,
    child_id                   uuid,
    amount                     numeric,
    currency                   text,
    concept                    text,
    payment_token_id           uuid,
    payment_provider           public.payment_provider,
    provider_token             text,
    provider_customer_id       text,
    provider_card_id           text,
    provider_payment_source_id bigint,
    user_email                 text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH due AS (
        SELECT s.id
          FROM public.recurring_subscriptions s
          JOIN public.payment_tokens t ON t.id = s.payment_token_id
         WHERE s.status = 'active'
           AND s.next_charge_at <= now()
           AND t.is_active = true
           -- Filtro tarjetas expiradas: no intentamos cobrar tarjetas
           -- con expires_at < hoy. El runner emite un email "actualiza
           -- tu tarjeta" aparte (TODO Tanda 3).
           AND (t.expires_at IS NULL OR t.expires_at >= CURRENT_DATE)
         ORDER BY s.next_charge_at
         FOR UPDATE SKIP LOCKED
         LIMIT GREATEST(p_limit, 1)
    )
    SELECT
        s.id,
        s.school_id,
        s.user_id,
        s.child_id,
        s.amount,
        s.currency,
        s.concept,
        s.payment_token_id,
        t.payment_provider,
        t.provider_token,
        t.provider_customer_id,
        t.provider_card_id,
        t.provider_payment_source_id,
        u.email
      FROM due
      JOIN public.recurring_subscriptions s ON s.id = due.id
      JOIN public.payment_tokens t          ON t.id = s.payment_token_id
      JOIN auth.users u                     ON u.id = s.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_recurring_subscriptions(integer) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_due_recurring_subscriptions(integer) TO service_role;


-- ============================================================
-- 6. RPCs de soporte para pending_card_saves
-- ============================================================

-- Crea un consent (lo llama el BFF al inicio del checkout cuando el padre
-- opta por guardar tarjeta).
CREATE OR REPLACE FUNCTION public.register_card_save_intent(
    p_reference                text,
    p_user_id                  uuid,
    p_payment_provider         public.payment_provider,
    p_acceptance_token         text,
    p_personal_data_auth_token text,
    p_acceptance_permalink     text,
    p_personal_data_permalink  text,
    p_ip_address               inet,
    p_user_agent               text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
    INSERT INTO public.pending_card_saves (
        reference, user_id, payment_provider,
        acceptance_token, personal_data_auth_token,
        acceptance_permalink, personal_data_permalink,
        ip_address, user_agent
    ) VALUES (
        p_reference, p_user_id, p_payment_provider,
        p_acceptance_token, p_personal_data_auth_token,
        p_acceptance_permalink, p_personal_data_permalink,
        p_ip_address, p_user_agent
    )
    ON CONFLICT (reference) DO UPDATE
        SET acceptance_token         = EXCLUDED.acceptance_token,
            personal_data_auth_token = EXCLUDED.personal_data_auth_token,
            accepted_at              = now(),
            ip_address               = EXCLUDED.ip_address,
            user_agent               = EXCLUDED.user_agent,
            expires_at               = now() + interval '30 minutes',
            consumed_at              = NULL
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('ok', true, 'pending_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.register_card_save_intent(
    text, uuid, public.payment_provider, text, text, text, text, inet, text
) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.register_card_save_intent(
    text, uuid, public.payment_provider, text, text, text, text, inet, text
) TO service_role;


-- Consume un consent (lo llama el webhook). Devuelve los JWT y marca consumed.
CREATE OR REPLACE FUNCTION public.consume_card_save_intent(p_reference text)
RETURNS TABLE (
    user_id                  uuid,
    payment_provider         public.payment_provider,
    acceptance_token         text,
    personal_data_auth_token text,
    acceptance_permalink     text,
    personal_data_permalink  text,
    ip_address               inet,
    user_agent               text,
    accepted_at              timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    UPDATE public.pending_card_saves
       SET consumed_at = now()
     WHERE reference = p_reference
       AND consumed_at IS NULL
       AND expires_at > now()
    RETURNING
        pending_card_saves.user_id,
        pending_card_saves.payment_provider,
        pending_card_saves.acceptance_token,
        pending_card_saves.personal_data_auth_token,
        pending_card_saves.acceptance_permalink,
        pending_card_saves.personal_data_permalink,
        pending_card_saves.ip_address,
        pending_card_saves.user_agent,
        pending_card_saves.accepted_at;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_card_save_intent(text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.consume_card_save_intent(text) TO service_role;


-- ============================================================
-- 7. Cleanup de pending_card_saves expirados
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_card_save_intents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_deleted integer;
BEGIN
    DELETE FROM public.pending_card_saves
     WHERE expires_at < now() - interval '24 hours'   -- mantener 24h post-expiry para forense
       AND consumed_at IS NULL;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_card_save_intents() TO service_role;
