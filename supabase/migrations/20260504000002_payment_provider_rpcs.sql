-- ============================================================================
-- Payment Provider RPCs — extension multi-gateway.
--
-- Reescribe las RPCs de confirmacion / refund / token / split para que escriban
-- las columnas genericas (provider_reference, provider_transaction_id,
-- payment_provider) ademas de las legacy (wompi_*).
--
-- Estrategia:
--  - Mantener firma exacta para no romper callers existentes (BFF llama con
--    los mismos parametros). El nombre "p_wompi_*" se conserva como alias
--    semantico de "provider_*".
--  - p_payment_method (o p_provider donde no exista) determina el provider:
--      'wompi'        → escribe wompi_* + provider_*
--      'mercadopago'  → escribe provider_* unicamente; wompi_* queda NULL
--                       cuando no hay valor previo
--  - Idempotency check: usa (payment_provider, provider_transaction_id) en
--    vez de wompi_transaction_id solo, asi MP es idempotente igual.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: resuelve provider desde texto. 'mp', 'mercadopago', 'mercado pago' → 'mercadopago'.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resolve_payment_provider(p_method TEXT)
RETURNS public.payment_provider
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_method IS NULL THEN 'wompi'::public.payment_provider
        WHEN lower(p_method) IN ('mercadopago', 'mp', 'mercado pago', 'mercadolibre') THEN 'mercadopago'::public.payment_provider
        ELSE 'wompi'::public.payment_provider
    END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. confirm_order_payment — multi-provider
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.confirm_order_payment(
    p_order_id UUID,
    p_wompi_reference TEXT,           -- semantica: provider_reference
    p_wompi_transaction_id TEXT,      -- semantica: provider_transaction_id
    p_payment_method_type TEXT DEFAULT 'CARD',
    p_provider TEXT DEFAULT 'wompi'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_stock_before INT;
    v_stock_after INT;
    v_has_variants BOOLEAN := EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='product_variants'
    );
    v_provider public.payment_provider := public.resolve_payment_provider(p_provider);
    v_is_wompi BOOLEAN := v_provider = 'wompi';
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

    -- Idempotency: misma transaccion del mismo provider ya procesada
    IF v_order.status = 'paid'
       AND v_order.provider_transaction_id = p_wompi_transaction_id
       AND v_order.payment_provider = v_provider
    THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true);
    END IF;

    -- Compat: si la fila aun no tiene provider_* (datos legacy) tambien chequea wompi_*
    IF v_order.status = 'paid'
       AND v_is_wompi
       AND v_order.wompi_transaction_id = p_wompi_transaction_id
    THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true, 'legacy_match', true);
    END IF;

    IF v_order.status NOT IN ('pending', 'payment_review') THEN
        RAISE EXCEPTION 'order_not_pending: %', v_order.status;
    END IF;

    FOR v_item IN
        SELECT id, product_id, variant_id, quantity
        FROM public.order_items
        WHERE order_id = p_order_id
        ORDER BY product_id, variant_id NULLS FIRST
    LOOP
        IF v_item.variant_id IS NOT NULL AND v_has_variants THEN
            EXECUTE 'SELECT stock FROM public.product_variants WHERE id = $1 FOR UPDATE'
                INTO v_stock_before USING v_item.variant_id;

            IF v_stock_before IS NULL OR v_stock_before < v_item.quantity THEN
                RAISE EXCEPTION 'insufficient_stock_variant: %', v_item.variant_id;
            END IF;

            v_stock_after := v_stock_before - v_item.quantity;
            EXECUTE 'UPDATE public.product_variants SET stock = $1, updated_at = NOW() WHERE id = $2'
                USING v_stock_after, v_item.variant_id;
        ELSE
            SELECT stock INTO v_stock_before FROM public.products WHERE id = v_item.product_id FOR UPDATE;
            IF v_stock_before IS NULL OR v_stock_before < v_item.quantity THEN
                RAISE EXCEPTION 'insufficient_stock_product: %', v_item.product_id;
            END IF;

            v_stock_after := v_stock_before - v_item.quantity;
            UPDATE public.products SET stock = v_stock_after, updated_at = NOW() WHERE id = v_item.product_id;
        END IF;

        INSERT INTO public.inventory_logs (
            product_id, variant_id, vendor_id, delta, stock_before, stock_after, reason, order_id
        ) VALUES (
            v_item.product_id,
            v_item.variant_id,
            (SELECT vendor_id FROM public.products WHERE id = v_item.product_id),
            -v_item.quantity,
            v_stock_before,
            v_stock_after,
            'order_paid',
            p_order_id
        );
    END LOOP;

    UPDATE public.orders
    SET status = 'paid',
        payment_provider = v_provider,
        provider_reference = p_wompi_reference,
        provider_transaction_id = p_wompi_transaction_id,
        wompi_reference = CASE WHEN v_is_wompi THEN p_wompi_reference ELSE wompi_reference END,
        wompi_transaction_id = CASE WHEN v_is_wompi THEN p_wompi_transaction_id ELSE wompi_transaction_id END,
        payment_method = COALESCE(p_payment_method_type, v_provider::text),
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'provider', v_provider,
        'provider_reference', p_wompi_reference
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_order_payment(UUID, TEXT, TEXT, TEXT, TEXT)
    TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. confirm_marketplace_payment — multi-provider (solo si tabla existe)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
        RAISE NOTICE 'marketplace_transactions no existe; saltando confirm_marketplace_payment.';
        RETURN;
    END IF;

    DROP FUNCTION IF EXISTS public.confirm_marketplace_payment(UUID, TEXT, TEXT);
    DROP FUNCTION IF EXISTS public.confirm_marketplace_payment(UUID, TEXT, TEXT, TEXT);
    DROP FUNCTION IF EXISTS public.confirm_marketplace_payment(UUID, TEXT, TEXT, TEXT, TEXT);

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.confirm_marketplace_payment(
            p_transaction_id UUID,
            p_wompi_reference TEXT,
            p_wompi_transaction_id TEXT,
            p_payment_method TEXT DEFAULT 'wompi',
            p_provider TEXT DEFAULT NULL
        )
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        DECLARE
            v_tx RECORD;
            v_provider public.payment_provider := public.resolve_payment_provider(COALESCE(p_provider, p_payment_method));
            v_is_wompi BOOLEAN := v_provider = 'wompi';
        BEGIN
            SELECT * INTO v_tx FROM public.marketplace_transactions WHERE id = p_transaction_id FOR UPDATE;
            IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;

            IF v_tx.status = 'paid'
               AND v_tx.provider_transaction_id = p_wompi_transaction_id
               AND v_tx.payment_provider = v_provider
            THEN
                RETURN jsonb_build_object('ok', true, 'idempotent', true, 'checkout_type', v_tx.checkout_type);
            END IF;

            IF v_tx.status = 'paid'
               AND v_is_wompi
               AND v_tx.wompi_transaction_id = p_wompi_transaction_id
            THEN
                RETURN jsonb_build_object('ok', true, 'idempotent', true, 'legacy_match', true, 'checkout_type', v_tx.checkout_type);
            END IF;

            UPDATE public.marketplace_transactions
            SET status = 'paid',
                payment_provider = v_provider,
                provider_reference = p_wompi_reference,
                provider_transaction_id = p_wompi_transaction_id,
                wompi_reference = CASE WHEN v_is_wompi THEN p_wompi_reference ELSE wompi_reference END,
                wompi_transaction_id = CASE WHEN v_is_wompi THEN p_wompi_transaction_id ELSE wompi_transaction_id END,
                payment_method = p_payment_method,
                paid_at = NOW(),
                updated_at = NOW()
            WHERE id = p_transaction_id;

            -- Side effects (sin cambios respecto al original)
            IF v_tx.checkout_type = 'service' AND v_tx.appointment_id IS NOT NULL
               AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='wellness_appointments')
            THEN
                EXECUTE 'UPDATE public.wellness_appointments SET status = ''confirmed'', payment_status = ''paid'', updated_at = NOW() WHERE id = $1'
                    USING v_tx.appointment_id;
            ELSIF v_tx.checkout_type = 'event' AND v_tx.event_registration_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='event_registrations')
            THEN
                EXECUTE 'UPDATE public.event_registrations SET status = ''confirmed'', payment_status = ''paid'', updated_at = NOW() WHERE id = $1'
                    USING v_tx.event_registration_id;
            ELSIF v_tx.checkout_type = 'subscription' AND v_tx.subscription_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='subscriptions')
            THEN
                EXECUTE 'UPDATE public.subscriptions SET status = ''active'', current_period_paid = true, updated_at = NOW() WHERE id = $1'
                    USING v_tx.subscription_id;
            END IF;

            RETURN jsonb_build_object(
                'ok', true,
                'transaction_id', p_transaction_id,
                'checkout_type', v_tx.checkout_type,
                'provider', v_provider
            );
        END;
        $body$;
    $func$;

    GRANT EXECUTE ON FUNCTION public.confirm_marketplace_payment(UUID, TEXT, TEXT, TEXT, TEXT)
        TO authenticated, service_role;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. confirm_session_booking_payment — multi-provider (solo si tabla existe)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='session_bookings') THEN
        RAISE NOTICE 'session_bookings no existe; saltando confirm_session_booking_payment.';
        RETURN;
    END IF;

    DROP FUNCTION IF EXISTS public.confirm_session_booking_payment(UUID, TEXT, TEXT);
    DROP FUNCTION IF EXISTS public.confirm_session_booking_payment(UUID, TEXT, TEXT, TEXT);

    EXECUTE $func$
        CREATE OR REPLACE FUNCTION public.confirm_session_booking_payment(
            p_booking_id UUID,
            p_wompi_reference TEXT,
            p_wompi_transaction_id TEXT,
            p_provider TEXT DEFAULT 'wompi'
        )
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        DECLARE
            v_booking RECORD;
            v_provider public.payment_provider := public.resolve_payment_provider(p_provider);
            v_is_wompi BOOLEAN := v_provider = 'wompi';
        BEGIN
            SELECT * INTO v_booking FROM public.session_bookings WHERE id = p_booking_id FOR UPDATE;
            IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found'; END IF;

            IF v_booking.payment_status = 'paid'
               AND v_booking.provider_transaction_id = p_wompi_transaction_id
               AND v_booking.payment_provider = v_provider
            THEN
                RETURN jsonb_build_object('ok', true, 'idempotent', true);
            END IF;

            IF v_booking.payment_status = 'paid'
               AND v_is_wompi
               AND v_booking.wompi_transaction_id = p_wompi_transaction_id
            THEN
                RETURN jsonb_build_object('ok', true, 'idempotent', true, 'legacy_match', true);
            END IF;

            UPDATE public.session_bookings
            SET payment_status = 'paid',
                payment_provider = v_provider,
                provider_reference = p_wompi_reference,
                provider_transaction_id = p_wompi_transaction_id,
                wompi_reference = CASE WHEN v_is_wompi THEN p_wompi_reference ELSE wompi_reference END,
                wompi_transaction_id = CASE WHEN v_is_wompi THEN p_wompi_transaction_id ELSE wompi_transaction_id END,
                paid_at = NOW(),
                updated_at = NOW()
            WHERE id = p_booking_id;

            RETURN jsonb_build_object('ok', true, 'booking_id', p_booking_id, 'provider', v_provider);
        END;
        $body$;
    $func$;

    GRANT EXECUTE ON FUNCTION public.confirm_session_booking_payment(UUID, TEXT, TEXT, TEXT)
        TO service_role;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. save_payment_token — multi-provider (Wompi token vs MP customer/card)
