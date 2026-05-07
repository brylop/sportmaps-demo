-- ============================================================================
-- Lock de pagos por revision de negocio.
--
-- Regla: si un pago falla por cualquier razon (DECLINED/ERROR/VOIDED), la
-- entidad afectada queda en 'requires_review = true' y el USUARIO completo
-- queda bloqueado para iniciar nuevos checkouts (escuela, marketplace, cart)
-- hasta que un admin/owner lo destrabe explicitamente.
--
-- Implementacion:
--  1. Columnas requires_review / last_failure_at / last_failure_reason /
--     unblocked_at / unblocked_by en payments, marketplace_transactions, orders.
--  2. RPC is_user_payment_blocked(uuid) — chequea si un user tiene algun
--     pago en review pendiente.
--  3. RPC flag_payment_for_review(kind, id, reason) — llamada desde el
--     webhook al detectar fallo. SECURITY DEFINER para que webhook (service_role)
--     pueda escribir aunque RLS este activa.
--  4. RPC unblock_payment(kind, id) — destrabe manual por admin/school owner /
--     vendor del pago. Verifica permisos antes de actualizar.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columnas de review en payments, marketplace_transactions, orders
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_failure_reason TEXT,
    ADD COLUMN IF NOT EXISTS unblocked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS unblocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
        ALTER TABLE public.marketplace_transactions
            ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS last_failure_reason TEXT,
            ADD COLUMN IF NOT EXISTS unblocked_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS unblocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_failure_reason TEXT,
    ADD COLUMN IF NOT EXISTS unblocked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS unblocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_user_review
    ON public.payments (user_id) WHERE requires_review = true;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
        CREATE INDEX IF NOT EXISTS idx_marketplace_tx_user_review
            ON public.marketplace_transactions (user_id) WHERE requires_review = true;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_user_review
    ON public.orders (user_id) WHERE requires_review = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. is_user_payment_blocked — chequea si un user tiene algun pago en review
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_user_payment_blocked(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_blocked_payments INT := 0;
    v_blocked_marketplace INT := 0;
    v_blocked_orders INT := 0;
    v_first_reason TEXT;
    v_first_failure_at TIMESTAMPTZ;
BEGIN
    SELECT COUNT(*) INTO v_blocked_payments
    FROM public.payments
    WHERE user_id = p_user_id AND requires_review = true;

    SELECT COUNT(*) INTO v_blocked_orders
    FROM public.orders
    WHERE user_id = p_user_id AND requires_review = true;

    -- marketplace_transactions es opcional segun entorno
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
        EXECUTE 'SELECT COUNT(*) FROM public.marketplace_transactions WHERE user_id = $1 AND requires_review = true'
            INTO v_blocked_marketplace USING p_user_id;
    END IF;

    -- Primera razon de bloqueo (la mas reciente)
    SELECT reason, failure_at INTO v_first_reason, v_first_failure_at
    FROM (
        SELECT last_failure_reason AS reason, last_failure_at AS failure_at
        FROM public.payments WHERE user_id = p_user_id AND requires_review = true
        UNION ALL
        SELECT last_failure_reason, last_failure_at
        FROM public.orders WHERE user_id = p_user_id AND requires_review = true
    ) all_blocks
    ORDER BY failure_at DESC NULLS LAST
    LIMIT 1;

    RETURN jsonb_build_object(
        'blocked', (v_blocked_payments + v_blocked_marketplace + v_blocked_orders) > 0,
        'counts', jsonb_build_object(
            'payments', v_blocked_payments,
            'marketplace_transactions', v_blocked_marketplace,
            'orders', v_blocked_orders
        ),
        'last_reason', v_first_reason,
        'last_failure_at', v_first_failure_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_user_payment_blocked(UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. flag_payment_for_review — llamado por el webhook al detectar fallo
-- ─────────────────────────────────────────────────────────────────────────────

-- Tolerante: usa EXECUTE dinamico para marketplace_transactions / session_bookings
-- de modo que la funcion compile aunque esas tablas no existan en este entorno.
CREATE OR REPLACE FUNCTION public.flag_payment_for_review(
    p_kind TEXT,
    p_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_kind = 'payment' THEN
        UPDATE public.payments
        SET requires_review = true, last_failure_at = NOW(),
            last_failure_reason = p_reason, updated_at = NOW()
        WHERE id = p_id;
    ELSIF p_kind = 'order' THEN
        UPDATE public.orders
        SET requires_review = true, last_failure_at = NOW(),
            last_failure_reason = p_reason, updated_at = NOW()
        WHERE id = p_id;
    ELSIF p_kind = 'marketplace_transaction' THEN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
            EXECUTE 'UPDATE public.marketplace_transactions SET requires_review = true, last_failure_at = NOW(), last_failure_reason = $1, updated_at = NOW() WHERE id = $2'
                USING p_reason, p_id;
        END IF;
    ELSIF p_kind = 'session_booking' THEN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='session_bookings') THEN
            EXECUTE 'UPDATE public.session_bookings SET requires_review = true, last_failure_at = NOW(), last_failure_reason = $1, updated_at = NOW() WHERE id = $2'
                USING p_reason, p_id;
        END IF;
    ELSE
        RAISE EXCEPTION 'invalid_kind: %', p_kind;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flag_payment_for_review(TEXT, UUID, TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. unblock_payment — destrabe manual; verifica permisos del solicitante
-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos:
--  - admin global puede destrabar cualquiera
--  - school owner / school_admin puede destrabar payments de su escuela
--  - vendor / store_owner puede destrabar orders de sus productos
--  - organizer puede destrabar marketplace_transactions de tipo 'event' de sus eventos
--
-- Devuelve { ok: true, kind, id } o { ok: false, error }

CREATE OR REPLACE FUNCTION public.unblock_payment(
    p_kind TEXT,
    p_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID;
    v_actor_role TEXT;
    v_authorized BOOLEAN := false;
BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
    END IF;

    SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor;

    -- Admin global pasa siempre
    IF v_actor_role = 'admin' THEN
        v_authorized := true;
    END IF;

    IF p_kind = 'payment' THEN
        IF NOT v_authorized THEN
            -- school owner / school_admin de la escuela del payment
            SELECT EXISTS (
                SELECT 1 FROM public.payments p
                JOIN public.schools s ON s.id = p.school_id
                WHERE p.id = p_id
                  AND (s.owner_id = v_actor OR v_actor_role IN ('school_admin', 'owner'))
            ) INTO v_authorized;
        END IF;

        IF NOT v_authorized THEN
            RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
        END IF;

        UPDATE public.payments
        SET requires_review = false,
            unblocked_at = NOW(),
            unblocked_by = v_actor,
            updated_at = NOW()
        WHERE id = p_id;

    ELSIF p_kind = 'marketplace_transaction' THEN
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions') THEN
            RETURN jsonb_build_object('ok', false, 'error', 'marketplace_transactions_not_available');
        END IF;
        IF NOT v_authorized THEN
            EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.marketplace_transactions mt WHERE mt.id = $1 AND (mt.vendor_id = $2 OR $3 IN (''store_owner'', ''wellness_professional'', ''organizer'')))'
                INTO v_authorized USING p_id, v_actor, v_actor_role;
        END IF;

        IF NOT v_authorized THEN
            RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
        END IF;

        EXECUTE 'UPDATE public.marketplace_transactions SET requires_review = false, unblocked_at = NOW(), unblocked_by = $1, updated_at = NOW() WHERE id = $2'
            USING v_actor, p_id;

    ELSIF p_kind = 'order' THEN
        IF NOT v_authorized THEN
            -- Vendor de la orden o de algun item
            SELECT EXISTS (
                SELECT 1 FROM public.orders o
                WHERE o.id = p_id
                  AND (o.vendor_id = v_actor
                       OR EXISTS (SELECT 1 FROM public.order_items oi
                                  WHERE oi.order_id = o.id AND oi.vendor_id = v_actor))
            ) INTO v_authorized;
        END IF;

        IF NOT v_authorized THEN
            RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
        END IF;

        UPDATE public.orders
        SET requires_review = false,
            unblocked_at = NOW(),
            unblocked_by = v_actor,
            updated_at = NOW()
        WHERE id = p_id;

    ELSE
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_kind');
    END IF;

    RETURN jsonb_build_object('ok', true, 'kind', p_kind, 'id', p_id, 'unblocked_by', v_actor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unblock_payment(TEXT, UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Vista admin: blocked_payments_view (todo lo bloqueado en un solo lugar)
-- ─────────────────────────────────────────────────────────────────────────────

-- Vista construida dinamicamente: incluye marketplace_transactions solo si existe.
DO $$
DECLARE
    v_has_mkt BOOLEAN := EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='marketplace_transactions');
    v_sql TEXT;
BEGIN
    v_sql := $sql$
        CREATE OR REPLACE VIEW public.blocked_payments_view
        WITH (security_invoker = true)
        AS
        SELECT 'payment' AS kind, id, user_id, amount AS gross_amount, last_failure_at, last_failure_reason, created_at
        FROM public.payments
        WHERE requires_review = true
        UNION ALL
        SELECT 'order' AS kind, id, user_id, total_amount AS gross_amount, last_failure_at, last_failure_reason, created_at
        FROM public.orders
        WHERE requires_review = true
    $sql$;

    IF v_has_mkt THEN
        v_sql := v_sql || $sql$
            UNION ALL
            SELECT 'marketplace_transaction' AS kind, id, user_id, gross_amount, last_failure_at, last_failure_reason, created_at
            FROM public.marketplace_transactions
            WHERE requires_review = true
        $sql$;
    END IF;

    EXECUTE v_sql;
END $$;

GRANT SELECT ON public.blocked_payments_view TO authenticated;

COMMIT;