-- ─────────────────────────────────────────────────────────────────────────────

-- Wompi: provider_token = wompi_token (1 token)
-- MP:    provider_customer_id + provider_card_id; provider_token = customer_id:card_id
--        (sintetico para mantener unique constraint)

DROP FUNCTION IF EXISTS public.save_payment_token(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN);

CREATE OR REPLACE FUNCTION public.save_payment_token(
    p_user_id UUID,
    p_wompi_token TEXT,                       -- semantica: provider_token (wompi token o customer:card)
    p_payment_method_type TEXT,
    p_last_four TEXT DEFAULT NULL,
    p_brand TEXT DEFAULT NULL,
    p_holder_name TEXT DEFAULT NULL,
    p_expires_at DATE DEFAULT NULL,
    p_set_default BOOLEAN DEFAULT true,
    p_provider TEXT DEFAULT 'wompi',
    p_provider_customer_id TEXT DEFAULT NULL,
    p_provider_card_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_id UUID;
    v_provider public.payment_provider := public.resolve_payment_provider(p_provider);
    v_is_wompi BOOLEAN := v_provider = 'wompi';
BEGIN
    INSERT INTO public.payment_tokens (
        user_id,
        payment_provider,
        provider_token,
        provider_customer_id,
        provider_card_id,
        wompi_token,
        payment_method_type,
        last_four,
        brand,
        holder_name,
        expires_at,
        is_default
    ) VALUES (
        p_user_id,
        v_provider,
        p_wompi_token,
        p_provider_customer_id,
        p_provider_card_id,
        CASE WHEN v_is_wompi THEN p_wompi_token ELSE NULL END,
        p_payment_method_type,
        p_last_four,
        p_brand,
        p_holder_name,
        p_expires_at,
        p_set_default
    )
    ON CONFLICT (payment_provider, provider_token)
    WHERE provider_token IS NOT NULL
    DO UPDATE
        SET payment_method_type = EXCLUDED.payment_method_type,
            last_four = COALESCE(EXCLUDED.last_four, payment_tokens.last_four),
            brand = COALESCE(EXCLUDED.brand, payment_tokens.brand),
            provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, payment_tokens.provider_customer_id),
            provider_card_id = COALESCE(EXCLUDED.provider_card_id, payment_tokens.provider_card_id),
            updated_at = NOW()
    RETURNING id INTO v_token_id;

    IF p_set_default THEN
        UPDATE public.payment_tokens
        SET is_default = false
        WHERE user_id = p_user_id AND id != v_token_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'token_id', v_token_id, 'provider', v_provider);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_payment_token(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN, TEXT, TEXT, TEXT)
    TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. complete_refund — multi-provider (acepta provider_void_id y provider)
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.complete_refund(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.complete_refund(
    p_refund_id UUID,
    p_wompi_void_id TEXT,                  -- semantica: provider_void_id
    p_provider TEXT DEFAULT 'wompi'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_refund RECORD;
    v_item RECORD;
    v_stock_before INT;
    v_has_variants BOOLEAN := EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='product_variants');
    v_has_mkt BOOLEAN := EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions');
    v_provider public.payment_provider := public.resolve_payment_provider(p_provider);
    v_is_wompi BOOLEAN := v_provider = 'wompi';
BEGIN
    SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;

    UPDATE public.refunds
    SET status = 'completed',
        payment_provider = v_provider,
        provider_void_id = p_wompi_void_id,
        wompi_void_id = CASE WHEN v_is_wompi THEN p_wompi_void_id ELSE wompi_void_id END,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_refund_id;

    IF v_refund.order_id IS NOT NULL THEN
        UPDATE public.orders SET status = 'refunded', updated_at = NOW() WHERE id = v_refund.order_id;

        FOR v_item IN
            SELECT id, product_id, variant_id, quantity
            FROM public.order_items
            WHERE order_id = v_refund.order_id
            ORDER BY product_id, variant_id NULLS FIRST
        LOOP
            IF v_item.variant_id IS NOT NULL AND v_has_variants THEN
                EXECUTE 'SELECT stock FROM public.product_variants WHERE id = $1 FOR UPDATE'
                    INTO v_stock_before USING v_item.variant_id;
                EXECUTE 'UPDATE public.product_variants SET stock = stock + $1, updated_at = NOW() WHERE id = $2'
                    USING v_item.quantity, v_item.variant_id;
            ELSE
                SELECT stock INTO v_stock_before FROM public.products WHERE id = v_item.product_id FOR UPDATE;
                UPDATE public.products SET stock = stock + v_item.quantity, updated_at = NOW() WHERE id = v_item.product_id;
            END IF;

            INSERT INTO public.inventory_logs (
                product_id, variant_id, vendor_id, delta, stock_before, stock_after, reason, order_id
            ) VALUES (
                v_item.product_id, v_item.variant_id,
                (SELECT vendor_id FROM public.products WHERE id = v_item.product_id),
                v_item.quantity,
                v_stock_before,
                v_stock_before + v_item.quantity,
                'returned',
                v_refund.order_id
            );
        END LOOP;
    ELSIF v_refund.transaction_id IS NOT NULL AND v_has_mkt THEN
        EXECUTE 'UPDATE public.marketplace_transactions SET status = ''refunded'', updated_at = NOW() WHERE id = $1'
            USING v_refund.transaction_id;
    ELSIF v_refund.payment_id IS NOT NULL THEN
        UPDATE public.payments SET status = 'refunded', updated_at = NOW() WHERE id = v_refund.payment_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id, 'provider', v_provider);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_refund(UUID, TEXT, TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. split_order_payment — multi-provider (provider_fee parametrizado)
--    MP en CO cobra ~3.49% + IVA; Wompi ~2.65%. El BFF pasa la tasa correcta.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.split_order_payment(UUID, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.split_order_payment(
    p_order_id UUID,
    p_sportmaps_fee_pct NUMERIC DEFAULT 5.0,
    p_provider_fee_pct NUMERIC DEFAULT NULL,    -- si NULL, deduce desde provider del order
    p_provider TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_split RECORD;
    v_count INT := 0;
    v_provider public.payment_provider;
    v_provider_fee_pct NUMERIC;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND OR v_order.status != 'paid' THEN
        RAISE EXCEPTION 'order_not_paid';
    END IF;

    IF EXISTS (SELECT 1 FROM public.vendor_payouts WHERE order_id = p_order_id) THEN
        RETURN jsonb_build_object('ok', true, 'idempotent', true);
    END IF;

    -- Resolver provider: explicito > order.payment_provider > 'wompi'
    v_provider := COALESCE(
        public.resolve_payment_provider(p_provider),
        v_order.payment_provider,
        'wompi'::public.payment_provider
    );

    -- Tarifa por defecto segun provider (CO):
    --   wompi:        2.65%
    --   mercadopago:  3.49%
    v_provider_fee_pct := COALESCE(
        p_provider_fee_pct,
        CASE v_provider
            WHEN 'mercadopago' THEN 3.49
            ELSE 2.65
        END
    );

    FOR v_split IN
        SELECT
            oi.vendor_id,
            SUM(COALESCE(oi.subtotal, oi.unit_price * oi.quantity) + COALESCE(oi.tax_amount, 0)) AS gross
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id AND oi.vendor_id IS NOT NULL
        GROUP BY oi.vendor_id
    LOOP
        INSERT INTO public.vendor_payouts (
            vendor_id, order_id, gross_amount,
            sportmaps_fee, provider_fee, wompi_fee, net_amount,
            payment_provider,
            status, scheduled_for
        ) VALUES (
            v_split.vendor_id,
            p_order_id,
            v_split.gross,
            v_split.gross * (p_sportmaps_fee_pct / 100),
            v_split.gross * (v_provider_fee_pct / 100),
            -- Mantener wompi_fee legacy mirrored solo cuando provider='wompi'
            CASE WHEN v_provider = 'wompi'
                 THEN v_split.gross * (v_provider_fee_pct / 100)
                 ELSE 0 END,
            v_split.gross - (v_split.gross * ((p_sportmaps_fee_pct + v_provider_fee_pct) / 100)),
            v_provider,
            'pending',
            (CURRENT_DATE + INTERVAL '7 days')::date
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'ok', true,
        'payouts_created', v_count,
        'order_id', p_order_id,
        'provider', v_provider,
        'provider_fee_pct', v_provider_fee_pct
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.split_order_payment(UUID, NUMERIC, NUMERIC, TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. flag_payment_for_review — sin cambios estructurales pero tolerante a session_bookings
--    (ya lo era; queda asi para documentacion)
-- ─────────────────────────────────────────────────────────────────────────────
-- No modificada — ver 20260503000005_payment_review_lock.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. subscriptions_due_for_billing — actualizar vista para soportar MP
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='subscriptions') THEN
        EXECUTE $sql$
            CREATE OR REPLACE VIEW public.subscriptions_due_for_billing
            WITH (security_invoker = true)
            AS
            SELECT
                s.id AS subscription_id,
                s.user_id,
                s.plan_id,
                s.payment_token_id,
                pt.payment_provider,
                pt.provider_token,
                pt.provider_customer_id,
                pt.provider_card_id,
                pt.wompi_token,                          -- legacy, sigue disponible
                CASE
                    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='subscription_plans')
                    THEN (SELECT sp.price FROM public.subscription_plans sp WHERE sp.id = s.plan_id)
                    ELSE NULL
                END AS price,
                CASE
                    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='subscription_plans')
                    THEN (SELECT sp.name FROM public.subscription_plans sp WHERE sp.id = s.plan_id)
                    ELSE NULL
                END AS plan_name,
                s.next_billing_date
            FROM public.subscriptions s
            JOIN public.payment_tokens pt ON pt.id = s.payment_token_id AND pt.is_active = true
            WHERE s.auto_renew = true
              AND s.status = 'active'
              AND s.next_billing_date <= CURRENT_DATE
              AND (s.last_billing_attempt_at IS NULL OR s.last_billing_attempt_at < (CURRENT_DATE - INTERVAL '6 hours'))
        $sql$;

        EXECUTE 'GRANT SELECT ON public.subscriptions_due_for_billing TO service_role';
    END IF;
END $$;

COMMIT;
